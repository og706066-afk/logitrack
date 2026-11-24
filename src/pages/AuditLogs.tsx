import React, { useState, useEffect } from 'react';
import { ScrollText, ShieldAlert } from 'lucide-react';
import type { AuditLog } from '../types';
import { getAuditLogs } from '../services/rbacService';

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
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center">
            <ScrollText className="w-6 h-6 mr-2 text-emerald-600" />
            Audit Log Sistem & Keamanan
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Riwayat pencatatan seluruh aktivitas sensitif terkait role, permission, dan manajemen pengguna.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Memuat audit log...</div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
          <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Belum ada aktivitas tercatat</h3>
          <p className="text-xs text-slate-500 mt-1">Aktivitas perubahan role dan user akan otomatis tercatat di sini.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Waktu</th>
                  <th className="p-4 font-semibold">Pengguna</th>
                  <th className="p-4 font-semibold">Modul</th>
                  <th className="p-4 font-semibold">Aksi</th>
                  <th className="p-4 font-semibold">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {logs.map((log) => {
                  const dateVal = log.createdAt?.seconds 
                    ? new Date(log.createdAt.seconds * 1000) 
                    : new Date(log.createdAt);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                        {isNaN(dateVal.getTime()) ? 'Baru saja' : dateVal.toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 font-semibold text-slate-800">{log.userName}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          {log.module}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 font-mono text-xs">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 text-xs">{log.description}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
