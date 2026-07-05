"use client";

import { useEffect, useMemo } from "react";
import { getDetailTextures, repeated } from "@/lib/textures";
import type { ChunkData } from "./generateWorld";
import { buildChunkGeometry } from "./terrain";

/**
 * One static chunk tile of the endless heightfield. The ground never moves —
 * hills and slopes come from the baked heights, and the same CPU height
 * function is what the player walks on.
 */
export function TerrainMesh({ world }: { world: ChunkData }) {
  const geometry = useMemo(
    () => buildChunkGeometry(world.seedNum, world.palette, world.cx, world.cz),
    [world.seedNum, world.palette, world.cx, world.cz]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  // ~5m per texture tile.
  const groundMap = useMemo(
    () => repeated(getDetailTextures(world.seedNum).ground, 24, 24),
    [world.seedNum]
  );

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        flatShading
        roughness={1}
        map={groundMap}
        bumpMap={groundMap}
        bumpScale={0.5}
      />
    </mesh>
  );
}
