// Pie Share: Pip the snow hare runs a berry-pie stand. Slice, name, compare and add fractions.
import Phaser from 'phaser';
import { miniGameSceneKey, Problem, Frac } from '../types';
import { friendKey } from '../art/keys';
import { MiniGameScene, WrongKind } from './base';
import { parseFrac } from '../math/format';
import { COLOR, addText, makeButton, starBurst, textStyle, wobble, Button } from '../core/ui';
import { AnswerPad, answerPadMode, fitText, isEntry, makeAnswerPad } from './widgets';

const PIP_X = 150;
const PIP_Y = 650;

const BERRY = 0xd83a9a;
const BERRY_DARK = 0x8f1d6b;
const BERRY_LIGHT = 0xff8fcf;
const CRUST = 0xc58a4a;
const CRUST_LIGHT = 0xeec07a;
const FILLING_EMPTY = 0xfff8ea;

type Shape = 'pie' | 'bar';

interface ShapeView {
  g: Phaser.GameObjects.Graphics;
  cx: number;
  cy: number;
  /** pie: radius. bar: width. */
  size: number;
  /** bar height (bar only) */
  h: number;
  kind: Shape;
  d: number;
  filled: boolean[];
  redraw(): void;
}

interface Choice {
  value: number | string;
  btn: Button;
}

const isShape = (s: string): s is Shape => s === 'pie' || s === 'bar';

/** Draws one pie / bar / 10x10 grid into g from the view's current `filled` flags. */
function drawShape(v: ShapeView) {
  const { g, cx, cy, d, filled } = v;
  g.clear();
  if (d >= 100) {
    // tenths / hundredths: 10 x 10 grid
    const cell = (v.kind === 'bar' ? v.size : v.size * 1.7) / 10;
    const x0 = cx - cell * 5;
    const y0 = cy - cell * 5;
    g.fillStyle(COLOR.ink, 1).fillRoundedRect(x0 - 6, y0 - 6, cell * 10 + 12, cell * 10 + 12, 10);
    for (let i = 0; i < 100; i++) {
      g.fillStyle(filled[i] ? BERRY : FILLING_EMPTY, 1).fillRect(x0 + (i % 10) * cell, y0 + Math.floor(i / 10) * cell, cell, cell);
    }
    g.lineStyle(2, COLOR.ink, 0.9);
    for (let k = 0; k <= 10; k++) {
      g.lineBetween(x0 + k * cell, y0, x0 + k * cell, y0 + cell * 10);
      g.lineBetween(x0, y0 + k * cell, x0 + cell * 10, y0 + k * cell);
    }
    return;
  }
  if (v.kind === 'bar') {
    const w = v.size;
    const h = v.h;
    const x0 = cx - w / 2;
    const y0 = cy - h / 2;
    g.fillStyle(COLOR.ink, 1).fillRoundedRect(x0 - 7, y0 - 7, w + 14, h + 14, 16);
    const pw = w / d;
    for (let i = 0; i < d; i++) {
      const on = !!filled[i];
      const base = on ? BERRY : 0x8a5530;
      const lite = on ? BERRY_LIGHT : CRUST;
      const dark = on ? BERRY_DARK : 0x5a3320;
      const x = x0 + i * pw;
      g.fillStyle(dark, 1).fillRect(x, y0, pw, h);
      g.fillStyle(base, 1).fillRect(x + 3, y0 + 3, pw - 6, h - 6);
      g.fillStyle(lite, 1).fillRect(x + 3, y0 + 3, pw - 6, Math.max(4, h * 0.12));
      g.fillStyle(lite, 0.55).fillRect(x + 3, y0 + 3, Math.max(4, pw * 0.1), h - 6);
    }
    g.lineStyle(4, COLOR.ink, 1);
    for (let i = 1; i < d; i++) g.lineBetween(x0 + i * pw, y0, x0 + i * pw, y0 + h);
    g.strokeRoundedRect(x0, y0, w, h, 8);
    return;
  }
  // pie
  const R = v.size;
  const ri = R * 0.86;
  g.fillStyle(0x3b3a7a, 0.3).fillEllipse(cx, cy + R + 8, R * 1.7, R * 0.2);
  g.fillStyle(COLOR.ink, 1).fillCircle(cx, cy, R + 5);
  g.fillStyle(CRUST, 1).fillCircle(cx, cy, R);
  g.fillStyle(CRUST_LIGHT, 1).fillCircle(cx - R * 0.03, cy - R * 0.03, R * 0.93);
  g.fillStyle(CRUST, 1).fillCircle(cx, cy, R * 0.89);
  g.lineStyle(3, COLOR.woodDark, 0.5);
  const bumps = Math.max(12, Math.round(R / 7));
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2;
    g.lineBetween(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9, cx + Math.cos(a) * R * 0.99, cy + Math.sin(a) * R * 0.99);
  }
  const step = (Math.PI * 2) / d;
  const top = -Math.PI / 2;
  for (let i = 0; i < d; i++) {
    g.fillStyle(filled[i] ? BERRY : FILLING_EMPTY, 1);
    g.slice(cx, cy, ri, top + i * step, top + (i + 1) * step, false);
    g.fillPath();
  }
  // berries on shaded slices
  for (let i = 0; i < d; i++) {
    if (!filled[i]) continue;
    const mid = top + (i + 0.5) * step;
    const spots: [number, number][] = step > 0.9 ? [[0.35, -0.2], [0.6, 0.18], [0.75, -0.12], [0.52, 0]] : step > 0.5 ? [[0.45, 0], [0.72, 0.1]] : [[0.62, 0]];
    for (const [rr, off] of spots) {
      const a = mid + off * step;
      const bx = cx + Math.cos(a) * ri * rr;
      const by = cy + Math.sin(a) * ri * rr;
      const br = Math.max(4, Math.min(R * 0.07, ri * rr * Math.sin(step / 2) * 0.5));
      g.fillStyle(BERRY_DARK, 1).fillCircle(bx, by, br);
      g.fillStyle(BERRY_LIGHT, 1).fillCircle(bx - br * 0.3, by - br * 0.3, br * 0.35);
    }
  }
  g.lineStyle(Math.max(3, R / 40), COLOR.ink, 1);
  if (d > 1) {
    for (let i = 0; i < d; i++) {
      const a = top + i * step;
      g.lineBetween(cx, cy, cx + Math.cos(a) * ri, cy + Math.sin(a) * ri);
    }
  }
  g.strokeCircle(cx, cy, ri);
}

export class PieShareScene extends MiniGameScene {
  protected readonly title = 'Pie Share';
  private pip!: Phaser.GameObjects.Image;
  private roundObjs: Phaser.GameObjects.GameObject[] = [];
  private shapes: ShapeView[] = [];
  private choices: Choice[] = [];
  private picked: Choice | null = null;
  private signText: Phaser.GameObjects.Text | null = null;
  private showShape: ShapeView | null = null;
  private serveBtn: Button | null = null;
  private pad: AnswerPad | null = null;
  /** Level 10+: answers are typed on a pad in the right column; pictures move to the left. */
  private entry = false;
  private pipShadow: Phaser.GameObjects.Graphics | null = null;
  private missingNum: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: miniGameSceneKey('pieShare') });
  }

  protected setupGame() {
    this.roundObjs = [];
    this.shapes = [];
    this.choices = [];
    const sh = this.add.graphics();
    sh.fillStyle(0x3b3a7a, 0.35).fillEllipse(PIP_X, PIP_Y - 4, 150, 28);
    this.pipShadow = sh;
    this.pip = this.add.image(PIP_X, PIP_Y, friendKey('pip'), 0).setOrigin(0.5, 1).setScale(0.92).setDepth(5);
  }

  protected hintAnchor() {
    return this.pad && !this.showShape ? { x: 370, y: 745 } : { x: 640, y: 236 };
  }

  protected hintWidth() {
    return this.pad && !this.showShape ? 600 : 1000;
  }

  // ---------- helpers ----------
  /** A stacked fraction (numerator over a bar over denominator), centred on (0,0) in a container. */
  private stacked(x: number, y: number, n: number | string, d: number, size: number, colour = '#fff8ea'): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const nt = this.add.text(0, 0, String(n), textStyle(size, { color: colour })).setOrigin(0.5, 1);
    const dt = this.add.text(0, 0, String(d), textStyle(size, { color: colour })).setOrigin(0.5, 0);
    const lh = Math.max(6, Math.round(size / 9));
    const gap = Math.round(size * 0.04);
    nt.y = -lh / 2 - gap + size * 0.12;
    dt.y = lh / 2 + gap - size * 0.12;
    const w = Math.max(nt.width, dt.width, size * 0.6) + 16;
    const bar = this.add.graphics();
    bar.fillStyle(COLOR.ink, 1).fillRoundedRect(-w / 2 - 3, -lh / 2 - 3, w + 6, lh + 6, 6);
    bar.fillStyle(0xfff8ea, 1).fillRoundedRect(-w / 2, -lh / 2, w, lh, 4);
    c.add([nt, dt, bar]);
    c.setSize(w, size * 2.1);
    return c;
  }

  /** Width a stacked fraction at this size will take. */
  private stackedW(n: number, d: number, size: number) {
    const digits = Math.max(String(n).length, String(d).length);
    return Math.max(digits * size * 0.58, size * 0.6) + 16;
  }

  /** "Fill  3/4  of the pie." style row: texts and stacked fractions centred around x. */
  private promptRow(parts: (string | Frac)[], y: number, size = 52, cx = 640, maxW = 1000) {
    const items: { w: number; make: (x: number) => Phaser.GameObjects.GameObject }[] = [];
    for (const p of parts) {
      if (typeof p === 'string') {
        const t = this.add.text(0, y, p, textStyle(size)).setOrigin(0.5);
        items.push({ w: t.width, make: (x) => (t.setX(x), t) });
      } else {
        items.push({ w: this.stackedW(p[0], p[1], size * 0.85), make: (x) => this.stacked(x, y, p[0], p[1], size * 0.85) });
      }
    }
    const gap = 20;
    const total = items.reduce((s, i) => s + i.w, 0) + gap * (items.length - 1);
    const k = Math.min(1, maxW / total);
    let x = cx - (total * k) / 2;
    for (const it of items) {
      const o = it.make(x + (it.w * k) / 2) as Phaser.GameObjects.Container;
      (o as any).setScale?.(k);
      this.roundObjs.push(o);
      x += (it.w + gap) * k;
    }
  }

  private plainPrompt(s: string, size = 52) {
    if (this.entry) {
      const e = this.add.text(370, 245, s, textStyle(Math.min(size, 44), { wordWrap: { width: 560, useAdvancedWrap: true } })).setOrigin(0.5);
      this.roundObjs.push(fitText(e, 580, 120));
      return;
    }
    const t = this.add.text(640, 225, s, textStyle(size, { wordWrap: { width: 1000, useAdvancedWrap: true } })).setOrigin(0.5);
    this.roundObjs.push(fitText(t, 1000, 100));
  }

  private makeShape(kind: Shape, cx: number, cy: number, size: number, d: number, filledCount = 0, h = 150): ShapeView {
    const g = this.add.graphics();
    const v: ShapeView = {
      g,
      cx,
      cy,
      size,
      h,
      kind,
      d,
      filled: Array.from({ length: Math.max(d, 1) }, (_, i) => i < filledCount),
      redraw() {
        drawShape(v);
      },
    };
    v.redraw();
    this.roundObjs.push(g);
    this.shapes.push(v);
    return v;
  }

  private buildChoiceButtons(values: (number | string)[], opts: { width?: number; height?: number; y?: number; render: (b: Button, v: number | string, w: number, h: number) => void }) {
    const n = values.length;
    const gap = 22;
    const w = Math.min(opts.width ?? 250, (1060 - gap * (n - 1)) / n);
    const h = opts.height ?? 170;
    const y = opts.y ?? 775;
    const x0 = 640 - ((n - 1) * (w + gap)) / 2;
    values.forEach((v, i) => {
      const btn = makeButton(this, x0 + i * (w + gap), y, w, h, '', () => this.pick(v), 60);
      opts.render(btn, v, w, h);
      this.choices.push({ value: v, btn });
    });
  }

  private fracChoices(values: (number | string)[], withPie = false) {
    this.buildChoiceButtons(values, {
      width: withPie ? 255 : 230,
      height: withPie ? 180 : 170,
      y: withPie ? 770 : 775,
      render: (btn, v) => {
        const f = parseFrac(String(v));
        if (!f) {
          btn.setLabel(String(v));
          return;
        }
        if (withPie) {
          const g = this.add.graphics();
          const view: ShapeView = { g, cx: -62, cy: 0, size: 44, h: 0, kind: 'pie', d: f[1], filled: Array.from({ length: f[1] }, (_, i) => i < f[0]), redraw() {} };
          drawShape(view);
          btn.root.add(g);
          btn.root.add(this.stacked(52, 0, f[0], f[1], 52));
        } else {
          btn.root.add(this.stacked(0, 0, f[0], f[1], 58));
        }
      },
    });
  }

  private signChoices(values: (number | string)[]) {
    this.buildChoiceButtons(values, {
      width: 230,
      height: 130,
      y: 790,
      render: (btn, v) => {
        btn.setLabel(String(v));
        btn.label.setFontSize(84);
      },
    });
  }

  // ---------- build ----------
  protected buildRound(problem: Problem, _area: Phaser.Geom.Rectangle) {
    const d = problem.data;
    this.picked = null;
    this.signText = null;
    this.showShape = null;
    this.missingNum = null;
    this.pad = null;
    this.entry = isEntry(problem) && d.kind !== 'fracShow';
    // typed layouts keep the picture on the left, so Pip steps down into the corner
    this.pipShadow?.setVisible(!this.entry);
    if (this.entry) this.pip.setPosition(110, 860).setScale(0.5);
    else this.pip.setPosition(PIP_X, PIP_Y).setScale(0.92);
    this.pip.setFrame(1);
    this.time.delayedCall(900, () => this.pip?.active && this.pip.setFrame(0));
    switch (d.kind) {
      case 'fracShow': {
        const noun = isShape(d.shape) ? (d.shape === 'bar' ? 'chocolate bar' : 'pie') : 'pie';
        this.promptRow(['Fill', d.frac, `of the ${noun}.`], 232, 54);
        const sv = d.shape === 'bar' ? this.makeShape('bar', 660, 480, 780, d.frac[1], 0, 190) : this.makeShape('pie', 660, 490, 185, d.frac[1]);
        this.showShape = sv;
        const hit =
          d.shape === 'bar'
            ? this.add.zone(sv.cx, sv.cy, sv.size + 10, sv.h + 10).setInteractive({ useHandCursor: true })
            : this.add.zone(sv.cx, sv.cy, sv.size * 2 + 10, sv.size * 2 + 10).setInteractive({ useHandCursor: true });
        this.roundObjs.push(hit);
        hit.on('pointerdown', (p: Phaser.Input.Pointer) => this.tapSlice(sv, p));
        const serve = makeButton(this, 640, 790, 320, 120, 'Serve', () => this.serve(), 64);
        this.roundObjs.push(serve.root);
        this.serveBtn = serve;
        break;
      }
      case 'fracName': {
        this.plainPrompt(d.shape === 'bar' ? 'What fraction of the chocolate bar is shaded?' : 'What fraction of the pie is shaded?', 46);
        if (this.entry) {
          if (d.shape === 'bar') this.makeShape('bar', 370, 500, 520, d.frac[1], d.frac[0], 150);
          else this.makeShape('pie', 370, 500, 150, d.frac[1], d.frac[0]);
          this.makePad(problem);
          break;
        }
        if (d.shape === 'bar') this.makeShape('bar', 660, 460, 780, d.frac[1], d.frac[0], 170);
        else this.makeShape('pie', 660, 462, 170, d.frac[1], d.frac[0]);
        this.fracChoices(problem.choices);
        break;
      }
      case 'fracCompare': {
        this.plainPrompt('Which sign goes in the middle?', 50);
        const xs = [430, 870];
        const mk = (f: Frac, x: number) => {
          this.makeShape('pie', x, 420, 135, f[1], f[0]);
          this.roundObjs.push(this.stacked(x, 625, f[0], f[1], 54));
        };
        mk(d.a, xs[0]);
        mk(d.b, xs[1]);
        this.signText = addText(this, 650, 420, '?', 110, { color: '#ffc93c' });
        this.roundObjs.push(this.signText);
        this.signChoices(problem.choices);
        break;
      }
      case 'fracEquiv': {
        this.promptRow(['Which fraction is equal to', d.base, '?'], 240, 44);
        this.makeShape('pie', 660, 475, 150, d.base[1], d.base[0]);
        this.fracChoices(problem.choices, true);
        break;
      }
      case 'fracAddSub': {
        this.plainPrompt(d.op === '+' ? 'Put the pie parts together.' : 'Take the pie parts away.', 50);
        if (this.entry) {
          const ex = [185, 555];
          this.makeShape('pie', ex[0], 430, 92, d.a[1], d.a[0]);
          this.makeShape('pie', ex[1], 430, 92, d.b[1], d.b[0]);
          this.roundObjs.push(this.stacked(ex[0], 590, d.a[0], d.a[1], 50));
          this.roundObjs.push(this.stacked(ex[1], 590, d.b[0], d.b[1], 50));
          this.roundObjs.push(addText(this, 370, 430, d.op === '+' ? '+' : '−', 96, { color: '#ffc93c' }));
          this.makePad(problem);
          break;
        }
        const xs = [430, 870];
        this.makeShape('pie', xs[0], 400, 120, d.a[1], d.a[0]);
        this.makeShape('pie', xs[1], 400, 120, d.b[1], d.b[0]);
        this.roundObjs.push(this.stacked(xs[0], 595, d.a[0], d.a[1], 54));
        this.roundObjs.push(this.stacked(xs[1], 595, d.b[0], d.b[1], 54));
        this.roundObjs.push(addText(this, 650, 400, d.op === '+' ? '+' : '−', 120, { color: '#ffc93c' }));
        this.fracChoices(problem.choices);
        break;
      }
      case 'fracTimesWhole': {
        if (this.entry) {
          this.promptRow([`${d.whole} ×`, d.frac, '= ?'], 255, 54, 370, 560);
          const cnt = d.whole;
          const per = cnt <= 3 ? cnt : 3;
          const nrows = Math.ceil(cnt / per);
          for (let i = 0; i < cnt; i++) {
            const row = Math.floor(i / per);
            const inRow = Math.min(per, cnt - row * per);
            const x = 370 - ((inRow - 1) * 175) / 2 + (i % per) * 175;
            this.makeShape('pie', x, (nrows === 1 ? 500 : 440) + row * 150, 56, d.frac[1], d.frac[0]);
          }
          this.makePad(problem);
          break;
        }
        this.promptRow([`${d.whole} ×`, d.frac, '= ?'], 238, 62);
        const n = d.whole;
        const perRow = n <= 3 ? n : 3;
        const rows = Math.ceil(n / perRow);
        const r = rows === 1 ? 118 : 80;
        const sx = rows === 1 ? 285 : 240;
        const cy0 = rows === 1 ? 480 : 398;
        for (let i = 0; i < n; i++) {
          const row = Math.floor(i / perRow);
          const inRow = Math.min(perRow, n - row * perRow);
          const x = 690 - ((inRow - 1) * sx) / 2 + (i % perRow) * sx;
          this.makeShape('pie', x, cy0 + row * 182, r, d.frac[1], d.frac[0]);
        }
        this.fracChoices(problem.choices);
        break;
      }
      case 'fracMissing': {
        this.plainPrompt('Find the missing top number.', 40);
        const c1 = this.stacked(215, 392, d.base[0], d.base[1], 90);
        const eq = addText(this, 370, 392, '=', 90, { color: '#ffc93c' });
        const c2 = this.stacked(525, 392, '?', d.den, 90);
        this.missingNum = c2.list[0] as Phaser.GameObjects.Text;
        this.roundObjs.push(c1, eq, c2);
        this.makeShape('pie', 370, 640, 100, d.base[1], d.base[0]);
        this.makePad(problem, 3, (f) => this.missingNum?.setText(f[0] || '?'));
        break;
      }
      default:
        this.plainPrompt(problem.prompt, 44);
        if (this.entry) {
          this.makePad(problem);
          break;
        }
        this.fracChoices(problem.choices);
    }
  }

  private makePad(problem: Problem, maxDigits = 3, onChange?: (f: string[]) => void) {
    this.pad = makeAnswerPad(this, answerPadMode(problem), (v) => this.pickTyped(v), { top: 215, maxDigits, onChange });
  }

  private pickTyped(v: number | string) {
    if (!this.canAnswer) return;
    this.picked = null;
    this.submit(v);
  }

  // ---------- fracShow ----------
  private tapSlice(v: ShapeView, p: Phaser.Input.Pointer) {
    if (!this.canAnswer) return;
    const dx = p.worldX - v.cx;
    const dy = p.worldY - v.cy;
    let i: number;
    if (v.d >= 100) {
      const cell = v.size * 1.7 / 10;
      const col = Math.floor((dx + cell * 5) / cell);
      const row = Math.floor((dy + cell * 5) / cell);
      if (col < 0 || col > 9 || row < 0 || row > 9) return;
      i = row * 10 + col;
    } else if (v.kind === 'bar') {
      i = Math.floor((dx + v.size / 2) / (v.size / v.d));
    } else {
      if (Math.hypot(dx, dy) > v.size * 0.9) return;
      let a = Math.atan2(dx, -dy); // 0 = up, clockwise
      if (a < 0) a += Math.PI * 2;
      i = Math.floor(a / ((Math.PI * 2) / v.d));
    }
    if (i < 0 || i >= v.d) return;
    v.filled[i] = !v.filled[i];
    v.redraw();
  }

  private serve() {
    const v = this.showShape;
    if (!v || !this.canAnswer) return;
    const n = v.filled.filter(Boolean).length;
    this.picked = null;
    this.submit(`${n}/${v.d}`);
  }

  private pick(value: number | string) {
    if (!this.canAnswer) return;
    this.picked = this.choices.find((c) => String(c.value) === String(value)) ?? null;
    if (this.signText) {
      this.signText.setText(String(value));
      this.signText.setColor('#fff8ea');
    }
    this.submit(value);
  }

  protected debugPick(value: number | string) {
    if (this.pad) {
      if (!this.pad.enter(value)) this.submit(value);
      return;
    }
    const v = this.showShape;
    if (v) {
      const f = typeof value === 'string' ? parseFrac(value) : null;
      if (f && f[1] === v.d && f[0] <= v.d) {
        v.filled = v.filled.map((_, i) => i < f[0]);
        v.redraw();
        this.serve();
        return;
      }
      this.submit(value);
      return;
    }
    this.pick(value);
  }

  // ---------- feedback ----------
  protected onWrong(kind: WrongKind) {
    if (this.pad) {
      this.pad.wobble();
      this.pad.clear();
    }
    const c = this.picked;
    if (c) {
      c.btn.face.setTint(0x9a94b8);
      wobble(this, c.btn.root);
    } else if (this.showShape && !this.pad) {
      this.shapes.forEach((s) => this.tweens.add({ targets: s.g, x: { from: -10, to: 10 }, duration: 70, yoyo: true, repeat: 2, onComplete: () => (s.g.x = 0) }));
    }
    if (this.signText) {
      const t = this.signText;
      if (kind === 'reveal') {
        t.setText(String((this.problem?.answer as string) ?? '?')).setColor('#ffc93c');
      } else {
        this.time.delayedCall(700, () => t.active && t.setText('?').setColor('#ffc93c'));
      }
    }
  }

  protected onRoundWon() {
    if (this.signText) {
      this.signText.setColor('#ffc93c');
      this.tweens.add({ targets: this.signText, scale: 1.4, duration: 180, yoyo: true, repeat: 1, ease: 'Back.easeOut' });
    }
    for (const s of this.shapes) {
      starBurst(this, s.cx, s.cy, 0xff8fcf, 60, 12);
    }
    const win = this.choices.find((c) => c === this.picked);
    if (win) win.btn.face.setTint(0xb8f0b0);
    this.pip.setFrame(1);
    this.tweens.add({ targets: this.pip, y: this.pip.y - 40, duration: 180, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
    this.time.delayedCall(800, () => this.pip?.active && this.pip.setFrame(0));
    if (this.showShape) this.tweens.add({ targets: this.showShape.g, scale: 1.0, duration: 1 });
    return 200;
  }

  protected clearRound() {
    this.choices.forEach((c) => {
      this.tweens.killTweensOf(c.btn.root);
      c.btn.root.destroy();
    });
    this.choices = [];
    this.roundObjs.forEach((o) => {
      this.tweens.killTweensOf(o);
      o.destroy();
    });
    this.roundObjs = [];
    this.shapes = [];
    this.signText = null;
    this.showShape = null;
    this.serveBtn = null;
    this.picked = null;
    this.pad?.destroy();
    this.pad = null;
    this.missingNum = null;
  }
}
