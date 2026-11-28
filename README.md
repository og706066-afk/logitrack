# LOGITRACK / SILOG — Sistem Manajemen Logistik Terintegrasi

Frontend: React 19 + Vite + TypeScript + Tailwind CSS v4.
Database & Auth: Firebase Firestore, Authentication, Storage.
Backend: Express + Firebase Admin SDK (dipertahankan dari project existing).
Ekspor/Import: ExcelJS, jsPDF + jspdf-autotable.

## Menjalankan aplikasi

```bash
npm install
npm run dev
npm run build
npm run lint
npm test
```

Backend opsional (untuk endpoint Admin SDK):

```bash
cd server
npm install
npm run dev
npm run typecheck
npm run create-admin
npm run seed-master
```

`npm run seed-master` mengisi master kategori, KORDA, dan bagian ke Firestore melalui Admin SDK. Script hanya membuat dokumen yang belum ada, tidak menimpa data lama. Kredensial Admin SDK harus tersedia lewat `GOOGLE_APPLICATION_CREDENTIALS` atau Application Default Credentials.

## Konfigurasi Firebase

File `.env` (tidak masuk git):

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_URL=
```

`VITE_API_URL` adalah base URL backend Express yang sudah di-deploy (tanpa trailing slash), misalnya `https://silog-api.onrender.com`. Variabel ini wajib diisi di Vercel **Project Settings → Environment Variables** untuk Production, Preview, dan Development. Jika kosong, frontend memanggil `/api/...` ke origin yang sama dengan aplikasi; karena `vercel.json` hanya berisi SPA rewrite ke `index.html`, permintaan `POST /api/audit-logs/archive` akan ditolak dengan `405 Method Not Allowed`.

Backend yang dituju harus mengizinkan origin frontend melalui `CORS_ORIGIN` (bisa beberapa origin, dipisah koma), misalnya `CORS_ORIGIN=https://logitrack.vercel.app`. Selain itu, tambahkan origin backend tersebut ke directive `connect-src` pada header `Content-Security-Policy` di `vercel.json`, karena nilai bawaan hanya `connect-src 'self' ...`:

```text
connect-src 'self' https://silog-api.onrender.com https://*.googleapis.com ...
```

Setelah mengubah environment variable atau `vercel.json`, lakukan redeploy agar perubahan berlaku.

Deploy rules:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Vercel: gunakan `vercel.json` yang sudah ada (SPA rewrite). Tambahkan semua variabel `VITE_FIREBASE_*` dan `VITE_API_URL` di Project Settings seperti di atas. Hosting Firebase tidak dipakai untuk aplikasi; Firestore/Storage tetap berada di project Firebase yang sama.

## Struktur data Firestore

Sumber stok tunggal: `products.currentStock`. Semua mutasi stok wajib lewat `stockTransactions` dan dikonfirmasi dengan Firestore transaction, sehingga `stok akhir = stok awal + masuk - keluar + penyesuaian` konsisten. Koleksi lama (`stock_batches`, `stock_movements`, `stock_in`, `stock_out`, `requests`, `deliveries`) dipertahankan untuk fitur lama dan kompatibilitas; `stockTransactions` menjadi buku besar stok baru.

| Koleksi | Fungsi |
| --- | --- |
| `users`, `roles`, `permissions`, `audit_logs` | Autentikasi, RBAC, jejak audit existing |
| `products`, `categories`, `warehouses`, `suppliers` | Master barang & gudang existing (products juga menjadi master barang terpusat) |
| `kordas`, `departments` | Master KORDA & bagian, dikelola admin lewat Firestore |
| `needsRequests` | Pengajuan kebutuhan + persetujuan |
| `shipments` | Monitoring pengiriman, bukti foto, konfirmasi penerimaan |
| `stockTransactions` | Barang masuk, keluar, penyesuaian, stock opname + saldo |
| `distributions` | Distribusi per bagian/pengguna |
| `financeTransactions` | Buku kas terpisah dari stok |
| `regions`, `recipients` | Wilayah, RT, penerima distribusi |
| `activityLogs`, `notifications` | Aktivitas & notifikasi |

Setiap dokumen baru memiliki `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `status` dengan `serverTimestamp()`. Relasi memakai document ID (`itemId`, `categoryId`, `kordaId`, `departmentId`, `referenceId`). Tidak ada koleksi `items` duplikat: `products` adalah koleksi inventaris tunggal.

## Hak akses

Role existing tetap dipertahankan. Permission baru ditambahkan di `src/services/rbacService.ts`; preset role sistem disinkronkan ulang otomatis saat `getRoles()` dipanggil, dan `hasPermission()` menggabungkan permission user, role, serta fallback role. Frontend memakai `useAuth().hasPermission`, backend memakai middleware `verifyIdToken` + pengecekan permission di `server/src/index.ts`, Firestore memakai `hasPermission()`/`can()` di `firestore.rules`.

Ringkasan target:
- **Super Admin**: seluruh akses.
- **Manager**: dashboard, approval kebutuhan/transaksi, monitoring pengiriman, laporan.
- **Staf Gudang**: master barang, barang masuk/keluar, stok, stock opname.
- **Driver**: tugas pengiriman milik sendiri, update status, upload bukti.

Rules juga membatasi `users` hanya bisa dibaca oleh pemilik akun, Super Admin, dan role yang memang perlu menugaskan driver (Manager/Staf Gudang/Staf Logistik/Kepala Gudang), menutup celah update `delivery_details`, serta memaksa identitas pembuat transaksi sama dengan `request.auth.uid`. Query pengiriman untuk Driver dipaksa memakai filter `driverId == uid`.

## Modul yang tersedia

Rute existing (`/products`, `/categories`, `/suppliers`, `/stock-in`, `/stock-out`, `/warehouse-stock`, `/kitchen-requests`, `/deliveries`, `/drivers`, `/reports`, `/users`, `/roles`, `/settings`, `/audit-logs`) tetap berjalan. Rute baru (halaman import Excel terpisah sudah dihapus):

| Rute | Modul |
| --- | --- |
| `/needs` | Pengajuan & persetujuan kebutuhan barang |
| `/shipments` | Pengiriman terintegrasi + bukti foto |
| `/stock-control` | Transaksi stok, kartu stok, stock opname, penyesuaian |
| `/master-data` | Master KORDA & bagian |
| `/finance` | Pemasukan, pengeluaran, buku kas, saldo, ekspor |
| `/regions` | Wilayah, RT, penerima, riwayat penyaluran |
| `/reports-advanced` | 12 jenis laporan + Excel/PDF/cetak |

Dashboard menampilkan 12 ringkasan, grafik masuk/keluar, stok per kategori, distribusi pengiriman, aktivitas, peringatan stok minimum, filter periode, dan filter kategori. Seluruh angka berasal dari Firestore.

`DataTable` di `src/components/DataViews.tsx` otomatis menyediakan **Filter checkbox** untuk kolom dengan nilai berulang (misalnya status, kategori, gudang, role). Kolom dengan kardinalitas 2–12 dipilih otomatis; gunakan `filterable={true}` / `filterable={false}` atau `filterValue` pada `TableColumn` untuk mengontrolnya. Filter antar kolom bersifat AND, pilihan dalam satu kolom bersifat OR, dan tombol **Reset filter** mengembalikan semua baris.

Fitur **Impor Excel** kini tersemat di setiap halaman tabel data yang dapat ditambah/edit (komponen `src/components/ExcelImport.tsx` dan otomatis pada `ResourceManager`), lengkap dengan pemetaan kolom, preview, validasi required/duplikat, dan permission `imports.execute`.

`DataTable` juga menyediakan checkbox baris + **Pilih semua**. Jika `onDelete`/`onBulkDelete` tersedia, muncul aksi hapus/nonaktifkan massal untuk semua baris yang dicentang (hanya baris pada halaman/filter aktif). Master Barang (`inventory.tsx`) menghapus permanen; Wilayah & Penerima (`regions.tsx`) menonaktifkan massal.

## Perubahan utama

- Menambahkan service Firestore bertipe `src/services/logitrackService.ts` dan tipe `src/types/logitrack.ts`.
- Master barang existing ditingkatkan: kode otomatis, kategori, satuan fleksibel, stok awal/tersedia/minimum, gudang, status, pencarian, filter kategori/stok, pagination.
- Transaksi lama (`stock-in`, `stock-out`, permintaan dapur) kini ikut menulis `stockTransactions` sehingga stok tidak diubah langsung tanpa buku besar.
- Firestore transaction dipakai saat konfirmasi stok; saldo negatif ditolak; satuan divalidasi.
- Upload bukti memakai Firebase Storage (`storage.rules`); tidak lagi URL bebas dari `prompt`.
- ExcelJS & jsPDF dimuat dynamic import agar bundle awal lebih ringan.
- Backend Express mendapat autentikasi token, pengecekan permission, dan endpoint ringkasan laporan.
- Bug rules diperbaiki: `delivery_details`, pembacaan `users`, dan permission approve pada detail permintaan.

## Pengujian

- `npm run build` — lolos.
- `npm run lint` — lolos tanpa error (warning existing tetap ada).
- `npm --prefix server run typecheck` — lolos.
- `npm test` — unit test (tanpa emulator), lolos.
- `npm run test:rules` — test Firestore Security Rules; memerlukan Java + Firebase CLI. Di lingkungan tanpa Java, emulator tidak dapat dijalankan.
- `npm run test:all` — menjalankan keduanya.
