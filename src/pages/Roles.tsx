import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Plus, Edit2, Trash2, Check, X, AlertCircle } from 'lucide-react';
import type { Role } from '../types';
import { getRoles, saveRole, deleteRole, MASTER_PERMISSIONS, WAREHOUSE_ROLE_GROUPS } from '../services/rbacService';
import { LoadingOverlay } from '../components/ui';
import { ACTION_DELAY_MS, wait } from '../utils/async';

const roleGroupByName = new Map<string, string>(
  WAREHOUSE_ROLE_GROUPS.flatMap(group => group.roles.map(name => [name, group.name] as [string, string]))
);
const roleGroupOrder = [...WAREHOUSE_ROLE_GROUPS.map(group => group.name), 'Lainnya'];

export const Roles: React.FC = () => {
  const { currentUser, hasPermission, refreshUserData } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal state for Add/Edit Role
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canManageRoles = currentUser?.role === 'Super Admin' || hasPermission('roles.create');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getRoles();
      setRoles(data);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat data role');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDesc('');
    setSelectedPermissions([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (role: Role) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description);
    setSelectedPermissions(role.permissions);
    setIsModalOpen(true);
  };

  const handleTogglePermission = (permId: string) => {
    if (selectedPermissions.includes(permId)) {
      setSelectedPermissions(selectedPermissions.filter(id => id !== permId));
    } else {
      setSelectedPermissions([...selectedPermissions, permId]);
    }
  };

  const handleToggleModulePermissions = (moduleName: string) => {
    const modulePerms = MASTER_PERMISSIONS.filter(p => p.module === moduleName).map(p => p.id);
    const allSelected = modulePerms.every(id => selectedPermissions.includes(id));
    if (allSelected) {
      setSelectedPermissions(selectedPermissions.filter(id => !modulePerms.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedPermissions, ...modulePerms]));
      setSelectedPermissions(merged);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await wait(ACTION_DELAY_MS);
      await saveRole({
        id: editingRole ? editingRole.id : undefined,
        name: roleName,
        description: roleDesc,
        permissions: selectedPermissions,
        isActive: editingRole ? editingRole.isActive : true
      }, currentUser);

      setSuccess('Role berhasil disimpan.');
      setIsModalOpen(false);
      await refreshUserData();
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (roleId: string) => {
    if (!currentUser) return;
    if (!window.confirm('Apakah Anda yakin ingin menghapus role ini?')) return;
    setError('');
    setSuccess('');
    setDeleting(true);

    try {
      await wait(ACTION_DELAY_MS);
      await deleteRole(roleId, currentUser);
      setSuccess('Role berhasil dihapus.');
      await refreshUserData();
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus role');
    } finally {
      setDeleting(false);
    }
  };

  // Group permissions by module
  const modulesGroup = MASTER_PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, typeof MASTER_PERMISSIONS>);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 mr-2 shrink-0 text-ocean" />
            Manajemen Role & Dynamic Permission
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola hak akses dan perizinan setiap role secara dinamis dalam sistem SILOG.
          </p>
        </div>
        {canManageRoles && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-ocean hover:bg-ocean-dark text-white font-semibold rounded-xl text-sm transition shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Role Baru
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3 text-green-700 text-sm">
          <Check className="w-5 h-5 text-ocean shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500 text-sm">
          <div className="w-8 h-8 border-4 border-ocean-light border-t-ocean rounded-full animate-spin" />
          Memuat data role...
        </div>
      ) : roles.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-xs">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Belum ada role terdaftar.</p>
          <p className="text-xs text-slate-500 mt-1">Buat role pertama melalui tombol "Tambah Role Baru".</p>
        </div>
      ) : (
        <div className="space-y-6">
          {roleGroupOrder.map(groupName => {
            const groupRoles = roles.filter(role => (roleGroupByName.get(role.name) || 'Lainnya') === groupName);
            if (groupRoles.length === 0) return null;

            return (
              <section key={groupName}>
                <div className="flex items-center gap-2 sm:gap-3 mb-3">
                  <h2 className="text-sm sm:text-base font-bold text-slate-700">{groupName}</h2>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                    {groupRoles.length} role
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {groupRoles.map((role) => (
                    <div key={role.id} className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-base font-bold text-slate-800">{role.name}</h3>
                            {role.isSystem && (
                              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                System Role
                              </span>
                            )}
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${role.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {role.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mb-4 min-h-[36px]">{role.description || 'Tidak ada deskripsi.'}</p>

                        <div className="mb-4">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Hak Akses ({role.permissions.length} Permission)</p>
                          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto custom-scrollbar p-1">
                            {role.permissions.map((pId) => (
                              <span key={pId} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium">
                                {pId}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {canManageRoles && (
                        <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                          <button
                            onClick={() => handleOpenEdit(role)}
                            className="p-2 text-slate-600 hover:text-ocean hover:bg-ocean-light/70 rounded-lg transition"
                            title="Edit Role"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {!role.isSystem && (
                            <button
                              onClick={() => handleDelete(role.id)}
                              className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Hapus Role"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Role Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between gap-3">
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                {editingRole ? `Edit Role: ${editingRole.name}` : 'Buat Role Baru'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Nama Role</label>
                <input
                  type="text"
                  required
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="Contoh: Keuangan / Pengawas"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-ocean"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Deskripsi Role</label>
                <textarea
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  placeholder="Jelaskan fungsi dan batasan role ini..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-ocean"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">Pengaturan Permission</label>
                  <span className="text-xs text-slate-500 font-medium">{selectedPermissions.length} dipilih</span>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto border border-slate-200 rounded-xl p-4 bg-slate-50">
                  {Object.entries(modulesGroup).map(([moduleName, perms]) => {
                    const modulePermIds = perms.map(p => p.id);
                    const allChecked = modulePermIds.every(id => selectedPermissions.includes(id));
                    return (
                      <div key={moduleName} className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                          <span className="font-bold text-sm text-slate-800">{moduleName}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleModulePermissions(moduleName)}
                            className="text-xs font-semibold text-ocean hover:text-ocean-dark"
                          >
                            {allChecked ? 'Batalkan Semua' : 'Pilih Semua'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {perms.map(p => (
                            <label key={p.id} className="flex items-start space-x-2.5 cursor-pointer text-xs p-2 rounded-lg hover:bg-slate-50">
                              <input
                                type="checkbox"
                                checked={selectedPermissions.includes(p.id)}
                                onChange={() => handleTogglePermission(p.id)}
                                className="mt-0.5 rounded border-slate-300 text-ocean focus:ring-ocean"
                              />
                              <div>
                                <p className="font-semibold text-slate-800">{p.name}</p>
                                <p className="text-slate-500 text-[11px]">{p.description}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-ocean text-white rounded-xl text-sm font-semibold hover:bg-ocean-dark shadow-sm disabled:opacity-50"
                >
                  Simpan Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(saving || deleting) && <LoadingOverlay label={saving ? 'Menyimpan role...' : 'Menghapus role...'} />}
    </div>
  );
};
