"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Canvas, addAfterEffect, addEffect, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars } from '@react-three/drei';
import { Maximize2 } from 'lucide-react';
import { useSimulation } from '@/context/SimulationContext';
import Aircraft from './Aircraft';
import Crowd from './Crowd';
import Infrastructure from './Infrastructure';

export interface Scene3DProps {
  /** True while the scene is on screen (inside the 3D Twin page). */
  active: boolean;
  /** performance.now() when the 3D Twin page attached the scene, or null when hidden. */
  openedAt: number | null;
}

export interface RenderStats {
  /** Scene mount → first rendered frame: renderer, scene build, shader compile, first draw (ms). */
  initMs: number | null;
  /** 3D Twin page opened → first frame rendered on screen (ms). */
  openMs: number | null;
  /** Frames per second, from the interval between rendered frames (capped by the display). */
  fps: number;
  /** CPU time per frame for scene updates and render submission, averaged over 60 frames (ms). */
  workMs: number;
  drawCalls: number;
  triangles: number;
}

/** Tiny external store so updating the overlay never re-renders the 3D scene. */
const statsStore = {
  value: null as RenderStats | null,
  listeners: new Set<() => void>(),
  set(next: RenderStats) {
    statsStore.value = next;
    statsStore.listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    statsStore.listeners.add(listener);
    return () => statsStore.listeners.delete(listener);
  },
};

const useRenderStats = () => useSyncExternalStore(statsStore.subscribe, () => statsStore.value, () => null);

/** Reads timings from the renderer itself (no estimates). */
function RenderProbe({ mountedAt, openedAt, onFirstFrame }: { mountedAt: number; openedAt: number | null; onFirstFrame: () => void }) {
  const gl = useThree((state) => state.gl);
  const opened = useRef(openedAt);
  const openMeasured = useRef<number | null>(null);

  useEffect(() => {
    opened.current = openedAt;
    if (openedAt !== null) openMeasured.current = null;
  }, [openedAt]);

  useEffect(() => {
    let initMs: number | null = null;
    let frameStart = 0;
    let last = 0;
    let lastReport = 0;
    const intervals: number[] = [];
    const work: number[] = [];
    const push = (list: number[], v: number) => {
      list.push(v);
      if (list.length > 60) list.shift();
    };
    const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;
    const report = (now: number) => {
      lastReport = now;
      statsStore.set({
        initMs,
        openMs: openMeasured.current,
        fps: intervals.length > 5 ? 1000 / mean(intervals) : 0,
        workMs: work.length ? mean(work) : 0,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
      });
    };

    const offBefore = addEffect(() => {
      frameStart = performance.now();
    });
    const offAfter = addAfterEffect(() => {
      const now = performance.now();
      if (initMs === null) {
        initMs = now - mountedAt;
        performance.mark('aerotwin:3d-first-frame');
        onFirstFrame();
      } else if (now - last < 250) {
        // Skip the gap while the loop was paused in the background.
        push(intervals, now - last);
        push(work, now - frameStart);
      }
      if (opened.current !== null && openMeasured.current === null) {
        openMeasured.current = now - opened.current;
        performance.mark('aerotwin:3d-open-frame');
        report(now);
      }
      last = now;
      if (lastReport === 0 || now - lastReport > 500) report(now);
    });
    return () => {
      offBefore();
      offAfter();
    };
  }, [gl, mountedAt, onFirstFrame]);

  return null;
}

/**
 * Compile every shader program in parallel (KHR_parallel_shader_compile) before the first
 * frame. Otherwise WebGL compiles programs one after another inside the first render, which
 * on Windows (ANGLE → Direct3D) dominated start-up time.
 */
function Precompile({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  useLayoutEffect(() => {
    let alive = true;
    const done = () => alive && onReady();
    if (typeof gl.compileAsync === 'function') void gl.compileAsync(scene, camera).then(done, done);
    else {
      gl.compile(scene, camera);
      done();
    }
    return () => {
      alive = false;
    };
  }, [gl, scene, camera, onReady]);
  return null;
}

function StatsOverlay() {
  const stats = useRenderStats();
  return (
    <div
      className="pointer-events-none absolute bottom-5 right-5 rounded-2xl border border-white/40 bg-slate-900/80 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-200 shadow-lg backdrop-blur"
      data-testid="render-stats"
      data-open-ms={stats?.openMs?.toFixed(1)}
      data-init-ms={stats?.initMs?.toFixed(1)}
      data-work-ms={stats?.workMs.toFixed(2)}
      data-fps={stats?.fps.toFixed(1)}
      data-draw-calls={stats?.drawCalls}
    >
      {stats ? (
        <>
          <p>
            opened in <span className="font-bold text-emerald-300">{stats.openMs !== null ? `${stats.openMs.toFixed(0)} ms` : '…'}</span>
            {stats.initMs !== null && <span className="text-slate-400"> · scene set up in {stats.initMs.toFixed(0)} ms</span>}
          </p>
          <p>{stats.fps > 0 ? `${stats.fps.toFixed(0)} fps · ${stats.workMs.toFixed(1)} ms work/frame` : 'measuring frame time…'}</p>
          <p>
            {stats.drawCalls} draw calls · {(stats.triangles / 1000).toFixed(1)}k tris
          </p>
        </>
      ) : (
        <p>starting renderer…</p>
      )}
    </div>
  );
}

export default function Simulation3DCanvas({ active, openedAt }: Scene3DProps) {
  const { passengers, isFlying, isPlaneReady, simParams } = useSimulation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [mountedAt] = useState(() => performance.now());
  const [compiled, setCompiled] = useState(false);
  const [warmFrameDone, setWarmFrameDone] = useState(false);
  const markCompiled = useCallback(() => setCompiled(true), []);
  const markFirstFrame = useCallback(() => setWarmFrameDone(true), []);
  const night = simParams.time_of_day < 6 || simParams.time_of_day > 18;
  // Render continuously while on screen; off screen, render one warm-up frame and then stop.
  const running = compiled && (active || !warmFrameDone);

  const toggleFullScreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) void el.requestFullscreen().catch(() => undefined);
    else void document.exitFullscreen();
  };

  return (
    <div
      ref={containerRef}
      className={`relative h-[560px] w-full overflow-hidden rounded-3xl border border-slate-200 shadow-inner transition-colors duration-700 ${
        night ? 'bg-gradient-to-b from-[#020617] via-[#1e1b4b] to-[#312e81]' : 'bg-gradient-to-b from-[#7dd3fc] via-[#bae6fd] to-[#f0f9ff]'
      }`}
    >
      {/* The sky is a CSS gradient behind a transparent canvas: no sky shader to compile or run. */}
      <Canvas
        shadows="percentage"
        dpr={[1, 1.75]}
        frameloop={running ? 'always' : 'never'}
        // Measure the container immediately; the default 50 ms debounce delayed start-up.
        resize={{ scroll: true, debounce: { scroll: 0, resize: 0 } }}
        gl={{ antialias: true, alpha: true }}
      >
        <PerspectiveCamera makeDefault position={[-100, 60, 100]} fov={45} near={1} far={1500} />
        <OrbitControls enableDamping dampingFactor={0.05} maxPolarAngle={Math.PI / 2.1} minDistance={20} maxDistance={220} />
        {night && <Stars radius={300} depth={60} count={3000} factor={6} saturation={0} fade speed={1} />}

        {/* Fixed light rig (no point lights): day/night only changes intensities, never the shaders. */}
        <hemisphereLight args={['#e0f2fe', '#14532d', night ? 0.25 : 1.1]} />
        <ambientLight intensity={night ? 0.15 : 0.35} />
        <directionalLight
          position={[120, 140, -80]}
          intensity={night ? 0.25 : 1.6}
          color={night ? '#c7d2fe' : '#fffbeb'}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-160}
          shadow-camera-right={160}
          shadow-camera-top={160}
          shadow-camera-bottom={-160}
          shadow-camera-far={500}
          shadow-bias={-0.0005}
        />

        <Infrastructure />
        <Aircraft isFlying={isFlying} isPlaneReady={isPlaneReady} />
        <Crowd />
        <RenderProbe mountedAt={mountedAt} openedAt={openedAt} onFirstFrame={markFirstFrame} />
        <Precompile onReady={markCompiled} />
      </Canvas>

      <button
        type="button"
        onClick={toggleFullScreen}
        className="absolute right-5 top-5 z-10 rounded-xl border border-white/30 bg-white/85 p-2.5 text-slate-600 shadow-md backdrop-blur hover:text-brand-700"
        aria-label="Toggle full screen"
      >
        <Maximize2 className="h-5 w-5" />
      </button>

      <div className="pointer-events-none absolute bottom-5 left-5 rounded-2xl border border-white/40 bg-white/85 px-4 py-3 shadow-lg backdrop-blur">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">In the terminal</p>
        <p className="text-xl font-extrabold tracking-tight text-slate-900">{passengers.length} passengers</p>
        <div className="mt-1 flex gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            domestic
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-violet-600" />
            international
          </span>
        </div>
      </div>

      <StatsOverlay />
    </div>
  );
}
