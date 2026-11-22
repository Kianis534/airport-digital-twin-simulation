// Rule-based advisor; mirrors simulation/engine/advisor.py.
import type { Passenger } from './engine';
import type { Kpis, ProcessParameters, Recommendation, ScenarioConfig } from './types';

const ORDER: Record<Recommendation['severity'], number> = { critical: 0, warning: 1, info: 2, ok: 3 };

/** Highest number of arrivals in any rolling 60-minute window, per minute. */
export function peakHourlyRate(times: number[]): number {
  if (!times.length) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  let best = 0;
  let end = 0;
  for (let start = 0; start < sorted.length; start++) {
    while (end < sorted.length && sorted[end] < sorted[start] + 60) end++;
    best = Math.max(best, end - start);
  }
  return best / 60;
}

export function requiredServers(ratePerMin: number, meanService: number, targetUtilization: number): number {
  return Math.max(1, Math.ceil((ratePerMin * meanService) / targetUtilization));
}

const triangularMean = (t: [number, number, number]) => (t[0] + t[1] + t[2]) / 3;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;

export function buildRecommendations(
  config: ScenarioConfig,
  k: Kpis,
  passengers: Passenger[],
  p: ProcessParameters,
): Recommendation[] {
  const recs: Recommendation[] = [];
  const securityFactor = config.security_tech === 'advanced' ? 0.75 : 1;

  const securityPeak = peakHourlyRate(passengers.filter((x) => x.securityEntry !== null).map((x) => x.securityEntry as number));
  const lanesNeeded = requiredServers(securityPeak, triangularMean(p.security_service) * securityFactor, p.target_utilization);
  const checkinPeak = peakHourlyRate(passengers.filter((x) => x.needsCheckin).map((x) => x.arrival));
  const countersNeeded = requiredServers(checkinPeak, triangularMean(p.checkin_service), p.target_utilization);

  if (k.p95_security_wait_min > p.sla_security_p95 && lanesNeeded > config.security_lanes) {
    const extra = lanesNeeded - config.security_lanes;
    recs.push({
      severity: k.p95_security_wait_min > 2 * p.sla_security_p95 ? 'critical' : 'warning',
      area: 'security',
      title: 'Security is the bottleneck',
      detail: `95th percentile wait is ${k.p95_security_wait_min.toFixed(0)} min. Peak demand reaches ${(securityPeak * 60).toFixed(0)} passengers/hour against ${config.security_lanes} lanes.`,
      action: `Open ${plural(extra, 'more lane')} (${lanesNeeded} total) for the peak.`,
    });
  } else if (config.security_lanes > lanesNeeded + 1 && k.p95_security_wait_min < 3) {
    recs.push({
      severity: 'info',
      area: 'security',
      title: 'Security has spare capacity',
      detail: `Lanes run at ${pct(k.security_utilization)} utilisation with almost no queue.`,
      action: `${lanesNeeded} lanes would still meet the wait-time target.`,
    });
  }

  if (k.p95_checkin_wait_min > p.sla_checkin_p95 && countersNeeded > config.checkin_counters) {
    const extra = countersNeeded - config.checkin_counters;
    recs.push({
      severity: 'warning',
      area: 'check-in',
      title: 'Check-in queues are building',
      detail: `95th percentile check-in wait is ${k.p95_checkin_wait_min.toFixed(0)} min at a peak of ${(checkinPeak * 60).toFixed(0)} passengers/hour.`,
      action: `Staff ${plural(extra, 'more counter')} or push online check-in.`,
    });
  }

  if (k.gate_conflicts > 0) {
    recs.push({
      severity: 'warning',
      area: 'gates',
      title: 'Aircraft are waiting for gates',
      detail: `${k.gate_conflicts} flights had to wait for a free gate, adding delay.`,
      action: 'Add gates or remote stands, or spread departures more evenly.',
    });
  }

  if (k.missed_rate > p.sla_missed_rate) {
    recs.push({
      severity: 'critical',
      area: 'passengers',
      title: 'Passengers are missing flights',
      detail: `${k.missed_passengers} passengers (${pct(k.missed_rate, 1)}) reached the gate after it closed, across ${k.flights_with_missed_passengers} flights.`,
      action: 'Cut processing queues first; a fast-track lane for late flights also helps.',
    });
  }

  if (k.on_time_departure_rate < p.sla_on_time_rate) {
    recs.push({
      severity: 'warning',
      area: 'flights',
      title: 'On-time performance below target',
      detail: `Only ${pct(k.on_time_departure_rate)} of departures leave within 15 minutes; average delay is ${k.avg_departure_delay_min.toFixed(0)} min.`,
      action: 'Delay is mostly exogenous (weather, inbound aircraft). Pre-plan gate swaps and crew buffers.',
    });
  }

  if (!recs.length) {
    recs.push({
      severity: 'ok',
      area: 'operations',
      title: 'Operations within targets',
      detail: 'Queues, missed connections and departures all meet their service levels.',
      action: 'No change needed for this scenario.',
    });
  }
  return recs.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
