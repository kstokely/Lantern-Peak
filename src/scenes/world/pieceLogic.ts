// Pure timing / motion logic of the v4 platforming pieces (no Phaser): unit-tested in tests/pieces.test.ts
// and used by the World pieces each frame. Times are ms.

/** Half widths of the one-way pieces' walkable tops (texture widths in art/keys.ts TEX4, minus a little). */
export const HALF = { ledge: 116, cloud: 116, log: 116, crumble: 96, brass: 96, aurora: 116, helper: 80 } as const;
/** Bounce pads: trigger half width and the height of the squashy top above the surface they stand on. */
export const PAD_HALF = 56;
export const PAD_TOP = 58;
/** Checkpoints light when the hero passes within this many px (x) of the post. */
export const CHECKPOINT_R = 80;

/** Tick-tock platforms: groups 0 and 1 swap solid <-> ghost every TICK_BEAT. */
export const TICK_BEAT = 1600;
/** The solid group blinks for this long before it turns to a ghost. */
export const TICK_WARN = 520;

export interface TickState {
  solid: boolean;
  /** Solid but about to vanish (blink). */
  warn: boolean;
  /** 0..1 progress through the current beat. */
  t: number;
  /** Beat number (a soft tick plays when it changes). */
  beat: number;
}

export function tickState(group: number, time: number, out: TickState = { solid: true, warn: false, t: 0, beat: 0 }): TickState {
  const beat = Math.floor(time / TICK_BEAT);
  const inBeat = time - beat * TICK_BEAT;
  out.beat = beat;
  out.t = inBeat / TICK_BEAT;
  out.solid = ((beat % 2) + 2) % 2 === (group & 1);
  out.warn = out.solid && inBeat >= TICK_BEAT - TICK_WARN;
  return out;
}

/** Aurora bridges: steady, warning shimmer (still solid), gone, fade back in (not solid until fully back). */
export const AURORA_SOLID = 2600;
export const AURORA_WARN = 900;
export const AURORA_GONE = 1500;
export const AURORA_FADE_IN = 400;
export const AURORA_CYCLE = AURORA_SOLID + AURORA_WARN + AURORA_GONE + AURORA_FADE_IN;

export interface AuroraState {
  solid: boolean;
  warn: boolean;
  alpha: number;
}

export function auroraState(time: number, phase = 0, out: AuroraState = { solid: true, warn: false, alpha: 1 }): AuroraState {
  const u = (((time + phase) % AURORA_CYCLE) + AURORA_CYCLE) % AURORA_CYCLE;
  if (u < AURORA_SOLID) {
    out.solid = true;
    out.warn = false;
    out.alpha = 1;
  } else if (u < AURORA_SOLID + AURORA_WARN) {
    const k = (u - AURORA_SOLID) / AURORA_WARN;
    out.solid = true;
    out.warn = true;
    // flicker that gets fainter: never below 0.45 while it can still be stood on
    out.alpha = 1 - 0.55 * k * (0.5 + 0.5 * Math.sin(u / 45));
  } else if (u < AURORA_SOLID + AURORA_WARN + AURORA_GONE) {
    out.solid = false;
    out.warn = false;
    out.alpha = 0.12;
  } else {
    out.solid = false;
    out.warn = false;
    out.alpha = 0.12 + 0.88 * ((u - AURORA_SOLID - AURORA_WARN - AURORA_GONE) / AURORA_FADE_IN);
  }
  return out;
}

/** Sine ease in/out, 0..1 -> 0..1. */
export const easeInOut = (x: number) => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, x)))) / 2;

/** Lift travel fraction 0..1 at `time`: pause at A, ease to B, pause at B, ease back. */
export function liftFraction(time: number, travel: number, pause: number, phase = 0): number {
  const cycle = 2 * (travel + pause);
  const u = (((time + phase) % cycle) + cycle) % cycle;
  if (u < pause) return 0;
  if (u < pause + travel) return easeInOut((u - pause) / travel);
  if (u < 2 * pause + travel) return 1;
  return 1 - easeInOut((u - 2 * pause - travel) / travel);
}

/** Longest a child can have to wait at one end of a lift for it to come back (ms). */
export const liftWorstWait = (travel: number, pause: number) => 2 * travel + pause;

/** Angle (rad) of platform i of n on a gear. */
export const gearAngle = (time: number, period: number, dir: number, i: number, n: number) =>
  dir * ((2 * Math.PI * time) / period) + (2 * Math.PI * i) / n;

/** Pendulum angle (rad, 0 = straight down). */
export const pendulumAngle = (time: number, amp: number, period: number, phase = 0) => amp * Math.sin((2 * Math.PI * time) / period + phase);

/** Wind gusts: 0..1 strength, on for WIND_ON then off for WIND_OFF, with soft ramps. */
export const WIND_ON = 2000;
export const WIND_OFF = 2000;
const WIND_RAMP = 300;
export function windStrength(time: number, phase = 0): number {
  const cyc = WIND_ON + WIND_OFF;
  const u = (((time + phase) % cyc) + cyc) % cyc;
  if (u >= WIND_ON) return 0;
  const k = Math.min(1, u / WIND_RAMP, (WIND_ON - u) / WIND_RAMP);
  return k * k * (3 - 2 * k);
}

/** Crumbling ledges: crack for CRUMBLE_MS after first being stood on, fall, regrow after CRUMBLE_REGROW. */
export const CRUMBLE_MS = 900;
export const CRUMBLE_REGROW = 3000;
export type CrumblePhase = 'solid' | 'cracking' | 'gone';

export class Crumble {
  phase: CrumblePhase = 'solid';
  since = 0;
  /** The hero stands on it at `now`. */
  stand(now: number) {
    if (this.phase === 'solid') {
      this.phase = 'cracking';
      this.since = now;
    }
  }
  /** Advances the state; returns true when the phase changed. */
  update(now: number): boolean {
    if (this.phase === 'cracking' && now - this.since >= CRUMBLE_MS) {
      this.phase = 'gone';
      this.since = now;
      return true;
    }
    if (this.phase === 'gone' && now - this.since >= CRUMBLE_REGROW) {
      this.phase = 'solid';
      this.since = now;
      return true;
    }
    return false;
  }
  get solid() {
    return this.phase !== 'gone';
  }
  /** Sprite frame 0..3 (solid, cracked, more cracked, breaking). */
  frame(now: number): number {
    if (this.phase === 'solid') return 0;
    if (this.phase === 'gone') return 3;
    return Math.min(2, 1 + Math.floor(((now - this.since) / CRUMBLE_MS) * 2));
  }
}

/** Falls per stretch (stretch = index of the last lit checkpoint, -1 = the entrance). */
export const HELPER_AFTER_FALLS = 3;

export class FallCounter {
  private counts = new Map<number, number>();
  /** Records a fall; returns true exactly when this fall makes the helper cloud appear for the stretch. */
  record(stretch: number): boolean {
    const n = (this.counts.get(stretch) ?? 0) + 1;
    this.counts.set(stretch, n);
    return n === HELPER_AFTER_FALLS;
  }
  falls(stretch: number) {
    return this.counts.get(stretch) ?? 0;
  }
  helper(stretch: number) {
    return this.falls(stretch) >= HELPER_AFTER_FALLS;
  }
  reset() {
    this.counts.clear();
  }
}
