// Bounce pads (launch higher than a jump) and wind regions (sideways pushes in clear 2 s pulses).
import Phaser from 'phaser';
import { ANIM4, TEX4 } from '../../art/keys';
import { WIND_MAX } from '../../core/physics';
import type { PadDef, WindDef } from '../zones';
import { PAD_HALF, PAD_TOP, windStrength } from './pieceLogic';

export class Pads {
  readonly list: { def: PadDef; sprite: Phaser.GameObjects.Sprite; cool: number }[] = [];

  constructor(scene: Phaser.Scene, defs: PadDef[]) {
    for (const d of defs) {
      const s = scene.add.sprite(d.x, d.y + 4, TEX4.bouncePad, 0).setOrigin(0.5, 1).setDepth(1.35);
      this.list.push({ def: d, sprite: s, cool: 0 });
    }
  }

  /** The pad the hero's feet (x, feet) are on while not rising, or null. Plays its boing. */
  hit(x: number, feet: number, vy: number, now: number) {
    if (vy < 0) return null;
    for (const p of this.list) {
      if (now < p.cool) continue;
      if (Math.abs(x - p.def.x) > PAD_HALF || feet < p.def.y - PAD_TOP - 2 || feet > p.def.y + 2) continue;
      p.cool = now + 180;
      if (p.sprite.scene.anims.exists(ANIM4.bounce)) p.sprite.play(ANIM4.bounce, true);
      return p;
    }
    return null;
  }
}

export class Winds {
  private list: { def: WindDef; em: Phaser.GameObjects.Particles.ParticleEmitter; on: boolean }[] = [];
  /** Current strength of each region (0..1), updated by update(). */
  private str: number[] = [];

  constructor(scene: Phaser.Scene, defs: WindDef[]) {
    for (const d of defs) {
      const dir = Math.sign(d.push) || 1;
      const em = scene.add.particles(0, 0, TEX4.windStreak, {
        x: { min: d.x0, max: d.x1 },
        y: { min: d.y0, max: d.y1 },
        speedX: { min: dir * 520, max: dir * 820 },
        speedY: { min: -20, max: 20 },
        scaleX: { min: 0.9, max: 1.6 },
        scaleY: { min: 0.9, max: 1.3 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xffffff, 0xd6f0ff, 0xb9e4ff],
        lifespan: 700,
        frequency: Math.max(14, Math.round(9000 / Math.max(200, (d.x1 - d.x0) * 0.6 + (d.y1 - d.y0) * 0.4))),
        emitting: false,
      });
      em.setDepth(3.6);
      this.list.push({ def: d, em, on: false });
      this.str.push(0);
    }
  }

  update(clock: number) {
    for (let i = 0; i < this.list.length; i++) {
      const w = this.list[i];
      const s = windStrength(clock, w.def.phase ?? 0);
      this.str[i] = s;
      const on = s > 0.15;
      if (on !== w.on) {
        w.on = on;
        if (on) w.em.start();
        else w.em.stop();
      }
    }
  }

  /** Sideways push (px/s) at the hero's centre right now. */
  push(x: number, cy: number) {
    let v = 0;
    for (let i = 0; i < this.list.length; i++) {
      const d = this.list[i].def;
      if (x < d.x0 || x > d.x1 || cy < d.y0 - 60 || cy > d.y1) continue;
      v += Math.max(-WIND_MAX, Math.min(WIND_MAX, d.push)) * this.str[i];
    }
    return v;
  }

  strength(i: number) {
    return this.str[i] ?? 0;
  }
}
