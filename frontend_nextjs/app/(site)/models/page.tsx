import React from 'react';
import type { Metadata } from 'next';
import { Clock, LineChart, Smile, Terminal } from 'lucide-react';
import { FeatureImportanceChart, SatisfactionSurfaceChart, TrafficForecastChart } from '@/components/ModelCharts';
import { Badge, Card, CardTitle, PageHeader, Stat } from '@/components/ui';
import { artifacts } from '@/lib/artifacts';
import { fmt } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Models',
  description: 'Test-set metrics, baselines and feature importance for the satisfaction classifier, the LSTM traffic forecaster and the flight-delay regressor.',
};

const sat = artifacts.models.satisfaction;
const traffic = artifacts.models.traffic;
const delay = artifacts.models.delay;
const dist = artifacts.delay_distribution;

export default function ModelsPage() {
  const m = sat.metrics;
  const lstm = traffic.metrics.lstm;
  const naive = traffic.metrics.seasonal_naive;
  const improvement = ((naive.mape - lstm.mape) / naive.mape) * 100;

  return (
    <div className="space-y-12">
      <PageHeader eyebrow="Model cards" title="Three models," accent="each with a baseline to beat.">
        Every metric below is read from the training artifacts in the repository, measured on data the model never
        saw. Each model is also wired into the simulation, which is listed under each card.
      </PageHeader>

      <Card>
        <CardTitle
          icon={Smile}
          title="Passenger satisfaction classifier"
          subtitle={`${sat.model} · ${fmt.int(sat.train_rows)} training rows · ${fmt.int(sat.test_rows)} held-out test rows`}
          action={<Badge tone="green">Shipped</Badge>}
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Accuracy" value={fmt.pct(m.accuracy, 1)} hint={`baseline ${fmt.pct(m.baseline_accuracy, 1)}`} />
          <Stat label="ROC AUC" value={m.roc_auc.toFixed(3)} />
          <Stat label="Precision" value={fmt.pct(m.precision, 1)} />
          <Stat label="Recall" value={fmt.pct(m.recall, 1)} />
          <Stat label="F1" value={m.f1.toFixed(3)} />
          <Stat label="Train time" value={`${sat.train_seconds.toFixed(1)} s`} hint={`${sat.inference_ms_per_row.toFixed(3)} ms / row`} />
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <h4 className="mb-1 font-semibold text-slate-900">What drives satisfaction</h4>
            <p className="mb-3 text-sm text-slate-500">Gain-based importance, top 10 features.</p>
            <FeatureImportanceChart />
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="mb-1 font-semibold text-slate-900">How it plugs into the simulation</h4>
              <p className="text-sm leading-relaxed text-slate-600">
                Every simulated passenger borrows the profile of a real survey respondent (age, class, trip purpose,
                in-flight ratings). Their simulated queueing time becomes the airport-process rating and their flight&apos;s
                simulated delay replaces the recorded one. The classifier then predicts how that traveller would rate the
                trip. A missed flight counts as dissatisfied.
              </p>
            </div>
            <div>
              <h4 className="mb-1 font-semibold text-slate-900">Model response to the airport experience</h4>
              <p className="mb-2 text-sm text-slate-500">
                Average predicted satisfaction over {artifacts.satisfaction_surface?.profiles_sampled.toLocaleString()} real profiles.
              </p>
              <SatisfactionSurfaceChart />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle
          icon={LineChart}
          title="Monthly traffic forecaster"
          subtitle={`${traffic.model} · ${traffic.airport}, ${artifacts.traffic.history[0].month} to ${artifacts.traffic.history.at(-1)?.month} · last ${traffic.test_months} months held out`}
          action={<Badge tone="green">Shipped</Badge>}
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="LSTM MAPE" value={`${lstm.mape}%`} hint={`MAE ${fmt.compact(lstm.mae)} passengers`} />
          <Stat label="Seasonal naive MAPE" value={`${naive.mape}%`} hint={`MAE ${fmt.compact(naive.mae)} passengers`} />
          <Stat label="Error reduction" value={`${improvement.toFixed(0)}%`} hint="vs. same month last year" />
          <Stat label="Training" value={`${traffic.epochs_run} epochs`} hint={`${traffic.train_seconds.toFixed(0)} s, early stopping`} />
        </div>
        <div className="mt-6">
          <TrafficForecastChart />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-900">In the simulation:</span> pick a month in the Scenario Lab and
          departures are scaled by that month&apos;s forecast relative to the forecast-year average (July ×
          {(() => {
            const f = artifacts.traffic.forecast;
            const avg = f.reduce((s, r) => s + r.passengers, 0) / f.length;
            const jul = f.find((r) => r.month.endsWith('-07'));
            return jul ? ` ${(jul.passengers / avg).toFixed(2)}` : ' n/a';
          })()}
          ). The scaler is fitted on the training window only, so the backtest has no look-ahead.
        </p>
      </Card>

      <Card>
        <CardTitle
          icon={Clock}
          title="Flight delay regressor"
          subtitle="XGBoost on the 2015 US DOT on-time dataset (5.8M flights) · time-based holdout (Nov–Dec)"
          action={delay ? <Badge tone="green">Trained</Badge> : <Badge tone="amber">Train locally</Badge>}
        />
        {delay ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="MAE" value={`${delay.metrics.mae} min`} hint={`baseline ${delay.metrics.baseline_mae} min`} />
            <Stat label="RMSE" value={`${delay.metrics.rmse} min`} />
            <Stat label="R²" value={delay.metrics.r2} />
            <Stat label="Rows" value={fmt.compact(delay.train_rows)} />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 text-sm leading-relaxed text-slate-600">
              <p>
                The raw flights file is 565 MB, so it isn&apos;t stored in git and the delay model isn&apos;t shipped. The
                full pipeline is included and tested: download the data, run one command, and the engine switches from the
                empirical distribution to the regressor automatically.
              </p>
              <p>
                Until then, delays are sampled from the empirical distribution of{' '}
                <span className="font-semibold text-slate-900">{fmt.int(dist.n)}</span> recorded departure delays (mean{' '}
                {dist.mean} min, {fmt.pct(dist.on_time_share)} within 15 minutes). Weather and manual offsets are added on top.
              </p>
              <p>
                Features are limited to what is known before departure (month, weekday, hour, airline, origin, distance,
                congestion). Taxi-out time and arrival delay are excluded to avoid target leakage.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-950 p-5 font-mono text-[13px] leading-relaxed text-slate-300">
              <p className="mb-2 flex items-center gap-2 text-xs font-sans font-semibold uppercase tracking-wider text-slate-500">
                <Terminal className="h-4 w-4" /> Train it
              </p>
              <p className="text-slate-500"># 1. Kaggle: usdot/flight-delays → flights.csv</p>
              <p>mv flights.csv datasets/raw/</p>
              <p className="mt-2 text-slate-500"># 2. clean, train, export</p>
              <p>python -m preprocessing.pipeline</p>
              <p>python -m ml_models.train_delay_model</p>
              <p>python -m ml_models.export_artifacts</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
