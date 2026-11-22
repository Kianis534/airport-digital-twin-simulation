// In-browser port of the Python engine (simulation/engine/runner.py + entities/airport.py).
// Same process model, parameters and KPIs; it powers the live demo without a backend.

import { artifacts, type ModelArtifacts } from '@/lib/artifacts';
import { buildRecommendations } from './advisor';
import { Environment, Resource, type Process, type SimEvent } from './kernel';
import { clock, summarise } from './metrics';
import { Random } from './random';
import type { ProcessParameters, ScenarioConfig, SimulationResult } from './types';

export const ENGINE_VERSION = '2.0.0-web';

export interface Flight {
  flightId: string;
  airline: string;
  scheduled: number;
  seats: number;
  passengerCount: number;
  international: boolean;
  predictedDelay: number;
  gateWait: number;
  actualDeparture: number | null;
  gateClosed: boolean;
  boardingActive: number;
  boarded: number;
  missed: number;
  boardingOpen: SimEvent;
  lanes: Resource;
}

export interface Passenger {
  id: number;
  flight: number;
  arrival: number;
  needsCheckin: boolean;
  checkinWait: number;
  securityWait: number;
  securityEntry: number | null;
  gateArrival: number | null;
  outcome: 'IN_PROGRESS' | 'BOARDED' | 'MISSED';
}

export class QueueStation {
  readonly resource: Resource;
  maxQueue = 0;
  busyTime = 0;
  served = 0;

  constructor(
    private readonly env: Environment,
    readonly capacity: number,
  ) {
    this.resource = new Resource(env, capacity);
  }

  *serve(serviceTime: number): Process<number> {
    const joined = this.env.now;
    const req = this.resource.request();
    this.maxQueue = Math.max(this.maxQueue, this.resource.queue.length);
    yield req;
    const wait = this.env.now - joined;
    yield this.env.timeout(serviceTime);
    this.resource.release(req);
    this.busyTime += serviceTime;
    this.served += 1;
    return wait;
  }

  utilization(horizon: number): number {
    return horizon > 0 ? Math.min(1, this.busyTime / (this.capacity * horizon)) : 0;
  }
}

export class GateStation {
  readonly resource: Resource;
  occupied = 0;
  conflicts = 0;

  constructor(
    private readonly env: Environment,
    readonly gates: number,
  ) {
    this.resource = new Resource(env, gates);
  }

  utilization(horizon: number): number {
    return horizon > 0 ? Math.min(1, this.occupied / (this.gates * horizon)) : 0;
  }
}

export interface AirportState {
  checkin: QueueStation;
  security: QueueStation;
  gates: GateStation;
  snapshots: SimulationResult['time_series'];
}

function sampleQuantiles(rng: Random, quantiles: number[]): number {
  const position = rng.uniform(0, 100) * ((quantiles.length - 1) / 100);
  const lower = Math.floor(position);
  const upper = Math.min(quantiles.length - 1, lower + 1);
  const frac = position - lower;
  return quantiles[lower] + (quantiles[upper] - quantiles[lower]) * frac;
}

export function demandMultiplier(month: number | null, data: ModelArtifacts = artifacts): [number, string] {
  if (month === null) return [1, 'baseline'];
  const forecast = data.traffic.forecast;
  if (forecast.length) {
    const byMonth = new Map(forecast.map((row) => [Number(row.month.slice(5, 7)), row.passengers]));
    const mean = forecast.reduce((sum, row) => sum + row.passengers, 0) / forecast.length;
    const value = byMonth.get(month);
    if (value !== undefined && mean > 0) return [value / mean, 'lstm-forecast'];
  }
  const seasonal = data.traffic.seasonal_index[String(month)];
  if (seasonal) return [seasonal, 'seasonal-index'];
  return [1, 'baseline'];
}

/** Experience band -> 1..5 stars, identical to ml_models.features.experience_rating. */
export function experienceRating(wait: number, bands: number[]): number {
  let lost = 0;
  for (const edge of bands) if (wait >= edge) lost += 1;
  return 5 - lost;
}

function interpolate(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

export function satisfactionFor(wait: number, delay: number, data: ModelArtifacts = artifacts): { p: number; share: number } {
  const surface = data.satisfaction_surface;
  if (!surface) {
    const logit = 0.04 - 0.4 / (1 + Math.exp(-(wait - 20) / 6)) - 0.0004 * delay;
    const p = 1 / (1 + Math.exp(-logit));
    return { p, share: p >= 0.5 ? 1 : 0 };
  }
  const row = 5 - experienceRating(wait, surface.experience_bands);
  const d = Math.max(0, delay);
  return {
    p: interpolate(surface.delays, surface.mean_probability[row], d),
    share: interpolate(surface.delays, surface.satisfied_share[row], d),
  };
}

export function withDefaults(partial: Partial<ScenarioConfig> = {}, data: ModelArtifacts = artifacts): ScenarioConfig {
  const merged = { ...data.defaults, ...partial } as ScenarioConfig;
  for (const [key, [low, high]] of Object.entries(data.bounds)) {
    const value = merged[key as keyof ScenarioConfig];
    if (typeof value !== 'number' || Number.isNaN(value) || value < low || value > high) {
      throw new RangeError(`${key}=${String(value)} is outside the allowed range [${low}, ${high}]`);
    }
  }
  return merged;
}

export function runSimulation(partial: Partial<ScenarioConfig> = {}, data: ModelArtifacts = artifacts): SimulationResult {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const config = withDefaults(partial, data);
  const p: ProcessParameters = data.parameters;
  const seed = config.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = new Random(seed);
  const env = new Environment();

  const [multiplier, demandSource] = demandMultiplier(config.forecast_month, data);

  // ------------------------------------------------------------------ schedule
  const rate = config.base_departures_per_hour * (1 + config.traffic_increase_pct / 100) * multiplier;
  const hours = Math.ceil(config.duration_minutes / 60);
  const flights: Flight[] = [];
  for (let hour = 0; hour < hours; hour++) {
    const window = Math.min(60, config.duration_minutes - hour * 60);
    const expected = (rate * p.peak_profile[hour % p.peak_profile.length] * window) / 60;
    const count = Math.floor(expected) + (rng.random() < expected - Math.floor(expected) ? 1 : 0);
    const start = p.first_departure + hour * 60;
    const times = Array.from({ length: count }, () => start + rng.uniform(0, window)).sort((a, b) => a - b);
    for (const scheduled of times) {
      const international = rng.random() < config.international_share;
      const seats = rng.weightedChoice(p.seat_options, p.seat_weights);
      const airline = rng.choice(data.airlines);
      const baseDelay = Math.max(0, sampleQuantiles(rng, data.delay_distribution.quantiles));
      const weather = (config.weather_severity / 100) * p.weather_delay_max * rng.uniform(0.5, 1.5);
      const index = flights.length;
      flights.push({
        flightId: `${airline}${100 + ((index * 7) % 900)}`,
        airline,
        scheduled,
        seats,
        passengerCount: Math.round(seats * rng.uniform(p.load_factor_range[0], p.load_factor_range[1])),
        international,
        predictedDelay: baseDelay + weather + config.delay_offset_min,
        gateWait: 0,
        actualDeparture: null,
        gateClosed: false,
        boardingActive: 0,
        boarded: 0,
        missed: 0,
        boardingOpen: env.event(),
        lanes: new Resource(env, p.boarding_lanes_per_gate),
      });
    }
  }

  // ------------------------------------------------------------------ passengers
  const passengers: Passenger[] = [];
  flights.forEach((flight, index) => {
    const mean = flight.international ? p.arrival_mean_international : p.arrival_mean_domestic;
    const share = flight.international ? p.checkin_share_international : p.checkin_share_domestic;
    for (let i = 0; i < flight.passengerCount; i++) {
      const lead = Math.min(p.arrival_bounds[1], Math.max(p.arrival_bounds[0], rng.gauss(mean, p.arrival_sd)));
      passengers.push({
        id: passengers.length,
        flight: index,
        arrival: Math.max(0, flight.scheduled - lead),
        needsCheckin: rng.random() < share,
        checkinWait: 0,
        securityWait: 0,
        securityEntry: null,
        gateArrival: null,
        outcome: 'IN_PROGRESS',
      });
    }
  });
  passengers.sort((a, b) => a.arrival - b.arrival);

  // ------------------------------------------------------------------ processes
  const checkin = new QueueStation(env, config.checkin_counters);
  const security = new QueueStation(env, config.security_lanes);
  const gates = new GateStation(env, config.boarding_gates);
  const allDeparted = env.event();
  const snapshots: SimulationResult['time_series'] = [];
  const counters = { inTerminal: 0, atGate: 0, boarded: 0, missed: 0, departed: 0 };
  const securityFactor = config.security_tech === 'advanced' ? 0.75 : 1;
  const boardingSlowdown = 1 + (p.weather_boarding_slowdown * config.weather_severity) / 100;

  function* waitUntil(time: number): Process {
    if (time > env.now) yield env.timeout(time - env.now);
  }

  function* flightProcess(flight: Flight): Process {
    const planned = flight.scheduled + flight.predictedDelay;
    yield* waitUntil(planned - p.gate_request_lead);
    const requested = env.now;
    const gate = gates.resource.request();
    yield gate;
    if (env.now - requested > 1e-9) gates.conflicts += 1;
    const occupiedSince = env.now;
    const departure = Math.max(planned, env.now + p.min_gate_time);
    flight.gateWait = departure - planned;

    yield* waitUntil(departure - p.boarding_lead);
    env.succeed(flight.boardingOpen);
    yield* waitUntil(departure - p.gate_close_lead);
    flight.gateClosed = true;
    yield* waitUntil(departure);
    while (flight.boardingActive > 0) yield env.timeout(0.5);
    flight.actualDeparture = env.now;

    yield env.timeout(p.pushback);
    gates.occupied += env.now - occupiedSince;
    gates.resource.release(gate);
    counters.departed += 1;
    if (counters.departed === flights.length) env.succeed(allDeparted);
  }

  function* passengerProcess(pax: Passenger): Process {
    const flight = flights[pax.flight];
    yield* waitUntil(pax.arrival);
    counters.inTerminal += 1;
    if (pax.needsCheckin) {
      const [low, mode, high] = p.checkin_service;
      pax.checkinWait = yield* checkin.serve(rng.triangular(low, high, mode));
    }
    pax.securityEntry = env.now;
    const [sLow, sMode, sHigh] = p.security_service;
    pax.securityWait = yield* security.serve(rng.triangular(sLow, sHigh, sMode) * securityFactor);

    const walk = rng.uniform(p.walk_to_gate[0], p.walk_to_gate[1]) + (flight.international ? p.passport_control : 0);
    yield env.timeout(walk);
    pax.gateArrival = env.now;

    if (flight.gateClosed) {
      pax.outcome = 'MISSED';
      flight.missed += 1;
      counters.missed += 1;
      counters.inTerminal -= 1;
      return;
    }
    counters.atGate += 1;
    if (!flight.boardingOpen.triggered) yield flight.boardingOpen;
    flight.boardingActive += 1;
    const lane = flight.lanes.request();
    yield lane;
    yield env.timeout(rng.uniform(p.boarding_service[0], p.boarding_service[1]) * boardingSlowdown);
    flight.lanes.release(lane);
    flight.boardingActive -= 1;

    pax.outcome = 'BOARDED';
    flight.boarded += 1;
    counters.boarded += 1;
    counters.atGate -= 1;
    counters.inTerminal -= 1;
  }

  function* monitor(): Process {
    while (!allDeparted.triggered) {
      snapshots.push({
        t: Math.round(env.now * 100) / 100,
        clock: clock(config.start_hour, env.now),
        checkin_queue: checkin.resource.queue.length,
        security_queue: security.resource.queue.length,
        checkin_busy: checkin.resource.count,
        security_busy: security.resource.count,
        in_terminal: counters.inTerminal,
        at_gate: counters.atGate,
        boarded: counters.boarded,
        missed: counters.missed,
        gates_in_use: gates.resource.count,
      });
      yield env.timeout(p.monitor_interval);
    }
  }

  for (const flight of flights) env.process(flightProcess(flight));
  for (const pax of passengers) env.process(passengerProcess(pax));
  if (flights.length) {
    env.process(monitor());
    env.run(allDeparted);
  }

  // ------------------------------------------------------------------ scoring
  const satisfaction = passengers.map((pax) => {
    if (pax.outcome === 'MISSED') return { p: 0, share: 0 };
    const flight = flights[pax.flight];
    const delay = flight.actualDeparture !== null ? Math.max(0, flight.actualDeparture - flight.scheduled) : flight.predictedDelay;
    return satisfactionFor(pax.checkinWait + pax.securityWait, delay, data);
  });

  const state: AirportState = { checkin, security, gates, snapshots };
  const summary = summarise(config, state, flights, passengers, satisfaction, p);
  const finished = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    scenario: { ...config, seed },
    ...summary,
    recommendations: buildRecommendations(config, summary.kpis, passengers, p),
    engine: {
      version: ENGINE_VERSION,
      seed,
      runtime_ms: Math.round((finished - started) * 10) / 10,
      delay_model: 'empirical-distribution',
      satisfaction_model: data.satisfaction_surface ? 'xgboost-surface' : 'logistic-fallback',
      demand_model: demandSource,
      demand_multiplier: Math.round(multiplier * 10000) / 10000,
    },
  };
}
