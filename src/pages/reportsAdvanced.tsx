import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, FileText, Printer } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDataVersion } from '../contexts/DataSyncContext';
import {
  LOGISTICS_EXPORT_GROUPS,
  LOGISTICS_HEADER_GROUPS,
  shipmentSentStatus,
} from '../components/logisticsColumns';
import { AlertBox, LoadingOverlay, PageHeader } from '../components/ui';
import {
  DataTable,
  FilterBar,
  Toast,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  type TableColumn,
} from '../components/DataViews';
import {
  dateString,
  displayDate,
  getCollection,
  getShipments,
  getStockAlerts,
  shortageAmount,
  toNumber,
  todayString,
} from '../services/logitrackService';
import { exportToExcel, exportToPdf, printReport, type ExportColumn } from '../utils/exports';
import type {
  ActivityLog,
  Distribution,
  Item,
  MasterData,
  NeedRequest,
  Region,
  Shipment,
  StockTransaction,
} from '../types/logitrack';

type ReportKey =
  | 'inventaris'
  | 'kebutuhan'
  | 'barangMasuk'
  | 'barangKeluar'
  | 'stokAkhir'
  | 'pengiriman'
  | 'distribusi'
  | 'perKorda'
  | 'perBagian'
  | 'perPengguna'
  | 'barangKurang'
  | 'aktivitasPengguna';

type ReportRow = Record<string, string | number>;
type ShipmentRow = Shipment & { itemId?: string };
type DistributionRow = Distribution & { kordaName?: string };

const NUMBER_KEYS = new Set([
  'currentStock',
  'minStock',
  'quantity',
  'plannedQuantity',
  'receivedQuantity',
  'shortage',
  'total',
  'population',
  'permintaan',
  'kebutuhan',
  'pengiriman',
  'terkirim',
  'distribusi',
  'jumlah',
  'no',
]);

const REPORT_TYPES: { value: ReportKey; label: string }[] = [
  { value: 'inventaris', label: 'Laporan Inventaris Barang' },
  { value: 'kebutuhan', label: 'Laporan Kebutuhan Barang' },
  { value: 'barangMasuk', label: 'Laporan Barang Masuk' },
  { value: 'barangKeluar', label: 'Laporan Barang Keluar' },
  { value: 'stokAkhir', label: 'Laporan Stok Akhir' },
  { value: 'pengiriman', label: 'Laporan Pengiriman' },
  { value: 'distribusi', label: 'Laporan Distribusi' },
  { value: 'perKorda', label: 'Laporan per KORDA' },
  { value: 'perBagian', label: 'Laporan per Bagian' },
  { value: 'perPengguna', label: 'Laporan per Pengguna' },
  { value: 'barangKurang', label: 'Laporan Barang Kurang' },
  { value: 'aktivitasPengguna', label: 'Laporan Aktivitas Pengguna' },
];

function column(key: string, label: string): ExportColumn<ReportRow> {
  return { key, label };
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export const ReportsAdvancedPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const dataVersion = useDataVersion('products', 'categories', 'regions', 'stockTransactions', 'needsRequests', 'shipments', 'distributions', 'activityLogs');
  const [products, setProducts] = useState<Item[]>([]);
  const [categories, setCategories] = useState<MasterData[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);
  const [needs, setNeeds] = useState<NeedRequest[]>([]);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [distributions, setDistributions] = useState<DistributionRow[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [reportType, setReportType] = useState<ReportKey>('inventaris');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState('');
  const [korda, setKorda] = useState('');
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canView = hasPermission('reports.view');
  const canExport = hasPermission('reports.export');
  const canViewRegions = hasPermission('regions.view');
  const canViewStock = hasPermission('stockTransactions.view');
  const canViewDistributions = hasPermission('distributions.view');

  useEffect(() => {
    if (!canView) return;
    let active = true;
    void Promise.all([
      getCollection<Item>('products'),
      getCollection<MasterData>('categories'),
      canViewRegions ? getCollection<Region>('regions') : Promise.resolve([] as Region[]),
      canViewStock ? getCollection<StockTransaction>('stockTransactions') : Promise.resolve([] as StockTransaction[]),
      getCollection<NeedRequest>('needsRequests'),
      getShipments(currentUser),
      canViewDistributions ? getCollection<DistributionRow>('distributions') : Promise.resolve([] as DistributionRow[]),
      getCollection<ActivityLog>('activityLogs'),
    ]).then(([
      productRows,
      categoryRows,
      regionRows,
      stockRows,
      needRows,
      shipmentRows,
      distributionRows,
      activityRows,
    ]) => {
      if (!active) return;
      setProducts(productRows);
      setCategories(categoryRows);
      setRegions(regionRows);
      setStockTransactions(stockRows);
      setNeeds(needRows);
      setShipments(shipmentRows);
      setDistributions(distributionRows);
      setActivities(activityRows);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Gagal memuat data laporan.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [canView, canViewRegions, canViewStock, canViewDistributions, currentUser, dataVersion]);

  const categoryById = useMemo(
    () => new Map(categories.map(item => [item.id, item.name])),
    [categories],
  );

  const regionById = useMemo(
    () => new Map(regions.map(item => [item.id, item.name])),
    [regions],
  );

  const productsById = useMemo(
    () => new Map(products.map(item => [item.id, item])),
    [products],
  );

  const productsByName = useMemo(
    () => new Map(products.map(item => [String(item.name || ''), item])),
    [products],
  );

  const categoryOptions = useMemo(
    () => uniqueSorted([...categories.map(item => item.name), ...products.map(item => item.categoryName)]),
    [categories, products],
  );

  const kordaOptions = useMemo(() => uniqueSorted([
    ...regions.map(item => item.name),
    ...needs.map(item => item.kordaName),
    ...shipments.map(item => item.kordaName),
    ...needs.map(item => regionById.get(item.kordaId) || ''),
    ...shipments.map(item => regionById.get(item.kordaId) || ''),
    ...distributions.map(item => regionById.get(item.kordaId) || ''),
  ]), [regions, needs, shipments, distributions, regionById]);

  const departmentOptions = useMemo(() => uniqueSorted([
    ...needs.map(item => item.departmentName),
    ...distributions.map(item => item.departmentName),
  ]), [needs, distributions]);

  const report = useMemo(() => {
    const inRange = (value: unknown): boolean => {
      const raw = dateString(value);
      if (!raw) return false;
      if (from && raw < from) return false;
      if (to && raw > to) return false;
      return true;
    };

    const categoryMatch = (name: string, id?: string): boolean =>
      !category || name === category || Boolean(id && categoryById.get(id) === category);

    const kordaMatch = (id: string, name: string): boolean =>
      !korda || name === korda || regionById.get(id) === korda;

    const departmentMatch = (name: string): boolean => !department || name === department;

    const productCategory = (id: string, name: string): string => {
      const item = productsById.get(id) || productsByName.get(name);
      return item?.categoryName || categoryById.get(item?.categoryId || '') || '';
    };

    const kordaName = (id: string, name: string): string => name || regionById.get(id) || '-';
    const alertIds = new Set(getStockAlerts(products).map(item => item.id));

    let rows: ReportRow[] = [];
    let columns: ExportColumn<ReportRow>[] = [];

    switch (reportType) {
      case 'inventaris': {
        rows = products
          .filter(item => inRange(item.createdAt)
            && categoryMatch(item.categoryName || categoryById.get(item.categoryId) || '', item.categoryId))
          .map(item => ({
            kode: item.code,
            nama: item.name,
            kategori: item.categoryName || categoryById.get(item.categoryId) || '-',
            satuan: item.unit,
            stok: toNumber(item.currentStock),
            minimum: toNumber(item.minStock),
            status: alertIds.has(item.id) ? 'Menipis' : 'Aman',
          }));
        columns = [
          column('kode', 'Kode'),
          column('nama', 'Nama barang'),
          column('kategori', 'Kategori'),
          column('satuan', 'Satuan'),
          column('stok', 'Stok saat ini'),
          column('minimum', 'Stok minimum'),
          column('status', 'Status'),
        ];
        break;
      }
      case 'kebutuhan': {
        rows = needs
          .filter(item => inRange(item.date)
            && categoryMatch(item.categoryName || categoryById.get(item.categoryId) || '', item.categoryId)
            && kordaMatch(item.kordaId, item.kordaName)
            && departmentMatch(item.departmentName))
          .map(item => ({
            nomor: item.requestNumber,
            tanggal: displayDate(item.date),
            peminta: item.requesterName || '-',
            barang: item.itemName,
            jumlah: toNumber(item.quantity),
            satuan: item.unit,
            korda: kordaName(item.kordaId, item.kordaName),
            bagian: item.departmentName || '-',
            status: item.status,
          }));
        columns = [
          column('nomor', 'No. permintaan'),
          column('tanggal', 'Tanggal'),
          column('peminta', 'Peminta'),
          column('barang', 'Barang'),
          column('jumlah', 'Jumlah'),
          column('satuan', 'Satuan'),
          column('korda', 'KORDA'),
          column('bagian', 'Bagian'),
          column('status', 'Status'),
        ];
        break;
      }
      case 'barangMasuk': {
        rows = stockTransactions
          .filter(item => item.type === 'IN' && item.status === 'Confirmed' && inRange(item.date)
            && categoryMatch(item.categoryName || categoryById.get(item.categoryId) || '', item.categoryId)
            && kordaMatch(item.kordaId, ''))
          .map(item => ({
            tanggal: displayDate(item.date),
            nomor: item.transactionNumber,
            barang: item.itemName,
            kategori: item.categoryName || categoryById.get(item.categoryId) || '-',
            jumlah: toNumber(item.quantity),
            satuan: item.unit,
            sumber: item.source || '-',
            pengirim: item.senderName || '-',
            keterangan: item.notes || '-',
          }));
        columns = [
          column('tanggal', 'Tanggal'),
          column('nomor', 'No. transaksi'),
          column('barang', 'Barang'),
          column('kategori', 'Kategori'),
          column('jumlah', 'Jumlah'),
          column('satuan', 'Satuan'),
          column('sumber', 'Sumber'),
          column('pengirim', 'Pengirim'),
          column('keterangan', 'Keterangan'),
        ];
        break;
      }
      case 'barangKeluar': {
        rows = stockTransactions
          .filter(item => item.type === 'OUT' && item.status === 'Confirmed' && inRange(item.date)
            && categoryMatch(item.categoryName || categoryById.get(item.categoryId) || '', item.categoryId)
            && kordaMatch(item.kordaId, ''))
          .map(item => ({
            tanggal: displayDate(item.date),
            nomor: item.transactionNumber,
            barang: item.itemName,
            kategori: item.categoryName || categoryById.get(item.categoryId) || '-',
            jumlah: toNumber(item.quantity),
            satuan: item.unit,
            penerima: item.receiverName || '-',
            tujuan: kordaName(item.kordaId, ''),
            keterangan: item.notes || '-',
          }));
        columns = [
          column('tanggal', 'Tanggal'),
          column('nomor', 'No. transaksi'),
          column('barang', 'Barang'),
          column('kategori', 'Kategori'),
          column('jumlah', 'Jumlah'),
          column('satuan', 'Satuan'),
          column('penerima', 'Penerima'),
          column('tujuan', 'Tujuan'),
          column('keterangan', 'Keterangan'),
        ];
        break;
      }
      case 'stokAkhir': {
        rows = products
          .filter(item => inRange(item.createdAt)
            && categoryMatch(item.categoryName || categoryById.get(item.categoryId) || '', item.categoryId))
          .map(item => ({
            kode: item.code,
            nama: item.name,
            kategori: item.categoryName || categoryById.get(item.categoryId) || '-',
            satuan: item.unit,
            stokAkhir: toNumber(item.currentStock),
            minimum: toNumber(item.minStock),
            status: alertIds.has(item.id) ? 'Menipis' : 'Aman',
          }));
        columns = [
          column('kode', 'Kode'),
          column('nama', 'Nama barang'),
          column('kategori', 'Kategori'),
          column('satuan', 'Satuan'),
          column('stokAkhir', 'Stok akhir'),
          column('minimum', 'Stok minimum'),
          column('status', 'Status'),
        ];
        break;
      }
      case 'pengiriman': {
        rows = shipments
          .filter(item => inRange(item.shipmentDate)
            && categoryMatch(productCategory(item.itemId || '', item.itemName))
            && kordaMatch(item.kordaId, item.kordaName))
          .map((item, index) => ({
            no: index + 1,
            itemName: item.itemName,
            quantity: toNumber(item.quantity),
            unit: item.unit,
            senderFromRegion: item.senderFromRegion || '-',
            plannedQuantity: toNumber(item.plannedQuantity),
            statusFlag: shipmentSentStatus(item),
            tanggal: displayDate(item.shipmentDate),
            senderName: item.senderName || '-',
            receiverName: item.receiverName || '-',
            storageLocation: item.storageLocation || '-',
          }));
        columns = [
          column('no', 'NO'),
          column('itemName', 'NAMA BARANG'),
          column('quantity', 'VOL'),
          column('unit', 'SATUAN'),
          column('senderFromRegion', 'DARI KORDA'),
          column('plannedQuantity', 'RENCANA KIRIM'),
          column('statusFlag', 'SUDAH/BELUM'),
          column('tanggal', 'TANGGAL'),
          column('senderName', 'NAMA PENGIRIM'),
          column('receiverName', 'NAMA PENERIMA'),
          column('storageLocation', 'TEMPAT PENYIMPANAN'),
        ];
        break;
      }
      case 'distribusi': {
        rows = distributions
          .filter(item => inRange(item.date)
            && categoryMatch(productCategory(item.itemId || '', item.itemName))
            && kordaMatch(item.kordaId, item.kordaName || '')
            && departmentMatch(item.departmentName))
          .map(item => ({
            tanggal: displayDate(item.date),
            nomor: item.distributionNumber,
            barang: item.itemName,
            jumlah: toNumber(item.quantity),
            satuan: item.unit,
            korda: kordaName(item.kordaId, item.kordaName || ''),
            bagian: item.departmentName || '-',
            penerima: item.requesterName || '-',
            tujuan: item.purpose || '-',
          }));
        columns = [
          column('tanggal', 'Tanggal'),
          column('nomor', 'No. distribusi'),
          column('barang', 'Barang'),
          column('jumlah', 'Jumlah'),
          column('satuan', 'Satuan'),
          column('korda', 'KORDA'),
          column('bagian', 'Bagian'),
          column('penerima', 'Penerima'),
          column('tujuan', 'Tujuan'),
        ];
        break;
      }
      case 'perKorda': {
        const grouped = new Map<string, { permintaan: number; kebutuhan: number; pengiriman: number; terkirim: number; distribusi: number }>();
        const ensure = (name: string) => {
          const key = name || 'Tanpa KORDA';
          if (!grouped.has(key)) {
            grouped.set(key, { permintaan: 0, kebutuhan: 0, pengiriman: 0, terkirim: 0, distribusi: 0 });
          }
          return grouped.get(key)!;
        };

        needs
          .filter(item => inRange(item.date) && kordaMatch(item.kordaId, item.kordaName))
          .forEach(item => {
            const entry = ensure(kordaName(item.kordaId, item.kordaName));
            entry.permintaan += 1;
            entry.kebutuhan += toNumber(item.quantity);
          });
        shipments
          .filter(item => inRange(item.shipmentDate) && kordaMatch(item.kordaId, item.kordaName))
          .forEach(item => {
            const entry = ensure(kordaName(item.kordaId, item.kordaName));
            entry.pengiriman += 1;
            entry.terkirim += toNumber(item.receivedQuantity);
          });
        distributions
          .filter(item => inRange(item.date) && kordaMatch(item.kordaId, item.kordaName || ''))
          .forEach(item => {
            ensure(kordaName(item.kordaId, item.kordaName || '')).distribusi += toNumber(item.quantity);
          });

        rows = Array.from(grouped.entries()).map(([name, value]) => ({
          korda: name,
          permintaan: value.permintaan,
          kebutuhan: value.kebutuhan,
          pengiriman: value.pengiriman,
          terkirim: value.terkirim,
          distribusi: value.distribusi,
        }));
        columns = [
          column('korda', 'KORDA'),
          column('permintaan', 'Jumlah permintaan'),
          column('kebutuhan', 'Total kebutuhan'),
          column('pengiriman', 'Total pengiriman'),
          column('terkirim', 'Total diterima'),
          column('distribusi', 'Total distribusi'),
        ];
        break;
      }
      case 'perBagian': {
        const grouped = new Map<string, { permintaan: number; kebutuhan: number; distribusi: number; jumlahDistribusi: number }>();
        const ensure = (name: string) => {
          const key = name || 'Tanpa bagian';
          if (!grouped.has(key)) {
            grouped.set(key, { permintaan: 0, kebutuhan: 0, distribusi: 0, jumlahDistribusi: 0 });
          }
          return grouped.get(key)!;
        };

        needs
          .filter(item => inRange(item.date) && departmentMatch(item.departmentName))
          .forEach(item => {
            const entry = ensure(item.departmentName);
            entry.permintaan += 1;
            entry.kebutuhan += toNumber(item.quantity);
          });
        distributions
          .filter(item => inRange(item.date) && departmentMatch(item.departmentName))
          .forEach(item => {
            const entry = ensure(item.departmentName);
            entry.distribusi += 1;
            entry.jumlahDistribusi += toNumber(item.quantity);
          });

        rows = Array.from(grouped.entries()).map(([name, value]) => ({
          bagian: name,
          permintaan: value.permintaan,
          kebutuhan: value.kebutuhan,
          distribusi: value.distribusi,
          jumlahDistribusi: value.jumlahDistribusi,
        }));
        columns = [
          column('bagian', 'Bagian'),
          column('permintaan', 'Jumlah permintaan'),
          column('kebutuhan', 'Total kebutuhan'),
          column('distribusi', 'Jumlah distribusi'),
          column('jumlahDistribusi', 'Total barang distribusi'),
        ];
        break;
      }
      case 'perPengguna': {
        const grouped = new Map<string, { aktivitas: number; modul: string; terakhir: string }>();
        activities
          .filter(item => inRange(item.createdAt))
          .forEach(item => {
            const name = item.userName || 'Sistem';
            const entry = grouped.get(name) || { aktivitas: 0, modul: item.module || '-', terakhir: dateString(item.createdAt) };
            entry.aktivitas += 1;
            if (dateString(item.createdAt) >= entry.terakhir) {
              entry.terakhir = dateString(item.createdAt);
              entry.modul = item.module || '-';
            }
            grouped.set(name, entry);
          });

        rows = Array.from(grouped.entries()).map(([name, value]) => ({
          pengguna: name,
          aktivitas: value.aktivitas,
          modul: value.modul,
          terakhir: displayDate(value.terakhir),
        }));
        columns = [
          column('pengguna', 'Pengguna'),
          column('aktivitas', 'Jumlah aktivitas'),
          column('modul', 'Modul terakhir'),
          column('terakhir', 'Aktivitas terakhir'),
        ];
        break;
      }
      case 'barangKurang': {
        rows = needs
          .filter(item => inRange(item.date)
            && categoryMatch(item.categoryName || categoryById.get(item.categoryId) || '', item.categoryId)
            && kordaMatch(item.kordaId, item.kordaName)
            && departmentMatch(item.departmentName))
          .map(item => {
            const stock = productsById.get(item.itemId) || productsByName.get(item.itemName);
            const available = toNumber(stock?.currentStock);
            return {
              nomor: item.requestNumber,
              tanggal: displayDate(item.date),
              barang: item.itemName,
              diminta: toNumber(item.quantity),
              tersedia: available,
              kurang: shortageAmount(item, available),
              korda: kordaName(item.kordaId, item.kordaName),
              bagian: item.departmentName || '-',
            };
          })
          .filter(item => toNumber(item.kurang) > 0);
        columns = [
          column('nomor', 'No. permintaan'),
          column('tanggal', 'Tanggal'),
          column('barang', 'Barang'),
          column('diminta', 'Diminta'),
          column('tersedia', 'Stok tersedia'),
          column('kurang', 'Kurang'),
          column('korda', 'KORDA'),
          column('bagian', 'Bagian'),
        ];
        break;
      }
      case 'aktivitasPengguna': {
        rows = activities
          .filter(item => inRange(item.createdAt))
          .map(item => ({
            waktu: displayDate(item.createdAt),
            pengguna: item.userName || '-',
            aksi: item.action,
            modul: item.module || '-',
            deskripsi: item.description || '-',
            referensi: item.referenceId || '-',
          }));
        columns = [
          column('waktu', 'Waktu'),
          column('pengguna', 'Pengguna'),
          column('aksi', 'Aksi'),
          column('modul', 'Modul'),
          column('deskripsi', 'Deskripsi'),
          column('referensi', 'Referensi'),
        ];
        break;
      }
    }

    const needle = search.trim().toLowerCase();
    const visibleRows = needle
      ? rows.filter(row => Object.values(row).some(value => String(value).toLowerCase().includes(needle)))
      : rows;

    return {
      rows: visibleRows.map((row, index) => ({ __rowId: index, ...row })),
      columns,
    };
  }, [
    reportType,
    products,
    stockTransactions,
    needs,
    shipments,
    distributions,
    activities,
    from,
    to,
    category,
    korda,
    department,
    search,
    categoryById,
    regionById,
    productsById,
    productsByName,
  ]);

  const tableColumns = useMemo<TableColumn<ReportRow>[]>(
    () => report.columns.map(item => ({
      key: item.key,
      label: item.label,
      render: row => String(item.value ? item.value(row) : row[item.key] ?? '-'),
    })),
    [report.columns],
  );

  const exportColumns = useMemo<ExportColumn<ReportRow>[]>(
    () => report.columns.map(item => ({
      key: item.key,
      label: item.label,
      value: NUMBER_KEYS.has(item.key)
        ? row => toNumber(row[item.key])
        : undefined,
    })),
    [report.columns],
  );

  const reportTitle = REPORT_TYPES.find(item => item.value === reportType)?.label || 'Laporan SILOG';

  const handleExport = async (format: 'excel' | 'pdf' | 'print') => {
    setExporting(true);
    setError('');
    try {
      const filename = `laporan-${reportType}-${todayString()}`;
      if (format === 'excel') {
        await exportToExcel(
          filename,
          reportTitle,
          report.rows,
          exportColumns,
          reportType === 'pengiriman' ? LOGISTICS_EXPORT_GROUPS : undefined,
        );
      } else if (format === 'pdf') {
        await exportToPdf(filename, reportTitle, report.rows, exportColumns);
      } else {
        printReport(reportTitle, report.rows, exportColumns);
      }
      setSuccess(`Laporan ${format === 'excel' ? 'Excel' : format === 'pdf' ? 'PDF' : 'cetak'} siap digunakan.`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Gagal memproses laporan.');
    } finally {
      setExporting(false);
    }
  };

  if (!canView) {
    return <AlertBox message="Anda tidak memiliki izin untuk melihat laporan lanjutan." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Lanjutan"
        description="Laporan inventaris, pergerakan stok, distribusi, KORDA, bagian, pengguna, dan aktivitas dari data Firestore."
        icon={BarChart3}
        action={canExport ? (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void handleExport('excel')} className={primaryButtonClass}>
              <Download className="w-4 h-4 mr-2" /> Excel
            </button>
            <button onClick={() => void handleExport('pdf')} className={secondaryButtonClass}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </button>
            <button onClick={() => void handleExport('print')} className={secondaryButtonClass}>
              <Printer className="w-4 h-4 mr-2" /> Cetak
            </button>
          </div>
        ) : undefined}
      />
      <AlertBox message={error} onClose={() => setError('')} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <FilterBar search={search} onSearch={setSearch}>
          <select value={reportType} onChange={event => setReportType(event.target.value as ReportKey)} className={`${inputClass} min-w-[210px]`}>
            {REPORT_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <input type="date" value={from} onChange={event => setFrom(event.target.value)} className={`${inputClass} w-full sm:w-auto sm:max-w-[180px] min-w-[140px]`} aria-label="Tanggal dari" />
          <input type="date" value={to} onChange={event => setTo(event.target.value)} className={`${inputClass} w-full sm:w-auto sm:max-w-[180px] min-w-[140px]`} aria-label="Tanggal sampai" />
          <select value={category} onChange={event => setCategory(event.target.value)} className={`${inputClass} max-w-[180px]`} aria-label="Kategori">
            <option value="">Semua kategori</option>
            {categoryOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={korda} onChange={event => setKorda(event.target.value)} className={`${inputClass} max-w-[180px]`} aria-label="KORDA">
            <option value="">Semua KORDA</option>
            {kordaOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={department} onChange={event => setDepartment(event.target.value)} className={`${inputClass} max-w-[180px]`} aria-label="Bagian">
            <option value="">Semua bagian</option>
            {departmentOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </FilterBar>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">{reportTitle}</h3>
            <p className="text-xs text-slate-500 mt-1">Dihasilkan dari data Firestore sesuai filter yang dipilih.</p>
          </div>
          <span className="text-xs font-semibold text-ocean bg-ocean-light px-3 py-1 rounded-full">{report.rows.length} baris</span>
        </div>
        <DataTable
          columns={tableColumns}
          rows={report.rows}
          rowKey={row => String(row.__rowId)}
          headerGroups={reportType === 'pengiriman' ? LOGISTICS_HEADER_GROUPS : undefined}
          indexOffset={0}
          emptyLabel="Tidak ada data yang sesuai dengan filter laporan."
        />
      </div>

      <Toast message={success} kind="success" onClose={() => setSuccess('')} />
      {(loading || exporting) && <LoadingOverlay label={exporting ? 'Menyiapkan laporan...' : 'Memuat laporan...'} />}
    </div>
  );
};
