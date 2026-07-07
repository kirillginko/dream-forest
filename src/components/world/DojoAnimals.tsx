"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { playerPos } from "@/lib/store";
import { soundEffects } from "@/lib/soundEffects";
import type { DojoRoutePoint } from "./DojoMaze";

const CAT_URL = "/models/animals/cat.glb";
const CHICKEN_URL = "/models/animals/chicken.glb";

interface AnimalData {
  kind: "cat" | "chicken";
  y: number;
  level: number;
  phase: number;
  speed: number;
  route: DojoRoutePoint[];
}

function RoamingAnimal({
  data,
  epilogue = false,
}: {
  data: AnimalData;
  epilogue?: boolean;
}) {
  const url = data.kind === "cat" ? CAT_URL : CHICKEN_URL;
  const gltf = useGLTF(url);
  const root = useRef<THREE.Group>(null);
  const camera = useThree((state) => state.camera);
  const nearPlayer = useRef(false);
  const model = useMemo(() => {
    const cloned = cloneSkeleton(gltf.scene);
    cloned.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      // Animated bounds in these Sketchfab exports are stale until the
      // mixer advances, which otherwise culls the entire animal.
      object.frustumCulled = false;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const brightened = materials.map((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return material;
        const copy = material.clone();
        return copy;
      });
      object.material = Array.isArray(object.material)
        ? brightened
        : brightened[0];
    });
    return cloned;
  }, [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, model);
  const [embeddedTexture, setEmbeddedTexture] = useState<THREE.Texture | null>(
    null,
  );
  // Both GLBs already bake a 0.01 FBX-to-meter conversion into their root
  // hierarchy. Keep the display scale near 1; applying 0.01 again makes the
  // animals only a centimeter tall.
  const modelScale = data.kind === "cat" ? 1.6 : 2.1;

  useEffect(() => {
    let active = true;
    void gltf.parser
      .getDependency("texture", 0)
      .then((texture: THREE.Texture) => {
        if (!active) return;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        setEmbeddedTexture(texture);
      });
    return () => {
      active = false;
    };
  }, [gltf.parser]);

  useEffect(() => {
    if (!embeddedTexture) return;
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        material.color.set("#ffffff");
        material.map = embeddedTexture;
        material.emissive.set("#ffffff");
        material.emissiveMap = embeddedTexture;
        material.emissiveIntensity = 0.18;
        material.roughness = 0.92;
        material.needsUpdate = true;
      }
    });
  }, [embeddedTexture, model]);

  useEffect(() => {
    const walkName = names.find((name) => {
      const lower = name.toLowerCase();
      return lower.includes("walk") && !lower.includes("_rm");
    });
    const action = walkName
      ? actions[walkName]
      : names.length
        ? actions[names[0]]
        : undefined;
    action
      ?.reset()
      .setEffectiveTimeScale(epilogue ? 0.85 : 0.68)
      .fadeIn(0.2)
      .play();
    return () => {
      action?.fadeOut(0.15);
    };
  }, [actions, epilogue, names]);

  useEffect(() => {
    if (!epilogue || !(camera instanceof THREE.PerspectiveCamera)) return;
    const originalFov = camera.fov;
    return () => {
      camera.fov = originalFov;
      camera.updateProjectionMatrix();
    };
  }, [camera, epilogue]);

  useFrame(({ clock }) => {
    if (!root.current) return;
    const travel = clock.elapsedTime * data.speed + data.phase;
    if (epilogue) {
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      root.current.position.copy(camera.position).addScaledVector(forward, 4.2);
      root.current.position.y = camera.position.y - 1.28;
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      root.current.rotation.y = Math.atan2(right.x, right.z);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = 58 + Math.sin(clock.elapsedTime * 1.05) * 9;
        camera.updateProjectionMatrix();
      }
      return;
    }
    if (data.route.length < 2) return;
    const lastSegment = data.route.length - 1;
    const cycle = lastSegment * 2;
    const wrapped = ((travel % cycle) + cycle) % cycle;
    const routeProgress = wrapped <= lastSegment ? wrapped : cycle - wrapped;
    const segment = Math.min(lastSegment - 1, Math.floor(routeProgress));
    const blend = routeProgress - segment;
    const from = data.route[segment];
    const to = data.route[segment + 1];
    const x = THREE.MathUtils.lerp(from.x, to.x, blend);
    const z = THREE.MathUtils.lerp(from.z, to.z, blend);
    const direction = wrapped <= lastSegment ? 1 : -1;
    const vx = (to.x - from.x) * direction;
    const vz = (to.z - from.z) * direction;
    root.current.position.set(x, data.y, z);
    root.current.rotation.y = Math.atan2(vx, vz);
    const close =
      Math.abs(playerPos.y - data.y) < 2.2 &&
      Math.hypot(playerPos.x - x, playerPos.z - z) < 3.1;
    if (close && !nearPlayer.current) {
      soundEffects.play(
        data.kind,
        data.kind === "cat" ? 0.58 : 0.48,
        0.96 + (data.phase % 0.08),
      );
    }
    nearPlayer.current = close;
  });

  return (
    <group ref={root}>
      <primitive object={model} scale={modelScale} />
    </group>
  );
}

export function EpilogueCat() {
  return (
    <RoamingAnimal
      epilogue
      data={{ kind: "cat", y: 0, level: 0, phase: 0, speed: 0.8, route: [] }}
    />
  );
}

export function DojoAnimals({
  seedNum,
  levels,
  levelHeight,
  routes,
}: {
  seedNum: number;
  levels: number;
  levelHeight: number;
  routes: DojoRoutePoint[][];
}) {
  const [activeLevel, setActiveLevel] = useState(0);
  const activeLevelRef = useRef(0);
  const animals = useMemo(() => {
    const result: AnimalData[] = [];
    for (let level = 0; level < levels; level++) {
      const route = routes[level] ?? [];
      for (let index = 0; index < 2; index++) {
        result.push({
          kind: (level + index) % 2 === 0 ? "cat" : "chicken",
          level,
          y: level * levelHeight + 0.03,
          phase:
            (seedNum % 19) * 0.31 +
            level * 3.7 +
            index * Math.max(4, route.length * 0.42),
          speed: 0.25 + index * 0.05,
          route,
        });
      }
    }
    return result;
  }, [levelHeight, levels, routes, seedNum]);

  useFrame(() => {
    const nextLevel = Math.max(
      0,
      Math.min(levels - 1, Math.round((playerPos.y - 1.75) / levelHeight)),
    );
    if (nextLevel === activeLevelRef.current) return;
    activeLevelRef.current = nextLevel;
    setActiveLevel(nextLevel);
  });

  return animals
    .filter((animal) => animal.level === activeLevel)
    .map((animal, index) => (
      <RoamingAnimal key={`${animal.kind}-${index}`} data={animal} />
    ));
}

useGLTF.preload(CAT_URL);
useGLTF.preload(CHICKEN_URL);
