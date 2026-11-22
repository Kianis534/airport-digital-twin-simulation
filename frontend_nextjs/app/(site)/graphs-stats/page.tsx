"use client";

import React from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Activity, BarChart3, Gauge, Pause, Play, Smile, Timer, TrendingUp, Users } from 'lucide-react';
import { Card, CardTitle, PageHeader, chartTheme } from '@/components/ui';
import { useSimulation } from '@/context/SimulationContext';

function ChartCard({
  icon,
  title,
  subtitle,
  note,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  note: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardTitle icon={icon} title={title} subtitle={subtitle} />
      <div className="h-64">{children}</div>
      <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-500">{note}</p>
    </Card>
  );
}

const axis = { tick: { fill: chartTheme.axis, fontSize: 11 }, tickLine: false, axisLine: false } as const;

export default function LiveAnalyticsPage() {
  const { history, metrics, isPlaying, setIsPlaying } = useSimulation();
  const latest = history[history.length - 1];

  return (
    <div className="space-y-10">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <PageHeader eyebrow="Live analytics" title="The live view," accent="charted." align="left">
          Seven charts that follow the 3D terminal as it runs (last 30 updates, one every 2 seconds). Change the controls
          on the 3D Twin page and watch these react.
        </PageHeader>
        <div className="flex shrink-0 items-center gap-3">
          <button type="button" className="btn-ghost" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isPlaying ? 'Pause' : 'Resume'}
          </button>
          <Link href="/simulation" className="btn-dark">
            Open 3D Twin
          </Link>
        </div>
      </div>

      {history.length < 2 && (
        <Card className="text-center text-sm text-slate-500">Collecting data from the live view… charts fill in after a few seconds.</Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          icon={Smile}
          title="Predicted satisfaction"
          subtitle="Share of satisfied passengers"
          note="From the response curve exported from the XGBoost classifier: queueing time sets the process rating, delay offset and weather set the departure delay."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ left: -16, right: 8 }}>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} />
              <XAxis dataKey="timestamp" hide />
              <YAxis {...axis} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={chartTheme.tooltip} />
              <Line type="monotone" dataKey="satisfaction" name="Satisfaction %" stroke={chartTheme.emerald} strokeWidth={3} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          icon={Users}
          title="Passengers vs. reference load"
          subtitle="Agents in the terminal"
          note="The reference line is a nominal 60 agents scaled by the passenger-load slider. Running well above it means queues are holding passengers in the terminal."
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ left: -16, right: 8 }}>
              <defs>
                <linearGradient id="paxFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartTheme.brand} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={chartTheme.brand} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} />
              <XAxis dataKey="timestamp" hide />
              <YAxis {...axis} />
              <Tooltip contentStyle={chartTheme.tooltip} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="activePassengers" name="Passengers" stroke={chartTheme.brand} fill="url(#paxFill)" strokeWidth={2.5} isAnimationActive={false} />
              <Area type="monotone" dataKey="targetLoad" name="Reference load" stroke={chartTheme.axis} fill="transparent" strokeDasharray="5 5" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          icon={BarChart3}
          title="Where passengers are"
          subtitle="Check-in, security and boarding (last 10 updates)"
          note="Stacked counts per stage. A growing security band is the earliest sign of a bottleneck."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={history.slice(-10)} margin={{ left: -16, right: 8 }}>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} />
              <XAxis dataKey="timestamp" hide />
              <YAxis {...axis} allowDecimals={false} />
              <Tooltip contentStyle={chartTheme.tooltip} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="checkInQueue" name="Check-in" stackId="a" fill={chartTheme.orange} isAnimationActive={false} />
              <Bar dataKey="securityQueue" name="Security" stackId="a" fill={chartTheme.brand} isAnimationActive={false} />
              <Bar dataKey="boardingQueue" name="Boarding" stackId="a" fill={chartTheme.emerald} radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          icon={Timer}
          title="Time in current stage"
          subtitle="Latest update, seconds of animation time"
          note="How long agents have been in their current stage. Red bars are passengers stuck for 10 seconds or more."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={latest?.waitTimes ?? []} layout="vertical" margin={{ left: 0, right: 8 }}>
              <CartesianGrid stroke={chartTheme.grid} horizontal={false} />
              <XAxis type="number" {...axis} allowDecimals={false} />
              <YAxis type="category" dataKey="range" {...axis} width={48} />
              <Tooltip contentStyle={chartTheme.tooltip} />
              <Bar dataKey="count" name="Passengers" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                {(latest?.waitTimes ?? []).map((_, i) => (
                  <Cell key={i} fill={i === 3 ? chartTheme.rose : chartTheme.sky} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          icon={TrendingUp}
          title="Crowd change"
          subtitle="Percent change between updates"
          note="Spikes mark bursts of arrivals or a boarding wave emptying the lounge."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ left: -16, right: 8 }}>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} />
              <XAxis dataKey="timestamp" hide />
              <YAxis {...axis} unit="%" />
              <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => (typeof v === 'number' ? `${v.toFixed(1)}%` : v)} />
              <Line type="step" dataKey="inflowChange" name="Change" stroke={chartTheme.orange} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <CardTitle icon={Gauge} title="Flow right now" subtitle="Passengers moving between stages" />
          <div className="flex h-64 flex-col items-center justify-center gap-4">
            <p className="text-6xl font-extrabold tabular-nums tracking-tight text-slate-900">
              {metrics.throughputPerMin.toFixed(0)}
              <span className="ml-2 text-xl font-semibold text-slate-400">/min</span>
            </p>
            <div className="h-3 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600 transition-all duration-700" style={{ width: `${Math.min(100, metrics.throughputPerMin)}%` }} />
            </div>
            <p className="text-sm text-slate-500">Estimated queue time {metrics.queueMinutes.toFixed(1)} min</p>
          </div>
          <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-500">
            Stage transitions per minute of wall-clock time: the heartbeat of the animation.
          </p>
        </Card>

        <ChartCard
          className="lg:col-span-2"
          icon={Activity}
          title="Queue time vs. delay"
          subtitle="Each point is one update; colour shows predicted satisfaction"
          note="Delay (x) comes from the delay slider plus weather; queue time (y) from crowding. Satisfaction falls mostly with queueing; delay matters less in the survey data, which this makes visible."
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ left: -8, right: 16, top: 8 }}>
              <CartesianGrid stroke={chartTheme.grid} />
              <XAxis type="number" dataKey="delayOffset" name="Delay" unit=" min" {...axis} />
              <YAxis type="number" dataKey="queueMinutes" name="Queue time" unit=" min" {...axis} />
              <ZAxis type="number" dataKey="satisfaction" range={[40, 160]} name="Satisfaction" />
              <Tooltip contentStyle={chartTheme.tooltip} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={history} isAnimationActive={false}>
                {history.map((p, i) => (
                  <Cell key={i} fill={p.satisfaction >= 50 ? chartTheme.emerald : p.satisfaction >= 45 ? chartTheme.orange : chartTheme.rose} fillOpacity={0.6} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
