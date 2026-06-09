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
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
} from 'cc';
import { resolveBigWinTier, VIEW_CONFIG } from './view-config';
import { PAL } from './palette';

const { ccclass } = _decorator;

// Shining-Pop identity (replaces the old industrial acid-green).
const RIM = new Color().fromHEX(PAL.accent); // magenta panel rim + accent bars
const CRYSTAL = new Color().fromHEX(PAL.valueText); // crystal white-pink amount
const TITLE = new Color().fromHEX(PAL.title); // soft-magenta header default
const fmt = (cents: number) => (cents / 100).toFixed(2);

@ccclass('CeremonyView')
export class CeremonyView extends Component {
  private overlay!: Node;
  private headerLabel!: Label;
  private amountLabel!: Label;
  private badgeLabel!: Label;
  private dim!: UIOpacity;
  private shakeNode: Node | null = null;
  private shakeBase: { pos: Vec3; angle: number; scale: Vec3 } | null = null;

  /** Build the (hidden) overlay + a fullscreen dim used for the micro-silence beat. */
  build(shakeNode: Node): void {
    this.shakeNode = shakeNode;
    // Snapshot the shake target's resting transform ONCE so an interrupted shake
    // always resets to the true base (not a mid-shake position captured at call-time).
    this.shakeBase = {
      pos: shakeNode.position.clone(),
      angle: shakeNode.angle,
      scale: shakeNode.scale.clone(),
    };

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
    g.fillColor = new Color(18, 9, 30, 244); // deep violet glass
    g.roundRect(-278, -160, 556, 320, 16);
    g.fill();
    g.lineWidth = 6;
    g.strokeColor = RIM;
    g.roundRect(-278, -160, 556, 320, 16);
    g.stroke();
    g.fillColor = RIM; // magenta accent bars
    g.rect(-278, 150, 556, 8);
    g.rect(-278, -158, 556, 8);
    g.fill();

    this.headerLabel = this.mkLabel(ov, 0, 86, 52, TITLE);
    this.amountLabel = this.mkLabel(ov, 0, -10, 60, CRYSTAL);
    this.badgeLabel = this.mkLabel(ov, 210, 96, 34, Color.WHITE);

    this.overlay = ov;
  }

  /** Show the tiered ceremony for a win. Returns false (HUD only) for small wins. */
  show(winCents: number, betCents: number, multiplier = 1): boolean {
    this.abort(); // kill any in-flight ceremony so a rapid re-win cleanly replaces it
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
    this.abort();
    this.headerLabel.string = name;
    this.headerLabel.color = TITLE;
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
    const b = this.shakeBase;
    if (!n || !b) return;
    Tween.stopAllByTarget(n);
    const at = (dx: number, dy: number) => new Vec3(b.pos.x + dx, b.pos.y + dy, b.pos.z);
    const punch = new Vec3(b.scale.x * 1.03, b.scale.y * 1.03, b.scale.z);
    // 3-axis impact: horizontal + vertical kick, a small angle snap, and a zoom punch
    // that all decay back to the resting base — reads as a HIT, not a slide.
    tween(n)
      .to(0.04, { position: at(amp, amp * 0.55), angle: b.angle + 1.5, scale: punch })
      .to(0.04, { position: at(-amp * 0.8, -amp * 0.4), angle: b.angle - 1.1 })
      .to(0.04, {
        position: at(amp * 0.5, amp * 0.25),
        angle: b.angle + 0.6,
        scale: b.scale.clone(),
      })
      .to(0.04, { position: at(-amp * 0.3, -amp * 0.15), angle: b.angle - 0.3 })
      .to(
        0.05,
        { position: b.pos.clone(), angle: b.angle, scale: b.scale.clone() },
        { easing: 'quadOut' },
      )
      .start();
  }

  /** Kill any in-flight ceremony cleanly (on re-trigger + from SlotView's spin entry). */
  abort(): void {
    if (this.dim) Tween.stopAllByTarget(this.dim);
    if (this.overlay) Tween.stopAllByTarget(this.overlay);
    if (this.shakeNode) {
      Tween.stopAllByTarget(this.shakeNode);
      if (this.shakeBase) {
        this.shakeNode.setPosition(this.shakeBase.pos);
        this.shakeNode.angle = this.shakeBase.angle;
        this.shakeNode.setScale(this.shakeBase.scale);
      }
    }
    this.unscheduleAllCallbacks();
    if (this.dim) this.dim.opacity = 0;
    if (this.overlay) {
      this.overlay.active = false;
      this.overlay.setScale(1, 1, 1);
    }
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
