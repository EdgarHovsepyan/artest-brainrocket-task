// MVC — VIEW. Acid/white diamond shards bursting from winning cells, scaled by the
// win-to-bet multiple. Ported from the monolith's winBurst/spawnShard.

import {
  _decorator,
  Color,
  Component,
  Graphics,
  Node,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
} from 'cc';
import { VIEW_CONFIG } from './view-config';

const { ccclass } = _decorator;
const ACID = new Color(234, 255, 0, 255);
const WHITE = new Color(255, 255, 255, 255);

@ccclass('ParticleLayer')
export class ParticleLayer extends Component {
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

  private spawn(x: number, y: number, big: boolean): void {
    const n = new Node('shard');
    n.addComponent(UITransform).setContentSize(16, 16);
    n.setPosition(x, y, 0);
    this.node.addChild(n);

    const g = n.addComponent(Graphics);
    const s = big ? 7 : 4;
    g.fillColor = Math.random() < 0.5 ? ACID : WHITE;
    g.moveTo(0, s);
    g.lineTo(s, 0);
    g.lineTo(0, -s);
    g.lineTo(-s, 0);
    g.close();
    g.fill();

    const op = n.addComponent(UIOpacity);
    const ang = Math.random() * Math.PI * 2;
    const dist = (big ? 150 : 80) * (0.5 + Math.random());
    const life = 0.5 + Math.random() * 0.4;
    tween(n)
      .to(
        life,
        {
          position: new Vec3(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist - 70, 0),
          scale: new Vec3(0.25, 0.25, 1),
          angle: Math.random() * 180 - 90,
        },
        { easing: 'quadOut' },
      )
      .start();
    tween(op)
      .delay(life * 0.5)
      .to(life * 0.5, { opacity: 0 })
      .call(() => n.destroy())
      .start();
  }
}
