import Phaser from 'phaser';
import { TEX, bgKey } from '../art/keys';
import { ensureZoneArt, releaseZoneArt } from '../art';
import { audio } from '../core/audio';
import { addSnow, makeButton, makeMuteButton } from '../core/ui';

export class TitleScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super('Title');
  }

  create() {
    this.leaving = false;
    audio.setMusic('menu');
    ensureZoneArt(this, 0);
    releaseZoneArt(this, 0, [0]);
    for (const l of ['sky', 'far', 'mid', 'near'] as const) this.add.image(640, 480, bgKey(0, l));
    const logo = this.add.image(640, 300, TEX.logo);
    this.tweens.add({ targets: logo, y: 315, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    addSnow(this, 50);
    const play = makeButton(this, 640, 700, 440, 160, 'Play!', () => this.go(), 80);
    play.root.setDepth(60);
    this.tweens.add({ targets: play.root, scaleX: 1.05, scaleY: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    makeMuteButton(this).root.setDepth(60);
    this.input.keyboard?.on('keydown-ENTER', () => this.go());
    this.input.keyboard?.on('keydown-SPACE', () => this.go());
  }

  private go() {
    if (this.leaving) return;
    this.leaving = true;
    audio.unlock();
    audio.voice('v_welcome');
    audio.startMusic();
    this.cameras.main.fadeOut(250, 29, 26, 58);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Profiles'));
  }
}
