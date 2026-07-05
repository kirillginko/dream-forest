import * as THREE from "three";
import type { Placement } from "../world/generateWorld";

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

/**
 * Fill an InstancedMesh from placements. `compose` positions the dummy for
 * each placement (relative transforms for multi-part assets); `colorFor`
 * optionally returns a per-instance tint.
 */
export function setInstances(
  mesh: THREE.InstancedMesh,
  placements: Placement[],
  compose: (p: Placement, obj: THREE.Object3D) => void,
  colorFor?: (p: Placement, color: THREE.Color) => void
): void {
  placements.forEach((p, i) => {
    dummy.position.set(...p.position);
    dummy.rotation.set(0, p.rotation, 0);
    dummy.scale.setScalar(p.scale);
    dummy.rotateX(p.tilt);
    compose(p, dummy);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (colorFor) {
      colorFor(p, tmpColor);
      mesh.setColorAt(i, tmpColor);
    }
  });
  mesh.count = placements.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
