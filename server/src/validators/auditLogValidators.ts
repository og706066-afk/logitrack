import { z } from 'zod';

const firestoreDocId = z.string().trim().min(1, 'ID log tidak valid').max(128, 'ID log tidak valid').refine((id) => !/^log-\d+-\d+$/.test(id), 'Format ID log tidak valid untuk arsip');

export const archiveAuditLogsSchema = z.object({
  logIds: z.array(firestoreDocId).min(1, 'Pilih minimal satu log').max(50, 'Maksimal 50 log per permintaan'),
  archiveReason: z.string().trim().max(500, 'Alasan arsip terlalu panjang').optional(),
});

const localAuditId = z.string().trim().regex(/^log-\d+-\d+$/, 'ID lokal tidak valid').max(128);
const isoDateString = z.string().trim().max(64).refine((value) => !Number.isNaN(new Date(value).getTime()), 'Tanggal log tidak valid').optional();

export const migrateAuditLogsSchema = z.object({
  logs: z.array(z.object({
    localId: localAuditId,
    action: z.string().trim().min(1).max(120),
    module: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).optional(),
    createdAt: isoDateString,
    clientEventId: z.string().trim().max(200).regex(/^[a-zA-Z0-9:._|-]+$/, 'Client event ID tidak valid').optional(),
  }).strict()).min(1, 'Pilih minimal satu log').max(50, 'Maksimal 50 log per migrasi'),
}).strict();

export type ArchiveAuditLogsInput = z.infer<typeof archiveAuditLogsSchema>;
export type MigrateAuditLogsInput = z.infer<typeof migrateAuditLogsSchema>;
