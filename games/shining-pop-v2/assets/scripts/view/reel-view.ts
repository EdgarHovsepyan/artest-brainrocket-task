import {
  _decorator,
  Component,
  Mask,
  Material,
  Node,
  SpriteFrame,
  tween,
  Tween,
  UITransform,
  Vec3,
} from 'cc';
import { GRID, SYMBOL_NAMES } from '../logic/game-config';
import { VIEW_CONFIG } from './view-config';
import { SymbolView } from './symbol-view';

const { ccclass } = _decorator;

const SYMBOL_COUNT = Object.keys(SYMBOL_NAMES).length;

function reelEase(t: number): number {
  const a = VIEW_CONFIG.spin.accelFraction;
  const b = VIEW_CONFIG.spin.decelFraction;
  const area = 1 - a / 2 - b / 2;
  let d: number;
  if (t < a) {
    d = (t * t) / (2 * a);
  } else if (t <= 1 - b) {
    d = a / 2 + (t - a);
  } else {
    const td = t - (1 - b);
    d = a / 2 + (1 - b - a) + (td - (td * td) / (2 * b));
  }
  return d / area;
}

@ccclass('ReelView')
export class ReelView extends Component {
  private strip: Node | null = null;

  private stripCells: SymbolView[] = [];

  private cells: SymbolView[] = [];
  private pitch = 0;
  private startY = 0;

  private settle: (() => void) | null = null;

  private lastStripY = 0;
  private blurStretch = 1;
  private blurActive = false;
  private reducedMotion = false;

  private pendingFinal: number[] | null = null;

  private launching = false;

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;

    this.cells.forEach((c) => c.setIdle(!on && !this.spinning));
  }

  update(dt: number): void {
    if (!this.strip || dt <= 0) return;
    const y = this.strip.position.y;

    if (VIEW_CONFIG.spin.blur.enabled && this.blurActive && !this.launching) {
      const { triggerSpd, span, strengthYFrac, rampInDecay, rampOutDecay } = VIEW_CONFIG.spin.blur;
      const cellsPerFrame = Math.abs(y - this.lastStripY) / (this.pitch || 1) / (dt * 60);
      const target =
        1 + Math.max(0, Math.min(1, (cellsPerFrame - triggerSpd) / span)) * (strengthYFrac * 2.2);
      const decay = target > this.blurStretch ? rampInDecay : rampOutDecay;
      this.blurStretch += (target - this.blurStretch) * decay;
      this.strip.setScale(1 - (this.blurStretch - 1) * 0.4, this.blurStretch, 1);
    }
    this.lastStripY = y;
  }

  build(frames: SpriteFrame[]): void {
    const { cell, gap, spinBuffer } = VIEW_CONFIG.layout;
    const rows = GRID.rows;
    this.pitch = cell + gap;
    const windowH = rows * cell + (rows - 1) * gap;
    const len = rows + spinBuffer;
    this.startY = spinBuffer * this.pitch;

    const ut = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ut.setContentSize(cell, windowH);
    const mask = this.node.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;

    const strip = new Node('strip');
    strip.addComponent(UITransform).setContentSize(cell, windowH);
    this.node.addChild(strip);
    this.strip = strip;

    const reelOffset = this.node.position.x * 0.011;
    for (let k = 0; k < len; k++) {
      const cellNode = new Node(`cell_${k}`);
      cellNode.addComponent(UITransform).setContentSize(cell, cell);
      cellNode.setPosition(0, this.pitch - k * this.pitch, 0);
      strip.addChild(cellNode);
      const sv = cellNode.addComponent(SymbolView);
      sv.build(cell, frames, k * 0.618 + reelOffset);
      this.stripCells[k] = sv;
    }
    this.cells = [this.stripCells[0], this.stripCells[1], this.stripCells[2]];
  }

  show(column: number[]): void {
    this.cells.forEach((c, row) => {
      c.setSymbol(column[row]);
      c.setIdle(!this.reducedMotion);
    });
  }

  spinTo(final: number[], spinSeconds: number, speedMul = 1): Promise<void> {
    const strip = this.strip;
    if (!strip) return Promise.resolve();
    const rows = GRID.rows;
    const len = this.stripCells.length;

    this.cells.forEach((c) => c.setIdle(false));

    const launchTop = len - rows;
    const currentSymbols = [
      this.cells[0].currentId,
      this.cells[1].currentId,
      this.cells[2].currentId,
    ];
    for (let k = rows; k < launchTop; k++) {
      this.stripCells[k].setSymbol(Math.floor(Math.random() * SYMBOL_COUNT));
    }

    for (let r = 0; r < rows; r++) {
      this.stripCells[launchTop + r].setSymbol(currentSymbols[r]);
    }

    this.pendingFinal = final;
    for (let r = 0; r < rows; r++) {
      this.cells[r].setSymbol(final[r]);
    }

    return new Promise<void>((resolve) => {
      this.settle = () => {
        if (!this.settle) return;
        this.settle = null;
        Tween.stopAllByTarget(strip);

        const fin = this.pendingFinal;
        if (fin) this.cells.forEach((c, row) => c.setSymbol(fin[row]));
        this.pendingFinal = null;
        strip.setPosition(0, 0, 0);
        this.blurActive = false;
        this.launching = false;
        this.blurStretch = 1;
        this.lastStripY = 0;
        strip.setScale(1, 1, 1);

        if (!this.reducedMotion) {
          // Merge a staggered per-symbol landing into the reel stop: each row
          // dips + squashes + springs as it settles, cascading top→bottom. Params
          // come from VIEW_CONFIG.land keyed by the active speed (off/turbo/max).
          const L = VIEW_CONFIG.land;
          const T = VIEW_CONFIG.turbo;
          const key: 'off' | 'turbo' | 'max' =
            speedMul <= T.max + 1e-3 ? 'max' : speedMul <= T.turbo + 1e-3 ? 'turbo' : 'off';
          const cell = VIEW_CONFIG.layout.cell;
          const dip = L.landDip[key];
          const sq = L.landSq[key];
          const dur = L.symDurMs[key];
          const stag = L.symStagMs[key] / 1000;
          this.cells.forEach((c, row) => {
            if (stag > 0 && row > 0) {
              this.scheduleOnce(() => c.playLand(cell, dip, sq, dur), row * stag);
            } else {
              c.playLand(cell, dip, sq, dur);
            }
          });
          this.cells.forEach((c) => c.setIdle(true));
        }
        resolve();
      };
      strip.setPosition(0, this.startY, 0);
      this.lastStripY = this.startY;
      this.blurStretch = 1;
      this.blurActive = !this.reducedMotion;

      this.launching = true;

      const windDur =
        (speedMul === 1 && VIEW_CONFIG.spin.windupMs > 0
          ? VIEW_CONFIG.spin.windupMs
          : VIEW_CONFIG.spin.preSpinMaskMs) / 1000;
      this.scheduleOnce(() => {
        this.launching = false;
      }, windDur);
      const t = tween(strip);

      const { windupMs, windupAmpFrac, windupSquash } = VIEW_CONFIG.spin;
      if (speedMul === 1 && windupMs > 0) {
        const kick = VIEW_CONFIG.layout.cell * windupAmpFrac * 0.15;

        if (windupSquash < 1) {
          tween(strip)
            .to(windupMs / 2000, { scale: new Vec3(1.0, windupSquash, 1) }, { easing: 'sineIn' })
            .to(windupMs / 2000, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
            .start();
        }
        t.to(
          windupMs / 1000,
          { position: new Vec3(0, this.startY + kick, 0) },
          { easing: 'quadOut' },
        );
      }

      const b = VIEW_CONFIG.spin.bounce;
      const bounceEnabled = !this.reducedMotion && b.overtravelFrac > 0;
      if (bounceEnabled) {
        const overshoot = VIEW_CONFIG.layout.cell * b.overtravelFrac * b.elasticity;
        const bounceDur = (b.bounceMs / 1000) * b.weight;
        t.to(
          (spinSeconds * speedMul) / b.speed,
          { position: new Vec3(0, -overshoot, 0) },
          { easing: reelEase },
        )
          .to(bounceDur, { position: new Vec3(0, 0, 0) }, { easing: b.easing })
          .call(() => this.settle?.())
          .start();
      } else {
        t.to(spinSeconds * speedMul, { position: new Vec3(0, 0, 0) }, { easing: reelEase })
          .call(() => this.settle?.())
          .start();
      }
    });
  }

  quickStop(): void {
    this.settle?.();
  }

  get spinning(): boolean {
    return this.settle !== null;
  }

  highlight(
    rows: number[],
    delay = 0,
    rich = true,
    winMat: Material | null = null,
    lift: Node | null = null,
    centerOf?: (row: number) => Vec3,
  ): void {
    rows.forEach((row, i) =>
      this.cells[row]?.playWin(delay + i * 0.04, rich, winMat, lift, centerOf?.(row) ?? null),
    );

    this.cells.forEach((c, row) => {
      if (rows.indexOf(row) < 0) c.setDimmed(true);
    });
  }

  bounceSticky(rows: number[], opts?: { peak?: number; glowPeak?: number }): void {
    rows.forEach((row, i) => this.cells[row]?.playLock(i * 0.05, opts));
  }

  flashWilds(rows: number[]): void {
    rows.forEach((row, i) => this.cells[row]?.flashWildLand(i * 0.04));
  }

  recoil(amp = 1.04): void {
    const strip = this.strip;
    if (!strip || this.reducedMotion || amp <= 1) return;
    Tween.stopAllByTarget(strip);
    strip.setScale(1, 1, 1);
    tween(strip)
      .to(0.05, { scale: new Vec3(amp, amp, 1) }, { easing: 'quadOut' })
      .to(0.14, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .start();
  }

  clearHighlight(): void {
    this.cells.forEach((c) => c.clear());
  }

  shakeRow(row: number, amp: number, durMs: number): void {
    this.cells[row]?.playShake(amp, durMs);
  }
}
