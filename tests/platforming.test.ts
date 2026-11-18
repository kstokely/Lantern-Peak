import { beforeEach, describe, expect, it } from 'vitest';
import {
  AURORA_CYCLE, AURORA_FADE_IN, AURORA_GONE, AURORA_SOLID, AURORA_WARN, CRUMBLE_MS, CRUMBLE_REGROW, Crumble, FallCounter,
  HELPER_AFTER_FALLS, TICK_BEAT, TICK_WARN, WIND_OFF, WIND_ON, auroraState, liftFraction, liftWorstWait, tickState, windStrength,
} from '../src/scenes/world/pieceLogic';
import { STORE_ITEMS, campLit, storeItem } from '../src/core/store';
import { createProfile, parseSave, persist, reloadSave, save, setStorage } from '../src/core/save';
import { EARN, LOOSE_RESPAWN_MS, ODD_JOB_GAMES, ODD_JOB_PAY, oddJobGame, session } from '../src/core/session';
import { AREAS, DOOR_GATES, Gate } from '../src/scenes/zones';
import { LANTERNS_TO_LIGHT, NUM_ZONES, PRESENTS_PER_AREA } from '../src/types';
import type { ToolId } from '../src/art/keys';

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

beforeEach(() => {
  setStorage(new MemStorage());
  reloadSave();
  session.clear();
});

const fresh = () => {
  const p = createProfile('Robin', 1, 0)!;
  session.select(p.id);
  return p;
};

describe('tick-tock platforms', () => {
  it('groups take turns on a steady beat and blink before vanishing', () => {
    expect(tickState(0, 0).solid).toBe(true);
    expect(tickState(1, 0).solid).toBe(false);
    expect(tickState(0, TICK_BEAT + 1).solid).toBe(false);
    expect(tickState(1, TICK_BEAT + 1).solid).toBe(true);
    expect(tickState(0, TICK_BEAT - TICK_WARN - 10).warn).toBe(false);
    expect(tickState(0, TICK_BEAT - TICK_WARN + 10).warn).toBe(true);
    // a solid platform never goes ghost without a warning first: every solid window ends with >= 0.5 s of warning
    for (let t = 0; t < 4 * TICK_BEAT; t += 10) {
      const a = tickState(0, t);
      const b = tickState(0, t + 10);
      if (a.solid && !b.solid) expect(a.warn).toBe(true);
    }
    expect(TICK_WARN).toBeGreaterThanOrEqual(500);
    expect(TICK_BEAT).toBeGreaterThanOrEqual(1500);
  });
});

describe('aurora bridges', () => {
  it('stay solid at least 2.5 s, shimmer as a warning, are gone about 1.5 s', () => {
    expect(AURORA_SOLID + AURORA_WARN).toBeGreaterThanOrEqual(2500);
    expect(AURORA_GONE).toBeGreaterThanOrEqual(1400);
    expect(AURORA_GONE).toBeLessThanOrEqual(1700);
    expect(auroraState(0).solid).toBe(true);
    expect(auroraState(AURORA_SOLID + 10).warn).toBe(true);
    expect(auroraState(AURORA_SOLID + 10).solid).toBe(true);
    expect(auroraState(AURORA_SOLID + AURORA_WARN + 10).solid).toBe(false);
    expect(auroraState(AURORA_CYCLE - AURORA_FADE_IN / 2).solid).toBe(false);
    expect(auroraState(AURORA_CYCLE + 5).solid).toBe(true);
    // never solid while faded out
    for (let t = 0; t < AURORA_CYCLE * 2; t += 7) {
      const s = auroraState(t, 300);
      if (s.solid) expect(s.alpha).toBeGreaterThanOrEqual(0.44);
      else expect(s.warn).toBe(false);
    }
    // the phase shifts the cycle
    expect(auroraState(0, AURORA_SOLID + AURORA_WARN + 100).solid).toBe(false);
  });
});

describe('lifts, wind, crumbling ledges', () => {
  it('lifts pause at both ends and ease in between', () => {
    expect(liftFraction(0, 1500, 800)).toBe(0);
    expect(liftFraction(700, 1500, 800)).toBe(0);
    expect(liftFraction(800 + 750, 1500, 800)).toBeCloseTo(0.5, 5);
    expect(liftFraction(800 + 1500 + 400, 1500, 800)).toBe(1);
    expect(liftFraction(800 + 1500 + 800 + 750, 1500, 800)).toBeCloseTo(0.5, 5);
    expect(liftFraction(2 * (1500 + 800), 1500, 800)).toBe(0);
    // ease: slow at the ends
    const a = liftFraction(800 + 50, 1500, 800);
    const b = liftFraction(800 + 750, 1500, 800) - liftFraction(800 + 700, 1500, 800);
    expect(a).toBeLessThan(b);
    expect(liftWorstWait(1500, 800)).toBe(3800);
  });

  it('wind blows 2 s, rests 2 s, with soft edges', () => {
    expect(WIND_ON).toBe(2000);
    expect(WIND_OFF).toBe(2000);
    expect(windStrength(1000)).toBeCloseTo(1, 5);
    expect(windStrength(10)).toBeLessThan(0.1);
    expect(windStrength(2500)).toBe(0);
    expect(windStrength(3999)).toBe(0);
    expect(windStrength(5000)).toBeCloseTo(1, 5);
  });

  it('crumbling ledges crack when stood on, fall after 0.9 s and regrow after 3 s', () => {
    const c = new Crumble();
    expect(c.solid).toBe(true);
    c.update(500);
    expect(c.phase).toBe('solid');
    c.stand(1000);
    expect(c.phase).toBe('cracking');
    expect(c.frame(1100)).toBe(1);
    c.update(1000 + CRUMBLE_MS - 1);
    expect(c.solid).toBe(true);
    expect(c.frame(1000 + CRUMBLE_MS - 1)).toBe(2);
    c.stand(1500); // standing again does not restart the crack
    expect(c.update(1000 + CRUMBLE_MS)).toBe(true);
    expect(c.solid).toBe(false);
    expect(CRUMBLE_MS).toBe(900);
    c.update(1000 + CRUMBLE_MS + CRUMBLE_REGROW - 1);
    expect(c.solid).toBe(false);
    c.update(1000 + CRUMBLE_MS + CRUMBLE_REGROW);
    expect(c.solid).toBe(true);
    expect(c.phase).toBe('solid');
  });
});

describe('falls and the helper cloud', () => {
  it('appears exactly on the third fall of the same stretch', () => {
    const f = new FallCounter();
    expect(HELPER_AFTER_FALLS).toBe(3);
    expect(f.record(0)).toBe(false);
    expect(f.record(1)).toBe(false); // another stretch counts separately
    expect(f.record(0)).toBe(false);
    expect(f.helper(0)).toBe(false);
    expect(f.record(0)).toBe(true);
    expect(f.helper(0)).toBe(true);
    expect(f.record(0)).toBe(false); // only once
    expect(f.falls(1)).toBe(1);
    f.reset();
    expect(f.falls(0)).toBe(0);
  });

  it('every helper path starts at its checkpoint and ends near the next one', () => {
    for (const row of AREAS) for (const L of row) {
      const cps = L.pieces.checkpoints ?? [];
      cps.forEach((c, i) => {
        if (!c.ferry) return;
        expect(c.ferry.length, `${L.name} cp ${i}`).toBeGreaterThanOrEqual(2);
        expect(Math.abs(c.ferry[0].x - c.x), `${L.name} cp ${i} start`).toBeLessThan(420);
        const end = c.ferry[c.ferry.length - 1];
        const next = cps[i + 1];
        const goal = next ?? c;
        if (next) expect(Math.hypot(end.x - goal.x, end.y - goal.y), `${L.name} cp ${i} end`).toBeLessThan(1200);
      });
    }
  });
});

describe('v4 tools in the store', () => {
  it('sells Grip Hooves, Cloud Boots and Feather Cape at the design prices and camps', () => {
    expect(storeItem('gripHooves')).toMatchObject({ price: 90, litCamp: 2 });
    expect(storeItem('cloudBoots')).toMatchObject({ price: 130, litCamp: 3 });
    expect(storeItem('featherCape')).toMatchObject({ price: 140, litCamp: 4 });
    // the "More tools" tab holds 6 cards
    expect(STORE_ITEMS.slice(6).map((s) => s.id)).toEqual(['gemMagnet', 'silverBell', 'trailMap', 'gripHooves', 'cloudBoots', 'featherCape']);
  });

  it('buys them once the camp is lit, saves them and sanitises junk', () => {
    fresh();
    session.earn(500);
    expect(session.buy('gripHooves')).toBe('locked');
    session.p.zones[1].delivered = true;
    expect(session.buy('gripHooves')).toBe('ok');
    expect(session.buy('gripHooves')).toBe('owned');
    expect(session.buy('cloudBoots')).toBe('locked');
    session.p.zones[2].delivered = true;
    session.p.zones[3].delivered = true;
    expect(session.buy('cloudBoots')).toBe('ok');
    expect(session.buy('featherCape')).toBe('ok');
    expect(session.purse).toBe(500 - 90 - 130 - 140);
    const id = session.p.id;
    reloadSave();
    const q = save.profiles.find((x) => x.id === id)!;
    expect(q.tools).toEqual(['gripHooves', 'cloudBoots', 'featherCape']);
    const f = parseSave(JSON.stringify({ version: 2, profiles: [{ ...q, tools: ['featherCape', 'jetpack', 'featherCape', 7] }], lastProfileId: id, muted: false }));
    expect(f.profiles[0].tools).toEqual(['featherCape']);
  });
});

describe('odd jobs at Marlow\'s', () => {
  it('rotate through the kids\' mini games (never Frost Lock alone) and Dad Lab for Dad', () => {
    const seen = new Set(Array.from({ length: 14 }, (_, i) => oddJobGame(i, false)));
    expect(seen.size).toBe(ODD_JOB_GAMES.length);
    expect(seen.has('frostLock')).toBe(false);
    expect(seen.has('dadLab')).toBe(false);
    expect(oddJobGame(3, true)).toBe('dadLab');
    expect(oddJobGame(-1, false)).toBe(ODD_JOB_GAMES[ODD_JOB_GAMES.length - 1]);
  });

  it('pay +2 per first-try round plus +4 for finishing, record answers, never open a present', () => {
    const p = fresh();
    session.recordAnswer('money', true);
    session.recordAnswer('money', false);
    session.recordAnswer('money', true);
    session.finishOddJob();
    expect(session.purse).toBe(2 * EARN.round + ODD_JOB_PAY);
    expect(p.stats.answered).toBe(3);
    expect(p.zones.every((z) => z.presents.every((x) => !x))).toBe(true);
    for (let i = 0; i < 50; i++) session.finishOddJob(); // unlimited
    expect(session.purse).toBe(2 * EARN.round + 51 * ODD_JOB_PAY);
  });
});

describe('loose gems respawn', () => {
  it('come back about 3 minutes after their saved pickup time, across save and reload (fake clock)', () => {
    expect(LOOSE_RESPAWN_MS).toBe(3 * 60 * 1000);
    const p = fresh();
    const t = 5_000_000;
    session.takeLoose(2, 1, 4, t);
    session.takeLoose(2, 1, 5, t + 60_000);
    expect(session.looseAvailable(2, 1, 4, t + LOOSE_RESPAWN_MS - 1)).toBe(false);
    persist();
    reloadSave();
    session.select(p.id);
    expect(session.looseAvailable(2, 1, 4, t + LOOSE_RESPAWN_MS - 1)).toBe(false);
    expect(session.looseAvailable(2, 1, 4, t + LOOSE_RESPAWN_MS)).toBe(true);
    expect(session.looseAvailable(2, 1, 5, t + LOOSE_RESPAWN_MS)).toBe(false);
    expect(session.looseAvailable(2, 1, 5, t + 60_000 + LOOSE_RESPAWN_MS)).toBe(true);
    // taking it again restarts its own clock
    session.takeLoose(2, 1, 4, t + LOOSE_RESPAWN_MS);
    expect(session.looseAvailable(2, 1, 4, t + LOOSE_RESPAWN_MS + 1000)).toBe(false);
    // the debug respawn clock ages every pickup of the camp
    session.ageLoose(2, LOOSE_RESPAWN_MS);
    expect(session.looseAvailable(2, 1, 4, Date.now())).toBe(true);
  });
});

// ---------- purchase order / no soft-lock on gems ----------

const GATE_TOOL: Record<Gate, ToolId> = { high: 'springHooves', ice: 'iceChisel', dark: 'glowLantern' };

/** Tools a child must own to light camp z: Trail presents need none; the 2 more come from side area A or B (cheapest). */
function toolsToLight(z: number): ToolId[][] {
  // lanterns: Trail 2 + one side area's 2 = 4 = LANTERNS_TO_LIGHT
  expect(2 * PRESENTS_PER_AREA).toBe(LANTERNS_TO_LIGHT);
  return [1, 2].map((a) => DOOR_GATES[z][a - 1].map((g) => GATE_TOOL[g]));
}

describe('purchase order: lighting a camp never needs a tool that is not on sale yet', () => {
  for (let z = 0; z < NUM_ZONES; z++) {
    it(`camp ${z + 1}`, () => {
      // when camp z is first entered, camps 0..z-1 are lit
      const lit = Array.from({ length: NUM_ZONES }, (_, i) => i < z);
      const [a, b] = toolsToLight(z);
      // side area A is the designed route: its tools must already be for sale
      for (const t of a) expect(campLit(lit, storeItem(t).litCamp), `camp ${z + 1}: ${t} on sale`).toBe(true);
      // and no v4 tool is ever a gate
      for (const t of [...a, ...b]) expect(['gripHooves', 'cloudBoots', 'featherCape']).not.toContain(t);
      // the Trail + area A presents are reachable without tools (tests/zones.test.ts checks the jumps)
      expect(AREAS[z][0].presents.length + AREAS[z][1].presents.length).toBe(LANTERNS_TO_LIGHT);
    });
  }

  it('a broke child (0 gems, every loose gem just taken, every ungated present open, no tools) can always earn the next tool', () => {
    for (let z = 0; z < NUM_ZONES; z++) {
      setStorage(new MemStorage());
      reloadSave();
      const p = fresh();
      for (let i = 0; i < z; i++) p.zones[i].delivered = true;
      p.unlockedZone = z;
      const now = Date.now();
      for (let area = 0; area < 3; area++) AREAS[z][area].loose.forEach((_, i) => session.takeLoose(z, area, i, now));
      p.purse = 0;
      // ungated presents: the Trail's
      p.zones[z].presents[0] = p.zones[z].presents[1] = true;
      p.tools = [];
      expect(session.purse).toBe(0);
      expect(session.canLight(z)).toBe(false);
      const need = toolsToLight(z)[0];
      const price = need.reduce((s, t) => s + storeItem(t).price, 0);
      // odd jobs are always there; even with every answer missed each pays ODD_JOB_PAY
      let jobs = 0;
      while (!session.canAfford(price) && jobs < 100) {
        session.finishOddJob();
        jobs++;
      }
      expect(session.canAfford(price), `camp ${z + 1}: afford ${need.join('+') || 'nothing'}`).toBe(true);
      expect(jobs).toBeLessThanOrEqual(Math.ceil(70 / ODD_JOB_PAY));
      for (const t of need) expect(session.buy(t), `camp ${z + 1}: buy ${t}`).toBe('ok');
    }
  });
});
