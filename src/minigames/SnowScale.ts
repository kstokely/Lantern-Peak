// Snow Scale: a wooden balance scale with snow weights. Compare mode: which side is heavier (<, =, >).
// Balance mode: the left pan holds a and an empty slot, the right pan holds the result; drop a numbered weight
// from the tray (or, at level 10+, type the number) so the beam levels out. The beam tilts live with the totals.
import Phaser from 'phaser';
import { miniGameSceneKey, Problem } from '../types';
import { MiniGameScene, WrongKind } from './base';
import { COLOR, makeButton, starBurst, textStyle, wobble } from '../core/ui';
import { ICON_PLURAL, formatNum } from '../math/format';
import { AnswerPad, ChoiceButtons, addCountIcon, fitText, isEntry, makeAnswerPad, makeChoiceButtons } from './widgets';

const BL = 300; // half beam length
const CL = 240; // cord length from beam end down to the pan rim
const PW = 135; // half pan width
const PH = 360; // post height (pivot to ground)
const MAX_TILT = 0.26; // radians, about 15 degrees
const BLOCK_W = 236;
const BLOCK_H = 62;
const ICON_POOL = ['snowball', 'gem', 'pinecone', 'star', 'lantern', 'carrot', 'mitten', 'acorn', 'berry', 'bell', 'cookie', 'apple'] as const;
const SIGN_ORDER = ['<', '=', '>'];

type Part = { t: 'icons'; n: number; icon: string } | { t: 'block'; text: string; slot?: boolean };

interface TrayWeight {
  root: Phaser.GameObjects.Container;
  value: number;
  home: { x: number; y: number };
  used: boolean;
}

function drawBlock(g: Phaser.GameObjects.Graphics, w: number, h: number, fill = 0xfff8ea) {
  g.fillStyle(COLOR.ink, 1).fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 20);
  g.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 16);
  g.fillStyle(0xc9d6f5, 1).fillRoundedRect(-w / 2, h / 2 - 16, w, 16, { tl: 0, tr: 0, bl: 16, br: 16 });
  g.fillStyle(0xffffff, 0.7).fillRoundedRect(-w / 2 + 12, -h / 2 + 8, w * 0.4, 8, 4);
}

export class SnowScaleScene extends MiniGameScene {
  protected readonly title = 'Snow Scale';
  private entry = false;
  private mode: 'compare' | 'missing' = 'missing';
  private revealed = false;
  private k = 1;
  private root: Phaser.GameObjects.Container | null = null;
  private beam: Phaser.GameObjects.Container | null = null;
  private cords: Phaser.GameObjects.Graphics | null = null;
  private pans: Phaser.GameObjects.Container[] = [];
  private tilt = { t: 0 };
  private slotG: Phaser.GameObjects.Graphics | null = null;
  private slotT: Phaser.GameObjects.Text | null = null;
  private slotBox: Phaser.GameObjects.Container | null = null;
  private slotValue: number | null = null;
  private slotW: TrayWeight | null = null;
  private tray: TrayWeight[] = [];
  private trayObjs: Phaser.GameObjects.GameObject[] = [];
  private roundObjs: Phaser.GameObjects.GameObject[] = [];
  private choices: ChoiceButtons | null = null;
  private pad: AnswerPad | null = null;
  private lastSign: string | null = null;
  /** Balance mode: the weight the beam is showing the result of (set by Check). null = beam stays level and wobbles. */
  private truth: number | null = null;
  /** True while a wrong Check is showing which side is heavier (input is ignored until it resets). */
  private settling = false;
  private settleEvt: Phaser.Time.TimerEvent | null = null;
  private wob = 0;

  constructor() {
    super({ key: miniGameSceneKey('snowScale') });
  }

  protected hintAnchor() {
    return this.entry ? { x: 370, y: 745 } : { x: 640, y: this.mode === 'compare' ? 650 : 690 };
  }

  protected hintWidth() {
    return this.entry ? 600 : 1000;
  }

  // ---------------------------------------------------------------- building

  protected buildRound(problem: Problem) {
    this.entry = isEntry(problem);
    this.revealed = false;
    this.slotValue = null;
    this.slotW = null;
    this.tray = [];
    this.trayObjs = [];
    this.roundObjs = [];
    this.pad = null;
    this.choices = null;
    this.lastSign = null;
    this.truth = null;
    this.settling = false;
    this.settleEvt?.remove();
    this.settleEvt = null;
    this.wob = 0;
    this.tilt.t = 0;
    const d = problem.data;
    const icon = ICON_POOL[Math.floor(this.rng() * ICON_POOL.length)] as string;
    this.k = this.entry ? 0.74 : 1; // typed rounds: 50 px weight numbers * 0.74 = 37 px on screen (>= 36)
    const cx = this.entry ? 400 : 640;
    const cy = this.entry ? 380 : 340;
    this.buildScale(cx, cy);
    const [left, right] = this.pans;

    if (d.kind === 'compare') {
      this.mode = 'compare';
      const useIcons = Math.max(d.a, d.b) <= 20;
      const lead = useIcons ? `Which pan has more ${ICON_PLURAL[icon as keyof typeof ICON_PLURAL]}?` : 'Which side is heavier?';
      this.leadText(lead, 52, 235);
      const part = (n: number): Part => (useIcons ? { t: 'icons', n, icon } : { t: 'block', text: formatNum(n) });
      this.fillPan(left, [part(d.a)]);
      this.fillPan(right, [part(d.b)]);
      const signs = [...problem.choices].sort((x, y) => SIGN_ORDER.indexOf(String(x)) - SIGN_ORDER.indexOf(String(y)));
      this.choices = makeChoiceButtons(this, signs, (v) => this.pickSign(v), { x: 640, y: 800, width: 760, height: 120, fontSize: 84, problem });
    } else if (d.kind === 'missing') {
      this.mode = 'missing';
      const useIcons = d.result <= 20 && !this.entry;
      this.leadText(this.entry ? 'Type the missing weight.' : 'Pick the weight that makes it balance.', this.entry ? 38 : 42, this.entry ? 228 : 208);
      this.eqText(`${formatNum(d.a)} + ? = ${formatNum(d.result)}`);
      const aPart: Part = useIcons ? { t: 'icons', n: d.a, icon } : { t: 'block', text: formatNum(d.a) };
      this.fillPan(left, [aPart, { t: 'block', text: '?', slot: true }]);
      this.fillPan(right, [useIcons ? { t: 'icons', n: d.result, icon } : { t: 'block', text: formatNum(d.result) }]);
      if (this.entry) {
        this.pad = makeAnswerPad(this, 'number', (v) => this.submitTyped(v), {
          top: 215,
          maxDigits: 6,
          onChange: (f) => this.setSlot(f[0] === '' ? null : Number(f[0])),
        });
      } else {
        this.buildTray(problem);
      }
    } else {
      // never generated; keep the game from dead-ending
      this.mode = 'missing';
      this.leadText(problem.prompt, 44, 235);
      this.choices = makeChoiceButtons(this, problem.choices, (v) => this.pickSign(v), { x: 640, y: 800, width: 900, height: 120, problem });
    }
    this.layout();
    this.retilt(1);
  }

  private leadText(s: string, size: number, y: number) {
    const cx = this.entry ? 370 : 640;
    const w = this.entry ? 560 : 1040;
    const t = this.add.text(cx, y, s, textStyle(size, { wordWrap: { width: w, useAdvancedWrap: true } })).setOrigin(0.5);
    this.roundObjs.push(fitText(t, w, this.entry ? 90 : 70));
  }

  private eqText(s: string) {
    const cx = this.entry ? 370 : 640;
    const w = this.entry ? 560 : 1040;
    const t = this.add.text(cx, this.entry ? 290 : 258, s, textStyle(this.entry ? 62 : 66, { color: '#fff1a8' })).setOrigin(0.5);
    this.roundObjs.push(fitText(t, w, 80));
  }

  /** Post, base, beam, cords and two empty pans, all inside one scaled container. */
  private buildScale(cx: number, cy: number) {
    const root = this.add.container(cx, cy).setScale(this.k).setDepth(4);
    this.root = root;
    const g = this.add.graphics();
    // base and post
    g.fillStyle(COLOR.ink, 1).fillRoundedRect(-150, PH - 4, 300, 50, 20);
    g.fillStyle(COLOR.wood, 1).fillRoundedRect(-144, PH, 288, 40, 15);
    g.fillStyle(COLOR.woodLight, 1).fillRoundedRect(-144, PH, 288, 12, { tl: 15, tr: 15, bl: 0, br: 0 });
    g.fillStyle(COLOR.ink, 1).fillRoundedRect(-24, -6, 48, PH + 2, 10);
    g.fillStyle(COLOR.wood, 1).fillRoundedRect(-19, -2, 38, PH, 8);
    g.fillStyle(COLOR.woodLight, 1).fillRect(-12, 6, 7, PH - 14);
    root.add(g);
    const cords = this.add.graphics();
    this.cords = cords;
    root.add(cords);
    // beam
    const beam = this.add.container(0, 0);
    const bg = this.add.graphics();
    bg.fillStyle(COLOR.ink, 1).fillRoundedRect(-BL - 30, -19, 2 * BL + 60, 38, 18);
    bg.fillStyle(COLOR.wood, 1).fillRoundedRect(-BL - 25, -14, 2 * BL + 50, 28, 14);
    bg.fillStyle(COLOR.woodLight, 1).fillRoundedRect(-BL - 25, -14, 2 * BL + 50, 10, { tl: 14, tr: 14, bl: 0, br: 0 });
    for (const s of [-1, 1]) {
      bg.fillStyle(COLOR.ink, 1).fillCircle(s * BL, 0, 17);
      bg.fillStyle(COLOR.yellow, 1).fillCircle(s * BL, 0, 11);
    }
    bg.fillStyle(COLOR.ink, 1).fillCircle(0, 0, 28);
    bg.fillStyle(COLOR.yellow, 1).fillCircle(0, 0, 19);
    beam.add(bg);
    this.beam = beam;
    // pans (origin = rim centre; things sit above it)
    this.pans = [];
    for (const s of [-1, 1]) {
      const pan = this.add.container(s * BL, CL);
      const pg = this.add.graphics();
      pg.fillStyle(COLOR.ink, 1).fillRoundedRect(-PW - 5, -7, 2 * PW + 10, 50, { tl: 8, tr: 8, bl: 46, br: 46 });
      pg.fillStyle(0x8a92d8, 1).fillRoundedRect(-PW, -3, 2 * PW, 42, { tl: 5, tr: 5, bl: 42, br: 42 });
      pg.fillStyle(0xc9d6f5, 1).fillRoundedRect(-PW, -3, 2 * PW, 11, { tl: 5, tr: 5, bl: 0, br: 0 });
      pan.add(pg);
      this.pans.push(pan);
      root.add(pan);
    }
    root.add(beam);
    this.roundObjs.push(root);
  }

  /** Stacks the parts above the pan rim, bottom first. */
  private fillPan(pan: Phaser.GameObjects.Container, parts: Part[]) {
    let cursor = -6;
    for (const part of parts) {
      if (part.t === 'icons') {
        const n = Math.max(1, part.n);
        const areaW = 2 * PW - 20;
        const maxH = parts.length > 1 ? 84 : 150;
        let best = { size: 0, cols: 1 };
        for (let cols = 1; cols <= n; cols++) {
          const rows = Math.ceil(n / cols);
          const size = Math.min(52, areaW / cols, maxH / rows);
          if (size > best.size) best = { size, cols };
        }
        const rows = Math.ceil(n / best.cols);
        for (let i = 0; i < part.n; i++) {
          const r = Math.floor(i / best.cols);
          const inRow = Math.min(best.cols, part.n - r * best.cols);
          const x = ((i % best.cols) - (inRow - 1) / 2) * best.size;
          const y = cursor - best.size * (r + 0.5);
          pan.add(addCountIcon(this, part.icon, x, y, best.size * 0.92));
        }
        cursor -= rows * best.size + 6;
      } else {
        const box = this.add.container(0, cursor - BLOCK_H / 2);
        const g = this.add.graphics();
        const t = this.add.text(0, -3, part.text, textStyle(50, { color: '#1d1a3a', stroke: '#fff8ea', strokeThickness: 3 })).setOrigin(0.5);
        if (part.slot) {
          this.slotG = g;
          this.slotT = t;
          this.slotBox = box;
          this.drawSlot(false);
          if (!this.entry) {
            const hit = this.add.zone(0, 0, BLOCK_W, BLOCK_H + 8).setInteractive({ useHandCursor: true });
            hit.on('pointerdown', () => this.removeSlot());
            box.add([g, t, hit]);
          } else box.add([g, t]);
        } else {
          drawBlock(g, BLOCK_W, BLOCK_H);
          fitText(t, BLOCK_W - 24);
          box.add([g, t]);
        }
        pan.add(box);
        cursor -= BLOCK_H + 8;
      }
    }
  }

  private drawSlot(filled: boolean) {
    const g = this.slotG;
    if (!g) return;
    g.clear();
    if (filled) {
      drawBlock(g, BLOCK_W, BLOCK_H, 0xfff1a8);
    } else {
      g.fillStyle(0xffffff, 0.35).fillRoundedRect(-BLOCK_W / 2, -BLOCK_H / 2, BLOCK_W, BLOCK_H, 16);
      g.lineStyle(5, COLOR.ink, 0.65);
      const w = BLOCK_W;
      const h = BLOCK_H;
      const dash = (x0: number, y0: number, x1: number, y1: number) => {
        const len = Math.hypot(x1 - x0, y1 - y0);
        const n = Math.floor(len / 22);
        for (let i = 0; i < n; i += 2) {
          g.lineBetween(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, x0 + ((x1 - x0) * (i + 1)) / n, y0 + ((y1 - y0) * (i + 1)) / n);
        }
      };
      dash(-w / 2, -h / 2, w / 2, -h / 2);
      dash(-w / 2, h / 2, w / 2, h / 2);
      dash(-w / 2, -h / 2, -w / 2, h / 2);
      dash(w / 2, -h / 2, w / 2, h / 2);
    }
  }

  // ---------------------------------------------------------------- beam physics

  /** Places the beam and pans for the current tilt, and redraws the cords. */
  private layout() {
    const beam = this.beam;
    const cords = this.cords;
    if (!beam || !cords || this.pans.length < 2) return;
    const th = this.tilt.t + this.wob;
    beam.rotation = th;
    cords.clear();
    cords.lineStyle(5, COLOR.ink, 1);
    [-1, 1].forEach((s, i) => {
      const ex = s * BL * Math.cos(th);
      const ey = s * BL * Math.sin(th);
      this.pans[i].setPosition(ex, ey + CL);
      cords.lineBetween(ex, ey, ex - PW + 14, ey + CL);
      cords.lineBetween(ex, ey, ex + PW - 14, ey + CL);
    });
  }

  private targetTilt(): number {
    const d = this.problem?.data;
    let l = 0;
    let r = 0;
    if (d?.kind === 'missing') {
      // the beam must not give the answer away while weights are being placed: it only tilts after Check
      if (this.truth === null) return 0;
      l = d.a + this.truth;
      r = d.result;
    } else if (d?.kind === 'compare' && this.revealed) {
      l = d.a;
      r = d.b;
    } else return 0;
    if (l === r) return 0;
    const frac = Math.min(1, (Math.abs(r - l) / Math.max(l, r, 1)) * 4 + 0.18);
    return Math.sign(r - l) * MAX_TILT * frac;
  }

  /** Gentle rocking while the beam has nothing to say yet. */
  update(time: number) {
    if (!this.beam) return;
    const d = this.problem?.data;
    const quiet = (d?.kind === 'missing' && this.truth === null) || (d?.kind === 'compare' && !this.revealed);
    const w = quiet ? Math.sin(time / 520) * 0.028 : 0;
    if (w !== this.wob) {
      this.wob = w;
      this.layout();
    }
  }

  private retilt(ms = 450, ease = 'Sine.easeInOut') {
    this.tweens.killTweensOf(this.tilt);
    if (ms <= 1) {
      this.tilt.t = this.targetTilt();
      this.layout();
      return;
    }
    this.tweens.add({ targets: this.tilt, t: this.targetTilt(), duration: ms, ease, onUpdate: () => this.layout() });
  }

  // ---------------------------------------------------------------- balance mode (tray / typed)

  private setSlot(v: number | null) {
    this.slotValue = v;
    if (this.slotT) this.slotT.setText(v === null ? '?' : formatNum(v));
    if (this.slotT) fitText(this.slotT.setScale(1), BLOCK_W - 24);
    this.drawSlot(v !== null);
    if (this.slotBox && v !== null) this.tweens.add({ targets: this.slotBox, scale: 1.12, duration: 110, yoyo: true });
    this.retilt(380);
  }

  private buildTray(problem: Problem) {
    const bg = this.add.graphics().setDepth(2);
    bg.fillStyle(0xc9d6f5, 0.85).fillRoundedRect(100, 745, 1080, 112, 28);
    bg.lineStyle(5, COLOR.ink, 1).strokeRoundedRect(100, 745, 1080, 112, 28);
    this.trayObjs.push(bg);
    const vals = problem.choices.filter((c): c is number => typeof c === 'number').sort((a, b) => a - b);
    vals.forEach((v, i) => {
      const x = 230 + i * 180;
      this.tray.push(this.makeTrayWeight(v, x, 801));
    });
    const btn = makeButton(this, 1035, 801, 250, 92, 'Check', () => this.check(), 52, 0x8fd18a);
    btn.root.setDepth(6);
    this.trayObjs.push(btn.root);
  }

  private makeTrayWeight(value: number, x: number, y: number): TrayWeight {
    const root = this.add.container(x, y).setSize(BLOCK_W * 0.72 + 20, BLOCK_H + 24).setDepth(8);
    const g = this.add.graphics();
    drawBlock(g, BLOCK_W * 0.72, BLOCK_H);
    const t = this.add.text(0, -3, formatNum(value), textStyle(46, { color: '#1d1a3a', stroke: '#fff8ea', strokeThickness: 3 })).setOrigin(0.5);
    fitText(t, BLOCK_W * 0.72 - 20);
    root.add([g, t]);
    root.setInteractive({ useHandCursor: true });
    this.input.setDraggable(root);
    const w: TrayWeight = { root, value, home: { x, y }, used: false };
    let dragged = false;
    const goHome = () => this.tweens.add({ targets: root, x: w.home.x, y: w.home.y, duration: 160, ease: 'Cubic.easeOut' });
    root.on('dragstart', () => {
      dragged = true;
      if (w.used) return;
      root.setDepth(20);
    });
    root.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
      if (w.used || !this.canAnswer || this.settling) return;
      root.setPosition(dx, dy);
    });
    root.on('dragend', () => {
      root.setDepth(8);
      if (w.used || !this.canAnswer || this.settling) {
        goHome();
        return;
      }
      const s = this.slotWorld();
      if (s && Math.hypot(root.x - s.x, root.y - s.y) < 160) this.place(w);
      goHome();
    });
    root.on('pointerup', () => {
      if (dragged) {
        dragged = false;
        return;
      }
      if (this.canAnswer && !this.settling && !w.used) this.place(w);
    });
    this.trayObjs.push(root);
    return w;
  }

  private slotWorld(): { x: number; y: number } | null {
    if (!this.slotBox) return null;
    const m = this.slotBox.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }

  private place(w: TrayWeight) {
    if (this.slotW && this.slotW !== w) this.release(this.slotW);
    this.slotW = w;
    w.used = true;
    w.root.setAlpha(0.28);
    this.setSlot(w.value);
  }

  private release(w: TrayWeight) {
    w.used = false;
    w.root.setAlpha(1);
    if (this.slotW === w) this.slotW = null;
  }

  private removeSlot() {
    if (!this.canAnswer || this.settling || !this.slotW) return;
    this.release(this.slotW);
    this.setSlot(null);
  }

  private check() {
    if (!this.canAnswer) return;
    if (this.settling) return;
    if (this.slotValue === null) {
      for (const w of this.tray) wobble(this, w.root);
      return;
    }
    this.truth = this.slotValue;
    this.retilt(350);
    this.submit(this.slotValue);
  }

  private submitTyped(v: number | string) {
    if (!this.canAnswer || this.settling) return;
    this.truth = Number(v);
    this.retilt(350);
    this.submit(v);
  }

  // ---------------------------------------------------------------- compare mode

  private pickSign(v: number | string) {
    if (!this.canAnswer) return;
    this.lastSign = String(v);
    this.submit(v);
  }

  // ---------------------------------------------------------------- framework hooks

  protected debugPick(v: number | string) {
    if (this.pad) {
      if (!this.pad.enter(v)) this.submit(v);
      return;
    }
    if (this.mode === 'compare') {
      this.pickSign(v);
      return;
    }
    const w = this.tray.find((t) => t.value === Number(v));
    if (w) {
      this.place(w);
      this.check();
    } else this.submit(v);
  }

  protected onWrong(kind: WrongKind, answer: number | string) {
    if (this.pad) this.pad.wobble();
    if (this.beam) wobble(this, this.root as Phaser.GameObjects.Container);
    if (this.choices) {
      this.choices.wobble(answer);
      this.choices.dim(answer);
    }
    const p = this.problem;
    const pd = p?.data;
    if (this.mode === 'missing' && pd && pd.kind === 'missing') {
      if (kind === 'reveal') {
        this.settleEvt?.remove();
        this.settling = false;
        this.truth = pd.b;
        const w = this.tray.find((t) => t.value === pd.b);
        if (w) {
          if (this.slotW && this.slotW !== w) this.release(this.slotW);
          this.place(w);
        } else this.setSlot(pd.b);
        this.retilt(500);
      } else {
        // the beam (tilted by Check) shows which side is heavier for a moment, then everything resets
        this.settling = true;
        this.settleEvt?.remove();
        this.settleEvt = this.time.delayedCall(1300, () => {
          this.settling = false;
          this.truth = null;
          if (this.pad) this.pad.clear();
          else {
            if (this.slotW) this.release(this.slotW);
            this.setSlot(null);
          }
          this.retilt(450);
        });
      }
    } else if (kind === 'reveal' && p && p.data.kind === 'compare') {
      this.revealed = true;
      this.retilt(500);
    }
  }

  protected onRoundWon(answer: number | string) {
    const p = this.problem;
    this.pad?.root.setAlpha(0.6);
    if (p?.data.kind === 'compare') {
      this.revealed = true;
      this.retilt(600, 'Back.easeOut');
      const b = this.choices && this.lastSign !== null ? this.choices.find(this.lastSign) : undefined;
      if (b) this.tweens.add({ targets: b.root, scale: 1.12, duration: 160, yoyo: true });
    } else if (p?.data.kind === 'missing') {
      this.settleEvt?.remove();
      this.settling = false;
      this.truth = Number(answer);
      const w = this.tray.find((t) => t.value === Number(answer));
      if (w && !w.used) this.place(w);
      else if (this.slotValue !== Number(answer)) this.setSlot(Number(answer));
      this.retilt(500, 'Back.easeOut');
    }
    const r = this.root;
    if (r) {
      starBurst(this, r.x, r.y + 60 * this.k, 0xffc93c, 40, 18);
      this.time.delayedCall(250, () => {
        if (this.root) starBurst(this, this.root.x - BL * this.k, this.root.y + CL * this.k, 0xd6fbff, 40, 10);
        if (this.root) starBurst(this, this.root.x + BL * this.k, this.root.y + CL * this.k, 0xd6fbff, 40, 10);
      });
    }
    return 500;
  }

  protected clearRound() {
    this.tweens.killTweensOf(this.tilt);
    this.settleEvt?.remove();
    this.settleEvt = null;
    this.settling = false;
    this.truth = null;
    this.choices?.destroy();
    this.choices = null;
    this.pad?.destroy();
    this.pad = null;
    for (const w of this.tray) this.tweens.killTweensOf(w.root);
    this.tray = [];
    for (const o of [...this.trayObjs, ...this.roundObjs]) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.trayObjs = [];
    this.roundObjs = [];
    this.root = null;
    this.beam = null;
    this.cords = null;
    this.pans = [];
    this.slotG = null;
    this.slotT = null;
    this.slotBox = null;
    this.slotW = null;
    this.slotValue = null;
  }
}

