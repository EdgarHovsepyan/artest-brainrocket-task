// ─────────────────────────────────────────────────────────────────────────────
// gen-audio.mjs — procedural audio generator for SHINING POP (zero AI key needed)
//
// Synthesizes the full SFX + music bank with a hand-rolled DSP toolkit (oscillators,
// FM bells, filtered-noise sweeps, sub-hits, ADSR) and writes web-ready assets to
// public/assets/audio/. Theme: dark-glam candy-crystal noir (magenta neon, glassy gems).
//
//   • one-shots  → MP3 (compressed, tiny; gapless-seam irrelevant)
//   • loops      → WAV (seamless; MP3 encoder delay breaks gapless looping)
//   • manifest.json lists every clip {id, file, ms, peak, loop} for engine wiring.
//
// Run:  node scripts/gen-audio.mjs           (free, offline, deterministic)
// Compress loops later with ffmpeg→opus when available; recipes are the source of truth.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as lameNS from '@breezystack/lamejs';

const lame = lameNS.default ?? lameNS;
const Mp3Encoder = lame.Mp3Encoder ?? lame.default?.Mp3Encoder;

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'audio');
mkdirSync(OUT, { recursive: true });

// ── DSP toolkit ──────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
const buf  = (sec) => new Float32Array(Math.max(1, Math.round(sec * SR)));
const hz   = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const sine = (ph) => Math.sin(ph * TAU);
const saw  = (ph) => 2 * (ph - Math.floor(ph + 0.5));
const sqr  = (ph, duty = 0.5) => ((ph - Math.floor(ph)) < duty ? 1 : -1);
const tri  = (ph) => { const x = ph - Math.floor(ph); return x < 0.5 ? 4 * x - 1 : 3 - 4 * x; };
let _ns = 0x5c0ffee;
const noise = () => { _ns = (_ns * 1664525 + 1013904223) & 0x7fffffff; return (_ns / 0x40000000) - 1; };
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
// attack/decay envelope (seconds), exp-ish curves
const ar = (t, a, d, curve = 2.2) => t < a ? Math.pow(clamp01(t / a), 0.6) : Math.pow(clamp01(1 - (t - a) / d), curve);
const expdec = (t, k) => Math.exp(-t * k);
const onePoleLP = (cut) => { let y = 0; const a = Math.exp(-TAU * cut / SR); return (x) => (y = (1 - a) * x + a * y); };
const onePoleHP = (cut) => { let y = 0, xp = 0; const a = Math.exp(-TAU * cut / SR); return (x) => { y = a * (y + x - xp); xp = x; return y; }; };
const delay = (sec, fb, mix) => { const n = Math.max(1, Math.round(sec * SR)); const d = new Float32Array(n); let i = 0; return (x) => { const o = d[i]; d[i] = x + o * fb; i = (i + 1) % n; return x * (1 - mix) + o * mix; }; };
const tanh = Math.tanh;

// FM bell partial — glassy crystalline tone
function bell(out, freq, t0, dur, { mod = 2.01, idx = 4, k = 9, gain = 1 } = {}) {
  const N = out.length, s0 = Math.round(t0 * SR), s1 = Math.min(N, Math.round((t0 + dur) * SR));
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR, e = expdec(t, k);
    const m = idx * e * sine(freq * mod * t);
    out[i] += gain * e * Math.sin(freq * t * TAU + m);
  }
}
// pitched sub / body hit
function subhit(out, t0, dur, f0, f1, { k = 7, gain = 1, wave = sine } = {}) {
  const N = out.length, s0 = Math.round(t0 * SR), s1 = Math.min(N, Math.round((t0 + dur) * SR));
  let ph = 0;
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR, p = t / dur, f = f0 + (f1 - f0) * p;
    ph += f / SR; out[i] += gain * expdec(t, k) * wave(ph);
  }
}
// filtered-noise whoosh / riser
function whoosh(out, t0, dur, { cut0 = 600, cut1 = 6000, a = 0.15, d = 0.85, gain = 0.5, hp = 300 } = {}) {
  const N = out.length, s0 = Math.round(t0 * SR), s1 = Math.min(N, Math.round((t0 + dur) * SR));
  const H = onePoleHP(hp); let lpY = 0;
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR, p = t / dur;
    const cut = cut0 * Math.pow(cut1 / cut0, p), aco = Math.exp(-TAU * cut / SR);
    let x = H(noise()); lpY = (1 - aco) * x + aco * lpY;
    out[i] += gain * ar(t, a * dur, d * dur, 1.6) * lpY;
  }
}
// crystalline arpeggio note (saw+sine, soft)
function pluck(out, freq, t0, dur, { gain = 0.5, k = 6, det = 0.004 } = {}) {
  const N = out.length, s0 = Math.round(t0 * SR), s1 = Math.min(N, Math.round((t0 + dur) * SR));
  const lp = onePoleLP(4200);
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR, e = expdec(t, k);
    const s = 0.6 * saw(freq * (1 + det) * t) + 0.4 * sine(freq * t);
    out[i] += gain * e * lp(s);
  }
}

// finalize: normalize → soft-limit → fade (one-shots) or seal (loops)
function finish(out, { loop = false, peak = 0.92, fadeMs = 4 } = {}) {
  let mx = 1e-9; for (let i = 0; i < out.length; i++) mx = Math.max(mx, Math.abs(out[i]));
  const g = peak / mx;
  for (let i = 0; i < out.length; i++) out[i] = tanh(out[i] * g * 1.08);
  if (loop) {
    const K = Math.min(out.length >> 2, Math.round(0.008 * SR)); // 8ms equal-power wrap
    for (let i = 0; i < K; i++) { const w = i / K; out[i] = out[i] * w + out[out.length - K + i] * (1 - w); }
    return out.subarray(0, out.length - K);
  }
  const F = Math.round(fadeMs * SR / 1000);
  for (let i = 0; i < F; i++) { const w = i / F; out[i] *= w; out[out.length - 1 - i] *= w; }
  return out;
}

// ── encoders ─────────────────────────────────────────────────────────────────
function toMp3(f32, kbps = 112) {
  const enc = new Mp3Encoder(1, SR, kbps), i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) { const s = Math.max(-1, Math.min(1, f32[i])); i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
  const out = []; for (let i = 0; i < i16.length; i += 1152) { const c = enc.encodeBuffer(i16.subarray(i, i + 1152)); if (c.length) out.push(Buffer.from(c)); }
  const end = enc.flush(); if (end.length) out.push(Buffer.from(end)); return Buffer.concat(out);
}
function toWav(f32) {
  const n = f32.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, f32[i])); b.writeInt16LE((s < 0 ? s * 0x8000 : s * 0x7fff) | 0, 44 + i * 2); }
  return b;
}

// chords (dark / magenta-villain): D minor add9 family
const Dm   = [50, 53, 57, 62].map(hz);     // D F A D
const Dm9  = [50, 57, 60, 65, 69].map(hz); // D A C(add) F G-ish shimmer
const ARP  = [62, 65, 69, 74, 69, 65].map(hz);

// ── recipes ──────────────────────────────────────────────────────────────────
const R = {};
const one = (id, sec, gen, kbps = 112) => R[id] = { loop: false, fmt: 'mp3', kbps, sec, gen };
const lp  = (id, sec, gen) => R[id] = { loop: true, fmt: 'wav', sec, gen };

// — UI —
one('ui_click', 0.12, () => { const o = buf(0.12); bell(o, 1760, 0, 0.1, { mod: 3.0, idx: 2.4, k: 30, gain: 0.9 }); for (let i = 0; i < 90; i++) o[i] += noise() * 0.5 * (1 - i / 90); return finish(o); }, 96);
one('ui_bet', 0.1, () => { const o = buf(0.1); bell(o, 2640, 0, 0.08, { mod: 2.0, idx: 1.6, k: 40, gain: 0.9 }); return finish(o); }, 96);
one('ui_modal_open', 0.7, () => { const o = buf(0.7); whoosh(o, 0, 0.55, { cut0: 500, cut1: 5200, gain: 0.5 }); bell(o, hz(74), 0.18, 0.5, { mod: 2.01, idx: 3, k: 5, gain: 0.5 }); return finish(o); });
one('ui_modal_close', 0.55, () => { const o = buf(0.55); whoosh(o, 0, 0.5, { cut0: 4800, cut1: 600, gain: 0.5 }); return finish(o); });

// — Reels —
one('spin_start', 0.6, () => { const o = buf(0.6); whoosh(o, 0, 0.5, { cut0: 700, cut1: 5200, gain: 0.55, hp: 200 }); subhit(o, 0, 0.5, hz(45), hz(57), { k: 4, gain: 0.4 }); return finish(o); });
lp('reel_loop', 2.0, () => { const o = buf(2.0); const lpF = onePoleLP(2600), H = onePoleHP(220); for (let i = 0; i < o.length; i++) { const t = i / SR; let s = H(noise()) * 0.5; s += 0.15 * sine(110 * t) * (0.7 + 0.3 * sine(7 * t)); o[i] = lpF(s); } return finish(o, { loop: true }); });
one('reel_stop', 0.34, () => { const o = buf(0.34); subhit(o, 0, 0.18, hz(57), hz(45), { k: 22, gain: 0.9 }); bell(o, 1320, 0, 0.16, { mod: 2.4, idx: 2, k: 26, gain: 0.5 }); for (let i = 0; i < 70; i++) o[i] += noise() * 0.4 * (1 - i / 70); return finish(o); }, 96);
one('turbo_stop', 0.3, () => { const o = buf(0.3); subhit(o, 0, 0.16, hz(60), hz(43), { k: 26, gain: 1 }); for (let i = 0; i < 50; i++) o[i] += noise() * 0.5 * (1 - i / 50); return finish(o); }, 96);

// — Anticipation —
one('scatter_tick', 0.6, () => { const o = buf(0.6); bell(o, hz(86), 0, 0.5, { mod: 2.01, idx: 5, k: 7, gain: 0.9 }); bell(o, hz(93), 0.04, 0.45, { mod: 3.0, idx: 3, k: 8, gain: 0.4 }); return finish(o); }, 112);
one('anticipation', 2.6, () => { const o = buf(2.6); whoosh(o, 0, 2.5, { cut0: 400, cut1: 7000, a: 0.4, d: 0.6, gain: 0.4, hp: 250 }); subhit(o, 0, 2.5, hz(33), hz(40), { k: 0.7, gain: 0.5 }); const D = delay(0.12, 0.5, 0.3); for (let i = 0; i < o.length; i++) { const t = i / SR; o[i] += D(0.18 * sine((1400 + 1800 * (t / 2.5)) * t) * (t / 2.5)); } return finish(o); });
one('near_miss', 0.8, () => { const o = buf(0.8); subhit(o, 0, 0.7, hz(57), hz(46), { k: 3, gain: 0.5, wave: tri }); whoosh(o, 0, 0.7, { cut0: 3000, cut1: 500, gain: 0.3 }); return finish(o); });

// — Wins (stings) —
const winSting = (sec, root, idx, k, voices) => () => { const o = buf(sec); voices.forEach((n, j) => bell(o, hz(root + n), j * 0.018, sec - j * 0.02, { mod: 2.01, idx, k, gain: 0.8 / Math.sqrt(voices.length) })); const D = delay(0.16, 0.35, 0.25); for (let i = 0; i < o.length; i++) o[i] = o[i] + D(o[i]) * 0.5; return finish(o); };
one('win_small', 0.8, winSting(0.8, 74, 3, 7, [0, 7]));
one('win_nice', 1.2, winSting(1.2, 74, 4, 5.5, [0, 7, 12]));
one('win_big', 1.7, () => { const o = buf(1.7); [0, 7, 12, 16].forEach((n, j) => bell(o, hz(62 + n), j * 0.04, 1.6, { mod: 2.01, idx: 5, k: 3.4, gain: 0.5 })); subhit(o, 0, 0.5, hz(38), hz(38), { k: 5, gain: 0.5 }); whoosh(o, 0, 0.4, { cut0: 800, cut1: 6000, gain: 0.3 }); return finish(o); });
one('win_mega', 2.1, () => { const o = buf(2.1); [0, 7, 12, 16, 19].forEach((n, j) => bell(o, hz(62 + n), j * 0.05, 2.0, { mod: 2.01, idx: 6, k: 2.8, gain: 0.45 })); subhit(o, 0, 0.6, hz(36), hz(43), { k: 4, gain: 0.6 }); whoosh(o, 0.02, 0.6, { cut0: 700, cut1: 8000, gain: 0.35 }); return finish(o); });
one('win_epic', 2.6, () => { const o = buf(2.6); subhit(o, 0, 0.8, hz(31), hz(38), { k: 2.4, gain: 0.8 }); whoosh(o, 0, 0.7, { cut0: 600, cut1: 9000, gain: 0.5 }); [0, 7, 12, 16, 19, 24].forEach((n, j) => bell(o, hz(62 + n), 0.1 + j * 0.06, 2.4 - j * 0.05, { mod: 2.0, idx: 7, k: 2.2, gain: 0.4 })); const D = delay(0.18, 0.45, 0.3); for (let i = 0; i < o.length; i++) o[i] += D(o[i]) * 0.4; return finish(o); });
lp('coin_cascade', 2.0, () => { const o = buf(2.0); for (let g = 0; g < 60; g++) { const t0 = (g * 0.137) % 1.9, f = hz(80 + (g * 7) % 24); bell(o, f, t0, 0.18, { mod: 3.0, idx: 3, k: 24, gain: 0.5 }); } return finish(o, { loop: true }); });
one('tally_pip', 0.09, () => { const o = buf(0.09); bell(o, 2200, 0, 0.08, { mod: 2, idx: 1.2, k: 45, gain: 0.9 }); return finish(o); }, 64);

// — Wild / Feature —
one('wild_land', 0.9, () => { const o = buf(0.9); bell(o, hz(69), 0, 0.85, { mod: 1.5, idx: 5, k: 4.5, gain: 0.7 }); bell(o, hz(76), 0.05, 0.8, { mod: 2.01, idx: 4, k: 6, gain: 0.45 }); subhit(o, 0, 0.3, hz(45), hz(45), { k: 9, gain: 0.4 }); return finish(o); });
one('wild_expand', 1.2, () => { const o = buf(1.2); whoosh(o, 0, 1.1, { cut0: 800, cut1: 7000, a: 0.3, d: 0.7, gain: 0.45 }); for (let j = 0; j < 6; j++) bell(o, hz(69 + j * 2), j * 0.08, 0.9, { mod: 2.01, idx: 3.5, k: 5, gain: 0.35 }); return finish(o); });
one('sticky_lock', 0.9, () => { const o = buf(0.9); subhit(o, 0, 0.4, hz(50), hz(38), { k: 10, gain: 0.9 }); bell(o, hz(74), 0.02, 0.4, { mod: 1.4, idx: 4, k: 9, gain: 0.5 }); bell(o, hz(67), 0.16, 0.5, { mod: 1.4, idx: 4, k: 9, gain: 0.5 }); return finish(o); });
one('scatter_trigger', 2.0, () => { const o = buf(2.0); whoosh(o, 0, 1.0, { cut0: 500, cut1: 8000, a: 0.5, d: 0.5, gain: 0.45 }); [0, 4, 7, 12].forEach((n, j) => bell(o, hz(74 + n), 0.5 + j * 0.1, 1.4, { mod: 2.01, idx: 5, k: 3, gain: 0.4 })); subhit(o, 0.4, 0.6, hz(38), hz(45), { k: 5, gain: 0.5 }); return finish(o); });

// — Transitions / Bonus —
one('transition_in', 1.5, () => { const o = buf(1.5); whoosh(o, 0, 1.1, { cut0: 400, cut1: 9000, a: 0.6, d: 0.4, gain: 0.55, hp: 200 }); subhit(o, 0, 1.1, hz(31), hz(43), { k: 1.2, gain: 0.6 }); for (let j = 0; j < 5; j++) bell(o, hz(74 + j * 3), 1.0 + j * 0.03, 0.45, { mod: 2.0, idx: 4, k: 6, gain: 0.4 }); return finish(o); });
one('bonus_intro', 1.5, () => { const o = buf(1.5); [0, 7, 12].forEach((n, j) => bell(o, hz(62 + n), j * 0.05, 1.4, { mod: 1.5, idx: 5, k: 2.6, gain: 0.5 })); subhit(o, 0, 0.5, hz(38), hz(38), { k: 5, gain: 0.5 }); return finish(o); });
one('retrigger', 1.0, () => { const o = buf(1.0); for (let j = 0; j < 4; j++) bell(o, hz(76 + j * 4), j * 0.06, 0.7, { mod: 2.01, idx: 4, k: 5, gain: 0.5 }); whoosh(o, 0, 0.4, { cut0: 1500, cut1: 6000, gain: 0.25 }); return finish(o); });
one('mult_reveal', 0.8, () => { const o = buf(0.8); subhit(o, 0, 0.2, hz(48), hz(60), { k: 16, gain: 0.7 }); bell(o, hz(81), 0.08, 0.6, { mod: 2.4, idx: 4, k: 6, gain: 0.6 }); return finish(o); }, 112);
one('bonus_end', 2.0, () => { const o = buf(2.0); [0, 7, 12, 16].forEach((n, j) => bell(o, hz(62 + n), j * 0.06, 1.9, { mod: 1.5, idx: 4, k: 1.8, gain: 0.45 })); const D = delay(0.2, 0.4, 0.3); for (let i = 0; i < o.length; i++) o[i] += D(o[i]) * 0.4; return finish(o); });

// — Buy bonus —
one('buy_open', 0.8, () => { const o = buf(0.8); whoosh(o, 0, 0.6, { cut0: 600, cut1: 4800, gain: 0.4 }); bell(o, hz(69), 0.15, 0.6, { mod: 1.5, idx: 4, k: 4, gain: 0.5 }); return finish(o); });
one('buy_select', 0.4, () => { const o = buf(0.4); bell(o, hz(81), 0, 0.34, { mod: 2.01, idx: 3, k: 12, gain: 0.8 }); return finish(o); }, 96);
one('buy_confirm', 1.2, () => { const o = buf(1.2); subhit(o, 0, 0.4, hz(43), hz(50), { k: 7, gain: 0.7 }); [0, 7, 12].forEach((n, j) => bell(o, hz(69 + n), 0.05 + j * 0.04, 1.0, { mod: 1.5, idx: 4, k: 3.2, gain: 0.45 })); return finish(o); });

// — Impacts —
one('impact_braam', 1.0, () => { const o = buf(1.0); subhit(o, 0, 0.9, hz(29), hz(34), { k: 2.2, gain: 0.9, wave: saw }); whoosh(o, 0, 0.5, { cut0: 300, cut1: 2200, gain: 0.4 }); return finish(o); });
one('shake_thud', 0.4, () => { const o = buf(0.4); subhit(o, 0, 0.35, hz(40), hz(28), { k: 12, gain: 1 }); return finish(o); }, 96);

// — Music (procedural beds + cues) —
lp('main_base_loop', 8.0, () => { const o = buf(8.0); const lpF = onePoleLP(2400);
  for (let i = 0; i < o.length; i++) { const t = i / SR; let s = 0;
    Dm9.forEach((f, j) => { s += (0.10 / Dm9.length) * (saw(f * t * (1 + 0.003 * j)) * 0.5 + sine(f * t) * 0.5) * (0.8 + 0.2 * sine(0.12 * t + j)); });
    s += 0.16 * sine(hz(26) * t) * (0.7 + 0.3 * sqr(t * 0.5, 0.5)); o[i] = lpF(s); }
  for (let b = 0; b < 16; b++) { const n = ARP[b % ARP.length]; pluck(o, n * 2, b * 0.5, 0.45, { gain: 0.18, k: 7 }); }
  return finish(o, { loop: true, peak: 0.7 }); });
lp('bonus_loop', 8.0, () => { const o = buf(8.0); const lpF = onePoleLP(3200);
  for (let i = 0; i < o.length; i++) { const t = i / SR; let s = 0;
    Dm.forEach((f) => { s += 0.07 * saw(f * t); }); s += 0.18 * sine(hz(26) * t);
    const beat = (t % 0.4839) / 0.4839; s += 0.5 * expdec(beat * 0.4839, 30) * sine(hz(31) * (1 - beat) * t * 0 + 60 * (1 - beat * 0.8)); // kick-ish
    o[i] = lpF(s); }
  for (let b = 0; b < 32; b++) { const n = [62, 69, 74, 77, 74, 69][b % 6]; pluck(o, hz(n) * 2, b * 0.25, 0.22, { gain: 0.16, k: 10 }); }
  return finish(o, { loop: true, peak: 0.78 }); });
one('main_intro', 4.0, () => { const o = buf(4.0); whoosh(o, 0, 2.2, { cut0: 300, cut1: 6000, a: 0.7, d: 0.3, gain: 0.4 }); subhit(o, 1.6, 2.0, hz(31), hz(31), { k: 1.0, gain: 0.6 }); [0, 7, 12, 16].forEach((n, j) => bell(o, hz(50 + n), 1.7 + j * 0.05, 2.2, { mod: 2.01, idx: 5, k: 1.6, gain: 0.4 })); return finish(o); });
one('main_tension', 4.0, () => { const o = buf(4.0); whoosh(o, 0, 3.8, { cut0: 350, cut1: 6500, a: 0.6, d: 0.4, gain: 0.4, hp: 250 }); subhit(o, 0, 3.8, hz(33), hz(40), { k: 0.5, gain: 0.5 }); for (let i = 0; i < o.length; i++) { const t = i / SR; o[i] += 0.12 * sine(hz(50) * t) * (1 + 0.5 * sine(6 * t * (1 + t / 4))) * (t / 4); } return finish(o); });
one('main_bigwin', 5.0, () => { const o = buf(5.0); subhit(o, 0, 1.0, hz(31), hz(38), { k: 2.0, gain: 0.7 }); [0, 7, 12, 16, 19].forEach((n, j) => bell(o, hz(62 + n), 0.05 + j * 0.05, 4.6, { mod: 2.0, idx: 6, k: 0.9, gain: 0.36 })); const D = delay(0.22, 0.4, 0.3); for (let i = 0; i < o.length; i++) o[i] += D(o[i]) * 0.35; for (let b = 0; b < 12; b++) pluck(o, hz(74 + (b % 4) * 5) * 2, 0.4 + b * 0.18, 0.3, { gain: 0.14, k: 8 }); return finish(o); });

// ── render all ───────────────────────────────────────────────────────────────
const manifest = [];
let totBytes = 0;
for (const [id, r] of Object.entries(R)) {
  const f32 = r.gen();
  const bytes = r.fmt === 'mp3' ? toMp3(f32, r.kbps) : toWav(f32);
  const file = `${id}.${r.fmt}`;
  writeFileSync(join(OUT, file), bytes);
  let peak = 0; for (let i = 0; i < f32.length; i++) peak = Math.max(peak, Math.abs(f32[i]));
  manifest.push({ id, file, ms: Math.round(f32.length / SR * 1000), loop: r.loop, kb: +(bytes.length / 1024).toFixed(1), peak: +peak.toFixed(3) });
  totBytes += bytes.length;
}
manifest.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ sampleRate: SR, generated: 'procedural', clips: manifest }, null, 2));

console.log(`\n  SHINING POP — procedural audio bank  (${manifest.length} clips, ${(totBytes / 1024).toFixed(0)} KB total)\n`);
console.log('  id'.padEnd(20) + 'file'.padEnd(24) + 'ms'.padStart(6) + '  loop  ' + 'KB'.padStart(7) + '  peak');
for (const m of manifest) console.log('  ' + m.id.padEnd(18) + m.file.padEnd(24) + String(m.ms).padStart(6) + (m.loop ? '   yes ' : '    -  ') + String(m.kb).padStart(7) + '  ' + m.peak);
console.log(`\n  → ${OUT}\n  → manifest.json written (engine wiring map)\n`);
