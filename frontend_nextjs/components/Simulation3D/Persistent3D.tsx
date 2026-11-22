"use client";

// Keeps one 3D scene alive across page navigations.
//
// Creating a WebGL renderer, building the scene and compiling shaders takes ~200 ms. Instead of
// paying that every time the 3D Twin page opens, the scene is initialised once (in the
// background when the browser is idle, or immediately on a direct visit) inside an off-screen
// holder. When the 3D page mounts its <Scene3DSlot>, the live canvas element is moved into the
// slot, which costs one frame. While no slot is mounted the render loop is stopped.

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import type { Scene3DProps } from './Simulation3DCanvas';

const slotStore = {
  element: null as HTMLElement | null,
  openedAt: 0,
  listeners: new Set<() => void>(),
  set(element: HTMLElement | null) {
    slotStore.element = element;
    slotStore.openedAt = element ? performance.now() : 0;
    slotStore.listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    slotStore.listeners.add(listener);
    return () => slotStore.listeners.delete(listener);
  },
};

const useSlot = () => useSyncExternalStore(slotStore.subscribe, () => slotStore.element, () => null);

/** The element the scene is portalled into; created on first use, client side only. */
let hostElement: HTMLDivElement | null = null;
function getHost(): HTMLDivElement {
  if (!hostElement) {
    hostElement = document.createElement('div');
    hostElement.style.cssText = 'width:100%;height:100%';
  }
  return hostElement;
}

let modulePromise: Promise<ComponentType<Scene3DProps>> | null = null;
function loadScene() {
  modulePromise ??= import('./Simulation3DCanvas').then((m) => m.default);
  return modulePromise;
}

/** Placeholder on the 3D Twin page; the persistent canvas is moved into it. */
export function Scene3DSlot({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    slotStore.set(ref.current);
    return () => slotStore.set(null);
  }, []);
  return <div ref={ref} className={className} />;
}

/** Mounted once in the site layout. */
export function Persistent3DHost() {
  const slot = useSlot();
  const [Scene, setScene] = useState<ComponentType<Scene3DProps> | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const wanted = Boolean(slot);

  // Load and initialise the scene when idle, or right away if the 3D page is open.
  useEffect(() => {
    let cancelled = false;
    const start = () => void loadScene().then((C) => !cancelled && setScene(() => C));
    if (wanted) {
      start();
      return () => {
        cancelled = true;
      };
    }
    const idle = window.requestIdleCallback?.(start, { timeout: 4000 }) ?? window.setTimeout(start, 2000);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [wanted]);

  // Move the live canvas between the off-screen holder and the page slot.
  useLayoutEffect(() => {
    if (!Scene) return;
    const host = getHost();
    const target = slot ?? holder.current;
    if (target && host.parentElement !== target) target.appendChild(host);
  }, [slot, Scene]);

  return (
    <>
      <div
        ref={holder}
        aria-hidden="true"
        style={{ position: 'fixed', left: -20000, top: 0, width: 1200, height: 560, pointerEvents: 'none' }}
      />
      {Scene && createPortal(<Scene active={Boolean(slot)} openedAt={slot ? slotStore.openedAt : null} />, getHost())}
    </>
  );
}
