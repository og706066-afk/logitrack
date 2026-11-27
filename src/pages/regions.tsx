import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Plus, Send, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDataVersion } from '../contexts/DataSyncContext';
import { AlertBox, ConfirmDialog, InfoCard, LoadingOverlay, PageHeader, StatusBadge } from '../components/ui';
import {
  DataTable,
  FilterBar,
  Modal,
  Toast,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  type TableColumn,
} from '../components/DataViews';
import { ExcelImportButton, type ExcelImportField } from '../components/ExcelImport';
import {
  createMasterData,
  dateString,
  displayDate,
  getCollection,
  toNumber,
  updateMasterData,
} from '../services/logitrackService';
import type { Distribution, Recipient, Region } from '../types/logitrack';
import { friendlyActionError } from '../utils/async';

interface RegionDraft {
  id?: string;
  name: string;
  rtNumber: string;
  population: string;
  headName: string;
  status: 'Aktif' | 'Nonaktif';
}

interface RecipientDraft {
  id?: string;
  name: string;
  regionId: string;
  regionName: string;
  notes: string;
}

const regionImportFields: ExcelImportField[] = [
  { key: 'name', label: 'Nama Wilayah', required: true, aliases: ['nama wilayah', 'wilayah', 'name', 'nama', 'korda'] },
  { key: 'rtNumber', label: 'Nomor RT', required: true, aliases: ['nomor rt', 'no rt', 'rt', 'rt number'] },
  { key: 'population', label: 'Jumlah Warga', aliases: ['jumlah warga', 'populasi', 'population'] },
  { key: 'headName', label: 'Ketua RT', aliases: ['ketua rt', 'nama ketua', 'head name'] },
];

const recipientImportFields: ExcelImportField[] = [
  { key: 'name', label: 'Nama Penerima', required: true, aliases: ['nama penerima', 'penerima', 'name', 'nama'] },
  { key: 'region', label: 'Wilayah', required: true, aliases: ['wilayah', 'region', 'nama wilayah', 'rt'] },
  { key: 'notes', label: 'Catatan', aliases: ['catatan', 'notes', 'keterangan'] },
];

interface DeletionTarget {
  kind: 'region' | 'recipient';
  ids: string[];
  label: string;
}

type DistributionRow = Distribution & { kordaName?: string };

function emptyRegionDraft(): RegionDraft {
  return { name: '', rtNumber: '', population: '0', headName: '', status: 'Aktif' };
}

function emptyRecipientDraft(): RecipientDraft {
  return { name: '', regionId: '', regionName: '', notes: '' };
}

export const RegionsPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const dataVersion = useDataVersion('regions', 'recipients', 'distributions');
  const [regions, setRegions] = useState<Region[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [distributions, setDistributions] = useState<DistributionRow[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [search, setSearch] = useState('');
  const [regionForm, setRegionForm] = useState<RegionDraft | null>(null);
  const [recipientForm, setRecipientForm] = useState<RecipientDraft | null>(null);
  const [deletion, setDeletion] = useState<DeletionTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canView = hasPermission('regions.view');
  const canManage = hasPermission('regions.manage');
  const canSeePersonal = ['Super Admin', 'Manager', 'Staf Gudang'].includes(currentUser?.role || '');

  useEffect(() => {
    if (!canView) return;
    let active = true;
    void Promise.all([
      getCollection<Region>('regions'),
      getCollection<Recipient>('recipients'),
      getCollection<DistributionRow>('distributions'),
    ]).then(([regionRows, recipientRows, distributionRows]) => {
      if (!active) return;
      setRegions(regionRows);
      setRecipients(recipientRows);
      setDistributions(distributionRows);
      setSelectedRegionId(previous => previous || regionRows[0]?.id || '');
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Gagal memuat data wilayah.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [canView, dataVersion]);

  const recipientCountByRegion = useMemo(() => {
    const counts = new Map<string, number>();
    recipients.forEach(recipient => {
      counts.set(recipient.regionId, (counts.get(recipient.regionId) || 0) + 1);
    });
    return counts;
  }, [recipients]);

  const distributionCountByRegion = useMemo(() => {
    const counts = new Map<string, number>();
    regions.forEach(region => {
      const total = distributions.filter(distribution =>
        distribution.kordaId === region.id || distribution.kordaName === region.name).length;
      counts.set(region.id, total);
    });
    return counts;
  }, [regions, distributions]);

  const needle = search.trim().toLowerCase();
  const filteredRegions = regions.filter(region =>
    !needle || [region.name, region.rtNumber, region.headName]
      .some(value => String(value || '').toLowerCase().includes(needle)));

  const filteredRecipients = recipients.filter(recipient =>
    !needle || [recipient.name, recipient.regionName, recipient.notes]
      .some(value => String(value || '').toLowerCase().includes(needle)));

  const selectedRegion = regions.find(region => region.id === selectedRegionId) || regions[0];
  const regionDistributions = selectedRegion
    ? distributions
      .filter(distribution =>
        distribution.kordaId === selectedRegion.id || distribution.kordaName === selectedRegion.name)
      .sort((a, b) => dateString(b.date).localeCompare(dateString(a.date)))
    : [];

  const totalPopulation = regions.reduce((sum, region) => sum + toNumber(region.population), 0);
  const totalDistributions = distributions.length;

  const regionColumns: TableColumn<Region>[] = [
    { key: 'name', label: 'Nama wilayah', render: row => <span className="font-semibold text-slate-800">{row.name}</span> },
    { key: 'rtNumber', label: 'Nomor RT', render: row => row.rtNumber || '-' },
    { key: 'population', label: 'Jumlah warga', render: row => toNumber(row.population).toLocaleString('id-ID') },
    { key: 'headName', label: 'Ketua RT', render: row => row.headName || '-' },
    { key: 'recipients', label: 'Penerima', render: row => `${recipientCountByRegion.get(row.id) || 0} orang` },
    { key: 'distributions', label: 'Penyaluran', render: row => `${distributionCountByRegion.get(row.id) || 0} kali` },
    { key: 'status', label: 'Status', render: row => <StatusBadge value={row.status || 'Aktif'} /> },
  ];

  const recipientColumns: TableColumn<Recipient>[] = [
    { key: 'name', label: 'Nama penerima', render: row => <span className="font-semibold text-slate-800">{row.name}</span> },
    { key: 'regionName', label: 'Wilayah', render: row => row.regionName || '-' },
    { key: 'notes', label: 'Catatan', render: row => row.notes || '-' },
    { key: 'status', label: 'Status', render: row => <StatusBadge value={row.status || 'Aktif'} /> },
  ];

  const distributionColumns: TableColumn<DistributionRow>[] = [
    { key: 'date', label: 'Tanggal', render: row => displayDate(row.date) },
    { key: 'distributionNumber', label: 'Nomor', render: row => <span className="font-semibold text-slate-800">{row.distributionNumber}</span> },
    { key: 'itemName', label: 'Barang', render: row => row.itemName || '-' },
    { key: 'quantity', label: 'Jumlah', render: row => `${toNumber(row.quantity).toLocaleString('id-ID')} ${row.unit || ''}` },
    { key: 'departmentName', label: 'Bagian', render: row => row.departmentName || '-' },
    { key: 'purpose', label: 'Tujuan', render: row => row.purpose || '-' },
    { key: 'handedBy', label: 'Diserahkan oleh', render: row => row.handedBy || '-' },
  ];

  const saveRegion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!regionForm) return;
    if (!regionForm.name.trim() || !regionForm.rtNumber.trim()) {
      setError('Nama wilayah dan nomor RT wajib diisi.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: regionForm.name.trim(),
        rtNumber: regionForm.rtNumber.trim(),
        population: toNumber(regionForm.population),
        headName: regionForm.headName.trim(),
        status: regionForm.status,
        isActive: regionForm.status === 'Aktif',
      };
      if (regionForm.id) {
        await updateMasterData('regions', regionForm.id, payload, currentUser);
      } else {
        await createMasterData('regions', payload, currentUser);
      }
      setRegionForm(null);
      setSuccess(regionForm.id ? 'Data wilayah berhasil diubah.' : 'Data wilayah berhasil ditambahkan.');
      const rows = await getCollection<Region>('regions');
      setRegions(rows);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Gagal menyimpan data wilayah.');
    } finally {
      setSaving(false);
    }
  };

  const saveRecipient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!recipientForm) return;
    if (!recipientForm.name.trim() || !recipientForm.regionId) {
      setError('Nama penerima dan wilayah wajib diisi.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const region = regions.find(item => item.id === recipientForm.regionId);
      const payload = {
        name: recipientForm.name.trim(),
        regionId: recipientForm.regionId,
        regionName: region?.name || recipientForm.regionName,
        notes: recipientForm.notes.trim(),
        status: 'Aktif',
        isActive: true,
      };
      if (recipientForm.id) {
        await updateMasterData('recipients', recipientForm.id, payload, currentUser);
      } else {
        await createMasterData('recipients', payload, currentUser);
      }
      setRecipientForm(null);
      setSuccess(recipientForm.id ? 'Data penerima berhasil diubah.' : 'Data penerima berhasil ditambahkan.');
      const rows = await getCollection<Recipient>('recipients');
      setRecipients(rows);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Gagal menyimpan data penerima.');
    } finally {
      setSaving(false);
    }
  };

  const applyDeletion = async () => {
    if (!deletion) return;
    setSaving(true);
    setError('');
    try {
      if (deletion.kind === 'region') {
        await Promise.all(deletion.ids.map(id => updateMasterData('regions', id, { status: 'Nonaktif', isActive: false }, currentUser)));
        const rows = await getCollection<Region>('regions');
        setRegions(rows);
      } else {
        await Promise.all(deletion.ids.map(id => updateMasterData('recipients', id, { status: 'Nonaktif', isActive: false }, currentUser)));
        const rows = await getCollection<Recipient>('recipients');
        setRecipients(rows);
      }
      setSuccess(`${deletion.label} berhasil dinonaktifkan.`);
      setDeletion(null);
    } catch (reason: unknown) {
      setError(friendlyActionError(reason, 'Gagal menonaktifkan data.'));
    } finally {
      setSaving(false);
    }
  };

  const handleImportRegions = async (records: Record<string, string>[]) => {
    for (const record of records) {
      await createMasterData('regions', {
        name: record.name,
        rtNumber: record.rtNumber,
        population: toNumber(record.population),
        headName: record.headName,
        status: 'Aktif',
        isActive: true,
      }, currentUser);
    }
    setRegions(await getCollection<Region>('regions'));
    return records.length;
  };

  const handleImportRecipients = async (records: Record<string, string>[]) => {
    for (const [index, record] of records.entries()) {
      const region = regions.find(item =>
        item.name.trim().toLowerCase() === record.region.trim().toLowerCase()
        || item.rtNumber.trim().toLowerCase() === record.region.trim().toLowerCase());
      if (!region) throw new Error(`Baris ${index + 1}: wilayah "${record.region}" tidak ditemukan.`);
      await createMasterData('recipients', {
        name: record.name,
        regionId: region.id,
        regionName: region.name,
        notes: record.notes,
        status: 'Aktif',
        isActive: true,
      }, currentUser);
    }
    setRecipients(await getCollection<Recipient>('recipients'));
    return records.length;
  };

  if (!canView) {
    return <AlertBox message="Anda tidak memiliki izin untuk melihat data wilayah dan penerima." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wilayah & Penerima Distribusi"
        description="Kelola data KORDA, ketua RT, penerima distribusi, dan riwayat penyaluran barang."
        icon={MapPin}
        action={canManage ? (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setRecipientForm({ ...emptyRecipientDraft(), regionId: selectedRegion?.id || '', regionName: selectedRegion?.name || '' })} className={secondaryButtonClass}>
              <Plus className="w-4 h-4 mr-2" /> Penerima
            </button>
            <button onClick={() => setRegionForm(emptyRegionDraft())} className={primaryButtonClass}>
              <Plus className="w-4 h-4 mr-2" /> Wilayah
            </button>
          </div>
        ) : undefined}
      />
      <AlertBox message={error} onClose={() => setError('')} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard title="Total wilayah" value={`${regions.length} wilayah`} detail="KORDA terdaftar" icon={MapPin} />
        <InfoCard title="Total warga" value={totalPopulation.toLocaleString('id-ID')} detail="Akumulasi wilayah" icon={Users} color="bg-sky-600" />
        <InfoCard title="Total penerima" value={`${recipients.length} orang`} detail="Terdaftar" icon={Users} color="bg-violet-600" />
        <InfoCard title="Total penyaluran" value={`${totalDistributions} kali`} detail="Distribusi tercatat" icon={Send} color="bg-amber-500" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center"><MapPin className="w-4 h-4 mr-2 text-ocean" /> Data Wilayah</h3>
          {canManage && (
            <ExcelImportButton
              fields={regionImportFields}
              permission="imports.execute"
              existingRows={regions}
              uniqueFields={['name', 'rtNumber']}
              onImport={handleImportRegions}
              label="Impor Excel"
              title="Impor Wilayah dari Excel/CSV"
            />
          )}
        </div>
        <FilterBar search={search} onSearch={setSearch} />
        <DataTable
          columns={regionColumns}
          rows={filteredRegions}
          rowKey={row => row.id}
          onEdit={canManage ? row => setRegionForm({
            id: row.id,
            name: row.name,
            rtNumber: row.rtNumber,
            population: String(toNumber(row.population)),
            headName: row.headName,
            status: row.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
          }) : undefined}
          onDelete={canManage ? row => setDeletion({ kind: 'region', ids: [row.id], label: `Wilayah ${row.name}` }) : undefined}
          onBulkDelete={canManage ? rows => setDeletion({ kind: 'region', ids: rows.map(row => row.id), label: `${rows.length} wilayah terpilih` }) : undefined}
          bulkDeleteLabel="Nonaktifkan wilayah terpilih"
          emptyLabel="Belum ada data wilayah."
        />
      </div>

      {canSeePersonal ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-slate-800 text-sm flex items-center"><Users className="w-4 h-4 mr-2 text-ocean" /> Data Penerima Distribusi</h3>
            {canManage && (
              <ExcelImportButton
                fields={recipientImportFields}
                permission="imports.execute"
                existingRows={recipients}
                uniqueFields={['name']}
                onImport={handleImportRecipients}
                label="Impor Excel"
                title="Impor Penerima dari Excel/CSV"
              />
            )}
          </div>
          <DataTable
            columns={recipientColumns}
            rows={filteredRecipients}
            rowKey={row => row.id}
            onEdit={canManage ? row => setRecipientForm({
              id: row.id,
              name: row.name,
              regionId: row.regionId,
              regionName: row.regionName,
              notes: row.notes,
            }) : undefined}
            onDelete={canManage ? row => setDeletion({ kind: 'recipient', ids: [row.id], label: `Penerima ${row.name}` }) : undefined}
            onBulkDelete={canManage ? rows => setDeletion({ kind: 'recipient', ids: rows.map(row => row.id), label: `${rows.length} penerima terpilih` }) : undefined}
            bulkDeleteLabel="Nonaktifkan penerima terpilih"
            emptyLabel="Belum ada data penerima."
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 text-sm flex items-center"><Users className="w-4 h-4 mr-2 text-ocean" /> Rekap Penerima per Wilayah</h3>
            <p className="text-xs text-slate-500 mt-1">Data pribadi penerima disembunyikan sesuai kebijakan akses.</p>
          </div>
          <DataTable
            columns={[
              {
                key: 'name',
                label: 'Wilayah',
                render: row => <span className="font-medium text-slate-800">{row.name || '-'}</span>,
              },
              {
                key: 'recipientCount',
                label: 'Jumlah penerima',
                render: row => <span>{recipientCountByRegion.get(row.id) || 0} penerima</span>,
              },
              {
                key: 'population',
                label: 'Jumlah warga',
                render: row => <span>{toNumber(row.population).toLocaleString('id-ID')} warga</span>,
              },
            ]}
            rows={regions}
            rowKey={region => region.id}
            selectable={false}
            emptyLabel="Belum ada data wilayah."
          />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center"><Send className="w-4 h-4 mr-2 text-ocean" /> Riwayat Penyaluran per Wilayah</h3>
          <select value={selectedRegion?.id || ''} onChange={event => setSelectedRegionId(event.target.value)} className={`${inputClass} max-w-xs`} aria-label="Pilih wilayah">
            <option value="">Pilih wilayah</option>
            {regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
          </select>
        </div>
        <DataTable
          columns={distributionColumns}
          rows={regionDistributions}
          rowKey={row => row.id}
          emptyLabel={selectedRegion ? 'Belum ada penyaluran untuk wilayah ini.' : 'Pilih wilayah untuk melihat riwayat penyaluran.'}
        />
      </div>

      {regionForm && (
        <Modal title={regionForm.id ? 'Ubah Data Wilayah' : 'Tambah Data Wilayah'} onClose={() => setRegionForm(null)}>
          <form onSubmit={event => void saveRegion(event)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Nama wilayah</label>
              <input required value={regionForm.name} onChange={event => setRegionForm({ ...regionForm, name: event.target.value })} className={inputClass} placeholder="Contoh: KORDA 1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Nomor RT</label>
                <input required value={regionForm.rtNumber} onChange={event => setRegionForm({ ...regionForm, rtNumber: event.target.value })} className={inputClass} placeholder="Contoh: RT 01" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Jumlah warga</label>
                <input type="number" min="0" value={regionForm.population} onChange={event => setRegionForm({ ...regionForm, population: event.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Nama ketua RT</label>
                <input value={regionForm.headName} onChange={event => setRegionForm({ ...regionForm, headName: event.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Status</label>
                <select value={regionForm.status} onChange={event => setRegionForm({ ...regionForm, status: event.target.value as RegionDraft['status'] })} className={inputClass}>
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Nonaktif</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setRegionForm(null)} className={secondaryButtonClass}>Batal</button>
              <button type="submit" disabled={saving} className={primaryButtonClass}>Simpan Wilayah</button>
            </div>
          </form>
        </Modal>
      )}

      {recipientForm && (
        <Modal title={recipientForm.id ? 'Ubah Data Penerima' : 'Tambah Data Penerima'} onClose={() => setRecipientForm(null)}>
          <form onSubmit={event => void saveRecipient(event)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Nama penerima</label>
              <input required value={recipientForm.name} onChange={event => setRecipientForm({ ...recipientForm, name: event.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Wilayah</label>
              <select required value={recipientForm.regionId} onChange={event => setRecipientForm({ ...recipientForm, regionId: event.target.value })} className={inputClass}>
                <option value="">Pilih wilayah</option>
                {regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Catatan</label>
              <textarea rows={3} value={recipientForm.notes} onChange={event => setRecipientForm({ ...recipientForm, notes: event.target.value })} className={inputClass} placeholder="Opsional" />
            </div>
            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setRecipientForm(null)} className={secondaryButtonClass}>Batal</button>
              <button type="submit" disabled={saving} className={primaryButtonClass}>Simpan Penerima</button>
            </div>
          </form>
        </Modal>
      )}

      {deletion && (
        <ConfirmDialog
          message={`Nonaktifkan ${deletion.label}? Data tetap tersimpan tetapi tidak ditampilkan sebagai aktif.`}
          confirmLabel="Nonaktifkan"
          onConfirm={() => void applyDeletion()}
          onCancel={() => setDeletion(null)}
        />
      )}

      <Toast message={success} kind="success" onClose={() => setSuccess('')} />
      {loading && <LoadingOverlay label="Memuat data wilayah..." />}
      {saving && <LoadingOverlay label="Menyimpan data..." />}
    </div>
  );
};
