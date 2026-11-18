// The Flurry Lodge: album of the 10 Flurries (dark silhouettes until befriended) on the centre wall and the prize
// room shelves, laid out on the shelves drawn in the lodge background (LODGE_SHELVES): frost gems and a gold
// star per camp, then the hats.
import Phaser from 'phaser';
import { FLURRY_NAMES, TEX, TEX2, flurryKey, gemKey, hatKey } from '../art/keys';
import { LODGE_SHELVES, ensureFlurrySilhouette } from '../art';
import { GEMS_PER_ZONE, NUM_FLURRIES, NUM_ZONES } from '../types';
import { session } from '../core/session';
import { audio } from '../core/audio';
import { HAT_ITEMS } from '../core/store';
import { addPanel, addText, makeButton, makeIconButton, makeMuteButton, textStyle } from '../core/ui';
import { heartTexture } from './world/Trail';

const DIM = 0x3b3a7a;

export class LodgeScene extends Phaser.Scene {
  private dialog: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Lodge');
  }

  create() {
    const p = session.profile;
    if (!p) {
      this.scene.start('Profiles');
      return;
    }
    audio.setMusic('menu');
    this.dialog = null;
    this.add.rectangle(640, 480, 1280, 960, 0x2e2a5c);
    this.add.image(640, 480, TEX2.lodgeBg).setDisplaySize(1280, 960);
    makeIconButton(this, 80, 80, TEX.iconBack, () => this.scene.start('Map'), 104);
    makeMuteButton(this);
    // the title sits under the three wall pictures, in the free middle of the wall
    addText(this, 640, 214, 'Flurry Lodge', 54, { color: '#fff1a8' });
    addText(this, 640, 268, `Friends: ${session.friendCount()} of ${NUM_FLURRIES}`, 36);

    // ---- album: two columns of five cards between the shelves ----
    for (let k = 0; k < NUM_FLURRIES; k++) {
      const x = k % 2 === 0 ? 520 : 760;
      const y = 352 + Math.floor(k / 2) * 100;
      const friend = p.flurries[k];
      const g = this.add.graphics();
      g.fillStyle(friend ? 0xfff8ea : 0x5b5fb0, friend ? 0.95 : 0.8).fillRoundedRect(x - 116, y - 44, 232, 88, 22);
      g.lineStyle(5, 0x1d1a3a, 1).strokeRoundedRect(x - 116, y - 44, 232, 88, 22);
      const s = friend
        ? this.add.sprite(x - 66, y + 38, flurryKey(k), 3).setOrigin(0.5, 1).setScale(0.8)
        : this.add.image(x - 66, y + 38, ensureFlurrySilhouette(this, k)).setOrigin(0.5, 1).setScale(0.8).setAlpha(0.9);
      if (friend) {
        this.tweens.add({ targets: s, y: y + 30, duration: 500 + k * 40, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add.zone(x, y, 232, 88).setInteractive({ useHandCursor: true }).on('pointerup', () => {
          if (this.dialog) return;
          audio.sfx('flurry');
          this.tweens.add({ targets: s, scaleY: 1.0, duration: 120, yoyo: true });
          this.followDialog(k);
        });
        if (session.follower === k) this.add.image(x + 100, y - 38, heartTexture(this)).setScale(0.7).setDepth(3);
      }
      const name = this.add
        .text(x + 38, y, friend ? FLURRY_NAMES[k] : '???', textStyle(34, friend ? { color: '#1d1a3a', stroke: '#fff8ea', strokeThickness: 2 } : {}))
        .setOrigin(0.5);
      if (name.width > 130) name.setScale(130 / name.width);
    }

    // ---- shelves: camp 1..5, then the hats ----
    for (let z = 0; z < NUM_ZONES; z++) {
      const sh = LODGE_SHELVES[z];
      const zp = p.zones[z];
      for (let i = 0; i < GEMS_PER_ZONE; i++) {
        const img = this.add.image(sh.x0 + 24 + i * 45, sh.y - 22, gemKey(i), 0).setDisplaySize(42, 42).setDepth(2);
        if (!zp.gems[i]) img.setTintFill(DIM).setAlpha(0.45);
      }
      // the plaque under the plank: gold star + camp name
      const star = this.add.image(sh.x0 + 44, sh.y + 62, TEX2.starGold).setDisplaySize(64, 64);
      if (!session.goldStar(z)) star.setTintFill(DIM).setAlpha(0.45);
      else this.tweens.add({ targets: star, angle: { from: -10, to: 10 }, duration: 900, yoyo: true, repeat: -1 });
      addText(this, sh.x0 + 190, sh.y + 62, `Camp ${z + 1}`, 36);
    }
    const hs = LODGE_SHELVES[5];
    HAT_ITEMS.forEach((h, i) => {
      const img = this.add.image(hs.x0 + 30 + i * 57, hs.y - 28, hatKey(h.index)).setDisplaySize(54, 54).setDepth(2);
      if (!p.hats.includes(h.index)) img.setTintFill(DIM).setAlpha(0.4);
    });
    addText(this, hs.x0 + 145, hs.y + 62, 'Hats', 36);
  }

  /** Tap a befriended Flurry: "Follow me" / "Stay here". */
  private followDialog(k: number) {
    const name = FLURRY_NAMES[k];
    const following = session.follower === k;
    const c = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(640, 480, 1280, 960, 0x1d1a3a, 0.6).setInteractive();
    const panel = addPanel(this, 640, 480, 840, 620);
    const inner = this.add.graphics();
    inner.fillStyle(0xfff8ea, 1).fillRoundedRect(250, 220, 780, 480, 30);
    inner.lineStyle(5, 0x1d1a3a, 1).strokeRoundedRect(250, 220, 780, 480, 30);
    const fl = this.add.sprite(640, 400, flurryKey(k), 3).setOrigin(0.5, 1).setScale(2);
    this.tweens.add({ targets: fl, y: 388, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const t1 = addText(this, 640, 445, name, 54, { color: '#1d1a3a', stroke: '#fff8ea', strokeThickness: 2 });
    const t2 = addText(this, 640, 510, following ? `${name} is following you.` : `Should ${name} follow you?`, 40, { color: '#4a4368', stroke: '#fff8ea', strokeThickness: 2 });
    const close = () => {
      c.destroy();
      this.dialog = null;
    };
    const main = makeButton(this, 470, 625, 380, 130, following ? 'Stay here' : 'Follow me', () => {
      session.setFollower(following ? -1 : k);
      audio.sfx(following ? 'click' : 'flurry');
      this.scene.restart();
    }, 50, following ? 0xb8a0d8 : 0x8fd18a);
    const no = makeButton(this, 810, 625, 260, 130, 'Close', close, 46, 0xd6fbff);
    c.add([dim, panel, inner, fl, t1, t2, main.root, no.root]);
    this.dialog = c;
    c.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 180, ease: 'Back.easeOut' });
  }
}
