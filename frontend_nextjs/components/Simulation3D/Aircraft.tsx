"use client";

// Low-poly airliner built from primitives (~600 triangles) instead of a 97k-triangle download.
// Same behaviour as before: parked at the runway while boarding, then takes off down the runway.

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GEO, MAT } from './assets';

const PARKED = new THREE.Vector3(70, 0, 0);

function Airliner() {
  return (
    <group>
      {/* fuselage along +z, nose forward */}
      <mesh geometry={GEO.cylinder} material={MAT.fuselage} rotation={[Math.PI / 2, 0, 0]} scale={[3.2, 26, 3.2]} position={[0, 3, 0]} castShadow />
      <mesh geometry={GEO.sphere} material={MAT.fuselage} scale={[3.2, 3.2, 5]} position={[0, 3, 13]} castShadow />
      <mesh geometry={GEO.cone} material={MAT.fuselage} rotation={[-Math.PI / 2, 0, 0]} scale={[3.2, 6, 3.2]} position={[0, 3.4, -16]} castShadow />
      {/* cockpit windows and cabin stripe */}
      <mesh geometry={GEO.box} material={MAT.window} scale={[2.2, 0.5, 1.2]} position={[0, 3.9, 14.3]} />
      <mesh geometry={GEO.box} material={MAT.window} scale={[3.25, 0.35, 20]} position={[0, 3.6, 0]} />
      {/* wings */}
      <mesh geometry={GEO.box} material={MAT.wing} scale={[30, 0.35, 5]} position={[0, 2.2, 1]} rotation={[0, 0, 0]} castShadow />
      <mesh geometry={GEO.box} material={MAT.wing} scale={[11, 0.25, 2.6]} position={[0, 3.6, -14.5]} castShadow />
      {/* tail fin in brand colour */}
      <mesh geometry={GEO.box} material={MAT.tail} scale={[0.4, 6, 4]} position={[0, 7, -15]} rotation={[0.35, 0, 0]} castShadow />
      {/* engines */}
      {[-7.5, 7.5].map((x) => (
        <mesh key={x} geometry={GEO.cylinder} material={MAT.engine} rotation={[Math.PI / 2, 0, 0]} scale={[1.8, 4.5, 1.8]} position={[x, 1.2, 3]} castShadow />
      ))}
      {/* landing gear */}
      {[[-2.5, -1], [2.5, -1], [0, 10]].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={GEO.cylinder} material={MAT.black} scale={[0.6, 1.6, 0.6]} position={[x, 0.8, z]} />
      ))}
    </group>
  );
}

export default function Aircraft({ isFlying, isPlaneReady }: { isFlying: boolean; isPlaneReady: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const takeoff = useRef({ started: false, distance: 0 });

  useFrame((_, delta) => {
    const plane = ref.current;
    if (!plane) return;
    const step = Math.min(delta, 0.05) * 60; // ~1 unit per frame at 60 fps, independent of frame rate
    if (isFlying) {
      if (!takeoff.current.started) {
        plane.position.copy(PARKED);
        plane.rotation.set(0, Math.PI, 0);
        takeoff.current = { started: true, distance: 0 };
      }
      takeoff.current.distance += 0.8 * step;
      plane.position.z -= 0.8 * step;
      if (takeoff.current.distance > 40) {
        plane.position.y += 0.15 * step;
        plane.rotation.x = Math.min(plane.rotation.x + 0.005 * step, 0.25); // nose up
      }
      plane.visible = takeoff.current.distance < 260;
    } else {
      takeoff.current.started = false;
      plane.visible = isPlaneReady;
      plane.position.copy(PARKED);
      plane.rotation.set(0, Math.PI, 0);
    }
  });

  return (
    <group ref={ref} position={PARKED.toArray()} rotation={[0, Math.PI, 0]}>
      <Airliner />
    </group>
  );
}
