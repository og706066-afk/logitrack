import React from 'react';
import { Settings as SettingsIcon, Shield, Database, CheckCircle2, Info, Code2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AlertBox, PageHeader } from '../components/ui';
import { isFirebaseConfigured } from '../services/firebase';
import { MASTER_PERMISSIONS } from '../services/rbacService';

export const SettingsPage: React.FC = () => {
  const { currentUser, hasPermission, rolesList } = useAuth();

  if (!hasPermission('users.view')) {
    return <AlertBox message="Anda tidak memiliki izin untuk mengakses pengaturan sistem." />;
  }

  const permissions = currentUser?.role === 'Super Admin'
    ? MASTER_PERMISSIONS.map(item => item.id)
    : currentUser?.permissions || [];
  const role = rolesList.find(item => item.name === currentUser?.role);
  const roleDescription = currentUser?.role === 'Super Admin'
    ? 'Akses penuh terhadap seluruh modul, data, dan pengaturan sistem.'
    : role?.description || 'Hak akses mengikuti pengaturan permission pada akun Anda.';
  const permissionDetails = permissions
    .map(id => MASTER_PERMISSIONS.find(item => item.id === id))
    .filter((item): item is (typeof MASTER_PERMISSIONS)[number] => Boolean(item));
  const permissionGroups = [...new Set(permissionDetails.map(item => item.module))].map(module => ({
    module,
    items: permissionDetails.filter(item => item.module === module),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Pengaturan Sistem" description="Informasi aplikasi, lingkungan sistem, dan hak akses akun." icon={SettingsIcon} />

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
              <span className="text-slate-500 shrink-0">Deskripsi Hak Akses</span>
              <span className="font-medium text-slate-700 text-right max-w-[65%] break-words">{roleDescription}</span>
            </div>
          </div>
          <div className="mt-4 space-y-3 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
            {permissionGroups.map(group => (
              <div key={group.module}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ocean mb-1.5">{group.module}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map(item => (
                    <span key={item.id} title={item.description} className="px-2 py-1 bg-ocean-light text-ocean-dark rounded-lg text-[11px] font-medium">{item.name}</span>
                  ))}
                </div>
              </div>
            ))}
            {permissionGroups.length === 0 && (
              <p className="text-xs text-slate-500">Belum ada permission khusus yang ditetapkan untuk akun ini.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
          <h3 className="font-bold text-slate-800 flex items-center text-sm mb-4"><Info className="w-4 h-4 mr-2 text-ocean" /> Tentang Aplikasi</h3>
          <p className="text-sm leading-relaxed text-slate-600">
            SILOG Pesantren adalah Sistem Informasi Logistik yang membantu pesantren mencatat pemasukan barang,
            mengelola persediaan gudang, dan memantau proses distribusi dalam satu sistem terpadu.
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Nama Aplikasi</span>
              <span className="font-semibold text-slate-800 text-right">SILOG Pesantren</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Versi</span>
              <span className="font-semibold text-slate-800">v1.0</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Fokus</span>
              <span className="font-semibold text-slate-800 text-right">Logistik & Distribusi Pesantren</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
          <h3 className="font-bold text-slate-800 flex items-center text-sm mb-4"><Code2 className="w-4 h-4 mr-2 text-ocean" /> Developer</h3>
          <p className="text-sm leading-relaxed text-slate-600">
            Aplikasi ini dikembangkan untuk mendukung kebutuhan operasional dan pelaporan logistik pesantren.
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Pengembang</span>
              <span className="font-semibold text-slate-800 text-right">Tim Pengembang SILOG</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Platform</span>
              <span className="font-semibold text-slate-800 text-right">Web Application</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Dukungan</span>
              <span className="font-semibold text-slate-800 text-right">Administrator Sistem</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
