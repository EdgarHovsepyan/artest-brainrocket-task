type Ctx = AudioContext;

const BANK = [
  'main_base_loop',
  'main_intro',
  'main_tension',
  'main_bigwin',
  'bonus_loop',
  'bonus_intro',
  'bonus_end',
  'reel_loop',
  'reel_stop',
  'turbo_stop',
  'spin_start',
  'anticipation',
  'near_miss',
  'win_small',
  'win_nice',
  'win_big',
  'win_mega',
  'win_epic',
  'coin_cascade',
  'impact_braam',
  'mult_reveal',
  'retrigger',
  'scatter_tick',
  'scatter_trigger',
  'shake_thud',
  'sticky_lock',
  'tally_pip',
  'transition_in',
  'ui_bet',
  'ui_click',
  'ui_modal_open',
  'ui_modal_close',
  'buy_open',
  'buy_select',
  'buy_confirm',
  'wild_expand',
  'wild_land',
] as const;

type ClipId = (typeof BANK)[number];
type BusId = 'music' | 'gameplay' | 'sfx' | 'win';

const BUS_DB: Record<BusId, number> = { music: -6, gameplay: -10, sfx: -8, win: -2 };
const db2lin = (db: number): number => Math.pow(10, db / 20);

export class AudioManager {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private buses: Partial<Record<BusId, GainNode>> = {};
  private buffers: Partial<Record<ClipId, AudioBuffer>> = {};
  private muted = false;
  private volume = 0.5;
  private unlocked = false;
  private loading = false;
  private musicSrc: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private musicId: 'main_base_loop' | 'bonus_loop' | null = null;
  private rushOsc: OscillatorNode[] = [];
  private rushGain: GainNode | null = null;
  private rushPip: number | null = null;
  private lastBetAt = 0;
  private lastWinAt = 0;

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
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      (['music', 'gameplay', 'sfx', 'win'] as BusId[]).forEach((b) => {
        const g = this.ctx!.createGain();
        g.gain.value = db2lin(BUS_DB[b]);
        g.connect(this.master!);
        this.buses[b] = g;
      });
      return true;
    } catch {
      return false;
    }
  }

  unlock(): void {
    if (!this.ensure() || !this.ctx) return;

    if (this.ctx.state === 'suspended') {
      void this.ctx
        .resume()
        .then(() => {
          if (this.musicId && this.buffers[this.musicId] && !this.musicSrc) {
            this.playMusic(this.musicId);
          }
        })
        .catch(() => undefined);
    }
    if (this.unlocked) return;
    this.unlocked = true;
    this.loadBank();
  }

  private loadBank(): void {
    if (this.loading || !this.ctx) return;
    this.loading = true;

    const base = typeof document !== 'undefined' ? document.baseURI : '';
    for (const id of BANK) {
      fetch(base ? new URL(`audio/${id}.mp3`, base).href : `audio/${id}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((ab) => this.ctx!.decodeAudioData(ab))
        .then((buf) => {
          this.buffers[id] = buf;
          if (this.musicId === id && !this.musicSrc) this.playMusic(this.musicId);
        })
        .catch(() => undefined);
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyGain();
  }

  suspend(): void {
    this.stopRush();
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => undefined);
  }
  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyGain();
  }
  private applyGain(): void {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  private playSample(id: ClipId, bus: BusId, gain = 1, loop = false): AudioBufferSourceNode | null {
    if (this.muted || !this.ensure() || !this.ctx) return null;
    const buf = this.buffers[id];
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.buses[bus]!);
    src.start();
    return src;
  }

  playMusic(id: 'main_base_loop' | 'bonus_loop'): void {
    this.musicId = id;
    if (!this.ensure() || !this.ctx) return;
    const buf = this.buffers[id];
    if (!buf) return;
    const t = this.ctx.currentTime;
    if (this.musicSrc && this.musicGain) {
      const old = this.musicSrc;
      this.musicGain.gain.setTargetAtTime(0, t, 0.25);
      try {
        old.stop(t + 0.9);
      } catch {}
      this.musicSrc = null;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(1, t, 0.4);
    src.connect(g);
    g.connect(this.buses.music!);
    src.start(t);
    this.musicSrc = src;
    this.musicGain = g;
  }

  private duckMusic(duckDb = -6, holdMs = 380): void {
    const bus = this.buses.music;
    if (!bus || !this.ctx) return;
    const rest = db2lin(BUS_DB.music);
    const ducked = db2lin(BUS_DB.music + duckDb);
    const t = this.ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setTargetAtTime(ducked, t, 0.03);
    bus.gain.setTargetAtTime(rest, t + holdMs / 1000, 0.2);
  }

  spinStart(): void {
    if (this.playSample('spin_start', 'sfx', 0.8)) return;
    this.voice(220, 0.08, 'triangle', 0.12);
  }

  startRush(): void {
    if (this.rushGain || this.muted || !this.ensure() || !this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.15);
    g.connect(this.buses.gameplay!);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1300;
    lp.Q.value = 0.8;
    lp.connect(g);
    const mk = (freq: number) => {
      const o = this.ctx!.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const og = this.ctx!.createGain();
      og.gain.value = 0.032;
      o.connect(og);
      og.connect(lp);
      o.start(t);
      return o;
    };
    // Gentle 0.7Hz shimmer instead of a buzzy 3.5Hz beat on the spin drone.
    this.rushOsc = [mk(220), mk(220.7)];
    this.rushGain = g;
    const pips = [523.25, 659.25, 783.99, 659.25];
    let step = 0;
    this.rushPip = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const pt = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = pips[step++ % pips.length];
      const pg = this.ctx.createGain();
      pg.gain.setValueAtTime(0, pt);
      pg.gain.linearRampToValueAtTime(0.034, pt + 0.012);
      pg.gain.exponentialRampToValueAtTime(0.0001, pt + 0.18);
      o.connect(pg);
      pg.connect(this.buses.gameplay!);
      o.start(pt);
      o.stop(pt + 0.2);
    }, 320) as unknown as number;
  }

  stopRush(): void {
    if (!this.rushGain || !this.ctx) return;
    if (this.rushPip != null) {
      clearInterval(this.rushPip);
      this.rushPip = null;
    }
    const t = this.ctx.currentTime;
    this.rushGain.gain.setTargetAtTime(0, t, 0.07);
    this.rushOsc.forEach((o) => {
      try {
        o.stop(t + 0.3);
      } catch {}
    });
    this.rushOsc = [];
    this.rushGain = null;
  }

  reelTick(): void {
    this.startRush();
  }

  reelStop(reel: number, turbo = false): void {
    if (reel >= 4) this.stopRush();
    if (this.playSample(turbo ? 'turbo_stop' : 'reel_stop', 'sfx', 0.7)) return;
    this.voice(120 + reel * 30, 0.12, 'sawtooth', 0.14);
  }

  anticipation(): void {
    if (this.playSample('anticipation', 'gameplay', 0.8)) return;
    this.voice(80, 0.4, 'sine', 0.18);
  }

  win(tier: number): void {
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (this.lastWinAt && now - this.lastWinAt < 0.09) return;
    this.lastWinAt = now;

    this.duckMusic(tier >= 4 ? -9 : tier >= 2 ? -6 : -4, tier >= 4 ? 520 : 380);
    const ids: ClipId[] = ['win_small', 'win_nice', 'win_big', 'win_mega', 'win_epic'];
    const id = ids[Math.min(ids.length - 1, Math.max(0, tier - 1))];
    if (this.playSample(id, 'win', 0.95)) return;
    const base = [392, 440, 523, 587, 659][Math.min(4, Math.max(0, tier - 1))];
    this.voice(base, 0.5, 'triangle', 0.28);
    if (tier >= 2) this.voice(base * 1.5, 0.6, 'sine', 0.2);
    if (tier >= 3) this.voice(base * 2, 0.7, 'sine', 0.16);
  }

  countTick(progress: number): void {
    if (this.playSample('tally_pip', 'sfx', 0.5)) return;
    this.voice(440 + progress * 660, 0.03, 'sine', 0.05);
  }

  impact(): void {
    this.duckMusic(-10, 560);
    if (this.playSample('impact_braam', 'win', 0.9)) return;
    this.voice(72, 0.6, 'sawtooth', 0.34);
    this.voice(110, 0.5, 'triangle', 0.22);
  }

  bonusIntro(): void {
    this.playSample('bonus_intro', 'win', 0.95);
    this.playMusic('bonus_loop');
  }

  bonusEnd(): void {
    this.playSample('bonus_end', 'win', 0.9);
    this.playMusic('main_base_loop');
  }

  stickyLock(): void {
    if (this.playSample('sticky_lock', 'sfx', 0.7)) return;
    this.voice(300, 0.1, 'square', 0.1);
  }

  wildLand(): void {
    if (this.playSample('wild_land', 'sfx', 0.8)) return;
    this.voice(240, 0.14, 'triangle', 0.16);
  }

  click(): void {
    if (this.playSample('ui_click', 'sfx', 0.7)) return;
    this.voice(660, 0.04, 'sine', 0.08);
  }

  bet(): void {
    const t = this.ctx ? this.ctx.currentTime : 0;
    if (this.lastBetAt && t - this.lastBetAt < 0.03) return;
    this.lastBetAt = t;
    if (this.playSample('ui_bet', 'sfx', 0.6)) return;
    this.voice(520, 0.04, 'sine', 0.07);
  }

  modalOpen(): void {
    if (this.playSample('ui_modal_open', 'sfx', 0.7)) return;
    this.voice(500, 0.07, 'triangle', 0.09);
  }

  modalClose(): void {
    if (this.playSample('ui_modal_close', 'sfx', 0.6)) return;
    this.voice(380, 0.06, 'triangle', 0.08);
  }

  buyOpen(): void {
    if (this.playSample('buy_open', 'sfx', 0.8)) return;
    this.modalOpen();
  }

  buySelect(): void {
    if (this.playSample('buy_select', 'sfx', 0.8)) return;
    this.click();
  }

  buyConfirm(): void {
    if (this.playSample('buy_confirm', 'win', 0.9)) return;
    this.win(2);
  }

  private voice(freq: number, dur: number, type: OscillatorType = 'triangle', gain = 0.3): void {
    if (this.muted || !this.ensure() || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.buses.sfx ?? this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}
