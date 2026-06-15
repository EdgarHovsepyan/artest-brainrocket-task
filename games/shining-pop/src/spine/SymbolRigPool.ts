

import { Assets } from 'pixi.js';
import { SymbolRig, type SymbolRigOptions } from './SymbolRig.js';

export interface MasterSkeletonConfig {
  
  skeletonAlias: string;
  
  atlasAlias: string;
  
  skeletonSrc: string;
  
  atlasSrc: string;
  
  pages?: { alias: string; src: string }[];
}


export const DEFAULT_MASTER_CONFIG: MasterSkeletonConfig = {
  skeletonAlias: 'shiningpop.crownwildSkeleton',
  atlasAlias: 'shiningpop.crownwildAtlas',
  skeletonSrc: '/spine/crownwild/crownwild.json',
  atlasSrc: '/spine/crownwild/crownwild.atlas',
  
  pages: [
    { alias: 'crown.png', src: '/spine/crownwild/crown.png' },
    { alias: 'crown_fx.png', src: '/spine/crownwild/crown_fx.png' },
  ],
};


const REGISTERED = new Set<string>();


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

  
  load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {

      

      
      
      const pages = this.cfg.pages ?? [];
      for (const page of pages) addOnce(page.alias, hintExt(page.src, page.alias));
      try {
        if (pages.length) await Assets.load(pages.map((p) => p.alias));
      } catch (err) {
        this.loadPromise = null;
        throw new Error(`[SymbolRigPool] page load failed: ${(err as Error)?.message ?? err}`);
      }

      
      const images: Record<string, unknown> = {};
      for (const page of pages) {
        
        const tex: any = Assets.get(page.alias);
        if (tex) images[page.alias] = tex.source ?? tex;
      }


      

      
      if (!REGISTERED.has(this.cfg.atlasAlias)) {
        REGISTERED.add(this.cfg.atlasAlias);
        Assets.add({
          alias: this.cfg.atlasAlias,
          src: hintExt(this.cfg.atlasSrc, 'crownwild.atlas'),
          parser: 'spineTextureAtlasLoader',
          data: { images },
        
        } as any);
      }

      
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

  
  async release(rig: SymbolRig): Promise<void> {
    if (!this.live.has(rig)) {
      if (!rig.isDestroyed()) await rig.destroy(false);
      return;
    }
    this.live.delete(rig);
    await rig.destroy(false);
  }

  
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
