import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Check, ClipboardList, History, Plus, SlidersHorizontal } from 'lucide-react';
import {
  DataTable,
  FilterBar,
  Modal,
  Toast,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  type TableColumn,
} from '../components/DataViews';
import { AlertBox, ConfirmDialog, InfoCard, LoadingOverlay, PageHeader, StatusBadge } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { getUsers } from '../services/rbacService';
import {
  confirmStockTransaction,
  createStockTransaction,
  dateString,
  displayDate,
  getCollection,
  nextNumber,
  toNumber,
  todayString,
  updateDocument,
  uploadProofFile,
} from '../services/logitrackService';
import type { Item, MasterData, StockTransaction, StockTransactionType } from '../types/logitrack';
import type { UserProfile } from '../types';

type TabKey = StockTransactionType | 'HISTORY';

interface CategoryRow {
  id: string;
  name: string;
}

interface WarehouseRow {
  id: string;
  name: string;
  location?: string;
}

interface StockForm {
  transactionNumber: string;
  date: string;
  type: StockTransactionType;
  itemId: string;
  categoryId: string;
  categoryName: string;
  unit: string;
  quantity: string;
  actualStock: string;
  source: string;
  kordaId: string;
  senderName: string;
  receiverName: string;
  condition: string;
  warehouseId: string;
  storageLocation: string;
  proofFile: File | null;
  notes: string;
}

const PAGE_SIZE = 10;
const labelClass = 'block text-xs font-semibold text-slate-700 uppercase mb-2';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'IN', label: 'Barang Masuk' },
  { key: 'OUT', label: 'Barang Keluar' },
  { key: 'ADJUSTMENT', label: 'Penyesuaian' },
  { key: 'OPNAME', label: 'Stock Opname' },
  { key: 'HISTORY', label: 'Riwayat/Kartu Stok' },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Terjadi kesalahan.';
}

function numberPrefix(type: StockTransactionType): string {
  if (type === 'IN') return 'IN';
  if (type === 'OUT') return 'OUT';
  if (type === 'ADJUSTMENT') return 'ADJ';
  return 'OPN';
}

function tabIcon(type: TabKey) {
  if (type === 'IN') return ArrowDownToLine;
  if (type === 'OUT') return ArrowUpFromLine;
  if (type === 'ADJUSTMENT') return SlidersHorizontal;
  if (type === 'OPNAME') return ClipboardList;
  return History;
}

function emptyForm(type: StockTransactionType, transactionNumber: string): StockForm {
  return {
    transactionNumber,
    date: todayString(),
    type,
    itemId: '',
    categoryId: '',
    categoryName: '',
    unit: '',
    quantity: '',
    actualStock: '',
    source: '',
    kordaId: '',
    senderName: '',
    receiverName: '',
    condition: 'Baik',
    warehouseId: '',
    storageLocation: '',
    proofFile: null,
    notes: '',
  };
}

function movementDelta(row: StockTransaction): number {
  if (row.type === 'OUT') return -toNumber(row.quantity);
  if (row.type === 'IN') return toNumber(row.quantity);
  return toNumber(row.newStock) - toNumber(row.previousStock);
}

function validateForm(form: StockForm, products: Item[], transactions: StockTransaction[]): string {
  if (!form.itemId) return 'Pilih barang terlebih dahulu.';
  if (!form.date) return 'Tanggal wajib diisi.';
  const item = products.find(product => product.id === form.itemId);
  if (!item) return 'Barang tidak ditemukan.';
  if (!form.unit.trim()) return 'Satuan wajib diisi.';
  if (item.unit !== form.unit) return `Satuan transaksi (${form.unit}) harus sama dengan satuan barang (${item.unit}).`;
  if (form.type === 'IN' || form.type === 'OUT') {
    const quantity = toNumber(form.quantity);
    if (!form.quantity.trim() || quantity <= 0) return 'Jumlah harus lebih dari nol.';
    if (form.type === 'OUT') {
      const pendingOut = transactions
        .filter(row => row.status === 'Draft' && row.itemId === form.itemId && row.type === 'OUT')
        .reduce((total, row) => total + toNumber(row.quantity), 0);
      const available = toNumber(item.currentStock) - pendingOut;
      if (quantity > available) return `Stok tidak mencukupi. Tersedia ${available} ${item.unit}.`;
    }
  } else {
    const actual = toNumber(form.actualStock);
    if (!form.actualStock.trim() || actual < 0) return 'Stok aktual tidak boleh negatif.';
    if (form.type === 'ADJUSTMENT' && actual === toNumber(item.currentStock)) {
      return 'Stok aktual sama dengan stok saat ini.';
    }
  }
  if (!form.warehouseId) return 'Gudang/lokasi wajib dipilih.';
  if (form.type === 'OUT' && !form.source.trim()) return 'Tujuan barang keluar wajib diisi.';
  return '';
}

export const StockControlPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const [products, setProducts] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [kordas, setKordas] = useState<MasterData[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('IN');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cardItemId, setCardItemId] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<StockForm | null>(null);
  const [confirming, setConfirming] = useState<StockTransaction | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState('');

  const load = async () => {
    try {
      const [productRows, transactionRows, categoryRows, warehouseRows, kordaRows, userRows] = await Promise.all([
        getCollection<Item>('products'),
        getCollection<StockTransaction>('stockTransactions'),
        getCollection<CategoryRow>('categories'),
        getCollection<WarehouseRow>('warehouses'),
        getCollection<MasterData>('kordas'),
        getUsers(),
      ]);
      setProducts(productRows);
      setTransactions(transactionRows.sort((a, b) => String(b.date).localeCompare(String(a.date))));
      setCategories(categoryRows);
      setWarehouses(warehouseRows);
      setKordas(kordaRows.filter(row => row.isActive !== false));
      setUsers(userRows);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, dateFrom, dateTo, categoryFilter, warehouseFilter, statusFilter]);

  const filteredRows = useMemo(() => transactions.filter(row => {
    if (activeTab !== 'HISTORY' && row.type !== activeTab) return false;
    if (dateFrom && dateString(row.date) < dateFrom) return false;
    if (dateTo && dateString(row.date) > dateTo) return false;
    if (categoryFilter && row.categoryId !== categoryFilter) return false;
    if (warehouseFilter && row.warehouseId !== warehouseFilter) return false;
    if (statusFilter && row.status !== statusFilter) return false;
    if (search.trim()) {
      const haystack = [row.transactionNumber, row.itemName, row.source, row.notes, row.status]
        .map(value => String(value ?? '').toLowerCase()).join(' ');
      if (!haystack.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  }), [transactions, activeTab, dateFrom, dateTo, categoryFilter, warehouseFilter, statusFilter, search]);

  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const cardRows = useMemo(() => transactions
    .filter(row => row.status === 'Confirmed' && (!cardItemId || row.itemId === cardItemId))
    .sort((a, b) => String(b.date).localeCompare(String(a.date))), [transactions, cardItemId]);

  const monthKey = todayString().slice(0, 7);
  const monthlyIn = transactions
    .filter(row => row.status === 'Confirmed' && row.type === 'IN' && dateString(row.date).startsWith(monthKey))
    .reduce((total, row) => total + toNumber(row.quantity), 0);
  const monthlyOut = transactions
    .filter(row => row.status === 'Confirmed' && row.type === 'OUT' && dateString(row.date).startsWith(monthKey))
    .reduce((total, row) => total + toNumber(row.quantity), 0);
  const totalStock = products.reduce((total, row) => total + toNumber(row.currentStock), 0);
  const lowStock = products.filter(row => toNumber(row.currentStock) <= toNumber(row.minStock)).length;

  if (!hasPermission('stockTransactions.view')) {
    return <AlertBox message="Anda tidak memiliki izin untuk melihat transaksi stok." />;
  }

  const openForm = async (type: StockTransactionType) => {
    setError('');
    setSuccess('');
    try {
      const number = await nextNumber('stockTransactions', numberPrefix(type));
      setForm(emptyForm(type, number));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const handleItemChange = (itemId: string) => {
    const item = products.find(product => product.id === itemId);
    setForm(current => current ? {
      ...current,
      itemId,
      categoryId: item?.categoryId || '',
      categoryName: item?.categoryName || '',
      unit: item?.unit || '',
      warehouseId: item?.warehouseId || current.warehouseId,
    } : current);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const validationError = validateForm(form, products, transactions);
    if (validationError) {
      setError(validationError);
      return;
    }
    const item = products.find(product => product.id === form.itemId);
    const quantity = form.type === 'IN' || form.type === 'OUT' ? toNumber(form.quantity) : toNumber(form.actualStock);
    setError('');
    setProcessing('Menyimpan transaksi...');
    try {
      const created = await createStockTransaction({
        transactionNumber: form.transactionNumber,
        date: form.date,
        type: form.type,
        itemId: form.itemId,
        itemName: item?.name || '',
        categoryId: form.categoryId,
        categoryName: form.categoryName,
        quantity,
        unit: form.unit,
        source: form.source,
        kordaId: form.kordaId,
        senderName: form.senderName,
        receiverName: form.receiverName,
        condition: form.condition,
        warehouseId: form.warehouseId,
        storageLocation: form.storageLocation,
        referenceType: 'manual',
        notes: form.notes,
        status: 'Draft',
      }, currentUser);
      const patch: Record<string, unknown> = {};
      if (form.proofFile) {
        patch.proofUrl = await uploadProofFile('stockTransactions', created.id, form.proofFile);
      }
      const kordaName = kordas.find(row => row.id === form.kordaId)?.name;
      if (kordaName) patch.kordaName = kordaName;
      if (Object.keys(patch).length > 0) {
        await updateDocument('stockTransactions', created.id, patch, currentUser, 'Transaksi Stok');
      }
      setForm(null);
      setSuccess(`Transaksi ${created.transactionNumber} tersimpan sebagai Draft.`);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setProcessing('');
    }
  };

  const handleConfirm = async () => {
    if (!confirming) return;
    const target = confirming;
    setConfirming(null);
    setError('');
    setProcessing('Mengonfirmasi transaksi...');
    try {
      await confirmStockTransaction(target.id, currentUser);
      setSuccess(`Transaksi ${target.transactionNumber} berhasil dikonfirmasi.`);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setProcessing('');
    }
  };

  const transactionColumns: TableColumn<StockTransaction>[] = [
    { key: 'transactionNumber', label: 'No. Transaksi', render: row => <span className="font-semibold text-slate-800">{row.transactionNumber}</span> },
    { key: 'date', label: 'Tanggal', render: row => displayDate(row.date) },
    { key: 'type', label: 'Jenis', render: row => <StatusBadge value={row.type} /> },
    { key: 'itemName', label: 'Barang' },
    { key: 'quantity', label: 'Jumlah', render: row => `${toNumber(row.quantity)} ${row.unit}` },
    { key: 'warehouse', label: 'Gudang', render: row => warehouses.find(item => item.id === row.warehouseId)?.name || '-' },
    { key: 'status', label: 'Status', render: row => <StatusBadge value={row.status} /> },
    {
      key: 'actions',
      label: 'Aksi',
      render: row => (
        <div className="flex items-center justify-end gap-2">
          {row.proofUrl && <a href={row.proofUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600 hover:underline">Bukti</a>}
          {row.status === 'Draft' && hasPermission('stockTransactions.confirm') && (
            <button onClick={() => setConfirming(row)} className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">
              <Check className="w-3.5 h-3.5 mr-1" /> Konfirmasi
            </button>
          )}
        </div>
      ),
    },
  ];

  const cardColumns: TableColumn<StockTransaction>[] = [
    { key: 'itemName', label: 'Barang' },
    { key: 'reference', label: 'No. Referensi', render: row => row.transactionNumber },
    { key: 'previousStock', label: 'Stok Sebelum', render: row => toNumber(row.previousStock) },
    { key: 'delta', label: 'Perubahan', render: row => {
      const delta = movementDelta(row);
      return <span className={`font-semibold ${delta < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{delta > 0 ? `+${delta}` : delta}</span>;
    } },
    { key: 'newStock', label: 'Stok Sesudah', render: row => <span className="font-semibold">{toNumber(row.newStock)}</span> },
    {
      key: 'createdBy',
      label: 'Oleh',
      render: row => users.find(user => user.uid === row.createdBy)?.displayName || row.createdBy || '-',
    },
    { key: 'createdAt', label: 'Waktu', render: row => displayDate(row.createdAt) },
  ];

  const ActiveIcon = tabIcon(activeTab);
  const sourceLabel = form?.type === 'OUT' ? 'Tujuan' : form?.type === 'IN' ? 'Asal/Sumber' : 'Keterangan Sumber';
  const quantityLabel = form?.type === 'ADJUSTMENT' || form?.type === 'OPNAME' ? 'Stok Aktual' : 'Jumlah';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kontrol Stok"
        description="Catat mutasi barang masuk, keluar, penyesuaian, dan stock opname hingga konfirmasi saldo."
        icon={ActiveIcon}
        action={hasPermission('stockTransactions.create') && activeTab !== 'HISTORY' ? (
          <button onClick={() => void openForm(activeTab as StockTransactionType)} className={primaryButtonClass}>
            <Plus className="w-4 h-4 mr-2" /> Transaksi Baru
          </button>
        ) : undefined}
      />
      <Toast message={error} kind="error" onClose={() => setError('')} />
      <Toast message={success} kind="success" onClose={() => setSuccess('')} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard title="Total Stok" value={String(totalStock)} detail={`${products.length} barang`} icon={ClipboardList} />
        <InfoCard title="Stok Menipis" value={String(lowStock)} detail="Perlu perhatian" icon={SlidersHorizontal} color="bg-red-500" />
        <InfoCard title="Masuk Bulan Ini" value={String(monthlyIn)} detail="Terkonfirmasi" icon={ArrowDownToLine} />
        <InfoCard title="Keluar Bulan Ini" value={String(monthlyOut)} detail="Terkonfirmasi" icon={ArrowUpFromLine} color="bg-blue-600" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex flex-wrap gap-2 p-3 sm:p-4 border-b border-slate-200">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition ${activeTab === tab.key ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <FilterBar search={search} onSearch={setSearch}>
          {activeTab !== 'HISTORY' && (
            <>
              <input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className={`${inputClass} w-auto`} aria-label="Tanggal mulai" />
              <input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className={`${inputClass} w-auto`} aria-label="Tanggal akhir" />
              <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className={`${inputClass} w-auto`} aria-label="Filter kategori">
                <option value="">Semua kategori</option>
                {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <select value={warehouseFilter} onChange={event => setWarehouseFilter(event.target.value)} className={`${inputClass} w-auto`} aria-label="Filter gudang">
                <option value="">Semua gudang</option>
                {warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className={`${inputClass} w-auto`} aria-label="Filter status">
                <option value="">Semua status</option>
                <option value="Draft">Draft</option>
                <option value="Confirmed">Confirmed</option>
              </select>
            </>
          )}
          {activeTab === 'HISTORY' && (
            <select value={cardItemId} onChange={event => setCardItemId(event.target.value)} className={`${inputClass} w-auto min-w-[200px]`} aria-label="Filter barang">
              <option value="">Semua barang</option>
              {products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}
        </FilterBar>
        {activeTab === 'HISTORY' ? (
          <DataTable columns={cardColumns} rows={cardRows} rowKey={row => row.id} emptyLabel="Belum ada kartu stok untuk filter ini." />
        ) : (
          <>
            <DataTable columns={transactionColumns} rows={pageRows} rowKey={row => row.id} emptyLabel="Belum ada transaksi pada filter ini." />
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Menampilkan {filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-
                {Math.min(page * PAGE_SIZE, filteredRows.length)} dari {filteredRows.length} transaksi
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1} className={`${secondaryButtonClass} px-3 py-1.5`}>Sebelumnya</button>
                <span className="text-xs font-semibold text-slate-600">{page}/{totalPages}</span>
                <button onClick={() => setPage(value => Math.min(totalPages, value + 1))} disabled={page >= totalPages} className={`${secondaryButtonClass} px-3 py-1.5`}>Berikutnya</button>
              </div>
            </div>
          </>
        )}
      </div>

      {form && (
        <Modal title={`Transaksi ${TABS.find(tab => tab.key === form.type)?.label || ''}`} onClose={() => setForm(null)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>No. Transaksi</label>
                <input value={form.transactionNumber} readOnly className={`${inputClass} bg-slate-100`} />
              </div>
              <div>
                <label className={labelClass}>Tanggal</label>
                <input type="date" required value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Barang</label>
                <select required value={form.itemId} onChange={event => handleItemChange(event.target.value)} className={inputClass}>
                  <option value="">Pilih barang</option>
                  {products.filter(item => item.itemStatus !== 'Nonaktif').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>{quantityLabel}</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={form.type === 'IN' || form.type === 'OUT' ? form.quantity : form.actualStock}
                  onChange={event => setForm(current => current ? (
                    current.type === 'IN' || current.type === 'OUT'
                      ? { ...current, quantity: event.target.value }
                      : { ...current, actualStock: event.target.value }
                  ) : current)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Kategori</label>
                <input value={form.categoryName} readOnly placeholder="Otomatis dari barang" className={`${inputClass} bg-slate-100`} />
              </div>
              <div>
                <label className={labelClass}>Satuan</label>
                <input required value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value })} placeholder="Otomatis dari barang" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{sourceLabel}</label>
                <input value={form.source} onChange={event => setForm({ ...form, source: event.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>KORDA (Opsional)</label>
                <select value={form.kordaId} onChange={event => setForm({ ...form, kordaId: event.target.value })} className={inputClass}>
                  <option value="">Tanpa KORDA</option>
                  {kordas.map(korda => <option key={korda.id} value={korda.id}>{korda.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Pengirim</label>
                <input value={form.senderName} onChange={event => setForm({ ...form, senderName: event.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Penerima</label>
                <input value={form.receiverName} onChange={event => setForm({ ...form, receiverName: event.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Kondisi</label>
                <select value={form.condition} onChange={event => setForm({ ...form, condition: event.target.value })} className={inputClass}>
                  <option value="Baik">Baik</option>
                  <option value="Rusak">Rusak</option>
                  <option value="Meragukan">Meragukan</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Gudang/Lokasi</label>
                <select required value={form.warehouseId} onChange={event => setForm({ ...form, warehouseId: event.target.value })} className={inputClass}>
                  <option value="">Pilih gudang</option>
                  {warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}{warehouse.location ? ` - ${warehouse.location}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Lokasi Penyimpanan</label>
                <input value={form.storageLocation} onChange={event => setForm({ ...form, storageLocation: event.target.value })} placeholder="Contoh: Rak A-1" className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Bukti Transaksi</label>
                <input type="file" accept="image/*,.pdf" onChange={event => setForm({ ...form, proofFile: event.target.files?.[0] || null })} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Catatan</label>
                <textarea rows={3} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setForm(null)} className={secondaryButtonClass}>Batal</button>
              <button type="submit" className={primaryButtonClass}>Simpan Draft</button>
            </div>
          </form>
        </Modal>
      )}

      {confirming && (
        <ConfirmDialog
          message={`Konfirmasi transaksi ${confirming.transactionNumber}? Stok barang akan diperbarui.`}
          confirmLabel="Konfirmasi"
          onConfirm={() => void handleConfirm()}
          onCancel={() => setConfirming(null)}
        />
      )}
      {processing && <LoadingOverlay label={processing} />}
    </div>
  );
};
