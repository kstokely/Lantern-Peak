import { GRADE_START_LEVEL, MAX_LEVEL, MIN_LEVEL, ZONE_LEVEL_OFFSET } from '../types';
import type { Grade, StrandProgress } from '../types';

export const STREAK_TO_LEVEL_UP = 3;
export const MISSES_TO_LEVEL_DOWN = 2;

export function levelFloor(grade: Grade): number {
  return Math.max(MIN_LEVEL, GRADE_START_LEVEL[grade] - 2);
}

export function newStrandProgress(grade: Grade): StrandProgress {
  return { level: GRADE_START_LEVEL[grade], streak: 0, misses: 0 };
}

/**
 * A problem is either a first-try correct or a miss. Pure: returns a new object.
 * Counters reset on a level change; a correct resets misses, a miss resets streak.
 */
export function recordResult(
  p: StrandProgress,
  firstTry: boolean,
  grade: Grade,
): { progress: StrandProgress; change: -1 | 0 | 1 } {
  const floor = levelFloor(grade);
  if (firstTry) {
    const streak = p.streak + 1;
    if (streak >= STREAK_TO_LEVEL_UP) {
      if (p.level < MAX_LEVEL) return { progress: { level: p.level + 1, streak: 0, misses: 0 }, change: 1 };
      return { progress: { level: p.level, streak: 0, misses: 0 }, change: 0 };
    }
    return { progress: { level: p.level, streak, misses: 0 }, change: 0 };
  }
  const misses = p.misses + 1;
  if (misses >= MISSES_TO_LEVEL_DOWN) {
    if (p.level > floor) return { progress: { level: p.level - 1, streak: 0, misses: 0 }, change: -1 };
    return { progress: { level: p.level, streak: 0, misses: 0 }, change: 0 };
  }
  return { progress: { level: p.level, streak: 0, misses }, change: 0 };
}

/** Hidden Dad mode: same streak / miss rules as the kids' ladder, level >= 1 with no upper cap. Pure. */
export function recordDadResult(p: StrandProgress, firstTry: boolean): { progress: StrandProgress; change: -1 | 0 | 1 } {
  if (firstTry) {
    const streak = p.streak + 1;
    if (streak >= STREAK_TO_LEVEL_UP) return { progress: { level: p.level + 1, streak: 0, misses: 0 }, change: 1 };
    return { progress: { level: p.level, streak, misses: 0 }, change: 0 };
  }
  const misses = p.misses + 1;
  if (misses >= MISSES_TO_LEVEL_DOWN) {
    if (p.level > 1) return { progress: { level: p.level - 1, streak: 0, misses: 0 }, change: -1 };
    return { progress: { level: 1, streak: 0, misses: 0 }, change: 0 };
  }
  return { progress: { level: p.level, streak: 0, misses }, change: 0 };
}

/** Dad level inside a camp: the saved Dad level plus the camp's usual offset (no upper cap). */
export function effectiveDadLevel(dadLevel: number, zone: number): number {
  return Math.max(1, dadLevel + (ZONE_LEVEL_OFFSET[zone] ?? 0));
}

export function effectiveLevel(strandLevel: number, zone: number): number {
  const off = ZONE_LEVEL_OFFSET[zone] ?? 0;
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, strandLevel + off));
}
