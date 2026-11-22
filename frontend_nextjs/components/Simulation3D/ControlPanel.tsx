"use client";

import React, { useState } from 'react';
import { Loader2, Moon, RotateCcw, Sliders, Sun, Zap } from 'lucide-react';
import { DEFAULT_PARAMS, useSimulation, type SimulationParams } from '@/context/SimulationContext';
import { cn } from '@/lib/utils';

const SLIDERS: Array<{ key: keyof SimulationParams; label: string; min: number; max: number; step: number; format: (v: number) => string }> = [
  { key: 'increase_flights_percent', label: 'Passenger load', min: 0, max: 100, step: 5, format: (v) => `+${v}%` },
  { key: 'checkin_counters', label: 'Check-in counters', min: 2, max: 20, step: 1, format: (v) => `${v}` },
  { key: 'security_counters', label: 'Security lanes', min: 1, max: 12, step: 1, format: (v) => `${v}` },
  { key: 'weather_severity', label: 'Weather', min: 0, max: 100, step: 10, format: (v) => (v > 70 ? `Storm (${v})` : v > 30 ? `Cloudy (${v})` : `Clear (${v})`) },
  { key: 'delay_offset_minutes', label: 'Flight delay', min: 0, max: 120, step: 5, format: (v) => `${v} min` },
];

export default function ControlPanel() {
  const { runScenario, resetEnvironment, isResetting, simParams } = useSimulation();
  const [local, setLocal] = useState<SimulationParams>(simParams);
  const night = local.time_of_day < 6 || local.time_of_day > 18;
  const update = <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => setLocal((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Sliders className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold tracking-tight text-slate-900">Live controls</h3>
          <p className="text-xs text-slate-500">Applied to the 3D terminal</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Day', icon: Sun, hour: 12, active: !night },
          { label: 'Night', icon: Moon, hour: 0, active: night },
        ].map((mode) => (
          <button
            key={mode.label}
            type="button"
            onClick={() => update('time_of_day', mode.hour)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition-colors',
              mode.active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300',
            )}
          >
            <mode.icon className="h-3.5 w-3.5" /> {mode.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {SLIDERS.map((s) => (
          <label key={s.key} className="block space-y-2">
            <span className="flex justify-between text-sm">
              <span className="font-medium text-slate-700">{s.label}</span>
              <span className="font-semibold tabular-nums text-brand-700">{s.format(local[s.key] as number)}</span>
            </span>
            <input
              type="range"
              className="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={local[s.key] as number}
              onChange={(e) => update(s.key, Number(e.target.value) as never)}
              aria-label={s.label}
            />
          </label>
        ))}
        <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {(['standard', 'advanced'] as const).map((tech) => (
            <button
              key={tech}
              type="button"
              onClick={() => update('security_tech_level', tech)}
              className={cn('rounded-lg py-1.5 text-xs font-semibold', local.security_tech_level === tech ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
            >
              {tech === 'advanced' ? 'CT scanners' : 'Standard screening'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <button type="button" className="btn-dark" onClick={() => runScenario(local)} disabled={isResetting}>
          {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Apply
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setLocal(DEFAULT_PARAMS);
            resetEnvironment();
          }}
          disabled={isResetting}
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
      </div>
    </div>
  );
}
