import React from 'react';
import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';

export const ModulePlaceholder: React.FC = () => {
  const location = useLocation();
  const pathName = location.pathname.replace('/', '').replace('-', ' ').toUpperCase();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-lg w-full text-center">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
          <Construction className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Modul {pathName}</h2>
        <p className="text-slate-600 text-sm mb-6">
          Modul ini dijadwalkan pada tahap pengembangan berikutnya sesuai tahapan pengerjaan SILOG (Phase 2 - Phase 6). Fondasi dasar & autentikasi Phase 1 telah berhasil diimplementasikan.
        </p>
        <a
          href="/"
          className="inline-block bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-emerald-800 transition shadow-sm"
        >
          Kembali ke Dashboard
        </a>
      </div>
    </div>
  );
};
