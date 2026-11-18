import Phaser from 'phaser';
import { registerArt } from '../art';
import { ensurePlaceholders, ensureV2Placeholders, ensureV4Placeholders } from '../core/placeholderArt';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    try {
      registerArt(this);
    } catch (e) {
      console.warn('[LanternPeak] registerArt failed; using placeholders where needed.', e);
    }
    const made = [...ensurePlaceholders(this), ...ensureV2Placeholders(this), ...ensureV4Placeholders(this)];
    if (made.length) console.info(`[LanternPeak] ${made.length} placeholder textures:`, made.join(', '));
    this.scene.start('Title');
  }
}
