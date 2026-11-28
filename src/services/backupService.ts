import { collection, getDocs } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

export interface BackupRow {
  id: string;
  values: Record<string, string | number>;
}

export interface BackupDataset {
  name: string;
  label: string;
  fields: string[];
  rows: BackupRow[];
  error?: string;
}

const BACKUP_COLLECTIONS = [
  { name: 'users', label: 'Pengguna' },
  { name: 'roles', label: 'Role' },
  { name: 'permissions', label: 'Permission' },
  { name: 'audit_logs', label: 'Audit Log' },
  { name: 'audit_log_archives', label: 'Arsip Audit Log' },
  { name: 'products', label: 'Master Barang' },
  { name: 'categories', label: 'Kategori' },
  { name: 'suppliers', label: 'Supplier' },
  { name: 'warehouses', label: 'Gudang' },
  { name: 'stock_batches', label: 'Batch Stok' },
  { name: 'stock_in', label: 'Barang Masuk' },
  { name: 'stock_out', label: 'Barang Keluar' },
  { name: 'requests', label: 'Permintaan Dapur' },
  { name: 'request_details', label: 'Detail Permintaan' },
  { name: 'deliveries', label: 'Pengiriman Lama' },
  { name: 'delivery_details', label: 'Detail Pengiriman' },
  { name: 'vehicles', label: 'Kendaraan' },
  { name: 'stock_movements', label: 'Pergerakan Stok' },
  { name: 'kordas', label: 'KORDA' },
  { name: 'departments', label: 'Bagian' },
  { name: 'needsRequests', label: 'Kebutuhan Barang' },
  { name: 'shipments', label: 'Pengiriman' },
  { name: 'stockTransactions', label: 'Transaksi Stok' },
  { name: 'distributions', label: 'Distribusi' },
  { name: 'financeTransactions', label: 'Transaksi Keuangan' },
  { name: 'regions', label: 'Wilayah' },
  { name: 'recipients', label: 'Penerima' },
  { name: 'activityLogs', label: 'Aktivitas' },
  { name: 'notifications', label: 'Notifikasi' },
] as const;

function formatValue(value: unknown): string | number {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  if (value instanceof Date) return value.toLocaleString('id-ID');
  const candidate = value as { toDate?: () => Date; seconds?: number };
  if (typeof candidate.toDate === 'function') return formatValue(candidate.toDate());
  if (typeof candidate.seconds === 'number') return formatValue(new Date(candidate.seconds * 1000));
  return JSON.stringify(value);
}

export function getBackupCollectionInfo(): ReadonlyArray<{ name: string; label: string }> {
  return BACKUP_COLLECTIONS;
}

export async function loadBackupDatasets(): Promise<BackupDataset[]> {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firestore belum dikonfigurasi. Lengkapi variabel VITE_FIREBASE_* terlebih dahulu.');
  }

  return Promise.all(BACKUP_COLLECTIONS.map(async (item): Promise<BackupDataset> => {
    try {
      const snapshot = await getDocs(collection(db!, item.name));
      const documents = snapshot.docs.map((document) => ({
        id: document.id,
        data: document.data() as Record<string, unknown>,
      }));
      const fields = [...new Set(documents.flatMap((document) => Object.keys(document.data)))].sort();
      return {
        name: item.name,
        label: item.label,
        fields,
        rows: documents.map((document) => ({
          id: document.id,
          values: Object.fromEntries(fields.map((field) => [field, formatValue(document.data[field])])),
        })),
      };
    } catch (error) {
      return {
        name: item.name,
        label: item.label,
        fields: [],
        rows: [],
        error: error instanceof Error ? error.message : 'Gagal membaca koleksi.',
      };
    }
  }));
}
