// Dad Lab (hidden Dad mode): an engineer's bench. A dark phosphor "scope" panel shows one radar or
// software question, its constants, a small diagram or code box, and a decimal answer pad with the
// unit beside the entry. Rounds, hints, cocoa, pips, badge and back button come from MiniGameScene.
import Phaser from 'phaser';
import { miniGameSceneKey, Problem } from '../types';
import type { DadVisual } from '../types';
import { MiniGameScene, WrongKind } from './base';
import { AnswerPad, MONO, makeAnswerPad } from './widgets';
import { DadDeck, dadUnitLabel, generateDadProblem } from '../math/dad';
import { debugRefs } from '../core/debug';
import { session } from '../core/session';
import { starBurst } from '../core/ui';
import { ANIM, HeroId } from '../art/keys';
import { addHeroSprite, playHero } from '../core/heroArt';

const GREEN = 0x55ff88;
const DIM = 0x1f6b3a;
const AMBER = 0xffbf5a;
const BG = 0x040a06;
const CSS = { green: '#7dff9a', bright: '#d8ffe0', amber: '#ffbf5a', dim: '#4caf6a', red: '#ff6b6b' };

/** Left column (question + diagram) and the pad's centre. */
const LX = 100;
const LW = 690;
const PAD_X = 1010;
const PAD_TOP = 232;
const BOTTOM = 878;

const CHEERS = [
  'Juniper: Textbook, Dad!',
  'Juniper: Locked on!',
  'Juniper: Zero bugs!',
  "Juniper: That's my dad!",
  'Juniper: Nailed the units!',
  'Juniper: Ship it!',
  'Juniper: Clean signal!',
  'Juniper: Wow, an expert!',
];

const mono = (size: number, color: string, extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: MONO,
  fontSize: `${size}px`,
  color,
  resolution: 2,
  ...extra,
});

export class DadLabScene extends MiniGameScene {
  protected readonly title = 'Dad Lab';
  protected wideBadge = true;
  private deck = new DadDeck();
  private pad: AnswerPad | null = null;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private juniper: Phaser.GameObjects.Sprite | null = null;
  private scarf = 0;
  private heroId: HeroId = 'juniper';

  constructor() {
    super({ key: miniGameSceneKey('dadLab') });
  }

  init(data: Parameters<MiniGameScene['init']>[0]) {
    super.init(data);
    this.deck = new DadDeck();
    this.pad = null;
    this.objs = [];
    this.juniper = null;
  }

  // ---------- base hooks
  protected makeProblem(): Problem {
    const level = session.dadLevelIn(this.cfg.zone);
    if (debugRefs.dadTopic) {
      const topic = debugRefs.dadTopic;
      debugRefs.dadTopic = null;
      return generateDadProblem(level, this.rng, { topic });
    }
    return this.deck.next(level, this.rng);
  }

  protected recordProblem(_p: Problem, firstTry: boolean): -1 | 0 | 1 {
    return session.recordDadAnswer(firstTry);
  }

  protected levelLabel(): string {
    return `Dad Lv ${session.dadLevelIn(this.cfg.zone)}`;
  }

  protected revealMs() {
    return 9000;
  }

  protected hintAnchor() {
    return { x: LX + LW / 2, y: BOTTOM - 100 };
  }

  protected hintWidth() {
    return LW + 10;
  }

  /** Terminal-style hint / worked-solution box, bottom-aligned in the left column. */
  protected makeHintBubble(x: number, _y: number, text: string, maxW: number, strong: boolean) {
    const head = strong ? 'WORKED SOLUTION' : 'HINT';
    const t = this.add.text(0, 0, text, mono(23, CSS.bright, { wordWrap: { width: maxW - 40, useAdvancedWrap: true }, lineSpacing: 4 }));
    const hh = 34;
    const w = maxW;
    const h = t.height + hh + 26;
    const root = this.add.container(x, BOTTOM - h / 2);
    const g = this.add.graphics();
    g.fillStyle(0x0b1a10, 0.97).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.lineStyle(3, strong ? AMBER : GREEN, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.fillStyle(strong ? AMBER : GREEN, 1).fillRoundedRect(-w / 2, -h / 2, w, hh, { tl: 10, tr: 10, bl: 0, br: 0 });
    const label = this.add.text(-w / 2 + 16, -h / 2 + hh / 2, `> ${head}`, mono(20, '#04110a', { fontStyle: 'bold' })).setOrigin(0, 0.5);
    t.setPosition(-w / 2 + 20, -h / 2 + hh + 12);
    root.add([g, label, t]);
    root.setSize(w, h);
    return root;
  }

  protected debugPick(v: number | string) {
    if (this.pad && !this.pad.enter(v)) this.submit(v);
    else if (!this.pad) this.submit(v);
  }

  // ---------- bench
  protected setupGame() {
    const g = this.add.graphics();
    g.fillStyle(BG, 1).fillRoundedRect(70, 160, 1140, 730, 30);
    // faint scope graticule
    g.lineStyle(1, 0x0f2a18, 1);
    for (let x = 90; x < 1200; x += 40) g.lineBetween(x, 166, x, 884);
    for (let y = 176; y < 884; y += 40) g.lineBetween(76, y, 1204, y);
    g.lineStyle(1, 0x173d24, 1);
    g.lineBetween(806, 176, 806, 884);
    g.lineStyle(5, 0x1d1a3a, 1).strokeRoundedRect(70, 160, 1140, 730, 30);
    g.lineStyle(2, DIM, 1).strokeRoundedRect(78, 168, 1124, 714, 24);
    this.scarf = session.profile?.scarf ?? 0;
    this.heroId = session.hero;
    this.juniper = addHeroSprite(this, 1120, 886, this.heroId, this.scarf, 0.72).setDepth(5);
    playHero(this.juniper, ANIM.idle, this.heroId, this.scarf);
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }

  protected buildRound(problem: Problem) {
    const d = problem.data;
    if (d.kind !== 'dad') return;
    // tag + title
    const radar = d.category === 'radar';
    const tag = this.keep(this.add.text(LX + 12, 196, radar ? 'RADAR' : 'SOFTWARE', mono(22, '#04110a', { fontStyle: 'bold' })).setOrigin(0, 0.5));
    const tg = this.keep(this.add.graphics());
    tg.fillStyle(radar ? AMBER : GREEN, 1).fillRoundedRect(LX, 180, tag.width + 24, 32, 6);
    tag.setDepth(1);
    this.keep(this.add.text(LX + tag.width + 40, 196, `T${d.tier ?? '?'} · ${d.title ?? d.topic}`, mono(20, CSS.dim)).setOrigin(0, 0.5));

    // question (shrinks for long prompts)
    let y = 232;
    let q: Phaser.GameObjects.Text | null = null;
    for (const size of [28, 25, 22, 20]) {
      q?.destroy();
      q = this.add.text(LX, y, d.question ?? problem.prompt, mono(size, CSS.bright, { wordWrap: { width: LW, useAdvancedWrap: true }, lineSpacing: 5 }));
      if (q.height <= 250) break;
    }
    this.keep(q!);
    y += q!.height + 12;
    const showGiven = (d.given ?? []).length > 0 && d.visual?.kind !== 'table';
    if (showGiven) {
      const gt = this.keep(
        this.add.text(LX, y, (d.given ?? []).map((s) => `· ${s}`).join('\n'), mono(21, CSS.green, { wordWrap: { width: LW, useAdvancedWrap: true }, lineSpacing: 3 })),
      );
      y += gt.height + 8;
    }
    const ask = this.keep(this.add.text(LX, y, `» ${d.ask ?? ''}`, mono(21, CSS.amber, { wordWrap: { width: LW, useAdvancedWrap: true } })));
    y += ask.height + 16;
    // the table topic lists its givens in the table itself
    if (d.visual) this.drawVisual(d.visual, new Phaser.Geom.Rectangle(LX, y, LW, BOTTOM - y));

    const unit = dadUnitLabel(d.unit);
    this.pad = makeAnswerPad(this, 'decimal', (v) => this.pick(v), { x: PAD_X, top: PAD_TOP, theme: 'terminal', unitSide: unit || undefined, problem });
  }

  private pick(v: number | string) {
    if (!this.canAnswer) return;
    this.submit(v);
  }

  protected onWrong(kind: WrongKind) {
    this.pad?.wobble();
    this.pad?.clear();
    const t = this.add
      .text(PAD_X, PAD_TOP - 18, kind === 'reveal' ? '✗ SEE WORKED SOLUTION' : '✗ NO MATCH, TRY AGAIN', mono(22, CSS.red, { fontStyle: 'bold' }))
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 400, onComplete: () => t.destroy() });
  }

  protected onRoundWon() {
    const t = this.add.text(PAD_X, PAD_TOP - 18, '✓ CORRECT', mono(26, CSS.green, { fontStyle: 'bold' })).setOrigin(0.5).setDepth(20);
    const cheer = this.add
      .text(PAD_X - 40, 760, CHEERS[Math.floor(this.rng() * CHEERS.length)], mono(22, CSS.amber, { fontStyle: 'bold', wordWrap: { width: 220 } }))
      .setOrigin(0.5)
      .setDepth(20);
    this.objs.push(t, cheer);
    starBurst(this, PAD_X, PAD_TOP + 50, 0x9dffb0, 40, 14);
    if (this.juniper) {
      playHero(this.juniper, ANIM.cheer, this.heroId, this.scarf);
      this.juniper.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.juniper && playHero(this.juniper, ANIM.idle, this.heroId, this.scarf));
    }
    return 700;
  }

  protected clearRound() {
    this.pad?.destroy();
    this.pad = null;
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
  }

  // ---------- diagrams
  private label(x: number, y: number, s: string, color = CSS.green, size = 19, ox = 0.5, oy = 0.5) {
    return this.keep(this.add.text(x, y, s, mono(size, color)).setOrigin(ox, oy));
  }

  private frame(r: Phaser.Geom.Rectangle) {
    const g = this.keep(this.add.graphics());
    g.fillStyle(0x07140b, 1).fillRoundedRect(r.x, r.y, r.width, r.height, 8);
    g.lineStyle(2, DIM, 1).strokeRoundedRect(r.x, r.y, r.width, r.height, 8);
    return g;
  }

  private drawVisual(v: DadVisual, area: Phaser.Geom.Rectangle) {
    const text = v.kind === 'code' || v.kind === 'table' || v.kind === 'bits' || v.kind === 'pipeline';
    if (area.height < (text ? 70 : 110)) return;
    const h = Math.min(area.height, v.kind === 'code' || v.kind === 'table' ? 330 : 250);
    const r = new Phaser.Geom.Rectangle(area.x, area.y, area.width, h);
    switch (v.kind) {
      case 'code':
      case 'table':
        return this.drawLines(v, r);
      case 'bits':
        return this.drawBits(v, r);
      case 'pipeline':
        return this.drawPipeline(v, r);
      case 'echo':
        return this.drawEcho(v, r);
      case 'pulse':
        return this.drawPulse(v, r);
      case 'wave':
        return this.drawWave(v, r);
      case 'rd':
        return this.drawRd(v, r);
      case 'chirp':
        return this.drawChirp(v, r);
      case 'beam':
        return this.drawBeam(v, r);
      case 'spectrum':
        return this.drawSpectrum(v, r);
      case 'ring':
        return this.drawRing(v, r);
    }
  }

  /** Code box (line numbers) or a plain monospace table. */
  private drawLines(v: DadVisual, r: Phaser.Geom.Rectangle) {
    const lines = v.lines ?? [];
    const code = v.kind === 'code';
    const body = lines.map((l, i) => (code ? `${String(i + 1).padStart(2)}  ${l}` : l)).join('\n');
    const t = this.keep(this.add.text(r.x + 16, r.y + 14, body, mono(24, code ? CSS.bright : CSS.green, { lineSpacing: 6 })));
    const k = Math.min(1, (r.width - 32) / t.width, (r.height - 28) / t.height);
    t.setScale(k);
    const boxH = Math.min(r.height, t.height * k + 28);
    const g = this.frame(new Phaser.Geom.Rectangle(r.x, r.y, r.width, boxH));
    if (code) {
      g.fillStyle(0x0d2416, 1).fillRect(r.x + 2, r.y + 2, 40 * k, boxH - 4);
      this.label(r.x + r.width - 10, r.y + 6, 'C', CSS.dim, 16, 1, 0);
    }
    t.setDepth(1);
  }

  private drawBits(v: DadVisual, r: Phaser.Geom.Rectangle) {
    const rows = v.rows ?? [];
    const labelW = 150;
    const maxBits = Math.max(...rows.map((x) => x.bits.length), 1);
    const cell = Math.max(14, Math.min(54, (r.width - labelW - 20) / maxBits));
    const rowH = Math.min(cell + 34, (r.height - 20) / Math.max(1, rows.length));
    const g = this.frame(new Phaser.Geom.Rectangle(r.x, r.y, r.width, rowH * rows.length + 30));
    rows.forEach((row, ri) => {
      const cy = r.y + 22 + ri * rowH + rowH / 2;
      const lab = this.label(r.x + 12, cy, row.label, CSS.amber, 19, 0, 0.5);
      if (lab.width > labelW - 16) lab.setScale((labelW - 16) / lab.width);
      const n = row.bits.length;
      const x0 = r.x + labelW + (r.width - labelW - 10 - n * cell) / 2;
      for (let i = 0; i < n; i++) {
        const hi = row.hi && i >= row.hi[0] && i < row.hi[0] + row.hi[1];
        const x = x0 + i * cell;
        g.fillStyle(hi ? 0x3a2a08 : 0x0d2416, 1).fillRect(x + 1, cy - cell / 2, cell - 2, cell);
        g.lineStyle(1, hi ? AMBER : DIM, 1).strokeRect(x + 1, cy - cell / 2, cell - 2, cell);
        if (i > 0 && (n - i) % 4 === 0) g.lineStyle(2, GREEN, 0.6).lineBetween(x, cy - cell / 2 - 4, x, cy + cell / 2 + 4);
        this.label(x + cell / 2, cy, row.bits[i], hi ? CSS.amber : row.bits[i] === '1' ? CSS.bright : CSS.dim, Math.round(cell * 0.6));
        if (ri === 0 && n <= 16) this.label(x + cell / 2, cy - cell / 2 - 11, String(n - 1 - i), CSS.dim, 15);
      }
    });
  }

  private drawPipeline(v: DadVisual, r: Phaser.Geom.Rectangle) {
    const lines = v.lines ?? [];
    const n = lines.length;
    const h = Math.min(r.height, 150);
    const g = this.frame(new Phaser.Geom.Rectangle(r.x, r.y, r.width, h));
    const bw = Math.min(130, (r.width - 40 - (n - 1) * 20) / n);
    const x0 = r.x + (r.width - (n * bw + (n - 1) * 20)) / 2;
    const cy = r.y + h / 2;
    lines.forEach((l, i) => {
      const x = x0 + i * (bw + 20);
      g.lineStyle(2, GREEN, 1).strokeRect(x, cy - 40, bw, 80);
      if (i < n - 1) {
        g.lineStyle(2, GREEN, 1).lineBetween(x + bw, cy, x + bw + 20, cy);
        g.fillStyle(GREEN, 1).fillTriangle(x + bw + 20, cy, x + bw + 12, cy - 5, x + bw + 12, cy + 5);
      }
      const m = /([\d.]+)\s*µs/.exec(l);
      this.label(x + bw / 2, cy - 16, `S${i + 1}`, CSS.amber, 18);
      const t = this.label(x + bw / 2, cy + 14, m ? `${m[1]} µs` : l, CSS.bright, 18);
      if (t.width > bw - 8) t.setScale((bw - 8) / t.width);
    });
  }

  private axes(r: Phaser.Geom.Rectangle, xl: string, yl: string) {
    const g = this.frame(r);
    const ox = r.x + 40;
    const oy = r.bottom - 34;
    g.lineStyle(2, DIM, 1).lineBetween(ox, oy, r.right - 20, oy).lineBetween(ox, oy, ox, r.y + 16);
    this.label(r.right - 22, oy + 16, xl, CSS.dim, 16, 1, 0.5);
    this.label(ox + 6, r.y + 8, yl, CSS.dim, 16, 0, 0);
    return { g, ox, oy };
  }

  private drawEcho(v: DadVisual, r: Phaser.Geom.Rectangle) {
    const { g, ox, oy } = this.axes(r, 't', 'A');
    const x1 = ox + 50;
    const x2 = r.right - 160;
    const top = r.y + 40;
    g.fillStyle(GREEN, 1).fillRect(x1, top, 18, oy - top);
    g.fillStyle(AMBER, 1).fillRect(x2, oy - (oy - top) * 0.35, 18, (oy - top) * 0.35);
    g.lineStyle(2, GREEN, 0.7);
    // noise floor wiggle
    for (let x = ox + 4; x < r.right - 24; x += 8) g.lineBetween(x, oy - 2 - ((x * 7) % 5), x + 8, oy - 2 - (((x + 8) * 7) % 5));
    const ay = top + 30;
    g.lineStyle(2, CSS_NUM(CSS.bright), 1).lineBetween(x1 + 18, ay, x2, ay);
    g.fillStyle(0xd8ffe0, 1).fillTriangle(x2, ay, x2 - 10, ay - 6, x2 - 10, ay + 6).fillTriangle(x1 + 18, ay, x1 + 28, ay - 6, x1 + 28, ay + 6);
    this.label((x1 + x2) / 2, ay - 18, v.labels?.dt ?? 'Δt', CSS.bright, 20);
    this.label(x1 + 9, oy + 16, 'TX', CSS.green, 16);
    this.label(x2 + 9, oy + 16, 'echo', CSS.amber, 16);
  }

  private drawPulse(v: DadVisual, r: Phaser.Geom.Rectangle) {
    const { g, ox, oy } = this.axes(r, 't', 'A');
    const top = r.y + 70;
    const step = (r.width - 120) / 2.6;
    const pw = 10;
    for (let i = 0; i < 3; i++) {
      const x = ox + 30 + i * step;
      g.fillStyle(GREEN, 1).fillRect(x, top, pw, oy - top);
    }
    if (v.labels?.echo) {
      const ex = ox + 30 + step * 0.62;
      g.fillStyle(AMBER, 1).fillRect(ex, oy - (oy - top) * 0.3, 14, (oy - top) * 0.3);
      this.label(ex + 7, oy - (oy - top) * 0.3 - 14, v.labels.echo, CSS.amber, 16);
    }
    const ay = r.y + 34;
    const xa = ox + 30;
    const xb = ox + 30 + step;
    g.lineStyle(2, 0xd8ffe0, 1).lineBetween(xa, ay, xb, ay).lineBetween(xa, ay - 8, xa, ay + 8).lineBetween(xb, ay - 8, xb, ay + 8);
    this.label((xa + xb) / 2, ay - 2, ` ${v.labels?.pri ?? 'PRI'} `, CSS.bright, 19, 0.5, 1);
    this.label(xa + pw / 2, top - 14, v.labels?.tau ?? 'τ', CSS.amber, 17);
  }

  private drawWave(v: DadVisual, r: Phaser.Geom.Rectangle) {
    const g = this.frame(r);
    const cy = r.y + r.height * 0.58;
    const amp = r.height * 0.26;
    const x0 = r.x + 30;
    const per = (r.width - 60) / 2.5;
    g.lineStyle(3, GREEN, 1).beginPath();
    for (let x = 0; x <= r.width - 60; x += 3) {
      const yy = cy - amp * Math.sin((2 * Math.PI * x) / per);
      if (x === 0) g.moveTo(x0 + x, yy);
      else g.lineTo(x0 + x, yy);
    }
    g.strokePath();
    const xa = x0 + per / 4;
    const xb = xa + per;
    const ay = cy - amp - 18;
    g.lineStyle(2, AMBER, 1).lineBetween(xa, ay, xb, ay).lineBetween(xa, ay - 8, xa, cy - amp).lineBetween(xb, ay - 8, xb, cy - amp);
    this.label((xa + xb) / 2, ay - 4, v.labels?.lam ?? 'λ', CSS.amber, 20, 0.5, 1);
    this.label(r.right - 14, r.bottom - 14, v.labels?.f ?? '', CSS.dim, 18, 1, 1);
  }

  private drawRd(v: DadVisual, r: Phaser.Geom.Rectangle) {
    const { g, ox, oy } = this.axes(r, 'range', 'Doppler');
    const w = r.right - 20 - ox;
    const hh = oy - (r.y + 16);
    const mid = oy - hh / 2;
    g.lineStyle(1, DIM, 0.8);
    for (let i = 1; i < 8; i++) g.lineBetween(ox + (w * i) / 8, oy, ox + (w * i) / 8, r.y + 16);
    for (let i = 1; i < 4; i++) g.lineBetween(ox, oy - (hh * i) / 4, ox + w, oy - (hh * i) / 4);
    // clutter ridge at zero Doppler
    g.fillStyle(GREEN, 0.25).fillRect(ox + 2, mid - 6, w - 4, 12);
    this.label(ox + 8, mid - 16, 'clutter (0 Hz)', CSS.dim, 14, 0, 1);
    // target
    const tx = ox + w * 0.62;
    const ty = mid - hh * 0.3;
    g.fillStyle(AMBER, 0.35).fillCircle(tx, ty, 16);
    g.fillStyle(AMBER, 1).fillCircle(tx, ty, 7);
    this.label(tx + 22, ty, v.labels?.note ?? 'fd', CSS.amber, 19, 0, 0.5);
  }

  private drawChirp(v: DadVisual, r: Phaser.Geom.Rectangle) {
    const { g, ox, oy } = this.axes(r, 't', 'f');
    const top = r.y + 40;
    const T = (r.right - 60 - ox) / 1.6;
    const d = 34;
    const saw = (x0: number, col: number) => {
      g.lineStyle(3, col, 1);
      for (let k = 0; k < 2; k++) {
        const xs = x0 + k * T;
        g.lineBetween(xs, oy - 10, Math.min(xs + T, r.right - 24), oy - 10 - (oy - 10 - top) * Math.min(1, (r.right - 24 - xs) / T));
      }
    };
    saw(ox + 10, GREEN);
    saw(ox + 10 + d, AMBER);
    const xm = ox + 10 + T * 0.6;
    const slope = (oy - 10 - top) / T;
    const y1 = oy - 10 - slope * (xm - ox - 10);
    const y2 = oy - 10 - slope * (xm - ox - 10 - d);
    g.lineStyle(2, 0xd8ffe0, 1).lineBetween(xm, y1, xm, y2);
    this.label(xm + 8, (y1 + y2) / 2, v.labels?.fb ?? 'fb', CSS.bright, 18, 0, 0.5);
    this.label(ox + 16, top - 4, v.labels?.B ?? 'B', CSS.green, 17, 0, 1);
    this.label(ox + 10 + T / 2, oy + 16, v.labels?.T ?? 'T', CSS.green, 16);
    this.label(r.right - 24, top + 6, 'TX', CSS.green, 15, 1, 0);
    this.label(r.right - 24, top + 26, 'RX', CSS.amber, 15, 1, 0);
  }

  private drawBeam(v: DadVisual, r: Phaser.Geom.Rectangle) {
    const g = this.frame(r);
    const cy = r.y + (r.height - 30) / 2 + 4;
    const half = Math.min(70, (r.height - 60) / 2);
    // dish: an arc opening to the right, its vertex at dx
    const dx = r.x + 40;
    const R = half * 1.6;
    const a = Math.asin(half / R);
    g.lineStyle(5, GREEN, 1).beginPath().arc(dx + R, cy, R, Math.PI - a, Math.PI + a).strokePath();
    const fx = dx + R * 0.45; // feed
    g.lineStyle(2, GREEN, 1).lineBetween(dx + R * (1 - Math.cos(a)), cy - half, fx, cy).lineBetween(dx + R * (1 - Math.cos(a)), cy + half, fx, cy);
    g.fillStyle(GREEN, 1).fillCircle(fx, cy, 4);
    // main lobe
    const x0 = fx + 6;
    const L = r.right - 24 - x0;
    const spread = Math.min(half * 1.1, (r.height - 40) / 2);
    g.fillStyle(GREEN, 0.12).fillTriangle(x0, cy, x0 + L, cy - spread, x0 + L, cy + spread);
    g.lineStyle(2, GREEN, 0.9).lineBetween(x0, cy, x0 + L, cy - spread).lineBetween(x0, cy, x0 + L, cy + spread);
    g.lineStyle(1, DIM, 1).lineBetween(x0, cy, x0 + L, cy);
    const ang = Math.atan2(spread, L);
    g.lineStyle(2, AMBER, 1).beginPath().arc(x0, cy, 150, -ang, ang).strokePath();
    this.label(x0 + 164, cy, v.labels?.theta ?? 'θ', CSS.amber, 22, 0, 0.5);
    // D marker along the aperture
    const lx = dx - 14;
    g.lineStyle(2, 0xd8ffe0, 1).lineBetween(lx, cy - half, lx, cy + half).lineBetween(lx - 6, cy - half, lx + 6, cy - half).lineBetween(lx - 6, cy + half, lx + 6, cy + half);
    this.label(r.x + 14, r.bottom - 10, v.labels?.D ?? 'D', CSS.green, 19, 0, 1);
  }

  private drawSpectrum(v: DadVisual, r: Phaser.Geom.Rectangle) {
    const { g, ox, oy } = this.axes(r, 'f', '|X|');
    const n = 32;
    const w = (r.right - 30 - ox) / n;
    const peak = 11;
    const peakH = oy - r.y - 74;
    for (let i = 0; i < n; i++) {
      const hgt = i === peak ? peakH : 8 + ((i * 37) % 13) + (Math.abs(i - peak) === 1 ? 40 : 0);
      g.fillStyle(i === peak ? AMBER : GREEN, i === peak ? 1 : 0.6).fillRect(ox + 4 + i * w, oy - hgt, Math.max(2, w - 3), hgt);
    }
    this.label(ox + 4 + peak * w + w / 2, oy - peakH - 4, v.labels?.tone ?? 'target', CSS.amber, 17, 0.5, 1);
    this.label(r.right - 14, r.y + 10, `${v.labels?.N ?? ''}   ${v.labels?.span ?? ''}`, CSS.green, 17, 1, 0);
  }

  private drawRing(v: DadVisual, r: Phaser.Geom.Rectangle) {
    const g = this.frame(r);
    const cx = r.x + 150;
    const cy = r.y + r.height / 2;
    const rad = Math.min(90, r.height / 2 - 24);
    const slots = 16;
    for (let i = 0; i < slots; i++) {
      const a0 = (i / slots) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / slots) * Math.PI * 2 - Math.PI / 2;
      g.lineStyle(14, i < 5 ? AMBER : DIM, i < 5 ? 0.8 : 1).beginPath().arc(cx, cy, rad, a0 + 0.04, a1 - 0.04).strokePath();
    }
    this.label(cx, cy, `N = ${v.labels?.N ?? ''}`, CSS.bright, 19);
    this.label(r.x + 290, cy - 30, `write → ${v.labels?.head ?? ''}`, CSS.amber, 20, 0, 0.5);
    if (v.labels?.tail) this.label(r.x + 290, cy + 10, `read  → ${v.labels.tail}`, CSS.green, 20, 0, 0.5);
    this.label(r.x + 290, cy + 50, 'index wraps mod N', CSS.dim, 17, 0, 0.5);
  }
}

/** '#d8ffe0' -> 0xd8ffe0 */
function CSS_NUM(c: string) {
  return Number.parseInt(c.slice(1), 16);
}
