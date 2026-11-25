import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { UserProfile } from '../types';
import type {
  ActivityLog,
  Distribution,
  FinanceTransaction,
  Item,
  MasterData,
  NeedRequest,
  Recipient,
  Region,
  Shipment,
  ShipmentStatus,
  StockTransaction,
} from '../types/logitrack';
import { db, storage } from './firebase';

export type NewCollection =
  | 'products'
  | 'categories'
  | 'kordas'
  | 'departments'
  | 'warehouses'
  | 'needsRequests'
  | 'shipments'
  | 'stockTransactions'
  | 'distributions'
  | 'financeTransactions'
  | 'regions'
  | 'recipients'
  | 'activityLogs'
  | 'notifications';

type Actor = Pick<UserProfile, 'uid' | 'displayName' | 'email' | 'role'>;

export function requireFirestore() {
  if (!db) throw new Error('Firestore belum tersedia. Periksa konfigurasi Firebase.');
  return db;
}

export function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function dateString(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const candidate = value as { toDate?: () => Date; seconds?: number };
  if (typeof candidate.toDate === 'function') return candidate.toDate().toISOString().slice(0, 10);
  if (typeof candidate.seconds === 'number') return new Date(candidate.seconds * 1000).toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function displayDate(value: unknown): string {
  if (!value) return '-';
  const raw = dateString(value);
  if (!raw) return '-';
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleDateString('id-ID');
}

export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function entityName(label: string): string {
  return label;
}

export async function nextNumber(name: NewCollection, prefix: string): Promise<string> {
  const firestore = requireFirestore();
  const snapshot = await getDocs(collection(firestore, name));
  const stamp = todayString().replace(/-/g, '');
  return `${prefix}-${stamp}-${String(snapshot.size + 1).padStart(4, '0')}`;
}

export async function getCollection<T>(name: NewCollection): Promise<T[]> {
  const firestore = requireFirestore();
  const snapshot = await getDocs(collection(firestore, name));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as T));
}

export async function getShipments(actor: Actor | null): Promise<Shipment[]> {
  const firestore = requireFirestore();
  const source = actor?.role === 'Driver'
    ? query(collection(firestore, 'shipments'), where('driverId', '==', actor.uid))
    : collection(firestore, 'shipments');
  const snapshot = await getDocs(source);
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Shipment));
}

export async function getDocument<T>(name: NewCollection, id: string): Promise<T | null> {
  const firestore = requireFirestore();
  const snapshot = await getDoc(doc(firestore, name, id));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null;
}

export async function logActivity(
  actor: Actor | null | undefined,
  action: string,
  module: string,
  description: string,
  referenceId = '',
): Promise<void> {
  if (!actor) return;
  const firestore = requireFirestore();
  const entry: Omit<ActivityLog, 'id'> = {
    userId: actor.uid,
    userName: actor.displayName || actor.email,
    action,
    module,
    description,
    referenceId,
    createdAt: serverTimestamp(),
  };
  await addDoc(collection(firestore, 'activityLogs'), entry);
}

export async function createDocument<T extends object>(
  name: NewCollection,
  input: T,
  actor: Actor | null | undefined,
  auditModule: string,
): Promise<T & { id: string }> {
  const firestore = requireFirestore();
  const stamp = serverTimestamp();
  const data = {
    ...input,
    createdAt: stamp,
    createdBy: actor?.uid || '',
    updatedAt: stamp,
    updatedBy: actor?.uid || '',
  };
  const reference = await addDoc(collection(firestore, name), data);
  await logActivity(actor, 'CREATE', auditModule, `Membuat ${entityName(auditModule)}`, reference.id);
  return { ...data, id: reference.id } as T & { id: string };
}

export async function updateDocument<T extends object>(
  name: NewCollection,
  id: string,
  patch: Partial<T>,
  actor: Actor | null | undefined,
  auditModule: string,
): Promise<void> {
  const firestore = requireFirestore();
  await updateDoc(doc(firestore, name, id), {
    ...patch,
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || '',
  });
  await logActivity(actor, 'UPDATE', auditModule, `Mengubah ${entityName(auditModule)}`, id);
}

export async function removeDocument(
  name: NewCollection,
  id: string,
  actor: Actor | null | undefined,
  auditModule: string,
): Promise<void> {
  const firestore = requireFirestore();
  await deleteDoc(doc(firestore, name, id));
  await logActivity(actor, 'DELETE', auditModule, `Menghapus ${entityName(auditModule)}`, id);
}

export async function createItem(input: Partial<Item>, actor: Actor | null): Promise<Item> {
  const item = await createDocument<Item>(
    'products',
    {
      code: input.code || await nextNumber('products', 'BRG'),
      name: input.name || '',
      categoryId: input.categoryId || '',
      categoryName: input.categoryName || '',
      description: input.description || '',
      unit: input.unit || 'Pcs',
      initialStock: toNumber(input.initialStock),
      currentStock: toNumber(input.currentStock),
      minStock: toNumber(input.minStock),
      warehouseId: input.warehouseId || '',
      warehouseName: input.warehouseName || '',
      itemStatus: input.itemStatus || 'Aktif',
      status: input.status || 'Aktif',
    } as unknown as Item,
    actor,
    'Master Barang',
  );
  return item;
}

export async function updateItem(id: string, patch: Partial<Item>, actor: Actor | null): Promise<void> {
  await updateDocument('products', id, patch, actor, 'Master Barang');
}

export async function createNeedRequest(input: Partial<NeedRequest>, actor: Actor | null): Promise<NeedRequest> {
  return createDocument<NeedRequest>(
    'needsRequests',
    {
      requestNumber: input.requestNumber || await nextNumber('needsRequests', 'KDB'),
      date: input.date || todayString(),
      requesterName: input.requesterName || actor?.displayName || actor?.email || '',
      categoryId: input.categoryId || '',
      categoryName: input.categoryName || '',
      itemId: input.itemId || '',
      itemName: input.itemName || '',
      quantity: toNumber(input.quantity),
      unit: input.unit || 'Pcs',
      kordaId: input.kordaId || '',
      kordaName: input.kordaName || '',
      departmentId: input.departmentId || '',
      departmentName: input.departmentName || '',
      notes: input.notes || '',
      status: input.status || 'Pending',
      approvedBy: '',
      approvedAt: null,
      rejectedReason: '',
    } as unknown as NeedRequest,
    actor,
    'Kebutuhan Barang',
  );
}

export async function decideNeedRequest(
  id: string,
  decision: 'Approved' | 'Rejected',
  actor: Actor | null,
  reason = '',
): Promise<void> {
  await updateDocument<NeedRequest>(
    'needsRequests',
    id,
    {
      status: decision,
      approvedBy: decision === 'Approved' ? actor?.uid || '' : '',
      approvedAt: decision === 'Approved' ? serverTimestamp() : null,
      rejectedReason: decision === 'Rejected' ? reason : '',
    },
    actor,
    'Kebutuhan Barang',
  );
}

export async function createShipment(input: Partial<Shipment>, actor: Actor | null): Promise<Shipment> {
  return createDocument<Shipment>(
    'shipments',
    {
      shipmentNumber: input.shipmentNumber || await nextNumber('shipments', 'KRM'),
      itemName: input.itemName || '',
      quantity: toNumber(input.quantity),
      unit: input.unit || 'Pcs',
      senderFromRegion: input.senderFromRegion || '',
      kordaId: input.kordaId || '',
      kordaName: input.kordaName || '',
      plannedQuantity: toNumber(input.plannedQuantity ?? input.quantity),
      status: input.status || 'Belum dikirim',
      shipmentDate: input.shipmentDate || todayString(),
      driverId: input.driverId || '',
      driverName: input.driverName || '',
      senderName: input.senderName || '',
      receiverName: input.receiverName || '',
      storageLocation: input.storageLocation || '',
      notes: input.notes || '',
      proofPhotos: input.proofPhotos || [],
      receivedQuantity: toNumber(input.receivedQuantity),
      shortageNote: input.shortageNote || '',
      damageNote: input.damageNote || '',
    } as unknown as Shipment,
    actor,
    'Pengiriman',
  );
}

export async function updateShipment(id: string, patch: Partial<Shipment>, actor: Actor | null): Promise<void> {
  await updateDocument('shipments', id, patch, actor, 'Pengiriman');
}

export async function createStockTransaction(input: Partial<StockTransaction>, actor: Actor | null): Promise<StockTransaction> {
  const transaction = await createDocument<StockTransaction>(
    'stockTransactions',
    {
      transactionNumber: input.transactionNumber || await nextNumber('stockTransactions', 'TRX'),
      date: input.date || todayString(),
      type: input.type || 'IN',
      itemId: input.itemId || '',
      itemName: input.itemName || '',
      categoryId: input.categoryId || '',
      categoryName: input.categoryName || '',
      quantity: toNumber(input.quantity),
      unit: input.unit || 'Pcs',
      previousStock: 0,
      newStock: 0,
      source: input.source || '',
      kordaId: input.kordaId || '',
      senderName: input.senderName || '',
      receiverName: input.receiverName || '',
      condition: input.condition || 'Baik',
      warehouseId: input.warehouseId || '',
      storageLocation: input.storageLocation || '',
      proofUrl: input.proofUrl || '',
      referenceType: input.referenceType || 'manual',
      referenceId: input.referenceId || '',
      notes: input.notes || '',
      status: input.status || 'Draft',
      approvedBy: '',
      approvedAt: null,
    } as unknown as StockTransaction,
    actor,
    'Transaksi Stok',
  );
  if (input.status === 'Confirmed') {
    await confirmStockTransaction(transaction.id, actor);
  }
  return transaction;
}

export async function confirmStockTransaction(id: string, actor: Actor | null): Promise<void> {
  const firestore = requireFirestore();
  const transactionRef = doc(firestore, 'stockTransactions', id);
  await runTransaction(firestore, async transaction => {
    const movement = await transaction.get(transactionRef);
    if (!movement.exists()) throw new Error('Transaksi tidak ditemukan.');
    const data = movement.data() as StockTransaction;
    if (data.status === 'Confirmed') throw new Error('Transaksi sudah dikonfirmasi.');
    if (!actor) throw new Error('Identitas pengguna tidak ditemukan.');

    const itemRef = doc(firestore, 'products', data.itemId);
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists()) throw new Error('Barang tidak ditemukan.');
    if (itemSnap.data().unit !== data.unit) throw new Error('Satuan transaksi tidak sama dengan satuan barang.');

    const previous = toNumber(itemSnap.data().currentStock);
    const quantity = toNumber(data.quantity);
    const delta = data.type === 'OUT' ? -quantity : data.type === 'IN' ? quantity : quantity - previous;
    const next = previous + delta;
    if (next < 0) throw new Error('Stok tidak mencukupi untuk transaksi ini.');

    transaction.update(itemRef, {
      currentStock: next,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
    transaction.update(transactionRef, {
      status: 'Confirmed',
      previousStock: previous,
      newStock: next,
      approvedBy: actor.uid,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  });
  await logActivity(actor, 'CONFIRM', 'Transaksi Stok', `Mengonfirmasi transaksi ${id}`, id);
}

export async function createDistribution(input: Partial<Distribution>, actor: Actor | null): Promise<Distribution> {
  return createDocument<Distribution>(
    'distributions',
    {
      distributionNumber: input.distributionNumber || await nextNumber('distributions', 'DST'),
      date: input.date || todayString(),
      itemId: input.itemId || '',
      itemName: input.itemName || '',
      quantity: toNumber(input.quantity),
      unit: input.unit || 'Pcs',
      requesterName: input.requesterName || '',
      purpose: input.purpose || '',
      departmentId: input.departmentId || '',
      departmentName: input.departmentName || '',
      kordaId: input.kordaId || '',
      pickupTime: input.pickupTime || '',
      handedBy: actor?.displayName || actor?.email || '',
      proofUrl: input.proofUrl || '',
      notes: input.notes || '',
    } as unknown as Distribution,
    actor,
    'Distribusi',
  );
}

export async function createFinanceTransaction(input: Partial<FinanceTransaction>, actor: Actor | null): Promise<FinanceTransaction> {
  return createDocument<FinanceTransaction>(
    'financeTransactions',
    {
      transactionNumber: input.transactionNumber || await nextNumber('financeTransactions', 'KAS'),
      date: input.date || todayString(),
      type: input.type || 'Pemasukan',
      amount: toNumber(input.amount),
      source: input.source || '',
      donorName: input.donorName || '',
      description: input.description || '',
      paymentMethod: input.paymentMethod || 'Cash',
      notes: input.notes || '',
      referenceType: input.referenceType || '',
      referenceId: input.referenceId || '',
    } as unknown as FinanceTransaction,
    actor,
    'Keuangan',
  );
}

export async function updateFinanceTransaction(
  id: string,
  patch: Partial<FinanceTransaction>,
  actor: Actor | null,
): Promise<void> {
  await updateDocument('financeTransactions', id, patch, actor, 'Keuangan');
}

export async function createMasterData(
  name: 'kordas' | 'departments' | 'regions' | 'recipients',
  input: Record<string, unknown>,
  actor: Actor | null,
): Promise<void> {
  await createDocument(name, input as Record<string, unknown>, actor, name);
}

export async function updateMasterData(
  name: 'kordas' | 'departments' | 'regions' | 'recipients',
  id: string,
  patch: Record<string, unknown>,
  actor: Actor | null,
): Promise<void> {
  await updateDocument(name, id, patch, actor, name);
}

export async function uploadProofFile(collectionName: string, documentId: string, file: File): Promise<string> {
  if (!storage) throw new Error('Firebase Storage belum tersedia.');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `proofs/${collectionName}/${documentId}/${Date.now()}-${safeName}`;
  const result = await uploadBytes(ref(storage, path), file, { contentType: file.type });
  return getDownloadURL(result.ref);
}

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  'Belum dikirim',
  'Siap dikirim',
  'Dalam perjalanan',
  'Diterima sebagian',
  'Selesai',
  'Bermasalah',
];

export function getStockAlerts(items: Item[]): Item[] {
  return items.filter(item => item.itemStatus === 'Aktif' && item.currentStock <= item.minStock);
}

export function shortageAmount(need: Pick<NeedRequest, 'quantity'>, stock: number): number {
  return Math.max(0, toNumber(need.quantity) - toNumber(stock));
}

export type { ActivityLog, Distribution, FinanceTransaction, Item, MasterData, NeedRequest, Recipient, Region, Shipment, StockTransaction };
