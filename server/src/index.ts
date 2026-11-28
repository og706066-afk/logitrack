
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { adminAuth, adminDb } from './config/firebaseAdmin.js';
import { authenticate, requirePermission, type AuthenticatedRequest } from './middlewares/authMiddleware.js';
import { auditLogRouter } from './routes/auditLogRoutes.js';

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const trustProxyEnv = process.env.TRUST_PROXY?.trim().toLowerCase();

if (trustProxyEnv !== undefined && trustProxyEnv !== '') {
  if (trustProxyEnv === 'false' || trustProxyEnv === '0') {
    app.set('trust proxy', false);
  } else if (trustProxyEnv === 'true' || trustProxyEnv === '1') {
    app.set('trust proxy', 1);
  } else if (/^[1-9]\d*$/.test(trustProxyEnv)) {
    app.set('trust proxy', Number(trustProxyEnv));
  } else {
    throw new Error(
      `Konfigurasi TRUST_PROXY tidak valid: "${process.env.TRUST_PROXY}". Gunakan true/1, false/0, atau angka hop positif.`,
    );
  }
} else if (process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
  // Railway runs behind a reverse proxy; trust the first hop so express-rate-limit
  // uses the client IP from X-Forwarded-For without allowing arbitrary spoofing.
  app.set('trust proxy', 1);
}

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'SILOG Backend berjalan',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/test/firebase', async (_req, res) => {
  try {
    await adminAuth.listUsers(1);
    await adminDb.collection('users').limit(1).get();

    res.status(200).json({
      success: true,
      message: 'Firebase Admin SDK berhasil terhubung',
      services: {
        authentication: 'connected',
        firestore: 'connected',
      },
    });
  } catch (error) {
  console.error('========== FIREBASE ERROR ==========');
  console.error(error);
  console.error('====================================');

  res.status(500).json({
    success: false,
    message: 'Gagal menghubungkan Firebase Admin SDK',
    error: error instanceof Error ? error.message : String(error),
  });
}
});

app.get('/api/me', authenticate, (request: AuthenticatedRequest, response) => {
  response.status(200).json({ success: true, profile: request.userProfile });
});

app.get('/api/reports/summary', authenticate, requirePermission('reports.view'), async (_request, response) => {
  try {
    const [items, needs, shipments, transactions] = await Promise.all([
      adminDb.collection('products').get(),
      adminDb.collection('needsRequests').get(),
      adminDb.collection('shipments').get(),
      adminDb.collection('stockTransactions').get(),
    ]);
    response.status(200).json({
      success: true,
      summary: {
        totalItems: items.size,
        pendingNeeds: needs.docs.filter(doc => doc.data().status === 'Pending').length,
        activeShipments: shipments.docs.filter(doc => ['Siap dikirim', 'Dalam perjalanan'].includes(doc.data().status)).length,
        confirmedTransactions: transactions.docs.filter(doc => doc.data().status === 'Confirmed').length,
      },
    });
  } catch (error) {
    response.status(500).json({ success: false, message: error instanceof Error ? error.message : String(error) });
  }
});

app.use('/api/audit-logs', auditLogRouter);

app.listen(PORT, () => {
  console.log(`SILOG Backend berjalan di http://localhost:${PORT}`);
});
