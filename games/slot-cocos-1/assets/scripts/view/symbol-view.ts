// MVC — VIEW. One symbol cell: render + win pulse only. No game rules.
// Built from code by ReelView; falls back to a text label if a sprite frame
// for an id is missing, so the board still reads even without art.

import {
  _decorator,
  Color,
  Component,
  Label,
  Node,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
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
    lbl.color = new Color(234, 255, 0, 255);
    this.label = lbl;
  }

  /** Show symbol `id` — sprite if its frame loaded, else the id's name. */
  setSymbol(id: number): void {
    const frame = this.frames[id] ?? null;
    if (this.sprite) this.sprite.spriteFrame = frame;
    if (this.label) this.label.string = frame ? '' : (SYMBOL_NAMES[id] ?? String(id));
  }

  /** Win pulse — driven by Cocos Tween. */
  playWin(): void {
    const { symbolPulseScale, symbolPulseMs } = VIEW_CONFIG.win;
    const half = symbolPulseMs / 2 / 1000; // ms → s, two halves
    Tween.stopAllByTarget(this.node);
    this.node.setScale(1, 1, 1);
    tween(this.node)
      .to(half, { scale: new Vec3(symbolPulseScale, symbolPulseScale, 1) }, { easing: 'quadOut' })
      .to(half, { scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' })
      .union()
      .repeat(3)
      .start();
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
  }
}
