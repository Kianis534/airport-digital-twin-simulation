"use client";

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GEO, type Placement, type Vec3 } from './assets';

const _obj = new THREE.Object3D();

/**
 * Many copies of one geometry/material in a single draw call. Matrices are written once
 * (or when placements change), so static instances cost nothing per frame.
 */
export function StaticInstances({
  geometry,
  material,
  placements,
  castShadow = false,
  receiveShadow = false,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  placements: Placement[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const capacity = Math.max(1, placements.length);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    placements.forEach((p, i) => {
      _obj.position.set(...p.position);
      _obj.rotation.set(...(p.rotation ?? [0, 0, 0]));
      _obj.scale.set(...(p.scale ?? [1, 1, 1]));
      _obj.updateMatrix();
      mesh.setMatrixAt(i, _obj.matrix);
    });
    mesh.count = placements.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [placements]);

  return (
    <instancedMesh
      key={capacity}
      ref={ref}
      args={[geometry, material, capacity]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

/** A single scaled box/plane using the shared unit geometry. */
export function Block({
  position,
  size,
  material,
  rotation,
  castShadow,
  receiveShadow,
  geometry = GEO.box,
}: {
  position: Vec3;
  size: Vec3;
  material: THREE.Material;
  rotation?: Vec3;
  castShadow?: boolean;
  receiveShadow?: boolean;
  geometry?: THREE.BufferGeometry;
}) {
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      scale={size}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

/** Flat ground patch (unit plane rotated to lie on the floor). */
export function Ground({ position, size, material }: { position: Vec3; size: [number, number]; material: THREE.Material }) {
  return (
    <mesh
      geometry={GEO.plane}
      material={material}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[size[0], size[1], 1]}
      receiveShadow
    />
  );
}

const labelCache = new Map<string, { texture: THREE.CanvasTexture; aspect: number }>();

function labelTexture(text: string, background: string, color: string) {
  const key = `${text}|${background}|${color}`;
  const cached = labelCache.get(key);
  if (cached) return cached;
  const font = 'bold 44px Inter, "Segoe UI", Arial, sans-serif';
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = font;
  const width = Math.ceil(measure.measureText(text).width + 56);
  const height = 76;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(2, 2, width - 4, height - 4, 20);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, width / 2, height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const entry = { texture, aspect: width / height };
  labelCache.set(key, entry);
  return entry;
}

/**
 * Camera-facing text label rendered to a texture once. Unlike DOM overlays, it costs
 * nothing per frame beyond one sprite draw.
 */
export function Label({
  text,
  position,
  height = 2,
  background = '#2563eb',
  color = '#ffffff',
}: {
  text: string;
  position: Vec3;
  height?: number;
  background?: string;
  color?: string;
}) {
  const { texture, aspect } = useMemo(() => labelTexture(text, background, color), [text, background, color]);
  const material = useMemo(
    () => new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
    [texture],
  );
  return <sprite material={material} position={position} scale={[height * aspect, height, 1]} renderOrder={10} />;
}
