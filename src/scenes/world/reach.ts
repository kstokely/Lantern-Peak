// Physics-envelope reachability for an area layout (pure, no Phaser). Used by tests/zones.test.ts.
// It simulates real jumps (gravity, jump speed, walk speed, variable air control, bounce pads, Spring Hooves and,
// for bonus stashes, Cloud Boots / Feather Cape) against the area's solid rock and one-way pieces, and builds a
// graph over every standable surface. Moving pieces are sampled over their whole travel (the child can always wait
// for them); timed pieces (tick-tock, aurora, crumble) count as standable (they are solid long enough to cross)
// and also as places you can drop from. `margin` scales the jump: 0.78 = only hops within 78% of the max
// height and distance count.
import {
  AIR_JUMP_V, BODY_H, BODY_W, GLIDE_FALL, GRAVITY, JUMP_V, JUMP_V_HOOVES, MAX_FALL, PAD_V, PAD_V_HOLD, SPEED,
} from '../../core/physics';
import { AreaLayout, GROUND_Y, WORLD_BOTTOM, worldTop } from '../zones';
import { HALF, PAD_HALF, PAD_TOP, gearAngle, pendulumAngle } from './pieceLogic';

export interface Box { x0: number; x1: number; y0: number; y1: number }
export interface Surface {
  x0: number;
  x1: number;
  y: number;
  kind: 'ground' | 'rock' | 'ledge' | 'lift' | 'crumble' | 'tick' | 'gear' | 'pendulum' | 'aurora';
  /** Samples of one moving piece share a group (you can ride between them). */
  group: number;
  oneWay: boolean;
}

export interface ReachOptions {
  margin: number;
  hooves?: boolean;
  /** Cloud Boots (air jump) and Feather Cape (glide). */
  air?: boolean;
  /** Bounce pads launched with jump held. */
  padHold?: boolean;
}

export interface ReachResult {
  surfaces: Surface[];
  reached: boolean[];
  start: number;
  /** Loose gem indices touched by some reachable move. */
  loose: Set<number>;
  /** Surfaces from which the exit surfaces can be reached again (no soft-lock). */
  canExit: boolean[];
  /** Max rise of the full jump used. */
  rise: number;
}

const HW = BODY_W / 2;
const DT = 1 / 60;

export function geometry(L: AreaLayout) {
  const P = L.pieces;
  const solids: Box[] = [];
  // ground = [0, width] minus pits
  const pits = [...L.pits].sort((a, b) => a[0] - b[0]);
  let x = 0;
  for (const [a, b] of pits) {
    if (a > x) solids.push({ x0: x, x1: a, y0: GROUND_Y, y1: WORLD_BOTTOM + 400 });
    x = Math.max(x, b);
  }
  if (x < L.width) solids.push({ x0: x, x1: L.width, y0: GROUND_Y, y1: WORLD_BOTTOM + 400 });
  const nGround = solids.length;
  for (const b of P.blocks ?? []) solids.push({ x0: b.x0, x1: b.x1, y0: b.y, y1: b.bottom ?? WORLD_BOTTOM + 400 });
  const surfaces: Surface[] = [];
  solids.forEach((s, i) => {
    // top minus whatever other solid covers it
    let parts: [number, number][] = [[s.x0, s.x1]];
    for (const r of solids) {
      if (r === s || !(r.y0 < s.y0 && r.y1 >= s.y0)) continue;
      parts = parts.flatMap(([a, b]) => {
        if (r.x1 <= a || r.x0 >= b) return [[a, b] as [number, number]];
        const out: [number, number][] = [];
        if (r.x0 > a) out.push([a, r.x0]);
        if (r.x1 < b) out.push([r.x1, b]);
        return out;
      });
    }
    for (const [a, b] of parts) if (b - a > 4) surfaces.push({ x0: a, x1: b, y: s.y0, kind: i < nGround ? 'ground' : 'rock', group: -1, oneWay: false });
  });
  let g = 0;
  const one = (x: number, y: number, half: number, kind: Surface['kind'], group = -1) =>
    surfaces.push({ x0: x - half, x1: x + half, y, kind, group, oneWay: true });
  for (const l of L.ledges) one(l.x, l.y, HALF.ledge, 'ledge');
  for (const c of P.crumbles ?? []) one(c.x, c.y, HALF.crumble, 'crumble');
  for (const t of P.ticks ?? []) one(t.x, t.y, HALF.brass, 'tick');
  for (const a of P.auroras ?? []) one(a.x, a.y, HALF.aurora, 'aurora');
  for (const lf of P.lifts ?? []) {
    const id = g++;
    for (const f of [0, 0.25, 0.5, 0.75, 1]) one(lf.x + lf.dx * f, lf.y + lf.dy * f, HALF[lf.kind], 'lift', id);
  }
  for (const gr of P.gears ?? []) {
    for (let i = 0; i < gr.n; i++) {
      const id = g++;
      for (let k = 0; k < 12; k++) {
        const a = gearAngle(0, 1, 1, k, 12);
        one(gr.x + gr.r * Math.cos(a), gr.y + gr.r * Math.sin(a), HALF.brass, 'gear', id);
      }
    }
  }
  for (const pd of P.pendulums ?? []) {
    const id = g++;
    for (const f of [-1, -0.7, -0.35, 0, 0.35, 0.7, 1]) {
      const th = pendulumAngle(0, pd.amp * f, 1, Math.PI / 2);
      one(pd.x + pd.len * Math.sin(th), pd.y + pd.len * Math.cos(th), HALF.brass, 'pendulum', id);
    }
  }
  const pads = (P.pads ?? []).map((p) => ({ x0: p.x - PAD_HALF, x1: p.x + PAD_HALF, top: p.y - PAD_TOP, x: p.x }));
  return { solids, surfaces, pads };
}

type Geo = ReturnType<typeof geometry>;

interface SimOut {
  /** Surface index, -2 = a bounce pad (pad index in `pad`), -1 = fell out of the world. */
  land: number;
  pad: number;
  x: number;
}

function overlapsSolid(geo: Geo, x: number, feet: number): Box | null {
  for (const s of geo.solids) {
    if (x + HW <= s.x0 + 0.5 || x - HW >= s.x1 - 0.5) continue;
    if (feet <= s.y0 + 0.5 || feet - BODY_H >= s.y1 - 0.5) continue;
    return s;
  }
  return null;
}

/**
 * One jump / drop. dir = air control direction, from t = start to t = stop (s). ignore = a one-way surface to fall through.
 * onSample(x, centreY) is called every step (loose-gem pickups).
 */
function sim(
  geo: Geo, L: AreaLayout, x: number, feet: number, vy: number, speed: number, dir: number, start: number, stop: number,
  ignore: number, airJumpV: number, glide: boolean, onSample: ((x: number, cy: number) => void) | null,
): SimOut {
  const top = worldTop(L);
  let t = 0;
  let airJump = airJumpV > 0;
  for (let step = 0; step < 600; step++) {
    t += DT;
    const vx = t >= start && t < stop ? dir * speed : 0;
    if (airJump && vy >= 0) {
      airJump = false;
      vy = -airJumpV;
    }
    vy = Math.min(MAX_FALL, vy + GRAVITY * DT);
    if (glide && vy > GLIDE_FALL) vy = GLIDE_FALL;
    // horizontal
    let nx = Math.max(HW, Math.min(L.width - HW, x + vx * DT));
    const hit = vx !== 0 ? overlapsSolid(geo, nx, feet) : null;
    if (hit) nx = vx > 0 ? hit.x0 - HW : hit.x1 + HW;
    x = nx;
    // vertical
    let nf = feet + vy * DT;
    if (vy > 0) {
      let best = Infinity;
      let land = -3;
      let pad = -1;
      for (let i = 0; i < geo.surfaces.length; i++) {
        const s = geo.surfaces[i];
        if (i === ignore) continue;
        const inset = s.oneWay ? 4 : 0.5;
        if (x + HW <= s.x0 + inset || x - HW >= s.x1 - inset) continue;
        if (feet <= s.y + 0.5 && nf >= s.y && s.y < best) {
          best = s.y;
          land = i;
        }
      }
      for (let i = 0; i < geo.pads.length; i++) {
        const p = geo.pads[i];
        if (x < p.x0 || x > p.x1) continue;
        if (feet <= p.top + 0.5 && nf >= p.top && p.top < best) {
          best = p.top;
          land = -2;
          pad = i;
        }
      }
      if (land !== -3) {
        onSample?.(x, best - BODY_H / 2);
        return { land, pad, x };
      }
    } else if (vy < 0) {
      for (const s of geo.solids) {
        if (x + HW <= s.x0 + 0.5 || x - HW >= s.x1 - 0.5) continue;
        if (feet - BODY_H >= s.y1 - 0.5 && nf - BODY_H < s.y1) {
          nf = s.y1 + BODY_H;
          vy = 0;
        }
      }
      if (nf - BODY_H < top) {
        nf = top + BODY_H;
        vy = 0;
      }
    }
    feet = nf;
    onSample?.(x, feet - BODY_H / 2);
    if (feet > WORLD_BOTTOM + 120) return { land: -1, pad: -1, x };
  }
  return { land: -1, pad: -1, x };
}

const PROFILES: [number, number, number][] = [
  [0, 0, 99],
  [1, 0, 99], [-1, 0, 99],
  [1, 0, 0.15], [-1, 0, 0.15],
  [1, 0, 0.3], [-1, 0, 0.3],
  [1, 0, 0.5], [-1, 0, 0.5],
  [1, 0.25, 99], [-1, 0.25, 99],
  [1, 0.42, 99], [-1, 0.42, 99],
];

/** Where the hero can stand on surface s (x values), a few samples. */
function standXs(geo: Geo, s: Surface): number[] {
  const out: number[] = [];
  const lo = s.x0 - HW + 6;
  const hi = s.x1 + HW - 6;
  const n = Math.max(2, Math.ceil((hi - lo) / 70));
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    if (!overlapsSolid(geo, x, s.y - 0.01)) out.push(x);
  }
  return out;
}

/** Index of the surface the point (x, feet y) stands on, or -1. */
export function surfaceAt(surfaces: Surface[], x: number, y: number, inset = 8) {
  let best = -1;
  for (let i = 0; i < surfaces.length; i++) {
    const s = surfaces[i];
    if (Math.abs(s.y - y) <= 2 && x >= s.x0 + inset && x <= s.x1 - inset) {
      if (best < 0 || (surfaces[best].oneWay && !s.oneWay)) best = i;
    }
  }
  return best;
}

export function reach(L: AreaLayout, opt: ReachOptions, start: { x: number; y: number }, exits: { x: number; y: number }[], collectLoose = true): ReachResult {
  const geo = geometry(L);
  const k = Math.sqrt(opt.margin);
  const v = (opt.hooves ? JUMP_V_HOOVES : JUMP_V) * k;
  const speed = SPEED * k;
  const padV = (opt.padHold ? PAD_V_HOLD : PAD_V) * k;
  const airV = opt.air ? AIR_JUMP_V * k : 0;
  const S = geo.surfaces;
  const n = S.length;
  const edges: number[][] = Array.from({ length: n }, () => []);
  const looseHit: Set<number>[] = Array.from({ length: n }, () => new Set());
  const padTargets: Map<number, { set: Set<number>; loose: Set<number>; fell: boolean }> = new Map();
  const fellFrom: boolean[] = new Array(n).fill(false);
  const loose = L.loose;
  const sampler = (bucket: Set<number>) => (x: number, cy: number) => {
    for (let i = 0; i < loose.length; i++) {
      const g = loose[i];
      if (Math.abs(g.x - x) < 60 && Math.abs(g.y - cy) < 88) bucket.add(i);
    }
  };
  const padOut = (pi: number) => {
    let r = padTargets.get(pi);
    if (r) return r;
    r = { set: new Set(), loose: new Set(), fell: false };
    padTargets.set(pi, r);
    const p = geo.pads[pi];
    const smp = collectLoose ? sampler(r.loose) : null;
    for (const [dir, st, sp] of PROFILES) {
      for (const glide of opt.air ? [false, true] : [false]) {
        const o = sim(geo, L, p.x, p.top, -padV, speed, dir, st, sp, -1, 0, glide, smp);
        if (o.land >= 0) r.set.add(o.land);
        else if (o.land === -2) r.set.add(-100 - o.pad);
        else r.fell = true;
      }
    }
    return r;
  };
  for (let i = 0; i < n; i++) {
    const s = S[i];
    const smp = collectLoose ? sampler(looseHit[i]) : null;
    const add = (o: SimOut) => {
      if (o.land >= 0) {
        if (o.land !== i) edges[i].push(o.land);
      } else if (o.land === -2) edges[i].push(-100 - o.pad);
      else fellFrom[i] = true;
    };
    for (const x of standXs(geo, s)) {
      smp?.(x, s.y - BODY_H / 2);
      for (const [dir, st, sp] of PROFILES) {
        for (const air of airV ? [0, airV] : [0]) {
          for (const glide of opt.air ? [false, true] : [false]) add(sim(geo, L, x, s.y, -v, speed, dir, st, sp, -1, air, glide, smp));
        }
      }
    }
    // walking off either edge, and dropping through (one-way / timed pieces)
    for (const dir of [-1, 1]) {
      const ex = dir > 0 ? s.x1 + HW + 1 : s.x0 - HW - 1;
      if (!overlapsSolid(geo, ex, s.y - 0.01)) {
        add(sim(geo, L, ex, s.y, 0, speed, dir, 0, 99, -1, 0, false, smp));
        add(sim(geo, L, ex, s.y, 0, speed, dir, 0, 0.2, -1, 0, false, smp));
      }
    }
    if (s.oneWay) for (const x of [s.x0 + 20, (s.x0 + s.x1) / 2, s.x1 - 20]) add(sim(geo, L, x, s.y, 10, speed, 0, 0, 0, i, 0, false, smp));
    // riding a moving piece
    if (s.group >= 0) for (let j = 0; j < n; j++) if (j !== i && S[j].group === s.group) edges[i].push(j);
    // walking across touching surfaces at the same height
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const o = S[j];
      if (Math.abs(o.y - s.y) < 1 && o.x0 <= s.x1 + 1 && o.x1 >= s.x0 - 1) edges[i].push(j);
    }
  }
  const startIdx = surfaceAt(S, start.x, start.y, 0);
  const reached = new Array(n).fill(false);
  const lset = new Set<number>();
  const queue: number[] = [];
  const padsSeen = new Set<number>();
  const visit = (i: number) => {
    if (i <= -100) {
      if (padsSeen.has(i)) return;
      padsSeen.add(i);
      const r = padOut(-100 - i);
      r.loose.forEach((x) => lset.add(x));
      r.set.forEach((t) => visit(t));
      return;
    }
    if (i < 0 || reached[i]) return;
    reached[i] = true;
    queue.push(i);
  };
  if (startIdx >= 0) visit(startIdx);
  while (queue.length) {
    const i = queue.shift()!;
    looseHit[i].forEach((x) => lset.add(x));
    for (const t of edges[i]) visit(t);
  }
  // soft-lock check: reverse reachability from the exits (a fall floats you back to the entrance)
  const exitIdx = exits.map((e) => surfaceAt(S, e.x, e.y, 0)).filter((i) => i >= 0);
  const fwd: number[][] = edges.map((list, i) => {
    const out: number[] = [];
    const seen = new Set<number>();
    const push = (t: number) => {
      if (t <= -100) {
        if (seen.has(t)) return;
        seen.add(t);
        const r = padOut(-100 - t);
        r.set.forEach((u) => push(u));
        if (r.fell && startIdx >= 0) out.push(startIdx);
      } else out.push(t);
    };
    list.forEach(push);
    if (fellFrom[i] && startIdx >= 0) out.push(startIdx);
    return out;
  });
  const canExit = new Array(n).fill(false);
  exitIdx.forEach((i) => (canExit[i] = true));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++) {
      if (canExit[i]) continue;
      if (fwd[i].some((t) => t >= 0 && canExit[t])) {
        canExit[i] = true;
        changed = true;
      }
    }
  }
  return { surfaces: S, reached, start: startIdx, loose: lset, canExit, rise: (v * v) / (2 * GRAVITY) };
}

/** True when the point (x, feet y) stands on a reached surface. */
export function standsReached(r: ReachResult, x: number, y: number, inset = 12) {
  for (let i = 0; i < r.surfaces.length; i++) {
    const s = r.surfaces[i];
    if (r.reached[i] && Math.abs(s.y - y) <= 2 && x >= s.x0 + inset && x <= s.x1 - inset) return true;
  }
  return false;
}

/** True when (x, y) is inside solid rock / ground (not just touching its surface). */
export function insideSolid(L: AreaLayout, x: number, y: number) {
  return geometry(L).solids.some((s) => x > s.x0 + 2 && x < s.x1 - 2 && y > s.y0 + 2 && y < s.y1);
}
