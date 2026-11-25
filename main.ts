// news-image-20261125 — "The World in One Day"
// A program that draws one 1024x1024 newspaper front page summing up the
// world news of Wednesday 25 November 2026 and writes it to /output/entry.png.
// Node 22, standard library only, no network, fully deterministic:
// the same bytes on every run.
//
// The six stories (all first reported on 25 November 2026):
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
const px = new Uint8Array(W * H * 4);

type RGB = [number, number, number];

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
  px[i + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 4;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = 255;
    }
  }
}

function outlineRect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
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

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) setPixel(cx + x, cy + y, c);
  }
}

function fillTriangle(
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number,
  c: RGB,
): void {
  const sign = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
    (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
  const minX = Math.max(0, Math.min(x0, x1, x2));
  const maxX = Math.min(W - 1, Math.max(x0, x1, x2));
  const minY = Math.max(0, Math.min(y0, y1, y2));
  const maxY = Math.min(H - 1, Math.max(y0, y1, y2));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d0 = sign(x, y, x0, y0, x1, y1);
      const d1 = sign(x, y, x1, y1, x2, y2);
      const d2 = sign(x, y, x2, y2, x0, y0);
      const neg = d0 < 0 || d1 < 0 || d2 < 0;
      const pos = d0 > 0 || d1 > 0 || d2 > 0;
      if (!(neg && pos)) setPixel(x, y, c);
    }
  }
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font (uppercase + digits + punctuation), drawn scaled.
// Each glyph is 7 rows of 5 cells; '#' is ink.
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: [" ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  B: ["#### ", "#   #", "#   #", "#### ", "#   #", "#   #", "#### "],
  C: [" ### ", "#   #", "#    ", "#    ", "#    ", "#   #", " ### "],
  D: ["#### ", "#   #", "#   #", "#   #", "#   #", "#   #", "#### "],
  E: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"],
  F: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#    "],
  G: [" ### ", "#   #", "#    ", "#  ##", "#   #", "#   #", " ### "],
  H: ["#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  I: [" ### ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
  J: ["  ###", "   # ", "   # ", "   # ", "   # ", "#  # ", " ##  "],
  K: ["#   #", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #"],
  L: ["#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####"],
  M: ["#   #", "## ##", "# # #", "# # #", "#   #", "#   #", "#   #"],
  N: ["#   #", "##  #", "##  #", "# # #", "#  ##", "#  ##", "#   #"],
  O: [" ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  P: ["#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
  Q: [" ### ", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #"],
  R: ["#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #"],
  S: [" ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "],
  T: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  U: ["#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  V: ["#   #", "#   #", "#   #", "#   #", "#   #", " # # ", "  #  "],
  W: ["#   #", "#   #", "#   #", "# # #", "# # #", "## ##", "#   #"],
  X: ["#   #", "#   #", " # # ", "  #  ", " # # ", "#   #", "#   #"],
  Y: ["#   #", "#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  "],
  Z: ["#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"],
  "0": [" ### ", "#  ##", "# # #", "# # #", "##  #", "#   #", " ### "],
  "1": ["  #  ", " ##  ", "# #  ", "  #  ", "  #  ", "  #  ", " ### "],
  "2": [" ### ", "#   #", "    #", "   # ", "  #  ", " #   ", "#####"],
  "3": ["#### ", "    #", "    #", " ### ", "    #", "    #", "#### "],
  "4": ["   # ", "  ## ", " # # ", "#  # ", "#####", "   # ", "   # "],
  "5": ["#####", "#    ", "#### ", "    #", "    #", "#   #", " ### "],
  "6": [" ### ", "#    ", "#    ", "#### ", "#   #", "#   #", " ### "],
  "7": ["#####", "    #", "   # ", "   # ", "  #  ", "  #  ", "  #  "],
  "8": [" ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### "],
  "9": [" ### ", "#   #", "#   #", " ####", "    #", "    #", " ### "],
  " ": ["     ", "     ", "     ", "     ", "     ", "     ", "     "],
  ".": ["     ", "     ", "     ", "     ", "     ", " ##  ", " ##  "],
  ",": ["     ", "     ", "     ", "     ", " ##  ", " ##  ", " #   "],
  ":": ["     ", " ##  ", " ##  ", "     ", " ##  ", " ##  ", "     "],
  ";": ["     ", " ##  ", " ##  ", "     ", " ##  ", " ##  ", " #   "],
  "!": ["  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "     ", "  #  "],
  "?": [" ### ", "#   #", "    #", "   # ", "  #  ", "     ", "  #  "],
  "'": ["  #  ", "  #  ", " #   ", "     ", "     ", "     ", "     "],
  "-": ["     ", "     ", "     ", " ### ", "     ", "     ", "     "],
  "(": ["   # ", "  #  ", " #   ", " #   ", " #   ", "  #  ", "   # "],
  ")": [" #   ", "  #  ", "   # ", "   # ", "   # ", "  #  ", " #   "],
  "/": ["    #", "    #", "   # ", "  #  ", " #   ", "#    ", "#    "],
  "&": [" ##  ", "#  # ", "#  # ", " #   ", "# # #", "#  # ", " ## #"],
  "%": ["#   #", "#  # ", "   # ", "  #  ", " #   ", "#  # ", "#   #"],
  "+": ["     ", "  #  ", "  #  ", "#####", "  #  ", "  #  ", "     "],
  "=": ["     ", "     ", "#####", "     ", "#####", "     ", "     "],
  '"': [" # # ", " # # ", " # # ", "     ", "     ", "     ", "     "],
  "\u2022": ["     ", "     ", " ### ", " ### ", " ### ", "     ", "     "],
};

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawText(x: number, y: number, text: string, scale: number, c: RGB): void {
  const upper = text.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const glyph = FONT[upper[i]] ?? FONT["?"];
    const gx = x + i * 6 * scale;
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === "#") {
          fillRect(gx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
  }
}

function drawTextCentered(cx: number, y: number, text: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(text, scale) / 2), y, text, scale, c);
}

// Greedy word wrap to a maximum character count per line.
function wrap(text: string, maxChars: number): string[] {
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
// PNG encoder (truecolour, no filter) — CRC32 + zlib, stdlib only.
// ---------------------------------------------------------------------------
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------
const PAPER: RGB = [247, 243, 234];
const INK: RGB = [24, 28, 34];
const NAVY: RGB = [14, 42, 71];
const GOLD: RGB = [242, 193, 78];
const WHITE: RGB = [255, 255, 255];
const PANEL: RGB = [255, 255, 255];

// ---------------------------------------------------------------------------
// Story illustrations. Each draws inside rect (x, y, w=490, h=120).
// ---------------------------------------------------------------------------

// 1. War toll: dark battlefield sky, rows of white crosses, big "700,000".
function drawToll(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, 52, [58, 64, 74]);
  fillRect(x, y + 52, w, h - 52, [38, 42, 48]);
  // Pale sun low on the horizon
  fillCircle(x + 430, y + 30, 16, [232, 214, 170]);
  // Distant smoke columns
  fillCircle(x + 90, y + 22, 10, [120, 118, 112]);
  fillCircle(x + 112, y + 14, 12, [136, 134, 128]);
  fillCircle(x + 300, y + 18, 9, [120, 118, 112]);
  // Rows of white memorial crosses on the dark ground
  const cross = (cx: number, cy: number, s: number): void => {
    fillRect(cx - s, cy - 3 * s, 2 * s, 6 * s, [228, 228, 222]);
    fillRect(cx - 3 * s, cy - 2 * s, 6 * s, 2 * s, [228, 228, 222]);
  };
  for (let i = 0; i < 7; i++) cross(x + 30 + i * 26, y + 84, 3);
  for (let i = 0; i < 6; i++) cross(x + 44 + i * 26, y + 104, 3);
  // Big toll figure on a dark plaque, right side
  fillRect(x + 250, y + 56, 222, 56, [24, 28, 34]);
  outlineRect(x + 250, y + 56, 222, 56, GOLD, 3);
  drawText(x + 262, y + 64, "700,000", 4, WHITE);
  drawText(x + 262, y + 94, "KILLED", 2, GOLD);
}

// 2. Iraq oilfields: desert dusk, pumpjack and derrick, oil barrel.
function drawOil(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, 62, [233, 196, 130]);
  fillRect(x, y + 62, w, h - 62, [164, 122, 62]);
  fillCircle(x + 420, y + 26, 18, [240, 150, 50]);
  // Derrick, left
  line(x + 60, y + 110, x + 84, y + 30, [60, 48, 36], 4);
  line(x + 108, y + 110, x + 84, y + 30, [60, 48, 36], 4);
  line(x + 66, y + 88, x + 102, y + 88, [60, 48, 36], 3);
  line(x + 72, y + 64, x + 96, y + 64, [60, 48, 36], 3);
  fillRect(x + 76, y + 18, 16, 12, [60, 48, 36]);
  // Pumpjack, centre-right
  fillRect(x + 200, y + 78, 90, 10, [40, 40, 44]);
  line(x + 214, y + 88, x + 214, y + 112, [40, 40, 44], 5);
  line(x + 276, y + 88, x + 276, y + 112, [40, 40, 44], 5);
  line(x + 200, y + 78, x + 290, y + 52, [40, 40, 44], 5);
  fillCircle(x + 292, y + 50, 9, [40, 40, 44]);
  line(x + 292, y + 58, x + 292, y + 96, [40, 40, 44], 3);
  fillRect(x + 286, y + 96, 12, 12, [40, 40, 44]);
  // Oil barrel, right
  fillRect(x + 380, y + 76, 56, 36, [24, 28, 34]);
  fillRect(x + 380, y + 86, 56, 4, [90, 90, 96]);
  fillRect(x + 380, y + 100, 56, 4, [90, 90, 96]);
  drawText(x + 394, y + 86, "OIL", 2, GOLD);
  // Iraqi flag strip on the ground line
  fillRect(x + 316, y + 108, 54, 4, [206, 17, 38]);
  fillRect(x + 316, y + 112, 54, 4, WHITE);
  fillRect(x + 316, y + 116, 54, 4, [0, 122, 61]);
}

// 3. Indonesia VP: ballot box with a vote slip, parliament dome behind.
function drawVote(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, 66, [18, 90, 120]);
  fillRect(x, y + 66, w, h - 66, [232, 228, 214]);
  // Parliament dome silhouette, left
  fillRect(x + 30, y + 40, 150, 26, [120, 110, 96]);
  fillCircle(x + 105, y + 40, 34, [150, 142, 126]);
  fillRect(x + 100, y + 2, 10, 10, GOLD);
  fillRect(x + 40, y + 50, 8, 16, [240, 240, 236]);
  fillRect(x + 70, y + 50, 8, 16, [240, 240, 236]);
  fillRect(x + 100, y + 50, 8, 16, [240, 240, 236]);
  fillRect(x + 130, y + 50, 8, 16, [240, 240, 236]);
  fillRect(x + 160, y + 50, 8, 16, [240, 240, 236]);
  // Ballot box, right
  fillRect(x + 260, y + 44, 170, 62, [206, 17, 38]);
  outlineRect(x + 260, y + 44, 170, 62, [140, 10, 24], 3);
  fillRect(x + 300, y + 38, 90, 8, [24, 28, 34]);
  // Vote slip going into the slot
  fillRect(x + 318, y + 8, 54, 32, WHITE);
  outlineRect(x + 318, y + 8, 54, 32, [120, 120, 120], 2);
  drawText(x + 336, y + 14, "2", 3, [206, 17, 38]);
  drawText(x + 300, y + 58, "MPR", 4, WHITE);
  drawText(x + 316, y + 90, "60 DAYS", 2, WHITE);
}

// 4. Cartagena hostages: supermarket storefront at night, police lights, "20" held.
function drawHostage(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, 58, [32, 40, 62]);
  fillRect(x, y + 58, w, h - 58, [88, 92, 100]);
  // Storefront: big shop front with sign and glass doors
  fillRect(x + 40, y + 22, 280, 82, [200, 204, 210]);
  outlineRect(x + 40, y + 22, 280, 82, [40, 44, 52], 3);
  fillRect(x + 40, y + 22, 280, 26, [0, 122, 61]);
  drawText(x + 58, y + 29, "EXITO", 3, WHITE);
  fillRect(x + 60, y + 56, 110, 48, [120, 170, 200]);
  fillRect(x + 190, y + 56, 110, 48, [120, 170, 200]);
  line(x + 60, y + 56, x + 170, y + 104, [60, 70, 84], 2);
  line(x + 170, y + 56, x + 60, y + 104, [60, 70, 84], 2);
  line(x + 190, y + 56, x + 300, y + 104, [60, 70, 84], 2);
  line(x + 300, y + 56, x + 190, y + 104, [60, 70, 84], 2);
  // Police light bar flashing on the street, right
  fillRect(x + 350, y + 84, 90, 12, [24, 28, 34]);
  fillCircle(x + 366, y + 78, 10, [220, 30, 30]);
  fillCircle(x + 424, y + 78, 10, [40, 90, 220]);
  // Hostage count plaque
  fillRect(x + 336, y + 16, 144, 40, [24, 28, 34]);
  outlineRect(x + 336, y + 16, 144, 40, GOLD, 3);
  drawText(x + 348, y + 24, "20 HELD", 3, WHITE);
}

// 5. Boeing jets: blue sky, a white airliner climbing, "50" on the tail.
function drawJets(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, 74, [110, 178, 222]);
  fillRect(x, y + 74, w, h - 74, [232, 228, 214]);
  // Clouds
  fillCircle(x + 70, y + 20, 12, WHITE);
  fillCircle(x + 88, y + 16, 14, WHITE);
  fillCircle(x + 106, y + 20, 12, WHITE);
  fillCircle(x + 400, y + 14, 10, WHITE);
  fillCircle(x + 416, y + 11, 12, WHITE);
  // Airliner climbing to the right: fuselage, tail, wings
  fillRect(x + 90, y + 52, 260, 20, WHITE);
  fillTriangle(x + 350, y + 52, x + 392, y + 62, x + 350, y + 72, WHITE);
  fillRect(x + 90, y + 44, 10, 12, [0, 90, 160]);
  fillTriangle(x + 100, y + 52, x + 128, y + 26, x + 132, y + 52, [0, 90, 160]);
  fillTriangle(x + 210, y + 72, x + 250, y + 96, x + 256, y + 72, [200, 210, 220]);
  // Windows
  for (let i = 0; i < 10; i++) fillRect(x + 120 + i * 20, y + 58, 8, 6, [30, 60, 90]);
  // Order count in the sky, clear of the tail fin and clouds
  drawText(x + 36, y + 42, "50", 4, WHITE);
  // Runway line with a second jet silhouette, far right
  fillRect(x + 400, y + 100, 70, 6, [60, 60, 66]);
  fillRect(x + 410, y + 92, 50, 8, [90, 96, 104]);
  // "737-8" label on the ground
  drawText(x + 30, y + 88, "737-8", 3, [40, 44, 52]);
}

// 6. IAEA atom: deep blue, gold atom orbits, IAEA plaque, red protest banner.
function drawAtom(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [16, 38, 84]);
  const cx = x + 250;
  const cy = y + 60;
  // Three elliptical orbits, drawn as rings tilted by hand: use circles of
  // different radii plus spokes to suggest the atom symbol.
  for (const r of [46, 34, 22]) {
    for (let a = 0; a < 360; a += 3) {
      const rad = (a * Math.PI) / 180;
      setPixel(
        Math.round(cx + r * Math.cos(rad)),
        Math.round(cy + Math.round(r * 0.55) * Math.sin(rad)),
        GOLD,
      );
    }
  }
  for (let a = 0; a < 360; a += 3) {
    const rad = (a * Math.PI) / 180;
    setPixel(
      Math.round(cx + Math.round(46 * 0.55) * Math.cos(rad)),
      Math.round(cy + 46 * Math.sin(rad)),
      GOLD,
    );
  }
  fillCircle(cx, cy, 12, GOLD);
  fillCircle(cx, cy, 6, [16, 38, 84]);
  // Electrons on the orbits
  fillCircle(cx + 46, cy, 5, WHITE);
  fillCircle(cx - 34, cy - 20, 5, WHITE);
  fillCircle(cx + 20, cy + 40, 5, WHITE);
  // IAEA plaque, left
  fillRect(x + 18, y + 16, 96, 44, WHITE);
  outlineRect(x + 18, y + 16, 96, 44, GOLD, 3);
  drawText(x + 30, y + 30, "IAEA", 3, NAVY);
  // Red protest banner, bottom right
  fillRect(x + 328, y + 88, 152, 24, [178, 34, 34]);
  drawText(x + 336, y + 95, "KYIV OBJECTS", 2, WHITE);
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------
interface Story {
  kicker: string;
  header: RGB;
  headline: string;
  summary: string;
  draw: (x: number, y: number, w: number, h: number) => void;
}

const STORIES: Story[] = [
  {
    kicker: "WAR - THE TOLL",
    header: [88, 32, 32],
    headline: "700,000 RUSSIAN SOLDIERS KILLED IN UKRAINE WAR",
    summary:
      "NEW ANALYSIS PUTS RUSSIAN DEAD PAST 700,000 IN NEARLY FIVE YEARS OF WAR",
    draw: drawToll,
  },
  {
    kicker: "MIDDLE EAST - IRAQ",
    header: [122, 84, 20],
    headline: "BAGHDAD ORDERS SEIZURE OF KURDISH OILFIELDS",
    summary:
      "IRAQ'S PM SENDS FEDERAL FORCES TO TAKE OILFIELDS IN KURDISH-RUN AREAS",
    draw: drawOil,
  },
  {
    kicker: "ASIA - INDONESIA",
    header: [178, 32, 32],
    headline: "PRABOWO NAMES TWO VP CANDIDATES TO MPR",
    summary:
      "PRESIDENT SENDS TWO NAMES TO PICK GIBRAN'S SUCCESSOR; VOTE WITHIN 60 DAYS",
    draw: drawVote,
  },
  {
    kicker: "AMERICAS - COLOMBIA",
    header: [0, 102, 80],
    headline: "GUNMEN STILL HOLD 20 HOSTAGES IN CARTAGENA",
    summary:
      "STANDOFF AT EXITO SUPERMARKET AFTER FAILED ARMOURED-CAR HEIST; 10 FREED",
    draw: drawHostage,
  },
  {
    kicker: "BUSINESS - AVIATION",
    header: [0, 90, 160],
    headline: "CHINA SOUTHERN UNIT ORDERS 50 BOEING 737-8 JETS",
    summary:
      "XIAMEN AIRLINES SIGNS FOR 50 BOEING 737-8S IN BIG CHINA-US JET DEAL",
    draw: drawJets,
  },
  {
    kicker: "DIPLOMACY - NUCLEAR",
    header: [40, 53, 147],
    headline: "IAEA NAMES SANCTIONED RUSSIAN AS DEPUTY CHIEF",
    summary:
      "UKRAINE DEMANDS REVERSAL AS AGENCY APPOINTS MOSCOW ENVOY TO TOP POST",
    draw: drawAtom,
  },
];

// ---------------------------------------------------------------------------
// Layout: masthead, strapline, 2x3 grid of story panels, footer.
// ---------------------------------------------------------------------------
function drawPanel(px0: number, py0: number, pw: number, ph: number, s: Story): void {
  fillRect(px0, py0, pw, ph, PANEL);
  outlineRect(px0, py0, pw, ph, [200, 192, 176], 2);
  // Kicker strip
  fillRect(px0 + 2, py0 + 2, pw - 4, 30, s.header);
  drawText(px0 + 14, py0 + 11, s.kicker, 2, WHITE);
  // Illustration
  s.draw(px0 + 2, py0 + 32, pw - 4, 120);
  // Headline, up to 2 lines
  const headLines = wrap(s.headline, 25).slice(0, 2);
  headLines.forEach((ln, i) => {
    drawText(px0 + 14, py0 + 162 + i * 24, ln, 3, INK);
  });
  // Summary, up to 3 lines
  const sumLines = wrap(s.summary, 38).slice(0, 3);
  sumLines.forEach((ln, i) => {
    drawText(px0 + 14, py0 + 212 + i * 15, ln, 2, [74, 78, 84]);
  });
}

function drawPage(): void {
  fillRect(0, 0, W, H, PAPER);
  // Masthead
  fillRect(16, 16, 992, 102, NAVY);
  outlineRect(16, 16, 992, 102, GOLD, 3);
  drawTextCentered(512, 32, "THE WORLD IN ONE DAY", 5, WHITE);
  drawTextCentered(512, 80, "WEDNESDAY 25 NOVEMBER 2026", 3, GOLD);
  // Strapline
  drawTextCentered(
    512, 130,
    "SIX STORIES THAT DEFINED THE DAY - FROM KYIV TO CARTAGENA",
    2, [90, 80, 66],
  );
  // Grid
  const pw = 490;
  const ph = 262;
  const gapX = 12;
  const gapY = 12;
  const x0 = 16;
  const y0 = 158;
  STORIES.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    drawPanel(x0 + col * (pw + gapX), y0 + row * (ph + gapY), pw, ph, s);
  });
  // Footer
  drawTextCentered(512, 978, "25 NOVEMBER 2026 - THE WORLD IN ONE IMAGE", 2, [90, 80, 66]);
}

// ---------------------------------------------------------------------------
// Entry point: draw, encode, write /output/entry.png (deterministic).
// ---------------------------------------------------------------------------
function main(): void {
  drawPage();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), png);
}

main();
