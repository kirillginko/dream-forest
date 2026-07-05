"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getDetailTextures, repeated } from "@/lib/textures";
import type { WorldData } from "../world/generateWorld";
import { setInstances } from "./instancing";

/** Instanced moss boulders — squashed low-detail dodecahedrons. */
export function Rocks({ world }: { world: WorldData }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { rocks, palette } = world;
  const stoneMap = useMemo(
    () => repeated(getDetailTextures(world.seedNum).stone, 2, 2),
    [world.seedNum]
  );

  useLayoutEffect(() => {
    if (!mesh.current) return;
    setInstances(
      mesh.current,
      rocks,
      (p, o) => {
        o.scale.set(p.scale, p.scale * (0.55 + p.variant * 0.7), p.scale);
        o.translateY(p.scale * 0.25);
      },
      (p, c) => c.set(palette.stone).offsetHSL(0, 0, (p.variant - 0.5) * 0.14)
    );
  }, [rocks, palette]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, rocks.length]} frustumCulled={false}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        flatShading
        roughness={1}
        map={stoneMap}
        bumpMap={stoneMap}
        bumpScale={0.4}
      />
    </instancedMesh>
  );
}
