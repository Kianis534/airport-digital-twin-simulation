"use client";

import React from 'react';
import { Activity, Clock, Gauge, Smile, Users } from 'lucide-react';
import { useSimulation } from '@/context/SimulationContext';
import { Card, CardTitle, Stat } from '@/components/ui';
import { cn } from '@/lib/utils';

export default function SimulationDashboard() {
  const { metrics, congestion } = useSimulation();
  const load = congestion.reduce((sum, node) => sum + node.value, 0) / congestion.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">
            <Activity className="h-3.5 w-3.5" /> Live view
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Terminal right now</h2>
        </div>
        <p className="text-sm text-slate-500">Updates every 2 seconds · last update {metrics.timestamp || '—'}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Passengers in view" value={metrics.activePassengers} hint="agents in the 3D terminal" />
        <Stat label="Estimated queue time" value={`${metrics.queueMinutes.toFixed(1)} min`} hint="check-in + security" />
        <Stat label="Predicted satisfaction" value={`${metrics.satisfaction.toFixed(1)}%`} hint="XGBoost response curve" />
        <Stat label="Stage transitions" value={`${metrics.throughputPerMin.toFixed(0)}/min`} hint="passengers moving on" />
      </div>

      <Card>
        <CardTitle
          icon={Gauge}
          title="Stage load"
          subtitle={`Crowding relative to what each stage absorbs comfortably · average ${Math.round(load)}%`}
        />
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {congestion.map((node, i) => {
            const Icon = [Users, Clock, Smile, Activity][i];
            const tone = node.value > 75 ? 'bg-rose-500' : node.value > 40 ? 'bg-amber-400' : 'bg-emerald-500';
            return (
              <div key={node.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Icon className="h-4 w-4 text-slate-400" /> {node.label}
                  </span>
                  <span className={cn('text-sm font-bold tabular-nums', node.value > 75 ? 'text-rose-600' : 'text-slate-900')}>
                    {node.value}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={cn('h-full rounded-full transition-all duration-700', tone)} style={{ width: `${node.value}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
