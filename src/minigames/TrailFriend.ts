// Trail Friend: a friend tells a short story problem. A picture strip shows the first step with
// countable icons (small numbers) or a "what we know" card (big numbers). Answer by choice or number pad.
import Phaser from 'phaser';
import { miniGameSceneKey, Problem } from '../types';
import { friendKey } from '../art/keys';
import { MiniGameScene, WrongKind, makeChoiceButtons } from './base';
import { addCountIcon, isEntry, makeAnswerPad, tintIcon } from './widgets';
import type { AnswerPad, ChoiceButtons, IconObj } from './widgets';
import { COLOR, addText, textStyle } from '../core/ui';

type Story = Extract<Problem['data'], { kind: 'story' }>;
interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const INK = '#1d1a3a';
const MIN_CELL = 18;
const TYPE_MS = 18;

export class TrailFriendScene extends MiniGameScene {
  protected readonly title = 'Trail Friend';
  private objs: Phaser.GameObjects.GameObject[] = [];
  private friend: Phaser.GameObjects.Sprite | null = null;
  private choices: ChoiceButtons | null = null;
  private pad: AnswerPad | null = null;
  /** Picture used for the counted thing (the story's own icon). */
  private icon = 'snowball';
  private lastPick: number | string = 0;
  private storyText: Phaser.GameObjects.Text | null = null;
  private storyLines = '';
  private typed = 0;
  private typeTimer: Phaser.Time.TimerEvent | null = null;
  private talkTimer: Phaser.Time.TimerEvent | null = null;
  private padMode = false;

  constructor() {
    super({ key: miniGameSceneKey('trailFriend') });
  }

  protected hintAnchor() {
    return this.padMode ? { x: 640, y: 250 } : { x: 640, y: 590 };
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }

  protected buildRound(problem: Problem, _area: Phaser.Geom.Rectangle) {
    const d = problem.data.kind === 'story' ? problem.data : null;
    this.icon = d?.icon ?? 'snowball';
    // Level 10+ is always typed; below that small answers are picked.
    this.padMode = isEntry(problem) || !(typeof problem.answer === 'number' && problem.answer <= 20);

    // --- friend ---
    const fx = this.padMode ? 190 : 205;
    const fy = this.padMode ? 860 : 650;
    const fs = this.padMode ? 1.0 : 1.5;
    this.friend = this.keep(this.add.sprite(fx, fy, friendKey(d?.speaker ?? 'pip'), 0).setOrigin(0.5, 1).setScale(fs).setDepth(3));

    // --- speech bubble (largest font 36..40 that fits) ---
    const bx = this.padMode ? 100 : 350;
    const bw = this.padMode ? 690 : 820;
    const by = 196;
    const maxH = this.padMode ? 470 : 330;
    const t = this.keep(this.add.text(bx + 30, by + 22, '', textStyle(40, { color: INK, stroke: '#fff8ea', strokeThickness: 2, align: 'left' })).setDepth(4));
    let lines = '';
    for (let size = 40; size >= 36; size -= 2) {
      t.setFontSize(size);
      t.setWordWrapWidth(bw - 60, true);
      t.setText(problem.prompt);
      lines = t.getWrappedText().join('\n');
      t.setWordWrapWidth(null as unknown as number);
      t.setText(lines);
      if (t.height + 44 <= maxH) break;
    }
    const bh = t.height + 44;
    this.storyLines = lines;
    this.storyText = t;
    t.setText('');
    const g = this.keep(this.add.graphics().setDepth(3.5));
    g.fillStyle(COLOR.cream, 1).fillRoundedRect(bx, by, bw, bh, 28);
    g.lineStyle(6, COLOR.ink, 1).strokeRoundedRect(bx, by, bw, bh, 28);
    // tail toward the friend
    g.fillStyle(COLOR.cream, 1);
    if (this.padMode) {
      const ty = by + bh;
      g.fillTriangle(150, ty - 3, 200, ty - 3, 170, ty + 34);
      g.lineStyle(6, COLOR.ink, 1).lineBetween(150, ty, 170, ty + 34).lineBetween(200, ty, 170, ty + 34);
      g.lineStyle(8, COLOR.cream, 1).lineBetween(153, ty, 197, ty);
    } else {
      const ty = Math.min(by + bh - 40, 440);
      g.fillTriangle(bx + 3, ty - 24, bx + 3, ty + 24, bx - 34, ty + 10);
      g.lineStyle(6, COLOR.ink, 1).lineBetween(bx, ty - 24, bx - 34, ty + 10).lineBetween(bx, ty + 24, bx - 34, ty + 10);
      g.lineStyle(8, COLOR.cream, 1).lineBetween(bx + 2, ty - 21, bx + 2, ty + 21);
    }
    const hit = this.keep(this.add.zone(bx + bw / 2, by + bh / 2, bw, bh).setDepth(5).setInteractive());
    hit.on('pointerdown', () => this.finishTyping());
    this.startTyping();

    // --- picture strip / card ---
    const strip: Rect = this.padMode
      ? { x0: 290, y0: by + bh + 14, x1: 790, y1: 858 }
      : { x0: 340, y0: by + bh + 14, x1: 1170, y1: 722 };
    if (d && strip.y1 - strip.y0 >= 70) {
      const back = this.keep(this.add.graphics().setDepth(2));
      const frame = (r: Rect) => {
        back.fillStyle(0xc9d6f5, 0.55).fillRoundedRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 22);
        back.lineStyle(4, 0x8a92d8, 0.8).strokeRoundedRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 22);
      };
      const small = d.steps[0] && d.steps[0].a <= 12 && d.steps[0].b <= 12;
      const before = this.objs.length;
      if (small) frame(strip);
      if (!small || !this.picture(d, strip)) {
        // drop whatever a failed picture attempt drew; the card sizes its own panel
        this.objs.splice(before).forEach((o) => o.destroy());
        back.clear();
        this.card(d, strip, frame);
      }
    }

    // --- answer ---
    if (!this.padMode) {
      this.choices = makeChoiceButtons(this, problem.choices, (v) => this.pickChoice(v), { x: 640, y: 792, width: 1040, height: 120, fontSize: 64, problem });
      this.choices.buttons.forEach((b) => b.root.setDepth(6));
      this.pad = null;
    } else {
      this.choices = null;
      this.pad = makeAnswerPad(this, 'number', (v) => this.submit(v), { x: 1000, top: 215, maxDigits: 6 });
      this.pad.root.setDepth(6);
    }
  }

  // ---------- typing ----------
  private startTyping() {
    this.typed = 0;
    const talk = this.friend;
    let f = 0;
    this.talkTimer = this.time.addEvent({ delay: 150, loop: true, callback: () => talk?.setFrame((f = 1 - f)) });
    this.typeTimer = this.time.addEvent({
      delay: TYPE_MS,
      loop: true,
      callback: () => {
        this.typed += 1;
        this.storyText?.setText(this.storyLines.slice(0, this.typed));
        if (this.typed >= this.storyLines.length) this.finishTyping();
      },
    });
  }

  private finishTyping() {
    this.typeTimer?.remove();
    this.typeTimer = null;
    this.talkTimer?.remove();
    this.talkTimer = null;
    this.typed = this.storyLines.length;
    this.storyText?.setText(this.storyLines);
    this.friend?.setFrame(0);
  }

  // ---------- picture ----------
  private icons(n: number, cx: number, cy: number, cell: number, cols: number, tint?: number) {
    const rows = Math.ceil(n / cols);
    const out: IconObj[] = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const rowN = Math.min(cols, n - r * cols);
      const x = cx + (c - (rowN - 1) / 2) * cell;
      const y = cy + (r - (rows - 1) / 2) * cell;
      const img = this.keep(addCountIcon(this, this.icon, x, y, cell * 0.9).setDepth(3));
      if (tint !== undefined) tintIcon(img, tint);
      out.push(img);
    }
    return out;
  }

  /** Draws the first step with icons. Returns false when the numbers are too big for a clear picture. */
  private picture(d: Story, R: Rect): boolean {
    const s = d.steps[0];
    if (!s || s.a > 12 || s.b > 12) return false;
    const W = R.x1 - R.x0 - 40;
    const H = R.y1 - R.y0 - 24;
    const cx = (R.x0 + R.x1) / 2;
    const cy = (R.y0 + R.y1) / 2;
    if (s.op === '+') {
      const per = Math.min(6, Math.max(s.a, s.b));
      const rows = Math.ceil(Math.max(s.a, s.b) / 6);
      const cell = Math.min(90, H / rows, (W - 100) / (2 * per));
      if (cell < MIN_CELL) return false;
      // groups sit tight against the plus sign, so the whole picture reads as one sum
      const wa = Math.min(per, s.a) * cell;
      const wb = Math.min(per, s.b) * cell;
      const sumW = wa + wb + 110;
      const left = cx - sumW / 2;
      this.icons(s.a, left + wa / 2, cy, cell, per);
      this.keep(addText(this, left + wa + 55, cy, '+', 96, { color: '#fff1a8', strokeThickness: 8 }).setDepth(3));
      this.icons(s.b, left + wa + 110 + wb / 2, cy, cell, per, 0x8fe6f2);
      return true;
    }
    if (s.op === '-') {
      const per = Math.min(6, s.a);
      const rows = Math.ceil(s.a / per);
      const cell = Math.min(100, H / rows, W / per);
      if (cell < MIN_CELL || s.b > s.a) return false;
      const imgs = this.icons(s.a, cx, cy, cell, per);
      const x = this.keep(this.add.graphics().setDepth(4));
      x.lineStyle(5, 0xe8472b, 1);
      for (let i = s.a - s.b; i < s.a; i++) {
        const im = imgs[i];
        im.setAlpha(0.4);
        const k = cell * 0.4;
        x.lineBetween(im.x - k, im.y - k, im.x + k, im.y + k).lineBetween(im.x - k, im.y + k, im.x + k, im.y - k);
      }
      return true;
    }
    if (s.op === 'x') return this.baskets(Array(s.a).fill(s.b), 0, R);
    // division
    if (d.remainderMode === 'floor' || d.remainderMode === 'ceil') {
      const full = Math.floor(s.a / s.b);
      const r = s.a % s.b;
      const counts: number[] = Array(full).fill(s.b);
      if (r > 0) counts.push(r);
      return this.baskets(counts, 0, R);
    }
    const q = Math.floor(s.a / s.b);
    if (q < 1) return false;
    return this.baskets(Array(s.b).fill(q), s.a % s.b, R);
  }

  /** Baskets with items inside, plus an optional "left over" pile. */
  private baskets(counts: number[], leftover: number, R: Rect): boolean {
    const W = R.x1 - R.x0 - 30;
    const H = R.y1 - R.y0 - 20;
    const gap = 10;
    const p = 6;
    const slots = counts.length + (leftover > 0 ? 1 : 0);
    const m = Math.max(...counts, leftover, 1);
    let best = { cell: 0, cb: 1, ci: 1 };
    for (let cb = 1; cb <= slots; cb++) {
      const rowsB = Math.ceil(slots / cb);
      for (let ci = 1; ci <= m; ci++) {
        const ri = Math.ceil(m / ci);
        const cell = Math.min(80, ((W - (cb - 1) * gap) / cb - 2 * p) / ci, ((H - (rowsB - 1) * gap) / rowsB - 2 * p) / ri);
        if (cell > best.cell + 0.01) best = { cell, cb, ci };
      }
    }
    if (best.cell < MIN_CELL) return false;
    const { cell, cb, ci } = best;
    const ri = Math.ceil(m / ci);
    const bw = ci * cell + 2 * p;
    const bh = ri * cell + 2 * p;
    const rowsB = Math.ceil(slots / cb);
    const totalH = rowsB * bh + (rowsB - 1) * gap;
    const cx = (R.x0 + R.x1) / 2;
    const cy = (R.y0 + R.y1) / 2;
    const gfx = this.keep(this.add.graphics().setDepth(2.5));
    for (let i = 0; i < slots; i++) {
      const r = Math.floor(i / cb);
      const c = i % cb;
      const inRow = Math.min(cb, slots - r * cb);
      const x = cx + (c - (inRow - 1) / 2) * (bw + gap);
      const y = cy - totalH / 2 + bh / 2 + r * (bh + gap);
      const isLeft = i >= counts.length;
      const n = isLeft ? leftover : counts[i];
      gfx.fillStyle(isLeft ? 0xffe9c9 : 0xfff8ea, isLeft ? 0.7 : 0.85).fillRoundedRect(x - bw / 2, y - bh / 2, bw, bh, 10);
      gfx.lineStyle(4, isLeft ? 0xff8a1f : 0x6d6690, 1).strokeRoundedRect(x - bw / 2, y - bh / 2, bw, bh, 10);
      // items in an inner grid (rows centred)
      const cols = Math.min(ci, n);
      const imgs = this.icons(n, x, y, cell, Math.max(1, cols), isLeft ? 0xffc93c : undefined);
      imgs.forEach((im) => im.setDepth(3));
    }
    return true;
  }

  /** "What we know" card for bigger numbers. */
  private card(d: Story, R: Rect, frame: (r: Rect) => void) {
    const u = d.unit;
    const rem = d.remainderMode;
    const lines: string[] = [];
    d.steps.forEach((st, i) => {
      const last = i === d.steps.length - 1;
      if (i === 0) {
        if (st.op === '+') lines.push(`Start: ${st.a} ${u}`, `Finds: ${st.b} more`);
        else if (st.op === '-') lines.push(`Start: ${st.a} ${u}`, `Gives away: ${st.b}`);
        else if (st.op === 'x') lines.push(`Baskets: ${st.a}`, `${u} in each: ${st.b}`);
        else lines.push(`Start: ${st.a} ${u}`, rem === 'floor' ? `Box holds: ${st.b}` : rem === 'ceil' ? `Sled holds: ${st.b}` : `Shared by: ${st.b}`);
      } else if (last && rem) {
        lines.push(rem === 'floor' ? `Box holds: ${st.b}` : rem === 'ceil' ? `Sled holds: ${st.b}` : `Shared by: ${st.b}`);
      } else if (st.op === '+') lines.push(`Then finds ${st.b} more`);
      else if (st.op === '-') lines.push(`Then gives away ${st.b}`);
      else if (st.op === 'x') lines.push(`Then ${st.b} times as many`);
      else lines.push(`Then splits into ${st.b} piles`);
    });
    const W = R.x1 - R.x0;
    const H = R.y1 - R.y0;
    let fs = 44;
    let lineH = fs + 14;
    if (lines.length + 1 > Math.floor((H - 24) / lineH)) {
      fs = 38;
      lineH = fs + 8;
    }
    const maxLines = Math.floor((H - 24) / lineH);
    let title = true;
    if (lines.length + 1 > maxLines) title = false;
    const cols = lines.length > maxLines - (title ? 1 : 0) && W > 600 ? 2 : 1;
    const perCol = Math.ceil(lines.length / cols);
    const rows = perCol + (title ? 1 : 0);
    const ph = Math.min(H, rows * lineH + 36);
    const cyMid = (R.y0 + R.y1) / 2;
    frame({ x0: R.x0, x1: R.x1, y0: cyMid - ph / 2, y1: cyMid + ph / 2 });
    let y = cyMid - ((rows - 1) * lineH) / 2;
    const style = (size: number, color: string) => textStyle(size, { color, stroke: '#fff8ea', strokeThickness: 2, align: 'left' });
    if (title) {
      this.keep(this.add.text(R.x0 + 24, y, 'What we know:', style(Math.min(fs, 38), '#3b3a7a')).setOrigin(0, 0.5).setDepth(3));
      y += lineH;
    }
    const colW = (W - 48) / cols;
    lines.forEach((ln, i) => {
      const c = Math.floor(i / perCol);
      const r = i % perCol;
      const t = this.keep(this.add.text(R.x0 + 24 + c * colW, y + r * lineH, ln, style(fs, INK)).setOrigin(0, 0.5).setDepth(3));
      if (t.width > colW - 10) t.setScale((colW - 10) / t.width);
    });
  }

  // ---------- answering ----------
  private pickChoice(v: number | string) {
    if (!this.canAnswer) return;
    this.lastPick = v;
    this.submit(v);
  }

  protected debugPick(v: number | string) {
    if (this.choices) this.pickChoice(v);
    else if (this.pad) {
      if (!this.pad.enter(v)) this.submit(typeof v === 'number' ? v : Number(v));
    } else this.submit(typeof v === 'number' ? v : Number(v));
  }

  protected onWrong(_kind: WrongKind) {
    if (this.choices) {
      this.choices.wobble(this.lastPick);
      this.choices.dim(this.lastPick);
    } else if (this.pad) {
      this.pad.wobble();
      this.pad.clear();
    }
  }

  protected onRoundWon() {
    this.finishTyping();
    const f = this.friend;
    if (f) {
      this.friend?.setFrame(1);
      this.tweens.add({
        targets: f,
        y: f.y - 46,
        duration: 170,
        yoyo: true,
        repeat: 1,
        ease: 'Quad.easeOut',
        onComplete: () => f.setFrame(0),
      });
    }
    return 300;
  }

  protected clearRound() {
    this.typeTimer?.remove();
    this.talkTimer?.remove();
    this.typeTimer = this.talkTimer = null;
    if (this.friend) this.tweens.killTweensOf(this.friend);
    this.choices?.destroy();
    this.choices = null;
    this.pad?.destroy();
    this.pad = null;
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    this.friend = null;
    this.storyText = null;
  }
}
