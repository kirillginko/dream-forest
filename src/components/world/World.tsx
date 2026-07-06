"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { audioLevels } from "@/lib/audio";
import { playerPos, useDreamStore } from "@/lib/store";
import { addColliders, removeColliders, type Collider } from "@/lib/collision";
import { hashString } from "@/lib/seed";
import { paletteForSeed, RIFT_PALETTE, type Palette } from "./palettes";
import { generateChunk, type ChunkData, type Realm } from "./generateWorld";
import { worldToChunk } from "./terrain";
import { TerrainMesh } from "./TerrainMesh";
import { Trees } from "../assets/Trees";
import { GiantMushrooms } from "../assets/Mushrooms";
import { ModelMushrooms, mushroomColliderRadii } from "../assets/ModelMushrooms";
import { Rocks } from "../assets/Rocks";
import { Grass } from "../assets/Grass";
import { Ruins } from "../assets/Ruins";
import { DreamCrystal, type CrystalRole } from "../assets/DreamCrystal";
import { Shards } from "../assets/Shards";
import { Wisps } from "../assets/Wisps";
import { DreamCity } from "./DreamCity";
import { ForestCreatures } from "./ForestCreatures";
import { DojoMaze } from "./DojoMaze";

const FOREST_FOG_DENSITY = 0.028;
const CHUNK_RING = 1; // 3x3 grid of chunks around the player
// Crossing a chunk boundary can newly require up to 5 tiles at once (a
// diagonal step). Mounting them all in one React commit means one frame
// pays for 5 terrain meshes + their scatter/instancing — the stutter.
// Loading one per frame spreads that cost invisibly across a few frames
// instead, prioritizing whichever tile is closest to the player.
const CHUNKS_PER_FRAME = 1;
const CENTER_CHECK_INTERVAL = 0.2;

/** Fog + sky that ease toward the palette and pulse with the bass. */
function Atmosphere({
  fogColor,
  skyColor,
  baseDensity,
}: {
  fogColor: string;
  skyColor: string;
  baseDensity: number;
}) {
  const scene = useThree((s) => s.scene);
  const targetFog = useMemo(() => new THREE.Color(fogColor), [fogColor]);
  const targetSky = useMemo(() => new THREE.Color(skyColor), [skyColor]);
  const fog = useRef(new THREE.FogExp2(fogColor, baseDensity));

  useEffect(() => {
    scene.fog = fog.current;
  }, [scene]);

  useFrame((_, delta) => {
    const k = Math.min(1, delta * 1.5); // slow dreamy transition
    fog.current.color.lerp(targetFog, k);
    fog.current.density = baseDensity + audioLevels.bass * 0.012 + audioLevels.amplitude * 0.004;
    if (!(scene.background instanceof THREE.Color)) {
      scene.background = new THREE.Color(skyColor);
    }
    scene.background.lerp(targetSky, k);
  });

  return null;
}

const SKY_VERTEX = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A seamless lava-lamp sky. Large color pools drift over the inside of the
// dome, softly merging and separating as their spherical fields overlap.
// Everything is calculated from 3D directions, so there is no UV seam.
const SKY_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uShimmer;
  uniform vec3 uGlow;
  varying vec3 vPos;

  vec3 blobCenter(float t, float phase, float speed, float lift) {
    float azimuth = phase + sin(t * speed * 0.71 + phase) * 1.8;
    float y = sin(t * speed + phase * 1.37) * 0.52 + lift;
    float radius = sqrt(max(0.05, 1.0 - y * y));
    return normalize(vec3(cos(azimuth) * radius, y, sin(azimuth) * radius));
  }

  // Cycles smoothly through all four palette colors in a loop.
  vec3 cycleColor(float t) {
    float phase = fract(t) * 4.0;
    float seg = floor(phase);
    float f = smoothstep(0.0, 1.0, fract(phase));
    if (seg < 1.0) return mix(uHorizon, uShimmer, f);
    if (seg < 2.0) return mix(uShimmer, uGlow, f);
    if (seg < 3.0) return mix(uGlow, uZenith, f);
    return mix(uZenith, uHorizon, f);
  }

  void main() {
    vec3 dir = normalize(vPos);
    float time = uTime * 0.075;

    // Bend the sampling direction so the pools stretch and wobble instead
    // of reading as perfect circles.
    vec3 warped = normalize(dir + vec3(
      sin(dir.y * 5.0 + time * 0.73),
      sin(dir.z * 4.0 - time * 0.51),
      sin(dir.x * 6.0 + time * 0.39)
    ) * 0.075);

    vec3 p1 = blobCenter(time, 0.2, 0.83, 0.18);
    vec3 p2 = blobCenter(time, 2.1, 0.61, 0.02);
    vec3 p3 = blobCenter(time, 4.4, 0.97, 0.26);
    vec3 p4 = blobCenter(time, 5.8, 0.49, -0.10);

    // Overlapping fields create the soft necks and unions of a lava lamp.
    // A wider second threshold gives every pool a faint luminous rim.
    float fieldA = pow(max(0.0, dot(warped, p1)), 5.0)
                 + pow(max(0.0, dot(warped, p2)), 6.0);
    float fieldB = pow(max(0.0, dot(warped, p3)), 5.5)
                 + pow(max(0.0, dot(warped, p4)), 6.5);
    float poolA = smoothstep(0.30, 0.58, fieldA);
    float poolB = smoothstep(0.26, 0.54, fieldB);
    float rimA = smoothstep(0.18, 0.34, fieldA) - smoothstep(0.48, 0.68, fieldA);
    float rimB = smoothstep(0.16, 0.32, fieldB) - smoothstep(0.46, 0.66, fieldB);

    float grad = pow(clamp(dir.y * 0.5 + 0.55, 0.0, 1.0), 0.75);
    vec3 base = mix(uHorizon, uZenith, grad);
    vec3 colorA = cycleColor(time * 0.055 + 0.08);
    vec3 colorB = cycleColor(time * 0.055 + 0.56);
    vec3 color = mix(base, colorA, poolA * 0.82);
    color = mix(color, colorB, poolB * 0.78);
    color += uShimmer * rimA * 0.14 + uGlow * rimB * 0.12;
    color *= 1.03 + sin(uTime * 0.055) * 0.07;

    // Film grain, seeded from the seamless 3D direction rather than a UV.
    float grainValue = fract(sin(dot(dir.xz * 400.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    color += (grainValue * 2.0 - 1.0) * 0.012;

    gl_FragColor = vec4(max(color, 0.0), 1.0);
  }
`;

/**
 * Lava-lamp sky dome: slowly evolving GPU-animated color pools with no
 * per-frame React work. Follows the player so the endless world never walks
 * out from under its own sky.
 */
function SkyDome({
  horizon,
  zenith,
  shimmer,
  glow,
}: {
  horizon: string;
  zenith: string;
  shimmer: string;
  glow: string;
}) {
  const group = useRef<THREE.Group>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uHorizon: { value: new THREE.Color(horizon) },
          uZenith: { value: new THREE.Color(zenith) },
          uShimmer: { value: new THREE.Color(shimmer) },
          uGlow: { value: new THREE.Color(glow) },
        },
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    material.uniforms.uHorizon.value.set(horizon);
    material.uniforms.uZenith.value.set(zenith);
    material.uniforms.uShimmer.value.set(shimmer);
    material.uniforms.uGlow.value.set(glow);
  }, [material, horizon, zenith, shimmer, glow]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    group.current?.position.set(playerPos.x, 0, playerPos.z);
  });

  return (
    <group ref={group}>
      <mesh renderOrder={-1} frustumCulled={false} material={material}>
        <sphereGeometry args={[200, 32, 20]} />
      </mesh>
    </group>
  );
}

/** Solid obstacles the player slides along instead of walking through. */
function collidersFor(chunk: ChunkData): Collider[] {
  const list: Collider[] = [];
  const add = (
    placements: { position: [number, number, number]; scale: number; tilt: number }[],
    radiusPerScale: number,
    opts: { skipToppled?: boolean } = {}
  ) => {
    for (const p of placements) {
      // Toppled/sideways things lie low enough to step over.
      if (opts.skipToppled && Math.abs(p.tilt) > 0.8) continue;
      list.push({ x: p.position[0], z: p.position[2], r: p.scale * radiusPerScale });
    }
  };
  add(chunk.trees, 0.35, { skipToppled: true });
  add(chunk.deadTrees, 0.3, { skipToppled: true });
  add(chunk.giantMushrooms, 0.5);
  {
    const radii = mushroomColliderRadii(chunk.modelMushrooms);
    chunk.modelMushrooms.forEach((p, i) => {
      list.push({ x: p.position[0], z: p.position[2], r: radii[i] });
    });
  }
  add(chunk.circleStones, 0.75);
  add(chunk.pillars, 0.6, { skipToppled: true });
  add(chunk.ruinWalls, 1.2, { skipToppled: true });
  add(chunk.shrines, 1.7);
  add(chunk.rocks.filter((p) => p.scale > 1.1), 0.85);
  // Arch posts: two circles either side of the opening — the gap stays walkable.
  for (const p of chunk.arches) {
    const off = p.scale * 1.75;
    list.push(
      { x: p.position[0] + Math.cos(p.rotation) * off, z: p.position[2] - Math.sin(p.rotation) * off, r: p.scale * 0.65 },
      { x: p.position[0] - Math.cos(p.rotation) * off, z: p.position[2] + Math.sin(p.rotation) * off, r: p.scale * 0.65 }
    );
  }
  if (chunk.crystal) {
    list.push({ x: chunk.crystal[0], z: chunk.crystal[2], r: 2.0 });
  }
  // Never trap the player inside an obstacle at the spawn point (0, 12).
  return list.filter((c) => Math.hypot(c.x, c.z - 12) > c.r + 0.8);
}

function Chunk({
  seedNum,
  palette,
  realm,
  cx,
  cz,
}: {
  seedNum: number;
  palette: Palette;
  realm: Realm;
  cx: number;
  cz: number;
}) {
  const chunk = useMemo(
    () => generateChunk(seedNum, cx, cz, palette, realm),
    [seedNum, cx, cz, palette, realm]
  );
  const isOrigin = cx === 0 && cz === 0;
  const crystalRole: CrystalRole = isOrigin && realm === "rift" ? "return-rift" : "city";

  useEffect(() => {
    addColliders(chunk.key, collidersFor(chunk));
    return () => removeColliders(chunk.key);
  }, [chunk]);

  return (
    <group>
      <TerrainMesh world={chunk} />
      <Grass world={chunk} />
      <Trees world={chunk} />
      <GiantMushrooms world={chunk} />
      <Rocks world={chunk} />
      <Ruins world={chunk} />
      <Shards world={chunk} palette={palette} />
      {realm === "forest" && <ForestCreatures world={chunk} palette={palette} />}
      <Suspense fallback={null}>
        <ModelMushrooms world={chunk} />
      </Suspense>
      {chunk.crystal && (
        <DreamCrystal
          position={chunk.crystal}
          palette={palette}
          seedNum={seedNum}
          role={crystalRole}
        />
      )}
    </group>
  );
}

interface ChunkCoord {
  cx: number;
  cz: number;
}

function chunkKey(c: ChunkCoord): string {
  return `${c.cx}:${c.cz}`;
}

/**
 * Keeps a 3x3 ring of chunks generated around the player as they wander,
 * streaming newly-needed tiles in one per frame (nearest first) instead of
 * mounting a whole batch synchronously when the player crosses a boundary.
 */
function ChunkField({
  seedNum,
  palette,
  realm,
}: {
  seedNum: number;
  palette: Palette;
  realm: Realm;
}) {
  const [loaded, setLoaded] = useState<Map<string, ChunkCoord>>(() => {
    const [cx, cz] = worldToChunk(playerPos.x, playerPos.z);
    return new Map([[chunkKey({ cx, cz }), { cx, cz }]]);
  });
  const centerRef = useRef<[number, number]>(worldToChunk(playerPos.x, playerPos.z));
  const queueRef = useRef<ChunkCoord[]>([]);
  const checkTimer = useRef(0);

  const rebuildQueue = (center: [number, number], loadedKeys: Set<string>) => {
    const wanted: (ChunkCoord & { d: number })[] = [];
    for (let dx = -CHUNK_RING; dx <= CHUNK_RING; dx++) {
      for (let dz = -CHUNK_RING; dz <= CHUNK_RING; dz++) {
        const c = { cx: center[0] + dx, cz: center[1] + dz };
        if (!loadedKeys.has(chunkKey(c))) wanted.push({ ...c, d: dx * dx + dz * dz });
      }
    }
    wanted.sort((a, b) => a.d - b.d);
    queueRef.current = wanted;
  };

  // Seed the queue with the rest of the starting ring (the center chunk is
  // already loaded synchronously so spawn is never an empty void).
  useEffect(() => {
    rebuildQueue(centerRef.current, new Set(loaded.keys()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    checkTimer.current += delta;
    if (checkTimer.current >= CENTER_CHECK_INTERVAL) {
      checkTimer.current = 0;
      const c = worldToChunk(playerPos.x, playerPos.z);
      if (c[0] !== centerRef.current[0] || c[1] !== centerRef.current[1]) {
        centerRef.current = c;
        setLoaded((prev) => {
          // Drop out-of-range tiles immediately — unmounting is cheap.
          const next = new Map<string, ChunkCoord>();
          for (const [key, coord] of prev) {
            if (Math.abs(coord.cx - c[0]) <= CHUNK_RING && Math.abs(coord.cz - c[1]) <= CHUNK_RING) {
              next.set(key, coord);
            }
          }
          rebuildQueue(c, new Set(next.keys()));
          return next;
        });
      }
    }

    if (queueRef.current.length > 0) {
      const next = queueRef.current.splice(0, CHUNKS_PER_FRAME);
      setLoaded((prev) => {
        const merged = new Map(prev);
        for (const c of next) merged.set(chunkKey(c), c);
        return merged;
      });
    }
  });

  return (
    <>
      {[...loaded.values()].map(({ cx, cz }) => (
        <Chunk
          key={chunkKey({ cx, cz })}
          seedNum={seedNum}
          palette={palette}
          realm={realm}
          cx={cx}
          cz={cz}
        />
      ))}
    </>
  );
}

export function World() {
  const seed = useDreamStore((s) => s.seed);
  const realm = useDreamStore((s) => s.realm);
  const seedNum = useMemo(() => hashString(seed), [seed]);
  const palette = useMemo(
    () => (realm === "rift" ? RIFT_PALETTE : paletteForSeed(seed)),
    [seed, realm]
  );

  if (realm === "city") return <DreamCity seedNum={seedNum} />;
  if (realm === "rift") return <DojoMaze seedNum={seedNum} />;

  return (
    <>
      <Atmosphere
        fogColor={palette.fog}
        skyColor={palette.sky}
        baseDensity={FOREST_FOG_DENSITY}
      />
      <SkyDome
        horizon={palette.horizon}
        zenith={palette.sky}
        shimmer={palette.crystal}
        glow={palette.glow}
      />
      {/* Sky light carries the horizon hue so the atmosphere tints everything. */}
      <hemisphereLight args={[palette.horizon, palette.ground[0], 1.9]} />
      <directionalLight position={[30, 50, -20]} intensity={0.6} color={palette.wisp} />
      <ambientLight intensity={0.35} color={palette.glow} />

      {/* key remounts the whole forest when the dream shifts */}
      <group key={seed}>
        <ChunkField seedNum={seedNum} palette={palette} realm={realm} />
        <Wisps seedNum={seedNum} palette={palette} />
      </group>
    </>
  );
}
