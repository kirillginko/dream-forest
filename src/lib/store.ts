import { create } from "zustand";
import * as THREE from "three";
import { nextSeed } from "./seed";

/** Player position, mutated every frame by the Player — not reactive state. */
export const playerPos = new THREE.Vector3(0, 2, 14);
/** Camera yaw, mutated by Player for the HUD compass without React updates. */
export const playerYaw = { value: 0 };

export const SHARD_GOAL = 6;

interface DreamStore {
  seed: string;
  /** The current dream-space. */
  realm: "forest" | "city" | "rift";
  locked: boolean;
  /** "lock" = pointer lock; "drag" = fallback for iframes/embeds. */
  lookMode: "lock" | "drag";
  /** Dream shards collected toward the current rift threshold. */
  shards: number;
  /** Prompt text when the player is near an interactable, else null. */
  nearInteract: string | null;
  /** Timestamp of the last dream shift, drives the HUD flash. */
  shiftedAt: number;
  /** Timestamp used by the dojo's between-floor blackout animation. */
  floorTransitionAt: number;
  /** Non-zero while the post-maze cat epilogue is playing. */
  mazeEndingAt: number;
  /** Mirrors the audio element's play state for the HUD transport controls. */
  musicPlaying: boolean;
  /** Display name of the currently loaded track, e.g. "Dreamscape". */
  trackLabel: string;
  setLocked: (locked: boolean) => void;
  setLookMode: (mode: "lock" | "drag") => void;
  setNearInteract: (prompt: string | null) => void;
  setMusicPlaying: (playing: boolean) => void;
  setTrackLabel: (label: string) => void;
  setFloorTransitionAt: (time: number) => void;
  setMazeEndingAt: (time: number) => void;
  shiftDream: () => void;
  collectShard: () => void;
  enterRift: () => void;
  enterCity: () => void;
  returnFromCity: () => void;
  returnFromRift: () => void;
}

export const useDreamStore = create<DreamStore>((set, get) => ({
  seed: "forest-dream-001",
  realm: "forest",
  locked: false,
  lookMode: "lock",
  shards: 0,
  nearInteract: null,
  shiftedAt: 0,
  floorTransitionAt: 0,
  mazeEndingAt: 0,
  musicPlaying: false,
  trackLabel: "",
  setLocked: (locked) => set({ locked }),
  setLookMode: (lookMode) => set({ lookMode }),
  setNearInteract: (nearInteract) => set({ nearInteract }),
  setMusicPlaying: (musicPlaying) => set({ musicPlaying }),
  setTrackLabel: (trackLabel) => set({ trackLabel }),
  setFloorTransitionAt: (floorTransitionAt) => set({ floorTransitionAt }),
  setMazeEndingAt: (mazeEndingAt) => set({ mazeEndingAt }),
  shiftDream: () =>
    set((s) => ({
      seed: nextSeed(s.seed),
      shiftedAt: Date.now(),
      nearInteract: null,
    })),
  // Reaching the goal pulls the player into the Rift immediately — no
  // backtracking to an altar required, collecting the last shard IS the
  // trigger.
  collectShard: () => {
    const next = get().shards + 1;
    if (next >= SHARD_GOAL) get().enterRift();
    else set({ shards: next });
  },
  enterRift: () =>
    set((s) => ({
      seed: nextSeed(s.seed) + "-rift",
      realm: "rift",
      mazeEndingAt: 0,
      shards: 0,
      shiftedAt: Date.now(),
      nearInteract: null,
    })),
  enterCity: () =>
    set((s) => ({
      seed: nextSeed(s.seed) + "-city",
      realm: "city",
      shiftedAt: Date.now(),
      nearInteract: null,
    })),
  returnFromCity: () =>
    set((s) => ({
      seed: nextSeed(s.seed),
      realm: "forest",
      shiftedAt: Date.now(),
      nearInteract: null,
    })),
  returnFromRift: () =>
    set((s) => ({
      seed: nextSeed(s.seed),
      realm: "forest",
      shards: 0,
      mazeEndingAt: 0,
      shiftedAt: Date.now(),
      nearInteract: null,
    })),
}));
