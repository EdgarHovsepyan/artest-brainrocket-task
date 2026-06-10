// MVC — VIEW. One symbol cell: render + win pulse only. No game rules.
// Built from code by ReelView; falls back to a text label if a sprite frame
// for an id is missing, so the board still reads even without art.

import {
  _decorator,
  Color,
  Component,
  Graphics,
  Label,
  Node,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
} from 'cc';
import { SYMBOL_NAMES } from '../logic/game-config';
import { VIEW_CONFIG } from './view-config';
import { applyFont } from './fonts';

const { ccclass } = _decorator;

@ccclass('SymbolView')
export class SymbolView extends Component {
  private sprite: Sprite | null = null;
  private label: Label | null = null;
  private frames: SpriteFrame[] = [];
  private glow: Node | null = null;
  private glowOp: UIOpacity | null = null;
  private size = 90;
  // Win-VFX layers (slot-vfx artist): built lazily on first win, killed in clear.
  private sheen: Node | null = null;
  private sparkles: Node[] = [];

  /** Build the cell's sprite + text fallback at `size` px square. */
  build(size: number, frames: SpriteFrame[]): void {
    this.frames = frames;
    this.size = size;

    const art = size * VIEW_CONFIG.layout.symbolFill;
    (this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)).setContentSize(
      art,
      art,
    );
    const sp = this.node.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.type = Sprite.Type.SIMPLE;
    this.sprite = sp;

    const lblNode = new Node('fallback');
    lblNode.addComponent(UITransform).setContentSize(size, size);
    this.node.addChild(lblNode);
    const lbl = lblNode.addComponent(Label);
    lbl.fontSize = Math.round(size * 0.34);
    lbl.lineHeight = lbl.fontSize + 2;
    lbl.isBold = true;
    lbl.color = new Color(245, 247, 250, 255); // white-smoke (brand: no acid yellow)
    applyFont(lbl, 'display');
    this.label = lbl;

    // Win light-up: a bright ACID diamond light-frame (outline + faint fill, NEVER a
    // circle) that flashes around the cell on win so winners visibly light up, not just
    // grow. Hidden when idle; transform + opacity only; killed in clear().
    const glowNode = new Node('winGlow');
    glowNode.addComponent(UITransform).setContentSize(size, size);
    this.node.addChild(glowNode);
    const gg = glowNode.addComponent(Graphics);
    const r = size * 0.72;
    const diamond = () => {
      gg.moveTo(0, -r);
      gg.lineTo(r, 0);
      gg.lineTo(0, r);
      gg.lineTo(-r, 0);
      gg.close();
    };
    gg.fillColor = new Color(255, 0, 127, 40); // brand magenta (was legacy acid yellow)
    diamond();
    gg.fill();
    gg.lineWidth = 4;
    gg.strokeColor = new Color(255, 90, 156, 255);
    diamond();
    gg.stroke();
    glowNode.setScale(0.8, 0.8, 1);
    this.glow = glowNode;
    this.glowOp = glowNode.addComponent(UIOpacity);
    this.glowOp.opacity = 0;
  }

  /** Show symbol `id` — sprite if its frame loaded, else the id's name. */
  setSymbol(id: number): void {
    const frame = this.frames[id] ?? null;
    if (this.sprite) this.sprite.spriteFrame = frame;
    if (this.label) this.label.string = frame ? '' : (SYMBOL_NAMES[id] ?? String(id));
  }

  /** Win pulse + light-up — driven by Cocos Tween. `delay` enables an L→R ripple. */
  playWin(delay = 0): void {
    const { symbolPulseScale, symbolPulseMs } = VIEW_CONFIG.win;
    const half = symbolPulseMs / 2 / 1000; // ms → s, two halves
    Tween.stopAllByTarget(this.node);
    this.node.setScale(1, 1, 1);
    const pop = symbolPulseScale + 0.12; // first beat overshoots → the win has an attack
    tween(this.node)
      .delay(delay)
      .to(half, { scale: new Vec3(pop, pop, 1) }, { easing: 'backOut' })
      .to(half, { scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' })
      .to(half, { scale: new Vec3(symbolPulseScale, symbolPulseScale, 1) }, { easing: 'quadOut' })
      .to(half, { scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' })
      .to(half, { scale: new Vec3(symbolPulseScale, symbolPulseScale, 1) }, { easing: 'quadOut' })
      .to(half, { scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' })
      .start();
    if (this.glow && this.glowOp) {
      Tween.stopAllByTarget(this.glow);
      Tween.stopAllByTarget(this.glowOp);
      this.glow.setScale(0.8, 0.8, 1);
      this.glowOp.opacity = 0;
      tween(this.glowOp)
        .delay(delay)
        .to(half, { opacity: 200 })
        .to(half, { opacity: 0 })
        .union()
        .repeat(3)
        .start();
      tween(this.glow)
        .delay(delay)
        .to(half, { scale: new Vec3(1.35, 1.35, 1) }, { easing: 'quadOut' })
        .to(half, { scale: new Vec3(0.8, 0.8, 1) }, { easing: 'quadIn' })
        .union()
        .repeat(3)
        .start();
    }
    this.playSheen(delay);
    this.playSparkles(delay);
  }

  /** SHEEN SWEEP (slot-vfx Layer 7): a bright diagonal specular streak rakes
   *  top->bottom across the symbol face, looping — reads as light catching a
   *  glossy candy surface. Built lazily on first win. */
  private playSheen(delay: number): void {
    if (!this.sheen) {
      const s = this.size;
      const n = new Node('sheen');
      n.addComponent(UITransform).setContentSize(s, s);
      this.node.addChild(n);
      const g = n.addComponent(Graphics);
      // thin bright parallelogram (diagonal streak), no circles
      g.fillColor = new Color(255, 255, 255, 70);
      g.moveTo(-s * 0.12, s * 0.6);
      g.lineTo(s * 0.06, s * 0.6);
      g.lineTo(-s * 0.06, -s * 0.6);
      g.lineTo(-s * 0.24, -s * 0.6);
      g.close();
      g.fill();
      n.addComponent(UIOpacity).opacity = 0;
      this.sheen = n;
    }
    const sheen = this.sheen;
    const s = this.size;
    const op = sheen.getComponent(UIOpacity)!;
    Tween.stopAllByTarget(sheen);
    Tween.stopAllByTarget(op);
    sheen.setPosition(-s * 0.55, s * 0.5, 0);
    op.opacity = 0;
    // sweep position L->R, fade in/out at the ends; loop until cleared.
    tween(sheen)
      .delay(delay)
      .to(0.55, { position: new Vec3(s * 0.55, -s * 0.5, 0) }, { easing: 'sineInOut' })
      .delay(0.7)
      .union()
      .repeatForever()
      .start();
    tween(op)
      .delay(delay)
      .to(0.18, { opacity: 150 })
      .to(0.37, { opacity: 0 })
      .delay(0.7)
      .union()
      .repeatForever()
      .start();
  }

  /** EDGE SPARKLE (slot-vfx Layer 8): four tiny diamonds twinkle at the cell
   *  corners on a staggered loop. Pure opacity + scale, no circles. */
  private playSparkles(delay: number): void {
    if (this.sparkles.length === 0) {
      const s = this.size;
      const corners = [
        [-s * 0.4, s * 0.4],
        [s * 0.4, s * 0.4],
        [s * 0.4, -s * 0.4],
        [-s * 0.4, -s * 0.4],
      ];
      for (const [x, y] of corners) {
        const n = new Node('spark');
        n.addComponent(UITransform).setContentSize(12, 12);
        n.setPosition(x, y, 0);
        const g = n.addComponent(Graphics);
        g.fillColor = new Color(255, 224, 255, 255);
        g.moveTo(0, 6);
        g.lineTo(5, 0);
        g.lineTo(0, -6);
        g.lineTo(-5, 0);
        g.close();
        g.fill();
        n.addComponent(UIOpacity).opacity = 0;
        this.node.addChild(n);
        this.sparkles.push(n);
      }
    }
    this.sparkles.forEach((n, i) => {
      const op = n.getComponent(UIOpacity)!;
      Tween.stopAllByTarget(op);
      Tween.stopAllByTarget(n);
      op.opacity = 0;
      n.setScale(0.4, 0.4, 1);
      tween(op)
        .delay(delay + i * 0.18)
        .to(0.16, { opacity: 230 })
        .to(0.3, { opacity: 0 })
        .delay(0.7)
        .union()
        .repeatForever()
        .start();
      tween(n)
        .delay(delay + i * 0.18)
        .to(0.16, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .to(0.3, { scale: new Vec3(0.4, 0.4, 1) })
        .delay(0.7)
        .union()
        .repeatForever()
        .start();
    });
  }

  /** Kill the looping win layers (called from clear on the next spin). */
  private stopWinFx(): void {
    if (this.sheen) {
      Tween.stopAllByTarget(this.sheen);
      const op = this.sheen.getComponent(UIOpacity);
      if (op) {
        Tween.stopAllByTarget(op);
        op.opacity = 0;
      }
    }
    this.sparkles.forEach((n) => {
      Tween.stopAllByTarget(n);
      const op = n.getComponent(UIOpacity);
      if (op) {
        Tween.stopAllByTarget(op);
        op.opacity = 0;
      }
    });
  }

  /** Sharp one-shot WILD-landing flash: scale punch + single hot glow strike.
   *  Distinct from playWin (sustained pulse) — this is the "it just hit" beat. */
  flashWildLand(delay = 0): void {
    Tween.stopAllByTarget(this.node);
    this.node.setScale(1, 1, 1);
    tween(this.node)
      .delay(delay)
      .to(0.09, { scale: new Vec3(1.26, 1.26, 1) }, { easing: 'quadOut' })
      .to(0.22, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .start();
    if (this.glow && this.glowOp) {
      Tween.stopAllByTarget(this.glow);
      Tween.stopAllByTarget(this.glowOp);
      this.glow.setScale(0.7, 0.7, 1);
      this.glowOp.opacity = 0;
      tween(this.glowOp).delay(delay).to(0.07, { opacity: 235 }).to(0.3, { opacity: 0 }).start();
      tween(this.glow)
        .delay(delay)
        .to(0.34, { scale: new Vec3(1.5, 1.5, 1) }, { easing: 'quadOut' })
        .start();
    }
  }

  /** Sticky-lock confirmation: small settle pop + a HELD glow rim (reads as
   *  "locked in", not a respin win). */
  playLock(delay = 0): void {
    Tween.stopAllByTarget(this.node);
    this.node.setScale(1, 1, 1);
    tween(this.node)
      .delay(delay)
      .to(0.08, { scale: new Vec3(1.14, 1.14, 1) }, { easing: 'quadOut' })
      .to(0.16, { scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' })
      .start();
    if (this.glow && this.glowOp) {
      Tween.stopAllByTarget(this.glow);
      Tween.stopAllByTarget(this.glowOp);
      this.glow.setScale(1, 1, 1);
      tween(this.glowOp)
        .delay(delay)
        .to(0.1, { opacity: 150 })
        .delay(0.45)
        .to(0.35, { opacity: 0 })
        .start();
    }
  }

  /** Tactile landing squash-and-stretch (the reel "thunk"). */
  playLand(squashY: number): void {
    Tween.stopAllByTarget(this.node);
    this.node.setScale(1, 1, 1);
    tween(this.node)
      .to(0.06, { scale: new Vec3(1 + (1 - squashY), squashY, 1) }, { easing: 'quadOut' })
      .to(0.13, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .start();
  }

  clear(): void {
    Tween.stopAllByTarget(this.node);
    this.node.setScale(1, 1, 1);
    if (this.glow) {
      Tween.stopAllByTarget(this.glow);
      this.glow.setScale(0.8, 0.8, 1);
    }
    if (this.glowOp) {
      Tween.stopAllByTarget(this.glowOp);
      this.glowOp.opacity = 0;
    }
    this.stopWinFx();
  }
}
