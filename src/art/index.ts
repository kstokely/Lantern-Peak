// Art entry point: builds every texture/animation in keys.ts and registers them with Phaser.
//
// Zone backgrounds are large (each zone is four 1280x960 layers + a 1280x320 ground tile,
// about 21 MB of RGBA), so they are NOT all created at boot. registerArt() creates every
// sprite/UI texture plus zone 0's backgrounds (Title and Profiles show them); scenes call
// ensureZoneArt(scene, zone[, area]) before using a zone's bgKey()/areaBgKey() textures and
// releaseZoneArt(scene, keep[, areas]) when they are entered, to drop the ones they don't show.
import type Phaser from 'phaser';
import type { AnimSpec, SheetSpec } from './draw';
import {
  BG_LAYERS, areaBgKey, flurrySilKey, FLURRY_KINDS, HeroId, HERO_IDS, SCARF_COLOURS, ANIM, heroKey, heroAnim, juniperKey,
} from './keys';
import { buildJuniper, juniperAnimSpecs, JUNIPER_ANIM_LAND } from './juniper';
import { buildHeroPortraits, buildHeroSheet, heroAnimSpecs } from './heroes';
import { buildItems } from './items';
import { buildFriends } from './friends';
import { buildUI } from './ui';
import { buildManipulatives } from './manipulatives';
import { buildBackgrounds, buildZoneLayer, ZONE_COUNT } from './backgrounds';
import { buildCountIcons } from './counting';
import { buildStore } from './store';
import { buildFlurries, flurrySilhouette } from './flurries';
import { buildPlaces } from './places';
import { buildAreaBackgrounds, buildAreaLayer, AREA_ZONES } from './areas';
import { buildPlatforms } from './platforms';

export { JUNIPER_FRAMES, JUNIPER_ANIM_LAND } from './juniper';
export { juniperHatAnchor, ANIM_LOOSE_GEM, ANIM_BELL_RING } from './store';
export { LODGE_SHELVES } from './places';
export { AREA_NAMES } from './areas';
export { drawCountIcon } from './counting';
export { drawFlurry, flurrySilhouette } from './flurries';
export { heroHatAnchor, drawHero, buildHeroSheet, heroAnimSpecs } from './heroes';
export { heroPortraitKey, heroKey, heroAnim } from './keys';

export interface ArtBundle {
  sheets: SheetSpec[];
  anims: AnimSpec[];
}

type Builder = () => { sheets: SheetSpec[]; anims?: AnimSpec[] };

const spriteBuilders: Builder[] = [
  buildJuniper, buildItems, buildFriends, buildUI, buildManipulatives,
  buildCountIcons, buildStore, buildFlurries, buildPlaces, buildHeroPortraits, buildPlatforms,
];

function collect(builders: Builder[], only?: (key: string) => boolean): ArtBundle {
  const sheets: SheetSpec[] = [];
  const anims: AnimSpec[] = [];
  for (const b of builders) {
    const r = b();
    for (const s of r.sheets) if (!only || only(s.key)) sheets.push(s);
    if (r.anims) anims.push(...r.anims);
  }
  return { sheets, anims };
}

/** Draw every texture, trail backgrounds of all zones included, into canvases (no Phaser needed). Used by the preview page. */
export function buildArt(only?: (key: string) => boolean): ArtBundle {
  return collect([...spriteBuilders, buildBackgrounds], only);
}

/** Side-area layers are ~25 MB per area, so the preview paints them one area at a time. */
export { buildAreaLayer, buildAreaBackgrounds };

/** Time each sprite builder (ms) - preview diagnostics. */
export function timeBuilders(): { name: string; ms: number }[] {
  return spriteBuilders.map((b) => {
    const t = performance.now();
    b();
    return { name: b.name, ms: performance.now() - t };
  });
}

/** Zones whose backgrounds registerArt() creates up front (Title/Profiles backdrop). */
const BOOT_ZONES = [0];

let cached: ArtBundle | undefined;

function addSheet(scene: Phaser.Scene, s: SheetSpec): void {
  const tm = scene.textures;
  if (tm.exists(s.key)) return;
  const tex = tm.addCanvas(s.key, s.canvas);
  if (!tex) return;
  if (s.frameW && s.frameH && s.frames) {
    const cols = s.cols ?? s.frames;
    for (let i = 0; i < s.frames; i++) {
      tex.add(i, 0, (i % cols) * s.frameW, Math.floor(i / cols) * s.frameH, s.frameW, s.frameH);
    }
  }
}

/**
 * Create every sprite/UI texture and animation from keys.ts, plus zone 0's backgrounds.
 * Other zones' backgrounds and all side areas are created on demand by ensureZoneArt().
 * Idempotent: existing keys are skipped.
 */
export function registerArt(scene: Phaser.Scene): void {
  // sprite canvases are drawn once per page; later calls (other scenes, restarts) only fill gaps
  const bundle = (cached ??= collect(spriteBuilders));
  for (const s of bundle.sheets) addSheet(scene, s);
  for (const a of bundle.anims) addAnim(scene, a);
  for (const z of BOOT_ZONES) ensureZoneArt(scene, z);
}

function addAnim(scene: Phaser.Scene, a: AnimSpec): void {
  if (scene.anims.exists(a.key) || !scene.textures.exists(a.texture)) return;
  scene.anims.create({
    key: a.key,
    frames: a.frames.map((f, i) => ({ key: a.texture, frame: f, duration: a.hold?.[i] ?? 0 })),
    frameRate: a.frameRate,
    repeat: a.repeat,
  });
}

// ---------------------------------------------------------------- v3: playable heroes

/** Base keys of the six hero animations (heroAnim(base, hero, scarf)). */
export const HERO_ANIM_BASES = [ANIM.idle, ANIM.walk, ANIM.jumpUp, ANIM.jumpFall, ANIM.cheer, JUNIPER_ANIM_LAND] as const;

/** True when the hero's sheet for this accent colour and all six of its animations exist. */
export function hasHeroArt(scene: Phaser.Scene, hero: HeroId, scarf: number): boolean {
  return scene.textures.exists(heroKey(hero, scarf)) && HERO_ANIM_BASES.every((b) => scene.anims.exists(heroAnim(b, hero, scarf)));
}

/**
 * Make sure the hero's sprite sheet heroKey(hero, scarf) (19 numbered frames, Juniper's layout)
 * and its animations heroAnim(base, hero, scarf) exist. Non-Juniper sheets are drawn on demand
 * here (~3 MB each, a few tens of ms); Juniper's are built at boot and only re-made if missing.
 * A second call is a no-op.
 */
export function ensureHeroArt(scene: Phaser.Scene, hero: HeroId, scarf: number): void {
  const s = ((scarf % SCARF_COLOURS.length) + SCARF_COLOURS.length) % SCARF_COLOURS.length;
  if (hasHeroArt(scene, hero, s)) return;
  if (hero === 'juniper') {
    if (!scene.textures.exists(juniperKey(s))) {
      const sheet = (cached ??= collect(spriteBuilders)).sheets.find((x) => x.key === juniperKey(s));
      if (sheet) addSheet(scene, sheet);
    }
    for (const a of juniperAnimSpecs(juniperKey(s), (b) => heroAnim(b, 'juniper', s))) addAnim(scene, a);
    return;
  }
  if (!scene.textures.exists(heroKey(hero, s))) addSheet(scene, buildHeroSheet(hero, s));
  for (const a of heroAnimSpecs(hero, s)) addAnim(scene, a);
}

/**
 * Remove every non-Juniper hero sheet (and its animations) except keepHero x keepScarf.
 * Juniper's sheets are never removed. Call it when entering a scene, after the previous
 * scene has shut down, so no live sprite still uses a removed sheet.
 */
export function releaseHeroArt(scene: Phaser.Scene, keepHero: HeroId, keepScarf: number): void {
  const ks = ((keepScarf % SCARF_COLOURS.length) + SCARF_COLOURS.length) % SCARF_COLOURS.length;
  for (const hero of HERO_IDS) {
    if (hero === 'juniper') continue;
    for (let s = 0; s < SCARF_COLOURS.length; s++) {
      if (hero === keepHero && s === ks) continue;
      for (const b of HERO_ANIM_BASES) {
        const k = heroAnim(b, hero, s);
        if (scene.anims.exists(k)) scene.anims.remove(k);
      }
      const key = heroKey(hero, s);
      if (scene.textures.exists(key)) scene.textures.remove(key);
    }
  }
}

/** True when every background layer of `zone` (area 0 = Trail, 1|2 = side areas) exists as a texture. */
export function hasZoneArt(scene: Phaser.Scene, zone: number, area = 0): boolean {
  return BG_LAYERS.every((l) => scene.textures.exists(areaBgKey(zone, area, l)));
}

/**
 * Create the background layers of `zone`'s area if they are missing: area 0 (default) is
 * the Trail (bgKey(zone, layer)), areas 1 and 2 are the side areas (areaBgKey(zone, area, layer)).
 * Painting one area takes a few tens of ms; nothing is cached outside the texture manager, so
 * released canvases can be garbage-collected.
 */
export function ensureZoneArt(scene: Phaser.Scene, zone: number, area = 0): void {
  if (zone < 0 || zone >= ZONE_COUNT) return;
  if (area !== 0 && (area < 1 || area > 2 || zone >= AREA_ZONES)) return;
  for (const layer of BG_LAYERS) {
    const key = areaBgKey(zone, area, layer);
    if (scene.textures.exists(key)) continue;
    try {
      addSheet(scene, area === 0 ? buildZoneLayer(zone, layer) : buildAreaLayer(zone, area, layer));
    } catch (e) {
      console.warn(`[LanternPeak] could not paint ${key}`, e);
    }
  }
}

/**
 * Remove background textures. Zones not in `keep` lose all their areas. For the zones in
 * `keep`, `areas` lists which areas survive (0 = Trail, 1, 2); by default all three are kept
 * (so existing calls `releaseZoneArt(this, zone)` never drop the area the scene just ensured).
 * Example: entering side area 2 of zone 1 and dropping its Trail + other side area:
 * `ensureZoneArt(this, 1, 2); releaseZoneArt(this, 1, [2]);`
 * Call it only when entering a scene (in create), after the previous scene has shut down,
 * so no live TileSprite/Image still references a removed texture.
 */
export function releaseZoneArt(scene: Phaser.Scene, keep: number | number[], areas: number | number[] = [0, 1, 2]): void {
  const k = Array.isArray(keep) ? keep : [keep];
  const ka = Array.isArray(areas) ? areas : [areas];
  for (let z = 0; z < ZONE_COUNT; z++) {
    for (const area of [0, 1, 2]) {
      if (k.includes(z) && ka.includes(area)) continue;
      for (const layer of BG_LAYERS) {
        const key = areaBgKey(z, area, layer);
        if (scene.textures.exists(key)) scene.textures.remove(key);
      }
    }
  }
}

/**
 * Create (once) a dark silhouette texture flurrySilKey(kind) for the Flurry Lodge album's
 * undiscovered slots and return its key. 96x96, same framing as flurryKey(kind) frame 0.
 */
export function ensureFlurrySilhouette(scene: Phaser.Scene, kind: number): string {
  const key = flurrySilKey(kind);
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, flurrySilhouette(kind % FLURRY_KINDS));
  return key;
}
