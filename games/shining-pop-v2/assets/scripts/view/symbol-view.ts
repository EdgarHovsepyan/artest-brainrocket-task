// MVC — VIEW. One symbol cell: render + win pulse only. No game rules.
// Built from code by ReelView; falls back to a text label if a sprite frame
// for an id is missing, so the board still reads even without art.

import {
  _decorator,
  Color,
  Component,
  Graphics,
  Label,
  Material,
  Node,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
} from 'cc';
import { SYMBOL_NAMES, SYMBOLS } from '../logic/game-config';
import { VIEW_CONFIG } from './view-config';
import { applyFont } from './fonts';

const { ccclass } = _decorator;

// Asset balance: the WILD (gingerbread + lollipop) and SCATTER (rainbow lollipop,
// id 8 = sym_l4_j) art carry their own padding, so they sit right at full size.
// Every OTHER symbol fills its PNG edge-to-edge and reads ~15% too big — it
// overflows the cell and bleeds into the neighbour (the "cropped / I see another
// symbol's part" report). Render those at 85% so the whole set balances in-cell.
const FULL_SIZE_IDS = new Set<number>([SYMBOLS.WILD, 8]);
const SYMBOL_SHRINK = 0.85;

@ccclass('SymbolView')
export class SymbolView extends Component {
  private sprite: Sprite | null = null;
  private label: Label | null = null;
  private frames: SpriteFrame[] = [];
  private glow: Node | null = null;
  private glowOp: UIOpacity | null = null;
  // Symbol-shaped win HALO — a glowing additive copy of the symbol's own art
  // (svarka-additive), scaled up behind it. Pulses on a win = on-symbol light.
  private halo: Node | null = null;
  private haloOp: UIOpacity | null = null;
  private haloSp: Sprite | null = null;
  private size = 90;
  /** Current symbol id — set by setSymbol, read by ReelView's spin-mask logic
   *  so it can paint off-screen buffer cells with the SAME symbols currently in
   *  the window. Prevents the launch-frame visible-content swap that the user
   *  perceived as "symbols changing at spin start". */
  private _currentId = 0;
  get currentId(): number {
    return this._currentId;
  }
  // Win-VFX layers (slot-vfx artist): built lazily on first win, killed in clear.
  private sheen: Node | null = null;
  private sparkles: Node[] = [];
  // CINEMA WAVE — shader rim-light/sweep overlay (symbol-win.effect). Built lazily
  // on the first shader-backed win; samples THIS symbol's own alpha. The shared
  // material's u_time is advanced globally by SlotView; this node only owns its
  // per-symbol opacity envelope. Null material -> the Graphics sheen above carries.
  private winOverlay: Node | null = null;
  private winOverlaySp: Sprite | null = null;
  private winOverlayOp: UIOpacity | null = null;
  // CINEMA WAVE — soft-burst.effect under-glow. SlotView injects the shared
  // material + white frame after the effect kit loads; each cell lazily swaps its
  // banded Graphics radial (the rejected "many circles") for the shader burst on
  // first win. Statics so no per-cell plumbing through ReelView.
  static fxBurstMat: Material | null = null;
  static fxWhiteFrame: SpriteFrame | null = null;
  // svarka-additive: renders the symbol's OWN texture additively (× a radial
  // pulse). On a symbol-frame sprite scaled up behind the art it makes a glowing
  // halo in the SYMBOL'S shape — cool on-win light, never a square bg box.
  static fxHaloMat: Material | null = null;
  private burstUpgraded = false;
  // SY1 idle breathing — the sprite lives on `art` (a child) so the per-frame
  // breathe composes with the win/land tweens that scale the CELL node, with no
  // tween conflict. Phase-offset per cell so the grid never breathes in unison.
  private art: Node | null = null;
  private artOp: UIOpacity | null = null;
  private idleT = 0;
  private idlePhase = 0;
  private idleAmp = 0;
  private idleOn = false;
  // Per-symbol base art scale (1 for WILD/SCATTER, 0.85 for the rest). The idle
  // breathe + setIdle reset multiply by this so the 15% shrink always holds.
  private artBaseScale = 1;

  /** Build the cell's sprite + text fallback at `size` px square. `phase` desyncs
   *  this cell's idle breathing from its neighbours. */
  build(size: number, frames: SpriteFrame[], phase = 0): void {
    this.frames = frames;
    this.size = size;
    this.idlePhase = phase;

    const art = size * VIEW_CONFIG.layout.symbolFill;
    (this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)).setContentSize(
      art,
      art,
    );
    // Sprite on a centred child so idle breathing (scales `art`) never fights the
    // win/land tweens (which scale this.node).
    const artNode = new Node('art');
    artNode.addComponent(UITransform).setContentSize(art, art);
    this.node.addChild(artNode);
    this.art = artNode;
    this.artOp = artNode.addComponent(UIOpacity); // win-focus dim targets the art only
    const sp = artNode.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.type = Sprite.Type.SIMPLE;
    this.sprite = sp;

    const lblNode = new Node('fallback');
    lblNode.addComponent(UITransform).setContentSize(size, size);
    artNode.addChild(lblNode);
    const lbl = lblNode.addComponent(Label);
    lbl.fontSize = Math.round(size * 0.34);
    lbl.lineHeight = lbl.fontSize + 2;
    lbl.isBold = true;
    lbl.color = new Color(245, 247, 250, 255); // white-smoke (brand: no acid yellow)
    applyFont(lbl, 'display');
    this.label = lbl;

    // Win light-up (2026-06-11 RADIANT redesign): a smooth FEATHERED radial
    // bloom BEHIND the symbol. The earlier version used 3 hard rounded-rects
    // which read as a "golden box shadow" (user-rejected). This stacks LAYERS
    // soft blobs (roundRect with radius = full → circular) with a QUADRATIC
    // alpha falloff so the edge feathers into nothing — reads as emitted LIGHT,
    // not a box or a ring. Warm gradient: gold-white core → deep-orange edge.
    const glowNode = new Node('winGlow');
    glowNode.addComponent(UITransform).setContentSize(size, size);
    this.node.addChild(glowNode);
    glowNode.setSiblingIndex(0); // behind the art
    const gg = glowNode.addComponent(Graphics);
    const LAYERS = 10;
    for (let i = LAYERS - 1; i >= 0; i--) {
      const t = i / (LAYERS - 1); // 0 = hot core, 1 = soft outer
      const rad = size * (0.22 + t * 0.56); // core tighter → outer wider
      const r = 255;
      // HOTTER ramp (2026-06-11): the old (255, 232→122, 180→30) read as a flat
      // BEIGE circle — too much blue in the outer band. Now: white-gold core
      // (255,238,200) → hot orange (255,120,20) → deep ember-red (255,40,0). The
      // low blue makes it read as FIRE, not tan. Higher peak alpha = more punch.
      const gch = Math.round(238 - t * 198); // 238 → 40
      const bch = Math.round(200 - t * 200); // 200 → 0
      const a = Math.round((1 - t) * (1 - t) * 120); // brighter, feathered edge
      gg.fillColor = new Color(r, gch, bch, a);
      gg.roundRect(-rad, -rad, rad * 2, rad * 2, rad);
      gg.fill();
    }
    glowNode.setScale(0.8, 0.8, 1);
    // Behind-symbol glow node is DORMANT by default — owner: "only the symbol
    // effect, not the symbol bg". It renders nothing (inactive) so a win shows
    // zero glow behind the candy; the on-symbol symbol-win shader carries the
    // shine. (Kept buildable in case a future per-mode moment opts back in.)
    glowNode.active = false;
    this.glow = glowNode;
    this.glowOp = glowNode.addComponent(UIOpacity);
    this.glowOp.opacity = 0;
  }

  /** Show symbol `id` — sprite if its frame loaded, else the id's name. */
  setSymbol(id: number): void {
    this._currentId = id;
    const frame = this.frames[id] ?? null;
    if (this.sprite) this.sprite.spriteFrame = frame;
    if (this.label) this.label.string = frame ? '' : (SYMBOL_NAMES[id] ?? String(id));
    // High-value symbols (wild + H1..H4 = ids 0..4) carry more visual "weight" —
    // they breathe a touch deeper, the textbook AAA cue that they matter more.
    this.idleAmp = id <= 4 ? 0.03 : 0.018;
    // WILD + SCATTER stay full size; every other symbol renders 15% smaller so
    // it sits inside its cell instead of overflowing into the neighbour.
    this.artBaseScale = FULL_SIZE_IDS.has(id) ? 1 : SYMBOL_SHRINK;
    if (this.art) this.art.setScale(this.artBaseScale, this.artBaseScale, 1);
  }

  /** SY1 idle breathing: a desynced sine scale on the art child while the reel is
   *  at rest, so the grid is alive, never a static template. Composes with the
   *  win/land tweens (those scale the cell node, not `art`). Gated off during
   *  spin + under reduced-motion. */
  update(dt: number): void {
    if (!this.idleOn || !this.art) return;
    this.idleT += dt;
    const sc = (1 + Math.sin(this.idleT * 1.9 + this.idlePhase) * this.idleAmp) * this.artBaseScale;
    this.art.setScale(sc, sc, 1);
  }

  /** Toggle idle breathing (ReelView: on when settled, off while spinning). */
  setIdle(on: boolean): void {
    this.idleOn = on;
    if (!on && this.art) this.art.setScale(this.artBaseScale, this.artBaseScale, 1);
  }

  /** Win pulse + light-up — driven by Cocos Tween. `delay` enables an L→R ripple.
   *  `rich` adds the in-cell sheen + edge sparkle (focused wins only — the caller
   *  disables it on dense wins like a full wild reel where 20+ cells would stack
   *  their white sheens into a wash). */
  /** Swap the banded Graphics radial for the soft-burst shader sprite ONCE, when
   *  the shared material is available. Re-points this.glow/this.glowOp so every
   *  existing envelope (playWin / playLock / flashWildLand / clear) drives the
   *  new visual with zero further changes. Graphics stays as the fallback. */
  private ensureBurst(): void {
    if (this.burstUpgraded || !VIEW_CONFIG.win.burst.enabled) return;
    const mat = SymbolView.fxBurstMat;
    const sf = SymbolView.fxWhiteFrame;
    if (!mat || !sf) return; // material kit off/failed → keep the Graphics glow
    const s = this.size * VIEW_CONFIG.win.burst.scale;
    const n = new Node('winBurst');
    n.layer = this.node.layer;
    n.addComponent(UITransform).setContentSize(s, s);
    this.node.addChild(n);
    n.setSiblingIndex(0); // behind the art, same slot as the old glow
    const sp = n.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.type = Sprite.Type.SIMPLE;
    sp.spriteFrame = sf;
    sp.customMaterial = mat;
    const op = n.addComponent(UIOpacity);
    op.opacity = 0;
    n.setScale(0.8, 0.8, 1); // match the old glow's rest scale (tweens go 0.8→1.35)
    if (this.glow) this.glow.active = false; // retire the banded Graphics version
    this.glow = n;
    this.glowOp = op;
    this.burstUpgraded = true;
  }

  /** Lazily build the symbol-shaped win HALO — a Sprite child that wears the
   *  symbol's OWN spriteFrame under the `svarka-additive` material, so the glow
   *  is alpha-clipped to the candy silhouette (radial falloff + additive blend),
   *  never a square. Sits behind the art (sibling 0). The frame is (re)assigned
   *  per win in `playWin` because it changes per symbol. */
  private ensureHalo(): void {
    if (this.halo || !SymbolView.fxHaloMat) return; // no material → on-symbol shader carries it
    const s = this.size * 1.2; // slightly larger than the art → reads as an aura around it
    const n = new Node('winHalo');
    n.layer = this.node.layer;
    n.addComponent(UITransform).setContentSize(s, s);
    this.node.addChild(n);
    n.setSiblingIndex(0); // behind the symbol art
    const sp = n.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.type = Sprite.Type.SIMPLE;
    sp.customMaterial = SymbolView.fxHaloMat;
    const op = n.addComponent(UIOpacity);
    op.opacity = 0;
    n.active = false;
    this.halo = n;
    this.haloSp = sp;
    this.haloOp = op;
  }

  playWin(delay = 0, rich = true, winMat: Material | null = null): void {
    this.ensureBurst();
    const { symbolPulseScale, symbolPulseMs } = VIEW_CONFIG.win;
    // PER-SYMBOL WIN IDENTITY — scale the whole celebration by this symbol's heat
    // so a Wild win EXPLODES and a low-pays win is a polite bump (heat 1.0 = the
    // old uniform behaviour). Drives the pop, the jelly amplitude AND the glow.
    const heat = VIEW_CONFIG.win.symbolProfiles[this._currentId]?.heat ?? 1.0;
    // WILD HERO ZOOM — the brand symbol (id 0, the gingerbread hero) doesn't just
    // pop, it ZOOMS IN and STAYS enlarged through its win (owner: "zoom effects on
    // the wild scale"). The attack settles to `zoom` (not 1.0) and the jelly
    // oscillates around it, so the Wild reads bigger/forward the whole celebration.
    // Modest 1.08 sustain so it never collides hard with neighbours.
    const zoom = this._currentId === 0 ? 1.08 : 1.0;
    const half = symbolPulseMs / 2 / 1000; // ms → s, two halves
    Tween.stopAllByTarget(this.node);
    this.node.setScale(1, 1, 1);
    const pop = (1 + (symbolPulseScale - 1 + 0.12) * heat) * zoom; // attack overshoot
    const bnc = VIEW_CONFIG.win.winBounceLoop;
    // FAST UNIFORM BOUNCE — both axes together (a ball-bounce), NOT the old opposing-
    // axis squash-and-stretch (owner: "more bouncing, not model skewing or dancing").
    // heat-scaled amplitude, centred on `zoom` so the Wild stays the enlarged hero.
    const j = bnc.jelly * heat;
    const bUp = new Vec3(zoom * (1 + j), zoom * (1 + j), 1); // bounce peak (uniform)
    const bDn = new Vec3(zoom, zoom, 1); // base
    const bhalf = bnc.ms / 2 / 1000;
    // HEAT-PACED BEAT — hotter symbols don't only pulse LOUDER (amplitude rides
    // `heat` above), they breathe SLOWER too: the cinematic "weight" cue (a Wild
    // rolls, an L5 ticks). Scales the LOOP cycle only — the attack pop stays snappy
    // (<250ms feedback). heatTempo 0 = the previous uniform tempo for every symbol.
    const beatScale = 1 + (heat - 1) * (bnc.heatTempo ?? 0);
    const bhalfBeat = bhalf * beatScale;
    const haloHalf = half * beatScale; // halo breathe shares the heat tempo
    // ATTACK (once): a snappy overshoot pop → settle. Then a CONTINUOUS fast bounce
    // (backOut up, quadIn down) so the winning symbol keeps bouncing until clear.
    tween(this.node)
      .delay(delay)
      .to(half, { scale: new Vec3(pop, pop, 1) }, { easing: 'backOut' })
      .to(half, { scale: new Vec3(zoom, zoom, 1) }, { easing: 'quadIn' })
      .start();
    if (bnc.enabled) {
      tween(this.node)
        .delay(delay + half * 2) // begin after the attack lands
        .to(bhalfBeat, { scale: bUp }, { easing: 'backOut' }) // pop UP
        .to(bhalfBeat, { scale: bDn }, { easing: 'quadIn' }) // settle DOWN
        .union()
        .repeatForever()
        .start();
    }
    // Keep the OLD square/box glow parked off (lock/wild-land still use it).
    if (this.glow && this.glowOp) {
      Tween.stopAllByTarget(this.glow);
      Tween.stopAllByTarget(this.glowOp);
      this.glowOp.opacity = 0;
      this.glow.setScale(0.8, 0.8, 1);
    }
    // COOL ON-SYMBOL GLOW (owner: the stripped-down win "looks not cool"): a glowing
    // additive copy of the symbol's OWN art (svarka-additive samples its alpha) pulses
    // behind it, so the light is the SYMBOL'S shape — a candy aura, never a bg box.
    // heat-scaled: Wild glows hottest. Breathes until clear. Skipped on buffer cells
    // with no frame (nothing to clip the glow to).
    const haloFrame = this.sprite?.spriteFrame ?? null;
    if (haloFrame) this.ensureHalo();
    if (haloFrame && this.halo && this.haloOp && this.haloSp) {
      this.haloSp.spriteFrame = haloFrame; // clip the glow to THIS symbol's silhouette
      Tween.stopAllByTarget(this.halo);
      Tween.stopAllByTarget(this.haloOp);
      this.halo.active = true;
      this.halo.setScale(1.12, 1.12, 1);
      this.haloOp.opacity = 0;
      const haloPeak = Math.min(210, Math.round(135 * heat));
      tween(this.haloOp)
        .delay(delay)
        .to(haloHalf, { opacity: haloPeak }, { easing: 'sineOut' })
        .to(haloHalf, { opacity: Math.round(haloPeak * 0.42) }, { easing: 'sineIn' })
        .union()
        .repeatForever()
        .start();
      tween(this.halo)
        .delay(delay)
        .to(haloHalf, { scale: new Vec3(1.26, 1.26, 1) }, { easing: 'sineInOut' })
        .to(haloHalf, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'sineInOut' })
        .union()
        .repeatForever()
        .start();
    }
    if (rich) {
      // CINEMA WAVE — prefer the shader rim-light/sweep overlay; the Graphics
      // sheen + corner sparkles are the fallback when the material is unavailable
      // (vfx.materialsEnabled off / load failed) or under reducedFx (caller passes
      // winMat = null in those cases).
      if (winMat && VIEW_CONFIG.win.symbolFx.enabled) {
        this.playWinShader(delay, winMat);
        // The shader overlay replaces only the diagonal SHEEN. The corner-twinkle
        // sparkles are an ADDITIVE "candy catches the light" layer that should fire
        // on EVERY rich win — they were previously else-only, so a normal (material-
        // on) win silently lost them. Pooled + killed in stopWinFx.
        this.playSparkles(delay);
      } else {
        this.playSheen(delay);
        this.playSparkles(delay);
      }
    }
  }

  /** CINEMA WAVE — additive shader overlay that reads this symbol's own alpha and
   *  paints the animated rim-light + specular sweep. Built lazily; re-pointed at
   *  the current spriteFrame each win so it always traces the right silhouette. */
  private playWinShader(delay: number, mat: Material): void {
    const cfg = VIEW_CONFIG.win.symbolFx;
    if (!this.winOverlay) {
      const s = this.size * cfg.scale;
      const n = new Node('winSheenFx');
      n.layer = this.node.layer;
      n.addComponent(UITransform).setContentSize(s, s);
      // Parent to `art` so the overlay tracks the symbol's position + idle breathe;
      // added last → renders ON TOP of the symbol sprite.
      this.art?.addChild(n);
      const sp = n.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      sp.type = Sprite.Type.SIMPLE;
      // PER-SYMBOL PHASE — a stable random seed in color.rg (the symbol-win
      // shader reads it as an animation phase offset; it never tints with
      // color.rgb, only color.a carries the opacity envelope). This desyncs the
      // shimmer/sweep/sparkle so the grid reads as lively per-symbol candy, NOT
      // one synchronised diagonal flash across the whole board.
      sp.color = new Color(
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        255,
        255,
      );
      this.winOverlay = n;
      this.winOverlaySp = sp;
      this.winOverlayOp = n.addComponent(UIOpacity);
    }
    const sp = this.winOverlaySp!;
    sp.spriteFrame = this.sprite?.spriteFrame ?? null; // sample the CURRENT symbol
    sp.customMaterial = mat;
    const op = this.winOverlayOp!;
    this.winOverlay.active = true;
    Tween.stopAllByTarget(op);
    op.opacity = 0;
    tween(op)
      .delay(delay)
      .to(cfg.envInMs / 1000, { opacity: cfg.envHoldOpacity }, { easing: 'sineOut' })
      .start();
  }

  /** SHEEN SWEEP (slot-vfx Layer 7): a bright diagonal specular streak rakes
   *  top->bottom across the symbol face, looping — reads as light catching a
   *  glossy candy surface. Built lazily on first win. */
  private playSheen(delay: number): void {
    if (!this.sheen) {
      const s = this.size;
      const n = new Node('sheen');
      n.addComponent(UITransform).setContentSize(s, s);
      this.node.addChild(n);
      const g = n.addComponent(Graphics);
      // thin bright parallelogram (diagonal streak), no circles
      g.fillColor = new Color(255, 236, 248, 40); // candy-white, low alpha (stack-safe)
      g.moveTo(-s * 0.12, s * 0.6);
      g.lineTo(s * 0.06, s * 0.6);
      g.lineTo(-s * 0.06, -s * 0.6);
      g.lineTo(-s * 0.24, -s * 0.6);
      g.close();
      g.fill();
      n.addComponent(UIOpacity).opacity = 0;
      this.sheen = n;
    }
    const sheen = this.sheen;
    const s = this.size;
    const op = sheen.getComponent(UIOpacity)!;
    Tween.stopAllByTarget(sheen);
    Tween.stopAllByTarget(op);
    sheen.setPosition(-s * 0.55, s * 0.5, 0);
    op.opacity = 0;
    // sweep position L->R, fade in/out at the ends; loop until cleared.
    tween(sheen)
      .delay(delay)
      .to(0.55, { position: new Vec3(s * 0.55, -s * 0.5, 0) }, { easing: 'sineInOut' })
      .delay(0.7)
      .union()
      .repeatForever()
      .start();
    tween(op)
      .delay(delay)
      .to(0.18, { opacity: 95 })
      .to(0.37, { opacity: 0 })
      .delay(0.7)
      .union()
      .repeatForever()
      .start();
  }

  /** EDGE SPARKLE (slot-vfx Layer 8): four tiny diamonds twinkle at the cell
   *  corners on a staggered loop. Pure opacity + scale, no circles. */
  private playSparkles(delay: number): void {
    if (this.sparkles.length === 0) {
      const s = this.size;
      const corners = [
        [-s * 0.4, s * 0.4],
        [s * 0.4, s * 0.4],
        [s * 0.4, -s * 0.4],
        [-s * 0.4, -s * 0.4],
      ];
      for (const [x, y] of corners) {
        const n = new Node('spark');
        n.addComponent(UITransform).setContentSize(12, 12);
        n.setPosition(x, y, 0);
        const g = n.addComponent(Graphics);
        g.fillColor = new Color(255, 224, 255, 200);
        g.moveTo(0, 6);
        g.lineTo(5, 0);
        g.lineTo(0, -6);
        g.lineTo(-5, 0);
        g.close();
        g.fill();
        n.addComponent(UIOpacity).opacity = 0;
        this.node.addChild(n);
        this.sparkles.push(n);
      }
    }
    this.sparkles.forEach((n, i) => {
      const op = n.getComponent(UIOpacity)!;
      Tween.stopAllByTarget(op);
      Tween.stopAllByTarget(n);
      op.opacity = 0;
      n.setScale(0.4, 0.4, 1);
      tween(op)
        .delay(delay + i * 0.18)
        .to(0.16, { opacity: 230 })
        .to(0.3, { opacity: 0 })
        .delay(0.7)
        .union()
        .repeatForever()
        .start();
      tween(n)
        .delay(delay + i * 0.18)
        .to(0.16, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .to(0.3, { scale: new Vec3(0.4, 0.4, 1) })
        .delay(0.7)
        .union()
        .repeatForever()
        .start();
    });
  }

  /** Kill the looping win layers (called from clear on the next spin). */
  private stopWinFx(): void {
    if (this.halo && this.haloOp) {
      Tween.stopAllByTarget(this.halo);
      Tween.stopAllByTarget(this.haloOp);
      this.haloOp.opacity = 0;
      this.halo.active = false;
    }
    if (this.winOverlay && this.winOverlayOp) {
      Tween.stopAllByTarget(this.winOverlayOp);
      this.winOverlayOp.opacity = 0;
      this.winOverlay.active = false;
    }
    if (this.sheen) {
      Tween.stopAllByTarget(this.sheen);
      const op = this.sheen.getComponent(UIOpacity);
      if (op) {
        Tween.stopAllByTarget(op);
        op.opacity = 0;
      }
    }
    this.sparkles.forEach((n) => {
      Tween.stopAllByTarget(n);
      const op = n.getComponent(UIOpacity);
      if (op) {
        Tween.stopAllByTarget(op);
        op.opacity = 0;
      }
    });
  }

  /** Sharp one-shot WILD-landing flash: scale punch + single hot glow strike.
   *  Distinct from playWin (sustained pulse) — this is the "it just hit" beat. */
  flashWildLand(delay = 0): void {
    this.ensureBurst(); // shader burst, never the banded Graphics circles
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
  playLock(delay = 0, opts?: { peak?: number; glowPeak?: number }): void {
    const peak = opts?.peak ?? 1.14;
    const glowPeak = opts?.glowPeak ?? 150;
    this.ensureBurst(); // shader burst, never the banded Graphics circles
    Tween.stopAllByTarget(this.node);
    this.node.setScale(1, 1, 1);
    tween(this.node)
      .delay(delay)
      .to(0.08, { scale: new Vec3(peak, peak, 1) }, { easing: 'quadOut' })
      .to(0.16, { scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' })
      .start();
    if (this.glow && this.glowOp) {
      Tween.stopAllByTarget(this.glow);
      Tween.stopAllByTarget(this.glowOp);
      this.glow.setScale(1, 1, 1);
      tween(this.glowOp)
        .delay(delay)
        .to(0.1, { opacity: glowPeak })
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

  /** Task 6.3 — short position jitter when the Svarka head crosses this cell.
   *  Captures the rest position locally so chained calls re-rest cleanly.
   *  Drives the NODE position only — scale/opacity tweens (playWin) run in
   *  parallel without conflict. */
  playShake(amp: number, durMs: number): void {
    const rest = this.node.position.clone();
    const d = durMs / 1000;
    const kick = (dx: number, dy: number) => new Vec3(rest.x + dx, rest.y + dy, rest.z);
    tween(this.node)
      .to(d * 0.25, { position: kick(amp, amp * 0.5) }, { easing: 'quadOut' })
      .to(d * 0.25, { position: kick(-amp * 0.8, -amp * 0.4) }, { easing: 'quadOut' })
      .to(d * 0.25, { position: kick(amp * 0.5, amp * 0.25) }, { easing: 'quadOut' })
      .to(d * 0.25, { position: rest }, { easing: 'quadOut' })
      .start();
  }

  /** WIN FOCUS — dim this cell's art while OTHER cells win, restore on clear.
   *  Opacity only (the cell's scale/tweens stay untouched), so it composes with
   *  idle breathing and never fights the win envelopes. */
  setDimmed(on: boolean): void {
    if (!this.artOp) return;
    Tween.stopAllByTarget(this.artOp);
    tween(this.artOp)
      .to(0.18, { opacity: on ? VIEW_CONFIG.win.loserDimOpacity : 255 })
      .start();
  }

  clear(): void {
    Tween.stopAllByTarget(this.node);
    this.node.setScale(1, 1, 1);
    this.node.angle = 0; // reset the win shimmy so a cleared symbol is never tilted
    this.setDimmed(false);
    if (this.glow) {
      Tween.stopAllByTarget(this.glow);
      this.glow.setScale(0.8, 0.8, 1);
    }
    if (this.glowOp) {
      Tween.stopAllByTarget(this.glowOp);
      this.glowOp.opacity = 0;
    }
    this.stopWinFx();
  }
}
