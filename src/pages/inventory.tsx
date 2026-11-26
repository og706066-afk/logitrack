import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Tags, Truck, Warehouse, Plus } from 'lucide-react';
import { ResourceManager, type ResourceField } from '../components/ResourceManager';
import { AlertBox, ConfirmDialog, LoadingOverlay, PageHeader, StatusBadge } from '../components/ui';
import { DataTable, FilterBar, Modal, Toast, inputClass, primaryButtonClass, secondaryButtonClass } from '../components/DataViews';
import { ExcelImportButton, type ExcelImportField } from '../components/ExcelImport';
import { useAuth } from '../contexts/AuthContext';
import { getRows, today, type DataRow } from '../services/logisticsService';
import { createItem, getCollection, nextNumber, removeDocument, toNumber, updateItem } from '../services/logitrackService';
import type { Item } from '../types/logitrack';

function toOptions(rows: DataRow[], labelKey = 'name'): { value: string; label: string }[] {
  return rows.map(row => ({ value: row.id, label: String(row[labelKey] ?? row.id) }));
}

const productImportFields: ExcelImportField[] = [
  { key: 'code', label: 'Kode Barang', aliases: ['code', 'kode', 'kode barang', 'sku'] },
  { key: 'name', label: 'Nama Barang', required: true, aliases: ['name', 'nama', 'nama barang', 'nama bahan'] },
  { key: 'category', label: 'Kategori', aliases: ['category', 'kategori', 'nama kategori'] },
  { key: 'unit', label: 'Satuan', required: true, aliases: ['unit', 'satuan'] },
  { key: 'initialStock', label: 'Stok Awal', aliases: ['initial stock', 'stok awal', 'stok saat ini', 'qty', 'jumlah'] },
  { key: 'minStock', label: 'Stok Minimum', aliases: ['min stock', 'stok minimum', 'min'] },
  { key: 'warehouse', label: 'Gudang', aliases: ['warehouse', 'gudang', 'lokasi'] },
  { key: 'description', label: 'Deskripsi', aliases: ['description', 'deskripsi', 'keterangan'] },
];

export const CategoriesPage: React.FC = () => {
  const fields: ResourceField[] = [
    { key: 'name', label: 'Nama Kategori', required: true, placeholder: 'Contoh: Minyak & Bumbu' },
    { key: 'description', label: 'Deskripsi', type: 'textarea' },
  ];

  return (
    <ResourceManager
      title="Manajemen Kategori"
      description="Kelola kategori bahan makanan yang digunakan untuk mengelompokkan stok gudang."
      collection="categories"
      icon={Tags}
      permissions={{ view: 'categories.view', create: 'categories.create', edit: 'categories.edit', delete: 'categories.delete' }}
      fields={fields}
      columns={['name', 'description']}
      columnLabels={{ name: 'Nama Kategori', description: 'Deskripsi' }}
      initialRow={() => ({ createdAt: new Date() })}
      transform={row => ({ ...row, name: String(row.name || '').trim() })}
      validate={(row, rows) => {
        if (!row.name) return 'Nama kategori wajib diisi.';
        if (rows.some(item => item.id !== row.id && String(item.name).toLowerCase() === String(row.name).toLowerCase())) {
          return 'Nama kategori sudah digunakan.';
        }
        return null;
      }}
    />
  );
};

export const ProductsPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<DataRow[]>([]);
  const [warehouses, setWarehouses] = useState<DataRow[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Partial<Item> | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canCreate = hasPermission('items.create') || hasPermission('products.create');
  const canEdit = hasPermission('items.edit') || hasPermission('products.edit');
  const canDelete = hasPermission('items.delete') || hasPermission('products.delete') || canCreate;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemRows, categoryRows, warehouseRows] = await Promise.all([
        getCollection<Item>('products'),
        getCollection<DataRow>('categories'),
        getCollection<DataRow>('warehouses'),
      ]);
      setItems(itemRows);
      setCategories(categoryRows);
      setWarehouses(warehouseRows);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat master barang.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter(item => {
      if (categoryFilter && item.categoryId !== categoryFilter) return false;
      if (stockFilter === 'low' && item.currentStock > item.minStock) return false;
      if (stockFilter === 'empty' && item.currentStock > 0) return false;
      return !needle || [item.code, item.name, item.unit, item.categoryName, item.warehouseName]
        .some(value => String(value ?? '').toLowerCase().includes(needle));
    });
  }, [items, search, categoryFilter, stockFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const visible = filtered.slice((Math.min(page, totalPages) - 1) * 10, Math.min(page, totalPages) * 10);

  const openCreate = async () => {
    setError('');
    setForm({
      code: await nextNumber('products', 'BRG'),
      name: '',
      categoryId: '',
      categoryName: '',
      description: '',
      unit: 'Pcs',
      initialStock: 0,
      currentStock: 0,
      minStock: 0,
      warehouseId: '',
      warehouseName: '',
      itemStatus: 'Aktif',
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (!String(form.name || '').trim() || !form.categoryId || !String(form.unit || '').trim()) {
        throw new Error('Nama, kategori, dan satuan wajib diisi.');
      }
      if (toNumber(form.currentStock) < 0 || toNumber(form.minStock) < 0 || toNumber(form.initialStock) < 0) {
        throw new Error('Stok tidak boleh negatif.');
      }
      if (items.some(item => item.id !== form.id && String(item.name).toLowerCase() === String(form.name).toLowerCase())) {
        throw new Error('Nama barang sudah digunakan.');
      }
      const payload = {
        ...form,
        categoryName: categories.find(row => row.id === form.categoryId)?.name || form.categoryName || '',
        warehouseName: warehouses.find(row => row.id === form.warehouseId)?.name || form.warehouseName || '',
        initialStock: form.id ? toNumber(form.initialStock) : toNumber(form.currentStock),
        status: form.itemStatus || 'Aktif',
      };
      if (form.id) await updateItem(form.id, payload, currentUser);
      else await createItem(payload, currentUser);
      setSuccess('Master barang berhasil disimpan.');
      setForm(null);
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan master barang.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteIds.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(deleteIds.map(id => removeDocument('products', id, currentUser, 'Master Barang')));
      setSuccess(deleteIds.length === 1 ? 'Barang berhasil dihapus.' : `${deleteIds.length} barang berhasil dihapus.`);
      setDeleteIds([]);
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal menghapus barang.');
      setDeleteIds([]);
    } finally {
      setSaving(false);
    }
  };

  const handleImportExcel = async (records: Record<string, string>[]) => {
    for (const record of records) {
      const category = categories.find(item => item.name.trim().toLowerCase() === record.category.trim().toLowerCase())
        || categories[0];
      const warehouseValue = record.warehouse.trim().toLowerCase();
      const warehouse = warehouses.find(item =>
        String(item.name).trim().toLowerCase() === warehouseValue || String(item.id).trim().toLowerCase() === warehouseValue);
      await createItem({
        code: record.code || undefined,
        name: record.name,
        categoryId: category?.id || '',
        categoryName: category?.name || record.category,
        unit: record.unit,
        initialStock: toNumber(record.initialStock),
        currentStock: toNumber(record.initialStock),
        minStock: toNumber(record.minStock),
        warehouseId: warehouse?.id || '',
        warehouseName: warehouse?.name || record.warehouse,
        description: record.description,
      }, currentUser);
    }
    await load();
    return records.length;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Master Data Barang"
        description="Satu inventaris terpusat dengan kode otomatis, kategori, satuan fleksibel, dan stok minimum."
        icon={Package}
        action={canCreate ? (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => void openCreate()} className={primaryButtonClass}><Plus className="w-4 h-4 mr-2" />Tambah Barang</button>
            <ExcelImportButton
              fields={productImportFields}
              permission="imports.execute"
              existingRows={items}
              uniqueFields={['code', 'name']}
              onImport={handleImportExcel}
              label="Impor Excel"
              title="Impor Barang dari Excel/CSV"
            />
          </div>
        ) : undefined}
      />
      <AlertBox message={error} onClose={() => setError('')} />
      <AlertBox message={success} kind="success" onClose={() => setSuccess('')} />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <FilterBar search={search} onSearch={value => { setSearch(value); setPage(1); }}>
          <select value={categoryFilter} onChange={event => { setCategoryFilter(event.target.value); setPage(1); }} className={`${inputClass} w-auto`}>
            <option value="">Semua kategori</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select value={stockFilter} onChange={event => { setStockFilter(event.target.value); setPage(1); }} className={`${inputClass} w-auto`}>
            <option value="all">Semua stok</option>
            <option value="low">Stok menipis</option>
            <option value="empty">Stok habis</option>
          </select>
        </FilterBar>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500 text-sm">
            <div className="w-8 h-8 border-4 border-ocean-light border-t-ocean rounded-full animate-spin" />
            Memuat data...
          </div>
        ) : (
          <DataTable
            rows={visible}
            rowKey={row => row.id}
            onEdit={canEdit ? row => setForm({ ...row }) : undefined}
            onDelete={canDelete ? row => setDeleteIds([row.id]) : undefined}
            onBulkDelete={canDelete ? rows => setDeleteIds(rows.map(row => row.id)) : undefined}
            bulkDeleteLabel="Hapus barang terpilih"
            emptyLabel="Belum ada barang terdaftar."
            columns={[
              { key: 'code', label: 'Kode', render: row => <span className="font-mono text-xs">{row.code || '-'}</span> },
              { key: 'name', label: 'Nama Barang', render: row => <span className="font-semibold text-slate-800">{row.name}</span> },
              { key: 'categoryName', label: 'Kategori' },
              { key: 'unit', label: 'Satuan' },
              { key: 'currentStock', label: 'Stok', render: row => <span className={row.currentStock <= row.minStock ? 'font-semibold text-red-600' : 'font-semibold'}>{row.currentStock} {row.unit}</span> },
              { key: 'minStock', label: 'Minimum' },
              { key: 'warehouseName', label: 'Gudang' },
              { key: 'itemStatus', label: 'Status', render: row => <StatusBadge value={row.itemStatus || 'Aktif'} /> },
            ]}
          />
        )}
        <div className="p-3 sm:p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>{filtered.length} barang • halaman {Math.min(page, totalPages)} dari {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className={secondaryButtonClass}>Sebelumnya</button>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className={secondaryButtonClass}>Berikutnya</button>
          </div>
        </div>
      </div>

      {form && (
        <Modal title={form.id ? 'Ubah Barang' : 'Tambah Barang'} onClose={() => setForm(null)} wide>
          <form onSubmit={event => void submit(event)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block"><span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Kode Barang</span><input value={form.code || ''} readOnly className={inputClass} /></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Nama Barang</span><input value={form.name || ''} onChange={event => setForm({ ...form, name: event.target.value })} className={inputClass} required /></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Kategori</span><select value={form.categoryId || ''} onChange={event => setForm({ ...form, categoryId: event.target.value })} className={inputClass} required><option value="">Pilih kategori</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Satuan</span><input value={form.unit || ''} onChange={event => setForm({ ...form, unit: event.target.value })} className={inputClass} placeholder="Kg, Gram, Liter, Pcs, Dus, Butir, Biji, Karung, Pak, Meter" required /></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Stok Awal</span><input type="number" min="0" value={form.initialStock ?? 0} onChange={event => setForm({ ...form, initialStock: Number(event.target.value) })} className={inputClass} /></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Stok Tersedia</span><input type="number" min="0" value={form.currentStock ?? 0} onChange={event => setForm({ ...form, currentStock: Number(event.target.value) })} className={inputClass} /></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Minimum Stok</span><input type="number" min="0" value={form.minStock ?? 0} onChange={event => setForm({ ...form, minStock: Number(event.target.value) })} className={inputClass} /></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Lokasi Gudang</span><select value={form.warehouseId || ''} onChange={event => setForm({ ...form, warehouseId: event.target.value })} className={inputClass}><option value="">Pilih gudang</option>{warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Status Barang</span><select value={form.itemStatus || 'Aktif'} onChange={event => setForm({ ...form, itemStatus: event.target.value as Item['itemStatus'] })} className={inputClass}><option value="Aktif">Aktif</option><option value="Nonaktif">Nonaktif</option></select></label>
            </div>
            <label className="block"><span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Deskripsi</span><textarea rows={3} value={form.description || ''} onChange={event => setForm({ ...form, description: event.target.value })} className={inputClass} /></label>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setForm(null)} className={secondaryButtonClass}>Batal</button>
              <button type="submit" disabled={saving} className={primaryButtonClass}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </form>
        </Modal>
      )}
      {deleteIds.length > 0 && <ConfirmDialog message={deleteIds.length === 1 ? 'Hapus barang ini? Tindakan ini tidak dapat dibatalkan.' : `Hapus ${deleteIds.length} barang terpilih? Tindakan ini tidak dapat dibatalkan.`} onCancel={() => setDeleteIds([])} onConfirm={() => void handleDelete()} />}
      {(loading || saving) && <LoadingOverlay label={saving ? 'Menyimpan data...' : 'Memuat data...'} />}
      <Toast message={error} kind="error" onClose={() => setError('')} />
      <Toast message={success} onClose={() => setSuccess('')} />
    </div>
  );
};

export const SuppliersPage: React.FC = () => {
  const fields: ResourceField[] = [
    { key: 'name', label: 'Nama Supplier', required: true },
    { key: 'contactPerson', label: 'Kontak Person', required: true },
    { key: 'phone', label: 'No. Telepon', required: true },
    { key: 'address', label: 'Alamat', type: 'textarea' },
  ];

  return (
    <ResourceManager
      title="Manajemen Supplier"
      description="Kelola data supplier bahan makanan dan informasi kontaknya."
      collection="suppliers"
      icon={Truck}
      permissions={{ view: 'suppliers.view', create: 'suppliers.create', edit: 'suppliers.edit', delete: 'suppliers.delete' }}
      fields={fields}
      columns={['name', 'contactPerson', 'phone', 'address']}
      columnLabels={{ name: 'Supplier', contactPerson: 'Kontak', phone: 'Telepon', address: 'Alamat' }}
      initialRow={() => ({ createdAt: new Date() })}
      validate={(row, rows) => {
        if (!row.name || !row.contactPerson || !row.phone) return 'Nama, kontak, dan telepon wajib diisi.';
        if (rows.some(item => item.id !== row.id && String(item.name).toLowerCase() === String(row.name).toLowerCase())) {
          return 'Nama supplier sudah digunakan.';
        }
        return null;
      }}
    />
  );
};

export const WarehouseStockPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const [products, setProducts] = useState<DataRow[]>([]);
  const [suppliers, setSuppliers] = useState<DataRow[]>([]);
  const [warehouses, setWarehouses] = useState<DataRow[]>([]);

  useEffect(() => {
    void Promise.all([
      getRows('products'),
      getRows('suppliers'),
      getRows('warehouses'),
    ]).then(([productRows, supplierRows, warehouseRows]) => {
      setProducts(productRows);
      setSuppliers(supplierRows);
      setWarehouses(warehouseRows);
    });
  }, []);

  if (!hasPermission('warehouses.view') && !hasPermission('stock_batches.view')) {
    return <AlertBox message="Anda tidak memiliki izin untuk melihat stok gudang." />;
  }

  const warehouseFields: ResourceField[] = [
    { key: 'name', label: 'Nama Gudang', required: true },
    { key: 'location', label: 'Lokasi', required: true },
    { key: 'description', label: 'Keterangan', type: 'textarea' },
  ];

  const batchFields: ResourceField[] = [
    { key: 'productId', label: 'Bahan Makanan', type: 'select', options: toOptions(products), required: true },
    { key: 'warehouseId', label: 'Gudang', type: 'select', options: toOptions(warehouses), required: true },
    { key: 'supplierId', label: 'Supplier', type: 'select', options: toOptions(suppliers) },
    { key: 'quantity', label: 'Jumlah Stok', type: 'number', required: true },
    { key: 'initialQuantity', label: 'Jumlah Awal', type: 'number', required: true },
    { key: 'purchasePrice', label: 'Harga Beli Satuan', type: 'number', required: true },
    { key: 'expiredDate', label: 'Tanggal Kedaluwarsa', type: 'date', required: true },
  ];

  return (
    <div className="space-y-6">
      <ResourceManager
        title="Data Gudang"
        description="Lokasi penyimpanan dan pengelolaan gudang pesantren."
        collection="warehouses"
        icon={Warehouse}
        permissions={{ view: 'warehouses.view', create: 'warehouses.create', edit: 'warehouses.edit', delete: 'warehouses.delete' }}
        fields={warehouseFields}
        columns={['name', 'location']}
        columnLabels={{ name: 'NAMA GUDANG', location: 'LOKASI' }}
        searchKeys={['name', 'location', 'description']}
        initialRow={() => ({ createdAt: new Date() })}
        validate={row => (!row.name || !row.location ? 'Nama dan lokasi gudang wajib diisi.' : null)}
      />
      <ResourceManager
        title="Batch Stok Gudang"
        description="Pantau jumlah stok per batch dan tanggal kedaluwarsanya."
        collection="stock_batches"
        icon={Package}
        permissions={{ view: 'stock_batches.view', create: 'stock_batches.create', edit: 'stock_batches.edit', delete: 'stock_batches.delete' }}
        fields={batchFields}
        columns={['productName', 'warehouseName', 'quantity', 'expiredDate', 'supplierName']}
        columnLabels={{ productName: 'Bahan Makanan', warehouseName: 'Gudang', quantity: 'Stok', expiredDate: 'Kedaluwarsa', supplierName: 'Supplier' }}
        initialRow={() => ({ quantity: 0, initialQuantity: 0, purchasePrice: 0, expiredDate: today(), createdAt: new Date() })}
        transform={row => ({
          ...row,
          productName: products.find(item => item.id === row.productId)?.name || row.productName || '',
          supplierName: suppliers.find(item => item.id === row.supplierId)?.name || '',
          warehouseName: warehouses.find(item => item.id === row.warehouseId)?.name || '',
        })}
        validate={row => {
          if (!row.productId || !row.warehouseId || !row.expiredDate) return 'Bahan, gudang, dan tanggal kedaluwarsa wajib diisi.';
          if (Number(row.quantity) < 0) return 'Jumlah stok tidak boleh negatif.';
          return null;
        }}
        renderCell={(key, row) => {
          if (key === 'expiredDate') {
            const expired = new Date(row.expiredDate) < new Date();
            return <span className={expired ? 'text-red-600 font-semibold' : 'text-slate-700'}>{row.expiredDate || '-'}</span>;
          }
          if (key === 'quantity') {
            return <span className="font-semibold text-slate-800">{row.quantity} {products.find(item => item.id === row.productId)?.unit || ''}</span>;
          }
          return undefined;
        }}
      />
    </div>
  );
};

