import React from 'react';
import type { Metadata } from 'next';
import { Activity, BrainCircuit, Database, Layers, LayoutDashboard, Server } from 'lucide-react';
import { Card, CardTitle, PageHeader } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Architecture',
  description: 'How the airport digital twin is built: data pipeline, ML models, SimPy engine, FastAPI service and Next.js dashboard.',
};

const LAYERS = [
  {
    icon: Database,
    title: 'Data pipeline',
    path: 'preprocessing/',
    points: [
      'Cleans three datasets and writes a data-quality report (rows in/out, every action taken).',
      'Flight context features: congestion score = departures from the same airport in the same hour.',
      'Monthly SFO passenger series with year-over-year growth and seasonality index.',
    ],
  },
  {
    icon: BrainCircuit,
    title: 'Machine learning',
    path: 'ml_models/',
    points: [
      'One feature contract shared by training and inference, so encodings can never drift.',
      'XGBoost artifacts saved in the portable UBJSON format, not pickles.',
      'Every model degrades gracefully: empirical delays, logistic satisfaction, seasonal-index demand.',
    ],
  },
  {
    icon: Activity,
    title: 'Simulation engine',
    path: 'simulation/',
    points: [
      'SimPy processes for flights (gate, boarding, gate close, pushback) and passengers (check-in, security, walk, board).',
      'Instrumented resources record queue length, waiting time and utilisation.',
      'Seeded and deterministic: same seed, same day. Comparisons use common random numbers.',
    ],
  },
  {
    icon: Server,
    title: 'API service',
    path: 'backend_fastapi/',
    points: [
      'Versioned REST API with Pydantic schemas; bounds come from the engine config.',
      'Synchronous runs, baseline-vs-scenario comparison and background jobs.',
      'Artifacts load once at startup; OpenAPI docs at /docs.',
    ],
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    path: 'frontend_nextjs/',
    points: [
      'Next.js 16 + React 19, Tailwind, Recharts and React Three Fiber.',
      'A TypeScript port of the engine runs scenarios in the browser when no API is configured.',
      'Exported as a static site for GitHub Pages.',
    ],
  },
  {
    icon: Layers,
    title: 'Quality',
    path: 'tests/ · .github/',
    points: [
      'pytest suite: engine behaviour, API contract, data pipeline, model artifacts, Streamlit app.',
      'Vitest suite for the TypeScript engine, checked against the same expectations as Python.',
      'GitHub Actions: lint, test, build and deploy on every push.',
    ],
  },
];

const ENDPOINTS = [
  ['GET', '/health', 'Service status and which model backs each prediction'],
  ['POST', '/api/v1/simulations', 'Run a scenario and return KPIs, time series, flights and advice'],
  ['POST', '/api/v1/simulations/compare', 'Baseline vs. what-if on the same seed, with KPI deltas'],
  ['POST', '/api/v1/simulations/jobs', 'Queue a scenario in the background (202 + job id)'],
  ['GET', '/api/v1/simulations/jobs/{id}', 'Poll a background job'],
  ['POST', '/api/v1/predict/satisfaction', 'Satisfaction probability for one passenger profile'],
  ['POST', '/api/v1/predict/delay', 'Departure delay for a flight (once the delay model is trained)'],
  ['GET', '/api/v1/forecast/traffic', 'LSTM forecast with backtest and metrics'],
  ['GET', '/api/v1/models', 'Model sources and test-set metrics'],
];

const PROCESS = [
  ['Arrive', 'Normal around 95 min (domestic) / 120 min (international) before departure'],
  ['Check-in', '30% / 55% use a counter; triangular service 1.2–3.6 min'],
  ['Security', 'Every passenger; triangular 0.25–0.8 min per lane, ×0.75 with CT scanners'],
  ['Walk', '6–14 min to the gate, +8 min passport control for international'],
  ['Gate', 'Aircraft claims a gate 55 min out; needs 45 min before pushback'],
  ['Board', 'Opens 40 min before departure, 2 lanes per gate, gate closes at −10 min'],
];

export default function ArchitecturePage() {
  return (
    <div className="space-y-12">
      <PageHeader eyebrow="Architecture" title="How the twin" accent="is put together.">
        Six layers, each in its own folder with its own tests. Data flows one way: datasets → models → engine → API → UI.
      </PageHeader>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {LAYERS.map((layer) => (
          <Card key={layer.title}>
            <CardTitle icon={layer.icon} title={layer.title} subtitle={layer.path} />
            <ul className="space-y-2.5 text-sm leading-relaxed text-slate-600">
              {layer.points.map((point) => (
                <li key={point} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  {point}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle icon={Activity} title="The process model" subtitle="One simulated passenger journey" />
          <ol className="relative space-y-4 border-l border-slate-200 pl-6">
            {PROCESS.map(([step, detail], i) => (
              <li key={step} className="relative">
                <span className="absolute -left-[33px] grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <p className="font-semibold text-slate-900">{step}</p>
                <p className="text-sm text-slate-600">{detail}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-xs text-slate-500">
            Parameters live in <code className="rounded bg-slate-100 px-1">simulation/parameters.py</code> and are exported to the
            browser engine, so both engines run the same airport.
          </p>
        </Card>

        <Card className="!p-0 overflow-hidden">
          <div className="p-6 md:p-8 pb-4 md:pb-4">
            <CardTitle icon={Server} title="REST API" subtitle="FastAPI · interactive docs at /docs" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <tbody className="divide-y divide-slate-100">
                {ENDPOINTS.map(([method, path, desc]) => (
                  <tr key={path + method}>
                    <td className="py-3 pl-6 pr-2 align-top">
                      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${method === 'GET' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {method}
                      </span>
                    </td>
                    <td className="px-2 py-3 align-top font-mono text-xs text-slate-800">{path}</td>
                    <td className="py-3 pl-2 pr-6 text-slate-600">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
