// Juniper the mountain goat - a parametric rig drawn with Canvas 2D.
// Facing right, feet at the bottom-centre of a 200x200 frame.
import { JUNIPER_FRAME, SCARF_COLOURS, TEX, ANIM, juniperKey, juniperAnim } from './keys';
import { GOAT, INK, INK2, PINK, CREAM, ROCK, VIOLET, WARM, BERRY, mix, hex, rgba } from './palette';
import {
  Ctx, AnimSpec, SheetSpec, makeSheet, inked, fillPath, strokePath, clipped, ellipse, circle,
  groundShadow, poly, lerp, TAU,
} from './draw';

/** Foot offset from its hip's rest spot; `bend` scales the knee/hock bend (default 1). */
export interface Foot { dx: number; lift: number; bend?: number }

export interface JuniperPose {
  /** Body/head bob in px (+ = down); planted feet stay planted. */
  bob: number;
  /** Whole-figure lift in px (cheer hop inside the frame); the shadow stays on the ground. */
  lift: number;
  /** Squash/stretch about the feet. */
  sx: number;
  sy: number;
  /** Rotation of body+head+front legs about the back hips (radians, - = nose up). */
  tilt: number;
  /** Feet relative to their hips: [backFar, frontFar, backNear, frontNear]. */
  feet: [Foot, Foot, Foot, Foot];
  headTilt: number;
  /** Ear rotation (+ = droop, - = perk up). */
  ear: number;
  scarfWave: number;
  /** 0 = scarf hangs, 1 = streams straight back, -1 = blows upward (falling). */
  scarfLift: number;
  eyes: 'open' | 'blink' | 'happy';
  mouth: 'smile' | 'open' | 'grin' | 'o';
  /** Ground-shadow scale (0 = none, e.g. in the air). */
  shadow: number;
}

const W = JUNIPER_FRAME.w;
const H = JUNIPER_FRAME.h;
/** Bottom of the hoof outline. */
const GY = H - 5;
/** Foot (capsule end) y when planted. */
const FOOT_Y = GY - 12;
const HIP_Y = 150;
const LEG_W = 14;
const LW = 5; // hero outline

const HIPS = { backFar: 80, frontFar: 120, backNear: 68, frontNear: 108 };
const TILT_PIVOT: [number, number] = [70, HIP_Y];

const COL = {
  body: GOAT[1],
  light: GOAT[2],
  shadow: mix(mix(GOAT[0], VIOLET[2], 0.35), GOAT[1], 0.25),
  far: mix(mix(GOAT[0], VIOLET[2], 0.45), VIOLET[1], 0.12),
  farShade: mix(mix(GOAT[0], VIOLET[1], 0.55), INK, 0.12),
  hoofFar: mix(ROCK[0], INK, 0.35),
  hoof: ROCK[0],
  hoofLight: ROCK[1],
  horn: mix(GOAT[0], ROCK[2], 0.45),
  hornLight: mix(GOAT[1], ROCK[2], 0.25),
  hornDark: mix(GOAT[0], ROCK[1], 0.55),
  eye: INK2,
  pink: PINK,
};

export function basePose(): JuniperPose {
  return {
    bob: 0, lift: 0, sx: 1, sy: 1, tilt: 0,
    feet: [{ dx: 0, lift: 0 }, { dx: 0, lift: 0 }, { dx: 0, lift: 0 }, { dx: 0, lift: 0 }],
    headTilt: 0, ear: 0, scarfWave: 0, scarfLift: 0, eyes: 'open', mouth: 'smile', shadow: 1,
  };
}

function pose(p: Partial<JuniperPose>): JuniperPose {
  return { ...basePose(), ...p };
}

// ---------- parts ----------

/**
 * Two-segment leg with a soft joint. Front legs bend their knee forward, hind legs
 * bend their hock backward (goat anatomy, simplified). The joint is solved with
 * two-bone IK, so a shorter hip-to-foot distance (crouch, tuck) bends the leg more.
 */
function drawLeg(ctx: Ctx, hx: number, hy: number, f: Foot, col: string, hoof: string, front: boolean, shade: string): void {
  const fx = hx + f.dx;
  const fy = FOOT_Y - f.lift;
  const dx = fx - hx;
  const dy = fy - hy;
  const d = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / d;
  const uy = dy / d;
  // segment lengths: rest leg (hip to planted foot) is slightly bent
  const rest = FOOT_Y - HIP_Y;
  const a = rest * 0.56;
  const b = rest * 0.56;
  const dd = Math.min(d, a + b - 0.5);
  // distance from hip along the hip->foot line to the joint's foot point, then sideways offset
  const along = (a * a - b * b + dd * dd) / (2 * dd);
  const side = Math.sqrt(Math.max(0, a * a - along * along)) * (f.bend ?? 1);
  // perpendicular pointing forward (+x) for front knees, backward for hind hocks
  let px = -uy;
  let py = ux;
  if ((px > 0) !== front) {
    px = -px;
    py = -py;
  }
  const kx = hx + ux * along + px * side;
  const ky = hy + uy * along + py * side;
  // lower-leg direction (knee -> foot) for the hoof
  const lx = fx - kx;
  const ly = fy - ky;
  const ld = Math.max(1, Math.hypot(lx, ly));
  // a planted hoof sits flat; a lifted one follows the lower leg
  const planted = f.lift < 1.5;
  const hang = planted ? 0 : Math.atan2(lx / ld, ly / ld) * -1;
  const legPath = (c: Ctx) => {
    c.moveTo(hx, hy);
    c.quadraticCurveTo(kx, ky, (kx + fx) / 2, (ky + fy) / 2);
    c.lineTo(fx, fy);
  };
  // thigh mass near the hip so the leg tapers toward the hoof
  strokePath(ctx, legPath, INK, LEG_W + LW * 2);
  strokePath(ctx, (c) => {
    c.moveTo(hx, hy);
    c.lineTo(lerp(hx, kx, 0.45), lerp(hy, ky, 0.45));
  }, INK, LEG_W + 3 + LW * 2);
  strokePath(ctx, legPath, col, LEG_W);
  strokePath(ctx, (c) => {
    c.moveTo(hx, hy);
    c.lineTo(lerp(hx, kx, 0.45), lerp(hy, ky, 0.45));
  }, col, LEG_W + 3);
  // shade the back edge of the lower leg (light from the upper left)
  ctx.save();
  ctx.translate(3, 1);
  strokePath(ctx, (c) => {
    c.moveTo(lerp(kx, fx, 0.15), lerp(ky, fy, 0.15));
    c.lineTo(lerp(kx, fx, 0.75), lerp(ky, fy, 0.75));
  }, shade, 3);
  ctx.restore();

  // hoof: a short wedge, wider at the sole, with a cleft at the toe
  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(hang);
  const hw = LEG_W / 2 + 1.5;
  const hoofPath = (c: Ctx) => {
    c.moveTo(-hw + 1, -2.5);
    c.lineTo(hw - 1, -2.5);
    c.quadraticCurveTo(hw + 3, 3.5, hw + 3.5, 8.5);
    c.lineTo(-hw - 0.5, 8.5);
    c.quadraticCurveTo(-hw - 1, 2.5, -hw + 1, -2.5);
    c.closePath();
  };
  inked(ctx, hoofPath, hoof, 3.5);
  // sheen on the hoof wall and the cleft line
  strokePath(ctx, (c) => {
    c.moveTo(-hw + 2.5, 0);
    c.lineTo(-hw + 2, 5.5);
  }, mix(hoof, CREAM, 0.35), 2);
  strokePath(ctx, (c) => {
    c.moveTo(hw * 0.45, 8.5);
    c.lineTo(hw * 0.25, 3);
  }, INK, 2);
  ctx.restore();
}

function scarfTail(ctx: Ctx, p: JuniperPose, x0: number, y0: number, len: number, phase: number, base: string, dark: string, light: string): void {
  const n = 6;
  const pts: [number, number][] = [];
  const lift = p.scarfLift;
  const seg = len / n;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    // direction: hanging (down-back) blended toward streaming (straight back) or blowing up
    const ang = lift >= 0 ? lerp(0.95, -0.1, lift) : lerp(-0.1, -0.8, -lift);
    const wave = Math.sin(p.scarfWave + phase - k * 1.05) * (4 + 7 * Math.abs(lift)) * t;
    const bx = x0 - Math.cos(ang) * seg * k;
    const by = y0 + Math.sin(ang) * seg * k;
    // wave perpendicular to the direction
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
    const w = lerp(6.5, 5.5, k / n);
    left.push(x + nx * w, y + ny * w);
    right.push(x - nx * w, y - ny * w);
  }
  // fringe at the end
  const [ex, ey] = pts[n];
  const [px, py] = pts[n - 1];
  const fx = (ex - px) / seg;
  const fy = (ey - py) / seg;
  const outline: number[] = [...left];
  const lx = left[left.length - 2];
  const ly = left[left.length - 1];
  const rx = right[right.length - 2];
  const ry = right[right.length - 1];
  for (let j = 0; j <= 3; j++) {
    const t = j / 3;
    const mx = lerp(lx, rx, t);
    const my = lerp(ly, ry, t);
    outline.push(mx + fx * 5, my + fy * 5);
    if (j < 3) {
      const t2 = (j + 0.5) / 3;
      outline.push(lerp(lx, rx, t2), lerp(ly, ry, t2));
    }
  }
  for (let k = right.length / 2 - 1; k >= 0; k--) outline.push(right[k * 2], right[k * 2 + 1]);
  const path = (c: Ctx) => poly(c, outline);
  inked(ctx, path, base, 4);
  clipped(ctx, path, () => {
    // shaded underside strip
    ctx.beginPath();
    poly(ctx, [...right, ...pts.slice().reverse().flatMap(([x, y]) => [x, y])]);
    ctx.fillStyle = dark;
    ctx.fill();
    // knitted stripe near the end
    const [sx, sy] = pts[n - 1];
    ctx.beginPath();
    circle(ctx, sx, sy, 5.5);
    ctx.fillStyle = light;
    ctx.fill();
  });
}

function earPath(c: Ctx, len: number, w: number): void {
  c.moveTo(0, -w * 0.55);
  c.quadraticCurveTo(len * 0.6, -w * 0.95, len, 0);
  c.quadraticCurveTo(len * 0.6, w * 0.95, 0, w * 0.55);
  c.closePath();
}

function drawEar(ctx: Ctx, x: number, y: number, ang: number, len: number, w: number, outer: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  inked(ctx, (c) => earPath(c, len, w), outer, LW - 1);
  ctx.save();
  ctx.translate(len * 0.2, 0);
  ctx.scale(0.62, 0.5);
  fillPath(ctx, (c) => earPath(c, len, w), COL.pink);
  ctx.restore();
  ctx.restore();
}

function hornPath(c: Ctx, bx: number, by: number, s: number): void {
  c.moveTo(bx - 6 * s, by + 5);
  c.quadraticCurveTo(bx - 6 * s, by - 12 * s, bx - 16 * s, by - 18 * s);
  c.quadraticCurveTo(bx - 9 * s, by - 20 * s, bx - 3 * s, by - 13 * s);
  c.quadraticCurveTo(bx + 4 * s, by - 6 * s, bx + 5 * s, by + 5);
  c.closePath();
}

function drawHorn(ctx: Ctx, bx: number, by: number, s: number, far: boolean): void {
  const path = (c: Ctx) => hornPath(c, bx, by, s);
  inked(ctx, path, far ? COL.hornDark : COL.horn, 4);
  clipped(ctx, path, () => {
    ctx.save();
    ctx.translate(-3, -2);
    ctx.globalAlpha = far ? 0.4 : 1;
    ctx.beginPath();
    ctx.moveTo(bx - 4 * s, by + 4);
    ctx.quadraticCurveTo(bx - 5 * s, by - 10 * s, bx - 13 * s, by - 17 * s);
    ctx.lineWidth = 3;
    ctx.strokeStyle = COL.hornLight;
    ctx.stroke();
    ctx.restore();
    // ridges
    for (let k = 0; k < 2; k++) {
      const yy = by - 3 - k * 6 * s;
      ctx.beginPath();
      ctx.moveTo(bx - 8 * s - k * 2, yy);
      ctx.lineTo(bx + 6 * s - k * 3, yy - 2);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = COL.hornDark;
      ctx.stroke();
    }
  });
}

function drawEye(ctx: Ctx, x: number, y: number, rx: number, ry: number, mode: JuniperPose['eyes']): void {
  if (mode === 'open') {
    fillPath(ctx, (c) => ellipse(c, x, y, rx, ry), COL.eye);
    fillPath(ctx, (c) => circle(c, x - rx * 0.32, y - ry * 0.38, rx * 0.42), CREAM);
    fillPath(ctx, (c) => circle(c, x + rx * 0.35, y + ry * 0.38, rx * 0.2), CREAM);
  } else if (mode === 'blink') {
    strokePath(ctx, (c) => {
      c.moveTo(x - rx * 1.05, y + 1);
      c.quadraticCurveTo(x, y + ry * 0.6, x + rx * 1.05, y + 1);
    }, INK, 3);
  } else {
    strokePath(ctx, (c) => {
      c.moveTo(x - rx * 1.05, y + 2);
      c.quadraticCurveTo(x, y - ry * 0.95, x + rx * 1.05, y + 2);
    }, INK, 3.4);
  }
}

function drawHead(ctx: Ctx, p: JuniperPose): void {
  const hx = 140;
  const hy = 92;
  // far ear: drawn BEHIND the skull, only its tip peeks out at the upper back
  drawEar(ctx, hx - 8, hy - 20, Math.PI + 0.4 - p.ear * 0.8, 28, 12, COL.shadow);
  // horns
  drawHorn(ctx, hx + 9, hy - 27, 0.85, true);
  drawHorn(ctx, hx - 8, hy - 27, 1, false);

  drawBeard(ctx, hx, hy);
  const head = (c: Ctx) => {
    circle(c, hx, hy, 30);
    ellipse(c, hx + 18, hy + 19, 18, 13, -0.15);
    ellipse(c, hx - 4, hy + 14, 24, 17); // fuller cheeks
  };
  inked(ctx, head, COL.shadow, LW);
  clipped(ctx, head, () => {
    ctx.save();
    ctx.translate(-4, -5);
    fillPath(ctx, head, COL.body);
    ctx.restore();
    // forehead highlight
    fillPath(ctx, (c) => ellipse(c, hx - 12, hy - 18, 10, 5.5, -0.5), COL.light);
  });
  // muzzle patch
  const muzzle = (c: Ctx) => ellipse(c, hx + 19, hy + 18, 15, 10.5, -0.15);
  fillPath(ctx, muzzle, COL.light);
  // nose
  fillPath(ctx, (c) => ellipse(c, hx + 27, hy + 12, 5, 3.6, -0.2), INK2);
  fillPath(ctx, (c) => circle(c, hx + 25.5, hy + 11, 1.3), mix(INK2, CREAM, 0.5));
  // mouth
  const mx = hx + 20;
  const my = hy + 24;
  if (p.mouth === 'smile') {
    strokePath(ctx, (c) => {
      c.moveTo(mx - 6, my - 2);
      c.quadraticCurveTo(mx, my + 4, mx + 7, my - 3);
    }, INK, 2.6);
  } else if (p.mouth === 'grin' || p.mouth === 'open') {
    const big = p.mouth === 'open' ? 1.25 : 1;
    const m = (c: Ctx) => {
      c.moveTo(mx - 7 * big, my - 3);
      c.quadraticCurveTo(mx, my - 1, mx + 7 * big, my - 4);
      c.quadraticCurveTo(mx + 2, my + 9 * big, mx - 7 * big, my - 3);
      c.closePath();
    };
    inked(ctx, m, mix(BERRY[0], INK, 0.3), 1.3);
    clipped(ctx, m, () => fillPath(ctx, (c) => ellipse(c, mx, my + 5 * big, 5, 3.5), BERRY[2]));
  } else {
    inked(ctx, (c) => ellipse(c, mx, my, 3.4, 4), mix(BERRY[0], INK, 0.3), 1.3);
  }
  // blush
  fillPath(ctx, (c) => ellipse(c, hx - 9, hy + 12, 6.5, 3.6), rgba(PINK, 0.65));
  // eyes (3/4 view: near eye bigger)
  drawEye(ctx, hx - 5, hy - 2, 6.6, 8.8, p.eyes);
  drawEye(ctx, hx + 17, hy - 3, 5.4, 8.0, p.eyes);
  // tiny brows for expression
  strokePath(ctx, (c) => {
    c.moveTo(hx - 11, hy - 15);
    c.quadraticCurveTo(hx - 5, hy - 18, hx + 0, hy - 16);
  }, mix(GOAT[0], INK, 0.3), 2.2);
  // near ear: attached at the upper-back side of the skull (below/behind the horns),
  // angled back and slightly down so it never covers the eyes, muzzle or forehead
  drawEar(ctx, hx - 21, hy - 13, Math.PI - 0.42 - p.ear, 26, 13, COL.body);
  // little forelock curl between the horns
  strokePath(ctx, (c) => {
    c.moveTo(hx - 7, hy - 25);
    c.quadraticCurveTo(hx - 1, hy - 34, hx + 4, hy - 26);
  }, INK, 7);
  strokePath(ctx, (c) => {
    c.moveTo(hx - 7, hy - 25);
    c.quadraticCurveTo(hx - 1, hy - 34, hx + 4, hy - 26);
  }, COL.light, 3);
}

/** Goatee: a pointed tuft hanging from under the jaw, drawn BEHIND the head so it never touches the mouth. */
function drawBeard(ctx: Ctx, hx: number, hy: number): void {
  const bx = hx + 9;
  const by = hy + 27;
  const beard = (c: Ctx) => {
    c.moveTo(bx - 9, by);
    c.quadraticCurveTo(bx - 8, by + 12, bx - 3, by + 21);
    c.quadraticCurveTo(bx - 1, by + 17, bx + 1, by + 23);
    c.quadraticCurveTo(bx + 4, by + 15, bx + 7, by + 12);
    c.quadraticCurveTo(bx + 10, by + 5, bx + 9, by);
    c.closePath();
  };
  inked(ctx, beard, COL.light, 3.5);
  clipped(ctx, beard, () => {
    strokePath(ctx, (c) => {
      c.moveTo(bx + 6, by + 4);
      c.quadraticCurveTo(bx + 5, by + 12, bx + 1, by + 19);
    }, COL.shadow, 3);
  });
}

/** Draw Juniper with pose `p` and scarf colour (hex string) into a 200x200 cell. */
export function drawJuniper(ctx: Ctx, p: JuniperPose, scarf: string): void {
  const sDark = mix(mix(scarf, INK, 0.3), VIOLET[0], 0.15);
  const sLight = mix(scarf, WARM[4], 0.5);

  // ground shadow (does not lift)
  if (p.shadow > 0) {
    const s = p.shadow * p.sx;
    groundShadow(ctx, W / 2 - 4, GY - 1, 50 * s, 7 * Math.min(1, s));
  }

  ctx.save();
  // squash/stretch about the feet, then lift
  ctx.translate(W / 2, GY);
  ctx.scale(p.sx, p.sy);
  ctx.translate(-W / 2, -GY - p.lift);

  const hipY = HIP_Y + p.bob;
  const tilted = (draw: () => void) => {
    ctx.save();
    ctx.translate(TILT_PIVOT[0], TILT_PIVOT[1]);
    ctx.rotate(p.tilt);
    ctx.translate(-TILT_PIVOT[0], -TILT_PIVOT[1]);
    draw();
    ctx.restore();
  };

  // far legs (behind body)
  drawLeg(ctx, HIPS.backFar, hipY, p.feet[0], COL.far, COL.hoofFar, false, COL.farShade);
  tilted(() => drawLeg(ctx, HIPS.frontFar, hipY - 4, p.feet[1], COL.far, COL.hoofFar, true, COL.farShade));

  tilted(() => {
    // back scarf tail (behind body)
    scarfTail(ctx, p, 112, 116 + p.bob, 44 + 12 * Math.abs(p.scarfLift), 1.3, sDark, mix(sDark, INK, 0.3), mix(sDark, sLight, 0.5));
    // tail tuft
    ctx.save();
    ctx.translate(54, 128 + p.bob);
    ctx.rotate(-0.6 - p.ear * 0.3);
    inked(ctx, (c) => {
      c.moveTo(0, 6);
      c.quadraticCurveTo(-4, -8, -2, -16);
      c.quadraticCurveTo(6, -9, 8, 4);
      c.closePath();
    }, COL.light, 4);
    ctx.restore();
    // body + chest
    const body = (c: Ctx) => {
      ellipse(c, 90, 135 + p.bob, 42, 27);
      ellipse(c, 118, 124 + p.bob, 20, 22, 0.3);
    };
    inked(ctx, body, COL.shadow, LW);
    clipped(ctx, body, () => {
      ctx.save();
      ctx.translate(-3, -7);
      fillPath(ctx, body, COL.body);
      ctx.restore();
      fillPath(ctx, (c) => ellipse(c, 76, 121 + p.bob, 18, 5.5, -0.12), COL.light);
      // fluffy fur tufts along the belly line
      ctx.fillStyle = COL.shadow;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        circle(ctx, 68 + k * 14, 160 + p.bob, 5);
        ctx.fill();
      }
    });
  });

  // near legs
  drawLeg(ctx, HIPS.backNear, hipY + 2, p.feet[2], COL.body, COL.hoof, false, COL.shadow);
  tilted(() => {
    drawLeg(ctx, HIPS.frontNear, hipY - 2, p.feet[3], COL.body, COL.hoof, true, COL.shadow);

    // scarf: front tail, band, knot
    scarfTail(ctx, p, 110, 122 + p.bob, 40 + 10 * Math.abs(p.scarfLift), 0, scarf, sDark, sLight);
    const band = (c: Ctx) => {
      c.moveTo(104, 112 + p.bob);
      c.quadraticCurveTo(118, 136 + p.bob, 146, 124 + p.bob);
    };
    strokePath(ctx, band, INK, 15 + 8);
    strokePath(ctx, band, scarf, 15);
    // underside shade
    ctx.save();
    ctx.translate(0, 4);
    strokePath(ctx, band, sDark, 6);
    ctx.restore();
    // knit stripes on the band
    for (const t of [0.3, 0.62]) {
      const x = lerp(lerp(104, 118, t), lerp(118, 146, t), t);
      const y = lerp(lerp(112, 136, t), lerp(136, 124, t), t) + p.bob;
      strokePath(ctx, (c) => {
        c.moveTo(x - 2, y - 7);
        c.lineTo(x + 2, y + 7);
      }, sLight, 3.2);
    }

    // head
    ctx.save();
    ctx.translate(126, 118 + p.bob);
    ctx.rotate(p.headTilt);
    ctx.translate(-126, -118);
    drawHead(ctx, p);
    ctx.restore();

    // knot sits over the chin side of the band
    inked(ctx, (c) => ellipse(c, 112, 126 + p.bob, 7, 6.5, 0.4), scarf, 4);
    fillPath(ctx, (c) => ellipse(c, 110, 124 + p.bob, 3, 2.4, 0.4), sLight);
  });

  ctx.restore();
}

// ---------- frames ----------

const still = (): [Foot, Foot, Foot, Foot] => [
  { dx: 2, lift: 0 }, { dx: 2, lift: 0 }, { dx: -2, lift: 0 }, { dx: 0, lift: 0 },
];

function walkPose(i: number): JuniperPose {
  const t = (i / 6) * TAU;
  const swing = (ph: number): Foot => ({
    dx: 11 * Math.sin(t + ph),
    lift: 9 * Math.max(0, Math.cos(t + ph)),
  });
  const A = swing(0);
  const B = swing(Math.PI);
  return pose({
    bob: 1.5 - 2 * Math.abs(Math.cos(t)),
    feet: [B, A, A, B],
    headTilt: -0.03 * Math.cos(2 * t),
    ear: 0.12 * Math.sin(t * 2),
    scarfLift: 0.85,
    scarfWave: -t * 2,
    eyes: 'open',
    mouth: 'smile',
  });
}

/** Frame indices on every Juniper sheet. */
export const JUNIPER_FRAMES = {
  idle: [0, 1, 2, 3],
  /** the blink frame inside idle */
  blink: 3,
  walk: [4, 5, 6, 7, 8, 9],
  crouch: 10,
  rise: 11,
  apex: 12,
  fall: 13,
  land: 14,
  cheer: [15, 16, 17, 18],
  /** the high, happy pose of the cheer */
  cheerPeak: 17,
  count: 19,
} as const;

export function juniperPoses(): JuniperPose[] {
  const P: JuniperPose[] = [];
  // idle: breathing bob, frame 3 blinks
  P.push(pose({ bob: 0, feet: still(), scarfWave: 0 }));
  P.push(pose({ bob: 1, feet: still(), scarfWave: 0.6, headTilt: 0.015, ear: 0.04 }));
  P.push(pose({ bob: 2, feet: still(), scarfWave: 1.2, headTilt: 0.03, ear: 0.09, sy: 0.99, sx: 1.005 }));
  P.push(pose({ bob: 1, feet: still(), scarfWave: 0.6, headTilt: 0.015, ear: 0.04, eyes: 'blink' }));
  // walk
  for (let i = 0; i < 6; i++) P.push(walkPose(i));
  // jump: crouch, rise, apex, fall
  // crouch: body sinks onto deeply bent legs, head dips, ears swing down
  P.push(pose({
    bob: 9, sx: 1.08, sy: 0.92, headTilt: 0.1, tilt: 0.03,
    feet: [{ dx: -3, lift: 0, bend: 1.25 }, { dx: 4, lift: 0, bend: 1.25 }, { dx: -6, lift: 0, bend: 1.25 }, { dx: 5, lift: 0, bend: 1.25 }],
    ear: 0.35, scarfLift: 0.05, scarfWave: 0.4, mouth: 'smile',
  }));
  // rise: stretched, nose up, front legs tucked to the chest, back legs pushing off long behind
  P.push(pose({
    bob: -3, sx: 0.92, sy: 1.1, tilt: -0.2, shadow: 0,
    feet: [{ dx: -22, lift: 3 }, { dx: -3, lift: 20, bend: 1.5 }, { dx: -24, lift: 1 }, { dx: -2, lift: 18, bend: 1.5 }],
    ear: -0.45, scarfLift: 0.7, scarfWave: 1.5, mouth: 'grin',
  }));
  // apex: round, compact, all four legs tucked under
  P.push(pose({
    bob: 1, sx: 1.03, sy: 0.97, shadow: 0, tilt: -0.04,
    feet: [{ dx: 8, lift: 15, bend: 1.4 }, { dx: -6, lift: 17, bend: 1.5 }, { dx: 9, lift: 14, bend: 1.4 }, { dx: -5, lift: 16, bend: 1.5 }],
    ear: -0.2, scarfLift: 0.2, scarfWave: 2.6, mouth: 'open',
  }));
  // fall: legs reach down for the ground, ears and scarf blown up
  P.push(pose({
    bob: -6, sy: 1.04, sx: 0.97, tilt: 0.06, shadow: 0,
    feet: [{ dx: -5, lift: 1, bend: 0.4 }, { dx: 7, lift: 0, bend: 0.4 }, { dx: -7, lift: 0, bend: 0.4 }, { dx: 9, lift: 0, bend: 0.4 }],
    ear: -0.8, scarfLift: -0.9, scarfWave: 3.4, mouth: 'o',
  }));
  // land squash (15%): wide stance, legs buckled, ears flop down
  P.push(pose({
    bob: 7, sx: 1.15, sy: 0.85, headTilt: 0.06,
    feet: [{ dx: -9, lift: 0, bend: 1.3 }, { dx: 9, lift: 0, bend: 1.3 }, { dx: -11, lift: 0, bend: 1.3 }, { dx: 10, lift: 0, bend: 1.3 }],
    ear: 0.45, scarfLift: 0.05, scarfWave: 4.2, eyes: 'blink',
  }));
  // cheer: crouch, rise, peak (happy eyes), come down
  P.push(pose({ bob: 3, sx: 1.05, sy: 0.92, feet: still(), ear: 0.15, scarfWave: 0.5, mouth: 'grin' }));
  P.push(pose({
    lift: 12, tilt: -0.24, shadow: 0.8,
    feet: [{ dx: -2, lift: 2 }, { dx: 15, lift: 24 }, { dx: -4, lift: 2 }, { dx: 17, lift: 22 }],
    ear: -0.3, scarfLift: 0.3, scarfWave: 1.6, mouth: 'open',
  }));
  P.push(pose({
    lift: 20, tilt: -0.3, shadow: 0.68, headTilt: -0.05,
    feet: [{ dx: -3, lift: 4 }, { dx: 17, lift: 32 }, { dx: -6, lift: 4 }, { dx: 20, lift: 30 }],
    ear: -0.45, scarfLift: 0.55, scarfWave: 3.0, eyes: 'happy', mouth: 'open',
  }));
  P.push(pose({
    lift: 6, tilt: -0.1, shadow: 0.9,
    feet: [{ dx: 0, lift: 1 }, { dx: 10, lift: 12 }, { dx: -2, lift: 1 }, { dx: 12, lift: 11 }],
    ear: 0.1, scarfLift: 0.2, scarfWave: 4.4, eyes: 'happy', mouth: 'grin',
  }));
  return P;
}

export function buildJuniper(): { sheets: SheetSpec[]; anims: AnimSpec[] } {
  const poses = juniperPoses();
  const sheets: SheetSpec[] = [];
  const anims: AnimSpec[] = [];
  SCARF_COLOURS.forEach((sc, s) => {
    const key = juniperKey(s);
    sheets.push(makeSheet(key, W, H, poses.length, (ctx, i) => drawJuniper(ctx, poses[i], hex(sc)), 10));
    anims.push(...juniperAnimSpecs(key, (base) => juniperAnim(base, s)));
  });
  return { sheets, anims };
}

/**
 * The six animations of a Juniper-layout sheet (idle, walk, jump up, jump fall, cheer, land)
 * with Juniper's timings. `animKey(base)` names each one from its base key. Playable heroes
 * reuse this so every hero moves with exactly the same rhythm.
 */
export function juniperAnimSpecs(texture: string, animKey: (base: string) => string): AnimSpec[] {
  const F = JUNIPER_FRAMES;
  return [
    // idle: 320 ms per frame; blink frame appears once per ~3.8 s loop
    { key: animKey(ANIM.idle), texture, frames: [0, 1, 2, 1, 0, 1, 2, 1, 0, 3, 2, 1], frameRate: 1000 / 320, repeat: -1 },
    { key: animKey(ANIM.walk), texture, frames: [...F.walk], frameRate: 10, repeat: -1 },
    // crouch held 120 ms, then rise
    { key: animKey(ANIM.jumpUp), texture, frames: [F.crouch, F.rise], frameRate: 10, repeat: 0, hold: { 0: 120 } },
    { key: animKey(ANIM.jumpFall), texture, frames: [F.apex, F.fall], frameRate: 8, repeat: 0 },
    // high pose held 500 ms
    { key: animKey(ANIM.cheer), texture, frames: [...F.cheer], frameRate: 10, repeat: 0, hold: { 2: 500 } },
    // extra (not in keys.ts): land squash, 120 ms one-shot
    { key: animKey(JUNIPER_ANIM_LAND), texture, frames: [F.land], frameRate: 1000 / 120, repeat: 0 },
  ];
}

/** Extra animation base key (use with juniperAnim): one-shot landing squash. */
export const JUNIPER_ANIM_LAND = 'juniper-land';
export { TEX };
