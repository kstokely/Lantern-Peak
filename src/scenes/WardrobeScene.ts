// The Wardrobe (from the Map): pick the hero, accent colour, hat and Flurry follower, with a live preview.
import Phaser from 'phaser';
import { ANIM, FLURRY_NAMES, HERO_IDS, HERO_NAMES, HeroId, SCARF_COLOURS, TEX, TEX2, flurryBobAnim, flurryKey, hatKey, juniperAnim, juniperKey } from '../art/keys';
import { NUM_FLURRIES } from '../types';
import { session } from '../core/session';
import { audio } from '../core/audio';
import { addHeroSprite, heroHat, heroPortrait, playHero, skinHero } from '../core/heroArt';
import { heroRequirement, heroRequirementShort, heroUnlocked } from '../core/heroes';
import { addText, makeButton, makeIconButton, makeMuteButton, textStyle, wobble } from '../core/ui';
import { heartTexture } from './world/Trail';

type Tab = 'colour' | 'hat' | 'friend';
const INK = 0x1d1a3a;
const CARD_W = 228;
const CARD_H = 380;
const PREVIEW = { x: 40, y: 560, w: 470, h: 392 };

export class WardrobeScene extends Phaser.Scene {
  private tab: Tab = 'colour';
  private hero!: Phaser.GameObjects.Sprite;
  private hat: Phaser.GameObjects.Image | null = null;
  private heroId: HeroId = 'juniper';
  private cheering = false;

  constructor() {
    super('Wardrobe');
  }

  init(data: { tab?: Tab }) {
    this.tab = data?.tab ?? 'colour';
    this.hat = null;
    this.cheering = false;
  }

  create() {
    const p = session.profile;
    if (!p) {
      this.scene.start('Profiles');
      return;
    }
    audio.setMusic('menu');
    const g = this.add.graphics();
    g.fillGradientStyle(0x3a6fd8, 0x3a6fd8, 0xffe9c9, 0xffe9c9, 1).fillRect(0, 0, 1280, 960);
    this.heroId = session.hero;
    makeIconButton(this, 80, 80, TEX.iconBack, () => this.scene.start('Map'), 104);
    addText(this, 640, 78, 'Wardrobe', 64);
    makeMuteButton(this);
    this.heroCards();
    this.preview();
    this.tabs();
    this.panel();
  }

  // ---------- hero cards ----------

  private heroCards() {
    const p = session.p;
    HERO_IDS.forEach((h, i) => {
      const x = 640 + (i - 2) * (CARD_W + 12);
      const y = 140 + CARD_H / 2;
      const open = heroUnlocked(p, h);
      const chosen = this.heroId === h;
      const c = this.add.container(x, y);
      const bg = this.add.graphics();
      bg.fillStyle(INK, 0.3).fillRoundedRect(-CARD_W / 2 + 5, -CARD_H / 2 + 9, CARD_W, CARD_H, 28);
      bg.fillStyle(open ? 0xfff8ea : 0xc9d6f5, 1).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 28);
      bg.lineStyle(6, chosen ? 0x3fa06a : INK, 1).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 28);
      if (chosen) bg.lineStyle(6, 0x3fa06a, 1).strokeRoundedRect(-CARD_W / 2 + 8, -CARD_H / 2 + 8, CARD_W - 16, CARD_H - 16, 22);
      c.add(bg);
      const por = heroPortrait(this, h);
      let pic: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
      if (por) pic = this.add.image(0, -CARD_H / 2 + 104, por).setDisplaySize(138, 138);
      else {
        pic = this.add.sprite(0, -CARD_H / 2 + 170, juniperKey(p.scarf), 0).setOrigin(0.5, 1).setScale(0.72);
        skinHero(pic as Phaser.GameObjects.Sprite, h, p.scarf);
      }
      if (!open) pic.setTint(0x6d6690).setAlpha(0.8);
      c.add(pic);
      const name = this.add.text(0, -CARD_H / 2 + 228, HERO_NAMES[h], textStyle(40, { color: '#1d1a3a', stroke: '#fff8ea', strokeThickness: 2 })).setOrigin(0.5);
      c.add(name);
      if (open) {
        c.add(this.add.text(0, -CARD_H / 2 + 292, chosen ? 'Playing!' : 'Tap to play', textStyle(36, { color: chosen ? '#2f7d4d' : '#4a4368', stroke: '#fff8ea', strokeThickness: 2 })).setOrigin(0.5));
      } else {
        const lk = this.add.image(-CARD_W / 2 + 36, -CARD_H / 2 + 36, TEX2.lockBadge).setDisplaySize(52, 52);
        const req = this.add
          .text(0, -CARD_H / 2 + 322, heroRequirementShort(p, h), textStyle(36, { color: '#3b3a7a', stroke: '#c9d6f5', strokeThickness: 2, align: 'center', wordWrap: { width: CARD_W - 20 } }))
          .setOrigin(0.5, 0.5);
        req.setLineSpacing(-4);
        c.add([lk, req]);
        if (req.height > 126) req.setScale(126 / req.height);
      }
      const hit = this.add.zone(0, 0, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
      c.add(hit);
      c.setData('hero', h);
      hit.on('pointerup', () => {
        if (!open) {
          audio.sfx('wrong');
          wobble(this, c);
          this.say(heroRequirement(p, h));
          return;
        }
        if (chosen) return this.cheer();
        audio.sfx('click');
        session.setHero(h);
        this.scene.restart({ tab: this.tab });
      });
    });
  }

  private note: Phaser.GameObjects.Container | null = null;

  /** Full requirement sentence for a locked hero. */
  private say(text: string) {
    this.note?.destroy();
    const t = this.add.text(0, 0, text, textStyle(44, { color: '#1d1a3a', stroke: '#fff8ea', strokeThickness: 2 })).setOrigin(0.5);
    const w = t.width + 70;
    const g = this.add.graphics();
    g.fillStyle(0xfff8ea, 1).fillRoundedRect(-w / 2, -42, w, 84, 28).lineStyle(6, INK, 1).strokeRoundedRect(-w / 2, -42, w, 84, 28);
    const c = this.add.container(640, 540, [g, t]).setDepth(40);
    this.note = c;
    this.tweens.add({ targets: c, alpha: 0, delay: 3200, duration: 400, onComplete: () => c.destroy() });
  }

  // ---------- live preview ----------

  private preview() {
    const p = session.p;
    const { x, y, w, h } = PREVIEW;
    const g = this.add.graphics();
    g.fillStyle(INK, 0.3).fillRoundedRect(x + 6, y + 10, w, h, 30);
    g.fillStyle(0xe6eeff, 1).fillRoundedRect(x, y, w, h, 30);
    g.lineStyle(6, INK, 1).strokeRoundedRect(x, y, w, h, 30);
    g.fillStyle(0xfff8ea, 1).fillRoundedRect(x + 6, y + h - 78, w - 12, 72, 24);
    const feet = y + h - 40;
    const hx = x + w - 130;
    // followers trail to the left of the hero: Juniper (when she is not the hero), then the Flurry
    if (this.heroId !== 'juniper') {
      const j = this.add.sprite(hx - 150, feet, juniperKey(p.scarf), 0).setOrigin(0.5, 1).setScale(0.95).setDepth(1);
      j.play(juniperAnim(ANIM.idle, p.scarf));
    }
    const fk = session.follower;
    if (fk >= 0) {
      const fx = hx - (this.heroId !== 'juniper' ? 290 : 160);
      const f = this.add.sprite(fx, feet + 2, flurryKey(fk), 0).setOrigin(0.5, 1).setScale(1.2).setDepth(1);
      if (this.anims.exists(flurryBobAnim(fk))) f.play(flurryBobAnim(fk));
      this.add.image(fx, feet - 150, heartTexture(this)).setScale(0.6).setDepth(1);
    }
    this.hero = addHeroSprite(this, hx, feet, this.heroId, p.scarf, 1.15).setDepth(2);
    playHero(this.hero, ANIM.idle, this.heroId, p.scarf);
    this.hero.setInteractive({ useHandCursor: true }).on('pointerup', () => this.cheer());
    addText(this, x + w / 2, y + 36, HERO_NAMES[this.heroId], 48, { color: '#1d1a3a', stroke: '#e6eeff', strokeThickness: 3 });
    this.syncHat();
  }

  private cheer() {
    if (this.cheering) return;
    this.cheering = true;
    const p = session.p;
    audio.sfx('gem');
    playHero(this.hero, ANIM.cheer, this.heroId, p.scarf, false);
    this.hero.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.cheering = false;
      playHero(this.hero, ANIM.idle, this.heroId, p.scarf);
    });
  }

  private syncHat() {
    const h = session.p.hat;
    if (h < 0) {
      this.hat?.destroy();
      this.hat = null;
      return;
    }
    if (!this.hat) this.hat = this.add.image(0, 0, hatKey(h)).setOrigin(0.5, 1).setDepth(3);
    else this.hat.setTexture(hatKey(h));
  }

  update() {
    if (!this.hero || !this.hat) return;
    const p = session.p;
    const fr = Number(this.hero.frame.name) || 0;
    const a = heroHat(this, this.heroId, p.scarf, fr);
    this.hat.setScale(a.scale * this.hero.scaleX).setPosition(this.hero.x + a.dx * this.hero.scaleX, this.hero.y + a.dy * this.hero.scaleY).setRotation(a.rot);
  }

  // ---------- tabs and option panel ----------

  private tabButtons: ReturnType<typeof makeButton>[] = [];
  private options: Phaser.GameObjects.GameObject[] = [];

  private tabs() {
    const labels: [Tab, string][] = [['colour', 'Colour'], ['hat', 'Hat'], ['friend', 'Friend']];
    this.tabButtons = labels.map(([t, l], i) => {
      const b = makeButton(this, 640 + i * 238, 590, 226, 88, l, () => {
        this.tab = t;
        this.refreshTabs();
        this.panel();
      }, 42);
      return b;
    });
    this.refreshTabs();
  }

  private refreshTabs() {
    const order: Tab[] = ['colour', 'hat', 'friend'];
    this.tabButtons.forEach((b, i) => {
      b.face.setTint(order[i] === this.tab ? 0xffc93c : 0xb8a0d8);
      b.root.setScale(order[i] === this.tab ? 1.04 : 0.96);
    });
  }

  private tile(x: number, y: number, size: number, selected: boolean, onTap: () => void) {
    const g = this.add.graphics();
    g.fillStyle(INK, 0.25).fillRoundedRect(x - size / 2 + 4, y - size / 2 + 7, size, size, 22);
    g.fillStyle(0xfff8ea, 1).fillRoundedRect(x - size / 2, y - size / 2, size, size, 22);
    g.lineStyle(selected ? 9 : 5, selected ? 0xffc93c : INK, 1).strokeRoundedRect(x - size / 2, y - size / 2, size, size, 22);
    const z = this.add.zone(x, y, size, size).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => {
      audio.sfx('click');
      onTap();
    });
    this.options.push(g, z);
    return z;
  }

  private panel() {
    this.options.forEach((o) => o.destroy());
    this.options = [];
    const p = session.p;
    const keep = () => this.scene.restart({ tab: this.tab });
    if (this.tab === 'colour') {
      SCARF_COLOURS.forEach((c, i) => {
        const x = 650 + (i % 3) * 200;
        const y = 705 + Math.floor(i / 3) * 150;
        this.tile(x, y, 130, p.scarf === i, () => {
          session.setScarf(i);
          keep();
        });
        this.options.push(this.add.circle(x, y, 48, c).setStrokeStyle(6, INK));
      });
    } else if (this.tab === 'hat') {
      const items = [-1, ...p.hats];
      items.forEach((h, i) => {
        const x = 640 + (i % 4) * 150;
        const y = 705 + Math.floor(i / 4) * 150;
        this.tile(x, y, 130, p.hat === h, () => {
          session.wearHat(h);
          keep();
        });
        if (h < 0) this.options.push(addText(this, x, y, 'No hat', 36));
        else this.options.push(this.add.image(x, y, hatKey(h)).setDisplaySize(96, 96));
      });
      if (p.hats.length === 0) this.options.push(addText(this, 1000, 705, 'Hats come from\nMarlow’s shop', 36, { align: 'center' }));
    } else {
      const kinds = [-1, ...Array.from({ length: NUM_FLURRIES }, (_, k) => k).filter((k) => p.flurries[k])];
      kinds.forEach((k, i) => {
        const x = 610 + (i % 6) * 118;
        const y = 700 + Math.floor(i / 6) * 130;
        this.tile(x, y, 106, session.follower === k, () => {
          session.setFollower(k);
          keep();
        });
        if (k < 0) this.options.push(addText(this, x, y, 'None', 36));
        else {
          const s = this.add.sprite(x, y + 40, flurryKey(k), 3).setOrigin(0.5, 1).setScale(0.9);
          this.options.push(s);
        }
      });
      if (kinds.length === 1) this.options.push(addText(this, 900, 860, 'Make Flurry friends with the bell!', 36, { wordWrap: { width: 560 }, align: 'center' }));
      else if (session.follower >= 0) this.options.push(addText(this, 900, 920, `${FLURRY_NAMES[session.follower]} follows you`, 36));
    }
  }
}
