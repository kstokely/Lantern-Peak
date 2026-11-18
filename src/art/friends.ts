// Bluster the storm cloud and the three trail friends (Pip, Marlow, Odette).
import { TEX, friendKey } from './keys';
import { INK, INK2, VIOLET, SNOW, ICE, WARM, BERRY, WOOD, ROCK, PINK, CREAM, GOAT, mix, rgba } from './palette';
import {
  Ctx, SheetSpec, makeSheet, inked, fillPath, strokePath, clipped, ellipse, circle, roundRect, poly,
  groundShadow, star4,
} from './draw';

function eye(ctx: Ctx, x: number, y: number, rx: number, ry: number, mode: 'open' | 'happy' | 'blink' = 'open'): void {
  if (mode === 'open') {
    fillPath(ctx, (c) => ellipse(c, x, y, rx, ry), INK2);
    fillPath(ctx, (c) => circle(c, x - rx * 0.3, y - ry * 0.38, rx * 0.42), CREAM);
    fillPath(ctx, (c) => circle(c, x + rx * 0.35, y + ry * 0.4, rx * 0.18), CREAM);
  } else {
    const up = mode === 'happy' ? -1 : 0.6;
    strokePath(ctx, (c) => {
      c.moveTo(x - rx, y + 1);
      c.quadraticCurveTo(x, y + up * ry, x + rx, y + 1);
    }, INK, 3.2);
  }
}

// ---------------------------------------------------------------- Bluster

function buildBluster(): SheetSpec {
  return makeSheet(TEX.bluster, 220, 180, 4, (ctx, i) => {
    const puff = i === 2;
    const happy = i === 3;
    const b = i === 1 ? 1 : 0; // idle b: slight drift of the puffs
    const base = happy ? mix(VIOLET[3], SNOW[1], 0.4) : VIOLET[3];
    const dark = happy ? VIOLET[2] : mix(VIOLET[2], VIOLET[1], 0.35);
    const cy = 92 + b * 3;
    const s = puff ? 1.07 : 1;
    const puffs: [number, number, number][] = [
      [58, cy + 8, 34], [92, cy - 22, 38], [134, cy - 26, 36], [166, cy + 2, 32], [112, cy + 18, 46], [70, cy + 30, 26], [156, cy + 30, 26],
    ];
    const shape = (c: Ctx) => {
      for (const [x, y, r] of puffs) circle(c, 110 + (x - 110) * s + (b ? Math.sin(x) * 2 : 0), y, r * s);
    };
    // little rain/snow drizzle under the grumpy frames
    if (!happy) {
      ctx.strokeStyle = rgba(VIOLET[1], 0.7);
      ctx.lineWidth = 3;
      for (let k = 0; k < 5; k++) {
        const x = 70 + k * 20 + (b ? 6 : 0);
        ctx.beginPath();
        ctx.moveTo(x, 150 + (k % 2) * 8);
        ctx.lineTo(x - 4, 160 + (k % 2) * 8);
        ctx.stroke();
      }
    }
    inked(ctx, shape, dark, 4);
    clipped(ctx, shape, () => {
      ctx.save();
      ctx.translate(-6, -8);
      fillPath(ctx, shape, base);
      ctx.restore();
      fillPath(ctx, (c) => {
        ellipse(c, 84, cy - 36, 16, 7, -0.3);
        ellipse(c, 128, cy - 42, 12, 5, -0.1);
      }, SNOW[2]);
    });
    const fx = 112;
    const fy = cy + 8;
    // cheeks
    const cheekR = puff ? 15 : 9;
    fillPath(ctx, (c) => {
      ellipse(c, fx - 34, fy + 14, cheekR, cheekR * 0.7);
      ellipse(c, fx + 34, fy + 14, cheekR, cheekR * 0.7);
    }, rgba(happy ? PINK : BERRY[2], puff ? 0.8 : 0.55));
    // eyes + brows
    eye(ctx, fx - 20, fy - 4, 7, 9, happy ? 'happy' : puff ? 'blink' : 'open');
    eye(ctx, fx + 20, fy - 4, 7, 9, happy ? 'happy' : puff ? 'blink' : 'open');
    const browTilt = happy ? -6 : puff ? 9 : 7;
    for (const d of [-1, 1]) {
      strokePath(ctx, (c) => {
        c.moveTo(fx + d * 30, fy - 20 - (happy ? 4 : 0) - (browTilt > 0 ? 0 : 2));
        c.lineTo(fx + d * 10, fy - 20 + browTilt * 0.6 - (happy ? 4 : 0));
      }, INK, 6);
    }
    // mouth
    if (happy) {
      const m = (c: Ctx) => {
        c.moveTo(fx - 14, fy + 12);
        c.quadraticCurveTo(fx, fy + 32, fx + 14, fy + 12);
        c.closePath();
      };
      inked(ctx, m, mix(BERRY[0], INK, 0.3), 2);
      clipped(ctx, m, () => fillPath(ctx, (c) => ellipse(c, fx, fy + 26, 8, 5), BERRY[2]));
    } else if (puff) {
      // puckered "O" mouth pushed to the left side of the face
      const mx = fx - 12;
      const my = fy + 19;
      // gust: a cone of air leaving the mouth and streaming out past the left edge of the cloud
      const gust = (c: Ctx) => {
        c.moveTo(mx - 4, my - 5);
        c.quadraticCurveTo(mx - 50, my - 22, 4, my - 26);
        c.lineTo(4, my + 24);
        c.quadraticCurveTo(mx - 50, my + 20, mx - 4, my + 5);
        c.closePath();
      };
      fillPath(ctx, gust, rgba(SNOW[2], 0.35));
      const streaks: [number, number, number][] = [[-16, 1, 0], [0, 0, 1], [16, -1, 0.5]];
      for (const [dy, bend, ph] of streaks) {
        const path = (c: Ctx) => {
          c.moveTo(mx - 10, my + dy * 0.3);
          c.bezierCurveTo(mx - 40, my + dy * 0.7 - 8 * bend, mx - 70, my + dy + 8 * bend, 10 + ph * 8, my + dy * 1.2);
        };
        strokePath(ctx, path, INK, 8);
        strokePath(ctx, path, SNOW[2], 3.5);
      }
      // curl at the end of the middle gust, outside the cloud
      const curl = (c: Ctx) => {
        c.moveTo(18, my);
        c.bezierCurveTo(4, my - 2, 2, my - 16, 12, my - 16);
        c.bezierCurveTo(20, my - 16, 20, my - 6, 13, my - 7);
      };
      strokePath(ctx, curl, INK, 8);
      strokePath(ctx, curl, SNOW[2], 3.5);
      inked(ctx, (c) => ellipse(c, mx, my, 7, 7.5), mix(BERRY[0], INK, 0.3), 3);
      fillPath(ctx, (c) => ellipse(c, mx - 1, my + 1, 3.5, 4), INK2);
    } else {
      // grumpy wobbly pout
      strokePath(ctx, (c) => {
        c.moveTo(fx - 10, fy + 20);
        c.quadraticCurveTo(fx - 4, fy + 14, fx, fy + 17);
        c.quadraticCurveTo(fx + 5, fy + 14, fx + 10, fy + 20);
      }, INK, 3.5);
    }
    if (happy) {
      for (const [x, y, r] of [[30, 40, 8], [192, 50, 7], [180, 150, 6]]) {
        inked(ctx, (c) => star4(c, x, y, r, 0.3), WARM[3], 1.5);
      }
    }
  });
}

// ---------------------------------------------------------------- trail friends (200x220, origin 0.5,1)

const FW = 200;
const FH = 220;
const GY = FH - 8;

function pip(ctx: Ctx, talk: boolean): void {
  const fur = SNOW[1];
  const furD = mix(SNOW[0], VIOLET[2], 0.35);
  groundShadow(ctx, 100, GY, 52, 7);
  const bob = talk ? -3 : 0;
  // feet
  for (const x of [74, 120]) inked(ctx, (c) => ellipse(c, x, GY - 8, 20, 9), fur, 4);
  // body
  const body = (c: Ctx) => ellipse(c, 98, GY - 50 + bob, 42, 44);
  inked(ctx, body, furD, 4);
  clipped(ctx, body, () => {
    ctx.save(); ctx.translate(-5, -6); fillPath(ctx, body, fur); ctx.restore();
    fillPath(ctx, (c) => ellipse(c, 100, GY - 40 + bob, 24, 28), SNOW[2]);
  });
  // satchel strap + bag
  strokePath(ctx, (c) => { c.moveTo(70, GY - 86 + bob); c.lineTo(128, GY - 34 + bob); }, INK, 9);
  strokePath(ctx, (c) => { c.moveTo(70, GY - 86 + bob); c.lineTo(128, GY - 34 + bob); }, BERRY[0], 4);
  inked(ctx, (c) => roundRect(c, 116, GY - 46 + bob, 30, 24, 6), BERRY[1], 3.5);
  fillPath(ctx, (c) => roundRect(c, 116, GY - 46 + bob, 30, 10, 5), BERRY[0]);
  // arms: short furry arms from the shoulders, each ending in a round paw. The left paw
  // lifts in the talk frame; the right paw holds the satchel's flap in both frames.
  const paw = talk ? -18 : 0;
  const arm = (sx: number, sy: number, px: number, py: number) => {
    const path = (c: Ctx) => { c.moveTo(sx, sy); c.lineTo(px, py); };
    strokePath(ctx, path, INK, 15 + 8);
    strokePath(ctx, path, fur, 15);
    inked(ctx, (c) => ellipse(c, px, py, 11, 9, -0.4), fur, 4);
    // toe lines so the paw reads as a paw, not a ball
    strokePath(ctx, (c) => { c.moveTo(px - 3, py + 3); c.lineTo(px - 2, py + 7); c.moveTo(px + 3, py + 2); c.lineTo(px + 4, py + 6); }, furD, 1.8);
  };
  if (talk) arm(74, GY - 78 + bob, 50, GY - 96 + bob); // waving while talking
  else arm(76, GY - 76 + bob, 68, GY - 52 + bob + paw);
  arm(126, GY - 74 + bob, 130, GY - 52 + bob);
  // head
  const hy = GY - 118 + bob;
  for (const [x, a] of [[84, -0.25], [112, 0.25]] as [number, number][]) {
    ctx.save();
    ctx.translate(x, hy - 22);
    ctx.rotate(a + (talk && x > 100 ? 0.15 : 0));
    const ear = (c: Ctx) => ellipse(c, 0, -32, 11, 34);
    inked(ctx, ear, fur, 4);
    fillPath(ctx, (c) => ellipse(c, 0, -30, 5.5, 24), PINK);
    ctx.restore();
  }
  const head = (c: Ctx) => ellipse(c, 98, hy, 40, 34);
  inked(ctx, head, furD, 4);
  clipped(ctx, head, () => { ctx.save(); ctx.translate(-4, -5); fillPath(ctx, head, fur); ctx.restore(); });
  fillPath(ctx, (c) => { ellipse(c, 74, hy + 10, 7, 4); ellipse(c, 122, hy + 10, 7, 4); }, rgba(PINK, 0.7));
  eye(ctx, 84, hy - 4, 6.5, 9);
  eye(ctx, 112, hy - 4, 6.5, 9);
  fillPath(ctx, (c) => ellipse(c, 98, hy + 8, 5, 3.5), BERRY[1]);
  if (talk) {
    inked(ctx, (c) => ellipse(c, 98, hy + 18, 6, 6), mix(BERRY[0], INK, 0.3), 2);
    fillPath(ctx, (c) => roundRect(c, 95, hy + 12, 6, 4, 1), CREAM);
  } else {
    strokePath(ctx, (c) => { c.moveTo(91, hy + 14); c.quadraticCurveTo(95, hy + 18, 98, hy + 12); c.quadraticCurveTo(101, hy + 18, 105, hy + 14); }, INK, 2.5);
  }
  // whiskers
  ctx.strokeStyle = rgba(INK, 0.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const d of [-1, 1]) {
    ctx.moveTo(98 + d * 14, hy + 10); ctx.lineTo(98 + d * 30, hy + 6);
    ctx.moveTo(98 + d * 14, hy + 13); ctx.lineTo(98 + d * 30, hy + 15);
  }
  ctx.stroke();
}

/**
 * Marlow the marmot shopkeeper. Identity lives in the head (the Coin Shop counter hides
 * everything below the shoulders): a broad, flat-topped head wider than tall, tiny round
 * ears set LOW on the sides, a dark brown crown/brow cap, pale puffy cheek pouches around
 * a short muzzle, and two big front teeth. Body: low chubby pear, short bushy tail.
 */
function marlow(ctx: Ctx, talk: boolean): void {
  const fur = '#9d8f83'; // grizzled grey-brown
  const furD = '#665b66'; // cool shadow
  const cap = '#6a4f43'; // darker crown
  const capD = mix(cap, INK, 0.25);
  const pale = '#e6d3b6'; // belly, cheeks, muzzle
  const paleD = mix(pale, VIOLET[2], 0.3);
  const tooth = mix(CREAM, WARM[3], 0.3);
  groundShadow(ctx, 100, GY, 62, 8);
  const bob = talk ? -2 : 0;

  // short bushy tail (behind body, poking out low on the right)
  const tail = (c: Ctx) => {
    c.moveTo(138, GY - 22);
    c.quadraticCurveTo(150, GY - 36, 162, GY - 44);
    c.quadraticCurveTo(176, GY - 40, 174, GY - 28);
    c.quadraticCurveTo(178, GY - 22, 170, GY - 16);
    c.quadraticCurveTo(160, GY - 8, 140, GY - 10);
    c.closePath();
  };
  inked(ctx, tail, furD, 4);
  clipped(ctx, tail, () => {
    fillPath(ctx, (c) => ellipse(c, 168, GY - 34, 9, 12, 0.5), cap);
    strokePath(ctx, (c) => { c.moveTo(150, GY - 30); c.lineTo(160, GY - 34); c.moveTo(152, GY - 22); c.lineTo(164, GY - 24); }, mix(furD, INK, 0.3), 2);
  });
  // hind feet
  for (const x of [70, 130]) {
    inked(ctx, (c) => ellipse(c, x, GY - 7, 20, 9), furD, 4);
    for (const k of [-1, 0, 1]) fillPath(ctx, (c) => circle(c, x + 4 + k * 7, GY - 3, 2), INK);
  }
  // low chubby pear body
  const body = (c: Ctx) => {
    ellipse(c, 100, GY - 50 + bob, 60, 48);
    ellipse(c, 100, GY - 84 + bob, 46, 36);
  };
  inked(ctx, body, furD, 4);
  clipped(ctx, body, () => {
    ctx.save(); ctx.translate(-6, -6); fillPath(ctx, body, fur); ctx.restore();
    fillPath(ctx, (c) => ellipse(c, 100, GY - 44 + bob, 36, 36), pale);
  });

  // apron: bib + skirt in ice blue, straps over both shoulders
  for (const d of [-1, 1]) {
    const strap = (c: Ctx) => { c.moveTo(100 + d * 16, GY - 104 + bob); c.quadraticCurveTo(100 + d * 30, GY - 122 + bob, 100 + d * 40, GY - 112 + bob); };
    strokePath(ctx, strap, INK, 11);
    strokePath(ctx, strap, ICE[2], 5);
  }
  const apron = (c: Ctx) => {
    c.moveTo(80, GY - 106 + bob);
    c.lineTo(120, GY - 106 + bob);
    c.quadraticCurveTo(121, GY - 72 + bob, 138, GY - 62 + bob);
    c.lineTo(142, GY - 16);
    c.quadraticCurveTo(100, GY - 6, 58, GY - 16);
    c.lineTo(62, GY - 62 + bob);
    c.quadraticCurveTo(79, GY - 72 + bob, 80, GY - 106 + bob);
    c.closePath();
  };
  inked(ctx, apron, ICE[2], 3.5);
  clipped(ctx, apron, () => {
    fillPath(ctx, (c) => c.rect(116, GY - 110, 34, 110), mix(ICE[1], ICE[2], 0.45));
    ctx.strokeStyle = rgba(CREAM, 0.6);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(60, GY - 22);
    ctx.lineTo(140, GY - 22);
    ctx.moveTo(84, GY - 100 + bob);
    ctx.lineTo(116, GY - 100 + bob);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  // strap buttons on the bib corners
  for (const x of [84, 116]) inked(ctx, (c) => circle(c, x, GY - 101 + bob, 3.5), WARM[3], 2);
  // pocket with a coin peeking out
  inked(ctx, (c) => circle(c, 95, GY - 50 + bob, 6.5), WARM[3], 2);
  inked(ctx, (c) => roundRect(c, 86, GY - 48 + bob, 28, 18, 4), ICE[1], 2.5);
  // waist tie with a little bow
  if (!talk) {
    strokePath(ctx, (c) => { c.moveTo(62, GY - 60 + bob); c.lineTo(48, GY - 52 + bob); }, INK, 6);
    strokePath(ctx, (c) => { c.moveTo(62, GY - 60 + bob); c.lineTo(48, GY - 52 + bob); }, ICE[2], 2.5);
  }

  // short arms with dark paws (left one waves when talking)
  const arm = (x: number, y: number, rot: number) => {
    inked(ctx, (c) => ellipse(c, x, y, 12, 19, rot), fur, 4);
    const px = x - Math.sin(rot) * 15;
    const py = y + Math.cos(rot) * 15;
    inked(ctx, (c) => ellipse(c, px, py, 9, 7, rot), capD, 3);
  };
  if (talk) arm(52, GY - 108 + bob, 2.6);
  else arm(52, GY - 70 + bob, 0.35);
  arm(148, GY - 70 + bob, -0.35);

  // ---- head ----
  const hx = 100;
  const hy = GY - 136 + bob;
  // tiny round ears set low on the sides of the head, half hidden behind it
  for (const d of [-1, 1]) {
    inked(ctx, (c) => circle(c, hx + d * 41, hy - 8, 10), furD, 4);
    fillPath(ctx, (c) => circle(c, hx + d * 42, hy - 7, 5), mix(PINK, furD, 0.45));
  }
  // broad, flat-topped head (wider than tall) with full jowls
  const head = (c: Ctx) => {
    c.moveTo(hx - 44, hy + 6);
    c.bezierCurveTo(hx - 46, hy - 26, hx - 26, hy - 34, hx, hy - 34);
    c.bezierCurveTo(hx + 26, hy - 34, hx + 46, hy - 26, hx + 44, hy + 6);
    c.bezierCurveTo(hx + 44, hy + 30, hx + 22, hy + 38, hx, hy + 38);
    c.bezierCurveTo(hx - 22, hy + 38, hx - 44, hy + 30, hx - 44, hy + 6);
    c.closePath();
  };
  inked(ctx, head, furD, 4);
  clipped(ctx, head, () => {
    ctx.save(); ctx.translate(-4, -4); fillPath(ctx, head, fur); ctx.restore();
    // dark crown cap that runs down the nose bridge (the classic marmot face mask)
    const capPath = (c: Ctx) => {
      c.moveTo(hx - 48, hy - 6);
      c.quadraticCurveTo(hx - 30, hy - 12, hx - 12, hy - 4);
      c.quadraticCurveTo(hx, hy + 4, hx + 12, hy - 4);
      c.quadraticCurveTo(hx + 30, hy - 12, hx + 48, hy - 6);
      c.lineTo(hx + 48, hy - 50);
      c.lineTo(hx - 48, hy - 50);
      c.closePath();
    };
    fillPath(ctx, capPath, cap);
    fillPath(ctx, (c) => ellipse(c, hx - 16, hy - 24, 12, 4.5, -0.25), mix(cap, fur, 0.55));
    // grizzled light flecks on the crown
    for (const [x, y] of [[-24, -16], [-8, -20], [10, -24], [26, -14], [2, -10], [-30, -26]]) {
      strokePath(ctx, (c) => { c.moveTo(hx + x, hy + y); c.lineTo(hx + x + 3, hy + y - 4); }, mix(fur, CREAM, 0.35), 2);
    }
    // pale cheek pouches + chin
    fillPath(ctx, (c) => {
      ellipse(c, hx - 17, hy + 18, 19, 15);
      ellipse(c, hx + 17, hy + 18, 19, 15);
      ellipse(c, hx, hy + 28, 16, 10);
    }, pale);
    fillPath(ctx, (c) => ellipse(c, hx, hy + 37, 30, 6), paleD);
  });
  // eyes: set high, at the edge of the dark cap
  for (const d of [-1, 1]) fillPath(ctx, (c) => ellipse(c, hx + d * 19, hy - 7, 8.5, 9.5), pale);
  eye(ctx, hx - 19, hy - 7, 5.5, 7);
  eye(ctx, hx + 19, hy - 7, 5.5, 7);
  // short muzzle: nose sits right on top of the pouches
  inked(ctx, (c) => ellipse(c, hx, hy + 7, 8, 5.5), INK2, 1.5);
  fillPath(ctx, (c) => circle(c, hx - 3, hy + 5.5, 2), mix(INK2, CREAM, 0.5));
  // split upper lip
  strokePath(ctx, (c) => {
    c.moveTo(hx, hy + 12);
    c.lineTo(hx, hy + 16);
    c.moveTo(hx - 10, hy + 17);
    c.quadraticCurveTo(hx - 5, hy + 20, hx, hy + 16);
    c.quadraticCurveTo(hx + 5, hy + 20, hx + 10, hy + 17);
  }, INK, 2.4);
  // whisker dots
  for (const d of [-1, 1]) for (const [x, y] of [[14, 12], [20, 15], [15, 18]]) fillPath(ctx, (c) => circle(c, hx + d * x, hy + y, 1.3), furD);
  // mouth (talking) behind the big front teeth
  if (talk) {
    inked(ctx, (c) => ellipse(c, hx, hy + 27, 9, 8), mix(BERRY[0], INK, 0.3), 2);
    fillPath(ctx, (c) => ellipse(c, hx, hy + 31, 5, 3), BERRY[2]);
  }
  // two prominent front teeth
  inked(ctx, (c) => roundRect(c, hx - 7, hy + 17, 14, 13, 3), tooth, 2.2);
  strokePath(ctx, (c) => { c.moveTo(hx, hy + 18); c.lineTo(hx, hy + 29); }, INK, 1.8);
  // blush
  fillPath(ctx, (c) => { ellipse(c, hx - 30, hy + 12, 6, 3.5); ellipse(c, hx + 30, hy + 12, 6, 3.5); }, rgba(PINK, 0.55));
}

function odette(ctx: Ctx, talk: boolean): void {
  const feather = ROCK[2];
  const featherD = mix(ROCK[1], VIOLET[1], 0.3);
  const face = GOAT[2];
  groundShadow(ctx, 100, GY, 48, 7);
  const bob = talk ? -3 : 0;
  // feet
  const body = (c: Ctx) => ellipse(c, 100, GY - 62 + bob, 50, 58);
  inked(ctx, body, featherD, 4);
  clipped(ctx, body, () => {
    ctx.save(); ctx.translate(-5, -6); fillPath(ctx, body, feather); ctx.restore();
    fillPath(ctx, (c) => ellipse(c, 100, GY - 46 + bob, 30, 36), mix(feather, CREAM, 0.55));
    // chest feather scallops
    ctx.strokeStyle = featherD;
    ctx.lineWidth = 2;
    for (let r = 0; r < 3; r++) {
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.arc(100 + k * 14 + (r % 2) * 7, GY - 60 + r * 16 + bob, 6, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
    }
  });
  // feet: three chunky orange toes each, drawn IN FRONT of the round body so both read
  for (const x of [84, 116]) {
    const toes = (c: Ctx) => {
      for (const k of [-1, 0, 1]) ellipse(c, x + k * 7, GY - 5 + Math.abs(k), 4.5, 6.5, k * 0.35);
    };
    inked(ctx, toes, WARM[2], 3);
    fillPath(ctx, (c) => { for (const k of [-1, 0, 1]) circle(c, x + k * 7 - 1.5, GY - 8 + Math.abs(k), 1.6); }, WARM[3]);
  }
  // wings
  const wingUp = talk ? -0.6 : 0;
  for (const d of [-1, 1]) {
    ctx.save();
    ctx.translate(100 + d * 46, GY - 82 + bob);
    ctx.rotate(d * (0.15 + (d < 0 ? wingUp : 0)));
    inked(ctx, (c) => ellipse(c, 0, 24, 14, 32), featherD, 4);
    ctx.restore();
  }
  // pocket watch on a chain
  strokePath(ctx, (c) => { c.moveTo(118, GY - 96 + bob); c.quadraticCurveTo(132, GY - 70 + bob, 126, GY - 52 + bob); }, WARM[3], 2.5);
  inked(ctx, (c) => circle(c, 126, GY - 44 + bob, 10), WARM[3], 3);
  fillPath(ctx, (c) => circle(c, 126, GY - 44 + bob, 6.5), CREAM);
  strokePath(ctx, (c) => { c.moveTo(126, GY - 48 + bob); c.lineTo(126, GY - 44 + bob); c.lineTo(129, GY - 43 + bob); }, INK, 1.5);
  // head
  const hy = GY - 132 + bob;
  for (const d of [-1, 1]) {
    inked(ctx, (c) => poly(c, [100 + d * 22, hy - 26, 100 + d * 40, hy - 46, 100 + d * 38, hy - 18]), featherD, 4);
  }
  const head = (c: Ctx) => ellipse(c, 100, hy, 44, 36);
  inked(ctx, head, featherD, 4);
  clipped(ctx, head, () => { ctx.save(); ctx.translate(-4, -5); fillPath(ctx, head, feather); ctx.restore(); });
  // face discs
  fillPath(ctx, (c) => { circle(c, 82, hy + 2, 19); circle(c, 118, hy + 2, 19); }, face);
  eye(ctx, 82, hy + 2, 8, 9.5, talk ? 'open' : 'open');
  eye(ctx, 118, hy + 2, 8, 9.5);
  // tiny spectacles
  ctx.strokeStyle = WARM[3];
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  circle(ctx, 82, hy + 4, 13);
  circle(ctx, 118, hy + 4, 13);
  ctx.moveTo(95, hy + 2);
  ctx.quadraticCurveTo(100, hy - 2, 105, hy + 2);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  circle(ctx, 82, hy + 4, 14.3);
  circle(ctx, 118, hy + 4, 14.3);
  ctx.stroke();
  fillPath(ctx, (c) => poly(c, [76, hy - 2, 80, hy - 4, 74, hy + 4]), rgba(CREAM, 0.7));
  // beak
  if (talk) {
    inked(ctx, (c) => poly(c, [92, hy + 16, 108, hy + 16, 100, hy + 24]), WARM[2], 2.5);
    inked(ctx, (c) => poly(c, [94, hy + 27, 106, hy + 27, 100, hy + 33]), WARM[1], 2.5);
  } else {
    inked(ctx, (c) => poly(c, [92, hy + 16, 108, hy + 16, 100, hy + 30]), WARM[2], 2.5);
  }
  // brow tufts
  for (const d of [-1, 1]) {
    strokePath(ctx, (c) => { c.moveTo(100 + d * 8, hy - 21); c.quadraticCurveTo(100 + d * 18, hy - 25, 100 + d * 28, hy - 18); }, featherD, 4);
  }
}

export function buildFriends(): { sheets: SheetSpec[] } {
  const draw = { pip, marlow, odette } as const;
  const sheets: SheetSpec[] = [buildBluster()];
  for (const who of ['pip', 'marlow', 'odette'] as const) {
    sheets.push(makeSheet(friendKey(who), FW, FH, 2, (ctx, i) => draw[who](ctx, i === 1)));
  }
  return { sheets };
}
