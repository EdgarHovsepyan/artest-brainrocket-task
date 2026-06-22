
import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { SymbolRigPool } from './spine/SymbolRigPool.js';
import { makeSkin } from './ui/betting-bar-skin.js';
import { glassInto } from './ui/ui-kit.js';
import { BettingBarMobile } from './ui/betting-bar-mobile.js';
import { BettingBarWeb } from './ui/betting-bar-web.js';

(globalThis as Record<string, unknown>).PIXI = PIXI;

(globalThis as Record<string, unknown>).SymbolRigPool = SymbolRigPool;

(globalThis as Record<string, unknown>).gsap = gsap;
gsap.ticker.lagSmoothing(500, 33);

(globalThis as Record<string, unknown>).__makeSkin = makeSkin;

(globalThis as Record<string, unknown>).__glassInto = glassInto;

(globalThis as Record<string, unknown>).BettingBarMobile = BettingBarMobile;

(globalThis as Record<string, unknown>).BettingBarWeb = BettingBarWeb;




const _spine = import.meta.env.DEV ? new URLSearchParams(location.search).get('spine') : null;
if (_spine === 'crown') {
  void import('./spine/crown-demo.js');
} else if (_spine === 'true') {
  void import('./spine/knight-demo.js');
} else {
  void import('./game/shining-pop.game.js');
}
