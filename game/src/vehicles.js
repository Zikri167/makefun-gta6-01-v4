// vehicles.js — every car in Vesper Bay: one low-poly mesh factory, a fleet of
// parked cars waiting to be stolen, loop traffic that drives the avenues, and
// the arcade driving model the player uses. Police cars are built here too;
// wanted.js decides where they go.

import * as THREE from 'three';
import { ROAD_COORDS, CITY_EDGE, resolveCircleCollision } from './city.js';
import { rngPick, rngRange } from './random.js';

const CAR_COLORS = [0xd64541, 0x3a7bd5, 0xf2b134, 0x59c135, 0xe8e8ec, 0x22242a, 0x9b59b6, 0xff7f50, 0x2ec4b6];
export const CAR_RADIUS = 1.7;

const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x17181a });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x18222e });

export function makeCarMesh(color, { sport = false, police = false } = {}) {
  const car = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: police ? 0xf2f3f5 : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, sport ? 4.4 : 4.1), paint);
  body.position.y = 0.58;
  car.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 0.7), paint);
  nose.position.set(0, 0.45, sport ? 2.3 : 2.15);
  car.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.5, 1.9), glassMat);
  cabin.position.set(0, 1.05, -0.25);
  car.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 10);
  for (const [wx, wz] of [[-0.88, 1.35], [0.88, 1.35], [-0.88, -1.35], [0.88, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, tyreMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.35, wz);
    car.add(wheel);
  }
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), headlightMat);
    head.position.set(side * 0.6, 0.62, sport ? 2.66 : 2.51);
    car.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), taillightMat);
    tail.position.set(side * 0.6, 0.66, sport ? -2.21 : -2.06);
    car.add(tail);
  }
  if (police) {
    const bar = new THREE.Group();
    const redMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 2 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x000033, emissive: 0x2255ff, emissiveIntensity: 0.2 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.5), redMat);
    red.position.x = -0.3;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.5), blueMat);
    blue.position.x = 0.3;
    bar.add(red, blue);
    bar.position.set(0, 1.42, -0.25);
    car.add(bar);
    car.userData.lightMats = { red: redMat, blue: blueMat };
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.2, 4.14), new THREE.MeshLambertMaterial({ color: 0x1d3fbf }));
    stripe.position.y = 0.6;
    car.add(stripe);
  }
  if (sport) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.4), paint);
    spoiler.position.set(0, 1.0, -2.05);
    car.add(spoiler);
  }
  return car;
}

export function createCar(game, opts) {
  const mesh = makeCarMesh(opts.color ?? 0x888888, opts);
  mesh.position.set(opts.x, 0, opts.z);
  mesh.rotation.y = opts.angle ?? 0;
  game.scene.add(mesh);
  const car = {
    mesh,
    kind: opts.kind,
    sport: !!opts.sport,
    angle: opts.angle ?? 0,
    speed: 0,
    maxSpeed: opts.sport ? 41 : 33,
    stolen: false,
    driver: null,
    axis: opts.axis ?? null,
    line: opts.line ?? 0,
    dir: opts.dir ?? 1,
    cruise: opts.cruise ?? 11,
    pos: mesh.position,
  };
  mesh.userData.car = car;
  game.cars.push(car);
  return car;
}

export function spawnTraffic(game) {
  const rng = game.rng;
  for (let i = 0; i < 15; i++) {
    const axis = rng() < 0.5 ? 'z' : 'x';
    const road = rngPick(rng, ROAD_COORDS);
    const dir = rng() < 0.5 ? 1 : -1;
    // Right-hand traffic: the lane offset flips with the direction of travel.
    const lane = dir > 0 ? 3.4 : -3.4;
    const along = rngRange(rng, -230, 230);
    const x = axis === 'z' ? road + lane : along;
    const z = axis === 'z' ? along : road + lane;
    const angle = axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    createCar(game, {
      x, z, angle, kind: 'traffic', axis, line: road + lane, dir,
      color: rngPick(rng, CAR_COLORS), cruise: rngRange(rng, 8.5, 13.5),
    });
  }
}

export function spawnParked(game) {
  const rng = game.rng;
  const spots = [];
  for (let i = 0; i < 17; i++) {
    const road = rngPick(rng, ROAD_COORDS);
    const along = rngRange(rng, -215, 215);
    const side = rng() < 0.5 ? -1 : 1;
    const vertical = rng() < 0.5;
    const x = vertical ? road + side * 5.6 : along;
    const z = vertical ? along : road + side * 5.6;
    const angle = vertical ? 0 : Math.PI / 2;
    spots.push(createCar(game, {
      x, z, angle, kind: 'parked',
      color: rngPick(rng, CAR_COLORS), sport: rng() < 0.18,
    }));
  }
  // The one car mission 2 is about: a tangerine sports coupe parked on the
  // coast road at the harbour's edge — on the road, so no seed can bury it
  // inside a container or a tower.
  const prize = createCar(game, {
    x: 197.6, z: -48, angle: 0, kind: 'parked', color: 0xff8c1a, sport: true,
  });
  prize.isPrizeCar = true;
  game.prizeCar = prize;
  return spots;
}

export function updateTraffic(game, dt) {
  for (const car of game.cars) {
    if (car.kind !== 'traffic') continue;
    let target = car.cruise;
    // Slow down for whatever is just ahead in the same lane.
    for (const other of game.cars) {
      if (other === car || other.kind === 'police') continue;
      const ahead = car.axis === 'z'
        ? (other.pos.z - car.pos.z) * car.dir
        : (other.pos.x - car.pos.x) * car.dir;
      const lateral = car.axis === 'z'
        ? Math.abs(other.pos.x - car.pos.x)
        : Math.abs(other.pos.z - car.pos.z);
      if (ahead > 0 && ahead < 8 && lateral < 2.2) target = Math.min(target, other.speed ?? 0);
    }
    car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 9 * dt);
    if (car.axis === 'z') car.pos.z += car.dir * car.speed * dt;
    else car.pos.x += car.dir * car.speed * dt;
    const along = car.axis === 'z' ? car.pos.z : car.pos.x;
    if (along > CITY_EDGE + 14 || along < -CITY_EDGE - 14) {
      if (car.axis === 'z') car.pos.z = -car.dir * (CITY_EDGE + 12);
      else car.pos.x = -car.dir * (CITY_EDGE + 12);
    }
    resolveCircleCollision(game.city.colliders, car.pos, CAR_RADIUS);
    car.mesh.rotation.y = car.angle;
  }
}

// Arcade driving for whichever car the player sits in. Returns the impact
// speed of a building hit this frame (0 when there was none) so main.js can
// price the crash in health and noise.
export function driveCar(game, car, dt) {
  const input = game.input;
  const accel = input.down('KeyW') || input.down('ArrowUp') ? 1 : 0;
  const brake = input.down('KeyS') || input.down('ArrowDown') ? 1 : 0;
  const steer = (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0)
    - (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);

  if (accel) car.speed += 15 * dt;
  if (brake) car.speed -= (car.speed > 0.5 ? 26 : 9) * dt;
  car.speed -= car.speed * 0.55 * dt;
  car.speed = Math.max(car.sport ? -11 : -9, Math.min(car.maxSpeed, car.speed));

  if (Math.abs(car.speed) > 0.2) {
    const grip = Math.min(1, Math.abs(car.speed) / 9);
    car.angle += steer * 1.55 * grip * dt * Math.sign(car.speed);
  }

  const beforeX = car.pos.x;
  const beforeZ = car.pos.z;
  car.pos.x += Math.sin(car.angle) * car.speed * dt;
  car.pos.z += Math.cos(car.angle) * car.speed * dt;
  car.pos.x = Math.max(-CITY_EDGE - 12, Math.min(CITY_EDGE + 26, car.pos.x));
  car.pos.z = Math.max(-CITY_EDGE - 6, Math.min(CITY_EDGE + 6, car.pos.z));

  const preSpeed = Math.abs(car.speed);
  resolveCircleCollision(game.city.colliders, car.pos, CAR_RADIUS);
  let impact = 0;
  const moved = Math.hypot(car.pos.x - beforeX, car.pos.z - beforeZ);
  const expected = Math.abs(car.speed) * dt;
  if (expected > 0.01 && moved < expected * 0.4 && preSpeed > 6) {
    impact = preSpeed;
    car.speed *= -0.18;
  }

  // Car-on-car: a soft push apart, a hard shove if you arrived fast.
  for (const other of game.cars) {
    if (other === car) continue;
    const dx = car.pos.x - other.pos.x;
    const dz = car.pos.z - other.pos.z;
    const d2 = dx * dx + dz * dz;
    const min = CAR_RADIUS * 2 - 0.4;
    if (d2 < min * min && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      car.pos.x += (dx / d) * push;
      car.pos.z += (dz / d) * push;
      other.pos.x -= (dx / d) * push;
      other.pos.z -= (dz / d) * push;
      other.mesh.position.copy(other.pos);
      if (preSpeed > 7 && !other.hitRecently) {
        other.hitRecently = 1.2;
        game.events.push({ type: 'car-hit', car: other, speed: preSpeed });
      }
    }
  }

  car.mesh.rotation.y = car.angle;
  return impact;
}
