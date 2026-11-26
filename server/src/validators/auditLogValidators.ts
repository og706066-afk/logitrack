import { z } from 'zod';

export const archiveAuditLogsSchema = z.object({
  logIds: z.array(z.string().trim().min(1, 'ID log tidak valid')).min(1, 'Pilih minimal satu log').max(50, 'Maksimal 50 log per permintaan'),
  archiveReason: z.string().trim().max(500, 'Alasan arsip terlalu panjang').optional(),
});

export type ArchiveAuditLogsInput = z.infer<typeof archiveAuditLogsSchema>;
