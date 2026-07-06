import { mulberry32 } from "@/lib/seed";
import type { Palette } from "./palettes";
import { terrainHeight, CHUNK_SIZE, CLEARING_CENTER } from "./terrain";

export type Realm = "forest" | "city" | "rift";

export interface Placement {
  position: [number, number, number];
  /** Rotation around Y. */
  rotation: number;
  scale: number;
  /** Tilt away from vertical (dream logic: some things grow sideways). */
  tilt: number;
  /** Free-use variation value in [0, 1). */
  variant: number;
}

/** One generated 120m tile of the endless forest (or the Rift). */
export interface ChunkData {
  key: string;
  cx: number;
  cz: number;
  /** World seed number — shared by every chunk (textures key off this). */
  seedNum: number;
  palette: Palette;
  trees: Placement[];
  deadTrees: Placement[];
  giantMushrooms: Placement[];
  /** GLB mushrooms; variant picks the species. */
  modelMushrooms: Placement[];
  rocks: Placement[];
  grass: Placement[];
  arches: Placement[];
  pillars: Placement[];
  /** Low remnants of rooms, courtyards, and processional boundaries. */
  ruinWalls: Placement[];
  /** Small non-interactive stepped altars left by former inhabitants. */
  shrines: Placement[];
  /** Ritual stone ring — origin chunk only. */
  circleStones: Placement[];
  /** Dream-shift altar position, if this chunk has one. */
  crystal: [number, number, number] | null;
  /** Small collectible shards scattered through the chunk. */
  shards: Placement[];
}

/** Kept as an alias — asset components take a chunk as their `world` prop. */
export type WorldData = ChunkData;

function chunkSeedNum(worldSeedNum: number, cx: number, cz: number): number {
  let h = worldSeedNum ^ Math.imul(cx, 0x27d4eb2f) ^ Math.imul(cz, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

const CLEARING_KEEPOUT = 14; // keep the origin ritual clearing open

export function generateChunk(
  worldSeedNum: number,
  cx: number,
  cz: number,
  palette: Palette,
  realm: Realm = "forest"
): ChunkData {
  const rng = mulberry32(chunkSeedNum(worldSeedNum, cx, cz));
  const minX = cx * CHUNK_SIZE - CHUNK_SIZE / 2;
  const minZ = cz * CHUNK_SIZE - CHUNK_SIZE / 2;
  const isOrigin = cx === 0 && cz === 0;

  const scatter = (
    count: number,
    opts: {
      minScale: number;
      maxScale: number;
      sidewaysChance?: number;
      /** Allow placements inside the origin clearing. */
      inClearing?: boolean;
    }
  ): Placement[] => {
    const out: Placement[] = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 20) {
      const x = minX + rng() * CHUNK_SIZE;
      const z = minZ + rng() * CHUNK_SIZE;
      if (
        isOrigin &&
        !opts.inClearing &&
        Math.hypot(x - CLEARING_CENTER.x, z - CLEARING_CENTER.z) < CLEARING_KEEPOUT
      ) {
        continue;
      }
      const sideways = (opts.sidewaysChance ?? 0) > rng();
      out.push({
        position: [x, terrainHeight(x, z, worldSeedNum), z],
        rotation: rng() * Math.PI * 2,
        scale: opts.minScale + rng() * (opts.maxScale - opts.minScale),
        tilt: sideways ? Math.PI / 2 - 0.25 + rng() * 0.5 : (rng() - 0.5) * 0.22,
        variant: rng(),
      });
    }
    return out;
  };

  const isRift = realm === "rift";

  // Ruins are common wilderness dressing in the forest; the Rift is built
  // almost entirely from them.
  const archCount = isRift
    ? 2 + Math.floor(rng() * 3)
    : rng() < 0.72
      ? 1 + Math.floor(rng() * 3)
      : 0;
  const pillarCount = isRift
    ? 5 + Math.floor(rng() * 7)
    : rng() < 0.82
      ? 2 + Math.floor(rng() * 5)
      : 0;
  const wallCount = isRift
    ? 5 + Math.floor(rng() * 6)
    : rng() < 0.76
      ? 2 + Math.floor(rng() * 6)
      : 0;
  const shrineCount = isRift
    ? 2 + Math.floor(rng() * 3)
    : rng() < 0.48
      ? 1 + Math.floor(rng() * 2)
      : 0;

  // Ritual stone ring around the origin clearing.
  const circleStones: Placement[] = [];
  if (isOrigin) {
    const stoneCount = 9;
    for (let i = 0; i < stoneCount; i++) {
      const angle = (i / stoneCount) * Math.PI * 2 + rng() * 0.12;
      const r = 7.5 + rng() * 0.8;
      const x = CLEARING_CENTER.x + Math.cos(angle) * r;
      const z = CLEARING_CENTER.z + Math.sin(angle) * r;
      circleStones.push({
        position: [x, terrainHeight(x, z, worldSeedNum), z],
        rotation: -angle + Math.PI / 2, // face the center
        scale: 0.85 + rng() * 0.5,
        tilt: (rng() - 0.5) * 0.16,
        variant: rng(),
      });
    }
  }

  // The origin always has the altar. Away from it, altars are common enough
  // in the forest that you'll cross several while gathering shards; in the
  // Rift there is only ever the one way back.
  let crystal: [number, number, number] | null = null;
  if (isOrigin) {
    crystal = [
      CLEARING_CENTER.x,
      terrainHeight(CLEARING_CENTER.x, CLEARING_CENTER.z, worldSeedNum),
      CLEARING_CENTER.z,
    ];
  } else if (!isRift && rng() < 0.28) {
    const x = minX + 20 + rng() * (CHUNK_SIZE - 40);
    const z = minZ + 20 + rng() * (CHUNK_SIZE - 40);
    crystal = [x, terrainHeight(x, z, worldSeedNum), z];
  }

  // Dream shards: small collectible pickups, never inside the origin
  // clearing. Absent from the Rift — there's nothing left to gather there.
  const shardCount = !isRift && !isOrigin && rng() < 0.55 ? 1 + Math.floor(rng() * 2) : 0;
  const shards = scatter(shardCount, { minScale: 0.85, maxScale: 1.25 });

  return {
    key: `${cx}:${cz}`,
    cx,
    cz,
    seedNum: worldSeedNum,
    palette,
    trees: isRift
      ? scatter(3 + Math.floor(rng() * 3), { minScale: 0.7, maxScale: 1.6, sidewaysChance: 0.3 })
      : scatter(28 + Math.floor(rng() * 14), {
          minScale: 0.8,
          maxScale: 2.6,
          sidewaysChance: 0.07,
        }),
    deadTrees: isRift
      ? scatter(22, { minScale: 1.0, maxScale: 2.4, sidewaysChance: 0.2 })
      : scatter(8, { minScale: 0.9, maxScale: 2.0, sidewaysChance: 0.12 }),
    giantMushrooms: isRift
      ? scatter(10, { minScale: 4.5, maxScale: 9.5 })
      : scatter(7, { minScale: 3.5, maxScale: 8 }),
    modelMushrooms: isRift
      ? scatter(10 + Math.floor(rng() * 6), { minScale: 0.9, maxScale: 2.1 })
      : scatter(36 + Math.floor(rng() * 12), {
          minScale: 0.8,
          maxScale: 1.9,
        }),
    rocks: isRift
      ? scatter(34, { minScale: 0.6, maxScale: 3.0 })
      : scatter(16, { minScale: 0.4, maxScale: 2.4 }),
    // Kept modest: this is the single largest per-chunk instance count, and
    // every point costs a terrainHeight() sample when the chunk streams in.
    // The Rift's ground is barren — nothing grows there.
    grass: isRift ? [] : scatter(260, { minScale: 0.6, maxScale: 1.5, inClearing: true }),
    arches: scatter(archCount, { minScale: 1.0, maxScale: 1.8 }),
    pillars: scatter(pillarCount, { minScale: 0.7, maxScale: 1.6, sidewaysChance: 0.25 }),
    ruinWalls: scatter(wallCount, { minScale: 0.75, maxScale: 1.45, sidewaysChance: 0.12 }),
    shrines: scatter(shrineCount, { minScale: 0.8, maxScale: 1.35 }),
    circleStones,
    crystal,
    shards,
  };
}
