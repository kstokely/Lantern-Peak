// One-way pieces that move or come and go: lifts (cloud / log), crumbling ledges, tick-tock brass platforms,
// gear platforms, pendulum platforms, aurora bridges and the helper cloud. They are not Arcade bodies: the World
// asks resolve() each frame (after the physics step) whether the hero lands on / rides one, and is carried by
// exactly the piece's own movement that frame, so there is no sliding off and no jitter.
// Pieces run on their own clock (paused with the scene) so a mini game never makes them jump ahead.
import Phaser from 'phaser';
import { ANIM4, TEX4 } from '../../art/keys';
import { audio } from '../../core/audio';
import { BODY_H, BODY_W } from '../../core/physics';
import type { AreaLayout } from '../zones';
import {
  Crumble, HALF, TickState, AuroraState, auroraState, gearAngle, liftFraction, pendulumAngle, tickState,
} from './pieceLogic';

export type SurfKind = 'lift' | 'crumble' | 'tick' | 'gear' | 'pendulum' | 'aurora' | 'helper';

export interface Surf {
  id: number;
  kind: SurfKind;
  /** Top centre of the walkable surface. */
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  half: number;
  solid: boolean;
  sprite: Phaser.GameObjects.Sprite;
  /** Piece-specific updater: sets x, y, solid and the sprite. */
  step: (t: number, s: Surf) => void;
  /** Hero stood on it this frame. */
  ridden: boolean;
}

const HW = BODY_W / 2;
const HELPER_SPEED = 190;

export class Movers {
  readonly list: Surf[] = [];
  clock = 0;
  private extras: { update: (t: number) => void }[] = [];
  private lastTickBeat = -1;
  private tickTmp: TickState = { solid: true, warn: false, t: 0, beat: 0 };
  private auroraTmp: AuroraState = { solid: true, warn: false, alpha: 1 };
  // helper cloud
  helper: Surf | null = null;
  private helperPath: { x: number; y: number }[] = [];
  private helperD = 0;
  private helperLen = 0;
  helperState: 'hidden' | 'wait' | 'carry' | 'arrived' | 'return' = 'hidden';
  private helperIdle = 0;
  /** Stretch (checkpoint index) the helper cloud serves. */
  helperStretch = -2;
  private cam: Phaser.Cameras.Scene2D.Camera;

  constructor(private scene: Phaser.Scene, L: AreaLayout) {
    this.cam = scene.cameras.main;
    const P = L.pieces;
    for (const l of P.lifts ?? []) {
      const key = l.kind === 'cloud' ? TEX4.platCloud : TEX4.platLog;
      const sp = scene.add.sprite(l.x, l.y, key, 0).setOrigin(0.5, 0).setDepth(1.25);
      if (l.kind === 'cloud' && scene.anims.exists(ANIM4.cloudBob)) sp.play({ key: ANIM4.cloudBob, startFrame: 0 });
      let ropes: Phaser.GameObjects.Rectangle[] = [];
      if (l.kind === 'log') {
        // ropes from the log's bindings (texture x = 44 and 196) up out of sight
        ropes = [-76, 76].map(() => scene.add.rectangle(0, 0, 5, 900, 0x6b4a2a, 1).setOrigin(0.5, 1).setDepth(1.2));
      }
      this.add('lift', l.x, l.y, HALF[l.kind], sp, (t, s) => {
        const f = liftFraction(t, l.travel, l.pause, l.phase ?? 0);
        s.x = l.x + l.dx * f;
        s.y = l.y + l.dy * f;
        s.sprite.setPosition(s.x, s.y);
        for (let i = 0; i < ropes.length; i++) ropes[i].setPosition(s.x + (i === 0 ? -76 : 76), s.y + 14);
      });
    }
    for (const c of P.crumbles ?? []) {
      const cr = new Crumble();
      const sp = scene.add.sprite(c.x, c.y, TEX4.platCrumble, 0).setOrigin(0.5, 0).setDepth(1.25);
      let shown = 'solid';
      this.add('crumble', c.x, c.y, HALF.crumble, sp, (t, s) => {
        if (s.ridden) cr.stand(t);
        if (cr.update(t)) {
          if (cr.phase === 'gone') audio.sfx('crumble');
        }
        s.solid = cr.solid;
        if (cr.phase !== shown) {
          shown = cr.phase;
          this.scene.tweens.killTweensOf(s.sprite);
          if (cr.phase === 'gone') {
            s.sprite.setFrame(3);
            this.scene.tweens.add({ targets: s.sprite, y: c.y + 160, alpha: 0, duration: 500, ease: 'Quad.easeIn' });
          } else if (cr.phase === 'solid') {
            s.sprite.setFrame(0).setPosition(c.x, c.y).setAlpha(0).setScale(0.6);
            this.scene.tweens.add({ targets: s.sprite, alpha: 1, scale: 1, duration: 380, ease: 'Back.easeOut' });
          }
        }
        if (cr.phase === 'cracking') {
          s.sprite.setFrame(cr.frame(t));
          s.sprite.x = c.x + Math.sin(t / 30) * 2;
        }
      });
    }
    for (const k of P.ticks ?? []) {
      const sp = scene.add.sprite(k.x, k.y, TEX4.platBrass, 0).setOrigin(0.5, 0).setDepth(1.25);
      const tint = k.group === 0 ? 0xffffff : 0xffe2b0;
      sp.setTint(tint);
      this.add('tick', k.x, k.y, HALF.brass, sp, (t, s) => {
        const st = tickState(k.group, t, this.tickTmp);
        s.solid = st.solid;
        s.sprite.setFrame(st.solid ? 0 : 1);
        s.sprite.setAlpha(!st.solid ? 0.55 : st.warn ? (Math.floor(t / 110) % 2 ? 0.45 : 1) : 1);
      });
    }
    for (const g of P.gears ?? []) {
      const gear = scene.add.image(g.x, g.y, TEX4.gear).setDepth(1.05).setScale(Math.min(1.25, (g.r * 1.1) / 120));
      const arms = Array.from({ length: g.n }, () => scene.add.rectangle(g.x, g.y, g.r, 10, 0x8a5530, 1).setOrigin(0, 0.5).setDepth(1.1).setStrokeStyle(3, 0x1d1a3a));
      this.extras.push({ update: (t) => gear.setRotation(gearAngle(t, g.period, g.dir, 0, 1) + (g.phase ?? 0)) });
      for (let i = 0; i < g.n; i++) {
        const sp = scene.add.sprite(g.x, g.y, TEX4.platBrass, 0).setOrigin(0.5, 0).setDepth(1.25);
        this.add('gear', g.x, g.y, HALF.brass, sp, (t, s) => {
          const a = gearAngle(t, g.period, g.dir, i, g.n) + (g.phase ?? 0);
          s.x = g.x + g.r * Math.cos(a);
          s.y = g.y + g.r * Math.sin(a);
          s.sprite.setPosition(s.x, s.y);
          arms[i].setRotation(a);
        });
      }
    }
    for (const p of P.pendulums ?? []) {
      const rod = scene.add.image(p.x, p.y, TEX4.pendulumRod).setOrigin(0.5, 0.03).setDepth(1.1);
      rod.setScale(1, p.len / (420 * 0.95));
      const sp = scene.add.sprite(p.x, p.y + p.len, TEX4.platBrass, 0).setOrigin(0.5, 0).setDepth(1.25);
      this.add('pendulum', p.x, p.y + p.len, HALF.brass, sp, (t, s) => {
        const th = pendulumAngle(t, p.amp, p.period, p.phase ?? 0);
        s.x = p.x + p.len * Math.sin(th);
        s.y = p.y + p.len * Math.cos(th);
        s.sprite.setPosition(s.x, s.y);
        rod.setRotation(-th);
      });
    }
    for (const a of P.auroras ?? []) {
      const sp = scene.add.sprite(a.x, a.y, TEX4.platAurora, 0).setOrigin(0.5, 0).setDepth(1.25).setBlendMode(Phaser.BlendModes.NORMAL);
      if (scene.anims.exists(ANIM4.auroraShimmer)) sp.play({ key: ANIM4.auroraShimmer, startFrame: Math.floor(a.x / 97) % 4 });
      this.add('aurora', a.x, a.y, HALF.aurora, sp, (t, s) => {
        const st = auroraState(t, a.phase ?? 0, this.auroraTmp);
        s.solid = st.solid;
        s.sprite.setAlpha(st.alpha);
      });
    }
    // the helper cloud (hidden until a stretch has seen 3 falls)
    const hs = scene.add.sprite(0, 0, TEX4.helperCloud, 0).setOrigin(0.5, 30 / 120).setDepth(1.3).setVisible(false);
    this.helper = this.add('helper', -9999, -9999, HALF.helper, hs, (t, s) => {
      s.sprite.setFrame(Math.floor(t / 2600) % 7 === 6 ? 1 : 0);
    });
    this.helper.solid = false;
    this.update(0);
    for (const s of this.list) {
      s.prevX = s.x;
      s.prevY = s.y;
    }
  }

  private add(kind: SurfKind, x: number, y: number, half: number, sprite: Phaser.GameObjects.Sprite, step: Surf['step']): Surf {
    const s: Surf = { id: this.list.length, kind, x, y, prevX: x, prevY: y, half, solid: true, sprite, step, ridden: false };
    this.list.push(s);
    return s;
  }

  /** Advances every piece by dt ms (the World calls this once per frame before resolve()). */
  update(dt: number) {
    this.clock += Math.min(dt, 50);
    const t = this.clock;
    for (let i = 0; i < this.list.length; i++) {
      const s = this.list[i];
      s.prevX = s.x;
      s.prevY = s.y;
      if (s.kind === 'helper') this.stepHelper(dt, s);
      s.step(t, s);
      // pieces far off screen sleep visually (their motion stays exact: it is a function of the clock)
      const cx = this.cam.scrollX + 640;
      const cy = this.cam.scrollY + 480;
      const vis = Math.abs(s.x - cx) < 1500 && Math.abs(s.y - cy) < 1200;
      if (s.kind !== 'helper' && s.sprite.visible !== vis) s.sprite.setVisible(vis);
      s.ridden = false;
    }
    for (let i = 0; i < this.extras.length; i++) this.extras[i].update(t);
    // soft tick on every tick-tock beat (only when such platforms exist and are near)
    const beat = Math.floor(t / 1600);
    if (beat !== this.lastTickBeat) {
      this.lastTickBeat = beat;
      for (let i = 0; i < this.list.length; i++) {
        const s = this.list[i];
        if (s.kind === 'tick' && s.sprite.visible) {
          audio.sfx('tick');
          break;
        }
      }
    }
  }

  /**
   * Called after the physics step. Keeps the hero on the piece it rides (carried by the piece's movement this
   * frame), or lands it on a piece it fell onto. Returns the piece stood on, or null.
   */
  resolve(b: Phaser.Physics.Arcade.Body, prevBottom: number, riding: Surf | null, ignore: Surf | null): Surf | null {
    const x = b.center.x;
    if (riding && riding.solid && riding !== ignore && b.velocity.y >= -5 && Math.abs(x - riding.x) <= riding.half + HW - 4) {
      b.position.x += riding.x - riding.prevX;
      b.position.y = riding.y - b.height;
      b.velocity.y = 0;
      riding.ridden = true;
      return riding;
    }
    if (b.velocity.y < 0) return null;
    let best: Surf | null = null;
    for (let i = 0; i < this.list.length; i++) {
      const s = this.list[i];
      if (!s.solid || s === ignore) continue;
      if (Math.abs(x - s.x) > s.half + HW - 6) continue;
      if (prevBottom > s.prevY + 10 || b.bottom < s.y - 0.5) continue;
      if (!best || s.y < best.y) best = s;
    }
    if (best) {
      b.position.y = best.y - b.height;
      b.velocity.y = 0;
      best.ridden = true;
    }
    return best;
  }

  /** The top of the moving / timed surface under x at or below feet (for the shadow), or null. */
  surfaceBelow(x: number, feet: number): number | null {
    let best: number | null = null;
    for (const s of this.list) {
      if (!s.solid || Math.abs(x - s.x) > s.half || s.y < feet - 4) continue;
      if (best === null || s.y < best) best = s.y;
    }
    return best;
  }

  // ---------- helper cloud ----------

  /** Shows the helper cloud at the start of a ferry path (top-surface points) for stretch `stretch`. */
  showHelper(path: { x: number; y: number }[], stretch: number) {
    const h = this.helper!;
    this.helperPath = path;
    this.helperLen = 0;
    for (let i = 1; i < path.length; i++) this.helperLen += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    this.helperD = 0;
    this.helperState = 'wait';
    this.helperStretch = stretch;
    h.x = h.prevX = path[0].x;
    h.y = h.prevY = path[0].y;
    h.solid = true;
    h.sprite.setPosition(h.x, h.y).setVisible(true).setAlpha(0).setScale(0.5);
    this.scene.tweens.add({ targets: h.sprite, alpha: 1, scale: 1, duration: 500, ease: 'Back.easeOut' });
  }

  hideHelper() {
    const h = this.helper!;
    if (this.helperState === 'hidden') return;
    this.helperState = 'hidden';
    this.helperStretch = -2;
    h.solid = false;
    this.scene.tweens.add({ targets: h.sprite, alpha: 0, duration: 400, onComplete: () => h.sprite.setVisible(false) });
  }

  private pointAt(d: number, out: { x: number; y: number }) {
    const p = this.helperPath;
    let rest = d;
    for (let i = 1; i < p.length; i++) {
      const seg = Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
      if (rest <= seg || i === p.length - 1) {
        const k = seg > 0 ? Math.min(1, rest / seg) : 1;
        out.x = p[i - 1].x + (p[i].x - p[i - 1].x) * k;
        out.y = p[i - 1].y + (p[i].y - p[i - 1].y) * k;
        return;
      }
      rest -= seg;
    }
    out.x = p[0].x;
    out.y = p[0].y;
  }

  private tmpPt = { x: 0, y: 0 };

  private stepHelper(dt: number, h: Surf) {
    if (this.helperState === 'hidden') return;
    const ridden = h.ridden;
    const v = HELPER_SPEED * (dt / 1000);
    if (this.helperState === 'wait') {
      if (ridden) {
        this.helperIdle += dt;
        if (this.helperIdle > 350) this.helperState = 'carry';
      } else this.helperIdle = 0;
    } else if (this.helperState === 'carry') {
      this.helperD = Math.min(this.helperLen, this.helperD + v);
      if (this.helperD >= this.helperLen) {
        this.helperState = 'arrived';
        this.helperIdle = 0;
      }
    } else if (this.helperState === 'arrived') {
      this.helperIdle = ridden ? 0 : this.helperIdle + dt;
      if (this.helperIdle > 1200) this.helperState = 'return';
    } else if (this.helperState === 'return') {
      this.helperD = Math.max(0, this.helperD - v * 1.5);
      if (this.helperD <= 0) {
        this.helperState = 'wait';
        this.helperIdle = 0;
      }
    }
    this.pointAt(this.helperD, this.tmpPt);
    h.x = this.tmpPt.x;
    h.y = this.tmpPt.y + Math.sin(this.clock / 400) * (this.helperState === 'wait' ? 3 : 0);
    h.sprite.setPosition(h.x, h.y);
  }

  /** Debug listing. */
  describe() {
    return this.list
      .filter((s) => s.kind !== 'helper' || this.helperState !== 'hidden')
      .map((s) => ({ id: s.id, kind: s.kind, x: Math.round(s.x), y: Math.round(s.y), solid: s.solid }));
  }
}

export const HERO_H = BODY_H;
