"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { audioEngine } from "@/lib/audio";
import { footsteps } from "@/lib/footsteps";
import { playerPos, playerYaw, useDreamStore } from "@/lib/store";
import { canMoveTo } from "@/lib/collision";
import { terrainHeight } from "../world/terrain";
import { hashString } from "@/lib/seed";
import { dojoFloorHeight } from "../world/DojoMaze";
import { soundEffects } from "@/lib/soundEffects";

const WALK_SPEED = 2.8;
const RUN_SPEED = 6.4;
const GROUND_HEIGHT = 1.75; // eye height above the terrain
// Low gravity + a matching jump strength: a slow, floaty arc instead of a
// sharp real-world hop — the dream should feel weightless underfoot.
const JUMP_STRENGTH = 5.5;
const GRAVITY = -7;
const LOOK_SPEED = 1.5; // arrow-key look, rad/s
const MOUSE_SENSITIVITY = 0.0022;
const DRAG_SENSITIVITY = 0.0045;
const PLAYER_RADIUS = 0.3;
const PITCH_LIMIT = Math.PI / 2 - 0.01;
// Meters of ground covered between footstep sounds. Running naturally
// triggers them more often since it covers this distance faster — no
// separate cadence needed.
const STEP_INTERVAL = 2.0;

/** Whether this document is allowed to use the Pointer Lock API at all
 * (embeds/iframes without the pointer-lock permission are not). */
function pointerLockAllowed(): boolean {
  if (typeof document === "undefined") return true;
  if (!("requestPointerLock" in Element.prototype)) return false;
  type FeaturePolicy = { allowsFeature?: (f: string) => boolean };
  const policy = (document as { featurePolicy?: FeaturePolicy }).featurePolicy;
  if (policy?.allowsFeature && !policy.allowsFeature("pointer-lock")) return false;
  return true;
}

function enterWorld() {
  const store = useDreamStore.getState();
  store.setLocked(true);
  // First click doubles as the audio-context gesture the soundtrack needs.
  audioEngine.usePlaylist();
  soundEffects.preload();
}

/**
 * First-person wanderer. Look with the mouse (pointer lock, or click-drag
 * where pointer lock is denied) or the arrow keys; move with WASD, Shift to
 * hurry, Space to jump. Walks the seeded heightfield and slides along
 * obstacles instead of stopping dead.
 */
export function Player() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);

  const yawObject = useRef(new THREE.Object3D());
  const pitchObject = useRef(new THREE.Object3D());
  const direction = useRef(new THREE.Vector3());
  const velocity = useRef(new THREE.Vector3());
  const isGrounded = useRef(true);
  const keys = useRef<Record<string, boolean>>({});
  const stepDistance = useRef(0);
  const lastFootPos = useRef(new THREE.Vector2());

  const seed = useDreamStore((s) => s.seed);
  const realm = useDreamStore((s) => s.realm);
  const seedNum = hashString(seed);
  const [canPointerLock, setCanPointerLock] = useState(pointerLockAllowed);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      keys.current[e.code] = e.type === "keydown";
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
    };
  }, []);

  // Mouse look — pointer lock when available, click-drag fallback otherwise.
  useEffect(() => {
    const canvas = gl.domElement;
    const applyLook = (dx: number, dy: number, sensitivity: number) => {
      yawObject.current.rotation.y -= dx * sensitivity;
      pitchObject.current.rotation.x = Math.max(
        -PITCH_LIMIT,
        Math.min(PITCH_LIMIT, pitchObject.current.rotation.x - dy * sensitivity)
      );
    };

    if (canPointerLock) {
      useDreamStore.getState().setLookMode("lock");
      const onClick = () => {
        if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
      };
      const onLockChange = () => {
        const locked = document.pointerLockElement === canvas;
        if (locked) enterWorld();
        else useDreamStore.getState().setLocked(false);
      };
      const onLockError = () => {
        // Embed refused the lock at request time — switch to drag mode and
        // let the click that failed still enter the world.
        setCanPointerLock(false);
        enterWorld();
      };
      const onMove = (e: MouseEvent) => {
        if (document.pointerLockElement !== canvas) return;
        applyLook(e.movementX, e.movementY, MOUSE_SENSITIVITY);
      };
      canvas.addEventListener("click", onClick);
      document.addEventListener("pointerlockchange", onLockChange);
      document.addEventListener("pointerlockerror", onLockError);
      document.addEventListener("mousemove", onMove);
      return () => {
        canvas.removeEventListener("click", onClick);
        document.removeEventListener("pointerlockchange", onLockChange);
        document.removeEventListener("pointerlockerror", onLockError);
        document.removeEventListener("mousemove", onMove);
      };
    }

    useDreamStore.getState().setLookMode("drag");
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e: PointerEvent) => {
      enterWorld();
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      applyLook(e.clientX - lastX, e.clientY - lastY, DRAG_SENSITIVITY);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => (dragging = false);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [gl, canPointerLock]);

  // Spawn at the clearing's edge, facing the stone circle (-Z).
  useEffect(() => {
    const spawnFloor = realm === "forest" ? terrainHeight(0, 12, seedNum) : 0;
    camera.position.set(0, spawnFloor + GROUND_HEIGHT, 12);
    playerPos.copy(camera.position); // chunk field reads this before first frame
    yawObject.current.rotation.y = 0;
    pitchObject.current.rotation.x = 0;
    velocity.current.set(0, 0, 0);
    lastFootPos.current.set(camera.position.x, camera.position.z);
    stepDistance.current = 0;
  }, [camera, seedNum, realm]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const k = keys.current;

    // Look controls (arrow keys).
    if (k.ArrowLeft) yawObject.current.rotation.y += LOOK_SPEED * delta;
    if (k.ArrowRight) yawObject.current.rotation.y -= LOOK_SPEED * delta;
    if (k.ArrowUp) pitchObject.current.rotation.x += LOOK_SPEED * delta;
    if (k.ArrowDown) pitchObject.current.rotation.x -= LOOK_SPEED * delta;
    pitchObject.current.rotation.x = Math.max(
      -PITCH_LIMIT,
      Math.min(PITCH_LIMIT, pitchObject.current.rotation.x)
    );

    camera.quaternion.setFromEuler(
      new THREE.Euler(
        pitchObject.current.rotation.x,
        yawObject.current.rotation.y,
        0,
        "YXZ"
      )
    );
    playerYaw.value = yawObject.current.rotation.y;

    // Build movement direction relative to where we're facing.
    direction.current.set(0, 0, 0);
    if (k.KeyW) direction.current.z -= 1;
    if (k.KeyS) direction.current.z += 1;
    if (k.KeyA) direction.current.x -= 1;
    if (k.KeyD) direction.current.x += 1;
    if (direction.current.lengthSq() > 0) {
      direction.current.normalize();
      direction.current.applyQuaternion(yawObject.current.quaternion);
      direction.current.y = 0;
      direction.current.normalize();
    }

    const speed = k.ShiftLeft || k.ShiftRight ? RUN_SPEED : WALK_SPEED;
    const move = direction.current.clone().multiplyScalar(speed * delta);

    // Horizontal motion with axis-sliding collision.
    const target = camera.position.clone().add(move);
    if (canMoveTo(camera.position, target, PLAYER_RADIUS)) {
      camera.position.x = target.x;
      camera.position.z = target.z;
    } else {
      const xPos = camera.position.clone().add(new THREE.Vector3(move.x, 0, 0));
      const zPos = camera.position.clone().add(new THREE.Vector3(0, 0, move.z));
      if (canMoveTo(camera.position, xPos, PLAYER_RADIUS)) {
        camera.position.x = xPos.x;
      } else if (canMoveTo(camera.position, zPos, PLAYER_RADIUS)) {
        camera.position.z = zPos.z;
      }
    }

    // Gravity, jumping, and the terrain as the floor.
    velocity.current.y += GRAVITY * delta;
    if (k.Space && isGrounded.current) {
      velocity.current.y = JUMP_STRENGTH;
      isGrounded.current = false;
    }
    camera.position.y += velocity.current.y * delta;

    const floor =
      (realm === "forest"
        ? terrainHeight(camera.position.x, camera.position.z, seedNum)
        : realm === "rift"
          ? dojoFloorHeight(camera.position.y, camera.position.x, camera.position.z)
          : 0) +
      GROUND_HEIGHT;
    if (camera.position.y <= floor) {
      camera.position.y = floor;
      velocity.current.y = 0;
      isGrounded.current = true;
    } else if (velocity.current.y <= 0 && camera.position.y - floor < 0.35) {
      // Stick to gentle downhill slopes instead of stuttering airborne.
      camera.position.y = floor;
      velocity.current.y = 0;
      isGrounded.current = true;
    } else {
      isGrounded.current = false;
    }

    // Footstep SFX, paced by actual ground covered rather than
    // wall-clock time — running naturally steps faster, standing still or
    // sliding against a wall never triggers a step, and there are none
    // while airborne.
    const dx = camera.position.x - lastFootPos.current.x;
    const dz = camera.position.z - lastFootPos.current.y;
    lastFootPos.current.set(camera.position.x, camera.position.z);
    if (isGrounded.current) {
      stepDistance.current += Math.hypot(dx, dz);
      if (stepDistance.current >= STEP_INTERVAL) {
        stepDistance.current = 0;
        const running = !!(k.ShiftLeft || k.ShiftRight);
        footsteps.play(running ? 0.55 : 0.4, running ? 1.12 : 1.0);
      }
    } else {
      stepDistance.current = 0; // don't burst-fire on landing
    }

    playerPos.copy(camera.position);
  });

  return null;
}
