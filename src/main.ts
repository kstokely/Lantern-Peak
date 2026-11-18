import Phaser from 'phaser';
import { GAME_H, GAME_W, Grade, NUM_ZONES, ZONE_PRESENTS } from './types';
import type { MusicPlace } from './core/musicPlaylist';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { ProfilesScene } from './scenes/ProfilesScene';
import { MapScene } from './scenes/MapScene';
import { WorldScene } from './scenes/WorldScene';
import { HudScene } from './scenes/HudScene';
import { FinaleScene } from './scenes/FinaleScene';
import { StoreScene } from './scenes/StoreScene';
import { LodgeScene } from './scenes/LodgeScene';
import { WardrobeScene } from './scenes/WardrobeScene';
import { HERO_IDS, HeroId } from './art/keys';
import { unlockedHeroes } from './core/heroes';
import { TOOL_IDS, ToolId } from './art/keys';
import { MINI_GAME_SCENES } from './minigames';
import { createProfile, persist, save } from './core/save';
import { session } from './core/session';
import { audio } from './core/audio';
import { debugRefs } from './core/debug';
import { placeholderKeys } from './core/placeholderArt';

// Test hook: ?timeout drives the loop with setTimeout so automation keeps ticking in a hidden pane.
const forceTimeout = new URLSearchParams(location.search).has('timeout');

const game = new Phaser.Game({
  fps: forceTimeout ? { forceSetTimeOut: true, target: 60 } : undefined,
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#1d1a3a',
  antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  input: { activePointers: 4 },
  scene: [BootScene, TitleScene, ProfilesScene, MapScene, WorldScene, HudScene, FinaleScene, StoreScene, LodgeScene, WardrobeScene, ...MINI_GAME_SCENES],
});

// Audio must start on the first user gesture.
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock, { capture: true });
window.addEventListener('keydown', unlock, { capture: true });
// a tab that was hidden may have paused the music element: restart it when shown again
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) audio.kickMusic();
});

// Phaser's own resize handling can run before the browser has applied the new viewport size
// (seen when rotating a phone / resizing the window), leaving the canvas oversized. Refresh again shortly after.
const refitCanvas = () => {
  for (const ms of [60, 350]) setTimeout(() => game.scale.refresh(), ms);
};
window.addEventListener('resize', refitCanvas);
window.addEventListener('orientationchange', refitCanvas);

const activeScenes =() => game.scene.getScenes(true).map((s) => s.scene.key);

/** Ensures a profile (creates "Tester" if none), unlocks up to zone z, stops other scenes, enters zone z / area a. */
function enter(n: number, area: number, grade: Grade) {
  const z = Math.max(0, Math.min(NUM_ZONES - 1, n | 0));
  const a = Math.max(0, Math.min(2, area | 0));
  if (!session.profile) {
    const p = createProfile('Tester', grade, 0);
    if (p) session.select(p.id);
  }
  const p = session.p;
  p.unlockedZone = Math.max(p.unlockedZone, z);
  for (const s of game.scene.getScenes(false)) if (s.scene.key !== 'World' && (s.sys.isActive() || s.sys.isPaused())) game.scene.stop(s.scene.key);
  game.scene.start('World', { zone: z, area: a, from: a === 0 ? -1 : 0 });
  return { zone: z, area: a };
}

const debug = {
  state: () => {
    const p = session.profile;
    return {
      scenes: activeScenes(),
      profile: p ? { name: p.name, grade: p.grade, unlockedZone: p.unlockedZone, dadMode: p.dadMode === true, dadLevel: p.dad?.level ?? null } : null,
      levels: p ? Object.fromEntries(Object.entries(p.strands).map(([k, v]) => [k, v.level])) : null,
      purse: p?.purse ?? 0,
      tools: p?.tools ?? [],
      cocoa: p?.cocoa ?? 0,
      hats: p?.hats ?? [],
      hat: p?.hat ?? -1,
      flurries: p ? p.flurries.map((b, i) => (b ? i : -1)).filter((i) => i >= 0) : [],
      hero: p?.hero ?? null,
      unlockedHeroes: p ? unlockedHeroes(p) : [],
      follower: p?.follower ?? null,
      music: audio.musicState(),
      zone: debugRefs.world?.zone ?? null,
      area: debugRefs.world?.area ?? null,
      bubble: (game.scene.getScene('Hud') as HudScene | null)?.bubbleText?.() ?? null,
      world: debugRefs.world?.state() ?? null,
      miniGame: debugRefs.miniGame ? { id: debugRefs.miniGame.gameId, problem: debugRefs.miniGame.currentProblem() } : null,
    };
  },
  /**
   * Hidden Dad mode: selects (or creates) a Dad-mode profile, sets its Dad level (default: keep, else 1)
   * and enters camp 1's Trail. Returns the level, or 'full' when no profile slot is free.
   */
  dad: (level?: number, topic?: string) => {
    debugRefs.dadTopic = topic ?? null;
    let p = save.profiles.find((q) => q.dadMode);
    if (!p) {
      const made = createProfile('Dad', 4, 0, { dadMode: true });
      if (!made) return 'full';
      p = made;
    }
    session.select(p.id);
    const lv = level !== undefined && Number.isFinite(level) ? Math.max(1, Math.floor(level)) : p.dad?.level ?? 1;
    p.dad = { level: lv, streak: 0, misses: 0 };
    persist();
    enter(0, 0, 4);
    return lv;
  },
  currentProblem: () => debugRefs.miniGame?.currentProblem() ?? null,
  answerCurrent: (correct: boolean) => debugRefs.miniGame?.answerCurrent(correct) ?? 'no-minigame',
  solveCurrent: () => debugRefs.miniGame?.answerCurrent(true) ?? 'no-minigame',
  closeMiniGame: () => debugRefs.miniGame?.close(),
  /** Enters zone n's Trail (area 0). */
  gotoZone: (n: number, grade: Grade = 1) => enter(n, 0, grade).zone,
  /** Enters zone n, area a (0 Trail, 1 and 2 side areas), skipping the doorway gates. */
  gotoArea: (n: number, area: number, grade: Grade = 1) => enter(n, area, grade),
  giveGems: (n: number) => session.earn(n),
  /** Plays as hero id, bypassing the unlock rule (persists, but a reload re-checks the unlock). */
  setHero: (id: HeroId) => {
    if (!(HERO_IDS as readonly string[]).includes(id)) return 'unknown-hero';
    const p = session.profile;
    if (!p) return 'no-profile';
    session.setHero(id, true);
    return p.hero;
  },
  unlockAllHeroes: () => {
    const p = session.profile;
    if (!p) return 'no-profile';
    // unlock is derived from progress: mark enough presents opened (never un-marks anything)
    ([['trailFriend', 2], ['coinShop', 2], ['clockTower', 2]] as const).forEach(([game, need]) => {
      let have = 0;
      ZONE_PRESENTS.forEach((games, z) => games.forEach((g, i) => {
        if (g !== game) return;
        if (p.zones[z].presents[i]) have++;
        else if (have < need) {
          p.zones[z].presents[i] = true;
          have++;
        }
      }));
    });
    p.zones[4].delivered = true;
    p.finished = true;
    persist();
    return unlockedHeroes(p);
  },
  setFollower: (kind: number | null) => {
    if (!session.profile) return 'no-profile';
    // debug: the kind counts as befriended so it can follow
    if (kind !== null && kind !== undefined && kind >= 0 && kind < session.p.flurries.length) session.p.flurries[kind] = true;
    session.setFollower(kind === null || kind === undefined ? -1 : kind, true);
    return session.follower;
  },
  /** Plays a music place (menu, shop, camp1..camp5) without changing scene. */
  setMusic: (place: MusicPlace) => audio.setMusic(place),
  musicState: () => audio.musicState(),
  giveTool: (id: ToolId) => {
    if (!(TOOL_IDS as readonly string[]).includes(id)) return 'unknown-tool';
    session.grant(id);
    return session.profile?.tools ?? [];
  },
  teleport: (x: number, y?: number) => debugRefs.world?.teleport(x, y),
  touchGem: (i: number) => debugRefs.world?.touchGem(i) ?? false,
  touchPresent: (i: number) => debugRefs.world?.touchPresent(i) ?? false,
  touchFlurry: (i: number) => debugRefs.world?.touchFlurry(i) ?? 'no-world',
  touchDoor: (to: number) => debugRefs.world?.touchDoor(to) ?? 'no-world',
  ringBell: () => debugRefs.world?.ringBell() ?? 'no-world',
  /** From the World: the stall overlay; otherwise the store from the map. */
  openStore: () => {
    if (debugRefs.world) {
      debugRefs.world.openStore();
      return 'world';
    }
    for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key);
    game.scene.start('Store', { from: 'map' });
    return 'map';
  },
  goToSled: () => debugRefs.world?.goToSled(),
  // ---- v4 platforming ----
  /** Platforms, checkpoints, pads, rock, gaps of the current area with live positions. */
  listPieces: () => debugRefs.world?.listPieces() ?? null,
  /** Lights checkpoint i of this area and stands the hero there. */
  toCheckpoint: (i: number) => debugRefs.world?.toCheckpoint(i) ?? false,
  /** Simulates a fall into a gap (poof, float back to the last lit checkpoint, counts for the helper cloud). */
  fall: () => debugRefs.world?.fallNow() ?? 'no-world',
  /** Holds a key ('left' | 'right' | 'jump' | 'down') for ms through the game's own input state. */
  hold: (key: 'left' | 'right' | 'jump' | 'down', ms = 200) => debugRefs.world?.hold(key, ms),
  /** Runs held-input steps [{ keys: 'right+jump', ms }, { keys: 'right', toX }]; resolves with time, position and falls. */
  input: (seq: { keys: string; ms?: number; toX?: number }[]) => debugRefs.world?.inputSeq(seq) ?? Promise.resolve(null),
  /** Starts Marlow's odd job from the World (as the stall button does). */
  oddJob: () => debugRefs.world?.oddJob() ?? 'no-world',
  /** Pretends ms have passed on this camp's loose-gem respawn clock, then refreshes the area's gems. */
  ageLoose: (ms: number) => {
    const w = debugRefs.world;
    if (!w) return 'no-world';
    session.ageLoose(w.zone, ms);
    return w.refreshLoose();
  },
  collectRest: () => debugRefs.world?.collectRest(),
  scenes: activeScenes,
  /** Texture keys faked since page load: must be [] now that every real texture exists. */
  placeholders: () => placeholderKeys.slice(),
  /** Texture keys currently loaded (areas' backgrounds etc.). */
  textureKeys: () => game.textures.getTextureKeys(),
};

(window as any).__LP = {
  game,
  get save() {
    return save;
  },
  session,
  audio,
  debug,
};
