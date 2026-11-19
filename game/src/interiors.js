// interiors.js — Mona Reyes's office, the one interior in Vesper Bay.
// Outside it is a little fixer booth on the corner of the market avenue; walk
// into its glowing door on foot and you are inside a wood-panelled office far
// from the city grid, with a desk, a safe, a couch and the harbour chart on
// the wall. The police never follow you in, and wanted heat cools while you
// are sheltered — the finale mission ends at that desk.

import * as THREE from 'three';

export const OFFICE_CENTER = { x: 1000, z: 0 };
export const OFFICE_DESK = { x: 1000, z: -5.2 };
export const DOOR_OUTSIDE = { x: 53.5, z: 8 };
const DOOR_INSIDE = { x: 1011.5, z: 0 };
const LAND_INSIDE = { x: 1008.5, z: 0 };
const LAND_OUTSIDE = { x: 50.5, z: 8 };

function markerRing(color) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.55, 28), mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  return ring;
}

export function buildInterior(game) {
  const group = new THREE.Group();
  game.scene.add(group);
  const colliders = [];

  // The booth on the street corner: walls, a roof, and Mona's sign.
  const boothMat = new THREE.MeshLambertMaterial({ color: 0x274b63 });
  const booth = new THREE.Group();
  const bBody = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.2, 4.6), boothMat);
  bBody.position.y = 1.6;
  booth.add(bBody);
  const bRoof = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.3, 5.4), new THREE.MeshLambertMaterial({ color: 0x18242e }));
  bRoof.position.y = 3.35;
  booth.add(bRoof);
  const signMat = new THREE.MeshLambertMaterial({ color: 0x111111, emissive: 0xff5da2, emissiveIntensity: 0.8 });
  game.signMaterials.push(signMat);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.7, 0.12), signMat);
  sign.position.set(0, 2.7, -2.36);
  booth.add(sign);
  booth.position.set(58, 0, 8);
  group.add(booth);
  game.city.colliders.push({ minX: 55.7, maxX: 60.3, minZ: 5.7, maxZ: 10.3 });

  const doorRing = markerRing(0xff5da2);
  doorRing.position.set(DOOR_OUTSIDE.x, 0.06, DOOR_OUTSIDE.z);
  group.add(doorRing);
  game.doorRing = doorRing;

  // The office itself, centred at (1000, 0): floor, panelled walls, a door
  // gap in the east wall, furniture with its own colliders.
  const cx = OFFICE_CENTER.x;
  const cz = OFFICE_CENTER.z;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 26),
    new THREE.MeshLambertMaterial({ color: 0x6e4f30 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0.01, cz);
  group.add(floor);
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 7),
    new THREE.MeshLambertMaterial({ color: 0x7a2436 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(cx, 0.03, cz - 1);
  group.add(rug);

  const wallMat = new THREE.MeshLambertMaterial({ color: 0x4a3826 });
  const mkWall = (w, h, d, x, y, z) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wall.position.set(x, y, z);
    group.add(wall);
    return wall;
  };
  mkWall(30, 5, 0.6, cx, 2.5, cz - 13);
  mkWall(30, 5, 0.6, cx, 2.5, cz + 13);
  mkWall(0.6, 5, 26, cx - 15, 2.5, cz);
  mkWall(0.6, 5, 11, cx + 15, 2.5, cz - 7.5);
  mkWall(0.6, 5, 11, cx + 15, 2.5, cz + 7.5);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(30, 0.4, 26), new THREE.MeshLambertMaterial({ color: 0x2e2119 }));
  ceiling.position.set(cx, 5.1, cz);
  group.add(ceiling);

  const deskMat = new THREE.MeshLambertMaterial({ color: 0x3d2b18 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.05, 1.6), deskMat);
  desk.position.set(cx, 0.53, OFFICE_DESK.z);
  group.add(desk);
  colliders.push({ minX: cx - 2.3, maxX: cx + 2.3, minZ: OFFICE_DESK.z - 0.8, maxZ: OFFICE_DESK.z + 0.8 });

  const moneyMat = new THREE.MeshLambertMaterial({ color: 0x3fae5a });
  for (let i = 0; i < 3; i++) {
    const stack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.4), moneyMat);
    stack.position.set(cx - 1 + i * 0.9, 1.14, OFFICE_DESK.z);
    stack.rotation.y = i * 0.4;
    group.add(stack);
  }
  const safe = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 1.4), new THREE.MeshLambertMaterial({ color: 0x555c63 }));
  safe.position.set(cx - 12.5, 0.9, cz - 11);
  group.add(safe);
  colliders.push({ minX: cx - 13.2, maxX: cx - 11.8, minZ: cz - 11.7, maxZ: cz - 10.3 });

  const couch = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 1.3), new THREE.MeshLambertMaterial({ color: 0x7a2436 }));
  couch.position.set(cx + 10, 0.45, cz + 10.5);
  group.add(couch);
  colliders.push({ minX: cx + 8.2, maxX: cx + 11.8, minZ: cz + 9.85, maxZ: cz + 11.15 });

  const lampMat = new THREE.MeshLambertMaterial({ color: 0x443b18, emissive: 0xffca5f, emissiveIntensity: 1.4 });
  game.lampMaterials.push(lampMat);
  // The office has its own warm light: the sun never reaches in here, day
  // or dusk, and a fixer's office should glow like a lantern.
  const officeLight = new THREE.PointLight(0xffd9a0, 160, 55, 1.5);
  officeLight.position.set(cx, 4.3, cz);
  group.add(officeLight);
  for (const [lx, lz] of [[cx - 6, cz - 6], [cx + 6, cz - 6], [cx, cz + 8]]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), lampMat);
    lamp.position.set(lx, 4.4, lz);
    group.add(lamp);
  }
  const chart = new THREE.Mesh(new THREE.PlaneGeometry(7, 4), new THREE.MeshLambertMaterial({ color: 0x9fc6d8 }));
  chart.position.set(cx, 2.6, cz - 12.66);
  group.add(chart);

  const exitRing = markerRing(0x39d5ff);
  exitRing.position.set(DOOR_INSIDE.x, 0.06, DOOR_INSIDE.z);
  group.add(exitRing);

  game.interiorColliders = colliders;
  game.officeGroup = group;
  return group;
}

export function updateInterior(game, dt) {
  const p = game.player;
  game.doorRing.rotation.z += dt * 0.8;
  if (p.car) return;
  const dOut = Math.hypot(p.pos.x - DOOR_OUTSIDE.x, p.pos.z - DOOR_OUTSIDE.z);
  const dIn = Math.hypot(p.pos.x - DOOR_INSIDE.x, p.pos.z - DOOR_INSIDE.z);
  if (!game.insideInterior && dOut < 1.9) {
    game.insideInterior = true;
    p.pos.set(LAND_INSIDE.x, 0, LAND_INSIDE.z);
    p.angle = -Math.PI / 2;
    game.cameraYaw = -Math.PI / 2;
    game.audio.door();
    game.hud.flash('Mona\'s office — off the street, off the radar.');
  } else if (game.insideInterior && dIn < 1.9) {
    game.insideInterior = false;
    p.pos.set(LAND_OUTSIDE.x, 0, LAND_OUTSIDE.z);
    p.angle = Math.PI / 2;
    game.cameraYaw = Math.PI / 2;
    game.audio.door();
  }
}
