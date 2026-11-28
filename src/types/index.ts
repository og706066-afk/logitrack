export type UserRole = 'Super Admin' | 'Manager' | 'Staf Gudang' | 'Kepala Gudang' | 'Staf Bahan Dapur' | 'Staf Konsumsi' | 'Staf Sayuran' | 'Staf Bumbu Alam' | 'Staf Logistik' | 'Staf Kebersihan' | 'Driver' | 'Viewer' | string;

export interface UserProfile {
  uid: string;
  name?: string;
  email: string;
  displayName: string;
  role: UserRole;
  permissions?: string[];
  isActive: boolean;
  phoneNumber?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Permission {
  id: string;
  module: string; // Dashboard, Bahan Makanan, Supplier, Barang Masuk, Barang Keluar, Permintaan Dapur, Pengiriman, Laporan, Pengguna, Role & Permission
  action: string; // view, create, edit, delete, approve, reject, update, complete, export
  name: string;
  description: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[]; // array of permission ids
  isSystem?: boolean;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  createdAt: any;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  unit: string;
  minStock: number;
  currentStock: number;
  description?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  address: string;
  createdAt: any;
}

export interface StockBatch {
  id: string;
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  quantity: number;
  initialQuantity: number;
  purchasePrice: number;
  expiredDate: string;
  stockInId: string;
  createdAt: any;
}

export interface StockIn {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  totalAmount: number;
  notes?: string;
  createdBy: string;
  createdAt: any;
}

export interface StockOut {
  id: string;
  stockOutNumber: string;
  productId: string;
  productName: string;
  quantity: number;
  date: string;
  destination: string;
  notes?: string;
  createdBy: string;
  createdAt: any;
}

export interface KitchenRequest {
  id: string;
  requestNumber: string;
  requesterName: string;
  requesterDepartment: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Processing' | 'Completed';
  notes?: string;
  approvedBy?: string;
  approvedAt?: any;
  rejectedReason?: string;
  createdAt: any;
}

export interface RequestDetail {
  id: string;
  requestId: string;
  productId: string;
  productName: string;
  requestedQty: number;
  approvedQty?: number;
  unit: string;
}

export interface Delivery {
  id: string;
  deliveryNumber: string;
  requestId: string;
  driverId: string;
  driverName: string;
  vehicleNumber: string;
  status: 'Assigned' | 'On Delivery' | 'Delivered' | 'Confirmed';
  shippingDate: string;
  deliveredAt?: any;
  proofImageUrl?: string;
  notes?: string;
  createdAt: any;
}

export interface DeliveryDetail {
  id: string;
  deliveryId: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  type: string;
  capacity: string;
  driverId?: string;
  isActive: boolean;
  createdAt: any;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'IN' | 'OUT';
  quantity: number;
  referenceId: string;
  date: string;
  createdAt: any;
}

export type AuditLogSource = 'firestore' | 'local' | 'migrated';
export type AuditLogSyncStatus = 'synced' | 'pending' | 'failed' | 'migrated';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  description: string;
  ipAddress?: string;
  createdAt: any;
  source?: AuditLogSource;
  syncStatus?: AuditLogSyncStatus;
  localId?: string;
  firestoreId?: string;
  syncError?: string;
  lastSyncAttemptAt?: string;
  migratedFromLocalId?: string;
  clientEventId?: string;
}

export interface AuditLogArchive extends AuditLog {
  originalLogId: string;
  archivedAt: any;
  archivedBy: string;
  archivedByName?: string;
  archiveReason?: string;
}
