import { describe, expect, it } from 'vitest';
import { AREAS, AreaLayout, DOOR_GATES, DOOR_LEDGE_Y, GROUND_Y, worldTop } from '../src/scenes/zones';
import { NUM_ZONES, ZONE_PRESENTS } from '../src/types';
import type { MiniGameId } from '../src/types';
import { ReachResult, geometry, insideSolid, reach, standsReached } from '../src/scenes/world/reach';
import { MAX_RISE_NORMAL, jumpReach } from '../src/core/physics';
import { liftWorstWait, TICK_BEAT, AURORA_GONE, AURORA_FADE_IN } from '../src/scenes/world/pieceLogic';

/** Required hops must stay within this share of the full jump (height and distance). */
const REQUIRED_MARGIN = 0.78;
/** Everything else must be reachable within this share with the tools the area may assume. */
const ALLOWED_MARGIN = 0.88;

const gatesOf = (z: number, a: number) => (a === 0 ? [] : DOOR_GATES[z][a - 1]);
const start = (L: AreaLayout) => ({ x: L.startX, y: GROUND_Y });
/** Places you can leave the area from: its doorways (and the sled on the Trail, where the gate is). */
const exitsOf = (L: AreaLayout) => [
  ...L.doors.filter((d) => !d.gates.includes('high')).map((d) => ({ x: d.x, y: d.y })),
  ...(L.area === 0 ? [{ x: L.sledX!, y: L.sledY ?? GROUND_Y }] : []),
];

const cache = new Map<string, ReachResult>();
function run(L: AreaLayout, kind: 'required' | 'allowed' | 'bonus' | 'plain' | 'hooves'): ReachResult {
  const key = `${L.zone}-${L.area}-${kind}`;
  let r = cache.get(key);
  if (r) return r;
  const hoovesGate = gatesOf(L.zone, L.area).includes('high');
  const opt =
    kind === 'required' ? { margin: REQUIRED_MARGIN }
    : kind === 'allowed' ? { margin: ALLOWED_MARGIN, hooves: hoovesGate, padHold: true }
    : kind === 'bonus' ? { margin: 0.95, hooves: true, air: true, padHold: true }
    : kind === 'hooves' ? { margin: ALLOWED_MARGIN, hooves: true, padHold: true }
    : { margin: 1, padHold: true };
  r = reach(L, opt, start(L), exitsOf(L), kind !== 'plain' && kind !== 'hooves');
  cache.set(key, r);
  return r;
}

describe('physics envelope', () => {
  it('full jump rises 256 px and a required hop stays well inside it', () => {
    expect(Math.round(MAX_RISE_NORMAL)).toBe(256);
    expect(REQUIRED_MARGIN * MAX_RISE_NORMAL).toBeLessThan(205);
    expect(Math.round(jumpReach(0))).toBe(352);
  });
});

describe('reachability model sanity', () => {
  const base = (): AreaLayout => ({
    zone: 1, area: 1, name: 'test', width: 2000, ledges: [], presents: [], gems: [], loose: [], flurries: [], doors: [], deco: [],
    startX: 200, dark: false, tint: 0, heightScreens: 1, pits: [], pieces: {},
  });
  it('a 300 px ledge is out of reach of a plain jump but a bounce pad gets there', () => {
    const L = base();
    L.ledges = [{ x: 800, y: 400 }];
    expect(standsReached(reach(L, { margin: 1 }, { x: 200, y: GROUND_Y }, []), 800, 400)).toBe(false);
    L.pieces = { pads: [{ x: 640, y: GROUND_Y }] };
    expect(standsReached(reach(L, { margin: REQUIRED_MARGIN }, { x: 200, y: GROUND_Y }, []), 800, 400)).toBe(true);
  });
  it('a 190 px ledge is fine at 78% but a 215 px one is not', () => {
    const L = base();
    L.ledges = [{ x: 800, y: 510 }, { x: 1400, y: 485 }];
    const r = reach(L, { margin: REQUIRED_MARGIN }, { x: 200, y: GROUND_Y }, []);
    expect(standsReached(r, 800, 510)).toBe(true);
    expect(standsReached(r, 1400, 485)).toBe(false);
  });
  it('a wide gap stops you, a rock wall cannot be jumped through, and a lift carries you over', () => {
    const L = base();
    L.pits = [[800, 1300]];
    expect(standsReached(reach(L, { margin: 1 }, { x: 200, y: GROUND_Y }, []), 1500, GROUND_Y)).toBe(false);
    L.pieces = { lifts: [{ kind: 'cloud', x: 900, y: 680, dx: 300, dy: 0, travel: 1500, pause: 800 }] };
    expect(standsReached(reach(L, { margin: REQUIRED_MARGIN }, { x: 200, y: GROUND_Y }, []), 1500, GROUND_Y)).toBe(true);
    const W = base();
    W.pieces = { blocks: [{ x0: 900, x1: 960, y: 380 }] };
    expect(standsReached(reach(W, { margin: 1 }, { x: 200, y: GROUND_Y }, []), 1500, GROUND_Y)).toBe(false);
  });
});

describe('area layouts', () => {
  it('has 15 areas and the 10 side areas all differ', () => {
    const sig = new Set<string>();
    for (let z = 0; z < NUM_ZONES; z++) {
      for (const a of [1, 2]) {
        const L = AREAS[z][a];
        sig.add(JSON.stringify([L.ledges, L.presents.map((p) => [p.x, p.y]), L.gems.map((g) => [g.x, g.y]), L.pieces]));
      }
    }
    expect(sig.size).toBe(10);
  });

  it('camp 1 stays one screen of walking and hopping (no new pieces apart from signs and a checkpoint)', () => {
    for (const L of AREAS[0]) {
      expect(L.heightScreens).toBe(1);
      expect(L.pits).toEqual([]);
      const { signs, checkpoints, ...rest } = L.pieces;
      expect(Object.values(rest).every((v) => !v || (v as unknown[]).length === 0)).toBe(true);
      void signs;
      void checkpoints;
    }
  });

  it('areas grow taller higher up the mountain (camp 2: 1 screen, camps 3-4: up to 2, camp 5 Trail: 3)', () => {
    for (const L of AREAS[1]) expect(L.heightScreens).toBe(1);
    for (const z of [2, 3]) for (const L of AREAS[z]) expect(L.heightScreens).toBeLessThanOrEqual(2);
    expect(AREAS[4][0].heightScreens).toBe(3);
    expect(AREAS[4][0].sledY!).toBeLessThan(-900);
  });

  it('camp 2 has no leap of faith: every gap there is small', () => {
    for (const L of AREAS[1]) for (const [a, b] of L.pits) if (!(L.pieces.lifts ?? []).some((l) => l.x - 116 < b && l.x + l.dx + 116 > a)) expect(b - a).toBeLessThanOrEqual(180);
  });

  it('moving pieces never make a child wait more than about 4 s', () => {
    for (const row of AREAS) for (const L of row) {
      for (const l of L.pieces.lifts ?? []) expect(liftWorstWait(l.travel, l.pause), `${L.name} lift at ${l.x}`).toBeLessThanOrEqual(4200);
      for (const g of L.pieces.gears ?? []) expect(g.period / g.n, `${L.name} gear`).toBeLessThanOrEqual(4200);
      for (const p of L.pieces.pendulums ?? []) expect(p.period, `${L.name} pendulum`).toBeLessThanOrEqual(4200);
    }
    expect(2 * TICK_BEAT).toBeLessThanOrEqual(4200);
    expect(AURORA_GONE + AURORA_FADE_IN).toBeLessThan(4000);
  });

  for (let z = 0; z < NUM_ZONES; z++) {
    for (let a = 0; a < 3; a++) {
      const L = AREAS[z][a];
      describe(`camp ${z + 1} area ${a} (${L.name})`, () => {
        it('required route: presents (Trail + side area A), sled, exits and checkpoints with plain jumps at 78%', () => {
          const r = run(L, a === 2 ? 'allowed' : 'required');
          expect(r.start, 'entrance surface').toBeGreaterThanOrEqual(0);
          if (a < 2) for (const p of L.presents) expect(standsReached(r, p.x, p.y), `present ${p.index} at ${p.x},${p.y}`).toBe(true);
          if (a === 0) expect(standsReached(r, L.sledX!, L.sledY ?? GROUND_Y, 4), 'sled').toBe(true);
          for (const d of L.doors) if (!d.gates.includes('high')) expect(standsReached(r, d.x, d.y, 4), `door to ${d.to} at ${d.x},${d.y}`).toBe(true);
          for (const c of L.pieces.checkpoints ?? []) expect(standsReached(r, c.x, c.y, 4), `checkpoint ${c.x},${c.y}`).toBe(true);
        });

        it('everything else is reachable with the tools this area may assume (at 88%)', () => {
          const r = run(L, 'allowed');
          for (const p of L.presents) expect(standsReached(r, p.x, p.y), `present ${p.index} at ${p.x},${p.y}`).toBe(true);
          for (const g of L.gems) expect(standsReached(r, g.x, g.y + 64), `frost gem ${g.index} at ${g.x},${g.y}`).toBe(true);
          L.loose.forEach((g, i) => {
            if (!g.bonus) expect(r.loose.has(i), `loose gem ${i} at ${g.x},${g.y}`).toBe(true);
          });
        });

        it('bonus stashes are reachable with every tool', () => {
          const r = run(L, 'bonus');
          L.loose.forEach((g, i) => {
            if (g.bonus) expect(r.loose.has(i), `bonus gem ${i} at ${g.x},${g.y}`).toBe(true);
          });
        });

        it('no soft-locks: from everywhere you can reach, you can get back to a way out', () => {
          const r = run(L, 'allowed');
          r.reached.forEach((ok, i) => {
            if (!ok) return;
            const s = r.surfaces[i];
            expect(r.canExit[i], `stuck on ${s.kind} ${Math.round(s.x0)}-${Math.round(s.x1)} at ${Math.round(s.y)}`).toBe(true);
          });
        });

        it('nothing sits inside rock or off the world; every gap has a checkpoint before it', () => {
          const top = worldTop(L);
          const pts = [
            ...L.presents.map((p) => ({ x: p.x, y: p.y - 60, w: 'present' })),
            ...L.gems.map((g) => ({ x: g.x, y: g.y, w: 'frost gem' })),
            ...L.loose.map((g) => ({ x: g.x, y: g.y, w: 'loose gem' })),
            ...(L.pieces.checkpoints ?? []).map((c) => ({ x: c.x, y: c.y - 60, w: 'checkpoint' })),
          ];
          for (const p of pts) {
            expect(insideSolid(L, p.x, p.y), `${p.w} ${p.x},${p.y} inside rock`).toBe(false);
            expect(p.x, `${p.w} x`).toBeGreaterThan(60);
            expect(p.x, `${p.w} x`).toBeLessThan(L.width - 60);
            expect(p.y, `${p.w} y`).toBeGreaterThan(top + 120);
            expect(p.y, `${p.w} y`).toBeLessThan(GROUND_Y);
          }
          for (const [x0] of L.pits) {
            const cps = (L.pieces.checkpoints ?? []).filter((c) => c.x < x0 && x0 - c.x <= 1400);
            expect(cps.length, `checkpoint before the gap at ${x0}`).toBeGreaterThan(0);
          }
        });

        if (a === 0) {
          it('the high doorway still needs the Spring Hooves (isolated 280 px ledge; reachable with them)', () => {
            const hooves = run(L, 'hooves');
            const g = geometry(L);
            for (const d of L.doors) {
              if (!d.gates.includes('high')) continue;
              expect(d.y).toBe(DOOR_LEDGE_Y);
              // nothing to step up from: no other surface between the ledge and the ground within a long hop of it
              // (the doorway itself also refuses entry without the hooves: Doors.verdict)
              const near = g.surfaces.filter((s) => s.y > d.y + 2 && s.y < GROUND_Y - 2 && s.x1 > d.x - 116 - 300 && s.x0 < d.x + 116 + 300);
              expect(near.map((s) => `${s.kind}@${s.x0},${s.y}`), `door ${d.to} steps`).toEqual([]);
              expect(standsReached(hooves, d.x, d.y, 4), `door ${d.to} with hooves`).toBe(true);
            }
          });
        }
      });
    }
  }
});

describe('mini games', () => {
  it('every mini game appears in a present and Snow Scale is in several side areas', () => {
    const all: MiniGameId[] = ['frostLock', 'iceBridge', 'gemSort', 'pieShare', 'clockTower', 'coinShop', 'trailFriend', 'snowScale'];
    const used = new Set<MiniGameId>(['frostLock']); // frostLock = the loose "frost gem" question, not a present
    for (const row of ZONE_PRESENTS) for (const g of row) used.add(g);
    for (const g of all) expect(used.has(g), g).toBe(true);
    let sideScale = 0;
    for (let z = 0; z < NUM_ZONES; z++) for (let a = 1; a < 3; a++) if (AREAS[z][a].presents.some((p) => p.game === 'snowScale')) sideScale++;
    expect(sideScale).toBeGreaterThanOrEqual(3);
    for (let z = 0; z < NUM_ZONES; z++) for (let a = 0; a < 3; a++) for (const p of AREAS[z][a].presents) expect(p.game).not.toBe('frostLock');
  });
});
