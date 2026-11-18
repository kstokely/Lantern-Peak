// Playable heroes: which are unlocked is DERIVED from progress (saved present flags + the zone layout data
// in ZONE_PRESENTS), never stored. Pure functions: no Phaser, used by the Wardrobe, the World and the tests.
import { HERO_IDS, HERO_NAMES, HeroId } from '../art/keys';
import { MiniGameId, Profile, ZONE_PRESENTS } from '../types';

/** What it takes to play as each friend. Juniper is always available; Bluster needs the Summit. */
export const HERO_UNLOCK: Record<HeroId, { game?: MiniGameId; need: number; label: string; short?: string }> = {
  juniper: { need: 0, label: '' },
  pip: { game: 'trailFriend', need: 2, label: 'story' },
  marlow: { game: 'coinShop', need: 2, label: 'coin shop', short: 'coin' },
  odette: { game: 'clockTower', need: 2, label: 'clock tower', short: 'clock' },
  bluster: { need: 1, label: 'Summit' },
};

type Progress = Pick<Profile, 'zones' | 'finished'>;

/** Presents of a mini game the profile has completed (Dad mode counts the slot's original game). */
export function completedPresents(p: Pick<Profile, 'zones'>, game: MiniGameId): number {
  let n = 0;
  ZONE_PRESENTS.forEach((games, z) => {
    games.forEach((g, i) => {
      if (g === game && p.zones[z]?.presents[i]) n++;
    });
  });
  return n;
}

export function summitDone(p: Progress): boolean {
  return p.finished === true || p.zones[4]?.delivered === true;
}

export function heroUnlocked(p: Progress, hero: HeroId): boolean {
  if (hero === 'juniper') return true;
  if (hero === 'bluster') return summitDone(p);
  const u = HERO_UNLOCK[hero];
  return completedPresents(p, u.game!) >= u.need;
}

export function unlockedHeroes(p: Progress): HeroId[] {
  return HERO_IDS.filter((h) => heroUnlocked(p, h));
}

/** Presents still to complete (Bluster: 1 until the Summit is lit). */
export function heroRemaining(p: Progress, hero: HeroId): number {
  if (hero === 'juniper') return 0;
  if (hero === 'bluster') return summitDone(p) ? 0 : 1;
  const u = HERO_UNLOCK[hero];
  return Math.max(0, u.need - completedPresents(p, u.game!));
}

/** Text for a locked hero card, e.g. "Help Pip with 1 more story present". */
export function heroRequirement(p: Progress, hero: HeroId): string {
  const r = heroRemaining(p, hero);
  if (r <= 0) return '';
  if (hero === 'bluster') return 'Light the Summit camp';
  return `Help ${HERO_NAMES[hero]} with ${r} more ${HERO_UNLOCK[hero].label} present${r === 1 ? '' : 's'}`;
}

/** Shorter text for a narrow locked card (the card already shows the name). */
export function heroRequirementShort(p: Progress, hero: HeroId): string {
  const r = heroRemaining(p, hero);
  if (r <= 0) return '';
  if (hero === 'bluster') return 'Light the Summit camp';
  return `Help with ${r} more ${HERO_UNLOCK[hero].short ?? HERO_UNLOCK[hero].label} present${r === 1 ? '' : 's'}`;
}

export const heroUnlockToast = (hero: HeroId) => `You helped ${HERO_NAMES[hero]}! You can now play as ${HERO_NAMES[hero]}.`;
