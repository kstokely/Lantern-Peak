import type { Frac, Problem } from '../types';
import type { CountIcon } from '../art/keys';

export const padTwo = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/** 35 -> "35¢", 125 -> "$1.25", 500 -> "$5.00". Integer cents only. */
export function formatCents(cents: number): string {
  if (cents < 100) return `${cents}¢`;
  return `$${Math.floor(cents / 100)}.${padTwo(cents % 100)}`;
}

/** (4, 5) -> "4:05" */
export function formatTime(h: number, m: number): string {
  return `${h}:${padTwo(m)}`;
}

/** 1234567 -> "1,234,567" (locale independent). */
export function formatNum(n: number): string {
  const s = String(Math.abs(Math.trunc(n)));
  const out = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 ? `-${out}` : out;
}

export const fracStr = (f: Frac): string => `${f[0]}/${f[1]}`;

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function parseFrac(s: string): Frac | null {
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(s);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

export function parseTime(s: string): { h: number; m: number } | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(s);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

/** "12 R 3" -> {q:12, r:3} */
export function parseRemainder(s: string): { q: number; r: number } | null {
  const m = /^\s*(\d+)\s*R\s*(\d+)\s*$/i.exec(s);
  if (!m) return null;
  return { q: Number(m[1]), r: Number(m[2]) };
}

/** True when two fractions have equal value (cross multiplication, exact). */
export function fracValueEqual(a: Frac, b: Frac): boolean {
  return a[0] * b[1] === b[0] * a[1];
}

/**
 * Compares answers robustly. Two numbers compare numerically; a number against a
 * numeric string compares numerically; every other string pair compares exactly
 * (after trimming), so "3/4" never equals "6/8".
 */
export function answersEqual(a: number | string, b: number | string): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  if (typeof a === 'number' || typeof b === 'number') {
    const sa = typeof a === 'string' ? a.trim() : a;
    const sb = typeof b === 'string' ? b.trim() : b;
    if (sa === '' || sb === '') return false;
    const na = Number(sa);
    const nb = Number(sb);
    return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
  }
  return a.trim() === b.trim();
}

/** From this problem level up, answers are typed, never picked from choices. */
export const ENTRY_LEVEL = 10;

/** Plural label for every picture-able thing (COUNT_ICONS). Prompts and stories name items with these. */
export const ICON_PLURAL: Record<CountIcon, string> = {
  snowball: 'snowballs',
  gem: 'gems',
  pinecone: 'pinecones',
  star: 'stars',
  lantern: 'lanterns',
  carrot: 'carrots',
  mitten: 'mittens',
  cocoa: 'cocoa mugs',
  fish: 'fish',
  acorn: 'acorns',
  berry: 'berries',
  bell: 'bells',
  cookie: 'cookies',
  apple: 'apples',
  feather: 'feathers',
  candle: 'candles',
  sled: 'sleds',
  scarf: 'scarves',
  pie: 'pies',
  coin: 'coins',
};

/** True when `given` is the answer of `p` or one of its accepted equivalents. */
export function isCorrectAnswer(p: Pick<Problem, 'answer' | 'accept' | 'tol'>, given: number | string): boolean {
  if (answersEqual(given, p.answer)) return true;
  // Dad mode: numeric answers within an absolute tolerance (tiny float slack on top)
  if (typeof p.tol === 'number' && p.tol >= 0 && typeof p.answer === 'number') {
    const g = typeof given === 'number' ? given : given.trim() === '' ? NaN : Number(given.trim());
    const slack = 1e-9 + 4 * Number.EPSILON * Math.abs(p.answer); // float noise only, never a whole unit
    if (Number.isFinite(g) && Math.abs(g - p.answer) <= p.tol + slack) return true;
  }
  return (p.accept ?? []).some((a) => answersEqual(given, a));
}
