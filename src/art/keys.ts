// Contract between the art modules (src/art/*) and the game scenes.
// The art side must create every texture and animation listed here in
// registerArt(scene); the game side uses only these keys.

/** Texture keys. Sprite sheets have numbered frames 0..n-1. Origin conventions in comments. */
export const TEX = {
  /** Juniper sprite sheet. Frame size JUNIPER_FRAME. Feet at bottom-centre of the frame (origin 0.5, 1), facing right. */
  juniper: 'juniper',
  /** Gem sheets, 4 twinkle frames, 96x96, one per colour. Use gemKey(i). */
  gem: 'gem',
  /** Present sheet 160x160: frames 0-1 idle wobble, 2-4 shake, 5-8 burst open (8 = open box with glow). Origin 0.5,1. One per colour: presentKey(i). */
  present: 'present',
  /** Lantern, 2 frames (unlit, lit), 96x128. */
  lantern: 'lantern',
  /** Camp sled 320x220, 2 frames (empty, loaded with lit lanterns). Origin 0.5,1. */
  sled: 'sled',
  /** Camp gate 200x360, 2 frames (frozen shut, open). Origin 0.5,1. */
  gate: 'gate',
  /** Bluster the storm cloud, 4 frames 220x180 (idle a, idle b, puffing, happy). */
  bluster: 'bluster',
  /** Trail friends, 2 frames each (idle, talk), 200x220, origin 0.5,1: friendKey('pip'|'marlow'|'odette'). */
  friend: 'friend',
  /** Particles: single small textures. */
  snowflake: 'p-snow', // 16x16 soft white dot
  star: 'p-star', // 32x32 four-point star, white (tint it)
  confetti: 'p-confetti', // 16x10 white rect (tint it)
  /** Ice ledge platform, 3-slice friendly: 240x56, origin 0.5,0 = walkable top edge. */
  ledge: 'ledge',
  /** UI kit */
  panel: 'ui-panel', // 9-slice wood panel 192x192, corner 48
  button: 'ui-button', // 2 frames (up, down) 320x120, 9-slice corner 40
  buttonRound: 'ui-button-round', // 2 frames (up, down) 128x128
  iconLeft: 'ic-left', iconRight: 'ic-right', iconJump: 'ic-jump', // 96x96 white-with-ink icons
  iconSound: 'ic-sound', // 2 frames (on, muted) 96x96
  iconHint: 'ic-hint', iconBack: 'ic-back', iconGem: 'ic-gem', iconLantern: 'ic-lantern', iconPresent: 'ic-present',
  /** Math manipulatives */
  coin: 'coin', // frames 0..5 = 1c, 5c, 10c, 25c, $1 bill, $5 bill; each 128x128 (bills drawn inside)
  pvGem: 'pv-gem', // frames 0..3 = ones gem, tens bar, hundreds slab, thousands block; 128x128
  snowball: 'snowball', // 64x64
  clockFace: 'clock-face', // 520x520 face with numbers and minute ticks, no hands
  clockHandHour: 'clock-hand-h', // 40x170, pivot at bottom-centre (origin 0.5, 0.9)
  clockHandMinute: 'clock-hand-m', // 28x230, pivot at bottom-centre (origin 0.5, 0.93)
  plank: 'plank', // ice plank 220x90 (answer button for Ice Bridge), 2 frames (normal, placed)
  crate: 'crate', // 300x220 open crate for Gem Sort
  logo: 'logo', // title art 900x360 "Lantern Peak"
} as const;

export const JUNIPER_FRAME = { w: 200, h: 200 };

/** Animation keys on the juniper sheet (created by registerArt). */
export const ANIM = {
  idle: 'juniper-idle', // 4 frames, loops
  walk: 'juniper-walk', // 6 frames, loops
  jumpUp: 'juniper-jump-up', // crouch+rise, plays once
  jumpFall: 'juniper-jump-fall', // apex+fall, holds last
  cheer: 'juniper-cheer', // 4 frames, once
  gemTwinkle: (i: number) => `gem-twinkle-${i}`,
  presentIdle: (i: number) => `present-idle-${i}`,
  presentShake: (i: number) => `present-shake-${i}`,
  presentBurst: (i: number) => `present-burst-${i}`,
};

export const GEM_COLOURS = 6;
export const PRESENT_COLOURS = 4;
export const SCARF_COLOURS = [0xe8472b, 0xff8a1f, 0xd83a9a, 0x39b6d8, 0x3fa06a, 0x8a5fd8];

export const gemKey = (i: number) => `${TEX.gem}-${i % GEM_COLOURS}`;
export const presentKey = (i: number) => `${TEX.present}-${i % PRESENT_COLOURS}`;
/** Juniper sheet per scarf colour index. */
export const juniperKey = (scarf: number) => `${TEX.juniper}-${scarf % SCARF_COLOURS.length}`;
export const friendKey = (who: 'pip' | 'marlow' | 'odette') => `${TEX.friend}-${who}`;

/**
 * Backgrounds. For zone z (0..4) the art side creates textures bgKey(z, layer)
 * for each layer name. Each is 1280 wide and tiles horizontally (left and right
 * edges match). Heights: sky 960 (full screen), far/mid/near 960 with transparent
 * tops, ground 320 (a tile of the snowy ground top, walkable surface at its y = 60).
 */
export type BgLayer = 'sky' | 'far' | 'mid' | 'near' | 'ground';
export const BG_LAYERS: BgLayer[] = ['sky', 'far', 'mid', 'near', 'ground'];
export const BG_SCROLL: Record<BgLayer, number> = { sky: 0.05, far: 0.2, mid: 0.4, near: 0.7, ground: 1 };
export const bgKey = (zone: number, layer: BgLayer) => `bg-${zone}-${layer}`;

/** Juniper animations exist per scarf: use `${ANIM.walk}-${scarf}` etc. via this helper. */
export const juniperAnim = (base: string, scarf: number) => `${base}-${scarf % SCARF_COLOURS.length}`;

// ---------- v2 additions (store, Flurries, tools, areas). Append-only. ----------

/** Things that can be counted / pictured in problems. Texture key countIconKey(name), 64x64 each, single frame. */
export const COUNT_ICONS = [
  'snowball', 'gem', 'pinecone', 'star', 'lantern', 'carrot', 'mitten', 'cocoa', 'fish', 'acorn',
  'berry', 'bell', 'cookie', 'apple', 'feather', 'candle', 'sled', 'scarf', 'pie', 'coin',
] as const;
export type CountIcon = (typeof COUNT_ICONS)[number];
export const countIconKey = (name: CountIcon) => `count-${name}`;

/** Store items / tools. Texture key toolKey(id), 128x128 each, single frame, drawn as chunky outlined icons. */
export const TOOL_IDS = [
  'cocoa', 'springHooves', 'chimeBell', 'glowLantern', 'iceChisel', 'swiftScarf', 'gemMagnet', 'silverBell', 'trailMap',
  // v4 platforming tools
  'gripHooves', 'cloudBoots', 'featherCape',
] as const;
export type ToolId = (typeof TOOL_IDS)[number];
export const toolKey = (id: ToolId) => `tool-${id}`;

/** Cosmetic hats drawn as overlays: hatKey(i), 96x96, anchored to sit on Juniper's head (origin 0.5, 1). */
export const HAT_COUNT = 5;
export const hatKey = (i: number) => `hat-${i % HAT_COUNT}`;

/** Flurries: 10 kinds (index 0..9; kinds 2z and 2z+1 belong to camp z). Sheet flurryKey(kind): 4 frames 96x96
 *  (0-1 wander bob, 2 startled/darting, 3 happy friend). Origin 0.5, 1. */
export const FLURRY_KINDS = 10;
export const flurryKey = (kind: number) => `flurry-${kind % FLURRY_KINDS}`;
export const FLURRY_NAMES = ['Puffle', 'Nib', 'Twigget', 'Hushwing', 'Glint', 'Drip', 'Tocky', 'Whirr', 'Auro', 'Starlet'];

export const TEX2 = {
  looseGem: 'loose-gem', // small 48x48 currency gem, 4 twinkle frames
  doorOpen: 'door-open', // 220x300 side-area doorway (cave mouth / arch), origin 0.5,1
  doorIce: 'door-ice', // same size, blocked by an ice wall (needs Ice Chisel); 2 frames: solid, cracked
  doorDark: 'door-dark', // same size, pitch-dark opening (needs Glow Lantern)
  doorHigh: 'door-high', // same size, doorway drawn for a high ledge (needs Spring Hooves)
  stall: 'stall', // Marlow's trail stall 300x280, origin 0.5,1
  shopBg: 'shop-bg', // 1280x960 trading post interior (shelves, counter, warm light)
  lodgeBg: 'lodge-bg', // 1280x960 Flurry Lodge album background
  darkness: 'darkness', // 1280x960 dark overlay with a soft transparent circle in the centre (lantern light)
  lockBadge: 'lock-badge', // 96x96 padlock badge
  starGold: 'star-gold', // 96x96 gold star
  purse: 'ic-purse', // 96x96 gem purse icon
  bellRing: 'bell-ring', // 4 frames 128x128 ringing-bell effect
} as const;

/** Side-area backgrounds: areaBgKey(zone, area 1|2, layer). Same sizes and rules as bgKey. Area 0 (Trail) uses bgKey. */
export const areaBgKey = (zone: number, area: number, layer: BgLayer) =>
  area === 0 ? bgKey(zone, layer) : `bg-${zone}-a${area}-${layer}`;

// ---------- v2 art-side additions (appended by the art module) ----------

/** v2 animations (created by registerArt). */
export const ANIM2 = {
  looseGemTwinkle: 'loose-gem-twinkle', // on TEX2.looseGem, 4 frames, loops
  bellRing: 'bell-ring', // on TEX2.bellRing, 4 frames, plays once
} as const;

/** Dark album silhouette of a Flurry kind, 96x96 single frame, origin 0.5,1. Created on demand by
 *  ensureFlurrySilhouette(scene, kind) (or just use flurryKey(kind) frame 0 with setTintFill(0x2e2a5c)). */
export const flurrySilKey = (kind: number) => `flurry-sil-${kind % FLURRY_KINDS}`;

/** Flurry wander-bob animation (frames 0-1 of flurryKey(kind)); created at boot by core/placeholderArt (the art module only draws the frames). */
export const flurryBobAnim = (kind: number) => `flurry-bob-${kind % FLURRY_KINDS}`;

// ---------- v3 additions: playable heroes (contract between art and game). Append-only. ----------

/** Playable heroes. Juniper is the default; the others unlock after the child has helped them. */
export const HERO_IDS = ['juniper', 'pip', 'marlow', 'odette', 'bluster'] as const;
export type HeroId = (typeof HERO_IDS)[number];
export const HERO_NAMES: Record<HeroId, string> = {
  juniper: 'Juniper', pip: 'Pip', marlow: 'Marlow', odette: 'Odette', bluster: 'Bluster',
};

/**
 * Hero sprite sheets share Juniper's layout EXACTLY: frame size JUNIPER_FRAME (200x200), 19 frames with the
 * same indices as JUNIPER_FRAMES (idle 0-3 with 3 = blink, walk 4-9, crouch 10, rise 11, apex 12, fall 13,
 * land 14, cheer 15-18), feet at bottom-centre of the frame (origin 0.5, 1), facing right.
 * The accent colour (scarf / neckerchief / bow) follows SCARF_COLOURS[scarf].
 * For 'juniper' these are the existing Juniper sheets and animations.
 * Non-Juniper sheets are created ON DEMAND by ensureHeroArt(scene, hero, scarf) exported from src/art/index.ts,
 * which also creates the animations heroAnim(base, hero, scarf) for base = ANIM.idle, ANIM.walk, ANIM.jumpUp,
 * ANIM.jumpFall, ANIM.cheer and 'juniper-land', with the same timings as Juniper's.
 * releaseHeroArt(scene, keepHero, keepScarf) frees other non-Juniper hero sheets.
 * heroHatAnchor(hero, frame) (same module) returns { dx, dy, rot, scale } for placing a hat (origin 0.5, 1)
 * relative to the hero's feet origin when facing right; negate dx and rot and flipX the hat when facing left.
 */
export const heroKey = (hero: HeroId, scarf: number) =>
  hero === 'juniper' ? juniperKey(scarf) : `hero-${hero}-${scarf % SCARF_COLOURS.length}`;
export const heroAnim = (base: string, hero: HeroId, scarf: number) =>
  hero === 'juniper' ? juniperAnim(base, scarf) : `${base}-${hero}-${scarf % SCARF_COLOURS.length}`;
/** 160x160 bust portrait for picker cards (default accent colour), single frame, created at boot for all heroes. */
export const heroPortraitKey = (hero: HeroId) => `hero-portrait-${hero}`;

// ---------- v4 additions: platforming pieces (contract between art and game). Append-only. ----------

/** Platforming art. Unless noted: single frame, origin (0.5, 0) with the walkable top surface at y = 0 of the texture
 *  (snow/ice caps may poke up to 8 px above via the texture's own transparent margin is NOT allowed: top row = surface). */
export const TEX4 = {
  platCloud: 'plat-cloud', // 240x80 drifting snow-cloud lift, 2 frames (gentle bob), flat top
  platLog: 'plat-log', // 240x64 hanging log lift (rope stubs at both ends), flat top
  platCrumble: 'plat-crumble', // 200x64 crumbly ice ledge, 4 frames: solid, cracked, more cracked, breaking apart
  platBrass: 'plat-brass', // 200x48 brass clockwork platform (camp 4 gears, pendulums, tick-tock platforms), 2 frames: solid, ghost/faded outline
  platAurora: 'plat-aurora', // 240x40 bridge made of aurora light, 4 shimmer frames (the game fades alpha in and out)
  iceStrip: 'ice-strip', // 240x40 slippery glassy ice surface, tiles horizontally
  rockBlock: 'rock-block', // 160x160 snowy rock block with a snow cap on top, tiles horizontally (terraces, steps)
  rockBody: 'rock-body', // 160x160 rock without a cap, tiles both ways (stacked under rock-block for tall walls)
  bouncePad: 'bounce-pad', // 150x100 springy snow-capped "puffshroom", 3 frames: rest, squashed, sprung; origin (0.5, 1)
  gear: 'gear', // 240x240 wooden clock gear (decor that the game rotates), origin (0.5, 0.5)
  pendulumRod: 'pendulum-rod', // 28x420 rod with a pivot cap at the top, origin (0.5, 0.03)
  checkpoint: 'checkpoint', // 90x190 small lantern post, 2 frames: unlit, lit; origin (0.5, 1)
  helperCloud: 'helper-cloud', // 240x120 friendly smiling helper cloud you can stand on, 2 frames (blink); flat top at y = 30
  pitMist: 'pit-mist', // 320x140 soft snow-mist band that fills the bottom of gaps, tiles horizontally, top edge feathered
  windStreak: 'p-wind', // 120x16 white wind streak particle (tint/alpha in game)
  arrowSign: 'arrow-sign', // 110x150 wooden signpost with an arrow, 3 frames: right, up, up-right; origin (0.5, 1)
} as const;

/** v4 animations created by registerArt. */
export const ANIM4 = {
  cloudBob: 'plat-cloud-bob', // TEX4.platCloud frames 0-1, loops slowly
  auroraShimmer: 'plat-aurora-shimmer', // TEX4.platAurora frames 0-3, loops
  bounce: 'bounce-pad-boing', // TEX4.bouncePad frames 1,2,0, plays once
  crumble: 'plat-crumble-break', // TEX4.platCrumble frames 0-3, plays once (game controls timing)
} as const;
