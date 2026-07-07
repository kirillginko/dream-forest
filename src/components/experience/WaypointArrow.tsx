"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { nearestShard } from "@/lib/shardTracker";
import { playerPos, useDreamStore } from "@/lib/store";
import { DOJO_EXIT_X, DOJO_EXIT_Z } from "../world/DojoMaze";

export function WaypointArrow() {
  const arrow = useRef<THREE.Group>(null);
  const camera = useThree((state) => state.camera);
  const realm = useDreamStore((state) => state.realm);
  const mazeEndingAt = useDreamStore((state) => state.mazeEndingAt);
  const math = useMemo(() => ({
    forward: new THREE.Vector3(),
    up: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    desiredRotation: new THREE.Quaternion(),
    localForward: new THREE.Vector3(0, 1, 0),
  }), []);

  useFrame(({ clock }, delta) => {
    if (!arrow.current) return;
    const target = realm === "rift"
      ? { x: DOJO_EXIT_X, z: DOJO_EXIT_Z }
      : nearestShard(playerPos);
    arrow.current.visible = !!target && !mazeEndingAt;
    if (!target || mazeEndingAt) return;

    camera.getWorldDirection(math.forward);
    math.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    arrow.current.position.copy(camera.position)
      .addScaledVector(math.forward, 3.2)
      .addScaledVector(math.up, 1.95 + Math.sin(clock.elapsedTime * 2.2) * 0.035);
    const dx = target.x - playerPos.x;
    const dz = target.z - playerPos.z;
    math.direction.set(dx, 0, dz).normalize();
    math.desiredRotation.setFromUnitVectors(math.localForward, math.direction);
    arrow.current.quaternion.slerp(math.desiredRotation, 1 - Math.exp(-10 * delta));
    const pulse = 0.46 + Math.sin(clock.elapsedTime * 2.8) * 0.018;
    arrow.current.scale.setScalar(pulse);
  });

  const color = realm === "rift" ? "#f0d56c" : "#8df8ff";
  return (
    <group ref={arrow} frustumCulled={false}>
      <mesh renderOrder={1000} frustumCulled={false}>
        <coneGeometry args={[0.38, 2.35, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}
