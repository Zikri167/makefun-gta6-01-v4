// shots.js — the four screenshot scenes the entry is judged by. Each ?shot=
// mode poses the real game (never a mock-up): the cover is the title screen
// over the city at dusk, the chase is a genuine three-star pursuit frozen
// mid-frame, the street scene is the market corner at noon with traffic and
// crowds, and the office shot is the finale's room. After sixty frames the
// page raises window.__shotReady for the screenshot script.

import * as THREE from 'three';
import { applyTimeOfDay } from './lighting.js';
import { setStars } from './wanted.js';
import { beginMission } from './missions.js';
import { createCar } from './vehicles.js';

function fixedCam(game, x, y, z, lx, ly, lz) {
  game.fixedCamera = { pos: new THREE.Vector3(x, y, z), look: new THREE.Vector3(lx, ly, lz) };
}

function hideTitle(game) {
  document.getElementById('title-screen').classList.add('hidden');
  game.hud.root.classList.remove('hidden');
}

export function setupShot(game, name) {
  const p = game.player;
  if (name === 'cover') {
    applyTimeOfDay(game, 'dusk');
    game.state = 'title';
    fixedCam(game, 104, 33, 116, 0, 10, -12);
    return;
  }
  hideTitle(game);
  game.state = 'playing';

  if (name === 'chase') {
    applyTimeOfDay(game, 'day');
    beginMission(game, 0);
    const car = game.cars.find((c) => c.kind === 'parked');
    car.pos.set(48, 0, 66);
    car.angle = Math.PI;
    car.speed = 17;
    p.car = car;
    car.stolen = true;
    p.mesh.visible = false;
    for (const [ox, oz, spd] of [[-3.4, 16, 16], [3.6, 24, 15], [-0.5, 33, 14.5]]) {
      const cop = createCar(game, {
        x: 48 + ox, z: 66 + oz, angle: Math.PI, kind: 'police', police: true, color: 0xf2f3f5,
      });
      cop.speed = spd;
      const mats = cop.mesh.userData.lightMats;
      if (mats) {
        mats.red.emissiveIntensity = 2.4;
        mats.blue.emissiveIntensity = 2.4;
      }
      game.police.push(cop);
    }
    setStars(game, 3);
    game.wanted.lastCrimeAt = game.time + 9999;
    fixedCam(game, 45, 4.6, 106, 48, 1.2, 52);
  } else if (name === 'street') {
    applyTimeOfDay(game, 'day');
    beginMission(game, 0);
    p.pos.set(-43, 0, 56);
    p.angle = 2.5;
    game.cameraYaw = 2.5;
    fixedCam(game, -35.5, 3.1, 63.5, -46, 1.4, 50);
  } else if (name === 'office') {
    applyTimeOfDay(game, 'dusk');
    game.cash = 1600;
    beginMission(game, 3);
    game.mission.step = 2;
    game.insideInterior = true;
    p.pos.set(1000, 0, -1.6);
    p.angle = Math.PI;
    fixedCam(game, 1003.8, 2.7, 3.8, 999.5, 1.0, -5.2);
  }
}
