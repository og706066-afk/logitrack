import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollText, ShieldAlert, Trash2 } from 'lucide-react';
import type { AuditLog } from '../types';
import { deleteAuditLogs, getAuditLogs, isArchivableAuditLog } from '../services/rbacService';
import { DataTable, type TableColumn } from '../components/DataViews';
import { AlertBox, LoadingOverlay } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
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
  const { currentUser } = useAuth();
  const dataVersion = useDataVersion('audit_logs');
  const isSuperAdmin = currentUser?.role === 'Super Admin';

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedLogs, setSelectedLogs] = useState<AuditLog[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [clearSelectionToken, setClearSelectionToken] = useState(0);
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

  const handleDeleteRequest = (rows: AuditLog[]) => {
    if (!isSuperAdmin) return;
    const deletable = rows.filter(isArchivableAuditLog);
    if (deletable.length === 0) {
      setError('Pilih log Firestore yang tersinkron untuk dihapus.');
      return;
    }
    if (deletable.length !== rows.length) {
      setError('Sebagian log yang dipilih tidak dapat dihapus (belum tersinkron).');
    }
    setSelectedLogs(deletable);
    setConfirmDelete(true);
  };

  const handleDeleteConfirm = async () => {
    if (!isSuperAdmin || selectedLogs.length === 0 || deleting) return;
    const deletable = selectedLogs.filter(isArchivableAuditLog);
    if (deletable.length !== selectedLogs.length) {
      setError('Beberapa log yang dipilih tidak dapat dihapus.');
      return;
    }
    setConfirmDelete(false);
    setDeleting(true);
    setError('');
    setSuccess('');
    try {
      const ids = deletable.map((l) => l.id);
      const result = await deleteAuditLogs(ids);
      setSuccess(`${result.deletedCount} aktivitas berhasil dihapus.`);
      setSelectedLogs([]);
      setClearSelectionToken((t) => t + 1);
      await loadLogs();
    } catch (e: any) {
      setError(e.message || 'Gagal menghapus aktivitas.');
    } finally {
      setDeleting(false);
    }
  };

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
              Riwayat pencatatan aktivitas sensitif. Super Admin dapat menghapus aktivitas terpilih.
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
          <div className="flex items-center gap-2">
            {isSuperAdmin && selectedLogs.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                Hapus ({selectedLogs.filter(isArchivableAuditLog).length})
              </button>
            )}
          </div>
        </div>
      </div>

      <AlertBox message={error} onClose={() => setError('')} />
      <AlertBox message={success} kind="success" onClose={() => setSuccess('')} />

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
            selectable={isSuperAdmin}
            onBulkDelete={isSuperAdmin ? handleDeleteRequest : undefined}
            bulkDeleteLabel="Hapus yang dipilih"
            bulkActionIcon={<Trash2 className="w-3.5 h-3.5" />}
            onSelectionChange={(rows) => setSelectedLogs(rows.filter(isArchivableAuditLog))}
            clearSelectionToken={clearSelectionToken}
            emptyLabel="Belum ada aktivitas tercatat."
            disableRowSelection={(row) => !isArchivableAuditLog(row)}
          />
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl animate-slide-up">
            <h3 className="text-base font-bold text-slate-800 mb-2">Hapus Aktivitas</h3>
            <p className="text-sm text-slate-600 mb-4">
              Anda akan menghapus <span className="font-semibold">{selectedLogs.length}</span> aktivitas. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-60">Batal</button>
              <button onClick={() => void handleDeleteConfirm()} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 inline-flex items-center gap-2 disabled:opacity-60">
                <Trash2 className="w-4 h-4" /> {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && <LoadingOverlay label="Menghapus aktivitas..." />}
    </div>
  );
};
