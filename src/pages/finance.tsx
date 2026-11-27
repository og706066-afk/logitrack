import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDataVersion } from '../contexts/DataSyncContext';
import { AlertBox, InfoCard, LoadingOverlay } from '../components/ui';
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
import { ExcelImportButton, type ExcelImportField } from '../components/ExcelImport';
import {
  createFinanceTransaction,
  dateString,
  displayDate,
  getCollection,
  nextNumber,
  toNumber,
  todayString,
  updateFinanceTransaction,
} from '../services/logitrackService';
import { exportToExcel, exportToPdf, type ExportColumn } from '../utils/exports';
import type { FinanceTransaction } from '../types/logitrack';

type TypeFilter = 'Semua' | 'Pemasukan' | 'Pengeluaran';

interface FinanceDraft {
  id?: string;
  transactionNumber: string;
  date: string;
  type: 'Pemasukan' | 'Pengeluaran';
  amount: string;
  source: string;
  donorName: string;
  description: string;
  paymentMethod: 'Cash' | 'Transfer';
  notes: string;
  referenceType: string;
  referenceId: string;
}

interface ReportRow {
  tanggal: string;
  nomor: string;
  jenis: string;
  pemasukan: number;
  pengeluaran: number;
  saldo: number;
  keterangan: string;
}

const reportColumns: TableColumn<ReportRow>[] = [
  { key: 'tanggal', label: 'Tanggal', render: row => <span className="text-xs text-slate-500">{row.tanggal}</span> },
  { key: 'nomor', label: 'Nomor', render: row => <span className="font-medium text-slate-800">{row.nomor}</span> },
  { key: 'jenis', label: 'Jenis', render: row => <span>{row.jenis}</span> },
  { key: 'pemasukan', label: 'Pemasukan', render: row => <span className="text-ocean">{row.pemasukan ? rupiah(row.pemasukan) : '-'}</span> },
  { key: 'pengeluaran', label: 'Pengeluaran', render: row => <span className="text-red-600">{row.pengeluaran ? rupiah(row.pengeluaran) : '-'}</span> },
  { key: 'saldo', label: 'Saldo', render: row => <span className="font-semibold">{rupiah(row.saldo)}</span> },
  { key: 'keterangan', label: 'Keterangan', render: row => <span>{row.keterangan || '-'}</span> },
];

const REPORT_COLUMNS: ExportColumn<ReportRow>[] = [
  { key: 'tanggal', label: 'Tanggal' },
  { key: 'nomor', label: 'Nomor' },
  { key: 'jenis', label: 'Jenis' },
  { key: 'pemasukan', label: 'Pemasukan' },
  { key: 'pengeluaran', label: 'Pengeluaran' },
  { key: 'saldo', label: 'Saldo' },
  { key: 'keterangan', label: 'Keterangan' },
];

const financeImportFields: ExcelImportField[] = [
  { key: 'transactionNumber', label: 'Nomor Transaksi', aliases: ['nomor transaksi', 'no transaksi', 'transaction number', 'nomor', 'no'] },
  { key: 'date', label: 'Tanggal', required: true, aliases: ['date', 'tanggal', 'tgl'] },
  { key: 'type', label: 'Jenis', required: true, aliases: ['type', 'jenis', 'tipe'] },
  { key: 'amount', label: 'Jumlah', required: true, aliases: ['amount', 'jumlah', 'nominal', 'value'] },
  { key: 'source', label: 'Sumber', aliases: ['source', 'sumber'] },
  { key: 'donorName', label: 'Nama Donor', aliases: ['donor', 'donor name', 'nama donor', 'pemberi'] },
  { key: 'description', label: 'Keterangan', aliases: ['description', 'keterangan', 'deskripsi'] },
  { key: 'paymentMethod', label: 'Metode Bayar', aliases: ['payment method', 'metode bayar', 'pembayaran'] },
];

function emptyDraft(): FinanceDraft {
  return {
    transactionNumber: '',
    date: todayString(),
    type: 'Pemasukan',
    amount: '',
    source: '',
    donorName: '',
    description: '',
    paymentMethod: 'Cash',
    notes: '',
    referenceType: '',
    referenceId: '',
  };
}

function rupiah(value: number): string {
  return `Rp ${toNumber(value).toLocaleString('id-ID')}`;
}

async function fetchFinanceTransactions(): Promise<FinanceTransaction[]> {
  const rows = await getCollection<FinanceTransaction>('financeTransactions');
  return rows.sort((a, b) =>
    dateString(b.date).localeCompare(dateString(a.date))
    || String(b.transactionNumber).localeCompare(String(a.transactionNumber)));
}

export const FinancePage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const dataVersion = useDataVersion('financeTransactions');
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('Semua');
  const [form, setForm] = useState<FinanceDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canView = hasPermission('finance.view');
  const canCreate = hasPermission('finance.create');
  const canEdit = hasPermission('finance.edit');
  const canExport = hasPermission('finance.export');

  const load = async () => {
    try {
      setTransactions(await fetchFinanceTransactions());
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Gagal memuat buku kas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    let active = true;
    void fetchFinanceTransactions().then(rows => {
      if (active) setTransactions(rows);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Gagal memuat buku kas.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [canView, dataVersion]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return transactions.filter(row => {
      const date = dateString(row.date);
      if (from && date < from) return false;
      if (to && date > to) return false;
      if (typeFilter !== 'Semua' && row.type !== typeFilter) return false;
      if (!needle) return true;
      return [
        row.transactionNumber,
        row.source,
        row.donorName,
        row.description,
        row.notes,
        row.referenceId,
        row.paymentMethod,
      ].some(value => String(value || '').toLowerCase().includes(needle));
    });
  }, [transactions, search, from, to, typeFilter]);

  const income = filtered
    .filter(row => row.type === 'Pemasukan')
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const expense = filtered
    .filter(row => row.type === 'Pengeluaran')
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const balance = income - expense;

  const reportRows = useMemo<ReportRow[]>(() => {
    const sorted = [...filtered].sort((a, b) =>
      dateString(a.date).localeCompare(dateString(b.date))
      || String(a.transactionNumber).localeCompare(String(b.transactionNumber)));
    return sorted.map((row, index) => {
      const saldo = sorted.slice(0, index + 1).reduce((total, item) => {
        const delta = item.type === 'Pemasukan' ? toNumber(item.amount) : -toNumber(item.amount);
        return total + delta;
      }, 0);
      return {
        tanggal: displayDate(row.date),
        nomor: row.transactionNumber,
        jenis: row.type,
        pemasukan: row.type === 'Pemasukan' ? toNumber(row.amount) : 0,
        pengeluaran: row.type === 'Pengeluaran' ? toNumber(row.amount) : 0,
        saldo,
        keterangan: row.description || row.source || row.donorName || row.notes || '',
      };
    });
  }, [filtered]);

  const columns: TableColumn<FinanceTransaction>[] = [
    { key: 'date', label: 'Tanggal', render: row => displayDate(row.date) },
    { key: 'transactionNumber', label: 'Nomor', render: row => <span className="font-semibold text-slate-800">{row.transactionNumber}</span> },
    {
      key: 'type',
      label: 'Jenis',
      render: row => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${row.type === 'Pemasukan' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {row.type}
        </span>
      ),
    },
    { key: 'detail', label: 'Sumber / Uraian', render: row => row.type === 'Pemasukan' ? (row.source || row.donorName || '-') : (row.description || '-') },
    { key: 'amount', label: 'Jumlah', render: row => <span className="font-semibold">{rupiah(row.amount)}</span> },
    { key: 'paymentMethod', label: 'Metode', render: row => row.paymentMethod || '-' },
    { key: 'referenceId', label: 'Referensi', render: row => row.referenceId || '-' },
    { key: 'notes', label: 'Keterangan', render: row => row.notes || '-' },
  ];

  const openCreate = async () => {
    setError('');
    try {
      const number = await nextNumber('financeTransactions', 'KAS');
      setForm({ ...emptyDraft(), transactionNumber: number });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Gagal membuat nomor transaksi.');
    }
  };

  const openEdit = (row: FinanceTransaction) => {
    setError('');
    setForm({
      id: row.id,
      transactionNumber: row.transactionNumber,
      date: dateString(row.date),
      type: row.type,
      amount: String(toNumber(row.amount)),
      source: row.source || '',
      donorName: row.donorName || '',
      description: row.description || '',
      paymentMethod: row.paymentMethod || 'Cash',
      notes: row.notes || '',
      referenceType: row.referenceType || '',
      referenceId: row.referenceId || '',
    });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const amount = toNumber(form.amount);
    if (amount <= 0) {
      setError('Jumlah transaksi harus lebih dari nol.');
      return;
    }
    if (form.type === 'Pemasukan' && !form.source.trim()) {
      setError('Sumber pemasukan wajib diisi.');
      return;
    }
    if (form.type === 'Pengeluaran' && !form.description.trim()) {
      setError('Uraian pengeluaran wajib diisi.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload: Partial<FinanceTransaction> = {
        transactionNumber: form.transactionNumber.trim() || await nextNumber('financeTransactions', 'KAS'),
        date: form.date || todayString(),
        type: form.type,
        amount,
        source: form.type === 'Pemasukan' ? form.source.trim() : '',
        donorName: form.type === 'Pemasukan' ? form.donorName.trim() : '',
        description: form.type === 'Pengeluaran' ? form.description.trim() : '',
        paymentMethod: form.paymentMethod,
        notes: form.notes.trim(),
        referenceType: form.referenceType,
        referenceId: form.referenceId.trim(),
      };
      if (form.id) {
        await updateFinanceTransaction(form.id, payload, currentUser);
      } else {
        await createFinanceTransaction(payload, currentUser);
      }
      setForm(null);
      setSuccess(form.id ? 'Transaksi kas berhasil diubah.' : 'Transaksi kas berhasil dicatat.');
      await load();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Gagal menyimpan transaksi kas.');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(true);
    setError('');
    try {
      const filename = `laporan-kas-${todayString()}`;
      const title = 'Laporan Pemasukan, Pengeluaran, dan Saldo';
      if (format === 'excel') {
        await exportToExcel(filename, 'Buku Kas', reportRows, REPORT_COLUMNS);
      } else {
        await exportToPdf(filename, title, reportRows, REPORT_COLUMNS);
      }
      setSuccess(`Laporan ${format === 'excel' ? 'Excel' : 'PDF'} berhasil dibuat.`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Gagal mengekspor laporan kas.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportExcel = async (records: Record<string, string>[]) => {
    for (const record of records) {
      const type = record.type.toLowerCase().includes('keluar') ? 'Pengeluaran' : 'Pemasukan';
      const paymentMethod = record.paymentMethod.toLowerCase().includes('transfer') ? 'Transfer' : 'Cash';
      await createFinanceTransaction({
        transactionNumber: record.transactionNumber || undefined,
        date: record.date,
        type,
        amount: toNumber(record.amount),
        source: record.source,
        donorName: record.donorName,
        description: record.description,
        paymentMethod,
      }, currentUser);
    }
    setTransactions(await fetchFinanceTransactions());
    return records.length;
  };

  if (!canView) {
    return <AlertBox message="Anda tidak memiliki izin untuk melihat data keuangan." />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6 mr-2 shrink-0 text-ocean" />
            <span className="truncate">Buku Kas & Keuangan</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Catat pemasukan dan pengeluaran, pantau saldo, dan ekspor laporan kas SILOG.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate && (
            <>
              <button onClick={() => void openCreate()} className={primaryButtonClass}>
                <Plus className="w-4 h-4 mr-2" /> Catat Transaksi
              </button>
              <ExcelImportButton
                fields={financeImportFields}
                permission="imports.execute"
                existingRows={transactions}
                uniqueFields={['transactionNumber']}
                onImport={handleImportExcel}
                label="Impor Excel"
                title="Impor Transaksi Kas dari Excel/CSV"
              />
            </>
          )}
          {canExport && (
            <>
              <button onClick={() => void handleExport('excel')} className={primaryButtonClass}>
                <Download className="w-4 h-4 mr-2" /> Excel
              </button>
              <button onClick={() => void handleExport('pdf')} className={secondaryButtonClass}>
                <FileText className="w-4 h-4 mr-2" /> PDF
              </button>
            </>
          )}
        </div>
      </div>

      <AlertBox message={error} onClose={() => setError('')} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <InfoCard title="Total Pemasukan" value={rupiah(income)} detail={`${filtered.filter(row => row.type === 'Pemasukan').length} transaksi`} icon={TrendingUp} color="bg-ocean" />
        <InfoCard title="Total Pengeluaran" value={rupiah(expense)} detail={`${filtered.filter(row => row.type === 'Pengeluaran').length} transaksi`} icon={TrendingDown} color="bg-red-500" />
        <InfoCard title="Saldo Kas" value={rupiah(balance)} detail="Pemasukan - pengeluaran" icon={Wallet} color="bg-sky-600" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <FilterBar search={search} onSearch={setSearch}>
          <input type="date" value={from} onChange={event => setFrom(event.target.value)} className={`${inputClass} max-w-[190px]`} aria-label="Tanggal dari" />
          <input type="date" value={to} onChange={event => setTo(event.target.value)} className={`${inputClass} max-w-[190px]`} aria-label="Tanggal sampai" />
          <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as TypeFilter)} className={`${inputClass} max-w-[180px]`}>
            <option value="Semua">Semua jenis</option>
            <option value="Pemasukan">Pemasukan</option>
            <option value="Pengeluaran">Pengeluaran</option>
          </select>
        </FilterBar>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={row => row.id}
          onEdit={canEdit ? openEdit : undefined}
          emptyLabel="Belum ada transaksi kas yang sesuai filter."
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 text-sm">Laporan Pemasukan, Pengeluaran & Saldo</h3>
          <p className="text-xs text-slate-500 mt-1">Saldo dihitung berurutan dari transaksi sesuai filter yang aktif.</p>
        </div>
        <DataTable<ReportRow>
          columns={reportColumns}
          rows={reportRows}
          rowKey={row => row.nomor}
          selectable={false}
          emptyLabel="Belum ada data laporan."
        />
        {reportRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 border-t border-ocean/20 bg-ocean-light px-4 py-3 text-xs font-semibold text-slate-800">
            <span>Saldo akhir: {rupiah(balance)}</span>
            <span className="text-green-700">Pemasukan: {rupiah(income)}</span>
            <span className="text-red-600">Pengeluaran: {rupiah(expense)}</span>
          </div>
        )}
      </div>

      {form && (
        <Modal title={form.id ? 'Ubah Transaksi Kas' : 'Catat Transaksi Kas'} onClose={() => setForm(null)}>
          <form onSubmit={event => void save(event)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Nomor Transaksi</label>
                <input readOnly value={form.transactionNumber} className={`${inputClass} bg-slate-100`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Tanggal</label>
                <input required type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Jenis</label>
                <select value={form.type} onChange={event => setForm({ ...form, type: event.target.value as FinanceDraft['type'] })} className={inputClass}>
                  <option value="Pemasukan">Pemasukan</option>
                  <option value="Pengeluaran">Pengeluaran</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Jumlah (Rp)</label>
                <input required type="number" min="1" step="0.01" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} className={inputClass} placeholder="0" />
              </div>
            </div>
            {form.type === 'Pemasukan' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Sumber Pemasukan</label>
                  <input required value={form.source} onChange={event => setForm({ ...form, source: event.target.value })} className={inputClass} placeholder="Contoh: Donasi, iuran, penjualan" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Nama Penyumbang</label>
                  <input value={form.donorName} onChange={event => setForm({ ...form, donorName: event.target.value })} className={inputClass} placeholder="Opsional" />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Uraian Pengeluaran</label>
                <input required value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className={inputClass} placeholder="Contoh: Pembelian bahan makanan" />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Metode Pembayaran</label>
              <select value={form.paymentMethod} onChange={event => setForm({ ...form, paymentMethod: event.target.value as FinanceDraft['paymentMethod'] })} className={inputClass}>
                <option value="Cash">Cash</option>
                <option value="Transfer">Transfer</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Referensi Transaksi Pembelian</label>
                <select value={form.referenceType} onChange={event => setForm({ ...form, referenceType: event.target.value })} className={inputClass}>
                  <option value="">Tidak ada</option>
                  <option value="Pembelian">Pembelian</option>
                  <option value="Transaksi Stok">Transaksi Stok</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Nomor Referensi</label>
                <input value={form.referenceId} onChange={event => setForm({ ...form, referenceId: event.target.value })} className={inputClass} placeholder="Opsional" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Keterangan</label>
              <textarea rows={3} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} className={inputClass} placeholder="Opsional" />
            </div>
            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setForm(null)} className={secondaryButtonClass}>Batal</button>
              <button type="submit" disabled={saving} className={primaryButtonClass}>Simpan Transaksi</button>
            </div>
          </form>
        </Modal>
      )}

      <Toast message={success} kind="success" onClose={() => setSuccess('')} />
      {(loading || saving || exporting) && (
        <LoadingOverlay label={exporting ? 'Menyiapkan laporan...' : saving ? 'Menyimpan transaksi...' : 'Memuat buku kas...'} />
      )}
    </div>
  );
};
