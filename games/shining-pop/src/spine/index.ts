/**
 * Spine cinematic-symbol runtime for SHINING POP (studio build).
 *
 * - {@link SymbolRig}      — controller for ONE Master-Skeleton symbol (skin swap, idle/dump/win,
 *                            skeleton-local centering, frame-exact Spine event → audio hook).
 * - {@link SymbolRigPool}  — owns the single shared load/unload; hands out rigs.
 *
 * Nothing here is imported by the running game yet — it is "ready and waiting" infra. It
 * activates the moment a real rig (master.skel + master.atlas + master.png) is dropped into
 * /public/spine/ and a reel cell calls `pool.acquire(...)`. See ../../public/spine/README.md.
 *
 * Spec: docs/blueprints/10_SHINING_POP_SPINE_SYMBOL_BLUEPRINT.md
 */

export { SymbolRig } from './SymbolRig.js';
export type {
  SymbolState,
  SymbolName,
  RigEventCallback,
  SymbolRigOptions,
} from './SymbolRig.js';

export { SymbolRigPool, DEFAULT_MASTER_CONFIG } from './SymbolRigPool.js';
export type { MasterSkeletonConfig } from './SymbolRigPool.js';
