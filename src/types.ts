// Shared contracts for Lantern Peak. Every module codes against this file.
// Do not change exported shapes without updating every user of them.

export const GAME_W = 1280;
export const GAME_H = 960;
export const HUD_H = 120;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 12;

export type Grade = 1 | 2 | 3 | 4;
export const GRADE_START_LEVEL: Record<Grade, number> = { 1: 1, 2: 4, 3: 7, 4: 10 };

export type Strand =
  | 'counting' // counting, comparing, place value
  | 'addsub'
  | 'mult'
  | 'div'
  | 'fractions'
  | 'time'
  | 'money'
  | 'word';

export const STRANDS: Strand[] = ['counting', 'addsub', 'mult', 'div', 'fractions', 'time', 'money', 'word'];

/** A fraction as [numerator, denominator]. */
export type Frac = [number, number];
export type Op = '+' | '-' | 'x' | '/';

/**
 * Structured payload of a problem. Mini games read this to build the
 * manipulative; unit tests re-solve the problem from this alone.
 */
export type ProblemData =
  /** Count a pile of `count` objects. answer = count */
  | { kind: 'count'; count: number; item: import('./art/keys').CountIcon }
  /** Which sign goes between a and b? answer = '<' | '>' | '=' */
  | { kind: 'compare'; a: number; b: number }
  /** Build `target` from place-value gems. digits = target's digits, most significant first. answer = target */
  | { kind: 'placeValue'; target: number; digits: number[] }
  /** What is the value of the digit at `placeIndex` (0 = ones) in `n`? answer = digit * 10^placeIndex */
  | { kind: 'digitValue'; n: number; placeIndex: number }
  /** Skip counting: sequence with one blank at `blankIndex`. answer = the missing number */
  | { kind: 'skip'; start: number; step: number; length: number; blankIndex: number }
  /** Round n to the nearest `to` (10, 100, 1000...). answer = rounded */
  | { kind: 'round'; n: number; to: number }
  /** a op b = ?  For '/', b divides a exactly. answer = result */
  | { kind: 'arith'; a: number; b: number; op: Op }
  /** a op b = result with one operand hidden. answer = the hidden operand */
  | { kind: 'missing'; a: number; b: number; op: Op; result: number; unknown: 'a' | 'b' }
  /** a / b with a remainder. answer = "q R r" (string, e.g. "12 R 3"; r may be 0 -> "12 R 0") */
  | { kind: 'divRem'; a: number; b: number }
  /** Shade/tap `frac` of a shape cut into frac[1] equal parts. answer = "n/d" */
  | { kind: 'fracShow'; frac: Frac; shape: 'pie' | 'bar' }
  /** Name the fraction that is shown shaded. answer = "n/d" */
  | { kind: 'fracName'; frac: Frac; shape: 'pie' | 'bar' }
  /** Compare two fractions. answer = '<' | '>' | '=' */
  | { kind: 'fracCompare'; a: Frac; b: Frac }
  /** Pick the fraction equal to `base` from choices. answer = "n/d" (the one equal choice) */
  | { kind: 'fracEquiv'; base: Frac }
  /** base = ?/den (typed at level 10+, replaces fracEquiv there). answer = the missing numerator (number) */
  | { kind: 'fracMissing'; base: Frac; den: number }
  /** a +/- b with like denominators. answer = "n/d" (NOT simplified: n = a[0] op b[0], d = shared denominator) */
  | { kind: 'fracAddSub'; a: Frac; b: Frac; op: '+' | '-' }
  /** whole * frac. answer = "n/d" with n = whole*frac[0], d = frac[1] (not simplified) */
  | { kind: 'fracTimesWhole'; whole: number; frac: Frac }
  /** Read an analog clock showing h:m (h 1-12). answer = "h:mm" */
  | { kind: 'clockRead'; h: number; m: number }
  /** Set the clock to h:m. `snap` = minute step the hands snap to (60, 30, 5, 1). answer = "h:mm" */
  | { kind: 'clockSet'; h: number; m: number; snap: number }
  /** The clock shows h:m. Set it deltaMinutes later (positive) or earlier (negative). snap = minute step. answer = resulting "h:mm" (12-hour wrap) */
  | { kind: 'clockShift'; h: number; m: number; deltaMinutes: number; snap: number }
  /** Minutes from start to end (same day, end after start; h is 1-12, both in the same a.m./p.m. half unless crossing is implied by end < start numerically at 12->1). answer = minutes */
  | { kind: 'elapsed'; startH: number; startM: number; endH: number; endM: number }
  /** Convert time units. answer = value * factor (e.g. 3 hours -> 180 minutes) */
  | { kind: 'timeConvert'; value: number; from: 'hours' | 'minutes'; to: 'minutes' | 'seconds'; factor: number }
  /** Count the value of these coins (values in cents: 1,5,10,25,100=dollar bill,500=five). answer = total cents */
  | { kind: 'coinCount'; coins: number[] }
  /** Pay exactly priceCents using any of the `tray` coin denominations. answer = priceCents */
  | { kind: 'coinPay'; priceCents: number; tray: number[] }
  /** Change from paying `paidCents` for something costing `priceCents`. answer = cents */
  | { kind: 'change'; paidCents: number; priceCents: number }
  /** Total cost of items priced in cents. answer = total cents */
  | { kind: 'priceTotal'; pricesCents: number[] }
  /**
   * Story problem. `steps` is the exact computation, applied left to right starting
   * from steps[0].a: acc = a op b, then acc = acc op next.b ... (for later steps `a` is ignored).
   * If remainderMode is set the last step is a division with remainder:
   *   'floor' -> answer = quotient, 'ceil' -> answer = quotient + 1 (when remainder > 0), 'rem' -> answer = remainder.
   * answer = final number. `speaker` picks the trail friend who tells it.
   */
  | {
      kind: 'story';
      speaker: 'pip' | 'marlow' | 'odette';
      steps: { a: number; op: Op; b: number }[];
      remainderMode?: 'floor' | 'ceil' | 'rem';
      unit: string;
      /** Picture for the counted unit (a COUNT_ICONS name); unit is its plural label. */
      icon?: import('./art/keys').CountIcon;
    }
  /**
   * Hidden Dad mode (src/math/dad.ts): a radar / software-engineering question with a typed numeric
   * answer. `params` holds every input needed to recompute the answer from the textbook formula;
   * `decimals` is the rounding asked for. The display fields (title, question, given, ask, visual)
   * are what Dad Lab draws; `prompt` is question + given + ask in one string.
   */
  | {
      kind: 'dad';
      topic: string;
      category: 'radar' | 'software';
      params: Record<string, number | string>;
      unit: string;
      decimals: number;
      /** Ladder tier of the topic (1..6). */
      tier?: number;
      title?: string;
      question?: string;
      given?: string[];
      ask?: string;
      visual?: DadVisual;
    };

/** Small diagram drawn by Dad Lab next to a question. */
export interface DadVisual {
  kind: 'echo' | 'pulse' | 'wave' | 'rd' | 'bits' | 'code' | 'chirp' | 'beam' | 'spectrum' | 'ring' | 'table' | 'pipeline';
  /** Code / table / pipeline lines. */
  lines?: string[];
  /** Bit rows, most significant bit first; `hi` = [first index, length] to highlight. */
  rows?: { label: string; bits: string; hi?: [number, number] }[];
  /** Short annotations for the diagram (keys depend on kind). */
  labels?: Record<string, string | undefined>;
}

export type ProblemKind = ProblemData['kind'];

export interface Problem {
  strand: Strand;
  /** Difficulty level actually used, 1..12. */
  level: number;
  /** Short text shown on screen, e.g. "7 x 8 = ?" or the story text. */
  prompt: string;
  /** The single correct answer. Numbers for numeric answers; strings for signs, fractions ("3/4"), times ("4:05"), "q R r". */
  answer: number | string;
  /** 3 or 4 unique options that include `answer`, shuffled. Distractors come from common mistakes. Always present. */
  choices: (number | string)[];
  /** Extra answers that also count as correct (e.g. a simplified fraction typed at level 10+). Use isCorrectAnswer(). */
  accept?: (number | string)[];
  /** Absolute tolerance for numeric answers (Dad mode): |given - answer| <= tol counts as correct. Unset = exact. */
  tol?: number;
  /** One-sentence nudge shown after the second miss. Must not state the answer. */
  hint: string;
  /** Worked answer shown after the third miss, e.g. "7 x 8 = 56". States the answer. */
  explain: string;
  data: ProblemData;
}

/** Seedable RNG returning a float in [0, 1). */
export type Rng = () => number;

// ---------- Profiles and progress ----------

export interface StrandProgress {
  level: number; // 1..12
  streak: number; // consecutive first-try corrects since last change
  misses: number; // consecutive missed problems since last change
}

/**
 * Per camp. Each camp has AREAS_PER_ZONE areas (0 = Trail, 1 and 2 = side areas).
 * Present i lives in area floor(i / PRESENTS_PER_AREA). Frost gem placement per area is in scenes/zones.ts.
 */
export interface ZoneProgress {
  gems: boolean[]; // frost gems, length GEMS_PER_ZONE (6)
  presents: boolean[]; // length PRESENTS_PER_ZONE (6), true = opened (lantern earned)
  delivered: boolean; // camp lit (needs any LANTERNS_TO_LIGHT lanterns); gold star = all 6 presents
  /** Loose gems per area: loose[area][i] = time (ms epoch) it was picked up, 0 = never / respawned. */
  loose: number[][];
  /** Ice walls broken with the Ice Chisel, per area (index 1, 2 used). */
  iceBroken: boolean[];
  /** Areas whose first-visit "secret place" line has played (index 1, 2 used); never plays again. */
  seen: boolean[];
}

export interface Profile {
  id: string;
  name: string;
  grade: Grade;
  scarf: number; // index into scarf colours
  strands: Record<Strand, StrandProgress>;
  zones: ZoneProgress[]; // length 5
  unlockedZone: number; // highest zone index that can be entered, 0..4
  finished: boolean; // summit finale seen
  stats: { answered: number; firstTry: number };
  createdAt: number;
  // ---- v2 ----
  /** Gem purse (money). Never negative, never lost. */
  purse: number;
  /** Owned tools (store items except the consumable cocoa), as ToolId strings from art/keys.ts. */
  tools: string[];
  /** Cocoa Flasks carried, 0..MAX_COCOA. */
  cocoa: number;
  /** Owned hat indices (0..HAT_COUNT-1). */
  hats: number[];
  /** Hat being worn, or -1. */
  hat: number;
  /** Befriended Flurries, length FLURRY_KINDS (10). */
  flurries: boolean[];
  // ---- v3: heroes and followers ----
  /** Hero being played (unlock is derived from progress, see core/heroes.ts). */
  hero: import('./art/keys').HeroId;
  /** Befriended Flurry kind that trails behind the hero, or -1 for none. */
  follower: number;
  /** Heroes whose unlock toast has been shown. */
  heroToasts: import('./art/keys').HeroId[];
  // ---- hidden Dad mode (optional; absent on every kid profile) ----
  /** True for a profile created with the hidden "Dad" grade: every mini game is Dad Lab. */
  dadMode?: boolean;
  /** Dad Lab progress: level starts at 1 and has no upper cap. Present only when dadMode. */
  dad?: StrandProgress;
}

export interface SaveFile {
  version: 2;
  profiles: Profile[];
  lastProfileId: string | null;
  muted: boolean;
}

// ---------- Mini games ----------

export type MiniGameId = 'frostLock' | 'iceBridge' | 'gemSort' | 'pieShare' | 'clockTower' | 'coinShop' | 'trailFriend' | 'snowScale' | 'dadLab';

/** Phaser scene keys for mini games: `mg-${MiniGameId}`. */
export const miniGameSceneKey = (id: MiniGameId) => `mg-${id}`;

/** Data passed to a mini-game scene via scene.launch(key, data). */
export interface MiniGameLaunch {
  id: MiniGameId;
  zone: number; // 0..4
  rounds: number; // 1 for frostLock, 3 for the others
  /** Called exactly once when the mini game is finished and has closed itself. `completed` false if the child backed out. */
  onDone: (result: { completed: boolean }) => void;
}

export const NUM_ZONES = 5;
export const GEMS_PER_ZONE = 6;
export const AREAS_PER_ZONE = 3;
export const PRESENTS_PER_AREA = 2;
export const PRESENTS_PER_ZONE = AREAS_PER_ZONE * PRESENTS_PER_AREA; // 6
/** Lanterns needed to light a camp (any of the 6). All 6 earn a gold star. */
export const LANTERNS_TO_LIGHT = 4;
export const MAX_COCOA = 3;
export const NUM_FLURRIES = 10;

export const ZONE_NAMES = ['Lantern Meadow', 'Frostpine Forest', 'Glimmer Caves', 'Clocktower Ridge', 'The Summit'];
/** Added to the strand level inside each zone. */
export const ZONE_LEVEL_OFFSET = [0, 0, 1, 1, 2];
/** Mini game inside each of the 6 presents per zone: [Trail x2, side area 1 x2, side area 2 x2]. */
export const ZONE_PRESENTS: MiniGameId[][] = [
  ['gemSort', 'iceBridge', 'snowScale', 'trailFriend', 'coinShop', 'snowScale'],
  ['coinShop', 'clockTower', 'iceBridge', 'snowScale', 'trailFriend', 'gemSort'],
  ['iceBridge', 'gemSort', 'pieShare', 'snowScale', 'iceBridge', 'clockTower'],
  ['clockTower', 'pieShare', 'coinShop', 'snowScale', 'trailFriend', 'gemSort'],
  ['iceBridge', 'pieShare', 'clockTower', 'snowScale', 'trailFriend', 'coinShop'],
];
