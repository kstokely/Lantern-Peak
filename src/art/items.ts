// Collectibles and props: gems, presents, lantern, sled, gate, ledge, particles.
import { TEX, ANIM, GEM_COLOURS, PRESENT_COLOURS, gemKey, presentKey } from './keys';
import {
  INK, INK2, VIOLET, SNOW, ICE, PINE, ROCK, WARM, BERRY, WOOD, CREAM, mix, rgba,
} from './palette';
import {
  Ctx, SheetSpec, AnimSpec, makeSheet, single, inked, fillPath, strokePath, clipped, ellipse, circle,
  roundRect, poly, star4, groundShadow, bandGlow, softGlow, rng, lerp, TAU,
} from './draw';

// ---------------------------------------------------------------- gems

/** [deep, dark, base, light, shine] per gem colour. */
export const GEM_RAMPS: string[][] = [
  [mix(WARM[0], INK, 0.35), WARM[0], WARM[1], '#ff8a7a', WARM[4]], // ruby
  [mix(WARM[2], WARM[0], 0.55), WARM[2], WARM[3], '#ffe27a', WARM[4]], // amber
  [mix(BERRY[0], INK, 0.3), BERRY[0], BERRY[1], BERRY[2], '#ffd6ee'], // berry
  [mix(ICE[0], INK, 0.35), ICE[0], ICE[1], ICE[2], ICE[3]], // ice
  [mix(PINE[0], INK, 0.1), PINE[1], PINE[2], PINE[3], '#e2ffd0'], // pine
  [mix('#5a3aa8', INK, 0.3), '#5a3aa8', '#8a5fd8', '#bfa2f5', '#ece0ff'], // violet
];

/** Faceted gem (brilliant cut seen from the front). cx, cy = centre; s = scale (1 => ~64 px wide). */
export function drawGem(ctx: Ctx, cx: number, cy: number, s: number, ramp: string[], lw = 3, glint = -1): void {
  const P = (x: number, y: number): [number, number] => [cx + x * s, cy + y * s];
  const outer = [P(-32, -8), P(-18, -24), P(18, -24), P(32, -8), P(0, 30)];
  const flat = outer.flat();
  const path = (c: Ctx) => poly(c, flat);
  inked(ctx, path, ramp[2], lw);
  const tri = (pts: [number, number][], col: string) => fillPath(ctx, (c) => poly(c, pts.flat()), col);
  clipped(ctx, path, () => {
    const t1 = P(-12, -16);
    const t2 = P(12, -16);
    const g1 = P(-32, -8);
    const g2 = P(32, -8);
    const bot = P(0, 30);
    const m1 = P(-11, -8);
    const m2 = P(11, -8);
    // crown
    tri([P(-18, -24), P(18, -24), t2, t1], ramp[3]); // table top edge
    tri([P(-18, -24), t1, g1], ramp[3]);
    tri([t1, m1, g1], ramp[2]);
    tri([t1, t2, m2, m1], ramp[4]); // table
    tri([P(18, -24), g2, t2], ramp[2]);
    tri([t2, g2, m2], ramp[1]);
    // pavilion
    tri([g1, m1, bot], ramp[2]);
    tri([m1, m2, bot], ramp[3]);
    tri([m2, g2, bot], ramp[1]);
    tri([P(-20, -8), P(-11, -8), bot], ramp[3]);
    tri([P(20, -8), P(32, -8), bot], ramp[0]);
    // facet lines
    ctx.strokeStyle = rgba(INK, 0.35);
    ctx.lineWidth = Math.max(1, 1.2 * s);
    ctx.beginPath();
    poly(ctx, [...g1, ...g2], false);
    poly(ctx, [...t1, ...m1, ...bot, ...m2, ...t2], false);
    ctx.stroke();
    // moving glint: a diagonal shine bar sweeping left -> right
    if (glint >= 0) {
      const gx = lerp(-46, 46, glint);
      ctx.fillStyle = rgba(CREAM, 0.85);
      ctx.beginPath();
      poly(ctx, [...P(gx - 4, -30), ...P(gx + 6, -30), ...P(gx - 10, 34), ...P(gx - 20, 34)]);
      ctx.fill();
    }
  });
  // standing highlight
  fillPath(ctx, (c) => ellipse(c, cx - 15 * s, cy - 15 * s, 4 * s, 2.2 * s, -0.6), rgba(CREAM, 0.95));
}

function sparkle(ctx: Ctx, x: number, y: number, r: number, a = 1): void {
  ctx.save();
  ctx.globalAlpha = a;
  inked(ctx, (c) => star4(c, x, y, r, 0.3), CREAM, 1.5, INK2);
  ctx.restore();
}

function buildGems(): { sheets: SheetSpec[]; anims: AnimSpec[] } {
  const sheets: SheetSpec[] = [];
  const anims: AnimSpec[] = [];
  for (let g = 0; g < GEM_COLOURS; g++) {
    const ramp = GEM_RAMPS[g];
    sheets.push(makeSheet(gemKey(g), 96, 96, 4, (ctx, i) => {
      groundShadow(ctx, 48, 88, 22, 5);
      const bob = [0, -1, -2, -1][i];
      bandGlow(ctx, 48, 44 + bob, 40, ramp[3], 0.22, 4);
      drawGem(ctx, 48, 44 + bob, 0.95, ramp, 3, [0.05, 0.38, 0.72, -1][i]);
      // twinkle stars that grow and fade around the gem
      const st = [
        [76, 20, [9, 5, 0, 3][i]],
        [18, 30, [0, 4, 8, 5][i]],
        [72, 62, [4, 0, 3, 8][i]],
      ];
      for (const [x, y, r] of st) if (r > 0) sparkle(ctx, x, y + bob, r);
    }));
    anims.push({ key: ANIM.gemTwinkle(g), texture: gemKey(g), frames: [0, 1, 2, 3], frameRate: 1000 / 120, repeat: -1 });
  }
  return { sheets, anims };
}

// ---------------------------------------------------------------- presents

/** [box base, box dark, ribbon base, ribbon dark] */
const PRESENT_SCHEMES: string[][] = [
  [WARM[1], mix(WARM[0], VIOLET[0], 0.25), WARM[3], mix(WARM[2], WARM[0], 0.3)],
  [BERRY[1], mix(BERRY[0], VIOLET[0], 0.2), CREAM, SNOW[0]],
  [ICE[1], mix(ICE[0], VIOLET[0], 0.3), WARM[1], WARM[0]],
  [PINE[2], mix(PINE[1], VIOLET[0], 0.2), WARM[3], mix(WARM[2], WARM[0], 0.3)],
];

function bow(ctx: Ctx, x: number, y: number, rib: string, ribD: string, s = 1): void {
  // two loops + tails + knot
  const loop = (dir: number) => (c: Ctx) => {
    c.moveTo(x, y);
    c.bezierCurveTo(x + dir * 30 * s, y - 30 * s, x + dir * 38 * s, y + 4 * s, x, y);
    c.closePath();
  };
  for (const d of [-1, 1]) {
    inked(ctx, (c) => {
      c.moveTo(x, y);
      c.lineTo(x + d * 16 * s, y + 20 * s);
      c.lineTo(x + d * 9 * s, y + 18 * s);
      c.lineTo(x + d * 6 * s, y + 24 * s);
      c.closePath();
    }, ribD, 3);
  }
  for (const d of [-1, 1]) {
    inked(ctx, loop(d), rib, 3.5);
    clipped(ctx, loop(d), () => fillPath(ctx, (c) => ellipse(c, x + d * 18 * s, y - 2 * s, 7 * s, 5 * s), ribD));
  }
  inked(ctx, (c) => ellipse(c, x, y, 7 * s, 6 * s), rib, 3.5);
  fillPath(ctx, (c) => ellipse(c, x - 2 * s, y - 2 * s, 2.5 * s, 2 * s), rgba(CREAM, 0.9));
}

function presentBox(ctx: Ctx, sc: string[], open: boolean): void {
  // box body: 104 x 70, bottom at 150
  const L = 28;
  const R = 132;
  const T = 82;
  const B = 150;
  const body = (c: Ctx) => roundRect(c, L, T, R - L, B - T, 6);
  inked(ctx, body, sc[1], 4);
  clipped(ctx, body, () => {
    fillPath(ctx, (c) => roundRect(c, L - 6, T - 6, R - L - 8, B - T + 6, 6), sc[0]);
    // polka dots
    ctx.fillStyle = rgba(CREAM, 0.28);
    for (const [dx, dy] of [[42, 100], [110, 96], [50, 132], [112, 134], [38, 118]]) {
      ctx.beginPath();
      circle(ctx, dx, dy, 4);
      ctx.fill();
    }
    // vertical ribbon
    fillPath(ctx, (c) => c.rect(72, T, 16, B - T), sc[2]);
    fillPath(ctx, (c) => c.rect(84, T, 4, B - T), sc[3]);
    if (open) {
      // dark interior rim at the top
      fillPath(ctx, (c) => c.rect(L, T, R - L, 10), mix(sc[1], INK, 0.45));
    }
  });
  if (open) {
    // inside back wall, drawn as an opening ellipse
    inked(ctx, (c) => ellipse(c, 80, T + 2, 52, 9), mix(sc[1], INK, 0.55), 4);
  }
}

function presentLid(ctx: Ctx, sc: string[], withBow = true): void {
  // lid local coords: centred at (0,0) = middle of lid bottom edge
  const lid = (c: Ctx) => roundRect(c, -58, -24, 116, 26, 7);
  inked(ctx, lid, sc[1], 4);
  clipped(ctx, lid, () => {
    fillPath(ctx, (c) => roundRect(c, -62, -28, 116, 26, 7), sc[0]);
    fillPath(ctx, (c) => c.rect(-8, -24, 16, 26), sc[2]);
    fillPath(ctx, (c) => c.rect(4, -24, 4, 26), sc[3]);
    fillPath(ctx, (c) => c.rect(-58, -22, 116, 4), rgba(CREAM, 0.3));
  });
  if (withBow) bow(ctx, 0, -26, sc[2], sc[3]);
}

function buildPresents(): { sheets: SheetSpec[]; anims: AnimSpec[] } {
  const sheets: SheetSpec[] = [];
  const anims: AnimSpec[] = [];
  for (let p = 0; p < PRESENT_COLOURS; p++) {
    const sc = PRESENT_SCHEMES[p];
    sheets.push(makeSheet(presentKey(p), 160, 160, 9, (ctx, i) => {
      // 0-1 idle wobble, 2-4 shake, 5-8 burst
      const rot = [0, -0.035, -0.13, 0.13, -0.08, 0, 0, 0, 0][i];
      const hop = [0, 1, 4, 6, 3, 0, 0, 0, 0][i];
      const sq = [1, 0.985, 1, 1, 1, 0.9, 1.04, 1, 1][i];
      groundShadow(ctx, 80, 152, 56 - hop, 7);
      if (i >= 5) {
        // warm glow pouring out of the box
        const gl = [0, 0, 0, 0, 0, 0.45, 0.85, 0.75, 0.6][i];
        softGlow(ctx, 80, 70, [0, 0, 0, 0, 0, 60, 80, 78, 70][i], WARM[3], gl);
        ctx.save();
        ctx.globalAlpha = gl * 0.75;
        // light rays
        for (let k = 0; k < 7; k++) {
          const a = -Math.PI / 2 + (k - 3) * 0.32;
          const len = [0, 0, 0, 0, 0, 55, 80, 76, 64][i];
          ctx.beginPath();
          poly(ctx, [80, 84, 80 + Math.cos(a - 0.08) * len, 84 + Math.sin(a - 0.08) * len, 80 + Math.cos(a + 0.08) * len, 84 + Math.sin(a + 0.08) * len]);
          ctx.fillStyle = rgba(WARM[4], 0.7);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.save();
      ctx.translate(80, 150 - hop);
      ctx.rotate(rot);
      ctx.scale(2 - sq, sq);
      ctx.translate(-80, -150);
      presentBox(ctx, sc, i >= 6);
      if (i <= 4) {
        ctx.save();
        ctx.translate(80, 84);
        presentLid(ctx, sc);
        ctx.restore();
      }
      ctx.restore();
      if (i === 5) {
        ctx.save();
        ctx.translate(80, 66);
        ctx.rotate(-0.08);
        presentLid(ctx, sc);
        ctx.restore();
        sparkle(ctx, 30, 66, 7);
        sparkle(ctx, 132, 62, 6);
      }
      if (i === 6) {
        ctx.save();
        ctx.translate(98, 34);
        ctx.rotate(0.38);
        presentLid(ctx, sc);
        ctx.restore();
        // flying ribbon curl
        strokePath(ctx, (c) => {
          c.moveTo(34, 70);
          c.bezierCurveTo(18, 52, 40, 40, 26, 22);
        }, INK, 9);
        strokePath(ctx, (c) => {
          c.moveTo(34, 70);
          c.bezierCurveTo(18, 52, 40, 40, 26, 22);
        }, sc[2], 5);
        for (const [x, y, r] of [[24, 84, 8], [140, 86, 7], [62, 18, 6]]) sparkle(ctx, x, y, r);
      }
      if (i === 7) {
        ctx.save();
        ctx.translate(130, 16);
        ctx.rotate(0.95);
        ctx.scale(0.8, 0.8);
        presentLid(ctx, sc);
        ctx.restore();
        // sparkle fan
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + (k - 2) * 0.55;
          sparkle(ctx, 80 + Math.cos(a) * 58, 78 + Math.sin(a) * 58, 8 - Math.abs(k - 2));
        }
      }
      if (i === 8) {
        for (const [x, y, r] of [[48, 40, 6], [112, 34, 7], [80, 22, 5]]) sparkle(ctx, x, y, r, 0.9);
      }
    }, 9));
    anims.push({ key: ANIM.presentIdle(p), texture: presentKey(p), frames: [0, 1], frameRate: 3, repeat: -1 });
    anims.push({ key: ANIM.presentShake(p), texture: presentKey(p), frames: [2, 3, 4, 2, 3, 4, 2, 3, 4, 0], frameRate: 1000 / 80, repeat: 0, hold: { 9: 150 } });
    anims.push({ key: ANIM.presentBurst(p), texture: presentKey(p), frames: [5, 6, 7, 8], frameRate: 10, repeat: 0 });
  }
  return { sheets, anims };
}

// ---------------------------------------------------------------- lantern

/** Paper festival lantern. cx, cy = centre of the paper body; s = scale (1 => body 64 wide). */
export function drawLantern(ctx: Ctx, cx: number, cy: number, s: number, lit: boolean, lw = 4): void {
  const paper = lit ? WARM[2] : mix(WARM[1], VIOLET[1], 0.45);
  const paperD = lit ? WARM[1] : mix(WARM[0], VIOLET[0], 0.5);
  const paperL = lit ? WARM[3] : mix(WARM[2], VIOLET[2], 0.45);
  if (lit) {
    softGlow(ctx, cx, cy, 62 * s, WARM[3], 0.55);
  }
  // hanging loop
  strokePath(ctx, (c) => {
    c.moveTo(cx - 7 * s, cy - 34 * s);
    c.quadraticCurveTo(cx, cy - 52 * s, cx + 7 * s, cy - 34 * s);
  }, INK, 6 * s);
  strokePath(ctx, (c) => {
    c.moveTo(cx - 7 * s, cy - 34 * s);
    c.quadraticCurveTo(cx, cy - 52 * s, cx + 7 * s, cy - 34 * s);
  }, WOOD[2], 2.5 * s);
  // tassel
  inked(ctx, (c) => {
    c.moveTo(cx - 4 * s, cy + 34 * s);
    c.lineTo(cx + 4 * s, cy + 34 * s);
    c.lineTo(cx + 6 * s, cy + 50 * s);
    c.lineTo(cx - 6 * s, cy + 50 * s);
    c.closePath();
  }, lit ? WARM[0] : mix(WARM[0], VIOLET[0], 0.5), 3);
  const body = (c: Ctx) => ellipse(c, cx, cy, 32 * s, 29 * s);
  inked(ctx, body, paperD, lw);
  clipped(ctx, body, () => {
    fillPath(ctx, (c) => ellipse(c, cx - 3 * s, cy - 3 * s, 30 * s, 27 * s), paper);
    if (lit) fillPath(ctx, (c) => ellipse(c, cx - 2 * s, cy, 15 * s, 18 * s), WARM[4]);
    else fillPath(ctx, (c) => ellipse(c, cx - 12 * s, cy - 10 * s, 8 * s, 6 * s), paperL);
    // ribs
    ctx.strokeStyle = rgba(INK, lit ? 0.3 : 0.4);
    ctx.lineWidth = 1.8 * s;
    for (const k of [-0.62, -0.25, 0.25, 0.62]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(k) * 32 * s, 29 * s, 0, k < 0 ? Math.PI / 2 : -Math.PI / 2, k < 0 ? Math.PI * 1.5 : Math.PI / 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy - 30 * s);
    ctx.lineTo(cx, cy + 30 * s);
    ctx.stroke();
  });
  // caps
  for (const [y, w] of [[cy - 29 * s, 22], [cy + 29 * s, 18]] as [number, number][]) {
    inked(ctx, (c) => roundRect(c, cx - (w / 2) * s, y - 4 * s, w * s, 8 * s, 3 * s), WOOD[1], 3);
    fillPath(ctx, (c) => c.rect(cx - (w / 2 - 2) * s, y - 3 * s, (w - 4) * s, 2 * s), WOOD[3]);
  }
}

function buildLantern(): SheetSpec {
  return makeSheet(TEX.lantern, 96, 128, 2, (ctx, i) => {
    drawLantern(ctx, 48, 62, 1, i === 1);
  });
}

// ---------------------------------------------------------------- sled

function buildSled(): SheetSpec {
  return makeSheet(TEX.sled, 320, 220, 2, (ctx, i) => {
    groundShadow(ctx, 160, 212, 140, 9);
    const loaded = i === 1;
    if (loaded) softGlow(ctx, 160, 120, 140, WARM[3], 0.35);
    // runners (curl up at the front, right)
    const runner = (y: number, col: string) => {
      const p = (c: Ctx) => {
        c.moveTo(40, y);
        c.lineTo(262, y);
        c.bezierCurveTo(300, y, 306, y - 40, 282, y - 46);
        c.bezierCurveTo(268, y - 48, 266, y - 32, 280, y - 30);
      };
      strokePath(ctx, p, INK, 15);
      strokePath(ctx, p, col, 7);
    };
    runner(200, mix(ROCK[1], VIOLET[1], 0.3));
    // struts
    for (const x of [74, 134, 194, 244]) {
      ctx.save();
      strokePath(ctx, (c) => { c.moveTo(x, 198); c.lineTo(x, 172); }, INK, 14);
      strokePath(ctx, (c) => { c.moveTo(x, 198); c.lineTo(x, 172); }, WOOD[1], 6);
      ctx.restore();
    }
    // deck
    const deck = (c: Ctx) => roundRect(c, 34, 150, 238, 28, 8);
    inked(ctx, deck, WOOD[1], 4);
    clipped(ctx, deck, () => {
      fillPath(ctx, (c) => roundRect(c, 30, 146, 238, 26, 8), WOOD[2]);
      ctx.strokeStyle = WOOD[0];
      ctx.lineWidth = 2;
      for (const x of [92, 152, 212]) {
        ctx.beginPath();
        ctx.moveTo(x, 150);
        ctx.lineTo(x, 178);
        ctx.stroke();
      }
      fillPath(ctx, (c) => c.rect(34, 152, 238, 3), WOOD[3]);
    });
    // back rail
    const rail = (c: Ctx) => roundRect(c, 30, 112, 22, 50, 6);
    inked(ctx, rail, WOOD[1], 4);
    fillPath(ctx, (c) => c.rect(33, 115, 6, 44), WOOD[2]);
    // side rail with rope
    strokePath(ctx, (c) => { c.moveTo(48, 138); c.quadraticCurveTo(160, 128, 268, 140); }, INK, 12);
    strokePath(ctx, (c) => { c.moveTo(48, 138); c.quadraticCurveTo(160, 128, 268, 140); }, WOOD[2], 5);
    if (loaded) {
      // lanterns in the sled + one on a pole
      strokePath(ctx, (c) => { c.moveTo(60, 150); c.lineTo(60, 40); c.lineTo(96, 40); }, INK, 12);
      strokePath(ctx, (c) => { c.moveTo(60, 150); c.lineTo(60, 40); c.lineTo(96, 40); }, WOOD[1], 5);
      drawLantern(ctx, 96, 78, 0.62, true, 3);
      drawLantern(ctx, 128, 128, 0.62, true, 3);
      drawLantern(ctx, 176, 126, 0.62, true, 3);
      drawLantern(ctx, 222, 128, 0.62, true, 3);
      drawLantern(ctx, 152, 98, 0.55, true, 3);
    } else {
      // a little snow on the empty deck
      inked(ctx, (c) => {
        c.moveTo(60, 151);
        c.quadraticCurveTo(90, 140, 120, 150);
        c.quadraticCurveTo(170, 142, 210, 150);
        c.closePath();
      }, SNOW[2], 2.5, VIOLET[1]);
    }
    // front runner on top
    runner(206, mix(ROCK[2], VIOLET[2], 0.25));
  });
}

// ---------------------------------------------------------------- gate

function buildGate(): SheetSpec {
  return makeSheet(TEX.gate, 200, 360, 2, (ctx, i) => {
    const open = i === 1;
    groundShadow(ctx, 100, 352, 96, 8);
    const post = (x: number) => {
      const p = (c: Ctx) => roundRect(c, x - 17, 60, 34, 292, 8);
      inked(ctx, p, WOOD[0], 4);
      clipped(ctx, p, () => {
        fillPath(ctx, (c) => c.rect(x - 17, 60, 24, 292), WOOD[1]);
        fillPath(ctx, (c) => c.rect(x - 13, 60, 5, 292), WOOD[2]);
        ctx.strokeStyle = rgba(WOOD[0], 0.7);
        ctx.lineWidth = 2;
        for (const y of [120, 200, 280]) {
          ctx.beginPath();
          ctx.moveTo(x - 6, y);
          ctx.quadraticCurveTo(x, y + 8, x + 4, y + 22);
          ctx.stroke();
        }
      });
      // post cap
      inked(ctx, (c) => roundRect(c, x - 22, 48, 44, 18, 6), WOOD[1], 4);
      fillPath(ctx, (c) => c.rect(x - 18, 51, 36, 4), WOOD[3]);
      // snow cap
      inked(ctx, (c) => {
        c.moveTo(x - 24, 52);
        c.quadraticCurveTo(x - 22, 32, x, 34);
        c.quadraticCurveTo(x + 24, 32, x + 24, 52);
        c.quadraticCurveTo(x + 10, 58, x + 2, 52);
        c.quadraticCurveTo(x - 10, 60, x - 24, 52);
        c.closePath();
      }, SNOW[2], 3, INK);
      if (!open) {
        // ice sheath
        const ice = (c: Ctx) => {
          c.moveTo(x - 22, 70);
          c.lineTo(x + 22, 66);
          c.lineTo(x + 24, 346);
          c.lineTo(x - 24, 346);
          c.closePath();
        };
        ctx.save();
        // mostly opaque cool ice so the warm wood doesn't mix into a muddy olive
        ctx.globalAlpha = 0.8;
        inked(ctx, ice, mix(ICE[2], ICE[1], 0.35), 3, ICE[0]);
        ctx.restore();
        fillPath(ctx, (c) => poly(c, [x - 16, 80, x - 10, 80, x - 14, 300, x - 19, 300]), rgba(ICE[3], 0.8));
        for (let k = 0; k < 3; k++) {
          inked(ctx, (c) => poly(c, [x - 20 + k * 14, 68, x - 12 + k * 14, 68, x - 16 + k * 14, 90 + k * 6]), ICE[2], 2, ICE[0]);
        }
      }
    };
    if (!open) {
      // frozen barrier: thick wall of ice between posts with crossed planks inside
      for (const [a, b] of [[[40, 150], [160, 290]], [[40, 290], [160, 150]]] as number[][][]) {
        strokePath(ctx, (c) => { c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }, INK, 22);
        strokePath(ctx, (c) => { c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }, WOOD[1], 14);
      }
      const wall = (c: Ctx) => {
        c.moveTo(26, 120);
        c.lineTo(60, 106);
        c.lineTo(96, 118);
        c.lineTo(130, 100);
        c.lineTo(174, 116);
        c.lineTo(176, 330);
        c.lineTo(24, 330);
        c.closePath();
      };
      ctx.save();
      ctx.globalAlpha = 0.72;
      inked(ctx, wall, ICE[1], 4, ICE[0]);
      ctx.restore();
      clipped(ctx, wall, () => {
        ctx.fillStyle = rgba(ICE[3], 0.6);
        ctx.beginPath();
        poly(ctx, [40, 130, 70, 120, 50, 250, 34, 260]);
        poly(ctx, [120, 150, 150, 136, 142, 200]);
        ctx.fill();
        ctx.strokeStyle = rgba(CREAM, 0.7);
        ctx.lineWidth = 2;
        ctx.beginPath();
        poly(ctx, [90, 180, 104, 210, 96, 240, 112, 270], false);
        poly(ctx, [104, 210, 130, 222], false);
        ctx.stroke();
      });
      // icicles along the top of the wall
      for (const [x, y, l] of [[44, 116, 22], [76, 114, 14], [112, 112, 26], [146, 112, 16]]) {
        inked(ctx, (c) => poly(c, [x - 7, y, x + 7, y, x, y + l]), ICE[2], 2.5, ICE[0]);
      }
      // snow drift at the base
      inked(ctx, (c) => {
        c.moveTo(14, 352);
        c.quadraticCurveTo(50, 312, 100, 326);
        c.quadraticCurveTo(150, 306, 186, 352);
        c.closePath();
      }, SNOW[1], 3, VIOLET[1]);
    } else {
      // little melt puddle where the ice wall stood, and snow pushed aside to the posts
      fillPath(ctx, (c) => ellipse(c, 100, 347, 56, 5), rgba(ICE[2], 0.5));
      fillPath(ctx, (c) => ellipse(c, 88, 346, 18, 2), rgba(ICE[3], 0.7));
    }
    post(28);
    post(172);
    if (open) {
      // snow banks shovelled against the post bases
      for (const [x0, x1] of [[6, 66], [134, 194]]) {
        inked(ctx, (c) => {
          c.moveTo(x0, 352);
          c.quadraticCurveTo(x0 + 6, 326, (x0 + x1) / 2, 330);
          c.quadraticCurveTo(x1 - 4, 330, x1, 352);
          c.closePath();
        }, SNOW[2], 3);
        fillPath(ctx, (c) => ellipse(c, (x0 + x1) / 2 + 6, 346, 22, 4), SNOW[0]);
      }
      // hanging lantern on a bracket off the left post (warm = "come through")
      inkedLineSimple(ctx, [44, 168, 76, 168, 76, 176], WOOD[1], 6, 3);
      drawLantern(ctx, 76, 204, 0.55, true, 3);
      // two strings of bunting tied to the post caps, drawn in FRONT of the posts
      const cols = [WARM[1], WARM[3], BERRY[1], ICE[1], WARM[2], PINE[2], BERRY[2]];
      const strings: [number, number, number][] = [[64, 128, 7], [86, 150, 6]];
      strings.forEach(([y0, sag, n], si) => {
        const x0 = 34;
        const x1 = 166;
        const ctrlY = 2 * sag - y0; // so the curve's midpoint dips to `sag`
        strokePath(ctx, (c) => { c.moveTo(x0, y0); c.quadraticCurveTo(100, ctrlY, x1, y0); }, INK, 5);
        strokePath(ctx, (c) => { c.moveTo(x0, y0); c.quadraticCurveTo(100, ctrlY, x1, y0); }, CREAM, 2);
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          const x = lerp(lerp(x0, 100, t), lerp(100, x1, t), t);
          const y = lerp(lerp(y0, ctrlY, t), lerp(ctrlY, y0, t), t);
          // flags hang along the string's slope
          const slope = Math.atan2(lerp(ctrlY - y0, y0 - ctrlY, t), lerp(100 - x0, x1 - 100, t));
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(slope * 0.8);
          const w = si === 0 ? 10 : 9;
          const h = si === 0 ? 24 : 20;
          inked(ctx, (c) => poly(c, [-w, 0, w, 0, 0, h]), cols[(k + si * 3) % cols.length], 2.5);
          fillPath(ctx, (c) => poly(c, [-w + 3, 1.5, -1, 1.5, -w * 0.25, h * 0.45]), rgba(WARM[4], 0.45));
          ctx.restore();
        }
      });
      // knots on the posts
      for (const x of [34, 166]) {
        for (const y of [64, 86]) inked(ctx, (c) => circle(c, x, y, 4), CREAM, 2.5);
      }
    }
  });
}

function inkedLineSimple(ctx: Ctx, pts: number[], col: string, w: number, lw: number): void {
  strokePath(ctx, (c) => poly(c, pts, false), INK, w + lw * 2);
  strokePath(ctx, (c) => poly(c, pts, false), col, w);
}

// ---------------------------------------------------------------- ledge

function buildLedge(): SheetSpec {
  return single(TEX.ledge, 240, 56, (ctx) => {
    // ice body
    const body = (c: Ctx) => {
      c.moveTo(6, 10);
      c.lineTo(234, 10);
      c.quadraticCurveTo(238, 30, 226, 40);
      c.lineTo(14, 40);
      c.quadraticCurveTo(2, 30, 6, 10);
      c.closePath();
    };
    inked(ctx, body, ICE[1], 3);
    clipped(ctx, body, () => {
      fillPath(ctx, (c) => c.rect(0, 28, 240, 20), ICE[0]);
      fillPath(ctx, (c) => c.rect(0, 14, 240, 5), ICE[2]);
      fillPath(ctx, (c) => c.rect(0, 22, 240, 2), rgba(ICE[3], 0.6));
    });
    // icicles only near the caps (middle stays stretch-friendly)
    for (const [x, l] of [[20, 13], [34, 9], [46, 6], [196, 7], [208, 12], [222, 9]]) {
      inked(ctx, (c) => poly(c, [x - 5, 38, x + 5, 38, x, 38 + l]), ICE[2], 2.5);
    }
    // snow cap: walkable top edge is y = 0 (outline sits on it)
    const snow = (c: Ctx) => {
      c.moveTo(2, 15);
      c.quadraticCurveTo(0, 3, 12, 3);
      c.lineTo(228, 3);
      c.quadraticCurveTo(240, 3, 238, 15);
      c.quadraticCurveTo(232, 20, 224, 16);
      c.quadraticCurveTo(214, 22, 204, 16);
      c.lineTo(36, 16);
      c.quadraticCurveTo(26, 22, 16, 16);
      c.quadraticCurveTo(8, 20, 2, 15);
      c.closePath();
    };
    inked(ctx, snow, SNOW[1], 3);
    fillPath(ctx, (c) => c.rect(10, 4, 220, 5), SNOW[2]);
  });
}

// ---------------------------------------------------------------- particles

function buildParticles(): SheetSpec[] {
  return [
    single(TEX.snowflake, 16, 16, (ctx) => {
      const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 16, 16);
    }),
    single(TEX.star, 32, 32, (ctx) => {
      fillPath(ctx, (c) => star4(c, 16, 16, 15, 0.28), '#ffffff');
      ctx.globalAlpha = 0.5;
      fillPath(ctx, (c) => star4(c, 16, 16, 9, 0.35, Math.PI / 4), '#ffffff');
    }),
    single(TEX.confetti, 16, 10, (ctx) => {
      fillPath(ctx, (c) => roundRect(c, 0, 0, 16, 10, 2), '#ffffff');
    }),
  ];
}

export function buildItems(): { sheets: SheetSpec[]; anims: AnimSpec[] } {
  const g = buildGems();
  const p = buildPresents();
  return {
    sheets: [...g.sheets, ...p.sheets, buildLantern(), buildSled(), buildGate(), buildLedge(), ...buildParticles()],
    anims: [...g.anims, ...p.anims],
  };
}

export { rng, TAU, PRESENT_SCHEMES };
