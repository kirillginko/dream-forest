"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { audioLevels } from "@/lib/audio";
import { mulberry32 } from "@/lib/seed";
import { getDetailTextures } from "@/lib/textures";
import type { ChunkData } from "./generateWorld";
import type { Palette } from "./palettes";
import { CHUNK_SIZE, CLEARING_CENTER, terrainHeight } from "./terrain";

interface CreatureData {
  x: number;
  z: number;
  variant: number;
  scale: number;
  speed: number;
  phase: number;
  radius: number;
}

function creatureSeed(seedNum: number, cx: number, cz: number): number {
  return (
    seedNum ^
    Math.imul(cx + 17, 0x27d4eb2f) ^
    Math.imul(cz - 31, 0x165667b1) ^
    0x7f4a7c15
  ) >>> 0;
}

function generateCreatures(world: ChunkData): CreatureData[] {
  const rng = mulberry32(creatureSeed(world.seedNum, world.cx, world.cz));
  const count = rng() < 0.18 ? 1 : 2;
  const minX = world.cx * CHUNK_SIZE - CHUNK_SIZE / 2 + 12;
  const minZ = world.cz * CHUNK_SIZE - CHUNK_SIZE / 2 + 12;
  const result: CreatureData[] = [];
  let guard = 0;
  while (result.length < count && guard++ < 40) {
    const x = minX + rng() * (CHUNK_SIZE - 24);
    const z = minZ + rng() * (CHUNK_SIZE - 24);
    if (
      world.cx === 0 &&
      world.cz === 0 &&
      Math.hypot(x - CLEARING_CENTER.x, z - CLEARING_CENTER.z) < 18
    ) continue;
    result.push({
      x,
      z,
      variant: Math.floor(rng() * 5),
      scale: 0.75 + rng() * 0.6,
      speed: 0.09 + rng() * 0.12,
      phase: rng() * Math.PI * 2,
      radius: 2.5 + rng() * 5,
    });
  }
  return result;
}

function AntlerSpirit({ palette, seedNum }: { palette: Palette; seedNum: number }) {
  const bark = getDetailTextures(seedNum).bark;
  return (
    <>
      <mesh position={[0, 1.7, 0]} scale={[0.55, 1.55, 0.45]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={palette.trunk} map={bark} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 3.25, 0]} scale={[0.62, 0.75, 0.55]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={palette.deadTree} map={bark} roughness={1} flatShading />
      </mesh>
      {[-1, 1].flatMap((side) => [0, 1, 2].map((branch) => (
        <mesh
          key={`${side}:${branch}`}
          position={[side * (0.45 + branch * 0.25), 3.85 + branch * 0.34, 0]}
          rotation={[0, 0, side * (-0.42 - branch * 0.1)]}
        >
          <coneGeometry args={[0.08, 1.05, 5]} />
          <meshStandardMaterial color={palette.deadTree} />
        </mesh>
      )))}
      {[-0.24, 0.24].map((x) => (
        <mesh key={x} position={[x, 3.38, 0.55]}>
          <sphereGeometry args={[0.09, 7, 5]} />
          <meshBasicMaterial color={palette.glow} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

function MushroomBeast({ palette, seedNum }: { palette: Palette; seedNum: number }) {
  const cap = getDetailTextures(seedNum).cap;
  return (
    <>
      <mesh position={[0, 1.05, 0]} scale={[1.25, 0.75, 1]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={palette.mushroomStem} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 2.0, 0]} scale={[1.65, 0.48, 1.4]}>
        <sphereGeometry args={[1, 10, 5]} />
        <meshStandardMaterial color={palette.mushroomCap} map={cap} emissive={palette.mushroomCap} emissiveIntensity={0.12} roughness={0.9} flatShading />
      </mesh>
      {[-0.72, 0.72].flatMap((x) => [-0.48, 0.48].map((z) => (
        <mesh key={`${x}:${z}`} position={[x, 0.35, z]}>
          <capsuleGeometry args={[0.12, 0.55, 3, 5]} />
          <meshStandardMaterial color={palette.mushroomStem} />
        </mesh>
      )))}
      <mesh position={[0, 1.15, 0.92]} scale={[0.42, 0.12, 0.06]}>
        <sphereGeometry args={[1, 8, 5]} />
        <meshBasicMaterial color="#12080f" />
      </mesh>
    </>
  );
}

function GlowWorm({ palette }: { palette: Palette }) {
  return (
    <group position={[0, 0.55, 0]}>
      {[0, 1, 2, 3, 4].map((segment) => (
        <mesh key={segment} position={[0, Math.sin(segment * 1.4) * 0.13, -segment * 0.42]} scale={1 - segment * 0.1}>
          <dodecahedronGeometry args={[0.48, 0]} />
          <meshStandardMaterial color={palette.glow} emissive={palette.glow} emissiveIntensity={1.1 - segment * 0.12} roughness={0.5} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 0.1, 0.42]} scale={[0.72, 0.6, 0.82]}>
        <dodecahedronGeometry args={[0.65, 0]} />
        <meshStandardMaterial color={palette.crystal} emissive={palette.crystal} emissiveIntensity={0.7} flatShading />
      </mesh>
    </group>
  );
}

function StrangeHound({ palette, seedNum }: { palette: Palette; seedNum: number }) {
  const bark = getDetailTextures(seedNum).bark;
  return (
    <>
      <mesh position={[0, 1.0, 0]} scale={[0.72, 0.68, 1.4]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={palette.deadTree} map={bark} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 1.42, 1.22]} scale={[0.65, 0.75, 0.72]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={palette.trunk} map={bark} roughness={1} flatShading />
      </mesh>
      {[-0.42, 0.42].flatMap((x) => [-0.62, 0.62].map((z) => (
        <mesh key={`${x}:${z}`} position={[x, 0.35, z]}>
          <capsuleGeometry args={[0.12, 0.65, 3, 5]} />
          <meshStandardMaterial color={palette.trunk} />
        </mesh>
      )))}
      <mesh position={[0, 1.25, -1.5]} rotation={[-0.65, 0, 0]}>
        <coneGeometry args={[0.16, 1.4, 5]} />
        <meshStandardMaterial color={palette.deadTree} />
      </mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 1.58, 1.83]}>
          <sphereGeometry args={[0.08, 7, 5]} />
          <meshBasicMaterial color={palette.wisp} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

function FlyingEye({ palette }: { palette: Palette }) {
  return (
    <>
      <mesh scale={[1.15, 0.78, 0.55]}>
        <sphereGeometry args={[1, 12, 7]} />
        <meshStandardMaterial color={palette.mushroomStem} emissive={palette.crystal} emissiveIntensity={0.22} roughness={0.65} flatShading />
      </mesh>
      <mesh position={[0, 0, 0.55]}>
        <sphereGeometry args={[0.42, 10, 6]} />
        <meshBasicMaterial color={palette.crystal} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.86]}>
        <sphereGeometry args={[0.16, 8, 5]} />
        <meshBasicMaterial color="#060409" />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = (index / 6) * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.cos(angle) * 1.25, Math.sin(angle) * 0.85, 0]} rotation={[0, 0, -angle]}>
            <coneGeometry args={[0.08, 0.9, 4]} />
            <meshStandardMaterial color={palette.deadTree} />
          </mesh>
        );
      })}
    </>
  );
}

function Creature({ data, world, palette }: { data: CreatureData; world: ChunkData; palette: Palette }) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const travel = clock.elapsedTime * data.speed + data.phase;
    const x = data.x + Math.cos(travel) * data.radius;
    const z = data.z + Math.sin(travel * 0.79) * data.radius * 0.7;
    const flying = data.variant === 4;
    const ground = terrainHeight(x, z, world.seedNum);
    const y = ground + (flying ? 4.2 + Math.sin(travel * 2.2) * 0.65 : Math.abs(Math.sin(travel * 6)) * 0.1);
    if (root.current) {
      root.current.position.set(x, y, z);
      root.current.rotation.y = Math.atan2(-Math.sin(travel), Math.cos(travel * 0.79));
      root.current.rotation.z = flying ? Math.sin(travel * 1.7) * 0.12 : 0;
      root.current.scale.setScalar(data.scale * (1 + audioLevels.bass * 0.08));
    }
  });
  return (
    <group ref={root}>
      {data.variant === 0 ? <AntlerSpirit palette={palette} seedNum={world.seedNum} /> :
        data.variant === 1 ? <MushroomBeast palette={palette} seedNum={world.seedNum} /> :
          data.variant === 2 ? <GlowWorm palette={palette} /> :
            data.variant === 3 ? <StrangeHound palette={palette} seedNum={world.seedNum} /> :
              <FlyingEye palette={palette} />}
    </group>
  );
}

export function ForestCreatures({ world, palette }: { world: ChunkData; palette: Palette }) {
  const creatures = useMemo(() => generateCreatures(world), [world]);
  return (
    <group>
      {creatures.map((creature, index) => (
        <Creature key={index} data={creature} world={world} palette={palette} />
      ))}
    </group>
  );
}
