// Client for the FastAPI service. When NEXT_PUBLIC_API_URL is not set, or the API is
// unreachable, scenarios run in the browser with the TypeScript port of the engine.
import { site } from '@/lib/site';
import { runSimulation } from '@/lib/simulation/engine';
import type { ScenarioConfig, SimulationResult } from '@/lib/simulation/types';

export type EngineSource = 'api' | 'browser';

export interface ScenarioRun {
  result: SimulationResult;
  source: EngineSource;
}

const TIMEOUT_MS = 15000;

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${site.apiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const apiConfigured = Boolean(site.apiUrl);

export async function runScenario(config: Partial<ScenarioConfig>): Promise<ScenarioRun> {
  if (apiConfigured) {
    try {
      const { start_hour: _ignored, ...body } = config;
      return { result: await postJson<SimulationResult>('/api/v1/simulations', body), source: 'api' };
    } catch (error) {
      console.warn('API unavailable, running the simulation in the browser instead.', error);
    }
  }
  // Yield to the event loop so the UI can show its loading state before the CPU work.
  await new Promise((resolve) => setTimeout(resolve, 30));
  return { result: runSimulation(config), source: 'browser' };
}
