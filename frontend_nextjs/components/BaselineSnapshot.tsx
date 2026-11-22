"use client";

import React, { useEffect, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { runSimulation } from '@/lib/simulation/engine';
import type { SimulationResult } from '@/lib/simulation/types';
import { chartTheme } from '@/components/ui';
import { fmt } from '@/lib/utils';

/** Runs the real engine once in the visitor's browser and shows the result. */
export default function BaselineSnapshot() {
  const [result, setResult] = useState<SimulationResult | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setResult(runSimulation({ seed: 42, security_lanes: 5 })), 50);
    return () => window.clearTimeout(id);
  }, []);

  const k = result?.kpis;
  const stats = k
    ? [
        ['Passengers', fmt.int(k.passengers)],
        ['Security p95', fmt.min(k.p95_security_wait_min)],
        ['Missed flights', fmt.pct(k.missed_rate, 1)],
        ['Satisfaction', fmt.pct(k.avg_satisfaction, 1)],
      ]
    : [];

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-brand-200">Simulated in your browser</span>
        <span className="text-slate-400">{result ? `${result.engine.runtime_ms.toFixed(0)} ms` : 'running…'}</span>
      </div>
      <p className="mt-1 text-sm text-slate-300">A full day with 5 security lanes: security queue length over time.</p>
      <div className="mt-3 h-28">
        {result && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={result.time_series}>
              <defs>
                <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="clock" hide />
              <Tooltip contentStyle={chartTheme.tooltip} labelStyle={{ color: '#0f172a' }} />
              <Area type="monotone" dataKey="security_queue" name="Security queue" stroke="#c4b5fd" strokeWidth={2} fill="url(#heroFill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {(stats.length ? stats : [['', ''], ['', ''], ['', ''], ['', '']]).map(([label, value], i) => (
          <div key={i} className="rounded-xl bg-white/[0.06] px-2 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">{label || '·'}</p>
            <p className="text-sm font-bold tabular-nums text-white">{value || '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
