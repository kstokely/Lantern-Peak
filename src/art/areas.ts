// Side-area backgrounds: areaBgKey(zone, area 1|2, layer). Same sizes and rules as the
// trail layers (1280 wide, horizontally seamless; sky/far/mid/near 960 tall, ground 320 with
// the walk line at y 60). Painted on demand by ensureZoneArt(scene, zone, area).
//
//   camp 1  Bramble Hollow (snowy thicket, berry bushes)   High Shelf (cliff shelf above the clouds)
//   camp 2  Hush Grove (quiet moonlit glade)               Frozen Den (ice cave den)
//   camp 3  Crystal Gallery (huge crystal columns)         Echo Pool (underground pool, reflections)
//   camp 4  Gear Loft (inside the clock tower)             Windy Hollow (wind-carved hollow at dusk)
//   camp 5  Aurora Shelf (open shelf under the aurora)     Star Cavern (dark cavern, star-like glow dots)
import { areaBgKey, BgLayer } from './keys';
import {
  INK, INK2, VIOLET, SNOW, ICE, PINE, ROCK, SKY_DAY, SKY_DUSK, WARM, BERRY, WOOD, CREAM, mix, rgba,
} from './palette';
import { Ctx, SheetSpec, makeCanvas, rng, ellipse, circle, poly, fillPath, strokePath, star4, TAU, lerp } from './draw';
import {
  W, H, Rand, Layers, periodic, wrap, wdist, bandedSky, range, hills, pine, pineCols, scatter, stars, cloud,
  groundTile, crystal, icicle,
} from './backgrounds';

// ---------------------------------------------------------------- shared painters

/** Puffy cloud bank: a periodic row of puffs with everything below filled. */
function cloudBank(ctx: Ctx, r: Rand, baseY: number, amp: number, col: string, shade: string, step = 64): void {
  const f = periodic(r, [[2, amp], [5, amp * 0.6], [9, amp * 0.3]]);
  const puffs = (dy: number, dx: number) => (c: Ctx) => {
    for (let x = 0; x <= W; x += step / 2) {
      const rr = 38 + f(x) * 0.8 + (Math.round(x / (step / 2)) % 2 ? -8 : 6);
      for (const px of [x, x - W, x + W]) if (px > -80 && px < W + 80) circle(c, px + dx, baseY + f(x) + dy, Math.max(12, rr));
    }
    c.rect(0, baseY + dy, W, H);
  };
  fillPath(ctx, puffs(10, 4), shade);
  fillPath(ctx, puffs(0, 0), col);
}

/** Aurora curtain: vertical strokes along periodic curves with banded alpha. */
function aurora(ctx: Ctx, r: Rand, bands: [string, number, number][], height = 90): void {
  for (const [col, base, a] of bands) {
    const f = periodic(r, [[1, 40], [2, 30], [3, 14]]);
    const hgt = periodic(r, [[2, 30], [5, 14]]);
    const fadeF = periodic(r, [[2, 0.5], [3, 0.3]]);
    for (let x = 0; x < W; x += 3) {
      const y = base + f(x);
      const h = height + hgt(x);
      const fade = Math.max(0, Math.min(1, 0.55 + fadeF(x)));
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = rgba(col, (0.05 + k * 0.045) * a * (0.35 + 0.65 * fade));
        ctx.fillRect(x, y - h * (1 - k * 0.22), 3, h * (1 - k * 0.22) * (k === 3 ? 0.4 : 1) + 8);
      }
    }
  }
}

/** Glowing dot (glow-worm / star-in-the-rock). */
function glowDot(ctx: Ctx, x: number, y: number, s: number, col: string, a = 1): void {
  for (let i = 0; i < 3; i++) fillPath(ctx, (c) => circle(c, x, y, s * (3.4 - i)), rgba(col, 0.07 * a));
  fillPath(ctx, (c) => circle(c, x, y, s), rgba(col, 0.95 * a));
  fillPath(ctx, (c) => circle(c, x - s * 0.3, y - s * 0.3, s * 0.4), rgba(CREAM, 0.9 * a));
}

/** Ceiling band (periodic lower edge) from the top of the canvas; returns the edge function. */
function ceiling(ctx: Ctx, r: Rand, y0: number, amp: number, col: string, lip?: string): (x: number) => number {
  const f = periodic(r, [[3, amp], [5, amp * 0.55], [11, amp * 0.3]]);
  const e = (x: number) => y0 + f(x);
  fillPath(ctx, (c) => {
    c.moveTo(0, 0);
    for (let x = 0; x <= W; x += 8) c.lineTo(x, e(x));
    c.lineTo(W, 0);
    c.closePath();
  }, col);
  if (lip) {
    fillPath(ctx, (c) => {
      for (let x = 0; x <= W; x += 8) c.lineTo(x, e(x));
      for (let x = W; x >= 0; x -= 8) c.lineTo(x, e(x) - 10);
      c.closePath();
    }, lip);
  }
  return e;
}

/** Hanging rock stalactite with a lit left edge. */
function stalactite(ctx: Ctx, x: number, top: number, len: number, w: number, col: string, lit: string): void {
  fillPath(ctx, (c) => {
    c.moveTo(x - w / 2, top - 4);
    c.quadraticCurveTo(x - w * 0.3, top + len * 0.6, x, top + len);
    c.quadraticCurveTo(x + w * 0.25, top + len * 0.5, x + w / 2, top - 4);
    c.closePath();
  }, col);
  fillPath(ctx, (c) => {
    c.moveTo(x - w / 2 + 2, top);
    c.quadraticCurveTo(x - w * 0.3, top + len * 0.55, x - 1, top + len * 0.9);
    c.quadraticCurveTo(x - w * 0.15, top + len * 0.45, x - w * 0.18, top);
    c.closePath();
  }, lit);
}

/** Rock spire from a base line (stalagmite / hoodoo body). */
function spire(ctx: Ctx, x: number, baseY: number, h: number, w: number, col: string, shade: string): void {
  fillPath(ctx, (c) => {
    c.moveTo(x - w / 2, baseY + 20);
    c.quadraticCurveTo(x - w * 0.35, baseY - h * 0.6, x, baseY - h);
    c.quadraticCurveTo(x + w * 0.35, baseY - h * 0.6, x + w / 2, baseY + 20);
    c.closePath();
  }, col);
  fillPath(ctx, (c) => {
    c.moveTo(x + 2, baseY - h + 4);
    c.quadraticCurveTo(x + w * 0.35, baseY - h * 0.6, x + w / 2, baseY + 20);
    c.lineTo(x + w * 0.08, baseY + 20);
    c.quadraticCurveTo(x + w * 0.12, baseY - h * 0.5, x + 2, baseY - h + 4);
    c.closePath();
  }, shade);
}

interface BrambleCols { body: string; dark: string; cane: string; berry: string; berryLight: string; snow: string; snowShade: string }
interface BrambleSpec { w: number; h: number; canes: number[][]; berries: number[][]; snow: number[][] }

function brambleSpec(r: Rand, w: number, h: number, nBerries: number): BrambleSpec {
  const canes = Array.from({ length: 6 }, () => [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1, 0.8 + r() * 0.5]);
  const berries = Array.from({ length: nBerries }, () => [r() * 1.6 - 0.8, 0.2 + r() * 0.6, r()]);
  const snow = Array.from({ length: 3 }, () => [r() * 1.2 - 0.6, 0.7 + r() * 0.4]);
  return { w, h, canes, berries, snow };
}

/** Snowy bramble mound with arching canes and berry clusters. (x, by) = base centre. */
function bramble(ctx: Ctx, x: number, by: number, s: BrambleSpec, c: BrambleCols): void {
  const { w, h } = s;
  const mound = (cc: Ctx) => {
    ellipse(cc, x, by, w / 2, h * 0.7);
    circle(cc, x - w * 0.24, by - h * 0.5, h * 0.42);
    circle(cc, x + w * 0.08, by - h * 0.68, h * 0.42);
    circle(cc, x + w * 0.3, by - h * 0.4, h * 0.36);
  };
  // canes behind the mound
  for (const [a, b, d, k] of s.canes.slice(0, 3)) {
    strokePath(ctx, (cc) => { cc.moveTo(x + a * w * 0.3, by); cc.quadraticCurveTo(x + b * w * 0.6, by - h * 1.25 * k, x + d * w * 0.75, by - h * 0.25); }, c.cane, 4);
  }
  fillPath(ctx, mound, c.body);
  ctx.save();
  ctx.beginPath();
  mound(ctx);
  ctx.clip();
  fillPath(ctx, (cc) => ellipse(cc, x + w * 0.32, by - h * 0.1, w * 0.36, h * 0.9), c.dark);
  // twiggy texture
  ctx.strokeStyle = rgba(c.cane, 0.8);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [a, b] of s.berries) {
    ctx.moveTo(x + a * w * 0.4, by - b * h * 0.6);
    ctx.lineTo(x + a * w * 0.4 + 12, by - b * h * 0.6 - 10);
  }
  ctx.stroke();
  ctx.restore();
  // snow on the bumps
  for (const [a, b] of s.snow) {
    const sx = x + a * w * 0.5;
    const sy = by - h * 0.8 * b - h * 0.18;
    fillPath(ctx, (cc) => ellipse(cc, sx, sy, w * 0.16, h * 0.13), c.snow);
    fillPath(ctx, (cc) => ellipse(cc, sx + w * 0.05, sy + h * 0.05, w * 0.1, h * 0.06), c.snowShade);
  }
  // canes in front, with thorn ticks
  for (const [a, b, d, k] of s.canes.slice(3)) {
    const p0 = [x + a * w * 0.3, by];
    const p1 = [x + b * w * 0.6, by - h * 1.2 * k];
    const p2 = [x + d * w * 0.75, by - h * 0.2];
    strokePath(ctx, (cc) => { cc.moveTo(p0[0], p0[1]); cc.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); }, c.cane, 4);
    ctx.strokeStyle = c.cane;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let t = 0.2; t < 0.9; t += 0.17) {
      const px = lerp(lerp(p0[0], p1[0], t), lerp(p1[0], p2[0], t), t);
      const py = lerp(lerp(p0[1], p1[1], t), lerp(p1[1], p2[1], t), t);
      ctx.moveTo(px, py);
      ctx.lineTo(px + 5, py - 5);
    }
    ctx.stroke();
  }
  // berry clusters
  for (const [a, b, t] of s.berries) {
    const bx = x + a * w * 0.42;
    const byy = by - b * h * 0.75;
    const rr = 4 + t * 2.5;
    for (const [dx, dy] of [[0, 0], [rr * 1.5, rr * 0.4], [rr * 0.7, -rr * 1.2]]) {
      fillPath(ctx, (cc) => circle(cc, bx + dx, byy + dy, rr), c.berry);
      fillPath(ctx, (cc) => circle(cc, bx + dx - rr * 0.35, byy + dy - rr * 0.35, rr * 0.35), c.berryLight);
    }
  }
}

/** Wooden gear (flat, toothed rim, spokes). */
function gear(ctx: Ctx, x: number, y: number, R: number, teeth: number, rot: number, col: string, shade: string, hub: string): void {
  const toothH = Math.max(8, R * 0.14);
  const rim = (c: Ctx) => {
    for (let i = 0; i < teeth; i++) {
      const a0 = rot + (i / teeth) * TAU;
      const a1 = a0 + (0.5 / teeth) * TAU;
      const pts: number[] = [];
      for (const [a, rr] of [[a0, R], [a0 + 0.08 / teeth * TAU, R + toothH], [a1 - 0.08 / teeth * TAU, R + toothH], [a1, R]] as [number, number][]) {
        pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      if (i === 0) c.moveTo(pts[0], pts[1]);
      for (let k = 0; k < pts.length; k += 2) c.lineTo(pts[k], pts[k + 1]);
      const a2 = rot + ((i + 1) / teeth) * TAU;
      c.arc(x, y, R, a1, a2);
    }
    c.closePath();
  };
  fillPath(ctx, rim, col);
  // shaded lower-right
  ctx.save();
  ctx.beginPath();
  rim(ctx);
  ctx.clip();
  fillPath(ctx, (c) => circle(c, x + R * 0.35, y + R * 0.35, R * 1.05), shade);
  fillPath(ctx, (c) => circle(c, x - R * 0.06, y - R * 0.06, R * 0.98), col);
  ctx.restore();
  // window holes between spokes (cut through so the layer behind shows)
  const spokes = Math.max(4, Math.min(6, Math.round(R / 26)));
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < spokes; i++) {
    const a = rot + ((i + 0.5) / spokes) * TAU;
    fillPath(ctx, (c) => {
      c.moveTo(x + Math.cos(a - 0.38) * R * 0.32, y + Math.sin(a - 0.38) * R * 0.32);
      c.arc(x, y, R * 0.74, a - (Math.PI / spokes) * 0.72, a + (Math.PI / spokes) * 0.72);
      c.lineTo(x + Math.cos(a + 0.38) * R * 0.32, y + Math.sin(a + 0.38) * R * 0.32);
      c.closePath();
    }, '#000');
  }
  ctx.restore();
  fillPath(ctx, (c) => circle(c, x, y, R * 0.2), hub);
  fillPath(ctx, (c) => circle(c, x, y, R * 0.08), shade);
}

/** Front-facing plank floor ground tile (walk line y 60). */
function plankFloor(ctx: Ctx, r: Rand, o: { top: string; topLit: string; face: string; faceDark: string; seam: string; deep: string }): void {
  fillPath(ctx, (c) => c.rect(0, 60, W, 260), o.face);
  // board rows
  for (let row = 0; row < 7; row++) {
    const y = 84 + row * 36;
    fillPath(ctx, (c) => c.rect(0, y, W, 36), row % 2 ? o.face : mix(o.face, o.faceDark, 0.35));
    fillPath(ctx, (c) => c.rect(0, y, W, 3), rgba(o.seam, 0.9));
    const off = row % 2 ? 80 : 0;
    for (let x = off; x < W; x += 160) fillPath(ctx, (c) => c.rect(x, y, 3, 36), rgba(o.seam, 0.9));
    for (let k = 0; k < 6; k++) fillPath(ctx, (c) => ellipse(c, r() * W, y + 18, 18 + r() * 20, 1.6), rgba(o.seam, 0.35));
  }
  fillPath(ctx, (c) => c.rect(0, 250, W, 70), rgba(o.deep, 0.5));
  // top board (the walkable surface seen at a glance)
  fillPath(ctx, (c) => c.rect(0, 60, W, 24), o.top);
  fillPath(ctx, (c) => c.rect(0, 62, W, 6), o.topLit);
  fillPath(ctx, (c) => c.rect(0, 82, W, 4), rgba(INK, 0.4));
  ctx.fillStyle = o.seam;
  ctx.fillRect(0, 58, W, 4);
  // nail heads
  for (let x = 40; x < W; x += 160) fillPath(ctx, (c) => { circle(c, x, 72, 2.4); circle(c, x + 80, 72, 2.4); }, rgba(INK, 0.6));
  // a little dust of snow blown in
  for (let k = 0; k < 40; k++) {
    ctx.fillStyle = rgba(SNOW[2], 0.3 + r() * 0.4);
    ctx.fillRect(Math.floor(r() * W), 62 + Math.floor(r() * 18), 2, 2);
  }
}

/** Stone-block wall with courses that tile at 1280 (block width divides 1280). */
function blockWall(ctx: Ctx, r: Rand, top: number, bottom: number, bw: number, bh: number, cols: [string, string, string]): void {
  for (let y = top, row = 0; y < bottom; y += bh, row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -bw + off; x < W + bw; x += bw) {
      const t = r();
      fillPath(ctx, (c) => c.rect(x + 2, y + 2, bw - 4, bh - 4), mix(cols[1], t > 0.5 ? cols[2] : cols[0], Math.abs(t - 0.5) * 0.5));
      fillPath(ctx, (c) => c.rect(x + 2, y + 2, bw - 4, 4), rgba(cols[2], 0.35));
    }
    fillPath(ctx, (c) => c.rect(0, y, W, 3), cols[0]);
  }
}

const GLOW = [ICE[2], WARM[4], '#bfa2f5', CREAM, '#8fe6f2'];

// ---------------------------------------------------------------- the ten areas

type AreaSet = [Layers, Layers];

const AREAS: AreaSet[] = [
  // ======================================================== camp 1 Lantern Meadow
  [
    // ---- Bramble Hollow: snowy thicket with berry bushes
    {
      sky: (ctx, r) => {
        bandedSky(ctx, [SKY_DAY[1], SKY_DAY[2], '#dcecff', '#f4ecdc'], 0, 600);
        for (let i = 0; i < 4; i++) fillPath(ctx, (c) => circle(c, 980, 150, 90 - i * 20), rgba(SKY_DAY[3], 0.1 + i * 0.07));
        for (const x of scatter(r, 4, 260)) {
          const y = 80 + r() * 160;
          const s = 0.7 + r() * 0.5;
          wrap(x, (px) => cloud(ctx, px, y, s, mix(SNOW[2], SKY_DAY[2], 0.1), mix(SKY_DAY[2], VIOLET[3], 0.5)));
        }
      },
      far: (ctx, r) => {
        const haze = SKY_DAY[2];
        const y = hills(ctx, r, 470, 36, mix(SNOW[0], haze, 0.45), { col: mix(SNOW[2], haze, 0.3), depth: 10 });
        for (const x of scatter(r, 16, 50)) {
          const h = 40 + r() * 40;
          wrap(x, (px) => pine(ctx, px, y(px) + 12, h, pineCols(PINE[1], haze, 0.65), 3, 0.5));
        }
        hills(ctx, r, 540, 22, mix(SNOW[0], haze, 0.35), { col: mix(SNOW[2], haze, 0.25), depth: 8 });
      },
      mid: (ctx, r) => {
        const haze = SKY_DAY[2];
        const y = hills(ctx, r, 548, 16, mix(SNOW[0], haze, 0.25), { col: mix(SNOW[2], haze, 0.15), depth: 8 });
        const cols: BrambleCols = {
          body: mix(mix(PINE[0], VIOLET[1], 0.45), haze, 0.4), dark: mix(mix(PINE[0], VIOLET[0], 0.5), haze, 0.35),
          cane: mix(mix(BERRY[0], VIOLET[0], 0.55), haze, 0.35), berry: mix(BERRY[1], haze, 0.4), berryLight: mix(BERRY[2], haze, 0.3),
          snow: mix(SNOW[2], haze, 0.15), snowShade: mix(VIOLET[3], haze, 0.3),
        };
        for (const x of scatter(r, 8, 140)) {
          const s = brambleSpec(r, 140 + r() * 90, 80 + r() * 50, 3);
          wrap(x, (px) => bramble(ctx, px, y(px) + 14, s, cols));
        }
      },
      near: (ctx, r) => {
        const haze = SKY_DAY[2];
        const y = hills(ctx, r, 612, 14, mix(SNOW[1], VIOLET[3], 0.3), { col: SNOW[2], depth: 8 });
        const cols: BrambleCols = {
          body: mix(PINE[0], VIOLET[1], 0.35), dark: mix(PINE[0], VIOLET[0], 0.55), cane: mix(BERRY[0], VIOLET[0], 0.5),
          berry: mix(BERRY[1], VIOLET[1], 0.2), berryLight: BERRY[2], snow: SNOW[2], snowShade: VIOLET[3],
        };
        for (const x of scatter(r, 5, 220)) {
          const s = brambleSpec(r, 220 + r() * 120, 170 + r() * 80, 5);
          wrap(x, (px) => bramble(ctx, px, y(px) + 16, s, cols));
        }
        // overhanging thicket: a tangled ceiling of snowy bramble with drooping canes,
        // so the hollow feels tucked in under the bushes
        const e = ceiling(ctx, r, 46, 18, cols.dark, cols.body);
        for (const x of scatter(r, 9, 120)) {
          const span = 110 + r() * 90;
          const sag = 70 + r() * 90;
          const berry = r() > 0.45;
          wrap(x, (px) => {
            const p0 = [px - span / 2, e(px - span / 2) - 6];
            const p2 = [px + span / 2, e(px + span / 2) - 6];
            const p1 = [px, e(px) + sag * 2 - 40];
            strokePath(ctx, (c) => { c.moveTo(p0[0], p0[1]); c.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); }, cols.cane, 6);
            ctx.strokeStyle = cols.cane;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let t = 0.15; t < 0.9; t += 0.14) {
              const qx = lerp(lerp(p0[0], p1[0], t), lerp(p1[0], p2[0], t), t);
              const qy = lerp(lerp(p0[1], p1[1], t), lerp(p1[1], p2[1], t), t);
              ctx.moveTo(qx, qy);
              ctx.lineTo(qx + 6, qy + 5);
            }
            ctx.stroke();
            // snow riding on the lowest point of the cane
            const lx = lerp(lerp(p0[0], p1[0], 0.5), lerp(p1[0], p2[0], 0.5), 0.5);
            const ly = lerp(lerp(p0[1], p1[1], 0.5), lerp(p1[1], p2[1], 0.5), 0.5);
            fillPath(ctx, (c) => ellipse(c, lx, ly - 4, 18, 5), cols.snow);
            if (berry) {
              for (const [dx, dy] of [[-4, 6], [4, 8], [0, 14]]) {
                fillPath(ctx, (c) => circle(c, lx + dx, ly + dy, 5), cols.berry);
                fillPath(ctx, (c) => circle(c, lx + dx - 1.5, ly + dy - 1.5, 1.8), cols.berryLight);
              }
            }
          });
        }
        // snow lying along the top of the thicket ceiling
        fillPath(ctx, (c) => {
          for (let x = 0; x <= W; x += 8) c.lineTo(x, e(x) - 22);
          for (let x = W; x >= 0; x -= 8) c.lineTo(x, e(x) - 12 + Math.sin(x / 23) * 3);
          c.closePath();
        }, rgba(cols.snow, 0.9));
        // a couple of bare young trees poking out of the thicket
        for (const x of scatter(r, 3, 360)) {
          const h = 240 + r() * 80;
          const lean = r() * 0.2 - 0.1;
          wrap(x, (px) => {
            const by = y(px) + 10;
            const tx = px + lean * h;
            strokePath(ctx, (c) => { c.moveTo(px, by); c.quadraticCurveTo(px + lean * h * 0.3, by - h * 0.5, tx, by - h); }, mix(ROCK[0], VIOLET[0], 0.3), 9);
            for (const [t, d, l] of [[0.5, -1, 60], [0.65, 1, 50], [0.8, -1, 40]]) {
              const bx = lerp(px, tx, t);
              const byy = by - h * t;
              strokePath(ctx, (c) => { c.moveTo(bx, byy); c.lineTo(bx + d * l, byy - l * 0.6); }, mix(ROCK[0], VIOLET[0], 0.3), 4);
              fillPath(ctx, (c) => ellipse(c, bx + d * l * 0.6, byy - l * 0.42, 14, 4, -d * 0.5), SNOW[2]);
            }
          });
        }
      },
      ground: (ctx, r) => groundTile(ctx, r, { lit: SNOW[2], body: SNOW[1], shade: SNOW[0], deep: VIOLET[3], edge: VIOLET[2], speck: CREAM, pebble: mix(WOOD[1], VIOLET[2], 0.5) }),
    },
    // ---- High Shelf: a cliff shelf above the clouds
    {
      sky: (ctx, r) => {
        bandedSky(ctx, ['#2a54c0', SKY_DAY[0], SKY_DAY[1], SKY_DAY[2], '#e4f1ff'], 0, 700);
        for (let i = 0; i < 4; i++) fillPath(ctx, (c) => circle(c, 980, 170, 120 - i * 26), rgba(SKY_DAY[3], 0.12 + i * 0.09));
        fillPath(ctx, (c) => circle(c, 980, 170, 34), rgba(CREAM, 0.9));
        for (const x of scatter(r, 6, 180)) {
          const y = 120 + r() * 220;
          const len = 120 + r() * 140;
          wrap(x, (px) => {
            fillPath(ctx, (c) => ellipse(c, px, y, len, 7), rgba(SNOW[2], 0.4));
            fillPath(ctx, (c) => ellipse(c, px + 30, y + 6, len * 0.6, 4), rgba(SKY_DAY[2], 0.5));
          });
        }
      },
      far: (ctx, r) => {
        const haze = SKY_DAY[2];
        range(ctx, r, {
          peaks: [{ x: 140, h: 220, w: 200 }, { x: 470, h: 300, w: 220 }, { x: 820, h: 200, w: 180 }, { x: 1080, h: 260, w: 210 }],
          baseY: 470, rock: mix(VIOLET[2], haze, 0.5), shadow: rgba(mix(VIOLET[1], haze, 0.4), 0.45),
          snow: mix(SNOW[2], haze, 0.15), snowShadow: mix(VIOLET[3], haze, 0.3), cap: 0.5, jag: 8,
        });
        cloudBank(ctx, r, 410, 14, mix(SNOW[2], haze, 0.25), mix(VIOLET[3], haze, 0.35));
      },
      mid: (ctx, r) => {
        const haze = SKY_DAY[2];
        // rock pinnacles standing out of the cloud sea
        for (const x of scatter(r, 4, 260)) {
          const h = 140 + r() * 110;
          const w = 70 + r() * 40;
          wrap(x, (px) => {
            spire(ctx, px, 500, h, w, mix(ROCK[1], haze, 0.15), mix(ROCK[0], haze, 0.1));
            fillPath(ctx, (c) => ellipse(c, px - 4, 500 - h + 16, w * 0.24, 11), SNOW[2]);
          });
        }
        cloudBank(ctx, r, 492, 18, SNOW[2], mix(VIOLET[3], haze, 0.2), 80);
      },
      near: (ctx, r) => {
        range(ctx, r, {
          peaks: scatter(r, 7, 150).map((x) => ({ x, h: 60 + r() * 90, w: 80 + r() * 50 })),
          baseY: 620, rock: ROCK[1], shadow: rgba(ROCK[0], 0.8),
          snow: SNOW[2], snowShadow: VIOLET[3], cap: 0.4, jag: 10, sharp: 0.8,
        });
        const y = (x: number) => 600 + Math.sin((x / W) * TAU * 3) * 6;
        for (const x of scatter(r, 3, 340)) {
          const h = 130 + r() * 60;
          wrap(x, (px) => {
            ctx.save();
            ctx.translate(px, y(px));
            ctx.transform(1, 0, 0.18, 1, 0, 0);
            pine(ctx, 0, 0, h, pineCols(PINE[0], SKY_DAY[2], 0.1), 3, 0.7);
            ctx.restore();
          });
        }
      },
      ground: (ctx, r) => groundTile(ctx, r, { lit: SNOW[2], body: mix(SNOW[1], ROCK[2], 0.2), shade: mix(SNOW[0], ROCK[2], 0.35), deep: ROCK[1], edge: ROCK[0], speck: CREAM, pebble: ROCK[1] }),
    },
  ],
  // ======================================================== camp 2 Frostpine Forest
  [
    // ---- Hush Grove: quiet moonlit glade
    {
      sky: (ctx, r) => {
        bandedSky(ctx, ['#11163e', '#18205a', '#223077', '#2f4592', '#4660ad'], 0, 700);
        stars(ctx, r, 170, 560, SNOW[2], 0.05);
        for (let i = 0; i < 4; i++) fillPath(ctx, (c) => circle(c, 300, 190, 130 - i * 22), rgba(ICE[3], 0.05 + i * 0.03));
        fillPath(ctx, (c) => circle(c, 300, 190, 58), '#f1efff');
        fillPath(ctx, (c) => { circle(c, 282, 176, 11); circle(c, 318, 206, 8); circle(c, 312, 168, 5); circle(c, 286, 214, 6); }, rgba(VIOLET[3], 0.55));
        fillPath(ctx, (c) => { c.arc(300, 190, 58, -0.6, 1.9); c.arc(310, 196, 52, 1.9, -0.6, true); c.closePath(); }, rgba(VIOLET[2], 0.35));
      },
      far: (ctx, r) => {
        const haze = '#3a4e9a';
        const y = hills(ctx, r, 540, 14, mix(VIOLET[0], haze, 0.5));
        for (const x of scatter(r, 30, 32)) {
          const h = 80 + r() * 70;
          wrap(x, (px) => pine(ctx, px, y(px) + 24, h, pineCols(PINE[0], haze, 0.72, mix(SNOW[1], VIOLET[3], 0.5)), 3, 0.5));
        }
      },
      mid: (ctx, r) => {
        const haze = '#2c3d86';
        // moonbeams slanting down from the upper left
        for (const x of scatter(r, 4, 260)) {
          wrap(x, (px) => fillPath(ctx, (c) => poly(c, [px - 20, 0, px + 40, 0, px + 220, 700, px + 120, 700]), rgba(ICE[3], 0.06)));
        }
        const y = hills(ctx, r, 604, 12, mix(VIOLET[1], haze, 0.35), { col: mix(SNOW[0], VIOLET[3], 0.3), depth: 8 });
        for (const x of scatter(r, 11, 96)) {
          const h = 170 + r() * 110;
          wrap(x, (px) => pine(ctx, px, y(px) + 18, h, pineCols(PINE[0], haze, 0.45, mix(SNOW[1], VIOLET[3], 0.3)), 5, 0.75));
        }
        // round snow-capped shrubs in the glade
        for (const x of scatter(r, 9, 110)) {
          const s = 22 + r() * 16;
          wrap(x, (px) => {
            fillPath(ctx, (c) => { circle(c, px - s * 0.6, y(px) + 6, s * 0.8); circle(c, px + s * 0.4, y(px) + 2, s); }, mix(PINE[0], haze, 0.55));
            fillPath(ctx, (c) => { ellipse(c, px - s * 0.6, y(px) - s * 0.5, s * 0.6, s * 0.28); ellipse(c, px + s * 0.3, y(px) - s * 0.75, s * 0.75, s * 0.32); }, mix(SNOW[1], VIOLET[3], 0.35));
          });
        }
      },
      near: (ctx, r) => {
        const y = hills(ctx, r, 668, 10, mix(VIOLET[0], INK, 0.25), { col: mix(SNOW[0], VIOLET[2], 0.3), depth: 6 });
        for (const x of scatter(r, 5, 230)) {
          const h = 400 + r() * 140;
          wrap(x, (px) => pine(ctx, px, y(px) + 16, h, pineCols(mix(PINE[0], INK, 0.35), '#1c2460', 0.12, mix(SNOW[0], VIOLET[3], 0.4)), 6, 0.85));
        }
        for (const x of scatter(r, 6, 160)) {
          const s = 30 + r() * 20;
          wrap(x, (px) => fillPath(ctx, (c) => ellipse(c, px, y(px) + 8, s * 1.6, s * 0.7), mix(SNOW[0], VIOLET[2], 0.4)));
        }
      },
      ground: (ctx, r) => groundTile(ctx, r, { lit: mix(SNOW[1], VIOLET[3], 0.35), body: mix(SNOW[0], VIOLET[2], 0.3), shade: mix(VIOLET[2], VIOLET[1], 0.3), deep: VIOLET[1], edge: VIOLET[0], speck: ICE[3], pebble: mix(ROCK[1], VIOLET[0], 0.3) }),
    },
    // ---- Frozen Den: ice cave den
    {
      sky: (ctx, r) => {
        bandedSky(ctx, ['#0f2c4a', '#163e62', '#1f557c', '#2c6d96', '#3d86ac'], 0, 760);
        for (let i = 0; i < 46; i++) {
          const x = r() * W;
          const y = r() * H;
          const s = 30 + r() * 80;
          const rot = r() * 0.8 - 0.4;
          wrap(x, (px) => fillPath(ctx, (c) => ellipse(c, px, y, s * 1.3, s * 0.7, rot), rgba(i % 3 ? ICE[2] : '#0b2238', 0.1)));
        }
        // frost cracks in the ice wall
        for (let i = 0; i < 18; i++) {
          const x = r() * W;
          const y = 60 + r() * 600;
          const pts = [0, 0, ...Array.from({ length: 4 }, (_, k) => [(k + 1) * (14 + r() * 14), (r() - 0.5) * 30]).flat()];
          wrap(x, (px) => strokePath(ctx, (c) => poly(c, pts.map((v, k) => v + (k % 2 ? y : px)), false), rgba(ICE[3], 0.22), 2));
        }
      },
      far: (ctx, r) => {
        // rounded ice columns joining floor and ceiling
        for (const x of scatter(r, 6, 170)) {
          const w = 50 + r() * 40;
          const wav = [r(), r(), r()];
          wrap(x, (px) => {
            const edge = (y: number) => w * (0.75 + 0.25 * Math.sin(y / 90 + wav[0] * 6) + 0.15 * Math.sin(y / 37 + wav[1] * 6));
            fillPath(ctx, (c) => {
              c.moveTo(px - edge(0), 0);
              for (let y = 0; y <= H; y += 20) c.lineTo(px - edge(y), y);
              for (let y = H; y >= 0; y -= 20) c.lineTo(px + edge(y) * 0.9, y);
              c.closePath();
            }, mix(ICE[1], '#163e62', 0.55));
            fillPath(ctx, (c) => {
              c.moveTo(px - edge(0) * 0.7, 0);
              for (let y = 0; y <= H; y += 20) c.lineTo(px - edge(y) * 0.7, y);
              for (let y = H; y >= 0; y -= 20) c.lineTo(px - edge(y) * 0.35, y);
              c.closePath();
            }, rgba(ICE[3], 0.22));
          });
        }
        hills(ctx, r, 560, 22, mix(ICE[0], '#163e62', 0.4), { col: mix(ICE[2], '#163e62', 0.45), depth: 6 });
      },
      mid: (ctx, r) => {
        const e = ceiling(ctx, r, 70, 16, '#0d2a44', mix(ICE[1], '#0d2a44', 0.4));
        for (const x of scatter(r, 18, 50)) {
          const len = 50 + r() * 110;
          const w = 14 + r() * 14;
          wrap(x, (px) => icicle(ctx, px, e(px) - 4, len, w, mix(ICE[1], '#0d2a44', 0.35), rgba(ICE[3], 0.6)));
        }
        const y = hills(ctx, r, 608, 22, mix(ICE[0], '#163e62', 0.15), { col: mix(ICE[2], SNOW[1], 0.3), depth: 7 });
        // big rounded ice boulders
        for (const x of scatter(r, 7, 150)) {
          const s = 40 + r() * 40;
          wrap(x, (px) => {
            fillPath(ctx, (c) => { ellipse(c, px, y(px) + 6, s * 1.3, s); circle(c, px + s * 0.8, y(px) + 10, s * 0.6); }, mix(ICE[1], '#163e62', 0.25));
            fillPath(ctx, (c) => ellipse(c, px - s * 0.4, y(px) - s * 0.45, s * 0.45, s * 0.25, -0.4), rgba(ICE[3], 0.5));
            fillPath(ctx, (c) => ellipse(c, px, y(px) - s * 0.8, s * 0.9, s * 0.22), mix(SNOW[1], ICE[3], 0.4));
          });
        }
      },
      near: (ctx, r) => {
        const e = ceiling(ctx, r, 40, 22, '#09203a', mix(ICE[0], '#09203a', 0.3));
        for (const x of scatter(r, 22, 40)) {
          const len = 60 + r() * 170;
          const w = 16 + r() * 18;
          wrap(x, (px) => icicle(ctx, px, e(px) - 6, len, w, mix(ICE[1], '#09203a', 0.2), rgba(ICE[3], 0.75)));
        }
        const y = hills(ctx, r, 676, 12, mix(ICE[0], INK, 0.3), { col: mix(ICE[2], SNOW[1], 0.4), depth: 6 });
        // a cosy snow hollow (the den) and frosted mounds
        for (const x of scatter(r, 4, 260)) {
          const s = 60 + r() * 30;
          wrap(x, (px) => {
            fillPath(ctx, (c) => ellipse(c, px, y(px) + 10, s * 1.8, s * 0.9), mix(SNOW[1], ICE[2], 0.35));
            fillPath(ctx, (c) => ellipse(c, px + 10, y(px) + 16, s * 0.9, s * 0.45), mix(ICE[0], '#09203a', 0.5));
            fillPath(ctx, (c) => ellipse(c, px - s * 0.6, y(px) - s * 0.4, s * 0.6, s * 0.18), SNOW[2]);
          });
        }
      },
      ground: (ctx, r) => groundTile(ctx, r, { lit: ICE[3], body: mix(ICE[2], SNOW[1], 0.6), shade: mix(ICE[1], VIOLET[2], 0.3), deep: mix(ICE[0], VIOLET[0], 0.4), edge: ICE[0], speck: ICE[3], pebble: mix(ICE[1], SNOW[0], 0.3), ice: true }),
    },
  ],
  // ======================================================== camp 3 Glimmer Caves
  [
    // ---- Crystal Gallery: big crystal columns
    {
      sky: (ctx, r) => {
        bandedSky(ctx, ['#120d2a', '#1a1440', '#231c55', '#2c256a', '#352f7c'], 0, 760);
        for (let i = 0; i < 50; i++) {
          const x = r() * W;
          const y = r() * H;
          const s = 30 + r() * 70;
          wrap(x, (px) => fillPath(ctx, (c) => ellipse(c, px, y, s * 1.4, s * 0.7, 0.3), rgba(i % 2 ? '#0c0820' : '#4a3a9a', 0.25)));
        }
        for (let i = 0; i < 50; i++) {
          const x = r() * W;
          const y = 40 + r() * 680;
          const s = 3 + r() * 5;
          const col = i % 2 ? ICE[2] : '#bfa2f5';
          wrap(x, (px) => fillPath(ctx, (c) => star4(c, px, y, s, 0.3), rgba(col, 0.35 + (i % 5) * 0.08)));
        }
      },
      far: (ctx, r) => {
        // towering hexagonal crystal columns
        const cols = [['#3a2a7e', '#4f3a9e', '#7a64c8'], ['#21507a', '#2c6b96', '#56a6c8']];
        for (const [i, x] of scatter(r, 6, 180).entries()) {
          const w = 46 + r() * 40;
          const topY = i % 3 === 0 ? -40 : 60 + r() * 160;
          const tilt = r() * 0.12 - 0.06;
          const [d, b, l] = cols[i % 2];
          wrap(x, (px) => {
            ctx.save();
            ctx.translate(px, H);
            ctx.rotate(tilt);
            const top = topY - H;
            fillPath(ctx, (c) => poly(c, [-w, 40, -w, top + w * 0.6, 0, top, w, top + w * 0.6, w, 40]), b);
            fillPath(ctx, (c) => poly(c, [w * 0.25, 40, w * 0.25, top + w * 0.15, w, top + w * 0.6, w, 40]), d);
            fillPath(ctx, (c) => poly(c, [-w + 6, 40, -w + 6, top + w * 0.62, -w * 0.45, top + w * 0.3, -w * 0.45, 40]), rgba(l, 0.6));
            ctx.restore();
          });
        }
        hills(ctx, r, 570, 18, '#1c1640');
      },
      mid: (ctx, r) => {
        const y = hills(ctx, r, 566, 24, '#1b143c', { col: '#3b2f7a', depth: 6 });
        const palettes: [string, string, string][] = [['#5a3aa8', '#8a5fd8', '#d4c2ff'], [ICE[0], ICE[1], ICE[3]], ['#7a2f86', '#b05ac0', '#f0c6ff']];
        for (const [i, x] of scatter(r, 8, 120).entries()) {
          const n = 3 + Math.floor(r() * 3);
          const base = 90 + r() * 90;
          const tilts = Array.from({ length: n }, () => r() * 0.9 - 0.45);
          const pal = palettes[i % 3];
          wrap(x, (px) => {
            for (let k = 0; k < 3; k++) fillPath(ctx, (c) => ellipse(c, px, y(px) - base * 0.4, base * (1.2 - k * 0.3), base * (0.8 - k * 0.2)), rgba(pal[2], 0.05));
            for (let k = 0; k < n; k++) crystal(ctx, px + (k - (n - 1) / 2) * base * 0.22, y(px) + 8, base * (1 - Math.abs(k - (n - 1) / 2) * 0.22), tilts[k], pal);
          });
        }
      },
      near: (ctx, r) => {
        const e = ceiling(ctx, r, 60, 18, '#0c0820', '#2a1f5c');
        for (const x of scatter(r, 12, 90)) {
          const h = 60 + r() * 120;
          const tilt = Math.PI + (r() * 0.4 - 0.2);
          const pal: [string, string, string] = r() > 0.5 ? ['#3b2a80', '#6a4cc0', '#bfa2f5'] : [mix(ICE[0], INK, 0.3), ICE[0], ICE[2]];
          wrap(x, (px) => crystal(ctx, px, e(px) - 6, h, tilt, pal));
        }
        const y = hills(ctx, r, 674, 12, '#100a28', { col: '#30246a', depth: 5 });
        for (const x of scatter(r, 5, 200)) {
          const h = 80 + r() * 60;
          const tilt = r() * 0.5 - 0.25;
          wrap(x, (px) => {
            crystal(ctx, px, y(px) + 8, h, tilt, ['#3b2a80', '#7a5bd0', '#e2d6ff']);
            crystal(ctx, px + h * 0.25, y(px) + 10, h * 0.6, tilt + 0.4, [mix(ICE[0], INK, 0.2), ICE[1], ICE[3]]);
          });
        }
      },
      ground: (ctx, r) => groundTile(ctx, r, { lit: '#e6dcff', body: mix('#bfa2f5', SNOW[1], 0.5), shade: mix('#8a5fd8', VIOLET[2], 0.4), deep: '#5a3aa8', edge: '#3b2a80', speck: '#ece0ff', pebble: '#8a5fd8', ice: true }),
    },
    // ---- Echo Pool: underground pool with reflections
    {
      sky: (ctx, r) => {
        bandedSky(ctx, ['#081a24', '#0d2632', '#123443', '#184454', '#1f5462'], 0, 620);
        for (let i = 0; i < 50; i++) {
          const x = r() * W;
          const y = r() * 600;
          const s = 20 + r() * 70;
          wrap(x, (px) => fillPath(ctx, (c) => ellipse(c, px, y, s * 1.4, s * 0.8, 0.2), rgba(i % 3 ? '#061318' : '#2a6e78', 0.3)));
        }
      },
      far: (ctx, r) => {
        const e = ceiling(ctx, r, 70, 22, '#0a1f29', '#174552');
        for (const x of scatter(r, 16, 60)) {
          const len = 40 + r() * 110;
          const w = 22 + r() * 22;
          wrap(x, (px) => stalactite(ctx, px, e(px), len, w, '#123a46', '#1f5865'));
        }
        // distant shelf
        hills(ctx, r, 386, 10, '#0f2e39', { col: '#1d5866', depth: 4 });
      },
      mid: (ctx, r) => {
        const RIM = 392;
        // the pool: banded water from the far rim down
        const bands = ['#0d3340', '#0f3a49', '#124352', '#154b5b', '#185464', '#1b5c6d'];
        bands.forEach((b, i) => fillPath(ctx, (c) => c.rect(0, RIM + i * 24, W, i === bands.length - 1 ? H : 25), b));
        // stalagmites on the far rim, plus their reflections
        const rocks = scatter(r, 9, 110).map((x) => ({ x, h: 50 + r() * 110, w: 40 + r() * 30, glow: r() > 0.55 }));
        for (const k of rocks) {
          wrap(k.x, (px) => {
            spire(ctx, px, RIM, k.h, k.w, '#123a46', '#0c2a33');
            // reflection: flipped, faded, broken into strips
            for (let s = 0; s < 6; s++) {
              const y0 = RIM + 6 + s * (k.h / 6);
              const t = s / 6;
              const wid = k.w * (0.5 + 0.5 * (1 - t)) * (s % 2 ? 0.85 : 1);
              fillPath(ctx, (c) => c.rect(px - wid / 2 + (s % 2 ? 4 : -3), y0, wid, k.h / 12), rgba('#0a2a33', 0.6 * (1 - t)));
            }
            if (k.glow) {
              crystal(ctx, px + k.w * 0.4, RIM + 4, 26, 0.3, [ICE[0], ICE[1], ICE[3]]);
              for (let s = 0; s < 5; s++) fillPath(ctx, (c) => ellipse(c, px + k.w * 0.4 + (s % 2 ? 3 : -3), RIM + 12 + s * 8, 8 - s, 2), rgba(ICE[2], 0.45 - s * 0.08));
            }
          });
        }
        // rim line + shimmering light dashes on the water
        fillPath(ctx, (c) => c.rect(0, RIM - 2, W, 5), '#2a6e78');
        for (let i = 0; i < 90; i++) {
          const x = r() * W;
          const y = RIM + 14 + Math.pow(r(), 1.5) * 300;
          const len = 10 + r() * 40;
          const a = 0.15 + r() * 0.35;
          wrap(x, (px) => fillPath(ctx, (c) => c.rect(px, y, len, 2), rgba(ICE[3], a)));
        }
        // echo rings spreading on the water
        for (const x of scatter(r, 3, 380)) {
          const y = RIM + 50 + r() * 40;
          wrap(x, (px) => {
            for (const [rx, a] of [[40, 0.35], [80, 0.22], [120, 0.12]] as [number, number][]) strokePath(ctx, (c) => ellipse(c, px, y, rx, rx * 0.16), rgba(ICE[3], a), 2.5);
          });
        }
      },
      near: (ctx, r) => {
        const e = ceiling(ctx, r, 34, 20, '#061319', '#123a46');
        for (const x of scatter(r, 14, 80)) {
          const len = 80 + r() * 200;
          const w = 26 + r() * 24;
          const drip = r() > 0.6;
          wrap(x, (px) => {
            stalactite(ctx, px, e(px), len, w, '#0b2630', '#184454');
            if (drip) fillPath(ctx, (c) => ellipse(c, px, e(px) + len + 18, 3, 5), rgba(ICE[2], 0.8));
          });
        }
        const y = hills(ctx, r, 680, 12, '#09202a', { col: '#1d5866', depth: 5 });
        for (const x of scatter(r, 4, 260)) {
          const h = 90 + r() * 60;
          wrap(x, (px) => spire(ctx, px, y(px) + 10, h, 60, '#0e2c36', '#081c23'));
        }
      },
      ground: (ctx, r) => groundTile(ctx, r, { lit: mix(ICE[2], ROCK[2], 0.45), body: mix(ROCK[1], '#184454', 0.45), shade: '#1b4f5e', deep: '#0d2632', edge: ICE[0], speck: ICE[3], pebble: mix(ROCK[1], '#184454', 0.2), ice: true }),
    },
  ],
  // ======================================================== camp 4 Clocktower Ridge
  [
    // ---- Gear Loft: inside the clock tower
    {
      sky: (ctx, r) => {
        blockWall(ctx, r, 0, H, 160, 64, ['#211b44', '#2b2350', '#3a2f66']);
        // the big clock face seen from inside, lit from behind by the dusk
        const cx = 640;
        const cy = 300;
        for (let i = 0; i < 4; i++) fillPath(ctx, (c) => circle(c, cx, cy, 250 - i * 14), rgba(SKY_DUSK[3], 0.06 + i * 0.03));
        fillPath(ctx, (c) => circle(c, cx, cy, 200), '#3a2c5e');
        fillPath(ctx, (c) => circle(c, cx, cy, 186), mix(SKY_DUSK[3], CREAM, 0.35));
        fillPath(ctx, (c) => circle(c, cx, cy, 186), rgba(SKY_DUSK[2], 0.25));
        ctx.strokeStyle = '#3a2c5e';
        ctx.lineWidth = 8;
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          ctx.moveTo(cx + Math.cos(a) * 150, cy + Math.sin(a) * 150);
          ctx.lineTo(cx + Math.cos(a) * 180, cy + Math.sin(a) * 180);
        }
        ctx.stroke();
        // frame spokes and the backs of the hands
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + Math.PI / 4;
          ctx.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
          ctx.lineTo(cx + Math.cos(a) * 186, cy + Math.sin(a) * 186);
        }
        ctx.stroke();
        strokePath(ctx, (c) => { c.moveTo(cx, cy); c.lineTo(cx - 70, cy - 90); c.moveTo(cx, cy); c.lineTo(cx + 110, cy + 30); }, '#2a2048', 16);
        fillPath(ctx, (c) => circle(c, cx, cy, 24), '#2a2048');
        // light shafts falling from the face
        for (const [x0, x1, a] of [[520, 760, 0.07], [600, 980, 0.05], [460, 560, 0.05]] as [number, number, number][]) {
          fillPath(ctx, (c) => poly(c, [x0, 380, x0 + 70, 380, x1 + 160, H, x1, H]), rgba(SKY_DUSK[3], a));
        }
      },
      far: (ctx, r) => {
        const col = mix(WOOD[0], '#2b2350', 0.45);
        const shade = mix(WOOD[0], '#1a1438', 0.6);
        const hub = mix(WOOD[1], '#2b2350', 0.4);
        // vertical beams
        for (let x = 160; x < W; x += 320) {
          fillPath(ctx, (c) => c.rect(x - 24, 0, 48, H), mix(WOOD[0], '#211b44', 0.55));
          fillPath(ctx, (c) => c.rect(x - 24, 0, 12, H), rgba(mix(WOOD[1], SKY_DUSK[2], 0.3), 0.35));
        }
        for (const [i, x] of scatter(r, 5, 230).entries()) {
          const R = 90 + r() * 70;
          const y = 160 + r() * 380;
          const rot = r() * TAU;
          wrap(x, (px) => gear(ctx, px, y, R, Math.round(R / 9), rot, i % 2 ? col : mix(col, ROCK[0], 0.3), shade, hub));
        }
        // horizontal shafts
        fillPath(ctx, (c) => c.rect(0, 120, W, 18), mix(WOOD[0], '#211b44', 0.5));
      },
      mid: (ctx, r) => {
        const col = mix(WOOD[1], SKY_DUSK[1], 0.45);
        const shade = mix(WOOD[0], SKY_DUSK[0], 0.45);
        const hub = mix(WOOD[2], SKY_DUSK[2], 0.35);
        for (const x of scatter(r, 4, 300)) {
          const R = 70 + r() * 50;
          const y = 260 + r() * 300;
          const rot = r() * TAU;
          const R2 = R * 0.55;
          wrap(x, (px) => {
            gear(ctx, px, y, R, Math.round(R / 8), rot, col, shade, hub);
            gear(ctx, px + R + R2 + 4, y + R * 0.5, R2, Math.round(R2 / 7), rot + 0.2, mix(col, ROCK[1], 0.25), shade, hub);
          });
        }
        // pendulum on a long rod and a hanging chain
        for (const x of scatter(r, 2, 600)) {
          wrap(x, (px) => {
            strokePath(ctx, (c) => { c.moveTo(px, 0); c.lineTo(px + 30, 520); }, mix(ROCK[1], SKY_DUSK[1], 0.4), 8);
            fillPath(ctx, (c) => circle(c, px + 31, 540, 40), mix(WARM[2], SKY_DUSK[1], 0.55));
            fillPath(ctx, (c) => circle(c, px + 22, 530, 14), rgba(SKY_DUSK[3], 0.45));
            for (let y = 0; y < 420; y += 18) strokePath(ctx, (c) => ellipse(c, px - 160, y, 5, 9), mix(ROCK[1], SKY_DUSK[1], 0.4), 3);
          });
        }
      },
      near: (ctx, r) => {
        const beam = mix(WOOD[0], INK, 0.35);
        const lit = mix(WOOD[1], SKY_DUSK[2], 0.3);
        // big foreground posts with cross braces under a top beam
        fillPath(ctx, (c) => c.rect(0, 0, W, 56), beam);
        fillPath(ctx, (c) => c.rect(0, 50, W, 6), lit);
        for (const x of scatter(r, 3, 380)) {
          wrap(x, (px) => {
            fillPath(ctx, (c) => c.rect(px - 32, 0, 64, H), beam);
            fillPath(ctx, (c) => c.rect(px - 32, 0, 12, H), lit);
            for (const d of [-1, 1]) {
              strokePath(ctx, (c) => { c.moveTo(px + d * 30, 200); c.lineTo(px + d * 160, 54); }, beam, 26);
            }
            for (const y of [120, 420]) fillPath(ctx, (c) => circle(c, px, y, 6), lit);
          });
        }
        // corner of a huge gear rising from below
        for (const x of scatter(r, 2, 600)) {
          const rot = r() * TAU;
          wrap(x, (px) => gear(ctx, px, 880, 210, 24, rot, mix(WOOD[0], SKY_DUSK[0], 0.4), mix(WOOD[0], INK, 0.5), lit));
        }
      },
      ground: (ctx, r) => plankFloor(ctx, r, {
        top: mix(WOOD[2], SKY_DUSK[1], 0.3), topLit: mix(WOOD[3], SKY_DUSK[3], 0.3), face: mix(WOOD[1], SKY_DUSK[1], 0.4),
        faceDark: mix(WOOD[0], SKY_DUSK[0], 0.4), seam: mix(WOOD[0], INK, 0.5), deep: '#1a1438',
      }),
    },
    // ---- Windy Hollow: wind-carved hollow at dusk
    {
      sky: (ctx, r) => {
        bandedSky(ctx, [SKY_DUSK[0], SKY_DUSK[1], SKY_DUSK[2], SKY_DUSK[3]], 0, 680);
        stars(ctx, r, 40, 180, SNOW[2], 0.03);
        for (let i = 0; i < 4; i++) fillPath(ctx, (c) => circle(c, 420, 580, 140 - i * 30), rgba(WARM[4], 0.08 + i * 0.07));
        // long wind-streaked clouds
        for (const x of scatter(r, 8, 140)) {
          const y = 180 + r() * 320;
          const len = 160 + r() * 180;
          wrap(x, (px) => {
            fillPath(ctx, (c) => ellipse(c, px, y, len, 7), rgba(SKY_DUSK[2], 0.55));
            fillPath(ctx, (c) => ellipse(c, px + 40, y + 5, len * 0.7, 4), rgba(SKY_DUSK[1], 0.4));
            fillPath(ctx, (c) => ellipse(c, px - 30, y - 4, len * 0.5, 2.5), rgba(SKY_DUSK[3], 0.5));
          });
        }
      },
      far: (ctx, r) => {
        const haze = mix(SKY_DUSK[2], SKY_DUSK[3], 0.4);
        const rock = mix(SKY_DUSK[0], SKY_DUSK[1], 0.3);
        const top = periodic(r, [[3, 26], [7, 12], [13, 6]]);
        const ty = (x: number) => 380 + top(x);
        fillPath(ctx, (c) => {
          c.moveTo(0, H);
          for (let x = 0; x <= W; x += 8) c.lineTo(x, ty(x));
          c.lineTo(W, H);
          c.closePath();
        }, rock);
        // horizontal wind-carved banding
        for (const [y, a] of [[470, 0.25], [520, 0.2], [575, 0.18]] as [number, number][]) {
          const wv = periodic(r, [[4, 6], [9, 3]]);
          fillPath(ctx, (c) => { for (let x = 0; x <= W; x += 8) c.lineTo(x, y - 40 + wv(x)); for (let x = W; x >= 0; x -= 8) c.lineTo(x, y - 40 + wv(x) + 10); c.closePath(); }, rgba(SKY_DUSK[2], a));
        }
        // arches: wind-scoured holes straight through the ridge
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        for (const x of scatter(r, 3, 360)) {
          const w = 60 + r() * 50;
          const h = 70 + r() * 40;
          wrap(x, (px) => fillPath(ctx, (c) => ellipse(c, px, ty(px) + h * 0.9 + 30, w, h), '#000'));
        }
        ctx.restore();
        // warm rim-light from the low sun, then snow drifted on the ledges
        fillPath(ctx, (c) => { for (let x = 0; x <= W; x += 8) c.lineTo(x, ty(x) - 3); for (let x = W; x >= 0; x -= 8) c.lineTo(x, ty(x) + 16); c.closePath(); }, rgba(SKY_DUSK[3], 0.55));
        fillPath(ctx, (c) => { for (let x = 0; x <= W; x += 8) c.lineTo(x, ty(x)); for (let x = W; x >= 0; x -= 8) c.lineTo(x, ty(x) + 8 + Math.sin(x / 40) * 3); c.closePath(); }, mix(SNOW[1], haze, 0.35));
      },
      mid: (ctx, r) => {
        const haze = SKY_DUSK[2];
        const y = hills(ctx, r, 580, 18, mix(SKY_DUSK[0], haze, 0.35), { col: mix(SNOW[0], SKY_DUSK[2], 0.35), depth: 7 });
        // hoodoos: stacked, wind-pinched pillars with cap stones
        for (const x of scatter(r, 7, 130)) {
          const h = 120 + r() * 140;
          const w = 44 + r() * 26;
          wrap(x, (px) => {
            const by = y(px) + 10;
            const col = mix(SKY_DUSK[1], haze, 0.3);
            const sh = mix(SKY_DUSK[0], haze, 0.3);
            fillPath(ctx, (c) => {
              c.moveTo(px - w / 2, by);
              c.bezierCurveTo(px - w * 0.15, by - h * 0.35, px - w * 0.6, by - h * 0.7, px - w * 0.25, by - h);
              c.lineTo(px + w * 0.25, by - h);
              c.bezierCurveTo(px + w * 0.6, by - h * 0.7, px + w * 0.15, by - h * 0.35, px + w / 2, by);
              c.closePath();
            }, col);
            fillPath(ctx, (c) => poly(c, [px + 2, by - h, px + w * 0.25, by - h, px + w * 0.45, by - h * 0.6, px + w / 2, by, px + w * 0.1, by]), sh);
            fillPath(ctx, (c) => ellipse(c, px, by - h - 6, w * 0.62, 16), mix(ROCK[0], SKY_DUSK[0], 0.4));
            fillPath(ctx, (c) => ellipse(c, px - 4, by - h - 16, w * 0.5, 8), mix(SNOW[2], SKY_DUSK[3], 0.3));
          });
        }
        // gusts
        for (const x of scatter(r, 5, 220)) {
          const yy = 340 + r() * 220;
          wrap(x, (px) => {
            const g = (c: Ctx) => { c.moveTo(px - 120, yy); c.bezierCurveTo(px - 40, yy - 20, px + 40, yy + 16, px + 90, yy - 4); c.arc(px + 90, yy - 18, 14, Math.PI / 2, -Math.PI * 0.9, true); };
            strokePath(ctx, g, rgba(SNOW[2], 0.35), 4);
          });
        }
      },
      near: (ctx, r) => {
        const y = hills(ctx, r, 672, 16, mix(SKY_DUSK[0], INK, 0.2), { col: mix(SNOW[0], SKY_DUSK[2], 0.3), depth: 7 });
        // leaning, wind-polished boulders
        for (const x of scatter(r, 5, 200)) {
          const s = 40 + r() * 30;
          wrap(x, (px) => {
            const by = y(px) + 12;
            fillPath(ctx, (c) => { c.moveTo(px - s * 1.5, by); c.bezierCurveTo(px - s * 1.6, by - s * 1.1, px + s * 0.4, by - s * 1.8, px + s * 1.5, by - s * 0.9); c.quadraticCurveTo(px + s * 1.7, by - s * 0.3, px + s * 1.4, by); c.closePath(); }, mix(ROCK[0], SKY_DUSK[0], 0.5));
            fillPath(ctx, (c) => { c.moveTo(px - s, by - s * 0.9); c.bezierCurveTo(px - s * 0.6, by - s * 1.5, px + s * 0.6, by - s * 1.6, px + s * 1.3, by - s * 1); c.quadraticCurveTo(px + s * 0.2, by - s * 1.2, px - s, by - s * 0.9); c.closePath(); }, mix(SNOW[2], SKY_DUSK[3], 0.3));
          });
        }
        // windswept grass tufts poking through the snow
        for (const x of scatter(r, 14, 70)) {
          const h = 30 + r() * 30;
          wrap(x, (px) => {
            const by = y(px) + 12;
            for (let k = -2; k <= 2; k++) strokePath(ctx, (c) => { c.moveTo(px + k * 4, by); c.quadraticCurveTo(px + k * 4 + 8, by - h * 0.6, px + k * 4 + h * 0.7, by - h * 0.9); }, mix(PINE[1], SKY_DUSK[1], 0.55), 3);
          });
        }
      },
      ground: (ctx, r) => groundTile(ctx, r, { lit: mix(SNOW[2], SKY_DUSK[3], 0.35), body: mix(SNOW[1], SKY_DUSK[2], 0.18), shade: mix(SNOW[0], SKY_DUSK[2], 0.3), deep: mix(VIOLET[2], SKY_DUSK[1], 0.45), edge: SKY_DUSK[1], speck: WARM[4], pebble: mix(ROCK[1], SKY_DUSK[0], 0.35) }),
    },
  ],
  // ======================================================== camp 5 The Summit
  [
    // ---- Aurora Shelf: open shelf under the aurora
    {
      sky: (ctx, r) => {
        bandedSky(ctx, [INK, '#1f1c52', '#2d2c72', '#3b3f8e'], 0, 760);
        stars(ctx, r, 260, 700, SNOW[2], 0.05);
        aurora(ctx, r, [[PINE[3], 150, 1.5], [ICE[2], 220, 1.2], ['#b48cf0', 290, 1.1], [PINE[3], 360, 0.7]], 130);
      },
      far: (ctx, r) => {
        const haze = '#3b3f8e';
        range(ctx, r, {
          peaks: scatter(r, 8, 130).map((x) => ({ x, h: 110 + r() * 120, w: 110 + r() * 60 })),
          baseY: 620, rock: mix(VIOLET[0], haze, 0.4), shadow: rgba(INK, 0.35),
          snow: mix(SNOW[0], VIOLET[3], 0.5), snowShadow: mix(VIOLET[2], haze, 0.4), cap: 0.4, jag: 8,
        });
        // valley mist far below
        for (let i = 0; i < 3; i++) fillPath(ctx, (c) => c.rect(0, 540 + i * 20, W, 500), rgba(VIOLET[3], 0.08));
      },
      mid: (ctx, r) => {
        const haze = VIOLET[0];
        const y = hills(ctx, r, 566, 8, mix(VIOLET[1], haze, 0.45), { col: mix(SNOW[0], VIOLET[2], 0.4), depth: 8 });
        // stone cairns marking the shelf
        for (const x of scatter(r, 4, 280)) {
          const n = 3 + Math.floor(r() * 2);
          wrap(x, (px) => {
            let yy = y(px) + 6;
            for (let k = 0; k < n; k++) {
              const s = 22 - k * 4;
              fillPath(ctx, (c) => ellipse(c, px + (k % 2 ? 3 : -2), yy - s * 0.5, s, s * 0.55), mix(ROCK[0], haze, 0.3));
              fillPath(ctx, (c) => ellipse(c, px + (k % 2 ? 3 : -2) - s * 0.3, yy - s * 0.85, s * 0.6, s * 0.18), mix(SNOW[0], VIOLET[3], 0.4));
              yy -= s * 0.95;
            }
          });
        }
        for (const x of scatter(r, 6, 160)) {
          const h = 70 + r() * 50;
          wrap(x, (px) => pine(ctx, px, y(px) + 12, h, pineCols(PINE[0], haze, 0.45, mix(SNOW[0], VIOLET[3], 0.3)), 3, 0.6));
        }
      },
      near: (ctx, r) => {
        const haze = VIOLET[0];
        const y = hills(ctx, r, 676, 12, mix(VIOLET[0], INK, 0.3), { col: mix(SNOW[0], VIOLET[2], 0.35), depth: 6 });
        for (const x of scatter(r, 4, 260)) {
          const s = 40 + r() * 30;
          wrap(x, (px) => {
            fillPath(ctx, (c) => poly(c, [px - s * 1.4, y(px) + 10, px - s, y(px) - s, px + s * 0.2, y(px) - s * 1.2, px + s * 1.3, y(px) - s * 0.4, px + s * 1.5, y(px) + 10]), mix(ROCK[0], INK, 0.3));
            fillPath(ctx, (c) => poly(c, [px - s, y(px) - s, px + s * 0.2, y(px) - s * 1.2, px + s * 0.5, y(px) - s * 0.95, px - s * 0.6, y(px) - s * 0.78]), mix(SNOW[0], VIOLET[3], 0.35));
          });
        }
        for (const x of scatter(r, 4, 260)) {
          const h = 170 + r() * 80;
          wrap(x, (px) => pine(ctx, px, y(px) + 14, h, pineCols(mix(PINE[0], INK, 0.3), haze, 0.15, mix(SNOW[0], VIOLET[3], 0.4)), 4, 0.7));
        }
      },
      ground: (ctx, r) => groundTile(ctx, r, { lit: mix(SNOW[1], VIOLET[3], 0.3), body: mix(SNOW[0], VIOLET[2], 0.35), shade: mix(VIOLET[2], VIOLET[1], 0.4), deep: VIOLET[1], edge: VIOLET[0], speck: PINE[3], pebble: mix(ROCK[1], VIOLET[0], 0.3) }),
    },
    // ---- Star Cavern: dark cavern with star-like glowing dots
    {
      sky: (ctx, r) => {
        bandedSky(ctx, ['#07061a', '#0c0a24', '#110e30', '#16133c'], 0, 900);
        // glowing dots like a night sky inside the rock
        for (let i = 0; i < 260; i++) {
          const x = r() * W;
          const y = r() * 860;
          const s = 1 + Math.pow(r(), 3) * 3.5;
          const col = GLOW[Math.floor(r() * GLOW.length)];
          const a = 0.45 + r() * 0.55;
          wrap(x, (px) => glowDot(ctx, px, y, s, col, a));
        }
        // a few little "constellations"
        for (let k = 0; k < 4; k++) {
          const x = r() * W;
          const y = 80 + r() * 440;
          const pts = [0, 0, ...Array.from({ length: 4 }, () => [(r() - 0.3) * 90, (r() - 0.5) * 70]).flat()];
          for (let i = 2; i < pts.length; i += 2) {
            pts[i] += pts[i - 2];
            pts[i + 1] += pts[i - 1];
          }
          wrap(x, (px) => {
            strokePath(ctx, (c) => poly(c, pts.map((v, i) => v + (i % 2 ? y : px)), false), rgba(ICE[3], 0.18), 1.6);
            for (let i = 0; i < pts.length; i += 2) {
              glowDot(ctx, px + pts[i], y + pts[i + 1], 2.4, WARM[4]);
              fillPath(ctx, (c) => star4(c, px + pts[i], y + pts[i + 1], 7, 0.25), rgba(CREAM, 0.7));
            }
          });
        }
      },
      far: (ctx, r) => {
        for (const x of scatter(r, 6, 170)) {
          const w = 40 + r() * 50;
          const dots = Array.from({ length: 10 }, () => [r() * 2 - 1, r(), r()]);
          wrap(x, (px) => {
            fillPath(ctx, (c) => poly(c, [px - w, H, px - w * 0.6, 0, px + w * 0.6, 0, px + w, H]), '#120f2c');
            fillPath(ctx, (c) => poly(c, [px + w * 0.1, H, px + w * 0.1, 0, px + w * 0.6, 0, px + w, H]), '#0d0b22');
            for (const [a, b, t] of dots) glowDot(ctx, px + a * w * 0.6, b * 760, 1.4 + t, GLOW[Math.floor(t * 4.99)], 0.8);
          });
        }
        hills(ctx, r, 560, 20, '#110e2a');
      },
      mid: (ctx, r) => {
        const y = hills(ctx, r, 570, 26, '#0f0c26', { col: '#24205a', depth: 5 });
        for (const x of scatter(r, 8, 120)) {
          const h = 60 + r() * 120;
          const dots = Array.from({ length: 4 }, () => [r() - 0.5, r(), r()]);
          wrap(x, (px) => {
            spire(ctx, px, y(px) + 6, h, h * 0.5, '#151236', '#0c0a24');
            for (const [a, b, t] of dots) glowDot(ctx, px + a * h * 0.3, y(px) - b * h * 0.8, 1.6 + t * 1.6, GLOW[Math.floor(t * 4.99)]);
          });
        }
        // glowing crystal buds in the floor
        for (const x of scatter(r, 6, 180)) {
          const tilt = r() * 0.6 - 0.3;
          wrap(x, (px) => {
            for (let k = 0; k < 3; k++) fillPath(ctx, (c) => ellipse(c, px, y(px) - 6, 40 - k * 12, 22 - k * 6), rgba(ICE[2], 0.06));
            crystal(ctx, px, y(px) + 4, 34, tilt, [mix(ICE[0], INK, 0.3), ICE[1], ICE[3]]);
          });
        }
      },
      near: (ctx, r) => {
        const e = ceiling(ctx, r, 44, 20, '#06051a', '#16133c');
        for (const x of scatter(r, 16, 70)) {
          const len = 60 + r() * 180;
          const w = 22 + r() * 24;
          const col = GLOW[Math.floor(r() * 3)];
          wrap(x, (px) => {
            stalactite(ctx, px, e(px), len, w, '#0b0922', '#1d1948');
            // glow-worm thread with a bead of light
            strokePath(ctx, (c) => { c.moveTo(px, e(px) + len); c.lineTo(px, e(px) + len + 26); }, rgba(ICE[3], 0.35), 1.4);
            glowDot(ctx, px, e(px) + len + 28, 3, col);
          });
        }
        const y = hills(ctx, r, 678, 12, '#08071c', { col: '#1d1948', depth: 5 });
        for (const x of scatter(r, 4, 260)) {
          const h = 80 + r() * 60;
          wrap(x, (px) => spire(ctx, px, y(px) + 10, h, 56, '#0e0c28', '#07061a'));
        }
      },
      ground: (ctx, r) => groundTile(ctx, r, { lit: mix(VIOLET[1], VIOLET[2], 0.35), body: '#2e2a64', shade: '#221e52', deep: '#141136', edge: INK2, speck: ICE[2], pebble: '#3a3680', ice: true }),
    },
  ],
];

const LAYER_ORDER = ['sky', 'far', 'mid', 'near', 'ground'] as const;

/** Number of zones with side areas (each has areas 1 and 2). */
export const AREA_ZONES = AREAS.length;

/** Display names of the side areas: AREA_NAMES[zone][area - 1]. */
export const AREA_NAMES: [string, string][] = [
  ['Bramble Hollow', 'High Shelf'], ['Hush Grove', 'Frozen Den'], ['Crystal Gallery', 'Echo Pool'],
  ['Gear Loft', 'Windy Hollow'], ['Aurora Shelf', 'Star Cavern'],
];

/** Paint one layer of a side area (area 1 or 2). Deterministic. */
export function buildAreaLayer(zone: number, area: number, layer: BgLayer): SheetSpec {
  const li = LAYER_ORDER.indexOf(layer);
  const [c, ctx] = makeCanvas(W, layer === 'ground' ? 320 : H);
  AREAS[zone][area - 1][layer](ctx, rng(5000 + zone * 97 + area * 31 + li * 13));
  return { key: areaBgKey(zone, area, layer), canvas: c };
}

/** Every layer of every side area (preview page only; the game paints them on demand). */
export function buildAreaBackgrounds(): { sheets: SheetSpec[] } {
  const sheets: SheetSpec[] = [];
  for (let z = 0; z < AREAS.length; z++) for (const a of [1, 2]) for (const l of LAYER_ORDER) sheets.push(buildAreaLayer(z, a, l));
  return { sheets };
}
