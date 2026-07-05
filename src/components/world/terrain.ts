import * as THREE from "three";
import { fbm2, valueNoise2 } from "@/lib/noise";
import type { Palette } from "./palettes";

/** Chunks are square tiles centered on (cx * CHUNK_SIZE, cz * CHUNK_SIZE). */
export const CHUNK_SIZE = 120;
// Kept low: flat shading + fog hide the coarseness, and every new chunk
// pays for this vertex count in noise evaluations the instant it streams in.
const CHUNK_SEGMENTS = 28;

/** Center of the stone circle / spawn clearing, kept flat. */
export const CLEARING_CENTER = { x: 0, z: -4 };
const CLEARING_RADIUS = 16;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic terrain height for ANY world coordinate — the world has no
 * borders. The Player samples this on the CPU to walk the ground; chunk
 * meshes are built from the same function, so tiles always line up.
 */
export function terrainHeight(x: number, z: number, seedNum: number): number {
  const rolling = (fbm2(x * 0.022, z * 0.022, seedNum, 3) - 0.5) * 14;
  const swell = (valueNoise2(x * 0.006 + 31, z * 0.006 - 17, seedNum) - 0.5) * 10;
  let h = rolling + swell;
  // Flatten the spawn/ritual clearing at the origin.
  const d = Math.hypot(x - CLEARING_CENTER.x, z - CLEARING_CENTER.z);
  h *= smoothstep(CLEARING_RADIUS * 0.6, CLEARING_RADIUS * 2.2, d);
  return h;
}

export function worldToChunk(x: number, z: number): [number, number] {
  return [Math.round(x / CHUNK_SIZE), Math.round(z / CHUNK_SIZE)];
}

/**
 * Build one chunk tile with heights + vertex colors baked in. Vertices are in
 * world coordinates; shared edges evaluate the same height function, so
 * neighbouring tiles meet exactly (flat shading derives normals per-face, so
 * there are no normal seams either).
 */
export function buildChunkGeometry(
  seedNum: number,
  palette: Palette,
  cx: number,
  cz: number
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(
    CHUNK_SIZE,
    CHUNK_SIZE,
    CHUNK_SEGMENTS,
    CHUNK_SEGMENTS
  );
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c0 = new THREE.Color(palette.ground[0]);
  const c1 = new THREE.Color(palette.ground[1]);
  const glow = new THREE.Color(palette.glow);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z, seedNum));

    const mottle = fbm2(x * 0.06 + 7, z * 0.06 - 3, seedNum + 99, 2);
    tmp.copy(c0).lerp(c1, mottle);
    // Rare sickly-glow speckle.
    const speckle = valueNoise2(x * 0.9, z * 0.9, seedNum + 777);
    if (speckle > 0.93) tmp.lerp(glow, (speckle - 0.93) * 6);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  pos.needsUpdate = true;
  return geo;
}
