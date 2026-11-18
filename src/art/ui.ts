// UI kit: wood panel, buttons, icons, logo.
import { TEX } from './keys';
import { INK, INK2, VIOLET, SNOW, WARM, WOOD, CREAM, FONT, mix, rgba } from './palette';
import {
  Ctx, SheetSpec, makeSheet, makeCanvas, single, inked, fillPath, strokePath, clipped, ellipse, circle, roundRect, poly,
  star4, softGlow,
} from './draw';
import { drawGem, GEM_RAMPS, drawLantern, PRESENT_SCHEMES } from './items';

function snowCap(ctx: Ctx, x0: number, x1: number, y: number, depth: number, drips: number[], lw: number): void {
  const path = (c: Ctx) => {
    c.moveTo(x0, y + depth * 0.6);
    c.quadraticCurveTo(x0 - 2, y - depth * 0.5, x0 + depth, y - depth * 0.45);
    c.lineTo(x1 - depth, y - depth * 0.45);
    c.quadraticCurveTo(x1 + 2, y - depth * 0.5, x1, y + depth * 0.6);
    // drips on the way back
    let x = x1;
    for (const d of [...drips].sort((a, b) => b - a)) {
      c.lineTo(d + 9, y + depth * 0.6);
      c.quadraticCurveTo(d + 7, y + depth * 1.6, d, y + depth * 1.6);
      c.quadraticCurveTo(d - 7, y + depth * 1.6, d - 9, y + depth * 0.6);
      x = d - 9;
    }
    c.lineTo(x0, y + depth * 0.6);
    c.closePath();
  };
  inked(ctx, path, SNOW[1], lw);
  clipped(ctx, path, () => fillPath(ctx, (c) => c.rect(x0, y - depth, x1 - x0, depth * 0.75), SNOW[2]));
}

function buildPanel(): SheetSpec {
  return single(TEX.panel, 192, 192, (ctx) => {
    const o = 6;
    const face = (c: Ctx) => roundRect(c, o, o + 8, 192 - o * 2, 192 - o * 2 - 8, 26);
    inked(ctx, face, WOOD[1], 6);
    clipped(ctx, face, () => {
      // 4px bevels: light top-left, dark bottom-right
      ctx.lineWidth = 8;
      ctx.strokeStyle = WOOD[0];
      ctx.beginPath();
      roundRect(ctx, o + 2, o + 10, 192 - o * 2, 192 - o * 2 - 8, 26);
      ctx.stroke();
      ctx.strokeStyle = WOOD[2];
      ctx.beginPath();
      roundRect(ctx, o - 2, o + 6, 192 - o * 2, 192 - o * 2 - 8, 26);
      ctx.stroke();
      // grooved inner border (stays inside the 48 px corner band / straight edges)
      ctx.strokeStyle = rgba(WOOD[0], 0.55);
      ctx.lineWidth = 2;
      ctx.beginPath();
      roundRect(ctx, 22, 30, 148, 140, 14);
      ctx.stroke();
      // grain marks only in the corners
      ctx.strokeStyle = rgba(WOOD[0], 0.4);
      for (const [x, y] of [[28, 176], [150, 176], [18, 70]]) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 6, y - 3, x + 14, y);
        ctx.stroke();
      }
    });
    // nail heads
    for (const [x, y] of [[20, 32], [172, 32], [20, 176], [172, 176]]) {
      fillPath(ctx, (c) => circle(c, x, y, 3.5), WOOD[0]);
      fillPath(ctx, (c) => circle(c, x - 1, y - 1, 1.3), WOOD[3]);
    }
    snowCap(ctx, o + 2, 192 - o - 2, o + 10, 14, [30, 162], 3);
  });
}

function buttonSheet(key: string, w: number, h: number, round: boolean): SheetSpec {
  return makeSheet(key, w, h, 2, (ctx, i) => {
    const down = i === 1;
    const lip = 6;
    const pad = 6;
    const top = pad + (down ? lip : 0);
    const shape = (c: Ctx, y: number) =>
      round ? circle(c, w / 2, y + (h - pad * 2 - lip) / 2, (h - pad * 2 - lip) / 2) : roundRect(c, pad, y, w - pad * 2, h - pad * 2 - lip, 24);
    // lip
    if (!down) inked(ctx, (c) => shape(c, pad + lip), WARM[0], 5);
    inked(ctx, (c) => shape(c, top), WARM[2], 5);
    clipped(ctx, (c) => shape(c, top), () => {
      // lower shade band
      fillPath(ctx, (c) => c.rect(0, top + (h - pad * 2 - lip) * 0.62, w, h), mix(WARM[2], WARM[1], 0.45));
      // top highlight band
      const hb = (c: Ctx) =>
        round ? ellipse(c, w / 2 - 4, top + 22, w * 0.27, 12) : roundRect(c, pad + 18, top + 8, w - pad * 2 - 36, 14, 7);
      fillPath(ctx, hb, WARM[3]);
      fillPath(ctx, (c) => (round ? ellipse(c, w / 2 - 22, top + 20, 7, 4) : roundRect(c, pad + 24, top + 10, 30, 6, 3)), WARM[4]);
    });
  });
}

// ---------- icons (96x96, cream glyphs with ink outline) ----------

function icon(key: string, draw: (ctx: Ctx) => void, frames = 1, drawI?: (ctx: Ctx, i: number) => void): SheetSpec {
  if (frames > 1 && drawI) return makeSheet(key, 96, 96, frames, drawI);
  return single(key, 96, 96, draw);
}

const G = CREAM; // glyph fill
const LW = 5;

function arrow(ctx: Ctx, dir: 1 | -1): void {
  ctx.save();
  ctx.translate(48, 48);
  ctx.scale(dir, 1);
  inked(ctx, (c) => poly(c, [-26, -12, 2, -12, 2, -28, 30, 0, 2, 28, 2, 12, -26, 12]), G, LW);
  ctx.restore();
}

function speaker(ctx: Ctx): void {
  inked(ctx, (c) => poly(c, [14, 36, 30, 36, 50, 18, 50, 78, 30, 60, 14, 60]), G, LW);
}

function buildIcons(): SheetSpec[] {
  const out: SheetSpec[] = [];
  out.push(icon(TEX.iconLeft, (ctx) => arrow(ctx, -1)));
  out.push(icon(TEX.iconRight, (ctx) => arrow(ctx, 1)));
  out.push(icon(TEX.iconJump, (ctx) => {
    // hop arc + up chevron
    strokePath(ctx, (c) => { c.moveTo(14, 82); c.quadraticCurveTo(22, 40, 48, 40); }, INK, 18);
    strokePath(ctx, (c) => { c.moveTo(14, 82); c.quadraticCurveTo(22, 40, 48, 40); }, G, 8);
    inked(ctx, (c) => poly(c, [48, 10, 80, 44, 62, 44, 62, 84, 34, 84, 34, 44, 16, 44]), G, LW);
  }));
  out.push(icon(TEX.iconSound, () => {}, 2, (ctx, i) => {
    speaker(ctx);
    if (i === 0) {
      for (const r of [16, 30]) {
        strokePath(ctx, (c) => c.arc(52, 48, r, -0.75, 0.75), INK, 13);
        strokePath(ctx, (c) => c.arc(52, 48, r, -0.75, 0.75), G, 5);
      }
    } else {
      for (const [a, b, cx, d] of [[60, 34, 84, 62], [60, 62, 84, 34]]) {
        strokePath(ctx, (c) => { c.moveTo(a, b); c.lineTo(cx, d); }, INK, 15);
        strokePath(ctx, (c) => { c.moveTo(a, b); c.lineTo(cx, d); }, WARM[1], 6);
      }
    }
  }));
  out.push(icon(TEX.iconHint, (ctx) => {
    // speech bubble with a question mark
    inked(ctx, (c) => {
      roundRect(c, 10, 10, 76, 60, 22);
      poly(c, [26, 62, 22, 88, 48, 66]);
    }, G, LW);
    ctx.font = `800 50px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = WARM[2];
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.strokeText('?', 48, 42);
    ctx.fillText('?', 48, 42);
  }));
  out.push(icon(TEX.iconBack, (ctx) => {
    // curved return arrow
    strokePath(ctx, (c) => { c.moveTo(40, 34); c.lineTo(58, 34); c.arc(58, 54, 20, -Math.PI / 2, Math.PI / 2); c.lineTo(30, 74); }, INK, 22);
    strokePath(ctx, (c) => { c.moveTo(40, 34); c.lineTo(58, 34); c.arc(58, 54, 20, -Math.PI / 2, Math.PI / 2); c.lineTo(30, 74); }, G, 12);
    inked(ctx, (c) => poly(c, [12, 34, 42, 12, 42, 56]), G, LW);
  }));
  out.push(icon(TEX.iconGem, (ctx) => drawGem(ctx, 48, 46, 1.15, GEM_RAMPS[3], 4)));
  out.push(icon(TEX.iconLantern, (ctx) => drawLantern(ctx, 48, 46, 1.05, true, 4)));
  out.push(icon(TEX.iconPresent, (ctx) => {
    const sc = PRESENT_SCHEMES[0];
    inked(ctx, (c) => roundRect(c, 16, 38, 64, 48, 5), sc[0], 4);
    fillPath(ctx, (c) => c.rect(42, 38, 12, 48), sc[2]);
    inked(ctx, (c) => roundRect(c, 10, 26, 76, 18, 5), sc[0], 4);
    fillPath(ctx, (c) => c.rect(42, 28, 12, 14), sc[2]);
    for (const d of [-1, 1]) {
      inked(ctx, (c) => {
        c.moveTo(48, 24);
        c.bezierCurveTo(48 + d * 22, 2, 48 + d * 28, 26, 48, 24);
      }, sc[2], 3.5);
    }
    inked(ctx, (c) => circle(c, 48, 24, 5), sc[2], 3);
  }));
  return out;
}

// ---------- logo ----------

function buildLogo(): SheetSpec {
  return single(TEX.logo, 900, 360, (ctx) => {
    const words: [string, number, number, number][] = [
      ['Lantern', 430, 120, 150],
      ['Peak', 470, 262, 168],
    ];
    // warm glow behind the lantern
    softGlow(ctx, 790, 120, 120, WARM[3], 0.55);
    for (const [w, x, y, size] of words) {
      ctx.save();
      ctx.font = `900 ${size}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      // drop shadow
      ctx.lineWidth = 26;
      ctx.strokeStyle = VIOLET[0];
      ctx.strokeText(w, x + 6, y + 10);
      // ink outline
      ctx.lineWidth = 22;
      ctx.strokeStyle = INK;
      ctx.strokeText(w, x, y);
      // two-tone letter face: warm lantern body, lighter top band
      const m = ctx.measureText(w);
      const top = y - size * 0.42;
      const bot = y + size * 0.36;
      const g = ctx.createLinearGradient(0, top, 0, bot);
      const base = w === 'Lantern' ? WARM[2] : WARM[1];
      const light = w === 'Lantern' ? WARM[3] : WARM[2];
      g.addColorStop(0, light);
      g.addColorStop(0.5, light);
      g.addColorStop(0.5, base);
      g.addColorStop(1, base);
      // letter faces on a scratch canvas so the snow caps can be clipped to the letters only
      const [tc, tx] = makeCanvas(900, 360);
      tx.font = ctx.font;
      tx.textAlign = 'center';
      tx.textBaseline = 'middle';
      tx.fillStyle = g;
      tx.fillText(w, x, y);
      // snow caps: one per letter, following that letter's own top, with a drippy lower edge
      tx.globalCompositeOperation = 'source-atop';
      let cx = x - m.width / 2;
      for (let i = 0; i < w.length; i++) {
        const ch = w[i];
        const cm = tx.measureText(ch);
        const adv = tx.measureText(w.slice(0, i + 1)).width - tx.measureText(w.slice(0, i)).width;
        // 'middle' baseline: glyph top = y - (ascent - offset of middle); use the box metrics directly
        const gTop = y - cm.actualBoundingBoxAscent;
        const depth = size * 0.12;
        tx.beginPath();
        tx.moveTo(cx - 4, gTop - 30);
        tx.lineTo(cx + adv + 4, gTop - 30);
        const n = 5;
        for (let k = n; k >= 0; k--) {
          const xx = cx - 4 + ((adv + 8) * k) / n;
          const drip = (k + i) % 3 === 1 ? depth * 0.55 : 0;
          tx.lineTo(xx, gTop + depth + Math.sin(k * 1.7 + i) * 3 + drip);
        }
        tx.closePath();
        tx.fillStyle = SNOW[2];
        tx.fill();
        cx += adv;
      }
      void top;
      ctx.drawImage(tc, 0, 0);
      ctx.restore();
    }
    // composite pass above used source-atop on the whole canvas, so redraw nothing else beneath.
    // small hanging lantern on a hook, right of "Lantern"
    strokePath(ctx, (c) => { c.moveTo(760, 20); c.lineTo(820, 20); c.lineTo(820, 50); }, INK, 12);
    strokePath(ctx, (c) => { c.moveTo(760, 20); c.lineTo(820, 20); c.lineTo(820, 50); }, WOOD[2], 5);
    drawLantern(ctx, 820, 98, 0.95, true, 4);
    // sparkles
    for (const [x, y, r] of [[96, 60, 12], [870, 230, 10], [130, 300, 9], [700, 330, 8]]) {
      inked(ctx, (c) => star4(c, x, y, r, 0.3), WARM[3], 2.5);
    }
    void INK2;
  });
}

export function buildUI(): { sheets: SheetSpec[] } {
  return {
    sheets: [
      buildPanel(),
      buttonSheet(TEX.button, 320, 120, false),
      buttonSheet(TEX.buttonRound, 128, 128, true),
      ...buildIcons(),
      buildLogo(),
    ],
  };
}
