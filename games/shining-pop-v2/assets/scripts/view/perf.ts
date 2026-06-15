// VFX performance governor (Gregory — approval #42: "auto-scale VFX density by
// frame time; close the loop"). The richest celebration is worthless at 22fps,
// and a featherweight one wastes a capable GPU. This closes that loop: a pure,
// cc-free frame-time observer that yields a single `scale` in [minScale, 1].
//
// Capable device  → EMA frame-time stays low  → scale rides at 1.0  → full,
//                    cinematic particle density.
// Strained device → EMA frame-time climbs     → scale sheds toward minScale →
//                    fewer shards, same choreography, a locked frame budget.
//
// It owns NO engine types so it unit-tests in plain Node (the decision core is
// the part worth proving). ParticleLayer samples it once per frame and multiplies
// every spawn count through `count()`. Asymmetric rates are deliberate: shed
// density fast under load (protect the frame), recover slowly (no visible pumping).

export interface VfxQualityConfig {
  // Frame-budget anchor. Frame-time is judged against the shift thresholds below,
  // not this directly, but it seeds the EMA so the first frames read as "healthy".
  targetFps: number;
  // EMA smoothing in (0,1]: higher reacts faster, lower is steadier. ~0.1 ≈ a
  // 10-frame memory — long enough to ignore a single hitch, short enough to track
  // a real regime change (e.g. a heavy bonus board) within a few hundred ms.
  emaAlpha: number;
  // Frames to observe before the scale is allowed to move. Skips first-frame
  // compile/upload spikes that would otherwise crater quality on load.
  warmupFrames: number;
  // Floor for the scale. Even a struggling device keeps this fraction of density
  // so the choreography still reads (a 0-particle "burst" is a bug, not a save).
  minScale: number;
  // EMA frame-time (ms) at/under which we hold full quality (scale → 1).
  upShiftMs: number;
  // EMA frame-time (ms) at/over which we clamp to minScale.
  downShiftMs: number;
  // Per-second slew toward a higher scale (recover gently — avoid pumping).
  recoverPerSec: number;
  // Per-second slew toward a lower scale (shed quickly — protect the frame).
  shedPerSec: number;
  // A single dt this large is a stall (tab refocus, GC, breakpoint), not a true
  // frame cost; clamp it so one outlier can't poison the EMA.
  stallClampMs: number;
}

export const DEFAULT_VFX_QUALITY: VfxQualityConfig = {
  targetFps: 60,
  emaAlpha: 0.1,
  warmupFrames: 30,
  minScale: 0.45,
  upShiftMs: 18, // ≈ 55 fps — anything smoother than this earns full density
  downShiftMs: 32, // ≈ 31 fps — sustained below this, strip to the floor
  recoverPerSec: 0.25,
  shedPerSec: 2.0,
  stallClampMs: 100,
};

export class VfxGovernor {
  private readonly cfg: VfxQualityConfig;
  private emaMs: number;
  private _scale = 1;
  private frames = 0;

  constructor(cfg: VfxQualityConfig = DEFAULT_VFX_QUALITY) {
    this.cfg = cfg;
    this.emaMs = 1000 / cfg.targetFps;
  }

  // Feed one frame's delta-time (seconds, as Cocos hands to update/schedule).
  sample(dt: number): void {
    const ms = Math.min(dt * 1000, this.cfg.stallClampMs);
    this.emaMs += (ms - this.emaMs) * this.cfg.emaAlpha;
    if (++this.frames < this.cfg.warmupFrames) return;

    const { upShiftMs, downShiftMs, minScale } = this.cfg;
    let target: number;
    if (this.emaMs <= upShiftMs) target = 1;
    else if (this.emaMs >= downShiftMs) target = minScale;
    else {
      // Linear map [upShiftMs..downShiftMs] → [1..minScale].
      const t = (this.emaMs - upShiftMs) / (downShiftMs - upShiftMs);
      target = 1 - t * (1 - minScale);
    }

    const rate = (target < this._scale ? this.cfg.shedPerSec : this.cfg.recoverPerSec) * dt;
    this._scale =
      target < this._scale
        ? Math.max(target, this._scale - rate)
        : Math.min(target, this._scale + rate);
  }

  // The current density multiplier, in [minScale, 1].
  get scale(): number {
    return this._scale;
  }

  // Smoothed frame-rate estimate (for an optional dev HUD).
  get emaFps(): number {
    return 1000 / this.emaMs;
  }

  // Scale a desired spawn count by the live quality, rounded, never negative.
  // `floor` guarantees a minimum so signature beats (the ignite ring) never vanish.
  count(base: number, floor = 0): number {
    return Math.max(floor, Math.round(base * this._scale));
  }
}
