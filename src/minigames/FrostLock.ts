// Frost Lock: one quick multiple-choice question on an icy lock. The lock cracks open on success.
import Phaser from 'phaser';
import { miniGameSceneKey, Problem } from '../types';
import { MiniGameScene, WrongKind } from './base';
import { AnswerPad, ChoiceButtons, addCountIcon, answerPadMode, fitText, isEntry, makeAnswerPad, makeChoiceButtons, splitPrompt } from './widgets';
import { starBurst, textStyle, wobble } from '../core/ui';

const LOCK_X = 640;
const LOCK_Y = 440; // body centre
const BODY_W = 760;
const BODY_H = 280;

export class FrostLockScene extends MiniGameScene {
  protected readonly title = 'Frost Lock';
  private lock!: Phaser.GameObjects.Container;
  private shackle!: Phaser.GameObjects.Graphics;
  private choices: ChoiceButtons | null = null;
  private pad: AnswerPad | null = null;
  /** Level 10+: the answer is typed on a pad beside a smaller lock. */
  private entry = false;
  private bodyW = BODY_W;
  private lockX = LOCK_X;
  private roundObjs: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: miniGameSceneKey('frostLock') });
  }

  protected buildRound(problem: Problem, area: Phaser.Geom.Rectangle) {
    this.pad = null;
    this.choices = null;
    this.entry = isEntry(problem);
    this.bodyW = this.entry ? 560 : BODY_W;
    this.lockX = this.entry ? 360 : LOCK_X;
    this.buildLock();
    const d = problem.data;
    if (d.kind === 'count') {
      this.roundObjs.push(this.add.text(this.lockX, 240, problem.prompt, textStyle(44, { wordWrap: { width: 900 } })).setOrigin(0.5));
      this.addPile(d.count, d.item);
    } else {
      const { lead, math } = splitPrompt(problem.prompt);
      if (lead) {
        const l = this.add.text(0, -88, lead, textStyle(38, { wordWrap: { width: this.bodyW - 60, useAdvancedWrap: true } })).setOrigin(0.5);
        this.lock.add(fitText(l, this.bodyW - 50, 110));
      }
      const t = this.add
        .text(0, lead ? 30 : -10, math, textStyle(math.length > 16 ? 64 : 84, { wordWrap: { width: this.bodyW - 60, useAdvancedWrap: true } }))
        .setOrigin(0.5);
      this.lock.add(fitText(t, this.bodyW - 50, lead ? 150 : 230));
    }
    if (this.entry) {
      this.choices = null;
      this.pad = makeAnswerPad(this, answerPadMode(problem), (v) => this.pick(v), { top: 215, problem });
      return;
    }
    this.choices = makeChoiceButtons(this, problem.choices, (v) => this.pick(v), {
      x: 640,
      y: area.bottom - 82,
      width: 1040,
      height: 130,
      fontSize: 64,
      problem,
    });
  }

  private buildLock() {
    this.lock = this.add.container(this.lockX, LOCK_Y);
    this.shackle = this.add.graphics();
    this.shackle.lineStyle(48, 0x1d1a3a, 1).beginPath().arc(0, -BODY_H / 2, 120, Math.PI, 0).strokePath();
    this.shackle.lineStyle(34, 0x8fe6f2, 1).beginPath().arc(0, -BODY_H / 2, 120, Math.PI, 0).strokePath();
    this.shackle.lineStyle(8, 0xd6fbff, 1).beginPath().arc(0, -BODY_H / 2, 110, Math.PI * 1.1, Math.PI * 1.45).strokePath();
    const body = this.add.graphics();
    body.fillStyle(0x1d1a3a, 1).fillRoundedRect(-this.bodyW / 2 - 6, -BODY_H / 2 - 6, this.bodyW + 12, BODY_H + 12, 46);
    body.fillStyle(0x39b6d8, 1).fillRoundedRect(-this.bodyW / 2, -BODY_H / 2, this.bodyW, BODY_H, 40);
    body.fillStyle(0x1f7fa8, 1).fillRoundedRect(-this.bodyW / 2, BODY_H / 2 - 60, this.bodyW, 60, { tl: 0, tr: 0, bl: 40, br: 40 });
    body.fillStyle(0x8fe6f2, 1).fillRoundedRect(-this.bodyW / 2 + 24, -BODY_H / 2 + 18, this.bodyW - 140, 26, 13);
    body.fillStyle(0xd6fbff, 0.9).fillCircle(this.bodyW / 2 - 60, -BODY_H / 2 + 34, 12);
    this.lock.add([this.shackle, body]);
    this.lock.setY(LOCK_Y - (this.problem?.data.kind === 'count' ? -10 : 0));
    this.roundObjs.push(this.lock);
  }

  private addPile(count: number, item: string) {
    const n = Math.min(count, 30);
    const cols = n <= 10 ? Math.min(n, 5) : 10;
    const rows = Math.ceil(n / cols);
    const cell = Math.min(80, (this.bodyW - 60) / cols, (BODY_H - 40) / rows);
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const img = addCountIcon(this, item, (c - (cols - 1) / 2) * cell, (r - (rows - 1) / 2) * cell, cell * 0.86);
      this.lock.add(img);
    }
  }

  protected hintAnchor() {
    return this.entry ? { x: 360, y: 715 } : { x: 640, y: 648 };
  }

  protected hintWidth() {
    return this.entry ? 600 : 1000;
  }

  private pick(v: number | string) {
    if (!this.canAnswer) return;
    this.submit(v);
  }

  protected debugPick(v: number | string) {
    if (this.pad && !this.pad.enter(v)) this.submit(v);
    else if (!this.pad) this.pick(v);
  }

  protected onWrong(kind: WrongKind, answer: number | string) {
    this.choices?.wobble(answer);
    this.choices?.dim(answer);
    if (this.pad) {
      this.pad.wobble();
      this.pad.clear();
    }
    wobble(this, this.lock);
  }

  protected onRoundWon(answer: number | string) {
    const b = this.choices?.find(answer);
    if (b) this.tweens.add({ targets: b.root, scale: 1.12, duration: 160, yoyo: true });
    this.tweens.add({ targets: this.shackle, y: -70, angle: -12, duration: 260, ease: 'Back.easeOut' });
    const crack = this.add.graphics();
    crack.lineStyle(6, 0xd6fbff, 1);
    crack.beginPath().moveTo(-40, -BODY_H / 2).lineTo(10, -40).lineTo(-30, 20).lineTo(30, BODY_H / 2).strokePath();
    crack.beginPath().moveTo(10, -40).lineTo(120, -10).strokePath();
    this.lock.add(crack);
    this.time.delayedCall(300, () => {
      starBurst(this, this.lockX, LOCK_Y, 0xd6fbff, 40, 16);
      this.tweens.add({ targets: this.lock, scale: 1.08, alpha: 0, duration: 450, delay: 200 });
    });
    return 400;
  }

  protected clearRound() {
    this.choices?.destroy();
    this.choices = null;
    this.pad?.destroy();
    this.pad = null;
    this.roundObjs.forEach((o) => o.destroy());
    this.roundObjs = [];
  }
}
