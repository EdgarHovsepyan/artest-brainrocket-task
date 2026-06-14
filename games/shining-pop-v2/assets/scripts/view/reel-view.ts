// MVC — VIEW. One reel: a masked column with a scrolling strip + 3 visible cells.
// Built from code by SlotView. Owns its spin/stop animation (Cocos Tween) and
// win highlight. No game rules — it is told the final symbols to settle on.

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
  /** Result to drop into the window AT settle (not before — pre-painting the
   *  window was the "symbols change before spinning" flash). */
  private pendingFinal: number[] | null = null;
  /** True during the wind-up so the launch velocity spike doesn't pop the blur. */
  private launching = false;

  /** WCAG reduced-motion gate (driven by SlotView.setReducedFx). */
  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
    // Reduced-motion: freeze idle breathing immediately; else (re)start it on the
    // settled window cells.
    this.cells.forEach((c) => c.setIdle(!on && !this.spinning));
  }

  /** Per-frame velocity-stretch on the strip = vector motion blur (no shader).
   *  Fast scroll stretches the column vertically + thins it horizontally, which
   *  reads as the symbols smearing; springs back to 1 as the reel decelerates. */
  update(dt: number): void {
    if (!this.strip || dt <= 0) return;
    const y = this.strip.position.y;
    // 2026-06-11 — motion-blur strip-stretch DISABLED via spin.blur.enabled.
    // ANY vertical stretch on the symbols during a spin reads as "vertical
    // arrows / lines" (user-rejected). The reel reads fast from the scroll
    // alone. Guard keeps the strip at scale 1 throughout. The block below
    // only runs if a future design re-enables a (non-stretch) blur treatment.
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

    // Per-reel phase offset so the 5 columns never breathe in unison (the
    // golden-ratio step keeps it organic within a column too).
    const reelOffset = this.node.position.x * 0.011;
    for (let k = 0; k < len; k++) {
      // k=0 → top window row (+pitch), k=1 → mid, k=2 → bottom; k>=3 below the fold.
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

  /** Paint the visible window immediately (no animation) + start idle breathing. */
  show(column: number[]): void {
    this.cells.forEach((c, row) => {
      c.setSymbol(column[row]);
      c.setIdle(!this.reducedMotion);
    });
  }

  /**
   * Spin, then settle on `final` (3 ids, top → bottom) over `spinSeconds × speedMul`.
   * Resolves once the reel has stopped (or is quick-stopped). Driven by Cocos Tween.
   */
  spinTo(final: number[], spinSeconds: number, speedMul = 1): Promise<void> {
    const strip = this.strip;
    if (!strip) return Promise.resolve();
    const rows = GRID.rows;
    const len = this.stripCells.length;

    // Idle breathing OFF for the spin (the strip scrolls + motion-blurs instead).
    this.cells.forEach((c) => c.setIdle(false));
    // Hardened mask (Task 6.1 hardening): paint the 3 cells that will be inside
    // the window AT THE INSTANT OF LAUNCH with the SAME symbols currently shown,
    // so the strip-jump from y=0 to y=startY produces a window with *identical*
    // visible content. Without this the user sees an instant glitch as cells
    // 0..2 (idle) jump out and cells len-3..len-1 (random fillers) jump in.
    //
    // Strip layout: cell_k.localY = pitch − k·pitch. At launch strip.y = startY
    // = spinBuffer × pitch. The cells whose worldY land in the window-band
    // [−pitch, +pitch] are k = spinBuffer..spinBuffer+2 = len-3..len-1.
    const launchTop = len - rows; // top window row at launch
    const currentSymbols = [
      this.cells[0].currentId,
      this.cells[1].currentId,
      this.cells[2].currentId,
    ];
    for (let k = rows; k < launchTop; k++) {
      // Mid-strip buffer: still random — these are what the user sees during
      // the high-speed cruise + decel.
      this.stripCells[k].setSymbol(Math.floor(Math.random() * SYMBOL_COUNT));
    }
    // Cells immediately at the launch position: clone the current window
    // content so the jump-from-y=0-to-y=startY is visually a no-op.
    for (let r = 0; r < rows; r++) {
      this.stripCells[launchTop + r].setSymbol(currentSymbols[r]);
    }
    // Cells 0..2 (the ones that will arrive at the window AT SETTLE) get the
    // FINAL result painted NOW — while they're far above the visible band. By
    // the time the strip decelerates and they enter the window, they already
    // show the result. settle() no longer has to swap them visibly.
    this.pendingFinal = final;
    for (let r = 0; r < rows; r++) {
      this.cells[r].setSymbol(final[r]);
    }

    return new Promise<void>((resolve) => {
      this.settle = () => {
        if (!this.settle) return;
        this.settle = null;
        Tween.stopAllByTarget(strip);
        // Cells 0..2 were painted with `final` at launch (Task 6.1 hardening);
        // they already show the result by the time the strip arrives at 0.
        // This call is now idempotent — kept as a defensive backstop if some
        // future caller bypasses the launch-time paint (e.g. a direct settle).
        const fin = this.pendingFinal;
        if (fin) this.cells.forEach((c, row) => c.setSymbol(fin[row]));
        this.pendingFinal = null;
        strip.setPosition(0, 0, 0);
        this.blurActive = false;
        this.launching = false;
        this.blurStretch = 1;
        this.lastStripY = 0; // fresh velocity baseline for the next spin
        strip.setScale(1, 1, 1); // clear any residual motion-blur stretch
        // 2026-06-11 polish — the per-cell playLand was making each symbol bounce
        // independently AFTER the strip's elasticOut already bounced. Reads as
        // a fragmented post-stop wobble instead of a unified reel impact. The
        // strip's elasticOut tween (Task 6.2) IS the AAA-canonical land bounce
        // — keep it as the ONE source of impact feel. Per-cell squash dropped.
        // Resume idle breathing once the reel has settled.
        if (!this.reducedMotion) this.cells.forEach((c) => c.setIdle(true));
        resolve();
      };
      strip.setPosition(0, this.startY, 0);
      this.lastStripY = this.startY;
      this.blurStretch = 1;
      this.blurActive = !this.reducedMotion;
      // Gate the blur through the wind-up so the up→down launch reversal can't
      // pop the column's size; clear once the reel is cruising.
      this.launching = true;
      // 6.1: pre-spin mask formalize — promote the implicit 50ms lock from a
      // literal to VIEW_CONFIG.spin.preSpinMaskMs so QA can tune the snap-guard.
      const windDur =
        (speedMul === 1 && VIEW_CONFIG.spin.windupMs > 0
          ? VIEW_CONFIG.spin.windupMs
          : VIEW_CONFIG.spin.preSpinMaskMs) / 1000;
      this.scheduleOnce(() => {
        this.launching = false;
      }, windDur);
      const t = tween(strip);
      // Anticipatory wind-up "slingshot": base spins pull UP + Y-squash the
      // strip briefly, reading as a coiled spring loading energy before the
      // launch. Composes with the launch teleport (already invisible thanks
      // to the 6.1 hardening that clones the visible window to the launch
      // buffer cells).
      const { windupMs, windupAmpFrac, windupSquash } = VIEW_CONFIG.spin;
      if (speedMul === 1 && windupMs > 0) {
        const kick = VIEW_CONFIG.layout.cell * windupAmpFrac * 0.15;
        // Optional Y-squash — only if windupSquash < 1 (disabled by default so
        // NO vertical scaling touches the symbols). The position kick below is
        // the wind-up cue on its own.
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
      // 6.2: split-stop elastic over-travel bounce. The trapezoidal reelEase
      // brings the strip to REST at y = -overshoot (a small negative dip); the
      // second segment then springs back to 0 with elasticOut. settle() (drops
      // the result + playLand squash) fires on the SECOND segment's complete so
      // the squash coincides with REST, not with the dip nadir. Reduced-motion
      // skips the bounce (the dead-stop at 0 reads cleanly without overshoot).
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

  /** Slam the reel to its result now (re-click quick-stop). No-op if already settled. */
  quickStop(): void {
    this.settle?.();
  }

  get spinning(): boolean {
    return this.settle !== null;
  }

  /** Pulse the given window rows (cells in a winning line), offset by `delay`
   *  seconds so the controller can stagger reels into an L->R wave blink. `rich`
   *  enables the in-cell sheen/sparkle (focused wins only — off for dense wins). */
  highlight(rows: number[], delay = 0, rich = true, winMat: Material | null = null): void {
    rows.forEach((row, i) => this.cells[row]?.playWin(delay + i * 0.04, rich, winMat));
    // WIN FOCUS — every cell that isn't part of the win dims back so the winners
    // pop instantly (clearHighlight → cell.clear() restores full opacity).
    this.cells.forEach((c, row) => {
      if (rows.indexOf(row) < 0) c.setDimmed(true);
    });
  }

  /** Bounce the given window rows — sticky wilds/crowns celebrating each free
   *  spin (they persist in the grid, so this reads as "locked + alive", not a
   *  respin). Held-glow lock confirmation, distinct from the win pulse. */
  bounceSticky(rows: number[], opts?: { peak?: number; glowPeak?: number }): void {
    rows.forEach((row, i) => this.cells[row]?.playLock(i * 0.05, opts));
  }

  /** Sharp WILD-landing strike on the given window rows (reel just settled). */
  flashWilds(rows: number[]): void {
    rows.forEach((row, i) => this.cells[row]?.flashWildLand(i * 0.04));
  }

  /** Heavy-landing RECOIL — a brief UNIFORM scale "thunk" on the WHOLE strip when a
   *  heavy symbol lands, beat-locked to the reel-stop transient. Uniform (both axes
   *  together) so it reads as weight/impact, never the rejected per-cell squash or
   *  skew. reducedMotion skips it (the clean dead-stop reads fine without it). */
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

  /** Task 6.3 — short Svarka jitter on a single window row when the win-line
   *  head crosses the cell. amp/durMs from VIEW_CONFIG.win.svarka. */
  shakeRow(row: number, amp: number, durMs: number): void {
    this.cells[row]?.playShake(amp, durMs);
  }
}
