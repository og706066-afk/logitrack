import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { logAudit } from './rbacService';
import type { UserProfile } from '../types';

export type CollectionName =
  | 'products'
  | 'categories'
  | 'suppliers'
  | 'warehouses'
  | 'stock_batches'
  | 'stock_in'
  | 'stock_out'
  | 'requests'
  | 'request_details'
  | 'deliveries'
  | 'delivery_details'
  | 'vehicles'
  | 'stock_movements';

export type DataRow = Record<string, any>;

const STORAGE_PREFIX = 'silog_data_';

const MODULE_LABELS: Record<CollectionName, string> = {
  products: 'Bahan Makanan',
  categories: 'Kategori',
  suppliers: 'Supplier',
  warehouses: 'Stok Gudang',
  stock_batches: 'Stok Gudang',
  stock_in: 'Barang Masuk',
  stock_out: 'Barang Keluar',
  requests: 'Permintaan Dapur',
  request_details: 'Permintaan Dapur',
  deliveries: 'Pengiriman',
  delivery_details: 'Pengiriman',
  vehicles: 'Kendaraan',
  stock_movements: 'Stok Gudang',
};

function storageKey(name: CollectionName): string {
  return `${STORAGE_PREFIX}${name}`;
}

function readLocal(name: CollectionName): DataRow[] {
  try {
    const raw = localStorage.getItem(storageKey(name));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(name: CollectionName, rows: DataRow[]): void {
  localStorage.setItem(storageKey(name), JSON.stringify(rows));
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function asNumber(value: any): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function asDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value: any): string {
  const date = asDate(value);
  return date ? date.toLocaleDateString('id-ID') : '-';
}

async function writeAudit(actor: UserProfile | null | undefined, action: string, name: CollectionName, description: string): Promise<void> {
  if (!actor) return;
  await logAudit({
    userId: actor.uid,
    userName: actor.displayName || actor.email,
    action,
    module: MODULE_LABELS[name],
    description,
  });
}

export async function getRows(name: CollectionName, seed: DataRow[] = []): Promise<DataRow[]> {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, name));
      if (!snap.empty) {
        return snap.docs.map(item => ({ id: item.id, ...item.data() }));
      }
      if (seed.length > 0) {
        await Promise.allSettled(seed.map(row => setDoc(doc(db!, name, row.id), row)));
      }
      return seed;
    } catch {
      return getRowsFromLocal(name, seed);
    }
  }
  return getRowsFromLocal(name, seed);
}

function getRowsFromLocal(name: CollectionName, seed: DataRow[]): DataRow[] {
  const saved = readLocal(name);
  if (saved.length > 0) return saved;
  if (seed.length > 0) {
    writeLocal(name, seed);
    return seed;
  }
  return [];
}

export async function saveRow(name: CollectionName, input: DataRow, actor?: UserProfile | null): Promise<DataRow> {
  const row: DataRow = { ...input };
  if (!row.id) row.id = newId(name);
  const existing = readLocal(name);
  const isNew = !existing.some(item => item.id === row.id);
  const nextRows = isNew ? [...existing, row] : existing.map(item => item.id === row.id ? row : item);
  writeLocal(name, nextRows);

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, name, row.id), row);
    } catch {
      return row;
    }
  }
  await writeAudit(actor, isNew ? `CREATE_${name.toUpperCase()}` : `UPDATE_${name.toUpperCase()}`, name, `${isNew ? 'Membuat' : 'Mengubah'} data ${MODULE_LABELS[name]}: ${row.name || row.invoiceNumber || row.requestNumber || row.deliveryNumber || row.stockOutNumber || row.id}`);
  return row;
}

export async function saveRows(name: CollectionName, inputs: DataRow[], actor?: UserProfile | null): Promise<DataRow[]> {
  const saved: DataRow[] = [];
  for (const input of inputs) {
    saved.push(await saveRow(name, input, actor));
  }
  return saved;
}

export async function patchRow(name: CollectionName, id: string, patch: DataRow, actor?: UserProfile | null): Promise<void> {
  const rows = readLocal(name);
  writeLocal(name, rows.map(row => row.id === id ? { ...row, ...patch } : row));

  if (isFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, name, id), patch);
    } catch {
      return;
    }
  }
  await writeAudit(actor, `UPDATE_${name.toUpperCase()}`, name, `Mengubah data ${MODULE_LABELS[name]}: ${id}`);
}

export async function deleteRow(name: CollectionName, id: string, actor?: UserProfile | null): Promise<void> {
  writeLocal(name, readLocal(name).filter(row => row.id !== id));
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, name, id));
    } catch {
      return;
    }
  }
  await writeAudit(actor, `DELETE_${name.toUpperCase()}`, name, `Menghapus data ${MODULE_LABELS[name]}: ${id}`);
}

export function clearAllData(): void {
  Object.keys(localStorage)
    .filter(key => key.startsWith(STORAGE_PREFIX))
    .forEach(key => localStorage.removeItem(key));
}

const categories: DataRow[] = [
  { id: 'cat-1', name: 'Beras & Serealia', description: 'Beras, gandum, dan produk pokok lainnya', createdAt: new Date() },
  { id: 'cat-2', name: 'Minyak & Bumbu', description: 'Minyak goreng, garam, gula, dan bumbu dapur', createdAt: new Date() },
  { id: 'cat-3', name: 'Sayur & Buah', description: 'Sayuran segar dan buah-buahan', createdAt: new Date() },
  { id: 'cat-4', name: 'Protein Hewani', description: 'Ayam, telur, ikan, dan daging', createdAt: new Date() },
];

const products: DataRow[] = [
  { id: 'prod-1', name: 'Beras Ramos', categoryId: 'cat-1', categoryName: 'Beras & Serealia', unit: 'kg', minStock: 100, currentStock: 850, description: 'Beras pokok dapur pesantren', createdAt: new Date(), updatedAt: new Date() },
  { id: 'prod-2', name: 'Minyak Goreng', categoryId: 'cat-2', categoryName: 'Minyak & Bumbu', unit: 'liter', minStock: 40, currentStock: 120, description: 'Minyak goreng kemasan 5 liter', createdAt: new Date(), updatedAt: new Date() },
  { id: 'prod-3', name: 'Gula Pasir', categoryId: 'cat-2', categoryName: 'Minyak & Bumbu', unit: 'kg', minStock: 30, currentStock: 75, description: 'Gula pasir putih', createdAt: new Date(), updatedAt: new Date() },
  { id: 'prod-4', name: 'Telur Ayam', categoryId: 'cat-4', categoryName: 'Protein Hewani', unit: 'kg', minStock: 25, currentStock: 18, description: 'Telur ayam segar', createdAt: new Date(), updatedAt: new Date() },
  { id: 'prod-5', name: 'Ayam Broiler', categoryId: 'cat-4', categoryName: 'Protein Hewani', unit: 'kg', minStock: 20, currentStock: 45, description: 'Ayam potong segar', createdAt: new Date(), updatedAt: new Date() },
  { id: 'prod-6', name: 'Kubis', categoryId: 'cat-3', categoryName: 'Sayur & Buah', unit: 'kg', minStock: 15, currentStock: 32, description: 'Kubis segar', createdAt: new Date(), updatedAt: new Date() },
  { id: 'prod-7', name: 'Cabai Merah', categoryId: 'cat-3', categoryName: 'Sayur & Buah', unit: 'kg', minStock: 10, currentStock: 8, description: 'Cabai merah keriting', createdAt: new Date(), updatedAt: new Date() },
  { id: 'prod-8', name: 'Garam Dapur', categoryId: 'cat-2', categoryName: 'Minyak & Bumbu', unit: 'kg', minStock: 20, currentStock: 60, description: 'Garam halus', createdAt: new Date(), updatedAt: new Date() },
];

const suppliers: DataRow[] = [
  { id: 'sup-1', name: 'Toko Beras Berkah', contactPerson: 'Pak Slamet', phone: '081234560001', address: 'Pasar Induk Bandung', createdAt: new Date() },
  { id: 'sup-2', name: 'CV Minyak Sejahtera', contactPerson: 'Ibu Ratna', phone: '081234560002', address: 'Jl. Raya Cimahi No. 12', createdAt: new Date() },
  { id: 'sup-3', name: 'Farm Sayur Segar', contactPerson: 'Pak Ujang', phone: '081234560003', address: 'Pasar Buktiringin', createdAt: new Date() },
];

const warehouses: DataRow[] = [
  { id: 'wh-1', name: 'Gudang Utama', location: 'Gedung A - Pesantren', description: 'Gudang penyimpanan bahan makanan utama', createdAt: new Date() },
  { id: 'wh-2', name: 'Gudang Dapur', location: 'Gedung Dapur Pusat', description: 'Gudang penyangga kebutuhan harian dapur', createdAt: new Date() },
];

const stockBatches: DataRow[] = [
  { id: 'batch-1', productId: 'prod-1', productName: 'Beras Ramos', supplierId: 'sup-1', supplierName: 'Toko Beras Berkah', warehouseId: 'wh-1', quantity: 500, initialQuantity: 500, purchasePrice: 11000, expiredDate: '2027-06-30', stockInId: 'in-1', createdAt: new Date() },
  { id: 'batch-2', productId: 'prod-1', productName: 'Beras Ramos', supplierId: 'sup-1', supplierName: 'Toko Beras Berkah', warehouseId: 'wh-1', quantity: 350, initialQuantity: 350, purchasePrice: 11500, expiredDate: '2027-08-15', stockInId: 'in-2', createdAt: new Date() },
  { id: 'batch-3', productId: 'prod-2', productName: 'Minyak Goreng', supplierId: 'sup-2', supplierName: 'CV Minyak Sejahtera', warehouseId: 'wh-1', quantity: 120, initialQuantity: 140, purchasePrice: 68000, expiredDate: '2027-03-20', stockInId: 'in-3', createdAt: new Date() },
  { id: 'batch-4', productId: 'prod-4', productName: 'Telur Ayam', supplierId: 'sup-3', supplierName: 'Farm Sayur Segar', warehouseId: 'wh-2', quantity: 18, initialQuantity: 30, purchasePrice: 27000, expiredDate: '2026-11-30', stockInId: 'in-3', createdAt: new Date() },
  { id: 'batch-5', productId: 'prod-7', productName: 'Cabai Merah', supplierId: 'sup-3', supplierName: 'Farm Sayur Segar', warehouseId: 'wh-2', quantity: 8, initialQuantity: 20, purchasePrice: 32000, expiredDate: '2026-11-25', stockInId: 'in-3', createdAt: new Date() },
];

const stockIn: DataRow[] = [
  { id: 'in-1', invoiceNumber: 'IN-2026-001', supplierId: 'sup-1', supplierName: 'Toko Beras Berkah', productId: 'prod-1', productName: 'Beras Ramos', quantity: 500, purchasePrice: 11000, totalAmount: 5500000, date: '2026-10-02', notes: 'Stok awal bulan', createdBy: 'demo-gudang', createdAt: new Date() },
  { id: 'in-2', invoiceNumber: 'IN-2026-002', supplierId: 'sup-1', supplierName: 'Toko Beras Berkah', productId: 'prod-1', productName: 'Beras Ramos', quantity: 350, purchasePrice: 11500, totalAmount: 4025000, date: '2026-10-18', notes: 'Pengadaan tambahan', createdBy: 'demo-gudang', createdAt: new Date() },
  { id: 'in-3', invoiceNumber: 'IN-2026-003', supplierId: 'sup-2', supplierName: 'CV Minyak Sejahtera', productId: 'prod-2', productName: 'Minyak Goreng', quantity: 140, purchasePrice: 68000, totalAmount: 9520000, date: '2026-11-05', notes: 'Stok minak dapur', createdBy: 'demo-gudang', createdAt: new Date() },
];

const stockOut: DataRow[] = [
  { id: 'out-1', stockOutNumber: 'OUT-2026-001', productId: 'prod-1', productName: 'Beras Ramos', quantity: 50, date: '2026-11-10', destination: 'Dapur Pesantren Putra', notes: 'Permintaan rutin', createdBy: 'demo-gudang', createdAt: new Date() },
  { id: 'out-2', stockOutNumber: 'OUT-2026-002', productId: 'prod-2', productName: 'Minyak Goreng', quantity: 20, date: '2026-11-15', destination: 'Dapur Pesantren Putri', notes: 'Permintaan rutin', createdBy: 'demo-gudang', createdAt: new Date() },
];

const requests: DataRow[] = [
  { id: 'req-1', requestNumber: 'REQ-042', requesterName: 'Ustazah Maryam', requesterDepartment: 'Dapur Putri', status: 'Pending', notes: 'Untuk menu bubur ayam', createdAt: new Date() },
  { id: 'req-2', requestNumber: 'REQ-043', requesterName: 'Ustaz Farhan', requesterDepartment: 'Dapur Putra', status: 'Approved', notes: 'Kebutuhan harian', approvedBy: 'demo-manager', approvedAt: new Date(), createdAt: new Date() },
  { id: 'req-3', requestNumber: 'REQ-044', requesterName: 'Ustazah Maryam', requesterDepartment: 'Dapur Putri', status: 'Processing', notes: 'Sedang disiapkan gudang', approvedBy: 'demo-manager', approvedAt: new Date(), createdAt: new Date() },
  { id: 'req-4', requestNumber: 'REQ-045', requesterName: 'Ustaz Farhan', requesterDepartment: 'Dapur Putra', status: 'Completed', notes: 'Sudah diterima dapur', approvedBy: 'demo-manager', approvedAt: new Date(), createdAt: new Date() },
  { id: 'req-5', requestNumber: 'REQ-046', requesterName: 'Ustazah Zeinab', requesterDepartment: 'Dapur Putri', status: 'Rejected', notes: 'Stok belum tersedia', rejectedReason: 'Stok cabai tidak mencukupi', createdAt: new Date() },
];

const requestDetails: DataRow[] = [
  { id: 'rd-1', requestId: 'req-1', productId: 'prod-1', productName: 'Beras Ramos', requestedQty: 25, approvedQty: 25, unit: 'kg' },
  { id: 'rd-2', requestId: 'req-1', productId: 'prod-5', productName: 'Ayam Broiler', requestedQty: 10, approvedQty: 10, unit: 'kg' },
  { id: 'rd-3', requestId: 'req-2', productId: 'prod-2', productName: 'Minyak Goreng', requestedQty: 8, approvedQty: 8, unit: 'liter' },
  { id: 'rd-4', requestId: 'req-3', productId: 'prod-3', productName: 'Gula Pasir', requestedQty: 6, approvedQty: 6, unit: 'kg' },
  { id: 'rd-5', requestId: 'req-4', productId: 'prod-6', productName: 'Kubis', requestedQty: 12, approvedQty: 12, unit: 'kg' },
  { id: 'rd-6', requestId: 'req-5', productId: 'prod-7', productName: 'Cabai Merah', requestedQty: 5, approvedQty: 0, unit: 'kg' },
];

const deliveries: DataRow[] = [
  { id: 'del-1', deliveryNumber: 'DEL-2026-001', requestId: 'req-2', driverId: 'demo-driver', driverName: 'Pak Joko (Driver)', vehicleNumber: 'D-1234-ABC', status: 'On Delivery', shippingDate: '2026-11-20', notes: 'Menuju dapur putra', createdAt: new Date() },
  { id: 'del-2', deliveryNumber: 'DEL-2026-002', requestId: 'req-3', driverId: 'demo-driver', driverName: 'Pak Joko (Driver)', vehicleNumber: 'D-1234-ABC', status: 'Assigned', shippingDate: '2026-11-22', notes: 'Menunggu keberangkatan', createdAt: new Date() },
  { id: 'del-3', deliveryNumber: 'DEL-2026-003', requestId: 'req-4', driverId: 'demo-driver', driverName: 'Pak Joko (Driver)', vehicleNumber: 'D-5678-XYZ', status: 'Delivered', shippingDate: '2026-11-18', deliveredAt: new Date(), notes: 'Sudah diterima', createdAt: new Date() },
];

const deliveryDetails: DataRow[] = [
  { id: 'dd-1', deliveryId: 'del-1', productId: 'prod-2', productName: 'Minyak Goreng', quantity: 8, unit: 'liter' },
  { id: 'dd-2', deliveryId: 'del-2', productId: 'prod-3', productName: 'Gula Pasir', quantity: 6, unit: 'kg' },
  { id: 'dd-3', deliveryId: 'del-3', productId: 'prod-6', productName: 'Kubis', quantity: 12, unit: 'kg' },
];

const vehicles: DataRow[] = [
  { id: 'veh-1', plateNumber: 'D-1234-ABC', type: 'Pickup', capacity: '1 ton', driverId: 'demo-driver', isActive: true, createdAt: new Date() },
  { id: 'veh-2', plateNumber: 'D-5678-XYZ', type: 'Box', capacity: '2 ton', driverId: 'demo-driver', isActive: true, createdAt: new Date() },
];

const stockMovements: DataRow[] = [
  { id: 'mov-1', productId: 'prod-1', productName: 'Beras Ramos', type: 'IN', quantity: 500, referenceId: 'in-1', date: '2026-10-02', createdAt: new Date() },
  { id: 'mov-2', productId: 'prod-1', productName: 'Beras Ramos', type: 'IN', quantity: 350, referenceId: 'in-2', date: '2026-10-18', createdAt: new Date() },
  { id: 'mov-3', productId: 'prod-2', productName: 'Minyak Goreng', type: 'IN', quantity: 140, referenceId: 'in-3', date: '2026-11-05', createdAt: new Date() },
  { id: 'mov-4', productId: 'prod-1', productName: 'Beras Ramos', type: 'OUT', quantity: 50, referenceId: 'out-1', date: '2026-11-10', createdAt: new Date() },
  { id: 'mov-5', productId: 'prod-2', productName: 'Minyak Goreng', type: 'OUT', quantity: 20, referenceId: 'out-2', date: '2026-11-15', createdAt: new Date() },
];

export const SEEDS: Record<CollectionName, DataRow[]> = {
  products,
  categories,
  suppliers,
  warehouses,
  stock_batches: stockBatches,
  stock_in: stockIn,
  stock_out: stockOut,
  requests,
  request_details: requestDetails,
  deliveries,
  delivery_details: deliveryDetails,
  vehicles,
  stock_movements: stockMovements,
};

export async function getSeededRows(name: CollectionName): Promise<DataRow[]> {
  return getRows(name, SEEDS[name]);
}
