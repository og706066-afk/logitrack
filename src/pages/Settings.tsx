import React from 'react';
import { Settings as SettingsIcon, Shield, Database, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AlertBox, PageHeader } from '../components/ui';
import { isFirebaseConfigured } from '../services/firebase';
import { clearAllData } from '../services/logisticsService';
import { MASTER_PERMISSIONS } from '../services/rbacService';

export const SettingsPage: React.FC = () => {
  const { currentUser, isDemoMode, hasPermission } = useAuth();

  if (!hasPermission('users.view')) {
    return <AlertBox message="Anda tidak memiliki izin untuk mengakses pengaturan sistem." />;
  }

  const permissions = currentUser?.role === 'Super Admin'
    ? MASTER_PERMISSIONS.map(item => item.id)
    : currentUser?.permissions || [];

  const resetDemoData = () => {
    if (!window.confirm('Reset seluruh data demo (produk, transaksi, role, pengguna, dan audit log)? Data akan kembali ke kondisi awal.')) return;
    clearAllData();
    ['silog_roles_data', 'silog_users_data', 'silog_audit_logs', 'silog_demo_user'].forEach(key => localStorage.removeItem(key));
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Pengaturan Sistem" description="Informasi lingkungan aplikasi, hak akses akun, dan pengelolaan data demo." icon={SettingsIcon} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <h3 className="font-bold text-slate-800 flex items-center text-sm mb-4"><Database className="w-4 h-4 mr-2 text-emerald-600" /> Status Lingkungan</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Mode Aplikasi</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${isDemoMode ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {isDemoMode ? 'Demo / Offline' : 'Firebase Terhubung'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Konfigurasi Firebase</span>
              <span className="font-semibold text-slate-800">{isFirebaseConfigured ? 'Aktif' : 'Belum diatur'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Versi Aplikasi</span>
              <span className="font-semibold text-slate-800">SILOG v1.0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Penyimpanan Lokal</span>
              <span className="font-semibold text-slate-800 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" /> Aktif</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <h3 className="font-bold text-slate-800 flex items-center text-sm mb-4"><Shield className="w-4 h-4 mr-2 text-emerald-600" /> Akun & Hak Akses</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Nama</span>
              <span className="font-semibold text-slate-800">{currentUser?.displayName || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email</span>
              <span className="font-semibold text-slate-800">{currentUser?.email || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Role</span>
              <span className="font-semibold text-emerald-700">{currentUser?.role || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Jumlah Permission</span>
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

      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <h3 className="font-bold text-slate-800 text-sm mb-2">Reset Data Demo</h3>
        <p className="text-xs text-slate-500 mb-4">
          Mengembalikan seluruh data contoh (bahan makanan, supplier, stok, permintaan, pengiriman, role, pengguna, dan audit log) ke kondisi awal.
        </p>
        <button onClick={resetDemoData} className="inline-flex items-center px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm">
          <RotateCcw className="w-4 h-4 mr-2" /> Reset Data Demo
        </button>
      </div>
    </div>
  );
};
