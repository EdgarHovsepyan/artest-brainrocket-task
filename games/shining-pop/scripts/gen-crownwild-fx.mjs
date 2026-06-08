// Generates crown_fx.png — the GENERATED additive VFX layers for the Crown Wild
// Spine rig (glow / shineSweep / spark). Pure Node (zlib), no canvas/browser.
// These are procedural by design (the master prompt marks glow/sweep/spark as
// "generated"). Region coords are emitted for the .atlas. Run:
//   node scripts/gen-crownwild-fx.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const W = 512, H = 320;
const px = Buffer.alloc(W * H * 4, 0);
const setp = (x, y, r, g, b, a) => {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 4;
  // additive-friendly "lighten" compositing so overlapping draws don't darken
  if (a <= px[o + 3] && r <= px[o] && g <= px[o + 1] && b <= px[o + 2]) return;
  px[o] = Math.max(px[o], r); px[o + 1] = Math.max(px[o + 1], g);
  px[o + 2] = Math.max(px[o + 2], b); px[o + 3] = Math.max(px[o + 3], a);
};

// ── GLOW (0,0,256,256) — soft radial gold bloom (behind the crown) ──
const GX = 0, GY = 0, GS = 256, gc = GS / 2;
for (let y = 0; y < GS; y++) for (let x = 0; x < GS; x++) {
  const d = Math.hypot(x - gc, y - gc) / gc;        // 0..~1.41
  const a = Math.max(0, 1 - d) ** 2.2;              // soft falloff to 0 at edge
  if (a > 0.002) setp(GX + x, GY + y, 255, 205 - (d * 40 | 0), 90, (a * 255) | 0);
}

// ── SHINE SWEEP (272,0,48,256) — vertical bright bar, warm-white ──
const SX = 272, SW = 48, SH2 = 256, sc = SW / 2;
for (let y = 0; y < SH2; y++) for (let x = 0; x < SW; x++) {
  const g = Math.exp(-(((x - sc) / 9) ** 2));        // gaussian column
  const a = g * (0.55 + 0.45 * Math.sin((y / SH2) * Math.PI)); // taper top/bottom
  if (a > 0.004) setp(SX + x, y, 255, 248, 226, (a * 255) | 0);
}

// ── SPARK (336,0,80,80) — 4-point glint, white ──
const KX = 336, KY = 0, KS = 80, kc = KS / 2;
for (let y = 0; y < KS; y++) for (let x = 0; x < KS; x++) {
  const dx = (x - kc) / kc, dy = (y - kc) / kc;
  const core = Math.max(0, 1 - Math.hypot(dx, dy) * 2.4) ** 2;        // bright center
  const rayH = Math.max(0, 1 - Math.abs(dy) * 9) * Math.max(0, 1 - Math.abs(dx)) ** 1.3;
  const rayV = Math.max(0, 1 - Math.abs(dx) * 9) * Math.max(0, 1 - Math.abs(dy)) ** 1.3;
  const a = Math.min(1, core + (rayH + rayV) * 0.9);
  if (a > 0.01) setp(KX + x, KY + y, 255, 252, 240, (a * 255) | 0);
}

// ── minimal PNG encoder (8-bit RGBA) ──
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (t, d) => { const L = Buffer.alloc(4); L.writeUInt32BE(d.length, 0); const T = Buffer.from(t, 'ascii'); const C = Buffer.alloc(4); C.writeUInt32BE(crc32(Buffer.concat([T, d])), 0); return Buffer.concat([L, T, d, C]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) { raw[y * (1 + W * 4)] = 0; px.copy(raw, y * (1 + W * 4) + 1, y * W * 4, y * W * 4 + W * 4); }
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);

mkdirSync('public/spine/crownwild', { recursive: true });
writeFileSync('public/spine/crownwild/crown_fx.png', png);
console.log('[fx] wrote public/spine/crownwild/crown_fx.png', png.length, 'bytes', `(${W}x${H})`);
console.log('[fx] regions: glow 0,0,256,256 | shineSweep 272,0,48,256 | spark 336,0,80,80');
