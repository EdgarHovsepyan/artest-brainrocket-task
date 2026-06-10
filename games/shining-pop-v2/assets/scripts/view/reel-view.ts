// MVC — VIEW. One reel: a masked column with a scrolling strip + 3 visible cells.
// Built from code by SlotView. Owns its spin/stop animation (Cocos Tween) and
// win highlight. No game rules — it is told the final symbols to settle on.

import {
  _decorator,
  Component,
  Mask,
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

/** Number of distinct symbol ids — derived from the data, never hardcoded. */
const SYMBOL_COUNT = Object.keys(SYMBOL_NAMES).length;

/**
 * Trapezoidal velocity profile: smooth wind-up → constant cruise → soft decel to
 * a DEAD stop. Velocity is 0 at both ends and continuous throughout (no speed
 * jump mid-spin); the landing "thunk" is carried by the symbol squash, not a
 * position bounce. (One intentional curve instead of chained eases.)
 */
function reelEase(t: number): number {
  const a = VIEW_CONFIG.spin.accelFraction;
  const b = VIEW_CONFIG.spin.decelFraction;
  const area = 1 - a / 2 - b / 2; // normalised distance under the profile
  let d: number;
  if (t < a) {
    d = (t * t) / (2 * a); // ramp-up integral
  } else if (t <= 1 - b) {
    d = a / 2 + (t - a); // accel area + constant cruise
  } else {
    const td = t - (1 - b);
    d = a / 2 + (1 - b - a) + (td - (td * td) / (2 * b)); // + ramp-down integral
  }
  return d / area;
}

@ccclass('ReelView')
export class ReelView extends Component {
  private strip: Node | null = null;
  /** Every cell on the strip, top → bottom (k=0..len-1). */
  private stripCells: SymbolView[] = [];
  /** The 3 visible window cells, row 0 = top. */
  private cells: SymbolView[] = [];
  private pitch = 0;
  private startY = 0;
  /** One-shot settle, fired by the tween OR by quickStop — never twice. */
  private settle: (() => void) | null = null;
  /** Velocity-coupled motion blur: last strip Y + current stretch (1 = none). */
  private lastStripY = 0;
  private blurStretch = 1;
  private blurActive = false;
  private reducedMotion = false;

  /** WCAG reduced-motion gate (driven by SlotView.setReducedFx). */
  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
  }

  /** Per-frame velocity-stretch on the strip = vector motion blur (no shader).
   *  Fast scroll stretches the column vertically + thins it horizontally, which
   *  reads as the symbols smearing; springs back to 1 as the reel decelerates. */
  update(dt: number): void {
    if (!this.strip || dt <= 0) return;
    const y = this.strip.position.y;
    if (this.blurActive) {
      const { triggerSpd, span, strengthYFrac, rampInDecay, rampOutDecay } = VIEW_CONFIG.spin.blur;
      const cellsPerFrame = Math.abs(y - this.lastStripY) / (this.pitch || 1) / (dt * 60);
      // Subtle smear only — capped at ~1.18x so the reel reads as fast, never as
      // a distorted/rescaled container (owner note: don't change reel scaling).
      const target =
        1 + Math.max(0, Math.min(1, (cellsPerFrame - triggerSpd) / span)) * (strengthYFrac * 2.2);
      const decay = target > this.blurStretch ? rampInDecay : rampOutDecay;
      this.blurStretch += (target - this.blurStretch) * decay;
      this.strip.setScale(1 - (this.blurStretch - 1) * 0.4, this.blurStretch, 1);
    }
    this.lastStripY = y;
  }

  /** Build the masked column + strip cells. `frames` is shared symbol art. */
  build(frames: SpriteFrame[]): void {
    const { cell, gap, spinBuffer } = VIEW_CONFIG.layout;
    const rows = GRID.rows;
    this.pitch = cell + gap;
    const windowH = rows * cell + (rows - 1) * gap;
    const len = rows + spinBuffer;
    this.startY = spinBuffer * this.pitch;

    // This node clips its children to the 3-row window.
    const ut = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ut.setContentSize(cell, windowH);
    const mask = this.node.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;

    const strip = new Node('strip');
    strip.addComponent(UITransform).setContentSize(cell, windowH);
    this.node.addChild(strip);
    this.strip = strip;

    for (let k = 0; k < len; k++) {
      // k=0 → top window row (+pitch), k=1 → mid, k=2 → bottom; k>=3 below the fold.
      const cellNode = new Node(`cell_${k}`);
      cellNode.addComponent(UITransform).setContentSize(cell, cell);
      cellNode.setPosition(0, this.pitch - k * this.pitch, 0);
      strip.addChild(cellNode);
      const sv = cellNode.addComponent(SymbolView);
      sv.build(cell, frames);
      this.stripCells[k] = sv;
    }
    this.cells = [this.stripCells[0], this.stripCells[1], this.stripCells[2]];
  }

  /** Paint the visible window immediately (no animation). */
  show(column: number[]): void {
    this.cells.forEach((c, row) => c.setSymbol(column[row]));
  }

  /**
   * Spin, then settle on `final` (3 ids, top → bottom) over `spinSeconds × speedMul`.
   * Resolves once the reel has stopped (or is quick-stopped). Driven by Cocos Tween.
   */
  spinTo(final: number[], spinSeconds: number, speedMul = 1): Promise<void> {
    const strip = this.strip;
    if (!strip) return Promise.resolve();
    const rows = GRID.rows;

    // Seed the strip: window gets the result, buffer cells get random fillers.
    for (let k = 0; k < this.stripCells.length; k++) {
      const id = k < rows ? final[k] : Math.floor(Math.random() * SYMBOL_COUNT);
      this.stripCells[k].setSymbol(id);
    }

    return new Promise<void>((resolve) => {
      this.settle = () => {
        if (!this.settle) return;
        this.settle = null;
        Tween.stopAllByTarget(strip);
        strip.setPosition(0, 0, 0);
        this.blurActive = false;
        this.blurStretch = 1;
        strip.setScale(1, 1, 1); // clear any residual motion-blur stretch
        this.cells.forEach((c) => c.playLand(VIEW_CONFIG.spin.landSquash));
        resolve();
      };
      strip.setPosition(0, this.startY, 0);
      this.lastStripY = this.startY;
      this.blurStretch = 1;
      this.blurActive = !this.reducedMotion;
      const t = tween(strip);
      // Anticipatory wind-up "slingshot": base spins only pull UP a touch, then
      // launch down — reads as loading the reel (a Signature game-feel touch).
      const { windupMs, windupAmpFrac } = VIEW_CONFIG.spin;
      if (speedMul === 1 && windupMs > 0) {
        const kick = VIEW_CONFIG.layout.cell * windupAmpFrac * 0.15;
        t.to(
          windupMs / 1000,
          { position: new Vec3(0, this.startY + kick, 0) },
          { easing: 'quadOut' },
        );
      }
      t.to(spinSeconds * speedMul, { position: new Vec3(0, 0, 0) }, { easing: reelEase })
        .call(() => this.settle?.())
        .start();
    });
  }

  /** Slam the reel to its result now (re-click quick-stop). No-op if already settled. */
  quickStop(): void {
    this.settle?.();
  }

  get spinning(): boolean {
    return this.settle !== null;
  }

  /** Pulse the given window rows (cells in a winning line), offset by `delay`
   *  seconds so the controller can stagger reels into an L->R wave blink. */
  highlight(rows: number[], delay = 0): void {
    rows.forEach((row, i) => this.cells[row]?.playWin(delay + i * 0.04));
  }

  /** Bounce the given window rows — sticky wilds/crowns celebrating each free
   *  spin (they persist in the grid, so this reads as "locked + alive", not a
   *  respin). Held-glow lock confirmation, distinct from the win pulse. */
  bounceSticky(rows: number[]): void {
    rows.forEach((row, i) => this.cells[row]?.playLock(i * 0.05));
  }

  /** Sharp WILD-landing strike on the given window rows (reel just settled). */
  flashWilds(rows: number[]): void {
    rows.forEach((row, i) => this.cells[row]?.flashWildLand(i * 0.04));
  }

  clearHighlight(): void {
    this.cells.forEach((c) => c.clear());
  }
}
