// wanted.js — the law of Vesper Bay. Crimes push the star count up (stealing
// a car, hitting a car, hurting a pedestrian, whatever a mission script
// demands); patrol cars spawn on the avenues and hunt the player down. Hide
// or stay clean and the stars cool off one by one. Get pinned at walking
// pace with a patrol car on top of you and the bust meter fills.

import { createCar } from './vehicles.js';
import { resolveCircleCollision, ROAD_COORDS, CITY_EDGE } from './city.js';

export function createWanted(game) {
  const wanted = {
    stars: 0,
    lastCrimeAt: -99,
    coolSince: 0,
    bust: 0,
  };
  game.wanted = wanted;
  return wanted;
}

export function addStars(game, n) {
  const w = game.wanted;
  const before = w.stars;
  w.stars = Math.max(0, Math.min(5, w.stars + n));
  w.lastCrimeAt = game.time;
  if (w.stars > before) game.audio.blip();
}

export function setStars(game, n) {
  game.wanted.stars = Math.max(0, Math.min(5, n));
  game.wanted.lastCrimeAt = game.time;
}

function policeTargetCount(game) {
  const s = game.wanted.stars;
  if (s <= 0) return 0;
  return Math.min(4, s);
}

function spawnPolice(game) {
  const p = game.player.car ? game.player.car.pos : game.player.pos;
  // Spawn on an intersection a few blocks away, never on top of the player.
  let x = p.x;
  let z = p.z;
  for (let tries = 0; tries < 12; tries++) {
    const rx = ROAD_COORDS[Math.floor(game.rng() * ROAD_COORDS.length)];
    const rz = ROAD_COORDS[Math.floor(game.rng() * ROAD_COORDS.length)];
    const d = Math.hypot(rx - p.x, rz - p.z);
    if (d > 55 && d < 130) { x = rx; z = rz; break; }
    x = rx; z = rz;
  }
  const car = createCar(game, { x, z, angle: Math.atan2(p.x - x, p.z - z), kind: 'police', police: true, color: 0xf2f3f5 });
  car.cruise = 30;
  game.police.push(car);
  return car;
}

export function updateWanted(game, dt) {
  const w = game.wanted;
  const target = game.player.car ? game.player.car.pos : game.player.pos;
  const want = policeTargetCount(game);

  while (game.police.length < want) spawnPolice(game);
  if (game.police.length > want) {
    // Extras peel off when they are far away; close ones stay until they fade.
    const far = game.police.findIndex((c) => Math.hypot(c.pos.x - target.x, c.pos.z - target.z) > 90);
    if (far >= 0) {
      const [gone] = game.police.splice(far, 1);
      game.scene.remove(gone.mesh);
      game.cars.splice(game.cars.indexOf(gone), 1);
    }
  }

  // Cooling: no fresh crime and nobody close means the heat dies down.
  const anyClose = game.police.some((c) => Math.hypot(c.pos.x - target.x, c.pos.z - target.z) < 42);
  if (w.stars > 0 && game.time - w.lastCrimeAt > 13 && (!anyClose || game.insideInterior)) {
    w.coolSince += dt;
    if (w.coolSince > 9) {
      w.stars -= 1;
      w.coolSince = 0;
      w.lastCrimeAt = game.time;
    }
  } else {
    w.coolSince = 0;
  }

  game.audio.setSiren(w.stars > 0 && game.police.length > 0 && !game.insideInterior);

  // Drive the patrol cars.
  const flash = Math.floor(game.time * 3) % 2 === 0;
  for (const cop of game.police) {
    const mats = cop.mesh.userData.lightMats;
    if (mats) {
      mats.red.emissiveIntensity = flash ? 2.4 : 0.15;
      mats.blue.emissiveIntensity = flash ? 0.15 : 2.4;
    }
    if (game.insideInterior) {
      cop.speed *= 1 - Math.min(1, dt * 2);
      cop.mesh.rotation.y = cop.angle;
      continue;
    }
    const dx = target.x - cop.pos.x;
    const dz = target.z - cop.pos.z;
    const dist = Math.hypot(dx, dz);
    const desired = Math.atan2(dx, dz);
    let diff = desired - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const topSpeed = dist > 60 ? 31 : 24;
    const facing = Math.cos(diff) > 0.2;
    cop.speed += ((facing ? topSpeed : -6) - cop.speed) * Math.min(1, dt * 1.6);
    cop.pos.x += Math.sin(cop.angle) * cop.speed * dt;
    cop.pos.z += Math.cos(cop.angle) * cop.speed * dt;
    cop.pos.x = Math.max(-CITY_EDGE - 10, Math.min(CITY_EDGE + 24, cop.pos.x));
    cop.pos.z = Math.max(-CITY_EDGE - 4, Math.min(CITY_EDGE + 4, cop.pos.z));
    const preSpeed = Math.abs(cop.speed);
    resolveCircleCollision(game.city.colliders, cop.pos, 1.7);
    if (preSpeed > 8 && Math.abs(cop.speed) > 0 && dist < 3) cop.speed *= 0.4;
    // Ramming the player's car hurts; ramming the player hurts more.
    const playerCar = game.player.car;
    if (playerCar && Math.hypot(playerCar.pos.x - cop.pos.x, playerCar.pos.z - cop.pos.z) < 3.4 && Math.abs(cop.speed) > 6) {
      game.events.push({ type: 'police-ram', speed: Math.abs(cop.speed) });
      cop.speed *= 0.5;
    }
    cop.mesh.rotation.y = cop.angle;
  }

  // The bust meter: pinned and slow with a patrol car right there.
  const playerSpeed = game.player.car ? Math.abs(game.player.car.speed) : game.player.speedNow;
  const copOnTop = game.police.some((c) => Math.hypot(c.pos.x - target.x, c.pos.z - target.z) < 8);
  if (w.stars > 0 && copOnTop && playerSpeed < 1.6 && !game.insideInterior) {
    w.bust += dt / 2.6;
    if (w.bust >= 1) {
      w.bust = 0;
      game.events.push({ type: 'busted' });
    }
  } else {
    w.bust = Math.max(0, w.bust - dt * 0.7);
  }
}
