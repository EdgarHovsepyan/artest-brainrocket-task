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

const { ccclass } = _decorator;

const RIM = new Color().fromHEX(PAL.accent); // magenta accent
const CRYSTAL = new Color().fromHEX(PAL.valueText); // crystal white-pink amount
const WARM = new Color(255, 196, 92, 255); // hot-gold the amount rolls THROUGH
const TITLE = new Color().fromHEX(PAL.title); // soft-magenta header default
// Non-finite guard: a bad count-up value renders 0.00, never "NaN"/"∞".
const fmt = (cents: number) => ((Number.isFinite(cents) ? cents : 0) / 100).toFixed(2);

@ccclass('CeremonyView')
export class CeremonyView extends Component {
  private overlay!: Node;
  private raysNode!: Node;
  private raysG!: Graphics;
  private shockNode!: Node;
  private shockG!: Graphics;
  private panelLightOp!: UIOpacity; // Task 5.MATRIX — SUPER/EPIC amount-backing glow
  private headerLabel!: Label;
  private amountLabel!: Label;
  // WC9/RQ7 — the win number is treated as a LIT METALLIC OBJECT, not flat text:
  //  • amountShadow  — a dark duplicate offset down/right for bevel weight + depth
  //  • numberGlow    — a warm-gold emissive lens pooled behind the digits so the
  //                    number reads as EMITTING light (the "feeds-bloom" quality),
  //                    drawn as stacked-alpha filled diamonds (codebase no-banding
  //                    pattern — never a circle/ring), opacity + scale breathing
  //                    with the heartbeat and tier intensity.
  private amountShadow!: Label;
  private numberGlow!: Graphics;
  private numberGlowOp!: UIOpacity;
  private numberGlowBase = 0; // tier-scaled resting opacity, set in show()
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
  // Count-up state — driven by Component.schedule, NOT a plain-object tween.
  // tween({v:0}) targets a bare object the TweenSystem never ticks in this
  // 3.8.8 web runtime, so the big-win amount could snap/freeze; a scheduled
  // frame-stepper with the easing sampled by hand always ticks. (See MEMORY
  // cocos-web-runtime-animation-gotchas.)
  private countFrom = 0;
  private countDur = 1;
  private countElapsed = 0;
  /** Optional hooks the controller registers so the VIEW's detonation/roll
   *  stays AV-synced (audio lives in the controller). */
  onDetonate: ((tierName: string) => void) | null = null;
  onCountPip: (() => void) | null = null;
  /** Task 5.MATRIX — Epic-tier ceremony asks the slot-view to spray its
   *  particle-pool coin geyser (audio + particles still live there). */
  onCoinGeyser: (() => void) | null = null;
  private pipAccum = 0;
  // Task 5.1 — heartbeat ticker state. heartbeatScale is set instantly to
  // currentTextPop on each 10ⁿ crossing of the rolling count, then decays
  // toward 1.0 per frame within the same scheduled stepper (no plain-object
  // tweens — `tween({v:0})` would never tick in this 3.8.8 web runtime).
  private heartbeatScale = 1;
  private heartbeatThresholds: number[] = [];
  private currentTextPop = 1.18;
  private readonly _tintTmp = new Color();

  /** Build the (hidden) overlay + a fullscreen dim used for the micro-silence beat. */
  build(shakeNode: Node): void {
    this.shakeNode = shakeNode;

    // 2026-06-11 BUG FIX (cocos-aaa-visual-gate WC5/WC7 + anti-pattern "effects
    // that hide the win"): the old fullscreen SOLID black rect at alpha ~153
    // blacked out the whole game on a big win ("closing all gameplay"). Replaced
    // with a RADIAL VIGNETTE — concentric wide-stroked frames, dark at the screen
    // EDGE fading to FULLY CLEAR in the centre. The reels, symbols and win number
    // (all centred) stay bright + visible; only the perimeter darkens to funnel
    // the eye. This is the premium "scene reacts" look, never a black box.
    const dimNode = this.mk('dim', 4000, 4000, this.node);
    const dg = dimNode.addComponent(Graphics);
    const RINGS = 16;
    for (let i = 0; i < RINGS; i++) {
      const t = i / (RINGS - 1); // 0 = outer screen edge, 1 = centre
      const half = 2000 - t * 1640; // 2000 (edge) → 360 (near centre, stays clear)
      const a = Math.round((1 - t) * (1 - t) * 46); // soft quadratic edge falloff
      dg.lineWidth = 150; // wide bands overlap → smooth gradient, no banding
      dg.strokeColor = new Color(5, 2, 11, a);
      dg.rect(-half, -half, half * 2, half * 2);
      dg.stroke();
    }
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

    // Task 5.MATRIX — brighter panel-light layer (SUPER/EPIC only). Same
    // diamond shape, hotter alpha; opacity tweened up per tier.panelLight in
    // show(). Stays a stacked-alpha wash so the brightness reads as light, not
    // a solid plate (slot-vfx restraint rule).
    const panelLightNode = this.mk('panelLight', 10, 10, ov);
    const panelLight = panelLightNode.addComponent(Graphics);
    panelLight.fillColor = new Color(255, 186, 92, 110); // warm gold (was magenta)
    panelLight.moveTo(0, -120);
    panelLight.lineTo(330, -10);
    panelLight.lineTo(0, 100);
    panelLight.lineTo(-330, -10);
    panelLight.close();
    panelLight.fill();
    this.panelLightOp = panelLightNode.addComponent(UIOpacity);
    this.panelLightOp.opacity = 0;

    this.headerLabel = this.mkLabel(ov, 0, 96, 56, TITLE);

    // WC9/RQ7 — number light-rig, built BELOW the amount so it reads as backing:
    //  1) emissive glow lens (warm gold) pooled behind the digits
    //  2) dark depth duplicate offset down/right for bevel weight
    //  3) the crisp amount on top
    const glowNode = this.mk('numberGlow', 20, 20, ov);
    glowNode.setPosition(0, -16, 0);
    this.numberGlow = glowNode.addComponent(Graphics);
    this.drawNumberGlow();
    this.numberGlowOp = glowNode.addComponent(UIOpacity);
    this.numberGlowOp.opacity = 0;

    this.amountShadow = this.mkLabel(ov, 4, -21, 66, new Color(28, 8, 2, 235));
    this.amountLabel = this.mkLabel(ov, 0, -16, 66, CRYSTAL);
    this.badgeLabel = this.mkLabel(ov, 0, -86, 30, Color.WHITE);
    // Slot-title text treatment: a deep amber outline lifts the headline and
    // the rolling amount off the busy board (white-on-glow alone read flat).
    for (const l of [this.headerLabel, this.amountLabel]) {
      l.enableOutline = true;
      l.outlineColor = new Color(82, 34, 4, 255);
      l.outlineWidth = 3;
    }

    // tap anywhere on the ceremony fast-forwards it (master rule: interruptible)
    ov.on(Node.EventType.TOUCH_END, () => this.fastForward());

    this.overlay = ov;

    // Authored Spine win-callout (Cupids-Crush, Spine 4.2) — the hero banner that
    // replaces the procedural rays/shock/header. Loaded once, mounted into the
    // overlay so it inherits the scale-in + active, sitting just BELOW the
    // count-up number. Falls back to the procedural ceremony if it can't load.
    this.loadWinCallout(ov);
  }

  private winSpine: sp.Skeleton | null = null;
  /** Tier name -> Spine win-callout animation prefix (each has -start + -loop). */
  private static readonly TIER_ANIM: Record<string, string> = {
    BIG: 'big-win',
    MEGA: 'mega-win',
    SUPER: 'epic-win',
    EPIC: 'wicked-win',
  };
  private loadWinCallout(ov: Node): void {
    resources.load('spine/cupid-wf/cupid-wf', sp.SkeletonData, (err, data) => {
      if (err || !data || !ov.isValid) {
        console.warn('[spine] win-callout load failed; procedural fallback', err);
        return;
      }
      const n = new Node('winCallout');
      n.layer = ov.layer;
      n.setPosition(0, 36, 0);
      n.setScale(0.62, 0.62, 1);
      const sk = n.addComponent(sp.Skeleton);
      sk.skeletonData = data;
      sk.premultipliedAlpha = true;
      ov.addChild(n);
      // sit the banner just under the number rig: covers the procedural
      // ground/header diamonds, while glow/shadow/amount/badge render on top.
      n.setSiblingIndex(this.numberGlow.node.getSiblingIndex());
      this.winSpine = sk;
    });
  }

  /** Show the tiered ceremony. Intensity scales continuously with the multiple.
   *  Returns false (HUD only) for wins under the ceremony threshold. */
  show(winCents: number, betCents: number, multiplier = 1, reduced = false): boolean {
    this.abort(); // kill any in-flight ceremony so a rapid re-win cleanly replaces it
    const multiple = betCents > 0 ? winCents / betCents : 0;
    const tier = resolveBigWinTier(multiple);
    if (!tier) return false;

    // Task 5.MATRIX — re-mapped intensity normaliser. Old span was (multiple-8)/92
    // when BIG was 8x; new BIG floor is 15x and the band extends to 100x so the
    // span is (multiple-15)/85. The `boost` keeps growing past 100x (log-scaled,
    // saturates ~1000x+) so a max-win still escalates beyond an EPIC. The
    // saturating `t` still governs colour/fontSize so text never blows up.
    const t = Math.max(0, Math.min(1, (multiple - 10) / 90));
    const over = Math.max(0, multiple - 100);
    const boost = over > 0 ? Math.min(1, Math.log10(1 + over / 60)) : 0;
    const tx = Math.min(1.6, t + boost * 0.6); // extended intensity for >100x

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
      // Authored Spine banner is the hero when available; the procedural
      // rays/shock/header are the FALLBACK only (no skeleton / reduced-motion).
      const useSpine = !!this.winSpine && this.winSpine.isValid && !reduced;
      if (useSpine) {
        const anim = CeremonyView.TIER_ANIM[tier.name] ?? 'normal-win';
        this.winSpine!.setAnimation(0, `${anim}-start`, false);
        this.winSpine!.addAnimation(0, `${anim}-loop`, true, 0);
      }
      if (!reduced) {
        if (!useSpine) {
          this.drawRays(Math.round(8 + 12 * tx), 300 + 320 * tx, 0.5 + 0.5 * t);
          this.raysNode.angle = 0;
          tween(this.raysNode)
            .by(6, { angle: 14 + 12 * tx })
            .repeatForever()
            .start();
          this.fireShock(220 + 180 * tx);
        }
        // amplitude tracks the realised win continuously, but CAP it (~tier*4)
        // so a max-win can't nauseate (slot-vfx restraint rule).
        this.shake(Math.min(tier.shakeAmp * 1.8, tier.shakeAmp + 14 * tx));
      }
      // AV-sync hook: the controller fires the braam/win sting on this exact
      // frame so the detonation never plays in silence (audio lives there).
      this.onDetonate?.(tier.name);
      // Task 5.MATRIX — EPIC coin geyser. The hook wakes particle-layer.coinGeyser
      // on the slot-view; null-safe so other tiers stay clean.
      if (!reduced && tier.coinParticles > 0) this.onCoinGeyser?.();
      // panel-light belongs to the procedural look only — the Spine banner has
      // its own backing glow, so skip it when the banner is the hero.
      if (this.panelLightOp) {
        Tween.stopAllByTarget(this.panelLightOp);
        const lightAlpha = reduced || useSpine ? 0 : Math.round(tier.panelLight * 255);
        tween(this.panelLightOp).to(0.3, { opacity: lightAlpha }).start();
      }
      // The Spine banner carries the tier word; the procedural header label only
      // shows as the fallback. When it shows, it ARRIVES (slam → squash → settle).
      this.headerLabel.node.active = !useSpine;
      if (!useSpine) {
        const slamFrom = 1.45 + 0.28 * Math.min(1, tx);
        this.headerLabel.node.setScale(slamFrom, slamFrom, 1);
        tween(this.headerLabel.node)
          .to(0.15, { scale: new Vec3(0.9, 0.9, 1) }, { easing: 'quadIn' }) // slam past rest
          .to(0.12, { scale: new Vec3(1.08, 1.08, 1) }, { easing: 'quadOut' }) // rebound
          .to(0.14, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }) // settle
          .start();
      }
      // Position the count-up number: on the banner's cloud (lower) when the
      // Spine banner is the hero, at the panel centre for the procedural look.
      const numY = useSpine ? -118 : -16;
      this.amountLabel.node.setPosition(0, numY, 0);
      this.amountShadow.node.setPosition(4, numY - 5, 0);
      this.numberGlow.node.setPosition(0, numY, 0);
      this.badgeLabel.node.setPosition(0, useSpine ? -178 : -86, 0);
      // WC9/RQ7 — light the number's emissive backing for this tier; it ramps in
      // with the detonation, then breathes with the heartbeat inside tickCount.
      this.numberGlowBase = reduced ? 90 : Math.round(120 + 100 * Math.min(1, tx));
      this.numberGlow.node.setScale(1, 1, 1);
      if (this.numberGlowOp) {
        Tween.stopAllByTarget(this.numberGlowOp);
        this.numberGlowOp.opacity = 0;
        tween(this.numberGlowOp).to(0.3, { opacity: this.numberGlowBase }).start();
      }
      // bigger wins savour longer — duration tracks the extended intensity.
      // Task 5.1 — pass tier.textPopScale so the heartbeat scales per tier.
      this.countUp(winCents, 0.8 + 1.0 * tx, tier.textPopScale);
    };

    // beat 1 — micro-silence: dim, hold, then detonate. 2026-06-11 — the `dim`
    // is now a VIGNETTE (clear centre), so its opacity controls only how dark
    // the SCREEN EDGES get; the reels/symbols/number stay fully visible. Tier
    // scales the edge darkness via boardDimAlpha (BIG/MEGA subtle, SUPER/EPIC
    // a touch deeper) but NEVER blacks the centre. Peak opacity capped at 200
    // (vignette stroke alphas are already low, so this reads as a soft frame).
    const msec = VIEW_CONFIG.ceremony.microSilenceMs / 1000;
    const savourAlpha = reduced ? 80 : Math.round(150 + 105 * tier.boardDimAlpha);
    tween(this.dim)
      .to(msec, { opacity: reduced ? 120 : 200 })
      .call(reveal)
      .to(0.5, { opacity: savourAlpha })
      .start();

    this.scheduleOnce(() => this.hide(), (VIEW_CONFIG.ceremony.holdMs + 1100 * tx) / 1000);
    return true;
  }

  /** Feature-unlocked splash (reuses the light rig at fixed mid intensity). */
  showFeatureUnlocked(name: string): void {
    this.abort();
    this.headerLabel.string = name;
    this.headerLabel.color = TITLE;
    this.headerLabel.fontSize = 50;
    this.setAmount('FEATURE');
    this.badgeLabel.string = '';
    // WC9 — light the emissive backing at the fixed mid intensity too, so the
    // FEATURE word glows like the win number rather than reading as flat text.
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

  /** Radial god-rays as elongated faceted diamonds (no circles, additive feel).
   *  VISUAL BUST — warmed from magenta to GOLD/AMBER so the ceremony light
   *  matches the fire aesthetic (WC7 diegetic warm light). Alternating gold +
   *  hot-orange shafts read as radiant heat, not neon. */
  private drawRays(count: number, len: number, alpha: number): void {
    const g = this.raysG;
    g.clear();
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const w = 14 + (i % 3) * 6;
      // Gold (even) ↔ hot-orange (odd) warm shafts.
      const gch = i % 2 ? 150 : 205;
      const bch = i % 2 ? 40 : 90;
      g.fillColor = new Color(255, gch, bch, Math.round(30 * alpha + (i % 3) * 7));
      g.moveTo(cos * 70, sin * 70);
      g.lineTo(cos * len * 0.5 - sin * w, sin * len * 0.5 + cos * w);
      g.lineTo(cos * len, sin * len);
      g.lineTo(cos * len * 0.5 + sin * w, sin * len * 0.5 - cos * w);
      g.close();
      g.fill();
    }
  }

  /** One-shot detonation FLASH (2026-06-11 redesign). The old version was a
   *  STROKED diamond outline expanding to size/60× — it read as a "rotated box"
   *  growing out of the win (user-rejected, same complaint as the tap ping).
   *  This replacement is a FILLED soft radial light bloom: a bright pinpoint
   *  core feathering out through 4 stacked-alpha diamonds, scaling up + fading.
   *  It reads as a burst of LIGHT (a detonation), never a shape outline. Pairs
   *  with the god-rays (drawRays) which are already filled diamonds. */
  private fireShock(size: number): void {
    const g = this.shockG;
    g.clear();
    // Stacked filled diamonds — hot-white core → magenta-pink feathered halo.
    const layers: Array<[number, number, number, number, number]> = [
      // [radius, r, g, b, alpha]
      [78, 255, 90, 176, 26],
      [54, 255, 140, 200, 50],
      [32, 255, 210, 240, 110],
      [16, 255, 255, 255, 220],
    ];
    for (const [rad, cr, cg, cb, ca] of layers) {
      g.fillColor = new Color(cr, cg, cb, ca);
      g.moveTo(0, rad);
      g.lineTo(rad, 0);
      g.lineTo(0, -rad);
      g.lineTo(-rad, 0);
      g.close();
      g.fill();
    }
    this.shockNode.setScale(0.35, 0.35, 1);
    const op = this.shockNode.getComponent(UIOpacity) ?? this.shockNode.addComponent(UIOpacity);
    op.opacity = 255;
    // Fast bright punch then a slightly slower fade — a flash, not a slow ring.
    tween(this.shockNode)
      .to(0.42, { scale: new Vec3(size / 78, size / 78, 1) }, { easing: 'expoOut' })
      .start();
    tween(op).to(0.12, { opacity: 255 }).to(0.42, { opacity: 0 }, { easing: 'quadOut' }).start();
  }

  private hide(): void {
    if (!this.overlay) return;
    Tween.stopAllByTarget(this.raysNode);
    tween(this.dim).to(0.3, { opacity: 0 }).start();
    // Task 5.MATRIX — fade the panel-light back to 0 in lockstep with the panel.
    if (this.panelLightOp) {
      Tween.stopAllByTarget(this.panelLightOp);
      tween(this.panelLightOp).to(0.18, { opacity: 0 }).start();
    }
    // WC9 — fade the number's emissive backing out with the panel.
    if (this.numberGlowOp) {
      Tween.stopAllByTarget(this.numberGlowOp);
      tween(this.numberGlowOp).to(0.18, { opacity: 0 }).start();
    }
    tween(this.overlay)
      .to(0.18, { scale: new Vec3(0.6, 0.6, 1) }, { easing: 'quadIn' })
      .call(() => (this.overlay.active = false))
      .start();
  }

  /** Tap fast-forward: snap the count to its target and wrap up quickly. */
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
    // Task 5.1 — pre-compute heartbeat milestones (log scale — dense early,
    // sparse late). 10ⁿ crossings the count will pass through give the natural
    // "log feel" beats described in the blueprint. milestoneCount caps how many
    // we'll fire (defensive — a max-win count might cross 7+ decades).
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
    this.schedule(this.tickCount, 0); // every frame — guaranteed to tick (not a plain-object tween)
  }

  /** Frame-stepped count-up (arrow fn so `this` binds + unschedule matches the
   *  same ref). Samples quartOut by hand, fires a throttled audio pip, lerps the
   *  amount colour warm-gold -> crystal as it lands, AND (Task 5.1) drives a
   *  heartbeat scale-pop on each 10ⁿ crossing — beats dense early, sparse late. */
  private tickCount = (dt: number): void => {
    this.countElapsed += dt;
    const p = Math.min(1, this.countElapsed / this.countDur);
    const e = 1 - Math.pow(1 - p, 4); // quartOut
    const v = this.countFrom + (this.countTarget - this.countFrom) * e;
    this.setAmount(fmt(Math.round(v)));
    Color.lerp(this._tintTmp, WARM, CRYSTAL, e);
    this.amountLabel.color = this._tintTmp; // reassign so the Label marks dirty
    // Task 5.1 — heartbeat: consume any 10ⁿ thresholds the rolling count passed
    // this frame, snap heartbeatScale to currentTextPop on each, then decay
    // toward 1 per-frame at decayPerSec (within this scheduled stepper — never
    // a plain-object tween).
    while (this.heartbeatThresholds.length && v >= this.heartbeatThresholds[0]) {
      this.heartbeatThresholds.shift();
      this.heartbeatScale = this.currentTextPop;
    }
    const { decayPerSec } = VIEW_CONFIG.counter.heartbeat;
    this.heartbeatScale += (1 - this.heartbeatScale) * Math.min(1, decayPerSec * dt);
    this.amountLabel.node.setScale(this.heartbeatScale, this.heartbeatScale, 1);
    this.amountShadow.node.setScale(this.heartbeatScale, this.heartbeatScale, 1);
    // WC9 — the emissive lens breathes with the heartbeat: brighter + larger on
    // each 10ⁿ pop, settling back toward the tier's resting glow between beats.
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
    // per-pip tick ~ every 70ms while rolling (skips the final settle)
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
      this.amountLabel.node.setScale(1, 1, 1); // reset before landingPop tweens
      this.amountShadow.node.setScale(1, 1, 1);
      this.numberGlow.node.setScale(1, 1, 1);
      this.landingPop();
    }
  };

  /** Damped-elastic pop when the count lands (counter.landingPop spec). */
  private landingPop(): void {
    const n = this.amountLabel.node;
    n.setScale(1, 1, 1);
    tween(n)
      .to(0.14, { scale: new Vec3(1.36, 1.36, 1) }, { easing: 'quadOut' })
      .to(0.26, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .start();
    // WC9 — the depth-shadow pops with the number so the bevel never detaches.
    if (this.amountShadow) {
      const s = this.amountShadow.node;
      s.setScale(1, 1, 1);
      tween(s)
        .to(0.14, { scale: new Vec3(1.36, 1.36, 1) }, { easing: 'quadOut' })
        .to(0.26, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .start();
    }
    // WC9 — the emissive lens flares on landing (the gold "catches fire" as the
    // value locks) then settles to the tier's resting glow.
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
    // VISUAL BUST (WC9) — a bright specular streak sweeps across the number on
    // landing, like light catching polished gold. A tilted white parallelogram
    // masked to the label width, swept L→R once, then destroyed.
    this.fireNumberSheen();
  }

  /** WC9 — one-shot specular sweep across the win number (gold-object feel). */
  private numberSheen: Node | null = null;
  private fireNumberSheen(): void {
    const parent = this.amountLabel.node;
    if (this.numberSheen && this.numberSheen.isValid) this.numberSheen.destroy();
    const w = 360;
    const h = 90;
    const n = new Node('numSheen');
    n.addComponent(UITransform).setContentSize(40, h);
    n.layer = parent.layer;
    parent.addChild(n);
    const g = n.addComponent(Graphics);
    g.fillColor = new Color(255, 255, 255, 150);
    g.moveTo(-14, h / 2);
    g.lineTo(14, h / 2);
    g.lineTo(26, -h / 2);
    g.lineTo(-2, -h / 2);
    g.close();
    g.fill();
    n.angle = -16;
    n.setPosition(-w / 2, 0, 0);
    const op = n.addComponent(UIOpacity);
    op.opacity = 0;
    tween(op).to(0.06, { opacity: 220 }).to(0.34, { opacity: 0 }).start();
    tween(n)
      .to(0.4, { position: new Vec3(w / 2, 0, 0) }, { easing: 'sineInOut' })
      .call(() => {
        if (n.isValid) n.destroy();
      })
      .start();
    this.numberSheen = n;
  }

  /** WC9/RQ7 — warm-gold emissive lens behind the number. Stacked-alpha filled
   *  diamonds (wide+flat to pool light along the horizontal digits), inner layers
   *  brighter → a smooth glow with NO banding and NO circle/ring (codebase rule).
   *  The number appears to EMIT light, the single biggest "expensive" tell. */
  private drawNumberGlow(): void {
    const g = this.numberGlow;
    g.clear();
    const layers = 9;
    for (let i = layers; i >= 1; i--) {
      const f = i / layers; // 1 outer → ~0.11 inner
      const halfW = 64 + 250 * f;
      const halfH = 24 + 64 * f;
      const a = Math.round(8 + 26 * (1 - f)); // inner brighter, outer feathered
      g.fillColor = new Color(255, 198, 96, a);
      g.moveTo(0, -halfH);
      g.lineTo(halfW, 0);
      g.lineTo(0, halfH);
      g.lineTo(-halfW, 0);
      g.close();
      g.fill();
    }
  }

  /** Write the win value to the crisp label AND its depth-shadow duplicate so the
   *  bevel layer never desyncs from the rolling number. */
  private setAmount(s: string): void {
    this.amountLabel.string = s;
    if (this.amountShadow) this.amountShadow.string = s;
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
    if (this.amountLabel) {
      Tween.stopAllByTarget(this.amountLabel);
      // Task 5.1 — wipe heartbeat state so a new ceremony starts clean.
      this.amountLabel.node.setScale(1, 1, 1);
    }
    // WC9 — wipe the number light-rig (shadow scale + emissive lens) so a rapid
    // re-win starts from a clean dark state rather than a stuck glow.
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
      this.panelLightOp.opacity = 0; // Task 5.MATRIX — wipe panel-light
    }
    this.heartbeatScale = 1;
    this.heartbeatThresholds.length = 0;
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
