import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const fmt = {
  int: (v: number) => Math.round(v).toLocaleString('en-US'),
  min: (v: number, digits = 1) => `${v.toFixed(digits)} min`,
  pct: (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`,
  compact: (v: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v),
};

/** Signed difference with a unit, never printing "-0". */
export function signed(value: number, digits = 1, unit = ''): string {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return `±0${unit}`;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}${unit}`;
}
