import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, AlertCircle, ArrowRight, UserPlus, Truck, PackageCheck, Warehouse, MapPin, Boxes, ClipboardList, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { LOGIN_DELAY_MS, wait } from '../utils/async';
import { CarLoader } from '../components/ui';

const APP_LOGO = '/Lencana%20Neon%20Silog%20Sistem%20Logistik%20(1).png';

export const Login: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const isRegister = mode === 'register';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await wait(LOGIN_DELAY_MS);
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || (isRegister
        ? 'Gagal membuat akun. Periksa kembali data registrasi Anda.'
        : 'Gagal masuk. Periksa kembali email dan password Anda.'));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(isRegister ? 'login' : 'register');
    setError('');
  };

  return (
    <div className="min-h-screen bg-cloud dark:bg-slate-900 flex relative overflow-hidden">
      <div className="absolute -top-24 right-1/4 w-80 h-80 bg-ocean/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 right-0 w-80 h-80 bg-cyan/10 rounded-full blur-3xl pointer-events-none"></div>

      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-20 p-2 rounded-full border border-slate-200 bg-white/80 text-slate-700 hover:bg-white shadow-sm transition dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 backdrop-blur-sm"
        title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
        aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="hidden lg:flex lg:w-[56%] xl:w-[52%] relative flex-col justify-between overflow-hidden bg-navy px-12 py-12 xl:px-16 animate-fade-in">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-ocean/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -right-16 w-96 h-96 rounded-full bg-cyan/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 p-1.5 flex items-center justify-center shadow-lg backdrop-blur-sm">
            <img src={APP_LOGO} alt="Logo SILOG" className="w-full h-full object-contain rounded-full" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">SILOG PESANTREN</h1>
            <p className="text-xs text-cyan font-medium">Sistem Informasi Logistik v1.0</p>
          </div>
        </div>

        <div className="relative z-10 mt-12 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan">Logistik pesantren, satu kendali</p>
          <h2 className="mt-4 text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight text-white">
            Stok, dapur, dan distribusi <span className="text-cyan">terpantau.</span>
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-slate-300">
            Catat pemasukan, kelola persediaan, dan pantau pengiriman dalam satu sistem yang sederhana.
          </p>
        </div>

        <div className="relative z-10 mt-10 rounded-3xl border border-white/10 bg-white/5 p-5 xl:p-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-200">Arus logistik</span>
            <span className="flex items-center gap-2 text-xs font-medium text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Sinkron
            </span>
          </div>

          <div className="relative mt-6 h-24">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
              <path d="M12 62 H388" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 62 H388" fill="none" stroke="#00C5E8" strokeWidth="2" strokeDasharray="7 9" strokeLinecap="round" className="animate-route-dash" />
            </svg>
            <div className="absolute left-[3%] top-[42%] -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-navy border border-cyan/40 flex items-center justify-center text-cyan shadow-lg">
              <PackageCheck className="w-4 h-4" />
            </div>
            <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-navy border border-cyan/40 flex items-center justify-center text-cyan shadow-lg">
              <Warehouse className="w-4 h-4" />
            </div>
            <div className="absolute right-[3%] top-[42%] translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-navy border border-cyan/40 flex items-center justify-center text-cyan shadow-lg">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="absolute top-[10%] left-[3%] -translate-x-1/2 animate-route-truck w-10 h-10 rounded-xl bg-cyan text-navy flex items-center justify-center shadow-lg shadow-cyan/20">
              <Truck className="w-5 h-5 animate-truck-turn" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-navy/50 p-3 animate-float-slow">
              <Boxes className="w-4 h-4 text-cyan" />
              <p className="mt-2 text-lg font-bold text-white">128</p>
              <p className="text-[11px] text-slate-400">Item stok</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-navy/50 p-3 animate-float-slower">
              <ClipboardList className="w-4 h-4 text-cyan" />
              <p className="mt-2 text-lg font-bold text-white">24</p>
              <p className="text-[11px] text-slate-400">Pesanan aktif</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-navy/50 p-3 animate-float-slow">
              <Truck className="w-4 h-4 text-cyan" />
              <p className="mt-2 text-lg font-bold text-white">12</p>
              <p className="text-[11px] text-slate-400">Dalam pengiriman</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 mt-8 text-xs text-slate-500">Sistem Informasi Logistik & Dapur Pesantren</p>
      </div>

      <div className="relative z-10 flex min-h-screen w-full items-center justify-center px-5 py-10 sm:px-10 lg:w-[44%] xl:w-[48%] lg:px-14 xl:px-20">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <div className="w-14 h-14 rounded-full bg-white border border-slate-200 p-1.5 flex items-center justify-center shadow-lg dark:bg-white/10 dark:border-white/20 backdrop-blur-sm">
              <img src={APP_LOGO} alt="Logo SILOG" className="w-full h-full object-contain rounded-full" />
            </div>
            <h2 className="mt-4 text-2xl font-extrabold text-slate-navy tracking-tight dark:text-white">SILOG PESANTREN</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sistem Informasi Logistik & Dapur Pesantren</p>
          </div>

          <div className="bg-white py-7 sm:py-8 px-5 sm:px-10 shadow-2xl rounded-2xl border border-slate-100">
            {error && (
              <div className="mb-6 p-3.5 sm:p-4 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-3 text-red-700 text-sm animate-fade-in">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
              {isRegister && (
                <div>
                  <label htmlFor="register-name" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <input
                      id="register-name"
                      type="text"
                      autoComplete="name"
                      required
                      disabled={loading}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nama Anda"
                      className="block w-full pl-11 pr-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-ocean focus:bg-white transition disabled:opacity-60"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Email / Akun
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    required
                    disabled={loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@silog.pesantren.id"
                    className="block w-full pl-11 pr-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-ocean focus:bg-white transition disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    required
                    disabled={loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-11 pr-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-ocean focus:bg-white transition disabled:opacity-60"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-2.5 sm:py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-ocean hover:bg-ocean-dark focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-ocean transition disabled:opacity-60 active:scale-[0.99]"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin mr-2" />
                    Memproses...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    {isRegister ? 'Buat Akun Baru' : 'Masuk ke Sistem'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </span>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={switchMode}
                  disabled={loading}
                  className="text-xs sm:text-sm font-semibold text-ocean hover:text-slate-navy hover:underline disabled:opacity-60"
                >
                  {isRegister ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-xs bg-white rounded-3xl shadow-2xl px-7 py-9 flex flex-col items-center animate-slide-up">
            <div className="w-16 h-16 rounded-full bg-ocean-light/60 border border-ocean/20 p-1 flex items-center justify-center animate-pulse-soft">
              <img src={APP_LOGO} alt="Logo SILOG" className="w-full h-full object-contain rounded-full" />
            </div>
            <div className="mt-6 w-full">
              <CarLoader />
            </div>
            <p className="mt-5 text-sm font-bold text-slate-800 text-center">
              {isRegister ? 'Sedang membuat akun...' : 'Sedang masuk ke sistem...'}
            </p>
            <p className="mt-1 text-xs text-slate-500 text-center">
              {isRegister ? 'Menyiapkan profil Anda, mohon tunggu.' : 'Memverifikasi akun Anda, mohon tunggu.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
