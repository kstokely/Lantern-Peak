// Ice Bridge: pick the plank with the right answer to lay the next piece of the bridge.
// Juniper hops forward one segment per round and trots across at the end.
import Phaser from 'phaser';
import { miniGameSceneKey, Problem } from '../types';
import { ANIM, TEX, HeroId } from '../art/keys';
import { addHeroSprite, playHero } from '../core/heroArt';
import { MiniGameScene, WrongKind } from './base';
import { session } from '../core/session';
import { addText, starBurst, textStyle, wobble } from '../core/ui';
import { ICON_PLURAL, formatNum } from '../math/format';
import { AnswerPad, addCountIcon, choiceLabel, fitText, isEntry, makeAnswerPad, splitPrompt, tintIcon } from './widgets';

const CLIFF_Y = 560; // top surface of both cliffs
const GAP_L = 300;
const GAP_R = 980;
const PLANK_Y = 790;

/** Things the arrays and groups can be drawn with (all have count icons). */
const PICTURE_ICONS = ['snowball', 'gem', 'pinecone', 'star', 'lantern', 'carrot', 'mitten', 'acorn', 'berry', 'bell', 'cookie', 'apple', 'candle'] as const;

interface Plank {
  root: Phaser.GameObjects.Container;
  img: Phaser.GameObjects.Image;
  value: number | string;
  cracked: boolean;
}

export class IceBridgeScene extends MiniGameScene {
  protected readonly title = 'Ice Bridge';
  private juniper!: Phaser.GameObjects.Sprite;
  private scarf = 0;
  private heroId: HeroId = 'juniper';
  private planks: Plank[] = [];
  private roundObjs: Phaser.GameObjects.GameObject[] = [];
  private picked: Plank | null = null;
  private pad: AnswerPad | null = null;
  private entryPlank: Plank | null = null;
  private entryText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: miniGameSceneKey('iceBridge') });
  }

  private get segW() {
    return (GAP_R - GAP_L) / this.cfg.rounds;
  }

  protected setupGame() {
    this.planks = [];
    this.roundObjs = [];
    this.picked = null;
    this.pad = null;
    this.entryPlank = null;
    this.entryText = null;
    const g = this.add.graphics();
    // chasm shadow
    g.fillStyle(0x8a92d8, 1).fillRect(GAP_L, CLIFF_Y + 20, GAP_R - GAP_L, 880 - CLIFF_Y - 20);
    g.fillStyle(0x5b5fb0, 1).fillRect(GAP_L, CLIFF_Y + 140, GAP_R - GAP_L, 880 - CLIFF_Y - 140);
    for (const [x0, x1] of [
      [72, GAP_L],
      [GAP_R, 1208],
    ]) {
      g.fillStyle(0x1d1a3a, 1).fillRoundedRect(x0 - 4, CLIFF_Y - 4, x1 - x0 + 8, 330, 26);
      g.fillStyle(0x6d6690, 1).fillRoundedRect(x0, CLIFF_Y, x1 - x0, 326, 22);
      g.fillStyle(0x4a4368, 1).fillRect(x0, CLIFF_Y + 120, x1 - x0, 60);
      g.fillStyle(0xfff8ea, 1).fillRoundedRect(x0, CLIFF_Y - 4, x1 - x0, 38, 18);
      g.fillStyle(0xc9d6f5, 1).fillRect(x0, CLIFF_Y + 24, x1 - x0, 10);
    }
    // dashed outline of the slots still to build
    g.lineStyle(4, 0x3b3a7a, 0.6);
    for (let i = 0; i < this.cfg.rounds; i++) g.strokeRoundedRect(GAP_L + i * this.segW + 6, CLIFF_Y + 2, this.segW - 12, 60, 14);
    this.scarf = session.profile?.scarf ?? 0;
    this.heroId = session.hero;
    this.juniper = addHeroSprite(this, 200, CLIFF_Y + 6, this.heroId, this.scarf, 0.72).setDepth(5);
    playHero(this.juniper, ANIM.idle, this.heroId, this.scarf);
    // plank tray
    g.fillStyle(0xc9d6f5, 0.65).fillRoundedRect(110, PLANK_Y - 70, 1060, 140, 30);
  }

  protected hintAnchor() {
    return this.pad ? { x: 640, y: 575 } : { x: 640, y: 660 };
  }

  protected buildRound(problem: Problem, area: Phaser.Geom.Rectangle) {
    void area;
    let { lead, math } = splitPrompt(problem.prompt);
    const icon = PICTURE_ICONS[Math.floor(this.rng() * PICTURE_ICONS.length)];
    const pictured = this.illustrate(problem, icon);
    if (pictured) lead = this.namedLead(lead, ICON_PLURAL[icon]);
    if (lead) this.roundObjs.push(fitText(this.add.text(640, 210, lead, textStyle(40)).setOrigin(0.5), 1040, 60));
    // Without a picture the math gets the whole upper area and big numbers.
    const my = pictured ? (lead ? 262 : 235) : lead ? 330 : 320;
    const size = pictured ? 64 : 100;
    const t = this.add.text(640, my, math, textStyle(size, { wordWrap: { width: 1040, useAdvancedWrap: true } })).setOrigin(0.5);
    this.roundObjs.push(fitText(t, 1040, pictured ? 84 : 200));
    if (isEntry(problem)) {
      // Level 10+: type the number onto a blank plank; the plank slides in when it is right.
      const plank = this.makePlank(640, 452, '', 330, false);
      this.entryPlank = plank;
      this.entryText = plank.root.list[1] as Phaser.GameObjects.Text;
      this.entryText.setFontSize(84);
      this.planks = [plank];
      this.pad = makeAnswerPad(this, 'number', (v) => this.submitTyped(v), {
        layout: 'wide',
        display: false,
        top: 640,
        x: 640,
        maxDigits: 6,
        onChange: (f) => this.entryText?.setText(f[0] ? formatNum(Number(f[0])) : ''),
      });
      return;
    }
    const n = problem.choices.length;
    const w = 236;
    const gap = 22;
    const x0 = 640 - ((n - 1) * (w + gap)) / 2;
    this.planks = problem.choices.map((v, i) => this.makePlank(x0 + i * (w + gap), PLANK_Y, v, w));
  }

  /** Makes the instruction line name the thing that is drawn. */
  private namedLead(lead: string, name: string): string {
    if (!lead) return 'Count with ' + name + '!';
    if (/^Share \d+ equally/.test(lead)) return lead.replace(/^Share (\d+) equally/, 'Share $1 ' + name + ' equally');
    return lead.replace(/:$/, ' ' + name + ':');
  }

  private submitTyped(v: number | string) {
    if (!this.canAnswer || !this.entryPlank) return;
    this.picked = this.entryPlank;
    this.submit(v);
  }

  private makePlank(x: number, y: number, value: number | string, w: number, clickable = true): Plank {
    const root = this.add.container(x, y).setDepth(8);
    const img = this.add.image(0, 0, TEX.plank, 0).setDisplaySize(w, 110);
    const t = this.add.text(0, -2, choiceLabel(this.problem, value), textStyle(60)).setOrigin(0.5);
    root.add([img, t]);
    const plank: Plank = { root, img, value, cracked: false };
    if (clickable) {
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', () => this.pick(plank));
    }
    return plank;
  }

  /** Snowball array for small facts (rows x columns), or two groups for add/sub. */
  /** Returns true if a picture was drawn. */
  private illustrate(p: Problem, icon: string): boolean {
    const d = p.data;
    if (d.kind !== 'arith') return false;
    const cy = 400;
    // "a groups of b" draws each group as a column (reads left to right, bigger snowballs);
    // "a rows of b" keeps a rows.
    if (d.op === 'x' && d.a <= 10 && d.b <= 10) {
      if (/group/i.test(p.prompt) && d.a > d.b) this.grid(640, cy, d.b, d.a, icon);
      else this.grid(640, cy, d.a, d.b, icon);
    }
    else if (d.op === '/' && d.b <= 10 && d.a / d.b <= 10) this.grid(640, cy, d.b, d.a / d.b, icon);
    else if ((d.op === '+' || d.op === '-') && d.a <= 10 && d.b <= 10) {
      if (d.op === '+') {
        this.group(470, cy, d.a, 0, icon);
        this.roundObjs.push(addText(this, 640, cy, '+', 72));
        this.group(810, cy, d.b, 0, icon);
      } else {
        this.group(640, cy, d.a, d.b, icon);
      }
    } else return false;
    return true;
  }

  private grid(cx: number, cy: number, rows: number, cols: number, icon: string) {
    const cell = Math.min(50, 210 / rows, 640 / cols);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        this.roundObjs.push(addCountIcon(this, icon, cx + (c - (cols - 1) / 2) * cell, cy + (r - (rows - 1) / 2) * cell, cell * 0.88));
      }
  }

  /** n icons in rows of 5; the last `faded` are see-through (taken away). */
  private group(cx: number, cy: number, n: number, faded: number, icon: string) {
    const cols = Math.min(5, n);
    const rows = Math.ceil(n / 5);
    const cell = 52;
    for (let i = 0; i < n; i++) {
      const c = i % 5;
      const r = Math.floor(i / 5);
      const img = addCountIcon(this, icon, cx + (c - (cols - 1) / 2) * cell, cy + (r - (rows - 1) / 2) * cell, 46);
      if (i >= n - faded) {
        img.setAlpha(0.3);
        tintIcon(img, 0x8a92d8);
      }
      this.roundObjs.push(img);
    }
  }

  private pick(plank: Plank) {
    if (!this.canAnswer || plank.cracked) return;
    this.picked = plank;
    this.submit(plank.value);
  }

  protected debugPick(v: number | string) {
    if (this.pad) {
      if (!this.pad.enter(v)) this.submit(v);
      return;
    }
    const pl = this.planks.find((p) => String(p.value) === String(v) && !p.cracked) ?? this.planks.find((p) => !p.cracked);
    if (pl && String(pl.value) === String(v)) this.pick(pl);
    else this.submit(v);
  }

  protected onWrong(_kind: WrongKind) {
    const pl = this.picked;
    if (!pl) return;
    if (this.pad && pl === this.entryPlank) {
      this.pad.wobble();
      this.pad.clear();
      wobble(this, pl.root);
      pl.img.setTint(0xc9b6d8);
      this.time.delayedCall(450, () => pl.img.active && pl.img.clearTint());
      return;
    }
    pl.cracked = true;
    pl.img.setTint(0x9a94b8);
    const c = this.add.graphics();
    c.lineStyle(5, 0x1d1a3a, 0.8);
    c.beginPath().moveTo(-60, -40).lineTo(-10, 0).lineTo(-30, 20).lineTo(20, 45).strokePath();
    c.beginPath().moveTo(-10, 0).lineTo(50, -20).strokePath();
    pl.root.add(c);
    wobble(this, pl.root);
    this.tweens.add({ targets: pl.root, angle: { from: -4, to: 4 }, duration: 90, yoyo: true, repeat: 2, onComplete: () => pl.root.setAngle(0) });
  }

  protected onRoundWon() {
    const pl = this.picked;
    this.pad?.root.setVisible(false);
    const slot = this.round; // index of the slot being built (base increments after this hook)
    const sx = GAP_L + this.segW * (slot + 0.5);
    for (const p of this.planks) {
      if (p === pl) continue;
      this.tweens.add({ targets: p.root, alpha: 0, y: p.root.y + 30, duration: 250 });
    }
    if (pl) {
      // Detach from this round's list: the laid plank stays for the rest of the game.
      this.planks = this.planks.filter((p) => p !== pl);
      pl.img.disableInteractive();
      pl.img.setFrame(1);
      this.tweens.add({
        targets: pl.root,
        x: sx,
        y: CLIFF_Y + 32,
        duration: 480,
        ease: 'Cubic.easeInOut',
        onUpdate: (tw) => {
          const k = tw.progress;
          pl.img.setDisplaySize(236 + (this.segW + 4 - 236) * k, 110 - 40 * k);
        },
        onComplete: () => {
          pl.root.setDepth(4);
          starBurst(this, sx, CLIFF_Y + 30, 0xd6fbff, 20);
          this.hop(sx);
        },
      });
      // Its label shrinks into the bridge.
      this.tweens.add({ targets: pl.root.list[1], scale: 0.6, alpha: 0.8, duration: 480 });
    }
    return 700;
  }

  private hop(x: number) {
    playHero(this.juniper, ANIM.jumpUp, this.heroId, this.scarf);
    this.tweens.add({ targets: this.juniper, x, duration: 420, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: this.juniper,
      y: CLIFF_Y - 90,
      duration: 210,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.juniper.y = CLIFF_Y + 6;
        playHero(this.juniper, ANIM.idle, this.heroId, this.scarf);
      },
    });
  }

  protected onAllRoundsWon() {
    playHero(this.juniper, ANIM.walk, this.heroId, this.scarf);
    this.tweens.add({
      targets: this.juniper,
      x: 1110,
      duration: 900,
      onComplete: () => {
        playHero(this.juniper, ANIM.cheer, this.heroId, this.scarf);
        starBurst(this, 1110, CLIFF_Y - 120, 0xffc93c, 20, 14);
        addText(this, 640, 470, 'Bridge built!', 64, { color: '#ffc93c' }).setDepth(20);
      },
    });
    return 1900;
  }

  protected clearRound() {
    this.pad?.destroy();
    this.pad = null;
    this.entryPlank = null;
    this.entryText = null;
    this.planks.forEach((p) => p.root.destroy());
    this.planks = [];
    this.roundObjs.forEach((o) => o.destroy());
    this.roundObjs = [];
    this.picked = null;
  }
}
