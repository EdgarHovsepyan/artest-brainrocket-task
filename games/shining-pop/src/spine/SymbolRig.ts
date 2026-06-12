/**
 * SymbolRig — production runtime controller for a single Master-Skeleton symbol.
 *
 * One Spine "Master Skeleton" drives every reel symbol via skin swaps. We load the
 * SkeletonData + atlas ONCE (Assets cache is reference-counted) and spin up cheap
 * per-symbol Spine instances that share that data but own their own AnimationState.
 *
 * Runtime: @esotericsoftware/spine-pixi-v8  (PixiJS v8).  Verified against 4.3.5.
 *
 * Track contract (Pascal convention — do not queue past track 2 without a comment):
 *   track 0 → idle / loop
 *   track 1 → one-shot transitions (dump, win) — mutually exclusive, guarded by setEmptyAnimation
 *   track 2 → reserved for additive overlays (glow/pulse) the .skel fires internally
 *
 * STATUS: ready and waiting. This compiles against the installed runtime, but nothing
 * animates until a real rig (master.skel / master.atlas / master.png) is dropped into
 * /public/spine/ and loaded via SymbolRigPool (see ./SymbolRigPool.ts and ../../public/spine/README.md).
 *
 * Source spec: docs/blueprints/10_SHINING_POP_SPINE_SYMBOL_BLUEPRINT.md §4 (the reviewed,
 * corrected controller — skeleton-local bounds centering, shared-asset-safe teardown).
 */

import { Container, Assets } from 'pixi.js';
import { Spine, SetupPoseBoundsProvider } from '@esotericsoftware/spine-pixi-v8';
import type { TrackEntry, Event as SpineEvent } from '@esotericsoftware/spine-pixi-v8';

// ── Public types ────────────────────────────────────────────────────────────

export type SymbolState = 'idle' | 'land' | 'win' | 'bigwin';
export type SymbolName  = 'crown' | 'diamond' | 'wild' | 'seven' | 'bell' | 'cherry' | string;

export type RigEventCallback = (
  eventName: string,
  payload: {
    state: SymbolState;
    intValue: number;
    floatValue: number;
    stringValue: string;
    time: number;
  },
) => void;

export interface SymbolRigOptions {
  /** Assets alias for the skeleton (.skel/.json) — must already be loaded into the Assets cache. */
  skeletonAlias: string;
  /** Assets alias for the .atlas — must already be loaded into the Assets cache. */
  atlasAlias: string;
  /** Initial skin/symbol name (must match a skin authored in the Master Skeleton). */
  symbol?: SymbolName;
  /** Crossfade time (seconds) between clips on the same track. Default 0.12. */
  defaultMix?: number;
  /** Frame-exact Spine user-event hook (audio, camera shake, …). */
  onEvent?: RigEventCallback;
}

const ANIM = { idle: 'idle', land: 'land', win: 'win', bigwin: 'bigwin' } as const;
const TRACK_IDLE = 0;
const TRACK_ONESHOT = 1;

export class SymbolRig {
  /** The parent we move/scale. We translate THIS to centre the rig, never the Spine. */
  public readonly view: Container;

  /** The Spine display object. We never set .scale on it directly (retina shimmer). */
  private spine: Spine;

  private readonly skeletonAlias: string;
  private readonly atlasAlias: string;

  private onEvent?: RigEventCallback;

  private currentSymbol: SymbolName;
  private currentState: SymbolState = 'idle';
  private destroyed = false;

  /**
   * Skeleton-LOCAL setup-pose bounds (origin at the root bone, in skeleton units,
   * transform-independent). Captured once; centering offsets from THIS constant, so
   * recenter() is idempotent and never feeds a transform-inclusive value back into
   * the transform.
   */
  private localBounds: { x: number; y: number; width: number; height: number } | null = null;

  /** Retained so destroy() can detach it — leaked listeners pin the whole rig in memory. */
  private stateListener: {
    complete?: (entry: TrackEntry) => void;
    event?: (entry: TrackEntry, event: SpineEvent) => void;
  } | null = null;

  // ── Construction ──────────────────────────────────────────────────────────

  constructor(opts: SymbolRigOptions) {
    this.skeletonAlias = opts.skeletonAlias;
    this.atlasAlias = opts.atlasAlias;
    this.onEvent = opts.onEvent;
    this.currentSymbol = opts.symbol ?? 'crown';

    // new Spine() pulls SkeletonData + atlas straight from the Assets cache and REUSES
    // the same SkeletonData object for every instance built from the same aliases —
    // "load once, instance many". Each call still mints a fresh AnimationState.
    //
    // A SetupPoseBoundsProvider gives the rig a STABLE, skeleton-local bounds reference
    // (origin at the root bone) for centering — independent of the Pixi display transform
    // or which idle frame is showing.
    this.spine = new Spine({
      skeleton: this.skeletonAlias,
      atlas: this.atlasAlias,
      boundsProvider: new SetupPoseBoundsProvider(),
    });

    // Parent container is the ONLY thing we ever translate or scale.
    this.view = new Container();

    // HARD RULE: hide until the first update(0) has produced real geometry.
    this.spine.visible = false;

    // Crossfade between clips on the same track so state changes don't pop.
    this.spine.state.data.defaultMix = opts.defaultMix ?? 0.12;

    // Apply the initial skin BEFORE we pose/centre so the bounds measure the real art.
    this.applySkin(this.currentSymbol);

    // Idle on track 0, looping, set before the first apply so the setup frame is idle.
    this.spine.state.setAnimation(TRACK_IDLE, ANIM.idle, true);

    // Drive one frame to bake the pose and populate world transforms.
    // (autoUpdate defaults to true; update(0) advances by zero seconds then applies.)
    this.spine.update(0);

    // Capture skeleton-LOCAL setup-pose bounds ONCE, then centre off that constant.
    this.captureLocalBounds();
    this.recenter();

    // First real geometry exists → safe to show.
    this.spine.visible = true;

    this.view.addChild(this.spine);
    this.attachListeners();
  }

  // ── Centering ─────────────────────────────────────────────────────────────

  /**
   * Read SKELETON-LOCAL bounds (root-bone origin, skeleton units) — NOT the Pixi
   * Container.getBounds() (transform-inclusive world/screen space, which would make
   * recenter() non-idempotent and DPR-scaled). The runtime Skeleton exposes its AABB
   * via getBounds(offset, size); we store it as a constant.
   */
  private captureLocalBounds(): void {
    // Skeleton#getBoundsRect() returns the current-pose AABB in skeleton-LOCAL space
    // (root-bone origin) as {x,y,width,height} — exactly what we centre against: fully typed,
    // no Vector2 out-params, no cast. (spine-core 4.3.x; older runtimes used
    // getBounds(offset, size, temp).) Valid because we call it right after update(0).
    const b = this.spine.skeleton.getBoundsRect();
    this.localBounds = { x: b.x, y: b.y, width: b.width, height: b.height };
  }

  /**
   * Offset the Spine inside its parent so the parent origin == visual centre.
   * Idempotent: always derived from the cached skeleton-local bounds, never re-read
   * from the (already-offset) display transform.
   */
  private recenter(): void {
    const b = this.localBounds;
    if (!b) return;
    this.spine.x = -b.x - b.width / 2;
    this.spine.y = -b.y - b.height / 2;
  }

  // ── Skin / symbol swapping ────────────────────────────────────────────────

  private applySkin(symbol: SymbolName): void {
    // setSkin(name) swaps every slot's attachment set; setupPoseSlots() forces slots to
    // re-resolve against the new skin (without it slots keep the OLD attachment → chimera).
    // (spine-core 4.3.x public API — these were setSkinByName()/setSlotsToSetupPose() in
    // older runtimes; setSkinByName is now a private impl detail.)
    const _data: any = this.spine.skeleton.data;
    const _skin = (_data.findSkin && _data.findSkin(symbol)) ? symbol
                : ((_data.findSkin && _data.findSkin('default')) ? 'default' : null);
    if (!_skin) return; // single-skin rig: keep authored default; setSkin(missing) errors = Stake console
    this.spine.skeleton.setSkin(_skin);
    this.spine.skeleton.setupPoseSlots();
  }

  setSymbol(symbol: SymbolName): void {
    if (this.destroyed || symbol === this.currentSymbol) return;
    this.currentSymbol = symbol;
    this.applySkin(symbol);
    // Re-bake the pose against the freshly-skinned slots, then refresh local bounds + centre.
    this.spine.update(0);
    this.captureLocalBounds(); // a different silhouette → new skeleton-local AABB.
    this.recenter();
  }

  // ── State machine ─────────────────────────────────────────────────────────

  play(stateIn: SymbolState | 'dump' | 'drop'): void {
    if (this.destroyed) return;
    // Back-compat: the old controller used 'dump' for the drop clip (the rig authors 'land').
    const state: SymbolState = (stateIn === 'dump' || stateIn === 'drop') ? 'land' : stateIn;
    this.currentState = state;

    switch (state) {
      case 'idle':
        // Clear any in-flight one-shot so we crossfade cleanly back to the loop.
        this.spine.state.setEmptyAnimation(TRACK_ONESHOT, this.spine.state.data.defaultMix);
        this.spine.state.setAnimation(TRACK_IDLE, ANIM.idle, true);
        break;
      case 'land':
        this.playOneShot(ANIM.land);
        break;
      case 'bigwin':
        this.playOneShot(ANIM.bigwin);
        break;
      case 'win':
        this.playOneShot(ANIM.win);
        break;
    }
  }

  private playOneShot(animName: string): void {
    const mix = this.spine.state.data.defaultMix;
    // Guard: hard-reset track 1 to empty (with mix) before queueing the conflicting clip.
    this.spine.state.setEmptyAnimation(TRACK_ONESHOT, mix);
    // The actual one-shot (loop=false) queued right after the empty.
    this.spine.state.addAnimation(TRACK_ONESHOT, animName, false, 0);
    // Drain track 1 back to empty after the clip, so nothing lingers holding attachments.
    this.spine.state.addEmptyAnimation(TRACK_ONESHOT, mix, 0);
  }

  // ── Listeners (frame-exact events + auto-return) ──────────────────────────

  private attachListeners(): void {
    this.stateListener = {
      complete: (entry: TrackEntry) => {
        if (this.destroyed) return;
        // Only react to the real one-shot clips on track 1 (ignore empty drains + looping idle).
        if (entry.trackIndex !== TRACK_ONESHOT) return;
        const finished = entry.animation?.name;
        if (finished === ANIM.win || finished === ANIM.bigwin || finished === ANIM.land) {
          this.currentState = 'idle';
          this.spine.state.setAnimation(TRACK_IDLE, ANIM.idle, true);
        }
      },

      event: (entry: TrackEntry, event: SpineEvent) => {
        if (this.destroyed || !this.onEvent) return;
        this.onEvent(event.data.name, {
          state: this.currentState,
          intValue: event.intValue,
          floatValue: event.floatValue,
          stringValue: event.stringValue ?? '',
          // event.time is not guaranteed across runtime versions; guard it.
          time: (event as any).time ?? entry.trackTime ?? 0,
        });
      },
    };

    this.spine.state.addListener(this.stateListener);
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  getSymbol(): SymbolName { return this.currentSymbol; }
  getState(): SymbolState { return this.currentState; }
  isDestroyed(): boolean { return this.destroyed; }
  setOnEvent(cb: RigEventCallback | undefined): void { this.onEvent = cb; }

  // ── Teardown ──────────────────────────────────────────────────────────────

  /**
   * Full teardown.
   *
   * `unloadAssets` defaults to FALSE. The atlas + SkeletonData are SHARED across every rig
   * built from the same aliases; unloading them while siblings are alive rips their textures
   * out ("Texture … did not finish loading" / blank symbols). In the intended pooled
   * "instance many" design, the POOL owns the single unload — call destroy() per-rig with the
   * default, then Assets.unload(atlas)/Assets.unload(skeleton) ONCE when the last rig is gone.
   * Pass true only if THIS rig owns the last reference. (SymbolRigPool does this for you.)
   *
   * Order: listeners off (clearListeners BEFORE clearTracks so synchronous end/dispose
   * callbacks from clearTracks don't re-enter a half-detached listener) → remove from parent
   * + destroy Spine → (optionally) unload shared assets.
   */
  async destroy(unloadAssets = false): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;

    // 1. Listeners off FIRST. clearListeners() before clearTracks().
    if (this.stateListener) {
      this.spine.state.removeListener(this.stateListener);
      this.stateListener = null;
    }
    this.spine.state.clearListeners();
    this.spine.state.clearTracks();

    // 2. Detach + destroy the display objects. removeChild first so view.destroy()
    //    no longer owns the Spine (avoids double-destroy).
    if (this.spine.parent) this.spine.parent.removeChild(this.spine);
    this.spine.destroy();
    this.view.destroy({ children: true });

    // 3. Free GPU atlas pages + skeleton bytes — ONLY if this rig owns the last reference.
    if (unloadAssets) {
      await Promise.all([
        Assets.unload(this.atlasAlias),
        Assets.unload(this.skeletonAlias),
      ]);
    }
  }
}
