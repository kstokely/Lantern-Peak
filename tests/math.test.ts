import { describe, expect, it } from 'vitest';
import { STRANDS } from '../src/types';
import { COUNT_ICONS } from '../src/art/keys';
import type { MiniGameId, Problem, ProblemData, ProblemKind, Strand } from '../src/types';
import { generateForMiniGame, generateProblem } from '../src/math/generate';
import { makeRng, pick, randInt, shuffle } from '../src/math/rng';
import { ENTRY_LEVEL, ICON_PLURAL, answersEqual, formatCents, isCorrectAnswer, formatTime, parseFrac, parseRemainder, parseTime } from '../src/math/format';

const SEEDS = 300;
const LEVELS = Array.from({ length: 12 }, (_, i) => i + 1);
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** Independent solver: recomputes the answer from data alone (fracEquiv needs the choices). */
function solve(d: ProblemData, choices?: (number | string)[]): number | string {
  const apply = (a: number, op: string, b: number): number =>
    op === '+' ? a + b : op === '-' ? a - b : op === 'x' ? a * b : a / b;
  switch (d.kind) {
    case 'count':
      return d.count;
    case 'compare':
      return d.a < d.b ? '<' : d.a > d.b ? '>' : '=';
    case 'placeValue':
      return Number(d.digits.join(''));
    case 'digitValue':
      return (Math.floor(d.n / 10 ** d.placeIndex) % 10) * 10 ** d.placeIndex;
    case 'skip':
      return d.start + d.step * d.blankIndex;
    case 'round':
      return Math.floor((d.n + d.to / 2) / d.to) * d.to;
    case 'arith':
      return apply(d.a, d.op, d.b);
    case 'missing': {
      if (d.unknown === 'a') {
        if (d.op === '+') return d.result - d.b;
        if (d.op === '-') return d.result + d.b;
        if (d.op === 'x') return d.result / d.b;
        return d.result * d.b;
      }
      if (d.op === '+') return d.result - d.a;
      if (d.op === '-') return d.a - d.result;
      if (d.op === 'x') return d.result / d.a;
      return d.a / d.result;
    }
    case 'divRem':
      return `${Math.floor(d.a / d.b)} R ${d.a % d.b}`;
    case 'fracShow':
    case 'fracName':
      return `${d.frac[0]}/${d.frac[1]}`;
    case 'fracCompare': {
      const l = d.a[0] * d.b[1];
      const r = d.b[0] * d.a[1];
      return l < r ? '<' : l > r ? '>' : '=';
    }
    case 'fracEquiv': {
      const eq = (choices ?? []).filter((c) => {
        const [n, dd] = String(c).split('/').map(Number);
        return n * d.base[1] === d.base[0] * dd;
      });
      return eq.length === 1 ? String(eq[0]) : `ambiguous:${eq.length}`;
    }
    case 'fracMissing':
      return (d.base[0] * d.den) / d.base[1];
    case 'clockShift': {
      const t = (((((d.h % 12) * 60 + d.m + d.deltaMinutes) % 720) + 720) % 720);
      return `${Math.floor(t / 60) || 12}:${pad2(t % 60)}`;
    }
    case 'fracAddSub':
      return `${d.op === '+' ? d.a[0] + d.b[0] : d.a[0] - d.b[0]}/${d.a[1]}`;
    case 'fracTimesWhole':
      return `${d.whole * d.frac[0]}/${d.frac[1]}`;
    case 'clockRead':
    case 'clockSet':
      return `${d.h}:${pad2(d.m)}`;
    case 'elapsed': {
      const s = (d.startH % 12) * 60 + d.startM;
      const e = (d.endH % 12) * 60 + d.endM;
      let diff = e - s;
      if (diff <= 0) diff += 720;
      return diff;
    }
    case 'timeConvert':
      return d.value * d.factor;
    case 'coinCount':
      return d.coins.reduce((x, y) => x + y, 0);
    case 'coinPay':
      return d.priceCents;
    case 'change':
      return d.paidCents - d.priceCents;
    case 'priceTotal':
      return d.pricesCents.reduce((x, y) => x + y, 0);
    case 'story': {
      let acc = d.steps[0].a;
      const n = d.remainderMode ? d.steps.length - 1 : d.steps.length;
      for (let i = 0; i < n; i++) acc = apply(acc, d.steps[i].op, d.steps[i].b);
      if (d.remainderMode) {
        const b = d.steps[d.steps.length - 1].b;
        const q = Math.floor(acc / b);
        const r = acc % b;
        return d.remainderMode === 'floor' ? q : d.remainderMode === 'ceil' ? (r > 0 ? q + 1 : q) : r;
      }
      return acc;
    }
    case 'dad':
      // hidden Dad mode problems are never produced by the kids' generator (see tests/dad.test.ts)
      return NaN;
  }
}

function tokensOf(text: string): string[] {
  return text.split(/\s+/).map((t) => t.replace(/^[("'.,;:!?]+|[)"'.,;:!?]+$/g, ''));
}

function canPay(price: number, tray: number[]): boolean {
  const ok = new Array<boolean>(price + 1).fill(false);
  ok[0] = true;
  for (let v = 1; v <= price; v++) for (const c of tray) if (c <= v && ok[v - c]) ok[v] = true;
  return ok[price];
}

/** Checks that must hold for every generated problem. */
function checkProblem(p: Problem, label: string, strandExpected?: Strand): void {
  const ctx = `${label} ${p.data.kind} "${p.prompt}"`;
  if (strandExpected) expect(p.strand, ctx).toBe(strandExpected);
  expect(p.level, ctx).toBeGreaterThanOrEqual(1);
  expect(p.level, ctx).toBeLessThanOrEqual(12);
  expect(p.prompt.trim().length, ctx).toBeGreaterThan(0);
  expect(p.hint.trim().length, ctx).toBeGreaterThan(0);
  expect(p.explain.trim().length, ctx).toBeGreaterThan(0);

  // answer recomputed independently
  const solved = solve(p.data, p.choices);
  expect(p.answer, ctx).toBe(solved);

  // numeric answers: non-negative integers
  if (typeof p.answer === 'number') {
    expect(Number.isInteger(p.answer), ctx).toBe(true);
    expect(p.answer, ctx).toBeGreaterThanOrEqual(0);
  }

  // choices
  expect(p.choices.length, ctx).toBeGreaterThanOrEqual(3);
  expect(p.choices.length, ctx).toBeLessThanOrEqual(4);
  expect(p.choices.filter((c) => c === p.answer).length, ctx).toBe(1);
  expect(new Set(p.choices.map(String)).size, ctx).toBe(p.choices.length);
  for (const c of p.choices) {
    expect(typeof c, ctx).toBe(typeof p.answer);
    if (typeof c === 'number') {
      expect(Number.isInteger(c) && c >= 0, `${ctx} choice ${c}`).toBe(true);
    }
  }
  if (p.data.kind === 'compare' || p.data.kind === 'fracCompare') {
    expect([...p.choices].sort(), ctx).toEqual(['<', '=', '>']);
  }
  if (typeof p.answer === 'string' && /^\d+\/\d+$/.test(p.answer)) {
    for (const c of p.choices) expect(/^\d+\/\d+$/.test(String(c)), `${ctx} choice ${c}`).toBe(true);
  }
  if (typeof p.answer === 'string' && p.data.kind === 'divRem') {
    for (const c of p.choices) expect(parseRemainder(String(c)), `${ctx} choice ${c}`).not.toBeNull();
  }
  if (p.data.kind === 'clockRead' || p.data.kind === 'clockSet' || p.data.kind === 'clockShift') {
    for (const c of p.choices) expect(parseTime(String(c)), `${ctx} choice ${c}`).not.toBeNull();
  }

  // hint never states the answer as a standalone token; explain does state it
  expect(tokensOf(p.hint).includes(String(p.answer)), `${ctx} hint "${p.hint}"`).toBe(false);

  // typed levels: no inherently-choice kinds; accept lists are valid equivalents
  if (p.level >= ENTRY_LEVEL) {
    expect(['compare', 'fracCompare', 'fracEquiv'], ctx).not.toContain(p.data.kind);
  }
  if (p.accept) {
    expect(p.level, ctx).toBeGreaterThanOrEqual(ENTRY_LEVEL);
    expect(p.accept.length, ctx).toBeGreaterThan(0);
    for (const a of p.accept) {
      expect(answersEqual(a, p.answer), ctx).toBe(false);
      if (typeof a === 'string') {
        const fa = parseFrac(a)!;
        const fb = parseFrac(String(p.answer))!;
        expect(fa[0] * fb[1], `${ctx} accept ${a}`).toBe(fb[0] * fa[1]);
      } else {
        const fb = parseFrac(String(p.answer))!;
        expect(a * fb[1], `${ctx} accept ${a}`).toBe(fb[0]);
      }
    }
    expect(isCorrectAnswer(p, p.accept[0])).toBe(true);
  }

  // kind specific sanity
  const d = p.data;
  switch (d.kind) {
    case 'count':
      expect(d.count).toBeGreaterThanOrEqual(1);
      expect(COUNT_ICONS as readonly string[]).toContain(d.item);
      expect(p.prompt, ctx).toContain(ICON_PLURAL[d.item]);
      break;
    case 'placeValue':
      expect(d.digits[0]).toBeGreaterThan(0);
      expect(String(d.target)).toBe(d.digits.join(''));
      break;
    case 'digitValue':
      expect(d.placeIndex).toBeGreaterThanOrEqual(0);
      expect(d.placeIndex).toBeLessThan(String(d.n).length);
      expect(Math.floor(d.n / 10 ** d.placeIndex) % 10, ctx).toBeGreaterThan(0);
      break;
    case 'skip':
      expect(d.blankIndex).toBeGreaterThanOrEqual(0);
      expect(d.blankIndex).toBeLessThan(d.length);
      expect(d.step).toBeGreaterThan(0);
      break;
    case 'round':
      expect(d.to).toBeGreaterThanOrEqual(10);
      break;
    case 'arith':
      expect(Number.isInteger(d.a) && Number.isInteger(d.b), ctx).toBe(true);
      if (d.op === '/') {
        expect(d.b, ctx).toBeGreaterThan(0);
        expect(d.a % d.b, ctx).toBe(0);
      }
      if (d.op === '-') expect(d.a - d.b, ctx).toBeGreaterThanOrEqual(0);
      break;
    case 'missing':
      expect(d.op === '/' ? d.result > 0 && d.b > 0 : true, ctx).toBe(true);
      if (d.op === '/') {
        if (d.unknown === 'a') expect((p.answer as number) % d.b, ctx).toBe(0);
        else expect(d.a % (p.answer as number), ctx).toBe(0);
      }
      if (d.op === 'x') expect(d.unknown === 'a' ? d.b : d.a, ctx).toBeGreaterThan(0);
      if (d.op === 'x') expect(d.a * d.b, ctx).toBe(d.result);
      if (d.op === '+') expect(d.a + d.b, ctx).toBe(d.result);
      if (d.op === '-') {
        expect(d.a - d.b, ctx).toBe(d.result);
        expect(d.result, ctx).toBeGreaterThanOrEqual(0);
      }
      break;
    case 'divRem':
      expect(d.b, ctx).toBeGreaterThanOrEqual(2);
      expect(d.a % d.b).toBeLessThan(d.b);
      break;
    case 'fracShow':
    case 'fracName':
      expect(d.frac[0]).toBeGreaterThan(0);
      expect(d.frac[1]).toBeGreaterThanOrEqual(2);
      expect(d.frac[0]).toBeLessThan(d.frac[1]);
      break;
    case 'fracCompare':
      for (const f of [d.a, d.b]) {
        expect(f[0]).toBeGreaterThan(0);
        expect(f[1]).toBeGreaterThanOrEqual(2);
      }
      break;
    case 'fracEquiv': {
      expect(d.base[0]).toBeGreaterThan(0);
      expect(d.base[1]).toBeGreaterThanOrEqual(2);
      const equalOnes = p.choices.filter((c) => {
        const f = parseFrac(String(c))!;
        return f[0] * d.base[1] === d.base[0] * f[1];
      });
      expect(equalOnes.length, ctx).toBe(1);
      expect(equalOnes[0], ctx).toBe(p.answer);
      expect(String(equalOnes[0]), ctx).not.toBe(`${d.base[0]}/${d.base[1]}`);
      for (const c of p.choices) {
        const f = parseFrac(String(c))!;
        expect(f[0]).toBeGreaterThan(0);
        expect(f[1]).toBeGreaterThanOrEqual(2);
      }
      break;
    }
    case 'fracMissing': {
      expect(d.base[0], ctx).toBeGreaterThan(0);
      expect(d.den, ctx).toBeGreaterThanOrEqual(2);
      expect((d.base[0] * d.den) % d.base[1], ctx).toBe(0);
      expect(p.answer as number, ctx).toBeGreaterThan(0);
      expect(p.prompt, ctx).toContain(`?/${d.den}`);
      break;
    }
    case 'clockShift':
      expect(d.h).toBeGreaterThanOrEqual(1);
      expect(d.h).toBeLessThanOrEqual(12);
      expect(d.m % d.snap, ctx).toBe(0);
      expect(Math.abs(d.deltaMinutes) % d.snap, ctx).toBe(0);
      expect(Math.abs(d.deltaMinutes), ctx).toBeGreaterThanOrEqual(10);
      expect(Math.abs(d.deltaMinutes), ctx).toBeLessThanOrEqual(240);
      expect(p.prompt, ctx).toContain(d.deltaMinutes > 0 ? 'later' : 'earlier');
      break;
    case 'fracAddSub':
      for (const f of [d.a, d.b]) {
        expect(f[0]).toBeGreaterThan(0);
        expect(f[1]).toBeGreaterThanOrEqual(2);
      }
      expect(d.a[1]).toBe(d.b[1]);
      if (d.op === '-') expect(d.a[0]).toBeGreaterThan(d.b[0]);
      break;
    case 'fracTimesWhole':
      expect(d.whole).toBeGreaterThanOrEqual(2);
      expect(d.frac[0]).toBeGreaterThan(0);
      expect(d.frac[1]).toBeGreaterThanOrEqual(2);
      break;
    case 'clockRead':
    case 'clockSet':
      expect(d.h).toBeGreaterThanOrEqual(1);
      expect(d.h).toBeLessThanOrEqual(12);
      expect(d.m).toBeGreaterThanOrEqual(0);
      expect(d.m).toBeLessThanOrEqual(59);
      if (d.kind === 'clockSet') {
        expect([60, 30, 5, 1]).toContain(d.snap);
        expect(d.snap === 60 ? d.m === 0 : d.m % d.snap === 0, ctx).toBe(true);
      }
      break;
    case 'elapsed':
      for (const h of [d.startH, d.endH]) {
        expect(h).toBeGreaterThanOrEqual(1);
        expect(h).toBeLessThanOrEqual(12);
      }
      for (const m of [d.startM, d.endM]) {
        expect(m).toBeGreaterThanOrEqual(0);
        expect(m).toBeLessThanOrEqual(59);
      }
      expect(p.answer as number, ctx).toBeGreaterThan(0);
      expect(p.answer as number, ctx).toBeLessThan(720);
      break;
    case 'timeConvert':
      expect(d.value).toBeGreaterThan(0);
      expect(d.factor).toBeGreaterThan(0);
      break;
    case 'coinCount':
      expect(d.coins.length).toBeGreaterThan(0);
      for (const c of d.coins) expect([1, 5, 10, 25, 100, 500]).toContain(c);
      break;
    case 'coinPay':
      expect(d.priceCents).toBeGreaterThan(0);
      expect(canPay(d.priceCents, d.tray), ctx).toBe(true);
      break;
    case 'change':
      expect(d.paidCents - d.priceCents, ctx).toBeGreaterThanOrEqual(0);
      expect(d.priceCents).toBeGreaterThan(0);
      break;
    case 'priceTotal':
      expect(d.pricesCents.length).toBeGreaterThanOrEqual(2);
      for (const c of d.pricesCents) expect(c).toBeGreaterThan(0);
      break;
    case 'story': {
      expect(d.steps.length).toBeGreaterThanOrEqual(1);
      expect(d.steps.length).toBeLessThanOrEqual(3);
      let acc = d.steps[0].a;
      const n = d.remainderMode ? d.steps.length - 1 : d.steps.length;
      for (let i = 0; i < n; i++) {
        const s = d.steps[i];
        if (s.op === '/') {
          expect(s.b, ctx).toBeGreaterThan(0);
          expect(acc % s.b, ctx).toBe(0);
        }
        acc = s.op === '+' ? acc + s.b : s.op === '-' ? acc - s.b : s.op === 'x' ? acc * s.b : acc / s.b;
        expect(Number.isInteger(acc) && acc >= 0, ctx).toBe(true);
      }
      if (d.remainderMode) {
        const last = d.steps[d.steps.length - 1];
        expect(last.op).toBe('/');
        expect(last.b).toBeGreaterThanOrEqual(2);
      }
      if (d.icon !== undefined) {
        expect(COUNT_ICONS as readonly string[]).toContain(d.icon);
        expect(d.unit, ctx).toBe(ICON_PLURAL[d.icon]);
        expect(p.prompt, ctx).toContain(d.unit);
      }
      expect(['pip', 'marlow', 'odette']).toContain(d.speaker);
      const names = { pip: 'Pip', marlow: 'Marlow', odette: 'Odette' };
      expect(p.prompt).toContain(names[d.speaker]);
      expect(p.prompt.split(/[.?!]/).filter((s) => s.trim()).length, ctx).toBeLessThanOrEqual(3);
      break;
    }
  }
}

describe('generateProblem: every strand x level x seeds', () => {
  for (const strand of STRANDS) {
    it(`${strand}: levels 1-12, ${SEEDS} seeds each, answers/choices/hints valid`, () => {
      for (const level of LEVELS) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const p = generateProblem(strand, level, makeRng(seed * 7919 + level * 104729 + strand.length));
          checkProblem(p, `${strand} L${level} s${seed}`, strand);
          expect(p.level).toBe(level);
        }
      }
    });
  }

  it('clamps out of range levels', () => {
    const lo = generateProblem('addsub', -5, makeRng(1));
    const hi = generateProblem('addsub', 99, makeRng(1));
    expect(lo.level).toBe(1);
    expect(hi.level).toBe(12);
  });

  it('is deterministic for the same seed', () => {
    for (const strand of STRANDS) {
      const a = generateProblem(strand, 8, makeRng(42));
      const b = generateProblem(strand, 8, makeRng(42));
      expect(a).toEqual(b);
    }
  });

  it('opts.kinds restricts kinds, and falls back to any kind when none exist at that level', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = generateProblem('counting', 5, makeRng(seed), { kinds: ['compare'] });
      expect(p.data.kind).toBe('compare');
      const q = generateProblem('counting', 1, makeRng(seed), { kinds: ['round'] }); // no round at level 1
      expect(['count', 'compare', 'skip']).toContain(q.data.kind);
      expect(q.choices).toContain(q.answer);
    }
  });
});

describe('difficulty actually grows', () => {
  const maxOperand = (strand: Strand, level: number, kind?: ProblemKind): number => {
    let best = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generateProblem(strand, level, makeRng(seed), kind ? { kinds: [kind] } : undefined);
      const d = p.data;
      if (d.kind === 'arith' || d.kind === 'missing') best = Math.max(best, d.a, d.b);
    }
    return best;
  };

  it('mult level 12 operands exceed level 7', () => {
    expect(maxOperand('mult', 12)).toBeGreaterThan(maxOperand('mult', 7));
    expect(maxOperand('mult', 12)).toBeGreaterThanOrEqual(1000);
    expect(maxOperand('mult', 7)).toBeLessThanOrEqual(10);
  });
  it('mult level 11 includes 2x2 digit problems', () => {
    let found = false;
    for (let seed = 1; seed <= SEEDS && !found; seed++) {
      const d = generateProblem('mult', 11, makeRng(seed), { kinds: ['arith'] }).data;
      if (d.kind === 'arith' && d.a >= 10 && d.a <= 99 && d.b >= 10 && d.b <= 99) found = true;
    }
    expect(found).toBe(true);
  });
  it('mult level 9 includes 1-digit x multiples of ten', () => {
    let found = false;
    for (let seed = 1; seed <= SEEDS && !found; seed++) {
      const d = generateProblem('mult', 9, makeRng(seed), { kinds: ['arith'] }).data;
      if (d.kind === 'arith' && d.b >= 20 && d.b % 10 === 0 && d.a < 10) found = true;
    }
    expect(found).toBe(true);
  });
  it('mult level 8 includes unknown-factor problems', () => {
    let found = false;
    for (let seed = 1; seed <= SEEDS && !found; seed++) {
      if (generateProblem('mult', 8, makeRng(seed)).data.kind === 'missing') found = true;
    }
    expect(found).toBe(true);
  });
  it('addsub level 6 larger than level 1; level 12 larger than level 6', () => {
    expect(maxOperand('addsub', 6, 'arith')).toBeGreaterThan(maxOperand('addsub', 1, 'arith'));
    expect(maxOperand('addsub', 12, 'arith')).toBeGreaterThan(maxOperand('addsub', 6, 'arith'));
  });
  it('div dividends grow and level 11-12 emit divRem', () => {
    expect(maxOperand('div', 12, 'arith')).toBeGreaterThan(maxOperand('div', 7, 'arith'));
    for (const level of [11, 12]) {
      const kinds = new Set<string>();
      for (let seed = 1; seed <= SEEDS; seed++) kinds.add(generateProblem('div', level, makeRng(seed)).data.kind);
      expect(kinds.has('divRem')).toBe(true);
    }
    for (let level = 1; level <= 10; level++) {
      for (let seed = 1; seed <= 100; seed++) {
        expect(generateProblem('div', level, makeRng(seed)).data.kind).not.toBe('divRem');
      }
    }
  });
  it('word problems: remainderMode only at 11-12, more steps at higher levels', () => {
    const modes = new Set<string>();
    let maxSteps1 = 0;
    let maxSteps10 = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (let level = 1; level <= 12; level++) {
        const d = generateProblem('word', level, makeRng(seed * 13 + level)).data;
        if (d.kind !== 'story') throw new Error('word must be story');
        if (d.remainderMode) {
          expect(level).toBeGreaterThanOrEqual(11);
          modes.add(d.remainderMode);
        }
        if (level === 2) maxSteps1 = Math.max(maxSteps1, d.steps.length);
        if (level === 10) maxSteps10 = Math.max(maxSteps10, d.steps.length);
      }
    }
    expect([...modes].sort()).toEqual(['ceil', 'floor', 'rem']);
    expect(maxSteps1).toBe(1);
    expect(maxSteps10).toBeGreaterThanOrEqual(3);
  });
  it('counting values grow with level', () => {
    const maxCompare = (level: number) => {
      let best = 0;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const d = generateProblem('counting', level, makeRng(seed), { kinds: ['compare'] }).data;
        if (d.kind === 'compare') best = Math.max(best, d.a, d.b);
      }
      return best;
    };
    expect(maxCompare(1)).toBeLessThanOrEqual(20);
    expect(maxCompare(9)).toBeGreaterThan(100);
    const maxTarget = (level: number) => {
      let best = 0;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const d = generateProblem('counting', level, makeRng(seed), { kinds: ['placeValue'] }).data;
        if (d.kind === 'placeValue') best = Math.max(best, d.target);
      }
      return best;
    };
    expect(maxTarget(12)).toBeGreaterThan(100000);
  });
  it('money totals grow with level', () => {
    const maxPrice = (level: number) => {
      let best = 0;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem('money', level, makeRng(seed), { kinds: ['priceTotal', 'change', 'coinCount'] });
        best = Math.max(best, p.answer as number);
      }
      return best;
    };
    expect(maxPrice(3)).toBeLessThanOrEqual(30);
    expect(maxPrice(12)).toBeGreaterThan(maxPrice(6));
  });
});

describe('kind variety', () => {
  it('every strand (except word, which is story only) emits at least 2 kinds across levels', () => {
    for (const strand of STRANDS) {
      if (strand === 'word') continue;
      const kinds = new Set<string>();
      for (const level of LEVELS) {
        for (let seed = 1; seed <= 60; seed++) kinds.add(generateProblem(strand, level, makeRng(seed + level * 1000)).data.kind);
      }
      expect(kinds.size, `${strand}: ${[...kinds].join(',')}`).toBeGreaterThanOrEqual(2);
    }
  });
  it('expected kinds appear per strand', () => {
    const expected: Record<string, string[]> = {
      counting: ['count', 'compare', 'placeValue', 'digitValue', 'skip', 'round'],
      addsub: ['arith', 'missing'],
      mult: ['arith', 'missing'],
      div: ['arith', 'missing', 'divRem'],
      fractions: ['fracShow', 'fracName', 'fracCompare', 'fracEquiv', 'fracMissing', 'fracAddSub', 'fracTimesWhole'],
      time: ['clockRead', 'clockSet', 'clockShift', 'elapsed', 'timeConvert'],
      money: ['coinCount', 'coinPay', 'change', 'priceTotal'],
      word: ['story'],
    };
    for (const strand of STRANDS) {
      const kinds = new Set<string>();
      for (const level of LEVELS) {
        for (let seed = 1; seed <= 100; seed++) kinds.add(generateProblem(strand, level, makeRng(seed + level * 1000)).data.kind);
      }
      expect([...kinds].sort(), strand).toEqual([...expected[strand]].sort());
    }
  });
  it('word problems vary in structure (step count, operations, remainder mode)', () => {
    const sigs = new Set<string>();
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 60; seed++) {
        const d = generateProblem('word', level, makeRng(seed * 31 + level)).data;
        if (d.kind === 'story') sigs.add(d.steps.map((s) => s.op).join('') + (d.remainderMode ?? ''));
      }
    }
    expect(sigs.size).toBeGreaterThanOrEqual(8);
  });
});

describe('generateForMiniGame', () => {
  const ids: MiniGameId[] = ['frostLock', 'iceBridge', 'gemSort', 'pieShare', 'clockTower', 'coinShop', 'trailFriend', 'snowScale'];
  const allAt = (l: number) => Object.fromEntries(STRANDS.map((s) => [s, l])) as Record<Strand, number>;

  for (const id of ids) {
    it(`${id}: valid problems at all-levels-equal 1..12`, () => {
      for (const level of LEVELS) {
        for (let seed = 1; seed <= 100; seed++) {
          const p = generateForMiniGame(id, allAt(level), makeRng(seed * 31 + level));
          checkProblem(p, `${id} L${level} s${seed}`);
        }
      }
    });
  }

  it('maps each mini game to the right strand and kinds', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 100; seed++) {
        const rng = () => makeRng(seed * 17 + level);
        const L = allAt(level);
        const ice = generateForMiniGame('iceBridge', L, rng());
        if (level < 4) {
          expect(ice.strand).toBe('addsub');
          expect(ice.data.kind).toBe('arith');
        } else if (level < 8) {
          expect(ice.strand).toBe('mult');
          expect(['arith', 'missing']).toContain(ice.data.kind);
        } else {
          expect(['mult', 'div']).toContain(ice.strand);
          if (ice.strand === 'div') expect(ice.data.kind).toBe('arith');
          else expect(['arith', 'missing']).toContain(ice.data.kind);
        }
        const gem = generateForMiniGame('gemSort', L, rng());
        expect(gem.strand).toBe('counting');
        if (level <= 2) expect(gem.data.kind).toBe('count');
        else expect(['placeValue', 'digitValue']).toContain(gem.data.kind);
        expect(generateForMiniGame('pieShare', L, rng()).strand).toBe('fractions');
        expect(generateForMiniGame('clockTower', L, rng()).strand).toBe('time');
        expect(generateForMiniGame('coinShop', L, rng()).strand).toBe('money');
        expect(generateForMiniGame('trailFriend', L, rng()).strand).toBe('word');
        const frost = generateForMiniGame('frostLock', L, rng());
        expect(['counting', 'addsub', 'mult', 'div']).toContain(frost.strand);
        if (level < 4) expect(['counting', 'addsub']).toContain(frost.strand);
        if (frost.strand === 'counting') expect(['compare', 'skip', 'round']).toContain(frost.data.kind);
      }
    }
  });

  it('iceBridge mixes in division about one time in three at mult level >= 8', () => {
    let div = 0;
    const N = 600;
    for (let seed = 1; seed <= N; seed++) {
      if (generateForMiniGame('iceBridge', allAt(9), makeRng(seed)).strand === 'div') div++;
    }
    expect(div / N).toBeGreaterThan(0.25);
    expect(div / N).toBeLessThan(0.42);
  });

  it('frostLock uses mult/div once levels allow, and uses per-strand levels', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) seen.add(generateForMiniGame('frostLock', allAt(8), makeRng(seed)).strand);
    expect([...seen].sort()).toEqual(['addsub', 'counting', 'div', 'mult']);
    const mixed = { ...allAt(1), mult: 9 };
    const p = generateForMiniGame('iceBridge', mixed, makeRng(5));
    expect(['mult', 'div']).toContain(p.strand);
    expect(p.level).toBe(p.strand === 'mult' ? 9 : 1);
  });
});

describe('rng and format helpers', () => {
  it('makeRng is deterministic and within [0,1)', () => {
    const a = makeRng(123);
    const b = makeRng(123);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(makeRng(1)()).not.toBe(makeRng(2)());
  });
  it('randInt/pick/shuffle', () => {
    const r = makeRng(9);
    for (let i = 0; i < 500; i++) {
      const n = randInt(r, 3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
    expect(pick(r, ['a'])).toBe('a');
    const s = shuffle(r, [1, 2, 3, 4, 5]);
    expect([...s].sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('formatting', () => {
    expect(formatCents(35)).toBe('35¢');
    expect(formatCents(125)).toBe('$1.25');
    expect(formatCents(500)).toBe('$5.00');
    expect(formatCents(1005)).toBe('$10.05');
    expect(formatTime(4, 5)).toBe('4:05');
    expect(formatTime(12, 30)).toBe('12:30');
  });
  it('answersEqual', () => {
    expect(answersEqual(3, 3)).toBe(true);
    expect(answersEqual(3, 4)).toBe(false);
    expect(answersEqual('3/4', '3/4')).toBe(true);
    expect(answersEqual('3/4', '6/8')).toBe(false);
    expect(answersEqual(12, '12')).toBe(true);
    expect(answersEqual('<', '>')).toBe(false);
    expect(answersEqual('12 R 3', '12 R 3')).toBe(true);
    expect(answersEqual(3, '')).toBe(false);
  });
  it('parsers', () => {
    expect(parseFrac('3/4')).toEqual([3, 4]);
    expect(parseTime('4:05')).toEqual({ h: 4, m: 5 });
    expect(parseRemainder('12 R 0')).toEqual({ q: 12, r: 0 });
    expect(parseFrac('x')).toBeNull();
  });
});

describe('typed answers from level 10 (no multiple choice at the top)', () => {
  const allAt = (l: number) => Object.fromEntries(STRANDS.map((s) => [s, l])) as Record<Strand, number>;
  const ids: MiniGameId[] = ['frostLock', 'iceBridge', 'gemSort', 'pieShare', 'clockTower', 'coinShop', 'trailFriend', 'snowScale'];
  const CHOICE_ONLY: ProblemKind[] = ['compare', 'fracCompare', 'fracEquiv'];

  it('no strand emits compare / fracCompare / fracEquiv at level 10-12, but the choices contract stays', () => {
    for (const strand of STRANDS) {
      for (const level of [10, 11, 12]) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const p = generateProblem(strand, level, makeRng(seed * 31 + level));
          expect(CHOICE_ONLY, `${strand} L${level}`).not.toContain(p.data.kind);
          expect(p.choices).toContain(p.answer);
        }
      }
    }
  });

  it('asking for a choice-only kind at level 10+ falls back to something typeable', () => {
    for (let seed = 1; seed <= 100; seed++) {
      expect(generateProblem('counting', 11, makeRng(seed), { kinds: ['compare'] }).data.kind).not.toBe('compare');
      const f = generateProblem('fractions', 12, makeRng(seed), { kinds: ['fracCompare', 'fracEquiv'] });
      expect(CHOICE_ONLY).not.toContain(f.data.kind);
    }
  });

  it('no mini game emits them at level 10+ (all levels equal, and mixed levels)', () => {
    for (const id of ids) {
      for (const level of [10, 11, 12]) {
        for (let seed = 1; seed <= 150; seed++) {
          const p = generateForMiniGame(id, allAt(level), makeRng(seed * 13 + level));
          if (p.level >= ENTRY_LEVEL) expect(CHOICE_ONLY, `${id} L${level}`).not.toContain(p.data.kind);
        }
      }
      for (let seed = 1; seed <= 150; seed++) {
        const lv = Object.fromEntries(STRANDS.map((s, i) => [s, 1 + ((seed + i * 5) % 12)])) as Record<Strand, number>;
        const p = generateForMiniGame(id, lv, makeRng(seed));
        if (p.level >= ENTRY_LEVEL) expect(CHOICE_ONLY, `${id} mixed`).not.toContain(p.data.kind);
      }
    }
  });

  it('sign kinds and fracEquiv still exist below level 10', () => {
    const seen = new Set<string>();
    for (let level = 1; level <= 9; level++) {
      for (let seed = 1; seed <= 100; seed++) {
        seen.add(generateProblem('counting', level, makeRng(seed)).data.kind);
        seen.add(generateProblem('fractions', level, makeRng(seed)).data.kind);
      }
    }
    for (const k of CHOICE_ONLY) expect(seen.has(k), k).toBe(true);
    expect(seen.has('fracMissing')).toBe(false);
  });

  it('fracMissing: only at level 10+, both directions at 11+, numeric answer', () => {
    const dirs = new Set<string>();
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 200; seed++) {
        const p = generateProblem('fractions', level, makeRng(seed + level * 77), { kinds: ['fracMissing'] });
        if (level < ENTRY_LEVEL) {
          expect(p.data.kind).not.toBe('fracMissing');
          continue;
        }
        expect(p.data.kind).toBe('fracMissing');
        if (p.data.kind === 'fracMissing') {
          expect(typeof p.answer).toBe('number');
          expect(p.data.den).toBeLessThanOrEqual(12);
          if (level === 10) expect(p.data.den).toBeGreaterThan(p.data.base[1]);
          dirs.add(`${level >= 11}:${p.data.den > p.data.base[1] ? 'up' : 'down'}`);
        }
      }
    }
    expect(dirs.has('true:up')).toBe(true);
    expect(dirs.has('true:down')).toBe(true);
  });

  it('accept lists: typed fractions also take the simplified equivalent, exact answers stay exact', () => {
    let withAccept = 0;
    let withoutAccept = 0;
    const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
    for (const kind of ['fracAddSub', 'fracTimesWhole'] as const) {
      for (const level of [11, 12]) {
        for (let seed = 1; seed <= 400; seed++) {
          const p = generateProblem('fractions', level, makeRng(seed + level * 5), { kinds: [kind] });
          if (p.data.kind !== kind) continue;
          const [n, dd] = parseFrac(String(p.answer))!;
          if (g(n, dd) > 1) {
            withAccept++;
            expect(p.accept, `${p.prompt} -> ${p.answer}`).toBeDefined();
            expect(p.accept).toContain(`${n / g(n, dd)}/${dd / g(n, dd)}`);
            expect(isCorrectAnswer(p, `${n / g(n, dd)}/${dd / g(n, dd)}`)).toBe(true);
            expect(isCorrectAnswer(p, p.answer)).toBe(true);
            expect(isCorrectAnswer(p, `${n + 1}/${dd}`)).toBe(false);
          } else {
            withoutAccept++;
            expect(p.accept).toBeUndefined();
          }
        }
      }
    }
    expect(withAccept).toBeGreaterThan(20);
    expect(withoutAccept).toBeGreaterThan(20);
    // a whole-number simplification is accepted both as a fraction and as a number
    const whole = { answer: '6/3', accept: ['2/1', 2] } as Pick<Problem, 'answer' | 'accept'>;
    expect(isCorrectAnswer(whole, '2/1')).toBe(true);
    expect(isCorrectAnswer(whole, 2)).toBe(true);
    expect(isCorrectAnswer(whole, '3/1')).toBe(false);
    expect(answersEqual('6/8', '3/4')).toBe(false); // answersEqual itself stays exact
    expect(isCorrectAnswer({ answer: '3/4' }, '6/8')).toBe(false); // no accept list, no equivalents
  });

  it('only typed-level problems carry accept lists', () => {
    for (const strand of STRANDS) {
      for (let level = 1; level <= 9; level++) {
        for (let seed = 1; seed <= 60; seed++) expect(generateProblem(strand, level, makeRng(seed)).accept).toBeUndefined();
      }
    }
  });
});

describe('clockShift', () => {
  it('time strand emits it from level 8 only, both directions, 12-hour wrap', () => {
    const dir = new Set<string>();
    let wrapped = 0;
    for (const level of LEVELS) {
      let n = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const p = generateProblem('time', level, makeRng(seed * 3 + level));
        if (p.data.kind !== 'clockShift') continue;
        n++;
        dir.add(p.data.deltaMinutes > 0 ? 'later' : 'earlier');
        const start = (p.data.h % 12) * 60 + p.data.m;
        if (start + p.data.deltaMinutes < 0 || start + p.data.deltaMinutes >= 720) wrapped++;
        if (level >= 11) expect(p.data.snap).toBe(1);
        else expect(p.data.snap).toBe(5);
      }
      if (level < 8) expect(n, `L${level}`).toBe(0);
      else expect(n, `L${level}`).toBeGreaterThan(10);
    }
    expect([...dir].sort()).toEqual(['earlier', 'later']);
    expect(wrapped).toBeGreaterThan(20);
  });
  it('known examples: 4:10 + 25 min = 4:35, 12:50 + 20 = 1:10, 1:05 - 20 = 12:45', () => {
    const t = (h: number, m: number, d: number) => solve({ kind: 'clockShift', h, m, deltaMinutes: d, snap: 5 });
    expect(t(4, 10, 25)).toBe('4:35');
    expect(t(12, 50, 20)).toBe('1:10');
    expect(t(1, 5, -20)).toBe('12:45');
    expect(t(12, 0, -60)).toBe('11:00');
  });
});

describe('Snow Scale generation', () => {
  const allAt = (l: number) => Object.fromEntries(STRANDS.map((s) => [s, l])) as Record<Strand, number>;
  it('uses compare below level 10 and missing "+" (unknown b) at every level; only missing at 10+', () => {
    for (const level of LEVELS) {
      const kinds = new Set<string>();
      for (let seed = 1; seed <= 300; seed++) {
        const p = generateForMiniGame('snowScale', allAt(level), makeRng(seed * 19 + level));
        checkProblem(p, `snowScale L${level} s${seed}`);
        kinds.add(p.data.kind);
        if (p.data.kind === 'compare') {
          expect(p.strand).toBe('counting');
          expect(level).toBeLessThan(ENTRY_LEVEL);
          expect([...p.choices].sort()).toEqual(['<', '=', '>']);
        } else {
          expect(p.data.kind).toBe('missing');
          expect(p.strand).toBe('addsub');
          if (p.data.kind === 'missing') {
            expect(p.data.op).toBe('+');
            expect(p.data.unknown).toBe('b');
            expect(p.data.a + p.data.b).toBe(p.data.result);
            expect(p.answer).toBe(p.data.b);
          }
        }
      }
      if (level < ENTRY_LEVEL) expect([...kinds].sort(), `L${level}`).toEqual(['compare', 'missing']);
      else expect([...kinds], `L${level}`).toEqual(['missing']);
    }
  });
  it('compare uses the counting level and missing the addsub level', () => {
    const lv = { ...allAt(3), counting: 5, addsub: 8 };
    for (let seed = 1; seed <= 100; seed++) {
      const p = generateForMiniGame('snowScale', lv, makeRng(seed));
      expect(p.level).toBe(p.strand === 'counting' ? 5 : 8);
    }
    const hi = { ...allAt(4), counting: 11 };
    for (let seed = 1; seed <= 100; seed++) expect(generateForMiniGame('snowScale', hi, makeRng(seed)).data.kind).toBe('missing');
  });
});

describe('counted pictures match the named thing', () => {
  it('count problems use many different icons and name them in the prompt', () => {
    const seen = new Set<string>();
    for (let level = 1; level <= 3; level++) {
      for (let seed = 1; seed <= 400; seed++) {
        const p = generateProblem('counting', level, makeRng(seed + level * 99), { kinds: ['count'] });
        if (p.data.kind !== 'count') continue;
        seen.add(p.data.item);
        expect(p.prompt).toContain(ICON_PLURAL[p.data.item]);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(15);
    for (const k of seen) expect(COUNT_ICONS as readonly string[]).toContain(k);
  });
  it('stories carry an icon whose plural is the unit, drawn from COUNT_ICONS', () => {
    const icons = new Set<string>();
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 150; seed++) {
        const p = generateProblem('word', level, makeRng(seed * 7 + level));
        if (p.data.kind !== 'story') throw new Error('story expected');
        expect(p.data.icon).toBeDefined();
        icons.add(p.data.icon!);
        expect(p.data.unit).toBe(ICON_PLURAL[p.data.icon!]);
        expect(p.prompt).toContain(p.data.unit);
      }
    }
    expect(icons.size).toBeGreaterThanOrEqual(10);
  });
  it('every COUNT_ICON has a plural label', () => {
    for (const k of COUNT_ICONS) expect(ICON_PLURAL[k].length).toBeGreaterThan(2);
  });
});

