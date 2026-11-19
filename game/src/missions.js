// missions.js — Mona Reyes's jobs for Dario, four of them, each a chain of
// steps the beacon leads you through. Every step point sits on a road
// intersection or the open harbour, never inside a building, so every job
// can always be finished. Finishing a job pays, saves, and queues the next;
// the last one plays at dusk and ends at Mona's desk.

import * as THREE from 'three';
import { addStars, setStars } from './wanted.js';
import { applyTimeOfDay } from './lighting.js';
import { OFFICE_DESK, DOOR_OUTSIDE } from './interiors.js';
import { writeSave } from './save.js';

export const MISSIONS = [
  {
    id: 'first-run',
    title: 'First Run',
    brief: 'Mona: "A package is waiting at the docks. Bring it to the market. Simple."',
    reward: 300,
    steps: [
      { kind: 'goto', at: { x: 192, z: 144 }, r: 6.5, label: 'Pick up the package at the docks' },
      { kind: 'goto', at: { x: -48, z: 48 }, r: 6.5, label: 'Deliver the package to the market' },
    ],
  },
  {
    id: 'borrowed-wheels',
    title: 'Borrowed Wheels',
    brief: 'Mona: "A tangerine coupe is parked on the harbour. It needs a new owner. You."',
    reward: 450,
    steps: [
      { kind: 'steal', at: { x: 197.6, z: -48 }, r: 7, label: 'Steal the tangerine coupe on the harbour' },
      { kind: 'goto', at: { x: 96, z: -144 }, r: 7.5, label: 'Deliver the coupe to the garage' },
    ],
  },
  {
    id: 'three-drops',
    title: 'Three Drops',
    brief: 'Mona: "Three cash drops, one clock. The whole bay is watching, so move."',
    reward: 700,
    timeLimit: 170,
    steps: [
      { kind: 'collect', at: { x: 0, z: -192 }, r: 6.5, label: 'Collect drop 1 of 3 — south point' },
      { kind: 'collect', at: { x: -144, z: 96 }, r: 6.5, label: 'Collect drop 2 of 3 — west side' },
      { kind: 'collect', at: { x: 144, z: -48 }, r: 6.5, label: 'Collect drop 3 of 3 — east side' },
    ],
  },
  {
    id: 'harbor-lights',
    title: 'Harbor Lights',
    brief: 'Mona: "Last job. Meet the boat at the lighthouse point, then bring it home. To me."',
    reward: 1000,
    steps: [
      { kind: 'goto', at: { x: 192, z: -192 }, r: 6.5, label: 'Meet the boat at the lighthouse point' },
      { kind: 'enter-office', at: DOOR_OUTSIDE, r: 4, label: 'Come up to Mona\'s office (pink door)' },
      { kind: 'desk', at: OFFICE_DESK, r: 3, label: 'Hand it over at Mona\'s desk' },
    ],
  },
];

export function createMissionState(game) {
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffc94d, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 34, 18, 1, true), beaconMat);
  beacon.position.y = 17;
  beacon.visible = false;
  game.scene.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.6, 30), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.07;
  ring.visible = false;
  game.scene.add(ring);

  game.mission = {
    index: 0,
    step: 0,
    active: false,
    finishedAll: false,
    timer: null,
    pendingAt: -1,
    beacon,
    ring,
  };
  return game.mission;
}

export function currentStep(game) {
  const m = game.mission;
  if (!m.active || m.finishedAll) return null;
  return MISSIONS[m.index].steps[m.step] ?? null;
}

export function beginMission(game, index) {
  const m = game.mission;
  m.index = index;
  m.step = 0;
  m.active = true;
  m.finishedAll = false;
  const mission = MISSIONS[index];
  m.timer = mission.timeLimit ?? null;
  if (mission.id === 'harbor-lights') {
    applyTimeOfDay(game, 'dusk');
    setStars(game, 2);
  }
  game.hud.banner(`JOB ${index + 1} — ${mission.title}`, mission.brief, 5200);
  game.audio.stepJingle();
}

function completeMission(game) {
  const m = game.mission;
  const mission = MISSIONS[m.index];
  game.cash += mission.reward;
  game.jobsDone += 1;
  m.active = false;
  m.beacon.visible = false;
  m.ring.visible = false;
  game.audio.cash();
  if (m.index >= MISSIONS.length - 1) {
    m.finishedAll = true;
    game.hud.banner('ALL JOBS DONE', `Mona is paid in full. Vesper Bay is yours, Dario. Final cash $${game.cash}.`, 9000);
    game.audio.finaleJingle();
    writeSave({ cash: game.cash, missionIndex: MISSIONS.length - 1, jobsDone: game.jobsDone });
  } else {
    game.hud.banner(`${mission.title} — DONE`, `+$${mission.reward}. Cash: $${game.cash}. Next job coming up.`, 4200);
    game.audio.missionJingle();
    writeSave({ cash: game.cash, missionIndex: m.index + 1, jobsDone: game.jobsDone });
    m.pendingAt = game.time + 4;
  }
}

function advanceStep(game) {
  const m = game.mission;
  const mission = MISSIONS[m.index];
  const step = mission.steps[m.step];
  if (step.kind === 'collect') addStars(game, 1);
  game.audio.stepJingle();
  m.step += 1;
  if (m.step >= mission.steps.length) completeMission(game);
  else game.hud.flash(MISSIONS[m.index].steps[m.step].label);
}

function failTimedMission(game) {
  const m = game.mission;
  game.hud.banner('OUT OF TIME', 'The drops went cold. Mona sends you back out.', 3600);
  game.audio.bustedSting();
  m.step = 0;
  m.timer = MISSIONS[m.index].timeLimit;
  setStars(game, 0);
}

export function updateMissions(game, dt) {
  const m = game.mission;
  if (m.pendingAt > 0 && game.time >= m.pendingAt && !m.active && !m.finishedAll) {
    m.pendingAt = -1;
    beginMission(game, m.index + 1);
  }
  const step = currentStep(game);
  if (!step) {
    m.beacon.visible = false;
    m.ring.visible = false;
    return;
  }
  if (m.timer !== null) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failTimedMission(game);
      return;
    }
  }
  // The beacon stands on the step point; for the steal step it rides the car.
  const anchor = step.kind === 'steal' && game.prizeCar ? game.prizeCar.pos : step.at;
  // Indoors the pillar of light would fill the whole room; the ring is enough.
  m.beacon.visible = !game.insideInterior;
  m.ring.visible = true;
  m.beacon.position.set(anchor.x, 17, anchor.z);
  m.ring.position.set(anchor.x, 0.07, anchor.z);
  const pulse = 1 + Math.sin(game.time * 4) * 0.08;
  m.ring.scale.set(pulse, pulse, 1);

  const p = game.player;
  const px = p.car ? p.car.pos.x : p.pos.x;
  const pz = p.car ? p.car.pos.z : p.pos.z;
  const dist = Math.hypot(px - step.at.x, pz - step.at.z);

  if (step.kind === 'goto' || step.kind === 'collect') {
    if (dist < step.r) advanceStep(game);
  } else if (step.kind === 'steal') {
    if (p.car && p.car === game.prizeCar) advanceStep(game);
  } else if (step.kind === 'enter-office') {
    if (game.insideInterior) advanceStep(game);
  } else if (step.kind === 'desk') {
    if (game.insideInterior && dist < step.r) advanceStep(game);
  }
}
