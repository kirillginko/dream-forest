"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { audioLevels } from "@/lib/audio";
import { getDetailTextures, repeated } from "@/lib/textures";
import type { ChunkData } from "../world/generateWorld";

/**
 * Giant glowing beacon mushrooms — primitive silhouettes with an emissive
 * cap driven by the music. Bloom does the light-bleeding; no point lights,
 * so an endless field of chunks stays cheap.
 */
export function GiantMushrooms({ world }: { world: ChunkData }) {
  const { giantMushrooms, palette } = world;

  const maps = useMemo(() => {
    const d = getDetailTextures(world.seedNum);
    return {
      stem: repeated(d.bark, 1, 1),
      cap: repeated(d.cap, 3, 1),
    };
  }, [world.seedNum]);

  // One shared cap material per chunk so the glow is driven in one place.
  const capMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        flatShading: true,
        roughness: 0.9,
        color: palette.mushroomCap,
        emissive: palette.glow,
        emissiveIntensity: 0.5,
        map: maps.cap,
      }),
    [palette, maps]
  );
  const stemMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        flatShading: true,
        roughness: 1,
        color: palette.mushroomStem,
        map: maps.stem,
      }),
    [palette, maps]
  );

  useFrame(() => {
    capMat.emissiveIntensity =
      0.5 + audioLevels.mid * 2.4 + audioLevels.bass * 0.8;
  });

  return (
    <group>
      {giantMushrooms.map((p, i) => (
        <group
          key={i}
          position={p.position}
          rotation={[p.tilt * 0.4, p.rotation, 0]}
          scale={p.scale}
        >
          <mesh position={[0, 1.4, 0]} material={stemMat}>
            <cylinderGeometry args={[0.22, 0.42, 2.8, 6]} />
          </mesh>
          <mesh position={[0, 2.9, 0]} material={capMat}>
            <coneGeometry args={[1.4, 1.2, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
