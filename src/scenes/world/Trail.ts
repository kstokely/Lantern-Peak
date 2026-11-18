// Companions that trail behind the hero: the chosen Flurry follower and, when the hero is not Juniper,
// Juniper herself as the guide. They are purely cosmetic (no physics, no input) and follow by position history:
// each stands a fixed distance back along the path the hero actually walked, so it traces that path (and hops
// where the hero hopped) with a delay.
import Phaser from 'phaser';
import { ANIM, flurryBobAnim, flurryKey, juniperAnim } from '../../art/keys';
import { GROUND_Y } from '../zones';

interface Pt {
  x: number;
  y: number;
  d: number;
  /** The hero stood on something here (not mid-jump). */
  g: boolean;
  /** Id of the moving piece the hero rode here (-1 = none): carry() moves these points with it. */
  p: number;
}

const MIN_STEP = 3;
const KEEP = 1400;
export const GUIDE_GAP = 165;
const FLURRY_GAP_WITH_GUIDE = 290;
const FLURRY_GAP = 130;
const HEART_TEX = 'lp-follow-heart';

/** Little heart marker texture (made on demand; not part of the art contract). */
export function heartTexture(scene: Phaser.Scene): string {
  if (!scene.textures.exists(HEART_TEX)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x1d1a3a, 1).fillCircle(11, 11, 10).fillCircle(25, 11, 10).fillTriangle(1, 14, 35, 14, 18, 34);
    g.fillStyle(0xff6f9a, 1).fillCircle(11, 11, 7).fillCircle(25, 11, 7).fillTriangle(4, 14, 32, 14, 18, 30);
    g.fillStyle(0xffffff, 0.8).fillCircle(8, 8, 2.5);
    g.generateTexture(HEART_TEX, 36, 36);
    g.destroy();
  }
  return HEART_TEX;
}

export class Trail {
  private path: Pt[] = [];
  private cur = { x: 0, y: 0 };
  flurry: Phaser.GameObjects.Sprite | null = null;
  flurryKind = -1;
  private heart: Phaser.GameObjects.Image | null = null;
  guide: Phaser.GameObjects.Sprite | null = null;
  private fFace = 1;
  private gFace = 1;
  private hop = 0;
  private happyUntil = 0;
  private gPrev = { x: 0, y: 0 };
  private gAnim = '';
  private moving = 0;

  constructor(private scene: Phaser.Scene, private scarf: number, private ground = GROUND_Y) {}

  /** Seeds the history behind the hero's start point so companions start beside, not on top of, the hero. */
  reset(x: number, feet: number) {
    this.path = [];
    this.fPos = this.gPos = null;
    this.cur = { x, y: feet };
    const n = 12;
    for (let i = n; i >= 0; i--) this.path.push({ x: Math.max(30, x - i * 30), y: feet, d: 0, g: true, p: -1 });
    this.rebuildD();
    this.seedDir = -1;
  }

  /** Companions start on the side the hero is not walking towards. */
  private seedDir = 0;

  private reseed(dir: number, x: number) {
    const y = this.path[this.path.length - 1].y;
    this.path = [];
    for (let i = 12; i >= 0; i--) this.path.push({ x: Math.max(30, x + dir * i * 30), y, d: 0, g: true, p: -1 });
    this.path.push({ x, y, d: 0, g: true, p: -1 });
    this.rebuildD();
    this.fPos = this.gPos = null;
  }

  private rebuildD() {
    let d = 0;
    this.path.forEach((p, i) => {
      if (i > 0) d += Math.hypot(p.x - this.path[i - 1].x, p.y - this.path[i - 1].y);
      p.d = d;
    });
  }

  get headD() {
    const last = this.path[this.path.length - 1];
    return last.d + Math.hypot(this.cur.x - last.x, this.cur.y - last.y);
  }

  /**
   * The hero rides moving piece `id`, which moved by (dx, dy) this frame: the stretch of path walked on that piece
   * moves with it, so a companion standing on the lift rides along instead of being left in mid-air.
   */
  carry(id: number, dx: number, dy: number) {
    if (dx === 0 && dy === 0) return;
    let any = false;
    for (let i = 0; i < this.path.length; i++) {
      const q = this.path[i];
      if (q.p !== id) continue;
      q.x += dx;
      q.y += dy;
      any = true;
    }
    if (this.fPos && this.fOn === id) {
      this.fPos.x += dx;
      this.fPos.y += dy;
    }
    if (this.gPos && this.gOn === id) {
      this.gPos.x += dx;
      this.gPos.y += dy;
    }
    this.cur = { x: this.cur.x + dx, y: this.cur.y + dy };
    if (any) this.rebuildD();
  }

  /** Piece id under each companion's path point (for carry()). */
  private fOn = -1;
  private gOn = -1;

  private pieceAt(back: number) {
    const target = this.headD - back;
    const p = this.path;
    let i = p.length - 1;
    while (i > 0 && p[i - 1].d > target) i--;
    return p[i].p;
  }

  private plat = -1;

  private record(x: number, y: number, grounded: boolean) {
    const prevX = this.cur.x;
    this.cur = { x, y };
    const last = this.path[this.path.length - 1];
    const step = Math.hypot(x - last.x, y - last.y);
    if (this.seedDir !== 0 && Math.abs(x - prevX) > 1) {
      if (Math.sign(x - prevX) === this.seedDir) {
        this.seedDir = 0;
        this.reseed(1, prevX);
        return;
      }
      this.seedDir = 0;
    }
    if (step >= MIN_STEP) {
      this.path.push({ x, y, d: last.d + step, g: grounded, p: this.plat });
      this.moving = 6;
      if (this.path[this.path.length - 1].d - this.path[0].d > KEEP * 1.5) {
        const cut = this.path[this.path.length - 1].d - KEEP;
        let i = 0;
        while (i < this.path.length - 2 && this.path[i + 1].d < cut) i++;
        this.path.splice(0, i);
      }
    }
  }

  /** When the hero has stood still a while, a companion left mid-air by the path settles on the last grounded point before it. */
  private settle(back: number): { x: number; y: number } | null {
    const target = this.headD - back;
    const p = this.path;
    let i = p.length - 1;
    while (i > 0 && p[i - 1].d > target) i--;
    if (p[i].g) return null;
    for (let j = i; j >= 0; j--) if (p[j].g) return { x: p[j].x, y: p[j].y };
    return { x: p[0].x, y: p[0].y };
  }

  /** Point `back` px behind the hero along the walked path (clamped to the start of the history). */
  private at(back: number): { x: number; y: number } {
    const target = this.headD - back;
    const p = this.path;
    if (target <= p[0].d) return { x: p[0].x, y: p[0].y };
    const lastD = p[p.length - 1].d;
    if (target >= lastD) {
      const span = this.headD - lastD;
      const t = span > 0 ? (target - lastD) / span : 1;
      const last = p[p.length - 1];
      return { x: last.x + (this.cur.x - last.x) * t, y: last.y + (this.cur.y - last.y) * t };
    }
    let i = p.length - 1;
    while (i > 0 && p[i - 1].d > target) i--;
    const a = p[i - 1];
    const b = p[i];
    const t = b.d > a.d ? (target - a.d) / (b.d - a.d) : 1;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  /** (Re)builds the companions: a Flurry kind (-1 none) and whether Juniper trots along as the guide. */
  setup(kind: number, withGuide: boolean, heroX: number, feet: number, guideTexture: string) {
    this.flurry?.destroy();
    this.heart?.destroy();
    this.guide?.destroy();
    this.flurry = this.heart = this.guide = null;
    this.fPos = this.gPos = null;
    this.flurryKind = -1;
    if (this.path.length === 0) this.reset(heroX, feet);
    if (withGuide) {
      this.guide = this.scene.add.sprite(heroX - GUIDE_GAP, feet, guideTexture, 0).setOrigin(0.5, 1).setScale(0.85).setDepth(4.9);
      this.gAnim = '';
      const p = this.at(GUIDE_GAP);
      this.gPrev = p;
      this.guide.setPosition(p.x, p.y + 4);
    }
    if (kind >= 0) {
      this.flurryKind = kind;
      this.flurry = this.scene.add.sprite(heroX - FLURRY_GAP, feet, flurryKey(kind), 0).setOrigin(0.5, 1).setScale(1.0).setDepth(4.8);
      if (this.scene.anims.exists(flurryBobAnim(kind))) this.flurry.play(flurryBobAnim(kind));
      this.heart = this.scene.add.image(0, 0, heartTexture(this.scene)).setDepth(4.85).setScale(0.55);
      this.scene.tweens.add({ targets: this.heart, scale: 0.7, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /** The follower does its happy pose and a little hop (present opened, frost gem found, camp lit). */
  celebrate(now: number) {
    if (!this.flurry) return;
    this.happyUntil = now + 1100;
    this.flurry.anims.stop();
    this.flurry.setFrame(3);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 520,
      onUpdate: (tw) => (this.hop = Math.sin(Math.PI * (tw.getValue() ?? 0)) * 70),
      onComplete: () => (this.hop = 0),
    });
  }

  /** World position of Juniper the guide (for her speech bubble), or null. */
  guidePos() {
    return this.guide ? { x: this.guide.x, y: this.guide.y } : null;
  }

  private still = 0;
  private lastNow = 0;
  private fPos: { x: number; y: number } | null = null;
  private gPos: { x: number; y: number } | null = null;

  /** Desired spot `back` px behind the hero; settles onto the ground once the hero has stopped. */
  private target(back: number) {
    const want = this.at(back);
    if (this.still > 350) {
      const s = this.settle(back);
      if (s) return s;
    }
    return want;
  }

  /** Moving piece the hero rides (top centre and half width): companions hop on and ride along beside the hero. */
  private ridePlat: { x: number; y: number; half: number } | null = null;
  private rideTmp = { x: 0, y: 0 };

  setRide(p: { x: number; y: number; half: number } | null) {
    this.ridePlat = p;
  }

  /** Spot on the ridden piece `back` px behind the hero (clamped to the piece), or null when not riding. */
  private onRide(back: number, heroX: number) {
    const r = this.ridePlat;
    if (!r) return null;
    const face = this.cur.x >= this.prevHeroX ? 1 : -1;
    const want = heroX - face * back;
    this.rideTmp.x = Math.max(r.x - r.half + 24, Math.min(r.x + r.half - 24, want));
    this.rideTmp.y = r.y;
    return this.rideTmp;
  }

  private prevHeroX = 0;

  update(x: number, feet: number, now: number, onFloor = true, plat = -1) {
    const dt = this.lastNow ? Math.min(100, now - this.lastNow) : 16;
    this.lastNow = now;
    this.plat = plat;
    if (Math.abs(x - this.cur.x) > 0.5) this.prevHeroX = this.cur.x;
    this.record(x, feet, onFloor);
    this.fOn = this.pieceAt(this.guide ? FLURRY_GAP_WITH_GUIDE : FLURRY_GAP);
    this.gOn = this.pieceAt(GUIDE_GAP);
    if (this.moving > 0) this.moving--;
    this.still = this.moving > 0 ? 0 : this.still + dt;
    // ease only while settling (hero standing still); otherwise sit exactly on the walked path
    const ease = this.still > 350 ? 1 - Math.exp(-dt / 90) : 1;
    const gap = this.guide ? FLURRY_GAP_WITH_GUIDE : FLURRY_GAP;
    if (this.guide) {
      const t = this.onRide(56, x) ?? this.target(GUIDE_GAP);
      const prev = this.gPos ?? t;
      const p = { x: prev.x + (t.x - prev.x) * ease, y: prev.y + (t.y - prev.y) * ease };
      this.gPos = p;
      const dx = p.x - this.gPrev.x;
      const dy = p.y - this.gPrev.y;
      if (Math.abs(dx) > 0.6) this.gFace = dx > 0 ? 1 : -1;
      else if (this.moving === 0 && Math.abs(this.cur.x - p.x) > 4) this.gFace = this.cur.x > p.x ? 1 : -1;
      this.guide.setPosition(Math.max(60, p.x), p.y + 4).setFlipX(this.gFace < 0);
      const airborne = p.y < this.ground - 6 && Math.abs(dy) > 0.5;
      let anim: string;
      if (airborne) anim = juniperAnim(dy < 0 ? ANIM.jumpUp : ANIM.jumpFall, this.scarf);
      else anim = juniperAnim(Math.abs(dx) > 0.6 ? ANIM.walk : ANIM.idle, this.scarf);
      if (anim !== this.gAnim) {
        this.gAnim = anim;
        this.guide.play(anim, true);
      }
      this.gPrev = p;
    }
    if (this.flurry) {
      const t = this.onRide(this.guide ? 112 : 62, x) ?? this.target(gap);
      const prev = this.fPos ?? t;
      const p = { x: prev.x + (t.x - prev.x) * ease, y: prev.y + (t.y - prev.y) * ease };
      this.fPos = p;
      const dx = p.x - this.flurry.x;
      if (Math.abs(dx) > 0.6) this.fFace = dx > 0 ? 1 : -1;
      const bob = this.moving > 0 && now >= this.happyUntil ? Math.abs(Math.sin(now / 150)) * 8 : 0;
      this.flurry.setPosition(Math.max(60, p.x), p.y + 2 - this.hop - bob).setFlipX(this.fFace < 0);
      if (this.happyUntil && now >= this.happyUntil) {
        this.happyUntil = 0;
        if (this.scene.anims.exists(flurryBobAnim(this.flurryKind))) this.flurry.play(flurryBobAnim(this.flurryKind));
        else this.flurry.setFrame(0);
      }
      this.heart?.setPosition(this.flurry.x, this.flurry.y - 100 * this.flurry.scaleY - 8);
    }
  }

  destroy() {
    this.flurry?.destroy();
    this.heart?.destroy();
    this.guide?.destroy();
    this.flurry = this.heart = this.guide = null;
  }
}
