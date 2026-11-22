import React from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({
  eyebrow,
  title,
  accent,
  children,
  align = 'center',
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  children?: React.ReactNode;
  align?: 'center' | 'left';
}) {
  return (
    <header className={cn('space-y-5', align === 'center' ? 'text-center mx-auto max-w-3xl' : 'max-w-3xl')}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.05]">
        {title} {accent && <span className="text-brand-600">{accent}</span>}
      </h1>
      {children && <p className="text-slate-600 text-lg leading-relaxed">{children}</p>}
    </header>
  );
}

export function Eyebrow({ children, tone = 'brand' }: { children: React.ReactNode; tone?: 'brand' | 'dark' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]',
        tone === 'brand' ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100' : 'bg-white/10 text-brand-200 ring-1 ring-white/15',
      )}
    >
      {children}
    </span>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-3xl border border-slate-200/70 bg-white p-6 md:p-8 shadow-sm', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  delta,
  deltaGood,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  delta?: string;
  deltaGood?: boolean | null;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-slate-200/70 bg-white p-4 md:p-5', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="whitespace-nowrap text-2xl font-extrabold tracking-tight text-slate-900 tabular-nums">{value}</span>
        {delta && (
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
              deltaGood === null || deltaGood === undefined
                ? 'bg-slate-100 text-slate-500'
                : deltaGood
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700',
            )}
          >
            {delta}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Badge({
  children,
  tone = 'slate',
  className,
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'brand' | 'green' | 'amber' | 'red' | 'blue';
  className?: string;
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    brand: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-rose-50 text-rose-700',
    blue: 'bg-sky-50 text-sky-700',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold', tones[tone], className)}>
      {children}
    </span>
  );
}

export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 4.97 3.22 9.18 7.69 10.67.56.1.77-.24.77-.54v-1.9c-3.13.68-3.79-1.51-3.79-1.51-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.16a10.8 10.8 0 0 1 5.64 0c2.15-1.46 3.1-1.16 3.1-1.16.61 1.55.23 2.7.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.33-2.64 5.28-5.15 5.56.4.35.76 1.03.76 2.08v3.08c0 .3.2.65.78.54a11.26 11.26 0 0 0 7.68-10.67C23.25 5.48 18.27.5 12 .5Z" />
    </svg>
  );
}

export const chartTheme = {
  grid: '#eef2f7',
  axis: '#94a3b8',
  brand: '#7c3aed',
  sky: '#0ea5e9',
  orange: '#f97316',
  emerald: '#10b981',
  rose: '#f43f5e',
  slate: '#64748b',
  tooltip: {
    borderRadius: 14,
    border: '1px solid #e2e8f0',
    boxShadow: '0 12px 24px -12px rgb(15 23 42 / 0.25)',
    padding: '10px 12px',
    fontSize: 12,
  } as React.CSSProperties,
};
