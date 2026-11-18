// Save file in localStorage ('lanternPeak.v1' key, file version 2), validated on load,
// memory fallback if storage is blocked. Version-1 files (4 presents per camp, no purse)
// are migrated on load without losing progress.
import {
  AREAS_PER_ZONE,
  GEMS_PER_ZONE,
  GRADE_START_LEVEL,
  Grade,
  MAX_COCOA,
  MAX_LEVEL,
  MIN_LEVEL,
  NUM_FLURRIES,
  NUM_ZONES,
  PRESENTS_PER_ZONE,
  Profile,
  SaveFile,
  STRANDS,
  Strand,
  StrandProgress,
  ZoneProgress,
} from '../types';
import { HAT_COUNT, HERO_IDS, HeroId, TOOL_IDS } from '../art/keys';
import { heroUnlocked } from './heroes';
import { newStrandProgress } from '../math/adaptive';

export const SAVE_KEY = 'lanternPeak.v1';
export const SAVE_VERSION = 2;
export const MAX_PROFILES = 6;
export const MAX_NAME = 10;
/** Upper bounds used when sanitising. */
export const MAX_PURSE = 99999;
export const MAX_LOOSE_PER_AREA = 200;
/** Gems a v1 profile is credited on migration: per frost gem found and per camp lit. */
export const MIGRATE_GEM_CREDIT = 5;
export const MIGRATE_CAMP_CREDIT = 20;

/** Minimal Storage interface (window.localStorage or an in-memory stand-in for tests). */
export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

let memoryCopy: string | null = null;
let storageOverride: StorageLike | null = null;

function storage(): StorageLike | null {
  if (storageOverride) return storageOverride;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Use another storage (tests). Pass null to go back to localStorage. */
export function setStorage(s: StorageLike | null) {
  storageOverride = s;
  memoryCopy = null;
}

function readRaw(): string | null {
  try {
    const v = storage()?.getItem(SAVE_KEY);
    return v ?? memoryCopy;
  } catch {
    return memoryCopy;
  }
}

function writeRaw(s: string) {
  memoryCopy = s;
  try {
    storage()?.setItem(SAVE_KEY, s);
  } catch {
    /* storage blocked or full: keep the in-memory copy */
  }
}

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown, lo: number, hi: number, dflt: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt;
const boolArr = (v: unknown, n: number) => Array.from({ length: n }, (_, i) => Array.isArray(v) && v[i] === true);

function cleanGrade(v: unknown): Grade {
  return v === 1 || v === 2 || v === 3 || v === 4 ? v : 1;
}

function cleanStrand(v: unknown, grade: Grade): StrandProgress {
  const start = GRADE_START_LEVEL[grade];
  if (!isObj(v)) return { level: start, streak: 0, misses: 0 };
  return {
    level: int(v.level, MIN_LEVEL, MAX_LEVEL, start),
    streak: int(v.streak, 0, 99, 0),
    misses: int(v.misses, 0, 99, 0),
  };
}

function cleanLoose(v: unknown): number[][] {
  return Array.from({ length: AREAS_PER_ZONE }, (_, a) => {
    const arr = Array.isArray(v) && Array.isArray(v[a]) ? (v[a] as unknown[]) : [];
    return arr.slice(0, MAX_LOOSE_PER_AREA).map((t) => int(t, 0, 1e15, 0));
  });
}

export function emptyZone(): ZoneProgress {
  return {
    gems: boolArr(undefined, GEMS_PER_ZONE),
    presents: boolArr(undefined, PRESENTS_PER_ZONE),
    delivered: false,
    loose: cleanLoose(undefined),
    iceBroken: boolArr(undefined, AREAS_PER_ZONE),
    seen: boolArr(undefined, AREAS_PER_ZONE),
  };
}

/**
 * v1 zones had 4 presents (all on one trail) and 6 gems. The 4 old presents map onto new slots
 * 0..3 (the Trail's two and side area 1's two), so the lantern count is unchanged and a camp that
 * was lit (all 4) stays lit; slots 4..5 (side area 2) are new. Gems map index to index.
 */
export function migrateZoneV1(v: unknown): ZoneProgress {
  const o = isObj(v) ? v : {};
  const z = emptyZone();
  z.gems = boolArr(o.gems, GEMS_PER_ZONE);
  const old = boolArr(o.presents, 4);
  old.forEach((b, i) => (z.presents[i] = b));
  z.delivered = o.delivered === true;
  return z;
}

function cleanZone(v: unknown): ZoneProgress {
  const o = isObj(v) ? v : {};
  return {
    gems: boolArr(o.gems, GEMS_PER_ZONE),
    presents: boolArr(o.presents, PRESENTS_PER_ZONE),
    delivered: o.delivered === true,
    loose: cleanLoose(o.loose),
    iceBroken: boolArr(o.iceBroken, AREAS_PER_ZONE),
    seen: boolArr(o.seen, AREAS_PER_ZONE),
  };
}

const TOOL_SET = new Set<string>(TOOL_IDS.filter((t) => t !== 'cocoa'));

function cleanTools(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const t of v) if (typeof t === 'string' && TOOL_SET.has(t) && !out.includes(t)) out.push(t);
  return out;
}

function cleanHats(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (const h of v) if (Number.isInteger(h) && h >= 0 && h < HAT_COUNT && !out.includes(h)) out.push(h);
  return out.sort((a, b) => a - b);
}

function cleanToasts(v: unknown): HeroId[] {
  if (!Array.isArray(v)) return [];
  return HERO_IDS.filter((h) => v.includes(h));
}

function cleanProfile(v: unknown, fromV1: boolean): Profile | null {
  if (!isObj(v) || typeof v.id !== 'string' || !v.id) return null;
  const grade = cleanGrade(v.grade);
  const strands = {} as Record<Strand, StrandProgress>;
  for (const s of STRANDS) strands[s] = cleanStrand(isObj(v.strands) ? v.strands[s] : undefined, grade);
  // A profile is treated as v1 if the file says so, or if it has no purse and 4-present zones.
  const looksV1 = fromV1 || (v.purse === undefined && Array.isArray(v.zones) && v.zones.some((z: any) => isObj(z) && Array.isArray(z.presents) && z.presents.length === 4));
  const zones = Array.from({ length: NUM_ZONES }, (_, i) => {
    const raw = Array.isArray(v.zones) ? v.zones[i] : undefined;
    return looksV1 ? migrateZoneV1(raw) : cleanZone(raw);
  });
  const stats = isObj(v.stats) ? v.stats : {};
  const hats = cleanHats(v.hats);
  const hat = int(v.hat, -1, HAT_COUNT - 1, -1);
  let purse = int(v.purse, 0, MAX_PURSE, 0);
  if (looksV1) {
    const gems = zones.reduce((n, z) => n + z.gems.filter(Boolean).length, 0);
    const lit = zones.filter((z) => z.delivered).length;
    purse = Math.min(MAX_PURSE, purse + gems * MIGRATE_GEM_CREDIT + lit * MIGRATE_CAMP_CREDIT);
  }
  const out: Profile = {
    id: v.id,
    name: typeof v.name === 'string' && v.name.trim() ? v.name.slice(0, MAX_NAME) : 'Friend',
    grade,
    scarf: int(v.scarf, 0, 5, 0),
    strands,
    zones,
    unlockedZone: int(v.unlockedZone, 0, NUM_ZONES - 1, 0),
    finished: v.finished === true,
    stats: { answered: int(stats.answered, 0, 1e9, 0), firstTry: int(stats.firstTry, 0, 1e9, 0) },
    createdAt: int(v.createdAt, 0, 1e15, Date.now()),
    purse,
    tools: cleanTools(v.tools),
    cocoa: int(v.cocoa, 0, MAX_COCOA, 0),
    hats,
    hat: hats.includes(hat) ? hat : -1,
    flurries: boolArr(v.flurries, NUM_FLURRIES),
    hero: 'juniper',
    follower: -1,
    heroToasts: cleanToasts(v.heroToasts),
  };
  out.hero = typeof v.hero === 'string' && (HERO_IDS as readonly string[]).includes(v.hero) && heroUnlocked(out, v.hero as HeroId) ? (v.hero as HeroId) : 'juniper';
  const fol = int(v.follower, -1, NUM_FLURRIES - 1, -1);
  out.follower = fol >= 0 && out.flurries[fol] ? fol : -1;
  // hidden Dad mode: only an explicit `dadMode: true` turns it on (old saves never have it)
  if (v.dadMode === true) {
    out.dadMode = true;
    out.dad = cleanDad(v.dad);
  }
  return out;
}

/** Dad Lab progress: level 1.. (no game cap; bounded only against garbage), counters 0..99. */
export const MAX_DAD_LEVEL_SAVED = 9999;
function cleanDad(v: unknown): StrandProgress {
  if (!isObj(v)) return { level: 1, streak: 0, misses: 0 };
  return { level: int(v.level, 1, MAX_DAD_LEVEL_SAVED, 1), streak: int(v.streak, 0, 99, 0), misses: int(v.misses, 0, 99, 0) };
}

export function emptySave(): SaveFile {
  return { version: 2, profiles: [], lastProfileId: null, muted: false };
}

/** Parse + validate (+ migrate v1). Anything malformed falls back to safe defaults; never throws. */
export function parseSave(raw: string | null): SaveFile {
  if (!raw) return emptySave();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptySave();
  }
  if (!isObj(data)) return emptySave();
  const fromV1 = data.version === 1;
  const profiles = (Array.isArray(data.profiles) ? data.profiles : [])
    .map((p: unknown) => cleanProfile(p, fromV1))
    .filter((p: Profile | null): p is Profile => p !== null)
    .slice(0, MAX_PROFILES);
  const last = typeof data.lastProfileId === 'string' && profiles.some((p: Profile) => p.id === data.lastProfileId) ? data.lastProfileId : null;
  return { version: 2, profiles, lastProfileId: last, muted: data.muted === true };
}

/** The live save object. Mutate it, then call persist(). */
export const save: SaveFile = parseSave(readRaw());

export function persist() {
  writeRaw(JSON.stringify(save));
}

export function reloadSave() {
  const fresh = parseSave(readRaw());
  save.profiles = fresh.profiles;
  save.lastProfileId = fresh.lastProfileId;
  save.muted = fresh.muted;
}

function freshStrands(grade: Grade): Record<Strand, StrandProgress> {
  const out = {} as Record<Strand, StrandProgress>;
  for (const s of STRANDS) out[s] = { ...newStrandProgress(grade) };
  return out;
}

export function createProfile(name: string, grade: Grade, scarf: number, opts: { dadMode?: boolean } = {}): Profile | null {
  if (save.profiles.length >= MAX_PROFILES) return null;
  const clean = name.trim().slice(0, MAX_NAME) || 'Friend';
  const p: Profile = {
    id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: clean,
    grade,
    scarf: Math.max(0, Math.min(5, scarf | 0)),
    strands: freshStrands(grade),
    zones: Array.from({ length: NUM_ZONES }, () => emptyZone()),
    unlockedZone: 0,
    finished: false,
    stats: { answered: 0, firstTry: 0 },
    createdAt: Date.now(),
    purse: 0,
    tools: [],
    cocoa: 0,
    hats: [],
    hat: -1,
    flurries: boolArr(undefined, NUM_FLURRIES),
    hero: 'juniper',
    follower: -1,
    heroToasts: [],
  };
  if (opts.dadMode) {
    p.dadMode = true;
    p.dad = { level: 1, streak: 0, misses: 0 };
  }
  save.profiles.push(p);
  save.lastProfileId = p.id;
  persist();
  return p;
}

export function deleteProfile(id: string) {
  save.profiles = save.profiles.filter((p) => p.id !== id);
  if (save.lastProfileId === id) save.lastProfileId = null;
  persist();
}

export function getProfile(id: string | null): Profile | undefined {
  return id ? save.profiles.find((p) => p.id === id) : undefined;
}
