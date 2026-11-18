// Shared UI helpers: text styles, wood panels, buttons. Style guide: docs/style-guide.md.
import Phaser from 'phaser';
import { TEX } from '../art/keys';
import { audio } from './audio';

export const FONT = '"Baloo 2", "Fredoka", "Nunito", "Trebuchet MS", "Verdana", sans-serif';

export const COLOR = {
  ink: 0x1d1a3a,
  ink2: 0x2e2a5c,
  cream: 0xfff8ea,
  snow: 0xe6eeff,
  violet: 0x3b3a7a,
  ice: 0x39b6d8,
  iceLight: 0x8fe6f2,
  orange: 0xff8a1f,
  yellow: 0xffc93c,
  red: 0xe8472b,
  berry: 0xd83a9a,
  wood: 0x8a5530,
  woodDark: 0x5a3320,
  woodLight: 0xeec07a,
};

export const css = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** Text style per the style guide: rounded stack, cream fill, ink stroke, resolution 2. */
export function textStyle(size: number, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: 'bold',
    color: '#fff8ea',
    stroke: '#1d1a3a',
    strokeThickness: size >= 36 ? 6 : 4,
    align: 'center',
    resolution: 2,
    ...opts,
  };
}

export function addText(scene: Phaser.Scene, x: number, y: number, s: string, size = 40, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) {
  return scene.add.text(x, y, s, textStyle(size, opts)).setOrigin(0.5);
}

/** A wood 9-slice panel (centre origin). */
export function addPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
  return scene.add.nineslice(x, y, TEX.panel, undefined, w, h, 48, 48, 48, 48);
}

export interface Button {
  root: Phaser.GameObjects.Container;
  face: Phaser.GameObjects.NineSlice;
  label: Phaser.GameObjects.Text;
  setEnabled(on: boolean): void;
  setLabel(s: string): void;
}

/**
 * Big rounded button with a pressed state. Centre origin.
 * The face is the hit target; `onClick` fires on pointerup inside the button.
 */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  fontSize = 44,
  tint?: number,
): Button {
  const root = scene.add.container(x, y);
  const face = scene.add.nineslice(0, 0, TEX.button, 0, w, h, 40, 40, 40, 40);
  const text = scene.add.text(0, -4, label, textStyle(fontSize)).setOrigin(0.5);
  root.add([face, text]);
  const baseTint = tint ?? 0xffffff;
  face.setTint(baseTint);
  let enabled = true;
  let down = false;
  face.setInteractive({ useHandCursor: true });
  const press = (on: boolean) => {
    down = on;
    text.y = on ? 2 : -4;
    face.setTint(on ? Phaser.Display.Color.ValueToColor(baseTint).darken(15).color : baseTint);
    root.setScale(on ? 0.97 : 1);
  };
  face.on('pointerdown', () => enabled && press(true));
  face.on('pointerout', () => down && press(false));
  face.on('pointerup', () => {
    if (!enabled || !down) return;
    press(false);
    audio.sfx('click');
    onClick();
  });
  return {
    root,
    face,
    label: text,
    setEnabled(on: boolean) {
      enabled = on;
      root.setAlpha(on ? 1 : 0.45);
      if (!on) press(false);
    },
    setLabel(s: string) {
      text.setText(s);
    },
  };
}

/** Round icon button (TEX.buttonRound + an icon texture). */
export function makeIconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  icon: string,
  onClick: () => void,
  size = 116,
  iconFrame?: number,
) {
  const root = scene.add.container(x, y);
  const face = scene.add.image(0, 0, TEX.buttonRound, 0).setDisplaySize(size, size);
  const ic = scene.add.image(0, -3, icon, iconFrame).setDisplaySize(size * 0.66, size * 0.66);
  root.add([face, ic]);
  face.setInteractive({ useHandCursor: true });
  let down = false;
  const set = (on: boolean) => {
    down = on;
    face.setFrame(on ? 1 : 0);
    face.setDisplaySize(size, size);
    ic.y = on ? 2 : -3;
  };
  face.on('pointerdown', () => set(true));
  face.on('pointerout', () => down && set(false));
  face.on('pointerup', () => {
    if (!down) return;
    set(false);
    audio.sfx('click');
    onClick();
  });
  return { root, face, icon: ic };
}

/** Mute toggle (top-right by default). Keeps its icon in sync with the audio manager. */
export function makeMuteButton(scene: Phaser.Scene, x = 1280 - 80, y = 80) {
  const b = makeIconButton(scene, x, y, TEX.iconSound, () => {
    audio.setMuted(!audio.isMuted());
    sync();
  }, 104, audio.isMuted() ? 1 : 0);
  const sync = () => {
    b.icon.setFrame(audio.isMuted() ? 1 : 0);
    b.icon.setDisplaySize(104 * 0.66, 104 * 0.66);
  };
  return b;
}

/** Wobble a game object side to side ("no" shake, never screen shake). */
export function wobble(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject) {
  const x0 = (target as any).__wobbleX ?? target.x;
  (target as any).__wobbleX = x0;
  scene.tweens.killTweensOf(target);
  target.x = x0;
  scene.tweens.add({
    targets: target,
    x: { from: x0 - 14, to: x0 + 14 },
    duration: 70,
    yoyo: true,
    repeat: 2,
    ease: 'Sine.easeInOut',
    onComplete: () => {
      target.x = x0;
    },
  });
}

/** Simple vertical banded sky (8 bands) drawn with Graphics. */
export function bandedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, top: number, bottom: number, bands = 8) {
  const a = Phaser.Display.Color.ValueToColor(top);
  const b = Phaser.Display.Color.ValueToColor(bottom);
  const bh = h / bands;
  for (let i = 0; i < bands; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, bands - 1, i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    g.fillRect(x, y + i * bh, w, bh + 1);
  }
}

/** Falling snow particles in screen space (3 layers, ~90 flakes). */
export function addSnow(scene: Phaser.Scene, depth = 50) {
  const layers = [
    { scale: { min: 0.35, max: 0.55 }, speed: [40, 70], freq: 190, life: 14000, alpha: 0.7 },
    { scale: { min: 0.7, max: 0.95 }, speed: [80, 120], freq: 320, life: 9000, alpha: 0.75 },
    { scale: { min: 1.2, max: 1.6 }, speed: [150, 200], freq: 650, life: 6000, alpha: 0.45 },
  ];
  return layers.map((l, i) => {
    const em = scene.add.particles(0, 0, TEX.snowflake, {
      x: { min: -80, max: 1360 },
      y: -20,
      speedY: { min: l.speed[0], max: l.speed[1] },
      speedX: { min: -30, max: 30 },
      accelerationX: { min: -12, max: 12 },
      scale: l.scale,
      alpha: l.alpha,
      lifespan: l.life,
      frequency: l.freq,
      quantity: 1,
    });
    em.setScrollFactor(0).setDepth(depth + i);
    // Pre-warm so the screen is not empty at start.
    em.fastForward(l.life * 0.9, 1000 / 30);
    return em;
  });
}

/** Confetti burst (50 pieces in lantern and berry colours). */
export const CONFETTI_TINTS = [0xe8472b, 0xff8a1f, 0xffc93c, 0xfff1a8, 0xd83a9a, 0xff8fcf];
export function confetti(scene: Phaser.Scene, x: number, y: number, depth = 500, count = 50) {
  const em = scene.add.particles(x, y, TEX.confetti, {
    speed: { min: 250, max: 650 },
    angle: { min: 200, max: 340 },
    gravityY: 700,
    rotate: { start: 0, end: 720 },
    scale: { min: 0.9, max: 1.6 },
    lifespan: 2200,
    tint: CONFETTI_TINTS,
    emitting: false,
  });
  em.setDepth(depth);
  em.explode(count);
  scene.time.delayedCall(2600, () => em.destroy());
  return em;
}

/** Star pickup burst (10 stars over ~400 ms). */
export function starBurst(scene: Phaser.Scene, x: number, y: number, tint = 0xfff1a8, depth = 400, count = 10) {
  const em = scene.add.particles(x, y, TEX.star, {
    speed: { min: 180, max: 340 },
    scale: { start: 0.9, end: 0 },
    lifespan: 420,
    tint,
    emitting: false,
  });
  em.setDepth(depth);
  em.explode(count);
  scene.time.delayedCall(700, () => em.destroy());
  return em;
}
