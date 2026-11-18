import { describe, expect, it } from 'vitest';
import { generateProblem } from '../src/math/generate';
import { makeRng } from '../src/math/rng';

describe('add/sub distractors stay plausible', () => {
  for (const level of [1, 2, 3, 4, 5, 6]) {
    it(`level ${level}: every numeric choice is near the answer`, () => {
      const rng = makeRng(900 + level);
      for (let i = 0; i < 600; i++) {
        const p = generateProblem('addsub', level, rng);
        if (typeof p.answer !== 'number') continue;
        const limit = Math.max(12, p.answer * 0.5);
        for (const c of p.choices) {
          expect(typeof c).toBe('number');
          expect(Math.abs((c as number) - p.answer), `${p.prompt} -> ${p.choices.join(', ')}`).toBeLessThanOrEqual(limit);
        }
        expect(new Set(p.choices.map(String)).size).toBe(p.choices.length);
      }
    });
  }
});
