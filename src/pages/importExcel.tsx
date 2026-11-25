import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, UploadCloud, XCircle } from 'lucide-react';
import {
  DataTable,
  Toast,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  type TableColumn,
} from '../components/DataViews';
import { AlertBox, InfoCard, LoadingOverlay, PageHeader, StatusBadge } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { createItem, getCollection, toNumber } from '../services/logitrackService';
import type { Item } from '../types/logitrack';

type MappingKey = 'code' | 'name' | 'category' | 'unit' | 'initialStock' | 'minStock' | 'warehouse' | 'description';
type Mapping = Record<MappingKey, number | null>;

interface CategoryRow {
  id: string;
  name: string;
}

interface WarehouseRow {
  id: string;
  name: string;
}

interface ParsedRow {
  rowNumber: number;
  values: string[];
}

interface PreviewRow {
  rowNumber: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  initialStock: string;
  minStock: string;
  warehouse: string;
  description: string;
  valid: boolean;
  errors: string[];
}

const MAX_ROWS = 500;
const PREVIEW_LIMIT = 10;
const labelClass = 'block text-xs font-semibold text-slate-700 uppercase mb-2';

const MAPPING_FIELDS: { key: MappingKey; label: string; required: boolean }[] = [
  { key: 'code', label: 'Kode Barang', required: false },
  { key: 'name', label: 'Nama Barang', required: true },
  { key: 'category', label: 'Kategori', required: false },
  { key: 'unit', label: 'Satuan', required: true },
  { key: 'initialStock', label: 'Stok Awal', required: false },
  { key: 'minStock', label: 'Stok Minimum', required: false },
  { key: 'warehouse', label: 'Gudang', required: false },
  { key: 'description', label: 'Deskripsi', required: false },
];

const HEADER_ALIASES: Record<MappingKey, string[]> = {
  code: ['code', 'kode', 'kode barang', 'item code', 'sku'],
  name: ['name', 'nama', 'nama barang', 'nama bahan', 'item name'],
  category: ['category', 'kategori', 'nama kategori'],
  unit: ['unit', 'satuan'],
  initialStock: ['initial stock', 'initialstock', 'stok awal', 'stokawal', 'stok saat ini', 'current stock', 'qty', 'jumlah'],
  minStock: ['min stock', 'minstock', 'stok minimum', 'stokminimal', 'minimum stock', 'min'],
  warehouse: ['warehouse', 'gudang', 'lokasi', 'location'],
  description: ['description', 'deskripsi', 'keterangan', 'catatan'],
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Terjadi kesalahan.';
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('result' in record && record.result !== undefined && record.result !== null) {
      return cellText(record.result);
    }
    if ('richText' in record && Array.isArray(record.richText)) {
      return record.richText.map(part => String((part as { text?: unknown }).text ?? '')).join('');
    }
    if ('text' in record) return String(record.text ?? '');
    return '';
  }
  return String(value);
}

function emptyMapping(): Mapping {
  return {
    code: null,
    name: null,
    category: null,
    unit: null,
    initialStock: null,
    minStock: null,
    warehouse: null,
    description: null,
  };
}

function detectMapping(headers: string[]): Mapping {
  const mapping = emptyMapping();
  const normalized = headers.map(normalizeHeader);
  MAPPING_FIELDS.forEach(field => {
    const aliases = HEADER_ALIASES[field.key];
    const index = normalized.findIndex(header => aliases.includes(header));
    if (index >= 0) mapping[field.key] = index;
  });
  return mapping;
}

function resolveCategory(value: string, categories: CategoryRow[], fallback: CategoryRow | null): CategoryRow | null {
  const needle = value.trim().toLowerCase();
  if (!needle) return fallback;
  return categories.find(category => category.name.trim().toLowerCase() === needle) || fallback;
}

function buildResults(
  parsed: ParsedRow[],
  mapping: Mapping,
  targetCategory: CategoryRow | null,
  products: Item[],
  categories: CategoryRow[],
): PreviewRow[] {
  const existingCodes = new Set(products.map(item => String(item.code || '').trim().toLowerCase()).filter(Boolean));
  const existingNames = new Set(products.map(item => String(item.name || '').trim().toLowerCase()).filter(Boolean));
  const seenCodes = new Set<string>();
  const seenNames = new Set<string>();

  return parsed.map(row => {
    const read = (key: MappingKey): string => {
      const index = mapping[key];
      return index === null ? '' : (row.values[index] ?? '').trim();
    };
    const code = read('code');
    const name = read('name');
    const category = read('category');
    const unit = read('unit');
    const initialStock = read('initialStock');
    const minStock = read('minStock');
    const warehouse = read('warehouse');
    const description = read('description');
    const errors: string[] = [];

    if (!targetCategory) errors.push('Pilih kategori tujuan.');
    if (!name) errors.push('Nama barang wajib diisi.');
    if (!unit) errors.push('Satuan wajib diisi.');

    if (code) {
      const codeKey = code.toLowerCase();
      if (existingCodes.has(codeKey)) errors.push(`Kode "${code}" sudah digunakan data barang.`);
      else if (seenCodes.has(codeKey)) errors.push(`Kode "${code}" duplikat dalam file.`);
    }
    if (name) {
      const nameKey = name.toLowerCase();
      if (existingNames.has(nameKey)) errors.push(`Nama "${name}" sudah digunakan data barang.`);
      else if (seenNames.has(nameKey)) errors.push(`Nama "${name}" duplikat dalam file.`);
    }

    const initialValue = Number(initialStock || 0);
    if (!Number.isFinite(initialValue) || initialValue < 0) errors.push('Stok awal harus angka non-negatif.');
    const minValue = Number(minStock || 0);
    if (!Number.isFinite(minValue) || minValue < 0) errors.push('Stok minimum harus angka non-negatif.');

    if (errors.length === 0) {
      if (code) seenCodes.add(code.toLowerCase());
      if (name) seenNames.add(name.toLowerCase());
    }

    return {
      rowNumber: row.rowNumber,
      code,
      name,
      category: resolveCategory(category, categories, targetCategory)?.name || '',
      unit,
      initialStock,
      minStock,
      warehouse,
      description,
      valid: errors.length === 0,
      errors,
    };
  });
}

export const ImportExcelPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [products, setProducts] = useState<Item[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Mapping>(emptyMapping);
  const [results, setResults] = useState<PreviewRow[]>([]);
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState('');

  useEffect(() => {
    void Promise.all([
      getCollection<CategoryRow>('categories'),
      getCollection<WarehouseRow>('warehouses'),
      getCollection<Item>('products'),
    ]).then(([categoryRows, warehouseRows, productRows]) => {
      setCategories(categoryRows);
      setWarehouses(warehouseRows);
      setProducts(productRows);
    }).catch(cause => setError(errorMessage(cause)));
  }, []);

  const targetCategory = categories.find(category => category.id === selectedCategoryId) || null;
  const canExecute = hasPermission('imports.execute');
  const validCount = results.filter(row => row.valid).length;
  const invalidCount = results.length - validCount;

  if (!hasPermission('imports.view')) {
    return <AlertBox message="Anda tidak memiliki izin untuk mengakses halaman import Excel." />;
  }

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setError('Format file harus .xlsx atau .csv.');
      return;
    }
    setError('');
    setSuccess('');
    setProcessing('Membaca file...');
    try {
      const buffer = await file.arrayBuffer();
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      if (/\.csv$/i.test(file.name)) {
        const readCsv = workbook.csv.read as unknown as (input: string) => Promise<unknown>;
        await readCsv(new TextDecoder().decode(buffer));
      } else {
        await workbook.xlsx.load(buffer);
      }
      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error('File tidak memiliki worksheet.');
      const headerRow = worksheet.getRow(1);
      const columnCount = Math.min(Math.max(headerRow.cellCount, worksheet.columnCount, 1), 50);
      const headerValues: string[] = [];
      for (let column = 1; column <= columnCount; column++) {
        headerValues.push(cellText(headerRow.getCell(column).value).trim());
      }
      const rows: ParsedRow[] = [];
      const lastRow = Math.min(worksheet.rowCount, MAX_ROWS + 1);
      for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
        const values = headerValues.map((_, index) => cellText(worksheet.getRow(rowNumber).getCell(index + 1).value).trim());
        if (values.every(value => value === '')) continue;
        rows.push({ rowNumber, values });
      }
      setHeaders(headerValues);
      setParsed(rows);
      setFileName(file.name);
      setMapping(detectMapping(headerValues));
      setResults([]);
      setValidated(false);
      setError(worksheet.rowCount - 1 > MAX_ROWS ? `Hanya ${MAX_ROWS} baris pertama yang diproses.` : '');
    } catch (cause) {
      setParsed([]);
      setHeaders([]);
      setFileName('');
      setError(errorMessage(cause));
    } finally {
      setProcessing('');
    }
  };

  const updateMapping = (key: MappingKey, value: string) => {
    setMapping(current => ({ ...current, [key]: value === '' ? null : Number(value) }));
    setResults([]);
    setValidated(false);
  };

  const validateRows = () => {
    if (parsed.length === 0) {
      setError('Unggah file terlebih dahulu.');
      return;
    }
    if (!targetCategory) {
      setError('Pilih kategori tujuan terlebih dahulu.');
      return;
    }
    setError('');
    setSuccess('');
    setResults(buildResults(parsed, mapping, targetCategory, products, categories));
    setValidated(true);
  };

  const handleImport = async () => {
    if (!validated || !canExecute || validCount === 0 || !targetCategory) return;
    setError('');
    setSuccess('');
    setProcessing('Mengimpor barang...');
    try {
      let imported = 0;
      for (const row of results.filter(item => item.valid)) {
        const category = resolveCategory(row.category, categories, targetCategory) || targetCategory;
        const warehouseValue = row.warehouse.trim().toLowerCase();
        const warehouse = warehouseValue
          ? warehouses.find(item => item.id.trim().toLowerCase() === warehouseValue || item.name.trim().toLowerCase() === warehouseValue)
          : undefined;
        await createItem({
          code: row.code || undefined,
          name: row.name,
          categoryId: category.id,
          categoryName: category.name,
          unit: row.unit,
          initialStock: toNumber(row.initialStock),
          currentStock: toNumber(row.initialStock),
          minStock: toNumber(row.minStock),
          warehouseId: warehouse?.id || '',
          warehouseName: warehouse?.name || row.warehouse,
          description: row.description,
        }, currentUser);
        imported++;
      }
      setProducts(await getCollection<Item>('products'));
      setSuccess(`${imported} barang berhasil diimpor.`);
      setResults([]);
      setParsed([]);
      setHeaders([]);
      setFileName('');
      setValidated(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setProcessing('');
    }
  };

  const previewColumns: TableColumn<PreviewRow>[] = [
    { key: 'rowNumber', label: 'Baris', render: row => String(row.rowNumber) },
    { key: 'code', label: 'Kode' },
    { key: 'name', label: 'Nama' },
    { key: 'category', label: 'Kategori' },
    { key: 'unit', label: 'Satuan' },
    { key: 'initialStock', label: 'Stok Awal' },
    { key: 'minStock', label: 'Min' },
    { key: 'warehouse', label: 'Gudang' },
    {
      key: 'status',
      label: 'Status',
      render: row => row.valid
        ? <StatusBadge value="Aman" />
        : <span className="text-xs text-red-600">{row.errors.join('; ')}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Excel"
        description="Impor data barang baru dari file Excel/CSV dengan pemetaan kolom dan validasi terlebih dahulu."
        icon={FileSpreadsheet}
      />
      <Toast message={error} kind="error" onClose={() => setError('')} />
      <Toast message={success} kind="success" onClose={() => setSuccess('')} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>File Excel/CSV</label>
            <div className={`${inputClass} flex items-center gap-2`}>
              <UploadCloud className="w-4 h-4 text-emerald-600 shrink-0" />
              <input type="file" accept=".xlsx,.csv" onChange={event => void handleFile(event)} className="w-full text-xs text-slate-600" />
            </div>
            {fileName && <p className="text-[11px] text-slate-500 mt-1">{fileName} · {parsed.length} baris terbaca</p>}
          </div>
          <div>
            <label className={labelClass}>Kategori Tujuan</label>
            <select value={selectedCategoryId} onChange={event => setSelectedCategoryId(event.target.value)} className={inputClass}>
              <option value="">Pilih kategori</option>
              {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            {categories.length === 0 && <p className="text-[11px] text-red-600 mt-1">Belum ada kategori. Tambahkan kategori terlebih dahulu.</p>}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-slate-800 mb-3">Pemetaan Kolom</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MAPPING_FIELDS.map(field => (
              <div key={field.key}>
                <label className={labelClass}>
                  {field.label}{field.required && <span className="text-red-600"> *</span>}
                </label>
                <select value={mapping[field.key] ?? ''} onChange={event => updateMapping(field.key, event.target.value)} className={inputClass} disabled={headers.length === 0}>
                  <option value="">Tidak dipetakan</option>
                  {headers.map((header, index) => <option key={index} value={String(index)}>{header || `Kolom ${index + 1}`}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button onClick={validateRows} disabled={parsed.length === 0 || !selectedCategoryId} className={secondaryButtonClass}>
              Validasi Data
            </button>
            {validated && (
              <span className="text-xs text-slate-500">
                Validasi selesai: {validCount} baris siap diimpor, {invalidCount} baris bermasalah.
              </span>
            )}
          </div>
        </div>
      </div>

      {parsed.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-800">Preview {Math.min(parsed.length, PREVIEW_LIMIT)} Baris Pertama</h2>
          </div>
          <DataTable
            columns={previewColumns}
            rows={results.slice(0, PREVIEW_LIMIT)}
            rowKey={row => String(row.rowNumber)}
            emptyLabel="Klik Validasi Data untuk melihat preview hasil pemetaan."
          />
        </div>
      )}

      {validated && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoCard title="Baris Berhasil" value={String(validCount)} detail="Siap diimpor" icon={CheckCircle2} />
            <InfoCard title="Baris Gagal" value={String(invalidCount)} detail="Perlu diperbaiki" icon={XCircle} color="bg-red-500" />
          </div>
          {invalidCount > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
              <h2 className="text-sm font-bold text-slate-800 mb-3">Error per Baris</h2>
              <div className="divide-y divide-slate-100">
                {results.filter(row => !row.valid).map(row => (
                  <p key={row.rowNumber} className="py-2 text-xs">
                    <span className="font-semibold text-slate-800">Baris {row.rowNumber} ({row.name || 'tanpa nama'}): </span>
                    <span className="text-red-600">{row.errors.join('; ')}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={() => void handleImport()} disabled={!canExecute || validCount === 0} className={primaryButtonClass}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Konfirmasi Import ({validCount})
            </button>
          </div>
          {!canExecute && <p className="text-xs text-red-600 text-right">Anda tidak memiliki izin untuk menjalankan import.</p>}
        </div>
      )}
      {processing && <LoadingOverlay label={processing} />}
    </div>
  );
};
