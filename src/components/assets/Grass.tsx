"use client";

import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { WorldData } from "../world/generateWorld";
import { setInstances } from "./instancing";

/**
 * Instanced grass tufts — one draw call for the whole meadow. Deliberately
 * static: the ground should feel like a floor, not a sea.
 */
export function Grass({ world }: { world: WorldData }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { grass, palette } = world;

  useLayoutEffect(() => {
    if (!mesh.current) return;
    const base = new THREE.Color(palette.ground[1]);
    const glow = new THREE.Color(palette.glow);
    setInstances(
      mesh.current,
      grass,
      (p, o) => {
        o.scale.set(p.scale * 0.12, p.scale * 0.5, p.scale * 0.12);
        o.translateY(p.scale * 0.24);
      },
      (p, c) => {
        c.copy(base).offsetHSL(0, 0.04, (p.variant - 0.5) * 0.12);
        // The odd tuft catches the sickly glow.
        if (p.variant > 0.94) c.lerp(glow, 0.45);
      }
    );
  }, [grass, palette]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, grass.length]} frustumCulled={false}>
      <coneGeometry args={[1, 1, 4]} />
      <meshStandardMaterial flatShading roughness={1} />
    </instancedMesh>
  );
}
