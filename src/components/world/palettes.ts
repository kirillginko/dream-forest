import { hashString } from "@/lib/seed";

export interface Palette {
  name: string;
  /** Dream-state label shown in the HUD. */
  label: string;
  /** Zenith color of the sky dome. */
  sky: string;
  /** Horizon glow of the sky dome — the psychedelic band. */
  horizon: string;
  fog: string;
  /** Two ground tones blended by noise/height. */
  ground: [string, string];
  trunk: string;
  canopy: string;
  deadTree: string;
  mushroomStem: string;
  mushroomCap: string;
  /** Emissive glow for fungi + crystal. */
  glow: string;
  stone: string;
  crystal: string;
  wisp: string;
}

// Hue-contrast rules: the fog/sky never share a hue with the ground, so the
// air reads as colored atmosphere (purple haze over green moss) instead of
// monochrome soup.
export const PALETTES: Palette[] = [
  {
    name: "moss-dream",
    label: "MOSS MEMORY",
    sky: "#1e1035",
    horizon: "#7a3f8f",
    fog: "#4a2d63",
    ground: ["#2e4520", "#556327"],
    trunk: "#54402c",
    canopy: "#3f6b2a",
    deadTree: "#6b5f4a",
    mushroomStem: "#d9c9a8",
    mushroomCap: "#8a4a2a",
    glow: "#c9ff5e",
    stone: "#767a68",
    crystal: "#9affc4",
    wisp: "#e8ffa0",
  },
  {
    name: "purple-fog",
    label: "PURPLE INTERVAL",
    sky: "#1c0a33",
    horizon: "#c94f9e",
    fog: "#5e2a7a",
    ground: ["#2e1c47", "#4a2a66"],
    trunk: "#3a2851",
    canopy: "#6b46a3",
    deadTree: "#5c4a75",
    mushroomStem: "#c9aede",
    mushroomCap: "#8f2fa8",
    glow: "#ff6ad9",
    stone: "#6b5c7d",
    crystal: "#e08aff",
    wisp: "#ffa0ec",
  },
  {
    name: "acid-swamp",
    label: "THE FOREST IS LISTENING",
    sky: "#16240a",
    horizon: "#a8b81e",
    fog: "#5e7a12",
    ground: ["#414f0e", "#6b7d16"],
    trunk: "#4a4520",
    canopy: "#8fa322",
    deadTree: "#7d7542",
    mushroomStem: "#e0d9a8",
    mushroomCap: "#cf8a1e",
    glow: "#5effe0",
    stone: "#7d7d5e",
    crystal: "#8aff6a",
    wisp: "#e8ff6a",
  },
  {
    name: "dead-forest",
    label: "ZONE 04: STONE DREAM",
    sky: "#241a1e",
    horizon: "#8f3f3a",
    fog: "#4d3338",
    ground: ["#3d3733", "#57504a"],
    trunk: "#4f4841",
    canopy: "#615952",
    deadTree: "#7d756b",
    mushroomStem: "#b5aa9e",
    mushroomCap: "#7d443a",
    glow: "#ff5240",
    stone: "#807c75",
    crystal: "#ffa08a",
    wisp: "#d9cfc0",
  },
  {
    name: "astral-night",
    label: "ANOTHER PATH HAS OPENED",
    sky: "#0a0d2b",
    horizon: "#5e4a9e",
    fog: "#2d2f6b",
    ground: ["#1a2047", "#2d3866"],
    trunk: "#242a52",
    canopy: "#3d4f8f",
    deadTree: "#474e75",
    mushroomStem: "#a8b0d9",
    mushroomCap: "#3a55a3",
    glow: "#7ab8ff",
    stone: "#575e7d",
    crystal: "#a8d9ff",
    wisp: "#cfe0ff",
  },
];

export function paletteForSeed(seed: string): Palette {
  return PALETTES[hashString(seed + "::palette") % PALETTES.length];
}

/**
 * The Rift — a torn-open pocket dimension, never in the normal palette
 * rotation. Reached only by gathering enough dream shards and passing
 * through the origin altar; unmistakably not the forest.
 */
export const RIFT_PALETTE: Palette = {
  name: "the-rift",
  label: "SIGNAL DISTORTION",
  sky: "#050208",
  horizon: "#ff2ec4",
  fog: "#1a0630",
  ground: ["#0d0512", "#220a2e"],
  trunk: "#170a22",
  canopy: "#3a0f4a",
  deadTree: "#2a1030",
  mushroomStem: "#d0c0e0",
  mushroomCap: "#ff2ec4",
  glow: "#ffffff",
  stone: "#241030",
  crystal: "#ffffff",
  wisp: "#ff8af0",
};

/** The sleepless city behind the forest crystal. */
export const CITY_PALETTE: Palette = {
  name: "neon-city",
  label: "深夜の夢 / NIGHT SIGNAL",
  sky: "#030504",
  horizon: "#40100d",
  fog: "#101712",
  ground: ["#090817", "#17102b"],
  trunk: "#17131e",
  canopy: "#251735",
  deadTree: "#30243b",
  mushroomStem: "#d8bfd0",
  mushroomCap: "#ff426d",
  glow: "#ff3caa",
  stone: "#302a3f",
  crystal: "#54f7ff",
  wisp: "#ffdd72",
};
