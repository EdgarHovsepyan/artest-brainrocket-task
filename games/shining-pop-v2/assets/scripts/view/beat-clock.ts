// MVC — VIEW substrate (Wave 1). A free-running VISUAL metronome used to
// quantize win/feature reveals so the game feels rhythmic ("every reveal lands
// on the beat"). It is deliberately NOT locked to the music: the music beds
// expose no beat grid and the in-spin rush pulse is a transient, so claiming
// audio-sync here would read as drift. This is a fixed-BPM phase clock.
//
// Time source is performance.now() — monotonic and unaffected by wall-clock
// jumps, and (unlike a frame counter) it keeps correct phase across a throttled
// background tab, so a reveal scheduled off it stays on-beat after the tab wakes.
// A later wave can inject the AudioContext currentTime for tighter audio lock;
// the consumer API does not change.

const DEFAULT_BEAT_MS = 480; // ~125 BPM

export class BeatClock {
  private beatMs: number;
  private readonly now: () => number; // monotonic ms
  private origin: number;
  private running = false;

  constructor(beatMs: number = DEFAULT_BEAT_MS, now?: () => number) {
    this.beatMs = Number.isFinite(beatMs) && beatMs >= 60 ? beatMs : DEFAULT_BEAT_MS;
    this.now = now ?? (() => (typeof performance !== 'undefined' ? performance.now() : 0));
    this.origin = this.now();
  }

  start(): void {
    this.origin = this.now();
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  get isRunning(): boolean {
    return this.running;
  }

  setBeatMs(ms: number): void {
    if (Number.isFinite(ms) && ms >= 60) this.beatMs = ms;
  }

  /** One beat in seconds (e.g. for cc.tween durations / sub-divisions). */
  get beatSeconds(): number {
    return this.beatMs / 1000;
  }

  /** Monotonic ms since the clock was (re)started; never negative or NaN. */
  private elapsed(): number {
    const e = this.now() - this.origin;
    return Number.isFinite(e) && e >= 0 ? e : 0;
  }

  /** Phase within the current beat in [0,1). */
  phase01(): number {
    return (this.elapsed() % this.beatMs) / this.beatMs;
  }

  /** Integer beats since start. */
  beatIndex(): number {
    return Math.floor(this.elapsed() / this.beatMs);
  }

  /**
   * Seconds to wait so an action lands on the next beat boundary. Clamped to
   * `maxSeconds` so a quantized reveal can never stall behind a long delay
   * (a missed/late tick must not freeze the whole win presentation).
   */
  nextBeatDelay(maxSeconds = 0.18): number {
    const remainMs = this.beatMs - (this.elapsed() % this.beatMs);
    const s = remainMs / 1000;
    if (!Number.isFinite(s) || s < 0) return 0;
    return Math.min(s, Math.max(0, maxSeconds));
  }
}
