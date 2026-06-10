/* BettingBarWeb — Cocos Creator 3.8 component. The DESKTOP/LANDSCAPE control
   strip, master parity with the Pixi web bar: one bottom band with labeled
   money readouts on the left (BALANCE · LAST WIN · TOTAL BET), the bet stepper
   centre, the SPIN control right-of-centre and the icon cluster (turbo ·
   autoplay · sound · menu) on the right. Same event names + live-state API as
   BettingBarMobile so the controller drives either bar through one surface.

   Events: spin · bet:inc · bet:dec · autoplay · turbo · sound · menu */
import {
  _decorator,
  Color,
  Component,
  EventTarget,
  Graphics,
  Label,
  Node,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
} from 'cc';
const { ccclass } = _decorator;

const W = 1240;
const H = 110;

const C = {
  panel: '#191140',
  edge: '#b86fda',
  active: '#db5fd8',
  accent: '#ff007f',
  value: '#f5f7fa',
  label: '#c9ced8',
  shadow: '#05020c',
};
function col(hex: string, a?: number): Color {
  const c = new Color();
  Color.fromHEX(c, hex);
  if (a != null) c.a = Math.round(a * 255);
  return c;
}

interface Plate {
  value: Label;
}

@ccclass('BettingBarWeb')
export class BettingBarWeb extends Component {
  private events = new EventTarget();
  private balance!: Plate;
  private lastWin!: Plate;
  private totalBet!: Plate;
  private betValue!: Label;
  private currencyLabel!: Label;
  private spinNode!: Node;
  private spinGlyph!: Graphics;
  private spinning = false;
  private autoCount!: Label;
  private autoGlyphOp!: UIOpacity;
  private turboOp!: UIOpacity;
  private turboPip!: Node;
  private soundOp!: UIOpacity;
  private minusOp!: UIOpacity;
  private plusOp!: UIOpacity;
  private spinOp!: UIOpacity;

  onLoad(): void {
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(W, H);
    ui.setAnchorPoint(0.5, 0.5);

    const g = new Node('decor');
    this.node.addChild(g);
    g.addComponent(UITransform).setContentSize(W, H);
    const dg = g.addComponent(Graphics);
    dg.fillColor = col(C.shadow, 0.65);
    dg.roundRect(-W / 2, -H / 2 - 5, W, H, 18);
    dg.fill();
    dg.fillColor = col(C.panel, 0.96);
    dg.roundRect(-W / 2, -H / 2, W, H, 18);
    dg.fill();
    dg.lineWidth = 2;
    dg.strokeColor = col(C.edge, 0.8);
    dg.roundRect(-W / 2, -H / 2, W, H, 18);
    dg.stroke();
    dg.lineWidth = 3;
    dg.strokeColor = col(C.accent);
    dg.moveTo(-W / 2 + 18, H / 2 - 1);
    dg.lineTo(W / 2 - 18, H / 2 - 1);
    dg.stroke();

    this.balance = this.plate(-470, 'BALANCE');
    this.lastWin = this.plate(-285, 'LAST WIN');
    this.totalBet = this.plate(-100, 'TOTAL BET');
    this.currencyLabel = this.caption(-470, -34, 'USD');

    this.minusOp = this.glyphButton(60, '−', () => this.events.emit('bet:dec'));
    this.betValue = this.money(130, 0, 22);
    this.caption(130, -34, 'BET');
    this.plusOp = this.glyphButton(200, '+', () => this.events.emit('bet:inc'));

    this.buildSpin(330);
    this.turboOp = this.iconButton(430, 'T', () => this.events.emit('turbo'));
    const pip = new Node('turboPip');
    this.node.addChild(pip);
    pip.addComponent(UITransform).setContentSize(10, 10);
    pip.setPosition(446, 18, 0);
    const pg = pip.addComponent(Graphics);
    pg.fillColor = col(C.accent);
    pg.moveTo(0, 5);
    pg.lineTo(5, 0);
    pg.lineTo(0, -5);
    pg.lineTo(-5, 0);
    pg.close();
    pg.fill();
    pip.active = false;
    this.turboPip = pip;

    const autoOp = this.iconButton(495, 'A', () => this.events.emit('autoplay'));
    this.autoGlyphOp = autoOp;
    const cnt = new Node('autoCount');
    this.node.addChild(cnt);
    cnt.addComponent(UITransform).setContentSize(60, 24);
    cnt.setPosition(495, 26, 0);
    const cl = cnt.addComponent(Label);
    cl.fontSize = 13;
    cl.lineHeight = 15;
    cl.isBold = true;
    cl.color = col(C.accent);
    cl.string = '';
    this.autoCount = cl;
    this.autoCount.node.active = false;

    this.soundOp = this.iconButton(560, '♪', () => this.events.emit('sound'));
    this.iconButton(615, '≡', () => this.events.emit('menu'));
  }

  private plate(x: number, label: string): Plate {
    const n = new Node('plate_' + label);
    this.node.addChild(n);
    n.addComponent(UITransform).setContentSize(170, 64);
    n.setPosition(x, 0, 0);
    const g = n.addComponent(Graphics);
    g.fillColor = col(C.shadow, 0.55);
    g.roundRect(-85, -32, 170, 64, 12);
    g.fill();
    g.lineWidth = 1.5;
    g.strokeColor = col(C.edge, 0.45);
    g.roundRect(-85, -32, 170, 64, 12);
    g.stroke();
    this.caption(x, 16, label);
    return { value: this.money(x, -8, 20) };
  }

  private caption(x: number, y: number, text: string): Label {
    const n = new Node('cap');
    this.node.addChild(n);
    n.addComponent(UITransform).setContentSize(170, 18);
    n.setPosition(x, y, 0);
    const l = n.addComponent(Label);
    l.fontSize = 11;
    l.lineHeight = 13;
    l.isBold = true;
    l.color = col(C.label, 0.8);
    l.string = text;
    return l;
  }

  private money(x: number, y: number, size: number): Label {
    const n = new Node('money');
    this.node.addChild(n);
    n.addComponent(UITransform).setContentSize(180, size + 6);
    n.setPosition(x, y, 0);
    const l = n.addComponent(Label);
    l.fontSize = size;
    l.lineHeight = size + 4;
    l.isBold = true;
    l.color = col(C.value);
    l.string = '0.00';
    return l;
  }

  private glyphButton(x: number, glyph: string, cb: () => void): UIOpacity {
    const n = new Node('btn_' + glyph);
    this.node.addChild(n);
    n.addComponent(UITransform).setContentSize(54, 54);
    n.setPosition(x, 0, 0);
    const g = n.addComponent(Graphics);
    g.fillColor = col(C.panel);
    g.roundRect(-25, -25, 50, 50, 12);
    g.fill();
    g.lineWidth = 2;
    g.strokeColor = col(C.edge);
    g.roundRect(-25, -25, 50, 50, 12);
    g.stroke();
    const lblNode = new Node('g');
    n.addChild(lblNode);
    lblNode.addComponent(UITransform).setContentSize(50, 30);
    const l = lblNode.addComponent(Label);
    l.fontSize = 26;
    l.lineHeight = 28;
    l.isBold = true;
    l.color = col(C.value);
    l.string = glyph;
    n.on(Node.EventType.TOUCH_END, () => {
      tween(n)
        .to(0.05, { scale: new Vec3(0.92, 0.92, 1) })
        .to(0.1, { scale: new Vec3(1, 1, 1) })
        .start();
      cb();
    });
    return n.addComponent(UIOpacity);
  }

  private iconButton(x: number, glyph: string, cb: () => void): UIOpacity {
    const op = this.glyphButton(x, glyph, cb);
    op.node.setScale(0.85, 0.85, 1);
    return op;
  }

  private buildSpin(x: number): void {
    const n = new Node('spin');
    this.node.addChild(n);
    n.addComponent(UITransform).setContentSize(92, 92);
    n.setPosition(x, 0, 0);
    const g = n.addComponent(Graphics);
    const rad = 44;
    g.fillColor = col(C.panel);
    for (let k = 0; k < 8; k++) {
      const a = (Math.PI / 4) * k - Math.PI / 8;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (k === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.close();
    g.fill();
    g.lineWidth = 4;
    g.strokeColor = col(C.accent);
    for (let k = 0; k < 8; k++) {
      const a = (Math.PI / 4) * k - Math.PI / 8;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (k === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.close();
    g.stroke();
    const glyphNode = new Node('spinGlyph');
    n.addChild(glyphNode);
    glyphNode.addComponent(UITransform).setContentSize(40, 40);
    this.spinGlyph = glyphNode.addComponent(Graphics);
    this.drawSpinGlyph(false);
    n.on(Node.EventType.TOUCH_START, () => n.setScale(0.94, 0.94, 1));
    const release = () => n.setScale(1, 1, 1);
    n.on(Node.EventType.TOUCH_CANCEL, release);
    n.on(Node.EventType.TOUCH_END, () => {
      release();
      this.events.emit('spin');
    });
    this.spinNode = n;
    this.spinOp = n.addComponent(UIOpacity);
  }

  /** Play triangle when idle, stop square while spinning. */
  private drawSpinGlyph(spinning: boolean): void {
    const g = this.spinGlyph;
    g.clear();
    g.fillColor = col(C.value);
    if (spinning) {
      g.roundRect(-12, -12, 24, 24, 4);
      g.fill();
    } else {
      g.moveTo(-9, 15);
      g.lineTo(15, 0);
      g.lineTo(-9, -15);
      g.close();
      g.fill();
    }
  }

  // ---- shared bar API (mirror of BettingBarMobile) ---------------------------
  on(ev: string, cb: (...args: unknown[]) => void): this {
    this.events.on(ev, cb);
    return this;
  }

  fit(viewW: number, viewH: number): void {
    const s = Math.min(1, (viewW - 24) / W, (viewH * 0.2) / H);
    this.node.setScale(s, s, 1);
    this.node.setPosition(new Vec3(0, -viewH / 2 + (H / 2 + 10) * s, 0));
  }

  private fmt(n: number): string {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  setBalance(n: number): void {
    this.balance.value.string = this.fmt(n);
  }
  setCurrency(c: string): void {
    this.currencyLabel.string = c;
  }
  setLastWin(n: number): void {
    this.lastWin.value.string = this.fmt(n);
  }
  setBet(n: number): void {
    this.betValue.string = this.fmt(n);
    this.totalBet.value.string = this.fmt(n);
  }
  setDemo(): void {
    /* web bar shows no demo ribbon */
  }
  setSoundOn(on: boolean): void {
    this.soundOp.opacity = on ? 255 : 120;
  }
  setVolume(): void {
    /* volume slider lives in Settings on the web layout */
  }
  setSpinning(on: boolean): void {
    this.spinning = on;
    this.drawSpinGlyph(on);
  }
  setAutoplay(count: number | null): void {
    const active = count != null && count !== 0;
    this.autoCount.string = count === Infinity ? '∞' : String(count ?? '');
    this.autoCount.node.active = active;
    this.autoGlyphOp.opacity = active ? 255 : 200;
  }
  setTurbo(mode: number): void {
    this.turboOp.opacity = mode > 0 ? 255 : 130;
    this.turboPip.active = mode === 2;
  }
  setAffordable(on: boolean): void {
    this.spinOp.opacity = on ? 255 : 128;
  }
  setSteppers(minusOn: boolean, plusOn: boolean): void {
    this.minusOp.opacity = minusOn ? 255 : 102;
    this.plusOp.opacity = plusOn ? 255 : 102;
  }
}
