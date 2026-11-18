// Loose gems: small currency gems (worth 1, no question) in lines and arcs. Picked up by touch
// (also mid-jump), pulled in by the Gem Magnet, hidden ones shown only with the Glow Lantern.
import Phaser from 'phaser';
import { ANIM2, TEX2 } from '../../art/keys';
import type { LooseDef } from '../zones';

export interface Loose {
  index: number;
  sprite: Phaser.GameObjects.Sprite;
  taken: boolean;
  pulled: boolean;
}

const PICK_R = 62;
export const MAGNET_R = 260;
const MAGNET_SPEED = 900;

export class LooseGemField {
  readonly list: Loose[] = [];

  constructor(private scene: Phaser.Scene) {}

  /** (Re)builds the gems: `available(i)` says whether gem i is there, `glow` shows hidden ones. */
  build(defs: LooseDef[], available: (i: number) => boolean, glow: boolean) {
    this.clear();
    defs.forEach((d, i) => {
      if (d.hidden && !glow) return;
      if (!available(i)) return;
      const s = this.scene.add.sprite(d.x, d.y, TEX2.looseGem, 0).setDepth(3.4);
      if (this.scene.anims.exists(ANIM2.looseGemTwinkle)) s.play({ key: ANIM2.looseGemTwinkle, startFrame: i % 4 });
      if (d.hidden) s.setTint(0xfff1a8);
      this.scene.tweens.add({ targets: s, y: d.y - 6, duration: 700 + (i % 5) * 60, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.list.push({ index: i, sprite: s, taken: false, pulled: false });
    });
  }

  clear() {
    for (const g of this.list) g.sprite.destroy();
    this.list.length = 0;
  }

  /** Moves magnet-pulled gems and returns the ones touched this frame (already marked taken). */
  update(dt: number, cx: number, cy: number, magnet: boolean): Loose[] {
    const got: Loose[] = [];
    for (const g of this.list) {
      if (g.taken) continue;
      const s = g.sprite;
      const dx = cx - s.x;
      const dy = cy - s.y;
      const d = Math.hypot(dx, dy);
      if (magnet && !g.pulled && d < MAGNET_R) {
        g.pulled = true;
        this.scene.tweens.killTweensOf(s);
      }
      if (g.pulled && d > 1) {
        const step = Math.min(d, MAGNET_SPEED * (dt / 1000));
        s.x += (dx / d) * step;
        s.y += (dy / d) * step;
      }
      if (Math.abs(cx - s.x) < PICK_R && Math.abs(cy - s.y) < PICK_R + 30) {
        g.taken = true;
        got.push(g);
      }
    }
    return got;
  }

  remaining() {
    return this.list.filter((g) => !g.taken).length;
  }
}
