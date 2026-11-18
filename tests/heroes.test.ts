import { beforeEach, describe, expect, it } from 'vitest';
import { HERO_IDS } from '../src/art/keys';
import { completedPresents, heroRemaining, heroRequirement, heroUnlocked, unlockedHeroes } from '../src/core/heroes';
import { createProfile, parseSave, persist, save, setStorage } from '../src/core/save';
import { session } from '../src/core/session';
import {
  CROSSFADE_S,
  FALLBACK_TRACK,
  PlaceCache,
  campPlace,
  candidateTracks,
  isFallbackList,
  needsSwitch,
  nextIndex,
  playlistFor,
} from '../src/core/musicPlaylist';
import { ZONE_PRESENTS } from '../src/types';
import type { MiniGameId } from '../src/types';

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

/** Indices (zone, slot) of presents of one mini game, in camp order. */
function slotsOf(game: MiniGameId) {
  const out: [number, number][] = [];
  ZONE_PRESENTS.forEach((g, z) => g.forEach((id, i) => id === game && out.push([z, i])));
  return out;
}

beforeEach(() => {
  setStorage(new MemStorage());
  save.profiles = [];
  save.lastProfileId = null;
});

function fresh(opts: { dadMode?: boolean } = {}) {
  const p = createProfile('Tester', 2, 0, opts)!;
  session.select(p.id);
  return p;
}

describe('zone data supports the unlock rules', () => {
  it('has at least 2 presents of each unlock game, one of each reachable by camp 2', () => {
    for (const g of ['trailFriend', 'coinShop', 'clockTower'] as MiniGameId[]) {
      const s = slotsOf(g);
      expect(s.length).toBeGreaterThanOrEqual(2);
      expect(s.some(([z]) => z <= 1)).toBe(true);
    }
  });
});

describe('hero unlock derivation', () => {
  it('starts with Juniper only', () => {
    const p = fresh();
    expect(unlockedHeroes(p)).toEqual(['juniper']);
    expect(heroRemaining(p, 'pip')).toBe(2);
    expect(heroRequirement(p, 'pip')).toBe('Help Pip with 2 more story presents');
  });

  it.each([
    ['pip', 'trailFriend', 'story'],
    ['marlow', 'coinShop', 'coin shop'],
    ['odette', 'clockTower', 'clock tower'],
  ] as const)('%s unlocks after 2 %s presents (0 / 1 / 2)', (hero, game, label) => {
    const p = fresh();
    const s = slotsOf(game);
    expect(heroUnlocked(p, hero)).toBe(false);
    p.zones[s[0][0]].presents[s[0][1]] = true;
    expect(completedPresents(p, game)).toBe(1);
    expect(heroUnlocked(p, hero)).toBe(false);
    expect(heroRequirement(p, hero)).toBe(`Help ${hero[0].toUpperCase() + hero.slice(1)} with 1 more ${label} present`);
    p.zones[s[1][0]].presents[s[1][1]] = true;
    expect(heroUnlocked(p, hero)).toBe(true);
    expect(heroRequirement(p, hero)).toBe('');
    // other mini games do not count
    expect(unlockedHeroes(p)).toContain(hero);
  });

  it('other present types do not unlock a hero', () => {
    const p = fresh();
    ZONE_PRESENTS.forEach((g, z) => g.forEach((id, i) => id === 'gemSort' && (p.zones[z].presents[i] = true)));
    expect(unlockedHeroes(p)).toEqual(['juniper']);
  });

  it('Bluster needs the Summit lit or the finale seen', () => {
    const p = fresh();
    expect(heroUnlocked(p, 'bluster')).toBe(false);
    p.zones[3].delivered = true;
    expect(heroUnlocked(p, 'bluster')).toBe(false);
    p.zones[4].delivered = true;
    expect(heroUnlocked(p, 'bluster')).toBe(true);
    p.zones[4].delivered = false;
    p.finished = true;
    expect(heroUnlocked(p, 'bluster')).toBe(true);
  });

  it('Dad mode counts presents by the slot original mini game', () => {
    const p = fresh({ dadMode: true });
    const s = slotsOf('clockTower');
    s.slice(0, 2).forEach(([z, i]) => (p.zones[z].presents[i] = true));
    expect(p.dadMode).toBe(true);
    expect(heroUnlocked(p, 'odette')).toBe(true);
    expect(heroUnlocked(p, 'pip')).toBe(false);
  });

  it('session.setHero respects the unlock unless forced', () => {
    const p = fresh();
    expect(session.setHero('pip')).toBe(false);
    expect(session.hero).toBe('juniper');
    expect(session.setHero('pip', true)).toBe(true);
    expect(p.hero).toBe('pip');
    expect(session.pendingHeroToasts()).toEqual([]);
  });

  it('pending toasts are announced once', () => {
    const p = fresh();
    slotsOf('trailFriend').slice(0, 2).forEach(([z, i]) => (p.zones[z].presents[i] = true));
    expect(session.pendingHeroToasts()).toEqual(['pip']);
    session.markHeroToast('pip');
    expect(session.pendingHeroToasts()).toEqual([]);
    persist();
    const again = parseSave(JSON.stringify(save));
    expect(again.profiles[0].heroToasts).toEqual(['pip']);
  });
});

describe('save: hero, follower and toasts', () => {
  const base = (over: Record<string, unknown> = {}) =>
    JSON.stringify({ version: 2, profiles: [{ id: 'a', name: 'A', grade: 1, ...over }], lastProfileId: 'a', muted: false });

  it('old profiles migrate to Juniper, no follower, no toasts', () => {
    const p = parseSave(base()).profiles[0];
    expect(p.hero).toBe('juniper');
    expect(p.follower).toBe(-1);
    expect(p.heroToasts).toEqual([]);
  });

  it('garbage hero values become Juniper', () => {
    for (const bad of ['dragon', 7, null, {}, ['pip']]) expect(parseSave(base({ hero: bad })).profiles[0].hero).toBe('juniper');
  });

  it('a hero that is not unlocked falls back to Juniper; an unlocked one is kept', () => {
    expect(parseSave(base({ hero: 'pip' })).profiles[0].hero).toBe('juniper');
    expect(parseSave(base({ hero: 'bluster', finished: true })).profiles[0].hero).toBe('bluster');
    const z = Array.from({ length: 5 }, () => ({ gems: [], presents: [false, false, false, false, false, false], delivered: false }));
    for (const [zi, i] of slotsOf('trailFriend').slice(0, 2)) z[zi].presents[i] = true;
    expect(parseSave(base({ hero: 'pip', purse: 0, zones: z })).profiles[0].hero).toBe('pip');
  });

  it('follower must be a befriended kind in range', () => {
    const fl = Array.from({ length: 10 }, (_, i) => i === 3);
    expect(parseSave(base({ follower: 3, flurries: fl })).profiles[0].follower).toBe(3);
    expect(parseSave(base({ follower: 4, flurries: fl })).profiles[0].follower).toBe(-1);
    expect(parseSave(base({ follower: 99, flurries: fl })).profiles[0].follower).toBe(-1);
    expect(parseSave(base({ follower: 'x', flurries: fl })).profiles[0].follower).toBe(-1);
    expect(parseSave(base({ follower: 3 })).profiles[0].follower).toBe(-1);
  });

  it('toasts keep only known heroes, once each', () => {
    const t = parseSave(base({ heroToasts: ['pip', 'pip', 'nobody', 5, 'odette'] })).profiles[0].heroToasts;
    expect(t).toEqual(['pip', 'odette']);
  });

  it('round-trips through persist', () => {
    const p = fresh();
    p.flurries[2] = true;
    session.setFollower(2);
    expect(session.setFollower(5)).toBe(false);
    persist();
    const back = parseSave(JSON.stringify(save)).profiles[0];
    expect(back.follower).toBe(2);
    expect(HERO_IDS).toContain(back.hero);
  });
});

describe('music playlist logic', () => {
  const none = () => undefined;
  const missing = () => false;

  it('names the files of each place', () => {
    expect(candidateTracks('camp3')).toEqual(['music_camp3']);
    expect(candidateTracks('menu', true)).toEqual(['music_menu', 'music_menub']);
    expect(campPlace(0)).toBe('camp1');
    expect(campPlace(4)).toBe('camp5');
    expect(campPlace(9)).toBe('camp5');
  });

  it('plays the place file, then falls back to music.mp3, then to the synth (empty list)', () => {
    expect(playlistFor('camp1', none)).toEqual(['music_camp1']);
    expect(playlistFor('camp1', (n) => n !== 'music_camp1')).toEqual([FALLBACK_TRACK]);
    expect(playlistFor('camp1', missing)).toEqual([]);
  });

  it('second parts are skipped silently when missing, kept in order when present', () => {
    expect(playlistFor('shop', none, true)).toEqual(['music_shop', 'music_shopb']);
    expect(playlistFor('shop', (n) => n !== 'music_shopb', true)).toEqual(['music_shop']);
    expect(playlistFor('shop', (n) => n !== 'music_shop', true)).toEqual(['music_shopb']);
  });

  it('the playlist loops', () => {
    expect(nextIndex(0, 2)).toBe(1);
    expect(nextIndex(1, 2)).toBe(0);
    expect(nextIndex(0, 1)).toBe(0);
    expect(CROSSFADE_S).toBeCloseTo(1.5);
  });

  it('does not restart for the same music', () => {
    expect(needsSwitch(null, ['music_camp1'])).toBe(true);
    expect(needsSwitch(['music_camp1'], ['music_camp1'])).toBe(false);
    expect(needsSwitch(['music_camp1'], ['music_camp2'])).toBe(true);
    // two places that both use the fallback file: no restart either
    const a = playlistFor('camp1', (n) => n === FALLBACK_TRACK);
    expect(isFallbackList([FALLBACK_TRACK])).toBe(true);
    expect(needsSwitch([FALLBACK_TRACK], [FALLBACK_TRACK])).toBe(false);
    expect(a).toEqual([FALLBACK_TRACK]);
  });

  it('keeps at most 2 places decoded, releasing the least recently used', () => {
    const c = new PlaceCache();
    expect(c.touch('menu')).toEqual([]);
    expect(c.touch('camp1')).toEqual([]);
    expect(c.touch('camp2')).toEqual(['menu']);
    expect(c.touch('camp1')).toEqual([]); // re-touch: camp1 is now the most recent
    expect(c.touch('shop')).toEqual(['camp2']);
    expect(c.places().sort()).toEqual(['camp1', 'shop']);
    expect(c.touch('shop', ['camp1'])).toEqual([]);
  });
});
