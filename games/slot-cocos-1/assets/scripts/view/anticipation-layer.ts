// MVC — VIEW. Pulsing acid column glow over the reels that are still to stop when
// a WILD STRIKE is brewing (2+ early wilds). Ported from the monolith's spawnAnticGlow.

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

const { ccclass } = _decorator;
const ACID = new Color(234, 255, 0, 255);

@ccclass('AnticipationLayer')
export class AnticipationLayer extends Component {
  private glows: Node[] = [];

  /** Pulse a column centred at (x, y), `w`×`h` px, until cleared. */
  spawn(x: number, y: number, w: number, h: number): void {
    const n = new Node('antic');
    n.addComponent(UITransform).setContentSize(w, h);
    n.setPosition(x, y, 0);
    this.node.addChild(n);
    n.layer = this.node.layer; // UI_2D so the 2D renderer draws it

    const g = n.addComponent(Graphics);
    g.fillColor = new Color(234, 255, 0, 28);
    g.lineWidth = 3;
    g.strokeColor = ACID;
    g.roundRect(-w / 2, -h / 2, w, h, 8);
    g.fill();
    g.stroke();

    const op = n.addComponent(UIOpacity);
    op.opacity = 50;
    tween(op)
      .to(0.32, { opacity: 220 }, { easing: 'sineOut' })
      .to(0.32, { opacity: 60 }, { easing: 'sineIn' })
      .union()
      .repeatForever()
      .start();

    this.glows.push(n);
  }

  clear(): void {
    for (const n of this.glows) {
      if (!n.isValid) continue;
      const op = n.getComponent(UIOpacity);
      if (op) Tween.stopAllByTarget(op);
      n.destroy();
    }
    this.glows = [];
  }
}
