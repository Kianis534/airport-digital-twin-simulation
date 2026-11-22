"use client";

// The static terminal: grounds, fences, road, parking, terminal building, check-in islands,
// security lanes, lounge and runway. Repeated objects are instanced so the whole site renders
// in a few dozen draw calls instead of hundreds.

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useSimulation } from '@/context/SimulationContext';
import { GEO, MAT, applyNightMode, type Placement, type Vec3 } from './assets';
import { Block, Ground, Label, StaticInstances } from './primitives';

const TREE_SPOTS: Vec3[] = [
  [-120, 0, -100], [-120, 0, 100], [100, 0, -100], [100, 0, 100], [-40, 0, 110],
  [-40, 0, -110], [30, 0, 110], [30, 0, -110], [-130, 0, 0], [110, 0, 0],
];

const POLE_SPOTS: Vec3[] = [
  ...Array.from({ length: 6 }, (_, i): Vec3 => [-136, 0, (i - 2.5) * 40]),
  [-85, 0, 25], [-85, 0, -25], [-65, 0, 15], [-65, 0, -15],
  ...Array.from({ length: 8 }, (_, i): Vec3[] => [[50, 0, i * 30 - 130], [90, 0, i * 30 - 130]]).flat(),
  ...Array.from({ length: 4 }, (_, i): Vec3 => [-138, 0, (i - 1.5) * 80]),
  ...Array.from({ length: 4 }, (_, i): Vec3 => [118, 0, (i - 1.5) * 80]),
  ...Array.from({ length: 4 }, (_, i): Vec3[] => [[(i - 1.5) * 80, 0, -128], [(i - 1.5) * 80, 0, 128]]).flat(),
];

const FENCES: Array<{ center: Vec3; alongX: boolean; length: number }> = [
  { center: [-140, 0, 0], alongX: false, length: 260 },
  { center: [-10, 0, -130], alongX: true, length: 260 },
  { center: [-10, 0, 130], alongX: true, length: 260 },
  { center: [120, 0, 0], alongX: false, length: 260 },
];

const CARS: Array<{ position: Vec3; color: string }> = [
  { position: [-100, 0, -25], color: '#ef4444' },
  { position: [-90, 0, -15], color: '#3b82f6' },
  { position: [-97, 0, 5], color: '#10b981' },
  { position: [-89, 0, 20], color: '#f59e0b' },
];
const CAR_MATERIALS = new Map(CARS.map((c) => [c.color, new THREE.MeshLambertMaterial({ color: c.color })]));

function offset(base: Vec3, dx: number, dy: number, dz: number): Vec3 {
  return [base[0] + dx, base[1] + dy, base[2] + dz];
}

/** Grid layout used by the original scene for counters and lanes. */
function gridSpots(count: number, perRow: number, rowStep: number, colStep: number, origin: Vec3): Vec3[] {
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const inRow = Math.min(perRow, count - row * perRow);
    return offset(origin, row * -rowStep, 0, (col - (inRow - 1) / 2) * colStep);
  });
}

function useStaticSite() {
  return useMemo(() => {
    const trunks: Placement[] = TREE_SPOTS.map((p) => ({ position: offset(p, 0, 2, 0), scale: [1.2, 4, 1.2] }));
    const crowns: Placement[] = TREE_SPOTS.map((p) => ({ position: offset(p, 0, 6.5, 0), scale: [7, 7, 7] }));
    const tops: Placement[] = TREE_SPOTS.map((p) => ({ position: offset(p, 0, 10, 0), scale: [5, 5, 5] }));

    const poles: Placement[] = POLE_SPOTS.map((p) => ({ position: offset(p, 0, 4, 0), scale: [0.25, 8, 0.25] }));
    const arms: Placement[] = POLE_SPOTS.map((p) => ({ position: offset(p, 0.5, 7.8, 0), scale: [1, 0.1, 0.2], rotation: [0, 0, Math.PI / 4] }));
    const heads: Placement[] = POLE_SPOTS.map((p) => ({ position: offset(p, 1, 7.5, 0), scale: [0.6, 0.2, 0.8] }));

    const posts: Placement[] = [];
    const rails: Placement[] = [];
    for (const f of FENCES) {
      const n = Math.floor(f.length / 5) + 1;
      for (let i = 0; i < n; i++) {
        const d = i * 5 - f.length / 2;
        posts.push({ position: f.alongX ? offset(f.center, d, 4, 0) : offset(f.center, 0, 4, d), scale: [0.2, 8, 0.2] });
      }
      for (const y of [3, 7.6]) {
        rails.push({ position: offset(f.center, 0, y, 0), scale: f.alongX ? [f.length, 0.12, 0.12] : [0.12, 0.12, f.length] });
      }
    }

    const roadDashes: Placement[] = Array.from({ length: 10 }, (_, i) => ({
      position: [-125, 0.02, (i - 4.5) * 14] as Vec3,
      scale: [0.5, 6, 1] as Vec3,
      rotation: [-Math.PI / 2, 0, 0] as Vec3,
    }));
    const curbYellow: Placement[] = [];
    const curbBlack: Placement[] = [];
    for (const x of [-135.2, -114.8]) {
      for (let i = 0; i < 70; i++) {
        (i % 2 === 0 ? curbYellow : curbBlack).push({ position: [x, 0.25, i * 2 - 70], scale: [0.5, 0.5, 2] });
      }
    }

    const parkingLines: Placement[] = Array.from({ length: 6 }, (_, i) => ({
      position: [-95, 0.02, (i - 2.5) * 10] as Vec3,
      scale: [22, 0.2, 1] as Vec3,
      rotation: [-Math.PI / 2, 0, 0] as Vec3,
    }));
    const wheels: Placement[] = CARS.flatMap((c) =>
      [[-1.2, 0.9], [1.2, 0.9], [-1.2, -0.9], [1.2, -0.9]].map(([dx, dz]) => ({
        position: offset(c.position, dx, 0.3, dz),
        scale: [0.6, 0.4, 0.6] as Vec3,
        rotation: [Math.PI / 2, 0, 0] as Vec3,
      })),
    );
    const trackStripes: Placement[] = Array.from({ length: 16 }, (_, i) => ({
      position: [-95, 0.06, (i - 7.5) * 5] as Vec3,
      scale: [6, 1, 1] as Vec3,
      rotation: [-Math.PI / 2, 0, 0] as Vec3,
    }));

    const seats: Placement[] = [];
    const backs: Placement[] = [];
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 6; i++) {
        const x = 22 + (row - 1) * 6;
        const z = (i - 2.5) * 6;
        seats.push({ position: [x, 0.35, z], scale: [2, 0.5, 2] });
        backs.push({ position: [x + (row % 2 === 0 ? -0.8 : 0.8), 0.95, z], scale: [0.15, 1.2, 2] });
      }
    }

    const runwayMarks: Placement[] = Array.from({ length: 15 }, (_, i) => ({
      position: [70, 0.02, i * 12 - 130] as Vec3,
      scale: [0.8, 6, 1] as Vec3,
      rotation: [-Math.PI / 2, 0, 0] as Vec3,
    }));

    return { trunks, crowns, tops, poles, arms, heads, posts, rails, roadDashes, curbYellow, curbBlack, parkingLines, wheels, trackStripes, seats, backs, runwayMarks };
  }, []);
}

function CheckInIslands({ counters }: { counters: number }) {
  const parts = useMemo(() => {
    const domestic = gridSpots(Math.ceil(counters / 2), 5, 6, 6, [-40, 0, 25]);
    const international = gridSpots(Math.floor(counters / 2), 5, 6, 6, [-40, 0, -25]);
    const all = [...domestic, ...international];
    return {
      domestic,
      international,
      bodies: all.map((p) => ({ position: offset(p, 0, 0.6, 0), scale: [2, 1.2, 3.5] as Vec3 })),
      tops: all.map((p) => ({ position: offset(p, 0, 1.25, 0), scale: [2.1, 0.1, 3.6] as Vec3 })),
      signs: all.map((p) => ({ position: offset(p, -0.8, 1.8, 0), scale: [0.1, 1, 1.5] as Vec3 })),
      belts: all.map((p) => ({ position: offset(p, 0, 0.2, 2.2), scale: [1.8, 0.2, 1.5] as Vec3 })),
    };
  }, [counters]);

  return (
    <group>
      <StaticInstances geometry={GEO.box} material={MAT.counter} placements={parts.bodies} castShadow />
      <StaticInstances geometry={GEO.box} material={MAT.steel} placements={parts.tops} />
      <StaticInstances geometry={GEO.box} material={MAT.dark} placements={parts.signs} />
      <StaticInstances geometry={GEO.box} material={MAT.pavingLight} placements={parts.belts} />
      {parts.domestic.map((p, i) => (
        <Label key={`d${i}`} text={`D${i + 1}`} position={offset(p, -0.8, 3, 0)} height={0.9} background="#2563eb" />
      ))}
      {parts.international.map((p, i) => (
        <Label key={`i${i}`} text={`I${i + 1}`} position={offset(p, -0.8, 3, 0)} height={0.9} background="#4338ca" />
      ))}
      <Label text="DOMESTIC CHECK-IN" position={[-40, 6, 25]} height={1.8} background="#2563eb" />
      <Label text="INTERNATIONAL CHECK-IN" position={[-40, 6, -25]} height={1.8} background="#3730a3" />
    </group>
  );
}

function SecurityLanes({ lanes }: { lanes: number }) {
  const p = useMemo(() => {
    const spots = gridSpots(lanes, 6, 8, 12, [-15, 0, 0]);
    const tilt: Vec3 = [-Math.PI / 6, 0, 0];
    return {
      conveyors: spots.map((s) => ({ position: offset(s, 0, 0.4, 0), scale: [8, 0.2, 2.5] as Vec3 })),
      rollers: spots.flatMap((s) =>
        Array.from({ length: 8 }, (_, i) => ({
          position: offset(s, i - 3.5, 0.3, 0),
          scale: [0.2, 2.4, 0.2] as Vec3,
          rotation: [Math.PI / 2, 0, 0] as Vec3,
        })),
      ),
      shells: spots.map((s) => ({ position: offset(s, 0, 1.2, 0), scale: [3.5, 1.8, 3] as Vec3 })),
      plates: spots.map((s) => ({ position: offset(s, 0, 2.15, 0), scale: [3.6, 0.1, 3.1] as Vec3 })),
      tunnels: spots.map((s) => ({ position: offset(s, 0, 1.1, 0), scale: [3.55, 1.4, 2.4] as Vec3 })),
      panels: spots.flatMap((s) => [-1.55, 1.55].map((x) => ({ position: offset(s, x, 1.2, 0), scale: [0.05, 1.2, 2.8] as Vec3 }))),
      monitors: spots.map((s) => ({ position: offset(s, 0, 2.4, 1.2), scale: [1.2, 0.8, 0.1] as Vec3, rotation: tilt })),
      screens: spots.map((s) => ({ position: offset(s, 0, 2.43, 1.252), scale: [1, 0.6, 0.02] as Vec3, rotation: tilt })),
      pillars: spots.flatMap((s) => [1.2, -1.2].map((z) => ({ position: offset(s, -3.5, 1, z), scale: [0.4, 3, 0.4] as Vec3 }))),
      arches: spots.map((s) => ({ position: offset(s, -3.5, 2.5, 0), scale: [0.4, 0.4, 2.8] as Vec3 })),
    };
  }, [lanes]);

  return (
    <group>
      <StaticInstances geometry={GEO.box} material={MAT.seat} placements={p.conveyors} receiveShadow />
      <StaticInstances geometry={GEO.cylinder} material={MAT.steel} placements={p.rollers} />
      <StaticInstances geometry={GEO.box} material={MAT.steelLight} placements={p.shells} castShadow />
      <StaticInstances geometry={GEO.box} material={MAT.wallLight} placements={p.plates} />
      <StaticInstances geometry={GEO.box} material={MAT.scannerGlow} placements={p.tunnels} />
      <StaticInstances geometry={GEO.box} material={MAT.steel} placements={p.panels} />
      <StaticInstances geometry={GEO.box} material={MAT.dark} placements={p.monitors} />
      <StaticInstances geometry={GEO.box} material={MAT.screen} placements={p.screens} />
      <StaticInstances geometry={GEO.box} material={MAT.steel} placements={p.pillars} castShadow />
      <StaticInstances geometry={GEO.box} material={MAT.steel} placements={p.arches} castShadow />
      <Label text={`SECURITY · ${lanes} LANE${lanes === 1 ? '' : 'S'}`} position={[-15, 6.5, 0]} height={1.8} background="#0f172a" color="#facc15" />
    </group>
  );
}

export default function Infrastructure() {
  const { simParams } = useSimulation();
  const night = simParams.time_of_day < 6 || simParams.time_of_day > 18;
  const site = useStaticSite();

  useEffect(() => applyNightMode(night), [night]);

  return (
    <group>
      {/* Grounds, trees and perimeter */}
      <Ground position={[-20, -0.05, 0]} size={[260, 260]} material={MAT.grass} />
      <StaticInstances geometry={GEO.cylinder} material={MAT.trunk} placements={site.trunks} castShadow />
      <StaticInstances geometry={GEO.cone} material={MAT.foliageDark} placements={site.crowns} castShadow />
      <StaticInstances geometry={GEO.cone} material={MAT.foliage} placements={site.tops} castShadow />
      <StaticInstances geometry={GEO.cylinder} material={MAT.steel} placements={site.posts} />
      <StaticInstances geometry={GEO.box} material={MAT.steelLight} placements={site.rails} />
      <StaticInstances geometry={GEO.cylinder} material={MAT.steel} placements={site.poles} castShadow />
      <StaticInstances geometry={GEO.box} material={MAT.steel} placements={site.arms} />
      <StaticInstances geometry={GEO.box} material={MAT.lampHead} placements={site.heads} />

      {/* Road, parking and walkway */}
      <Ground position={[-125, 0.01, 0]} size={[20, 140]} material={MAT.asphalt} />
      <StaticInstances geometry={GEO.plane} material={MAT.white} placements={site.roadDashes} />
      <StaticInstances geometry={GEO.box} material={MAT.yellow} placements={site.curbYellow} />
      <StaticInstances geometry={GEO.box} material={MAT.black} placements={site.curbBlack} />
      <Ground position={[-95, 0.01, 0]} size={[25, 60]} material={MAT.paving} />
      <StaticInstances geometry={GEO.plane} material={MAT.yellow} placements={site.parkingLines} />
      {CARS.map((car) => (
        <group key={car.color} position={car.position}>
          <Block position={[0, 0.5, 0]} size={[4, 0.8, 2]} material={CAR_MATERIALS.get(car.color)!} castShadow />
          <Block position={[-0.5, 1.2, 0]} size={[2, 0.6, 1.8]} material={CAR_MATERIALS.get(car.color)!} castShadow />
        </group>
      ))}
      <StaticInstances geometry={GEO.cylinder} material={MAT.black} placements={site.wheels} />
      <Ground position={[-95, 0.05, 0]} size={[8, 80]} material={MAT.paving} />
      <StaticInstances geometry={GEO.plane} material={MAT.pavingLight} placements={site.trackStripes} />
      <Ground position={[-77.5, 0.05, 25]} size={[35, 8]} material={MAT.paving} />
      <Ground position={[-77.5, 0.05, -25]} size={[35, 8]} material={MAT.paving} />

      {/* Terminal building */}
      <Ground position={[-12.5, 0.1, 0]} size={[95, 80]} material={MAT.floor} />
      <Block position={[-12.5, 5, -40]} size={[95, 10, 1.5]} material={MAT.wall} castShadow receiveShadow />
      <Block position={[-12.5, 5, 40]} size={[95, 10, 1.5]} material={MAT.wall} castShadow receiveShadow />
      <Block position={[-60, 5, 0]} size={[1.5, 10, 35]} material={MAT.wallLight} castShadow />
      <Block position={[-60, 5, 36.25]} size={[1.5, 10, 7.5]} material={MAT.wallLight} castShadow />
      <Block position={[-60, 5, -36.25]} size={[1.5, 10, 7.5]} material={MAT.wallLight} castShadow />
      <Block position={[-60, 9, 25]} size={[2, 2, 15]} material={MAT.steel} />
      <Block position={[-60, 9, -25]} size={[2, 2, 15]} material={MAT.steel} />
      {[30, 20, -20, -30].map((z) => (
        <Block key={z} position={[-60, 4, z]} size={[0.2, 8, 5]} material={MAT.glass} />
      ))}
      <Block position={[-40, 8.5, 0]} size={[10, 1, 80]} material={MAT.glass} />
      <Label text="DOMESTIC GATE" position={[-61, 12.5, 25]} height={2.2} background="#2563eb" />
      <Label text="INTERNATIONAL GATE" position={[-61, 12.5, -25]} height={2.2} background="#312e81" />

      <CheckInIslands counters={simParams.checkin_counters || 4} />
      <SecurityLanes lanes={simParams.security_counters} />

      {/* Lounge and boarding gate */}
      <Ground position={[22, 0.12, 0]} size={[26, 76]} material={MAT.floorLounge} />
      <Block position={[9, 4, -23.75]} size={[0.5, 8, 32.5]} material={MAT.wallLight} castShadow />
      <Block position={[9, 4, 23.75]} size={[0.5, 8, 32.5]} material={MAT.wallLight} castShadow />
      <Block position={[9, 7, 0]} size={[0.5, 2, 15]} material={MAT.wallLight} />
      <Block position={[35, 4, -24]} size={[0.5, 8, 32]} material={MAT.glassFaint} />
      <Block position={[35, 4, 24]} size={[0.5, 8, 32]} material={MAT.glassFaint} />
      <Block position={[35, 7, 0]} size={[0.5, 2, 16]} material={MAT.glassFaint} />
      <StaticInstances geometry={GEO.box} material={MAT.seat} placements={site.seats} castShadow />
      <StaticInstances geometry={GEO.box} material={MAT.steel} placements={site.backs} />
      <Label text="LOUNGE" position={[9.5, 9.5, 0]} height={1.6} background="#4f46e5" />
      <Label text="BOARDING GATE" position={[35.5, 9.5, 0]} height={1.6} background="#059669" />

      {/* Runway */}
      <Ground position={[70, 0.01, -50]} size={[40, 220]} material={MAT.asphalt} />
      <StaticInstances geometry={GEO.plane} material={MAT.runwayMark} placements={site.runwayMarks} />
      <Ground position={[52, 0.015, -50]} size={[0.5, 220]} material={MAT.yellow} />
      <Ground position={[88, 0.015, -50]} size={[0.5, 220]} material={MAT.yellow} />
      <Label text="RUNWAY 36L" position={[70, 2, 45]} height={2} background="#0f172a" />
    </group>
  );
}
