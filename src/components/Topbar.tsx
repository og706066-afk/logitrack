import React from 'react';
import { Menu, Bell, LogOut, User as UserIcon, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TopbarProps {
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
}

export const Topbar: React.FC<TopbarProps> = ({ setSidebarOpen }) => {
  const { currentUser, logout, isDemoMode } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-16 px-6 flex items-center justify-between shadow-xs">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => setSidebarOpen((prev: boolean) => !prev)}
          className="text-slate-600 hover:text-slate-900 focus:outline-hidden lg:hidden p-2 rounded-lg hover:bg-slate-100 transition"
          aria-label="Toggle Menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-base font-bold text-slate-800 tracking-tight">
            Sistem Informasi Logistik Pesantren
          </h2>
          <p className="text-xs text-slate-500 hidden sm:block">
            Gudang Utama & Distribusi Dapur Pesantren
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Demo Mode Badge */}
        {isDemoMode && (
          <span className="hidden md:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Demo Mode Active
          </span>
        )}

        {/* Notifications */}
        <button 
          className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
          title="Notifikasi"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-600 rounded-full"></span>
        </button>

        {/* User Profile & Logout */}
        {currentUser && (
          <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-slate-800">{currentUser.displayName}</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                <Shield className="w-3 h-3 mr-1" />
                {currentUser.role}
              </span>
            </div>
            
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shadow-sm">
              {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : <UserIcon className="w-5 h-5" />}
            </div>

            <button
              onClick={() => logout()}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
              title="Keluar (Logout)"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
