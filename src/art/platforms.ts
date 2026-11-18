// v4 platforming pieces (TEX4 / ANIM4 in keys.ts): lifts, crumbly ice, clockwork brass,
// aurora bridges, ice strips, rock terraces, bounce pads, gears, pendulums, checkpoints,
// the helper cloud, pit mist, wind streaks and arrow signs.
//
// Rule for every platform: the walkable surface is the TOP ROW of the texture (origin 0.5, 0),
// so each top edge is drawn with its ink band starting at y = 0 and a crisp light band just under it.
// Tiling pieces (ice strip, rock block/body, pit mist) are periodic in x (and rock body in y).
import { TEX4, ANIM4 } from './keys';
import { INK, INK2, VIOLET, SNOW, ICE, PINE, ROCK, WARM, BERRY, WOOD, GOAT, CREAM, PINK, mix, rgba } from './palette';
import {
  Ctx, PathFn, SheetSpec, AnimSpec, makeSheet, single, makeCanvas, inked, fillPath, strokePath, clipped, ellipse, circle,
  roundRect, poly, star4, groundShadow, bandGlow, softGlow, rng, TAU,
} from './draw';

const LW = 4;

/** Muted clockwork brass: dark, base, light, shine. */
const BRASS = [mix(WOOD[0], WARM[2], 0.3), mix(WOOD[1], WARM[3], 0.45), mix(WARM[3], WOOD[3], 0.35), WARM[4]];

function sparkle(ctx: Ctx, x: number, y: number, r: number, a = 1): void {
  ctx.save();
  ctx.globalAlpha = a;
  inked(ctx, (c) => star4(c, x, y, r, 0.3), CREAM, 1.5, INK2);
  ctx.restore();
}

/** Outline, shadow tone everywhere, base offset toward the upper-left light. */
function blob(ctx: Ctx, path: PathFn, base: string, shadow: string, off: [number, number] = [-5, -4], lw = LW): void {
  inked(ctx, path, shadow, lw);
  clipped(ctx, path, () => {
    ctx.save();
    ctx.translate(off[0], off[1]);
    fillPath(ctx, path, base);
    ctx.restore();
  });
}

function inkedStroke(ctx: Ctx, path: PathFn, col: string, w: number, lw = 3): void {
  strokePath(ctx, path, INK, w + lw * 2);
  strokePath(ctx, path, col, w);
}

/** Flat-topped slab with rounded lower corners: top edge at y = top (ink sits above it). */
function slab(c: Ctx, x0: number, x1: number, top: number, bottom: number, rTop: number, rBot: number): void {
  c.moveTo(x0 + rTop, top);
  c.lineTo(x1 - rTop, top);
  c.quadraticCurveTo(x1, top, x1, top + rTop);
  c.lineTo(x1, bottom - rBot);
  c.quadraticCurveTo(x1, bottom, x1 - rBot, bottom);
  c.lineTo(x0 + rBot, bottom);
  c.quadraticCurveTo(x0, bottom, x0, bottom - rBot);
  c.lineTo(x0, top + rTop);
  c.quadraticCurveTo(x0, top, x0 + rTop, top);
  c.closePath();
}

// ---------------------------------------------------------------- snow-cloud lift 240x80, 2 frames

function buildCloud(): SheetSpec {
  return makeSheet(TEX4.platCloud, 240, 80, 2, (ctx, i) => {
    const d = i === 1 ? 3 : 0; // underside puffs sag a little on frame 1; the top never moves
    const puffs: [number, number, number][] = [
      [34, 40 + d * 0.6, 24], [74, 48 + d, 26], [118, 50 + d * 0.8, 24], [160, 48 + d, 26], [204, 40 + d * 0.6, 24],
      [96, 40, 22], [140, 40, 22],
    ];
    const top = (c: Ctx) => slab(c, 6, 234, LW, 30, 9, 8);
    const shape = (c: Ctx) => {
      top(c);
      for (const [x, y, r] of puffs) circle(c, x, y, r);
    };
    // little falling snow wisps under the puffs (alternate with the bob)
    for (let k = 0; k < 5; k++) {
      const x = 50 + k * 36 + (i ? 8 : 0);
      const y = 70 + ((k + i) % 2) * 4;
      fillPath(ctx, (c) => circle(c, x, y, 2.2), rgba(SNOW[1], 0.75));
    }
    inked(ctx, shape, VIOLET[2], LW);
    clipped(ctx, shape, () => {
      ctx.save();
      ctx.translate(-4, -6);
      fillPath(ctx, (c) => { for (const [x, y, r] of puffs) circle(c, x, y, r); }, mix(SNOW[1], VIOLET[3], 0.35));
      ctx.restore();
      // puff highlights
      fillPath(ctx, (c) => {
        for (const [x, y, r] of puffs) if (y > 44) ellipse(c, x - r * 0.35, y - r * 0.1, r * 0.35, r * 0.2, -0.3);
      }, rgba(SNOW[2], 0.6));
    });
    // packed-snow top slab, drawn over the puffs with its own rim
    inked(ctx, top, SNOW[0], 0);
    clipped(ctx, top, () => {
      fillPath(ctx, (c) => c.rect(0, 0, 240, 25), SNOW[1]);
      fillPath(ctx, (c) => c.rect(0, LW, 240, 6), CREAM);
      // packed texture: a few soft dents
      const r = rng(41);
      for (let k = 0; k < 14; k++) fillPath(ctx, (c) => ellipse(c, 16 + r() * 208, 14 + r() * 8, 3 + r() * 4, 1.2), rgba(VIOLET[2], 0.35));
    });
    // rim line between the packed top and the puffy underside
    strokePath(ctx, (c) => { c.moveTo(12, 30); c.lineTo(228, 30); }, INK2, 3);
  });
}

// ---------------------------------------------------------------- hanging log lift 240x64

function buildLog(): SheetSpec {
  return single(TEX4.platLog, 240, 64, (ctx) => {
    const body = (c: Ctx) => {
      c.moveTo(10, LW);
      c.lineTo(230, LW);
      c.quadraticCurveTo(236, LW, 236, 14);
      c.quadraticCurveTo(236, 44, 212, 46);
      c.lineTo(28, 46);
      c.quadraticCurveTo(4, 44, 4, 14);
      c.quadraticCurveTo(4, LW, 10, LW);
      c.closePath();
    };
    blob(ctx, body, WOOD[1], WOOD[0], [0, -8]);
    clipped(ctx, body, () => {
      // bark grain
      for (const [y, x0, x1] of [[26, 30, 120], [32, 140, 220], [38, 50, 180], [22, 160, 210]]) {
        strokePath(ctx, (c) => { c.moveTo(x0, y); c.quadraticCurveTo((x0 + x1) / 2, y + 3, x1, y); }, mix(WOOD[0], INK, 0.2), 2.5);
      }
      // sawn flat top face: light plank with a crisp edge
      fillPath(ctx, (c) => c.rect(0, LW, 240, 11), WOOD[3]);
      fillPath(ctx, (c) => c.rect(0, LW, 240, 3), mix(WOOD[3], CREAM, 0.55));
      fillPath(ctx, (c) => c.rect(0, LW + 11, 240, 3), WOOD[2]);
      // plank grain
      for (const [x0, x1, y] of [[40, 96, 10], [120, 190, 9], [70, 130, 12]]) {
        strokePath(ctx, (c) => { c.moveTo(x0, y); c.lineTo(x1, y); }, rgba(WOOD[1], 0.55), 1.5);
      }
    });
    // end rings (tree rings on both cut ends)
    for (const x of [14, 226]) {
      const end = (c: Ctx) => ellipse(c, x, 30, 8, 14);
      inked(ctx, end, mix(WOOD[3], WOOD[2], 0.4), 2.5);
      strokePath(ctx, (c) => ellipse(c, x, 30, 4.5, 8), WOOD[1], 1.5);
      fillPath(ctx, (c) => circle(c, x, 30, 1.8), WOOD[1]);
    }
    // rope bindings: the game's ropes come down onto these knots
    for (const x of [44, 196]) {
      const band = (c: Ctx) => roundRect(c, x - 7, LW, 14, 44, 4);
      inked(ctx, band, GOAT[0], 3);
      clipped(ctx, band, () => {
        fillPath(ctx, (c) => c.rect(x - 7, 0, 7, 60), GOAT[1]);
        for (let y = 8; y < 48; y += 7) strokePath(ctx, (c) => { c.moveTo(x - 8, y); c.lineTo(x + 8, y + 4); }, rgba(WOOD[0], 0.6), 2);
      });
      inked(ctx, (c) => ellipse(c, x, LW + 4, 7, 4), GOAT[2], 2.5);
      // short loose tail
      inkedStroke(ctx, (c) => { c.moveTo(x + 4, 46); c.quadraticCurveTo(x + 9, 52, x + 6, 58); }, GOAT[1], 4, 2.5);
    }
  });
}

// ---------------------------------------------------------------- crumbly ice ledge 200x64, 4 frames

/** Seam x positions between chunks; each seam is a zigzag from top to bottom. */
const CRUMBLE_SEAMS = [46, 86, 122, 158];
function seamPts(x: number, k: number): number[] {
  const j = (k % 2 ? 1 : -1) * 3;
  return [x + j, -4, x - j, 14, x + j * 1.3, 26, x - j * 0.6, 38, x + j, 60];
}

function crumbleSlabPath(c: Ctx): void {
  c.moveTo(12, LW);
  c.lineTo(188, LW);
  c.quadraticCurveTo(197, LW, 196, 16);
  c.quadraticCurveTo(195, 34, 182, 42);
  c.lineTo(18, 42);
  c.quadraticCurveTo(5, 34, 4, 16);
  c.quadraticCurveTo(3, LW, 12, LW);
  c.closePath();
}

/** The un-broken slab (with icicles) drawn once into its own canvas. */
function crumbleSlab(): HTMLCanvasElement {
  const [cv, ctx] = makeCanvas(200, 64);
  // icicles under the chunks
  for (const [x, l] of [[26, 12], [36, 7], [66, 10], [104, 13], [140, 8], [174, 12], [184, 6]]) {
    inked(ctx, (c) => poly(c, [x - 5, 40, x + 5, 40, x, 40 + l]), ICE[2], 2.5);
  }
  const ice = mix(ICE[2], SNOW[0], 0.35);
  blob(ctx, crumbleSlabPath, ice, mix(ICE[1], VIOLET[1], 0.25), [-4, -6]);
  clipped(ctx, crumbleSlabPath, () => {
    // frosty crust on top with lumpy drips
    fillPath(ctx, (c) => {
      c.moveTo(0, 0);
      c.lineTo(200, 0);
      c.lineTo(200, 14);
      for (let x = 200; x >= 0; x -= 10) c.quadraticCurveTo(x - 5, 21 + ((x / 10) % 3) * 2, x - 10, 14);
      c.closePath();
    }, SNOW[1]);
    fillPath(ctx, (c) => c.rect(0, LW, 200, 5), CREAM);
    // porous speckles (crumbly, not glassy)
    const r = rng(77);
    for (let k = 0; k < 34; k++) {
      fillPath(ctx, (c) => circle(c, 6 + r() * 188, 20 + r() * 20, 1.2 + r() * 1.8), rgba(k % 3 ? ICE[0] : SNOW[2], 0.45));
    }
    // faint chunk joints: even the solid frame shows it is made of pieces
    CRUMBLE_SEAMS.forEach((x, k) => strokePath(ctx, (c) => poly(c, seamPts(x, k).slice(2), false), rgba(ICE[0], 0.45), 2));
  });
  return cv;
}

function seamRegion(k: number): PathFn {
  // chunk k sits between seam k-1 and seam k (ends extend past the slab)
  return (c: Ctx) => {
    const L = k === 0 ? [-20, -10, -20, 70] : seamPts(CRUMBLE_SEAMS[k - 1], k - 1);
    const R = k === CRUMBLE_SEAMS.length ? [220, -10, 220, 70] : seamPts(CRUMBLE_SEAMS[k], k);
    const pts: number[] = [];
    for (let i = 0; i < L.length; i += 2) pts.push(L[i], L[i + 1]);
    for (let i = R.length - 2; i >= 0; i -= 2) pts.push(R[i], R[i + 1]);
    poly(c, pts);
  };
}

function buildCrumble(): SheetSpec {
  const slabCv = crumbleSlab();
  const n = CRUMBLE_SEAMS.length + 1;
  // per-frame chunk transforms [dx, dy, rot]
  const moves: [number, number, number][][] = [
    [],
    [],
    [[-1, 1, -0.02], [0, 0, 0.01], [0, 2, -0.015], [1, 0, 0.012], [1, 1, 0.025]],
    [[-6, 12, -0.14], [-2, 6, 0.08], [0, 15, -0.06], [3, 5, 0.1], [7, 13, 0.16]],
  ];
  return makeSheet(TEX4.platCrumble, 200, 64, 4, (ctx, f) => {
    if (f <= 1) {
      ctx.drawImage(slabCv, 0, 0);
      if (f === 1) {
        // cracks running down from the walking surface
        clipped(ctx, crumbleSlabPath, () => {
          for (const pts of [
            [62, 2, 58, 12, 64, 20, 60, 28],
            [104, 2, 108, 12, 102, 18],
            [142, 2, 138, 14, 144, 24, 141, 34],
            [86, 18, 92, 24, 88, 32],
          ]) {
            strokePath(ctx, (c) => poly(c, pts, false), INK, 3.5);
            strokePath(ctx, (c) => poly(c, pts.map((v, i) => (i % 2 ? v : v + 2)), false), rgba(ICE[3], 0.7), 1.2);
          }
        });
        // first crumbs falling
        for (const [x, y] of [[70, 52], [150, 56]]) inked(ctx, (c) => poly(c, [x - 3, y, x + 3, y - 2, x + 2, y + 4]), SNOW[1], 2);
      }
      return;
    }
    const mv = moves[f];
    // falling debris
    const deb = f === 2 ? [[58, 52, 3], [98, 58, 2.5], [130, 50, 3], [176, 58, 2]] : [[40, 58, 4], [70, 50, 3], [96, 60, 3.5], [118, 54, 2.5], [150, 60, 4], [182, 52, 3]];
    for (const [x, y, s] of deb) inked(ctx, (c) => poly(c, [x - s, y, x + s, y - s * 0.7, x + s * 0.6, y + s]), f === 2 ? SNOW[1] : ICE[2], 2);
    for (let k = 0; k < n; k++) {
      const [dx, dy, rot] = mv[k];
      const cx = k === 0 ? 24 : k === n - 1 ? 178 : (CRUMBLE_SEAMS[k - 1] + CRUMBLE_SEAMS[k]) / 2;
      ctx.save();
      ctx.translate(cx + dx, 22 + dy);
      ctx.rotate(rot);
      ctx.translate(-cx, -22);
      if (f === 3) ctx.globalAlpha = 0.92;
      clipped(ctx, seamRegion(k), () => {
        ctx.drawImage(slabCv, 0, 0);
        // ink the broken edges, only where they cross the slab body
        clipped(ctx, (c) => slab(c, 0, 200, 0, 46, 10, 12), () => {
          ctx.beginPath();
          seamRegion(k)(ctx);
          ctx.lineWidth = 7;
          ctx.strokeStyle = INK;
          ctx.stroke();
        });
      });
      ctx.restore();
    }
  });
}

// ---------------------------------------------------------------- brass clockwork platform 200x48, 2 frames

function brassShape(c: Ctx): void {
  slab(c, 4, 196, LW, 26, 5, 6);
  // little clock-tick bob under the middle
  circle(c, 100, 30, 13);
}

function buildBrass(): SheetSpec {
  return makeSheet(TEX4.platBrass, 200, 48, 2, (ctx, i) => {
    if (i === 0) {
      // gear-tooth trim under the plate
      for (let x = 14; x <= 186; x += 16) {
        if (Math.abs(x - 100) < 20) continue;
        inked(ctx, (c) => roundRect(c, x - 4, 24, 8, 8, 2), BRASS[1], 2.5);
      }
      blob(ctx, brassShape, BRASS[1], BRASS[0], [-3, -5]);
      clipped(ctx, (c) => slab(c, 4, 196, LW, 26, 5, 6), () => {
        fillPath(ctx, (c) => c.rect(0, LW, 200, 4), BRASS[3]);
        fillPath(ctx, (c) => c.rect(0, LW + 4, 200, 4), BRASS[2]);
        fillPath(ctx, (c) => c.rect(0, 21, 200, 6), rgba(BRASS[0], 0.6));
      });
      // rivets
      for (let x = 16; x <= 184; x += 28) {
        if (Math.abs(x - 100) < 10) continue;
        inked(ctx, (c) => circle(c, x, 16, 3), BRASS[2], 1.5);
        fillPath(ctx, (c) => circle(c, x - 1, 15, 1), BRASS[3]);
      }
      // tiny clock face on the bob
      inked(ctx, (c) => circle(c, 100, 31, 9), CREAM, 2.5);
      for (let k = 0; k < 4; k++) {
        const a = (k * TAU) / 4;
        fillPath(ctx, (c) => circle(c, 100 + Math.cos(a) * 6.5, 31 + Math.sin(a) * 6.5, 1.1), INK2);
      }
      strokePath(ctx, (c) => { c.moveTo(100, 31); c.lineTo(100, 25.5); c.moveTo(100, 31); c.lineTo(104, 32); }, INK, 1.8);
      return;
    }
    // ghost: where the platform will tick back in (dashed double outline over a faint fill)
    fillPath(ctx, brassShape, rgba(ICE[3], 0.32));
    clipped(ctx, brassShape, () => fillPath(ctx, (c) => c.rect(0, LW, 200, 5), rgba(CREAM, 0.6)));
    ctx.save();
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -3;
    strokePath(ctx, (c) => slab(c, 4, 196, LW, 26, 5, 6), rgba(INK, 0.75), 6);
    strokePath(ctx, (c) => slab(c, 4, 196, LW, 26, 5, 6), CREAM, 2.8);
    ctx.setLineDash([6, 6]);
    strokePath(ctx, (c) => c.arc(100, 31, 11, 0.35, Math.PI - 0.35), rgba(INK, 0.55), 4);
    strokePath(ctx, (c) => c.arc(100, 31, 11, 0.35, Math.PI - 0.35), rgba(CREAM, 0.9), 1.8);
    ctx.restore();
    // a solid top line so the reappearing surface is unmistakable
    strokePath(ctx, (c) => { c.moveTo(12, 2); c.lineTo(188, 2); }, rgba(CREAM, 0.55), 2);
    sparkle(ctx, 14, 14, 5, 0.8);
    sparkle(ctx, 186, 16, 5, 0.8);
  });
}

// ---------------------------------------------------------------- aurora light bridge 240x40, 4 frames

// Brighter than the sky aurora painted in the Summit backdrop, so the bridge pops out of it.
const AURORA = [
  mix(mix(PINE[3], ICE[3], 0.35), CREAM, 0.45), mix(mix(PINE[3], ICE[2], 0.4), CREAM, 0.25), mix(ICE[2], CREAM, 0.3),
  mix(mix(VIOLET[3], BERRY[2], 0.3), CREAM, 0.15), mix(VIOLET[3], BERRY[2], 0.5),
];

function buildAurora(): SheetSpec {
  return makeSheet(TEX4.platAurora, 240, 40, 4, (ctx, f) => {
    const band = (c: Ctx) => roundRect(c, 4, 3, 232, 20, 9);
    const ph = f * 0.5 * Math.PI;
    // soft light spilling below the band
    const glow = ctx.createLinearGradient(0, 12, 0, 40);
    glow.addColorStop(0, rgba(AURORA[0], 0.45));
    glow.addColorStop(1, rgba(AURORA[3], 0));
    ctx.fillStyle = glow;
    ctx.fillRect(2, 12, 236, 28);
    // curtain rays hanging under the band
    for (let x = 10; x < 232; x += 9) {
      const len = 6 + 8 * (0.5 + 0.5 * Math.sin(x * 0.07 + ph));
      const col = AURORA[Math.floor(((x / 9 + f) % AURORA.length + AURORA.length) % AURORA.length)];
      const g = ctx.createLinearGradient(0, 21, 0, 23 + len);
      g.addColorStop(0, rgba(col, 0.75));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x, 21, 5, len + 2);
    }
    inked(ctx, band, AURORA[1], 3, INK);
    clipped(ctx, band, () => {
      // shimmering vertical folds: green into violet, shifting each frame
      for (let x = -24; x < 260; x += 12) {
        const t = 0.5 + 0.5 * Math.sin((x + f * 18) * 0.035);
        const col = t < 0.33 ? AURORA[1] : t < 0.66 ? AURORA[2] : AURORA[3];
        fillPath(ctx, (c) => poly(c, [x, 3, x + 12, 3, x + 8, 23, x - 4, 23]), col);
      }
      for (let x = -20; x < 260; x += 36) {
        const xx = x + ((f * 9) % 36);
        fillPath(ctx, (c) => poly(c, [xx, 3, xx + 5, 3, xx + 2, 23, xx - 3, 23]), rgba(AURORA[4], 0.8));
      }
      // bright walkable top line
      fillPath(ctx, (c) => c.rect(0, 3, 240, 4), mix(AURORA[0], CREAM, 0.6));
      fillPath(ctx, (c) => c.rect(0, 19, 240, 4), rgba(VIOLET[1], 0.3));
    });
    // sparkles drift along the band
    const r = rng(300 + f);
    for (let k = 0; k < 4; k++) sparkle(ctx, 20 + ((k * 60 + f * 15) % 210), 6 + r() * 8, 3 + r() * 2.5, 0.9);
  });
}

// ---------------------------------------------------------------- slippery ice strip 240x40 (tiles in x)

function buildIceStrip(): SheetSpec {
  return single(TEX4.iceStrip, 240, 40, (ctx) => {
    fillPath(ctx, (c) => c.rect(0, 0, 240, 40), INK);
    fillPath(ctx, (c) => c.rect(0, 4, 240, 33), ICE[1]);
    fillPath(ctx, (c) => c.rect(0, 4, 240, 20), ICE[2]);
    fillPath(ctx, (c) => c.rect(0, 4, 240, 4), ICE[3]);
    fillPath(ctx, (c) => c.rect(0, 30, 240, 7), ICE[0]);
    fillPath(ctx, (c) => c.rect(0, 12, 240, 3), rgba(ICE[3], 0.55));
    // shine streaks (drawn wrapped so the strip tiles with no seam)
    const streak = (x: number, w: number, a: number) => {
      for (const o of [-240, 0, 240]) {
        fillPath(ctx, (c) => poly(c, [x + o + 10, 6, x + o + 10 + w, 6, x + o + w - 2, 30, x + o - 2, 30]), rgba(CREAM, a));
      }
    };
    streak(22, 9, 0.85);
    streak(38, 4, 0.7);
    streak(118, 12, 0.55);
    streak(196, 8, 0.85);
    streak(210, 3, 0.7);
    // long glints along the surface
    for (const [x, w] of [[62, 34], [150, 26], [226, 30]] as [number, number][]) {
      for (const o of [-240, 0, 240]) fillPath(ctx, (c) => roundRect(c, x + o, 9, w, 2.5, 1.2), rgba(CREAM, 0.9));
    }
    // a couple of star glints
    for (const [x, y] of [[90, 18], [176, 14]]) {
      ctx.save();
      ctx.globalAlpha = 0.95;
      fillPath(ctx, (c) => star4(c, x, y, 6, 0.25), CREAM);
      ctx.restore();
    }
  });
}

// ---------------------------------------------------------------- rock block / body 160x160

/** Periodic stone courses (period 160 in x and y). Mortar is dark so terraces read on any backdrop. */
function rockFill(ctx: Ctx): void {
  fillPath(ctx, (c) => c.rect(0, 0, 160, 160), mix(ROCK[0], INK, 0.45));
  const courses: [number, number[]][] = [
    [0, [54, 58, 48]],
    [-28, [42, 64, 54]],
    [-12, [60, 44, 56]],
    [-40, [46, 56, 58]],
  ];
  const r = rng(907);
  courses.forEach(([off, ws], row) => {
    let x = off;
    const y = row * 40;
    for (const w of ws) {
      const tint = r();
      const lift = r() * 2;
      const base = mix(ROCK[1], ROCK[2], 0.15 + tint * 0.3);
      const shadow = mix(ROCK[0], ROCK[1], 0.4);
      const light = mix(ROCK[2], SNOW[0], 0.35);
      for (const o of [-160, 0, 160]) {
        const sx = x + o;
        const stone = (c: Ctx) => roundRect(c, sx + 3, y + 3 + lift * 0.5, w - 6, 34 - lift * 0.5, 9);
        fillPath(ctx, stone, shadow);
        clipped(ctx, stone, () => {
          fillPath(ctx, (c) => roundRect(c, sx - 1, y - 1, w - 5, 32, 9), base);
          fillPath(ctx, (c) => roundRect(c, sx + 7, y + 6, w * 0.45, 3, 1.5), light);
          fillPath(ctx, (c) => roundRect(c, sx + 6, y + 6, 3, 14, 1.5), light);
        });
        // a little chip / crack on some stones
        if (tint > 0.6) strokePath(ctx, (c) => poly(c, [sx + w * 0.6, y + 34, sx + w * 0.66, y + 26, sx + w * 0.62, y + 20], false), shadow, 2);
      }
      x += w;
    }
  });
}

/** Periodic snow-cap lower edge for x in any range. */
function capEdge(x: number): number {
  const t = (x / 160) * TAU;
  return 34 + 4 * Math.sin(t * 2 + 0.6) + 3 * Math.sin(t * 3 + 2.1) + 2 * Math.sin(t * 5);
}

function buildRocks(): SheetSpec[] {
  const body = single(TEX4.rockBody, 160, 160, (ctx) => rockFill(ctx));
  const block = single(TEX4.rockBlock, 160, 160, (ctx) => {
    rockFill(ctx);
    const cap = (dy: number) => (c: Ctx) => {
      c.moveTo(-12, LW);
      c.lineTo(172, LW);
      for (let x = 172; x >= -12; x -= 4) c.lineTo(x, capEdge(x) + dy);
      c.closePath();
    };
    // shadow cast by the cap onto the stones
    fillPath(ctx, cap(6), rgba(INK, 0.35));
    inked(ctx, cap(0), SNOW[0], LW);
    fillPath(ctx, cap(-5), SNOW[1]);
    fillPath(ctx, (c) => c.rect(0, LW, 160, 6), CREAM);
    // full-width top ink (the outline of the walkable surface)
    fillPath(ctx, (c) => c.rect(0, 0, 160, LW), INK);
    // soft lumps in the snow, wrapped
    for (const [x, y, rx] of [[30, 16, 10], [98, 18, 14], [146, 15, 8]] as [number, number, number][]) {
      for (const o of [-160, 0, 160]) fillPath(ctx, (c) => ellipse(c, x + o, y, rx, 2.5), rgba(VIOLET[3], 0.55));
    }
  });
  return [block, body];
}

// ---------------------------------------------------------------- bounce pad "puffshroom" 150x100, 3 frames

function buildBouncePad(): SheetSpec {
  return makeSheet(TEX4.bouncePad, 150, 100, 3, (ctx, f) => {
    const cx = 75;
    const base = 95;
    const P = [
      { stem: 28, capW: 118, capH: 44, stemW: 34 }, // rest
      { stem: 13, capW: 138, capH: 32, stemW: 44 }, // squashed
      { stem: 40, capW: 106, capH: 46, stemW: 28 }, // sprung
    ][f];
    groundShadow(ctx, cx, base, f === 1 ? 64 : 54, 5, f === 2 ? 0.25 : 0.35);
    // leaves at the foot
    for (const d of [-1, 1]) {
      inked(ctx, (c) => {
        c.moveTo(cx + d * 8, base);
        c.quadraticCurveTo(cx + d * 30, base - 16, cx + d * 40, base - 6);
        c.quadraticCurveTo(cx + d * 28, base + 2, cx + d * 8, base);
        c.closePath();
      }, PINE[2], 3);
    }
    // springy stem with coil rings
    const stemTop = base - P.stem;
    const stem = (c: Ctx) => roundRect(c, cx - P.stemW / 2, stemTop - 6, P.stemW, P.stem + 6, 10);
    blob(ctx, stem, GOAT[2], GOAT[1], [-4, 0]);
    clipped(ctx, stem, () => {
      const n = f === 1 ? 2 : f === 2 ? 4 : 3;
      for (let k = 0; k < n; k++) {
        const y = stemTop + ((k + 0.6) / n) * P.stem;
        fillPath(ctx, (c) => c.rect(cx - 40, y - 2.5, 80, 5), BERRY[1]);
        fillPath(ctx, (c) => c.rect(cx - 40, y - 2.5, 80, 1.5), BERRY[2]);
      }
    });
    // cap (puffy, pleated dome) with a snow dollop on top
    const rim = stemTop;
    const w = P.capW / 2;
    const top = rim - P.capH;
    const cap = (c: Ctx) => {
      c.moveTo(cx - w, rim);
      c.bezierCurveTo(cx - w - 4, top + P.capH * 0.25, cx - w * 0.55, top, cx, top);
      c.bezierCurveTo(cx + w * 0.55, top, cx + w + 4, top + P.capH * 0.25, cx + w, rim);
      c.quadraticCurveTo(cx, rim + 10, cx - w, rim);
      c.closePath();
    };
    blob(ctx, cap, WARM[2], WARM[1], [-6, -5]);
    clipped(ctx, cap, () => {
      // pleats
      for (const k of [-0.62, -0.25, 0.25, 0.62]) {
        strokePath(ctx, (c) => { c.moveTo(cx + k * w * 0.35, top + 4); c.quadraticCurveTo(cx + k * w * 1.1, rim - P.capH * 0.4, cx + k * w * 1.05, rim + 6); }, rgba(WARM[0], 0.55), 2.5);
      }
      // underside rim
      fillPath(ctx, (c) => { c.moveTo(cx - w, rim - 4); c.quadraticCurveTo(cx, rim + 4, cx + w, rim - 4); c.lineTo(cx + w, rim + 12); c.lineTo(cx - w, rim + 12); c.closePath(); }, WARM[0]);
      fillPath(ctx, (c) => ellipse(c, cx - w * 0.45, top + P.capH * 0.45, w * 0.16, P.capH * 0.18, -0.5), WARM[3]);
    });
    // snow dollop
    const snow = (c: Ctx) => {
      c.moveTo(cx - w * 0.62, top + P.capH * 0.3);
      c.quadraticCurveTo(cx - w * 0.5, top - 5, cx, top - 3);
      c.quadraticCurveTo(cx + w * 0.5, top - 5, cx + w * 0.62, top + P.capH * 0.3);
      c.quadraticCurveTo(cx + w * 0.4, top + P.capH * 0.42, cx + w * 0.2, top + P.capH * 0.3);
      c.quadraticCurveTo(cx, top + P.capH * 0.45, cx - w * 0.25, top + P.capH * 0.3);
      c.quadraticCurveTo(cx - w * 0.45, top + P.capH * 0.42, cx - w * 0.62, top + P.capH * 0.3);
      c.closePath();
    };
    blob(ctx, snow, SNOW[2], SNOW[0], [-3, -3], 3);
    // friendly face on the stem
    const fy = stemTop + P.stem * 0.45 - (f === 1 ? 1 : 0);
    if (f === 1) {
      for (const d of [-1, 1]) strokePath(ctx, (c) => { c.moveTo(cx + d * 10 - 4, fy - 1); c.lineTo(cx + d * 10, fy + 2); c.lineTo(cx + d * 10 + 4, fy - 1); }, INK, 2.5);
    } else {
      for (const d of [-1, 1]) {
        fillPath(ctx, (c) => ellipse(c, cx + d * 8, fy - 2, 2.6, 3.4), INK2);
        fillPath(ctx, (c) => circle(c, cx + d * 8 - 0.8, fy - 3.2, 1), CREAM);
      }
    }
    if (P.stem > 18) {
      strokePath(ctx, (c) => c.arc(cx, fy + 2, 5, 0.2, Math.PI - 0.2), INK, 2.2);
      fillPath(ctx, (c) => { ellipse(c, cx - 13, fy + 3, 3.5, 2); ellipse(c, cx + 13, fy + 3, 3.5, 2); }, rgba(PINK, 0.8));
    }
    if (f === 2) {
      // boing lines
      for (const [x, y, a] of [[18, 30, -2.4], [132, 30, -0.7], [10, 52, Math.PI], [140, 52, 0]] as [number, number, number][]) {
        inkedStroke(ctx, (c) => { c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); }, CREAM, 3, 2);
      }
      sparkle(ctx, 124, 12, 5);
    }
    if (f === 1) {
      // squish puffs at the foot
      for (const d of [-1, 1]) inked(ctx, (c) => circle(c, cx + d * 58, base - 4, 5), SNOW[1], 2);
    }
  });
}

// ---------------------------------------------------------------- wooden gear 240x240 (rotates)

function buildGear(): SheetSpec {
  return single(TEX4.gear, 240, 240, (ctx) => {
    const cx = 120;
    const cy = 120;
    const N = 12;
    const Ro = 112;
    const Rr = 94;
    const outline = (c: Ctx) => {
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * TAU;
        const step = TAU / N;
        const pts: [number, number][] = [
          [Rr, a0], [Rr, a0 + step * 0.12], [Ro, a0 + step * 0.22], [Ro, a0 + step * 0.48], [Rr, a0 + step * 0.58], [Rr, a0 + step],
        ];
        pts.forEach(([rad, a], i) => {
          const x = cx + Math.cos(a) * rad;
          const y = cy + Math.sin(a) * rad;
          if (k === 0 && i === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        });
      }
      c.closePath();
    };
    inked(ctx, outline, WOOD[1], LW);
    // tooth tips light (radially symmetric so rotation never looks wrong)
    clipped(ctx, outline, () => {
      fillPath(ctx, (c) => circle(c, cx, cy, Rr + 2), WOOD[2]);
      strokePath(ctx, (c) => circle(c, cx, cy, Ro - 4), WOOD[3], 5);
    });
    fillPath(ctx, (c) => circle(c, cx, cy, Rr - 8), WOOD[1]);
    fillPath(ctx, (c) => circle(c, cx, cy, Rr - 12), WOOD[2]);
    // grain rings
    for (const rr of [74, 60]) strokePath(ctx, (c) => circle(c, cx, cy, rr), rgba(WOOD[1], 0.55), 2);
    strokePath(ctx, (c) => circle(c, cx, cy, Rr - 10), INK, 3);
    // six windows between the spokes, cut through
    const win = (c: Ctx) => {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + TAU / 12;
        const w0 = a - 0.27;
        const w1 = a + 0.27;
        const r0 = 44;
        const r1 = 68;
        c.moveTo(cx + Math.cos(w0) * r0, cy + Math.sin(w0) * r0);
        c.arc(cx, cy, r1, w0 - 0.04, w1 + 0.04);
        c.arc(cx, cy, r0, w1, w0, true);
        c.closePath();
      }
    };
    ctx.save();
    ctx.beginPath();
    win(ctx);
    ctx.lineWidth = LW * 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill();
    ctx.restore();
    // hub
    inked(ctx, (c) => circle(c, cx, cy, 26), BRASS[1], LW);
    strokePath(ctx, (c) => circle(c, cx, cy, 19), BRASS[2], 4);
    strokePath(ctx, (c) => circle(c, cx, cy, 24), rgba(BRASS[0], 0.6), 2);
    inked(ctx, (c) => circle(c, cx, cy, 8), INK2, 0);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      fillPath(ctx, (c) => circle(c, cx + Math.cos(a) * 30.5, cy + Math.sin(a) * 30.5, 2.6), BRASS[2]);
    }
  });
}

// ---------------------------------------------------------------- pendulum rod 28x420, origin (0.5, 0.03)

function buildPendulum(): SheetSpec {
  return single(TEX4.pendulumRod, 28, 420, (ctx) => {
    const rod = (c: Ctx) => roundRect(c, 9, 14, 10, 396, 4);
    blob(ctx, rod, BRASS[1], BRASS[0], [-2, 0], 3);
    clipped(ctx, rod, () => fillPath(ctx, (c) => c.rect(10, 14, 3, 400), BRASS[2]));
    // decorative collars along the rod
    for (const y of [110, 210, 310]) {
      inked(ctx, (c) => roundRect(c, 7, y - 5, 14, 10, 3), BRASS[2], 2.5);
      fillPath(ctx, (c) => c.rect(9, y - 4, 10, 2), BRASS[3]);
    }
    // foot cap (where the game hangs the swinging platform)
    inked(ctx, (c) => circle(c, 14, 408, 8), BRASS[1], 3);
    fillPath(ctx, (c) => circle(c, 12, 406, 3), BRASS[3]);
    // pivot cap at (14, 12.6)
    inked(ctx, (c) => circle(c, 14, 13, 10), BRASS[2], 3);
    fillPath(ctx, (c) => c.arc(14, 13, 10, 0.2, Math.PI - 0.2), BRASS[1]);
    fillPath(ctx, (c) => circle(c, 14, 13, 3.5), INK2);
    fillPath(ctx, (c) => circle(c, 11, 9.5, 2.2), BRASS[3]);
  });
}

// ---------------------------------------------------------------- checkpoint lantern post 90x190, 2 frames

function buildCheckpoint(): SheetSpec {
  return makeSheet(TEX4.checkpoint, 90, 190, 2, (ctx, i) => {
    const lit = i === 1;
    const cx = 45;
    if (lit) {
      softGlow(ctx, cx, 56, 45, WARM[3], 0.7);
      bandGlow(ctx, cx, 56, 40, WARM[4], 0.35, 4);
    }
    groundShadow(ctx, cx, 184, 30, 5);
    // snow mound
    inked(ctx, (c) => { c.moveTo(14, 186); c.quadraticCurveTo(22, 168, 45, 168); c.quadraticCurveTo(68, 168, 76, 186); c.closePath(); }, SNOW[1], 3);
    fillPath(ctx, (c) => ellipse(c, 36, 174, 10, 3), CREAM);
    // post
    const post = (c: Ctx) => roundRect(c, cx - 7, 82, 14, 98, 4);
    blob(ctx, post, WOOD[2], WOOD[1], [-3, 0]);
    fillPath(ctx, (c) => c.rect(cx - 5, 86, 3, 82), WOOD[3]);
    // warm ribbon marks it as something to touch (even unlit)
    inked(ctx, (c) => roundRect(c, cx - 10, 118, 20, 10, 3), WARM[1], 3);
    inked(ctx, (c) => poly(c, [cx + 6, 124, cx + 20, 140, cx + 12, 140, cx + 14, 148, cx + 2, 128]), WARM[1], 2.5);
    fillPath(ctx, (c) => c.rect(cx - 8, 119, 16, 2.5), WARM[2]);
    // base plate of the lantern
    inked(ctx, (c) => roundRect(c, cx - 20, 78, 40, 10, 4), mix(ROCK[1], INK2, 0.3), 3);
    fillPath(ctx, (c) => c.rect(cx - 16, 80, 32, 2.5), ROCK[2]);
    // glass box
    const glass = (c: Ctx) => roundRect(c, cx - 16, 36, 32, 42, 5);
    inked(ctx, glass, lit ? WARM[3] : mix(VIOLET[0], INK2, 0.4), LW);
    clipped(ctx, glass, () => {
      if (lit) {
        fillPath(ctx, (c) => ellipse(c, cx, 58, 13, 18), WARM[4]);
        fillPath(ctx, (c) => c.rect(cx - 13, 40, 4, 34), rgba(CREAM, 0.75));
      } else {
        fillPath(ctx, (c) => c.rect(cx - 16, 36, 10, 42), mix(VIOLET[1], INK2, 0.4));
        fillPath(ctx, (c) => c.rect(cx - 12, 40, 3, 34), rgba(VIOLET[3], 0.5));
      }
    });
    // flame or a cold wick
    if (lit) {
      inked(ctx, (c) => {
        c.moveTo(cx, 70);
        c.bezierCurveTo(cx - 9, 68, cx - 7, 54, cx, 46);
        c.bezierCurveTo(cx + 7, 54, cx + 9, 68, cx, 70);
        c.closePath();
      }, WARM[2], 2.5);
      fillPath(ctx, (c) => ellipse(c, cx, 63, 3.5, 5), CREAM);
    } else {
      strokePath(ctx, (c) => { c.moveTo(cx, 72); c.lineTo(cx, 64); }, INK, 3);
    }
    // frame bars
    for (const x of [cx - 16, cx + 16]) strokePath(ctx, (c) => { c.moveTo(x, 38); c.lineTo(x, 76); }, INK, 5);
    // roof + snow
    const roof = (c: Ctx) => poly(c, [cx - 24, 38, cx - 12, 22, cx + 12, 22, cx + 24, 38]);
    blob(ctx, roof, mix(ROCK[1], INK2, 0.25), mix(ROCK[0], INK, 0.3), [-3, -2], 3.5);
    inked(ctx, (c) => { c.moveTo(cx - 14, 24); c.quadraticCurveTo(cx - 12, 14, cx, 14); c.quadraticCurveTo(cx + 12, 14, cx + 14, 24); c.quadraticCurveTo(cx, 28, cx - 14, 24); c.closePath(); }, SNOW[1], 2.5);
    inked(ctx, (c) => circle(c, cx, 9, 4.5), lit ? WARM[3] : mix(ROCK[1], INK2, 0.25), 2.5);
    if (lit) {
      sparkle(ctx, 14, 30, 5);
      sparkle(ctx, 78, 44, 4);
    }
  });
}

// ---------------------------------------------------------------- helper cloud 240x120, 2 frames (blink), flat top at y = 30

function buildHelperCloud(): SheetSpec {
  return makeSheet(TEX4.helperCloud, 240, 120, 2, (ctx, f) => {
    const T = 30 + LW; // top edge of the body (ink starts at y = 30)
    // round body: big round ends, a flat standing top between them, puffy underside
    const top = (c: Ctx) => {
      c.rect(50, T, 140, 56);
      ellipse(c, 52, T + 36, 38, 36);
      ellipse(c, 188, T + 36, 38, 36);
    };
    const puffs: [number, number, number][] = [[84, 94, 24], [120, 98, 24], [156, 94, 24]];
    const shape = (c: Ctx) => {
      top(c);
      for (const [x, y, r] of puffs) circle(c, x, y, r);
    };
    const base = mix(SNOW[2], SNOW[1], 0.25);
    inked(ctx, shape, mix(SNOW[0], VIOLET[3], 0.35), LW);
    clipped(ctx, shape, () => {
      ctx.save();
      ctx.translate(-5, -7);
      fillPath(ctx, shape, base);
      ctx.restore();
      fillPath(ctx, (c) => c.rect(40, T, 160, 5), CREAM);
      fillPath(ctx, (c) => ellipse(c, 40, 52, 14, 6, -0.6), CREAM);
    });
    // scarf wrapped around the middle, knot and tails on the left
    const scarf = (c: Ctx) => {
      c.moveTo(10, 78);
      c.quadraticCurveTo(120, 92, 230, 78);
      c.lineTo(230, 90);
      c.quadraticCurveTo(120, 106, 10, 90);
      c.closePath();
    };
    clipped(ctx, shape, () => {
      fillPath(ctx, scarf, WARM[1]);
      clipped(ctx, scarf, () => {
        for (let x = 30; x < 230; x += 22) fillPath(ctx, (c) => poly(c, [x, 70, x + 7, 70, x + 7, 110, x, 110]), WARM[3]);
      });
      strokePath(ctx, scarf, INK, 3);
    });
    const tail = (c: Ctx) => {
      c.moveTo(30, 86);
      c.quadraticCurveTo(14, 100, 20, 115);
      c.lineTo(32, 114);
      c.quadraticCurveTo(30, 102, 42, 90);
      c.closePath();
    };
    blob(ctx, tail, WARM[1], WARM[0], [-2, 0], 3);
    fillPath(ctx, (c) => poly(c, [19, 106, 31, 105, 31, 110, 19, 111]), WARM[3]);
    inked(ctx, (c) => ellipse(c, 36, 86, 8, 7), WARM[1], 3);
    // face
    const fx = 124;
    const fy = 54;
    fillPath(ctx, (c) => { ellipse(c, fx - 34, fy + 10, 10, 6.5); ellipse(c, fx + 34, fy + 10, 10, 6.5); }, rgba(PINK, 0.9));
    for (const d of [-1, 1]) {
      const ex = fx + d * 18;
      if (f === 0) {
        fillPath(ctx, (c) => ellipse(c, ex, fy - 2, 6.5, 8.5), INK2);
        fillPath(ctx, (c) => circle(c, ex - 2, fy - 5.5, 2.8), CREAM);
        fillPath(ctx, (c) => circle(c, ex + 2.4, fy + 2, 1.2), CREAM);
      } else {
        strokePath(ctx, (c) => { c.moveTo(ex - 7, fy - 1); c.quadraticCurveTo(ex, fy - 8, ex + 7, fy - 1); }, INK, 3.2);
      }
    }
    // big open smile
    const m = (c: Ctx) => {
      c.moveTo(fx - 13, fy + 6);
      c.quadraticCurveTo(fx, fy + 24, fx + 13, fy + 6);
      c.quadraticCurveTo(fx, fy + 9, fx - 13, fy + 6);
      c.closePath();
    };
    inked(ctx, m, mix(BERRY[0], INK, 0.3), 2.5);
    clipped(ctx, m, () => fillPath(ctx, (c) => ellipse(c, fx, fy + 18, 7, 4.5), BERRY[2]));
    if (f === 0) sparkle(ctx, 222, 20, 6);
  });
}

// ---------------------------------------------------------------- pit mist 320x140 (tiles in x)

function buildPitMist(): SheetSpec {
  return single(TEX4.pitMist, 320, 140, (ctx) => {
    const col = mix(SNOW[1], VIOLET[3], 0.45);
    const g = ctx.createLinearGradient(0, 0, 0, 140);
    g.addColorStop(0, rgba(col, 0));
    g.addColorStop(0.35, rgba(col, 0.35));
    g.addColorStop(0.65, rgba(col, 0.75));
    g.addColorStop(1, rgba(col, 0.92));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 320, 140);
    // billows along the top, wrapped so the band tiles
    const r = rng(512);
    for (let k = 0; k < 6; k++) {
      const x = k * 53 + r() * 20;
      const y = 60 + r() * 16;
      const rad = 38 + r() * 20;
      for (const o of [-320, 0, 320]) {
        const rg = ctx.createRadialGradient(x + o, y, 0, x + o, y, rad);
        rg.addColorStop(0, rgba(SNOW[2], 0.6));
        rg.addColorStop(0.55, rgba(SNOW[1], 0.35));
        rg.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = rg;
        ctx.fillRect(x + o - rad, y - rad, rad * 2, rad * 2);
      }
    }
    // faint sparkles of snow in the mist
    for (let k = 0; k < 10; k++) {
      const x = r() * 320;
      const y = 60 + r() * 70;
      fillPath(ctx, (c) => circle(c, x, y, 1.6), rgba(SNOW[2], 0.7));
    }
  });
}

// ---------------------------------------------------------------- wind streak 120x16 (white, tinted in game)

function buildWind(): SheetSpec {
  return single(TEX4.windStreak, 120, 16, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 120, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.9, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0.6)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(2, 7);
    ctx.quadraticCurveTo(70, 2, 116, 5);
    ctx.quadraticCurveTo(119, 7, 116, 9);
    ctx.quadraticCurveTo(70, 9, 2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(30, 12);
    ctx.quadraticCurveTo(70, 10, 96, 12);
    ctx.quadraticCurveTo(70, 14, 30, 13);
    ctx.closePath();
    ctx.fill();
  });
}

// ---------------------------------------------------------------- arrow signpost 110x150, 3 frames

function buildArrowSign(): SheetSpec {
  return makeSheet(TEX4.arrowSign, 110, 150, 3, (ctx, f) => {
    const cx = 55;
    groundShadow(ctx, cx, 146, 28, 4);
    inked(ctx, (c) => { c.moveTo(28, 148); c.quadraticCurveTo(34, 134, 55, 134); c.quadraticCurveTo(76, 134, 82, 148); c.closePath(); }, SNOW[1], 3);
    const post = (c: Ctx) => roundRect(c, cx - 6, 52, 12, 92, 3);
    blob(ctx, post, WOOD[2], WOOD[1], [-3, 0]);
    fillPath(ctx, (c) => c.rect(cx - 4, 56, 2.5, 76), WOOD[3]);
    // arrow board
    const rot = [0, -Math.PI / 2, -Math.PI / 4][f];
    const ay = [48, 52, 50][f];
    ctx.save();
    ctx.translate(cx, ay);
    ctx.rotate(rot);
    const arrow = (c: Ctx) => poly(c, [-42, -14, 10, -14, 10, -27, 44, 0, 10, 27, 10, 14, -42, 14]);
    blob(ctx, arrow, WARM[2], WARM[1], [-3, -4]);
    clipped(ctx, arrow, () => {
      fillPath(ctx, (c) => c.rect(-50, -14, 64, 4), WARM[3]);
      strokePath(ctx, (c) => { c.moveTo(-34, 4); c.lineTo(2, 4); }, rgba(WARM[0], 0.5), 2);
    });
    // painted cream chevron
    inkedStroke(ctx, (c) => poly(c, [-20, 0, 14, 0], false), CREAM, 5, 2);
    inkedStroke(ctx, (c) => poly(c, [6, -9, 18, 0, 6, 9], false), CREAM, 5, 2);
    // nails
    for (const x of [-30]) fillPath(ctx, (c) => circle(c, x, 0, 2.5), INK2);
    ctx.restore();
    // snow on the board top when it points sideways
    if (f === 0) {
      inked(ctx, (c) => { c.moveTo(cx - 40, ay - 14); c.quadraticCurveTo(cx - 40, ay - 21, cx - 30, ay - 20); c.lineTo(cx + 4, ay - 20); c.quadraticCurveTo(cx + 10, ay - 19, cx + 9, ay - 14); c.closePath(); }, SNOW[1], 2.5);
    }
  });
}

// ---------------------------------------------------------------- bundle

export function buildPlatforms(): { sheets: SheetSpec[]; anims: AnimSpec[] } {
  const sheets = [
    buildCloud(), buildLog(), buildCrumble(), buildBrass(), buildAurora(), buildIceStrip(), ...buildRocks(),
    buildBouncePad(), buildGear(), buildPendulum(), buildCheckpoint(), buildHelperCloud(), buildPitMist(), buildWind(),
    buildArrowSign(),
  ];
  const anims: AnimSpec[] = [
    { key: ANIM4.cloudBob, texture: TEX4.platCloud, frames: [0, 1], frameRate: 1.6, repeat: -1 },
    { key: ANIM4.auroraShimmer, texture: TEX4.platAurora, frames: [0, 1, 2, 3], frameRate: 7, repeat: -1 },
    { key: ANIM4.bounce, texture: TEX4.bouncePad, frames: [1, 2, 0], frameRate: 10, repeat: 0, hold: { 0: 90, 1: 180, 2: 120 } },
    { key: ANIM4.crumble, texture: TEX4.platCrumble, frames: [0, 1, 2, 3], frameRate: 5, repeat: 0 },
  ];
  return { sheets, anims };
}
