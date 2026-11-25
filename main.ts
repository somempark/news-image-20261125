// news-image-20261125 — "The World in One Day"
//
// A self-contained Node 22 program (standard library only, no network) that
// paints a 1024x1024 newspaper front page summing up Wednesday 25 November
// 2026 and saves it as /output/entry.png. It is fully deterministic: two
// runs produce byte-identical files.
//
// The six stories, each first reported on 25 November 2026:
//  1. A new analysis puts Russian soldiers killed in the Ukraine war past 700,000.
//  2. Iraq's prime minister orders federal forces to take over Kurdish oilfields.
//  3. Indonesia's President Prabowo names two candidates to replace VP Gibran.
//  4. Gunmen still hold 20 hostages in a Cartagena supermarket after a failed heist.
//  5. China Southern's Xiamen Airlines orders 50 Boeing 737-8 jets.
//  6. The IAEA names a sanctioned Russian envoy deputy chief; Ukraine demands a reversal.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 4);

type RGB = [number, number, number];

// Paint one pixel, silently ignoring out-of-bounds coordinates.
function put(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
  buf[i + 3] = 255;
}

// Paint a solid rectangle, clipped to the canvas.
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 4;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
      buf[i + 3] = 255;
    }
  }
}

// Paint just the border of a rectangle, thickness t.
function frame(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
  rect(x, y, w, t, c);
  rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c);
  rect(x + w - t, y, t, h, c);
}

// Bresenham segment of thickness t.
function seg(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    rect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// Paint a filled disc.
function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) put(cx + x, cy + y, c);
  }
}

// Paint a filled triangle (barycentric sign test over its bounding box).
function tri(
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number,
  c: RGB,
): void {
  const s = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
    (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
  const lo_x = Math.max(0, Math.min(x0, x1, x2));
  const hi_x = Math.min(W - 1, Math.max(x0, x1, x2));
  const lo_y = Math.max(0, Math.min(y0, y1, y2));
  const hi_y = Math.min(H - 1, Math.max(y0, y1, y2));
  for (let y = lo_y; y <= hi_y; y++) {
    for (let x = lo_x; x <= hi_x; x++) {
      const d0 = s(x, y, x0, y0, x1, y1);
      const d1 = s(x, y, x1, y1, x2, y2);
      const d2 = s(x, y, x2, y2, x0, y0);
      const has_neg = d0 < 0 || d1 < 0 || d2 < 0;
      const has_pos = d0 > 0 || d1 > 0 || d2 > 0;
      if (!(has_neg && has_pos)) put(x, y, c);
    }
  }
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph is seven rows of five bits, stored as numbers:
// bit 4 is the leftmost cell, bit 0 the rightmost. Uppercase, digits and
// the punctuation the headlines need.
// ---------------------------------------------------------------------------
const GLYPHS: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x13, 0x11, 0x11, 0x0e],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x19, 0x15, 0x13, 0x13, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x13, 0x15, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x14, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1e, 0x01, 0x01, 0x0e, 0x01, 0x01, 0x1e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x0e, 0x10, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x02, 0x04, 0x04, 0x04],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x01, 0x0e],
  " ": [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  ",": [0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c, 0x08],
  ":": [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
  ";": [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
  "'": [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
  "-": [0x00, 0x00, 0x00, 0x0e, 0x00, 0x00, 0x00],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  "&": [0x0c, 0x12, 0x12, 0x08, 0x15, 0x12, 0x0d],
  "%": [0x11, 0x12, 0x02, 0x04, 0x08, 0x12, 0x11],
  "+": [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
  "=": [0x00, 0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00],
  '"': [0x0a, 0x0a, 0x0a, 0x00, 0x00, 0x00, 0x00],
  "\u2022": [0x00, 0x00, 0x0e, 0x0e, 0x0e, 0x00, 0x00],
};

function measure(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function print(x: number, y: number, text: string, scale: number, c: RGB): void {
  const upper = text.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const rows = GLYPHS[upper[i]] ?? GLYPHS["?"];
    const gx = x + i * 6 * scale;
    for (let row = 0; row < 7; row++) {
      const bits = rows[row];
      for (let col = 0; col < 5; col++) {
        if ((bits >> (4 - col)) & 1) {
          rect(gx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
  }
}

function printCentred(cx: number, y: number, text: string, scale: number, c: RGB): void {
  print(cx - Math.floor(measure(text, scale) / 2), y, text, scale, c);
}

// Greedy word wrap to a maximum character count per line.
function splitLines(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur.length === 0) {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += " " + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------------------
// PNG writer (truecolour, no filter): CRC32 table, chunk assembly, zlib.
// Standard library only.
// ---------------------------------------------------------------------------
const CRC: number[] = (() => {
  const tab: number[] = [];
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    tab[n] = v >>> 0;
  }
  return tab;
})();

function crcOf(data: Buffer): number {
  let v = 0xffffffff;
  for (let i = 0; i < data.length; i++) v = CRC[(v ^ data[i]) & 0xff] ^ (v >>> 8);
  return (v ^ 0xffffffff) >>> 0;
}

function u32be(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function pngChunk(kind: string, data: Buffer): Buffer {
  const tag = Buffer.from(kind, "ascii");
  return Buffer.concat([u32be(data.length), tag, data, u32be(crcOf(Buffer.concat([tag, data])))]);
}

function pngBytes(): Buffer {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(W, 0);
  head.writeUInt32BE(H, 4);
  head[8] = 8; // 8-bit samples
  head[9] = 6; // RGBA
  head[10] = 0;
  head[11] = 0;
  head[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    Buffer.from(buf.buffer, y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", head),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const PAPER: RGB = [247, 243, 234];
const INK: RGB = [24, 28, 34];
const NAVY: RGB = [14, 42, 71];
const GOLD: RGB = [242, 193, 78];
const WHITE: RGB = [255, 255, 255];
const PANEL: RGB = [255, 255, 255];

// ---------------------------------------------------------------------------
// Story artwork. Each painter fills a 490x120 strip inside its panel.
// ---------------------------------------------------------------------------

// 1. War toll: dark battlefield sky, rows of white crosses, big "700,000".
function artToll(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, 52, [58, 64, 74]);
  rect(x, y + 52, w, h - 52, [38, 42, 48]);
  // Pale sun low on the horizon
  disc(x + 430, y + 30, 16, [232, 214, 170]);
  // Distant smoke columns
  disc(x + 90, y + 22, 10, [120, 118, 112]);
  disc(x + 112, y + 14, 12, [136, 134, 128]);
  disc(x + 300, y + 18, 9, [120, 118, 112]);
  // Rows of white memorial crosses on the dark ground
  const cross = (cx: number, cy: number, s: number): void => {
    rect(cx - s, cy - 3 * s, 2 * s, 6 * s, [228, 228, 222]);
    rect(cx - 3 * s, cy - 2 * s, 6 * s, 2 * s, [228, 228, 222]);
  };
  for (let i = 0; i < 7; i++) cross(x + 30 + i * 26, y + 84, 3);
  for (let i = 0; i < 6; i++) cross(x + 44 + i * 26, y + 104, 3);
  // Big toll figure on a dark plaque, right side
  rect(x + 250, y + 56, 222, 56, [24, 28, 34]);
  frame(x + 250, y + 56, 222, 56, GOLD, 3);
  print(x + 262, y + 64, "700,000", 4, WHITE);
  print(x + 262, y + 94, "KILLED", 2, GOLD);
}

// 2. Iraq oilfields: desert dusk, pumpjack and derrick, oil barrel.
function artOil(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, 62, [233, 196, 130]);
  rect(x, y + 62, w, h - 62, [164, 122, 62]);
  disc(x + 420, y + 26, 18, [240, 150, 50]);
  // Derrick, left
  seg(x + 60, y + 110, x + 84, y + 30, [60, 48, 36], 4);
  seg(x + 108, y + 110, x + 84, y + 30, [60, 48, 36], 4);
  seg(x + 66, y + 88, x + 102, y + 88, [60, 48, 36], 3);
  seg(x + 72, y + 64, x + 96, y + 64, [60, 48, 36], 3);
  rect(x + 76, y + 18, 16, 12, [60, 48, 36]);
  // Pumpjack, centre-right
  rect(x + 200, y + 78, 90, 10, [40, 40, 44]);
  seg(x + 214, y + 88, x + 214, y + 112, [40, 40, 44], 5);
  seg(x + 276, y + 88, x + 276, y + 112, [40, 40, 44], 5);
  seg(x + 200, y + 78, x + 290, y + 52, [40, 40, 44], 5);
  disc(x + 292, y + 50, 9, [40, 40, 44]);
  seg(x + 292, y + 58, x + 292, y + 96, [40, 40, 44], 3);
  rect(x + 286, y + 96, 12, 12, [40, 40, 44]);
  // Oil barrel, right
  rect(x + 380, y + 76, 56, 36, [24, 28, 34]);
  rect(x + 380, y + 86, 56, 4, [90, 90, 96]);
  rect(x + 380, y + 100, 56, 4, [90, 90, 96]);
  print(x + 394, y + 86, "OIL", 2, GOLD);
  // Iraqi flag strip on the ground line
  rect(x + 316, y + 108, 54, 4, [206, 17, 38]);
  rect(x + 316, y + 112, 54, 4, WHITE);
  rect(x + 316, y + 116, 54, 4, [0, 122, 61]);
}

// 3. Indonesia VP: ballot box with a vote slip, parliament dome behind.
function artVote(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, 66, [18, 90, 120]);
  rect(x, y + 66, w, h - 66, [232, 228, 214]);
  // Parliament dome silhouette, left
  rect(x + 30, y + 40, 150, 26, [120, 110, 96]);
  disc(x + 105, y + 40, 34, [150, 142, 126]);
  rect(x + 100, y + 2, 10, 10, GOLD);
  rect(x + 40, y + 50, 8, 16, [240, 240, 236]);
  rect(x + 70, y + 50, 8, 16, [240, 240, 236]);
  rect(x + 100, y + 50, 8, 16, [240, 240, 236]);
  rect(x + 130, y + 50, 8, 16, [240, 240, 236]);
  rect(x + 160, y + 50, 8, 16, [240, 240, 236]);
  // Ballot box, right
  rect(x + 260, y + 44, 170, 62, [206, 17, 38]);
  frame(x + 260, y + 44, 170, 62, [140, 10, 24], 3);
  rect(x + 300, y + 38, 90, 8, [24, 28, 34]);
  // Vote slip going into the slot
  rect(x + 318, y + 8, 54, 32, WHITE);
  frame(x + 318, y + 8, 54, 32, [120, 120, 120], 2);
  print(x + 336, y + 14, "2", 3, [206, 17, 38]);
  print(x + 300, y + 58, "MPR", 4, WHITE);
  print(x + 316, y + 90, "60 DAYS", 2, WHITE);
}

// 4. Cartagena hostages: supermarket storefront at night, police lights, "20" held.
function artHostage(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, 58, [32, 40, 62]);
  rect(x, y + 58, w, h - 58, [88, 92, 100]);
  // Storefront: big shop front with sign and glass doors
  rect(x + 40, y + 22, 280, 82, [200, 204, 210]);
  frame(x + 40, y + 22, 280, 82, [40, 44, 52], 3);
  rect(x + 40, y + 22, 280, 26, [0, 122, 61]);
  print(x + 58, y + 29, "EXITO", 3, WHITE);
  rect(x + 60, y + 56, 110, 48, [120, 170, 200]);
  rect(x + 190, y + 56, 110, 48, [120, 170, 200]);
  seg(x + 60, y + 56, x + 170, y + 104, [60, 70, 84], 2);
  seg(x + 170, y + 56, x + 60, y + 104, [60, 70, 84], 2);
  seg(x + 190, y + 56, x + 300, y + 104, [60, 70, 84], 2);
  seg(x + 300, y + 56, x + 190, y + 104, [60, 70, 84], 2);
  // Police light bar flashing on the street, right
  rect(x + 350, y + 84, 90, 12, [24, 28, 34]);
  disc(x + 366, y + 78, 10, [220, 30, 30]);
  disc(x + 424, y + 78, 10, [40, 90, 220]);
  // Hostage count plaque
  rect(x + 336, y + 16, 144, 40, [24, 28, 34]);
  frame(x + 336, y + 16, 144, 40, GOLD, 3);
  print(x + 348, y + 24, "20 HELD", 3, WHITE);
}

// 5. Boeing jets: blue sky, a white airliner climbing, "50" in the sky.
function artJets(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, 74, [110, 178, 222]);
  rect(x, y + 74, w, h - 74, [232, 228, 214]);
  // Clouds
  disc(x + 70, y + 20, 12, WHITE);
  disc(x + 88, y + 16, 14, WHITE);
  disc(x + 106, y + 20, 12, WHITE);
  disc(x + 400, y + 14, 10, WHITE);
  disc(x + 416, y + 11, 12, WHITE);
  // Airliner climbing to the right: fuselage, tail, wings
  rect(x + 90, y + 52, 260, 20, WHITE);
  tri(x + 350, y + 52, x + 392, y + 62, x + 350, y + 72, WHITE);
  rect(x + 90, y + 44, 10, 12, [0, 90, 160]);
  tri(x + 100, y + 52, x + 128, y + 26, x + 132, y + 52, [0, 90, 160]);
  tri(x + 210, y + 72, x + 250, y + 96, x + 256, y + 72, [200, 210, 220]);
  // Windows
  for (let i = 0; i < 10; i++) rect(x + 120 + i * 20, y + 58, 8, 6, [30, 60, 90]);
  // Order count in the sky, clear of the tail fin and clouds
  print(x + 36, y + 42, "50", 4, WHITE);
  // Runway line with a second jet silhouette, far right
  rect(x + 400, y + 100, 70, 6, [60, 60, 66]);
  rect(x + 410, y + 92, 50, 8, [90, 96, 104]);
  // "737-8" label on the ground
  print(x + 30, y + 88, "737-8", 3, [40, 44, 52]);
}

// 6. IAEA atom: deep blue, gold atom orbits, IAEA plaque, red protest banner.
function artAtom(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [16, 38, 84]);
  const cx = x + 250;
  const cy = y + 60;
  // Three elliptical orbits, drawn dot by dot, plus one tall orbit.
  for (const r of [46, 34, 22]) {
    for (let a = 0; a < 360; a += 3) {
      const rad = (a * Math.PI) / 180;
      put(
        Math.round(cx + r * Math.cos(rad)),
        Math.round(cy + Math.round(r * 0.55) * Math.sin(rad)),
        GOLD,
      );
    }
  }
  for (let a = 0; a < 360; a += 3) {
    const rad = (a * Math.PI) / 180;
    put(
      Math.round(cx + Math.round(46 * 0.55) * Math.cos(rad)),
      Math.round(cy + 46 * Math.sin(rad)),
      GOLD,
    );
  }
  disc(cx, cy, 12, GOLD);
  disc(cx, cy, 6, [16, 38, 84]);
  // Electrons on the orbits
  disc(cx + 46, cy, 5, WHITE);
  disc(cx - 34, cy - 20, 5, WHITE);
  disc(cx + 20, cy + 40, 5, WHITE);
  // IAEA plaque, left
  rect(x + 18, y + 16, 96, 44, WHITE);
  frame(x + 18, y + 16, 96, 44, GOLD, 3);
  print(x + 30, y + 30, "IAEA", 3, NAVY);
  // Red protest banner, bottom right
  rect(x + 328, y + 88, 152, 24, [178, 34, 34]);
  print(x + 336, y + 95, "KYIV OBJECTS", 2, WHITE);
}

// ---------------------------------------------------------------------------
// Stories: kicker band, headline, deck, and the painter for each.
// ---------------------------------------------------------------------------
interface Story {
  kicker: string;
  band: RGB;
  title: string;
  deck: string;
  art: (x: number, y: number, w: number, h: number) => void;
}

const STORIES: Story[] = [
  {
    kicker: "WAR - THE TOLL",
    band: [88, 32, 32],
    title: "700,000 RUSSIAN SOLDIERS KILLED IN UKRAINE WAR",
    deck: "NEW ANALYSIS PUTS RUSSIAN DEAD PAST 700,000 IN NEARLY FIVE YEARS OF WAR",
    art: artToll,
  },
  {
    kicker: "MIDDLE EAST - IRAQ",
    band: [122, 84, 20],
    title: "BAGHDAD ORDERS SEIZURE OF KURDISH OILFIELDS",
    deck: "IRAQ'S PM SENDS FEDERAL FORCES TO TAKE OILFIELDS IN KURDISH-RUN AREAS",
    art: artOil,
  },
  {
    kicker: "ASIA - INDONESIA",
    band: [178, 32, 32],
    title: "PRABOWO NAMES TWO VP CANDIDATES TO MPR",
    deck: "PRESIDENT SENDS TWO NAMES TO PICK GIBRAN'S SUCCESSOR; VOTE WITHIN 60 DAYS",
    art: artVote,
  },
  {
    kicker: "AMERICAS - COLOMBIA",
    band: [0, 102, 80],
    title: "GUNMEN STILL HOLD 20 HOSTAGES IN CARTAGENA",
    deck: "STANDOFF AT EXITO SUPERMARKET AFTER FAILED ARMOURED-CAR HEIST; 10 FREED",
    art: artHostage,
  },
  {
    kicker: "BUSINESS - AVIATION",
    band: [0, 90, 160],
    title: "CHINA SOUTHERN UNIT ORDERS 50 BOEING 737-8 JETS",
    deck: "XIAMEN AIRLINES SIGNS FOR 50 BOEING 737-8S IN BIG CHINA-US JET DEAL",
    art: artJets,
  },
  {
    kicker: "DIPLOMACY - NUCLEAR",
    band: [40, 53, 147],
    title: "IAEA NAMES SANCTIONED RUSSIAN AS DEPUTY CHIEF",
    deck: "UKRAINE DEMANDS REVERSAL AS AGENCY APPOINTS MOSCOW ENVOY TO TOP POST",
    art: artAtom,
  },
];

// ---------------------------------------------------------------------------
// Page furniture: masthead, strapline, 2x3 grid of story panels, footer.
// ---------------------------------------------------------------------------
function panel(x0: number, y0: number, pw: number, ph: number, s: Story): void {
  rect(x0, y0, pw, ph, PANEL);
  frame(x0, y0, pw, ph, [200, 192, 176], 2);
  // Kicker band
  rect(x0 + 2, y0 + 2, pw - 4, 30, s.band);
  print(x0 + 14, y0 + 11, s.kicker, 2, WHITE);
  // Artwork strip
  s.art(x0 + 2, y0 + 32, pw - 4, 120);
  // Headline, at most two lines
  for (const [i, ln] of splitLines(s.title, 25).slice(0, 2).entries()) {
    print(x0 + 14, y0 + 162 + i * 24, ln, 3, INK);
  }
  // Deck, at most three lines
  for (const [i, ln] of splitLines(s.deck, 38).slice(0, 3).entries()) {
    print(x0 + 14, y0 + 212 + i * 15, ln, 2, [74, 78, 84]);
  }
}

function page(): void {
  rect(0, 0, W, H, PAPER);
  // Masthead
  rect(16, 16, 992, 102, NAVY);
  frame(16, 16, 992, 102, GOLD, 3);
  printCentred(512, 32, "THE WORLD IN ONE DAY", 5, WHITE);
  printCentred(512, 80, "WEDNESDAY 25 NOVEMBER 2026", 3, GOLD);
  // Strapline
  printCentred(
    512, 130,
    "SIX STORIES THAT DEFINED THE DAY - FROM KYIV TO CARTAGENA",
    2, [90, 80, 66],
  );
  // Story grid: two columns, three rows
  const pw = 490;
  const ph = 262;
  for (let i = 0; i < STORIES.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    panel(16 + col * (pw + 12), 158 + row * (ph + 12), pw, ph, STORIES[i]);
  }
  // Footer
  printCentred(512, 978, "25 NOVEMBER 2026 - THE WORLD IN ONE IMAGE", 2, [90, 80, 66]);
}

// ---------------------------------------------------------------------------
// Entry point: paint the page, encode it, write /output/entry.png.
// ---------------------------------------------------------------------------
function main(): void {
  page();
  const png = pngBytes();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), png);
}

main();
