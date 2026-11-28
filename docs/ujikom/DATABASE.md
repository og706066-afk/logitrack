# DATABASE — LOGITRACK / SILOG

Database yang dipakai adalah **Cloud Firestore** (NoSQL document database). Backend Express memakai Firebase Admin SDK untuk sebagian operasi. Tidak ada schema SQL; "database" di dokumen ini berarti inventaris koleksi, field, dan relasi logisnya.

## 1. Prinsip desain data

1. `products` adalah **satu-satunya** koleksi master inventaris. Tidak ada koleksi `items`; ID permission `items.*` bukan nama koleksi.
2. `products.currentStock` adalah **source of truth** saldo stok. Semua mutasi harus tercatat di `stockTransactions` melalui Firestore transaction.
3. Koleksi lama tetap dipertahankan untuk kompatibilitas: `stock_batches`, `stock_movements`, `stock_in`, `stock_out`, `requests`, `request_details`, `deliveries`, `delivery_details`, `vehicles`.
4. Dokumen modul baru umumnya memiliki audit fields: `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `status` dengan `serverTimestamp()`.
5. Relasi memakai document ID (`itemId`, `categoryId`, `kordaId`, `departmentId`, `userId`, `driverId`, `referenceId`). Tidak ada foreign key fisik.
6. Field nama (`categoryName`, `itemName`, `driverName`, dll.) adalah **denormalisasi** untuk tampilan, bukan entitas baru.

## 2. Inventaris koleksi

### 2.1 Autentikasi, RBAC, dan audit

| Koleksi | Fungsi | Field utama |
| --- | --- | --- |
| `users` | Profil & hak akses pengguna | `uid` (= document ID = Firebase Auth UID), `email`, `displayName`, `name?`, `role`, `permissions[]`, `isActive`, `phoneNumber?`, `createdAt`, `updatedAt` |
| `roles` | Definisi role sistem/kustom | `id`, `name`, `description`, `permissions[]` (→ `permissions.id`), `isSystem?`, `isActive`, `createdAt`, `updatedAt` |
| `permissions` | Definisi izin | `id` (contoh `dashboard.view`, `backup.export`), `module`, `action`, `name`, `description`. Daftar konstanta ada di `MASTER_PERMISSIONS` |
| `audit_logs` | Jejak aktivitas sensitif; append-only untuk client | `userId`, `userName`, `action`, `module`, `description`, `ipAddress?`, `createdAt`, `source`, `syncStatus`, `localId?`, `firestoreId?`, `clientEventId?` |
| `audit_log_archives` | Arsip hasil pemindahan audit log | salinan `audit_logs` + `originalLogId`, `archivedAt`, `archivedBy`, `archivedByName?`, `archiveReason?` |
| `audit_log_migration_locks` | Lock idempotent migrasi log lokal (server-only) | doc ID `migrated_<hash>`, `localId`, `firestoreId`, `actorUid`, `migrationFingerprint`, `createdAt` |

### 2.2 Master data

| Koleksi | Fungsi | Field utama |
| --- | --- | --- |
| `products` | Master barang/inventaris | `code`, `name`, `categoryId`, `categoryName`, `unit`, `initialStock`, `currentStock`, `minStock`, `warehouseId`, `warehouseName`, `description?`, `itemStatus`, `status` |
| `categories` | Kategori barang | `name`, `description`, `isActive`, `status` |
| `suppliers` | Supplier | `name`, `contactPerson`, `phone`, `address` |
| `warehouses` | Gudang penyimpanan | `name` |
| `kordas` | Master KORDA / wilayah komando | `name`, `description`, `isActive`, `status` |
| `departments` | Master bagian/peruntukan | `name`, `description`, `isActive`, `status` |

### 2.3 Koleksi lama / kompatibilitas

| Koleksi | Fungsi | Field utama |
| --- | --- | --- |
| `stock_batches` | Batch stok lama | `productId`, `productName`, `supplierId`, `supplierName`, `warehouseId`, `quantity`, `initialQuantity`, `purchasePrice`, `expiredDate`, `stockInId` |
| `stock_in` | Barang masuk lama | `invoiceNumber`, `supplierId`, `supplierName`, `date`, `totalAmount`, `notes?`, `createdBy` |
| `stock_out` | Barang keluar lama | `stockOutNumber`, `productId`, `productName`, `quantity`, `date`, `destination`, `notes?`, `createdBy` |
| `requests` | Permintaan dapur lama | `requestNumber`, `requesterName`, `requesterDepartment`, `status`, `notes?`, `approvedBy?`, `approvedAt?`, `rejectedReason?` |
| `request_details` | Detail permintaan dapur | `requestId`, `productId`, `productName`, `requestedQty`, `approvedQty?`, `unit` |
| `deliveries` | Pengiriman lama | `deliveryNumber`, `requestId`, `driverId`, `driverName`, `vehicleNumber`, `status`, `shippingDate`, `deliveredAt?`, `proofImageUrl?`, `notes?` |
| `delivery_details` | Detail pengiriman lama | `deliveryId`, `productId`, `productName`, `quantity`, `unit` |
| `vehicles` | Kendaraan operasional | `plateNumber`, `type`, `capacity`, `driverId?`, `isActive` |
| `stock_movements` | Pergerakan stok lama | `productId`, `productName`, `type` (`IN`/`OUT`), `quantity`, `referenceId`, `date` |

### 2.4 Modul baru & infrastruktur

| Koleksi | Fungsi | Field utama |
| --- | --- | --- |
| `needsRequests` | Pengajuan & persetujuan kebutuhan barang | `requestNumber`, `date`, `requesterName`, `categoryId`, `itemId`, `itemName`, `quantity`, `unit`, `kordaId`, `departmentId`, `notes`, `status` (`Pending`/`Approved`/`Rejected`), `approvedBy`, `approvedAt`, `rejectedReason` |
| `shipments` | Pengiriman terintegrasi + bukti foto | `shipmentNumber`, `itemName`, `quantity`, `unit`, `senderFromRegion`, `kordaId`, `plannedQuantity`, `status`, `shipmentDate`, `driverId`, `driverName`, `senderName`, `receiverName`, `storageLocation`, `proofPhotos[]`, `receivedQuantity`, `shortageNote`, `damageNote` |
| `stockTransactions` | Buku besar/mutasi stok | `transactionNumber`, `date`, `type` (`IN`/`OUT`/`ADJUSTMENT`/`OPNAME`), `itemId`, `categoryId`, `quantity`, `unit`, `previousStock`, `newStock`, `source`, `kordaId`, `warehouseId`, `storageLocation`, `proofUrl`, `referenceType`, `referenceId`, `status` (`Draft`/`Confirmed`/`Rejected`), `approvedBy`, `approvedAt` |
| `distributions` | Distribusi barang ke bagian/pengguna | `distributionNumber`, `date`, `itemId`, `quantity`, `unit`, `requesterName`, `purpose`, `departmentId`, `kordaId`, `pickupTime`, `handedBy`, `proofUrl`, `notes` |
| `financeTransactions` | Buku kas terpisah dari stok | `transactionNumber`, `date`, `type` (`Pemasukan`/`Pengeluaran`), `amount`, `source`, `donorName`, `description`, `paymentMethod`, `notes`, `referenceType`, `referenceId` |
| `regions` | Wilayah / RT | `name`, `rtNumber`, `population`, `headName`, `isActive`, `status` |
| `recipients` | Penerima distribusi | `name`, `regionId`, `regionName`, `notes`, `isActive`, `status` |
| `activityLogs` | Aktivitas umum (append-only) | `userId`, `userName`, `action`, `module`, `description`, `referenceId`, `createdAt` |
| `notifications` | Notifikasi personal | `userId` (= auth.uid untuk baca), field lain mengikuti data aplikasi |

## 3. Status enum penting

| Koleksi | Status |
| --- | --- |
| `stockTransactions` | `Draft`, `Confirmed`, `Rejected` |
| `needsRequests` | `Pending`, `Approved`, `Rejected` |
| `shipments` | `Belum dikirim`, `Siap dikirim`, `Dalam perjalanan`, `Diterima sebagian`, `Selesai`, `Bermasalah` |
| `requests` (lama) | `Pending`, `Approved`, `Rejected`, `Processing`, `Completed` |
| `deliveries` (lama) | `Assigned`, `On Delivery`, `Delivered`, `Confirmed` |
| `products` | `itemStatus`: `Aktif`/`Nonaktif`; `status` juga dipakai sebagai flag aktif saat create |
| `regions`, `recipients`, master seed | `Aktif`/`Nonaktif` + `isActive` |
| `financeTransactions` | `Pemasukan`/`Pengeluaran`; `paymentMethod`: `Cash`/`Transfer` |

## 4. Relasi logis ringkas

| Field | Referensi | Kardinalitas | Catatan |
| --- | --- | --- | --- |
| `users.uid` | Firebase Auth UID | 1:1 | Document ID = UID |
| `users.role` | `roles.name` | N:1 | Memakai nama role, bukan ID |
| `roles.permissions[]` | `permissions.id` | N:M | Array ID permission |
| `products.categoryId` | `categories.id` | N:1 | Eksplisit |
| `products.warehouseId` | `warehouses.id` | N:1 | Inferred |
| `stockTransactions.itemId` | `products.id` | N:1 | Konfirmasi menulis balik saldo |
| `needsRequests.itemId` | `products.id` | N:1 | Eksplisit |
| `needsRequests.kordaId` | `kordas.id` | N:1 | Eksplisit |
| `needsRequests.departmentId` | `departments.id` | N:1 | Eksplisit |
| `shipments.driverId` | `users.uid` | N:1 | Driver hanya lihat milik sendiri |
| `distributions.itemId` | `products.id` | N:1 | Eksplisit |
| `recipients.regionId` | `regions.id` | N:1 | Inferred |
| `audit_logs` → `audit_log_archives` | `originalLogId` | 1:1 | Via backend Admin SDK |
| `stockTransactions.referenceType + referenceId` | koleksi mana pun | N:1 opsional | Polimorfik |
| `financeTransactions.referenceType + referenceId` | koleksi mana pun | N:1 opsional | Polimorfik |

## 5. Indeks yang disarankan

Firestore memerlukan composite index untuk query dengan beberapa `where` + `orderBy`. Berdasarkan pola query di aplikasi:

| Koleksi | Query umum | Indeks |
| --- | --- | --- |
| `shipments` | filter `driverId`, urut `createdAt` | `driverId ASC + createdAt DESC` |
| `deliveries` | filter `driverId`, urut `shippingDate` | `driverId ASC + shippingDate DESC` |
| `stockTransactions` | filter `status`, urut `date` | `status ASC + date DESC` |
| `needsRequests` | filter `status`, urut `createdAt` | `status ASC + createdAt DESC` |
| `audit_logs` | urut `createdAt desc` | single-field `createdAt DESC` |
| `audit_log_archives` | urut `archivedAt desc` | single-field `archivedAt DESC` |
| `products` | filter `categoryId`, urut `name` | `categoryId ASC + name ASC` |
| `notifications` | filter `userId`, urut `createdAt` | `userId ASC + createdAt DESC` |

## 6. Catatan integritas dan limitasi

- `firestore.rules` mengontrol akses client; backend Admin SDK melewati rules untuk endpoint tertentu.
- Koleksi `permissions` dibaca/ditulis oleh rules, tetapi daftar utamanya berupa konstanta `MASTER_PERMISSIONS` di kode; tidak ada seed otomatis yang dijumpai untuk koleksi ini.
- `audit_logs` bersifat append-only untuk client. Hapus dan migrasi hanya lewat backend; arsip hanya ditulis backend.
- `activityLogs` dan `audit_logs` tidak bisa di-update/dihapus dari client.
- `stockTransactions` tidak bisa dihapus dari client (`allow delete: if false`).
- Field `createdBy`, `updatedBy`, `approvedBy`, `userId`, `driverId`, `archivedBy` menyimpan UID, bukan nama. Nama biasanya disalin ke field `*Name`.
- Backup data saat ini hanya mencakup koleksi Firestore yang tercantum di `src/services/backupService.ts`; tidak termasuk file Firebase Storage dan log lokal yang belum tersinkron.
