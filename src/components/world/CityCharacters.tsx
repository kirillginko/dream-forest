"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface CityCharacterData {
  x: number;
  z: number;
  variant: number;
  scale: number;
  speed: number;
  phase: number;
  radius: number;
  color: string;
  accent: string;
}

function FaceWalker({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <mesh position={[0, 1.25, 0]} scale={[0.65, 0.85, 0.48]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={accent} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 2.65, 0.05]} scale={[1.1, 1.25, 0.7]}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.08} roughness={0.95} flatShading />
      </mesh>
      {[-0.38, 0.38].map((x) => (
        <mesh key={x} position={[x, 2.82, 0.68]} scale={[0.23, 0.12, 0.08]}>
          <sphereGeometry args={[1, 8, 5]} />
          <meshBasicMaterial color="#090507" />
        </mesh>
      ))}
      <mesh position={[0, 2.28, 0.72]} scale={[0.42, 0.07, 0.06]}>
        <boxGeometry />
        <meshBasicMaterial color="#351018" />
      </mesh>
    </>
  );
}

function HornedCyclops({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <mesh position={[0, 1.75, 0]} scale={[1.15, 1.45, 0.7]} rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.16} roughness={0.75} flatShading />
      </mesh>
      <mesh position={[0, 2.0, 0.78]} scale={[0.48, 0.28, 0.12]}>
        <sphereGeometry args={[1, 10, 6]} />
        <meshBasicMaterial color="#e9e0b8" />
      </mesh>
      <mesh position={[0, 2.0, 0.9]} scale={[0.13, 0.18, 0.06]}>
        <sphereGeometry args={[1, 8, 5]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      {[-0.58, 0.58].map((x) => (
        <mesh key={x} position={[x, 3.1, 0]} rotation={[0, 0, x < 0 ? 0.3 : -0.3]}>
          <coneGeometry args={[0.18, 1.25, 5]} />
          <meshStandardMaterial color="#b77770" flatShading />
        </mesh>
      ))}
    </>
  );
}

function RoundCharm({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <mesh position={[0, 1.35, 0]} scale={[1.15, 1.0, 0.8]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.07} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, 2.55, 0]} scale={[0.72, 0.68, 0.65]}>
        <boxGeometry />
        <meshStandardMaterial color="#e2c9ad" roughness={1} flatShading />
      </mesh>
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, 2.68, 0.66]}>
          <sphereGeometry args={[0.12, 7, 5]} />
          <meshBasicMaterial color={accent} />
        </mesh>
      ))}
      <mesh position={[0, 2.36, 0.67]} scale={[0.28, 0.08, 0.05]}>
        <boxGeometry />
        <meshBasicMaterial color="#21070d" />
      </mesh>
    </>
  );
}

function LongCrawler({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <mesh position={[0, 0.75, 0]} scale={[1.3, 0.5, 0.75]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={accent} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 1.75, 0.18]} scale={[0.62, 1.25, 0.56]}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.08} roughness={1} flatShading />
      </mesh>
      {[-0.24, 0.24].map((x) => (
        <mesh key={x} position={[x, 2.05, 0.72]}>
          <sphereGeometry args={[0.1, 7, 5]} />
          <meshBasicMaterial color="#080508" />
        </mesh>
      ))}
    </>
  );
}

export function CityCharacter({ data }: { data: CityCharacterData }) {
  const root = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const travel = clock.elapsedTime * data.speed + data.phase;
    const x = data.x + Math.cos(travel) * data.radius;
    const z = data.z + Math.sin(travel * 0.83) * data.radius * 0.72;
    const vx = -Math.sin(travel) * data.radius * data.speed;
    const vz = Math.cos(travel * 0.83) * data.radius * 0.72 * data.speed * 0.83;
    const step = Math.sin(travel * 7.0);
    if (root.current) {
      root.current.position.set(x, Math.abs(step) * 0.08, z);
      root.current.rotation.y = Math.atan2(vx, vz);
    }
    if (leftLeg.current) leftLeg.current.rotation.x = step * 0.65;
    if (rightLeg.current) rightLeg.current.rotation.x = -step * 0.65;
    if (leftArm.current) leftArm.current.rotation.x = -step * 0.5;
    if (rightArm.current) rightArm.current.rotation.x = step * 0.5;
  });

  return (
    <group ref={root} scale={data.scale}>
      {data.variant === 0 ? <FaceWalker color={data.color} accent={data.accent} /> :
        data.variant === 1 ? <HornedCyclops color={data.color} accent={data.accent} /> :
          data.variant === 2 ? <RoundCharm color={data.color} accent={data.accent} /> :
            <LongCrawler color={data.color} accent={data.accent} />}
      {([-1, 1] as const).map((side) => (
        <group
          key={`leg-${side}`}
          ref={side < 0 ? leftLeg : rightLeg}
          position={[side * 0.48, 0.7, 0]}
        >
          <mesh position={[0, -0.45, 0]}>
            <capsuleGeometry args={[0.16, 0.7, 3, 6]} />
            <meshStandardMaterial color={data.accent} roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
      {([-1, 1] as const).map((side) => (
        <group
          key={`arm-${side}`}
          ref={side < 0 ? leftArm : rightArm}
          position={[side * 0.85, 1.45, 0]}
          rotation={[0, 0, side * 0.28]}
        >
          <mesh position={[0, -0.5, 0]}>
            <capsuleGeometry args={[0.13, 0.8, 3, 6]} />
            <meshStandardMaterial color={data.color} roughness={0.95} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}
