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

  private winOverlay: Node | null = null;
  private winOverlaySp: Sprite | null = null;
  private winOverlayOp: UIOpacity | null = null;

  static fxBurstMat: Material | null = null;
  static fxWhiteFrame: SpriteFrame | null = null;

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
    const frame = this.frames[id] ?? null;
    if (this.sprite) this.sprite.spriteFrame = frame;
    if (this.label) this.label.string = frame ? '' : (SYMBOL_NAMES[id] ?? String(id));

    this.idleAmp = id === SYMBOLS.WILD ? 0 : id <= 4 ? 0.03 : 0.018;

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
    const s = this.size * 1.2;
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

  private liftForWin(overlay: Node, worldCenter: Vec3): void {
    if (this.homeParent) return;
    this.homeParent = this.node.parent;
    this.homeSibling = this.node.getSiblingIndex();
    this.homePos = this.node.position.clone();
    this.node.setParent(overlay, false);
    this.node.setPosition(worldCenter);
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
    const pop = (1 + (symbolPulseScale - 1 + 0.12) * heat) * zoom;
    const bnc = VIEW_CONFIG.win.winBounceLoop;

    const j = bnc.jelly * heat;
    const bUp = new Vec3(zoom * (1 + j), zoom * (1 + j), 1);
    const bDn = new Vec3(zoom, zoom, 1);
    const bhalf = bnc.ms / 2 / 1000;

    const beatScale = 1 + (heat - 1) * (bnc.heatTempo ?? 0);
    const bhalfBeat = bhalf * beatScale;
    const haloHalf = half * beatScale;

    // Anticipation: a brief squash before the spring so the pop lands as an
    // impact. Deeper on hotter symbols. Everything that should fire ON the pop
    // (bounce, tilt, halo, sparkles) is shifted past the dip by `popStart`.
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
        .to(td, { eulerAngles: new Vec3(0, tlt.deg, 0) }, { easing: 'sineInOut' })
        .to(td, { eulerAngles: new Vec3(0, -tlt.deg, 0) }, { easing: 'sineInOut' })
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

    const haloFrame = this.sprite?.spriteFrame ?? null;
    if (haloFrame) this.ensureHalo();
    if (haloFrame && this.halo && this.haloOp && this.haloSp) {
      this.haloSp.spriteFrame = haloFrame;
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
    }
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

  private playStarPop(delay: number, heat: number): void {
    const N = 6;
    if (this.starPops.length === 0) {
      const candy = [
        new Color(255, 214, 96, 255),
        new Color(255, 150, 205, 255),
        new Color(255, 255, 255, 255),
        new Color(150, 240, 220, 255),
      ];
      for (let i = 0; i < N; i++) {
        const n = new Node('winStar');
        n.layer = this.node.layer;
        n.addComponent(UITransform).setContentSize(20, 20);
        const g = n.addComponent(Graphics);

        if (i % 2 === 1) {
          const h = 9;
          g.fillColor = new Color(255, 138, 196, 255);
          g.moveTo(0, h * 0.32);
          g.bezierCurveTo(h * 0.55, h * 0.95, h * 1.05, h * 0.1, 0, -h * 0.7);
          g.bezierCurveTo(-h * 1.05, h * 0.1, -h * 0.55, h * 0.95, 0, h * 0.32);
          g.close();
          g.fill();
        } else {
          g.fillColor = candy[i % candy.length];
          const R = 9,
            r = 3.7;
          for (let k = 0; k < 10; k++) {
            const rad = k % 2 === 0 ? R : r;
            const a = Math.PI / 2 + (k * Math.PI) / 5;
            const x = Math.cos(a) * rad,
              y = Math.sin(a) * rad;
            if (k === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          g.close();
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
      op.opacity = 0;
      n.setPosition(0, 0, 0);
      n.setScale(0.2, 0.2, 1);
      n.angle = 0;
      tween(op)
        .delay(delay + i * 0.04)
        .to(0.16, { opacity: 245 })
        .to(0.34, { opacity: 0 })
        .delay(0.95)
        .union()
        .repeatForever()
        .start();
      tween(n)
        .delay(delay + i * 0.04)
        .to(
          0.16,
          { position: new Vec3(tx * 0.6, ty * 0.6, 0), scale: new Vec3(1.15, 1.15, 1), angle: 35 },
          { easing: 'backOut' },
        )
        .to(
          0.34,
          { position: new Vec3(tx, ty, 0), scale: new Vec3(0.45, 0.45, 1), angle: 80 },
          { easing: 'quadOut' },
        )
        .call(() => {
          n.setPosition(0, 0, 0);
          n.setScale(0.2, 0.2, 1);
          n.angle = 0;
        })
        .delay(0.95)
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

  playLand(squashY: number): void {
    Tween.stopAllByTarget(this.node);
    this.node.setScale(1, 1, 1);
    tween(this.node)
      .to(0.06, { scale: new Vec3(1 + (1 - squashY), squashY, 1) }, { easing: 'quadOut' })
      .to(0.13, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
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
