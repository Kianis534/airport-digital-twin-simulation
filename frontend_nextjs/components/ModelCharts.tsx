"use client";

import React from 'react';
import {
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
import { chartTheme } from '@/components/ui';
import { artifacts } from '@/lib/artifacts';

export function FeatureImportanceChart() {
  const data = artifacts.models.satisfaction.feature_importance
    .slice(0, 10)
    .map((f) => ({ name: f.feature.replace(/_/g, ' '), value: Number((f.importance * 100).toFixed(1)) }));
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 40, right: 16 }}>
          <CartesianGrid stroke={chartTheme.grid} horizontal={false} />
          <XAxis type="number" tick={{ fill: chartTheme.axis, fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
          <YAxis type="category" dataKey="name" width={150} tick={{ fill: '#334155', fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => [`${v}%`, 'Gain share']} />
          <Bar dataKey="value" fill={chartTheme.brand} radius={[0, 6, 6, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrafficForecastChart() {
  const { history, backtest, forecast } = artifacts.traffic;
  const back = new Map(backtest.map((b) => [b.month, b]));
  const rows = [
    ...history.slice(-60).map((h) => ({
      month: h.month,
      actual: h.passengers / 1e6,
      lstm: back.has(h.month) ? back.get(h.month)!.lstm / 1e6 : null,
      naive: back.has(h.month) ? back.get(h.month)!.seasonal_naive / 1e6 : null,
      forecast: null as number | null,
    })),
    ...forecast.map((f) => ({ month: f.month, actual: null, lstm: null, naive: null, forecast: f.passengers / 1e6 })),
  ];
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ left: -12, right: 12, top: 4 }}>
          <CartesianGrid stroke={chartTheme.grid} vertical={false} />
          <XAxis dataKey="month" tick={{ fill: chartTheme.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={40} />
          <YAxis tick={{ fill: chartTheme.axis, fontSize: 11 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} unit="M" />
          <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => (typeof v === 'number' ? `${v.toFixed(2)}M` : v)} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Line dataKey="actual" name="Actual (SFO)" stroke="#0f172a" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="lstm" name="LSTM backtest" stroke={chartTheme.brand} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          <Line dataKey="naive" name="Seasonal naive" stroke={chartTheme.axis} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
          <Line dataKey="forecast" name="12-month forecast" stroke={chartTheme.orange} strokeWidth={2.5} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SatisfactionSurfaceChart() {
  const surface = artifacts.satisfaction_surface;
  if (!surface) return null;
  const labels = ['< 5 min', '5–10 min', '10–20 min', '20–35 min', '35+ min'];
  const data = surface.mean_probability.map((row, i) => ({
    wait: labels[i],
    onTime: Number((row[0] * 100).toFixed(1)),
    late60: Number((row[surface.delays.indexOf(60)] * 100).toFixed(1)),
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -12, right: 8, top: 4 }}>
          <CartesianGrid stroke={chartTheme.grid} vertical={false} />
          <XAxis dataKey="wait" tick={{ fill: chartTheme.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: chartTheme.axis, fontSize: 11 }} tickLine={false} axisLine={false} domain={[30, 60]} unit="%" />
          <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => `${v}%`} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="onTime" name="On-time flight" fill={chartTheme.brand} radius={[6, 6, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="late60" name="60 min delay" fill={chartTheme.orange} radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
