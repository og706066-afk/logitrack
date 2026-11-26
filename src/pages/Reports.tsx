import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, FileText, Package, ClipboardList, Send, AlertTriangle } from 'lucide-react';
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
import { AlertBox, InfoCard, LoadingOverlay, PageHeader, StatusBadge } from '../components/ui';
import { DataTable } from '../components/DataViews';
import { getAuditLogs } from '../services/rbacService';
import { asNumber, getRows, today, type DataRow } from '../services/logisticsService';
import { ACTION_DELAY_MS, wait } from '../utils/async';

const CHART_COLORS = ['#047857', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];

function downloadCsv<T extends object>(filename: string, rows: T[], columns: string[]): void {
  const header = columns.join(';');
  const body = rows.map(row => columns.map(column => {
    const value = (row as Record<string, unknown>)[column];
    const text = value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }).join(';')).join('\n');
  const blob = new Blob([`\ufeff${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const ReportsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const [products, setProducts] = useState<DataRow[]>([]);
  const [batches, setBatches] = useState<DataRow[]>([]);
  const [stockIn, setStockIn] = useState<DataRow[]>([]);
  const [stockOut, setStockOut] = useState<DataRow[]>([]);
  const [requests, setRequests] = useState<DataRow[]>([]);
  const [deliveries, setDeliveries] = useState<DataRow[]>([]);
  const [logs, setLogs] = useState<DataRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void Promise.all([
      getRows('products'),
      getRows('stock_batches'),
      getRows('stock_in'),
      getRows('stock_out'),
      getRows('requests'),
      getRows('deliveries'),
      getAuditLogs(),
    ]).then(([productRows, batchRows, inRows, outRows, requestRows, deliveryRows, logRows]) => {
      setProducts(productRows);
      setBatches(batchRows);
      setStockIn(inRows);
      setStockOut(outRows);
      setRequests(requestRows);
      setDeliveries(deliveryRows);
      setLogs(logRows);
    }).catch((e: any) => setError(e.message || 'Gagal memuat laporan'))
      .finally(() => setLoading(false));
  }, []);

  const categoryData = useMemo(() => {
    const totals = new Map<string, number>();
    batches.forEach(batch => {
      totals.set(batch.productName || 'Lainnya', (totals.get(batch.productName || 'Lainnya') || 0) + asNumber(batch.quantity));
    });
    if (totals.size === 0) {
      products.forEach(product => totals.set(product.name, asNumber(product.currentStock)));
    }
    return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
  }, [batches, products]);

  const transactionData = useMemo(() => {
    const map = new Map<string, { name: string; masuk: number; keluar: number }>();
    stockIn.forEach(row => {
      const month = String(row.date || '').slice(0, 7) || '-';
      const entry = map.get(month) || { name: month, masuk: 0, keluar: 0 };
      entry.masuk += asNumber(row.quantity);
      map.set(month, entry);
    });
    stockOut.forEach(row => {
      const month = String(row.date || '').slice(0, 7) || '-';
      const entry = map.get(month) || { name: month, masuk: 0, keluar: 0 };
      entry.keluar += asNumber(row.quantity);
      map.set(month, entry);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [stockIn, stockOut]);

  const lowStock = products.filter(product => asNumber(product.currentStock) <= asNumber(product.minStock));
  const stockValue = batches.reduce((sum, batch) => sum + asNumber(batch.quantity) * asNumber(batch.purchasePrice), 0);
  const inValue = stockIn.reduce((sum, row) => sum + asNumber(row.totalAmount), 0);
  const outQuantity = stockOut.reduce((sum, row) => sum + asNumber(row.quantity), 0);

  const exportReport = async () => {
    setExporting(true);
    try {
      await wait(ACTION_DELAY_MS);
      downloadCsv(`silog-laporan-stok-${new Date().toISOString().slice(0, 10)}.csv`, products, ['name', 'category', 'unit', 'currentStock', 'minStock']);
    } finally {
      setExporting(false);
    }
  };

  const exportTransactions = async () => {
    setExporting(true);
    try {
      await wait(ACTION_DELAY_MS);
      downloadCsv(`silog-laporan-transaksi-${new Date().toISOString().slice(0, 10)}.csv`, [
        ...stockIn.map(row => ({ tanggal: row.date, nomor: row.invoiceNumber, status: 'MASUK', itemName: row.productName, quantity: row.quantity, supplier: row.supplierName })),
        ...stockOut.map(row => ({ tanggal: row.date, nomor: row.stockOutNumber, status: 'KELUAR', itemName: row.productName, quantity: row.quantity, tujuan: row.destination })),
      ], ['tanggal', 'nomor', 'status', 'itemName', 'quantity', 'supplier', 'tujuan']);
    } finally {
      setExporting(false);
    }
  };

  if (!hasPermission('reports.view')) {
    return <AlertBox message="Anda tidak memiliki izin untuk melihat laporan." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan & Analitik"
        description="Ringkasan stok, pergerakan barang, permintaan dapur, dan aktivitas sistem SILOG."
        icon={BarChart3}
        action={hasPermission('reports.export') ? (
          <div className="flex flex-wrap gap-2">
            <button onClick={exportReport} className="inline-flex items-center px-4 py-2.5 bg-ocean hover:bg-ocean-dark text-white font-semibold rounded-xl text-sm shadow-sm">
              <Download className="w-4 h-4 mr-2" /> Ekspor Stok
            </button>
            <button onClick={exportTransactions} className="inline-flex items-center px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm">
              <FileText className="w-4 h-4 mr-2" /> Ekspor Transaksi
            </button>
          </div>
        ) : undefined}
      />
      <AlertBox message={error} onClose={() => setError('')} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard title="Nilai Stok Gudang" value={`Rp ${stockValue.toLocaleString('id-ID')}`} detail={`${batches.length} batch`} icon={Package} />
        <InfoCard title="Total Barang Masuk" value={`Rp ${inValue.toLocaleString('id-ID')}`} detail={`${stockIn.length} transaksi`} icon={BarChart3} color="bg-blue-500" />
        <InfoCard title="Total Barang Keluar" value={`${outQuantity} unit`} detail={`${stockOut.length} transaksi`} icon={Send} color="bg-indigo-600" />
        <InfoCard title="Stok Menipis" value={`${lowStock.length} item`} detail="Perlu restock" icon={AlertTriangle} color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <h3 className="font-bold text-slate-800 mb-4 text-sm">Distribusi Stok per Bahan</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {categoryData.map((item, index) => <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <h3 className="font-bold text-slate-800 mb-4 text-sm">Pergerakan Barang per Bulan</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={transactionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="masuk" name="Barang Masuk" fill="#047857" />
                <Bar dataKey="keluar" name="Barang Keluar" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center text-sm"><ClipboardList className="w-4 h-4 mr-2 text-ocean" /> Ringkasan Permintaan Dapur</h3>
          </div>
          <div className="p-5 space-y-3">
            {['Pending', 'Approved', 'Processing', 'Completed', 'Rejected'].map(status => (
              <div key={status} className="flex items-center justify-between">
                <StatusBadge value={status} />
                <span className="font-bold text-slate-800">{requests.filter(row => row.status === status).length}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center text-sm"><Send className="w-4 h-4 mr-2 text-ocean" /> Ringkasan Pengiriman</h3>
          </div>
          <div className="p-5 space-y-3">
            {['Assigned', 'On Delivery', 'Delivered', 'Confirmed'].map(status => (
              <div key={status} className="flex items-center justify-between">
                <StatusBadge value={status} />
                <span className="font-bold text-slate-800">{deliveries.filter(row => row.status === status).length}</span>
              </div>
            ))}
            <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
              {logs.length} aktivitas tersimpan di audit log
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 text-sm">Bahan Makanan dengan Stok Terendah</h3>
        </div>
        <DataTable<DataRow>
          columns={[
            {
              key: 'name',
              label: 'Bahan Makanan',
              render: row => <span className="font-medium text-slate-800">{row.name || '-'}</span>,
            },
            {
              key: 'category',
              label: 'Kategori',
              render: row => <span>{row.category || '-'}</span>,
            },
            {
              key: 'currentStock',
              label: 'Stok Saat Ini',
              render: row => <span className="font-semibold">{asNumber(row.currentStock)} {row.unit || ''}</span>,
            },
            {
              key: 'minStock',
              label: 'Minimum',
              render: row => <span>{asNumber(row.minStock)} {row.unit || ''}</span>,
            },
            {
              key: 'status',
              label: 'Status',
              render: row => <StatusBadge value={row.status} />,
            },
          ]}
          rows={[...products]
            .sort((a, b) => asNumber(a.currentStock) - asNumber(b.currentStock))
            .slice(0, 8)
            .map(product => ({
              ...product,
              status: asNumber(product.currentStock) <= asNumber(product.minStock) ? 'Menipis' : 'Aman',
            }))}
          rowKey={row => String(row.id)}
          selectable={false}
          emptyLabel="Belum ada data bahan makanan."
        />
      </div>

      <p className="text-xs text-slate-400 text-center">Laporan dihasilkan dari data SILOG per {today()}</p>

      {(loading || exporting) && <LoadingOverlay label={exporting ? 'Menyiapkan laporan...' : 'Memuat laporan...'} />}
    </div>
  );
};
