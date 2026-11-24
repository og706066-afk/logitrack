import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Package, 
  Warehouse, 
  ClipboardList, 
  Send, 
  ShieldCheck, 
  CheckCircle2,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();

  const stats = [
    { title: 'Total Bahan Makanan', value: '48 Jenis', icon: Package, color: 'bg-blue-500', change: '+3 bulan ini' },
    { title: 'Total Stok Gudang', value: '12.450 Kg/Unit', icon: Warehouse, color: 'bg-emerald-600', change: 'Aman' },
    { title: 'Barang Hampir Habis', value: '3 Item', icon: AlertTriangle, color: 'bg-amber-500', change: 'Perlu restock' },
    { title: 'Permintaan Menunggu', value: '5 Pengajuan', icon: ClipboardList, color: 'bg-purple-600', change: 'Menunggu Manager' },
    { title: 'Pengiriman Berlangsung', value: '2 Pengiriman', icon: Send, color: 'bg-indigo-600', change: 'Menuju Dapur' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-800 text-emerald-200 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            Sistem Operasional Aktif
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Selamat Datang, {currentUser?.displayName}!</h1>
          <p className="text-emerald-200 text-sm mt-1">
            Anda masuk sebagai <strong className="text-white">{currentUser?.role}</strong> di Sistem Informasi Logistik Pesantren (SILOG).
          </p>
        </div>
        <div className="mt-4 md:mt-0 bg-emerald-800/80 backdrop-blur-xs px-4 py-3 rounded-xl border border-emerald-700">
          <p className="text-xs text-emerald-300 font-medium">Status Gudang Utama</p>
          <p className="text-sm font-bold text-white flex items-center mt-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
            Optimal & Terhubung
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${stat.color} text-white flex items-center justify-center shadow-sm`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {stat.change}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.title}</p>
                <p className="text-xl font-bold text-slate-800 mt-1">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Phase 1 Summary & Quick Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-emerald-600" />
            Aktivitas Logistik Terbaru (Phase 1 Foundation)
          </h3>
          <div className="space-y-4">
            {[
              { title: 'Inisialisasi Sistem SILOG & RBAC', time: 'Hari ini, 08:00', status: 'Selesai', type: 'system' },
              { title: 'Barang Masuk: Beras Ramos 50 Sak (Supplier Toko Beras Berkah)', time: 'Kemarin, 14:30', status: 'Masuk Gudang', type: 'stock_in' },
              { title: 'Permintaan Dapur Pesantren Putra #REQ-042', time: 'Kemarin, 10:15', status: 'Disetujui Manager', type: 'request' },
              { title: 'Pengiriman Minyak Goreng 20 Liter ke Dapur Utama', time: '2 hari lalu', status: 'Selesai / Dikonfirmasi', type: 'delivery' },
            ].map((activity, i) => (
              <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{activity.title}</p>
                    <p className="text-xs text-slate-500">{activity.time}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  {activity.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Phase Progress Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center">
              <ShieldCheck className="w-5 h-5 mr-2 text-emerald-600" />
              Status Pengerjaan SILOG
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Pembangunan aplikasi Sistem Informasi Logistik Pesantren secara bertahap.
            </p>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-emerald-700">Phase 1: Foundation & Auth</span>
                  <span className="text-emerald-700">100%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-full w-full rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-600">Phase 2: Authorization & RBAC</span>
                  <span className="text-slate-400">Pending</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-slate-300 h-full w-0 rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-600">Phase 3-7: Inventory & Distribution</span>
                  <span className="text-slate-400">Pending</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-slate-300 h-full w-0 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">SILOG Pesantren v1.0 • React & Firebase</p>
          </div>
        </div>
      </div>
    </div>
  );
};
