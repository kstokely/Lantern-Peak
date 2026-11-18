// Creates simple labelled placeholders for any texture/animation in src/art/keys.ts that the
// art module did not create, so the game always runs. Real art always wins: existing keys are untouched.
import Phaser from 'phaser';
import {
  ANIM,
  ANIM2,
  ANIM4,
  TEX4,
  BG_LAYERS,
  BgLayer,
  COUNT_ICONS,
  FLURRY_KINDS,
  HAT_COUNT,
  TEX2,
  TOOL_IDS,
  countIconKey,
  flurryBobAnim,
  flurryKey,
  hatKey,
  toolKey,
  GEM_COLOURS,
  JUNIPER_FRAME,
  PRESENT_COLOURS,
  SCARF_COLOURS,
  TEX,
  bgKey,
  friendKey,
  gemKey,
  juniperAnim,
  juniperKey,
  presentKey,
} from '../art/keys';

interface Spec {
  w: number;
  h: number;
  frames: number;
  color: number;
  round?: boolean;
}

/** Juniper placeholder sheet layout: idle 0-3, walk 4-9, jump 10-13, cheer 14-17. */
const JUNIPER_FRAMES = 18;

function specs(): Record<string, Spec> {
  const s: Record<string, Spec> = {};
  SCARF_COLOURS.forEach((c, i) => (s[juniperKey(i)] = { w: JUNIPER_FRAME.w, h: JUNIPER_FRAME.h, frames: JUNIPER_FRAMES, color: c }));
  const gemTints = [0xe8472b, 0xff8a1f, 0xffc93c, 0x39b6d8, 0x3fa06a, 0xd83a9a];
  for (let i = 0; i < GEM_COLOURS; i++) s[gemKey(i)] = { w: 96, h: 96, frames: 4, color: gemTints[i], round: true };
  const presTints = [0xe8472b, 0xd83a9a, 0xff8a1f, 0x39b6d8];
  for (let i = 0; i < PRESENT_COLOURS; i++) s[presentKey(i)] = { w: 160, h: 160, frames: 9, color: presTints[i] };
  Object.assign(s, {
    [TEX.lantern]: { w: 96, h: 128, frames: 2, color: 0xffc93c },
    [TEX.sled]: { w: 320, h: 220, frames: 2, color: 0x8a5530 },
    [TEX.gate]: { w: 200, h: 360, frames: 2, color: 0x8fe6f2 },
    [TEX.bluster]: { w: 220, h: 180, frames: 4, color: 0x8a92d8, round: true },
    [friendKey('pip')]: { w: 200, h: 220, frames: 2, color: 0xe6eeff },
    [friendKey('marlow')]: { w: 200, h: 220, frames: 2, color: 0xc58a4a },
    [friendKey('odette')]: { w: 200, h: 220, frames: 2, color: 0x9a94b8 },
    [TEX.snowflake]: { w: 16, h: 16, frames: 1, color: 0xfff8ea, round: true },
    [TEX.star]: { w: 32, h: 32, frames: 1, color: 0xfff8ea, round: true },
    [TEX.confetti]: { w: 16, h: 10, frames: 1, color: 0xfff8ea },
    [TEX.ledge]: { w: 240, h: 56, frames: 1, color: 0x8fe6f2 },
    [TEX.panel]: { w: 192, h: 192, frames: 1, color: 0x8a5530 },
    [TEX.button]: { w: 320, h: 120, frames: 2, color: 0xff8a1f },
    [TEX.buttonRound]: { w: 128, h: 128, frames: 2, color: 0xff8a1f, round: true },
    [TEX.iconLeft]: { w: 96, h: 96, frames: 1, color: 0xfff8ea },
    [TEX.iconRight]: { w: 96, h: 96, frames: 1, color: 0xfff8ea },
    [TEX.iconJump]: { w: 96, h: 96, frames: 1, color: 0xfff8ea },
    [TEX.iconSound]: { w: 96, h: 96, frames: 2, color: 0xfff8ea },
    [TEX.iconHint]: { w: 96, h: 96, frames: 1, color: 0xfff8ea },
    [TEX.iconBack]: { w: 96, h: 96, frames: 1, color: 0xfff8ea },
    [TEX.iconGem]: { w: 96, h: 96, frames: 1, color: 0x39b6d8 },
    [TEX.iconLantern]: { w: 96, h: 96, frames: 1, color: 0xffc93c },
    [TEX.iconPresent]: { w: 96, h: 96, frames: 1, color: 0xd83a9a },
    [TEX.coin]: { w: 128, h: 128, frames: 6, color: 0xffc93c, round: true },
    [TEX.pvGem]: { w: 128, h: 128, frames: 4, color: 0x39b6d8 },
    [TEX.snowball]: { w: 64, h: 64, frames: 1, color: 0xe6eeff, round: true },
    [TEX.clockFace]: { w: 520, h: 520, frames: 1, color: 0xfff8ea, round: true },
    [TEX.clockHandHour]: { w: 40, h: 170, frames: 1, color: 0x1d1a3a },
    [TEX.clockHandMinute]: { w: 28, h: 230, frames: 1, color: 0x2e2a5c },
    [TEX.plank]: { w: 220, h: 90, frames: 2, color: 0x8fe6f2 },
    [TEX.crate]: { w: 300, h: 220, frames: 1, color: 0x8a5530 },
    [TEX.logo]: { w: 900, h: 360, frames: 1, color: 0xff8a1f },
  });
  // ---- v2 ----
  for (const n of COUNT_ICONS) s[countIconKey(n)] = { w: 64, h: 64, frames: 1, color: 0xffc93c, round: true };
  const toolTints = [0xc58a4a, 0x39b6d8, 0xffc93c, 0xfff1a8, 0x8fe6f2, 0xe8472b, 0xd83a9a, 0xb9c3f0, 0xeec07a];
  TOOL_IDS.forEach((id, i) => (s[toolKey(id)] = { w: 128, h: 128, frames: 1, color: toolTints[i % toolTints.length] }));
  const hatTints = [0xe8472b, 0xd83a9a, 0x3fa06a, 0xffc93c, 0x39b6d8];
  for (let i = 0; i < HAT_COUNT; i++) s[hatKey(i)] = { w: 96, h: 96, frames: 1, color: hatTints[i % hatTints.length], round: true };
  const flurryTints = [0xe6eeff, 0xb9c3f0, 0x8fd18a, 0x8a92d8, 0x8fe6f2, 0x39b6d8, 0xeec07a, 0xc9d6f5, 0xff8fcf, 0xfff1a8];
  for (let k = 0; k < FLURRY_KINDS; k++) s[flurryKey(k)] = { w: 96, h: 96, frames: 4, color: flurryTints[k], round: true };
  Object.assign(s, {
    [TEX2.looseGem]: { w: 48, h: 48, frames: 4, color: 0x39b6d8, round: true },
    [TEX2.doorOpen]: { w: 220, h: 300, frames: 1, color: 0x4a4368 },
    [TEX2.doorIce]: { w: 220, h: 300, frames: 2, color: 0x8fe6f2 },
    [TEX2.doorDark]: { w: 220, h: 300, frames: 1, color: 0x2e2a5c },
    [TEX2.doorHigh]: { w: 220, h: 300, frames: 1, color: 0x6d6690 },
    [TEX2.stall]: { w: 300, h: 280, frames: 1, color: 0xc58a4a },
    [TEX2.shopBg]: { w: 1280, h: 960, frames: 1, color: 0x8a5530 },
    [TEX2.lodgeBg]: { w: 1280, h: 960, frames: 1, color: 0x5b5fb0 },
    [TEX2.lockBadge]: { w: 96, h: 96, frames: 1, color: 0xffc93c, round: true },
    [TEX2.starGold]: { w: 96, h: 96, frames: 1, color: 0xffc93c, round: true },
    [TEX2.purse]: { w: 96, h: 96, frames: 1, color: 0xd83a9a, round: true },
    [TEX2.bellRing]: { w: 128, h: 128, frames: 4, color: 0xfff1a8, round: true },
  });
  return s;
}

/** Darkness overlay placeholder: deep night with a soft clear circle in the middle. */
function makeDarkness(scene: Phaser.Scene) {
  placeholderKeys.push(TEX2.darkness);
  const tex = scene.textures.createCanvas(TEX2.darkness, 1280, 960);
  if (!tex) return;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(640, 480, 120, 640, 480, 330);
  g.addColorStop(0, 'rgba(18,16,40,0)');
  g.addColorStop(1, 'rgba(18,16,40,0.94)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1280, 960);
  tex.refresh();
}

/** Texture keys that had to be faked since page load (debug: must stay empty now the real art is complete). */
export const placeholderKeys: string[] = [];

/** Fills in any v2 texture/animation the art module has not made (yet). Safe to call often. */
export function ensureV2Placeholders(scene: Phaser.Scene): string[] {
  const made: string[] = [];
  const all = specs();
  const v2Keys = [
    ...COUNT_ICONS.map(countIconKey),
    ...TOOL_IDS.map(toolKey),
    ...Array.from({ length: HAT_COUNT }, (_, i) => hatKey(i)),
    ...Array.from({ length: FLURRY_KINDS }, (_, k) => flurryKey(k)),
    ...Object.values(TEX2).filter((k) => k !== TEX2.darkness),
  ];
  for (const key of v2Keys) {
    if (scene.textures.exists(key) || !all[key]) continue;
    makeSheet(scene, key, all[key]);
    made.push(key);
  }
  if (!scene.textures.exists(TEX2.darkness)) {
    makeDarkness(scene);
    made.push(TEX2.darkness);
  }
  const frames = (tex: string) => Math.max(1, scene.textures.get(tex).frameTotal - 1);
  const loop = (key: string, tex: string, n: number, rate: number, repeat: number) => {
    if (scene.anims.exists(key) || !scene.textures.exists(tex)) return;
    const f = Math.min(n, frames(tex));
    scene.anims.create({ key, frames: range(0, f).map((i) => ({ key: tex, frame: i })), frameRate: rate, repeat });
  };
  loop(ANIM2.looseGemTwinkle, TEX2.looseGem, 4, 8, -1);
  loop(ANIM2.bellRing, TEX2.bellRing, 4, 10, 1);
  for (let k = 0; k < FLURRY_KINDS; k++) loop(flurryBobAnim(k), flurryKey(k), 2, 4, -1);
  return made;
}

// ---------- v4: platforming pieces ----------

/** Size / frames of every TEX4 texture (keys.ts contract). */
export const TEX4_SPECS: Record<string, Spec> = {
  [TEX4.platCloud]: { w: 240, h: 80, frames: 2, color: 0xf4f7ff },
  [TEX4.platLog]: { w: 240, h: 64, frames: 1, color: 0x8a5530 },
  [TEX4.platCrumble]: { w: 200, h: 64, frames: 4, color: 0xb9e9f5 },
  [TEX4.platBrass]: { w: 200, h: 48, frames: 2, color: 0xd9a441 },
  [TEX4.platAurora]: { w: 240, h: 40, frames: 4, color: 0x8ff2c8 },
  [TEX4.iceStrip]: { w: 240, h: 40, frames: 1, color: 0xbff3ff },
  [TEX4.rockBlock]: { w: 160, h: 160, frames: 1, color: 0x8a8fb0 },
  [TEX4.rockBody]: { w: 160, h: 160, frames: 1, color: 0x6d7090 },
  [TEX4.bouncePad]: { w: 150, h: 100, frames: 3, color: 0xff8fcf, round: true },
  [TEX4.gear]: { w: 240, h: 240, frames: 1, color: 0xc58a4a, round: true },
  [TEX4.pendulumRod]: { w: 28, h: 420, frames: 1, color: 0x8a5530 },
  [TEX4.checkpoint]: { w: 90, h: 190, frames: 2, color: 0xffc93c },
  [TEX4.helperCloud]: { w: 240, h: 120, frames: 2, color: 0xffffff, round: true },
  [TEX4.pitMist]: { w: 320, h: 140, frames: 1, color: 0xdfe8ff },
  [TEX4.windStreak]: { w: 120, h: 16, frames: 1, color: 0xffffff },
  [TEX4.arrowSign]: { w: 110, h: 150, frames: 3, color: 0xc58a4a },
};

/** Fills in any TEX4 texture, v4 tool icon or ANIM4 animation the art module has not made (yet). */
export function ensureV4Placeholders(scene: Phaser.Scene): string[] {
  const made: string[] = [];
  for (const [key, sp] of Object.entries(TEX4_SPECS)) {
    if (scene.textures.exists(key)) continue;
    makeSheet(scene, key, sp);
    made.push(key);
  }
  const all = specs();
  for (const id of ['gripHooves', 'cloudBoots', 'featherCape'] as const) {
    const key = toolKey(id);
    if (scene.textures.exists(key)) continue;
    makeSheet(scene, key, all[key]);
    made.push(key);
  }
  const fr = (tex: string, want: number[]) => {
    const n = Math.max(1, scene.textures.get(tex).frameTotal - 1);
    return want.map((f) => Math.min(f, n - 1));
  };
  const mk = (key: string, tex: string, want: number[], rate: number, repeat: number) => {
    if (scene.anims.exists(key) || !scene.textures.exists(tex)) return;
    scene.anims.create({ key, frames: fr(tex, want).map((f) => ({ key: tex, frame: f })), frameRate: rate, repeat });
  };
  mk(ANIM4.cloudBob, TEX4.platCloud, [0, 1], 2, -1);
  mk(ANIM4.auroraShimmer, TEX4.platAurora, [0, 1, 2, 3], 6, -1);
  mk(ANIM4.bounce, TEX4.bouncePad, [1, 2, 0], 14, 0);
  mk(ANIM4.crumble, TEX4.platCrumble, [0, 1, 2, 3], 4, 0);
  return made;
}

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

function drawFrame(ctx: CanvasRenderingContext2D, x: number, y: number, sp: Spec, label: string, frame: number) {
  const { w, h } = sp;
  const pad = Math.max(1, Math.min(w, h) * 0.06);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = hex(sp.color);
  ctx.strokeStyle = '#1d1a3a';
  ctx.lineWidth = Math.max(1, Math.min(4, Math.min(w, h) / 12));
  ctx.beginPath();
  if (sp.round) ctx.ellipse(w / 2, h / 2, w / 2 - pad, h / 2 - pad, 0, 0, Math.PI * 2);
  else if ((ctx as any).roundRect) (ctx as any).roundRect(pad, pad, w - pad * 2, h - pad * 2, Math.min(w, h) * 0.2);
  else ctx.rect(pad, pad, w - pad * 2, h - pad * 2);
  ctx.fill();
  if (w >= 24) ctx.stroke();
  if (w >= 64 && h >= 40) {
    const fs = Math.max(10, Math.min(22, w / 9));
    ctx.fillStyle = '#1d1a3a';
    ctx.font = `bold ${fs}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2 - fs * 0.6, w - 8);
    ctx.fillText(`#${frame}`, w / 2, h / 2 + fs * 0.7);
  }
  ctx.restore();
}

function makeSheet(scene: Phaser.Scene, key: string, sp: Spec) {
  placeholderKeys.push(key);
  const tex = scene.textures.createCanvas(key, sp.w * sp.frames, sp.h);
  if (!tex) return;
  const ctx = tex.getContext();
  for (let f = 0; f < sp.frames; f++) drawFrame(ctx, f * sp.w, 0, sp, key, f);
  for (let f = 0; f < sp.frames; f++) tex.add(f, 0, f * sp.w, 0, sp.w, sp.h);
  tex.refresh();
}

const ZONE_SKY: [string, string][] = [
  ['#6fa8f0', '#ffe9c9'],
  ['#3a6fd8', '#b6dcff'],
  ['#1f7fa8', '#8fe6f2'],
  ['#2b2360', '#ffb37a'],
  ['#1d1a3a', '#5b5fb0'],
];

function makeBg(scene: Phaser.Scene, zone: number, layer: BgLayer) {
  const key = bgKey(zone, layer);
  placeholderKeys.push(key);
  const h = layer === 'ground' ? 320 : 960;
  const tex = scene.textures.createCanvas(key, 1280, h);
  if (!tex) return;
  const ctx = tex.getContext();
  const [top, bot] = ZONE_SKY[zone % ZONE_SKY.length];
  if (layer === 'sky') {
    for (let i = 0; i < 8; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.HexStringToColor(top),
        Phaser.Display.Color.HexStringToColor(bot),
        7,
        i,
      );
      ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
      ctx.fillRect(0, (i * h) / 8, 1280, h / 8 + 1);
    }
  } else if (layer === 'ground') {
    ctx.fillStyle = '#c9d6f5';
    ctx.fillRect(0, 60, 1280, h - 60);
    ctx.fillStyle = '#fff8ea';
    ctx.fillRect(0, 60, 1280, 26);
    ctx.fillStyle = '#8a92d8';
    for (let x = 0; x < 1280; x += 160) ctx.fillRect(x + 40, 140, 70, 8);
    ctx.fillStyle = '#1d1a3a';
    ctx.fillRect(0, 56, 1280, 4);
  } else {
    // Simple repeating silhouettes: peaks (far), hills (mid), pines (near).
    const cfg = { far: ['#b9c3f0', 420, 6], mid: ['#8a92d8', 560, 8], near: ['#1f6b52', 620, 16] } as const;
    const [col, base, n] = cfg[layer];
    ctx.fillStyle = col;
    const step = 1280 / n;
    for (let i = 0; i <= n; i++) {
      const x = i * step;
      const peak = layer === 'near' ? 140 : layer === 'mid' ? 160 : 260;
      const hgt = peak * (0.7 + 0.3 * Math.abs(Math.sin(i * 1.7)));
      ctx.beginPath();
      ctx.moveTo(x - step * 0.75, base + 400);
      ctx.lineTo(x, base - hgt);
      ctx.lineTo(x + step * 0.75, base + 400);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(0, base, 1280, h - base);
  }
  tex.refresh();
}

function anim(scene: Phaser.Scene, key: string, tex: string, frames: number[], frameRate: number, repeat: number) {
  if (scene.anims.exists(key) || !scene.textures.exists(tex)) return;
  scene.anims.create({ key, frames: frames.map((f) => ({ key: tex, frame: f })), frameRate, repeat });
}

const range = (a: number, n: number) => Array.from({ length: n }, (_, i) => a + i);

/**
 * Returns the list of keys that had to be faked (for logging). Zone backgrounds are created
 * on demand by the art module (ensureZoneArt), so only the zones listed in `bgZones` (the
 * ones registerArt creates at boot) get background placeholders here.
 */
export function ensurePlaceholders(scene: Phaser.Scene, bgZones: number[] = [0]): string[] {
  const made: string[] = [];
  for (const [key, sp] of Object.entries(specs())) {
    if (scene.textures.exists(key)) continue;
    makeSheet(scene, key, sp);
    made.push(key);
  }
  for (const z of bgZones)
    for (const l of BG_LAYERS) {
      const key = bgKey(z, l);
      if (scene.textures.exists(key)) continue;
      makeBg(scene, z, l);
      made.push(key);
    }
  // Animations (only created when missing; if the art made the texture but not the anim we
  // still build one using the placeholder frame layout, clamped to the frames that exist).
  const clamp = (tex: string, fr: number[]) => {
    const t = scene.textures.get(tex);
    const total = Math.max(1, t.frameTotal - 1);
    return fr.map((f) => Math.min(f, total - 1));
  };
  SCARF_COLOURS.forEach((_, s) => {
    const t = juniperKey(s);
    anim(scene, juniperAnim(ANIM.idle, s), t, clamp(t, range(0, 4)), 3, -1);
    anim(scene, juniperAnim(ANIM.walk, s), t, clamp(t, range(4, 6)), 10, -1);
    anim(scene, juniperAnim(ANIM.jumpUp, s), t, clamp(t, [10, 11]), 8, 0);
    anim(scene, juniperAnim(ANIM.jumpFall, s), t, clamp(t, [12, 13]), 8, 0);
    anim(scene, juniperAnim(ANIM.cheer, s), t, clamp(t, range(14, 4)), 6, 0);
  });
  for (let i = 0; i < GEM_COLOURS; i++) anim(scene, ANIM.gemTwinkle(i), gemKey(i), clamp(gemKey(i), range(0, 4)), 8, -1);
  for (let i = 0; i < PRESENT_COLOURS; i++) {
    const t = presentKey(i);
    anim(scene, ANIM.presentIdle(i), t, clamp(t, [0, 1]), 3, -1);
    anim(scene, ANIM.presentShake(i), t, clamp(t, [2, 3, 4, 3, 2, 3, 4]), 12, 0);
    anim(scene, ANIM.presentBurst(i), t, clamp(t, [5, 6, 7, 8]), 10, 0);
  }
  return made;
}
