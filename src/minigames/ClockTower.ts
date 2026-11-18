// Clock Tower: Odette the owl keeps the big clock. Set it, read it, work out elapsed time or convert units.
import Phaser from 'phaser';
import { miniGameSceneKey, Problem } from '../types';
import { TEX, friendKey } from '../art/keys';
import { MiniGameScene, WrongKind } from './base';
import { formatTime, parseTime } from '../math/format';
import { COLOR, addText, makeButton, starBurst, textStyle, wobble, Button } from '../core/ui';
import { AnswerPad, answerPadMode, choiceLabel, fitText, isEntry, makeAnswerPad } from './widgets';

const ODETTE_X = 180;
const ODETTE_Y = 705;
const CHOICE_Y = 792;

interface ClockView {
  root: Phaser.GameObjects.Container;
  hour: Phaser.GameObjects.Image;
  min: Phaser.GameObjects.Image;
  knobs: Phaser.GameObjects.Graphics;
  scale: number;
  cx: number;
  cy: number;
  size: number;
  setTime(h: number, m: number, knobs?: boolean): void;
}

interface Choice {
  value: number | string;
  btn: Button;
}

const hourAngle = (h: number, m: number) => (h % 12) * 30 + m * 0.5;
const minAngle = (m: number) => m * 6;

export class ClockTowerScene extends MiniGameScene {
  protected readonly title = 'Clock Tower';
  private odette!: Phaser.GameObjects.Image;
  private roundObjs: Phaser.GameObjects.GameObject[] = [];
  private choices: Choice[] = [];
  private clocks: ClockView[] = [];
  private picked: Choice | null = null;
  private pad: AnswerPad | null = null;
  /** Level 10+ read/elapsed/convert: typed answer on a pad, picture on the left. */
  private entry = false;
  private odetteShadow: Phaser.GameObjects.Graphics | null = null;

  // clockSet state
  private setMode = false;
  private h = 12;
  private m = 0;
  private snap = 5;
  private dragging: 'hour' | 'min' | null = null;
  private tmCont = 0; // unwrapped total minutes while dragging the minute hand
  private lastA = 0;
  private moveFn: ((p: Phaser.Input.Pointer) => void) | null = null;
  private upFn: (() => void) | null = null;

  constructor() {
    super({ key: miniGameSceneKey('clockTower') });
  }

  protected setupGame() {
    this.roundObjs = [];
    this.choices = [];
    this.clocks = [];
    this.picked = null;
    const sh = this.add.graphics();
    sh.fillStyle(0x3b3a7a, 0.35).fillEllipse(ODETTE_X, ODETTE_Y - 4, 190, 34);
    this.odetteShadow = sh;
    this.odette = this.add.image(ODETTE_X, ODETTE_Y, friendKey('odette'), 0).setOrigin(0.5, 1).setScale(1.15).setDepth(5);
  }

  protected hintAnchor() {
    return this.entry ? { x: 370, y: 760 } : { x: 640, y: 236 };
  }

  protected hintWidth() {
    return this.entry ? 600 : 1000;
  }

  // ---------- building ----------
  protected buildRound(problem: Problem, _area: Phaser.Geom.Rectangle) {
    const d = problem.data;
    this.setMode = false;
    this.picked = null;
    this.pad = null;
    this.entry = isEntry(problem) && d.kind !== 'clockSet' && d.kind !== 'clockShift';
    // typed layouts keep the picture on the left, so Odette steps down into the corner
    this.odetteShadow?.setVisible(!this.entry);
    if (this.entry) this.odette.setPosition(105, 850).setScale(0.5);
    else this.odette.setPosition(ODETTE_X, ODETTE_Y).setScale(1.15);
    this.odette.setFrame(1);
    this.time.delayedCall(900, () => this.odette?.active && this.odette.setFrame(0));
    switch (d.kind) {
      case 'clockSet':
        this.buildSet(problem, d.h, d.m, d.snap);
        break;
      case 'clockShift': {
        const total = (((((d.h % 12) * 60 + d.m + d.deltaMinutes) % 720) + 720) % 720);
        this.buildSet(problem, Math.floor(total / 60) || 12, total % 60, d.snap, { h: d.h, m: d.m }, problem.prompt);
        break;
      }
      case 'clockRead': {
        if (this.entry) {
          this.title2('What time does the clock show?', 46);
          this.makeClock(370, 510, 400, d.h, d.m);
          this.makePad(problem);
          break;
        }
        this.title2('What time does the clock show?', 52);
        this.makeClock(640, 490, 400, d.h, d.m);
        this.buildChoices(problem.choices);
        break;
      }
      case 'elapsed': {
        if (this.entry) {
          this.title2(problem.prompt, 38, 110);
          const ex = [200, 540];
          this.makeClock(ex[0], 520, 230, d.startH, d.startM);
          this.makeClock(ex[1], 520, 230, d.endH, d.endM);
          this.roundObjs.push(addText(this, ex[0], 378, 'Start', 42));
          this.roundObjs.push(addText(this, ex[1], 378, 'End', 42));
          this.roundObjs.push(addText(this, 370, 520, '→', 70, { color: '#ffc93c' }));
          this.makePad(problem, 'minutes');
          break;
        }
        const t = this.add.text(640, 228, problem.prompt, textStyle(40, { wordWrap: { width: 1000, useAdvancedWrap: true } })).setOrigin(0.5);
        this.roundObjs.push(fitText(t, 1000, 110));
        const xs = [490, 900];
        this.makeClock(xs[0], 470, 250, d.startH, d.startM);
        this.makeClock(xs[1], 470, 250, d.endH, d.endM);
        this.roundObjs.push(addText(this, xs[0], 316, 'Start', 46));
        this.roundObjs.push(addText(this, xs[1], 316, 'End', 46));
        this.roundObjs.push(addText(this, (xs[0] + xs[1]) / 2, 470, '→', 84, { color: '#ffc93c' }));
        this.buildChoices(problem.choices, 'minutes');
        break;
      }
      case 'timeConvert': {
        if (this.entry) {
          const eq = `${d.value} ${d.from} = ?`;
          const t = this.add.text(370, 262, eq, textStyle(70, { wordWrap: { width: 560, useAdvancedWrap: true } })).setOrigin(0.5);
          this.roundObjs.push(fitText(t, 560, 110));
          this.drawHourglasses(d.value, d.from === 'hours' ? 0xffc93c : 0x8fe6f2, 370, 80, 6);
          this.makePad(problem, d.to);
          break;
        }
        const eq = `${d.value} ${d.from} = ?  ${d.to}`;
        const t = this.add.text(640, 262, eq, textStyle(76, { wordWrap: { width: 1000, useAdvancedWrap: true } })).setOrigin(0.5);
        this.roundObjs.push(fitText(t, 1000, 120));
        this.drawHourglasses(d.value, d.from === 'hours' ? 0xffc93c : 0x8fe6f2);
        this.buildChoices(problem.choices, d.to);
        break;
      }
      default:
        this.title2(problem.prompt, 44);
        if (this.entry) {
          this.makePad(problem);
          break;
        }
        this.buildChoices(problem.choices);
    }
  }

  private makePad(problem: Problem, unit?: string) {
    this.pad = makeAnswerPad(this, answerPadMode(problem), (v) => this.pickTyped(v), { top: 215, unit });
  }

  private pickTyped(v: number | string) {
    if (!this.canAnswer) return;
    this.picked = null;
    this.submit(v);
  }

  private title2(s: string, size: number, maxH = 100) {
    if (this.entry) {
      const e = this.add.text(370, 252, s, textStyle(size, { wordWrap: { width: 560, useAdvancedWrap: true } })).setOrigin(0.5);
      this.roundObjs.push(fitText(e, 580, maxH + 20));
      return e;
    }
    const t = this.add.text(640, 222, s, textStyle(size, { wordWrap: { width: 1000, useAdvancedWrap: true } })).setOrigin(0.5);
    this.roundObjs.push(fitText(t, 1000, maxH));
    return t;
  }

  private makeClock(cx: number, cy: number, size: number, h: number, m: number): ClockView {
    const s = size / 520;
    const root = this.add.container(cx, cy);
    const R = size / 2;
    void R;
    const face = this.add.image(0, 0, TEX.clockFace).setDisplaySize(size, size);
    const hour = this.add.image(0, 0, TEX.clockHandHour).setOrigin(0.5, 0.9).setScale(s);
    const min = this.add.image(0, 0, TEX.clockHandMinute).setOrigin(0.5, 0.93).setScale(s);
    const knobs = this.add.graphics();
    const cap = this.add.graphics();
    cap.fillStyle(COLOR.ink, 1).fillCircle(0, 0, Math.max(11, 20 * s));
    cap.fillStyle(COLOR.yellow, 1).fillCircle(0, 0, Math.max(6, 11 * s));
    root.add([face, hour, min, knobs, cap]);
    this.roundObjs.push(root);
    const view: ClockView = {
      root,
      hour,
      min,
      knobs,
      scale: s,
      cx,
      cy,
      size,
      setTime: (hh, mm, showKnobs = false) => {
        hour.setAngle(hourAngle(hh, mm));
        min.setAngle(minAngle(mm));
        knobs.clear();
        if (showKnobs) {
          const pt = (deg: number, r: number) => ({ x: Math.sin((deg * Math.PI) / 180) * r, y: -Math.cos((deg * Math.PI) / 180) * r });
          const a = pt(hourAngle(hh, mm), 118 * s);
          const b = pt(minAngle(mm), 178 * s);
          for (const [p, col] of [[a, COLOR.orange], [b, COLOR.yellow]] as const) {
            knobs.fillStyle(COLOR.ink, 1).fillCircle(p.x, p.y, 27);
            knobs.fillStyle(col, 1).fillCircle(p.x, p.y, 20);
            knobs.fillStyle(0xfff1a8, 1).fillCircle(p.x - 6, p.y - 7, 6);
          }
        }
      },
    };
    view.setTime(h, m);
    this.clocks.push(view);
    return view;
  }

  private buildChoices(values: (number | string)[], unit?: string) {
    const n = values.length;
    const gap = 22;
    const w = Math.min(250, (1060 - gap * (n - 1)) / n);
    const h = 130;
    const x0 = 640 - ((n - 1) * (w + gap)) / 2;
    values.forEach((v, i) => {
      const btn = makeButton(this, x0 + i * (w + gap), CHOICE_Y, w, h, unit ? '' : choiceLabel(null, v), () => this.pick(v), 60);
      if (unit) {
        const a = this.add.text(0, -22, choiceLabel(null, v), textStyle(58)).setOrigin(0.5);
        const b = this.add.text(0, 32, unit, textStyle(38, { strokeThickness: 5 })).setOrigin(0.5);
        btn.root.add([a, b]);
      }
      this.choices.push({ value: v, btn });
    });
  }

  private pick(v: number | string) {
    if (!this.canAnswer) return;
    this.picked = this.choices.find((c) => String(c.value) === String(v)) ?? null;
    this.submit(v);
  }

  // ---------- clockSet ----------
  private buildSet(problem: Problem, th: number, tm: number, snap: number, start?: { h: number; m: number }, text?: string) {
    this.setMode = true;
    this.snap = snap;
    if (start) {
      // clockShift: the clock begins at the given time and the child moves it
      this.h = start.h;
      this.m = start.m;
    } else {
      // Start at a time that differs from the target.
      this.h = ((th - 1 + 3 + Math.floor(this.rng() * 6)) % 12) + 1;
      this.m = snap >= 60 ? 0 : tm === 0 && snap <= 30 ? 30 : 0;
    }
    const t = this.add.text(640, 222, text ?? `Set the clock to ${formatTime(th, tm)}`, textStyle(text ? 46 : 64, { wordWrap: { width: 1000, useAdvancedWrap: true } })).setOrigin(0.5);
    this.roundObjs.push(fitText(t, 1000, 100));

    const cx = 585;
    const cy = 510;
    const size = 390;
    const clock = this.makeClock(cx, cy, size, this.h, this.m);
    this.refresh();

    const zone = this.add.zone(cx, cy, size + 40, size + 40).setInteractive({ useHandCursor: true });
    this.roundObjs.push(zone);
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => this.grab(p, clock));
    this.moveFn = (p: Phaser.Input.Pointer) => this.drag(p, clock);
    this.upFn = () => {
      this.dragging = null;
    };
    this.input.on('pointermove', this.moveFn);
    this.input.on('pointerup', this.upFn);
    this.input.on('pointerupoutside', this.upFn);

    // +/- controls
    const cxc = 985;
    const showMin = snap < 60;
    const hy = showMin ? 380 : 450;
    this.roundObjs.push(addText(this, cxc, hy - 85, 'Hour', 44));
    this.addStep(cxc - 70, hy, '−', () => this.stepHour(-1));
    this.addStep(cxc + 70, hy, '+', () => this.stepHour(1));
    if (showMin) {
      this.roundObjs.push(addText(this, cxc, 497, snap === 1 ? 'Minutes' : `Minutes (${snap})`, 44));
      this.addStep(cxc - 70, 600, '−', () => this.stepMin(-1));
      this.addStep(cxc + 70, 600, '+', () => this.stepMin(1));
    }
    const check = makeButton(this, cxc, 740, 300, 120, 'Check', () => this.check(), 60);
    this.roundObjs.push(check.root);
    this.checkBtn = check;
    void problem;
  }

  private checkBtn: Button | null = null;

  private addStep(x: number, y: number, label: string, fn: () => void) {
    const b = makeButton(this, x, y, 120, 120, label, () => this.canAnswer && fn(), 76);
    this.roundObjs.push(b.root);
  }

  private refresh() {
    this.clocks[0]?.setTime(this.h, this.m, true);
  }

  private stepHour(dir: number) {
    this.h = ((this.h - 1 + dir + 12) % 12) + 1;
    this.refresh();
  }

  private stepMin(dir: number) {
    let m = this.m + dir * this.snap;
    if (m >= 60) {
      m -= 60;
      this.stepHourQuiet(1);
    } else if (m < 0) {
      m += 60;
      this.stepHourQuiet(-1);
    }
    this.m = m;
    this.refresh();
  }

  private stepHourQuiet(dir: number) {
    this.h = ((this.h - 1 + dir + 12) % 12) + 1;
  }

  private pointerAngle(p: Phaser.Input.Pointer, c: ClockView): { a: number; r: number } {
    const dx = p.worldX - c.cx;
    const dy = p.worldY - c.cy;
    let a = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (a < 0) a += 360;
    return { a, r: Math.hypot(dx, dy) };
  }

  private grab(p: Phaser.Input.Pointer, c: ClockView) {
    if (!this.canAnswer) return;
    const { a, r } = this.pointerAngle(p, c);
    if (r > c.size * 0.58) return;
    const diff = (x: number, y: number) => Math.abs(((x - y + 540) % 360) - 180);
    const dh = diff(a, hourAngle(this.h, this.m));
    const dm = diff(a, minAngle(this.m));
    // Outer area always grabs the minute hand; inside, the hand pointing closest to the finger.
    this.dragging = r > 160 * c.scale || this.snap >= 60 ? (this.snap >= 60 ? 'hour' : 'min') : dh < dm ? 'hour' : 'min';
    if (this.dragging === 'min') {
      // Anchor the continuous minute counter to the pointer.
      const base = Math.floor((((this.h % 12) * 60 + this.m) / 60)) * 60;
      const cur = (this.h % 12) * 60 + this.m;
      let best = base + a / 6;
      for (const k of [base - 60 + a / 6, base + 60 + a / 6]) if (Math.abs(k - cur) < Math.abs(best - cur)) best = k;
      this.tmCont = best;
      this.lastA = a;
      this.applyMinutes();
    } else {
      this.applyHour(a);
    }
  }

  private drag(p: Phaser.Input.Pointer, c: ClockView) {
    if (!this.dragging || !p.isDown || !this.canAnswer) return;
    const { a } = this.pointerAngle(p, c);
    if (this.dragging === 'min') {
      let da = a - this.lastA;
      if (da > 180) da -= 360;
      if (da < -180) da += 360;
      this.tmCont += da / 6;
      this.lastA = a;
      this.applyMinutes();
    } else {
      this.applyHour(a);
    }
  }

  private applyMinutes() {
    const snapped = Math.round(this.tmCont / this.snap) * this.snap;
    const total = ((snapped % 720) + 720) % 720;
    const hh = Math.floor(total / 60);
    this.h = hh === 0 ? 12 : hh;
    this.m = total % 60;
    this.refresh();
  }

  private applyHour(a: number) {
    const hi = ((Math.round((a - this.m * 0.5) / 30) % 12) + 12) % 12;
    this.h = hi === 0 ? 12 : hi;
    this.refresh();
  }

  private check() {
    if (!this.canAnswer || !this.setMode) return;
    this.picked = null;
    this.submit(formatTime(this.h, this.m));
  }

  // ---------- feedback ----------
  protected debugPick(v: number | string) {
    if (this.pad) {
      if (!this.pad.enter(v)) this.submit(v);
      return;
    }
    if (this.setMode && typeof v === 'string') {
      const t = parseTime(v);
      if (t) {
        this.h = t.h;
        this.m = t.m;
        this.refresh();
        this.check();
        return;
      }
    }
    this.pick(v);
  }

  protected onWrong(_kind: WrongKind) {
    if (this.pad) {
      this.pad.wobble();
      this.pad.clear();
      return;
    }
    if (this.setMode) {
      if (this.clocks[0]) wobble(this, this.clocks[0].root);
      return;
    }
    const c = this.picked;
    if (c) {
      c.btn.face.setTint(0x9a94b8);
      wobble(this, c.btn.root);
    }
  }

  protected onRoundWon() {
    this.dragging = null;
    for (const c of this.clocks) {
      c.knobs.clear();
      this.tweens.add({ targets: c.root, scale: 1.08, duration: 160, yoyo: true, repeat: 1 });
      starBurst(this, c.cx, c.cy - c.size / 2, 0xffc93c, 60, 14);
    }
    this.odette.setFrame(1);
    this.tweens.add({ targets: this.odette, y: this.odette.y - 40, duration: 180, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
    this.time.delayedCall(800, () => this.odette?.active && this.odette.setFrame(0));
    const win = this.choices.find((c) => c === this.picked);
    if (win) win.btn.face.setTint(0xb8f0b0);
    return 200;
  }

  private drawHourglasses(count: number, sand: number, cx0 = 700, gx = 105, maxPer = 8) {
    const perRow = Math.min(count, maxPer);
    const rows = Math.ceil(count / perRow);
    const gy = 130;
    const cy0 = 480 - ((rows - 1) * gy) / 2 + 20;
    const g = this.add.graphics();
    this.roundObjs.push(g);
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / perRow);
      const inRow = Math.min(perRow, count - r * perRow);
      const x = cx0 - ((inRow - 1) * gx) / 2 + (i % perRow) * gx;
      const y = cy0 + r * gy;
      // frame
      g.fillStyle(COLOR.ink, 1).fillRoundedRect(x - 36, y - 56, 72, 14, 5).fillRoundedRect(x - 36, y + 42, 72, 14, 5);
      g.fillStyle(COLOR.woodLight, 1).fillRoundedRect(x - 32, y - 54, 64, 8, 4).fillRoundedRect(x - 32, y + 44, 64, 8, 4);
      // glass
      g.fillStyle(COLOR.ink, 1).fillTriangle(x - 30, y - 42, x + 30, y - 42, x, y).fillTriangle(x - 30, y + 44, x + 30, y + 44, x, y);
      g.fillStyle(0xd6fbff, 1).fillTriangle(x - 24, y - 38, x + 24, y - 38, x, y - 3).fillTriangle(x - 24, y + 40, x + 24, y + 40, x, y + 3);
      // sand
      g.fillStyle(sand, 1).fillTriangle(x - 13, y - 22, x + 13, y - 22, x, y - 4).fillTriangle(x - 20, y + 40, x + 20, y + 40, x, y + 20);
      g.fillRect(x - 2, y - 4, 4, 18);
    }
  }

  protected clearRound() {
    if (this.moveFn) this.input.off('pointermove', this.moveFn);
    if (this.upFn) {
      this.input.off('pointerup', this.upFn);
      this.input.off('pointerupoutside', this.upFn);
    }
    this.moveFn = null;
    this.upFn = null;
    this.dragging = null;
    this.setMode = false;
    this.pad?.destroy();
    this.pad = null;
    this.checkBtn = null;
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
    this.clocks = [];
    this.picked = null;
  }
}
