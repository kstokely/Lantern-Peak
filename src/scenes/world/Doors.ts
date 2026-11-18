// Doorways between a camp's Trail and its side areas, with tool gates (design.md v2):
// high = Spring Hooves (doorway sits on a high ledge), ice = Ice Chisel (tap to crack it open),
// dark = Glow Lantern (the area beyond is dark). Locked doorways show a padlock and the tool needed.
import Phaser from 'phaser';
import { TEX2, ToolId, toolKey } from '../../art/keys';
import { session } from '../../core/session';
import type { LineId } from '../../core/lines';
import type { DoorDef, Gate } from '../zones';

export interface Door {
  def: DoorDef;
  sprite: Phaser.GameObjects.Sprite;
  badges: Phaser.GameObjects.GameObject[];
  /** The ice wall on this doorway has been broken (or there is none). */
  iceGone: boolean;
}

export type DoorVerdict =
  | { kind: 'enter' }
  | { kind: 'break' } // has the chisel: crack the ice
  | { kind: 'blocked'; tool: ToolId; line: LineId };

const GATE_TOOL: Record<Gate, ToolId> = { high: 'springHooves', ice: 'iceChisel', dark: 'glowLantern' };
const GATE_LINE: Record<Gate, LineId> = { high: 'v_need_hooves', ice: 'v_need_chisel', dark: 'v_need_lantern' };
const DOOR_SCALE = 0.95;

export class DoorSet {
  readonly list: Door[] = [];

  constructor(private scene: Phaser.Scene, private zone: number) {}

  add(def: DoorDef): Door {
    const iceGone = !def.gates.includes('ice') || session.p.zones[this.zone].iceBroken[def.to] === true;
    const s = this.scene.add.sprite(def.x, def.y + 6, TEX2.doorOpen, 0).setOrigin(0.5, 1).setDepth(1.5).setScale(DOOR_SCALE);
    s.setInteractive({ useHandCursor: true });
    const d: Door = { def, sprite: s, badges: [], iceGone };
    this.list.push(d);
    this.refresh(d);
    return d;
  }

  private texture(d: Door) {
    const g = d.def.gates;
    if (g.includes('ice') && !d.iceGone) return TEX2.doorIce;
    if (g.includes('dark')) return TEX2.doorDark;
    if (g.includes('high')) return TEX2.doorHigh;
    return TEX2.doorOpen;
  }

  /** Gates still waiting for a tool the player does not own. */
  private missing(d: Door): Gate[] {
    return d.def.gates.filter((g) => (g === 'ice' ? !d.iceGone && !session.has('iceChisel') : !session.has(GATE_TOOL[g])));
  }

  /** Redraws texture and lock badges (after buying tools or breaking ice). */
  refresh(d: Door) {
    d.sprite.setTexture(this.texture(d), 0);
    d.badges.forEach((b) => b.destroy());
    d.badges = [];
    const miss = this.missing(d);
    if (!miss.length) return;
    const top = d.def.y - 300 * DOOR_SCALE + 6;
    const n = miss.length;
    const x0 = d.def.x - ((n - 1) * 96) / 2 - 36;
    miss.forEach((g, i) => {
      const x = x0 + i * 96;
      const disc = this.scene.add.circle(x, top + 70, 50, 0xfff8ea, 1).setStrokeStyle(5, 0x1d1a3a).setDepth(1.6);
      const ic = this.scene.add.image(x, top + 70, toolKey(GATE_TOOL[g])).setDisplaySize(80, 80).setDepth(1.7);
      d.badges.push(disc, ic);
    });
    const lock = this.scene.add.image(x0 + (n - 1) * 96 + 78, top + 96, TEX2.lockBadge).setDisplaySize(84, 84).setDepth(1.8);
    d.badges.push(lock);
    this.scene.tweens.add({ targets: lock, angle: { from: -8, to: 8 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  refreshAll() {
    this.list.forEach((d) => this.refresh(d));
  }

  verdict(d: Door): DoorVerdict {
    const g = d.def.gates;
    if (g.includes('ice') && !d.iceGone) {
      return session.has('iceChisel') ? { kind: 'break' } : { kind: 'blocked', tool: 'iceChisel', line: GATE_LINE.ice };
    }
    for (const gate of ['dark', 'high'] as Gate[]) {
      if (g.includes(gate) && !session.has(GATE_TOOL[gate])) return { kind: 'blocked', tool: GATE_TOOL[gate], line: GATE_LINE[gate] };
    }
    return { kind: 'enter' };
  }

  /** Crack animation, then the ice wall is gone for good. */
  breakIce(d: Door, done: () => void) {
    const s = d.sprite;
    s.setTexture(TEX2.doorIce, Math.min(1, s.texture.frameTotal - 2));
    const x0 = s.x;
    this.scene.tweens.add({ targets: s, x: { from: x0 - 8, to: x0 + 8 }, duration: 60, yoyo: true, repeat: 4, onComplete: () => (s.x = x0) });
    const shards = this.scene.add.particles(d.def.x, d.def.y - 150, 'p-star', {
      speed: { min: 200, max: 480 },
      angle: { min: 180, max: 360 },
      gravityY: 900,
      scale: { start: 1.1, end: 0.2 },
      lifespan: 900,
      tint: [0xd6fbff, 0x8fe6f2, 0xfff8ea],
      emitting: false,
    });
    shards.setDepth(40);
    this.scene.time.delayedCall(420, () => {
      shards.explode(28);
      d.iceGone = true;
      session.breakIce(this.zone, d.def.to);
      this.refresh(d);
      s.setAlpha(0.2);
      this.scene.tweens.add({ targets: s, alpha: 1, duration: 300 });
      done();
    });
    this.scene.time.delayedCall(1600, () => shards.destroy());
  }

  find(to: number) {
    return this.list.find((d) => d.def.to === to);
  }
}
