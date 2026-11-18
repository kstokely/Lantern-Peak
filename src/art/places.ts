// Places for the v2 expansion: side-area doorways, Marlow's trail stall, the trading-post
// interior, the Flurry Lodge wall and the darkness overlay.
import { TEX2 } from './keys';
import { INK, INK2, VIOLET, SNOW, ICE, PINE, ROCK, WARM, BERRY, WOOD, GOAT, SKY_DAY, CREAM, mix, rgba } from './palette';
import {
  Ctx, PathFn, SheetSpec, makeSheet, single, inked, fillPath, strokePath, clipped, ellipse, circle, roundRect, poly,
  star4, groundShadow, bandGlow, softGlow, rng, lerp,
} from './draw';
import { drawGem, GEM_RAMPS, drawLantern } from './items';

const W = 1280;
const H = 960;

function inkedStroke(ctx: Ctx, path: PathFn, col: string, w: number, lw = 3): void {
  strokePath(ctx, path, INK, w + lw * 2);
  strokePath(ctx, path, col, w);
}

// ---------------------------------------------------------------- doorways (220x300, origin 0.5,1)

const archOuter = (c: Ctx) => {
  c.moveTo(10, 300);
  c.lineTo(10, 132);
  c.bezierCurveTo(10, 46, 66, 14, 110, 14);
  c.bezierCurveTo(154, 14, 210, 46, 210, 132);
  c.lineTo(210, 300);
  c.closePath();
};
const archInner = (c: Ctx) => {
  c.moveTo(52, 300);
  c.lineTo(52, 152);
  c.bezierCurveTo(52, 102, 80, 74, 110, 74);
  c.bezierCurveTo(140, 74, 168, 102, 168, 152);
  c.lineTo(168, 300);
  c.closePath();
};

/** Stone arch with snow; `interior` paints the opening (already clipped to it). */
function arch(ctx: Ctx, interior: () => void, rock: [string, string, string] = [ROCK[0], ROCK[1], ROCK[2]]): void {
  clipped(ctx, archInner, interior);
  // frame = outer minus inner (even-odd)
  ctx.save();
  ctx.beginPath();
  archOuter(ctx);
  archInner(ctx);
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = rock[0];
  ctx.fill('evenodd');
  ctx.clip('evenodd');
  // lit stone toward the upper left
  ctx.save();
  ctx.translate(-8, -6);
  ctx.beginPath();
  archOuter(ctx);
  ctx.fillStyle = rock[1];
  ctx.fill();
  ctx.restore();
  fillPath(ctx, (c) => ellipse(c, 50, 70, 40, 26, -0.6), rock[2]);
  // stone joints: radial on the arch, staggered courses on the jambs
  ctx.strokeStyle = rgba(INK, 0.45);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let k = 1; k < 8; k++) {
    const a = Math.PI + (k / 8) * Math.PI;
    ctx.moveTo(110 + Math.cos(a) * 60, 150 + Math.sin(a) * 78);
    ctx.lineTo(110 + Math.cos(a) * 104, 150 + Math.sin(a) * 140);
  }
  for (let y = 180; y < 300; y += 36) {
    ctx.moveTo(10, y);
    ctx.lineTo(52, y);
    ctx.moveTo(168, y);
    ctx.lineTo(210, y);
    const off = ((y - 180) / 36) % 2 ? 22 : 34;
    ctx.moveTo(10 + off, y);
    ctx.lineTo(10 + off, y + 36);
    ctx.moveTo(168 + 42 - off, y);
    ctx.lineTo(168 + 42 - off, y + 36);
  }
  ctx.stroke();
  // inner reveal shadow (depth of the opening)
  ctx.lineWidth = 10;
  ctx.strokeStyle = rgba(INK, 0.3);
  ctx.beginPath();
  archInner(ctx);
  ctx.stroke();
  ctx.restore();
  // snow cap with icicle drips
  const cap = (c: Ctx) => {
    c.moveTo(6, 128);
    c.bezierCurveTo(4, 40, 66, 6, 110, 6);
    c.bezierCurveTo(154, 6, 216, 40, 214, 128);
    c.quadraticCurveTo(206, 134, 198, 120);
    c.bezierCurveTo(194, 60, 150, 30, 110, 30);
    c.quadraticCurveTo(100, 42, 90, 31);
    c.bezierCurveTo(52, 38, 22, 70, 22, 118);
    c.quadraticCurveTo(14, 136, 6, 128);
    c.closePath();
  };
  inked(ctx, cap, SNOW[1], 4);
  clipped(ctx, cap, () => fillPath(ctx, (c) => ellipse(c, 80, 14, 70, 14, -0.15), SNOW[2]));
  for (const [x, y, l] of [[60, 52, 12], [150, 46, 16], [176, 64, 10]]) {
    inked(ctx, (c) => poly(c, [x - 5, y - 2, x + 5, y - 2, x, y + l]), ICE[2], 2.5);
  }
  // drifts at the jamb feet
  for (const [x0, x1] of [[0, 70], [150, 220]]) {
    inked(ctx, (c) => {
      c.moveTo(x0, 300);
      c.quadraticCurveTo(x0 + 8, 272, (x0 + x1) / 2, 276);
      c.quadraticCurveTo(x1 - 6, 278, x1, 300);
      c.closePath();
    }, SNOW[2], 3);
    fillPath(ctx, (c) => ellipse(c, (x0 + x1) / 2 + 8, 294, 24, 4), SNOW[0]);
  }
}

function buildDoors(): SheetSpec[] {
  // welcoming interior: a lantern-lit cave beyond, dark at the rim
  const open = (ctx: Ctx) => {
    fillPath(ctx, (c) => c.rect(0, 0, 220, 300), mix(INK, VIOLET[0], 0.35));
    // warm lantern light filling the cave beyond, banded like the skies
    bandGlow(ctx, 110, 190, 120, WARM[2], 0.75, 5, 1.1);
    bandGlow(ctx, 110, 175, 60, WARM[4], 0.6, 4, 1.1);
    // far wall bend + a snowy floor lit warm, path leading in
    fillPath(ctx, (c) => poly(c, [52, 300, 84, 238, 136, 238, 168, 300]), mix(SNOW[0], WARM[3], 0.45));
    fillPath(ctx, (c) => poly(c, [52, 300, 84, 238, 92, 238, 70, 300]), rgba(VIOLET[1], 0.35));
    fillPath(ctx, (c) => poly(c, [96, 300, 104, 240, 116, 240, 124, 300]), rgba(WARM[4], 0.7));
    drawLantern(ctx, 110, 142, 0.5, true, 3);
    strokePath(ctx, (c) => { c.moveTo(110, 74); c.lineTo(110, 116); }, INK, 3);
  };
  const doorOpen = single(TEX2.doorOpen, 220, 300, (ctx) => {
    groundShadow(ctx, 110, 296, 104, 6);
    arch(ctx, () => open(ctx));
    // warm light spilling onto the snow outside
    fillPath(ctx, (c) => ellipse(c, 110, 297, 50, 5), rgba(WARM[3], 0.35));
  });

  const doorIce = makeSheet(TEX2.doorIce, 220, 300, 2, (ctx, i) => {
    groundShadow(ctx, 110, 296, 104, 6);
    arch(ctx, () => {
      fillPath(ctx, (c) => c.rect(0, 0, 220, 300), ICE[1]);
      fillPath(ctx, (c) => poly(c, [120, 74, 220, 74, 220, 300, 90, 300]), mix(ICE[0], ICE[1], 0.4));
      fillPath(ctx, (c) => poly(c, [64, 120, 84, 96, 74, 280, 60, 290]), rgba(ICE[3], 0.75));
      fillPath(ctx, (c) => poly(c, [120, 110, 134, 102, 112, 180]), rgba(ICE[3], 0.55));
      // frozen blocks
      ctx.strokeStyle = rgba(ICE[3], 0.6);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (const y of [140, 200, 256]) {
        ctx.moveTo(52, y);
        ctx.lineTo(168, y + 6);
      }
      ctx.moveTo(104, 140);
      ctx.lineTo(100, 200);
      ctx.moveTo(130, 204);
      ctx.lineTo(134, 260);
      ctx.stroke();
      if (i === 1) {
        // cracks radiating from a struck point
        const cx = 106;
        const cy = 196;
        const cracks = [[-40, -50, -60, -96], [36, -40, 56, -80], [44, 18, 62, 60], [-30, 30, -50, 92], [-48, -4, -60, 6], [8, 48, 2, 104]];
        for (const [ax, ay, bx, by] of cracks) {
          const path = (c: Ctx) => { c.moveTo(cx, cy); c.lineTo(cx + ax * 0.55, cy + ay * 0.55 + 6); c.lineTo(cx + ax, cy + ay); c.lineTo(cx + bx, cy + by); };
          strokePath(ctx, path, INK, 5);
          strokePath(ctx, path, CREAM, 1.8);
        }
        fillPath(ctx, (c) => star4(c, cx, cy, 12, 0.3), rgba(CREAM, 0.9));
      }
    }, [ROCK[0], ROCK[1], ROCK[2]]);
    // ice bulge over the sill + chips if cracked
    inked(ctx, (c) => { c.moveTo(48, 300); c.quadraticCurveTo(110, 280, 172, 300); c.closePath(); }, ICE[2], 3);
    if (i === 1) {
      for (const [x, y, s, a] of [[60, 290, 7, 0.3], [150, 292, 6, -0.5], [176, 286, 5, 0.9], [42, 284, 5, 1.4]]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        inked(ctx, (c) => poly(c, [-s, s * 0.5, -s * 0.3, -s, s, -s * 0.3, s * 0.4, s]), ICE[2], 2.5);
        ctx.restore();
      }
    }
  });

  const doorDark = single(TEX2.doorDark, 220, 300, (ctx) => {
    groundShadow(ctx, 110, 296, 104, 6);
    arch(ctx, () => {
      fillPath(ctx, (c) => c.rect(0, 0, 220, 300), '#0b0918');
      // the faintest hint of depth: two darker-than-dark rings
      for (const [r, a] of [[150, 0.5], [110, 0.6]] as [number, number][]) {
        fillPath(ctx, (c) => ellipse(c, 110, 220, r * 0.45, r * 0.7), rgba('#05040d', a));
      }
    }, [mix(ROCK[0], INK, 0.3), mix(ROCK[1], VIOLET[0], 0.3), ROCK[1]]);
  });

  const doorHigh = single(TEX2.doorHigh, 220, 300, (ctx) => {
    groundShadow(ctx, 110, 296, 100, 6);
    // tall rock step the doorway sits on
    const block = (c: Ctx) => {
      c.moveTo(24, 300);
      c.lineTo(30, 196);
      c.lineTo(190, 192);
      c.lineTo(198, 300);
      c.closePath();
    };
    inked(ctx, block, ROCK[0], 4);
    clipped(ctx, block, () => {
      fillPath(ctx, (c) => poly(c, [20, 300, 26, 190, 150, 190, 130, 300]), ROCK[1]);
      ctx.strokeStyle = rgba(INK, 0.4);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (const y of [228, 262]) {
        ctx.moveTo(26, y);
        ctx.lineTo(196, y - 4);
      }
      ctx.moveTo(90, 196);
      ctx.lineTo(86, 228);
      ctx.moveTo(140, 226);
      ctx.lineTo(144, 260);
      ctx.moveTo(64, 262);
      ctx.lineTo(60, 300);
      ctx.stroke();
      fillPath(ctx, (c) => ellipse(c, 60, 210, 26, 8, -0.1), ROCK[2]);
    });
    // hoof marks scuffed up the face (hint: jump!)
    for (const [x, y] of [[96, 280], [116, 248], [100, 216]]) {
      fillPath(ctx, (c) => { ellipse(c, x - 3, y, 2.6, 4); ellipse(c, x + 3, y, 2.6, 4); }, rgba(INK, 0.5));
    }
    ctx.save();
    ctx.translate(110, 196);
    ctx.scale(0.66, 0.66);
    ctx.translate(-110, -300);
    arch(ctx, () => open(ctx));
    ctx.restore();
    // snowy lip of the ledge
    inked(ctx, (c) => {
      c.moveTo(22, 200);
      c.quadraticCurveTo(24, 186, 44, 188);
      c.lineTo(176, 186);
      c.quadraticCurveTo(198, 184, 196, 198);
      c.quadraticCurveTo(186, 204, 176, 198);
      c.quadraticCurveTo(160, 208, 146, 198);
      c.lineTo(60, 200);
      c.quadraticCurveTo(40, 208, 22, 200);
      c.closePath();
    }, SNOW[1], 3);
    for (const [x, l] of [[52, 14], [170, 18], [130, 10]]) inked(ctx, (c) => poly(c, [x - 5, 200, x + 5, 200, x, 200 + l]), ICE[2], 2.5);
  });
  return [doorOpen, doorIce, doorDark, doorHigh];
}

// ---------------------------------------------------------------- Marlow's trail stall (300x280)

function buildStall(): SheetSpec {
  return single(TEX2.stall, 300, 280, (ctx) => {
    groundShadow(ctx, 150, 274, 140, 7);
    // back wall + shelf
    const back = (c: Ctx) => c.rect(46, 96, 208, 80);
    inked(ctx, back, mix(WOOD[0], VIOLET[0], 0.3), 4);
    fillPath(ctx, (c) => c.rect(46, 134, 208, 8), WOOD[1]);
    for (const [x, col] of [[78, ICE[1]], [104, BERRY[1]], [196, PINE[2]], [222, WARM[2]]] as [number, string][]) {
      inked(ctx, (c) => roundRect(c, x - 9, 112, 18, 22, 4), col, 2.5);
      fillPath(ctx, (c) => c.rect(x - 6, 115, 4, 14), rgba(CREAM, 0.5));
    }
    // posts
    for (const x of [42, 258]) {
      const p = (c: Ctx) => roundRect(c, x - 9, 70, 18, 204, 5);
      inked(ctx, p, WOOD[0], 4);
      fillPath(ctx, (c) => c.rect(x - 9, 72, 11, 200), WOOD[1]);
      fillPath(ctx, (c) => c.rect(x - 6, 72, 3, 200), WOOD[2]);
    }
    // counter
    const counter = (c: Ctx) => c.rect(30, 172, 240, 100);
    inked(ctx, counter, WOOD[0], 4);
    clipped(ctx, counter, () => {
      for (let x = 30, i = 0; x < 270; x += 30, i++) fillPath(ctx, (c) => c.rect(x, 172, 30, 100), i % 2 ? WOOD[1] : mix(WOOD[1], WOOD[2], 0.35));
      ctx.strokeStyle = rgba(INK, 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 60; x < 270; x += 30) {
        ctx.moveTo(x, 172);
        ctx.lineTo(x, 272);
      }
      ctx.stroke();
      fillPath(ctx, (c) => c.rect(30, 172, 240, 14), rgba(INK, 0.25));
    });
    // gem emblem on the counter front
    inked(ctx, (c) => circle(c, 150, 224, 24), WOOD[3], 3.5);
    drawGem(ctx, 150, 224, 0.5, GEM_RAMPS[3], 2.5);
    // counter top board
    const top = (c: Ctx) => roundRect(c, 20, 160, 260, 18, 5);
    inked(ctx, top, WOOD[2], 4);
    fillPath(ctx, (c) => c.rect(24, 163, 252, 4), WOOD[3]);
    // goods on the counter: a red flask, a jar of gems, a little bell
    inked(ctx, (c) => roundRect(c, 62, 128, 22, 34, 6), WARM[1], 3);
    fillPath(ctx, (c) => c.rect(62, 140, 22, 8), CREAM);
    inked(ctx, (c) => roundRect(c, 65, 120, 16, 10, 3), VIOLET[3], 2.5);
    const jar = (c: Ctx) => roundRect(c, 196, 122, 34, 40, 8);
    inked(ctx, jar, rgba(ICE[3], 0.6), 3);
    clipped(ctx, jar, () => {
      drawGem(ctx, 206, 150, 0.26, GEM_RAMPS[0], 1.5);
      drawGem(ctx, 220, 152, 0.26, GEM_RAMPS[4], 1.5);
      drawGem(ctx, 213, 138, 0.26, GEM_RAMPS[1], 1.5);
      fillPath(ctx, (c) => c.rect(200, 126, 5, 30), rgba(CREAM, 0.6));
    });
    inked(ctx, (c) => roundRect(c, 194, 116, 38, 9, 3), WOOD[1], 2.5);
    inked(ctx, (c) => {
      c.moveTo(244, 160);
      c.quadraticCurveTo(244, 140, 254, 138);
      c.quadraticCurveTo(264, 140, 264, 160);
      c.closePath();
    }, WARM[3], 3);
    inked(ctx, (c) => circle(c, 254, 135, 3), WARM[3], 2);
    // striped awning
    const can = (c: Ctx) => {
      c.moveTo(34, 34);
      c.lineTo(266, 34);
      c.lineTo(292, 88);
      c.lineTo(8, 88);
      c.closePath();
    };
    inked(ctx, can, CREAM, 4);
    clipped(ctx, can, () => {
      for (let k = 0; k < 9; k += 2) {
        const tx0 = lerp(34, 266, k / 9);
        const tx1 = lerp(34, 266, (k + 1) / 9);
        const bx0 = lerp(8, 292, k / 9);
        const bx1 = lerp(8, 292, (k + 1) / 9);
        fillPath(ctx, (c) => poly(c, [tx0, 30, tx1, 30, bx1, 92, bx0, 92]), WARM[1]);
      }
      fillPath(ctx, (c) => c.rect(0, 74, 300, 16), rgba(VIOLET[0], 0.2));
    });
    // scalloped valance
    for (let k = 0; k < 9; k++) {
      const x0 = lerp(8, 292, k / 9);
      const x1 = lerp(8, 292, (k + 1) / 9);
      inked(ctx, (c) => { c.moveTo(x0, 86); c.lineTo(x1, 86); c.arc((x0 + x1) / 2, 88, (x1 - x0) / 2, 0, Math.PI); c.closePath(); }, k % 2 ? CREAM : WARM[1], 3);
    }
    // snow on the awning
    inked(ctx, (c) => {
      c.moveTo(28, 40);
      c.quadraticCurveTo(30, 24, 52, 26);
      c.lineTo(250, 26);
      c.quadraticCurveTo(272, 24, 272, 40);
      c.quadraticCurveTo(262, 46, 250, 40);
      c.quadraticCurveTo(232, 50, 214, 40);
      c.lineTo(90, 40);
      c.quadraticCurveTo(70, 50, 52, 40);
      c.quadraticCurveTo(40, 46, 28, 40);
      c.closePath();
    }, SNOW[2], 3);
    // sign standing on the awning ridge with a painted gem
    for (const x of [124, 176]) inkedStroke(ctx, (c) => { c.moveTo(x, 30); c.lineTo(x, 20); }, WOOD[1], 4, 2.5);
    const sign = (c: Ctx) => roundRect(c, 106, 0, 88, 26, 7);
    inked(ctx, sign, WOOD[1], 3.5);
    fillPath(ctx, (c) => roundRect(c, 109, 2, 82, 6, 3), WOOD[3]);
    drawGem(ctx, 150, 13, 0.3, GEM_RAMPS[3], 2);
    for (const x of [124, 176]) inked(ctx, (c) => circle(c, x, 13, 3), WARM[3], 1.6);
  });
}

// ---------------------------------------------------------------- shop interior (1280x960)

function plankWall(ctx: Ctx, r: () => number, cols: [string, string, string], pw = 64): void {
  for (let x = 0, i = 0; x < W; x += pw, i++) {
    const t = r();
    fillPath(ctx, (c) => c.rect(x, 0, pw, H), mix(cols[1], i % 2 ? cols[0] : cols[2], 0.18 + t * 0.15));
    fillPath(ctx, (c) => c.rect(x + 3, 0, 4, H), rgba(cols[2], 0.35));
    fillPath(ctx, (c) => c.rect(x + pw - 3, 0, 3, H), rgba(INK, 0.35));
    // knots and nails
    const ky = 120 + r() * 700;
    fillPath(ctx, (c) => ellipse(c, x + pw * (0.35 + r() * 0.3), ky, 6, 9), rgba(cols[0], 0.6));
    for (const y of [90 + r() * 30, 600 + r() * 40]) fillPath(ctx, (c) => circle(c, x + pw / 2, y, 2.5), rgba(INK, 0.5));
  }
}

function vignette(ctx: Ctx, a: number, col = INK): void {
  const g = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.3, W / 2, H * 0.45, H * 0.85);
  g.addColorStop(0, rgba(col, 0));
  g.addColorStop(1, rgba(col, a));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function shelfBoard(ctx: Ctx, x0: number, x1: number, y: number): void {
  for (const x of [x0 + 26, x1 - 26]) {
    inked(ctx, (c) => poly(c, [x - 7, y + 12, x + 7, y + 12, x + 7, y + 40, x - 7, y + 24]), WOOD[0], 3);
  }
  inked(ctx, (c) => roundRect(c, x0, y, x1 - x0, 18, 4), WOOD[1], 4);
  fillPath(ctx, (c) => c.rect(x0 + 4, y + 2, x1 - x0 - 8, 4), WOOD[3]);
  fillPath(ctx, (c) => c.rect(x0 + 4, y + 18, x1 - x0 - 8, 8), rgba(INK, 0.25));
}

function windowPane(ctx: Ctx, r: () => number, x: number, y: number, w: number, h: number): void {
  const pane = (c: Ctx) => c.rect(x, y, w, h);
  clipped(ctx, pane, () => {
    const bands = ['#2b3d86', '#3a54a6', '#4f6fc0', '#6f8fd6', '#8fb0e6'];
    bands.forEach((b, i) => fillPath(ctx, (c) => c.rect(x, y + (h * i) / bands.length, w, h / bands.length + 1), b));
    // snowy hills + pines outside
    fillPath(ctx, (c) => { c.moveTo(x, y + h); for (let k = 0; k <= 10; k++) c.lineTo(x + (w * k) / 10, y + h * 0.72 + Math.sin(k * 1.3) * 10); c.lineTo(x + w, y + h); c.closePath(); }, mix(SNOW[0], VIOLET[2], 0.3));
    for (let k = 0; k < 5; k++) {
      const px = x + 20 + r() * (w - 40);
      const ph = 40 + r() * 40;
      const by = y + h * 0.76;
      fillPath(ctx, (c) => poly(c, [px - ph * 0.3, by, px, by - ph, px + ph * 0.3, by]), mix(PINE[0], VIOLET[1], 0.4));
      fillPath(ctx, (c) => poly(c, [px - ph * 0.12, by - ph * 0.6, px, by - ph, px + ph * 0.12, by - ph * 0.6]), mix(SNOW[1], VIOLET[3], 0.3));
    }
    fillPath(ctx, (c) => c.rect(x, y + h - 22, w, 22), SNOW[1]);
    // falling snow
    for (let k = 0; k < 70; k++) {
      const s = r();
      ctx.fillStyle = rgba(SNOW[2], 0.5 + s * 0.5);
      ctx.beginPath();
      circle(ctx, x + r() * w, y + r() * h, 1.5 + s * 2.5);
      ctx.fill();
    }
    // frost in the corners
    fillPath(ctx, (c) => { circle(c, x, y, 30); circle(c, x + w, y + h, 26); }, rgba(ICE[3], 0.35));
  });
}

function drawWindow(ctx: Ctx, r: () => number, x: number, y: number, w: number, h: number): void {
  const frame = (c: Ctx) => roundRect(c, x - 18, y - 18, w + 36, h + 36, 8);
  inked(ctx, frame, WOOD[1], 5);
  fillPath(ctx, (c) => c.rect(x - 14, y - 14, w + 28, 6), WOOD[3]);
  windowPane(ctx, r, x, y, w, h);
  // mullions
  for (const [a, b, cx2, d] of [[x + w / 2, y, x + w / 2, y + h], [x, y + h / 2, x + w, y + h / 2]]) {
    strokePath(ctx, (c) => { c.moveTo(a, b); c.lineTo(cx2, d); }, INK, 14);
    strokePath(ctx, (c) => { c.moveTo(a, b); c.lineTo(cx2, d); }, WOOD[1], 8);
  }
  strokePath(ctx, (c) => c.rect(x, y, w, h), INK, 5);
  // sill with snow
  inked(ctx, (c) => roundRect(c, x - 30, y + h + 14, w + 60, 20, 5), WOOD[2], 4);
  inked(ctx, (c) => {
    c.moveTo(x - 24, y + h + 16);
    c.quadraticCurveTo(x - 20, y + h + 2, x + 10, y + h + 6);
    c.quadraticCurveTo(x + w * 0.5, y + h + 2, x + w + 22, y + h + 16);
    c.closePath();
  }, SNOW[2], 3);
}

function jar(ctx: Ctx, x: number, y: number, w: number, h: number, ramp: string[]): void {
  const body = (c: Ctx) => roundRect(c, x - w / 2, y - h, w, h, 8);
  inked(ctx, body, rgba(ICE[3], 0.45), 3.5);
  clipped(ctx, body, () => {
    for (let k = 0; k < 4; k++) drawGem(ctx, x - w / 4 + (k % 2) * (w / 2), y - 12 - Math.floor(k / 2) * 16, 0.24, ramp, 1.5);
    fillPath(ctx, (c) => c.rect(x - w / 2 + 5, y - h + 6, 5, h - 12), rgba(CREAM, 0.55));
  });
  inked(ctx, (c) => roundRect(c, x - w / 2 - 3, y - h - 8, w + 6, 10, 3), WOOD[1], 3);
}

function crateBox(ctx: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  const b = (c: Ctx) => c.rect(x - w / 2, y - h, w, h);
  inked(ctx, b, col, 4);
  fillPath(ctx, (c) => c.rect(x - w / 2, y - h, w, 6), mix(col, WARM[4], 0.3));
  strokePath(ctx, (c) => { c.moveTo(x - w / 2, y - h); c.lineTo(x + w / 2, y); c.moveTo(x + w / 2, y - h); c.lineTo(x - w / 2, y); }, rgba(INK, 0.35), 3);
}

function buildShopBg(): SheetSpec {
  return single(TEX2.shopBg, W, H, (ctx) => {
    const r = rng(7301);
    plankWall(ctx, r, [WOOD[0], WOOD[1], WOOD[2]]);
    // soft warm light from the lanterns, calm in the middle
    softGlow(ctx, 640, 380, 620, WARM[3], 0.22);
    vignette(ctx, 0.55);
    // ceiling beam + brackets
    inked(ctx, (c) => c.rect(-10, -10, W + 20, 70), WOOD[0], 5);
    fillPath(ctx, (c) => c.rect(0, 50, W, 6), WOOD[1]);
    for (const x of [140, 640, 1140]) inked(ctx, (c) => poly(c, [x - 30, 60, x + 30, 60, x, 100]), WOOD[0], 4);
    // window with snow outside (upper left)
    drawWindow(ctx, r, 70, 170, 230, 270);
    // barrel and sack under the window
    const barrel = (c: Ctx) => { c.moveTo(80, 760); c.quadraticCurveTo(64, 670, 80, 580); c.lineTo(200, 580); c.quadraticCurveTo(216, 670, 200, 760); c.closePath(); };
    inked(ctx, barrel, WOOD[1], 5);
    clipped(ctx, barrel, () => {
      fillPath(ctx, (c) => c.rect(150, 560, 80, 220), rgba(INK, 0.25));
      for (const y of [610, 730]) fillPath(ctx, (c) => c.rect(60, y, 170, 12), ROCK[0]);
      fillPath(ctx, (c) => c.rect(96, 580, 10, 180), rgba(WOOD[3], 0.45));
    });
    inked(ctx, (c) => ellipse(c, 140, 580, 60, 12), WOOD[2], 4);
    const sack = (c: Ctx) => { c.moveTo(220, 770); c.bezierCurveTo(200, 700, 230, 660, 270, 650); c.bezierCurveTo(320, 660, 340, 710, 320, 770); c.closePath(); };
    inked(ctx, sack, mix(GOAT[0], WOOD[2], 0.4), 5);
    clipped(ctx, sack, () => fillPath(ctx, (c) => ellipse(c, 300, 730, 30, 60), rgba(INK, 0.2)));
    inkedStroke(ctx, (c) => { c.moveTo(250, 664); c.quadraticCurveTo(270, 672, 290, 662); }, WOOD[0], 4);
    // shelves of goods (right)
    const shelves = [250, 420, 590];
    shelves.forEach((y, si) => {
      shelfBoard(ctx, 960, 1240, y);
      if (si === 0) {
        jar(ctx, 1000, y, 44, 56, GEM_RAMPS[0]);
        jar(ctx, 1060, y, 44, 64, GEM_RAMPS[3]);
        jar(ctx, 1120, y, 44, 52, GEM_RAMPS[4]);
        jar(ctx, 1186, y, 50, 60, GEM_RAMPS[5]);
      } else if (si === 1) {
        crateBox(ctx, 1010, y, 70, 56, WOOD[2]);
        // rolled maps
        for (const [x, yy] of [[1080, y - 12], [1104, y - 12], [1092, y - 34]]) {
          inked(ctx, (c) => roundRect(c, x - 30, yy - 10, 60, 20, 10), mix(GOAT[2], WOOD[3], 0.35), 3);
          inked(ctx, (c) => ellipse(c, x + 28, yy, 5, 9), mix(WOOD[3], WOOD[2], 0.4), 2.5);
        }
        // a hand bell
        inked(ctx, (c) => { c.moveTo(1160, y); c.quadraticCurveTo(1160, y - 40, 1180, y - 42); c.quadraticCurveTo(1200, y - 40, 1200, y); c.closePath(); }, WARM[3], 4);
        inked(ctx, (c) => roundRect(c, 1175, y - 62, 10, 22, 4), WOOD[1], 3);
      } else {
        // flasks and a folded scarf
        for (const [x, col] of [[990, WARM[1]], [1030, ICE[1]], [1070, PINE[2]]] as [number, string][]) {
          inked(ctx, (c) => roundRect(c, x - 14, y - 58, 28, 58, 8), col, 3.5);
          fillPath(ctx, (c) => c.rect(x - 14, y - 40, 28, 12), CREAM);
          inked(ctx, (c) => roundRect(c, x - 10, y - 68, 20, 12, 3), VIOLET[3], 3);
        }
        const sc = (c: Ctx) => roundRect(c, 1110, y - 40, 110, 40, 8);
        inked(ctx, sc, BERRY[1], 4);
        clipped(ctx, sc, () => { for (const x of [1130, 1160, 1190]) fillPath(ctx, (c) => c.rect(x, y - 40, 10, 40), CREAM); });
        fillPath(ctx, (c) => c.rect(1110, y - 22, 110, 3), rgba(INK, 0.35));
      }
    });
    // hanging lanterns at the edges of the calm centre
    for (const x of [380, 900]) {
      strokePath(ctx, (c) => { c.moveTo(x, 60); c.lineTo(x, 118); }, INK, 4);
      drawLantern(ctx, x, 156, 0.9, true, 4);
    }
    // counter across the bottom
    const front = (c: Ctx) => c.rect(-10, 800, W + 20, 200);
    inked(ctx, front, WOOD[0], 6);
    clipped(ctx, front, () => {
      for (let x = 0; x < W; x += 160) {
        inked(ctx, (c) => roundRect(c, x + 16, 828, 128, 110, 8), WOOD[1], 3);
        fillPath(ctx, (c) => roundRect(c, x + 24, 836, 112, 8, 4), rgba(WOOD[3], 0.45));
      }
    });
    const top = (c: Ctx) => roundRect(c, -20, 772, W + 40, 36, 8);
    inked(ctx, top, WOOD[2], 6);
    fillPath(ctx, (c) => c.rect(0, 778, W, 7), WOOD[3]);
    fillPath(ctx, (c) => c.rect(0, 800, W, 6), rgba(INK, 0.3));
    // a few things on the counter at the far ends
    inked(ctx, (c) => { c.moveTo(70, 774); c.lineTo(150, 774); c.lineTo(140, 744); c.lineTo(80, 744); c.closePath(); }, ROCK[2], 4);
    inked(ctx, (c) => roundRect(c, 104, 700, 12, 46, 4), ROCK[1], 3);
    inked(ctx, (c) => roundRect(c, 60, 690, 100, 12, 5), ROCK[2], 3);
    drawGem(ctx, 1170, 748, 0.5, GEM_RAMPS[1], 3);
  });
}

// ---------------------------------------------------------------- Flurry Lodge (1280x960)

/** Top surface y and x-range of the empty lodge shelves (for placing trophies). */
export const LODGE_SHELVES: { x0: number; x1: number; y: number }[] = [
  { x0: 70, x1: 360, y: 330 }, { x0: 70, x1: 360, y: 510 }, { x0: 70, x1: 360, y: 690 },
  { x0: 920, x1: 1210, y: 330 }, { x0: 920, x1: 1210, y: 510 }, { x0: 920, x1: 1210, y: 690 },
];

function picture(ctx: Ctx, x: number, y: number, w: number, h: number, paint: () => void): void {
  inked(ctx, (c) => roundRect(c, x - 14, y - 14, w + 28, h + 28, 6), WOOD[2], 5);
  fillPath(ctx, (c) => c.rect(x - 10, y - 10, w + 20, 5), WOOD[3]);
  clipped(ctx, (c) => c.rect(x, y, w, h), paint);
  strokePath(ctx, (c) => c.rect(x, y, w, h), INK, 4);
  // hanging string
  strokePath(ctx, (c) => { c.moveTo(x + w * 0.3, y - 14); c.lineTo(x + w / 2, y - 44); c.lineTo(x + w * 0.7, y - 14); }, rgba(INK, 0.7), 3);
  fillPath(ctx, (c) => circle(c, x + w / 2, y - 44, 4), WARM[3]);
}

function buildLodgeBg(): SheetSpec {
  return single(TEX2.lodgeBg, W, H, (ctx) => {
    const r = rng(7411);
    // log wall
    const logH = 72;
    const logC = mix(WOOD[1], VIOLET[1], 0.22);
    for (let y = -20, i = 0; y < 860; y += logH, i++) {
      const tone = mix(logC, i % 2 ? WOOD[2] : WOOD[0], 0.12);
      fillPath(ctx, (c) => c.rect(0, y, W, logH), tone);
      fillPath(ctx, (c) => c.rect(0, y + 8, W, 12), rgba(mix(WOOD[3], VIOLET[3], 0.2), 0.45));
      fillPath(ctx, (c) => c.rect(0, y + logH - 16, W, 16), rgba(INK, 0.28));
      // chinking
      fillPath(ctx, (c) => c.rect(0, y + logH - 4, W, 6), mix(GOAT[1], VIOLET[2], 0.35));
      // grain flecks
      for (let k = 0; k < 14; k++) {
        const x = r() * W;
        fillPath(ctx, (c) => ellipse(c, x, y + 30 + r() * 20, 20 + r() * 30, 2), rgba(INK, 0.18));
      }
    }
    softGlow(ctx, 640, 420, 640, WARM[3], 0.2);
    vignette(ctx, 0.5);
    // ceiling beam
    inked(ctx, (c) => c.rect(-10, -10, W + 20, 54), mix(WOOD[0], VIOLET[0], 0.2), 5);
    fillPath(ctx, (c) => c.rect(0, 34, W, 5), WOOD[1]);
    // picture frames along the top edges
    picture(ctx, 110, 120, 200, 130, () => {
      // little landscape: mountain with a lantern on top
      fillPath(ctx, (c) => c.rect(110, 120, 200, 130), SKY_DAY[1]);
      fillPath(ctx, (c) => poly(c, [110, 250, 210, 140, 310, 250]), VIOLET[2]);
      fillPath(ctx, (c) => poly(c, [180, 173, 210, 140, 240, 173, 222, 166, 210, 176, 196, 166]), CREAM);
      fillPath(ctx, (c) => circle(c, 210, 136, 6), WARM[3]);
      fillPath(ctx, (c) => c.rect(110, 230, 200, 20), SNOW[1]);
    });
    picture(ctx, 970, 120, 200, 130, () => {
      // night sky with an aurora
      fillPath(ctx, (c) => c.rect(970, 120, 200, 130), '#24215a');
      for (const [col, y] of [[PINE[3], 160], [ICE[2], 180]] as [string, number][]) {
        strokePath(ctx, (c) => { c.moveTo(960, y); c.bezierCurveTo(1020, y - 30, 1080, y + 30, 1180, y - 10); }, rgba(col, 0.75), 12);
      }
      for (let k = 0; k < 18; k++) fillPath(ctx, (c) => circle(c, 975 + r() * 190, 125 + r() * 70, 1.6), CREAM);
      fillPath(ctx, (c) => { c.moveTo(970, 250); c.lineTo(1030, 210); c.lineTo(1090, 236); c.lineTo(1170, 200); c.lineTo(1170, 250); c.closePath(); }, VIOLET[0]);
    });
    picture(ctx, 560, 86, 160, 60, () => {
      // a small banner-like frame of three snowflakes, the only thing above the calm centre
      fillPath(ctx, (c) => c.rect(560, 86, 160, 60), mix(ICE[1], VIOLET[1], 0.4));
      for (const x of [600, 640, 680]) fillPath(ctx, (c) => star4(c, x, 116, 14, 0.3), CREAM);
    });
    // empty shelves
    for (const s of LODGE_SHELVES) shelfBoard(ctx, s.x0, s.x1, s.y);
    // floor + rug
    const floor = (c: Ctx) => c.rect(-10, 850, W + 20, 130);
    inked(ctx, floor, mix(WOOD[1], VIOLET[0], 0.3), 6);
    clipped(ctx, floor, () => {
      for (let y = 856; y < H; y += 26) fillPath(ctx, (c) => c.rect(0, y, W, 3), rgba(INK, 0.3));
      for (let k = 0; k < 18; k++) fillPath(ctx, (c) => c.rect(r() * W, 856 + Math.floor(r() * 4) * 26, 3, 26), rgba(INK, 0.3));
    });
    // braided rug in calm, cool-leaning tones
    for (const [rx, ry, col] of [[360, 70, mix(mix(BERRY[0], VIOLET[1], 0.65), WOOD[0], 0.3)], [320, 58, mix(VIOLET[1], WOOD[1], 0.35)], [250, 42, mix(GOAT[1], VIOLET[2], 0.45)], [170, 28, mix(mix(BERRY[0], VIOLET[1], 0.6), WOOD[1], 0.25)]] as [number, number, string][]) {
      inked(ctx, (c) => ellipse(c, 640, 916, rx, ry), col, rx === 360 ? 5 : 0);
    }
  });
}

// ---------------------------------------------------------------- darkness overlay

function buildDarkness(): SheetSpec {
  return single(TEX2.darkness, W, H, (ctx) => {
    ctx.fillStyle = rgba('#0d0a22', 0.95);
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 300);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.62, 'rgba(0,0,0,1)');
    g.addColorStop(0.8, 'rgba(0,0,0,0.65)');
    g.addColorStop(0.92, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    // faint warm rim at the edge of the light
    ctx.strokeStyle = rgba(WARM[3], 0.06);
    ctx.lineWidth = 30;
    ctx.beginPath();
    circle(ctx, W / 2, H / 2, 255);
    ctx.stroke();
  });
}

export function buildPlaces(): { sheets: SheetSpec[] } {
  return { sheets: [...buildDoors(), buildStall(), buildShopBg(), buildLodgeBg(), buildDarkness()] };
}
