// Gem Sort: build a number from place-value pieces (placeValue), count a scattered pile (count),
// or read the value of one highlighted digit (digitValue).
import Phaser from 'phaser';
import { miniGameSceneKey, Problem } from '../types';
import { TEX } from '../art/keys';
import { MiniGameScene, WrongKind } from './base';
import { AnswerPad, ChoiceButtons, IconObj, addCountIcon, answerPadMode, fitText, isEntry, makeAnswerPad, makeChoiceButtons } from './widgets';
import { addText, makeButton, starBurst, textStyle, wobble } from '../core/ui';
import { audio } from '../core/audio';
import { formatNum } from '../math/format';

type Obj = Phaser.GameObjects.GameObject;

const PLACE_NAME = ['Ones', 'Tens', 'Hundreds', 'Thousands'];
const PLACE_NUM = ['1s', '10s', '100s', '1,000s', '10,000s', '100,000s'];
const TILE_FILL = [0, 0, 0, 0, 0x39b6d8, 0x8a5fd8];
const TILE_DARK = [0, 0, 0, 0, 0x1f7fa8, 0x5b3fa8];

const CRATE_Y = 392;
const CRATE_H = 240;
const TRAY_Y = 794;
const MAX_PER_COL = 9;

/** One place-value piece as a container (picture piece for ones..thousands, labelled tile above). */
function makePiece(scene: Phaser.Scene, place: number, w: number, h: number, full = false) {
  const c = scene.add.container(0, 0).setSize(w, h);
  if (place <= 3) {
    // All four frames share one unit size (ten ones == one tens bar), so every piece gets the same scale.
    const s = Math.min(w, h);
    if (full || place <= 1) {
      // soft pad: keeps the tiny ones cube / tens bar easy to see, and a big tap target in the tray
      const pad = Math.max(s * (full ? 1.1 : 0.9), 28);
      const pg = scene.add.graphics();
      pg.fillStyle(0xffffff, full ? 0.55 : 0.4).fillRoundedRect(-pad / 2, -pad / 2, pad, pad, 16);
      pg.lineStyle(full ? 3 : 2, 0x1d1a3a, 0.25).strokeRoundedRect(-pad / 2, -pad / 2, pad, pad, 16);
      if (place === 0) pg.fillStyle(0xffe08a, 0.75).fillCircle(s * 0.03, -s * 0.03, Math.max(s * 0.16, 7)); // warm glow under the single cube
      c.add(pg);
    }
    c.add(scene.add.image(0, 0, TEX.pvGem, place).setDisplaySize(s * 1.1, s * 1.1));
  } else {
    const g = scene.add.graphics();
    g.fillStyle(0x1d1a3a, 1).fillRoundedRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2, 12);
    g.fillStyle(TILE_FILL[place], 1).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 10);
    g.fillStyle(TILE_DARK[place], 1).fillRoundedRect(-w / 2 + 3, h / 2 - 18, w - 6, 15, { tl: 0, tr: 0, bl: 10, br: 10 });
    g.fillStyle(0xfff8ea, 0.5).fillRoundedRect(-w / 2 + 10, -h / 2 + 9, w - 36, 7, 3);
    const label = full ? (place === 4 ? '10,000' : '100,000') : place === 4 ? '10K' : '100K';
    const t = scene.add.text(0, -2, label, textStyle(full ? 36 : 24, { strokeThickness: full ? 5 : 3 })).setOrigin(0.5);
    fitText(t, w - 10);
    c.add([g, t]);
  }
  return c;
}

interface Col {
  place: number;
  cx: number;
  pieces: Phaser.GameObjects.Container[];
  nameT: Phaser.GameObjects.Text;
  countT: Phaser.GameObjects.Text;
}

export class GemSortScene extends MiniGameScene {
  protected readonly title = 'Gem Sort';
  private objs: Obj[] = [];
  private cols: Col[] = [];
  private crate: Phaser.GameObjects.Container | null = null;
  private totalT: Phaser.GameObjects.Text | null = null;
  private cell = 52;
  private choices: ChoiceButtons | null = null;
  private lastPick: number | string | null = null;
  private countItems: { img: IconObj; counted: boolean }[] = [];
  private pad: AnswerPad | null = null;
  private counted = 0;
  private countedT: Phaser.GameObjects.Text | null = null;
  private mode: 'placeValue' | 'count' | 'digitValue' = 'placeValue';

  constructor() {
    super({ key: miniGameSceneKey('gemSort') });
  }

  protected hintAnchor() {
    // Keep the target number visible: the bubble covers the picture area instead.
    if (this.pad) return { x: 370, y: 660 };
    return { x: 640, y: this.mode === 'digitValue' ? 560 : this.mode === 'count' ? 470 : 335 };
  }

  protected hintWidth() {
    return this.pad ? 600 : 1000;
  }

  protected buildRound(problem: Problem) {
    this.objs = [];
    this.cols = [];
    this.crate = null;
    this.totalT = null;
    this.choices = null;
    this.lastPick = null;
    this.countItems = [];
    this.counted = 0;
    this.countedT = null;
    this.pad = null;
    const d = problem.data;
    if (d.kind === 'placeValue') {
      this.mode = 'placeValue';
      this.buildPlaceValue(d.target, d.digits);
    } else if (d.kind === 'count') {
      this.mode = 'count';
      this.buildCount(problem, d.count, d.item);
    } else if (d.kind === 'digitValue') {
      this.mode = 'digitValue';
      this.buildDigitValue(problem, d.n, d.placeIndex);
    } else {
      // Unexpected kind: fall back to plain choices so the game never dead-ends.
      this.mode = 'digitValue';
      this.track(fitText(addText(this, 640, 300, problem.prompt, 56, { wordWrap: { width: 1000 } }), 1040, 200));
      this.makeChoices(problem);
    }
  }

  private track<T extends Obj>(o: T): T {
    this.objs.push(o);
    return o;
  }

  private makeChoices(problem: Problem) {
    this.choices = makeChoiceButtons(this, problem.choices, (v) => this.pick(v), {
      x: 640,
      y: 785,
      width: 1040,
      height: 120,
      fontSize: 60,
      problem,
    });
  }

  private pick(v: number | string) {
    if (!this.canAnswer) return;
    this.lastPick = v;
    this.submit(v);
  }

  // ---------------------------------------------------------------- placeValue

  private buildPlaceValue(target: number, digits: number[]) {
    const n = Math.min(Math.max(digits.length, 1), 6);
    const useCrate = n <= 4;
    const colW = useCrate ? Math.min(220, 780 / n) : Math.min(220, 1060 / n);
    const x0 = 640 - ((n - 1) * colW) / 2;
    this.cell = Math.min(64, (colW - 16) / 3);
    this.track(fitText(addText(this, 640, 212, `Build ${formatNum(target)}`, 76), 1000, 90));

    this.crate = this.track(this.add.container(640, CRATE_Y).setDepth(5));
    if (useCrate) {
      // The crate art's front face spans about 8%..81% of its width: size and shift it so the
      // front face sits exactly behind the columns.
      const crateW = Math.min(1120, (n * colW + 24) / 0.727);
      this.crate.add(this.add.image(0.0565 * crateW, 0, TEX.crate).setDisplaySize(crateW, CRATE_H));
    } else {
      // 5-6 digit numbers need more columns than the crate art can hold: a flat wooden bin.
      const bw = n * colW + 40;
      const bin = this.add.graphics();
      bin.fillStyle(0x1d1a3a, 1).fillRoundedRect(-bw / 2 - 5, -CRATE_H / 2 + 15, bw + 10, CRATE_H - 10, 22);
      bin.fillStyle(0xc58a4a, 1).fillRoundedRect(-bw / 2, -CRATE_H / 2 + 20, bw, CRATE_H - 20, 18);
      bin.fillStyle(0xeec07a, 1).fillRoundedRect(-bw / 2, -CRATE_H / 2 + 20, bw, 18, { tl: 18, tr: 18, bl: 0, br: 0 });
      bin.fillStyle(0x8a5530, 1).fillRoundedRect(-bw / 2, CRATE_H / 2 - 22, bw, 22, { tl: 0, tr: 0, bl: 18, br: 18 });
      bin.fillStyle(0x8a5530, 0.5);
      for (const y of [-20, 30]) bin.fillRect(-bw / 2 + 4, y, bw - 8, 4);
      this.crate.add(bin);
    }

    // tray background
    const bg = this.track(this.add.graphics());
    bg.fillStyle(0xc9d6f5, 0.85).fillRoundedRect(100, 722, 1080, 144, 28);
    bg.lineStyle(5, 0x1d1a3a, 1).strokeRoundedRect(100, 722, 1080, 144, 28);

    for (let i = 0; i < n; i++) {
      const place = n - 1 - i;
      const cx = x0 + i * colW;
      const nameT = this.track(addText(this, cx, 540, n <= 4 ? PLACE_NAME[place] : PLACE_NUM[place], 36).setDepth(5));
      fitText(nameT, colW - 6);
      const countT = this.track(addText(this, cx, 582, "0", 52).setDepth(5));
      const col: Col = { place, cx, pieces: [], nameT, countT };
      this.cols.push(col);
      // tray button: one piece, tap adds to the crate
      const pw = Math.min(170, colW - 12);
      const tp = makePiece(this, place, place <= 3 ? 100 : pw, 100, true);
      tp.setPosition(cx, TRAY_Y - 14).setDepth(5);
      this.track(tp);
      const valT = this.track(addText(this, cx, TRAY_Y + 52, place <= 3 ? formatNum(10 ** place) : '', 36).setDepth(5));
      fitText(valT, colW - 10);
      const tz = this.track(this.add.zone(cx, TRAY_Y, colW - 6, 150).setInteractive({ useHandCursor: true }).setDepth(9));
      tz.on('pointerdown', () => {
        if (!this.canAnswer) return;
        this.tweens.add({ targets: tp, scale: 0.88, duration: 70, yoyo: true });
        this.addPiece(col, tp.x, tp.y);
      });
      // crate column: tap anywhere on it to take the top piece back
      const cz = this.track(this.add.zone(cx, CRATE_Y, colW - 6, CRATE_H).setInteractive({ useHandCursor: true }).setDepth(9));
      cz.on('pointerdown', () => {
        if (!this.canAnswer) return;
        this.removePiece(col);
      });
    }
    // column dividers inside the crate
    const dv = this.add.graphics();
    dv.lineStyle(3, 0x5a3320, 0.45);
    for (let i = 1; i < n; i++) {
      const lx = x0 + (i - 0.5) * colW - 640;
      dv.beginPath().moveTo(lx, -80).lineTo(lx, 100).strokePath();
    }
    this.crate.add(dv);

    this.totalT = this.track(addText(this, 360, 662, 'Total: 0', 60).setDepth(5));
    const chk = makeButton(this, 960, 662, 320, 110, 'Check', () => this.check(), 60);
    chk.root.setDepth(6);
    this.track(chk.root);
  }

  private slot(col: Col, k: number) {
    return { x: col.cx - 640 + ((k % 3) - 1) * this.cell, y: 76 - Math.floor(k / 3) * this.cell };
  }

  private total() {
    return this.cols.reduce((s, c) => s + c.pieces.length * 10 ** c.place, 0);
  }

  private refresh() {
    for (const c of this.cols) c.countT.setText(String(c.pieces.length));
    this.totalT?.setText(`Total: ${formatNum(this.total())}`);
  }

  private addPiece(col: Col, fromX: number, fromY: number, instant = false) {
    if (!this.crate) return;
    if (col.pieces.length >= MAX_PER_COL) {
      wobble(this, col.countT);
      return;
    }
    const k = col.pieces.length;
    const s = this.slot(col, k);
    const p = makePiece(this, col.place, this.cell, this.cell);
    this.crate.add(p);
    col.pieces.push(p);
    if (instant) {
      p.setPosition(s.x, s.y).setScale(0);
      this.tweens.add({ targets: p, scale: 1, duration: 200, ease: 'Back.easeOut' });
    } else {
      p.setPosition(fromX - 640, fromY - CRATE_Y).setScale(1.7);
      audio.sfx('click');
      this.tweens.add({ targets: p, x: s.x, y: s.y, scale: 1, duration: 280, ease: 'Cubic.easeOut' });
    }
    this.refresh();
  }

  private removePiece(col: Col) {
    const p = col.pieces.pop();
    if (!p) return;
    audio.sfx('click');
    this.tweens.killTweensOf(p);
    this.tweens.add({
      targets: p,
      y: p.y - 30,
      scale: 0,
      alpha: 0,
      duration: 180,
      onComplete: () => p.destroy(),
    });
    this.refresh();
  }

  private clearPieces() {
    for (const c of this.cols) {
      for (const p of c.pieces) {
        this.tweens.killTweensOf(p);
        p.destroy();
      }
      c.pieces = [];
    }
  }

  /** Fill the crate with `digs` (most significant first, aligned to the columns). */
  private setCounts(digs: number[]) {
    this.clearPieces();
    this.cols.forEach((c) => {
      const idx = digs.length - 1 - c.place;
      const cnt = idx >= 0 ? digs[idx] : 0;
      for (let i = 0; i < cnt; i++) this.addPiece(c, 0, 0, true);
    });
    this.refresh();
  }

  private check() {
    if (!this.canAnswer || !this.crate) return;
    const t = this.total();
    if (t === 0) {
      wobble(this, this.crate);
      return;
    }
    this.submit(t);
  }

  // ---------------------------------------------------------------- count

  private buildCount(problem: Problem, count: number, item: string) {
    this.track(fitText(addText(this, 640, 212, problem.prompt, 48, { wordWrap: { width: 1000 } }), 1040, 60));
    const small = count <= 10;
    const cols = small ? 6 : 9;
    const rows = small ? 2 : 3;
    const step = 112;
    const slots: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) slots.push({ x: 640 + (c - (cols - 1) / 2) * step, y: 452 + (r - (rows - 1) / 2) * step });
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const bg = this.track(this.add.graphics());
    bg.fillStyle(0xc9d6f5, 0.7).fillRoundedRect(110, 265, 1060, 372, 30);
    for (let i = 0; i < Math.min(count, slots.length); i++) {
      const s = slots[i];
      const x = s.x + (this.rng() - 0.5) * 20;
      const y = s.y + (this.rng() - 0.5) * 20;
      const img = this.track(addCountIcon(this, item, x, y, 88).setDepth(5));
      const rec = { img, counted: false };
      this.countItems.push(rec);
      const hit = this.track(this.add.zone(x, y, 104, 104).setInteractive({ useHandCursor: true }).setDepth(6));
      hit.on('pointerdown', () => this.countOne(rec, x, y));
    }
    this.countedT = this.track(addText(this, 640, 686, 'Counted: 0', 46));
    this.makeChoices(problem);
  }

  private countOne(rec: { img: IconObj; counted: boolean }, x: number, y: number) {
    if (!this.canAnswer || rec.counted) return;
    rec.counted = true;
    this.counted++;
    audio.sfx('click');
    this.tweens.add({ targets: rec.img, y: y - 22, duration: 130, yoyo: true, ease: 'Quad.easeOut' });
    const badge = this.add.container(x + 34, y - 36).setDepth(8);
    const g = this.add.graphics();
    g.fillStyle(0x1d1a3a, 1).fillCircle(0, 0, 28);
    g.fillStyle(0xffc93c, 1).fillCircle(0, 0, 24);
    const t = this.add.text(0, -1, String(this.counted), textStyle(36, { color: '#1d1a3a', stroke: '#fff1a8', strokeThickness: 2 })).setOrigin(0.5);
    fitText(t, 44);
    badge.add([g, t]).setScale(0);
    this.objs.push(badge);
    this.tweens.add({ targets: badge, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.countedT?.setText(`Counted: ${this.counted}`);
  }

  // ---------------------------------------------------------------- digitValue

  private buildDigitValue(problem: Problem, n: number, placeIndex: number) {
    const entry = isEntry(problem);
    const cx = entry ? 370 : 640;
    const span = entry ? 560 : 1000;
    if (entry) this.track(fitText(addText(this, cx, 250, problem.prompt, 46, { wordWrap: { width: span } }), span + 20, 130));
    else this.track(fitText(addText(this, 640, 212, problem.prompt, 48, { wordWrap: { width: 1000 } }), 1040, 60));
    const str = String(n);
    const k = str.length;
    const hi = k - 1 - placeIndex;
    const bw = Math.min(130, span / k - 14);
    const gap = 14;
    const x0 = cx - ((k - 1) * (bw + gap)) / 2;
    for (let i = 0; i < k; i++) {
      const x = x0 + i * (bw + gap);
      const box = this.track(this.add.container(x, entry ? 450 : 345).setDepth(5));
      const g = this.add.graphics();
      const on = i === hi;
      g.fillStyle(0x1d1a3a, 1).fillRoundedRect(-bw / 2 - 4, -84, bw + 8, 168, 22);
      g.fillStyle(on ? 0xff8a1f : 0xfff8ea, 1).fillRoundedRect(-bw / 2, -80, bw, 160, 18);
      g.fillStyle(on ? 0xe8472b : 0xc9d6f5, 1).fillRoundedRect(-bw / 2, 44, bw, 36, { tl: 0, tr: 0, bl: 18, br: 18 });
      const t = this.add
        .text(0, -6, str[i], textStyle(Math.min(110, Math.round(bw * 0.85)), on ? {} : { color: '#2e2a5c', stroke: '#fff8ea', strokeThickness: 3 }))
        .setOrigin(0.5);
      box.add([g, t]);
      if (on) this.tweens.add({ targets: box, scale: 1.1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    if (entry) {
      this.pad = makeAnswerPad(this, answerPadMode(problem), (v) => this.pickTyped(v), { top: 215, maxDigits: 6, problem });
      return;
    }
    // The matching pieces as a picture.
    const digit = Number(str[hi]);
    const bgp = this.track(this.add.graphics());
    bgp.fillStyle(0xc9d6f5, 0.85).fillRoundedRect(110, 460, 1060, 190, 28);
    bgp.lineStyle(5, 0x1d1a3a, 1).strokeRoundedRect(110, 460, 1060, 190, 28);
    const sz = Math.min(128, 1000 / Math.max(digit, 1) - 8);
    const pw = placeIndex <= 3 ? sz : Math.min(sz * 1.3, 1000 / digit - 8);
    const step = pw + 8;
    for (let i = 0; i < digit; i++) {
      const p = makePiece(this, placeIndex, pw, sz, false);
      p.setPosition(640 + (i - (digit - 1) / 2) * step, 555).setDepth(5);
      this.track(p);
    }
    this.makeChoices(problem);
  }

  private pickTyped(v: number | string) {
    if (!this.canAnswer) return;
    this.submit(v);
  }

  // ---------------------------------------------------------------- feedback

  protected debugPick(v: number | string) {
    const p = this.problem;
    if (this.pad) {
      if (!this.pad.enter(v)) this.submit(v);
      return;
    }
    if (this.mode === 'placeValue' && typeof v === 'number' && this.cols.length) {
      const digs = String(v).split('').map(Number);
      if (digs.length <= this.cols.length && Number.isFinite(v) && v >= 0) {
        this.setCounts(digs);
        this.check();
        return;
      }
    }
    if (this.choices && p) this.pick(v);
    else this.submit(v);
  }

  protected onWrong(kind: WrongKind) {
    if (this.mode === 'placeValue') {
      if (this.crate) wobble(this, this.crate);
      if (kind === 'reveal' && this.problem?.data.kind === 'placeValue') this.setCounts(this.problem.data.digits.slice(-this.cols.length));
    } else if (this.pad) {
      this.pad.wobble();
      this.pad.clear();
    } else if (this.choices && this.lastPick !== null) {
      this.choices.wobble(this.lastPick);
      this.choices.dim(this.lastPick);
    }
  }

  protected onRoundWon() {
    if (this.mode === 'placeValue') {
      let i = 0;
      for (const c of this.cols)
        for (const p of c.pieces)
          this.tweens.add({ targets: p, y: p.y - 26, duration: 150, yoyo: true, delay: 40 * i++, ease: 'Quad.easeOut' });
      starBurst(this, 640, CRATE_Y, 0xffc93c, 40, 16);
      return 300;
    }
    if (this.mode === 'count') {
      this.countItems.forEach((it, i) =>
        this.tweens.add({ targets: it.img, scale: it.img.scale * 1.2, duration: 150, yoyo: true, delay: 30 * i }),
      );
    }
    const b = this.choices && this.lastPick !== null ? this.choices.find(this.lastPick) : undefined;
    if (b) {
      this.tweens.add({ targets: b.root, scale: 1.12, duration: 160, yoyo: true });
      starBurst(this, b.root.x, b.root.y, 0xffc93c, 40, 14);
    } else {
      starBurst(this, 640, 700, 0xffc93c, 40, 14);
    }
    return 200;
  }

  protected clearRound() {
    for (const c of this.cols) c.pieces.forEach((p) => this.tweens.killTweensOf(p));
    this.cols = [];
    if (this.crate) this.tweens.killTweensOf(this.crate);
    this.crate = null;
    for (const o of this.objs) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.objs = [];
    this.countItems = [];
    this.choices?.destroy();
    this.choices = null;
    this.pad?.destroy();
    this.pad = null;
    this.totalT = null;
    this.countedT = null;
  }
}
