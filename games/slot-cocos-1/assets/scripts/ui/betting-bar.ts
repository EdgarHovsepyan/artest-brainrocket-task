/* BettingBarMobile — Cocos Creator 3.8 component (betting part only, 540×684).
   Shared control surface for every Cocos game; buy-bonus stays game state.
   cc.Graphics has no gradients, so each gradient is approximated by its mid stop
   (swap to baked gradient-texture Sprites for production polish). Same geometry +
   API as the Pixi/SVG deliverables. Inter font: assign in the editor for an exact
   match; falls back to the system font otherwise.
   Events: spin · bet:inc · bet:dec · autoplay · turbo · sound · menu */
import {
  _decorator,
  Component,
  Node,
  Graphics,
  Label,
  Color,
  UITransform,
  Vec3,
  EventTarget,
} from 'cc';
const { ccclass } = _decorator;

const W = 540;
const H = 684;

const C = {
  stage: '#0c0906',
  panel: '#1e1914',
  banner: '#2a2317',
  active: '#e9bf5a',
  ringMid: '#e2ba5e',
  spinMid: '#16120d',
  edge: '#b88e40',
  gold: '#d6ab46',
  value: '#f6f1e6',
  currency: '#9a8d6f',
  icon: '#f1e9d7',
  divider: '#caa24a',
};
function col(hex: string, a?: number): Color {
  const c = new Color();
  Color.fromHEX(c, hex);
  if (a != null) c.a = Math.round(a * 255);
  return c;
}

@ccclass('BettingBarMobile')
export class BettingBarMobile extends Component {
  private events = new EventTarget();
  private g!: Graphics;
  private labels: Record<string, Label> = {};

  onLoad(): void {
    const ui = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
    ui.setContentSize(W, H);
    ui.setAnchorPoint(0, 1);
    const gNode = new Node('gfx');
    this.node.addChild(gNode);
    const gui = gNode.addComponent(UITransform);
    gui.setAnchorPoint(0, 1);
    gui.setContentSize(W, H);
    this.g = gNode.addComponent(Graphics);
    this.draw();
    this.makeLabels();
    this.makeHitAreas();
  }

  private Y(y: number): number {
    return -y;
  }

  private rr(x: number, y: number, w: number, h: number, r: number): void {
    const g = this.g;
    const Y = this.Y.bind(this);
    g.moveTo(x + r, Y(y));
    g.lineTo(x + w - r, Y(y));
    g.arc(x + w - r, Y(y + r), r, Math.PI / 2, 0, true);
    g.lineTo(x + w, Y(y + h - r));
    g.arc(x + w - r, Y(y + h - r), r, 0, -Math.PI / 2, true);
    g.lineTo(x + r, Y(y + h));
    g.arc(x + r, Y(y + h - r), r, -Math.PI / 2, Math.PI, true);
    g.lineTo(x, Y(y + r));
    g.arc(x + r, Y(y + r), r, Math.PI, Math.PI / 2, true);
    g.close();
  }
  private panel(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string,
    edgeW: number,
  ): void {
    const g = this.g;
    this.rr(x, y, w, h, r);
    g.fillColor = col(fill);
    g.fill();
    if (edgeW) {
      this.rr(x, y, w, h, r);
      g.lineWidth = edgeW;
      g.strokeColor = col(C.edge);
      g.stroke();
    }
  }
  private circle(cx: number, cy: number, r: number, fill: string, edgeW: number): void {
    const g = this.g;
    const Y = this.Y.bind(this);
    g.circle(cx, Y(cy), r);
    g.fillColor = col(fill);
    g.fill();
    if (edgeW) {
      g.circle(cx, Y(cy), r);
      g.lineWidth = edgeW;
      g.strokeColor = col(C.edge);
      g.stroke();
    }
  }

  private draw(): void {
    const g = this.g;
    const Y = this.Y.bind(this);
    this.rr(0, 0, W, H, 0);
    g.fillColor = col(C.stage);
    g.fill();
    this.rr(0, 300, W, 384, 0);
    g.fillColor = col('#000000', 0.12);
    g.fill();

    this.panel(60, 210, 200, 46, 23, C.banner, 1.8);
    this.panel(280, 210, 200, 46, 23, C.banner, 1.8);
    this.panel(210, 272, 120, 24, 12, C.panel, 1.1);

    this.circle(270, 392, 70, C.ringMid, 0);
    g.circle(270, Y(392), 69);
    g.lineWidth = 4;
    g.strokeColor = col('#fff1ca', 0.6);
    g.stroke();
    this.circle(270, 392, 55, C.spinMid, 0);
    g.circle(270, Y(392), 55);
    g.lineWidth = 2.2;
    g.strokeColor = col('#ffeec2', 0.4);
    g.stroke();
    g.arc(270, Y(392), 28, Math.PI * 0.27, Math.PI * 1.73, false);
    g.lineWidth = 7.5;
    g.strokeColor = col(C.icon);
    g.stroke();
    g.moveTo(270, Y(362));
    g.lineTo(262, Y(371));
    g.lineTo(258, Y(361));
    g.close();
    g.fillColor = col(C.icon);
    g.fill();

    this.circle(104, 506, 30, C.panel, 1.8);
    g.moveTo(116, Y(506));
    g.lineTo(98, Y(496));
    g.lineTo(98, Y(516));
    g.close();
    g.fillColor = col(C.active);
    g.fill();

    this.panel(170, 479, 200, 54, 27, C.panel, 1.8);
    [237, 303].forEach((x) => {
      g.moveTo(x, Y(486));
      g.lineTo(x, Y(526));
    });
    g.lineWidth = 1.3;
    g.strokeColor = col(C.divider, 0.28);
    g.stroke();
    g.moveTo(189, Y(506));
    g.lineTo(217, Y(506));
    g.lineWidth = 3;
    g.strokeColor = col(C.icon);
    g.stroke();
    g.moveTo(337, Y(492));
    g.lineTo(337, Y(520));
    g.moveTo(323, Y(506));
    g.lineTo(351, Y(506));
    g.lineWidth = 3;
    g.strokeColor = col(C.icon);
    g.stroke();

    this.circle(436, 506, 30, C.panel, 1.8);
    g.moveTo(440, Y(494));
    g.lineTo(427, Y(509));
    g.lineTo(435, Y(509));
    g.lineTo(431, Y(520));
    g.lineTo(444, Y(504));
    g.lineTo(436, Y(504));
    g.close();
    g.fillColor = col(C.active);
    g.fill();

    this.panel(14, 560, 512, 44, 22, C.panel, 1.8);
    g.moveTo(430, Y(568));
    g.lineTo(430, Y(596));
    g.lineWidth = 1.2;
    g.strokeColor = col(C.divider, 0.3);
    g.stroke();
    g.moveTo(448, Y(577));
    g.lineTo(453, Y(577));
    g.lineTo(459, Y(572));
    g.lineTo(459, Y(592));
    g.lineTo(453, Y(587));
    g.lineTo(448, Y(587));
    g.close();
    g.fillColor = col(C.icon);
    g.fill();
    g.arc(458.39, Y(582), 7, -1.0297, 1.0297, false);
    g.lineWidth = 2;
    g.strokeColor = col(C.icon);
    g.stroke();
    [16, 22, 28].forEach((dy) => {
      g.moveTo(478, Y(560 + dy));
      g.lineTo(500, Y(560 + dy));
    });
    g.lineWidth = 2.6;
    g.strokeColor = col(C.icon);
    g.stroke();
  }

  private mkLabel(
    name: string,
    x: number,
    y: number,
    size: number,
    color: string,
    anchorX: number,
  ): Label {
    const n = new Node(name);
    this.node.addChild(n);
    const ui = n.addComponent(UITransform);
    ui.setAnchorPoint(anchorX, 0.5);
    const lab = n.addComponent(Label);
    lab.fontSize = size;
    lab.lineHeight = size + 2;
    lab.color = col(color);
    lab.isBold = true;
    n.setPosition(new Vec3(x, this.Y(y), 0));
    this.labels[name] = lab;
    return lab;
  }
  private makeLabels(): void {
    this.mkLabel('lastWinLabel', 100, 233, 13, C.gold, 0.5).string = 'LAST WIN';
    this.mkLabel('lastWinValue', 180, 233, 17, C.value, 0).string = '0';
    this.mkLabel('totalBetLabel', 320, 233, 13, C.gold, 0.5).string = 'TOTAL BET';
    this.mkLabel('totalBetValue', 400, 233, 17, C.value, 0).string = '50';
    this.mkLabel('demo', 270, 284, 11, C.currency, 0.5).string = 'DEMO MODE';
    this.mkLabel('stepValue', 270, 507, 24, C.value, 0.5).string = '50';
    this.mkLabel('balLabel', 36, 582, 13, C.gold, 0).string = 'BALANCE';
    this.mkLabel('balValue', 104, 582, 15, C.value, 0).string = '10,000,000';
    this.mkLabel('balCur', 196, 582, 11, C.currency, 0).string = 'USD';
    this.mkLabel('betLabel', 242, 582, 12, C.gold, 0).string = 'BET';
    this.mkLabel('betValue', 272, 582, 15, C.value, 0).string = '50';
  }

  private makeHitAreas(): void {
    const add = (name: string, x: number, y: number, w: number, h: number, ev: string) => {
      const n = new Node(name);
      this.node.addChild(n);
      const ui = n.addComponent(UITransform);
      ui.setAnchorPoint(0, 1);
      ui.setContentSize(w, h);
      n.setPosition(new Vec3(x, this.Y(y), 0));
      n.on(Node.EventType.TOUCH_END, () => this.events.emit(ev));
    };
    add('hitSpin', 200, 322, 140, 140, 'spin');
    add('hitAutoplay', 74, 476, 60, 60, 'autoplay');
    add('hitMinus', 170, 479, 67, 54, 'bet:dec');
    add('hitPlus', 303, 479, 67, 54, 'bet:inc');
    add('hitTurbo', 406, 476, 60, 60, 'turbo');
    add('hitSound', 444, 566, 34, 32, 'sound');
    add('hitMenu', 472, 566, 36, 32, 'menu');
  }

  // ---- public API ----
  on(ev: string, cb: () => void): this {
    this.events.on(ev, cb);
    return this;
  }
  fit(viewW: number, viewH: number): void {
    const s = Math.min(viewW / W, viewH / H);
    this.node.setScale(s, s, 1);
    this.node.setPosition(new Vec3((viewW - W * s) / 2, (viewH - H * s) / 2 + H * s, 0));
  }
  private fmt(n: number): string {
    return n.toLocaleString('en-US');
  }
  setBalance(n: number): void {
    this.labels['balValue'].string = this.fmt(n);
  }
  setLastWin(n: number): void {
    this.labels['lastWinValue'].string = this.fmt(n);
  }
  setBet(n: number): void {
    const v = this.fmt(n);
    this.labels['stepValue'].string = v;
    this.labels['totalBetValue'].string = v;
    this.labels['betValue'].string = v;
  }
  setSoundOn(on: boolean): void {
    const lab = this.labels['betLabel']; // reuse for a subtle state cue if desired
    void lab;
    void on; // sound icon state cue — wire to a muted glyph swap when art is added
  }
}
