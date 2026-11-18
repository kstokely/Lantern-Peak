// Problem generator for Lantern Peak. Pure: all randomness comes from the Rng passed in.
// Integers only internally (cents for money, minutes for time). See docs/research.md Part 3.

import { MAX_LEVEL, MIN_LEVEL } from '../types';
import type { Frac, MiniGameId, Op, Problem, ProblemData, ProblemKind, Rng, Strand } from '../types';
import { chance, pick, randInt, shuffle, weighted } from './rng';
import { COUNT_ICONS } from '../art/keys';
import type { CountIcon } from '../art/keys';
import { ENTRY_LEVEL, ICON_PLURAL, formatCents, formatNum, formatTime, fracStr, gcd, padTwo } from './format';

type Val = number | string;

export interface GenOpts {
  /** Restrict to these kinds. If none exist at the level, any kind is used. */
  kinds?: ProblemKind[];
}

interface Spec {
  kind: ProblemKind;
  w: number;
  make: () => Problem;
}

interface MkIn {
  data: ProblemData;
  prompt: string;
  answer: Val;
  hint: string;
  explain: string;
  cands?: Val[];
  fill?: () => Val;
  /** Exact choices (already containing the answer), e.g. the three signs. */
  fixed?: Val[];
  /** Extra accepted answers (typed equivalents). */
  accept?: Val[];
}

const GENERIC_HINT = 'Take your time and try it one small step at a time.';

// ---------------------------------------------------------------- helpers

function hasAnswerToken(text: string, ans: Val): boolean {
  const s = String(ans);
  if (s.includes(' ')) return text.includes(s);
  const tokens = text.split(/\s+/).map((t) => t.replace(/^[("'.,;:!?]+|[)"'.,;:!?]+$/g, ''));
  return tokens.includes(s);
}

function numFill(rng: Rng, ans: number): number {
  const spread = Math.max(3, Math.round(ans * 0.2));
  return ans + randInt(rng, -spread, spread);
}

function mk(strand: Strand, level: number, rng: Rng, a: MkIn): Problem {
  let choices: Val[];
  if (a.fixed) {
    choices = a.fixed.slice();
  } else {
    const ans = a.answer;
    const seen = new Set<string>([String(ans)]);
    const accept = (v: Val): boolean => {
      if (typeof v !== typeof ans || v === '') return false;
      if (typeof v === 'number' && (!Number.isInteger(v) || v < 0)) return false;
      // add/sub distractors stay near the answer (no 103 for 8 + 5); off-by-a-hundred stays possible for big sums
      if (strand === 'addsub' && typeof v === 'number' && typeof ans === 'number' && Math.abs(v - ans) > Math.max(12, ans * 0.5)) return false;
      const k = String(v);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    };
    const pool: Val[] = [];
    for (const v of a.cands ?? []) if (accept(v)) pool.push(v);
    const picked = shuffle(rng, pool).slice(0, 3);
    let guard = 0;
    while (picked.length < 3 && guard++ < 300) {
      const v = a.fill ? a.fill() : typeof ans === 'number' ? numFill(rng, ans) : ans;
      if (accept(v)) picked.push(v);
    }
    if (typeof ans === 'number') {
      for (let k = 1; picked.length < 3 && k < 60; k++) if (accept(ans + k)) picked.push(ans + k);
    }
    choices = shuffle(rng, [ans, ...picked]);
  }
  const hint = hasAnswerToken(a.hint, a.answer) ? GENERIC_HINT : a.hint;
  const out: Problem = { strand, level, prompt: a.prompt, answer: a.answer, choices, hint, explain: a.explain, data: a.data };
  if (a.accept && a.accept.length) out.accept = a.accept;
  return out;
}

const opSym = (op: Op): string => (op === '+' ? '+' : op === '-' ? '−' : op === 'x' ? '×' : '÷');

function calc(a: number, op: Op, b: number): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case 'x':
      return a * b;
    default:
      return a / b;
  }
}

const SIGNS: Val[] = ['<', '>', '='];
const sign = (a: number, b: number): string => (a < b ? '<' : a > b ? '>' : '=');

/** Column-wise digit combine (no carry / no borrow), for "forgot to regroup" distractors. */
function columnwise(a: number, b: number, f: (x: number, y: number) => number): number {
  const sa = String(a).split('').reverse();
  const sb = String(b).split('').reverse();
  const n = Math.max(sa.length, sb.length);
  let out = 0;
  for (let i = n - 1; i >= 0; i--) {
    const x = Number(sa[i] ?? 0);
    const y = Number(sb[i] ?? 0);
    out = out * 10 + (f(x, y) % 10);
  }
  return out;
}

function pickSpec(rng: Rng, specs: Spec[], opts?: GenOpts): Spec {
  let list = specs;
  if (opts?.kinds && opts.kinds.length) {
    const f = specs.filter((s) => opts.kinds!.includes(s.kind));
    if (f.length) list = f;
  }
  return weighted(rng, list.map((s) => [s, s.w] as const));
}

// ---------------------------------------------------------------- counting

const PLACE_NAMES = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands'];
const ROUND_NAMES: Record<number, string> = {
  10: 'ten',
  100: 'hundred',
  1000: 'thousand',
  10000: 'ten thousand',
  100000: 'hundred thousand',
};

/** digit count used for place-value work at a level */
function digitCount(L: number, rng: Rng): number {
  if (L <= 3) return 2;
  if (L <= 9) return 3;
  if (L === 10) return randInt(rng, 4, 5);
  return randInt(rng, 5, 6);
}
const randOfDigits = (rng: Rng, nd: number): number => randInt(rng, 10 ** (nd - 1), 10 ** nd - 1);

function swapAdjacent(rng: Rng, n: number): number {
  const d = String(n).split('');
  for (let t = 0; t < 20; t++) {
    const i = randInt(rng, 0, d.length - 2);
    if (d[i] === d[i + 1]) continue;
    const c = d.slice();
    [c[i], c[i + 1]] = [c[i + 1], c[i]];
    if (c[0] === '0') continue;
    return Number(c.join(''));
  }
  return n;
}

function countingSpecs(L: number, rng: Rng): Spec[] {
  const m = (a: MkIn) => mk('counting', L, rng, a);
  const specs: Spec[] = [];
  const add = (kind: ProblemKind, w: number, make: () => Problem) => specs.push({ kind, w, make });

  const cmpHi = [20, 100, 120, 999, 1000, 999, 999, 1000, 999, 99999, 999999, 999999][L - 1];
  const cmpLo = L === 1 ? 0 : L <= 3 ? 10 : L <= 9 ? 100 : L === 10 ? 1000 : 10000;

  const count = (): Problem => {
    const n = L === 1 ? randInt(rng, 1, 10) : randInt(rng, 5, 20);
    const item: CountIcon = pick(rng, COUNT_ICONS);
    return m({
      data: { kind: 'count', count: n, item },
      prompt: `How many ${ICON_PLURAL[item]} are in the pile?`,
      answer: n,
      hint: 'Touch each one as you count so you do not skip any.',
      explain: `Counting them one by one gives ${n}.`,
      cands: [n + 1, n - 1, n + 2, n - 2, n + 10],
    });
  };

  const compare = (): Problem => {
    const a = randInt(rng, cmpLo, cmpHi);
    let b: number;
    const r = rng();
    if (r < 0.15) b = a;
    else if (r < 0.5 && a >= 10) {
      b = swapAdjacent(rng, a);
      if (b === a || b > cmpHi || b < cmpLo) b = randInt(rng, cmpLo, cmpHi);
    } else b = randInt(rng, cmpLo, cmpHi);
    const s = sign(a, b);
    const words = s === '<' ? 'less than' : s === '>' ? 'greater than' : 'equal to';
    return m({
      data: { kind: 'compare', a, b },
      prompt: `Which sign goes in the middle?  ${formatNum(a)}  ?  ${formatNum(b)}`,
      answer: s,
      hint: 'Compare the biggest place first. The open side of the sign faces the bigger number.',
      explain: `${formatNum(a)} is ${words} ${formatNum(b)}, so the sign is ${s}.`,
      fixed: SIGNS,
    });
  };

  const placeValue = (): Problem => {
    const nd = digitCount(L, rng);
    const target = randOfDigits(rng, nd);
    const digits = String(target).split('').map(Number);
    const parts = digits.map((d, i) => d * 10 ** (digits.length - 1 - i)).filter((v) => v > 0);
    return m({
      data: { kind: 'placeValue', target, digits },
      prompt: `Build ${formatNum(target)} with the place-value gems.`,
      answer: target,
      hint: 'Start with the biggest place on the left and work toward the ones.',
      explain: `${formatNum(target)} = ${parts.map(formatNum).join(' + ')}.`,
      cands: [swapAdjacent(rng, target), target + 1, target - 1, target + 10, target - 10, target + 100, target - 100],
    });
  };

  const digitValue = (): Problem => {
    const nd = digitCount(L, rng);
    let n = randOfDigits(rng, nd);
    let idx = 0;
    for (let t = 0; t < 60; t++) {
      n = randOfDigits(rng, nd);
      const ds = String(n).split('').map(Number); // most significant first
      const candidates: number[] = [];
      for (let i = 0; i < ds.length; i++) {
        const d = ds[i];
        if (d !== 0 && ds.filter((x) => x === d).length === 1) candidates.push(ds.length - 1 - i);
      }
      if (candidates.length) {
        idx = pick(rng, candidates);
        break;
      }
    }
    const digit = Math.floor(n / 10 ** idx) % 10;
    const value = digit * 10 ** idx;
    return m({
      data: { kind: 'digitValue', n, placeIndex: idx },
      prompt: `What is the value of the ${digit} in ${formatNum(n)}?`,
      answer: value,
      hint: 'Find which place the digit sits in: ones, tens, hundreds, and so on.',
      explain: `The ${digit} is in the ${PLACE_NAMES[idx]} place, so it is worth ${formatNum(value)}.`,
      cands: [digit, digit * 10 ** (idx + 1), idx > 0 ? digit * 10 ** (idx - 1) : -1, digit * 10 ** (idx + 2), n],
    });
  };

  const skip = (): Problem => {
    const steps =
      L <= 1
        ? [1]
        : L <= 3
          ? [1, 10]
          : L === 4
            ? [5, 10]
            : L === 5
              ? [5, 10, 100]
              : L === 6
                ? [2, 5, 10, 100]
                : L <= 9
                  ? [2, 3, 4, 5, 10, 100]
                  : [10, 100, 1000, 5, 25];
    const step = pick(rng, steps);
    const length = 5;
    const cap = Math.max(cmpHi, step * 8);
    const maxK = Math.max(1, Math.floor(cap / step) - (length - 1));
    const kMax = Math.min(maxK, L <= 1 ? 3 : 12);
    const start = step * randInt(rng, step === 1 ? 1 : 0, kMax);
    const blankIndex = randInt(rng, 1, length - 1);
    const seq = Array.from({ length }, (_, i) => start + step * i);
    const ans = seq[blankIndex];
    const shown = seq.map((v, i) => (i === blankIndex ? '__' : formatNum(v))).join(' , ');
    return m({
      data: { kind: 'skip', start, step, length, blankIndex },
      prompt: `Skip count. What number is missing?  ${shown}`,
      answer: ans,
      hint: 'Look at how much the numbers jump each time, then jump that amount again.',
      explain: `The numbers go up by ${formatNum(step)} each time, so the missing number is ${formatNum(ans)}.`,
      cands: [ans + 1, ans - 1, ans + step, ans - step, ans + 10, ans - 10, ans + 2 * step],
    });
  };

  const round = (): Problem => {
    const toChoices = L <= 9 ? [10, 100] : L === 10 ? [10, 100, 1000] : [100, 1000, 10000, 100000];
    const to = pick(rng, toChoices);
    const hi = L <= 9 ? 999 : L === 10 ? 99999 : 999999;
    const lo = Math.max(11, Math.floor(to * 1.2));
    let n = randInt(rng, lo, hi);
    for (let t = 0; t < 40; t++) {
      if (n % to !== to / 2 && n % to !== 0 && n >= to / 2) break;
      n = randInt(rng, lo, hi);
    }
    const ans = Math.floor((n + to / 2) / to) * to;
    const down = Math.floor(n / to) * to;
    const up = down + to;
    const otherTo = to === 10 ? 100 : to / 10;
    const otherAns = Math.floor((n + otherTo / 2) / otherTo) * otherTo;
    return m({
      data: { kind: 'round', n, to },
      prompt: `Round ${formatNum(n)} to the nearest ${ROUND_NAMES[to]}.`,
      answer: ans,
      hint: 'Look at the digit just to the right of that place. Half way or more rounds up.',
      explain: `${formatNum(n)} is closest to ${formatNum(ans)}, so it rounds to ${formatNum(ans)}.`,
      cands: [down, up, otherAns, ans + to, ans - to],
    });
  };

  if (L <= 3) add('count', L === 1 ? 3 : L === 2 ? 2 : 1, count);
  // Sign answers can only be picked, so they stop at the typed-answer levels.
  if (L < ENTRY_LEVEL) add('compare', L <= 1 ? 3 : L >= 6 && L <= 9 ? 3 : 2, compare);
  add('skip', L <= 1 ? 1 : L >= 10 ? 1 : 2, skip);
  if (L >= 2) add('placeValue', L === 8 || L >= 10 ? 2 : L >= 6 ? 1 : 2, placeValue);
  if (L >= 3) add('digitValue', L <= 3 ? 1 : 2, digitValue);
  if (L >= 7) add('round', L === 9 ? 3 : L === 7 ? 3 : 2, round);
  return specs;
}

// ---------------------------------------------------------------- addsub

/** An addition pair for the level; the matching subtraction is (x + y) - y. */
function addPair(L: number, rng: Rng): [number, number] {
  switch (L) {
    case 1: {
      const a = randInt(rng, 1, 9);
      return [a, randInt(rng, 1, 10 - a)];
    }
    case 2: {
      if (chance(rng, 0.5)) {
        const a = randInt(rng, 3, 9);
        return [a, randInt(rng, 11 - a, Math.min(9, 20 - a))];
      }
      const a = randInt(rng, 2, 14);
      return [a, randInt(rng, 1, Math.min(9, 20 - a))];
    }
    case 3: {
      const o = randInt(rng, 1, 8);
      const t = randInt(rng, 1, 8);
      const a = t * 10 + o;
      return chance(rng, 0.5) ? [a, randInt(rng, 1, 9 - o)] : [a, 10 * randInt(rng, 1, 9 - t)];
    }
    case 4: {
      const o1 = randInt(rng, 0, 8);
      const o2 = randInt(rng, 0, 9 - o1);
      const t1 = randInt(rng, 1, 8);
      const t2 = randInt(rng, 1, 9 - t1);
      return [t1 * 10 + o1, t2 * 10 + o2];
    }
    case 5: {
      for (let t = 0; t < 200; t++) {
        const a = randInt(rng, 11, 89);
        const b = randInt(rng, 6, 89);
        if ((a % 10) + (b % 10) >= 10 && a + b <= 100) return [a, b];
      }
      return [47, 38];
    }
    case 6: {
      if (chance(rng, 0.4)) {
        const a = randInt(rng, 100, 780);
        return [a, pick(rng, [10, 20, 30, 40, 100, 200])];
      }
      for (let t = 0; t < 200; t++) {
        const a = randInt(rng, 100, 900);
        const b = randInt(rng, 20, 900);
        if ((a % 10) + (b % 10) >= 10 && a + b <= 1000) return [a, b];
      }
      return [347, 285];
    }
    case 7:
    case 9: {
      const a = randInt(rng, L === 7 ? 100 : 200, L === 7 ? 899 : 950);
      return [a, randInt(rng, L === 7 ? 10 : 25, 1000 - a)];
    }
    case 8: {
      if (chance(rng, 0.5)) {
        const a = randInt(rng, 100, 690);
        return [a, pick(rng, [10, 20, 30, 40, 50, 90, 100, 200, 300])];
      }
      const a = randInt(rng, 100, 899);
      return [a, randInt(rng, 10, 1000 - a)];
    }
    case 10: {
      const a = randInt(rng, 1000, 89999);
      return [a, randInt(rng, 1000, 100000 - a)];
    }
    case 11: {
      const a = randInt(rng, 10000, 899999);
      return [a, randInt(rng, 1000, 999999 - a)];
    }
    default: {
      const a = randInt(rng, 50000, 899999);
      return [a, randInt(rng, 5000, 999999 - a)];
    }
  }
}

function addsubSpecs(L: number, rng: Rng): Spec[] {
  const m = (a: MkIn) => mk('addsub', L, rng, a);
  const specs: Spec[] = [];

  const operands = (op: '+' | '-'): { a: number; b: number } => {
    const [x, y] = addPair(L, rng);
    if (op === '+') return { a: x, b: y };
    return chance(rng, 0.5) ? { a: x + y, b: y } : { a: x + y, b: x };
  };

  const arith = (): Problem => {
    const op: '+' | '-' = chance(rng, 0.5) ? '+' : '-';
    const { a, b } = operands(op);
    const ans = calc(a, op, b);
    const cands: Val[] =
      op === '+'
        ? [ans - 1, ans + 1, ans - 10, ans + 10, Math.abs(a - b), columnwise(a, b, (x, y) => x + y), ans + 100, ans - 100]
        : [ans - 1, ans + 1, ans - 10, ans + 10, a + b, columnwise(a, b, (x, y) => Math.abs(x - y)), ans + 100];
    return m({
      data: { kind: 'arith', a, b, op },
      prompt: `${formatNum(a)} ${opSym(op)} ${formatNum(b)} = ?`,
      answer: ans,
      hint:
        L <= 2
          ? 'Count on from the bigger number, or make a ten first.'
          : op === '+'
            ? 'Add the ones first, then the tens. Carry if the ones make a new ten.'
            : 'Subtract the ones first. If you cannot, borrow a ten.',
      explain: `${formatNum(a)} ${opSym(op)} ${formatNum(b)} = ${formatNum(ans)}`,
      cands,
    });
  };

  const missing = (): Problem => {
    const op: '+' | '-' = chance(rng, 0.5) ? '+' : '-';
    const { a, b } = operands(op);
    const result = calc(a, op, b);
    const unknown: 'a' | 'b' = chance(rng, 0.5) ? 'a' : 'b';
    const ans = unknown === 'a' ? a : b;
    const known = unknown === 'a' ? b : a;
    const prompt =
      unknown === 'a'
        ? `? ${opSym(op)} ${formatNum(b)} = ${formatNum(result)}`
        : `${formatNum(a)} ${opSym(op)} ? = ${formatNum(result)}`;
    return m({
      data: { kind: 'missing', a, b, op, result, unknown },
      prompt,
      answer: ans,
      hint: 'Use the opposite operation to work backwards from the total.',
      explain: `${formatNum(a)} ${opSym(op)} ${formatNum(b)} = ${formatNum(result)}, so the missing number is ${formatNum(ans)}.`,
      cands: [ans + 1, ans - 1, ans + 10, ans - 10, result + known, Math.abs(result - known), result + ans],
    });
  };

  specs.push({ kind: 'arith', w: L === 1 ? 1 : 3, make: arith });
  if (L >= 2) specs.push({ kind: 'missing', w: 1, make: missing });
  return specs;
}

// ---------------------------------------------------------------- mult / div helpers

/** Factor pair a x b (a, b may include 0 at level 8) for the fact levels 1..9. */
function factPair(L: number, rng: Rng): [number, number] {
  if (L <= 3) return [randInt(rng, 1, 2), randInt(rng, 1, 3)];
  if (L === 4) return [randInt(rng, 1, 2), randInt(rng, 1, 5)];
  if (L === 5) return [randInt(rng, 1, 5), randInt(rng, 1, 5)];
  if (L === 6) {
    const a = pick(rng, [2, 5, 10]);
    return chance(rng, 0.5) ? [a, randInt(rng, 1, 10)] : [randInt(rng, 1, 10), a];
  }
  if (L === 7) {
    const a = pick(rng, [2, 3, 4, 5, 10]);
    const b = randInt(rng, 2, 10);
    return chance(rng, 0.5) ? [a, b] : [b, a];
  }
  if (L === 8) {
    const a = pick(rng, [6, 7, 8, 9]);
    const b = chance(rng, 0.08) ? 0 : randInt(rng, 2, 10);
    return chance(rng, 0.5) ? [a, b] : [b, a];
  }
  if (chance(rng, 0.4)) return [randInt(rng, 2, 9), 10 * randInt(rng, 2, 9)];
  const a = chance(rng, 0.05) ? pick(rng, [0, 1]) : randInt(rng, 2, 10);
  return [a, randInt(rng, 2, 10)];
}

// ---------------------------------------------------------------- mult

function multSpecs(L: number, rng: Rng): Spec[] {
  const m = (a: MkIn) => mk('mult', L, rng, a);
  const specs: Spec[] = [];

  const bigPair = (): [number, number] => {
    if (L <= 9) return factPair(L, rng);
    const oneDigit = randInt(rng, 2, 9);
    const twoByTwo = (): [number, number] => [randInt(rng, 11, 99), randInt(rng, 11, 99)];
    if (L === 10) return [randInt(rng, 10, 9999), oneDigit];
    if (L === 11) return chance(rng, 0.6) ? twoByTwo() : [randInt(rng, 100, 9999), oneDigit];
    return chance(rng, 0.5) ? [randInt(rng, 1000, 9999), oneDigit] : twoByTwo();
  };

  const arith = (): Problem => {
    let [a, b] = bigPair();
    if (L === 10) {
      // spread over 2, 3 and 4 digit numbers evenly
      a = randOfDigits(rng, randInt(rng, 2, 4));
    }
    const ans = a * b;
    const cands: Val[] = [ans + a, ans - a, ans + b, ans - b, a + b, ans + 10, ans - 10, ans + 1, ans - 1];
    if (ans >= 100) cands.push(Math.floor(ans / 10), ans * 10);
    if (a >= 10 && b >= 10) {
      const tens = Math.floor(b / 10);
      const ones = b % 10;
      cands.push(a * ones + a * tens); // forgot to shift the tens row
      cands.push(a * ones);
    } else if (a >= 10 || b >= 10) {
      const big = Math.max(a, b);
      const small = Math.min(a, b);
      cands.push(Math.floor(big / 10) * small + (big % 10) * small * 10); // misplaced place values
      cands.push(Math.floor(ans / 10) + (big % 10 ? 0 : 1));
    }
    const lowLevel = L <= 6;
    const prompt =
      L <= 5
        ? `${a} ${a === 1 ? 'row' : 'rows'} of ${b}: ${a} × ${b} = ?`
        : lowLevel
          ? `${a} ${a === 1 ? 'group' : 'groups'} of ${b}: ${a} × ${b} = ?`
          : `${formatNum(a)} × ${formatNum(b)} = ?`;
    const hint =
      L <= 6
        ? 'Think of equal groups, or skip count by the group size.'
        : L <= 8
          ? 'Break the fact into two easier ones you already know, then add them.'
          : L === 9
            ? 'Do the basic fact first, then put the zero on the end if there is one.'
            : L === 10
              ? 'Multiply each place value separately, starting with the ones.'
              : 'Break one number into tens and ones, multiply each part, then add.';
    return m({
      data: { kind: 'arith', a, b, op: 'x' },
      prompt,
      answer: ans,
      hint,
      explain: `${formatNum(a)} × ${formatNum(b)} = ${formatNum(ans)}`,
      cands,
    });
  };

  const missing = (): Problem => {
    let a = 2;
    let b = 2;
    for (let t = 0; t < 50; t++) {
      if (L >= 10 && chance(rng, 0.4)) [a, b] = [randInt(rng, 2, 9), 10 * randInt(rng, 2, 9)];
      else [a, b] = factPair(Math.min(Math.max(L, 6), 9), rng);
      if (a >= 1 && b >= 1) break;
    }
    if (chance(rng, 0.5)) [a, b] = [b, a];
    const result = a * b;
    const unknown: 'a' | 'b' = chance(rng, 0.5) ? 'a' : 'b';
    const ans = unknown === 'a' ? a : b;
    const known = unknown === 'a' ? b : a;
    const prompt =
      unknown === 'a' ? `? × ${formatNum(b)} = ${formatNum(result)}` : `${formatNum(a)} × ? = ${formatNum(result)}`;
    return m({
      data: { kind: 'missing', a, b, op: 'x', result, unknown },
      prompt,
      answer: ans,
      hint: 'Ask yourself: how many groups of the known number fit in the total? Divide to find out.',
      explain: `${formatNum(a)} × ${formatNum(b)} = ${formatNum(result)}, so the missing number is ${formatNum(ans)}.`,
      cands: [ans + 1, ans - 1, ans + 2, ans - 2, result - known, result + known, known],
    });
  };

  specs.push({ kind: 'arith', w: 4, make: arith });
  if (L >= 6) specs.push({ kind: 'missing', w: L === 6 ? 1 : L === 7 ? 1.5 : 2, make: missing });
  return specs;
}

// ---------------------------------------------------------------- div

function divSpecs(L: number, rng: Rng): Spec[] {
  const m = (a: MkIn) => mk('div', L, rng, a);
  const specs: Spec[] = [];

  /** divisor and quotient for exact division */
  const exactPair = (): { b: number; q: number } => {
    if (L <= 3) {
      const b = randInt(rng, 2, 3);
      return { b, q: randInt(rng, 1, Math.floor(20 / b) > 5 ? 5 : Math.floor(20 / b)) };
    }
    if (L <= 6) {
      const b = pick(rng, [2, 3, 4, 5, 2, 5, 10]);
      return { b, q: randInt(rng, 1, Math.floor(20 / b)) };
    }
    if (L === 7) return { b: pick(rng, [2, 3, 4, 5, 10]), q: randInt(rng, 1, 10) };
    if (L === 8) {
      const b = randInt(rng, 2, 10);
      return { b, q: randInt(rng, 2, Math.floor(50 / b)) };
    }
    if (L === 9) return { b: randInt(rng, 2, 10), q: randInt(rng, 2, 10) };
    const b = randInt(rng, 2, 9);
    if (L === 10) return { b, q: randInt(rng, Math.ceil(10 / b), Math.floor(999 / b)) };
    if (L === 11) return { b, q: randInt(rng, Math.ceil(100 / b), Math.floor(9999 / b)) };
    return { b, q: randInt(rng, Math.ceil(1000 / b), Math.floor(9999 / b)) };
  };

  const arith = (): Problem => {
    const { b, q } = exactPair();
    const a = b * q;
    const cands: Val[] = [q + 1, q - 1, q + 2, q - 2, b, a - b, a + b];
    if (q >= 20) cands.push(q * 10, Math.floor(q / 10), q + 10, q - 10);
    return m({
      data: { kind: 'arith', a, b, op: '/' },
      prompt:
        L <= 6
          ? `Share ${a} equally into ${b} groups: ${a} ÷ ${b} = ?`
          : `${formatNum(a)} ÷ ${formatNum(b)} = ?`,
      answer: q,
      hint:
        L >= 10
          ? 'Split the number into easy chunks like hundreds and tens, then divide each chunk.'
          : 'Ask how many groups fit, and check by multiplying back.',
      explain: `${formatNum(a)} ÷ ${formatNum(b)} = ${formatNum(q)}`,
      cands,
    });
  };

  const missing = (): Problem => {
    const { b, q } = exactPair();
    const a = b * q;
    const unknown: 'a' | 'b' = chance(rng, 0.5) ? 'a' : 'b';
    const ans = unknown === 'a' ? a : b;
    const prompt = unknown === 'a' ? `? ÷ ${b} = ${q}` : `${a} ÷ ? = ${q}`;
    return m({
      data: { kind: 'missing', a, b, op: '/', result: q, unknown },
      prompt,
      answer: ans,
      hint: 'Use multiplication to work backwards: groups times size gives the total.',
      explain: `${a} ÷ ${b} = ${q}, so the missing number is ${ans}.`,
      cands: unknown === 'a' ? [q + b, a + b, a - b, q, a + 1, a - 1] : [q, a - q, b + 1, b - 1, a, b + 2],
    });
  };

  const divRem = (): Problem => {
    const b = randInt(rng, 2, 9);
    const r = chance(rng, 0.85) ? randInt(rng, 1, b - 1) : 0;
    const lo = L <= 11 ? 100 : 1000;
    const hiA = L <= 11 ? 8999 : 9999;
    const q = randInt(rng, Math.ceil(lo / b), Math.floor((hiA - r) / b));
    const a = b * q + r;
    const ans = `${q} R ${r}`;
    const cands: Val[] = [
      `${q + 1} R ${r}`,
      `${q - 1} R ${r}`,
      `${q} R ${(r + 1) % b}`,
      `${q} R ${b - r}`,
      `${q - 1} R ${r + b}`,
      `${r} R ${q % 10}`,
    ];
    if (r !== 0) cands.push(`${q} R 0`, `${q + 1} R 0`);
    return m({
      data: { kind: 'divRem', a, b },
      prompt: `${formatNum(a)} ÷ ${b} = ?  (quotient R remainder)`,
      answer: ans,
      hint: 'Divide as far as you can. What is left over must be smaller than the number you divide by.',
      explain: `${formatNum(a)} ÷ ${b} = ${q} with ${r} left over, so the answer is ${ans}.`,
      cands,
      fill: () => `${q + randInt(rng, -3, 3)} R ${randInt(rng, 0, b - 1)}`,
    });
  };

  const wArith = L === 11 ? 2 : L === 12 ? 1 : 4;
  specs.push({ kind: 'arith', w: wArith, make: arith });
  if (L >= 8) specs.push({ kind: 'missing', w: L >= 11 ? 1 : 2, make: missing });
  if (L >= 11) specs.push({ kind: 'divRem', w: L === 11 ? 4 : 5, make: divRem });
  return specs;
}

// ---------------------------------------------------------------- fractions

const FRAC_DENOMS_BY_LEVEL = (L: number): number[] => {
  if (L <= 2) return [2];
  if (L === 3) return [2, 4];
  if (L <= 6) return [2, 3, 4];
  if (L === 7) return [2, 3, 4, 5, 6, 7, 8];
  if (L <= 9) return [2, 3, 4, 6, 8];
  return [2, 3, 4, 5, 6, 8, 10, 12];
};

/** Typed fractions also accept the correctly simplified equivalent (6/8 -> 3/4, 6/3 -> 2/1 and 2). */
function simplifiedAccept(n: number, d: number): Val[] {
  const g = gcd(n, d);
  if (g <= 1) return [];
  const out: Val[] = [`${n / g}/${d / g}`];
  if (d / g === 1) out.push(n / g);
  return out;
}

const fracValEq = (a: Frac, b: Frac): boolean => a[0] * b[1] === b[0] * a[1];

function fractionsSpecs(L: number, rng: Rng): Spec[] {
  const m = (a: MkIn) => mk('fractions', L, rng, a);
  const specs: Spec[] = [];

  const showFrac = (): Frac => {
    const d = pick(rng, FRAC_DENOMS_BY_LEVEL(L));
    const n = L <= 2 || L === 7 ? 1 : randInt(rng, 1, d - 1);
    return [n, d];
  };

  const nameCands = (f: Frac): Val[] => {
    const [n, d] = f;
    return [
      `${n}/${d + 1}`,
      `${n}/${d + 2}`,
      `${Math.min(n + 1, d)}/${d}`,
      d - n >= 1 ? `${d - n}/${d}` : '',
      `${n}/${Math.max(2, d - 1)}`,
      `${n + 1}/${d + 1}`,
    ];
  };
  const fillFrac = (f: Frac) => (): Val => `${randInt(rng, 1, f[1] + 1)}/${randInt(rng, 2, f[1] + 3)}`;

  const show = (): Problem => {
    const frac = showFrac();
    const shape = pick(rng, ['pie', 'bar'] as const);
    const ans = fracStr(frac);
    return m({
      data: { kind: 'fracShow', frac, shape },
      prompt: `Shade ${ans} of the ${shape}.`,
      answer: ans,
      hint: 'The bottom number is how many equal parts there are. The top number is how many to shade.',
      explain: `${ans} means ${frac[0]} of the ${frac[1]} equal parts are shaded.`,
      cands: nameCands(frac),
      fill: fillFrac(frac),
    });
  };

  const name = (): Problem => {
    const frac = showFrac();
    const shape = pick(rng, ['pie', 'bar'] as const);
    const ans = fracStr(frac);
    return m({
      data: { kind: 'fracName', frac, shape },
      prompt: `What fraction of the ${shape} is shaded?`,
      answer: ans,
      hint: 'Count all the equal parts for the bottom number, then the shaded parts for the top number.',
      explain: `${frac[0]} of the ${frac[1]} equal parts are shaded, so the fraction is ${ans}.`,
      cands: nameCands(frac),
      fill: fillFrac(frac),
    });
  };

  const compare = (): Problem => {
    let a: Frac = [1, 2];
    let b: Frac = [1, 3];
    const mode = L === 7 ? 'unit' : L <= 9 ? (chance(rng, 0.5) ? 'sameNum' : 'sameDen') : chance(rng, 0.5) ? 'bench' : 'multiple';
    const dens = FRAC_DENOMS_BY_LEVEL(L === 7 ? 7 : L <= 9 ? 9 : 10);
    if (mode === 'unit') {
      const d1 = pick(rng, dens);
      let d2 = pick(rng, dens);
      while (d2 === d1) d2 = pick(rng, dens);
      a = [1, d1];
      b = [1, d2];
    } else if (mode === 'sameNum') {
      const d1 = pick(rng, dens.filter((d) => d >= 3));
      let d2 = pick(rng, dens.filter((d) => d >= 3));
      while (d2 === d1) d2 = pick(rng, dens.filter((d) => d >= 3));
      const n = randInt(rng, 1, Math.min(d1, d2) - 1);
      a = [n, d1];
      b = [n, d2];
    } else if (mode === 'sameDen') {
      const d = pick(rng, dens.filter((x) => x >= 3));
      const n1 = randInt(rng, 1, d - 1);
      let n2 = randInt(rng, 1, d - 1);
      if (chance(rng, 0.85)) while (n2 === n1) n2 = randInt(rng, 1, d - 1);
      a = [n1, d];
      b = [n2, d];
    } else if (mode === 'bench') {
      const lowD = pick(rng, dens.filter((d) => d >= 3));
      const highD = pick(rng, dens.filter((d) => d >= 3));
      const lowN = randInt(rng, 1, Math.floor((lowD - 1) / 2));
      const highN = randInt(rng, Math.floor(highD / 2) + 1, highD - 1);
      if (lowN * 2 < lowD && highN * 2 > highD) {
        a = [lowN, lowD];
        b = [highN, highD];
      }
      if (chance(rng, 0.5)) [a, b] = [b, a];
    } else {
      const d1 = pick(rng, [2, 3, 4, 5, 6]);
      const k = pick(rng, [2, 3, 4]);
      const n1 = randInt(rng, 1, d1 - 1);
      a = [n1, d1];
      const n2 = randInt(rng, 1, d1 * k - 1);
      b = chance(rng, 0.15) ? [n1 * k, d1 * k] : [n2, d1 * k];
      if (chance(rng, 0.5)) [a, b] = [b, a];
    }
    const s = sign(a[0] * b[1], b[0] * a[1]);
    const words = s === '<' ? 'less than' : s === '>' ? 'greater than' : 'equal to';
    return m({
      data: { kind: 'fracCompare', a, b },
      prompt: `Which sign goes in the middle?  ${fracStr(a)}  ?  ${fracStr(b)}`,
      answer: s,
      hint: 'Same-size pieces? Compare how many pieces. Bigger bottom numbers mean smaller pieces. Try comparing with one half.',
      explain: `${fracStr(a)} is ${words} ${fracStr(b)}, so the sign is ${s}.`,
      fixed: SIGNS,
    });
  };

  const equiv = (): Problem => {
    const maxD = L <= 9 ? 8 : 12;
    const baseDens = [2, 3, 4, 5, 6, 8, 10, 12].filter((d) => d * 2 <= maxD);
    let base: Frac = [1, 2];
    let eq: Frac = [2, 4];
    for (let t = 0; t < 100; t++) {
      const d = pick(rng, baseDens);
      const n = randInt(rng, 1, d - 1);
      if (gcd(n, d) !== 1) continue;
      const ks: number[] = [];
      for (let k = 2; d * k <= maxD; k++) ks.push(k);
      if (!ks.length) continue;
      const k = pick(rng, ks);
      if (L >= 9 && chance(rng, 0.4)) {
        base = [n * k, d * k];
        eq = [n, d];
      } else {
        base = [n, d];
        eq = [n * k, d * k];
      }
      break;
    }
    const uneq = (f: Frac): boolean => f[0] > 0 && f[1] >= 2 && !fracValEq(f, base) && !fracValEq(f, eq);
    const [bn, bd] = base;
    const [en, ed] = eq;
    const rawCands: Frac[] = [
      [bn + 1, bd + 1],
      [bn, ed],
      [en, bd],
      [bn + (ed - bd), bd + (ed - bd)],
      [en + 1, ed],
      [bn, bd + 1],
      [en, ed + 1],
      [bd, bn],
    ];
    const cands: Val[] = rawCands.filter(uneq).map(fracStr);
    const fill = (): Val => {
      for (let t = 0; t < 50; t++) {
        const f: Frac = [randInt(rng, 1, maxD), randInt(rng, 2, maxD)];
        if (uneq(f)) return fracStr(f);
      }
      return `${bn + 2}/${bd + 5}`;
    };
    return m({
      data: { kind: 'fracEquiv', base },
      prompt: `Which fraction is equal to ${fracStr(base)}?`,
      answer: fracStr(eq),
      hint: 'Multiply or divide the top and the bottom by the same number and the amount stays the same.',
      explain: `${fracStr(base)} and ${fracStr(eq)} name the same amount.`,
      cands,
      fill,
    });
  };

  const missingNum = (): Problem => {
    let base: Frac = [1, 2];
    let den = 4;
    for (let t = 0; t < 100; t++) {
      const d = pick(rng, [2, 3, 4, 5, 6]);
      const n = randInt(rng, 1, d - 1);
      const ks: number[] = [];
      for (let k = 2; d * k <= 12; k++) ks.push(k);
      if (!ks.length) continue;
      const k = pick(rng, ks);
      if (L >= 11 && chance(rng, 0.4)) {
        base = [n * k, d * k]; // reduce: 6/8 = ?/4
        den = d;
      } else {
        base = [n, d]; // scale up: 3/4 = ?/8
        den = d * k;
      }
      break;
    }
    const ans = (base[0] * den) / base[1];
    return m({
      data: { kind: 'fracMissing', base, den },
      prompt: `${fracStr(base)} = ?/${den}`,
      answer: ans,
      hint: 'Whatever you did to the bottom number to get the new bottom, do the same to the top number.',
      explain: `${fracStr(base)} = ${ans}/${den}, because the top and the bottom change by the same factor.`,
      cands: [ans + 1, ans - 1, base[0] + (den - base[1]), base[0], den, ans + 2, ans * 2, base[1]],
    });
  };

  const addSub = (): Problem => {
    const d = pick(rng, [3, 4, 5, 6, 8, 10, 12]);
    const op: '+' | '-' = chance(rng, 0.5) ? '+' : '-';
    let n1: number;
    let n2: number;
    if (op === '+') {
      n1 = randInt(rng, 1, d - 1);
      n2 = randInt(rng, 1, L === 11 ? Math.max(1, d - n1) : d - 1);
    } else {
      n1 = randInt(rng, 2, d - 1);
      n2 = randInt(rng, 1, n1 - 1);
    }
    const a: Frac = [n1, d];
    const b: Frac = [n2, d];
    const n = op === '+' ? n1 + n2 : n1 - n2;
    const ans = `${n}/${d}`;
    const wrongOp = op === '+' ? Math.abs(n1 - n2) : n1 + n2;
    const cands: Val[] = [
      `${n}/${d + d}`,
      `${n + 1}/${d}`,
      `${n - 1}/${d}`,
      wrongOp > 0 ? `${wrongOp}/${d}` : '',
      `${n}/${d + 1}`,
      `${n1 + n2 + 1}/${d}`,
    ];
    return m({
      data: { kind: 'fracAddSub', a, b, op },
      prompt: `${fracStr(a)} ${opSym(op)} ${fracStr(b)} = ?`,
      answer: ans,
      hint: 'The pieces are the same size, so only the tops change. Keep the bottom number the same.',
      explain: `${n1} ${opSym(op)} ${n2} = ${n}, and the bottom stays ${d}, so the answer is ${ans}.`,
      cands,
      fill: () => `${randInt(rng, 1, 2 * d)}/${d}`,
      accept: L >= ENTRY_LEVEL ? simplifiedAccept(n, d) : undefined,
    });
  };

  const timesWhole = (): Problem => {
    const whole = randInt(rng, 2, 6);
    const d = pick(rng, [2, 3, 4, 5, 6, 8, 10]);
    const frac: Frac = [randInt(rng, 1, d - 1), d];
    const n = whole * frac[0];
    const ans = `${n}/${d}`;
    return m({
      data: { kind: 'fracTimesWhole', whole, frac },
      prompt: `${whole} × ${fracStr(frac)} = ?`,
      answer: ans,
      hint: 'Multiply the whole number by the top number. The bottom number stays the same.',
      explain: `${whole} × ${frac[0]} = ${n}, and the bottom stays ${d}, so the answer is ${ans}.`,
      cands: [`${frac[0]}/${whole * d}`, `${n}/${whole * d}`, `${whole + frac[0]}/${d}`, `${n}/${d + 1}`, `${n + frac[0]}/${d}`],
      fill: () => `${randInt(rng, 1, n + 4)}/${d}`,
      accept: L >= ENTRY_LEVEL ? simplifiedAccept(n, d) : undefined,
    });
  };

  if (L <= 6) {
    specs.push({ kind: 'fracShow', w: 2, make: show });
    specs.push({ kind: 'fracName', w: 2, make: name });
    return specs;
  }
  specs.push({ kind: 'fracShow', w: L >= 11 ? 1 : 1.5, make: show });
  specs.push({ kind: 'fracName', w: L >= 11 ? 1 : 1.5, make: name });
  // Picking a sign or the equal fraction is inherently a choice, so those stop at the typed levels.
  if (L < ENTRY_LEVEL) specs.push({ kind: 'fracCompare', w: 2, make: compare });
  if (L >= 8 && L < ENTRY_LEVEL) specs.push({ kind: 'fracEquiv', w: 2, make: equiv });
  if (L >= ENTRY_LEVEL) specs.push({ kind: 'fracMissing', w: L === 10 ? 3 : 2, make: missingNum });
  if (L >= 11) specs.push({ kind: 'fracAddSub', w: L === 11 ? 3 : 2, make: addSub });
  if (L >= 12) specs.push({ kind: 'fracTimesWhole', w: 2.5, make: timesWhole });
  return specs;
}

// ---------------------------------------------------------------- time

function nameOf(rng: Rng): string {
  return pick(rng, ['Pip', 'Marlow', 'Odette']);
}

function timeSpecs(L: number, rng: Rng): Spec[] {
  const m = (a: MkIn) => mk('time', L, rng, a);
  const specs: Spec[] = [];
  const wrapH = (h: number): number => ((((h - 1) % 12) + 12) % 12) + 1;
  const wrapM = (x: number): number => ((x % 60) + 60) % 60;
  const T = (h: number, mm: number): string => formatTime(wrapH(h), wrapM(mm));

  const readMinute = (): number => {
    if (L <= 2) return 0;
    if (L === 3) return pick(rng, [0, 30]);
    if (L <= 5) return 5 * randInt(rng, 0, 11);
    if (L === 6) return chance(rng, 0.6) ? pick(rng, [0, 15, 30, 45]) : 5 * randInt(rng, 0, 11);
    if (L === 7) return chance(rng, 0.5) ? 5 * randInt(rng, 0, 11) : randInt(rng, 0, 59);
    return randInt(rng, 0, 59);
  };
  const snap = L <= 2 ? 60 : L === 3 ? 30 : L <= 6 ? 5 : 1;

  const timeCands = (h: number, mn: number): Val[] => {
    const out: Val[] = [T(h + 1, mn), T(h - 1, mn)];
    if (mn % 5 === 0) {
      out.push(T(mn === 0 ? 12 : mn / 5, h * 5)); // hands swapped
      out.push(T(h, mn + 5), T(h, mn - 5), T(h, mn + 30), T(h + 1, mn + 5));
    } else {
      out.push(T(h, mn + 1), T(h, mn - 1), T(h, mn + 10), T(h, mn - 10));
    }
    return out;
  };
  const timeFill = (): Val => T(randInt(rng, 1, 12), snap === 60 ? 0 : randInt(rng, 0, Math.floor(59 / snap)) * snap);

  const clockRead = (): Problem => {
    const h = randInt(rng, 1, 12);
    const mn = readMinute();
    const ans = formatTime(h, mn);
    return m({
      data: { kind: 'clockRead', h, m: mn },
      prompt: 'What time does the clock show?',
      answer: ans,
      hint: 'The short hand shows the hour. The long hand shows the minutes, counting by fives.',
      explain: `The short hand is at ${h} and the long hand shows ${mn} minutes, so the time is ${ans}.`,
      cands: timeCands(h, mn),
      fill: timeFill,
    });
  };

  const clockSet = (): Problem => {
    const h = randInt(rng, 1, 12);
    const mn = snap === 60 ? 0 : randInt(rng, 0, Math.floor(59 / snap)) * snap;
    const ans = formatTime(h, mn);
    return m({
      data: { kind: 'clockSet', h, m: mn, snap },
      prompt: `Set the clock to ${ans}.`,
      answer: ans,
      hint: 'Put the short hand on the hour, then turn the long hand to the right number of minutes.',
      explain: `Hour hand at ${h}, minute hand at ${mn} minutes: ${ans}.`,
      cands: timeCands(h, mn),
      fill: timeFill,
    });
  };

  const elapsed = (): Problem => {
    let sm: number;
    let d: number;
    if (L <= 8) {
      sm = 5 * randInt(rng, 0, 11);
      d = 5 * randInt(rng, 1, 12);
    } else if (L === 9) {
      sm = 5 * randInt(rng, 0, 11);
      d = 5 * randInt(rng, 12, 60);
    } else if (L === 10) {
      sm = 5 * randInt(rng, 0, 11);
      d = 5 * randInt(rng, 4, 48);
    } else {
      sm = randInt(rng, 0, 59);
      d = randInt(rng, 7, L === 11 ? 300 : 420);
    }
    const sh = randInt(rng, 1, 12);
    const start = (sh % 12) * 60 + sm;
    const e = (start + d) % 720;
    const eh = Math.floor(e / 60) || 12;
    const em = e % 60;
    const who = nameOf(rng);
    const s = formatTime(sh, sm);
    const en = formatTime(eh, em);
    const hm = d >= 60 ? `${Math.floor(d / 60)} h ${d % 60} min = ` : '';
    return m({
      data: { kind: 'elapsed', startH: sh, startM: sm, endH: eh, endM: em },
      prompt: `${who} starts at ${s} and stops at ${en}. How many minutes go by?`,
      answer: d,
      hint: 'Count up to the next hour first, then add the minutes that are left.',
      explain: `From ${s} to ${en} is ${hm}${d} minutes.`,
      cands: [d + 5, d - 5, d + 10, d - 10, d + 60, d - 60, d + 15, Math.abs(em - sm), Math.abs(eh - sh) * 60],
    });
  };

  const durText = (mins: number): string => {
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    const parts: string[] = [];
    if (hh) parts.push(`${hh} ${hh === 1 ? 'hour' : 'hours'}`);
    if (mm) parts.push(`${mm} ${mm === 1 ? 'minute' : 'minutes'}`);
    return parts.join(' ');
  };

  const clockShift = (): Problem => {
    const sh = randInt(rng, 1, 12);
    const step = L >= 11 ? 1 : 5;
    const sm = L >= 11 ? randInt(rng, 0, 59) : 5 * randInt(rng, 0, 11);
    const maxD = L <= 8 ? 60 : L === 9 ? 120 : L === 10 ? 180 : 240;
    const mag = step * randInt(rng, Math.ceil(10 / step), Math.floor(maxD / step));
    const later = chance(rng, 0.5);
    const delta = later ? mag : -mag;
    const startTotal = (sh % 12) * 60 + sm;
    const endTotal = (((startTotal + delta) % 720) + 720) % 720;
    const oppTotal = (((startTotal - delta) % 720) + 720) % 720;
    const fromTotal = (t: number): string => formatTime(Math.floor(t / 60) || 12, t % 60);
    const ans = fromTotal(endTotal);
    const eh = Math.floor(endTotal / 60) || 12;
    const em = endTotal % 60;
    const s = formatTime(sh, sm);
    const dur = durText(mag);
    return m({
      data: { kind: 'clockShift', h: sh, m: sm, deltaMinutes: delta, snap: step },
      prompt: `The clock shows ${s}. Set it ${dur} ${later ? 'later' : 'earlier'}.`,
      answer: ans,
      hint: later
        ? 'Move the minute hand forward. Each time it passes the 12, the hour hand moves on one hour.'
        : 'Move the minute hand backward. Each time it passes the 12 going back, the hour hand steps back one hour.',
      explain: `${s} ${later ? 'plus' : 'minus'} ${dur} is ${ans}.`,
      cands: [fromTotal(oppTotal), T(eh + 1, em), T(eh - 1, em), T(eh, em + 5), T(eh, em - 5), T(eh, em + 10), T(eh, em - 10), T(eh, em + 30)],
      fill: () => T(randInt(rng, 1, 12), step * randInt(rng, 0, Math.floor(59 / step))),
    });
  };

  const convert = (): Problem => {
    type Conv = { value: number; from: 'hours' | 'minutes'; to: 'minutes' | 'seconds'; factor: number };
    let c: Conv;
    const r = rng();
    if (L === 10 || (L >= 11 && r < 0.4)) c = { value: randInt(rng, 2, L === 10 ? 9 : 12), from: 'hours', to: 'minutes', factor: 60 };
    else if (L === 12 && r > 0.85) c = { value: randInt(rng, 2, 3), from: 'hours', to: 'seconds', factor: 3600 };
    else c = { value: randInt(rng, 2, L === 11 ? 9 : 15), from: 'minutes', to: 'seconds', factor: 60 };
    const ans = c.value * c.factor;
    return m({
      data: { kind: 'timeConvert', value: c.value, from: c.from, to: c.to, factor: c.factor },
      prompt: `${c.value} ${c.from} = ? ${c.to}`,
      answer: ans,
      hint: 'There are sixty minutes in an hour and sixty seconds in a minute.',
      explain: `${c.value} × ${c.factor} = ${ans}, so ${c.value} ${c.from} = ${ans} ${c.to}.`,
      cands: [c.value * 10, c.value * 100, c.value + c.factor, ans + c.factor, ans - c.factor, c.value * 60 === ans ? c.value * 6 : c.value * 60, c.value * 24],
    });
  };

  specs.push({ kind: 'clockRead', w: L >= 8 ? 1 : 3, make: clockRead });
  specs.push({ kind: 'clockSet', w: L >= 8 ? 1 : 2, make: clockSet });
  if (L >= 8) specs.push({ kind: 'elapsed', w: L === 11 ? 2 : 3, make: elapsed });
  if (L >= 8) specs.push({ kind: 'clockShift', w: 2.5, make: clockShift });
  if (L >= 10) specs.push({ kind: 'timeConvert', w: L === 10 ? 2 : L === 11 ? 3 : 2, make: convert });
  return specs;
}

// ---------------------------------------------------------------- money

function moneySpecs(L: number, rng: Rng): Spec[] {
  const m = (a: MkIn) => mk('money', L, rng, a);
  const specs: Spec[] = [];
  const fmt = formatCents;

  const coinCount = (): Problem => {
    const cfg =
      L <= 3
        ? { pool: [1, 10], max: 30, nMin: 2, nMax: 6 }
        : L === 4
          ? { pool: [1, 10], max: 50, nMin: 3, nMax: 7 }
          : L === 5
            ? { pool: [1, 5, 10, 25], max: 100, nMin: 3, nMax: 7 }
            : L === 6
              ? { pool: [1, 5, 10, 25, 100], max: 500, nMin: 3, nMax: 7 }
              : L === 7
                ? { pool: [1, 5, 10, 25, 100], max: 1000, nMin: 4, nMax: 8 }
                : { pool: [1, 5, 10, 25, 100, 500], max: 2000, nMin: 4, nMax: 8 };
    let coins: number[] = [10, 1, 1];
    for (let t = 0; t < 400; t++) {
      const n = randInt(rng, cfg.nMin, cfg.nMax);
      const cs = Array.from({ length: n }, () => pick(rng, cfg.pool));
      const total = cs.reduce((x, y) => x + y, 0);
      if (total <= cfg.max && total >= 2 && new Set(cs).size >= (cfg.pool.length > 2 ? 2 : 1)) {
        coins = cs;
        break;
      }
    }
    coins.sort((x, y) => y - x);
    const total = coins.reduce((x, y) => x + y, 0);
    const list = coins.map(fmt).join('  ');
    return m({
      data: { kind: 'coinCount', coins },
      prompt: `Count the money: ${list}.  ${total < 100 ? 'How many cents in all?' : 'How much money is that in all?'}`,
      answer: total,
      hint: 'Start with the biggest coin and count on as you add each one.',
      explain: `${coins.map(fmt).join(' + ')} = ${fmt(total)}`,
      cands: [total + 1, total - 1, total + 5, total - 5, total + 10, total - 10, total - coins[0], total + 25, coins.length],
    });
  };

  const coinPay = (): Problem => {
    const tray = L === 4 ? [1, 10] : L === 5 ? [1, 5, 10, 25] : L <= 7 ? [1, 5, 10, 25, 100] : [1, 5, 10, 25, 100, 500];
    const price =
      L === 4
        ? randInt(rng, 11, 49)
        : L === 5
          ? randInt(rng, 6, 99)
          : L === 6
            ? 5 * randInt(rng, 12, 100)
            : L === 7
              ? 5 * randInt(rng, 20, 200)
              : 5 * randInt(rng, 40, 400);
    let rest = price;
    const parts: string[] = [];
    for (const c of [...tray].sort((x, y) => y - x)) {
      while (rest >= c) {
        parts.push(fmt(c));
        rest -= c;
      }
    }
    return m({
      data: { kind: 'coinPay', priceCents: price, tray },
      prompt: `A snow cone costs ${fmt(price)}. Pay exactly ${fmt(price)}.`,
      answer: price,
      hint: 'Use the biggest coin that fits first, then fill in the rest with smaller coins.',
      explain: `${parts.join(' + ')} = ${fmt(price)}`,
      cands: [price + 1, price - 1, price + 5, price - 5, price + 10, price - 10, price + 25, price - 25],
    });
  };

  const change = (): Problem => {
    const paidChoices =
      L <= 6 ? [100, 500] : L <= 8 ? [500, 1000] : L === 9 ? [1000, 2000] : L === 10 ? [500, 1000, 2000] : L === 11 ? [2000, 5000, 10000] : [5000, 10000];
    const paid = pick(rng, paidChoices);
    const step = L <= 9 ? 5 : 1;
    const lo = Math.max(step, Math.ceil(paid * 0.1 / step) * step);
    const price = step * randInt(rng, Math.ceil(lo / step), Math.floor((paid - step) / step));
    const ans = paid - price;
    const who = nameOf(rng);
    return m({
      data: { kind: 'change', paidCents: paid, priceCents: price },
      prompt: `${who} pays ${fmt(paid)} for something that costs ${fmt(price)}. How much change?`,
      answer: ans,
      hint: 'Count up from the price to the amount paid.',
      explain: `${fmt(paid)} − ${fmt(price)} = ${fmt(ans)}`,
      cands: [ans + 1, ans - 1, ans + 5, ans - 5, ans + 10, ans - 10, ans + 100, ans - 100, paid + price, columnwise(paid, price, (x, y) => Math.abs(x - y))],
    });
  };

  const priceTotal = (): Problem => {
    const cfg: Record<number, { n: [number, number]; max: number }> = {
      5: { n: [2, 2], max: 100 },
      6: { n: [2, 3], max: 500 },
      7: { n: [2, 3], max: 1000 },
      8: { n: [2, 3], max: 1000 },
      9: { n: [3, 3], max: 2000 },
      10: { n: [3, 4], max: 5000 },
      11: { n: [3, 4], max: 10000 },
      12: { n: [4, 5], max: 10000 },
    };
    const c = cfg[Math.max(5, L)];
    const n = randInt(rng, c.n[0], c.n[1]);
    const step = L >= 10 ? 1 : 5;
    const maxPer = Math.floor(c.max / n);
    const loK = Math.max(1, Math.floor(maxPer / 10 / step));
    const prices = Array.from({ length: n }, () => step * randInt(rng, loK, Math.floor(maxPer / step)));
    const total = prices.reduce((x, y) => x + y, 0);
    const list = prices.map(fmt);
    const text = list.length === 2 ? `${list[0]} and ${list[1]}` : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
    return m({
      data: { kind: 'priceTotal', pricesCents: prices },
      prompt: `Items cost ${text}. What is the total?`,
      answer: total,
      hint: 'Add the cents first, then the dollars, and carry when the cents pass one hundred.',
      explain: `${prices.map(fmt).join(' + ')} = ${fmt(total)}`,
      cands: [total + 5, total - 5, total + 10, total - 10, total + 100, total - 100, total - prices[n - 1], Math.floor(total / 100) * 100, total + 1, total - 1],
    });
  };

  specs.push({ kind: 'coinCount', w: L <= 3 ? 1 : L <= 6 ? 2 : 1, make: coinCount });
  if (L >= 4) specs.push({ kind: 'coinPay', w: L <= 5 ? 2 : 1, make: coinPay });
  if (L >= 5) specs.push({ kind: 'priceTotal', w: L === 5 ? 1 : L <= 7 ? 2 : 3, make: priceTotal });
  if (L >= 6) specs.push({ kind: 'change', w: L <= 7 ? 2 : 3, make: change });
  return specs;
}

// ---------------------------------------------------------------- word

type Step = { a: number; op: Op; b: number };
type Speaker = 'pip' | 'marlow' | 'odette';
const SPEAKER_NAMES: Record<Speaker, { full: string; short: string }> = {
  pip: { full: 'Pip the snow hare', short: 'Pip' },
  marlow: { full: 'Marlow the marmot', short: 'Marlow' },
  odette: { full: 'Odette the owl', short: 'Odette' },
};
/** Things a story can be about: each has a picture (COUNT_ICONS) and its plural label is the story's unit. */
const STORY_ICONS: CountIcon[] = ['pinecone', 'snowball', 'berry', 'acorn', 'mitten', 'lantern', 'star', 'carrot', 'cookie', 'apple', 'candle', 'bell', 'feather', 'fish', 'gem'];

function divisorsOf(n: number, max: number): number[] {
  const out: number[] = [];
  for (let d = 2; d <= max; d++) if (n % d === 0 && n / d >= 2) out.push(d);
  return out;
}

/** Build a chain of steps for the given ops, or null. Every intermediate is a positive integer <= cap. */
function buildSteps(rng: Rng, ops: Op[], cap: number, fmax: number): Step[] | null {
  for (let t = 0; t < 300; t++) {
    const steps: Step[] = [];
    let acc = 0;
    let ok = true;
    for (let i = 0; i < ops.length && ok; i++) {
      const op = ops[i];
      if (i === 0) {
        if (op === '+') {
          const a = randInt(rng, 2, Math.max(2, cap - 4));
          const b = randInt(rng, 2, Math.max(2, cap - a));
          if (a + b > cap) ok = false;
          else steps.push({ a, op, b }), (acc = a + b);
        } else if (op === '-') {
          const a = randInt(rng, 4, cap);
          const b = randInt(rng, 2, a - 1);
          if (a - b < 1) ok = false;
          else steps.push({ a, op, b }), (acc = a - b);
        } else if (op === 'x') {
          const a = randInt(rng, 2, fmax);
          const b = randInt(rng, 2, fmax);
          if (a * b > cap) ok = false;
          else steps.push({ a, op, b }), (acc = a * b);
        } else {
          const b = randInt(rng, 2, fmax);
          const q = randInt(rng, 2, fmax);
          if (b * q > cap) ok = false;
          else steps.push({ a: b * q, op, b }), (acc = q);
        }
      } else {
        if (op === '+') {
          const b = randInt(rng, 2, Math.min(cap, 60));
          if (acc + b > cap) ok = false;
          else steps.push({ a: acc, op, b }), (acc += b);
        } else if (op === '-') {
          if (acc < 3) ok = false;
          else {
            const b = randInt(rng, 2, Math.min(acc - 1, 60));
            steps.push({ a: acc, op, b });
            acc -= b;
          }
        } else if (op === 'x') {
          const b = randInt(rng, 2, Math.min(fmax, 6));
          if (acc * b > cap) ok = false;
          else steps.push({ a: acc, op, b }), (acc *= b);
        } else {
          const ds = divisorsOf(acc, fmax);
          if (!ds.length) ok = false;
          else {
            const b = pick(rng, ds);
            steps.push({ a: acc, op, b });
            acc /= b;
          }
        }
      }
      if (ok && (acc < 1 || !Number.isInteger(acc))) ok = false;
    }
    if (ok && steps.length === ops.length) return steps;
  }
  return null;
}

function foldSteps(steps: Step[]): number {
  let acc = steps[0].a;
  for (const s of steps) acc = calc(acc, s.op, s.b);
  return acc;
}

function wordSpecs(L: number, rng: Rng): Spec[] {
  const make = (): Problem => {
    const speaker = pick(rng, ['pip', 'marlow', 'odette'] as const);
    const icon = pick(rng, STORY_ICONS);
    const unit = ICON_PLURAL[icon];
    const nm = SPEAKER_NAMES[speaker];
    let steps: Step[] | null = null;
    let remainderMode: 'floor' | 'ceil' | 'rem' | undefined;

    const opsList: Op[][] =
      L === 1 || L === 2 || L === 4
        ? [['+'], ['-']]
        : L === 3
          ? [['+'], ['-'], ['+', '+']]
          : L === 5 || L === 6
            ? [['+', '-'], ['-', '+'], ['+', '+'], ['-', '-'], ['+', '-']]
            : L === 7 || L === 8
              ? [['x'], ['/']]
              : L === 9
                ? [['x', '+'], ['x', '-'], ['/', '+'], ['+', 'x'], ['/', 'x'], ['x', '/']]
                : [['x', '+'], ['x', '-', '+'], ['+', 'x', '-'], ['x', 'x'], ['/', 'x', '+'], ['x']];
    const cap = L === 1 ? 10 : L <= 3 ? 20 : L <= 6 ? 100 : L === 7 ? 25 : L === 8 ? 100 : L === 9 ? 100 : 1000;
    const fmax = L === 7 ? 5 : 10;

    if (L <= 10) {
      steps = buildSteps(rng, pick(rng, opsList), cap, fmax);
    } else {
      remainderMode = pick(rng, ['floor', 'ceil', 'rem'] as const);
      const preList: Op[][] =
        L === 11 ? [[], [], ['+'], ['x'], ['-'], ['x', '+']] : [['x', '+'], ['x', '-'], ['+', 'x'], ['x'], ['+', '-']];
      for (let t = 0; t < 200 && !steps; t++) {
        const pre = pick(rng, preList);
        const b = randInt(rng, 3, 9);
        let base: Step[] = [];
        let acc: number;
        if (pre.length) {
          const built = buildSteps(rng, pre, L === 11 ? 200 : 400, 10);
          if (!built) continue;
          base = built;
          acc = foldSteps(built);
        } else {
          acc = randInt(rng, b * 3 + 1, 150);
        }
        if (acc % b === 0 || Math.floor(acc / b) < 2) continue;
        steps = [...base, { a: acc, op: '/', b }];
      }
    }
    if (!steps) steps = [{ a: 5, op: '+', b: 3 }];
    if (L === 1 && steps[0].op === '-' && steps[0].a < 4) steps = [{ a: 7, op: '-', b: 3 }];

    // answer
    let answer: number;
    if (remainderMode) {
      const pre = steps.slice(0, -1);
      const last = steps[steps.length - 1];
      const acc = pre.length ? foldSteps(pre) : last.a;
      const q = Math.floor(acc / last.b);
      const r = acc % last.b;
      answer = remainderMode === 'floor' ? q : remainderMode === 'ceil' ? (r > 0 ? q + 1 : q) : r;
    } else {
      answer = foldSteps(steps);
    }

    // text
    const first = steps[0];
    const S = nm.full;
    const s = nm.short;
    const u = unit;
    const lastIdx = steps.length - 1;
    const clause = (st: Step, i: number): string => {
      const isLastRem = remainderMode && i === lastIdx;
      if (isLastRem) {
        if (remainderMode === 'floor') return `${s} packs them into boxes of ${st.b}`;
        if (remainderMode === 'ceil') return `${s} carries them on sleds that each hold ${st.b}`;
        return `${s} shares them equally among ${st.b} friends`;
      }
      if (st.op === '+') return `${s} finds ${st.b} more`;
      if (st.op === '-') return `${s} gives ${st.b} away`;
      if (st.op === 'x') return `the pile grows to ${st.b} times as many`;
      return `${s} splits them into ${st.b} equal piles`;
    };
    let sentence1: string;
    if (remainderMode && lastIdx === 0) {
      const tail =
        remainderMode === 'floor'
          ? `packs them into boxes of ${first.b}`
          : remainderMode === 'ceil'
            ? `carries them on sleds that each hold ${first.b}`
            : `shares them equally among ${first.b} friends`;
      sentence1 = `${S} has ${first.a} ${u} and ${tail}.`;
    } else if (first.op === '+') sentence1 = `${S} has ${first.a} ${u} and finds ${first.b} more.`;
    else if (first.op === '-') sentence1 = `${S} has ${first.a} ${u} and gives ${first.b} away.`;
    else if (first.op === 'x') sentence1 = `${S} fills ${first.a} baskets with ${first.b} ${u} each.`;
    else sentence1 = `${S} shares ${first.a} ${u} equally among ${first.b} friends.`;

    const rest = steps.slice(1).map((st, i) => clause(st, i + 1));
    const sentence2 = rest.length ? `Then ${rest.join(', and then ')}.` : '';
    const lastStep = steps[lastIdx];
    let question: string;
    if (remainderMode === 'floor') question = `How many full boxes does ${s} fill?`;
    else if (remainderMode === 'ceil') question = `How many sleds does ${s} need?`;
    else if (remainderMode === 'rem') question = 'How many are left over?';
    else if (lastStep.op === '+') question = `How many ${u} now?`;
    else if (lastStep.op === '-') question = `How many ${u} are left?`;
    else if (lastStep.op === 'x') question = `How many ${u} in all?`;
    else question = lastIdx === 0 ? 'How many does each friend get?' : 'How many are in each pile?';
    const prompt = [sentence1, sentence2, question].filter(Boolean).join(' ');

    // explanation and distractors
    const parts: string[] = [];
    const accs: number[] = [];
    let acc = first.a;
    steps.forEach((st, i) => {
      if (remainderMode && i === lastIdx) {
        const q = Math.floor(acc / st.b);
        const r = acc % st.b;
        const why =
          remainderMode === 'floor'
            ? `only full boxes count, so ${q}`
            : remainderMode === 'ceil'
              ? `the leftovers still need one more sled, so ${q + 1}`
              : `${r} are left over`;
        parts.push(`${acc} ÷ ${st.b} = ${q} R ${r}, ${why}`);
      } else {
        const before = i === 0 ? st.a : acc;
        acc = calc(before, st.op, st.b);
        parts.push(`${before} ${opSym(st.op)} ${st.b} = ${acc}`);
        accs.push(acc);
      }
    });
    const explain = parts.join(', then ') + (remainderMode ? '.' : `. The answer is ${answer}.`);

    const cands: Val[] = [answer + 1, answer - 1, answer + 2, answer - 2, ...accs];
    const prevAcc = lastIdx === 0 ? first.a : accs[accs.length - (remainderMode ? 1 : 2)] ?? first.a;
    if (remainderMode) {
      const q = Math.floor(prevAcc / lastStep.b);
      const r = prevAcc % lastStep.b;
      cands.push(q, q + 1, r, q + 2, lastStep.b - r);
    } else {
      for (const op of ['+', '-', 'x', '/'] as Op[]) {
        if (op !== lastStep.op) {
          const v = calc(prevAcc, op, lastStep.b);
          if (Number.isInteger(v)) cands.push(v);
        }
      }
      cands.push(steps.reduce((t, st) => t + st.b, steps[0].a));
    }

    const hint = remainderMode
      ? remainderMode === 'floor'
        ? 'Only full boxes count, so leftovers do not make another box.'
        : remainderMode === 'ceil'
          ? 'Leftovers still need a ride, so think about whether you need one more.'
          : 'Divide first, then look at what is left over.'
      : steps.length > 1
        ? 'Do one step at a time, then use that answer for the next step.'
        : lastStep.op === '+'
          ? 'Putting amounts together makes the number bigger. Add them.'
          : lastStep.op === '-'
            ? 'Some are going away, so the number gets smaller. Subtract.'
            : lastStep.op === 'x'
              ? 'Equal groups: think of multiplying, or skip count by the group size.'
              : 'Sharing equally means dividing. Check by multiplying back.';

    const data: ProblemData = { kind: 'story', speaker, steps, unit, icon, ...(remainderMode ? { remainderMode } : {}) };
    return mk('word', L, rng, { data, prompt, answer, hint, explain, cands });
  };
  return [{ kind: 'story', w: 1, make }];
}

// ---------------------------------------------------------------- dispatch

export function generateProblem(strand: Strand, level: number, rng: Rng, opts?: GenOpts): Problem {
  const L = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Number.isFinite(level) ? Math.round(level) : MIN_LEVEL));
  let specs: Spec[];
  switch (strand) {
    case 'counting':
      specs = countingSpecs(L, rng);
      break;
    case 'addsub':
      specs = addsubSpecs(L, rng);
      break;
    case 'mult':
      specs = multSpecs(L, rng);
      break;
    case 'div':
      specs = divSpecs(L, rng);
      break;
    case 'fractions':
      specs = fractionsSpecs(L, rng);
      break;
    case 'time':
      specs = timeSpecs(L, rng);
      break;
    case 'money':
      specs = moneySpecs(L, rng);
      break;
    default:
      specs = wordSpecs(L, rng);
  }
  return pickSpec(rng, specs, opts).make();
}

// ---------------------------------------------------------------- mini games

/** Snow Scale balance problem: a + ? = result (the child adds the missing weight). Any addsub level. */
function scaleMissing(L: number, rng: Rng): Problem {
  const [a, b] = addPair(L, rng);
  const result = a + b;
  return mk('addsub', L, rng, {
    data: { kind: 'missing', a, b, op: '+', result, unknown: 'b' },
    prompt: `${formatNum(a)} + ? = ${formatNum(result)}`,
    answer: b,
    hint: 'Ask how much more is needed to get from the first weight up to the total.',
    explain: `${formatNum(a)} + ${formatNum(b)} = ${formatNum(result)}, so the missing weight is ${formatNum(b)}.`,
    cands: [b + 1, b - 1, b + 10, b - 10, result + a, a, b + 2],
  });
}

export function generateForMiniGame(id: MiniGameId, levels: Record<Strand, number>, rng: Rng): Problem {
  switch (id) {
    case 'iceBridge': {
      const ml = levels.mult;
      if (ml < 4) return generateProblem('addsub', levels.addsub, rng, { kinds: ['arith'] });
      if (ml >= 8 && chance(rng, 1 / 3)) return generateProblem('div', levels.div, rng, { kinds: ['arith'] });
      return generateProblem('mult', ml, rng, { kinds: ['arith', 'missing'] });
    }
    case 'gemSort': {
      const l = levels.counting;
      const kinds: ProblemKind[] = l <= 2 ? ['count'] : l <= 4 ? ['placeValue'] : ['placeValue', 'digitValue'];
      return generateProblem('counting', l, rng, { kinds });
    }
    case 'pieShare':
      return generateProblem('fractions', levels.fractions, rng, { kinds: ['fracShow', 'fracName', 'fracCompare', 'fracEquiv', 'fracMissing', 'fracAddSub', 'fracTimesWhole'] });
    case 'clockTower':
      return generateProblem('time', levels.time, rng);
    case 'coinShop':
      return generateProblem('money', levels.money, rng);
    case 'trailFriend':
      return generateProblem('word', levels.word, rng);
    case 'snowScale': {
      // Compare (which side is heavier) is a sign pick, so from the typed levels on only the balance puzzle remains.
      const lc = levels.counting;
      if (lc >= ENTRY_LEVEL || chance(rng, 0.5)) return scaleMissing(levels.addsub, rng);
      return generateProblem('counting', lc, rng, { kinds: ['compare'] });
    }
    default: {
      const options: [Strand, number][] = [
        ['counting', 2],
        ['addsub', 3],
      ];
      if (levels.mult >= 4) options.push(['mult', 3]);
      if (levels.div >= 4) options.push(['div', levels.div >= 7 ? 2 : 1]);
      const strand = weighted(rng, options);
      const kinds: ProblemKind[] | undefined = strand === 'counting' ? ['compare', 'skip', 'round'] : undefined;
      return generateProblem(strand, levels[strand], rng, { kinds });
    }
  }
}
