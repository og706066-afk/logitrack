# BACKUP DATA — LOGITRACK / SILOG

Fitur backup data menyediakan unduhan salinan data Firestore dalam dua format: **Excel (.xlsx)** dan **PDF (.pdf)**. Fitur ini berada di halaman `/backup` dan tidak memakai endpoint backend khusus.

## 1. Lokasi implementasi

| File | Peran |
| --- | --- |
| `src/pages/BackupData.tsx` | Halaman UI, tombol unduh, ringkasan koleksi |
| `src/services/backupService.ts` | Daftar koleksi & pembaca dokumen Firestore |
| `src/utils/exports.ts` | `exportBackupToExcel()` dan `exportBackupToPdf()` |
| `src/App.tsx` | Rute `/backup` dengan `ProtectedRoute requiredPermission="backup.export"` |
| `src/components/Sidebar.tsx` | Menu **Admin → Backup Data** |
| `src/services/rbacService.ts` | Permission `backup.export` (module `Pengaturan`, action `export`) |

## 2. Akses dan alur pengguna

1. Pengguna login dan memiliki permission `backup.export`. Super Admin otomatis memiliki akses melalui bypass `hasPermission()`.
2. Buka menu **Admin → Backup Data** atau langsung `/backup`.
3. Halaman memuat ringkasan: jumlah koleksi, total dokumen, jumlah koleksi gagal dibaca.
4. Klik **Unduh Excel** atau **Unduh PDF**.
5. Sistem membaca ulang data Firestore saat tombol ditekan, lalu menghasilkan file:
   - `backup-silog-YYYY-MM-DD.xlsx`
   - `backup-silog-YYYY-MM-DD.pdf`
6. Jumlah dokumen dan status tiap koleksi ditampilkan pada notifikasi sukses.

## 3. Koleksi yang dicakup

Berikut 29 koleksi Firestore yang dibaca oleh `src/services/backupService.ts`:

| No | Koleksi | Label UI |
| --- | --- | --- |
| 1 | `users` | Pengguna |
| 2 | `roles` | Role |
| 3 | `permissions` | Permission |
| 4 | `audit_logs` | Audit Log |
| 5 | `audit_log_archives` | Arsip Audit Log |
| 6 | `products` | Master Barang |
| 7 | `categories` | Kategori |
| 8 | `suppliers` | Supplier |
| 9 | `warehouses` | Gudang |
| 10 | `stock_batches` | Batch Stok |
| 11 | `stock_in` | Barang Masuk |
| 12 | `stock_out` | Barang Keluar |
| 13 | `requests` | Permintaan Dapur |
| 14 | `request_details` | Detail Permintaan |
| 15 | `deliveries` | Pengiriman Lama |
| 16 | `delivery_details` | Detail Pengiriman |
| 17 | `vehicles` | Kendaraan |
| 18 | `stock_movements` | Pergerakan Stok |
| 19 | `kordas` | KORDA |
| 20 | `departments` | Bagian |
| 21 | `needsRequests` | Kebutuhan Barang |
| 22 | `shipments` | Pengiriman |
| 23 | `stockTransactions` | Transaksi Stok |
| 24 | `distributions` | Distribusi |
| 25 | `financeTransactions` | Transaksi Keuangan |
| 26 | `regions` | Wilayah |
| 27 | `recipients` | Penerima |
| 28 | `activityLogs` | Aktivitas |
| 29 | `notifications` | Notifikasi |

Koleksi `audit_log_migration_locks` tidak termasuk daftar backup karena merupakan lock teknis server-only.

## 4. Spesifikasi keluaran

### 4.1 Excel

- Dibuat dengan **ExcelJS** melalui dynamic import.
- Lembar pertama: `Ringkasan` berisi `Koleksi`, `Nama Firestore`, `Jumlah Dokumen`, `Status`.
- Satu lembar per koleksi yang berhasil dibaca.
- Kolom: `ID Dokumen` + seluruh field yang ditemukan pada dokumen koleksi tersebut.
- Header dibekukan dan diberi filter otomatis.
- Field bertipe `Timestamp`, `{seconds}`, `Date`, boolean, array, atau objek dikonversi ke teks yang dapat dibaca.
- Nama lembar dibatasi maksimal 31 karakter dan dibuat unik.

### 4.2 PDF

- Dibuat dengan **jsPDF** + **jspdf-autotable** melalui dynamic import.
- Orientasi `landscape`, format A4.
- Bagian awal: judul `Backup Data SILOG`, tanggal cetak, total dokumen, dan tabel ringkasan koleksi.
- Setiap koleksi mendapat judul + tabel tersendiri.
- Kolom dibatasi **maksimal 8 kolom**, dengan urutan prioritas: `name`, `displayName`, `userName`, `status`, `createdAt`, `updatedAt`, `requestNumber`, `transactionNumber`, `shipmentNumber`, `distributionNumber`.
- Nilai sel dipotong maksimal 160 karakter agar tabel tetap terbaca.
- Untuk backup penuh dengan seluruh field, gunakan Excel.

## 5. Pembacaan data dan keamanan

- Pembacaan memakai `getDocs(collection(db, name))` langsung dari client.
- Artinya pembacaan tetap tunduk pada `firestore.rules`.
- Jika sebuah koleksi gagal dibaca, error ditangkap per koleksi dan ditampilkan sebagai status **Gagal**; koleksi lain tetap diunduh.
- Permission `backup.export` hanya diberikan oleh UI/route. Tidak ada aturan khusus di `firestore.rules` untuk permission ini.
- Role preset sistem tidak memberikan `backup.export`, jadi selain Super Admin harus dibuat role/user kustom yang memilikinya.

## 6. Batasan

1. Backup hanya mencakup dokumen Firestore, bukan file Firebase Storage seperti `proofPhotos` dan `proofUrl`.
2. Audit log lokal yang belum tersinkron ke Firestore tidak termasuk backup.
3. Koleksi yang akses bacanya ditolak rules akan kosong/berstatus gagal.
4. Tidak ada penjadwalan otomatis; backup dilakukan manual lewat tombol.
5. File dihasilkan di browser, sehingga ukuran data yang bisa dibackup bergantung pada memori/browser pengguna.

## 7. Verifikasi yang dilakukan

- `npm run lint` — lolos dengan warning yang sudah ada sebelumnya.
- `npm run build` — lolos.
- `npm run typecheck` pada folder `server` — lolos.

Untuk menguji manual: login sebagai Super Admin → buka `/backup` → pastikan ringkasan muncul → klik **Unduh Excel** dan **Unduh PDF** → periksa nama file, lembar `Ringkasan`, dan tabel per koleksi.
