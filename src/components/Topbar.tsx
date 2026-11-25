import React, { useState } from 'react';
import { Menu, Bell, LogOut, User as UserIcon, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LoadingOverlay } from './ui';
import { ACTION_DELAY_MS, wait } from '../utils/async';

interface TopbarProps {
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
}

export const Topbar: React.FC<TopbarProps> = ({ setSidebarOpen }) => {
  const { currentUser, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
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
            className="hidden sm:block relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
            title="Notifikasi"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-600 rounded-full"></span>
          </button>

          {currentUser && (
            <div className="flex items-center space-x-1 sm:space-x-3 sm:pl-3 sm:border-l sm:border-slate-200">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-slate-800">{currentUser.displayName}</p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                  <Shield className="w-3 h-3 mr-1" />
                  {currentUser.role}
                </span>
              </div>

              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shadow-sm text-sm">
                {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : <UserIcon className="w-5 h-5" />}
              </div>

              <button
                onClick={() => void handleLogout()}
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
      {loggingOut && <LoadingOverlay label="Keluar dari sistem..." />}
    </>
  );
};
