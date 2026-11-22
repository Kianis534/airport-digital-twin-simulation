// KPI aggregation; mirrors simulation/engine/metrics.py.
import type { AirportState, Flight, Passenger } from './engine';
import type { Kpis, ProcessParameters, ScenarioConfig, ServiceLevel, SimulationResult, WaitBucket } from './types';

const BUCKETS: Array<[number, number, string]> = [
  [0, 5, '0-5'],
  [5, 10, '5-10'],
  [10, 15, '10-15'],
  [15, 20, '15-20'],
  [20, 30, '20-30'],
  [30, 45, '30-45'],
  [45, 60, '45-60'],
  [60, Infinity, '60+'],
];

export function clock(startHour: number, minutes: number): string {
  const total = (((Math.round(startHour * 60 + minutes) % 1440) + 1440) % 1440);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const round = (value: number, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/** Linear-interpolated percentile, matching numpy's default. */
export function percentile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (q / 100) * (sorted.length - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}

export function summarise(
  config: ScenarioConfig,
  state: AirportState,
  flights: Flight[],
  passengers: Passenger[],
  satisfaction: Array<{ p: number; share: number }>,
  params: ProcessParameters,
): Omit<SimulationResult, 'scenario' | 'recommendations' | 'engine'> {
  const checkinWaits = passengers.filter((p) => p.needsCheckin).map((p) => p.checkinWait);
  const securityWaits = passengers.map((p) => p.securityWait);
  const timeToGate = passengers.filter((p) => p.gateArrival !== null).map((p) => (p.gateArrival as number) - p.arrival);
  const delays = flights.map((f) => (f.actualDeparture !== null ? Math.max(0, f.actualDeparture - f.scheduled) : f.predictedDelay));
  const boarded = passengers.filter((p) => p.outcome === 'BOARDED').length;
  const missed = passengers.filter((p) => p.outcome === 'MISSED').length;

  const firstArrival = passengers.length ? Math.min(...passengers.map((p) => p.arrival)) : 0;
  const lastDeparture = flights.length ? Math.max(...flights.map((f) => f.actualDeparture ?? 0)) : 0;
  const horizon = Math.max(1, lastDeparture - firstArrival);
  const n = passengers.length;
  const onTime = delays.length ? delays.filter((d) => d <= 15).length / delays.length : 1;

  const kpis: Kpis = {
    flights: flights.length,
    passengers: n,
    boarded,
    missed_passengers: missed,
    missed_rate: n ? round(missed / n, 4) : 0,
    flights_with_missed_passengers: flights.filter((f) => f.missed > 0).length,
    avg_checkin_wait_min: round(mean(checkinWaits)),
    p95_checkin_wait_min: round(percentile(checkinWaits, 95)),
    avg_security_wait_min: round(mean(securityWaits)),
    p95_security_wait_min: round(percentile(securityWaits, 95)),
    max_security_wait_min: round(securityWaits.length ? Math.max(...securityWaits) : 0),
    max_checkin_queue: state.checkin.maxQueue,
    max_security_queue: state.security.maxQueue,
    avg_time_to_gate_min: round(mean(timeToGate)),
    avg_departure_delay_min: round(mean(delays)),
    on_time_departure_rate: round(onTime, 4),
    gate_conflicts: state.gates.conflicts,
    checkin_utilization: round(state.checkin.utilization(horizon), 4),
    security_utilization: round(state.security.utilization(horizon), 4),
    gate_utilization: round(state.gates.utilization(horizon), 4),
    avg_satisfaction: round(mean(satisfaction.map((s) => s.p)), 4),
    satisfied_share: round(mean(satisfaction.map((s) => s.share)), 4),
    throughput_per_hour: round(boarded / (horizon / 60), 1),
    operating_window_min: round(horizon, 1),
  };

  const start = params.monitor_interval * Math.floor(firstArrival / params.monitor_interval);
  const waitDistribution: WaitBucket[] = BUCKETS.map(([low, high, bucket]) => ({
    bucket,
    checkin: checkinWaits.filter((w) => w >= low && w < high).length,
    security: securityWaits.filter((w) => w >= low && w < high).length,
  }));

  const serviceLevels: ServiceLevel[] = [
    {
      name: 'Security wait (p95)',
      target: `<= ${params.sla_security_p95} min`,
      value: kpis.p95_security_wait_min,
      met: kpis.p95_security_wait_min <= params.sla_security_p95,
    },
    {
      name: 'Check-in wait (p95)',
      target: `<= ${params.sla_checkin_p95} min`,
      value: kpis.p95_checkin_wait_min,
      met: kpis.p95_checkin_wait_min <= params.sla_checkin_p95,
    },
    {
      name: 'Missed-flight rate',
      target: `<= ${Math.round(params.sla_missed_rate * 100)}%`,
      value: kpis.missed_rate,
      met: kpis.missed_rate <= params.sla_missed_rate,
    },
    {
      name: 'On-time departures',
      target: `>= ${Math.round(params.sla_on_time_rate * 100)}%`,
      value: kpis.on_time_departure_rate,
      met: kpis.on_time_departure_rate >= params.sla_on_time_rate,
    },
  ];

  return {
    kpis,
    service_levels: serviceLevels,
    time_series: state.snapshots.filter((s) => s.t >= start),
    wait_distribution: waitDistribution,
    flights: [...flights]
      .sort((a, b) => a.scheduled - b.scheduled)
      .map((f) => ({
        flight_id: f.flightId,
        airline: f.airline,
        international: f.international,
        scheduled: clock(config.start_hour, f.scheduled),
        departed: clock(config.start_hour, f.actualDeparture ?? f.scheduled + f.predictedDelay),
        delay_min: round(f.actualDeparture !== null ? Math.max(0, f.actualDeparture - f.scheduled) : f.predictedDelay, 1),
        gate_wait_min: round(f.gateWait, 1),
        passengers: f.passengerCount,
        boarded: f.boarded,
        missed: f.missed,
      })),
  };
}
