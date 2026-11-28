import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { adminDb } from '../config/firebaseAdmin.js';
import type { MigrateAuditLogsInput } from '../validators/auditLogValidators.js';

export interface MigrateAuditLogsResult {
  migratedCount: number;
  skippedCount: number;
  failedCount: number;
  mappings: Array<{ localId: string; firestoreId: string; status: 'migrated' | 'skipped' | 'failed'; reason?: string }>;
}

function sanitizeDescription(value: unknown): string {
  const text = String(value ?? '').trim();
  return text.length > 1000 ? text.slice(0, 1000) : text;
}

function safeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stableFingerprint(log: MigrateAuditLogsInput['logs'][number], actorUid: string): string {
  const createdAt = safeIsoDate(log.createdAt) ?? '';
  return [log.localId, actorUid, log.action.trim(), log.module.trim(), sanitizeDescription(log.description), createdAt].join('|');
}

function deterministicDocId(localId: string, actorUid: string, fingerprint: string): string {
  const hash = createHash('sha256').update(`${actorUid}|${localId}|${fingerprint}`).digest('hex').slice(0, 40);
  return `migrated_${hash}`;
}

export async function migrateAuditLogs(
  input: MigrateAuditLogsInput,
  actor: { uid: string; displayName: string },
  db: Firestore = adminDb,
): Promise<MigrateAuditLogsResult> {
  const mappings: MigrateAuditLogsResult['mappings'] = [];
  let migratedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const item of input.logs) {
    const localId = item.localId.trim();
    const fingerprint = stableFingerprint(item, actor.uid);
    const docId = deterministicDocId(localId, actor.uid, fingerprint);
    const lockRef = db.collection('audit_log_migration_locks').doc(docId);
    const ref = db.collection('audit_logs').doc(docId);

    try {
      const result = await db.runTransaction(async (transaction) => {
        const lockSnap = await transaction.get(lockRef);
        if (lockSnap.exists) {
          return { status: 'skipped' as const, firestoreId: (lockSnap.data()?.firestoreId as string) || docId };
        }
        const snap = await transaction.get(ref);
        if (snap.exists) {
          transaction.set(lockRef, {
            localId,
            firestoreId: snap.id,
            actorUid: actor.uid,
            migrationFingerprint: fingerprint,
            createdAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          return { status: 'skipped' as const, firestoreId: snap.id };
        }

        const createdAtIso = safeIsoDate(item.createdAt);
        const createdAtDate = createdAtIso ? new Date(createdAtIso) : null;
        const payload = {
          userId: actor.uid,
          userName: actor.displayName,
          action: item.action.trim(),
          module: item.module.trim(),
          description: sanitizeDescription(item.description),
          createdAt: createdAtDate ?? FieldValue.serverTimestamp(),
          clientTimestamp: createdAtIso,
          source: 'migrated_local',
          migratedFromLocalId: localId,
          migratedAt: FieldValue.serverTimestamp(),
          migratedBy: actor.uid,
          migratedByName: actor.displayName,
          clientEventId: item.clientEventId?.trim() || fingerprint,
          migrationFingerprint: fingerprint,
        };

        transaction.set(ref, payload);
        transaction.set(lockRef, {
          localId,
          firestoreId: ref.id,
          actorUid: actor.uid,
          migrationFingerprint: fingerprint,
          createdAt: FieldValue.serverTimestamp(),
        });
        return { status: 'migrated' as const, firestoreId: ref.id };
      });

      if (result.status === 'migrated') migratedCount += 1;
      else skippedCount += 1;
      mappings.push({ localId, firestoreId: result.firestoreId, status: result.status, reason: result.status === 'skipped' ? 'Sudah dimigrasikan.' : undefined });
    } catch {
      failedCount += 1;
      mappings.push({ localId, firestoreId: '', status: 'failed', reason: 'Gagal migrasi item.' });
    }
  }

  return { migratedCount, skippedCount, failedCount, mappings };
}
