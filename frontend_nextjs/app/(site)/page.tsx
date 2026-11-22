import React from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Box,
  BrainCircuit,
  Database,
  FlaskConical,
  Gauge,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-react';
import BaselineSnapshot from '@/components/BaselineSnapshot';
import { Card, Eyebrow, GithubIcon } from '@/components/ui';
import { artifacts } from '@/lib/artifacts';
import { site } from '@/lib/site';

const sat = artifacts.models.satisfaction;
const traffic = artifacts.models.traffic;

const STATS = [
  { value: '129,880', label: 'passenger survey responses' },
  { value: `${artifacts.traffic.history.length}`, label: 'months of SFO traffic' },
  { value: `${(sat.metrics.accuracy * 100).toFixed(1)}%`, label: 'satisfaction model accuracy' },
  { value: `${traffic.metrics.lstm.mape}%`, label: 'LSTM forecast error (MAPE)' },
];

const STEPS = [
  {
    icon: Database,
    title: 'Real data in',
    text: 'Three public datasets are cleaned and validated: 2015 US flight operations, a 130k-passenger satisfaction survey and 11 years of SFO traffic.',
  },
  {
    icon: BrainCircuit,
    title: 'Models learn behaviour',
    text: 'XGBoost predicts satisfaction (and delay, if you add the flights file). An LSTM forecasts monthly demand and sets seasonal load.',
  },
  {
    icon: Activity,
    title: 'The day is simulated',
    text: 'A SimPy discrete-event engine schedules flights and moves every passenger through check-in, security, gates and boarding.',
  },
  {
    icon: Gauge,
    title: 'Decisions come out',
    text: 'Queue times, missed flights, on-time rate and predicted satisfaction, plus staffing advice sized from peak demand.',
  },
];

const FEATURES = [
  { icon: FlaskConical, title: 'Scenario Lab', text: 'Close lanes, add 50% traffic, bring a storm. Compare against the baseline on the same seed.', href: '/what-if' },
  { icon: Box, title: '3D live twin', text: 'A Three.js terminal where passengers walk the process and aircraft board and take off.', href: '/simulation' },
  { icon: BarChart3, title: 'Live analytics', text: 'Seven synced charts of crowding, queue time and satisfaction from the live view.', href: '/graphs-stats' },
  { icon: BrainCircuit, title: 'Model cards', text: 'Test-set metrics, baselines, feature importance and the LSTM backtest, all from the trained artifacts.', href: '/models' },
  { icon: Server, title: 'REST API', text: 'FastAPI service with typed schemas, background jobs, scenario comparison and model endpoints.', href: '/overview' },
  { icon: ShieldCheck, title: 'Tested', text: '65 automated tests across Python and TypeScript, run in CI on every push.', href: '/overview' },
];

export default function HomePage() {
  return (
    <div className="space-y-20 md:space-y-28">
      <section className="relative isolate -mt-4 overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-14 text-white md:px-12 md:py-20">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center opacity-40 animate-subtle-zoom"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1436491865332-7a61a109c0f2?q=80&w=2070&auto=format&fit=crop')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/40" aria-hidden="true" />
        <div className="absolute -right-40 -top-40 -z-10 h-[32rem] w-[32rem] rounded-full bg-brand-600/30 blur-[140px]" aria-hidden="true" />

        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div className="space-y-7">
            <Eyebrow tone="dark">Airport digital twin · open source</Eyebrow>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Find the bottleneck <span className="text-brand-300">before the passengers do.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-300">
              {site.name} simulates a full airport day, flight by flight and passenger by passenger, with
              machine-learning models trained on real aviation data. Change staffing or demand and see queues,
              missed flights and satisfaction move.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/what-if" className="btn-primary !px-6 !py-3.5 text-base">
                Open the Scenario Lab <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/simulation" className="btn !px-6 !py-3.5 text-base border border-white/15 bg-white/5 text-white hover:bg-white/10">
                Watch the 3D twin
              </Link>
            </div>
          </div>
          <BaselineSnapshot />
        </div>

        <dl className="mt-14 grid grid-cols-2 gap-6 border-t border-white/10 pt-8 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <dt className="text-xs uppercase tracking-wider text-slate-400">{s.label}</dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums md:text-3xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-10">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">From raw data to a staffing decision</h2>
          <p className="text-slate-600">One pipeline, four stages. Every number on this site comes out of it.</p>
        </div>
        <ol className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Card className="h-full">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold text-slate-300">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-bold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-10">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Eyebrow>What you can do</Eyebrow>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">A twin you can actually operate</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link key={f.title} href={f.href} className="group">
              <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-brand-200 group-hover:shadow-lg">
                <f.icon className="h-6 w-6 text-brand-600" />
                <h3 className="mt-4 flex items-center gap-1.5 text-lg font-bold tracking-tight">
                  {f.title}
                  <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid items-center gap-10 rounded-[2rem] border border-slate-200/70 bg-white p-8 md:p-12 lg:grid-cols-2">
        <div className="space-y-5">
          <Eyebrow>Example finding</Eyebrow>
          <h2 className="text-3xl font-extrabold tracking-tight">Queues don&apos;t grow linearly. They tip over.</h2>
          <p className="leading-relaxed text-slate-600">
            On the default day, six security lanes keep the 95th-percentile wait under a minute. Five lanes: about five
            minutes. Four: around 26 minutes, well past the 15-minute target. Three: over an hour and a half, and close to
            three in ten passengers miss their flight. The advisor sizes the fix from the simulated peak hour instead of
            the daily average, which is exactly where spreadsheets go wrong.
          </p>
          <Link href="/what-if?preset=lane-closure" className="btn-dark w-fit">
            Try the lane-closure preset <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: ShieldCheck, label: 'Discrete-event engine', value: 'SimPy' },
            { icon: Users, label: 'Passengers per run', value: '3–7k' },
            { icon: Gauge, label: 'Per simulated day', value: '< 1 s' },
            { icon: BrainCircuit, label: 'Models', value: 'XGBoost · LSTM' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-slate-50 p-5">
              <item.icon className="h-5 w-5 text-brand-600" />
              <p className="mt-3 text-xl font-extrabold tracking-tight">{item.value}</p>
              <p className="text-xs text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-center gap-5 rounded-[2rem] bg-slate-950 px-6 py-14 text-center text-white">
        <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Clone it, run it, extend it</h2>
        <p className="max-w-xl text-slate-400">
          Python engine, FastAPI service, Streamlit app and this Next.js dashboard, MIT licensed. Setup takes a few minutes.
        </p>
        <a href={site.repoUrl} target="_blank" rel="noopener noreferrer" className="btn bg-white text-slate-900 hover:bg-slate-100">
          <GithubIcon className="h-5 w-5" /> View on GitHub
        </a>
      </section>
    </div>
  );
}
