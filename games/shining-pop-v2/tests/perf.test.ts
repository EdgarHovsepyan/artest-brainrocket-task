// VfxGovernor contract (Gregory — approval #42). The governor is the pure
// decision core behind adaptive VFX density: feed it frame deltas, read a scale
// in [minScale, 1]. It owns no `cc` types so it proves out in plain Node — the
// part worth proving is the control law, not the particle plumbing.
//
// These tests assert BEHAVIOUR (holds full quality when smooth, sheds under
// sustained load, recovers gently, never starves a signature beat), not exact
// scale values, so tuning the thresholds stays free while the loop stays honest.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VfxGovernor, DEFAULT_VFX_QUALITY } from '../assets/scripts/view/perf';
import { VIEW_CONFIG } from '../assets/scripts/view/view-config';

// Advance the governor by `seconds` of real time in steady frames of `dt`.
function run(gov: VfxGovernor, frameMs: number, seconds: number): void {
  const dt = frameMs / 1000;
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i++) gov.sample(dt);
}

test('a fresh governor starts at full quality (scale = 1)', () => {
  const gov = new VfxGovernor();
  assert.equal(gov.scale, 1);
  assert.equal(gov.count(72), 72);
});

test('holds full density while frames stay smooth (60fps)', () => {
  const gov = new VfxGovernor();
  run(gov, 1000 / 60, 5);
  assert.equal(gov.scale, 1, 'smooth frames must not shed density');
  assert.equal(gov.count(72), 72);
});

test('sheds density under sustained load (20fps) toward the floor', () => {
  const gov = new VfxGovernor();
  run(gov, 50, 5); // 50ms/frame ≈ 20fps, well past downShiftMs
  assert.ok(gov.scale < 1, 'load must reduce the scale');
  assert.ok(
    Math.abs(gov.scale - DEFAULT_VFX_QUALITY.minScale) < 0.02,
    `sustained load should clamp near minScale, got ${gov.scale}`,
  );
  assert.ok(gov.count(72) < 72, 'fewer particles under load');
});

test('scale never drops below the configured floor', () => {
  const gov = new VfxGovernor();
  run(gov, 200, 10); // brutal 5fps for a long time
  assert.ok(
    gov.scale >= DEFAULT_VFX_QUALITY.minScale - 1e-9,
    `scale ${gov.scale} broke the minScale floor`,
  );
});

test('recovers gently back to full quality once frames are smooth again', () => {
  const gov = new VfxGovernor();
  run(gov, 50, 5); // stress down
  const stressed = gov.scale;
  assert.ok(stressed < 1);
  run(gov, 1000 / 60, 1); // one second of smooth frames
  const recovering = gov.scale;
  assert.ok(recovering > stressed, 'scale must climb back when smooth');
  assert.ok(recovering < 1, 'recovery is gradual, not an instant snap');
  run(gov, 1000 / 60, 6); // give it time
  assert.equal(gov.scale, 1, 'eventually returns to full quality');
});

test('warmup ignores early frames so a load spike does not crater quality', () => {
  const gov = new VfxGovernor({ ...DEFAULT_VFX_QUALITY, warmupFrames: 30 });
  // A few brutal startup frames (compile/upload) inside the warmup window.
  for (let i = 0; i < 10; i++) gov.sample(0.3);
  assert.equal(gov.scale, 1, 'scale must not move during warmup');
});

test('a single stall frame is clamped and cannot poison the EMA', () => {
  const gov = new VfxGovernor();
  run(gov, 1000 / 60, 2); // settle smooth, past warmup
  gov.sample(5.0); // 5-second stall (tab refocus / breakpoint)
  run(gov, 1000 / 60, 1); // back to smooth
  assert.ok(gov.scale > 0.95, `one stall must not durably drop quality, got ${gov.scale}`);
});

test('count() rounds, honours the floor, and never goes negative', () => {
  const gov = new VfxGovernor();
  run(gov, 200, 10); // pin to minScale (0.45)
  assert.equal(gov.count(8, 5), 5, 'floor wins when the scaled count is lower');
  assert.ok(gov.count(72) > 0);
  assert.equal(gov.count(0), 0);
});

test('view-config exposes a well-formed vfx.quality block the governor can consume', () => {
  const q = VIEW_CONFIG.vfx.quality;
  assert.ok(q.targetFps > 0);
  assert.ok(q.emaAlpha > 0 && q.emaAlpha <= 1, 'emaAlpha must be in (0,1]');
  assert.ok(q.minScale > 0 && q.minScale < 1, 'minScale must leave room to shed and to recover');
  assert.ok(q.upShiftMs < q.downShiftMs, 'recover threshold must sit below the shed threshold');
  assert.ok(q.shedPerSec > q.recoverPerSec, 'shed fast under load, recover slowly (no pumping)');
  assert.ok(q.warmupFrames >= 0 && q.stallClampMs > 0);
  // The configured block must actually drive a governor without throwing.
  const gov = new VfxGovernor(q);
  run(gov, 50, 5);
  assert.ok(gov.scale < 1 && gov.scale >= q.minScale - 1e-9);
});
