"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { BlendFunction, Effect } from "postprocessing";
import { Uniform } from "three";
import { liquidMorphSignal } from "@/lib/visualEffects";

const fragmentShader = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;
  uniform float uPixelMode;
  uniform float uActive;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (uActive < 0.5) {
      outputColor = inputColor;
      return;
    }
    float progress = clamp(uProgress, 0.0, 1.0);
    float impact = smoothstep(0.0, 0.008, progress);
    float release = 1.0 - smoothstep(0.55, 1.0, progress);
    float strength = impact * release;
    vec2 centered = uv - 0.5;
    float radius = length(centered);
    vec2 radial = radius > 0.001 ? centered / radius : vec2(0.0);
    // A drop begins at screen center and pushes a defined wavefront outward.
    float wavefront = uProgress * 0.82;
    float distanceFromFront = radius - wavefront;
    float leadingRing = exp(-pow(distanceFromFront * 24.0, 2.0));
    float trailingMask = 1.0 - smoothstep(-0.02, 0.22, distanceFromFront);
    float trailingFade = exp(-abs(distanceFromFront) * 8.0);
    float trailingRipples = sin(distanceFromFront * 58.0 - uTime * 1.8)
      * trailingMask * trailingFade;
    float dropRipple = leadingRing * 1.35 + trailingRipples * 0.48;
    vec2 displacement = radial * dropRipple * 0.062;
    vec2 warpedUv = clamp(uv + displacement * strength, vec2(0.003), vec2(0.997));

    // Realm transitions briefly reduce the scene to chunky 8-bit tiles.
    float pixelStrength = uPixelMode * strength;
    float pixelSize = mix(1.0 / 700.0, 1.0 / 42.0, pixelStrength);
    vec2 pixelUv = (floor(warpedUv / pixelSize) + 0.5) * pixelSize;
    warpedUv = mix(warpedUv, pixelUv, pixelStrength);

    vec2 split = radial * 0.014 * strength;
    float red = texture2D(inputBuffer, clamp(warpedUv + split, 0.003, 0.997)).r;
    float green = texture2D(inputBuffer, warpedUv).g;
    float blue = texture2D(inputBuffer, clamp(warpedUv - split, 0.003, 0.997)).b;
    vec3 color = vec3(red, green, blue);
    color += vec3(0.065, 0.022, 0.085) * strength * (1.15 - radius);
    vec3 eightBitColor = floor(color * 7.0 + 0.5) / 7.0;
    color = mix(color, eightBitColor, pixelStrength * 0.9);
    outputColor = vec4(color, inputColor.a);
  }
`;

class LiquidMorphEffect extends Effect {
  constructor() {
    super("LiquidMorphEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ["uProgress", new Uniform(1)],
        ["uTime", new Uniform(0)],
        ["uPixelMode", new Uniform(0)],
        ["uActive", new Uniform(0)],
      ]),
    });
    this.blendMode.opacity.value = 0;
  }

  updateMorph(progress: number, time: number, active: boolean, pixelMode: boolean) {
    this.uniforms.get("uProgress")!.value = progress;
    this.uniforms.get("uTime")!.value = time;
    this.uniforms.get("uPixelMode")!.value = pixelMode ? 1 : 0;
    this.uniforms.get("uActive")!.value = active ? 1 : 0;
    this.blendMode.opacity.value = active ? 1 : 0;
  }
}

export function LiquidMorph() {
  const effect = useMemo(() => new LiquidMorphEffect(), []);

  useFrame(() => {
    const now = performance.now() / 1000;
    const elapsed = now - liquidMorphSignal.startedAt;
    const duration = 2.6;
    const active = elapsed >= 0 && elapsed < duration;
    effect.updateMorph(
      active ? Math.min(1, elapsed / duration) : 1,
      now,
      active,
      liquidMorphSignal.pixelMode
    );
  });

  return <primitive object={effect} dispose={null} />;
}
