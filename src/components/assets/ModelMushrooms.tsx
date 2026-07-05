"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import type { ChunkData, Placement } from "../world/generateWorld";

/**
 * GLB mushroom species scattered through the forest. Weight controls how
 * often a species is picked; height is the normalized world-space size a
 * scale-1.0 placement gets — deliberately oversized, this is a dream.
 * `maxPerChunk` caps the heavy models (collection ~110k tris, jelly ~260k)
 * so density comes from the cheap species; `collider` is the stem radius at
 * scale 1.0.
 */
const SPECIES = [
  { url: "/models/mushrooms/fly_agaric_mushroom.glb", height: 3.2, weight: 4, maxPerChunk: Infinity, collider: 0.35 },
  { url: "/models/mushrooms/glowing_mushroom.glb", height: 2.4, weight: 4, maxPerChunk: Infinity, collider: 0.25 },
  { url: "/models/mushrooms/realistic_mushroom_-_01.glb", height: 2.8, weight: 3.5, maxPerChunk: Infinity, collider: 0.3 },
  { url: "/models/mushrooms/mushrooms_collection.glb", height: 4.5, weight: 0.5, maxPerChunk: 2, collider: 0.9 },
  { url: "/models/mushrooms/mushroom__tree.glb", height: 14, weight: 2.2, maxPerChunk: Infinity, collider: 1.0 },
  { url: "/models/mushrooms/jelly_mushroom.glb", height: 6, weight: 0.12, maxPerChunk: 1, collider: 0.8 },
];

const TOTAL_WEIGHT = SPECIES.reduce((sum, s) => sum + s.weight, 0);

/**
 * Resolve each placement to its final species, applying the per-chunk caps
 * (overflow becomes fly agaric). Deterministic for a given placement list —
 * the renderer and the collider builder must agree.
 */
export function resolveSpeciesIndices(placements: Placement[]): number[] {
  const counts = SPECIES.map(() => 0);
  return placements.map((p) => {
    let si = speciesIndexFor(p.variant);
    if (counts[si] >= SPECIES[si].maxPerChunk) si = 0;
    counts[si]++;
    return si;
  });
}

/** Collision radii for a chunk's mushroom placements. */
export function mushroomColliderRadii(placements: Placement[]): number[] {
  const indices = resolveSpeciesIndices(placements);
  return indices.map((si, i) => SPECIES[si].collider * placements[i].scale);
}

/** Map a placement's variant (uniform 0..1) to a species index by weight. */
function speciesIndexFor(variant: number): number {
  let v = variant * TOTAL_WEIGHT;
  for (let i = 0; i < SPECIES.length; i++) {
    v -= SPECIES[i].weight;
    if (v <= 0) return i;
  }
  return SPECIES.length - 1;
}

interface ModelPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** Mesh's baked transform within the model scene. */
  matrix: THREE.Matrix4;
}

interface SpeciesModel {
  parts: ModelPart[];
  /** Uniform scale that makes the model `height` meters tall. */
  norm: number;
  /** Lifts the model so its bounding-box floor sits on the terrain. */
  groundShift: THREE.Matrix4;
}

// Processing a GLTF scene into instancing-ready parts means traversing every
// mesh and unioning bounding boxes — for the ~260k-triangle jelly mushroom
// that's real work. Every chunk mounts its own ModelMushrooms, so without a
// cache keyed on the (stable, drei-cached) scene object this redoes that
// work on every single chunk streamed in. Compute it once, forever.
const speciesModelCache = new Map<THREE.Object3D, SpeciesModel>();

function processSpeciesModel(scene: THREE.Object3D, height: number): SpeciesModel {
  const cached = speciesModelCache.get(scene);
  if (cached) return cached;

  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = Math.max(box.max.y - box.min.y, 1e-3);
  const parts: ModelPart[] = [];
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      parts.push({
        geometry: mesh.geometry,
        material: mesh.material as THREE.Material,
        matrix: mesh.matrixWorld.clone(),
      });
    }
  });
  const model: SpeciesModel = {
    parts,
    norm: height / size,
    groundShift: new THREE.Matrix4().makeTranslation(0, -box.min.y, 0),
  };
  speciesModelCache.set(scene, model);
  return model;
}

function useSpeciesModels(): SpeciesModel[] {
  const gltfs = useGLTF(SPECIES.map((s) => s.url));
  return useMemo(
    () => gltfs.map((gltf, i) => processSpeciesModel(gltf.scene, SPECIES[i].height)),
    [gltfs]
  );
}

const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const euler = new THREE.Euler();
const scl = new THREE.Vector3();
const compose = new THREE.Matrix4();

function PartInstances({
  part,
  model,
  placements,
}: {
  part: ModelPart;
  model: SpeciesModel;
  placements: Placement[];
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    placements.forEach((p, i) => {
      euler.set(p.tilt * 0.25, p.rotation, 0, "YXZ");
      quat.setFromEuler(euler);
      const s = p.scale * model.norm;
      scl.setScalar(s);
      pos.set(...p.position);
      compose.compose(pos, quat, scl);
      compose.multiply(model.groundShift);
      compose.multiply(part.matrix);
      mesh.current!.setMatrixAt(i, compose);
    });
    mesh.current.count = placements.length;
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [part, model, placements]);

  return (
    <instancedMesh
      ref={mesh}
      args={[part.geometry, part.material, placements.length]}
      frustumCulled={false}
    />
  );
}

/** Scatters the GLB mushrooms of one chunk, instanced per model part. */
export function ModelMushrooms({ world }: { world: ChunkData }) {
  const models = useSpeciesModels();

  const bySpecies = useMemo(() => {
    const groups: Placement[][] = SPECIES.map(() => []);
    const indices = resolveSpeciesIndices(world.modelMushrooms);
    world.modelMushrooms.forEach((p, i) => groups[indices[i]].push(p));
    return groups;
  }, [world.modelMushrooms]);

  return (
    <group>
      {models.map((model, si) =>
        bySpecies[si].length === 0
          ? null
          : model.parts.map((part, pi) => (
              <PartInstances
                key={`${si}:${pi}`}
                part={part}
                model={model}
                placements={bySpecies[si]}
              />
            ))
      )}
    </group>
  );
}

useGLTF.preload(SPECIES.map((s) => s.url));
