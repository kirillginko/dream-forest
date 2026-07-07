"use client";

import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { World } from "../world/World";
import { Player } from "./Player";
import { PostFX } from "./PostFX";
import { Hud } from "./Hud";
import { useDreamStore } from "@/lib/store";
import { soundEffects } from "@/lib/soundEffects";
import { WaypointArrow } from "./WaypointArrow";

function TransitionAudio() {
  const shiftedAt = useDreamStore((state) => state.shiftedAt);
  const previous = useRef(shiftedAt);
  useEffect(() => {
    if (shiftedAt > 0 && shiftedAt !== previous.current) soundEffects.play("transition", 0.7);
    previous.current = shiftedAt;
  }, [shiftedAt]);
  return null;
}

export default function Experience() {
  return (
    <div className="fixed inset-0 bg-black">
      <Canvas
        dpr={[0.75, 1.5]}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        camera={{ fov: 72, near: 0.1, far: 320, position: [0, 3, 12] }}
      >
        <World />
        <Player />
        <WaypointArrow />
        <PostFX />
      </Canvas>
      <Hud />
      <TransitionAudio />
    </div>
  );
}
