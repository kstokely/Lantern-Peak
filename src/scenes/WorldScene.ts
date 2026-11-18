// One area of a camp: walk and hop, collect loose gems (money), frost gems (Frost Lock) and
// presents (mini games), use doorways between the Trail and its side areas, visit Marlow's stall,
// befriend Flurries with the bell, light the camp at the sled with any 4 of 6 lanterns.
import Phaser from 'phaser';
import { ANIM, ANIM2, BG_SCROLL, BgLayer, TEX, TEX2, areaBgKey, bgKey, friendKey, gemKey, hatKey, presentKey, HeroId } from '../art/keys';
import {
  AIR_JUMP_V, BODY_H, BODY_W, BUFFER_MS, COYOTE_MS, GLIDE_FALL, GRAVITY, ICE_ACCEL, ICE_DECEL, JUMP_CUT, JUMP_V, JUMP_V_HOOVES,
  MAX_FALL, PAD_V, PAD_V_HOLD, SPEED, SPEED_SWIFT,
} from '../core/physics';
import { storeItem } from '../core/store';
import { ODD_JOB_PAY, ODD_JOB_ROUNDS } from '../core/session';
import { makeButton } from '../core/ui';
import { Terrain } from './world/Terrain';
import { Movers, Surf } from './world/Movers';
import { Pads, Winds } from './world/Gusts';
import { Checkpoints } from './world/Checkpoints';
import { ensureZoneArt, releaseZoneArt } from '../art';
import { addHeroSprite, heroAnimKey, heroHat, heroTextureKey, prepareHero, skinHero } from '../core/heroArt';
import { heroUnlockToast } from '../core/heroes';
import { campPlace } from '../core/musicPlaylist';
import { Trail } from './world/Trail';
import { GAME_W, LANTERNS_TO_LIGHT, MiniGameId, NUM_ZONES, PRESENTS_PER_ZONE, miniGameSceneKey } from '../types';
import { session } from '../core/session';
import { audio } from '../core/audio';
import { controls } from '../core/controls';
import { debugRefs, DebugWorld } from '../core/debug';
import { LINES, LineId } from '../core/lines';
import { addSnow, confetti, starBurst, wobble } from '../core/ui';
import { AreaLayout, FALL_Y, GROUND_Y, WORLD_BOTTOM, areaLayout, worldTop } from './zones';
import { HUD_TOP, HudScene, PACK_BOTTOM } from './HudScene';
import { Door, DoorSet } from './world/Doors';
import { LooseGemField } from './world/LooseGems';
import { Flurry, FlurryField } from './world/Flurries';

/** Tap-to-walk plans hops up to this rise (the full jump rises 256 px, 342 with the Spring Hooves). */
const MAX_RISE = 215;
const MAX_RISE_HOOVES = 320;
const HERO_SCALE = 0.85;
/** Camera: the hero's feet sit this far below the screen centre (more view of the climb above). */
const CAM_LOOK_UP = 130;
/** A drop of this much below the last lit checkpoint counts as a fall for the helper cloud (no float-back). */
const DEEP_DROP = 380;
/** Loose gems that have respawned are put back on this slow timer while the child stays in the area. */
const LOOSE_CHECK_MS = 10000;
const LEDGE_HALF = 116;
const IDLE_HINT_MS = 8000;
const BELL_RANGE = 480;
const BELL_RANGE_SILVER = 900;

const ZONE_INTRO = [
  'This is Lantern Meadow. Look for sparkly gems and wrapped presents. Each present hides a lantern!',
  "Welcome to Frostpine Forest! The trees are tall here, and so are the puzzles. Let's find those lanterns!",
  "Ooh, the Glimmer Caves! Everything sparkles in here. We'll need ice bridges to get across.",
  "Clocktower Ridge! Odette the owl keeps the old clock up here. Hold on to your scarf, it's windy!",
  'The summit! Look at those lights in the sky. Just a few more lanterns, and the festival can begin!',
];

interface Item {
  kind: 'gem' | 'present';
  index: number; // global index within the zone (frost gem 0..5, present 0..5)
  game?: MiniGameId;
  x: number;
  y: number; // centre of the hit box
  sprite: Phaser.GameObjects.Sprite;
  sparkle?: Phaser.GameObjects.Particles.ParticleEmitter;
  done: boolean;
  /** Set after backing out of a mini game: re-armed once Juniper walks away. */
  blocked: boolean;
}

type Pending = { kind: 'door'; door: Door } | { kind: 'stall' } | null;

export class WorldScene extends Phaser.Scene implements DebugWorld {
  zone = 0;
  area = 0;
  private from = -1;
  private layout!: AreaLayout;
  private width = 3840;
  private scarf = 0;
  private hud!: HudScene;
  private bg: { tile: Phaser.GameObjects.TileSprite; f: number }[] = [];
  private ledges: { x: number; y: number }[] = [];
  private ledgeBodies: Phaser.GameObjects.Zone[] = [];
  private dropLedge: Phaser.GameObjects.Zone | null = null;
  private dropUntil = 0;
  private hero!: Phaser.GameObjects.Zone;
  private body!: Phaser.Physics.Arcade.Body;
  private goat!: Phaser.GameObjects.Sprite;
  private heroId: HeroId = 'juniper';
  private trail!: Trail;
  private hat: Phaser.GameObjects.Image | null = null;
  private shadow!: Phaser.GameObjects.Ellipse;
  private items: Item[] = [];
  private sled: Phaser.GameObjects.Sprite | null = null;
  private gate: Phaser.GameObjects.Sprite | null = null;
  private stall: Phaser.GameObjects.Image | null = null;
  private gateWall: Phaser.GameObjects.Zone | null = null;
  private doors!: DoorSet;
  private loose!: LooseGemField;
  private flurries!: FlurryField;
  private darkness: { img: Phaser.GameObjects.Image; rects: Phaser.GameObjects.Rectangle[]; glow: Phaser.GameObjects.Arc } | null = null;
  private keys!: Record<'left' | 'right' | 'up' | 'a' | 'd' | 'w' | 'space', Phaser.Input.Keyboard.Key>;
  private dropQueuedUntil = 0;
  private busy = false;
  private facing = 1;
  private wasOnFloor = true;
  private airTime = 0;
  private stepTimer = 0;
  private jumpBufferUntil = 0;
  private lastFloorAt = 0;
  private lead = 0;
  private curAnim = '';
  // tap-to-walk
  private hasTarget = false;
  private targetX = 0;
  private targetSurface = GROUND_Y;
  private autoJumps = 0;
  /** Where the current auto-hop aims (an intermediate ledge), kept while airborne so a high jump does not overshoot it. */
  private hopX: number | null = null;
  private heldPointer: Phaser.Input.Pointer | null = null;
  private tmpVec = new Phaser.Math.Vector2();
  private pending: Pending = null;
  // misc
  private sledBlocked = false;
  private lastActive = 0;
  private hint!: Phaser.GameObjects.Image;
  private hintFor: { x: number; y: number; kind?: string } | null = null;
  private hintItem: Item | null = null;
  private hintSticky = false;
  private hintUntil = 0;
  private hintGlow!: Phaser.GameObjects.Arc;
  private hintEdge!: Phaser.GameObjects.Image;
  private leaving = false;
  private glowSeen = false;
  private unsub: (() => void) | null = null;
  // ---- v4 platforming ----
  private terrain!: Terrain;
  private movers!: Movers;
  private pads!: Pads;
  private winds!: Winds;
  private cps!: Checkpoints;
  private riding: Surf | null = null;
  private dropSurf: Surf | null = null;
  private dropSurfUntil = 0;
  private prevBottom = 0;
  private jumping = false;
  private airJumped = false;
  private autoHold = false;
  private walkVx = 0;
  private padBoostUntil = 0;
  private respawning = false;
  private invulnUntil = 0;
  private entry = { x: 0, y: GROUND_Y };
  private camTarget = { x: 0, y: 0 };
  private camY = GROUND_Y;
  private peakFeet = GROUND_Y;
  private looseTimer = 0;
  private puff!: Phaser.GameObjects.Particles.ParticleEmitter;
  private oddJobBtn: ReturnType<typeof makeButton> | null = null;
  private bgMid: { tile: Phaser.GameObjects.TileSprite; k: number }[] = [];
  /** Debug input (window.__LP.debug.hold / input): key -> held until (scene time). */
  private dbgUntil: Record<'left' | 'right' | 'jump' | 'down', number> = { left: 0, right: 0, jump: 0, down: 0 };
  private dbgQueue: { keys: string[]; ms: number; toX?: number; started?: number }[] = [];
  private dbgDone: ((r: Record<string, unknown>) => void) | null = null;
  private dbgStats = { falls: 0, t0: 0 };

  constructor() {
    super('World');
  }

  init(data: { zone?: number; area?: number; from?: number }) {
    this.zone = Phaser.Math.Clamp(data.zone ?? 0, 0, NUM_ZONES - 1);
    this.area = Phaser.Math.Clamp(data.area ?? 0, 0, 2);
    this.from = data.from ?? -1;
    this.layout = areaLayout(this.zone, this.area);
    this.width = this.layout.width;
    this.bg = [];
    this.ledges = [];
    this.ledgeBodies = [];
    this.dropLedge = null;
    this.dropUntil = 0;
    this.items = [];
    this.busy = false;
    this.hasTarget = false;
    this.heldPointer = null;
    this.pending = null;
    this.sledBlocked = false;
    this.gateWall = null;
    this.sled = this.gate = null;
    this.stall = null;
    this.hat = null;
    this.darkness = null;
    this.leaving = false;
    this.curAnim = '';
    this.lead = 0;
    this.facing = 1;
    this.riding = this.dropSurf = null;
    this.jumping = this.airJumped = this.autoHold = this.respawning = false;
    this.walkVx = 0;
    this.invulnUntil = this.padBoostUntil = this.dropSurfUntil = 0;
    this.oddJobBtn = null;
    this.bgMid = [];
    this.dbgQueue = [];
    this.dbgDone = null;
    this.dbgUntil = { left: 0, right: 0, jump: 0, down: 0 };
    this.looseTimer = 0;
  }

  // ---------- tool-dependent movement ----------
  private get speed() {
    return session.has('swiftScarf') ? SPEED_SWIFT : SPEED;
  }
  private get jumpV() {
    return session.has('springHooves') ? JUMP_V_HOOVES : JUMP_V;
  }
  private get maxRise() {
    return session.has('springHooves') ? MAX_RISE_HOOVES : MAX_RISE;
  }

  create() {
    const p = session.profile;
    if (!p) {
      this.scene.start('Profiles');
      return;
    }
    this.scarf = p.scarf;
    this.heroId = session.hero;
    const zp = p.zones[this.zone];
    const W = this.width;
    const top = worldTop(this.layout);
    // tall areas grow upwards (negative y); no floor at the bottom: falling into a gap floats you back
    this.physics.world.setBounds(0, top, W, WORLD_BOTTOM - top + 600);
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.cameras.main.setBounds(0, top, W, WORLD_BOTTOM - top);

    const groundArt = this.addBackdrop();
    this.terrain = new Terrain(this, this.layout, groundArt.key, groundArt.tint ? this.layout.tint : null);

    // ledges: one-way platforms
    const ledgeBodies: Phaser.GameObjects.Zone[] = [];
    for (const l of this.layout.ledges) {
      this.ledges.push(l);
      this.add.ellipse(l.x, l.y + 90, 180, 26, 0x3b3a7a, 0.18).setDepth(0.5);
      this.add.image(l.x, l.y - 4, TEX.ledge).setOrigin(0.5, 0).setDepth(1);
      const z = this.add.zone(l.x, l.y + 11, LEDGE_HALF * 2, 22);
      this.physics.add.existing(z, true);
      const b = z.body as Phaser.Physics.Arcade.StaticBody;
      b.checkCollision.down = false;
      b.checkCollision.left = false;
      b.checkCollision.right = false;
      ledgeBodies.push(z);
    }

    this.movers = new Movers(this, this.layout);
    this.pads = new Pads(this, this.layout.pieces.pads ?? []);
    this.winds = new Winds(this, this.layout.pieces.winds ?? []);
    this.cps = new Checkpoints(this, this.layout.pieces.checkpoints ?? []);
    this.addDeco();
    this.doors = new DoorSet(this, this.zone);
    for (const d of this.layout.doors) this.doors.add(d);
    if (this.area === 0) {
      this.addStall();
      this.addCamp(zp.delivered);
    }
    this.addItems(zp.gems, zp.presents);
    this.loose = new LooseGemField(this);
    this.buildLoose();
    this.flurries = new FlurryField(this, W);
    // shy Flurries keep off doorways, gaps, rock and bounce pads
    this.flurries.avoid = [
      ...this.layout.doors.map((d) => [d.x - 180, d.x + 180] as [number, number]),
      ...this.layout.pits.map(([a, b]) => [a - 70, b + 70] as [number, number]),
      ...(this.layout.pieces.blocks ?? []).filter((k) => k.bottom === undefined || k.bottom >= GROUND_Y).map((k) => [k.x0 - 50, k.x1 + 50] as [number, number]),
      ...(this.layout.pieces.pads ?? []).map((k) => [k.x - 90, k.x + 90] as [number, number]),
    ];
    this.addFlurries();

    // Juniper: an invisible physics box + a sprite that follows it
    const entry = this.entryPoint();
    this.entry = entry;
    this.hero = this.add.zone(entry.x, entry.y - BODY_H / 2 - 1, BODY_W, BODY_H);
    this.physics.add.existing(this.hero);
    this.body = this.hero.body as Phaser.Physics.Arcade.Body;
    this.body.setGravityY(GRAVITY).setCollideWorldBounds(true).setMaxVelocityY(MAX_FALL);
    this.prevBottom = this.body.bottom;
    this.camY = this.peakFeet = entry.y;
    this.camTarget.x = entry.x;
    this.camTarget.y = entry.y;
    this.cps.update(entry.x, entry.y, true);
    this.puff = this.add.particles(0, 0, TEX.snowflake, {
      speed: { min: 60, max: 220 },
      angle: { min: 0, max: 360 },
      scale: { start: 2.2, end: 0.4 },
      alpha: { start: 0.95, end: 0 },
      lifespan: 600,
      emitting: false,
    });
    this.puff.setDepth(6);
    this.shadow = this.add.ellipse(0, 0, 100, 24, 0x3b3a7a, 0.35).setDepth(4);
    this.goat = addHeroSprite(this, this.hero.x, entry.y, this.heroId, this.scarf, HERO_SCALE).setDepth(5);
    this.trail = new Trail(this, this.scarf);
    this.trail.reset(this.hero.x, this.body.bottom);
    this.syncTrail();
    this.syncHat();
    this.physics.add.collider(this.hero, this.terrain.bodies());
    this.ledgeBodies = ledgeBodies;
    // One-way ledges; a ledge Juniper is dropping through is ignored for a moment.
    this.physics.add.collider(this.hero, ledgeBodies, undefined, (_h, l) => !(l === this.dropLedge && this.time.now < this.dropUntil));
    if (this.gateWall) this.physics.add.collider(this.hero, this.gateWall);

    const cam = this.cameras.main;
    cam.startFollow(this.camTarget, true, 0.12, 0.12);
    cam.setFollowOffset(0, CAM_LOOK_UP);
    cam.centerOn(entry.x, entry.y - CAM_LOOK_UP);
    cam.roundPixels = true;

    addSnow(this, 50);
    if (this.layout.dark) this.addDarkness();
    this.hint = this.add.image(0, 0, this.arrowTexture()).setDepth(60).setVisible(false);
    this.hintGlow = this.add.circle(0, 0, 70, 0xffc93c, 0.35).setDepth(59).setVisible(false);
    this.hintEdge = this.add.image(0, 0, this.arrowTexture()).setScrollFactor(0).setDepth(61).setVisible(false);
    this.hintFor = null;
    this.hintItem = null;
    this.hintSticky = false;

    this.setupInput();
    this.scene.launch('Hud', { zone: this.zone, area: this.area });
    this.hud = this.scene.get('Hud') as HudScene;
    this.hud.onHint = () => this.giveHint();
    this.hud.onBell = () => this.ringBell();
    this.lastActive = -1; // set on the first update (the scene clock is not valid yet in create)
    this.glowSeen = session.has('glowLantern');
    this.unsub = session.onChange(() => this.onSessionChange());
    audio.setMusic(campPlace(this.zone));
    audio.startWind(this.layout.dark ? 0.2 : 0.35 + this.zone * 0.15);
    debugRefs.world = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (debugRefs.world === this) debugRefs.world = null;
      this.unsub?.();
      this.unsub = null;
      audio.stopWind();
    });
    this.time.delayedCall(700, () => this.introLine());
    this.time.delayedCall(2600, () => this.heroToasts());
    cam.fadeIn(300, 29, 26, 58);
  }

  private introLine() {
    if (this.area === 0) {
      if (this.from < 0) this.say(ZONE_INTRO[this.zone], `v_zone${this.zone + 1}`, 7500);
      else this.hud.banner(this.layout.name);
      return;
    }
    this.hud.banner(this.layout.name);
    if (session.markSeen(this.zone, this.area)) this.time.delayedCall(900, () => this.sayLine('v_area'));
  }

  /** Where Juniper appears: next to the doorway she came through, or the area start. */
  private entryPoint() {
    if (this.area === 0 && this.from > 0) {
      const d = this.layout.doors.find((x) => x.to === this.from);
      if (d) return { x: d.x, y: d.y };
    }
    return { x: this.layout.startX, y: GROUND_Y };
  }

  // ---------- building ----------

  private addBackdrop() {
    // paint this area's layers on demand and drop every other area's (side areas are ~25 MB each)
    ensureZoneArt(this, this.zone, this.area);
    releaseZoneArt(this, this.zone, [this.area]);
    const pick = (l: BgLayer) => {
      const own = areaBgKey(this.zone, this.area, l);
      if (this.textures.exists(own)) return { key: own, tint: false };
      return { key: bgKey(this.zone, l), tint: this.area > 0 };
    };
    (['sky', 'far', 'mid', 'near'] as BgLayer[]).forEach((l, i) => {
      const { key, tint } = pick(l);
      const tile = this.add.tileSprite(640, 480, 1280, 960, key).setScrollFactor(0).setDepth(-10 + i);
      if (tint) tile.setTint(this.layout.tint);
      // side areas reuse the zone layers offset so they do not look like the Trail
      if (tint) tile.tilePositionX = 400 * this.area;
      this.bg.push({ tile, f: BG_SCROLL[l] });
      // tall areas: mid and near layers sink a little as the camera climbs (never up, so no gap shows at the bottom)
      if (l === 'mid' || l === 'near') this.bgMid.push({ tile, k: l === 'mid' ? 0.06 : 0.12 });
    });
    // the ground tile itself is laid per ground segment by the Terrain (gaps stay open)
    return pick('ground');
  }

  private addDeco() {
    for (const d of this.layout.deco) {
      if (d.kind === 'friend') {
        if (d.who === this.heroId) continue; // you are playing as them
        const f = this.add.sprite(d.x, GROUND_Y + 4, friendKey(d.who), 0).setOrigin(0.5, 1).setDepth(2).setScale(0.8);
        let talk = 0;
        this.time.addEvent({ delay: 1500, loop: true, callback: () => f.setFrame((talk = 1 - talk)) });
        f.setInteractive({ useHandCursor: true });
        const names = { pip: 'Pip', marlow: 'Marlow', odette: 'Odette' };
        f.on('pointerdown', () => this.say(`Hi, ${names[d.who]}!`));
      } else if (this.heroId !== 'bluster') {
        this.addBluster(d.x, d.y);
      }
    }
    if (this.zone === NUM_ZONES - 1 && this.area === 0 && this.heroId !== 'bluster') this.addBluster(3470, 200);
  }

  /** Bluster: a grumpy cloud that drifts about in the background and now and then puffs out a gust of snow. */
  private addBluster(x: number, y: number) {
    const b = this.add.sprite(x, y, TEX.bluster, 0).setDepth(2).setScale(0.8);
    this.tweens.add({ targets: b, x: x + 150, duration: 5600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: b, y: y + 20, duration: 2300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const gust = this.add.particles(0, 0, TEX.snowflake, {
      speedX: { min: -340, max: -150 },
      speedY: { min: -50, max: 70 },
      scale: { start: 1.5, end: 0.3 },
      alpha: { start: 0.95, end: 0 },
      lifespan: 1000,
      emitting: false,
    });
    gust.setDepth(2.2);
    let tick = 0;
    let nextPuff = 6 + Math.floor(Math.random() * 6);
    let puffing = false;
    this.time.addEvent({
      delay: 600,
      loop: true,
      callback: () => {
        tick++;
        if (puffing) {
          puffing = false;
          nextPuff = tick + 7 + Math.floor(Math.random() * 6);
        } else if (tick >= nextPuff) {
          puffing = true;
          gust.explode(16, b.x - 70, b.y + 20);
        }
        b.setFrame(puffing ? 2 : tick % 2);
      },
    });
  }

  private addStall() {
    const x = this.layout.stallX;
    if (x === undefined) return;
    this.stall = this.add.image(x, GROUND_Y + 6, TEX2.stall).setOrigin(0.5, 1).setDepth(1.6);
    this.stall.setInteractive({ useHandCursor: true });
    // Odd jobs: an always-available way to earn gems, so a child who spent everything is never stuck
    this.oddJobBtn = makeButton(this, x, GROUND_Y - 336, 330, 96, 'Odd job: earn gems', () => this.oddJob(), 32, 0x8fd18a);
    this.oddJobBtn.root.setDepth(1.7);
  }

  /** Marlow's odd job: a 3-round mini game that pays gems (never counts as a present). Repeatable without limit. */
  oddJob(): string {
    if (this.busy || this.leaving) return 'busy';
    this.pending = null;
    this.hasTarget = false;
    this.heldPointer = null;
    this.walkVx = 0;
    this.body.setVelocityX(0);
    this.say('Marlow: ' + LINES.m_oddjob, 'm_oddjob');
    const id = session.nextOddJob();
    this.busy = true;
    this.time.delayedCall(1500, () => {
      this.busy = false;
      this.launchMiniGame(id, ODD_JOB_ROUNDS, (ok) => {
        if (!ok) {
          this.say('Marlow always has another odd job for us. Any time!');
          return;
        }
        session.finishOddJob();
        audio.sfx('buy');
        const sx = this.layout.stallX ?? this.hero.x;
        const s = this.toScreen(sx, GROUND_Y - 220);
        this.hud.flyIn('purse', s.x, s.y, TEX2.purse, 0, 70);
        this.say('Marlow paid us ' + ODD_JOB_PAY + ' extra gems for the job. Thanks, Marlow!');
      });
    });
    return id;
  }

  private addCamp(delivered: boolean) {
    const { sledX, gateX } = this.layout;
    if (sledX === undefined || gateX === undefined) return;
    const sy = this.sledY;
    const gy = this.layout.gateY ?? GROUND_Y;
    this.sled = this.add.sprite(sledX, sy + 6, TEX.sled, delivered ? 1 : 0).setOrigin(0.5, 1).setDepth(2);
    this.sled.setInteractive({ useHandCursor: true });
    this.gate = this.add.sprite(gateX, gy + 6, TEX.gate, delivered ? 1 : 0).setOrigin(0.5, 1).setDepth(2);
    if (!delivered) {
      this.gateWall = this.add.zone(gateX - 40, gy - 200, 40, 400);
      this.physics.add.existing(this.gateWall, true);
    }
  }

  /** Surface the sled stands on. */
  private get sledY() {
    return this.layout.sledY ?? GROUND_Y;
  }

  private addItems(gems: boolean[], presents: boolean[]) {
    this.layout.gems.forEach((g) => {
      const i = g.index;
      if (gems[i]) return;
      const s = this.add.sprite(g.x, g.y, gemKey(i), 0).setDepth(3).setDisplaySize(80, 80);
      s.play({ key: ANIM.gemTwinkle(i % 6), startFrame: i % 4 });
      this.tweens.add({ targets: s, y: g.y - 10, duration: 900 + i * 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const sparkle = this.add.particles(g.x, g.y, TEX.star, {
        x: { min: -34, max: 34 },
        y: { min: -34, max: 34 },
        scale: { start: 0.5, end: 0 },
        lifespan: 700,
        frequency: 420,
        tint: 0xfff1a8,
      });
      sparkle.setDepth(3.5);
      s.setInteractive({ useHandCursor: true });
      this.items.push({ kind: 'gem', index: i, x: g.x, y: g.y, sprite: s, sparkle, done: false, blocked: false });
    });
    this.layout.presents.forEach((pp) => {
      const i = pp.index;
      if (presents[i]) return;
      const s = this.add.sprite(pp.x, pp.y + 4, presentKey(i), 0).setOrigin(0.5, 1).setDepth(3).setScale(0.8);
      s.play(ANIM.presentIdle(i % 4));
      s.setInteractive({ useHandCursor: true });
      this.items.push({ kind: 'present', index: i, game: pp.game, x: pp.x, y: pp.y - 60, sprite: s, done: false, blocked: false });
    });
  }

  private buildLoose() {
    const now = Date.now();
    this.loose.build(this.layout.loose, (i) => session.looseAvailable(this.zone, this.area, i, now), session.has('glowLantern'));
  }

  private addFlurries() {
    for (const f of this.layout.flurries) if (!session.befriended(f.kind)) this.flurries.add(f.kind, f.x, false, f.y ?? GROUND_Y);
    // befriended Flurries of this camp play near Marlow's stall on the Trail
    if (this.area === 0 && this.layout.stallX !== undefined) {
      [this.zone * 2, this.zone * 2 + 1].forEach((k, i) => {
        if (session.befriended(k) && k !== session.follower) this.flurries.add(k, this.layout.stallX! + 230 + i * 110, true);
      });
    }
  }

  private addDarkness() {
    const img = this.add.image(640, 480, TEX2.darkness).setScrollFactor(0).setDepth(56);
    let color = 0x121028;
    let alpha = 0.94;
    try {
      const px = this.textures.getPixel(2, 2, TEX2.darkness);
      if (px) {
        color = px.color;
        alpha = px.alpha / 255;
      }
    } catch {
      /* keep the default */
    }
    const rects = Array.from({ length: 4 }, () => this.add.rectangle(0, 0, 10, 10, color, alpha).setOrigin(0, 0).setScrollFactor(0).setDepth(56));
    const glow = this.add.circle(0, 0, 150, 0xffc93c, 0.12).setBlendMode(Phaser.BlendModes.ADD).setDepth(55);
    this.darkness = { img, rects, glow };
  }

  private updateDarkness() {
    const dk = this.darkness;
    if (!dk) return;
    const cam = this.cameras.main;
    const cx = Math.round(this.goat.x - cam.scrollX);
    const cy = Math.round(this.goat.y - 70 - cam.scrollY);
    dk.img.setPosition(cx, cy);
    const [l, r, t, b] = dk.rects;
    const x0 = cx - 640;
    const x1 = cx + 640;
    const y0 = cy - 480;
    const y1 = cy + 480;
    l.setPosition(0, 0).setSize(Math.max(0, x0), 960);
    r.setPosition(x1, 0).setSize(Math.max(0, 1280 - x1), 960);
    t.setPosition(0, 0).setSize(1280, Math.max(0, y0));
    b.setPosition(0, y1).setSize(1280, Math.max(0, 960 - y1));
    dk.glow.setPosition(this.goat.x, this.goat.y - 70);
  }

  /** (Re)builds the companions for the chosen hero and follower. */
  private syncTrail() {
    const guide = this.heroId !== 'juniper';
    this.trail.setup(session.follower, guide, this.hero.x, this.body.bottom, heroTextureKey(this, 'juniper', this.scarf));
  }

  /** The hero was changed while this scene is up (debug): re-skin and rebuild the companions. */
  private syncHero() {
    if (!this.goat || !this.trail) return;
    const h = session.hero;
    const f = session.follower;
    if (h !== this.heroId) {
      this.heroId = h;
      prepareHero(this, h, this.scarf);
      skinHero(this.goat, h, this.scarf);
      this.curAnim = '';
      this.syncTrail();
    } else if (f !== this.trail.flurryKind) this.syncTrail();
  }

  /** Celebratory toast for each newly unlocked hero (shown once per profile). */
  private heroToasts() {
    if (!this.sys.isActive() || !this.scene.isActive('Hud')) return;
    session.pendingHeroToasts().forEach((h, i) => {
      session.markHeroToast(h);
      this.time.delayedCall(i * 4800, () => {
        if (this.scene.isActive('Hud') || this.scene.isPaused('Hud')) this.hud.toast(heroUnlockToast(h), h);
      });
    });
  }

  private syncHat() {
    const h = session.p.hat;
    if (h < 0) {
      this.hat?.destroy();
      this.hat = null;
      return;
    }
    if (!this.hat) this.hat = this.add.image(0, 0, hatKey(h)).setOrigin(0.5, 1).setDepth(5.1).setScale(HERO_SCALE);
    else this.hat.setTexture(hatKey(h));
  }

  private arrowTexture() {
    const key = 'lp-hint-arrow';
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x1d1a3a, 1).fillTriangle(0, 0, 72, 0, 36, 56);
      g.fillStyle(0xffc93c, 1).fillTriangle(10, 6, 62, 6, 36, 44);
      g.generateTexture(key, 72, 56);
      g.destroy();
    }
    return key;
  }

  /** Tools bought (store overlay, debug): refresh doorways, hidden gems, hat. */
  private onSessionChange() {
    if (!this.sys.isActive() && !this.sys.isPaused()) return;
    this.doors?.refreshAll();
    this.syncHero();
    this.syncHat();
    const glow = session.has('glowLantern');
    if (glow && !this.glowSeen) {
      this.glowSeen = true;
      this.buildLoose();
    }
  }

  // ---------- input ----------

  private setupInput() {
    const K = Phaser.Input.Keyboard.KeyCodes;
    const kb = this.input.keyboard!;
    this.keys = {
      left: kb.addKey(K.LEFT),
      right: kb.addKey(K.RIGHT),
      up: kb.addKey(K.UP),
      a: kb.addKey(K.A),
      d: kb.addKey(K.D),
      w: kb.addKey(K.W),
      space: kb.addKey(K.SPACE),
    };
    const queueDrop = () => {
      this.dropQueuedUntil = this.time.now + 200;
      this.activity();
    };
    kb.on('keydown-DOWN', queueDrop);
    kb.on('keydown-S', queueDrop);
    const jump = () => {
      this.jumpBufferUntil = this.time.now + BUFFER_MS;
      this.hasTarget = false;
      this.pending = null;
      this.activity();
    };
    kb.on('keydown-UP', jump);
    kb.on('keydown-W', jump);
    kb.on('keydown-SPACE', jump);
    kb.on('keydown-B', () => this.ringBell());

    // `over` below must list every object under the finger (not just the top one) so a Flurry drawn in front of
    // a doorway, present or gem cannot swallow the tap: those are picked first, Flurries last
    this.input.topOnly = false;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.busy || this.leaving || p.y >= HUD_TOP || p.y < PACK_BOTTOM) return;
      this.activity();
      this.pending = null;
      if (this.oddJobBtn && over.includes(this.oddJobBtn.face)) return;
      if (this.sled && over.includes(this.sled)) {
        this.walkTo(this.layout.sledX! - 60, this.sledY - 10);
        if (Math.abs(this.hero.x - this.layout.sledX!) < 220) this.sledBlocked = false;
        return;
      }
      const item = this.items.find((it) => !it.done && over.includes(it.sprite));
      if (item) {
        if (this.near(item, 190) && this.onFloor()) {
          item.blocked = false;
          this.trigger(item);
        } else this.walkTo(item.x, item.y);
        return;
      }
      const door = this.doors.list.find((d) => over.includes(d.sprite));
      if (door) {
        this.useDoor(door);
        return;
      }
      if (this.stall && over.includes(this.stall)) {
        this.useStall();
        return;
      }
      // Flurries last: a shy one darting past a doorway or present must not steal that tap
      const fl = this.flurries.list.find((f) => over.includes(f.sprite));
      if (fl) {
        this.tapFlurry(fl);
        return;
      }
      this.heldPointer = p;
      this.walkTo(p.worldX, p.worldY);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.heldPointer === p) this.heldPointer = null;
    });
  }

  private onFloor() {
    return this.body.blocked.down || this.body.touching.down || this.riding !== null;
  }

  /** Jump is being held (keyboard, on-screen button, debug input, or an automatic tap-to-walk hop). */
  private jumpHeld(time: number) {
    const k = this.keys;
    return k.up.isDown || k.w.isDown || k.space.isDown || controls.jump || this.dbgUntil.jump > time;
  }

  private walkTo(x: number, y: number) {
    this.hasTarget = true;
    this.targetX = Phaser.Math.Clamp(x, 50, this.width - 50);
    this.targetSurface = this.surfaceUnderTap(this.targetX, y);
    this.autoJumps = 0;
    this.hopX = null;
  }

  private activity() {
    this.lastActive = this.time.now;
    if (this.hintFor && !this.hintSticky) this.clearHint();
  }

  // ---------- doorways, stall, Flurries ----------

  private nearDoor(d: Door) {
    return Math.abs(this.hero.x - d.def.x) < 140 && Math.abs(this.body.bottom - d.def.y) < 30 && this.onFloor();
  }

  private useDoor(d: Door) {
    const v = this.doors.verdict(d);
    if (v.kind === 'blocked') {
      this.sayLine(v.line);
      audio.sfx('wrong');
      wobble(this, d.sprite);
      const item = storeItem(v.tool);
      if (item && !session.canAfford(item.price)) this.time.delayedCall(4200, () => this.sayLine('v_oddjob'));
      return;
    }
    if (!this.nearDoor(d)) {
      this.walkTo(d.def.x, d.def.y - 10);
      this.pending = { kind: 'door', door: d };
      return;
    }
    this.pending = null;
    if (v.kind === 'break') {
      this.busy = true;
      this.hasTarget = false;
      this.body.setVelocityX(0);
      audio.sfx('ice_crack');
      this.doors.breakIce(d, () => {
        this.busy = false;
        this.say('Crack! The ice wall is gone. In we go!');
      });
      return;
    }
    this.goArea(d.def.to);
  }

  /** Walks through a doorway into another area of this camp. */
  goArea(to: number) {
    if (this.leaving) return;
    this.leaving = true;
    this.busy = true;
    this.hasTarget = false;
    this.body.setVelocityX(0);
    audio.sfx('door');
    this.cameras.main.fadeOut(300, 29, 26, 58);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('Hud');
      this.scene.start('World', { zone: this.zone, area: to, from: this.area });
    });
  }

  private useStall() {
    const x = this.layout.stallX!;
    if (Math.abs(this.hero.x - x) < 200 && this.onFloor()) this.openStore();
    else {
      this.walkTo(x, GROUND_Y - 10);
      this.pending = { kind: 'stall' };
    }
  }

  /** Marlow's Trading Post as an overlay over the paused world. */
  openStore() {
    if (this.busy || this.leaving) return;
    this.pending = null;
    this.hasTarget = false;
    this.heldPointer = null;
    this.body.setVelocityX(0);
    this.busy = true;
    controls.reset();
    audio.sfx('door');
    this.scene.pause();
    this.scene.pause('Hud');
    this.scene.launch('Store', {
      from: 'world',
      onClose: () => {
        this.scene.resume();
        this.scene.resume('Hud');
        controls.reset();
        this.input.keyboard?.resetKeys();
        this.busy = false;
        this.lastActive = -1;
        audio.setMusic(campPlace(this.zone));
        this.onSessionChange();
        this.hud.refresh(false);
      },
    });
    this.scene.bringToTop('Store');
  }

  private runPending() {
    const p = this.pending;
    if (!p || this.hasTarget || !this.onFloor()) return;
    this.pending = null;
    if (p.kind === 'door') {
      if (this.nearDoor(p.door)) this.useDoor(p.door);
    } else if (p.kind === 'stall') {
      if (Math.abs(this.hero.x - this.layout.stallX!) < 200) this.openStore();
    }
  }

  private tapFlurry(f: Flurry) {
    if (f.deco) {
      this.say(`Hi, ${this.flurryName(f.kind)}!`);
      this.tweens.add({ targets: f.sprite, scaleY: f.sprite.scaleY * 1.15, duration: 120, yoyo: true });
      audio.sfx('flurry');
      return;
    }
    if (!session.has('chimeBell')) {
      this.sayLine('v_flurry_shy');
      return;
    }
    this.ringBell();
  }

  private flurryName(kind: number) {
    return ['Puffle', 'Nib', 'Twigget', 'Hushwing', 'Glint', 'Drip', 'Tocky', 'Whirr', 'Auro', 'Starlet'][kind] ?? 'friend';
  }

  /** The Chime Bell: a nearby Flurry stops to listen and asks one Frost Lock riddle. */
  ringBell(): string {
    if (this.busy || this.leaving) return 'busy';
    if (!session.has('chimeBell')) {
      this.sayLine('v_flurry_shy');
      return 'no-bell';
    }
    this.activity();
    audio.sfx('bell');
    const fx = this.add.sprite(this.goat.x, this.goat.y - 190, TEX2.bellRing, 0).setDepth(45);
    if (this.anims.exists(ANIM2.bellRing)) {
      fx.play(ANIM2.bellRing);
      fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
    }
    this.tweens.add({ targets: fx, y: fx.y - 30, alpha: { from: 1, to: 0 }, delay: 500, duration: 400, onComplete: () => fx.destroy() });
    const range = session.has('silverBell') ? BELL_RANGE_SILVER : BELL_RANGE;
    const f = this.flurries.nearest(this.hero.x, range);
    if (!f) {
      const shyHere = this.flurries.list.some((x) => !x.deco);
      this.say(shyHere ? "No Flurry heard the bell. Let's get a bit closer and ring again!" : 'No shy Flurries here right now.');
      return 'none';
    }
    this.busy = true;
    this.hasTarget = false;
    this.heldPointer = null;
    this.body.setVelocityX(0);
    this.flurries.listen(f);
    audio.sfx('flurry');
    this.say('Shh... it is listening!');
    this.time.delayedCall(800, () => {
      this.busy = false;
      this.launchMiniGame('frostLock', 1, (ok) => {
        if (!ok) {
          this.flurries.shy(f, this.hero.x);
          this.say('It scampered off. We can try again!');
          return;
        }
        session.befriend(f.kind);
        this.busy = true;
        this.flurries.befriend(f, this.hero.x, () => {
          this.busy = false;
          audio.sfx('flurry');
          starBurst(this, f.sprite.x, f.sprite.y - 50, 0xd6fbff, 40, 14);
          const s = this.toScreen(f.sprite.x, f.sprite.y - 60);
          this.hud.flyIn('purse', s.x, s.y, TEX2.purse, 0, 70);
          this.sayLine('v_flurry_friend');
        });
      });
    });
    return `listening:${f.kind}`;
  }

  // ---------- hints ----------

  private clearHint() {
    this.hint.setVisible(false);
    this.hintGlow.setVisible(false);
    this.hintEdge.setVisible(false);
    this.tweens.killTweensOf(this.hint);
    this.tweens.killTweensOf(this.hintGlow);
    this.hintFor = null;
    this.hintItem = null;
    this.hintSticky = false;
  }

  /** Bobbing arrow + pulsing glow on a target; an edge arrow when it is off screen. */
  private pointAt(t: { x: number; y: number; kind?: string }, sticky: boolean, item: Item | null = null) {
    this.clearHint();
    this.hintFor = t;
    this.hintItem = item;
    this.hintSticky = sticky;
    this.hintUntil = this.time.now + 12000;
    // never let the bobbing arrow climb into the pack bar
    const top = Math.max(this.cameras.main.scrollY + PACK_BOTTOM + 30, t.y - (t.kind === 'present' ? 120 : 80));
    this.hint.setPosition(t.x, top).setVisible(true);
    this.tweens.add({ targets: this.hint, y: top - 24, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.hintGlow.setPosition(t.x, t.y).setScale(1).setAlpha(0.35).setVisible(true);
    this.tweens.add({ targets: this.hintGlow, scale: 1.5, alpha: 0.12, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private updateHint(time: number) {
    const t = this.hintFor;
    if (!t) return;
    if (this.hintSticky && (time > this.hintUntil || this.hintItem?.done)) {
      this.clearHint();
      return;
    }
    const cam = this.cameras.main;
    const sx = t.x - cam.scrollX;
    const on = sx > 60 && sx < GAME_W - 60;
    this.hint.setVisible(on);
    this.hintGlow.setVisible(on);
    if (on) this.hintEdge.setVisible(false);
    else {
      const left = sx <= 60;
      this.hintEdge
        .setVisible(true)
        .setRotation(left ? Math.PI / 2 : -Math.PI / 2)
        .setPosition(left ? 56 : GAME_W - 56, Phaser.Math.Clamp(t.y - cam.scrollY, 240, 720) + Math.sin(time / 210) * 10);
    }
  }

  /** What to point at when this area has nothing left: the sled, a doorway with treasure, or the gate. */
  private nextGoal(): { x: number; y: number; say: string } | null {
    const zp = session.p.zones[this.zone];
    if (this.area > 0) {
      const d = this.layout.doors[0];
      return { x: d.x, y: d.y - 150, say: "Let's head back to the trail!" };
    }
    const sled = { x: this.layout.sledX!, y: this.sledY - 180 };
    if (!zp.delivered && session.canLight(this.zone)) return { ...sled, say: "Let's take the lanterns to the sled!" };
    for (const d of this.layout.doors) {
      if (session.presentsLeftIn(this.zone, d.to) > 0) return { x: d.x, y: d.y - 150, say: 'More presents are through this doorway!' };
    }
    if (zp.delivered) return { x: this.layout.gateX!, y: (this.layout.gateY ?? GROUND_Y) - 300, say: "The gate is open! Let's go!" };
    return { ...sled, say: "Let's take the lanterns to the sled!" };
  }

  /** HUD hint button: Juniper points at the nearest thing to find and says where it is. */
  giveHint() {
    if (this.busy || this.leaving) return;
    const zp = session.p.zones[this.zone];
    if (this.area === 0 && !zp.delivered && session.canLight(this.zone)) {
      const sled = { x: this.layout.sledX!, y: this.sledY - 180 };
      const via = this.routeVia(sled);
      this.pointAt(via ?? sled, true);
      this.say(via ? "This way to the sled! We have enough lanterns!" : "We have enough lanterns! Let's take them to the sled!");
      return;
    }
    let best: Item | null = null;
    let bd = Infinity;
    for (const it of this.items) {
      if (it.done) continue;
      const d = Math.hypot(it.x - this.hero.x, (it.y - this.body.bottom) * 0.5);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    if (!best) {
      const g = this.nextGoal();
      if (g) {
        const via = this.routeVia(g);
        this.pointAt(via ?? g, true);
        this.say(via ? 'This way! ' + g.say : g.say);
      }
      return;
    }
    const word = best.kind === 'present' ? 'present' : 'sparkly gem';
    // a climb in between: point along the route (the next checkpoint) instead of straight through the rock
    const via = this.routeVia(best);
    if (via) {
      this.pointAt(via, true);
      this.say(`This way! There's a ${word} further along.`);
      return;
    }
    this.pointAt(best, true, best);
    const dx = best.x - this.hero.x;
    if (Math.abs(dx) < 170) this.say(best.y < this.body.bottom - 120 ? `The ${word} is up above us!` : `The ${word} is right here!`);
    else if (dx > 0) this.say(`There's a ${word} up ahead!`);
    else this.say('Back that way!');
  }

  /**
   * Where the hint should point on the way to `t`: the next checkpoint along the route when `t` is far away or high
   * above (a climb or a gap in between), else null (point at t itself).
   */
  private routeVia(t: { x: number; y: number }): { x: number; y: number } | null {
    const cps = this.cps.defs;
    if (!cps.length) return null;
    const hx = this.hero.x;
    const feet = this.body.bottom;
    const far = Math.abs(t.x - hx) > 650 || t.y < feet - 320;
    if (!far) return null;
    const dir = Math.sign(t.x - hx) || 1;
    let best: { x: number; y: number } | null = null;
    let bd = Infinity;
    // waypoints = checkpoints and arrow signs (they stand where the route turns): the nearest one ahead of the
    // hero, towards t (or above), that is not farther away than t itself
    const dT = Math.hypot(t.x - hx, (t.y - feet) * 0.7) * 1.2;
    const pts = [...cps, ...(this.layout.pieces.signs ?? [])];
    for (const c of pts) {
      const d = Math.hypot(c.x - hx, (c.y - feet) * 0.7);
      if (d < 160 || d >= dT) continue;
      const along = (c.x - hx) * dir > -200 || c.y < feet - 150;
      if (!along || d >= bd) continue;
      bd = d;
      best = { x: c.x, y: c.y - 120 };
    }
    return best;
  }

  // ---------- surfaces ----------

  /** The walkable surface a tap at (x, y) refers to: the nearest ledge top at/below the tap, or the ground. */
  private surfaceUnderTap(x: number, y: number) {
    return this.terrain.surfaceUnderTap(x, y);
  }

  /** The surface directly under a point (for shadows). */
  private surfaceBelow(x: number, feet: number): number | null {
    const a = this.terrain.supportBelow(x, feet);
    const b = this.movers.surfaceBelow(x, feet);
    if (a === null) return b;
    if (b === null) return a;
    return Math.min(a, b);
  }

  /** Index of the ledge Juniper is standing on (feet on its top surface), or -1. */
  private standingLedgeIndex() {
    return this.terrain.ledgeAt(this.hero.x, this.body.bottom);
  }

  /** Briefly switches off collision with ledge `i` so Juniper falls through it. */
  private dropThrough(i: number) {
    this.dropLedge = this.ledgeBodies[i];
    this.dropUntil = this.time.now + 450;
    this.body.setVelocityY(260);
    this.lastFloorAt = 0;
    this.jumpBufferUntil = 0;
  }

  /** Where to take off to reach `surface` near `tx`, or null if there is no route. */
  private jumpPointFor(tx: number, surface: number, feet: number): number | null {
    const rise = feet - surface;
    const maxRise = this.maxRise;
    if (rise <= maxRise) return tx;
    let bestX: number | null = null;
    let bestD = Infinity;
    for (const s of this.terrain.surfaces) {
      if (s.kind === 'ground') continue;
      const r = feet - s.y;
      if (r < 40 || r > maxRise) continue;
      const cx = (s.x0 + s.x1) / 2;
      const d = Math.abs(tx - cx);
      if (d < bestD) {
        bestD = d;
        bestX = Phaser.Math.Clamp(tx, s.x0 + 30, s.x1 - 30);
      }
    }
    return bestX;
  }

  private near(it: Item, dist: number) {
    return Math.abs(it.x - this.hero.x) < dist && Math.abs(it.y - (this.body.bottom - 70)) < dist;
  }

  // ---------- frame ----------

  update(time: number, delta: number) {
    if (!this.body) return;
    const b = this.body;
    const dt = Math.min(delta, 50);
    this.movers.update(dt);
    this.winds.update(this.movers.clock);
    this.runDebugInput(time);
    // moving / timed pieces: stay on the one being ridden (carried by its movement) or land on one
    const ignore = time < this.dropSurfUntil ? this.dropSurf : null;
    const was = this.riding;
    this.riding = this.respawning ? null : this.movers.resolve(b, this.prevBottom, this.riding, ignore);
    if (this.riding && this.riding === was) this.trail.carry(this.riding.id, this.riding.x - this.riding.prevX, this.riding.y - this.riding.prevY);
    const onFloor = b.blocked.down || b.touching.down || this.riding !== null;
    if (onFloor) {
      this.lastFloorAt = time;
      this.airJumped = false;
    }
    const held = this.jumpHeld(time) || this.autoHold;
    let dir = 0;

    if (!this.busy && !this.respawning) {
      const k = this.keys;
      const left = k.left.isDown || k.a.isDown || controls.left || this.dbgUntil.left > time;
      const right = k.right.isDown || k.d.isDown || controls.right || this.dbgUntil.right > time;
      if (controls.jumpQueued) {
        controls.jumpQueued = false;
        this.jumpBufferUntil = time + BUFFER_MS;
        this.hasTarget = false;
        this.pending = null;
        this.activity();
      }
      if (left || right) {
        this.hasTarget = false;
        this.heldPointer = null;
        this.pending = null;
        dir = (right ? 1 : 0) - (left ? 1 : 0);
        this.activity();
      } else if (this.hasTarget) {
        if (this.heldPointer && this.heldPointer.isDown) {
          this.heldPointer.positionToCamera(this.cameras.main, this.tmpVec);
          if (this.heldPointer.y < HUD_TOP) {
            this.targetX = Phaser.Math.Clamp(this.tmpVec.x, 50, this.width - 50);
            this.targetSurface = this.surfaceUnderTap(this.targetX, this.tmpVec.y);
          }
          this.activity();
        }
        dir = this.steer(onFloor, time);
      }
      if (time < this.dropQueuedUntil && onFloor) {
        this.dropQueuedUntil = 0;
        if (this.riding) {
          // drop through a moving / timed piece
          this.dropSurf = this.riding;
          this.dropSurfUntil = time + 450;
          this.riding = null;
          b.setVelocityY(260);
          this.lastFloorAt = 0;
          this.hasTarget = false;
          this.activity();
        } else {
          const li = this.standingLedgeIndex();
          if (li >= 0) {
            this.hasTarget = false;
            this.dropThrough(li);
            this.activity();
          }
        }
      }
      const canGround = onFloor || time - this.lastFloorAt < COYOTE_MS;
      if (time < this.jumpBufferUntil && canGround && b.velocity.y >= -10) {
        this.jumpBufferUntil = 0;
        b.setVelocityY(-this.jumpV);
        this.jumping = true;
        this.lastFloorAt = 0;
        this.riding = null;
      } else if (time < this.jumpBufferUntil && !canGround && !this.airJumped && session.has('cloudBoots') && !this.respawning) {
        // Cloud Boots: one extra jump in mid-air, with a little puff
        this.jumpBufferUntil = 0;
        this.airJumped = true;
        b.setVelocityY(-AIR_JUMP_V);
        this.jumping = true;
        audio.sfx('puff');
        this.puff.explode(10, this.hero.x, b.bottom);
      }
      // variable jump height: letting go early cuts the rise
      if (this.jumping) {
        if (b.velocity.y >= 0) this.jumping = false;
        else if (!held && !this.autoHold) {
          b.setVelocityY(b.velocity.y * JUMP_CUT);
          this.jumping = false;
        }
      }
      if (this.autoHold && b.velocity.y >= 0 && !onFloor) this.autoHold = false;
      // Feather Cape: hold jump while falling to glide
      if (!onFloor && held && b.velocity.y > GLIDE_FALL && session.has('featherCape') && !this.respawning) b.setVelocityY(GLIDE_FALL);
      // a jump pressed just after a bounce-pad launch still gives the bigger bounce
      if (time < this.padBoostUntil && held) {
        this.padBoostUntil = 0;
        b.setVelocityY(b.velocity.y - (PAD_V_HOLD - PAD_V));
      }
    }

    // walking: instant on snow and rock; slippery on ice unless the Grip Hooves are on
    const want = dir * this.speed;
    if (onFloor && !session.has('gripHooves') && this.terrain.onIce(this.hero.x, b.bottom)) {
      const rate = (dir !== 0 ? ICE_ACCEL : ICE_DECEL) * (dt / 1000);
      this.walkVx += Phaser.Math.Clamp(want - this.walkVx, -rate, rate);
    } else if (onFloor || dir !== 0) this.walkVx = want;
    else this.walkVx *= 0.9;
    if (b.blocked.left && this.walkVx < 0) this.walkVx = 0;
    if (b.blocked.right && this.walkVx > 0) this.walkVx = 0;
    // gusts push in the air; walking on the ground you feel some of it; standing still you hold your ground
    const wind = this.respawning ? 0 : this.winds.push(this.hero.x, b.center.y) * (onFloor ? (dir !== 0 ? 0.4 : 0) : 1);
    b.setVelocityX(this.walkVx + wind);
    if (dir !== 0) this.facing = dir;

    // bounce pads
    if (!this.respawning) {
      const pad = this.pads.hit(this.hero.x, b.bottom, b.velocity.y, time);
      if (pad) {
        b.setVelocityY(-(held ? PAD_V_HOLD : PAD_V));
        this.padBoostUntil = held ? 0 : time + 160;
        this.jumping = false;
        this.riding = null;
        this.lastFloorAt = 0;
        audio.sfx('bounce');
      }
    }

    this.platformChecks(time, onFloor);
    this.animate(onFloor, dir, delta);
    // on a moving piece the companions hop on and ride along (lifts, gears, pendulums, the helper cloud)
    const rp = this.riding && (this.riding.kind === 'lift' || this.riding.kind === 'gear' || this.riding.kind === 'pendulum' || this.riding.kind === 'helper') ? this.riding : null;
    this.trail.setRide(rp ? { x: rp.x, y: rp.y, half: rp.half } : null);
    this.trail.update(this.hero.x, b.bottom, time, onFloor, this.riding ? this.riding.id : -1);
    this.follow(delta, onFloor);
    this.flurries.update(delta, this.hero.x, b.bottom, time);
    if (!this.busy) {
      this.checkLoose(delta);
      this.checkItems(onFloor);
      this.checkCamp(onFloor);
      this.runPending();
      this.idleHint(time);
    }
    this.looseRespawn(delta);
    this.updateDarkness();
    this.updateHint(time);
    if (this.scene.isActive('Hud')) {
      const cam = this.cameras.main;
      // Juniper does the talking: from her own spot when she trots along as the guide
      const gp = this.trail.guidePos() ?? { x: this.goat.x, y: this.goat.y };
      this.hud.setAnchor(gp.x - cam.scrollX, gp.y - cam.scrollY - 150);
    }
    this.prevBottom = b.bottom;
  }

  // ---------- falls, checkpoints, helper cloud ----------

  private platformChecks(time: number, onFloor: boolean) {
    const b = this.body;
    if (this.respawning) return;
    if (b.top > FALL_Y) {
      this.fall(time);
      return;
    }
    const lit = this.cps.update(this.hero.x, b.bottom);
    if (lit >= 0 && this.movers.helperState !== 'hidden' && lit > this.movers.helperStretch && this.movers.helperState !== 'carry') this.movers.hideHelper();
    // a long drop below the last lit checkpoint (tall climbs) counts towards the helper cloud too
    if (!onFloor) this.peakFeet = Math.min(this.peakFeet, b.bottom);
    else {
      // only on a climb (the next checkpoint is higher up) and inside that stretch: dropping down on purpose elsewhere is fine
      const cp = this.cps.defs[this.cps.last];
      const next = this.cps.defs[this.cps.last + 1];
      const inStretch = !!cp && !!next && next.y < cp.y - 100 && this.hero.x > Math.min(cp.x, next.x) - 300 && this.hero.x < Math.max(cp.x, next.x) + 300;
      if (cp && inStretch && b.bottom - this.peakFeet > DEEP_DROP && b.bottom - cp.y > DEEP_DROP && time > this.invulnUntil) {
        if (this.peakFeet < cp.y - 40) {
          // fell from the climb above the checkpoint all the way down: float back up, as after a gap
          this.peakFeet = b.bottom;
          this.fall(time);
          return;
        }
        this.dbgStats.falls++;
        if (this.cps.recordFall()) this.callHelper();
      }
      this.peakFeet = b.bottom;
    }
  }

  /** Fell into a gap: a soft poof, then float back to the last lit checkpoint (or the entrance). Nothing is lost. */
  private fall(time: number) {
    const b = this.body;
    const counted = time > this.invulnUntil;
    this.respawning = true;
    this.hasTarget = false;
    this.pending = null;
    this.riding = null;
    this.jumping = this.autoHold = false;
    this.walkVx = 0;
    audio.sfx('poof');
    this.puff.explode(26, this.hero.x, Math.min(WORLD_BOTTOM - 60, b.bottom - 40));
    b.setVelocity(0, 0);
    b.setAllowGravity(false);
    this.goat.setVisible(false);
    this.hat?.setVisible(false);
    this.shadow.setVisible(false);
    if (counted) this.dbgStats.falls++;
    // nothing carries on after a fall: held debug keys and queued steps are dropped
    this.dbgUntil = { left: 0, right: 0, jump: 0, down: 0 };
    this.dbgQueue = [];
    this.jumpBufferUntil = 0;
    const helperNow = counted && this.cps.recordFall();
    this.time.delayedCall(520, () => {
      if (!this.sys.isActive()) return;
      const r = this.cps.respawn(this.entry);
      b.reset(r.x, r.y - BODY_H / 2 - 70);
      b.setAllowGravity(false);
      b.setVelocity(0, 140);
      this.prevBottom = b.bottom;
      this.peakFeet = r.y;
      this.camY = r.y;
      this.trail.reset(r.x, r.y);
      this.goat.setVisible(true).setAlpha(0);
      this.hat?.setVisible(true);
      this.tweens.add({ targets: this.goat, alpha: 1, duration: 380 });
      this.puff.explode(16, r.x, r.y - 60);
      this.time.delayedCall(500, () => {
        b.setAllowGravity(true);
        this.respawning = false;
        this.invulnUntil = this.time.now + 1500;
        if (helperNow) this.callHelper();
      });
    });
  }

  /** Third fall in a stretch: the helper cloud appears at its start and Juniper says so. */
  private callHelper() {
    const path = this.cps.ferry();
    if (!path || path.length < 2) return;
    this.movers.showHelper(path, this.cps.last);
    this.sayLine('v_helper');
  }

  /** Loose gems come back LOOSE_RESPAWN_MS after their saved pickup time: re-checked on a slow timer too. */
  private looseRespawn(delta: number) {
    this.looseTimer += delta;
    if (this.looseTimer < LOOSE_CHECK_MS) return;
    this.looseTimer = 0;
    this.refreshLoose();
  }

  /** Rebuilds the loose gems if any picked-up one is due back. Returns how many came back. */
  refreshLoose(): number {
    const now = Date.now();
    const have = new Set(this.loose.list.filter((g) => !g.taken).map((g) => g.index));
    const glow = session.has('glowLantern');
    let back = 0;
    this.layout.loose.forEach((d, i) => {
      if ((d.hidden && !glow) || have.has(i)) return;
      if (session.looseAvailable(this.zone, this.area, i, now)) back++;
    });
    if (back > 0) this.buildLoose();
    return back;
  }

  /** Tap-to-walk steering with auto-hop onto ledges and rock steps; stops at the edge of a gap. Returns the walk direction. */
  private steer(onFloor: boolean, time: number): number {
    const x = this.hero.x;
    const feet = this.body.bottom;
    let goalX = this.targetX;
    const rise = feet - this.targetSurface;
    if (onFloor && rise < -60) {
      const li = this.standingLedgeIndex();
      if (li >= 0 && Math.abs(this.targetX - this.ledges[li].x) <= LEDGE_HALF + 20) this.dropThrough(li);
    }
    if (rise > 40) {
      // aim at the ledge to hop onto; in the air keep aiming at it (the long Spring Hooves jump would overshoot a small ledge otherwise)
      let jx: number | null;
      if (onFloor) {
        jx = this.jumpPointFor(this.targetX, this.targetSurface, feet);
        this.hopX = jx;
      } else jx = this.hopX;
      if (jx !== null) {
        goalX = jx;
        if (onFloor && Math.abs(x - jx) < 70 && this.autoJumps < 3) {
          this.autoJumps++;
          this.jumpBufferUntil = time + 100;
          this.autoHold = true;
        }
      }
      if (jx === null || this.autoJumps >= 3) goalX = this.targetX;
    }
    const dx = goalX - x;
    if (Math.abs(dx) < 12) {
      if (onFloor && (rise <= 40 || this.autoJumps >= 3) && !this.heldPointer) this.hasTarget = false;
      return 0;
    }
    const dir = dx > 0 ? 1 : -1;
    if (onFloor && !this.riding) {
      const ahead = x + dir * (BODY_W / 2 + 10);
      const wall = this.terrain.wallTopAt(ahead, feet);
      if (wall !== null) {
        // a rock step in the way: hop up when it is low enough, else stop in front of it
        if (feet - wall <= this.maxRise && this.autoJumps < 4) {
          if (time >= this.jumpBufferUntil) {
            this.autoJumps++;
            this.jumpBufferUntil = time + 100;
            this.autoHold = true;
          }
        } else {
          this.hasTarget = false;
          this.walkVx = 0;
          return 0;
        }
      } else {
        // walk as far as is safe: stop at the edge of a gap or a big drop instead of walking off
        const sup = this.terrain.supportBelow(ahead, feet, 0);
        const dropOk = sup !== null && (sup - feet < 330 || Math.abs(sup - this.targetSurface) < 4);
        if (!dropOk) {
          this.hasTarget = false;
          this.walkVx = 0;
          return 0;
        }
      }
    }
    return dir;
  }

  private animFor(base: string) {
    return heroAnimKey(this, base, this.heroId, this.scarf);
  }

  private play(key: string) {
    if (this.curAnim === key) return;
    this.curAnim = key;
    this.goat.play(key, true);
  }

  private animate(onFloor: boolean, dir: number, delta: number) {
    const b = this.body;
    this.goat.x = this.hero.x;
    this.goat.y = b.bottom + 4;
    this.goat.setFlipX(this.facing < 0);
    if (!this.busy || this.curAnim !== this.animFor(ANIM.cheer)) {
      if (!onFloor) {
        this.play(b.velocity.y < 0 ? this.animFor(ANIM.jumpUp) : this.animFor(ANIM.jumpFall));
        this.airTime += delta;
      } else {
        this.play(dir !== 0 ? this.animFor(ANIM.walk) : this.animFor(ANIM.idle));
      }
    }
    if (onFloor && !this.wasOnFloor && this.airTime > 120) {
      this.tweens.add({
        targets: this.goat,
        scaleY: HERO_SCALE * 0.85,
        scaleX: HERO_SCALE * 1.12,
        duration: 80,
        yoyo: true,
        onComplete: () => this.goat.setScale(HERO_SCALE),
      });
    }
    if (onFloor) this.airTime = 0;
    this.wasOnFloor = onFloor;
    if (onFloor && dir !== 0) {
      this.stepTimer -= delta;
      if (this.stepTimer <= 0) {
        audio.sfx('step');
        this.stepTimer = 290;
      }
    } else this.stepTimer = 60;
    if (this.hat) {
      // the art module knows where the skull is in every hero frame
      const fr = Number(this.goat.frame.name) || 0;
      const a = heroHat(this, this.heroId, this.scarf, fr);
      const f = this.facing;
      this.hat
        .setPosition(this.goat.x + a.dx * this.goat.scaleX * f, this.goat.y + a.dy * this.goat.scaleY)
        .setRotation(a.rot * f)
        .setScale(a.scale * this.goat.scaleX)
        .setFlipX(f < 0);
    }
    const surf = this.surfaceBelow(this.hero.x, b.bottom) ?? WORLD_BOTTOM + 400;
    const gap = surf - b.bottom;
    const h = Math.min(1, gap / 400);
    this.shadow.setVisible(!onFloor && gap > 8 && gap < 700 && !this.respawning);
    this.shadow.setPosition(this.hero.x, surf);
    this.shadow.setScale(1 - h * 0.5);
    this.shadow.setAlpha(0.35 * (1 - h * 0.6));
  }

  private follow(delta: number, onFloor: boolean) {
    const want = -150 * this.facing;
    this.lead += (want - this.lead) * Math.min(1, delta / 600);
    const cam = this.cameras.main;
    cam.setFollowOffset(this.lead, CAM_LOOK_UP);
    // vertical: follow the surface the hero stands on; mid-jump only when leaving a comfortable band
    const feet = this.body.bottom;
    if (onFloor || feet > this.camY + 170 || feet < this.camY - 330) this.camY += (feet - this.camY) * Math.min(1, delta / (onFloor ? 260 : 140));
    this.camTarget.x = this.goat.x;
    this.camTarget.y = this.camY;
    const sx = cam.scrollX;
    for (let i = 0; i < this.bg.length; i++) this.bg[i].tile.tilePositionX = sx * this.bg[i].f + (this.area > 0 ? 400 * this.area : 0);
    // scrollY is 0 at the bottom of every area and negative above it: the mid/near layers only ever sink
    const climb = Math.max(0, -cam.scrollY);
    for (let i = 0; i < this.bgMid.length; i++) this.bgMid[i].tile.y = 480 + climb * this.bgMid[i].k;
  }

  // ---------- loose gems ----------

  private checkLoose(delta: number) {
    const got = this.loose.update(delta, this.hero.x, this.body.center.y, session.has('gemMagnet'));
    for (const g of got) {
      session.takeLoose(this.zone, this.area, g.index);
      audio.sfx('loose_gem');
      const s = this.toScreen(g.sprite.x, g.sprite.y);
      starBurst(this, g.sprite.x, g.sprite.y, 0x8fe6f2, 40, 5);
      this.hud.flyIn('purse', s.x, s.y, TEX2.looseGem, 0, 48);
      g.sprite.destroy();
    }
  }

  // ---------- items ----------

  /** Pickups only trigger while Juniper stands on something; mid-jump overlaps fire on landing. */
  private checkItems(onFloor: boolean) {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (it.done) continue;
      const hit = Math.abs(it.x - this.hero.x) < 80 && Math.abs(it.y - (this.body.bottom - 60)) < 100;
      if (it.blocked) {
        if (!this.near(it, 170)) it.blocked = false;
        continue;
      }
      if (hit && onFloor) {
        this.trigger(it);
        return;
      }
    }
  }

  private trigger(it: Item) {
    if (this.busy || it.done) return;
    this.busy = true;
    this.hasTarget = false;
    this.heldPointer = null;
    this.pending = null;
    this.body.setVelocityX(0);
    this.activity();
    if (it.kind === 'gem') {
      this.launchMiniGame('frostLock', 1, (ok) => (ok ? this.collectGem(it) : (it.blocked = true)));
      return;
    }
    audio.sfx('present_shake');
    it.sprite.play(ANIM.presentShake(it.index % 4));
    this.time.delayedCall(450, () => {
      this.launchMiniGame(it.game ?? 'frostLock', 3, (ok) => {
        if (ok) this.openPresent(it);
        else {
          it.blocked = true;
          it.sprite.play(ANIM.presentIdle(it.index % 4));
        }
      });
    });
  }

  /** Opens a mini game over the paused world. Unregistered games fall back to Frost Lock x3. */
  private launchMiniGame(id: MiniGameId, rounds: number, done: (completed: boolean) => void) {
    // hidden Dad mode: every present (3 rounds), frost gem and Flurry riddle (1 round) is Dad Lab
    if (session.dadMode) id = 'dadLab';
    let key = miniGameSceneKey(id);
    if (!this.game.scene.getScene(key)) {
      id = 'frostLock';
      key = miniGameSceneKey(id);
      rounds = 3;
    }
    this.busy = true;
    controls.reset();
    this.scene.pause();
    this.scene.pause('Hud');
    this.scene.launch(key, {
      id,
      zone: this.zone,
      rounds,
      onDone: ({ completed }: { completed: boolean }) => {
        this.scene.resume();
        this.scene.resume('Hud');
        controls.reset();
        this.input.keyboard?.resetKeys();
        this.busy = false;
        this.lastActive = -1; // the paused clock is stale; restart the idle timer next frame
        this.hud.refresh(false);
        done(completed);
      },
    });
    this.scene.bringToTop(key);
  }

  private toScreen(x: number, y: number) {
    const cam = this.cameras.main;
    return { x: x - cam.scrollX, y: y - cam.scrollY };
  }

  private collectGem(it: Item) {
    it.done = true;
    session.collectGem(this.zone, it.index);
    this.trail.celebrate(this.time.now);
    audio.sfx('gem');
    starBurst(this, it.sprite.x, it.sprite.y, 0xfff1a8, 40);
    const s = this.toScreen(it.sprite.x, it.sprite.y);
    this.hud.flyIn('gem', s.x, s.y, gemKey(it.index), 0, 80);
    this.hud.flyIn('purse', s.x, s.y, TEX2.looseGem, 0, 60);
    it.sparkle?.destroy();
    it.sprite.destroy();
  }

  private openPresent(it: Item) {
    it.done = true;
    this.busy = true;
    session.openPresent(this.zone, it.index);
    this.trail.celebrate(this.time.now);
    this.time.delayedCall(1500, () => this.heroToasts());
    audio.sfx('present_open');
    audio.voice('v_present');
    it.sprite.play(ANIM.presentBurst(it.index % 4));
    const px = it.sprite.x;
    const py = it.sprite.y - 100;
    starBurst(this, px, py, 0xffc93c, 40, 14);
    const lan = this.add.image(px, py, TEX.lantern, 1).setDepth(40).setScale(0.2);
    this.tweens.add({ targets: lan, y: py - 130, scale: 0.9, duration: 450, ease: 'Back.easeOut' });
    this.time.delayedCall(850, () => {
      const s = this.toScreen(lan.x, lan.y);
      this.hud.flyIn('lantern', s.x, s.y, TEX.lantern, 1, 80);
      lan.destroy();
      this.busy = false;
      this.afterLantern();
    });
    this.tweens.add({ targets: it.sprite, alpha: 0, delay: 1300, duration: 500, onComplete: () => it.sprite.destroy() });
  }

  private afterLantern() {
    const n = session.lanternCount(this.zone);
    const lit = session.p.zones[this.zone].delivered;
    if (n >= PRESENTS_PER_ZONE) {
      this.time.delayedCall(700, () => {
        confetti(this, this.goat.x, this.goat.y - 300, 45);
        audio.sfx('win');
        this.sayLine('v_star');
      });
    } else if (n === LANTERNS_TO_LIGHT && !lit) this.sayLine('v_camp4');
    else if (!lit) {
      const left = LANTERNS_TO_LIGHT - n;
      this.say(`${left} more lantern${left === 1 ? '' : 's'} to light the camp!`);
    }
  }

  // ---------- camp ----------

  private checkCamp(onFloor: boolean) {
    if (this.area !== 0 || this.layout.sledX === undefined) return;
    const zp = session.p.zones[this.zone];
    const dx = Math.abs(this.hero.x - this.layout.sledX);
    const atSled = Math.abs(this.body.bottom - this.sledY) < 40;
    if (zp.delivered) {
      if (this.hero.x > this.layout.gateX! - 40 && Math.abs(this.body.bottom - (this.layout.gateY ?? GROUND_Y)) < 80 && !this.leaving) this.leave();
      return;
    }
    if (this.sledBlocked) {
      if (dx > 260) this.sledBlocked = false;
      return;
    }
    if (dx < 170 && onFloor && atSled) {
      if (session.canLight(this.zone)) this.deliver();
      else {
        this.sledBlocked = true;
        const n = session.lanternCount(this.zone);
        const left = LANTERNS_TO_LIGHT - n;
        this.say(n === 0 ? `The sled needs ${left} lanterns. Let's open the presents!` : `We need ${left} more lantern${left === 1 ? '' : 's'}!`);
      }
    }
  }

  private deliver() {
    this.busy = true;
    this.hasTarget = false;
    this.pending = null;
    this.body.setVelocityX(0);
    this.facing = 1;
    this.play(this.animFor(ANIM.cheer));
    const sledX = this.layout.sledX!;
    const count = Math.min(PRESENTS_PER_ZONE, session.lanternCount(this.zone));
    const placed: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(250 + i * 380, () => {
        const sx = this.hero.x;
        const sy = this.body.bottom - 160;
        const tx = sledX - 125 + i * 50;
        const ty = this.sledY - 150;
        const lan = this.add.image(sx, sy, TEX.lantern, 0).setDepth(6).setScale(0.5);
        placed.push(lan);
        this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 420,
          onUpdate: (tw) => {
            const t = tw.getValue() ?? 0;
            lan.x = sx + (tx - sx) * t;
            lan.y = sy + (ty - sy) * t - Math.sin(Math.PI * t) * 120;
          },
          onComplete: () => {
            lan.setFrame(1);
            audio.sfx('gem');
            starBurst(this, tx, ty, 0xffc93c, 7, 8);
          },
        });
      });
    }
    this.time.delayedCall(250 + count * 380 + 400, () => {
      this.sled?.setFrame(1);
      placed.forEach((l) => this.tweens.add({ targets: l, alpha: 0, duration: 400, onComplete: () => l.destroy() }));
      session.deliver(this.zone);
      this.trail.celebrate(this.time.now);
      audio.sfx('camp');
      audio.voice('v_camp');
      confetti(this, sledX, this.sledY - 260, 45);
      const s = this.toScreen(sledX, this.sledY - 200);
      this.hud.flyIn('purse', s.x, s.y, TEX2.purse, 0, 80);
      const gate = this.gate!;
      gate.setTint(0xd6fbff);
      this.tweens.add({
        targets: gate,
        alpha: { from: 1, to: 0.4 },
        duration: 300,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          gate.clearTint().setFrame(1).setAlpha(1);
          starBurst(this, this.layout.gateX!, (this.layout.gateY ?? GROUND_Y) - 180, 0xd6fbff, 7, 16);
        },
      });
      this.gateWall?.destroy();
      this.gateWall = null;
      this.hud.refresh(false);
      const last = this.zone === NUM_ZONES - 1;
      const more = !session.goldStar(this.zone);
      this.say(
        last
          ? 'The festival lantern is next! Walk through the gate.'
          : more
            ? 'The camp is lit! The gate is open. Or we can find the last lanterns for a gold star!'
            : 'The camp is lit! The gate is open!',
      );
      this.time.delayedCall(1200, () => (this.busy = false));
    });
  }

  private leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.busy = true;
    const last = this.zone === NUM_ZONES - 1;
    this.cameras.main.fadeOut(400, 29, 26, 58);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('Hud');
      this.scene.start(last && !session.p.finished ? 'Finale' : 'Map');
    });
  }

  // ---------- helpers ----------

  private say(text: string, voice?: string, ms?: number) {
    if (this.scene.isActive('Hud') || this.scene.isPaused('Hud')) this.hud.say(text, voice, ms);
  }

  private sayLine(id: LineId) {
    this.say(LINES[id], id);
  }

  private idleHint(time: number) {
    if (this.lastActive < 0) this.lastActive = time;
    if (time - this.lastActive < IDLE_HINT_MS || this.hintFor) return;
    let best: { x: number; y: number } | null = null;
    let bd = Infinity;
    for (const it of this.items) {
      if (it.done) continue;
      const d = Math.abs(it.x - this.hero.x);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    if (!best) best = this.nextGoal();
    if (!best) return;
    const via = this.routeVia(best);
    if (via) {
      this.pointAt(via, false);
      return;
    }
    this.pointAt(best, false, 'kind' in best ? (best as Item) : null);
  }

  // ---------- debug ----------

  state() {
    const zp = session.profile?.zones[this.zone];
    return {
      zone: this.zone,
      area: this.area,
      areaName: this.layout.name,
      x: Math.round(this.hero?.x ?? 0),
      feet: Math.round(this.body?.bottom ?? 0),
      onFloor: !!this.body && this.onFloor(),
      busy: this.busy,
      gems: zp?.gems.filter(Boolean).length ?? 0,
      lanterns: zp?.presents.filter(Boolean).length ?? 0,
      delivered: zp?.delivered ?? false,
      goldStar: session.goldStar(this.zone),
      itemsLeft: this.items.filter((i) => !i.done).map((i) => `${i.kind}${i.index}@${i.x}`),
      looseLeft: this.loose?.remaining() ?? 0,
      doors: this.doors?.list.map((d) => ({ to: d.def.to, x: d.def.x, y: d.def.y, gates: d.def.gates, verdict: this.doors.verdict(d).kind })) ?? [],
      flurries: this.flurries?.list.map((f) => ({ kind: f.kind, x: Math.round(f.sprite.x), state: f.state, friend: f.deco })) ?? [],
      dark: this.layout.dark,
      hero: this.heroId,
      heroSheet: this.goat?.texture.key ?? null,
      follower: this.trail?.flurryKind ?? -1,
      guide: !!this.trail?.guide,
      followerPos: this.trail?.flurry ? { x: Math.round(this.trail.flurry.x), y: Math.round(this.trail.flurry.y) } : null,
      guidePos: this.trail?.guide ? { x: Math.round(this.trail.guide.x), y: Math.round(this.trail.guide.y) } : null,
      // v4 platforming
      feetY: Math.round(this.body?.bottom ?? 0),
      vy: Math.round(this.body?.velocity.y ?? 0),
      vx: Math.round(this.body?.velocity.x ?? 0),
      onGround: !!this.body && this.onFloor(),
      riding: this.riding ? this.riding.kind + '#' + this.riding.id : null,
      heightScreens: this.layout.heightScreens,
      camY: Math.round(this.cameras.main.scrollY),
      checkpoint: this.cps?.last ?? -1,
      checkpointsLit: this.cps?.lit.map((l, i) => (l ? i : -1)).filter((i) => i >= 0) ?? [],
      fallsInStretch: this.cps ? this.cps.falls.falls(this.cps.last) : 0,
      fallsTotal: this.dbgStats.falls,
      helperCloud: this.movers ? this.movers.helperState : 'hidden',
      respawning: this.respawning,
      onIce: !!this.terrain && !!this.body && this.terrain.onIce(this.hero.x, this.body.bottom),
      inputQueue: this.dbgQueue.length,
    };
  }

  /** Debug: every platforming piece and checkpoint with its current position. */
  listPieces() {
    const L = this.layout;
    return {
      movers: this.movers.describe(),
      checkpoints: (L.pieces.checkpoints ?? []).map((c, i) => ({ i, x: c.x, y: c.y, lit: this.cps.lit[i], ferry: !!c.ferry })),
      pads: (L.pieces.pads ?? []).map((p) => ({ x: p.x, y: p.y })),
      blocks: L.pieces.blocks ?? [],
      pits: L.pits,
      ice: L.pieces.ice ?? [],
      winds: (L.pieces.winds ?? []).map((w, i) => ({ ...w, strength: Math.round(this.winds.strength(i) * 100) / 100 })),
      ledges: L.ledges,
      clock: Math.round(this.movers.clock),
    };
  }

  /** Debug: lights checkpoint i and stands the hero on it. */
  toCheckpoint(i: number) {
    if (!this.cps.force(i)) return false;
    const c = this.cps.defs[i];
    this.teleport(c.x, c.y);
    this.camY = c.y;
    return true;
  }

  /** Debug: a pit fall right now (as if the hero dropped into the mist). */
  fallNow() {
    if (this.respawning) return 'respawning';
    this.fall(this.time.now);
    return 'fell';
  }

  /** Debug: holds a key (left, right, jump, down) for ms through the game's own input state. */
  hold(key: 'left' | 'right' | 'jump' | 'down', ms: number) {
    const t = this.time.now;
    if (key === 'jump') {
      this.jumpBufferUntil = t + BUFFER_MS;
      this.hasTarget = false;
    }
    if (key === 'down') this.dropQueuedUntil = t + 200;
    this.dbgUntil[key] = t + Math.max(16, ms);
    this.activity();
  }

  /**
   * Debug: runs a sequence of held inputs and resolves when done, e.g.
   * [{ keys: 'right', ms: 800 }, { keys: 'right+jump', ms: 300 }, { keys: '', ms: 500 }, { keys: 'right', toX: 2400 }].
   * keys: '+'-joined left/right/jump/down ('' = wait). toX: hold the direction until x passes toX (max ms, default 8 s).
   */
  inputSeq(seq: { keys: string; ms?: number; toX?: number }[]): Promise<Record<string, unknown>> {
    this.dbgQueue = seq.map((s) => ({ keys: s.keys ? s.keys.split('+') : [], ms: s.ms ?? (s.toX !== undefined ? 8000 : 300), toX: s.toX }));
    this.dbgStats.t0 = this.time.now;
    const falls0 = this.dbgStats.falls;
    return new Promise((res) => {
      this.dbgDone = (r) => res({ ...r, falls: this.dbgStats.falls - falls0 });
    });
  }

  private runDebugInput(time: number) {
    const q = this.dbgQueue;
    if (!q.length) {
      if (this.dbgDone) {
        const done = this.dbgDone;
        this.dbgDone = null;
        done({ ms: Math.round(time - this.dbgStats.t0), x: Math.round(this.hero.x), feet: Math.round(this.body.bottom), onGround: this.onFloor() });
      }
      return;
    }
    const step = q[0];
    if (step.started === undefined) {
      step.started = time;
      for (const k of step.keys) this.hold(k as 'left' | 'right' | 'jump' | 'down', step.ms);
    }
    const reached = step.toX !== undefined && (step.keys.includes('right') ? this.hero.x >= step.toX : this.hero.x <= step.toX);
    if (time - step.started >= step.ms || reached) {
      if (reached) for (const k of step.keys) this.dbgUntil[k as 'left'] = 0;
      q.shift();
    } else if (step.toX !== undefined) for (const k of step.keys) this.dbgUntil[k as 'left'] = time + 50;
  }

  teleport(x: number, y?: number) {
    this.body.reset(x, (y ?? GROUND_Y) - BODY_H / 2 - 2);
    this.trail?.reset(x, this.body.bottom);
    this.hasTarget = false;
    this.pending = null;
    this.riding = null;
    this.walkVx = 0;
    this.prevBottom = this.body.bottom;
    this.peakFeet = this.body.bottom;
    this.camY = this.body.bottom;
  }

  touchGem(i: number) {
    const it = this.items.find((t) => t.kind === 'gem' && t.index === i && !t.done);
    if (it) this.trigger(it);
    return !!it;
  }

  touchPresent(i: number) {
    const it = this.items.find((t) => t.kind === 'present' && t.index === i && !t.done);
    if (it) this.trigger(it);
    return !!it;
  }

  /** Taps Flurry number i of this area (as listed in state().flurries). */
  touchFlurry(i: number) {
    const f = this.flurries.list[i];
    if (!f) return 'no-flurry';
    this.teleport(Phaser.Math.Clamp(f.sprite.x - 260, 60, this.width - 60));
    this.tapFlurry(f);
    return `tapped:${f.kind}`;
  }

  /** Taps the doorway leading to area `to` (as a click would). */
  touchDoor(to: number) {
    const d = this.doors.find(to);
    if (!d) return 'no-door';
    const v = this.doors.verdict(d).kind;
    this.useDoor(d);
    return v;
  }

  goToSled() {
    if (this.layout.sledX === undefined) return;
    this.teleport(this.layout.sledX - 300, this.sledY);
    this.walkTo(this.layout.sledX, this.sledY - 10);
  }

  /** Marks everything in this camp found (all areas): frost gems and presents. */
  collectRest() {
    for (const it of this.items) {
      if (it.done) continue;
      it.done = true;
      it.sparkle?.destroy();
      it.sprite.destroy();
    }
    const zp = session.p.zones[this.zone];
    zp.gems.forEach((_, i) => session.collectGem(this.zone, i));
    zp.presents.forEach((_, i) => session.openPresent(this.zone, i));
    if (this.scene.isActive('Hud')) this.hud.refresh(true);
  }
}
