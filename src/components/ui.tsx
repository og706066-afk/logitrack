import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Check } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, icon: Icon, action }) => (
  <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 shrink-0 text-emerald-600" />
        <span className="truncate">{title}</span>
      </h1>
      <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{description}</p>
    </div>
    {action}
  </div>
);

interface AlertBoxProps {
  message: string;
  kind?: 'error' | 'success';
  onClose?: () => void;
}

export const AlertBox: React.FC<AlertBoxProps> = ({ message, kind = 'error', onClose }) => {
  if (!message) return null;
  const isError = kind === 'error';
  return (
    <div className={`p-3.5 sm:p-4 border rounded-xl flex items-center space-x-3 text-xs sm:text-sm ${isError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
      {isError ? <AlertCircle className="w-5 h-5 shrink-0 text-red-500" /> : <Check className="w-5 h-5 shrink-0 text-emerald-600" />}
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className={`ml-auto ${isError ? 'text-red-500' : 'text-emerald-600'}`}>×</button>
      )}
    </div>
  );
};

interface StatusBadgeProps {
  value: string;
}

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Processing: 'bg-blue-50 text-blue-700 border-blue-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-red-50 text-red-600 border-red-200',
  Assigned: 'bg-slate-100 text-slate-700 border-slate-200',
  'On Delivery': 'bg-blue-50 text-blue-700 border-blue-200',
  Delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Aktif: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Nonaktif: 'bg-red-50 text-red-600 border-red-200',
  IN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OUT: 'bg-red-50 text-red-600 border-red-200',
  Menipis: 'bg-red-50 text-red-600 border-red-200',
  Aman: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ value }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[value] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
    {value}
  </span>
);

interface InfoCardProps {
  title: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  color?: string;
}

export const InfoCard: React.FC<InfoCardProps> = ({ title, value, detail, icon: Icon, color = 'bg-emerald-600' }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
    <div className="flex items-center justify-between mb-4">
      <div className={`w-10 h-10 rounded-xl ${color} text-white flex items-center justify-center shadow-sm`}>
        <Icon className="w-5 h-5" />
      </div>
      {detail && <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{detail}</span>}
    </div>
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
    </div>
  </div>
);

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ message, onConfirm, onCancel, confirmLabel = 'Hapus', cancelLabel = 'Batal' }) => (
  <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
    <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl text-center animate-slide-up">
      <p className="text-sm font-semibold text-slate-800 mb-6">{message}</p>
      <div className="flex justify-center space-x-3">
        <button onClick={onCancel} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">{cancelLabel}</button>
        <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700">{confirmLabel}</button>
      </div>
    </div>
  </div>
);

interface LoadingOverlayProps {
  label?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ label = 'Memproses...' }) => (
  <div className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" role="status" aria-live="polite">
    <div className="bg-white rounded-2xl px-8 py-7 shadow-2xl flex flex-col items-center space-y-4 min-w-[220px] max-w-[90vw] animate-slide-up">
      <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
      <p className="text-sm font-semibold text-slate-700 text-center">{label}</p>
      <p className="text-xs text-slate-500 text-center">Mohon tunggu sebentar</p>
    </div>
  </div>
);
