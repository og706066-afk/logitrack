
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { adminAuth, adminDb } from './config/firebaseAdmin.js';

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors({
  origin: 'http://localhost:5173',
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

app.listen(PORT, () => {
  console.log(`SILOG Backend berjalan di http://localhost:${PORT}`);
});
