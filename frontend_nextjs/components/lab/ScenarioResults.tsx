"use client";

import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Info,
  PlaneTakeoff,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { Badge, Card, CardTitle, Stat, chartTheme } from '@/components/ui';
import type { Kpis, Recommendation, SimulationResult } from '@/lib/simulation/types';
import { cn, fmt, signed } from '@/lib/utils';
import type { EngineSource } from '@/services/api';

type Direction = 'lower' | 'higher' | 'neutral';

const KPI_CARDS: Array<{ key: keyof Kpis; label: string; format: (v: number) => string; delta: (d: number) => string; better: Direction; hint?: (k: Kpis) => string }> = [
  { key: 'passengers', label: 'Passengers', format: fmt.int, delta: (d) => signed(d, 0), better: 'neutral', hint: (k) => `${k.flights} departures` },
  { key: 'p95_security_wait_min', label: 'Security wait · p95', format: (v) => fmt.min(v), delta: (d) => signed(d, 1, ' min'), better: 'lower', hint: (k) => `avg ${fmt.min(k.avg_security_wait_min)}` },
  { key: 'p95_checkin_wait_min', label: 'Check-in wait · p95', format: (v) => fmt.min(v), delta: (d) => signed(d, 1, ' min'), better: 'lower', hint: (k) => `avg ${fmt.min(k.avg_checkin_wait_min)}` },
  { key: 'missed_rate', label: 'Missed flights', format: (v) => fmt.pct(v, 1), delta: (d) => signed(d * 100, 1, ' pts'), better: 'lower', hint: (k) => `${fmt.int(k.missed_passengers)} passengers` },
  { key: 'on_time_departure_rate', label: 'On-time departures', format: (v) => fmt.pct(v), delta: (d) => signed(d * 100, 0, ' pts'), better: 'higher', hint: (k) => `avg delay ${fmt.min(k.avg_departure_delay_min, 0)}` },
  { key: 'avg_satisfaction', label: 'Predicted satisfaction', format: (v) => fmt.pct(v, 1), delta: (d) => signed(d * 100, 1, ' pts'), better: 'higher', hint: () => 'XGBoost, survey-calibrated' },
];

const SEVERITY: Record<Recommendation['severity'], { icon: React.ComponentType<{ className?: string }>; tone: string; label: string }> = {
  critical: { icon: AlertOctagon, tone: 'border-rose-200 bg-rose-50/60 text-rose-700', label: 'Critical' },
  warning: { icon: AlertTriangle, tone: 'border-amber-200 bg-amber-50/60 text-amber-700', label: 'Warning' },
  info: { icon: Info, tone: 'border-sky-200 bg-sky-50/60 text-sky-700', label: 'Insight' },
  ok: { icon: CheckCircle2, tone: 'border-emerald-200 bg-emerald-50/60 text-emerald-700', label: 'Healthy' },
};

function deltaGood(diff: number, better: Direction): boolean | null {
  if (better === 'neutral' || Math.abs(diff) < 1e-6) return null;
  return better === 'lower' ? diff < 0 : diff > 0;
}

function downloadJson(result: SimulationResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scenario-seed-${result.engine.seed}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ScenarioResults({
  result,
  baseline,
  source,
}: {
  result: SimulationResult;
  baseline: SimulationResult | null;
  source: EngineSource;
}) {
  const [showAllFlights, setShowAllFlights] = useState(false);
  const k = result.kpis;
  const isBaseline = useMemo(
    () => !!baseline && JSON.stringify({ ...baseline.scenario, scenario_name: '' }) === JSON.stringify({ ...result.scenario, scenario_name: '' }),
    [baseline, result],
  );

  const queueSeries = useMemo(() => {
    const base = new Map((baseline?.time_series ?? []).map((s) => [s.clock, s.security_queue]));
    return result.time_series.map((s) => ({ ...s, baseline_security: base.get(s.clock) ?? null }));
  }, [result, baseline]);

  const flights = showAllFlights ? result.flights : result.flights.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        {KPI_CARDS.map((card) => {
          const value = k[card.key] as number;
          const diff = baseline ? value - (baseline.kpis[card.key] as number) : 0;
          return (
            <Stat
              key={card.key}
              label={card.label}
              value={card.format(value)}
              hint={card.hint?.(k)}
              delta={baseline && !isBaseline ? card.delta(diff) : undefined}
              deltaGood={deltaGood(diff, card.better)}
            />
          );
        })}
      </div>

      <Card>
        <CardTitle
          icon={ShieldCheck}
          title="Queues through the day"
          subtitle={isBaseline ? 'Passengers waiting, sampled every 5 minutes' : 'Dashed line: baseline security queue (same seed)'}
        />
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={queueSeries} margin={{ left: -18, right: 8, top: 4 }}>
              <defs>
                <linearGradient id="secFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartTheme.brand} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={chartTheme.brand} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="chkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartTheme.orange} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={chartTheme.orange} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} />
              <XAxis dataKey="clock" tick={{ fill: chartTheme.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={32} />
              <YAxis tick={{ fill: chartTheme.axis, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={chartTheme.tooltip} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="security_queue" name="Security queue" stroke={chartTheme.brand} strokeWidth={2.5} fill="url(#secFill)" isAnimationActive={false} />
              <Area type="monotone" dataKey="checkin_queue" name="Check-in queue" stroke={chartTheme.orange} strokeWidth={2} fill="url(#chkFill)" isAnimationActive={false} />
              {!isBaseline && baseline && (
                <Line type="monotone" dataKey="baseline_security" name="Baseline security" stroke={chartTheme.slate} strokeDasharray="5 4" dot={false} strokeWidth={1.5} isAnimationActive={false} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardTitle icon={AlertTriangle} title="Operations advisor" subtitle="Staffing advice from peak demand and service-level targets" />
          <div className="space-y-3">
            {result.recommendations.map((rec, i) => {
              const s = SEVERITY[rec.severity];
              const Icon = s.icon;
              return (
                <div key={i} className={cn('rounded-2xl border p-4', s.tone)}>
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">
                        {rec.title} <span className="ml-1 text-[11px] font-semibold uppercase tracking-wider opacity-70">{s.label}</span>
                      </p>
                      <p className="text-sm text-slate-600">{rec.detail}</p>
                      <p className="text-sm font-medium text-slate-900">→ {rec.action}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardTitle icon={CheckCircle2} title="Service levels" subtitle="Targets an operations team would track" />
          <ul className="divide-y divide-slate-100">
            {result.service_levels.map((sla) => (
              <li key={sla.name} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-2.5">
                  {sla.met ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-rose-500" />}
                  <div>
                    <p className="text-sm font-medium text-slate-800">{sla.name}</p>
                    <p className="text-xs text-slate-500">Target {sla.target}</p>
                  </div>
                </div>
                <span className={cn('text-sm font-bold tabular-nums', sla.met ? 'text-slate-900' : 'text-rose-600')}>
                  {sla.name.includes('wait') ? fmt.min(sla.value) : fmt.pct(sla.value, 1)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ['Check-in', k.checkin_utilization],
              ['Security', k.security_utilization],
              ['Gates', k.gate_utilization],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                <p className="text-lg font-extrabold tabular-nums text-slate-900">{fmt.pct(value as number)}</p>
                <p className="text-[10px] text-slate-400">utilisation</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle icon={Clock3} title="Queue time distribution" subtitle="Passengers by minutes spent queueing" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.wait_distribution} margin={{ left: -18, right: 8, top: 4 }}>
                <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="bucket" tick={{ fill: chartTheme.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: chartTheme.axis, fontSize: 11 }} tickLine={false} axisLine={false} scale="sqrt" allowDecimals={false} />
                <Tooltip contentStyle={chartTheme.tooltip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="security" name="Security" fill={chartTheme.brand} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="checkin" name="Check-in" fill={chartTheme.orange} radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardTitle icon={Users} title="Passengers in the terminal" subtitle="Landside + airside, and waiting at gates" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.time_series} margin={{ left: -18, right: 8, top: 4 }}>
                <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="clock" tick={{ fill: chartTheme.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={32} />
                <YAxis tick={{ fill: chartTheme.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTheme.tooltip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="in_terminal" name="In terminal" stroke={chartTheme.sky} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="at_gate" name="At gates" stroke={chartTheme.emerald} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="stepAfter" dataKey="gates_in_use" name="Gates in use" stroke={chartTheme.slate} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="p-6 md:p-8 pb-0 md:pb-0">
          <CardTitle
            icon={PlaneTakeoff}
            title="Departures board"
            subtitle={`${result.flights.length} flights · ${k.flights_with_missed_passengers} with missed passengers · ${k.gate_conflicts} waited for a gate`}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-2.5">Flight</th>
                <th className="px-3 py-2.5">Sched.</th>
                <th className="px-3 py-2.5">Departed</th>
                <th className="px-3 py-2.5 text-right">Delay</th>
                <th className="px-3 py-2.5 text-right">Pax</th>
                <th className="px-6 py-2.5 text-right">Missed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flights.map((f) => (
                <tr key={f.flight_id + f.scheduled} className="tabular-nums">
                  <td className="px-6 py-2.5 font-semibold text-slate-900">
                    {f.flight_id}
                    {f.international && <Badge tone="blue" className="ml-2">INTL</Badge>}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{f.scheduled}</td>
                  <td className="px-3 py-2.5 text-slate-600">{f.departed}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={cn('font-semibold', f.delay_min > 15 ? 'text-amber-600' : 'text-emerald-600')}>
                      {f.delay_min > 0 ? `+${Math.round(f.delay_min)}m` : 'On time'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{f.passengers}</td>
                  <td className={cn('px-6 py-2.5 text-right font-semibold', f.missed > 0 ? 'text-rose-600' : 'text-slate-300')}>
                    {f.missed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.flights.length > 10 && (
          <button
            type="button"
            onClick={() => setShowAllFlights((v) => !v)}
            className="w-full border-t border-slate-100 py-3 text-sm font-semibold text-brand-700 hover:bg-slate-50"
          >
            {showAllFlights ? 'Show fewer' : `Show all ${result.flights.length} flights`}
          </button>
        )}
      </Card>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white px-5 py-4 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={source === 'api' ? 'green' : 'brand'}>{source === 'api' ? 'FastAPI engine' : 'In-browser engine'}</Badge>
          <Badge>delay: {result.engine.delay_model}</Badge>
          <Badge>satisfaction: {result.engine.satisfaction_model}</Badge>
          <Badge>demand: {result.engine.demand_model} ×{result.engine.demand_multiplier.toFixed(2)}</Badge>
          <span>
            seed {result.engine.seed} · {result.engine.runtime_ms.toFixed(0)} ms · engine v{result.engine.version}
          </span>
        </div>
        <button type="button" className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-brand-700" onClick={() => downloadJson(result)}>
          <Download className="h-4 w-4" /> Download JSON
        </button>
      </div>
    </div>
  );
}
