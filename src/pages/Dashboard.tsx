import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Package,
  Send,
  Tags,
  TrendingUp,
  Truck,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { AlertBox, InfoCard, LoadingOverlay } from '../components/ui';
import { inputClass } from '../components/DataViews';
import {
  dateString,
  displayDate,
  getCollection,
  getShipments,
  getStockAlerts,
  shortageAmount,
  toNumber,
  todayString,
} from '../services/logitrackService';
import type {
  ActivityLog,
  Item,
  MasterData,
  NeedRequest,
  Shipment,
  StockTransaction,
} from '../types/logitrack';

type PeriodKey = '7' | '30' | '90' | 'all';

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: '7', label: '7 hari terakhir' },
  { value: '30', label: '30 hari terakhir' },
  { value: '90', label: '90 hari terakhir' },
  { value: 'all', label: 'Semua waktu' },
];

const CHART_COLORS = ['#087FA5', '#00C5E8', '#172B3D', '#0ea5e9', '#f59e0b', '#8b5cf6'];
const SHIPMENT_STATUSES: Shipment['status'][] = [
  'Belum dikirim',
  'Siap dikirim',
  'Dalam perjalanan',
  'Diterima sebagian',
  'Selesai',
  'Bermasalah',
];

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<Item[]>([]);
  const [categories, setCategories] = useState<MasterData[]>([]);
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);
  const [needs, setNeeds] = useState<NeedRequest[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [period, setPeriod] = useState<PeriodKey>('30');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const todayTime = useMemo(() => Date.parse(todayString()), []);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      getCollection<Item>('products'),
      getCollection<MasterData>('categories'),
      getCollection<StockTransaction>('stockTransactions'),
      getCollection<NeedRequest>('needsRequests'),
      getShipments(currentUser),
      getCollection<ActivityLog>('activityLogs'),
    ]).then(results => {
      if (!active) return;
      const value = <T,>(index: number): T[] => results[index].status === 'fulfilled' ? (results[index] as PromiseFulfilledResult<T[]>).value : [];
      setProducts(value<Item>(0));
      setCategories(value<MasterData>(1));
      setStockTransactions(value<StockTransaction>(2));
      setNeeds(value<NeedRequest>(3));
      setShipments(value<Shipment>(4));
      setActivities(value<ActivityLog>(5));
      if (results.some(result => result.status === 'rejected')) {
        setError('Sebagian data tidak dapat dimuat sesuai hak akses Anda.');
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [currentUser]);

  const categoryById = useMemo(
    () => new Map(categories.map(item => [item.id, item.name])),
    [categories],
  );

  const categoryOptions = useMemo(() => {
    const names = [
      ...categories.map(item => item.name),
      ...products.map(item => item.categoryName),
    ].filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [categories, products]);

  const productsById = useMemo(
    () => new Map(products.map(item => [item.id, item])),
    [products],
  );

  const productsByName = useMemo(
    () => new Map(products.map(item => [String(item.name || ''), item])),
    [products],
  );

  const inPeriod = useCallback((value: unknown): boolean => {
    if (period === 'all') return true;
    const raw = dateString(value);
    if (!raw) return false;
    const time = Date.parse(raw);
    if (Number.isNaN(time)) return false;
    const difference = todayTime - time;
    return difference >= 0 && difference <= Number(period) * 86400000;
  }, [period, todayTime]);

  const matchesCategory = useCallback((name: string, id?: string): boolean => {
    if (!category) return true;
    if (name === category) return true;
    return Boolean(id && categoryById.get(id) === category);
  }, [category, categoryById]);

  const productCategory = useCallback((id: string, name: string): string => {
    const item = productsById.get(id) || productsByName.get(name);
    return item?.categoryName || categoryById.get(item?.categoryId || '') || '';
  }, [productsById, productsByName, categoryById]);

  const filteredProducts = useMemo(
    () => products.filter(item => matchesCategory(item.categoryName || categoryById.get(item.categoryId) || '', item.categoryId)),
    [products, matchesCategory, categoryById],
  );

  const filteredStocks = useMemo(
    () => stockTransactions.filter(item =>
      item.status === 'Confirmed'
      && inPeriod(item.date)
      && matchesCategory(item.categoryName || categoryById.get(item.categoryId) || '', item.categoryId)),
    [stockTransactions, inPeriod, matchesCategory, categoryById],
  );

  const filteredNeeds = useMemo(
    () => needs.filter(item =>
      inPeriod(item.date)
      && matchesCategory(item.categoryName || categoryById.get(item.categoryId) || '', item.categoryId)),
    [needs, inPeriod, matchesCategory, categoryById],
  );

  const filteredShipments = useMemo(
    () => shipments.filter(item =>
      inPeriod(item.shipmentDate)
      && matchesCategory(productCategory('', item.itemName))),
    [shipments, inPeriod, matchesCategory, productCategory],
  );

  const filteredActivities = useMemo(
    () => activities.filter(item => inPeriod(item.createdAt)),
    [activities, inPeriod],
  );

  const stockAlerts = useMemo(() => getStockAlerts(filteredProducts), [filteredProducts]);

  const totalStock = filteredProducts.reduce((sum, item) => sum + toNumber(item.currentStock), 0);
  const totalStockIn = filteredStocks
    .filter(item => item.type === 'IN')
    .reduce((sum, item) => sum + toNumber(item.quantity), 0);
  const totalStockOut = filteredStocks
    .filter(item => item.type === 'OUT')
    .reduce((sum, item) => sum + toNumber(item.quantity), 0);
  const totalNeeds = filteredNeeds.reduce((sum, item) => sum + toNumber(item.quantity), 0);
  const totalShortage = filteredNeeds.reduce((sum, item) => {
    const stock = productsById.get(item.itemId) || productsByName.get(item.itemName);
    return sum + shortageAmount(item, toNumber(stock?.currentStock));
  }, 0);
  const pendingNeeds = filteredNeeds.filter(item => item.status === 'Pending').length;
  const notShipped = filteredShipments.filter(item =>
    item.status === 'Belum dikirim' || item.status === 'Siap dikirim').length;
  const inTransit = filteredShipments.filter(item => item.status === 'Dalam perjalanan').length;
  const completedShipments = filteredShipments.filter(item => item.status === 'Selesai').length;

  const monthlyData = useMemo(() => {
    const grouped = new Map<string, { name: string; masuk: number; keluar: number }>();
    filteredStocks.forEach(item => {
      const month = dateString(item.date).slice(0, 7) || '-';
      const entry = grouped.get(month) || { name: month, masuk: 0, keluar: 0 };
      if (item.type === 'IN') entry.masuk += toNumber(item.quantity);
      if (item.type === 'OUT') entry.keluar += toNumber(item.quantity);
      grouped.set(month, entry);
    });
    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredStocks]);

  const categoryStockData = useMemo(() => {
    const grouped = new Map<string, number>();
    filteredProducts.forEach(item => {
      const name = item.categoryName || categoryById.get(item.categoryId) || 'Tanpa kategori';
      grouped.set(name, (grouped.get(name) || 0) + toNumber(item.currentStock));
    });
    return Array.from(grouped.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredProducts, categoryById]);

  const shipmentStatusData = useMemo(
    () => SHIPMENT_STATUSES
      .map(name => ({ name, value: filteredShipments.filter(item => item.status === name).length }))
      .filter(item => item.value > 0),
    [filteredShipments],
  );

  const cards: { title: string; value: string; detail: string; icon: LucideIcon; color: string }[] = [
    { title: 'Total barang', value: `${filteredProducts.length} jenis`, detail: 'Master barang', icon: Package, color: 'bg-ocean' },
    { title: 'Total kategori', value: `${categoryOptions.length} kategori`, detail: 'Terdaftar', icon: Tags, color: 'bg-teal-600' },
    { title: 'Total stok tersedia', value: `${totalStock.toLocaleString('id-ID')} unit`, detail: 'Stok saat ini', icon: Warehouse, color: 'bg-sky-600' },
    { title: 'Total barang masuk', value: `${totalStockIn.toLocaleString('id-ID')} unit`, detail: 'Transaksi confirmed', icon: ArrowDown, color: 'bg-green-600' },
    { title: 'Total barang keluar', value: `${totalStockOut.toLocaleString('id-ID')} unit`, detail: 'Transaksi confirmed', icon: ArrowUp, color: 'bg-orange-500' },
    { title: 'Total kebutuhan barang', value: `${totalNeeds.toLocaleString('id-ID')} unit`, detail: 'Permintaan tercatat', icon: ClipboardList, color: 'bg-violet-600' },
    { title: 'Total barang kurang', value: `${totalShortage.toLocaleString('id-ID')} unit`, detail: 'Kebutuhan - stok', icon: AlertTriangle, color: 'bg-red-500' },
    { title: 'Total pengiriman', value: `${filteredShipments.length} pengiriman`, detail: 'Seluruh status', icon: Truck, color: 'bg-indigo-600' },
    { title: 'Pengiriman belum dilakukan', value: `${notShipped} pengiriman`, detail: 'Belum / siap dikirim', icon: Clock3, color: 'bg-slate-600' },
    { title: 'Pengiriman dalam perjalanan', value: `${inTransit} pengiriman`, detail: 'Sedang dikirim', icon: Send, color: 'bg-blue-600' },
    { title: 'Pengiriman selesai', value: `${completedShipments} pengiriman`, detail: 'Diterima', icon: CheckCircle2, color: 'bg-ocean' },
    { title: 'Permintaan menunggu persetujuan', value: `${pendingNeeds} permintaan`, detail: 'Status pending', icon: ClipboardList, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-gradient-to-r from-slate-navy to-navy rounded-2xl p-5 sm:p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-ocean/20 text-cyan mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-cyan" />
            Sistem Operasional Aktif
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight break-words">
            Selamat Datang, {currentUser?.displayName || currentUser?.email || 'Pengguna'}!
          </h1>
          <p className="text-sky-100/80 text-sm mt-1">
            Anda masuk sebagai <strong className="text-white">{currentUser?.role || '-'}</strong> di Sistem Informasi Logistik Pesantren (SILOG).
          </p>
        </div>
        <div className="bg-ocean-dark/80 backdrop-blur-xs px-4 py-3 rounded-xl border border-ocean">
          <p className="text-xs text-cyan font-medium">Status Gudang Utama</p>
          <p className="text-sm font-bold text-white flex items-center mt-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan mr-2 animate-pulse" />
            Terpantau & Terhubung
          </p>
        </div>
      </div>

      <AlertBox message={error} onClose={() => setError('')} />

      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1 sm:max-w-xs">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Periode</label>
          <select value={period} onChange={event => setPeriod(event.target.value as PeriodKey)} className={inputClass}>
            {PERIOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="flex-1 sm:max-w-xs">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Kategori</label>
          <select value={category} onChange={event => setCategory(event.target.value)} className={inputClass}>
            <option value="">Semua kategori</option>
            {categoryOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <p className="text-xs text-slate-500 sm:ml-auto">Data Firestore · diperbarui {displayDate(todayString())}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map(card => (
          <InfoCard
            key={card.title}
            title={card.title}
            value={card.value}
            detail={card.detail}
            icon={card.icon}
            color={card.color}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-ocean" />
            Barang Masuk & Keluar per Bulan
          </h3>
          {monthlyData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">Belum ada transaksi stok yang dikonfirmasi.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="masuk" name="Barang masuk" fill="#087FA5" />
                  <Bar dataKey="keluar" name="Barang keluar" fill="#00C5E8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center">
            <Warehouse className="w-5 h-5 mr-2 text-ocean" />
            Stok per Kategori
          </h3>
          {categoryStockData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">Belum ada stok barang pada periode ini.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryStockData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {categoryStockData.map((item, index) => (
                      <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center">
            <Send className="w-5 h-5 mr-2 text-ocean" />
            Distribusi Status Pengiriman
          </h3>
          {shipmentStatusData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">Belum ada pengiriman pada periode ini.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={shipmentStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {shipmentStatusData.map((item, index) => (
                      <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
            Peringatan Stok Minimum
          </h3>
          {stockAlerts.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">Seluruh stok berada di atas batas minimum.</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {stockAlerts.slice(0, 8).map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                    <p className="text-xs text-amber-700">{item.categoryName || 'Tanpa kategori'}</p>
                  </div>
                  <span className="text-xs font-bold text-red-600 whitespace-nowrap">
                    {toNumber(item.currentStock)} / {toNumber(item.minStock)} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-800 flex items-center">
            <Clock3 className="w-5 h-5 mr-2 text-ocean" />
            Aktivitas Terbaru
          </h3>
        </div>
        {filteredActivities.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-10">Belum ada aktivitas tercatat pada periode ini.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredActivities.slice(0, 6).map(log => (
              <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 hover:bg-slate-50/80">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-ocean-light text-ocean flex items-center justify-center text-xs font-bold shrink-0">
                    {String(log.userName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{log.description || log.action}</p>
                    <p className="text-xs text-slate-500">{log.userName || 'Sistem'} · {log.module}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:shrink-0">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-ocean-light text-ocean-dark">{log.action}</span>
                  <span className="text-xs text-slate-500">{displayDate(log.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && <LoadingOverlay label="Memuat dashboard..." />}
    </div>
  );
};
