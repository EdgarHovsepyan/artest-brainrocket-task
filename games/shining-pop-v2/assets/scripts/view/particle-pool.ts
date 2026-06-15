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

      this.freeIdx.pop();
    } else {
      return null;
    }

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
}
