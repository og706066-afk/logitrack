import type { Response } from 'express';
import { deleteAuditLogsSchema, migrateAuditLogsSchema } from '../validators/auditLogValidators.js';
import { deleteAuditLogs } from '../services/auditDeleteService.js';
import { migrateAuditLogs } from '../services/auditMigrationService.js';
import type { AuthenticatedRequest } from '../middlewares/authMiddleware.js';

export async function deleteAuditLogsController(request: AuthenticatedRequest, response: Response): Promise<void> {
  const parsed = deleteAuditLogsSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      success: false,
      message: 'Permintaan tidak valid.',
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const actor = request.userProfile;
  if (!actor) {
    response.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
    return;
  }

  try {
    const result = await deleteAuditLogs(parsed.data, { uid: actor.uid, displayName: actor.displayName });
    response.status(200).json({
      success: true,
      message: `${result.deletedCount} aktivitas berhasil dihapus.`,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menghapus aktivitas.';
    const status = /tidak ditemukan/i.test(message) ? 409 : 500;
    response.status(status).json({ success: false, message });
  }
}
export async function migrateAuditLogsController(request: AuthenticatedRequest, response: Response): Promise<void> {
  const parsed = migrateAuditLogsSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      success: false,
      message: 'Permintaan tidak valid.',
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const actor = request.userProfile;
  if (!actor) {
    response.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
    return;
  }

  try {
    const result = await migrateAuditLogs(parsed.data, { uid: actor.uid, displayName: actor.displayName });
    response.status(200).json({
      success: true,
      message: `Migrasi selesai: ${result.migratedCount} berhasil, ${result.skippedCount} dilewati, ${result.failedCount} gagal.`,
      ...result,
    });
  } catch {
    response.status(500).json({ success: false, message: 'Gagal memigrasikan audit log.' });
  }
}
