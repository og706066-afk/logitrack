import React, { useEffect, useState } from 'react';
import { Package, Tags, Truck, Warehouse } from 'lucide-react';
import { ResourceManager, type ResourceField } from '../components/ResourceManager';
import { AlertBox } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { asNumber, getSeededRows, today, type DataRow } from '../services/logisticsService';

function toOptions(rows: DataRow[], labelKey = 'name'): { value: string; label: string }[] {
  return rows.map(row => ({ value: row.id, label: String(row[labelKey] ?? row.id) }));
}

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
  const [categories, setCategories] = useState<DataRow[]>([]);

  useEffect(() => {
    void getSeededRows('categories').then(setCategories);
  }, []);

  const fields: ResourceField[] = [
    { key: 'name', label: 'Nama Bahan Makanan', required: true, placeholder: 'Contoh: Beras Ramos' },
    { key: 'categoryId', label: 'Kategori', type: 'select', options: toOptions(categories), required: true },
    { key: 'unit', label: 'Satuan', required: true, placeholder: 'kg / liter / pcs' },
    { key: 'minStock', label: 'Stok Minimum', type: 'number', required: true },
    { key: 'currentStock', label: 'Stok Saat Ini', type: 'number', required: true },
    { key: 'description', label: 'Deskripsi', type: 'textarea' },
  ];

  return (
    <ResourceManager
      title="Manajemen Bahan Makanan"
      description="Kelola data bahan makanan, satuan, dan batas stok minimum gudang."
      collection="products"
      icon={Package}
      permissions={{ view: 'products.view', create: 'products.create', edit: 'products.edit', delete: 'products.delete' }}
      fields={fields}
      columns={['name', 'categoryName', 'unit', 'currentStock', 'minStock']}
      columnLabels={{ name: 'Nama Bahan', categoryName: 'Kategori', unit: 'Satuan', currentStock: 'Stok Saat Ini', minStock: 'Minimal' }}
      initialRow={() => ({ unit: 'kg', minStock: 0, currentStock: 0, createdAt: new Date(), updatedAt: new Date() })}
      transform={(row, rows) => ({
        ...row,
        categoryName: categories.find(item => item.id === row.categoryId)?.name || row.categoryName || '',
        initialStock: row.id ? row.initialStock : asNumber(row.currentStock),
        updatedAt: new Date(),
        createdAt: row.createdAt || rows.find(item => item.id === row.id)?.createdAt || new Date(),
      })}
      validate={(row, rows) => {
        if (!row.name || !row.categoryId || !row.unit) return 'Nama, kategori, dan satuan wajib diisi.';
        if (Number(row.currentStock) < 0 || Number(row.minStock) < 0) return 'Stok tidak boleh negatif.';
        if (rows.some(item => item.id !== row.id && String(item.name).toLowerCase() === String(row.name).toLowerCase())) {
          return 'Nama bahan makanan sudah digunakan.';
        }
        return null;
      }}
      renderCell={(key, row) => {
        if (key === 'currentStock') {
          const low = Number(row.currentStock) <= Number(row.minStock);
          return <span className={`font-semibold ${low ? 'text-red-600' : 'text-slate-700'}`}>{String(row.currentStock ?? 0)} {row.unit}</span>;
        }
        return undefined;
      }}
    />
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
      getSeededRows('products'),
      getSeededRows('suppliers'),
      getSeededRows('warehouses'),
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
        columns={['name', 'location', 'description']}
        columnLabels={{ name: 'Gudang', location: 'Lokasi', description: 'Keterangan' }}
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

