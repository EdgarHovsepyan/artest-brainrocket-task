

import { Container, Assets } from 'pixi.js';
import { Spine, SetupPoseBoundsProvider } from '@esotericsoftware/spine-pixi-v8';
import type { TrackEntry, Event as SpineEvent } from '@esotericsoftware/spine-pixi-v8';



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
  
  skeletonAlias: string;
  
  atlasAlias: string;
  
  symbol?: SymbolName;
  
  defaultMix?: number;
  
  onEvent?: RigEventCallback;
}

const ANIM = { idle: 'idle', land: 'land', win: 'win', bigwin: 'bigwin' } as const;
const TRACK_IDLE = 0;
const TRACK_ONESHOT = 1;

export class SymbolRig {
  
  public readonly view: Container;

  
  private spine: Spine;

  private readonly skeletonAlias: string;
  private readonly atlasAlias: string;

  private onEvent?: RigEventCallback;

  private currentSymbol: SymbolName;
  private currentState: SymbolState = 'idle';
  private destroyed = false;

  
  private localBounds: { x: number; y: number; width: number; height: number } | null = null;

  
  private stateListener: {
    complete?: (entry: TrackEntry) => void;
    event?: (entry: TrackEntry, event: SpineEvent) => void;
  } | null = null;

  

  constructor(opts: SymbolRigOptions) {
    this.skeletonAlias = opts.skeletonAlias;
    this.atlasAlias = opts.atlasAlias;
    this.onEvent = opts.onEvent;
    this.currentSymbol = opts.symbol ?? 'crown';


    

    
    
    this.spine = new Spine({
      skeleton: this.skeletonAlias,
      atlas: this.atlasAlias,
      boundsProvider: new SetupPoseBoundsProvider(),
    });

    
    this.view = new Container();

    
    this.spine.visible = false;

    
    this.spine.state.data.defaultMix = opts.defaultMix ?? 0.12;

    
    this.applySkin(this.currentSymbol);

    
    this.spine.state.setAnimation(TRACK_IDLE, ANIM.idle, true);


    this.spine.update(0);

    
    this.captureLocalBounds();
    this.recenter();

    
    this.spine.visible = true;

    this.view.addChild(this.spine);
    this.attachListeners();
  }

  

  
  private captureLocalBounds(): void {

    
    
    const b = this.spine.skeleton.getBoundsRect();
    this.localBounds = { x: b.x, y: b.y, width: b.width, height: b.height };
  }

  
  private recenter(): void {
    const b = this.localBounds;
    if (!b) return;
    this.spine.x = -b.x - b.width / 2;
    this.spine.y = -b.y - b.height / 2;
  }

  

  private applySkin(symbol: SymbolName): void {

    
    
    const _data: any = this.spine.skeleton.data;
    const _skin = (_data.findSkin && _data.findSkin(symbol)) ? symbol
                : ((_data.findSkin && _data.findSkin('default')) ? 'default' : null);
    if (!_skin) return; 
    this.spine.skeleton.setSkin(_skin);
    this.spine.skeleton.setupPoseSlots();
  }

  setSymbol(symbol: SymbolName): void {
    if (this.destroyed || symbol === this.currentSymbol) return;
    this.currentSymbol = symbol;
    this.applySkin(symbol);
    
    this.spine.update(0);
    this.captureLocalBounds(); 
    this.recenter();
  }

  

  play(stateIn: SymbolState | 'dump' | 'drop'): void {
    if (this.destroyed) return;
    
    const state: SymbolState = (stateIn === 'dump' || stateIn === 'drop') ? 'land' : stateIn;
    this.currentState = state;

    switch (state) {
      case 'idle':
        
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
    
    this.spine.state.setEmptyAnimation(TRACK_ONESHOT, mix);
    
    this.spine.state.addAnimation(TRACK_ONESHOT, animName, false, 0);
    
    this.spine.state.addEmptyAnimation(TRACK_ONESHOT, mix, 0);
  }

  

  private attachListeners(): void {
    this.stateListener = {
      complete: (entry: TrackEntry) => {
        if (this.destroyed) return;
        
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
          
          time: (event as any).time ?? entry.trackTime ?? 0,
        });
      },
    };

    this.spine.state.addListener(this.stateListener);
  }

  

  getSymbol(): SymbolName { return this.currentSymbol; }
  getState(): SymbolState { return this.currentState; }
  isDestroyed(): boolean { return this.destroyed; }
  setOnEvent(cb: RigEventCallback | undefined): void { this.onEvent = cb; }

  

  
  async destroy(unloadAssets = false): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;

    
    if (this.stateListener) {
      this.spine.state.removeListener(this.stateListener);
      this.stateListener = null;
    }
    this.spine.state.clearListeners();
    this.spine.state.clearTracks();


    if (this.spine.parent) this.spine.parent.removeChild(this.spine);
    this.spine.destroy();
    this.view.destroy({ children: true });

    
    if (unloadAssets) {
      await Promise.all([
        Assets.unload(this.atlasAlias),
        Assets.unload(this.skeletonAlias),
      ]);
    }
  }
}
