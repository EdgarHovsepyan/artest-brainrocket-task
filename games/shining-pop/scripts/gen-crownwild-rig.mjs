// Builds the Crown Wild Spine rig: crownwild.json (skeleton + idle/land/win/bigwin)
// + crownwild.atlas (2 pages: crown.png art + crown_fx.png generated layers).
// JSON is assembled as a JS object then JSON.stringify'd → always valid.
// Format is Spine 4.x (opens in Editor 4.1+; declared 4.2.00 for runtime parity
// with the project's spine-pixi 4.3.5, which is what we verify against).
// Run:  node scripts/gen-crownwild-rig.mjs
import { writeFileSync } from 'node:fs';

const DIR = 'public/spine/crownwild/';
const CW = 548, CH = 353;          // crown.png dims
const SPK = [                       // spark bone positions (Spine y-up, around the crown)
  [-170, 80], [170, 80], [0, 158], [-120, -70], [120, -70],
];

// ── bones ──
const bones = [
  { name: 'crown' },
  { name: 'glow',  parent: 'crown' },
  { name: 'sweep', parent: 'crown' },
];
SPK.forEach(([x, y], i) => bones.push({ name: 'spark' + (i + 1), parent: 'crown', x, y, scaleX: 0, scaleY: 0 }));

// ── slots (draw order: glow → base → sweep → sparks) ──
const slots = [
  { name: 'glow',  bone: 'glow',  attachment: 'sp_crownwild_glow', blend: 'additive' },
  { name: 'base',  bone: 'crown', attachment: 'sp_crownwild_base' },
  { name: 'sweep', bone: 'sweep', blend: 'additive' },                 // no setup attachment (hidden)
];
SPK.forEach((_, i) => slots.push({ name: 'spark' + (i + 1), bone: 'spark' + (i + 1), blend: 'additive' }));

// ── skin (region attachments) ──
const attachments = {
  glow:  { sp_crownwild_glow:  { width: 256, height: 256, scaleX: 2.9, scaleY: 2.0 } },
  base:  { sp_crownwild_base:  { width: CW, height: CH } },
  sweep: { sp_crownwild_sweep: { width: 48, height: 256, scaleY: 1.6 } },
};
SPK.forEach((_, i) => { attachments['spark' + (i + 1)] = { sp_crownwild_spark: { width: 80, height: 80 } }; });

// ── animation helpers (4.x timeline format: translate/scale use x/y, rotate uses value) ──
const S = (...k) => k.map(([t, x, y]) => (t === 0 ? { x, y } : { time: t, x, y }));   // scale/translate keys
const R = (...k) => k.map(([t, v]) => (t === 0 ? { value: v } : { time: t, value: v }));
const ATT = (...k) => k.map(([t, name]) => (t === 0 ? { name } : { time: t, name }));

const animations = {
  // breathing crown + soft glow pulse — the resting state
  idle: {
    bones: {
      crown: { scale: S([0, 1, 1], [1.2, 1.03, 1.03], [2.4, 1, 1]) },
      glow:  { scale: S([0, 0.92, 0.92], [1.2, 1.10, 1.10], [2.4, 0.92, 0.92]) },
    },
  },
  // drop-in from above + squash on contact + damped settle
  land: {
    bones: {
      crown: {
        translate: S([0, 0, 280], [0.26, 0, -14], [0.40, 0, 4], [0.52, 0, 0]),
        scale:     S([0, 1, 1], [0.26, 1.14, 0.84], [0.40, 0.96, 1.05], [0.52, 1.01, 0.99], [0.62, 1, 1]),
      },
      glow: { scale: S([0, 0.7, 0.7], [0.30, 1.15, 1.15], [0.62, 0.92, 0.92]) },
    },
  },
  // pop scale + a light bar sweeping across the facets + glow flash
  win: {
    slots: { sweep: { attachment: ATT([0, null], [0.07, 'sp_crownwild_sweep'], [0.58, null]) } },
    bones: {
      crown: { scale: S([0, 1, 1], [0.12, 1.14, 1.14], [0.40, 1, 1]) },
      glow:  { scale: S([0, 0.92, 0.92], [0.12, 1.5, 1.5], [0.55, 0.92, 0.92]) },
      sweep: { translate: S([0, -260, 0], [0.58, 260, 0]) },
    },
  },
  // light explosion: bigger pop, ±4° shimmer, double sweep, 5-spark radial burst
  bigwin: {
    slots: {
      sweep:  { attachment: ATT([0, null], [0.06, 'sp_crownwild_sweep'], [0.5, null], [0.62, 'sp_crownwild_sweep'], [1.1, null]) },
      spark1: { attachment: ATT([0, null], [0.14, 'sp_crownwild_spark'], [0.95, null]) },
      spark2: { attachment: ATT([0, null], [0.20, 'sp_crownwild_spark'], [1.0, null]) },
      spark3: { attachment: ATT([0, null], [0.26, 'sp_crownwild_spark'], [1.05, null]) },
      spark4: { attachment: ATT([0, null], [0.32, 'sp_crownwild_spark'], [1.1, null]) },
      spark5: { attachment: ATT([0, null], [0.38, 'sp_crownwild_spark'], [1.15, null]) },
    },
    bones: {
      crown: {
        scale:  S([0, 1, 1], [0.12, 1.18, 1.18], [0.5, 1.04, 1.04], [1.0, 1, 1]),
        rotate: R([0, 0], [0.2, 4], [0.5, -4], [0.9, 0]),
      },
      glow:  { scale: S([0, 0.9, 0.9], [0.10, 1.9, 1.9], [0.6, 1.1, 1.1], [1.2, 0.9, 0.9]) },
      sweep: { translate: S([0, -260, 0], [0.5, 260, 0], [0.62, -260, 0], [1.1, 260, 0]) },
      spark1: { scale: S([0.14, 0, 0], [0.40, 1.6, 1.6], [0.95, 0, 0]) },
      spark2: { scale: S([0.20, 0, 0], [0.46, 1.6, 1.6], [1.0, 0, 0]) },
      spark3: { scale: S([0.26, 0, 0], [0.52, 1.7, 1.7], [1.05, 0, 0]) },
      spark4: { scale: S([0.32, 0, 0], [0.58, 1.5, 1.5], [1.1, 0, 0]) },
      spark5: { scale: S([0.38, 0, 0], [0.64, 1.5, 1.5], [1.15, 0, 0]) },
    },
  },
};

const skeleton = {
  skeleton: { hash: 'sp-crownwild-0001', spine: '4.2.00', x: -CW / 2, y: -CH / 2, width: CW, height: CH, images: './', audio: '' },
  bones, slots,
  skins: [{ name: 'default', attachments }],
  animations,
};

writeFileSync(DIR + 'crownwild.json', JSON.stringify(skeleton, null, 2) + '\n');

// ── atlas (2 pages) ──
const atlas = `crown.png
size: ${CW}, ${CH}
filter: Linear, Linear
pma: false
sp_crownwild_base
  bounds: 0, 0, ${CW}, ${CH}

crown_fx.png
size: 512, 320
filter: Linear, Linear
pma: false
sp_crownwild_glow
  bounds: 0, 0, 256, 256
sp_crownwild_spark
  bounds: 336, 0, 80, 80
sp_crownwild_sweep
  bounds: 272, 0, 48, 256
`;
writeFileSync(DIR + 'crownwild.atlas', atlas);

console.log('[rig] wrote crownwild.json (' + bones.length + ' bones, ' + slots.length + ' slots, ' +
  Object.keys(animations).length + ' anims) + crownwild.atlas');
