# Dokumentasi Ujikom — LOGITRACK / SILOG

Folder ini khusus untuk berkas administrasi/asessment ujikom. Isinya **tidak diimpor** oleh aplikasi React maupun backend Express, sehingga tidak memengaruhi build, runtime, atau UI web.

Daftar berkas:

| Berkas | Isi |
| --- | --- |
| `ERD.md` | Entity Relationship Diagram logical (Firestore NoSQL direpresentasikan sebagai ERD) |
| `USE-CASE.md` | Aktor, daftar use case, diagram PlantUML/Mermaid, dan relasi include/extend |
| `DATABASE.md` | Inventaris koleksi Firestore, field utama, relasi, dan catatan domain |
| `CRUD.md` | Matriks hak Create/Read/Update/Delete per koleksi dan endpoint backend |
| `BACKUP-DATA.md` | Spesifikasi fitur backup data ke Excel/PDF |

Gambar diagram tersimpan di folder `assets/`: `ERD.png` dan `USE-CASE.png` (beserta sumber `.mmd`-nya).

Sumber kebenaran: kode di `src/`, `server/src/`, `firestore.rules`, dan `README.md` pada repository ini.
