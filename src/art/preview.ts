// Dev-only art review page (art-preview.html). Draws every texture with plain canvases,
// plays the animations, composites each zone, then boots a tiny Phaser scene to prove
// registerArt() works with the real texture/animation managers.
import {
  buildArt, buildAreaLayer, timeBuilders, juniperHatAnchor, flurrySilhouette, LODGE_SHELVES, AREA_NAMES,
  heroHatAnchor, drawHero, buildHeroSheet, heroAnimSpecs,
} from './index';
import { HERO_IDS, HERO_NAMES, HeroId, heroKey, heroAnim, heroPortraitKey } from './keys';
import { hex } from './palette';
import type { SheetSpec, AnimSpec } from './draw';
import { frameRect } from './draw';
import {
  TEX, BG_LAYERS, BG_SCROLL, bgKey, juniperKey, juniperAnim, ANIM, gemKey, presentKey, SCARF_COLOURS,
  TEX2, ANIM2, COUNT_ICONS, CountIcon, countIconKey, TOOL_IDS, toolKey, HAT_COUNT, hatKey, FLURRY_KINDS, FLURRY_NAMES,
  flurryKey, areaBgKey, TEX4, ANIM4,
} from './keys';

const app = document.getElementById('app')!;
const stats = document.getElementById('stats')!;
const params = new URLSearchParams(location.search);
const scale = Number(params.get('scale') ?? '1');

const t0 = performance.now();
const bundle = buildArt();
const buildMs = performance.now() - t0;
const byKey = new Map<string, SheetSpec>(bundle.sheets.map((s) => [s.key, s]));
let px = 0;
let pxSprites = 0;
let pxZone0 = 0;
for (const s of bundle.sheets) {
  const n = s.canvas.width * s.canvas.height;
  px += n;
  if (!s.key.startsWith('bg-')) pxSprites += n;
  else if (s.key.startsWith('bg-0-')) pxZone0 += n;
}
const mb = (n: number) => ((n * 4) / 1048576).toFixed(0);
stats.textContent =
  `textures: ${bundle.sheets.length}   animations: ${bundle.anims.length}   build: ${buildMs.toFixed(0)} ms   ` +
  `texture memory (everything, as drawn here): ${mb(px)} MB\n` +
  `in game: sprites/UI ${mb(pxSprites)} MB + one zone's backgrounds ${mb(pxZone0)} MB = ${mb(pxSprites + pxZone0)} MB resident (zones load on demand)\n` +
  `sprite builders (2nd run): ${timeBuilders().map((b) => `${b.name.replace('build', '')} ${b.ms.toFixed(0)}`).join(', ')} ms`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function section(id: string, title: string): HTMLElement {
  const h = el('h2', '', title);
  h.id = id;
  app.appendChild(h);
  const d = el('div');
  app.appendChild(d);
  return d;
}

/** Optional sub-rectangle of each frame for focus close-ups: ?crop=x,y,w,h (frame pixels). */
const crop = (params.get('crop') ?? '').split(',').filter(Boolean).map(Number);

function frameCanvas(s: SheetSpec, i: number, bg: string, k = scale, useCrop = false): HTMLCanvasElement {
  let [x, y, w, h] = frameRect(s, i);
  if (useCrop && crop.length === 4) {
    x += crop[0];
    y += crop[1];
    w = Math.min(crop[2], w - crop[0]);
    h = Math.min(crop[3], h - crop[1]);
  }
  const c = el('canvas');
  c.width = w * k;
  c.height = h * k;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(s.canvas, x, y, w, h, 0, 0, w * k, h * k);
  return c;
}

function showSheet(parent: HTMLElement, s: SheetSpec, maxW = 260): void {
  const h = el('h3', '', `${s.key}  (${s.frames ?? 1} frame${(s.frames ?? 1) > 1 ? 's' : ''}, ${s.frameW ?? s.canvas.width}x${s.frameH ?? s.canvas.height})`);
  parent.appendChild(h);
  const row = el('div', 'row');
  parent.appendChild(row);
  const n = s.frames ?? 1;
  const fw = s.frameW ?? s.canvas.width;
  const k = Math.min(1, maxW / fw);
  for (const bg of ['#808088', '#e6eeff']) {
    for (let i = 0; i < n; i++) {
      const cell = el('div', 'cell');
      const c = frameCanvas(s, i, bg, k);
      cell.appendChild(c);
      cell.appendChild(el('span', '', String(i)));
      row.appendChild(cell);
    }
  }
}

// ---------- focus mode: ?focus=key&frames=0,1,2&z=3&bg=%23e6eeff (big frames for close review) ----------
const focus = params.get('focus');
if (focus) {
  const z = Number(params.get('z') ?? '3');
  const bg = params.get('bg') ?? '#e6eeff';
  const list = (params.get('frames') ?? '').split(',').filter(Boolean).map(Number);
  const row = el('div', 'row');
  row.style.gap = '4px';
  app.appendChild(row);
  document.querySelector('h1')?.remove();
  stats.style.display = 'none';
  for (const key of focus.split(',')) {
    // hero sheets are on demand: ?focus=hero-pip-0 builds it here
    const hm = /^hero-(pip|marlow|odette|bluster)-(\d)$/.exec(key);
    if (hm && !byKey.has(key)) byKey.set(key, buildHeroSheet(hm[1] as 'pip', Number(hm[2])));
    const s = byKey.get(key);
    const frames = list.length ? list : Array.from({ length: s?.frames ?? 1 }, (_, i) => i);
    if (s) for (const i of frames) row.appendChild(frameCanvas(s, i, bg, z, true));
  }
  document.querySelector('nav')?.remove();
}
const v3 = params.get('v3');
const v4 = params.get('v4');
const full = !focus && !v3 && !v4;
const legacy = full && !params.has('v2');

// ---------- animation player ----------

interface Player { anim: AnimSpec; sheet: SheetSpec; ctx: CanvasRenderingContext2D; idx: number; acc: number; done: boolean; bg: string; k: number }
const players: Player[] = [];

function addPlayer(parent: HTMLElement, anim: AnimSpec, bg: string, k = 1, label = anim.key): void {
  const sheet = byKey.get(anim.texture);
  if (!sheet) return;
  const cell = el('div', 'cell');
  const c = el('canvas');
  c.width = (sheet.frameW ?? 0) * k;
  c.height = (sheet.frameH ?? 0) * k;
  cell.appendChild(c);
  cell.appendChild(el('span', '', label));
  parent.appendChild(cell);
  players.push({ anim, sheet, ctx: c.getContext('2d')!, idx: 0, acc: 0, done: false, bg, k });
}

let last = performance.now();
function tick(now: number): void {
  const dt = Math.min(100, now - last);
  last = now;
  for (const p of players) {
    const ms = p.anim.hold?.[p.idx] ?? 1000 / p.anim.frameRate;
    p.acc += dt;
    if (p.acc >= ms) {
      p.acc -= ms;
      if (p.idx + 1 < p.anim.frames.length) p.idx++;
      else if (p.anim.repeat === -1) p.idx = 0;
      else {
        // one-shots: hold the last frame for a beat, then restart so reviewers can watch again
        p.acc -= 900;
        p.idx = 0;
      }
    }
    const [x, y, w, h] = frameRect(p.sheet, p.anim.frames[p.idx]);
    p.ctx.fillStyle = p.bg;
    p.ctx.fillRect(0, 0, w * p.k, h * p.k);
    p.ctx.drawImage(p.sheet.canvas, x, y, w, h, 0, 0, w * p.k, h * p.k);
    // feet line
    p.ctx.fillStyle = 'rgba(29,26,58,0.25)';
    p.ctx.fillRect(0, h * p.k - 1, w * p.k, 1);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ---------- Juniper ----------
if (legacy) {
  const sec = section('juniper', 'Juniper');
  sec.appendChild(el('h3', '', 'Animations (scarf 0) on snow and grey, 1:1'));
  const row = el('div', 'row');
  sec.appendChild(row);
  const base = [ANIM.idle, ANIM.walk, ANIM.jumpUp, ANIM.jumpFall, ANIM.cheer, 'juniper-land'];
  for (const bg of ['#e6eeff', '#808088']) {
    for (const b of base) {
      const a = bundle.anims.find((x) => x.key === juniperAnim(b, 0));
      if (a) addPlayer(row, a, bg);
    }
  }
  sec.appendChild(el('h3', '', 'Walk, every scarf colour'));
  const row2 = el('div', 'row');
  sec.appendChild(row2);
  SCARF_COLOURS.forEach((_, s) => {
    const a = bundle.anims.find((x) => x.key === juniperAnim(ANIM.walk, s));
    if (a) addPlayer(row2, a, '#e6eeff', 0.75, `scarf ${s}`);
  });
  sec.appendChild(el('h3', '', 'Big (2x) idle + walk + cheer'));
  const row3 = el('div', 'row');
  sec.appendChild(row3);
  for (const b of [ANIM.idle, ANIM.walk, ANIM.cheer]) {
    const a = bundle.anims.find((x) => x.key === juniperAnim(b, 0));
    if (a) addPlayer(row3, a, '#e6eeff', 2);
  }
  const s0 = byKey.get(juniperKey(0));
  if (s0) showSheet(sec, s0, 200);
}

// ---------- other textures ----------
if (legacy) {
  const sec = section('textures', 'Textures (grey, then snow)');
  const animRow = el('div', 'row');
  sec.appendChild(el('h3', '', 'Item animations'));
  sec.appendChild(animRow);
  for (const a of bundle.anims) {
    if (a.key.startsWith('juniper')) continue;
    addPlayer(animRow, a, '#808088', 0.75);
  }
  for (const s of bundle.sheets) {
    if (s.key.startsWith('bg-') || s.key.startsWith(TEX.juniper) || isV2Key(s.key)) continue;
    showSheet(sec, s);
  }
}

// ---------- zone mock screens ----------
function drawTiled(ctx: CanvasRenderingContext2D, s: SheetSpec | undefined, y: number, offset: number): void {
  if (!s) return;
  const w = s.canvas.width;
  let x = -(((offset % w) + w) % w);
  for (; x < 1280; x += w) ctx.drawImage(s.canvas, x, y);
}

function frame(ctx: CanvasRenderingContext2D, key: string, i: number, x: number, y: number, ox: number, oy: number, k = 1): void {
  const s = byKey.get(key);
  if (!s) return;
  const [fx, fy, w, h] = frameRect(s, i);
  ctx.drawImage(s.canvas, fx, fy, w, h, x - w * ox * k, y - h * oy * k, w * k, h * k);
}

if (legacy || params.has('zones')) {
  const sec = section('zones', 'Zones: 5 layers composited (camera scrolled 700 px so seams are in view)');
  const names = ['Lantern Meadow', 'Frostpine Forest', 'Glimmer Caves', 'Clocktower Ridge', 'The Summit'];
  const onlyZone = params.get('zone');
  for (let z = 0; z < 5; z++) {
    if (onlyZone !== null && Number(onlyZone) !== z) continue;
    const box = el('div', 'mock');
    box.appendChild(el('h3', '', `Zone ${z}: ${names[z]}`));
    const c = el('canvas');
    c.width = 1280;
    c.height = 960;
    const ctx = c.getContext('2d')!;
    const cam = 700;
    const GROUND_TOP = 580; // walkable line at 640
    for (const layer of BG_LAYERS) {
      const s = byKey.get(bgKey(z, layer));
      const y = layer === 'ground' ? GROUND_TOP : 0;
      drawTiled(ctx, s, y, cam * BG_SCROLL[layer]);
      if (layer === 'ground') {
        // fill below the ground tile
        ctx.drawImage(s ? s.canvas : c, 0, 300, 1280, 20, 0, GROUND_TOP + 320, 1280, 60);
      }
    }
    const walk = GROUND_TOP + 60;
    frame(ctx, TEX.ledge, 0, 900, walk - 170, 0.5, 0);
    frame(ctx, gemKey(z), 1, 900, walk - 170 - 6, 0.5, 1);
    frame(ctx, juniperKey(z), 0, 420, walk, 0.5, 1);
    frame(ctx, presentKey(z), 0, 640, walk, 0.5, 1);
    frame(ctx, gemKey(z + 2), 0, 760, walk, 0.5, 1);
    frame(ctx, TEX.lantern, 1, 260, walk - 160, 0.5, 0.5);
    if (z === 0) frame(ctx, TEX.sled, 1, 1120, walk, 0.5, 1);
    if (z === 1) frame(ctx, TEX.gate, 0, 1150, walk, 0.5, 1);
    if (z === 2) frame(ctx, 'friend-pip', 0, 1120, walk, 0.5, 1);
    if (z === 3) frame(ctx, 'friend-odette', 0, 1120, walk, 0.5, 1);
    if (z === 4) frame(ctx, TEX.bluster, 3, 1050, 260, 0.5, 0.5);
    // HUD bar mock
    ctx.fillStyle = 'rgba(29,26,58,0.5)';
    ctx.fillRect(0, 840, 1280, 120);
    box.appendChild(c);
    sec.appendChild(box);
  }
}

// ---------- seam check ----------
if (legacy) {
  const sec = section('seams', 'Seam check: right 160 px of each layer next to its left 160 px (centre line = seam)');
  for (let z = 0; z < 5; z++) {
    const row = el('div', 'row');
    for (const layer of BG_LAYERS) {
      const s = byKey.get(bgKey(z, layer));
      if (!s) continue;
      const h = s.canvas.height;
      const c = el('canvas');
      c.width = 320;
      c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#808088';
      ctx.fillRect(0, 0, 320, h);
      ctx.drawImage(s.canvas, 1120, 0, 160, h, 0, 0, 160, h);
      ctx.drawImage(s.canvas, 0, 0, 160, h, 160, 0, 160, h);
      c.style.width = '160px';
      c.style.height = `${h / 2}px`;
      const cell = el('div', 'cell');
      cell.appendChild(c);
      cell.appendChild(el('span', '', `${z}-${layer}`));
      row.appendChild(cell);
    }
    sec.appendChild(row);
  }
}

// ================================================================ v2 expansion art

function isV2Key(k: string): boolean {
  return /^(count-|tool-|hat-|flurry-)/.test(k) || (Object.values(TEX2) as string[]).includes(k);
}

/** Draw a sheet frame into ctx with origin (ox, oy) at (x, y), scaled k, rotated rot. */
function put(ctx: CanvasRenderingContext2D, key: string, i: number, x: number, y: number, ox = 0.5, oy = 1, k = 1, rot = 0): void {
  const s = byKey.get(key);
  if (!s) return;
  const [fx, fy, w, h] = frameRect(s, i);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.drawImage(s.canvas, fx, fy, w, h, -w * ox * k, -h * oy * k, w * k, h * k);
  ctx.restore();
}

function canvasCell(parent: HTMLElement, w: number, h: number, label: string, bg: string, draw: (ctx: CanvasRenderingContext2D) => void, cssScale = 1): void {
  const cell = el('div', 'cell');
  const c = el('canvas');
  c.width = w;
  c.height = h;
  c.style.width = `${w * cssScale}px`;
  c.style.height = `${h * cssScale}px`;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  draw(ctx);
  cell.appendChild(c);
  if (label) cell.appendChild(el('span', '', label));
  parent.appendChild(cell);
}

function row(parent: HTMLElement, title?: string): HTMLElement {
  if (title) parent.appendChild(el('h3', '', title));
  const r = el('div', 'row');
  parent.appendChild(r);
  return r;
}

/** Hat composited on a Juniper frame; hat origin (0.5,1) at juniperHatAnchor(frame). */
function juniperWithHat(ctx: CanvasRenderingContext2D, hat: number, f: number, x: number, y: number, k = 1, scarf = 0): void {
  put(ctx, juniperKey(scarf), f, x, y, 0.5, 1, k);
  const a = juniperHatAnchor(f);
  put(ctx, hatKey(hat), 0, x + a.dx * k, y + a.dy * k, 0.5, 1, k, a.rot);
}

/** Wooden mock card (an item card laid over a room background). */
function mockCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = '#1d1a3a';
  ctx.beginPath();
  ctx.roundRect(x - 6, y - 6, w + 12, h + 12, 22);
  ctx.fill();
  ctx.fillStyle = '#8a5530';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fill();
  ctx.fillStyle = '#c58a4a';
  ctx.fillRect(x + 14, y + 8, w - 28, 6);
}

/** ?v2=count|tools|hats|flurries|items|rooms|areas shows one group only (lighter page for screenshots). */
const want = (g: string) => !params.get('v2') || params.get('v2') === g;
if (full) {
  // ---------------- count icons
  if (want('count')) {
    const sec = section('v2-count', 'v2: count icons (64x64) - 1:1 on grey and snow, then at 40 px, then in a mock problem');
    for (const bg of ['#808088', '#e6eeff']) {
      const r = row(sec);
      for (const n of COUNT_ICONS) canvasCell(r, 64, 64, n, bg, (ctx) => put(ctx, countIconKey(n), 0, 0, 0, 0, 0));
    }
    const r40 = row(sec, 'At 40 px (the size they appear in problems)');
    for (const n of COUNT_ICONS) canvasCell(r40, 40, 40, n, '#e6eeff', (ctx) => put(ctx, countIconKey(n), 0, 0, 0, 0, 0, 40 / 64));
    const r28 = row(sec, 'At 28 px (stress test)');
    for (const n of COUNT_ICONS) canvasCell(r28, 28, 28, '', '#e6eeff', (ctx) => put(ctx, countIconKey(n), 0, 0, 0, 0, 0, 28 / 64));
    const rz = row(sec, 'Zoomed 3x');
    for (const n of COUNT_ICONS.slice(0, 10)) canvasCell(rz, 192, 192, n, '#e6eeff', (ctx) => put(ctx, countIconKey(n), 0, 0, 0, 0, 0, 3));
    const rz2 = row(sec);
    for (const n of COUNT_ICONS.slice(10)) canvasCell(rz2, 192, 192, n, '#e6eeff', (ctx) => put(ctx, countIconKey(n), 0, 0, 0, 0, 0, 3));
    const rm = row(sec, 'Mock problem panels (half of game size)');
    const pairs: [CountIcon, number, CountIcon, number][] = [['carrot', 4, 'mitten', 3], ['fish', 5, 'acorn', 2], ['cocoa', 3, 'cookie', 4], ['bell', 2, 'candle', 3], ['pinecone', 3, 'feather', 3]];
    for (const [a, na, b, nb] of pairs) {
      canvasCell(rm, 520, 220, `${na} ${a} + ${nb} ${b}`, '#8a5530', (ctx) => {
        ctx.fillStyle = '#e6eeff';
        ctx.fillRect(10, 10, 500, 200);
        for (let i = 0; i < na; i++) put(ctx, countIconKey(a), 0, 30 + i * 60, 60, 0, 0, 56 / 64);
        for (let i = 0; i < nb; i++) put(ctx, countIconKey(b), 0, 30 + i * 60, 136, 0, 0, 56 / 64);
      }, 0.75);
    }
  }

  // ---------------- tools
  if (want('tools')) {
    const sec = section('v2-tools', 'v2: store tools (128x128) - 1:1 on grey and snow, then at 80 px');
    for (const bg of ['#808088', '#e6eeff']) {
      const r = row(sec);
      for (const id of TOOL_IDS) canvasCell(r, 128, 128, id, bg, (ctx) => put(ctx, toolKey(id), 0, 0, 0, 0, 0));
    }
    const r80 = row(sec, 'At 80 px on a wood card');
    for (const id of TOOL_IDS) canvasCell(r80, 96, 96, id, '#8a5530', (ctx) => put(ctx, toolKey(id), 0, 8, 8, 0, 0, 80 / 128));
  }

  // ---------------- hats
  if (want('hats')) {
    const sec = section('v2-hats', 'v2: hats (96x96, origin = centre of Juniper\'s skull) and on Juniper');
    const r = row(sec, 'Hats alone (1:1, grey / snow)');
    for (const bg of ['#808088', '#e6eeff']) for (let i = 0; i < HAT_COUNT; i++) canvasCell(r, 96, 96, String(i), bg, (ctx) => put(ctx, hatKey(i), 0, 0, 0, 0, 0));
    const r1 = row(sec, 'On Juniper idle frame 0, 1:1 (game size)');
    for (let i = 0; i < HAT_COUNT; i++) canvasCell(r1, 200, 200, `hat ${i}`, '#e6eeff', (ctx) => juniperWithHat(ctx, i, 0, 100, 200, 1, i));
    const r2 = row(sec, 'Zoomed 2x: idle');
    for (let i = 0; i < HAT_COUNT; i++) canvasCell(r2, 300, 260, `hat ${i}`, '#e6eeff', (ctx) => juniperWithHat(ctx, i, 0, 100, 400, 2, i));
    const r3 = row(sec, 'Anchor follows the pose: walk 6, crouch 10, rise 11, apex 12, cheer peak 17 (hat 0 and 2)');
    for (const h of [0, 2]) for (const f of [6, 10, 11, 12, 17]) canvasCell(r3, 200, 200, `h${h} f${f}`, '#e6eeff', (ctx) => juniperWithHat(ctx, h, f, 100, 200));
    const r4 = row(sec, 'Live: idle animation with each hat');
    const idle = [0, 1, 2, 1, 0, 1, 2, 1, 0, 3, 2, 1];
    for (let i = 0; i < HAT_COUNT; i++) {
      const cell = el('div', 'cell');
      const c = el('canvas');
      c.width = 200;
      c.height = 200;
      cell.appendChild(c);
      cell.appendChild(el('span', '', `hat ${i}`));
      r4.appendChild(cell);
      const ctx = c.getContext('2d')!;
      let n = 0;
      const step = () => {
        ctx.fillStyle = '#e6eeff';
        ctx.fillRect(0, 0, 200, 200);
        juniperWithHat(ctx, i, idle[n % idle.length], 100, 200, 1, i);
        n++;
      };
      step();
      setInterval(step, 320);
    }
  }

  // ---------------- flurries
  if (want('flurries')) {
    const sec = section('v2-flurries', 'v2: Flurries (4 frames 96x96: wander a, wander b, startled, happy)');
    for (let k = 0; k < FLURRY_KINDS; k++) {
      const r = row(sec, `${k} ${FLURRY_NAMES[k]} (camp ${Math.floor(k / 2) + 1})`);
      for (const bg of ['#e6eeff', '#808088']) for (let f = 0; f < 4; f++) canvasCell(r, 96, 96, String(f), bg, (ctx) => put(ctx, flurryKey(k), f, 0, 0, 0, 0));
      for (let f = 0; f < 4; f++) canvasCell(r, 192, 192, `${f} (2x)`, '#e6eeff', (ctx) => put(ctx, flurryKey(k), f, 0, 0, 0, 0, 2));
    }
    const ra = row(sec, 'Album at small size (64 px cells) - found, then silhouettes for undiscovered slots');
    canvasCell(ra, 10 * 72 + 8, 2 * 84 + 8, 'album', '#5a3320', (ctx) => {
      for (let k = 0; k < FLURRY_KINDS; k++) {
        const x = 8 + k * 72;
        ctx.fillStyle = '#eec07a';
        ctx.fillRect(x, 8, 64, 76);
        put(ctx, flurryKey(k), 0, x + 32, 8 + 72, 0.5, 1, 64 / 96);
        ctx.fillStyle = '#c58a4a';
        ctx.fillRect(x, 92, 64, 76);
        ctx.drawImage(flurrySilhouette(k), x, 92 + 4, 64, 64);
      }
    });
    const rw = row(sec, 'Live: wander bob (and a startle every few seconds), 1:1 on a snow strip');
    for (let k = 0; k < FLURRY_KINDS; k++) {
      addPlayer(rw, { key: `w${k}`, texture: flurryKey(k), frames: [0, 1, 0, 1, 0, 1, 2, 2, 0, 1, 3, 3], frameRate: 3, repeat: -1 }, '#e6eeff', 1, FLURRY_NAMES[k]);
    }
  }

  // ---------------- small items, doors, stall
  if (want('items')) {
    const sec = section('v2-items', 'v2: loose gem, doorways, Marlow\'s stall, badges, purse, bell ring');
    const ra = row(sec, 'Animations (1:1)');
    for (const a of bundle.anims) if (a.key === ANIM2.looseGemTwinkle || a.key === ANIM2.bellRing) addPlayer(ra, a, '#808088', 1, a.key);
    for (const a of bundle.anims) if (a.key === ANIM2.looseGemTwinkle) addPlayer(ra, a, '#e6eeff', 1, a.key);
    for (const key of [TEX2.looseGem, TEX2.bellRing, TEX2.doorOpen, TEX2.doorIce, TEX2.doorDark, TEX2.doorHigh, TEX2.stall, TEX2.lockBadge, TEX2.starGold, TEX2.purse]) {
      const s = byKey.get(key);
      if (s) showSheet(sec, s, 320);
    }
  }

  // ---------------- rooms
  if (want('rooms')) {
    const sec = section('v2-rooms', 'v2: trading post, Flurry Lodge, darkness overlay (mock screens at 1/2 size)');
    const box = el('div', 'row mock');
    sec.appendChild(box);
    const mk = (label: string, draw: (ctx: CanvasRenderingContext2D) => void) => {
      const cell = el('div', 'cell');
      const c = el('canvas');
      c.width = 1280;
      c.height = 960;
      draw(c.getContext('2d')!);
      cell.appendChild(c);
      cell.appendChild(el('span', '', label));
      box.appendChild(cell);
    };
    mk('shop-bg (bare)', (ctx) => put(ctx, TEX2.shopBg, 0, 0, 0, 0, 0));
    mk('shop-bg with item cards', (ctx) => {
      put(ctx, TEX2.shopBg, 0, 0, 0, 0, 0);
      TOOL_IDS.slice(0, 6).forEach((id, i) => {
        const x = 300 + (i % 3) * 240;
        const y = 150 + Math.floor(i / 3) * 290;
        mockCard(ctx, x, y, 200, 250);
        put(ctx, toolKey(id), 0, x + 100, y + 160, 0.5, 1);
      });
      put(ctx, 'friend-marlow', 0, 1120, 800, 0.5, 1, 1.2);
    });
    mk('lodge-bg (bare, shelves from LODGE_SHELVES)', (ctx) => {
      put(ctx, TEX2.lodgeBg, 0, 0, 0, 0, 0);
      ctx.strokeStyle = 'rgba(255,201,60,0.8)';
      ctx.lineWidth = 2;
      for (const s of LODGE_SHELVES) ctx.strokeRect(s.x0, s.y - 2, s.x1 - s.x0, 2);
    });
    mk('lodge-bg with trophies + album', (ctx) => {
      put(ctx, TEX2.lodgeBg, 0, 0, 0, 0, 0);
      LODGE_SHELVES.forEach((s, i) => {
        for (let k = 0; k < 3; k++) {
          const x = s.x0 + 50 + k * 95;
          if (i < 3) put(ctx, flurryKey(i * 3 + k), 3, x, s.y + 4, 0.5, 1);
          else if (i === 3) put(ctx, gemKey(k), 0, x, s.y + 4, 0.5, 1);
          else if (i === 4) put(ctx, TEX2.starGold, 0, x, s.y + 2, 0.5, 1);
          else put(ctx, hatKey(k), 0, x, s.y + 20, 0.5, 1);
        }
      });
      mockCard(ctx, 400, 200, 480, 500);
    });
    mk('darkness over the Glimmer Caves trail', (ctx) => {
      for (const layer of BG_LAYERS) {
        const s = byKey.get(bgKey(2, layer));
        if (s) ctx.drawImage(s.canvas, 0, layer === 'ground' ? 580 : 0);
      }
      put(ctx, juniperKey(0), 0, 640, 640, 0.5, 1);
      put(ctx, TEX2.darkness, 0, 0, 0, 0, 0);
    });
  }

  // ---------------- side areas
  if (want('areas')) {
    const sec = section('v2-areas', 'v2: side areas - 5 layers composited (camera scrolled 700 px so seams are in view), then seam strips');
    const only = params.get('area'); // e.g. ?area=2-1
    for (let z = 0; z < 5; z++) {
      for (const a of [1, 2]) {
        if (only && only !== `${z}-${a}`) continue;
        const t0a = performance.now();
        const layers = BG_LAYERS.map((l) => buildAreaLayer(z, a, l));
        const ms = performance.now() - t0a;
        const box = el('div', 'mock');
        box.appendChild(el('h3', '', `Camp ${z + 1}, area ${a}: ${AREA_NAMES[z][a - 1]}  (painted in ${ms.toFixed(0)} ms)`));
        const c = el('canvas');
        c.width = 1280;
        c.height = 960;
        const ctx = c.getContext('2d')!;
        const cam = 700;
        const GROUND_TOP = 580;
        layers.forEach((s, li) => {
          const layer = BG_LAYERS[li];
          drawTiled(ctx, s, layer === 'ground' ? GROUND_TOP : 0, cam * BG_SCROLL[layer]);
          if (layer === 'ground') ctx.drawImage(s.canvas, 0, 300, 1280, 20, 0, GROUND_TOP + 320, 1280, 60);
        });
        const walk = GROUND_TOP + 60;
        const doors = [TEX2.doorOpen, TEX2.doorHigh, TEX2.doorIce, TEX2.doorDark];
        put(ctx, doors[(z + a) % 4], 0, 180, walk, 0.5, 1);
        juniperWithHat(ctx, (z * 2 + a) % HAT_COUNT, 0, 460, walk, 1, z);
        put(ctx, flurryKey(z * 2 + (a - 1)), 0, 760, walk, 0.5, 1);
        put(ctx, presentKey(z + a), 0, 960, walk, 0.5, 1);
        for (let i = 0; i < 3; i++) put(ctx, TEX2.looseGem, i, 1100 + i * 50, walk, 0.5, 1);
        frame(ctx, TEX.ledge, 0, 1000, walk - 190, 0.5, 0);
        put(ctx, gemKey(z), 1, 1000, walk - 190 - 6, 0.5, 1);
        ctx.fillStyle = 'rgba(29,26,58,0.5)';
        ctx.fillRect(0, 840, 1280, 120);
        box.appendChild(c);
        // seam strips: right 120 px next to left 120 px of every layer
        const sr = el('div', 'row');
        layers.forEach((s, li) => {
          const h = s.canvas.height;
          const sc = el('canvas');
          sc.width = 240;
          sc.height = h;
          const sctx = sc.getContext('2d')!;
          sctx.fillStyle = '#808088';
          sctx.fillRect(0, 0, 240, h);
          sctx.drawImage(s.canvas, 1160, 0, 120, h, 0, 0, 120, h);
          sctx.drawImage(s.canvas, 0, 0, 120, h, 120, 0, 120, h);
          sc.style.width = '120px';
          sc.style.height = `${h / 2}px`;
          const cell = el('div', 'cell');
          cell.appendChild(sc);
          cell.appendChild(el('span', '', BG_LAYERS[li]));
          sr.appendChild(cell);
        });
        box.appendChild(sr);
        sec.appendChild(box);
      }
    }
  }
}

// ================================================================ v3: playable heroes
// ?v3=heroes (all), ?v3=heroes&hero=pip (one hero), &k=1.5 (strip zoom)
if (v3 === 'heroes') {
  document.querySelector('nav')?.remove();
  const onlyHero = params.get('hero') as HeroId | null;
  const zoom = Number(params.get('k') ?? '1');
  const others = HERO_IDS.filter((h) => h !== 'juniper') as Exclude<HeroId, 'juniper'>[];
  // scarf-0 sheets for the preview (the game builds one hero x one scarf on demand)
  const tH = performance.now();
  for (const h of others) {
    const s = buildHeroSheet(h, 0);
    byKey.set(s.key, s);
  }
  const heroMs = (performance.now() - tH) / others.length;
  stats.textContent += `\nv3 hero sheet build: ~${heroMs.toFixed(0)} ms per hero sheet (19 frames, 2000x400)`;

  const FR = ['idle0', 'idle1', 'idle2', 'blink', 'walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'crouch', 'rise', 'apex', 'fall', 'land', 'cheer0', 'cheer1', 'peak', 'cheer3'];

  const heroWithHat = (ctx: CanvasRenderingContext2D, hero: HeroId, hat: number, f: number, x: number, y: number, flip: boolean, k = 1): void => {
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    put(ctx, heroKey(hero, 0), f, 0, 0, 0.5, 1, k);
    if (hat >= 0) {
      const a = heroHatAnchor(hero, f);
      put(ctx, hatKey(hat), 0, a.dx * k, a.dy * k, 0.5, 1, k * a.scale, a.rot);
    }
    ctx.restore();
  };

  // line-up next to Juniper
  if (!onlyHero) {
    const sec = section('v3-lineup', 'v3: line-up on a ground line, 1:1 game size (guide lines at 150 px and 165 px above the feet)');
    const r = row(sec);
    canvasCell(r, 1100, 260, 'Juniper, Pip, Marlow, Odette, Bluster (idle frame 0)', '#e6eeff', (ctx) => {
      ctx.fillStyle = '#c9d6f5';
      ctx.fillRect(0, 230, 1100, 30);
      ctx.strokeStyle = 'rgba(216,58,154,0.6)';
      ctx.setLineDash([6, 6]);
      for (const hgt of [150, 165]) {
        ctx.beginPath();
        ctx.moveTo(0, 230 - hgt);
        ctx.lineTo(1100, 230 - hgt);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      HERO_IDS.forEach((h, i) => put(ctx, heroKey(h, 0), 0, 110 + i * 210, 230, 0.5, 1));
    });
    const r3 = row(sec, 'Walk + idle, live, side by side');
    for (const h of HERO_IDS) {
      const spec = h === 'juniper'
        ? bundle.anims.find((a) => a.key === heroAnim(ANIM.walk, 'juniper', 0))
        : heroAnimSpecs(h, 0).find((a) => a.key === heroAnim(ANIM.walk, h, 0));
      if (spec) addPlayer(r3, spec, '#e6eeff', 1, HERO_NAMES[h]);
    }
    for (const h of HERO_IDS) {
      const spec = h === 'juniper'
        ? bundle.anims.find((a) => a.key === heroAnim(ANIM.idle, 'juniper', 0))
        : heroAnimSpecs(h, 0).find((a) => a.key === heroAnim(ANIM.idle, h, 0));
      if (spec) addPlayer(r3, spec, '#e6eeff', 1, HERO_NAMES[h] + ' idle');
    }
    const rp = row(sec, 'Portraits heroPortraitKey(hero), 160x160, on a wood card and on grey');
    for (const h of HERO_IDS) canvasCell(rp, 176, 176, HERO_NAMES[h], '#8a5530', (ctx) => put(ctx, heroPortraitKey(h), 0, 8, 8, 0, 0));
    for (const h of HERO_IDS) canvasCell(rp, 160, 160, '', '#808088', (ctx) => put(ctx, heroPortraitKey(h), 0, 0, 0, 0, 0));
  }

  for (const h of others) {
    if (onlyHero && onlyHero !== h) continue;
    const sec = section(`v3-${h}`, `v3: ${HERO_NAMES[h]} - heroKey('${h}', 0)`);
    const strip = row(sec, 'All 19 frames (snow, 1:1 unless &k=) - feet line marked');
    for (let f = 0; f < 19; f++) {
      canvasCell(strip, 200 * zoom, 200 * zoom, `${f} ${FR[f]}`, '#e6eeff', (ctx) => {
        put(ctx, heroKey(h, 0), f, 0, 0, 0, 0, zoom);
        ctx.fillStyle = 'rgba(29,26,58,0.3)';
        ctx.fillRect(0, 200 * zoom - 1, 200 * zoom, 1);
        ctx.fillRect(100 * zoom, 0, 1, 200 * zoom);
      });
    }
    const ra = row(sec, 'Animations heroAnim(base, hero, 0), live');
    for (const a of heroAnimSpecs(h, 0)) addPlayer(ra, a, '#e6eeff', 1, a.key);
    const rc = row(sec, 'Accent colours 0-5 (idle frame 0 and walk frame 6)');
    SCARF_COLOURS.forEach((col, s) => {
      for (const f of [0, 6]) canvasCell(rc, 200, 200, `accent ${s} f${f}`, '#e6eeff', (ctx) => drawHero(ctx, h, f, hex(col)), 0.6);
    });
    for (let hat = 0; hat < HAT_COUNT; hat++) {
      const rh = row(sec, `Hat ${hat}: idle 0, walk 4/6/8, apex 12, cheer peak 17 - facing right, then flipped`);
      for (const flip of [false, true]) {
        for (const f of [0, 4, 6, 8, 12, 17]) {
          canvasCell(rh, 200, 200, `${flip ? 'L' : 'R'} f${f}`, '#e6eeff', (ctx) => heroWithHat(ctx, h, hat, f, 100, 200, flip), 0.7);
        }
      }
    }
    const rz = row(sec, 'Zoom 2x: idle, walk 6, apex, cheer peak with hat 0 and 2');
    for (const [hat, f] of [[0, 0], [2, 6], [0, 12], [2, 17]]) canvasCell(rz, 400, 400, `hat ${hat} f${f}`, '#e6eeff', (ctx) => heroWithHat(ctx, h, hat, f, 200, 400, false, 2));
    const rl = row(sec, 'Live: walk with each hat');
    for (let hat = 0; hat < HAT_COUNT; hat++) {
      const cell = el('div', 'cell');
      const c = el('canvas');
      c.width = 200;
      c.height = 200;
      cell.appendChild(c);
      cell.appendChild(el('span', '', `hat ${hat}`));
      rl.appendChild(cell);
      const ctx = c.getContext('2d')!;
      let n = 0;
      setInterval(() => {
        ctx.fillStyle = '#e6eeff';
        ctx.fillRect(0, 0, 200, 200);
        heroWithHat(ctx, h, hat, 4 + (n++ % 6), 100, 200, hat % 2 === 1);
      }, 100);
    }
  }

  // Phaser check for the on-demand hero API
  const sec = section('v3-phaser', 'v3 Phaser check: ensureHeroArt / hasHeroArt / releaseHeroArt in a real scene');
  const host = el('div');
  sec.appendChild(host);
  const out = el('div', '', 'booting Phaser...');
  out.id = 'v3-phaser-out';
  sec.appendChild(out);
  void (async () => {
    try {
      const Phaser = (await import('phaser')).default;
      const { registerArt, ensureHeroArt, releaseHeroArt, hasHeroArt, HERO_ANIM_BASES } = await import('./index');
      class HeroCheck extends Phaser.Scene {
        create(): void {
          registerArt(this);
          const lines: string[] = [];
          const portraits = HERO_IDS.filter((h) => this.textures.exists(heroPortraitKey(h)));
          lines.push(`portraits at boot: ${portraits.length}/5`);
          const bootHero = HERO_IDS.filter((h) => h !== 'juniper' && this.textures.exists(heroKey(h, 0)));
          lines.push(`non-Juniper sheets after registerArt: ${bootHero.length} (expected 0)`);
          lines.push(`juniper hasHeroArt(all 6 scarves): ${[0, 1, 2, 3, 4, 5].every((s) => { ensureHeroArt(this, 'juniper', s); return hasHeroArt(this, 'juniper', s); })}`);
          for (const h of others) {
            const t0h = performance.now();
            ensureHeroArt(this, h, 3);
            const t1h = performance.now();
            ensureHeroArt(this, h, 3); // no-op
            const t2h = performance.now();
            const tex = this.textures.get(heroKey(h, 3));
            const frames = tex.getFrameNames().map(Number).sort((a, b) => a - b);
            const numbered = frames.length === 19 && frames.every((f, i) => f === i);
            const anims = HERO_ANIM_BASES.filter((b) => this.anims.exists(heroAnim(b, h, 3)));
            const fr = this.textures.getFrame(heroKey(h, 3), 18);
            lines.push(`${h}: ensure ${(t1h - t0h).toFixed(0)} ms, 2nd ${(t2h - t1h).toFixed(2)} ms; frames ${frames.length} numbered 0..18: ${numbered}; frame 18 ${fr.width}x${fr.height}; anims ${anims.length}/6; has ${hasHeroArt(this, h, 3)}`);
          }
          releaseHeroArt(this, 'odette', 3);
          const left = others.flatMap((h) => [0, 1, 2, 3, 4, 5].filter((s) => this.textures.exists(heroKey(h, s))).map((s) => `${h}-${s}`));
          const leftAnims = this.anims.toJSON().anims.map((a) => a.key).filter((k) => /-(pip|marlow|odette|bluster)-\d$/.test(k));
          lines.push(`after releaseHeroArt('odette', 3): sheets [${left}], hero anims ${leftAnims.length} (expected 6), juniper sheets intact: ${[0, 1, 2, 3, 4, 5].every((s) => this.textures.exists(heroKey('juniper', s)))}`);
          releaseHeroArt(this, 'juniper', 0);
          lines.push(`after releaseHeroArt('juniper', 0): non-Juniper sheets ${others.filter((h) => this.textures.exists(heroKey(h, 3))).length}`);
          // show one sprite of each, playing walk
          HERO_IDS.forEach((h, i) => {
            ensureHeroArt(this, h, i);
            this.add.sprite(70 + i * 125, 200, heroKey(h, i)).setOrigin(0.5, 1).setScale(0.8).play(heroAnim(ANIM.walk, h, i));
            this.add.image(70 + i * 125, 290, heroPortraitKey(h)).setScale(0.5);
          });
          out.textContent = lines.join('\n');
          out.style.whiteSpace = 'pre';
        }
      }
      new Phaser.Game({ type: Phaser.AUTO, parent: host, width: 660, height: 340, backgroundColor: '#e6eeff', scene: HeroCheck });
    } catch (e) {
      out.textContent = 'v3 Phaser check failed: ' + String(e);
      console.error(e);
    }
  })();
}

// ================================================================ v4: platforming pieces
// ?v4=platforms (all), &zone=2 (one camp's backdrop sections only), &part=pieces|anims|tiles|scenes|tools|phaser
if (v4 === 'platforms') {
  document.querySelector('nav')?.remove();
  const onlyZone = params.get('zone');
  const part = params.get('part');
  const wantPart = (p: string) => !part || part === p;
  const ZONES4 = [0, 1, 2, 3, 4].filter((z) => onlyZone === null || Number(onlyZone) === z);
  const CAMP = ['Camp 1 Lantern Meadow', 'Camp 2 Frostpine Forest', 'Camp 3 Glimmer Caves', 'Camp 4 Clocktower Ridge (dusk)', 'Camp 5 The Summit (night)'];
  const GROUND_TOP = 580;
  const WALK = GROUND_TOP + 60;

  /** Composited zone backdrop 1280x960 (camera at `cam`); `gap` = [x0, x1] hole in the ground. */
  const backdrop = (z: number, cam = 300, gap?: [number, number]): HTMLCanvasElement => {
    const c = el('canvas');
    c.width = 1280;
    c.height = 960;
    const ctx = c.getContext('2d')!;
    for (const layer of BG_LAYERS) {
      const s = byKey.get(bgKey(z, layer));
      if (!s) continue;
      if (layer === 'ground') {
        ctx.save();
        if (gap) {
          ctx.beginPath();
          ctx.rect(0, 0, gap[0], 960);
          ctx.rect(gap[1], 0, 1280 - gap[1], 960);
          ctx.clip();
        }
        drawTiled(ctx, s, GROUND_TOP, cam);
        ctx.drawImage(s.canvas, 0, 300, 1280, 20, 0, GROUND_TOP + 320, 1280, 60);
        ctx.restore();
      } else drawTiled(ctx, s, 0, cam * BG_SCROLL[layer]);
    }
    return c;
  };

  type Piece = { key: string; f: number; top?: boolean };
  const T4 = TEX4;
  const pieces: Piece[] = [
    { key: T4.platCloud, f: 0, top: true }, { key: T4.platCloud, f: 1, top: true }, { key: T4.platLog, f: 0, top: true },
    { key: T4.platCrumble, f: 0, top: true }, { key: T4.platCrumble, f: 1, top: true }, { key: T4.platCrumble, f: 2 }, { key: T4.platCrumble, f: 3 },
    { key: T4.platBrass, f: 0, top: true }, { key: T4.platBrass, f: 1, top: true },
    { key: T4.platAurora, f: 0, top: true }, { key: T4.platAurora, f: 1, top: true }, { key: T4.platAurora, f: 2, top: true }, { key: T4.platAurora, f: 3, top: true },
    { key: T4.iceStrip, f: 0, top: true }, { key: T4.rockBlock, f: 0, top: true }, { key: T4.rockBody, f: 0 },
    { key: T4.bouncePad, f: 0 }, { key: T4.bouncePad, f: 1 }, { key: T4.bouncePad, f: 2 },
    { key: T4.helperCloud, f: 0 }, { key: T4.helperCloud, f: 1 },
    { key: T4.checkpoint, f: 0 }, { key: T4.checkpoint, f: 1 },
    { key: T4.arrowSign, f: 0 }, { key: T4.arrowSign, f: 1 }, { key: T4.arrowSign, f: 2 },
    { key: T4.gear, f: 0 }, { key: T4.pendulumRod, f: 0 }, { key: T4.pitMist, f: 0 }, { key: T4.windStreak, f: 0 },
  ];

  /** Flow-lay pieces at scale k; draw=false just measures. Returns the used height. */
  const flow = (ctx: CanvasRenderingContext2D | null, k: number, W: number, list: Piece[] = pieces): number => {
    let x = 16;
    let y = 24;
    let rowH = 0;
    for (const p of list) {
      const s = byKey.get(p.key);
      if (!s) continue;
      const [, , w, h] = frameRect(s, p.f);
      const pw = w * k;
      const ph = h * k;
      if (x + pw > W - 16) {
        x = 16;
        y += rowH + 30;
        rowH = 0;
      }
      if (ctx) {
        put(ctx, p.key, p.f, x, y, 0, 0, k);
        if (p.top) {
          // cyan ticks either side mark y = 0 of the texture (the walkable surface)
          ctx.fillStyle = '#00e5ff';
          ctx.fillRect(x - 10, y, 7, 2);
          ctx.fillRect(x + pw + 3, y, 7, 2);
        }
        ctx.font = '600 13px Verdana, sans-serif';
        const label = `${p.key}${(s.frames ?? 1) > 1 ? ` #${p.f}` : ''}`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(29,26,58,0.75)';
        ctx.fillRect(x, y + ph + 3, tw + 8, 17);
        ctx.fillStyle = '#fff8ea';
        ctx.fillText(label, x + 4, y + ph + 16);
      }
      x += pw + 24;
      rowH = Math.max(rowH, ph + 20);
    }
    return y + rowH + 16;
  };

  const piecesOn = (parent: HTMLElement, z: number, k: number): void => {
    const bd = backdrop(z, 300 + k * 200);
    // big canvases stall the browser, so 2x is split into several smaller ones
    const groups: Piece[][] = [];
    if (k === 1) groups.push(pieces);
    else {
      const cuts = [0, 3, 7, 13, 16, 21, 26, 28, pieces.length];
      for (let i = 0; i + 1 < cuts.length; i++) groups.push(pieces.slice(cuts[i], cuts[i + 1]));
    }
    groups.forEach((list, gi) => {
      const H = flow(null, k, 1280, list);
      const c = el('canvas');
      c.width = 1280;
      c.height = H;
      const ctx = c.getContext('2d')!;
      // vary which part of the backdrop sits behind each group (sky, hills, ground)
      const oy = Math.max(0, Math.min(960 - H, (gi * 260) % 700));
      for (let y = -oy; y < H; y += 960) ctx.drawImage(bd, 0, y);
      flow(ctx, k, 1280, list);
      parent.appendChild(c);
    });
  };

  if (wantPart('pieces')) {
    for (const z of ZONES4) {
      const sec = section(`v4-pieces-${z}`, `v4: every TEX4 frame on ${CAMP[z]} - 1:1 (cyan ticks = top row = walkable surface)`);
      piecesOn(sec, z, 1);
      sec.appendChild(el('h3', '', `${CAMP[z]} - 2x`));
      piecesOn(sec, z, 2);
    }
  }

  // ---------------- animations
  if (wantPart('anims')) {
    const sec = section('v4-anims', 'v4: ANIM4 animations (and the game-timed toggles) live, on night, dusk and snow');
    for (const bg of ['#2b2360', '#6a3d8f', '#e6eeff']) {
      const r = row(sec);
      for (const a of bundle.anims) if ((Object.values(ANIM4) as string[]).includes(a.key)) addPlayer(r, a, bg, 1, a.key);
      addPlayer(r, { key: 'helper-blink', texture: T4.helperCloud, frames: [0, 0, 0, 0, 0, 1], frameRate: 4, repeat: -1 }, bg, 1, 'helper cloud blink');
      addPlayer(r, { key: 'tick-tock', texture: T4.platBrass, frames: [0, 0, 0, 1, 1, 1], frameRate: 3, repeat: -1 }, bg, 1, 'tick-tock solid/ghost');
      addPlayer(r, { key: 'checkpoint-light', texture: T4.checkpoint, frames: [0, 0, 1, 1, 1, 1], frameRate: 2, repeat: -1 }, bg, 1, 'checkpoint');
      addPlayer(r, { key: 'arrows', texture: T4.arrowSign, frames: [0, 1, 2], frameRate: 1, repeat: -1 }, bg, 1, 'arrow sign frames');
    }
    // rotating gear + swinging pendulum, the way the game will use them
    const r2 = row(sec, 'Gear rotating (origin 0.5,0.5) and pendulum swinging (origin 0.5,0.03) with a brass platform on it');
    const c = el('canvas');
    c.width = 760;
    c.height = 560;
    r2.appendChild(c);
    const ctx = c.getContext('2d')!;
    const bd = backdrop(3, 900);
    const t0g = performance.now();
    const spin = () => {
      const t = (performance.now() - t0g) / 1000;
      ctx.drawImage(bd, 260, 200, 760, 560, 0, 0, 760, 560);
      put(ctx, T4.gear, 0, 180, 300, 0.5, 0.5, 1, t * 0.6);
      put(ctx, T4.gear, 0, 330, 160, 0.5, 0.5, 0.6, -t * 1.0 + 0.13);
      const ang = Math.sin(t * 1.8) * 0.5;
      put(ctx, T4.pendulumRod, 0, 560, 30, 0.5, 0.03, 1, ang);
      const ex = 560 - Math.sin(ang) * (420 * 0.97 - 12);
      const ey = 30 + Math.cos(ang) * (420 * 0.97 - 12);
      put(ctx, T4.platBrass, 0, ex, ey, 0.5, 0);
      put(ctx, juniperKey(3), 0, ex, ey, 0.5, 1, 0.8);
      requestAnimationFrame(spin);
    };
    requestAnimationFrame(spin);
  }

  // ---------------- tiling
  if (wantPart('tiles')) {
    const sec = section('v4-tiles', 'v4: tiling tests');
    const bgs: [string, (ctx: CanvasRenderingContext2D, w: number, h: number) => void][] = [
      ['grey', (ctx, w, h) => { ctx.fillStyle = '#808088'; ctx.fillRect(0, 0, w, h); }],
      ['caves', (ctx, w, h) => ctx.drawImage(backdrop(2), 200, 960 - h, w, h, 0, 0, w, h)],
    ];
    for (const [name, paint] of bgs) {
      const r = row(sec, `5 ice strips in a row (1200x40) on ${name}, then 3x around the seams at x = 240 and 480`);
      canvasCell(r, 1240, 80, '', '', (ctx) => {
        paint(ctx, 1240, 80);
        for (let i = 0; i < 5; i++) put(ctx, T4.iceStrip, 0, 20 + i * 240, 20, 0, 0);
      });
      const rz = row(sec);
      for (const sx of [240, 480]) {
        canvasCell(rz, 360, 120, `seam x=${sx} (3x)`, '#808088', (ctx) => {
          const tmp = el('canvas');
          tmp.width = 1200;
          tmp.height = 40;
          const t = tmp.getContext('2d')!;
          for (let i = 0; i < 5; i++) put(t, T4.iceStrip, 0, i * 240, 0, 0, 0);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(tmp, sx - 60, 0, 120, 40, 0, 0, 360, 120);
        });
      }
    }
    for (const [name, paint] of bgs) {
      const r = row(sec, `Rock wall on ${name}: one row of rock-block on 3 rows of rock-body (4 wide), then 3x zoom on the joins`);
      const wall = el('canvas');
      wall.width = 640;
      wall.height = 640;
      const wctx = wall.getContext('2d')!;
      for (let i = 0; i < 4; i++) {
        put(wctx, T4.rockBlock, 0, i * 160, 0, 0, 0);
        for (let j = 1; j < 4; j++) put(wctx, T4.rockBody, 0, i * 160, j * 160, 0, 0);
      }
      canvasCell(r, 720, 700, '', '', (ctx) => {
        paint(ctx, 720, 700);
        ctx.drawImage(wall, 40, 40);
      });
      canvasCell(r, 360, 360, 'block/body corner join (160,160) at 3x', '#808088', (ctx) => {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(wall, 100, 100, 120, 120, 0, 0, 360, 360);
      });
      canvasCell(r, 360, 360, 'body/body corner join (320,320) at 3x', '#808088', (ctx) => {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(wall, 260, 260, 120, 120, 0, 0, 360, 360);
      });
      canvasCell(r, 360, 120, 'snow cap seam x=320 at 3x', '#808088', (ctx) => {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(wall, 260, 0, 120, 40, 0, 0, 360, 120);
      });
    }
    for (const z of [1, 4]) {
      const r = row(sec, `4 pit-mist bands (1280x140) filling a gap over ${CAMP[z]}`);
      canvasCell(r, 1280, 400, '', '', (ctx) => {
        ctx.drawImage(backdrop(z, 300, [0, 1280]), 0, 560, 1280, 400, 0, 0, 1280, 400);
        for (let i = 0; i < 4; i++) put(ctx, T4.pitMist, 0, i * 320, 260, 0, 0);
      });
    }
  }

  // ---------------- mock platforming scenes
  if (wantPart('scenes')) {
    const sec = section('v4-scenes', 'v4: mock platforming scene per camp (1280x960 shown at half size; Juniper is game size)');
    const mk = (z: number, gap: [number, number] | undefined, build: (ctx: CanvasRenderingContext2D) => void) => {
      if (onlyZone !== null && Number(onlyZone) !== z) return;
      const box = el('div', 'mock');
      box.appendChild(el('h3', '', CAMP[z]));
      const c = el('canvas');
      c.width = 1280;
      c.height = 960;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(backdrop(z, 500, gap), 0, 0);
      if (gap) {
        // a plain dark pit (the game draws its own); the pit-mist band fills its bottom
        const g = ctx.createLinearGradient(0, WALK - 20, 0, 960);
        g.addColorStop(0, 'rgba(29,26,58,0)');
        g.addColorStop(0.25, 'rgba(29,26,58,0.85)');
        g.addColorStop(1, 'rgba(29,26,58,0.95)');
        ctx.fillStyle = g;
        ctx.fillRect(gap[0], WALK - 20, gap[1] - gap[0], 960);
      }
      build(ctx);
      ctx.fillStyle = 'rgba(29,26,58,0.5)';
      ctx.fillRect(0, 840, 1280, 120);
      if (params.has('full')) c.style.cssText = 'width:1280px;height:960px';
      box.appendChild(c);
      sec.appendChild(box);
    };
    const J = (ctx: CanvasRenderingContext2D, x: number, y: number, f = 0, scarf = 0) => put(ctx, juniperKey(scarf), f, x, y, 0.5, 1);
    const wind = (ctx: CanvasRenderingContext2D, x: number, y: number, a: number, tint: string) => {
      const s = byKey.get(T4.windStreak);
      if (!s) return;
      const t = el('canvas');
      t.width = 120;
      t.height = 16;
      const tc = t.getContext('2d')!;
      tc.drawImage(s.canvas, 0, 0);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = tint;
      tc.fillRect(0, 0, 120, 16);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.drawImage(t, x, y);
      ctx.restore();
    };
    // Camp 1: steps of rock blocks, a sign, a checkpoint, a drifting cloud
    mk(0, undefined, (ctx) => {
      put(ctx, T4.checkpoint, 1, 120, WALK, 0.5, 1);
      put(ctx, T4.arrowSign, 2, 260, WALK, 0.5, 1);
      put(ctx, T4.rockBlock, 0, 420, WALK - 80, 0, 0);
      put(ctx, T4.rockBlock, 0, 580, WALK - 160, 0, 0);
      put(ctx, T4.rockBody, 0, 580, WALK, 0, 0);
      put(ctx, T4.platCloud, 0, 920, 380, 0.5, 0);
      J(ctx, 660, WALK - 160);
      put(ctx, gemKey(0), 0, 920, 380, 0.5, 1);
    });
    // Camp 2: terrace, bounce pad, log lift over a misty gap
    mk(1, [700, 1000], (ctx) => {
      for (let i = 0; i < 2; i++) {
        put(ctx, T4.rockBlock, 0, 100 + i * 160, WALK - 160, 0, 0);
        put(ctx, T4.rockBody, 0, 100 + i * 160, WALK, 0, 0);
      }
      put(ctx, T4.bouncePad, 0, 520, WALK, 0.5, 1);
      put(ctx, T4.arrowSign, 1, 620, WALK, 0.5, 1);
      put(ctx, T4.pitMist, 0, 690, WALK + 60, 0, 0);
      put(ctx, T4.pitMist, 0, 1000 - 320 + 10, WALK + 60, 0, 0);
      strokePathPreview(ctx, [[794, 0, 794, 478], [946, 0, 946, 478]]);
      put(ctx, T4.platLog, 0, 870, 470, 0.5, 0);
      J(ctx, 870, 470, 0, 1);
      put(ctx, T4.checkpoint, 0, 1150, WALK, 0.5, 1);
      J(ctx, 260, WALK - 160, 4, 1);
    });
    // Camp 3: ice floor, crumbly ledges at every stage, a cloud lift
    mk(2, [560, 1280], (ctx) => {
      for (let i = 0; i < 3; i++) put(ctx, T4.iceStrip, 0, -40 + i * 240, WALK, 0, 0);
      put(ctx, T4.pitMist, 0, 560, WALK + 40, 0, 0);
      put(ctx, T4.pitMist, 0, 880, WALK + 40, 0, 0);
      put(ctx, T4.pitMist, 0, 1200, WALK + 40, 0, 0);
      put(ctx, T4.checkpoint, 1, 100, WALK, 0.5, 1);
      J(ctx, 330, WALK, 4, 2);
      put(ctx, T4.platCrumble, 0, 660, 540, 0.5, 0);
      put(ctx, T4.platCrumble, 1, 860, 470, 0.5, 0);
      put(ctx, T4.platCrumble, 2, 1060, 400, 0.5, 0);
      put(ctx, T4.platCrumble, 3, 1200, 520, 0.5, 0);
      put(ctx, T4.platCloud, 1, 900, 230, 0.5, 0);
      J(ctx, 660, 540, 0, 2);
    });
    // Camp 4: gears, a pendulum with a brass platform, tick-tock platforms, gusts, helper cloud
    mk(3, [380, 1280], (ctx) => {
      put(ctx, T4.gear, 0, 520, 360, 0.5, 0.5, 1, 0.2);
      put(ctx, T4.gear, 0, 690, 250, 0.5, 0.5, 0.6, 0.05);
      put(ctx, T4.pitMist, 0, 380, WALK + 40, 0, 0);
      put(ctx, T4.pitMist, 0, 700, WALK + 40, 0, 0);
      put(ctx, T4.pitMist, 0, 1020, WALK + 40, 0, 0);
      put(ctx, T4.checkpoint, 1, 120, WALK, 0.5, 1);
      J(ctx, 260, WALK, 0, 3);
      put(ctx, T4.platBrass, 0, 480, 520, 0.5, 0);
      put(ctx, T4.platBrass, 1, 700, 460, 0.5, 0);
      put(ctx, T4.platBrass, 0, 920, 400, 0.5, 0);
      put(ctx, T4.pendulumRod, 0, 1120, 60, 0.5, 0.03, 1, -0.25);
      const ex = 1120 + Math.sin(0.25) * 395;
      const ey = 60 + Math.cos(0.25) * 395;
      put(ctx, T4.platBrass, 0, ex, ey, 0.5, 0);
      put(ctx, T4.helperCloud, 0, 560, 640, 0.5, 0);
      J(ctx, 480, 520, 12, 3);
      for (const [x, y] of [[560, 150], [760, 330], [960, 200], [620, 420]]) wind(ctx, x, y, 0.8, '#e6eeff');
    });
    // Camp 5: aurora bridges, helper cloud carrying Juniper, a lit checkpoint up top
    mk(4, [420, 1280], (ctx) => {
      put(ctx, T4.pitMist, 0, 420, WALK + 40, 0, 0);
      put(ctx, T4.pitMist, 0, 740, WALK + 40, 0, 0);
      put(ctx, T4.pitMist, 0, 1060, WALK + 40, 0, 0);
      put(ctx, T4.rockBlock, 0, 260, WALK - 160, 0, 0);
      put(ctx, T4.rockBody, 0, 260, WALK, 0, 0);
      put(ctx, T4.arrowSign, 0, 120, WALK, 0.5, 1);
      put(ctx, T4.platAurora, 0, 620, 420, 0.5, 0);
      put(ctx, T4.platAurora, 2, 900, 330, 0.5, 0);
      ctx.save();
      ctx.globalAlpha = 0.45;
      put(ctx, T4.platAurora, 1, 1150, 250, 0.5, 0);
      ctx.restore();
      put(ctx, T4.helperCloud, 1, 700, 560, 0.5, 0);
      J(ctx, 700, 590, 0, 4);
      put(ctx, T4.checkpoint, 1, 900, 330, 0.5, 1);
      put(ctx, T4.bouncePad, 2, 340, WALK - 160, 0.5, 1);
      J(ctx, 620, 420, 12, 5);
    });
  }

  // ---------------- tools
  if (wantPart('tools')) {
    const sec = section('v4-tools', 'v4: tool icons - the three new ones (right) next to the nine existing, 1:1 on grey / snow, then 80 px on a wood card, then 2x');
    for (const bg of ['#808088', '#e6eeff']) {
      const r = row(sec);
      for (const id of TOOL_IDS) canvasCell(r, 128, 128, id, bg, (ctx) => put(ctx, toolKey(id), 0, 0, 0, 0, 0));
    }
    const r80 = row(sec);
    for (const id of TOOL_IDS) canvasCell(r80, 96, 96, id, '#8a5530', (ctx) => put(ctx, toolKey(id), 0, 8, 8, 0, 0, 80 / 128));
    const r2 = row(sec);
    for (const id of TOOL_IDS.slice(-4)) canvasCell(r2, 256, 256, id, '#e6eeff', (ctx) => put(ctx, toolKey(id), 0, 0, 0, 0, 0, 2));
  }

  // ---------------- Phaser check
  if (wantPart('phaser')) {
    const sec = section('v4-phaser', 'v4 Phaser check: registerArt() creates every TEX4 texture with its frames and every ANIM4 animation');
    const host = el('div');
    sec.appendChild(host);
    const out = el('div', '', 'booting Phaser...');
    out.id = 'v4-phaser-out';
    out.style.whiteSpace = 'pre';
    sec.appendChild(out);
    const FRAMES: Record<string, number> = {
      [T4.platCloud]: 2, [T4.platCrumble]: 4, [T4.platBrass]: 2, [T4.platAurora]: 4, [T4.bouncePad]: 3,
      [T4.checkpoint]: 2, [T4.helperCloud]: 2, [T4.arrowSign]: 3,
    };
    const SIZES: Record<string, [number, number]> = {
      [T4.platCloud]: [240, 80], [T4.platLog]: [240, 64], [T4.platCrumble]: [200, 64], [T4.platBrass]: [200, 48],
      [T4.platAurora]: [240, 40], [T4.iceStrip]: [240, 40], [T4.rockBlock]: [160, 160], [T4.rockBody]: [160, 160],
      [T4.bouncePad]: [150, 100], [T4.gear]: [240, 240], [T4.pendulumRod]: [28, 420], [T4.checkpoint]: [90, 190],
      [T4.helperCloud]: [240, 120], [T4.pitMist]: [320, 140], [T4.windStreak]: [120, 16], [T4.arrowSign]: [110, 150],
    };
    void (async () => {
      try {
        const Phaser = (await import('phaser')).default;
        const { registerArt } = await import('./index');
        class V4Check extends Phaser.Scene {
          create(): void {
            const ta = performance.now();
            registerArt(this);
            const tb = performance.now();
            registerArt(this);
            const tc = performance.now();
            const lines: string[] = [`registerArt ${(tb - ta).toFixed(0)} ms, second call ${(tc - tb).toFixed(1)} ms`];
            const bad: string[] = [];
            for (const key of Object.values(T4)) {
              if (!this.textures.exists(key)) { bad.push(`${key}: missing`); continue; }
              const n = FRAMES[key] ?? 1;
              const fr = this.textures.get(key).frameTotal - 1; // minus __BASE
              const f0 = n > 1 ? this.textures.getFrame(key, 0) : this.textures.getFrame(key);
              const [w, h] = SIZES[key];
              if ((n > 1 ? fr !== n : false) || f0.width !== w || f0.height !== h) bad.push(`${key}: frames ${fr} size ${f0.width}x${f0.height}`);
            }
            const missingAnims = Object.values(ANIM4).filter((k) => !this.anims.exists(k));
            lines.push(`TEX4 problems: ${bad.length ? bad.join('; ') : 'none'}`);
            lines.push(`ANIM4 missing: ${missingAnims.length ? missingAnims.join(', ') : 'none'}`);
            lines.push(`tool icons: ${TOOL_IDS.filter((id) => this.textures.exists(toolKey(id))).length}/${TOOL_IDS.length}`);
            this.add.sprite(140, 60, T4.platCloud).setOrigin(0.5, 0).play(ANIM4.cloudBob);
            this.add.sprite(400, 60, T4.platAurora).setOrigin(0.5, 0).play(ANIM4.auroraShimmer);
            const pad = this.add.sprite(620, 180, T4.bouncePad).setOrigin(0.5, 1);
            this.time.addEvent({ delay: 1200, loop: true, callback: () => pad.play(ANIM4.bounce) });
            const cr = this.add.sprite(140, 200, T4.platCrumble).setOrigin(0.5, 0);
            this.time.addEvent({ delay: 1600, loop: true, callback: () => cr.play(ANIM4.crumble) });
            this.add.image(400, 200, T4.gear).setScale(0.5).setData('spin', 1);
            this.events.on('update', (_t: number, dt: number) => {
              this.children.list.forEach((o) => { if (o.getData && o.getData('spin')) (o as Phaser.GameObjects.Image).rotation += dt * 0.001; });
            });
            this.add.image(620, 300, toolKey('gripHooves')).setScale(0.6);
            this.add.image(520, 300, toolKey('cloudBoots')).setScale(0.6);
            this.add.image(420, 300, toolKey('featherCape')).setScale(0.6);
            out.textContent = lines.join('\n');
          }
        }
        new Phaser.Game({ type: Phaser.AUTO, parent: host, width: 720, height: 360, backgroundColor: '#3b3a7a', scene: V4Check });
      } catch (e) {
        out.textContent = 'v4 Phaser check failed: ' + String(e);
        console.error(e);
      }
    })();
  }
}

/** Two rope lines for the hanging log mock. */
function strokePathPreview(ctx: CanvasRenderingContext2D, lines: number[][]): void {
  ctx.save();
  for (const [x0, y0, x1, y1] of lines) {
    ctx.strokeStyle = '#1d1a3a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = '#e9d6b8';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- Phaser check ----------
if (full && !params.get('v2')) {
  const sec = section('phaser', 'Phaser check: registerArt() into a real scene (idempotent second call included)');
  const host = el('div');
  host.id = 'phaser-host';
  sec.appendChild(host);
  const out = el('div', '', 'booting Phaser...');
  out.id = 'phaser-out';
  sec.appendChild(out);
  void (async () => {
    try {
      const Phaser = (await import('phaser')).default;
      const { registerArt, ensureZoneArt, releaseZoneArt, hasZoneArt, ensureFlurrySilhouette } = await import('./index');
      class Check extends Phaser.Scene {
        create(): void {
          const ta = performance.now();
          registerArt(this);
          const tb = performance.now();
          registerArt(this); // must be a no-op
          const tc = performance.now();
          const bootZones = [0, 1, 2, 3, 4].filter((z) => hasZoneArt(this, z));
          const tz = performance.now();
          for (let z = 1; z < 5; z++) ensureZoneArt(this, z);
          const zoneMs = (performance.now() - tz) / 4;
          releaseZoneArt(this, [0]);
          const afterRelease = [0, 1, 2, 3, 4].filter((z) => hasZoneArt(this, z));
          for (let z = 1; z < 5; z++) ensureZoneArt(this, z); // re-create so the full key check below passes
          // v2: side areas on demand + release semantics
          const tA = performance.now();
          for (let z = 0; z < 5; z++) for (const a of [1, 2]) ensureZoneArt(this, z, a);
          const areaMs = (performance.now() - tA) / 10;
          const areasMade = [0, 1, 2, 3, 4].flatMap((z) => [1, 2].filter((a) => hasZoneArt(this, z, a)).map((a) => `${z}-${a}`));
          releaseZoneArt(this, 1, [2]);
          const afterAreaRelease = [0, 1, 2, 3, 4].flatMap((z) => [0, 1, 2].filter((a) => hasZoneArt(this, z, a)).map((a) => `${z}-${a}`));
          releaseZoneArt(this, [0, 1, 2, 3, 4], [0]);
          for (let z = 0; z < 5; z++) ensureZoneArt(this, z);
          const leftoverAreas = this.textures.getTextureKeys().filter((k) => /^bg-\d-a/.test(k));
          this.add.image(0, 0, bgKey(0, 'sky')).setOrigin(0).setScale(0.5);
          for (const l of ['far', 'mid', 'near'] as const) this.add.image(0, 0, bgKey(0, l)).setOrigin(0).setScale(0.5);
          this.add.image(0, 290, bgKey(0, 'ground')).setOrigin(0).setScale(0.5);
          const keys = [ANIM.idle, ANIM.walk, ANIM.jumpUp, ANIM.cheer];
          keys.forEach((k, i) => this.add.sprite(80 + i * 130, 320, juniperKey(i)).setOrigin(0.5, 1).setScale(0.75).play(juniperAnim(k, i)));
          for (let i = 0; i < 6; i++) this.add.sprite(60 + i * 60, 120, gemKey(i)).setScale(0.6).play(ANIM.gemTwinkle(i));
          this.add.sprite(560, 320, presentKey(1)).setOrigin(0.5, 1).setScale(0.75).play(ANIM.presentShake(1));
          const nums = this.anims.generateFrameNumbers(juniperKey(0), {});
          const missing: string[] = [];
          const sil = ensureFlurrySilhouette(this, 3);
          this.add.image(600, 60, sil).setOrigin(0.5, 1);
          this.add.image(600, 130, flurryKey(5), 0).setOrigin(0.5, 1).setTintFill(0x2e2a5c);
          this.add.sprite(520, 60, TEX2.looseGem).play(ANIM2.looseGemTwinkle);
          this.add.sprite(520, 140, TEX2.bellRing).play({ key: ANIM2.bellRing, repeat: -1 });
          const expected = [
            ...SCARF_COLOURS.map((_, i) => juniperKey(i)), ...Array.from({ length: 6 }, (_, i) => gemKey(i)),
            ...Array.from({ length: 4 }, (_, i) => presentKey(i)),
            ...Object.values(TEX).filter((k) => k !== TEX.juniper && k !== TEX.gem && k !== TEX.present && k !== TEX.friend),
            'friend-pip', 'friend-marlow', 'friend-odette',
            ...[0, 1, 2, 3, 4].flatMap((z) => BG_LAYERS.map((l) => bgKey(z, l))),
            ...COUNT_ICONS.map(countIconKey), ...TOOL_IDS.map(toolKey), ...Array.from({ length: HAT_COUNT }, (_, i) => hatKey(i)),
            ...Array.from({ length: FLURRY_KINDS }, (_, i) => flurryKey(i)), ...Object.values(TEX2),
          ];
          for (const k of expected) if (!this.textures.exists(k)) missing.push(k);
          const missingAnims = [ANIM2.looseGemTwinkle, ANIM2.bellRing].filter((k) => !this.anims.exists(k));
          const frameCounts = [flurryKey(0), TEX2.looseGem, TEX2.doorIce, TEX2.bellRing].map((k) => `${k}:${this.textures.get(k).frameTotal - 1}`);
          out.textContent = `registerArt: ${(tb - ta).toFixed(0)} ms, second call ${(tc - tb).toFixed(1)} ms; ` +
            `generateFrameNumbers(juniper-0) -> ${nums.length} frames; anims: ${this.anims.toJSON().anims.length}; ` +
            `missing textures: ${missing.length ? missing.join(', ') : 'none'}; missing v2 anims: ${missingAnims.length ? missingAnims.join(', ') : 'none'}; ` +
            `frames: ${frameCounts.join(' ')}; ` +
            `zones with bg after registerArt: [${bootZones}]; ensureZoneArt ~${zoneMs.toFixed(0)} ms/zone; ` +
            `after releaseZoneArt([0]): [${afterRelease}]; side areas made: ${areasMade.length}/10, ~${areaMs.toFixed(0)} ms/area; ` +
            `after releaseZoneArt(1,[2]): [${afterAreaRelease}]; side-area textures after release-all + trail re-ensure: ${leftoverAreas.length}; ` +
            `areaBgKey(2,1,'sky') = ${areaBgKey(2, 1, 'sky')}`;
        }
      }
      new Phaser.Game({ type: Phaser.AUTO, parent: host, width: 640, height: 450, backgroundColor: '#808088', scene: Check });
    } catch (e) {
      out.textContent = 'Phaser check failed: ' + String(e);
      console.error(e);
    }
  })();
}
