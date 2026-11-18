// Store art: tool icons (toolKey), cosmetic hats (hatKey), and the small v2 UI items
// (loose gem, lock badge, gold star, gem purse, bell-ring effect).
import { TOOL_IDS, ToolId, toolKey, HAT_COUNT, hatKey, TEX2, JUNIPER_FRAME } from './keys';
import { INK, INK2, VIOLET, SNOW, ICE, PINE, ROCK, WARM, BERRY, WOOD, GOAT, CREAM, PINK, mix, rgba } from './palette';
import {
  Ctx, PathFn, SheetSpec, AnimSpec, makeSheet, single, inked, fillPath, strokePath, clipped, ellipse, circle,
  roundRect, poly, star4, star5, groundShadow, bandGlow, softGlow, lerp, TAU,
} from './draw';
import { drawGem, GEM_RAMPS } from './items';
import { juniperPoses } from './juniper';

/** Extra animation keys created with these textures. */
export const ANIM_LOOSE_GEM = 'loose-gem-twinkle';
export const ANIM_BELL_RING = 'bell-ring';

const LW = 4;

function inkedStroke(ctx: Ctx, path: PathFn, col: string, w: number, lw = LW): void {
  strokePath(ctx, path, INK, w + lw * 2);
  strokePath(ctx, path, col, w);
}

function sparkle(ctx: Ctx, x: number, y: number, r: number, a = 1): void {
  ctx.save();
  ctx.globalAlpha = a;
  inked(ctx, (c) => star4(c, x, y, r, 0.3), CREAM, 1.5, INK2);
  ctx.restore();
}

/** Body with outline, shadow tone, base offset to the upper left. */
function blob(ctx: Ctx, path: PathFn, base: string, shadow: string, off: [number, number] = [-5, -4], lw = LW): void {
  inked(ctx, path, shadow, lw);
  clipped(ctx, path, () => {
    ctx.save();
    ctx.translate(off[0], off[1]);
    fillPath(ctx, path, base);
    ctx.restore();
  });
}

const BRASS = [mix(WOOD[1], WARM[2], 0.35), mix(WARM[2], WOOD[2], 0.35), mix(WARM[3], WOOD[3], 0.25), WARM[4]];
const SILVER = [mix(VIOLET[1], ROCK[1], 0.4), VIOLET[2], mix(VIOLET[3], SNOW[1], 0.45), SNOW[2]];

/** Hand bell (brass or silver). cx = centre, top = top of the handle. */
function handBell(ctx: Ctx, cx: number, top: number, s: number, metal: string[], ribbon: [string, string]): void {
  const P = (x: number, y: number): [number, number] => [cx + x * s, top + y * s];
  // clapper
  inked(ctx, (c) => circle(c, ...P(0, 86), 8 * s), metal[1], LW);
  // handle (turned wood)
  const handle = (c: Ctx) => {
    roundRect(c, cx - 7 * s, top, 14 * s, 30 * s, 6 * s);
    circle(c, cx, top + 2 * s, 9 * s);
  };
  inked(ctx, handle, WOOD[1], LW);
  fillPath(ctx, (c) => roundRect(c, cx - 5 * s, top + 4 * s, 4 * s, 24 * s, 2 * s), WOOD[2]);
  fillPath(ctx, (c) => circle(c, cx - 3 * s, top - 1 * s, 3 * s), WOOD[3]);
  const body = (c: Ctx) => {
    c.moveTo(...P(0, 26));
    c.bezierCurveTo(...P(-22, 26), ...P(-26, 44), ...P(-27, 58));
    c.quadraticCurveTo(...P(-28, 72), ...P(-40, 80));
    c.quadraticCurveTo(...P(0, 92), ...P(40, 80));
    c.quadraticCurveTo(...P(28, 72), ...P(27, 58));
    c.bezierCurveTo(...P(26, 44), ...P(22, 26), ...P(0, 26));
    c.closePath();
  };
  blob(ctx, body, metal[2], metal[1], [-6, -3]);
  clipped(ctx, body, () => {
    fillPath(ctx, (c) => ellipse(c, ...P(-12, 52), 5 * s, 18 * s, 0.12), metal[3]);
    fillPath(ctx, (c) => c.rect(cx - 50 * s, top + 70 * s, 100 * s, 5 * s), rgba(metal[0], 0.7));
  });
  // ribbon bow at the collar
  const [rb, rd] = ribbon;
  for (const d of [-1, 1]) {
    inked(ctx, (c) => {
      c.moveTo(...P(0, 28));
      c.lineTo(...P(d * 14, 52));
      c.lineTo(...P(d * 8, 50));
      c.lineTo(...P(d * 7, 57));
      c.closePath();
    }, rd, 3);
  }
  for (const d of [-1, 1]) {
    inked(ctx, (c) => {
      c.moveTo(...P(0, 27));
      c.bezierCurveTo(...P(d * 26, 10), ...P(d * 30, 36), ...P(0, 27));
      c.closePath();
    }, rb, 3.5);
  }
  inked(ctx, (c) => ellipse(c, ...P(0, 27), 6 * s, 5 * s), rb, 3);
}

/**
 * v4 hoof-boot (leather cup, fur cuff, strap + buckle). x = centre, sole = y of the sole line,
 * s = scale, dim = how far it is pushed toward night-violet (the back boot).
 */
function hoofBoot(
  ctx: Ctx, x: number, sole: number, s: number, dim: number, leather: [string, string], cuff: string,
  under?: (P: (px: number, py: number) => [number, number], T: (c: string) => string) => void,
): void {
  const P = (px: number, py: number): [number, number] => [x + px * s, sole + py * s];
  const T = (col: string) => mix(col, VIOLET[0], dim);
  under?.(P, T);
  // tall hoof-boot: narrow ankle shaft flaring to a rounded hoof cup with a cloven toe notch
  const cup = (c: Ctx) => {
    c.moveTo(...P(-15, -52));
    c.lineTo(...P(13, -52));
    c.quadraticCurveTo(...P(14, -34), ...P(22, -22));
    c.quadraticCurveTo(...P(28, -12), ...P(26, -4));
    c.quadraticCurveTo(...P(25, 0), ...P(18, 0));
    c.lineTo(...P(4, 0));
    c.lineTo(...P(1, -5));
    c.lineTo(...P(-2, 0));
    c.lineTo(...P(-18, 0));
    c.quadraticCurveTo(...P(-25, 0), ...P(-24, -8));
    c.quadraticCurveTo(...P(-22, -24), ...P(-16, -34));
    c.closePath();
  };
  blob(ctx, cup, T(leather[0]), T(leather[1]), [-5 * s, -3 * s]);
  fillPath(ctx, (c) => poly(c, [...P(-21, -24), ...P(22, -28), ...P(24, -20), ...P(-23, -16)]), T(leather[1]));
  inked(ctx, (c) => roundRect(c, ...P(-1, -28), 10 * s, 11 * s, 2), T(BRASS[2]), 2.5);
  fillPath(ctx, (c) => ellipse(c, ...P(-14, -40), 2.5 * s, 7 * s, 0.2), rgba(CREAM, 0.45 * (1 - dim)));
  inked(ctx, (c) => {
    for (let k = 0; k < 4; k++) circle(c, ...P(-14 + k * 9, -53), 7 * s);
  }, T(cuff), 3);
  fillPath(ctx, (c) => ellipse(c, ...P(-5, -56), 9 * s, 2.2 * s), T(CREAM));
}

/** One feather (quill at x,y, pointing along angle a measured from straight down). */
function feather(ctx: Ctx, x: number, y: number, len: number, w: number, a: number, col: string, dark: string, lw = 2): void {
  const tx = x + Math.sin(a) * len;
  const ty = y + Math.cos(a) * len;
  const nx = Math.cos(a) * w;
  const ny = -Math.sin(a) * w;
  const path = (c: Ctx) => {
    c.moveTo(x, y);
    c.bezierCurveTo(x + nx, y + ny + len * 0.15, tx + nx * 0.8, ty + ny * 0.8 - len * 0.2, tx, ty);
    c.bezierCurveTo(tx - nx * 0.8, ty - ny * 0.8 - len * 0.2, x - nx, y - ny + len * 0.15, x, y);
    c.closePath();
  };
  inked(ctx, path, dark, lw, INK2);
  clipped(ctx, path, () => {
    ctx.save();
    ctx.translate(-w * 0.35, -1);
    fillPath(ctx, path, col);
    ctx.restore();
  });
  strokePath(ctx, (c) => { c.moveTo(x, y); c.quadraticCurveTo(x + (tx - x) * 0.5 + nx * 0.1, y + (ty - y) * 0.5, tx, ty); }, rgba(INK2, 0.6), 1.4);
}

// ---------------------------------------------------------------- tools (128x128)

const TOOLS: Record<ToolId, (ctx: Ctx) => void> = {
  cocoa(ctx) {
    groundShadow(ctx, 64, 118, 34, 6);
    // steam curls rising from the open neck
    for (const [x, ph, h] of [[56, 0, 1], [70, 1, 0.8]] as [number, number, number][]) {
      const s = (c: Ctx) => {
        c.moveTo(x, 24);
        c.bezierCurveTo(x - 10 + ph * 4, 16, x + 10, 10 * h, x - 2 + ph * 3, 2 + (1 - h) * 6);
      };
      strokePath(ctx, s, rgba(INK, 0.8), 10);
      strokePath(ctx, s, CREAM, 5);
    }
    // neck
    const neck = (c: Ctx) => roundRect(c, 49, 22, 30, 18, 5);
    blob(ctx, neck, SILVER[2], SILVER[1], [-3, -2]);
    inked(ctx, (c) => ellipse(c, 64, 24, 12, 3.5), mix(WOOD[0], INK, 0.3), 2.5);
    // body
    const body = (c: Ctx) => roundRect(c, 38, 36, 52, 78, 14);
    blob(ctx, body, WARM[1], WARM[0], [-7, -3]);
    clipped(ctx, body, () => {
      // cream band with a little mug emblem
      fillPath(ctx, (c) => c.rect(30, 60, 70, 26), CREAM);
      fillPath(ctx, (c) => c.rect(76, 60, 20, 26), SNOW[0]);
      fillPath(ctx, (c) => ellipse(c, 48, 50, 4, 9), '#ff8a7a');
      fillPath(ctx, (c) => c.rect(30, 100, 70, 4), rgba(WARM[0], 0.8));
    });
    inked(ctx, (c) => roundRect(c, 55, 66, 15, 14, 3), WOOD[1], 2.5);
    strokePath(ctx, (c) => c.arc(72, 73, 4.5, -1.3, 1.3), INK, 5);
    strokePath(ctx, (c) => c.arc(72, 73, 4.5, -1.3, 1.3), WOOD[1], 2);
    fillPath(ctx, (c) => ellipse(c, 62.5, 68, 6, 1.8), WOOD[0]);
    // shoulder ring
    inked(ctx, (c) => roundRect(c, 40, 34, 48, 9, 4), SILVER[2], 3);
  },

  springHooves(ctx) {
    groundShadow(ctx, 64, 118, 52, 6);
    const boot = (x: number, s: number, dim: number) => {
      const P = (px: number, py: number): [number, number] => [x + px * s, 120 + (py - 120) * s];
      const T = (col: string) => mix(col, VIOLET[0], dim);
      // tall spring coil
      inked(ctx, (c) => ellipse(c, ...P(0, 113), 17 * s, 5 * s), T(ROCK[0]), 3);
      for (let k = 0; k < 5; k++) {
        const y = 106 - k * 8;
        strokePath(ctx, (c) => ellipse(c, ...P(0, y), 13 * s, 4 * s), INK, 7 * s);
        strokePath(ctx, (c) => c.ellipse(...P(0, y), 13 * s, 4 * s, 0, 0, Math.PI), T(SILVER[2]), 3 * s);
        strokePath(ctx, (c) => c.ellipse(...P(0, y), 13 * s, 4 * s, 0, Math.PI, TAU), T(SILVER[1]), 3 * s);
      }
      // two-lobed (cloven) hoof sole poking out under the boot
      inked(ctx, (c) => { ellipse(c, ...P(-9, 70), 12 * s, 7 * s); ellipse(c, ...P(11, 70), 12 * s, 7 * s); }, T(ROCK[0]), 3);
      fillPath(ctx, (c) => { ellipse(c, ...P(-11, 68), 7 * s, 3 * s); ellipse(c, ...P(9, 68), 7 * s, 3 * s); }, T(ROCK[1]));
      // hoof-boot: leather cup, fur cuff, strap + buckle
      const cup = (c: Ctx) => {
        c.moveTo(...P(-20, 30));
        c.lineTo(...P(18, 30));
        c.quadraticCurveTo(...P(24, 48), ...P(24, 62));
        c.quadraticCurveTo(...P(24, 68), ...P(16, 68));
        c.lineTo(...P(-18, 68));
        c.quadraticCurveTo(...P(-24, 68), ...P(-23, 60));
        c.closePath();
      };
      blob(ctx, cup, T(WOOD[1]), T(WOOD[0]), [-5 * s, -3 * s]);
      // strap
      fillPath(ctx, (c) => poly(c, [...P(-23, 48), ...P(22, 44), ...P(23, 52), ...P(-22, 56)]), T(WOOD[0]));
      inked(ctx, (c) => roundRect(c, ...P(-2, 44), 10 * s, 11 * s, 2), T(BRASS[2]), 2.5);
      // fur cuff
      inked(ctx, (c) => {
        for (let k = 0; k < 5; k++) circle(c, ...P(-17 + k * 8.5, 29), 7 * s);
      }, T(GOAT[2]), 3);
      fillPath(ctx, (c) => ellipse(c, ...P(-6, 26), 10 * s, 2.4 * s), T(CREAM));
    };
    boot(42, 0.86, 0.25);
    boot(80, 1, 0);
    // boing lines
    for (const [x, y, a] of [[108, 84, -0.3], [112, 98, 0], [20, 90, 0.3]] as [number, number, number][]) {
      inkedStroke(ctx, (c) => { c.moveTo(x - 5 * Math.cos(a), y - 5 * Math.sin(a)); c.lineTo(x + 6 * Math.cos(a), y + 6 * Math.sin(a)); }, CREAM, 3, 2);
    }
  },

  chimeBell(ctx) {
    groundShadow(ctx, 64, 118, 40, 6);
    handBell(ctx, 64, 12, 1.05, BRASS, [WARM[1], WARM[0]]);
    sparkle(ctx, 106, 30, 7);
  },

  glowLantern(ctx) {
    softGlow(ctx, 64, 70, 66, WARM[3], 0.75);
    bandGlow(ctx, 64, 70, 54, WARM[4], 0.35, 4);
    groundShadow(ctx, 64, 120, 30, 5);
    // rays
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + 0.2;
      fillPath(ctx, (c) => poly(c, [64, 70, 64 + Math.cos(a - 0.07) * 62, 70 + Math.sin(a - 0.07) * 62, 64 + Math.cos(a + 0.07) * 62, 70 + Math.sin(a + 0.07) * 62]), rgba(WARM[4], 0.7));
    }
    ctx.restore();
    // bail handle
    strokePath(ctx, (c) => { c.moveTo(48, 36); c.quadraticCurveTo(64, 2, 80, 36); }, INK, 9);
    strokePath(ctx, (c) => { c.moveTo(48, 36); c.quadraticCurveTo(64, 2, 80, 36); }, SILVER[2], 3);
    // roof
    const roof = (c: Ctx) => {
      c.moveTo(40, 44);
      c.lineTo(52, 28);
      c.lineTo(76, 28);
      c.lineTo(88, 44);
      c.closePath();
    };
    blob(ctx, roof, mix(ROCK[1], INK2, 0.3), mix(ROCK[0], INK, 0.3), [-4, -2]);
    inked(ctx, (c) => circle(c, 64, 25, 5), mix(ROCK[1], INK2, 0.3), 3);
    // glass chamber
    const glass = (c: Ctx) => roundRect(c, 44, 44, 40, 52, 6);
    inked(ctx, glass, WARM[3], LW);
    clipped(ctx, glass, () => {
      fillPath(ctx, (c) => c.rect(44, 44, 40, 52), WARM[3]);
      fillPath(ctx, (c) => ellipse(c, 62, 72, 16, 22), WARM[4]);
      fillPath(ctx, (c) => c.rect(48, 48, 5, 44), rgba(CREAM, 0.7));
    });
    // flame
    inked(ctx, (c) => {
      c.moveTo(64, 86);
      c.bezierCurveTo(54, 84, 56, 70, 64, 60);
      c.bezierCurveTo(72, 70, 74, 84, 64, 86);
      c.closePath();
    }, WARM[2], 2.5);
    fillPath(ctx, (c) => ellipse(c, 64, 79, 4, 6), CREAM);
    // frame bars
    for (const x of [44, 64, 84]) {
      strokePath(ctx, (c) => { c.moveTo(x, 44); c.lineTo(x, 96); }, INK, x === 64 ? 3 : 6);
    }
    // base
    const base = (c: Ctx) => roundRect(c, 38, 94, 52, 14, 5);
    blob(ctx, base, mix(ROCK[1], INK2, 0.3), mix(ROCK[0], INK, 0.3), [-4, -2]);
    fillPath(ctx, (c) => c.rect(42, 97, 44, 3), ROCK[2]);
  },

  iceChisel(ctx) {
    groundShadow(ctx, 64, 118, 48, 6);
    // ice chips at the work end
    for (const [x, y, s, a] of [[24, 104, 7, 0.2], [38, 112, 5, -0.4], [14, 92, 5, 0.8]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      inked(ctx, (c) => poly(c, [-s, s * 0.4, -s * 0.2, -s, s, -s * 0.2, s * 0.4, s]), ICE[2], 2.5);
      fillPath(ctx, (c) => poly(c, [-s * 0.6, 0, -s * 0.1, -s * 0.6, s * 0.3, -s * 0.2]), ICE[3]);
      ctx.restore();
    }
    // mallet (behind), leaning the other way
    ctx.save();
    ctx.translate(76, 66);
    ctx.rotate(0.62);
    inked(ctx, (c) => roundRect(c, -5, -6, 10, 60, 4), WOOD[2], LW);
    fillPath(ctx, (c) => c.rect(-3, -4, 3, 54), WOOD[3]);
    const head = (c: Ctx) => roundRect(c, -24, -30, 48, 26, 7);
    blob(ctx, head, WOOD[2], WOOD[1], [-4, -3]);
    clipped(ctx, head, () => {
      strokePath(ctx, (c) => { c.moveTo(-14, -30); c.lineTo(-14, -4); c.moveTo(14, -30); c.lineTo(14, -4); }, WOOD[0], 2);
      fillPath(ctx, (c) => c.rect(-24, -28, 48, 3), WOOD[3]);
    });
    ctx.restore();
    // stubby chisel, blade down-left
    ctx.save();
    ctx.translate(58, 62);
    ctx.rotate(-0.72);
    const blade = (c: Ctx) => {
      c.moveTo(-7, 6);
      c.lineTo(7, 6);
      c.lineTo(9, 40);
      c.lineTo(-9, 46);
      c.closePath();
    };
    blob(ctx, blade, SILVER[2], SILVER[1], [-3, 0]);
    fillPath(ctx, (c) => poly(c, [-9, 40, 9, 36, 9, 40, -9, 46]), SNOW[2]);
    fillPath(ctx, (c) => c.rect(-4, 8, 3, 30), SILVER[3]);
    // ferrule + handle
    inked(ctx, (c) => roundRect(c, -11, -2, 22, 10, 3), BRASS[2], 3);
    const handle = (c: Ctx) => roundRect(c, -12, -40, 24, 40, 11);
    blob(ctx, handle, WARM[1], WARM[0], [-4, -2]);
    fillPath(ctx, (c) => roundRect(c, -8, -36, 5, 30, 2.5), '#ff8a7a');
    ctx.restore();
  },

  swiftScarf(ctx) {
    groundShadow(ctx, 64, 118, 46, 5);
    const base = ICE[1];
    const dark = ICE[0];
    const stripe = CREAM;
    // speed streaks behind (left)
    for (const [y, x0, len] of [[22, 10, 30], [102, 4, 34], [114, 30, 24]]) {
      inkedStroke(ctx, (c) => { c.moveTo(x0, y); c.lineTo(x0 + len, y); }, CREAM, 4, 2.5);
    }
    /** A scarf tail streaming left: centre line from (x0,y0) to x1 with a wave, half-width hw. */
    const tail = (x0: number, y0: number, x1: number, dy: number, hw: number, ph: number) => {
      const cy = (x: number) => y0 + ((x0 - x) / (x0 - x1)) * dy + Math.sin(((x0 - x) / 60) * TAU + ph) * 6 * ((x0 - x) / (x0 - x1));
      const path = (c: Ctx) => {
        c.moveTo(x0, cy(x0) - hw);
        for (let x = x0; x >= x1; x -= 3) c.lineTo(x, cy(x) - hw);
        for (let x = x1; x <= x0; x += 3) c.lineTo(x, cy(x) + hw);
        c.closePath();
      };
      blob(ctx, path, base, dark, [0, -3]);
      clipped(ctx, path, () => {
        for (const sx of [x1 + 10, x1 + 26]) fillPath(ctx, (c) => c.rect(sx, 0, 7, 128), stripe);
      });
      // fringe
      for (let k = -1; k <= 1; k++) {
        const y = cy(x1) + k * hw * 0.6;
        inkedStroke(ctx, (c) => { c.moveTo(x1, y); c.lineTo(x1 - 9, y + 1); }, base, 2.5, 2);
      }
    };
    tail(92, 76, 18, 18, 9, 2.2); // lower tail (behind)
    tail(88, 58, 10, -14, 11, 0); // upper tail
    // neck loop (a ring seen at an angle) with its hole
    ctx.save();
    ctx.translate(96, 62);
    ctx.rotate(-0.35);
    const ring = (c: Ctx) => ellipse(c, 0, 0, 22, 15);
    blob(ctx, ring, base, dark, [-3, -3]);
    clipped(ctx, ring, () => { for (const sx of [-14, 8]) fillPath(ctx, (c) => c.rect(sx, -20, 6, 40), stripe); });
    inked(ctx, (c) => ellipse(c, 2, -1, 12, 6), mix(dark, INK, 0.5), 2.5);
    ctx.restore();
    sparkle(ctx, 112, 28, 7);
  },

  gemMagnet(ctx) {
    groundShadow(ctx, 60, 118, 46, 6);
    // pull arcs between magnet and gems
    for (const r of [22, 36]) {
      strokePath(ctx, (c) => c.arc(40, 66, r + 22, -0.55, 0.55), rgba(INK, 0.55), 6);
      strokePath(ctx, (c) => c.arc(40, 66, r + 22, -0.55, 0.55), CREAM, 2.5);
    }
    // little gems flying in
    drawGem(ctx, 108, 38, 0.32, GEM_RAMPS[1], 2.5);
    drawGem(ctx, 112, 76, 0.36, GEM_RAMPS[3], 2.5);
    drawGem(ctx, 96, 102, 0.28, GEM_RAMPS[2], 2.5);
    // horseshoe magnet, open end to the right
    ctx.save();
    ctx.translate(46, 66);
    const U = (c: Ctx) => {
      c.moveTo(24, -30);
      c.lineTo(0, -30);
      c.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2, true);
      c.lineTo(24, 30);
      c.lineTo(24, 12);
      c.lineTo(0, 12);
      c.arc(0, 0, 12, Math.PI / 2, -Math.PI / 2, false);
      c.lineTo(24, -12);
      c.closePath();
    };
    blob(ctx, U, WARM[1], WARM[0], [-3, -4]);
    clipped(ctx, U, () => {
      fillPath(ctx, (c) => c.rect(14, -34, 14, 68), SILVER[2]);
      fillPath(ctx, (c) => c.rect(14, -34, 14, 4), SILVER[3]);
      fillPath(ctx, (c) => c.rect(14, 10, 14, 4), SILVER[3]);
      fillPath(ctx, (c) => ellipse(c, -14, -16, 5, 9, 0.7), '#ff8a7a');
    });
    strokePath(ctx, (c) => { c.moveTo(14, -30); c.lineTo(14, -12); c.moveTo(14, 12); c.lineTo(14, 30); }, INK, 3);
    ctx.restore();
  },

  silverBell(ctx) {
    groundShadow(ctx, 64, 118, 40, 6);
    bandGlow(ctx, 64, 66, 60, ICE[3], 0.3, 4);
    // ringing arcs
    for (const d of [-1, 1]) {
      for (const r of [48, 60]) {
        strokePath(ctx, (c) => c.arc(64, 70, r, d > 0 ? -0.5 : Math.PI - 0.5, d > 0 ? 0.5 : Math.PI + 0.5), rgba(INK, 0.6), 7);
        strokePath(ctx, (c) => c.arc(64, 70, r, d > 0 ? -0.5 : Math.PI - 0.5, d > 0 ? 0.5 : Math.PI + 0.5), CREAM, 3);
      }
    }
    handBell(ctx, 64, 12, 1.05, SILVER, [ICE[1], ICE[0]]);
    sparkle(ctx, 30, 28, 8);
    sparkle(ctx, 102, 22, 6);
    sparkle(ctx, 98, 112, 5);
  },

  trailMap(ctx) {
    groundShadow(ctx, 64, 116, 54, 6);
    const paper = mix(GOAT[2], WOOD[3], 0.35);
    const paperD = mix(WOOD[3], WOOD[2], 0.45);
    // sheet
    const sheet = (c: Ctx) => {
      c.moveTo(22, 26);
      c.quadraticCurveTo(64, 20, 106, 26);
      c.lineTo(106, 102);
      c.quadraticCurveTo(64, 96, 22, 102);
      c.closePath();
    };
    inked(ctx, sheet, paperD, LW);
    clipped(ctx, sheet, () => {
      fillPath(ctx, (c) => c.rect(18, 18, 82, 82), paper);
      // little peaks
      for (const [x, y, s] of [[44, 54, 13], [62, 48, 16], [82, 58, 11]]) {
        fillPath(ctx, (c) => poly(c, [x - s, y + s * 0.6, x, y - s * 0.9, x + s, y + s * 0.6]), VIOLET[2]);
        fillPath(ctx, (c) => poly(c, [x - s * 0.35, y - s * 0.35, x, y - s * 0.9, x + s * 0.35, y - s * 0.35]), CREAM);
      }
      // pine dots
      for (const [x, y] of [[32, 80], [40, 86], [92, 82]]) fillPath(ctx, (c) => poly(c, [x - 4, y + 4, x, y - 6, x + 4, y + 4]), PINE[1]);
      // dotted trail
      ctx.fillStyle = WARM[0];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const x = lerp(30, 88, t);
        const y = 92 - t * 26 + Math.sin(t * TAU * 1.2) * 9;
        ctx.beginPath();
        circle(ctx, x, y, 2.2);
        ctx.fill();
      }
    });
    // X marks the spot
    for (const [a, b] of [[[84, 62], [96, 74]], [[96, 62], [84, 74]]]) {
      inkedStroke(ctx, (c) => { c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }, WARM[1], 4.5, 2.5);
    }
    // rolled ends
    for (const x of [22, 106]) {
      const roll = (c: Ctx) => roundRect(c, x - 9, 18, 18, 92, 9);
      blob(ctx, roll, paper, paperD, [-3, 0]);
      inked(ctx, (c) => ellipse(c, x, 22, 8, 4), mix(paperD, WOOD[1], 0.4), 2.5);
      fillPath(ctx, (c) => ellipse(c, x, 22, 3, 1.5), WOOD[1]);
    }
  },

  // ---------- v4 platforming tools

  gripHooves(ctx) {
    groundShadow(ctx, 64, 118, 52, 6);
    // ice under the boots, with chips kicked up
    inked(ctx, (c) => roundRect(c, 8, 106, 112, 12, 6), ICE[2], 3);
    fillPath(ctx, (c) => c.rect(14, 108, 100, 3), ICE[3]);
    for (const [x, y, s] of [[14, 94, 4], [116, 90, 5], [108, 100, 3]]) {
      inked(ctx, (c) => poly(c, [x - s, y, x + s * 0.4, y - s, x + s, y + s * 0.6]), ICE[3], 2);
    }
    // green hoof-boots on a chunky rubber sole with lugs and little silver ice cleats
    const boot = (x: number, s: number, dim: number) => {
      hoofBoot(ctx, x, 98, s, dim, [PINE[2], PINE[1]], GOAT[2], (P, T) => {
        for (const px of [-16, -5, 6, 17]) inked(ctx, (c) => poly(c, [...P(px - 4, 10), ...P(px + 4, 10), ...P(px, 17)]), T(SILVER[2]), 2);
        inked(ctx, (c) => roundRect(c, ...P(-26, -4), 52 * s, 14 * s, 5), T(mix(ROCK[0], INK, 0.35)), 3);
        for (const px of [-19, -8, 3, 14]) fillPath(ctx, (c) => roundRect(c, ...P(px, 3), 7 * s, 6 * s, 2), T(ROCK[1]));
        fillPath(ctx, (c) => c.rect(...P(-22, -3), 44 * s, 2.5), T(ROCK[1]));
      });
    };
    boot(38, 0.86, 0.25);
    boot(86, 1, 0);
    sparkle(ctx, 116, 26, 7);
  },

  cloudBoots(ctx) {
    groundShadow(ctx, 64, 120, 48, 5, 0.25);
    const boot = (x: number, s: number, dim: number) => {
      const T = (col: string) => mix(col, VIOLET[0], dim);
      hoofBoot(ctx, x, 92, s, dim, [ICE[1], ICE[0]], SNOW[2], (P) => {
        // cloud puff under the sole
        const puff = (c: Ctx) => {
          for (const [px, py, r] of [[-18, 6, 9], [-6, 10, 11], [8, 10, 11], [20, 5, 9], [0, 2, 10]] as [number, number, number][]) circle(c, ...P(px, py), r * s);
        };
        inked(ctx, puff, T(mix(SNOW[0], VIOLET[3], 0.3)), 3);
        clipped(ctx, puff, () => {
          ctx.save();
          ctx.translate(-3 * s, -4 * s);
          fillPath(ctx, puff, T(SNOW[2]));
          ctx.restore();
        });
      });
      // little wing at the ankle
      const P = (px: number, py: number): [number, number] => [x + px * s, 92 + py * s];
      const wing = (c: Ctx) => {
        c.moveTo(...P(10, -36));
        c.bezierCurveTo(...P(24, -60), ...P(38, -64), ...P(46, -58));
        c.quadraticCurveTo(...P(41, -53), ...P(45, -49));
        c.quadraticCurveTo(...P(38, -45), ...P(41, -40));
        c.quadraticCurveTo(...P(30, -34), ...P(12, -28));
        c.closePath();
      };
      blob(ctx, wing, T(SNOW[2]), T(ICE[2]), [-2, -3], 3);
      strokePath(ctx, (c) => { c.moveTo(...P(14, -32)); c.quadraticCurveTo(...P(28, -42), ...P(40, -54)); }, rgba(ICE[0], 0.6), 1.6);
    };
    boot(30, 0.86, 0.25);
    boot(78, 1, 0);
    sparkle(ctx, 20, 24, 6);
    sparkle(ctx, 112, 104, 5);
  },

  featherCape(ctx) {
    groundShadow(ctx, 64, 120, 44, 5);
    // wind streaks: the cape is fluttering
    for (const [y, x0, len] of [[40, 100, 20], [70, 106, 16], [100, 98, 22]]) {
      inkedStroke(ctx, (c) => { c.moveTo(x0, y); c.lineTo(x0 + len, y); }, CREAM, 3, 2);
    }
    const rows: { y: number; n: number; w: number; cx: number; len: number; col: string; dark: string }[] = [
      { y: 84, n: 7, w: 78, cx: 62, len: 30, col: WARM[3], dark: WARM[2] },
      { y: 65, n: 6, w: 66, cx: 58, len: 30, col: WARM[2], dark: WARM[1] },
      { y: 48, n: 6, w: 54, cx: 54, len: 28, col: BERRY[2], dark: BERRY[1] },
      { y: 33, n: 5, w: 42, cx: 52, len: 24, col: BERRY[1], dark: BERRY[0] },
    ];
    // silhouette ink behind all feathers (one thick outline)
    const all = (c: Ctx) => {
      for (const r of rows) {
        for (let j = 0; j < r.n; j++) {
          const t = j / (r.n - 1) - 0.5;
          const x = r.cx + t * r.w;
          const a = t * 0.55 + 0.22 + (r.y - 33) * 0.006 + Math.sin(j * 1.7 + r.y) * 0.08;
          ellipse(c, x + Math.sin(a) * r.len * 0.5, r.y + Math.cos(a) * r.len * 0.5, 8, r.len * 0.55, -a);
        }
      }
    };
    inked(ctx, all, BERRY[0], LW);
    for (const r of rows) {
      for (let j = 0; j < r.n; j++) {
        const t = j / (r.n - 1) - 0.5;
        const x = r.cx + t * r.w;
        const a = t * 0.55 + 0.22 + (r.y - 33) * 0.006 + Math.sin(j * 1.7 + r.y) * 0.08;
        feather(ctx, x, r.y, r.len, 9, a, r.col, r.dark);
      }
    }
    // fluffy collar and clasp
    inked(ctx, (c) => { for (let k = 0; k < 6; k++) circle(c, 34 + k * 9.5, 28 + Math.abs(k - 2.5) * 1.2, 7); }, GOAT[2], 3);
    fillPath(ctx, (c) => ellipse(c, 50, 25, 12, 2.4), CREAM);
    inked(ctx, (c) => circle(c, 58, 32, 7), BRASS[2], 3);
    fillPath(ctx, (c) => circle(c, 58, 32, 3.2), ICE[1]);
    fillPath(ctx, (c) => circle(c, 56.8, 30.8, 1.2), CREAM);
    // a loose feather drifting away
    ctx.save();
    ctx.translate(108, 18);
    feather(ctx, 0, 0, 18, 6, 1.1, WARM[3], WARM[2], 2.5);
    ctx.restore();
    sparkle(ctx, 18, 90, 5);
  },
};

function buildTools(): SheetSpec[] {
  return TOOL_IDS.map((id) => single(toolKey(id), 128, 128, (ctx) => TOOLS[id](ctx)));
}

// ---------------------------------------------------------------- hats (96x96)
//
// Hat frames put the CENTRE OF JUNIPER'S SKULL at the frame's bottom-centre (48, 96): the
// game places the hat with origin (0.5, 1) at juniperHatAnchor(frame) and rotates it by
// .rot. Her skull is a circle of radius 30 (crown at y 66 in hat space); the horns rise from
// the crown and sweep back (left), the near ear sits at about (27, 83). Hats face right.

const HX = 48;
const HY = 96;

const HATS: ((ctx: Ctx) => void)[] = [
  // 0 bobble hat: knitted dome, ribbed cuff, pom-pom
  (ctx) => {
    const knit = BERRY[1];
    const knitD = BERRY[0];
    ctx.save();
    // a little forward of the crown and narrow enough that the horn tips poke out behind
    ctx.translate(HX + 7, HY - 27);
    ctx.rotate(0.16);
    ctx.scale(0.84, 0.9);
    const dome = (c: Ctx) => {
      c.moveTo(-26, 2);
      c.bezierCurveTo(-28, -26, 26, -30, 26, 0);
      c.closePath();
    };
    blob(ctx, dome, knit, knitD, [-4, -3]);
    clipped(ctx, dome, () => {
      fillPath(ctx, (c) => c.rect(-30, -14, 60, 5), CREAM);
      ctx.strokeStyle = rgba(knitD, 0.8);
      ctx.lineWidth = 1.6;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(k * 9, 2);
        ctx.quadraticCurveTo(k * 7, -14, k * 4, -26);
        ctx.stroke();
      }
    });
    const cuff = (c: Ctx) => roundRect(c, -29, -6, 58, 13, 6);
    blob(ctx, cuff, CREAM, SNOW[0], [-3, -2], 3.5);
    ctx.strokeStyle = rgba(VIOLET[1], 0.5);
    ctx.lineWidth = 1.6;
    for (let x = -22; x <= 22; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, -3);
      ctx.lineTo(x, 5);
      ctx.stroke();
    }
    // pom-pom
    const pom = (c: Ctx) => {
      for (let k = 0; k < 7; k++) circle(c, Math.cos((k / 7) * TAU) * 5, -27 + Math.sin((k / 7) * TAU) * 5, 6);
    };
    blob(ctx, pom, CREAM, SNOW[0], [-2, -2], 3.5);
    ctx.restore();
  },
  // 1 earmuffs: band over the crown, fluffy muff over the near ear, far muff peeking on top
  (ctx) => {
    const fur = ICE[2];
    const furD = ICE[1];
    // far muff (just behind the crown, front side)
    inked(ctx, (c) => circle(c, HX + 18, HY - 30, 8), mix(furD, VIOLET[1], 0.3), 3.5);
    // band
    const MX = HX - 26;
    const MY = HY - 16;
    const band = (c: Ctx) => {
      c.moveTo(MX, MY);
      c.bezierCurveTo(HX - 32, HY - 46, HX + 6, HY - 50, HX + 18, HY - 32);
    };
    strokePath(ctx, band, INK, 15);
    strokePath(ctx, band, SILVER[2], 7);
    strokePath(ctx, (c) => {
      c.moveTo(MX + 1, MY - 6);
      c.bezierCurveTo(HX - 30, HY - 44, HX + 2, HY - 48, HX + 10, HY - 40);
    }, SILVER[3], 2);
    // near muff, over the ear root (behind the eye)
    const muff = (c: Ctx) => {
      for (let k = 0; k < 8; k++) circle(c, MX + Math.cos((k / 8) * TAU) * 7, MY + Math.sin((k / 8) * TAU) * 7, 6.5);
    };
    blob(ctx, muff, fur, furD, [-3, -3], 3.5);
    fillPath(ctx, (c) => circle(c, MX - 3, MY - 4, 3.5), ICE[3]);
    inked(ctx, (c) => circle(c, MX, MY, 4), WARM[3], 2);
  },
  // 2 tiny explorer hat: khaki dome, wide brim, band, perched at a jaunty angle
  (ctx) => {
    const khaki = mix(GOAT[1], WOOD[3], 0.45);
    const khakiD = mix(WOOD[2], GOAT[0], 0.4);
    ctx.save();
    ctx.translate(HX + 4, HY - 30);
    ctx.rotate(0.16);
    const brim = (c: Ctx) => ellipse(c, 0, 0, 27, 6.5);
    blob(ctx, brim, khaki, khakiD, [-3, -2], 3.5);
    const dome = (c: Ctx) => {
      c.moveTo(-15, 0);
      c.bezierCurveTo(-16, -24, 16, -24, 15, 0);
      c.quadraticCurveTo(0, 4, -15, 0);
      c.closePath();
    };
    blob(ctx, dome, khaki, khakiD, [-3, -3], 3.5);
    clipped(ctx, dome, () => {
      fillPath(ctx, (c) => c.rect(-20, -8, 40, 6), WOOD[0]);
      fillPath(ctx, (c) => ellipse(c, -6, -15, 4, 2.4, -0.4), rgba(CREAM, 0.8));
    });
    // little feather tucked in the band
    inkedStroke(ctx, (c) => { c.moveTo(-10, -6); c.quadraticCurveTo(-20, -18, -16, -28); }, WARM[1], 3, 2);
    ctx.restore();
  },
  // 3 flower crown: woven band around the brow line with flowers along the front
  (ctx) => {
    ctx.save();
    ctx.translate(HX + 2, HY - 24);
    ctx.rotate(0.2);
    // back band (thin, sits behind the horns visually)
    strokePath(ctx, (c) => c.ellipse(0, 0, 28, 8, 0, Math.PI, TAU), INK, 7);
    strokePath(ctx, (c) => c.ellipse(0, 0, 28, 8, 0, Math.PI, TAU), PINE[1], 3);
    // front band
    strokePath(ctx, (c) => c.ellipse(0, 0, 28, 8, 0, 0, Math.PI), INK, 9);
    strokePath(ctx, (c) => c.ellipse(0, 0, 28, 8, 0, 0, Math.PI), PINE[2], 4);
    // leaves
    for (const a of [0.3, 1.2, 2.0, 2.8]) {
      const x = Math.cos(a) * 28;
      const y = Math.sin(a) * 8;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + 1.2);
      inked(ctx, (c) => { c.moveTo(0, 0); c.quadraticCurveTo(5, -5, 11, 0); c.quadraticCurveTo(5, 5, 0, 0); c.closePath(); }, PINE[2], 2);
      ctx.restore();
    }
    const flowers: [number, string, number][] = [[3.0, WARM[3], 6], [2.35, BERRY[2], 7.5], [1.6, ICE[2], 8], [0.85, PINK, 7.5], [0.15, WARM[3], 6]];
    for (const [a, col, r] of flowers) {
      const x = Math.cos(a) * 28;
      const y = Math.sin(a) * 8 - 2;
      const petals = (c: Ctx) => {
        for (let k = 0; k < 5; k++) circle(c, x + Math.cos((k / 5) * TAU - 1.57) * r * 0.62, y + Math.sin((k / 5) * TAU - 1.57) * r * 0.62, r * 0.5);
      };
      inked(ctx, petals, col, 2.5);
      fillPath(ctx, (c) => circle(c, x - r * 0.3, y - r * 0.45, r * 0.22), rgba(CREAM, 0.8));
      inked(ctx, (c) => circle(c, x, y, r * 0.3), col === WARM[3] ? WARM[2] : WARM[3], 1.5);
    }
    ctx.restore();
  },
  // 4 star headband: slim band over the crown with a bobbing star on a coiled stalk
  (ctx) => {
    const band = (c: Ctx) => {
      c.moveTo(HX - 24, HY - 16);
      c.bezierCurveTo(HX - 26, HY - 42, HX + 14, HY - 46, HX + 24, HY - 24);
    };
    strokePath(ctx, band, INK, 12);
    strokePath(ctx, band, VIOLET[1], 5);
    strokePath(ctx, (c) => {
      c.moveTo(HX - 22, HY - 24);
      c.bezierCurveTo(HX - 22, HY - 40, HX + 4, HY - 44, HX + 10, HY - 40);
    }, VIOLET[3], 1.6);
    // coiled stalk
    const stalk = (c: Ctx) => {
      c.moveTo(HX + 2, HY - 38);
      for (let k = 0; k <= 16; k++) {
        const t = k / 16;
        c.lineTo(HX + 2 + Math.sin(t * TAU * 2.5) * 4 + t * 4, HY - 38 - t * 26);
      }
    };
    strokePath(ctx, stalk, INK, 6);
    strokePath(ctx, stalk, SILVER[2], 2.2);
    const st = (c: Ctx) => star5(c, HX + 6, HY - 74, 15, 0.5, 0.12);
    inked(ctx, st, WARM[2], 3.5);
    clipped(ctx, st, () => {
      ctx.save();
      ctx.translate(-2, -2);
      fillPath(ctx, st, WARM[3]);
      ctx.restore();
      fillPath(ctx, (c) => star5(c, HX + 4, HY - 75, 6, 0.5, 0.12), WARM[4]);
    });
    sparkle(ctx, HX + 28, HY - 84, 5);
  },
];

function buildHats(): SheetSpec[] {
  return Array.from({ length: HAT_COUNT }, (_, i) => single(hatKey(i), 96, 96, (ctx) => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    HATS[i](ctx);
  }));
}

/**
 * Where to put a hat on Juniper: for a frame of her sheet, the position (relative to
 * her sprite origin, i.e. feet at bottom-centre, facing right, scale 1) where the hat's
 * origin (0.5, 1) goes, and the rotation (radians) to give the hat. When she faces left,
 * negate dx and rot and flipX the hat. Mirrors the rig's transforms in juniper.ts.
 */
export function juniperHatAnchor(frame: number): { dx: number; dy: number; rot: number } {
  const poses = (hatPoses ??= juniperPoses());
  const p = poses[Math.max(0, Math.min(poses.length - 1, frame))];
  const W = JUNIPER_FRAME.w;
  const GY = JUNIPER_FRAME.h - 5;
  // skull centre (140, 92) inside the head transform about (126, 118 + bob)
  const a = p.headTilt;
  let x = 126 + Math.cos(a) * 14 - Math.sin(a) * -26;
  let y = 118 + p.bob + Math.sin(a) * 14 + Math.cos(a) * -26;
  // body tilt about the back hips (70, 150)
  const b = p.tilt;
  const tx = x - 70;
  const ty = y - 150;
  x = 70 + Math.cos(b) * tx - Math.sin(b) * ty;
  y = 150 + Math.sin(b) * tx + Math.cos(b) * ty;
  // squash/stretch about the feet, then lift
  x = W / 2 + (x - W / 2) * p.sx;
  y = GY + (y - p.lift - GY) * p.sy;
  return { dx: x - W / 2, dy: y - JUNIPER_FRAME.h, rot: a + b };
}
let hatPoses: ReturnType<typeof juniperPoses> | undefined;

// ---------------------------------------------------------------- small v2 items

function buildLooseGem(): { sheet: SheetSpec; anim: AnimSpec } {
  const sheet = makeSheet(TEX2.looseGem, 48, 48, 4, (ctx, i) => {
    groundShadow(ctx, 24, 44, 12, 3, 0.3);
    const bob = [0, -1, -1.5, -1][i];
    bandGlow(ctx, 24, 23 + bob, 20, ICE[2], 0.2, 3);
    drawGem(ctx, 24, 23 + bob, 0.5, GEM_RAMPS[3], 2.5, [0.1, 0.5, 0.9, -1][i]);
    const r = [5, 2.5, 0, 3.5][i];
    if (r > 0) sparkle(ctx, 38, 9 + bob, r);
    const r2 = [0, 3, 5, 2][i];
    if (r2 > 0) sparkle(ctx, 9, 15 + bob, r2);
  });
  return { sheet, anim: { key: ANIM_LOOSE_GEM, texture: TEX2.looseGem, frames: [0, 1, 2, 3], frameRate: 1000 / 120, repeat: -1 } };
}

function buildLockBadge(): SheetSpec {
  return single(TEX2.lockBadge, 96, 96, (ctx) => {
    const disc = (c: Ctx) => circle(c, 48, 48, 40);
    blob(ctx, disc, VIOLET[1], VIOLET[0], [-4, -4]);
    strokePath(ctx, (c) => circle(c, 48, 48, 33), rgba(VIOLET[3], 0.5), 2.5);
    // shackle
    strokePath(ctx, (c) => { c.moveTo(35, 48); c.lineTo(35, 34); c.arc(48, 34, 13, Math.PI, 0); c.lineTo(61, 48); }, INK, 14);
    strokePath(ctx, (c) => { c.moveTo(35, 48); c.lineTo(35, 34); c.arc(48, 34, 13, Math.PI, 0); c.lineTo(61, 48); }, SILVER[2], 6);
    strokePath(ctx, (c) => { c.moveTo(33, 44); c.lineTo(33, 34); c.arc(48, 34, 15, Math.PI, -2.2); }, SILVER[3], 1.6);
    // body
    const body = (c: Ctx) => roundRect(c, 26, 44, 44, 34, 8);
    blob(ctx, body, WARM[3], WARM[2], [-4, -3]);
    fillPath(ctx, (c) => roundRect(c, 30, 48, 6, 24, 3), WARM[4]);
    // keyhole
    fillPath(ctx, (c) => { circle(c, 48, 57, 5); poly(c, [45, 59, 51, 59, 52, 70, 44, 70]); }, INK2);
  });
}

function buildStarGold(): SheetSpec {
  return single(TEX2.starGold, 96, 96, (ctx) => {
    bandGlow(ctx, 48, 50, 46, WARM[3], 0.25, 4);
    const st = (c: Ctx) => star5(c, 48, 51, 40, 0.5);
    inked(ctx, st, WARM[2], LW);
    clipped(ctx, st, () => {
      ctx.save();
      ctx.translate(-4, -4);
      fillPath(ctx, st, WARM[3]);
      ctx.restore();
      fillPath(ctx, (c) => star5(c, 45, 48, 18, 0.5), WARM[4]);
    });
    fillPath(ctx, (c) => ellipse(c, 38, 34, 5, 3, -0.6), rgba(CREAM, 0.95));
    sparkle(ctx, 82, 16, 7);
    sparkle(ctx, 14, 78, 5);
  });
}

function buildPurse(): SheetSpec {
  return single(TEX2.purse, 96, 96, (ctx) => {
    const lea = mix(WOOD[1], BERRY[0], 0.25);
    const leaD = mix(WOOD[0], BERRY[0], 0.2);
    const leaL = mix(WOOD[2], BERRY[1], 0.25);
    // gems peeking out of the top
    drawGem(ctx, 38, 24, 0.3, GEM_RAMPS[1], 2.5);
    drawGem(ctx, 58, 20, 0.34, GEM_RAMPS[3], 2.5);
    // frilled top
    const frill = (c: Ctx) => {
      c.moveTo(28, 38);
      c.lineTo(22, 26);
      c.quadraticCurveTo(30, 30, 36, 26);
      c.quadraticCurveTo(44, 32, 50, 27);
      c.quadraticCurveTo(58, 32, 64, 26);
      c.quadraticCurveTo(70, 30, 76, 24);
      c.lineTo(68, 38);
      c.closePath();
    };
    blob(ctx, frill, leaL, lea, [-2, -2], 3.5);
    // pouch
    const pouch = (c: Ctx) => {
      c.moveTo(30, 38);
      c.bezierCurveTo(8, 50, 10, 86, 48, 86);
      c.bezierCurveTo(86, 86, 88, 50, 66, 38);
      c.closePath();
    };
    blob(ctx, pouch, lea, leaD, [-5, -4]);
    clipped(ctx, pouch, () => fillPath(ctx, (c) => ellipse(c, 30, 54, 5, 9, 0.4), leaL));
    // drawstring
    inkedStroke(ctx, (c) => { c.moveTo(28, 40); c.quadraticCurveTo(48, 46, 68, 40); }, WARM[3], 4, 2.5);
    inkedStroke(ctx, (c) => { c.moveTo(66, 42); c.quadraticCurveTo(76, 50, 72, 58); }, WARM[3], 3.5, 2.5);
    inked(ctx, (c) => circle(c, 72, 60, 4), WARM[2], 2.5);
    // gem emblem
    drawGem(ctx, 48, 64, 0.42, GEM_RAMPS[3], 3);
  });
}

function buildBellRing(): { sheet: SheetSpec; anim: AnimSpec } {
  const sheet = makeSheet(TEX2.bellRing, 128, 128, 4, (ctx, i) => {
    const a = [1, 0.85, 0.6, 0.35][i];
    ctx.save();
    ctx.globalAlpha = a;
    for (let k = 0; k < 3; k++) {
      const r = 22 + i * 9 + k * 13;
      if (r > 60) continue;
      for (const side of [0, Math.PI]) {
        const path = (c: Ctx) => c.arc(64, 64, r, side - 0.55, side + 0.55);
        strokePath(ctx, path, INK, 8 - k);
        strokePath(ctx, path, CREAM, 4 - k * 0.6);
      }
    }
    ctx.restore();
    // a few sparkles and a note flying out
    const sp: [number, number, number][][] = [
      [[96, 26, 5]], [[104, 20, 7], [24, 30, 4]], [[110, 14, 5], [18, 22, 6], [64, 8, 4]], [[16, 14, 4], [70, 4, 5]],
    ];
    for (const [x, y, r] of sp[i]) sparkle(ctx, x, y, r, a);
    if (i >= 1) {
      ctx.save();
      ctx.globalAlpha = a;
      const nx = 36 - i * 4;
      const ny = 30 - i * 8;
      inked(ctx, (c) => ellipse(c, nx, ny + 14, 5, 4, -0.4), CREAM, 2);
      inkedStroke(ctx, (c) => { c.moveTo(nx + 4, ny + 13); c.lineTo(nx + 4, ny); c.lineTo(nx + 11, ny + 4); }, CREAM, 2.2, 1.6);
      ctx.restore();
    }
  });
  return { sheet, anim: { key: ANIM_BELL_RING, texture: TEX2.bellRing, frames: [0, 1, 2, 3], frameRate: 12, repeat: 0 } };
}

export function buildStore(): { sheets: SheetSpec[]; anims: AnimSpec[] } {
  const lg = buildLooseGem();
  const br = buildBellRing();
  return {
    sheets: [...buildTools(), ...buildHats(), lg.sheet, buildLockBadge(), buildStarGold(), buildPurse(), br.sheet],
    anims: [lg.anim, br.anim],
  };
}
