"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Info } from 'lucide-react';
import AIAdvisorPanel from '@/components/AIAdvisorPanel';
import ControlPanel from '@/components/Simulation3D/ControlPanel';
import { Scene3DSlot } from '@/components/Simulation3D/Persistent3D';
// Imported here so a direct visit downloads the 3D code with the page (no extra round trip).
import '@/components/Simulation3D/Simulation3DCanvas';
import SimulationDashboard from '@/components/SimulationDashboard';
import { PageHeader } from '@/components/ui';

export default function SimulationPage() {
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="3D live twin" title="Watch the terminal" accent="in real time." align="left">
        Passengers arrive, check in, clear security, wait in the lounge and board while the aircraft cycles through
        boarding and take-off. Change staffing or weather on the right and the crowd responds within seconds.
      </PageHeader>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Scene3DSlot className="h-[560px] w-full" />
        <ControlPanel />
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 px-5 py-4 text-sm text-sky-900">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          This view is a real-time agent animation for intuition. Full-day numbers (thousands of passengers, flight
          schedules, missed flights, gate conflicts) come from the discrete-event engine in the{' '}
          <Link href="/what-if" className="font-semibold underline underline-offset-2">
            Scenario Lab
          </Link>
          . Satisfaction here uses the response curve exported from the trained XGBoost model.
        </p>
      </div>

      <AIAdvisorPanel />

      <div id="live-metrics" className="scroll-mt-24">
        <SimulationDashboard />
      </div>

      <section className="flex flex-col items-start justify-between gap-6 rounded-[2rem] bg-slate-950 p-8 text-white md:flex-row md:items-center md:p-10">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Want the full-day numbers?</h2>
          <p className="mt-1 text-slate-400">Run the same levers through the discrete-event engine and compare with the baseline.</p>
        </div>
        <Link href="/what-if" className="btn-primary">
          Open the Scenario Lab <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
