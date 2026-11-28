import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollText, ShieldAlert } from 'lucide-react';
import type { AuditLog } from '../types';
import { getAuditLogs } from '../services/rbacService';
import { DataTable, type TableColumn } from '../components/DataViews';
import { AlertBox } from '../components/ui';
import { useDataVersion } from '../contexts/DataSyncContext';

function toTime(value: any): number {
  if (!value) return 0;
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function formatDateTime(value: any): string {
  const t = toTime(value);
  if (!t) return '-';
  return new Date(t).toLocaleString('id-ID');
}

export const AuditLogs: React.FC = () => {
  const dataVersion = useDataVersion('audit_logs');

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const active = await getAuditLogs();
      setLogs(active);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat audit log.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs, dataVersion]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) =>
      [log.userName, log.action, log.module, log.description, log.id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [logs, search]);

  // archived tab removed

  const activeColumns: TableColumn<AuditLog>[] = useMemo(() => [
    {
      key: 'createdAt',
      label: 'Waktu',
      filterable: false,
      render: (row) => <span className="text-xs text-slate-600 whitespace-nowrap">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'userName',
      label: 'Pengguna',
      render: (row) => <span className="font-medium text-slate-800">{row.userName || '-'}</span>,
    },
    { key: 'module', label: 'Modul' },
    {
      key: 'action',
      label: 'Aksi',
      render: (row) => <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-xs font-semibold text-slate-700">{row.action}</span>,
    },
    {
      key: 'description',
      label: 'Keterangan',
      filterable: false,
      render: (row) => <span className="text-slate-600">{row.description || '-'}</span>,
    },
  ], []);

  // archived columns removed

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
              <ScrollText className="w-5 h-5 sm:w-6 sm:h-6 mr-2 shrink-0 text-ocean" />
              Audit Log Sistem & Keamanan
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Riwayat pencatatan aktivitas sensitif di sistem.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari aktivitas..."
            className="w-full sm:max-w-sm px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-ocean"
          />
        </div>
      </div>

      <AlertBox message={error} onClose={() => setError('')} />

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500 text-sm">
          <div className="w-8 h-8 border-4 border-ocean-light border-t-ocean rounded-full animate-spin" />
          Memuat audit log...
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
          <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Belum ada aktivitas tercatat</h3>
          <p className="text-xs text-slate-500 mt-1">Aktivitas perubahan akan tercatat di sini.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <DataTable<AuditLog>
            standard={false}
            columns={activeColumns}
            rows={filteredLogs}
            rowKey={(log) => log.id}
            hideCheckboxFilter
            emptyLabel="Belum ada aktivitas tercatat."
          />
        </div>
      )}
    </div>
  );
};
