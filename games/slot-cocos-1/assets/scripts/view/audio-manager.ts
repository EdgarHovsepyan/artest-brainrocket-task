// Procedural Web-Audio SFX — asset-free, like the SHINING POP sound engine.
// Plain class (not a Cocos Component). Works in browser/web builds; silently
// no-ops where AudioContext is unavailable (native) or not yet unlocked.

type Ctx = AudioContext;

export class AudioManager {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private volume = 0.5; // master gain when unmuted (0..1)

  /** Lazily build the graph on first call (must follow a user gesture on web). */
  private ensure(): boolean {
    if (this.ctx) return true;
    const AC =
      (
        globalThis as unknown as {
          AudioContext?: typeof AudioContext;
          webkitAudioContext?: typeof AudioContext;
        }
      ).AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyGain();
  }
  /** Master volume 0..1 — driven by the betting-bar volume slider. */
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyGain();
  }
  private applyGain(): void {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  /** One decaying oscillator voice. */
  private voice(freq: number, dur: number, type: OscillatorType = 'triangle', gain = 0.3): void {
    if (this.muted || !this.ensure() || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  reelTick(): void {
    this.voice(180 + Math.random() * 40, 0.04, 'square', 0.06);
  }

  reelStop(reel: number): void {
    this.voice(120 + reel * 30, 0.12, 'sawtooth', 0.14);
  }

  /** Tiered win sting: tier 1 small … 3 epic (additive brightness). */
  win(tier: number): void {
    const base = [392, 523, 659][Math.min(2, Math.max(0, tier - 1))];
    this.voice(base, 0.5, 'triangle', 0.28);
    if (tier >= 2) this.voice(base * 1.5, 0.6, 'sine', 0.2);
    if (tier >= 3) this.voice(base * 2, 0.7, 'sine', 0.16);
  }

  countTick(progress: number): void {
    this.voice(440 + progress * 660, 0.03, 'sine', 0.05);
  }

  anticipation(): void {
    this.voice(80, 0.4, 'sine', 0.18);
  }
}
