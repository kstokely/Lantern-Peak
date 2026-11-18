// Flurries: shy snow-sprites that wander, dart away from Juniper, and can be befriended with the bell.
import Phaser from 'phaser';
import { flurryBobAnim, flurryKey } from '../../art/keys';
import { GROUND_Y } from '../zones';

export type FlurryState = 'wander' | 'dart' | 'listen' | 'friend';

export interface Flurry {
  kind: number;
  sprite: Phaser.GameObjects.Sprite;
  homeX: number;
  state: FlurryState;
  targetX: number;
  /** Friendly decoration (already befriended): never darts, not part of the bell search. */
  deco: boolean;
  /** Surface it roams on (GROUND_Y unless the layout says otherwise). */
  floor: number;
}

const SCALE = 1.1;
const WANDER_R = 220;
const SHY_DIST = 230;
const WANDER_SPEED = 70;

export class FlurryField {
  readonly list: Flurry[] = [];
  /** x ranges (doorways) a shy Flurry never walks or darts into. */
  avoid: [number, number][] = [];

  constructor(private scene: Phaser.Scene, private width: number) {}

  /** Moves x out of any avoided range (to the nearer edge). */
  private clearOf(x: number): number {
    for (const [a, b] of this.avoid) if (x > a && x < b) return x - a < b - x ? a : b;
    return x;
  }

  add(kind: number, x: number, deco: boolean, floor = GROUND_Y): Flurry {
    x = this.clearOf(x);
    const s = this.scene.add.sprite(x, floor + 2, flurryKey(kind), deco ? 3 : 0).setOrigin(0.5, 1).setScale(SCALE).setDepth(3.2);
    if (!deco && this.scene.anims.exists(flurryBobAnim(kind))) s.play(flurryBobAnim(kind));
    s.setInteractive({ useHandCursor: true });
    const f: Flurry = { kind, sprite: s, homeX: x, state: deco ? 'friend' : 'wander', targetX: x, deco, floor };
    if (deco) this.hopLoop(f);
    this.list.push(f);
    return f;
  }

  /** Friendly decorations hop happily in place now and then. */
  private hopLoop(f: Flurry) {
    this.scene.tweens.add({
      targets: f.sprite,
      y: f.floor - 40,
      duration: 260,
      yoyo: true,
      ease: 'Sine.easeOut',
      repeat: -1,
      repeatDelay: 1400 + Math.random() * 1600,
      delay: Math.random() * 1500,
    });
  }

  update(dt: number, heroX: number, heroFeet: number, time: number) {
    for (const f of this.list) {
      if (f.state === 'wander') {
        const near = Math.abs(heroX - f.sprite.x) < SHY_DIST && Math.abs(heroFeet - f.floor) < 260;
        if (near) {
          this.dart(f, heroX);
          continue;
        }
        if (Math.abs(f.targetX - f.sprite.x) < 6) f.targetX = this.clearOf(Phaser.Math.Clamp(f.homeX + (Math.random() * 2 - 1) * WANDER_R, 80, this.width - 80));
        const dir = Math.sign(f.targetX - f.sprite.x);
        f.sprite.x = this.clearOf(f.sprite.x + dir * WANDER_SPEED * (dt / 1000));
        f.sprite.setFlipX(dir < 0);
        f.sprite.y = f.floor + 2 - Math.abs(Math.sin(time / 260 + f.kind)) * 14;
      }
    }
  }

  private dart(f: Flurry, heroX: number) {
    f.state = 'dart';
    f.sprite.anims.stop();
    f.sprite.setFrame(2);
    const away = f.sprite.x >= heroX ? 1 : -1;
    let tx = f.sprite.x + away * 340;
    // never leave its home patch or the area; if cornered, hop over Juniper's head instead
    const lo = Math.max(80, f.homeX - WANDER_R - 160);
    const hi = Math.min(this.width - 80, f.homeX + WANDER_R + 160);
    if (tx < lo || tx > hi) tx = f.sprite.x - away * 420;
    tx = this.clearOf(Phaser.Math.Clamp(tx, lo, hi));
    f.sprite.setFlipX(tx < f.sprite.x);
    f.targetX = tx;
    const x0 = f.sprite.x;
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 520,
      onUpdate: (tw) => {
        if (f.state !== 'dart') return;
        const t = tw.getValue() ?? 0;
        f.sprite.x = x0 + (tx - x0) * t;
        f.sprite.y = f.floor + 2 - Math.sin(Math.PI * t) * 90;
      },
      onComplete: () => {
        f.sprite.y = f.floor + 2;
        if (f.state !== 'dart') return;
        this.scene.time.delayedCall(500, () => this.resume(f));
      },
    });
  }

  private resume(f: Flurry) {
    if (f.state !== 'dart' && f.state !== 'listen') return;
    f.state = 'wander';
    f.targetX = f.sprite.x;
    if (this.scene.anims.exists(flurryBobAnim(f.kind))) f.sprite.play(flurryBobAnim(f.kind));
    else f.sprite.setFrame(0);
  }

  /** Nearest wandering (not yet befriended) Flurry within `range` of x, or null. */
  nearest(x: number, range: number): Flurry | null {
    let best: Flurry | null = null;
    let bd = range;
    for (const f of this.list) {
      if (f.deco || f.state === 'friend') continue;
      const d = Math.abs(f.sprite.x - x);
      if (d <= bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  /** The bell rang: the Flurry stops and listens. */
  listen(f: Flurry) {
    f.state = 'listen';
    this.scene.tweens.killTweensOf(f.sprite);
    f.sprite.anims.stop();
    f.sprite.setFrame(0).setY(f.floor + 2);
    this.scene.tweens.add({ targets: f.sprite, scaleY: SCALE * 1.12, duration: 160, yoyo: true, repeat: 2 });
  }

  /** The riddle was not solved (or skipped): it scampers off, it can be asked again later. */
  shy(f: Flurry, heroX: number) {
    f.state = 'wander';
    this.dart(f, heroX);
  }

  /** Befriended: happy frame and a hop over to Juniper, then it plays nearby. */
  befriend(f: Flurry, heroX: number, onArrive: () => void) {
    f.state = 'friend';
    f.deco = true;
    this.scene.tweens.killTweensOf(f.sprite);
    f.sprite.anims.stop();
    f.sprite.setFrame(3);
    const x0 = f.sprite.x;
    const tx = heroX + (x0 < heroX ? -110 : 110);
    f.sprite.setFlipX(tx < x0);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 700,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        f.sprite.x = x0 + (tx - x0) * t;
        f.sprite.y = f.floor + 2 - Math.sin(Math.PI * t) * 160;
      },
      onComplete: () => {
        f.sprite.y = f.floor + 2;
        onArrive();
        this.hopLoop(f);
      },
    });
  }

  find(kind: number) {
    return this.list.find((f) => f.kind === kind);
  }
}
