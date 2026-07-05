"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { audioLevels } from "@/lib/audio";
import { playerPos, useDreamStore } from "@/lib/store";
import { getDetailTextures, repeated } from "@/lib/textures";
import type { Palette } from "../world/palettes";

const INTERACT_RADIUS = 5.5;

export type CrystalRole = "city" | "return-city" | "return-rift";

function promptFor(role: CrystalRole): string {
  if (role === "return-rift") return "PRESS  E  —  RETURN FROM THE RIFT";
  if (role === "return-city") return "PRESS  E  —  WAKE IN THE FOREST";
  return "PRESS  E  —  ENTER THE NEON DREAM";
}

/**
 * A dream altar. Forest crystals open the neon city; crystals in the city
 * and Rift return the wanderer to the forest.
 */
export function DreamCrystal({
  position,
  palette,
  seedNum,
  role = "city",
}: {
  position: [number, number, number];
  palette: Palette;
  /** World seed number — keys the shared detail-texture cache. */
  seedNum: number;
  role?: CrystalRole;
}) {
  const crystal = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const near = useRef(false);
  const [x, y, z] = position;

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        flatShading: true,
        color: palette.crystal,
        emissive: palette.crystal,
        emissiveIntensity: 1.2,
        roughness: 0.3,
      }),
    [palette]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyE" || !near.current) return;
      const store = useDreamStore.getState();
      if (!store.locked) return;
      if (role === "return-rift") store.returnFromRift();
      else if (role === "return-city") store.returnFromCity();
      else store.enterCity();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Unloading the chunk (or shifting the dream) drops the prompt.
      if (near.current) useDreamStore.getState().setNearInteract(null);
    };
  }, [role]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (crystal.current) {
      crystal.current.position.y =
        y + 2.6 + Math.sin(t * 0.8) * 0.35 + audioLevels.bass * 0.6;
      crystal.current.rotation.y = t * (0.3 + audioLevels.mid * 1.2);
      crystal.current.scale.setScalar(1 + audioLevels.amplitude * 0.25);
    }
    material.emissiveIntensity = 1.0 + audioLevels.amplitude * 2.5;
    if (light.current) light.current.intensity = 20 + audioLevels.amplitude * 80;

    // Proximity prompt — only touch React state on boundary crossings.
    const d = Math.hypot(playerPos.x - x, playerPos.z - z);
    const isNear = d < INTERACT_RADIUS;
    if (isNear !== near.current) {
      near.current = isNear;
      useDreamStore.getState().setNearInteract(isNear ? promptFor(role) : null);
    }
  });

  return (
    <group>
      <mesh ref={crystal} position={[x, y + 2.6, z]} material={material}>
        <octahedronGeometry args={[0.9, 0]} />
      </mesh>
      <pointLight
        ref={light}
        position={[x, y + 3, z]}
        color={palette.crystal}
        intensity={20}
        distance={26}
        decay={1.6}
      />
      <AltarSlab position={position} palette={palette} seedNum={seedNum} />
    </group>
  );
}

function AltarSlab({
  position,
  palette,
  seedNum,
}: {
  position: [number, number, number];
  palette: Palette;
  seedNum: number;
}) {
  const stoneMap = useMemo(
    () => repeated(getDetailTextures(seedNum).stone, 2, 1),
    [seedNum]
  );
  return (
    <mesh position={[position[0], position[1] + 0.3, position[2]]}>
      <cylinderGeometry args={[1.6, 2.1, 0.6, 7]} />
      <meshStandardMaterial
        flatShading
        roughness={1}
        color={palette.stone}
        map={stoneMap}
        bumpMap={stoneMap}
        bumpScale={0.3}
      />
    </mesh>
  );
}
