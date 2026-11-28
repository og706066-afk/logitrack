# CRUD — LOGITRACK / SILOG

Matriks ini merangkum operasi **Create / Read / Update / Delete** berdasarkan `firestore.rules`, permission di `src/services/rbacService.ts`, dan endpoint backend Express.

## 1. Legenda

| Simbol | Arti |
| --- | --- |
| `SA` | Super Admin |
| `M` | Manager |
| `KG` | Kepala Gudang |
| `SG` | Staf Gudang |
| `SUB` | Sub Gudang (Staf Bahan Dapur, Konsumsi, Sayuran, Bumbu Alam, Logistik, Kebersihan) |
| `D` | Driver |
| `V` | Viewer / user aktif lain |
| `P` | Pemilik dokumen (`createdBy`, `userId`, atau `driverId == auth.uid`) |
| `API` | Backend Express via Firebase Admin SDK (melewati client rules) |
| `✓` | Diizinkan |
| `⚠` | Diizinkan dengan syarat/field whitelist |
| `✗` | Ditolak |
| `—` | Tidak relevan / tidak diimplementasikan |

Syarat umum: user harus login dan aktif. Permission dicatat di `users.permissions` atau `roles.permissions`; `hasPermission()` pada frontend menggabungkan keduanya plus fallback role, sedangkan `firestore.rules` memeriksa `users.permissions` dan beberapa hardcoded role.

## 2. Matriks CRUD per koleksi

| Koleksi | Create | Read | Update | Delete |
| --- | --- | --- | --- | --- |
| `users` | `SA` (whitelist ketat) atau `P` registrasi Viewer | `P`, `SA`, `M`, `KG`, `SG`/Staf Logistik | `SA`, atau `P` hanya `name/displayName/phoneNumber/updatedAt` | `SA` |
| `roles` | `SA` | user aktif | `SA` | `SA` |
| `permissions` | `SA` | user aktif | `SA` | `SA` |
| `audit_logs` | user aktif, `userId == uid`, field whitelist | user aktif | `✗` (client) | `✗` (client), `API` via `/delete` |
| `audit_log_archives` | `✗` (client), `API` | `SA` | `✗` (client), `API` | `✗` |
| `products` | `SA`, `KG`, `SG` (`products.create`/`items.create`) | user aktif | `SA`, `KG`, `SG` | `SA`, `KG`, `SG` |
| `categories` | `SA`, `KG`, `SG` | user aktif | `SA`, `KG`, `SG` | `SA`, `KG` |
| `suppliers` | `SA`, `KG` | user aktif | `SA`, `KG` | `SA`, `KG` |
| `warehouses` | `SA`, `KG`, `SG` | user aktif | `SA`, `KG`, `SG` | `SA`, `KG` |
| `stock_batches` | `SA`, `KG`, `SG`, `SUB` | user aktif | `SA`, `KG`, `SG`, `SUB` | `SA`, `KG` |
| `stock_in` | `SA`, `KG`, `SG`, `SUB` | user aktif | `SA`, `KG`, `SG`, `SUB` | `SA`, `KG` |
| `stock_out` | `SA`, `KG`, `SG`, `SUB` | user aktif | `SA`, `KG`, `SG`, `SUB` | `SA`, `KG` |
| `requests` | `SA`, `KG`, `SG`, `M`, `D` (sesuai permission) | user aktif | `SA`, atau `M` ⚠ hanya status/approval | `SA` / pemilik permission `requests.delete` |
| `request_details` | user aktif + permission `requests.create` + induk valid | user aktif | `SA` / permission approval-create, `requestId` immutable | `SA` / permission `requests.delete` |
| `deliveries` | `SA`, Staf Logistik | user aktif; `D` ⚠ hanya `driverId == uid` | `SA`, `M`, `SG`; `D` ⚠ field terbatas | `SA` / permission `deliveries.delete` |
| `delivery_details` | `SA` / `deliveries.create` | user aktif; `D` ⚠ jika induk ditugaskan | `SA`, `M`, `SG`, `D` ⚠ | `SA` / permission `deliveries.delete` |
| `vehicles` | `SA`, Staf Logistik | user aktif | `SA`, Staf Logistik | `SA` / permission `vehicles.delete` |
| `stock_movements` | `SA`, `KG`, `SG`, `SUB` | user aktif | `SA`, `KG`, `SG`, `SUB` | `SA`, `KG` |
| `kordas` | `SA` / `kordas.manage` | user aktif | `SA` / `kordas.manage` | `SA` / `kordas.manage` |
| `departments` | `SA` / `departments.manage` | user aktif | `SA` / `departments.manage` | `SA` / `departments.manage` |
| `needsRequests` | `SA`, `M`, `KG`, `SG`, `D`, `SUB` ⚠ `status = Pending`, `createdBy = uid` | user aktif | `SA`; `M` ⚠ approval; `P` ⚠ edit saat Pending | `SA` |
| `shipments` | `SA` / `shipments.create`, `createdBy = uid` | user aktif; `D` ⚠ hanya `driverId == uid` | `SA`, `M` (`shipments.edit`); `D` ⚠ field terbatas | `SA` |
| `stockTransactions` | `SA`, `SG`, `KG`, `SUB` ⚠ `createdBy = uid`, status Draft/Confirmed | `SA`, `M`, `SG` (`stockTransactions.view`) | `SA`, `M`, `SG`, `KG`, `SUB` ⚠ whitelist | `✗` (client) |
| `distributions` | `SA`, `SG` ⚠ `createdBy = uid` | `SA`, `M`, `SG` | `SA`, `SG` | `SA` |
| `financeTransactions` | `SA` / `finance.create` ⚠ `createdBy = uid` | `SA` / `finance.view` | `SA` / `finance.edit` | `SA` |
| `regions` | `SA` / `regions.manage` | `SA` / `regions.view` | `SA` / `regions.manage` | `SA` / `regions.manage` |
| `recipients` | `SA` / `regions.manage` | `SA` / `regions.view` | `SA` / `regions.manage` | `SA` / `regions.manage` |
| `activityLogs` | user aktif, `userId == uid` | user aktif | `✗` | `✗` |
| `notifications` | `SA` | `P` (`userId == uid`) | `SA` | `SA` |
| `audit_log_migration_locks` | `✗` (client), `API` | `✗` (client) | `✗` | `✗` |

Catatan: tabel "Read" untuk `users` memakai `isAuthenticated()` pada rules, sedangkan sebagian koleksi lain memakai `isUserActive()`/`can()`.

## 3. Endpoint backend

| Method | Path | Middleware | Fungsi |
| --- | --- | --- | --- |
| `GET` | `/api/health` | publik | Health check |
| `GET` | `/api/test/firebase` | publik | Cek koneksi Admin SDK & Firestore |
| `GET` | `/api/me` | `authenticate` | Profil user dari Admin SDK |
| `GET` | `/api/reports/summary` | `authenticate` + `requirePermission('reports.view')` | Ringkasan `products`, `needsRequests`, `shipments`, `stockTransactions` |
| `POST` | `/api/audit-logs/delete` | rate limit 30/15 menit + `authenticate` + `requireSuperAdmin` | Hapus maks. 50 `audit_logs` via transaction |
| `POST` | `/api/audit-logs/migrate` | rate limit 20/15 menit + `authenticate` + `requireSuperAdmin` | Migrasi log lokal ke `audit_logs` + lock |

Middleware:
- `authenticate`: verifikasi Firebase ID token, mencari dokumen `users/{uid}`, menolak user nonaktif.
- `requireSuperAdmin`: hanya role `Super Admin`.
- `requirePermission(x)`: mengizinkan `Super Admin`, `permissions.includes(x)`, atau `permissions.includes('*')`.

## 4. Alur CRUD khas

### Transaksi stok
1. `POST`/create `stockTransactions` dengan status `Draft` oleh SG/KG/SUB.
2. Manager/SA mengubah status menjadi `Confirmed`.
3. Firestore transaction membaca `products.currentStock`, memvalidasi satuan dan saldo, lalu menulis balik saldo.
4. Client tidak dapat menghapus transaksi stok; pembatalan dilakukan lewat perubahan status/penyesuaian.

### Kebutuhan barang
1. Staf membuat `needsRequests` `Pending` dengan `createdBy = uid`.
2. Manager menyetujui/menolak: `status`, `approvedBy`, `approvedAt`, `rejectedReason`.
3. Edit hanya saat masih `Pending` oleh pembuat. Hapus hanya Super Admin.

### Pengiriman
1. Manager/Staf membuat `shipments` dengan `driverId`.
2. Driver melihat hanya dokumen dengan `driverId == uid`.
3. Driver mengubah status, `receivedQuantity`, `proofPhotos`, catatan.
4. Penerima/Manager melakukan konfirmasi akhir.

### Audit log
1. Setiap aksi sensitif menulis `audit_logs` dengan `userId == auth.uid`.
2. Client tidak dapat update/delete.
3. Super Admin dapat menghapus lewat backend `/delete` atau mengarsipkan lewat service backend.
4. Arsip hanya dapat dibaca Super Admin.

## 5. Inkonsistensi yang perlu dicatat saat ujikom

1. `finance.view`, `regions.view`, `regions.manage`, `kordas.manage`, `departments.manage`, `users.*`, dan `roles.*` tidak termasuk preset role sistem; praktiknya hanya SA/role kustom.
2. Preset Driver memiliki `shipments.confirm`, tetapi rules mengizinkan konfirmasi tanpa pembatasan owner pada cabang `can('shipments.confirm')`; pembatasan `driverId == uid` hanya kuat pada cabang `isAssignedDriver`.
3. `requests.reject` dan `needsRequests.reject` ada sebagai permission, tetapi rules mengimplementasikan penolakan sebagai update `status` di bawah permission approve.
4. UI `/audit-logs` digate oleh `users.view`, sedangkan rules membolehkan user aktif membaca `audit_logs`.
5. Backup memakai permission UI `backup.export`; tidak ada rules Firestore khusus untuk permission ini, sehingga koleksi yang tidak bisa dibaca akan muncul sebagai "Gagal" di ringkasan.
