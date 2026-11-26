import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  Pencil,
  Plus,
  Trash2,
  Truck,
  Upload,
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
import { ExcelImportButton, type ExcelImportField } from '../components/ExcelImport';
import {
  LOGISTICS_EXPORT_COLUMNS,
  LOGISTICS_EXPORT_GROUPS,
  LOGISTICS_HEADER_GROUPS,
  shipmentSentStatus,
  toLogisticsShipmentExportRows,
} from '../components/logisticsColumns';
import { AlertBox, ConfirmDialog, InfoCard, LoadingOverlay, PageHeader } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import {
  createShipment,
  dateString,
  displayDate,
  getCollection,
  getShipments,
  nextNumber,
  removeDocument,
  SHIPMENT_STATUSES,
  toNumber,
  todayString,
  updateShipment,
  uploadProofFile,
  type NewCollection,
} from '../services/logitrackService';
import type { UserProfile } from '../types';
import type { Item, MasterData, Shipment, ShipmentStatus } from '../types/logitrack';
import { exportToExcel } from '../utils/exports';

interface ShipmentForm {
  id: string;
  shipmentNumber: string;
  itemId: string;
  itemName: string;
  quantity: string;
  unit: string;
  senderFromRegion: string;
  kordaId: string;
  plannedQuantity: string;
  status: ShipmentStatus;
  shipmentDate: string;
  driverId: string;
  driverName: string;
  senderName: string;
  receiverName: string;
  storageLocation: string;
  notes: string;
}

interface DriverUpdateForm {
  id: string;
  status: ShipmentStatus;
  receivedQuantity: string;
  shortageNote: string;
  damageNote: string;
}

interface ReceiptForm {
  id: string;
  status: 'Selesai' | 'Diterima sebagian';
  receivedQuantity: string;
  shortageNote: string;
  damageNote: string;
}

interface ToastState {
  message: string;
  kind: 'error' | 'success';
}

const shipmentTableColumns: TableColumn<Shipment>[] = [
  {
    key: 'no',
    label: 'NO',
    filterable: false,
    render: (_row, index) => <span className="font-semibold text-slate-800">{index + 1}</span>,
  },
  {
    key: 'itemName',
    label: 'NAMA BARANG',
    render: row => <span className="font-medium text-slate-800">{row.itemName || '-'}</span>,
  },
  {
    key: 'quantity',
    label: 'VOL',
    render: row => <span>{toNumber(row.quantity)}</span>,
  },
  {
    key: 'unit',
    label: 'SATUAN',
    render: row => <span>{row.unit || '-'}</span>,
  },
  {
    key: 'senderFromRegion',
    label: 'DARI KORDA',
    render: row => <span>{row.senderFromRegion || '-'}</span>,
  },
  {
    key: 'plannedQuantity',
    label: 'RENCANA KIRIM',
    render: row => <span>{toNumber(row.plannedQuantity)}</span>,
  },
  {
    key: 'statusFlag',
    label: 'SUDAH/BELUM',
    filterable: true,
    filterValue: row => shipmentSentStatus(row),
    render: row => {
      const status = shipmentSentStatus(row);
      return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${status === 'Sudah' ? 'bg-green-50 text-green-700 border-green-200' : status === 'Belum' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white text-slate-400 border-slate-200'}`}>
          {status}
        </span>
      );
    },
  },
  {
    key: 'tanggal',
    label: 'TANGGAL',
    filterable: false,
    render: row => <span className="text-xs text-slate-500">{displayDate(row.shipmentDate)}</span>,
  },
  {
    key: 'senderName',
    label: 'NAMA PENGIRIM',
    render: row => <span>{row.senderName || '-'}</span>,
  },
  {
    key: 'receiverName',
    label: 'NAMA PENERIMA',
    render: row => <span>{row.receiverName || '-'}</span>,
  },
  {
    key: 'storageLocation',
    label: 'TEMPAT PENYIMPANAN',
    render: row => <span>{row.storageLocation || '-'}</span>,
  },
];

const shipmentImportFields: ExcelImportField[] = [
  { key: 'shipmentNumber', label: 'Nomor Pengiriman', aliases: ['nomor pengiriman', 'no pengiriman', 'shipment number', 'nomor', 'no'] },
  { key: 'item', label: 'NAMA BARANG', required: true, aliases: ['item', 'barang', 'nama barang', 'item name'] },
  { key: 'quantity', label: 'VOL', required: true, aliases: ['quantity', 'volume', 'vol', 'jumlah', 'qty'] },
  { key: 'unit', label: 'SATUAN', required: true, aliases: ['unit', 'satuan'] },
  { key: 'senderFromRegion', label: 'DARI KORDA', required: true, aliases: ['sender from region', 'daerah pengirim', 'dari korda', 'lokasi pengirim', 'asal'] },
  { key: 'korda', label: 'KORDA', required: true, aliases: ['korda', 'nama korda', 'tujuan'] },
  { key: 'plannedQuantity', label: 'RENCANA KIRIM', aliases: ['planned quantity', 'rencana kirim', 'rencana'] },
  { key: 'status', label: 'STATUS', aliases: ['status'] },
  { key: 'shipmentDate', label: 'TANGGAL', required: true, aliases: ['shipment date', 'tanggal', 'tgl'] },
  { key: 'driver', label: 'Driver', required: true, aliases: ['driver', 'nama driver', 'driver name'] },
  { key: 'senderName', label: 'NAMA PENGIRIM', aliases: ['sender', 'pengirim', 'nama pengirim'] },
  { key: 'receiverName', label: 'NAMA PENERIMA', aliases: ['receiver', 'penerima', 'nama penerima'] },
  { key: 'storageLocation', label: 'TEMPAT PENYIMPANAN', aliases: ['storage location', 'tempat penyimpanan', 'gudang'] },
  { key: 'notes', label: 'Catatan', aliases: ['notes', 'catatan', 'keterangan'] },
];

const RECEIPT_STATUSES: ReceiptForm['status'][] = ['Selesai', 'Diterima sebagian'];

function toOptions(rows: { id: string; name: string }[]): { value: string; label: string }[] {
  return rows.map(row => ({ value: row.id, label: row.name || row.id }));
}

function activeRows<T extends MasterData>(rows: T[]): T[] {
  return rows.filter(row => row.isActive !== false);
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <div className="mt-1 text-sm text-slate-800 break-words">{value}</div>
    </div>
  );
}

function validateShipmentForm(form: ShipmentForm, products: Item[]): string | null {
  if (!form.shipmentNumber || !form.itemName.trim() || !form.unit.trim() || !form.senderFromRegion.trim() || !form.kordaId || !form.shipmentDate) {
    return 'Nomor, barang, satuan, daerah pengirim, KORDA, dan tanggal wajib diisi.';
  }
  if (toNumber(form.quantity) <= 0 || toNumber(form.plannedQuantity) <= 0) {
    return 'Volume dan rencana jumlah kirim harus lebih dari nol.';
  }
  if (!form.driverId || !form.driverName.trim()) return 'Driver wajib dipilih.';
  if (!form.senderName.trim() || !form.receiverName.trim() || !form.storageLocation.trim()) {
    return 'Nama pengirim, penerima, dan tempat penyimpanan wajib diisi.';
  }
  if (!SHIPMENT_STATUSES.includes(form.status)) return 'Status pengiriman tidak valid.';
  const item = products.find(product => product.id === form.itemId);
  if (item && form.unit.trim().toLowerCase() !== item.unit.trim().toLowerCase()) {
    return `Satuan harus sama dengan satuan barang (${item.unit}).`;
  }
  return null;
}

export const ShipmentsPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const isDriver = currentUser?.role === 'Driver';
  const canView = hasPermission('shipments.view');
  const canCreate = hasPermission('shipments.create') && !isDriver;
  const canEditFull = hasPermission('shipments.edit') && !isDriver;
  const canConfirmPermission = hasPermission('shipments.confirm');
  const canUploadPermission = hasPermission('shipments.upload');
  const canExport = hasPermission('reports.export');
  const canDelete = currentUser?.role === 'Super Admin' && !isDriver;

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [kordas, setKordas] = useState<MasterData[]>([]);
  const [products, setProducts] = useState<Item[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState<ToastState>({ message: '', kind: 'success' });
  const [processing, setProcessing] = useState('');
  const [form, setForm] = useState<ShipmentForm | null>(null);
  const [driverForm, setDriverForm] = useState<DriverUpdateForm | null>(null);
  const [receiptForm, setReceiptForm] = useState<ReceiptForm | null>(null);
  const [detailTarget, setDetailTarget] = useState<Shipment | null>(null);
  const [exporting, setExporting] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<Shipment | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shipment | null>(null);
  const [search, setSearch] = useState('');
  const [kordaFilter, setKordaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setLoadError('');
    try {
      const [shipmentRows, kordaRows, productRows, userRows] = await Promise.all([
        getShipments(currentUser),
        getCollection<MasterData>('kordas'),
        getCollection<Item>('products'),
        getCollection<UserProfile>('users' as NewCollection),
      ]);
      const visibleRows = isDriver ? shipmentRows.filter(row => row.driverId === currentUser?.uid) : shipmentRows;
      setShipments([...visibleRows].sort((a, b) => {
        const byDate = dateString(b.shipmentDate).localeCompare(dateString(a.shipmentDate));
        return byDate || String(b.shipmentNumber).localeCompare(String(a.shipmentNumber));
      }));
      setKordas(kordaRows);
      setProducts(productRows);
      setUsers(userRows);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Gagal memuat data pengiriman.');
    } finally {
      setLoading(false);
    }
  }, [canView, currentUser, isDriver]);

  useEffect(() => {
    void load();
  }, [load]);

  const showToast = (message: string, kind: ToastState['kind'] = 'success') => setToast({ message, kind });

  const updateForm = (patch: Partial<ShipmentForm>) => {
    setForm(current => current ? { ...current, ...patch } : current);
  };

  const updateDriverForm = (patch: Partial<DriverUpdateForm>) => {
    setDriverForm(current => current ? { ...current, ...patch } : current);
  };

  const updateReceiptForm = (patch: Partial<ReceiptForm>) => {
    setReceiptForm(current => current ? { ...current, ...patch } : current);
  };

  const canUpdateRow = (row: Shipment) => !isDriver || row.driverId === currentUser?.uid;
  const canDriverUpdate = (row: Shipment) => isDriver && canUpdateRow(row) && (hasPermission('shipments.edit') || canUploadPermission);
  const canUploadRow = (row: Shipment) => canUpdateRow(row) && (canUploadPermission || hasPermission('shipments.edit'));
  const canConfirmRow = (row: Shipment) => canUpdateRow(row) && canConfirmPermission;

  const drivers = users.filter(user => user.role === 'Driver' && user.isActive !== false);

  const openForm = async (row?: Shipment) => {
    if (row && (!canEditFull || !canUpdateRow(row))) {
      showToast('Anda tidak dapat mengubah pengiriman ini.', 'error');
      return;
    }
    setProcessing('Menyiapkan formulir...');
    try {
      const korda = row ? kordas.find(entry => entry.id === row.kordaId) : undefined;
      setForm({
        id: row?.id || '',
        shipmentNumber: row ? row.shipmentNumber : await nextNumber('shipments', 'KRM'),
        itemId: '',
        itemName: row?.itemName || '',
        quantity: row ? String(toNumber(row.quantity)) : '',
        unit: row?.unit || '',
        senderFromRegion: row?.senderFromRegion || '',
        kordaId: row?.kordaId || '',
        plannedQuantity: row ? String(toNumber(row.plannedQuantity)) : '',
        status: row?.status || 'Belum dikirim',
        shipmentDate: row ? dateString(row.shipmentDate) : todayString(),
        driverId: row?.driverId || '',
        driverName: row?.driverName || '',
        senderName: row?.senderName || '',
        receiverName: row?.receiverName || '',
        storageLocation: row?.storageLocation || '',
        notes: row?.notes || '',
      });
      if (row && !korda) showToast('KORDA pada pengiriman ini belum terdaftar.', 'error');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal menyiapkan formulir.', 'error');
    } finally {
      setProcessing('');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const validationMessage = validateShipmentForm(form, products);
    if (validationMessage) {
      showToast(validationMessage, 'error');
      return;
    }
    const korda = kordas.find(entry => entry.id === form.kordaId);
    const input: Partial<Shipment> = {
      shipmentNumber: form.shipmentNumber.trim(),
      itemName: form.itemName.trim(),
      quantity: toNumber(form.quantity),
      unit: form.unit.trim(),
      senderFromRegion: form.senderFromRegion.trim(),
      kordaId: form.kordaId,
      kordaName: korda?.name || '',
      plannedQuantity: toNumber(form.plannedQuantity),
      status: form.status,
      shipmentDate: form.shipmentDate,
      driverId: form.driverId,
      driverName: form.driverName,
      senderName: form.senderName.trim(),
      receiverName: form.receiverName.trim(),
      storageLocation: form.storageLocation.trim(),
      notes: form.notes.trim(),
    };
    setProcessing(form.id ? 'Menyimpan perubahan...' : 'Membuat pengiriman...');
    try {
      if (form.id) {
        await updateShipment(form.id, input, currentUser);
      } else {
        await createShipment(input, currentUser);
      }
      setForm(null);
      showToast(form.id ? 'Perubahan pengiriman berhasil disimpan.' : 'Pengiriman berhasil dibuat.');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal menyimpan pengiriman.', 'error');
    } finally {
      setProcessing('');
    }
  };

  const handleDriverUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!driverForm) return;
    if (toNumber(driverForm.receivedQuantity) <= 0) {
      showToast('Jumlah diterima harus lebih dari nol.', 'error');
      return;
    }
    setProcessing('Menyimpan pembaruan pengiriman...');
    try {
      await updateShipment(driverForm.id, {
        status: driverForm.status,
        receivedQuantity: toNumber(driverForm.receivedQuantity),
        shortageNote: driverForm.shortageNote.trim(),
        damageNote: driverForm.damageNote.trim(),
      }, currentUser);
      setDriverForm(null);
      showToast('Pembaruan pengiriman berhasil disimpan.');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal memperbarui pengiriman.', 'error');
    } finally {
      setProcessing('');
    }
  };

  const handleReceipt = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!receiptForm) return;
    const received = toNumber(receiptForm.receivedQuantity);
    if (received <= 0) {
      showToast('Jumlah diterima harus lebih dari nol.', 'error');
      return;
    }
    if (receiptForm.status === 'Diterima sebagian' && !receiptForm.shortageNote.trim()) {
      showToast('Catatan kekurangan wajib diisi untuk penerimaan sebagian.', 'error');
      return;
    }
    setProcessing('Menyimpan konfirmasi penerimaan...');
    try {
      await updateShipment(receiptForm.id, {
        status: receiptForm.status,
        receivedQuantity: received,
        shortageNote: receiptForm.shortageNote.trim(),
        damageNote: receiptForm.damageNote.trim(),
      }, currentUser);
      setReceiptForm(null);
      showToast('Konfirmasi penerimaan berhasil disimpan.');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal mengonfirmasi penerimaan.', 'error');
    } finally {
      setProcessing('');
    }
  };

  const handleUpload = async () => {
    if (!uploadTarget || !uploadFile) {
      showToast('Pilih foto bukti terlebih dahulu.', 'error');
      return;
    }
    setProcessing('Mengunggah bukti foto...');
    try {
      const url = await uploadProofFile('shipments', uploadTarget.id, uploadFile);
      await updateShipment(uploadTarget.id, { proofPhotos: [...(uploadTarget.proofPhotos || []), url] }, currentUser);
      setUploadTarget(null);
      setUploadFile(null);
      showToast('Bukti foto berhasil diunggah.');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal mengunggah bukti foto.', 'error');
    } finally {
      setProcessing('');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setProcessing('Menghapus pengiriman...');
    try {
      await removeDocument('shipments', deleteTarget.id, currentUser, 'Pengiriman');
      setDeleteTarget(null);
      showToast('Pengiriman berhasil dihapus.');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal menghapus pengiriman.', 'error');
    } finally {
      setProcessing('');
    }
  };

  const inTransitCount = shipments.filter(row => row.status === 'Dalam perjalanan').length;
  const completedCount = shipments.filter(row => row.status === 'Selesai').length;
  const problemCount = shipments.filter(row => row.status === 'Bermasalah').length;

  const filteredShipments = shipments.filter(row => {
    const term = search.trim().toLowerCase();
    const rowDate = dateString(row.shipmentDate);
    const matchesSearch = !term || [
      row.shipmentNumber,
      row.itemName,
      row.driverName,
      row.senderName,
      row.receiverName,
      row.kordaName,
      row.notes,
    ].some(value => String(value ?? '').toLowerCase().includes(term));
    return matchesSearch
      && (!kordaFilter || row.kordaId === kordaFilter)
      && (!statusFilter || row.status === statusFilter)
      && (!dateFrom || rowDate >= dateFrom)
      && (!dateTo || rowDate <= dateTo);
  });
  const totalPages = Math.max(1, Math.ceil(filteredShipments.length / 10));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredShipments.slice((currentPage - 1) * 10, currentPage * 10);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToExcel(
        `pengiriman-${todayString()}`,
        'Data Pengiriman',
        toLogisticsShipmentExportRows(filteredShipments),
        LOGISTICS_EXPORT_COLUMNS,
        LOGISTICS_EXPORT_GROUPS,
      );
      showToast('Data pengiriman berhasil diekspor ke Excel.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal mengekspor data pengiriman.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const columns: TableColumn<Shipment>[] = [
    {
      key: 'actions',
      label: 'Aksi',
      filterable: false,
      render: row => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setDetailTarget(row)} className="p-2 text-slate-500 hover:text-ocean hover:bg-ocean-light/70 rounded-lg" title="Detail">
            <Eye className="w-4 h-4" />
          </button>
          {canEditFull && (
            <button onClick={() => void openForm(row)} className="p-2 text-slate-500 hover:text-ocean hover:bg-ocean-light/70 rounded-lg" title="Ubah">
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {canDriverUpdate(row) && (
            <button
              onClick={() => setDriverForm({
                id: row.id,
                status: row.status,
                receivedQuantity: toNumber(row.receivedQuantity) > 0 ? String(toNumber(row.receivedQuantity)) : '',
                shortageNote: row.shortageNote || '',
                damageNote: row.damageNote || '',
              })}
              className="p-2 text-slate-500 hover:text-ocean hover:bg-ocean-light/70 rounded-lg"
              title="Perbarui pengiriman"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {canUploadRow(row) && (
            <button onClick={() => { setUploadTarget(row); setUploadFile(null); }} className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg" title="Unggah bukti">
              <Upload className="w-4 h-4" />
            </button>
          )}
          {canConfirmRow(row) && (
            <button
              onClick={() => setReceiptForm({
                id: row.id,
                status: row.status === 'Diterima sebagian' ? 'Diterima sebagian' : 'Selesai',
                receivedQuantity: toNumber(row.receivedQuantity) > 0 ? String(toNumber(row.receivedQuantity)) : '',
                shortageNote: row.shortageNote || '',
                damageNote: row.damageNote || '',
              })}
              className="p-2 text-ocean hover:bg-ocean-light/70 rounded-lg"
              title="Konfirmasi penerimaan"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {canDelete && (
            <button onClick={() => setDeleteTarget(row)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Hapus">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const handleImportExcel = async (records: Record<string, string>[]) => {
    for (const [index, record] of records.entries()) {
      const korda = kordas.find(row => row.name.trim().toLowerCase() === record.korda.trim().toLowerCase());
      const driver = users.find(user =>
        user.displayName.trim().toLowerCase() === record.driver.trim().toLowerCase()
        || user.email.trim().toLowerCase() === record.driver.trim().toLowerCase());
      if (!korda || !driver) {
        throw new Error(`Baris ${index + 1}: KORDA atau driver tidak ditemukan.`);
      }
      const status = SHIPMENT_STATUSES.find(item => item.toLowerCase() === record.status.trim().toLowerCase()) || 'Belum dikirim';
      await createShipment({
        shipmentNumber: record.shipmentNumber || undefined,
        itemName: record.item,
        quantity: toNumber(record.quantity),
        unit: record.unit,
        senderFromRegion: record.senderFromRegion,
        kordaId: korda.id,
        kordaName: korda.name,
        plannedQuantity: toNumber(record.plannedQuantity || record.quantity),
        status,
        shipmentDate: record.shipmentDate,
        driverId: driver.uid,
        driverName: driver.displayName,
        senderName: record.senderName,
        receiverName: record.receiverName,
        storageLocation: record.storageLocation,
        notes: record.notes,
      }, currentUser);
    }
    await load();
    return records.length;
  };

  if (!canView) {
    return <AlertBox message="Anda tidak memiliki izin untuk melihat data pengiriman." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengiriman Barang"
        description={isDriver ? 'Lihat tugas pengiriman Anda, perbarui status, dan unggah bukti foto.' : 'Kelola pengiriman barang, konfirmasi penerimaan, dan arsipkan bukti foto.'}
        icon={Truck}
        action={(canCreate || canExport) ? (
          <div className="flex flex-wrap items-center gap-2">
            {canCreate && (
              <button onClick={() => void openForm()} className={primaryButtonClass}>
                <Plus className="w-4 h-4 mr-2" /> Buat Pengiriman
              </button>
            )}
            {canCreate && (
              <ExcelImportButton
                fields={shipmentImportFields}
                permission="imports.execute"
                existingRows={shipments}
                uniqueFields={['shipmentNumber']}
                onImport={handleImportExcel}
                label="Impor Excel"
                title="Impor Pengiriman dari Excel/CSV"
              />
            )}
            {canExport && (
              <button onClick={() => void handleExport()} disabled={exporting} className={secondaryButtonClass}>
                <Download className="w-4 h-4 mr-2" /> Ekspor Excel
              </button>
            )}
          </div>
        ) : undefined}
      />
      <AlertBox message={loadError} onClose={() => setLoadError('')} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard title="Total Pengiriman" value={String(shipments.length)} detail="Semua" icon={ClipboardList} />
        <InfoCard title="Dalam Perjalanan" value={String(inTransitCount)} detail="Aktif" icon={Truck} color="bg-blue-600" />
        <InfoCard title="Selesai" value={String(completedCount)} detail="Diterima" icon={CheckCircle2} />
        <InfoCard title="Bermasalah" value={String(problemCount)} detail="Perlu tindak lanjut" icon={AlertTriangle} color="bg-red-500" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <FilterBar search={search} onSearch={value => { setSearch(value); setPage(1); }}>
          <select value={kordaFilter} onChange={event => { setKordaFilter(event.target.value); setPage(1); }} className={`${inputClass} w-auto`}>
            <option value="">Semua KORDA</option>
            {toOptions(activeRows(kordas)).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }} className={`${inputClass} w-auto`}>
            <option value="">Semua status</option>
            {SHIPMENT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={event => { setDateFrom(event.target.value); setPage(1); }} className={`${inputClass} w-auto`} aria-label="Tanggal dari" />
          <input type="date" value={dateTo} onChange={event => { setDateTo(event.target.value); setPage(1); }} className={`${inputClass} w-auto`} aria-label="Tanggal sampai" />
        </FilterBar>
        <DataTable
          columns={[...shipmentTableColumns, ...columns]}
          rows={pageRows}
          rowKey={row => row.id}
          headerGroups={LOGISTICS_HEADER_GROUPS}
          indexOffset={(currentPage - 1) * 10}
          emptyLabel={shipments.length === 0 ? (isDriver ? 'Belum ada pengiriman yang ditugaskan kepada Anda.' : 'Belum ada data pengiriman.') : 'Tidak ada pengiriman yang cocok dengan filter.'}
        />
        {filteredShipments.length > 10 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">Halaman {currentPage} dari {totalPages} · {filteredShipments.length} pengiriman</p>
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
        <Modal title={form.id ? 'Ubah Pengiriman' : 'Buat Pengiriman Baru'} onClose={() => setForm(null)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">No. Pengiriman</label>
              <input readOnly value={form.shipmentNumber} className={`${inputClass} bg-slate-100`} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Barang dari Master (opsional)</label>
                <select value={form.itemId} onChange={event => {
                  const item = products.find(product => product.id === event.target.value);
                  updateForm({ itemId: event.target.value, itemName: item?.name || '', unit: item?.unit || '' });
                }} className={inputClass}>
                  <option value="">Pilih barang</option>
                  {products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">NAMA BARANG</label>
                <input required value={form.itemName} onChange={event => updateForm({ itemName: event.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">VOL</label>
                <input required type="number" min="0.01" step="any" value={form.quantity} onChange={event => updateForm({ quantity: event.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">SATUAN</label>
                <input required value={form.unit} onChange={event => updateForm({ unit: event.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">DARI KORDA</label>
                <input required value={form.senderFromRegion} onChange={event => updateForm({ senderFromRegion: event.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">KORDA TUJUAN</label>
                <select required value={form.kordaId} onChange={event => updateForm({ kordaId: event.target.value })} className={inputClass}>
                  <option value="">Pilih KORDA</option>
                  {toOptions(activeRows(kordas)).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">RENCANA KIRIM</label>
                <input required type="number" min="0.01" step="any" value={form.plannedQuantity} onChange={event => updateForm({ plannedQuantity: event.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">STATUS / SUDAH/BELUM</label>
                <select value={form.status} onChange={event => updateForm({ status: event.target.value as ShipmentStatus })} className={inputClass}>
                  {SHIPMENT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-500">Tampilan tabel: {form.status === 'Belum dikirim' ? 'Belum' : 'Sudah'}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">TANGGAL</label>
                <input required type="date" value={form.shipmentDate} onChange={event => updateForm({ shipmentDate: event.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Driver</label>
                <select required value={form.driverId} onChange={event => {
                  const driver = users.find(user => user.uid === event.target.value);
                  updateForm({ driverId: event.target.value, driverName: driver?.displayName || '' });
                }} className={inputClass}>
                  <option value="">Pilih driver</option>
                  {drivers.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">NAMA PENGIRIM</label>
                <input required value={form.senderName} onChange={event => updateForm({ senderName: event.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">NAMA PENERIMA</label>
                <input required value={form.receiverName} onChange={event => updateForm({ receiverName: event.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">TEMPAT PENYIMPANAN</label>
              <input required value={form.storageLocation} onChange={event => updateForm({ storageLocation: event.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Catatan</label>
              <textarea rows={3} value={form.notes} onChange={event => updateForm({ notes: event.target.value })} className={inputClass} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setForm(null)} className={secondaryButtonClass}>Batal</button>
              <button type="submit" className={primaryButtonClass}>Simpan Pengiriman</button>
            </div>
          </form>
        </Modal>
      )}

      {detailTarget && (
        <Modal title={`Detail Pengiriman ${detailTarget.shipmentNumber}`} onClose={() => setDetailTarget(null)} wide>
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailField label="NAMA BARANG" value={detailTarget.itemName || '-'} />
              <DetailField label="VOL" value={toNumber(detailTarget.quantity).toLocaleString('id-ID')} />
              <DetailField label="SATUAN" value={detailTarget.unit || '-'} />
              <DetailField label="DARI KORDA" value={detailTarget.senderFromRegion || '-'} />
              <DetailField label="RENCANA KIRIM" value={toNumber(detailTarget.plannedQuantity).toLocaleString('id-ID')} />
              <DetailField label="STATUS / SUDAH/BELUM" value={shipmentSentStatus(detailTarget)} />
              <DetailField label="STATUS / TANGGAL" value={displayDate(detailTarget.shipmentDate)} />
              <DetailField label="NAMA PENGIRIM" value={detailTarget.senderName || '-'} />
              <DetailField label="NAMA PENERIMA" value={detailTarget.receiverName || '-'} />
              <DetailField label="TEMPAT PENYIMPANAN" value={detailTarget.storageLocation || '-'} />
              <DetailField label="KORDA TUJUAN" value={detailTarget.kordaName || '-'} />
              <DetailField label="DRIVER" value={detailTarget.driverName || '-'} />
              <DetailField label="STATUS PENGIRIMAN" value={detailTarget.status} />
              <DetailField label="DITERIMA" value={toNumber(detailTarget.receivedQuantity).toLocaleString('id-ID')} />
            </div>
            {detailTarget.notes && (
              <div className="pt-4 border-t border-slate-200">
                <DetailField label="CATATAN" value={detailTarget.notes} />
              </div>
            )}
            {detailTarget.proofPhotos?.length ? (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200">
                {detailTarget.proofPhotos.map((url, index) => (
                  <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="Bukti pengiriman" className="w-16 h-16 object-cover rounded-xl border border-slate-200" />
                  </a>
                ))}
              </div>
            ) : null}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setDetailTarget(null)} className={secondaryButtonClass}>Tutup</button>
            </div>
          </div>
        </Modal>
      )}

      {driverForm && (
        <Modal title="Perbarui Pengiriman" onClose={() => setDriverForm(null)}>
          <form onSubmit={handleDriverUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Status Pengiriman</label>
              <select value={driverForm.status} onChange={event => updateDriverForm({ status: event.target.value as ShipmentStatus })} className={inputClass}>
                {SHIPMENT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Jumlah Diterima</label>
              <input required type="number" min="0.01" step="any" value={driverForm.receivedQuantity} onChange={event => updateDriverForm({ receivedQuantity: event.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Catatan Kekurangan</label>
              <textarea rows={3} value={driverForm.shortageNote} onChange={event => updateDriverForm({ shortageNote: event.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Catatan Kerusakan</label>
              <textarea rows={3} value={driverForm.damageNote} onChange={event => updateDriverForm({ damageNote: event.target.value })} className={inputClass} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setDriverForm(null)} className={secondaryButtonClass}>Batal</button>
              <button type="submit" className={primaryButtonClass}>Simpan Pembaruan</button>
            </div>
          </form>
        </Modal>
      )}

      {receiptForm && (
        <Modal title="Konfirmasi Penerimaan" onClose={() => setReceiptForm(null)}>
          <form onSubmit={handleReceipt} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Status Penerimaan</label>
              <select value={receiptForm.status} onChange={event => {
                const value = event.target.value;
                if (value === 'Selesai' || value === 'Diterima sebagian') updateReceiptForm({ status: value });
              }} className={inputClass}>
                {RECEIPT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Jumlah Diterima</label>
              <input required type="number" min="0.01" step="any" value={receiptForm.receivedQuantity} onChange={event => updateReceiptForm({ receivedQuantity: event.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Catatan Kekurangan</label>
              <textarea rows={3} value={receiptForm.shortageNote} onChange={event => updateReceiptForm({ shortageNote: event.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Catatan Kerusakan</label>
              <textarea rows={3} value={receiptForm.damageNote} onChange={event => updateReceiptForm({ damageNote: event.target.value })} className={inputClass} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setReceiptForm(null)} className={secondaryButtonClass}>Batal</button>
              <button type="submit" className={primaryButtonClass}>Konfirmasi</button>
            </div>
          </form>
        </Modal>
      )}

      {uploadTarget && (
        <Modal title={`Unggah Bukti ${uploadTarget.shipmentNumber}`} onClose={() => { setUploadTarget(null); setUploadFile(null); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Foto Bukti</label>
              <input type="file" accept="image/*" onChange={event => setUploadFile(event.target.files?.[0] || null)} className={inputClass} />
            </div>
            {uploadTarget.proofPhotos?.length ? (
              <div className="flex flex-wrap gap-2">
                {uploadTarget.proofPhotos.map((url, index) => (
                  <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="Bukti pengiriman" className="w-16 h-16 object-cover rounded-xl border border-slate-200" />
                  </a>
                ))}
              </div>
            ) : <p className="text-xs text-slate-500">Belum ada bukti foto untuk pengiriman ini.</p>}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => { setUploadTarget(null); setUploadFile(null); }} className={secondaryButtonClass}>Batal</button>
              <button type="button" disabled={!uploadFile} onClick={() => void handleUpload()} className={primaryButtonClass}>Unggah Bukti</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus pengiriman ${deleteTarget.shipmentNumber}?`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleDelete()}
        />
      )}

      {loading && !processing && <LoadingOverlay label="Memuat data pengiriman..." />}
      {processing && <LoadingOverlay label={processing} />}
      {exporting && <LoadingOverlay label="Mengekspor data pengiriman..." />}
      <Toast message={toast.message} kind={toast.kind} onClose={() => setToast({ message: '', kind: 'success' })} />
    </div>
  );
};
