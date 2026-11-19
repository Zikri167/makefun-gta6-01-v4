// hud.js — everything drawn over the 3D view: cash, health, wanted stars,
// the bust meter, the mission objective with its distance, a live minimap,
// banners for job titles and paydays, and the context hint that tells you
// which key does something right now. The DOM lives in index.html; this
// module owns updating it.

import { ROAD_COORDS } from './city.js';
import { currentStep, MISSIONS } from './missions.js';

const MAP_WORLD = 500;
const MAP_PX = 184;

export function createHud(game) {
  const el = (id) => document.getElementById(id);
  const hud = {
    root: el('hud'),
    cash: el('cash'),
    stars: el('stars'),
    healthFill: el('healthfill'),
    bustWrap: el('bustwrap'),
    bustFill: el('bustfill'),
    objective: el('objective'),
    objText: el('objtext'),
    objDist: el('objdist'),
    timer: el('timer'),
    bannerBox: el('banner'),
    bannerTitle: el('bannertitle'),
    bannerSub: el('bannersub'),
    flashBox: el('flash'),
    hint: el('hint'),
    insideTag: el('insidetag'),
    minimap: el('minimap').getContext('2d'),
    bannerTimer: null,
    flashTimer: null,

    banner(title, sub, ms = 4000) {
      this.bannerTitle.textContent = title;
      this.bannerSub.textContent = sub;
      this.bannerBox.classList.add('show');
      clearTimeout(this.bannerTimer);
      this.bannerTimer = setTimeout(() => this.bannerBox.classList.remove('show'), ms);
    },

    flash(text, ms = 2600) {
      this.flashBox.textContent = text;
      this.flashBox.classList.add('show');
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => this.flashBox.classList.remove('show'), ms);
    },
  };
  game.hud = hud;
  return hud;
}

function drawMinimap(game) {
  const ctx = game.hud.minimap;
  const s = MAP_PX / MAP_WORLD;
  const toPx = (v) => (v + MAP_WORLD / 2) * s;
  ctx.fillStyle = '#101722';
  ctx.fillRect(0, 0, MAP_PX, MAP_PX);
  // Sea on the east edge.
  ctx.fillStyle = '#14425c';
  ctx.fillRect(toPx(238), 0, MAP_PX - toPx(238), MAP_PX);
  // Roads.
  ctx.strokeStyle = '#46536b';
  ctx.lineWidth = 13 * s;
  for (const c of ROAD_COORDS) {
    ctx.beginPath();
    ctx.moveTo(toPx(c), 0);
    ctx.lineTo(toPx(c), MAP_PX);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, toPx(c));
    ctx.lineTo(MAP_PX, toPx(c));
    ctx.stroke();
  }
  const dot = (x, z, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(toPx(x), toPx(z), r, 0, Math.PI * 2);
    ctx.fill();
  };
  // Police, the prize car, the objective, then the player on top.
  for (const cop of game.police) dot(cop.pos.x, cop.pos.z, '#4da3ff', 3);
  const step = currentStep(game);
  if (step) {
    const anchor = step.kind === 'steal' && game.prizeCar ? game.prizeCar.pos : step.at;
    if (anchor.x < 500) dot(anchor.x, anchor.z, '#ffc94d', 4 + Math.sin(game.time * 5) * 1.2);
  }
  const p = game.player;
  const px = p.car ? p.car.pos.x : p.pos.x;
  const pz = p.car ? p.car.pos.z : p.pos.z;
  if (px < 500) {
    const ang = p.car ? p.car.angle : p.angle;
    ctx.save();
    ctx.translate(toPx(px), toPx(pz));
    ctx.rotate(Math.PI - ang);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(3.6, 4);
    ctx.lineTo(-3.6, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export function updateHud(game) {
  const hud = game.hud;
  const p = game.player;
  hud.cash.textContent = `$${game.cash}`;
  const stars = game.wanted.stars;
  hud.stars.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
  hud.stars.style.opacity = stars > 0 ? '1' : '0.25';
  hud.healthFill.style.width = `${Math.max(0, p.health)}%`;
  hud.healthFill.style.background = p.health > 30 ? '#59c135' : '#d64541';
  const bust = game.wanted.bust;
  hud.bustWrap.style.opacity = bust > 0.02 ? '1' : '0';
  hud.bustFill.style.width = `${bust * 100}%`;
  hud.insideTag.style.opacity = game.insideInterior ? '1' : '0';

  const step = currentStep(game);
  if (step) {
    const mission = MISSIONS[game.mission.index];
    hud.objective.style.opacity = '1';
    hud.objText.textContent = `${mission.title} — ${step.label}`;
    const px = p.car ? p.car.pos.x : p.pos.x;
    const pz = p.car ? p.car.pos.z : p.pos.z;
    const anchor = step.kind === 'steal' && game.prizeCar ? game.prizeCar.pos : step.at;
    const d = Math.hypot(px - anchor.x, pz - anchor.z);
    hud.objDist.textContent = game.insideInterior || step.kind === 'desk' ? '' : `${Math.round(d)} m`;
    if (game.mission.timer !== null && game.mission.active) {
      const t = Math.max(0, game.mission.timer);
      hud.timer.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
      hud.timer.style.color = t < 30 ? '#ff5a4d' : '#ffc94d';
    } else {
      hud.timer.textContent = '';
    }
  } else {
    hud.objective.style.opacity = game.mission.finishedAll ? '0' : hud.objective.style.opacity;
    if (game.mission.finishedAll) hud.objText.textContent = '';
    hud.timer.textContent = '';
  }

  // Context hint.
  let hint = '';
  if (p.car) hint = 'E — get out · W A S D — drive · Shift — (on foot) run';
  else if (game.insideInterior) hint = 'Walk to the blue ring to leave';
  else {
    const near = game.cars.find((c) => c.kind === 'parked'
      && Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < 3.4);
    if (near) hint = near === game.prizeCar ? 'E — steal the coupe' : 'E — take the car';
    else hint = 'W A S D — move · mouse — look · F — punch · P — pause';
  }
  hud.hint.textContent = hint;

  drawMinimap(game);
}
