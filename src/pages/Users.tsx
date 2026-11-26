import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UsersRound, Check, X, AlertCircle, Edit2, Shield } from 'lucide-react';
import type { UserProfile, Role } from '../types';
import { getUsers, updateUserRoleAndStatus, getRoles } from '../services/rbacService';
import { LoadingOverlay } from '../components/ui';
import { DataTable } from '../components/DataViews';
import { ACTION_DELAY_MS, wait } from '../utils/async';

export const Users: React.FC = () => {
  const { currentUser, refreshUserData } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit user modal
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [newRole, setNewRole] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const canManageUsers = currentUser?.role === 'Super Admin';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [uList, rList] = await Promise.all([getUsers(), getRoles()]);
      setUsers(uList);
      setRoles(rList);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat data pengguna');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (user: UserProfile) => {
    if (user.uid === currentUser?.uid) {
      setError('Keamanan: Anda tidak diizinkan mengubah role akun Anda sendiri melalui panel ini.');
      return;
    }
    setError('');
    setSelectedUser(user);
    setNewRole(user.role);
    setNewIsActive(user.isActive);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedUser) return;
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await wait(ACTION_DELAY_MS);
      await updateUserRoleAndStatus(selectedUser.uid, newRole, newIsActive, currentUser);
      setSuccess(`Role pengguna ${selectedUser.email} berhasil diperbarui.`);
      setIsModalOpen(false);
      await refreshUserData();
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui pengguna');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
            <UsersRound className="w-5 h-5 sm:w-6 sm:h-6 mr-2 shrink-0 text-emerald-600" />
            Manajemen Pengguna & Role Assignment
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Atur penugasan role dan status aktif akun pengguna dalam sistem SILOG.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-3 text-emerald-700 text-sm">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500 text-sm">
          <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
          Memuat data pengguna...
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <DataTable<UserProfile>
            columns={[
              {
                key: 'displayName',
                label: 'Pengguna',
                render: user => (
                  <div>
                    <div className="font-medium text-slate-800">{user.displayName || '-'}</div>
                    {user.uid === currentUser?.uid && (
                      <span className="inline-block mt-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Anda</span>
                    )}
                  </div>
                ),
              },
              {
                key: 'email',
                label: 'Email',
                render: user => <span className="text-xs text-slate-500">{user.email || '-'}</span>,
              },
              {
                key: 'role',
                label: 'Role',
                filterable: true,
                filterValue: user => user.role,
                render: user => (
                  <span className="inline-flex items-center px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-semibold">
                    <Shield className="w-3 h-3 mr-1" /> {user.role}
                  </span>
                ),
              },
              {
                key: 'isActive',
                label: 'Status Akun',
                filterable: true,
                filterValue: user => (user.isActive === false ? 'Nonaktif' : 'Aktif'),
                render: user => (
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${user.isActive === false ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {user.isActive === false ? 'Nonaktif' : 'Aktif'}
                  </span>
                ),
              },
              {
                key: 'actions',
                label: 'Aksi',
                filterable: false,
                render: user => (
                  canManageUsers && user.uid !== currentUser?.uid ? (
                    <button
                      onClick={() => handleOpenEdit(user)}
                      className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg text-xs font-semibold transition"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      Ubah Role
                    </button>
                  ) : null
                ),
              },
            ]}
            rows={users}
            rowKey={user => user.uid}
            selectable={false}
            emptyLabel="Belum ada pengguna."
          />
        </div>
      )}

      {/* Edit User Modal */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-800">Ubah Role Pengguna</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-4 sm:p-6 space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Pengguna</p>
                <p className="text-sm font-bold text-slate-800">{selectedUser.displayName}</p>
                <p className="text-xs text-slate-500 font-mono">{selectedUser.email}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Pilih Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                >
                  {roles.filter(r => r.isActive).map(r => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Status Akun</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={newIsActive}
                      onChange={() => setNewIsActive(true)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Aktif</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={!newIsActive}
                      onChange={() => setNewIsActive(false)}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span>Nonaktifkan</span>
                  </label>
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
                  className="px-5 py-2 bg-emerald-700 text-white rounded-xl text-sm font-semibold hover:bg-emerald-800 shadow-sm disabled:opacity-50"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {saving && <LoadingOverlay label="Menyimpan perubahan..." />}
    </div>
  );
};
