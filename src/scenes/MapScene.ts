// The mountain map: 5 zone markers from base to summit plus a trophy shelf.
import Phaser from 'phaser';
import { ANIM, TEX } from '../art/keys';
import { addHeroSprite, heroPortrait, playHero } from '../core/heroArt';
import { releaseZoneArt } from '../art';
import { AREAS_PER_ZONE, NUM_ZONES, PRESENTS_PER_ZONE, ZONE_NAMES } from '../types';
import { TEX2 } from '../art/keys';
import { AREAS } from './zones';
import { session } from '../core/session';
import { audio } from '../core/audio';
import { addPanel, addSnow, addText, bandedRect, makeButton, makeIconButton, makeMuteButton, wobble } from '../core/ui';

const MARKERS = [
  { x: 230, y: 800, lx: 1 },
  { x: 560, y: 680, lx: -1 },
  { x: 330, y: 530, lx: 1 },
  { x: 610, y: 380, lx: -1 },
  { x: 560, y: 190, lx: 1 },
];

export class MapScene extends Phaser.Scene {
  constructor() {
    super('Map');
  }

  create() {
    const p = session.profile;
    if (!p) {
      this.scene.start('Profiles');
      return;
    }
    audio.stopWind();
    audio.setMusic('menu');
    // the map paints its own backdrop: drop zone backgrounds except zone 0 (Title/Profiles)
    releaseZoneArt(this, 0, [0]);
    const g = this.add.graphics();
    bandedRect(g, 0, 0, 1280, 960, 0x3a6fd8, 0xffe9c9);
    // mountain
    g.fillStyle(0x1d1a3a, 1).fillTriangle(10, 960, 560, 90, 1100, 960);
    g.fillStyle(0x8a92d8, 1).fillTriangle(26, 960, 560, 110, 1084, 960);
    g.fillStyle(0x5b5fb0, 1).fillTriangle(560, 110, 1084, 960, 700, 960);
    g.fillStyle(0xfff8ea, 1).fillTriangle(560, 110, 445, 290, 680, 290);
    g.fillStyle(0xe6eeff, 1).fillTriangle(445, 290, 500, 330, 560, 290).fillTriangle(560, 290, 620, 335, 680, 290);
    // trail
    g.lineStyle(14, 0xfff8ea, 0.9);
    g.beginPath();
    g.moveTo(MARKERS[0].x, MARKERS[0].y);
    for (let i = 1; i < MARKERS.length; i++) g.lineTo(MARKERS[i].x, MARKERS[i].y);
    g.strokePath();
    addSnow(this, 5);

    MARKERS.forEach((m, z) => this.marker(m, z));

    // Juniper by the highest unlocked zone
    const top = MARKERS[Math.min(p.unlockedZone, NUM_ZONES - 1)];
    const goat = addHeroSprite(this, top.x - 110 * top.lx, top.y + 50, p.hero, p.scarf, 0.6).setDepth(20);
    goat.setFlipX(top.lx < 0);
    playHero(goat, ANIM.idle, p.hero, p.scarf);
    if (p.finished) {
      const star = this.add.image(560, 70, TEX.star).setTint(0xffc93c).setScale(3).setDepth(20);
      this.tweens.add({ targets: star, angle: 360, duration: 6000, repeat: -1 });
    }

    this.shelf();
    makeIconButton(this, 80, 80, TEX.iconBack, () => this.scene.start('Profiles'), 100).root.setDepth(30);
    const nm = addText(this, 160, 80, p.name, 48).setOrigin(0, 0.5).setDepth(30);
    if (nm.width > 215) nm.setScale(215 / nm.width);
    const wb = makeButton(this, 545, 80, 310, 120, 'Wardrobe', () => this.scene.start('Wardrobe'), 40, 0xffd98a);
    wb.root.setDepth(30);
    wb.label.x = 38;
    const por = heroPortrait(this, p.hero);
    if (por) wb.root.add(this.add.image(-108, 0, por).setDisplaySize(92, 92));
    else wb.root.add(addHeroSprite(this, -108, 48, p.hero, p.scarf, 0.4));
    makeButton(this, 800, 80, 220, 112, 'Store', () => this.scene.start('Store', { from: 'map' }), 42).root.setDepth(30);
    makeButton(this, 1035, 80, 210, 112, 'Lodge', () => this.scene.start('Lodge'), 42, 0x8fe6f2).root.setDepth(30);
    const purse = this.add.graphics().setDepth(29);
    purse.fillStyle(0x1d1a3a, 0.5).fillRoundedRect(150, 128, 250, 84, 28);
    this.add.image(196, 170, TEX2.purse).setDisplaySize(66, 66).setDepth(30);
    addText(this, 236, 170, String(p.purse), 44, { color: '#fff1a8' }).setOrigin(0, 0.5).setDepth(30);
    makeMuteButton(this).root.setDepth(30);
  }

  /** Areas of a camp that still hide presents, frost gems or Flurries. */
  private hiding(z: number): boolean[] {
    const p = session.p;
    const zp = p.zones[z];
    return Array.from({ length: AREAS_PER_ZONE }, (_, a) => {
      const L = AREAS[z][a];
      return L.presents.some((x) => !zp.presents[x.index]) || L.gems.some((g) => !zp.gems[g.index]) || L.flurries.some((f) => !p.flurries[f.kind]);
    });
  }

  private marker(m: { x: number; y: number; lx: number }, z: number) {
    const p = session.p;
    const unlocked = z <= p.unlockedZone;
    const delivered = p.zones[z].delivered;
    const c = this.add.container(m.x, m.y).setDepth(10);
    const face = this.add.image(0, 0, TEX.buttonRound, 0).setDisplaySize(130, 130);
    const num = addText(this, 0, -4, String(z + 1), 60);
    c.add([face, num]);
    const label = addText(this, m.lx * 90, 0, ZONE_NAMES[z], 36).setOrigin(m.lx > 0 ? 0 : 1, 0.5);
    c.add(label);
    if (!unlocked) {
      face.setTint(0x8a92d8);
      num.setAlpha(0.5);
      label.setAlpha(0.7);
      const ice = this.add.circle(0, 0, 62, 0xd6fbff, 0.55).setStrokeStyle(5, 0x8fe6f2);
      const frost = this.add.graphics();
      frost.lineStyle(6, 0xffffff, 0.9);
      for (let a = 0; a < 3; a++) {
        const r = (a * Math.PI) / 3;
        frost.lineBetween(-Math.cos(r) * 34, -Math.sin(r) * 34, Math.cos(r) * 34, Math.sin(r) * 34);
      }
      c.add([ice, frost]);
    } else if (delivered) {
      const lan = this.add.image(m.lx * -60, -60, TEX.lantern, 1).setDisplaySize(54, 72);
      c.add(lan);
    } else {
      this.tweens.add({ targets: face, scale: face.scale * 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    face.setInteractive({ useHandCursor: true });
    face.on('pointerup', () => {
      if (!unlocked) {
        audio.sfx('wrong');
        wobble(this, c);
        return;
      }
      audio.sfx('click');
      this.scene.start('World', { zone: z });
    });
  }

  private shelf() {
    const p = session.p;
    const x = 1110;
    const map = p.tools.includes('trailMap');
    addPanel(this, x, 560, 320, 700).setDepth(15);
    addText(this, x, 250, 'Camps', 40).setDepth(16);
    for (let z = NUM_ZONES - 1; z >= 0; z--) {
      const y = 330 + (NUM_ZONES - 1 - z) * 112;
      const zp = p.zones[z];
      const lan = zp.presents.filter(Boolean).length;
      const dim = z > p.unlockedZone ? 0.45 : 1;
      const sh = this.add.graphics().setDepth(16);
      sh.fillStyle(0x5a3320, 1).fillRect(x - 140, y + 46, 280, 10);
      addText(this, x - 118, y, String(z + 1), 44).setDepth(16).setAlpha(dim);
      this.add.image(x - 62, y, TEX.iconLantern).setDisplaySize(52, 52).setDepth(16).setAlpha(dim);
      addText(this, x - 30, y, `${lan}/${PRESENTS_PER_ZONE}`, 40).setOrigin(0, 0.5).setDepth(16).setAlpha(dim);
      const star = this.add.image(x + 62, y, TEX2.starGold).setDisplaySize(60, 60).setDepth(16);
      if (lan < PRESENTS_PER_ZONE) star.setTintFill(0x3b3a7a).setAlpha(0.35 * dim);
      if (map && z <= p.unlockedZone) {
        // Trail Map: one dot per area (Trail, side 1, side 2); bright = still hides something
        this.hiding(z).forEach((h, a) => {
          const d = this.add.circle(x + 120, y - 30 + a * 30, 11, h ? 0xffc93c : 0x3b3a7a, h ? 1 : 0.5).setStrokeStyle(3, 0x1d1a3a).setDepth(17);
          if (h) this.tweens.add({ targets: d, scale: 1.3, duration: 600, yoyo: true, repeat: -1 });
        });
      }
    }
    if (map) addText(this, x, 856, 'Gold dots: secrets left', 36, { wordWrap: { width: 290 } }).setDepth(16);
  }
}
