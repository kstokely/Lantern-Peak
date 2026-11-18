// The current player's session: profile selection, answer recording, collection, delivery,
// and the v2 economy (gem purse, store, tools, Flurries, hats).
import {
  AREAS_PER_ZONE,
  LANTERNS_TO_LIGHT,
  MAX_COCOA,
  NUM_ZONES,
  PRESENTS_PER_AREA,
  PRESENTS_PER_ZONE,
  MiniGameId,
  Profile,
  STRANDS,
  Strand,
} from '../types';
import { HERO_IDS, HeroId } from '../art/keys';
import type { ToolId } from '../art/keys';
import { heroUnlocked, unlockedHeroes } from './heroes';
import { effectiveDadLevel, effectiveLevel, recordDadResult, recordResult } from '../math/adaptive';
import { getProfile, MAX_PURSE, persist, save } from './save';
import { HAT_ITEMS, STORE_ITEMS, StoreItem, campLit, storeItem } from './store';

/** Gems earned per thing (design.md "Gems are money"). */
export const EARN = { loose: 1, frost: 5, round: 2, flurry: 10, camp: 20 } as const;
/** A picked-up loose gem comes back this long after its saved pickup time (checked when an area is built and on a slow timer). */
export const LOOSE_RESPAWN_MS = 3 * 60 * 1000;
/** Odd jobs at Marlow's: an unlimited way to earn gems. Paid on finishing, on top of EARN.round per first-try round. */
export const ODD_JOB_PAY = 4;
export const ODD_JOB_ROUNDS = 3;
/** Kids' mini games that odd jobs rotate through (never Frost Lock alone). */
export const ODD_JOB_GAMES: MiniGameId[] = ['coinShop', 'gemSort', 'clockTower', 'iceBridge', 'snowScale', 'pieShare', 'trailFriend'];

/** The mini game for odd job number n (Dad Lab for Dad-mode profiles). Pure. */
export function oddJobGame(n: number, dadMode: boolean): MiniGameId {
  if (dadMode) return 'dadLab';
  const k = ODD_JOB_GAMES.length;
  return ODD_JOB_GAMES[((Math.floor(n) % k) + k) % k];
}

export type BuyResult = 'ok' | 'poor' | 'owned' | 'locked' | 'full' | 'none';

export interface StockEntry {
  item: StoreItem;
  available: boolean;
  owned: boolean; // tools: owned; cocoa: flask full
  affordable: boolean;
}

class Session {
  private id: string | null = save.lastProfileId;
  /** Listeners told whenever the purse/tools/cocoa/hat change (HUD). */
  private listeners = new Set<() => void>();

  get profile(): Profile | undefined {
    return getProfile(this.id);
  }

  /** The current profile; throws if none (scenes past Profiles always have one). */
  get p(): Profile {
    const p = this.profile;
    if (!p) throw new Error('No profile selected');
    return p;
  }

  select(id: string) {
    this.id = id;
    save.lastProfileId = id;
    persist();
  }

  clear() {
    this.id = null;
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed() {
    persist();
    this.listeners.forEach((f) => {
      try {
        f();
      } catch {
        /* a listener from a stopped scene must never break the game */
      }
    });
  }

  /** Records one problem result. Returns the level change (-1, 0, 1). A first-try round earns EARN.round gems. */
  recordAnswer(strand: Strand, firstTry: boolean): -1 | 0 | 1 {
    const p = this.profile;
    if (!p) return 0;
    const { progress, change } = recordResult(p.strands[strand], firstTry, p.grade);
    p.strands[strand] = progress;
    p.stats.answered++;
    if (firstTry) {
      p.stats.firstTry++;
      p.purse = Math.min(MAX_PURSE, p.purse + EARN.round);
    }
    this.changed();
    return change;
  }

  // ---------- hidden Dad mode ----------

  /** True when the current profile is a Dad-mode profile (every mini game becomes Dad Lab). */
  get dadMode(): boolean {
    return this.profile?.dadMode === true;
  }

  /** Saved Dad level (1 when none). */
  dadLevel(): number {
    return this.profile?.dad?.level ?? 1;
  }

  /** Dad level inside a camp (zone offset added, no cap). */
  dadLevelIn(zone: number): number {
    return effectiveDadLevel(this.dadLevel(), zone);
  }

  /** Records one Dad Lab problem (+1 after 3 first-try rights, -1 after 2 missed problems). First try earns EARN.round. */
  recordDadAnswer(firstTry: boolean): -1 | 0 | 1 {
    const p = this.profile;
    if (!p) return 0;
    const { progress, change } = recordDadResult(p.dad ?? { level: 1, streak: 0, misses: 0 }, firstTry);
    p.dad = progress;
    p.stats.answered++;
    if (firstTry) {
      p.stats.firstTry++;
      p.purse = Math.min(MAX_PURSE, p.purse + EARN.round);
    }
    this.changed();
    return change;
  }

  strandLevel(strand: Strand): number {
    return this.profile?.strands[strand].level ?? 1;
  }

  /** Effective (zone-adjusted) level for one strand. */
  levelIn(strand: Strand, zone: number): number {
    return effectiveLevel(this.strandLevel(strand), zone);
  }

  levelsFor(zone: number): Record<Strand, number> {
    const out = {} as Record<Strand, number>;
    for (const s of STRANDS) out[s] = this.levelIn(s, zone);
    return out;
  }

  // ---------- purse ----------

  get purse() {
    return this.profile?.purse ?? 0;
  }

  /** Adds gems to the purse (n >= 0). Returns the new total. */
  earn(n: number): number {
    const p = this.profile;
    if (!p || !(n > 0)) return this.purse;
    p.purse = Math.min(MAX_PURSE, p.purse + Math.floor(n));
    this.changed();
    return p.purse;
  }

  canAfford(n: number) {
    return this.purse >= n;
  }

  /** Takes n gems if there are enough; never goes negative. */
  spend(n: number): boolean {
    const p = this.profile;
    if (!p || !(n >= 0) || p.purse < n) return false;
    p.purse -= Math.floor(n);
    this.changed();
    return true;
  }

  // ---------- collecting ----------

  collectGem(zone: number, i: number) {
    const p = this.profile;
    if (!p || p.zones[zone].gems[i]) return;
    p.zones[zone].gems[i] = true;
    p.purse = Math.min(MAX_PURSE, p.purse + EARN.frost);
    this.changed();
  }

  /** Loose gem `i` of `area` picked up now (+1). */
  takeLoose(zone: number, area: number, i: number, now = Date.now()) {
    const p = this.profile;
    if (!p) return;
    const arr = p.zones[zone].loose[area];
    while (arr.length <= i) arr.push(0);
    arr[i] = now;
    p.purse = Math.min(MAX_PURSE, p.purse + EARN.loose);
    this.changed();
  }

  /** True when loose gem `i` of `area` is there to pick up (never taken, or respawned). */
  looseAvailable(zone: number, area: number, i: number, now = Date.now()) {
    const t = this.profile?.zones[zone].loose[area]?.[i] ?? 0;
    return t === 0 || now - t >= LOOSE_RESPAWN_MS;
  }

  /** Odd jobs started this page load (rotation; not saved, so a reload starts the rotation afresh). */
  private oddJobs = Math.floor(Math.random() * ODD_JOB_GAMES.length);

  /** The mini game for the next odd job (advances the rotation). */
  nextOddJob(): MiniGameId {
    return oddJobGame(this.oddJobs++, this.dadMode);
  }

  /** An odd job was finished: pays ODD_JOB_PAY (rounds already paid EARN.round each). Never counts as a present. */
  finishOddJob(): number {
    return this.earn(ODD_JOB_PAY);
  }

  /** Debug: pretend ms have passed for every loose-gem pickup time of a camp (respawn clock). */
  ageLoose(zone: number, ms: number) {
    const p = this.profile;
    if (!p) return;
    for (const arr of p.zones[zone].loose) for (let i = 0; i < arr.length; i++) if (arr[i] > 0) arr[i] = Math.max(1, arr[i] - ms);
    persist();
  }

  openPresent(zone: number, i: number) {
    const p = this.profile;
    if (!p) return;
    p.zones[zone].presents[i] = true;
    this.changed();
  }

  gemCount(zone: number) {
    return this.profile?.zones[zone].gems.filter(Boolean).length ?? 0;
  }

  lanternCount(zone: number) {
    return this.profile?.zones[zone].presents.filter(Boolean).length ?? 0;
  }

  /** Enough lanterns to light the camp (any 4 of 6). */
  canLight(zone: number) {
    return this.lanternCount(zone) >= LANTERNS_TO_LIGHT;
  }

  /** @deprecated v1 name; same as canLight. */
  allLanterns(zone: number) {
    return this.canLight(zone);
  }

  goldStar(zone: number) {
    return this.lanternCount(zone) >= PRESENTS_PER_ZONE;
  }

  /** Presents still closed in one area. */
  presentsLeftIn(zone: number, area: number) {
    const pr = this.profile?.zones[zone].presents ?? [];
    let n = 0;
    for (let k = 0; k < PRESENTS_PER_AREA; k++) if (!pr[area * PRESENTS_PER_AREA + k]) n++;
    return n;
  }

  /** Marks the zone delivered (camp lit, +20 gems) and unlocks the next one. */
  deliver(zone: number) {
    const p = this.profile;
    if (!p) return;
    if (!p.zones[zone].delivered) p.purse = Math.min(MAX_PURSE, p.purse + EARN.camp);
    p.zones[zone].delivered = true;
    if (zone + 1 < NUM_ZONES) p.unlockedZone = Math.max(p.unlockedZone, zone + 1);
    this.changed();
  }

  finish() {
    const p = this.profile;
    if (!p) return;
    p.finished = true;
    persist();
  }

  /** First visit to a side area: true exactly once per profile and area (saved), then false forever. */
  markSeen(zone: number, area: number): boolean {
    const p = this.profile;
    if (!p || area < 1 || area >= AREAS_PER_ZONE) return false;
    const z = p.zones[zone];
    if (z.seen[area]) return false;
    z.seen[area] = true;
    persist();
    return true;
  }

  breakIce(zone: number, area: number) {
    const p = this.profile;
    if (!p || area < 0 || area >= AREAS_PER_ZONE) return;
    p.zones[zone].iceBroken[area] = true;
    persist();
  }

  // ---------- tools / store ----------

  has(tool: ToolId) {
    return !!this.profile?.tools.includes(tool);
  }

  get cocoa() {
    return this.profile?.cocoa ?? 0;
  }

  /** Uses one Cocoa Flask; false if there are none. */
  useCocoa(): boolean {
    const p = this.profile;
    if (!p || p.cocoa <= 0) return false;
    p.cocoa--;
    this.changed();
    return true;
  }

  private litFlags() {
    return this.profile?.zones.map((z) => z.delivered) ?? [];
  }

  isAvailable(litCamp: number) {
    return campLit(this.litFlags(), litCamp);
  }

  /** The store's stock with per-item state (all items; `available` false = locked until a camp is lit). */
  stock(): StockEntry[] {
    return STORE_ITEMS.map((item) => ({
      item,
      available: this.isAvailable(item.litCamp),
      owned: item.id === 'cocoa' ? this.cocoa >= MAX_COCOA : this.has(item.id),
      affordable: this.canAfford(item.price),
    }));
  }

  buy(id: ToolId): BuyResult {
    const p = this.profile;
    if (!p) return 'none';
    const item = storeItem(id);
    if (!item) return 'none';
    if (!this.isAvailable(item.litCamp)) return 'locked';
    if (id === 'cocoa') {
      if (p.cocoa >= MAX_COCOA) return 'full';
    } else if (p.tools.includes(id)) return 'owned';
    if (!this.spend(item.price)) return 'poor';
    if (id === 'cocoa') p.cocoa++;
    else p.tools.push(id);
    this.changed();
    return 'ok';
  }

  /** Gives a tool for free (debug). */
  grant(id: ToolId) {
    const p = this.profile;
    if (!p) return;
    if (id === 'cocoa') p.cocoa = Math.min(MAX_COCOA, p.cocoa + 1);
    else if (!p.tools.includes(id)) p.tools.push(id);
    this.changed();
  }

  buyHat(i: number): BuyResult {
    const p = this.profile;
    const h = HAT_ITEMS[i];
    if (!p || !h) return 'none';
    if (p.hats.includes(i)) return 'owned';
    if (!this.isAvailable(h.litCamp)) return 'locked';
    if (!this.spend(h.price)) return 'poor';
    p.hats.push(i);
    p.hats.sort((a, b) => a - b);
    p.hat = i;
    this.changed();
    return 'ok';
  }

  /** Wear hat i (must be owned) or -1 for none. */
  wearHat(i: number) {
    const p = this.profile;
    if (!p) return;
    p.hat = i >= 0 && p.hats.includes(i) ? i : -1;
    this.changed();
  }

  // ---------- Flurries ----------

  befriended(kind: number) {
    return !!this.profile?.flurries[kind];
  }

  /** Saves a new Flurry friend (+10 gems the first time). */
  befriend(kind: number) {
    const p = this.profile;
    if (!p || kind < 0 || kind >= p.flurries.length || p.flurries[kind]) return;
    p.flurries[kind] = true;
    p.purse = Math.min(MAX_PURSE, p.purse + EARN.flurry);
    this.changed();
  }

  // ---------- heroes and follower (v3) ----------

  /** The hero being played. */
  get hero(): HeroId {
    return this.profile?.hero ?? 'juniper';
  }

  get unlocked(): HeroId[] {
    return this.profile ? unlockedHeroes(this.profile) : ['juniper'];
  }

  /** Picks a hero if unlocked (or force = debug). */
  setHero(h: HeroId, force = false): boolean {
    const p = this.profile;
    if (!p || !(HERO_IDS as readonly string[]).includes(h)) return false;
    if (!force && !heroUnlocked(p, h)) return false;
    p.hero = h;
    this.changed();
    return true;
  }

  /** Heroes unlocked but not yet announced (the World shows a toast for each, once). */
  pendingHeroToasts(): HeroId[] {
    const p = this.profile;
    if (!p) return [];
    return unlockedHeroes(p).filter((h) => h !== 'juniper' && !p.heroToasts.includes(h));
  }

  markHeroToast(h: HeroId) {
    const p = this.profile;
    if (!p || p.heroToasts.includes(h)) return;
    p.heroToasts.push(h);
    persist();
  }

  /** The Flurry kind following the hero, or -1. */
  get follower(): number {
    const p = this.profile;
    return p && p.follower >= 0 && p.flurries[p.follower] ? p.follower : -1;
  }

  /** Chooses a befriended Flurry kind as follower (or -1 for none). */
  setFollower(kind: number, force = false): boolean {
    const p = this.profile;
    if (!p) return false;
    if (kind >= 0 && (kind >= p.flurries.length || (!p.flurries[kind] && !force))) return false;
    p.follower = kind >= 0 ? kind : -1;
    this.changed();
    return true;
  }

  setScarf(i: number) {
    const p = this.profile;
    if (!p) return;
    p.scarf = Math.max(0, Math.min(5, i | 0));
    this.changed();
  }

  friendCount() {
    return this.profile?.flurries.filter(Boolean).length ?? 0;
  }
}

export const session = new Session();
