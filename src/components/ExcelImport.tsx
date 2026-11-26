import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, UploadCloud } from 'lucide-react';
import {
  DataTable,
  Modal,
  Toast,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  type TableColumn,
} from './DataViews';
import { LoadingOverlay } from './ui';
import { useAuth } from '../contexts/AuthContext';

export interface ExcelImportField {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

interface ParsedRow {
  rowNumber: number;
  values: string[];
}

interface PreviewRecord {
  rowNumber: number;
  cells: string[];
  values: Record<string, string>;
  valid: boolean;
  errors: string[];
}

interface ExcelImportButtonProps {
  fields: ExcelImportField[];
  onImport: (records: Record<string, string>[]) => Promise<number>;
  onDone?: () => void | Promise<void>;
  existingRows?: unknown[];
  uniqueFields?: string[];
  permission?: string;
  label?: string;
  title?: string;
}

const MAX_ROWS = 500;
const PREVIEW_LIMIT = 10;
const labelClass = 'block text-xs font-semibold text-slate-700 uppercase mb-2';

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
    if ('result' in record && record.result !== undefined && record.result !== null) return cellText(record.result);
    if ('richText' in record && Array.isArray(record.richText)) {
      return record.richText.map(part => String((part as { text?: unknown }).text ?? '')).join('');
    }
    if ('text' in record) return String(record.text ?? '');
    return '';
  }
  return String(value);
}

function emptyMapping(fields: ExcelImportField[]): Record<string, number | null> {
  return Object.fromEntries(fields.map(field => [field.key, null]));
}

function detectMapping(fields: ExcelImportField[], headers: string[]): Record<string, number | null> {
  const normalized = headers.map(normalizeHeader);
  return Object.fromEntries(fields.map(field => {
    const aliases = field.aliases.map(normalizeHeader);
    const index = normalized.findIndex(header => aliases.includes(header));
    return [field.key, index >= 0 ? index : null];
  }));
}

function recordValue(row: unknown, key: string): string {
  const value = (row as Record<string, unknown>)[key];
  return value === null || value === undefined ? '' : String(value);
}

export function ExcelImportButton({
  fields,
  onImport,
  onDone,
  existingRows = [],
  uniqueFields = [],
  permission,
  label = 'Impor Excel',
  title = 'Impor data dari Excel/CSV',
}: ExcelImportButtonProps) {
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, number | null>>(() => emptyMapping(fields));
  const [results, setResults] = useState<PreviewRecord[]>([]);
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const allowed = !permission || hasPermission(permission);
  const validCount = results.filter(row => row.valid).length;
  const invalidCount = results.length - validCount;

  const previewColumns = useMemo<TableColumn<PreviewRecord>[]>(() => [
    { key: 'rowNumber', label: 'Baris', filterable: false },
    ...headers.map((header, index) => ({
      key: `excel_${index}`,
      label: header || `Kolom ${index + 1}`,
      render: (row: PreviewRecord) => row.cells[index] || '-',
    })),
    {
      key: 'status',
      label: 'Status',
      filterable: false,
      render: row => row.valid ? <span className="text-xs font-semibold text-emerald-700">Siap</span>
        : <span className="text-xs text-red-600">{row.errors.join('; ')}</span>,
    },
  ], [headers]);

  const close = () => {
    setOpen(false);
    setFileName('');
    setHeaders([]);
    setParsed([]);
    setMapping(emptyMapping(fields));
    setResults([]);
    setValidated(false);
    setError('');
    setSuccess('');
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setError('Format file harus .xlsx atau .csv.');
      return;
    }
    setError('');
    setSuccess('');
    setResults([]);
    setValidated(false);
    setBusy('Membaca file...');
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
      const nextHeaders: string[] = [];
      for (let column = 1; column <= columnCount; column++) {
        nextHeaders.push(cellText(headerRow.getCell(column).value).trim());
      }
      const nextParsed: ParsedRow[] = [];
      const lastRow = Math.min(worksheet.rowCount, MAX_ROWS + 1);
      for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
        const values = nextHeaders.map((_, index) => cellText(worksheet.getRow(rowNumber).getCell(index + 1).value).trim());
        if (values.every(value => value === '')) continue;
        nextParsed.push({ rowNumber, values });
      }
      setHeaders(nextHeaders);
      setParsed(nextParsed);
      setFileName(file.name);
      setMapping(detectMapping(fields, nextHeaders));
      setError(worksheet.rowCount - 1 > MAX_ROWS ? `Hanya ${MAX_ROWS} baris pertama yang diproses.` : '');
    } catch (cause) {
      setParsed([]);
      setHeaders([]);
      setFileName('');
      setError(errorMessage(cause));
    } finally {
      setBusy('');
    }
  };

  const updateMapping = (key: string, value: string) => {
    setMapping(current => ({ ...current, [key]: value === '' ? null : Number(value) }));
    setResults([]);
    setValidated(false);
  };

  const validateRows = () => {
    if (parsed.length === 0) {
      setError('Unggah file terlebih dahulu.');
      return;
    }
    setError('');
    setSuccess('');

    const existing = new Map<string, Set<string>>();
    uniqueFields.forEach(key => {
      existing.set(key, new Set(existingRows.map(row => normalizeHeader(recordValue(row, key))).filter(Boolean)));
    });

    const seen = new Map<string, Set<string>>();
    uniqueFields.forEach(key => seen.set(key, new Set<string>()));

    const nextResults = parsed.map(row => {
      const values: Record<string, string> = {};
      fields.forEach(field => {
        const index = mapping[field.key];
        values[field.key] = index === null ? '' : (row.values[index] ?? '').trim();
      });
      const errors: string[] = [];
      fields.forEach(field => {
        if (field.required && !values[field.key]) errors.push(`${field.label} wajib diisi.`);
      });
      uniqueFields.forEach(key => {
        const value = normalizeHeader(values[key] ?? '');
        if (!value) return;
        if (existing.get(key)?.has(value)) errors.push(`${key} "${values[key]}" sudah ada.`);
        else if (seen.get(key)?.has(value)) errors.push(`${key} "${values[key]}" duplikat dalam file.`);
        else seen.get(key)?.add(value);
      });

      return { rowNumber: row.rowNumber, cells: row.values, values, valid: errors.length === 0, errors };
    });

    setResults(nextResults);
    setValidated(true);
  };

  const handleImport = async () => {
    if (!validated || validCount === 0) return;
    setBusy('Mengimpor data...');
    setError('');
    setSuccess('');
    try {
      const records = results.filter(row => row.valid).map(row => row.values);
      const imported = await onImport(records);
      setSuccess(`${imported} baris berhasil diimpor.`);
      await onDone?.();
      setResults([]);
      setParsed([]);
      setHeaders([]);
      setFileName('');
      setValidated(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy('');
    }
  };

  if (!allowed) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={secondaryButtonClass}>
        <FileSpreadsheet className="w-4 h-4 mr-2" />
        {label}
      </button>
      {open && (
        <Modal title={title} onClose={close} wide>
          <div className="space-y-5">
            <Toast message={error} kind="error" onClose={() => setError('')} />
            <Toast message={success} kind="success" onClose={() => setSuccess('')} />

            <div>
              <label className={labelClass}>File Excel/CSV</label>
              <div className={`${inputClass} flex items-center gap-2`}>
                <UploadCloud className="w-4 h-4 text-emerald-600 shrink-0" />
                <input type="file" accept=".xlsx,.csv" onChange={event => void handleFile(event)} className="w-full text-xs text-slate-600" />
              </div>
              {fileName && <p className="text-[11px] text-slate-500 mt-1">{fileName} · {parsed.length} baris terbaca</p>}
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3">Pemetaan Kolom</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {fields.map(field => (
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
                <button type="button" onClick={validateRows} disabled={parsed.length === 0} className={secondaryButtonClass}>Validasi Data</button>
                {validated && (
                  <span className="text-xs text-slate-500">
                    {validCount} baris siap diimpor, {invalidCount} baris bermasalah.
                  </span>
                )}
              </div>
            </div>

            {parsed.length > 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800">Preview {Math.min(parsed.length, PREVIEW_LIMIT)} Baris Pertama</h3>
                </div>
                <DataTable
                  columns={previewColumns}
                  rows={results.slice(0, PREVIEW_LIMIT)}
                  rowKey={row => String(row.rowNumber)}
                  emptyLabel="Klik Validasi Data untuk melihat preview hasil pemetaan."
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={close} className={secondaryButtonClass}>Tutup</button>
              <button type="button" onClick={() => void handleImport()} disabled={!validated || validCount === 0} className={primaryButtonClass}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Konfirmasi Import ({validCount})
              </button>
            </div>
          </div>
          {busy && <LoadingOverlay label={busy} />}
        </Modal>
      )}
    </>
  );
}
