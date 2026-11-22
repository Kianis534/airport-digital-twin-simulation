"use client";

// Every passenger agent drawn with two instanced meshes (body + head): two draw calls for
// the whole crowd. Positions ease towards the agent's current stage each frame.

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulation, type PassengerAgent, type SimulationParams } from '@/context/SimulationContext';
import { GEO, MAT } from './assets';

const MAX_AGENTS = 160;
const _obj = new THREE.Object3D();
const _target = new THREE.Vector3();

/** Stable per-agent jitter so agents don't stand on exactly the same spot. */
function jitter(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return [((h & 0xffff) / 0xffff - 0.5) * 0.6, (((h >>> 16) & 0xffff) / 0xffff - 0.5) * 0.6];
}

/** Where an agent should stand for its stage (same layout logic as the terminal geometry). */
function stageTarget(agent: PassengerAgent, params: SimulationParams, currentX: number, out: THREE.Vector3) {
  const slot = agent.slotIndex;
  switch (agent.stage) {
    case 0: // kerbside / parking
      return out.set(slot % 2 === 0 ? -85 : -110, 0, ((slot % 15) - 7) * 4);
    case 1: {
      // check-in island for the passenger's flight type
      const domestic = agent.type === 'domestic';
      const counters = params.checkin_counters || 4;
      const count = Math.max(1, domestic ? Math.ceil(counters / 2) : Math.floor(counters / 2));
      const idx = slot % count;
      const row = Math.floor(idx / 5);
      const col = idx % 5;
      const inRow = Math.min(5, count - row * 5);
      return out.set(-40 + row * -6 + 1.8, 0, (domestic ? 25 : -25) + (col - (inRow - 1) / 2) * 6);
    }
    case 2: {
      // queue in front of a security lane
      const lanes = Math.max(1, params.security_counters);
      const lane = slot % lanes;
      const row = Math.floor(lane / 6);
      const col = lane % 6;
      const inRow = Math.min(6, lanes - row * 6);
      const queuePos = Math.floor(slot / lanes);
      return out.set(-15 + row * -8 - 5 - queuePos * 1.6, 0, (col - (inRow - 1) / 2) * 12);
    }
    case 3: // lounge: walk through the entrance, then take a seat
      if (currentX < 9) return out.set(9.5, 0, 0);
      return out.set(22 + ((slot % 3) - 1) * 6, 0, ((Math.floor(slot / 3) % 6) - 2.5) * 6 + 1.2);
    case 4: // boarding gate
      return out.set(36, 0, ((slot % 5) - 2) * 0.8);
    default: // at the aircraft
      return out.set(66, 0, ((slot % 6) - 2.5) * 0.7);
  }
}

export default function Crowd() {
  const { passengers, simParams, isFlying } = useSimulation();
  // One mesh per flight type keeps every instanced mesh on the same shader program
  // (per-instance colours would compile an extra variant).
  const domestic = useRef<THREE.InstancedMesh>(null);
  const international = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const positions = useRef(new Map<string, THREE.Vector3>());

  useFrame((state, delta) => {
    const dom = domestic.current;
    const intl = international.current;
    const h = heads.current;
    if (!dom || !intl || !h) return;
    const known = positions.current;
    const alive = new Set<string>();
    const ease = 1 - Math.pow(0.12, Math.min(delta, 0.1)); // frame-rate independent smoothing
    const t = state.clock.elapsedTime;
    let n = 0;
    let nd = 0;
    let ni = 0;

    for (const agent of passengers) {
      if (n >= MAX_AGENTS) break;
      if (agent.stage >= 6 && isFlying) continue;
      alive.add(agent.id);
      let pos = known.get(agent.id);
      if (!pos) {
        pos = new THREE.Vector3(-110, 0, ((agent.slotIndex % 15) - 7) * 4);
        known.set(agent.id, pos);
      }
      stageTarget(agent, simParams, pos.x, _target);
      const [jx, jz] = jitter(agent.id);
      _target.x += jx;
      _target.z += jz;
      const distance = pos.distanceTo(_target);
      pos.lerp(_target, ease);

      const walking = distance > 0.4;
      const bob = walking ? Math.abs(Math.sin(t * 9 + agent.slotIndex)) * 0.12 : 0;
      const heading = walking ? Math.atan2(_target.x - pos.x, _target.z - pos.z) : 0;

      _obj.position.set(pos.x, 0.77 + bob, pos.z);
      _obj.rotation.set(0, heading, 0);
      _obj.scale.set(1, 1, 1);
      _obj.updateMatrix();
      if (agent.type === 'domestic') dom.setMatrixAt(nd++, _obj.matrix);
      else intl.setMatrixAt(ni++, _obj.matrix);

      _obj.position.y = 1.72 + bob;
      _obj.updateMatrix();
      h.setMatrixAt(n, _obj.matrix);
      n++;
    }

    dom.count = nd;
    intl.count = ni;
    h.count = n;
    dom.instanceMatrix.needsUpdate = true;
    intl.instanceMatrix.needsUpdate = true;
    h.instanceMatrix.needsUpdate = true;
    for (const id of known.keys()) if (!alive.has(id)) known.delete(id);
  });

  return (
    <group>
      <instancedMesh ref={domestic} args={[GEO.body, MAT.domestic, MAX_AGENTS]} castShadow frustumCulled={false} />
      <instancedMesh ref={international} args={[GEO.body, MAT.international, MAX_AGENTS]} castShadow frustumCulled={false} />
      <instancedMesh ref={heads} args={[GEO.head, MAT.skin, MAX_AGENTS]} castShadow frustumCulled={false} />
    </group>
  );
}
