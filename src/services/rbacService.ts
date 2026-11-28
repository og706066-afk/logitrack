import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import type { AuditLog, AuditLogArchive, Permission, Role, UserProfile } from '../types';

type AuditLogLike = AuditLog & { [key: string]: any };

function isLocalAuditId(id: unknown): boolean {
  return typeof id === 'string' && /^log-\d+-\d+$/.test(id);
}

function stableAuditFingerprint(log: Pick<AuditLog, 'userId' | 'action' | 'module' | 'description' | 'createdAt' | 'id'> & { localId?: string; migratedFromLocalId?: string }): string {
  const created = log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000).toISOString() : String(log.createdAt ?? '');
  return [log.localId || log.migratedFromLocalId || log.id, log.userId, log.action, log.module, log.description, created].join('|');
}

function normalizeAuditLog(raw: any, fallbackSource: 'firestore' | 'local'): AuditLogLike {
  const id = String(raw?.id ?? '');
  const source = raw?.source ?? (fallbackSource === 'firestore' ? 'firestore' : (isLocalAuditId(id) ? 'local' : 'local'));
  const syncStatus = raw?.syncStatus ?? (source === 'firestore' ? 'synced' : isLocalAuditId(id) ? 'pending' : 'pending');
  return {
    ...raw,
    id,
    userId: String(raw?.userId ?? ''),
    userName: String(raw?.userName ?? ''),
    action: String(raw?.action ?? ''),
    module: String(raw?.module ?? ''),
    description: String(raw?.description ?? ''),
    createdAt: raw?.createdAt ?? null,
    source,
    syncStatus,
    localId: raw?.localId ?? (isLocalAuditId(id) ? id : undefined),
    firestoreId: raw?.firestoreId ?? (source === 'firestore' && !isLocalAuditId(id) ? id : undefined),
  } as AuditLogLike;
}

function readLocalAuditLogs(): AuditLogLike[] {
  const saved = localStorage.getItem(STORAGE_AUDIT_KEY);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeAuditLog(item, 'local'));
  } catch {
    return [];
  }
}

function writeLocalAuditLogs(logs: AuditLogLike[]): void {
  localStorage.setItem(STORAGE_AUDIT_KEY, JSON.stringify(logs.slice(0, 200)));
}

export function isArchivableAuditLog(log: Pick<AuditLog, 'id' | 'source' | 'syncStatus'>): boolean {
  return !isLocalAuditId(log.id) && (log.source === 'firestore' || log.source === 'migrated' || (!log.source && !isLocalAuditId(log.id))) && log.syncStatus !== 'pending' && log.syncStatus !== 'failed';
}

export const MASTER_PERMISSIONS: Permission[] = [
  // Dashboard
  { id: 'dashboard.view', module: 'Dashboard', action: 'view', name: 'Lihat Dashboard', description: 'Melihat statistik ringkasan dan grafik operasional' },
  
  // Products / Bahan Makanan
  { id: 'products.view', module: 'Bahan Makanan', action: 'view', name: 'Lihat Bahan Makanan', description: 'Melihat daftar dan detail bahan makanan' },
  { id: 'products.create', module: 'Bahan Makanan', action: 'create', name: 'Tambah Bahan Makanan', description: 'Menambahkan data bahan makanan baru' },
  { id: 'products.edit', module: 'Bahan Makanan', action: 'edit', name: 'Edit Bahan Makanan', description: 'Mengubah data bahan makanan' },
  { id: 'products.delete', module: 'Bahan Makanan', action: 'delete', name: 'Hapus Bahan Makanan', description: 'Menghapus data bahan makanan' },

  { id: 'categories.view', module: 'Kategori', action: 'view', name: 'Lihat Kategori', description: 'Melihat daftar kategori bahan makanan' },
  { id: 'categories.create', module: 'Kategori', action: 'create', name: 'Tambah Kategori', description: 'Menambahkan kategori baru' },
  { id: 'categories.edit', module: 'Kategori', action: 'edit', name: 'Edit Kategori', description: 'Mengubah data kategori' },
  { id: 'categories.delete', module: 'Kategori', action: 'delete', name: 'Hapus Kategori', description: 'Menghapus kategori' },

  // Suppliers
  { id: 'suppliers.view', module: 'Supplier', action: 'view', name: 'Lihat Supplier', description: 'Melihat daftar supplier' },
  { id: 'suppliers.create', module: 'Supplier', action: 'create', name: 'Tambah Supplier', description: 'Menambahkan supplier baru' },
  { id: 'suppliers.edit', module: 'Supplier', action: 'edit', name: 'Edit Supplier', description: 'Mengubah data supplier' },
  { id: 'suppliers.delete', module: 'Supplier', action: 'delete', name: 'Hapus Supplier', description: 'Menghapus data supplier' },

  { id: 'warehouses.view', module: 'Stok Gudang', action: 'view', name: 'Lihat Stok Gudang', description: 'Melihat gudang dan batch stok yang tersedia' },
  { id: 'warehouses.create', module: 'Stok Gudang', action: 'create', name: 'Tambah Gudang', description: 'Menambahkan data gudang' },
  { id: 'warehouses.edit', module: 'Stok Gudang', action: 'edit', name: 'Edit Gudang', description: 'Mengubah data gudang' },
  { id: 'warehouses.delete', module: 'Stok Gudang', action: 'delete', name: 'Hapus Gudang', description: 'Menghapus data gudang' },
  { id: 'stock_batches.view', module: 'Stok Gudang', action: 'view', name: 'Lihat Batch Stok', description: 'Melihat batch dan tanggal kedaluwarsa stok' },
  { id: 'stock_batches.create', module: 'Stok Gudang', action: 'create', name: 'Tambah Batch Stok', description: 'Menambahkan batch stok baru' },
  { id: 'stock_batches.edit', module: 'Stok Gudang', action: 'edit', name: 'Edit Batch Stok', description: 'Mengubah jumlah batch stok' },
  { id: 'stock_batches.delete', module: 'Stok Gudang', action: 'delete', name: 'Hapus Batch Stok', description: 'Menghapus batch stok' },
  { id: 'stock_movements.view', module: 'Stok Gudang', action: 'view', name: 'Lihat Pergerakan Stok', description: 'Melihat riwayat pergerakan stok' },
  { id: 'stock_movements.create', module: 'Stok Gudang', action: 'create', name: 'Catat Pergerakan Stok', description: 'Mencatat pergerakan stok masuk dan keluar' },
  { id: 'stock_movements.edit', module: 'Stok Gudang', action: 'edit', name: 'Edit Pergerakan Stok', description: 'Mengubah catatan pergerakan stok' },
  { id: 'stock_movements.delete', module: 'Stok Gudang', action: 'delete', name: 'Hapus Pergerakan Stok', description: 'Menghapus catatan pergerakan stok' },

  { id: 'vehicles.view', module: 'Kendaraan', action: 'view', name: 'Lihat Kendaraan', description: 'Melihat data kendaraan operasional' },
  { id: 'vehicles.create', module: 'Kendaraan', action: 'create', name: 'Tambah Kendaraan', description: 'Menambahkan data kendaraan' },
  { id: 'vehicles.edit', module: 'Kendaraan', action: 'edit', name: 'Edit Kendaraan', description: 'Mengubah data kendaraan' },
  { id: 'vehicles.delete', module: 'Kendaraan', action: 'delete', name: 'Hapus Kendaraan', description: 'Menghapus data kendaraan' },

  // Stock In (Barang Masuk)
  { id: 'stock_in.view', module: 'Barang Masuk', action: 'view', name: 'Lihat Barang Masuk', description: 'Melihat riwayat barang masuk & stok gudang' },
  { id: 'stock_in.create', module: 'Barang Masuk', action: 'create', name: 'Catat Barang Masuk', description: 'Mencatat transaksi barang masuk dari supplier' },
  { id: 'stock_in.edit', module: 'Barang Masuk', action: 'edit', name: 'Edit Barang Masuk', description: 'Mengubah data transaksi barang masuk' },
  { id: 'stock_in.delete', module: 'Barang Masuk', action: 'delete', name: 'Hapus Barang Masuk', description: 'Menghapus transaksi barang masuk' },

  // Stock Out (Barang Keluar)
  { id: 'stock_out.view', module: 'Barang Keluar', action: 'view', name: 'Lihat Barang Keluar', description: 'Melihat riwayat barang keluar' },
  { id: 'stock_out.create', module: 'Barang Keluar', action: 'create', name: 'Catat Barang Keluar', description: 'Mencatat pengeluaran barang' },
  { id: 'stock_out.edit', module: 'Barang Keluar', action: 'edit', name: 'Edit Barang Keluar', description: 'Mengubah transaksi barang keluar' },
  { id: 'stock_out.delete', module: 'Barang Keluar', action: 'delete', name: 'Hapus Barang Keluar', description: 'Menghapus transaksi barang keluar' },

  // Requests (Permintaan Dapur)
  { id: 'requests.view', module: 'Permintaan Dapur', action: 'view', name: 'Lihat Permintaan', description: 'Melihat daftar permintaan bahan makanan dari dapur' },
  { id: 'requests.create', module: 'Permintaan Dapur', action: 'create', name: 'Buat Permintaan', description: 'Mengajukan permintaan bahan makanan baru' },
  { id: 'requests.approve', module: 'Permintaan Dapur', action: 'approve', name: 'Setujui Permintaan', description: 'Menyetujui permintaan dapur oleh Manager' },
  { id: 'requests.reject', module: 'Permintaan Dapur', action: 'reject', name: 'Tolak Permintaan', description: 'Menolak permintaan dapur' },
  { id: 'requests.delete', module: 'Permintaan Dapur', action: 'delete', name: 'Hapus Permintaan', description: 'Menghapus permintaan dapur' },

  // Deliveries (Pengiriman)
  { id: 'deliveries.view', module: 'Pengiriman', action: 'view', name: 'Lihat Pengiriman', description: 'Melihat daftar tugas pengiriman' },
  { id: 'deliveries.create', module: 'Pengiriman', action: 'create', name: 'Buat Tugas Pengiriman', description: 'Menugaskan driver untuk pengiriman' },
  { id: 'deliveries.update', module: 'Pengiriman', action: 'update', name: 'Update Status Pengiriman', description: 'Driver memperbarui status pengiriman' },
  { id: 'deliveries.complete', module: 'Pengiriman', action: 'complete', name: 'Konfirmasi Penerimaan', description: 'Konfirmasi barang diterima di dapur' },
  { id: 'deliveries.edit', module: 'Pengiriman', action: 'edit', name: 'Edit Pengiriman', description: 'Mengubah data tugas pengiriman' },
  { id: 'deliveries.delete', module: 'Pengiriman', action: 'delete', name: 'Hapus Pengiriman', description: 'Menghapus tugas pengiriman' },

  // Reports
  { id: 'reports.view', module: 'Laporan', action: 'view', name: 'Lihat Laporan', description: 'Melihat laporan dan analitik logistik' },
  { id: 'reports.export', module: 'Laporan', action: 'export', name: 'Ekspor Laporan', description: 'Mengunduh laporan PDF/Excel' },

  // Users (Pengguna)
  { id: 'users.view', module: 'Pengguna', action: 'view', name: 'Lihat Pengguna', description: 'Melihat daftar pengguna sistem' },
  { id: 'users.create', module: 'Pengguna', action: 'create', name: 'Tambah Pengguna', description: 'Menambahkan pengguna baru' },
  { id: 'users.edit', module: 'Pengguna', action: 'edit', name: 'Edit Pengguna', description: 'Mengubah data & role pengguna' },
  { id: 'users.delete', module: 'Pengguna', action: 'delete', name: 'Hapus Pengguna', description: 'Menghapus pengguna dari sistem' },

  // Roles & Permissions
  { id: 'roles.view', module: 'Role & Permission', action: 'view', name: 'Lihat Role', description: 'Melihat daftar role dan hak akses' },
  { id: 'roles.create', module: 'Role & Permission', action: 'create', name: 'Buat Role', description: 'Membuat role baru' },
  { id: 'roles.edit', module: 'Role & Permission', action: 'edit', name: 'Edit Role', description: 'Mengubah nama, deskripsi, dan permission role' },
  { id: 'roles.delete', module: 'Role & Permission', action: 'delete', name: 'Hapus Role', description: 'Menghapus role yang tidak terpakai' },

  { id: 'items.view', module: 'Master Barang', action: 'view', name: 'Lihat Master Barang', description: 'Melihat inventaris barang terpusat' },
  { id: 'items.create', module: 'Master Barang', action: 'create', name: 'Tambah Barang', description: 'Menambahkan barang ke inventaris' },
  { id: 'items.edit', module: 'Master Barang', action: 'edit', name: 'Edit Barang', description: 'Mengubah data master barang' },
  { id: 'items.delete', module: 'Master Barang', action: 'delete', name: 'Hapus Barang', description: 'Menonaktifkan atau menghapus barang' },

  { id: 'needsRequests.view', module: 'Kebutuhan Barang', action: 'view', name: 'Lihat Kebutuhan Barang', description: 'Melihat pengajuan kebutuhan barang' },
  { id: 'needsRequests.create', module: 'Kebutuhan Barang', action: 'create', name: 'Ajukan Kebutuhan', description: 'Membuat pengajuan kebutuhan barang' },
  { id: 'needsRequests.edit', module: 'Kebutuhan Barang', action: 'edit', name: 'Edit Kebutuhan', description: 'Mengubah pengajuan sebelum disetujui' },
  { id: 'needsRequests.approve', module: 'Kebutuhan Barang', action: 'approve', name: 'Setujui Kebutuhan', description: 'Menyetujui pengajuan kebutuhan barang' },
  { id: 'needsRequests.reject', module: 'Kebutuhan Barang', action: 'reject', name: 'Tolak Kebutuhan', description: 'Menolak pengajuan kebutuhan barang' },

  { id: 'shipments.view', module: 'Pengiriman Terintegrasi', action: 'view', name: 'Lihat Pengiriman', description: 'Melihat monitoring pengiriman barang' },
  { id: 'shipments.create', module: 'Pengiriman Terintegrasi', action: 'create', name: 'Buat Pengiriman', description: 'Membuat pengiriman barang' },
  { id: 'shipments.edit', module: 'Pengiriman Terintegrasi', action: 'edit', name: 'Ubah Pengiriman', description: 'Mengubah data dan status pengiriman' },
  { id: 'shipments.confirm', module: 'Pengiriman Terintegrasi', action: 'confirm', name: 'Konfirmasi Penerimaan', description: 'Menerima barang kiriman' },
  { id: 'shipments.upload', module: 'Pengiriman Terintegrasi', action: 'upload', name: 'Unggah Bukti', description: 'Mengunggah bukti foto penerimaan' },

  { id: 'stockTransactions.view', module: 'Transaksi Stok', action: 'view', name: 'Lihat Transaksi Stok', description: 'Melihat mutasi dan kartu stok' },
  { id: 'stockTransactions.create', module: 'Transaksi Stok', action: 'create', name: 'Catat Transaksi Stok', description: 'Mencatat barang masuk, keluar, dan penyesuaian' },
  { id: 'stockTransactions.confirm', module: 'Transaksi Stok', action: 'confirm', name: 'Konfirmasi Transaksi Stok', description: 'Mengonfirmasi mutasi stok' },

  { id: 'distributions.view', module: 'Distribusi', action: 'view', name: 'Lihat Distribusi', description: 'Melihat rekap distribusi barang' },
  { id: 'distributions.create', module: 'Distribusi', action: 'create', name: 'Catat Distribusi', description: 'Mencatat penyerahan barang ke bagian' },

  { id: 'kordas.view', module: 'Master KORDA', action: 'view', name: 'Lihat KORDA', description: 'Melihat daftar KORDA' },
  { id: 'kordas.manage', module: 'Master KORDA', action: 'manage', name: 'Kelola KORDA', description: 'Menambah, mengubah, dan menonaktifkan KORDA' },
  { id: 'departments.view', module: 'Master Bagian', action: 'view', name: 'Lihat Bagian', description: 'Melihat daftar bagian/peruntukan' },
  { id: 'departments.manage', module: 'Master Bagian', action: 'manage', name: 'Kelola Bagian', description: 'Menambah, mengubah, dan menonaktifkan bagian' },

  { id: 'finance.view', module: 'Keuangan', action: 'view', name: 'Lihat Keuangan', description: 'Melihat buku kas dan saldo' },
  { id: 'finance.create', module: 'Keuangan', action: 'create', name: 'Catat Keuangan', description: 'Mencatat pemasukan dan pengeluaran' },
  { id: 'finance.edit', module: 'Keuangan', action: 'edit', name: 'Ubah Keuangan', description: 'Mengubah transaksi keuangan' },
  { id: 'finance.export', module: 'Keuangan', action: 'export', name: 'Ekspor Keuangan', description: 'Mengekspor laporan keuangan' },

  { id: 'regions.view', module: 'Wilayah & Penerima', action: 'view', name: 'Lihat Wilayah', description: 'Melihat data wilayah dan penerima distribusi' },
  { id: 'regions.manage', module: 'Wilayah & Penerima', action: 'manage', name: 'Kelola Wilayah', description: 'Mengelola data wilayah dan penerima' },

  { id: 'imports.view', module: 'Import Excel', action: 'view', name: 'Buka Import Excel', description: 'Mengakses fitur impor data Excel pada modul' },
  { id: 'imports.execute', module: 'Import Excel', action: 'execute', name: 'Jalankan Import', description: 'Mengimpor data Excel yang telah divalidasi' },

  { id: 'backup.export', module: 'Pengaturan', action: 'export', name: 'Backup Data', description: 'Mengunduh salinan seluruh data aplikasi dalam format Excel atau PDF' },
];

const STORAGE_ROLES_KEY = 'silog_roles_data';
const STORAGE_USERS_KEY = 'silog_users_data';
const STORAGE_AUDIT_KEY = 'silog_audit_logs';

export const WAREHOUSE_ROLE_GROUPS = [
  { name: 'Staf Gudang', roles: ['Kepala Gudang'] },
  { name: 'Sub Gudang', roles: ['Staf Bahan Dapur', 'Staf Konsumsi', 'Staf Sayuran', 'Staf Bumbu Alam', 'Staf Logistik', 'Staf Kebersihan'] },
] as const;

const WAREHOUSE_VIEW_BASE = [
  'dashboard.view',
  'products.view',
  'categories.view',
  'warehouses.view',
  'stock_batches.view',
  'stock_movements.view',
];

const REQUEST_FEATURE_PERMISSIONS = [
  'requests.view',
  'requests.create',
  'needsRequests.view',
  'needsRequests.create',
];

function withRequestFeatures(permissions: string[]): string[] {
  return [...new Set([...permissions, ...REQUEST_FEATURE_PERMISSIONS])];
}

export const WAREHOUSE_ROLE_PRESETS: Role[] = [
  {
    id: 'role-kepala-gudang',
    name: 'Kepala Gudang',
    description: 'Memimpin seluruh operasional gudang, stok, barang masuk/keluar, dan pelaporan.',
    permissions: [
      ...WAREHOUSE_VIEW_BASE,
      'products.create', 'products.edit', 'products.delete',
      'categories.create', 'categories.edit', 'categories.delete',
      'suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.delete',
      'warehouses.create', 'warehouses.edit', 'warehouses.delete',
      'stock_batches.create', 'stock_batches.edit', 'stock_batches.delete',
      'stock_movements.create', 'stock_movements.edit', 'stock_movements.delete',
      'stock_in.view', 'stock_in.create', 'stock_in.edit', 'stock_in.delete',
      'stock_out.view', 'stock_out.create', 'stock_out.edit', 'stock_out.delete',
      'requests.view', 'requests.create',
      'deliveries.view', 'vehicles.view',
      'reports.view', 'reports.export',
    ],
    isSystem: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'role-staf-bahan-dapur',
    name: 'Staf Bahan Dapur',
    description: 'Mengelola ketersediaan bahan makanan dan batch stok untuk kebutuhan dapur.',
    permissions: [
      ...WAREHOUSE_VIEW_BASE,
      'products.create', 'products.edit',
      'suppliers.view',
      'stock_batches.create', 'stock_batches.edit',
      'stock_movements.create',
      'stock_in.view', 'stock_in.create',
      'stock_out.view',
    ],
    isSystem: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'role-staf-konsumsi',
    name: 'Staf Konsumsi',
    description: 'Menyiapkan dan mengeluarkan bahan konsumsi untuk dapur pesantren.',
    permissions: [
      ...WAREHOUSE_VIEW_BASE,
      'requests.view', 'requests.create',
      'stock_out.view', 'stock_out.create', 'stock_out.edit',
      'stock_movements.create',
      'deliveries.view',
    ],
    isSystem: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'role-staf-sayuran',
    name: 'Staf Sayuran',
    description: 'Menangani penerimaan, penyimpanan, dan distribusi sayuran segar.',
    permissions: [
      ...WAREHOUSE_VIEW_BASE,
      'products.create', 'products.edit',
      'suppliers.view',
      'stock_batches.create', 'stock_batches.edit',
      'stock_movements.create',
      'stock_in.view', 'stock_in.create',
    ],
    isSystem: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'role-staf-bumbu-alam',
    name: 'Staf Bumbu Alam',
    description: 'Menangani bumbu alam, rempah, dan bahan kering di gudang.',
    permissions: [
      ...WAREHOUSE_VIEW_BASE,
      'products.create', 'products.edit',
      'categories.create', 'categories.edit',
      'suppliers.view', 'suppliers.create',
      'stock_batches.create', 'stock_batches.edit',
      'stock_movements.create',
      'stock_in.view', 'stock_in.create',
    ],
    isSystem: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'role-staf-logistik',
    name: 'Staf Logistik',
    description: 'Mengatur armada, pengiriman, dan pergerakan barang masuk serta keluar.',
    permissions: [
      ...WAREHOUSE_VIEW_BASE,
      'suppliers.view',
      'stock_movements.create',
      'stock_in.view', 'stock_in.create', 'stock_in.edit',
      'stock_out.view', 'stock_out.create', 'stock_out.edit',
      'vehicles.view', 'vehicles.create', 'vehicles.edit',
      'deliveries.view', 'deliveries.create', 'deliveries.update', 'deliveries.complete',
      'requests.view',
      'reports.view',
    ],
    isSystem: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'role-staf-kebersihan',
    name: 'Staf Kebersihan',
    description: 'Memantau kebersihan dan kerapian area gudang serta kondisi stok.',
    permissions: [
      ...WAREHOUSE_VIEW_BASE,
      'stock_movements.view',
    ],
    isSystem: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const STOCK_OPERATION_PERMISSIONS = [
  'items.view', 'items.create', 'items.edit',
  'stockTransactions.view', 'stockTransactions.create', 'stockTransactions.confirm',
  'distributions.view', 'distributions.create',
  'shipments.view',
  'needsRequests.view', 'needsRequests.create',
];

export const ADDITIONAL_ROLE_PRESETS: Role[] = [
  {
    id: 'role-staf-gudang',
    name: 'Staf Gudang',
    description: 'Mengelola master barang, transaksi stok, barang masuk/keluar, dan stock opname.',
    permissions: [
      ...WAREHOUSE_VIEW_BASE,
      ...STOCK_OPERATION_PERMISSIONS,
      'products.create', 'products.edit',
      'categories.create', 'categories.edit',
      'suppliers.view',
      'warehouses.create', 'warehouses.edit',
      'stock_batches.create', 'stock_batches.edit',
      'stock_movements.create',
      'stock_in.view', 'stock_in.create', 'stock_in.edit',
      'stock_out.view', 'stock_out.create', 'stock_out.edit',
      'requests.view', 'requests.create',
      'kordas.view', 'departments.view',
      'reports.view',
    ],
    isSystem: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'role-manager',
    name: 'Manager',
    description: 'Menyetujui kebutuhan dan transaksi, memantau pengiriman, serta melihat laporan.',
    permissions: [
      'dashboard.view', 'items.view',
      'needsRequests.view', 'needsRequests.approve', 'needsRequests.reject',
      'shipments.view', 'shipments.edit',
      'stockTransactions.view', 'stockTransactions.confirm',
      'distributions.view',
      'kordas.view', 'departments.view',
      'reports.view', 'reports.export',
    ],
    isSystem: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'role-driver',
    name: 'Driver',
    description: 'Melihat tugas pengiriman, memperbarui status, dan mengunggah bukti penerimaan.',
    permissions: [
      'dashboard.view',
      'shipments.view', 'shipments.edit', 'shipments.confirm', 'shipments.upload',
    ],
    isSystem: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const SYSTEM_ROLE_PRESETS = [...WAREHOUSE_ROLE_PRESETS, ...ADDITIONAL_ROLE_PRESETS].map(role =>
  role.name === 'Viewer' ? role : { ...role, permissions: withRequestFeatures(role.permissions) }
);

async function syncWarehouseRoles(roles: Role[]): Promise<Role[]> {
  if (roles.length > 0) return roles;

  const finalRoles = SYSTEM_ROLE_PRESETS.map(role => ({ ...role }));
  localStorage.setItem(STORAGE_ROLES_KEY, JSON.stringify(finalRoles));

  if (isFirebaseConfigured && db) {
    await Promise.allSettled(finalRoles.map(role => setDoc(doc(db!, 'roles', role.id), {
      ...role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })));
  }

  return finalRoles;
}

export async function getRoles(): Promise<Role[]> {
  let roles: Role[] = [];

  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'roles'));
      if (!snap.empty) {
        roles = snap.docs.map(d => ({ id: d.id, ...d.data() } as Role));
      }
    } catch (_e) {}
  }

  if (roles.length === 0) {
    const saved = localStorage.getItem(STORAGE_ROLES_KEY);
    if (saved) {
      try { roles = JSON.parse(saved); } catch (_e) {}
    }
  }

  const normalized = roles.map(role =>
    role.name === 'Viewer' || REQUEST_FEATURE_PERMISSIONS.every(id => role.permissions?.includes(id))
      ? role
      : { ...role, permissions: withRequestFeatures(role.permissions || []) }
  );
  const changedRoles = normalized.filter((role, index) => role !== roles[index]);
  if (changedRoles.length > 0) {
    localStorage.setItem(STORAGE_ROLES_KEY, JSON.stringify(normalized));
    if (isFirebaseConfigured && db) {
      await Promise.allSettled(changedRoles.map(role => updateDoc(doc(db!, 'roles', role.id), {
        permissions: role.permissions,
        updatedAt: serverTimestamp(),
      })));
    }
  }

  return syncWarehouseRoles(normalized);
}

async function syncRoleToUsers(savedRole: Role, previousName?: string): Promise<void> {
  const users = await getUsers();
  const affected = users.filter(u => u.role === savedRole.name || (previousName && u.role === previousName));
  if (affected.length === 0) return;

  const updatedUsers = users.map(u => affected.includes(u)
    ? { ...u, role: savedRole.name, permissions: savedRole.permissions, updatedAt: new Date() }
    : u);
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(updatedUsers));

  if (isFirebaseConfigured && db) {
    await Promise.all(affected.map(u => updateDoc(doc(db!, 'users', u.uid), {
      role: savedRole.name,
      permissions: savedRole.permissions,
      updatedAt: serverTimestamp()
    })));
  }
}

export async function saveRole(roleData: Partial<Role>, currentUser: UserProfile): Promise<Role> {
  const roles = await getRoles();
  const isEditing = Boolean(roleData.id);
  const previousName = isEditing ? roles.find(r => r.id === roleData.id)?.name : undefined;
  let savedRole: Role;

  if (isEditing) {
    savedRole = {
      ...roles.find(r => r.id === roleData.id)!,
      ...roleData,
      updatedAt: new Date()
    };
    if (savedRole.name !== 'Viewer') savedRole.permissions = withRequestFeatures(savedRole.permissions || []);
    const updatedRoles = roles.map(r => r.id === savedRole.id ? savedRole : r);
    localStorage.setItem(STORAGE_ROLES_KEY, JSON.stringify(updatedRoles));

    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, 'roles', savedRole.id), { ...savedRole, updatedAt: serverTimestamp() });
    }
    await syncRoleToUsers(savedRole, previousName);

    await logAudit({
      userId: currentUser.uid,
      userName: currentUser.displayName,
      action: 'UPDATE_ROLE',
      module: 'Role & Permission',
      description: `Mengubah role: ${savedRole.name}`
    });
  } else {
    const newId = 'role-' + Date.now();
    savedRole = {
      id: newId,
      name: roleData.name || 'Role Baru',
      description: roleData.description || '',
      permissions: roleData.name === 'Viewer' ? roleData.permissions || [] : withRequestFeatures(roleData.permissions || []),
      isSystem: false,
      isActive: roleData.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const updatedRoles = [...roles, savedRole];
    localStorage.setItem(STORAGE_ROLES_KEY, JSON.stringify(updatedRoles));

    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, 'roles', newId), { ...savedRole, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    await syncRoleToUsers(savedRole);

    await logAudit({
      userId: currentUser.uid,
      userName: currentUser.displayName,
      action: 'CREATE_ROLE',
      module: 'Role & Permission',
      description: `Membuat role baru: ${savedRole.name}`
    });
  }

  return savedRole;
}

export async function deleteRole(roleId: string, currentUser: UserProfile): Promise<void> {
  const roles = await getRoles();
  const target = roles.find(r => r.id === roleId);
  if (!target) throw new Error('Role tidak ditemukan');
  if (target.isSystem) throw new Error('Role sistem (Super Admin, Manager, dll) tidak dapat dihapus.');

  const users = await getUsers();
  const assignedUsers = users.filter(u => u.role === target.name);
  if (assignedUsers.length > 0) {
    throw new Error(`Role ini masih digunakan oleh ${assignedUsers.length} pengguna (${assignedUsers.map(u => u.displayName).join(', ')}). Pindahkan pengguna ke role lain sebelum menghapus.`);
  }

  const updatedRoles = roles.filter(r => r.id !== roleId);
  localStorage.setItem(STORAGE_ROLES_KEY, JSON.stringify(updatedRoles));

  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, 'roles', roleId));
  }

  await logAudit({
    userId: currentUser.uid,
    userName: currentUser.displayName,
    action: 'DELETE_ROLE',
    module: 'Role & Permission',
    description: `Menghapus role: ${target.name}`
  });
}

export async function getUsers(): Promise<UserProfile[]> {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      if (!snap.empty) {
        return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      }
    } catch (_e) {}
  }

  const saved = localStorage.getItem(STORAGE_USERS_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (_e) {}
  }

  return [];
}

export async function updateUserRoleAndStatus(
  targetUid: string, 
  newRole: string, 
  isActive: boolean, 
  currentUser: UserProfile
): Promise<void> {
  if (targetUid === currentUser.uid) {
    throw new Error('Keamanan: Anda tidak diizinkan mengubah role atau status akun Anda sendiri.');
  }

  const roles = await getRoles();
  const roleDef = roles.find(r => r.name === newRole);
  const permissions = roleDef ? roleDef.permissions : [];

  const users = await getUsers();
  const targetUser = users.find(u => u.uid === targetUid);
  if (!targetUser) throw new Error('Pengguna tidak ditemukan');

  const updatedUsers = users.map(u => u.uid === targetUid ? { ...u, role: newRole, permissions, isActive, updatedAt: new Date() } : u);
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(updatedUsers));

  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, 'users', targetUid), { role: newRole, permissions, isActive, updatedAt: serverTimestamp() });
  }

  await logAudit({
    userId: currentUser.uid,
    userName: currentUser.displayName,
    action: 'UPDATE_USER_ROLE',
    module: 'Pengguna',
    description: `Mengubah role ${targetUser.email} menjadi ${newRole} (Status aktif: ${isActive})`
  });
}

export type MigrateAuditLogsResult = {
  migratedCount: number;
  skippedCount: number;
  failedCount: number;
  mappings: Array<{ localId: string; firestoreId: string; status: 'migrated' | 'skipped' | 'failed'; reason?: string }>;
};

export async function migrateLocalAuditLogs(): Promise<MigrateAuditLogsResult> {
  if (!isFirebaseConfigured || !auth) throw new Error('Firebase belum dikonfigurasi.');
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi Anda tidak ditemukan. Silakan login ulang.');

  const localLogs = readLocalAuditLogs().filter((l) => isLocalAuditId(l.id) && !l.firestoreId && l.syncStatus !== 'migrated');
  if (localLogs.length === 0) {
    return { migratedCount: 0, skippedCount: 0, failedCount: 0, mappings: [] };
  }

  let token: string;
  try { token = await user.getIdToken(); } catch { throw new Error('Gagal mengambil sesi autentikasi. Silakan login ulang.'); }

  const payload = {
    logs: localLogs.slice(0, 50).map((l) => ({
      localId: l.localId || l.id,
      action: l.action,
      module: l.module,
      description: l.description,
      createdAt: typeof l.createdAt === 'string' ? l.createdAt : l.createdAt?.seconds ? new Date(l.createdAt.seconds * 1000).toISOString() : new Date().toISOString(),
      clientEventId: l.clientEventId || stableAuditFingerprint(l),
    })),
  };

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/audit-logs/migrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Backend migrasi tidak tersedia. Pastikan server aktif atau VITE_API_URL sudah dikonfigurasi.');
  }

  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json().catch(() => null) : null;
  if (!response.ok || !result?.success) {
    throw new Error((result && typeof result.message === 'string' && result.message) || 'Gagal migrasi log lokal.');
  }

  const mappings: MigrateAuditLogsResult['mappings'] = Array.isArray(result.mappings) ? result.mappings : [];
  const byLocalId = new Map(mappings.map((m) => [m.localId, m]));
  const updated: AuditLogLike[] = readLocalAuditLogs().map((l) => {
    const map = byLocalId.get(l.localId || l.id);
    if (!map) return l;
    if (map.status === 'migrated' || map.status === 'skipped') {
      return { ...l, syncStatus: 'migrated' as const, source: 'local' as const, firestoreId: map.firestoreId || l.firestoreId, syncError: undefined, lastSyncAttemptAt: new Date().toISOString() };
    }
    return { ...l, syncStatus: 'failed' as const, syncError: map.reason || 'Gagal migrasi item.', lastSyncAttemptAt: new Date().toISOString() };
  });
  writeLocalAuditLogs(updated);

  return {
    migratedCount: Number(result.migratedCount) || 0,
    skippedCount: Number(result.skippedCount) || 0,
    failedCount: Number(result.failedCount) || 0,
    mappings,
  };
}

export type LogAuditResult = {
  savedLocal: boolean;
  synced: boolean;
  id: string;
  syncError?: string;
};

export async function logAudit(data: Omit<AuditLog, 'id' | 'createdAt' | 'source' | 'syncStatus' | 'firestoreId' | 'localId'>): Promise<LogAuditResult> {
  const now = new Date();
  const localId = 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

  if (!isFirebaseConfigured || !db) {
    const localLog: AuditLogLike = {
      id: localId,
      localId,
      ...data,
      createdAt: now.toISOString(),
      source: 'local',
      syncStatus: 'pending',
      syncError: 'Firebase belum dikonfigurasi.',
      lastSyncAttemptAt: now.toISOString(),
    };
    const logs = readLocalAuditLogs();
    logs.unshift(localLog);
    writeLocalAuditLogs(logs);
    return { savedLocal: true, synced: false, id: localId, syncError: localLog.syncError };
  }

  try {
    const ref = doc(collection(db, 'audit_logs'));
    await setDoc(ref, {
      userId: data.userId,
      userName: data.userName,
      action: data.action,
      module: data.module,
      description: data.description,
      ...(data.ipAddress ? { ipAddress: data.ipAddress } : {}),
      createdAt: serverTimestamp(),
      clientTimestamp: now.toISOString(),
      source: 'client',
    });

    const syncedLog: AuditLogLike = {
      id: ref.id,
      firestoreId: ref.id,
      localId,
      ...data,
      createdAt: now.toISOString(),
      source: 'firestore',
      syncStatus: 'synced',
      lastSyncAttemptAt: now.toISOString(),
    };
    const logs = readLocalAuditLogs().filter((l) => l.id !== localId);
    logs.unshift(syncedLog);
    writeLocalAuditLogs(logs);
    return { savedLocal: true, synced: true, id: ref.id };
  } catch (error) {
    const syncError = error instanceof Error ? error.message : 'Gagal menyinkronkan audit log ke Firestore.';
    const pendingLog: AuditLogLike = {
      id: localId,
      localId,
      ...data,
      createdAt: now.toISOString(),
      source: 'local',
      syncStatus: 'failed',
      syncError,
      lastSyncAttemptAt: now.toISOString(),
      clientEventId: stableAuditFingerprint({ id: localId, localId, ...data, createdAt: now.toISOString() } as any),
    };
    const logs = readLocalAuditLogs();
    logs.unshift(pendingLog);
    writeLocalAuditLogs(logs);
    console.warn('Audit log disimpan lokal karena gagal sinkron ke Firestore.', { action: data.action, module: data.module });
    return { savedLocal: true, synced: false, id: localId, syncError };
  }
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const localLogs = readLocalAuditLogs();
  const pendingLocal = localLogs.filter((l) => l.source !== 'firestore' || l.syncStatus === 'pending' || l.syncStatus === 'failed' || isLocalAuditId(l.id));

  if (isFirebaseConfigured && db) {
    try {
      let rows: AuditLogLike[] = [];
      try {
        const snap = await getDocs(query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc')));
        rows = snap.docs.map(d => normalizeAuditLog({ id: d.id, ...d.data() }, 'firestore'));
      } catch {
        const snap = await getDocs(collection(db, 'audit_logs'));
        rows = snap.docs.map(d => normalizeAuditLog({ id: d.id, ...d.data() }, 'firestore')).sort((a, b) => {
          const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime();
          const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime();
          return tB - tA;
        });
      }

      const firestoreIds = new Set(rows.map((r) => r.id));
      const migratedIds = new Set(localLogs.map((l) => l.firestoreId).filter(Boolean) as string[]);
      const unsynced = pendingLocal.filter((l) => !firestoreIds.has(l.id) && !migratedIds.has(l.id) && !l.firestoreId);
      return [...unsynced, ...rows].sort((a, b) => {
        const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime();
        const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime();
        return tB - tA;
      });
    } catch (error) {
      if (pendingLocal.length > 0) return pendingLocal;
      throw error;
    }
  }

  return localLogs;
}

const STORAGE_ARCHIVE_KEY = 'silog_audit_archives';

export async function getArchivedAuditLogs(): Promise<AuditLogArchive[]> {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(query(collection(db, 'audit_log_archives'), orderBy('archivedAt', 'desc')));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogArchive));
    } catch (_e) {
      try {
        const snap = await getDocs(collection(db, 'audit_log_archives'));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogArchive)).sort((a, b) => {
          const tA = a.archivedAt?.seconds ? a.archivedAt.seconds * 1000 : new Date(a.archivedAt).getTime();
          const tB = b.archivedAt?.seconds ? b.archivedAt.seconds * 1000 : new Date(b.archivedAt).getTime();
          return tB - tA;
        });
      } catch (error) {
        console.warn('Gagal memuat audit_log_archives dari Firestore.', error);
        throw error;
      }
    }
  }

  const saved = localStorage.getItem(STORAGE_ARCHIVE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (_e) {}
  }
  return [];
}

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
}

function formatDeleteAuditApiError(status: number, payload: any): string {
  const message = typeof payload?.message === 'string' ? payload.message : '';
  if (status === 400) return message || 'Permintaan hapus tidak valid. Periksa data yang dipilih.';
  if (status === 401) return 'Sesi Anda tidak valid atau kedaluwarsa. Silakan login ulang.';
  if (status === 403) return 'Anda tidak memiliki izin untuk menghapus aktivitas.';
  if (status === 404) return 'Endpoint hapus tidak ditemukan. Pastikan backend aktif dan VITE_API_URL dikonfigurasi dengan benar.';
  if (status === 409) return message || 'Sebagian aktivitas tidak ditemukan. Muat ulang data.';
  if (status === 429) return message || 'Terlalu banyak permintaan hapus. Coba lagi beberapa menit lagi.';
  if (status >= 500) return 'Server gagal memproses hapus. Coba lagi beberapa saat.';
  return message || 'Gagal menghapus aktivitas.';
}

export async function deleteAuditLogs(logIds: string[]): Promise<{ deletedCount: number; deletedIds: string[] }> {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const invalidLocalIds = logIds.filter((id) => isLocalAuditId(id));
  if (invalidLocalIds.length > 0) {
    throw new Error('Log lokal/belum tersinkron tidak dapat dihapus dari server. Hapus hanya log Firestore yang tersinkron.');
  }

  const user = auth.currentUser;
  if (!user) throw new Error('Sesi Anda tidak ditemukan. Silakan login ulang.');

  let token: string;
  try {
    token = await user.getIdToken();
  } catch {
    throw new Error('Gagal mengambil sesi autentikasi. Silakan login ulang.');
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/audit-logs/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ logIds }),
    });
  } catch {
    throw new Error('Backend hapus tidak tersedia. Pastikan server aktif atau VITE_API_URL sudah dikonfigurasi.');
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok || !payload?.success) {
    if (response.ok && !payload) {
      throw new Error('Respons hapus tidak valid. Pastikan endpoint /api/audit-logs/delete mengarah ke backend, bukan frontend.');
    }
    throw new Error(formatDeleteAuditApiError(response.status, payload));
  }

  return { deletedCount: payload.deletedCount ?? logIds.length, deletedIds: payload.deletedIds ?? logIds };
}
