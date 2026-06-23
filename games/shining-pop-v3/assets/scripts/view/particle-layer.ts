import { _decorator, Color, Component, tween, Vec3 } from 'cc';
import { ParticlePool, PoolShard } from './particle-pool';
import { VIEW_CONFIG } from './view-config';
import { VfxGovernor, VfxStats } from './perf';

const { ccclass } = _decorator;
const WHITE = new Color(255, 255, 255, 255);
const COIN = new Color(255, 196, 64, 255);

// Sugar Rush burst palette: pink-led with cyan/mint/fuchsia signal + gold. Each entry
// is a fresh Color; candy() returns a .clone() so per-particle alpha fades never mutate
// the shared swatch (singleton-mutation guard).
const CANDY = [
  new Color(255, 0, 127, 255), // pink p500
  new Color(255, 138, 184, 255), // pink p200
  new Color(127, 231, 255, 255), // cyan
  new Color(82, 209, 137, 255), // mint
  new Color(255, 42, 208, 255), // fuchsia
  new Color(233, 184, 78, 255), // gold
  new Color(255, 250, 252, 255), // sugar white
];
const candy = () => CANDY[(Math.random() * CANDY.length) | 0]!.clone();

interface PhysParticle {
  slot: PoolShard;
  vx: number;
  vy: number;

  g: number;

  damp: number;
  life: number;
  age: number;

  ph: number;
  s0: number;
}

@ccclass('ParticleLayer')
export class ParticleLayer extends Component {
  private pool!: ParticlePool;

  private phys: PhysParticle[] = [];
  private physOn = false;

  private readonly gov = new VfxGovernor(VIEW_CONFIG.vfx.quality);

  onLoad(): void {
    this.pool = this.node.getComponent(ParticlePool) ?? this.node.addComponent(ParticlePool);
  }

  update(dt: number): void {
    this.gov.sample(dt);
  }

  vfxStats(): VfxStats {
    return {
      fps: this.gov.emaFps,
      scale: this.gov.scale,
      live: this.pool?.live ?? 0,
      cap: VIEW_CONFIG.particles.poolCap,
    };
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
    if (!slot) return;
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

  burst(centers: Vec3[], multiple: number): void {
    const { baseCount, perMultiple, maxCount } = VIEW_CONFIG.particles;
    const big = multiple >= VIEW_CONFIG.ceremony.showMinMultiple;
    const raw = Math.min(maxCount, Math.round(baseCount + multiple * perMultiple));
    const count = this.gov.count(raw, big ? 8 : 4);
    const pts = centers.length ? centers : [new Vec3(0, VIEW_CONFIG.layout.reelCenterY, 0)];
    for (let i = 0; i < count; i++) {
      const p = pts[i % pts.length];
      this.spawn(p.x + (Math.random() * 40 - 20), p.y + (Math.random() * 40 - 20), big);
    }
  }

  fireEmbers(centers: Vec3[]): void {
    const cfg = VIEW_CONFIG.win.fireEmbers;
    const life = cfg.lifeMs / 1000;
    // Use the shared CANDY palette so every emitter matches the candy theme.
    const warm = CANDY;

    const ringCount = this.gov.count(8, 5);
    const cellCount = this.gov.count(cfg.perCell, 3);
    for (const c of centers) {
      for (let i = 0; i < ringCount; i++) {
        const ang = (i / ringCount) * Math.PI * 2 + Math.random() * 0.4;
        const v = 240 + Math.random() * 120;
        this.spawnPhys(
          c.x,
          c.y,
          warm[i % warm.length]!,
          0.2 + Math.random() * 0.15,
          Math.cos(ang) * v,
          Math.sin(ang) * v,
          -40,
          0.86,
          0.4 + Math.random() * 0.2,
        );
      }

      for (let i = 0; i < cellCount; i++) {
        const hot = i % 4 === 3;
        this.spawnPhys(
          c.x + (Math.random() - 0.5) * cfg.spreadPx,
          c.y + (Math.random() - 0.5) * 24,
          warm[i % warm.length]!,
          hot ? 0.12 + Math.random() * 0.12 : 0.45 + Math.random() * 0.55,
          (Math.random() - 0.5) * 90,
          cfg.riseSpeed * (hot ? 1.6 + Math.random() : 0.7 + Math.random() * 0.7),
          -130,
          0.985,
          life * (hot ? 0.5 + Math.random() * 0.3 : 0.9 + Math.random() * 0.6),
        );
      }
    }
  }

  sparkCascade(x: number, y: number): void {
    const cfg = VIEW_CONFIG.win.svarka;
    const color = new Color().fromHEX(cfg.sparkColor);
    const life = cfg.sparkLifeMs / 1000;
    const g = cfg.sparkGravity;
    const sparks = this.gov.count(cfg.sparkPerStep, 1);
    for (let i = 0; i < sparks; i++) {
      const slot = this.pool.get(x, y, color, 0.6 + Math.random() * 0.4);
      if (!slot) return;
      const vx = (Math.random() - 0.5) * 200;
      const vy = -60 + Math.random() * 40;
      const endX = x + vx * life;
      const endY = y + vy * life - 0.5 * g * life * life;
      this.ballistic(slot, endX, endY, life, 'quadIn');
    }
  }

  coinGeyser(originX = 0, originY = VIEW_CONFIG.layout.reelCenterY): void {
    const cfg = VIEW_CONFIG.particles.coin;
    const spread = (cfg.spreadDeg * Math.PI) / 180;
    const pool = this.pool;
    const coins = this.gov.count(cfg.count, 8);
    for (let i = 0; i < coins; i++) {
      const slot = pool.get(originX, originY, COIN, 1.2);
      if (!slot) return;
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * spread;
      const v = cfg.launchSpeed * (0.85 + Math.random() * 0.45);
      const vx = Math.cos(ang) * v;
      const vy = Math.sin(ang) * v;

      const tApex = Math.max(0.18, Math.abs(vy) / cfg.gravity);
      const apexX = originX + vx * tApex;
      const apexY = originY + vy * tApex - 0.5 * cfg.gravity * tApex * tApex;
      const fall = tApex + 0.55 + Math.random() * 0.35;
      const endX = apexX + vx * fall * 0.65;
      const endY = apexY - 0.5 * cfg.gravity * fall * fall;
      const spin = Math.random() * 720 - 360;
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
    const color = Math.random() < 0.2 ? WHITE : candy();
    const scale = big ? 0.95 : 0.62;
    const slot = this.pool.get(x, y, color, scale);
    if (!slot) return;
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
