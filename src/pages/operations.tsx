import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  ClipboardList,
  Plus,
  Search,
  Send,
  Truck,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AlertBox, LoadingOverlay, PageHeader, StatusBadge } from '../components/ui';
import { ResourceManager, type ResourceField } from '../components/ResourceManager';
import { DataTable } from '../components/DataViews';
import { getUsers, updateUserRoleAndStatus } from '../services/rbacService';
import {
  asNumber,
  deleteRow,
  formatDate,
  getRows,
  newId,
  patchRow,
  saveRow,
  today,
  type DataRow,
} from '../services/logisticsService';
import type { UserProfile } from '../types';
import { ACTION_DELAY_MS, wait } from '../utils/async';
import { createStockTransaction } from '../services/logitrackService';

function parseItems(text: string, products: DataRow[]): { productId: string; productName: string; requestedQty: number; unit: string }[] {
  const result: { productId: string; productName: string; requestedQty: number; unit: string }[] = [];
  const parts = text.split(/[\n,]+/).map(part => part.trim()).filter(Boolean);
  for (const part of parts) {
    const separator = part.lastIndexOf(':');
    const rawName = (separator >= 0 ? part.slice(0, separator) : part).trim();
    const rawQty = separator >= 0 ? part.slice(separator + 1).trim() : '';
    const quantity = Number(rawQty || 1);
    if (!rawName || !Number.isFinite(quantity) || quantity <= 0) continue;

    const needle = rawName.toLowerCase();
    const product = products.find(item => String(item.name || '').trim().toLowerCase() === needle)
      || products.find(item => String(item.name || '').trim().toLowerCase().includes(needle))
      || products.find(item => String(item.id || '').toLowerCase() === needle);
    if (!product) continue;

    result.push({
      productId: String(product.id),
      productName: product.name,
      requestedQty: quantity,
      unit: product.unit,
    });
  }
  return result;
}

export const KitchenRequestsPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const [rows, setRows] = useState<DataRow[]>([]);
  const [details, setDetails] = useState<DataRow[]>([]);
  const [products, setProducts] = useState<DataRow[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<DataRow | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState('');

  const load = useCallback(async () => {
    try {
      const [requestRows, detailRows, productRows] = await Promise.all([
        getRows('requests'),
        getRows('request_details'),
        getRows('products'),
      ]);
      setRows(requestRows.sort((a, b) => String(b.requestNumber).localeCompare(String(a.requestNumber))));
      setDetails(detailRows);
      setProducts(productRows);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat permintaan dapur');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fulfillRequest = async (request: DataRow) => {
    const items = details.filter(item => item.requestId === request.id);
    for (const item of items) {
      const quantity = asNumber(item.approvedQty ?? item.requestedQty);
      const product = products.find(productRow => productRow.id === item.productId);
      if (product) {
        await createStockTransaction({
          type: 'OUT',
          date: today(),
          itemId: product.id,
          itemName: product.name,
          categoryId: product.categoryId || '',
          categoryName: product.categoryName || '',
          quantity,
          unit: product.unit,
          source: request.requesterDepartment || 'Dapur',
          receiverName: request.requesterName || request.requesterDepartment || '',
          senderName: currentUser?.displayName || '',
          referenceType: 'kitchen_request',
          referenceId: request.id,
          notes: `Permintaan ${request.requestNumber}`,
          status: 'Confirmed',
        }, currentUser);
      }
      const batches = await getRows('stock_batches');
      let remaining = quantity;
      const sorted = batches
        .filter(batch => batch.productId === item.productId && asNumber(batch.quantity) > 0)
        .sort((a, b) => String(a.expiredDate).localeCompare(String(b.expiredDate)));
      for (const batch of sorted) {
        if (remaining <= 0) break;
        const deduction = Math.min(remaining, asNumber(batch.quantity));
        await patchRow('stock_batches', batch.id, { quantity: asNumber(batch.quantity) - deduction }, currentUser);
        remaining -= deduction;
      }
      await saveRow('stock_movements', {
        id: newId('mov'),
        productId: item.productId,
        productName: item.productName,
        type: 'OUT',
        quantity,
        referenceId: request.id,
        date: today(),
        createdAt: new Date(),
      }, currentUser);
    }
    await saveRow('stock_out', {
      id: newId('out'),
      stockOutNumber: `OUT-${request.requestNumber}`,
      productId: items[0]?.productId || '',
      productName: items[0]?.productName || '',
      quantity: items.reduce((sum, item) => sum + asNumber(item.approvedQty ?? item.requestedQty), 0),
      date: today(),
      destination: request.requesterDepartment || 'Dapur',
      notes: `Permintaan ${request.requestNumber}`,
      createdBy: currentUser?.uid || '',
      createdAt: new Date(),
    }, currentUser);
  };

  const changeStatus = async (row: DataRow, status: string, extra: DataRow = {}) => {
    setError('');
    setSuccess('');
    setProcessing('Memperbarui permintaan...');
    try {
      await wait(ACTION_DELAY_MS);
      await patchRow('requests', row.id, { status, ...extra, updatedAt: new Date() }, currentUser);
      if (status === 'Approved') {
        await Promise.all(details
          .filter(item => item.requestId === row.id)
          .map(item => patchRow('request_details', item.id, { approvedQty: asNumber(item.requestedQty) }, currentUser)));
      }
      if (status === 'Processing') await fulfillRequest(row);
      setSuccess(`Permintaan ${row.requestNumber} diperbarui menjadi ${status}.`);
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal memperbarui permintaan');
    } finally {
      setProcessing('');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setError('');
    setProcessing('Menyimpan permintaan...');
    try {
      await wait(ACTION_DELAY_MS);
      const items = parseItems(String(form.itemsText || ''), products);
      if (items.length === 0) throw new Error('Tambahkan minimal satu nama bahan/barang yang sesuai master data. Format: nama:jumlah (jumlah opsional).');
      const request = await saveRow('requests', {
        id: newId('req'),
        requestNumber: form.requestNumber || `REQ-${String(Date.now()).slice(-4)}`,
        requesterName: form.requesterName,
        requesterDepartment: form.requesterDepartment,
        notes: form.notes || '',
        status: 'Pending',
        createdAt: new Date(),
      }, currentUser);
      await Promise.all(items.map(item => saveRow('request_details', {
        id: newId('rd'),
        requestId: request.id,
        ...item,
        approvedQty: 0,
      }, currentUser)));
      setForm(null);
      setSuccess('Permintaan dapur berhasil dibuat.');
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal membuat permintaan');
    } finally {
      setProcessing('');
    }
  };

  const handleDelete = async (row: DataRow) => {
    if (!window.confirm(`Hapus permintaan ${row.requestNumber}?`)) return;
    setProcessing('Menghapus permintaan...');
    try {
      await wait(ACTION_DELAY_MS);
      const related = details.filter(item => item.requestId === row.id);
      await Promise.all(related.map(item => deleteRow('request_details', item.id, currentUser)));
      await deleteRow('requests', row.id, currentUser);
      await load();
    } finally {
      setProcessing('');
    }
  };

  const visibleRows = rows.filter(row =>
    !search.trim() || [row.requestNumber, row.requesterName, row.requesterDepartment, row.status]
      .some(value => String(value ?? '').toLowerCase().includes(search.toLowerCase())));

  const productHint = products.slice(0, 6).map(product => `${product.name}: 1`).join(', ');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permintaan Dapur"
        description="Buat permintaan bahan makanan, setujui oleh Manager, lalu proses oleh Staf Gudang."
        icon={ClipboardList}
        action={hasPermission('requests.create') ? (
          <button onClick={() => setForm({ requestNumber: `REQ-${String(Date.now()).slice(-4)}`, requesterName: currentUser?.displayName || '', requesterDepartment: '', notes: '', itemsText: '' })} className="inline-flex items-center px-4 py-2.5 bg-emerald-700 text-white font-semibold rounded-xl text-sm hover:bg-emerald-800 shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Buat Permintaan
          </button>
        ) : undefined}
      />
      <AlertBox message={error} onClose={() => setError('')} />
      <AlertBox message={success} kind="success" onClose={() => setSuccess('')} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nomor atau peminta..." className="flex-1 min-w-0 text-sm focus:outline-hidden text-slate-800" />
        </div>
        <DataTable<DataRow>
          columns={[
            {
              key: 'requestNo',
              label: 'No. Permintaan',
              render: row => <span className="font-medium text-slate-800">{row.requestNo || '-'}</span>,
            },
            {
              key: 'requestedBy',
              label: 'Peminta',
              render: row => <span>{row.requestedBy || '-'}</span>,
            },
            {
              key: 'department',
              label: 'Departemen',
              render: row => <span>{row.department || '-'}</span>,
            },
            {
              key: 'itemName',
              label: 'Nama Bahan/Barang',
              render: row => <span>{row.itemName || '-'}</span>,
            },
            {
              key: 'quantity',
              label: 'Jumlah Bahan/Barang',
              render: row => <span>{row.quantity ?? '-'}</span>,
            },
            {
              key: 'status',
              label: 'Status',
              render: row => <StatusBadge value={row.status} />,
            },
            {
              key: 'createdAt',
              label: 'Tanggal',
              filterable: false,
              render: row => <span className="text-xs text-slate-500">{formatDate(row.createdAt)}</span>,
            },
            {
              key: 'actions',
              label: 'Aksi',
              filterable: false,
              render: row => (
                <div className="flex items-center justify-end gap-1">
                  {row.status === 'Pending' && hasPermission('requests.approve') && (
                    <button onClick={() => void changeStatus(row, 'Approved', { approvedBy: currentUser?.uid, approvedAt: new Date() })} className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg" title="Setujui"><Check className="w-4 h-4" /></button>
                  )}
                  {row.status === 'Pending' && hasPermission('requests.reject') && (
                    <button onClick={() => {
                      const reason = window.prompt('Alasan penolakan:');
                      if (reason) void changeStatus(row, 'Rejected', { rejectedReason: reason });
                    }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Tolak"><X className="w-4 h-4" /></button>
                  )}
                  {row.status === 'Approved' && hasPermission('requests.create') && (
                    <button onClick={() => void changeStatus(row, 'Processing')} className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">Proses</button>
                  )}
                  {row.status === 'Processing' && (hasPermission('requests.create') || hasPermission('requests.approve')) && (
                    <button onClick={() => void changeStatus(row, 'Completed')} className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">Selesai</button>
                  )}
                  {hasPermission('requests.delete') && (
                    <button onClick={() => void handleDelete(row)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Hapus">×</button>
                  )}
                </div>
              ),
            },
          ]}
          rows={visibleRows}
          rowKey={row => String(row.id)}
          selectable={false}
          emptyLabel="Belum ada permintaan."
        />
      </div>

      {form && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between gap-3">
              <h3 className="text-base sm:text-lg font-bold text-slate-800">Buat Permintaan Dapur</h3>
              <button onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">No. Permintaan</label>
                  <input required value={form.requestNumber || ''} onChange={event => setForm({ ...form, requestNumber: event.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Departemen</label>
                  <input required value={form.requesterDepartment || ''} onChange={event => setForm({ ...form, requesterDepartment: event.target.value })} placeholder="Dapur Putra" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Nama Peminta</label>
                <input required value={form.requesterName || ''} onChange={event => setForm({ ...form, requesterName: event.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Nama Bahan/Barang (format: nama:jumlah)</label>
                <textarea required rows={4} value={form.itemsText || ''} onChange={event => setForm({ ...form, itemsText: event.target.value })} placeholder={productHint} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                <p className="text-[11px] text-slate-500 mt-1">Contoh: {productHint}. Jumlah boleh kosong (default 1).</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Catatan</label>
                <textarea rows={2} value={form.notes || ''} onChange={event => setForm({ ...form, notes: event.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm">Batal</button>
                <button type="submit" className="px-5 py-2 bg-emerald-700 text-white rounded-xl text-sm font-semibold">Kirim Permintaan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {processing && <LoadingOverlay label={processing} />}
    </div>
  );
};

export const DeliveriesPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const isDriver = currentUser?.role === 'Driver';
  const [rows, setRows] = useState<DataRow[]>([]);
  const [requests, setRequests] = useState<DataRow[]>([]);
  const [details, setDetails] = useState<DataRow[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [vehicles, setVehicles] = useState<DataRow[]>([]);
  const [form, setForm] = useState<DataRow | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState('');

  const load = useCallback(async () => {
    try {
      const [deliveryRows, requestRows, detailRows, vehicleRows, userRows] = await Promise.all([
        getRows('deliveries'),
        getRows('requests'),
        getRows('delivery_details'),
        getRows('vehicles'),
        getUsers(),
      ]);
      setRows(isDriver ? deliveryRows.filter(row => row.driverId === currentUser?.uid) : deliveryRows);
      setRequests(requestRows);
      setDetails(detailRows);
      setVehicles(vehicleRows);
      setUsers(userRows);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat pengiriman');
    }
  }, [currentUser?.uid, isDriver]);

  useEffect(() => {
    void load();
  }, [load]);

  const drivers = users.filter(user => user.role === 'Driver' && user.isActive);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setError('');
    setProcessing('Menyimpan pengiriman...');
    try {
      await wait(ACTION_DELAY_MS);
      const driver = drivers.find(user => user.uid === form.driverId);
      const delivery = await saveRow('deliveries', {
        id: newId('del'),
        deliveryNumber: form.deliveryNumber,
        requestId: form.requestId,
        driverId: form.driverId,
        driverName: driver?.displayName || '',
        vehicleNumber: form.vehicleNumber,
        status: 'Assigned',
        shippingDate: form.shippingDate,
        notes: form.notes || '',
        createdAt: new Date(),
      }, currentUser);
      const requestItems = details.filter(item => item.requestId === form.requestId);
      await Promise.all(requestItems.map(item => saveRow('delivery_details', {
        id: newId('dd'),
        deliveryId: delivery.id,
        productId: item.productId,
        productName: item.productName,
        quantity: asNumber(item.approvedQty ?? item.requestedQty),
        unit: item.unit,
      }, currentUser)));
      setForm(null);
      setSuccess(`Tugas pengiriman ${delivery.deliveryNumber} dibuat.`);
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal membuat pengiriman');
    } finally {
      setProcessing('');
    }
  };

  const updateStatus = async (row: DataRow, patch: DataRow) => {
    setError('');
    setSuccess('');
    setProcessing('Memperbarui status pengiriman...');
    try {
      await wait(ACTION_DELAY_MS);
      await patchRow('deliveries', row.id, { ...patch, updatedAt: new Date() }, currentUser);
      setSuccess(`Status pengiriman ${row.deliveryNumber} diperbarui.`);
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal memperbarui pengiriman');
    } finally {
      setProcessing('');
    }
  };

  const handleDelete = async (row: DataRow) => {
    if (!window.confirm(`Hapus pengiriman ${row.deliveryNumber}?`)) return;
    setProcessing('Menghapus pengiriman...');
    try {
      await wait(ACTION_DELAY_MS);
      const related = details.filter(item => item.deliveryId === row.id);
      await Promise.all(related.map(item => deleteRow('delivery_details', item.id, currentUser)));
      await deleteRow('deliveries', row.id, currentUser);
      await load();
    } finally {
      setProcessing('');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengiriman"
        description={isDriver ? 'Lihat tugas pengiriman Anda dan perbarui statusnya.' : 'Tugaskan driver, pantau status pengiriman, dan konfirmasi penerimaan.'}
        icon={Send}
        action={hasPermission('deliveries.create') ? (
          <button onClick={() => setForm({ deliveryNumber: `DEL-${String(Date.now()).slice(-4)}`, requestId: '', driverId: '', vehicleNumber: '', shippingDate: today(), notes: '' })} className="inline-flex items-center px-4 py-2.5 bg-emerald-700 text-white font-semibold rounded-xl text-sm hover:bg-emerald-800 shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Buat Tugas
          </button>
        ) : undefined}
      />
      <AlertBox message={error} onClose={() => setError('')} />
      <AlertBox message={success} kind="success" onClose={() => setSuccess('')} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable<DataRow>
          columns={[
            {
              key: 'deliveryNo',
              label: 'No. Pengiriman',
              render: row => <span className="font-medium text-slate-800">{row.deliveryNo || '-'}</span>,
            },
            {
              key: 'requestNo',
              label: 'Permintaan',
              render: row => <span>{row.requestNo || '-'}</span>,
            },
            {
              key: 'driverName',
              label: 'Driver',
              render: row => <span>{row.driverName || '-'}</span>,
            },
            {
              key: 'vehicle',
              label: 'Kendaraan',
              render: row => <span>{row.vehicle || '-'}</span>,
            },
            {
              key: 'deliveryDate',
              label: 'Tanggal',
              filterable: false,
              render: row => <span className="text-xs text-slate-500">{formatDate(row.deliveryDate)}</span>,
            },
            {
              key: 'status',
              label: 'Status',
              render: row => <StatusBadge value={row.status} />,
            },
            {
              key: 'actions',
              label: 'Aksi',
              filterable: false,
              render: row => (
                <div className="flex items-center justify-end gap-1">
                  {(hasPermission('deliveries.update') || row.driverId === currentUser?.uid) && row.status === 'Assigned' && (
                    <button onClick={() => void updateStatus(row, { status: 'On Delivery' })} className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">Berangkat</button>
                  )}
                  {(hasPermission('deliveries.update') || row.driverId === currentUser?.uid) && row.status === 'On Delivery' && (
                    <button onClick={() => {
                      const proof = window.prompt('URL bukti pengiriman (opsional):') || '';
                      void updateStatus(row, { status: 'Delivered', proofImageUrl: proof, deliveredAt: new Date() });
                    }} className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">Sampai</button>
                  )}
                  {hasPermission('deliveries.complete') && row.status === 'Delivered' && (
                    <button onClick={() => void updateStatus(row, { status: 'Confirmed' })} className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">Konfirmasi</button>
                  )}
                  {hasPermission('deliveries.delete') && (
                    <button onClick={() => void handleDelete(row)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Hapus">×</button>
                  )}
                </div>
              ),
            },
          ]}
          rows={rows}
          rowKey={row => String(row.id)}
          selectable={false}
          emptyLabel="Belum ada pengiriman."
        />
      </div>

      {form && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between gap-3">
              <h3 className="text-base sm:text-lg font-bold text-slate-800">Buat Tugas Pengiriman</h3>
              <button onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">No. Pengiriman</label>
                <input required value={form.deliveryNumber || ''} onChange={event => setForm({ ...form, deliveryNumber: event.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Permintaan</label>
                  <select required value={form.requestId || ''} onChange={event => setForm({ ...form, requestId: event.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                    <option value="">Pilih permintaan</option>
                    {requests.filter(item => ['Approved', 'Processing'].includes(item.status)).map(item => <option key={item.id} value={item.id}>{item.requestNumber} - {item.requesterDepartment}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Driver</label>
                  <select required value={form.driverId || ''} onChange={event => setForm({ ...form, driverId: event.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                    <option value="">Pilih driver</option>
                    {drivers.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Kendaraan</label>
                  <select required value={form.vehicleNumber || ''} onChange={event => setForm({ ...form, vehicleNumber: event.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                    <option value="">Pilih kendaraan</option>
                    {vehicles.filter(item => item.isActive).map(item => <option key={item.id} value={item.plateNumber}>{item.plateNumber} - {item.type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Tanggal Kirim</label>
                  <input required type="date" value={form.shippingDate || ''} onChange={event => setForm({ ...form, shippingDate: event.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Catatan</label>
                <textarea rows={2} value={form.notes || ''} onChange={event => setForm({ ...form, notes: event.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm">Batal</button>
                <button type="submit" className="px-5 py-2 bg-emerald-700 text-white rounded-xl text-sm font-semibold">Simpan Tugas</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {processing && <LoadingOverlay label={processing} />}
    </div>
  );
};

export const DriversPage: React.FC = () => {
  const { currentUser, refreshUserData } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [deliveries, setDeliveries] = useState<DataRow[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState('');

  const load = useCallback(async () => {
    try {
      const [userRows, deliveryRows] = await Promise.all([getUsers(), getRows('deliveries')]);
      setUsers(userRows);
      setDeliveries(deliveryRows);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat data driver');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const assignDriver = async (user: UserProfile) => {
    if (!currentUser || currentUser.role !== 'Super Admin') return;
    setError('');
    setProcessing('Menetapkan driver...');
    try {
      await wait(ACTION_DELAY_MS);
      await updateUserRoleAndStatus(user.uid, 'Driver', true, currentUser);
      setSuccess(`${user.displayName} sekarang berperan sebagai Driver.`);
      await refreshUserData();
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal menetapkan driver');
    } finally {
      setProcessing('');
    }
  };

  const vehicleFields: ResourceField[] = [
    { key: 'plateNumber', label: 'Nomor Plat', required: true },
    { key: 'type', label: 'Jenis Kendaraan', required: true },
    { key: 'capacity', label: 'Kapasitas', required: true },
    { key: 'driverId', label: 'Driver', type: 'select', options: users.filter(user => user.role === 'Driver').map(user => ({ value: user.uid, label: user.displayName })) },
    { key: 'isActive', label: 'Status', type: 'select', options: [{ value: 'true', label: 'Aktif' }, { value: 'false', label: 'Nonaktif' }] },
  ];

  const driverUsers = users.filter(user => user.role === 'Driver');

  return (
    <div className="space-y-6">
      <PageHeader title="Data Driver & Kendaraan" description="Pantau driver aktif, jumlah tugas, dan kelola armada kendaraan pengiriman." icon={UserCheck} />
      <AlertBox message={error} onClose={() => setError('')} />
      <AlertBox message={success} kind="success" onClose={() => setSuccess('')} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {driverUsers.map(user => (
          <div key={user.uid} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">{user.displayName}</p>
                <p className="text-xs text-slate-500">{user.phoneNumber || user.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="inline-flex items-center"><Truck className="w-4 h-4 mr-1 text-emerald-600" /> {deliveries.filter(item => item.driverId === user.uid).length} pengiriman</span>
              <StatusBadge value={user.isActive ? 'Aktif' : 'Nonaktif'} />
            </div>
          </div>
        ))}
      </div>

      {currentUser?.role === 'Super Admin' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <h3 className="font-bold text-slate-800 mb-3 text-sm">Tetapkan Pengguna sebagai Driver</h3>
          <div className="flex flex-wrap gap-2">
            {users.filter(user => user.role !== 'Driver' && user.uid !== currentUser.uid).map(user => (
              <button key={user.uid} onClick={() => void assignDriver(user)} className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-xl">
                + {user.displayName}
              </button>
            ))}
          </div>
        </div>
      )}

      <ResourceManager
        title="Armada Kendaraan"
        description="Kelola data kendaraan dan penugasan driver."
        collection="vehicles"
        icon={Truck}
        permissions={{ view: 'vehicles.view', create: 'vehicles.create', edit: 'vehicles.edit', delete: 'vehicles.delete' }}
        fields={vehicleFields}
        columns={['plateNumber', 'type', 'capacity', 'driverName', 'isActive']}
        columnLabels={{ plateNumber: 'Plat', type: 'Jenis', capacity: 'Kapasitas', driverName: 'Driver', isActive: 'Status' }}
        initialRow={() => ({ isActive: 'true', createdAt: new Date() })}
        transform={row => ({
          ...row,
          isActive: row.isActive === 'false' ? false : true,
          driverName: users.find(user => user.uid === row.driverId)?.displayName || '',
        })}
      />

      {processing && <LoadingOverlay label={processing} />}
    </div>
  );
};
