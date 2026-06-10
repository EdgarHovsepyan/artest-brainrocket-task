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

const { ccclass } = _decorator;

@ccclass('SymbolView')
export class SymbolView extends Component {
  private sprite: Sprite | null = null;
  private label: Label | null = null;
  private frames: SpriteFrame[] = [];
  private glow: Node | null = null;
  private glowOp: UIOpacity | null = null;

  /** Build the cell's sprite + text fallback at `size` px square. */
  build(size: number, frames: SpriteFrame[]): void {
    this.frames = frames;

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
  }
}
