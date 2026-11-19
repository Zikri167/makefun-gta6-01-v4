// lighting.js — the two looks of Vesper Bay. Day is a bright coastal noon;
// dusk is the orange-purple hour the finale mission plays in, when the street
// lamps and the neon signs take over. setTimeOfDay lerps nothing: it snaps the
// sun, sky, fog and lamp materials to a preset, and the missions call it.

import * as THREE from 'three';

export const DAY = {
  sky: new THREE.Color(0x8ec9e8),
  fog: [90, 340],
  sunColor: new THREE.Color(0xfff2d8),
  sunIntensity: 2.6,
  sunPos: [80, 140, 40],
  hemiIntensity: 1.05,
  lampEmissive: 0.25,
  signEmissive: 0.7,
};

export const DUSK = {
  sky: new THREE.Color(0x3d2b52),
  fog: [55, 215],
  sunColor: new THREE.Color(0xff8c4a),
  sunIntensity: 1.05,
  sunPos: [-120, 26, -60],
  hemiIntensity: 0.42,
  lampEmissive: 2.6,
  signEmissive: 2.2,
};

export function applyTimeOfDay(game, name) {
  const preset = name === 'dusk' ? DUSK : DAY;
  game.timeOfDay = name;
  game.scene.background = preset.sky.clone();
  game.scene.fog = new THREE.Fog(preset.sky.getHex(), preset.fog[0], preset.fog[1]);
  game.sun.color.copy(preset.sunColor);
  game.sun.intensity = preset.sunIntensity;
  game.sun.position.set(...preset.sunPos);
  game.hemi.intensity = preset.hemiIntensity;
  for (const mat of game.lampMaterials) mat.emissiveIntensity = preset.lampEmissive;
  for (const mat of game.signMaterials) mat.emissiveIntensity = preset.signEmissive;
}
