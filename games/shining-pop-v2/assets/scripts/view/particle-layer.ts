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

@ccclass('ParticleLayer')
export class ParticleLayer extends Component {
  private pool!: ParticlePool;

  onLoad(): void {
    this.pool = this.node.getComponent(ParticlePool) ?? this.node.addComponent(ParticlePool);
  }

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
    ];
    for (const c of centers) {
      for (let i = 0; i < cfg.perCell; i++) {
        const color = warm[i % warm.length]!;
        const slot = this.pool.get(c.x, c.y, color, 0.4 + Math.random() * 0.5);
        if (!slot) return; // pool full
        const endX = c.x + (Math.random() - 0.5) * cfg.spreadPx * 2;
        const endY = c.y + cfg.riseSpeed * life * (0.6 + Math.random() * 0.6);
        this.ballistic(slot, endX, endY, life * (0.7 + Math.random() * 0.5), 'quadOut');
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

  /** Epic-ceremony coin geyser: ballistic gold-tinted shards launched from a point. */
  coinGeyser(originX = 0, originY = VIEW_CONFIG.layout.reelCenterY): void {
    const cfg = VIEW_CONFIG.particles.coin;
    const spread = (cfg.spreadDeg * Math.PI) / 180;
    const life = 1.0;
    for (let i = 0; i < cfg.count; i++) {
      const slot = this.pool.get(originX, originY, COIN, 1.2);
      if (!slot) return;
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * spread; // upward cone
      const v = cfg.launchSpeed * (0.85 + Math.random() * 0.3);
      const vx = Math.cos(ang) * v;
      const vy = Math.sin(ang) * v;
      const endX = originX + vx * life;
      const endY = originY + vy * life - 0.5 * cfg.gravity * life * life;
      this.ballistic(slot, endX, endY, life, 'quadIn');
    }
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
