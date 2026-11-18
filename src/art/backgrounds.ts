// Parallax backgrounds: 5 zones x 5 layers. Every layer is 1280 wide and tiles
// horizontally: shapes come from periodic functions or are drawn wrapped at x-1280/x/x+1280.
import { bgKey, BgLayer } from './keys';
import {
  INK, INK2, VIOLET, SNOW, ICE, PINE, ROCK, SKY_DAY, SKY_DUSK, WARM, BERRY, CREAM, mix, rgba, ramp,
} from './palette';
import { Ctx, SheetSpec, makeCanvas, rng, ellipse, circle, poly, fillPath, star4, TAU, lerp } from './draw';

export const W = 1280;
export const H = 960;
const GROUND_LINE = 640; // where the play-layer surface sits on screen

// ---------------------------------------------------------------- helpers

export type Rand = () => number;

/** Periodic 1-D noise on [0, W): sum of integer-frequency sines (seamless by construction). */
export function periodic(r: Rand, terms: [number, number][]): (x: number) => number {
  const ph = terms.map(() => r() * TAU);
  return (x: number) => terms.reduce((s, [k, a], i) => s + a * Math.sin((TAU * k * x) / W + ph[i]), 0);
}

/** Draw `fn` at x, x-W and x+W so anything crossing an edge wraps. */
export function wrap(x: number, fn: (x: number) => void): void {
  fn(x);
  if (x < W * 0.5) fn(x + W);
  else fn(x - W);
}

/** Signed wrapped distance from a to b on the period W. */
export function wdist(a: number, b: number): number {
  let d = (a - b) % W;
  if (d > W / 2) d -= W;
  if (d < -W / 2) d += W;
  return d;
}

/** 8 flat bands between stops (y positions) sampling a colour ramp. */
export function bandedSky(ctx: Ctx, cols: readonly string[], top = 0, bottom = 700): void {
  const edges = [0, 0.13, 0.26, 0.38, 0.5, 0.62, 0.74, 0.87, 1];
  for (let i = 0; i < 8; i++) {
    const y0 = lerp(top, bottom, Math.pow(edges[i], 0.9));
    const y1 = i === 7 ? H : lerp(top, bottom, Math.pow(edges[i + 1], 0.9));
    ctx.fillStyle = ramp(cols, i / 7);
    ctx.fillRect(0, Math.floor(y0), W, Math.ceil(y1 - y0) + 1);
  }
}

export interface Peak { x: number; h: number; w: number }

/** A mountain range layer: peaks (with snow caps and a shadowed right flank) on a base line. */
export function range(
  ctx: Ctx,
  r: Rand,
  o: {
    peaks: Peak[];
    baseY: number;
    rock: string;
    shadow: string;
    snow: string;
    snowShadow: string;
    cap: number; // 0..1 fraction of height capped with snow
    jag: number; // ridge roughness
    sharp?: number;
  },
): void {
  const noise = periodic(r, [[7, o.jag], [13, o.jag * 0.6], [23, o.jag * 0.35], [41, o.jag * 0.2]]);
  const ridge = (x: number) => {
    let best = 0;
    for (const p of o.peaks) {
      const d = Math.abs(wdist(x, p.x));
      const t = Math.max(0, 1 - d / p.w);
      best = Math.max(best, p.h * Math.pow(t, o.sharp ?? 1.15));
    }
    return o.baseY - best + noise(x) * Math.min(1, best / 60);
  };
  const step = 4;
  const sil = (c: Ctx) => {
    c.moveTo(0, H);
    for (let x = 0; x <= W; x += step) c.lineTo(x, ridge(x));
    c.lineTo(W, H);
    c.closePath();
  };
  fillPath(ctx, sil, o.rock);
  ctx.save();
  ctx.beginPath();
  sil(ctx);
  ctx.clip();
  for (const p of o.peaks) {
    wrap(p.x, (px) => {
      const apexY = o.baseY - p.h;
      // snow cap with a zig-zag lower edge
      if (o.cap > 0) {
        const capY = apexY + p.h * o.cap;
        const cw = p.w * (o.cap + 0.08);
        ctx.beginPath();
        ctx.moveTo(px - cw, apexY - 40);
        ctx.lineTo(px + cw, apexY - 40);
        const n = 9;
        for (let i = n; i >= 0; i--) {
          const x = px - cw + (2 * cw * i) / n;
          const edge = 1 - Math.abs(x - px) / cw;
          const y = lerp(apexY, capY, 0.35 + 0.65 * edge) + (i % 2 ? p.h * 0.06 : -p.h * 0.03);
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = o.snow;
        ctx.fill();
      }
      // shadowed right flank (light from the upper left)
      ctx.beginPath();
      ctx.moveTo(px, apexY - 4);
      ctx.lineTo(px + p.w * 1.05, o.baseY);
      ctx.lineTo(px + p.w * 0.9, H);
      ctx.lineTo(px + p.w * 0.12, H);
      ctx.lineTo(px + p.w * 0.08, apexY + p.h * 0.45);
      ctx.closePath();
      ctx.fillStyle = o.shadow;
      ctx.fill();
      if (o.cap > 0) {
        // snow in shadow
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(px, apexY - 4);
        ctx.lineTo(px + p.w, o.baseY);
        ctx.lineTo(px + p.w * 0.08, apexY + p.h * 0.45);
        ctx.closePath();
        ctx.clip();
        const capY = apexY + p.h * o.cap;
        const cw = p.w * (o.cap + 0.08);
        ctx.beginPath();
        ctx.moveTo(px, apexY - 40);
        ctx.lineTo(px + cw, apexY - 40);
        const n = 9;
        for (let i = n; i >= 0; i--) {
          const x = px - cw + (2 * cw * i) / n;
          const edge = 1 - Math.abs(x - px) / cw;
          const y = lerp(apexY, capY, 0.35 + 0.65 * edge) + (i % 2 ? p.h * 0.06 : -p.h * 0.03);
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = o.snowShadow;
        ctx.fill();
        ctx.restore();
      }
    });
  }
  ctx.restore();
}

/** Rolling hill band (periodic) filled to the bottom. Returns the height function. */
export function hills(ctx: Ctx, r: Rand, baseY: number, amp: number, col: string, top?: { col: string; depth: number }): (x: number) => number {
  const f = periodic(r, [[2, amp * 0.6], [3, amp * 0.4], [5, amp * 0.25], [9, amp * 0.1]]);
  const y = (x: number) => baseY + f(x);
  const path = (c: Ctx) => {
    c.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) c.lineTo(x, y(x));
    c.lineTo(W, H);
    c.closePath();
  };
  fillPath(ctx, path, col);
  if (top) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y(x));
    for (let x = W; x >= 0; x -= 8) ctx.lineTo(x, y(x) + top.depth);
    ctx.closePath();
    ctx.fillStyle = top.col;
    ctx.fill();
  }
  return y;
}

export interface PineCols { body: string; dark: string; snow: string; snowShade: string; trunk: string }

/** Tiered pine with snow on each tier. (x, baseY) = trunk foot. */
export function pine(ctx: Ctx, x: number, baseY: number, h: number, c: PineCols, tiers = 4, laden = 0.5, outline?: string): void {
  const w = h * 0.42;
  const trunkH = h * 0.1;
  ctx.fillStyle = c.trunk;
  ctx.fillRect(x - w * 0.07, baseY - trunkH - 2, w * 0.14, trunkH + 2);
  const top = baseY - h;
  for (let t = 0; t < tiers; t++) {
    const k = t / tiers;
    const ty = lerp(top, baseY - trunkH - h * 0.18, k);
    const by = ty + h * (0.38 - k * 0.04) + h * 0.06;
    const tw = w * (0.38 + 0.62 * ((t + 1) / tiers));
    const tier = (cc: Ctx) => {
      cc.moveTo(x, ty);
      cc.lineTo(x + tw / 2, by);
      cc.quadraticCurveTo(x, by + h * 0.05, x - tw / 2, by);
      cc.closePath();
    };
    if (outline) {
      ctx.beginPath();
      tier(ctx);
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = outline;
      ctx.stroke();
    }
    fillPath(ctx, tier, c.body);
    // shaded right half
    fillPath(ctx, (cc) => {
      cc.moveTo(x, ty);
      cc.lineTo(x + tw / 2, by);
      cc.quadraticCurveTo(x + tw * 0.2, by + h * 0.035, x + tw * 0.04, by + h * 0.04);
      cc.closePath();
    }, c.dark);
    // snow load on the tier
    if (laden > 0) {
      const sy = lerp(ty, by, t === 0 ? 0.22 + 0.1 * laden : 0.1 + 0.1 * laden);
      const sw = (tw / 2) * ((sy - ty) / (by - ty)) * 1.15;
      const snow = (cc: Ctx) => {
        cc.moveTo(x, ty - 1);
        cc.lineTo(x + sw, sy);
        cc.quadraticCurveTo(x + sw * 0.6, sy + h * 0.04 * laden + 3, x + sw * 0.3, sy + 1);
        cc.quadraticCurveTo(x, sy + h * 0.05 * laden + 4, x - sw * 0.4, sy + 1);
        cc.quadraticCurveTo(x - sw * 0.7, sy + h * 0.035 * laden + 3, x - sw, sy);
        cc.closePath();
      };
      fillPath(ctx, snow, c.snow);
      ctx.save();
      ctx.beginPath();
      snow(ctx);
      ctx.clip();
      fillPath(ctx, (cc) => cc.rect(x, ty - 2, sw + 2, h), c.snowShade);
      ctx.restore();
    }
  }
}

export function pineCols(body: string, haze: string, t: number, snow: string = SNOW[2]): PineCols {
  return {
    body: mix(body, haze, t),
    dark: mix(mix(body, VIOLET[0], 0.45), haze, t),
    snow: mix(snow, haze, t * 0.6),
    snowShade: mix(VIOLET[3], haze, t * 0.6),
    trunk: mix(mix(ROCK[0], INK, 0.2), haze, t),
  };
}

/** Scatter positions [0, W) with a minimum spacing (deterministic). */
export function scatter(r: Rand, n: number, minGap: number): number[] {
  const xs: number[] = [];
  let tries = 0;
  while (xs.length < n && tries++ < n * 40) {
    const x = r() * W;
    if (xs.every((o) => Math.abs(wdist(o, x)) >= minGap)) xs.push(x);
  }
  return xs.sort((a, b) => a - b);
}

export function stars(ctx: Ctx, r: Rand, n: number, maxY: number, col: string, big = 0): void {
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = Math.pow(r(), 1.3) * maxY;
    const s = r();
    ctx.fillStyle = rgba(col, 0.45 + s * 0.55);
    if (s > 1 - big) {
      wrap(x, (px) => fillPath(ctx, (c) => star4(c, px, y, 5 + s * 4, 0.25), rgba(col, 0.9)));
    } else {
      ctx.fillRect(Math.floor(x), Math.floor(y), s > 0.6 ? 3 : 2, s > 0.6 ? 3 : 2);
    }
  }
}

export function cloud(ctx: Ctx, x: number, y: number, s: number, col: string, shade: string): void {
  const puffs: [number, number, number][] = [[-50, 8, 26], [-20, -8, 34], [20, -14, 30], [52, 4, 24], [0, 10, 30]];
  fillPath(ctx, (c) => {
    for (const [dx, dy, r] of puffs) circle(c, x + dx * s, y + dy * s + 6 * s, r * s);
  }, shade);
  fillPath(ctx, (c) => {
    for (const [dx, dy, r] of puffs) circle(c, x + dx * s - 3 * s, y + dy * s, r * s);
  }, col);
}

// ---------------------------------------------------------------- ground tile

export interface GroundOpts { lit: string; body: string; shade: string; deep: string; edge: string; speck: string; pebble?: string; ice?: boolean }

export function groundTile(ctx: Ctx, r: Rand, o: GroundOpts): void {
  const TOP = 60;
  // drift bumps above the walk line (max ~8 px), periodic so the tile wraps
  const bumps = periodic(r, [[3, 1], [5, 1], [8, 0.8], [13, 0.5]]);
  const surf = (x: number) => TOP - Math.max(0, bumps(x) * 2.6 - 1.5);
  const band = (y0: number, amp: number, k: number, col: string) => {
    const wv = periodic(r, [[k, amp], [k * 2 + 1, amp * 0.5]]);
    ctx.beginPath();
    ctx.moveTo(0, 320);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y0 + wv(x));
    ctx.lineTo(W, 320);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  };
  // body
  ctx.beginPath();
  ctx.moveTo(0, 320);
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, surf(x));
  ctx.lineTo(W, 320);
  ctx.closePath();
  ctx.fillStyle = o.body;
  ctx.fill();
  band(110, 8, 4, mix(o.body, o.shade, 0.5));
  band(160, 10, 3, o.shade);
  band(235, 12, 5, mix(o.shade, o.deep, 0.5));
  band(290, 8, 6, o.deep);
  // lit crust on top
  ctx.beginPath();
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, surf(x));
  for (let x = W; x >= 0; x -= 4) ctx.lineTo(x, surf(x) + 12 + Math.sin((x * TAU * 9) / W) * 2);
  ctx.closePath();
  ctx.fillStyle = o.lit;
  ctx.fill();
  // crisp top edge
  ctx.beginPath();
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, surf(x));
  ctx.lineWidth = 4;
  ctx.strokeStyle = o.edge;
  ctx.stroke();
  // pebbles / ice chunks poking out
  if (o.pebble) {
    // half-buried stones (or ice chunks) with a snow-dusted top, kept sparse
    for (const x of scatter(r, 5, 200)) {
      const y = 140 + r() * 120;
      const s = 7 + r() * 8;
      wrap(x, (px) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(px - s * 2, y - s * 2, s * 4, s * 2 + 2);
        ctx.clip();
        fillPath(ctx, (c) => ellipse(c, px, y, s * 1.5, s), o.pebble!);
        fillPath(ctx, (c) => ellipse(c, px + s * 0.5, y + s * 0.1, s, s * 0.7), rgba(VIOLET[0], 0.25));
        fillPath(ctx, (c) => ellipse(c, px - s * 0.2, y - s * 0.75, s * 1.05, s * 0.38), o.ice ? ICE[3] : o.lit);
        ctx.restore();
        // soft drift line where it meets the snow
        fillPath(ctx, (c) => ellipse(c, px, y + 1, s * 1.9, 2.5), rgba(o.shade, 0.9));
      });
    }
  }
  // sparkles in the snow
  for (let i = 0; i < 70; i++) {
    const x = r() * W;
    const y = 76 + r() * 220;
    ctx.fillStyle = rgba(o.speck, 0.35 + r() * 0.5);
    ctx.fillRect(Math.floor(x), Math.floor(y), 2, 2);
  }
  for (const x of scatter(r, 6, 160)) {
    const y = 72 + r() * 30;
    wrap(x, (px) => fillPath(ctx, (c) => star4(c, px, y, 5, 0.25), rgba(CREAM, 0.9)));
  }
}

// ---------------------------------------------------------------- zones

export type Layers = Record<'sky' | 'far' | 'mid' | 'near' | 'ground', (ctx: Ctx, r: Rand) => void>;

export function village(ctx: Ctx, r: Rand, hillY: (x: number) => number, haze: string): void {
  const xs = scatter(r, 9, 110);
  for (const x0 of xs) {
    const w = 70 + r() * 46;
    const h = 54 + r() * 30;
    const roofH = 40 + r() * 22;
    const wall = mix(['#8a92d8', '#9a94b8', '#7f86c8'][Math.floor(r() * 3)], haze, 0.1);
    const chimney = r() > 0.4;
    const lit = r() > 0.25;
    wrap(x0, (x) => {
      const by = hillY(x) + 14;
      const ty = by - h;
      fillPath(ctx, (c) => c.rect(x - w / 2, ty, w, h + 20), wall);
      fillPath(ctx, (c) => c.rect(x + w * 0.1, ty, w * 0.4, h + 20), mix(wall, VIOLET[0], 0.25));
      if (chimney) fillPath(ctx, (c) => c.rect(x + w * 0.18, ty - roofH * 0.9, 10, roofH * 0.6), mix(ROCK[1], haze, 0.2));
      // roof
      fillPath(ctx, (c) => poly(c, [x - w / 2 - 8, ty + 2, x, ty - roofH, x + w / 2 + 8, ty + 2]), mix(VIOLET[0], haze, 0.3));
      // snow on the roof
      fillPath(ctx, (c) => poly(c, [x - w / 2 - 10, ty + 1, x, ty - roofH - 3, x + w / 2 + 10, ty + 1, x + w / 2 - 4, ty + 7, x, ty - roofH + 9, x - w / 2 + 2, ty + 8]), mix(SNOW[2], haze, 0.15));
      fillPath(ctx, (c) => poly(c, [x, ty - roofH - 3, x + w / 2 + 10, ty + 1, x + w / 2 - 4, ty + 7, x, ty - roofH + 9]), mix(SNOW[0], haze, 0.15));
      // tiny warm windows
      const wy = ty + h * 0.32;
      for (const dx of w > 70 ? [-w * 0.26, w * 0.18] : [-w * 0.12]) {
        fillPath(ctx, (c) => c.rect(x + dx - 6, wy - 2, 13, 13), mix(INK2, haze, 0.2));
        fillPath(ctx, (c) => c.rect(x + dx - 4, wy, 9, 9), lit ? WARM[3] : mix(VIOLET[1], haze, 0.2));
        if (lit) fillPath(ctx, (c) => c.rect(x + dx - 4, wy, 4, 4), WARM[4]);
      }
    });
  }
}

export function clockTower(ctx: Ctx, x: number, baseY: number, col: string, shade: string, face: string): void {
  const w = 54;
  const h = 250;
  fillPath(ctx, (c) => c.rect(x - w / 2, baseY - h, w, h + 40), col);
  fillPath(ctx, (c) => c.rect(x + 4, baseY - h, w / 2 - 4, h + 40), shade);
  // belfry ledge + roof spire
  fillPath(ctx, (c) => c.rect(x - w / 2 - 8, baseY - h - 6, w + 16, 12), shade);
  fillPath(ctx, (c) => poly(c, [x - w / 2 - 6, baseY - h - 6, x, baseY - h - 110, x + w / 2 + 6, baseY - h - 6]), col);
  fillPath(ctx, (c) => poly(c, [x, baseY - h - 110, x + w / 2 + 6, baseY - h - 6, x + 4, baseY - h - 6]), shade);
  // clock
  const cy = baseY - h + 40;
  fillPath(ctx, (c) => circle(c, x, cy, 20), shade);
  fillPath(ctx, (c) => circle(c, x, cy, 16), face);
  ctx.strokeStyle = shade;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(x, cy - 11);
  ctx.moveTo(x, cy);
  ctx.lineTo(x + 8, cy + 3);
  ctx.stroke();
  // windows
  for (const yy of [baseY - h + 100, baseY - h + 160]) fillPath(ctx, (c) => c.rect(x - 6, yy, 12, 22), shade);
}

export function crystal(ctx: Ctx, x: number, baseY: number, h: number, tilt: number, cols: [string, string, string]): void {
  const w = h * 0.28;
  ctx.save();
  ctx.translate(x, baseY);
  ctx.rotate(tilt);
  fillPath(ctx, (c) => poly(c, [-w / 2, 0, -w / 2, -h * 0.75, 0, -h, w / 2, -h * 0.75, w / 2, 0]), cols[1]);
  fillPath(ctx, (c) => poly(c, [0, 0, 0, -h, w / 2, -h * 0.75, w / 2, 0]), cols[0]);
  fillPath(ctx, (c) => poly(c, [-w / 2 + 3, -h * 0.1, -w / 2 + 3, -h * 0.72, -w * 0.12, -h * 0.82, -w * 0.12, -h * 0.1]), cols[2]);
  ctx.restore();
}

export function icicle(ctx: Ctx, x: number, topY: number, len: number, w: number, col: string, light: string): void {
  fillPath(ctx, (c) => poly(c, [x - w / 2, topY, x + w / 2, topY, x, topY + len]), col);
  fillPath(ctx, (c) => poly(c, [x - w / 2 + 2, topY, x - w * 0.1, topY, x - w * 0.05, topY + len * 0.75]), light);
}

const ZONES: Layers[] = [
  // 0 Lantern Meadow
  {
    sky: (ctx, r) => {
      bandedSky(ctx, [SKY_DAY[0], SKY_DAY[1], SKY_DAY[2], '#e4f1ff', SKY_DAY[3]], 0, 640);
      // soft sun glow, banded
      for (let i = 0; i < 4; i++) fillPath(ctx, (c) => circle(c, 300, 170, 110 - i * 24), rgba(SKY_DAY[3], 0.12 + i * 0.08));
      for (const x of scatter(r, 5, 220)) {
        const y = 90 + r() * 200;
        const s = 0.8 + r() * 0.7;
        wrap(x, (px) => cloud(ctx, px, y, s, mix(SNOW[2], SKY_DAY[2], 0.1), mix(SKY_DAY[2], VIOLET[3], 0.5)));
      }
    },
    far: (ctx, r) => {
      const haze = SKY_DAY[2];
      range(ctx, r, {
        peaks: [{ x: 120, h: 260, w: 260 }, { x: 420, h: 330, w: 300 }, { x: 760, h: 240, w: 230 }, { x: 1040, h: 300, w: 280 }],
        baseY: 560, rock: mix(VIOLET[2], haze, 0.55), shadow: rgba(mix(VIOLET[1], haze, 0.4), 0.45),
        snow: mix(SNOW[2], haze, 0.2), snowShadow: mix(VIOLET[3], haze, 0.35), cap: 0.38, jag: 8,
      });
    },
    mid: (ctx, r) => {
      const haze = SKY_DAY[2];
      const y = hills(ctx, r, 556, 20, mix(SNOW[0], haze, 0.25), { col: mix(SNOW[2], haze, 0.2), depth: 10 });
      for (const x of scatter(r, 10, 70)) {
        const h = 60 + r() * 50;
        wrap(x, (px) => pine(ctx, px, y(px) + 10, h, pineCols(PINE[1], haze, 0.5), 3, 0.5));
      }
      village(ctx, r, y, haze);
    },
    near: (ctx, r) => {
      const haze = SKY_DAY[2];
      const y = hills(ctx, r, 630, 16, mix(SNOW[1], VIOLET[3], 0.3), { col: SNOW[2], depth: 8 });
      for (const x of scatter(r, 5, 180)) {
        const h = 190 + r() * 110;
        wrap(x, (px) => pine(ctx, px, y(px) + 12, h, pineCols(PINE[1], haze, 0.08), 4, 0.6));
      }
    },
    ground: (ctx, r) => groundTile(ctx, r, { lit: SNOW[2], body: SNOW[1], shade: SNOW[0], deep: VIOLET[3], edge: VIOLET[2], speck: CREAM, pebble: mix(ROCK[2], SNOW[0], 0.3) }),
  },
  // 1 Frostpine Forest
  {
    sky: (ctx, r) => {
      bandedSky(ctx, ['#3d5fb8', '#5b86d6', '#86b4ec', ICE[3]], 0, 620);
      // shafts of soft light
      for (const x of scatter(r, 4, 260)) {
        wrap(x, (px) => fillPath(ctx, (c) => poly(c, [px - 30, 0, px + 40, 0, px + 160, 700, px + 60, 700]), rgba(ICE[3], 0.12)));
      }
    },
    far: (ctx, r) => {
      const haze = '#a9cdf2';
      range(ctx, r, {
        peaks: [{ x: 300, h: 250, w: 320 }, { x: 900, h: 290, w: 340 }],
        baseY: 520, rock: mix(VIOLET[2], haze, 0.6), shadow: rgba(VIOLET[1], 0.25),
        snow: mix(SNOW[2], haze, 0.35), snowShadow: mix(VIOLET[3], haze, 0.4), cap: 0.4, jag: 6,
      });
      const y = hills(ctx, r, 560, 10, mix(PINE[1], haze, 0.72));
      for (let i = 0, xs = scatter(r, 34, 30); i < xs.length; i++) {
        const h = 90 + r() * 70;
        wrap(xs[i], (px) => pine(ctx, px, y(px) + 30, h, pineCols(PINE[1], haze, 0.7), 3, 0.4));
      }
    },
    mid: (ctx, r) => {
      const haze = '#a9cdf2';
      const y = hills(ctx, r, 610, 12, mix(SNOW[0], haze, 0.35));
      for (const x of scatter(r, 22, 48)) {
        const h = 200 + r() * 110;
        wrap(x, (px) => pine(ctx, px, y(px) + 20, h, pineCols(PINE[1], haze, 0.42), 5, 0.7));
      }
    },
    near: (ctx, r) => {
      const haze = '#a9cdf2';
      const y = hills(ctx, r, 660, 10, mix(SNOW[1], VIOLET[3], 0.35), { col: SNOW[2], depth: 6 });
      for (const x of scatter(r, 8, 140)) {
        const h = 380 + r() * 160;
        wrap(x, (px) => pine(ctx, px, y(px) + 16, h, pineCols(PINE[0], haze, 0.06), 6, 0.9));
      }
    },
    ground: (ctx, r) => groundTile(ctx, r, { lit: mix(SNOW[2], ICE[3], 0.35), body: SNOW[1], shade: mix(SNOW[0], ICE[2], 0.25), deep: VIOLET[3], edge: VIOLET[2], speck: ICE[3], pebble: mix(PINE[1], VIOLET[2], 0.5) }),
  },
  // 2 Glimmer Caves ('sky' = cave back wall)
  {
    sky: (ctx, r) => {
      bandedSky(ctx, ['#0d2230', '#123543', '#1a4a57', '#21606a'], 0, 760);
      // rock blotches
      for (let i = 0; i < 60; i++) {
        const x = r() * W;
        const y = r() * H;
        const s = 20 + r() * 70;
        const rot = r() * 0.6 - 0.3;
        wrap(x, (px) => fillPath(ctx, (c) => ellipse(c, px, y, s * 1.4, s * 0.8, rot), rgba(i % 3 ? '#0a1c28' : '#2a6e78', 0.35)));
      }
      // faint crystal glints in the wall
      for (let i = 0; i < 40; i++) {
        const x = r() * W;
        const y = 60 + r() * 640;
        const s = 3 + r() * 5;
        const a = 0.25 + r() * 0.4;
        wrap(x, (px) => fillPath(ctx, (c) => star4(c, px, y, s, 0.3), rgba(ICE[2], a)));
      }
    },
    far: (ctx, r) => {
      // distant columns and stalagmites
      const col = '#1f5763';
      const shade = '#18454f';
      for (const x of scatter(r, 7, 150)) {
        const w = 40 + r() * 50;
        wrap(x, (px) => {
          fillPath(ctx, (c) => poly(c, [px - w, H, px - w * 0.6, 0, px + w * 0.6, 0, px + w, H]), col);
          fillPath(ctx, (c) => poly(c, [px + w * 0.1, H, px + w * 0.1, 0, px + w * 0.6, 0, px + w, H]), shade);
        });
      }
      const y = hills(ctx, r, 560, 20, col);
      for (const x of scatter(r, 14, 70)) {
        const h = 50 + r() * 130;
        wrap(x, (px) => {
          fillPath(ctx, (c) => poly(c, [px - h * 0.22, y(px) + 20, px, y(px) - h, px + h * 0.22, y(px) + 20]), col);
          fillPath(ctx, (c) => poly(c, [px, y(px) - h, px + h * 0.22, y(px) + 20, px + 2, y(px) + 20]), shade);
        });
      }
      for (const x of scatter(r, 8, 120)) {
        const h = 30 + r() * 40;
        const tilt = r() * 0.6 - 0.3;
        wrap(x, (px) => crystal(ctx, px, y(px) + 6, h, tilt, [mix(ICE[1], '#1f5763', 0.55), mix(ICE[2], '#1f5763', 0.5), mix(ICE[3], '#1f5763', 0.4)]));
      }
    },
    mid: (ctx, r) => {
      const y = hills(ctx, r, 610, 26, '#173f4a', { col: '#2a6b74', depth: 6 });
      for (const x of scatter(r, 9, 110)) {
        const n = 2 + Math.floor(r() * 3);
        const base = 70 + r() * 70;
        const tilts = Array.from({ length: n }, () => r() * 0.9 - 0.45);
        wrap(x, (px) => {
          // glow behind the cluster
          for (let i = 0; i < 3; i++) fillPath(ctx, (c) => ellipse(c, px, y(px) - base * 0.4, base * (1.1 - i * 0.25), base * (0.7 - i * 0.15)), rgba(ICE[2], 0.06));
          for (let i = 0; i < n; i++) crystal(ctx, px + (i - (n - 1) / 2) * base * 0.22, y(px) + 8, base * (1 - Math.abs(i - (n - 1) / 2) * 0.25), tilts[i], [ICE[0], ICE[1], ICE[2]]);
        });
      }
    },
    near: (ctx, r) => {
      // ceiling with hanging icicles (top), dark rock mounds (bottom)
      const ceil = periodic(r, [[3, 18], [5, 10], [11, 5]]);
      fillPath(ctx, (c) => {
        c.moveTo(0, 0);
        for (let x = 0; x <= W; x += 8) c.lineTo(x, 70 + ceil(x));
        c.lineTo(W, 0);
        c.closePath();
      }, '#0b1f29');
      fillPath(ctx, (c) => {
        for (let x = 0; x <= W; x += 8) c.lineTo(x, 70 + ceil(x));
        for (let x = W; x >= 0; x -= 8) c.lineTo(x, 60 + ceil(x));
        c.closePath();
      }, '#1b4c57');
      for (const x of scatter(r, 26, 36)) {
        const len = 40 + r() * 140;
        const w = 12 + r() * 16;
        wrap(x, (px) => icicle(ctx, px, 64 + ceil(px), len, w, mix(ICE[1], '#0b1f29', 0.25), rgba(ICE[3], 0.7)));
      }
      const y = hills(ctx, r, 672, 14, '#0e2a35', { col: '#1f5a66', depth: 5 });
      for (const x of scatter(r, 5, 200)) {
        const h = 60 + r() * 40;
        const tilt = r() * 0.5 - 0.25;
        wrap(x, (px) => crystal(ctx, px, y(px) + 8, h, tilt, [mix(ICE[0], INK, 0.2), ICE[1], ICE[3]]));
      }
    },
    ground: (ctx, r) => groundTile(ctx, r, { lit: ICE[3], body: mix(ICE[2], SNOW[1], 0.5), shade: mix(ICE[1], VIOLET[2], 0.4), deep: mix(ICE[0], VIOLET[0], 0.5), edge: ICE[0], speck: ICE[3], pebble: mix(ICE[1], VIOLET[1], 0.3), ice: true }),
  },
  // 3 Clocktower Ridge (dusk)
  {
    sky: (ctx, r) => {
      bandedSky(ctx, [SKY_DUSK[0], SKY_DUSK[1], SKY_DUSK[2], SKY_DUSK[3]], 0, 660);
      stars(ctx, r, 70, 220, SNOW[2], 0.04);
      // low sun, banded
      for (let i = 0; i < 4; i++) fillPath(ctx, (c) => circle(c, 880, 600, 150 - i * 32), rgba(WARM[4], 0.08 + i * 0.07));
      for (const x of scatter(r, 4, 260)) {
        const y = 260 + r() * 200;
        wrap(x, (px) => {
          fillPath(ctx, (c) => ellipse(c, px, y, 150, 10), rgba(SKY_DUSK[2], 0.6));
          fillPath(ctx, (c) => ellipse(c, px + 30, y + 6, 110, 6), rgba(SKY_DUSK[1], 0.45));
        });
      }
    },
    far: (ctx, r) => {
      const haze = mix(SKY_DUSK[2], SKY_DUSK[3], 0.5);
      range(ctx, r, {
        peaks: [{ x: 160, h: 240, w: 180 }, { x: 420, h: 300, w: 160 }, { x: 980, h: 270, w: 190 }, { x: 1180, h: 200, w: 150 }],
        baseY: 600, rock: mix(SKY_DUSK[1], haze, 0.5), shadow: rgba(SKY_DUSK[0], 0.35),
        snow: mix(SNOW[2], haze, 0.35), snowShadow: mix(VIOLET[2], haze, 0.4), cap: 0.3, jag: 14, sharp: 0.9,
      });
      // ridge saddle where the tower stands
      fillPath(ctx, (c) => ellipse(c, 700, 600, 210, 70), mix(SKY_DUSK[1], haze, 0.5));
      clockTower(ctx, 700, 545, mix(SKY_DUSK[1], haze, 0.3), mix(SKY_DUSK[0], haze, 0.35), mix(WARM[4], haze, 0.4));
    },
    mid: (ctx, r) => {
      const haze = SKY_DUSK[2];
      range(ctx, r, {
        peaks: scatter(r, 8, 130).map((x) => ({ x, h: 140 + r() * 130, w: 120 + r() * 60 })),
        baseY: 630, rock: mix(SKY_DUSK[0], haze, 0.4), shadow: rgba(INK, 0.25),
        snow: mix(SNOW[1], haze, 0.35), snowShadow: mix(VIOLET[2], haze, 0.3), cap: 0.22, jag: 10, sharp: 0.8,
      });
    },
    near: (ctx, r) => {
      const haze = SKY_DUSK[1];
      const y = hills(ctx, r, 670, 18, mix(SKY_DUSK[0], INK, 0.2), { col: mix(SNOW[0], SKY_DUSK[2], 0.3), depth: 7 });
      // windswept boulders
      for (const x of scatter(r, 6, 160)) {
        const s = 30 + r() * 30;
        wrap(x, (px) => {
          fillPath(ctx, (c) => poly(c, [px - s * 1.4, y(px) + 10, px - s, y(px) - s, px + s * 0.2, y(px) - s * 1.3, px + s * 1.3, y(px) - s * 0.4, px + s * 1.5, y(px) + 10]), mix(ROCK[0], INK, 0.25));
          fillPath(ctx, (c) => poly(c, [px + s * 0.2, y(px) - s * 1.3, px + s * 1.3, y(px) - s * 0.4, px + s * 1.5, y(px) + 10, px + s * 0.3, y(px) + 10]), mix(INK, SKY_DUSK[0], 0.4));
          fillPath(ctx, (c) => poly(c, [px - s, y(px) - s, px + s * 0.2, y(px) - s * 1.3, px + s * 0.5, y(px) - s * 1.05, px - s * 0.6, y(px) - s * 0.82]), mix(SNOW[2], SKY_DUSK[3], 0.3));
        });
      }
      for (const x of scatter(r, 5, 200)) {
        const h = 150 + r() * 80;
        wrap(x, (px) => {
          ctx.save();
          ctx.translate(px, y(px) + 12);
          ctx.transform(1, 0, -0.12, 1, 0, 0); // leaning in the wind
          pine(ctx, 0, 0, h, pineCols(PINE[0], haze, 0.25), 4, 0.35);
          ctx.restore();
        });
      }
    },
    ground: (ctx, r) => groundTile(ctx, r, { lit: mix(SNOW[2], SKY_DUSK[3], 0.3), body: mix(SNOW[1], SKY_DUSK[2], 0.15), shade: mix(SNOW[0], SKY_DUSK[2], 0.25), deep: mix(VIOLET[2], SKY_DUSK[1], 0.4), edge: SKY_DUSK[1], speck: WARM[4], pebble: mix(ROCK[1], SKY_DUSK[1], 0.3) }),
  },
  // 4 The Summit (night + aurora)
  {
    sky: (ctx, r) => {
      bandedSky(ctx, [INK, '#24215a', VIOLET[0], '#4a4f9e'], 0, 700);
      stars(ctx, r, 220, 640, SNOW[2], 0.05);
      // aurora ribbons: vertical strokes along periodic curves, banded alpha
      const bands: [string, number, number][] = [[PINE[3], 170, 1], [ICE[2], 230, 0.8], ['#b48cf0', 300, 0.7]];
      for (const [col, base, a] of bands) {
        const f = periodic(r, [[1, 40], [2, 30], [3, 14]]);
        const hgt = periodic(r, [[2, 30], [5, 14]]);
        for (let x = 0; x < W; x += 3) {
          const y = base + f(x);
          const h = 90 + hgt(x);
          const fade = 0.5 + 0.5 * Math.sin((TAU * 2 * x) / W + base);
          for (let k = 0; k < 4; k++) {
            ctx.fillStyle = rgba(col, (0.05 + k * 0.045) * a * (0.4 + 0.6 * fade));
            ctx.fillRect(x, y - h * (1 - k * 0.22), 3, h * (1 - k * 0.22) * (k === 3 ? 0.4 : 1) + 8);
          }
        }
      }
    },
    far: (ctx, r) => {
      const haze = '#4a4f9e';
      range(ctx, r, {
        peaks: [{ x: 200, h: 200, w: 220 }, { x: 640, h: 470, w: 330 }, { x: 1060, h: 230, w: 240 }],
        baseY: 600, rock: mix(VIOLET[1], haze, 0.35), shadow: rgba(VIOLET[0], 0.6),
        snow: mix(SNOW[0], VIOLET[3], 0.4), snowShadow: mix(VIOLET[2], haze, 0.3), cap: 0.42, jag: 9,
      });
      // the great festival lantern glinting on the final peak
      for (let i = 0; i < 4; i++) fillPath(ctx, (c) => circle(c, 640, 136, 40 - i * 9), rgba(WARM[3], 0.1 + i * 0.12));
      fillPath(ctx, (c) => circle(c, 640, 136, 5), WARM[4]);
    },
    mid: (ctx, r) => {
      const haze = VIOLET[0];
      const y = hills(ctx, r, 620, 30, mix(VIOLET[1], haze, 0.4), { col: mix(SNOW[0], VIOLET[2], 0.45), depth: 9 });
      for (const x of scatter(r, 9, 100)) {
        const h = 80 + r() * 60;
        wrap(x, (px) => pine(ctx, px, y(px) + 12, h, pineCols(PINE[0], haze, 0.45, mix(SNOW[0], VIOLET[3], 0.3)), 3, 0.6));
      }
    },
    near: (ctx, r) => {
      const haze = VIOLET[0];
      const y = hills(ctx, r, 676, 14, mix(VIOLET[0], INK, 0.3), { col: mix(SNOW[0], VIOLET[2], 0.35), depth: 6 });
      for (const x of scatter(r, 6, 170)) {
        const h = 170 + r() * 90;
        wrap(x, (px) => pine(ctx, px, y(px) + 14, h, pineCols(mix(PINE[0], INK, 0.3), haze, 0.15, mix(SNOW[0], VIOLET[3], 0.4)), 4, 0.7));
      }
    },
    ground: (ctx, r) => groundTile(ctx, r, { lit: mix(SNOW[1], VIOLET[3], 0.35), body: mix(SNOW[0], VIOLET[2], 0.35), shade: mix(VIOLET[2], VIOLET[1], 0.4), deep: VIOLET[1], edge: VIOLET[0], speck: SNOW[2], pebble: mix(ROCK[1], VIOLET[0], 0.3) }),
  },
];

const LAYER_ORDER = ['sky', 'far', 'mid', 'near', 'ground'] as const;

/** Number of zones that have painted backgrounds. */
export const ZONE_COUNT = ZONES.length;

/** Paint one background layer of one zone (deterministic: same pixels every call). */
export function buildZoneLayer(zi: number, layer: BgLayer): SheetSpec {
  const li = LAYER_ORDER.indexOf(layer);
  const [c, ctx] = makeCanvas(W, layer === 'ground' ? 320 : H);
  ZONES[zi][layer](ctx, rng(1000 + zi * 97 + li * 13));
  return { key: bgKey(zi, layer), canvas: c };
}

/** Every layer of every zone (used by the preview page; the game builds zones on demand). */
export function buildBackgrounds(): { sheets: SheetSpec[] } {
  const sheets: SheetSpec[] = [];
  ZONES.forEach((_, zi) => LAYER_ORDER.forEach((layer) => sheets.push(buildZoneLayer(zi, layer))));
  return { sheets };
}

export { GROUND_LINE, BERRY };
