import * as THREE from "three";

const activeShards = new Map<string, THREE.Vector3>();
const collectedShards = new Set<string>();

export function registerShard(id: string, position: [number, number, number]): void {
  if (!collectedShards.has(id)) activeShards.set(id, new THREE.Vector3(...position));
}

export function unregisterShard(id: string): void {
  activeShards.delete(id);
}

export function markShardCollected(id: string): void {
  collectedShards.add(id);
  activeShards.delete(id);
}

export function isShardCollected(id: string): boolean {
  return collectedShards.has(id);
}

export function nearestShard(position: THREE.Vector3): THREE.Vector3 | null {
  let nearest: THREE.Vector3 | null = null;
  let nearestDistance = Infinity;
  for (const candidate of activeShards.values()) {
    const distance = position.distanceToSquared(candidate);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = candidate;
    }
  }
  return nearest;
}
