// Flurries: ten kinds of small, shy snow-sprites left behind by Bluster's wind.
// flurryKey(kind): 4 frames 96x96, origin (0.5, 1): 0-1 wander bob, 2 startled/darting, 3 happy.
// Kinds 2z and 2z+1 belong to camp z:
//   0 Puffle   meadow puffball       (cream fluff, yellow buds)       1 Nib      snowdrop sprite  (lilac drop, white flower)
//   2 Twigget  pine-twig sprite      (snow ball, pine sprig, twigs)   3 Hushwing hush-owl-moth   (dusk violet, moth wings)
//   4 Glint    crystal glint sprite  (rose-quartz faceted crystal)       5 Drip     water-drip       (blue drop, ripple)
//   6 Tocky    clockwork tick sprite (snow ball, brass key, clock)    7 Whirr    whirlwind        (peach swirl cone)
//   8 Auro     aurora ribbon sprite  (mint ball, aurora ribbon)       9 Starlet  little star      (gold star body)
// Silhouettes: every shape is opaque with hard edges (no big soft glows), so a Phaser
// setTintFill(0x2e2a5c) reads cleanly; flurrySilhouette() paints the same thing into a canvas.
import { FLURRY_KINDS, flurryKey } from './keys';
import {
  INK, INK2, VIOLET, SNOW, ICE, PINE, WARM, BERRY, WOOD, GOAT, SKY_DAY, SKY_DUSK, CREAM, PINK, mix, rgba,
} from './palette';
import {
  Ctx, PathFn, SheetSpec, makeSheet, makeCanvas, inked, fillPath, strokePath, clipped, ellipse, circle, poly,
  star4, star5, groundShadow, bandGlow, TAU,
} from './draw';

const LW = 3.5;

type Mood = 'calm' | 'startled' | 'happy';

interface Pose { lift: number; sx: number; sy: number; rot: number; mood: Mood; f: number }

const POSES: Pose[] = [
  { lift: 0, sx: 1, sy: 1, rot: 0, mood: 'calm', f: 0 },
  { lift: 3, sx: 0.96, sy: 1.04, rot: 0.04, mood: 'calm', f: 1 },
  { lift: 7, sx: 0.92, sy: 1.08, rot: -0.14, mood: 'startled', f: 2 },
  { lift: 5, sx: 1.06, sy: 0.95, rot: 0, mood: 'happy', f: 3 },
];

interface Kind {
  base: string;
  shade: string;
  light: string;
  body: PathFn;
  /** eye centre y, half-gap, eye radius */
  eye: [number, number, number];
  float?: number;
  feet?: string | false;
  back?: (ctx: Ctx, p: Pose) => void;
  front?: (ctx: Ctx, p: Pose) => void;
  /** extra decoration in frame space (not squashed) */
  fx?: (ctx: Ctx, p: Pose, cx: number, cy: number) => void;
  blush?: string;
}

function inkedStroke(ctx: Ctx, path: PathFn, col: string, w: number, lw = 2.5): void {
  strokePath(ctx, path, INK, w + lw * 2);
  strokePath(ctx, path, col, w);
}

function sparkle(ctx: Ctx, x: number, y: number, r: number): void {
  inked(ctx, (c) => star4(c, x, y, r, 0.3), CREAM, 1.5, INK2);
}

function face(ctx: Ctx, k: Kind, mood: Mood): void {
  const [ey, gap, r] = k.eye;
  const blush = k.blush ?? PINK;
  for (const d of [-1, 1]) {
    const x = d * gap;
    if (mood === 'calm') {
      fillPath(ctx, (c) => ellipse(c, x, ey, r, r * 1.25), INK2);
      fillPath(ctx, (c) => circle(c, x - r * 0.32, ey - r * 0.45, r * 0.45), CREAM);
      fillPath(ctx, (c) => circle(c, x + r * 0.35, ey + r * 0.45, r * 0.2), CREAM);
    } else if (mood === 'startled') {
      inked(ctx, (c) => ellipse(c, x, ey, r * 1.12, r * 1.35), CREAM, 2);
      fillPath(ctx, (c) => circle(c, x + d * 0.5, ey + 0.5, r * 0.55), INK2);
      fillPath(ctx, (c) => circle(c, x - r * 0.15, ey - r * 0.2, r * 0.2), CREAM);
    } else {
      strokePath(ctx, (c) => {
        c.moveTo(x - r, ey + 1.5);
        c.quadraticCurveTo(x, ey - r * 1.4, x + r, ey + 1.5);
      }, INK, 3);
    }
    fillPath(ctx, (c) => ellipse(c, x + d * (r * 0.9), ey + r * 1.6, r * 0.75, r * 0.42), rgba(blush, mood === 'happy' ? 0.85 : 0.6));
  }
  const my = ey + r * 1.7;
  if (mood === 'calm') {
    strokePath(ctx, (c) => { c.moveTo(-3.5, my - 0.5); c.quadraticCurveTo(0, my + 3, 3.5, my - 0.5); }, INK, 2.2);
  } else if (mood === 'startled') {
    inked(ctx, (c) => ellipse(c, 0, my + 1.5, 2.6, 3.2), mix(BERRY[0], INK, 0.3), 1.4);
  } else {
    const m = (c: Ctx) => { c.moveTo(-5, my - 1); c.quadraticCurveTo(0, my - 0.2, 5, my - 1); c.quadraticCurveTo(0, my + 7, -5, my - 1); c.closePath(); };
    inked(ctx, m, mix(BERRY[0], INK, 0.3), 1.3);
    clipped(ctx, m, () => fillPath(ctx, (c) => ellipse(c, 0, my + 4, 3, 2), BERRY[2]));
  }
}

function blob(ctx: Ctx, path: PathFn, base: string, shade: string, light: string, off: [number, number] = [-4, -4], lw = LW): void {
  inked(ctx, path, shade, lw);
  clipped(ctx, path, () => {
    ctx.save();
    ctx.translate(off[0], off[1]);
    fillPath(ctx, path, base);
    ctx.restore();
    fillPath(ctx, (c) => ellipse(c, -9, -12, 6, 3.5, -0.6), light);
  });
}

// ---------------------------------------------------------------- the ten kinds

const AUR = [PINE[3], ICE[2], '#b48cf0'];

const KINDS: Kind[] = [
  // 0 Puffle: dandelion-fluff puffball with two yellow buds
  {
    base: SNOW[2], shade: mix(SNOW[0], VIOLET[3], 0.5), light: CREAM, blush: WARM[3],
    body: (c) => {
      circle(c, 0, 0, 19);
      for (let k = 0; k < 13; k++) circle(c, Math.cos((k / 13) * TAU) * 19, Math.sin((k / 13) * TAU) * 18, 6.5);
    },
    eye: [-2, 8, 5], feet: mix(SNOW[0], VIOLET[3], 0.5),
    back: () => {},
    front: (ctx, p) => {
      const sway = p.f === 1 ? 2 : p.f === 2 ? -3 : 0;
      for (const [x, tx, ty, r] of [[-4, -9 + sway, -36, 5], [4, 7 + sway, -40, 6]] as number[][]) {
        inkedStroke(ctx, (c) => { c.moveTo(x, -22); c.quadraticCurveTo(x, -30, tx, ty); }, PINE[2], 2.2, 2);
        inked(ctx, (c) => {
          for (let k = 0; k < 6; k++) circle(c, tx + Math.cos((k / 6) * TAU) * r * 0.55, ty + Math.sin((k / 6) * TAU) * r * 0.55, r * 0.55);
        }, WARM[3], 2.2);
        fillPath(ctx, (c) => circle(c, tx - r * 0.3, ty - r * 0.3, r * 0.35), WARM[4]);
      }
    },
    fx: (ctx, p, cx, cy) => {
      if (p.mood !== 'happy') return;
      for (const [dx, dy] of [[26, -30], [-28, -22]]) {
        const x = cx + dx;
        const y = cy + dy;
        strokePath(ctx, (c) => { c.moveTo(x, y + 6); c.lineTo(x, y); }, INK, 3.5);
        strokePath(ctx, (c) => { c.moveTo(x, y + 6); c.lineTo(x, y); }, CREAM, 1.2);
        inked(ctx, (c) => { for (let k = 0; k < 5; k++) circle(c, x + Math.cos((k / 5) * TAU) * 2.5, y - 2 + Math.sin((k / 5) * TAU) * 2.5, 1.8); }, CREAM, 1.4);
      }
    },
  },
  // 1 Nib: lilac snowdrop sprite with a drooping snowdrop flower on its head
  {
    base: mix(SNOW[1], VIOLET[3], 0.55), shade: VIOLET[2], light: CREAM,
    body: (c) => {
      c.moveTo(0, -25);
      c.bezierCurveTo(14, -25, 23, -2, 22, 8);
      c.bezierCurveTo(21, 22, -21, 22, -22, 8);
      c.bezierCurveTo(-23, -2, -14, -25, 0, -25);
      c.closePath();
    },
    eye: [1, 8, 5], feet: VIOLET[2],
    front: (ctx, p) => {
      const nod = p.f === 1 ? 2 : p.f === 3 ? -2 : 0;
      inkedStroke(ctx, (c) => { c.moveTo(0, -23); c.bezierCurveTo(0, -40, 18, -44, 22 + nod, -32); }, PINE[2], 2.6, 2);
      // leaf
      inked(ctx, (c) => { c.moveTo(1, -26); c.quadraticCurveTo(-12, -36, -14, -46); c.quadraticCurveTo(-2, -42, 1, -26); c.closePath(); }, PINE[2], 2.2);
      // hanging flower: green cap + three white petals
      const fx = 22 + nod;
      const fy = -30;
      for (const [dx, rot] of [[-4.5, 0.35], [4.5, -0.35], [0, 0]] as [number, number][]) {
        ctx.save();
        ctx.translate(fx + dx * 0.6, fy);
        ctx.rotate(rot);
        inked(ctx, (c) => { c.moveTo(-4, 0); c.bezierCurveTo(-6, 8, -3, 14, 0, 15); c.bezierCurveTo(3, 14, 6, 8, 4, 0); c.closePath(); }, dx === 0 ? SNOW[2] : SNOW[1], 2);
        fillPath(ctx, (c) => ellipse(c, 0, 12, 1.6, 1.3), PINE[2]);
        ctx.restore();
      }
      inked(ctx, (c) => ellipse(c, fx, fy, 4, 3), PINE[1], 2);
    },
  },
  // 2 Twigget: snowball body with a pine sprig crest and twig arms
  {
    base: mix(SNOW[1], ICE[2], 0.4), shade: mix(ICE[1], VIOLET[2], 0.45), light: ICE[3],
    body: (c) => ellipse(c, 0, 0, 21, 22),
    eye: [-1, 8, 5], feet: mix(WOOD[1], VIOLET[1], 0.3),
    back: (ctx, p) => {
      const wave = p.mood === 'happy' ? -8 : p.mood === 'startled' ? -12 : p.f === 1 ? -3 : 0;
      for (const d of [-1, 1]) {
        inkedStroke(ctx, (c) => {
          c.moveTo(d * 17, 4);
          c.lineTo(d * 30, -2 + wave * (d > 0 ? 1 : 0.5));
          c.moveTo(d * 25, 0 + wave * 0.4 * (d > 0 ? 1 : 0.5));
          c.lineTo(d * 30, 8);
        }, WOOD[1], 3, 2);
      }
      // pine sprig crest: needles fanning up
      for (let k = -4; k <= 4; k++) {
        const a = -Math.PI / 2 + k * 0.24;
        const len = 14 + (4 - Math.abs(k)) * 2;
        inkedStroke(ctx, (c) => { c.moveTo(0, -18); c.lineTo(Math.cos(a) * len, -18 + Math.sin(a) * len); }, k % 2 ? PINE[1] : PINE[2], 3, 1.8);
      }
      inked(ctx, (c) => ellipse(c, 0, -19, 5, 3.5), WOOD[1], 2);
    },
    front: (ctx) => {
      // a tiny pinecone badge on the tummy
      inked(ctx, (c) => ellipse(c, 0, 14, 3.4, 4.4), WOOD[1], 1.8);
      strokePath(ctx, (c) => { c.moveTo(-2.5, 13); c.lineTo(2.5, 13); c.moveTo(-2.5, 16); c.lineTo(2.5, 16); }, WOOD[0], 1);
    },
  },
  // 3 Hushwing: dusk-violet owl-moth with big soft wings, ear tufts and a pale face disc
  {
    base: mix(VIOLET[2], SNOW[1], 0.25), shade: VIOLET[1], light: VIOLET[3], blush: BERRY[2],
    body: (c) => ellipse(c, 0, 0, 21, 21),
    eye: [-2, 8.5, 5.5], float: 4, feet: false,
    back: (ctx, p) => {
      const flap = p.f === 1 ? 0.12 : p.f === 2 ? 0.22 : p.f === 3 ? -0.15 : 0;
      for (const d of [-1, 1]) {
        ctx.save();
        ctx.translate(d * 10, -4);
        ctx.rotate(d * (-0.25 - flap));
        const wing = (c: Ctx) => {
          c.moveTo(0, 6);
          c.bezierCurveTo(d * 20, -30, d * 44, -18, d * 36, 4);
          c.bezierCurveTo(d * 42, 20, d * 20, 24, 0, 10);
          c.closePath();
        };
        inked(ctx, wing, mix(VIOLET[1], INK2, 0.35), 3);
        clipped(ctx, wing, () => {
          fillPath(ctx, (c) => ellipse(c, d * 24, -6, 13, 10), VIOLET[1]);
          fillPath(ctx, (c) => ellipse(c, d * 30, 12, 8, 6), mix(VIOLET[1], VIOLET[2], 0.5));
        });
        // moon eyespot
        inked(ctx, (c) => circle(c, d * 25, -5, 5), WARM[4], 2);
        fillPath(ctx, (c) => circle(c, d * 26.5, -6, 2.4), mix(VIOLET[1], INK2, 0.3));
        ctx.restore();
      }
      // ear tufts
      for (const d of [-1, 1]) {
        inked(ctx, (c) => { c.moveTo(d * 6, -17); c.quadraticCurveTo(d * 12, -32, d * 18, -34); c.quadraticCurveTo(d * 18, -24, d * 15, -14); c.closePath(); }, mix(VIOLET[2], SNOW[1], 0.25), 2.5);
      }
    },
    front: (ctx) => {
      // pale facial disc behind the eyes (drawn on the body, under the face)
      fillPath(ctx, (c) => { ellipse(c, -8.5, -2, 9, 9); ellipse(c, 8.5, -2, 9, 9); }, rgba(SNOW[2], 0.85));
      // tiny beak
      inked(ctx, (c) => poly(c, [-2.5, 5, 2.5, 5, 0, 9]), WARM[3], 1.4);
    },
  },
  // 4 Glint: lavender faceted crystal sprite with floating shards
  {
    base: '#f6cfe8', shade: '#c27ab4', light: '#fff0fa', blush: BERRY[1],
    body: (c) => poly(c, [0, -30, 17, -14, 21, 8, 9, 22, -9, 22, -21, 8, -17, -14]),
    eye: [0, 7.5, 5], feet: '#c27ab4',
    front: (ctx) => {
      ctx.strokeStyle = rgba('#a0559a', 0.7);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      poly(ctx, [-17, -14, -7, -10, 0, -30], false);
      poly(ctx, [-7, -10, 7, -10, 17, -14], false);
      poly(ctx, [7, -10, 0, -30], false);
      ctx.stroke();
      fillPath(ctx, (c) => poly(c, [-15, -13, -8, -10, -1, -27]), rgba('#fff0fa', 0.9));
    },
    fx: (ctx, p, cx, cy) => {
      const bob = p.f === 1 ? -3 : 0;
      for (const [dx, dy, s, a] of [[-30, -18, 6, 0.4], [29, -26, 5, -0.3], [31, 6, 4, 0.8]]) {
        ctx.save();
        ctx.translate(cx + dx, cy + dy + bob);
        ctx.rotate(a);
        inked(ctx, (c) => poly(c, [0, -s * 1.4, s * 0.7, 0, 0, s * 1.4, -s * 0.7, 0]), '#f6cfe8', 2);
        fillPath(ctx, (c) => poly(c, [0, -s * 1.4, -s * 0.7, 0, 0, 0]), '#fff0fa');
        ctx.restore();
      }
      if (p.mood === 'happy') sparkle(ctx, cx + 20, cy - 34, 6);
    },
  },
  // 5 Drip: a round blue water-drop with a ripple under it
  {
    base: SKY_DAY[1], shade: SKY_DAY[0], light: '#d6ecff',
    body: (c) => {
      c.moveTo(0, -32);
      c.bezierCurveTo(6, -20, 21, -10, 21, 4);
      c.bezierCurveTo(21, 16, 11, 22, 0, 22);
      c.bezierCurveTo(-11, 22, -21, 16, -21, 4);
      c.bezierCurveTo(-21, -10, -6, -20, 0, -32);
      c.closePath();
    },
    eye: [2, 8, 5], feet: false, float: 3,
    front: (ctx) => {
      // inner reflection
      fillPath(ctx, (c) => { c.moveTo(-6, -20); c.quadraticCurveTo(-16, -6, -15, 6); c.quadraticCurveTo(-11, 0, -4, -18); c.closePath(); }, rgba('#d6ecff', 0.95));
      fillPath(ctx, (c) => ellipse(c, 12, 14, 5, 2.4, -0.5), rgba('#b6dcff', 0.8));
    },
    fx: (ctx, p, cx) => {
      const r = p.f === 1 ? 26 : p.f === 2 ? 18 : 22;
      strokePath(ctx, (c) => ellipse(c, cx, 88, r, 4), rgba(SKY_DAY[0], 0.7), 2.5);
      strokePath(ctx, (c) => ellipse(c, cx, 88, r * 0.6, 2.4), rgba(SKY_DAY[1], 0.7), 2);
      if (p.mood === 'happy') {
        for (const [dx, dy, s] of [[-26, -28, 3.5], [24, -34, 3]]) inked(ctx, (c) => circle(c, cx + dx, 60 + dy, s), SKY_DAY[1], 1.6);
      }
    },
  },
  // 6 Tocky: snowball with a clock-face tummy, brass wind-up key and a spring antenna
  {
    base: mix(SNOW[2], GOAT[1], 0.65), shade: mix(GOAT[0], VIOLET[2], 0.45), light: CREAM, blush: WARM[2],
    body: (c) => circle(c, 0, 0, 22),
    eye: [-8, 8, 4.4], feet: mix(WARM[2], WOOD[2], 0.4),
    back: (ctx, p) => {
      const turn = p.f % 2 ? 0.5 : 0;
      // wind-up key on its back (left)
      inkedStroke(ctx, (c) => { c.moveTo(-18, 2); c.lineTo(-30, 2); }, mix(WARM[3], WOOD[3], 0.25), 4, 2);
      ctx.save();
      ctx.translate(-33, 2);
      ctx.scale(1, Math.cos(turn) * 0.9 + 0.1);
      inked(ctx, (c) => { ellipse(c, -4, -8, 5, 7, 0.3); ellipse(c, -4, 8, 5, 7, -0.3); }, mix(WARM[3], WOOD[3], 0.25), 2.5);
      fillPath(ctx, (c) => { circle(c, -4, -8, 2); circle(c, -4, 8, 2); }, mix(SNOW[0], VIOLET[3], 0.55));
      ctx.restore();
      // spring antenna with a brass bead
      const sway = p.mood === 'startled' ? 6 : p.f === 1 ? -2 : 0;
      const sp = (c: Ctx) => {
        c.moveTo(2, -20);
        for (let k = 0; k <= 12; k++) {
          const t = k / 12;
          c.lineTo(2 + Math.sin(t * TAU * 2) * 3 + t * sway, -20 - t * 11);
        }
      };
      strokePath(ctx, sp, INK, 5);
      strokePath(ctx, sp, mix(VIOLET[3], SNOW[1], 0.4), 2);
      inked(ctx, (c) => circle(c, 2 + sway, -34, 4.2), WARM[3], 2.2);
      fillPath(ctx, (c) => circle(c, 0.6 + sway, -35.4, 1.5), WARM[4]);
    },
    front: (ctx, p) => {
      const f = (c: Ctx) => circle(c, 0, 13.5, 6.5);
      inked(ctx, f, CREAM, 2);
      strokePath(ctx, (c) => circle(c, 0, 13.5, 5.2), mix(WARM[3], WOOD[3], 0.25), 1.6);
      const ang = [-0.6, 0.2, 1.2, -1.6][p.f];
      strokePath(ctx, (c) => { c.moveTo(0, 13.5); c.lineTo(Math.sin(ang) * 4.2, 13.5 - Math.cos(ang) * 4.2); c.moveTo(0, 13.5); c.lineTo(2.6, 14.5); }, INK, 1.6);
    },
  },
  // 7 Whirr: a peach whirlwind cone with a curling tail, wind curls around it
  {
    base: mix(SNOW[2], SKY_DUSK[3], 0.3), shade: mix(SKY_DUSK[2], SNOW[1], 0.35), light: CREAM, blush: SKY_DUSK[2],
    body: (c) => {
      c.moveTo(-24, -12);
      c.bezierCurveTo(-24, -30, 24, -30, 24, -12);
      c.bezierCurveTo(24, 2, 12, 10, 6, 18);
      c.bezierCurveTo(2, 24, 6, 30, 12, 28);
      c.bezierCurveTo(6, 34, -4, 30, -4, 22);
      c.bezierCurveTo(-6, 12, -24, 4, -24, -12);
      c.closePath();
    },
    eye: [-12, 8, 4.8], feet: false, float: 6,
    front: (ctx, p) => {
      const ph = p.f * 0.8;
      ctx.save();
      ctx.beginPath();
      KINDS[7].body(ctx);
      ctx.clip();
      for (const [y, w] of [[2, 20], [12, 12]] as [number, number][]) {
        strokePath(ctx, (c) => { c.moveTo(-w, y - 4 + Math.sin(ph) * 2); c.quadraticCurveTo(0, y + 4, w + 4, y - 6); }, mix(SKY_DUSK[2], SNOW[1], 0.2), 2.6);
      }
      ctx.restore();
    },
    fx: (ctx, p, cx, cy) => {
      const ph = p.f;
      for (const [dx, dy, r, s] of [[-32, -6, 7, 1], [30, 2, 6, -1], [-26, 18, 5, 1]]) {
        const x = cx + dx + (ph % 2 ? 2 : 0);
        const y = cy + dy;
        const curl = (c: Ctx) => { c.moveTo(x - s * 8, y + 2); c.quadraticCurveTo(x, y + r, x + s * 2, y); c.arc(x, y - r * 0.4, r * 0.55, s > 0 ? 0.4 : 2.7, s > 0 ? -2.6 : 5.8, s < 0); };
        strokePath(ctx, curl, rgba(INK, 0.8), 5);
        strokePath(ctx, curl, CREAM, 2);
      }
    },
  },
  // 8 Auro: mint snow ball wrapped by a long aurora ribbon
  {
    base: mix(SNOW[2], PINE[3], 0.22), shade: mix(PINE[3], VIOLET[2], 0.5), light: CREAM, blush: '#b48cf0',
    body: (c) => circle(c, 0, 0, 21),
    eye: [-2, 8, 5], feet: false, float: 3,
    back: (ctx, p) => {
      const wv = [0, 4, -6, 2][p.f];
      const rib = (c: Ctx) => {
        c.moveTo(16, 6);
        c.bezierCurveTo(36, -6, 28, -34, 4, -30);
        c.bezierCurveTo(-16, -27, -24, -12 + wv, -36, -16 + wv);
      };
      strokePath(ctx, rib, INK, 15);
      strokePath(ctx, rib, AUR[0], 10);
      ctx.save();
      ctx.translate(1, 2);
      strokePath(ctx, rib, AUR[1], 5);
      ctx.restore();
      ctx.save();
      ctx.translate(2, 4);
      strokePath(ctx, rib, AUR[2], 2.2);
      ctx.restore();
    },
    front: (ctx, p) => {
      const wv = [0, 3, 6, -2][p.f];
      const rib = (c: Ctx) => {
        c.moveTo(-18, 10);
        c.bezierCurveTo(-4, 18, 10, 18, 18, 8);
        c.bezierCurveTo(24, 2, 32, 16 + wv, 38, 11 + wv);
      };
      strokePath(ctx, rib, INK, 13);
      strokePath(ctx, rib, AUR[2], 8);
      ctx.save();
      ctx.translate(0, -2);
      strokePath(ctx, rib, AUR[1], 3.4);
      ctx.restore();
    },
  },
  // 9 Starlet: a chubby gold five-point star
  {
    base: WARM[4], shade: WARM[3], light: CREAM, blush: WARM[2],
    body: (c) => star5(c, 0, -2, 29, 0.6),
    eye: [-2, 7.5, 4.6], feet: false, float: 6,
    back: (ctx) => bandGlow(ctx, 0, -2, 38, WARM[4], 0.18, 3),
    fx: (ctx, p, cx, cy) => {
      const tw = [[-30, -24, 5], [30, -18, 4], [26, 22, 3]];
      tw.forEach(([dx, dy, r], i) => {
        const rr = r * (1 + 0.4 * Math.sin(p.f * 1.7 + i * 2));
        sparkle(ctx, cx + dx, cy + dy, rr);
      });
    },
  },
];

// ---------------------------------------------------------------- drawing

/** Draw one Flurry frame into a 96x96 cell. */
export function drawFlurry(ctx: Ctx, kind: number, frame: number, withShadow = true): void {
  const k = KINDS[kind % FLURRY_KINDS];
  const p = POSES[frame % POSES.length];
  const fl = k.float ?? 0;
  const cx = 48;
  const cy = 62 - p.lift - fl;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (withShadow) groundShadow(ctx, 48, 89, (fl ? 15 : 20) * (1 - p.lift / 40), 4, 0.35);
  ctx.save();
  ctx.translate(cx, cy + 22);
  ctx.rotate(p.rot);
  ctx.scale(p.sx, p.sy);
  ctx.translate(0, -22);
  k.back?.(ctx, p);
  if (k.feet) {
    const step = p.f === 1 ? 2 : 0;
    for (const d of [-1, 1]) inked(ctx, (c) => ellipse(c, d * 9, 22 - (d > 0 ? step : 0), 7, 4.5), k.feet as string, 3);
  }
  blob(ctx, k.body, k.base, k.shade, k.light);
  if (kind % FLURRY_KINDS === 3) k.front?.(ctx, p);
  face(ctx, k, p.mood);
  if (kind % FLURRY_KINDS !== 3) k.front?.(ctx, p);
  ctx.restore();
  k.fx?.(ctx, p, cx, cy);
  if (p.mood === 'startled') {
    // darting: speed lines behind (left), a little "!" above
    for (const [y, len] of [[cy - 8, 14], [cy + 4, 18], [cy + 16, 11]]) {
      inkedStroke(ctx, (c) => { c.moveTo(16 - len, y); c.lineTo(16, y); }, CREAM, 2.6, 2);
    }
    inkedStroke(ctx, (c) => { c.moveTo(78, cy - 36); c.lineTo(76, cy - 24); }, WARM[3], 4, 2.5);
    inked(ctx, (c) => circle(c, 75.5, cy - 17, 2.6), WARM[3], 2.2);
  } else if (p.mood === 'happy') {
    // little heart
    const hx = 76;
    const hy = cy - 30;
    inked(ctx, (c) => {
      c.moveTo(hx, hy + 6);
      c.bezierCurveTo(hx - 9, hy, hx - 5, hy - 7, hx, hy - 3);
      c.bezierCurveTo(hx + 5, hy - 7, hx + 9, hy, hx, hy + 6);
      c.closePath();
    }, BERRY[2], 2.2);
    sparkle(ctx, 18, cy - 30, 5);
  }
}

/** Dark silhouette of a Flurry (for undiscovered album slots). Same 96x96 framing, no shadow. */
export function flurrySilhouette(kind: number, col = INK2, frame = 0): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(96, 96);
  drawFlurry(ctx, kind, frame, false);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = col;
  ctx.fillRect(0, 0, 96, 96);
  return c;
}

export function buildFlurries(): { sheets: SheetSpec[] } {
  const sheets: SheetSpec[] = [];
  for (let k = 0; k < FLURRY_KINDS; k++) {
    sheets.push(makeSheet(flurryKey(k), 96, 96, 4, (ctx, i) => drawFlurry(ctx, k, i)));
  }
  return { sheets };
}
