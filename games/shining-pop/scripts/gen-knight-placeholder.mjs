// Generates a PLACEHOLDER packed texture for the knight Spine scaffold so the
// rig actually renders + animates in pixi-spine before real art exists.
// Pure Node (zlib) — no canvas/browser. Draws coloured boxes at the exact
// atlas `bounds` coords. Re-run: node scripts/gen-knight-placeholder.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const W = 256, H = 256;
const px = Buffer.alloc(W * H * 4, 0); // RGBA, transparent

function rect(x, y, w, h, r, g, b, a = 255) {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) {
      if (i < 0 || i >= W || j < 0 || j >= H) continue;
      const o = (j * W + i) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = a;
    }
}
function border(x, y, w, h, r, g, b) {
  rect(x, y, w, 2, r, g, b); rect(x, y + h - 2, w, 2, r, g, b);
  rect(x, y, 2, h, r, g, b); rect(x + w - 2, y, 2, h, r, g, b);
}

// regions — MUST match the bounds in knight.atlas
rect(2, 2, 56, 60, 235, 200, 170);   border(2, 2, 56, 60, 120, 90, 60);       // head   (skin)
rect(2, 66, 72, 96, 80, 120, 210);   border(2, 66, 72, 96, 40, 60, 140);      // torso  (blue armour)
rect(80, 2, 26, 120, 200, 205, 215); border(80, 2, 26, 120, 120, 125, 140);   // sword  (steel)
rect(112, 2, 48, 54, 188, 146, 74);  border(112, 2, 48, 54, 110, 80, 30);     // shield (bronze)

// ── minimal PNG encoder (8-bit RGBA, filter 0) ──
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
};
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; // bitdepth 8, colortype 6 (RGBA)
const raw = Buffer.alloc(H * (1 + W * 4));
for (let j = 0; j < H; j++) { raw[j * (1 + W * 4)] = 0; px.copy(raw, j * (1 + W * 4) + 1, j * W * 4, j * W * 4 + W * 4); }
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);

mkdirSync('public/spine', { recursive: true });
writeFileSync('public/spine/knight.png', png);
console.log('[gen] wrote public/spine/knight.png', png.length, 'bytes');
