import 'dotenv/config';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../config/firebaseAdmin.js';

const CATEGORIES = ['Bahan Dapur', 'Bahan Konsumsi', 'Bumbu Alam', 'Logistik', 'Alat Kebersihan', 'Sayuran'];
const KORDAS = ['Sukabumi', 'Cianjur', 'Bandung 1', 'Bandung 2', 'Bandung 3', 'Purwakarta', 'Subang', 'Karawang', 'Bogor'];
const DEPARTMENTS = ['Gepuk', 'Kentang', 'Pangsit', 'Kue', 'Gabin', 'Kopi', 'Pizza', 'Dapur Umum', 'Gudeg'];

interface SeedTarget {
  collection: string;
  ids: string[];
  names: string[];
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const targets: SeedTarget[] = [
  { collection: 'categories', ids: CATEGORIES.map(slug), names: CATEGORIES },
  { collection: 'kordas', ids: KORDAS.map(slug), names: KORDAS },
  { collection: 'departments', ids: DEPARTMENTS.map(slug), names: DEPARTMENTS },
];

async function seed(): Promise<void> {
  let created = 0;
  for (const target of targets) {
    for (let index = 0; index < target.ids.length; index += 1) {
      const reference = adminDb.collection(target.collection).doc(target.ids[index]);
      const snapshot = await reference.get();
      if (snapshot.exists) continue;
      const batch = adminDb.batch();
      batch.set(reference, {
        id: target.ids[index],
        name: target.names[index],
        description: '',
        isActive: true,
        status: 'Aktif',
        createdAt: FieldValue.serverTimestamp(),
        createdBy: 'system-seed',
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'system-seed',
      });
      await batch.commit();
      created += 1;
    }
  }
  console.log(`Seed selesai. ${created} dokumen master baru dibuat.`);
}

seed().catch(error => {
  console.error('Gagal menjalankan seed master data:', error);
  process.exitCode = 1;
});
