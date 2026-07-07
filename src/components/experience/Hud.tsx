"use client";

import { useEffect, useRef } from "react";
import { audioEngine } from "@/lib/audio";
import { playerPos, useDreamStore, SHARD_GOAL } from "@/lib/store";
import { CITY_PALETTE, paletteForSeed, RIFT_PALETTE } from "../world/palettes";
import { nearestShard } from "@/lib/shardTracker";
import { DOJO_EXIT_X, DOJO_EXIT_Z } from "../world/DojoMaze";

const transportBtn =
  "pointer-events-auto border border-amber-200/40 px-2 py-1 text-[10px] tracking-[0.2em] " +
  "text-amber-100/80 bg-black/40 hover:bg-amber-100/10 hover:border-amber-200/70 transition-colors";

function WaypointReadout({ exit = false }: { exit?: boolean }) {
  const compass = useRef<HTMLDivElement>(null);
  const distance = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = requestAnimationFrame(update);
      const target = exit ? { x: DOJO_EXIT_X, z: DOJO_EXIT_Z } : nearestShard(playerPos);
      if (!target) {
        if (compass.current) compass.current.style.opacity = "0.28";
        if (distance.current) distance.current.textContent = "NO SIGNAL";
        return;
      }
      if (compass.current) compass.current.style.opacity = "1";
      const dx = target.x - playerPos.x;
      const dz = target.z - playerPos.z;
      if (distance.current) {
        distance.current.textContent = `${Math.round(Math.hypot(dx, dz))}M`;
      }
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [exit]);

  return (
    <div
      ref={compass}
      className="absolute left-1/2 top-[152px] flex -translate-x-1/2 flex-col items-center transition-opacity"
    >
      <div className="bg-black/45 px-2 py-0.5 text-[8px] tracking-[0.22em] text-cyan-100/65">
        {exit ? "MAZE EXIT" : "NEXT SHARD"} · <span ref={distance}>NO SIGNAL</span>
      </div>
    </div>
  );
}

/** Minimal mysterious overlay: seed, dream-state label, shard count, prompts. */
export function Hud() {
  const seed = useDreamStore((s) => s.seed);
  const realm = useDreamStore((s) => s.realm);
  const shards = useDreamStore((s) => s.shards);
  const locked = useDreamStore((s) => s.locked);
  const lookMode = useDreamStore((s) => s.lookMode);
  const nearInteract = useDreamStore((s) => s.nearInteract);
  const floorTransitionAt = useDreamStore((s) => s.floorTransitionAt);
  const mazeEndingAt = useDreamStore((s) => s.mazeEndingAt);
  const musicPlaying = useDreamStore((s) => s.musicPlaying);
  const trackLabel = useDreamStore((s) => s.trackLabel);
  const palette =
    realm === "rift" ? RIFT_PALETTE : realm === "city" ? CITY_PALETTE : paletteForSeed(seed);

  // Keyboard shortcuts for the player — the cursor is hidden while
  // pointer-locked, so the on-screen transport buttons alone aren't usable
  // mid-game. M toggles play/pause, [ and ] skip tracks.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyM") audioEngine.togglePlay();
      else if (e.code === "BracketRight") audioEngine.next();
      else if (e.code === "BracketLeft") audioEngine.previous();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (realm === "rift" && mazeEndingAt > 0) {
    return (
      <div className="pointer-events-none fixed inset-0 z-40 select-none font-mono">
        <div className="absolute left-1/2 top-[20%] -translate-x-1/2 text-center">
          <div className="text-lg tracking-[0.5em] text-amber-100/85">
            猫は次の夢を知っている
          </div>
          <div className="mt-4 text-[9px] tracking-[0.35em] text-amber-100/45">
            THE CAT KNOWS THE NEXT DREAM
          </div>
        </div>
        <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 text-[10px] tracking-[0.45em] text-amber-100/55">
          夢はまだ終わらない
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 select-none font-mono">
      {/* vignette + faint scanlines for the CRT dream feel */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent 0 2px, #000 2px 3px)",
        }}
      />

      {floorTransitionAt > 0 && (
        <div
          key={floorTransitionAt}
          className="absolute inset-0 z-50 animate-floor-transition bg-black"
        />
      )}

      {/* top-left: seed + state + shard progress */}
      <div className="absolute left-4 top-4 space-y-1 bg-black/35 px-3 py-2">
        <div className="text-[10px] tracking-[0.3em] text-amber-200/90">
          {palette.label}
        </div>
        <div className="text-[9px] tracking-[0.2em] text-amber-100/50">
          SEED: {seed.toUpperCase()}
        </div>
        {realm !== "rift" && (
          <div className="text-[9px] tracking-[0.2em] text-amber-100/50">
            SHARDS: {shards} / {SHARD_GOAL}
          </div>
        )}
        {realm === "rift" && (
          <div className="text-[9px] tracking-[0.2em] text-fuchsia-200/70">
            FIND THE LAST DOOR
          </div>
        )}
        {realm === "city" && (
          <div className="text-[9px] tracking-[0.2em] text-cyan-200/70">
            THE CITY REMEMBERS YOU
          </div>
        )}
      </div>

      <WaypointReadout exit={realm === "rift"} />

      {/* bottom-left: music transport */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <span className="bg-black/35 px-2 py-1 text-[9px] tracking-[0.25em] text-amber-100/50">
          {trackLabel ? trackLabel.toUpperCase() : "SIGNAL"}
        </span>
        <button
          className={transportBtn}
          onClick={() => audioEngine.previous()}
          aria-label="Previous track"
        >
          PREV
        </button>
        <button
          className={transportBtn}
          onClick={() => audioEngine.togglePlay()}
          aria-label={musicPlaying ? "Pause" : "Play"}
        >
          {musicPlaying ? "PAUSE" : "PLAY"}
        </button>
        <button
          className={transportBtn}
          onClick={() => audioEngine.next()}
          aria-label="Next track"
        >
          NEXT
        </button>
      </div>

      {/* center: enter prompt */}
      {!locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="bg-black/50 px-6 py-3 text-xs tracking-[0.4em] text-amber-200">
            CLICK TO ENTER THE DREAM
          </div>
          <div className="text-[9px] tracking-[0.3em] text-amber-100/50">
            {lookMode === "drag" ? "DRAG — LOOK" : "MOUSE — LOOK"} &nbsp;·&nbsp;
            WASD — WANDER &nbsp;·&nbsp; SHIFT — HURRY &nbsp;·&nbsp; E — TOUCH
          </div>
          <div className="text-[9px] tracking-[0.3em] text-amber-100/40">
            M — PLAY/PAUSE &nbsp;·&nbsp; [ ] — SKIP TRACK
          </div>
        </div>
      )}

      {/* interact prompt */}
      {locked && nearInteract && (
        <div className="absolute inset-x-0 bottom-16 flex justify-center">
          <div className="animate-pulse bg-black/50 px-4 py-2 text-[10px] tracking-[0.3em] text-amber-200">
            {nearInteract}
          </div>
        </div>
      )}

      {/* crosshair dot — only meaningful when the cursor is captured */}
      {locked && lookMode === "lock" && (
        <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-100/60" />
      )}
    </div>
  );
}
