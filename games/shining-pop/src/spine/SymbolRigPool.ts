/**
 * SymbolRigPool — owns the SINGLE shared load + unload of the Master Skeleton, and hands
 * out per-symbol {@link SymbolRig} instances that share that SkeletonData/atlas.
 *
 * Why a pool: SymbolRig.destroy() defaults to `unloadAssets=false` because the atlas +
 * SkeletonData are shared across every rig. SOMEONE has to own the one-time unload of those
 * shared GPU pages once the last rig is gone — that owner is this pool. Per-rig you call
 * pool.release(rig); when you're done with the whole feature you call pool.unload().
 *
 * Usage:
 *   const pool = new SymbolRigPool();              // defaults → /public/spine/master.*
 *   await pool.load();                              // registers + loads ONCE (idempotent)
 *   const rig = pool.acquire({ symbol: 'crown', onEvent });
 *   app.stage.addChild(rig.view);
 *   rig.view.position.set(640, 360);
 *   rig.play('win');
 *   ...
 *   pool.release(rig);                              // per-rig teardown, shared assets stay
 *   await pool.unload();                            // last call: destroys stragglers + frees GPU
 *
 * STATUS: ready and waiting. pool.load() throws a clear, actionable error until the real rig
 * files exist under /public/spine/ (see ../../public/spine/README.md). Nothing in the running
 * game imports this yet — it activates the day a .skel/.atlas/.png is dropped in and wired.
 */

import { Assets } from 'pixi.js';
import { SymbolRig, type SymbolRigOptions } from './SymbolRig.js';

export interface MasterSkeletonConfig {
  /** Assets alias for the skeleton data (.skel binary preferred; .json works). */
  skeletonAlias: string;
  /** Assets alias for the .atlas text file. */
  atlasAlias: string;
  /** URL for the skeleton file (served from /public). */
  skeletonSrc: string;
  /** URL for the .atlas file (served from /public). */
  atlasSrc: string;
  /**
   * Optional atlas PAGE PNGs to pre-register BEFORE the atlas loads. The spine-pixi atlas
   * loader can resolve pages relative to the .atlas on its own, but pre-registering the page
   * with an alias that matches the page line inside the .atlas avoids the
   * "Texture from 'undefined' did not finish loading" warning — and Stake requires a SILENT
   * console. Each `alias` MUST equal the page filename written in the .atlas (e.g. 'master.png').
   */
  pages?: { alias: string; src: string }[];
}

/** Default config — drop the three files into /public/spine/ and it just works. */
export const DEFAULT_MASTER_CONFIG: MasterSkeletonConfig = {
  skeletonAlias: 'shiningpop.crownwildSkeleton',
  atlasAlias: 'shiningpop.crownwildAtlas',
  skeletonSrc: '/spine/crownwild/crownwild.json',
  atlasSrc: '/spine/crownwild/crownwild.atlas',
  // Page aliases MUST equal the page filenames inside crownwild.atlas (lines 1 and 8).
  pages: [
    { alias: 'crown.png', src: '/spine/crownwild/crown.png' },
    { alias: 'crown_fx.png', src: '/spine/crownwild/crown_fx.png' },
  ],
};

/**
 * Module-level guard so a given alias is registered with Assets at most once — even across
 * HMR reloads or multiple pools. Re-adding an alias makes Pixi log, which breaks Stake's
 * console-silence rule.
 */
const REGISTERED = new Set<string>();

/**
 * BUILD-02 single-file build inlines the .atlas/.json/.png as base64 DATA URIs, which
 * carry no file extension. Pixi v8's spine-pixi-v8 atlas + skeleton loaders gate on
 * `path.extname(url.split('?')[0])`, so a data URI fails their test() and they never
 * run — the asset returns as raw text/JSON and `new Spine({ atlas })` then throws
 * `findRegion is not a function`. Hash fragments are ignored by the data-URI parser
 * but are part of the string `path.extname` sees, so appending `#name.ext` is a
 * zero-cost hint that flips on the correct loader. No-op for real URLs.
 */
function hintExt(src: string, ext: string): string {
  if (src.startsWith('data:') && !src.includes('#')) return src + '#' + ext;
  return src;
}

function addOnce(alias: string, src: string): void {
  if (REGISTERED.has(alias)) return;
  REGISTERED.add(alias);
  Assets.add({ alias, src });
}

export class SymbolRigPool {
  private readonly cfg: MasterSkeletonConfig;
  private readonly live = new Set<SymbolRig>();
  private loadPromise: Promise<void> | null = null;
  private loaded = false;

  constructor(config: Partial<MasterSkeletonConfig> = {}) {
    this.cfg = { ...DEFAULT_MASTER_CONFIG, ...config };
  }

  get isLoaded(): boolean { return this.loaded; }
  get liveCount(): number { return this.live.size; }

  /**
   * Register + load the shared skeleton/atlas/pages ONCE. Safe to call repeatedly: the same
   * promise is returned. Throws a clear error if the files aren't present yet so the failure
   * is obvious during integration (not a silent blank symbol).
   */
  load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      // ── Two-phase load for the single-file build (data URIs have no path)
      // ────────────────────────────────────────────────────────────────────
      // Phase 1: PAGES. spine-pixi-v8's atlas parse() builds page URLs by joining
      // path.dirname(atlasSrc) + pageName — which yields nonsense for a data-URI
      // atlas. We work around this by pre-loading each page PNG and then passing
      // the resolved TextureSources as `data.images` on the atlas, so parse()
      // takes the metadata.images branch and SKIPS its internal URL construction.
      const pages = this.cfg.pages ?? [];
      for (const page of pages) addOnce(page.alias, hintExt(page.src, page.alias));
      try {
        if (pages.length) await Assets.load(pages.map((p) => p.alias));
      } catch (err) {
        this.loadPromise = null;
        throw new Error(`[SymbolRigPool] page load failed: ${(err as Error)?.message ?? err}`);
      }

      // Phase 2: gather TextureSources keyed by the .atlas page filename (matches alias).
      const images: Record<string, unknown> = {};
      for (const page of pages) {
        // biome-ignore lint/suspicious/noExplicitAny: spine-pixi metadata is loosely typed
        const tex: any = Assets.get(page.alias);
        if (tex) images[page.alias] = tex.source ?? tex;
      }

      // Phase 3: register atlas (with images metadata so parse() skips URL construction)
      // and skeleton — both with the data-URI extension hint so the parsers' test() fires.
      // FORCE the spine atlas loader explicitly — the data URI's extension hint
      // (#crownwild.atlas) isn't always enough; Pixi's text/JSON loaders can win the
      // load-stage race and return the raw string before the atlas parser's testParse
      // ever runs. `loadParser` is the documented escape hatch (AtlasLoader.js:66).
      if (!REGISTERED.has(this.cfg.atlasAlias)) {
        REGISTERED.add(this.cfg.atlasAlias);
        Assets.add({
          alias: this.cfg.atlasAlias,
          src: hintExt(this.cfg.atlasSrc, 'crownwild.atlas'),
          parser: 'spineTextureAtlasLoader',
          data: { images },
        // biome-ignore lint/suspicious/noExplicitAny: Pixi UnresolvedAsset type doesn't expose loadParser
        } as any);
      }
      // Skeleton — JSON path. The skeleton loader's testParse falls back to
      // checking `bones` on the loaded object, which JUST WORKS for a JSON data URI
      // because Pixi's JSON loader has decoded our base64 by the time testParse runs.
      addOnce(this.cfg.skeletonAlias, hintExt(this.cfg.skeletonSrc, 'crownwild.json'));

      try {
        await Assets.load([this.cfg.atlasAlias, this.cfg.skeletonAlias]);
      } catch (err) {
        this.loadPromise = null;
        throw new Error(
          `[SymbolRigPool] Failed to load the Master Skeleton from ${this.cfg.skeletonSrc} / ` +
            `${this.cfg.atlasSrc}. Drop the rig export (crownwild.json + crownwild.atlas + crown.png + crown_fx.png) ` +
            `into /public/spine/ — see public/spine/README.md. Original: ${(err as Error)?.message ?? err}`,
        );
      }

      this.loaded = true;
    })();

    return this.loadPromise;
  }

  /**
   * Build a new rig sharing the loaded SkeletonData + atlas. Each owns its own AnimationState.
   * Call load() first (acquire throws if the shared data isn't loaded yet).
   */
  acquire(opts: Omit<SymbolRigOptions, 'skeletonAlias' | 'atlasAlias'> = {}): SymbolRig {
    if (!this.loaded) {
      throw new Error('[SymbolRigPool] acquire() called before load() resolved. await pool.load() first.');
    }
    const rig = new SymbolRig({
      ...opts,
      skeletonAlias: this.cfg.skeletonAlias,
      atlasAlias: this.cfg.atlasAlias,
    });
    this.live.add(rig);
    return rig;
  }

  /**
   * Tear down a single rig (shared atlas/skeleton stay resident for siblings). Idempotent.
   */
  async release(rig: SymbolRig): Promise<void> {
    if (!this.live.has(rig)) {
      if (!rig.isDestroyed()) await rig.destroy(false);
      return;
    }
    this.live.delete(rig);
    await rig.destroy(false);
  }

  /**
   * Full feature teardown: destroy any stragglers, then unload the shared atlas + skeleton
   * GPU pages exactly ONCE. After this the pool is empty and load() must be called again
   * before acquire().
   */
  async unload(): Promise<void> {
    const stragglers = [...this.live];
    this.live.clear();
    await Promise.all(stragglers.map((r) => r.destroy(false)));

    if (this.loaded) {
      const aliases = [
        this.cfg.atlasAlias,
        this.cfg.skeletonAlias,
        ...(this.cfg.pages ?? []).map((p) => p.alias),
      ];
      await Promise.all(aliases.map((a) => Assets.unload(a)));
      for (const a of aliases) REGISTERED.delete(a);
    }

    this.loaded = false;
    this.loadPromise = null;
  }
}
