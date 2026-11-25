import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  fetchUserProfile,
  loginUser,
  logoutUser,
  registerUser,
} from '../src/services/authService';

vi.mock('../src/services/firebase', () => ({
  auth: { mocked: true },
  db: { mocked: true },
  isFirebaseConfigured: true,
}));

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, collection: string, id: string) => ({ collection, id })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

const authUser = {
  uid: 'uid-1',
  email: 'user@silog.test',
  displayName: null,
} as any;

const missingSnapshot = { exists: () => false } as any;

function existingSnapshot(data: Record<string, unknown>) {
  return { exists: () => true, data: () => data } as any;
}

describe('Firebase Auth + Firestore profile integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({ user: authUser } as any);
    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({ user: authUser } as any);
    vi.mocked(signOut).mockResolvedValue(undefined as any);
    vi.mocked(updateProfile).mockResolvedValue(undefined as any);
    vi.mocked(getDoc).mockResolvedValue(missingSnapshot);
    vi.mocked(setDoc).mockResolvedValue(undefined as any);
  });

  it('registers with Auth UID as document ID and default Viewer role', async () => {
    const profile = await registerUser('Nama User', ' user@silog.test ', 'secret123');

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'user@silog.test', 'secret123');
    expect(updateProfile).toHaveBeenCalledWith(authUser, { displayName: 'Nama User' });
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'uid-1');
    expect(setDoc).toHaveBeenCalledWith(
      { collection: 'users', id: 'uid-1' },
      expect.objectContaining({
        uid: 'uid-1',
        name: 'Nama User',
        displayName: 'Nama User',
        email: 'user@silog.test',
        role: 'Viewer',
        isActive: true,
      })
    );
    expect(profile.createdAt).toBeInstanceOf(Date);
  });

  it('signs out and reports a clear error when profile creation fails', async () => {
    vi.mocked(setDoc).mockRejectedValue(new Error('permission-denied'));

    await expect(registerUser('Nama User', 'user@silog.test', 'secret123'))
      .rejects.toThrow('Profil pengguna belum dapat dibuat');
    expect(signOut).toHaveBeenCalled();
  });

  it('logs in with an existing profile without rewriting it', async () => {
    const existing = {
      uid: 'uid-1',
      name: 'Existing User',
      displayName: 'Existing User',
      email: 'user@silog.test',
      role: 'Kepala Gudang',
      isActive: true,
      createdAt: new Date('2026-01-01'),
    };
    vi.mocked(getDoc).mockResolvedValue(existingSnapshot(existing));

    const profile = await loginUser('user@silog.test', 'secret123');

    expect(profile).toEqual(existing);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('creates a profile for a legacy Auth account that has no profile', async () => {
    const profile = await loginUser('user@silog.test', 'secret123');

    expect(setDoc).toHaveBeenCalledWith(
      { collection: 'users', id: 'uid-1' },
      expect.objectContaining({ uid: 'uid-1', role: 'Viewer', isActive: true })
    );
    expect(profile.name).toBe('User SILOG');
  });

  it('recovers when another session creates the profile during fetch', async () => {
    const concurrent = {
      uid: 'uid-1',
      name: 'Concurrent User',
      displayName: 'Concurrent User',
      email: 'user@silog.test',
      role: 'Viewer',
      isActive: true,
      createdAt: new Date('2026-01-01'),
    };
    vi.mocked(setDoc).mockRejectedValue(new Error('permission-denied'));
    vi.mocked(getDoc)
      .mockResolvedValueOnce(missingSnapshot)
      .mockResolvedValueOnce(existingSnapshot(concurrent));

    await expect(fetchUserProfile(authUser)).resolves.toEqual(concurrent);
  });

  it('logs out from Firebase Auth', async () => {
    await logoutUser();
    expect(signOut).toHaveBeenCalled();
  });

  it('shows a clear Indonesian error for wrong email or password', async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce({
      code: 'auth/invalid-credential',
      message: 'Firebase: Error (auth/invalid-credential).',
    });

    await expect(loginUser('user@silog.test', 'salah'))
      .rejects.toThrow('Email atau kata sandi salah.');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('shows a clear Indonesian error when registering an existing email', async () => {
    vi.mocked(createUserWithEmailAndPassword).mockRejectedValueOnce({
      code: 'auth/email-already-in-use',
      message: 'Firebase: Error (auth/email-already-in-use).',
    });

    await expect(registerUser('Nama User', 'user@silog.test', 'secret123'))
      .rejects.toThrow('Email sudah terdaftar');
  });
});
