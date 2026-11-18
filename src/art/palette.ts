// Lantern Peak palette — the shared ramps from docs/style-guide.md (dark -> light).
// Never pure black or pure white on painted art (tint-able particles are the one exception).

export const INK = '#1d1a3a';
export const INK2 = '#2e2a5c';

export const VIOLET = ['#3b3a7a', '#5b5fb0', '#8a92d8', '#b9c3f0'] as const;
export const SNOW = ['#c9d6f5', '#e6eeff', '#fff8ea'] as const;
export const ICE = ['#1f7fa8', '#39b6d8', '#8fe6f2', '#d6fbff'] as const;
export const PINE = ['#143d3a', '#1f6b52', '#3fa06a', '#8fd18a'] as const;
export const ROCK = ['#4a4368', '#6d6690', '#9a94b8'] as const;
export const SKY_DAY = ['#3a6fd8', '#6fa8f0', '#b6dcff', '#ffe9c9'] as const;
export const SKY_DUSK = ['#2b2360', '#6a3d8f', '#d86a8a', '#ffb37a'] as const;
export const WARM = ['#b3261e', '#e8472b', '#ff8a1f', '#ffc93c', '#fff1a8'] as const;
export const BERRY = ['#8f1d6b', '#d83a9a', '#ff8fcf'] as const;
export const GOAT = ['#b89a7a', '#e9d6b8', '#fff6e3'] as const;
export const WOOD = ['#5a3320', '#8a5530', '#c58a4a', '#eec07a'] as const;

/** Soft pink for inner ears / blush (a lighter, calmer cousin of BERRY[2]). */
export const PINK = '#f6a9c6';
/** Cream used for "white" UI glyphs and catchlights. */
export const CREAM = SNOW[2];

export const FONT = '"Baloo 2", "Fredoka", "Nunito", "Trebuchet MS", "Verdana", sans-serif';

/** Outline widths (px) per the style guide. */
export const OUTLINE = { hero: 5, prop: 4, small: 3, ui: 6 } as const;

// ---------- colour maths ----------

function parse(c: string): [number, number, number] {
  const h = c.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function toHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear mix of two hex colours, t = 0 -> a, 1 -> b. */
export function mix(a: string, b: string, t: number): string {
  const A = parse(a);
  const B = parse(b);
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

/** 0xRRGGBB -> '#rrggbb' */
export function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

/** rgba() string from hex + alpha. */
export function rgba(c: string, a: number): string {
  const [r, g, b] = parse(c);
  return `rgba(${r},${g},${b},${a})`;
}

/** Sample a ramp (array of hex) at t in [0,1] with linear interpolation. */
export function ramp(cols: readonly string[], t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (cols.length - 1);
  const i = Math.min(cols.length - 2, Math.floor(x));
  return mix(cols[i], cols[i + 1], x - i);
}

/** A 3-tone (shadow, base, highlight) set derived from one base colour, shadow cooled toward violet. */
export function tones(base: string): { dark: string; base: string; light: string; deep: string } {
  return {
    deep: mix(mix(base, INK, 0.5), VIOLET[0], 0.25),
    dark: mix(mix(base, INK, 0.28), VIOLET[1], 0.18),
    base,
    light: mix(base, WARM[4], 0.45),
  };
}
