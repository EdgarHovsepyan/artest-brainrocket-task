// DEV-ONLY isolated harness for the betting bars. Mounts JUST the bar (web or
// mobile) on a bare Pixi app so the art can be screenshotted/iterated without the
// heavy full game (which is awkward to render headless). Loaded by bar-preview.html.
//   /bar-preview.html?mode=web     → landscape BettingBarWeb
//   /bar-preview.html?mode=mobile  → portrait  BettingBarMobile
import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { BettingBarWeb } from './betting-bar-web.js';
import { BettingBarMobile } from './betting-bar-mobile.js';

(globalThis as unknown as { gsap: typeof gsap }).gsap = gsap;

const mode = new URLSearchParams(location.search).get('mode') || 'web';

const app = new PIXI.Application();
await app.init({
  background: mode === 'mobile' ? 0x140a2c : 0x0c0826,
  antialias: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  autoDensity: true,
  resizeTo: window,
});
document.body.appendChild(app.canvas as HTMLCanvasElement);

function populate(bar: Record<string, (...a: unknown[]) => void>) {
  bar.setBalance?.(1009.1);
  bar.setCurrency?.('$');
  bar.setLastWin?.(10.1);
  bar.setBet?.(1);
  const fmt = (v: number) => '$' + v.toFixed(2);
  bar.setBetLevels?.([0.1, 0.2, 0.5, 1, 2, 5, 10, 20], 3, fmt);
  bar.setTurbo?.(0);
  bar.setAutoplay?.(null);
  bar.setSoundOn?.(true);
}

const bar = (mode === 'mobile'
  ? new BettingBarMobile({})
  : new BettingBarWeb({})) as unknown as Record<string, (...a: unknown[]) => void> & PIXI.Container;
app.stage.addChild(bar as unknown as PIXI.Container);
populate(bar as unknown as Record<string, (...a: unknown[]) => void>);

function relayout() {
  const W = window.innerWidth, H = window.innerHeight;
  if (mode === 'mobile') (bar as unknown as { fit: (w: number, h: number) => void }).fit(W, H);
  else (bar as unknown as { fitBottom: (w: number, h: number) => void }).fitBottom(W, H);
}
relayout();
window.addEventListener('resize', relayout);
(globalThis as unknown as { __bar: unknown }).__bar = bar;
