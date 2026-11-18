// Reusable mini-game widgets: big choice buttons, a number pad, a hint bubble, answer labels.
import Phaser from 'phaser';
import type { Problem } from '../types';
import { COUNT_ICONS, TEX, countIconKey, gemKey } from '../art/keys';
import type { CountIcon } from '../art/keys';
import { ENTRY_LEVEL, formatCents, formatNum, padTwo, parseFrac, parseRemainder, parseTime } from '../math/format';
import { COLOR, makeButton, textStyle, wobble, Button } from '../core/ui';

export { textStyle, addText, COLOR, FONT, wobble } from '../core/ui';

const MONEY_KINDS = new Set(['coinCount', 'coinPay', 'change', 'priceTotal']);

/** How to show a choice/answer value on screen (cents become $ amounts for money problems). */
export function choiceLabel(problem: Problem | null, v: number | string): string {
  if (problem && typeof v === 'number' && MONEY_KINDS.has(problem.data.kind)) return formatCents(v);
  if (typeof v === 'number') return formatNum(v);
  return String(v);
}

/**
 * Splits "Skip count. What number is missing?  120 , 130 , __" into an instruction
 * ("Skip count. What number is missing?") and the math part ("120, 130, __") so the
 * numbers can be drawn big. `lead` is '' when the prompt is already pure math.
 */
export function splitPrompt(prompt: string): { lead: string; math: string } {
  for (const sep of ['?', ': ']) {
    const i = prompt.indexOf(sep);
    if (i < 0) continue;
    const tail = prompt.slice(i + sep.length).trim();
    const head = prompt.slice(0, i);
    if (tail && /\d/.test(tail) && /[a-z]{2}/i.test(head)) {
      return { lead: prompt.slice(0, i + 1).trim(), math: tail.replace(/\s+,\s+/g, ', ').replace(/\s+/g, ' ') };
    }
  }
  return { lead: '', math: prompt.trim() };
}

/** Shrinks a text object uniformly so it fits in maxW x maxH. */
export function fitText(t: Phaser.GameObjects.Text, maxW: number, maxH = Infinity) {
  const k = Math.min(1, maxW / t.width, maxH / t.height);
  t.setScale(k);
  return t;
}

export interface ChoiceButtons {
  buttons: Button[];
  values: (number | string)[];
  /** "no" wobble on the button showing `value`. */
  wobble(value: number | string): void;
  /** Visually mark a button as tried (dimmed but still tappable). */
  dim(value: number | string): void;
  /** Find the button for a value (for animations). */
  find(value: number | string): Button | undefined;
  setEnabled(on: boolean): void;
  destroy(): void;
}

export interface ChoiceOpts {
  x?: number; // centre x of the row
  y?: number; // centre y of the row (or first row)
  width?: number; // total width available
  height?: number; // button height (>= 110)
  fontSize?: number; // >= 56
  columns?: number; // default: all in one row
  problem?: Problem | null; // used for labels
}

/** A row (or grid) of big answer buttons. Calls onPick(value) when tapped. */
export function makeChoiceButtons(
  scene: Phaser.Scene,
  choices: (number | string)[],
  onPick: (value: number | string) => void,
  opts: ChoiceOpts = {},
): ChoiceButtons {
  const cols = Math.max(1, opts.columns ?? choices.length);
  const width = opts.width ?? 1000;
  const h = Math.max(110, opts.height ?? 120);
  const font = Math.max(56, opts.fontSize ?? 60);
  const gap = 24;
  const bw = Math.min(300, (width - gap * (cols - 1)) / cols);
  const cx = opts.x ?? 640;
  const cy = opts.y ?? 780;
  const buttons: Button[] = [];
  choices.forEach((v, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, choices.length - row * cols);
    const rowW = inRow * bw + (inRow - 1) * gap;
    const x = cx - rowW / 2 + bw / 2 + col * (bw + gap);
    const y = cy + row * (h + gap);
    const b = makeButton(scene, x, y, bw, h, choiceLabel(opts.problem ?? null, v), () => onPick(v), font);
    buttons.push(b);
  });
  const idx = (v: number | string) => choices.findIndex((c) => String(c) === String(v));
  return {
    buttons,
    values: choices,
    wobble(v) {
      const b = buttons[idx(v)];
      if (b) wobble(scene, b.root);
    },
    dim(v) {
      const b = buttons[idx(v)];
      if (b) b.face.setTint(0x9a94b8);
    },
    find(v) {
      return buttons[idx(v)];
    },
    setEnabled(on) {
      buttons.forEach((b) => b.face.input && (b.face.input.enabled = on));
    },
    destroy() {
      buttons.forEach((b) => b.root.destroy());
    },
  };
}

// ---------------------------------------------------------------- typed answers (level 10+)

/** True when this problem must be answered by typing (no choice buttons). */
export const isEntry = (p: Problem | null | undefined): boolean => !!p && p.level >= ENTRY_LEVEL;

/** 'decimal' (Dad Lab): signed decimal numbers, keys 0-9 . − ⌫ OK in a 4 x 4 grid. */
export type PadMode = 'number' | 'fraction' | 'time' | 'remainder' | 'money' | 'decimal';

/** Monospace stack for the Dad Lab terminal look. */
export const MONO = '"Consolas","Menlo","Courier New",monospace';

/** Which entry form fits the problem's answer format. */
export function answerPadMode(p: Problem): PadMode {
  if (typeof p.answer === 'string') {
    if (/^\d+\/\d+$/.test(p.answer)) return 'fraction';
    if (/^\d+:\d{2}$/.test(p.answer)) return 'time';
    if (/^\d+\s*R\s*\d+$/i.test(p.answer)) return 'remainder';
    return 'number';
  }
  return MONEY_KINDS.has(p.data.kind) ? 'money' : 'number';
}

export interface AnswerPadOpts {
  /** Centre x of the pad (default: right column, 930 for two-field forms and 950 otherwise). */
  x?: number;
  /** Top y of the pad (default 205). */
  top?: number;
  maxDigits?: number;
  /** 'tall' = 3 x 4 keys under the display (default); 'wide' = 6 x 2 keys (number mode, for Ice Bridge). */
  layout?: 'tall' | 'wide';
  /** Draw the display box(es). Default true; Ice Bridge shows the typed number on its plank instead. */
  display?: boolean;
  /** Small caption above the display, e.g. "minutes". */
  unit?: string;
  /** The problem being answered: a money pad shows a small cents answer as "7¢" and anything else as "$1.25". */
  problem?: Problem | null;
  /** Called after every edit with the raw field strings. */
  onChange?: (fields: string[]) => void;
  /** 'terminal' = Dad Lab look: dark keys, green monospace digits. Default 'kid'. */
  theme?: 'kid' | 'terminal';
  /** Unit label drawn to the right of the display (decimal mode), e.g. "km". */
  unitSide?: string;
}

export interface AnswerPad {
  root: Phaser.GameObjects.Container;
  readonly mode: PadMode;
  /** Text shown now, e.g. "3/4", "4:05", "12 R 3", "$1.25" or "345". */
  readonly value: string;
  readonly fields: string[];
  readonly width: number;
  readonly height: number;
  clear(): void;
  wobble(): void;
  /** Fill the form with `answer` and press OK (debug/test path). Returns false if the answer does not fit this form. */
  enter(answer: number | string): boolean;
  destroy(): void;
}

const MULTI_SEP: Record<string, string> = { fraction: '/', time: ':', remainder: 'R' };

/**
 * Answer entry: whole number, fraction (n over d), time (h : mm), remainder (q R r) or money
 * ($ and cents, submits integer cents; typing 1 2 5 shows $1.25). Big keys, backspace, OK.
 * Physical keys: digits, Backspace, Enter, and "/" ":" "." "," Tab Space R switch field.
 * Tap a field to focus it. onSubmit receives the typed answer in the same format as Problem.answer.
 */
export function makeAnswerPad(
  scene: Phaser.Scene,
  mode: PadMode,
  onSubmit: (answer: number | string) => void,
  opts: AnswerPadOpts = {},
): AnswerPad {
  const multi = mode === 'fraction' || mode === 'time' || mode === 'remainder';
  const dec = mode === 'decimal';
  const term = opts.theme === 'terminal';
  const wide = opts.layout === 'wide' && !dec;
  const showDisplay = opts.display !== false;
  const maxDigits = opts.maxDigits ?? (mode === 'money' ? 6 : dec ? 14 : 7);
  const limits = mode === 'fraction' ? [3, 3] : mode === 'time' ? [2, 2] : mode === 'remainder' ? [Math.min(maxDigits, 5), 2] : [maxDigits];
  const vals = limits.map(() => '');
  let focus = 0;

  const kw = dec ? 88 : wide ? 104 : 116;
  const kh = dec ? 80 : wide ? 100 : mode === 'fraction' ? 98 : multi ? 104 : 110;
  const gap = dec ? 10 : wide ? 10 : 12;
  const cols = wide ? 6 : multi || dec ? 4 : 3;
  const rows = wide ? 2 : 4;
  const keysW = cols * kw + (cols - 1) * gap;
  const keysH = rows * kh + (rows - 1) * gap;
  const dispH = !showDisplay ? 0 : mode === 'fraction' ? 176 : dec ? 100 : multi ? 110 : 120;
  const dispGap = dispH ? 14 : 0;
  const W = keysW;
  const H = dispH + dispGap + keysH;
  const root = scene.add.container(opts.x ?? (multi ? 930 : 950), opts.top ?? 205).setDepth(12);

  // ----- display
  interface Field {
    cx: number;
    cy: number;
    w: number;
    h: number;
    text: Phaser.GameObjects.Text;
  }
  const fields: Field[] = [];
  const bg = scene.add.graphics();
  const caret = scene.add.graphics();
  root.add(bg);
  const fontSize = mode === 'fraction' ? 56 : mode === 'remainder' ? 64 : dec ? 52 : 72;
  const unitW = dec && opts.unitSide ? 104 : 0;
  if (showDisplay) {
    const geo: { cx: number; cy: number; w: number; h: number }[] = dec
      ? [{ cx: -unitW / 2, cy: 50, w: W - unitW, h: 100 }]
      : mode === 'fraction'
        ? [
            { cx: 0, cy: 38, w: 230, h: 76 },
            { cx: 0, cy: 138, w: 230, h: 76 },
          ]
        : mode === 'time'
          ? [
              { cx: -105, cy: 55, w: 150, h: 110 },
              { cx: 105, cy: 55, w: 150, h: 110 },
            ]
          : mode === 'remainder'
            ? [
                { cx: -135, cy: 55, w: 190, h: 110 },
                { cx: 145, cy: 55, w: 130, h: 110 },
              ]
            : [{ cx: 0, cy: 60, w: W, h: 120 }];
    for (const g of geo) {
      const style = term
        ? textStyle(fontSize, { fontFamily: MONO, color: '#7dff9a', stroke: '#000000', strokeThickness: 0 })
        : textStyle(fontSize, { color: '#1d1a3a', stroke: '#fff8ea', strokeThickness: 2 });
      const text = scene.add.text(g.cx, g.cy - 3, '', style).setOrigin(0.5);
      fields.push({ ...g, text });
    }
    if (unitW) {
      const u = scene.add
        .text(W / 2 - (unitW - 6) / 2, 50, opts.unitSide ?? '', textStyle(30, term ? { fontFamily: MONO, color: '#ffbf5a', stroke: '#000000', strokeThickness: 0 } : {}))
        .setOrigin(0.5);
      if (u.width > unitW - 16) u.setScale((unitW - 16) / u.width);
      root.add(u);
    }
    root.add(caret);
    fields.forEach((f) => root.add(f.text));
    if (mode === 'fraction') {
      const bar = scene.add.graphics();
      bar.fillStyle(COLOR.ink, 1).fillRoundedRect(-125, 82, 250, 12, 6);
      root.add(bar);
    } else if (mode === 'time') {
      root.add(scene.add.text(0, 50, ':', textStyle(88)).setOrigin(0.5));
    } else if (mode === 'remainder') {
      root.add(scene.add.text(2, 52, 'R', textStyle(68)).setOrigin(0.5));
    }
    if (opts.unit) root.add(scene.add.text(0, -24, opts.unit, textStyle(34, { strokeThickness: 5 })).setOrigin(0.5));
  }

  // money: an answer under $1 is typed as plain cents ("7¢"); otherwise digits fill from the right ("$1.25")
  const centsForm = mode === 'money' && !!opts.problem && typeof opts.problem.answer === 'number' && opts.problem.answer < 100;
  const shown = (i: number): string => {
    const v = vals[i];
    if (mode === 'money') {
      const c = Number(v || '0');
      if (centsForm) return `${c}¢`;
      return `$${formatNum(Math.floor(c / 100))}.${padTwo(c % 100)}`;
    }
    if (dec) return v.replace('-', '−');
    // thousands commas for plain whole-number entry only (fraction parts and "05" minutes stay raw)
    return mode === 'number' && v ? formatNum(Number(v)) : v;
  };

  const valueText = (): string => {
    switch (mode) {
      case 'fraction':
        return `${vals[0]}/${vals[1]}`;
      case 'time':
        return `${vals[0]}:${vals[1]}`;
      case 'remainder':
        return `${vals[0]} R ${vals[1]}`;
      case 'money':
        return shown(0);
      default:
        return vals[0];
    }
  };
  const inkFill = term ? 0x2bd66a : COLOR.ink;
  const faceFill = term ? 0x020604 : COLOR.cream;

  let caretOn = true;
  const drawCaret = () => {
    caret.clear();
    if (!showDisplay || !caretOn) return;
    const f = fields[focus];
    if (!f) return;
    const tw = f.text.width * f.text.scaleX;
    const x = f.cx + (vals[focus] || mode === 'money' ? tw / 2 + 5 : 0);
    caret.fillStyle(COLOR.orange, 1).fillRoundedRect(x - 2, f.cy - f.h * 0.3, 5, f.h * 0.6, 2);
  };

  const refresh = () => {
    if (showDisplay) {
      bg.clear();
      fields.forEach((f, i) => {
        const on = i === focus;
        bg.fillStyle(inkFill, 1).fillRoundedRect(f.cx - f.w / 2 - 4, f.cy - f.h / 2 - 4, f.w + 8, f.h + 8, term ? 10 : 24);
        bg.fillStyle(faceFill, 1).fillRoundedRect(f.cx - f.w / 2, f.cy - f.h / 2, f.w, f.h, term ? 8 : 20);
        if (unitW) bg.fillStyle(inkFill, term ? 0.18 : 0.12).fillRoundedRect(W / 2 - unitW + 6, f.cy - f.h / 2 - 4, unitW - 6, f.h + 8, term ? 10 : 20);
        if (on && multi) {
          bg.lineStyle(7, COLOR.orange, 1).strokeRoundedRect(f.cx - f.w / 2 + 1, f.cy - f.h / 2 + 1, f.w - 2, f.h - 2, 19);
        }
        const empty = !vals[i];
        f.text.setText(mode === 'money' || mode === 'number' || dec ? shown(i) || ' ' : vals[i] || ' ');
        f.text.setAlpha(mode === 'money' && empty ? 0.3 : 1);
        f.text.setScale(1);
        const k = Math.min(1, (f.w - 28) / Math.max(1, f.text.width));
        f.text.setScale(k);
      });
      drawCaret();
    }
    opts.onChange?.(vals.slice());
  };

  /** Moves on to the next field; `wrap` (Tab) cycles back to the first. A separator never moves back. */
  const nextField = (wrap = false) => {
    if (!multi) return;
    focus = focus === 0 ? 1 : wrap ? 0 : 1;
    refresh();
  };
  const type = (d: string) => {
    const cur = vals[focus];
    if (dec) {
      // signed decimal: "-" toggles the sign, one ".", digit count limited
      if (d === '-') vals[0] = cur.startsWith('-') ? cur.slice(1) : '-' + cur;
      else if (d === '.') {
        if (cur.includes('.')) return doWobble();
        vals[0] = cur === '' || cur === '-' ? cur + '0.' : cur + '.';
      } else {
        if (cur.replace(/[^0-9]/g, '').length >= limits[0]) return;
        vals[0] = cur === '0' ? d : cur === '-0' ? '-' + d : cur + d;
      }
      refresh();
      return;
    }
    if (cur.length >= limits[focus]) return;
    const keepZero = mode === 'time' && focus === 1;
    vals[focus] = cur === '0' && !keepZero ? d : cur + d;
    if (mode === 'time' && focus === 0 && (vals[0].length >= 2 || Number(vals[0]) >= 2)) focus = 1;
    refresh();
  };
  const back = () => {
    if (!vals[focus] && focus > 0) focus--;
    else vals[focus] = vals[focus].slice(0, -1);
    refresh();
  };
  const compose = (): number | string | null => {
    switch (mode) {
      case 'fraction':
        return vals[0] && vals[1] && Number(vals[1]) > 0 ? `${Number(vals[0])}/${Number(vals[1])}` : null;
      case 'time':
        return vals[0] && vals[1] ? `${Number(vals[0])}:${vals[1].padStart(2, '0')}` : null;
      case 'remainder':
        return vals[0] && vals[1] ? `${Number(vals[0])} R ${Number(vals[1])}` : null;
      case 'decimal': {
        const v = vals[0];
        if (!/\d/.test(v)) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      }
      default:
        return vals[0] ? Number(vals[0]) : null;
    }
  };
  function doWobble() {
    wobble(scene, root);
  }
  const ok = () => {
    const a = compose();
    if (a === null) {
      const empty = vals.findIndex((v) => !v);
      if (empty >= 0) focus = empty;
      refresh();
      doWobble();
      return;
    }
    onSubmit(a);
  };

  // ----- keys
  const keyBtn = (label: string, kx: number, ky: number, fn: () => void, size = 56, tint?: number, w = kw) => {
    const b = makeButton(scene, kx, ky, w, kh, label, fn, size, term ? (tint ?? 0x2a4a34) : tint);
    if (term) b.label.setFontFamily(MONO).setColor(tint === 0x2f8a4a ? '#eafff0' : '#9dffb0').setStroke('#000000', 0);
    root.add(b.root);
  };
  const colX = (c: number) => -W / 2 + kw / 2 + c * (kw + gap);
  const rowY = (r: number) => dispH + dispGap + kh / 2 + r * (kh + gap);
  if (dec) {
    const grid = ['7', '8', '9', '<', '4', '5', '6', '-', '1', '2', '3', '.'];
    grid.forEach((k, i) => {
      const fn = k === '<' ? back : () => type(k);
      const label = k === '<' ? '⌫' : k === '-' ? '±' : k;
      keyBtn(label, colX(i % 4), rowY(Math.floor(i / 4)), fn, 46, k === '<' || k === '-' || k === '.' ? (term ? 0x3a3a22 : 0x8fe6f2) : undefined);
    });
    keyBtn('0', colX(0), rowY(3), () => type('0'), 46);
    keyBtn('OK', (colX(1) + colX(3)) / 2, rowY(3), ok, 42, term ? 0x2f8a4a : 0x8fd18a, 3 * kw + 2 * gap);
  } else if (wide) {
    const layout = ['1', '2', '3', '4', '5', '<', '6', '7', '8', '9', '0', 'OK'];
    layout.forEach((k, i) => {
      const fn = k === '<' ? back : k === 'OK' ? ok : () => type(k);
      keyBtn(k === '<' ? '⌫' : k, colX(i % 6), rowY(Math.floor(i / 6)), fn, k === 'OK' ? 46 : 54, k === 'OK' ? 0x8fd18a : undefined);
    });
  } else {
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '<', '0', 'OK'].forEach((k, i) => {
      const fn = k === '<' ? back : k === 'OK' ? ok : () => type(k);
      keyBtn(k === '<' ? '⌫' : k, colX(i % 3), rowY(Math.floor(i / 3)), fn, k === 'OK' ? 48 : 56, k === 'OK' ? 0x8fd18a : undefined);
    });
    if (multi) keyBtn(MULTI_SEP[mode], colX(3), rowY(0), () => nextField(), 60, 0x8fe6f2);
  }

  // tap a field to focus it
  if (showDisplay && multi) {
    fields.forEach((f, i) => {
      const z = scene.add.zone(f.cx, f.cy, f.w + 12, f.h + 12).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        focus = i;
        refresh();
      });
      root.add(z);
    });
  }

  // ----- keyboard
  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (k.length === 1 && k >= '0' && k <= '9') type(k);
    else if (dec && (k === '.' || k === ',' || k === '-' || k === '−')) {
      e.preventDefault?.();
      type(k === ',' ? '.' : k === '−' ? '-' : k);
    } else if (k === 'Backspace') {
      e.preventDefault?.();
      back();
    } else if (k === 'Enter') ok();
    else if (multi && (k === '/' || k === ':' || k === '.' || k === ',' || k === 'Tab' || k === ' ' || k === 'r' || k === 'R')) {
      e.preventDefault?.();
      nextField(k === 'Tab');
    }
  };
  scene.input.keyboard?.on('keydown', onKey);
  const blink = scene.time.addEvent({
    delay: 480,
    loop: true,
    callback: () => {
      caretOn = !caretOn;
      drawCaret();
    },
  });

  const parseInto = (a: number | string): string[] | null => {
    switch (mode) {
      case 'fraction': {
        const f = typeof a === 'string' ? parseFrac(a) : null;
        return f ? [String(f[0]), String(f[1])] : null;
      }
      case 'time': {
        const t = typeof a === 'string' ? parseTime(a) : null;
        return t ? [String(t.h), padTwo(t.m)] : null;
      }
      case 'remainder': {
        const r = typeof a === 'string' ? parseRemainder(a) : null;
        return r ? [String(r.q), String(r.r)] : null;
      }
      case 'decimal': {
        const n = Number(a);
        if (!Number.isFinite(n) || String(a).trim() === '') return null;
        let s = String(n);
        if (s.includes('e')) s = n.toFixed(12).replace(/\.?0+$/, '');
        return [s];
      }
      default: {
        const n = Number(a);
        return Number.isInteger(n) && n >= 0 && String(a).trim() !== '' ? [String(n)] : null;
      }
    }
  };

  refresh();
  root.add(caret);
  return {
    root,
    mode,
    get value() {
      return valueText();
    },
    get fields() {
      return vals.slice();
    },
    width: W,
    height: H,
    clear() {
      vals.fill('');
      focus = 0;
      refresh();
    },
    wobble: doWobble,
    enter(answer) {
      const p = parseInto(answer);
      if (!p) return false;
      p.forEach((v, i) => (vals[i] = v));
      focus = vals.length - 1;
      refresh();
      ok();
      return true;
    },
    destroy() {
      scene.input.keyboard?.off('keydown', onKey);
      blink.remove();
      root.destroy();
    },
  };
}

export interface NumberPad {
  root: Phaser.GameObjects.Container;
  readonly value: string;
  clear(): void;
  wobble(): void;
  destroy(): void;
}

/** Number pad with a display, 0-9, backspace and OK (a whole-number AnswerPad). `y` is the display's centre. */
export function makeNumberPad(
  scene: Phaser.Scene,
  onSubmit: (value: number) => void,
  opts: { x?: number; y?: number; maxDigits?: number } = {},
): NumberPad {
  const pad = makeAnswerPad(scene, 'number', (v) => onSubmit(Number(v)), { x: opts.x ?? 640, top: (opts.y ?? 520) - 60, maxDigits: opts.maxDigits ?? 5 });
  return {
    root: pad.root,
    get value() {
      return pad.value;
    },
    clear: () => pad.clear(),
    wobble: () => pad.wobble(),
    destroy: () => pad.destroy(),
  };
}

// ---------------------------------------------------------------- counted pictures

export type IconObj = Phaser.GameObjects.Image | Phaser.GameObjects.Container;

const FALLBACK_FILL = [0xe8472b, 0xff8a1f, 0xd83a9a, 0x39b6d8, 0x3fa06a, 0x8a5fd8, 0xc58a4a, 0xffc93c];

/**
 * One countable thing, `size` px square, centred on (x, y). Uses the named count icon texture when it
 * exists; otherwise the old snowball / gem / star textures; otherwise a labelled coloured circle, so a
 * missing icon never shows the wrong thing.
 */
export function addCountIcon(scene: Phaser.Scene, name: string, x: number, y: number, size: number): IconObj {
  const known = (COUNT_ICONS as readonly string[]).includes(name);
  const key = known ? countIconKey(name as CountIcon) : '';
  if (key && scene.textures.exists(key)) return scene.add.image(x, y, key).setDisplaySize(size, size);
  if (name === 'snowball' && scene.textures.exists(TEX.snowball)) return scene.add.image(x, y, TEX.snowball, 0).setDisplaySize(size, size);
  if (name === 'gem' && scene.textures.exists(gemKey(3))) return scene.add.image(x, y, gemKey(3), 0).setDisplaySize(size, size);
  if (name === 'star' && scene.textures.exists(TEX.star)) return scene.add.image(x, y, TEX.star).setDisplaySize(size, size).setTint(0xffc93c);
  const c = scene.add.container(x, y).setSize(size, size);
  const fill = FALLBACK_FILL[Math.max(0, (COUNT_ICONS as readonly string[]).indexOf(name)) % FALLBACK_FILL.length];
  const disc = scene.add.circle(0, 0, size * 0.46, fill).setStrokeStyle(Math.max(2, size * 0.06), COLOR.ink);
  const label = scene.add.text(0, -1, name.slice(0, 2).toUpperCase(), textStyle(Math.max(12, size * 0.4), { strokeThickness: Math.max(2, size * 0.06) })).setOrigin(0.5);
  c.add([disc, label]);
  c.setData('disc', disc);
  return c;
}

/** Tint a count icon (image tint, or the fill of a fallback disc). */
export function tintIcon(o: IconObj, colour: number) {
  if (o instanceof Phaser.GameObjects.Image) o.setTint(colour);
  else (o.getData('disc') as Phaser.GameObjects.Arc | undefined)?.setFillStyle(colour);
}

/** Speech/hint bubble: cream rounded box with ink outline and wrapped text. Centre origin. */
export function makeBubble(scene: Phaser.Scene, x: number, y: number, s: string, maxW = 900, size = 38) {
  const root = scene.add.container(x, y);
  const t = scene.add
    .text(0, 0, s, textStyle(size, { color: '#1d1a3a', stroke: '#fff8ea', strokeThickness: 2, wordWrap: { width: maxW - 60, useAdvancedWrap: true } }))
    .setOrigin(0.5);
  const w = Math.min(maxW, t.width + 60);
  const h = t.height + 40;
  const g = scene.add.graphics();
  g.fillStyle(COLOR.cream, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 28);
  g.lineStyle(6, COLOR.ink, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 28);
  root.add([g, t]);
  root.setSize(w, h);
  return root;
}
