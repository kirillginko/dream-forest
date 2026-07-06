"use client";

import { Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { addColliders, removeColliders, type Collider } from "@/lib/collision";
import { mulberry32 } from "@/lib/seed";
import { playerPos, useDreamStore } from "@/lib/store";
import { getDetailTextures, repeated } from "@/lib/textures";
import { DojoAnimals, EpilogueCat } from "./DojoAnimals";
import { soundEffects } from "@/lib/soundEffects";

const GRID = 11;
const CELL = 6;
const WALL_HEIGHT = 5.4;
const WALL_THICKNESS = 0.28;
const START_X = 0;
const START_Z = 12;
const LEVELS = 3;
const LEVEL_HEIGHT = 6.2;
export const DOJO_EXIT_X = START_X + (GRID - 1) * CELL;
export const DOJO_EXIT_Z = START_Z - (GRID - 1) * CELL;

export function dojoFloorHeight(eyeY: number, x: number, z: number): number {
  const level = Math.max(0, Math.min(LEVELS - 1, Math.round((eyeY - 1.75) / LEVEL_HEIGHT)));
  const base = level * LEVEL_HEIGHT;
  if (level >= LEVELS - 1 || Math.abs(x - DOJO_EXIT_X) > 2.45) return base;
  const firstStepFront = DOJO_EXIT_Z + 2.31;
  const lastStepBack = DOJO_EXIT_Z - 2.29;
  if (z > firstStepFront || z < lastStepBack) return base;
  const step = Math.max(0, Math.min(8, Math.floor((firstStepFront - z) / 0.48)));
  return base + 0.2 + step * 0.24;
}

function makeTatamiTexture(seedNum: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const rng = mulberry32(seedNum ^ 0x74617461);
  context.fillStyle = "#aaa66c";
  context.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 2) {
    context.fillStyle = x % 4 === 0 ? "rgba(54,55,26,.16)" : "rgba(238,226,153,.11)";
    context.fillRect(x, 0, 1, 128);
  }
  for (let y = 1; y < 128; y += 5) {
    context.fillStyle = `rgba(55,51,24,${0.04 + rng() * 0.07})`;
    context.fillRect(0, y, 128, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(GRID, GRID);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface MazeWall {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export interface DojoRoutePoint {
  x: number;
  z: number;
}

interface MazeLayout {
  walls: MazeWall[];
  route: DojoRoutePoint[];
}

function ActiveFloor({ level, children }: { level: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!group.current) return;
    const active = Math.max(0, Math.min(LEVELS - 1, Math.round((playerPos.y - 1.75) / LEVEL_HEIGHT)));
    group.current.visible = active === level;
  });
  return <group ref={group}>{children}</group>;
}

function generateMaze(seedNum: number): MazeLayout {
  const rng = mulberry32(seedNum ^ 0x4d415a45);
  const visited = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  const east = Array.from({ length: GRID }, () => Array(GRID).fill(true));
  const south = Array.from({ length: GRID }, () => Array(GRID).fill(true));
  const stack: Array<[number, number]> = [[0, 0]];
  const parents = new Map<string, [number, number]>();
  visited[0][0] = true;

  while (stack.length) {
    const [row, col] = stack[stack.length - 1];
    const choices: Array<[number, number, "n" | "e" | "s" | "w"]> = [];
    if (row > 0 && !visited[row - 1][col]) choices.push([row - 1, col, "n"]);
    if (col < GRID - 1 && !visited[row][col + 1]) choices.push([row, col + 1, "e"]);
    if (row < GRID - 1 && !visited[row + 1][col]) choices.push([row + 1, col, "s"]);
    if (col > 0 && !visited[row][col - 1]) choices.push([row, col - 1, "w"]);
    if (!choices.length) {
      stack.pop();
      continue;
    }
    const [nextRow, nextCol, direction] = choices[Math.floor(rng() * choices.length)];
    if (direction === "e") east[row][col] = false;
    if (direction === "w") east[row][col - 1] = false;
    if (direction === "s") south[row][col] = false;
    if (direction === "n") south[row - 1][col] = false;
    visited[nextRow][nextCol] = true;
    parents.set(`${nextRow}:${nextCol}`, [row, col]);
    stack.push([nextRow, nextCol]);
  }

  const walls: MazeWall[] = [];
  const center = (row: number, col: number) => ({
    x: START_X + col * CELL,
    z: START_Z - row * CELL,
  });
  // Outer north and west boundaries.
  for (let i = 0; i < GRID; i++) {
    const north = center(0, i);
    walls.push({ x: north.x, z: north.z + CELL / 2, width: CELL + WALL_THICKNESS, depth: WALL_THICKNESS });
    const west = center(i, 0);
    walls.push({ x: west.x - CELL / 2, z: west.z, width: WALL_THICKNESS, depth: CELL + WALL_THICKNESS });
  }
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const p = center(row, col);
      if (east[row][col]) walls.push({ x: p.x + CELL / 2, z: p.z, width: WALL_THICKNESS, depth: CELL + WALL_THICKNESS });
      if (south[row][col]) walls.push({ x: p.x, z: p.z - CELL / 2, width: CELL + WALL_THICKNESS, depth: WALL_THICKNESS });
    }
  }
  const cells: Array<[number, number]> = [[GRID - 1, GRID - 1]];
  while (cells[0][0] !== 0 || cells[0][1] !== 0) {
    const parent = parents.get(`${cells[0][0]}:${cells[0][1]}`);
    if (!parent) break;
    cells.unshift(parent);
  }
  return {
    walls,
    route: cells.map(([row, col]) => center(row, col)),
  };
}

function ExitThreshold() {
  const crossed = useRef(false);
  const x = DOJO_EXIT_X;
  const z = DOJO_EXIT_Z;
  const y = (LEVELS - 1) * LEVEL_HEIGHT;

  useFrame(() => {
    if (
      crossed.current || Math.abs(playerPos.y - (y + 1.75)) > 2 ||
      Math.hypot(playerPos.x - x, playerPos.z - z) > 1.8
    ) return;
    crossed.current = true;
    useDreamStore.getState().setMazeEndingAt(Date.now());
  });

  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 2.3, 0]} rotation={[0, Math.PI / 4, 0]}>
        <octahedronGeometry args={[0.75, 0]} />
        <meshStandardMaterial color="#e8d68a" emissive="#9c6d25" emissiveIntensity={2.2} roughness={0.35} />
      </mesh>
      <pointLight position={[0, 2.5, 0]} color="#f0b84e" intensity={38} distance={12} decay={1.8} />
      <mesh position={[-1.8, 2.6, 0]}><boxGeometry args={[0.3, 5.2, 0.45]} /><meshStandardMaterial color="#341b12" /></mesh>
      <mesh position={[1.8, 2.6, 0]}><boxGeometry args={[0.3, 5.2, 0.45]} /><meshStandardMaterial color="#341b12" /></mesh>
      <mesh position={[0, 4.8, 0]}><boxGeometry args={[4.2, 0.4, 0.55]} /><meshStandardMaterial color="#341b12" /></mesh>
    </group>
  );
}

function StairThreshold({ level }: { level: number }) {
  const camera = useThree((state) => state.camera);
  const transitionStarted = useRef<number | null>(null);
  const teleported = useRef(false);
  const y = level * LEVEL_HEIGHT;
  const doorZ = DOJO_EXIT_Z - 2.15;

  useFrame(({ clock }) => {
    if (transitionStarted.current !== null) {
      if (!teleported.current && clock.elapsedTime - transitionStarted.current >= 0.48) {
        teleported.current = true;
        camera.position.set(START_X, (level + 1) * LEVEL_HEIGHT + 1.75, START_Z);
        playerPos.copy(camera.position);
      }
      return;
    }
    const close =
      Math.abs(playerPos.y - (y + 1.75)) < 3.2 &&
      Math.hypot(playerPos.x - DOJO_EXIT_X, playerPos.z - doorZ) < 1.15;
    if (!close) return;
    transitionStarted.current = clock.elapsedTime;
    soundEffects.play("transition", 0.68);
    useDreamStore.getState().setFloorTransitionAt(Date.now());
  });

  return (
    <group position={[DOJO_EXIT_X, y, DOJO_EXIT_Z]}>
      {Array.from({ length: 9 }, (_, index) => (
        <mesh key={index} position={[0, 0.1 + index * 0.12, 2.05 - index * 0.48]}>
          <boxGeometry args={[4.9, 0.2 + index * 0.24, 0.52]} />
          <meshStandardMaterial color={index % 2 ? "#59402a" : "#46301f"} roughness={0.9} />
        </mesh>
      ))}
      <group position={[0, 0, -2.35]}>
        <mesh position={[0, 2.35, 0]}>
          <boxGeometry args={[3.65, 4.7, 0.28]} />
          <meshStandardMaterial color="#7c602f" roughness={0.82} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 2.05, 2.55, 0]}>
            <boxGeometry args={[0.42, 5.1, 0.48]} />
            <meshStandardMaterial color="#2d170f" roughness={0.88} />
          </mesh>
        ))}
        <mesh position={[0, 5.0, 0]}>
          <boxGeometry args={[4.55, 0.48, 0.5]} />
          <meshStandardMaterial color="#2d170f" roughness={0.88} />
        </mesh>
        <mesh position={[0, 2.7, -0.17]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.58, 0.58, 0.08]} />
          <meshStandardMaterial color="#d6c45d" emissive="#8f7729" emissiveIntensity={1.4} />
        </mesh>
      </group>
      <pointLight position={[0, 3.1, -1.8]} color="#e2ca62" intensity={42} distance={11} decay={2} />
    </group>
  );
}

export function DojoMaze({ seedNum }: { seedNum: number }) {
  const mazeEndingAt = useDreamStore((state) => state.mazeEndingAt);
  const levelLayouts = useMemo(
    () => Array.from({ length: LEVELS }, (_, level) => generateMaze(seedNum ^ Math.imul(level + 1, 0x45d9f3b))),
    [seedNum]
  );
  const textures = useMemo(() => getDetailTextures(seedNum), [seedNum]);
  const floorMap = useMemo(() => makeTatamiTexture(seedNum), [seedNum]);
  const wallMap = useMemo(() => repeated(textures.ground, 2, 2), [textures]);
  const centerX = START_X + ((GRID - 1) * CELL) / 2;
  const centerZ = START_Z - ((GRID - 1) * CELL) / 2;
  const span = GRID * CELL;

  useEffect(() => {
    const colliders: Collider[] = levelLayouts.flatMap((layout, level) =>
      layout.walls.map((wall) => ({
        x: wall.x,
        z: wall.z,
        r: 0,
        halfX: wall.width / 2,
        halfZ: wall.depth / 2,
        yMin: level * LEVEL_HEIGHT,
        yMax: level * LEVEL_HEIGHT + WALL_HEIGHT,
      }))
    );
    addColliders("dojo-maze", colliders);
    return () => removeColliders("dojo-maze");
  }, [levelLayouts]);

  useEffect(() => {
    if (!mazeEndingAt) return;
    const timeout = window.setTimeout(() => useDreamStore.getState().returnFromRift(), 4500);
    return () => window.clearTimeout(timeout);
  }, [mazeEndingAt]);

  if (mazeEndingAt) {
    return (
      <>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={1.8} color="#e8d7a0" />
        <EpilogueCat />
      </>
    );
  }

  return (
    <>
      <color attach="background" args={["#0b0c07"]} />
      <fog attach="fog" args={["#252410", 11, 45]} />
      <ambientLight intensity={0.68} color="#bbb568" />
      <directionalLight position={[10, 6, 8]} intensity={1.05} color="#eee68a" />

      {levelLayouts.map(({ walls }, level) => (
      <ActiveFloor key={`dojo-level-${level}`} level={level}>
      <group position={[0, level * LEVEL_HEIGHT, 0]}>
      <mesh position={[centerX, -0.12, centerZ]}>
        <boxGeometry args={[span, 0.24, span]} />
        <meshStandardMaterial color="#aaa66c" map={floorMap} bumpMap={floorMap} bumpScale={0.09} roughness={0.95} />
      </mesh>
      <mesh position={[centerX, WALL_HEIGHT, centerZ]}>
        <boxGeometry args={[span, 0.25, span]} />
        <meshStandardMaterial color="#171812" map={wallMap} roughness={1} />
      </mesh>

      {Array.from({ length: GRID + 1 }, (_, index) => (
        <group key={`tatami-seam-${index}`}>
          <mesh position={[START_X - CELL / 2 + index * CELL, 0.015, centerZ]}>
            <boxGeometry args={[0.08, 0.035, span]} />
            <meshStandardMaterial color="#454126" roughness={1} />
          </mesh>
          <mesh position={[centerX, 0.018, START_Z + CELL / 2 - index * CELL]}>
            <boxGeometry args={[span, 0.035, 0.08]} />
            <meshStandardMaterial color="#454126" roughness={1} />
          </mesh>
        </group>
      ))}

      {walls.map((wall, index) => (
        <group key={`${wall.x}:${wall.z}:${index}`}>
          <mesh position={[wall.x, WALL_HEIGHT / 2, wall.z]}>
            <boxGeometry args={[wall.width, WALL_HEIGHT, wall.depth]} />
            <meshStandardMaterial color="#c4c584" map={wallMap} bumpMap={wallMap} bumpScale={0.08} roughness={0.94} />
          </mesh>
          <mesh position={[wall.x, 0.16, wall.z]}>
            <boxGeometry args={[wall.width + 0.08, 0.32, wall.depth + 0.08]} />
            <meshStandardMaterial color="#382015" roughness={0.82} />
          </mesh>
          <mesh position={[wall.x, WALL_HEIGHT - 0.18, wall.z]}>
            <boxGeometry args={[wall.width + 0.08, 0.36, wall.depth + 0.08]} />
            <meshStandardMaterial color="#382015" roughness={0.82} />
          </mesh>
          <mesh position={[wall.x, WALL_HEIGHT * 0.52, wall.z]}>
            <boxGeometry args={[wall.width + 0.09, 0.18, wall.depth + 0.09]} />
            <meshStandardMaterial color="#4a2818" roughness={0.84} />
          </mesh>
          {[-0.5, 0, 0.5].map((offset) => {
            const horizontal = wall.width > wall.depth;
            return (
              <mesh
                key={offset}
                position={[
                  wall.x + (horizontal ? wall.width * offset : 0),
                  WALL_HEIGHT / 2,
                  wall.z + (horizontal ? 0 : wall.depth * offset),
                ]}
              >
                <boxGeometry args={horizontal ? [0.16, WALL_HEIGHT, wall.depth + 0.1] : [wall.width + 0.1, WALL_HEIGHT, 0.16]} />
                <meshStandardMaterial color="#4a2818" roughness={0.84} />
              </mesh>
            );
          })}
        </group>
      ))}

      {Array.from({ length: 8 }, (_, index) => {
        const col = (index * 4 + 2) % GRID;
        const row = (index * 7 + 1) % GRID;
        return (
          <pointLight
            key={index}
            position={[START_X + col * CELL, 4.4, START_Z - row * CELL]}
            color={index % 3 === 0 ? "#a9b85a" : "#e4b750"}
            intensity={16}
            distance={13}
            decay={2}
          />
        );
      })}
      </group>
      </ActiveFloor>
      ))}
      {Array.from({ length: LEVELS - 1 }, (_, level) => (
        <StairThreshold key={`stairs-${level}`} level={level} />
      ))}
      <Suspense fallback={null}>
        <DojoAnimals
          seedNum={seedNum}
          levels={LEVELS}
          levelHeight={LEVEL_HEIGHT}
          routes={levelLayouts.map((layout) => layout.route)}
        />
      </Suspense>
      <ExitThreshold />
    </>
  );
}
