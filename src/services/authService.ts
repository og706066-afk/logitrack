import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig, isFirebaseConfigured } from './firebase';
import type { UserProfile } from '../types';
import { logAudit } from './rbacService';

export const DEFAULT_USER_ROLE = 'Viewer';

function getFirebaseContext() {
  if (!isFirebaseConfigured || !auth || !db) {
    throw new Error('Firebase belum dikonfigurasi. Hubungi administrator sistem.');
  }
  return { auth, db };
}

function resolveName(user: FirebaseUser, preferredName?: string): string {
  return preferredName?.trim() || user.displayName || 'User SILOG';
}

function authErrorMessage(error: unknown, fallback: string): string {
  const code = (error as { code?: string } | null)?.code || '';
  if ([
    'auth/invalid-credential',
    'auth/wrong-password',
    'auth/user-not-found',
    'auth/invalid-email',
    'auth/missing-password',
  ].includes(code)) {
    return 'Email atau kata sandi salah.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Terlalu banyak percobaan masuk. Coba lagi nanti.';
  }
  if (code === 'auth/user-disabled') {
    return 'Akun ini telah dinonaktifkan.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Koneksi jaringan gagal. Periksa internet Anda.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'Email sudah terdaftar. Gunakan email lain atau masuk saja.';
  }
  if (code === 'auth/weak-password') {
    return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
  }
  return (error as Error | null)?.message || fallback;
}

function buildProfile(user: FirebaseUser, preferredName?: string): UserProfile {
  const name = resolveName(user, preferredName);
  return {
    uid: user.uid,
    name,
    displayName: name,
    email: user.email || '',
    role: DEFAULT_USER_ROLE,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function fetchUserProfile(user: FirebaseUser, preferredName?: string): Promise<UserProfile> {
  const { db: firestore } = getFirebaseContext();
  const userRef = doc(firestore, 'users', user.uid);

  const snapshot = await getDoc(userRef);
  if (snapshot.exists()) {
    return { ...(snapshot.data() as UserProfile), uid: user.uid };
  }

  const profile = buildProfile(user, preferredName);
  try {
    await setDoc(userRef, profile);
    return profile;
  } catch {
    const retry = await getDoc(userRef);
    if (retry.exists()) {
      return { ...(retry.data() as UserProfile), uid: user.uid };
    }
    throw new Error('Profil pengguna belum dapat dibuat. Hubungi administrator sistem.');
  }
}

export async function loginUser(email: string, password: string): Promise<UserProfile> {
  const { auth: firebaseAuth } = getFirebaseContext();

  let credential;
  try {
    credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  } catch (error) {
    throw new Error(authErrorMessage(error, 'Gagal masuk. Periksa kembali email dan kata sandi Anda.'));
  }

  try {
    return await fetchUserProfile(credential.user);
  } catch (error) {
    await signOut(firebaseAuth);
    throw error;
  }
}

export async function registerUser(name: string, email: string, password: string): Promise<UserProfile> {
  const { auth: firebaseAuth } = getFirebaseContext();
  const cleanName = name.trim();

  let credential;
  try {
    credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
  } catch (error) {
    throw new Error(authErrorMessage(error, 'Gagal membuat akun. Coba lagi.'));
  }

  try {
    await updateProfile(credential.user, { displayName: cleanName });
  } catch {}

  try {
    return await fetchUserProfile(credential.user, cleanName);
  } catch (error) {
    await signOut(firebaseAuth);
    throw error;
  }
}

export interface AdminCreateUserInput {
  name: string;
  email: string;
  password: string;
  role: string;
  permissions: string[];
  actor: UserProfile;
}

export async function createUserByAdmin(input: AdminCreateUserInput): Promise<UserProfile> {
  const { db: firestore } = getFirebaseContext();
  if (input.actor.role !== 'Super Admin') {
    throw new Error('Hanya Super Admin yang dapat menambahkan pengguna.');
  }

  const cleanName = input.name.trim();
  const cleanEmail = input.email.trim().toLowerCase();
  if (!cleanName || !cleanEmail || !input.password) {
    throw new Error('Nama, email, dan kata sandi wajib diisi.');
  }
  if (input.password.length < 6) {
    throw new Error('Kata sandi minimal 6 karakter.');
  }

  const tempApp = initializeApp(firebaseConfig, `silog-admin-create-${Date.now()}`);

  try {
    const tempAuth = getAuth(tempApp);
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(tempAuth, cleanEmail, input.password);
    } catch (error) {
      throw new Error(authErrorMessage(error, 'Gagal membuat akun. Coba lagi.'));
    }

    try {
      await updateProfile(credential.user, { displayName: cleanName });
    } catch {}

    const now = new Date();
    const profile: UserProfile = {
      uid: credential.user.uid,
      name: cleanName,
      displayName: cleanName,
      email: cleanEmail,
      role: input.role,
      permissions: input.permissions,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(firestore, 'users', profile.uid), profile);
    } catch {
      await credential.user.delete().catch(() => undefined);
      throw new Error('Gagal menyimpan profil pengguna. Pastikan aturan Firestore sudah diperbarui.');
    }

    await logAudit({
      userId: input.actor.uid,
      userName: input.actor.displayName,
      action: 'CREATE_USER',
      module: 'Pengguna',
      description: `Menambahkan pengguna ${cleanEmail} dengan role ${input.role}`,
    });

    return profile;
  } finally {
    await deleteApp(tempApp);
  }
}

export async function logoutUser(): Promise<void> {
  const { auth: firebaseAuth } = getFirebaseContext();
  await signOut(firebaseAuth);
}
