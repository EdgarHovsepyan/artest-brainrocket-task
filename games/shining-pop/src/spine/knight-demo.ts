
import { Application, Assets, Container } from 'pixi.js';
import { Spine } from '@esotericsoftware/spine-pixi-v8';

(async () => {
  const app = new Application();
  await app.init({ background: 0x0a0712, antialias: true, resizeTo: window });
  const canvas = app.canvas as HTMLCanvasElement;
  Object.assign(canvas.style, { position: 'fixed', inset: '0', zIndex: '99999' });
  document.body.appendChild(canvas);

  const label = (text: string, err = false) => {
    const d = document.createElement('div');
    d.textContent = text;
    Object.assign(d.style, {
      position: 'fixed', left: '50%', top: '14px', transform: 'translateX(-50%)',
      zIndex: '100000', font: '13px ui-monospace, monospace',
      color: err ? '#ff8a8a' : '#ffce47', background: 'rgba(0,0,0,0.55)',
      padding: '6px 12px', borderRadius: '9px', pointerEvents: 'none', whiteSpace: 'nowrap',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(d);
  };

  try {
    
    Assets.add({ alias: 'knightAtlas', src: '/spine/knight.atlas' });
    Assets.add({ alias: 'knightSkel',  src: '/spine/knight.json' });
    await Assets.load(['knightAtlas', 'knightSkel']);

    
    const spine = new Spine({ skeleton: 'knightSkel', atlas: 'knightAtlas' });
    spine.state.data.defaultMix = 0.2;
    spine.state.setAnimation(0, 'idle', true);   

    
    const holder = new Container();
    holder.addChild(spine);
    app.stage.addChild(holder);
    const layout = () => {

      const FIG = 260;
      const fit = (Math.min(app.screen.width, app.screen.height) * 0.55) / FIG;
      holder.scale.set(fit);
      holder.position.set(app.screen.width / 2, app.screen.height * 0.5 + (FIG * fit) / 2);
    };
    layout();
    window.addEventListener('resize', layout);

    label('pixi-spine 4.3.5 · knight scaffold · idle @ 2s loop · PLACEHOLDER box art');
  } catch (e) {
    label('SPINE DEMO ERROR — ' + ((e as Error)?.message ?? String(e)), true);
    if (new URLSearchParams(location.search).get('debug') === 'true') console.error(e);
  }
})();
