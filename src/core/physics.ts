// Movement constants shared by the World scene and the reachability tests (tests/zones.test.ts).
// Pure numbers, no Phaser. Units: px, px/s, px/s^2, ms.

export const GRAVITY = 1800;
/** Full (held) jump: rises JUMP_V^2 / (2 GRAVITY) = 256 px. */
export const JUMP_V = 960;
/** Spring Hooves: rises ~342 px (reaches the 280 px doorway ledges). */
export const JUMP_V_HOOVES = 1110;
/** Releasing jump while still rising multiplies the upward speed by this (variable jump height). */
export const JUMP_CUT = 0.45;
export const SPEED = 330;
export const SPEED_SWIFT = 450;
export const MAX_FALL = 1400;
export const BODY_W = 70;
export const BODY_H = 118;
/** Jump still allowed this long after walking off an edge (checked a frame later, so the felt window is ~100 ms). */
export const COYOTE_MS = 120;
/** A jump pressed this long before landing still happens on landing. */
export const BUFFER_MS = 120;
/** Cloud Boots: one extra jump in mid-air (~187 px). */
export const AIR_JUMP_V = 820;
/** Feather Cape: holding jump while falling caps the fall speed at this. */
export const GLIDE_FALL = 150;
/** Bounce pads: launch speed (rises ~434 px), and with jump held (~544 px). */
export const PAD_V = 1250;
export const PAD_V_HOLD = 1400;
/** Ice without Grip Hooves: how fast the walk speed changes (px/s^2) while steering / letting go. */
export const ICE_ACCEL = 900;
export const ICE_DECEL = 520;
/** Peak sideways push of a wind gust (px/s). Walking into it still makes 330 - 200 = 130 px/s headway. */
export const WIND_MAX = 200;

export const riseFor = (v: number) => (v * v) / (2 * GRAVITY);
export const MAX_RISE_NORMAL = riseFor(JUMP_V); // 256
export const MAX_RISE_HOOVES = riseFor(JUMP_V_HOOVES); // 342

/** Time (s) for a jump with take-off speed v to come back down to `rise` px above take-off (rise may be negative). NaN if out of reach. */
export function airTime(v: number, rise: number): number {
  const d = v * v - 2 * GRAVITY * rise;
  if (d < 0) return NaN;
  return (v + Math.sqrt(d)) / GRAVITY;
}

/** Horizontal distance a full running jump covers before landing `rise` px above take-off. */
export const jumpReach = (rise: number, v = JUMP_V, speed = SPEED) => speed * airTime(v, rise);
