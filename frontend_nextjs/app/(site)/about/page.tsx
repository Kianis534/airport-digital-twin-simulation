import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Database, Lightbulb, Target } from 'lucide-react';
import { Card, CardTitle, GithubIcon, PageHeader } from '@/components/ui';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: 'Why this airport digital twin exists, what it models, the datasets behind it and who built it.',
};

const DATASETS = [
  {
    name: '2015 Flight Delays and Cancellations',
    source: 'US Department of Transportation, via Kaggle (usdot/flight-delays)',
    use: 'Flight-delay regressor; airline and airport reference tables',
    size: '5.8M flights',
  },
  {
    name: 'Airline Passenger Satisfaction',
    source: 'Kaggle survey dataset (train/test split as published)',
    use: 'Satisfaction classifier, passenger profiles, empirical delay distribution',
    size: '129,880 respondents',
  },
  {
    name: 'Air Traffic Passenger Statistics',
    source: 'San Francisco International Airport open data',
    use: 'LSTM monthly demand forecast and seasonality',
    size: '15,007 rows · 129 months',
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-12">
      <PageHeader eyebrow="About the project" title="A digital twin" accent="built to answer real questions.">
        How many security lanes does tomorrow&apos;s peak need? What happens to missed connections if a storm adds 30
        minutes to every departure? Airports answer these with simulation. This project builds that kind of tool end to end.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardTitle icon={Target} title="The problem" />
          <p className="text-sm leading-relaxed text-slate-600">
            Terminal capacity is set months ahead, but demand, weather and staffing change daily. Spreadsheets average away
            the peaks where queues actually form. A process simulation keeps every passenger and every minute, so
            bottlenecks and their knock-on effects show up.
          </p>
        </Card>
        <Card>
          <CardTitle icon={Lightbulb} title="The approach" />
          <p className="text-sm leading-relaxed text-slate-600">
            A discrete-event model of the terminal provides the structure. Machine learning fills in behaviour that rules
            can&apos;t capture well: how late flights run, how passengers judge their trip, how demand moves through the year.
            Each model is optional and has a data-driven fallback.
          </p>
        </Card>
        <Card>
          <CardTitle icon={BookOpen} title="Honest by design" />
          <p className="text-sm leading-relaxed text-slate-600">
            Metrics are measured on held-out data and shown next to a naive baseline. The UI says which model produced
            each number, and the live 3D view is labelled as a visual companion to the full engine.
          </p>
        </Card>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="p-6 md:p-8 pb-4 md:pb-4">
          <CardTitle icon={Database} title="Datasets" subtitle="Public data, credited to its publishers" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-2.5">Dataset</th>
                <th className="px-3 py-2.5">Used for</th>
                <th className="px-6 py-2.5 text-right">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {DATASETS.map((d) => (
                <tr key={d.name}>
                  <td className="px-6 py-3">
                    <p className="font-semibold text-slate-900">{d.name}</p>
                    <p className="text-xs text-slate-500">{d.source}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{d.use}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-slate-600">{d.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <section className="grid items-center gap-8 rounded-[2rem] bg-slate-950 p-8 text-white md:grid-cols-[1fr_auto] md:p-12">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Author</p>
          <h2 className="text-3xl font-extrabold tracking-tight">{site.author}</h2>
          <p className="max-w-2xl leading-relaxed text-slate-400">
            Software engineer working across simulation, machine learning and full-stack web. I designed and built every
            layer of this project: the data pipeline, the models, the SimPy engine and its TypeScript port, the API and
            this dashboard. Issues and pull requests are welcome.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
          <a href={site.authorUrl} target="_blank" rel="noopener noreferrer" className="btn bg-white text-slate-900 hover:bg-slate-100">
            <GithubIcon className="h-5 w-5" /> GitHub profile
          </a>
          <Link href="/what-if" className="btn border border-white/15 bg-white/5 text-white hover:bg-white/10">
            Try the twin <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
