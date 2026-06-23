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

const UNIT = 8;

const GLOW = UNIT * 6;

export interface PoolShard {
  node: Node;
  graphics: Graphics;
  opacity: UIOpacity;

  sprite?: Sprite;

  idx: number;
}

@ccclass('ParticlePool')
export class ParticlePool extends Component {
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
    // Prealloc the WHOLE pool (full cap, not the smaller `prealloc` hint) at warmup so a
    // 15-cell win can never grow the pool mid-frame: zero addComponent/allocate during play.
    const { poolCap } = VIEW_CONFIG.particles;
    for (let i = 0; i < poolCap; i++) this.allocate();
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
    this.drawDot(g);

    const op = n.addComponent(UIOpacity);
    op.opacity = 255;

    const slot: PoolShard = { node: n, graphics: g, opacity: op, idx: this.slots.length };

    // Decide the shard render mode (Sprite+material vs Graphics) at PREALLOC time. If the
    // glow material/frame are ready, attach the Sprite now so no addComponent fires in get()
    // during play. We keep the Graphics around (cleared) for the no-material fallback path.
    if (ParticlePool.glowMat && ParticlePool.glowFrame) {
      g.clear();
      const sp = n.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      sp.type = Sprite.Type.SIMPLE;
      sp.spriteFrame = ParticlePool.glowFrame;
      sp.customMaterial = ParticlePool.glowMat;
      n.getComponent(UITransform)!.setContentSize(GLOW, GLOW);
      slot.sprite = sp;
    }

    this.slots.push(slot);
    this.freeIdx.push(slot.idx);
    return slot;
  }

  private drawDot(g: Graphics): void {
    g.circle(0, 0, UNIT);
    g.fill();
  }

  get(x: number, y: number, color: Color, scale = 1): PoolShard | null {
    this.ensureBuilt();
    const { poolCap } = VIEW_CONFIG.particles;
    if (this.liveCount >= poolCap) return null;

    // Pool is fully prealloc'd at warmup, so this is a pure free-list pop — never an
    // addComponent/allocate during play. If the free list is empty we're at cap → null.
    const idx = this.freeIdx.pop();
    if (idx === undefined) return null;
    const slot = this.slots[idx]!;

    if (slot.sprite) {
      slot.sprite.color = color;
    } else {
      const g = slot.graphics;
      g.clear();
      g.fillColor = color;
      this.drawDot(g);
    }

    slot.node.setPosition(x, y, 0);
    slot.node.setScale(scale, scale, 1);
    slot.node.angle = 0;
    slot.opacity.opacity = 255;
    slot.node.active = true;

    this.liveCount++;
    return slot;
  }

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

  get live(): number {
    return this.liveCount;
  }

  get capacity(): number {
    return this.slots.length;
  }

  /** Free shards remaining before get() starts returning null (cap minus live). */
  get headroom(): number {
    const free = VIEW_CONFIG.particles.poolCap - this.liveCount;
    return free > 0 ? free : 0;
  }
}
