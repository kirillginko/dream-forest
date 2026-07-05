"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  HueSaturation,
  Noise,
  Scanline,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, NoiseEffect } from "postprocessing";
import { audioLevels } from "@/lib/audio";

/**
 * The VHS dream layer: bloom makes the fungi/crystal glow bleed, chromatic
 * aberration wobbles like a worn tape (treble widens the RGB split), tape
 * noise hisses louder with the highs, scanlines + vignette frame it all.
 */
export function PostFX() {
  // Owned by us and passed into the effect; mutated in place every frame.
  const rgbOffset = useMemo(() => new THREE.Vector2(0.0016, 0.0009), []);
  const noise = useRef<NoiseEffect>(null);

  useFrame(({ clock }) => {
    const wobble = Math.sin(clock.elapsedTime * 1.7) * 0.0004;
    const split = 0.0016 + wobble + audioLevels.treble * 0.005;
    rgbOffset.set(split, split * 0.55);
    if (noise.current) {
      noise.current.blendMode.opacity.value = 0.24 + audioLevels.treble * 0.3;
    }
  });

  return (
    <EffectComposer>
      <Bloom intensity={1.1} luminanceThreshold={0.3} luminanceSmoothing={0.5} mipmapBlur />
      <HueSaturation saturation={0.3} />
      <ChromaticAberration offset={rgbOffset} />
      <Scanline blendFunction={BlendFunction.OVERLAY} density={1.3} opacity={0.14} />
      {/* No premultiply: that mode dims grain in bright areas (like the sky),
          exactly where a film-like texture should stay visible. */}
      <Noise ref={noise} blendFunction={BlendFunction.OVERLAY} opacity={0.24} />
      <Vignette offset={0.28} darkness={0.8} />
    </EffectComposer>
  );
}
