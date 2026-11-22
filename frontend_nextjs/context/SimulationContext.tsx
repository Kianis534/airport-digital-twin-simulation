"use client";

// State for the live 3D view: a lightweight agent animation that runs in real time.
// It is a visual companion to the discrete-event engine (see /what-if for full runs);
// the satisfaction figure uses the response surface exported from the trained XGBoost model.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { satisfactionFor } from '@/lib/simulation/engine';

export interface LiveMetrics {
  activePassengers: number;
  queueMinutes: number;
  satisfaction: number;
  throughputPerMin: number;
  timestamp: string;
}

export interface ChartPoint {
  timestamp: string;
  satisfaction: number;
  activePassengers: number;
  targetLoad: number;
  inflowChange: number;
  checkInQueue: number;
  securityQueue: number;
  boardingQueue: number;
  waitTimes: { range: string; count: number }[];
  queueMinutes: number;
  delayOffset: number;
}

export interface SimulationParams {
  increase_flights_percent: number;
  security_counters: number;
  checkin_counters: number;
  delay_offset_minutes: number;
  weather_severity: number;
  security_tech_level: 'standard' | 'advanced';
  time_of_day: number;
}

export interface CongestionNode {
  label: string;
  value: number;
}

export interface PassengerAgent {
  id: string;
  stage: number;
  type: 'international' | 'domestic';
  slotIndex: number;
  lastStageTime: number;
}

export interface SimulationAlert {
  id: string;
  type: 'risk' | 'bottleneck' | 'suggestion' | 'info';
  title: string;
  message: string;
  suggestion: string;
  timestamp: string;
  read: boolean;
}

interface SimulationContextType {
  metrics: LiveMetrics;
  history: ChartPoint[];
  alerts: SimulationAlert[];
  activeAdvice: SimulationAlert | null;
  congestion: CongestionNode[];
  passengers: PassengerAgent[];
  activeStage: number;
  isFlying: boolean;
  isPlaneReady: boolean;
  isPlaying: boolean;
  isResetting: boolean;
  simParams: SimulationParams;
  setIsPlaying: (playing: boolean) => void;
  markAlertAsRead: (id: string) => void;
  clearAlerts: () => void;
  resetEnvironment: () => void;
  runScenario: (params: Partial<SimulationParams>) => void;
}

export const DEFAULT_PARAMS: SimulationParams = {
  increase_flights_percent: 0,
  security_counters: 6,
  checkin_counters: 12,
  delay_offset_minutes: 0,
  weather_severity: 0,
  security_tech_level: 'standard',
  time_of_day: 12,
};

const TICK_MS = 2000;
const MAX_AGENTS = 150;
const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

function timeLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Rough queue time a newcomer would face, in simulated minutes, from the current crowding. */
function estimateQueueMinutes(checkIn: number, security: number, p: SimulationParams): number {
  const techFactor = p.security_tech_level === 'advanced' ? 0.75 : 1;
  const checkInMinutes = Math.max(0, checkIn - p.checkin_counters) * (2.3 / Math.max(1, p.checkin_counters));
  const securityMinutes = Math.max(0, security - p.security_counters) * ((2.4 * techFactor) / Math.max(1, p.security_counters));
  return checkInMinutes + securityMinutes;
}

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [isFlying, setIsFlying] = useState(false);
  const [isPlaneReady, setIsPlaneReady] = useState(true);
  const [alerts, setAlerts] = useState<SimulationAlert[]>([]);
  const [activeAdvice, setActiveAdvice] = useState<SimulationAlert | null>(null);
  const [history, setHistory] = useState<ChartPoint[]>([]);
  const [passengers, setPassengers] = useState<PassengerAgent[]>([]);
  const [congestion, setCongestion] = useState<CongestionNode[]>([
    { label: 'Check-In', value: 0 },
    { label: 'Security', value: 0 },
    { label: 'Lounge', value: 0 },
    { label: 'Boarding', value: 0 },
  ]);
  const [simParams, setSimParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [metrics, setMetrics] = useState<LiveMetrics>({
    activePassengers: 0,
    queueMinutes: 0,
    satisfaction: 0,
    throughputPerMin: 0,
    timestamp: '',
  });

  const passengersRef = useRef<PassengerAgent[]>([]);
  const planeTimer = useRef(0);
  const planeState = useRef({ ready: true, flying: false });
  const idCounter = useRef(0);

  const tick = useCallback(() => {
    const now = Date.now();
    const timestamp = timeLabel();
    const p = simParams;
    const { ready, flying } = planeState.current;

    // 1. Spawn and advance agents through the terminal stages.
    let agents = [...passengersRef.current];
    const spawn = Math.floor(1 + p.increase_flights_percent / 25 + Math.random());
    if (agents.length < MAX_AGENTS) {
      for (let i = 0; i < spawn; i++) {
        agents.push({
          id: `p-${idCounter.current++}`,
          stage: 0,
          type: Math.random() > 0.5 ? 'international' : 'domestic',
          slotIndex: agents.length,
          lastStageTime: now,
        });
      }
    }
    const techFactor = p.security_tech_level === 'advanced' ? 0.6 : 1;
    const weather = p.weather_severity * 30;
    const stageTimes = [
      0,
      3000 * (4 / p.checkin_counters) + weather,
      (4000 + (20 / p.security_counters) * 1000) * techFactor + weather,
      4000 + weather,
      2000 + weather,
      2000 + weather,
    ];
    let advanced = 0;
    agents = agents
      .map((agent) => {
        if (now - agent.lastStageTime < (stageTimes[agent.stage] ?? 2000)) return agent;
        let next = agent.stage;
        if (agent.stage === 3) {
          if (ready) next++;
        } else if (agent.stage === 2) {
          if (Math.random() > 0.1) next++;
        } else if (agent.stage < 6) {
          next++;
        }
        if (next === agent.stage) return agent;
        advanced++;
        return { ...agent, stage: next, lastStageTime: now };
      })
      .filter((agent) => !(agent.stage === 6 && flying));
    passengersRef.current = agents;

    // 2. Metrics from the current crowding.
    const checkIn = agents.filter((a) => a.stage === 1).length;
    const security = agents.filter((a) => a.stage === 2).length;
    const lounge = agents.filter((a) => a.stage === 3).length;
    const boarding = agents.filter((a) => a.stage === 4 || a.stage === 5).length;
    const queueMinutes = Number(estimateQueueMinutes(checkIn, security, p).toFixed(1));
    const delay = p.delay_offset_minutes + p.weather_severity * 0.4;
    const satisfaction = Number((satisfactionFor(queueMinutes, delay).p * 100).toFixed(1));
    const throughputPerMin = Number(((advanced / TICK_MS) * 60000).toFixed(1));

    setPassengers(agents);
    setMetrics({ activePassengers: agents.length, queueMinutes, satisfaction, throughputPerMin, timestamp });
    setCongestion([
      { label: 'Check-In', value: Math.min(100, Math.round((checkIn / Math.max(1, p.checkin_counters * 2)) * 100)) },
      { label: 'Security', value: Math.min(100, Math.round((security / Math.max(1, p.security_counters * 3)) * 100)) },
      { label: 'Lounge', value: Math.min(100, lounge * 4) },
      { label: 'Boarding', value: Math.min(100, boarding * 5) },
    ]);

    // 3. Advisor: compare crowding with what the staffed counters can absorb.
    const checkInCapacity = p.checkin_counters * 2;
    const securityCapacity = p.security_counters * 3;
    let advice: SimulationAlert | null = null;
    if (security > securityCapacity) {
      advice = {
        id: `sec-${now}`,
        type: 'risk',
        title: 'Security bottleneck',
        message: `${security} passengers at security against ${p.security_counters} lanes (comfortable load ${securityCapacity}).`,
        suggestion: 'Open another lane or switch to CT scanners (advanced screening).',
        timestamp,
        read: false,
      };
    } else if (checkIn > checkInCapacity) {
      advice = {
        id: `chk-${now}`,
        type: 'bottleneck',
        title: 'Check-in congestion',
        message: `${checkIn} passengers at check-in against ${p.checkin_counters} counters (comfortable load ${checkInCapacity}).`,
        suggestion: 'Staff more counters or move passengers to self-service kiosks.',
        timestamp,
        read: false,
      };
    } else if (satisfaction < 45) {
      advice = {
        id: `sat-${now}`,
        type: 'suggestion',
        title: 'Satisfaction is slipping',
        message: `Predicted satisfaction is ${satisfaction}% with ${queueMinutes} min of queueing and ${delay.toFixed(0)} min of delay.`,
        suggestion: 'Reduce queueing first; delay has a smaller effect in the survey data.',
        timestamp,
        read: false,
      };
    }
    setActiveAdvice(advice);
    if (advice) {
      const current = advice;
      setAlerts((prev) =>
        prev.some((a) => a.title === current.title && !a.read) ? prev : [current, ...prev].slice(0, 10),
      );
    }

    // 4. Chart history.
    const waitTimes = [
      { range: '0-2s', count: 0 },
      { range: '2-5s', count: 0 },
      { range: '5-10s', count: 0 },
      { range: '10s+', count: 0 },
    ];
    for (const agent of agents) {
      const wait = (now - agent.lastStageTime) / 1000;
      waitTimes[wait < 2 ? 0 : wait < 5 ? 1 : wait < 10 ? 2 : 3].count++;
    }
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      const point: ChartPoint = {
        timestamp,
        satisfaction,
        activePassengers: agents.length,
        targetLoad: Math.round(Math.min(MAX_AGENTS, 60 * (1 + p.increase_flights_percent / 100))),
        inflowChange: last ? ((agents.length - last.activePassengers) / (last.activePassengers || 1)) * 100 : 0,
        checkInQueue: checkIn,
        securityQueue: security,
        boardingQueue: boarding,
        waitTimes,
        queueMinutes,
        delayOffset: Number((delay + (Math.random() - 0.5) * 2).toFixed(1)),
      };
      return [...prev, point].slice(-30);
    });

    // 5. Aircraft cycle: board, take off, return.
    planeTimer.current += 1;
    const cycle = 14 + p.delay_offset_minutes / 10 + Math.floor(p.weather_severity / 10);
    const t = planeTimer.current;
    let nextState = { ready: false, flying: false };
    if (t < 8) nextState = { ready: true, flying: false };
    else if (t < 10) nextState = { ready: false, flying: true };
    else if (t >= cycle) {
      planeTimer.current = 0;
      nextState = { ready: true, flying: false };
    }
    planeState.current = nextState;
    setIsPlaneReady(nextState.ready);
    setIsFlying(nextState.flying);
  }, [simParams]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [isPlaying, tick]);

  const resetEnvironment = useCallback(() => {
    setIsResetting(true);
    passengersRef.current = [];
    planeTimer.current = 0;
    planeState.current = { ready: true, flying: false };
    setPassengers([]);
    setHistory([]);
    setAlerts([]);
    setActiveAdvice(null);
    setIsPlaneReady(true);
    setIsFlying(false);
    setSimParams(DEFAULT_PARAMS);
    setTimeout(() => setIsResetting(false), 400);
  }, []);

  const runScenario = useCallback((params: Partial<SimulationParams>) => {
    setIsResetting(true);
    setSimParams((prev) => ({ ...prev, ...params }));
    setTimeout(() => setIsResetting(false), 400);
  }, []);

  const value = useMemo<SimulationContextType>(
    () => ({
      metrics,
      history,
      alerts,
      activeAdvice,
      congestion,
      passengers,
      activeStage: 0,
      isFlying,
      isPlaneReady,
      isPlaying,
      isResetting,
      simParams,
      setIsPlaying,
      markAlertAsRead: (id: string) => setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a))),
      clearAlerts: () => setAlerts([]),
      resetEnvironment,
      runScenario,
    }),
    [metrics, history, alerts, activeAdvice, congestion, passengers, isFlying, isPlaneReady, isPlaying, isResetting, simParams, resetEnvironment, runScenario],
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation(): SimulationContextType {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('useSimulation must be used within a SimulationProvider');
  return context;
}
