// Countable-object icons for counting/story problems: countIconKey(name), 64x64 each.
// Each one is built for recognition at ~40 px: a distinct silhouette first, then one
// dominant hue per object (see the table below), 3 px ink outline, flat 3-tone shading
// lit from the upper left, and a small soft ground shadow.
//
//   snowball white      gem violet       pinecone dark brown   star yellow    lantern orange glow
//   carrot orange+green mitten blue      cocoa cream mug       fish coral     acorn tan + brown cap
//   berry magenta       bell gold+red    cookie biscuit+chips  apple red      feather teal
//   candle red+flame    sled wood+red    scarf green stripes   pie golden     coin gold rim
import { COUNT_ICONS, CountIcon, countIconKey } from './keys';
import { INK, INK2, VIOLET, SNOW, ICE, PINE, ROCK, WARM, BERRY, WOOD, CREAM, mix, rgba } from './palette';
import {
  Ctx, PathFn, SheetSpec, single, inked, fillPath, strokePath, clipped, ellipse, circle, roundRect, poly,
  star5, groundShadow, bandGlow, shadedBlob, lerp, TAU,
} from './draw';
import { drawGem, GEM_RAMPS, drawLantern } from './items';

const LW = 3;

/** Outline + shadow tone + base tone shifted to the upper left + optional highlight. */
function blob(ctx: Ctx, path: PathFn, base: string, shadow: string, off: [number, number] = [-3, -3], light?: [string, PathFn]): void {
  shadedBlob(ctx, path, base, shadow, LW, off, light ? { col: light[0], path: light[1] } : undefined);
}

function shine(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = -0.6, a = 0.95): void {
  fillPath(ctx, (c) => ellipse(c, x, y, rx, ry, rot), rgba(CREAM, a));
}

function shadow(ctx: Ctx, rx = 18, y = 58): void {
  groundShadow(ctx, 32, y, rx, 3.6, 0.3);
}

// ---------------------------------------------------------------- painters (64x64 space)

const PAINT: Record<CountIcon, (ctx: Ctx) => void> = {
  snowball(ctx) {
    shadow(ctx, 18);
    const b = (c: Ctx) => circle(c, 32, 33, 22);
    inked(ctx, b, VIOLET[3], LW);
    clipped(ctx, b, () => {
      fillPath(ctx, (c) => circle(c, 28, 29, 21), SNOW[1]);
      fillPath(ctx, (c) => circle(c, 25, 25, 12), SNOW[2]);
      fillPath(ctx, (c) => { circle(c, 40, 45, 3); circle(c, 46, 36, 2); circle(c, 33, 49, 2); }, SNOW[0]);
    });
    shine(ctx, 22, 21, 5, 3);
  },

  gem(ctx) {
    shadow(ctx, 17);
    const r = GEM_RAMPS[5];
    drawGem(ctx, 32, 32, 0.8, r, LW);
  },

  pinecone(ctx) {
    shadow(ctx, 13);
    ctx.save();
    ctx.translate(32, 33);
    ctx.rotate(0.22);
    const body = (c: Ctx) => {
      c.moveTo(0, -22);
      c.bezierCurveTo(15, -20, 17, 6, 0, 24);
      c.bezierCurveTo(-17, 6, -15, -20, 0, -22);
      c.closePath();
    };
    const cone = mix(WOOD[1], WOOD[0], 0.25);
    inked(ctx, body, WOOD[0], LW);
    clipped(ctx, body, () => {
      // overlapping scales: rows from the bottom up so upper rows lap over lower ones
      for (let row = 5; row >= 0; row--) {
        const y = -17 + row * 7.4;
        const n = row % 2 ? 3 : 2;
        for (let k = 0; k < n; k++) {
          const x = (k - (n - 1) / 2) * 10;
          const sc = (c: Ctx) => {
            c.moveTo(x - 6, y - 3);
            c.quadraticCurveTo(x - 6, y + 6, x, y + 7);
            c.quadraticCurveTo(x + 6, y + 6, x + 6, y - 3);
            c.closePath();
          };
          fillPath(ctx, sc, x > 2 ? cone : WOOD[2]);
          strokePath(ctx, sc, mix(WOOD[0], INK, 0.45), 1.8);
          // lit tip of each scale
          fillPath(ctx, (c) => ellipse(c, x - 1.5, y + 4, 2.4, 1.4), x > 2 ? WOOD[2] : WOOD[3]);
        }
      }
      // shadowed right flank
      fillPath(ctx, (c) => ellipse(c, 15, 4, 8, 26), rgba(INK, 0.28));
    });
    // stem nub
    inked(ctx, (c) => roundRect(c, -3, -28, 6, 8, 2), WOOD[1], 2.5);
    ctx.restore();
  },

  star(ctx) {
    shadow(ctx, 16);
    const p = (c: Ctx) => star5(c, 32, 32, 25, 0.5);
    inked(ctx, p, WARM[2], LW);
    clipped(ctx, p, () => {
      ctx.save();
      ctx.translate(-3, -3);
      fillPath(ctx, p, WARM[3]);
      ctx.restore();
      fillPath(ctx, (c) => star5(c, 29, 30, 12, 0.5), WARM[4]);
    });
    shine(ctx, 25, 22, 4, 2.4);
  },

  lantern(ctx) {
    drawLantern(ctx, 32, 31, 0.54, true, LW);
  },

  carrot(ctx) {
    shadow(ctx, 16);
    ctx.save();
    ctx.translate(31, 35);
    ctx.rotate(0.62);
    // leafy top first (behind the root)
    const leaf = (a: number, len: number, col: string) => {
      ctx.save();
      ctx.translate(0, -19);
      ctx.rotate(a);
      inked(ctx, (c) => {
        c.moveTo(-3, 0);
        c.quadraticCurveTo(-7, -len * 0.6, 0, -len);
        c.quadraticCurveTo(7, -len * 0.6, 3, 0);
        c.closePath();
      }, col, 2.5);
      ctx.restore();
    };
    leaf(-0.55, 16, PINE[1]);
    leaf(0.5, 15, PINE[1]);
    leaf(0, 20, PINE[2]);
    const root = (c: Ctx) => {
      c.moveTo(-10, -19);
      c.quadraticCurveTo(0, -24, 10, -19);
      c.quadraticCurveTo(7, 4, 1, 24);
      c.quadraticCurveTo(-1, 25, -2, 23);
      c.quadraticCurveTo(-8, 4, -10, -19);
      c.closePath();
    };
    inked(ctx, root, WARM[1], LW);
    clipped(ctx, root, () => {
      ctx.save();
      ctx.translate(-3, -1);
      fillPath(ctx, root, WARM[2]);
      ctx.restore();
      fillPath(ctx, (c) => ellipse(c, -4, -10, 2.4, 7), WARM[3]);
      // root rings
      ctx.strokeStyle = mix(WARM[0], INK, 0.2);
      ctx.lineWidth = 1.8;
      for (const [y, w] of [[-8, 5], [1, 4], [10, 3]] as [number, number][]) {
        ctx.beginPath();
        ctx.moveTo(w * 0.2, y);
        ctx.lineTo(w * 1.6, y - 1);
        ctx.stroke();
      }
    });
    ctx.restore();
  },

  mitten(ctx) {
    shadow(ctx, 17);
    const body = (c: Ctx) => {
      roundRect(c, 21, 8, 26, 40, 12);
      ellipse(c, 17, 30, 7, 11, -0.55);
    };
    inked(ctx, body, ICE[0], LW);
    clipped(ctx, body, () => {
      ctx.save();
      ctx.translate(-3, -3);
      fillPath(ctx, body, ICE[1]);
      ctx.restore();
      fillPath(ctx, (c) => ellipse(c, 28, 16, 5, 3, -0.4), ICE[2]);
      // knitted cream stripe
      fillPath(ctx, (c) => c.rect(8, 33, 44, 5), CREAM);
      fillPath(ctx, (c) => c.rect(8, 37, 44, 1.5), SNOW[0]);
    });
    // cuff
    const cuff = (c: Ctx) => roundRect(c, 18, 44, 32, 12, 4);
    inked(ctx, cuff, SNOW[0], LW);
    clipped(ctx, cuff, () => {
      fillPath(ctx, (c) => roundRect(c, 16, 42, 31, 12, 4), CREAM);
      ctx.strokeStyle = rgba(VIOLET[1], 0.55);
      ctx.lineWidth = 1.6;
      for (let x = 23; x < 50; x += 5) {
        ctx.beginPath();
        ctx.moveTo(x, 46);
        ctx.lineTo(x, 55);
        ctx.stroke();
      }
    });
  },

  cocoa(ctx) {
    shadow(ctx, 19);
    // steam
    for (const [x, ph] of [[24, 0], [34, 1]] as [number, number][]) {
      const s = (c: Ctx) => {
        c.moveTo(x, 18);
        c.bezierCurveTo(x - 5 + ph * 2, 13, x + 5, 9, x - 1 + ph, 3);
      };
      strokePath(ctx, s, rgba(INK, 0.75), 6);
      strokePath(ctx, s, CREAM, 3);
    }
    // handle
    strokePath(ctx, (c) => c.arc(45, 37, 8, -1.3, 1.3), INK, 12);
    strokePath(ctx, (c) => c.arc(45, 37, 8, -1.3, 1.3), SNOW[1], 5);
    const mug = (c: Ctx) => {
      c.moveTo(12, 22);
      c.lineTo(46, 22);
      c.lineTo(43, 51);
      c.quadraticCurveTo(42, 55, 38, 55);
      c.lineTo(20, 55);
      c.quadraticCurveTo(16, 55, 15, 51);
      c.closePath();
    };
    inked(ctx, mug, mix(SNOW[0], VIOLET[3], 0.4), LW);
    clipped(ctx, mug, () => {
      ctx.save();
      ctx.translate(-3, 0);
      fillPath(ctx, mug, SNOW[2]);
      ctx.restore();
      // red band with a cream heart
      fillPath(ctx, (c) => c.rect(8, 33, 44, 9), WARM[1]);
      fillPath(ctx, (c) => c.rect(38, 33, 10, 9), WARM[0]);
    });
    // cocoa surface + marshmallow
    inked(ctx, (c) => ellipse(c, 29, 22, 17, 4.5), WOOD[0], 2.5);
    fillPath(ctx, (c) => ellipse(c, 27, 22.5, 13, 2.6), WOOD[1]);
    inked(ctx, (c) => roundRect(c, 30, 16, 9, 7, 2.5), CREAM, 2);
  },

  fish(ctx) {
    shadow(ctx, 20);
    const base = '#ff8a7a';
    const dark = mix(WARM[1], BERRY[0], 0.25);
    const light = '#ffd2c2';
    // tail
    inked(ctx, (c) => {
      c.moveTo(16, 32);
      c.lineTo(4, 20);
      c.quadraticCurveTo(8, 32, 4, 45);
      c.closePath();
    }, dark, LW);
    // top fin
    inked(ctx, (c) => {
      c.moveTo(24, 22);
      c.quadraticCurveTo(30, 11, 41, 20);
      c.closePath();
    }, dark, 2.5);
    const body = (c: Ctx) => {
      c.moveTo(12, 32);
      c.bezierCurveTo(20, 16, 46, 14, 58, 31);
      c.bezierCurveTo(46, 48, 20, 48, 12, 32);
      c.closePath();
    };
    inked(ctx, body, dark, LW);
    clipped(ctx, body, () => {
      ctx.save();
      ctx.translate(-2, -3);
      fillPath(ctx, body, base);
      ctx.restore();
      fillPath(ctx, (c) => ellipse(c, 34, 41, 18, 5), light);
      // scale arcs
      ctx.strokeStyle = rgba(dark, 0.9);
      ctx.lineWidth = 1.6;
      for (const [x, y] of [[24, 28], [31, 31], [24, 35]]) {
        ctx.beginPath();
        ctx.arc(x, y, 4, -1.2, 1.2);
        ctx.stroke();
      }
      // gill line
      ctx.beginPath();
      ctx.arc(37, 32, 9, -1, 1);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    // side fin
    inked(ctx, (c) => { c.moveTo(34, 36); c.quadraticCurveTo(30, 44, 25, 41); c.closePath(); }, dark, 2);
    // eye + smile
    fillPath(ctx, (c) => circle(c, 47, 28, 4.2), INK2);
    fillPath(ctx, (c) => circle(c, 45.6, 26.6, 1.6), CREAM);
    strokePath(ctx, (c) => { c.moveTo(51, 35); c.quadraticCurveTo(54, 36, 56, 33); }, INK, 1.8);
  },

  acorn(ctx) {
    shadow(ctx, 14);
    const nut = (c: Ctx) => {
      c.moveTo(17, 28);
      c.bezierCurveTo(16, 44, 26, 52, 32, 57);
      c.bezierCurveTo(38, 52, 48, 44, 47, 28);
      c.closePath();
    };
    inked(ctx, nut, WOOD[2], LW);
    clipped(ctx, nut, () => {
      ctx.save();
      ctx.translate(-3, -2);
      fillPath(ctx, nut, mix(WOOD[3], WARM[3], 0.15));
      ctx.restore();
      fillPath(ctx, (c) => ellipse(c, 25, 38, 3, 7, 0.2), CREAM);
    });
    const cap = (c: Ctx) => {
      c.moveTo(12, 30);
      c.bezierCurveTo(12, 14, 52, 14, 52, 30);
      c.quadraticCurveTo(32, 36, 12, 30);
      c.closePath();
    };
    inked(ctx, cap, WOOD[0], LW);
    clipped(ctx, cap, () => {
      fillPath(ctx, (c) => ellipse(c, 28, 22, 16, 7), WOOD[1]);
      ctx.strokeStyle = mix(WOOD[0], INK, 0.35);
      ctx.lineWidth = 1.6;
      for (let k = -4; k <= 4; k++) {
        ctx.beginPath();
        ctx.moveTo(32 + k * 6 - 8, 16);
        ctx.lineTo(32 + k * 6 + 8, 34);
        ctx.moveTo(32 + k * 6 + 8, 16);
        ctx.lineTo(32 + k * 6 - 8, 34);
        ctx.stroke();
      }
    });
    // stem
    inkedStroke(ctx, (c) => { c.moveTo(32, 18); c.quadraticCurveTo(33, 11, 38, 9); }, WOOD[1], 4, 2.5);
  },

  berry(ctx) {
    shadow(ctx, 19);
    // stem + leaves
    inkedStroke(ctx, (c) => { c.moveTo(32, 22); c.quadraticCurveTo(31, 14, 36, 8); }, WOOD[1], 3, 2);
    for (const [ang, col] of [[-0.9, PINE[1]], [0.5, PINE[2]]] as [number, string][]) {
      ctx.save();
      ctx.translate(34, 11);
      ctx.rotate(ang);
      inked(ctx, (c) => {
        c.moveTo(0, 0);
        c.quadraticCurveTo(7, -6, 16, 0);
        c.quadraticCurveTo(7, 6, 0, 0);
        c.closePath();
      }, col, 2.5);
      strokePath(ctx, (c) => { c.moveTo(2, 0); c.lineTo(13, 0); }, PINE[0], 1.4);
      ctx.restore();
    }
    const balls: [number, number, number][] = [[20, 41, 12], [44, 41, 12], [32, 28, 12]];
    for (const [x, y, r] of balls) {
      const b = (c: Ctx) => circle(c, x, y, r);
      inked(ctx, b, BERRY[0], LW);
      clipped(ctx, b, () => {
        fillPath(ctx, (c) => circle(c, x - 2.5, y - 2.5, r - 1), BERRY[1]);
      });
      shine(ctx, x - 4.5, y - 4.5, 3.4, 2.2);
      // little crown at the bottom of each berry
      fillPath(ctx, (c) => circle(c, x + 3, y + 5, 1.6), rgba(INK, 0.55));
    }
  },

  bell(ctx) {
    shadow(ctx, 17);
    // clapper
    inked(ctx, (c) => circle(c, 32, 50, 5.5), WARM[2], LW);
    const body = (c: Ctx) => {
      c.moveTo(32, 12);
      c.bezierCurveTo(21, 12, 19, 22, 18, 32);
      c.quadraticCurveTo(17, 40, 10, 45);
      c.quadraticCurveTo(32, 52, 54, 45);
      c.quadraticCurveTo(47, 40, 46, 32);
      c.bezierCurveTo(45, 22, 43, 12, 32, 12);
      c.closePath();
    };
    inked(ctx, body, WARM[2], LW);
    clipped(ctx, body, () => {
      ctx.save();
      ctx.translate(-4, -2);
      fillPath(ctx, body, WARM[3]);
      ctx.restore();
      fillPath(ctx, (c) => ellipse(c, 25, 26, 3, 9, 0.15), WARM[4]);
      fillPath(ctx, (c) => c.rect(6, 39, 52, 3), rgba(WARM[0], 0.45));
    });
    // bow on top
    for (const d of [-1, 1]) {
      inked(ctx, (c) => {
        c.moveTo(32, 11);
        c.bezierCurveTo(32 + d * 12, 0, 32 + d * 16, 14, 32, 11);
        c.closePath();
      }, WARM[1], 2.5);
    }
    inked(ctx, (c) => circle(c, 32, 11, 3.5), WARM[1], 2.5);
  },

  cookie(ctx) {
    shadow(ctx, 19);
    const R = 22;
    const bx = 50;
    const by = 15;
    const br = 9;
    const disc = (c: Ctx) => circle(c, 32, 33, R);
    const dough = mix(WOOD[3], WOOD[2], 0.35);
    // draw onto a layer so the bite can be cut out cleanly
    inked(ctx, disc, WOOD[2], LW);
    clipped(ctx, disc, () => {
      fillPath(ctx, (c) => circle(c, 30, 31, R - 1), dough);
      fillPath(ctx, (c) => ellipse(c, 25, 24, 8, 5, -0.5), mix(dough, WARM[4], 0.45));
      // chocolate chips
      for (const [x, y, s] of [[22, 34, 3.4], [33, 25, 3], [40, 39, 3.6], [29, 45, 2.8], [18, 23, 2.4], [44, 28, 2.4]]) {
        fillPath(ctx, (c) => ellipse(c, x, y, s, s * 0.8, 0.4), WOOD[0]);
        fillPath(ctx, (c) => circle(c, x - s * 0.35, y - s * 0.35, s * 0.3), WOOD[1]);
      }
    });
    // bite out of the upper right: ink the bitten rim (on the cookie only), then erase the bite
    const bite = (c: Ctx, grow: number) => {
      circle(c, bx, by, br + grow);
      circle(c, bx - 9, by - 4, 5.5 + grow);
      circle(c, bx + 5, by + 8, 5.5 + grow);
    };
    clipped(ctx, (c) => circle(c, 32, 33, R), () => fillPath(ctx, (c) => bite(c, LW), INK));
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    fillPath(ctx, (c) => bite(c, 0), '#000');
    ctx.restore();
    // crumbs
    for (const [x, y] of [[54, 33], [57, 27]]) inked(ctx, (c) => circle(c, x, y, 1.8), dough, 1.5);
  },

  apple(ctx) {
    shadow(ctx, 18);
    // stem + leaf
    inkedStroke(ctx, (c) => { c.moveTo(32, 20); c.quadraticCurveTo(31, 12, 35, 7); }, WOOD[1], 3.5, 2);
    ctx.save();
    ctx.translate(35, 13);
    ctx.rotate(-0.45);
    inked(ctx, (c) => {
      c.moveTo(0, 0);
      c.quadraticCurveTo(8, -8, 17, -2);
      c.quadraticCurveTo(8, 6, 0, 0);
      c.closePath();
    }, PINE[2], 2.5);
    strokePath(ctx, (c) => { c.moveTo(2, -1); c.lineTo(13, -2); }, PINE[1], 1.4);
    ctx.restore();
    const body = (c: Ctx) => {
      c.moveTo(32, 21);
      c.bezierCurveTo(40, 14, 56, 18, 54, 35);
      c.bezierCurveTo(53, 49, 43, 58, 36, 55);
      c.quadraticCurveTo(32, 53, 28, 55);
      c.bezierCurveTo(21, 58, 11, 49, 10, 35);
      c.bezierCurveTo(8, 18, 24, 14, 32, 21);
      c.closePath();
    };
    inked(ctx, body, WARM[0], LW);
    clipped(ctx, body, () => {
      ctx.save();
      ctx.translate(-3, -3);
      fillPath(ctx, body, WARM[1]);
      ctx.restore();
    });
    shine(ctx, 20, 28, 4, 6, 0.35, 0.9);
    strokePath(ctx, (c) => { c.moveTo(28, 22); c.quadraticCurveTo(32, 25, 36, 22); }, rgba(INK, 0.6), 1.8);
  },

  feather(ctx) {
    shadow(ctx, 14);
    // shaft from lower-left to upper-right
    const P0: [number, number] = [14, 56];
    const P1: [number, number] = [18, 26];
    const P2: [number, number] = [48, 8];
    const at = (t: number): [number, number] => [
      (1 - t) * (1 - t) * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
      (1 - t) * (1 - t) * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1],
    ];
    const nrm = (t: number): [number, number] => {
      const dx = 2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]);
      const dy = 2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]);
      const l = Math.hypot(dx, dy);
      return [-dy / l, dx / l];
    };
    const width = (t: number) => (t < 0.16 ? 0 : 11 * Math.sin(((t - 0.16) / 0.84) * Math.PI) ** 0.7);
    const side = (s: number): number[] => {
      const pts: number[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = 0.16 + (0.84 * i) / 24;
        const [x, y] = at(t);
        const [nx, ny] = nrm(t);
        // two notches in the vane
        const notch = (s > 0 && Math.abs(t - 0.5) < 0.03) || (s < 0 && Math.abs(t - 0.66) < 0.03) ? 0.45 : 1;
        const w = width(t) * notch * (s > 0 ? 1 : 0.85);
        pts.push(x + nx * w * s, y + ny * w * s);
      }
      return pts;
    };
    const L = side(1);
    const R = side(-1);
    const vane = (c: Ctx) => {
      const [sx, sy] = at(0.16);
      c.moveTo(sx, sy);
      for (let i = 0; i < L.length; i += 2) c.lineTo(L[i], L[i + 1]);
      for (let i = R.length - 2; i >= 0; i -= 2) c.lineTo(R[i], R[i + 1]);
      c.closePath();
    };
    inked(ctx, vane, ICE[0], LW);
    clipped(ctx, vane, () => {
      fillPath(ctx, (c) => {
        const [sx, sy] = at(0.16);
        c.moveTo(sx, sy);
        for (let i = 0; i < L.length; i += 2) c.lineTo(L[i], L[i + 1]);
        for (let i = 48; i >= 0; i--) {
          const [x, y] = at(0.16 + (0.84 * i) / 48);
          c.lineTo(x, y);
        }
        c.closePath();
      }, ICE[1]);
      // barb lines
      ctx.strokeStyle = rgba(ICE[3], 0.8);
      ctx.lineWidth = 1.4;
      for (const t of [0.3, 0.42, 0.56, 0.7, 0.82]) {
        const [x, y] = at(t);
        const [nx, ny] = nrm(t);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + nx * 9 - 3, y + ny * 9 + 3);
        ctx.stroke();
      }
      // tip colour band
      fillPath(ctx, (c) => circle(c, P2[0], P2[1], 9), ICE[2]);
    });
    // shaft
    strokePath(ctx, (c) => {
      c.moveTo(P0[0], P0[1]);
      c.quadraticCurveTo(P1[0], P1[1], P2[0], P2[1]);
    }, INK, 5);
    strokePath(ctx, (c) => {
      c.moveTo(P0[0], P0[1]);
      c.quadraticCurveTo(P1[0], P1[1], lerp(P1[0], P2[0], 0.9), lerp(P1[1], P2[1], 0.9));
    }, CREAM, 2);
  },

  candle(ctx) {
    shadow(ctx, 20);
    // flame glow
    bandGlow(ctx, 32, 12, 15, WARM[3], 0.35, 3);
    // dish
    const dish = (c: Ctx) => ellipse(c, 30, 52, 19, 6);
    inked(ctx, dish, WARM[2], LW);
    fillPath(ctx, (c) => ellipse(c, 28, 50.5, 16, 3.6), WARM[3]);
    // ring handle
    strokePath(ctx, (c) => c.arc(51, 49, 5, -1.9, 1.7), INK, 8);
    strokePath(ctx, (c) => c.arc(51, 49, 5, -1.9, 1.7), WARM[3], 3);
    // stick
    const stick = (c: Ctx) => {
      c.moveTo(23, 25);
      c.quadraticCurveTo(31, 22, 39, 25);
      c.lineTo(39, 51);
      c.quadraticCurveTo(31, 54, 23, 51);
      c.closePath();
    };
    inked(ctx, stick, WARM[0], LW);
    clipped(ctx, stick, () => {
      fillPath(ctx, (c) => c.rect(20, 20, 14, 36), WARM[1]);
      fillPath(ctx, (c) => c.rect(25, 28, 3, 20), rgba(WARM[4], 0.5));
      // drip
      fillPath(ctx, (c) => { c.moveTo(23, 24); c.lineTo(30, 24); c.lineTo(29, 34); c.quadraticCurveTo(27, 37, 25.5, 34); c.closePath(); }, '#ff8a7a');
    });
    // wick + flame
    strokePath(ctx, (c) => { c.moveTo(31, 24); c.lineTo(31, 19); }, INK, 2);
    const flame = (c: Ctx) => {
      c.moveTo(31, 21);
      c.bezierCurveTo(23, 19, 25, 10, 32, 3);
      c.bezierCurveTo(38, 11, 39, 19, 31, 21);
      c.closePath();
    };
    inked(ctx, flame, WARM[2], 2.5);
    fillPath(ctx, (c) => ellipse(c, 31, 15, 3.4, 5), WARM[4]);
  },

  sled(ctx) {
    shadow(ctx, 25, 57);
    ctx.translate(32, 50);
    ctx.scale(0.88, 0.94);
    ctx.translate(-32, -50);
    // classic kid sled, side view, front to the right: slatted deck on struts over a
    // chunky red runner that sweeps up into a big front curl
    const runner = (c: Ctx) => {
      c.moveTo(3, 44);
      c.quadraticCurveTo(4, 50, 10, 50);
      c.lineTo(44, 50);
      c.bezierCurveTo(60, 50, 63, 32, 54, 25);
      c.bezierCurveTo(48, 21, 42, 27, 47, 31);
    };
    // struts
    for (const x of [13, 25, 37]) {
      strokePath(ctx, (c) => { c.moveTo(x, 50); c.lineTo(x, 34); }, INK, 9);
      strokePath(ctx, (c) => { c.moveTo(x, 50); c.lineTo(x, 34); }, WOOD[1], 3.5);
    }
    // deck (behind the curl)
    const deck = (c: Ctx) => roundRect(c, 4, 25, 42, 10, 3);
    inked(ctx, deck, WOOD[1], LW);
    clipped(ctx, deck, () => {
      fillPath(ctx, (c) => roundRect(c, 2, 23, 42, 10, 3), WOOD[2]);
      fillPath(ctx, (c) => c.rect(4, 26, 42, 2.5), WOOD[3]);
      ctx.strokeStyle = WOOD[0];
      ctx.lineWidth = 1.6;
      for (const x of [18, 32]) {
        ctx.beginPath();
        ctx.moveTo(x, 25);
        ctx.lineTo(x, 35);
        ctx.stroke();
      }
    });
    strokePath(ctx, runner, INK, 12);
    strokePath(ctx, runner, WARM[1], 6);
    strokePath(ctx, (c) => { c.moveTo(12, 48.5); c.lineTo(42, 48.5); }, '#ff8a7a', 1.6);
    // pull rope looping from the curl
    strokePath(ctx, (c) => { c.moveTo(50, 28); c.bezierCurveTo(48, 12, 30, 10, 28, 18); }, INK, 5);
    strokePath(ctx, (c) => { c.moveTo(50, 28); c.bezierCurveTo(48, 12, 30, 10, 28, 18); }, WARM[3], 2);
  },

  scarf(ctx) {
    shadow(ctx, 18);
    const base = PINE[2];
    const dark = PINE[1];
    const stripe = CREAM;
    // back tail
    const tailB = (c: Ctx) => {
      c.moveTo(34, 22);
      c.quadraticCurveTo(46, 34, 42, 52);
      c.lineTo(32, 52);
      c.quadraticCurveTo(35, 36, 26, 26);
      c.closePath();
    };
    inked(ctx, tailB, dark, LW);
    clipped(ctx, tailB, () => {
      fillPath(ctx, (c) => c.rect(20, 37, 40, 4), mix(stripe, PINE[1], 0.3));
      fillPath(ctx, (c) => c.rect(20, 45, 40, 3), mix(stripe, PINE[1], 0.3));
    });
    // neck loop (ring seen at an angle)
    const loop = (c: Ctx) => {
      ellipse(c, 32, 18, 21, 10);
    };
    inked(ctx, loop, dark, LW);
    clipped(ctx, loop, () => {
      fillPath(ctx, (c) => ellipse(c, 30, 16, 20, 9), base);
      for (const x of [15, 45]) fillPath(ctx, (c) => c.rect(x, 4, 5, 30), stripe);
    });
    // the hole through the loop (where a neck would go)
    inked(ctx, (c) => ellipse(c, 33, 17, 12, 4.5), mix(dark, INK, 0.55), 2);
    // front tail
    const tailF = (c: Ctx) => {
      c.moveTo(20, 22);
      c.quadraticCurveTo(14, 38, 20, 54);
      c.lineTo(31, 52);
      c.quadraticCurveTo(26, 38, 31, 25);
      c.closePath();
    };
    inked(ctx, tailF, dark, LW);
    clipped(ctx, tailF, () => {
      fillPath(ctx, (c) => c.rect(10, 22, 13, 40), base);
      fillPath(ctx, (c) => c.rect(10, 34, 30, 4), stripe);
      fillPath(ctx, (c) => c.rect(10, 43, 30, 3), stripe);
    });
    // fringe
    for (let k = 0; k < 4; k++) {
      const x = 21 + k * 3;
      strokePath(ctx, (c) => { c.moveTo(x, 53); c.lineTo(x - 1, 60); }, INK, 3.6);
      strokePath(ctx, (c) => { c.moveTo(x, 53); c.lineTo(x - 1, 59); }, base, 1.4);
    }
    for (let k = 0; k < 3; k++) {
      const x = 34 + k * 3;
      strokePath(ctx, (c) => { c.moveTo(x, 52); c.lineTo(x + 1, 58); }, INK, 3.6);
      strokePath(ctx, (c) => { c.moveTo(x, 52); c.lineTo(x + 1, 57); }, dark, 1.4);
    }
  },

  pie(ctx) {
    shadow(ctx, 25, 57);
    const tin = (c: Ctx) => {
      c.moveTo(6, 33);
      c.lineTo(58, 33);
      c.lineTo(53, 50);
      c.quadraticCurveTo(32, 56, 11, 50);
      c.closePath();
    };
    inked(ctx, tin, ROCK[0], LW);
    clipped(ctx, tin, () => {
      fillPath(ctx, (c) => c.rect(0, 30, 50, 30), ROCK[2]);
      ctx.strokeStyle = rgba(ROCK[0], 0.7);
      ctx.lineWidth = 1.6;
      for (let x = 10; x < 58; x += 6) {
        ctx.beginPath();
        ctx.moveTo(x, 36);
        ctx.lineTo(x + (x - 32) * 0.08, 52);
        ctx.stroke();
      }
    });
    // top: filling under a lattice
    const top = (c: Ctx) => ellipse(c, 32, 32, 26, 11);
    inked(ctx, top, WOOD[2], LW);
    clipped(ctx, top, () => {
      fillPath(ctx, top, BERRY[0]);
      fillPath(ctx, (c) => ellipse(c, 30, 31, 22, 8), BERRY[1]);
      // lattice
      for (const k of [-2, -1, 0, 1, 2]) {
        const x = 32 + k * 10;
        fillPath(ctx, (c) => poly(c, [x - 3.5 - 4, 18, x + 3.5 - 4, 18, x + 3.5 + 4, 46, x - 3.5 + 4, 46]), WOOD[3]);
      }
      for (const k of [-1, 0, 1]) fillPath(ctx, (c) => c.rect(0, 30 + k * 6 - 2, 64, 4), mix(WOOD[3], WOOD[2], 0.4));
    });
    // crimped crust rim
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const x = 32 + Math.cos(a) * 25;
      const y = 32 + Math.sin(a) * 10.5;
      inked(ctx, (c) => circle(c, x, y, 3.4), Math.sin(a) < 0 ? WOOD[3] : WOOD[2], 1.6);
    }
    shine(ctx, 18, 27, 3, 1.6, -0.2, 0.8);
  },

  coin(ctx) {
    shadow(ctx, 18);
    // edge (thickness) then face
    inked(ctx, (c) => circle(c, 32, 34, 22), WARM[2], LW);
    fillPath(ctx, (c) => ellipse(c, 32, 34, 22, 22), mix(WARM[2], WARM[0], 0.35));
    const face = (c: Ctx) => circle(c, 32, 30, 22);
    inked(ctx, face, WARM[2], LW);
    clipped(ctx, face, () => {
      fillPath(ctx, (c) => circle(c, 30, 28, 21), WARM[3]);
    });
    strokePath(ctx, (c) => circle(c, 32, 30, 16), mix(WARM[2], WARM[0], 0.2), 2);
    // embossed little peak with a snow cap
    fillPath(ctx, (c) => poly(c, [20, 38, 32, 20, 44, 38]), WARM[2]);
    fillPath(ctx, (c) => poly(c, [27, 27, 32, 20, 37, 27, 34, 26, 32, 28, 30, 26]), WARM[4]);
    shine(ctx, 22, 18, 4, 2.4);
  },
};

/** Draw a count icon into a 64x64 cell at the current transform (for compositing elsewhere). */
export function drawCountIcon(ctx: Ctx, name: CountIcon): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  PAINT[name](ctx);
  ctx.restore();
}

function inkedStroke(ctx: Ctx, path: PathFn, col: string, w: number, lw: number): void {
  strokePath(ctx, path, INK, w + lw * 2);
  strokePath(ctx, path, col, w);
}

export function buildCountIcons(): { sheets: SheetSpec[] } {
  return { sheets: COUNT_ICONS.map((n) => single(countIconKey(n), 64, 64, (ctx) => drawCountIcon(ctx, n))) };
}
