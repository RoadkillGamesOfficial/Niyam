// Draws desktop/assets/tray.png — a 32 px pixel sprout in the app's own palette.
// The project never fetches art at runtime, so the icon is generated once and
// committed. Re-run with: node assets/make-tray-icon.mjs

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const SIZE = 32;
const TRANSPARENT = [0, 0, 0, 0];
const LEAF = [125, 155, 78, 255]; // #7d9b4e
const LEAF_DARK = [77, 102, 48, 255]; // #4d6630
const SOIL = [107, 74, 47, 255]; // #6b4a2f

const canvas = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => TRANSPARENT));

function fill(x, y, color) {
  if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
    canvas[y][x] = color;
  }
}

function diamond(cx, cy, radius, color) {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (Math.abs(dx) + Math.abs(dy) <= radius) {
        fill(cx + dx, cy + dy, color);
      }
    }
  }
}

function rect(x0, y0, width, height, color) {
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      fill(x, y, color);
    }
  }
}

// Two leaves, a stem and a line of soil: legible at 16 px, on brand at 32.
diamond(11, 11, 4, LEAF);
diamond(21, 9, 4, LEAF);
diamond(11, 11, 1, LEAF_DARK);
diamond(21, 9, 1, LEAF_DARK);
rect(15, 13, 2, 11, LEAF_DARK);
rect(9, 25, 14, 2, SOIL);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
let offset = 0;
for (let y = 0; y < SIZE; y += 1) {
  raw[offset] = 0; // filter: none
  offset += 1;
  for (let x = 0; x < SIZE; x += 1) {
    const [r, g, b, a] = canvas[y][x];
    raw[offset] = r;
    raw[offset + 1] = g;
    raw[offset + 2] = b;
    raw[offset + 3] = a;
    offset += 4;
  }
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8; // bit depth
header[9] = 6; // RGBA

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(new URL("./tray.png", import.meta.url), png);
console.log(`wrote tray.png (${png.length} bytes, ${SIZE}x${SIZE})`);
