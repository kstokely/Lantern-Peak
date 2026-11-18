// Playable heroes (v3): Pip the snow hare, Marlow the marmot, Odette the owl and Bluster the
// storm cloud, each a parametric rig drawn with Canvas 2D on Juniper's exact sheet layout:
// 200x200 frames, the 19 JUNIPER_FRAMES indices, feet at the bottom-centre, facing right.
// They are the same characters as their trail-friend art (friends.ts), turned to a
// three-quarter view walking right. Sheets are built on demand (see index.ts ensureHeroArt).
import { JUNIPER_FRAME, SCARF_COLOURS, HeroId, heroKey, heroAnim, heroPortraitKey, HERO_IDS } from './keys';
import { INK, INK2, VIOLET, SNOW, ICE, WARM, BERRY, ROCK, PINK, CREAM, GOAT, mix, hex, rgba } from './palette';
import {
  Ctx, AnimSpec, SheetSpec, makeSheet, single, inked, fillPath, strokePath, clipped, ellipse, circle, roundRect, poly,
  groundShadow, shadedBlob, star4, lerp, TAU,
} from './draw';
import { juniperAnimSpecs, juniperPoses, drawJuniper, JUNIPER_FRAMES } from './juniper';
import { juniperHatAnchor } from './store';

const W = JUNIPER_FRAME.w;
const H = JUNIPER_FRAME.h;
/** Bottom of the feet outline (same as Juniper's). */
const GY = H - 5;
const LW = 5;

export type NonJuniper = Exclude<HeroId, 'juniper'>;

// ---------------------------------------------------------------- pose

export interface Ft { dx: number; lift: number }

export interface HeroPose {
  /** Upper-body bob (+ = down); planted feet stay planted. */
  bob: number;
  /** Whole-figure lift inside the frame (hop); the ground shadow stays down. */
  lift: number;
  /** Squash/stretch about the feet. */
  sx: number;
  sy: number;
  /** Upper-body rotation about the hips (+ = leans forward / clockwise). */
  lean: number;
  /** Feet relative to their rest spots: [far, near]. */
  feet: [Ft, Ft];
  /** Arm angles [far, near]: 0 hangs down, + swings forward, ~2.8 points up. */
  arms: [number, number];
  headTilt: number;
  /** Pip: how far the ears lean back (0 upright). */
  ear: number;
  /** Pip: extra bend of the ear tips (+ = flop back, - = flick forward). */
  flop: number;
  /** Odette: wing spread 0 (folded) .. 1 (out for balance). */
  wing: number;
  /** Odette: wing beat -1 (down stroke) .. +1 (raised). */
  flap: number;
  /** Bluster: inflate (+) or flatten (-). */
  puff: number;
  /** Bluster: trailing-puff phase, < 0 = none. */
  trail: number;
  /** Marlow: tail swish (radians). */
  tail: number;
  eyes: 'open' | 'blink' | 'happy';
  mouth: 'smile' | 'open' | 'grin' | 'o';
  scarfWave: number;
  /** 0 = accent tail hangs, 1 = streams back, -1 = blows up (falling). */
  scarfLift: number;
  /** Ground-shadow scale (0 in the air). */
  shadow: number;
}

function base(): HeroPose {
  return {
    bob: 0, lift: 0, sx: 1, sy: 1, lean: 0,
    feet: [{ dx: 0, lift: 0 }, { dx: 0, lift: 0 }],
    arms: [0.8, 0.55], headTilt: 0, ear: 0.12, flop: 0.08, wing: 0.25, flap: 0, puff: 0, trail: -1, tail: 0,
    eyes: 'open', mouth: 'smile', scarfWave: 0, scarfLift: 0, shadow: 1,
  };
}
const P = (o: Partial<HeroPose>): HeroPose => ({ ...base(), ...o });

type Style = 'hop' | 'waddle' | 'owl' | 'drift';

function walkPose(style: Style, i: number): HeroPose {
  const t = (i / 6) * TAU;
  if (style === 'hop') {
    // hop-lope: one bound per cycle. Push off (t ~ 0), airborne (t ~ pi/2), land (t ~ 3pi/2).
    const h = Math.max(0, Math.sin(t));
    const foot = (ph: number): Ft => ({ dx: -11 * Math.sin(t + ph), lift: 5 * Math.max(0, Math.sin(t + ph + 0.4)) });
    return P({
      lift: 13 * h,
      bob: 3 * (1 - h) * Math.max(0, -Math.sin(t)),
      sy: 1 + 0.05 * Math.sin(t + 0.6), sx: 1 - 0.035 * Math.sin(t + 0.6),
      lean: 0.08 + 0.06 * Math.cos(t),
      feet: [foot(0.55), foot(0)],
      arms: [0.95 + 0.35 * Math.sin(t), 0.7 + 0.35 * Math.sin(t + 0.5)],
      ear: 0.35 + 0.35 * h, flop: 0.25 + 0.45 * Math.max(0, Math.cos(t - 0.6)),
      headTilt: -0.04 * Math.cos(t),
      scarfLift: 0.85, scarfWave: -t * 2,
      shadow: 1 - 0.25 * h,
    });
  }
  // waddles: alternating steps with a side-to-side rock (seen as a fore/aft sway)
  const amp = style === 'owl' ? 7 : style === 'drift' ? 5 : 9;
  const lift = style === 'drift' ? 4 : 5;
  const step = (ph: number): Ft => ({ dx: amp * Math.sin(t + ph), lift: lift * Math.max(0, Math.cos(t + ph)) });
  const A = step(0);
  const B = step(Math.PI);
  const rock = style === 'owl' ? 0.1 : style === 'drift' ? 0.05 : 0.07;
  return P({
    bob: style === 'drift' ? 3 * Math.sin(t) : 1.5 - 2.2 * Math.abs(Math.cos(t)),
    lean: rock * Math.sin(t) + (style === 'drift' ? 0.04 : 0),
    feet: [A, B],
    arms: [0.85 + 0.3 * Math.sin(t), 0.55 - 0.35 * Math.sin(t)],
    headTilt: -0.03 * Math.cos(2 * t),
    wing: 0.7, flap: 0.18 * Math.sin(2 * t),
    puff: 0.08 * Math.sin(2 * t),
    trail: style === 'drift' ? t : -1,
    tail: 0.3 * Math.sin(t),
    ear: 0.2, flop: 0.15,
    scarfLift: 0.85, scarfWave: -t * 2,
  });
}

/** The 19 poses, frame for frame the same beats as juniperPoses(). */
export function heroPoses(style: Style): HeroPose[] {
  const out: HeroPose[] = [];
  // idle 0-3 (3 = blink)
  const b = [0, 1, 2, 1];
  for (let i = 0; i < 4; i++) {
    out.push(P({
      bob: b[i], sy: 1 - 0.005 * b[i], sx: 1 + 0.003 * b[i],
      arms: [0.8 + 0.03 * b[i], 0.55 + 0.04 * b[i]],
      headTilt: 0.012 * b[i], ear: 0.12 + 0.03 * b[i], flop: 0.08 + 0.04 * b[i],
      wing: 0.25, flap: -0.05 * b[i], puff: 0.03 * b[i], tail: 0.05 * b[i],
      scarfWave: i * 0.6, eyes: i === 3 ? 'blink' : 'open',
    }));
  }
  for (let i = 0; i < 6; i++) out.push(walkPose(style, i));
  // 10 crouch
  out.push(P({
    bob: 7, sx: 1.08, sy: 0.92, lean: 0.06, headTilt: 0.08,
    feet: [{ dx: -3, lift: 0 }, { dx: 3, lift: 0 }], arms: [0.25, 0.1],
    ear: 0.45, flop: 0.35, wing: 0.15, flap: -0.3, puff: -0.4, tail: -0.2, scarfLift: 0.05, scarfWave: 0.4,
  }));
  // 11 rise: stretched, arms up, legs trailing, wings beat down, Bluster puffs up
  out.push(P({
    bob: -3, sx: 0.92, sy: 1.1, lean: -0.12, shadow: 0,
    feet: [{ dx: -9, lift: 5 }, { dx: -6, lift: 2 }], arms: [2.3, 2.5],
    ear: 0.95, flop: 0.45, wing: 1, flap: -1, puff: 1, tail: -0.4, scarfLift: 0.7, scarfWave: 1.5, mouth: 'grin',
  }));
  // 12 apex: compact, feet tucked
  out.push(P({
    bob: 1, sx: 1.03, sy: 0.97, shadow: 0, lean: -0.03,
    feet: [{ dx: 5, lift: 12 }, { dx: 7, lift: 11 }], arms: [1.5, 1.7],
    ear: 0.5, flop: -0.15, wing: 1, flap: 0.2, puff: 0.6, tail: 0.1, scarfLift: 0.2, scarfWave: 2.6, mouth: 'open',
  }));
  // 13 fall: feet reach down, ears/scarf blown up, wings raised
  out.push(P({
    bob: -5, sy: 1.04, sx: 0.97, lean: 0.05, shadow: 0,
    feet: [{ dx: 3, lift: 0 }, { dx: 6, lift: 0 }], arms: [2.0, 2.2],
    ear: 0.1, flop: -0.45, wing: 1, flap: 1, puff: 0.3, tail: 0.4, scarfLift: -0.9, scarfWave: 3.4, mouth: 'o',
  }));
  // 14 land squash (15%)
  out.push(P({
    bob: 6, sx: 1.15, sy: 0.85, headTilt: 0.05,
    feet: [{ dx: -7, lift: 0 }, { dx: 7, lift: 0 }], arms: [1.1, 0.95],
    ear: 0.6, flop: 0.6, wing: 0.8, flap: -0.5, puff: -1, tail: -0.3, scarfLift: 0.05, scarfWave: 4.2, eyes: 'blink',
  }));
  // 15-18 cheer: crouch, rise, peak (happy), come down
  out.push(P({ bob: 3, sx: 1.05, sy: 0.93, arms: [0.4, 0.25], ear: 0.3, flop: 0.2, wing: 0.3, puff: -0.3, scarfWave: 0.5, mouth: 'grin' }));
  out.push(P({
    lift: 12, lean: -0.1, shadow: 0.8, feet: [{ dx: -2, lift: 3 }, { dx: 3, lift: 6 }], arms: [2.5, 2.7],
    ear: 0.15, flop: -0.1, wing: 1, flap: 0.6, puff: 0.6, tail: 0.3, scarfLift: 0.3, scarfWave: 1.6, mouth: 'open',
  }));
  out.push(P({
    lift: 20, lean: -0.14, shadow: 0.68, headTilt: -0.05, feet: [{ dx: -3, lift: 5 }, { dx: 4, lift: 9 }], arms: [2.85, 3.0],
    ear: 0.05, flop: -0.2, wing: 1, flap: 1, puff: 1, tail: 0.5, scarfLift: 0.55, scarfWave: 3.0, eyes: 'happy', mouth: 'open',
  }));
  out.push(P({
    lift: 6, lean: -0.05, shadow: 0.9, feet: [{ dx: 0, lift: 1 }, { dx: 2, lift: 3 }], arms: [1.9, 2.1],
    ear: 0.25, flop: 0.15, wing: 0.7, flap: 0.3, puff: 0.4, tail: 0.1, scarfLift: 0.2, scarfWave: 4.4, eyes: 'happy', mouth: 'grin',
  }));
  return out;
}

// ---------------------------------------------------------------- shared parts

interface Rig {
  style: Style;
  /** Upper-body lean pivot (hip centre). */
  pivot: [number, number];
  /** Head rotation pivot (neck). */
  neck: [number, number];
  /** Hat origin in head space (the "skull centre" a hat expects, scaled). */
  hat: [number, number];
  hatScale: number;
  hatRot: number;
  draw: (ctx: Ctx, p: HeroPose, accent: string) => void;
}

/** Squash/stretch about the feet, then the in-frame lift. */
function frameXf(ctx: Ctx, p: HeroPose): void {
  ctx.translate(W / 2, GY);
  ctx.scale(p.sx, p.sy);
  ctx.translate(0, -p.lift);
  ctx.translate(-W / 2, -GY);
}

function upperXf(ctx: Ctx, p: HeroPose, pivot: [number, number]): void {
  ctx.translate(pivot[0], pivot[1]);
  ctx.rotate(p.lean);
  ctx.translate(-pivot[0], -pivot[1]);
  ctx.translate(0, p.bob);
}

function headXf(ctx: Ctx, p: HeroPose, neck: [number, number]): void {
  ctx.translate(neck[0], neck[1]);
  ctx.rotate(p.headTilt);
  ctx.translate(-neck[0], -neck[1]);
}

function rotAbout(x: number, y: number, cx: number, cy: number, a: number): [number, number] {
  const dx = x - cx;
  const dy = y - cy;
  return [cx + Math.cos(a) * dx - Math.sin(a) * dy, cy + Math.sin(a) * dx + Math.cos(a) * dy];
}

function accentTones(a: string): { dark: string; light: string } {
  return { dark: mix(mix(a, INK, 0.3), VIOLET[0], 0.15), light: mix(a, WARM[4], 0.5) };
}

function eye(ctx: Ctx, x: number, y: number, rx: number, ry: number, mode: HeroPose['eyes']): void {
  if (mode === 'open') {
    fillPath(ctx, (c) => ellipse(c, x, y, rx, ry), INK2);
    fillPath(ctx, (c) => circle(c, x - rx * 0.3, y - ry * 0.38, rx * 0.42), CREAM);
    fillPath(ctx, (c) => circle(c, x + rx * 0.35, y + ry * 0.4, rx * 0.18), CREAM);
  } else {
    const up = mode === 'happy' ? -0.95 : 0.6;
    strokePath(ctx, (c) => {
      c.moveTo(x - rx * 1.05, y + 1);
      c.quadraticCurveTo(x, y + up * ry, x + rx * 1.05, y + 1);
    }, INK, 3.2);
  }
}

/** Small open mouth (grin / open / o) used by several heroes. */
function openMouth(ctx: Ctx, x: number, y: number, mode: HeroPose['mouth'], s = 1): void {
  if (mode === 'o') {
    inked(ctx, (c) => ellipse(c, x, y + 2 * s, 3.4 * s, 4 * s), mix(BERRY[0], INK, 0.3), 1.3);
    return;
  }
  const big = (mode === 'open' ? 1.25 : 1) * s;
  const m = (c: Ctx) => {
    c.moveTo(x - 6 * big, y - 2);
    c.quadraticCurveTo(x, y, x + 6 * big, y - 3);
    c.quadraticCurveTo(x + 1, y + 8 * big, x - 6 * big, y - 2);
    c.closePath();
  };
  inked(ctx, m, mix(BERRY[0], INK, 0.3), 1.3);
  clipped(ctx, m, () => fillPath(ctx, (c) => ellipse(c, x, y + 4.5 * big, 4.5 * s, 3 * s), BERRY[2]));
}

/** Arm: ink-outlined capsule from the shoulder plus a round paw. Returns the paw centre. */
function arm(ctx: Ctx, sx: number, sy: number, ang: number, len: number, w: number, col: string, paw: string, lw = 4): [number, number] {
  const ex = sx + Math.sin(ang) * len;
  const ey = sy + Math.cos(ang) * len;
  const path = (c: Ctx) => { c.moveTo(sx, sy); c.lineTo(ex, ey); };
  strokePath(ctx, path, INK, w + lw * 2);
  strokePath(ctx, path, col, w);
  inked(ctx, (c) => ellipse(c, ex, ey, w * 0.66, w * 0.56, ang), paw, lw);
  return [ex, ey];
}

/** A tapered scarf / neckerchief tail streaming from (x0, y0), flapping with the pose. */
function accentTail(ctx: Ctx, p: HeroPose, x0: number, y0: number, len: number, phase: number, col: string, dark: string, w0 = 6, w1 = 4.5): void {
  const n = 5;
  const pts: [number, number][] = [];
  const lift = p.scarfLift;
  const seg = len / n;
  const ang = lift >= 0 ? lerp(1.0, -0.1, lift) : lerp(-0.1, -0.8, -lift);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const wave = Math.sin(p.scarfWave + phase - k * 1.05) * (3 + 6 * Math.abs(lift)) * t;
    const bx = x0 - Math.cos(ang) * seg * k;
    const by = y0 + Math.sin(ang) * seg * k;
    pts.push([bx + Math.sin(ang) * wave, by + Math.cos(ang) * wave]);
  }
  const left: number[] = [];
  const right: number[] = [];
  for (let k = 0; k <= n; k++) {
    const [x, y] = pts[k];
    const [xa, ya] = pts[Math.max(0, k - 1)];
    const [xb, yb] = pts[Math.min(n, k + 1)];
    let nx = -(yb - ya);
    let ny = xb - xa;
    const d = Math.hypot(nx, ny) || 1;
    nx /= d;
    ny /= d;
    const w = lerp(w0, w1, k / n);
    left.push(x + nx * w, y + ny * w);
    right.push(x - nx * w, y - ny * w);
  }
  const outline = [...left];
  for (let k = n; k >= 0; k--) outline.push(right[k * 2], right[k * 2 + 1]);
  const path = (c: Ctx) => poly(c, outline);
  inked(ctx, path, col, 3.5);
  clipped(ctx, path, () => {
    ctx.beginPath();
    poly(ctx, [...right, ...pts.slice().reverse().flatMap(([x, y]) => [x, y])]);
    ctx.fillStyle = dark;
    ctx.fill();
  });
}

// ---------------------------------------------------------------- Pip the snow hare

const PIP = {
  fur: SNOW[1],
  furD: mix(SNOW[0], VIOLET[2], 0.35),
  belly: SNOW[2],
  far: mix(SNOW[0], VIOLET[2], 0.5),
  farD: mix(VIOLET[2], VIOLET[1], 0.25),
};
const PIP_HEAD: [number, number] = [114, 97];

/** Hare ear in two bending segments (union of two ellipses): angle a from upright (+ = back), tip bend b. */
function hareEar(ctx: Ctx, bx: number, by: number, back: number, bend: number, len: number, w: number, outer: string, inner: string): void {
  const a = -back;
  const a2 = a - bend;
  const s1 = len * 0.5;
  const s2 = len * 0.5;
  const dir = (ang: number): [number, number] => [Math.sin(ang), -Math.cos(ang)];
  const [d1x, d1y] = dir(a);
  const [d2x, d2y] = dir(a2);
  const jx = bx + d1x * s1;
  const jy = by + d1y * s1;
  const shape = (k: number, ky: number, off: number) => (c: Ctx) => {
    ellipse(c, bx + d1x * s1 * 0.5 + d1x * off, by + d1y * s1 * 0.5 + d1y * off, w * k, (s1 * 0.5 + w * 0.6) * ky, a);
    ellipse(c, jx + d2x * s2 * 0.5, jy + d2y * s2 * 0.5, w * 0.95 * k, (s2 * 0.5 + w * 0.55) * ky, a2);
  };
  inked(ctx, shape(1, 1, 0), outer, 4);
  fillPath(ctx, shape(0.45, 0.82, 2), inner);
}

function drawPip(ctx: Ctx, p: HeroPose, accent: string): void {
  const { dark: aDark } = accentTones(accent);
  if (p.shadow > 0) groundShadow(ctx, W / 2, GY - 1, 44 * p.shadow * p.sx, 7 * Math.min(1, p.shadow));
  ctx.save();
  frameXf(ctx, p);
  const pivot: [number, number] = [96, 160];
  const FAR_X = 112;
  const NEAR_X = 96;
  const footY = GY - 7;

  // big hind foot: long ellipse, toe forward; lifted feet tip toe-down
  const hindFoot = (x: number, f: Ft, col: string, shade: string, hipX: number, hipY: number) => {
    const fx = x + f.dx;
    const fy = footY - f.lift;
    const rot = f.lift > 1.5 ? 0.25 : 0;
    // ankle capsule from the haunch to the heel
    strokePath(ctx, (c) => { c.moveTo(hipX, hipY); c.lineTo(fx - 8, fy - 2); }, INK, 13 + 8);
    strokePath(ctx, (c) => { c.moveTo(hipX, hipY); c.lineTo(fx - 8, fy - 2); }, col, 13);
    const foot = (c: Ctx) => ellipse(c, fx + 4, fy, 19, 7.5, rot);
    shadedBlob(ctx, foot, col, shade, 4, [-2, -3]);
    // toe lines
    strokePath(ctx, (c) => {
      c.moveTo(fx + 14, fy - 1); c.lineTo(fx + 19, fy + 1);
      c.moveTo(fx + 12, fy + 3); c.lineTo(fx + 17, fy + 5);
    }, shade, 1.6);
  };

  // far hind foot (behind everything)
  hindFoot(FAR_X, p.feet[0], PIP.far, PIP.farD, FAR_X - 6, 168 + p.bob);

  ctx.save();
  upperXf(ctx, p, pivot);
  // cotton tail
  const tail = (c: Ctx) => {
    for (let k = 0; k < 6; k++) circle(c, 64 + Math.cos((k / 6) * TAU) * 5, 150 + Math.sin((k / 6) * TAU) * 5, 7.5);
  };
  shadedBlob(ctx, tail, SNOW[2], PIP.furD, 4, [-2, -2]);
  // ears (far first) - both behind the skull so the head covers their roots
  ctx.save();
  headXf(ctx, p, [110, 124]);
  hareEar(ctx, 121, 79, p.ear - 0.12, p.flop * 0.9, 40, 9, PIP.far, mix(PINK, PIP.far, 0.35));
  hareEar(ctx, 106, 80, p.ear, p.flop, 42, 10, PIP.fur, PINK);
  ctx.restore();
  // body: round seat + chest
  const body = (c: Ctx) => {
    ellipse(c, 96, 156, 30, 30);
    ellipse(c, 108, 134, 19, 22, 0.3);
  };
  shadedBlob(ctx, body, PIP.fur, PIP.furD, LW, [-4, -6]);
  clipped(ctx, body, () => fillPath(ctx, (c) => ellipse(c, 114, 152, 13, 22, -0.15), PIP.belly));
  ctx.restore();

  // near haunch + foot (feet planted; haunch rides the bob)
  hindFoot(NEAR_X, p.feet[1], PIP.fur, PIP.furD, 86, 172 + p.bob);
  ctx.save();
  upperXf(ctx, p, pivot);
  shadedBlob(ctx, (c) => ellipse(c, 84, 166, 18, 16, -0.3), PIP.fur, PIP.furD, 4, [-3, -4]);
  strokePath(ctx, (c) => { c.moveTo(74, 158); c.quadraticCurveTo(84, 152, 96, 158); }, PIP.furD, 2);
  // arms are short, so raised paws are held up in front of the chin (never hidden behind the head)
  const armA = (a: number) => Math.min(a, 2.25);
  // far arm: darker, shoulder at the front of the chest so the paw always shows past it
  arm(ctx, 121, 131, armA(p.arms[0]), 22, 12, PIP.far, PIP.far, 4);

  // scarf: trailing tail, band, knot
  accentTail(ctx, p, 102, 124, 30 + 8 * Math.abs(p.scarfLift), 1.2, aDark, mix(aDark, INK, 0.3), 5, 4);
  const band = (c: Ctx) => { c.moveTo(97, 117); c.quadraticCurveTo(110, 132, 132, 121); };
  strokePath(ctx, band, INK, 11 + 8);
  strokePath(ctx, band, accent, 11);
  ctx.save();
  ctx.translate(0, 3);
  strokePath(ctx, band, aDark, 4);
  ctx.restore();

  // head
  ctx.save();
  headXf(ctx, p, [110, 124]);
  const [hx, hy] = PIP_HEAD;
  const head = (c: Ctx) => {
    ellipse(c, hx, hy, 29, 25);
    ellipse(c, hx + 16, hy + 7, 16, 13, -0.2);
  };
  shadedBlob(ctx, head, PIP.fur, PIP.furD, LW, [-4, -5]);
  clipped(ctx, head, () => fillPath(ctx, (c) => ellipse(c, hx - 10, hy - 14, 9, 5, -0.5), SNOW[2]));
  fillPath(ctx, (c) => ellipse(c, hx + 6, hy + 10, 6.5, 3.8), rgba(PINK, 0.7));
  // eyes (3/4: far eye smaller, toward the muzzle)
  eye(ctx, hx + 8, hy - 3, 5.6, 8, p.eyes);
  eye(ctx, hx + 24, hy - 4, 4.2, 7, p.eyes);
  // nose + mouth
  fillPath(ctx, (c) => ellipse(c, hx + 31, hy + 4, 4.2, 3.2), BERRY[1]);
  if (p.mouth === 'smile') {
    strokePath(ctx, (c) => { c.moveTo(hx + 23, hy + 11); c.quadraticCurveTo(hx + 26, hy + 14, hx + 29, hy + 9); c.quadraticCurveTo(hx + 31, hy + 14, hx + 34, hy + 10); }, INK, 2.2);
  } else {
    openMouth(ctx, hx + 28, hy + 12, p.mouth, 0.85);
  }
  // whiskers
  ctx.strokeStyle = rgba(INK, 0.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(hx + 30, hy + 7); ctx.lineTo(hx + 48, hy + 3);
  ctx.moveTo(hx + 30, hy + 9); ctx.lineTo(hx + 48, hy + 11);
  ctx.moveTo(hx + 18, hy + 7); ctx.lineTo(hx + 4, hy + 5);
  ctx.stroke();
  ctx.restore();

  // scarf knot over the band
  inked(ctx, (c) => ellipse(c, 118, 126, 6, 5.5, 0.4), accent, 3.5);
  // near arm, in front of everything
  const na = armA(p.arms[1]);
  const [px, py] = arm(ctx, 110, 134, na, 23, 13, PIP.fur, PIP.fur, 4);
  strokePath(ctx, (c) => {
    const ux = Math.sin(na);
    const uy = Math.cos(na);
    c.moveTo(px + ux * 3 - uy * 3, py + uy * 3 + ux * 3); c.lineTo(px + ux * 6 - uy * 3, py + uy * 6 + ux * 3);
    c.moveTo(px + ux * 3 + uy * 3, py + uy * 3 - ux * 3); c.lineTo(px + ux * 6 + uy * 3, py + uy * 6 - ux * 3);
  }, PIP.furD, 1.6);
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- Marlow the marmot

const MARLOW = {
  fur: '#9d8f83',
  furD: '#665b66',
  far: mix('#9d8f83', VIOLET[1], 0.3),
  cap: '#6a4f43',
  pale: '#e6d3b6',
};
const MARLOW_HEAD: [number, number] = [112, 90];

function drawMarlow(ctx: Ctx, p: HeroPose, accent: string): void {
  const { dark: aDark, light: aLight } = accentTones(accent);
  const capD = mix(MARLOW.cap, INK, 0.25);
  const paleD = mix(MARLOW.pale, VIOLET[2], 0.3);
  const tooth = mix(CREAM, WARM[3], 0.3);
  if (p.shadow > 0) groundShadow(ctx, W / 2, GY - 1, 52 * p.shadow * p.sx, 8 * Math.min(1, p.shadow));
  ctx.save();
  frameXf(ctx, p);
  const pivot: [number, number] = [98, 172];
  const footY = GY - 6;

  const leg = (x: number, f: Ft, col: string, hipY: number) => {
    const fx = x + f.dx;
    const fy = footY - f.lift;
    strokePath(ctx, (c) => { c.moveTo(x, hipY); c.lineTo(fx, fy - 3); }, INK, 16 + 8);
    strokePath(ctx, (c) => { c.moveTo(x, hipY); c.lineTo(fx, fy - 3); }, col, 16);
    inked(ctx, (c) => ellipse(c, fx + 4, fy, 13, 6.5, f.lift > 1.5 ? 0.2 : 0), MARLOW.furD, 4);
    for (const k of [0, 1, 2]) fillPath(ctx, (c) => circle(c, fx + 9 + k * 3.5, fy + 2 - k, 1.6), INK);
  };

  leg(110, p.feet[0], MARLOW.far, 176 + p.bob);

  ctx.save();
  upperXf(ctx, p, pivot);
  // bushy tail behind, swishing about its root
  ctx.save();
  ctx.translate(64, 172);
  ctx.rotate(-0.25 + p.tail);
  const tail = (c: Ctx) => {
    c.moveTo(6, 4);
    c.quadraticCurveTo(-10, 6, -22, -6);
    c.quadraticCurveTo(-34, -16, -28, -30);
    c.quadraticCurveTo(-18, -38, -10, -28);
    c.quadraticCurveTo(-2, -16, 8, -10);
    c.closePath();
  };
  inked(ctx, tail, MARLOW.furD, 4);
  clipped(ctx, tail, () => {
    fillPath(ctx, (c) => ellipse(c, -24, -24, 10, 12, 0.5), MARLOW.cap);
    strokePath(ctx, (c) => { c.moveTo(-14, -8); c.lineTo(-6, -12); c.moveTo(-20, -14); c.lineTo(-12, -20); }, mix(MARLOW.furD, INK, 0.3), 2);
  });
  ctx.restore();
  // low chubby pear body
  const body = (c: Ctx) => {
    ellipse(c, 96, 160, 42, 30);
    ellipse(c, 104, 132, 31, 27);
  };
  shadedBlob(ctx, body, MARLOW.fur, MARLOW.furD, LW, [-5, -6]);
  clipped(ctx, body, () => {
    fillPath(ctx, (c) => ellipse(c, 116, 158, 20, 24), MARLOW.pale);
    // apron: ice-blue front panel (3/4 view: on the chest/belly side)
    const apron = (c: Ctx) => {
      c.moveTo(104, 116);
      c.lineTo(132, 114);
      c.quadraticCurveTo(136, 132, 146, 140);
      c.lineTo(150, 196);
      c.lineTo(96, 196);
      c.lineTo(98, 142);
      c.quadraticCurveTo(106, 132, 104, 116);
      c.closePath();
    };
    inked(ctx, apron, ICE[2], 3.5);
    clipped(ctx, apron, () => {
      fillPath(ctx, (c) => c.rect(132, 100, 30, 100), mix(ICE[1], ICE[2], 0.45));
      ctx.strokeStyle = rgba(CREAM, 0.6);
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(96, 182); ctx.lineTo(150, 182);
      ctx.moveTo(108, 121); ctx.lineTo(130, 120);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    // waist tie running round to the back
    strokePath(ctx, (c) => { c.moveTo(98, 146); c.quadraticCurveTo(80, 150, 60, 146); }, INK, 7);
    strokePath(ctx, (c) => { c.moveTo(98, 146); c.quadraticCurveTo(80, 150, 60, 146); }, ICE[2], 3);
  });
  // pocket with a coin
  inked(ctx, (c) => circle(c, 118, 154, 5.5), WARM[3], 2);
  inked(ctx, (c) => roundRect(c, 110, 156, 24, 15, 4), ICE[1], 2.5);
  // strap over the near shoulder + button
  strokePath(ctx, (c) => { c.moveTo(106, 118); c.quadraticCurveTo(98, 106, 86, 112); }, INK, 10);
  strokePath(ctx, (c) => { c.moveTo(106, 118); c.quadraticCurveTo(98, 106, 86, 112); }, ICE[2], 4.5);
  inked(ctx, (c) => circle(c, 107, 120, 3.2), WARM[3], 2);
  ctx.restore();

  leg(90, p.feet[1], MARLOW.fur, 178 + p.bob);

  ctx.save();
  upperXf(ctx, p, pivot);
  // short arms: raised paws come up in front of the chin, never behind the head
  const armA = (a: number) => Math.min(a, 2.3);
  // far arm (darker), shoulder at the front of the chest so the paw always shows past it
  // (raised, it reaches forward below the muzzle so the paw clears the big head)
  arm(ctx, 128, 128, Math.min(p.arms[0], 2.0), 21, 13, MARLOW.far, capD, 4);
  // neckerchief (accent): a triangle tied under the chin, point down the chest
  // a corner of the knot tail flapping behind the neck
  accentTail(ctx, p, 96, 118, 20 + 6 * Math.abs(p.scarfLift), 0.8, aDark, mix(aDark, INK, 0.3), 5, 4);
  const kerchief = (c: Ctx) => {
    c.moveTo(92, 114);
    c.quadraticCurveTo(114, 128, 140, 114);
    c.quadraticCurveTo(134, 132, 122, 146);
    c.quadraticCurveTo(108, 130, 92, 114);
    c.closePath();
  };
  inked(ctx, kerchief, accent, 3.5);
  clipped(ctx, kerchief, () => {
    fillPath(ctx, (c) => poly(c, [126, 110, 146, 110, 124, 150]), aDark);
    for (const [x, y] of [[108, 124], [118, 130], [122, 122], [114, 118], [124, 138]]) fillPath(ctx, (c) => circle(c, x, y, 1.7), aLight);
  });

  // ---- head ----
  ctx.save();
  headXf(ctx, p, [108, 114]);
  const [hx, hy] = MARLOW_HEAD;
  // tiny round ears set low: far one peeks above the crown, near one on the back of the head
  inked(ctx, (c) => circle(c, hx + 6, hy - 25, 7), mix(MARLOW.furD, INK, 0.15), 3.5);
  const head = (c: Ctx) => {
    c.moveTo(hx - 32, hy + 4);
    c.bezierCurveTo(hx - 34, hy - 22, hx - 18, hy - 28, hx + 2, hy - 28);
    c.bezierCurveTo(hx + 24, hy - 28, hx + 36, hy - 20, hx + 36, hy + 2);
    c.bezierCurveTo(hx + 36, hy + 24, hx + 18, hy + 30, hx, hy + 30);
    c.bezierCurveTo(hx - 20, hy + 30, hx - 32, hy + 24, hx - 32, hy + 4);
    c.closePath();
    ellipse(c, hx + 26, hy + 8, 15, 13, -0.1); // short muzzle
  };
  shadedBlob(ctx, head, MARLOW.fur, MARLOW.furD, LW, [-4, -4]);
  clipped(ctx, head, () => {
    // dark crown cap running down to the nose bridge
    fillPath(ctx, (c) => {
      c.moveTo(hx - 40, hy - 2);
      c.quadraticCurveTo(hx - 10, hy - 12, hx + 12, hy - 6);
      c.quadraticCurveTo(hx + 26, hy - 2, hx + 44, hy - 4);
      c.lineTo(hx + 44, hy - 50);
      c.lineTo(hx - 40, hy - 50);
      c.closePath();
    }, MARLOW.cap);
    fillPath(ctx, (c) => ellipse(c, hx - 8, hy - 18, 11, 4, -0.2), mix(MARLOW.cap, MARLOW.fur, 0.55));
    for (const [x, y] of [[-18, -12], [-4, -18], [12, -20], [22, -12], [-24, -4]]) {
      strokePath(ctx, (c) => { c.moveTo(hx + x, hy + y); c.lineTo(hx + x + 3, hy + y - 4); }, mix(MARLOW.fur, CREAM, 0.35), 2);
    }
    // pale cheek pouches + chin
    fillPath(ctx, (c) => {
      ellipse(c, hx + 24, hy + 13, 16, 13);
      ellipse(c, hx + 4, hy + 15, 15, 12);
      ellipse(c, hx + 16, hy + 24, 14, 8);
    }, MARLOW.pale);
    fillPath(ctx, (c) => ellipse(c, hx + 8, hy + 30, 26, 5), paleD);
  });
  // near ear (low on the back of the head)
  inked(ctx, (c) => circle(c, hx - 22, hy - 10, 8.5), MARLOW.furD, 4);
  fillPath(ctx, (c) => circle(c, hx - 22, hy - 9, 4.2), mix(PINK, MARLOW.furD, 0.45));
  // eyes at the edge of the cap
  fillPath(ctx, (c) => { ellipse(c, hx + 6, hy - 6, 7.5, 8.5); ellipse(c, hx + 24, hy - 6, 6, 7.5); }, MARLOW.pale);
  eye(ctx, hx + 6, hy - 6, 5, 6.5, p.eyes);
  eye(ctx, hx + 24, hy - 6, 4, 6, p.eyes);
  // nose on the muzzle tip
  inked(ctx, (c) => ellipse(c, hx + 36, hy + 4, 6.5, 4.8), INK2, 1.5);
  fillPath(ctx, (c) => circle(c, hx + 34, hy + 2.5, 1.6), mix(INK2, CREAM, 0.5));
  // split lip
  strokePath(ctx, (c) => {
    c.moveTo(hx + 34, hy + 9); c.lineTo(hx + 34, hy + 12);
    c.moveTo(hx + 26, hy + 13);
    c.quadraticCurveTo(hx + 30, hy + 16, hx + 34, hy + 12);
    c.quadraticCurveTo(hx + 37, hy + 15, hx + 40, hy + 13);
  }, INK, 2.2);
  for (const [x, y] of [[22, 9], [27, 12], [22, 14]]) fillPath(ctx, (c) => circle(c, hx + x, hy + y, 1.3), MARLOW.furD);
  // open mouth behind the teeth
  if (p.mouth !== 'smile') {
    inked(ctx, (c) => ellipse(c, hx + 31, hy + 22, p.mouth === 'o' ? 5 : 7.5, p.mouth === 'o' ? 5 : 7), mix(BERRY[0], INK, 0.3), 2);
    fillPath(ctx, (c) => ellipse(c, hx + 31, hy + 25, 4, 2.5), BERRY[2]);
  }
  // two big front teeth
  inked(ctx, (c) => roundRect(c, hx + 26, hy + 13, 11, 11, 2.5), tooth, 2);
  strokePath(ctx, (c) => { c.moveTo(hx + 31.5, hy + 14); c.lineTo(hx + 31.5, hy + 23); }, INK, 1.6);
  fillPath(ctx, (c) => ellipse(c, hx + 8, hy + 9, 5.5, 3.2), rgba(PINK, 0.55));
  ctx.restore();
  // near arm in front of the apron and kerchief
  arm(ctx, 108, 130, armA(p.arms[1]), 20, 14, MARLOW.fur, capD, 4);
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- Odette the owl

const ODETTE = {
  feather: ROCK[2],
  featherD: mix(ROCK[1], VIOLET[1], 0.3),
  far: mix(mix(ROCK[1], VIOLET[1], 0.3), INK, 0.15),
  face: GOAT[2],
};
const ODETTE_HEAD: [number, number] = [110, 90];

function owlFoot(ctx: Ctx, x: number, y: number, col: string, hi: string): void {
  const toes = (c: Ctx) => {
    for (const k of [-1, 0, 1]) ellipse(c, x + 4 + k * 6, y - 1 + Math.abs(k), 4, 6, 0.5 + k * 0.35);
  };
  inked(ctx, toes, col, 3);
  fillPath(ctx, (c) => { for (const k of [-1, 0, 1]) circle(c, x + 3 + k * 6, y - 4 + Math.abs(k), 1.4); }, hi);
}

function owlWing(ctx: Ctx, x: number, y: number, ang: number, col: string, dark: string, near: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const wing = (c: Ctx) => {
    c.moveTo(-11, 2);
    c.quadraticCurveTo(-15, 26, -6, 40);
    c.quadraticCurveTo(-2, 34, 0, 42);
    c.quadraticCurveTo(3, 35, 6, 40);
    c.quadraticCurveTo(15, 24, 11, 2);
    c.quadraticCurveTo(0, -8, -11, 2);
    c.closePath();
  };
  inked(ctx, wing, col, 4);
  clipped(ctx, wing, () => {
    fillPath(ctx, (c) => ellipse(c, 8, 22, 7, 24), dark);
    if (near) {
      ctx.strokeStyle = rgba(INK, 0.35);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-6, 18); ctx.quadraticCurveTo(-3, 28, -4, 36);
      ctx.moveTo(1, 18); ctx.quadraticCurveTo(2, 28, 1, 38);
      ctx.stroke();
    }
  });
  ctx.restore();
}

function drawOdette(ctx: Ctx, p: HeroPose, accent: string): void {
  const { dark: aDark, light: aLight } = accentTones(accent);
  if (p.shadow > 0) groundShadow(ctx, W / 2, GY - 1, 44 * p.shadow * p.sx, 7 * Math.min(1, p.shadow));
  ctx.save();
  frameXf(ctx, p);
  const pivot: [number, number] = [98, 168];
  const footY = GY - 5;
  // wing beat: raised wings swing far up; a down-stroke keeps them out to the sides, low
  const beat = p.flap > 0 ? p.flap * 1.0 : p.flap * 0.25;
  const wa = 0.3 + p.wing * 0.65 + beat; // near wing: + swings the tip back/up
  const fa = -(0.85 + p.wing * 0.6 + beat); // far wing: tip forward/up, always past the chest

  // far leg + foot
  const leg = (x: number, f: Ft, col: string, foot: string, hi: string) => {
    const fx = x + f.dx;
    const fy = footY - f.lift;
    strokePath(ctx, (c) => { c.moveTo(x, 176 + p.bob); c.lineTo(fx, fy - 4); }, INK, 9 + 8);
    strokePath(ctx, (c) => { c.moveTo(x, 176 + p.bob); c.lineTo(fx, fy - 4); }, col, 9);
    owlFoot(ctx, fx, fy, foot, hi);
  };
  leg(108, p.feet[0], ODETTE.far, mix(WARM[2], WARM[0], 0.35), WARM[2]);

  ctx.save();
  upperXf(ctx, p, pivot);
  // far wing behind the body
  owlWing(ctx, 122, 122, fa, ODETTE.far, mix(ODETTE.far, INK, 0.25), false);
  // ear tufts (behind the head)
  ctx.save();
  headXf(ctx, p, [106, 120]);
  const [hx, hy] = ODETTE_HEAD;
  inked(ctx, (c) => poly(c, [hx - 22, hy - 18, hx - 30, hy - 44, hx - 6, hy - 26]), ODETTE.featherD, 4);
  inked(ctx, (c) => poly(c, [hx + 6, hy - 26, hx + 16, hy - 50, hx + 24, hy - 20]), ODETTE.far, 4);
  ctx.restore();
  // round body
  const body = (c: Ctx) => ellipse(c, 98, 148, 40, 42);
  shadedBlob(ctx, body, ODETTE.feather, ODETTE.featherD, LW, [-5, -6]);
  clipped(ctx, body, () => {
    fillPath(ctx, (c) => ellipse(c, 116, 152, 21, 30, -0.1), mix(ODETTE.feather, CREAM, 0.55));
    ctx.strokeStyle = ODETTE.featherD;
    ctx.lineWidth = 2;
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.arc(108 + k * 13 + (r % 2) * 6, 140 + r * 14, 5.5, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
    }
  });
  // pocket watch on its chain
  strokePath(ctx, (c) => { c.moveTo(118, 122); c.quadraticCurveTo(134, 144, 128, 160); }, WARM[3], 2.5);
  inked(ctx, (c) => circle(c, 128, 166, 8), WARM[3], 3);
  fillPath(ctx, (c) => circle(c, 128, 166, 5), CREAM);
  strokePath(ctx, (c) => { c.moveTo(128, 163); c.lineTo(128, 166); c.lineTo(130.5, 167); }, INK, 1.4);
  ctx.restore();

  leg(92, p.feet[1], ODETTE.featherD, WARM[2], WARM[3]);

  ctx.save();
  upperXf(ctx, p, pivot);
  // near wing on the viewer's side
  owlWing(ctx, 86, 122, wa, ODETTE.feather, ODETTE.featherD, true);

  // bow (accent) at the neck
  accentTail(ctx, p, 108, 126, 16 + 6 * Math.abs(p.scarfLift), 0.6, aDark, mix(aDark, INK, 0.3), 4.5, 3.5);

  // head
  ctx.save();
  headXf(ctx, p, [106, 120]);
  const head = (c: Ctx) => ellipse(c, hx, hy, 36, 30);
  shadedBlob(ctx, head, ODETTE.feather, ODETTE.featherD, LW, [-4, -5]);
  // face discs (3/4: far disc narrower, at the front)
  fillPath(ctx, (c) => { circle(c, hx + 6, hy + 2, 15); ellipse(c, hx + 28, hy + 1, 11, 14); }, ODETTE.face);
  eye(ctx, hx + 6, hy + 2, 7, 8.5, p.eyes);
  eye(ctx, hx + 28, hy + 1, 5.6, 8, p.eyes);
  // tiny spectacles
  ctx.strokeStyle = WARM[3];
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  circle(ctx, hx + 6, hy + 3, 11);
  ellipse(ctx, hx + 28, hy + 2, 8.5, 10.5);
  ctx.moveTo(hx + 17, hy + 1);
  ctx.quadraticCurveTo(hx + 18.5, hy - 2, hx + 20, hy + 1);
  ctx.moveTo(hx - 5, hy + 1);
  ctx.lineTo(hx - 20, hy - 3);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  circle(ctx, hx + 6, hy + 3, 12.3);
  ellipse(ctx, hx + 28, hy + 2, 9.8, 11.8);
  ctx.stroke();
  fillPath(ctx, (c) => poly(c, [hx + 1, hy - 3, hx + 5, hy - 5, hx - 1, hy + 2]), rgba(CREAM, 0.7));
  // beak between the discs, pointing down
  if (p.mouth === 'open' || p.mouth === 'grin' || p.mouth === 'o') {
    inked(ctx, (c) => poly(c, [hx + 13, hy + 12, hx + 24, hy + 12, hx + 20, hy + 19]), WARM[2], 2.5);
    inked(ctx, (c) => poly(c, [hx + 14, hy + 22, hx + 22, hy + 22, hx + 19, hy + 27]), WARM[1], 2.5);
  } else {
    inked(ctx, (c) => poly(c, [hx + 13, hy + 12, hx + 24, hy + 12, hx + 19, hy + 25]), WARM[2], 2.5);
  }
  // brow tufts
  strokePath(ctx, (c) => { c.moveTo(hx - 6, hy - 14); c.quadraticCurveTo(hx + 4, hy - 19, hx + 14, hy - 13); }, ODETTE.featherD, 4);
  strokePath(ctx, (c) => { c.moveTo(hx + 21, hy - 14); c.quadraticCurveTo(hx + 28, hy - 18, hx + 36, hy - 12); }, ODETTE.featherD, 3.5);
  ctx.restore();
  // bow (accent) tied at the throat, in front of the chin so it always reads
  const bow = (c: Ctx) => {
    poly(c, [120, 127, 104, 117, 105, 137]);
    poly(c, [120, 127, 136, 117, 135, 137]);
  };
  inked(ctx, bow, accent, 3);
  clipped(ctx, bow, () => fillPath(ctx, (c) => c.rect(100, 129, 40, 10), aDark));
  inked(ctx, (c) => ellipse(c, 120, 127, 5, 5.5), aLight, 2.5);
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- Bluster the storm cloud

/** Cloud puffs relative to the cloud centre: [x, y, r] (the friend art's cluster, scaled 0.85). */
const BLUSTER_PUFFS: [number, number, number][] = [
  [-44, 7, 29], [-15, -19, 32], [20, -22, 31], [48, 2, 27], [2, 15, 39], [-34, 26, 22], [39, 26, 22],
];
const BLUSTER_C: [number, number] = [100, 118];

function drawBluster(ctx: Ctx, p: HeroPose, accent: string): void {
  const { dark: aDark, light: aLight } = accentTones(accent);
  const happy = p.eyes === 'happy';
  const baseCol = happy ? mix(VIOLET[3], SNOW[1], 0.4) : VIOLET[3];
  const dark = happy ? VIOLET[2] : mix(VIOLET[2], VIOLET[1], 0.35);
  if (p.shadow > 0) groundShadow(ctx, W / 2, GY - 1, 50 * p.shadow * p.sx, 7 * Math.min(1, p.shadow));
  ctx.save();
  frameXf(ctx, p);
  const pivot: [number, number] = [100, 170];
  const footY = GY - 11;
  const [cx, cy0] = BLUSTER_C;

  // stubby puff-feet: a small puff touching the ground, a smaller one joining the cloud
  const foot = (x: number, f: Ft, col: string, shade: string) => {
    const fx = x + f.dx;
    const fy = footY - f.lift;
    const puffFoot = (c: Ctx) => {
      circle(c, fx, fy, 10.5);
      circle(c, fx + 8, fy + 2.5, 8);
      circle(c, fx - 7, fy + 3, 6.5);
      circle(c, fx - 1, fy - 11 + p.bob * 0.5, 6.5); // little puff joining the cloud
    };
    shadedBlob(ctx, puffFoot, col, shade, 4, [-2, -3]);
  };
  foot(122, p.feet[0], mix(dark, VIOLET[1], 0.2), mix(dark, INK, 0.2));

  ctx.save();
  upperXf(ctx, p, pivot);
  // trailing puffs left behind while drifting
  if (p.trail >= 0) {
    for (let k = 0; k < 3; k++) {
      const ph = (p.trail / TAU + k / 3) % 1;
      const x = 34 - ph * 30;
      const y = 150 + Math.sin((ph + k) * 4) * 6 - ph * 10;
      const r = 8 * (1 - ph) + 2;
      ctx.globalAlpha = 1 - ph * 0.7;
      shadedBlob(ctx, (c) => circle(c, x, y, r), baseCol, dark, 3, [-1.5, -1.5]);
      ctx.globalAlpha = 1;
    }
  }
  const s = 1 + 0.07 * p.puff;
  const cy = cy0;
  const shape = (c: Ctx) => {
    for (const [x, y, r] of BLUSTER_PUFFS) circle(c, cx + x * s, cy + y * (p.puff < 0 ? 1 + 0.05 * p.puff : 1), r * s);
  };
  inked(ctx, shape, dark, LW);
  clipped(ctx, shape, () => {
    ctx.save();
    ctx.translate(-6, -8);
    fillPath(ctx, shape, baseCol);
    ctx.restore();
    fillPath(ctx, (c) => {
      ellipse(c, cx - 22 * s, cy - 32 * s, 13, 6, -0.3);
      ellipse(c, cx + 14 * s, cy - 38 * s, 10, 4.5, -0.1);
    }, SNOW[2]);
  });

  // face, turned toward the right
  const fx = cx + 20;
  const fy = cy + 6;
  const cheekR = 8 + Math.max(0, p.puff) * 5;
  fillPath(ctx, (c) => {
    ellipse(c, fx - 26, fy + 12, cheekR, cheekR * 0.7);
    ellipse(c, fx + 27, fy + 11, cheekR * 0.8, cheekR * 0.65);
  }, rgba(happy ? PINK : BERRY[2], 0.55 + Math.max(0, p.puff) * 0.25));
  eye(ctx, fx - 13, fy - 4, 6.5, 8.5, p.eyes);
  eye(ctx, fx + 14, fy - 5, 5.4, 7.6, p.eyes);
  // brows: grumpy (inner ends down) unless cheering
  const browUp = happy ? -5 : 0;
  const tilt = happy ? -4 : 6;
  strokePath(ctx, (c) => { c.moveTo(fx - 25, fy - 18 + browUp); c.lineTo(fx - 6, fy - 18 + tilt + browUp); }, INK, 5.5);
  strokePath(ctx, (c) => { c.moveTo(fx + 25, fy - 19 + browUp); c.lineTo(fx + 8, fy - 19 + tilt + browUp); }, INK, 5);
  // mouth
  if (happy) {
    const m = (c: Ctx) => {
      c.moveTo(fx - 11, fy + 10);
      c.quadraticCurveTo(fx, fy + 27, fx + 11, fy + 10);
      c.closePath();
    };
    inked(ctx, m, mix(BERRY[0], INK, 0.3), 2);
    clipped(ctx, m, () => fillPath(ctx, (c) => ellipse(c, fx, fy + 22, 6, 4), BERRY[2]));
  } else if (p.mouth === 'o' || p.mouth === 'open') {
    inked(ctx, (c) => ellipse(c, fx, fy + 15, 5, 6), mix(BERRY[0], INK, 0.3), 2.5);
    fillPath(ctx, (c) => ellipse(c, fx, fy + 16, 2.5, 3), INK2);
  } else if (p.mouth === 'grin') {
    // puffed cheeks, lips pressed (holding his breath on the way up)
    strokePath(ctx, (c) => { c.moveTo(fx - 7, fy + 15); c.quadraticCurveTo(fx, fy + 12, fx + 7, fy + 15); }, INK, 3.5);
  } else {
    // grumpy wobbly pout
    strokePath(ctx, (c) => {
      c.moveTo(fx - 9, fy + 18);
      c.quadraticCurveTo(fx - 4, fy + 12, fx, fy + 15);
      c.quadraticCurveTo(fx + 4, fy + 12, fx + 9, fy + 18);
    }, INK, 3.4);
  }
  // bow tie (accent) under the face
  const bx = fx - 2;
  const by = cy + 37;
  const tie = (c: Ctx) => {
    poly(c, [bx, by, bx - 15, by - 9, bx - 15, by + 9]);
    poly(c, [bx, by, bx + 15, by - 9, bx + 15, by + 9]);
  };
  inked(ctx, tie, accent, 3);
  clipped(ctx, tie, () => fillPath(ctx, (c) => c.rect(bx - 20, by + 2, 40, 10), aDark));
  inked(ctx, (c) => ellipse(c, bx, by, 4.5, 5), aLight, 2.5);
  if (happy) {
    for (const [x, y, r] of [[26, 60, 7], [176, 70, 6]]) inked(ctx, (c) => star4(c, x, y, r, 0.3), WARM[3], 1.5);
  }
  ctx.restore();

  // near puff-foot, in front of the cloud's underside
  foot(82, p.feet[1], baseCol, dark);
  ctx.restore();
}

// ---------------------------------------------------------------- rigs, sheets, anchors

const RIGS: Record<NonJuniper, Rig> = {
  pip: { style: 'hop', pivot: [96, 160], neck: [110, 124], hat: [PIP_HEAD[0] - 2, PIP_HEAD[1] - 25 + 30 * 0.92], hatScale: 0.92, hatRot: -0.05, draw: drawPip },
  marlow: { style: 'waddle', pivot: [98, 172], neck: [108, 114], hat: [MARLOW_HEAD[0] + 2, MARLOW_HEAD[1] - 28 + 30 * 1.05], hatScale: 1.05, hatRot: -0.1, draw: drawMarlow },
  odette: { style: 'owl', pivot: [98, 168], neck: [106, 120], hat: [ODETTE_HEAD[0] + 2, ODETTE_HEAD[1] - 29 + 30 * 1.05], hatScale: 1.05, hatRot: -0.12, draw: drawOdette },
  bluster: { style: 'drift', pivot: [100, 170], neck: [BLUSTER_C[0], BLUSTER_C[1]], hat: [BLUSTER_C[0] + 16, BLUSTER_C[1] - 50 + 30 * 1.1], hatScale: 1.1, hatRot: -0.16, draw: drawBluster },
};

const poseCache: Partial<Record<NonJuniper, HeroPose[]>> = {};
export function posesFor(hero: NonJuniper): HeroPose[] {
  return (poseCache[hero] ??= heroPoses(RIGS[hero].style));
}

/** Draw one frame of a non-Juniper hero into a 200x200 cell. */
export function drawHero(ctx: Ctx, hero: NonJuniper, frame: number, accent: string): void {
  const poses = posesFor(hero);
  drawPose(ctx, hero, poses[Math.max(0, Math.min(poses.length - 1, frame))], accent);
}

/** Overall size of each rig about the feet (tunes on-screen size against Juniper). */
const SIZE: Record<NonJuniper, number> = { pip: 1, marlow: 1.08, odette: 1, bluster: 1 };

function drawPose(ctx: Ctx, hero: NonJuniper, p: HeroPose, accent: string): void {
  const k = SIZE[hero];
  ctx.save();
  ctx.translate(W / 2, GY);
  ctx.scale(k, k);
  ctx.translate(-W / 2, -GY);
  RIGS[hero].draw(ctx, p, accent);
  ctx.restore();
}

/** Build the 19-frame sheet (10 columns, like Juniper's) for a hero and accent colour. */
export function buildHeroSheet(hero: NonJuniper, scarf: number): SheetSpec {
  const accent = hex(SCARF_COLOURS[scarf % SCARF_COLOURS.length]);
  return makeSheet(heroKey(hero, scarf), W, H, JUNIPER_FRAMES.count, (ctx, i) => drawHero(ctx, hero, i, accent), 10);
}

/** The six animations of a hero sheet, same frames and timings as Juniper's. */
export function heroAnimSpecs(hero: HeroId, scarf: number): AnimSpec[] {
  return juniperAnimSpecs(heroKey(hero, scarf), (b) => heroAnim(b, hero, scarf));
}

/**
 * Where a hat goes on a hero (sprite origin = feet at bottom-centre, facing right, scale 1):
 * place the hat (origin 0.5, 1) at (dx, dy), rotate by rot, scale by scale. Facing left:
 * negate dx and rot and flipX the hat. Mirrors each rig's transforms frame by frame.
 */
export function heroHatAnchor(hero: HeroId, frame: number): { dx: number; dy: number; rot: number; scale: number } {
  if (hero === 'juniper') return { ...juniperHatAnchor(frame), scale: 1 };
  const rig = RIGS[hero];
  const poses = posesFor(hero);
  const p = poses[Math.max(0, Math.min(poses.length - 1, frame))];
  let [x, y] = rotAbout(rig.hat[0], rig.hat[1], rig.neck[0], rig.neck[1], p.headTilt);
  y += p.bob;
  [x, y] = rotAbout(x, y, rig.pivot[0], rig.pivot[1], p.lean);
  y -= p.lift;
  const k = SIZE[hero];
  x = W / 2 + (x - W / 2) * p.sx * k;
  y = GY + (y - GY) * p.sy * k;
  return { dx: x - W / 2, dy: y - H, rot: rig.hatRot + p.headTilt + p.lean, scale: rig.hatScale * k };
}

// ---------------------------------------------------------------- portraits (160x160, boot)

const PORTRAIT = 160;
/** Head-ish centre of each hero in frame space, and the zoom used for its bust. */
const PORTRAIT_FIT: Record<HeroId, { x: number; y: number; k: number }> = {
  juniper: { x: 130, y: 100, k: 1.12 },
  pip: { x: 112, y: 88, k: 1.08 },
  marlow: { x: 112, y: 96, k: 1.15 },
  odette: { x: 108, y: 100, k: 1.2 },
  bluster: { x: 112, y: 126, k: 1.05 },
};

function drawPortrait(ctx: Ctx, hero: HeroId): void {
  const r = PORTRAIT / 2 - 6;
  const disc = (c: Ctx) => circle(c, PORTRAIT / 2, PORTRAIT / 2, r);
  inked(ctx, disc, SNOW[0], 4);
  clipped(ctx, disc, () => {
    fillPath(ctx, (c) => ellipse(c, PORTRAIT / 2 - 18, PORTRAIT / 2 - 22, 46, 38), SNOW[1]);
    const f = PORTRAIT_FIT[hero];
    ctx.save();
    ctx.translate(PORTRAIT / 2, PORTRAIT / 2 + 10);
    ctx.scale(f.k, f.k);
    ctx.translate(-f.x, -f.y);
    const accent = hex(SCARF_COLOURS[0]);
    if (hero === 'juniper') {
      const p = { ...juniperPoses()[0], shadow: 0 };
      drawJuniper(ctx, p, accent);
    } else {
      drawPose(ctx, hero, { ...posesFor(hero)[0], shadow: 0 }, accent);
    }
    ctx.restore();
  });
  strokePath(ctx, disc, INK, 4);
}

/** Boot-time portraits for every hero (5 x 160x160, ~0.5 MB). */
export function buildHeroPortraits(): { sheets: SheetSpec[] } {
  return { sheets: HERO_IDS.map((h) => single(heroPortraitKey(h), PORTRAIT, PORTRAIT, (ctx) => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    drawPortrait(ctx, h);
  })) };
}
