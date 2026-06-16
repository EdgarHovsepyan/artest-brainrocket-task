// MVC — VIEW. Acid/white diamond shards bursting from winning cells, scaled by
// the win-to-bet multiple. As of CC-2 (Task 5.4), every shard is borrowed from a
// sibling ParticlePool — no new/destroy in the hot path. Two new spawn paths land
// for downstream tasks: sparkCascade(x,y) for 6.3 Svarka, coinGeyser() for the
// Epic-tier ceremony.

import { _decorator, Color, Component, tween, Vec3 } from 'cc';
import { ParticlePool, PoolShard } from './particle-pool';
import { VIEW_CONFIG } from './view-config';

const { ccclass } = _decorator;
const ACID = new Color(234, 255, 0, 255);
const WHITE = new Color(255, 255, 255, 255);
const COIN = new Color(255, 196, 64, 255);

interface PhysParticle {
  slot: PoolShard;
  vx: number;
  vy: number;
  /** Vertical acceleration (px/s²) — negative pulls a rising ember back. */
  g: number;
  /** Per-frame velocity retention at 60fps (drag); <1 = damping. */
  damp: number;
  life: number;
  age: number;
  /** Twinkle phase offset so the field never flickers in unison. */
  ph: number;
  s0: number;
}

@ccclass('ParticleLayer')
export class ParticleLayer extends Component {
  private pool!: ParticlePool;
  // CGI particles — a real integrator (velocity, gravity, drag, twinkle) instead
  // of point-to-point tweens. One stepper runs only while particles are alive.
  private phys: PhysParticle[] = [];
  private physOn = false;

  onLoad(): void {
    this.pool = this.node.getComponent(ParticlePool) ?? this.node.addComponent(ParticlePool);
  }

  private spawnPhys(
    x: number,
    y: number,
    color: Color,
    s0: number,
    vx: number,
    vy: number,
    g: number,
    damp: number,
    life: number,
  ): void {
    const slot = this.pool.get(x, y, color, s0);
    if (!slot) return; // pool full — silent drop
    this.phys.push({ slot, vx, vy, g, damp, life, age: 0, ph: Math.random() * 6.283, s0 });
    if (!this.physOn) {
      this.physOn = true;
      this.schedule(this.tickPhys, 0);
    }
  }

  private tickPhys = (dt: number): void => {
    for (let i = this.phys.length - 1; i >= 0; i--) {
      const p = this.phys[i];
      p.age += dt;
      if (p.age >= p.life || !p.slot.node.isValid) {
        this.pool.put(p.slot);
        this.phys.splice(i, 1);
        continue;
      }
      const k = Math.pow(p.damp, dt * 60);
      p.vx *= k;
      p.vy = p.vy * k + p.g * dt;
      const n = p.slot.node;
      const pos = n.position;
      n.setPosition(pos.x + p.vx * dt, pos.y + p.vy * dt, 0);
      const t = p.age / p.life;
      // Envelope: quick ignite → sustained → fade; candle-twinkle on top.
      const fade = t < 0.12 ? t / 0.12 : t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
      const tw = 0.75 + 0.25 * Math.sin(p.age * 14 + p.ph);
      p.slot.opacity.opacity = Math.round(255 * Math.max(0, fade) * tw);
      const sc = p.s0 * (1 - 0.35 * t);
      n.setScale(sc, sc, 1);
    }
    if (this.phys.length === 0) {
      this.unschedule(this.tickPhys);
      this.physOn = false;
    }
  };

  /** Burst shards from each centre; volume scales with `multiple` (win/total bet). */
  burst(centers: Vec3[], multiple: number): void {
    const { baseCount, perMultiple, maxCount } = VIEW_CONFIG.particles;
    const big = multiple >= VIEW_CONFIG.ceremony.showMinMultiple;
    // Wave 1 — cap by the device tier so weak hardware spawns fewer shards.
    const cap = Math.round(maxCount * VIEW_CONFIG.tier.particleScale);
    const count = Math.min(cap, Math.round(baseCount + multiple * perMultiple));
    const pts = centers.length ? centers : [new Vec3(0, VIEW_CONFIG.layout.reelCenterY, 0)];
    for (let i = 0; i < count; i++) {
      const p = pts[i % pts.length];
      this.spawn(p.x + (Math.random() * 40 - 20), p.y + (Math.random() * 40 - 20), big);
    }
  }

  /** FIRE EMBERS (2026-06-11): warm orange→gold motes rising from each winning
   *  cell centre, drifting up + sideways and fading — the win indicator that
   *  replaces the drawn payline. Reads as heat/embers off the symbol, no
   *  geometry. */
  fireEmbers(centers: Vec3[]): void {
    const cfg = VIEW_CONFIG.win.fireEmbers;
    const life = cfg.lifeMs / 1000;
    const warm = [
      new Color(255, 170, 60, 255), // amber
      new Color(255, 120, 30, 255), // orange
      new Color(255, 220, 130, 255), // gold
      new Color(255, 248, 222, 255), // white-hot spark
    ];
    // Wave 1 — spread a FIXED pool budget across ALL winning cells (scaled by the
    // device tier) so a dense win shows embers on every cell instead of the first
    // few cells draining the 64-shard pool and the rest silently dropping.
    const poolCap = VIEW_CONFIG.particles.poolCap;
    const headroom = Math.max(0, poolCap - this.pool.live);
    const budget = Math.min(Math.round(poolCap * 0.85 * VIEW_CONFIG.tier.particleScale), headroom);
    const perCell = Math.floor(budget / (centers.length || 1));
    if (perCell <= 0) return; // no pool headroom — drop cleanly, don't half-spawn
    // ~40% of each cell's share is the ignite ring; the rest rises (within caps).
    const igniteN = Math.min(8, Math.max(1, Math.round(perCell * 0.4)));
    const riseN = Math.min(cfg.perCell, Math.max(0, perCell - igniteN));
    for (const c of centers) {
      // Phase 1 — IGNITE RING: a radial pop of fast, hard-damped light points
      // (the energy leaving the symbol), settling within ~half a second.
      for (let i = 0; i < igniteN; i++) {
        const ang = (i / igniteN) * Math.PI * 2 + Math.random() * 0.4;
        const v = 240 + Math.random() * 120;
        this.spawnPhys(
          c.x,
          c.y,
          warm[i % 3]!,
          0.4 + Math.random() * 0.25,
          Math.cos(ang) * v,
          Math.sin(ang) * v,
          -40,
          0.86,
          0.4 + Math.random() * 0.2,
        );
      }
      // Phase 2 — EMBER RISE: buoyant motes that decelerate as they climb,
      // drifting + twinkling; the white-hot quarter is faster and shorter.
      for (let i = 0; i < riseN; i++) {
        const hot = i % 4 === 3;
        this.spawnPhys(
          c.x + (Math.random() - 0.5) * cfg.spreadPx,
          c.y + (Math.random() - 0.5) * 24,
          warm[i % warm.length]!,
          hot ? 0.2 + Math.random() * 0.2 : 0.45 + Math.random() * 0.7,
          (Math.random() - 0.5) * 90,
          cfg.riseSpeed * (hot ? 1.6 + Math.random() : 0.7 + Math.random() * 0.7),
          -130,
          0.985,
          life * (hot ? 0.5 + Math.random() * 0.3 : 0.9 + Math.random() * 0.6),
        );
      }
    }
  }

  /** 6.3 Svarka cascade: short-lived hot-cyan sparks pulled down by gravity at (x,y). */
  sparkCascade(x: number, y: number): void {
    const cfg = VIEW_CONFIG.win.svarka;
    const color = new Color().fromHEX(cfg.sparkColor);
    const life = cfg.sparkLifeMs / 1000;
    const g = cfg.sparkGravity;
    for (let i = 0; i < cfg.sparkPerStep; i++) {
      const slot = this.pool.get(x, y, color, 0.6 + Math.random() * 0.4);
      if (!slot) return; // pool full — silent drop
      const vx = (Math.random() - 0.5) * 200;
      const vy = -60 + Math.random() * 40; // small upward kick before gravity wins
      const endX = x + vx * life;
      const endY = y + vy * life - 0.5 * g * life * life;
      this.ballistic(slot, endX, endY, life, 'quadIn');
    }
  }

  /** Epic-ceremony coin geyser — HERO coins. Each pops from the origin, arcs
   *  up-and-out, decel-spins (catching the additive light), then falls + shrinks.
   *  Per-coin stagger makes the top-tier payoff read as a shower, not a flat
   *  simultaneous spray. */
  coinGeyser(originX = 0, originY = VIEW_CONFIG.layout.reelCenterY, intensity = 1): void {
    const cfg = VIEW_CONFIG.particles.coin;
    // Wave 6 — scale the shower by win intensity (continuous crescendo, not a fixed
    // epic burst) and by the device tier. intensity in [0,1]; non-finite → full.
    const i01 = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 1;
    const count = Math.max(
      1,
      Math.round(cfg.count * (0.5 + 0.5 * i01) * VIEW_CONFIG.tier.particleScale),
    );
    for (let i = 0; i < count; i++) {
      const slot = this.pool.get(originX, originY, COIN, 0.2);
      if (!slot) return; // pool full — silent drop
      this.heroCoin(slot, originX, originY, i * cfg.staggerS);
    }
  }

  /** One cinematic hero coin. ALL tweens are FINITE (no repeatForever) so the
   *  shard returns to the shared pool cleanly — a looping tween on a re-pooled
   *  node is a known crash. Position / scale / spin / opacity run in parallel;
   *  opacity outlives the motion so `pool.put` fires once, after the arc lands. */
  private heroCoin(slot: PoolShard, ox: number, oy: number, delay: number): void {
    const cfg = VIEW_CONFIG.particles.coin;
    const pool = this.pool;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const life = cfg.heroLifeS;
    const upDur = life * cfg.riseFrac;
    const downDur = life - upDur;
    const lateral = cfg.lateralPx * (0.4 + Math.random() * 0.6) * dir;
    const apex = new Vec3(ox + lateral * 0.5, oy + cfg.risePx * (0.7 + Math.random() * 0.5), 0);
    const land = new Vec3(ox + lateral, oy - cfg.fallPx * (0.7 + Math.random() * 0.5), 0);
    const full = cfg.scalePop * (0.85 + Math.random() * 0.3);

    slot.node.setPosition(ox, oy, 0);
    slot.node.angle = 0;
    slot.node.setScale(0.2, 0.2, 1);
    slot.opacity.opacity = 0;

    // arc: rise (decel) → fall (accel)
    tween(slot.node)
      .delay(delay)
      .to(upDur, { position: apex }, { easing: 'quadOut' })
      .to(downDur, { position: land }, { easing: 'quadIn' })
      .start();
    // pop-in → shrink as it falls
    tween(slot.node)
      .delay(delay)
      .to(0.12, { scale: new Vec3(full, full, 1) }, { easing: 'backOut' })
      .to(life - 0.12, { scale: new Vec3(cfg.scaleEnd, cfg.scaleEnd, 1) }, { easing: 'sineIn' })
      .start();
    // decelerating spin — finite, completes within `life`
    tween(slot.node)
      .delay(delay)
      .to(life, { angle: cfg.spinDeg * dir }, { easing: 'quadOut' })
      .start();
    // ignite → hold → fade; outlives the motion so the slot returns to pool once
    tween(slot.opacity)
      .delay(delay)
      .to(0.1, { opacity: 255 })
      .delay(life * 0.6)
      .to(life * 0.4, { opacity: 0 })
      .call(() => pool.put(slot))
      .start();
  }

  private spawn(x: number, y: number, big: boolean): void {
    const color = Math.random() < 0.5 ? ACID : WHITE;
    const scale = big ? 0.9 : 0.6;
    const slot = this.pool.get(x, y, color, scale);
    if (!slot) return; // pool full — silent drop
    const ang = Math.random() * Math.PI * 2;
    const dist = (big ? 150 : 80) * (0.5 + Math.random());
    const life = 0.5 + Math.random() * 0.4;
    const endX = x + Math.cos(ang) * dist;
    const endY = y + Math.sin(ang) * dist - 70;
    const pool = this.pool;

    tween(slot.node)
      .to(
        life,
        {
          position: new Vec3(endX, endY, 0),
          scale: new Vec3(scale * 0.3, scale * 0.3, 1),
          angle: Math.random() * 180 - 90,
        },
        { easing: 'quadOut' },
      )
      .start();
    tween(slot.opacity)
      .delay(life * 0.5)
      .to(life * 0.5, { opacity: 0 })
      .call(() => pool.put(slot))
      .start();
  }

  private ballistic(
    slot: PoolShard,
    endX: number,
    endY: number,
    life: number,
    easing: 'quadIn' | 'quadOut' = 'quadIn',
  ): void {
    const pool = this.pool;
    tween(slot.node)
      .to(life, { position: new Vec3(endX, endY, 0) }, { easing })
      .start();
    tween(slot.opacity)
      .delay(life * 0.5)
      .to(life * 0.5, { opacity: 0 })
      .call(() => pool.put(slot))
      .start();
  }
}
