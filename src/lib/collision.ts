import * as THREE from "three";

/** Cylinder obstacle on the ground plane (trees, stones, pillars…). */
export interface Collider {
  x: number;
  z: number;
  r: number;
  /** Optional axis-aligned box extents, used by architectural walls. */
  halfX?: number;
  halfZ?: number;
  yMin?: number;
  yMax?: number;
}

// Colliders are registered per chunk and dropped when the chunk unloads.
const registry = new Map<string, Collider[]>();

export function addColliders(key: string, list: Collider[]): void {
  registry.set(key, list);
}

export function removeColliders(key: string): void {
  registry.delete(key);
}

/** True if the player capsule can stand at `to` (checked on the xz plane). */
export function canMoveTo(
  _from: THREE.Vector3,
  to: THREE.Vector3,
  playerRadius: number
): boolean {
  for (const list of registry.values()) {
    for (const c of list) {
      if (c.yMin !== undefined && c.yMax !== undefined && (to.y < c.yMin || to.y > c.yMax)) {
        continue;
      }
      if (c.halfX !== undefined && c.halfZ !== undefined) {
        if (
          Math.abs(to.x - c.x) < c.halfX + playerRadius &&
          Math.abs(to.z - c.z) < c.halfZ + playerRadius
        ) return false;
        continue;
      }
      const dx = to.x - c.x;
      const dz = to.z - c.z;
      const rr = c.r + playerRadius;
      if (dx * dx + dz * dz < rr * rr) return false;
    }
  }
  return true;
}
