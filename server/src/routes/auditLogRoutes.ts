import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireSuperAdmin } from '../middlewares/authMiddleware.js';
import { archiveAuditLogsController } from '../controllers/auditLogController.js';

export const auditLogRouter = Router();

const archiveAuditLogsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan arsip. Coba lagi beberapa menit lagi.',
  },
});

auditLogRouter.post('/archive', archiveAuditLogsLimiter, authenticate, requireSuperAdmin, archiveAuditLogsController);
