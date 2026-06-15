/* BuyBonusModal — premium Buy-Feature modal, Cocos port of the PixiJS flagship's
   3-tier buy-bonus card (shining-pop.game.js buyModal). Self-contained: builds
   its own scrim + card + tier cards + inline bet stepper + BUY/CANCEL + close X,
   and fit-scales to the viewport (master layoutBuyModal pattern). cc.Graphics has
   no gradients, so the candy surfaces use the same stop+sheen+rim technique as
   the betting bar.

   The modal is VISUAL only — it renders the costs the model supplies and emits
   intent events; the controller owns the spend + free-spin playback.

   Events: buy(mode) · cancel · bet:inc · bet:dec · ui:click
   API: configure(tiers, betText) · setBet(betText) · open · close · fit · on */
import {
  _decorator,
  Color,
  Component,
  Graphics,
  Label,
  Node,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
} from 'cc';
import { applyFont } from './fonts';

const { ccclass } = _decorator;

export interface BuyTier {
  mode: string;
  name: string;
  spins: number;
  costText: string;
  special: string;
  accent: string;
  frame?: SpriteFrame | null;
}

const C = {
  scrim: '#05030a',
  card: '#1a1138',
  cardHi: '#2e1c58',
  tile: '#241652',
  tileHi: '#3a2470',
  title: '#ff5a9c',
  label: '#e9d6f5',
  value: '#fdf2ff',
  muted: '#b9a8d6',
  edge: '#ff7ad0',
  cyan: '#bfe8ff',
  buy: '#ff5ab0',
  buyHi: '#ffd9f4',
  cancel: '#241a3a',
};
function col(hex: string, a?: number): Color {
  const c = new Color();
  Color.fromHEX(c, hex);
  if (a != null) c.a = Math.round(a * 255);
  return c;
}

const CARD_W = 760;
const CARD_H = 560;
const TILE_W = 212;
const TILE_H = 300;

@ccclass('BuyBonusModal')
export class BuyBonusModal extends Component {
  private cbs: Record<string, ((arg?: unknown) => void)[]> = {};
  private card!: Node;
  private cardScale = 1;
  private tiers: BuyTier[] = [];
  private tileNodes: Node[] = [];
  private medallions: Node[] = [];
  private rings: Node[] = [];
  private tileOps: UIOpacity[] = [];
  private selected = 0;
  private betValue!: Label;
  private buyLabel!: Label;
  private buyBtn!: Node;
  private buyOp!: UIOpacity;
  private affordable: boolean[] = [];
  private built = false;

  on(ev: string, cb: (arg?: unknown) => void): this {
    (this.cbs[ev] = this.cbs[ev] ?? []).push(cb);
    return this;
  }
  private emit(ev: string, arg?: unknown): void {
    (this.cbs[ev] ?? []).forEach((cb) => {
      try {
        cb(arg);
      } catch {
        /* host handles */
      }
    });
  }

  onLoad(): void {
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(10, 10);
    this.node.active = false;
  }

  // ---- small builders -------------------------------------------------------
  private node2(parent: Node, x: number, y: number, w: number, h: number): Node {
    const n = new Node('n');
    n.layer = this.node.layer;
    parent.addChild(n);
    const ui = n.addComponent(UITransform);
    ui.setAnchorPoint(0.5, 0.5);
    ui.setContentSize(w, h);
    n.setPosition(x, y, 0);
    return n;
  }

  private text(
    parent: Node,
    str: string,
    x: number,
    y: number,
    size: number,
    color: string,
    display = false,
    ax = 0.5,
  ): Label {
    const n = new Node('t');
    n.layer = this.node.layer;
    parent.addChild(n);
    n.addComponent(UITransform).setAnchorPoint(ax, 0.5);
    n.setPosition(x, y, 0);
    const l = n.addComponent(Label);
    l.string = str;
    l.fontSize = size;
    l.lineHeight = size + 3;
    l.isBold = true;
    l.color = col(color);
    applyFont(l, display ? 'display' : 'body');
    return l;
  }

  /** Candy panel into a Graphics (origin-centred rect), master sheen technique. */
  private candyPanel(
    g: Graphics,
    w: number,
    h: number,
    r: number,
    fill: string,
    fillHi: string,
    edge: string,
    edgeW = 2,
  ): void {
    g.fillColor = col(fill);
    g.roundRect(-w / 2, -h / 2, w, h, r);
    g.fill();
    g.fillColor = col(fillHi, 0.55);
    g.roundRect(-w / 2 + 2, 0, w - 4, h / 2 - 2, Math.max(2, r - 4));
    g.fill();
    g.fillColor = col('#ffffff', 0.16);
    g.roundRect(-w / 2 + 3, h / 2 - h * 0.2, w - 6, h * 0.13, Math.max(2, r - 4));
    g.fill();
    g.lineWidth = 1.4;
    g.strokeColor = col(C.cyan, 0.22);
    g.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, Math.max(2, r - 2));
    g.stroke();
    g.lineWidth = edgeW;
    g.strokeColor = col(edge);
    g.roundRect(-w / 2, -h / 2, w, h, r);
    g.stroke();
  }

  /** Faceted candy gem medallion (no sprite frame supplied). */
  private gem(g: Graphics, cx: number, cy: number, rad: number, accent: string): void {
    // Bright candy BASE under the accent so a dim/missing accent can NEVER read as
    // a black diamond (owner: "color bug, not black in the bonus"). The accent tints
    // on top; a bright core + rim keep it glossy.
    g.fillColor = col('#ff8ad0', 0.9);
    g.moveTo(cx, cy + rad);
    g.lineTo(cx + rad * 0.82, cy);
    g.lineTo(cx, cy - rad);
    g.lineTo(cx - rad * 0.82, cy);
    g.close();
    g.fill();
    g.fillColor = col(accent, 0.78);
    g.moveTo(cx, cy + rad);
    g.lineTo(cx + rad * 0.82, cy);
    g.lineTo(cx, cy - rad);
    g.lineTo(cx - rad * 0.82, cy);
    g.close();
    g.fill();
    g.fillColor = col('#ffffff', 0.55);
    g.moveTo(cx, cy + rad * 0.5);
    g.lineTo(cx + rad * 0.36, cy);
    g.lineTo(cx, cy - rad * 0.5);
    g.lineTo(cx - rad * 0.36, cy);
    g.close();
    g.fill();
    g.lineWidth = 2;
    g.strokeColor = col('#ffffff', 0.5);
    g.moveTo(cx, cy + rad);
    g.lineTo(cx + rad * 0.82, cy);
    g.lineTo(cx, cy - rad);
    g.lineTo(cx - rad * 0.82, cy);
    g.close();
    g.stroke();
  }

  private pressFx(hit: Node, visuals: Node[], cb: () => void, silent = false): void {
    hit.on(Node.EventType.TOUCH_START, () => visuals.forEach((v) => v.setScale(0.95, 0.95, 1)));
    const restore = () => visuals.forEach((v) => v.setScale(1, 1, 1));
    hit.on(Node.EventType.TOUCH_CANCEL, restore);
    hit.on(Node.EventType.TOUCH_END, () => {
      restore();
      if (!silent) this.emit('ui:click');
      cb();
    });
  }

  // ---- public API -----------------------------------------------------------
  /** (Re)build the modal from tier data. Idempotent — tears down a prior build. */
  configure(tiers: BuyTier[], betText: string): void {
    this.tiers = tiers;
    this.node.removeAllChildren();
    this.tileNodes = [];
    this.built = true;

    // Scrim — full-bleed hit-blocker behind the card. Sized generous so it
    // covers any viewport once the modal node sits at the canvas centre.
    const scrim = this.node2(this.node, 0, 0, 6000, 4000);
    const sg = scrim.addComponent(Graphics);
    sg.fillColor = col(C.scrim, 0.82);
    sg.rect(-3000, -2000, 6000, 4000);
    sg.fill();
    scrim.on(Node.EventType.TOUCH_END, () => {
      this.emit('ui:click');
      this.emit('cancel');
      this.close();
    });

    // Card — the premium surface everything sits on.
    const card = this.node2(this.node, 0, 0, CARD_W, CARD_H);
    this.card = card;
    const cg = card.addComponent(Graphics);
    this.candyPanel(cg, CARD_W, CARD_H, 28, C.card, C.cardHi, C.edge, 3);

    this.text(card, 'BUY BONUS', 0, CARD_H / 2 - 46, 30, C.title, true);
    this.text(card, 'Choose your bonus — instant free spins.', 0, CARD_H / 2 - 84, 16, C.muted);

    // Tier cards — 3 across.
    const gap = 22;
    const totalW = this.tiers.length * TILE_W + (this.tiers.length - 1) * gap;
    const startX = -totalW / 2 + TILE_W / 2;
    this.medallions = [];
    this.rings = [];
    this.tileOps = [];
    this.tiers.forEach((tier, i) => {
      const tx = startX + i * (TILE_W + gap);
      const tile = this.node2(card, tx, 24, TILE_W, TILE_H);
      const tg = tile.addComponent(Graphics);
      this.tileNodes.push(tile);
      this.tileOps.push(tile.getComponent(UIOpacity) ?? tile.addComponent(UIOpacity));

      // Glow ring BEHIND the medallion — layered candy-pink fades + a crisp rim
      // (the flagship's selected-tier halo). Hidden until this tier is selected.
      const my = TILE_H / 2 - 78;
      const ring = this.node2(tile, 0, my, 116, 116);
      const rg = ring.addComponent(Graphics);
      for (let k = 5; k >= 1; k--) {
        rg.fillColor = col(tier.accent, 0.05 + (5 - k) * 0.02);
        rg.circle(0, 0, 50 + k * 5);
        rg.fill();
      }
      rg.lineWidth = 3;
      rg.strokeColor = col(tier.accent, 0.95);
      rg.circle(0, 0, 54);
      rg.fill();
      rg.fillColor = col('#ffffff', 0.12);
      rg.circle(0, 0, 50);
      rg.fill();
      ring.active = false;
      this.rings.push(ring);

      const medallion = this.node2(tile, 0, my, 96, 96);
      if (tier.frame) {
        const sp = medallion.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = tier.frame;
      } else {
        const mg = medallion.addComponent(Graphics);
        this.gem(mg, 0, 0, 42, tier.accent);
      }
      this.medallions.push(medallion);

      this.text(tile, tier.name, 0, 14, 19, tier.accent, true);
      this.text(tile, `${tier.spins} FREE SPINS`, 0, -16, 13, C.label);
      const cost = this.text(tile, tier.costText, 0, -52, 26, C.value, true);
      cost.name = 'cost';
      // Only render the special caption when there IS one — an empty string left a
      // dead/empty row (owner: "not empty flexible dynamic").
      if (tier.special) this.text(tile, tier.special, 0, -92, 11, C.muted);

      this.pressFx(tile, [tile], () => this.select(i), false);
    });

    // Inline bet stepper — change bet without closing (master parity: live cost).
    const stepY = -CARD_H / 2 + 118;
    this.text(card, 'YOUR BET', 0, stepY + 30, 13, C.edge);
    const minus = this.node2(card, -120, stepY, 56, 56);
    const mg2 = minus.addComponent(Graphics);
    this.candyPanel(mg2, 56, 56, 14, C.tile, C.tileHi, C.edge, 2);
    this.text(minus, '−', 0, 2, 30, C.value, true);
    this.pressFx(minus, [minus], () => this.emit('bet:dec'));

    this.betValue = this.text(card, betText, 0, stepY, 24, C.value, true);

    const plus = this.node2(card, 120, stepY, 56, 56);
    const pg2 = plus.addComponent(Graphics);
    this.candyPanel(pg2, 56, 56, 14, C.tile, C.tileHi, C.edge, 2);
    this.text(plus, '+', 0, 2, 30, C.value, true);
    this.pressFx(plus, [plus], () => this.emit('bet:inc'));

    // Action row — CANCEL (secondary) + BUY (hero).
    const btnY = -CARD_H / 2 + 50;
    const cancel = this.node2(card, -150, btnY, 220, 56);
    const ccg = cancel.addComponent(Graphics);
    this.candyPanel(ccg, 220, 56, 28, C.cancel, C.cardHi, C.edge, 2);
    this.text(cancel, 'CANCEL', 0, 2, 18, C.label, true);
    this.pressFx(cancel, [cancel], () => {
      this.emit('cancel');
      this.close();
    });

    const buy = this.node2(card, 150, btnY, 220, 56);
    this.buyBtn = buy;
    this.buyOp = buy.addComponent(UIOpacity);
    const bg = buy.addComponent(Graphics);
    this.candyPanel(bg, 220, 56, 28, C.buy, C.buyHi, C.buyHi, 2);
    // WHITESMOKE buy/cost text (owner: same dark-text colour bug as the carousel
    // active bet — "BUY $X" / "NEED $X" reads cleaner in whitesmoke on the candy btn).
    this.buyLabel = this.text(buy, 'BUY', 0, 2, 18, '#f5f5f5', true);
    this.pressFx(buy, [buy], () => {
      // Unaffordable tier: refuse with a head-shake + 'buy:blocked' (host shows
      // the friendly notice) instead of a dead click or a doomed buy intent.
      if (this.affordable[this.selected] === false) {
        this.emit('buy:blocked', this.tiers[this.selected].mode);
        Tween.stopAllByTarget(buy);
        buy.setPosition(150, btnY, 0);
        tween(buy)
          .by(0.05, { position: new Vec3(-9, 0, 0) })
          .by(0.09, { position: new Vec3(18, 0, 0) })
          .by(0.05, { position: new Vec3(-9, 0, 0) })
          .start();
        return;
      }
      this.emit('buy', this.tiers[this.selected].mode);
    });

    // Close X — top-right.
    const close = this.node2(card, CARD_W / 2 - 38, CARD_H / 2 - 38, 52, 52);
    const xg = close.addComponent(Graphics);
    xg.lineWidth = 4;
    xg.strokeColor = col(C.value);
    xg.moveTo(-10, -10);
    xg.lineTo(10, 10);
    xg.moveTo(10, -10);
    xg.lineTo(-10, 10);
    xg.stroke();
    this.pressFx(close, [close], () => {
      this.emit('cancel');
      this.close();
    });

    this.select(0);
  }

  /** Highlight the chosen tier (flagship treatment): glow-ring halo + medallion
   *  scale-pop + lift + bright accent rim, while the others dim back. */
  private select(i: number): void {
    this.selected = i;
    this.tileNodes.forEach((tile, idx) => {
      const tier = this.tiers[idx];
      const on = idx === i;
      const g = tile.getComponent(Graphics);
      if (g) {
        g.clear();
        this.candyPanel(
          g,
          TILE_W,
          TILE_H,
          18,
          on ? C.tileHi : C.tile,
          C.cardHi,
          on ? tier.accent : C.edge,
          on ? 3.5 : 2,
        );
      }
      tile.setPosition(tile.position.x, on ? 32 : 24, 0);
      // Unselected tiers dim back so the chosen one reads as the hero.
      const op = this.tileOps[idx];
      if (op) op.opacity = on ? 255 : 150;
      // Glow ring fades in under the chosen medallion.
      const ring = this.rings[idx];
      if (ring) {
        const rop = ring.getComponent(UIOpacity) ?? ring.addComponent(UIOpacity);
        Tween.stopAllByTarget(rop);
        if (on) {
          ring.active = true;
          rop.opacity = 0;
          tween(rop).to(0.18, { opacity: 255 }).start();
        } else {
          ring.active = false;
        }
      }
      // Medallion pops up on select, settles back otherwise.
      const med = this.medallions[idx];
      if (med) {
        Tween.stopAllByTarget(med);
        tween(med)
          .to(0.22, { scale: new Vec3(on ? 1.12 : 1, on ? 1.12 : 1, 1) }, { easing: 'backOut' })
          .start();
      }
    });
    this.applyBuyState();
  }

  /** BUY reflects the selected tier's affordability: full-strength `BUY <cost>`
   *  when buyable, dimmed `NEED <cost>` when the balance can't cover it. */
  private applyBuyState(): void {
    if (!this.buyLabel) return;
    const ok = this.affordable[this.selected] !== false;
    this.buyLabel.string = `${ok ? 'BUY' : 'NEED'}  ${this.tiers[this.selected].costText}`;
    if (this.buyOp) this.buyOp.opacity = ok ? 255 : 130;
  }

  /** Per-tier affordability flags (host recomputes on balance/bet changes). */
  setAffordable(flags: boolean[]): void {
    this.affordable = flags.slice();
    this.applyBuyState();
  }

  setBet(betText: string): void {
    if (this.betValue) this.betValue.string = betText;
  }

  /** Update each tier's live cost text (after a bet change). */
  setCosts(costTexts: string[]): void {
    this.tileNodes.forEach((tile, i) => {
      const label = tile.children
        .map((c) => c.getComponent(Label))
        .find((l) => l && l.name === 'cost');
      if (label && costTexts[i] != null) {
        this.tiers[i].costText = costTexts[i];
        label.string = costTexts[i];
      }
    });
    this.applyBuyState();
  }

  open(): void {
    if (!this.built) return;
    this.node.active = true;
    const op = this.card.getComponent(UIOpacity) ?? this.card.addComponent(UIOpacity);
    // Cancel any in-flight close tween so a fast re-open starts from a clean pose.
    Tween.stopAllByTarget(op);
    Tween.stopAllByTarget(this.card);
    op.opacity = 0;
    this.card.setScale(0.9 * this.cardScale, 0.9 * this.cardScale, 1);
    tween(op).to(0.2, { opacity: 255 }).start();
    tween(this.card)
      .to(0.26, { scale: new Vec3(this.cardScale, this.cardScale, 1) }, { easing: 'backOut' })
      .start();
  }

  /** Symmetric reverse of open() — settle-in scale + fade, then deactivate and
   *  reset so the next open starts clean. Mirrors slot-view's house popClose so
   *  every overlay shares one dismiss feel (was an abrupt active=false). */
  close(): void {
    if (!this.node.active) return;
    const op = this.card.getComponent(UIOpacity) ?? this.card.addComponent(UIOpacity);
    Tween.stopAllByTarget(op);
    Tween.stopAllByTarget(this.card);
    const settled = 0.92 * this.cardScale;
    tween(this.card)
      .to(0.12, { scale: new Vec3(settled, settled, 1) }, { easing: 'quadIn' })
      .start();
    tween(op)
      .to(0.12, { opacity: 0 })
      .call(() => {
        this.node.active = false;
        this.card.setScale(this.cardScale, this.cardScale, 1);
        op.opacity = 255;
      })
      .start();
  }

  isOpen(): boolean {
    return this.node.active;
  }

  /** Fit the card to the SAFE AREA ABOVE THE BETTING BAR. `bottomInset` is the
   *  screen-px the bar reserves at the bottom; the card shrinks to fit the height
   *  that remains AND is raised by half the inset so it centres in that band
   *  instead of the full screen — otherwise its bottom rows (YOUR BET stepper +
   *  CANCEL/BUY) clip behind the bar. Host is a screen-space overlay, so this
   *  scale/position is absolute (no board scale applied). */
  fit(viewW: number, viewH: number, bottomInset = 0): void {
    const margin = 36;
    const availH = Math.max(220, viewH - bottomInset - margin);
    // PORTRAIT (owner: "buy bonus too small on mobile") — in a tall viewport the
    // old `min(1, …)` cap left the card tiny (it only filled the landscape width).
    // In portrait, fill ~92% of the WIDTH instead (height is never the constraint
    // on a tall screen), so the modal is big and readable. Landscape keeps the
    // original height-constrained fit capped at 1.
    const portrait = viewH > viewW;
    const s = portrait
      ? Math.min((viewW * 0.97) / CARD_W, availH / CARD_H) // near-full width on mobile
      : Math.min(1, (viewW - margin) / CARD_W, availH / CARD_H);
    this.cardScale = s;
    if (this.card) {
      this.card.setScale(s, s, 1);
      this.card.setPosition(0, bottomInset / 2, 0); // centre within the area above the bar
    }
  }
}
