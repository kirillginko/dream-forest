"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getDetailTextures, repeated } from "@/lib/textures";
import type { WorldData } from "../world/generateWorld";
import { setInstances } from "./instancing";

/**
 * Instanced low-poly trees: living trees (trunk + two stacked canopy cones)
 * and bare dead trees. Instances sit at world coordinates, so per-mesh
 * frustum culling is disabled — chunk lifetime handles visibility.
 */
export function Trees({ world }: { world: WorldData }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const canopyLow = useRef<THREE.InstancedMesh>(null);
  const canopyHigh = useRef<THREE.InstancedMesh>(null);
  const dead = useRef<THREE.InstancedMesh>(null);

  const { trees, deadTrees, palette } = world;

  const maps = useMemo(() => {
    const d = getDetailTextures(world.seedNum);
    return {
      bark: repeated(d.bark, 1, 3),
      foliage: repeated(d.foliage, 2, 1),
    };
  }, [world.seedNum]);

  useLayoutEffect(() => {
    if (!trunks.current || !canopyLow.current || !canopyHigh.current || !dead.current)
      return;
    const vary =
      (base: string, spread: number) => (p: { variant: number }, c: THREE.Color) =>
        c.set(base).offsetHSL(0, 0, (p.variant - 0.5) * spread);

    setInstances(
      trunks.current,
      trees,
      (p, o) => {
        o.scale.set(p.scale * 0.9, p.scale * 4.2, p.scale * 0.9);
        o.translateY(p.scale * 2.1);
      },
      vary(palette.trunk, 0.1)
    );
    setInstances(
      canopyLow.current,
      trees,
      (p, o) => {
        o.scale.setScalar(p.scale * 2.4);
        o.translateY(p.scale * 4.6);
      },
      vary(palette.canopy, 0.16)
    );
    setInstances(
      canopyHigh.current,
      trees,
      (p, o) => {
        o.scale.setScalar(p.scale * 1.5);
        o.translateY(p.scale * 6.4);
      },
      vary(palette.canopy, 0.2)
    );
    setInstances(
      dead.current,
      deadTrees,
      (p, o) => {
        o.scale.set(p.scale * 0.55, p.scale * 5.0, p.scale * 0.55);
        o.translateY(p.scale * 2.5);
      },
      vary(palette.deadTree, 0.12)
    );
  }, [trees, deadTrees, palette]);

  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.14, 0.3, 1, 5]} />
        <meshStandardMaterial flatShading roughness={1} map={maps.bark} />
      </instancedMesh>
      <instancedMesh ref={canopyLow} args={[undefined, undefined, trees.length]} frustumCulled={false}>
        <coneGeometry args={[1, 1.6, 6]} />
        <meshStandardMaterial flatShading roughness={1} map={maps.foliage} />
      </instancedMesh>
      <instancedMesh ref={canopyHigh} args={[undefined, undefined, trees.length]} frustumCulled={false}>
        <coneGeometry args={[0.8, 1.4, 5]} />
        <meshStandardMaterial flatShading roughness={1} map={maps.foliage} />
      </instancedMesh>
      <instancedMesh ref={dead} args={[undefined, undefined, deadTrees.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.05, 0.28, 1, 5]} />
        <meshStandardMaterial flatShading roughness={1} map={maps.bark} />
      </instancedMesh>
    </group>
  );
}
