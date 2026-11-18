// Small Canvas 2D helpers shared by every art module.
import { INK, VIOLET, rgba } from './palette';

export type Ctx = CanvasRenderingContext2D;
export type PathFn = (ctx: Ctx) => void;

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [c, ctx];
}

/** Deterministic RNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TAU = Math.PI * 2;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------- paths ----------

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
}

export function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, Math.max(0.01, r), 0, TAU);
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function poly(ctx: Ctx, pts: number[], close = true): void {
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (close) ctx.closePath();
}

/** Smooth closed curve through points (quadratic midpoints). */
export function smoothClosed(ctx: Ctx, pts: number[]): void {
  const n = pts.length / 2;
  const mx = (i: number) => (pts[(i % n) * 2] + pts[((i + 1) % n) * 2]) / 2;
  const my = (i: number) => (pts[(i % n) * 2 + 1] + pts[((i + 1) % n) * 2 + 1]) / 2;
  ctx.moveTo(mx(0), my(0));
  for (let i = 1; i <= n; i++) ctx.quadraticCurveTo(pts[(i % n) * 2], pts[(i % n) * 2 + 1], mx(i), my(i));
  ctx.closePath();
}

/** Four-point sparkle star. */
export function star4(ctx: Ctx, x: number, y: number, r: number, inner = 0.28, rot = 0): void {
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * inner;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function star5(ctx: Ctx, x: number, y: number, r: number, inner = 0.48, rot = 0): void {
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * inner;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ---------- fills with outline ----------

/**
 * Outline then fill: stroke at 2x width first so the visible ink band is exactly
 * `lw` px outside the shape, then fill on top. Several sub-paths in `path` merge
 * into one silhouette with a single outer outline.
 */
export function inked(ctx: Ctx, path: PathFn, fill: string | CanvasGradient | null, lw: number, ink = INK): void {
  ctx.beginPath();
  path(ctx);
  if (lw > 0) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = lw * 2;
    ctx.strokeStyle = ink;
    ctx.stroke();
  }
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

export function fillPath(ctx: Ctx, path: PathFn, fill: string | CanvasGradient): void {
  ctx.beginPath();
  path(ctx);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokePath(ctx: Ctx, path: PathFn, col: string, lw: number): void {
  ctx.beginPath();
  path(ctx);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = col;
  ctx.stroke();
}

/** Run `draw` clipped to `path`. */
export function clipped(ctx: Ctx, path: PathFn, draw: () => void): void {
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.clip();
  draw();
  ctx.restore();
}

/**
 * Flat 3-tone body: outline, shadow colour everywhere, base colour offset toward the
 * light (upper left) so a crescent of shadow remains lower-right, then an optional highlight.
 */
export function shadedBlob(
  ctx: Ctx,
  path: PathFn,
  base: string,
  shadow: string,
  lw: number,
  off: [number, number] = [-5, -5],
  highlight?: { col: string; path: PathFn },
): void {
  inked(ctx, path, shadow, lw);
  clipped(ctx, path, () => {
    ctx.save();
    ctx.translate(off[0], off[1]);
    fillPath(ctx, path, base);
    ctx.restore();
    if (highlight) fillPath(ctx, highlight.path, highlight.col);
  });
}

/** Thick ink-outlined stroke (a "capsule" line). */
export function inkedLine(ctx: Ctx, pts: number[], col: string, w: number, lw: number, ink = INK): void {
  const path = (c: Ctx) => poly(c, pts, false);
  strokePath(ctx, path, ink, w + lw * 2);
  strokePath(ctx, path, col, w);
}

/** Soft elliptical ground shadow: night-violet at 35% alpha. */
export function groundShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.35): void {
  ctx.beginPath();
  ellipse(ctx, x, y, rx, ry);
  ctx.fillStyle = rgba(VIOLET[0], alpha);
  ctx.fill();
}

/** Banded (stepped) radial glow: concentric discs with falling alpha. */
export function bandGlow(ctx: Ctx, x: number, y: number, r: number, col: string, alpha: number, bands = 5, sy = 1): void {
  for (let i = 0; i < bands; i++) {
    const t = 1 - i / bands;
    ctx.beginPath();
    ellipse(ctx, x, y, r * t, r * t * sy);
    ctx.fillStyle = rgba(col, alpha / bands + (alpha * i) / (bands * bands));
    ctx.fill();
  }
}

/** Smooth radial glow (for light effects only). */
export function softGlow(ctx: Ctx, x: number, y: number, r: number, col: string, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, alpha));
  g.addColorStop(0.5, rgba(col, alpha * 0.45));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Text with ink stroke (UI style). */
export function inkText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  stroke = INK,
  strokeW = 6,
  font?: string,
  weight = '800',
): void {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font ?? '"Baloo 2", "Fredoka", "Nunito", "Trebuchet MS", "Verdana", sans-serif'}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (strokeW > 0) {
    ctx.lineWidth = strokeW;
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ---------- sheets ----------

export interface SheetSpec {
  key: string;
  canvas: HTMLCanvasElement;
  /** Frame size; omitted for single-image textures. */
  frameW?: number;
  frameH?: number;
  frames?: number;
  cols?: number;
}

export interface AnimSpec {
  key: string;
  texture: string;
  frames: number[];
  frameRate: number;
  repeat: number;
  /** Absolute ms for listed frame positions (index into `frames`); others use frameRate. */
  hold?: Record<number, number>;
}

/** Build a sprite sheet by drawing each frame into its own clipped cell. */
export function makeSheet(
  key: string,
  fw: number,
  fh: number,
  n: number,
  draw: (ctx: Ctx, i: number) => void,
  cols = n,
): SheetSpec {
  cols = Math.min(cols, n);
  const rows = Math.ceil(n / cols);
  const [c, ctx] = makeCanvas(fw * cols, fh * rows);
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate((i % cols) * fw, Math.floor(i / cols) * fh);
    ctx.beginPath();
    ctx.rect(0, 0, fw, fh);
    ctx.clip();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    draw(ctx, i);
    ctx.restore();
  }
  return { key, canvas: c, frameW: fw, frameH: fh, frames: n, cols };
}

export function single(key: string, w: number, h: number, draw: (ctx: Ctx) => void): SheetSpec {
  const [c, ctx] = makeCanvas(w, h);
  draw(ctx);
  return { key, canvas: c };
}

/** Frame rectangle of frame i in a sheet. */
export function frameRect(s: SheetSpec, i: number): [number, number, number, number] {
  if (!s.frameW || !s.frameH) return [0, 0, s.canvas.width, s.canvas.height];
  const cols = s.cols ?? s.frames ?? 1;
  return [(i % cols) * s.frameW, Math.floor(i / cols) * s.frameH, s.frameW, s.frameH];
}
