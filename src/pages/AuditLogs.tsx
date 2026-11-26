import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, ScrollText, ShieldAlert } from 'lucide-react';
import type { AuditLog, AuditLogArchive } from '../types';
import { archiveAuditLogs, getArchivedAuditLogs, getAuditLogs } from '../services/rbacService';
import { DataTable, type TableColumn } from '../components/DataViews';
import { AlertBox, LoadingOverlay } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';

type TabKey = 'active' | 'archived';

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
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'Super Admin';

  const [tab, setTab] = useState<TabKey>('active');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [archivedLogs, setArchivedLogs] = useState<AuditLogArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedLogs, setSelectedLogs] = useState<AuditLog[]>([]);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [clearSelectionToken, setClearSelectionToken] = useState(0);
  const [search, setSearch] = useState('');

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      if (isSuperAdmin) {
        const [active, archived] = await Promise.all([getAuditLogs(), getArchivedAuditLogs()]);
        setLogs(active);
        setArchivedLogs(archived);
      } else {
        const active = await getAuditLogs();
        setLogs(active);
        setArchivedLogs([]);
        setTab('active');
      }
    } catch (e: any) {
      setError(e.message || 'Gagal memuat audit log.');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) =>
      [log.userName, log.action, log.module, log.description, log.id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [logs, search]);

  const filteredArchived = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return archivedLogs;
    return archivedLogs.filter((log) =>
      [log.userName, log.action, log.module, log.description, log.archivedByName, log.archivedBy, log.archiveReason, log.id, log.originalLogId]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [archivedLogs, search]);

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

  const archivedColumns: TableColumn<AuditLogArchive>[] = useMemo(() => [
    {
      key: 'archivedAt',
      label: 'Diarsipkan',
      filterable: false,
      render: (row) => <span className="text-xs text-slate-600 whitespace-nowrap">{formatDateTime(row.archivedAt)}</span>,
    },
    {
      key: 'archivedByName',
      label: 'Diarsipkan Oleh',
      render: (row) => <span className="font-medium text-slate-800">{row.archivedByName || row.archivedBy || '-'}</span>,
    },
    {
      key: 'createdAt',
      label: 'Waktu Aktivitas',
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
      render: (row) => (
        <div>
          <div className="text-slate-600">{row.description || '-'}</div>
          {row.archiveReason && <div className="text-xs text-slate-400 mt-0.5">Alasan: {row.archiveReason}</div>}
        </div>
      ),
    },
  ], []);

  const handleArchiveRequest = (rows: AuditLog[]) => {
    if (!isSuperAdmin) return;
    setSelectedLogs(rows);
    setConfirmArchive(true);
  };

  const handleArchiveConfirm = async () => {
    if (!isSuperAdmin || selectedLogs.length === 0) return;
    setConfirmArchive(false);
    setArchiving(true);
    setError('');
    setSuccess('');
    try {
      const ids = selectedLogs.map((l) => l.id);
      const result = await archiveAuditLogs(ids, archiveReason.trim() || undefined);
      setSuccess(`${result.archivedCount} aktivitas berhasil diarsipkan.`);
      setArchiveReason('');
      setSelectedLogs([]);
      setClearSelectionToken((t) => t + 1);
      await loadLogs();
    } catch (e: any) {
      setError(e.message || 'Gagal mengarsipkan aktivitas.');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
              <ScrollText className="w-5 h-5 sm:w-6 sm:h-6 mr-2 shrink-0 text-emerald-600" />
              Audit Log Sistem & Keamanan
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Riwayat pencatatan aktivitas sensitif. Super Admin dapat mengarsipkan aktivitas terpilih.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setTab('active'); setSearch(''); setSelectedLogs([]); setClearSelectionToken((t) => t + 1); }}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border transition ${tab === 'active' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              Aktivitas
            </button>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => { setTab('archived'); setSearch(''); setSelectedLogs([]); setClearSelectionToken((t) => t + 1); }}
                className={`px-3 py-2 rounded-xl text-sm font-semibold border transition inline-flex items-center gap-1.5 ${tab === 'archived' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                <Archive className="w-4 h-4" /> Arsip
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'active' ? 'Cari aktivitas...' : 'Cari arsip aktivitas...'}
            className="w-full sm:max-w-sm px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
          />
          {tab === 'active' && isSuperAdmin && selectedLogs.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmArchive(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-sm transition shadow-sm"
            >
              <Archive className="w-4 h-4" />
              Arsipkan ({selectedLogs.length})
            </button>
          )}
        </div>
      </div>

      <AlertBox message={error} onClose={() => setError('')} />
      <AlertBox message={success} kind="success" onClose={() => setSuccess('')} />

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500 text-sm">
          <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
          Memuat audit log...
        </div>
      ) : tab === 'active' || !isSuperAdmin ? (
        filteredLogs.length === 0 ? (
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
              selectable={isSuperAdmin}
              onBulkDelete={isSuperAdmin ? handleArchiveRequest : undefined}
              bulkDeleteLabel="Arsipkan yang dipilih"
              bulkActionIcon={<Archive className="w-3.5 h-3.5" />}
              onSelectionChange={setSelectedLogs}
              clearSelectionToken={clearSelectionToken}
              emptyLabel="Belum ada aktivitas tercatat."
            />
          </div>
        )
      ) : filteredArchived.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
          <Archive className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Belum ada arsip aktivitas</h3>
          <p className="text-xs text-slate-500 mt-1">Aktivitas yang diarsipkan akan muncul di sini.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <DataTable<AuditLogArchive>
            standard={false}
            columns={archivedColumns}
            rows={filteredArchived}
            rowKey={(log) => log.id}
            selectable={false}
            emptyLabel="Belum ada arsip aktivitas."
          />
        </div>
      )}

      {confirmArchive && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl animate-slide-up">
            <h3 className="text-base font-bold text-slate-800 mb-2">Arsipkan Aktivitas</h3>
            <p className="text-sm text-slate-600 mb-4">
              Anda akan mengarsipkan <span className="font-semibold">{selectedLogs.length}</span> aktivitas. Aktivitas akan dipindahkan dari daftar utama ke arsip dan tidak dapat dihapus permanen dari UI ini.
            </p>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Alasan Arsip (opsional)</label>
            <textarea
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              placeholder="Contoh: Pembersihan log rutin bulan ini"
            />
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setConfirmArchive(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">Batal</button>
              <button onClick={() => void handleArchiveConfirm()} className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 inline-flex items-center gap-2">
                <Archive className="w-4 h-4" /> Arsipkan
              </button>
            </div>
          </div>
        </div>
      )}

      {archiving && <LoadingOverlay label="Mengarsipkan aktivitas..." />}
    </div>
  );
};
