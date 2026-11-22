"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, BrainCircuit, CheckCircle2, ChevronDown, ChevronUp, Terminal, Zap } from 'lucide-react';
import { useSimulation } from '@/context/SimulationContext';

type LogType = 'input' | 'check' | 'result' | 'advice';

export default function AIAdvisorPanel() {
  const { activeAdvice, metrics, simParams, history } = useSimulation();
  const [showLogs, setShowLogs] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // A readable trace of what the advisor evaluated on each update, derived from history.
  const logs = useMemo(() => {
    const checkInCap = simParams.checkin_counters * 2;
    const securityCap = simParams.security_counters * 3;
    return history.slice(-20).flatMap((point): { msg: string; type: LogType }[] => {
      const t = point.timestamp;
      const overloaded = point.securityQueue > securityCap ? 'security' : point.checkInQueue > checkInCap ? 'check-in' : null;
      return [
        { msg: `[${t}] crowding: check-in ${point.checkInQueue}/${checkInCap}, security ${point.securityQueue}/${securityCap}`, type: 'input' },
        { msg: `[${t}] queue estimate ${point.queueMinutes.toFixed(1)} min → satisfaction ${point.satisfaction.toFixed(1)}% (XGBoost surface)`, type: 'check' },
        overloaded
          ? { msg: `[${t}] ${overloaded} over comfortable load: recommend more ${overloaded === 'security' ? 'lanes' : 'counters'}`, type: 'advice' }
          : { msg: `[${t}] all stages within comfortable load`, type: 'result' },
      ];
    });
  }, [history, simParams.checkin_counters, simParams.security_counters]);

  useEffect(() => {
    if (showLogs && logRef.current) logRef.current.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs, showLogs]);

  const ring = Math.max(0, Math.min(100, metrics.satisfaction));

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-600 text-white">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">Live advisor</h2>
                <p className="text-sm text-slate-500">Watches stage crowding against staffed capacity</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowLogs((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              <Terminal className="h-3.5 w-3.5" />
              {showLogs ? 'Hide trace' : 'Show trace'}
              {showLogs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {showLogs ? (
              <motion.div key="logs" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div ref={logRef} className="h-56 space-y-1 overflow-y-auto rounded-2xl bg-slate-950 p-4 font-mono text-[11px] leading-relaxed">
                  {logs.map((log, i) => (
                    <p
                      key={i}
                      className={
                        log.type === 'advice' ? 'text-amber-300' : log.type === 'result' ? 'text-emerald-400' : log.type === 'check' ? 'text-brand-300' : 'text-slate-400'
                      }
                    >
                      {log.msg}
                    </p>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div key={activeAdvice?.title ?? 'ok'} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="space-y-3">
                {activeAdvice ? (
                  <>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${activeAdvice.type === 'risk' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                      <AlertTriangle className="h-3.5 w-3.5" /> {activeAdvice.type}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900">{activeAdvice.title}</h3>
                    <p className="max-w-xl text-sm text-slate-600">{activeAdvice.message}</p>
                    <div className="flex items-start gap-2 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 text-sm font-medium text-slate-900">
                      <Zap className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {activeAdvice.suggestion}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Flowing
                    </span>
                    <h3 className="text-xl font-bold text-slate-900">Every stage is within capacity</h3>
                    <p className="max-w-xl text-sm text-slate-600">
                      Staffed counters and lanes are keeping up with arrivals. Try closing security lanes or adding traffic to see the advisor react.
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mx-auto shrink-0 text-center lg:w-48">
          <div className="relative mx-auto h-32 w-32">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r="56" fill="none" stroke="#e2e8f0" strokeWidth="12" />
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="#7c3aed"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={352}
                strokeDashoffset={352 - (352 * ring) / 100}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-slate-900">{Math.round(metrics.satisfaction)}%</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">satisfied</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Predicted share of satisfied passengers</p>
        </div>
      </div>
    </div>
  );
}
