// HUD overlay for the World.
// Top "pack bar": home, gem purse, cocoa flasks, owned tools, bell button, mute.
// Bottom wood bar: move buttons, 6 lantern slots with the "4 lights the camp" marker, frost gems, hint, jump.
import Phaser from 'phaser';
import { TEX, TEX2, ToolId, toolKey } from '../art/keys';
import { GEMS_PER_ZONE, GAME_H, GAME_W, HUD_H, LANTERNS_TO_LIGHT, PRESENTS_PER_ZONE } from '../types';
import { session } from '../core/session';
import { audio } from '../core/audio';
import { controls } from '../core/controls';
import type { HeroId } from '../art/keys';
import { heroPortrait } from '../core/heroArt';
import { addPanel, addText, makeIconButton, makeMuteButton, starBurst, textStyle } from '../core/ui';

export const HUD_TOP = GAME_H - HUD_H; // 840
/** World taps above this line belong to the pack bar. */
export const PACK_BOTTOM = 140;
const BAR_Y = GAME_H - HUD_H / 2;
const PACK_Y = 80;
const SLOT_X0 = 322;
const SLOT_DX = 50;
/** Tools shown as pack icons (the Chime Bell is the bell button itself). */
const PACK_TOOLS: ToolId[] = ['springHooves', 'glowLantern', 'iceChisel', 'swiftScarf', 'gemMagnet', 'silverBell', 'trailMap', 'gripHooves', 'cloudBoots', 'featherCape'];

export class HudScene extends Phaser.Scene {
  private zone = 0;
  private area = 0;
  private lanternText!: Phaser.GameObjects.Text;
  private gemText!: Phaser.GameObjects.Text;
  private purseText!: Phaser.GameObjects.Text;
  private cocoaText!: Phaser.GameObjects.Text;
  private gemIcon!: Phaser.GameObjects.Image;
  private purseIcon!: Phaser.GameObjects.Image;
  private cocoaIcon!: Phaser.GameObjects.Image;
  private slots: Phaser.GameObjects.Image[] = [];
  private star!: Phaser.GameObjects.Image;
  private toolIcons: Phaser.GameObjects.Image[] = [];
  private toolSig = '';
  private bell: ReturnType<typeof makeIconButton> | null = null;
  private bubble: Phaser.GameObjects.Container | null = null;
  private bubbleTimer: Phaser.Time.TimerEvent | null = null;
  private anchor = { x: 640, y: 400 };
  /** Set by the World: called when the hint button is tapped. */
  onHint: (() => void) | null = null;
  /** Set by the World: called when the bell button is tapped. */
  onBell: (() => void) | null = null;

  constructor() {
    super('Hud');
  }

  init(data: { zone: number; area?: number }) {
    this.zone = data.zone ?? 0;
    this.area = data.area ?? 0;
    this.bubble = null;
    this.bubbleTimer = null;
    this.slots = [];
    this.toolIcons = [];
    this.toolSig = '';
    this.bell = null;
  }

  create() {
    controls.reset();
    // ---- bottom bar ----
    addPanel(this, GAME_W / 2, BAR_Y + 4, GAME_W + 40, HUD_H + 12);
    this.holdButton(90, BAR_Y, TEX.iconLeft, 'left');
    this.holdButton(225, BAR_Y, TEX.iconRight, 'right');
    this.holdButton(GAME_W - 95, BAR_Y, TEX.iconJump, 'jump');
    for (let i = 0; i < PRESENTS_PER_ZONE; i++) {
      const x = SLOT_X0 + i * SLOT_DX + (i >= LANTERNS_TO_LIGHT ? 16 : 0);
      this.slots.push(this.add.image(x, BAR_Y, TEX.lantern, 0).setDisplaySize(44, 59));
    }
    // marker after the 4th slot: 4 lanterns light the camp
    const mx = SLOT_X0 + (LANTERNS_TO_LIGHT - 0.5) * SLOT_DX + 8;
    const mk = this.add.graphics();
    mk.fillStyle(0x1d1a3a, 1).fillRoundedRect(mx - 5, BAR_Y - 44, 10, 88, 5);
    mk.fillStyle(0xffc93c, 1).fillRoundedRect(mx - 3, BAR_Y - 42, 6, 84, 3);
    this.lanternText = this.add.text(SLOT_X0 + (PRESENTS_PER_ZONE - 1) * SLOT_DX + 54, BAR_Y, '', textStyle(40)).setOrigin(0, 0.5);
    this.gemIcon = this.add.image(762, BAR_Y, TEX.iconGem).setDisplaySize(68, 68);
    this.gemText = this.add.text(800, BAR_Y, '', textStyle(40)).setOrigin(0, 0.5);
    this.star = this.add.image(940, BAR_Y, TEX2.starGold).setDisplaySize(80, 80).setVisible(false);
    makeIconButton(this, 1052, BAR_Y, TEX.iconHint, () => this.onHint?.(), 104);

    // ---- top pack bar ----
    const g = this.add.graphics();
    g.fillStyle(0x1d1a3a, 0.5).fillRoundedRect(146, 30, 860, 100, 30);
    makeIconButton(this, 80, 80, TEX.iconBack, () => this.goHome(), 104);
    this.purseIcon = this.add.image(200, PACK_Y, TEX2.purse).setDisplaySize(78, 78);
    this.purseText = this.add.text(244, PACK_Y, '', textStyle(48, { color: '#fff1a8' })).setOrigin(0, 0.5);
    this.cocoaIcon = this.add.image(410, PACK_Y, toolKey('cocoa')).setDisplaySize(66, 66);
    this.cocoaText = this.add.text(446, PACK_Y, '', textStyle(40)).setOrigin(0, 0.5);
    makeMuteButton(this);

    this.refresh(false);
    const unsub = session.onChange(() => this.refresh(true));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsub();
      controls.reset();
    });
  }

  /** All counters (pulse = little bounce when a number changed). */
  refresh(pulse = true) {
    if (!this.lanternText) return;
    const p = session.profile;
    const zp = p?.zones[this.zone];
    const lan = zp ? zp.presents.filter(Boolean).length : 0;
    const gems = zp ? zp.gems.filter(Boolean).length : 0;
    const lt = `${lan}/${PRESENTS_PER_ZONE}`;
    const gt = `${gems}/${GEMS_PER_ZONE}`;
    const pt = String(p?.purse ?? 0);
    const ct = `${p?.cocoa ?? 0}`;
    if (pulse && gt !== this.gemText.text) this.pop(this.gemIcon);
    if (pulse && pt !== this.purseText.text) this.pop(this.purseIcon);
    if (pulse && ct !== this.cocoaText.text) this.pop(this.cocoaIcon);
    this.slots.forEach((s, i) => {
      const lit = i < lan;
      if ((String(s.frame.name) === '1') !== lit) {
        s.setFrame(lit ? 1 : 0).setDisplaySize(44, 59);
        if (pulse && lit) this.pop(s);
      }
    });
    this.lanternText.setText(lt);
    this.gemText.setText(gt);
    this.purseText.setText(pt);
    this.cocoaText.setText(ct);
    this.cocoaIcon.setAlpha(p && p.cocoa > 0 ? 1 : 0.45);
    this.cocoaText.setAlpha(p && p.cocoa > 0 ? 1 : 0.6);
    this.star.setVisible(lan >= PRESENTS_PER_ZONE);
    this.syncTools();
  }

  /** Rebuilds the tool icons and the bell button when the owned tools change. */
  private syncTools() {
    const owned = PACK_TOOLS.filter((t) => session.has(t));
    const sig = owned.join(',') + (session.has('chimeBell') ? '+bell' : '');
    if (sig === this.toolSig) return;
    this.toolSig = sig;
    this.toolIcons.forEach((i) => i.destroy());
    // up to 10 tools: squeeze the spacing (and size) so they stay inside the pack bar (530..990)
    const step = owned.length > 7 ? Math.floor(460 / (owned.length - 1)) : 68;
    const size = Math.min(62, step - 4);
    this.toolIcons = owned.map((t, i) => this.add.image(530 + i * step, PACK_Y, toolKey(t)).setDisplaySize(size, size));
    if (session.has('chimeBell') && !this.bell) {
      this.bell = makeIconButton(this, 1068, PACK_Y, toolKey('chimeBell'), () => this.onBell?.(), 112);
      this.bell.root.setScale(0.3);
      this.tweens.add({ targets: this.bell.root, scale: 1, duration: 300, ease: 'Back.easeOut' });
    }
  }

  private pop(o: Phaser.GameObjects.Image) {
    this.tweens.killTweensOf(o);
    if (o.getData('baseScale') === undefined) o.setData('baseScale', [o.scaleX, o.scaleY]);
    const [s, sy] = o.getData('baseScale') as [number, number];
    o.setScale(s, sy);
    this.tweens.add({ targets: o, scaleX: s * 1.35, scaleY: sy * 1.35, duration: 140, yoyo: true, onComplete: () => o.setScale(s, sy) });
  }

  /** Screen position of a counter (for fly-in animations). */
  target(kind: 'gem' | 'lantern' | 'purse') {
    if (kind === 'purse') return { x: this.purseIcon.x, y: this.purseIcon.y };
    if (kind === 'gem') return { x: this.gemIcon.x, y: this.gemIcon.y };
    const n = session.profile?.zones[this.zone].presents.filter(Boolean).length ?? 1;
    const s = this.slots[Math.max(0, Math.min(this.slots.length - 1, n - 1))];
    return { x: s.x, y: s.y };
  }

  /** Flies an icon from a screen position into its counter, then refreshes. */
  flyIn(kind: 'gem' | 'lantern' | 'purse', sx: number, sy: number, texture: string, frame: number | undefined, size: number) {
    if (!this.purseIcon) return;
    const t = this.target(kind);
    const img = this.add.image(sx, sy, texture, frame).setDisplaySize(size, size * (kind === 'lantern' ? 4 / 3 : 1)).setDepth(50);
    const sc = img.scaleX;
    const scy = img.scaleY;
    this.tweens.add({
      targets: img,
      x: t.x,
      y: t.y,
      scaleX: sc * 0.6,
      scaleY: scy * 0.6,
      duration: kind === 'purse' ? 550 : 700,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        img.destroy();
        this.refresh(true);
      },
    });
  }

  /** Big celebratory toast (a hero was unlocked): panel, optional hero portrait, stars. */
  toast(text: string, hero?: HeroId) {
    const c = this.add.container(GAME_W / 2, 330).setDepth(70);
    const t = this.add.text(0, 0, text, textStyle(44, { color: '#1d1a3a', stroke: '#fff8ea', strokeThickness: 2, align: 'center', wordWrap: { width: 780 } })).setOrigin(0.5);
    const w = Math.max(900, t.width + 260);
    const h = Math.max(190, t.height + 80);
    const g = this.add.graphics();
    g.fillStyle(0x1d1a3a, 0.35).fillRoundedRect(-w / 2 + 6, -h / 2 + 10, w, h, 36);
    g.fillStyle(0xfff8ea, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 36);
    g.lineStyle(8, 0xffc93c, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 36);
    c.add([g, t]);
    t.x = 70;
    const portrait = hero ? heroPortrait(this, hero) : null;
    if (portrait) c.add(this.add.image(-w / 2 + 120, 0, portrait).setDisplaySize(150, 150));
    else c.add(this.add.image(-w / 2 + 120, 0, TEX.star).setTint(0xffc93c).setScale(3));
    c.setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, y: 290, delay: 4200, duration: 500, onComplete: () => c.destroy() });
    audio.sfx('camp');
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * 250, () => starBurst(this, GAME_W / 2 + (i - 1) * 260, 330, 0xffc93c, 71, 12));
  }

  /** Area name shown big for a moment on entering. */
  banner(text: string) {
    const t = addText(this, GAME_W / 2, 210, text, 56, { color: '#fff1a8' }).setDepth(30).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: 196, duration: 300 });
    this.tweens.add({ targets: t, alpha: 0, delay: 2400, duration: 500, onComplete: () => t.destroy() });
  }

  /** Juniper speech bubble near `anchor` (screen coords, updated by the World each frame). */
  say(text: string, voice?: string, ms = 3200) {
    ms = Math.max(ms, 1200 + text.length * 45);
    if (voice) audio.voice(voice);
    this.bubble?.destroy();
    this.bubbleTimer?.remove();
    const c = this.add.container(this.anchor.x, this.anchor.y).setDepth(40);
    const t = this.add.text(0, 0, text, textStyle(38, { color: '#1d1a3a', stroke: '#fff8ea', strokeThickness: 2, wordWrap: { width: text.length > 70 ? 700 : 520 } })).setOrigin(0.5, 1);
    const w = t.width + 50;
    const h = t.height + 30;
    const g = this.add.graphics();
    g.fillStyle(0xfff8ea, 1).fillRoundedRect(-w / 2, -h - 22, w, h, 26);
    g.lineStyle(5, 0x1d1a3a, 1).strokeRoundedRect(-w / 2, -h - 22, w, h, 26);
    const tail = this.add.graphics();
    tail.fillStyle(0xfff8ea, 1).fillTriangle(-18, -25, 18, -25, 0, 2);
    tail.lineStyle(5, 0x1d1a3a, 1).lineBetween(-18, -22, 0, 2).lineBetween(18, -22, 0, 2);
    t.y = -37;
    const box = this.add.container(0, 0, [g, t]);
    c.add([box, tail]);
    c.setData('box', box).setData('halfW', w / 2).setData('h', h + 22);
    c.setScale(0.5);
    this.tweens.add({ targets: c, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.bubble = c;
    this.placeBubble();
    this.bubbleTimer = this.time.delayedCall(ms, () => {
      if (this.bubble === c) {
        this.bubble = null;
        this.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => c.destroy() });
      }
    });
  }

  /** Text of the bubble currently shown (debug). */
  bubbleText(): string | null {
    const box = this.bubble?.getData('box') as Phaser.GameObjects.Container | undefined;
    const t = box?.list.find((o) => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined;
    return t?.text ?? null;
  }

  /** Anchor = the point the bubble tail touches (above Juniper's head). The box shifts to stay on screen. */
  setAnchor(x: number, y: number) {
    this.anchor.x = Phaser.Math.Clamp(x, 40, GAME_W - 40);
    this.anchor.y = Math.max(220, y);
    if (this.bubble) this.placeBubble();
  }

  private placeBubble() {
    const c = this.bubble;
    if (!c) return;
    // keep the whole box on screen (below the pack bar) even when Juniper is high up on a ledge
    c.setPosition(this.anchor.x, Math.max(this.anchor.y, (c.getData('h') as number) + PACK_BOTTOM));
    const half = c.getData('halfW') as number;
    const boxX = Phaser.Math.Clamp(this.anchor.x, half + 20, GAME_W - half - 20);
    (c.getData('box') as Phaser.GameObjects.Container).x = boxX - this.anchor.x;
  }

  goHome() {
    this.scene.stop('World');
    this.scene.start('Map');
  }

  /** A hold-to-press button for movement; tracks pointer ids so several fingers can press at once. */
  private holdButton(x: number, y: number, icon: string, key: 'left' | 'right' | 'jump') {
    const size = 116;
    const face = this.add.image(x, y, TEX.buttonRound, 0).setDisplaySize(size, size);
    const ic = this.add.image(x, y - 3, icon).setDisplaySize(size * 0.62, size * 0.62);
    const ids = new Set<number>();
    const sync = () => {
      const on = ids.size > 0;
      controls[key] = on;
      face.setFrame(on ? 1 : 0).setDisplaySize(size, size);
      ic.y = on ? y + 2 : y - 3;
    };
    face.setInteractive();
    face.on('pointerdown', (p: Phaser.Input.Pointer) => {
      ids.add(p.id);
      if (key === 'jump') controls.jumpQueued = true;
      audio.unlock();
      sync();
    });
    face.on('pointerout', (p: Phaser.Input.Pointer) => {
      ids.delete(p.id);
      sync();
    });
    const up = (p: Phaser.Input.Pointer) => {
      ids.delete(p.id);
      sync();
    };
    face.on('pointerup', up);
    this.input.on('pointerup', up);
    this.input.on('gameout', () => {
      ids.clear();
      sync();
    });
  }
}
