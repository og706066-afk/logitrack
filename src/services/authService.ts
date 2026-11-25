import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import type { UserProfile } from '../types';

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
  const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);

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
  const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);

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

export async function logoutUser(): Promise<void> {
  const { auth: firebaseAuth } = getFirebaseContext();
  await signOut(firebaseAuth);
}
