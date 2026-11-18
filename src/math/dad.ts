// Hidden Dad mode: radar-systems and software-engineering questions with typed numeric answers.
// Pure: all randomness comes from the Rng passed in. See docs/design.md "Hidden Dad mode".
//
// Ladder: tier T1 = levels 1-2, T2 = 3-4, T3 = 5-6, T4 = 7-8, T5 = 9-10, T6 = 11+. Each tier adds
// topics and keeps the earlier ones with harder numbers; past level 10 the numbers get uglier, the
// rounding tighter (one more decimal at 13, 19 and 27) and the chained T6 topics more frequent.
// Levels have no cap; magnitudes stop growing at level 40 so every answer stays an exact double.

import type { DadVisual, Problem, ProblemData, Rng } from '../types';
import { pick, randInt, weighted } from './rng';

export type DadCategory = 'radar' | 'software';

const C = 3e8;
const C_GIVEN = 'c = 3 × 10^8 m/s';
const ri = randInt;
const log10 = Math.log10;
const MINUS = '−';

/** Ladder tier of a level (1..6). */
export function dadTier(level: number): number {
  return level <= 10 ? Math.max(1, Math.ceil(level / 2)) : 6;
}

/** Extra decimal places asked for at high levels. */
const extra = (L: number) => (L >= 13 ? 1 : 0) + (L >= 19 ? 1 : 0) + (L >= 27 ? 1 : 0);
/** Level used for magnitudes (stops growing at 40). */
const cap = (L: number) => Math.min(L, 40);
const ugly = (L: number) => L >= 11;

// ---------------------------------------------------------------- number helpers

/** Round half away from zero to d decimals (tiny relative nudge so 2.675 -> 2.68). */
export function roundTo(x: number, d: number): number {
  const k = 10 ** d;
  const s = x < 0 ? -1 : 1;
  const r = (s * Math.round(Math.abs(x) * k * (1 + 1e-12))) / k;
  return r === 0 ? 0 : r;
}

/** Plain decimal text with up to `maxDec` decimals, trailing zeros trimmed, unicode minus. */
export function fmt(x: number, maxDec = 6): string {
  if (!Number.isFinite(x)) return String(x);
  let s = String(Number(x.toFixed(maxDec)));
  if (s.includes('e')) s = x.toFixed(maxDec);
  return s.replace('-', MINUS);
}

/** Fixed decimals with unicode minus. */
export function fixed(x: number, d: number): string {
  const r = roundTo(x, d);
  return (r === 0 ? 0 : r).toFixed(d).replace('-', MINUS);
}

/** Smallest d <= max with x exactly representable at d decimals (else max). */
function exactDec(x: number, max: number): number {
  for (let d = 0; d < max; d++) if (Math.abs(roundTo(x, d) - x) < 1e-9 * Math.max(1, Math.abs(x))) return d;
  return max;
}

/** Decimals that give `sig` significant figures. */
function sigDec(x: number, sig: number): number {
  if (x === 0) return 0;
  return Math.max(0, Math.min(6, sig - 1 - Math.floor(log10(Math.abs(x)))));
}

const hex = (n: number, digits = 2) => '0x' + n.toString(16).toUpperCase().padStart(digits, '0');
const bin = (n: number, width: number) => n.toString(2).padStart(width, '0');
/** Binary in nibble groups: 10110110 -> "1011 0110". */
const binGroups = (n: number, width: number) => bin(n, width).replace(/\B(?=(\d{4})+(?!\d))/g, ' ');
/** Article for a number read aloud: an 8-, an 11-, an 18-, an 80…; otherwise a. */
const an = (n: number) => (/^(8|11|18)(\D|$)/.test(String(n)) || /^8/.test(String(n)) ? 'An' : 'A');
const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const frac = (x: number) => x - Math.floor(x);
const pow2 = (k: number) => 2 ** k;

/** "1000000" Hz -> "1 MHz", 48000 -> "48 kHz". */
function fmtHz(hz: number): string {
  if (hz >= 1e9 && hz % 1e7 === 0) return `${fmt(hz / 1e9)} GHz`;
  if (hz >= 1e6 && hz % 1e3 === 0) return `${fmt(hz / 1e6)} MHz`;
  if (hz >= 1e3) return `${fmt(hz / 1e3)} kHz`;
  return `${fmt(hz)} Hz`;
}

// ---------------------------------------------------------------- topic registry

interface Built {
  /** Inputs of the formula (undefined entries are dropped). */
  params: Record<string, number | string | undefined>;
  /** The exact (unrounded) answer. */
  value: number;
  unit: string;
  decimals: number;
  /** Integer-exact answer (counts, bit patterns): tol 0. */
  exact?: boolean;
  question: string;
  given?: string[];
  hint: string;
  /** Worked solution; `a` is the rounded answer with its unit. */
  explain: (a: string) => string;
  visual?: DadVisual;
  /** Plausible wrong answers (common slips). */
  near?: number[];
}

interface Topic {
  id: string;
  category: DadCategory;
  tier: number;
  title: string;
  make: (L: number, rng: Rng) => Built;
}

const TOPICS: Topic[] = [];
const topic = (id: string, category: DadCategory, tier: number, title: string, make: Topic['make']) => {
  TOPICS.push({ id, category, tier, title, make });
};

/** Catalogue of topic ids (tests and docs). */
export const DAD_TOPICS = (): { id: string; category: DadCategory; tier: number; title: string }[] =>
  TOPICS.map(({ id, category, tier, title }) => ({ id, category, tier, title }));

// ================================================================ RADAR

// ---------- T1
topic('r_echo', 'radar', 1, 'Range from echo delay', (L, rng) => {
  const km = rng() < 0.55;
  let t: number;
  let d: number;
  if (L <= 2) {
    t = km ? 10 * ri(rng, 2, 100) : ri(rng, 1, 20);
    d = km ? 1 : 0;
  } else if (L <= 10) {
    t = km ? ri(rng, 100, 3000) : ri(rng, 11, 99) / 10;
    d = km ? 2 : 0;
  } else {
    t = km ? ri(rng, 10000, 999999) / 100 : ri(rng, 1000, 99999) / 1000;
    d = (km ? 1 : 0) + extra(L);
  }
  const value = (C * t * 1e-6) / 2 / (km ? 1000 : 1);
  return {
    params: { t_us: t },
    value,
    unit: km ? 'km' : 'm',
    decimals: d,
    question: `A pulse's echo returns ${fmt(t)} µs after transmission. What is the target range?`,
    given: [C_GIVEN],
    hint: 'The pulse travels out and back: R = c·t/2.',
    explain: (a) => `R = c·t/2 = (3×10^8 m/s × ${fmt(t)}×10^−6 s) / 2 = ${a}`,
    visual: { kind: 'echo', labels: { dt: `Δt = ${fmt(t)} µs` } },
    near: [value * 2, value * 1000, value / 1000],
  };
});

topic('r_lambda', 'radar', 1, 'Wavelength', (L, rng) => {
  let f: number;
  let unit: string;
  let d: number;
  if (L <= 2) {
    f = pick(rng, [1, 1.5, 2, 3, 5, 6, 10, 12, 15, 30]);
    unit = 'cm';
    d = 1;
  } else if (L <= 10) {
    f = pick(rng, [1.2, 1.3, 2.8, 3.3, 5.5, 8.5, 9.4, 9.6, 13.5, 16, 24, 35, 77, 94]);
    unit = f >= 24 ? 'mm' : 'cm';
    d = 2;
  } else {
    f = ri(rng, 1000, 99999) / 1000;
    unit = 'mm';
    d = 2 + extra(L);
  }
  const lam = C / (f * 1e9);
  const value = lam * (unit === 'cm' ? 100 : 1000);
  return {
    params: { f_GHz: f },
    value,
    unit,
    decimals: d,
    question: `What is the free-space wavelength of a ${fmt(f)} GHz radar?`,
    given: [C_GIVEN],
    hint: 'λ = c/f.',
    explain: (a) => `λ = c/f = 3×10^8 / ${fmt(f)}×10^9 = ${fmt(lam, 7)} m = ${a}`,
    visual: { kind: 'wave', labels: { f: `f = ${fmt(f)} GHz`, lam: 'λ = ?' } },
    near: [value * 10, value / 2, value * 2],
  };
});

topic('r_pri', 'radar', 1, 'PRI and PRF', (L, rng) => {
  if (rng() < 0.5) {
    const prf = L <= 2 ? pick(rng, [250, 500, 1000, 2000, 2500, 4000, 5000, 10000, 20000]) : L <= 10 ? ri(rng, 3, 300) * 100 : ri(rng, 1000, 99999);
    const d = L <= 2 ? 0 : L <= 10 ? 1 : 2 + extra(L);
    const value = 1e6 / prf;
    return {
      params: { dir: 'pri', prf_Hz: prf },
      value,
      unit: 'µs',
      decimals: d,
      question: `The PRF is ${fmt(prf)} Hz. What is the pulse repetition interval (PRI)?`,
      hint: 'PRI = 1/PRF.',
      explain: (a) => `PRI = 1/PRF = 1 / ${fmt(prf)} Hz = ${fmt(1 / prf, 9)} s = ${a}`,
      visual: { kind: 'pulse', labels: { pri: 'PRI = ?', tau: 'τ' } },
      near: [value * 1000, value / 1000, value * 2],
    };
  }
  const pri = L <= 2 ? pick(rng, [50, 100, 200, 250, 400, 500, 1000, 2000]) : L <= 10 ? ri(rng, 30, 999) : ri(rng, 1000, 99999) / 10;
  const d = L <= 2 ? 1 : L <= 10 ? 2 : Math.min(6, 3 + extra(L));
  const value = 1000 / pri;
  return {
    params: { dir: 'prf', pri_us: pri },
    value,
    unit: 'kHz',
    decimals: d,
    question: `Pulses are transmitted every ${fmt(pri)} µs. What is the PRF?`,
    hint: 'PRF = 1/PRI.',
    explain: (a) => `PRF = 1/PRI = 1 / ${fmt(pri)}×10^−6 s = ${fmt(1e6 / pri, 4)} Hz = ${a}`,
    visual: { kind: 'pulse', labels: { pri: `PRI = ${fmt(pri)} µs`, tau: 'τ' } },
    near: [value * 1000, value / 1000, value * 2],
  };
});

topic('r_duty', 'radar', 1, 'Duty cycle', (L, rng) => {
  let tau: number;
  let prf: number;
  if (L <= 2) {
    tau = pick(rng, [0.5, 1, 2, 5, 10]);
    prf = pick(rng, [500, 1000, 2000, 4000, 5000]);
  } else if (L <= 10) {
    tau = ri(rng, 1, 500) / 10;
    prf = ri(rng, 2, 200) * 50;
  } else {
    tau = ri(rng, 100, 99999) / 1000;
    prf = ri(rng, 500, 50000);
  }
  // keep it a pulsed radar: duty <= 20 %
  while (tau * 1e-6 * prf > 0.2) prf = Math.max(50, Math.floor(prf / 2 / 50) * 50);
  const value = tau * 1e-6 * prf * 100;
  const d = L <= 10 ? exactDec(value, L <= 2 ? 4 : 3) : 3 + extra(L);
  return {
    params: { tau_us: tau, prf_Hz: prf },
    value,
    unit: '%',
    decimals: d,
    question: `Pulse width ${fmt(tau)} µs at a PRF of ${fmt(prf)} Hz. What is the duty cycle?`,
    hint: 'Duty cycle = τ·PRF (times 100 for percent).',
    explain: (a) => `duty = τ·PRF = ${fmt(tau)}×10^−6 s × ${fmt(prf)} Hz = ${fmt(tau * 1e-6 * prf, 9)} = ${a}`,
    visual: { kind: 'pulse', labels: { tau: `τ = ${fmt(tau)} µs`, pri: `PRF = ${fmt(prf)} Hz` } },
    near: [value / 100, value * 100, value * 10],
  };
});

topic('r_avgpw', 'radar', 1, 'Average power', (L, rng) => {
  let pt: number;
  let tau: number;
  let prf: number;
  if (L <= 2) {
    pt = pick(rng, [10, 50, 100, 200, 250, 500, 1000]);
    tau = pick(rng, [1, 2, 5, 10]);
    prf = pick(rng, [500, 1000, 2000]);
  } else if (L <= 10) {
    pt = ri(rng, 5, 2000);
    tau = ri(rng, 1, 400) / 10;
    prf = ri(rng, 1, 100) * 100;
  } else {
    pt = ri(rng, 1000, 999999) / 100;
    tau = ri(rng, 100, 99999) / 1000;
    prf = ri(rng, 200, 30000);
  }
  while (tau * 1e-6 * prf > 0.2) prf = Math.max(100, Math.floor(prf / 2 / 100) * 100);
  const value = pt * 1e3 * tau * 1e-6 * prf;
  const d = L <= 2 ? exactDec(value, 2) : 1 + extra(L);
  return {
    params: { pt_kW: pt, tau_us: tau, prf_Hz: prf },
    value,
    unit: 'W',
    decimals: d,
    question: `Peak power ${fmt(pt)} kW, pulse width ${fmt(tau)} µs, PRF ${fmt(prf)} Hz. What is the average transmitted power?`,
    hint: 'P_avg = P_peak × duty cycle, with duty = τ·PRF.',
    explain: (a) => `P_avg = Pt·τ·PRF = ${fmt(pt)}×10^3 W × ${fmt(tau)}×10^−6 s × ${fmt(prf)} Hz = ${a}`,
    visual: { kind: 'pulse', labels: { tau: `τ = ${fmt(tau)} µs`, pri: `PRF = ${fmt(prf)} Hz` } },
    near: [value * 1000, value / 1000, pt * 1000],
  };
});

// ---------- T2
topic('r_ru', 'radar', 2, 'Maximum unambiguous range', (L, rng) => {
  if (rng() < 0.6) {
    const prf =
      L <= 4 ? pick(rng, [250, 300, 500, 600, 750, 1000, 1200, 1500, 2000, 2500, 3000, 5000, 6000, 7500, 10000]) : L <= 10 ? ri(rng, 200, 20000) : ri(rng, 200, 50000);
    const d = L <= 4 ? 0 : L <= 10 ? 1 : 2 + extra(L);
    const value = C / (2 * prf) / 1000;
    return {
      params: { dir: 'ru', prf_Hz: prf },
      value,
      unit: 'km',
      decimals: d,
      question: `A radar runs at a PRF of ${fmt(prf)} Hz. What is its maximum unambiguous range?`,
      given: [C_GIVEN],
      hint: 'The echo must be back before the next pulse: Ru = c/(2·PRF).',
      explain: (a) => `Ru = c/(2·PRF) = 3×10^8 / (2 × ${fmt(prf)}) = ${fmt(value * 1000, 3)} m = ${a}`,
      visual: { kind: 'pulse', labels: { pri: 'PRI = 2·Ru/c', tau: 'τ' } },
      near: [value * 2, value / 2, value * 1000],
    };
  }
  const ru = L <= 4 ? pick(rng, [15, 30, 50, 60, 75, 100, 150, 200, 300]) : L <= 10 ? ri(rng, 10, 500) : ri(rng, 1000, 99999) / 10;
  const d = L <= 10 ? 0 : 1 + extra(L);
  const value = C / (2 * ru * 1000);
  return {
    params: { dir: 'prf', ru_km: ru },
    value,
    unit: 'Hz',
    decimals: d,
    question: `Targets out to ${fmt(ru)} km must be unambiguous in range. What is the highest PRF you can use?`,
    given: [C_GIVEN],
    hint: 'Invert Ru = c/(2·PRF): PRF = c/(2·Ru).',
    explain: (a) => `PRF = c/(2·Ru) = 3×10^8 / (2 × ${fmt(ru * 1000)} m) = ${a}`,
    visual: { kind: 'pulse', labels: { pri: `Ru = ${fmt(ru)} km`, tau: 'τ' } },
    near: [value * 2, value / 2, value * 1000],
  };
});

topic('r_rres', 'radar', 2, 'Range resolution', (L, rng) => {
  if (rng() < 0.6) {
    const B = L <= 4 ? pick(rng, [1, 1.5, 2, 3, 5, 10, 15, 25, 30, 50, 75, 100, 150, 300, 500]) : L <= 10 ? ri(rng, 1, 1000) : ri(rng, 1000, 400000) / 100;
    const value = C / (2 * B * 1e6);
    const d = L <= 4 ? exactDec(value, 2) : L <= 10 ? 2 : Math.min(6, 3 + extra(L));
    return {
      params: { mode: 'bw', B_MHz: B },
      value,
      unit: 'm',
      decimals: d,
      question: `The waveform bandwidth is ${fmt(B)} MHz. What is the range resolution?`,
      given: [C_GIVEN],
      hint: 'ΔR = c/(2B).',
      explain: (a) => `ΔR = c/(2B) = 3×10^8 / (2 × ${fmt(B)}×10^6) = ${a}`,
      visual: { kind: 'pulse', labels: { tau: `B = ${fmt(B)} MHz`, pri: 'ΔR = ?' } },
      near: [value * 2, value / 2, value * 1000],
    };
  }
  const tau = L <= 4 ? pick(rng, [0.1, 0.2, 0.5, 1, 2, 5, 10]) : L <= 10 ? ri(rng, 1, 999) / 100 : ri(rng, 1, 99999) / 1000;
  const d = L <= 4 ? 0 : L <= 10 ? 1 : 1 + extra(L);
  const value = (C * tau * 1e-6) / 2;
  return {
    params: { mode: 'tau', tau_us: tau },
    value,
    unit: 'm',
    decimals: d,
    question: `An uncompressed rectangular pulse is ${fmt(tau)} µs long. What is its range resolution?`,
    given: [C_GIVEN],
    hint: 'ΔR = c·τ/2.',
    explain: (a) => `ΔR = c·τ/2 = 3×10^8 × ${fmt(tau)}×10^−6 / 2 = ${a}`,
    visual: { kind: 'pulse', labels: { tau: `τ = ${fmt(tau)} µs`, pri: 'ΔR = ?' } },
    near: [value * 2, value / 2, value * 1000],
  };
});

topic('r_db', 'radar', 2, 'Decibels', (L, rng) => {
  const v = pick(rng, ['db2lin', 'lin2db', 'dbm2w', 'w2dbm'] as const);
  const easy = L <= 4;
  if (v === 'db2lin') {
    const X = easy ? pick(rng, [3, 6, 9, 10, 13, 16, 20, 23, 26, 30, 33, 40, 50, 60]) : L <= 10 ? ri(rng, -200, 600) / 10 : ri(rng, -3000, 9000) / 100;
    const value = 10 ** (X / 10);
    return {
      params: { v, dB: X },
      value,
      unit: 'linear',
      decimals: Math.min(6, sigDec(value, easy ? 3 : 4) + extra(L)),
      question: `Convert ${fmt(X)} dB to a linear power ratio.`,
      hint: 'ratio = 10^(dB/10).',
      explain: (a) => `ratio = 10^(${fmt(X)}/10) = ${a}`,
      near: [10 ** (X / 20), X / 10, value * 2],
    };
  }
  if (v === 'lin2db') {
    const r = easy ? pick(rng, [2, 4, 5, 8, 10, 20, 50, 100, 200, 500, 1000, 2000, 10000, 100000, 1000000]) : L <= 10 ? ri(rng, 2, 99999) : ri(rng, 2, 99999999) / 100;
    const value = 10 * log10(r);
    return {
      params: { v, ratio: r },
      value,
      unit: 'dB',
      decimals: (easy ? 1 : 2) + extra(L),
      question: `A power ratio of ${fmt(r)} is how many dB?`,
      hint: 'dB = 10·log10(ratio).',
      explain: (a) => `10·log10(${fmt(r)}) = ${a}`,
      near: [20 * log10(r), value + 3, value - 3],
    };
  }
  if (v === 'dbm2w') {
    const X = easy ? pick(rng, [0, 10, 20, 30, 33, 40, 43, 50, 53, 60, 63, 70, 80, 90]) : L <= 10 ? ri(rng, -300, 900) / 10 : ri(rng, -3000, 9000) / 100;
    const value = 10 ** ((X - 30) / 10);
    return {
      params: { v, dBm: X },
      value,
      unit: 'W',
      decimals: Math.min(6, sigDec(value, 3) + extra(L)),
      question: `Convert ${fmt(X)} dBm to watts.`,
      hint: 'P(W) = 10^((P_dBm−30)/10).',
      explain: (a) => `P = 10^((${fmt(X)} − 30)/10) W = ${a}`,
      near: [value * 1000, value / 1000, 10 ** (X / 10)],
    };
  }
  const P = easy ? pick(rng, [0.001, 0.01, 0.1, 0.5, 1, 2, 10, 20, 100, 1000, 1000000]) : L <= 10 ? ri(rng, 1, 99999) / 10 : ri(rng, 1, 9999999) / 1000;
  const value = 10 * log10(P * 1000);
  return {
    params: { v, W: P },
    value,
    unit: 'dBm',
    decimals: (easy ? 1 : 2) + extra(L),
    question: `Express ${fmt(P)} W in dBm.`,
    hint: 'P_dBm = 10·log10(P/1mW).',
    explain: (a) => `10·log10(${fmt(P)} W / 0.001 W) = ${a}`,
    near: [10 * log10(P), value + 30, value - 3],
  };
});

topic('r_pcr', 'radar', 2, 'Pulse compression', (L, rng) => {
  const easy = L <= 4;
  const B = easy ? pick(rng, [1, 2, 5, 10, 20, 50, 100]) : ri(rng, 1, 500);
  const tau = easy ? pick(rng, [1, 2, 5, 10, 20, 50, 100]) : ri(rng, 1, 2000) / 10;
  const BT = B * tau;
  if (rng() < 0.55) {
    return {
      params: { v: 'ratio', B_MHz: B, tau_us: tau },
      value: BT,
      unit: 'linear',
      decimals: exactDec(BT, 1),
      exact: Number.isInteger(BT) && easy,
      question: `A linear-FM pulse is ${fmt(tau)} µs long and sweeps ${fmt(B)} MHz. What is its pulse compression ratio (time-bandwidth product)?`,
      hint: 'Compression ratio = B·τ.',
      explain: (a) => `B·τ = ${fmt(B)}×10^6 Hz × ${fmt(tau)}×10^−6 s = ${a}`,
      visual: { kind: 'chirp', labels: { B: `B = ${fmt(B)} MHz`, T: `τ = ${fmt(tau)} µs` } },
      near: [BT * 1000, BT / 2, BT * 2],
    };
  }
  const value = 10 * log10(BT);
  return {
    params: { v: 'dB', B_MHz: B, tau_us: tau },
    value,
    unit: 'dB',
    decimals: 1 + extra(L),
    question: `A linear-FM pulse is ${fmt(tau)} µs long and sweeps ${fmt(B)} MHz. What is the pulse compression gain in dB?`,
    hint: 'Compression gain = 10·log10(B·τ).',
    explain: (a) => `B·τ = ${fmt(BT)}; 10·log10(${fmt(BT)}) = ${a}`,
    visual: { kind: 'chirp', labels: { B: `B = ${fmt(B)} MHz`, T: `τ = ${fmt(tau)} µs` } },
    near: [20 * log10(BT), value + 3, BT],
  };
});

// ---------- T3
const nice6 = [3, 5, 6, 10, 15, 30];
const midF = [1.3, 2.9, 3.1, 5.6, 9.4, 9.6, 10, 16, 35, 77];
const freqFor = (L: number, rng: Rng, easyUpTo: number, easy = nice6) =>
  L <= easyUpTo ? pick(rng, easy) : L <= 10 ? pick(rng, midF) : ri(rng, 1000, 99999) / 1000;

topic('r_doppler', 'radar', 3, 'Doppler shift', (L, rng) => {
  const f = freqFor(L, rng, 6);
  const lam = C / (f * 1e9);
  if (rng() < 0.6) {
    const v = L <= 6 ? 15 * ri(rng, 1, 40) : L <= 10 ? ri(rng, 5, 900) : ri(rng, 100, 99999) / 100;
    const value = (2 * v) / lam / 1000;
    return {
      params: { dir: 'fd', f_GHz: f, v_mps: v },
      value,
      unit: 'kHz',
      decimals: L <= 6 ? exactDec(value, 2) : 2 + extra(L),
      question: `A target closes at ${fmt(v)} m/s on a ${fmt(f)} GHz radar. What is the Doppler shift?`,
      given: [C_GIVEN],
      hint: 'fd = 2v/λ, with λ = c/f.',
      explain: (a) => `λ = c/f = ${fmt(lam, 7)} m; fd = 2v/λ = 2 × ${fmt(v)} / ${fmt(lam, 7)} = ${fmt(value * 1000, 3)} Hz = ${a}`,
      visual: { kind: 'rd', labels: { note: 'fd = ?' } },
      near: [value / 2, value * 1000, value * 2],
    };
  }
  const vTrue = L <= 6 ? 15 * ri(rng, 1, 40) : L <= 10 ? ri(rng, 5, 900) : ri(rng, 100, 99999) / 100;
  const fd = roundTo((2 * vTrue) / lam / 1000, L <= 6 ? 2 : 3);
  const value = (fd * 1000 * lam) / 2;
  return {
    params: { dir: 'v', f_GHz: f, fd_kHz: fd },
    value,
    unit: 'm/s',
    decimals: L <= 6 ? exactDec(value, 1) : 2 + extra(L),
    question: `A ${fmt(f)} GHz radar measures a Doppler shift of ${fmt(fd)} kHz. What is the target's radial velocity?`,
    given: [C_GIVEN],
    hint: 'Invert fd = 2v/λ: v = fd·λ/2.',
    explain: (a) => `λ = c/f = ${fmt(lam, 7)} m; v = fd·λ/2 = ${fmt(fd * 1000)} × ${fmt(lam, 7)} / 2 = ${a}`,
    visual: { kind: 'rd', labels: { note: `fd = ${fmt(fd)} kHz` } },
    near: [value * 2, value / 1000, fd * lam],
  };
});

topic('r_vmax', 'radar', 3, 'Unambiguous velocity and blind speed', (L, rng) => {
  const f = L <= 6 ? pick(rng, [3, 5, 10, 15, 30]) : L <= 10 ? pick(rng, [1.3, 3.1, 5.6, 9.4, 9.6, 16, 35]) : ri(rng, 1000, 40000) / 1000;
  const prf = L <= 6 ? pick(rng, [1000, 2000, 4000, 5000, 8000, 10000, 20000]) : L <= 10 ? ri(rng, 500, 30000) : ri(rng, 500, 200000);
  const lam = C / (f * 1e9);
  const blind = rng() < 0.45;
  const value = (lam * prf) / (blind ? 2 : 4);
  return {
    params: { v: blind ? 'blind' : 'vmax', f_GHz: f, prf_Hz: prf },
    value,
    unit: 'm/s',
    decimals: L <= 6 ? exactDec(value, 2) : 2 + extra(L),
    question: blind
      ? `A ${fmt(f)} GHz pulse-Doppler radar runs at PRF ${fmt(prf)} Hz. What is its first blind speed?`
      : `A ${fmt(f)} GHz pulse-Doppler radar runs at PRF ${fmt(prf)} Hz. What is the maximum unambiguous radial speed (the ± limit)?`,
    given: [C_GIVEN],
    hint: blind ? 'Blind where fd is a multiple of the PRF: v_b = λ·PRF/2.' : 'Doppler is unambiguous for |fd| < PRF/2, so v_max = λ·PRF/4.',
    explain: (a) => `λ = ${fmt(lam, 7)} m; v = λ·PRF/${blind ? 2 : 4} = ${fmt(lam, 7)} × ${fmt(prf)} / ${blind ? 2 : 4} = ${a}`,
    visual: { kind: 'rd', labels: { note: blind ? 'v_blind = ?' : '±v_max = ?' } },
    near: [blind ? value / 2 : value * 2, value * 4, value / 4],
  };
});

topic('r_dopbin', 'radar', 3, 'Doppler bin width', (L, rng) => {
  const prf = L <= 6 ? pick(rng, [1000, 2000, 4000, 5000, 8000, 10000, 16000, 20000]) : ri(rng, 1000, 50000);
  const N = L <= 6 ? pick(rng, [16, 32, 64, 128, 256, 512, 1024]) : pow2(ri(rng, 4, Math.min(16, 8 + Math.floor(cap(L) / 4))));
  if (rng() < 0.6) {
    const value = prf / N;
    return {
      params: { v: 'hz', prf_Hz: prf, N },
      value,
      unit: 'Hz',
      decimals: 2 + extra(L),
      question: `${an(N)} ${N}-point Doppler FFT is taken across pulses at PRF ${fmt(prf)} Hz. What is the Doppler bin width?`,
      hint: 'The FFT spans one PRF: Δf = PRF/N.',
      explain: (a) => `Δf = PRF/N = ${fmt(prf)} / ${N} = ${a}`,
      visual: { kind: 'spectrum', labels: { N: `N = ${N}`, span: `0 … PRF = ${fmt(prf)} Hz` } },
      near: [value * 2, value / 2, prf / (N / 2)],
    };
  }
  const f = freqFor(L, rng, 6);
  const lam = C / (f * 1e9);
  const value = (lam * prf) / (2 * N);
  return {
    params: { v: 'vel', prf_Hz: prf, N, f_GHz: f },
    value,
    unit: 'm/s',
    decimals: 3 + extra(L),
    question: `${an(N)} ${N}-point Doppler FFT at PRF ${fmt(prf)} Hz on a ${fmt(f)} GHz radar. What radial velocity does one Doppler bin span?`,
    given: [C_GIVEN],
    hint: 'Δv = λ·Δf/2 with Δf = PRF/N.',
    explain: (a) => `Δf = ${fmt(prf)}/${N} = ${fmt(prf / N, 4)} Hz; Δv = λ·Δf/2 = ${fmt(lam, 7)} × ${fmt(prf / N, 4)} / 2 = ${a}`,
    visual: { kind: 'spectrum', labels: { N: `N = ${N}`, span: `0 … PRF = ${fmt(prf)} Hz` } },
    near: [value * 2, value / 2, prf / N],
  };
});

topic('r_cigain', 'radar', 3, 'Coherent integration gain', (L, rng) => {
  if (L <= 6 || rng() < 0.6) {
    const N = L <= 6 ? pick(rng, [2, 4, 8, 10, 16, 20, 32, 50, 64, 100, 128, 256, 1000, 1024]) : L <= 10 ? ri(rng, 3, 5000) : ri(rng, 3, 100000);
    const value = 10 * log10(N);
    return {
      params: { v: 'gain', N },
      value,
      unit: 'dB',
      decimals: (L <= 6 ? 1 : 2) + extra(L),
      question: `${N} pulses are integrated coherently (noise uncorrelated pulse to pulse). What is the ideal SNR gain?`,
      hint: 'Coherent gain = 10·log10(N).',
      explain: (a) => `G = 10·log10(${N}) = ${a}`,
      near: [20 * log10(N), 5 * log10(N), value + 3],
    };
  }
  const G = ri(rng, 30, L <= 10 ? 400 : 500) / 10;
  const value = Math.ceil(10 ** (G / 10) - 1e-9);
  return {
    params: { v: 'pulses', G_dB: G },
    value,
    unit: 'pulses',
    decimals: 0,
    exact: true,
    question: `What is the smallest number of coherently integrated pulses that gives at least ${fmt(G)} dB of integration gain?`,
    hint: 'Solve 10·log10(N) ≥ G for the smallest whole N.',
    explain: (a) => `N ≥ 10^(${fmt(G)}/10) = ${fmt(10 ** (G / 10), 3)}, so N = ${a}`,
    near: [value - 1, value + 1, Math.round(10 ** (G / 20))],
  };
});

topic('r_ktb', 'radar', 3, 'Receiver noise power', (L, rng) => {
  const B = L <= 6 ? pick(rng, [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 2e6, 5e6, 2e7]) : ri(rng, 1, 999) * 10 ** ri(rng, 3, 6);
  const NF = L <= 6 ? pick(rng, [0, 1, 2, 3, 4, 5, 6]) : ri(rng, 5, 120) / 10;
  const value = -174 + 10 * log10(B) + NF;
  return {
    params: { B_Hz: B, NF_dB: NF },
    value,
    unit: 'dBm',
    decimals: (L <= 6 ? 1 : 2) + extra(L),
    question: `Receiver bandwidth ${fmtHz(B)}, noise figure ${fmt(NF)} dB. What is the noise power referred to the input?`,
    given: ['kT0 = −174 dBm/Hz'],
    hint: 'N = kT0 + 10·log10(B in Hz) + NF, all in dB.',
    explain: (a) => `N = −174 + 10·log10(${fmt(B)}) + ${fmt(NF)} = −174 + ${fmt(10 * log10(B), 3)} + ${fmt(NF)} = ${a}`,
    near: [value - NF, value + 30, -174 + 20 * log10(B) + NF],
  };
});

// ---------- T4
topic('r_scale', 'radar', 4, 'Radar range equation scaling', (L, rng) => {
  const v = pick(rng, ['pt', 'range', 'rcs', 'gain'] as const);
  const easy = L <= 8;
  const d3 = 3 + extra(L);
  if (v === 'pt') {
    const k = easy ? pick(rng, [16, 81, 256, 625, 2, 10, 3, 4]) : ri(rng, 11, 9999) / 10;
    const value = k ** 0.25;
    return {
      params: { v, k },
      value,
      unit: 'linear',
      decimals: d3,
      question: `Transmit power is multiplied by ${fmt(k)}. By what factor does the maximum detection range grow?`,
      hint: 'Monostatic radar equation: R_max ∝ Pt^(1/4).',
      explain: (a) => `factor = ${fmt(k)}^(1/4) = ${a}`,
      near: [Math.sqrt(k), k, k ** (1 / 3)],
    };
  }
  if (v === 'range') {
    const k = easy ? pick(rng, [2, 3, 4, 10, 0.5, 1.5, 5]) : ri(rng, 11, 999) / 100;
    const value = -40 * log10(k);
    return {
      params: { v, k },
      value,
      unit: 'dB',
      decimals: 1 + extra(L),
      question: `The target range is multiplied by ${fmt(k)}. By how many dB does the received SNR change (negative = it drops)?`,
      hint: 'SNR ∝ 1/R^4, so ΔSNR = −40·log10(range factor).',
      explain: (a) => `ΔSNR = −40·log10(${fmt(k)}) = ${a}`,
      near: [-20 * log10(k), 40 * log10(k), -10 * log10(k)],
    };
  }
  if (v === 'rcs') {
    const X = easy ? pick(rng, [3, 6, 10, 20]) : ri(rng, 10, 300) / 10;
    const value = 10 ** (-X / 40);
    return {
      params: { v, dB: X },
      value,
      unit: 'linear',
      decimals: d3,
      question: `The target RCS drops by ${fmt(X)} dB. By what factor does the maximum detection range change?`,
      hint: 'R_max ∝ σ^(1/4): factor = 10^(−ΔdB/40).',
      explain: (a) => `factor = 10^(−${fmt(X)}/40) = ${a}`,
      near: [10 ** (-X / 20), 10 ** (-X / 10), 1 - X / 40],
    };
  }
  const X = easy ? pick(rng, [1, 2, 3, 6, 10]) : ri(rng, 5, 100) / 10;
  const value = 10 ** (X / 20);
  return {
    params: { v, dB: X },
    value,
    unit: 'linear',
    decimals: d3,
    question: `Antenna gain rises by ${fmt(X)} dB (the same antenna transmits and receives). By what factor does the detection range grow?`,
    hint: 'R_max ∝ (G·G)^(1/4) = G^(1/2): factor = 10^(ΔdB/20).',
    explain: (a) => `factor = (10^(2×${fmt(X)}/10))^(1/4) = 10^(${fmt(X)}/20) = ${a}`,
    near: [10 ** (X / 40), 10 ** (X / 10), 2 * X],
  };
});

topic('r_beam', 'radar', 4, 'Antenna beamwidth', (L, rng) => {
  const f = L <= 8 ? pick(rng, [3, 5, 10, 15, 30, 35]) : ri(rng, 1000, 40000) / 1000;
  const lam = C / (f * 1e9);
  if (rng() < 0.65) {
    const D = L <= 8 ? pick(rng, [0.3, 0.5, 0.6, 1, 1.2, 1.5, 2, 3, 5]) : ri(rng, 10, 1000) / 100;
    const value = (70 * lam) / D;
    return {
      params: { v: 'theta', f_GHz: f, D_m: D },
      value,
      unit: 'deg',
      decimals: 2 + extra(L),
      question: `Estimate the 3-dB beamwidth of a ${fmt(D)} m aperture at ${fmt(f)} GHz.`,
      given: [C_GIVEN, 'θ3dB ≈ 70·λ/D degrees'],
      hint: 'Convert f to wavelength first, then apply the 70·λ/D rule (λ and D in the same units).',
      explain: (a) => `λ = ${fmt(lam, 7)} m; θ ≈ 70 × ${fmt(lam, 7)} / ${fmt(D)} = ${a}`,
      visual: { kind: 'beam', labels: { theta: 'θ3dB = ?', D: `D = ${fmt(D)} m` } },
      near: [value * (180 / Math.PI) / 70, value * 2, (lam / D) * 57.3 * 2],
    };
  }
  const th = L <= 8 ? pick(rng, [1, 1.5, 2, 2.5, 3, 5]) : ri(rng, 5, 100) / 10;
  const value = (70 * lam) / th;
  return {
    params: { v: 'D', f_GHz: f, theta_deg: th },
    value,
    unit: 'm',
    decimals: 2 + extra(L),
    question: `What aperture width gives a ${fmt(th)}° 3-dB beamwidth at ${fmt(f)} GHz?`,
    given: [C_GIVEN, 'θ3dB ≈ 70·λ/D degrees'],
    hint: 'Rearrange the beamwidth rule: D = 70·λ/θ.',
    explain: (a) => `λ = ${fmt(lam, 7)} m; D = 70 × ${fmt(lam, 7)} / ${fmt(th)} = ${a}`,
    visual: { kind: 'beam', labels: { theta: `θ3dB = ${fmt(th)}°`, D: 'D = ?' } },
    near: [value * 2, value / 2, lam / th],
  };
});

topic('r_gain', 'radar', 4, 'Aperture gain', (L, rng) => {
  const f = L <= 8 ? pick(rng, [3, 5, 10, 15, 35]) : ri(rng, 1000, 40000) / 1000;
  const lam = C / (f * 1e9);
  const dish = L >= 8 && rng() < 0.5;
  let Ae: number;
  let D = 0;
  let eta = 0;
  if (dish) {
    D = L <= 10 ? pick(rng, [0.5, 1, 1.5, 2, 3, 5]) : ri(rng, 30, 1000) / 100;
    eta = pick(rng, [0.55, 0.6, 0.65, 0.7]);
    Ae = (eta * Math.PI * D * D) / 4;
  } else {
    Ae = L <= 8 ? pick(rng, [0.1, 0.25, 0.5, 1, 2, 4, 10]) : ri(rng, 5, 1000) / 100;
  }
  const G = (4 * Math.PI * Ae) / (lam * lam);
  const value = 10 * log10(G);
  return {
    params: dish ? { v: 'dish', f_GHz: f, D_m: D, eta } : { v: 'ae', f_GHz: f, Ae_m2: Ae },
    value,
    unit: 'dBi',
    decimals: 1 + extra(L),
    question: dish
      ? `A ${fmt(D)} m parabolic dish with ${fmt(eta * 100)}% aperture efficiency at ${fmt(f)} GHz. What is its gain?`
      : `An antenna has an effective aperture of ${fmt(Ae)} m² at ${fmt(f)} GHz. What is its gain?`,
    given: [C_GIVEN],
    hint: dish ? 'Ae = η·π·D²/4, then G = 4π·Ae/λ², converted with 10·log10.' : 'G = 4π·Ae/λ², then convert to dB with 10·log10.',
    explain: (a) =>
      `λ = ${fmt(lam, 7)} m;${dish ? ` Ae = ${fmt(eta)}·π·${fmt(D)}²/4 = ${fmt(Ae, 4)} m²;` : ''} G = 4π·${fmt(Ae, 4)}/${fmt(lam, 7)}² = ${fmt(G, 1)} → 10·log10 = ${a}`,
    visual: { kind: 'beam', labels: { theta: 'G = ?', D: dish ? `D = ${fmt(D)} m` : `Ae = ${fmt(Ae)} m²` } },
    near: [20 * log10(G), value - 10 * log10(4 * Math.PI), value + 3],
  };
});

topic('r_xrange', 'radar', 4, 'Cross-range resolution', (L, rng) => {
  const R = L <= 8 ? ri(rng, 1, 100) : ri(rng, 100, 99999) / 100;
  if (rng() < 0.55) {
    const th = L <= 8 ? pick(rng, [1, 2, 5, 10, 20, 30, 50]) : ri(rng, 5, 999) / 10;
    const value = R * 1000 * (th / 1000);
    return {
      params: { v: 'mrad', R_km: R, theta_mrad: th },
      value,
      unit: 'm',
      decimals: L <= 8 ? 0 : extra(L),
      question: `What is the cross-range resolution at ${fmt(R)} km for a ${fmt(th)} mrad beam?`,
      hint: 'Cross-range cell ≈ R·θ with θ in radians.',
      explain: (a) => `R·θ = ${fmt(R * 1000)} m × ${fmt(th / 1000)} rad = ${a}`,
      visual: { kind: 'beam', labels: { theta: `θ = ${fmt(th)} mrad`, D: `R = ${fmt(R)} km` } },
      near: [value * 1000, value / 2, value * 2],
    };
  }
  const th = L <= 8 ? pick(rng, [0.5, 1, 1.5, 2, 3]) : ri(rng, 5, 50) / 10;
  const value = R * 1000 * ((th * Math.PI) / 180);
  return {
    params: { v: 'deg', R_km: R, theta_deg: th },
    value,
    unit: 'm',
    decimals: extra(L),
    question: `What is the cross-range resolution at ${fmt(R)} km for a ${fmt(th)}° beam?`,
    hint: 'Convert the beamwidth to radians (× π/180), then cross-range ≈ R·θ.',
    explain: (a) => `θ = ${fmt(th)} × π/180 = ${fmt((th * Math.PI) / 180, 6)} rad; R·θ = ${fmt(R * 1000)} × ${fmt((th * Math.PI) / 180, 6)} = ${a}`,
    visual: { kind: 'beam', labels: { theta: `θ = ${fmt(th)}°`, D: `R = ${fmt(R)} km` } },
    near: [R * 1000 * th, value * 2, value / 2],
  };
});

const PRF_RU: [number, number][] = [
  [1000, 150],
  [1500, 100],
  [2000, 75],
  [2500, 60],
  [3000, 50],
  [5000, 30],
  [6000, 25],
  [7500, 20],
  [10000, 15],
];

topic('r_fold', 'radar', 4, 'Range ambiguity folding', (L, rng) => {
  const [prf, ru] = pick(rng, PRF_RU);
  const k = ri(rng, 1, L <= 8 ? 3 : 6);
  const R = L <= 8 ? k * ru + ri(rng, 1, ru - 1) : (k * ru * 10 + ri(rng, 5, ru * 10 - 5)) / 10;
  const ambig = Math.floor(R / ru + 1e-9);
  const app = roundTo(R - ambig * ru, 1);
  if (rng() < 0.6) {
    return {
      params: { v: 'apparent', prf_Hz: prf, R_km: R },
      value: app,
      unit: 'km',
      decimals: L <= 8 ? 0 : 1,
      question: `A low-PRF radar runs at ${fmt(prf)} Hz. A target sits at ${fmt(R)} km. At what apparent range does it show up?`,
      given: [C_GIVEN],
      hint: 'Echoes from beyond Ru fold back: apparent range = R mod Ru, with Ru = c/(2·PRF).',
      explain: (a) => `Ru = c/(2·PRF) = ${ru} km; ${fmt(R)} − ${ambig}×${ru} = ${a}`,
      visual: { kind: 'pulse', labels: { pri: `Ru = c/(2·PRF)`, tau: 'τ', echo: 'echo' } },
      near: [R, R - ru, app + ru],
    };
  }
  return {
    params: { v: 'interval', prf_Hz: prf, R_km: R },
    value: ambig,
    unit: 'index',
    decimals: 0,
    exact: true,
    question: `A radar runs at PRF ${fmt(prf)} Hz. A target at ${fmt(R)} km folds into the first range interval. Which ambiguity number k is it in (R = k·Ru + apparent range; k = 0 is unambiguous)?`,
    given: [C_GIVEN],
    hint: 'k = ⌊R/Ru⌋, with Ru = c/(2·PRF).',
    explain: (a) => `Ru = c/(2·PRF) = ${ru} km; k = ⌊${fmt(R)} / ${ru}⌋ = ${a}`,
    visual: { kind: 'pulse', labels: { pri: `Ru = c/(2·PRF)`, tau: 'τ', echo: 'echo' } },
    near: [ambig + 1, ambig - 1, ambig + 2],
  };
});

// ---------- T5
topic('r_fmcw', 'radar', 5, 'FMCW beat frequency', (L, rng) => {
  const B = L <= 10 ? pick(rng, [100, 150, 200, 250, 300, 500, 1000, 4000]) : ri(rng, 50, 4000);
  const T = L <= 10 ? pick(rng, [10, 20, 40, 50, 100, 200, 500, 1000]) : ri(rng, 10, 2000);
  if (rng() < 0.55) {
    const R = L <= 10 ? ri(rng, 1, 300) : ri(rng, 100, 99999) / 100;
    const value = (2 * R * B * 1e6) / (C * T * 1e-6) / 1000;
    return {
      params: { v: 'fb', B_MHz: B, T_us: T, R_m: R },
      value,
      unit: 'kHz',
      decimals: 2 + extra(L),
      question: `FMCW radar, sawtooth chirp: ${fmt(B)} MHz swept in ${fmt(T)} µs. A target is at ${fmt(R)} m. What is the beat frequency?`,
      given: [C_GIVEN],
      hint: 'Beat = chirp slope × round-trip delay: fb = (B/T)·(2R/c).',
      explain: (a) => `slope = B/T = ${fmt(B)} MHz / ${fmt(T)} µs = ${fmt(B / T, 6)} MHz/µs; delay = 2R/c = ${fmt(((2 * R) / C) * 1e6, 6)} µs; fb = slope × delay = ${a}`,
      visual: { kind: 'chirp', labels: { B: `B = ${fmt(B)} MHz`, T: `T = ${fmt(T)} µs`, fb: 'fb = ?' } },
      near: [value / 2, value * 1000, value * 2],
    };
  }
  const fb = L <= 10 ? ri(rng, 10, 5000) : ri(rng, 100, 99999) / 10;
  const value = (fb * 1000 * C * T * 1e-6) / (2 * B * 1e6);
  return {
    params: { v: 'range', B_MHz: B, T_us: T, fb_kHz: fb },
    value,
    unit: 'm',
    decimals: 2 + extra(L),
    question: `FMCW radar, sawtooth chirp: ${fmt(B)} MHz swept in ${fmt(T)} µs. The beat frequency is ${fmt(fb)} kHz. What is the target range?`,
    given: [C_GIVEN],
    hint: 'Invert fb = 2·R·B/(c·T): R = c·T·fb/(2B).',
    explain: (a) => `R = c·T·fb/(2B) = 3×10^8 × ${fmt(T)}×10^−6 × ${fmt(fb * 1000)} / (2 × ${fmt(B)}×10^6) = ${a}`,
    visual: { kind: 'chirp', labels: { B: `B = ${fmt(B)} MHz`, T: `T = ${fmt(T)} µs`, fb: `fb = ${fmt(fb)} kHz` } },
    near: [value * 2, value / 2, value * 1000],
  };
});

topic('r_rbin', 'radar', 5, 'Range bins and cells', (L, rng) => {
  const v = pick(rng, ['size', 'cells', 'gates'] as const);
  if (v === 'size') {
    const fs = L <= 10 ? pick(rng, [10, 15, 20, 25, 30, 50, 60, 75, 100, 150, 300]) : ri(rng, 5, 2000);
    const value = C / (2 * fs * 1e6);
    return {
      params: { v, fs_MSps: fs },
      value,
      unit: 'm',
      decimals: L <= 10 ? exactDec(value, 2) : 3 + extra(L),
      question: `Complex baseband is sampled at ${fmt(fs)} MS/s (one range sample per ADC sample). How much range does one sample span?`,
      given: [C_GIVEN],
      hint: 'Range sample spacing = c/(2·fs).',
      explain: (a) => `ΔR = c/(2·fs) = 3×10^8 / (2 × ${fmt(fs)}×10^6) = ${a}`,
      near: [value * 2, value / 2, C / (fs * 1e6)],
    };
  }
  if (v === 'cells') {
    const fs = pick(rng, [15, 30, 45, 60, 75, 90, 150, 300]);
    const W = L <= 10 ? ri(rng, 1, 100) : ri(rng, 10, 400);
    const value = (W * 1000) / (C / (2 * fs * 1e6));
    return {
      params: { v, fs_MSps: fs, W_km: W },
      value: Math.round(value),
      unit: 'cells',
      decimals: 0,
      exact: true,
      question: `A receive window covers ${W} km of range and is sampled at ${fs} MS/s. How many range cells does it hold?`,
      given: [C_GIVEN],
      hint: 'Cells = window length / (c/(2·fs)).',
      explain: (a) => `ΔR = c/(2·fs) = ${fmt(C / (2 * fs * 1e6), 4)} m; ${W * 1000} m / ${fmt(C / (2 * fs * 1e6), 4)} m = ${a}`,
      near: [Math.round(value / 2), Math.round(value * 2), W * fs],
    };
  }
  const fs = L <= 10 ? pick(rng, [10, 20, 25, 50, 100, 125, 200]) : ri(rng, 10, 1000);
  const prf = pick(rng, [1000, 2000, 2500, 4000, 5000, 8000, 10000, 20000]);
  const value = (fs * 1e6) / prf;
  return {
    params: { v, fs_MSps: fs, prf_Hz: prf },
    value: Math.round(value),
    unit: 'samples',
    decimals: 0,
    exact: true,
    question: `An ADC runs at ${fmt(fs)} MS/s and the PRF is ${fmt(prf)} Hz. How many range samples fit in one PRI?`,
    hint: 'Samples per PRI = fs·PRI = fs/PRF.',
    explain: (a) => `fs/PRF = ${fmt(fs * 1e6)} / ${fmt(prf)} = ${a}`,
    near: [Math.round(value / 2), Math.round(value * 2), Math.round(value / 1000)],
  };
});

topic('r_dwell', 'radar', 5, 'Time on target', (L, rng) => {
  const rpm = L <= 10 ? pick(rng, [5, 6, 10, 12, 15, 20, 30, 60]) : ri(rng, 3, 90);
  const th = L <= 10 ? pick(rng, [0.6, 0.9, 1.2, 1.5, 1.8, 2, 3]) : ri(rng, 3, 50) / 10;
  const prf = L <= 10 ? pick(rng, [500, 1000, 2000, 3000, 4000]) : ri(rng, 300, 10000);
  const tot = th / (rpm * 6);
  if (rng() < 0.5) {
    return {
      params: { v: 'tot', rpm, theta_deg: th, prf_Hz: prf },
      value: tot * 1000,
      unit: 'ms',
      decimals: 2 + extra(L),
      question: `A search radar rotates at ${fmt(rpm)} rpm with a ${fmt(th)}° azimuth beamwidth. What is the time on target per scan?`,
      hint: 'Time on target = beamwidth / scan rate, with scan rate = rpm·360/60 degrees per second.',
      explain: (a) => `scan rate = ${fmt(rpm)}×360/60 = ${fmt(rpm * 6)} °/s; T = ${fmt(th)} / ${fmt(rpm * 6)} = ${a}`,
      visual: { kind: 'beam', labels: { theta: `θ = ${fmt(th)}°`, D: `${fmt(rpm)} rpm` } },
      near: [(th / rpm) * 1000, tot * 60000, tot * 1e6],
    };
  }
  const value = Math.floor(prf * tot + 1e-9);
  return {
    params: { v: 'pulses', rpm, theta_deg: th, prf_Hz: prf },
    value,
    unit: 'pulses',
    decimals: 0,
    exact: true,
    question: `A search radar rotates at ${fmt(rpm)} rpm with a ${fmt(th)}° azimuth beamwidth and PRF ${fmt(prf)} Hz. How many complete pulses hit a point target per scan?`,
    hint: 'Pulses per dwell = PRF × time on target (round down); time on target = beamwidth / (rpm·360/60).',
    explain: (a) => `T = ${fmt(th)} / ${fmt(rpm * 6)} °/s = ${fmt(tot * 1000, 4)} ms; ${fmt(prf)} × ${fmt(tot, 6)} = ${fmt(prf * tot, 3)} → ${a}`,
    visual: { kind: 'beam', labels: { theta: `θ = ${fmt(th)}°`, D: `${fmt(rpm)} rpm` } },
    near: [value + 1, Math.floor(value / 2), Math.round((prf * th) / rpm)],
  };
});

const COPRIME: [number, number][] = [
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [7, 8],
  [5, 7],
  [9, 10],
];

topic('r_stagger', 'radar', 5, 'Staggered-PRF blind speed', (L, rng) => {
  const [a, b] = pick(rng, COPRIME);
  const F = L <= 10 ? pick(rng, [100, 200, 250, 500, 1000]) : ri(rng, 50, 999);
  const f = L <= 10 ? pick(rng, [3, 5, 10]) : ri(rng, 1000, 20000) / 1000;
  const lam = C / (f * 1e9);
  const p1 = a * F;
  const p2 = b * F;
  const l = lcm(p1, p2);
  const value = (lam * l) / 2;
  return {
    params: { f_GHz: f, prf1_Hz: p1, prf2_Hz: p2 },
    value,
    unit: 'm/s',
    decimals: L <= 10 ? exactDec(value, 1) : 1 + extra(L),
    question: `A ${fmt(f)} GHz radar staggers two PRFs, ${fmt(p1)} Hz and ${fmt(p2)} Hz. What is the first blind speed common to both?`,
    given: [C_GIVEN],
    hint: 'Each PRF is blind at multiples of λ·PRF/2; the first common one uses LCM(PRF1, PRF2).',
    explain: (a2) => `λ = ${fmt(lam, 7)} m; LCM(${p1}, ${p2}) = ${l} Hz; v = λ·LCM/2 = ${a2} (each alone: ${fmt((lam * p1) / 2, 3)} and ${fmt((lam * p2) / 2, 3)} m/s)`,
    visual: { kind: 'rd', labels: { note: 'v_blind = ?' } },
    near: [(lam * p1) / 2, (lam * p2) / 2, (lam * (p1 + p2)) / 2],
  };
});

const RU_PAIRS: [number, number][] = [
  [20, 25],
  [25, 30],
  [30, 40],
  [40, 50],
  [50, 60],
  [60, 75],
  [75, 100],
  [100, 120],
  [120, 150],
  [20, 30],
  [12, 15],
  [15, 20],
  [24, 40],
  [80, 100],
  [100, 125],
  [125, 150],
];

topic('r_twoprf', 'radar', 5, 'Resolving range with two PRFs', (L, rng) => {
  const [ru1, ru2] = pick(rng, RU_PAIRS);
  const l = lcm(ru1, ru2);
  let R = 0;
  let r1 = 0;
  let r2 = 0;
  for (let g = 0; g < 50; g++) {
    R = ri(rng, Math.max(ru1, ru2) + 1, l - 1);
    r1 = R % ru1;
    r2 = R % ru2;
    if (r1 > 0 && r2 > 0) break;
  }
  const viaPrf = L >= 11;
  const p1 = 150000 / ru1;
  const p2 = 150000 / ru2;
  return {
    params: { ru1_km: ru1, ru2_km: ru2, r1_km: r1, r2_km: r2, limit_km: l, prf1_Hz: p1, prf2_Hz: p2 },
    value: R,
    unit: 'km',
    decimals: 0,
    question: viaPrf
      ? `PRF A = ${fmt(p1)} Hz, PRF B = ${fmt(p2)} Hz. The target appears at ${r1} km with A and ${r2} km with B, and is known to be closer than ${l} km. What is its true range?`
      : `Two PRFs give unambiguous ranges of ${ru1} km and ${ru2} km. A target appears at ${r1} km with the first and ${r2} km with the second, and is known to be closer than ${l} km. What is its true range?`,
    given: viaPrf ? [C_GIVEN] : [],
    hint: 'Find the range that leaves both remainders: R ≡ r1 (mod Ru1) and R ≡ r2 (mod Ru2), a Chinese-remainder search.',
    explain: (a) =>
      `${viaPrf ? `Ru = c/(2·PRF): ${ru1} km and ${ru2} km. ` : ''}Candidates r1 + k·${ru1}: ${[0, 1, 2, 3]
        .map((k) => r1 + k * ru1)
        .filter((x) => x < l)
        .join(', ')}, … ; ${a} leaves ${R % ru1} (mod ${ru1}) and ${R % ru2} (mod ${ru2})`,
    near: [r1 + ru1, r2 + ru2, R + l / 2],
  };
});

topic('r_sar', 'radar', 5, 'SAR resolution and aperture', (L, rng) => {
  const D = L <= 10 ? pick(rng, [1, 2, 3, 4, 5, 6, 10, 12]) : ri(rng, 50, 1500) / 100;
  const f = L <= 10 ? pick(rng, [1.25, 3, 5.3, 9.6, 10]) : ri(rng, 1000, 40000) / 1000;
  const R = L <= 10 ? 5 * ri(rng, 1, 40) : ri(rng, 500, 99999) / 100;
  const lam = C / (f * 1e9);
  const v = pick(rng, ['res', 'len', 'time'] as const);
  if (v === 'res') {
    return {
      params: { v, D_m: D },
      value: D / 2,
      unit: 'm',
      decimals: L <= 10 ? 1 : 2 + extra(L),
      question: `Stripmap SAR with a ${fmt(D)} m antenna (along-track length). What is the best achievable azimuth resolution?`,
      hint: 'Stripmap azimuth resolution ≈ D/2, independent of range and wavelength.',
      explain: (a) => `δaz ≈ D/2 = ${fmt(D)} / 2 = ${a}`,
      visual: { kind: 'beam', labels: { theta: 'δaz = ?', D: `D = ${fmt(D)} m` } },
      near: [D, D / 4, D * 2],
    };
  }
  const Lsa = (lam * R * 1000) / D;
  if (v === 'len') {
    return {
      params: { v, D_m: D, f_GHz: f, R_km: R },
      value: Lsa,
      unit: 'm',
      decimals: L <= 10 ? 1 : 1 + extra(L),
      question: `${fmt(f)} GHz stripmap SAR, antenna length ${fmt(D)} m, slant range ${fmt(R)} km. How long a synthetic aperture is needed for full resolution?`,
      given: [C_GIVEN],
      hint: 'Synthetic aperture = beam footprint on the ground = λ·R/D.',
      explain: (a) => `λ = ${fmt(lam, 7)} m; L = λ·R/D = ${fmt(lam, 7)} × ${fmt(R * 1000)} / ${fmt(D)} = ${a}`,
      visual: { kind: 'beam', labels: { theta: 'L_sa = ?', D: `D = ${fmt(D)} m` } },
      near: [Lsa * 2, Lsa / 2, (lam * R) / D],
    };
  }
  const vp = L <= 10 ? pick(rng, [100, 150, 200, 250, 7500]) : ri(rng, 80, 7600);
  return {
    params: { v, D_m: D, f_GHz: f, R_km: R, vp_mps: vp },
    value: Lsa / vp,
    unit: 's',
    decimals: 3 + extra(L),
    question: `${fmt(f)} GHz stripmap SAR, antenna length ${fmt(D)} m, slant range ${fmt(R)} km, platform speed ${fmt(vp)} m/s. How long is the synthetic-aperture integration time?`,
    given: [C_GIVEN],
    hint: 'T = L_sa / v, with L_sa = λ·R/D.',
    explain: (a) => `L_sa = λ·R/D = ${fmt(Lsa, 3)} m; T = ${fmt(Lsa, 3)} / ${fmt(vp)} = ${a}`,
    visual: { kind: 'beam', labels: { theta: 'T = ?', D: `D = ${fmt(D)} m` } },
    near: [(Lsa / vp) * 2, Lsa, (Lsa / vp) / 2],
  };
});

topic('r_snr', 'radar', 5, 'Radar equation in dB', (L, rng) => {
  const r1 = (x: number) => roundTo(x, 1);
  const Pt = L <= 10 ? pick(rng, [1e3, 1e4, 1e5, 1e6, 2e5, 5e5]) : ri(rng, 100, 99999) * 10;
  const G = L <= 10 ? pick(rng, [30, 32, 35, 38, 40]) : ri(rng, 250, 450) / 10;
  const f = L <= 10 ? pick(rng, [3, 5, 10]) : ri(rng, 1000, 20000) / 1000;
  const lam = C / (f * 1e9);
  const sigma = L <= 10 ? pick(rng, [-10, -5, 0, 5, 10, 20]) : ri(rng, -200, 300) / 10;
  const Rkm = L <= 10 ? pick(rng, [10, 20, 30, 50, 100, 150]) : ri(rng, 50, 3000) / 10;
  const B = L <= 10 ? pick(rng, [0.5, 1, 2, 5, 10]) : ri(rng, 5, 500) / 10;
  const NF = L <= 10 ? pick(rng, [2, 3, 4, 5, 6]) : ri(rng, 15, 80) / 10;
  const Ls = L <= 10 ? pick(rng, [3, 4, 5, 6, 8]) : ri(rng, 20, 120) / 10;
  const PtdB = r1(10 * log10(Pt));
  const lam20 = r1(20 * log10(lam));
  const R40 = r1(40 * log10(Rkm * 1000));
  const kTB = r1(-204 + 10 * log10(B * 1e6));
  const fp = 33.0;
  const value = PtdB + 2 * G + lam20 + sigma - fp - R40 - kTB - NF - Ls;
  const lines = [
    `Pt          ${fmt(PtdB).padStart(7)} dBW`,
    `2G          ${fmt(2 * G).padStart(7)} dB`,
    `20log λ     ${fmt(lam20).padStart(7)} dB`,
    `σ           ${fmt(sigma).padStart(7)} dBsm`,
    `−30log 4π   ${fmt(-fp).padStart(7)} dB`,
    `−40log R    ${fmt(-R40).padStart(7)} dB`,
    `−kT0B       ${fmt(-kTB).padStart(7)} dB`,
    `−NF − L     ${fmt(-(NF + Ls)).padStart(7)} dB`,
    `SNR         ${'?'.padStart(7)} dB`,
  ];
  return {
    params: { Pt_W: Pt, PtdB, G_dBi: G, f_GHz: f, lam20, sigma_dBsm: sigma, R_km: Rkm, R40, B_MHz: B, kTB_dBW: kTB, NF_dB: NF, L_dB: Ls, fourpi30: fp },
    value,
    unit: 'dB',
    decimals: 1,
    question: `Single-pulse SNR, dB form of the radar equation: Pt = ${fmt(Pt)} W, G = ${fmt(G)} dBi (Tx and Rx), f = ${fmt(f)} GHz, σ = ${fmt(sigma)} dBsm, R = ${fmt(Rkm)} km, B = ${fmt(B)} MHz, NF = ${fmt(NF)} dB, losses L = ${fmt(Ls)} dB.`,
    given: [`10·log10(Pt) = ${fmt(PtdB)} dBW`, `20·log10(λ) = ${fmt(lam20)} dB`, `30·log10(4π) = 33.0 dB`, `40·log10(R) = ${fmt(R40)} dB`, `kT0B = ${fmt(kTB)} dBW`],
    hint: 'SNR = Pt + 2G + 20log λ + σ − 30log(4π) − 40log R − kT0B − NF − L, every term in dB.',
    explain: (a) =>
      `SNR = ${fmt(PtdB)} + ${fmt(2 * G)} + (${fmt(lam20)}) + (${fmt(sigma)}) − 33.0 − ${fmt(R40)} − (${fmt(kTB)}) − ${fmt(NF)} − ${fmt(Ls)} = ${a}`,
    visual: { kind: 'table', lines },
    near: [value + 2 * kTB, value - G, value + 10],
  };
});

// ---------- T6
topic('r_prfconf', 'radar', 6, 'PRF conflict: Ru × v_max', (L, rng) => {
  const f = L <= 14 ? pick(rng, [1, 3, 5.6, 9.4, 10, 35]) : ri(rng, 1000, 40000) / 1000;
  const lam = C / (f * 1e9);
  const v = pick(rng, ['vmax', 'ru', 'product'] as const);
  if (v === 'vmax') {
    const Ru = L <= 14 ? pick(rng, [50, 75, 100, 150, 200, 300]) : ri(rng, 200, 5000) / 10;
    const value = (lam * C) / (8 * Ru * 1000);
    return {
      params: { v, f_GHz: f, Ru_km: Ru },
      value,
      unit: 'm/s',
      decimals: 2 + extra(L),
      question: `A ${fmt(f)} GHz radar must see to ${fmt(Ru)} km without range ambiguity. With the PRF at that limit, what is the largest unambiguous radial speed (±)?`,
      given: [C_GIVEN],
      hint: 'PRF ≤ c/(2Ru) and v_max = λ·PRF/4, so Ru·v_max = λc/8.',
      explain: (a) => `PRF = c/(2Ru) = ${fmt(C / (2 * Ru * 1000), 3)} Hz; v_max = λ·PRF/4 = ${fmt(lam, 7)} × ${fmt(C / (2 * Ru * 1000), 3)} / 4 = ${a}`,
      visual: { kind: 'rd', labels: { note: 'Ru·v_max = λc/8' } },
      near: [value * 2, value / 2, value * 4],
    };
  }
  if (v === 'ru') {
    const vm = L <= 14 ? pick(rng, [15, 25, 50, 100, 150, 300]) : ri(rng, 100, 9000) / 10;
    const value = (lam * C) / (8 * vm) / 1000;
    return {
      params: { v, f_GHz: f, vmax_mps: vm },
      value,
      unit: 'km',
      decimals: 1 + extra(L),
      question: `A ${fmt(f)} GHz radar must measure ±${fmt(vm)} m/s without Doppler ambiguity. What is the largest unambiguous range it can then have?`,
      given: [C_GIVEN],
      hint: 'v_max = λ·PRF/4 sets the PRF; then Ru = c/(2·PRF). Equivalently Ru = λc/(8·v_max).',
      explain: (a) => `PRF = 4v/λ = ${fmt((4 * vm) / lam, 3)} Hz; Ru = c/(2·PRF) = ${a}`,
      visual: { kind: 'rd', labels: { note: 'Ru·v_max = λc/8' } },
      near: [value * 2, value / 2, value * 1000],
    };
  }
  const value = (lam * C) / 8 / 1000;
  return {
    params: { v, f_GHz: f },
    value,
    unit: 'km·m/s',
    decimals: 1 + extra(L),
    question: `For a ${fmt(f)} GHz pulse-Doppler radar, what is the product Ru·v_max that no single PRF can exceed?`,
    given: [C_GIVEN],
    hint: 'Multiply Ru = c/(2·PRF) by v_max = λ·PRF/4: the PRF cancels.',
    explain: (a) => `Ru·v_max = λc/8 = ${fmt(lam, 7)} × 3×10^8 / 8 = ${fmt(value * 1000, 3)} m²/s = ${a}`,
    visual: { kind: 'rd', labels: { note: 'Ru·v_max = ?' } },
    near: [value * 2, value / 2, value * 1000],
  };
});

topic('r_fftsize', 'radar', 6, 'Doppler FFT sizing', (L, rng) => {
  const f = L <= 14 ? pick(rng, [3, 5, 10, 16, 35]) : ri(rng, 1000, 40000) / 1000;
  const prf = L <= 14 ? pick(rng, [1000, 2000, 4000, 5000, 10000]) : ri(rng, 1000, 50000);
  const lam = C / (f * 1e9);
  let dv = 1;
  let raw = 1;
  for (let g = 0; g < 60; g++) {
    dv = ri(rng, 10, 500) / 100;
    raw = (lam * prf) / (2 * dv);
    if (raw > 3 && raw < 70000 && frac(raw) > 1e-6 && frac(raw) < 1 - 1e-6) break;
  }
  let N = 1;
  while (N < raw) N *= 2;
  if (rng() < 0.6) {
    return {
      params: { v: 'n', f_GHz: f, prf_Hz: prf, dv_mps: dv },
      value: N,
      unit: 'points',
      decimals: 0,
      exact: true,
      question: `A ${fmt(f)} GHz radar at PRF ${fmt(prf)} Hz needs velocity resolution of ${fmt(dv)} m/s or better. What is the smallest power-of-two Doppler FFT size?`,
      given: [C_GIVEN],
      hint: 'Δv = λ·PRF/(2N): solve for N, then round up to a power of two.',
      explain: (a) => `N ≥ λ·PRF/(2Δv) = ${fmt(lam, 7)} × ${fmt(prf)} / (2 × ${fmt(dv)}) = ${fmt(raw, 2)} → ${a}`,
      visual: { kind: 'spectrum', labels: { N: 'N = ?', span: `PRF = ${fmt(prf)} Hz` } },
      near: [N / 2, N * 2, Math.ceil(raw)],
    };
  }
  return {
    params: { v: 'cpi', f_GHz: f, prf_Hz: prf, dv_mps: dv },
    value: (N / prf) * 1000,
    unit: 'ms',
    decimals: 2 + extra(L),
    question: `A ${fmt(f)} GHz radar at PRF ${fmt(prf)} Hz needs velocity resolution of ${fmt(dv)} m/s or better, using a power-of-two Doppler FFT. How long is the coherent processing interval (N pulses)?`,
    given: [C_GIVEN],
    hint: 'Find N from Δv = λ·PRF/(2N), round up to a power of two, then CPI = N/PRF.',
    explain: (a) => `N ≥ ${fmt(raw, 2)} → ${N}; CPI = N/PRF = ${N} / ${fmt(prf)} = ${a}`,
    visual: { kind: 'spectrum', labels: { N: 'N = ?', span: `PRF = ${fmt(prf)} Hz` } },
    near: [((N / 2) / prf) * 1000, (raw / prf) * 1000, ((N * 2) / prf) * 1000],
  };
});

topic('r_linkrange', 'radar', 6, 'Link budget to detection range', (L, rng) => {
  const S0 = ri(rng, 100, 300) / 10;
  const R0 = L <= 14 ? pick(rng, [10, 20, 25, 50, 100]) : ri(rng, 50, 2000) / 10;
  const k = L <= 14 ? pick(rng, [1, 2, 4, 10]) : ri(rng, 10, 160) / 10;
  const X = L <= 14 ? pick(rng, [0, 1, 2, 3]) : ri(rng, 0, 60) / 10;
  const Sreq = ri(rng, 100, 160) / 10;
  const margin = S0 + 10 * log10(k) - X - Sreq;
  const value = R0 * 10 ** (margin / 40);
  return {
    params: { S0_dB: S0, R0_km: R0, k, loss_dB: X, Sreq_dB: Sreq },
    value,
    unit: 'km',
    decimals: 1 + extra(L),
    question: `At ${fmt(R0)} km a target gives ${fmt(S0)} dB SNR. Transmit power is then raised ×${fmt(k)} and ${fmt(X)} dB of extra loss is added. Detection needs ${fmt(Sreq)} dB. What is the new maximum detection range?`,
    hint: 'Net margin = old SNR + 10·log10(power factor) − extra loss − required SNR; range scales by 10^(margin/40).',
    explain: (a) => `margin = ${fmt(S0)} + ${fmt(10 * log10(k), 3)} − ${fmt(X)} − ${fmt(Sreq)} = ${fmt(margin, 3)} dB; R = ${fmt(R0)} × 10^(${fmt(margin, 3)}/40) = ${a}`,
    near: [R0 * 10 ** (margin / 20), R0 * 10 ** (margin / 10), R0],
  };
});

topic('r_chainbin', 'radar', 6, 'Aliased Doppler bin', (L, rng) => {
  const f = L <= 14 ? pick(rng, [3, 5, 9.6, 10, 16, 35]) : ri(rng, 1000, 40000) / 1000;
  const prf = L <= 14 ? pick(rng, [2000, 4000, 5000, 8000, 10000]) : ri(rng, 1000, 30000);
  const N = pick(rng, [32, 64, 128, 256]);
  const lam = C / (f * 1e9);
  let v = 0;
  let idx = 0;
  for (let g = 0; g < 80; g++) {
    v = L <= 14 ? ri(rng, 20, 900) : ri(rng, 2000, 90000) / 100;
    const fd = (2 * v) / lam;
    const fa = fd - prf * Math.floor(fd / prf);
    idx = fa / (prf / N);
    if (Math.abs(frac(idx) - 0.5) > 0.02) break;
  }
  const value = Math.round(idx) % N;
  return {
    params: { f_GHz: f, prf_Hz: prf, N, v_mps: v },
    value,
    unit: 'bin',
    decimals: 0,
    exact: true,
    question: `A ${fmt(f)} GHz radar, PRF ${fmt(prf)} Hz, ${N}-point Doppler FFT (bins 0…${N - 1} cover 0 to PRF). A target closes at ${fmt(v)} m/s. Which bin (nearest) does it land in after aliasing?`,
    given: [C_GIVEN],
    hint: 'fd = 2v/λ; fold into 0…PRF with mod PRF; bin = folded fd / (PRF/N), nearest integer, mod N.',
    explain: (a) => {
      const fd = (2 * v) / lam;
      const fa = fd - prf * Math.floor(fd / prf);
      return `fd = 2v/λ = ${fmt(fd, 2)} Hz; mod PRF → ${fmt(fa, 2)} Hz; ÷ ${fmt(prf / N, 4)} Hz/bin = ${fmt(idx, 2)} → ${a}`;
    },
    visual: { kind: 'spectrum', labels: { N: `N = ${N}`, span: `0 … PRF = ${fmt(prf)} Hz` } },
    near: [(value + 1) % N, (value + N - 1) % N, Math.round(((2 * v) / lam) / (prf / N))],
  };
});

// ================================================================ SOFTWARE

const D = 'decimal';

// ---------- T1
topic('s_bin', 'software', 1, 'Binary', (L, rng) => {
  const bits = L <= 2 ? ri(rng, 4, 8) : L <= 10 ? ri(rng, 8, 12) : ri(rng, 12, Math.min(32, 12 + Math.floor((cap(L) - 10) / 2)));
  if (rng() < 0.7 || L >= 11) {
    const x = ri(rng, pow2(bits - 1), pow2(bits) - 1);
    return {
      params: { v: 'b2d', bits: bin(x, bits) },
      value: x,
      unit: D,
      decimals: 0,
      exact: true,
      question: `Convert binary ${binGroups(x, bits)} to decimal.`,
      hint: 'Sum the powers of two at each 1 bit (rightmost bit = 2^0).',
      explain: (a) =>
        `${bin(x, bits)
          .split('')
          .map((c, i) => (c === '1' ? `2^${bits - 1 - i}` : ''))
          .filter(Boolean)
          .join(' + ')} = ${a}`,
      visual: { kind: 'bits', rows: [{ label: 'x', bits: bin(x, bits) }] },
      near: [x + pow2(bits - 1), x - 1, Number.parseInt(bin(x, bits).split('').reverse().join(''), 2)],
    };
  }
  const b = Math.min(bits, 10);
  const x = ri(rng, pow2(b - 1), pow2(b) - 1);
  const value = Number(x.toString(2));
  return {
    params: { v: 'd2b', x },
    value,
    unit: 'binary',
    decimals: 0,
    exact: true,
    question: `Write decimal ${x} in binary.`,
    hint: 'Repeatedly divide by two and read the remainders bottom-up (or peel off the largest powers of two).',
    explain: (a) => `${x} = ${bin(x, b)
      .split('')
      .map((c, i) => (c === '1' ? `2^${b - 1 - i}` : ''))
      .filter(Boolean)
      .join(' + ')} → ${a}`,
    near: [Number((x + 1).toString(2)), Number((x - 1).toString(2)), Number(x.toString(2).split('').reverse().join(''))],
  };
});

topic('s_hex', 'software', 1, 'Hexadecimal', (L, rng) => {
  const nd = L <= 2 ? 2 : L <= 10 ? ri(rng, 3, 4) : ri(rng, 5, Math.min(8, 5 + Math.floor((cap(L) - 10) / 4)));
  const x = ri(rng, 16 ** (nd - 1), 16 ** nd - 1);
  const h = x.toString(16).toUpperCase().padStart(nd, '0');
  return {
    params: { hex: h },
    value: x,
    unit: D,
    decimals: 0,
    exact: true,
    question: `Convert 0x${h} to decimal.`,
    hint: 'Each hex digit is worth 16^position (rightmost = 16^0); A–F are ten to fifteen.',
    explain: (a) =>
      `${h
        .split('')
        .map((c, i) => `${Number.parseInt(c, 16)}×16^${nd - 1 - i}`)
        .join(' + ')} = ${a}`,
    visual: { kind: 'bits', rows: [{ label: `0x${h}`, bits: bin(x, nd * 4) }] },
    near: [x + 16, x - 16, Number.parseInt(h, 10) || x + 1],
  };
});

topic('s_shift', 'software', 1, 'Bit shifts', (L, rng) => {
  const op = rng() < 0.5 ? '<<' : '>>';
  let x: number;
  let k: number;
  let width: number;
  if (L <= 2) {
    x = ri(rng, 1, 255);
    k = ri(rng, 1, 4);
    width = 0;
  } else if (L <= 10) {
    x = ri(rng, 256, 65535);
    k = ri(rng, 1, 8);
    width = 16;
  } else {
    x = ri(rng, 65536, 4294967295);
    k = ri(rng, 1, 31);
    width = 32;
  }
  const value = op === '<<' ? (width ? (x * pow2(k)) % pow2(width) : x * pow2(k)) : Math.floor(x / pow2(k));
  const type = width ? `uint${width}_t` : 'unsigned';
  return {
    params: { op, x, k, width },
    value,
    unit: D,
    decimals: 0,
    exact: true,
    question: width ? `${type} x = ${x}; what is (${type})(x ${op} ${k})?` : `unsigned x = ${x}; what is x ${op} ${k}?`,
    hint: op === '<<' ? 'Each left shift doubles the value; bits pushed past the top of the type are lost.' : 'A logical right shift by k divides by 2^k and drops the remainder.',
    explain: (a) =>
      op === '<<'
        ? width ? `${x} × 2^${k} = ${x * pow2(k)} mod 2^${width} = ${a}` : `${x} × 2^${k} = ${a}`
        : `⌊${x} / 2^${k}⌋ = ⌊${x} / ${pow2(k)}⌋ = ${a}`,
    visual: { kind: 'bits', rows: [{ label: 'x', bits: bin(x, width || Math.max(8, x.toString(2).length)) }] },
    near: op === '<<' ? [x * k, x * pow2(k + 1), Math.floor(x / pow2(k))] : [Math.floor(x / k), Math.floor(x / pow2(k - 1)), x * pow2(k)],
  };
});

topic('s_mod', 'software', 1, 'Modulo', (L, rng) => {
  let a: number;
  let b: number;
  if (L <= 2) {
    a = ri(rng, 10, 200);
    b = ri(rng, 3, 12);
  } else if (L <= 10) {
    a = ri(rng, 100, 9999) * (rng() < 0.3 ? -1 : 1);
    b = ri(rng, 3, 99);
  } else {
    a = ri(rng, 10000, 9999999) * (rng() < 0.4 ? -1 : 1);
    b = ri(rng, 7, 9999);
  }
  if (a % b === 0) a += a < 0 ? -1 : 1;
  const value = a - b * Math.trunc(a / b);
  return {
    params: { a, b },
    value,
    unit: D,
    decimals: 0,
    exact: true,
    question: `In C, what is ${fmt(a)} % ${b}?${a < 0 ? ' (C99: the result takes the sign of the dividend.)' : ''}`,
    hint: 'a % b = a − b·(a / b), where / truncates toward zero.',
    explain: (a2) => `${fmt(a)} / ${b} = ${fmt(Math.trunc(a / b))} (truncated); ${fmt(a)} − ${b}×${fmt(Math.trunc(a / b))} = ${a2}`,
    near: [value + b, value - b, Math.abs(value) === value ? b - value : value + b],
  };
});

topic('s_pow2', 'software', 1, 'Powers of two', (L, rng) => {
  const k = L <= 2 ? ri(rng, 4, 16) : L <= 10 ? ri(rng, 10, 32) : ri(rng, 20, Math.min(48, 20 + cap(L) - 10));
  if (rng() < 0.55) {
    return {
      params: { v: 'pow', k },
      value: pow2(k),
      unit: D,
      decimals: 0,
      exact: true,
      question: `What is 2^${k}?`,
      hint: 'Use 2^10 ≈ 10^3 as a landmark, then double up from the nearest known power.',
      explain: (a) => `2^${k} = ${k >= 10 ? `2^10·2^${k - 10} = 1024 × ${pow2(k - 10)} = ` : ''}${a}`,
      near: [pow2(k - 1), pow2(k + 1), 2 * k],
    };
  }
  return {
    params: { v: 'log', k },
    value: k,
    unit: 'bits',
    decimals: 0,
    exact: true,
    question: `How many address bits are needed to address ${pow2(k)} bytes?`,
    hint: 'Bits needed = log2(number of locations).',
    explain: (a) => `${pow2(k)} = 2^${k}, so log2 = ${a}`,
    near: [k + 1, k - 1, Math.round(log10(pow2(k)))],
  };
});

topic('s_maxint', 'software', 1, 'Integer ranges', (L, rng) => {
  const N = L <= 2 ? pick(rng, [4, 5, 6, 7, 8, 10, 12, 16]) : L <= 10 ? pick(rng, [8, 10, 12, 14, 16, 20, 24, 32]) : ri(rng, 17, Math.min(48, 17 + cap(L) - 10));
  const v = L <= 2 ? 'umax' : pick(rng, ['umax', 'smax', 'smin'] as const);
  const value = v === 'umax' ? pow2(N) - 1 : v === 'smax' ? pow2(N - 1) - 1 : -pow2(N - 1);
  return {
    params: { v, N },
    value,
    unit: D,
    decimals: 0,
    exact: true,
    question:
      v === 'umax'
        ? `What is the largest value ${an(N).toLowerCase()} ${N}-bit unsigned integer can hold?`
        : v === 'smax'
          ? `What is the largest value of ${an(N).toLowerCase()} ${N}-bit two's-complement signed integer?`
          : `What is the most negative value of ${an(N).toLowerCase()} ${N}-bit two's-complement signed integer?`,
    hint: v === 'umax' ? 'All N bits set: 2^N−1.' : "Two's-complement N-bit range runs from −2^(N−1) to 2^(N−1)−1.",
    explain: (a) => (v === 'umax' ? `2^${N} − 1 = ${a}` : v === 'smax' ? `2^${N - 1} − 1 = ${a}` : `−2^${N - 1} = ${a}`),
    near: v === 'umax' ? [pow2(N), pow2(N - 1) - 1, pow2(N) - 2] : v === 'smax' ? [pow2(N - 1), pow2(N) - 1, pow2(N - 1) - 2] : [-pow2(N - 1) + 1, -pow2(N), pow2(N - 1)],
  };
});

// ---------- T2
topic('s_bitwise', 'software', 2, 'Bitwise operators', (L, rng) => {
  const w = L <= 4 ? 8 : L <= 10 ? 16 : 32;
  const op = pick(rng, ['&', '|', '^', '~'] as const);
  const a = ri(rng, 1, pow2(w) - 2);
  let b = ri(rng, 1, pow2(w) - 2);
  if (op === '&' && ((a & b) >>> 0) === 0) b = (b + ((a & -a) >>> 0)) % pow2(w) || a; // share at least one bit: no trivial zero
  const value = op === '&' ? (a & b) >>> 0 : op === '|' ? (a | b) >>> 0 : op === '^' ? (a ^ b) >>> 0 : pow2(w) - 1 - a;
  const show = (n: number) => (w === 8 ? `0b${bin(n, 8)}` : hex(n, w / 4));
  const rows = [{ label: 'a', bits: bin(a, w) }];
  if (op !== '~') rows.push({ label: 'b', bits: bin(b, w) });
  return {
    params: op === '~' ? { op, a, w } : { op, a, b, w },
    value,
    unit: D,
    decimals: 0,
    exact: true,
    question: op === '~' ? `uint${w}_t a = ${show(a)}; what is (uint${w}_t)~a, in decimal?` : `uint${w}_t a = ${show(a)}, b = ${show(b)}; what is a ${op} b, in decimal?`,
    hint:
      op === '&'
        ? '& keeps only the bits set in both operands.'
        : op === '|'
          ? '| keeps the bits set in either operand.'
          : op === '^'
            ? '^ keeps the bits where the operands differ.'
            : '~ flips every bit of the type width (same as max − a).',
    explain: (a2) => (op === '~' ? `~${show(a)} = ${show(value)} = ${a2}` : `${show(a)} ${op} ${show(b)} = ${show(value)} = ${a2}`),
    visual: { kind: 'bits', rows },
    near: op === '~' ? [pow2(w) - a, -a - 1, a ^ 0xff] : [(a | b) >>> 0, (a & b) >>> 0, (a ^ b) >>> 0, a + b],
  };
});

topic('s_twos', 'software', 2, "Two's complement", (L, rng) => {
  const w = L <= 4 ? 8 : L <= 10 ? pick(rng, [8, 16]) : pick(rng, [16, 32]);
  if (rng() < 0.55) {
    const x = rng() < 0.8 ? ri(rng, pow2(w - 1), pow2(w) - 1) : ri(rng, 1, pow2(w - 1) - 1);
    const value = x >= pow2(w - 1) ? x - pow2(w) : x;
    return {
      params: { v: 'decode', x, w },
      value,
      unit: D,
      decimals: 0,
      exact: true,
      question: `Interpret the ${w}-bit pattern ${hex(x, w / 4)} as a two's-complement signed integer.`,
      hint: 'If the top bit is set, subtract 2^N from the unsigned value.',
      explain: (a) => (x >= pow2(w - 1) ? `${x} − 2^${w} = ${x} − ${pow2(w)} = ${a}` : `top bit clear, so it is just ${a}`),
      visual: { kind: 'bits', rows: [{ label: hex(x, w / 4), bits: bin(x, w), hi: [0, 1] }] },
      near: [x, -value, value - 1],
    };
  }
  const n = -ri(rng, 1, pow2(w - 1));
  const value = n + pow2(w);
  return {
    params: { v: 'encode', n, w },
    value,
    unit: D,
    decimals: 0,
    exact: true,
    question: `int${w}_t n = ${fmt(n)}; reinterpret its bits as uint${w}_t. What unsigned value is that?`,
    hint: "Two's complement: invert the bits of |n| and add one, i.e. 2^N − |n|.",
    explain: (a) => `2^${w} − ${-n} = ${pow2(w)} − ${-n} = ${a}`,
    visual: { kind: 'bits', rows: [{ label: fmt(n), bits: bin(value, w), hi: [0, 1] }] },
    near: [value - 1, pow2(w) - 1 + n, -n],
  };
});

topic('s_field', 'software', 2, 'Bit-field extraction', (L, rng) => {
  const w = L <= 10 ? 16 : 32;
  const a = ri(rng, 1, w - 3);
  const f = ri(rng, 2, Math.min(L <= 4 ? 4 : 8, w - a));
  const x = ri(rng, pow2(w - 2), pow2(w) - 1);
  const mask = pow2(f) - 1;
  const value = Math.floor(x / pow2(a)) % pow2(f);
  return {
    params: { x, a, f, w },
    value,
    unit: D,
    decimals: 0,
    exact: true,
    question: `uint${w}_t x = ${hex(x, w / 4)}; what is (x >> ${a}) & ${hex(mask, 1)}?`,
    hint: 'Shift the field down to bit 0, then AND with a mask as wide as the field.',
    explain: (a2) => `x >> ${a} = ${hex(Math.floor(x / pow2(a)), 1)}; & ${hex(mask, 1)} keeps the low ${f} bits = ${a2}`,
    visual: { kind: 'bits', rows: [{ label: 'x', bits: bin(x, w), hi: [w - a - f, f] }] },
    near: [Math.floor(x / pow2(a)), value ^ 1, Math.floor(x / pow2(a + 1)) % pow2(f)],
  };
});

topic('s_intdiv', 'software', 2, 'Integer division', (L, rng) => {
  const big = L >= 11;
  const sign = () => (L >= 5 && rng() < 0.35 ? -1 : 1);
  const a = ri(rng, big ? 10000 : 10, big ? 9999999 : 999) * sign();
  const b = ri(rng, 2, big ? 999 : 30) * sign();
  if (L <= 4 || rng() < 0.6) {
    const value = Math.trunc(a / b);
    return {
      params: { v: 'div', a, b },
      value,
      unit: D,
      decimals: 0,
      exact: true,
      question: `In C: int a = ${fmt(a)}, b = ${fmt(b)}; what is a / b?`,
      hint: 'Integer division truncates toward zero (C99 and later).',
      explain: (a2) => `${fmt(a)} / ${fmt(b)} = ${fmt(a / b, 4)} → truncated toward zero = ${a2}`,
      near: [Math.floor(a / b), Math.round(a / b) + 1, value + 1],
    };
  }
  const c = ri(rng, 2, 12);
  const value = Math.trunc(a / b) * c;
  return {
    params: { v: 'expr', a, b, c },
    value,
    unit: D,
    decimals: 0,
    exact: true,
    question: `In C: int a = ${fmt(a)}, b = ${fmt(b)}, c = ${c}; what is a / b * c?`,
    hint: '/ and * have the same precedence and associate left to right; each / truncates toward zero.',
    explain: (a2) => `(a / b) = ${fmt(Math.trunc(a / b))}; × ${c} = ${a2}`,
    near: [Math.trunc((a * c) / b), Math.floor(a / b) * c, value + c],
  };
});

topic('s_wrap', 'software', 2, 'Unsigned wraparound', (L, rng) => {
  const w = L <= 4 ? 8 : pick(rng, [8, 16]);
  const M = pow2(w);
  const op = pick(rng, ['+', '-', '*'] as const);
  let a: number;
  let b: number;
  if (op === '+') {
    a = ri(rng, M / 2, M - 1);
    b = ri(rng, M - a, M - 1);
  } else if (op === '-') {
    a = ri(rng, 0, M / 2);
    b = ri(rng, a + 1, M - 1);
  } else {
    a = ri(rng, 3, M - 1);
    b = ri(rng, Math.ceil(M / a) + 1, M - 1);
    if (a * b < M) b = M - 1;
  }
  const raw = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const value = ((raw % M) + M) % M;
  return {
    params: { op, a, b, w },
    value,
    unit: D,
    decimals: 0,
    exact: true,
    question: `uint${w}_t a = ${a}, b = ${b}; what is (uint${w}_t)(a ${op === '*' ? '*' : op} b)?`,
    hint: 'Unsigned arithmetic wraps modulo 2^N.',
    explain: (a2) => `${a} ${op === '*' ? '×' : op === '-' ? MINUS : '+'} ${b} = ${fmt(raw)}; mod ${M} = ${a2}`,
    near: [raw, value + 1, M - 1],
  };
});

// ---------- T3
const fact = (n: number) => {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
};
const fib = (n: number) => {
  let a = 0;
  let b = 1;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
};

topic('s_trace', 'software', 3, 'Trace the code', (L, rng) => {
  const s = cap(L);
  const vars = ['sum', 'nested', 'offby1', 'array', 'fact', 'gcd', 'fib', 'collatz'];
  if (L >= 7) vars.push('fibcalls', 'gcdcalls');
  const v = pick(rng, vars);
  const common = { unit: D, decimals: 0, exact: true as const };
  switch (v) {
    case 'sum': {
      const A = ri(rng, 0, 5);
      const B = ri(rng, 12, 20 + 6 * s);
      const K = ri(rng, 2, 3 + Math.floor(s / 4));
      let sum = 0;
      for (let i = A; i < B; i += K) sum += i;
      return {
        ...common,
        params: { v, A, B, K },
        value: sum,
        question: 'Trace the loop. What is s afterwards?',
        hint: 'List the i values the loop visits (watch the strict < bound and the step), then add them as an arithmetic series.',
        explain: (a) => `i = ${A}, ${A + K}, …, ${A + K * Math.floor((B - 1 - A) / K)} (${Math.floor((B - 1 - A) / K) + 1} terms); s = ${a}`,
        visual: { kind: 'code', lines: ['int s = 0;', `for (int i = ${A}; i < ${B}; i += ${K})`, '    s += i;'] },
        near: [sum + B, sum - A, sum + B - K],
      };
    }
    case 'nested': {
      const N = ri(rng, 3, 8 + s);
      const tri = rng() < 0.5;
      const M = ri(rng, 3, 8 + s);
      const value = tri ? (N * (N + 1)) / 2 : N * M;
      return {
        ...common,
        params: { v, N, M: tri ? 'i' : M },
        value,
        question: 'How many times does c++ run?',
        hint: tri ? 'For each i the inner loop runs i + 1 times (note the <=); add those up.' : 'Independent bounds: inner count × outer count.',
        explain: (a) => (tri ? `Σ (i+1) for i = 0..${N - 1} = ${N}·${N + 1}/2 = ${a}` : `${N} × ${M} = ${a}`),
        visual: {
          kind: 'code',
          lines: ['int c = 0;', `for (int i = 0; i < ${N}; i++)`, `    for (int j = 0; j ${tri ? '<= i' : `< ${M}`}; j++)`, '        c++;'],
        },
        near: tri ? [(N * (N - 1)) / 2, N * N, value + N] : [N * (M + 1), (N + 1) * (M + 1), N + M],
      };
    }
    case 'offby1': {
      const A = ri(rng, 0, 20);
      const K = ri(rng, 1, 5);
      const B = A + ri(rng, 10, 40 + 10 * s);
      const value = Math.floor((B - A) / K) + 1;
      return {
        ...common,
        params: { v, A, B, K },
        value,
        question: 'How many times does the loop body run?',
        hint: 'Inclusive bound: count = ⌊(last − first)/step⌋ + 1.',
        explain: (a) => `⌊(${B} − ${A}) / ${K}⌋ + 1 = ${a}`,
        visual: { kind: 'code', lines: ['int c = 0;', `for (int i = ${A}; i <= ${B}; i += ${K})`, '    c++;'] },
        near: [value - 1, value + 1, Math.ceil((B - A) / K)],
      };
    }
    case 'array': {
      const n = ri(rng, 6, 10);
      const arr = Array.from({ length: n }, () => ri(rng, -9, 20 + s));
      const S = ri(rng, 0, 2);
      const K = ri(rng, 2, 3);
      let sum = 0;
      for (let i = S; i < n; i += K) sum += arr[i];
      return {
        ...common,
        params: { v, arr: arr.join(','), S, K },
        value: sum,
        question: 'Trace the loop (indices start at 0). What is s afterwards?',
        hint: 'Write down which indices the loop touches (start, step, stop before n), then add those elements.',
        explain: (a) => {
          const idx: number[] = [];
          for (let i = S; i < n; i += K) idx.push(i);
          return `indices ${idx.join(', ')} → ${idx.map((i) => arr[i]).join(' + ')} = ${a}`;
        },
        visual: { kind: 'code', lines: [`int a[${n}] = {${arr.join(', ')}};`, 'int s = 0;', `for (int i = ${S}; i < ${n}; i += ${K})`, '    s += a[i];'] },
        near: [sum + arr[n - 1], sum - arr[S], arr.reduce((x, y) => x + y, 0)],
      };
    }
    case 'fact': {
      const N = ri(rng, 4, Math.min(17, 6 + Math.floor(s / 2)));
      return {
        ...common,
        params: { v, N },
        value: fact(N),
        question: `What does f(${N}) return?`,
        hint: 'f(n) = n·f(n−1) with f(1) = 1: the product of 1..n.',
        explain: (a) => `${N}! = ${Array.from({ length: N }, (_, i) => N - i).join('·')} = ${a}`,
        visual: { kind: 'code', lines: [`${N > 12 ? 'long long' : 'int'} f(int n) {`, '    return n <= 1 ? 1 : n * f(n - 1);', '}'] },
        near: [fact(N - 1), fact(N + 1), fact(N) / 2],
      };
    }
    case 'gcd':
    case 'gcdcalls': {
      const g = ri(rng, 2, 30);
      const A = g * ri(rng, 5, 30 + 3 * s);
      const B = g * ri(rng, 3, 25 + 3 * s);
      let calls = 1;
      let x = A;
      let y = B;
      while (y !== 0) {
        [x, y] = [y, x % y];
        calls++;
      }
      return {
        ...common,
        params: { v, A, B },
        value: v === 'gcd' ? x : calls,
        unit: v === 'gcd' ? D : 'calls',
        question: v === 'gcd' ? `What does g(${A}, ${B}) return?` : `How many times is g called in total (including the first call) for g(${A}, ${B})?`,
        hint: v === 'gcd' ? "Euclid's algorithm: replace (a, b) with (b, a % b) until b is zero." : 'Run Euclid by hand and count one call per (a, b) pair, including the final b == 0 call.',
        explain: (a) => {
          const steps: string[] = [];
          let p = A;
          let q = B;
          while (q !== 0) {
            steps.push(`(${p},${q})`);
            [p, q] = [q, p % q];
          }
          steps.push(`(${p},0)`);
          return `${steps.join(' → ')}; ${v === 'gcd' ? 'gcd' : 'calls'} = ${a}`;
        },
        visual: { kind: 'code', lines: ['int g(int a, int b) {', '    return b == 0 ? a : g(b, a % b);', '}'] },
        near: v === 'gcd' ? [x * 2, Math.max(1, x / 2), g === x ? x + 1 : g] : [calls - 1, calls + 1, calls * 2],
      };
    }
    case 'fib':
    case 'fibcalls': {
      const N = v === 'fib' ? ri(rng, 8, Math.min(60, 12 + s)) : ri(rng, 5, Math.min(30, 8 + Math.floor(s / 2)));
      const value = v === 'fib' ? fib(N) : 2 * fib(N + 1) - 1;
      return {
        ...common,
        params: { v, N },
        value,
        unit: v === 'fib' ? D : 'calls',
        question: v === 'fib' ? `What does fib(${N}) return?` : `How many calls to fib (including the first) does fib(${N}) make?`,
        hint: v === 'fib' ? 'Iterate 0, 1, 1, 2, 3, 5, … up to index n.' : 'calls(n) = 1 + calls(n−1) + calls(n−2), with calls(0) = calls(1) = 1.',
        explain: (a) => (v === 'fib' ? `fib(${N - 2}) + fib(${N - 1}) = ${fib(N - 2)} + ${fib(N - 1)} = ${a}` : `calls(n) = 2·fib(n+1) − 1 = 2·${fib(N + 1)} − 1 = ${a}`),
        visual: { kind: 'code', lines: ['long long fib(int n) {', '    return n < 2 ? n : fib(n - 1) + fib(n - 2);', '}'] },
        near: v === 'fib' ? [fib(N - 1), fib(N + 1), value + 1] : [fib(N + 1), 2 * fib(N + 1), value + 2],
      };
    }
    default: {
      const N = ri(rng, 3, Math.min(5000, 25 + 12 * s));
      let n = N;
      let steps = 0;
      while (n !== 1) {
        n = n % 2 ? 3 * n + 1 : n / 2;
        steps++;
      }
      return {
        ...common,
        params: { v: 'collatz', N },
        value: steps,
        unit: 'steps',
        question: 'What is steps when the loop ends?',
        hint: 'Just run it: halve when even, 3n+1 when odd, count until n reaches one.',
        explain: (a) => {
          const seq: number[] = [N];
          let m = N;
          while (m !== 1 && seq.length < 9) {
            m = m % 2 ? 3 * m + 1 : m / 2;
            seq.push(m);
          }
          return `${seq.join(' → ')}${m !== 1 ? ' → …' : ''} → 1; steps = ${a}`;
        },
        visual: { kind: 'code', lines: [`int n = ${N}, steps = 0;`, 'while (n != 1) {', '    n = (n % 2) ? 3 * n + 1 : n / 2;', '    steps++;', '}'] },
        near: [steps + 1, steps - 1, steps * 2],
      };
    }
  }
});

/** Smallest k with 2^k − 1 >= n. */
const probes = (n: number) => {
  let k = 0;
  while (pow2(k) - 1 < n) k++;
  return k;
};

topic('s_bsearch', 'software', 3, 'Binary search', (L, rng) => {
  if (rng() < 0.65) {
    const N = L <= 6 ? ri(rng, 10, 1000) : L <= 10 ? ri(rng, 1000, 1000000) : ri(rng, 1000000, 1e9 * Math.min(4, cap(L) / 10));
    const value = probes(N);
    return {
      params: { v: 'worst', N },
      value,
      unit: 'probes',
      decimals: 0,
      exact: true,
      question: `Binary search over ${fmt(N)} sorted elements, one three-way comparison per probe. Worst-case number of probes to find a key or decide it is absent?`,
      hint: 'k probes can settle up to 2^k−1 keys: k = ⌈log2(N+1)⌉.',
      explain: (a) => `2^${value - 1}−1 = ${pow2(value - 1) - 1} < ${fmt(N)} ≤ 2^${value}−1 = ${pow2(value) - 1}, so ${a}`,
      near: [value - 1, value + 1, Math.round(Math.log2(N) / 2)],
    };
  }
  const k = L <= 6 ? ri(rng, 4, 12) : ri(rng, 10, Math.min(45, 10 + cap(L)));
  return {
    params: { v: 'maxn', k },
    value: pow2(k) - 1,
    unit: 'elements',
    decimals: 0,
    exact: true,
    question: `What is the largest sorted array a binary search (one three-way compare per probe) can always settle in ${k} probes?`,
    hint: 'Each probe splits the remaining range around one element: N(k) = 2·N(k−1) + 1.',
    explain: (a) => `2^${k} − 1 = ${a}`,
    near: [pow2(k), pow2(k - 1), pow2(k) - 2],
  };
});

topic('s_tree', 'software', 3, 'Binary tree shape', (L, rng) => {
  const v = pick(rng, ['nodes', 'leaves', 'height'] as const);
  if (v === 'height') {
    const N = L <= 6 ? ri(rng, 2, 1000) : ri(rng, 1000, Math.min(2 ** 40, 1000 * 2 ** cap(L)));
    let h = 0;
    while (pow2(h + 1) <= N) h++;
    return {
      params: { v, N },
      value: h,
      unit: 'edges',
      decimals: 0,
      exact: true,
      question: `A complete binary tree (a binary heap) holds ${fmt(N)} nodes. What is its height (a lone root has height 0)?`,
      hint: 'Height of a complete tree = ⌊log2 N⌋.',
      explain: (a) => `2^${h} = ${pow2(h)} ≤ ${fmt(N)} < 2^${h + 1}, so ${a}`,
      near: [h + 1, h - 1, Math.ceil(Math.log2(N)) + 1],
    };
  }
  const h = L <= 6 ? ri(rng, 2, 10) : ri(rng, 8, Math.min(45, 8 + cap(L)));
  const value = v === 'nodes' ? pow2(h + 1) - 1 : pow2(h);
  return {
    params: { v, h },
    value,
    unit: v,
    decimals: 0,
    exact: true,
    question: v === 'nodes' ? `A perfect binary tree has height ${h} (a lone root has height 0). How many nodes does it have?` : `A perfect binary tree has height ${h} (a lone root has height 0). How many leaves does it have?`,
    hint: v === 'nodes' ? 'Depth d holds 2^d nodes; add the depths from the root to the leaves.' : 'Every level doubles; the leaves sit at depth h.',
    explain: (a) => (v === 'nodes' ? `2^0 + … + 2^${h} = 2^${h + 1} − 1 = ${a}` : `2^${h} = ${a}`),
    near: v === 'nodes' ? [pow2(h) - 1, pow2(h + 1), pow2(h)] : [pow2(h + 1), pow2(h - 1), pow2(h) - 1],
  };
});

topic('s_q', 'software', 3, 'Fixed-point Q format', (L, rng) => {
  const q = L <= 6 ? 15 : L <= 10 ? pick(rng, [7, 15, 31]) : pick(rng, [11, 13, 15, 31]);
  const S = pow2(q);
  const v = L >= 7 && rng() < 0.25 ? 'sat' : pick(rng, ['enc', 'dec'] as const);
  if (v === 'enc') {
    let x = 0.5;
    for (let g = 0; g < 40; g++) {
      x = L <= 6 ? pick(rng, [0.5, 0.25, -0.5, 0.75, 0.125, -0.25, 0.375, -0.875, 0.1, 0.3, -0.7]) : ri(rng, -9999, 9999) / 10000;
      if (x !== 0 && Math.abs(frac(Math.abs(x) * S) - 0.5) > 1e-6) break;
    }
    const value = Math.sign(x) * Math.round(Math.abs(x) * S);
    return {
      params: { v, q, x },
      value,
      unit: D,
      decimals: 0,
      exact: true,
      question: `Encode ${fmt(x)} in signed Q${q} (${q} fractional bits), rounding to nearest. What integer is stored?`,
      hint: 'Qn integer = round(value × 2^n).',
      explain: (a) => `${fmt(x)} × 2^${q} = ${fmt(x * S, 4)} → ${a}`,
      near: [Math.trunc(x * S) + (x > 0 ? -1 : 1), Math.round(x * pow2(q - 1)), Math.round(x * (S - 1)) + 1],
    };
  }
  if (v === 'dec') {
    const n = L <= 6 ? 4096 * pick(rng, [-8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7]) : ri(rng, -S, S - 1) || 1;
    const value = n / S;
    return {
      params: { v, q, n },
      value,
      unit: 'real',
      decimals: L <= 6 ? 3 : Math.min(6, 5 + extra(L)),
      question: `A signed Q${q} register holds ${fmt(n)}. What real value does it represent?`,
      hint: 'value = integer / 2^n.',
      explain: (a) => `${fmt(n)} / 2^${q} = ${fmt(n)} / ${S} = ${a}`,
      near: [n / pow2(q - 1), n / (S - 1) + 0.01, -value],
    };
  }
  const x = pick(rng, [1, 1.5, -1.5, 2, -2, 1.25]);
  const value = Math.max(-S, Math.min(S - 1, Math.sign(x) * Math.round(Math.abs(x) * S)));
  return {
    params: { v, q, x },
    value,
    unit: D,
    decimals: 0,
    exact: true,
    question: `Convert ${fmt(x)} to signed Q${q} with saturation. What integer is stored?`,
    hint: 'Signed Qn covers −1 up to 1 − 2^−n; anything outside clamps to the nearest end of that range.',
    explain: (a) => `${fmt(x)} × 2^${q} = ${fmt(x * S)} is out of range [${fmt(-S)}, ${S - 1}] → clamps to ${a}`,
    near: [x * S, x > 0 ? S : -S + 1, x > 0 ? -S : S - 1],
  };
});

// ---------- T4
topic('s_buffer', 'software', 4, 'Buffers and data rates', (L, rng) => {
  const v = pick(rng, ['bytes', 'rate', 'fill'] as const);
  if (v === 'bytes') {
    const N = L <= 8 ? pow2(ri(rng, 8, 14)) : ri(rng, 1000, 100000);
    const ch = ri(rng, 1, 8);
    const b = pick(rng, [1, 2, 4, 8]);
    const value = N * ch * b;
    return {
      params: { v, N, ch, b },
      value,
      unit: 'bytes',
      decimals: 0,
      exact: true,
      question: `A capture holds ${fmt(N)} samples per channel on ${ch} channels at ${b} bytes per sample. How big is the buffer?`,
      hint: 'Size = samples × channels × bytes per sample.',
      explain: (a) => `${fmt(N)} × ${ch} × ${b} = ${a}`,
      near: [N * b, N * ch, value * 8],
    };
  }
  const fs = L <= 8 ? pick(rng, [10, 20, 50, 100, 125, 250, 500, 1000]) : ri(rng, 5, 3000);
  const bits = pick(rng, [8, 12, 14, 16]);
  const bytes = bits === 8 ? 1 : 2;
  const ch = ri(rng, 1, 8);
  const iq = rng() < 0.5;
  const rate = fs * bytes * ch * (iq ? 2 : 1); // MB/s
  if (v === 'rate') {
    return {
      params: { v, fs_MSps: fs, bytes, ch, iq: iq ? 2 : 1 },
      value: rate,
      unit: 'MB/s',
      decimals: 1 + extra(L),
      question: `ADC: ${fmt(fs)} MS/s, ${bits}-bit samples stored in ${bytes}-byte words, ${ch} channel${ch > 1 ? 's' : ''}${iq ? ', I and Q each stored' : ''}. What is the data rate?`,
      given: ['1 MB = 10^6 bytes'],
      hint: 'Rate = fs × bytes per stored sample × channels (× 2 for I/Q).',
      explain: (a) => `${fmt(fs)}×10^6 × ${bytes} × ${ch}${iq ? ' × 2' : ''} = ${fmt(rate * 1e6)} B/s = ${a}`,
      near: [(fs * bits * ch * (iq ? 2 : 1)) / 8, rate * 8, rate / 2],
    };
  }
  const M = pick(rng, [1, 2, 4, 8, 16, 64, 256]);
  const value = ((M * pow2(20)) / (rate * 1e6)) * 1000;
  return {
    params: { v, fs_MSps: fs, bytes, ch, iq: iq ? 2 : 1, MiB: M },
    value,
    unit: 'ms',
    decimals: 2 + extra(L),
    question: `ADC: ${fmt(fs)} MS/s, ${bits}-bit samples stored in ${bytes}-byte words, ${ch} channel${ch > 1 ? 's' : ''}${iq ? ', I and Q each stored' : ''}. How long does a ${M} MiB buffer take to fill?`,
    given: ['1 MiB = 2^20 bytes', '1 MB = 10^6 bytes'],
    hint: 'Fill time = buffer size / data rate (watch MiB against MB).',
    explain: (a) => `rate = ${fmt(rate)} MB/s; ${M}×2^20 B / ${fmt(rate * 1e6)} B/s = ${a}`,
    near: ((M * 1e6) / (rate * 1e6)) * 1000 === value ? [value * 2, value / 2, value * 8] : [((M * 1e6) / (rate * 1e6)) * 1000, value * 2, value / 2],
  };
});

topic('s_fft', 'software', 4, 'FFT bins', (L, rng) => {
  const fs = L <= 8 ? pick(rng, [8000, 16000, 44100, 48000, 96000, 1e6, 10e6]) : ri(rng, 1000, 100000) * 10;
  const N = pow2(L <= 8 ? ri(rng, 6, 12) : ri(rng, 10, 16));
  const v = pick(rng, ['res', 'bin', 'freq'] as const);
  if (v === 'res') {
    return {
      params: { v, fs_Hz: fs, N },
      value: fs / N,
      unit: 'Hz',
      decimals: 2 + extra(L),
      question: `An N = ${N}-point FFT of data sampled at ${fmtHz(fs)}. What is the bin spacing?`,
      hint: 'Δf = fs/N.',
      explain: (a) => `${fmt(fs)} / ${N} = ${a}`,
      visual: { kind: 'spectrum', labels: { N: `N = ${N}`, span: `fs = ${fmtHz(fs)}` } },
      near: [fs / N / 2, (2 * fs) / N, fs / (N / 2)],
    };
  }
  const k = ri(rng, 1, N / 2 - 1);
  const f = (k * fs) / N;
  if (v === 'bin') {
    return {
      params: { v, fs_Hz: fs, N, f_Hz: f },
      value: k,
      unit: 'bin',
      decimals: 0,
      exact: true,
      question: `A ${fmt(f)} Hz tone, sampled at ${fmtHz(fs)}, ${N}-point FFT. Which bin index holds it (bin 0 = DC)?`,
      hint: 'bin = f / (fs/N) = f·N/fs.',
      explain: (a) => `${fmt(f)} × ${N} / ${fmt(fs)} = ${a}`,
      visual: { kind: 'spectrum', labels: { N: `N = ${N}`, span: `fs = ${fmtHz(fs)}`, tone: `${fmt(f)} Hz` } },
      near: [k + 1, k - 1, N - k],
    };
  }
  return {
    params: { v, fs_Hz: fs, N, k },
    value: f,
    unit: 'Hz',
    decimals: 2 + extra(L),
    question: `What frequency sits at the centre of bin ${k} of ${an(N).toLowerCase()} ${N}-point FFT at ${fmtHz(fs)}?`,
    hint: 'f = k·fs/N.',
    explain: (a) => `${k} × ${fmt(fs)} / ${N} = ${a}`,
    visual: { kind: 'spectrum', labels: { N: `N = ${N}`, span: `fs = ${fmtHz(fs)}`, tone: `bin ${k}` } },
    near: [((k + 1) * fs) / N, ((k - 1) * fs) / N, (k * fs) / (N / 2)],
  };
});

topic('s_alias', 'software', 4, 'Aliasing', (L, rng) => {
  const fs = L <= 8 ? pick(rng, [8, 10, 20, 48, 50, 100, 1000]) : ri(rng, 10, 5000);
  let f = 0;
  let value = 0;
  for (let g = 0; g < 60; g++) {
    f = ri(rng, Math.floor(fs / 2) + 1, (L <= 8 ? 4 : 9) * fs);
    const n = Math.round(f / fs);
    value = Math.abs(f - n * fs);
    if (value > 0 && Math.abs(frac(f / fs) - 0.5) > 1e-9) break;
  }
  return {
    params: { fs_kHz: fs, f_kHz: f },
    value,
    unit: 'kHz',
    decimals: 0,
    question: `A ${fmt(f)} kHz tone is sampled at ${fmt(fs)} kHz with no anti-alias filter. At what frequency (0 to fs/2) does it appear?`,
    hint: 'Fold into the first Nyquist zone: |f − k·fs| with k the integer nearest to f/fs.',
    explain: (a) => `k = round(${fmt(f)}/${fmt(fs)}) = ${Math.round(f / fs)}; |${fmt(f)} − ${Math.round(f / fs)}×${fmt(fs)}| = ${a}`,
    visual: { kind: 'spectrum', labels: { N: 'Nyquist folding', span: `fs = ${fmt(fs)} kHz`, tone: `${fmt(f)} kHz` } },
    near: [f % fs === value ? fs - value : f % fs, fs / 2, fs - value],
  };
});

topic('s_endian', 'software', 4, 'Endianness', (L, rng) => {
  const n = L <= 8 && rng() < 0.5 ? 2 : 4;
  const bytes = Array.from({ length: n }, () => ri(rng, 0, 255));
  bytes[0] = Math.max(1, bytes[0]);
  bytes[n - 1] = Math.max(1, bytes[n - 1]);
  const le = rng() < 0.5;
  const value = bytes.reduce((acc, b, i) => acc + b * 256 ** (le ? i : n - 1 - i), 0);
  const hx = bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0'));
  return {
    params: { order: le ? 'LE' : 'BE', bytes: hx.join(' ') },
    value,
    unit: D,
    decimals: 0,
    exact: true,
    question: `Memory holds the bytes ${hx.join(' ')} (lowest address first). Read as a ${8 * n}-bit unsigned ${le ? 'little' : 'big'}-endian integer, what is it in decimal?`,
    hint: le ? 'Little-endian: the byte at the lowest address is the least significant.' : 'Big-endian: the byte at the lowest address is the most significant.',
    explain: (a) => `0x${(le ? [...hx].reverse() : hx).join('')} = ${a}`,
    visual: { kind: 'table', lines: [`addr  ${hx.map((_, i) => `+${i}`.padEnd(4)).join('')}`, `byte  ${hx.map((h) => h.padEnd(4)).join('')}`] },
    near: [bytes.reduce((acc, b, i) => acc + b * 256 ** (le ? n - 1 - i : i), 0), value + 1, bytes.reduce((x, y) => x + y, 0)],
  };
});

const CTYPES: [string, number][] = [
  ['char', 1],
  ['short', 2],
  ['int', 4],
  ['float', 4],
  ['double', 8],
  ['int64_t', 8],
];

topic('s_struct', 'software', 4, 'Struct padding', (L, rng) => {
  const n = L <= 8 ? ri(rng, 3, 4) : ri(rng, 4, 6);
  const fields = Array.from({ length: n }, () => pick(rng, CTYPES));
  let off = 0;
  let maxA = 1;
  const offsets: number[] = [];
  for (const [, sz] of fields) {
    off = Math.ceil(off / sz) * sz;
    offsets.push(off);
    off += sz;
    maxA = Math.max(maxA, sz);
  }
  const size = Math.ceil(off / maxA) * maxA;
  const offset = L >= 9 && rng() < 0.4;
  const names = 'abcdef';
  const value = offset ? offsets[n - 1] : size;
  return {
    params: { v: offset ? 'offset' : 'size', fields: fields.map((f) => f[0]).join(',') },
    value,
    unit: 'bytes',
    decimals: 0,
    exact: true,
    question: offset
      ? `With natural alignment (each member aligned to its own size), what is offsetof(struct S, ${names[n - 1]})?`
      : "With natural alignment (each member aligned to its own size, total padded to the largest member's alignment), what is sizeof(struct S)?",
    given: ['char 1, short 2, int 4, float 4, double 8, int64_t 8 bytes'],
    hint: 'Walk the members in order: pad each up to its alignment, then pad the total to the largest alignment.',
    explain: (a) => `offsets ${fields.map((f, i) => `${names[i]}@${offsets[i]}`).join(', ')}; ${offset ? 'last member at' : `end ${off} → padded to ×${maxA} =`} ${a}`,
    visual: { kind: 'code', lines: ['struct S {', ...fields.map((f, i) => `    ${f[0]} ${names[i]};`), '};'] },
    near: [fields.reduce((x, f) => x + f[1], 0), size + maxA, off],
  };
});

const PRIMES = [7, 11, 13, 17, 31, 61, 97, 101, 127, 251, 509, 1021];

topic('s_hash', 'software', 4, 'Hash buckets', (L, rng) => {
  const M = pick(rng, PRIMES);
  const v = L >= 9 && rng() < 0.35 ? 'str' : pick(rng, ['mod', 'mul'] as const);
  if (v === 'str') {
    const s = Array.from({ length: 3 }, () => String.fromCharCode(65 + ri(rng, 0, 25))).join('');
    let h = 0;
    for (const ch of s) h = h * 31 + ch.charCodeAt(0);
    return {
      params: { v, s, M },
      value: h % M,
      unit: 'bucket',
      decimals: 0,
      exact: true,
      question: `h = 0; for each char c: h = h*31 + c. Bucket = h mod ${M}. Which bucket does "${s}" go to?`,
      given: ['ASCII A = 65 … Z = 90'],
      hint: 'Horner form: h = (c0·31 + c1)·31 + c2, then reduce modulo M.',
      explain: (a) => `h = (${s.charCodeAt(0)}·31 + ${s.charCodeAt(1)})·31 + ${s.charCodeAt(2)} = ${h}; ${h} mod ${M} = ${a}`,
      near: [(h + 1) % M, (h % M) + 1, h % (M + 1)],
    };
  }
  const key = ri(rng, 1000, L <= 8 ? 99999 : 999999);
  if (v === 'mod') {
    return {
      params: { v, key, M },
      value: key % M,
      unit: 'bucket',
      decimals: 0,
      exact: true,
      question: `A hash table has ${M} buckets and h(k) = k mod ${M}. Which bucket does key ${key} go to?`,
      hint: 'Bucket = key mod M, the remainder after dividing by the table size.',
      explain: (a) => `${key} = ${Math.floor(key / M)}×${M} + ${key % M} → ${a}`,
      near: [(key + 1) % M, M - (key % M), Math.floor(key / M) % M],
    };
  }
  const a = ri(rng, 3, 97);
  const b = ri(rng, 0, 99);
  const h = a * key + b;
  return {
    params: { v, key, M, a, b },
    value: h % M,
    unit: 'bucket',
    decimals: 0,
    exact: true,
    question: `h(k) = (${a}·k + ${b}) mod ${M}. Which bucket does k = ${key} go to?`,
    hint: 'Compute a·k + b first, then reduce modulo M.',
    explain: (a2) => `${a}×${key} + ${b} = ${h}; ${h} mod ${M} = ${a2}`,
    near: [(a * key) % M, (h + 1) % M, key % M],
  };
});

topic('s_checksum', 'software', 4, 'Checksums', (L, rng) => {
  const n = L <= 8 ? ri(rng, 3, 5) : ri(rng, 5, 8);
  const bytes = Array.from({ length: n }, () => ri(rng, 1, 255));
  const v = L >= 9 && rng() < 0.35 ? 'ones' : pick(rng, ['xor', 'sum'] as const);
  const sum = bytes.reduce((x, y) => x + y, 0);
  const xr = bytes.reduce((x, y) => x ^ y, 0);
  const value = v === 'xor' ? xr : v === 'sum' ? sum % 256 : 255 - (sum % 256);
  const hx = bytes.map((b) => hex(b)).join(' ');
  return {
    params: { v, bytes: bytes.join(',') },
    value,
    unit: D,
    decimals: 0,
    exact: true,
    question:
      v === 'xor'
        ? `Bytes ${hx}. What is the XOR of all of them, in decimal?`
        : v === 'sum'
          ? `Bytes ${hx}. What is the 8-bit additive checksum (sum mod 256), in decimal?`
          : `Bytes ${hx}. What is the one's-complement of the 8-bit sum, 255 − (sum mod 256), in decimal?`,
    hint: v === 'xor' ? 'XOR is bitwise addition without carries; fold the bytes one at a time.' : 'Add the bytes, keep the remainder mod 256' + (v === 'ones' ? ', then subtract it from 255.' : '.'),
    explain: (a) => (v === 'xor' ? `${hx.replace(/ /g, ' ^ ')} = ${hex(xr)} = ${a}` : `sum = ${sum}; mod 256 = ${sum % 256}${v === 'ones' ? `; 255 − ${sum % 256}` : ''} = ${a}`),
    near: v === 'xor' ? [sum % 256, xr ^ 1, 255 - xr] : [sum, xr, 256 - (sum % 256)],
  };
});

// ---------- T5
topic('s_loops', 'software', 5, 'Exact loop counts', (L, rng) => {
  const v = pick(rng, ['tri', 'tri2', 'log', 'tri3', 'nlog'] as const);
  const big = L >= 11;
  const lg = (n: number) => {
    let c = 0;
    for (let i = 1; i < n; i *= 2) c++;
    return c;
  };
  let n: number;
  let value: number;
  let lines: string[];
  let hint: string;
  let ex: (a: string) => string;
  if (v === 'tri') {
    n = big ? ri(rng, 200, 50000) : ri(rng, 10, 200);
    value = (n * (n - 1)) / 2;
    lines = [`for (int i = 0; i < ${n}; i++)`, '    for (int j = 0; j < i; j++)', '        work();'];
    hint = 'The inner loop runs i times: add i for i = 0..n−1.';
    ex = (a) => `Σ i (i = 0..${n - 1}) = ${n}·${n - 1}/2 = ${a}`;
  } else if (v === 'tri2') {
    n = big ? ri(rng, 200, 50000) : ri(rng, 10, 200);
    value = (n * (n + 1)) / 2;
    lines = [`for (int i = 0; i < ${n}; i++)`, `    for (int j = i; j < ${n}; j++)`, '        work();'];
    hint = 'The inner loop runs n − i times: add those for i = 0..n−1.';
    ex = (a) => `Σ (n−i) = ${n}·${n + 1}/2 = ${a}`;
  } else if (v === 'log') {
    n = big ? ri(rng, 1e6, 1e12) : ri(rng, 10, 1000000);
    value = lg(n);
    lines = [`for (long i = 1; i < ${n}; i *= 2)`, '    work();'];
    hint = 'i doubles each pass: count the powers of two strictly below n.';
    ex = (a) => `i = 1, 2, 4, …, 2^${value - 1} = ${pow2(value - 1)} < ${n}: ${a}`;
  } else if (v === 'tri3') {
    n = big ? ri(rng, 60, 2000) : ri(rng, 6, 60);
    value = (n * (n - 1) * (n - 2)) / 6;
    lines = [`for (int i = 0; i < ${n}; i++)`, '    for (int j = 0; j < i; j++)', '        for (int k = 0; k < j; k++)', '            work();'];
    hint = 'Each run picks k < j < i from 0..n−1, a 3-element subset: C(n,3).';
    ex = (a) => `C(${n},3) = ${n}·${n - 1}·${n - 2}/6 = ${a}`;
  } else {
    n = big ? ri(rng, 1000, 1000000) : ri(rng, 10, 5000);
    value = n * lg(n);
    lines = [`for (int i = 0; i < ${n}; i++)`, `    for (int j = 1; j < ${n}; j *= 2)`, '        work();'];
    hint = 'Outer loop n times; inner counts the doublings of j below n.';
    ex = (a) => `${n} × ${lg(n)} = ${a}`;
  }
  return {
    params: { v, n },
    value,
    unit: 'calls',
    decimals: 0,
    exact: true,
    question: 'Exactly how many times is work() called?',
    hint,
    explain: ex,
    visual: { kind: 'code', lines },
    near: v === 'tri' ? [(n * (n + 1)) / 2, n * n, value - n] : v === 'tri2' ? [(n * (n - 1)) / 2, n * n, value + n] : v === 'log' ? [value + 1, value - 1, Math.floor(Math.log10(n))] : v === 'tri3' ? [(n * n * n) / 6, value * 6, (n * (n - 1)) / 2] : [n * (lg(n) + 1), n * n, lg(n)],
  };
});

topic('s_recur', 'software', 5, 'Recurrences', (L, rng) => {
  const v = pick(rng, ['msort', 'bsearch', 'tree', 'quad'] as const);
  const k = L <= 10 ? ri(rng, 3, 10) : ri(rng, 10, v === 'quad' ? 24 : 40);
  const n = pow2(k);
  const rec = v === 'msort' ? '2T(n/2) + n' : v === 'bsearch' ? 'T(n/2) + 1' : v === 'tree' ? '2T(n/2) + 1' : '4T(n/2) + n';
  const value = v === 'msort' ? n * k + n : v === 'bsearch' ? k + 1 : v === 'tree' ? 2 * n - 1 : 2 * n * n - n;
  return {
    params: { v, k },
    value,
    unit: D,
    decimals: 0,
    exact: true,
    question: `T(1) = 1 and T(n) = ${rec} for n a power of two. What is T(${fmt(n)})?`,
    hint: 'Unroll level by level (or expand a few terms and spot the pattern); no master theorem needed.',
    explain: (a) =>
      v === 'msort'
        ? `T(2^k) = 2^k·k + 2^k: ${n}×${k} + ${n} = ${a}`
        : v === 'bsearch'
          ? `T(2^k) = k + 1 = ${a}`
          : v === 'tree'
            ? `T(n) = 2n − 1 = 2×${n} − 1 = ${a}`
            : `T(n) = 2n² − n = 2×${n}² − ${n} = ${a}`,
    near: v === 'msort' ? [n * k, n * (k + 1) + n, n * k - n] : v === 'bsearch' ? [k, k + 2, n] : v === 'tree' ? [2 * n, n, 2 * n + 1] : [n * n, 2 * n * n, n * n * 4 - n],
  };
});

topic('s_amdahl', 'software', 5, "Amdahl's law", (L, rng) => {
  const p = L <= 10 ? pick(rng, [50, 75, 80, 90, 95, 99]) / 100 : ri(rng, 500, 999) / 1000;
  const v = pick(rng, ['speedup', 'limit', 'cores'] as const);
  if (v === 'speedup') {
    const N = pick(rng, [2, 4, 8, 16, 32, 64, 128]);
    const value = 1 / (1 - p + p / N);
    return {
      params: { v, p, N },
      value,
      unit: 'speedup',
      decimals: 2 + extra(L),
      question: `${fmt(p * 100)}% of a program's run time parallelises perfectly. What is the overall speedup on ${N} cores?`,
      hint: "Amdahl: S = 1 / ((1−p) + p/N).",
      explain: (a) => `S = 1 / (${fmt(1 - p, 4)} + ${fmt(p, 4)}/${N}) = ${a}`,
      near: [N * p, 1 / (1 - p), value + 1],
    };
  }
  if (v === 'limit') {
    const value = 1 / (1 - p);
    return {
      params: { v, p },
      value,
      unit: 'speedup',
      decimals: 2 + extra(L),
      question: `${fmt(p * 100)}% of a program's run time parallelises perfectly. What is the largest speedup possible with unlimited cores?`,
      hint: 'Let N go to infinity in S = 1 / ((1−p) + p/N).',
      explain: (a) => `S∞ = 1 / (1 − ${fmt(p, 4)}) = ${a}`,
      near: [1 / p, value * 2, 100 * p],
    };
  }
  const lim = 1 / (1 - p);
  let S = 2;
  let raw = 2;
  for (let g = 0; g < 60; g++) {
    S = ri(rng, 15, Math.max(16, Math.floor(lim * 0.85 * 10))) / 10;
    raw = p / (1 / S - (1 - p));
    if (raw > 1 && frac(raw) > 1e-6 && frac(raw) < 1 - 1e-6) break;
  }
  const value = Math.ceil(raw);
  return {
    params: { v, p, S },
    value,
    unit: 'cores',
    decimals: 0,
    exact: true,
    question: `${fmt(p * 100)}% of a program parallelises perfectly. How many cores are needed for a speedup of at least ${fmt(S)}?`,
    hint: 'Solve 1/((1−p) + p/N) ≥ S for N and round up.',
    explain: (a) => `N ≥ p / (1/S − (1−p)) = ${fmt(p, 4)} / (${fmt(1 / S, 5)} − ${fmt(1 - p, 4)}) = ${fmt(raw, 3)} → ${a}`,
    near: [value + 1, Math.max(1, value - 1), Math.ceil(S)],
  };
});

topic('s_stride', 'software', 5, 'Array and cache strides', (L, rng) => {
  if (rng() < 0.5) {
    const R = ri(rng, 3, L <= 10 ? 100 : 5000);
    const Cc = ri(rng, 3, L <= 10 ? 100 : 5000);
    const [tn, e] = pick(rng, [
      ['char', 1],
      ['short', 2],
      ['float', 4],
      ['double', 8],
    ] as [string, number][]);
    const i = ri(rng, 1, R - 1);
    const j = ri(rng, 1, Cc - 1);
    const value = (i * Cc + j) * e;
    return {
      params: { v: 'offset', R, C: Cc, e, i, j },
      value,
      unit: 'bytes',
      decimals: 0,
      exact: true,
      question: `${tn} a[${R}][${Cc}] (row-major, ${e}-byte elements). What is the byte offset of a[${i}][${j}] from a[0][0]?`,
      hint: 'Row-major: offset = (i·cols + j) × element size.',
      explain: (a) => `(${i}×${Cc} + ${j}) × ${e} = ${a}`,
      near: [(j * R + i) * e, i * Cc + j, (i * R + j) * e],
    };
  }
  const n = ri(rng, 16, L <= 10 ? 1000 : 100000);
  const k = pick(rng, [1, 2, 3, 4, 8, 16, 32]);
  const e = pick(rng, [4, 8]);
  const seen = new Set<number>();
  for (let t = 0; t < n; t++) seen.add(Math.floor((t * k * e) / 64));
  return {
    params: { v: 'lines', n, k, e },
    value: seen.size,
    unit: 'lines',
    decimals: 0,
    exact: true,
    question: `An array of ${e}-byte elements starts on a 64-byte boundary. A loop reads elements 0, ${k}, ${2 * k}, … (${n} reads, stride ${k}). How many distinct 64-byte cache lines are touched?`,
    hint: 'Byte address = index × element size; line = ⌊address / 64⌋. Count the distinct lines.',
    explain: (a) => `last address ${(n - 1) * k * e}; ${k * e >= 64 ? 'stride ≥ a line, so one new line per read' : `lines 0 … ${Math.floor(((n - 1) * k * e) / 64)}`} → ${a}`,
    near: [Math.ceil((n * e) / 64), n, seen.size + 1],
  };
});

const IEEE_VALUES = [1, 2, 0.5, 3, 6.5, 0.15625, 100, -3.75, 1024, 0.375, 10, -0.75, 12.5, 0.1, -2.5, 255, 0.0625];

topic('s_ieee', 'software', 5, 'IEEE-754 single fields', (L, rng) => {
  const x = L <= 10 ? pick(rng, IEEE_VALUES) : pick(rng, [...IEEE_VALUES, 1e6, -1536, 0.001953125, 3.140625, 65504]);
  const v = L >= 11 && rng() < 0.4 ? 'word' : pick(rng, ['exp', 'mant'] as const);
  const ax = Math.abs(x);
  const e = Math.floor(Math.log2(ax));
  const m = ax / pow2(e) - 1;
  const mant = Math.round(m * pow2(23));
  const expField = e + 127;
  const sign = x < 0 ? 1 : 0;
  const word = sign * pow2(31) + expField * pow2(23) + mant;
  const value = v === 'exp' ? expField : v === 'mant' ? mant : word;
  const bits = bin(word, 32);
  return {
    params: { v, x },
    value,
    unit: D,
    decimals: 0,
    exact: true,
    question:
      v === 'exp'
        ? `IEEE-754 single precision: what is the stored (biased) exponent field, as an unsigned number, for ${fmt(x)}?`
        : v === 'mant'
          ? `IEEE-754 single precision: what is the 23-bit fraction field, as an unsigned integer, for ${fmt(x)}?`
          : `IEEE-754 single precision: what is the whole 32-bit pattern of ${fmt(x)} read as an unsigned integer?`,
    hint:
      v === 'exp'
        ? 'Normalise to 1.f × 2^e; stored exponent = e + bias, bias = 2^7−1.'
        : v === 'mant'
          ? 'Normalise to 1.f × 2^e; the field is f × 2^23 (the leading 1 is implicit).'
          : 'Assemble sign (1 bit) | biased exponent (8 bits) | fraction (23 bits).',
    explain: (a) => `${fmt(x)} = ${sign ? '−' : ''}${fmt(1 + m, 8)} × 2^${e}; exponent ${e}+127 = ${expField}, fraction ${mant} → ${a}`,
    visual: { kind: 'bits', rows: [{ label: 's|exp|fraction', bits, hi: v === 'exp' ? [1, 8] : v === 'mant' ? [9, 23] : [0, 32] }] },
    near: v === 'exp' ? [e, expField + 1, expField - 1] : v === 'mant' ? [Math.round(m * pow2(22)), mant + 1, Math.round((1 + m) * pow2(23))] : [word - pow2(23), expField * pow2(23), word + 1],
  };
});

topic('s_ring', 'software', 5, 'Ring buffer indices', (L, rng) => {
  const N = L <= 10 ? pick(rng, [8, 16, 32, 64, 100, 128, 256, 1000, 1024]) : ri(rng, 100, 100000);
  const v = pick(rng, ['adv', 'count', 'free'] as const);
  if (v === 'adv') {
    const head = ri(rng, 0, N - 1);
    const k = ri(rng, Math.floor(N / 2), 3 * N);
    return {
      params: { v, N, head, k },
      value: (head + k) % N,
      unit: 'index',
      decimals: 0,
      exact: true,
      question: `A ring buffer has ${N} slots; the write index is ${head}. After ${k} more writes (wrapping), where is the write index?`,
      hint: 'index = (head + k) mod N.',
      explain: (a) => `(${head} + ${k}) mod ${N} = ${head + k} mod ${N} = ${a}`,
      visual: { kind: 'ring', labels: { N: `${N}`, head: `${head}`, tail: '' } },
      near: [head + k, (head + k + 1) % N, (head + k) % (N - 1)],
    };
  }
  let w = ri(rng, 0, N - 1);
  const r = ri(rng, 0, N - 1);
  if (w === r) w = (w + 1) % N;
  const count = (w - r + N) % N;
  const value = v === 'count' ? count : N - 1 - count;
  return {
    params: { v, N, w, r },
    value,
    unit: v === 'count' ? 'items' : 'slots',
    decimals: 0,
    exact: true,
    question:
      v === 'count'
        ? `A ring buffer has ${N} slots: write index ${w}, read index ${r}. How many items are waiting to be read?`
        : `A ring buffer has ${N} slots (one always left empty to tell full from empty): write index ${w}, read index ${r}. How many more items can be written?`,
    hint: v === 'count' ? 'count = (write − read + N) mod N.' : 'free = N − 1 − count, with count = (write − read + N) mod N.',
    explain: (a) => `count = (${w} − ${r} + ${N}) mod ${N} = ${count}${v === 'free' ? `; free = ${N} − 1 − ${count}` : ''} = ${a}`,
    visual: { kind: 'ring', labels: { N: `${N}`, head: `${w}`, tail: `${r}` } },
    near: v === 'count' ? [Math.abs(w - r), N - count, count + 1] : [N - count, count, N - 1 - count + 1],
  };
});

topic('s_fixmul', 'software', 5, 'Q15 multiply with saturation', (L, rng) => {
  let a: number;
  let b: number;
  if (rng() < 0.15) {
    a = -32768;
    b = -32768;
  } else if (L <= 10) {
    const nice = [16384, 8192, -16384, 24576, -32768, 4096, -8192, 12288, 32767, -24576];
    a = pick(rng, nice);
    b = pick(rng, nice);
  } else {
    a = ri(rng, -32768, 32767);
    b = ri(rng, -32768, 32767);
  }
  const value = Math.max(-32768, Math.min(32767, Math.floor((a * b) / 32768)));
  return {
    params: { a, b },
    value,
    unit: D,
    decimals: 0,
    exact: true,
    question: 'Trace the Q15 multiply. What is r?',
    hint: 'Multiply in 32 bits, shift right by the fraction bits (arithmetic shift rounds toward −∞), then clamp to the int16 range.',
    explain: (x) => `${fmt(a)} × ${fmt(b)} = ${fmt(a * b)}; >> 15 = ${fmt(Math.floor((a * b) / 32768))}${Math.floor((a * b) / 32768) !== value ? ' → saturates' : ''} → ${x}`,
    visual: {
      kind: 'code',
      lines: [`int16_t a = ${a}, b = ${b};`, 'int32_t p = (int32_t)a * b;', 'p >>= 15;    /* arithmetic shift */', 'int16_t r = p > 32767 ? 32767', '          : p < -32768 ? -32768 : p;'],
    },
    near: [Math.trunc((a * b) / 32768), Math.floor((a * b) / 65536), -value],
  };
});

topic('s_bitrev', 'software', 5, 'FFT bit reversal', (L, rng) => {
  const k = L <= 10 ? ri(rng, 3, 10) : ri(rng, 8, 24);
  const N = pow2(k);
  let i = ri(rng, 1, N - 2);
  let r = Number.parseInt(bin(i, k).split('').reverse().join(''), 2);
  if (r === i) {
    i = i === 1 ? 2 : 1;
    r = Number.parseInt(bin(i, k).split('').reverse().join(''), 2);
  }
  return {
    params: { k, i },
    value: r,
    unit: 'index',
    decimals: 0,
    exact: true,
    question: `In an N = ${N}-point radix-2 FFT, input index ${i} is swapped with which bit-reversed index?`,
    hint: 'Write the index in log2(N) bits, reverse the bit order, read it back.',
    explain: (a) => `${i} = ${bin(i, k)}b → reversed ${bin(r, k)}b = ${a}`,
    visual: { kind: 'bits', rows: [{ label: `${i}`, bits: bin(i, k) }] },
    near: [N - 1 - i, Number.parseInt(bin(i, k + 1).split('').reverse().join(''), 2), (r + 1) % N],
  };
});

// ---------- T6
topic('s_budget', 'software', 6, 'Real-time data budget', (L, rng) => {
  const s = cap(L);
  const ch = pick(rng, [1, 2, 4, 8, 16]);
  const gates = ri(rng, 256, s <= 14 ? 4096 : 16384);
  const pulses = pick(rng, [16, 32, 64, 128, 256]);
  const b = pick(rng, [4, 8]);
  const cpis = ri(rng, 10, 200);
  const perCpi = ch * gates * pulses * b;
  const total = perCpi * cpis;
  const v = pick(rng, ['rate', 'util', 'maxcpi'] as const);
  const lines = [`channels      ${ch}`, `range gates   ${gates}`, `pulses/CPI    ${pulses}`, `bytes/sample  ${b}${b === 4 ? ' (int16 I+Q)' : ' (float I+Q)'}`];
  if (v === 'rate') {
    return {
      params: { v, ch, gates, pulses, b, cpis },
      value: total / 1e6,
      unit: 'MB/s',
      decimals: 1 + extra(L),
      question: `A receiver streams ${ch} channel${ch > 1 ? 's' : ''} × ${gates} range gates × ${pulses} pulses per CPI at ${b} bytes per complex sample, ${cpis} CPIs per second. What sustained data rate is that?`,
      given: ['1 MB = 10^6 bytes'],
      hint: 'Bytes per CPI = channels × gates × pulses × bytes per sample; multiply by CPIs per second.',
      explain: (a) => `${ch}×${gates}×${pulses}×${b} = ${fmt(perCpi)} B/CPI; × ${cpis} = ${fmt(total)} B/s = ${a}`,
      visual: { kind: 'table', lines: [...lines, `CPIs/s        ${cpis}`] },
      near: [(total * 8) / 1e6, perCpi / 1e6, total / 2 ** 20],
    };
  }
  const link = pick(rng, [1, 2.5, 10, 25, 40, 100]);
  if (v === 'util') {
    return {
      params: { v, ch, gates, pulses, b, cpis, link_Gbps: link },
      value: ((total * 8) / (link * 1e9)) * 100,
      unit: '%',
      decimals: 1 + extra(L),
      question: `${ch} channel${ch > 1 ? 's' : ''} × ${gates} gates × ${pulses} pulses/CPI × ${b} B/sample at ${cpis} CPIs/s over a ${fmt(link)} Gbit/s link. What percentage of the link does it use?`,
      given: ['1 Gbit/s = 10^9 bit/s'],
      hint: 'Utilisation = (bytes per second × 8) / link bit rate.',
      explain: (a) => `${fmt(total)} B/s × 8 = ${fmt(total * 8)} bit/s; / ${fmt(link * 1e9)} = ${a}`,
      visual: { kind: 'table', lines: [...lines, `CPIs/s        ${cpis}`, `link          ${fmt(link)} Gbit/s`] },
      near: [((total * 8) / (link * 1e9)) * 10, (total / (link * 1e9)) * 100, ((total * 8) / (link * 1e9)) * 50],
    };
  }
  const raw = (link * 1e9) / 8 / perCpi;
  return {
    params: { v, ch, gates, pulses, b, link_Gbps: link },
    value: Math.floor(raw + 1e-9),
    unit: 'CPIs/s',
    decimals: 0,
    exact: true,
    question: `Each CPI is ${ch} channel${ch > 1 ? 's' : ''} × ${gates} gates × ${pulses} pulses × ${b} B/sample. How many whole CPIs per second fit through a ${fmt(link)} Gbit/s link?`,
    given: ['1 Gbit/s = 10^9 bit/s'],
    hint: 'Link bytes per second / bytes per CPI, rounded down.',
    explain: (a) => `${fmt(link * 1e9)}/8 = ${fmt((link * 1e9) / 8)} B/s; / ${fmt(perCpi)} = ${fmt(raw, 3)} → ${a}`,
    visual: { kind: 'table', lines: [...lines, `link          ${fmt(link)} Gbit/s`] },
    near: [Math.floor(raw * 8), Math.ceil(raw + 1e-9) + 1, Math.floor(raw / 8)],
  };
});

topic('s_pipeline', 'software', 6, 'Pipeline latency', (L, rng) => {
  const n = ri(rng, 3, Math.min(8, 3 + Math.floor((cap(L) - 10) / 3) + 2));
  const lat = Array.from({ length: n }, () => (L <= 14 ? ri(rng, 5, 200) : ri(rng, 50, 5000) / 10));
  const K = ri(rng, 10, L <= 14 ? 10000 : 1000000);
  const sum = lat.reduce((x, y) => x + y, 0);
  const max = Math.max(...lat);
  const lines = lat.map((x, i) => `stage ${i + 1}   ${fmt(x).padStart(6)} µs`);
  if (rng() < 0.6) {
    const value = sum + (K - 1) * max;
    return {
      params: { v: 'total', lat: lat.join(','), K },
      value,
      unit: 'µs',
      decimals: L <= 14 ? 0 : 1,
      question: `A ${n}-stage pipeline (one item per stage at a time) has stage latencies ${lat.map((x) => fmt(x)).join(", ")} µs. How long until ${fmt(K)} items have all come out?`,
      hint: 'The first item takes the sum of the stages; after that one item leaves per slowest-stage time.',
      explain: (a) => `${fmt(sum)} + (${fmt(K)} − 1) × ${fmt(max)} = ${a}`,
      visual: { kind: 'pipeline', lines },
      near: [K * sum, K * max, sum + K * max],
    };
  }
  return {
    params: { v: 'rate', lat: lat.join(',') },
    value: 1e6 / max,
    unit: 'items/s',
    decimals: 1 + extra(L),
    question: `A ${n}-stage pipeline (one item per stage at a time) has stage latencies ${lat.map((x) => fmt(x)).join(", ")} µs. What is its steady-state throughput?`,
    hint: 'In steady state the slowest stage sets the pace: throughput = 1 / max stage latency.',
    explain: (a) => `1 / ${fmt(max)} µs = ${a}`,
    visual: { kind: 'pipeline', lines },
    near: [1e6 / sum, (1e6 / max) * 2, 1e6 / (sum / n)],
  };
});

topic('s_butterfly', 'software', 6, 'FFT operation counts', (L, rng) => {
  const k = ri(rng, 6, Math.min(24, 12 + Math.floor((cap(L) - 10) / 2)));
  const N = pow2(k);
  const bf = (N / 2) * k;
  const v = pick(rng, ['count', 'real', 'rate'] as const);
  if (v === 'count') {
    return {
      params: { v, k },
      value: bf,
      unit: 'butterflies',
      decimals: 0,
      exact: true,
      question: `How many butterflies does a radix-2 FFT of N = ${fmt(N)} points compute?`,
      hint: 'A radix-2 FFT has log2(N) stages of N/2 butterflies.',
      explain: (a) => `N/2 · log2 N = ${N / 2} × ${k} = ${a}`,
      near: [N * k, bf / 2, N * N],
    };
  }
  if (v === 'real') {
    return {
      params: { v, k },
      value: 4 * bf,
      unit: 'multiplies',
      decimals: 0,
      exact: true,
      question: `A radix-2 FFT of N = ${fmt(N)} points does one complex multiply per butterfly (count trivial twiddles too). How many real multiplies is that, at 4 per complex multiply?`,
      hint: 'Butterflies = log2(N) stages × N/2; then 4 real multiplies each.',
      explain: (a) => `${N / 2} × ${k} = ${bf} butterflies × 4 = ${a}`,
      near: [2 * bf, bf, 4 * N * k],
    };
  }
  const F = ri(rng, 100, 100000);
  return {
    params: { v, k, F },
    value: (bf * F) / 1e6,
    unit: 'M/s',
    decimals: 2 + extra(L),
    question: `A processor runs ${fmt(F)} radix-2 FFTs of N = ${fmt(N)} points every second. How many million butterflies per second is that?`,
    hint: 'Butterflies per FFT = N/2 · log2 N; multiply by FFTs per second.',
    explain: (a) => `${N / 2} × ${k} = ${bf}; × ${fmt(F)} = ${fmt(bf * F)} = ${a}`,
    near: [(N * k * F) / 1e6, (bf * F) / 2 ** 20, (bf * F) / 1e3],
  };
});

topic('s_dsp', 'software', 6, 'DSP core sizing', (L, rng) => {
  const s = cap(L);
  let N = 1024;
  let k = 10;
  let F = 1000;
  let ch = 1;
  let G = 10;
  let eff = 0.5;
  let raw = 1;
  for (let g = 0; g < 60; g++) {
    k = ri(rng, 10, Math.min(20, 10 + Math.floor((s - 10) / 3) + 3));
    N = pow2(k);
    F = ri(rng, 100, 20000);
    ch = ri(rng, 1, 32);
    G = pick(rng, [5, 10, 20, 50, 100]);
    eff = pick(rng, [0.25, 0.4, 0.5, 0.6]);
    raw = (5 * N * k * F * ch) / (G * 1e9 * eff);
    if (raw > 1.2 && raw < 5000 && frac(raw) > 1e-6 && frac(raw) < 1 - 1e-6) break;
  }
  const value = Math.ceil(raw);
  return {
    params: { k, F, ch, G, eff },
    value,
    unit: 'cores',
    decimals: 0,
    exact: true,
    question: `Each of ${ch} channels needs ${fmt(F)} FFTs/s of N = ${fmt(N)} points. A core peaks at ${G} GFLOPS and sustains ${fmt(eff * 100)}% of that on FFTs. How many cores are needed?`,
    given: ['FFT cost ≈ 5·N·log2(N) flops'],
    hint: 'Total flops/s = 5·N·log2 N × FFTs per second × channels; divide by the usable flops per core and round up.',
    explain: (a) => `5×${N}×${k}×${fmt(F)}×${ch} = ${fmt(5 * N * k * F * ch)} flop/s; / (${G}×10^9 × ${eff}) = ${fmt(raw, 3)} → ${a}`,
    near: [Math.ceil(raw * eff), Math.floor(raw), value + 1],
  };
});

// ---------------------------------------------------------------- assembly

/** Unit words for the "Answer in …" line; the unit string itself always appears in it. */
const UNIT_PHRASE: Record<string, string> = {
  linear: 'as a linear ratio',
  decimal: 'in decimal',
  binary: 'in binary (type the 1s and 0s)',
  speedup: 'as a speedup factor',
  index: 'as an index',
  bin: 'as a bin index',
  bucket: 'as a bucket index',
  real: 'as a real number',
};

/** Short label beside the entry field. */
export function dadUnitLabel(unit: string): string {
  return ({ linear: '×', decimal: 'dec', binary: 'bin', speedup: '×', real: '' } as Record<string, string>)[unit] ?? unit;
}

function askText(unit: string, decimals: number, exact: boolean): string {
  // every phrase contains the unit word itself
  const u = UNIT_PHRASE[unit] ?? `in ${unit}`;
  if (exact) return `Answer ${u}, exact integer.`;
  if (decimals === 0) return `Answer ${u}, to the nearest whole number.`;
  return `Answer ${u}, to ${decimals} decimal place${decimals > 1 ? 's' : ''}.`;
}

const tokens = (text: string) => text.split(/\s+/).map((t) => t.replace(/^[([{"'.,;:!?]+|[)\]}"'.,;:!?]+$/g, ''));

/** True when the hint shows the answer as a standalone number. */
export function hintLeaks(hint: string, answer: number): boolean {
  return tokens(hint).some((t) => t !== '' && /^[−-]?\d+(\.\d+)?$/.test(t) && Number(t.replace(MINUS, '-')) === answer);
}

const FALLBACK_HINT = 'Write the governing relation first, keep the units consistent, then plug in.';

function nearMisses(rng: Rng, answer: number, d: number, tol: number, exact: boolean, near: number[]): number[] {
  const out: number[] = [];
  const ok = (v: number) => {
    if (!Number.isFinite(v)) return false;
    const r = exact ? Math.round(v) : roundTo(v, d);
    if (Math.abs(r - answer) <= tol * 2 + 1e-9 || out.includes(r) || r === answer) return false;
    out.push(r);
    return true;
  };
  for (const v of near) {
    if (out.length >= 3) break;
    ok(v);
  }
  const step = exact ? 1 : Math.max(10 ** -d, Math.abs(answer) * 0.04);
  for (let g = 0; out.length < 3 && g < 40; g++) ok(answer + (rng() < 0.5 ? -1 : 1) * step * ri(rng, 2, 9));
  for (let k = 2; out.length < 3; k++) ok(answer + k * (exact ? 1 : 10 ** -d * 3));
  return out;
}

function build(t: Topic, L: number, rng: Rng): Problem {
  const b = t.make(L, rng);
  const exact = !!b.exact && Number.isInteger(b.value);
  const d = exact ? 0 : Math.max(0, Math.min(6, b.decimals));
  const answer = exact ? b.value : roundTo(b.value, d);
  const tol = exact ? 0 : 0.5 * 10 ** -d;
  const given = b.given ?? [];
  const ask = askText(b.unit, d, exact);
  const prompt = [b.question, given.length ? `Use ${given.join('; ')}.` : '', ask].filter(Boolean).join(' ');
  const label = ({ decimal: '', binary: '', index: '', bin: '', bucket: '' } as Record<string, string>)[b.unit] ?? dadUnitLabel(b.unit);
  const aStr = `${exact ? fmt(answer, 0) : fixed(answer, d)}${label ? ` ${label}` : ''}`;
  const hint = hintLeaks(b.hint, answer) ? FALLBACK_HINT : b.hint;
  const choices = [answer, ...nearMisses(rng, answer, d, tol, exact, b.near ?? [])];
  // shuffle (the contract wants shuffled choices; Dad Lab never shows them)
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  const data: ProblemData = {
    kind: 'dad',
    topic: t.id,
    category: t.category,
    params: Object.fromEntries(Object.entries(b.params).filter(([, v]) => v !== undefined)) as Record<string, number | string>,
    unit: b.unit,
    decimals: d,
    tier: t.tier,
    title: t.title,
    question: b.question,
    given,
    ask,
    ...(b.visual ? { visual: b.visual } : {}),
  };
  return {
    strand: 'word',
    level: L,
    prompt,
    answer,
    tol,
    choices,
    hint,
    explain: b.explain(aStr),
    data,
  };
}

export interface DadOpts {
  /** Never pick this topic (no back-to-back repeats). */
  avoid?: string;
  /** Force a category (tests). */
  category?: DadCategory;
  /** Force a topic id (tests, debug). */
  topic?: string;
}

/** Topic weight at a level: the newest tier is favoured; past level 10 the chained T6 topics grow more common. */
function weightAt(t: Topic, T: number, L: number): number {
  if (t.tier === T) return T === 6 ? 3 + Math.min(5, (L - 11) / 3) : 3;
  if (t.tier === T - 1) return 2;
  return 1;
}

/** One Dad-mode question at `level` (>= 1, unbounded). */
export function generateDadProblem(level: number, rng: Rng, opts: DadOpts = {}): Problem {
  const L = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  if (opts.topic) {
    const t = TOPICS.find((x) => x.id === opts.topic);
    if (t) return build(t, L, rng);
  }
  const T = dadTier(L);
  const cat: DadCategory = opts.category ?? (rng() < 0.5 ? 'radar' : 'software');
  const pool = TOPICS.filter((t) => t.category === cat && t.tier <= T && t.id !== opts.avoid);
  const t = weighted(
    rng,
    pool.map((x) => [x, weightAt(x, T, L)] as const),
  );
  return build(t, L, rng);
}

/** The sequence used inside one Dad Lab visit: never the same topic twice in a row. */
export class DadDeck {
  private last: string | undefined;
  next(level: number, rng: Rng): Problem {
    const p = generateDadProblem(level, rng, { avoid: this.last });
    this.last = p.data.kind === 'dad' ? p.data.topic : undefined;
    return p;
  }
}
