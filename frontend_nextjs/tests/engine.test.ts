import { describe, expect, it } from 'vitest';
import { artifacts } from '@/lib/artifacts';
import { demandMultiplier, experienceRating, runSimulation, satisfactionFor, withDefaults } from '@/lib/simulation/engine';
import { Environment, Resource } from '@/lib/simulation/kernel';
import { peakHourlyRate, requiredServers } from '@/lib/simulation/advisor';
import { percentile } from '@/lib/simulation/metrics';
import { Random } from '@/lib/simulation/random';

describe('kernel', () => {
  it('serves a FIFO queue with the right waiting times', () => {
    const env = new Environment();
    const server = new Resource(env, 1);
    const waits: number[] = [];
    function* customer(arrival: number) {
      yield env.timeout(arrival);
      const joined = env.now;
      const req = server.request();
      yield req;
      waits.push(env.now - joined);
      yield env.timeout(10);
      server.release(req);
    }
    [0, 1, 2].forEach((t) => env.process(customer(t)));
    env.run();
    expect(waits).toEqual([0, 9, 18]);
    expect(env.now).toBe(30);
  });

  it('wakes processes waiting on a signal', () => {
    const env = new Environment();
    const signal = env.event();
    let wokeAt = -1;
    env.process(
      (function* () {
        yield signal;
        wokeAt = env.now;
      })(),
    );
    env.process(
      (function* () {
        yield env.timeout(5);
        env.succeed(signal);
      })(),
    );
    env.run();
    expect(wokeAt).toBe(5);
  });
});

describe('random', () => {
  it('is reproducible for a seed', () => {
    const a = new Random(42);
    const b = new Random(42);
    expect([a.random(), a.random()]).toEqual([b.random(), b.random()]);
  });

  it('keeps triangular samples in range', () => {
    const rng = new Random(1);
    for (let i = 0; i < 1000; i++) {
      const value = rng.triangular(1, 5, 2);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(5);
    }
  });
});

describe('engine', () => {
  const baseline = runSimulation({ seed: 123 });

  it('produces consistent KPIs', () => {
    const k = baseline.kpis;
    expect(k.flights).toBeGreaterThan(10);
    expect(k.passengers).toBe(k.boarded + k.missed_passengers);
    expect(k.avg_satisfaction).toBeGreaterThan(0);
    expect(k.avg_satisfaction).toBeLessThanOrEqual(1);
    expect(baseline.flights).toHaveLength(k.flights);
    const counted = baseline.wait_distribution.reduce((sum, b) => sum + b.security, 0);
    expect(counted).toBe(k.passengers);
  });

  it('is deterministic for a seed', () => {
    expect(runSimulation({ seed: 123 }).kpis).toEqual(baseline.kpis);
  });

  it('reacts to staffing, traffic and weather the way the Python engine does', () => {
    const tight = runSimulation({ seed: 5, security_lanes: 3 }).kpis;
    const relaxed = runSimulation({ seed: 5, security_lanes: 8 }).kpis;
    expect(tight.p95_security_wait_min).toBeGreaterThan(relaxed.p95_security_wait_min + 10);
    expect(tight.avg_satisfaction).toBeLessThan(relaxed.avg_satisfaction);

    const busy = runSimulation({ seed: 9, traffic_increase_pct: 50 }).kpis;
    expect(busy.passengers).toBeGreaterThan(runSimulation({ seed: 9 }).kpis.passengers * 1.25);

    const storm = runSimulation({ seed: 4, weather_severity: 90, delay_offset_min: 20 }).kpis;
    expect(storm.avg_departure_delay_min).toBeGreaterThan(runSimulation({ seed: 4 }).kpis.avg_departure_delay_min + 20);
  });

  it('flags gate shortages', () => {
    const result = runSimulation({ seed: 2, boarding_gates: 2 });
    expect(result.kpis.gate_conflicts).toBeGreaterThan(0);
    expect(result.recommendations.some((r) => r.area === 'gates')).toBe(true);
  });

  it('rejects out-of-range scenarios', () => {
    expect(() => withDefaults({ security_lanes: 0 })).toThrow(RangeError);
    expect(() => runSimulation({ weather_severity: 500 })).toThrow(RangeError);
  });

  it('applies the LSTM seasonal demand', () => {
    const [july, source] = demandMultiplier(7);
    const [january] = demandMultiplier(1);
    expect(source).toBe('lstm-forecast');
    expect(july).toBeGreaterThan(january);
    expect(demandMultiplier(null)).toEqual([1, 'baseline']);
  });

  it('uses the model-derived satisfaction surface', () => {
    expect(artifacts.satisfaction_surface).not.toBeNull();
    expect(experienceRating(0, [5, 10, 20, 35])).toBe(5);
    expect(experienceRating(40, [5, 10, 20, 35])).toBe(1);
    expect(satisfactionFor(0, 0).p).toBeGreaterThan(satisfactionFor(60, 0).p);
  });
});

describe('advisor', () => {
  it('computes peak rates and staffing', () => {
    const times = [...Array.from({ length: 120 }, (_, i) => i * 0.5), ...Array.from({ length: 10 }, (_, i) => 60 + i * 6)];
    expect(peakHourlyRate(times)).toBeCloseTo(2);
    expect(requiredServers(2, 0.5, 0.85)).toBe(2);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
  });

  it('puts critical advice first under stress', () => {
    const recs = runSimulation({ seed: 8, security_lanes: 3 }).recommendations;
    expect(recs[0].severity).toBe('critical');
  });
});
