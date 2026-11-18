// Coin Shop: Marlow the marmot keeps a shop. Pay exact prices with coins (coinPay), count coins
// (coinCount), pick the change (change) or add up price tags (priceTotal).
import Phaser from 'phaser';
import { miniGameSceneKey, Problem } from '../types';
import { TEX, friendKey } from '../art/keys';
import { MiniGameScene, WrongKind } from './base';
import { AnswerPad, ChoiceButtons, answerPadMode, fitText, isEntry, makeAnswerPad, makeBubble, makeChoiceButtons } from './widgets';
import { addText, makeButton, starBurst, textStyle, wobble } from '../core/ui';
import { audio } from '../core/audio';
import { formatCents } from '../math/format';

type Obj = Phaser.GameObjects.GameObject;

const INK = 0x1d1a3a;
const COIN_FRAME: Record<number, number> = { 1: 0, 5: 1, 10: 2, 25: 3, 100: 4, 500: 5 };
const MAX_COINS = 14;
const COUNTER_TOP = 395;
const COUNTER_FACE_BOT = 602;
const TRAY_Y = 806;

type ItemName = 'cocoa' | 'mittens' | 'bell' | 'carrot' | 'scarf' | 'cone';
const ITEMS: ItemName[] = ['cocoa', 'mittens', 'bell', 'carrot', 'scarf'];

/** Simple original shop items, about 100 x 100 around (0,0). */
function drawItem(scene: Phaser.Scene, name: ItemName): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);
  const g = scene.add.graphics();
  root.add(g);
  g.lineStyle(4, INK, 1);
  const poly = (pts: number[][], fill: number) => {
    g.fillStyle(fill, 1).fillPoints(pts.map(([x, y]) => new Phaser.Geom.Point(x, y)), true);
    g.strokePoints(pts.map(([x, y]) => new Phaser.Geom.Point(x, y)), true);
  };
  const rr = (x: number, y: number, w: number, h: number, r: number | Phaser.Types.GameObjects.Graphics.RoundedRectRadius, fill: number) => {
    g.fillStyle(fill, 1).fillRoundedRect(x, y, w, h, r);
    g.strokeRoundedRect(x, y, w, h, r);
  };
  const ell = (x: number, y: number, w: number, h: number, fill: number) => {
    g.fillStyle(fill, 1).fillEllipse(x, y, w, h);
    g.strokeEllipse(x, y, w, h);
  };
  switch (name) {
    case 'cocoa': {
      g.lineStyle(5, 0xd6fbff, 0.9);
      for (const x of [-16, 2, 20]) g.beginPath().moveTo(x, -34).lineTo(x + 6, -42).lineTo(x - 2, -50).strokePath();
      g.lineStyle(4, INK, 1);
      g.lineStyle(15, INK, 1).beginPath().arc(34, 8, 17, -Math.PI / 2, Math.PI / 2).strokePath();
      g.lineStyle(7, 0xfff8ea, 1).beginPath().arc(34, 8, 17, -Math.PI / 2, Math.PI / 2).strokePath();
      g.lineStyle(4, INK, 1);
      rr(-36, -24, 70, 70, 14, 0xe8472b);
      g.fillStyle(0xb3261e, 1).fillRoundedRect(-33, 30, 64, 13, { tl: 0, tr: 0, bl: 12, br: 12 });
      ell(0, -24, 70, 18, 0x5a3320);
      g.fillStyle(0xfff8ea, 1).fillCircle(-10, -26, 8).fillCircle(8, -24, 7);
      g.fillStyle(0xfff1a8, 1).fillRect(-26, -2, 8, 28);
      break;
    }
    case 'mittens': {
      const mit = (x: number, fill: number, dir: number) => {
        ell(x + dir * 24, -4, 18, 30, fill);
        rr(x - 24, -36, 48, 62, 20, fill);
        rr(x - 26, 16, 52, 20, 7, 0xfff8ea);
        g.fillStyle(0xfff8ea, 0.6).fillRoundedRect(x - 14, -28, 8, 24, 4);
      };
      mit(-26, 0xe8472b, 1);
      mit(28, 0xd83a9a, -1);
      break;
    }
    case 'bell': {
      rr(-34, -34, 68, 60, { tl: 34, tr: 34, bl: 6, br: 6 }, 0xffc93c);
      rr(-46, 20, 92, 18, 9, 0xff8a1f);
      g.fillStyle(0xfff1a8, 1).fillRoundedRect(-24, -24, 11, 34, 5);
      g.fillStyle(0x1d1a3a, 1).fillCircle(0, 46, 10);
      g.fillStyle(0xe8472b, 1).fillCircle(-14, -42, 11).fillCircle(14, -42, 11);
      g.strokeCircle(-14, -42, 11);
      g.strokeCircle(14, -42, 11);
      g.fillStyle(0xb3261e, 1).fillCircle(0, -40, 8);
      g.strokeCircle(0, -40, 8);
      break;
    }
    case 'carrot': {
      poly([[-15, -38], [-4, -62], [2, -36]], 0x3fa06a);
      poly([[0, -40], [12, -66], [18, -38]], 0x8fd18a);
      poly([[-2, -40], [-30, -56], [-18, -32]], 0x1f6b52);
      poly([[-30, -26], [30, -26], [4, 54], [-4, 54]], 0xff8a1f);
      ell(0, -26, 62, 22, 0xff8a1f);
      g.lineStyle(4, 0xe8472b, 1);
      g.beginPath().moveTo(-14, -8).lineTo(-3, -8).strokePath();
      g.beginPath().moveTo(3, 10).lineTo(14, 10).strokePath();
      g.beginPath().moveTo(-6, 28).lineTo(3, 28).strokePath();
      break;
    }
    case 'scarf': {
      rr(14, 6, 30, 46, 6, 0xe8472b);
      g.fillStyle(0xfff8ea, 1).fillRect(16, 26, 26, 9);
      g.lineStyle(4, 0xfff8ea, 1);
      for (const x of [20, 28, 36]) g.beginPath().moveTo(x, 52).lineTo(x, 60).strokePath();
      g.lineStyle(4, INK, 1);
      rr(-50, -26, 100, 46, 12, 0xe8472b);
      g.fillStyle(0xfff8ea, 1).fillRect(-26, -26, 12, 46).fillRect(14, -26, 12, 46);
      g.fillStyle(0xb3261e, 1).fillRect(-50, 8, 100, 10);
      g.strokeRoundedRect(-50, -26, 100, 46, 12);
      break;
    }
    case 'cone': {
      poly([[-28, -8], [28, -8], [0, 52]], 0xc58a4a);
      g.lineStyle(3, 0x8a5530, 1);
      g.beginPath().moveTo(-14, -8).lineTo(8, 36).strokePath();
      g.beginPath().moveTo(14, -8).lineTo(-8, 36).strokePath();
      g.lineStyle(4, INK, 1);
      g.fillStyle(0xff8fcf, 1).fillCircle(0, -26, 34);
      g.strokeCircle(0, -26, 34);
      g.fillStyle(0xd83a9a, 1).fillRoundedRect(-30, -10, 60, 12, 6);
      g.fillStyle(0xfff8ea, 0.8).fillCircle(-14, -40, 8);
      g.fillStyle(0xffc93c, 1).fillCircle(10, -34, 4).fillCircle(-6, -18, 4).fillCircle(18, -18, 4);
      break;
    }
  }
  return root;
}

/** A hanging price tag, centre origin, about 150 x 66. */
function makeTag(scene: Phaser.Scene, text: string, w = 150) {
  const root = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(INK, 1).fillRoundedRect(-w / 2 - 4, -36, w + 8, 72, 16);
  g.fillStyle(0xfff8ea, 1).fillRoundedRect(-w / 2, -32, w, 64, 13);
  g.fillStyle(0xffc93c, 1).fillCircle(-w / 2 + 14, 0, 8);
  g.lineStyle(3, INK, 1).strokeCircle(-w / 2 + 14, 0, 8);
  const t = scene.add.text(10, -2, text, textStyle(44, { color: '#1d1a3a', stroke: '#fff8ea', strokeThickness: 2 })).setOrigin(0.5);
  fitText(t, w - 46);
  root.add([g, t]);
  return root;
}

/** A bill for $10 and up (the $1 and $5 bills come from the coin sheet). */
function makeBill(scene: Phaser.Scene, cents: number, w = 180) {
  const h = w * 0.54;
  const root = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(INK, 1).fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 12);
  g.fillStyle(0x8fd18a, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 9);
  g.lineStyle(3, 0x1f6b52, 1).strokeRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 6);
  g.fillStyle(0xc9f0b8, 1).fillEllipse(0, 0, w * 0.5, h * 0.7);
  const t = scene.add.text(0, -2, `$${Math.round(cents / 100)}`, textStyle(44, { color: '#143d3a', stroke: '#e6ffd8', strokeThickness: 3 })).setOrigin(0.5);
  root.add([g, t]);
  return root;
}

interface CoinRec {
  value: number;
  img: Phaser.GameObjects.Image;
}

export class CoinShopScene extends MiniGameScene {
  protected readonly title = 'Coin Shop';
  private marlow!: Phaser.GameObjects.Image;
  private objs: Obj[] = [];
  private choices: ChoiceButtons | null = null;
  private lastPick: number | string | null = null;
  private promptBubble: Phaser.GameObjects.Container | null = null;
  private mode: 'pay' | 'choice' = 'choice';
  private pad: AnswerPad | null = null;
  /** Level 10+ (not coinPay): the answer is typed on a money pad, and the counter picture moves left. */
  private entry = false;
  // coinPay state
  private coins: CoinRec[] = [];
  private counterRoot: Phaser.GameObjects.Container | null = null;
  private trayPos = new Map<number, { x: number; y: number }>();
  private totalT: Phaser.GameObjects.Text | null = null;
  private emptyT: Phaser.GameObjects.Text | null = null;
  private tray: number[] = [];

  constructor() {
    super({ key: miniGameSceneKey('coinShop') });
  }

  protected hintAnchor() {
    return this.entry ? { x: 400, y: 725 } : { x: 640, y: 322 };
  }

  protected hintWidth() {
    return this.entry ? 600 : 1000;
  }

  // ---------------------------------------------------------------- static shop

  protected setupGame() {
    this.objs = [];
    const g = this.add.graphics().setDepth(0);
    // back wall
    g.fillStyle(INK, 1).fillRoundedRect(86, 181, 1108, 224, 26);
    g.fillStyle(0xb9c3f0, 1).fillRoundedRect(90, 185, 1100, 216, 24);
    g.fillStyle(0x8a92d8, 1).fillRect(90, 340, 1100, 61);
    // awning
    const stripes = 11;
    const sw = 1100 / stripes;
    for (let i = 0; i < stripes; i++) {
      g.fillStyle(i % 2 ? 0xfff8ea : 0xe8472b, 1).fillRect(90 + i * sw, 185, sw + 1, 46);
      g.fillStyle(i % 2 ? 0xfff8ea : 0xe8472b, 1).fillCircle(90 + i * sw + sw / 2, 231, sw / 2);
      g.lineStyle(4, INK, 1).beginPath().arc(90 + i * sw + sw / 2, 231, sw / 2, 0, Math.PI).strokePath();
    }
    g.lineStyle(5, INK, 1).strokeRoundedRect(90, 185, 1100, 216, 24);
    // Marlow
    this.marlow = this.add.image(170, 452, friendKey('marlow'), 0).setOrigin(0.5, 1).setDepth(1);
    // counter
    const c = this.add.graphics().setDepth(2);
    c.fillStyle(INK, 1).fillRoundedRect(82, COUNTER_TOP - 6, 1116, 244, 26);
    c.fillStyle(0xc58a4a, 1).fillRoundedRect(90, COUNTER_TOP, 1100, COUNTER_FACE_BOT - COUNTER_TOP + 4, 20);
    c.fillStyle(0xeec07a, 1).fillRoundedRect(90, COUNTER_TOP, 1100, 22, { tl: 20, tr: 20, bl: 0, br: 0 });
    c.lineStyle(3, 0x8a5530, 0.5);
    for (const y of [500, 552]) c.beginPath().moveTo(100, y).lineTo(1180, y).strokePath();
    c.fillStyle(0x8a5530, 1).fillRoundedRect(90, COUNTER_FACE_BOT, 1100, 30, { tl: 0, tr: 0, bl: 20, br: 20 });
    c.fillStyle(0x5a3320, 1).fillRect(90, COUNTER_FACE_BOT + 22, 1100, 8);
    c.lineStyle(5, INK, 1).strokeRoundedRect(90, COUNTER_TOP, 1100, COUNTER_FACE_BOT - COUNTER_TOP + 30, 20);
  }

  // ---------------------------------------------------------------- rounds

  private track<T extends Obj>(o: T): T {
    this.objs.push(o);
    return o;
  }

  protected buildRound(problem: Problem) {
    this.objs = [];
    this.coins = [];
    this.counterRoot = null;
    this.totalT = null;
    this.emptyT = null;
    this.choices = null;
    this.lastPick = null;
    this.promptBubble = null;
    this.pad = null;
    const d = problem.data;
    this.entry = isEntry(problem) && d.kind !== 'coinPay';
    this.marlow.setFrame(1);
    this.tweens.add({ targets: this.marlow, y: 446, duration: 260, yoyo: true, repeat: 1 });
    let say = problem.prompt;
    if (d.kind === 'coinCount') {
      const total = d.coins.reduce((a, b) => a + b, 0);
      say = total < 100 ? 'Count the money. How many cents in all?' : 'Count the money. How much is that in all?';
    }
    this.promptBubble = makeBubble(this, this.entry ? 450 : 640, 312, say, this.entry ? 440 : 700, 36).setDepth(10);
    this.promptBubble.setScale(0.7);
    this.tweens.add({ targets: this.promptBubble, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.track(this.promptBubble);

    if (d.kind === 'coinPay') {
      this.mode = 'pay';
      this.buildPay(problem, d.priceCents, d.tray);
    } else {
      this.mode = 'choice';
      if (d.kind === 'coinCount') this.buildCoinCount(d.coins);
      else if (d.kind === 'priceTotal') this.buildPriceTotal(d.pricesCents);
      else if (d.kind === 'change') this.buildChange(d.paidCents, d.priceCents);
      if (this.entry) {
        this.choices = null;
        this.pad = makeAnswerPad(this, answerPadMode(problem), (v) => this.pick(v), { top: 215, maxDigits: 6, problem });
        return;
      }
      this.choices = makeChoiceButtons(this, problem.choices, (v) => this.pick(v), {
        x: 640,
        y: 785,
        width: 1040,
        height: 120,
        fontSize: 60,
        problem,
      });
    }
  }

  private pick(v: number | string) {
    if (!this.canAnswer) return;
    this.lastPick = v;
    this.submit(v);
  }

  private placeItem(name: ItemName, x: number, y: number, scale = 1) {
    const it = drawItem(this, name).setPosition(x, y).setScale(scale).setDepth(6);
    return this.track(it);
  }

  // ---- coinCount

  private buildCoinCount(values: number[]) {
    const sorted = [...values].sort((a, b) => b - a);
    if (this.entry) {
      const cols = Math.min(sorted.length, 5);
      const step = Math.min(118, 540 / cols);
      sorted.forEach((v, i) => {
        const r = Math.floor(i / cols);
        const inRow = Math.min(cols, sorted.length - r * cols);
        const x = 380 + ((i % cols) - (inRow - 1) / 2) * step;
        this.track(this.add.image(x, 470 + r * 112, TEX.coin, COIN_FRAME[v] ?? 0).setDisplaySize(step * 0.96, step * 0.96).setDepth(6));
      });
      return;
    }
    const groups = new Set(sorted).size;
    const gapG = 34;
    const step = Math.min(180, (1040 - (groups - 1) * gapG) / sorted.length);
    const size = step * 0.96;
    const totalW = sorted.length * step + (groups - 1) * gapG;
    let x = 640 - totalW / 2 + step / 2;
    let prev = -1;
    sorted.forEach((v, i) => {
      if (i > 0 && v !== prev) x += gapG;
      prev = v;
      const img = this.add.image(x, 498, TEX.coin, COIN_FRAME[v] ?? 0).setDisplaySize(size, size).setDepth(6);
      this.track(img);
      x += step;
    });
  }

  // ---- priceTotal

  private buildPriceTotal(prices: number[]) {
    const n = prices.length;
    const step = this.entry ? Math.min(180, 540 / n) : Math.min(210, 1040 / n);
    const cx0 = this.entry ? 380 : 640;
    const start = Math.floor(this.rng() * ITEMS.length);
    prices.forEach((p, i) => {
      const x = cx0 + (i - (n - 1) / 2) * step;
      this.placeItem(ITEMS[(start + i) % ITEMS.length], x, 464, this.entry ? Math.min(1.05, step / 130) : 1.05);
      const tag = makeTag(this, formatCents(p), Math.min(150, step - 20)).setPosition(x, 562).setDepth(7);
      this.track(tag);
    });
  }

  // ---- change

  private buildChange(paid: number, price: number) {
    const name = ITEMS[Math.floor(this.rng() * ITEMS.length)];
    const lx = this.entry ? 220 : 330;
    const rx = this.entry ? 540 : 930;
    this.placeItem(name, lx, 466, this.entry ? 0.95 : 1.15);
    this.track(makeTag(this, `Cost: ${formatCents(price)}`, this.entry ? 230 : 270).setPosition(lx, 566).setDepth(7));
    // paid
    if (COIN_FRAME[paid] !== undefined && paid >= 100) {
      this.track(this.add.image(rx, 468, TEX.coin, COIN_FRAME[paid]).setDisplaySize(this.entry ? 150 : 190, this.entry ? 150 : 190).setDepth(6));
    } else {
      this.track(makeBill(this, paid).setPosition(rx, 468).setScale(this.entry ? 0.85 : 1.0).setDepth(6));
    }
    const lab = makeTag(this, `Paid: ${formatCents(paid)}`, this.entry ? 230 : 290).setPosition(rx, 566).setDepth(7);
    this.track(lab);
  }

  // ---- coinPay

  private buildPay(problem: Problem, price: number, tray: number[]) {
    this.tray = [...tray].sort((a, b) => a - b);
    const cone = /snow cone/i.test(problem.prompt);
    const name = cone ? 'cone' : ITEMS[Math.floor(this.rng() * ITEMS.length)];
    this.placeItem(name, 1090, 362, 0.8);
    this.track(makeTag(this, formatCents(price)).setPosition(1090, 270).setDepth(7));

    this.counterRoot = this.track(this.add.container(0, 0).setDepth(6));
    this.emptyT = this.track(addText(this, 640, 505, 'Tap coins to put them here', 40, { color: '#fff8ea' }).setDepth(5).setAlpha(0.8));

    // info row
    this.totalT = this.track(addText(this, 340, 690, 'So far: 0¢', 56).setDepth(6));
    const pay = makeButton(this, 960, 690, 320, 110, 'Pay', () => this.pay(), 60);
    pay.root.setDepth(6);
    this.track(pay.root);

    // tray (unlimited coins)
    const bg = this.track(this.add.graphics());
    bg.fillStyle(0xc9d6f5, 0.85).fillRoundedRect(100, 742, 1080, 128, 28);
    bg.lineStyle(5, INK, 1).strokeRoundedRect(100, 742, 1080, 128, 28);
    this.trayPos.clear();
    const n = this.tray.length;
    const sp = Math.min(175, 1000 / n);
    this.tray.forEach((v, i) => {
      const x = 640 + (i - (n - 1) / 2) * sp;
      this.trayPos.set(v, { x, y: TRAY_Y });
      const img = this.add.image(x, TRAY_Y, TEX.coin, COIN_FRAME[v]).setDisplaySize(112, 112).setDepth(6);
      this.track(img);
      const z = this.track(this.add.zone(x, TRAY_Y, Math.min(sp - 4, 160), 124).setInteractive({ useHandCursor: true }).setDepth(9));
      z.on('pointerdown', () => {
        if (!this.canAnswer) return;
        this.tweens.add({ targets: img, scale: img.scale * 0.88, duration: 70, yoyo: true });
        this.addCoin(v);
      });
    });
    this.refreshPay();
  }

  private total() {
    return this.coins.reduce((s, c) => s + c.value, 0);
  }

  private slotFor(i: number, n: number) {
    const rows = n > 7 ? 2 : 1;
    const row = i < 7 ? 0 : 1;
    const inRow = row === 0 ? Math.min(7, n) : n - 7;
    const c = row === 0 ? i : i - 7;
    return { x: 640 + (c - (inRow - 1) / 2) * 128, y: rows === 1 ? 505 : 455 + row * 100 };
  }

  private reflow() {
    this.coins.sort((a, b) => b.value - a.value);
    const n = this.coins.length;
    this.coins.forEach((c, i) => {
      const s = this.slotFor(i, n);
      this.tweens.killTweensOf(c.img);
      this.tweens.add({ targets: c.img, x: s.x, y: s.y, scale: 92 / c.img.width, duration: 220, ease: 'Cubic.easeOut' });
    });
  }

  private refreshPay() {
    this.totalT?.setText(`So far: ${formatCents(this.total())}`);
    this.emptyT?.setVisible(this.coins.length === 0);
  }

  private addCoin(v: number, instant = false) {
    if (!this.counterRoot) return;
    if (this.coins.length >= MAX_COINS) {
      wobble(this, this.counterRoot);
      return;
    }
    const from = this.trayPos.get(v) ?? { x: 640, y: TRAY_Y };
    const img = this.add.image(from.x, from.y, TEX.coin, COIN_FRAME[v] ?? 0).setDisplaySize(112, 112);
    this.counterRoot.add(img);
    const rec: CoinRec = { value: v, img };
    this.coins.push(rec);
    img.setInteractive(new Phaser.Geom.Rectangle(-14, -14, img.width + 28, img.height + 28), Phaser.Geom.Rectangle.Contains);
    if (img.input) img.input.cursor = 'pointer';
    img.on('pointerdown', () => {
      if (!this.canAnswer) return;
      this.removeCoin(rec);
    });
    if (!instant) audio.sfx('click');
    this.reflow();
    if (instant) {
      const i = this.coins.indexOf(rec);
      const s = this.slotFor(i, this.coins.length);
      this.tweens.killTweensOf(img);
      img.setPosition(s.x, s.y).setDisplaySize(92, 92);
    }
    this.refreshPay();
  }

  private removeCoin(rec: CoinRec) {
    const i = this.coins.indexOf(rec);
    if (i < 0) return;
    this.coins.splice(i, 1);
    audio.sfx('click');
    const to = this.trayPos.get(rec.value) ?? { x: 640, y: TRAY_Y };
    this.tweens.killTweensOf(rec.img);
    rec.img.disableInteractive();
    this.tweens.add({ targets: rec.img, x: to.x, y: to.y, alpha: 0, duration: 200, onComplete: () => rec.img.destroy() });
    this.reflow();
    this.refreshPay();
  }

  private clearCoins() {
    for (const c of this.coins) {
      this.tweens.killTweensOf(c.img);
      c.img.destroy();
    }
    this.coins = [];
  }

  private pay() {
    if (!this.canAnswer || !this.counterRoot) return;
    if (this.coins.length === 0) {
      wobble(this, this.counterRoot);
      return;
    }
    this.submit(this.total());
  }

  // ---------------------------------------------------------------- feedback

  protected debugPick(v: number | string) {
    if (this.mode === 'pay' && typeof v === 'number' && this.counterRoot) {
      let rest = v;
      const list: number[] = [];
      for (const c of [...this.tray].sort((a, b) => b - a)) {
        while (rest >= c && list.length <= MAX_COINS) {
          list.push(c);
          rest -= c;
        }
      }
      if (rest === 0 && list.length > 0 && list.length <= MAX_COINS) {
        this.clearCoins();
        list.forEach((c) => this.addCoin(c, true));
        this.pay();
        return;
      }
    }
    if (this.pad) {
      if (!this.pad.enter(v)) this.submit(v);
    } else if (this.choices) this.pick(v);
    else this.submit(v);
  }

  protected onWrong(kind: WrongKind) {
    if (kind !== 'retry' && this.promptBubble) this.promptBubble.setVisible(false);
    if (this.pad) {
      this.pad.wobble();
      this.pad.clear();
    }
    if (this.mode === 'pay') {
      if (this.counterRoot) wobble(this, this.counterRoot);
    } else if (this.choices && this.lastPick !== null) {
      this.choices.wobble(this.lastPick);
      this.choices.dim(this.lastPick);
    }
    if (kind === 'reveal') this.marlow.setFrame(0);
  }

  protected onRoundWon() {
    this.tweens.add({ targets: this.marlow, y: 420, duration: 200, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
    if (this.mode === 'pay') {
      this.coins.forEach((c, i) => this.tweens.add({ targets: c.img, y: c.img.y - 24, duration: 150, yoyo: true, delay: 40 * i }));
      starBurst(this, 640, 505, 0xffc93c, 40, 18);
    } else {
      const b = this.choices && this.lastPick !== null ? this.choices.find(this.lastPick) : undefined;
      if (b) {
        this.tweens.add({ targets: b.root, scale: 1.12, duration: 160, yoyo: true });
        starBurst(this, b.root.x, b.root.y, 0xffc93c, 40, 14);
      }
      starBurst(this, 640, 480, 0xffc93c, 40, 12);
    }
    return 200;
  }

  protected clearRound() {
    this.clearCoins();
    this.counterRoot = null;
    for (const o of this.objs) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.objs = [];
    this.promptBubble = null;
    this.choices?.destroy();
    this.choices = null;
    this.pad?.destroy();
    this.pad = null;
    this.totalT = null;
    this.emptyT = null;
    this.marlow.setFrame(0);
    this.tweens.killTweensOf(this.marlow);
    this.marlow.y = 452;
  }
}
