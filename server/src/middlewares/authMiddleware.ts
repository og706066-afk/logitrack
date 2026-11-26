import type { NextFunction, Request, Response } from 'express';
import { adminAuth, adminDb } from '../config/firebaseAdmin.js';

export interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email: string;
  };
  userProfile?: {
    uid: string;
    role: string;
    permissions: string[];
    isActive: boolean;
    displayName: string;
  };
}

export async function authenticate(request: AuthenticatedRequest, response: Response, next: NextFunction): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    response.status(401).json({ success: false, message: 'Token otorisasi diperlukan.' });
    return;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(header.slice(7));
    const profileSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const data = profileSnap.data();

    if (!profileSnap.exists || !data) {
      response.status(403).json({ success: false, message: 'Profil pengguna tidak ditemukan.' });
      return;
    }

    if (data.isActive !== true) {
      response.status(403).json({ success: false, message: 'Akun tidak aktif.' });
      return;
    }

    request.authUser = {
      uid: decoded.uid,
      email: decoded.email ?? '',
    };
    request.userProfile = {
      uid: decoded.uid,
      role: String(data.role ?? ''),
      permissions: Array.isArray(data.permissions) ? data.permissions : [],
      isActive: true,
      displayName: String(data.displayName ?? data.name ?? data.email ?? ''),
    };
    next();
  } catch {
    response.status(401).json({ success: false, message: 'Token tidak valid atau kedaluwarsa.' });
  }
}

export function requireSuperAdmin(request: AuthenticatedRequest, response: Response, next: NextFunction): void {
  if (!request.userProfile) {
    response.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
    return;
  }

  if (request.userProfile.role !== 'Super Admin') {
    response.status(403).json({ success: false, message: 'Hanya Super Admin yang dapat melakukan aksi ini.' });
    return;
  }

  next();
}

export function requirePermission(permission: string) {
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
