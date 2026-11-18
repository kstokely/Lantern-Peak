// Hidden Dad mode: every generated question is re-solved here from data.params with the textbook
// formulas, written independently of src/math/dad.ts (nothing from its helper math is imported).
import { describe, expect, it } from 'vitest';
import type { Problem } from '../src/types';
import { DAD_TOPICS, DadDeck, generateDadProblem } from '../src/math/dad';
import { makeRng } from '../src/math/rng';
import { isCorrectAnswer } from '../src/math/format';
import { effectiveDadLevel, recordDadResult } from '../src/math/adaptive';
import { createProfile, parseSave, save } from '../src/core/save';
import { session } from '../src/core/session';

const SEEDS = 300;
const LEVELS = Array.from({ length: 30 }, (_, i) => i + 1);

// ---------------------------------------------------------------- independent solver

const c = 3e8;
const lg = Math.log10;
const lambda = (fGHz: number) => c / (fGHz * 1e9);
const gcdI = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcdI(b, a % b));
const isPow2 = (n: number) => n >= 1 && (n & (n - 1)) === 0;

type P = Record<string, number | string>;

function solve(topic: string, P: P, unit: string): number {
  const n = (k: string) => {
    const v = Number(P[k]);
    if (!Number.isFinite(v)) throw new Error(`${topic}: param ${k} missing`);
    return v;
  };
  const s = (k: string) => String(P[k]);
  const B = (k: string) => BigInt(n(k));
  switch (topic) {
    // ---------------- radar
    case 'r_echo':
      return (c * n('t_us') * 1e-6) / 2 / (unit === 'km' ? 1e3 : 1);
    case 'r_lambda':
      return lambda(n('f_GHz')) * (unit === 'cm' ? 100 : 1000);
    case 'r_pri':
      return s('dir') === 'pri' ? (1 / n('prf_Hz')) * 1e6 : 1 / (n('pri_us') * 1e-6) / 1e3;
    case 'r_duty':
      return n('tau_us') * 1e-6 * n('prf_Hz') * 100;
    case 'r_avgpw':
      return n('pt_kW') * 1e3 * (n('tau_us') * 1e-6 * n('prf_Hz'));
    case 'r_ru':
      return s('dir') === 'ru' ? c / (2 * n('prf_Hz')) / 1e3 : c / (2 * n('ru_km') * 1e3);
    case 'r_rres':
      return s('mode') === 'bw' ? c / (2 * n('B_MHz') * 1e6) : (c * n('tau_us') * 1e-6) / 2;
    case 'r_db':
      switch (s('v')) {
        case 'db2lin':
          return 10 ** (n('dB') / 10);
        case 'lin2db':
          return 10 * lg(n('ratio'));
        case 'dbm2w':
          return 1e-3 * 10 ** (n('dBm') / 10);
        default:
          return 10 * lg(n('W') / 1e-3);
      }
    case 'r_pcr': {
      const bt = n('B_MHz') * 1e6 * n('tau_us') * 1e-6;
      return s('v') === 'ratio' ? bt : 10 * lg(bt);
    }
    case 'r_doppler': {
      const l = lambda(n('f_GHz'));
      return s('dir') === 'fd' ? (2 * n('v_mps')) / l / 1e3 : (n('fd_kHz') * 1e3 * l) / 2;
    }
    case 'r_vmax': {
      const l = lambda(n('f_GHz'));
      return s('v') === 'vmax' ? (l * n('prf_Hz')) / 4 : (l * n('prf_Hz')) / 2;
    }
    case 'r_dopbin': {
      const df = n('prf_Hz') / n('N');
      return s('v') === 'hz' ? df : (lambda(n('f_GHz')) * df) / 2;
    }
    case 'r_cigain':
      return s('v') === 'gain' ? 10 * lg(n('N')) : Math.ceil(10 ** (n('G_dB') / 10) - 1e-9);
    case 'r_ktb':
      return -174 + 10 * lg(n('B_Hz')) + n('NF_dB');
    case 'r_scale':
      switch (s('v')) {
        case 'pt':
          return Math.pow(n('k'), 1 / 4);
        case 'range':
          return 10 * lg(1 / n('k') ** 4);
        case 'rcs':
          return Math.pow(10 ** (-n('dB') / 10), 1 / 4);
        default:
          return Math.pow(10 ** ((2 * n('dB')) / 10), 1 / 4);
      }
    case 'r_beam': {
      const l = lambda(n('f_GHz'));
      return s('v') === 'theta' ? (70 * l) / n('D_m') : (70 * l) / n('theta_deg');
    }
    case 'r_gain': {
      const l = lambda(n('f_GHz'));
      const Ae = s('v') === 'dish' ? n('eta') * Math.PI * (n('D_m') / 2) ** 2 : n('Ae_m2');
      return 10 * lg((4 * Math.PI * Ae) / (l * l));
    }
    case 'r_xrange':
      return s('v') === 'mrad' ? n('R_km') * 1e3 * n('theta_mrad') * 1e-3 : n('R_km') * 1e3 * n('theta_deg') * (Math.PI / 180);
    case 'r_fold': {
      const ru = c / (2 * n('prf_Hz')) / 1e3;
      const k = Math.floor(n('R_km') / ru + 1e-9);
      return s('v') === 'apparent' ? n('R_km') - k * ru : k;
    }
    case 'r_fmcw': {
      const slope = (n('B_MHz') * 1e6) / (n('T_us') * 1e-6);
      return s('v') === 'fb' ? (slope * ((2 * n('R_m')) / c)) / 1e3 : (n('fb_kHz') * 1e3 * c) / (2 * slope);
    }
    case 'r_rbin': {
      const cell = c / (2 * n('fs_MSps') * 1e6);
      if (s('v') === 'size') return cell;
      if (s('v') === 'cells') return (n('W_km') * 1e3) / cell;
      return (n('fs_MSps') * 1e6) / n('prf_Hz');
    }
    case 'r_dwell': {
      const omega = (n('rpm') * 360) / 60;
      const t = n('theta_deg') / omega;
      return s('v') === 'tot' ? t * 1e3 : Math.floor(n('prf_Hz') * t + 1e-9);
    }
    case 'r_stagger': {
      const p1 = n('prf1_Hz');
      const p2 = n('prf2_Hz');
      return (lambda(n('f_GHz')) * ((p1 * p2) / gcdI(p1, p2))) / 2;
    }
    case 'r_twoprf': {
      const hits: number[] = [];
      for (let R = 0; R < n('limit_km'); R++) if (R % n('ru1_km') === n('r1_km') && R % n('ru2_km') === n('r2_km')) hits.push(R);
      if (hits.length !== 1) return NaN;
      // the PRFs (if quoted) must give those Ru values
      if (Math.abs(c / (2 * n('prf1_Hz')) / 1e3 - n('ru1_km')) > 1e-9) return NaN;
      return hits[0];
    }
    case 'r_sar': {
      if (s('v') === 'res') return n('D_m') / 2;
      const L = (lambda(n('f_GHz')) * n('R_km') * 1e3) / n('D_m');
      return s('v') === 'len' ? L : L / n('vp_mps');
    }
    case 'r_snr': {
      // the quoted log terms must be the physical values (to 0.05 dB)
      const lam = lambda(n('f_GHz'));
      const checks = [
        [n('PtdB'), 10 * lg(n('Pt_W'))],
        [n('lam20'), 20 * lg(lam)],
        [n('R40'), 40 * lg(n('R_km') * 1e3)],
        [n('kTB_dBW'), 10 * lg(1.38e-23 * 290 * n('B_MHz') * 1e6)],
        [n('fourpi30'), 30 * lg(4 * Math.PI)],
      ];
      for (const [given, real] of checks) if (Math.abs(given - real) > 0.1) return NaN;
      return n('PtdB') + 2 * n('G_dBi') + n('lam20') + n('sigma_dBsm') - n('fourpi30') - n('R40') - n('kTB_dBW') - n('NF_dB') - n('L_dB');
    }
    case 'r_prfconf': {
      const l = lambda(n('f_GHz'));
      if (s('v') === 'vmax') {
        const prf = c / (2 * n('Ru_km') * 1e3);
        return (l * prf) / 4;
      }
      if (s('v') === 'ru') {
        const prf = (4 * n('vmax_mps')) / l;
        return c / (2 * prf) / 1e3;
      }
      return (l * c) / 8 / 1e3;
    }
    case 'r_fftsize': {
      const l = lambda(n('f_GHz'));
      let N = 1;
      while ((l * n('prf_Hz')) / (2 * N) > n('dv_mps')) N *= 2;
      return s('v') === 'n' ? N : (N / n('prf_Hz')) * 1e3;
    }
    case 'r_linkrange':
      return n('R0_km') * Math.pow(10 ** ((n('S0_dB') + 10 * lg(n('k')) - n('loss_dB') - n('Sreq_dB')) / 10), 1 / 4);
    case 'r_chainbin': {
      const fd = (2 * n('v_mps')) / lambda(n('f_GHz'));
      const prf = n('prf_Hz');
      const fa = ((fd % prf) + prf) % prf;
      return Math.round(fa / (prf / n('N'))) % n('N');
    }

    // ---------------- software
    case 's_bin': {
      if (s('v') === 'b2d') return [...s('bits')].reduce((acc, ch) => acc * 2 + (ch === '1' ? 1 : 0), 0);
      let x = n('x');
      let digits = '';
      while (x > 0) {
        digits = String(x % 2) + digits;
        x = Math.floor(x / 2);
      }
      return Number(digits);
    }
    case 's_hex':
      return [...s('hex')].reduce((acc, ch) => acc * 16 + '0123456789ABCDEF'.indexOf(ch), 0);
    case 's_shift': {
      const x = B('x');
      const k = B('k');
      if (s('op') === '>>') return Number(x >> k);
      const r = x << k;
      return n('width') ? Number(BigInt.asUintN(n('width'), r)) : Number(r);
    }
    case 's_mod':
      return Number(B('a') % B('b'));
    case 's_pow2':
      return s('v') === 'pow' ? Number(1n << B('k')) : n('k');
    case 's_maxint': {
      const N = B('N');
      if (s('v') === 'umax') return Number((1n << N) - 1n);
      if (s('v') === 'smax') return Number((1n << (N - 1n)) - 1n);
      return Number(-(1n << (N - 1n)));
    }
    case 's_bitwise': {
      const w = n('w');
      const a = B('a');
      switch (s('op')) {
        case '&':
          return Number(a & B('b'));
        case '|':
          return Number(a | B('b'));
        case '^':
          return Number(a ^ B('b'));
        default:
          return Number(BigInt.asUintN(w, ~a));
      }
    }
    case 's_twos':
      return s('v') === 'decode' ? Number(BigInt.asIntN(n('w'), B('x'))) : Number(BigInt.asUintN(n('w'), B('n')));
    case 's_field':
      return Number((B('x') >> B('a')) & ((1n << B('f')) - 1n));
    case 's_intdiv':
      return s('v') === 'div' ? Number(B('a') / B('b')) : Number((B('a') / B('b')) * B('c'));
    case 's_wrap': {
      const a = B('a');
      const b = B('b');
      const r = s('op') === '+' ? a + b : s('op') === '-' ? a - b : a * b;
      return Number(BigInt.asUintN(n('w'), r));
    }
    case 's_trace':
      return trace(P);
    case 's_bsearch': {
      if (s('v') === 'maxn') return 2 ** n('k') - 1;
      // simulate the worst case of a three-way binary search on N keys
      const worst = (len: number): number => (len <= 0 ? 0 : 1 + worst(Math.max(Math.floor((len - 1) / 2), Math.ceil((len - 1) / 2))));
      return worst(n('N'));
    }
    case 's_tree': {
      if (s('v') === 'height') {
        let h = -1;
        for (let m = n('N'); m >= 1; m = Math.floor(m / 2)) h++;
        return h;
      }
      let total = 0;
      for (let d = 0; d <= n('h'); d++) total += 2 ** d;
      return s('v') === 'nodes' ? total : 2 ** n('h');
    }
    case 's_q': {
      const S = 2 ** n('q');
      if (s('v') === 'dec') return n('n') / S;
      const x = n('x') * S;
      const r = x < 0 ? -Math.round(-x) : Math.round(x);
      return s('v') === 'sat' ? Math.min(S - 1, Math.max(-S, r)) : r;
    }
    case 's_buffer': {
      if (s('v') === 'bytes') return n('N') * n('ch') * n('b');
      const Bps = n('fs_MSps') * 1e6 * n('bytes') * n('ch') * n('iq');
      return s('v') === 'rate' ? Bps / 1e6 : ((n('MiB') * 1024 * 1024) / Bps) * 1e3;
    }
    case 's_fft': {
      const df = n('fs_Hz') / n('N');
      return s('v') === 'res' ? df : s('v') === 'bin' ? n('f_Hz') / df : n('k') * df;
    }
    case 's_alias': {
      const fs = n('fs_kHz');
      const r = n('f_kHz') % fs;
      return r > fs / 2 ? fs - r : r;
    }
    case 's_endian': {
      const bytes = s('bytes').split(' ').map((h) => Number.parseInt(h, 16));
      const ordered = s('order') === 'LE' ? [...bytes].reverse() : bytes;
      return ordered.reduce((acc, b) => acc * 256 + b, 0);
    }
    case 's_struct': {
      const size: Record<string, number> = { char: 1, short: 2, int: 4, float: 4, double: 8, int64_t: 8 };
      const fields = s('fields').split(',');
      let off = 0;
      let last = 0;
      let align = 1;
      for (const f of fields) {
        const z = size[f];
        while (off % z) off++;
        last = off;
        off += z;
        align = Math.max(align, z);
      }
      while (off % align) off++;
      return s('v') === 'size' ? off : last;
    }
    case 's_hash': {
      const M = n('M');
      if (s('v') === 'mod') return n('key') % M;
      if (s('v') === 'mul') return (n('a') * n('key') + n('b')) % M;
      let h = 0;
      for (const ch of s('s')) h = (h * 31 + ch.charCodeAt(0)) % M;
      return h;
    }
    case 's_checksum': {
      const bytes = s('bytes').split(',').map(Number);
      if (s('v') === 'xor') return bytes.reduce((x, y) => x ^ y, 0);
      const sum = bytes.reduce((x, y) => x + y, 0) & 0xff;
      return s('v') === 'sum' ? sum : ~sum & 0xff;
    }
    case 's_loops': {
      const N = n('n');
      const doublings = (m: number) => {
        let k = 0;
        for (let i = 1; i < m; i *= 2) k++;
        return k;
      };
      switch (s('v')) {
        case 'tri':
          return (N * (N - 1)) / 2;
        case 'tri2':
          return (N * (N + 1)) / 2;
        case 'log':
          return doublings(N);
        case 'tri3':
          return (N * (N - 1) * (N - 2)) / 6;
        default:
          return N * doublings(N);
      }
    }
    case 's_recur': {
      const T = (m: number): number => {
        if (m === 1) return 1;
        switch (s('v')) {
          case 'msort':
            return 2 * T(m / 2) + m;
          case 'bsearch':
            return T(m / 2) + 1;
          case 'tree':
            return 2 * T(m / 2) + 1;
          default:
            return 4 * T(m / 2) + m;
        }
      };
      return T(2 ** n('k'));
    }
    case 's_amdahl': {
      const p = n('p');
      const S = (N: number) => 1 / (1 - p + p / N);
      if (s('v') === 'speedup') return S(n('N'));
      if (s('v') === 'limit') return 1 / (1 - p);
      let N = 1;
      while (S(N) < n('S')) N++;
      return N;
    }
    case 's_stride': {
      if (s('v') === 'offset') return (n('i') * n('C') + n('j')) * n('e');
      const lines = new Set<number>();
      for (let t = 0; t < n('n'); t++) lines.add(Math.floor((t * n('k') * n('e')) / 64));
      return lines.size;
    }
    case 's_ieee': {
      const dv = new DataView(new ArrayBuffer(4));
      dv.setFloat32(0, n('x'));
      const bits = dv.getUint32(0);
      if (s('v') === 'exp') return (bits >>> 23) & 0xff;
      if (s('v') === 'mant') return bits & 0x7fffff;
      return bits;
    }
    case 's_ring': {
      const N = n('N');
      if (s('v') === 'adv') return (n('head') + n('k')) % N;
      const count = (((n('w') - n('r')) % N) + N) % N;
      return s('v') === 'count' ? count : N - 1 - count;
    }
    case 's_fixmul': {
      const p = (B('a') * B('b')) >> 15n;
      return Number(p > 32767n ? 32767n : p < -32768n ? -32768n : p);
    }
    case 's_bitrev': {
      let r = 0;
      let i = n('i');
      for (let b = 0; b < n('k'); b++) {
        r = r * 2 + (i % 2);
        i = Math.floor(i / 2);
      }
      return r;
    }
    case 's_budget': {
      const perCpi = n('ch') * n('gates') * n('pulses') * n('b');
      if (s('v') === 'rate') return (perCpi * n('cpis')) / 1e6;
      if (s('v') === 'util') return ((perCpi * n('cpis') * 8) / (n('link_Gbps') * 1e9)) * 100;
      return Math.floor((n('link_Gbps') * 1e9) / 8 / perCpi + 1e-9);
    }
    case 's_pipeline': {
      const lat = s('lat').split(',').map(Number);
      const slow = Math.max(...lat);
      return s('v') === 'total' ? lat.reduce((x, y) => x + y, 0) + (n('K') - 1) * slow : 1e6 / slow;
    }
    case 's_butterfly': {
      const N = 2 ** n('k');
      const bf = (N / 2) * n('k');
      return s('v') === 'count' ? bf : s('v') === 'real' ? bf * 4 : (bf * n('F')) / 1e6;
    }
    case 's_dsp': {
      const N = 2 ** n('k');
      return Math.ceil((5 * N * n('k') * n('F') * n('ch')) / (n('G') * 1e9 * n('eff')));
    }
  }
  throw new Error(`no solver for ${topic}`);
}

/** Runs the traced snippet's semantics from its params. */
function trace(P: P): number {
  const n = (k: string) => Number(P[k]);
  switch (String(P.v)) {
    case 'sum': {
      let t = 0;
      for (let i = n('A'); i < n('B'); i += n('K')) t += i;
      return t;
    }
    case 'nested': {
      let cnt = 0;
      for (let i = 0; i < n('N'); i++) for (let j = 0; P.M === 'i' ? j <= i : j < n('M'); j++) cnt++;
      return cnt;
    }
    case 'offby1': {
      let cnt = 0;
      for (let i = n('A'); i <= n('B'); i += n('K')) cnt++;
      return cnt;
    }
    case 'array': {
      const a = String(P.arr).split(',').map(Number);
      let t = 0;
      for (let i = n('S'); i < a.length; i += n('K')) t += a[i];
      return t;
    }
    case 'fact': {
      const f = (m: bigint): bigint => (m <= 1n ? 1n : m * f(m - 1n));
      return Number(f(BigInt(n('N'))));
    }
    case 'gcd':
    case 'gcdcalls': {
      let calls = 0;
      const g = (a: number, b: number): number => {
        calls++;
        return b === 0 ? a : g(b, a % b);
      };
      const r = g(n('A'), n('B'));
      return P.v === 'gcd' ? r : calls;
    }
    case 'fib': {
      const memo = new Map<number, number>();
      const f = (m: number): number => {
        if (m < 2) return m;
        if (!memo.has(m)) memo.set(m, f(m - 1) + f(m - 2));
        return memo.get(m)!;
      };
      return f(n('N'));
    }
    case 'fibcalls': {
      const memo = new Map<number, number>();
      const calls = (m: number): number => {
        if (m < 2) return 1;
        if (!memo.has(m)) memo.set(m, 1 + calls(m - 1) + calls(m - 2));
        return memo.get(m)!;
      };
      return calls(n('N'));
    }
    case 'collatz': {
      let m = n('N');
      let steps = 0;
      while (m !== 1) {
        m = m % 2 === 1 ? 3 * m + 1 : m / 2;
        steps++;
      }
      return steps;
    }
  }
  throw new Error(`unknown trace ${String(P.v)}`);
}

// ---------------------------------------------------------------- the ladder as specified

const TIERS: Record<number, string[]> = {
  1: ['r_echo', 'r_lambda', 'r_pri', 'r_duty', 'r_avgpw', 's_bin', 's_hex', 's_shift', 's_mod', 's_pow2', 's_maxint'],
  2: ['r_ru', 'r_rres', 'r_db', 'r_pcr', 's_bitwise', 's_twos', 's_field', 's_intdiv', 's_wrap'],
  3: ['r_doppler', 'r_vmax', 'r_dopbin', 'r_cigain', 'r_ktb', 's_trace', 's_bsearch', 's_tree', 's_q'],
  4: ['r_scale', 'r_beam', 'r_gain', 'r_xrange', 'r_fold', 's_buffer', 's_fft', 's_alias', 's_endian', 's_struct', 's_hash', 's_checksum'],
  5: ['r_fmcw', 'r_rbin', 'r_dwell', 'r_stagger', 'r_twoprf', 'r_sar', 'r_snr', 's_loops', 's_recur', 's_amdahl', 's_stride', 's_ieee', 's_ring', 's_fixmul', 's_bitrev'],
  6: ['r_prfconf', 'r_fftsize', 'r_linkrange', 'r_chainbin', 's_budget', 's_pipeline', 's_butterfly', 's_dsp'],
};
const tierOfLevel = (L: number) => (L <= 10 ? Math.ceil(L / 2) : 6);
const tierOfTopic = (id: string) => Number(Object.keys(TIERS).find((t) => TIERS[Number(t)].includes(id)));

const tokens = (text: string) => text.split(/\s+/).map((t) => t.replace(/^[([{"'.,;:!?]+|[)\]}"'.,;:!?]+$/g, ''));

function dadData(p: Problem) {
  if (p.data.kind !== 'dad') throw new Error('not a dad problem');
  return p.data;
}

function checkProblem(p: Problem, L: number, ctx: string) {
  const d = dadData(p);
  const where = `${ctx} ${d.topic} ${JSON.stringify(d.params)} "${p.prompt}"`;
  expect(p.level, where).toBe(L);
  expect(typeof p.answer, where).toBe('number');
  const a = p.answer as number;
  expect(Number.isFinite(a), where).toBe(true);
  expect(typeof p.tol, where).toBe('number');
  const tol = p.tol as number;

  // independent answer
  const truth = solve(d.topic, d.params, d.unit);
  expect(Number.isFinite(truth), `${where} solver NaN`).toBe(true);
  expect(Math.abs(a - truth), `${where} answer ${a} vs ${truth}`).toBeLessThanOrEqual(tol + 1e-9 * Math.max(1, Math.abs(truth)));

  // decimals and tolerance agree; the answer is already rounded to the requested decimals
  if (tol === 0) {
    expect(d.decimals, where).toBe(0);
    expect(Number.isInteger(a), where).toBe(true);
    expect(p.prompt, where).toContain('exact integer');
  } else {
    expect(tol, where).toBeCloseTo(0.5 * 10 ** -d.decimals, 15);
    const k = a * 10 ** d.decimals;
    expect(Math.abs(k - Math.round(k)), where).toBeLessThan(1e-6 * Math.max(1, Math.abs(k)));
    if (d.decimals === 0) expect(p.prompt, where).toContain('nearest whole number');
    else expect(p.prompt, where).toContain(`to ${d.decimals} decimal place`);
  }

  // the prompt states the unit and the constants it needs
  expect(d.unit.length, where).toBeGreaterThan(0);
  expect(p.prompt, where).toContain(d.unit);
  expect(p.prompt, where).toContain('Answer');
  if ((d.given ?? []).some((g) => g.startsWith('c ='))) expect(p.prompt, where).toContain('c = 3 × 10^8 m/s');
  const usesC = /^r_(echo|lambda|ru|rres|doppler|vmax|beam|gain|fold|fmcw|stagger|sar|prfconf|fftsize|chainbin)$/.test(d.topic);
  if (usesC && !(d.topic === 'r_sar' && d.params.v === 'res')) expect(p.prompt, where).toContain('c = 3 × 10^8 m/s');

  // hint: no number equal to the answer as a standalone token; explain states it
  for (const t of tokens(p.hint)) if (/^[−-]?\d+(\.\d+)?$/.test(t)) expect(Number(t.replace('−', '-')), `${where} hint "${p.hint}"`).not.toBe(a);
  const shown = (a < 0 ? '−' : '') + (tol === 0 ? String(Math.abs(a)) : Math.abs(a).toFixed(d.decimals));
  expect(p.explain, where).toContain(shown);
  expect(p.explain.length, where).toBeGreaterThan(shown.length + 5);

  // correctness check uses the tolerance
  expect(isCorrectAnswer(p, a), where).toBe(true);
  expect(isCorrectAnswer(p, String(a)), where).toBe(true);
  expect(isCorrectAnswer(p, a + 3 * Math.max(tol, 0.5)), where).toBe(false);

  // choices: the contract field, filled with near misses that are really wrong
  expect(p.choices.length, where).toBe(4);
  expect(p.choices.filter((x) => x === a).length, where).toBe(1);
  expect(new Set(p.choices.map(String)).size, where).toBe(4);
  for (const ch of p.choices) {
    expect(typeof ch, where).toBe('number');
    expect(Number.isFinite(ch as number), where).toBe(true);
    if (ch !== a) expect(isCorrectAnswer(p, ch), `${where} choice ${ch}`).toBe(false);
  }

  // tier never above the level's tier; category matches the topic prefix
  expect(tierOfTopic(d.topic), where).toBeLessThanOrEqual(tierOfLevel(L));
  expect(d.category, where).toBe(d.topic.startsWith('r_') ? 'radar' : 'software');
}

// ---------------------------------------------------------------- tests

describe('Dad mode generator', () => {
  it('catalogue matches the specified ladder', () => {
    const cat = DAD_TOPICS();
    const fromSpec = Object.entries(TIERS).flatMap(([t, ids]) => ids.map((id) => `${id}@${t}`));
    expect(cat.map((t) => `${t.id}@${t.tier}`).sort()).toEqual(fromSpec.sort());
  });

  it(`re-solves every problem, levels 1..30 x ${SEEDS} seeds`, () => {
    for (const L of LEVELS) {
      const cats = new Set<string>();
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateDadProblem(L, makeRng(seed * 7919 + L * 104729));
        checkProblem(p, L, `L${L} seed${seed}`);
        cats.add(dadData(p).category);
      }
      expect([...cats].sort(), `L${L}`).toEqual(['radar', 'software']);
    }
  });

  it('every topic of tiers T1-T5 appears at its own tier levels, T6 from level 11', () => {
    for (let t = 1; t <= 6; t++) {
      const levels = t <= 5 ? [2 * t - 1, 2 * t] : [11, 12];
      const seen = new Set<string>();
      for (const L of levels) for (let seed = 1; seed <= SEEDS; seed++) seen.add(dadData(generateDadProblem(L, makeRng(seed * 31 + L))).topic);
      for (const id of TIERS[t]) expect(seen.has(id), `T${t} ${id}`).toBe(true);
    }
  });

  it('roughly half radar, half software', () => {
    for (const L of [1, 6, 15, 30]) {
      let radar = 0;
      for (let seed = 1; seed <= 1000; seed++) if (dadData(generateDadProblem(L, makeRng(seed))).category === 'radar') radar++;
      expect(radar, `L${L}`).toBeGreaterThan(420);
      expect(radar, `L${L}`).toBeLessThan(580);
    }
  });

  it('no topic repeats back-to-back through the mini-game path (DadDeck)', () => {
    for (const L of LEVELS) {
      for (let seed = 1; seed <= 60; seed++) {
        const deck = new DadDeck();
        const rng = makeRng(seed * 13 + L);
        let last = '';
        for (let i = 0; i < 12; i++) {
          const t = dadData(deck.next(L, rng)).topic;
          expect(t, `L${L} seed${seed} step${i}`).not.toBe(last);
          last = t;
        }
      }
    }
  });

  it('levels have no cap (level 500 still generates valid problems)', () => {
    for (let seed = 1; seed <= 200; seed++) checkProblem(generateDadProblem(500, makeRng(seed)), 500, `L500 seed${seed}`);
  });

  // ---- harder levels: bigger numbers, tighter rounding
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const sample = (topic: string, L: number, f: (p: Problem) => number | null, count = 300) => {
    const out: number[] = [];
    for (let seed = 1; seed <= count; seed++) {
      const v = f(generateDadProblem(L, makeRng(seed * 17 + L), { topic }));
      if (v !== null) out.push(v);
    }
    return mean(out);
  };

  it('harder levels use larger / more complex parameters', () => {
    const bits = (L: number) => sample('s_bin', L, (p) => (dadData(p).params.v === 'b2d' ? String(dadData(p).params.bits).length : null));
    expect(bits(1)).toBeLessThan(bits(5));
    expect(bits(5)).toBeLessThan(bits(20));
    const width = (L: number) => sample('s_maxint', L, (p) => Number(dadData(p).params.N));
    expect(width(1)).toBeLessThan(width(4));
    expect(width(4)).toBeLessThan(width(15));
    const loopEnd = (L: number) => sample('s_trace', L, (p) => (dadData(p).params.v === 'sum' ? Number(dadData(p).params.B) : null), 600);
    expect(loopEnd(5)).toBeLessThan(loopEnd(20));
    const hexDigits = (L: number) => sample('s_hex', L, (p) => String(dadData(p).params.hex).length);
    expect(hexDigits(1)).toBeLessThan(hexDigits(6));
    expect(hexDigits(6)).toBeLessThan(hexDigits(25));
    const loops = (L: number) => sample('s_loops', L, (p) => Number(dadData(p).params.n));
    expect(loops(9)).toBeLessThan(loops(15));
  });

  it('rounding tightens past level 10', () => {
    const dec = (topic: string, L: number) => sample(topic, L, (p) => dadData(p).decimals);
    for (const topic of ['r_echo', 'r_lambda', 'r_doppler', 'r_dopbin', 'r_fmcw']) {
      const lo = TIERS[1].includes(topic) ? 1 : topic === 'r_doppler' || topic === 'r_dopbin' ? 5 : 9;
      expect(dec(topic, 20), topic).toBeGreaterThan(dec(topic, lo));
      expect(dec(topic, 30), topic).toBeGreaterThanOrEqual(dec(topic, 20));
    }
  });

  it('chained T6 topics get more common as the level climbs', () => {
    const share = (L: number) => {
      let n6 = 0;
      for (let seed = 1; seed <= 1000; seed++) if (TIERS[6].includes(dadData(generateDadProblem(L, makeRng(seed))).topic)) n6++;
      return n6;
    };
    expect(share(11)).toBeGreaterThan(0);
    expect(share(30)).toBeGreaterThan(share(11));
  });

  it('fixed physics sanity checks (solver and generator agree)', () => {
    // solver: textbook values
    expect(solve('r_echo', { t_us: 1 }, 'm')).toBeCloseTo(150, 9); // 1 µs round trip = 150 m
    expect(solve('r_ru', { dir: 'ru', prf_Hz: 1000 }, 'km')).toBeCloseTo(150, 9); // PRF 1 kHz -> Ru 150 km
    expect(solve('r_rres', { mode: 'bw', B_MHz: 150 }, 'm')).toBeCloseTo(1, 12); // 150 MHz -> 1 m
    expect(solve('r_lambda', { f_GHz: 10 }, 'cm')).toBeCloseTo(3, 12); // X band 10 GHz -> 3 cm
    expect(solve('r_doppler', { dir: 'fd', f_GHz: 10, v_mps: 150 }, 'kHz')).toBeCloseTo(10, 9); // 150 m/s at 3 cm -> 10 kHz
    expect(solve('r_vmax', { v: 'vmax', f_GHz: 10, prf_Hz: 4000 }, 'm/s')).toBeCloseTo(30, 9);
    expect(solve('r_ktb', { B_Hz: 1e6, NF_dB: 3 }, 'dBm')).toBeCloseTo(-111, 9);
    expect(solve('r_scale', { v: 'pt', k: 16 }, 'linear')).toBeCloseTo(2, 12);
    expect(solve('s_ieee', { v: 'exp', x: 1 }, 'decimal')).toBe(127);
    expect(solve('s_ieee', { v: 'word', x: 1 }, 'decimal')).toBe(1065353216);
    expect(solve('s_q', { v: 'enc', q: 15, x: 0.5 }, 'decimal')).toBe(16384);
    expect(solve('s_twos', { v: 'decode', x: 0xf6, w: 8 }, 'decimal')).toBe(-10);
    expect(solve('s_bsearch', { v: 'worst', N: 1000 }, 'probes')).toBe(10);
    expect(solve('s_recur', { v: 'msort', k: 3 }, 'decimal')).toBe(32);

    // generator: the same cases when they come up
    const find = (topic: string, L: number, match: (p: Record<string, number | string>) => boolean) => {
      for (let seed = 1; seed < 20000; seed++) {
        const p = generateDadProblem(L, makeRng(seed), { topic });
        if (match(dadData(p).params)) return p;
      }
      throw new Error(`no ${topic} case found`);
    };
    const ru = find('r_ru', 3, (q) => q.dir === 'ru' && q.prf_Hz === 1000);
    expect(ru.answer).toBe(150);
    expect(dadData(ru).unit).toBe('km');
    const lam = find('r_lambda', 1, (q) => q.f_GHz === 10);
    expect(lam.answer).toBe(3);
    expect(dadData(lam).unit).toBe('cm');
    const rr = find('r_rres', 3, (q) => q.mode === 'bw' && q.B_MHz === 150);
    expect(rr.answer).toBe(1);
    const fd = find('r_doppler', 5, (q) => q.dir === 'fd' && q.f_GHz === 10 && q.v_mps === 150);
    expect(fd.answer).toBe(10);
    expect(dadData(fd).unit).toBe('kHz');
    for (let seed = 1; seed < 20000; seed++) {
      const p = generateDadProblem(1, makeRng(seed), { topic: 'r_echo' });
      if (dadData(p).unit === 'm') {
        expect(p.answer).toBe(150 * Number(dadData(p).params.t_us));
        break;
      }
    }
  });

  it('closed-form loop counts match brute force for small n', () => {
    for (let N = 3; N <= 40; N++) {
      let tri = 0;
      let tri2 = 0;
      let tri3 = 0;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < i; j++) {
          tri++;
          for (let k = 0; k < j; k++) tri3++;
        }
        for (let j = i; j < N; j++) tri2++;
      }
      expect(solve('s_loops', { v: 'tri', n: N }, 'calls')).toBe(tri);
      expect(solve('s_loops', { v: 'tri2', n: N }, 'calls')).toBe(tri2);
      expect(solve('s_loops', { v: 'tri3', n: N }, 'calls')).toBe(tri3);
    }
    expect(isPow2(1024)).toBe(true);
  });
});

describe('answer tolerance', () => {
  it('tol accepts within half a unit of the last digit, rejects beyond', () => {
    const p = { answer: 2.5, tol: 0.05 };
    expect(isCorrectAnswer(p, 2.5)).toBe(true);
    expect(isCorrectAnswer(p, 2.54)).toBe(true);
    expect(isCorrectAnswer(p, '2.46')).toBe(true);
    expect(isCorrectAnswer(p, 2.56)).toBe(false);
    expect(isCorrectAnswer(p, '')).toBe(false);
    expect(isCorrectAnswer({ answer: -12, tol: 0 }, -12)).toBe(true);
    expect(isCorrectAnswer({ answer: -12, tol: 0 }, -12.4)).toBe(false);
  });

  it('without tol the old exact behaviour is unchanged', () => {
    expect(isCorrectAnswer({ answer: 2.5 }, 2.5000001)).toBe(false);
    expect(isCorrectAnswer({ answer: 7 }, '7')).toBe(true);
    expect(isCorrectAnswer({ answer: '3/4', accept: ['6/8'] }, '6/8')).toBe(true);
  });
});

describe('Dad progression and save', () => {
  it('+1 after 3 first-try rights, -1 after 2 missed problems, floor 1, no cap', () => {
    let p = { level: 1, streak: 0, misses: 0 };
    for (let i = 0; i < 2; i++) p = recordDadResult(p, true).progress;
    expect(p.level).toBe(1);
    const up = recordDadResult(p, true);
    expect(up.change).toBe(1);
    expect(up.progress.level).toBe(2);
    let hi = { level: 999, streak: 2, misses: 0 };
    hi = recordDadResult(hi, true).progress;
    expect(hi.level).toBe(1000);
    let lo = { level: 1, streak: 0, misses: 1 };
    const r = recordDadResult(lo, false);
    expect(r.progress.level).toBe(1);
    expect(r.change).toBe(0);
    lo = { level: 5, streak: 0, misses: 0 };
    lo = recordDadResult(lo, false).progress;
    expect(lo.level).toBe(5);
    lo = recordDadResult(lo, false).progress;
    expect(lo.level).toBe(4);
    // a right answer resets the miss count
    lo = recordDadResult(recordDadResult(lo, false).progress, true).progress;
    expect(recordDadResult(lo, false).progress.level).toBe(4);
  });

  it('camp offsets add to the Dad level without a cap', () => {
    expect(effectiveDadLevel(1, 0)).toBe(1);
    expect(effectiveDadLevel(7, 2)).toBe(8);
    expect(effectiveDadLevel(40, 4)).toBe(42);
  });

  it('save: dadMode is sanitised, migration-safe and absent on kid profiles', () => {
    const base = { id: 'p1', name: 'Dad', grade: 4, purse: 3, zones: [] };
    const kid = parseSave(JSON.stringify({ version: 2, profiles: [base] })).profiles[0];
    expect(kid.dadMode).toBeUndefined();
    expect(kid.dad).toBeUndefined(); // an existing "Dad" is not converted
    const dad = parseSave(JSON.stringify({ version: 2, profiles: [{ ...base, dadMode: true, dad: { level: 57, streak: 2, misses: 1 } }] })).profiles[0];
    expect(dad.dadMode).toBe(true);
    expect(dad.dad).toEqual({ level: 57, streak: 2, misses: 1 });
    expect(dad.grade).toBe(4);
    const junk = parseSave(JSON.stringify({ version: 2, profiles: [{ ...base, dadMode: true, dad: { level: -3, streak: 'x' } }] })).profiles[0];
    expect(junk.dad).toEqual({ level: 1, streak: 0, misses: 0 });
    const notTrue = parseSave(JSON.stringify({ version: 2, profiles: [{ ...base, dadMode: 'yes' }] })).profiles[0];
    expect(notTrue.dadMode).toBeUndefined();
    // v1 file with a dad flag still migrates
    const v1 = parseSave(JSON.stringify({ version: 1, profiles: [{ ...base, dadMode: true, zones: [{ presents: [true, true, false, false] }] }] })).profiles[0];
    expect(v1.dadMode).toBe(true);
    expect(v1.zones[0].presents.length).toBe(6);
  });

  it('session records Dad answers on the Dad ladder and pays first-try gems', () => {
    const before = save.profiles.slice();
    save.profiles = [];
    try {
      const p = createProfile('Dad', 4, 0, { dadMode: true })!;
      session.select(p.id);
      expect(session.dadMode).toBe(true);
      expect(session.dadLevel()).toBe(1);
      for (let i = 0; i < 3; i++) session.recordDadAnswer(true);
      expect(session.dadLevel()).toBe(2);
      expect(session.dadLevelIn(4)).toBe(4);
      expect(session.p.purse).toBe(6);
      expect(session.p.strands.counting.level).toBe(10); // kids' strands untouched
      const k = createProfile('Kid', 1, 1)!;
      expect(k.dadMode).toBeUndefined();
    } finally {
      save.profiles = before;
      session.clear();
    }
  });
});
