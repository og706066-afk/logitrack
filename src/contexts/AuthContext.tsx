import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut as fbSignOut, 
  onAuthStateChanged
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, isFirebaseConfigured, db } from '../services/firebase';
import type { UserProfile, UserRole, Role } from '../types';
import { getRoles, getUsers } from '../services/rbacService';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isDemoMode: boolean;
  rolesList: Role[];
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  loginAsDemo: (role: UserRole) => void;
  hasPermission: (permission: string) => boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('silog_demo_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (_err) { return null; }
    }
    return null;
  });
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const isDemoMode = !isFirebaseConfigured || Boolean(localStorage.getItem('silog_demo_user'));

  const loadRoles = async () => {
    const roles = await getRoles();
    setRolesList(roles);
  };

  const refreshUserData = async () => {
    await loadRoles();
    if (currentUser) {
      const users = await getUsers();
      const updated = users.find(u => u.uid === currentUser.uid);
      if (updated) {
        if (!updated.isActive) {
          await logout();
          throw new Error('Akun Anda telah dinonaktifkan oleh Super Admin.');
        }
        setCurrentUser(updated);
        localStorage.setItem('silog_demo_user', JSON.stringify(updated));
      }
    }
  };

  useEffect(() => {
    loadRoles();
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        if (!localStorage.getItem('silog_demo_user')) {
          try {
            if (db) {
              const userDocRef = doc(db, 'users', fbUser.uid);
              const userSnap = await getDoc(userDocRef);
              if (userSnap.exists()) {
                const profile = userSnap.data() as UserProfile;
                if (!profile.isActive) {
                  if (auth) await fbSignOut(auth);
                  setCurrentUser(null);
                  setLoading(false);
                  throw new Error('Akun Anda nonaktif.');
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
            }
          } catch (error) {
            console.error('Error fetching user profile:', error);
          }
        }
      } else {
        if (!localStorage.getItem('silog_demo_user')) {
          setCurrentUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    if (!isFirebaseConfigured || !auth) {
      const users = await getUsers();
      const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
      if (foundUser) {
        if (!foundUser.isActive) {
          throw new Error('Akun ini telah dinonaktifkan. Hubungi Super Admin.');
        }
        setCurrentUser(foundUser);
        localStorage.setItem('silog_demo_user', JSON.stringify(foundUser));
        return;
      }
      throw new Error('Email atau password tidak ditemukan. Gunakan akun demo di bawah.');
    }

    const cred = await signInWithEmailAndPassword(auth, email, pass);
    if (db) {
      const userSnap = await getDoc(doc(db, 'users', cred.user.uid));
      if (userSnap.exists()) {
        const profile = userSnap.data() as UserProfile;
        if (!profile.isActive) {
          await fbSignOut(auth);
          throw new Error('Akun Anda dinonaktifkan.');
        }
        setCurrentUser(profile);
      }
    }
  };

  const loginAsDemo = async (roleName: UserRole) => {
    const users = await getUsers();
    let user = users.find(u => u.role === roleName && u.isActive);
    if (!user) {
      user = users[0]; // fallback
    }
    if (!user.isActive) {
      throw new Error('Role/Akun demo ini sedang dinonaktifkan.');
    }
    setCurrentUser(user);
    localStorage.setItem('silog_demo_user', JSON.stringify(user));
  };

  const logout = async () => {
    localStorage.removeItem('silog_demo_user');
    setCurrentUser(null);
    if (auth && isFirebaseConfigured) {
      await fbSignOut(auth as any);
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
      isDemoMode, 
      rolesList,
      login, 
      logout, 
      loginAsDemo, 
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
