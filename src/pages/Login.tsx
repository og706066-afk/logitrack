import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, AlertCircle, ArrowRight, UserPlus } from 'lucide-react';
import { LOGIN_DELAY_MS, wait } from '../utils/async';

const APP_LOGO = '/Lencana%20Neon%20Silog%20Sistem%20Logistik%20(1).png';

export const Login: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
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
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute -top-20 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-ocean/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-ocean-dark/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-slide-up">
        <div className="flex justify-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
            <img src={APP_LOGO} alt="Logo SILOG" className="w-full h-full object-contain" />
          </div>
        </div>
        <h2 className="mt-5 sm:mt-6 text-center text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          SILOG PESANTREN
        </h2>
        <p className="mt-2 text-center text-xs sm:text-sm text-slate-400 px-2">
          Sistem Informasi Logistik & Dapur Pesantren
        </p>
      </div>

      <div className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-slide-up">
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

      {loading && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-xs bg-white rounded-3xl shadow-2xl px-7 py-9 flex flex-col items-center animate-slide-up">
            <div className="w-16 h-16 flex items-center justify-center animate-pulse-soft">
              <img src={APP_LOGO} alt="Logo SILOG" className="w-full h-full object-contain" />
            </div>
            <div className="mt-6 w-11 h-11 border-4 border-ocean-light border-t-ocean rounded-full animate-spin" />
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
