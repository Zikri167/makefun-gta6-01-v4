// main.js — Neon Tide's bootstrap and frame loop. It builds Vesper Bay once
// (city, traffic, crowds, the player, the law, Mona's office), then runs the
// state machine: title, playing, paused, ended. Crimes and accidents travel
// through game.events so the wanted system, the health system and the sound
// bank each price them in exactly one place.

import * as THREE from 'three';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { buildCity } from './city.js';
import { spawnTraffic, spawnParked, updateTraffic, driveCar } from './vehicles.js';
import { createPlayer, updatePlayerOnFoot, updateCamera } from './player.js';
import { spawnPedestrians, updatePedestrians, checkCarPedHits } from './pedestrians.js';
import { createWanted, addStars, updateWanted } from './wanted.js';
import { buildInterior, updateInterior } from './interiors.js';
import { createMissionState, beginMission, updateMissions, MISSIONS } from './missions.js';
import { createHud, updateHud } from './hud.js';
import { applyTimeOfDay } from './lighting.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { mulberry32, seedFromQuery } from './random.js';
import { setupShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = seedFromQuery(window.location.search);
const shotName = params.get('shot');

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  game.camera.aspect = window.innerWidth / window.innerHeight;
  game.camera.updateProjectionMatrix();
});

const game = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900),
  rng: mulberry32(seed),
  time: 0,
  state: 'title',
  cash: 150,
  jobsDone: 0,
  cars: [],
  peds: [],
  police: [],
  events: [],
  lampMaterials: [],
  signMaterials: [],
  insideInterior: false,
  cameraYaw: Math.PI,
  cameraPitch: 0.32,
  lastCarCrimeAt: -99,
  shotMode: !!shotName,
  fixedCamera: null,
  frames: 0,
};
game.audio = new SoundBank();
game.input = new Input(canvas);
game.scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x54482e, 1.0));
game.hemi = game.scene.children[game.scene.children.length - 1];
game.sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
game.sun.position.set(80, 140, 40);
game.scene.add(game.sun);
game.scene.add(new THREE.AmbientLight(0xffffff, 0.12));

game.city = buildCity(game);
spawnTraffic(game);
spawnParked(game);
spawnPedestrians(game);
createPlayer(game);
createWanted(game);
buildInterior(game);
createMissionState(game);
createHud(game);
applyTimeOfDay(game, 'day');

// ---------------------------------------------------------------- states ---

const titleScreen = document.getElementById('title-screen');
const pauseScreen = document.getElementById('pause-screen');
const endScreen = document.getElementById('end-screen');
const savedGame = loadSave();
if (!savedGame) document.getElementById('btn-continue').style.display = 'none';

function showHud(on) {
  game.hud.root.classList.toggle('hidden', !on);
}

function resetPlayerToStreet() {
  const p = game.player;
  if (p.car) {
    p.car = null;
    p.mesh.visible = true;
  }
  game.insideInterior = false;
  p.pos.set(6, 0, 10);
  p.angle = Math.PI;
  p.health = 100;
  game.cameraYaw = Math.PI;
}

function startRun(fromSave) {
  game.audio.unlock();
  titleScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  showHud(true);
  resetPlayerToStreet();
  for (const cop of game.police) {
    game.scene.remove(cop.mesh);
    game.cars.splice(game.cars.indexOf(cop), 1);
  }
  game.police.length = 0;
  game.wanted.stars = 0;
  game.wanted.bust = 0;
  applyTimeOfDay(game, 'day');
  if (fromSave && savedGame) {
    game.cash = savedGame.cash;
    game.jobsDone = savedGame.jobsDone;
    if (savedGame.jobsDone >= MISSIONS.length) {
      game.mission.finishedAll = true;
      game.hud.banner('VESPER BAY IS YOURS', 'All of Mona\'s jobs are done. The streets are still open — drive.', 6000);
    } else {
      beginMission(game, Math.min(savedGame.missionIndex, MISSIONS.length - 1));
    }
  } else {
    clearSave();
    game.cash = 150;
    game.jobsDone = 0;
    beginMission(game, 0);
  }
  game.state = 'playing';
}

function endRun(kind) {
  game.state = 'ended';
  game.audio.setSiren(false);
  game.audio.setEngine(false);
  const fine = kind === 'busted' ? 150 : 100;
  game.cash = Math.max(50, game.cash - fine);
  document.getElementById('end-title').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  document.getElementById('end-sub').textContent = kind === 'busted'
    ? `The Vesper Bay PD walk you to the station and take $${fine} for the paperwork. The job is still out there.`
    : `You wake up outside San Vesper hospital, $${fine} lighter. The job is still out there.`;
  endScreen.classList.remove('hidden');
  if (kind === 'busted') game.audio.bustedSting();
  writeSave({ cash: game.cash, missionIndex: game.mission.index, jobsDone: game.jobsDone });
}

function respawn() {
  endScreen.classList.add('hidden');
  resetPlayerToStreet();
  for (const cop of game.police) {
    game.scene.remove(cop.mesh);
    game.cars.splice(game.cars.indexOf(cop), 1);
  }
  game.police.length = 0;
  game.wanted.stars = 0;
  game.wanted.bust = 0;
  game.state = 'playing';
}

document.getElementById('btn-new').addEventListener('click', () => startRun(false));
document.getElementById('btn-continue').addEventListener('click', () => startRun(true));
document.getElementById('btn-resume').addEventListener('click', () => {
  pauseScreen.classList.add('hidden');
  game.state = 'playing';
});
document.getElementById('btn-respawn').addEventListener('click', respawn);

// ---------------------------------------------------------------- events ---

function hurtPlayer(amount) {
  const p = game.player;
  if (game.time - p.lastHurtAt < 0.35) return;
  p.lastHurtAt = game.time;
  p.health -= amount;
  if (p.health <= 0) {
    p.health = 0;
    endRun('wasted');
  }
}

function processEvents() {
  for (const ev of game.events.splice(0)) {
    if (ev.type === 'car-hit') {
      game.audio.crash(0.8);
      if (game.time - game.lastCarCrimeAt > 2.5) {
        game.lastCarCrimeAt = game.time;
        addStars(game, 1);
      }
    } else if (ev.type === 'ped-hit') {
      game.audio.crash(0.5);
      if (ev.byPlayer) addStars(game, 2);
    } else if (ev.type === 'police-ram') {
      hurtPlayer(ev.speed * 0.5);
      game.audio.crash(0.7);
    } else if (ev.type === 'busted') {
      endRun('busted');
    }
  }
}

// ------------------------------------------------------------- interaction ---

function tryEnterExitCar() {
  const p = game.player;
  if (p.car) {
    const car = p.car;
    p.car = null;
    p.mesh.visible = true;
    p.pos.set(car.pos.x + Math.cos(car.angle) * 2.2, 0, car.pos.z - Math.sin(car.angle) * 2.2);
    p.angle = car.angle;
    game.audio.setEngine(false);
    game.audio.door();
    return;
  }
  let best = null;
  let bestD = 3.6;
  for (const car of game.cars) {
    if (car.kind !== 'parked') continue;
    const d = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (best) {
    p.car = best;
    p.mesh.visible = false;
    game.audio.door();
    if (!best.stolen) {
      best.stolen = true;
      addStars(game, 1);
      game.hud.flash(best.isPrizeCar ? 'That\'s the coupe. The bay noticed.' : 'Car taken. The bay noticed.');
    }
  }
}

function tryPunch() {
  const p = game.player;
  p.punchAt = game.time;
  game.audio.punch();
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.pos.x - p.pos.x, ped.pos.z - p.pos.z);
    if (d < 2.3) {
      ped.state = 'down';
      ped.stateAt = game.time;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.25;
      addStars(game, 1);
      game.hud.flash('That was somebody\'s cousin, probably.');
      break;
    }
  }
}

// ------------------------------------------------------------------- loop ---

const timer = new THREE.Timer();

function frame() {
  requestAnimationFrame(frame);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  game.frames += 1;

  if (game.shotMode) {
    game.time += dt;
    updateTraffic(game, dt);
    updatePedestrians(game, dt);
    updateMissions(game, dt);
    updateInterior(game, dt);
    updateHud(game);
    if (game.fixedCamera) {
      game.camera.position.copy(game.fixedCamera.pos);
      game.camera.lookAt(game.fixedCamera.look);
    }
    renderer.render(game.scene, game.camera);
    if (game.frames === 45) window.__shotReady = true;
    return;
  }

  if (game.state === 'title') {
    // A slow orbit over the bay behind the title.
    const t = performance.now() * 0.00004;
    game.camera.position.set(Math.cos(t) * 150, 52, Math.sin(t) * 150);
    game.camera.lookAt(0, 6, 0);
    updateTraffic(game, dt);
    updatePedestrians(game, dt);
    renderer.render(game.scene, game.camera);
    return;
  }

  if (game.state === 'paused' || game.state === 'ended') {
    if (game.state === 'paused' && game.input.pressed('KeyP')) {
      pauseScreen.classList.add('hidden');
      game.state = 'playing';
    }
    renderer.render(game.scene, game.camera);
    return;
  }

  game.time += dt;
  processEvents();
  if (game.state !== 'playing') { // an event may have ended the run
    renderer.render(game.scene, game.camera);
    return;
  }

  if (game.input.pressed('KeyP')) {
    game.state = 'paused';
    pauseScreen.classList.remove('hidden');
    renderer.render(game.scene, game.camera);
    return;
  }
  if (game.input.pressed('KeyE')) tryEnterExitCar();
  if (game.input.pressed('KeyF') && !game.player.car) tryPunch();

  const p = game.player;
  if (p.car) {
    const impact = driveCar(game, p.car, dt);
    if (impact > 8) {
      hurtPlayer((impact - 6) * 0.8);
      game.audio.crash(1);
      if (game.time - game.lastCarCrimeAt > 2.5) {
        game.lastCarCrimeAt = game.time;
        addStars(game, 1);
      }
    }
    game.audio.setEngine(true, p.car.speed / p.car.maxSpeed);
  } else {
    updatePlayerOnFoot(game, dt);
  }

  for (const car of game.cars) {
    if (car.hitRecently) car.hitRecently = Math.max(0, car.hitRecently - dt);
  }
  updateTraffic(game, dt);
  updatePedestrians(game, dt);
  checkCarPedHits(game);
  updateWanted(game, dt);
  updateMissions(game, dt);
  updateInterior(game, dt);

  // Health creeps back once you have been out of trouble a while.
  if (game.time - p.lastHurtAt > 9 && p.health > 0 && p.health < 100) {
    p.health = Math.min(100, p.health + dt * 3.5);
  }

  updateCamera(game, dt);
  updateHud(game);
  renderer.render(game.scene, game.camera);
}

if (shotName) setupShot(game, shotName);
frame();

// A handle for the play-test script (and curious players in the console).
window.NeonTide = {
  game,
  startNew: () => startRun(false),
  teleport: (x, z) => {
    const p = game.player;
    if (p.car) p.car.pos.set(x, 0, z);
    else p.pos.set(x, 0, z);
  },
  setStars: (n) => { game.wanted.stars = n; game.wanted.lastCrimeAt = game.time; },
  hurt: (n) => { game.player.health -= n; },
};
