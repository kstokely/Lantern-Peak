// Summit celebration: the great lantern lights, Bluster cheers up, confetti.
import Phaser from 'phaser';
import { ANIM, TEX, bgKey, juniperAnim, juniperKey } from '../art/keys';
import { addHeroSprite, playHero } from '../core/heroArt';
import { ensureZoneArt, releaseZoneArt } from '../art';
import { session } from '../core/session';
import { audio } from '../core/audio';
import { addSnow, addText, confetti, makeButton, makeMuteButton, starBurst } from '../core/ui';

export class FinaleScene extends Phaser.Scene {
  constructor() {
    super('Finale');
  }

  create() {
    const p = session.profile;
    audio.setMusic('camp5');
    session.finish();
    ensureZoneArt(this, 4);
    releaseZoneArt(this, 4);
    for (const l of ['sky', 'far', 'mid', 'near'] as const) this.add.image(640, 480, bgKey(4, l));
    this.add.image(640, 800, bgKey(4, 'ground')).setOrigin(0.5, 0.2);
    addSnow(this, 5);

    const glow = this.add.circle(640, 380, 260, 0xffc93c, 0).setBlendMode(Phaser.BlendModes.ADD);
    const lantern = this.add.image(640, 380, TEX.lantern, 0).setScale(2.6);
    const hero = session.hero;
    const bluster = this.add.sprite(270, 250, TEX.bluster, 2).setVisible(hero !== 'bluster');
    this.tweens.add({ targets: bluster, y: 270, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const scarf = p?.scarf ?? 0;
    const goat = addHeroSprite(this, 900, 800, hero, scarf, 1.1).setFlipX(true);
    playHero(goat, ANIM.idle, hero, scarf);
    // when another friend is the hero, Juniper cheers beside them
    const guide = hero === 'juniper' ? null : this.add.sprite(1070, 800, juniperKey(scarf), 0).setOrigin(0.5, 1).setScale(1.0).setFlipX(true);
    guide?.play(juniperAnim(ANIM.idle, scarf));

    this.time.delayedCall(900, () => {
      lantern.setFrame(1);
      audio.sfx('win');
      audio.voice('v_win');
      starBurst(this, 640, 380, 0xfff1a8, 20, 24);
      this.tweens.add({ targets: glow, fillAlpha: 0.35, duration: 800 });
      this.tweens.add({ targets: glow, scale: 1.12, duration: 1200, yoyo: true, repeat: -1, delay: 800 });
      playHero(goat, ANIM.cheer, hero, scarf);
      guide?.play(juniperAnim(ANIM.cheer, scarf));
    });
    this.time.delayedCall(1900, () => {
      bluster.setFrame(3);
      this.tweens.add({ targets: bluster, x: 420, duration: 1500, ease: 'Sine.easeInOut' });
      addText(this, 640, 120, 'You lit the Lantern Festival!', 60, { color: '#ffc93c' });
      addText(this, 640, 640, hero === 'bluster' ? 'Even the storm cloud is cheering!' : 'Bluster wants to join the party!', 40);
    });
    for (let i = 0; i < 4; i++) this.time.delayedCall(1000 + i * 900, () => confetti(this, 300 + Math.random() * 680, 220, 30));
    this.time.delayedCall(3500, () => {
      makeButton(this, 640, 860, 460, 130, 'Back to the map', () => this.scene.start('Map'), 48);
    });
    makeMuteButton(this).root.setDepth(30);
  }
}
