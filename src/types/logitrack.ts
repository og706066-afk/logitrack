export type AuditStatus = 'Draft' | 'Confirmed' | 'Rejected';

export interface AuditedEntity {
  id: string;
  createdAt: any;
  createdBy: string;
  updatedAt: any;
  updatedBy: string;
  status: string;
}

export interface Item extends AuditedEntity {
  code: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  unit: string;
  initialStock: number;
  currentStock: number;
  minStock: number;
  warehouseId: string;
  warehouseName: string;
  itemStatus: 'Aktif' | 'Nonaktif';
}

export interface MasterData extends AuditedEntity {
  name: string;
  description: string;
  isActive: boolean;
}

export interface NeedRequest extends AuditedEntity {
  requestNumber: string;
  date: string;
  requesterName: string;
  categoryId: string;
  categoryName: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  kordaId: string;
  kordaName: string;
  departmentId: string;
  departmentName: string;
  notes: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy: string;
  approvedAt: any;
  rejectedReason: string;
}

export type ShipmentStatus =
  | 'Belum dikirim'
  | 'Siap dikirim'
  | 'Dalam perjalanan'
  | 'Diterima sebagian'
  | 'Selesai'
  | 'Bermasalah';

export interface Shipment extends AuditedEntity {
  shipmentNumber: string;
  itemName: string;
  quantity: number;
  unit: string;
  senderFromRegion: string;
  kordaId: string;
  kordaName: string;
  plannedQuantity: number;
  status: ShipmentStatus;
  shipmentDate: string;
  driverId: string;
  driverName: string;
  senderName: string;
  receiverName: string;
  storageLocation: string;
  notes: string;
  proofPhotos: string[];
  receivedQuantity: number;
  shortageNote: string;
  damageNote: string;
}

export type StockTransactionType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'OPNAME';

export interface StockTransaction extends AuditedEntity {
  transactionNumber: string;
  date: string;
  type: StockTransactionType;
  itemId: string;
  itemName: string;
  categoryId: string;
  categoryName: string;
  quantity: number;
  unit: string;
  previousStock: number;
  newStock: number;
  source: string;
  kordaId: string;
  senderName: string;
  receiverName: string;
  condition: string;
  warehouseId: string;
  storageLocation: string;
  proofUrl: string;
  referenceType: string;
  referenceId: string;
  notes: string;
  status: AuditStatus;
  approvedBy: string;
  approvedAt: any;
}

export interface Distribution extends AuditedEntity {
  distributionNumber: string;
  date: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  requesterName: string;
  purpose: string;
  departmentId: string;
  departmentName: string;
  kordaId: string;
  pickupTime: string;
  handedBy: string;
  proofUrl: string;
  notes: string;
}

export interface FinanceTransaction extends AuditedEntity {
  transactionNumber: string;
  date: string;
  type: 'Pemasukan' | 'Pengeluaran';
  amount: number;
  source: string;
  donorName: string;
  description: string;
  paymentMethod: 'Cash' | 'Transfer';
  notes: string;
  referenceType: string;
  referenceId: string;
}

export interface Region extends AuditedEntity {
  name: string;
  rtNumber: string;
  population: number;
  headName: string;
}

export interface Recipient extends AuditedEntity {
  name: string;
  regionId: string;
  regionName: string;
  notes: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  description: string;
  referenceId: string;
  createdAt: any;
}
