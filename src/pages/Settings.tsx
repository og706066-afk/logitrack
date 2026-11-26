import React from 'react';
import { Settings as SettingsIcon, Shield, Database, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AlertBox, PageHeader } from '../components/ui';
import { isFirebaseConfigured } from '../services/firebase';
import { MASTER_PERMISSIONS } from '../services/rbacService';

export const SettingsPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();

  if (!hasPermission('users.view')) {
    return <AlertBox message="Anda tidak memiliki izin untuk mengakses pengaturan sistem." />;
  }

  const permissions = currentUser?.role === 'Super Admin'
    ? MASTER_PERMISSIONS.map(item => item.id)
    : currentUser?.permissions || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Pengaturan Sistem" description="Informasi lingkungan aplikasi dan hak akses akun." icon={SettingsIcon} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
          <h3 className="font-bold text-slate-800 flex items-center text-sm mb-4"><Database className="w-4 h-4 mr-2 text-ocean" /> Status Lingkungan</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center gap-3">
              <span className="text-slate-500">Status Koneksi</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold text-center ${isFirebaseConfigured ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {isFirebaseConfigured ? 'Firebase Terhubung' : 'Firebase Belum Dikonfigurasi'}
              </span>
            </div>
            <div className="flex justify-between items-center gap-3">
              <span className="text-slate-500">Konfigurasi Firebase</span>
              <span className="font-semibold text-slate-800">{isFirebaseConfigured ? 'Aktif' : 'Belum diatur'}</span>
            </div>
            <div className="flex justify-between items-center gap-3">
              <span className="text-slate-500">Versi Aplikasi</span>
              <span className="font-semibold text-slate-800">SILOG v1.0</span>
            </div>
            <div className="flex justify-between items-center gap-3">
              <span className="text-slate-500">Penyimpanan Lokal</span>
              <span className="font-semibold text-slate-800 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1 text-ocean" /> Aktif</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
          <h3 className="font-bold text-slate-800 flex items-center text-sm mb-4"><Shield className="w-4 h-4 mr-2 text-ocean" /> Akun & Hak Akses</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 shrink-0">Nama</span>
              <span className="font-semibold text-slate-800 text-right break-words">{currentUser?.displayName || '-'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 shrink-0">Email</span>
              <span className="font-semibold text-slate-800 text-right break-all">{currentUser?.email || '-'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 shrink-0">Role</span>
              <span className="font-semibold text-ocean text-right">{currentUser?.role || '-'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 shrink-0">Jumlah Permission</span>
              <span className="font-semibold text-slate-800">{permissions.length}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {permissions.map(permission => (
              <span key={permission} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium">{permission}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
