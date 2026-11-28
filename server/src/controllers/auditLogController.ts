import type { Response } from 'express';
import { archiveAuditLogsSchema, migrateAuditLogsSchema } from '../validators/auditLogValidators.js';
import { archiveAuditLogs } from '../services/auditArchiveService.js';
import { migrateAuditLogs } from '../services/auditMigrationService.js';
import type { AuthenticatedRequest } from '../middlewares/authMiddleware.js';

export async function archiveAuditLogsController(request: AuthenticatedRequest, response: Response): Promise<void> {
  const parsed = archiveAuditLogsSchema.safeParse(request.body);
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
    const result = await archiveAuditLogs(parsed.data, { uid: actor.uid, displayName: actor.displayName });
    response.status(200).json({
      success: true,
      message: `${result.archivedCount} aktivitas berhasil diarsipkan.`,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengarsipkan aktivitas.';
    const status = /tidak ditemukan|sudah diarsipkan/i.test(message) ? 409 : 500;
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
