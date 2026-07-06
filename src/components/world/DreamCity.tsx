"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { addColliders, removeColliders, type Collider } from "@/lib/collision";
import { mulberry32 } from "@/lib/seed";
import { playerPos } from "@/lib/store";
import { getDetailTextures } from "@/lib/textures";
import { DreamCrystal } from "../assets/DreamCrystal";
import { ShardPickups } from "../assets/Shards";
import { CITY_PALETTE } from "./palettes";
import type { Placement } from "./generateWorld";
import { CityCharacter, type CityCharacterData } from "./CityCharacters";

interface BuildingData {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  accent: string;
  sign: string;
  streetFace: -1 | 1;
  style: number;
  roof: number;
  storefront: boolean;
  balconies: boolean;
  kind: "house" | "shop" | "tower";
}

interface CityObjectData {
  type:
    | "bush"
    | "vending"
    | "bench"
    | "cone"
    | "utility"
    | "phone"
    | "television"
    | "shrine"
    | "mailbox"
    | "barrier";
  x: number;
  z: number;
  rotation: number;
  scale: number;
  color: string;
}

interface ParkData {
  x: number;
  z: number;
  seed: number;
}

const SIGNS = ["夢", "夜", "出口", "喫茶", "東京", "月", "ホテル", "電気"];
const WALLS = ["#76677d", "#836b73", "#5f7183", "#786f68", "#705e79"];
const NEON = ["#ff3caa", "#39e7ff", "#ff7048", "#a77bff", "#ffe264"];
const CITY_COLLIDER_KEY = "dream-city";
const CITY_CHUNK_WIDTH = 84;
const CITY_CHUNK_DEPTH = 72;
const CITY_CHUNK_RING = 1;

function createSignTexture(text: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#09060f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 112, 240);
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 54px sans-serif";
  [...text].slice(0, 3).forEach((character, index, characters) => {
    const spacing = 62;
    const start = 128 - ((characters.length - 1) * spacing) / 2;
    ctx.fillText(character, 64, start + index * spacing);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

function NeonSign({ building }: { building: BuildingData }) {
  const texture = useMemo(
    () => createSignTexture(building.sign, building.accent),
    [building.sign, building.accent]
  );
  useEffect(() => () => texture.dispose(), [texture]);
  const facesStreet = building.streetFace;

  return (
    <mesh
      position={[
        building.x + facesStreet * (building.width / 2 + 0.16),
        Math.min(building.height - 3, 8.5),
        building.z - building.depth * 0.2,
      ]}
      rotation={[0, facesStreet > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
    >
      <planeGeometry args={[2.2, 4.5]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function Building({
  building,
  index,
  seedNum,
}: {
  building: BuildingData;
  index: number;
  seedNum: number;
}) {
  const detail = getDetailTextures(seedNum).stone;
  const floors = Math.max(2, Math.floor(building.height / 3.1));
  const windows = [];
  const streetFace = building.streetFace;
  const windowColumns = Math.max(2, Math.min(4, Math.floor(building.depth / 3.5)));
  for (let floor = 1; floor < floors; floor++) {
    for (let column = 0; column < windowColumns; column++) {
      const lit = (floor * 7 + column * 3 + index) % 4 !== 0;
      const columnOffset = (column - (windowColumns - 1) / 2) * 2.45;
      windows.push(
        <mesh
          key={`${floor}:${column}`}
          position={[
            building.x + streetFace * (building.width / 2 + 0.02),
            1.7 + floor * 2.85,
            building.z + columnOffset,
          ]}
          rotation={[0, streetFace > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
        >
          <planeGeometry args={[1.25, 1.35]} />
          <meshStandardMaterial
            color={lit ? building.accent : "#090810"}
            emissive={lit ? building.accent : "#000000"}
            emissiveIntensity={lit ? 1.8 : 0}
            toneMapped={false}
          />
        </mesh>
      );
    }
  }

  return (
    <group>
      <mesh position={[building.x, building.height / 2, building.z]}>
        <boxGeometry args={[building.width, building.height, building.depth]} />
        <meshStandardMaterial
          color={building.color}
          roughness={0.92}
          flatShading
          map={detail}
          bumpMap={detail}
          bumpScale={0.18}
          emissive={building.color}
          emissiveIntensity={0.12}
        />
      </mesh>
      {building.kind === "house" && (
        <mesh
          position={[building.x, building.height + 1.45, building.z]}
          rotation={[0, Math.PI / 4, 0]}
          scale={[building.width * 0.52, 1, building.depth * 0.52]}
        >
          <coneGeometry args={[1, 2.9, 4]} />
          <meshStandardMaterial color="#29182f" roughness={0.95} flatShading />
        </mesh>
      )}
      {building.style === 1 && (
        <mesh position={[building.x, building.height * 0.62, building.z]}>
          <boxGeometry args={[building.width + 0.35, 0.5, building.depth + 0.35]} />
          <meshStandardMaterial color={building.accent} emissive={building.accent} emissiveIntensity={0.35} />
        </mesh>
      )}
      {building.style === 2 && (
        <mesh position={[building.x, building.height * 0.78, building.z]}>
          <boxGeometry args={[building.width * 0.72, building.height * 0.42, building.depth * 0.78]} />
          <meshStandardMaterial color="#12101c" roughness={0.9} />
        </mesh>
      )}
      {building.storefront && (
        <>
          <mesh
            position={[
              building.x + streetFace * (building.width / 2 + 0.2),
              1.35,
              building.z,
            ]}
          >
            <boxGeometry args={[0.35, 2.7, building.depth * 0.72]} />
            <meshStandardMaterial color="#332118" emissive="#ff9a4a" emissiveIntensity={0.8} />
          </mesh>
          <mesh
            position={[
              building.x + streetFace * (building.width / 2 + 0.55),
              3.0,
              building.z,
            ]}
            rotation={[0, 0, streetFace * -0.12]}
          >
            <boxGeometry args={[1.1, 0.2, building.depth * 0.8]} />
            <meshStandardMaterial color={building.accent} emissive={building.accent} emissiveIntensity={0.45} />
          </mesh>
        </>
      )}
      {building.balconies && [0.38, 0.58, 0.78].map((level) => (
        <mesh
          key={level}
          position={[
            building.x + streetFace * (building.width / 2 + 0.55),
            building.height * level,
            building.z,
          ]}
        >
          <boxGeometry args={[1.1, 0.18, building.depth * 0.82]} />
          <meshStandardMaterial color="#292234" metalness={0.45} roughness={0.6} />
        </mesh>
      ))}
      {windows}
      {building.storefront && <NeonSign building={building} />}
      {building.kind !== "house" && <mesh position={[building.x, building.height + 0.35, building.z]}>
        <boxGeometry args={[building.width * 0.8, 0.7, building.depth * 0.7]} />
        <meshStandardMaterial color="#0b0911" />
      </mesh>}
      {building.kind !== "house" && building.roof === 0 && (
        <mesh position={[building.x, building.height + 1.45, building.z]}>
          <cylinderGeometry args={[1.3, 1.3, 1.7, 8]} />
          <meshStandardMaterial color="#24202b" metalness={0.6} roughness={0.55} />
        </mesh>
      )}
      {building.kind !== "house" && building.roof === 1 && (
        <group position={[building.x, building.height + 2.1, building.z]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.08, 0.11, 4, 5]} />
            <meshStandardMaterial color="#17131e" />
          </mesh>
          <mesh position={[0.7, 2.8, 0]} rotation={[0, 0, -0.35]}>
            <boxGeometry args={[1.8, 0.08, 0.08]} />
            <meshBasicMaterial color={building.accent} toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function CityObject({ object, seedNum }: { object: CityObjectData; seedNum: number }) {
  const foliage = getDetailTextures(seedNum).foliage;
  if (object.type === "bush") {
    return (
      <group position={[object.x, 0, object.z]} rotation={[0, object.rotation, 0]} scale={object.scale}>
        <mesh position={[-0.45, 0.65, 0]}>
          <dodecahedronGeometry args={[0.72, 0]} />
          <meshStandardMaterial color={object.color} emissive={object.color} emissiveIntensity={0.1} roughness={1} flatShading map={foliage} bumpMap={foliage} bumpScale={0.28} />
        </mesh>
        <mesh position={[0.42, 0.55, 0.18]}>
          <dodecahedronGeometry args={[0.62, 0]} />
          <meshStandardMaterial color="#6e9b65" emissive="#31502c" emissiveIntensity={0.14} roughness={1} flatShading map={foliage} bumpMap={foliage} bumpScale={0.28} />
        </mesh>
      </group>
    );
  }
  if (object.type === "vending") {
    return (
      <group position={[object.x, 0, object.z]} rotation={[0, object.rotation, 0]} scale={object.scale}>
        <mesh position={[0, 1.15, 0]}>
          <boxGeometry args={[1.25, 2.3, 0.85]} />
          <meshStandardMaterial color="#d9d2dd" roughness={0.55} />
        </mesh>
        <mesh position={[0, 1.35, 0.44]}>
          <planeGeometry args={[0.92, 1.25]} />
          <meshBasicMaterial color={object.color} toneMapped={false} />
        </mesh>
      </group>
    );
  }
  if (object.type === "bench") {
    return (
      <group position={[object.x, 0, object.z]} rotation={[0, object.rotation, 0]} scale={object.scale}>
        <mesh position={[0, 0.65, 0]}><boxGeometry args={[2.4, 0.18, 0.6]} /><meshStandardMaterial color="#49312d" /></mesh>
        <mesh position={[0, 1.05, 0.26]} rotation={[-0.15, 0, 0]}><boxGeometry args={[2.4, 0.8, 0.12]} /><meshStandardMaterial color="#49312d" /></mesh>
        {[-0.85, 0.85].map((x) => <mesh key={x} position={[x, 0.3, 0]}><boxGeometry args={[0.12, 0.6, 0.45]} /><meshStandardMaterial color="#18151d" /></mesh>)}
      </group>
    );
  }
  if (object.type === "cone") {
    return (
      <mesh position={[object.x, 0.55 * object.scale, object.z]} rotation={[0, object.rotation, 0]}>
        <coneGeometry args={[0.38 * object.scale, 1.1 * object.scale, 6]} />
        <meshStandardMaterial color="#ff7048" emissive="#ff341c" emissiveIntensity={0.22} />
      </mesh>
    );
  }
  if (object.type === "phone") {
    return (
      <group position={[object.x, 0, object.z]} rotation={[0, object.rotation, 0]} scale={object.scale}>
        <mesh position={[0, 1.25, 0]}><boxGeometry args={[1.25, 2.5, 1]} /><meshStandardMaterial color="#5e1724" roughness={0.8} /></mesh>
        <mesh position={[0, 1.48, 0.51]}><planeGeometry args={[0.82, 1.25]} /><meshBasicMaterial color="#1e6a66" toneMapped={false} /></mesh>
        <mesh position={[-0.35, 1.58, 0.58]} rotation={[0, 0, -0.18]}><capsuleGeometry args={[0.08, 0.62, 3, 5]} /><meshStandardMaterial color="#111016" /></mesh>
        <mesh position={[0, 2.7, 0]}><boxGeometry args={[1.45, 0.28, 1.15]} /><meshBasicMaterial color={object.color} toneMapped={false} /></mesh>
      </group>
    );
  }
  if (object.type === "television") {
    return (
      <group position={[object.x, 0, object.z]} rotation={[0, object.rotation, 0]} scale={object.scale}>
        <mesh position={[0, 0.75, 0]}><boxGeometry args={[1.7, 1.35, 1.1]} /><meshStandardMaterial color="#302d35" roughness={0.85} /></mesh>
        <mesh position={[0, 0.82, 0.57]}><planeGeometry args={[1.25, 0.88]} /><meshBasicMaterial color={object.color} toneMapped={false} /></mesh>
        {[-0.32, 0.32].map((x) => <mesh key={x} position={[x, 1.75, 0]} rotation={[0, 0, x < 0 ? -0.38 : 0.38]}><cylinderGeometry args={[0.025, 0.025, 1, 4]} /><meshStandardMaterial color="#17141b" /></mesh>)}
      </group>
    );
  }
  if (object.type === "shrine") {
    return (
      <group position={[object.x, 0, object.z]} rotation={[0, object.rotation, 0]} scale={object.scale}>
        {[-0.85, 0.85].map((x) => <mesh key={x} position={[x, 1.45, 0]}><boxGeometry args={[0.2, 2.9, 0.24]} /><meshStandardMaterial color="#8a2526" /></mesh>)}
        <mesh position={[0, 2.72, 0]}><boxGeometry args={[2.3, 0.23, 0.34]} /><meshStandardMaterial color="#9e2e28" /></mesh>
        <mesh position={[0, 3.02, 0]}><boxGeometry args={[2.75, 0.16, 0.28]} /><meshStandardMaterial color="#9e2e28" /></mesh>
        <mesh position={[0, 1.8, 0]}><boxGeometry args={[1.9, 0.16, 0.2]} /><meshStandardMaterial color="#6e1c20" /></mesh>
        <mesh position={[0, 2.28, 0.08]}><sphereGeometry args={[0.22, 6, 4]} /><meshBasicMaterial color={object.color} toneMapped={false} /></mesh>
      </group>
    );
  }
  if (object.type === "mailbox") {
    return (
      <group position={[object.x, 0, object.z]} rotation={[0, object.rotation, 0]} scale={object.scale}>
        <mesh position={[0, 0.9, 0]}><boxGeometry args={[0.9, 1.65, 0.75]} /><meshStandardMaterial color="#8b2830" roughness={0.8} /></mesh>
        <mesh position={[0, 1.78, 0]}><cylinderGeometry args={[0.45, 0.45, 0.75, 8, 1, false, 0, Math.PI]} /><meshStandardMaterial color="#9d3339" /></mesh>
        <mesh position={[0, 1.15, 0.39]}><boxGeometry args={[0.58, 0.08, 0.04]} /><meshBasicMaterial color="#f0cf80" /></mesh>
      </group>
    );
  }
  if (object.type === "barrier") {
    return (
      <group position={[object.x, 0, object.z]} rotation={[0, object.rotation, 0]} scale={object.scale}>
        <mesh position={[0, 1.05, 0]}><boxGeometry args={[2.8, 0.38, 0.18]} /><meshStandardMaterial color={object.color} emissive={object.color} emissiveIntensity={0.16} /></mesh>
        {[-1.05, 1.05].map((x) => <group key={x}><mesh position={[x, 0.55, 0]}><boxGeometry args={[0.14, 1.1, 0.14]} /><meshStandardMaterial color="#27232d" /></mesh><mesh position={[x, 0.08, 0]}><boxGeometry args={[0.75, 0.14, 0.45]} /><meshStandardMaterial color="#27232d" /></mesh></group>)}
      </group>
    );
  }
  return (
    <group position={[object.x, 0, object.z]} rotation={[0, object.rotation, 0]} scale={object.scale}>
      <mesh position={[0, 3.4, 0]}><cylinderGeometry args={[0.09, 0.14, 6.8, 6]} /><meshStandardMaterial color="#17131e" /></mesh>
      <mesh position={[0.55, 6.4, 0]}><boxGeometry args={[1.6, 0.1, 0.1]} /><meshStandardMaterial color="#17131e" /></mesh>
      <mesh position={[1.2, 6.15, 0]}><sphereGeometry args={[0.24, 6, 4]} /><meshBasicMaterial color={object.color} toneMapped={false} /></mesh>
    </group>
  );
}

const GROUND_VERTEX = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const GROUND_FRAGMENT = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  varying vec3 vWorld;
  void main() {
    vec2 cell = floor(vWorld.xz * 0.32);
    float checker = mod(cell.x + cell.y, 2.0);
    float wave = sin(vWorld.x * 0.22 + uTime * 0.35) * sin(vWorld.z * 0.18 - uTime * 0.23);
    vec3 purple = vec3(0.20, 0.02, 0.35);
    vec3 cyan = vec3(0.00, 0.35, 0.45);
    vec3 magenta = vec3(0.55, 0.01, 0.28);
    vec3 color = mix(purple, cyan, checker * 0.42 + 0.18);
    color = mix(color, magenta, smoothstep(0.2, 0.9, wave) * 0.55);
    gl_FragColor = vec4(color, 1.0);
    #include <fog_fragment>
  }
`;

function UnstableGround() {
  const ground = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
          uTime: { value: 0 },
        },
        vertexShader: GROUND_VERTEX,
        fragmentShader: GROUND_FRAGMENT,
        fog: true,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    ground.current?.position.set(playerPos.x, -0.04, playerPos.z);
  });
  return (
    <mesh ref={ground} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[700, 700, 1, 1]} />
    </mesh>
  );
}

const CITY_SKY_VERTEX = /* glsl */ `
  varying vec3 vPosition;
  void main() {
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CITY_SKY_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec3 vPosition;

  void main() {
    vec3 direction = normalize(vPosition);
    float longitude = atan(direction.z, direction.x);
    float latitude = asin(direction.y);
    float time = uTime * 0.055;

    float folded = sin(longitude * 3.0 + time * 1.7 + sin(latitude * 5.0 - time) * 1.8);
    float ribbons = sin(latitude * 8.0 - time * 1.3 + folded * 2.1);
    float spiral = sin(longitude * 5.0 - latitude * 4.0 + time * 0.8);
    float bloom = smoothstep(-0.7, 0.9, folded + ribbons * 0.55);
    float veins = smoothstep(0.35, 0.95, spiral * ribbons);

    vec3 midnight = vec3(0.004, 0.007, 0.006);
    vec3 bloodRed = vec3(0.17, 0.012, 0.009);
    vec3 nightGreen = vec3(0.025, 0.12, 0.045);
    vec3 ember = vec3(0.18, 0.035, 0.012);
    vec3 color = mix(midnight, bloodRed, bloom * 0.26);
    color = mix(color, nightGreen, smoothstep(-0.3, 0.9, ribbons) * 0.18);
    color += ember * veins * 0.045;

    float horizon = 1.0 - smoothstep(-0.25, 0.2, direction.y);
    color = mix(color, midnight, horizon * 0.72);
    float grain = fract(sin(dot(direction.xz * 460.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    color += (grain - 0.5) * 0.004;
    gl_FragColor = vec4(max(color, 0.0), 1.0);
  }
`;

function PsychedelicCitySky() {
  const sky = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: CITY_SKY_VERTEX,
        fragmentShader: CITY_SKY_FRAGMENT,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    sky.current?.position.set(playerPos.x, 0, playerPos.z);
  });
  return (
    <mesh ref={sky} renderOrder={-2} frustumCulled={false} material={material}>
      <sphereGeometry args={[250, 32, 20]} />
    </mesh>
  );
}

function CityAtmosphere() {
  const scene = useThree((state) => state.scene);
  const fog = useRef(new THREE.FogExp2(CITY_PALETTE.fog, 0.037));
  useEffect(() => {
    scene.fog = fog.current;
    scene.background = new THREE.Color(CITY_PALETTE.sky);
  }, [scene]);
  useFrame(({ clock }) => {
    fog.current.density = 0.036 + Math.sin(clock.elapsedTime * 0.045) * 0.003;
  });
  return null;
}

function chunkSeed(seedNum: number, cx: number, cz: number): number {
  let value = seedNum ^ Math.imul(cx, 0x27d4eb2f) ^ Math.imul(cz, 0x165667b1);
  value = Math.imul(value ^ (value >>> 15), 0x85ebca6b);
  return (value ^ (value >>> 13)) >>> 0;
}

function isLonelyDistrict(seedNum: number, cx: number, cz: number): boolean {
  if (cx === 0 && cz === 0) return false;
  return chunkSeed(seedNum ^ 0xa54ff53a, cx, cz) % 100 < 24;
}

function isParkCell(seedNum: number, column: number, row: number): boolean {
  let value = seedNum ^ Math.imul(column, 0x6c8e9cf5) ^ Math.imul(row, 0x4f1bbcdc);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) % 100 < 18;
}

function generateCityParks(seedNum: number, cx: number, cz: number): ParkData[] {
  if (isLonelyDistrict(seedNum, cx, cz)) return [];
  const parks: ParkData[] = [];
  for (let localX = -1; localX <= 0; localX++) {
    for (let localZ = -1; localZ <= 0; localZ++) {
      const column = cx * 2 + localX;
      const row = cz * 2 + localZ;
      if (!isParkCell(seedNum, column, row)) continue;
      parks.push({
        x: (column + 0.5) * 42,
        z: (row + 0.5) * 36,
        seed: chunkSeed(seedNum ^ 0x3c6ef372, column, row),
      });
    }
  }
  return parks;
}

function generateCityBuildings(seedNum: number, cx: number, cz: number): BuildingData[] {
  const rng = mulberry32(chunkSeed(seedNum ^ 0x51d3c17, cx, cz));
  const result: BuildingData[] = [];
  const lonely = isLonelyDistrict(seedNum, cx, cz);

  // Each chunk contains four city blocks. Global cell coordinates keep the
  // street lattice and building positions continuous across chunk borders.
  for (let localX = -1; localX <= 0; localX++) {
    for (let localZ = -1; localZ <= 0; localZ++) {
      const column = cx * 2 + localX;
      const row = cz * 2 + localZ;
      if (isParkCell(seedNum, column, row)) continue;
      if (lonely && rng() > 0.2) continue;
      const cellX = (column + 0.5) * 42;
      const cellZ = (row + 0.5) * 36;
      const count = rng() < 0.72 ? 1 : 2;

      for (let slot = 0; slot < count; slot++) {
        const kindRoll = rng();
        const kind: BuildingData["kind"] = lonely
          ? kindRoll < 0.78 ? "house" : "shop"
          : kindRoll < 0.58 ? "house" : kindRoll < 0.88 ? "shop" : "tower";
        const depth = kind === "house" ? 7 + rng() * 4 : kind === "shop" ? 9 + rng() * 5 : 12 + rng() * 5;
        const slotOffset = (slot - (count - 1) / 2) * 15;
        const streetFace: -1 | 1 = rng() < 0.5 ? -1 : 1;
        const style = kind === "house" ? 0 : Math.floor(rng() * 4);
        result.push({
          x: cellX + (rng() - 0.5) * 12,
          z: cellZ + slotOffset + (rng() - 0.5) * 5,
          width: kind === "house" ? 8 + rng() * 5 : kind === "shop" ? 11 + rng() * 6 : 15 + rng() * 7,
          depth,
          height: kind === "house" ? 5.5 + rng() * 3.5 : kind === "shop" ? 7 + rng() * 8 : 25 + rng() * 28,
          color: WALLS[Math.floor(rng() * WALLS.length)],
          accent: NEON[Math.floor(rng() * NEON.length)],
          sign: SIGNS[Math.floor(rng() * SIGNS.length)],
          streetFace,
          style,
          roof: Math.floor(rng() * 3),
          storefront: kind === "shop" || (kind === "tower" && rng() < 0.7),
          balconies: kind !== "house" && rng() < 0.5,
          kind,
        });
      }
    }
  }
  return result;
}

function generateCityObjects(
  seedNum: number,
  cx: number,
  cz: number,
  buildings: BuildingData[],
  parks: ParkData[]
): CityObjectData[] {
  const rng = mulberry32(chunkSeed(seedNum ^ 0x9e3779b9, cx, cz));
  const result: CityObjectData[] = [];
  const centerX = cx * CITY_CHUNK_WIDTH;
  const centerZ = cz * CITY_CHUNK_DEPTH;
  const lonely = isLonelyDistrict(seedNum, cx, cz);
  const types: CityObjectData["type"][] = [
    "bush", "bush", "bush", "vending", "bench", "cone", "cone", "utility",
    "phone", "television", "shrine", "mailbox", "barrier",
  ];
  let guard = 0;
  const targetCount = lonely ? 6 : 30;
  while (result.length < targetCount && guard++ < 190) {
    const x = centerX + (rng() - 0.5) * (CITY_CHUNK_WIDTH - 8);
    const z = centerZ + (rng() - 0.5) * (CITY_CHUNK_DEPTH - 8);
    if (cx === 0 && cz === 0 && Math.hypot(x, z + 18) < 6) continue;
    const distanceToVerticalRoad = Math.abs(x - Math.round(x / 42) * 42);
    const distanceToHorizontalRoad = Math.abs(z - Math.round(z / 36) * 36);
    if (!lonely && (distanceToVerticalRoad < 5.2 || distanceToHorizontalRoad < 5.2)) continue;
    if (parks.some((park) => Math.abs(x - park.x) < 16.7 && Math.abs(z - park.z) < 13.7)) continue;
    if (
      buildings.some(
        (building) =>
          Math.abs(x - building.x) < building.width * 0.58 + 1.5 &&
          Math.abs(z - building.z) < building.depth * 0.58 + 1.5
      )
    ) continue;
    const type = types[Math.floor(rng() * types.length)];
    result.push({
      type,
      x,
      z,
      rotation: rng() * Math.PI * 2,
      scale: type === "bush" ? 0.65 + rng() * 0.8 : 0.8 + rng() * 0.35,
      color: type === "bush" ? (rng() < 0.5 ? "#75a35e" : "#9b679f") : NEON[Math.floor(rng() * NEON.length)],
    });
  }
  return result;
}

function generateCityShards(
  seedNum: number,
  cx: number,
  cz: number,
  buildings: BuildingData[]
): Placement[] {
  const rng = mulberry32(chunkSeed(seedNum ^ 0x6a09e667, cx, cz));
  if ((cx !== 0 || cz !== 0) && rng() > 0.72) return [];
  const centerX = cx * CITY_CHUNK_WIDTH;
  const centerZ = cz * CITY_CHUNK_DEPTH;
  for (let attempt = 0; attempt < 30; attempt++) {
    const x = centerX + (rng() - 0.5) * (CITY_CHUNK_WIDTH - 12);
    const z = centerZ + (rng() - 0.5) * (CITY_CHUNK_DEPTH - 12);
    if (cx === 0 && cz === 0 && Math.hypot(x, z + 18) < 7) continue;
    const blocked = buildings.some(
      (building) =>
        Math.abs(x - building.x) < building.width * 0.58 + 2 &&
        Math.abs(z - building.z) < building.depth * 0.58 + 2
    );
    if (!blocked) {
      return [{
        position: [x, 0, z],
        rotation: rng() * Math.PI * 2,
        scale: 0.9 + rng() * 0.35,
        tilt: 0,
        variant: rng(),
      }];
    }
  }
  return [];
}

function generateCityCharacters(
  seedNum: number,
  cx: number,
  cz: number,
  buildings: BuildingData[]
): CityCharacterData[] {
  const rng = mulberry32(chunkSeed(seedNum ^ 0xbb67ae85, cx, cz));
  const centerX = cx * CITY_CHUNK_WIDTH;
  const centerZ = cz * CITY_CHUNK_DEPTH;
  const result: CityCharacterData[] = [];
  const lonely = isLonelyDistrict(seedNum, cx, cz);
  const count = lonely ? (rng() < 0.55 ? 0 : 1) : 2 + Math.floor(rng() * 2);
  let guard = 0;
  while (result.length < count && guard++ < 80) {
    const radius = 2.5 + rng() * 3.5;
    const x = centerX + (rng() - 0.5) * (CITY_CHUNK_WIDTH - 20);
    const z = centerZ + (rng() - 0.5) * (CITY_CHUNK_DEPTH - 20);
    if (cx === 0 && cz === 0 && Math.hypot(x, z + 18) < 8) continue;
    const blocked = buildings.some(
      (building) =>
        Math.abs(x - building.x) < building.width * 0.58 + radius + 2 &&
        Math.abs(z - building.z) < building.depth * 0.58 + radius + 2
    );
    if (blocked) continue;
    result.push({
      x,
      z,
      variant: Math.floor(rng() * 4),
      scale: 0.72 + rng() * 0.48,
      speed: 0.16 + rng() * 0.16,
      phase: rng() * Math.PI * 2,
      radius,
      color: ["#d7aa91", "#d8c8a8", "#b8d36a", "#d6a0c2"][Math.floor(rng() * 4)],
      accent: NEON[Math.floor(rng() * NEON.length)],
    });
  }
  return result;
}

function collidersForBuildings(buildings: BuildingData[]): Collider[] {
  return buildings.flatMap((building) => {
    const radius = Math.min(building.width, building.depth) * 0.44;
    const count = Math.max(1, Math.ceil(building.width / (radius * 1.6)));
    return Array.from({ length: count }, (_, index) => ({
      x: building.x + (index - (count - 1) / 2) * radius * 1.5,
      z: building.z,
      r: radius,
    }));
  });
}

function CityRoads({ cx, cz }: { cx: number; cz: number }) {
  const centerX = cx * CITY_CHUNK_WIDTH;
  const centerZ = cz * CITY_CHUNK_DEPTH;
  return (
    <group>
      {[-42, 0, 42].map((offset) => {
        const x = centerX + offset;
        return (
          <group key={`road-x:${offset}`}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.015, centerZ]}>
              <planeGeometry args={[6.4, CITY_CHUNK_DEPTH + 0.3]} />
              <meshStandardMaterial color="#111116" roughness={0.88} metalness={0.08} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.028, centerZ]}>
              <planeGeometry args={[0.08, CITY_CHUNK_DEPTH + 0.3]} />
              <meshBasicMaterial color="#c8a85b" transparent opacity={0.45} />
            </mesh>
            {[-3.8, 3.8].flatMap((side) =>
              [-18, 18].map((segment) => (
                <mesh key={`${side}:${segment}`} position={[x + side, 0.12, centerZ + segment]}>
                  <boxGeometry args={[1.2, 0.22, 27.2]} />
                  <meshStandardMaterial color="#38333d" roughness={1} />
                </mesh>
              ))
            )}
          </group>
        );
      })}
      {[-36, 0, 36].map((offset) => {
        const z = centerZ + offset;
        return (
          <group key={`road-z:${offset}`}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0.018, z]}>
              <planeGeometry args={[CITY_CHUNK_WIDTH + 0.3, 6.4]} />
              <meshStandardMaterial color="#111116" roughness={0.88} metalness={0.08} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0.03, z]}>
              <planeGeometry args={[CITY_CHUNK_WIDTH + 0.3, 0.08]} />
              <meshBasicMaterial color="#c8a85b" transparent opacity={0.45} />
            </mesh>
            {[-3.8, 3.8].flatMap((side) =>
              [-21, 21].map((segment) => (
                <mesh key={`${side}:${segment}`} position={[centerX + segment, 0.13, z + side]}>
                  <boxGeometry args={[33.2, 0.22, 1.2]} />
                  <meshStandardMaterial color="#38333d" roughness={1} />
                </mesh>
              ))
            )}
          </group>
        );
      })}
      {[-42, 0, 42].flatMap((xOffset) =>
        [-36, 0, 36].flatMap((zOffset) =>
          ([-1, 1] as const).flatMap((xSide) =>
            ([-1, 1] as const).map((zSide) => (
              <mesh
                key={`corner:${xOffset}:${zOffset}:${xSide}:${zSide}`}
                position={[
                  centerX + xOffset + xSide * 3.8,
                  0.125,
                  centerZ + zOffset + zSide * 3.8,
                ]}
              >
                <boxGeometry args={[1.2, 0.22, 1.2]} />
                <meshStandardMaterial color="#38333d" roughness={1} />
              </mesh>
            ))
          )
        )
      )}
      {[-2.4, -1.2, 0, 1.2, 2.4].map((stripe) => (
        <mesh
          key={stripe}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[centerX + stripe, 0.04, centerZ + 5.1]}
        >
          <planeGeometry args={[0.55, 2.3]} />
          <meshBasicMaterial color="#d5d0c3" transparent opacity={0.58} />
        </mesh>
      ))}
    </group>
  );
}

function CityPark({ park, seedNum }: { park: ParkData; seedNum: number }) {
  const foliage = getDetailTextures(seedNum).foliage;
  const ground = getDetailTextures(seedNum).ground;
  const trees = useMemo(() => {
    const rng = mulberry32(park.seed);
    return Array.from({ length: 7 }, () => ({
      x: (rng() - 0.5) * 23,
      z: (rng() - 0.5) * 17,
      scale: 0.75 + rng() * 0.65,
      color: rng() < 0.5 ? "#4f7d3e" : "#667a35",
    }));
  }, [park.seed]);

  return (
    <group position={[park.x, 0, park.z]}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[33.25, 0.14, 27.25]} />
        <meshStandardMaterial color="#315c2f" map={ground} bumpMap={ground} bumpScale={0.18} roughness={1} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[2.2, 0.08, 26.6]} />
        <meshStandardMaterial color="#8b8070" roughness={1} />
      </mesh>
      {trees.map((tree, index) => (
        <group key={index} position={[tree.x, 0.14, tree.z]} scale={tree.scale}>
          <mesh position={[0, 1.35, 0]}>
            <cylinderGeometry args={[0.18, 0.28, 2.7, 6]} />
            <meshStandardMaterial color="#4b3829" roughness={1} />
          </mesh>
          <mesh position={[0, 3.0, 0]} scale={[1.1, 1.25, 1.0]}>
            <dodecahedronGeometry args={[1.05, 0]} />
            <meshStandardMaterial
              color={tree.color}
              emissive="#20371d"
              emissiveIntensity={0.1}
              map={foliage}
              bumpMap={foliage}
              bumpScale={0.25}
              roughness={1}
              flatShading
            />
          </mesh>
        </group>
      ))}
      {[-7.5, 7.5].map((z) => (
        <group key={z} position={[3.3, 0.12, z]} rotation={[0, Math.PI / 2, 0]}>
          <mesh position={[0, 0.62, 0]}><boxGeometry args={[2.2, 0.18, 0.55]} /><meshStandardMaterial color="#5b3d2e" /></mesh>
          <mesh position={[0, 1.0, 0.24]}><boxGeometry args={[2.2, 0.65, 0.12]} /><meshStandardMaterial color="#5b3d2e" /></mesh>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`park-edge-x-${side}`} position={[side * 16.5, 0.34, 0]}>
          <boxGeometry args={[0.18, 0.55, 27.25]} />
          <meshStandardMaterial color="#56505b" roughness={1} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`park-edge-z-${side}`} position={[0, 0.34, side * 13.5]}>
          <boxGeometry args={[33.25, 0.55, 0.18]} />
          <meshStandardMaterial color="#56505b" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function CityChunk({ seedNum, cx, cz }: { seedNum: number; cx: number; cz: number }) {
  const lonely = isLonelyDistrict(seedNum, cx, cz);
  const parks = useMemo(() => generateCityParks(seedNum, cx, cz), [seedNum, cx, cz]);
  const buildings = useMemo(
    () => generateCityBuildings(seedNum, cx, cz),
    [seedNum, cx, cz]
  );
  const objects = useMemo(
    () => generateCityObjects(seedNum, cx, cz, buildings, parks),
    [seedNum, cx, cz, buildings, parks]
  );
  const shards = useMemo(
    () => generateCityShards(seedNum, cx, cz, buildings),
    [seedNum, cx, cz, buildings]
  );
  const characters = useMemo(
    () => generateCityCharacters(seedNum, cx, cz, buildings),
    [seedNum, cx, cz, buildings]
  );
  const key = `${CITY_COLLIDER_KEY}:${cx}:${cz}`;

  useEffect(() => {
    addColliders(key, collidersForBuildings(buildings));
    return () => removeColliders(key);
  }, [key, buildings]);

  return (
    <group>
      {!lonely && <CityRoads cx={cx} cz={cz} />}
      {parks.map((park) => (
        <CityPark key={`${park.x}:${park.z}`} park={park} seedNum={seedNum} />
      ))}
      {buildings.map((building, index) => (
        <Building
          key={`${building.x}:${building.z}`}
          building={building}
          index={index + cx * 31 + cz * 17}
          seedNum={seedNum}
        />
      ))}
      {objects.map((object, index) => (
        <CityObject key={`${object.type}:${index}`} object={object} seedNum={seedNum} />
      ))}
      <ShardPickups
        placements={shards}
        palette={CITY_PALETTE}
        idPrefix={`${seedNum}:city:${cx}:${cz}`}
      />
      {characters.map((character, index) => (
        <CityCharacter key={`character:${index}`} data={character} />
      ))}
      {cx === 0 && cz === 0 && (
        <DreamCrystal
          position={[0, 0, -18]}
          palette={CITY_PALETTE}
          seedNum={seedNum}
          role="return-city"
        />
      )}
    </group>
  );
}

interface CityCoord {
  cx: number;
  cz: number;
}

function cityCoordKey({ cx, cz }: CityCoord): string {
  return `${cx}:${cz}`;
}

function cityChunkAt(x: number, z: number): [number, number] {
  return [Math.round(x / CITY_CHUNK_WIDTH), Math.round(z / CITY_CHUNK_DEPTH)];
}

function CityChunkField({ seedNum }: { seedNum: number }) {
  const initial = cityChunkAt(playerPos.x, playerPos.z);
  const [loaded, setLoaded] = useState<Map<string, CityCoord>>(
    () => new Map([[cityCoordKey({ cx: initial[0], cz: initial[1] }), { cx: initial[0], cz: initial[1] }]])
  );
  const center = useRef<[number, number]>(initial);
  const queue = useRef<CityCoord[]>([]);
  const timer = useRef(0);

  const rebuildQueue = (nextCenter: [number, number], loadedKeys: Set<string>) => {
    const wanted: (CityCoord & { distance: number })[] = [];
    for (let dx = -CITY_CHUNK_RING; dx <= CITY_CHUNK_RING; dx++) {
      for (let dz = -CITY_CHUNK_RING; dz <= CITY_CHUNK_RING; dz++) {
        const coord = { cx: nextCenter[0] + dx, cz: nextCenter[1] + dz };
        if (!loadedKeys.has(cityCoordKey(coord))) {
          wanted.push({ ...coord, distance: dx * dx + dz * dz });
        }
      }
    }
    wanted.sort((a, b) => a.distance - b.distance);
    queue.current = wanted;
  };

  useEffect(() => {
    rebuildQueue(center.current, new Set(loaded.keys()));
    // The queue only needs seeding once; subsequent rebuilds happen when the
    // player crosses a chunk boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    timer.current += delta;
    if (timer.current > 0.2) {
      timer.current = 0;
      const next = cityChunkAt(playerPos.x, playerPos.z);
      if (next[0] !== center.current[0] || next[1] !== center.current[1]) {
        center.current = next;
        setLoaded((previous) => {
          const kept = new Map<string, CityCoord>();
          for (const [key, coord] of previous) {
            if (
              Math.abs(coord.cx - next[0]) <= CITY_CHUNK_RING &&
              Math.abs(coord.cz - next[1]) <= CITY_CHUNK_RING
            ) {
              kept.set(key, coord);
            }
          }
          rebuildQueue(next, new Set(kept.keys()));
          return kept;
        });
      }
    }

    // One new district per frame avoids a large React/geometry spike.
    const nextChunk = queue.current.shift();
    if (nextChunk) {
      setLoaded((previous) => {
        const next = new Map(previous);
        next.set(cityCoordKey(nextChunk), nextChunk);
        return next;
      });
    }
  });

  return (
    <>
      {[...loaded.values()].map(({ cx, cz }) => (
        <CityChunk key={`${cx}:${cz}`} seedNum={seedNum} cx={cx} cz={cz} />
      ))}
    </>
  );
}

export function DreamCity({ seedNum }: { seedNum: number }) {
  return (
    <>
      <CityAtmosphere />
      <PsychedelicCitySky />
      <UnstableGround />
      <CityChunkField seedNum={seedNum} />
      <hemisphereLight args={["#71658f", "#21172a", 1.35]} />
      <directionalLight position={[20, 35, 10]} color="#9a8ee0" intensity={0.8} />
      <ambientLight color="#654b78" intensity={0.95} />
    </>
  );
}
