// Adapter between the game and the hero art. The art module exports ensureHeroArt / releaseHeroArt / hasHeroArt /
// heroHatAnchor when the real hero sheets exist; until then (or if they are missing) every hero is drawn with
// Juniper's sheet, anims and hat anchor, tinted per hero, so the game is playable either way.
import type Phaser from 'phaser';
import * as artModule from '../art';
import { HeroId, heroAnim, heroKey, heroPortraitKey, juniperAnim, juniperKey } from '../art/keys';
import { juniperHatAnchor } from '../art';

interface RealArt {
  ensureHeroArt?: (scene: Phaser.Scene, hero: HeroId, scarf: number) => void;
  releaseHeroArt?: (scene: Phaser.Scene, keepHero: HeroId, keepScarf: number) => void;
  hasHeroArt?: (scene: Phaser.Scene, hero: HeroId, scarf: number) => boolean;
  heroHatAnchor?: (hero: HeroId, frame: number) => { dx: number; dy: number; rot: number; scale?: number };
}
const real = artModule as unknown as RealArt;

/** True when the art module provides the hero functions (the real hero art), false while the fallback is used. */
export const realHeroArtAvailable = () =>
  typeof real.ensureHeroArt === 'function' && typeof real.hasHeroArt === 'function' && typeof real.heroHatAnchor === 'function';

/** Multiply tints that tell the fallback heroes apart (only used when there is no real sheet). */
const FALLBACK_TINT: Record<HeroId, number | null> = {
  juniper: null,
  pip: 0xdff0ff,
  marlow: 0xd9aa78,
  odette: 0xc9b0e8,
  bluster: 0x8e9ccc,
};

/** Make sure the hero's sheets exist (creating them on demand) and free other heroes' sheets. */
export function prepareHero(scene: Phaser.Scene, hero: HeroId, scarf: number) {
  if (hero !== 'juniper' && realHeroArtAvailable()) {
    try {
      real.ensureHeroArt!(scene, hero, scarf);
    } catch (e) {
      console.warn('[LanternPeak] ensureHeroArt failed, using fallback', e);
    }
  }
  if (typeof real.releaseHeroArt === 'function') {
    try {
      real.releaseHeroArt(scene, hero, scarf);
    } catch {
      /* ignore */
    }
  }
}

/** True when `hero` will be drawn from its own sheet (always for Juniper). */
export function usesOwnSheet(scene: Phaser.Scene, hero: HeroId, scarf: number): boolean {
  if (hero === 'juniper') return true;
  return realHeroArtAvailable() && real.hasHeroArt!(scene, hero, scarf) && scene.textures.exists(heroKey(hero, scarf));
}

export const heroTextureKey = (scene: Phaser.Scene, hero: HeroId, scarf: number) =>
  usesOwnSheet(scene, hero, scarf) ? heroKey(hero, scarf) : juniperKey(scarf);

export function heroAnimKey(scene: Phaser.Scene, base: string, hero: HeroId, scarf: number): string {
  if (usesOwnSheet(scene, hero, scarf)) {
    const k = heroAnim(base, hero, scarf);
    if (scene.anims.exists(k)) return k;
  }
  return juniperAnim(base, scarf);
}

/** Dresses a sprite as `hero` (texture + fallback tint). Call prepareHero first. */
export function skinHero(sprite: Phaser.GameObjects.Sprite, hero: HeroId, scarf: number) {
  const scene = sprite.scene;
  const own = usesOwnSheet(scene, hero, scarf);
  sprite.setTexture(own ? heroKey(hero, scarf) : juniperKey(scarf), 0);
  const t = own ? null : FALLBACK_TINT[hero];
  if (t === null) sprite.clearTint();
  else sprite.setTint(t);
}

/** Plays a hero animation (ANIM.idle, walk, ...) on a sprite, with the fallback when the hero has no sheet. */
export function playHero(sprite: Phaser.GameObjects.Sprite, base: string, hero: HeroId, scarf: number, ignoreIfPlaying = true) {
  sprite.play(heroAnimKey(sprite.scene, base, hero, scarf), ignoreIfPlaying);
}

/** New sprite already skinned as the hero (origin 0.5, 1). */
export function addHeroSprite(scene: Phaser.Scene, x: number, y: number, hero: HeroId, scarf: number, scale = 1) {
  prepareHero(scene, hero, scarf);
  const s = scene.add.sprite(x, y, juniperKey(scarf), 0).setOrigin(0.5, 1).setScale(scale);
  skinHero(s, hero, scarf);
  return s;
}

/** Hat placement for a hero's frame (relative to the feet origin, facing right). */
export function heroHat(scene: Phaser.Scene, hero: HeroId, scarf: number, frame: number): { dx: number; dy: number; rot: number; scale: number } {
  if (usesOwnSheet(scene, hero, scarf) && hero !== 'juniper' && typeof real.heroHatAnchor === 'function') {
    const a = real.heroHatAnchor(hero, frame);
    return { dx: a.dx, dy: a.dy, rot: a.rot, scale: a.scale ?? 1 };
  }
  const a = juniperHatAnchor(frame);
  return { dx: a.dx, dy: a.dy, rot: a.rot, scale: 1 };
}

/** Portrait texture key if it exists in this scene's textures, else null. */
export function heroPortrait(scene: Phaser.Scene, hero: HeroId): string | null {
  const k = heroPortraitKey(hero);
  return scene.textures.exists(k) ? k : null;
}

/**
 * A hero figure for lists (profile card, map): the portrait when the art has one (non-Juniper), otherwise the
 * (tinted) sprite. Never creates or releases sheets, so several can be on screen at once. Origin 0.5, 1.
 */
export function addHeroFigure(scene: Phaser.Scene, x: number, bottom: number, hero: HeroId, scarf: number, scale: number): Phaser.GameObjects.Sprite | Phaser.GameObjects.Image {
  const portrait = hero === 'juniper' ? null : heroPortrait(scene, hero);
  if (portrait) {
    const img = scene.add.image(x, bottom, portrait).setOrigin(0.5, 1);
    img.setScale((200 * scale) / img.height);
    return img;
  }
  const s = scene.add.sprite(x, bottom, juniperKey(scarf), 0).setOrigin(0.5, 1).setScale(scale);
  skinHero(s, hero, scarf);
  playHero(s, 'juniper-idle', hero, scarf);
  return s;
}
