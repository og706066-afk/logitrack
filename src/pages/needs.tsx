import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Pencil,
  Plus,
  X,
  XCircle,
} from 'lucide-react';
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
import { AlertBox, InfoCard, LoadingOverlay, PageHeader, StatusBadge } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import {
  createNeedRequest,
  dateString,
  decideNeedRequest,
  displayDate,
  getCollection,
  nextNumber,
  shortageAmount,
  toNumber,
  todayString,
  updateDocument,
} from '../services/logitrackService';
import type { Item, MasterData, NeedRequest } from '../types/logitrack';

interface NeedForm {
  id: string;
  requestNumber: string;
  date: string;
  requesterName: string;
  categoryId: string;
  itemId: string;
  quantity: string;
  unit: string;
  kordaId: string;
  departmentId: string;
  notes: string;
}

interface DecisionTarget {
  row: NeedRequest;
  type: 'Approved' | 'Rejected';
  reason: string;
}

interface ToastState {
  message: string;
  kind: 'error' | 'success';
}

function toOptions(rows: { id: string; name: string }[]): { value: string; label: string }[] {
  return rows.map(row => ({ value: row.id, label: row.name || row.id }));
}

function activeRows<T extends MasterData>(rows: T[]): T[] {
  return rows.filter(row => row.isActive !== false);
}

function nameOf(rows: { id: string; name: string }[], id: string): string {
  return rows.find(row => row.id === id)?.name || '';
}

function validateNeedForm(form: NeedForm, products: Item[]): string | null {
  if (!form.requestNumber || !form.date || !form.requesterName.trim() || !form.categoryId || !form.itemId || !form.kordaId || !form.departmentId) {
    return 'Nomor, tanggal, pemohon, kategori, barang, KORDA, dan bagian wajib diisi.';
  }
  if (toNumber(form.quantity) <= 0) return 'Jumlah kebutuhan harus lebih dari nol.';
  const item = products.find(product => product.id === form.itemId);
  if (!item) return 'Barang yang dipilih tidak ditemukan.';
  if (item.categoryId !== form.categoryId) return 'Barang tidak sesuai dengan kategori yang dipilih.';
  const unit = form.unit.trim();
  if (!unit) return 'Satuan wajib diisi.';
  if (unit.toLowerCase() !== item.unit.trim().toLowerCase()) return `Satuan harus sama dengan satuan barang (${item.unit}).`;
  return null;
}

export const NeedsPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const canView = hasPermission('needsRequests.view');
  const canCreate = hasPermission('needsRequests.create');
  const canEdit = hasPermission('needsRequests.edit');
  const canApprove = hasPermission('needsRequests.approve');
  const canReject = hasPermission('needsRequests.reject');

  const [needs, setNeeds] = useState<NeedRequest[]>([]);
  const [products, setProducts] = useState<Item[]>([]);
  const [categories, setCategories] = useState<MasterData[]>([]);
  const [kordas, setKordas] = useState<MasterData[]>([]);
  const [departments, setDepartments] = useState<MasterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState<ToastState>({ message: '', kind: 'success' });
  const [processing, setProcessing] = useState('');
  const [form, setForm] = useState<NeedForm | null>(null);
  const [decision, setDecision] = useState<DecisionTarget | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [kordaFilter, setKordaFilter] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setLoadError('');
    try {
      const [needRows, productRows, categoryRows, kordaRows, departmentRows] = await Promise.all([
        getCollection<NeedRequest>('needsRequests'),
        getCollection<Item>('products'),
        getCollection<MasterData>('categories'),
        getCollection<MasterData>('kordas'),
        getCollection<MasterData>('departments'),
      ]);
      setNeeds([...needRows].sort((a, b) => {
        const byDate = String(b.date).localeCompare(String(a.date));
        return byDate || String(b.requestNumber).localeCompare(String(a.requestNumber));
      }));
      setProducts(productRows);
      setCategories(categoryRows);
      setKordas(kordaRows);
      setDepartments(departmentRows);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Gagal memuat data kebutuhan.');
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void load();
  }, [load]);

  const showToast = (message: string, kind: ToastState['kind'] = 'success') => setToast({ message, kind });

  const updateForm = (patch: Partial<NeedForm>) => {
    setForm(current => current ? { ...current, ...patch } : current);
  };

  const canEditRow = (row: NeedRequest) =>
    canEdit && row.status === 'Pending' && (row.createdBy === currentUser?.uid || currentUser?.role === 'Super Admin');

  const openForm = async (row?: NeedRequest) => {
    if (row && !canEditRow(row)) {
      showToast('Anda tidak dapat mengubah pengajuan ini.', 'error');
      return;
    }
    setProcessing('Menyiapkan formulir...');
    try {
      const item = row ? products.find(product => product.id === row.itemId) : undefined;
      setForm({
        id: row?.id || '',
        requestNumber: row ? row.requestNumber : await nextNumber('needsRequests', 'KDB'),
        date: row ? dateString(row.date) : todayString(),
        requesterName: row ? row.requesterName : currentUser?.displayName || currentUser?.email || '',
        categoryId: row?.categoryId || '',
        itemId: row?.itemId || '',
        quantity: row ? String(toNumber(row.quantity)) : '',
        unit: row?.unit || item?.unit || '',
        kordaId: row?.kordaId || '',
        departmentId: row?.departmentId || '',
        notes: row?.notes || '',
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal menyiapkan formulir.', 'error');
    } finally {
      setProcessing('');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const validationMessage = validateNeedForm(form, products);
    if (validationMessage) {
      showToast(validationMessage, 'error');
      return;
    }
    const item = products.find(product => product.id === form.itemId);
    const category = categories.find(entry => entry.id === form.categoryId);
    const korda = kordas.find(entry => entry.id === form.kordaId);
    const department = departments.find(entry => entry.id === form.departmentId);
    const input: Partial<NeedRequest> = {
      requestNumber: form.requestNumber.trim(),
      date: form.date,
      requesterName: form.requesterName.trim(),
      categoryId: form.categoryId,
      categoryName: category?.name || item?.categoryName || '',
      itemId: form.itemId,
      itemName: item?.name || '',
      quantity: toNumber(form.quantity),
      unit: form.unit.trim(),
      kordaId: form.kordaId,
      kordaName: korda?.name || '',
      departmentId: form.departmentId,
      departmentName: department?.name || '',
      notes: form.notes.trim(),
    };
    setProcessing(form.id ? 'Menyimpan perubahan...' : 'Mengajukan kebutuhan...');
    try {
      if (form.id) {
        await updateDocument<NeedRequest>('needsRequests', form.id, input, currentUser, 'Kebutuhan Barang');
      } else {
        await createNeedRequest(input, currentUser);
      }
      setForm(null);
      showToast(form.id ? 'Perubahan pengajuan berhasil disimpan.' : 'Pengajuan kebutuhan berhasil dibuat.');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal menyimpan pengajuan.', 'error');
    } finally {
      setProcessing('');
    }
  };

  const handleDecision = async () => {
    if (!decision) return;
    if (decision.type === 'Rejected' && !decision.reason.trim()) {
      showToast('Alasan penolakan wajib diisi.', 'error');
      return;
    }
    setProcessing(decision.type === 'Approved' ? 'Menyetujui pengajuan...' : 'Menolak pengajuan...');
    try {
      await decideNeedRequest(decision.row.id, decision.type, currentUser, decision.reason.trim());
      setDecision(null);
      showToast(decision.type === 'Approved' ? 'Pengajuan disetujui.' : 'Pengajuan ditolak.');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal memproses pengajuan.', 'error');
    } finally {
      setProcessing('');
    }
  };

  const pendingCount = needs.filter(row => row.status === 'Pending').length;
  const approvedCount = needs.filter(row => row.status === 'Approved').length;
  const rejectedCount = needs.filter(row => row.status === 'Rejected').length;

  const filteredNeeds = needs.filter(row => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [
      row.requestNumber,
      row.requesterName,
      row.itemName,
      row.categoryName,
      row.kordaName,
      row.departmentName,
      row.notes,
    ].some(value => String(value ?? '').toLowerCase().includes(term));
    return matchesSearch
      && (!statusFilter || row.status === statusFilter)
      && (!categoryFilter || row.categoryId === categoryFilter)
      && (!kordaFilter || row.kordaId === kordaFilter);
  });
  const totalPages = Math.max(1, Math.ceil(filteredNeeds.length / 10));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredNeeds.slice((currentPage - 1) * 10, currentPage * 10);

  const columns: TableColumn<NeedRequest>[] = [
    {
      key: 'requestNumber',
      label: 'No. Pengajuan',
      render: row => <span className="font-semibold text-slate-800">{row.requestNumber}</span>,
    },
    {
      key: 'date',
      label: 'Tanggal',
      render: row => <span className="text-xs text-slate-500">{displayDate(row.date)}</span>,
    },
    {
      key: 'requesterName',
      label: 'Pemohon',
      render: row => <span className="text-slate-700">{row.requesterName || '-'}</span>,
    },
    {
      key: 'itemName',
      label: 'Barang',
      render: row => (
        <div>
          <p className="font-medium text-slate-800">{row.itemName || nameOf(products, row.itemId) || '-'}</p>
          <p className="text-xs text-slate-500">{row.categoryName || nameOf(categories, row.categoryId) || '-'}</p>
        </div>
      ),
    },
    {
      key: 'quantity',
      label: 'Kebutuhan',
      render: row => <span className="font-semibold text-slate-800">{toNumber(row.quantity).toLocaleString('id-ID')} {row.unit}</span>,
    },
    {
      key: 'stock',
      label: 'Stok Tersedia',
      render: row => {
        const product = products.find(entry => entry.id === row.itemId);
        return <span>{toNumber(product?.currentStock).toLocaleString('id-ID')} {product?.unit || row.unit}</span>;
      },
    },
    {
      key: 'shortage',
      label: 'Kekurangan',
      render: row => {
        const stock = toNumber(products.find(entry => entry.id === row.itemId)?.currentStock);
        const shortage = shortageAmount(row, stock);
        return <span className={shortage > 0 ? 'font-semibold text-red-600' : 'text-emerald-700'}>{shortage.toLocaleString('id-ID')} {row.unit}</span>;
      },
    },
    {
      key: 'destination',
      label: 'KORDA / Bagian',
      render: row => (
        <div>
          <p className="text-slate-700">{row.kordaName || nameOf(kordas, row.kordaId) || '-'}</p>
          <p className="text-xs text-slate-500">{row.departmentName || nameOf(departments, row.departmentId) || '-'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: row => <StatusBadge value={row.status} />,
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: row => (
        <div className="flex justify-end gap-1">
          {canEditRow(row) && (
            <button onClick={() => void openForm(row)} className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg" title="Ubah">
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {row.status === 'Pending' && canApprove && (
            <button onClick={() => setDecision({ row, type: 'Approved', reason: '' })} className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg" title="Setujui">
              <Check className="w-4 h-4" />
            </button>
          )}
          {row.status === 'Pending' && canReject && (
            <button onClick={() => setDecision({ row, type: 'Rejected', reason: '' })} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Tolak">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  if (!canView) {
    return <AlertBox message="Anda tidak memiliki izin untuk melihat pengajuan kebutuhan." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kebutuhan Barang"
        description="Ajukan kebutuhan barang, pantau stok tersedia, dan setujui atau tolak pengajuan."
        icon={ClipboardList}
        action={canCreate ? (
          <button onClick={() => void openForm()} className={primaryButtonClass}>
            <Plus className="w-4 h-4 mr-2" /> Ajukan Kebutuhan
          </button>
        ) : undefined}
      />
      <AlertBox message={loadError} onClose={() => setLoadError('')} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard title="Total Pengajuan" value={String(needs.length)} detail="Semua" icon={ClipboardList} />
        <InfoCard title="Menunggu" value={String(pendingCount)} detail="Pending" icon={Clock3} color="bg-amber-500" />
        <InfoCard title="Disetujui" value={String(approvedCount)} detail="Approved" icon={CheckCircle2} />
        <InfoCard title="Ditolak" value={String(rejectedCount)} detail="Rejected" icon={XCircle} color="bg-red-500" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <FilterBar
          search={search}
          onSearch={value => { setSearch(value); setPage(1); }}
        >
          <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }} className={`${inputClass} w-auto`}>
            <option value="">Semua status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <select value={categoryFilter} onChange={event => { setCategoryFilter(event.target.value); setPage(1); }} className={`${inputClass} w-auto`}>
            <option value="">Semua kategori</option>
            {toOptions(activeRows(categories)).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={kordaFilter} onChange={event => { setKordaFilter(event.target.value); setPage(1); }} className={`${inputClass} w-auto`}>
            <option value="">Semua KORDA</option>
            {toOptions(activeRows(kordas)).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </FilterBar>
        <DataTable
          columns={columns}
          rows={pageRows}
          rowKey={row => row.id}
          emptyLabel={needs.length === 0 ? 'Belum ada pengajuan kebutuhan.' : 'Tidak ada pengajuan yang cocok dengan filter.'}
        />
        {filteredNeeds.length > 10 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">Halaman {currentPage} dari {totalPages} · {filteredNeeds.length} pengajuan</p>
            <div className="flex gap-2">
              <button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className={secondaryButtonClass}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Sebelumnya
              </button>
              <button disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} className={secondaryButtonClass}>
                Berikutnya <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {form && (
        <Modal title={form.id ? 'Ubah Pengajuan Kebutuhan' : 'Ajukan Kebutuhan Barang'} onClose={() => setForm(null)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">No. Pengajuan</label>
                <input readOnly value={form.requestNumber} className={`${inputClass} bg-slate-100`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Tanggal</label>
                <input required type="date" value={form.date} onChange={event => updateForm({ date: event.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Nama Pemohon</label>
              <input required value={form.requesterName} onChange={event => updateForm({ requesterName: event.target.value })} className={inputClass} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Kategori</label>
                <select required value={form.categoryId} onChange={event => updateForm({ categoryId: event.target.value, itemId: '', unit: '' })} className={inputClass}>
                  <option value="">Pilih kategori</option>
                  {toOptions(activeRows(categories)).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Barang</label>
                <select required value={form.itemId} onChange={event => {
                  const item = products.find(product => product.id === event.target.value);
                  updateForm({ itemId: event.target.value, unit: item?.unit || '' });
                }} className={inputClass}>
                  <option value="">Pilih barang</option>
                  {products.filter(product => product.categoryId === form.categoryId).map(product => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Jumlah Kebutuhan</label>
                <input required type="number" min="0.01" step="any" value={form.quantity} onChange={event => updateForm({ quantity: event.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Satuan</label>
                <input required value={form.unit} onChange={event => updateForm({ unit: event.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">KORDA</label>
                <select required value={form.kordaId} onChange={event => updateForm({ kordaId: event.target.value })} className={inputClass}>
                  <option value="">Pilih KORDA</option>
                  {toOptions(activeRows(kordas)).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Bagian / Peruntukan</label>
                <select required value={form.departmentId} onChange={event => updateForm({ departmentId: event.target.value })} className={inputClass}>
                  <option value="">Pilih bagian</option>
                  {toOptions(activeRows(departments)).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Catatan</label>
              <textarea rows={3} value={form.notes} onChange={event => updateForm({ notes: event.target.value })} className={inputClass} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setForm(null)} className={secondaryButtonClass}>Batal</button>
              <button type="submit" className={primaryButtonClass}>Simpan Pengajuan</button>
            </div>
          </form>
        </Modal>
      )}

      {decision && (
        <Modal
          title={decision.type === 'Approved' ? 'Konfirmasi Persetujuan' : 'Konfirmasi Penolakan'}
          onClose={() => setDecision(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              {decision.type === 'Approved' ? 'Setujui' : 'Tolak'} pengajuan <span className="font-semibold">{decision.row.requestNumber}</span>?
            </p>
            {decision.type === 'Rejected' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Alasan Penolakan</label>
                <textarea
                  required
                  rows={4}
                  value={decision.reason}
                  onChange={event => setDecision(current => current ? { ...current, reason: event.target.value } : current)}
                  className={inputClass}
                  placeholder="Jelaskan alasan penolakan..."
                />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setDecision(null)} className={secondaryButtonClass}>Batal</button>
              <button
                type="button"
                onClick={() => void handleDecision()}
                className={`${primaryButtonClass} ${decision.type === 'Rejected' ? 'bg-red-600 hover:bg-red-700' : ''}`}
              >
                {decision.type === 'Approved' ? 'Setujui' : 'Tolak Pengajuan'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {loading && !processing && <LoadingOverlay label="Memuat data kebutuhan..." />}
      {processing && <LoadingOverlay label={processing} />}
      <Toast message={toast.message} kind={toast.kind} onClose={() => setToast({ message: '', kind: 'success' })} />
    </div>
  );
};
