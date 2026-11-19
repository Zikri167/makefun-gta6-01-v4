// player.js — Dario Kane, the wheelman: a box-built character with a swing
// walk, sprinting, a punch, and the third-person camera that follows him on
// foot and swings in behind whatever car he is driving.

import * as THREE from 'three';
import { resolveCircleCollision, CITY_EDGE } from './city.js';

export function makePersonMesh({ shirt = 0x2266aa, pants = 0x2b2b30, skin = 0xe0ac82, hair = 0x201812 } = {}) {
  const person = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.12;
  person.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.34), skinMat);
  head.position.y = 1.72;
  person.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.38), new THREE.MeshLambertMaterial({ color: hair }));
  cap.position.y = 1.94;
  person.add(cap);

  const limbs = {};
  const mkLimb = (w, h, d, mat, x, y, z) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(0, -h / 2, 0);
    const limb = new THREE.Mesh(geo, mat);
    limb.position.set(x, y, z);
    person.add(limb);
    return limb;
  };
  limbs.armL = mkLimb(0.16, 0.66, 0.16, shirtMat, -0.42, 1.44, 0);
  limbs.armR = mkLimb(0.16, 0.66, 0.16, shirtMat, 0.42, 1.44, 0);
  limbs.legL = mkLimb(0.2, 0.78, 0.2, pantsMat, -0.17, 0.78, 0);
  limbs.legR = mkLimb(0.2, 0.78, 0.2, pantsMat, 0.17, 0.78, 0);
  person.userData.limbs = limbs;
  return person;
}

export function swingLimbs(person, phase, amount) {
  const { armL, armR, legL, legR } = person.userData.limbs;
  const s = Math.sin(phase) * amount;
  armL.rotation.x = s;
  armR.rotation.x = -s;
  legL.rotation.x = -s;
  legR.rotation.x = s;
}

export function createPlayer(game) {
  const mesh = makePersonMesh({ shirt: 0xd35400, pants: 0x23232a, hair: 0x14100c });
  mesh.position.set(6, 0, 10);
  game.scene.add(mesh);
  const player = {
    mesh,
    pos: mesh.position,
    angle: Math.PI,
    walkPhase: 0,
    speedNow: 0,
    health: 100,
    lastHurtAt: -99,
    car: null,
    punchAt: -9,
  };
  game.player = player;
  return player;
}

export function updatePlayerOnFoot(game, dt) {
  const p = game.player;
  const input = game.input;
  const fwd = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
  const strafe = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = sprint ? 9.6 : 5.8;

  let mx = 0;
  let mz = 0;
  if (fwd || strafe) {
    const sin = Math.sin(game.cameraYaw);
    const cos = Math.cos(game.cameraYaw);
    mx = (sin * fwd + cos * strafe);
    mz = (cos * fwd - sin * strafe);
    const len = Math.hypot(mx, mz) || 1;
    mx = (mx / len) * speed;
    mz = (mz / len) * speed;
    p.angle = Math.atan2(mx, mz);
  }
  p.pos.x += mx * dt;
  p.pos.z += mz * dt;
  p.speedNow = Math.hypot(mx, mz);

  if (game.insideInterior) {
    resolveCircleCollision(game.interiorColliders, p.pos, 0.55);
    p.pos.x = Math.max(986, Math.min(1014, p.pos.x));
    p.pos.z = Math.max(-12.4, Math.min(12.4, p.pos.z));
  } else {
    resolveCircleCollision(game.city.colliders, p.pos, 0.55);
    p.pos.x = Math.max(-CITY_EDGE - 4, Math.min(CITY_EDGE + 30, p.pos.x));
    p.pos.z = Math.max(-CITY_EDGE - 4, Math.min(CITY_EDGE + 4, p.pos.z));
  }

  if (p.speedNow > 0.1) p.walkPhase += dt * p.speedNow * 1.6;
  swingLimbs(p.mesh, p.walkPhase, p.speedNow > 0.1 ? 0.55 : 0);
  // A punch throws the right arm forward for a beat.
  const sincePunch = game.time - p.punchAt;
  if (sincePunch < 0.22) {
    p.mesh.userData.limbs.armR.rotation.x = -1.7 * Math.sin((sincePunch / 0.22) * Math.PI);
  }
  p.mesh.rotation.y = p.angle;
}

export function updateCamera(game, dt) {
  const { dx, dy } = game.input.takeMouse();
  game.cameraYaw -= dx * 0.0032;
  game.cameraPitch = Math.max(-0.15, Math.min(1.1, game.cameraPitch + dy * 0.0028));

  const p = game.player;
  let target;
  let dist;
  let height;
  if (p.car) {
    // Ease the camera round behind the car as it turns.
    let diff = p.car.angle - game.cameraYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    game.cameraYaw += diff * Math.min(1, dt * 3.2);
    target = p.car.pos;
    dist = 9.5;
    height = 3.4;
  } else {
    target = p.pos;
    dist = 6.4;
    height = 2.1;
  }
  const pitch = game.cameraPitch;
  const cx = target.x - Math.sin(game.cameraYaw) * Math.cos(pitch) * dist;
  const cz = target.z - Math.cos(game.cameraYaw) * Math.cos(pitch) * dist;
  const cy = target.y + height + Math.sin(pitch) * dist;
  game.camera.position.set(cx, Math.max(1.1, cy), cz);
  game.camera.lookAt(target.x, target.y + 1.6, target.z);
}
