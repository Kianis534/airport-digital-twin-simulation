// Shared geometries and materials for the 3D terminal.
//
// Everything is created once and reused, so the GPU compiles a handful of shader programs
// and React never rebuilds GPU resources on re-render. Lambert shading keeps shaders cheap
// to compile and to run; the scene is stylised, so physically based shading adds nothing.
import * as THREE from 'three';

const lambert = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ color, ...extra });

export const MAT = {
  grass: lambert('#166534'),
  asphalt: lambert('#1e293b'),
  paving: lambert('#475569'),
  pavingLight: lambert('#94a3b8'),
  floor: lambert('#f1f5f9'),
  floorLounge: lambert('#e2e8f0'),
  wall: lambert('#94a3b8'),
  wallLight: lambert('#cbd5e1'),
  steel: lambert('#475569'),
  steelLight: lambert('#94a3b8'),
  dark: lambert('#0f172a'),
  counter: lambert('#f8fafc'),
  seat: lambert('#1e293b'),
  white: lambert('#ffffff'),
  yellow: lambert('#facc15'),
  black: lambert('#111827'),
  glass: lambert('#38bdf8', { transparent: true, opacity: 0.25, depthWrite: false }),
  glassFaint: lambert('#38bdf8', { transparent: true, opacity: 0.12, depthWrite: false }),
  scannerGlow: lambert('#0ea5e9', { emissive: new THREE.Color('#38bdf8'), emissiveIntensity: 0.4, transparent: true, opacity: 0.35 }),
  lampHead: lambert('#1e293b', { emissive: new THREE.Color('#fbbf24'), emissiveIntensity: 0 }),
  runwayMark: lambert('#ffffff', { emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.3 }),
  screen: lambert('#022c22', { emissive: new THREE.Color('#22c55e'), emissiveIntensity: 0.3 }),
  trunk: lambert('#78350f'),
  foliage: lambert('#15803d'),
  foliageDark: lambert('#166534'),
  fuselage: lambert('#f8fafc'),
  wing: lambert('#e2e8f0'),
  tail: lambert('#7c3aed'),
  engine: lambert('#94a3b8'),
  window: lambert('#0f172a'),
  domestic: lambert('#2563eb'),
  international: lambert('#7c3aed'),
  skin: lambert('#f2c9a0'),
};

/** Materials whose glow changes between day and night. */
export function applyNightMode(night: boolean): void {
  // Interior lighting at night is suggested by self-lit floors rather than extra lights,
  // so the shader programs stay the same between day and night.
  MAT.floor.emissive.set(night ? '#fde68a' : '#000000');
  MAT.floor.emissiveIntensity = night ? 0.18 : 0;
  MAT.floorLounge.emissive.set(night ? '#fde68a' : '#000000');
  MAT.floorLounge.emissiveIntensity = night ? 0.15 : 0;
  MAT.lampHead.emissiveIntensity = night ? 3 : 0;
  MAT.runwayMark.emissiveIntensity = night ? 2.5 : 0.3;
  MAT.scannerGlow.emissiveIntensity = night ? 1.5 : 0.4;
  MAT.screen.emissiveIntensity = night ? 0.9 : 0.3;
}

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  sphere: new THREE.SphereGeometry(0.5, 12, 8),
  body: new THREE.CapsuleGeometry(0.32, 0.9, 3, 8),
  head: new THREE.SphereGeometry(0.24, 10, 8),
};

export type Vec3 = [number, number, number];

export interface Placement {
  position: Vec3;
  scale?: Vec3;
  rotation?: Vec3;
}
