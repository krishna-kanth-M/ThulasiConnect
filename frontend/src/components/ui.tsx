import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { clsx } from 'clsx';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#3F72AF]/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
  const variants = {
    primary: 'bg-[#3F72AF] text-white hover:bg-[#325d91]',
    secondary: 'bg-[#DBE2EF] text-[#112D4E] hover:bg-[#c8d4e8]',
    outline: 'border border-[#DBE2EF] bg-white text-[#112D4E] hover:bg-[#F9F7F7]',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    ghost: 'text-[#112D4E] hover:bg-[#DBE2EF]/50',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  };
  return <button className={clsx(base, variants[variant], sizes[size], className)} {...props} />;
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('rounded-xl border border-[#DBE2EF] bg-white shadow-xs', className)}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'blue' | 'navy' | 'green' | 'amber' | 'red';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-[#F9F7F7] text-[#112D4E] border border-[#DBE2EF]',
    blue: 'bg-[#DBE2EF] text-[#112D4E]',
    navy: 'bg-[#112D4E] text-white',
    green: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border border-amber-200',
    red: 'bg-rose-50 text-rose-800 border border-rose-200',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sublabel,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'accent' | 'warning' | 'danger';
}) {
  const borderAccent = {
    default: 'border-[#DBE2EF]',
    accent: 'border-l-4 border-l-[#3F72AF] border-[#DBE2EF]',
    warning: 'border-l-4 border-l-amber-500 border-[#DBE2EF]',
    danger: 'border-l-4 border-l-rose-600 border-[#DBE2EF]',
  }[tone];
  return (
    <div className={clsx('rounded-xl border bg-white p-4 shadow-xs', borderAccent)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#112D4E]/65">{label}</span>
        {icon && <div className="text-[#3F72AF]">{icon}</div>}
      </div>
      <div className="mt-2 text-2xl font-bold text-[#112D4E]">{value}</div>
      {sublabel && <div className="mt-1 text-xs text-[#112D4E]/65">{sublabel}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#112D4E]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[#112D4E]/70">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function LoadingState({ message = 'Loading operational data...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-[#DBE2EF] bg-white p-10 text-sm text-[#112D4E]/75">
      <Loader2 className="h-5 w-5 animate-spin text-[#3F72AF]" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#DBE2EF] bg-white px-6 py-10 text-center">
      <h3 className="text-sm font-semibold text-[#112D4E]">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-[#112D4E]/70">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  maxWidth = 'max-w-xl',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#112D4E]/50 p-4">
      <div className={clsx('w-full rounded-xl border border-[#DBE2EF] bg-white shadow-xl', maxWidth)}>
        <div className="flex items-center justify-between border-b border-[#DBE2EF] px-5 py-3.5">
          <h2 className="text-base font-semibold text-[#112D4E]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1 text-[#112D4E]/60 hover:bg-[#F9F7F7] hover:text-[#112D4E] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

interface ToastItem {
  id: number;
  tone: 'success' | 'error' | 'info';
  message: string;
}

const ToastContext = createContext<{ notify: (message: string, tone?: 'success' | 'error' | 'info') => void } | null>(
  null,
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((message: string, tone: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg',
              t.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
              t.tone === 'error' && 'border-rose-200 bg-rose-50 text-rose-900',
              t.tone === 'info' && 'border-[#DBE2EF] bg-white text-[#112D4E]',
            )}
          >
            {t.tone === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            {t.tone === 'error' && <AlertCircle className="h-4 w-4 text-rose-600" />}
            {t.tone === 'info' && <Info className="h-4 w-4 text-[#3F72AF]" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

export const inputClass =
  'w-full rounded-lg border border-[#DBE2EF] bg-white px-3 py-2 text-sm text-[#112D4E] placeholder:text-[#112D4E]/45 focus:border-[#3F72AF] focus:outline-none focus:ring-2 focus:ring-[#3F72AF]/20';
