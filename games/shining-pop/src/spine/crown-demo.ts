
import { Application, Assets, Container } from 'pixi.js';
import { Spine } from '@esotericsoftware/spine-pixi-v8';

(async () => {
  const app = new Application();
  await app.init({ background: 0x0a0712, antialias: true, resizeTo: window });
  const canvas = app.canvas as HTMLCanvasElement;
  Object.assign(canvas.style, { position: 'fixed', inset: '0', zIndex: '99990' } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(canvas);
  
  for (const el of Array.from(document.querySelectorAll('body > *'))) {
    if (el !== canvas && !(el as HTMLElement).dataset?.cw) (el as HTMLElement).style.display = 'none';
  }

  const note = (text: string, err = false) => {
    const d = document.createElement('div');
    d.textContent = text;
    Object.assign(d.style, {
      position: 'fixed', left: '50%', top: '14px', transform: 'translateX(-50%)', zIndex: '100000',
      font: '13px ui-monospace, monospace', color: err ? '#ff8a8a' : '#ffce47',
      background: 'rgba(0,0,0,0.55)', padding: '6px 12px', borderRadius: '9px', whiteSpace: 'nowrap',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(d);
  };

  try {
    Assets.add({ alias: 'cwAtlas', src: '/spine/crownwild/crownwild.atlas' });
    Assets.add({ alias: 'cwSkel',  src: '/spine/crownwild/crownwild.json' });
    await Assets.load(['cwAtlas', 'cwSkel']);

    const spine = new Spine({ skeleton: 'cwSkel', atlas: 'cwAtlas' });
    spine.state.data.defaultMix = 0.18;          
    spine.state.setAnimation(0, 'idle', true);   

    const holder = new Container();
    holder.addChild(spine);
    app.stage.addChild(holder);
    const layout = () => {
      const s = Math.min(app.screen.width, app.screen.height) / 620;
      holder.scale.set(s * 1.2);
      holder.position.set(app.screen.width / 2, app.screen.height * 0.52);
    };
    layout();
    window.addEventListener('resize', layout);

    
    const play = (name: string) => {
      spine.state.setAnimation(1, name, false);
      spine.state.addEmptyAnimation(1, 0.18, 0);
    };

    
    const bar = document.createElement('div');
    Object.assign(bar.style, {
      position: 'fixed', left: '50%', bottom: '18px', transform: 'translateX(-50%)', zIndex: '100000',
      display: 'flex', gap: '8px',
    } as Partial<CSSStyleDeclaration>);
    for (const a of ['idle', 'land', 'win', 'bigwin']) {
      const b = document.createElement('button');
      b.textContent = a;
      Object.assign(b.style, {
        font: '13px ui-monospace, monospace', color: '#fff3cf', background: '#1a1208',
        border: '1px solid #ffce47', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer',
      } as Partial<CSSStyleDeclaration>);
      b.onclick = () => (a === 'idle' ? spine.state.setAnimation(0, 'idle', true) : play(a));
      bar.appendChild(b);
    }
    document.body.appendChild(bar);

    
    let i = 0; const seq = ['land', 'win', 'bigwin'];
    setInterval(() => { play(seq[i % seq.length]); i++; }, 2200);
    setTimeout(() => play('bigwin'), 700);

    note('pixi-spine 4.3.5 · Crown Wild rig · idle/land/win/bigwin · (whole-symbol + generated FX)');
  } catch (e) {
    note('CROWN RIG ERROR — ' + ((e as Error)?.message ?? String(e)), true);
    if (new URLSearchParams(location.search).get('debug') === 'true') console.error(e);
  }
})();
