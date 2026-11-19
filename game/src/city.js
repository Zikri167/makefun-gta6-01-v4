// city.js — Vesper Bay itself: a seeded grid city on a coast.
// Nine avenues each way (roads every 48 m, intersections always clear of
// buildings, which is where every mission marker lives), procedural towers
// with lit windows, palms, lamps, neon signs, a working harbour apron with
// containers on the east edge, then sand and open water. Every building
// registers an AABB collider that the player, the cars and the police all
// resolve against, so nothing can ever end up inside a tower.

import * as THREE from 'three';
import { rngInt, rngPick, rngRange } from './random.js';

export const ROAD_COORDS = [-192, -144, -96, -48, 0, 48, 96, 144, 192];
export const ROAD_HALF = 7;
export const CITY_EDGE = 232;

const FACADE_PALETTES = [
  { wall: '#5b6b7a', lit: '#ffd98a', dark: '#2c3540' },
  { wall: '#7a5f52', lit: '#ffe9b0', dark: '#3a2d26' },
  { wall: '#4f5e6e', lit: '#bfe6ff', dark: '#232c36' },
  { wall: '#6e6257', lit: '#ffc98a', dark: '#33291f' },
  { wall: '#546e5e', lit: '#fff3b0', dark: '#26332b' },
  { wall: '#75607a', lit: '#ffb7e2', dark: '#372b3a' },
];

const SIGN_TEXTS = ['HOTEL LUMINA', 'CLUB OLE', 'VESPER EATS', 'BANCO AZUL', 'CINEMA REY', 'BAR TROPICO', 'GYM FIERRO', 'HOTEL AZAHAR'];
const SIGN_COLORS = ['#ff5da2', '#39d5ff', '#ffb347', '#7dff6a', '#c792ff', '#ff6a5e'];

function facadeTexture(rng, palette) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = palette.wall;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = 12;
  const cw = 128 / cols;
  const rh = 256 / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < 0.42;
      ctx.fillStyle = lit ? palette.lit : palette.dark;
      ctx.globalAlpha = lit ? rngRange(rng, 0.55, 1) : 0.9;
      ctx.fillRect(x * cw + 3, y * rh + 4, cw - 6, rh - 8);
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#101018';
  ctx.fillRect(0, 0, 256, 48);
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 25);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2b2b31';
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = '#f5f2e4';
  ctx.fillRect(30, 6, 4, 52);
  ctx.fillRect(30, 70, 4, 52);
  ctx.fillStyle = '#c9c9c9';
  ctx.fillRect(1, 0, 2, 128);
  ctx.fillRect(61, 0, 2, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Merge a pile of same-material box geometries into one BufferGeometry, so
// a hundred towers cost a handful of draw calls instead of six per tower.
function mergeBoxes(parts) {
  let vTotal = 0;
  let iTotal = 0;
  for (const g of parts) {
    vTotal += g.attributes.position.count;
    iTotal += g.index.count;
  }
  const pos = new Float32Array(vTotal * 3);
  const nor = new Float32Array(vTotal * 3);
  const uv = new Float32Array(vTotal * 2);
  const idx = new Uint32Array(iTotal);
  let vo = 0;
  let io = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += g.attributes.position.count;
    io += gi.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

function boxAt(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

export function isOnRoad(x, z) {
  for (const c of ROAD_COORDS) {
    if (Math.abs(x - c) <= ROAD_HALF + 1.5) return true;
    if (Math.abs(z - c) <= ROAD_HALF + 1.5) return true;
  }
  return false;
}

export function resolveCircleCollision(colliders, pos, radius) {
  for (const box of colliders) {
    const nx = Math.max(box.minX, Math.min(pos.x, box.maxX));
    const nz = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 > radius * radius) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * radius;
      pos.z = nz + (dz / d) * radius;
    } else {
      // Centre inside the box: leave by the shallowest face.
      const left = pos.x - box.minX;
      const right = box.maxX - pos.x;
      const top = pos.z - box.minZ;
      const bottom = box.maxZ - pos.z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = box.minX - radius;
      else if (m === right) pos.x = box.maxX + radius;
      else if (m === top) pos.z = box.minZ - radius;
      else pos.z = box.maxZ + radius;
    }
  }
}

// Palms are drawn with two InstancedMeshes (trunks, leaves) however many of
// them the coast needs: one draw call each instead of seven per tree.
function palmInstances(rng, spots) {
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 1, 6);
  const leafGeo = new THREE.PlaneGeometry(2.6, 0.55);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f, side: THREE.DoubleSide });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, spots.length * 6);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  let li = 0;
  spots.forEach(([x, z], i) => {
    const height = rngRange(rng, 4.5, 6.5);
    e.set(0, 0, rngRange(rng, -0.08, 0.08));
    q.setFromEuler(e);
    m.compose(v.set(x, height / 2, z), q, sc.set(1, height, 1));
    trunks.setMatrixAt(i, m);
    for (let k = 0; k < 6; k++) {
      const angle = (k / 6) * Math.PI * 2;
      e.set(-0.7, angle, 0, 'YXZ');
      q.setFromEuler(e);
      m.compose(
        v.set(x + Math.cos(angle) * 1.05, height + 0.25, z + Math.sin(angle) * 1.05),
        q, sc.set(1, 1, 1),
      );
      leaves.setMatrixAt(li++, m);
    }
  });
  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  return [trunks, leaves];
}

export function buildCity(game) {
  const rng = game.rng;
  const group = new THREE.Group();
  const colliders = [];
  game.scene.add(group);

  // Base ground: city slab, then grass-dark beyond, sand and sea to the east.
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshLambertMaterial({ color: 0x8f9296 }),
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.y = -0.02;
  group.add(slab);

  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshLambertMaterial({ color: 0x44513c }),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.06;
  group.add(outer);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 560),
    new THREE.MeshLambertMaterial({ color: 0xd9c28f }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(255, -0.01, 0);
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 900),
    new THREE.MeshLambertMaterial({ color: 0x1d6f8e }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(620, -0.35, 0);
  group.add(sea);
  game.sea = sea;

  // Roads: one textured material, strips along every coordinate, both ways.
  const roadTex = roadTexture();
  const roadMatNS = new THREE.MeshLambertMaterial({ map: roadTex.clone() });
  roadMatNS.map.repeat.set(1, 30);
  roadMatNS.map.needsUpdate = true;
  const roadMatEW = new THREE.MeshLambertMaterial({ map: roadTex.clone() });
  roadMatEW.map.repeat.set(30, 1);
  roadMatEW.map.needsUpdate = true;
  for (const c of ROAD_COORDS) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 480), roadMatNS);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(c, 0.02, 0);
    group.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(480, ROAD_HALF * 2), roadMatEW);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.021, c);
    group.add(ew);
  }

  // Harbour apron east of the last avenue: concrete, containers, crates.
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 480),
    new THREE.MeshLambertMaterial({ color: 0x7d7f82 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(216, 0.015, 0);
  group.add(apron);
  const containerColors = [0xb5493a, 0x3a6fb5, 0x3fae6a, 0xc7a23a, 0x7a4fa3];
  for (let i = 0; i < 14; i++) {
    const w = 6;
    const d = 2.6;
    const h = 2.6;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: rngPick(rng, containerColors) }),
    );
    const cx = rngRange(rng, 206, 226);
    const cz = -210 + i * 30 + rngRange(rng, -6, 6);
    box.position.set(cx, h / 2, cz);
    box.rotation.y = rng() < 0.5 ? 0 : Math.PI / 2;
    group.add(box);
    const hw = box.rotation.y === 0 ? w / 2 : d / 2;
    const hd = box.rotation.y === 0 ? d / 2 : w / 2;
    colliders.push({ minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd });
  }

  // Lighthouse on the harbour point: a striped tower with the lamp material.
  const lighthouse = new THREE.Group();
  const lhBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3, 16, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8e2d4 }),
  );
  lhBase.position.y = 8;
  lighthouse.add(lhBase);
  const lhBand = new THREE.Mesh(
    new THREE.CylinderGeometry(2.45, 2.6, 3, 10),
    new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
  );
  lhBand.position.y = 10;
  lighthouse.add(lhBand);
  const lhLampMat = new THREE.MeshLambertMaterial({ color: 0x443b18, emissive: 0xffca5f, emissiveIntensity: 0.4 });
  const lhLamp = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.4, 8), lhLampMat);
  lhLamp.position.y = 17.2;
  lighthouse.add(lhLamp);
  game.lampMaterials.push(lhLampMat);
  lighthouse.position.set(228, 0, -228);
  group.add(lighthouse);
  colliders.push({ minX: 224.5, maxX: 231.5, minZ: -231.5, maxZ: -224.5 });

  // Buildings: one or two per block cell, facades from the palette canvases.
  // All towers sharing a facade merge into a single mesh; roofs merge too.
  const facadeMats = FACADE_PALETTES.map((p) => new THREE.MeshLambertMaterial({ map: facadeTexture(rng, p) }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x2f3338 });
  const facadeParts = facadeMats.map(() => []);
  const roofParts = [];
  for (let ix = 0; ix < ROAD_COORDS.length - 1; ix++) {
    for (let iz = 0; iz < ROAD_COORDS.length - 1; iz++) {
      const x0 = ROAD_COORDS[ix] + ROAD_HALF + 2;
      const x1 = ROAD_COORDS[ix + 1] - ROAD_HALF - 2;
      const z0 = ROAD_COORDS[iz] + ROAD_HALF + 2;
      const z1 = ROAD_COORDS[iz + 1] - ROAD_HALF - 2;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const two = rng() < 0.35;
      const spots = two
        ? [[cx - 8.5, cz], [cx + 8.5, cz]]
        : [[cx + rngRange(rng, -3, 3), cz + rngRange(rng, -3, 3)]];
      for (const [bx, bz] of spots) {
        const w = rngRange(rng, 13, 17);
        const d = rngRange(rng, 13, 17);
        const h = rngRange(rng, 11, 46) * (Math.abs(cx) < 60 && Math.abs(cz) < 60 ? 1.25 : 1);
        const mi = Math.floor(rng() * facadeMats.length);
        facadeParts[mi].push(boxAt(w, h, d, bx, h / 2, bz));
        roofParts.push(boxAt(w + 0.4, 0.35, d + 0.4, bx, h + 0.17, bz));
        colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });

        // A neon sign on some street-facing towers.
        if (rng() < 0.3) {
          const color = rngPick(rng, SIGN_COLORS);
          const tex = signTexture(rngPick(rng, SIGN_TEXTS), color);
          const signMat = new THREE.MeshLambertMaterial({
            map: tex,
            emissive: 0xffffff,
            emissiveMap: tex,
            emissiveIntensity: 0.7,
            color: 0x222222,
          });
          game.signMaterials.push(signMat);
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.1), signMat);
          sign.position.set(bx, Math.min(h - 2, rngRange(rng, 6, 12)), bz - d / 2 - 0.06);
          sign.rotation.y = Math.PI;
          group.add(sign);
        }
      }
    }
  }
  facadeParts.forEach((parts, i) => {
    if (parts.length) group.add(new THREE.Mesh(mergeBoxes(parts), facadeMats[i]));
  });
  group.add(new THREE.Mesh(mergeBoxes(roofParts), roofMat));

  // Street lamps along every avenue: two InstancedMeshes (poles, heads)
  // however many lamps the grid needs, one shared lamp material.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x333026, emissive: 0xffb45e, emissiveIntensity: 0.25 });
  game.lampMaterials.push(lampMat);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampSpots = [];
  for (const c of ROAD_COORDS) {
    for (let t = -216; t <= 216; t += 48) {
      for (const side of [-1, 1]) {
        lampSpots.push([c + side * (ROAD_HALF + 1.2), t + (side > 0 ? 24 : 0)]);
        lampSpots.push([t + (side > 0 ? 24 : 0), c + side * (ROAD_HALF + 1.2)]);
      }
    }
  }
  const poleInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 5), poleMat, lampSpots.length);
  const headInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.18, 0.7), lampMat, lampSpots.length);
  {
    const m = new THREE.Matrix4();
    lampSpots.forEach(([x, z], i) => {
      m.makeTranslation(x, 2.7, z);
      poleInst.setMatrixAt(i, m);
      m.makeTranslation(x, 5.45, z);
      headInst.setMatrixAt(i, m);
    });
    poleInst.instanceMatrix.needsUpdate = true;
    headInst.instanceMatrix.needsUpdate = true;
  }
  group.add(poleInst, headInst);

  // Palms: dense on the coast avenue and the harbour, sparse inland.
  const palmSpots = [];
  for (let z = -220; z <= 220; z += 16) {
    for (const side of [-1, 1]) {
      if (rng() < 0.25) continue;
      palmSpots.push([192 + side * (ROAD_HALF + 2.4), z + rngRange(rng, -3, 3)]);
    }
  }
  for (let i = 0; i < 26; i++) {
    const c = rngPick(rng, ROAD_COORDS);
    palmSpots.push([c + rngRange(rng, -1, 1) * (ROAD_HALF + 2.4), rngRange(rng, -220, 220)]);
  }
  group.add(...palmInstances(rng, palmSpots));

  return { colliders, group };
}
