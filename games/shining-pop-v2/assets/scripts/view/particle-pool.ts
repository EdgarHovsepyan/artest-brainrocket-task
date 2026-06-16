// MVC — VIEW. Object pool of pre-allocated shard Nodes (Graphics + UIOpacity) so
// burst() / sparkCascade() / coinGeyser() borrow & return instead of new/destroy
// on every shard. Sized by VIEW_CONFIG.particles.{prealloc, poolCap}. When the
// pool is full, get() returns null and the caller silently drops the spawn —
// the pool never grows past poolCap (predictable upper bound, GC-quiet hot path).
//
// Task 5.4 / CC-2 in ULTRACODE-BLUEPRINT.md.

import {
  _decorator,
  Color,
  Component,
  Graphics,
  Material,
  Node,
  Sprite,
  SpriteFrame,
  UIOpacity,
  UITransform,
} from 'cc';
import { VIEW_CONFIG } from './view-config';

const { ccclass } = _decorator;

/** Unit-diamond half-extent in design px. Node scale multiplies this. */
const UNIT = 8;
/** Glow-sprite extent — wider than the diamond so the halo can feather out. */
const GLOW = UNIT * 6;

export interface PoolShard {
  node: Node;
  graphics: Graphics;
  opacity: UIOpacity;
  /** Set once the shard is upgraded to the additive glow sprite. */
  sprite?: Sprite;
  /** Stable slot index for O(1) return-to-pool. */
  idx: number;
}

@ccclass('ParticlePool')
export class ParticlePool extends Component {
  // CGI upgrade — SlotView injects the additive glow material + white frame
  // once the effect kit loads; every shard then renders as a soft light point
  // instead of a filled diamond. Statics so no plumbing through ParticleLayer.
  static glowMat: Material | null = null;
  static glowFrame: SpriteFrame | null = null;

  private slots: PoolShard[] = [];
  private freeIdx: number[] = [];
  private liveCount = 0;
  private built = false;

  onLoad(): void {
    this.ensureBuilt();
  }

  private ensureBuilt(): void {
    if (this.built) return;
    const { prealloc } = VIEW_CONFIG.particles;
    for (let i = 0; i < prealloc; i++) this.allocate();
    this.built = true;
  }

  private allocate(): PoolShard {
    const n = new Node('shard');
    n.addComponent(UITransform).setContentSize(UNIT * 2, UNIT * 2);
    n.layer = this.node.layer;
    n.setPosition(0, 0, 0);
    n.active = false;
    this.node.addChild(n);

    const g = n.addComponent(Graphics);
    g.fillColor = new Color(255, 255, 255, 255);
    this.drawDiamond(g);

    const op = n.addComponent(UIOpacity);
    op.opacity = 255;

    const slot: PoolShard = { node: n, graphics: g, opacity: op, idx: this.slots.length };
    this.slots.push(slot);
    this.freeIdx.push(slot.idx);
    return slot;
  }

  private drawDiamond(g: Graphics): void {
    g.moveTo(0, UNIT);
    g.lineTo(UNIT, 0);
    g.lineTo(0, -UNIT);
    g.lineTo(-UNIT, 0);
    g.close();
    g.fill();
  }

  /**
   * Borrow a shard configured at (x,y) with `color` tint and `scale` multiplier.
   * Returns null if liveCount >= poolCap — caller must handle (silently drop the spawn).
   * Cheap re-tint: clear + fillColor + redraw the 4-vertex diamond + fill.
   */
  get(x: number, y: number, color: Color, scale = 1): PoolShard | null {
    this.ensureBuilt();
    const { poolCap } = VIEW_CONFIG.particles;
    if (this.liveCount >= poolCap) return null;

    let slot: PoolShard;
    const idx = this.freeIdx.pop();
    if (idx !== undefined) {
      slot = this.slots[idx]!;
    } else if (this.slots.length < poolCap) {
      slot = this.allocate();
      // allocate() pushed onto freeIdx — pop it back off since we're using it.
      this.freeIdx.pop();
    } else {
      return null;
    }

    // Upgrade to the glow sprite the first time the material is available;
    // the diamond stays as the no-material fallback.
    if (!slot.sprite && ParticlePool.glowMat && ParticlePool.glowFrame) {
      slot.graphics.clear();
      const sp = slot.node.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      sp.type = Sprite.Type.SIMPLE;
      sp.spriteFrame = ParticlePool.glowFrame;
      sp.customMaterial = ParticlePool.glowMat;
      slot.node.getComponent(UITransform)!.setContentSize(GLOW, GLOW);
      slot.sprite = sp;
    }
    if (slot.sprite) {
      slot.sprite.color = color;
    } else {
      const g = slot.graphics;
      g.clear();
      g.fillColor = color;
      this.drawDiamond(g);
    }

    slot.node.setPosition(x, y, 0);
    slot.node.setScale(scale, scale, 1);
    slot.node.angle = 0;
    slot.opacity.opacity = 255;
    slot.node.active = true;

    this.liveCount++;
    return slot;
  }

  /**
   * Return a shard to the pool. Safe to call on already-returned or destroyed slots
   * (idempotent guards). Resets transform/opacity so the next get() lands clean.
   */
  put(slot: PoolShard | null): void {
    if (!slot || !slot.node || !slot.node.isValid) return;
    if (!slot.node.active) return;
    slot.node.active = false;
    slot.node.setPosition(0, 0, 0);
    slot.node.setScale(1, 1, 1);
    slot.node.angle = 0;
    slot.opacity.opacity = 255;
    this.freeIdx.push(slot.idx);
    this.liveCount--;
    if (this.liveCount < 0) this.liveCount = 0;
  }

  /** Live (borrowed, not-yet-returned) shard count — for guard tests + telemetry. */
  get live(): number {
    return this.liveCount;
  }

  /** Total slots currently allocated (<= poolCap). */
  get capacity(): number {
    return this.slots.length;
  }
}
