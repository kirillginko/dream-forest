// Procedural PS1-style detail textures, generated on a canvas at load time.
// All maps are grayscale so they multiply against palette tints and vertex
// colors — the five palette modes keep working untouched. Nearest filtering
// keeps them chunky and retro. Patterns are seeded per dream.

import * as THREE from "three";
import { mulberry32 } from "./seed";

export interface DetailTextures {
  ground: THREE.Texture;
  bark: THREE.Texture;
  foliage: THREE.Texture;
  stone: THREE.Texture;
  cap: THREE.Texture;
}

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;

function gray(v: number): string {
  const b = Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${b},${b},${b})`;
}

function blotches(
  ctx: Ctx,
  size: number,
  rng: Rng,
  count: number,
  minR: number,
  maxR: number,
  minShade: number,
  maxShade: number,
  alpha: number
) {
  ctx.globalAlpha = alpha;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = gray(minShade + rng() * (maxShade - minShade));
    const r = minR + rng() * (maxR - minR);
    ctx.beginPath();
    ctx.ellipse(
      rng() * size,
      rng() * size,
      r,
      r * (0.5 + rng() * 0.8),
      rng() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Per-pixel grain — the dithered PS1 crunch. */
function grain(ctx: Ctx, size: number, rng: Rng, amp: number) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amp;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function makeTexture(
  seedNum: number,
  salt: number,
  size: number,
  draw: (ctx: Ctx, size: number, rng: Rng) => void
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const rng = mulberry32((seedNum ^ salt) >>> 0);
  draw(ctx, size, rng);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function groundTexture(seedNum: number): THREE.CanvasTexture {
  return makeTexture(seedNum, 0x67a3, 256, (ctx, size, rng) => {
    ctx.fillStyle = gray(205);
    ctx.fillRect(0, 0, size, size);
    blotches(ctx, size, rng, 60, 10, 42, 150, 235, 0.4); // moss patches
    blotches(ctx, size, rng, 240, 1, 4, 110, 170, 0.7); // dirt speckles
    blotches(ctx, size, rng, 40, 2, 6, 225, 250, 0.5); // pale flecks
    grain(ctx, size, rng, 34);
  });
}

function barkTexture(seedNum: number): THREE.CanvasTexture {
  return makeTexture(seedNum, 0x1b2f, 128, (ctx, size, rng) => {
    ctx.fillStyle = gray(190);
    ctx.fillRect(0, 0, size, size);
    // Wandering vertical fissures.
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = gray(110 + rng() * 90);
      ctx.lineWidth = 1 + rng() * 3;
      ctx.globalAlpha = 0.55 + rng() * 0.35;
      let x = rng() * size;
      ctx.beginPath();
      ctx.moveTo(x, -4);
      for (let y = 0; y <= size; y += size / 8) {
        x += (rng() - 0.5) * 10;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    grain(ctx, size, rng, 26);
  });
}

function foliageTexture(seedNum: number): THREE.CanvasTexture {
  return makeTexture(seedNum, 0x4c81, 128, (ctx, size, rng) => {
    ctx.fillStyle = gray(195);
    ctx.fillRect(0, 0, size, size);
    blotches(ctx, size, rng, 90, 4, 14, 140, 240, 0.55); // leaf clumps
    blotches(ctx, size, rng, 160, 1, 3, 120, 160, 0.5); // shadow holes
    grain(ctx, size, rng, 30);
  });
}

function stoneTexture(seedNum: number): THREE.CanvasTexture {
  return makeTexture(seedNum, 0x77e2, 128, (ctx, size, rng) => {
    ctx.fillStyle = gray(200);
    ctx.fillRect(0, 0, size, size);
    blotches(ctx, size, rng, 50, 5, 22, 165, 230, 0.45); // weathering
    // Cracks.
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = gray(105 + rng() * 45);
      ctx.lineWidth = 1 + rng();
      ctx.globalAlpha = 0.7;
      let x = rng() * size;
      let y = rng() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 3 + Math.floor(rng() * 4);
      for (let s = 0; s < steps; s++) {
        x += (rng() - 0.5) * 46;
        y += (rng() - 0.5) * 46;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    blotches(ctx, size, rng, 90, 1, 3, 130, 170, 0.5); // pitting
    grain(ctx, size, rng, 24);
  });
}

function capTexture(seedNum: number): THREE.CanvasTexture {
  return makeTexture(seedNum, 0x9d15, 128, (ctx, size, rng) => {
    ctx.fillStyle = gray(195);
    ctx.fillRect(0, 0, size, size);
    // Pale spots with darker rims.
    for (let i = 0; i < 26; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 4 + rng() * 9;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = gray(150);
      ctx.beginPath();
      ctx.arc(x, y, r + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = gray(245);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    grain(ctx, size, rng, 22);
  });
}

let current: { seedNum: number; textures: DetailTextures } | null = null;

/** Detail maps for the given dream, built once per seed (old set disposed). */
export function getDetailTextures(seedNum: number): DetailTextures {
  if (current?.seedNum === seedNum) return current.textures;
  if (current) {
    for (const tex of Object.values(current.textures)) tex.dispose();
  }
  current = {
    seedNum,
    textures: {
      ground: groundTexture(seedNum),
      bark: barkTexture(seedNum),
      foliage: foliageTexture(seedNum),
      stone: stoneTexture(seedNum),
      cap: capTexture(seedNum),
    },
  };
  return current.textures;
}

/** Clone a texture with its own repeat (clones share the underlying image). */
export function repeated(tex: THREE.Texture, rx: number, ry: number): THREE.Texture {
  const t = tex.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}
