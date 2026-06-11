// MVC — VIEW. AAA win ceremony — light, not a box. Three beats with intensity
// that scales CONTINUOUSLY with the win multiple (slot-vfx rule: never stepped
// popups): held-breath dim -> detonation (radial diamond god-rays + expanding
// shock diamond + impact shake + header pop) -> savour (kinetic count-up,
// slow ray rotation, landing pop). Interruptible by tap (fast-forward), honors
// reduced-effects (text + count only), pure Graphics/Labels, no circles, no
// shaders — all data-driven from VIEW_CONFIG.

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
import { applyFont } from './fonts';

const { ccclass } = _decorator;

const RIM = new Color().fromHEX(PAL.accent); // magenta accent
const CRYSTAL = new Color().fromHEX(PAL.valueText); // crystal white-pink amount
const TITLE = new Color().fromHEX(PAL.title); // soft-magenta header default
const fmt = (cents: number) => (cents / 100).toFixed(2);

@ccclass('CeremonyView')
export class CeremonyView extends Component {
  private overlay!: Node;
  private raysNode!: Node;
  private raysG!: Graphics;
  private shockNode!: Node;
  private shockG!: Graphics;
  private headerLabel!: Label;
  private amountLabel!: Label;
  private badgeLabel!: Label;
  private dim!: UIOpacity;
  private shakeNode: Node | null = null;
  // Rest transform captured LIVE at each shake start (NOT at build time). The
  // shake target is the responsive root that fit() rescales/repositions, so a
  // build-time snapshot goes stale → the old "crush" (board snapped to abs scale
  // 1.0 on every win/settle). The shake now only kicks position+angle and resets
  // to this live rest; scale is owned solely by fit() and never written here.
  private shakeRest: { pos: Vec3; angle: number } | null = null;
  private countTarget = 0;
  private counting = false;

  /** Build the (hidden) overlay + a fullscreen dim used for the micro-silence beat. */
  build(shakeNode: Node): void {
    this.shakeNode = shakeNode;

    // fullscreen dim behind the light show (held-breath beat + ray contrast)
    const dimNode = this.mk('dim', 4000, 4000, this.node);
    const dg = dimNode.addComponent(Graphics);
    dg.fillColor = new Color(0, 0, 0, 255);
    dg.rect(-2000, -2000, 4000, 4000);
    dg.fill();
    this.dim = dimNode.addComponent(UIOpacity);
    this.dim.opacity = 0;

    const ov = this.mk('ceremony', 760, 520, this.node);
    ov.setPosition(0, VIEW_CONFIG.layout.reelCenterY, 0);
    ov.active = false;

    // god-ray layer rotates slowly during the savour beat
    this.raysNode = this.mk('rays', 10, 10, ov);
    this.raysG = this.raysNode.addComponent(Graphics);

    // one-shot expanding shock diamond
    this.shockNode = this.mk('shock', 10, 10, ov);
    this.shockG = this.shockNode.addComponent(Graphics);

    // grounding light — soft elongated diamond under the text (replaces the old box)
    const ground = this.mk('ground', 10, 10, ov).addComponent(Graphics);
    ground.fillColor = new Color(255, 0, 127, 34);
    ground.moveTo(0, -120);
    ground.lineTo(330, -10);
    ground.lineTo(0, 100);
    ground.lineTo(-330, -10);
    ground.close();
    ground.fill();

    this.headerLabel = this.mkLabel(ov, 0, 96, 56, TITLE);
    this.amountLabel = this.mkLabel(ov, 0, -16, 66, CRYSTAL);
    this.badgeLabel = this.mkLabel(ov, 0, -86, 30, Color.WHITE);

    // tap anywhere on the ceremony fast-forwards it (master rule: interruptible)
    ov.on(Node.EventType.TOUCH_END, () => this.fastForward());

    this.overlay = ov;
  }

  /** Show the tiered ceremony. Intensity scales continuously with the multiple.
   *  Returns false (HUD only) for wins under the ceremony threshold. */
  show(winCents: number, betCents: number, multiplier = 1, reduced = false): boolean {
    this.abort(); // kill any in-flight ceremony so a rapid re-win cleanly replaces it
    const multiple = betCents > 0 ? winCents / betCents : 0;
    const tier = resolveBigWinTier(multiple);
    if (!tier) return false;

    // continuous 0..1 intensity across the whole ceremony band (8x .. 100x+)
    const t = Math.max(0, Math.min(1, (multiple - 8) / 92));

    this.headerLabel.string = `${tier.name} WIN`;
    this.headerLabel.color = new Color().fromHEX(tier.color);
    this.headerLabel.fontSize = Math.round(48 + 20 * t);
    this.badgeLabel.string = multiplier > 1 ? `WILD ×${multiplier}` : '';
    this.countTarget = winCents;

    const ov = this.overlay;
    const reveal = () => {
      ov.active = true;
      ov.setScale(0.6, 0.6, 1);
      tween(ov)
        .to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .start();
      if (!reduced) {
        this.drawRays(Math.round(8 + 10 * t), 300 + 280 * t, 0.5 + 0.5 * t);
        this.raysNode.angle = 0;
        tween(this.raysNode)
          .by(6, { angle: 14 + 10 * t })
          .repeatForever()
          .start();
        this.fireShock(220 + 160 * t);
        this.shake(tier.shakeAmp);
      }
      // header overshoot pop on top of the panel scale-in
      this.headerLabel.node.setScale(0.3, 0.3, 1);
      tween(this.headerLabel.node)
        .to(0.34, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'backOut' })
        .to(0.12, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
        .start();
      this.countUp(winCents, 0.8 + 0.8 * t);
    };

    // beat 1 — micro-silence: dim, hold, then detonate.
    const msec = VIEW_CONFIG.ceremony.microSilenceMs / 1000;
    tween(this.dim)
      .to(msec, { opacity: reduced ? 90 : 165 })
      .call(reveal)
      .to(0.5, { opacity: reduced ? 60 : 110 })
      .start();

    this.scheduleOnce(() => this.hide(), (VIEW_CONFIG.ceremony.holdMs + 900 * t) / 1000);
    return true;
  }

  /** Feature-unlocked splash (reuses the light rig at fixed mid intensity). */
  showFeatureUnlocked(name: string): void {
    this.abort();
    this.headerLabel.string = name;
    this.headerLabel.color = TITLE;
    this.headerLabel.fontSize = 50;
    this.amountLabel.string = 'FEATURE';
    this.badgeLabel.string = '';
    const ov = this.overlay;
    ov.active = true;
    ov.setScale(0.6, 0.6, 1);
    this.drawRays(12, 380, 0.7);
    tween(this.raysNode).by(6, { angle: 18 }).repeatForever().start();
    this.fireShock(280);
    tween(ov)
      .to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .start();
    this.shake(12);
    tween(this.dim).to(0.1, { opacity: 130 }).start();
    this.scheduleOnce(() => this.hide(), 1.6);
  }

  /** Radial god-rays as elongated faceted diamonds (no circles, additive feel). */
  private drawRays(count: number, len: number, alpha: number): void {
    const g = this.raysG;
    g.clear();
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const w = 14 + (i % 3) * 6;
      g.fillColor = new Color(255, i % 2 ? 60 : 120, 156, Math.round(26 * alpha + (i % 3) * 6));
      g.moveTo(cos * 70, sin * 70);
      g.lineTo(cos * len * 0.5 - sin * w, sin * len * 0.5 + cos * w);
      g.lineTo(cos * len, sin * len);
      g.lineTo(cos * len * 0.5 + sin * w, sin * len * 0.5 - cos * w);
      g.close();
      g.fill();
    }
  }

  /** One-shot expanding shock diamond that fades as it grows. */
  private fireShock(size: number): void {
    const g = this.shockG;
    g.clear();
    g.lineWidth = 5;
    g.strokeColor = new Color(255, 224, 255, 220);
    g.moveTo(0, 60);
    g.lineTo(60, 0);
    g.lineTo(0, -60);
    g.lineTo(-60, 0);
    g.close();
    g.stroke();
    this.shockNode.setScale(0.4, 0.4, 1);
    const op = this.shockNode.getComponent(UIOpacity) ?? this.shockNode.addComponent(UIOpacity);
    op.opacity = 255;
    tween(this.shockNode)
      .to(0.55, { scale: new Vec3(size / 60, size / 60, 1) }, { easing: 'quadOut' })
      .start();
    tween(op).to(0.55, { opacity: 0 }, { easing: 'quadOut' }).start();
  }

  private hide(): void {
    if (!this.overlay) return;
    Tween.stopAllByTarget(this.raysNode);
    tween(this.dim).to(0.3, { opacity: 0 }).start();
    tween(this.overlay)
      .to(0.18, { scale: new Vec3(0.6, 0.6, 1) }, { easing: 'quadIn' })
      .call(() => (this.overlay.active = false))
      .start();
  }

  /** Tap fast-forward: snap the count to its target and wrap up quickly. */
  private fastForward(): void {
    if (!this.overlay.active) return;
    if (this.counting) {
      Tween.stopAllByTarget(this.amountLabel);
      this.amountLabel.string = fmt(this.countTarget);
      this.landingPop();
      this.counting = false;
    }
    this.unscheduleAllCallbacks();
    this.scheduleOnce(() => this.hide(), 0.35);
  }

  private countUp(toCents: number, dur: number): void {
    const proxy = { v: 0 };
    this.counting = true;
    this.amountLabel.string = '0.00';
    tween(proxy)
      .to(
        dur,
        { v: toCents },
        {
          easing: 'quartOut',
          onUpdate: () => (this.amountLabel.string = fmt(Math.round(proxy.v))),
        },
      )
      .call(() => {
        this.counting = false;
        this.landingPop();
      })
      .start();
  }

  /** Damped-elastic pop when the count lands (counter.landingPop spec). */
  private landingPop(): void {
    const n = this.amountLabel.node;
    n.setScale(1, 1, 1);
    tween(n)
      .to(0.14, { scale: new Vec3(1.3, 1.3, 1) }, { easing: 'quadOut' })
      .to(0.24, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .start();
  }

  private shake(amp: number): void {
    const n = this.shakeNode;
    if (!n) return;
    Tween.stopAllByTarget(n);
    // Capture the LIVE resting transform (fit() owns scale + y-position). We kick
    // ONLY position + angle and decay back to this rest — never scale, so the
    // board can't snap to an absolute scale (the crush). Reads as a HIT via the
    // positional/angular impulse alone.
    const rest = { pos: n.position.clone(), angle: n.angle };
    this.shakeRest = rest;
    const at = (dx: number, dy: number) => new Vec3(rest.pos.x + dx, rest.pos.y + dy, rest.pos.z);
    tween(n)
      .to(0.04, { position: at(amp, amp * 0.55), angle: rest.angle + 1.5 })
      .to(0.04, { position: at(-amp * 0.8, -amp * 0.4), angle: rest.angle - 1.1 })
      .to(0.04, { position: at(amp * 0.5, amp * 0.25), angle: rest.angle + 0.6 })
      .to(0.04, { position: at(-amp * 0.3, -amp * 0.15), angle: rest.angle - 0.3 })
      .to(0.05, { position: rest.pos.clone(), angle: rest.angle }, { easing: 'quadOut' })
      .call(() => {
        this.shakeRest = null;
      })
      .start();
  }

  /** Kill any in-flight ceremony cleanly (on re-trigger + from SlotView's spin entry). */
  abort(): void {
    if (this.dim) Tween.stopAllByTarget(this.dim);
    if (this.overlay) Tween.stopAllByTarget(this.overlay);
    if (this.raysNode) Tween.stopAllByTarget(this.raysNode);
    if (this.shockNode) Tween.stopAllByTarget(this.shockNode);
    if (this.amountLabel) Tween.stopAllByTarget(this.amountLabel);
    if (this.shakeNode) {
      Tween.stopAllByTarget(this.shakeNode);
      // Reset ONLY an in-flight shake back to its live rest (pos+angle). Never
      // touch scale — fit() owns it. If no shake is active (shakeRest null), leave
      // the transform exactly as fit() set it (this was the crush: abort used to
      // stamp a stale absolute scale onto the responsive root).
      if (this.shakeRest) {
        this.shakeNode.setPosition(this.shakeRest.pos);
        this.shakeNode.angle = this.shakeRest.angle;
        this.shakeRest = null;
      }
    }
    this.unscheduleAllCallbacks();
    this.counting = false;
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
    const n = this.mk('lbl', 600, size + 8, parent);
    n.setPosition(x, y, 0);
    const l = n.addComponent(Label);
    l.fontSize = size;
    l.lineHeight = size + 4;
    l.isBold = true;
    l.color = col;
    l.horizontalAlign = Label.HorizontalAlign.CENTER;
    // The ceremony shouts — heavy display font (Luckiest Guy) for header + amount.
    applyFont(l, 'display');
    return l;
  }
}
