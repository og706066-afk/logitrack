import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../services/firebase';
import type { UserProfile, Role } from '../types';
import { getRoles } from '../services/rbacService';
import { fetchUserProfile, loginUser, logoutUser, registerUser } from '../services/authService';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  rolesList: Role[];
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
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
    try {
      const roles = await getRoles();
      setRolesList(roles);
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const refreshUserData = async () => {
    await loadRoles();
    if (!firebaseUser) return;
    const updated = await fetchUserProfile(firebaseUser);
    if (!updated.isActive) {
      await logout();
      throw new Error('Akun Anda telah dinonaktifkan oleh Super Admin.');
    }
    setCurrentUser(updated);
  };

  useEffect(() => {
    void loadRoles();
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const profile = await fetchUserProfile(fbUser);
          if (!profile.isActive) {
            await logoutUser();
            setCurrentUser(null);
            setLoading(false);
            return;
          }
          setCurrentUser(profile);
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    const profile = await loginUser(email, pass);
    if (!profile.isActive) {
      await logoutUser();
      throw new Error('Akun Anda dinonaktifkan.');
    }
    setCurrentUser(profile);
  };

  const register = async (name: string, email: string, pass: string) => {
    const profile = await registerUser(name, email, pass);
    if (!profile.isActive) {
      await logoutUser();
      throw new Error('Akun Anda dinonaktifkan.');
    }
    setCurrentUser(profile);
  };

  const logout = async () => {
    setCurrentUser(null);
    setFirebaseUser(null);
    await logoutUser();
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
      register,
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
