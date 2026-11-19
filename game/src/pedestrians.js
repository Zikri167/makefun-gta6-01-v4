// pedestrians.js — the citizens of Vesper Bay. They stroll the pavements in
// straight lines, turn at corners, scatter when a car comes at them too fast
// or a fist comes out, and fall over when they are hit. Hurting one is the
// fastest way to earn wanted stars, which is the point of them.

import * as THREE from 'three';
import { makePersonMesh, swingLimbs } from './player.js';
import { ROAD_COORDS, ROAD_HALF, CITY_EDGE, resolveCircleCollision } from './city.js';
import { rngPick, rngRange } from './random.js';

const SHIRTS = [0xcc4455, 0x44aa66, 0xddaa33, 0x7777dd, 0xeeeeee, 0x8844aa, 0x33aaaa, 0xd2691e];

export function spawnPedestrians(game) {
  const rng = game.rng;
  for (let i = 0; i < 26; i++) {
    const mesh = makePersonMesh({
      shirt: rngPick(rng, SHIRTS),
      pants: rngPick(rng, [0x2b2b30, 0x4a3b2a, 0x33455e, 0x555555]),
      skin: rngPick(rng, [0xe0ac82, 0xc68863, 0x8d5524, 0xffdbac]),
    });
    const vertical = rng() < 0.5;
    const road = rngPick(rng, ROAD_COORDS);
    const side = rng() < 0.5 ? -1 : 1;
    const along = rngRange(rng, -215, 215);
    mesh.position.set(
      vertical ? road + side * (ROAD_HALF + 2.2) : along,
      0,
      vertical ? along : road + side * (ROAD_HALF + 2.2),
    );
    game.scene.add(mesh);
    game.peds.push({
      mesh,
      pos: mesh.position,
      vertical,
      dir: rng() < 0.5 ? 1 : -1,
      speed: rngRange(rng, 1.1, 1.9),
      phase: rngRange(rng, 0, 6),
      state: 'walk',
      stateAt: 0,
      angle: 0,
    });
  }
}

export function updatePedestrians(game, dt) {
  const playerPos = game.player.car ? game.player.car.pos : game.player.pos;
  for (const ped of game.peds) {
    if (ped.state === 'down') {
      if (game.time - ped.stateAt > 7) {
        ped.state = 'walk';
        ped.mesh.rotation.x = 0;
        ped.mesh.position.y = 0;
      }
      continue;
    }
    // Panic: a fast car close by, or the player swinging, sends them running.
    let fleeing = ped.state === 'flee';
    if (!fleeing) {
      for (const car of game.cars) {
        if (Math.abs(car.speed) < 7) continue;
        const d = Math.hypot(car.pos.x - ped.pos.x, car.pos.z - ped.pos.z);
        if (d < 6) { fleeing = true; break; }
      }
      if (game.time - game.player.punchAt < 0.3) {
        const d = Math.hypot(game.player.pos.x - ped.pos.x, game.player.pos.z - ped.pos.z);
        if (d < 4) fleeing = true;
      }
      if (fleeing) {
        ped.state = 'flee';
        ped.stateAt = game.time;
        ped.fleeFrom = { x: playerPos.x, z: playerPos.z };
      }
    }

    let mx = 0;
    let mz = 0;
    if (ped.state === 'flee') {
      const away = Math.atan2(ped.pos.x - ped.fleeFrom.x, ped.pos.z - ped.fleeFrom.z);
      mx = Math.sin(away) * 4.6;
      mz = Math.cos(away) * 4.6;
      ped.angle = away;
      if (game.time - ped.stateAt > 2.4) ped.state = 'walk';
    } else if (ped.vertical) {
      mz = ped.dir * ped.speed;
      ped.angle = ped.dir > 0 ? 0 : Math.PI;
      if (Math.abs(ped.pos.z) > CITY_EDGE - 8) ped.dir *= -1;
    } else {
      mx = ped.dir * ped.speed;
      ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (Math.abs(ped.pos.x) > CITY_EDGE - 8) ped.dir *= -1;
    }
    ped.pos.x += mx * dt;
    ped.pos.z += mz * dt;
    if (!game.insideInterior) resolveCircleCollision(game.city.colliders, ped.pos, 0.5);
    ped.phase += dt * Math.hypot(mx, mz) * 2.2;
    swingLimbs(ped.mesh, ped.phase, 0.5);
    ped.mesh.rotation.y = ped.angle;
  }
}

// A car meeting a pedestrian at speed: the pedestrian goes down and the
// crime is reported through game.events for the wanted system to price.
export function checkCarPedHits(game) {
  for (const car of game.cars) {
    if (Math.abs(car.speed) < 4) continue;
    for (const ped of game.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(car.pos.x - ped.pos.x, car.pos.z - ped.pos.z);
      if (d < 1.9) {
        ped.state = 'down';
        ped.stateAt = game.time;
        ped.mesh.rotation.x = -Math.PI / 2;
        ped.mesh.position.y = 0.25;
        game.events.push({ type: 'ped-hit', byPlayer: car === game.player.car });
      }
    }
  }
}
