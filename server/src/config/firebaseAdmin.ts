import {
  initializeApp,
  applicationDefault,
  cert,
  getApps,
} from 'firebase-admin/app';

import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getFirebaseCredential() {
  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (serviceAccountBase64) {
    try {
      const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(serviceAccountJson) as object;
      return cert(serviceAccount);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 tidak valid.');
    }
  }

  return applicationDefault();
}

const adminApp = getApps().length > 0
  ? getApps()[0]
  : initializeApp({
      credential: getFirebaseCredential(),
    });

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);