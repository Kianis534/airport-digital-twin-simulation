"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cpu, Server } from 'lucide-react';
import ScenarioControls, { BASELINE_LEVERS, PRESETS, presetSlug, type Levers } from '@/components/lab/ScenarioControls';
import ScenarioResults from '@/components/lab/ScenarioResults';
import { Card, PageHeader } from '@/components/ui';
import type { SimulationResult } from '@/lib/simulation/types';
import { apiConfigured, runScenario, type EngineSource } from '@/services/api';

export default function ScenarioLabPage() {
  const [levers, setLevers] = useState<Levers>(BASELINE_LEVERS);
  const [preset, setPreset] = useState<string | null>('Baseline');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [baseline, setBaseline] = useState<SimulationResult | null>(null);
  const [source, setSource] = useState<EngineSource>('browser');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baselineCache = useRef(new Map<number, SimulationResult>());

  const execute = useCallback(async (next: Levers) => {
    setRunning(true);
    setError(null);
    try {
      const seed = next.seed ?? 42;
      let base = baselineCache.current.get(seed);
      if (!base) {
        base = (await runScenario({ ...BASELINE_LEVERS, seed, scenario_name: 'Baseline' })).result;
        baselineCache.current.set(seed, base);
      }
      const run = await runScenario({ ...next, scenario_name: 'What-if' });
      setBaseline(base);
      setResult(run.result);
      setSource(run.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    // Shareable links: /what-if?preset=lane-closure. Deferred so the loading state paints first.
    const id = window.setTimeout(() => {
      const slug = new URLSearchParams(window.location.search).get('preset');
      const found = slug ? PRESETS.find((p) => presetSlug(p.name) === slug) : undefined;
      const initial = found ? { ...BASELINE_LEVERS, ...found.levers } : BASELINE_LEVERS;
      if (found) {
        setPreset(found.name);
        setLevers(initial);
      }
      void execute(initial);
    }, 0);
    return () => window.clearTimeout(id);
  }, [execute]);

  const applyPreset = (name: string) => {
    const found = PRESETS.find((p) => p.name === name);
    if (!found) return;
    const next = { ...BASELINE_LEVERS, ...found.levers, seed: levers.seed };
    setPreset(name);
    setLevers(next);
    const url = new URL(window.location.href);
    if (name === 'Baseline') url.searchParams.delete('preset');
    else url.searchParams.set('preset', presetSlug(name));
    window.history.replaceState(null, '', url);
    void execute(next);
  };

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Scenario Lab" title="Stress-test the airport" accent="before it happens." align="left">
        Every run simulates a full operating day: each flight, each passenger, each queue. Change staffing,
        demand or disruption, then compare against the baseline on the same random seed, so the difference
        you see comes from your change and not from luck.
      </PageHeader>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="!p-6">
            <ScenarioControls
              levers={levers}
              onChange={(next) => {
                setLevers(next);
                setPreset(null);
              }}
              onRun={() => void execute(levers)}
              onReset={() => applyPreset('Baseline')}
              running={running}
              activePreset={preset}
              onPreset={applyPreset}
            />
          </Card>
          <p className="mt-3 flex items-center gap-2 px-2 text-xs text-slate-500">
            {apiConfigured ? <Server className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
            {apiConfigured
              ? 'Runs on the FastAPI service, with the browser engine as a fallback.'
              : 'Runs entirely in your browser. Point NEXT_PUBLIC_API_URL at the FastAPI service to use the Python engine.'}
          </p>
        </aside>

        <section aria-live="polite" className={running ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {error && <Card className="border-rose-200 bg-rose-50 text-rose-700">{error}</Card>}
          {result ? (
            <ScenarioResults result={result} baseline={baseline} source={source} />
          ) : (
            <Card className="grid h-96 place-items-center text-slate-500">Simulating the baseline day…</Card>
          )}
        </section>
      </div>
    </div>
  );
}
