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

export async function getRows(name: CollectionName): Promise<DataRow[]> {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, name));
      return snap.docs.map(item => ({ id: item.id, ...item.data() }));
    } catch {
      return readLocal(name);
    }
  }
  return readLocal(name);
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


