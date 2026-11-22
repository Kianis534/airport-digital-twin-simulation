"use client";

import React from 'react';
import { Dices, Loader2, Play, RotateCcw } from 'lucide-react';
import { artifacts } from '@/lib/artifacts';
import type { ScenarioConfig } from '@/lib/simulation/types';
import { cn } from '@/lib/utils';

export type Levers = Pick<
  ScenarioConfig,
  | 'traffic_increase_pct'
  | 'checkin_counters'
  | 'security_lanes'
  | 'boarding_gates'
  | 'weather_severity'
  | 'delay_offset_min'
  | 'security_tech'
  | 'forecast_month'
  | 'seed'
>;

const d = artifacts.defaults;
export const BASELINE_LEVERS: Levers = {
  traffic_increase_pct: d.traffic_increase_pct,
  checkin_counters: d.checkin_counters,
  security_lanes: d.security_lanes,
  boarding_gates: d.boarding_gates,
  weather_severity: d.weather_severity,
  delay_offset_min: d.delay_offset_min,
  security_tech: d.security_tech,
  forecast_month: null,
  seed: 42,
};

export const presetSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const PRESETS: Array<{ name: string; description: string; levers: Partial<Levers> }> = [
  { name: 'Baseline', description: 'A normal weekday', levers: {} },
  { name: 'Lane closure', description: '2 security lanes down', levers: { security_lanes: d.security_lanes - 2 } },
  { name: 'Summer peak', description: 'July demand from the LSTM, +15% flights', levers: { forecast_month: 7, traffic_increase_pct: 15 } },
  { name: 'Peak surge', description: 'July demand from the LSTM, +60% departures', levers: { forecast_month: 7, traffic_increase_pct: 60 } },
  { name: 'Storm day', description: 'Severe weather and knock-on delays', levers: { weather_severity: 85, delay_offset_min: 15 } },
  { name: 'Gate works', description: 'Half the gates closed for works', levers: { boarding_gates: Math.max(2, Math.round(d.boarding_gates / 2)) } },
  { name: 'CT scanners', description: 'Fewer lanes, faster screening', levers: { security_lanes: d.security_lanes - 2, security_tech: 'advanced' } },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface SliderSpec {
  key: keyof Levers;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const SLIDERS: SliderSpec[] = [
  { key: 'traffic_increase_pct', label: 'Flight traffic', min: -40, max: 120, step: 5, format: (v) => `${v > 0 ? '+' : ''}${v}%` },
  { key: 'security_lanes', label: 'Security lanes', min: 1, max: 15, step: 1, format: (v) => `${v}` },
  { key: 'checkin_counters', label: 'Check-in counters', min: 2, max: 30, step: 1, format: (v) => `${v}` },
  { key: 'boarding_gates', label: 'Boarding gates', min: 2, max: 20, step: 1, format: (v) => `${v}` },
  { key: 'weather_severity', label: 'Weather severity', min: 0, max: 100, step: 5, format: (v) => (v >= 70 ? `Storm · ${v}` : v >= 30 ? `Unsettled · ${v}` : `Clear · ${v}`) },
  { key: 'delay_offset_min', label: 'Extra delay per flight', min: 0, max: 90, step: 5, format: (v) => `${v} min` },
];

export default function ScenarioControls({
  levers,
  onChange,
  onRun,
  onReset,
  running,
  activePreset,
  onPreset,
}: {
  levers: Levers;
  onChange: (next: Levers) => void;
  onRun: () => void;
  onReset: () => void;
  running: boolean;
  activePreset: string | null;
  onPreset: (name: string) => void;
}) {
  const set = <K extends keyof Levers>(key: K, value: Levers[K]) => onChange({ ...levers, [key]: value });

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Presets</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              title={preset.description}
              onClick={() => onPreset(preset.name)}
              className={cn(
                'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors',
                activePreset === preset.name
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700',
              )}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        {SLIDERS.map((s) => {
          const value = levers[s.key] as number;
          const changed = value !== BASELINE_LEVERS[s.key];
          return (
            <label key={s.key} className="block space-y-2">
              <span className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-700">{s.label}</span>
                <span className={cn('font-semibold tabular-nums', changed ? 'text-brand-700' : 'text-slate-900')}>
                  {s.format(value)}
                </span>
              </span>
              <input
                type="range"
                className="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={value}
                onChange={(e) => set(s.key, Number(e.target.value) as never)}
                aria-label={s.label}
              />
            </label>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Screening</span>
          <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(['standard', 'advanced'] as const).map((tech) => (
              <button
                key={tech}
                type="button"
                onClick={() => set('security_tech', tech)}
                className={cn(
                  'rounded-lg py-1.5 text-xs font-semibold capitalize transition-colors',
                  levers.security_tech === tech ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                )}
              >
                {tech === 'advanced' ? 'CT scan' : 'Standard'}
              </button>
            ))}
          </div>
        </div>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Season (LSTM)</span>
          <select
            value={levers.forecast_month ?? ''}
            onChange={(e) => set('forecast_month', e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            <option value="">Average</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-end gap-3">
        <label className="flex-1 space-y-2">
          <span className="text-sm font-medium text-slate-700">Random seed</span>
          <input
            type="number"
            min={0}
            value={levers.seed ?? 0}
            onChange={(e) => set('seed', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium tabular-nums text-slate-700"
          />
        </label>
        <button
          type="button"
          className="btn-ghost !px-3 !py-2"
          onClick={() => set('seed', Math.floor(Math.random() * 100000))}
          title="New random day"
          aria-label="Randomise seed"
        >
          <Dices className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3 pt-1">
        <button type="button" className="btn-primary" onClick={onRun} disabled={running}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
          {running ? 'Simulating…' : 'Run scenario'}
        </button>
        <button type="button" className="btn-ghost" onClick={onReset} disabled={running} aria-label="Reset to baseline">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
