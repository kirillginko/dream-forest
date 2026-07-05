"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { audioLevels } from "@/lib/audio";
import { mulberry32 } from "@/lib/seed";
import { playerPos } from "@/lib/store";
import { terrainHeight } from "../world/terrain";
import type { Palette } from "../world/palettes";

const COUNT = 240;
/** The wisp field tiles this far, wrapping around the player as they walk. */
const FIELD = 160;

/** Drifting fog-lights that follow the wanderer. Treble excites them. */
export function Wisps({ seedNum, palette }: { seedNum: number; palette: Palette }) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);

  const { basePositions, phases } = useMemo(() => {
    const rng = mulberry32(seedNum ^ 0x51f5);
    const basePositions = new Float32Array(COUNT * 3);
    const phases = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      basePositions[i * 3] = (rng() - 0.5) * FIELD;
      basePositions[i * 3 + 1] = 0.5 + rng() * 9;
      basePositions[i * 3 + 2] = (rng() - 0.5) * FIELD;
      phases[i] = rng() * Math.PI * 2;
    }
    return { basePositions, phases };
  }, [seedNum]);

  const positions = useMemo(() => basePositions.slice(), [basePositions]);

  useFrame(({ clock }) => {
    if (!points.current) return;
    const t = clock.elapsedTime * (0.4 + audioLevels.treble * 2.2);
    const attr = points.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      const p = phases[i];
      const rawX = basePositions[i * 3] + Math.sin(t * 0.7 + p) * 1.6;
      const rawZ = basePositions[i * 3 + 2] + Math.cos(t * 0.6 + p) * 1.6;
      // Tile the field around the player — no edge, ever.
      const wx = rawX + Math.round((playerPos.x - rawX) / FIELD) * FIELD;
      const wz = rawZ + Math.round((playerPos.z - rawZ) / FIELD) * FIELD;
      arr[i * 3] = wx;
      arr[i * 3 + 1] =
        terrainHeight(wx, wz, seedNum) +
        basePositions[i * 3 + 1] +
        Math.sin(t * 0.5 + p * 2) * 1.2 +
        audioLevels.bass;
      arr[i * 3 + 2] = wz;
    }
    attr.needsUpdate = true;
    if (material.current) {
      material.current.size = 0.28 + audioLevels.treble * 0.5;
      material.current.opacity = 0.5 + audioLevels.treble * 0.5;
    }
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        color={palette.wisp}
        size={0.28}
        sizeAttenuation
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
