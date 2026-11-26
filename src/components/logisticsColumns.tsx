import type { TableColumn, TableHeaderGroup } from './DataViews';
import { displayDate, toNumber } from '../services/logitrackService';
import type { Shipment } from '../types/logitrack';
import type { ExportColumn, ExportColumnGroup } from '../utils/exports';

export function shipmentSentStatus(row: Shipment): 'Sudah' | 'Belum' {
  return row.status === 'Belum dikirim' ? 'Belum' : 'Sudah';
}

function formatQuantity(value: number): string {
  return toNumber(value).toLocaleString('id-ID');
}

export const LOGISTICS_HEADER_GROUPS: TableHeaderGroup[] = [
  { label: 'STATUS', keys: ['statusFlag', 'tanggal'] },
];

export const LOGISTICS_SHIPMENT_COLUMNS: TableColumn<Shipment>[] = [
  {
    key: 'no',
    label: 'NO',
    filterable: false,
    render: (_row, index) => <span className="font-semibold text-slate-800">{index + 1}</span>,
  },
  {
    key: 'itemName',
    label: 'NAMA BARANG',
    render: row => <span className="font-medium text-slate-800">{row.itemName || '-'}</span>,
  },
  {
    key: 'quantity',
    label: 'VOL',
    render: row => <span>{formatQuantity(toNumber(row.quantity))}</span>,
  },
  {
    key: 'unit',
    label: 'SATUAN',
    render: row => <span>{row.unit || '-'}</span>,
  },
  {
    key: 'senderFromRegion',
    label: 'DARI KORDA',
    render: row => <span>{row.senderFromRegion || '-'}</span>,
  },
  {
    key: 'plannedQuantity',
    label: 'RENCANA KIRIM',
    render: row => <span>{formatQuantity(toNumber(row.plannedQuantity))}</span>,
  },
  {
    key: 'statusFlag',
    label: 'SUDAH/BELUM',
    filterable: true,
    filterValue: shipmentSentStatus,
    render: row => {
      const sent = shipmentSentStatus(row);
      return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${sent === 'Sudah' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
          {sent}
        </span>
      );
    },
  },
  {
    key: 'tanggal',
    label: 'TANGGAL',
    filterable: false,
    render: row => <span className="text-xs text-slate-500">{displayDate(row.shipmentDate)}</span>,
  },
  {
    key: 'senderName',
    label: 'NAMA PENGIRIM',
    render: row => <span>{row.senderName || '-'}</span>,
  },
  {
    key: 'receiverName',
    label: 'NAMA PENERIMA',
    render: row => <span>{row.receiverName || '-'}</span>,
  },
  {
    key: 'storageLocation',
    label: 'TEMPAT PENYIMPANAN',
    render: row => <span>{row.storageLocation || '-'}</span>,
  },
];

export interface LogisticsShipmentExportRow {
  no: number;
  itemName: string;
  quantity: number;
  unit: string;
  senderFromRegion: string;
  plannedQuantity: number;
  statusFlag: 'Sudah' | 'Belum';
  tanggal: string;
  senderName: string;
  receiverName: string;
  storageLocation: string;
}

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

export const LOGISTICS_EXPORT_GROUPS: ExportColumnGroup[] = [
  { label: 'STATUS', keys: ['statusFlag', 'tanggal'] },
];

export function toLogisticsShipmentExportRows(rows: Shipment[]): LogisticsShipmentExportRow[] {
  return rows.map((row, index) => ({
    no: index + 1,
    itemName: row.itemName || '',
    quantity: toNumber(row.quantity),
    unit: row.unit || '',
    senderFromRegion: row.senderFromRegion || '',
    plannedQuantity: toNumber(row.plannedQuantity),
    statusFlag: shipmentSentStatus(row),
    tanggal: displayDate(row.shipmentDate),
    senderName: row.senderName || '',
    receiverName: row.receiverName || '',
    storageLocation: row.storageLocation || '',
  }));
}
