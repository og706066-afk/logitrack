import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ListFilter, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { AlertBox } from './ui';
import {
  defaultStandardRowResolver,
  STANDARD_HEADER_GROUPS,
  type StandardRowResolver,
} from './logisticsColumns';

export const inputClass = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-600';
export const primaryButtonClass = 'inline-flex items-center justify-center px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-sm transition shadow-sm disabled:opacity-50';
export const secondaryButtonClass = 'inline-flex items-center justify-center px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm transition disabled:opacity-50';

export interface TableColumn<T> {
  key: string;
  label: string;
  render?: (row: T, index: number) => React.ReactNode;
  filterable?: boolean;
  filterValue?: (row: T) => string;
}

export interface TableHeaderGroup {
  label: string;
  keys: string[];
}

const NON_FILTERABLE_KEY = /(id|number|kode|code|date|tanggal|time|email|phone|telepon|address|alamat|notes?|catatan|description|deskripsi|name|nama|title|url|link)/i;

function filterValueOf<T>(row: T, column: TableColumn<T>): string {
  const raw = column.filterValue
    ? column.filterValue(row)
    : (row as Record<string, unknown>)[column.key];

  if (Array.isArray(raw)) {
    return raw.map(item => String(item ?? '')).filter(Boolean).join(', ') || '-';
  }
  if (raw == null || raw === '') return '-';
  if (typeof raw === 'boolean') return raw ? 'Aktif' : 'Tidak';
  if (raw instanceof Date) return raw.toLocaleDateString('id-ID');
  if (typeof raw === 'object') {
    const timestamp = raw as { toDate?: () => Date };
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().toLocaleDateString('id-ID');
    return '-';
  }
  return String(raw);
}

function createStandardColumns<T>(
  resolver: StandardRowResolver<T> = defaultStandardRowResolver as StandardRowResolver<T>,
): TableColumn<T>[] {
  const values = (row: T, index: number) => resolver(row, index);
  return [
    {
      key: 'no',
      label: 'NO',
      filterable: false,
      render: (_row, index) => <span className="font-semibold text-slate-800">{index + 1}</span>,
    },
    {
      key: 'itemName',
      label: 'NAMA BARANG',
      render: (row, index) => <span className="font-medium text-slate-800">{values(row, index).itemName}</span>,
    },
    {
      key: 'quantity',
      label: 'VOL',
      render: (row, index) => <span>{values(row, index).quantity}</span>,
    },
    {
      key: 'unit',
      label: 'SATUAN',
      render: (row, index) => <span>{values(row, index).unit}</span>,
    },
    {
      key: 'senderFromRegion',
      label: 'DARI KORDA',
      render: (row, index) => <span>{values(row, index).senderFromRegion}</span>,
    },
    {
      key: 'plannedQuantity',
      label: 'RENCANA KIRIM',
      render: (row, index) => <span>{values(row, index).plannedQuantity}</span>,
    },
    {
      key: 'statusFlag',
      label: 'SUDAH/BELUM',
      filterable: true,
      filterValue: row => values(row, 0).statusFlag,
      render: (row, index) => {
        const status = values(row, index).statusFlag;
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${status === 'Sudah' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : status === 'Belum' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white text-slate-400 border-slate-200'}`}>
            {status}
          </span>
        );
      },
    },
    {
      key: 'tanggal',
      label: 'TANGGAL',
      filterable: false,
      render: (row, index) => <span className="text-xs text-slate-500">{values(row, index).tanggal}</span>,
    },
    {
      key: 'senderName',
      label: 'NAMA PENGIRIM',
      render: (row, index) => <span>{values(row, index).senderName}</span>,
    },
    {
      key: 'receiverName',
      label: 'NAMA PENERIMA',
      render: (row, index) => <span>{values(row, index).receiverName}</span>,
    },
    {
      key: 'storageLocation',
      label: 'TEMPAT PENYIMPANAN',
      render: (row, index) => <span>{values(row, index).storageLocation}</span>,
    },
  ];
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  headerGroups?: TableHeaderGroup[];
  indexOffset?: number;
  standard?: boolean;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onBulkDelete?: (rows: T[]) => void;
  selectable?: boolean;
  bulkDeleteLabel?: string;
  emptyLabel?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  headerGroups,
  indexOffset = 0,
  standard = true,
  onEdit,
  onDelete,
  onBulkDelete,
  selectable,
  bulkDeleteLabel = 'Hapus semua yang dipilih',
  emptyLabel = 'Belum ada data.',
}: DataTableProps<T>) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const canSelect = selectable ?? Boolean(onBulkDelete || onDelete);

  const standardColumns = useMemo(() => createStandardColumns<T>(), []);
  const actionColumns = useMemo(
    () => columns.filter(column => /^(actions?|aksi)$/i.test(column.key) || /^aksi$/i.test(column.label)),
    [columns],
  );
  const effectiveColumns = useMemo(
    () => standard ? [...standardColumns, ...actionColumns] : columns,
    [standard, standardColumns, actionColumns, columns],
  );
  const effectiveHeaderGroups = standard ? STANDARD_HEADER_GROUPS : headerGroups;

  const groupedKeys = useMemo(() => {
    const map = new Map<string, TableHeaderGroup>();
    effectiveHeaderGroups?.forEach(group => group.keys.forEach(key => map.set(key, group)));
    return map;
  }, [effectiveHeaderGroups]);

  const filterGroups = useMemo(() => effectiveColumns.flatMap(column => {
    if (column.filterable === false) return [];
    if (!column.filterable && NON_FILTERABLE_KEY.test(column.key)) return [];

    const counts = new Map<string, number>();
    rows.forEach(row => {
      const value = filterValueOf(row, column);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    if (column.filterable !== true && (counts.size < 2 || counts.size > 12)) return [];

    const options = [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value, 'id-ID'));

    return [{ column, options }];
  }), [effectiveColumns, rows]);

  const isGroupActive = (key: string, optionCount: number) => {
    const selected = filters[key] ?? [];
    return selected.length > 0 && selected.length < optionCount;
  };

  const activeCount = filterGroups.filter(group => isGroupActive(group.column.key, group.options.length)).length;

  const visibleRows = useMemo(() => rows.filter(row => filterGroups.every(group => {
    const selected = filters[group.column.key] ?? [];
    if (selected.length === 0 || selected.length === group.options.length) return true;
    return selected.includes(filterValueOf(row, group.column));
  })), [rows, filterGroups, filters]);

  const selectedRows = canSelect ? visibleRows.filter(row => selectedKeys.includes(rowKey(row))) : [];
  const allVisibleSelected = visibleRows.length > 0 && selectedRows.length === visibleRows.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedRows.length > 0 && !allVisibleSelected;
    }
  }, [selectedRows.length, allVisibleSelected]);

  const toggleSelectAll = () => {
    setSelectedKeys(current => {
      const visibleKeys = visibleRows.map(rowKey);
      const remaining = current.filter(key => !visibleKeys.includes(key));
      return allVisibleSelected ? remaining : [...remaining, ...visibleKeys];
    });
  };

  const toggleRow = (key: string) => {
    setSelectedKeys(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  };

  const handleBulkDelete = () => {
    if (selectedRows.length === 0) return;
    if (onBulkDelete) {
      onBulkDelete(selectedRows);
      return;
    }
    if (onDelete && window.confirm(`Hapus ${selectedRows.length} data yang dipilih?`)) {
      selectedRows.forEach(onDelete);
      setSelectedKeys([]);
    }
  };

  const toggleOption = (key: string, value: string) => {
    setFilters(current => {
      const selected = current[key] ?? [];
      return {
        ...current,
        [key]: selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value],
      };
    });
  };

  const toggleAll = (key: string, values: string[]) => {
    setFilters(current => ({ ...current, [key]: (current[key] ?? []).length === values.length ? [] : values }));
  };

  return (
    <div>
      {filterGroups.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 pt-3">
          <button
            type="button"
            onClick={() => setOpen(current => !current)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-emerald-700"
            aria-expanded={open}
          >
            <ListFilter className="w-4 h-4" />
            Filter checkbox
            {activeCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{activeCount}</span>
            )}
          </button>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters({})}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset filter
            </button>
          )}
        </div>
      )}

      {open && filterGroups.length > 0 && (
        <div className="mx-3 sm:mx-4 mt-2 mb-1 p-3 rounded-xl border border-slate-200 bg-slate-50/80 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filterGroups.map(group => {
            const selected = filters[group.column.key] ?? [];
            const allChecked = selected.length === 0 || selected.length === group.options.length;
            return (
              <div key={group.column.key} className="min-w-0">
                <div className="text-xs font-semibold text-slate-700 mb-2">{group.column.label}</div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={() => toggleAll(group.column.key, group.options.map(option => option.value))}
                      className="w-3.5 h-3.5 accent-emerald-700"
                    />
                    <span className="font-medium">Semua</span>
                  </label>
                  {group.options.map(option => (
                    <label key={option.value} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allChecked || selected.includes(option.value)}
                        onChange={() => toggleOption(group.column.key, option.value)}
                        className="w-3.5 h-3.5 accent-emerald-700"
                      />
                      <span className="truncate" title={option.value}>{option.value}</span>
                      <span className="ml-auto text-slate-400">({option.count})</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canSelect && selectedRows.length > 0 && (
        <div className="mx-3 sm:mx-4 mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span className="font-semibold">{selectedRows.length} data dipilih</span>
          {(onBulkDelete || onDelete) && (
            <button
              type="button"
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1 font-semibold text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {bulkDeleteLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelectedKeys([])}
            className="ml-auto font-semibold text-slate-500 hover:text-slate-700"
          >
            Batalkan pilihan
          </button>
        </div>
      )}

      {visibleRows.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-500">
          {rows.length === 0 ? emptyLabel : 'Tidak ada data yang cocok dengan filter.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className={`w-full text-left border-collapse ${effectiveHeaderGroups?.length ? 'min-w-[1180px]' : 'min-w-[720px]'}`}>
            <thead>
              {effectiveHeaderGroups?.length ? (
                <>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
                    {canSelect && (
                      <th rowSpan={2} className="p-4 w-12">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAll}
                          aria-label="Pilih semua data"
                          className="w-4 h-4 accent-emerald-700"
                        />
                      </th>
                    )}
                    {effectiveColumns.map(column => {
                      const group = groupedKeys.get(column.key);
                      if (!group) {
                        return <th key={column.key} rowSpan={2} className="p-4 font-semibold whitespace-nowrap">{column.label}</th>;
                      }
                      if (group.keys[0] !== column.key) return null;
                      return <th key={`group-${group.label}`} colSpan={group.keys.length} className="p-4 font-semibold whitespace-nowrap text-center">{group.label}</th>;
                    })}
                    {(onEdit || onDelete) && <th rowSpan={2} className="p-4 font-semibold text-right">Aksi</th>}
                  </tr>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
                    {effectiveColumns.filter(column => groupedKeys.has(column.key)).map(column => (
                      <th key={column.key} className="p-4 font-semibold whitespace-nowrap">{column.label}</th>
                    ))}
                  </tr>
                </>
              ) : (
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
                  {canSelect && (
                    <th className="p-4 w-12">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        aria-label="Pilih semua data"
                        className="w-4 h-4 accent-emerald-700"
                      />
                    </th>
                  )}
                  {effectiveColumns.map(column => <th key={column.key} className="p-4 font-semibold whitespace-nowrap">{column.label}</th>)}
                  {(onEdit || onDelete) && <th className="p-4 font-semibold text-right">Aksi</th>}
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {visibleRows.map((row, index) => (
                <tr key={rowKey(row)} className="hover:bg-slate-50/80 transition">
                  {canSelect && (
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedKeys.includes(rowKey(row))}
                        onChange={() => toggleRow(rowKey(row))}
                        aria-label={`Pilih ${effectiveColumns[0]?.label ?? 'data'}`}
                        className="w-4 h-4 accent-emerald-700"
                      />
                    </td>
                  )}
                  {effectiveColumns.map(column => (
                    <td key={column.key} className="p-4 text-slate-700">
                      {column.render ? column.render(row, indexOffset + index) : String((row as Record<string, unknown>)[column.key] ?? '-')}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="p-4 text-right whitespace-nowrap">
                      {onEdit && (
                        <button onClick={() => onEdit(row)} className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg" title="Ubah">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button onClick={() => onDelete(row)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Hapus">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, wide }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
      <div className={`bg-white rounded-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up`}>
        <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between gap-3">
          <h3 className="text-base sm:text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Tutup"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

interface ToastProps {
  message: string;
  kind?: 'error' | 'success';
  onClose: () => void;
}

export function Toast({ message, kind = 'success', onClose }: ToastProps) {
  if (!message) return null;
  return <div className="fixed bottom-5 right-5 z-[70] w-[min(92vw,380px)] shadow-lg"><AlertBox message={message} kind={kind} onClose={onClose} /></div>;
}

interface FilterBarProps {
  search: string;
  onSearch: (value: string) => void;
  children?: React.ReactNode;
}

export function FilterBar({ search, onSearch, children }: FilterBarProps) {
  return (
    <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
      <input
        value={search}
        onChange={event => onSearch(event.target.value)}
        placeholder="Cari data..."
        className={`${inputClass} flex-1 min-w-[180px]`}
      />
      {children}
    </div>
  );
}
