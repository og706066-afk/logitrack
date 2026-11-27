import React, { useEffect, useState } from 'react';
import { Menu, Bell, LogOut, User as UserIcon, Shield, ClipboardList, AlertTriangle, Truck, Sun, Moon } from 'lucide-react';
import { getCollection, getShipments } from '../services/logitrackService';
import type { Item, NeedRequest } from '../types/logitrack';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useDataVersion } from '../contexts/DataSyncContext';
import { ConfirmDialog, LoadingOverlay } from './ui';
import { ACTION_DELAY_MS, wait } from '../utils/async';

interface TopbarProps {
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
}

export const Topbar: React.FC<TopbarProps> = ({ setSidebarOpen }) => {
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const dataVersion = useDataVersion('needsRequests', 'products', 'shipments');
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState({ pending: 0, lowStock: 0, issues: 0 });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [needs, items, shipments] = await Promise.allSettled([
          getCollection<NeedRequest>('needsRequests'),
          getCollection<Item>('products'),
          getShipments(currentUser),
        ]);
        if (!active) return;
        setNotifications({
          pending: needs.status === 'fulfilled' ? needs.value.filter(row => row.status === 'Pending').length : 0,
          lowStock: items.status === 'fulfilled' ? items.value.filter(row => row.itemStatus === 'Aktif' && row.currentStock <= row.minStock).length : 0,
          issues: shipments.status === 'fulfilled' ? shipments.value.filter(row => row.status === 'Bermasalah').length : 0,
        });
      } catch {
        if (active) setNotifications({ pending: 0, lowStock: 0, issues: 0 });
      }
    };
    void load();
    return () => { active = false; };
  }, [currentUser, dataVersion]);

  const handleLogout = async () => {
    setConfirmLogout(false);
    setLoggingOut(true);
    try {
      await wait(ACTION_DELAY_MS);
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-14 sm:h-16 px-3 sm:px-6 flex items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          <button
            onClick={() => setSidebarOpen((prev: boolean) => !prev)}
            className="shrink-0 text-slate-600 hover:text-slate-900 focus:outline-hidden lg:hidden p-2 rounded-lg hover:bg-slate-100 transition"
            aria-label="Buka menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-base font-bold text-slate-800 tracking-tight truncate max-w-[58vw] sm:max-w-none">
              Sistem Informasi Logistik Pesantren
            </h2>
            <p className="text-xs text-slate-500 hidden md:block">
              Gudang Utama & Distribusi Dapur Pesantren
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-4 shrink-0">
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
            title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
            aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="hidden sm:block relative">
            <button
              onClick={() => setShowNotifications(previous => !previous)}
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              title="Notifikasi"
            >
              <Bell className="w-5 h-5" />
              {(notifications.pending + notifications.lowStock + notifications.issues) > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notifications.pending + notifications.lowStock + notifications.issues}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-11 z-40 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 space-y-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Notifikasi</p>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-amber-50 text-amber-800 text-sm"><ClipboardList className="w-4 h-4" /><span>{notifications.pending} kebutuhan menunggu persetujuan</span></div>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-red-50 text-red-700 text-sm"><AlertTriangle className="w-4 h-4" /><span>{notifications.lowStock} barang stok menipis</span></div>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-blue-50 text-blue-700 text-sm"><Truck className="w-4 h-4" /><span>{notifications.issues} pengiriman bermasalah</span></div>
              </div>
            )}
          </div>

          {currentUser && (
            <div className="flex items-center space-x-1 sm:space-x-3 sm:pl-3 sm:border-l sm:border-slate-200">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-slate-800">{currentUser.displayName}</p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-ocean-light text-ocean">
                  <Shield className="w-3 h-3 mr-1" />
                  {currentUser.role}
                </span>
              </div>

              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-ocean text-white flex items-center justify-center font-bold shadow-sm text-sm">
                {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : <UserIcon className="w-5 h-5" />}
              </div>

              <button
                onClick={() => setConfirmLogout(true)}
                disabled={loggingOut}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition disabled:opacity-50"
                title="Keluar (Logout)"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </header>
      {confirmLogout && !loggingOut && (
        <ConfirmDialog
          message="Apakah Anda yakin ingin keluar dari sistem?"
          confirmLabel="Ya, Keluar"
          cancelLabel="Tidak"
          onConfirm={() => void handleLogout()}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
      {loggingOut && <LoadingOverlay label="Keluar dari sistem..." />}
    </>
  );
};
