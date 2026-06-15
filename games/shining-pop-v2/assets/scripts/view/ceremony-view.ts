import {
  _decorator,
  Color,
  Component,
  Graphics,
  Label,
  Node,
  resources,
  sp,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
} from 'cc';
import { resolveBigWinTier, VIEW_CONFIG } from './view-config';
import { PAL } from './palette';
import { applyFont } from './fonts';
import { formatMoney } from '../logic/money';

const { ccclass } = _decorator;

const RIM = new Color().fromHEX(PAL.accent);
const CRYSTAL = new Color().fromHEX(PAL.valueText);
const WARM = new Color(255, 196, 92, 255);
const TITLE = new Color().fromHEX(PAL.title);

const fmt = (cents: number) => formatMoney((Number.isFinite(cents) ? cents : 0) / 100, 'USD');

@ccclass('CeremonyView')
export class CeremonyView extends Component {
  private overlay!: Node;
  private sparkleRoot!: Node;
  private sparkles: { node: Node; op: UIOpacity; spin: number }[] = [];
  private panelLightOp!: UIOpacity;
  private headerLabel!: Label;
  private amountLabel!: Label;

  private amountShadow!: Label;
  private numberGlow!: Graphics;
  private numberGlowOp!: UIOpacity;
  private numberGlowBase = 0;
  private badgeLabel!: Label;
  private dim!: UIOpacity;

  private flashNode!: Node;
  private flashOp!: UIOpacity;
  private shakeNode: Node | null = null;

  private shakeRest: { pos: Vec3; angle: number } | null = null;
  private countTarget = 0;
  private counting = false;

  private countFrom = 0;
  private countDur = 1;
  private countElapsed = 0;

  onDetonate: ((tierName: string) => void) | null = null;
  onDismiss: (() => void) | null = null;
  onCountPip: (() => void) | null = null;

  onCoinGeyser: (() => void) | null = null;
  private pipAccum = 0;

  private heartbeatScale = 1;
  private heartbeatThresholds: number[] = [];
  private currentTextPop = 1.18;
  private readonly _tintTmp = new Color();

  build(shakeNode: Node): void {
    this.shakeNode = shakeNode;

    const dimNode = this.mk('dim', 4000, 4000, this.node);
    const dg = dimNode.addComponent(Graphics);

    dg.fillColor = new Color(6, 3, 13, 142);
    dg.rect(-2000, -2000, 4000, 4000);
    dg.fill();
    const RINGS = 16;
    for (let i = 0; i < RINGS; i++) {
      const t = i / (RINGS - 1);
      const half = 2000 - t * 1640;
      const a = Math.round((1 - t) * (1 - t) * 46);
      dg.lineWidth = 150;
      dg.strokeColor = new Color(5, 2, 11, a);
      dg.rect(-half, -half, half * 2, half * 2);
      dg.stroke();
    }
    this.dim = dimNode.addComponent(UIOpacity);
    this.dim.opacity = 0;

    const ov = this.mk('ceremony', 760, 520, this.node);
    ov.setPosition(0, VIEW_CONFIG.layout.reelCenterY, 0);
    ov.active = false;

    this.sparkleRoot = this.mk('sparkles', 10, 10, ov);
    this.buildSparkles();

    const ground = this.mk('ground', 10, 10, ov).addComponent(Graphics);
    this.drawSoftGlow(ground, 255, 96, 172, 30, 360);

    const panelLightNode = this.mk('panelLight', 10, 10, ov);
    const panelLight = panelLightNode.addComponent(Graphics);
    this.drawSoftGlow(panelLight, 255, 206, 150, 96, 300);
    this.panelLightOp = panelLightNode.addComponent(UIOpacity);
    this.panelLightOp.opacity = 0;

    this.headerLabel = this.mkLabel(ov, 0, 96, 56, TITLE);

    const glowNode = this.mk('numberGlow', 20, 20, ov);
    glowNode.setPosition(0, -16, 0);
    this.numberGlow = glowNode.addComponent(Graphics);
    this.drawNumberGlow();
    this.numberGlowOp = glowNode.addComponent(UIOpacity);
    this.numberGlowOp.opacity = 0;

    this.amountShadow = this.mkLabel(ov, 4, -21, 66, new Color(28, 8, 2, 235));
    this.amountLabel = this.mkLabel(ov, 0, -16, 66, CRYSTAL);
    this.badgeLabel = this.mkLabel(ov, 0, -86, 30, Color.WHITE);

    for (const l of [this.headerLabel, this.amountLabel]) {
      l.enableOutline = true;
      l.outlineColor = new Color(82, 34, 4, 255);
      l.outlineWidth = 3;
    }

    ov.on(Node.EventType.TOUCH_END, () => this.fastForward());

    this.overlay = ov;

    const flashNode = this.mk('detoFlash', 4000, 4000, this.node);
    const fg = flashNode.addComponent(Graphics);
    // Warm CANDY bloom — never white. A gentle gold pop, not a screen-washing flash.
    const BLOOM = 18;
    for (let i = BLOOM; i > 0; i--) {
      const t = i / BLOOM;
      const rad = 120 + t * 720;
      const a = Math.round((1 - t) * (1 - t) * 26);
      fg.fillColor = new Color(255, 188, 120, a);
      fg.circle(0, 0, rad);
      fg.fill();
    }
    fg.fillColor = new Color(255, 214, 158, 80);
    fg.circle(0, 0, 120);
    fg.fill();
    this.flashOp = flashNode.addComponent(UIOpacity);
    this.flashOp.opacity = 0;
    flashNode.active = false;
    this.flashNode = flashNode;

    this.loadWinCallout(ov);
  }

  private winSpine: sp.Skeleton | null = null;
  private winSpineOp: UIOpacity | null = null;

  private static readonly TIER_ANIM: Record<string, string> = {
    BIG: 'big-win',
    MEGA: 'mega-win',
    SUPER: 'epic-win',
    EPIC: 'wicked-win',
  };

  private static readonly TIER_NUM_Y: Record<string, number> = {
    BIG: -22,
    MEGA: -38,
    SUPER: -44,
    EPIC: -50,
  };

  // WIN CEREMONY = the authored Spine win-callout (Cupids-Crush 4.2), NOT the
  // procedural rhombus/sunburst/sparkle graphics. DECISION (keep it): the flat
  // geometric romb + hard vector rays read as dated/cheap and are intentionally
  // OFF in-game. They remain in code ONLY as a safety fallback if the Spine asset
  // fails to load at runtime (so the ceremony is never empty). To verify Spine is
  // live: rebuild web-mobile, win 10x+, you should see the cupid-wf banner — if
  // you instead see rays/shock, the Spine asset failed to load (debug the load).
  private static readonly USE_SPINE_BANNER = true;
  private loadWinCallout(ov: Node): void {
    if (!CeremonyView.USE_SPINE_BANNER) return;
    resources.load('spine/cupid-wf/cupid-wf', sp.SkeletonData, (err, data) => {
      if (err || !data || !ov.isValid) {
        console.warn('[spine] win-callout load failed; procedural fallback', err);
        return;
      }
      // Any failure here (bad skeleton, missing texture) must NOT crash the
      // ceremony — leave winSpine null so show() uses the procedural fallback.
      try {
        const n = new Node('winCallout');
        n.layer = ov.layer;
        n.setPosition(0, 36, 0);
        n.setScale(0.62, 0.62, 1);
        const sk = n.addComponent(sp.Skeleton);
        sk.skeletonData = data;
        sk.premultipliedAlpha = true;
        this.winSpineOp = n.addComponent(UIOpacity);
        this.winSpineOp.opacity = 0;
        n.active = false;
        ov.addChild(n);

        n.setSiblingIndex(this.numberGlow.node.getSiblingIndex());
        this.winSpine = sk;
      } catch (e) {
        console.warn('[spine] win-callout setup failed; procedural fallback', e);
        this.winSpine = null;
      }
    });
  }

  show(winCents: number, betCents: number, multiplier = 1, reduced = false): boolean {
    this.abort();
    const multiple = betCents > 0 ? winCents / betCents : 0;
    const tier = resolveBigWinTier(multiple);
    if (!tier) return false;

    const t = Math.max(0, Math.min(1, (multiple - 10) / 90));
    const over = Math.max(0, multiple - 100);
    const boost = over > 0 ? Math.min(1, Math.log10(1 + over / 60)) : 0;
    const tx = Math.min(1.6, t + boost * 0.6);

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

      let useSpine = !!this.winSpine && this.winSpine.isValid && !reduced;
      if (useSpine) {
        // A Spine playback failure must degrade to the procedural ceremony, not
        // crash the win — flip useSpine so the !useSpine block below still fires.
        try {
          const anim = CeremonyView.TIER_ANIM[tier.name] ?? 'normal-win';
          const sk = this.winSpine!;

          if (this.winSpineOp) {
            Tween.stopAllByTarget(this.winSpineOp);
            this.winSpineOp.opacity = 255;
          }
          sk.setAnimation(0, `${anim}-start`, false);
          sk.addAnimation(0, `${anim}-loop`, true, 0);
          sk.updateAnimation(0);
          sk.color = new Color(0, 0, 0, 0);
          sk.node.active = true;
          const fadeIn = { f: 0 };
          Tween.stopAllByTarget(fadeIn);
          tween(fadeIn)
            .to(
              0.24,
              { f: 1 },
              {
                easing: 'quadOut',
                onUpdate: () => {
                  if (!sk.isValid) return;
                  const v = Math.round(255 * fadeIn.f);
                  sk.color = new Color(v, v, v, v);
                },
              },
            )
            .start();
        } catch (e) {
          console.warn('[spine] win playback failed; procedural fallback', e);
          useSpine = false;
          if (this.winSpine?.node?.isValid) this.winSpine.node.active = false;
        }
      } else if (this.winSpine) {
        this.winSpine.node.active = false;
      }
      if (!reduced) {
        if (!useSpine) this.fireDetonationFlash(tx);
        this.shake(Math.min(tier.shakeAmp * 1.8, tier.shakeAmp + 14 * tx));
      }

      this.onDetonate?.(tier.name);

      if (!reduced && tier.coinParticles > 0) this.onCoinGeyser?.();

      if (this.panelLightOp) {
        Tween.stopAllByTarget(this.panelLightOp);
        const lightAlpha = reduced || useSpine ? 0 : Math.round(tier.panelLight * 255);
        tween(this.panelLightOp).to(0.3, { opacity: lightAlpha }).start();
      }

      this.headerLabel.node.active = !useSpine;
      if (!useSpine) {
        const slamFrom = 1.45 + 0.28 * Math.min(1, tx);
        this.headerLabel.node.setScale(slamFrom, slamFrom, 1);
        tween(this.headerLabel.node)
          .to(0.15, { scale: new Vec3(0.9, 0.9, 1) }, { easing: 'quadIn' })
          .to(0.12, { scale: new Vec3(1.08, 1.08, 1) }, { easing: 'quadOut' })
          .to(0.14, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
          .start();
      }

      const numY = useSpine ? (CeremonyView.TIER_NUM_Y[tier.name] ?? -110) : -16;
      this.amountLabel.node.setPosition(0, numY, 0);
      this.amountShadow.node.setPosition(4, numY - 5, 0);
      this.numberGlow.node.setPosition(0, numY, 0);
      this.badgeLabel.node.setPosition(0, useSpine ? numY - 56 : -86, 0);

      this.numberGlowBase = reduced ? 90 : Math.round(120 + 100 * Math.min(1, tx));
      this.numberGlow.node.setScale(1, 1, 1);
      if (this.numberGlowOp) {
        Tween.stopAllByTarget(this.numberGlowOp);
        this.numberGlowOp.opacity = 0;
        tween(this.numberGlowOp).to(0.3, { opacity: this.numberGlowBase }).start();
      }

      const beats = VIEW_CONFIG.ceremony.beats;
      this.countUp(
        winCents,
        (beats.climaxBaseMs + beats.climaxPerTxMs * tx) / 1000,
        tier.textPopScale,
      );
    };

    const beats = VIEW_CONFIG.ceremony.beats;
    const savourAlpha = reduced ? 80 : Math.round(150 + 105 * tier.boardDimAlpha);
    tween(this.dim)
      .to(beats.hushMs / 1000, { opacity: reduced ? 120 : 200 })
      .call(reveal)
      .to(beats.savourDimMs / 1000, { opacity: savourAlpha })
      .start();

    this.scheduleOnce(
      () => this.hide(),
      (beats.savourHoldBaseMs + beats.savourHoldPerTxMs * tx) / 1000,
    );
    return true;
  }

  private static MODE_RGB: Record<string, [number, number, number]> = {
    wilds: [255, 90, 156],
    crowns: [255, 198, 70],
    reels: [188, 70, 224],
  };

  showFeatureUnlocked(name: string, mode?: 'wilds' | 'crowns' | 'reels'): void {
    this.abort();
    const rgb = mode ? CeremonyView.MODE_RGB[mode] : null;
    const modeCol = rgb ? new Color(rgb[0], rgb[1], rgb[2], 255) : TITLE;
    this.headerLabel.string = name;
    this.headerLabel.color = modeCol;
    this.headerLabel.fontSize = 50;
    this.setAmount('UNLOCKED');
    this.amountLabel.color = rgb
      ? new Color(
          Math.min(255, rgb[0] + 40),
          Math.min(255, rgb[1] + 40),
          Math.min(255, rgb[2] + 40),
          255,
        )
      : CRYSTAL;
    this.badgeLabel.string = '';

    this.numberGlowBase = 150;
    this.numberGlow.node.setScale(1, 1, 1);
    if (this.numberGlowOp) {
      Tween.stopAllByTarget(this.numberGlowOp);
      this.numberGlowOp.opacity = 0;
      tween(this.numberGlowOp).to(0.3, { opacity: this.numberGlowBase }).start();
    }
    const ov = this.overlay;
    ov.active = true;
    ov.setScale(0.6, 0.6, 1);
    this.fireSparkleBurst();
    this.fireDetonationFlash(0.6);
    tween(ov)
      .to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .start();
    this.shake(12);
    tween(this.dim).to(0.1, { opacity: 130 }).start();
    this.scheduleOnce(() => this.hide(), 1.6);
  }

  // Soft radial light: concentric circles, faint+wide (outer) to bright+tight
  // (inner), for an ambient stage glow with no hard-edged geometry.
  private drawSoftGlow(
    g: Graphics,
    r: number,
    gg: number,
    b: number,
    peak: number,
    radius: number,
  ): void {
    const LAYERS = 9;
    for (let i = 0; i < LAYERS; i++) {
      const t = i / (LAYERS - 1); // 0 outer → 1 inner
      const rad = radius * (1 - t * 0.84);
      const a = Math.round(peak * (0.1 + 0.9 * t) * (0.45 + 0.55 * t));
      g.fillColor = new Color(r, gg, b, a);
      g.circle(0, 0, rad);
      g.fill();
    }
  }

  private fireDetonationFlash(intensity: number): void {
    if (!this.flashOp || !this.flashNode) return;
    Tween.stopAllByTarget(this.flashOp);
    this.flashNode.active = true;
    this.flashOp.opacity = 0;
    const peak = Math.round(26 + 38 * Math.min(1, intensity));
    const beats = VIEW_CONFIG.ceremony.beats;
    tween(this.flashOp)
      .to(beats.detonationFlashInMs / 1000, { opacity: peak }, { easing: 'quadOut' })
      .to(beats.detonationFlashOutMs / 1000, { opacity: 0 }, { easing: 'quadIn' })
      .call(() => {
        if (this.flashNode && this.flashNode.isValid) this.flashNode.active = false;
      })
      .start();
  }

  private buildSparkles(): void {
    const palette: [number, number, number][] = [
      [255, 255, 255],
      [255, 158, 208],
      [255, 206, 71],
      [150, 215, 255],
    ];
    // Soft round sparkle dots — no hard-edged silhouettes.
    const dot = (g: Graphics, r: number): void => {
      g.circle(0, 0, r);
      g.fill();
    };
    const shapes = [dot];
    const COUNT = 24;
    for (let i = 0; i < COUNT; i++) {
      const n = this.mk('spk', 22, 22, this.sparkleRoot);
      n.layer = this.sparkleRoot.layer;
      const g = n.addComponent(Graphics);
      const [cr, cg, cb] = palette[i % palette.length];
      const shape = shapes[i % shapes.length];
      // Size variety so the burst has near/far depth, not one flat scale.
      const r = 8 + (i % 4) * 2.4;
      g.fillColor = new Color(cr, cg, cb, 64); // soft outer glow
      shape(g, r);
      g.fillColor = new Color(cr, cg, cb, 255); // bright core
      shape(g, r * 0.5);
      const op = n.addComponent(UIOpacity);
      op.opacity = 0;
      n.active = false;
      this.sparkles.push({ node: n, op, spin: 0 });
    }
  }

  private fireSparkleBurst(): void {
    const n = this.sparkles.length;
    for (let i = 0; i < n; i++) {
      const { node, op, spin } = this.sparkles[i];
      Tween.stopAllByTarget(node);
      Tween.stopAllByTarget(op);
      const a = (Math.PI * 2 * i) / n + (i % 2 ? 0.16 : -0.12);
      const dist = 165 + (i % 5) * 42;
      node.active = true;
      node.setPosition(0, 0, 0);
      node.setScale(0.2, 0.2, 1);
      node.angle = 0;
      op.opacity = 255;
      const tx = Math.cos(a) * dist;
      const ty = Math.sin(a) * dist;
      // Per-shard stagger so the burst blooms outward in a wave, not one block.
      const lead = (i % 6) * 0.018;
      tween(node)
        .delay(lead)
        .to(0.12, { scale: new Vec3(1.18, 1.18, 1) }, { easing: 'backOut' })
        .to(0.52, { scale: new Vec3(0.62, 0.62, 1) }, { easing: 'sineOut' })
        .start();
      // expoOut launch, then a gentle gravity drift down on settle (secondary motion).
      tween(node)
        .delay(lead)
        .to(0.6, { position: new Vec3(tx, ty, 0) }, { easing: 'expoOut' })
        .to(0.5, { position: new Vec3(tx * 1.04, ty - 26, 0) }, { easing: 'sineIn' })
        .start();
      // Tumble: boxes/stars spin hard, rombs drift — gives the confetti life.
      tween(node).delay(lead).by(0.85, { angle: spin }, { easing: 'quadOut' }).start();
      tween(op)
        .delay(0.24 + lead)
        .to(0.46, { opacity: 0 }, { easing: 'quadIn' })
        .call(() => {
          if (node.isValid) node.active = false;
        })
        .start();
    }
  }

  private hide(): void {
    if (!this.overlay) return;
    if (this.overlay.active) this.onDismiss?.();
    tween(this.dim).to(0.3, { opacity: 0 }).start();

    if (this.panelLightOp) {
      Tween.stopAllByTarget(this.panelLightOp);
      tween(this.panelLightOp).to(0.18, { opacity: 0 }).start();
    }

    if (this.numberGlowOp) {
      Tween.stopAllByTarget(this.numberGlowOp);
      tween(this.numberGlowOp).to(0.18, { opacity: 0 }).start();
    }

    if (this.winSpine && this.winSpine.isValid) {
      const sk = this.winSpine;
      const fadeOut = { f: 1 };
      Tween.stopAllByTarget(fadeOut);
      tween(fadeOut)
        .to(
          0.2,
          { f: 0 },
          {
            easing: 'quadIn',
            onUpdate: () => {
              if (!sk.isValid) return;
              const v = Math.round(255 * fadeOut.f);
              sk.color = new Color(v, v, v, v);
            },
          },
        )
        .start();
    }
    tween(this.overlay)
      .to(0.22, { scale: new Vec3(0.6, 0.6, 1) }, { easing: 'quadIn' })
      .call(() => {
        this.overlay.active = false;

        if (this.winSpine) {
          this.winSpine.node.active = false;
          if (this.winSpine.isValid) this.winSpine.color = new Color(255, 255, 255, 255);
        }
        if (this.winSpineOp) this.winSpineOp.opacity = 255;
      })
      .start();
  }

  private fastForward(): void {
    if (!this.overlay.active) return;
    if (this.counting) {
      this.unschedule(this.tickCount);
      this.setAmount(fmt(this.countTarget));
      this.amountLabel.color = CRYSTAL;
      this.landingPop();
      this.counting = false;
    }
    this.unscheduleAllCallbacks();
    this.scheduleOnce(() => this.hide(), 0.35);
  }

  private countUp(toCents: number, dur: number, textPopScale = 1.18): void {
    this.counting = true;
    this.countTarget = toCents;
    this.countFrom = 0;
    this.countDur = Math.max(0.2, dur);
    this.countElapsed = 0;
    this.pipAccum = 0;
    this.setAmount('0.00');
    this.amountShadow.node.setScale(1, 1, 1);

    this.heartbeatScale = 1;
    this.currentTextPop = textPopScale;
    const { milestoneCount } = VIEW_CONFIG.counter.heartbeat;
    this.heartbeatThresholds.length = 0;
    for (let n = 1; this.heartbeatThresholds.length < milestoneCount; n++) {
      const v = Math.pow(10, n);
      if (v >= toCents) break;
      this.heartbeatThresholds.push(v);
    }
    this.amountLabel.node.setScale(1, 1, 1);
    this.unschedule(this.tickCount);
    this.schedule(this.tickCount, 0);
  }

  private tickCount = (dt: number): void => {
    this.countElapsed += dt;
    const p = Math.min(1, this.countElapsed / this.countDur);
    const e = 1 - Math.pow(1 - p, 4);
    const v = this.countFrom + (this.countTarget - this.countFrom) * e;
    this.setAmount(fmt(Math.round(v)));
    Color.lerp(this._tintTmp, WARM, CRYSTAL, e);
    this.amountLabel.color = this._tintTmp;

    while (this.heartbeatThresholds.length && v >= this.heartbeatThresholds[0]) {
      this.heartbeatThresholds.shift();
      this.heartbeatScale = this.currentTextPop;
    }
    const { decayPerSec } = VIEW_CONFIG.counter.heartbeat;
    this.heartbeatScale += (1 - this.heartbeatScale) * Math.min(1, decayPerSec * dt);
    this.amountLabel.node.setScale(this.heartbeatScale, this.heartbeatScale, 1);
    this.amountShadow.node.setScale(this.heartbeatScale, this.heartbeatScale, 1);

    if (this.numberGlowOp) {
      const beat =
        this.currentTextPop > 1 ? (this.heartbeatScale - 1) / (this.currentTextPop - 1) : 0;
      this.numberGlowOp.opacity = Math.min(
        255,
        Math.round(this.numberGlowBase * (0.85 + 0.5 * beat)),
      );
      const gs = 1 + 0.22 * beat;
      this.numberGlow.node.setScale(gs, gs, 1);
    }

    this.pipAccum += dt;
    if (p < 0.98 && this.pipAccum >= 0.07) {
      this.pipAccum = 0;
      this.onCountPip?.();
    }
    if (p >= 1) {
      this.unschedule(this.tickCount);
      this.setAmount(fmt(this.countTarget));
      this.amountLabel.color = CRYSTAL;
      this.counting = false;
      this.heartbeatScale = 1;
      this.amountLabel.node.setScale(1, 1, 1);
      this.amountShadow.node.setScale(1, 1, 1);
      this.numberGlow.node.setScale(1, 1, 1);
      this.landingPop();
    }
  };

  private landingPop(): void {
    // Tier-scaled settle overshoot (Swink — sub-frame settle; Sylvester — bigger
    // wins savour harder): the final lock punches by landingPopScale, amplified
    // by the active tier's textPop, then springs back via backOut.
    const { landingPopScale, landingPopMs } = VIEW_CONFIG.counter;
    const over = 1 + landingPopScale * Math.max(1, this.currentTextPop);
    const up = (landingPopMs / 1000) * 0.37;
    const down = (landingPopMs / 1000) * 0.63;
    const overV = new Vec3(over, over, 1);

    const n = this.amountLabel.node;
    n.setScale(1, 1, 1);
    tween(n)
      .to(up, { scale: overV }, { easing: 'quadOut' })
      .to(down, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .start();

    if (this.amountShadow) {
      const s = this.amountShadow.node;
      s.setScale(1, 1, 1);
      tween(s)
        .to(up, { scale: overV.clone() }, { easing: 'quadOut' })
        .to(down, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .start();
    }

    if (this.numberGlowOp) {
      const peak = Math.min(255, Math.round(this.numberGlowBase * 1.6));
      Tween.stopAllByTarget(this.numberGlowOp);
      tween(this.numberGlowOp)
        .to(0.12, { opacity: peak }, { easing: 'quadOut' })
        .to(0.34, { opacity: this.numberGlowBase }, { easing: 'quadOut' })
        .start();
      const gn = this.numberGlow.node;
      gn.setScale(1, 1, 1);
      tween(gn)
        .to(0.12, { scale: new Vec3(1.3, 1.3, 1) }, { easing: 'quadOut' })
        .to(0.34, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .start();
    }
  }

  private drawNumberGlow(): void {
    const g = this.numberGlow;
    g.clear();
    // Emissive radial glow instead of a hard orange rhombus barrier (master brief
    // #3): soft concentric ellipses with a quadratic alpha falloff, warm candy
    // gradient (gold core → pink halo). Reads as light behind the number — it
    // lifts the text without a flat geometric panel suffocating the artwork.
    const layers = 16;
    for (let i = layers; i >= 1; i--) {
      const f = i / layers; // 1 outer → ~0 inner
      const warm = 1 - f; // 0 outer → 1 inner
      const rx = 70 + 260 * f;
      const ry = 30 + 78 * f;
      const a = Math.round(3 + 30 * warm * warm);
      const gch = Math.round(150 + 90 * warm); // pink outer → gold inner
      const bch = Math.round(175 - 30 * warm);
      g.fillColor = new Color(255, gch, bch, a);
      g.ellipse(0, 0, rx, ry);
      g.fill();
    }
  }

  private setAmount(s: string): void {
    this.amountLabel.string = s;
    if (this.amountShadow) this.amountShadow.string = s;
  }

  private shake(amp: number): void {
    const n = this.shakeNode;
    if (!n) return;
    Tween.stopAllByTarget(n);

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

  abort(): void {
    if (this.dim) Tween.stopAllByTarget(this.dim);
    if (this.overlay) Tween.stopAllByTarget(this.overlay);

    for (const s of this.sparkles) {
      Tween.stopAllByTarget(s.node);
      Tween.stopAllByTarget(s.op);
      if (s.node.isValid) s.node.active = false;
    }

    if (this.flashOp) {
      Tween.stopAllByTarget(this.flashOp);
      this.flashOp.opacity = 0;
      if (this.flashNode && this.flashNode.isValid) this.flashNode.active = false;
    }

    if (this.winSpineOp) {
      Tween.stopAllByTarget(this.winSpineOp);
      this.winSpineOp.opacity = 255;
    }
    if (this.winSpine) this.winSpine.node.active = false;
    if (this.amountLabel) {
      Tween.stopAllByTarget(this.amountLabel);

      this.amountLabel.node.setScale(1, 1, 1);
    }

    if (this.amountShadow) {
      Tween.stopAllByTarget(this.amountShadow.node);
      this.amountShadow.node.setScale(1, 1, 1);
    }
    if (this.numberGlowOp) {
      Tween.stopAllByTarget(this.numberGlowOp);
      this.numberGlowOp.opacity = 0;
      Tween.stopAllByTarget(this.numberGlow.node);
      this.numberGlow.node.setScale(1, 1, 1);
    }
    if (this.panelLightOp) {
      Tween.stopAllByTarget(this.panelLightOp);
      this.panelLightOp.opacity = 0;
    }
    this.heartbeatScale = 1;
    this.heartbeatThresholds.length = 0;
    if (this.shakeNode) {
      Tween.stopAllByTarget(this.shakeNode);

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

    applyFont(l, 'display');
    return l;
  }
}
