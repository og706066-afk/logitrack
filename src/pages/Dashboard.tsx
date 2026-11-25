import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Package,
  Warehouse,
  ClipboardList,
  Send,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { InfoCard, LoadingOverlay } from '../components/ui';
import { getAuditLogs } from '../services/rbacService';
import { asNumber, formatDate, getRows, type DataRow } from '../services/logisticsService';

interface Activity {
  title: string;
  time: string;
  status: string;
}

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<DataRow[]>([]);
  const [requests, setRequests] = useState<DataRow[]>([]);
  const [deliveries, setDeliveries] = useState<DataRow[]>([]);
  const [logs, setLogs] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      getRows('products'),
      getRows('requests'),
      getRows('deliveries'),
      getAuditLogs(),
    ]).then(([productRows, requestRows, deliveryRows, logRows]) => {
      setProducts(productRows);
      setRequests(requestRows);
      setDeliveries(deliveryRows);
      setLogs(logRows);
    }).finally(() => setLoading(false));
  }, []);

  const totalStock = products.reduce((sum, product) => sum + asNumber(product.currentStock), 0);
  const lowStock = products.filter(product => asNumber(product.currentStock) <= asNumber(product.minStock));
  const pendingRequests = requests.filter(row => row.status === 'Pending').length;
  const activeDeliveries = deliveries.filter(row => ['Assigned', 'On Delivery'].includes(row.status)).length;

  const activities: Activity[] = logs.slice(0, 4).map(log => ({
    title: log.description || log.action,
    time: formatDate(log.createdAt),
    status: log.action,
  }));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 rounded-2xl p-5 sm:p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-800 text-emerald-200 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            Sistem Operasional Aktif
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight break-words">Selamat Datang, {currentUser?.displayName}!</h1>
          <p className="text-emerald-200 text-sm mt-1">
            Anda masuk sebagai <strong className="text-white">{currentUser?.role}</strong> di Sistem Informasi Logistik Pesantren (SILOG).
          </p>
        </div>
        <div className="mt-4 md:mt-0 bg-emerald-800/80 backdrop-blur-xs px-4 py-3 rounded-xl border border-emerald-700">
          <p className="text-xs text-emerald-300 font-medium">Status Gudang Utama</p>
          <p className="text-sm font-bold text-white flex items-center mt-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
            Terpantau & Terhubung
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <InfoCard title="Total Bahan Makanan" value={`${products.length} Jenis`} icon={Package} color="bg-blue-500" detail="Terdaftar" />
        <InfoCard title="Total Stok Gudang" value={`${totalStock.toLocaleString('id-ID')} Unit`} icon={Warehouse} detail="Akumulasi" />
        <InfoCard title="Barang Hampir Habis" value={`${lowStock.length} Item`} icon={AlertTriangle} color="bg-amber-500" detail="Perlu restock" />
        <InfoCard title="Permintaan Menunggu" value={`${pendingRequests} Pengajuan`} icon={ClipboardList} color="bg-purple-600" detail="Perlu persetujuan" />
        <InfoCard title="Pengiriman Berlangsung" value={`${activeDeliveries} Pengiriman`} icon={Send} color="bg-indigo-600" detail="Menuju dapur" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-emerald-600" />
            Aktivitas Logistik Terbaru
          </h3>
          {activities.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada aktivitas tercatat. Mulai kelola data untuk melihat riwayat di sini.</p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      {index + 1}
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
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center">
              <ShieldCheck className="w-5 h-5 mr-2 text-emerald-600" />
              Status Pengerjaan SILOG
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Seluruh modul logistik dan kontrol akses telah tersedia untuk digunakan.
            </p>
            <div className="space-y-3">
              {[
                { label: 'Phase 1: Foundation & Auth', value: '100%', done: true },
                { label: 'Phase 2: Authorization & RBAC', value: '100%', done: true },
                { label: 'Phase 3-7: Inventory & Distribution', value: '100%', done: true },
              ].map(phase => (
                <div key={phase.label}>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className={phase.done ? 'text-emerald-700' : 'text-slate-600'}>{phase.label}</span>
                    <span className={phase.done ? 'text-emerald-700' : 'text-slate-400'}>{phase.value}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full w-full rounded-full"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">SILOG Pesantren v1.0 • React & Firebase</p>
          </div>
        </div>
      </div>

      {loading && <LoadingOverlay label="Memuat dashboard..." />}
    </div>
  );
};
