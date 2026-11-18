import { describe, expect, it } from 'vitest';
import type { Grade, StrandProgress } from '../src/types';
import { effectiveLevel, newStrandProgress, recordResult } from '../src/math/adaptive';

const run = (p: StrandProgress, results: boolean[], grade: Grade) => {
  let cur = p;
  const changes: number[] = [];
  for (const r of results) {
    const out = recordResult(cur, r, grade);
    cur = out.progress;
    changes.push(out.change);
  }
  return { cur, changes };
};

describe('newStrandProgress', () => {
  it('starts at the grade level with zero counters', () => {
    expect(newStrandProgress(1)).toEqual({ level: 1, streak: 0, misses: 0 });
    expect(newStrandProgress(2)).toEqual({ level: 4, streak: 0, misses: 0 });
    expect(newStrandProgress(3)).toEqual({ level: 7, streak: 0, misses: 0 });
    expect(newStrandProgress(4)).toEqual({ level: 10, streak: 0, misses: 0 });
  });
});

describe('recordResult', () => {
  it('goes up one level after 3 first-try corrects in a row and resets counters', () => {
    const { cur, changes } = run(newStrandProgress(2), [true, true, true], 2);
    expect(changes).toEqual([0, 0, 1]);
    expect(cur).toEqual({ level: 5, streak: 0, misses: 0 });
  });

  it('two corrects then a miss does not level up', () => {
    const { cur, changes } = run(newStrandProgress(2), [true, true, false, true], 2);
    expect(changes).toEqual([0, 0, 0, 0]);
    expect(cur.level).toBe(4);
    expect(cur.streak).toBe(1);
    expect(cur.misses).toBe(0);
  });

  it('goes down one level after 2 misses in a row and resets counters', () => {
    const { cur, changes } = run({ level: 8, streak: 0, misses: 0 }, [false, false], 3);
    expect(changes).toEqual([0, -1]);
    expect(cur).toEqual({ level: 7, streak: 0, misses: 0 });
  });

  it('a first-try correct resets misses', () => {
    const { cur, changes } = run({ level: 8, streak: 0, misses: 0 }, [false, true, false], 3);
    expect(changes).toEqual([0, 0, 0]);
    expect(cur).toEqual({ level: 8, streak: 0, misses: 1 });
  });

  it('a miss resets the streak', () => {
    const p = run({ level: 5, streak: 0, misses: 0 }, [true, true], 2).cur;
    expect(p.streak).toBe(2);
    const q = recordResult(p, false, 2).progress;
    expect(q.streak).toBe(0);
    expect(q.misses).toBe(1);
  });

  it('counters reset after a level change (needs a fresh 3 to go up again)', () => {
    const { cur, changes } = run(newStrandProgress(2), [true, true, true, true, true, true], 2);
    expect(changes).toEqual([0, 0, 1, 0, 0, 1]);
    expect(cur.level).toBe(6);
  });

  it('never goes above level 12', () => {
    const { cur, changes } = run({ level: 12, streak: 0, misses: 0 }, [true, true, true, true, true, true, true], 4);
    expect(cur.level).toBe(12);
    expect(changes.every((c) => c === 0)).toBe(true);
  });

  it('never drops below grade start minus 2 (floor 2 for grade 2)', () => {
    const { cur, changes } = run(newStrandProgress(2), Array(10).fill(false), 2);
    expect(cur.level).toBe(2);
    expect(changes.filter((c) => c === -1).length).toBe(2);
    expect(changes.every((c) => c >= -1)).toBe(true);
  });

  it('floor is level 1 for grade 1 and grade 2 start minus 2 at least 1', () => {
    expect(run(newStrandProgress(1), Array(8).fill(false), 1).cur.level).toBe(1);
    expect(run({ level: 8, streak: 0, misses: 0 }, Array(20).fill(false), 3).cur.level).toBe(5);
    expect(run({ level: 12, streak: 0, misses: 0 }, Array(20).fill(false), 4).cur.level).toBe(8);
  });

  it('is pure and does not mutate its input', () => {
    const p: StrandProgress = { level: 5, streak: 2, misses: 0 };
    const out = recordResult(p, true, 2);
    expect(p).toEqual({ level: 5, streak: 2, misses: 0 });
    expect(out.progress).not.toBe(p);
    expect(out.change).toBe(1);
  });
});

describe('effectiveLevel', () => {
  it('adds the zone offset and clamps to 1..12', () => {
    expect(effectiveLevel(5, 0)).toBe(5);
    expect(effectiveLevel(5, 1)).toBe(5);
    expect(effectiveLevel(5, 2)).toBe(6);
    expect(effectiveLevel(5, 3)).toBe(6);
    expect(effectiveLevel(5, 4)).toBe(7);
    expect(effectiveLevel(12, 4)).toBe(12);
    expect(effectiveLevel(11, 4)).toBe(12);
    expect(effectiveLevel(0, 0)).toBe(1);
    expect(effectiveLevel(1, 0)).toBe(1);
  });
});
