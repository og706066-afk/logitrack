import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, isFirebaseConfigured, db } from '../services/firebase';
import type { UserProfile, Role } from '../types';
import { getRoles, getUsers } from '../services/rbacService';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  rolesList: Role[];
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadRoles = async () => {
    const roles = await getRoles();
    setRolesList(roles);
  };

  const refreshUserData = async () => {
    await loadRoles();
    if (!currentUser) return;
    const users = await getUsers();
    const updated = users.find(u => u.uid === currentUser.uid);
    if (updated) {
      if (!updated.isActive) {
        await logout();
        throw new Error('Akun Anda telah dinonaktifkan oleh Super Admin.');
      }
      setCurrentUser(updated);
    }
  };

  useEffect(() => {
    void loadRoles();
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const firebaseAuth = auth;
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser && db) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const profile = userSnap.data() as UserProfile;
            if (!profile.isActive) {
              await fbSignOut(firebaseAuth);
              setCurrentUser(null);
              setLoading(false);
              return;
            }
            setCurrentUser(profile);
          } else {
            const defaultProfile: UserProfile = {
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName || 'User SILOG',
              role: 'Viewer',
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            await setDoc(userDocRef, defaultProfile);
            setCurrentUser(defaultProfile);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else if (!fbUser) {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase belum dikonfigurasi. Hubungi administrator sistem.');
    }

    const cred = await signInWithEmailAndPassword(auth, email, pass);
    if (db) {
      const userDocRef = doc(db, 'users', cred.user.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const profile = userSnap.data() as UserProfile;
        if (!profile.isActive) {
          await fbSignOut(auth);
          throw new Error('Akun Anda dinonaktifkan.');
        }
        setCurrentUser(profile);
      } else {
        const defaultProfile: UserProfile = {
          uid: cred.user.uid,
          email: cred.user.email || '',
          displayName: cred.user.displayName || 'User SILOG',
          role: 'Viewer',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await setDoc(userDocRef, defaultProfile);
        setCurrentUser(defaultProfile);
      }
    }
  };

  const logout = async () => {
    setCurrentUser(null);
    setFirebaseUser(null);
    if (auth && isFirebaseConfigured) {
      await fbSignOut(auth);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!currentUser) return false;
    if (!currentUser.isActive) return false;
    if (currentUser.role === 'Super Admin') return true;
    if (Array.isArray(currentUser.permissions) && currentUser.permissions.length > 0) {
      return currentUser.permissions.includes(permission) || currentUser.permissions.includes('*');
    }

    const roleDef = rolesList.find(r => r.name === currentUser.role);
    if (!roleDef || !roleDef.isActive) return false;
    return roleDef.permissions.includes(permission) || roleDef.permissions.includes('*');
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      firebaseUser,
      loading,
      rolesList,
      login,
      logout,
      hasPermission,
      refreshUserData
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
