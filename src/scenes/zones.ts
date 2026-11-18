// Data-driven camp layouts (design.md "Expansion (v2)"). Each camp (zone) has three areas:
// 0 = the Trail (stall, sled, gate, doorways to both side areas) and 1, 2 = side areas.
// All coordinates are world pixels. Ledge `y` is the walkable top edge. Gem `y` is the gem
// centre. Present `y` is the surface it sits on. Door `y` is the surface it stands on.
import { AREAS_PER_ZONE, MiniGameId, PRESENTS_PER_AREA, ZONE_PRESENTS } from '../types';

export const GROUND_Y = 700; // walkable surface
export const GROUND_TILE_Y = 640; // top of the ground tile (its surface is at tile y 60)
export const TRAIL_W = 3840;
export const SIDE_W = 2560;
/** v1 name: width of the Trail. */
export const WORLD_W = TRAIL_W;
const G = GROUND_Y;
const L = 510; // low ledge: 190 above the ground
const H = 320; // high ledge: 190 above a low ledge (always overlaps one)
/** Ledge that holds a high doorway: 280 above the ground, kept far from other ledges so only Spring Hooves reach it. */
export const DOOR_LEDGE_Y = 420;

/** What blocks a doorway: high = needs Spring Hooves, ice = Ice Chisel, dark = Glow Lantern. */
export type Gate = 'high' | 'ice' | 'dark';

export type Deco = { kind: 'friend'; who: 'pip' | 'marlow' | 'odette'; x: number } | { kind: 'bluster'; x: number; y: number };

export interface DoorDef {
  /** Area it leads to (0 = back to the Trail). */
  to: number;
  x: number;
  /** Surface it stands on (GROUND_Y, or DOOR_LEDGE_Y for a high doorway). */
  y: number;
  gates: Gate[];
}

export interface LooseDef {
  x: number;
  y: number;
  /** Only visible with the Glow Lantern. */
  hidden?: boolean;
  /** Pure bonus stash: may need Cloud Boots or the Feather Cape (never needed for anything). */
  bonus?: boolean;
}

// ---------- v4 platforming pieces (design.md "v4"). All optional; y values are walkable top surfaces unless noted. ----------

/** Bottom of every area (the ground tile ends here). Tall areas grow upwards: their top is worldTop(layout) < 0. */
export const WORLD_BOTTOM = 960;
/** A fall below this (into a pit) floats the hero back to the last lit checkpoint. */
export const FALL_Y = GROUND_Y + 170;

/** Solid rock (from every side): top surface y, from x0 to x1, down to bottom (default WORLD_BOTTOM). */
export interface BlockDef { x0: number; x1: number; y: number; bottom?: number }
/** Slippery ice on top of a ground / rock surface. */
export interface IceDef { x0: number; x1: number; y: number }
/** One-way lift: its top centre travels from (x, y) to (x + dx, y + dy) in travel ms, pausing pause ms at each end. */
export interface LiftDef { kind: 'cloud' | 'log'; x: number; y: number; dx: number; dy: number; travel: number; pause: number; phase?: number }
/** Bounce pad standing on the surface y. */
export interface PadDef { x: number; y: number }
/** Crumbling ice ledge (one-way), top y. */
export interface CrumbleDef { x: number; y: number }
/** Wind region; push = peak px/s (sign = direction), 2 s on / 2 s off. */
export interface WindDef { x0: number; x1: number; y0: number; y1: number; push: number; phase?: number }
/** Tick-tock brass platform (one-way): group 0 and 1 take turns being solid. */
export interface TickDef { x: number; y: number; group: 0 | 1 }
/** Gear at centre (x, y) with n (1-3) brass platforms on a circle of radius r; period = ms per turn; platforms stay level. */
export interface GearDef { x: number; y: number; r: number; n: number; period: number; dir: 1 | -1; phase?: number }
/** Pendulum: pivot (x, y), rod length len, swing amplitude amp (rad), period ms; a brass platform hangs level at the end. */
export interface PendulumDef { x: number; y: number; len: number; amp: number; period: number; phase?: number }
/** Aurora bridge (one-way) fading in and out. */
export interface AuroraDef { x: number; y: number; phase?: number }
/**
 * Checkpoint lantern standing on surface y. ferry = the helper cloud's path (top-surface points) from this checkpoint
 * over the next tricky stretch to the next checkpoint (used after 3 falls in that stretch).
 */
export interface CheckpointDef { x: number; y: number; ferry?: { x: number; y: number }[] }
/** Arrow sign (decor) standing on surface y: frame 0 right, 1 up, 2 up-right. */
export interface SignDef { x: number; y: number; dir: 0 | 1 | 2 }

export interface Pieces {
  blocks?: BlockDef[];
  ice?: IceDef[];
  lifts?: LiftDef[];
  pads?: PadDef[];
  crumbles?: CrumbleDef[];
  winds?: WindDef[];
  ticks?: TickDef[];
  gears?: GearDef[];
  pendulums?: PendulumDef[];
  auroras?: AuroraDef[];
  checkpoints?: CheckpointDef[];
  signs?: SignDef[];
}

export interface AreaLayout {
  zone: number;
  area: number;
  name: string;
  width: number;
  ledges: { x: number; y: number }[];
  /** 2 presents: global index = area * 2 + k; game = ZONE_PRESENTS[zone][index]. */
  presents: { x: number; y: number; index: number; game: MiniGameId }[];
  /** Frost gems: `index` into ZoneProgress.gems (2 per area). */
  gems: { x: number; y: number; index: number }[];
  loose: LooseDef[];
  /** Wandering Flurries (kind 0..9) and where they roam. */
  flurries: { kind: number; x: number; y?: number }[];
  doors: DoorDef[];
  deco: Deco[];
  startX: number;
  dark: boolean;
  /** Tint for the zone's own background layers when the area has no art of its own. */
  tint: number;
  stallX?: number;
  sledX?: number;
  gateX?: number;
  // ---- v4 ----
  /** World height in screens (1..3). */
  heightScreens: number;
  /** Gaps in the ground [x0, x1] (pit mist at the bottom). */
  pits: [number, number][];
  pieces: Pieces;
  /** Surfaces the sled and gate stand on (default GROUND_Y). */
  sledY?: number;
  gateY?: number;
}

/** Top edge of the area (0 for one screen, negative for tall areas). */
export const worldTop = (l: { heightScreens: number }) => WORLD_BOTTOM - 960 * Math.max(1, l.heightScreens);

// ---------- helpers ----------

const gem = (x: number, surface: number) => ({ x, y: surface - 64 });
const pres = (x: number, surface: number) => ({ x, y: surface });
const LOOSE_UP = 46; // loose gem centre above the surface

/** A row of n loose gems from x0 to x1 on a surface. */
function line(x0: number, x1: number, surface: number, n: number, hidden = false): LooseDef[] {
  return Array.from({ length: n }, (_, i) => ({ x: Math.round(x0 + ((x1 - x0) * i) / Math.max(1, n - 1)), y: surface - LOOSE_UP, hidden }));
}

/** An arc of n loose gems over a jump centred at xc: you grab the top ones only by hopping. */
function arc(xc: number, surface: number, n = 5, w = 300, h = 170, hidden = false): LooseDef[] {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // -1..1
    return { x: Math.round(xc + (t * w) / 2), y: Math.round(surface - LOOSE_UP - h * (1 - t * t)), hidden };
  });
}

const ledge = (x: number, y: number) => ({ x, y });

const SIDE_NAMES = [
  ['Bramble Hollow', 'High Shelf'],
  ['Hush Grove', 'Frozen Den'],
  ['Crystal Gallery', 'Echo Pool'],
  ['Gear Loft', 'Windy Hollow'],
  ['Aurora Shelf', 'Star Cavern'],
];

/** Gates of the doorway to side areas 1 and 2 of each zone (design.md table). */
export const DOOR_GATES: Gate[][][] = [
  [[], ['high']],
  [[], ['ice']],
  [['dark'], ['ice']],
  [['high'], ['dark']],
  [['high'], ['dark', 'ice']],
];

/** Where the Trail doorways stand. */
const DOOR_X = [1350, 2450];

const presentsFor = (zone: number, area: number, spots: { x: number; y: number }[]) =>
  spots.slice(0, PRESENTS_PER_AREA).map((s, k) => {
    const index = area * PRESENTS_PER_AREA + k;
    return { ...s, index, game: ZONE_PRESENTS[zone][index] };
  });

const gemsFor = (area: number, spots: { x: number; y: number }[]) => spots.slice(0, 2).map((s, k) => ({ ...s, index: area * 2 + k }));

/** Loose gems that are a pure bonus: they may need Cloud Boots or the Feather Cape. */
const stash = (pts: [number, number][]): LooseDef[] => pts.map(([x, y]) => ({ x, y, bonus: true }));
/** A column of loose gems over a bounce pad (x, surface). */
const column = (x: number, surface: number, n = 3, step = 90): LooseDef[] =>
  Array.from({ length: n }, (_, i) => ({ x, y: surface - 140 - i * step }));

/** Extra (v4) fields of a Trail or side-area spec. */
interface V4Spec {
  width?: number;
  heightScreens?: number;
  pits?: [number, number][];
  pieces?: Pieces;
  startX?: number;
  /** Extra exit doorways back to the Trail (side areas: e.g. one at the far end of the climb). */
  exits?: { x: number; y: number }[];
}

// ---------- Trails ----------

interface TrailSpec extends V4Spec {
  ledges: { x: number; y: number }[];
  presents: { x: number; y: number }[];
  gems: { x: number; y: number }[];
  loose: LooseDef[];
  flurryX: number;
  deco: Deco[];
  doorX?: [number, number];
  sledX?: number;
  sledY?: number;
  gateX?: number;
  gateY?: number;
}

const TRAILS: TrailSpec[] = [
  // ---- Camp 1, Lantern Meadow: walk, hop, ledges (unchanged; one sign and one checkpoint added) ----
  {
    ledges: [ledge(900, L), ledge(1080, H), ledge(1700, L)],
    presents: [pres(1700, L), pres(2950, G)],
    gems: [gem(1080, H), gem(2100, G)],
    loose: [
      ...line(260, 380, G, 3), ...arc(880, G, 5, 240, 170), ...line(850, 980, L, 3), ...line(1020, 1140, H, 3, true),
      ...arc(1900, G, 5), ...line(2650, 2800, G, 4), ...arc(3150, G, 5, 260, 160, true),
    ],
    flurryX: 2000,
    deco: [{ kind: 'friend', who: 'pip', x: 3080 }, { kind: 'bluster', x: 1500, y: 190 }],
    pieces: { signs: [{ x: 760, y: G, dir: 2 }], checkpoints: [{ x: 2300, y: G }] },
  },
  // ---- Camp 2, Frostpine Forest: rock steps, a first small gap, a bounce pad, a slow log lift ----
  {
    ledges: [ledge(2150, 400), ledge(2890, 450)],
    presents: [pres(2150, 400), pres(3180, 600)],
    gems: [gem(1070, 520), gem(2890, 450)],
    pits: [[1680, 1840], [2720, 3060]],
    pieces: {
      blocks: [{ x0: 860, x1: 1000, y: 610 }, { x0: 1000, x1: 1140, y: 520 }, { x0: 1140, x1: 1240, y: 610 }, { x0: 3120, x1: 3240, y: 600 }],
      pads: [{ x: 1990, y: G }],
      lifts: [{ kind: 'log', x: 2790, y: 660, dx: 200, dy: 0, travel: 1500, pause: 800 }],
      checkpoints: [
        { x: 1580, y: G, ferry: [{ x: 1700, y: G }, { x: 1890, y: G }] },
        { x: 2620, y: G, ferry: [{ x: 2790, y: G }, { x: 3110, y: G }] },
      ],
      signs: [{ x: 780, y: G, dir: 2 }, { x: 1900, y: G, dir: 1 }, { x: 2680, y: G, dir: 0 }],
    },
    loose: [
      ...line(260, 380, G, 3), ...line(700, 800, G, 3), ...line(890, 970, 610, 2), ...line(1030, 1110, 520, 2), ...line(1170, 1220, 610, 2),
      ...line(1400, 1500, G, 2), ...arc(1760, G, 5, 240, 150), ...column(1990, G), ...line(2100, 2200, 400, 3), ...line(2250, 2330, G, 2),
      ...line(2790, 2990, 660, 4), ...line(2860, 2920, 450, 2, true), ...line(3290, 3380, G, 2), ...line(3500, 3600, G, 3),
    ],
    flurryX: 2290,
    deco: [{ kind: 'friend', who: 'marlow', x: 1500 }, { kind: 'bluster', x: 2620, y: 180 }],
  },
  // ---- Camp 3, Glimmer Caves (2 screens): an ice floor, a crumbling stepping stone, a tall rising lift ----
  {
    heightScreens: 2,
    ledges: [ledge(1650, -60), ledge(2860, 470)],
    presents: [pres(2480, 160), pres(3130, G)],
    gems: [gem(1650, -60), gem(2860, 470)],
    pits: [[1660, 1900], [2770, 2970]],
    pieces: {
      ice: [{ x0: 760, x1: 1180, y: G }, { x0: 2620, x1: 2770, y: G }],
      crumbles: [{ x: 1780, y: 640 }, { x: 2870, y: 650 }, { x: 2010, y: 60 }, { x: 1830, y: -10 }],
      lifts: [{ kind: 'cloud', x: 2150, y: 660, dx: 0, dy: -500, travel: 1700, pause: 700 }],
      blocks: [{ x0: 2280, x1: 2600, y: 160, bottom: 260 }],
      checkpoints: [
        { x: 1560, y: G, ferry: [{ x: 1690, y: G }, { x: 1950, y: G }] },
        { x: 2320, y: 160 },
        { x: 2560, y: G, ferry: [{ x: 2700, y: G }, { x: 3020, y: G }] },
      ],
      signs: [{ x: 700, y: G, dir: 0 }, { x: 2040, y: G, dir: 1 }, { x: 2580, y: 160, dir: 1 }],
    },
    loose: [
      ...line(260, 380, G, 3), ...line(780, 1160, G, 6), ...arc(1780, 640, 3, 160, 90), ...line(1950, 2050, G, 2),
      ...line(2150, 2150, 520, 1), ...line(2150, 2150, 360, 1), ...line(2340, 2440, 160, 2), ...line(1980, 2040, 60, 2, true),
      ...line(2650, 2740, G, 2), ...arc(2870, 650, 3, 160, 80), ...line(3060, 3200, G, 3), ...line(3500, 3620, G, 3),
      ...stash([[1650, -330], [1700, -350], [1750, -330]]),
    ],
    flurryX: 1250,
    deco: [{ kind: 'friend', who: 'odette', x: 3640 }, { kind: 'bluster', x: 3000, y: -300 }],
  },
  // ---- Camp 4, Clocktower Ridge (2 screens): wind gusts, tick-tock stepping stones, a turning gear, a pendulum ----
  {
    heightScreens: 2,
    doorX: [1250, 2450],
    ledges: [ledge(3700, -60)],
    presents: [pres(2230, G), pres(3190, 200)],
    gems: [gem(3700, -60), gem(950, G)],
    pits: [[1700, 2100], [2780, 3120]],
    pieces: {
      winds: [{ x0: 720, x1: 1180, y0: 300, y1: G, push: -200 }],
      ticks: [{ x: 1800, y: 640, group: 0 }, { x: 2000, y: 640, group: 1 }],
      gears: [{ x: 2950, y: 380, r: 200, n: 3, period: 9000, dir: 1 }],
      blocks: [{ x0: 3120, x1: 3260, y: 200, bottom: 300 }],
      pendulums: [{ x: 3300, y: -400, len: 420, amp: 0.6, period: 3200 }],
      checkpoints: [
        { x: 1600, y: G, ferry: [{ x: 1720, y: G }, { x: 2140, y: G }] },
        { x: 2620, y: G, ferry: [{ x: 2720, y: 690 }, { x: 2950, y: 690 }, { x: 2990, y: 180 }, { x: 3180, y: 180 }] },
      ],
      signs: [{ x: 680, y: G, dir: 0 }, { x: 1640, y: G, dir: 0 }, { x: 2690, y: G, dir: 2 }],
    },
    loose: [
      ...line(260, 380, G, 3), ...line(760, 1160, G, 6), ...arc(1900, 640, 5, 260, 110), ...line(2200, 2300, G, 2),
      ...line(2850, 3050, 150, 3), ...line(3150, 3230, 200, 2), ...line(3300, 3400, G, 3, true), ...line(3500, 3620, G, 3),
      ...line(3660, 3740, -60, 2),
    ],
    flurryX: 600,
    deco: [{ kind: 'friend', who: 'odette', x: 2250 }, { kind: 'bluster', x: 2600, y: -200 }],
  },
  // ---- Camp 5, The Summit (3 screens): a real climb with every piece; sled, gate and the summit lantern at the top ----
  {
    width: 3700,
    heightScreens: 3,
    doorX: [1150, 1750],
    sledX: 3380,
    sledY: -1200,
    gateX: 3600,
    gateY: -1200,
    ledges: [],
    presents: [pres(2960, 160), pres(2050, -440)],
    gems: [gem(2540, 500), gem(2420, -1020)],
    pits: [[2080, 2280]],
    pieces: {
      blocks: [
        { x0: 2300, x1: 2460, y: 600 }, { x0: 2460, x1: 2620, y: 500 }, { x0: 2620, x1: 2780, y: 500 },
        { x0: 2820, x1: 3100, y: 160, bottom: 260 },
        { x0: 1700, x1: 2200, y: -440, bottom: -340 },
        { x0: 2730, x1: 2870, y: -370, bottom: -310 },
        { x0: 1900, x1: 2040, y: -760, bottom: -700 },
        { x0: 2250, x1: 2450, y: -1020, bottom: -960 },
        { x0: 3200, x1: 3700, y: -1200, bottom: -1100 },
      ],
      pads: [{ x: 2700, y: 500 }],
      lifts: [{ kind: 'cloud', x: 3230, y: 140, dx: 0, dy: -440, travel: 1700, pause: 700 }],
      crumbles: [{ x: 3000, y: -340 }],
      auroras: [{ x: 2580, y: -400, phase: 0 }, { x: 2350, y: -420, phase: -600 }, { x: 3060, y: -1180, phase: 900 }],
      ticks: [{ x: 1820, y: -600, group: 0 }, { x: 2120, y: -900, group: 1 }],
      pendulums: [{ x: 2700, y: -1445, len: 480, amp: 0.5, period: 3800 }],
      winds: [{ x0: 2460, x1: 3200, y0: -1500, y1: -1050, push: 140 }],
      ice: [{ x0: 3200, x1: 3330, y: -1200 }],
      checkpoints: [
        { x: 1960, y: G, ferry: [{ x: 2110, y: G }, { x: 2300, y: G }] },
        { x: 2870, y: 160, ferry: [{ x: 3230, y: 140 }, { x: 3230, y: -480 }, { x: 2120, y: -480 }] },
        { x: 1960, y: -440, ferry: [{ x: 2150, y: -460 }, { x: 2150, y: -1040 }, { x: 2330, y: -1040 }] },
        { x: 2300, y: -1020, ferry: [{ x: 2400, y: -1040 }, { x: 2400, y: -1230 }, { x: 3260, y: -1230 }] },
      ],
      signs: [{ x: 1880, y: G, dir: 2 }, { x: 2900, y: 160, dir: 1 }, { x: 2140, y: -440, dir: 1 }, { x: 2420, y: -1020, dir: 0 }],
    },
    loose: [
      ...line(260, 380, G, 3), ...line(700, 900, G, 3), ...line(1350, 1550, G, 3), ...arc(2180, G, 5, 220, 150),
      ...line(2340, 2420, 600, 2), ...line(2500, 2580, 500, 2), ...column(2700, 500), ...line(2900, 3060, 160, 3),
      ...line(3230, 3230, 0, 1), ...line(3230, 3230, -200, 1), ...line(2560, 2800, -400, 3), ...line(1960, 2160, -440, 3),
      ...line(1960, 2000, -760, 2), ...line(2550, 2850, -1120, 3), ...line(3300, 3450, -1200, 3),
      ...stash([[1700, -950], [1750, -970], [1800, -950]]),
    ],
    flurryX: 1450,
    deco: [{ kind: 'friend', who: 'pip', x: 900 }, { kind: 'bluster', x: 3150, y: -1600 }],
  },
];

function trail(zone: number): AreaLayout {
  const t = TRAILS[zone];
  const dx = t.doorX ?? DOOR_X;
  const doors: DoorDef[] = [1, 2].map((to) => {
    const gates = DOOR_GATES[zone][to - 1];
    return { to, x: dx[to - 1], y: gates.includes('high') ? DOOR_LEDGE_Y : G, gates };
  });
  const ledges = [...t.ledges];
  for (const d of doors) if (d.y !== G) ledges.push(ledge(d.x, d.y));
  return {
    zone,
    area: 0,
    name: ['Lantern Meadow', 'Frostpine Forest', 'Glimmer Caves', 'Clocktower Ridge', 'The Summit'][zone],
    width: t.width ?? TRAIL_W,
    ledges,
    presents: presentsFor(zone, 0, t.presents),
    gems: gemsFor(0, t.gems),
    loose: t.loose,
    flurries: [{ kind: zone * 2, x: t.flurryX }],
    doors,
    deco: t.deco,
    startX: t.startX ?? 220,
    dark: false,
    tint: 0xffffff,
    stallX: 570,
    sledX: t.sledX ?? 3420,
    gateX: t.gateX ?? 3700,
    sledY: t.sledY ?? G,
    gateY: t.gateY ?? G,
    heightScreens: t.heightScreens ?? 1,
    pits: t.pits ?? [],
    pieces: t.pieces ?? {},
  };
}

// ---------- side areas ----------

interface SideVariant extends V4Spec {
  ledges: { x: number; y: number }[];
  presents: { x: number; y: number }[];
  gems: { x: number; y: number }[];
  loose: LooseDef[];
  flurryX: number;
}

/** Hooves-only ledge (280 above the ground). Only used in areas whose doorway already needs the Spring Hooves. */
const HI = DOOR_LEDGE_Y;

/**
 * One layout per side area: SIDES[zone][area - 1]. Reach rules are checked by tests/zones.test.ts with a physics
 * simulation (src/scenes/world/reach.ts). Side area A (1) is moderate; side area B (2) is the hardest of the camp.
 */
const SIDES: SideVariant[][] = [
  [
    // Lantern Meadow - Bramble Hollow: two stone islands and a small stair
    {
      ledges: [ledge(760, L), ledge(1500, L), ledge(1700, H), ledge(2150, L)],
      presents: [pres(1500, L), pres(1950, G)],
      gems: [gem(1700, H), gem(2150, L)],
      loose: [
        ...line(480, 640, G, 4), ...line(700, 820, L, 3), ...arc(1100, G, 5), ...line(1640, 1760, H, 3, true),
        ...arc(1950, G, 5, 260, 200), ...line(2100, 2200, L, 3), ...line(2380, 2480, G, 3),
      ],
      flurryX: 1250,
    },
    // High Shelf (hooves): a stair up the left, then a shelf only the hooves reach
    {
      ledges: [ledge(700, L), ledge(1250, L), ledge(1430, H), ledge(2050, HI)],
      presents: [pres(700, L), pres(2050, HI)],
      gems: [gem(1430, H), gem(1250, L)],
      loose: [
        ...arc(980, G, 5), ...line(1190, 1310, L, 3), ...line(1370, 1490, H, 3, true), ...arc(1700, G, 5, 260, 160),
        ...line(1990, 2110, HI, 3), ...line(2300, 2420, G, 3, true), ...line(480, 560, G, 2),
      ],
      flurryX: 1700,
    },
  ],
  [
    // Frostpine Forest - Hush Grove: a rock hill, a small gap, a bounce pad, a cloud lift over the last gap
    {
      ledges: [ledge(1790, 400), ledge(2130, 440)],
      presents: [pres(940, 510), pres(2400, 560)],
      gems: [gem(1790, 400), gem(2130, 440)],
      pits: [[1320, 1480], [2010, 2250]],
      pieces: {
        blocks: [{ x0: 700, x1: 860, y: 610 }, { x0: 860, x1: 1020, y: 510 }, { x0: 1020, x1: 1120, y: 610 }, { x0: 2320, x1: 2480, y: 560 }],
        pads: [{ x: 1640, y: G }],
        lifts: [{ kind: 'cloud', x: 2070, y: 650, dx: 120, dy: 0, travel: 1400, pause: 800 }],
        checkpoints: [
          { x: 1220, y: G, ferry: [{ x: 1350, y: G }, { x: 1560, y: G }] },
          { x: 1900, y: G, ferry: [{ x: 2060, y: G }, { x: 2290, y: G }] },
        ],
        signs: [{ x: 620, y: G, dir: 2 }, { x: 1560, y: G, dir: 1 }],
      },
      width: 2760,
      exits: [{ x: 2620, y: G }],
      loose: [
        ...line(480, 620, G, 4), ...line(730, 830, 610, 2), ...line(890, 990, 510, 2), ...arc(1400, G, 5, 220, 150), ...column(1640, G),
        ...line(1750, 1830, 400, 2), ...line(2050, 2190, 650, 3), ...line(2100, 2160, 440, 2, true), ...line(1700, 1860, G, 3),
        ...stash([[1250, 230], [1300, 215], [1350, 230]]),
      ],
      flurryX: 1750,
    },
    // Frozen Den (ice): up a rock stair, a lift over a gap to a pillar, a high pad jump, and the last present
    {
      ledges: [ledge(2080, 260), ledge(2340, 330), ledge(1400, 250)],
      presents: [pres(1020, 430), pres(2340, 330)],
      gems: [gem(2080, 260), gem(1400, 250)],
      pits: [[1200, 1600]],
      pieces: {
        blocks: [
          { x0: 720, x1: 840, y: 610 }, { x0: 840, x1: 960, y: 520 }, { x0: 960, x1: 1080, y: 430 }, { x0: 1080, x1: 1160, y: 560 },
          { x0: 1680, x1: 1780, y: 410 }, { x0: 1780, x1: 1960, y: 600 },
        ],
        lifts: [{ kind: 'cloud', x: 1270, y: 420, dx: 240, dy: 0, travel: 1500, pause: 800 }],
        pads: [{ x: 1880, y: 600 }],
        checkpoints: [
          { x: 1120, y: 560, ferry: [{ x: 1190, y: 540 }, { x: 1620, y: 390 }] },
          { x: 1730, y: 410 },
        ],
        signs: [{ x: 560, y: G, dir: 2 }, { x: 1860, y: 600, dir: 1 }],
      },
      exits: [{ x: 2440, y: G }],
      loose: [
        ...line(450, 560, G, 3), ...line(760, 800, 610, 2), ...line(880, 920, 520, 2), ...line(1000, 1060, 430, 2), ...line(1270, 1510, 420, 4),
        ...line(1710, 1750, 410, 2), ...column(1880, 600), ...line(2040, 2120, 260, 2), ...line(2300, 2380, 330, 2), ...line(2000, 2200, G, 4),
        ...stash([[2200, 140], [2250, 130], [2300, 140]]),
      ],
      flurryX: 2150,
    },
  ],
  [
    // Glimmer Caves - Crystal Gallery (dark, 2 screens): an ice floor, a rising lift, crumbling steps to the top shelf
    {
      heightScreens: 2,
      ledges: [ledge(1150, 120), ledge(2320, -260)],
      presents: [pres(1450, 240), pres(2110, -60)],
      gems: [gem(1150, 120), gem(2320, -260)],
      pits: [[1700, 1900]],
      pieces: {
        ice: [{ x0: 560, x1: 1000, y: G }],
        lifts: [{ kind: 'cloud', x: 1150, y: 660, dx: 0, dy: -420, travel: 1700, pause: 700 }],
        blocks: [{ x0: 1280, x1: 1600, y: 240, bottom: 320 }, { x0: 2040, x1: 2400, y: -60, bottom: 20 }],
        crumbles: [{ x: 1760, y: 140 }, { x: 1900, y: 40 }],
        checkpoints: [{ x: 900, y: G }, { x: 1340, y: 240, ferry: [{ x: 1640, y: 220 }, { x: 2100, y: -80 }] }],
        signs: [{ x: 520, y: G, dir: 0 }, { x: 1040, y: G, dir: 1 }, { x: 1560, y: 240, dir: 2 }],
      },
      exits: [{ x: 2300, y: -60 }],
      loose: [
        ...line(450, 520, G, 2), ...line(600, 960, G, 5), ...line(1150, 1150, 480, 1), ...line(1150, 1150, 330, 1),
        ...line(1330, 1560, 240, 4), ...line(1730, 1790, 140, 2), ...line(1870, 1930, 40, 2), ...line(2080, 2140, -60, 2, true),
        ...line(1950, 2150, G, 4), ...line(2300, 2450, G, 3),
      ],
      flurryX: 2200,
    },
    // Echo Pool (ice, 2 screens): slippery run-ups, two lifts handing over, crumbling stones high above a gap
    {
      heightScreens: 2,
      ledges: [ledge(1960, -450), ledge(900, 380)],
      presents: [pres(1300, 300), pres(2380, -200)],
      gems: [gem(1960, -450), gem(900, 380)],
      pits: [[700, 900], [1640, 1900]],
      pieces: {
        ice: [{ x0: 400, x1: 700, y: G }, { x0: 1200, x1: 1400, y: 300 }, { x0: 1900, x1: 2700, y: G }],
        lifts: [
          { kind: 'cloud', x: 1080, y: 660, dx: 0, dy: -360, travel: 1600, pause: 700 },
          { kind: 'log', x: 1520, y: 300, dx: 0, dy: -500, travel: 1700, pause: 700 },
        ],
        blocks: [{ x0: 1200, x1: 1400, y: 300, bottom: 400 }, { x0: 2280, x1: 2700, y: -200, bottom: -100 }],
        crumbles: [{ x: 1760, y: -240 }, { x: 1960, y: -260 }, { x: 2160, y: -240 }],
        checkpoints: [
          { x: 560, y: G, ferry: [{ x: 740, y: G }, { x: 960, y: G }] },
          { x: 1240, y: 300, ferry: [{ x: 1520, y: 280 }, { x: 1520, y: -220 }, { x: 2330, y: -220 }] },
        ],
        signs: [{ x: 960, y: G, dir: 1 }, { x: 1380, y: 300, dir: 1 }],
      },
      width: 2700,
      exits: [{ x: 2580, y: -200 }],
      loose: [
        ...line(450, 650, G, 4), ...arc(800, G, 5, 220, 150), ...line(1080, 1080, 500, 1), ...line(1240, 1360, 300, 3),
        ...line(1520, 1520, 100, 1), ...line(1520, 1520, -100, 1), ...line(1740, 2180, -260, 5), ...line(2330, 2380, -200, 2, true),
        ...line(1950, 2200, G, 4), ...stash([[1300, -150], [1350, -170], [1400, -150]]),
      ],
      flurryX: 2200,
    },
  ],
  [
    // Clocktower Ridge - Gear Loft (hooves, 2 screens): ride a gear up, hop to a shelf, swing a pendulum across
    {
      heightScreens: 2,
      ledges: [ledge(650, HI), ledge(1750, -200)],
      presents: [pres(1400, 16), pres(2200, 60)],
      gems: [gem(650, HI), gem(1750, -200)],
      pits: [[880, 1140], [1560, 2080]],
      pieces: {
        gears: [{ x: 1000, y: 360, r: 220, n: 2, period: 8000, dir: 1 }],
        blocks: [{ x0: 1280, x1: 1520, y: 16, bottom: 116 }, { x0: 2100, x1: 2560, y: 60, bottom: 160 }],
        pendulums: [{ x: 1750, y: -380, len: 460, amp: 0.55, period: 4000 }],
        winds: [{ x0: 1560, x1: 2080, y0: -300, y1: 200, push: 120, phase: 1000 }],
        checkpoints: [
          { x: 600, y: G, ferry: [{ x: 760, y: 680 }, { x: 1000, y: 680 }, { x: 1000, y: -4 }, { x: 1330, y: -4 }] },
          { x: 1330, y: 16, ferry: [{ x: 1580, y: -4 }, { x: 2150, y: 40 }] },
        ],
        signs: [{ x: 520, y: G, dir: 2 }, { x: 1470, y: 16, dir: 0 }],
      },
      width: 2640,
      exits: [{ x: 2440, y: 60 }],
      loose: [
        ...line(450, 560, G, 3), ...arc(1010, G, 5, 240, 120), ...line(1330, 1470, 16, 3), ...line(1560, 1940, 10, 4),
        ...line(2150, 2200, 60, 2), ...line(610, 690, HI, 2, true), ...line(2420, 2480, G, 2),
      ],
      flurryX: 650,
    },
    // Windy Hollow (dark, 2 screens): a gap in the wind, a tick-tock tower between rock perches, a gear across the mist
    {
      heightScreens: 2,
      ledges: [ledge(1390, 120), ledge(1950, -200)],
      presents: [pres(1560, 220), pres(2330, 120)],
      gems: [gem(1390, 120), gem(1950, -200)],
      pits: [[700, 940], [1080, 2700]],
      pieces: {
        winds: [
          { x0: 640, x1: 1000, y0: 300, y1: G, push: -190 },
          { x0: 1700, x1: 2260, y0: -300, y1: 40, push: -150, phase: 1200 },
        ],
        ticks: [{ x: 1120, y: 600, group: 0 }, { x: 1390, y: 340, group: 1 }],
        blocks: [{ x0: 1170, x1: 1300, y: 460, bottom: 520 }, { x0: 1480, x1: 1640, y: 220, bottom: 280 }, { x0: 2260, x1: 2700, y: 120, bottom: 220 }],
        gears: [{ x: 1950, y: 160, r: 180, n: 2, period: 8000, dir: -1 }],
        checkpoints: [
          { x: 560, y: G, ferry: [{ x: 720, y: G }, { x: 1000, y: G }] },
          { x: 1000, y: G, ferry: [{ x: 1120, y: 680 }, { x: 1120, y: 440 }, { x: 1230, y: 440 }] },
          { x: 1230, y: 460, ferry: [{ x: 1330, y: 440 }, { x: 1390, y: 200 }, { x: 1540, y: 200 }] },
          { x: 1520, y: 220, ferry: [{ x: 1700, y: 200 }, { x: 2300, y: 100 }] },
        ],
        signs: [{ x: 600, y: G, dir: 0 }, { x: 1250, y: 460, dir: 1 }, { x: 1600, y: 220, dir: 0 }],
      },
      width: 2700,
      exits: [{ x: 2560, y: 120 }],
      loose: [
        ...line(450, 540, G, 2), ...arc(820, G, 5, 220, 150), ...line(1100, 1140, 600, 2), ...line(1200, 1270, 460, 2),
        ...line(1370, 1410, 340, 2), ...line(1510, 1610, 220, 3), ...line(1800, 2100, 100, 4), ...line(2300, 2360, 120, 2, true),
        ...stash([[1700, -330], [1760, -350], [1820, -330]]),
      ],
      flurryX: 400,
    },
  ],
  [
    // The Summit - Aurora Shelf (hooves, 2 screens): aurora stepping stones over a gap, an icy lift shelf, crumbling stairs
    {
      heightScreens: 2,
      ledges: [ledge(1060, 370), ledge(2330, -500)],
      presents: [pres(1860, 160), pres(2290, -230)],
      gems: [gem(1060, 370), gem(2330, -500)],
      pits: [[700, 1300]],
      pieces: {
        auroras: [{ x: 820, y: 650, phase: 0 }, { x: 1050, y: 650, phase: -500 }, { x: 1280, y: 650, phase: -1000 }],
        lifts: [{ kind: 'log', x: 1600, y: 660, dx: 0, dy: -500, travel: 1700, pause: 700 }],
        blocks: [{ x0: 1720, x1: 2000, y: 160, bottom: 260 }, { x0: 2200, x1: 2700, y: -230, bottom: -130 }],
        ice: [{ x0: 1720, x1: 2000, y: 160 }],
        crumbles: [{ x: 2110, y: 40 }, { x: 2000, y: -100 }],
        checkpoints: [
          { x: 600, y: G, ferry: [{ x: 760, y: G }, { x: 1360, y: G }] },
          { x: 1400, y: G },
          { x: 1760, y: 160, ferry: [{ x: 2060, y: 140 }, { x: 2060, y: -250 }, { x: 2260, y: -250 }] },
        ],
        signs: [{ x: 520, y: G, dir: 0 }, { x: 1480, y: G, dir: 1 }, { x: 1960, y: 160, dir: 1 }],
      },
      width: 2700,
      exits: [{ x: 2540, y: -230 }],
      loose: [
        ...line(450, 540, G, 2), ...line(800, 1300, 650, 6), ...line(1400, 1520, G, 3), ...line(1600, 1600, 400, 1),
        ...line(1760, 1960, 160, 3), ...line(2080, 2140, 40, 2), ...line(1980, 2020, -100, 2), ...line(2300, 2360, -500, 2, true),
        ...line(2100, 2480, G, 4),
      ],
      flurryX: 2200,
    },
    // Star Cavern (dark + ice, 2 screens): icy run-up in the wind, tick-tock and a rock pillar, a gear, a pendulum, aurora steps
    {
      heightScreens: 2,
      ledges: [ledge(1640, 0), ledge(1000, -250), ledge(2240, -380)],
      presents: [pres(1800, 120), pres(2360, -280)],
      gems: [gem(1000, -250), gem(2240, -380)],
      pits: [[760, 1020], [1200, 1700]],
      pieces: {
        ice: [{ x0: 400, x1: 760, y: G }],
        winds: [{ x0: 700, x1: 1100, y0: 300, y1: G, push: -170 }],
        ticks: [{ x: 1290, y: 640, group: 0 }, { x: 1590, y: 600, group: 1 }],
        blocks: [{ x0: 1400, x1: 1480, y: 560 }, { x0: 1700, x1: 1900, y: 120, bottom: 220 }, { x0: 2300, x1: 2700, y: -280, bottom: -180 }],
        gears: [{ x: 2050, y: 380, r: 200, n: 2, period: 8000, dir: 1 }],
        pendulums: [{ x: 1450, y: -560, len: 460, amp: 0.6, period: 3400 }],
        auroras: [{ x: 2000, y: -60, phase: 0 }, { x: 2240, y: -160, phase: -600 }],
        checkpoints: [
          { x: 600, y: G, ferry: [{ x: 780, y: G }, { x: 1060, y: G }] },
          { x: 1100, y: G, ferry: [{ x: 1230, y: 680 }, { x: 1760, y: 680 }] },
          { x: 1780, y: G, ferry: [{ x: 1900, y: 680 }, { x: 2050, y: 680 }, { x: 2050, y: 100 }, { x: 1800, y: 100 }] },
          { x: 1750, y: 120, ferry: [{ x: 1900, y: 100 }, { x: 1900, y: -300 }, { x: 2380, y: -300 }] },
        ],
        signs: [{ x: 1150, y: G, dir: 0 }, { x: 1850, y: 120, dir: 2 }],
      },
      width: 2700,
      exits: [{ x: 2560, y: -280 }],
      loose: [
        ...line(450, 700, G, 4), ...arc(890, G, 5, 220, 150), ...line(1280, 1300, 640, 1), ...line(1430, 1450, 560, 1), ...line(1580, 1600, 600, 1),
        ...line(1750, 1850, 120, 2), ...line(1980, 2020, -60, 2), ...line(2220, 2260, -160, 2), ...line(1200, 1700, -150, 4),
        ...line(2320, 2340, -280, 1, true), ...line(1950, 2480, G, 4), ...stash([[2600 - 160, -560], [2500 - 160, -580]]),
      ],
      flurryX: 2300,
    },
  ],
];

const RARE_AREA = [2, 2, 1, 1, 2];
const SIDE_TINT = [0xd8e4ff, 0xffe2ef];
const DARK_TINT = 0x8890c8;

function side(zone: number, area: number): AreaLayout {
  const v = SIDES[zone][area - 1];
  const gates = DOOR_GATES[zone][area - 1];
  const dark = gates.includes('dark');
  return {
    zone,
    area,
    name: SIDE_NAMES[zone][area - 1],
    width: v.width ?? SIDE_W,
    ledges: v.ledges,
    presents: presentsFor(zone, area, v.presents),
    gems: gemsFor(area, v.gems),
    loose: v.loose,
    flurries: RARE_AREA[zone] === area ? [{ kind: zone * 2 + 1, x: v.flurryX }] : [],
    doors: [{ to: 0, x: 240, y: G, gates: [] }, ...(v.exits ?? []).map((e) => ({ to: 0, x: e.x, y: e.y, gates: [] as Gate[] }))],
    deco: [],
    startX: v.startX ?? 400,
    dark,
    tint: dark ? DARK_TINT : SIDE_TINT[area - 1],
    heightScreens: v.heightScreens ?? 1,
    pits: v.pits ?? [],
    pieces: v.pieces ?? {},
  };
}

/** AREAS[zone][area]. */
export const AREAS: AreaLayout[][] = Array.from({ length: 5 }, (_, z) =>
  Array.from({ length: AREAS_PER_ZONE }, (_, a) => (a === 0 ? trail(z) : side(z, a))),
);

export const areaLayout = (zone: number, area: number) => AREAS[zone]?.[area] ?? AREAS[0][0];
export const areaName = (zone: number, area: number) => areaLayout(zone, area).name;
