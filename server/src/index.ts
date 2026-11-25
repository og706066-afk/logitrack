
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';

import { adminAuth, adminDb } from './config/firebaseAdmin.js';

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

interface AuthenticatedRequest extends Request {
  userProfile?: {
    uid: string;
    role: string;
    permissions: string[];
    isActive: boolean;
  };
}

async function authenticate(request: AuthenticatedRequest, response: Response, next: NextFunction): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    response.status(401).json({ success: false, message: 'Token otorisasi diperlukan.' });
    return;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(header.slice(7));
    const profile = await adminDb.collection('users').doc(decoded.uid).get();
    const data = profile.data();
    if (!profile.exists || !data || data.isActive !== true) {
      response.status(403).json({ success: false, message: 'Akun tidak aktif.' });
      return;
    }
    request.userProfile = {
      uid: decoded.uid,
      role: String(data.role ?? ''),
      permissions: Array.isArray(data.permissions) ? data.permissions : [],
      isActive: true,
    };
    next();
  } catch {
    response.status(401).json({ success: false, message: 'Token tidak valid.' });
  }
}

function requirePermission(permission: string) {
  return (request: AuthenticatedRequest, response: Response, next: NextFunction): void => {
    const profile = request.userProfile;
    if (!profile) {
      response.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
      return;
    }
    const allowed = profile.role === 'Super Admin' || profile.permissions.includes(permission) || profile.permissions.includes('*');
    if (!allowed) {
      response.status(403).json({ success: false, message: `Izin ${permission} diperlukan.` });
      return;
    }
    next();
  };
}

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

app.listen(PORT, () => {
  console.log(`SILOG Backend berjalan di http://localhost:${PORT}`);
});
