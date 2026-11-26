import type { TableHeaderGroup } from './DataViews';
import { displayDate, toNumber } from '../services/logitrackService';
import type { Shipment } from '../types/logitrack';
import type { ExportColumn, ExportColumnGroup } from '../utils/exports';

const DASH = '-';

export type StandardStatus = 'Sudah' | 'Belum' | typeof DASH;

export interface StandardRowValues {
  no: number;
  itemName: string;
  quantity: string;
  unit: string;
  senderFromRegion: string;
  plannedQuantity: string;
  statusFlag: StandardStatus;
  tanggal: string;
  senderName: string;
  receiverName: string;
  storageLocation: string;
}

export type StandardRowResolver<T> = (row: T, index: number) => StandardRowValues;

function rawValue<T>(row: T, keys: string[]): unknown {
  const record = row as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function textValue<T>(row: T, keys: string[]): string {
  const value = rawValue(row, keys);
  if (value === undefined) return DASH;
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  if (Array.isArray(value)) return value.map(item => String(item ?? '')).filter(Boolean).join(', ') || DASH;
  if (typeof value === 'object') {
    const candidate = value as { toDate?: () => Date };
    if (typeof candidate.toDate === 'function') return displayDate(value);
    return DASH;
  }
  return String(value);
}

function quantityValue<T>(row: T, keys: string[]): string {
  const value = rawValue(row, keys);
  if (value === undefined) return DASH;
  if (typeof value === 'number') return value.toLocaleString('id-ID');
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'object') return DASH;
  return String(value);
}

function statusValue<T>(row: T, keys: string[]): StandardStatus {
  const value = rawValue(row, keys);
  if (value === undefined) return DASH;
  if (typeof value === 'boolean') return value ? 'Sudah' : 'Belum';
  const text = String(value);
  if (/belum|pending|draft|nonaktif|tidak aktif|rejected|ditolak|menipis|gagal|failed|batal|cancelled/i.test(text)) return 'Belum';
  return 'Sudah';
}

function dateValue<T>(row: T, keys: string[]): string {
  const value = rawValue(row, keys);
  return value === undefined ? DASH : displayDate(value);
}

export const defaultStandardRowResolver: StandardRowResolver<unknown> = (row, index) => ({
  no: index + 1,
  itemName: textValue(row, [
    'itemName', 'productName', 'namaBarang', 'name', 'nama', 'displayName',
    'description', 'deskripsi', 'keterangan', 'notes', 'source', 'sumber',
    'module', 'modul', 'email', 'invoiceNumber', 'requestNumber', 'deliveryNumber',
    'distributionNumber', 'transactionNumber', 'nomor', 'number', 'code', 'kode',
    'title', 'judul',
  ]),
  quantity: quantityValue(row, [
    'quantity', 'currentStock', 'stock', 'stok', 'amount', 'jumlah', 'population',
    'recipientCount', 'total', 'value', 'count', 'delta', 'perubahan',
    'pemasukan', 'pengeluaran', 'stokAkhir', 'saldo',
  ]),
  unit: textValue(row, [
    'unit', 'satuan', 'type', 'jenis', 'kategori', 'categoryName', 'category',
    'role', 'module', 'modul',
  ]),
  senderFromRegion: textValue(row, [
    'senderFromRegion', 'kordaName', 'korda', 'departmentName', 'department',
    'bagian', 'regionName', 'wilayah', 'source', 'sumber', 'asal',
    'categoryName', 'kategori',
  ]),
  plannedQuantity: quantityValue(row, [
    'plannedQuantity', 'rencanaKirim', 'target', 'minStock', 'minimum', 'stokMinimum',
    'population', 'recipientCount',
  ]),
  statusFlag: statusValue(row, [
    'statusFlag', 'itemStatus', 'status', 'isActive', 'active', 'statusAkun',
    'auditStatus', 'action',
  ]),
  tanggal: dateValue(row, [
    'shipmentDate', 'date', 'tanggal', 'createdAt', 'updatedAt', 'waktu',
    'expiredDate', 'deliveryDate', 'requestDate', 'approvedAt', 'time',
  ]),
  senderName: textValue(row, [
    'senderName', 'namaPengirim', 'supplierName', 'requesterName', 'requestedBy',
    'createdBy', 'userName', 'user', 'handedBy', 'driverName', 'donorName',
    'contactPerson', 'email', 'dari', 'approvedBy',
  ]),
  receiverName: textValue(row, [
    'receiverName', 'namaPenerima', 'recipientName', 'penerima', 'destination',
    'tujuan', 'departmentName', 'phoneNumber', 'phone', 'telepon', 'email',
    'headName', 'ketuaRT',
  ]),
  storageLocation: textValue(row, [
    'storageLocation', 'tempatPenyimpanan', 'warehouseName', 'warehouse', 'gudang',
    'location', 'lokasi', 'plateNumber', 'vehicleNumber', 'kendaraan',
    'regionName', 'wilayah', 'storage',
  ]),
});

export const STANDARD_HEADER_GROUPS: TableHeaderGroup[] = [
  { label: 'STATUS', keys: ['statusFlag', 'tanggal'] },
];

export const LOGISTICS_HEADER_GROUPS = STANDARD_HEADER_GROUPS;

export function shipmentSentStatus(row: Shipment): 'Sudah' | 'Belum' {
  return row.status === 'Belum dikirim' ? 'Belum' : 'Sudah';
}

export const shipmentResolver: StandardRowResolver<Shipment> = (row, index) => {
  const values = defaultStandardRowResolver(row as unknown as Record<string, unknown>, index);
  return {
    ...values,
    itemName: row.itemName || DASH,
    quantity: toNumber(row.quantity).toLocaleString('id-ID'),
    unit: row.unit || DASH,
    senderFromRegion: row.senderFromRegion || DASH,
    plannedQuantity: toNumber(row.plannedQuantity).toLocaleString('id-ID'),
    statusFlag: shipmentSentStatus(row),
    tanggal: displayDate(row.shipmentDate),
    senderName: row.senderName || DASH,
    receiverName: row.receiverName || DASH,
    storageLocation: row.storageLocation || DASH,
    no: index + 1,
  };
};

export interface LogisticsShipmentExportRow {
  no: number;
  itemName: string;
  quantity: string;
  unit: string;
  senderFromRegion: string;
  plannedQuantity: string;
  statusFlag: string;
  tanggal: string;
  senderName: string;
  receiverName: string;
  storageLocation: string;
}

export interface StandardExportRow extends LogisticsShipmentExportRow {}

export const LOGISTICS_EXPORT_COLUMNS: ExportColumn<LogisticsShipmentExportRow>[] = [
  { key: 'no', label: 'NO' },
  { key: 'itemName', label: 'NAMA BARANG' },
  { key: 'quantity', label: 'VOL' },
  { key: 'unit', label: 'SATUAN' },
  { key: 'senderFromRegion', label: 'DARI KORDA' },
  { key: 'plannedQuantity', label: 'RENCANA KIRIM' },
  { key: 'statusFlag', label: 'SUDAH/BELUM' },
  { key: 'tanggal', label: 'TANGGAL' },
  { key: 'senderName', label: 'NAMA PENGIRIM' },
  { key: 'receiverName', label: 'NAMA PENERIMA' },
  { key: 'storageLocation', label: 'TEMPAT PENYIMPANAN' },
];

export const STANDARD_EXPORT_COLUMNS: ExportColumn<StandardExportRow>[] = LOGISTICS_EXPORT_COLUMNS;

export const LOGISTICS_EXPORT_GROUPS: ExportColumnGroup[] = STANDARD_HEADER_GROUPS.map(group => ({
  label: group.label,
  keys: group.keys,
}));

export const STANDARD_EXPORT_GROUPS = LOGISTICS_EXPORT_GROUPS;

export function toLogisticsShipmentExportRows(rows: Shipment[]): LogisticsShipmentExportRow[] {
  return rows.map((row, index) => {
    const values = shipmentResolver(row, index);
    return {
      no: values.no,
      itemName: values.itemName,
      quantity: values.quantity,
      unit: values.unit,
      senderFromRegion: values.senderFromRegion,
      plannedQuantity: values.plannedQuantity,
      statusFlag: values.statusFlag,
      tanggal: values.tanggal,
      senderName: values.senderName,
      receiverName: values.receiverName,
      storageLocation: values.storageLocation,
    };
  });
}

export function toStandardExportRows<T>(rows: T[]): StandardExportRow[] {
  return rows.map((row, index) => {
    const values = defaultStandardRowResolver(row, index);
    return {
      no: values.no,
      itemName: values.itemName,
      quantity: values.quantity,
      unit: values.unit,
      senderFromRegion: values.senderFromRegion,
      plannedQuantity: values.plannedQuantity,
      statusFlag: values.statusFlag,
      tanggal: values.tanggal,
      senderName: values.senderName,
      receiverName: values.receiverName,
      storageLocation: values.storageLocation,
    };
  });
}
