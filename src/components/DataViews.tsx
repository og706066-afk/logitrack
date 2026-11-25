import React from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { AlertBox } from './ui';

export const inputClass = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-600';
export const primaryButtonClass = 'inline-flex items-center justify-center px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-sm transition shadow-sm disabled:opacity-50';
export const secondaryButtonClass = 'inline-flex items-center justify-center px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm transition disabled:opacity-50';

export interface TableColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  emptyLabel?: string;
}

export function DataTable<T>({ columns, rows, rowKey, onEdit, onDelete, emptyLabel = 'Belum ada data.' }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <div className="text-center py-12 text-sm text-slate-500">{emptyLabel}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
            {columns.map(column => <th key={column.key} className="p-4 font-semibold whitespace-nowrap">{column.label}</th>)}
            {(onEdit || onDelete) && <th className="p-4 font-semibold text-right">Aksi</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {rows.map(row => (
            <tr key={rowKey(row)} className="hover:bg-slate-50/80 transition">
              {columns.map(column => (
                <td key={column.key} className="p-4 text-slate-700">
                  {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '-')}
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
