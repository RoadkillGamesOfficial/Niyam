// Draws desktop/assets/icon.ico from the same pixel sprout as the tray icon, so
// the installer and the executable have a real icon and nothing is downloaded.
//   node assets/make-icon.mjs
//
// The ICO is a container of PNGs (valid since Vista), one per size Windows asks
// for. Each size is rendered from the 32 px grid with nearest-neighbour sampling,
// which keeps the pixel-art edges crisp instead of blurring them.

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const GRID = 32;
const TRANSPARENT = [0, 0, 0, 0];
const LEAF = [125, 155, 78, 255]; // #7d9b4e
const LEAF_DARK = [77, 102, 48, 255]; // #4d6630
const SOIL = [107, 74, 47, 255]; // #6b4a2f

const canvas = Array.from({ length: GRID }, () =>
  Array.from({ length: GRID }, () => TRANSPARENT),
);

function fill(x, y, color) {
  if (x >= 0 && x < GRID && y >= 0 && y < GRID) {
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

function renderPng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0; // filter: none
    offset += 1;
    const sourceY = Math.min(GRID - 1, Math.floor((y * GRID) / size));
    for (let x = 0; x < size; x += 1) {
      const sourceX = Math.min(GRID - 1, Math.floor((x * GRID) / size));
      const [r, g, b, a] = canvas[sourceY][sourceX];
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
      offset += 4;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const sizes = [256, 64, 32, 16];
const images = sizes.map((size) => ({ size, png: renderPng(size) }));

const directory = Buffer.alloc(6 + images.length * 16);
directory.writeUInt16LE(0, 0);
directory.writeUInt16LE(1, 2); // type: icon
directory.writeUInt16LE(images.length, 4);

let offset = directory.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  directory[entry] = image.size >= 256 ? 0 : image.size; // 0 means 256
  directory[entry + 1] = image.size >= 256 ? 0 : image.size;
  directory[entry + 2] = 0; // palette
  directory[entry + 3] = 0; // reserved
  directory.writeUInt16LE(1, entry + 4); // planes
  directory.writeUInt16LE(32, entry + 6); // bits per pixel
  directory.writeUInt32LE(image.png.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += image.png.length;
});

const ico = Buffer.concat([directory, ...images.map((image) => image.png)]);
writeFileSync(new URL("./icon.ico", import.meta.url), ico);
console.log(
  `wrote icon.ico (${ico.length} bytes, ${sizes.join("/")}) from the tray sprout`,
);
