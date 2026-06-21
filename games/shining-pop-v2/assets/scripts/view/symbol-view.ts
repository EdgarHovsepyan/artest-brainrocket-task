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

const FULL_SIZE_IDS = new Set<number>([SYMBOLS.WILD, 8]);
const SYMBOL_SHRINK = 0.85;

@ccclass('SymbolView')
export class SymbolView extends Component {
  private sprite: Sprite | null = null;
  private label: Label | null = null;
  private frames: SpriteFrame[] = [];
  private glow: Node | null = null;
  private glowOp: UIOpacity | null = null;

  private halo: Node | null = null;
  private haloOp: UIOpacity | null = null;
  private haloSp: Sprite | null = null;

  private happyFace: Node | null = null;
  private happyFaceOp: UIOpacity | null = null;
  private landRest: Vec3 | null = null;
  private size = 90;

  private homeParent: Node | null = null;
  private homeSibling = 0;
  private homePos: Vec3 | null = null;

  private _currentId = 0;
  get currentId(): number {
    return this._currentId;
  }

  private sparkles: Node[] = [];

  private starPops: Node[] = [];

  private bubbles: Node[] = [];

  private winOverlay: Node | null = null;
  private winOverlaySp: Sprite | null = null;
  private winOverlayOp: UIOpacity | null = null;

  static fxBurstMat: Material | null = null;
  static fxWhiteFrame: SpriteFrame | null = null;
  static fxRadialFrame: SpriteFrame | null = null;
  static wildWinFrame: SpriteFrame | null = null;
  static scatterWinFrame: SpriteFrame | null = null;
  private wildFaceSwapped = false;

  static fxHaloMat: Material | null = null;
  private burstUpgraded = false;

  private art: Node | null = null;
  private artOp: UIOpacity | null = null;
  private idleT = 0;
  private idlePhase = 0;
  private idleAmp = 0;
  private idleOn = false;

  private artBaseScale = 1;

  build(size: number, frames: SpriteFrame[], phase = 0): void {
    this.frames = frames;
    this.size = size;
    this.idlePhase = phase;

    const art = size * VIEW_CONFIG.layout.symbolFill;
    (this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)).setContentSize(
      art,
      art,
    );

    const artNode = new Node('art');
    artNode.addComponent(UITransform).setContentSize(art, art);
    this.node.addChild(artNode);
    this.art = artNode;
    this.artOp = artNode.addComponent(UIOpacity);
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
    lbl.color = new Color(245, 247, 250, 255);
    applyFont(lbl, 'display');
    this.label = lbl;

    const glowNode = new Node('winGlow');
    glowNode.addComponent(UITransform).setContentSize(size, size);
    this.node.addChild(glowNode);
    glowNode.setSiblingIndex(0);
    const gg = glowNode.addComponent(Graphics);
    const LAYERS = 10;
    for (let i = LAYERS - 1; i >= 0; i--) {
      const t = i / (LAYERS - 1);
      const rad = size * (0.22 + t * 0.56);
      const r = 255;

      const gch = Math.round(238 - t * 198);
      const bch = Math.round(200 - t * 200);
      const a = Math.round((1 - t) * (1 - t) * 120);
      gg.fillColor = new Color(r, gch, bch, a);
      gg.roundRect(-rad, -rad, rad * 2, rad * 2, rad);
      gg.fill();
    }
    glowNode.setScale(0.8, 0.8, 1);

    glowNode.active = false;
    this.glow = glowNode;
    this.glowOp = glowNode.addComponent(UIOpacity);
    this.glowOp.opacity = 0;
  }

  setSymbol(id: number): void {
    this._currentId = id;
    this.wildFaceSwapped = false;
    const frame = this.frames[id] ?? null;
    if (this.sprite) this.sprite.spriteFrame = frame;
    if (this.label) this.label.string = frame ? '' : (SYMBOL_NAMES[id] ?? String(id));

    // Idle-breathe amplitude is data-driven + cut to a whisper for the crisp stop
    // (see VIEW_CONFIG.symbols.idleBreatheAmp). Wild stays 0 (its own FX carry it).
    const ba = VIEW_CONFIG.symbols.idleBreatheAmp;
    this.idleAmp = id === SYMBOLS.WILD ? 0 : id <= 4 ? ba.high : ba.low;

    this.artBaseScale = FULL_SIZE_IDS.has(id) ? 1 : SYMBOL_SHRINK;
    if (this.art) this.art.setScale(this.artBaseScale, this.artBaseScale, 1);
  }

  update(dt: number): void {
    if (!this.idleOn || !this.art) return;
    this.idleT += dt;
    const sc = (1 + Math.sin(this.idleT * 1.9 + this.idlePhase) * this.idleAmp) * this.artBaseScale;
    this.art.setScale(sc, sc, 1);
  }

  setIdle(on: boolean): void {
    this.idleOn = on;
    if (!on && this.art) this.art.setScale(this.artBaseScale, this.artBaseScale, 1);
  }

  private ensureBurst(): void {
    if (this.burstUpgraded || !VIEW_CONFIG.win.burst.enabled) return;
    const mat = SymbolView.fxBurstMat;
    const sf = SymbolView.fxWhiteFrame;
    if (!mat || !sf) return;
    const s = this.size * VIEW_CONFIG.win.burst.scale;
    const n = new Node('winBurst');
    n.layer = this.node.layer;
    n.addComponent(UITransform).setContentSize(s, s);
    this.node.addChild(n);
    n.setSiblingIndex(0);
    const sp = n.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.type = Sprite.Type.SIMPLE;
    sp.spriteFrame = sf;
    sp.customMaterial = mat;
    const op = n.addComponent(UIOpacity);
    op.opacity = 0;
    n.setScale(0.8, 0.8, 1);
    if (this.glow) this.glow.active = false;
    this.glow = n;
    this.glowOp = op;
    this.burstUpgraded = true;
  }

  private ensureHalo(): void {
    if (this.halo || !SymbolView.fxHaloMat) return;
    // Tighter halo (was 1.75) so the win glow stays near the symbol; the winLift
    // mask now also clips whatever remains at the board edge.
    const s = this.size * 1.35;
    const n = new Node('winHalo');
    n.layer = this.node.layer;
    n.addComponent(UITransform).setContentSize(s, s);
    this.node.addChild(n);
    n.setSiblingIndex(0);
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

  private ensureHappyFace(): void {
    if (this.happyFace || !this.art) return;
    const cfg = VIEW_CONFIG.win.wildHappyFace;
    const n = new Node('happyFace');
    n.layer = this.node.layer;
    n.addComponent(UITransform).setContentSize(this.size, this.size);
    this.art.addChild(n);
    n.setPosition(0, this.size * cfg.offsetYFrac, 0);
    n.setScale(cfg.scale, cfg.scale, 1);

    const g = n.addComponent(Graphics);
    const eyeY = 5;
    const eyeX = 11;

    g.fillColor = new Color(255, 130, 170, 120);
    g.circle(-eyeX - 6, -3, 5.5);
    g.circle(eyeX + 6, -3, 5.5);
    g.fill();

    g.fillColor = new Color(40, 22, 14, 255);
    g.circle(-eyeX, eyeY, 4.2);
    g.circle(eyeX, eyeY, 4.2);
    g.fill();
    g.fillColor = new Color(255, 255, 255, 255);
    g.circle(-eyeX + 1.5, eyeY + 1.5, 1.5);
    g.circle(eyeX + 1.5, eyeY + 1.5, 1.5);
    g.fill();

    g.fillColor = new Color(70, 30, 18, 255);
    const w = 15;
    const depth = 13;
    g.moveTo(-w, -3);
    for (let i = 1; i <= 14; i++) {
      const x = -w + (2 * w * i) / 14;
      const y = -3 - depth * (1 - (x / w) * (x / w));
      g.lineTo(x, y);
    }
    g.lineTo(w, -3);
    g.close();
    g.fill();
    g.fillColor = new Color(255, 120, 150, 255);
    g.circle(0, -3 - depth * 0.62, 3.4);
    g.fill();

    const op = n.addComponent(UIOpacity);
    op.opacity = 0;
    n.active = false;
    this.happyFace = n;
    this.happyFaceOp = op;
  }

  private showHappyFace(delay: number): void {
    if (!VIEW_CONFIG.win.wildHappyFace.enabled) return;
    if (this._currentId !== SYMBOLS.WILD) return;
    this.ensureHappyFace();
    if (!this.happyFace || !this.happyFaceOp) return;

    const hfParent = this.happyFace.parent;
    if (hfParent) this.happyFace.setSiblingIndex(hfParent.children.length - 1);
    const ms = VIEW_CONFIG.win.wildHappyFace.fadeMs / 1000;
    Tween.stopAllByTarget(this.happyFaceOp);
    Tween.stopAllByTarget(this.happyFace);
    this.happyFace.active = true;
    this.happyFaceOp.opacity = 0;
    this.happyFace.setScale(0.6, 0.6, 1);
    tween(this.happyFaceOp).delay(delay).to(ms, { opacity: 255 }).start();
    tween(this.happyFace)
      .delay(delay)
      .to(ms, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .start();
  }

  private hideHappyFace(): void {
    if (!this.happyFace || !this.happyFaceOp) return;
    Tween.stopAllByTarget(this.happyFaceOp);
    Tween.stopAllByTarget(this.happyFace);
    this.happyFaceOp.opacity = 0;
    this.happyFace.active = false;
  }

  private liftForWin(overlay: Node, _worldCenter: Vec3): void {
    // Capture home ONLY when the cell is in its real reel — never from the overlay
    // itself. The old `if (homeParent) return` could (a) record homeParent = winLift
    // when a cell was already lifted, corrupting its way back, and (b) skip the
    // reposition on a re-lift, stranding the symbol at the centre reel (localX=0)
    // while its true cell rendered empty — the "symbols crammed in the middle +
    // empty reels" bug.
    if (!this.homeParent && this.node.parent !== overlay) {
      this.homeParent = this.node.parent;
      this.homeSibling = this.node.getSiblingIndex();
      this.homePos = this.node.position.clone();
    }
    // Reparent KEEPING the world transform so the symbol stays EXACTLY at its
    // own cell. The previous manual slot-view -> overlay-local conversion
    // (worldCenter.x - op.x) collapsed every winning symbol onto the CENTRE reel
    // at runtime (measured: lifted cells landed at the board centre, real cells
    // empty). Letting Cocos preserve the world position is correct and needs no
    // cellCenter math; the overlay only lifts the symbol above the reel mask for
    // an unclipped pop.
    if (this.node.parent !== overlay) this.node.setParent(overlay, true);
  }

  playWin(
    delay = 0,
    rich = true,
    winMat: Material | null = null,
    lift: Node | null = null,
    worldCenter: Vec3 | null = null,
  ): void {
    this.ensureBurst();

    if (lift && worldCenter) this.liftForWin(lift, worldCenter);
    const { symbolPulseScale, symbolPulseMs } = VIEW_CONFIG.win;

    const heat = VIEW_CONFIG.win.symbolProfiles[this._currentId]?.heat ?? 1.0;

    const sustain = VIEW_CONFIG.win.winSustainScale ?? 1.0;
    const zoom = (this._currentId === 0 ? sustain + 0.06 : sustain) * (0.96 + 0.04 * heat);
    const half = symbolPulseMs / 2 / 1000;
    Tween.stopAllByTarget(this.node);
    this.node.setScale(1, 1, 1);
    // The Wild (and scatter art) are full-size — they already fill the cell, so
    // the standard win-pop overshoot (~1.5x) shoves them past the reel/board
    // border ("wild moving out to the outside"). Temper the overshoot + bounce
    // jelly for full-size symbols so the win pop stays inside the board.
    const fsTemper = FULL_SIZE_IDS.has(this._currentId) ? 0.35 : 1;
    const pop = (1 + (symbolPulseScale - 1 + 0.12) * heat * fsTemper) * zoom;
    const bnc = VIEW_CONFIG.win.winBounceLoop;

    const j = bnc.jelly * heat * fsTemper;
    const bUp = new Vec3(zoom * (1 + j), zoom * (1 + j), 1);
    const bDn = new Vec3(zoom, zoom, 1);
    const bhalf = bnc.ms / 2 / 1000;

    const beatScale = 1 + (heat - 1) * (bnc.heatTempo ?? 0);
    const bhalfBeat = bhalf * beatScale;
    const haloHalf = half * beatScale;

    const ant = VIEW_CONFIG.win.winAnticipation;
    const antDur = ant?.enabled ? ant.ms / 1000 : 0;
    const antDip = ant?.enabled ? 1 - (1 - ant.dip) * heat : 1;
    const popStart = delay + antDur;

    const popTween = tween(this.node).delay(delay);
    if (antDur > 0)
      popTween.to(antDur, { scale: new Vec3(antDip, antDip, 1) }, { easing: 'quadOut' });
    popTween
      .to(half, { scale: new Vec3(pop, pop, 1) }, { easing: 'backOut' })
      .to(half, { scale: new Vec3(zoom, zoom, 1) }, { easing: 'quadIn' })
      .start();
    if (bnc.enabled) {
      tween(this.node)
        .delay(popStart + half * 2)
        .to(bhalfBeat, { scale: bUp }, { easing: 'backOut' })
        .to(bhalfBeat, { scale: bDn }, { easing: 'quadIn' })
        .union()
        .repeatForever()
        .start();
    }

    const tlt = VIEW_CONFIG.win.winTilt;
    if (tlt?.enabled && bnc.enabled) {
      const td = tlt.ms / 1000;
      this.node.eulerAngles = new Vec3(0, 0, 0);
      tween(this.node)
        .delay(popStart + half * 2)
        // Z-axis (in-plane) rock — a Y-axis tilt turned the symbol edge-on /
        // foreshortened it; the in-plane sway keeps it full-face while it
        // celebrates.
        .to(td, { eulerAngles: new Vec3(0, 0, tlt.deg) }, { easing: 'sineInOut' })
        .to(td, { eulerAngles: new Vec3(0, 0, -tlt.deg) }, { easing: 'sineInOut' })
        .union()
        .repeatForever()
        .start();
    }

    if (this.glow && this.glowOp) {
      Tween.stopAllByTarget(this.glow);
      Tween.stopAllByTarget(this.glowOp);
      this.glowOp.opacity = 0;
      this.glow.setScale(0.8, 0.8, 1);
    }

    const haloFrame = SymbolView.fxRadialFrame ?? this.sprite?.spriteFrame ?? null;
    if (haloFrame) this.ensureHalo();
    if (haloFrame && this.halo && this.haloOp && this.haloSp) {
      this.haloSp.spriteFrame = haloFrame;

      const ht = VIEW_CONFIG.win.haloTint;
      const span = Math.max(0.0001, ht.hotHeat - ht.coldHeat);
      const t = Math.min(1, Math.max(0, (heat - ht.coldHeat) / span));
      this.haloSp.color = new Color().fromHEX(ht.cold).lerp(new Color().fromHEX(ht.hot), t);
      Tween.stopAllByTarget(this.halo);
      Tween.stopAllByTarget(this.haloOp);
      this.halo.active = true;
      this.halo.setScale(1.12, 1.12, 1);
      this.haloOp.opacity = 0;
      const haloPeak = Math.min(210, Math.round(135 * heat));
      tween(this.haloOp)
        .delay(popStart)
        .to(haloHalf, { opacity: haloPeak }, { easing: 'sineOut' })
        .to(haloHalf, { opacity: Math.round(haloPeak * 0.42) }, { easing: 'sineIn' })
        .union()
        .repeatForever()
        .start();
      tween(this.halo)
        .delay(popStart)
        .to(haloHalf, { scale: new Vec3(1.26, 1.26, 1) }, { easing: 'sineInOut' })
        .to(haloHalf, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'sineInOut' })
        .union()
        .repeatForever()
        .start();
    }
    if (rich) {
      if (winMat && VIEW_CONFIG.win.symbolFx.enabled) {
        this.playWinShader(popStart, winMat);

        this.playSparkles(popStart);
      } else {
        this.playSparkles(popStart);
      }

      this.playStarPop(popStart, heat);
      this.playBubbles(popStart, heat);
    }

    this.swapWildWinFace(popStart);
  }

  private swapWildWinFace(delay: number): void {
    if (!this.sprite) return;
    const isWild = this._currentId === SYMBOLS.WILD;
    const isScat = this._currentId === 8;
    if (!isWild && !isScat) return;
    const winF = isWild ? SymbolView.wildWinFrame : SymbolView.scatterWinFrame;
    if (!winF) {
      if (isWild) this.showHappyFace(delay);
      return;
    }
    this.wildFaceSwapped = true;
    this.scheduleOnce(
      () => {
        const id = this._currentId;
        if (this.wildFaceSwapped && (id === SYMBOLS.WILD || id === 8) && this.sprite) {
          this.sprite.spriteFrame = winF;
        }
      },
      Math.max(0, delay),
    );
  }

  private playWinShader(delay: number, mat: Material): void {
    const cfg = VIEW_CONFIG.win.symbolFx;
    if (!this.winOverlay) {
      const s = this.size * cfg.scale;
      const n = new Node('winSheenFx');
      n.layer = this.node.layer;
      n.addComponent(UITransform).setContentSize(s, s);

      this.art?.addChild(n);
      const sp = n.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      sp.type = Sprite.Type.SIMPLE;

      // Stable warm candy-white tint (was a random R,G per cell, which gave
      // winning symbols inconsistent blue-ish sheens) — lets the shader's own
      // iridescence read clean and on-brand.
      sp.color = new Color(255, 246, 252, 255);
      this.winOverlay = n;
      this.winOverlaySp = sp;
      this.winOverlayOp = n.addComponent(UIOpacity);
    }
    const sp = this.winOverlaySp!;
    sp.spriteFrame = this.sprite?.spriteFrame ?? null;
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
        n.addComponent(UITransform).setContentSize(16, 16);
        n.setPosition(x, y, 0);
        const g = n.addComponent(Graphics);
        // 4-point twinkle star (cuter than a plain dot)
        g.fillColor = new Color(255, 240, 255, 220);
        const R = 7,
          r = 1.8;
        for (let k = 0; k < 8; k++) {
          const rad = k % 2 === 0 ? R : r;
          const a = (k * Math.PI) / 4;
          const px = Math.cos(a) * rad,
            py = Math.sin(a) * rad;
          if (k === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
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
      n.angle = 0;
      tween(op)
        .delay(delay + i * 0.18)
        .to(0.16, { opacity: 235 })
        .to(0.3, { opacity: 0 })
        .delay(0.7)
        .union()
        .repeatForever()
        .start();
      tween(n)
        .delay(delay + i * 0.18)
        .to(0.16, { scale: new Vec3(1, 1, 1), angle: 45 }, { easing: 'backOut' })
        .to(0.3, { scale: new Vec3(0.4, 0.4, 1), angle: 90 })
        .delay(0.7)
        .union()
        .repeatForever()
        .start();
    });
  }

  private playStarPop(delay: number, heat: number): void {
    const N = 9; // more confetti
    if (this.starPops.length === 0) {
      const candy = [
        new Color(255, 214, 96, 255), // gold
        new Color(255, 150, 205, 255), // bubblegum
        new Color(255, 255, 255, 255), // white
        new Color(150, 240, 220, 255), // mint
        new Color(200, 170, 255, 255), // lavender
        new Color(255, 190, 150, 255), // peach
      ];
      for (let i = 0; i < N; i++) {
        const n = new Node('winStar');
        n.layer = this.node.layer;
        n.addComponent(UITransform).setContentSize(22, 22);
        const g = n.addComponent(Graphics);
        const kind = i % 3;
        if (kind === 0) {
          // heart
          const h = 9;
          g.fillColor = new Color(255, 138, 196, 255);
          g.moveTo(0, h * 0.32);
          g.bezierCurveTo(h * 0.55, h * 0.95, h * 1.05, h * 0.1, 0, -h * 0.7);
          g.bezierCurveTo(-h * 1.05, h * 0.1, -h * 0.55, h * 0.95, 0, h * 0.32);
          g.close();
          g.fill();
        } else if (kind === 1) {
          // 5-point candy star
          g.fillColor = candy[i % candy.length];
          const R = 9.5,
            r = R * 0.44;
          for (let k = 0; k < 10; k++) {
            const rad = k % 2 === 0 ? R : r;
            const a = -Math.PI / 2 + (k * Math.PI) / 5;
            const px = Math.cos(a) * rad,
              py = Math.sin(a) * rad;
            if (k === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.close();
          g.fill();
        } else {
          // glossy candy dot (highlight gives it a 3D jelly read)
          g.fillColor = candy[i % candy.length];
          g.circle(0, 0, 8);
          g.fill();
          g.fillColor = new Color(255, 255, 255, 170);
          g.circle(-2.4, 2.4, 2.6);
          g.fill();
        }
        n.addComponent(UIOpacity).opacity = 0;
        this.node.addChild(n);
        this.starPops.push(n);
      }
    }
    const spread = this.size * (0.58 + 0.3 * (heat - 1));
    this.starPops.forEach((n, i) => {
      const op = n.getComponent(UIOpacity)!;
      Tween.stopAllByTarget(op);
      Tween.stopAllByTarget(n);
      const ang = (i / N) * Math.PI * 2 + (i % 2 ? 0.42 : -0.34);
      const tx = Math.cos(ang) * spread,
        ty = Math.sin(ang) * spread;
      const peak = spread * 0.3; // gentle upward hop = celebratory confetti
      const spin = (i % 2 ? 1 : -1) * (55 + (i % 3) * 28);
      op.opacity = 0;
      n.setPosition(0, 0, 0);
      n.setScale(0.2, 0.2, 1);
      n.angle = 0;
      tween(op)
        .delay(delay + i * 0.04)
        .to(0.16, { opacity: 245 })
        .to(0.4, { opacity: 0 })
        .delay(0.9)
        .union()
        .repeatForever()
        .start();
      tween(n)
        .delay(delay + i * 0.04)
        // pop up-and-out to the arc apex, with a spin
        .to(
          0.18,
          {
            position: new Vec3(tx * 0.55, ty * 0.55 + peak, 0),
            scale: new Vec3(1.2, 1.2, 1),
            angle: spin * 0.4,
          },
          { easing: 'backOut' },
        )
        // arc down to the landing (gentle gravity) + finish the spin
        .to(
          0.4,
          { position: new Vec3(tx, ty, 0), scale: new Vec3(0.4, 0.4, 1), angle: spin },
          { easing: 'sineIn' },
        )
        .call(() => {
          n.setPosition(0, 0, 0);
          n.setScale(0.2, 0.2, 1);
          n.angle = 0;
        })
        .delay(0.9)
        .union()
        .repeatForever()
        .start();
    });
  }

  // Rising candy bubbles + little hearts that drift up off a winning symbol —
  // adds soft, cute candy "fizz" on top of the confetti burst. Pooled + looped.
  private playBubbles(delay: number, heat: number): void {
    const N = 7;
    if (this.bubbles.length === 0) {
      const tints = [
        new Color(255, 180, 220, 255), // pink
        new Color(180, 230, 255, 255), // blue
        new Color(255, 232, 150, 255), // gold
        new Color(200, 255, 210, 255), // mint
        new Color(210, 185, 255, 255), // lavender
      ];
      for (let i = 0; i < N; i++) {
        const n = new Node('winBubble');
        n.layer = this.node.layer;
        n.addComponent(UITransform).setContentSize(26, 26);
        const g = n.addComponent(Graphics);
        if (i % 3 === 2) {
          // little floating heart
          const h = 7;
          g.fillColor = new Color(255, 150, 200, 235);
          g.moveTo(0, h * 0.32);
          g.bezierCurveTo(h * 0.55, h * 0.95, h * 1.05, h * 0.1, 0, -h * 0.7);
          g.bezierCurveTo(-h * 1.05, h * 0.1, -h * 0.55, h * 0.95, 0, h * 0.32);
          g.close();
          g.fill();
        } else {
          // translucent candy bubble: soft body + bright rim + gloss highlight
          const t = tints[i % tints.length];
          const r = 6 + (i % 3) * 2.4;
          g.fillColor = new Color(t.r, t.g, t.b, 60);
          g.circle(0, 0, r);
          g.fill();
          g.lineWidth = 1.6;
          g.strokeColor = new Color(255, 255, 255, 140);
          g.circle(0, 0, r);
          g.stroke();
          g.fillColor = new Color(255, 255, 255, 210);
          g.circle(-r * 0.32, r * 0.32, r * 0.28);
          g.fill();
        }
        n.addComponent(UIOpacity).opacity = 0;
        this.node.addChild(n);
        this.bubbles.push(n);
      }
    }
    const sz = this.size;
    this.bubbles.forEach((n, i) => {
      const op = n.getComponent(UIOpacity)!;
      Tween.stopAllByTarget(op);
      Tween.stopAllByTarget(n);
      const baseX = (((i * 53) % 100) / 100 - 0.5) * sz * 0.55;
      const rise = sz * (0.72 + 0.22 * heat);
      const wob = (i % 2 ? 1 : -1) * sz * 0.07;
      const dur = 1.05 + (i % 3) * 0.16;
      const stag = delay + i * 0.12;
      const baseY = -sz * 0.32;
      op.opacity = 0;
      n.setPosition(baseX, baseY, 0);
      n.setScale(0.35, 0.35, 1);
      tween(op)
        .delay(stag)
        .to(0.24, { opacity: 210 })
        .delay(dur * 0.35)
        .to(dur * 0.5, { opacity: 0 })
        .delay(0.5)
        .union()
        .repeatForever()
        .start();
      tween(n)
        .delay(stag)
        .to(
          dur,
          { position: new Vec3(baseX + wob, baseY + rise, 0), scale: new Vec3(1, 1, 1) },
          { easing: 'sineOut' },
        )
        .call(() => {
          n.setPosition(baseX, baseY, 0);
          n.setScale(0.35, 0.35, 1);
        })
        .delay(0.5)
        .union()
        .repeatForever()
        .start();
    });
  }

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
    this.sparkles.forEach((n) => {
      Tween.stopAllByTarget(n);
      const op = n.getComponent(UIOpacity);
      if (op) {
        Tween.stopAllByTarget(op);
        op.opacity = 0;
      }
    });
    this.starPops.forEach((n) => {
      Tween.stopAllByTarget(n);
      const op = n.getComponent(UIOpacity);
      if (op) {
        Tween.stopAllByTarget(op);
        op.opacity = 0;
      }
    });
    this.bubbles.forEach((n) => {
      Tween.stopAllByTarget(n);
      const op = n.getComponent(UIOpacity);
      if (op) {
        Tween.stopAllByTarget(op);
        op.opacity = 0;
      }
    });
  }

  flashWildLand(delay = 0): void {
    this.ensureBurst();
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

  playLock(delay = 0, opts?: { peak?: number; glowPeak?: number }): void {
    const peak = opts?.peak ?? 1.14;
    const glowPeak = opts?.glowPeak ?? 150;
    this.ensureBurst();
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

  playLand(cell: number, dipFrac: number, sqFrac: number, durMs: number): void {
    Tween.stopAllByTarget(this.node);

    if (!this.landRest) this.landRest = this.node.position.clone();
    const home = this.landRest;
    const d = Math.max(0.05, durMs / 1000);
    this.node.setPosition(home);
    this.node.setScale(1, 1, 1);
    const dip = new Vec3(home.x, home.y - cell * dipFrac, home.z);
    const squash = new Vec3(1 + sqFrac, 1 - sqFrac, 1);
    // CRISP-STOP: return with quadOut (was backOut). backOut overshot scale past 1
    // on the recovery — a small post-land scale bounce. quadOut settles the firm
    // land-squash straight back to 1 with no overshoot. With dipFrac now 0 the
    // position never moves; this is a pure, single, firm squash "thunk".
    tween(this.node)
      .to(d * 0.3, { position: dip, scale: squash }, { easing: 'quadOut' })
      .to(d * 0.7, { position: home, scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
      .start();
  }

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

  setDimmed(on: boolean): void {
    if (!this.artOp) return;
    Tween.stopAllByTarget(this.artOp);
    tween(this.artOp)
      .to(0.18, { opacity: on ? VIEW_CONFIG.win.loserDimOpacity : 255 })
      .start();
  }

  clear(): void {
    Tween.stopAllByTarget(this.node);

    if (this.homeParent) {
      this.node.setParent(this.homeParent, false);
      this.node.setSiblingIndex(this.homeSibling);
      if (this.homePos) this.node.setPosition(this.homePos);
      this.homeParent = null;
      this.homePos = null;
    }
    this.node.setScale(1, 1, 1);
    this.node.eulerAngles = new Vec3(0, 0, 0);
    if (this.wildFaceSwapped) {
      this.wildFaceSwapped = false;
      if (this.sprite && (this._currentId === SYMBOLS.WILD || this._currentId === 8)) {
        this.sprite.spriteFrame = this.frames[this._currentId] ?? null;
      }
    }
    this.hideHappyFace();
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

  /**
   * Hard-reset this cell back to its strip home and clear ANY stale win-lift
   * state. Called at the start of every spin so a win-lift that wasn't cleanly
   * restored can never leave a symbol parented to winLift or at a stale localX
   * (which renders it in the WRONG column, even off-board, and persists). This
   * is authoritative; clear() only undoes a lift while homeParent is still set,
   * which is not guaranteed once a new spin interrupts a live win.
   */
  resetHome(strip: Node, localPos: Vec3): void {
    Tween.stopAllByTarget(this.node);
    if (this.node.parent !== strip) this.node.setParent(strip, false);
    this.node.setPosition(localPos);
    this.node.setScale(1, 1, 1);
    this.node.eulerAngles = new Vec3(0, 0, 0);
    this.homeParent = null;
    this.homePos = null;
    if (this.artOp) {
      Tween.stopAllByTarget(this.artOp);
      this.artOp.opacity = 255;
    }
    this.stopWinFx();
  }
}
