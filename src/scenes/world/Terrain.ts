// Static terrain of an area: the ground (with gaps and pit mist), solid rock blocks (terraces, steps, walls),
// ice strips, arrow signs and the ground tile per ground segment. Also answers "what can I stand on here?" for
// tap-to-walk planning and shadows.
import Phaser from 'phaser';
import { TEX4 } from '../../art/keys';
import { AreaLayout, GROUND_TILE_Y, GROUND_Y, WORLD_BOTTOM } from '../zones';
import { geometry, Box } from './reach';
import { HALF } from './pieceLogic';

export interface StaticSurface {
  x0: number;
  x1: number;
  y: number;
  kind: 'ground' | 'rock' | 'ledge';
}

export class Terrain {
  readonly solids: Phaser.GameObjects.Zone[] = [];
  readonly boxes: Box[];
  /** Standable static surfaces (ground segments, rock tops, one-way ledges). */
  readonly surfaces: StaticSurface[] = [];
  readonly ice: { x0: number; x1: number; y: number }[];

  constructor(private scene: Phaser.Scene, private L: AreaLayout, groundKey: string, groundTint: number | null) {
    const geo = geometry(L);
    this.boxes = geo.solids;
    for (const s of geo.surfaces) {
      if (s.kind === 'ground' || s.kind === 'rock' || s.kind === 'ledge') this.surfaces.push({ x0: s.x0, x1: s.x1, y: s.y, kind: s.kind });
    }
    this.ice = L.pieces.ice ?? [];
    // physics: one static zone per solid box (ground segments and rock)
    for (const b of this.boxes) {
      const bottom = Math.min(b.y1, WORLD_BOTTOM + 200);
      const z = scene.add.zone((b.x0 + b.x1) / 2, (b.y0 + bottom) / 2, b.x1 - b.x0, bottom - b.y0);
      scene.physics.add.existing(z, true);
      this.solids.push(z);
    }
    // ground tile per segment (continuous texture across gaps)
    for (const b of this.boxes) {
      if (b.y0 !== GROUND_Y || b.y1 < WORLD_BOTTOM) continue;
      if (!(L.pieces.blocks ?? []).every((k) => !(k.x0 === b.x0 && k.x1 === b.x1 && k.y === b.y0))) continue;
      const t = scene.add.tileSprite(b.x0, GROUND_TILE_Y, b.x1 - b.x0, 320, groundKey).setOrigin(0, 0).setDepth(0);
      t.tilePositionX = b.x0;
      if (groundTint !== null) t.setTint(groundTint);
    }
    // pits: a soft mist band at the bottom, and dark rock lips on both sides of the gap
    for (const [a, b] of L.pits) {
      scene.add.tileSprite(a - 20, WORLD_BOTTOM - 140, b - a + 40, 140, TEX4.pitMist).setOrigin(0, 0).setDepth(0.9).setAlpha(0.95);
      const g = scene.add.graphics().setDepth(0.85);
      // the gap reads as deep: a dusky shaft under the ground line, fading into the mist
      const steps = 8;
      for (let k = 0; k < steps; k++) {
        const y0 = GROUND_Y - 4 + ((WORLD_BOTTOM - GROUND_Y) * k) / steps;
        g.fillStyle(0x2a2560, 0.62 + 0.25 * (k / steps));
        g.fillRect(a, y0, b - a, (WORLD_BOTTOM - GROUND_Y) / steps + 1);
      }
      g.fillStyle(0x1d1a3a, 0.35);
      if (a > 0) g.fillRect(a - 6, GROUND_Y + 8, 6, WORLD_BOTTOM - GROUND_Y);
      if (b < L.width) g.fillRect(b, GROUND_Y + 8, 6, WORLD_BOTTOM - GROUND_Y);
    }
    // rock blocks: snow-capped top row, plain rock below
    for (const k of L.pieces.blocks ?? []) {
      const bottom = Math.min(k.bottom ?? WORLD_BOTTOM, WORLD_BOTTOM);
      const w = k.x1 - k.x0;
      const h = bottom - k.y;
      const capH = Math.min(160, h);
      const cap = scene.add.tileSprite(k.x0, k.y, w, capH, TEX4.rockBlock).setOrigin(0, 0).setDepth(0.8);
      cap.tilePositionX = k.x0 % 160;
      if (h > 160) {
        const body = scene.add.tileSprite(k.x0, k.y + 160, w, h - 160, TEX4.rockBody).setOrigin(0, 0).setDepth(0.8);
        body.tilePositionX = k.x0 % 160;
      }
      // a soft shadow under floating rocks
      if (k.bottom !== undefined && k.bottom < GROUND_Y) scene.add.ellipse((k.x0 + k.x1) / 2, k.bottom + 8, w * 0.8, 16, 0x1d1a3a, 0.18).setDepth(0.75);
    }
    for (const i of this.ice) {
      const t = scene.add.tileSprite(i.x0, i.y, i.x1 - i.x0, 40, TEX4.iceStrip).setOrigin(0, 0).setDepth(0.95);
      t.tilePositionX = i.x0 % 240;
    }
    for (const s of L.pieces.signs ?? []) {
      scene.add.sprite(s.x, s.y + 4, TEX4.arrowSign, s.dir).setOrigin(0.5, 1).setDepth(1.4).setScale(0.9);
    }
  }

  /** Static bodies the hero collides with on all sides. */
  bodies() {
    return this.solids;
  }

  /** True when the hero's feet at (x, feet) are on an ice strip. */
  onIce(x: number, feet: number) {
    for (const i of this.ice) if (x >= i.x0 - 10 && x <= i.x1 + 10 && Math.abs(feet - i.y) < 6) return true;
    return false;
  }

  /** The highest static surface at x at or below `feet` (within `slack` px horizontally), or null over a gap. */
  supportBelow(x: number, feet: number, slack = 0): number | null {
    let best: number | null = null;
    for (const s of this.surfaces) {
      if (x < s.x0 - slack || x > s.x1 + slack || s.y < feet - 4) continue;
      if (best === null || s.y < best) best = s.y;
    }
    return best;
  }

  /** Top of the solid rock / ground step directly ahead (its x range holds x, its top is above the feet), or null. */
  wallTopAt(x: number, feet: number): number | null {
    let best: number | null = null;
    for (const b of this.boxes) {
      // only rock that actually stands in the hero's way (a floating rock high above the head is not a wall)
      if (x < b.x0 || x > b.x1 || b.y0 >= feet - 4 || b.y1 <= feet - 118) continue;
      if (best === null || b.y0 < best) best = b.y0;
    }
    return best;
  }

  /** The surface a tap at (x, y) refers to: the nearest top at or just below the tap. */
  surfaceUnderTap(x: number, y: number) {
    let best: number | null = null;
    for (const s of this.surfaces) {
      const half = s.kind === 'ledge' ? 0 : 0;
      if (x < s.x0 - half || x > s.x1 + half || s.y < y - 50) continue;
      if (best === null || s.y < best) best = s.y;
    }
    return best ?? GROUND_Y;
  }

  /** Index of the one-way ledge whose top the feet are on, or -1. */
  ledgeAt(x: number, feet: number) {
    return this.L.ledges.findIndex((l) => Math.abs(x - l.x) <= HALF.ledge && Math.abs(feet - l.y) < 12);
  }
}
