// MVC — VIEW. Tiered win ceremony (BIG / MEGA / EPIC). Pure Graphics + Labels, so
// it needs no extra art. Ports the monolith's juice: a "micro-silence" held-breath
// dim before the reveal, a back-out scale-in, a kinetic count-up, a multiplier
// badge stamp, and a decaying screen-shake — all data-driven from VIEW_CONFIG.

import {
  _decorator,
  Color,
  Component,
  Graphics,
  Label,
  Node,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
} from 'cc';
import { resolveBigWinTier, VIEW_CONFIG } from './view-config';

const { ccclass } = _decorator;

const ACID = new Color(234, 255, 0, 255);
const fmt = (cents: number) => (cents / 100).toFixed(2);

@ccclass('CeremonyView')
export class CeremonyView extends Component {
  private overlay!: Node;
  private headerLabel!: Label;
  private amountLabel!: Label;
  private badgeLabel!: Label;
  private dim!: UIOpacity;
  private shakeNode: Node | null = null;

  /** Build the (hidden) overlay + a fullscreen dim used for the micro-silence beat. */
  build(shakeNode: Node): void {
    this.shakeNode = shakeNode;

    // fullscreen dim behind the panel (held-breath beat)
    const dimNode = this.mk('dim', 4000, 4000, this.node);
    const dg = dimNode.addComponent(Graphics);
    dg.fillColor = new Color(0, 0, 0, 255);
    dg.rect(-2000, -2000, 4000, 4000);
    dg.fill();
    this.dim = dimNode.addComponent(UIOpacity);
    this.dim.opacity = 0;

    const ov = this.mk('ceremony', 560, 320, this.node);
    ov.setPosition(0, VIEW_CONFIG.layout.reelCenterY, 0);
    ov.active = false;

    const g = ov.addComponent(Graphics);
    g.fillColor = new Color(8, 8, 10, 240);
    g.roundRect(-278, -160, 556, 320, 16);
    g.fill();
    g.lineWidth = 6;
    g.strokeColor = ACID;
    g.roundRect(-278, -160, 556, 320, 16);
    g.stroke();
    g.fillColor = ACID; // hazard bars
    g.rect(-278, 150, 556, 8);
    g.rect(-278, -158, 556, 8);
    g.fill();

    this.headerLabel = this.mkLabel(ov, 0, 86, 52, ACID);
    this.amountLabel = this.mkLabel(ov, 0, -10, 60, ACID);
    this.badgeLabel = this.mkLabel(ov, 210, 96, 34, Color.WHITE);

    this.overlay = ov;
  }

  /** Show the tiered ceremony for a win. Returns false (HUD only) for small wins. */
  show(winCents: number, betCents: number, multiplier = 1): boolean {
    const multiple = betCents > 0 ? winCents / betCents : 0;
    const tier = resolveBigWinTier(multiple);
    if (!tier) return false;

    this.headerLabel.string = `${tier.name} WIN`;
    this.headerLabel.color = new Color().fromHEX(tier.color);
    this.badgeLabel.string = multiplier > 1 ? `×${multiplier}` : '';

    const ov = this.overlay;
    const reveal = () => {
      ov.active = true;
      ov.setScale(0.5, 0.5, 1);
      tween(ov)
        .to(0.28, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .start();
      this.countUp(winCents, 0.7);
      if (tier.shakeAmp > 0) this.shake(tier.shakeAmp);
    };

    // micro-silence: dim, hold, then detonate.
    const msec = VIEW_CONFIG.ceremony.microSilenceMs / 1000;
    tween(this.dim).to(msec, { opacity: 150 }).call(reveal).to(0.3, { opacity: 0 }).start();

    this.scheduleOnce(() => this.hide(), VIEW_CONFIG.ceremony.holdMs / 1000);
    return true;
  }

  /** Feature-unlocked splash (reuses the overlay). */
  showFeatureUnlocked(name: string): void {
    this.headerLabel.string = name;
    this.headerLabel.color = ACID;
    this.amountLabel.string = 'FEATURE';
    this.badgeLabel.string = '';
    const ov = this.overlay;
    ov.active = true;
    ov.setScale(0.5, 0.5, 1);
    tween(ov)
      .to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .start();
    this.shake(12);
    this.scheduleOnce(() => this.hide(), 1.6);
  }

  private hide(): void {
    if (!this.overlay) return;
    tween(this.overlay)
      .to(0.18, { scale: new Vec3(0.6, 0.6, 1) }, { easing: 'quadIn' })
      .call(() => (this.overlay.active = false))
      .start();
  }

  private countUp(toCents: number, dur: number): void {
    const proxy = { v: 0 };
    this.amountLabel.string = '0.00';
    tween(proxy)
      .to(
        dur,
        { v: toCents },
        { onUpdate: () => (this.amountLabel.string = fmt(Math.round(proxy.v))) },
      )
      .start();
  }

  private shake(amp: number): void {
    const n = this.shakeNode;
    if (!n) return;
    const p = n.position.clone();
    tween(n)
      .to(0.04, { position: new Vec3(p.x + amp, p.y, 0) })
      .to(0.04, { position: new Vec3(p.x - amp * 0.8, p.y, 0) })
      .to(0.04, { position: new Vec3(p.x + amp * 0.5, p.y, 0) })
      .to(0.04, { position: new Vec3(p.x - amp * 0.3, p.y, 0) })
      .to(0.04, { position: new Vec3(p.x, p.y, 0) })
      .start();
  }

  private mk(name: string, w: number, h: number, parent: Node): Node {
    const n = new Node(name);
    n.addComponent(UITransform).setContentSize(w, h);
    parent.addChild(n);
    return n;
  }

  private mkLabel(parent: Node, x: number, y: number, size: number, col: Color): Label {
    const n = this.mk('lbl', 520, size + 8, parent);
    n.setPosition(x, y, 0);
    const l = n.addComponent(Label);
    l.fontSize = size;
    l.lineHeight = size + 4;
    l.isBold = true;
    l.color = col;
    l.horizontalAlign = Label.HorizontalAlign.CENTER;
    return l;
  }
}
