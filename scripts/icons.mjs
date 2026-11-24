// Generates the app icons as PNGs with a tiny software rasterizer (no dependencies).
// Design: a ringed planet with a small moon and a hopping comet on a night-sky gradient.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

/** Color of the icon at normalized coords (0..1). `pad` shrinks the art for maskable icons. */
function shade(u, v, pad) {
  let c = mix([22, 18, 64], [70, 24, 92], clamp01(v * 0.9 + u * 0.2));
  const s = 1 - pad * 2;
  const x = (u - pad) / s;
  const y = (v - pad) / s;

  const stars = [[0.15, 0.18, 0.012], [0.3, 0.1, 0.008], [0.85, 0.62, 0.01], [0.12, 0.8, 0.009], [0.58, 0.12, 0.007], [0.9, 0.9, 0.008]];
  for (const [sx, sy, sr] of stars) if (Math.hypot(x - sx, y - sy) < sr) c = [255, 255, 255];

  // tilted ring around the main planet
  const px = 0.44, py = 0.58, pr = 0.25;
  const ang = -0.38;
  const dx = x - px, dy = y - py;
  const rx = dx * Math.cos(ang) + dy * Math.sin(ang);
  const ry = -dx * Math.sin(ang) + dy * Math.cos(ang);
  const e = Math.hypot(rx / 0.4, ry / 0.1);
  const onRing = Math.abs(e - 1) < 0.09;
  const ringColor = mix([255, 214, 120], [255, 160, 90], clamp01((rx + 0.4) / 0.8));

  if (onRing && ry < 0) c = ringColor; // back half

  const d = Math.hypot(dx, dy);
  if (d < pr) {
    const light = clamp01(1 - Math.hypot(dx + pr * 0.4, dy + pr * 0.4) / (pr * 1.6));
    c = mix([196, 58, 92], [255, 150, 110], light);
    const band = Math.sin((dy / pr) * 9 + dx * 4);
    if (band > 0.75) c = mix(c, [255, 200, 160], 0.25);
  }
  if (onRing && ry >= 0) c = ringColor; // front half

  // moon
  const mx = 0.76, my = 0.25, mr = 0.085;
  if (Math.hypot(x - mx, y - my) < mr) {
    const light = clamp01(1 - Math.hypot(x - mx + mr * 0.4, y - my + mr * 0.4) / (mr * 1.6));
    c = mix([40, 150, 160], [120, 240, 210], light);
  }

  // comet hopping from planet toward moon
  const hx = 0.63, hy = 0.37;
  const tx = 0.5, ty = 0.47;
  const t = clamp01(((x - tx) * (hx - tx) + (y - ty) * (hy - ty)) / ((hx - tx) ** 2 + (hy - ty) ** 2));
  const cx = tx + (hx - tx) * t, cy = ty + (hy - ty) * t;
  const tw = 0.006 + 0.022 * t;
  if (Math.hypot(x - cx, y - cy) < tw && t > 0 && t < 1) c = mix(c, [190, 245, 255], 0.35 + 0.5 * t);
  if (Math.hypot(x - hx, y - hy) < 0.032) c = [240, 255, 255];

  return c;
}

function render(size, pad = 0) {
  const SS = 3; // supersampling for anti-aliasing
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = shade((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, pad);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const i = (py * size + px) * 4;
      const n = SS * SS;
      buf[i] = Math.round(r / n);
      buf[i + 1] = Math.round(g / n);
      buf[i + 2] = Math.round(b / n);
      buf[i + 3] = 255;
    }
  }
  return encodePNG(size, size, buf);
}

export function writeIcons(dir, { force = false } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const targets = [
    ['icon-180.png', 180, 0], // apple-touch-icon (iOS rounds the corners itself)
    ['icon-192.png', 192, 0],
    ['icon-512.png', 512, 0],
    ['icon-maskable-512.png', 512, 0.1],
  ];
  for (const [name, size, pad] of targets) {
    const file = path.join(dir, name);
    if (!force && fs.existsSync(file)) continue;
    fs.writeFileSync(file, render(size, pad));
    console.log('  icon', name);
  }
}
