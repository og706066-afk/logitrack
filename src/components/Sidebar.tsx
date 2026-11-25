import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Tags, 
  Truck, 
  ArrowDown, 
  ArrowUp, 
  Warehouse, 
  ClipboardList, 
  Send, 
  UsersRound, 
  BarChart3, 
  UserCheck, 
  ShieldCheck, 
  Settings, 
  ScrollText,
  Boxes
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { currentUser, hasPermission } = useAuth();

  const menuItems = [
    { title: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'dashboard.view' },
    { title: 'Bahan Makanan', path: '/products', icon: Package, permission: 'products.view' },
    { title: 'Kategori', path: '/categories', icon: Tags, permission: 'categories.view' },
    { title: 'Supplier', path: '/suppliers', icon: Truck, permission: 'suppliers.view' },
    { title: 'Barang Masuk', path: '/stock-in', icon: ArrowDown, permission: 'stock_in.view' },
    { title: 'Barang Keluar', path: '/stock-out', icon: ArrowUp, permission: 'stock_out.view' },
    { title: 'Stok Gudang', path: '/warehouse-stock', icon: Warehouse, permission: 'stock_batches.view' },
    { title: 'Permintaan Dapur', path: '/kitchen-requests', icon: ClipboardList, permission: 'requests.view' },
    { title: 'Pengiriman', path: '/deliveries', icon: Send, permission: 'deliveries.view' },
    { title: 'Data Driver', path: '/drivers', icon: UserCheck, permission: 'vehicles.view' },
    { title: 'Laporan', path: '/reports', icon: BarChart3, permission: 'reports.view' },
    { title: 'Manajemen Pengguna', path: '/users', icon: UsersRound, permission: 'users.view' },
    { title: 'Manajemen Role', path: '/roles', icon: ShieldCheck, permission: 'roles.view' },
    { title: 'Pengaturan Sistem', path: '/settings', icon: Settings, permission: 'users.view' },
    { title: 'Audit Log', path: '/audit-logs', icon: ScrollText, permission: 'users.view' },
  ];

  // Filter items based on permission
  const filteredMenu = menuItems.filter(item => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-xs"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-72 max-w-[85vw] bg-emerald-950 text-slate-100 flex flex-col transition-transform duration-300 ease-in-out shadow-xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand header */}
        <div className="p-4 sm:p-6 border-b border-emerald-900/80 flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">SILOG PESANTREN</h1>
            <p className="text-xs text-emerald-300 font-medium truncate">Sistem Informasi Logistik v1.0</p>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 space-y-1 custom-scrollbar">
          {filteredMenu.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) => `
                  flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-medium text-sm transition-all
                  ${isActive 
                    ? 'bg-emerald-800 text-white shadow-sm font-semibold' 
                    : 'text-emerald-200/80 hover:bg-emerald-900/60 hover:text-white'}
                `}
              >
                <Icon className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="truncate">{item.title}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Role Badge Footer */}
        {currentUser && (
          <div className="p-3 sm:p-4 m-3 sm:m-4 bg-emerald-900/60 rounded-xl border border-emerald-800/60">
            <p className="text-xs text-emerald-300 uppercase tracking-wider font-semibold mb-1">Role Anda</p>
            <p className="text-sm font-bold text-white truncate">{currentUser.role}</p>
            <p className="text-xs text-emerald-200/70 truncate mt-0.5">{currentUser.email}</p>
          </div>
        )}
      </aside>
    </>
  );
};
