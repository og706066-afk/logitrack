import React, { useCallback, useEffect, useState } from 'react';
import { Database, Layers, Network, Plus } from 'lucide-react';
import { DataTable, Toast, inputClass, primaryButtonClass, secondaryButtonClass, type TableColumn } from '../components/DataViews';
import { ExcelImportButton, type ExcelImportField } from '../components/ExcelImport';
import { AlertBox, ConfirmDialog, LoadingOverlay, PageHeader, StatusBadge } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { createMasterData, getCollection, updateMasterData } from '../services/logitrackService';
import type { MasterData } from '../types/logitrack';

type SectionKey = 'kordas' | 'departments';

interface MasterForm {
  section: SectionKey;
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

interface SectionState {
  key: SectionKey;
  title: string;
  description: string;
  viewPermission: string;
  managePermission: string;
  icon: typeof Network;
  emptyLabel: string;
  addLabel: string;
}

const SECTIONS: SectionState[] = [
  {
    key: 'kordas',
    title: 'KORDA',
    description: 'Daftar Koordinator Daerah yang menjadi bagian dari jaringan logistik.',
    viewPermission: 'kordas.view',
    managePermission: 'kordas.manage',
    icon: Network,
    emptyLabel: 'Belum ada data KORDA.',
    addLabel: 'Tambah KORDA',
  },
  {
    key: 'departments',
    title: 'Bagian',
    description: 'Daftar bagian atau unit kerja yang menjadi tujuan distribusi barang.',
    viewPermission: 'departments.view',
    managePermission: 'departments.manage',
    icon: Layers,
    emptyLabel: 'Belum ada data Bagian.',
    addLabel: 'Tambah Bagian',
  },
];

const masterImportFields: ExcelImportField[] = [
  { key: 'name', label: 'Nama', required: true, aliases: ['name', 'nama', 'nama korda', 'nama bagian', 'nama wilayah', 'nama penerima'] },
  { key: 'code', label: 'Kode', aliases: ['code', 'kode'] },
  { key: 'description', label: 'Keterangan', aliases: ['description', 'deskripsi', 'keterangan', 'catatan'] },
];

const labelClass = 'block text-xs font-semibold text-slate-700 uppercase mb-2';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Terjadi kesalahan.';
}

export const MasterDataPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const [rows, setRows] = useState<Record<SectionKey, MasterData[]>>({ kordas: [], departments: [] });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<MasterForm | null>(null);
  const [deactivating, setDeactivating] = useState<{ section: SectionKey; row: MasterData } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState('');

  const load = useCallback(async () => {
    try {
      const [kordas, departments] = await Promise.all([
        getCollection<MasterData>('kordas'),
        getCollection<MasterData>('departments'),
      ]);
      setRows({
        kordas: kordas.sort((a, b) => String(a.name).localeCompare(String(b.name))),
        departments: departments.sort((a, b) => String(a.name).localeCompare(String(b.name))),
      });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openForm = (section: SectionKey, row?: MasterData) => {
    setError('');
    setSuccess('');
    setForm({
      section,
      id: row?.id || '',
      name: row?.name || '',
      description: row?.description || '',
      isActive: row ? row.isActive !== false : true,
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const name = form.name.trim();
    if (!name) {
      setError('Nama wajib diisi.');
      return;
    }
    if (rows[form.section].some(row => row.id !== form.id && row.name.trim().toLowerCase() === name.toLowerCase())) {
      setError('Nama sudah digunakan. Gunakan nama yang berbeda.');
      return;
    }
    setError('');
    setProcessing('Menyimpan data...');
    try {
      const input = { name, description: form.description.trim(), isActive: form.isActive };
      if (form.id) {
        await updateMasterData(form.section, form.id, input, currentUser);
        setSuccess(`${name} berhasil diperbarui.`);
      } else {
        await createMasterData(form.section, input, currentUser);
        setSuccess(`${name} berhasil ditambahkan.`);
      }
      setForm(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setProcessing('');
    }
  };

  const handleDeactivate = async () => {
    if (!deactivating) return;
    const target = deactivating;
    setDeactivating(null);
    setError('');
    setProcessing('Menonaktifkan data...');
    try {
      await updateMasterData(target.section, target.row.id, { isActive: false }, currentUser);
      setSuccess(`${target.row.name} berhasil dinonaktifkan.`);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setProcessing('');
    }
  };

  const canViewAny = SECTIONS.some(section => hasPermission(section.viewPermission));
  if (!canViewAny) {
    return <AlertBox message="Anda tidak memiliki izin untuk melihat data master KORDA dan Bagian." />;
  }

  const handleImportExcel = async (section: SectionKey, records: Record<string, string>[]) => {
    for (const record of records) {
      await createMasterData(section, {
        name: record.name,
        code: record.code || '',
        description: record.description || '',
        status: 'Aktif',
        isActive: true,
      }, currentUser);
    }
    await load();
    return records.length;
  };

  const buildColumns = (section: SectionState): TableColumn<MasterData>[] => {
    const canManage = hasPermission(section.managePermission);
    return [
      { key: 'name', label: 'Nama', render: row => <span className="font-semibold text-slate-800">{row.name}</span> },
      { key: 'description', label: 'Deskripsi', render: row => row.description || '-' },
      { key: 'isActive', label: 'Status', render: row => <StatusBadge value={row.isActive === false ? 'Nonaktif' : 'Aktif'} /> },
      {
        key: 'actions',
        label: 'Aksi',
        render: row => (
          <div className="flex items-center justify-end gap-2">
            {canManage && (
              <button onClick={() => openForm(section.key, row)} className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">
                Ubah
              </button>
            )}
            {canManage && row.isActive !== false && (
              <button onClick={() => setDeactivating({ section: section.key, row })} className="px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
                Nonaktifkan
              </button>
            )}
          </div>
        ),
      },
    ];
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Master KORDA & Bagian"
        description="Kelola daftar Koordinator Daerah dan bagian kerja yang digunakan pada transaksi dan distribusi."
        icon={Database}
      />
      <Toast message={error} kind="error" onClose={() => setError('')} />
      <Toast message={success} kind="success" onClose={() => setSuccess('')} />

      {SECTIONS.map(section => {
        if (!hasPermission(section.viewPermission)) return null;
        const canManage = hasPermission(section.managePermission);
        const SectionIcon = section.icon;
        const data = rows[section.key];
        return (
          <div key={section.key} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <SectionIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-800">{section.title}</h2>
                  <p className="text-xs text-slate-500">{section.description}</p>
                </div>
              </div>
              {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => openForm(section.key)} className={primaryButtonClass}>
                    <Plus className="w-4 h-4 mr-2" /> {section.addLabel}
                  </button>
                  <ExcelImportButton
                    fields={masterImportFields}
                    permission="imports.execute"
                    existingRows={data}
                    uniqueFields={['name', 'code']}
                    onImport={records => handleImportExcel(section.key, records)}
                    label="Impor Excel"
                    title={`Impor ${section.title} dari Excel/CSV`}
                  />
                </div>
              )}
            </div>
            {loading ? (
              <div className="p-6 text-sm text-slate-500">Memuat data...</div>
            ) : data.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <p className="text-sm text-slate-500 mb-4">{section.emptyLabel}</p>
                {canManage && (
                  <button onClick={() => openForm(section.key)} className={secondaryButtonClass}>
                    <Plus className="w-4 h-4 mr-2" /> {section.addLabel}
                  </button>
                )}
              </div>
            ) : (
              <DataTable columns={buildColumns(section)} rows={data} rowKey={row => row.id} />
            )}
          </div>
        );
      })}

      {form && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                {form.id ? 'Ubah' : 'Tambah'} {SECTIONS.find(section => section.key === form.section)?.title}
              </h3>
              <button type="button" onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-600" aria-label="Tutup">×</button>
            </div>
            <div>
              <label className={labelClass}>Nama</label>
              <input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className={inputClass} placeholder="Contoh: KORDA Jakarta" />
            </div>
            <div>
              <label className={labelClass}>Deskripsi</label>
              <textarea rows={3} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className={inputClass} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} className="w-4 h-4 accent-emerald-700" />
              Aktif
            </label>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setForm(null)} className={secondaryButtonClass}>Batal</button>
              <button type="submit" className={primaryButtonClass}>Simpan</button>
            </div>
          </form>
        </div>
      )}

      {deactivating && (
        <ConfirmDialog
          message={`Nonaktifkan "${deactivating.row.name}"? Data tidak akan dihapus.`}
          confirmLabel="Nonaktifkan"
          onConfirm={() => void handleDeactivate()}
          onCancel={() => setDeactivating(null)}
        />
      )}
      {processing && <LoadingOverlay label={processing} />}
    </div>
  );
};
