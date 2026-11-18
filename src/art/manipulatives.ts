// Math manipulatives: coins + bills, place-value gems, snowball, clock, ice plank, crate.
import { TEX } from './keys';
import { INK, INK2, VIOLET, SNOW, ICE, PINE, ROCK, WARM, WOOD, CREAM, FONT, mix, rgba } from './palette';
import {
  Ctx, SheetSpec, makeSheet, single, inked, fillPath, strokePath, clipped, ellipse, circle, roundRect, poly,
  star4, star5, groundShadow,
} from './draw';
import { GEM_RAMPS } from './items';

// ---------------------------------------------------------------- coins

const COPPER = ['#7a3f22', '#b8683a', '#e09a5e', '#f6c896'];
const SILVER = ['#5b5f86', '#9aa0c4', '#c9cde6', '#eef0fb'];

function text(ctx: Ctx, s: string, x: number, y: number, size: number, fill: string, stroke: string, sw: number): void {
  ctx.save();
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (sw > 0) {
    ctx.lineWidth = sw;
    ctx.strokeStyle = stroke;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function coin(ctx: Ctx, r: number, m: string[], label: string, motif: (ctx: Ctx, r: number) => void): void {
  const cx = 64;
  const cy = 64;
  // edge thickness (lower-right)
  inked(ctx, (c) => circle(c, cx + 2, cy + 4, r), m[0], 3);
  const face = (c: Ctx) => circle(c, cx, cy, r);
  inked(ctx, face, m[1], 3);
  clipped(ctx, face, () => {
    fillPath(ctx, (c) => circle(c, cx - 2, cy - 2, r - 2), m[2]);
  });
  // reeded rim ring
  strokePath(ctx, (c) => circle(c, cx, cy, r - 5), m[1], 2.5);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.translate(cx, cy);
  motif(ctx, r);
  ctx.restore();
  text(ctx, label, cx, cy + 2, Math.round(r * (label.length > 2 ? 0.72 : 0.9)), m[3], m[0], 6);
  // shine
  fillPath(ctx, (c) => ellipse(c, cx - r * 0.5, cy - r * 0.55, r * 0.22, r * 0.1, -0.7), rgba(CREAM, 0.85));
}

function bill(ctx: Ctx, label: string, paper: string, ink: string, accent: string): void {
  const x = 6;
  const y = 30;
  const w = 116;
  const h = 64;
  inked(ctx, (c) => roundRect(c, x + 2, y + 4, w, h, 6), mix(ink, INK, 0.3), 3);
  const p = (c: Ctx) => roundRect(c, x, y, w, h, 6);
  inked(ctx, p, paper, 3);
  clipped(ctx, p, () => {
    strokePath(ctx, (c) => roundRect(c, x + 6, y + 6, w - 12, h - 12, 4), ink, 2.5);
    // little mountain + lantern emblem in a centre oval
    fillPath(ctx, (c) => ellipse(c, 64, 62, 24, 20), mix(paper, CREAM, 0.5));
    strokePath(ctx, (c) => ellipse(c, 64, 62, 24, 20), ink, 2);
    // wave pattern bands
    ctx.strokeStyle = rgba(ink, 0.35);
    ctx.lineWidth = 1.5;
    for (const yy of [y + 14, y + h - 14]) {
      ctx.beginPath();
      for (let xx = x + 10; xx <= x + w - 10; xx += 2) ctx.lineTo(xx, yy + Math.sin(xx * 0.4) * 2);
      ctx.stroke();
    }
  });
  text(ctx, label, 64, 64, 30, CREAM, mix(ink, INK, 0.3), 6);
  for (const [cx, cy] of [[20, 44], [108, 80]]) text(ctx, label.replace('$', ''), cx, cy, 16, accent, mix(ink, INK, 0.3), 4);
}

function buildCoins(): SheetSpec {
  return makeSheet(TEX.coin, 128, 128, 6, (ctx, i) => {
    switch (i) {
      case 0:
        coin(ctx, 36, COPPER, '1¢', (c, r) => {
          // tiny pine tree motif
          fillPath(c, (cc) => poly(cc, [0, -r + 9, 9, -r + 22, -9, -r + 22]), COPPER[0]);
        });
        break;
      case 1:
        coin(ctx, 44, SILVER, '5¢', (c, r) => {
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3;
            strokePath(c, (cc) => { cc.moveTo(Math.cos(a) * (r - 14), Math.sin(a) * (r - 14)); cc.lineTo(Math.cos(a) * (r - 8), Math.sin(a) * (r - 8)); }, SILVER[0], 3);
          }
        });
        break;
      case 2:
        coin(ctx, 32, SILVER, '10¢', (c, r) => {
          fillPath(c, (cc) => star5(cc, 0, -r + 11, 5), SILVER[0]);
        });
        break;
      case 3:
        coin(ctx, 52, SILVER, '25¢', (c, r) => {
          // ring of dots + a little mountain
          for (let k = 0; k < 16; k++) {
            const a = (k * Math.PI) / 8;
            fillPath(c, (cc) => circle(cc, Math.cos(a) * (r - 10), Math.sin(a) * (r - 10), 1.8), SILVER[0]);
          }
        });
        break;
      case 4:
        bill(ctx, '$1', PINE[3], PINE[1], mix(PINE[3], CREAM, 0.6));
        break;
      default:
        bill(ctx, '$5', mix(ICE[2], VIOLET[3], 0.5), VIOLET[1], CREAM);
    }
  });
}

// ---------------------------------------------------------------- place-value gems

function cell(ctx: Ctx, x: number, y: number, s: number, ramp: string[]): void {
  // a square-cut gem cell: bevelled square with a bright table
  fillPath(ctx, (c) => c.rect(x, y, s, s), ramp[2]);
  const b = Math.max(2, s * 0.22);
  fillPath(ctx, (c) => poly(c, [x, y, x + s, y, x + s - b, y + b, x + b, y + b]), ramp[3]);
  fillPath(ctx, (c) => poly(c, [x, y, x + b, y + b, x + b, y + s - b, x, y + s]), mix(ramp[2], ramp[3], 0.5));
  fillPath(ctx, (c) => poly(c, [x + s, y, x + s, y + s, x + s - b, y + s - b, x + s - b, y + b]), ramp[1]);
  fillPath(ctx, (c) => poly(c, [x, y + s, x + s, y + s, x + s - b, y + s - b, x + b, y + s - b]), ramp[0]);
  fillPath(ctx, (c) => c.rect(x + b + 1, y + b + 1, Math.max(1, s * 0.2), Math.max(1, s * 0.12)), ramp[4]);
}

/** Place-value unit edge in px: identical in all four frames so 10 ones = 1 bar, 10 bars = 1 slab, 10 slabs = 1 block. */
export const PV_UNIT = 8;
/** Oblique depth step per unit (up and to the right). */
const PV_DEPTH = 0.45;

/**
 * An oblique place-value block nx wide, ny tall, nz deep (in units), centred in a 128 frame.
 * Every face is subdivided into unit cells; `groupZ` draws a bolder line every n units of
 * depth (used to show the ten slabs inside the thousands block).
 */
function pvBlock(ctx: Ctx, nx: number, ny: number, nz: number, ramp: string[], groupZ = 0): void {
  const u = PV_UNIT;
  const d = u * PV_DEPTH;
  const w = nx * u + nz * d;
  const h = ny * u + nz * d;
  const x0 = Math.round(64 - w / 2);
  const y0 = Math.round(64 - h / 2 + nz * d); // front face top-left
  const X = nx * u;
  const Y = ny * u;
  const Z = nz * d;
  const front = (c: Ctx) => c.rect(x0, y0, X, Y);
  const top = (c: Ctx) => poly(c, [x0, y0, x0 + Z, y0 - Z, x0 + Z + X, y0 - Z, x0 + X, y0]);
  const side = (c: Ctx) => poly(c, [x0 + X, y0, x0 + X + Z, y0 - Z, x0 + X + Z, y0 - Z + Y, x0 + X, y0 + Y]);
  groundShadow(ctx, 64 + Z / 2, y0 + Y + 2, w / 2 + 6, 5);
  inked(ctx, (c) => { front(c); top(c); side(c); }, ramp[0], 3);
  // front face: one bevelled gem cell per unit
  for (let r = 0; r < ny; r++) for (let k = 0; k < nx; k++) cell(ctx, x0 + k * u, y0 + r * u, u, ramp);
  fillPath(ctx, top, ramp[3]);
  fillPath(ctx, side, ramp[1]);
  // unit grid on top and side faces
  ctx.strokeStyle = rgba(INK, 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k <= nx; k++) { ctx.moveTo(x0 + k * u, y0); ctx.lineTo(x0 + k * u + Z, y0 - Z); }
  for (let k = 0; k <= nz; k++) {
    ctx.moveTo(x0 + k * d, y0 - k * d); ctx.lineTo(x0 + k * d + X, y0 - k * d);
    ctx.moveTo(x0 + X + k * d, y0 - k * d); ctx.lineTo(x0 + X + k * d, y0 - k * d + Y);
  }
  for (let k = 0; k <= ny; k++) { ctx.moveTo(x0 + X, y0 + k * u); ctx.lineTo(x0 + X + Z, y0 + k * u - Z); }
  ctx.stroke();
  // little glints on the top face cells
  ctx.fillStyle = rgba(ramp[4], 0.8);
  for (let k = 0; k < nx; k++) ctx.fillRect(x0 + k * u + d * 0.6 + 1.5, y0 - d * 0.6 - 0.5, 2, 1);
  if (groupZ > 0) {
    // slab boundaries: bold lines every groupZ units of depth
    ctx.strokeStyle = rgba(INK, 0.85);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let k = groupZ; k < nz; k += groupZ) {
      ctx.moveTo(x0 + k * d, y0 - k * d); ctx.lineTo(x0 + k * d + X, y0 - k * d);
      ctx.moveTo(x0 + X + k * d, y0 - k * d); ctx.lineTo(x0 + X + k * d, y0 - k * d + Y);
    }
    ctx.stroke();
  }
  // crisp silhouette + inner edges
  strokePath(ctx, (c) => { front(c); top(c); side(c); }, INK, 2);
}

function buildPV(): SheetSpec {
  const ramp = GEM_RAMPS[3];
  return makeSheet(TEX.pvGem, 128, 128, 4, (ctx, i) => {
    if (i === 0) {
      // ones: a single unit cube, with a sparkle so the tiny gem still catches the eye
      pvBlock(ctx, 1, 1, 1, ramp);
      inked(ctx, (c) => star4(c, 74, 52, 6, 0.3), CREAM, 1.5, INK2);
    } else if (i === 1) {
      // tens bar: a column of 10 units
      pvBlock(ctx, 1, 10, 1, ramp);
    } else if (i === 2) {
      // hundreds slab: 10 x 10 units, one unit thick
      pvBlock(ctx, 10, 10, 1, ramp);
    } else {
      // thousands block: ten hundreds slabs stacked front to back
      pvBlock(ctx, 10, 10, 10, ramp, 1);
    }
  });
}

// ---------------------------------------------------------------- snowball

function buildSnowball(): SheetSpec {
  return single(TEX.snowball, 64, 64, (ctx) => {
    const b = (c: Ctx) => circle(c, 32, 31, 24);
    inked(ctx, b, VIOLET[3], 3);
    clipped(ctx, b, () => {
      fillPath(ctx, (c) => circle(c, 28, 27, 23), SNOW[1]);
      fillPath(ctx, (c) => circle(c, 25, 23, 13), SNOW[2]);
      fillPath(ctx, (c) => { circle(c, 40, 44, 3); circle(c, 46, 34, 2); circle(c, 33, 48, 2); }, SNOW[0]);
    });
    fillPath(ctx, (c) => ellipse(c, 21, 19, 5, 3, -0.6), CREAM);
  });
}

// ---------------------------------------------------------------- clock

function buildClock(): SheetSpec[] {
  const face = single(TEX.clockFace, 520, 520, (ctx) => {
    const cx = 260;
    const cy = 264;
    // wooden rim
    inked(ctx, (c) => circle(c, cx, cy, 236), WOOD[0], 6);
    fillPath(ctx, (c) => circle(c, cx - 4, cy - 4, 230), WOOD[1]);
    strokePath(ctx, (c) => c.arc(cx, cy, 220, Math.PI * 0.8, Math.PI * 1.55), WOOD[3], 8);
    // little rivets
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + Math.PI / 12;
      fillPath(ctx, (c) => circle(c, cx + Math.cos(a) * 218, cy + Math.sin(a) * 218, 4.5), WOOD[0]);
      fillPath(ctx, (c) => circle(c, cx + Math.cos(a) * 218 - 1.2, cy + Math.sin(a) * 218 - 1.2, 1.8), WOOD[3]);
    }
    // face
    inked(ctx, (c) => circle(c, cx, cy, 196), SNOW[0], 5);
    fillPath(ctx, (c) => circle(c, cx - 3, cy - 3, 192), SNOW[2]);
    // minute ticks, bold every 5
    for (let m = 0; m < 60; m++) {
      const a = (m / 60) * Math.PI * 2 - Math.PI / 2;
      const bold = m % 5 === 0;
      const r0 = bold ? 166 : 176;
      strokePath(ctx, (c) => {
        c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        c.lineTo(cx + Math.cos(a) * 186, cy + Math.sin(a) * 186);
      }, bold ? INK : INK2, bold ? 7 : 3);
    }
    // numbers
    for (let n = 1; n <= 12; n++) {
      const a = (n / 12) * Math.PI * 2 - Math.PI / 2;
      text(ctx, String(n), cx + Math.cos(a) * 136, cy + Math.sin(a) * 136 + 3, n >= 10 ? 46 : 52, INK, INK, 0);
    }
    // centre pin plate (hands go on top)
    inked(ctx, (c) => circle(c, cx, cy, 14), WOOD[2], 4);
    // snow cap on top of the rim
    inked(ctx, (c) => {
      c.moveTo(150, 52);
      c.quadraticCurveTo(260, 4, 370, 52);
      c.quadraticCurveTo(352, 66, 336, 56);
      c.quadraticCurveTo(318, 76, 300, 54);
      c.quadraticCurveTo(260, 66, 220, 52);
      c.quadraticCurveTo(196, 72, 180, 56);
      c.quadraticCurveTo(164, 64, 150, 52);
      c.closePath();
    }, SNOW[1], 4);
    fillPath(ctx, (c) => ellipse(c, 240, 34, 50, 6, -0.05), SNOW[2]);
  });
  const hand = (key: string, w: number, h: number, pivot: number, len: number, width: number, col: string) =>
    single(key, w, h, (ctx) => {
      const cx = w / 2;
      const py = h * pivot;
      const p = (c: Ctx) => {
        c.moveTo(cx - width / 2, py + 10);
        c.lineTo(cx - width / 2, py - len + width);
        c.quadraticCurveTo(cx, py - len - 6, cx + width / 2, py - len + width);
        c.lineTo(cx + width / 2, py + 10);
        c.closePath();
      };
      inked(ctx, p, col, 3);
      fillPath(ctx, (c) => c.rect(cx - width / 2 + 2, py - len + width, 3, len - width), rgba(CREAM, 0.45));
      inked(ctx, (c) => circle(c, cx, py, width * 0.7), col, 3);
      fillPath(ctx, (c) => circle(c, cx, py, 3), WARM[3]);
    });
  return [
    face,
    // hour: 40x170, pivot origin (0.5, 0.9) -> y 153
    hand(TEX.clockHandHour, 40, 170, 0.9, 132, 18, WARM[0]),
    // minute: 28x230, pivot origin (0.5, 0.93) -> y 213.9
    hand(TEX.clockHandMinute, 28, 230, 0.93, 198, 12, INK2),
  ];
}

// ---------------------------------------------------------------- ice plank

function buildPlank(): SheetSpec {
  return makeSheet(TEX.plank, 220, 90, 2, (ctx, i) => {
    const placed = i === 1;
    const body = (c: Ctx) => roundRect(c, 8, 12, 204, 66, 14);
    inked(ctx, body, placed ? ICE[1] : ICE[0], 4);
    clipped(ctx, body, () => {
      fillPath(ctx, (c) => roundRect(c, 4, 8, 204, 62, 14), placed ? ICE[2] : ICE[1]);
      fillPath(ctx, (c) => roundRect(c, 20, 16, 180, 8, 4), rgba(ICE[3], 0.8));
      ctx.strokeStyle = rgba(ICE[3], 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath();
      poly(ctx, [30, 64, 44, 52, 40, 40], false);
      poly(ctx, [180, 66, 190, 50], false);
      ctx.stroke();
    });
    if (placed) {
      // dusted with snow and sparkling: it is part of the bridge now
      inked(ctx, (c) => {
        c.moveTo(14, 20);
        c.quadraticCurveTo(14, 8, 30, 8);
        c.lineTo(190, 8);
        c.quadraticCurveTo(206, 8, 206, 20);
        c.quadraticCurveTo(180, 26, 150, 20);
        c.quadraticCurveTo(110, 28, 70, 20);
        c.quadraticCurveTo(40, 26, 14, 20);
        c.closePath();
      }, SNOW[2], 3);
      inked(ctx, (c) => star4(c, 196, 68, 9, 0.3), CREAM, 1.5, INK2);
      inked(ctx, (c) => star4(c, 22, 66, 6, 0.3), CREAM, 1.5, INK2);
    }
  });
}

// ---------------------------------------------------------------- crate

function buildCrate(): SheetSpec {
  return single(TEX.crate, 300, 220, (ctx) => {
    groundShadow(ctx, 152, 210, 142, 9);
    // Open-topped crate seen from slightly above: the opening is a parallelogram whose
    // back edge sits higher and to the right (same oblique as the right side panel).
    const FL = 24; // front face left
    const FR = 242; // front face right
    const FT = 62; // front face top (rim)
    const FB = 206; // front face bottom
    const DX = 30; // depth offset (right)
    const DY = 48; // depth offset (up)
    const interiorD = mix(mix(WOOD[0], VIOLET[0], 0.5), INK, 0.35);
    // whole silhouette first, for one clean outer outline
    const outer = (c: Ctx) => poly(c, [FL, FT, FL + DX, FT - DY, FR + DX, FT - DY, FR + DX, FB - DY, FR, FB, FL, FB]);
    inked(ctx, outer, interiorD, 4);
    // interior: back wall inner face (dim plank wall) and left inner wall (darker)
    const opening = (c: Ctx) => poly(c, [FL, FT, FL + DX, FT - DY, FR + DX, FT - DY, FR, FT]);
    clipped(ctx, opening, () => {
      fillPath(ctx, opening, interiorD);
      // inner back wall: dim planks lit only near the rim, falling into shadow lower down
      const back = mix(mix(WOOD[1], VIOLET[0], 0.4), INK, 0.1);
      fillPath(ctx, (c) => c.rect(FL + DX, FT - DY, FR - FL, 20), back);
      fillPath(ctx, (c) => c.rect(FL + DX, FT - DY + 20, FR - FL, 14), mix(back, interiorD, 0.5));
      fillPath(ctx, (c) => c.rect(FL + DX, FT - DY + 2, FR - FL, 3), mix(back, WOOD[2], 0.4));
      // back wall plank seams
      ctx.strokeStyle = rgba(INK, 0.45);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const y of [FT - DY + 12, FT - DY + 26]) { ctx.moveTo(FL + DX, y); ctx.lineTo(FR + DX, y); }
      ctx.stroke();
      // left inner wall, deeper shadow
      fillPath(ctx, (c) => poly(c, [FL, FT, FL + DX, FT - DY, FL + DX, FT + 40, FL, FT + 40]), mix(interiorD, INK, 0.3));
      strokePath(ctx, (c) => {
        for (const o of [12, 26]) { c.moveTo(FL, FT + o); c.lineTo(FL + DX, FT - DY + o); }
      }, rgba(INK, 0.4), 2);
    });
    // rim: thick top edges of the four walls (back and left rims are thinner, seen edge-on)
    const rimL = WOOD[3];
    strokePath(ctx, (c) => { c.moveTo(FL + DX, FT - DY); c.lineTo(FR + DX, FT - DY); }, INK, 9);
    strokePath(ctx, (c) => { c.moveTo(FL + DX, FT - DY); c.lineTo(FR + DX, FT - DY); }, WOOD[2], 4);
    strokePath(ctx, (c) => { c.moveTo(FL, FT); c.lineTo(FL + DX, FT - DY); }, INK, 9);
    strokePath(ctx, (c) => { c.moveTo(FL, FT); c.lineTo(FL + DX, FT - DY); }, WOOD[2], 4);
    // right side panel (outside, shaded) with its slats
    const side = (c: Ctx) => poly(c, [FR, FT, FR + DX, FT - DY, FR + DX, FB - DY, FR, FB]);
    inked(ctx, side, mix(WOOD[1], VIOLET[0], 0.3), 4);
    clipped(ctx, side, () => {
      for (const y of [FT, FT + 48, FT + 96]) {
        fillPath(ctx, (c) => poly(c, [FR, y + 40, FR + DX, y + 40 - DY, FR + DX, y + 48 - DY, FR, y + 48]), interiorD);
        fillPath(ctx, (c) => poly(c, [FR, y + 2, FR + DX, y + 2 - DY, FR + DX, y + 5 - DY, FR, y + 5]), mix(WOOD[2], VIOLET[1], 0.25));
      }
    });
    strokePath(ctx, side, INK, 4);
    // front: three horizontal slats with dark gaps between them, corner posts
    const front = (c: Ctx) => roundRect(c, FL, FT, FR - FL, FB - FT, 6);
    inked(ctx, front, interiorD, 4);
    clipped(ctx, front, () => {
      const slatH = 40;
      for (let k = 0; k < 3; k++) {
        const y = FT + 4 + k * 48;
        fillPath(ctx, (c) => roundRect(c, FL - 4, y, FR - FL + 8, slatH, 4), WOOD[2]);
        fillPath(ctx, (c) => c.rect(FL, y + 2, FR - FL, 4), rimL);
        fillPath(ctx, (c) => c.rect(FL, y + slatH - 7, FR - FL, 7), WOOD[1]);
        // wood grain
        ctx.strokeStyle = rgba(WOOD[0], 0.35);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(70 + k * 30, y + 16);
        ctx.quadraticCurveTo(110 + k * 30, y + 12, 150 + k * 30, y + 18);
        ctx.moveTo(120 - k * 20, y + 26);
        ctx.quadraticCurveTo(150 - k * 20, y + 22, 190 - k * 20, y + 27);
        ctx.stroke();
      }
      // top rim board of the front wall
      fillPath(ctx, (c) => c.rect(FL, FT, FR - FL, 7), rimL);
      // corner posts
      fillPath(ctx, (c) => { c.rect(FL, FT, 22, FB - FT); c.rect(FR - 22, FT, 22, FB - FT); }, WOOD[1]);
      fillPath(ctx, (c) => { c.rect(FL + 3, FT, 5, FB - FT); c.rect(FR - 19, FT, 5, FB - FT); }, WOOD[2]);
      fillPath(ctx, (c) => { c.rect(FL + 18, FT, 4, FB - FT); c.rect(FR - 4, FT, 4, FB - FT); }, mix(WOOD[0], VIOLET[0], 0.2));
    });
    strokePath(ctx, front, INK, 4);
    // nails on the posts, one per slat end
    for (let k = 0; k < 3; k++) {
      for (const x of [FL + 11, FR - 11]) fillPath(ctx, (c) => circle(c, x, FT + 24 + k * 48, 3), WOOD[0]);
    }
    // a small snow cap on the front-left rim
    inked(ctx, (c) => {
      c.moveTo(FL - 2, FT + 4);
      c.quadraticCurveTo(FL, FT - 8, FL + 16, FT - 6);
      c.lineTo(FL + 56, FT - 4);
      c.quadraticCurveTo(FL + 46, FT + 6, FL + 28, FT + 4);
      c.quadraticCurveTo(FL + 16, FT + 12, FL - 2, FT + 4);
      c.closePath();
    }, SNOW[1], 3);
    void ROCK;
  });
}

export function buildManipulatives(): { sheets: SheetSpec[] } {
  return { sheets: [buildCoins(), buildPV(), buildSnowball(), ...buildClock(), buildPlank(), buildCrate()] };
}
