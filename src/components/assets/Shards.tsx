"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { playerPos, useDreamStore } from "@/lib/store";
import type { ChunkData, Placement } from "../world/generateWorld";
import type { Palette } from "../world/palettes";
import {
  isShardCollected,
  markShardCollected,
  registerShard,
  unregisterShard,
} from "@/lib/shardTracker";
import { soundEffects } from "@/lib/soundEffects";
import { triggerLiquidMorph } from "@/lib/visualEffects";

const COLLECT_RADIUS = 2.6;
const BEAM_HEIGHT = 9;
// A realm swap mounts destination shards before Player has necessarily moved
// to its new spawn. Keep pickups disarmed until that handoff has settled.
const TRANSITION_PICKUP_DELAY_MS = 900;

/**
 * Dream shards: bright collectible pickups scattered through the
 * wilderness. Sized and lit to read clearly through fog and tree cover —
 * a tall additive beam marks each one from a distance, the core itself
 * glows hard enough for bloom to bleed. Walking near one collects it.
 */
export function Shards({ world, palette }: { world: ChunkData; palette: Palette }) {
  return (
    <ShardPickups
      placements={world.shards}
      palette={palette}
      idPrefix={`${world.seedNum}:forest:${world.key}`}
    />
  );
}

export function ShardPickups({
  placements,
  palette,
  idPrefix,
}: {
  placements: Placement[];
  palette: Palette;
  idPrefix: string;
}) {
  const shardId = (index: number) => `${idPrefix}:${index}`;
  const [collected, setCollected] = useState<boolean[]>(() =>
    placements.map((_, index) => isShardCollected(shardId(index)))
  );
  const groups = useRef<(THREE.Group | null)[]>([]);
  const cores = useRef<(THREE.Mesh | null)[]>([]);

  useEffect(() => {
    placements.forEach((placement, index) => {
      const id = shardId(index);
      if (!isShardCollected(id)) registerShard(id, placement.position);
    });
    return () => placements.forEach((_, index) => unregisterShard(shardId(index)));
    // Placements and idPrefix identify this mounted shard set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, idPrefix]);

  // R3F re-registers this callback (via a ref it updates outside of render)
  // whenever the component re-renders, so `collected` here is never stale.
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const dream = useDreamStore.getState();
    const pickupsArmed =
      !dream.worldTransitioning &&
      (dream.shiftedAt === 0 || Date.now() - dream.shiftedAt >= TRANSITION_PICKUP_DELAY_MS);
    let collectedThisFrame = false;

    placements.forEach((p, i) => {
      if (collected[i] || isShardCollected(shardId(i))) return;
      const group = groups.current[i];
      if (group) {
        group.position.y = p.position[1] + 1.4 + Math.sin(t * 1.6 + i * 2.1) * 0.28;
        group.rotation.y = t * 1.1 + i;
        group.rotation.x = Math.sin(t * 0.7 + i) * 0.25;
      }
      const core = cores.current[i];
      if (core) {
        const pulse = 0.75 + Math.sin(t * 3 + i * 1.7) * 0.25;
        (core.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.2 + pulse;
      }
      const d = Math.hypot(playerPos.x - p.position[0], playerPos.z - p.position[2]);
      if (pickupsArmed && !collectedThisFrame && d < COLLECT_RADIUS) {
        collectedThisFrame = true;
        setCollected((prev) => {
          if (prev[i]) return prev;
          const next = [...prev];
          next[i] = true;
          return next;
        });
        markShardCollected(shardId(i));
        triggerLiquidMorph(false);
        soundEffects.play("shard", 0.72);
        dream.collectShard();
      }
    });
  });

  return (
    <group>
      {placements.map((p, i) =>
        collected[i] ? null : (
          <group key={i} position={p.position}>
            {/* Beacon beam, visible above the canopy even through fog. */}
            <mesh position={[0, BEAM_HEIGHT / 2, 0]}>
              <cylinderGeometry args={[0.04, 0.14, BEAM_HEIGHT, 6, 1, true]} />
              <meshBasicMaterial
                color={palette.crystal}
                transparent
                opacity={0.35}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            <group
              ref={(el) => {
                groups.current[i] = el;
              }}
              scale={p.scale}
            >
              <mesh
                ref={(el) => {
                  cores.current[i] = el;
                }}
              >
                <octahedronGeometry args={[0.75, 0]} />
                <meshStandardMaterial
                  flatShading
                  color={palette.crystal}
                  emissive={palette.crystal}
                  emissiveIntensity={2.4}
                  roughness={0.2}
                />
              </mesh>
              {/* Outer glassy shell, slightly larger and translucent. */}
              <mesh scale={1.6}>
                <octahedronGeometry args={[0.75, 0]} />
                <meshStandardMaterial
                  flatShading
                  color={palette.crystal}
                  emissive={palette.crystal}
                  emissiveIntensity={0.6}
                  roughness={0.1}
                  transparent
                  opacity={0.25}
                  depthWrite={false}
                />
              </mesh>
            </group>
          </group>
        )
      )}
    </group>
  );
}
