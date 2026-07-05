"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getDetailTextures, repeated } from "@/lib/textures";
import type { Placement, WorldData } from "../world/generateWorld";
import { setInstances } from "./instancing";

/**
 * Stone ruins: freestanding arches (door-with-no-wall dream logic), broken
 * pillars — some toppled — and the ritual stone ring around the clearing.
 */
export function Ruins({ world }: { world: WorldData }) {
  const archParts = useRef<THREE.InstancedMesh>(null);
  const pillars = useRef<THREE.InstancedMesh>(null);
  const circle = useRef<THREE.InstancedMesh>(null);

  const { arches, pillars: pillarData, circleStones, palette } = world;
  const stoneMap = useMemo(
    () => repeated(getDetailTextures(world.seedNum).stone, 1, 1),
    [world.seedNum]
  );

  useLayoutEffect(() => {
    if (!archParts.current || !pillars.current || !circle.current) return;

    // Each arch = left post + right post + lintel, expanded to 3 placements.
    const parts: Placement[] = arches.flatMap((p) => [
      { ...p, variant: 0 },
      { ...p, variant: 1 },
      { ...p, variant: 2 },
    ]);
    setInstances(
      archParts.current,
      parts,
      (p, o) => {
        if (p.variant === 2) {
          o.scale.set(p.scale * 4.4, p.scale * 1.0, p.scale * 1.0);
          o.translateY(p.scale * 5.0);
        } else {
          const side = p.variant === 0 ? -1 : 1;
          o.scale.set(p.scale * 0.9, p.scale * 5.0, p.scale * 0.9);
          o.translateY(p.scale * 2.5);
          o.position.add(
            new THREE.Vector3(side * p.scale * 1.75, 0, 0).applyAxisAngle(
              new THREE.Vector3(0, 1, 0),
              p.rotation
            )
          );
        }
      },
      (p, c) => c.set(palette.stone).offsetHSL(0, 0, (p.variant === 2 ? 0.04 : -0.02))
    );

    setInstances(
      pillars.current,
      pillarData,
      (p, o) => {
        o.scale.set(p.scale * 0.7, p.scale * (2.2 + p.variant * 2.6), p.scale * 0.7);
        o.translateY(p.scale * (1.1 + p.variant * 1.3));
      },
      (p, c) => c.set(palette.stone).offsetHSL(0, 0, (p.variant - 0.5) * 0.12)
    );

    setInstances(
      circle.current,
      circleStones,
      (p, o) => {
        o.scale.set(p.scale * 1.1, p.scale * (3.0 + p.variant * 1.4), p.scale * 0.6);
        o.translateY(p.scale * (1.5 + p.variant * 0.7));
      },
      (p, c) => c.set(palette.stone).offsetHSL(0, 0, (p.variant - 0.5) * 0.1)
    );
  }, [arches, pillarData, circleStones, palette]);

  return (
    <group>
      <instancedMesh ref={archParts} args={[undefined, undefined, arches.length * 3]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial flatShading roughness={1} map={stoneMap} bumpMap={stoneMap} bumpScale={0.3} />
      </instancedMesh>
      <instancedMesh ref={pillars} args={[undefined, undefined, pillarData.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.62, 1, 6]} />
        <meshStandardMaterial flatShading roughness={1} map={stoneMap} bumpMap={stoneMap} bumpScale={0.3} />
      </instancedMesh>
      <instancedMesh ref={circle} args={[undefined, undefined, circleStones.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial flatShading roughness={1} map={stoneMap} bumpMap={stoneMap} bumpScale={0.3} />
      </instancedMesh>
    </group>
  );
}
