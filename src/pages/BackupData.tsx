import React, { useCallback, useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Database } from 'lucide-react';
import { AlertBox, LoadingOverlay, PageHeader } from '../components/ui';
import { primaryButtonClass, secondaryButtonClass } from '../components/DataViews';
import { useAuth } from '../contexts/AuthContext';
import { loadBackupDatasets, type BackupDataset } from '../services/backupService';
import { exportBackupToExcel, exportBackupToPdf } from '../utils/exports';

type BackupFormat = 'excel' | 'pdf';

export const BackupDataPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canExport = hasPermission('backup.export');
  const [datasets, setDatasets] = useState<BackupDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BackupFormat | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setDatasets(await loadBackupDatasets());
    } catch (e: any) {
      setError(e.message || 'Gagal memuat ringkasan backup.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const handleExport = async (format: BackupFormat) => {
    if (!canExport || busy) return;
    setBusy(format);
    setError('');
    setSuccess('');
    try {
      const fresh = await loadBackupDatasets();
      setDatasets(fresh);
      const total = fresh.reduce((sum, dataset) => sum + dataset.rows.length, 0);
      const failed = fresh.filter((dataset) => dataset.error).length;
      const stamp = new Date().toISOString().slice(0, 10);

      if (format === 'excel') {
        await exportBackupToExcel(`backup-silog-${stamp}`, fresh);
      } else {
        await exportBackupToPdf(`backup-silog-${stamp}`, 'Backup Data SILOG', fresh);
      }

      const note = failed > 0
        ? ` ${failed} koleksi gagal dibaca; detailnya ada di lembar/ringkasan hasil backup.`
        : '';
      setSuccess(`${total} dokumen dari ${fresh.length} koleksi berhasil diunduh sebagai ${format.toUpperCase()}.${note}`);
    } catch (e: any) {
      setError(e.message || 'Gagal membuat file backup.');
    } finally {
      setBusy(null);
    }
  };

  const totalDocuments = datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0);
  const failedCollections = datasets.filter((dataset) => dataset.error).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Backup Data"
        description="Unduh salinan seluruh data aplikasi dari Firestore dalam format Excel atau PDF."
        icon={Download}
      />

      <AlertBox message={error} onClose={() => setError('')} />
      <AlertBox message={success} kind="success" onClose={() => setSuccess('')} />

      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Unduh Backup</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Excel berisi seluruh field pada sheet terpisah untuk setiap koleksi. PDF berisi ringkasan dan tabel kolom utama (maksimal 8 kolom per koleksi).
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              disabled={!canExport || busy !== null}
              onClick={() => void handleExport('excel')}
              className={primaryButtonClass}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Unduh Excel
            </button>
            <button
              type="button"
              disabled={!canExport || busy !== null}
              onClick={() => void handleExport('pdf')}
              className={secondaryButtonClass}
            >
              <FileText className="w-4 h-4" />
              Unduh PDF
            </button>
          </div>
        </div>

        {!canExport && (
          <p className="text-xs text-amber-700 mt-4">Anda tidak memiliki permission backup.export.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Koleksi</p>
            <p className="text-xl font-bold text-slate-800">{datasets.length}</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Total dokumen</p>
            <p className="text-xl font-bold text-slate-800">{totalDocuments}</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Koleksi gagal dibaca</p>
            <p className={`text-xl font-bold ${failedCollections > 0 ? 'text-red-600' : 'text-slate-800'}`}>{failedCollections}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <Database className="w-4 h-4 text-ocean" />
          <h2 className="text-sm font-bold text-slate-800">Cakupan backup</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Memuat ringkasan koleksi...</div>
        ) : datasets.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Belum ada koleksi yang dapat dibaca.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5 sm:p-6">
            {datasets.map((dataset) => (
              <div key={dataset.name} className="rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{dataset.label}</p>
                  <p className="text-xs text-slate-400 truncate">{dataset.name}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-lg shrink-0 ${dataset.error ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                  {dataset.error ? 'Gagal' : `${dataset.rows.length} dok`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {(busy !== null || loading) && <LoadingOverlay label={busy ? 'Membuat file backup...' : 'Memuat ringkasan...'} />}
    </div>
  );
};
