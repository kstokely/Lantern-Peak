import { beforeEach, describe, expect, it } from 'vitest';
import {
  MIGRATE_CAMP_CREDIT,
  MIGRATE_GEM_CREDIT,
  SAVE_KEY,
  createProfile,
  parseSave,
  persist,
  reloadSave,
  save,
  setStorage,
} from '../src/core/save';
import { EARN, LOOSE_RESPAWN_MS, session } from '../src/core/session';
import { LANTERNS_TO_LIGHT, NUM_FLURRIES, NUM_ZONES, PRESENTS_PER_ZONE } from '../src/types';

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

const v1Profile = (over: Record<string, unknown> = {}) => ({
  id: 'pOld',
  name: 'Ada',
  grade: 2,
  scarf: 3,
  strands: { counting: { level: 5, streak: 1, misses: 0 } },
  zones: [
    { gems: [true, true, false, true, false, false], presents: [true, true, true, true], delivered: true },
    { gems: [true, false, false, false, false, false], presents: [true, false, true, false], delivered: false },
  ],
  unlockedZone: 1,
  finished: false,
  stats: { answered: 40, firstTry: 30 },
  createdAt: 1700000000000,
  ...over,
});

let mem: MemStorage;
beforeEach(() => {
  mem = new MemStorage();
  setStorage(mem);
  reloadSave();
  session.clear();
});

describe('save v2 migration', () => {
  it('migrates a v1 file without losing progress', () => {
    const f = parseSave(JSON.stringify({ version: 1, profiles: [v1Profile()], lastProfileId: 'pOld', muted: true }));
    expect(f.version).toBe(2);
    expect(f.muted).toBe(true);
    expect(f.lastProfileId).toBe('pOld');
    const p = f.profiles[0];
    expect(p.name).toBe('Ada');
    expect(p.strands.counting.level).toBe(5);
    expect(p.zones).toHaveLength(NUM_ZONES);
    // old 4 presents -> new slots 0..3 of 6; delivered stays delivered
    expect(p.zones[0].presents).toEqual([true, true, true, true, false, false]);
    expect(p.zones[0].delivered).toBe(true);
    expect(p.zones[1].presents).toEqual([true, false, true, false, false, false]);
    expect(p.zones[1].delivered).toBe(false);
    expect(p.zones[0].gems).toEqual([true, true, false, true, false, false]);
    for (const z of p.zones) {
      expect(z.presents).toHaveLength(PRESENTS_PER_ZONE);
      expect(z.loose).toHaveLength(3);
      expect(z.iceBroken).toHaveLength(3);
    }
    // lantern count preserved, so a lit camp still has >= 4
    expect(p.zones[0].presents.filter(Boolean).length).toBeGreaterThanOrEqual(LANTERNS_TO_LIGHT);
    // credited purse: 4 frost gems * 5 + 1 camp * 20
    expect(p.purse).toBe(4 * MIGRATE_GEM_CREDIT + 1 * MIGRATE_CAMP_CREDIT);
    expect(p.tools).toEqual([]);
    expect(p.cocoa).toBe(0);
    expect(p.hat).toBe(-1);
    expect(p.flurries).toEqual(Array(NUM_FLURRIES).fill(false));
  });

  it('detects a v1-shaped profile even without a version field', () => {
    const f = parseSave(JSON.stringify({ profiles: [v1Profile()] }));
    expect(f.profiles[0].zones[0].presents).toEqual([true, true, true, true, false, false]);
    expect(f.profiles[0].purse).toBe(40);
  });

  it('does not migrate (or credit) twice after a save round trip', () => {
    mem.setItem(SAVE_KEY, JSON.stringify({ version: 1, profiles: [v1Profile()], lastProfileId: 'pOld', muted: false }));
    reloadSave();
    expect(save.profiles[0].purse).toBe(40);
    persist();
    reloadSave();
    expect(save.profiles[0].purse).toBe(40);
    expect(save.profiles[0].zones[0].presents).toEqual([true, true, true, true, false, false]);
    expect(JSON.parse(mem.getItem(SAVE_KEY)!).version).toBe(2);
  });

  it('sanitises a corrupted v2 file', () => {
    const bad = {
      version: 2,
      profiles: [
        {
          id: 'x',
          purse: -50,
          tools: ['springHooves', 'springHooves', 'rocketBoots', 7, 'cocoa'],
          cocoa: 99,
          hats: [1, 1, 9, -1, 'a', 2],
          hat: 4,
          flurries: [true, 'yes', true],
          zones: [{ presents: [true, true, true, true, true, true, true], loose: [[5, 'x', -3], 'nope'], iceBroken: [false, true] }],
        },
        null,
        { name: 'no id' },
      ],
    };
    const f = parseSave(JSON.stringify(bad));
    expect(f.profiles).toHaveLength(1);
    const p = f.profiles[0];
    expect(p.purse).toBe(0);
    expect(p.tools).toEqual(['springHooves']);
    expect(p.cocoa).toBe(3);
    expect(p.hats).toEqual([1, 2]);
    expect(p.hat).toBe(-1); // hat 4 not owned
    expect(p.flurries.slice(0, 3)).toEqual([true, false, true]);
    expect(p.zones[0].presents).toHaveLength(6);
    expect(p.zones[0].loose[0]).toEqual([5, 0, 0]);
    expect(p.zones[0].loose[1]).toEqual([]);
    expect(p.zones[0].iceBroken).toEqual([false, true, false]);
  });

  it('survives garbage', () => {
    expect(parseSave('{not json').profiles).toEqual([]);
    expect(parseSave('[1,2]').profiles).toEqual([]);
    expect(parseSave(null).version).toBe(2);
  });
});

describe('purse and store', () => {
  const fresh = () => {
    const p = createProfile('Tess', 1, 0)!;
    session.select(p.id);
    return p;
  };

  it('earns, spends and never goes negative', () => {
    const p = fresh();
    expect(session.purse).toBe(0);
    session.earn(12);
    expect(session.purse).toBe(12);
    expect(session.canAfford(12)).toBe(true);
    expect(session.canAfford(13)).toBe(false);
    expect(session.spend(13)).toBe(false);
    expect(session.purse).toBe(12);
    expect(session.spend(5)).toBe(true);
    expect(p.purse).toBe(7);
    session.earn(-10);
    expect(session.purse).toBe(7);
  });

  it('pays the design amounts', () => {
    fresh();
    session.takeLoose(0, 0, 3);
    expect(session.purse).toBe(EARN.loose);
    session.collectGem(0, 2);
    session.collectGem(0, 2); // twice does not pay twice
    expect(session.purse).toBe(EARN.loose + EARN.frost);
    session.recordAnswer('counting', true);
    session.recordAnswer('counting', false);
    expect(session.purse).toBe(EARN.loose + EARN.frost + EARN.round);
    session.befriend(4);
    session.befriend(4);
    expect(session.befriended(4)).toBe(true);
    const before = session.purse;
    session.deliver(0);
    session.deliver(0);
    expect(session.purse).toBe(before + EARN.flurry * 0 + EARN.camp);
    expect(session.p.unlockedZone).toBe(1);
  });

  it('loose gems respawn slowly', () => {
    fresh();
    const t = 1_000_000;
    expect(session.looseAvailable(0, 1, 0, t)).toBe(true);
    session.takeLoose(0, 1, 0, t);
    expect(session.looseAvailable(0, 1, 0, t + 1000)).toBe(false);
    expect(session.looseAvailable(0, 1, 0, t + LOOSE_RESPAWN_MS)).toBe(true);
  });

  it('stocks items by lit camps and runs the buy flow', () => {
    fresh();
    const avail = () => session.stock().filter((s) => s.available).map((s) => s.item.id);
    expect(avail()).toEqual(['cocoa', 'springHooves', 'chimeBell']);
    expect(session.buy('springHooves')).toBe('poor');
    session.earn(100);
    expect(session.buy('glowLantern')).toBe('locked');
    expect(session.buy('springHooves')).toBe('ok');
    expect(session.purse).toBe(60);
    expect(session.has('springHooves')).toBe(true);
    expect(session.buy('springHooves')).toBe('owned');
    expect(session.purse).toBe(60);
    // cocoa is a consumable with a cap of 3
    expect(session.buy('cocoa')).toBe('ok');
    expect(session.buy('cocoa')).toBe('ok');
    expect(session.buy('cocoa')).toBe('ok');
    expect(session.buy('cocoa')).toBe('full');
    expect(session.cocoa).toBe(3);
    expect(session.purse).toBe(15);
    expect(session.useCocoa()).toBe(true);
    expect(session.cocoa).toBe(2);
    session.p.zones[1].delivered = true;
    expect(avail()).toEqual(['cocoa', 'springHooves', 'chimeBell', 'glowLantern', 'iceChisel', 'gripHooves']);
    session.p.zones[2].delivered = true;
    session.p.zones[3].delivered = true;
    expect(avail()).toHaveLength(12); // v4: Grip Hooves, Cloud Boots and Feather Cape joined the stock
  });

  it('buys and wears hats', () => {
    fresh();
    session.earn(30);
    expect(session.buyHat(2)).toBe('locked');
    expect(session.buyHat(0)).toBe('ok');
    expect(session.p.hat).toBe(0);
    session.wearHat(-1);
    expect(session.p.hat).toBe(-1);
    session.wearHat(1); // not owned
    expect(session.p.hat).toBe(-1);
    expect(session.buyHat(1)).toBe('poor');
  });

  it('persists to storage and reloads', () => {
    const p = fresh();
    session.earn(42);
    session.grant('chimeBell');
    reloadSave();
    const q = save.profiles.find((x) => x.id === p.id)!;
    expect(q.purse).toBe(42);
    expect(q.tools).toEqual(['chimeBell']);
  });
});

describe('first visit to a side area', () => {
  it('plays once ever per area and survives a reload', () => {
    const p = createProfile('Kit', 1, 0)!;
    session.select(p.id);
    expect(session.markSeen(0, 1)).toBe(true);
    expect(session.markSeen(0, 1)).toBe(false);
    expect(session.markSeen(0, 2)).toBe(true);
    expect(session.markSeen(0, 0)).toBe(false); // the Trail has no first-visit line
    reloadSave();
    expect(session.p.zones[0].seen).toEqual([false, true, true]);
    expect(session.markSeen(0, 1)).toBe(false);
    expect(session.markSeen(3, 1)).toBe(true);
  });
});
