// MVC — VIEW. Arcane column glow + jagged lightning over the reels that are still
// to stop when an early-WILD anticipation is brewing. Task 5.2: rebuilt aura per
// the ULTRACODE blueprint — stacked-alpha magenta column + boltCount jagged bolts
// re-randomised every reStrikeMs on a schedule (ms-budget kept tight to stay 60
// fps). Reduced-motion: column only, no lightning re-strikes.
//
// NOTE: shining-pop's math has no SCATTER symbol (PAYTABLE locked to WILD + H/L
// tiers), so the trigger stays `minEarlyWilds`. The visual rebuild ships either
// way; the blueprint's "retarget to scatter" is engine-impossible here without a
// math change.

import {
  _decorator,
  Color,
  Component,
  Graphics,
  Node,
  tween,
  Tween,
  UIOpacity,
  UITransform,
} from 'cc';
import { VIEW_CONFIG } from './view-config';

const { ccclass } = _decorator;

interface Glow {
  node: Node;
  columnG: Graphics;
  boltG: Graphics;
  op: UIOpacity;
  w: number;
  h: number;
  reduced: boolean;
}

@ccclass('AnticipationLayer')
export class AnticipationLayer extends Component {
  private glows: Glow[] = [];
  /** Schedule key for the lightning re-strike loop — bound here so unschedule
   *  matches the same reference. dt-accumulated against reStrikeMs. */
  private strikeAccum = 0;

  /** Pulse a column centred at (x, y), `w`×`h` px, until cleared.
   *  `reduced` skips the lightning + breathes only. */
  spawn(x: number, y: number, w: number, h: number, reduced = false): void {
    const cfg = VIEW_CONFIG.anticipation;
    const auraCol = new Color().fromHEX(cfg.auraColor);

    const n = new Node('antic');
    n.addComponent(UITransform).setContentSize(w, h);
    n.setPosition(x, y, 0);
    this.node.addChild(n);
    n.layer = this.node.layer; // UI_2D so the 2D renderer draws it

    // Stacked-alpha magenta column — 4 inset rounded rects fake a soft falloff.
    const columnG = n.addComponent(Graphics);
    const fillTint = (alpha: number) => new Color(auraCol.r, auraCol.g, auraCol.b, alpha);
    columnG.fillColor = fillTint(20);
    columnG.roundRect(-w / 2, -h / 2, w, h, 10);
    columnG.fill();
    columnG.fillColor = fillTint(38);
    columnG.roundRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 8);
    columnG.fill();
    columnG.fillColor = fillTint(54);
    columnG.roundRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 6);
    columnG.fill();
    columnG.lineWidth = 3;
    columnG.strokeColor = new Color(auraCol.r, auraCol.g, auraCol.b, 220);
    columnG.roundRect(-w / 2, -h / 2, w, h, 10);
    columnG.stroke();

    // Lightning bolt overlay — its own Graphics so we can clear+redraw without
    // wiping the column. Sibling node so it inherits the same opacity envelope.
    const boltNode = new Node('antic_bolts');
    boltNode.addComponent(UITransform).setContentSize(w, h);
    n.addChild(boltNode);
    boltNode.layer = this.node.layer;
    const boltG = boltNode.addComponent(Graphics);

    const op = n.addComponent(UIOpacity);
    op.opacity = 50;
    tween(op)
      .to(0.32, { opacity: 220 }, { easing: 'sineOut' })
      .to(0.32, { opacity: 60 }, { easing: 'sineIn' })
      .union()
      .repeatForever()
      .start();

    const g: Glow = { node: n, columnG, boltG, op, w, h, reduced };
    this.glows.push(g);
    // Strike immediately on spawn (first impression matters) + schedule re-strikes.
    if (!reduced) {
      this.drawBolts(g);
      if (this.glows.length === 1) {
        this.strikeAccum = 0;
        this.schedule(this.tickStrike, 0);
      }
    }
  }

  /** Per-frame: every reStrikeMs, randomly re-draw lightning bolts in every glow. */
  private tickStrike = (dt: number): void => {
    if (!this.glows.length) {
      this.unschedule(this.tickStrike);
      return;
    }
    this.strikeAccum += dt * 1000;
    const cfg = VIEW_CONFIG.anticipation;
    if (this.strikeAccum < cfg.reStrikeMs) return;
    this.strikeAccum = 0;
    for (const g of this.glows) if (!g.reduced) this.drawBolts(g);
  };

  private drawBolts(g: Glow): void {
    const cfg = VIEW_CONFIG.anticipation;
    const boltCol = new Color(255, 255, 255, 220);
    const haloCol = new Color().fromHEX(cfg.auraColor);
    haloCol.a = 140;
    const { w, h } = g;
    g.boltG.clear();
    for (let i = 0; i < cfg.boltCount; i++) {
      // Jagged downward zigzag spanning the column height; x jitters around 0.
      const startX = (Math.random() - 0.5) * w * 0.6;
      const startY = h / 2 - 4;
      const endY = -h / 2 + 4;
      const segments = 5 + Math.floor(Math.random() * 3);
      const pts: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
      for (let s = 1; s <= segments; s++) {
        const t = s / segments;
        const y = startY + (endY - startY) * t;
        const x = startX + (Math.random() - 0.5) * w * 0.45;
        pts.push({ x, y });
      }
      // Outer halo stroke (wide, soft alpha)
      g.boltG.lineWidth = 6;
      g.boltG.strokeColor = haloCol;
      g.boltG.moveTo(pts[0].x, pts[0].y);
      for (let p = 1; p < pts.length; p++) g.boltG.lineTo(pts[p].x, pts[p].y);
      g.boltG.stroke();
      // Inner hot stroke (thin, bright white)
      g.boltG.lineWidth = 2;
      g.boltG.strokeColor = boltCol;
      g.boltG.moveTo(pts[0].x, pts[0].y);
      for (let p = 1; p < pts.length; p++) g.boltG.lineTo(pts[p].x, pts[p].y);
      g.boltG.stroke();
    }
  }

  clear(): void {
    this.unschedule(this.tickStrike);
    this.strikeAccum = 0;
    for (const g of this.glows) {
      if (!g.node.isValid) continue;
      Tween.stopAllByTarget(g.op);
      g.node.destroy();
    }
    this.glows = [];
  }
}
