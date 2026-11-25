import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import type { Permission, Role, UserProfile, AuditLog } from '../types';

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

const SYSTEM_ROLE_PRESETS = [...WAREHOUSE_ROLE_PRESETS, ...ADDITIONAL_ROLE_PRESETS];

async function syncWarehouseRoles(roles: Role[]): Promise<Role[]> {
  const presetsByName = new Map(SYSTEM_ROLE_PRESETS.map(role => [role.name, role]));
  const updated: Role[] = [];

  const merged = roles.map(role => {
    const preset = presetsByName.get(role.name);
    if (!preset || role.isSystem === false) return role;
    const canonical: Role = {
      ...role,
      permissions: preset.permissions,
      description: preset.description,
      isSystem: true,
      isActive: true,
      updatedAt: new Date(),
    };
    updated.push(canonical);
    return canonical;
  });

  const existingNames = new Set(merged.map(role => role.name));
  const missing = SYSTEM_ROLE_PRESETS.filter(role => !existingNames.has(role.name));
  const finalRoles = [...merged, ...missing];

  if (updated.length === 0 && missing.length === 0) return roles;

  localStorage.setItem(STORAGE_ROLES_KEY, JSON.stringify(finalRoles));

  if (isFirebaseConfigured && db) {
    await Promise.allSettled([
      ...updated.map(role => updateDoc(doc(db!, 'roles', role.id), {
        permissions: role.permissions,
        description: role.description,
        isSystem: true,
        isActive: true,
        updatedAt: serverTimestamp(),
      })),
      ...missing.map(role => setDoc(doc(db!, 'roles', role.id), {
        ...role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })),
    ]);
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

  return syncWarehouseRoles(roles);
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
      permissions: roleData.permissions || [],
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

export async function logAudit(data: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
  const newLog: AuditLog = {
    id: 'log-' + Date.now() + '-' + Math.floor(Math.random()*1000),
    ...data,
    createdAt: new Date()
  };

  const saved = localStorage.getItem(STORAGE_AUDIT_KEY);
  const logs: AuditLog[] = saved ? JSON.parse(saved) : [];
  logs.unshift(newLog);
  localStorage.setItem(STORAGE_AUDIT_KEY, JSON.stringify(logs.slice(0, 200)));

  if (isFirebaseConfigured && db) {
    try {
      await addDoc(collection(db, 'audit_logs'), { ...newLog, createdAt: serverTimestamp() });
    } catch (_e) {}
  }
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'audit_logs'));
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)).sort((a,b) => {
          const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime();
          const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime();
          return tB - tA;
        });
      }
    } catch (_e) {}
  }

  const saved = localStorage.getItem(STORAGE_AUDIT_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (_e) {}
  }
  return [];
}
