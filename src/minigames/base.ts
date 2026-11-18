// Mini-game framework. Subclasses build the manipulative; this class owns the frame, rounds,
// problem generation, level badge, back button and the wrong-answer ladder.
import Phaser from 'phaser';
import type { MiniGameLaunch, Problem, Rng } from '../types';
import { TEX, toolKey } from '../art/keys';
import { generateForMiniGame } from '../math/generate';
import { makeRng } from '../math/rng';
import { answersEqual, isCorrectAnswer } from '../math/format';
import { session } from '../core/session';
import { audio } from '../core/audio';
import { debugRefs, DebugMiniGame } from '../core/debug';
import { addPanel, addText, makeIconButton, makeMuteButton, starBurst, textStyle } from '../core/ui';
import { makeBubble } from './widgets';

export { makeChoiceButtons, makeNumberPad, makeAnswerPad, makeBubble, choiceLabel, isEntry, answerPadMode } from './widgets';
export { textStyle, addText } from '../core/ui';

export type SubmitResult = 'correct' | 'retry' | 'hint' | 'reveal';
export type WrongKind = 'retry' | 'hint' | 'reveal';

const CELEBRATE_MS = 900;
const REVEAL_MS = 3000;

export abstract class MiniGameScene extends Phaser.Scene implements DebugMiniGame {
  /** Shown at the top of the panel. */
  protected abstract readonly title: string;

  protected cfg!: MiniGameLaunch;
  protected problem: Problem | null = null;
  /** Rounds completed so far. */
  protected round = 0;
  /** Misses on the current problem. */
  protected misses = 0;
  /** True while celebrating / revealing: ignore taps. Check `canAnswer` before calling submit. */
  protected locked = true;
  /** Content area inside the panel where the manipulative goes. */
  protected readonly area = new Phaser.Geom.Rectangle(90, 180, 1100, 690);
  protected rng: Rng = Math.random;

  private missRecorded = false;
  private done = false;
  private pips: Phaser.GameObjects.Image[] = [];
  private badge!: Phaser.GameObjects.Text;
  private bubble: Phaser.GameObjects.Container | null = null;

  // ---------- subclass hooks ----------
  /** Optional: build things that persist across rounds (called once, before the first round). */
  protected setupGame(_area: Phaser.Geom.Rectangle): void {}
  /** Create the manipulative for one problem inside `area`. */
  protected abstract buildRound(problem: Problem, area: Phaser.Geom.Rectangle): void;
  /** Destroy what buildRound created. */
  protected abstract clearRound(): void;
  /** Feedback after a wrong answer (wobble, crack...). */
  protected onWrong(_kind: WrongKind, _answer: number | string): void {}
  /** Celebration for a won round. Return extra ms to wait before the next round. */
  protected onRoundWon(_answer: number | string): number | void {}
  /** After the last round, before closing. Return ms to wait (default 600). */
  protected onAllRoundsWon(): number | void {}
  /** Where the hint/explain bubble goes (screen coords). */
  /** Max width of the hint/explain bubble (narrow it when the answer pad sits beside it). */
  protected hintWidth(): number {
    return 1000;
  }
  protected hintAnchor(): { x: number; y: number } {
    return { x: 640, y: this.area.y + 40 };
  }
  /** Debug/test path: answer `value` the same way a tap would. Override to route through your UI. */
  protected debugPick(value: number | string) {
    this.submit(value);
  }
  /** Next problem for this mini game (Dad Lab overrides). */
  protected makeProblem(): Problem {
    return generateForMiniGame(this.cfg.id, session.levelsFor(this.cfg.zone), this.rng);
  }
  /** Saves one problem result; returns the level change (Dad Lab overrides). */
  protected recordProblem(p: Problem, firstTry: boolean): -1 | 0 | 1 {
    return session.recordAnswer(p.strand, firstTry);
  }
  /** Text of the level badge. */
  protected levelLabel(p: Problem): string {
    return `Lv ${session.levelIn(p.strand, this.cfg.zone)}`;
  }
  /** Wider level badge (pips move left), for labels like "Dad Lv 12". */
  protected wideBadge = false;
  /** How long the worked answer stays up after the third miss. */
  protected revealMs(): number {
    return REVEAL_MS;
  }
  /** Builds the hint / worked-answer bubble at (x, y). */
  protected makeHintBubble(x: number, y: number, text: string, maxW: number, strong: boolean): Phaser.GameObjects.Container {
    return makeBubble(this, x, y, text, maxW, strong ? 42 : 38);
  }

  // ---------- lifecycle ----------
  init(data: MiniGameLaunch) {
    this.cfg = data;
    this.problem = null;
    this.round = 0;
    this.misses = 0;
    this.locked = true;
    this.missRecorded = false;
    this.done = false;
    this.pips = [];
    this.bubble = null;
    this.rng = makeRng((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
  }

  create() {
    // a mouse click always wiggles a pixel or two: that is a tap, not the start of a drag
    this.input.dragDistanceThreshold = 10;
    this.buildChrome();
    debugRefs.miniGame = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (debugRefs.miniGame === this) debugRefs.miniGame = null;
    });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.setupGame(this.area);
    this.nextProblem();
  }

  get gameId() {
    return this.cfg.id;
  }

  get canAnswer() {
    return !this.locked && !this.done && !!this.problem;
  }

  private buildChrome() {
    this.add.rectangle(640, 480, 1280, 960, 0x1d1a3a, 0.6).setInteractive(); // swallow taps
    addPanel(this, 640, 470, 1200, 900);
    const inner = this.add.graphics();
    inner.fillStyle(0xe6eeff, 1).fillRoundedRect(70, 160, 1140, 730, 30);
    inner.lineStyle(5, 0x1d1a3a, 1).strokeRoundedRect(70, 160, 1140, 730, 30);
    addText(this, 560, 88, this.title, 52);
    makeIconButton(this, 130, 92, TEX.iconBack, () => this.close(), 100);
    makeMuteButton(this, 1150, 92);
    this.buildCocoa();
    const n = this.cfg.rounds;
    const shift = this.wideBadge ? 70 : 0;
    for (let i = 0; i < n; i++) {
      const img = this.add.image(830 - shift + i * 60 + (3 - n) * 30, 92, TEX.lantern, 0);
      img.setDisplaySize(48, 64);
      this.pips.push(img);
    }
    const bx = this.wideBadge ? 920 : 990;
    const bw = 1094 - bx;
    this.badgeMaxW = bw - 12;
    const bg = this.add.graphics();
    bg.fillStyle(0x2e2a5c, 1).fillRoundedRect(bx, 66, bw, 52, 18);
    bg.lineStyle(4, 0x1d1a3a, 1).strokeRoundedRect(bx, 66, bw, 52, 18);
    this.badge = this.add.text(bx + bw / 2, 92, '', textStyle(36, { color: '#fff1a8', strokeThickness: 4 })).setOrigin(0.5).setDepth(10);
  }

  private badgeMaxW = 92;

  private updateBadge() {
    if (!this.problem) return;
    this.badge.setText(this.levelLabel(this.problem)).setScale(1);
    if (this.wideBadge && this.badge.width > this.badgeMaxW) this.badge.setScale(this.badgeMaxW / this.badge.width);
  }

  private nextProblem() {
    this.hideBubble();
    this.problem = this.makeProblem();
    this.misses = 0;
    this.missRecorded = false;
    this.cocoaUsed = false;
    this.syncCocoa();
    this.updateBadge();
    this.buildRound(this.problem, this.area);
    this.locked = false;
  }

  /** Close the mini game; onDone fires exactly once. */
  close(completed = false) {
    if (this.done) return;
    this.done = true;
    this.locked = true;
    if (debugRefs.miniGame === this) debugRefs.miniGame = null;
    const cb = this.cfg.onDone;
    this.scene.stop();
    cb({ completed });
  }

  // ---------- answering ----------

  /**
   * Check an answer and run the feedback ladder. Returns what happened:
   * 'correct', 'retry' (1st miss), 'hint' (2nd miss, hint shown), 'reveal' (3rd miss, worked
   * answer shown, a fresh problem follows). Ignored (returns 'retry') when !canAnswer.
   */
  protected submit(answer: number | string): SubmitResult {
    const p = this.problem;
    if (!p || this.locked || this.done) return 'retry';
    if (isCorrectAnswer(p, answer)) {
      this.win(p, answer);
      return 'correct';
    }
    this.misses++;
    if (!this.missRecorded) {
      this.missRecorded = true;
      this.recordProblem(p, false);
      this.updateBadge();
    }
    audio.sfx('wrong');
    if (this.misses === 1) {
      audio.voiceRandom('v_wrong', 4);
      this.onWrong('retry', answer);
      return 'retry';
    }
    if (this.misses === 2) {
      audio.voice('v_hint');
      this.showBubble(p.hint);
      this.onWrong('hint', answer);
      return 'hint';
    }
    this.locked = true;
    this.showBubble(p.explain, true);
    this.onWrong('reveal', answer);
    this.time.delayedCall(this.revealMs(), () => {
      if (this.done) return;
      this.clearRound();
      this.nextProblem();
    });
    return 'reveal';
  }

  private win(p: Problem, answer: number | string) {
    this.locked = true;
    this.hideBubble();
    audio.sfx('correct');
    if (this.rng() < 0.6) audio.voiceRandom('v_right', 6);
    if (!this.missRecorded) {
      const change = this.recordProblem(p, true);
      if (change === 1) this.levelUp();
    }
    this.updateBadge();
    const pip = this.pips[this.round];
    if (pip) {
      pip.setFrame(1).setDisplaySize(48, 64);
      this.tweens.add({ targets: pip, scale: pip.scale * 1.35, duration: 160, yoyo: true });
      starBurst(this, pip.x, pip.y, 0xffc93c, 50);
    }
    const extra = (this.onRoundWon(answer) as number | undefined) ?? 0;
    this.round++;
    this.time.delayedCall(CELEBRATE_MS + extra, () => {
      if (this.done) return;
      if (this.round >= this.cfg.rounds) {
        const fin = (this.onAllRoundsWon() as number | undefined) ?? 600;
        this.time.delayedCall(fin, () => this.close(true));
      } else {
        this.clearRound();
        this.nextProblem();
      }
    });
  }

  private levelUp() {
    audio.voice('v_levelup');
    const t = addText(this, this.wideBadge ? 1007 : 1042, 150, 'Level up!', 40, { color: '#ffc93c' }).setDepth(40).setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: 130, delay: 1600, duration: 500, onComplete: () => t.destroy() });
    starBurst(this, 1042, 92, 0xffc93c, 40, 12);
  }

  private showBubble(text: string, strong = false) {
    this.hideBubble();
    const a = this.hintAnchor();
    this.bubble = this.makeHintBubble(a.x, a.y, text, this.hintWidth(), strong).setDepth(30);
    this.bubble.setScale(0.6);
    this.tweens.add({ targets: this.bubble, scale: 1, duration: 220, ease: 'Back.easeOut' });
  }

  private hideBubble() {
    this.bubble?.destroy();
    this.bubble = null;
  }

  // ---------- Cocoa Flask (v2): a free hint that does not count as a miss ----------
  private cocoaBtn: Phaser.GameObjects.Container | null = null;
  private cocoaText: Phaser.GameObjects.Text | null = null;
  private cocoaUsed = false;

  private buildCocoa() {
    const b = makeIconButton(this, 262, 92, toolKey('cocoa'), () => this.useCocoa(), 100);
    this.cocoaText = this.add.text(318, 92, '', textStyle(36, { color: '#fff1a8' })).setOrigin(0, 0.5);
    b.root.add(this.cocoaText);
    this.cocoaText.setPosition(56, 0);
    this.cocoaBtn = b.root;
    this.syncCocoa();
  }

  private syncCocoa() {
    if (!this.cocoaBtn) return;
    const n = session.cocoa;
    this.cocoaBtn.setVisible(n > 0);
    this.cocoaBtn.setAlpha(this.cocoaUsed ? 0.45 : 1);
    this.cocoaText?.setText(`${n}`);
  }

  /** Uses one flask: shows the hint now. One per problem; never a miss. Returns false if not used. */
  useCocoa(): boolean {
    const p = this.problem;
    if (!p || this.locked || this.done || this.cocoaUsed || !session.useCocoa()) return false;
    this.cocoaUsed = true;
    audio.voice('v_cocoa');
    this.showBubble(p.hint);
    this.syncCocoa();
    return true;
  }

  // ---------- debug ----------
  currentProblem() {
    return this.problem;
  }

  answerCurrent(correct: boolean): string {
    const p = this.problem;
    if (!p || !this.canAnswer) return 'not-ready';
    const value = correct
      ? p.answer
      : p.tol !== undefined
        ? p.choices.find((c) => !isCorrectAnswer(p, c)) ?? -999
        : p.choices.find((c) => !answersEqual(c, p.answer)) ?? -999;
    this.debugPick(value);
    return String(value);
  }
}
