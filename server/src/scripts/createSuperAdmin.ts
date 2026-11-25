import 'dotenv/config';
import { adminAuth, adminDb } from '../config/firebaseAdmin.js';

const args = process.argv.slice(2);
const nameFlagIndex = args.indexOf('--name');
const displayName = nameFlagIndex >= 0 ? args[nameFlagIndex + 1] : undefined;
const positional: string[] = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--name') {
    i++;
    continue;
  }
  positional.push(args[i]);
}

const email = positional[0];

if (!email || !email.includes('@')) {
  console.error('Usage: npm run create-admin -- <email> [--name "Nama Lengkap"]');
  process.exit(1);
}

async function main() {
  let user;

  try {
    user = await adminAuth.getUserByEmail(email);
  } catch (error: any) {
    if (error?.code !== 'auth/user-not-found') throw error;
    user = await adminAuth.createUser({
      email,
      emailVerified: true,
      displayName: displayName || 'Super Admin',
    });
  }

  const resolvedName = displayName || user.displayName || 'Super Admin';
  const userRef = adminDb.collection('users').doc(user.uid);
  const snapshot = await userRef.get();
  const createdAt = snapshot.data()?.createdAt ?? new Date();

  await userRef.set({
    uid: user.uid,
    email: user.email || email,
    displayName: resolvedName,
    role: 'Super Admin',
    permissions: [],
    isActive: true,
    createdAt,
    updatedAt: new Date(),
  }, { merge: true });

  console.log(`Super Admin siap: ${email} (uid: ${user.uid})`);
  console.log('Atur password pertama kali melalui "Lupa password" di halaman login.');
}

main().catch((error) => {
  console.error('Gagal membuat Super Admin:', error);
  process.exit(1);
});
