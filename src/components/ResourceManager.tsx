import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AlertBox, ConfirmDialog, LoadingOverlay, PageHeader } from './ui';
import { DataTable } from './DataViews';
import { ExcelImportButton, type ExcelImportField } from './ExcelImport';
import {
  deleteRow,
  formatDate,
  getRows,
  newId,
  saveRow,
  type CollectionName,
  type DataRow,
} from '../services/logisticsService';
import { ACTION_DELAY_MS, wait } from '../utils/async';

export interface ResourceField {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'readonly';
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
}

interface ResourceManagerProps {
  title: string;
  description: string;
  collection: CollectionName;
  icon: LucideIcon;
  permissions: { view: string; create?: string; edit?: string; delete?: string };
  fields: ResourceField[];
  columns?: string[];
  columnLabels?: Record<string, string>;
  initialRow?: () => DataRow;
  transform?: (row: DataRow, rows: DataRow[]) => DataRow;
  validate?: (row: DataRow, rows: DataRow[]) => string | null;
  renderCell?: (key: string, row: DataRow) => React.ReactNode;
  searchKeys?: string[];
  onSaved?: (row: DataRow, rows: DataRow[], isNew: boolean) => Promise<void> | void;
  onDeleted?: (row: DataRow) => Promise<void> | void;
}

export const ResourceManager: React.FC<ResourceManagerProps> = ({
  title,
  description,
  collection,
  icon,
  permissions,
  fields,
  columns,
  initialRow,
  transform,
  validate,
  renderCell,
  searchKeys,
  onSaved,
  onDeleted,
}) => {
  const { currentUser, hasPermission } = useAuth();
  const canView = hasPermission(permissions.view);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(canView);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<DataRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const canCreate = Boolean(permissions.create && hasPermission(permissions.create));
  const canEdit = Boolean(permissions.edit && hasPermission(permissions.edit));
  const canDelete = Boolean(permissions.delete && hasPermission(permissions.delete));

  const importFields = useMemo<ExcelImportField[]>(() => fields
    .filter(field => field.type !== 'readonly')
    .map(field => ({
      key: field.key,
      label: field.label,
      required: field.required,
      aliases: [field.label, field.key, field.key.replace(/([a-z])([A-Z])/g, '$1 $2')],
    })), [fields]);

  const importUniqueFields = useMemo(
    () => fields.filter(field => /name|code|number|kode|nama/i.test(field.key)).map(field => field.key),
    [fields],
  );

  const handleImportExcel = async (records: Record<string, string>[]) => {
    let imported = 0;
    for (const record of records) {
      const base = initialRow ? initialRow() : {};
      const row: DataRow = { ...base };
      fields.forEach(field => {
        const raw = record[field.key] ?? '';
        if (raw === '') return;
        row[field.key] = field.type === 'number' ? Number(raw) : raw;
      });
      const withId = { ...row, id: row.id || newId(collection) };
      const candidate = transform ? transform(withId, rows) : withId;
      const validationError = validate ? validate(candidate, rows) : null;
      if (validationError) throw new Error(`Baris ${imported + 1}: ${validationError}`);
      await saveRow(collection, candidate, currentUser);
      if (onSaved) await onSaved(candidate, rows, true);
      imported++;
    }
    await load();
    return imported;
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getRows(collection);
      setRows(data);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [collection]);

  useEffect(() => {
    if (canView) void load();
  }, [canView, load]);

  const visibleColumns = useMemo(() => columns || fields.map(field => field.key), [columns, fields]);

  const displayValue = (key: string, row: DataRow, custom?: (key: string, row: DataRow) => React.ReactNode): React.ReactNode => {
    if (custom) {
      const rendered = custom(key, row);
      if (rendered !== undefined) return rendered;
    }
    const value = row[key];
    if (value === undefined || value === null || value === '') return '-';
    if (typeof value === 'boolean') return value ? 'Aktif' : 'Nonaktif';
    if (typeof value === 'object') return formatDate(value);
    if (/date|At$/i.test(key)) return formatDate(value);
    if (/price|amount/i.test(key)) return `Rp ${Number(value).toLocaleString('id-ID')}`;
    return String(value);
  };

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    const keys = searchKeys || visibleColumns;
    return rows.filter(row => keys.some(key => String(displayValue(key, row, renderCell)).toLowerCase().includes(needle)));
  }, [rows, search, searchKeys, visibleColumns, renderCell]);

  const openCreate = () => {
    setError('');
    setSuccess('');
    setForm(initialRow ? initialRow() : {});
  };

  const openEdit = (row: DataRow) => {
    setError('');
    setSuccess('');
    setForm({ ...row });
  };

  const updateField = (field: ResourceField, value: string) => {
    setForm(previous => previous ? {
      ...previous,
      [field.key]: field.type === 'number' ? (value === '' ? 0 : Number(value)) : value,
    } : previous);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await wait(ACTION_DELAY_MS);
      const isNew = !form.id;
      const withId = { ...form, id: form.id || newId(collection) };
      const candidate = transform ? transform(withId, rows) : withId;
      const validationError = validate ? validate(candidate, rows) : null;
      if (validationError) throw new Error(validationError);
      await saveRow(collection, candidate, currentUser);
      if (onSaved) await onSaved(candidate, rows, isNew);
      setForm(null);
      setSuccess('Data berhasil disimpan.');
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setError('');
    setDeleting(true);
    try {
      await wait(ACTION_DELAY_MS);
      const target = rows.find(row => row.id === deleteId);
      await deleteRow(collection, deleteId, currentUser);
      if (target && onDeleted) await onDeleted(target);
      setSuccess('Data berhasil dihapus.');
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal menghapus data');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  if (!canView) {
    return <AlertBox message="Anda tidak memiliki izin untuk melihat modul ini." />;
  }

  const headerAction = canCreate ? (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={openCreate}
        className="inline-flex items-center justify-center px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-sm transition shadow-sm"
      >
        <Plus className="w-4 h-4 mr-2" />
        Tambah Data
      </button>
      <ExcelImportButton
        fields={importFields}
        permission={permissions.create}
        existingRows={rows}
        uniqueFields={importUniqueFields}
        onImport={handleImportExcel}
        label="Impor Excel"
        title={`Impor ${title}`}
      />
    </div>
  ) : undefined;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title={title} description={description} icon={icon} action={headerAction} />
      <AlertBox message={error} onClose={() => setError('')} />
      <AlertBox message={success} kind="success" onClose={() => setSuccess('')} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center gap-2 sm:gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Cari data..."
            className="flex-1 min-w-0 text-sm focus:outline-hidden text-slate-800 placeholder-slate-400"
          />
          <span className="text-xs text-slate-500 shrink-0">{filteredRows.length} data</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500 text-sm">
            <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
            Memuat data...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">Belum ada data yang tersedia.</div>
        ) : (
          <DataTable<DataRow>
            columns={[]}
            rows={filteredRows}
            rowKey={row => String(row.id)}
            onEdit={canEdit ? openEdit : undefined}
            onDelete={canDelete ? row => setDeleteId(String(row.id)) : undefined}
            selectable={false}
            emptyLabel="Belum ada data yang tersedia."
          />
        )}
      </div>

      {form && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between gap-3">
              <h3 className="text-base sm:text-lg font-bold text-slate-800">{form.id ? 'Ubah Data' : 'Tambah Data Baru'}</h3>
              <button onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {fields.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">{field.label}</label>
                  {field.type === 'readonly' ? (
                    <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-sm text-slate-700">{String(form[field.key] ?? '-')}</p>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={String(form[field.key] ?? '')}
                      onChange={event => updateField(field, event.target.value)}
                      required={field.required}
                      rows={3}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={String(form[field.key] ?? '')}
                      onChange={event => updateField(field, event.target.value)}
                      required={field.required}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                    >
                      <option value="">Pilih {field.label}</option>
                      {field.options?.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={String(form[field.key] ?? '')}
                      onChange={event => updateField(field, event.target.value)}
                      required={field.required}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                    />
                  )}
                </div>
              ))}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">Batal</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-emerald-700 text-white rounded-xl text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 inline-flex items-center">
                  {saving ? 'Menyimpan...' : <><Check className="w-4 h-4 mr-2" /> Simpan</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          message={`Hapus data ${title} ini? Tindakan ini tidak dapat dibatalkan.`}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {(saving || deleting) && <LoadingOverlay label={saving ? 'Menyimpan data...' : 'Menghapus data...'} />}
    </div>
  );
};
