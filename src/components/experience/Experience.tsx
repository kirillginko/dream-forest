"use client";

import { Canvas } from "@react-three/fiber";
import { World } from "../world/World";
import { Player } from "./Player";
import { PostFX } from "./PostFX";
import { Hud } from "./Hud";

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
        <PostFX />
      </Canvas>
      <Hud />
    </div>
  );
}
