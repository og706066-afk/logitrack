import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../config/firebaseAdmin.js';
import type { ArchiveAuditLogsInput } from '../validators/auditLogValidators.js';

export interface ArchiveResult {
  archivedCount: number;
  archivedIds: string[];
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function sanitizeDescription(value: unknown): string {
  const text = String(value ?? '').trim();
  return text.length > 1000 ? text.slice(0, 1000) : text;
}

export async function archiveAuditLogs(
  input: ArchiveAuditLogsInput,
  actor: { uid: string; displayName: string },
  db: Firestore = adminDb,
): Promise<ArchiveResult> {
  const uniqueIds = [...new Set(input.logIds)];
  const batches = chunkArray(uniqueIds, 50);
  const archivedIds: string[] = [];

  for (const batchIds of batches) {
    await db.runTransaction(async (transaction) => {
      const refs = batchIds.map((id) => db.collection('audit_logs').doc(id));
      const snaps = await transaction.getAll(...refs);

      const missing = snaps.filter((snap) => !snap.exists).map((snap) => snap.id);
      if (missing.length > 0) {
        throw new Error(`Log tidak ditemukan: ${missing.join(', ')}`);
      }

      // Prevent re-archiving by checking if an archive with same originalLogId exists
      const archiveRefs = batchIds.map((id) => db.collection('audit_log_archives').doc(id));
      const archiveSnaps = await transaction.getAll(...archiveRefs);
      const alreadyArchived = archiveSnaps.filter((snap) => snap.exists).map((snap) => snap.id);
      if (alreadyArchived.length > 0) {
        throw new Error(`Log sudah diarsipkan: ${alreadyArchived.join(', ')}`);
      }

      snaps.forEach((snap) => {
        const data = snap.data() ?? {};
        const archiveRef = db.collection('audit_log_archives').doc(snap.id);
        transaction.set(archiveRef, {
          ...data,
          originalLogId: snap.id,
          archivedAt: FieldValue.serverTimestamp(),
          archivedBy: actor.uid,
          archivedByName: actor.displayName,
          archiveReason: input.archiveReason?.trim() || null,
        });
        transaction.delete(snap.ref);
      });

      // Add a new audit event in the active collection for this archive action
      const auditEventRef = db.collection('audit_logs').doc();
      transaction.set(auditEventRef, {
        userId: actor.uid,
        userName: actor.displayName,
        action: 'ARCHIVE_AUDIT_LOGS',
        module: 'Audit Log',
        description: sanitizeDescription(`Mengarsipkan ${batchIds.length} aktivitas audit log.`),
        createdAt: FieldValue.serverTimestamp(),
        archivedCount: batchIds.length,
        archiveReason: input.archiveReason?.trim() || null,
      });
    });

    archivedIds.push(...batchIds);
  }

  return { archivedCount: archivedIds.length, archivedIds };
}
