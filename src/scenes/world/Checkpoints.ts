// Checkpoint lanterns: light as the hero passes (remembered for this visit of the area), give the respawn point
// after a fall into a gap, and count falls per stretch so the helper cloud can come after 3.
import Phaser from 'phaser';
import { TEX4 } from '../../art/keys';
import { audio } from '../../core/audio';
import type { CheckpointDef } from '../zones';
import { CHECKPOINT_R, FallCounter } from './pieceLogic';

export class Checkpoints {
  readonly defs: CheckpointDef[];
  private posts: Phaser.GameObjects.Sprite[] = [];
  private glows: Phaser.GameObjects.Arc[] = [];
  readonly lit: boolean[];
  /** Most recently lit checkpoint (the respawn point), -1 = the area entrance. */
  last = -1;
  readonly falls = new FallCounter();

  constructor(private scene: Phaser.Scene, defs: CheckpointDef[]) {
    this.defs = defs;
    this.lit = defs.map(() => false);
    for (const d of defs) {
      const glow = scene.add.circle(d.x, d.y - 150, 46, 0xffc93c, 0.0).setDepth(1.44).setBlendMode(Phaser.BlendModes.ADD);
      this.glows.push(glow);
      this.posts.push(scene.add.sprite(d.x, d.y + 4, TEX4.checkpoint, 0).setOrigin(0.5, 1).setDepth(1.45).setScale(0.9));
    }
  }

  /** Lights any checkpoint the hero (x, feet) is passing. Returns the index lit now, or -1. */
  update(x: number, feet: number, silent = false): number {
    for (let i = 0; i < this.defs.length; i++) {
      const d = this.defs[i];
      if (Math.abs(x - d.x) > CHECKPOINT_R || feet < d.y - 240 || feet > d.y + 30) continue;
      if (this.last === i) return -1;
      this.last = i;
      if (this.lit[i]) return -1;
      this.lit[i] = true;
      this.posts[i].setFrame(1);
      const g = this.glows[i];
      g.setAlpha(0.35);
      this.scene.tweens.add({ targets: g, alpha: 0.18, scale: 1.4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      if (!silent) {
        audio.sfx('checkpoint');
        this.scene.tweens.add({ targets: this.posts[i], scaleY: 1.05, duration: 140, yoyo: true });
      }
      return i;
    }
    return -1;
  }

  /** Where to float back to after a fall: the last lit checkpoint, or `entry`. */
  respawn(entry: { x: number; y: number }) {
    const d = this.defs[this.last];
    return d ? { x: d.x, y: d.y } : entry;
  }

  /** Records a fall in the current stretch; true exactly when the helper cloud should now appear. */
  recordFall(): boolean {
    return this.falls.record(this.last);
  }

  /** Ferry path for the current stretch (if the layout gives one). */
  ferry() {
    return this.defs[this.last]?.ferry ?? null;
  }

  /** Lights checkpoint i (debug) and makes it the respawn point. */
  force(i: number) {
    const d = this.defs[i];
    if (!d) return false;
    this.last = -1;
    this.update(d.x, d.y, true);
    this.last = i;
    return true;
  }
}
