import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../config/firebaseAdmin.js';
import type { DeleteAuditLogsInput } from '../validators/auditLogValidators.js';

export interface DeleteAuditLogsResult {
  deletedCount: number;
  deletedIds: string[];
}

export async function deleteAuditLogs(
  input: DeleteAuditLogsInput,
  _actor: { uid: string; displayName: string },
  db: Firestore = adminDb,
): Promise<DeleteAuditLogsResult> {
  const uniqueIds = [...new Set(input.logIds)];
  const deletedIds: string[] = [];

  for (const id of uniqueIds) {
    await db.runTransaction(async (transaction) => {
      const ref = db.collection('audit_logs').doc(id);
      const snap = await transaction.get(ref);
      if (!snap.exists) {
        throw new Error(`Log tidak ditemukan: ${id}`);
      }
      transaction.delete(ref);
    });
    deletedIds.push(id);
  }

  return { deletedCount: deletedIds.length, deletedIds };
}
