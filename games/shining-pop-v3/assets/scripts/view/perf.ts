export interface VfxQualityConfig {
  targetFps: number;

  emaAlpha: number;

  warmupFrames: number;

  minScale: number;

  upShiftMs: number;

  downShiftMs: number;

  recoverPerSec: number;

  shedPerSec: number;

  stallClampMs: number;
}

export const DEFAULT_VFX_QUALITY: VfxQualityConfig = {
  targetFps: 60,
  emaAlpha: 0.1,
  warmupFrames: 30,
  minScale: 0.45,
  upShiftMs: 18,
  downShiftMs: 32,
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

  sample(dt: number): void {
    const ms = Math.min(dt * 1000, this.cfg.stallClampMs);
    this.emaMs += (ms - this.emaMs) * this.cfg.emaAlpha;
    if (++this.frames < this.cfg.warmupFrames) return;

    const { upShiftMs, downShiftMs, minScale } = this.cfg;
    let target: number;
    if (this.emaMs <= upShiftMs) target = 1;
    else if (this.emaMs >= downShiftMs) target = minScale;
    else {
      const t = (this.emaMs - upShiftMs) / (downShiftMs - upShiftMs);
      target = 1 - t * (1 - minScale);
    }

    const rate = (target < this._scale ? this.cfg.shedPerSec : this.cfg.recoverPerSec) * dt;
    this._scale =
      target < this._scale
        ? Math.max(target, this._scale - rate)
        : Math.min(target, this._scale + rate);
  }

  get scale(): number {
    return this._scale;
  }

  get emaFps(): number {
    return 1000 / this.emaMs;
  }

  count(base: number, floor = 0): number {
    return Math.max(floor, Math.round(base * this._scale));
  }
}

export interface VfxStats {
  fps: number;
  scale: number;
  live: number;
  cap: number;
}

export function formatVfxHud(s: VfxStats): string {
  const fps = Math.max(0, Math.round(s.fps));
  const pct = Math.round(Math.min(1, Math.max(0, s.scale)) * 100);
  const live = Math.max(0, Math.round(s.live));
  const cap = Math.max(0, Math.round(s.cap));
  return `${fps}fps  vfx ${pct}%  ${live}/${cap}`;
}
