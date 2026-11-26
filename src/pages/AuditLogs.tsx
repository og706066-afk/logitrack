import React, { useState, useEffect } from 'react';
import { ScrollText, ShieldAlert } from 'lucide-react';
import type { AuditLog } from '../types';
import { getAuditLogs } from '../services/rbacService';
import { DataTable } from '../components/DataViews';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await getAuditLogs();
      setLogs(data);
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
            <ScrollText className="w-5 h-5 sm:w-6 sm:h-6 mr-2 shrink-0 text-emerald-600" />
            Audit Log Sistem & Keamanan
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Riwayat pencatatan seluruh aktivitas sensitif terkait role, permission, dan manajemen pengguna.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500 text-sm">
          <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
          Memuat audit log...
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
          <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Belum ada aktivitas tercatat</h3>
          <p className="text-xs text-slate-500 mt-1">Aktivitas perubahan role dan user akan otomatis tercatat di sini.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <DataTable
            columns={[]}
            rows={logs}
            rowKey={log => log.id}
            selectable={false}
            emptyLabel="Belum ada aktivitas tercatat."
          />
        </div>
      )}
    </div>
  );
};
