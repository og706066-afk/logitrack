import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CarLoader } from './ui';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredPermission }) => {
  const { currentUser, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-ocean-dark">
        <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
          <CarLoader />
          <p className="font-medium text-slate-600">Memuat Sistem SILOG...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            !
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Akses Ditolak</h2>
          <p className="text-slate-600 text-sm mb-6">
            Anda tidak memiliki izin (<code className="bg-slate-100 px-2 py-0.5 rounded text-xs">{requiredPermission}</code>) untuk mengakses modul ini dengan role <span className="font-semibold text-ocean">{currentUser.role}</span>.
          </p>
          <a
            href="/"
            className="inline-block bg-ocean text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-ocean-dark transition shadow-sm"
          >
            Kembali ke Beranda
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
