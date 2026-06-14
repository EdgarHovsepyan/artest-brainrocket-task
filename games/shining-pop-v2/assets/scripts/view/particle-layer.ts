// MVC — VIEW. Acid/white diamond shards bursting from winning cells, scaled by
// the win-to-bet multiple. As of CC-2 (Task 5.4), every shard is borrowed from a
// sibling ParticlePool — no new/destroy in the hot path. Two new spawn paths land
// for downstream tasks: sparkCascade(x,y) for 6.3 Svarka, coinGeyser() for the
// Epic-tier ceremony.

import { _decorator, Color, Component, tween, Vec3 } from 'cc';
import { ParticlePool, PoolShard } from './particle-pool';
import { VIEW_CONFIG } from './view-config';

const { ccclass } = _decorator;
const WHITE = new Color(255, 255, 255, 255);
const COIN = new Color(255, 196, 64, 255);
// CANDY CONFETTI — the win burst sprays a sweet-shop mix (pink, mint, gold,
// lavender, sugar-white, sky) so a win reads "yummy candy", not harsh acid/fire.
const CANDY = [
  new Color(255, 120, 180, 255), // candy pink
  new Color(255, 90, 156, 255), // hot pink
  new Color(126, 240, 192, 255), // mint
  new Color(255, 205, 90, 255), // gold
  new Color(200, 160, 255, 255), // lavender
  new Color(255, 250, 252, 255), // sugar white
  new Color(150, 215, 255, 255), // sky candy
];
const candy = () => CANDY[(Math.random() * CANDY.length) | 0]!;

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
    const count = Math.min(maxCount, Math.round(baseCount + multiple * perMultiple));
    const pts = centers.length ? centers : [new Vec3(0, VIEW_CONFIG.layout.reelCenterY, 0)];
    for (let i = 0; i < count; i++) {
      const p = pts[i % pts.length];
      this.spawn(p.x + (Math.random() * 40 - 20), p.y + (Math.random() * 40 - 20), big);
    }
  }

  /** SUGAR SPARKLES (candy redesign): sweet-coloured motes rising from each
   *  winning cell — pink/gold/mint/sugar-white — drifting up + sideways and
   *  fading. The win indicator that replaces the drawn payline; reads as candy
   *  sparkle off the symbol (was warm fire embers — off-theme for a candy slot),
   *  no geometry. */
  fireEmbers(centers: Vec3[]): void {
    const cfg = VIEW_CONFIG.win.fireEmbers;
    const life = cfg.lifeMs / 1000;
    const warm = [
      new Color(255, 130, 190, 255), // candy pink
      new Color(255, 205, 90, 255), // gold
      new Color(140, 240, 200, 255), // mint
      new Color(255, 250, 250, 255), // sugar-white spark
    ];
    for (const c of centers) {
      // Phase 1 — IGNITE RING: a radial pop of fast, hard-damped light points
      // (the energy leaving the symbol), settling within ~half a second.
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
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
      for (let i = 0; i < cfg.perCell; i++) {
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

  /** Epic-ceremony coin geyser: ballistic gold shards launched from a point.
   *  Real parabola — each coin RISES to an apex (quadOut), then FALLS well past
   *  the board (quadIn) while spinning, fading only near the end, so the screen
   *  reads as a torrent of coins raining down, not a puff that vanishes mid-air. */
  coinGeyser(originX = 0, originY = VIEW_CONFIG.layout.reelCenterY): void {
    const cfg = VIEW_CONFIG.particles.coin;
    const spread = (cfg.spreadDeg * Math.PI) / 180;
    const pool = this.pool;
    for (let i = 0; i < cfg.count; i++) {
      const slot = pool.get(originX, originY, COIN, 1.2);
      if (!slot) return;
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * spread; // upward cone
      const v = cfg.launchSpeed * (0.85 + Math.random() * 0.45);
      const vx = Math.cos(ang) * v;
      const vy = Math.sin(ang) * v;
      // Rise to the apex, then fall far below the launch point.
      const tApex = Math.max(0.18, Math.abs(vy) / cfg.gravity);
      const apexX = originX + vx * tApex;
      const apexY = originY + vy * tApex - 0.5 * cfg.gravity * tApex * tApex;
      const fall = tApex + 0.55 + Math.random() * 0.35;
      const endX = apexX + vx * fall * 0.65;
      const endY = apexY - 0.5 * cfg.gravity * fall * fall; // drops below the board
      const spin = Math.random() * 720 - 360; // each coin tumbles its own way
      const node = slot.node;
      node.angle = 0;
      tween(node)
        .to(
          tApex,
          { position: new Vec3(apexX, apexY, 0), angle: spin * 0.4 },
          { easing: 'quadOut' },
        )
        .to(fall, { position: new Vec3(endX, endY, 0), angle: spin }, { easing: 'quadIn' })
        .start();
      const total = tApex + fall;
      tween(slot.opacity)
        .delay(total * 0.72)
        .to(total * 0.28, { opacity: 0 })
        .call(() => pool.put(slot))
        .start();
    }
  }

  private spawn(x: number, y: number, big: boolean): void {
    // Candy confetti: mostly the sweet-shop mix, a sugar-white sparkle ~1 in 5.
    const color = Math.random() < 0.2 ? WHITE : candy();
    const scale = big ? 0.95 : 0.62;
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
