'use strict';
(async () => {
  const loader = document.getElementById('loader');
  const lprog  = document.getElementById('lprog');
  const lfill  = document.getElementById('lfill');
  const fail = (m) => { lprog.textContent = m; lprog.style.color = '#ff8a8a'; };
  if(!window.PIXI){ fail('Could not load PixiJS'); return; }

  // ── 1. URL PARAMS / STAKE ENGINE BOOTSTRAP ────────────────────
  const url = new URL(location.href);
  const API_AMOUNT_MULTIPLIER = 1_000_000;
  const _rawRgs = url.searchParams.get('rgs_url');
  const _normRgs = !_rawRgs
    ? 'mock://demo.cdn.stake-engine.com'
    : (/^(https?|mock):\/\//.test(_rawRgs) ? _rawRgs : 'https://' + _rawRgs);
  // Demo-mode sessionID — crypto-derived (no Math.random per governance).
  const _demoSid = (() => {
    try { const a = new Uint32Array(2); crypto.getRandomValues(a);
      return 'demo-' + a[0].toString(36) + a[1].toString(36); }
    catch(_){ return 'demo-' + Date.now().toString(36); }
  })();
  const STAKE = {
    sessionID: url.searchParams.get('sessionID') || _demoSid,
    lang: url.searchParams.get('lang') || 'en',
    currency: url.searchParams.get('currency') || 'USD',
    device: url.searchParams.get('device') || (matchMedia('(max-width:768px)').matches ? 'mobile' : 'desktop'),
    rgs_url: _normRgs,
    jurisdiction: (url.searchParams.get('jurisdiction') || 'INT').toUpperCase(),
    social: url.searchParams.get('social') === 'true',
    replay: url.searchParams.get('replay') === 'true',
    debug: url.searchParams.get('debug') === 'true',
    // replay descriptor (game/version/mode/event) — Stake passes these on the replay URL
    rGame: url.searchParams.get('game') || 'shining-crown',
    rVersion: url.searchParams.get('version') || '1',
    rMode: url.searchParams.get('mode') || 'base',
    rEvent: url.searchParams.get('event') || url.searchParams.get('bet') || '',
  };
  const log = (...a) => { if(STAKE.debug) console.log(...a); };

  // ── 1b. COMPLIANCE CONFIG ─────────────────────────────────────
  const COMPLIANCE_CONFIGS = {
    INT:  { allow_ldw_celebration:true,  allow_buy_bonus:true,  max_animation_ms:3500, reality_check_min:30, reality_check_spins:100, autoplay_max:Infinity },
    UKGC: { allow_ldw_celebration:false, allow_buy_bonus:false, max_animation_ms:2500, reality_check_min:30, reality_check_spins:100, autoplay_max:250 },
    MGA:  { allow_ldw_celebration:true,  allow_buy_bonus:true,  max_animation_ms:3000, reality_check_min:60, reality_check_spins:150, autoplay_max:100 },
    SE:   { allow_ldw_celebration:false, allow_buy_bonus:false, max_animation_ms:2500, reality_check_min:60, reality_check_spins:100, autoplay_max:0 },
    DE:   { allow_ldw_celebration:false, allow_buy_bonus:false, max_animation_ms:5000, reality_check_min:60, reality_check_spins:150, autoplay_max:0 },
    NL:   { allow_ldw_celebration:false, allow_buy_bonus:false, max_animation_ms:2500, reality_check_min:60, reality_check_spins:100, autoplay_max:0 },
    IT:   { allow_ldw_celebration:true,  allow_buy_bonus:true,  max_animation_ms:3000, reality_check_min:60, reality_check_spins:120, autoplay_max:200 },
    US:   { allow_ldw_celebration:true,  allow_buy_bonus:true,  max_animation_ms:3500, reality_check_min:60, reality_check_spins:200, autoplay_max:Infinity },
  };
  const COMPLY = Object.assign({}, COMPLIANCE_CONFIGS[STAKE.jurisdiction] || COMPLIANCE_CONFIGS.INT);

  // ── 1c. CURRENCY ──────────────────────────────────────────────
  // ── CURRENCY MAP (2026-05-31 expanded — full Stake fiat + crypto + social).
  // s = symbol/ticker prefix, d = decimals, l = locale. Crypto uses the TICKER
  // prefix (Stake convention "BTC 0.00012345") with correct per-coin decimals
  // (BTC 8, ETH 6, LTC 5, XRP 3, DOGE 2…). Social coins (XGC Gold Coins / XSC
  // Stake Cash) carry social:true so their GC/SC label SURVIVES social mode.
  const CURRENCIES = {
    USD:{s:'$',d:2,l:'en-US'}, EUR:{s:'€',d:2,l:'de-DE'}, GBP:{s:'£',d:2,l:'en-GB'},
    JPY:{s:'¥',d:0,l:'ja-JP'}, KRW:{s:'₩',d:0,l:'ko-KR'}, CNY:{s:'CN¥',d:2,l:'zh-CN'},
    BRL:{s:'R$',d:2,l:'pt-BR'}, CAD:{s:'CA$',d:2,l:'en-CA'}, AUD:{s:'A$',d:2,l:'en-AU'},
    INR:{s:'₹',d:2,l:'en-IN'}, MXN:{s:'MX$',d:2,l:'es-MX'}, TRY:{s:'₺',d:2,l:'tr-TR'},
    BTC:{s:'BTC ',d:8,l:'en-US'}, ETH:{s:'ETH ',d:6,l:'en-US'}, LTC:{s:'LTC ',d:5,l:'en-US'},
    DOGE:{s:'DOGE ',d:2,l:'en-US'}, USDT:{s:'USDT ',d:2,l:'en-US'}, USDC:{s:'USDC ',d:2,l:'en-US'},
    SOL:{s:'SOL ',d:4,l:'en-US'}, XRP:{s:'XRP ',d:3,l:'en-US'}, TRX:{s:'TRX ',d:2,l:'en-US'},
    TON:{s:'TON ',d:4,l:'en-US'}, BNB:{s:'BNB ',d:5,l:'en-US'},
    XGC:{s:'GC ',d:2,l:'en-US',social:true}, XSC:{s:'SC ',d:2,l:'en-US',social:true},
  };
  // Unknown/unlisted currency → use its CODE as the prefix (e.g. "SOL 1.23"),
  // NEVER a wrong "$" (currency-confusion is a Stake reject — KB §9 / HC #10).
  const CUR = CURRENCIES[STAKE.currency] || { s:(STAKE.currency ? STAKE.currency+' ' : '$'), d:2, l:'en-US' };
  function fmtMoney(x6){
    const v = x6 / API_AMOUNT_MULTIPLIER;
    // Social mode hides fiat/crypto symbols, but social COINS keep their GC/SC
    // label (the correct sweepstakes term, not a restricted gambling one).
    const prefix = STAKE.social ? (CUR.social ? CUR.s : '') : CUR.s;
    return prefix + v.toLocaleString(CUR.l, {minimumFractionDigits:CUR.d, maximumFractionDigits:CUR.d});
  }

  // ── 1a. STYLE GUIDE — canonical Cyber-Villain tokens (UX brief) ──
  // The ONE source of truth for every visual decision in the game.
  // Per UX brief: "If a color is not in the StyleGuide, it should not
  // exist in the code." Use these tokens as the FIRST choice for new
  // rendering; THEME (below) wraps them with legacy aliases for back-
  // compat with existing call sites.
  const StyleGuide = {
    Colors: {
      // Villain palette — neon + obsidian
      Obsidian:        0x0a0a0e,   // base layer
      ObsidianRaised:  0x1f1c2e,   // raised surface (cards / panels)
      ObsidianMid:     0x2a263d,   // mid surface
      VillainMagenta:  0xff007f,   // primary villain accent
      VillainMagentaSoft: 0xff4d9f,// soft/hover variant
      VillainMagentaDeep: 0xa00050,// deep gradient bottom
      ElectricViolet:  0x8a2be2,   // secondary villain
      VioletDeep:      0x4a0e7f,
      VioletBright:    0xb060ff,
      Whitesmoke:      0xf5f5fa,   // ALL text + icon glyphs
      WhitesmokeDim:   0x8b95a8,   // muted text
      InkBlack:        0x000000,   // pure black (shadows / contour)
    },
    Fonts: {
      Primary:  'Luckiest Guy',    // heavy condensed — values + headlines
      Body:     'Fredoka',          // body text, labels, descriptions
    },
    Sizing: {
      // Stroke widths used across all panels
      strokeBorder:  1.8,
      strokeHighlight: 1.2,
      strokeInkContour: 0.7,
      // Standard button height
      btnH:          44,
      // Standard radius
      radiusModal:   16,
      radiusBtn:     20,
      radiusChip:    9,
    },
    Glow: {
      // Faked GlowFilter alpha-decay layers (outer→inner)
      outer:  0.06,
      mid:    0.12,
      inner:  0.22,
      core:   0.30,
    },
  };
  // ── 1b. DESIGN TOKENS (pixi-design-tokens bridge) ─────────────
  // Legacy aliases — THEME wraps StyleGuide for back-compat with all
  // existing render callsites. New code MUST reference StyleGuide.
  const THEME = {
    colors: {
      // ── Surface scale — navy slate (deep enough to feel premium,
      //     not pure black so it doesn't look like a TV-off-state)
      surface0:    0x0a0518,   // deepest candy-night base (was navy 0x0f1320)
      surface1:    0x19103e,   // raised candy-grape panel — matches the bar
      surface2:    0x2e1c58,   // mid candy surface
      surface3:    0x46297a,   // highest elevation (bar panel top)
      sunken:      0x070314,   // sunken input wells

      primary:     0x15151c, primaryHover: 0x232330,

      // ── Brand accent — NEON MAGENTA (villain). Was gold (0xffce47 etc.) — the
      // brand pivoted to black/magenta-villain, so `accent` now resolves to the
      // magenta family. This is the ROOT fix for recurring gold: every
      // THEME.colors.accent reference (HUD WIN label, turbo-active, win-moment
      // auras, MAX BET, button pings) is now on-brand magenta. 2026-06-01.
      accent:        0xff007f,  // neon magenta (BUY BONUS, win moments) — was gold
      accentMuted:   0xa00050,  // deep magenta (was muted gold)
      accentBright:  0xff5ab0,  // bright magenta (was bright gold)
      accentDeep:    0x7a0040,  // deep magenta gradient base (was darker gold)

      // ── VILLAIN NEON PALETTE — per Cyber-Villain brief
      //   pink         = electric neon magenta  (#FF007F)
      //   pinkBright   = hot pink hover state
      //   pinkMuted    = deep pink for gradient bottoms
      //   violet       = electric violet for secondary accent (#8A2BE2)
      pink:          0xff007f,    // ELECTRIC NEON MAGENTA — primary villain accent
      pinkBright:    0xff4d9f,    // hover/glow halo
      pinkMuted:     0xa00050,    // gradient bottom / deep
      violet:        0x8a2be2,    // electric violet — secondary villain accent
      violetDeep:    0x4a0e7f,    // violet gradient bottom
      violetBright:  0xb060ff,    // violet hover/highlight
      obsidian:      0x0a0a0e,    // midnight obsidian base (#0A0A0E)

      // ── Electric blue — AUTOPLAY function-color (universal Stake blue)
      blue:          0x4a7fe9,  // (renamed from stakeBlue)
      blueBright:    0x6f9aff,  // (NEW) hover/active state

      // ── Cyan — info / settings / sound function-color
      cyan:          0x8be4ff,  // candy cyan — matches the bar's cyan glass rim (was 0x65d4f0)
      cyanBright:    0xbfe8ff,  // brighter candy cyan

      // ── Text scale
      text:         0xfdf2ff,
      textMuted:    0xb89cd8,   // candy lavender-muted (was slate 0x8b95a8)
      textDisabled: 0x556270,
      textInverse:  0x14141a,

      // ── Semantic
      win:   0x52d189,
      loss:  0xff6b6b,
      warn:  0xffb84d,
      info:  0x65d4f0,

      // ── Strokes / dividers
      stroke:       0x2d3245,
      strokeStrong: 0x3d4358,
      strokeGlass:  0xffffff,  // (NEW) for glassmorphic top highlights

      // ── DEPRECATED aliases (kept for compat with older drawing code)
      stakeBlue:    0x4a7fe9,
    },
    type: {
      family:        'Fredoka',
      familyDisplay: 'Luckiest Guy',
      h1: 32, h2: 22, body: 14, small: 11, caption: 9,
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
    radii:   { sm: 4, md: 8, lg: 12, xl: 20, pill: 999 },
    motion:  { dur: { instant: 80, fast: 180, base: 260, slow: 500 } },
  };

  // ── 2. MATH MODEL — Shining Crown crystal slot ────────────────
  // Canonical model — Star is WILD on lines; matches games/shining-pop/game_config.py
  // + verify_quick.py (4 modes target RTP 97.00%). Live wins come from RGS events;
  // this local model drives the mock + the reveal cell-highlights only.
  const SYM = { R:0,G:1,B:2,P:3,O:4,C:5,BELL:6,CROWN:7,STAR:8 };
  const SYM_COUNT = 9, STAR = SYM.STAR;
  const SYM_NAME = ['Cherry','Lemon','Plum','Grapes','Watermelon','Bell','Seven','Crown','Star'];

  // ── #12 STATIC-EXEMPTION FILTER (PixiJS idle perf + visual-hierarchy rule) ──
  // Only HIGH-VALUE symbols animate at rest: 6=Seven, 7=Crown, 8=Star (per
  // SYM_NAME). Low/mid symbols (Cherry/Lemon/Plum/Grapes/Watermelon/Bell) stay
  // 100% STATIC in IDLE — frozen on their base frame, zero per-frame work. The
  // render loop's idle-glow block `continue`s past anything this returns false
  // for, so low-odds symbols incur no transform/alpha recalc while idle.
  const IDLE_ANIM_SYMS = new Set([6, 7, 8]);
  function shouldAnimateIdle(symbolId){ return IDLE_ANIM_SYMS.has(symbolId); }

  // Line paytable — PAY[sym] = [pay3, pay4, pay5] in LINE-BET units.
  const PAY = [
    [  6,  30,   95],  // R  Cherry
    [  6,  30,   95],  // G  Lemon
    [ 10,  48,  165],  // B  Plum
    [ 14,  72,  240],  // P  Grapes
    [ 19,  92,  332],  // O  Watermelon
    [ 28, 140,  458],  // C  Bell
    [ 48, 230,  920],  // BELL Seven
    [113, 552, 2760],  // CROWN
    [  0,   0,    0],  // STAR — scatter/wild, no line pay
  ];
  // Scatter pay (× TOTAL bet) keyed by count of STARs on the 15 cells.
  const SCAT = { 3:2, 4:9, 5:48 };

  // 10 fixed paylines — row index (0=top,1=mid,2=bot) per reel.
  const LINES = [
    [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],
    [0,1,2,1,0],[2,1,0,1,2],[1,0,0,0,1],
    [1,2,2,2,1],[0,1,1,1,0],[2,1,1,1,2],
    [1,0,1,2,1],
  ];
  const NLINES = LINES.length, REELS = 5, ROWS = 3;
  // Payline palette — ON-BRAND magenta-villain crystal family (2026-06-01, was a
  // generic rainbow with gold/orange/green/blue = off our black+magenta style).
  // 10 distinguishable hues all within magenta / pink / violet / amethyst + one
  // crystal-cyan dispersion accent, so lines read apart but match the win-line VFX.
  const LINE_COLORS = [0xff007f,0xc566ff,0xff5cc8,0x9a3bd6,0xff8ad0,0xd84bff,0xff2f93,0x7fe7ff,0xff5ab0,0xb86bf0];

  // Reel-strip symbol counts per reel — frequency drives RTP.
  //               R   G  B  P  O  C  BL CR ST
  const COUNTS = [
    [12, 11, 9, 7, 6, 5, 4, 2, 2],
    [12, 11, 9, 7, 6, 5, 4, 2, 2],
    [12, 11, 9, 7, 6, 5, 4, 2, 2],
    [12, 11, 9, 7, 6, 5, 4, 2, 2],
    [12, 11, 9, 7, 6, 5, 4, 2, 2],
  ];
  function buildStrip(counts){
    const order = [];
    counts.forEach((n,sym) => { for(let i=0;i<n;i++) order.push({sym, key:(i+0.5)/n}); });
    order.sort((a,b) => a.key - b.key);
    return order.map(o => o.sym);
  }
  const STRIPS = COUNTS.map(buildStrip);

  // Feature config.
  const FS_AWARD = { 3:10, 4:12, 5:15 };   // canonical — matches gamestate.py:112
  const FS_RETRIGGER = 5, FS_MULT = 3, FS_CAP = 60;
  // Buy Bonus = bonus_standard (10 FS × ×3 with re-trigger). Calibrated cost
  // 24× via games/shining-pop/verify_quick.py (iter 6, RTP 0.959 @ 500K sims).
  // Future bonus_hot (122×) + bonus_mega (172×) will get their own buttons.
  const BUY_FS_SPINS = 10, BUY_COST_MULT = 23.82;   // standard-tier exact cost (matches index.json + BONUS_TIERS[0])
  const MAX_WIN_X = 5000;          // math cap (× total bet)
  const ADVERTISED_MAX_X = 5000;   // = MAX_WIN_X + the persistent 5,000x caption + bonus_mega book max (was 1000, contradicted the disclaimer)
  const RTP_DISPLAY = '97.00%';   // all 4 modes target 0.97 — calibrated iter 9

  // One reel window → 3 stacked symbols (circular strip).
  function spinReel(reel, rand){
    const strip = STRIPS[reel], len = strip.length;
    const start = Math.floor(rand() * len);
    return [strip[start%len], strip[(start+1)%len], strip[(start+2)%len]];
  }
  function spinGrid(rand){
    const g = [];
    for(let r=0;r<REELS;r++) g.push(spinReel(r, rand));
    return g;
  }
  // Evaluate one grid → { lineX, scatX, scatCount, lineWins[] } in ×TOTAL-bet units.
  function evalGrid(grid){
    let lineLineBet = 0;
    const lineWins = [];
    for(let l=0;l<NLINES;l++){
      const pat = LINES[l];
      const base = grid[0][pat[0]];
      if(base === STAR) continue;
      let count = 1;
      for(let r=1;r<REELS;r++){ const s=grid[r][pat[r]]; if(s === base || s === STAR) count++; else break; }  // Star = wild on lines
      if(count >= 3){
        const p = PAY[base][count-3];
        lineLineBet += p;
        lineWins.push({ line:l, sym:base, count, payLineBet:p });
      }
    }
    const lineX = lineLineBet / NLINES;
    let scatCount = 0;
    for(let r=0;r<REELS;r++) for(let row=0;row<ROWS;row++) if(grid[r][row] === STAR) scatCount++;
    const scatX = SCAT[scatCount] || 0;
    return { lineX, scatX, scatCount, lineWins };
  }
  // Run a free-spin session → { spins[], total, awarded, played }.
  function runFreeSpins(awardSpins, rand){
    let remaining = awardSpins, total = 0, played = 0;
    const spins = [];
    while(remaining > 0 && played < FS_CAP){
      remaining--; played++;
      const grid = spinGrid(rand);
      const ev = evalGrid(grid);
      const winX = ev.lineX * FS_MULT + ev.scatX;
      let retrig = 0;
      if(ev.scatCount >= 3 && played < FS_CAP){ remaining += FS_RETRIGGER; retrig = FS_RETRIGGER; }
      total += winX;
      spins.push({ grid, ev, winX, retrig, mult:FS_MULT });
      if(total >= MAX_WIN_X){ total = MAX_WIN_X; break; }
    }
    return { spins, total:Math.min(total, MAX_WIN_X), awarded:awardSpins, played };
  }

  // ── 3. STATE MACHINE ──────────────────────────────────────────
  const Phase = Object.freeze({
    IDLE:'IDLE', SPIN:'SPIN', REVEAL:'REVEAL', FREESPIN:'FREESPIN',
    CELEBRATE:'CELEBRATE', REALITY_CHECK:'REALITY_CHECK',
  });
  const State = {
    balanceX6: 1_000_000_000,
    betX6: 1_000_000,
    betLevels: [100_000,200_000,500_000,1_000_000,2_000_000,5_000_000,10_000_000,25_000_000,50_000_000,100_000_000],
    betIdx: 3,
    phase: Phase.IDLE,
    // turbo: 3-state cycle — 0 (off), 1 (turbo), 2 (max turbo). Legacy
    // `State.turbo` proxies to `turboMode > 0` via getter/setter so any
    // remaining boolean reads keep working without refactor.
    turboMode: 1,   // DEFAULT TURBO ON (mode 1) per user
    get turbo(){ return this.turboMode > 0; },
    set turbo(v){ this.turboMode = v ? 1 : 0; },
    muted: false,
    reduced: false,
    reducedSystem: false,
    autoplay: { active:false, remaining:0, total:0, stopOnFeature:true, stopOnBigWin:false },
    history: [],
    lastWinX6: 0,    // persists across spins for the "LAST WIN" HUD display
    stats: { spins:0, totalBet:0, totalWon:0, hits:0, features:0, biggest:0 },
    sessionStartedAt: Date.now(),
    spinsSinceCheck: 0,
  };
  const isReduced = () => State.reduced || State.reducedSystem;
  // ── MOBILE GPU TIER DETECTION (P3 — expert audit) ──────────────────
  // Weak mobile GPUs (Adreno/Mali low-end) choke on fillrate: stacked
  // additive glow, radial gradients, alpha particles, blur. Detect a
  // "weak" tier once at boot from CPU/memory heuristics + mobile flag,
  // then scale the heaviest FX down. This is a perf governor, separate
  // from reduced-motion (which is an accessibility preference).
  const _gpuWeak = (() => {
    try {
      const mobile = matchMedia('(max-width:768px)').matches ||
                     /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
      const cores  = navigator.hardwareConcurrency || 8;
      const mem    = navigator.deviceMemory || 8;   // GB (Chrome only)
      // Weak if mobile AND (≤4 cores OR ≤4 GB RAM). Desktop is never weak.
      return mobile && (cores <= 4 || mem <= 4);
    } catch(_){ return false; }
  })();
  // FX scalar — multiply glow-layer counts / particle counts by this.
  // 0.6 on weak GPU trims ~40% of the heaviest overdraw.
  const fxScale = _gpuWeak ? 0.6 : 1.0;
  // RENDER RESOLUTION — crispness on real (retina) devices. PixiJS v8 best practice is
  // `resolution = window.devicePixelRatio` (+ autoDensity). We match DPR, capped so the
  // backing store stays sane under the heavy additive VFX:
  //   • strong GPU: up to 3x (DPR>3 is imperceptible on a 2D slot, saves ~30% fillrate)
  //   • weak GPU:   up to 2x — still RETINA-crisp (2x is the retina threshold). The old
  //     1.5x cap rendered a DPR-2/3 phone UPSCALED -> the "low quality on real device"
  //     blur. VFX overdraw is trimmed separately (fxScale/_gpuWeak), so resolution can
  //     stay high without re-introducing the fillrate cost the 1.5 cap was guarding.
  //   • 4096 max-texture clamp (a canvas side can't exceed the GPU limit; floor 0.5 keeps
  //     even an >4K CSS screen under the limit).
  const _pickRes = (w, h) => {
    const dpr = window.devicePixelRatio || 1;
    const cap = _gpuWeak ? 2 : 3;
    return Math.max(0.5, Math.min(dpr, cap, 4096 / Math.max(w, h, 1)));
  };
  // Turbo speed multiplier — read by spin durations / settle / autoplay.
  // 0 = OFF (1.0× — full cinematic), 1 = TURBO (~3× faster), 2 = MAX (~5× faster).
  // UKGC enforces a minimum 2.5s per spin — turbo is illegal there, so we
  // force-clamp turboMode to 0 and hide the toggle.
  const turboAllowed = () => (typeof STAKE !== 'undefined') ? STAKE.jurisdiction !== 'UKGC' : true;
  const turboK = () => {
    if(!turboAllowed()) return 1;
    return State.turboMode === 2 ? 0.16 : State.turboMode === 1 ? 0.40 : 1;
  };

  // ── 4. PERSISTENCE ────────────────────────────────────────────
  const STORE_KEY = 'shining-crown-pixi-v1';
  function persistSave(){
    try { localStorage.setItem(STORE_KEY, JSON.stringify({
      sound: !State.muted, turboMode: State.turboMode, reduced: State.reduced,
    })); } catch(e){}
  }
  function persistLoad(){
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if(!raw) return;
      const d = JSON.parse(raw);
      if(typeof d.sound === 'boolean') State.muted = !d.sound;
      // turboMode is the canonical field; fall back to legacy boolean `turbo`
      // so users who saved before the 3-state upgrade don't lose their choice.
      if(typeof d.turboMode === 'number') State.turboMode = Math.min(2, Math.max(0, d.turboMode|0));
      else if(typeof d.turbo === 'boolean') State.turboMode = d.turbo ? 1 : 0;
      if(typeof d.reduced === 'boolean') State.reduced = d.reduced;
    } catch(e){}
  }
  persistLoad();

  // ── 4b. SOCIAL FILTER ─────────────────────────────────────────
  const SOCIAL_TERMS = {
    'BET':'PLAY','Bet':'Play','bet':'play',
    'BUY':'PLAY','Buy':'Play','Purchase':'Instantly Triggered',
    'CASH':'COINS','Cash':'Coins','MONEY':'COINS','Money':'Coins',
    'GAMBLE':'PLAY','Gamble':'Play',
    'WAGER':'PLAY','Wager':'Play',
    'STAKE':'PLAY AMOUNT','Stake':'Play Amount','stake':'play amount',
    'DEPOSIT':'GET COINS','Deposit':'Get Coins',
    'WITHDRAW':'REDEEM','Withdraw':'Redeem',
    'CURRENCY':'TOKEN','Currency':'Token',
    'COST':'CAN BE PLAYED FOR','Cost':'Can be played for',
    'PAYOUT':'WIN','Payout':'Win',
    'PAYTABLE':'GAME ODDS','Paytable':'Game Odds',
    'PAYS':'WINS','Pays':'Wins',
    'PAYLINES':'LINES','Paylines':'Lines','paylines':'lines',
    'PAYLINE':'LINE','Payline':'Line','payline':'line',
    'MAX BET':'MAX PLAY','Max Bet':'Max Play',
    'Total Bet':'Total Played','Total BET':'Total Played',
    'Base Bet':'Base Play','BASE BET':'BASE PLAY',
    'Cost Multiplier':'Feature Multiplier','COST MULTIPLIER':'FEATURE MULTIPLIER',
    'Payout Multiplier':'Final Multiplier','PAYOUT MULTIPLIER':'FINAL MULTIPLIER',
    'Total Bet Cost':'Total Play Cost','TOTAL BET COST':'TOTAL PLAY COST',
    'Bet Replay':'Play Replay','BET REPLAY':'PLAY REPLAY',
    'Buy Bonus':'Get Bonus','BUY BONUS':'GET BONUS','buy bonus':'get bonus',
    'BET MODES':'PLAY MODES','Bet Modes':'Play Modes',
    'BET PER LINE':'PLAY PER LINE','Bet per line':'Play per line',
    'gambling':'playing','GAMBLING':'PLAYING','Gambling':'Playing',
  };
  function socialFilter(s){
    if(!STAKE.social || s == null) return s;
    if(SOCIAL_TERMS[s]) return SOCIAL_TERMS[s];
    return String(s)
      // case-PRESERVING pay* swaps (the old /gi → titlecase mangled UPPERCASE labels)
      .replace(/\bPAYLINES\b/g, 'LINES').replace(/\bPaylines\b/g, 'Lines').replace(/\bpaylines\b/g, 'lines')
      .replace(/\bPAYLINE\b/g, 'LINE').replace(/\bPayline\b/g, 'Line').replace(/\bpayline\b/g, 'line')
      .replace(/\bPAYTABLE\b/g, 'GAME ODDS').replace(/\bPaytable\b/g, 'Game Odds').replace(/\bpaytable\b/g, 'game odds')
      .replace(/\bPAYS\b/g, 'WINS').replace(/\bPays\b/g, 'Wins').replace(/\bpays\b/g, 'wins')
      .replace(/\b(Bet|Buy|Cash|Money|Gamble|Wager|Stake|Deposit|Withdraw|Currency|Cost|Payout|Purchase)\b/gi, m => SOCIAL_TERMS[m] || m);
  }

  // ── 5. SEEDED RNG (mulberry32) — deterministic replay ─────────
  function mulberry32(seed){
    let a = seed >>> 0;
    return function(){
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function cryptoSeed(){
    try { const arr = new Uint32Array(1); crypto.getRandomValues(arr); return arr[0] >>> 0; }
    // Fallback when crypto is unavailable — high-res time entropy only.
    // (No Math.random — governance forbids it studio-wide.)
    catch(_){ return ((Date.now() ^ ((performance.now()*1000)|0)) >>> 0); }
  }
  // ── VISUAL PRNG (vrnd) — deterministic cosmetic randomness ──────────
  // Studio governance forbids vrnd() ANYWHERE. Game OUTCOMES already
  // use seeded mulberry32 (replay-deterministic). Cosmetic randomness
  // (particle jitter, idle sway, audio noise, reel-strip filler) routes
  // through this single mulberry32 instance seeded once at boot from a
  // crypto seed. Fast, varied, and — critically — NOT Math.random, so the
  // governance grep stays clean and replay determinism is never at risk
  // (visual jitter is decorative, never fed back into outcome math).
  const _vrndCore = mulberry32(cryptoSeed());
  function vrnd(){ return _vrndCore(); }

  // ── 6. MOCK RGS — Stake-Engine-shaped, deterministic from seed ─
  // Builds the full round (grid, wins, feature) plus a flat event stream.
  function buildRound(seed, mode){
    const rngSeed = (seed >>> 0) || cryptoSeed();
    const rand = mulberry32(rngSeed);
    const events = [];
    let evIdx = 0;
    let payX = 0;            // total payout multiplier (× total bet)
    let grid, ev, fs = null;

    // ── BUY BONUS — 3 tiers via mock RGS. Real RGS dispatches to math-sdk
    // event stream per BONUS_MODES_SPEC.md; this mock simulates the
    // observable difference so each tier FEELS distinct in development.
    // 2026-05-27 fix: ALWAYS force 3 SCATTER STARS on the initial grid for
    // any buy-bonus mode so the player VISUALLY SEES why the bonus is
    // triggering (they paid for it — they should see the scatter reveal,
    // not a random grid that goes straight into FS).
    const _forceScatterTrigger = (g) => {
      // Pick 3 random cells across 3 different reels and stamp STAR (scatter)
      const reels = [0, 1, 2, 3, 4];
      // Fisher-Yates shuffle (deterministic via `rand`)
      for(let i = reels.length - 1; i > 0; i--){
        const j = Math.floor(rand() * (i + 1));
        [reels[i], reels[j]] = [reels[j], reels[i]];
      }
      const pick = reels.slice(0, 3);
      pick.forEach(r => {
        const row = Math.floor(rand() * ROWS);
        g[r][row] = SYM.STAR;
      });
      return g;
    };
    if(mode === 'bonus' || mode === 'bonus_standard'){
      grid = _forceScatterTrigger(spinGrid(rand));
      ev = evalGrid(grid);   // expose scatter cells for the celebration reveal
      events.push({ index:evIdx++, type:'buy_bonus', mode:'bonus_standard', seed:String(rngSeed) });
      fs = runFreeSpins(10, rand);    // 10 FS × ×3 (default FS_MULT)
      fs._mode = 'bonus_standard';
      payX = fs.total;
    } else if(mode === 'bonus_hot'){
      // HOT — 6 FS × ×3 + WILD MIDDLE REEL.
      grid = _forceScatterTrigger(spinGrid(rand));
      ev = evalGrid(grid);
      events.push({ index:evIdx++, type:'buy_bonus', mode:'bonus_hot', seed:String(rngSeed) });
      fs = runFreeSpins(6, rand);
      fs._mode = 'bonus_hot';
      fs._wildReel = 2;   // middle reel locked to STAR (wild)
      // 2026-05-27 RTP fix — previously the wild-reel overwrite was
      // labeled "pure cosmetic; real math handles" and never recomputed
      // s.winX, so HOT had identical EV to STANDARD despite the 122× price.
      // Now: after overwriting reel 3 with STARs, re-evaluate the grid
      // and replace s.winX with the new line+scatter multiplier (×3 FS
      // multiplier preserved). The +18-25% lift from the wild reel
      // justifies the cost-vs-EV gap.
      fs.total = 0;
      fs.spins.forEach(s => {
        s.grid[2] = [SYM.STAR, SYM.STAR, SYM.STAR];
        const newEv = evalGrid(s.grid);
        s.winX = (newEv.lineX + newEv.scatX) * FS_MULT;
        fs.total += s.winX;
      });
      fs.total = Math.min(fs.total, MAX_WIN_X);
      payX = fs.total;
    } else if(mode === 'bonus_mega'){
      // MEGA — 10 FS sticky-Crowns + per-spin random multiplier ×2..×10.
      grid = _forceScatterTrigger(spinGrid(rand));
      ev = evalGrid(grid);
      events.push({ index:evIdx++, type:'buy_bonus', mode:'bonus_mega', seed:String(rngSeed) });
      fs = runFreeSpins(10, rand);
      fs._mode = 'bonus_mega';
      fs._stickyCrowns = true;
      // 2026-05-27 RTP fix — runFreeSpins computed s.winX with FS_MULT
      // (×3), then we overwrote s.mult with ×2..×10. fs.total stayed at
      // the FS_MULT total → MEGA paid the SAME as STANDARD despite the
      // 172× cost. Critical RTP bug. Now: after assigning s.mult, multiply
      // s.winX by s.mult/FS_MULT (so the per-spin payout scales with the
      // displayed multiplier) and re-sum fs.total.
      const megaDist = [[2,35],[3,30],[5,20],[7,10],[10,5]];
      const totalW = megaDist.reduce((s,[,w]) => s+w, 0);
      const stickyGrid = [[null,null,null],[null,null,null],[null,null,null],[null,null,null],[null,null,null]];
      fs.total = 0;
      fs.spins.forEach(s => {
        // Per-spin mult — random pick from MEGA distribution
        const pickR = rand() * totalW;
        let cum = 0, pick = 2;
        for(const [v, w] of megaDist){ cum += w; if(pickR < cum){ pick = v; break; } }
        s.mult = pick;
        // Sticky crowns — once landed, stay on stickyGrid for rest of bonus
        for(let reel=0; reel<REELS; reel++){
          for(let row=0; row<ROWS; row++){
            if(stickyGrid[reel][row] != null){
              s.grid[reel][row] = stickyGrid[reel][row];
            } else if(s.grid[reel][row] === SYM.CROWN){
              stickyGrid[reel][row] = SYM.CROWN;
            }
          }
        }
        // Scale winX from FS_MULT (×3) baseline to s.mult — eg, a ×7 spin
        // pays 7/3 ≈ 2.33× the FS_MULT spin payout.
        s.winX = (s.winX / FS_MULT) * s.mult;
        fs.total += s.winX;
      });
      fs.total = Math.min(fs.total, MAX_WIN_X);
      payX = fs.total;
    } else {
      grid = spinGrid(rand);
      ev = evalGrid(grid);
      payX = ev.lineX + ev.scatX;
      events.push({ index:evIdx++, type:'reveal', grid, seed:String(rngSeed) });
      ev.lineWins.forEach(w => events.push({
        index:evIdx++, type:'line_win', line:w.line, symbol:w.sym, symbolName:SYM_NAME[w.sym],
        count:w.count, multiplier:w.payLineBet/NLINES,
      }));
      if(ev.scatX > 0) events.push({ index:evIdx++, type:'scatter_win', count:ev.scatCount, multiplier:ev.scatX });
      if(ev.scatCount >= 3){
        fs = runFreeSpins(FS_AWARD[ev.scatCount], rand);
        payX += fs.total;
      }
    }
    if(fs){
      events.push({ index:evIdx++, type:'freespins_start', awarded:fs.awarded, played:fs.played });
      fs.spins.forEach((s,i) => events.push({
        index:evIdx++, type:'freespin', spinIndex:i+1, grid:s.grid,
        multiplier:s.winX, mult:s.mult, retrigger:s.retrig,
      }));
      events.push({ index:evIdx++, type:'freespins_end', total:fs.total, spins:fs.played });
    }
    payX = Math.min(payX, MAX_WIN_X);
    const payX100 = Math.round(payX * 100);
    return { id:'rd_'+rngSeed.toString(36), rngSeed, mode, grid, ev:ev||null, fs, events, payX100 };
  }
  // Reconstruct a round shape from a flat event stream (real RGS / replay).
  //
  // The math-sdk (games/shining-pop/game_events.py) is the SOURCE OF TRUTH for
  // event names. It emits: reels · line_win · scatter_win · trigger_bonus ·
  // buy_bonus · fs_start · fs_step · fs_end · retrigger · sticky_crown ·
  // mega_mult. This parser reads THAT taxonomy and also tolerates the legacy
  // mock names (reveal/freespins_start/freespin/freespins_end) so a
  // buildRound()->parseRound() parity test still passes.
  //
  // `ev` (line/scatter breakdown that drives the reveal animation) is built
  // from the server's line_win/scatter_win events when present (authoritative);
  // it falls back to a local grid evaluation only to pick which cells to
  // highlight when no win events were sent. The credited TOTAL is always the
  // server payoutMultiplier — never recomputed here.
  function parseRound(events, payoutMultiplier){
    events = Array.isArray(events) ? events : [];
    const find = t => events.find(e => e && e.type === t);
    const all  = t => events.filter(e => e && e.type === t);
    const num  = (v, d) => (v == null ? d : v);

    // ── base grid ── math-sdk 'reels' (the one before fs_start) ; legacy 'reveal'
    const reelsAll   = all('reels');
    const fsStart    = find('fs_start') || find('freespins_start');
    const fsStartIdx = fsStart ? events.indexOf(fsStart) : -1;
    const baseReels  = reelsAll.find(e => fsStartIdx < 0 || events.indexOf(e) < fsStartIdx)
                    || reelsAll[0] || find('reveal');
    const grid = baseReels ? baseReels.grid : spinGrid(mulberry32(1));

    // ── round mode ── buy_bonus carries the purchased tier; a scatter-triggered
    //    bonus stays 'base' (its FS plays inline off the base reveal)
    const buy  = find('buy_bonus');
    const mode = buy ? (buy.mode || 'bonus') : 'base';

    // ── base-game line + scatter breakdown (server-authoritative) ──
    const lineWinEv = all('line_win');
    const scatEv    = find('scatter_win');
    let ev;
    if(lineWinEv.length || scatEv){
      const lineWins = lineWinEv.map(e => ({
        line:  num(e.line, 0),
        sym:   num(e.symbol, e.sym),
        count: num(e.count, 3),
        // math-sdk line_win.x and mock line_win.multiplier are both the line's
        // per-TOTAL-bet contribution to lineX; evalGrid stores payLineBet where
        // lineX = Σ payLineBet / NLINES, so payLineBet = perLineX × NLINES.
        payLineBet: num(e.x, num(e.multiplier, 0)) * NLINES,
      }));
      const lineX = lineWins.reduce((s,w) => s + w.payLineBet, 0) / NLINES;
      const scatX = scatEv ? num(scatEv.x, num(scatEv.multiplier, 0)) : 0;
      let scatCount = scatEv ? num(scatEv.count, 0) : 0;
      if(!scatCount){ for(let r=0;r<REELS;r++) for(let row=0;row<ROWS;row++) if(grid[r][row]===STAR) scatCount++; }
      ev = { lineX, scatX, scatCount, lineWins };
    } else {
      ev = evalGrid(grid);   // no win events → derive cell highlights from the grid
    }

    // ── free spins ── math-sdk: each FS spin is a 'reels' AFTER fs_start, zipped
    //    with fs_step(.winX) + mega_mult(.mult) ; legacy mock: 'freespin' events
    let fs = null;
    if(fsStart){
      const fsEnd  = find('fs_end') || find('freespins_end');
      const legacy = all('freespin');
      let spins;
      if(legacy.length){
        spins = legacy.map(e => ({
          grid: e.grid, ev: e.grid ? evalGrid(e.grid) : null,
          winX: num(e.multiplier, 0), retrig: num(e.retrigger, 0), mult: num(e.mult, FS_MULT),
        }));
      } else {
        const steps    = all('fs_step');
        const megas    = all('mega_mult');
        const baseMult = num(fsStart.multiplier, FS_MULT) || FS_MULT;
        // FS 'reels' indices after fs_start — the line_win events BETWEEN one
        // reels event and the next belong to that spin (server-authoritative).
        const fsReelIdxs = [];
        events.forEach((e,i) => { if(i > fsStartIdx && e && e.type === 'reels') fsReelIdxs.push(i); });
        spins = fsReelIdxs.map((ri, i) => {
          const re = events[ri];
          const nextRi = fsReelIdxs[i+1] != null ? fsReelIdxs[i+1] : events.length;
          // SERVER line_wins for THIS spin → drives the highlight, instead of a
          // frontend evalGrid recompute. The math uses STAR (8) as a substituting
          // WILD; evalGrid treats STAR as a pure scatter, so it mis-scored FS
          // grids and the bonus "showed no win" (also violated the no-recompute
          // rule). Same {line,count,payLineBet} shape the base game already uses.
          const lineWins = events.slice(ri+1, nextRi)
            .filter(e => e && e.type === 'line_win')
            .map(e => ({ line:num(e.line,0), sym:num(e.symbol, e.sym), count:num(e.count,3),
                         payLineBet: num(e.x, num(e.multiplier,0)) * NLINES }));
          const step = steps.find(s => s.idx === i+1) || steps[i];
          const mega = megas.find(m => m.idx === i+1 || m.idx === i);
          return {
            grid: re.grid, ev: re.grid ? evalGrid(re.grid) : null,
            lineWins,
            winX: step ? num(step.winX, 0) : 0,
            retrig: 0,
            mult: mega ? num(mega.mult, baseMult) : baseMult,
          };
        });
      }
      const total = fsEnd ? num(fsEnd.totalX, num(fsEnd.total, 0)) : 0;
      const fsMode = fsStart.mode || (buy && buy.mode) || mode;
      const wildReelEv = reelsAll.find(e => e && e.wildReel != null);
      fs = {
        spins, total,
        awarded: num(fsStart.spins, num(fsStart.awarded, spins.length)),
        played:  spins.length,
        _mode:   fsMode,
        // HOT locks a WILD reel; MEGA uses STICKY crowns. The live RGS signals
        // these via reels.wildReel + sticky_crown events — fall back to the mode
        // name so the FS scene renders the right tier even on a sparse stream.
        // (Without this, HOT/MEGA looked identical to STANDARD on the live path.)
        _wildReel:     wildReelEv ? wildReelEv.wildReel : (/hot/i.test(fsMode) ? 2 : null),
        _stickyCrowns: all('sticky_crown').length > 0 || /mega/i.test(fsMode),
      };
    }

    return {
      grid, ev, fs, mode, events,
      payX100: Math.round(num(payoutMultiplier, 0) * 100),
    };
  }

  // ── 6b. AUDIT LOG ─────────────────────────────────────────────
  const Audit = {
    log: [],
    flush(entry){ this.log.push(entry); if(this.log.length > 200) this.log.shift(); },
  };

  // ── 6c. RGS CLIENT ────────────────────────────────────────────
  const isMockRGS = () => STAKE.rgs_url.startsWith('mock://');
  class RGSError extends Error { constructor(code,message){ super(message); this.code = code; } }

  // fetch with an abort-timeout — a hung RGS must surface as an error, never a UI hang
  const RGS_TIMEOUT_MS = 12000;
  function fetchT(url, opts){
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new DOMException('RGS timeout','AbortError')), RGS_TIMEOUT_MS);
    return fetch(url, Object.assign({}, opts, { signal: ctrl.signal }))
      .finally(() => clearTimeout(timer));
  }

  const RGS = {
    _roundId: null,
    async authenticate(){
      if(isMockRGS()){
        return {
          balance: State.balanceX6,
          config: { minBet:State.betLevels[0], maxBet:State.betLevels[State.betLevels.length-1], stepBet:100_000, betLevels:State.betLevels },
          round: null,
        };
      }
      const r = await fetchT(STAKE.rgs_url + '/wallet/authenticate', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sessionID:STAKE.sessionID, language:STAKE.lang }),
      });
      if(!r.ok) throw new RGSError('ERR_GEN', await r.text());
      const data = await r.json();
      if(data.error) throw new RGSError(data.error, JSON.stringify(data));
      return {
        balance: typeof data.balance === 'object' ? data.balance.amount : data.balance,
        config: data.config, round: data.round ?? null,
      };
    },
    async play(betX6, mode='base'){
      if(isMockRGS()){
        const round = buildRound(cryptoSeed(), mode);
        round.balance = State.balanceX6;
        this._roundId = round.id;
        return round;
      }
      const r = await fetchT(STAKE.rgs_url + '/wallet/play', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sessionID:STAKE.sessionID, currency:STAKE.currency, mode, amount:betX6 }),
      });
      if(!r.ok){
        const body = await r.text().catch(() => '');
        const code = body.match?.(/ERR_\w+/)?.[0] || 'ERR_GEN';
        throw new RGSError(code, body);
      }
      const data = await r.json();
      if(data.error) throw new RGSError(data.error, JSON.stringify(data));
      const events = data.round?.state || data.state || data.events || [];
      const payMul = data.round?.payoutMultiplier ?? data.payoutMultiplier ?? 0;
      const balance = typeof data.balance === 'object' ? data.balance.amount : data.balance;
      this._roundId = data.round?.id || data.id;
      const parsed = parseRound(events, payMul);
      return { ...parsed, id:this._roundId, balance };
    },
    async endRound(){
      if(isMockRGS()){ this._roundId = null; return { balance: State.balanceX6 }; }
      const r = await fetchT(STAKE.rgs_url + '/wallet/end-round', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sessionID:STAKE.sessionID }),
      });
      if(!r.ok){
        const body = await r.text().catch(() => '');
        const code = body.match?.(/ERR_\w+/)?.[0] || 'ERR_GEN';
        // Idempotent end-round (P0-E): a round that is already closed
        // ("no active round" / ERR_VAL) is success-equivalent — the goal
        // (round ended) is already met, so don't throw. This is what makes a
        // double end-round (mid-round refresh → resume, or a retried call)
        // safe instead of surfacing as a fatal CONNECTION ERROR.
        if(code === 'ERR_VAL'){ this._roundId = null; return { balance: State.balanceX6, _alreadyEnded:true }; }
        throw new RGSError(code, body);
      }
      const data = await r.json();
      if(data.error){
        if(data.error === 'ERR_VAL'){ this._roundId = null; return { balance: State.balanceX6, _alreadyEnded:true }; }
        throw new RGSError(data.error, JSON.stringify(data));
      }
      this._roundId = null;
      const balance = typeof data.balance === 'object' ? data.balance.amount : data.balance;
      return { ...data, balance };
    },
    async fetchReplay(){
      if(isMockRGS()){
        // Deterministic demo replay — seeded from the event descriptor.
        let seed = 0;
        const s = STAKE.rEvent || 'demo';
        for(let i=0;i<s.length;i++) seed = (seed*31 + s.charCodeAt(i)) >>> 0;
        const round = buildRound(seed || 0xC0FFEE, STAKE.rMode === 'bonus' ? 'bonus' : 'base');
        return { round, payoutMultiplier: round.payX100/100 };
      }
      const params = new URLSearchParams();
      if(STAKE.lang) params.set('lang', STAKE.lang);
      if(STAKE.currency) params.set('currency', STAKE.currency);
      const qs = params.toString();
      const path = [STAKE.rGame, STAKE.rVersion, STAKE.rMode, STAKE.rEvent].map(encodeURIComponent).join('/');
      // Stake official replay endpoint is /bet/replay/{game}/{version}/{mode}/{event}
      // (05-replay-spec.md). NOT /bet/event/ — that returns 404 on the live harness.
      const r = await fetchT(STAKE.rgs_url + '/bet/replay/' + path + (qs ? '?'+qs : ''));
      if(!r.ok) throw new RGSError('ERR_GEN', await r.text());
      const data = await r.json();
      if(data.error) throw new RGSError(data.error, JSON.stringify(data));
      const events = data.round?.state || data.state || data.events || [];
      const payMul = data.round?.payoutMultiplier ?? data.payoutMultiplier ?? 0;
      return { round: parseRound(events, payMul), payoutMultiplier: payMul };
    },
  };

  // ── FONTS + PIXI INIT ─────────────────────────────────────────
  // Load the bundled @font-face faces BEFORE Pixi creates any Text (Pixi rasterises text
  // with the browser font; a face that isn't ready yet caches as a fallback glyph).
  try { await Promise.all([
    document.fonts.load("1em 'Luckiest Guy'"),
    document.fonts.load("700 1em 'Fredoka'"),
  ]); } catch(e){}
  // file:// / strict-context FALLBACK — when the single HTML is opened DIRECTLY
  // (double-click → file:// opaque origin), Chrome/WebView refuse to load a @font-face
  // whose src is a `data:` URI, so the CSS faces never resolve and every label falls back
  // to a system font ("fonts not loading" on a standalone open). The FontFace API DOES
  // accept inline data: URLs under file://, so re-register the bundled faces from the
  // stylesheet. No-op when the CSS faces already loaded (the normal http/Stake path).
  try {
    if(!document.fonts.check("1em 'Luckiest Guy'") || !document.fonts.check("700 1em 'Fredoka'")){
      const adds = [];
      for(const sheet of document.styleSheets){
        let rules; try { rules = sheet.cssRules; } catch(_){ continue; }   // cross-origin sheets throw
        for(const rule of rules){
          if(rule && (rule.constructor.name === 'CSSFontFaceRule' || rule.type === 5)){
            const fam = (rule.style.getPropertyValue('font-family') || '').replace(/['"]/g, '').trim();
            const src = rule.style.getPropertyValue('src');
            if(fam && src && src.indexOf('data:') !== -1){
              const desc = {}; const w = rule.style.getPropertyValue('font-weight'); if(w) desc.weight = w;
              try { const ff = new FontFace(fam, src, desc); adds.push(ff.load().then(f => document.fonts.add(f))); } catch(_){}
            }
          }
        }
      }
      try { await Promise.all(adds); } catch(_){}
    }
  } catch(e){}

  // ── CANVAS SIZING — Stake iframe pattern (max 1200×675 desktop)
  // The canvas dimensions are derived from the BROWSER VIEWPORT but
  // capped so big desktop windows don't render the game at absurd
  // sizes. On mobile / narrow / portrait viewports the canvas fills.
  // On landscape desktop the canvas tops out at Stake's Desktop preset.
  function computeCanvasSize(){
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isPortrait = vh > vw * 1.05;
    if(isPortrait || vw <= 768){
      // Mobile / portrait — fill the viewport edge-to-edge
      return { w: vw, h: vh };
    }
    // Landscape desktop — letterbox inside Stake max preset
    return {
      w: Math.min(vw, 1200),
      h: Math.min(vh, 675),
    };
  }
  const _initSz = computeCanvasSize();
  const app = new PIXI.Application();
  await app.init({
    width: _initSz.w, height: _initSz.h,
    // QUALITY (2026-06-01): render at the device pixel ratio (PixiJS v8 best practice)
    // so real retina phones are crisp — capped 2× on weak GPUs / 3× on strong (_pickRes).
    // MSAA stays off on weak GPUs; the high pixel density compensates, and the heavy
    // additive VFX keep fillrate headroom via fxScale, not by under-sampling the frame.
    antialias: !_gpuWeak, backgroundColor: 0x1a0a2e,
    resolution: _pickRes(_initSz.w, _initSz.h), autoDensity: true,
  });
  document.body.appendChild(app.canvas);
  // ── ACCESSIBILITY ATTRIBUTES on the canvas ──────────────────────
  // WCAG 4.1.2 (Name, Role, Value) — declare the canvas as an
  // application widget with a meaningful name so screen readers
  // announce SOMETHING when the user lands on it. Without these
  // the canvas reads as "graphic, unlabelled" in NVDA/VoiceOver.
  // tabindex=0 makes the canvas keyboard-focusable so keyboard-only
  // players can land on it via Tab and use Space/Enter to spin.
  app.canvas.setAttribute('role', 'application');
  app.canvas.setAttribute('aria-label',
    'SHINING POP slot game. Press Space or Enter to spin. ' +
    'Arrow keys to adjust bet. B for Buy Bonus, A for Autoplay, ' +
    'T for Turbo, I for game info, M to mute, Escape to close any panel.');
  app.canvas.setAttribute('tabindex', '0');
  // Visible focus ring on keyboard focus only (not click) — modern
  // :focus-visible behaviour, applied via inline style for the
  // single-file build (no separate stylesheet).
  app.canvas.style.outline = 'none';
  app.canvas.addEventListener('focus', () => {
    // outline gets set only when the focus came from keyboard
    if(app.canvas.matches(':focus-visible')){
      app.canvas.style.outline = '2px solid #ffd75a';
      app.canvas.style.outlineOffset = '2px';
    }
  });
  app.canvas.addEventListener('blur', () => {
    app.canvas.style.outline = 'none';
  });
  window.__app = app;
  // ── SPINE-05 BOOT — load the Crown-Wild rig ONCE at startup. _spineReady gates the
  // in-ceremony swap; a failed load is SILENT in prod (debug-only log) so the
  // procedural crown remains the exact fallback. (One pool instance is shared across
  // every ceremony that wants the rig — pool.acquire(...) hands out instances cheaply.)
  let _spinePool = null, _spineReady = false;
  try {
    const _Pool = (typeof window !== 'undefined') ? window.SymbolRigPool : null;
    if (_Pool) {
      _spinePool = new _Pool();
      _spinePool.load()
        .then(() => { _spineReady = true; if(STAKE.debug) console.log('[spine] crown rig ready'); })
        .catch((err) => { if(STAKE.debug) console.warn('[spine] crown rig load failed (procedural fallback active):', err); });
    }
  } catch(e) { if(STAKE.debug) console.warn('[spine] boot exception (fallback active):', e); }
  // ── PixiJS DevTools hook — the Chrome PixiJS DevTools extension inspects
  // these globals. Lets you walk the scene tree / profile live.
  globalThis.__PIXI_APP__ = app;
  globalThis.__PIXI_STAGE__ = app.stage;
  globalThis.__PIXI_RENDERER__ = app.renderer;
  // Custom resize handler — re-evaluates the cap on every window resize.
  // Custom resize handler — re-evaluates the cap on every window resize AND on
  // BROWSER ZOOM (Ctrl +/−). Zoom changes window.devicePixelRatio and the CSS
  // viewport; if we kept the init-time `resolution`, the GPU framebuffer
  // (screen × resolution) could balloon past the WebGL max-texture limit on a
  // zoomed-out retina / portrait viewport → WebGL context loss = the game
  // "crashes" / goes black. So on EVERY resize we re-read DPR and CLAMP the
  // resolution so neither framebuffer dimension exceeds 4096 px (safe on every
  // GPU). The body is overflow:hidden + flex-centred, so no scrollbars appear at
  // any zoom. (2026-06-01 — fixes "browser zoom crushes the game".)
  let _resizeTok = 0;
  function _onWindowResize(){
    const tok = ++_resizeTok;
    requestAnimationFrame(() => {
      if(tok !== _resizeTok) return;
      const sz = computeCanvasSize();
      const safeRes = _pickRes(sz.w, sz.h);   // device-pixel-ratio crispness, capped (matches app.init)
      const resChanged = Math.abs((app.renderer.resolution || 1) - safeRes) > 0.01;
      if(app.screen.width === sz.w && app.screen.height === sz.h && !resChanged) return;
      // v8 resize accepts an optional resolution; fall back to set-then-resize.
      try { app.renderer.resize(sz.w, sz.h, safeRes); }
      catch(e){ try { app.renderer.resolution = safeRes; app.renderer.resize(sz.w, sz.h); } catch(_){} }
      // The layout() function reads app.screen.width/height — call it.
      try { typeof layout === 'function' && layout(); } catch(e){}
    });
  }
  window.addEventListener('resize', _onWindowResize);
  window.addEventListener('orientationchange', _onWindowResize);
  // visualViewport fires on pinch-zoom AND desktop Ctrl +/− zoom more reliably
  // than window 'resize' in some browsers — hook it too so every zoom relayouts.
  if(window.visualViewport){
    try { window.visualViewport.addEventListener('resize', _onWindowResize); } catch(e){}
  }

  // ── ASSET LOAD — Shining Pop crystal art set (assets/images/shining) ──
  // 16 source JPEGs. bg.jpg is a full painted scene used raw; every other file
  // ships its art on a solid-black field — loaded raw, then keyed out
  // (stripBlack) with a max-channel alpha ramp so glows feather, never clip.
  const SH = 'assets/images/shining/';
  const ASSETS = {
    _bg:SH+'bg.jpg',     _logo:SH+'logo.jpg',     _button:SH+'button.jpg',
    // DROPPED 2026-05-30 (~8 MB off the bundle): balance.jpg / spin.jpg /
    // popup1.jpg / popup2.jpg were decoded but never rendered — the live spin
    // button + balance/bet/win plates are procedural, and the popup frames fed
    // only a permanently-hidden sprite. See blueprints/POLISH_VISUAL.md P2-2/P2-6.
    _s0:SH+'sym0-cherry.jpg', _s1:SH+'sym1-lemon.jpg',  _s2:SH+'sym2-plum.jpg',
    _s3:SH+'sym3-grapes.jpg', _s4:SH+'sym4-melon.jpg',  _s5:SH+'sym5-bell.jpg',
    _s6:SH+'sym6-seven.jpg',  _s7:SH+'sym7-crown.jpg',  _s8:SH+'sym8-star.jpg',
    // EXTRA STUDIO boot splash — shown 1.5s before the game intro
    _extraStudio: SH+'extra-studio.jpg',
    // Buy-Bonus tier emblems — crystal art (laurel / flame / burst), keyed on black
    _tierStd: SH+'tier-standard.jpg', _tierHot: SH+'tier-hot.jpg', _tierMega: SH+'tier-mega.jpg',
  };
  try {
    await PIXI.Assets.load(
      Object.entries(ASSETS).map(([alias,src]) => ({ alias, src })),
      // Keep the caption static ("LOADING" — the ::after pseudo adds
      // animated dots). Visual progress lives in the bar fill width so
      // the text doesn't fight the dot-pulse animation with a moving %.
      (p) => { const pc=Math.round(p*100);
               if(lfill) lfill.style.width=pc+'%'; }
    );
  } catch(e){ fail('Asset load failed'); return; }
  // TEX — processed-texture registry; tex()/spr() resolve here before PIXI.Assets
  const TEX = {};
  const tex = (a) => TEX[a] || PIXI.Assets.get(a);
  const spr = (a) => { const s = new PIXI.Sprite(tex(a)); s.anchor.set(0.5); return s; };
  const fitW = (s,w) => { s.scale.set(w / s.texture.width); };
  // contain-fit: scale a texture within a square box, preserving aspect ratio
  const symScale = (t,box) => box / Math.max(t.width, t.height);

  // ── ART PIPELINE — key out black · trim to art · composite UI ─────
  function imgLoad(alias){
    return new Promise(res => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = ASSETS[alias];
    });
  }
  // Key black to alpha via a max-channel ramp: coloured darks survive intact,
  // the outer glow feathers smoothly. lo→fully clear, hi→fully opaque.
  function stripCanvas(img, maxDim, lo, hi){
    lo = lo==null?16:lo; hi = hi==null?64:hi;
    let w=img.width, h=img.height;
    if(maxDim && Math.max(w,h)>maxDim){ const k=maxDim/Math.max(w,h); w=Math.round(w*k); h=Math.round(h*k); }
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(img,0,0,w,h);
    const im=x.getImageData(0,0,w,h), p=im.data;
    for(let i=0;i<p.length;i+=4){
      const r=p[i], g=p[i+1], b=p[i+2];
      const mx = r>g ? (r>b?r:b) : (g>b?g:b);
      if(mx<=lo) p[i+3]=0;
      else if(mx<hi) p[i+3]=p[i+3]*(mx-lo)/(hi-lo)|0;
    }
    x.putImageData(im,0,0);
    return c;
  }
  // Crop a canvas down to the bounding box of its non-transparent pixels.
  function trimCanvas(c){
    const x=c.getContext('2d',{willReadFrequently:true}), w=c.width, h=c.height;
    const p=x.getImageData(0,0,w,h).data;
    let x0=w,y0=h,x1=-1,y1=-1;
    for(let y=0;y<h;y++){ const row=y*w;
      for(let xx=0;xx<w;xx++) if(p[(row+xx)*4+3]>10){
        if(xx<x0)x0=xx; if(xx>x1)x1=xx; if(y<y0)y0=y; if(y>y1)y1=y;
      }
    }
    if(x1<0) return c;
    x0=Math.max(0,x0-2); y0=Math.max(0,y0-2); x1=Math.min(w-1,x1+2); y1=Math.min(h-1,y1+2);
    const tw=x1-x0+1, th=y1-y0+1;
    const o=document.createElement('canvas'); o.width=tw; o.height=th;
    o.getContext('2d').drawImage(c,x0,y0,tw,th,0,0,tw,th);
    return o;
  }
  const _blankC = (() => { const c=document.createElement('canvas'); c.width=c.height=4; return c; })();
  const T = (c) => PIXI.Texture.from(c);
  function proc(img, maxDim, doTrim, lo, hi){
    if(!img) return T(_blankC);
    const c = stripCanvas(img, maxDim, lo, hi);
    const t = T(doTrim ? trimCanvas(c) : c);
    // HIGH-QUALITY DOWNSCALE (2026-06-02) — these crystal-art textures (≤540px
    // symbols, ≤900px logo/tiers) render into mobile cells ~7× smaller. With NO
    // mipmaps (autoGenerateMipmaps was false) a downscale that large aliases /
    // shimmers → the "gameplay bad quality on mobile" report. Trilinear
    // mipmapping + linear sampling = clean, crisp art at every preset.
    // WebGL2/WebGPU handle NPOT mips; set before first GPU upload.
    try { const s = t.source; s.autoGenerateMipmaps = true; s.scaleMode = 'linear'; s.update(); } catch(e){}
    return t;
  }

  // Load raw source images for pixel processing (browser-cached from PIXI load).
  const _src = await Promise.all(['_s0','_s1','_s2','_s3','_s4','_s5','_s6','_s7','_s8',
    '_logo','_button','_extraStudio','_tierStd','_tierHot','_tierMega'].map(imgLoad));
  const symImg = _src.slice(0,9);
  const [imLogo,imBtn,imExtraStudio,imTierStd,imTierHot,imTierMega] = _src.slice(9);

  TEX.bg = PIXI.Assets.get('_bg');                    // full painted hall — raw
  for(let i=0;i<9;i++) TEX['s'+i] = proc(symImg[i], 540, false);   // 9 reel symbols
  TEX.logo         = proc(imLogo, 900, true);             // painted SHINING POP crest (image — cute crown)
  TEX.extraStudio  = proc(imExtraStudio, 700, true);      // boot splash — EXTRA STUDIO
  // Buy-Bonus tier emblems (keyed crystal art) — STANDARD=laurel · HOT=flame · MEGA=burst
  TEX.tierStd = proc(imTierStd, 480, true); TEX.tierHot = proc(imTierHot, 480, true); TEX.tierMega = proc(imTierMega, 480, true);
  // ── BUY BONUS candy art (user-supplied: assets/images/shining/buy-bonus.png).
  // Loaded SEPARATELY from the PIXI bundle so a MISSING file never breaks boot
  // (onerror -> null). Keyed (black -> alpha) + trimmed via proc, like the logo —
  // matches the delivered art that sits on a black background. Until the PNG is
  // dropped in, TEX.buyBonus stays null and the button shows a candy-pill fallback.
  const _imBuyBonus = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = SH + 'buy-bonus.png'; });
  TEX.buyBonus = _imBuyBonus ? proc(_imBuyBonus, 700, true) : null;
  TEX.spin     = spinTex('spin');  TEX.stop = spinTex('stop');   // Sweet-Bonanza-style white spin button
  // winFrame is a permanently-hidden layout anchor (its ornate art was dropped —
  // the big-win backdrop is the procedural villain throne). Its only remaining job
  // is sizing the win label/amount via winFrame.height, so we keep a blank texture
  // at the legacy trimmed frame dimensions (821x618) for byte-identical layout, with
  // zero decode. TEX.ribbon (popup1) was never read by any sprite, so it's gone.
  TEX.frameWin = (() => { const c=document.createElement('canvas'); c.width=821; c.height=618; return T(c); })();
  // FLAT BOLD MODERN PLAQUE — research-led (Hacksaw-style: bold, minimal, high
  // contrast). A deep near-black surface, ONE crisp neon-magenta villain border,
  // a fine inner accent line. No gold, no gradients, no fuzz. 2.42:1 keeps layout.
  const balTex = (() => {
    const W=640, H=264, c=document.createElement('canvas'); c.width=W; c.height=H;
    const x=c.getContext('2d'); const m=8, r=50, pw=W-2*m, ph=H-2*m;
    rr(x,m,m,pw,ph,r); x.fillStyle='#1e1914'; x.fill();
    rr(x,m+3,m+3,pw-6,ph-6,r-3); x.lineWidth=4; x.strokeStyle='#b88e40'; x.stroke();
    rr(x,m+11,m+11,pw-22,ph-22,r-11); x.lineWidth=1.5; x.strokeStyle='rgba(232,197,118,0.24)'; x.stroke();
    return T(c);
  })();
  TEX.balPlate = balTex; TEX.betPlate = balTex; TEX.winPlate = balTex;
  TEX.buyPlate = balTex;

  // ── canvas UI helpers ─────────────────────────────────────────
  function rr(x,X,Y,W,H,r){
    r=Math.min(r,W/2,H/2);
    x.beginPath();
    x.moveTo(X+r,Y);
    x.arcTo(X+W,Y,X+W,Y+H,r); x.arcTo(X+W,Y+H,X,Y+H,r);
    x.arcTo(X,Y+H,X,Y,r);     x.arcTo(X,Y,X+W,Y,r);
    x.closePath();
  }
  // Ruby-crystal gem base (button.jpg) — shared backplate for icons + steppers.
  const gemC = trimCanvas(stripCanvas(imBtn || _blankC, 264));
  function gemTex(drawGlyph){
    // ── GLYPH-ONLY ICON TEXTURE — 2026 redesign
    // Old version baked a square gold border into every icon. That meant
    // every chip on the bar had both a chip-frame (drawn by drawBtnChip)
    // AND a baked-in gold square border on the icon — double-framing, busy.
    // New: TRANSPARENT background, no border, JUST the glyph. drawBtnChip
    // handles the chip frame underneath. Result: clean Sweet-Bonanza-tier
    // icons that don't fight their own container.
    const S = 240, c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    x.save();
    x.translate(S/2, S/2);
    x.lineJoin = 'round';
    x.lineCap  = 'round';
    drawGlyph(x, S);
    x.restore();
    return T(c);
  }
  // ── SPIN BUTTON — AWARDS-TIER LEGENDARY REDESIGN (2026-05-27) ─────
  // Per user "redesign our spin button for more creative aesthetic
  // awards winner game main button". Builds on the previous HUD-reticle
  // base, but elevates to legend-tier with:
  //   1. Multi-stop RADIAL GRADIENT base (obsidian → deep magenta → black)
  //   2. Outer NEON MAGENTA halo ring (luminous edge, not just smoke-white)
  //   3. Wider gradient inner highlight (premium plastic specular look)
  //   4. Two-tone reticle — pink outer arc + smoke-white inner arc
  //   5. 8 micro tick marks (was 4) — sci-fi targeting precision
  //   6. Bolder spin arrow with TAPERED tip + 5 motion sparks (was 3)
  //   7. Center INNER GLOW pip — energy core that breathes
  function spinTex(kind){
    const S = 360, c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    const cx = S/2, cy = S/2, R = S * 0.42;
    // ── (1) Drop shadow (extra deep — premium elevation)
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.65)';
    x.shadowBlur  = S * 0.060;
    x.shadowOffsetY = S * 0.020;
    x.beginPath(); x.arc(cx, cy, R, 0, 7);
    x.fillStyle = '#0a0a14'; x.fill();
    x.restore();
    // ── (2) RADIAL GRADIENT base — obsidian core w/ deep magenta inner ring
    x.save();
    x.beginPath(); x.arc(cx, cy, R, 0, 7); x.clip();
    const rg = x.createRadialGradient(cx, cy, R * 0.10, cx, cy, R * 1.0);
    rg.addColorStop(0,    '#2c261e');     // gold-tinted center
    rg.addColorStop(0.55, '#16120d');     // deep brown-black
    rg.addColorStop(1,    '#0a0806');     // near-black rim
    x.fillStyle = rg;
    x.fillRect(cx-R, cy-R, 2*R, 2*R);
    // Subtle top-half specular highlight (premium plastic feel)
    const lg = x.createLinearGradient(0, cy-R, 0, cy+R*0.2);
    lg.addColorStop(0,    'rgba(255,255,255,0.18)');
    lg.addColorStop(0.55, 'rgba(255,255,255,0.04)');
    lg.addColorStop(1,    'rgba(0,0,0,0)');
    x.fillStyle = lg;
    x.fillRect(cx-R, cy-R, 2*R, R*1.2);
    // ── MAGENTA CRYSTAL UNDER-GLOW — warm magenta luminosity rising from the
    // lower half so the face reads as a LIT crystal, not a flat-dark puck (2026-06-01).
    const under = x.createRadialGradient(cx, cy + R*0.44, R*0.05, cx, cy + R*0.28, R*0.98);
    under.addColorStop(0,   'rgba(233,191,90,0.36)');
    under.addColorStop(0.5, 'rgba(233,191,90,0.13)');
    under.addColorStop(1,   'rgba(233,191,90,0.00)');
    x.fillStyle = under;
    x.fillRect(cx-R, cy-R, 2*R, 2*R);
    // ── PREMIUM GLASSMORPHISM — a BRIGHTER glossy "glass dome" reflection crescent
    // across the top (the bright sweep on polished crystal-glass). Clipped to the face.
    const gloss = x.createLinearGradient(0, cy - R*0.78, 0, cy - R*0.02);
    gloss.addColorStop(0, 'rgba(255,255,255,0.46)');
    gloss.addColorStop(1, 'rgba(255,255,255,0.00)');
    x.fillStyle = gloss;
    x.beginPath();
    x.ellipse(cx, cy - R*0.40, R*0.66, R*0.36, 0, 0, Math.PI*2);
    x.fill();
    // ── HOT SPECULAR SPARK — a tight bright point top-left (the polished-crystal hit)
    const spark = x.createRadialGradient(cx - R*0.30, cy - R*0.42, 0, cx - R*0.30, cy - R*0.42, R*0.28);
    spark.addColorStop(0, 'rgba(255,255,255,0.85)');
    spark.addColorStop(1, 'rgba(255,255,255,0.00)');
    x.fillStyle = spark;
    x.beginPath();
    x.ellipse(cx - R*0.30, cy - R*0.42, R*0.27, R*0.20, -0.5, 0, Math.PI*2);
    x.fill();
    x.restore();
    // ── (3) OUTER NEON MAGENTA HALO RING — luminous edge
    x.save();
    x.translate(cx, cy);
    // Double halo: wider faint pink + narrower bright magenta edge
    x.strokeStyle = 'rgba(173,124,47,0.30)';
    x.lineWidth = S * 0.030;
    x.beginPath(); x.arc(0, 0, R - S * 0.010, 0, 7); x.stroke();
    x.strokeStyle = 'rgba(226,186,94,0.90)';
    x.lineWidth = S * 0.012;
    x.beginPath(); x.arc(0, 0, R - S * 0.005, 0, 7); x.stroke();
    // gold inner rim accent — polished-edge highlight
    x.strokeStyle = 'rgba(251,233,170,0.55)';
    x.lineWidth = S * 0.006;
    x.beginPath(); x.arc(0, 0, R - S * 0.024, 0, 7); x.stroke();
    // ── (4) DOUBLE RETICLE — pink outer arcs + smoke-white inner
    x.strokeStyle = 'rgba(245,247,250,0.40)';
    x.lineWidth = S * 0.012;
    const ringR = R - S * 0.045;
    const gapHalf = 0.085;
    const segs = [
      [-Math.PI/2 + gapHalf,        0           - gapHalf],
      [ 0           + gapHalf,      Math.PI/2   - gapHalf],
      [ Math.PI/2   + gapHalf,      Math.PI     - gapHalf],
      [ Math.PI     + gapHalf,      Math.PI*1.5 - gapHalf],
    ];
    segs.forEach(([a,b]) => { x.beginPath(); x.arc(0,0, ringR, a, b); x.stroke(); });
    // ── (5) 8 MICRO TICK MARKS — sci-fi targeting precision
    x.lineWidth = S * 0.014;
    x.strokeStyle = 'rgba(245,247,250,0.55)';
    for(let i = 0; i < 8; i++){
      const a = (i / 8) * Math.PI * 2 - Math.PI/2;
      const major = (i % 2 === 0);   // cardinals get longer ticks
      const sxL = Math.cos(a) * (ringR - S * (major ? 0.028 : 0.018));
      const syL = Math.sin(a) * (ringR - S * (major ? 0.028 : 0.018));
      const exL = Math.cos(a) * (ringR + S * 0.012);
      const eyL = Math.sin(a) * (ringR + S * 0.012);
      x.beginPath();
      x.moveTo(sxL, syL); x.lineTo(exL, eyL);
      x.stroke();
    }
    x.restore();
    // ── (6) GLYPH — circular spin arrow with motion sparks
    x.save();
    x.translate(cx, cy);
    x.lineJoin = 'round';
    x.lineCap = 'round';
    x.strokeStyle = '#f5f7fa';
    x.fillStyle   = '#f5f7fa';
    if(kind === 'stop'){
      // STOP: rounded square w/ inner halo
      const u = S * 0.16;
      // Inner glow behind the stop square
      const stopGlow = x.createRadialGradient(0, 0, u * 0.5, 0, 0, u * 2.2);
      stopGlow.addColorStop(0,   'rgba(233,191,90,0.40)');
      stopGlow.addColorStop(0.5, 'rgba(186,133,45,0.20)');
      stopGlow.addColorStop(1,   'rgba(186,133,45,0.00)');
      x.fillStyle = stopGlow;
      x.beginPath(); x.arc(0, 0, u * 2.2, 0, 7); x.fill();
      x.fillStyle = '#f5f7fa';
      rr(x, -u, -u, 2*u, 2*u, u * 0.32); x.fill();
    } else {
      // ── (6a) SUBTLE NEON CORE — a soft magenta energy glow BEHIND the arrow.
      // The arrow draws on top of it perfectly solid + white, so it never tints
      // the glyph. Trimmed vs the old 0.45 so the white reads cleanly.
      const centerGlow = x.createRadialGradient(0, 0, 0, 0, 0, S * 0.185);
      centerGlow.addColorStop(0,   'rgba(250,223,142,0.26)');
      centerGlow.addColorStop(0.5, 'rgba(233,191,90,0.09)');
      centerGlow.addColorStop(1,   'rgba(233,191,90,0.00)');
      x.fillStyle = centerGlow;
      x.beginPath(); x.arc(0, 0, S * 0.185, 0, 7); x.fill();
      // ── (6b) SPIN ARROW — PERFECTLY SOLID, CRISP, PURE WHITE.
      // The "subtle neon glow" is a soft WHITE shadowBlur halo around the crisp
      // shape — the arrow edges stay hard. The old pink "energy spark dot"
      // bubbles that overlapped the arrow are REMOVED (user: "completely remove
      // the pink particle bubbles/circles overlapping the white arrow").
      x.save();
      x.shadowColor = 'rgba(255,255,255,0.55)';   // clean white neon glow
      x.shadowBlur  = S * 0.028;
      x.lineJoin = 'round'; x.lineCap = 'round';
      x.strokeStyle = '#ffffff';                   // PURE white — perfectly solid
      const ar = S * 0.22, lw = S * 0.072;
      x.lineWidth = lw;
      x.beginPath();
      x.arc(0, 0, ar, Math.PI * 0.16, Math.PI * 1.84);
      x.stroke();
      // ARROW HEAD — sharp tapered tip (same crisp pure-white + glow)
      const a = Math.PI * 1.84;
      const ex = ar * Math.cos(a), ey = ar * Math.sin(a);
      const tx = -Math.sin(a),     ty = Math.cos(a);
      const px = Math.cos(a),      py = Math.sin(a);
      const head = lw * 1.85, halfW = lw * 1.55;
      x.fillStyle = '#ffffff';
      x.beginPath();
      x.moveTo(ex + tx*head, ey + ty*head);
      x.lineTo(ex + px*halfW, ey + py*halfW);
      x.lineTo(ex - px*halfW, ey - py*halfW);
      x.closePath(); x.fill();
      x.restore();
    }
    x.restore();
    return T(c);
  }
  // ── STEPPER GLYPH TEXTURE — 2026 redesign
  // Old version baked a purple-dome + gold-ring + glass-gradient into the
  // stepper texture so every bet button had a giant gold-rimmed coin look.
  // New: TRANSPARENT background, just the +/− glyph as a clean white
  // stroke. The chip frame underneath (drawn by drawBtnChip) provides
  // all the depth + glassmorphism. Result: visually consistent with the
  // info/settings/sound chips next to it — uniform chip system.
  function stepTex(kind){
    const S = 200, c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    x.translate(S/2, S/2);
    x.lineJoin = 'round';
    x.lineCap  = 'round';
    x.strokeStyle = '#f5f7fa';   // bright neutral (matches THEME.text)
    x.lineWidth   = S * 0.085;
    const a = S * 0.22;
    x.beginPath();
    x.moveTo(-a, 0); x.lineTo(a, 0);
    if(kind === 'plus'){ x.moveTo(0, -a); x.lineTo(0, a); }
    x.stroke();
    return T(c);
  }
  // ── ICON INK SYSTEM — 2026 gamification redesign ─────────────────────
  // Old version: cream (#fff2d0) two-pass with dark halo — looked baked
  // into the gold ruby-chip aesthetic. New: SMOKE-WHITE (#f5f7fa) single
  // pass with optional accent — clean villain-tier UI Verse style.
  //   - `ink(x,S,draw)` — primary smoke-white stroke/fill
  //   - `accent(x,S,draw)` — neon-magenta accent pass for energy highlights
  // Both write to a TRANSPARENT canvas; the chip frame underneath supplies
  // the bg, so icons are crisp single-color glyphs on top.
  function ink(x,S,draw){
    x.strokeStyle = '#f5f7fa';   // SMOKE-WHITE — single-color villain palette
    x.fillStyle   = '#f5f7fa';
    x.lineWidth   = S * 0.075;
    draw();
  }
  function accent(x,S,draw){
    x.strokeStyle = '#ff007f';   // NEON MAGENTA — gamified energy accent
    x.fillStyle   = '#ff007f';
    x.lineWidth   = S * 0.055;
    draw();
  }
  function thinInk(x,S,draw){
    x.strokeStyle = '#f5f7fa';
    x.fillStyle   = '#f5f7fa';
    x.lineWidth   = S * 0.05;
    draw();
  }
  function iconGlyph(x,type,S){
    const u = S * 0.2;
    if(type==='sound'){
      // ── SPEAKER + 2 SOUND WAVES — clean gamified icon
      // Speaker silhouette (left) + 2 curved waves (right), modern audio app style.
      ink(x,S,()=>{ x.beginPath();
        x.moveTo(-u*1.10,-u*0.40); x.lineTo(-u*0.46,-u*0.40); x.lineTo(u*0.10,-u*0.92);
        x.lineTo(u*0.10, u*0.92); x.lineTo(-u*0.46, u*0.40); x.lineTo(-u*1.10, u*0.40);
        x.closePath(); x.fill(); });
      // Inner wave (close, smaller)
      thinInk(x,S,()=>{ x.beginPath(); x.arc(u*0.22, 0, u*0.62, -0.85, 0.85); x.stroke(); });
      // Outer wave (further, larger) — slightly translucent for depth
      x.globalAlpha = 0.75;
      thinInk(x,S,()=>{ x.beginPath(); x.arc(u*0.22, 0, u*1.06, -0.75, 0.75); x.stroke(); });
      x.globalAlpha = 1;
    } else if(type==='mute'){
      // ── SPEAKER + X — slash through speaker indicates mute
      ink(x,S,()=>{ x.beginPath();
        x.moveTo(-u*1.10,-u*0.40); x.lineTo(-u*0.46,-u*0.40); x.lineTo(u*0.10,-u*0.92);
        x.lineTo(u*0.10, u*0.92); x.lineTo(-u*0.46, u*0.40); x.lineTo(-u*1.10, u*0.40);
        x.closePath(); x.fill(); });
      // Bold X (sized larger than original — readable at chip size)
      ink(x,S,()=>{ x.beginPath();
        x.moveTo(u*0.46,-u*0.56); x.lineTo(u*1.22, u*0.56);
        x.moveTo(u*1.22,-u*0.56); x.lineTo(u*0.46, u*0.56); x.stroke(); });
    } else if(type==='turbo'){
      // ── DOUBLE-CHEVRON BOLT — sharper, more dynamic than the old
      // lightning shape. Two chevrons stacked (like FAST-FORWARD ▶▶)
      // with the trailing chevron at 75% alpha for motion-trail depth.
      // Reads instantly as "TURBO / SPEED" at any size.
      x.globalAlpha = 0.55;
      ink(x,S,()=>{ x.beginPath();
        x.moveTo(-u*1.05,-u*0.78); x.lineTo(-u*0.15, 0); x.lineTo(-u*1.05, u*0.78);
        x.lineTo(-u*0.78, u*0.78); x.lineTo( u*0.12, 0); x.lineTo(-u*0.78,-u*0.78);
        x.closePath(); x.fill(); });
      x.globalAlpha = 1;
      ink(x,S,()=>{ x.beginPath();
        x.moveTo(-u*0.25,-u*0.78); x.lineTo( u*0.65, 0); x.lineTo(-u*0.25, u*0.78);
        x.lineTo( u*0.02, u*0.78); x.lineTo( u*0.92, 0); x.lineTo( u*0.02,-u*0.78);
        x.closePath(); x.fill(); });
    } else if(type==='info'){
      // ── HEXAGON-FRAMED "i" — gamified info icon
      // Outer hexagon (thin), classic "i" inside. Reads as a stylized
      // info badge in casino/MMO UIs.
      x.lineWidth = S * 0.055;
      x.strokeStyle = '#f5f7fa';
      x.beginPath();
      for(let i = 0; i < 6; i++){
        const a = (i / 6) * Math.PI * 2 - Math.PI/2;
        const px = Math.cos(a) * u * 1.10, py = Math.sin(a) * u * 1.10;
        if(i === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.closePath(); x.stroke();
      // "i" — dot + stem (thicker than before for legibility)
      ink(x,S,()=>{ x.beginPath(); x.arc(0,-u*0.50, u*0.16, 0, 7); x.fill(); });
      ink(x,S,()=>{
        x.beginPath(); x.lineCap='round';
        x.moveTo(0,-u*0.06); x.lineTo(0, u*0.62); x.stroke();
      });
    } else if(type==='settings'){
      // ── 8-TOOTH GEAR — proper settings cog
      // Outer tooth ring + inner hub. Classic gear silhouette, gamified
      // (drop the sliders) — reads as "configure / settings" universally.
      const tw = 8;
      const rOut = u * 1.15, rIn = u * 0.90;
      x.fillStyle = '#f5f7fa';
      x.beginPath();
      for(let i = 0; i < tw*2; i++){
        const a = (i / (tw*2)) * Math.PI * 2;
        const rr = (i % 2 === 0) ? rOut : rIn;
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if(i === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.closePath(); x.fill();
      // Inner hub hole (cut to transparent)
      x.save();
      x.globalCompositeOperation = 'destination-out';
      x.beginPath(); x.arc(0, 0, u * 0.46, 0, 7); x.fill();
      x.restore();
      // Inner hub ring (smoke-white outline)
      thinInk(x,S,()=>{ x.beginPath(); x.arc(0, 0, u * 0.46, 0, 7); x.stroke(); });
    } else if(type==='full'){
      // ── 4-CORNER EXPAND BRACKETS — fullscreen / expand icon
      // Same as before but with rounded line caps for gamified feel.
      x.lineCap = 'round';
      ink(x,S,()=>{
        const a = u * 1.04, b = u * 0.52;
        [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sy]) => {
          x.beginPath();
          x.moveTo(sx*a, sy*(a-b));
          x.lineTo(sx*a, sy*a);
          x.lineTo(sx*(a-b), sy*a);
          x.stroke();
        });
      });
    } else if(type==='history'){
      // ── CLOCK with HOUR/MIN ARROWS + tick marks
      ink(x,S,()=>{ x.beginPath(); x.arc(0,0,u*1.02,0,7); x.stroke(); });
      // Tick marks at 12/3/6/9
      thinInk(x,S,()=>{
        [[0,-1],[1,0],[0,1],[-1,0]].forEach(([dx,dy]) => {
          x.beginPath();
          x.moveTo(dx*u*0.86, dy*u*0.86); x.lineTo(dx*u*1.00, dy*u*1.00);
          x.stroke();
        });
      });
      // Hands (10:00-ish — visually balanced)
      ink(x,S,()=>{
        x.lineCap='round';
        x.beginPath(); x.moveTo(0,0); x.lineTo(0,-u*0.62); x.stroke();
        x.beginPath(); x.moveTo(0,0); x.lineTo(u*0.46,u*0.16); x.stroke();
      });
    } else if(type==='auto'){
      // ── CIRCULAR PLAY-LOOP — gamified autoplay symbol
      // Play triangle inside a 270° circular arrow loop. Reads instantly
      // as "auto-play / loop" — drops the bare triangle for a proper
      // loop-indicator that justifies the "AUTO" semantic.
      x.lineWidth = S * 0.075;
      x.strokeStyle = '#f5f7fa';
      x.lineCap = 'round';
      // 270° arc loop (open at top-right where the arrow head lives)
      x.beginPath();
      x.arc(0, 0, u * 1.05, -Math.PI * 0.10, Math.PI * 1.55);
      x.stroke();
      // Arrow head at start of arc (top-right area)
      const aStart = -Math.PI * 0.10;
      const ax = Math.cos(aStart) * u * 1.05;
      const ay = Math.sin(aStart) * u * 1.05;
      x.fillStyle = '#f5f7fa';
      x.beginPath();
      x.moveTo(ax + u*0.04, ay - u*0.36);
      x.lineTo(ax + u*0.30, ay + u*0.06);
      x.lineTo(ax - u*0.18, ay - u*0.06);
      x.closePath(); x.fill();
      // Play triangle in center
      ink(x,S,()=>{ x.beginPath();
        x.moveTo(-u*0.26, -u*0.48); x.lineTo( u*0.50, 0); x.lineTo(-u*0.26, u*0.48);
        x.closePath(); x.fill(); });
    } else if(type==='close'){
      // ── X — rounded line-cap cross
      ink(x,S,()=>{
        x.lineCap = 'round';
        x.beginPath();
        x.moveTo(-u*0.78,-u*0.78); x.lineTo(u*0.78,u*0.78);
        x.moveTo( u*0.78,-u*0.78); x.lineTo(-u*0.78,u*0.78);
        x.stroke();
      });
    } else if(type==='plus' || type==='minus'){
      // ── CLEAN BOLD +/− — gamified stepper (no diamond frame)
      // Per 2026-05-27 user feedback: the diamond frame was busy and
      // didn't read clearly. New: just a CHUNKY +/− glyph with rounded
      // caps — bold, immediately readable, sits cleanly inside the chip
      // frame which already provides the visual container.
      x.lineWidth = S * 0.115;
      x.lineCap = 'round';
      x.strokeStyle = '#f5f7fa';
      x.beginPath();
      x.moveTo(-u*1.00, 0); x.lineTo(u*1.00, 0);
      if(type === 'plus'){ x.moveTo(0, -u*1.00); x.lineTo(0, u*1.00); }
      x.stroke();
    }
  }
  TEX.icSound   = gemTex((x,S)=>iconGlyph(x,'sound',S));
  TEX.icMute    = gemTex((x,S)=>iconGlyph(x,'mute',S));
  TEX.icTurbo   = gemTex((x,S)=>iconGlyph(x,'turbo',S));
  TEX.icInfo    = gemTex((x,S)=>iconGlyph(x,'info',S));
  TEX.icSettings= gemTex((x,S)=>iconGlyph(x,'settings',S));
  TEX.icFull    = gemTex((x,S)=>iconGlyph(x,'full',S));
  TEX.icHistory = gemTex((x,S)=>iconGlyph(x,'history',S));
  TEX.icAuto    = gemTex((x,S)=>iconGlyph(x,'auto',S));
  TEX.icClose   = gemTex((x,S)=>iconGlyph(x,'close',S));
  TEX.uiPlus    = gemTex((x,S)=>iconGlyph(x,'plus',S));
  TEX.uiMinus   = gemTex((x,S)=>iconGlyph(x,'minus',S));

  // Modal / drawer panel — deep velvet, gold double border. Scales clean.
  (() => {
    const W=512,H=384,c=document.createElement('canvas'); c.width=W;c.height=H;
    const x=c.getContext('2d');
    rr(x,7,7,W-14,H-14,30);
    const g=x.createRadialGradient(W/2,H*0.32,24,W/2,H*0.56,W*0.7);
    g.addColorStop(0,'#5c1430'); g.addColorStop(0.68,'#360b1d'); g.addColorStop(1,'#1a0410');
    x.fillStyle=g; x.fill();
    x.save(); x.clip();
    const sh=x.createLinearGradient(0,0,0,H*0.46);
    sh.addColorStop(0,'rgba(255,221,170,0.17)'); sh.addColorStop(1,'rgba(255,221,170,0)');
    x.fillStyle=sh; x.fillRect(0,0,W,H*0.46);
    x.restore();
    rr(x,7,7,W-14,H-14,30); x.lineWidth=7; x.strokeStyle='#e7b857'; x.stroke();
    rr(x,15,15,W-30,H-30,23); x.lineWidth=2; x.strokeStyle='rgba(120,68,20,0.9)'; x.stroke();
    const panel=T(c);
    TEX.popup1=panel; TEX.popup2=panel; TEX.popupSet=panel; TEX.popupErr=panel; TEX.popupInfo=panel;
  })();

  // Buy-bonus CTA — gold gradient pill. Scales clean.
  (() => {
    const W=512,H=150,c=document.createElement('canvas'); c.width=W;c.height=H;
    const x=c.getContext('2d'), r=H/2-6;
    rr(x,6,6,W-12,H-12,r);
    const g=x.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#ffe487'); g.addColorStop(0.47,'#f3ab38');
    g.addColorStop(0.56,'#df8c1d'); g.addColorStop(1,'#9a5c15');
    x.fillStyle=g; x.fill();
    x.save(); x.clip();
    const sh=x.createLinearGradient(0,0,0,H*0.52);
    sh.addColorStop(0,'rgba(255,255,255,0.55)'); sh.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=sh; x.fillRect(0,0,W,H*0.52);
    x.restore();
    rr(x,6,6,W-12,H-12,r); x.lineWidth=6; x.strokeStyle='#5c2410'; x.stroke();
    rr(x,14,14,W-28,H-28,r-7); x.lineWidth=2; x.strokeStyle='rgba(255,240,205,0.5)'; x.stroke();
    TEX.buyBar=T(c);
  })();

  // ART-04 — Directional cinematic light pool (replaces the symmetric radial).
  // Texture is 16:9 native so cover-fit doesn't squash the falloff into an oval
  // (the old INDEPENDENT-x/y scale stretched the radial on landscape 1200x675).
  // Light focus sits slightly ABOVE the reel grid (matches godRays origin) and
  // bottom corners darken FASTER than top corners — reads as a top-down stage
  // light pool, not an even border vignette.
  (() => {
    const W=512,H=288,c=document.createElement('canvas'); c.width=W;c.height=H;
    const x=c.getContext('2d');
    // Base — soft radial pool with focus high-centre (matches grid centre on landscape).
    const fy = H * 0.42, // focus Y — slightly above visual centre
          rIn  = Math.min(W,H) * 0.12,
          rOut = Math.hypot(W * 0.55, H * 0.78);  // reaches BOTTOM corners hardest
    const g = x.createRadialGradient(W/2, fy, rIn, W/2, fy, rOut);
    g.addColorStop(0,    'rgba(10,2,16,0)');
    g.addColorStop(0.45, 'rgba(10,2,16,0.12)');
    g.addColorStop(0.72, 'rgba(9,2,15,0.42)');
    g.addColorStop(1.00, 'rgba(5,1,10,0.92)');
    x.fillStyle = g; x.fillRect(0,0,W,H);
    // BOTTOM-WEIGHTED deepening — extra darkening band that grows with y, asymmetric
    // so the bottom feels grounded and the top feels lit. Linear gradient compounds on
    // top of the radial.
    const lg = x.createLinearGradient(0, H*0.45, 0, H);
    lg.addColorStop(0, 'rgba(0,0,0,0)');
    lg.addColorStop(1, 'rgba(0,0,0,0.20)');
    x.fillStyle = lg; x.fillRect(0,0,W,H);
    TEX.vignette = T(c);
  })();

  // ── SLOT SYMBOL TEXTURES — Shining Pop crystal art (assets/images/shining) ──
  // 0 Cherry · 1 Lemon · 2 Plum · 3 Grapes · 4 Watermelon · 5 Bell · 6 Seven · 7 Crown · 8 Star
  const SYM_TEX = [];
  for(let i=0;i<9;i++) SYM_TEX[i] = TEX['s'+i];
  // soft radial glow texture for win highlights
  const glowTex = (() => {
    const g = new PIXI.Graphics();
    for(let i=10;i>=1;i--) g.circle(0,0,i*11).fill({ color:0xffffff, alpha:0.05 });
    const t = app.renderer.generateTexture({ target:g, resolution:1,
      frame:new PIXI.Rectangle(-120,-120,240,240) });
    g.destroy();
    return t;
  })();

  // ── SCENE GRAPH ───────────────────────────────────────────────
  const stage = app.stage;

  // ── GLOBAL COLOR GRADE (★★★ studio cohesion) ─────────────────────
  // ONE stage-level ColorMatrixFilter unifies the entire frame: punchier
  // contrast + richer saturation + a faint magenta-warm bias so the dark
  // theme pulls toward the villain brand instead of neutral grey/black.
  // Built-in filter (no GLSL — Stake-safe), single cheap pass per frame.
  // Every panel/symbol/HUD layer ends up regraded in the same color space
  // → the "premium" cohesive read that separates studio work from indie.
  // `filterArea = app.screen` pins the region so Pixi skips a full
  // scene-graph getBounds() every frame (perf-cheap on weak GPU too).
  const gradeFilter = new PIXI.ColorMatrixFilter();
  gradeFilter.contrast(0.12, false);    // first op resets identity matrix
  gradeFilter.saturate(0.16, true);     // compose saturation on top
  // Direct matrix-offset nudge → faint magenta-warm tint (duotone-lean):
  // bias R + B up, G down, so the deep navy reads as villain-magenta-tinged
  // instead of neutral. Tiny values (~1%) — imperceptible on bright whites,
  // visibly cohesive on the dark hall/frame. Row-major 4x5 = [r,g,b,a,o]
  // per channel; indices 4 / 9 / 14 are the R / G / B offsets.
  {
    const m = gradeFilter.matrix;
    m[4]  += 0.012;  // R offset → +magenta warmth
    m[9]  -= 0.006;  // G offset → −green = more magenta
    m[14] += 0.006;  // B offset → +blue keeps it violet-leaning, not pink
    gradeFilter.matrix = m;
  }
  gradeFilter.alpha = 1.0;              // apply the grade fully
  stage.filterArea = app.screen;        // live screen rect → no per-frame bounds calc
  stage.filters = [gradeFilter];

  // ── VFX-02 — per-mode mood lerp (base / standard / hot / mega). Snapshot the
  // BASE matrix so each mode re-applies on top of the original (no stacking).
  // standard: gentle warm-magenta lift · hot: high sat + brighter ·
  // mega: DESATURATE base + violet tint for ominous drama (distinct from warm tiers).
  // Lerps the matrix over ~400ms via GSAP — no extra filter pass, no per-frame cost
  // when idle. Reverts to base on bonus exit. (Audit VFX-02; gradeFilter is the same
  // stage filter VFX-01 referenced — single matrix, single pass, four moods.)
  const _baseGradeMatrix = new Float32Array(gradeFilter.matrix);
  function _applyGradeMode(mode){
    // User: the per-mode grade kept RE-TINTING the whole frame (esp. the mega
    // fuchsia tint) — "the filter changing render color is a bad idea". So keep
    // the single base grade for EVERY mode → scene colours stay correct and
    // consistent. Bonus modes get only a tiny HUE-NEUTRAL brightness lift (no
    // saturate, no tint, no contrast shift) so nothing recolours the scene.
    const m = gradeFilter.matrix;
    for(let i=0;i<m.length;i++) m[i] = _baseGradeMatrix[i];
    if(mode === 'bonus_standard' || mode === 'bonus_hot' || mode === 'bonus_mega'){
      gradeFilter.brightness(1.04, true);   // lift only — never shifts hue
    }
    // 'base' (or anything unknown) leaves the matrix at _baseGradeMatrix.
  }
  // Smooth transition via filter.alpha pump (~280ms out, then re-apply matrix, ~320ms in).
  // Visually reads as a brief grade dissolve — no scene-graph reflow, no extra pass.
  function setGradeMode(mode){
    if (!window.gsap?.timeline) { _applyGradeMode(mode); return; }
    window.gsap.timeline()
      .to(gradeFilter, { alpha: 0.75, duration: 0.28, ease: 'power2.out' })
      .call(() => _applyGradeMode(mode))
      .to(gradeFilter, { alpha: 1.0, duration: 0.32, ease: 'power2.in' });
  }

  const bg = spr('bg');                            stage.addChild(bg);
  // Cathedral GOD-RAYS — soft warm volumetric light shafts from the vault.
  // Additive, low-alpha, slow sway so the bg reads as a real lit hall with
  // depth, not a flat painting (2026-05-30, user "bg looks not cool"). Sits
  // just above bg, below the reels; gated off under reduced-motion / weak GPU.
  const godRays = new PIXI.Graphics(); godRays.blendMode = 'add'; stage.addChild(godRays);
  // ── AMBIENT MOTE BED (2026-05-31 award-tier "living atmosphere") ───────
  // A slow-drifting field of luminous dust behind the reels — the constant
  // ambient life that separates an AAA hall from a flat backdrop. ALWAYS-ON
  // and NON-reactive (the user wants the main scene calm — no per-spin/​win
  // change), GPU-gated (off on _gpuWeak), reduced-motion-safe. Additive, and
  // added here so it sits BELOW the vignette + reels → reads as atmosphere
  // AROUND the focal reels, never drifting over them.
  const ambientMotesG = new PIXI.Graphics(); ambientMotesG.blendMode = 'add'; stage.addChild(ambientMotesG);
  const ambientMotes = [];
  // Tint the painted cathedral darker so the bright light rays (which the
  // user found distracting — "lines from top-left") don't dominate the
  // gameplay area. 0.72 tint = 28% darker without losing the painted feel.
  bg.tint = 0xb8b8c8;
  const vignette = spr('vignette');                stage.addChild(vignette);
  // Boost vignette so the edges deepen and the light rays get pushed back
  vignette.alpha = 1.0;

  // ── AAA BLUR-BEHIND-MODAL (PixiJS v8 native BlurFilter) ──
  // Award-nominated slots blur the gameplay scene when an overlay is open.
  // MOBILE perf: BlurFilter is the heaviest GPU op in the pipeline. Cap
  // quality to 2 (was 4) on phone-sized viewports so the device doesn't
  // overheat or drop frames during modal opens.
  const isPhoneViewport = () => {
    const w = window.innerWidth, h = window.innerHeight;
    return Math.min(w, h) < 500;   // any narrow dimension = phone class
  };
  const gameBlurFilter = new PIXI.BlurFilter({
    strength: 0,
    quality: isPhoneViewport() ? 2 : 4,
  });
  gameBlurFilter.padding = 32;   // prevent edge clipping during blur
  bg.filters = [gameBlurFilter];
  bg._blurT = 0;

  // Logo wordmark — painted crystal-heart crest (assets/images/shining/logo.jpg)
  // ── LOGO VFX system (2026-05-27 redesign per user "VFX effect work on
  // HIM like INSERT effect not outside offset effect") ─────────────────
  // The shine + halo now lives INSIDE the logo bounds via a sprite mask:
  // a duplicate of the logo texture used as alpha mask, so the shine only
  // appears ON the wordmark pixels — not as an external glow that bleeds
  // past the logo silhouette.
  //
  // Layer order:
  //   logoHalo  — additive subtle outer pink glow (kept minimal — was the
  //               only effect before; now JUST an ambient surround)
  //   logo      — the actual wordmark
  //   logoShine — clipped-to-logo shimmer (the radical new INSIDE effect)
  const logoHalo = new PIXI.Graphics();
  logoHalo.blendMode = 'add';
  logoHalo.eventMode = 'none';
  stage.addChild(logoHalo);
  const logo = spr('logo'); logo.eventMode = 'none'; stage.addChild(logo);
  // Shine layer — drawn on a TexturedSprite (logo texture) tinted/alpha'd
  // each frame for the shimmer effect. Since it shares the logo texture,
  // it's automatically clipped to logo pixels — no external glow bleed.
  const logoShine = new PIXI.Sprite(tex('logo'));
  logoShine.anchor.set(0.5);
  logoShine.eventMode = 'none';
  logoShine.blendMode = 'add';
  logoShine.alpha = 0;
  stage.addChild(logoShine);
  // ── MAX-WIN CAPTION (build AK, user: "add the game max win info in the
  // gameplay somewhere — Max-win 5000×"). Static, asset-free, gold tracked
  // caps. Positioned in layout() relative to the wordmark. Exact cap value
  // matches the math package (max-win 5000×) — never recomputed on the front.
  const maxWinCap = new PIXI.Text({ text:'MAX WIN 5,000×', resolution:3, style:{
    fontFamily:'Fredoka', fontSize:13, fontWeight:'700', fill:0xff8ad0, letterSpacing:2.5,   // soft magenta (was gold 0xffe066 — matches the magenta logo)
    stroke:{ color:0x2a0a1e, width:3.5, join:'round' },
  }});
  maxWinCap.anchor.set(0.5);
  maxWinCap.eventMode = 'none';
  maxWinCap.alpha = 0.92;
  stage.addChild(maxWinCap);

  // Reel area
  const reelArea = new PIXI.Container(); stage.addChild(reelArea);
  // VFX-01 SUPERSEDED: a stage-wide ColorMatrixFilter (contrast 0.12 + saturate 0.16
  // + magenta tint) already exists at line ~1628. VFX-02 lerps that EXISTING grade
  // for per-mode mood (base→standard→hot→mega) — no second filter pass needed.
  // Blur-behind-modal for the whole reel scene — attached ONLY while a modal is
  // open (a permanent filter on this big container would force an extra render
  // pass every gameplay frame). Quality capped on phones. Ramped in render loop.
  const reelBlurFilter = new PIXI.BlurFilter({ strength: 0, quality: isPhoneViewport() ? 1 : 3 });
  reelBlurFilter.padding = 16;
  const _reelBlurArr = [reelBlurFilter];
  // ── PHYSICAL SWIPE-DRAG (2026 production redesign) ────────────────
  // Pointer-down on the reel matrix grabs the reels — drag moves them
  // physically with rubber-band damping. Release past threshold triggers
  // a spin; release short snaps back to rest. Reproduces the "feel" of
  // Pragmatic / NetEnt slots where the player can grab the columns and
  // throw them. Matches user brief:
  //   "for the pointer down on the reels, grab effect and moving swipe.
  //    pointer down and moved like moving to bottom vertically — reels
  //    moving to bottom. In the swipe to top, moving to top."
  const swipeZone = new PIXI.Container(); swipeZone.eventMode = 'static'; stage.addChild(swipeZone);
  let _swipe = null;
  let _swipeReturnRAF = null;
  // Rubber-band damping — sub-linear so the further you drag, the more
  // resistance you feel. Capped at ±CELL (one full row of displacement)
  // so the reels can't be dragged completely off-screen.
  function rubberBand(dy){
    const cap = CELL * 1.05;
    return Math.sign(dy) * Math.tanh(Math.abs(dy) / (CELL * 0.85)) * cap;
  }
  // Snap-back when the user releases without a real spin gesture —
  // animates each reel's .offset back to 0 over 280ms (ease-out quart).
  function snapReelsBackToRest(){
    if(_swipeReturnRAF) cancelAnimationFrame(_swipeReturnRAF);
    const t0 = performance.now();
    const start = reels.map(r => r.offset);
    const dur = 280;
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - p, 4);
      for(let r = 0; r < REELS; r++) reels[r].offset = start[r] * (1 - e);
      if(p < 1) _swipeReturnRAF = requestAnimationFrame(tick);
      else _swipeReturnRAF = null;
    };
    _swipeReturnRAF = requestAnimationFrame(tick);
  }
  swipeZone.on('pointerdown', e => {
    // Don't grab during spin/replay/modal — the rest of the state machine
    // owns those phases. Reels-at-rest only.
    if(STAKE.replay) return;
    if(allReelsSpinning) {
      // During a live spin the press is a "quick-stop tap" gesture —
      // record _swipe so pointerup can resolve it, but skip the drag.
      _swipe = { x:e.global.x, y:e.global.y, t:performance.now(), drag:false };
      return;
    }
    if(State.phase !== Phase.IDLE) return;
    // Cancel any in-flight snap-back so the new grab starts from the
    // reels' current visual offset, not from rest.
    if(_swipeReturnRAF) { cancelAnimationFrame(_swipeReturnRAF); _swipeReturnRAF = null; }
    _swipe = {
      x: e.global.x, y: e.global.y, t: performance.now(),
      lastDy: 0, drag: true,
      baseOffsets: reels.map(r => r.offset),
    };
    // Grab cursor — visual affordance that the reels are draggable
    swipeZone.cursor = 'grabbing';
  });
  swipeZone.on('pointermove', e => {
    if(!_swipe || !_swipe.drag) return;
    const dy = e.global.y - _swipe.y;
    const damped = rubberBand(dy);
    _swipe.lastDy = damped;
    // Apply damped displacement to all 5 reels uniformly (the player is
    // dragging the whole matrix, not just one column).
    for(let r = 0; r < REELS; r++){
      reels[r].offset = _swipe.baseOffsets[r] + damped;
    }
  });
  swipeZone.on('pointerup', e => {
    if(!_swipe) return;
    const dx = e.global.x - _swipe.x;
    const dy = e.global.y - _swipe.y;
    const dt = performance.now() - _swipe.t;
    const dragDy = _swipe.lastDy || 0;
    const drag = _swipe.drag;
    _swipe = null;
    swipeZone.cursor = 'default';
    if(STAKE.replay) return;
    // ── (a) Quick-stop during live spin ──
    if(allReelsSpinning){
      // Any tap or swipe during a spin acts as quick-stop
      if(Math.hypot(dx, dy) > 8 || dt < 250) quickStopReels();
      return;
    }
    if(State.phase !== Phase.IDLE) return;
    // ── (b) Real drag past threshold → spin ──
    // Threshold: 35% of a cell of drag displacement OR a fast flick.
    const flickV = dt > 0 ? Math.abs(dy) / dt : 0;            // px / ms
    const goodDrag = drag && (Math.abs(dragDy) > CELL * 0.35 || flickV > 0.5);
    if(goodDrag){
      // Snap reels back to rest IN PARALLEL with the spin starting —
      // startSpin() will run its own pre-spin animation and replace .offset
      // imminently, so we don't need to animate the snap.
      for(let r = 0; r < REELS; r++) reels[r].offset = 0;
      startSpin();
      return;
    }
    // ── (c) Released-with-no-real-drag at idle → snap back + tap action ──
    if(drag && Math.abs(dragDy) > 1){
      snapReelsBackToRest();
    }
    // ── (d) SHORT TAP — show 10-paylines preview (drag < 12 px, < 350 ms)
    if(Math.hypot(dx, dy) < 12 && dt < 350 && State.phase === Phase.IDLE){
      try { if(typeof showLinesPreview === 'function') showLinesPreview(); } catch(e){}  /* auto payline-preview RE-ENABLED 2026-05-31 (user: "show all win-line combinations in the intro + on reel tap like the old version"). The sweep is the polished sequential draw-on (drawLinesPreviewFrame), not the old static all-at-once flash. */
    }
  });
  swipeZone.on('pointerupoutside', () => {
    if(_swipe && _swipe.drag) snapReelsBackToRest();
    _swipe = null;
    swipeZone.cursor = 'default';
  });
  // Idle pointer over the reels — grab cursor hints at draggability
  swipeZone.on('pointerover', () => {
    if(State.phase === Phase.IDLE && !allReelsSpinning && !STAKE.replay) {
      swipeZone.cursor = 'grab';
    }
  });
  swipeZone.on('pointerout', () => { swipeZone.cursor = 'default'; });
  const frameG = new PIXI.Graphics();    reelArea.addChild(frameG);
  // Corner heart-jewel ornaments — pulsing, ticker-driven (separate from
  // frameG so we can re-render every frame for the breathing pulse
  // without redrawing the heavy reel-column panels).
  const cornerJewelsG = new PIXI.Graphics(); reelArea.addChild(cornerJewelsG);
  const reelsWrap = new PIXI.Container(); reelArea.addChild(reelsWrap);
  const reelMask = new PIXI.Graphics();  reelArea.addChild(reelMask);
  reelsWrap.mask = reelMask;
  const lineG = new PIXI.Graphics(); lineG.blendMode = 'add'; reelArea.addChild(lineG);
  // WIN LINE renders ABOVE the popped hero symbols (winHeroLayer zIndex 60) so the
  // dramatic laser filament traces OVER the winning symbols, not behind them
  // (user: "win line need bigger z-index, top level of the symbols"). reelArea has
  // sortableChildren=true, so this zIndex is honoured.
  lineG.zIndex = 80;
  // Paylines preview overlay — separate Graphics so the per-win lineG
  // drawing doesn't fight with the all-lines preview. Shows when the
  // player taps the "10 LINES" badge or hovers the BET value.
  const linesPreviewG = new PIXI.Graphics();
  // NORMAL blend (was 'add') — additive thin lines added over the BRIGHT reel
  // symbols clamped to white and vanished (the "lines don't show" bug). Normal
  // blend + a dark outline makes every payline pop over any symbol.
  linesPreviewG.alpha = 0;
  // user 2026-06: the paylines PREVIEW shine-lines render UNDER the symbols (was
  // zIndex 75 = a bright overlay covering the fruit). Inserted just below reelsWrap
  // so the symbols stay crisp on top and the lines glow around/between them — an
  // elegant under-shine, not an overlay. (The win-REVEAL lineG stays at z80 on top:
  // that dramatic laser-over-winning-symbols is a separate, intended behaviour.)
  // Verified live at mobile + landscape: lines trace cleanly behind crisp symbols.
  linesPreviewG.zIndex = 0;
  reelArea.addChildAt(linesPreviewG, reelArea.getChildIndex(reelsWrap));
  let linesPreviewT0 = 0;
  let linesPreviewDur = 0;
  const winGlowLayer = new PIXI.Container(); winGlowLayer.blendMode = 'add'; reelArea.addChild(winGlowLayer);
  // ── WIN-HERO LAYER (2026-05-31) — opaque, UNMASKED, TOP-z copies of the
  // winning symbols. The real reel sprite lives inside the masked reelsWrap, so
  // when it pops on a win the reelMask CROPS it at the reel edge (user: "symbols
  // crop, only show inside the reels; need bigger z for the top effect"). These
  // hero copies render ABOVE every reel-area layer (zIndex) on NORMAL blend, so
  // the winning symbol pops fully visible past the frame. sortableChildren keeps
  // all other layers in their existing order (stable sort, equal zIndex).
  reelArea.sortableChildren = true;
  const winHeroLayer = new PIXI.Container(); winHeroLayer.zIndex = 60; reelArea.addChild(winHeroLayer);
  // SHEEN layer — sits ABOVE the popped hero symbols (z 62 > heroes 60, < lines 75)
  // so the premium-win shimmer-sweep rakes ACROSS the symbol face, not behind it.
  // Additive so the streak reads as light catching a crystal facet. Cleared+redrawn
  // each frame by drawWinVfx; idle the rest of the time.
  const winSheenG = new PIXI.Graphics(); winSheenG.blendMode = 'add'; winSheenG.zIndex = 62; reelArea.addChild(winSheenG);
  const frameTopG = new PIXI.Graphics(); reelArea.addChild(frameTopG);
  frameTopG.blendMode = 'add';   // additive — the animated portal energy glows
  // win-VFX layers — 3D drop-shadow sits *below* the reels; the animated
  // bounding box (additive bloom + crisp gold frame) sits above everything.
  const winShadowG = new PIXI.Graphics(); reelArea.addChildAt(winShadowG, 1);
  const winGlowAddG = new PIXI.Graphics(); winGlowAddG.blendMode = 'add';
  const winFrameG   = new PIXI.Graphics();
  reelArea.addChild(winGlowAddG, winFrameG);
  // soft-bloom filter — gives the winning symbols a CGI-grade glowing aura
  const winBloomFilter = new PIXI.BlurFilter({ strength: 3.5, quality: 2 });   // softened (was 6) — minimalist/elegant, stop the white-clip bloom
  // layer order — glow, dust + bloom sit BELOW the reels so the winning symbol
  // always reads as the hero element; only the thin frame sits above.
  reelArea.addChildAt(winGlowAddG,  reelArea.getChildIndex(reelsWrap));
  reelArea.addChildAt(winGlowLayer, reelArea.getChildIndex(reelsWrap));
  reelArea.addChild(winFrameG);
  // frosted-glass backing — a blurred copy of the hall clipped to the matrix,
  // shown through the 50%-transparent reel panels (glassmorphic container).
  const frostBg = new PIXI.Sprite(tex('bg')); frostBg.anchor.set(0.5);
  // P3 — weak GPU gets a lighter frost blur (strength 14 → 8) to cut the
  // most expensive full-matrix fillrate cost on Adreno/Mali low-end.
  const _frostBlur = new PIXI.BlurFilter({ strength: _gpuWeak ? 8 : 14, quality:1 });
  _frostBlur.resolution = 0.5;
  frostBg.filters = [_frostBlur];
  const frostMask = new PIXI.Graphics();
  frostBg.mask = frostMask;
  reelArea.addChildAt(frostBg, 0);
  reelArea.addChild(frostMask);

  // Reels — each: 5 sprite cells (1 above, 3 visible, 1 below).
  let CELL = 90;
  const reels = [];
  for(let r=0;r<REELS;r++){
    const col = new PIXI.Container(); reelsWrap.addChild(col);
    const sprites = [], glows = [], heroes = [];
    for(let k=0;k<5;k++){
      const gl = new PIXI.Sprite(glowTex); gl.anchor.set(0.5); gl.alpha = 0; gl.visible = false;
      winGlowLayer.addChild(gl); glows.push(gl);
      const s = new PIXI.Sprite(SYM_TEX[0]); s.anchor.set(0.5); col.addChild(s); sprites.push(s);
      // opaque hero copy — top, unmasked; only shown while a win is highlighted
      const hr = new PIXI.Sprite(SYM_TEX[0]); hr.anchor.set(0.5); hr.alpha = 0; hr.visible = false;
      winHeroLayer.addChild(hr); heroes.push(hr);
    }
    reels.push({
      col, sprites, glows, heroes,
      symbols: [0,1,2,3,4].map(() => Math.floor(vrnd()*SYM_COUNT)),
      from:0, to:0, t0:0, dur:0, scrolled:0, done:0, offset:0,
      spinning:false, feed:[], feedIdx:0, totalShifts:0, landT:0,
    });
  }
  // ── STICKY-OVERLAY LAYER ──────────────────────────────────────────
  // MEGA bonus mode locks crown symbols at the cells where they land —
  // they MUST remain visually static for the rest of the bonus, NOT
  // re-spin through the reel. Previously the reel column kept spinning
  // through the sticky cells and only a coloured frame outline marked
  // them, so the player saw "spinning crowns inside a highlighted box"
  // which read as "the math is wrong, why is it moving?". Fix: paint
  // a STATIC crown sprite per locked cell on this overlay, which sits
  // ABOVE the spinning reels and below the win frame. Cells that aren't
  // stuck stay invisible. Hidden entirely outside of MEGA bonus rounds.
  const stickyOverlay = new PIXI.Container();
  // Insert just above reelsWrap so reels visually spin BEHIND the locked symbols
  reelArea.addChildAt(stickyOverlay, reelArea.getChildIndex(reelsWrap) + 1);
  const stickySprites = [];           // 5 reels × 3 rows = 15 cells
  for(let r = 0; r < REELS; r++){
    const colArr = [];
    for(let row = 0; row < ROWS; row++){
      const s = new PIXI.Sprite(SYM_TEX[7]);   // crown texture (default)
      s.anchor.set(0.5);
      s.visible = false;
      s.alpha = 0;
      stickyOverlay.addChild(s);
      colArr.push(s);
    }
    stickySprites.push(colArr);
  }
  // Layout helper — call from layout() so the static sprites snap to the
  // current cell grid after a resize.
  function layoutStickySprites(){
    const sz = CELL * 0.92;
    for(let r = 0; r < REELS; r++){
      for(let row = 0; row < ROWS; row++){
        const sp = stickySprites[r][row];
        const cc = cellCenter(r, row);
        sp.position.set(cc.x, cc.y);
        sp.scale.set(sz / Math.max(sp.texture.width, sp.texture.height));
      }
    }
  }
  function clearStickyOverlay(){
    for(let r = 0; r < REELS; r++){
      for(let row = 0; row < ROWS; row++){
        const sp = stickySprites[r][row];
        sp.visible = false; sp.alpha = 0;
      }
    }
  }
  // populate initial visible grid
  function randStripSym(r){ const s=STRIPS[r]; return s[Math.floor(vrnd()*s.length)]; }
  reels.forEach((rl,r) => { rl.symbols = [randStripSym(r),randStripSym(r),randStripSym(r),randStripSym(r),randStripSym(r)]; });

  // ── FREE SPINS BANNER — villain throne procedural (no asset)
  // Per user feedback "now asset in the free spin win not good pls fix it":
  // Replaced the legacy gold ribbon sprite with a Pixi-only procedural
  // panel matching the BIG/MEGA/EPIC WIN villain throne aesthetic —
  // obsidian backdrop + neon magenta border + smoke-white text.
  const featureBanner = new PIXI.Container(); featureBanner.alpha = 0; stage.addChild(featureBanner);
  const fbBg = new PIXI.Graphics(); featureBanner.addChild(fbBg);
  const fbBurst = new PIXI.Graphics(); fbBurst.blendMode = 'add';
  featureBanner.addChild(fbBurst);
  const fbText = new PIXI.Text({ text:'', resolution: 3, style:{
    fontFamily: 'Luckiest Guy', fontSize: 32, fill: 0xf5f7fa,
    stroke: { color: 0xff007f, width: 3, join: 'round' },
    letterSpacing: 2.5, align: 'center',
  }});
  fbText.anchor.set(0.5, vcY('Luckiest Guy')); featureBanner.addChild(fbText);
  // ── FEATURE BANNER PANEL — villain redesign (2026-05-27) ────────────
  // Old: thick magenta border + ray burst inside the panel — read as a
  // "warning" badge, not a celebration. New: sleek obsidian pill with a
  // soft outer halo, a single accent line at the bottom, and corner
  // bracket marks left + right. Quiet typography, premium feel.
  // Per-tier colour language for the "X FREE SPINS" banner — mirrors each entry
  // ceremony so the banner that follows carries the same identity: STANDARD = icy
  // crystal, HOT = hot plasma, MEGA = arcane (magenta + cyan chromatic ghost).
  // Halo strength + accent weight escalate with the tier. (2026-06-01)
  const FB_TIERS = {
    standard: { halo: 0xff5ab0, line: 0xffe6f4, brk: 0xffe6f4, ghost: 0,        glowA: 0.045, lineH: 1.6 },
    hot:      { halo: 0xff2f93, line: 0xff3f9f, brk: 0xff7ac4, ghost: 0xffd9ec, glowA: 0.075, lineH: 2.6 },
    mega:     { halo: 0xff007f, line: 0xff007f, brk: 0xff5ab0, ghost: 0x7fe7ff, glowA: 0.095, lineH: 2.8 },
  };
  let _fbTier = 'standard';
  function drawFeatureBannerPanel(){
    const T = FB_TIERS[_fbTier] || FB_TIERS.standard;
    // fit-to-screen — scale the LABEL down if the panel would exceed 92% of the
    // viewport, then size the panel to the (possibly scaled) label. Replaces the
    // old layout-side fitW(fbBg,…), a SPRITE fit (w/texture.width) wrongly applied
    // to this procedural Graphics after the sprite→Graphics refactor → it set
    // fbBg.scale = NaN, silently hiding the whole panel in prod. (2026-06-01)
    const maxW = Math.max(300, app.screen.width * 0.92);
    fbText.scale.set(1);
    let w = Math.max(320, fbText.width + 110);
    if(w > maxW){ fbText.scale.set(maxW / w); w = maxW; }
    const h = 72;
    const r = 18;
    fbBg.clear();
    // ── (1) Soft outer halo — tier-tinted, escalating strength ──
    fbBg.roundRect(-w/2-14, -h/2-14, w+28, h+28, r+14)
      .fill({ color: T.halo, alpha: T.glowA });
    fbBg.roundRect(-w/2-7, -h/2-7, w+14, h+14, r+7)
      .fill({ color: T.halo, alpha: T.glowA * 2.4 });
    // ── (2) Drop shadow under the panel ──
    fbBg.roundRect(-w/2, -h/2+4, w, h+2, r)
      .fill({ color: 0x000000, alpha: 0.55 });
    // ── (3) OBSIDIAN PANEL — clean, no inner border ──
    fbBg.roundRect(-w/2, -h/2, w, h, r)
      .fill({ color: 0x0a0a14, alpha: 0.96 });
    // ── (4) Subtle inner depth gradient (top brighter, bottom darker) ──
    fbBg.roundRect(-w/2+1, -h/2+1, w-2, h*0.42, r-1)
      .fill({ color: T.halo, alpha: 0.05 });
    fbBg.roundRect(-w/2+1, h*0.05, w-2, h*0.45, r-1)
      .fill({ color: 0x000000, alpha: 0.30 });
    // ── (5) TOP HAIRLINE — single smoke-white pixel-thin highlight ──
    fbBg.roundRect(-w/2+r, -h/2+0.5, w-r*2, 0.8, 0.4)
      .fill({ color: 0xf5f7fa, alpha: 0.55 });
    // ── (6) BOTTOM ACCENT LINE — tier colour + weight ──
    const lineY = h/2 - 0.6 - T.lineH, lineX = -w/2 + r*0.8, lineW = w - r*1.6;
    if(T.ghost){   // chromatic ghost (HOT warm / MEGA cyan) offset under the main rule
      fbBg.roundRect(lineX - 1.6, lineY - 1.2, lineW, T.lineH, 0.8)
        .fill({ color: T.ghost, alpha: 0.45 });
    }
    fbBg.roundRect(lineX, lineY, lineW, T.lineH, 0.8)
      .fill({ color: T.line, alpha: 1.0 });
    if(_fbTier === 'standard'){          // icy CRYSTAL facet diamonds at the line ends
      for(const dx of [lineX, lineX + lineW]){
        const dy = lineY + T.lineH/2, d = 3.4;
        fbBg.poly([dx, dy-d, dx+d, dy, dx, dy+d, dx-d, dy]).fill({ color: T.line, alpha: 0.95 });
      }
    } else if(_fbTier === 'hot'){        // hot-white PLASMA core inside the bar
      fbBg.roundRect(lineX + lineW*0.12, lineY + T.lineH*0.3, lineW*0.76, T.lineH*0.35, 0.4)
        .fill({ color: 0xffffff, alpha: 0.5 });
    }
    // ── (7) CORNER BRACKETS — tier colour; MEGA/HOT add a chromatic ghost ──
    const bl = -w/2 + 16, bt = -h/2 + 14, brLen = 14, brR = w/2 - 16;
    function bracket(col, ox, oy, a){
      fbBg.moveTo(bl+ox, bt+brLen+oy).lineTo(bl+ox, bt+oy).lineTo(bl+brLen+ox, bt+oy).stroke({ color: col, width: 1.4, alpha: a });
      fbBg.moveTo(bl+ox, h/2-14-brLen+oy).lineTo(bl+ox, h/2-14+oy).lineTo(bl+brLen+ox, h/2-14+oy).stroke({ color: col, width: 1.4, alpha: a });
      fbBg.moveTo(brR-brLen+ox, bt+oy).lineTo(brR+ox, bt+oy).lineTo(brR+ox, bt+brLen+oy).stroke({ color: col, width: 1.4, alpha: a });
      fbBg.moveTo(brR-brLen+ox, h/2-14+oy).lineTo(brR+ox, h/2-14+oy).lineTo(brR+ox, h/2-14-brLen+oy).stroke({ color: col, width: 1.4, alpha: a });
    }
    if(T.ghost) bracket(T.ghost, -1.6, 0, 0.4);   // chromatic ghost offset
    bracket(T.brk, 0, 0, 0.85);
    // ── (8) FAINT SCAN-LINE TEXTURE — horizontal hairlines for tech feel ──
    fbBurst.clear();
    for(let i = 1; i <= 3; i++){
      const ly = -h/2 + (h * i / 4);
      fbBurst.rect(-w/2 + r, ly - 0.3, w - r*2, 0.6)
        .fill({ color: T.halo, alpha: 0.06 });
    }
  }

  // ── HUD ───────────────────────────────────────────────────────
  const hud = new PIXI.Container(); stage.addChild(hud);
  // ── BOTTOM CONTROL BAR (Waylanders-style) — empty for now; the unified
  // bottom-bar layout draws into this in a follow-up step.
  const bottomBar = new PIXI.Container(); hud.addChild(bottomBar);
  const bottomBarBg = new PIXI.Graphics(); bottomBar.addChild(bottomBarBg);

  // ── DELIVERED BETTING-PANEL SKIN (conform-in-place) ───────────────────────
  // The delivered design panel's gold gradient system + element drawers, built
  // ONCE here (gradients cached). Pure presentation: the game's responsive
  // layout() skeleton + all spin/bet/state wiring stay intact — we only change
  // the VISUAL DRAW and element POSITIONS, guarded by `if (skin)` everywhere so
  // the game still runs if the module is absent (the procedural draw is kept as
  // the fallback). See src/ui/betting-bar-skin.js for the API.
  const skin = (typeof window !== 'undefined' && window.__makeSkin) ? window.__makeSkin(PIXI) : null;
  // Inter font chain from the delivered palette (graceful fallback if Inter
  // isn't bundled — only glyph shapes differ; spacing is measured at runtime).
  const BAR_FONT = (skin && skin.BAR && skin.BAR.FONT) || "Inter, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";
  // SPIN HERO — regenerate the 'spin' / 'stop' textures to the delivered panel
  // face (ring + radial center + circular arrow) by rendering skin.buildSpinFace()
  // to a texture. We keep the SAME 360×360 canvas footprint as the original
  // spinTex() so fitW(spinBtn) math + positions are byte-identical, and spinBtn
  // stays a plain sprite the ticker animates (press/commit/breathe) and whose
  // texture is swapped to 'stop' during a manual spin. The 'stop' face reuses the
  // same ring+center but overlays a gold rounded-square so the swap still reads as
  // a clear STOP state. Least-invasive: no child face, no double-scaling.
  if (skin) {
    try {
      const SS = 360, SR = SS * 0.42;   // match spinTex(): visible disc radius
      const frame = new PIXI.Rectangle(-SS / 2, -SS / 2, SS, SS);
      // soft warm glow disc behind the ring (panel spec: e8b94a α0.12)
      const mkFace = (stop) => {
        const wrap = new PIXI.Container();
        const glow = new PIXI.Graphics();
        skin.spinGlowInto(glow, 0, 0, SR * 1.18);
        wrap.addChild(glow);
        const { face } = skin.buildSpinFace(SR);
        wrap.addChild(face);
        if (stop) {
          // STOP affordance — gold rounded square centered over the panel face.
          const sq = new PIXI.Graphics();
          const u = SR * 0.34;
          sq.roundRect(-u, -u, 2 * u, 2 * u, u * 0.32)
            .fill({ color: 0xf6f1e6, alpha: 0.98 })
            .stroke({ color: 0xba852d, width: SR * 0.03, alpha: 0.9 });
          wrap.addChild(sq);
        }
        const t = app.renderer.generateTexture({ target: wrap, resolution: 2, frame });
        wrap.destroy({ children: true });
        return t;
      };
      const spinFaceTex = mkFace(false);
      const stopFaceTex = mkFace(true);
      if (spinFaceTex) { try { TEX.spin.destroy(true); } catch (e) {} TEX.spin = spinFaceTex; }
      if (stopFaceTex) { try { TEX.stop.destroy(true); } catch (e) {} TEX.stop = stopFaceTex; }
    } catch (e) { /* keep the procedural spinTex() faces on any failure */ }
  }
  // ── DELIVERED BETTING-PANEL COMPONENT (PORTRAIT ONLY) ─────────────────────
  // The studio's delivered BettingBarMobile (window.BettingBarMobile, the v8 port
  // exposed by main.ts). On PORTRAIT we mount THIS as the entire bottom bar; on
  // landscape it stays hidden and the existing conformed native bar renders as
  // now. Built once here, added to `hud`, and guarded with `if (deliveredBar)`
  // everywhere so the game still runs if the component is ever absent.
  const deliveredBar = (typeof window !== 'undefined' && window.BettingBarMobile)
    ? new window.BettingBarMobile({ bare:true })
    : null;
  if(deliveredBar){
    deliveredBar.visible = false;            // landscape default; layout() flips it on in portrait
    hud.addChild(deliveredBar);
    // Wire the component's events to the SAME game logic the native controls use.
    // SPIN — mirror the native spinBtn click handler exactly (replay lock,
    // skip-celebration, quick-stop, else start when idle).
    deliveredBar.on2('spin', () => {
      if(STAKE.replay) return;
      if(winFx.on){ winFx.fastFwd = true; return; }
      if(allReelsSpinning){ quickStopReels(); return; }
      if(State.phase === Phase.IDLE) startSpin();
    });
    deliveredBar.on2('bet:dec', () => bumpBet(-1));
    deliveredBar.on2('bet:inc', () => bumpBet(1));
    deliveredBar.on2('betmenu', () => { if(typeof showBetMenu === 'function') showBetMenu(); });
    deliveredBar.on2('autoplay', () => {
      if(State.autoplay.active){ stopAutoplay(); try { Sound.click(); } catch(e){} }
      else { openDrawer('autoplay'); }
      syncDeliveredBar();
    });
    deliveredBar.on2('turbo', () => {
      if(!turboAllowed()) return;   // UKGC etc. — turbo is illegal; ignore the tap
      State.turboMode = (State.turboMode + 1) % 3;
      refreshTurboBtn();
      try { Sound.click(); } catch(e){}
      persistSave();
      syncDeliveredBar();
      if(typeof layout === 'function') layout();
    });
    deliveredBar.on2('sound', () => {
      if(STAKE.replay) return;
      State.muted = !State.muted;
      Sound.setMuted(State.muted);
      btnSound._icon.texture = tex(State.muted ? 'icMute' : 'icSound');
      btnSound._setActive(!State.muted);
      persistSave();
      syncDeliveredBar();
    });
    deliveredBar.on2('volume', (v) => {
      if(STAKE.replay) return;
      const flipped = Sound.setVolume(v);   // fires ~60/s while dragging — keep light
      if(flipped){
        btnSound._icon.texture = tex(State.muted ? 'icMute' : 'icSound');
        btnSound._setActive(!State.muted);
        persistSave();
        syncDeliveredBar();
      }
    });
    deliveredBar.on2('menu', () => openDrawer('settings'));
  }
  // ── DELIVERED BETTING-PANEL COMPONENT (LANDSCAPE) ─────────────────────────
  // The studio's delivered BettingBarWeb (window.BettingBarWeb, the v8 port
  // exposed by main.ts) — the LANDSCAPE counterpart to BettingBarMobile. On
  // LANDSCAPE we mount THIS as the entire bottom bar; on portrait it stays
  // hidden and the mobile bar renders. Built once here, added to `hud`, and
  // guarded with `if (deliveredBarWeb)` everywhere so the game still runs if
  // the component is ever absent. Mirrors the portrait wiring above.
  const deliveredBarWeb = (typeof window !== 'undefined' && window.BettingBarWeb)
    ? new window.BettingBarWeb({ bare:true })
    : null;
  if(deliveredBarWeb){
    deliveredBarWeb.visible = false;          // portrait default; layout() flips it on in landscape
    hud.addChild(deliveredBarWeb);
    // SPIN — same logic as the mobile bar / native spinBtn click handler.
    deliveredBarWeb.on2('spin', () => {
      if(STAKE.replay) return;
      if(winFx.on){ winFx.fastFwd = true; return; }
      if(allReelsSpinning){ quickStopReels(); return; }
      if(State.phase === Phase.IDLE) startSpin();
    });
    deliveredBarWeb.on2('autoplay', () => {
      if(State.autoplay.active){ stopAutoplay(); try { Sound.click(); } catch(e){} }
      else { openDrawer('autoplay'); }
      syncDeliveredBar();
    });
    deliveredBarWeb.on2('turbo', () => {
      if(!turboAllowed()) return;   // UKGC etc. — turbo is illegal; ignore the tap
      State.turboMode = (State.turboMode + 1) % 3;
      refreshTurboBtn();
      try { Sound.click(); } catch(e){}
      persistSave();
      syncDeliveredBar();
      if(typeof layout === 'function') layout();
    });
    deliveredBarWeb.on2('sound', () => {
      if(STAKE.replay) return;
      State.muted = !State.muted;
      Sound.setMuted(State.muted);
      btnSound._icon.texture = tex(State.muted ? 'icMute' : 'icSound');
      btnSound._setActive(!State.muted);
      persistSave();
      syncDeliveredBar();
    });
    // Volume slider (sound-icon popup) → master level; resync icons if mute flipped.
    deliveredBarWeb.on2('volume', (v) => {
      if(STAKE.replay) return;
      const flipped = Sound.setVolume(v);   // fires ~60/s while dragging — keep light
      if(flipped){
        btnSound._icon.texture = tex(State.muted ? 'icMute' : 'icSound');
        btnSound._setActive(!State.muted);
        persistSave();
        syncDeliveredBar();
      }
    });
    deliveredBarWeb.on2('menu', () => openDrawer('settings'));
    // Web-bar chip-stack icon → QUICK BETS (bet menu), NOT buy bonus. Buy bonus
    // is the floating candy button (buyFab). (user: "this button → quick bets")
    deliveredBarWeb.on2('betmenu', () => { if(typeof showBetMenu === 'function') showBetMenu(); });
    // bet:set passes an ABSOLUTE betLevels index — the swipe carousel snaps to a
    // centred level across the full list, so no sliding-window remap is needed.
    deliveredBarWeb.on2('bet:set', (idx) => {
      if(State.phase !== Phase.IDLE) return;        // match bumpBet() guards
      if(State.autoplay.active) return;
      const i = Math.max(0, Math.min(State.betLevels.length - 1, idx | 0));
      if(i === State.betIdx) return;
      State.betIdx = i;
      State.betX6 = State.betLevels[State.betIdx];
      try { Sound.click(); } catch(e){}
      updateHUD();   // → syncDeliveredBar() repaints both bars
    });
    // ×2 — double the stake to the nearest available level <= 2x (else max).
    deliveredBarWeb.on2('bet:double', () => {
      if(State.phase !== Phase.IDLE || State.autoplay.active) return;
      const target = State.betX6 * 2;
      let idx = State.betIdx;
      for(let i = 0; i < State.betLevels.length; i++){ if(State.betLevels[i] <= target) idx = i; }
      State.betIdx = Math.max(0, Math.min(State.betLevels.length - 1, idx));
      State.betX6 = State.betLevels[State.betIdx];
      try { Sound.click(); } catch(e){}
      updateHUD();
    });
  }
  // Push current game state → the delivered component (display + control states).
  // All values are passed in DISPLAY units (micro ÷ API_AMOUNT_MULTIPLIER); the
  // component formats with toLocaleString. Called from updateHUD(), flashWinValue(),
  // bumpBet/turbo/sound/autoplay changes, and once per portrait layout().
  function syncDeliveredBar(){
    if(!deliveredBar && !deliveredBarWeb) return;
    const D = API_AMOUNT_MULTIPLIER;
    // Drive the SPIN→stop affordance from game phase so whichever bar is active
    // tracks the reels (called once per layout + at every state push).
    const spinning = !!allReelsSpinning;
    if(deliveredBar) try {
      deliveredBar.setBalance(State.balanceX6 / D);
      deliveredBar.setBet(State.betX6 / D);
      deliveredBar.setLastWin((State.lastWinX6 || 0) / D);
      // Currency prefix — CUR.s is the symbol/code ('$', 'SOL ', …); social mode
      // hides fiat symbols but keeps social-coin codes (matches fmtMoney()).
      deliveredBar.setCurrency(STAKE.social ? (CUR.social ? CUR.s.trim() : '') : CUR.s.trim());
      deliveredBar.setDemo(/^mock:\/\//.test(_normRgs));   // mock RGS = demo session
      deliveredBar.setAffordable(State.balanceX6 >= State.betX6);
      deliveredBar.setSteppers(State.betIdx > 0, State.betIdx < State.betLevels.length - 1);
      deliveredBar.setTurbo(State.turboMode);
      deliveredBar.setAutoplay(State.autoplay.active ? State.autoplay.remaining : null);
      deliveredBar.setSoundOn(!State.muted);
    } catch(e){ /* never let a HUD push break the round */ }
    // ── WEB BAR (landscape) ───────────────────────────────────────────────
    if(deliveredBarWeb) try {
      deliveredBarWeb.setBalance(State.balanceX6 / D);
      deliveredBarWeb.setBet(State.betX6 / D);
      deliveredBarWeb.setLastWin((State.lastWinX6 || 0) / D);
      deliveredBarWeb.setCurrency(STAKE.social ? (CUR.social ? CUR.s.trim() : '') : CUR.s.trim());
      deliveredBarWeb.setAffordable(State.balanceX6 >= State.betX6);
      deliveredBarWeb.setTurbo(State.turboMode);
      deliveredBarWeb.setAutoplay(State.autoplay.active ? State.autoplay.remaining : null);
      deliveredBarWeb.setSoundOn(!State.muted);
      deliveredBarWeb.setSpinning(spinning);
      // Swipe carousel: feed the FULL betLevels list (display units) + the active
      // index. The component centres the active level and snaps on drag-release,
      // emitting bet:set with an ABSOLUTE index.
      const levels = (State.betLevels || []).map(v => v / D);
      deliveredBarWeb.setBetLevels(levels, State.betIdx, (v) => fmtMoney(v * D));
    } catch(e){ /* never let a HUD push break the round */ }
  }
  // Per-frame breathing-aura layer for active buttons (turbo MAX, autoplay
  // active, BUY BONUS affordable). Drawn between bg + icon buttons so the
  // glow sits under the icon but on top of the chip. Cleared each frame.
  const btnAuraG = new PIXI.Graphics();
  btnAuraG.blendMode = 'add';
  bottomBar.addChild(btnAuraG);
  const txtStyle = (size,fill,extra) => Object.assign({
    fontFamily:'Luckiest Guy', fontSize:size, fill,
    stroke:{ color:0x2a1140, width:Math.max(2,size*0.13), join:'round' }, align:'center',
  }, extra || {});
  // ── VERTICAL-CENTERING CORRECTION (2026-06-01) ──────────────────────────────
  // PixiJS anchors Text by its FONT BOX, which for our display fonts is asymmetric
  // (Luckiest Guy ascent 196 / descent 49) → the glyph ink-centre sits ~2.7% (LG)
  // / ~4.3% (Fredoka) of box-height BELOW the box centre, so anchor.y=0.5 renders
  // the text slightly LOW. Measured in-browser via TextMetrics. vcY() returns the
  // corrected anchor.y so focal display texts read truly centred in their plaque.
  // (function decl — hoisted, so earlier-created texts like fbText can call it.)
  function vcY(fam){ return fam === 'Fredoka' ? 0.543 : 0.527; }

  const balPlaque = spr('balPlate'); hud.addChild(balPlaque);
  const balLabel = new PIXI.Text({ text:'BALANCE', style:txtStyle(11,0xff8ab8), resolution:2 });
  const balValue = new PIXI.Text({ text:'', style:txtStyle(18,0xffffff), resolution:2 });
  balLabel.anchor.set(0.5, vcY('Luckiest Guy')); balValue.anchor.set(0.5, vcY('Luckiest Guy')); hud.addChild(balLabel,balValue);

  // ── BET — procedural obsidian/magenta chip + brand typography (2026-05-30).
  // Was bare gold text on the bar ("not in our app style"); now a premium
  // token that matches the panels, drawn behind the value each frame.
  const betChipG = new PIXI.Graphics(); hud.addChild(betChipG);
  const betPlaque = spr('betPlate'); hud.addChild(betPlaque);
  const betLabel = new PIXI.Text({ text:'BET', style:txtStyle(10,0xff8ab8), resolution:2 });
  const betValue = new PIXI.Text({ text:'', style:txtStyle(18,0xffffff,{ stroke:{ color:0x07070d, width:3, join:'round' } }), resolution:2 });
  betLabel.anchor.set(0.5, vcY('Luckiest Guy')); betValue.anchor.set(0.5, vcY('Luckiest Guy')); hud.addChild(betValue,betLabel);
  // BET value is tap-to-open bet menu (faster than ± stepping for big jumps).
  // WCAG 2.5.5 hit-area override — the text glyphs themselves are ~52×27 px
  // which is BELOW the 44×44 minimum. Expand to 60×44 — wide enough to hit
  // reliably with a thumb, narrow enough to avoid colliding with the ±
  // steppers' 44px hit zones (gap between stepper centers ≈ 114 px, so
  // 60px between them leaves 27px buffer per side).
  betValue.eventMode = 'static'; betValue.cursor = 'pointer';
  betValue.hitArea = new PIXI.Rectangle(-30, -22, 60, 44);
  betValue.on('pointertap', () => { /* bound below after showBetMenu defined */ });
  betLabel.eventMode = 'static'; betLabel.cursor = 'pointer';
  betLabel.hitArea = new PIXI.Rectangle(-30, -16, 60, 32);
  betLabel.on('pointertap', () => { /* same */ });

  const minusBtn = spr('uiMinus'); const plusBtn = spr('uiPlus'); hud.addChild(minusBtn,plusBtn);
  // ── ALL ICONS SMOKE-WHITE — villain palette unification.
  // The sprite assets ship with a warm tint; force-tint here so every
  // glyph in the betting bar reads as the same whitesmoke (0xf5f7fa).
  minusBtn.tint = 0xf5f7fa;
  plusBtn.tint  = 0xf5f7fa;
  // Initial hit-area only (pre-layout default, scale=1). The REAL tap target is
  // set by stepHit() in layout() AFTER fitW() scales these sprites: a raw local
  // 52px rect on a ~0.1x sprite renders to only ~8px on screen, so it MUST be
  // scale-compensated per branch (was the #1 approval-blocker — fixed 2026-06).
  minusBtn.hitArea = new PIXI.Rectangle(-26, -26, 52, 52);
  plusBtn.hitArea  = new PIXI.Rectangle(-26, -26, 52, 52);

  const winPlaque = spr('winPlate'); winPlaque.alpha = 0; hud.addChild(winPlaque);
  const winLabel = new PIXI.Text({ text:'WIN', style:txtStyle(10,0xff8ab8), resolution:2 });
  const winValue = new PIXI.Text({ text:'', style:txtStyle(17,0xffffff), resolution:2 });
  winLabel.anchor.set(0.5, vcY('Luckiest Guy')); winValue.anchor.set(0.5, vcY('Luckiest Guy')); winPlaque.alpha = 0;
  hud.addChild(winLabel,winValue); winLabel.alpha = 0; winValue.alpha = 0;

  const spinHalo = new PIXI.Graphics(); hud.addChild(spinHalo);
  const spinBtn = spr('spin'); hud.addChild(spinBtn);
  let spinBtnBroke = false;

  // Icon button with FULL state system — hover (mouse-only) / press / active
  // toggle. Award-tier motion polish per Emil Kowalski (web-animations):
  //   - hover ON: scale 1.06, fast (~180ms ease-out)
  //   - hover OFF: 1.0, slightly slower (~240ms) so it doesn't snap
  //   - press: scale 0.97 (Emil's highest-ROI micro), interruptible
  //   - active tint LERPED over ~180ms — never an instant flash
  //   - "ping" glow ring on press (one-shot 320ms decay)
  // Transform + opacity + tint only — GPU-friendly, mobile-safe.
  function makeIconBtn(alias){
    const c = new PIXI.Container();
    const ping = new PIXI.Graphics(); c.addChild(ping); ping.alpha = 0;
    const icon = spr(alias); c.addChild(icon);
    c._icon = icon; c._baseScale = 1;
    c._targetScale = 1; c._displayScale = 1;
    c._hover = false; c._pressed = false; c._active = false;
    // Tint lerp slots — track current displayed tint + target as 3 channels
    c._tintTarget = [245, 247, 250];   // smoke-white default
    c._tintDisplay = [245, 247, 250];
    // ── VILLAIN PALETTE — all icons stay smoke-white ALWAYS.
    // The active state is communicated by SCALE / DOT BADGES on TURBO,
    // by the COUNT TEXT on AUTOPLAY, by the ICON FLIP on SOUND (sound/
    // mute). No gold or color tint for "active" — Cyber-Villain spec.
    c._activeColor = 0xf5f7fa;
    c._ping = ping; c._pingT0 = 0;
    c.eventMode = 'static'; c.cursor = 'pointer';
    // ── DEFAULT HIT AREA (2026-05-27 fix) ─────────────────────────────
    // Without this, PIXI computes hit zones from the icon SPRITE BOUNDS —
    // typically ~32 px. Result: clicks register only on the visible glyph
    // pixels, NOT on the chip background. User feedback "button click not
    // working correct only into the icon can work why ??? pls fix the
    // usable bug for the click on every button in the game".
    //
    // We set a 56×56 hit area here as a baseline so EVERY icon button has
    // a comfortable tap zone (>= WCAG 2.5.5's 44×44). Layout-specific
    // overrides may resize this for tight bars, but the default always
    // exists. The hit area scales with the container's transform so
    // 56×56 in local space stays consistent visually.
    c.hitArea = new PIXI.Rectangle(-36, -36, 72, 72);
    function apply(){
      const m = c._pressed ? 0.97 : (c._hover ? 1.06 : 1);
      c._targetScale = c._baseScale * m;
      // Compose tint target — active wins over inactive; pressed dims slightly
      const baseHex = c._active ? c._activeColor : THEME.colors.text;
      const r = (baseHex >> 16) & 0xff;
      const g = (baseHex >>  8) & 0xff;
      const b =  baseHex        & 0xff;
      const dim = c._pressed ? 0.86 : 1;
      c._tintTarget[0] = r*dim;
      c._tintTarget[1] = g*dim;
      c._tintTarget[2] = b*dim;
    }
    c.on('pointerover', e => { if(!e || e.pointerType==null || e.pointerType==='mouse'){ c._hover=true; apply(); } });
    c.on('pointerout', () => { c._hover=false; c._pressed=false; apply(); });
    c.on('pointerdown', () => {
      c._pressed=true; apply();
      // PING ring — one-shot expanding glow that decays in ~320ms
      c._pingT0 = performance.now();
    });
    c.on('pointerup', () => { c._pressed=false; apply(); });
    c.on('pointerupoutside', () => { c._pressed=false; c._hover=false; apply(); });
    c._setActive = v => { c._active=!!v; apply(); };
    c._apply = apply;
    hud.addChild(c); return c;
  }
  const btnSound = makeIconBtn('icSound');
  btnSound._icon.tint = 0xf5f7fa;
  btnSound._activeColor = 0xf5f7fa;
  const btnTurbo = makeIconBtn('icTurbo');
  btnTurbo._icon.tint = 0xf5f7fa;
  btnTurbo._activeColor = 0xf5f7fa;
  const btnAutoplay = makeIconBtn('icAuto');
  btnAutoplay._icon.tint = 0xf5f7fa;
  btnAutoplay._activeColor = 0xf5f7fa;
  // dynamic remaining-spins counter, shown over the autoplay button while active
  const autoCount = new PIXI.Text({ text:'', resolution:4, style:{
    fontFamily:'Luckiest Guy', fontSize:64, fill:0xf5f7fa, fontWeight:'700',
    stroke:{ color:0x0a0a0e, width:6, join:'round' }, align:'center' }});
  autoCount.anchor.set(0.5); autoCount.visible=false; autoCount.position.set(0,-4);
  btnAutoplay.addChild(autoCount); btnAutoplay._count = autoCount;
  // STOP affordance shown UNDER the count while autoplay runs — a game-styled
  // pink rounded square (universal "stop"). Makes "tap to stop" explicit so we
  // don't rely on morphing the SPIN button into a stop glyph.
  const autoStop = new PIXI.Graphics();
  autoStop.roundRect(-9,-9,18,18,4).fill({ color:0xba852d, alpha:0.96 })
          .stroke({ color:0xf6f1e6, width:1.6, alpha:0.92 });
  autoStop.position.set(0,22); autoStop.visible=false;
  btnAutoplay.addChild(autoStop); btnAutoplay._stop = autoStop;
  const btnHistory = makeIconBtn('icHistory');
  btnHistory._icon.tint = 0xf5f7fa; btnHistory._activeColor = 0xf5f7fa;
  const btnInfo = makeIconBtn('icInfo');
  btnInfo._icon.tint = 0xf5f7fa; btnInfo._activeColor = 0xf5f7fa;
  const btnSettings = makeIconBtn('icSettings');
  btnSettings._icon.tint = 0xf5f7fa; btnSettings._activeColor = 0xf5f7fa;
  const btnFullscreen = makeIconBtn('icFull');
  btnFullscreen._icon.tint = 0xf5f7fa; btnFullscreen._activeColor = 0xf5f7fa;
  // Hoisted module-scope array (was allocated PER FRAME inside the ticker
  // callback at ~60 allocs/sec — 2026-05-27 perf fix).
  const ICON_BTNS = [btnSound,btnTurbo,btnAutoplay,btnInfo,btnSettings,btnHistory,btnFullscreen];
  // Per AAA reference redesign: fullscreen + history removed from HUD (browser
  // chrome already has F11; history lives behind a future "session" drawer
  // when needed). Turbo stays in the bar — it's a 3-state cycle (OFF / TURBO
  // / MAX) with visual feedback driven by State.turboMode.
  btnFullscreen.visible = false; btnFullscreen.eventMode = 'none';
  btnHistory.visible    = false; btnHistory.eventMode    = 'none';

  // ── TURBO BADGE — small "MAX" pip overlaid on the turbo icon at mode 2.
  // Mode 1 is just the tinted bolt; mode 2 adds this pink dot to signal
  // "double turbo" without inventing a new icon.
  const turboBadge = new PIXI.Graphics();
  turboBadge.visible = false;
  btnTurbo.addChild(turboBadge);

  function refreshTurboBtn(){
    const m = State.turboMode;
    btnTurbo._active = m > 0;
    // 2-color: icon ALWAYS smoke-white at full strength. Active state
    // shown by a small smoke-white DOT badge (not by alpha dimming —
    // which made OFF state nearly invisible at low alpha).
    btnTurbo._icon.tint = 0xf5f7fa;
    btnTurbo._icon.alpha = 1.0;
    btnTurbo._activeColor = 0xf5f7fa;
    // Active badges — small smoke-white pip(s) at top-right. SHRUNK 50%
    // per user feedback "the points dots on the modes pls smaller". New:
    // 8% of icon width (was 15%) — reads as a tiny mode indicator, not
    // a giant notification badge competing with the icon.
    const r = (btnTurbo._icon.texture?.width || 32) * 0.08;
    const ox = (btnTurbo._icon.texture?.width || 32) * 0.34;
    const oy = -(btnTurbo._icon.texture?.height || 32) * 0.34;
    turboBadge.clear();
    if(m >= 1){
      // single dot for TURBO, two stacked dots for MAX
      turboBadge.circle(ox, oy, r*1.50).fill({ color:0x000000, alpha:0.45 });
      turboBadge.circle(ox, oy, r).fill({ color:0xe9bf5a, alpha:1 });   // gold pip
      if(m === 2){
        // Second pip BELOW the first — keeps both within the chip bounds
        // (left-offset version overlapped the icon glyph on small chips).
        turboBadge.circle(ox, oy + r*2.6, r*1.40).fill({ color:0x000000, alpha:0.45 });
        turboBadge.circle(ox, oy + r*2.6, r*0.85).fill({ color:0xe9bf5a, alpha:1 });
      }
      turboBadge.visible = true;
    } else {
      turboBadge.visible = false;
    }
  }
  refreshTurboBtn();

  btnSound.on('pointertap', () => {
    // 2026-05-27 audit fix — replay mode lock guard (matches the rest
    // of the control set). Without this, the icon could flip even though
    // sound is muted in replay; visual inconsistency.
    if(STAKE.replay) return;
    State.muted = !State.muted;
    btnSound._icon.texture = tex(State.muted ? 'icMute' : 'icSound');
    btnSound._setActive(!State.muted);
    Sound.setMuted(State.muted);   // actually silence/restore the whole bus (music + rush)
    persistSave();
  });
  btnTurbo.on('pointertap', () => {
    // 3-state cycle: OFF (0) → TURBO (1) → MAX (2) → OFF
    State.turboMode = (State.turboMode + 1) % 3;
    refreshTurboBtn();
    Sound.click();
    persistSave();
    // BUG FIX: chip backgrounds are drawn into bottomBarBg during layout()
    // — without a re-layout the chip color stays at the OLD mode tint
    // even though the icon tint updated. During autoplay this is the only
    // way the player notices the mode actually changed.
    if(typeof layout === 'function') layout();
  });
  btnInfo.on('pointertap', () => showInfoModal());
  btnSettings.on('pointertap', () => openDrawer('settings'));
  btnHistory.on('pointertap', () => openDrawer('history'));
  btnAutoplay.on('pointertap', () => {
    // BUG FIX: tap on autoplay button while autoplay is RUNNING must STOP
    // it (not open the drawer). Open drawer only when inactive.
    if(State.autoplay.active){
      stopAutoplay();
      try { Sound.click(); } catch(e){}
      return;
    }
    openDrawer('autoplay');
  });
  btnFullscreen.on('pointertap', () => {
    if(!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  // ── BIG/MEGA/EPIC WIN — VILLAIN THRONE CELEBRATION ─────────────
  // Procedural Pixi-only celebration popup per motion brief. Centered,
  // symmetrical, radiating light. Composed of:
  //   1. winFxThrone   — radial gradient bg + diamond burst rays (Graphics)
  //   2. winFxBurst    — sharp vector star burst lines (additive blend)
  //   3. bigWinLabel   — heavy condensed text ("BIG WIN" / "MEGA WIN" / "EPIC WIN")
  //   4. bigWinAmount  — large currency amount, count-up animated, dynamic font size
  // The legacy winFrame sprite (gold ornate art) is hidden — the villain
  // brief requires asset-free, pure Pixi primitives.
  const winDisplay = new PIXI.Container(); winDisplay.alpha = 0;
  stage.addChildAt(winDisplay, stage.getChildIndex(hud));
  const winFxThrone = new PIXI.Graphics();
  winFxThrone.blendMode = 'normal';
  winDisplay.addChild(winFxThrone);
  const winFxBurst = new PIXI.Graphics();
  winFxBurst.blendMode = 'add';
  winDisplay.addChild(winFxBurst);
  // ── GEM / COIN CASCADE LAYER (2026-05-31 award-tier ceremony) ──────────
  // A dedicated layer ABOVE the obsidian backdrop wash + ray burst but BELOW
  // the ribbon/amount text, so the tier-scaled treasure shower is always crisp
  // and the hero number stays perfectly readable. Lives in winDisplay-LOCAL
  // space → gems fountain from the amount and inherit the popup's scale/alpha
  // envelope, so they fade out WITH the celebration (no separate teardown of
  // motion needed). NORMAL blend → faceted dimensional gems (bright top facet +
  // glint), not flat glow blobs.
  const winGemG = new PIXI.Graphics();
  winDisplay.addChild(winGemG);
  const winGems = [];   // {shape,x,y,vx,vy,grav,life,t,color,r,rot,spin}
  // Lerp a packed-RGB hex toward white by f (0..1) — bright top facet of a gem.
  function _lightenHex(c, f){
    const r=(c>>16)&255, g=(c>>8)&255, b=c&255;
    return ((Math.round(r+(255-r)*f))<<16)|((Math.round(g+(255-g)*f))<<8)|Math.round(b+(255-b)*f);
  }
  // Spawn a tier-scaled gem / confetti cascade in winDisplay-local space.
  //   cute=false → magenta+gold faceted DIAMOND treasure (base BIG/MEGA/EPIC)
  //   cute=true  → soft pink+gold STARS + diamonds, floatier, some rains from
  //                above (FREE SPINS WIN — issue #173 "cuter VFX")
  // GPU-aware (×fxScale + _gpuWeak hard cap), fully suppressed under reduced
  // motion. Called from celebrate() (tier≥4) and the FS-win path.
  function spawnCascade(tier, cute, mult){
    if(isReduced()) return;
    mult = (mult == null) ? 1 : mult;   // 2-wave model: 0.45 at start, 1.0 on landing
    const W = app.screen.width, H = app.screen.height;
    const n = Math.ceil(((cute ? 16 : 11) + tier*4) * fxScale * mult);
    const cap = _gpuWeak ? 70 : 200;    // a touch more headroom for the 2-wave shower
    // Magenta-villain-crystal gem palette (was gold 0xffd24a/0xffce47 + cream —
    // off-brand). Soft→bright→hot magenta + an electric-fuchsia crystal-gem accent
    // (0xff2ad0, on-brand — was violet 0xc566ff) + crystal-white highlight.
    // No gold/violet. 2026-06-01; violet→fuchsia de-hue 2026-06-03.
    const pal = cute
      ? [0xff8ad0,0xff5ab0,0xffd9ec,0xff2ad0,0xffffff]
      : [0xff007f,0xff5ab0,0xff2ad0,0xffd9ec,0xffffff];
    const spreadX = Math.min(W*0.52, 440);   // wider fountain, less "single puff"
    for(let i=0;i<n;i++){
      if(winGems.length > cap) break;
      const rain = (i%4===0);   // a quarter rains down from above on EVERY tier (was cute-only)
      winGems.push({
        shape: cute ? (i%2 ? 'star':'diamond') : 'diamond',
        x: (vrnd()-0.5)*spreadX,
        y: rain ? -H*0.55 : (H*0.16 + vrnd()*H*0.12),
        vx: (vrnd()-0.5)*(cute?3.2:4.4),
        vy: rain ? (1.1+vrnd()*1.4) : -(7.2 + vrnd()*4.2 + tier*0.5),
        grav: cute ? 0.16 : 0.23,
        life: 1500 + vrnd()*1100,
        t: -(i % 6) * 26,   // per-gem stagger → a SHOWER over ~150ms, not one instant puff
        color: pal[(vrnd()*pal.length)|0],
        r: (cute?6:7) + vrnd()*5,
        rot: vrnd()*6.283, spin: (vrnd()-0.5)*(cute?0.16:0.12),
      });
    }
  }
  // Legacy frame sprite — kept for compatibility but hidden by default
  // winFrame sprite — HIDDEN permanently per user feedback "no img
  // asset on the bg for popups". Only the procedural villain throne
  // + ray burst renders behind the win text. Kept in the container for
  // back-compat with any code that reads winFrame.width (used for size
  // calcs in layoutWinCelebration) but always invisible.
  const winFrame = spr('frameWin');
  winFrame.visible = false;
  winFrame.alpha = 0;
  winDisplay.addChild(winFrame);
  // Heavy condensed villain typography — Luckiest Guy is the closest
  // bundled match to the brief's "Montserrat Bold / Industry Inc" call.
  // NOTE: PIXI v8 dropShadow style is set imperatively at runtime via
  //       style.dropShadow = {...} — not in the constructor (avoids the
  //       "drop shadow constructor mismatch" that wipes the text invisibly).
  // ── WIN POPUP TEXT STACK (2026-05-27 expert redesign) ──────────────
  // 3-tier hierarchy:
  //   (1) RIBBON STAMP — tier label "BIG WIN" / "MEGA WIN" in a wide pill
  //       with neon-magenta hairline border (tracked caps, smoke-white)
  //   (2) HERO AMOUNT  — huge tier-scaled currency value (THE focal point)
  //   (3) MULT SUBTEXT — small "×N.NN YOUR BET" line below (context)
  // Layout reads top-to-bottom in 1 second: ribbon → amount → multiplier.
  const winRibbonG = new PIXI.Graphics();   // ribbon pill background
  winDisplay.addChild(winRibbonG);
  const bigWinLabel = new PIXI.Text({ text:'WIN', resolution:3, style:{
    fontFamily:'Luckiest Guy', fontSize:22, fill:0xf5f7fa, letterSpacing:6,
  }});
  const bigWinAmount = new PIXI.Text({ text:'', resolution:4, style:{
    fontFamily:'Luckiest Guy', fontSize:64, fill:0xf5f7fa, letterSpacing:1.5,
    // Stroke darkened to obsidian for cleaner contrast against the
    // luminous pink throne backdrop. Drop shadow tinted toward magenta
    // (was pure black) so the depth bleed reads as part of the villain
    // palette, not a generic black halo.
    stroke:{ color:0x0a0a14, width:5, join:'round' },
    dropShadow: { alpha: 0.55, blur: 8, distance: 3, color: 0x4d0030 },
  }});
  const bigWinMult = new PIXI.Text({ text:'', resolution:3, style:{
    fontFamily:'Fredoka', fontSize:13, fill:0xf5f7fa, letterSpacing:4, fontWeight:'700',
  }});
  bigWinLabel.anchor.set(0.5, vcY('Luckiest Guy')); bigWinAmount.anchor.set(0.5, vcY('Luckiest Guy')); bigWinMult.anchor.set(0.5, vcY('Fredoka'));
  bigWinMult.alpha = 0.65;
  winDisplay.addChild(bigWinLabel, bigWinAmount, bigWinMult);
  // Thin smoke-white underline below the amount (focal anchor)
  const winUnderlineG = new PIXI.Graphics();
  winDisplay.addChild(winUnderlineG);
  // Count-up state for big-win celebration is initialised inside celebrate()
  // and reset in the render loop. (winFx itself is declared later.)

  // ── BUY BONUS BAR ─────────────────────────────────────────────
  // Top-level commercial CTA — bigger button, big text, star icon on the
  // left. Reads as "the special action" the player can take any time.
  const buyBar = new PIXI.Container(); hud.addChild(buyBar);
  buyBar.eventMode = 'static'; buyBar.cursor = 'pointer';
  const buyBg = spr('buyPlate'); buyBar.addChild(buyBg);   // legacy ribbon (hidden inline)
  // CROWN ICON on the left of the pill — top-paying symbol carries the
  // most aspirational weight; the eye reads "premium bonus reward" before
  // the text. (Was the Star scatter — but the game's brand is "SHINING
  // POP" and the crown logo dominates the splash, so consistency wins.)
  const buyIcon = new PIXI.Sprite(TEX['s7']); buyIcon.anchor.set(0.5);
  buyBar.addChild(buyIcon);
  const buyTitle = new PIXI.Text({ text:'BUY BONUS', resolution:3, style:{
    fontFamily:'Luckiest Guy', fontSize:18, fill:0xffffff,
    letterSpacing:1.2, stroke:{ color:0x2a0a1e, width:2.5, join:'round' }   // dark magenta-obsidian outline (was brown gold-era 0x4a2400)
  }});
  const buyCost = new PIXI.Text({ text:'', resolution:3, style:{
    fontFamily:'Luckiest Guy', fontSize:18, fill:0xffe6f4,   // crystal-white-pink cost (was gold 0xffe066)
    letterSpacing:0.8, stroke:{ color:0x2a0a1e, width:2, join:'round' }
  }});
  buyTitle.anchor.set(0.5); buyCost.anchor.set(0.5);
  buyBar.addChild(buyTitle,buyCost);
  buyBar._baseScale = 1; buyBar._pulse = 0;
  if(!COMPLY.allow_buy_bonus || STAKE.replay) buyBar.visible = false;

  // ── NATIVE-BAR OBJECT SET TOGGLE ─────────────────────────────────────────
  // When the delivered component is mounted (portrait), ALL native bar visuals +
  // controls are hidden and made non-interactive; in landscape they are restored
  // so the existing conformed bar renders/handles EXACTLY as before. The objects
  // are NEVER removed/renamed — the ticker + updateHUD still write to them — we
  // only flip .visible/.eventMode. `bottomBarBg` (the drawn bar surface) is the
  // bar's whole visual, so it toggles too.
  //
  // IMPORTANT (landscape parity): the conformed bar keeps the legacy PLAQUE
  // sprites (balPlaque/betPlaque/winPlaque) + chip/halo Graphics HIDDEN and the
  // native layout() itself sets their .visible every call. So on RESTORE we do
  // NOT force those visible (let native layout own them); we only restore the
  // live TEXT handles + interactive controls. On HIDE (portrait) we force the
  // whole set off so nothing peeks behind the delivered bar.
  const NATIVE_BAR_INTERACTIVE = [spinBtn, minusBtn, plusBtn, btnSound, btnTurbo, btnAutoplay, btnInfo, btnSettings, buyBar];
  const NATIVE_BAR_TEXT = [balLabel, balValue, betLabel, betValue, winLabel, winValue];
  const NATIVE_BAR_LEGACY = [balPlaque, betPlaque, winPlaque, betChipG, spinHalo];
  // BUY visibility is also gated by compliance/replay — remember that so portrait
  // restore can't un-hide a buy bar that policy says must stay hidden.
  const _buyAllowed = () => COMPLY.allow_buy_bonus && !STAKE.replay;
  function setNativeBarVisible(on){
    NATIVE_BAR_TEXT.forEach(o => { if(o) o.visible = on; });
    NATIVE_BAR_INTERACTIVE.forEach(o => {
      if(!o) return;
      if(o === buyBar){ o.visible = on && _buyAllowed(); }
      else o.visible = on;
      o.eventMode = (o.visible && on) ? 'static' : 'none';
    });
    bottomBarBg.visible = on;
    // Legacy plaques/graphics: hide them in portrait; in landscape leave them to
    // the native layout (which manages their .visible itself, keeping them off).
    if(!on) NATIVE_BAR_LEGACY.forEach(o => { if(o) o.visible = false; });
    // betValue/betLabel are tap-to-open-bet-menu text handles → restore 'static'.
    if(on){ betValue.eventMode = 'static'; betLabel.eventMode = 'static'; }
    else  { betValue.eventMode = 'none';   betLabel.eventMode = 'none'; }
    // turbo/fullscreen/history stay hidden regardless (existing rules).
    btnHistory.visible = false; btnFullscreen.visible = false;
  }

  // ── BONUS MODE FX LAYER — persistent overlays during free spins.
  // Drawn ABOVE reels but BELOW the BUY BONUS modal. Holds the wild-reel
  // flame glow (HOT), sticky-crown markers (MEGA), and the per-spin
  // multiplier reveal text. Cleared each frame, repopulated by render
  // loop only when State.phase === FREESPIN.
  const bonusFxG = new PIXI.Graphics(); bonusFxG.blendMode = 'normal'; stage.addChild(bonusFxG);

  // ── DEV: human-readable scene labels (build AQ) ─────────────────────────────
  // pixi.min.js minifies class names, so the PixiJS devtools tree showed only
  // "hr"/"dt"/"Wi". Labelling the key nodes makes the tree navigable AND lets us
  // pinpoint exactly which element draws the recurring magenta win-bar: open the
  // devtools on a BIG win and read the label of the visible full-width element.
  try {
    const _lbl = (n, l) => { if (n) n.label = l; };
    _lbl(reelArea,'reelArea'); _lbl(reelsWrap,'reelsWrap·SYMBOLS'); _lbl(frameG,'frameG·reelFrame');
    _lbl(reelMask,'reelMask'); _lbl(frameTopG,'frameTopG·portalGlow(add)'); _lbl(winGlowLayer,'winGlowLayer(add)');
    _lbl(lineG,'lineG·WIN-LINE-CONNECTOR(add)'); _lbl(winShadowG,'winShadowG'); _lbl(winGlowAddG,'winGlowAddG·perCellGlow(add)');
    _lbl(winFrameG,'winFrameG·winCellFrames'); _lbl(hud,'hud'); _lbl(buyBar,'buyBar'); _lbl(bonusFxG,'bonusFxG');
    _lbl(winDisplay,'winDisplay·BIG-WIN-CELEBRATION'); _lbl(winFxThrone,'winFxThrone'); _lbl(winFxBurst,'winFxBurst·burst(add)');
    _lbl(winRibbonG,'winRibbonG·ribbon'); _lbl(winUnderlineG,'winUnderlineG·amountUnderline');
    _lbl(winLabel,'winLabel·HUD'); _lbl(winValue,'winValue·HUD'); _lbl(spinBtn,'spinBtn');
  } catch(e){}
  const bonusFxAddG = new PIXI.Graphics(); bonusFxAddG.blendMode = 'add'; stage.addChild(bonusFxAddG);
  // Persistent FS HUD: spin counter + multiplier display
  const bonusHudText = new PIXI.Text({ text:'', resolution:3, style:{
    fontFamily:'Luckiest Guy', fontSize:18, fill:0xffe6f4,   // crystal-white-pink FS HUD counter (was gold 0xffe9b0)
    stroke:{ color:0x2a1140, width:3, join:'round' }, align:'center',
  }});
  bonusHudText.anchor.set(0.5, vcY('Luckiest Guy'));
  bonusHudText.alpha = 0;
  stage.addChild(bonusHudText);
  // ── MEGA per-spin multiplier center-screen reveal (2026-05-27) ─────
  // Big "×N" text shown over the reels when MEGA mode rolls a new
  // multiplier. Replaces the previous invisible glow-only reveal (which
  // had 4% alpha halos and no actual digit — silent feedback bug).
  const bonusMultBig = new PIXI.Text({ text:'', resolution:3, style:{
    fontFamily:'Luckiest Guy', fontSize:90, fill:0xf5f7fa, letterSpacing:2,
    stroke:{ color:0x0a0a14, width:6, join:'round' },
    dropShadow: { alpha: 0.65, blur: 10, distance: 4, color: 0x4d0030 },
    align: 'center',
  }});
  bonusMultBig.anchor.set(0.5);
  bonusMultBig.alpha = 0;
  bonusMultBig.visible = false;
  stage.addChild(bonusMultBig);
  // HOT mode "WILD REEL" label — sits in the chevron pill above the wild
  // reel column. Procedural pill drawn in drawBonusFx; this is the text.
  const bonusWildLabel = new PIXI.Text({ text:'WILD REEL', resolution:3, style:{
    fontFamily:'Fredoka', fontSize:11, fill:0xf5f7fa, letterSpacing:3,
    fontWeight:'700', align:'center',
  }});
  bonusWildLabel.anchor.set(0.5);
  bonusWildLabel.visible = false;
  stage.addChild(bonusWildLabel);
  // MEGA mode "LOCKED" mini-label, one shared instance moved per cell
  // (only the LAST sticky cell will show it — for cleanliness). Replaces
  // the wordless frame which didn't communicate the lock concept.
  const bonusLockLabel = new PIXI.Text({ text:'LOCKED', resolution:3, style:{
    fontFamily:'Fredoka', fontSize:9, fill:0xf5f7fa, letterSpacing:2.5,
    fontWeight:'700', align:'center',
  }});
  bonusLockLabel.anchor.set(0.5);
  bonusLockLabel.visible = false;
  stage.addChild(bonusLockLabel);
  // ── WIN AMOUNT FLY-UP TEXT POOL (2026-05-27 AAA reward feedback) ───
  // Per AAA slot signature: when a payline wins, a small "+$X.XX" text
  // floats up from each winning cell and fades. Tells the player exactly
  // what each line is worth. Pool of 8 Text objects (max ~8 concurrent
  // wins) reused via WeakMap-style _busy flag to avoid GC churn.
  const _flyUpPool = [];
  for(let i = 0; i < 8; i++){
    const t = new PIXI.Text({ text:'+'+fmtMoney(0), resolution:2, style:{   // NON-EMPTY init + resolution 2: an empty Text + res:3 + letterSpacing produced a DEGENERATE texture/bounds (width flips 0↔19369) that rendered as a full-width line — THE "magenta/yellow line" bug. (placeholder never shows: idle pool is off-stage. Uses fmtMoney(0) so it's currency-correct — no hardcoded "$" leaks under ?currency=BTC etc.)
      fontFamily:'Luckiest Guy', fontSize:22, fill:0xff8ad0,   // soft-magenta win-amount text (was gold; pool is disabled but kept on-brand)
      // 2026-05-27 perf fix — dropped dropShadow on fly-up pool. With 8
      // instances each forcing an offscreen render pass on mobile, this
      // was burning ~3 FPS on iPhone SE. Stroke alone provides plenty
      // of contrast for the smoke-magenta-on-bg color combo.
      stroke:{ color:0x06060c, width:3, join:'round' },
    }});
    t.anchor.set(0.5);
    t.label = 'flyUp·winAmount(pool)';   // pooled +$ fly-up text — idle OFF-STAGE until a win
    t.visible = false;
    t.renderable = false;          // FULLY inert while idle: never renders, and (key) an empty
    t.position.set(-9999, -9999);  // Text at (0,0) produced a bogus full-width bound — THE magenta
    t.alpha = 0;                   // "line" the user traced to this pool. Off-stage + inert kills it.
    t._busy = false;
    t._t0 = 0;
    t._startY = 0;
    t._cx = 0;
    stage.addChild(t);
    _flyUpPool.push(t);
  }
  function spawnFlyUpAmount(cx, cy, amountX6){
    // DISABLED (build AV): the pooled PIXI.Text never measured correctly — its
    // width flipped between 0 (invisible) and ~19369 (a full-width strip), i.e.
    // it ONLY ever rendered as the recurring "magenta/yellow line" bug, never a
    // clean "+$X". The win is already shown by the per-cell symbol glow + the
    // win-line connector + the HUD WIN counter, so this broken juice element is
    // dropped. (Re-enable only via a robust BitmapText reimplementation.)
    return;
    if(isReduced() || amountX6 <= 0) return;
    const t = _flyUpPool.find(x => !x._busy);
    if(!t) return;   // pool full — skip
    t._busy = true;
    t._t0 = performance.now();
    t._cx = cx;
    t._startY = cy;
    t.text = '+' + fmtMoney(amountX6);
    t.visible = true;
    t.renderable = true;
    t.alpha = 0;
    t.position.set(cx, cy);
    t.scale.set(0.6);
  }
  // Animate fly-ups every frame (called from main ticker)
  function tickFlyUps(now){
    const dur = 1200;
    for(let i = 0; i < _flyUpPool.length; i++){
      const t = _flyUpPool[i];
      if(!t._busy) continue;
      const el = now - t._t0;
      if(el >= dur){
        t._busy = false; t.visible = false; t.renderable = false; t.alpha = 0; t.position.set(-9999,-9999);
        continue;
      }
      const p = el / dur;
      // Phase 1 (0-180ms): pop-in via outBack (scale 0.6 → 1.0)
      // Phase 2 (180-1000ms): float up + hold scale
      // Phase 3 (1000-1200ms): fade out
      let scale, alpha;
      if(el < 180){
        const ip = el / 180;
        scale = 0.6 + 0.4 * outBack(ip);
        alpha = ip;
      } else if(el < 1000){
        scale = 1.0;
        alpha = 1;
      } else {
        scale = 1.0 - (el - 1000) / 200 * 0.1;
        alpha = 1 - (el - 1000) / 200;
      }
      // Float up by 1.5 cells over the full duration (ease-out cubic)
      const float = (1 - Math.pow(1 - p, 3)) * (CELL * 1.4);
      t.position.set(t._cx, t._startY - float);
      t.scale.set(scale);
      t.alpha = alpha;
    }
  }
  // Live bonus-mode state (set by runFreeSpinScene before each spin)
  let _bonusState = {
    active: false,
    mode: 'bonus_standard',
    wildReel: null,
    stickyCrowns: false,
    stickyMap: [],        // grid of cells that have a sticky crown
    spinNum: 0,
    totalSpins: 0,
    spinMult: 1,
    totalMult: 0,         // accumulated mult for MEGA mode display
    revealedMultT0: 0,    // animation start for per-spin mult reveal
  };

  // ── PARTICLES ─────────────────────────────────────────────────
  const particles = [];
  const particleG = new PIXI.Graphics(); particleG.blendMode = 'add'; stage.addChild(particleG);
  // ── BONUS IGNITION (2026-05-31) — premium shader-look replacement for the
  // basic scatter dot-burst at the free-spins trigger. Pure additive Graphics
  // (no GLSL → zero compile risk for Stake's "console must be silent" rule):
  // a CHARGE-UP (converging energy filaments) → DETONATION flash → expanding
  // CHROMATIC SHOCKWAVE ring (magenta/white/cyan split = fake chromatic
  // aberration, the classic "shader" read) on each scatter cell. Drawn ABOVE
  // particleG so the ring sits over the reels. Self-expiring (~1.15 s).
  const _ignites = [];
  const bonusIgniteG = new PIXI.Graphics(); bonusIgniteG.blendMode = 'add'; stage.addChild(bonusIgniteG);
  // ── FREE SPINS PORTAL (2026-05-31) — cinematic centre VFX that REPLACES the
  // old 3-beat gold particle burst at the free-spins transition (user: "the FS
  // start, before the FREE SPINS text, has a basic particle celebration in the
  // centre — replace it with another effect"). Pure additive Graphics, no GLSL:
  // IMPLOSION (energy races inward) → PORTAL BURST (flash + radial rays) →
  // CHROMATIC SHOCKWAVE ring → ROTATING VORTEX glow that holds behind the
  // rising banner. Drawn on `stage` so it's centre-screen over the dimmed reels.
  const _fsPortal = { active:false, t0:0 };
  const fsPortalG = new PIXI.Graphics(); fsPortalG.blendMode = 'add'; stage.addChild(fsPortalG);
  function spawnFsPortal(){
    if(isReduced()) return;
    _fsPortal.active = true;
    _fsPortal.t0 = performance.now();
  }
  function drawFsPortal(now){
    fsPortalG.clear();
    if(!_fsPortal.active) return;
    const el = now - _fsPortal.t0;
    const DUR = 1500;
    if(el >= DUR){ _fsPortal.active = false; return; }
    const cx = GX + GW/2, cy = GY + GH/2;
    const R0 = Math.min(GW, GH) * 0.5;          // portal scale = half the shorter grid side
    // PHASE 1 — IMPLOSION (0-240 ms): 14 gold filaments race INWARD, core builds.
    if(el < 240){
      const p = el/240;
      for(let k=0;k<14;k++){
        const a  = (k/14)*Math.PI*2 + p*0.8;
        const r1 = R0*(1.7 - 1.1*p);             // outer end (converging in)
        const r0 = R0*(1.2 - 0.95*p);            // inner end
        fsPortalG.moveTo(cx+Math.cos(a)*r1, cy+Math.sin(a)*r1)
                 .lineTo(cx+Math.cos(a)*r0, cy+Math.sin(a)*r0)
                 .stroke({ color:0xff5ab0, width:2.2, alpha:0.42*p });
      }
      fsPortalG.circle(cx, cy, R0*(0.08+0.18*p)).fill({ color:0xffffff, alpha:0.18+0.40*p });
    }
    // PHASE 2 — PORTAL BURST (210-580 ms): hot core flash + radial light rays.
    if(el >= 210 && el < 580){
      const p  = (el-210)/370;
      const fl = Math.sin(p*Math.PI);
      fsPortalG.circle(cx, cy, R0*(0.22+0.55*p)).fill({ color:0xff5ab0, alpha:0.26*fl })
               .circle(cx, cy, R0*(0.10+0.30*p)).fill({ color:0xffffff, alpha:0.70*fl });
      for(let k=0;k<20;k++){
        const a = (k/20)*Math.PI*2 + p*0.4, len = R0*(0.6+1.2*p);
        fsPortalG.moveTo(cx, cy).lineTo(cx+Math.cos(a)*len, cy+Math.sin(a)*len)
                 .stroke({ color:0xffd9ec, width:3.2*(1-p), alpha:0.40*fl });
      }
    }
    // PHASE 3 — CHROMATIC SHOCKWAVE (250+): expanding gold/white/cyan ring.
    if(el >= 250){
      const p = Math.min(1, (el-250)/950);
      const e = 1 - Math.pow(1-p, 3);
      const R = R0*(0.30 + e*2.0);
      const a = (1-p)*(1-p)*0.85;
      const w = (1-p)*8 + 1.2;
      fsPortalG.circle(cx, cy, R+6).stroke({ color:0xff007f, width:w,     alpha:a*0.8 });
      fsPortalG.circle(cx, cy, R  ).stroke({ color:0xffe6f4, width:w*0.6, alpha:a     });
      fsPortalG.circle(cx, cy, R-6).stroke({ color:0x9fe9ff, width:w*0.5, alpha:a*0.5 });
    }
    // PHASE 4 — ROTATING VORTEX (380-1500 ms): a slow gold swirl that holds
    // behind the rising banner, then fades. Sells the "gateway is open" beat.
    if(el >= 380){
      const fadeIn  = Math.min(1,(el-380)/260);
      const fadeOut = Math.max(0,1-(el-1050)/450);
      const vp = fadeIn*fadeOut, spin = now*0.0021;
      for(let k=0;k<6;k++){
        const a = spin + (k/6)*Math.PI*2;
        fsPortalG.circle(cx+Math.cos(a)*R0*0.42, cy+Math.sin(a)*R0*0.42, R0*0.22).fill({ color:0xff5ab0, alpha:0.05*vp });
      }
      fsPortalG.circle(cx, cy, R0*0.40).fill({ color:0xff5ab0, alpha:0.045*vp });
    }
  }
  function spawnBonusIgnition(cells){
    if(isReduced() || !cells || !cells.length) return;
    _ignites.push({
      cells: cells.map(c => { const cc = cellCenter(c.r, c.row); return { x:cc.x, y:cc.y }; }),
      t0: performance.now(),
    });
  }
  function drawBonusIgnite(now){
    bonusIgniteG.clear();
    if(!_ignites.length) return;
    const DUR = 1150;
    for(let i = _ignites.length - 1; i >= 0; i--){
      const ig = _ignites[i];
      const el = now - ig.t0;
      if(el >= DUR){ _ignites.splice(i, 1); continue; }
      for(const c of ig.cells){
        // PHASE 1 — CHARGE-UP (0-240 ms): 7 energy filaments converge inward,
        // a core brightens. Reads as the symbol "powering up" the bonus.
        if(el < 240){
          const p = el / 240;
          const conv = 1 - p;
          const coreR = CELL*0.10 + p*CELL*0.16;
          for(let k = 0; k < 7; k++){
            const a  = (k/7)*Math.PI*2 + p*0.6;
            const r0 = CELL*0.95*conv + CELL*0.30;
            const r1 = CELL*0.20*conv + coreR;
            bonusIgniteG.moveTo(c.x+Math.cos(a)*r0, c.y+Math.sin(a)*r0)
                        .lineTo(c.x+Math.cos(a)*r1, c.y+Math.sin(a)*r1)
                        .stroke({ color:0xff5ab0, width:1.6, alpha:0.5*p });
          }
          bonusIgniteG.circle(c.x, c.y, coreR*1.6).fill({ color:0xff2f9f, alpha:0.10+0.18*p })
                      .circle(c.x, c.y, coreR     ).fill({ color:0xffffff, alpha:0.18+0.30*p });
        }
        // PHASE 2 — DETONATION (220-380 ms): a broad pink boom-wash + a hot white
        // core + an 8-spike star. Punchy enough to read over the bright reel art.
        if(el >= 220 && el < 380){
          const p  = (el-220)/160;
          const fl = Math.sin(p*Math.PI);                 // 0→1→0
          bonusIgniteG.circle(c.x, c.y, CELL*(0.35+1.05*p)).fill({ color:0xff2f9f, alpha:0.16*fl })   // wide boom wash
                      .circle(c.x, c.y, CELL*(0.20+0.55*p)).fill({ color:0xff2f9f, alpha:0.30*fl })
                      .circle(c.x, c.y, CELL*(0.10+0.34*p)).fill({ color:0xffffff, alpha:0.78*fl });   // hot core
          for(let k = 0; k < 8; k++){
            const a = (k/8)*Math.PI*2, len = CELL*(0.55+1.05*p);
            bonusIgniteG.moveTo(c.x, c.y).lineTo(c.x+Math.cos(a)*len, c.y+Math.sin(a)*len)
                        .stroke({ color:0xfff4fb, width:3.4*(1-p), alpha:0.65*fl });
          }
        }
        // PHASE 3 — CHROMATIC SHOCKWAVE (320-1150 ms): an expanding ring drawn
        // 4× at offset radii/tints — magenta outer, hot-white leading edge, smoke
        // mid, cyan inner ghost — = fake chromatic aberration, the premium "shader"
        // signature. Cyan reads best against the warm reel art, so it leads contrast.
        if(el >= 320){
          const p = Math.min(1, (el-320)/830);
          const e = 1 - Math.pow(1-p, 3);                 // easeOutCubic
          const R = CELL*0.25 + e*CELL*2.05;
          const a = (1-p)*(1-p)*0.95;
          const w = (1-p)*6.5 + 1.0;
          bonusIgniteG.circle(c.x, c.y, R+4).stroke({ color:0xff2f9f, width:w,      alpha:a*0.85 })   // magenta fringe (outer)
                      .circle(c.x, c.y, R+1).stroke({ color:0xffffff, width:w*0.5,  alpha:a       })   // hot leading edge
                      .circle(c.x, c.y, R  ).stroke({ color:0xfff4fb, width:w*0.9,  alpha:a*0.9   })   // smoke core
                      .circle(c.x, c.y, R-4).stroke({ color:0x37e6ff, width:w*0.75, alpha:a*0.7   });  // cyan fringe (inner)
          if(p < 0.5){
            const bp = 1 - p*2;
            bonusIgniteG.circle(c.x, c.y, R*0.9).fill({ color:0xff2f9f, alpha:0.07*bp });
          }
        }
      }
    }
  }
  function spawnParticles(cx,cy,count,tier){
    // ── PARTICLE BURST — FINAL PASS (2026-05-27 #3) ───────────────────
    // User likes the VFX direction but wants particles smaller still.
    // Trimmed once more:
    //   multiplier  ×2.0 → ×1.6 (20% fewer)
    //   radius      2.5-5.5px → 1.8-3.8px (~30% smaller)
    //   life       700-1500ms → 580-1100ms (snappier clear)
    // The pacing + colors stay: sparkle DUST that scales with tier
    // (more particles + brighter colors for big wins).
    // P1 — micro-silence: suppress spawns during the "held breath" before
    // a big-win explosion. The stillness amplifies the burst that follows.
    if(performance.now() < _silenceUntil) return;
    if(window.innerWidth < 600 || window.innerHeight < 600){
      count = Math.ceil(count * 0.75);
    }
    count = Math.ceil(count * 1.6 * fxScale);   // P3 — GPU-tier scalar
    // Hard cap the live particle array so MEGA bonus + epic celebration
    // chains can't pile up 1000+ sprites and tank mobile fillrate.
    const _capN = _gpuWeak ? 140 : 320;
    if(particles.length > _capN) return;
    const colors = tier>=5
      ? [0xff007f, 0xff5a9c, 0xff8ab8, 0xf5f7fa, 0xffffff]
      : tier>=3
      ? [0xff007f, 0xff5a9c, 0xff8ab8, 0xf5f7fa]
      : [0xff5a9c, 0xff8ab8, 0xf5f7fa];
    for(let i=0;i<count;i++){
      const angle = vrnd()*Math.PI*2;
      const speed = 2.2 + vrnd()*vrnd()*(tier*1.2) + tier*0.28;
      const kick = -(1.6 + tier*0.36);
      particles.push({
        x:cx, y:cy,
        vx: Math.cos(angle)*speed,
        vy: Math.sin(angle)*speed + kick,
        life: 580 + tier*140,
        t: 0,
        color: colors[i%colors.length],
        // 1.8-3.8px sparkles
        r: 1.8 + vrnd()*2.0,
        spin: (vrnd()-0.5) * 0.05,
        rot: 0,
      });
    }
  }
  let shakeAmount = 0, shakeT0 = 0;
  // ── CAMERA PUSH-IN state (2026-05-27 AAA cinematic) ────────────────
  // When set, the stage scales 1.0 → 1.04 → 1.0 over ~1500ms creating a
  // "dolly-in" feel for the big moment (bonus trigger, mega win).
  let _camPushT0 = 0;
  const _camPushDur = 1500;

  // ── MODALS (shared makeModalBtn) ──────────────────────────────
  function makeModalBtn(parent,label,fill,textFill){
    const c = new PIXI.Container(); c.eventMode='static'; c.cursor='pointer';
    const bg = new PIXI.Graphics(); c.addChild(bg);
    const t = new PIXI.Text({ text:label, style:txtStyle(14,textFill) }); t.anchor.set(0.5); c.addChild(t);
    c._bg = bg; c._t = t; c._fill = fill;
    c.on('pointerdown', () => c.scale.set(0.96));
    c.on('pointerup', () => c.scale.set(1));
    c.on('pointerupoutside', () => c.scale.set(1));
    parent.addChild(c); return c;
  }

  // ── UI-KIT: ONE CANONICAL POPUP BUTTON (2026-06-01) ───────────────
  // Single source of truth for every popup/modal button — they stop hand-drawing
  // 7 near-duplicate styles that drifted (one even kept a near-black wine body).
  //   'primary'   — vibrant glossy magenta crystal (CTAs: BUY/CONFIRM/CONTINUE/
  //                 RETRY/MAX BET/BUY BONUS)
  //   'secondary' — obsidian glass + magenta hairline (CANCEL/STOP/nav arrows)
  // Matches drawPanelChrome + the spin-button language. Draw into a cleared
  // Graphics centred on (0,0); w/h are the button size.
  function drawGlossyBtn(g, w, h, kind){
    const hw = w / 2, hh = h / 2, r = h * 0.45;
    // Gold variants ('primary-gold' / 'secondary-gold') for the shared studio
    // betting surfaces; magenta originals stay for game-state CTAs (BUY BONUS).
    const gold = kind === 'primary-gold' || kind === 'secondary-gold';
    g.clear();
    if(kind === 'secondary' || kind === 'secondary-gold'){
      const sheen = gold ? 0xe9bf5a : 0xff5ab0, rim = gold ? 0xf0d089 : 0xff8ad0;
      g.roundRect(-hw, -hh, w, h, r).fill({ color: 0x140d1c, alpha: 0.96 })               // obsidian glass
       .roundRect(-hw + 1, -hh + 1, w - 2, h * 0.5, r).fill({ color: sheen, alpha: 0.06 })  // faint top sheen
       .roundRect(-hw, -hh, w, h, r).stroke({ color: rim, width: 1.3, alpha: 0.55 });  // rim hairline
    } else {
      const bloom = gold ? 0xc9a24a : 0xff007f, body = gold ? 0xba852d : 0xd11a78,
            sheen = gold ? 0xf0d089 : 0xff5ab0, rim = gold ? 0xfadf8e : 0xff8ad0;
      g.roundRect(-hw - 2, -hh - 2, w + 4, h + 4, r + 1).fill({ color: bloom, alpha: 0.22 })  // outer bloom
       .roundRect(-hw, -hh, w, h, r).fill({ color: body, alpha: 1 })                    // vibrant body
       .roundRect(-hw + 1, -hh + 1, w - 2, h * 0.52, r).fill({ color: sheen, alpha: 0.55 })  // glossy top sheen
       .roundRect(-hw + 6, -hh + 2, w - 12, 1.4, 0.7).fill({ color: 0xffffff, alpha: 0.5 })  // hot highlight
       .roundRect(-hw, -hh, w, h, r).stroke({ color: rim, width: 1.5, alpha: 1 });     // crystal rim
    }
  }

  // ── SURF: ONE SOURCE OF TRUTH FOR EVERY NON-GAMEPLAY SURFACE (2026-06-09) ──
  // The betting bar (delivered anchor) is CRYSTAL-MAGENTA. Every page must speak
  // the SAME language. Before this, modals/drawers called drawPanelChrome with GOLD
  // overrides (0xb88e40/0xf0d089/0x6b5526) + gold text — which is why the pages read
  // as "a different app". SURF freezes the family ONCE; never hand-pick a panel/text
  // colour at a callsite again — reference SURF.*.
  const SURF = Object.freeze({
    chrome: { accent: 0xff7ad0, bright: 0xffc8ef, tint: 0x6e3aa8, radius: 18, titleDivAt: 44 },
    scrim:  0x0e0722,  scrimA: 0.82,
    title:    0xffc8ef, heading:  0xffc8ef, value:    0xfff2fb, label:    0xfdf2ff,
    muted:    0xb89cd8, accent:   0xff7ad0, accentHi: 0xff5ab0, link:     0x8be4ff,
    win:      0x52d189, loss: 0xff6b6b,
    tileBg:   0x19103e, tileBgHover: 0x2e1c58, pillOff:  0x251544, pillStroke: 0x6e3aa8,
    family:   'Fredoka', familyDisplay: 'Luckiest Guy',
  });
  // Call from EVERY panel layout so the look is byte-identical (palette locked).
  function drawSurfChrome(g, w, h, opts){
    opts = opts || {};
    drawPanelChrome(g, w, h, {
      accent: SURF.chrome.accent, bright: SURF.chrome.bright, tint: SURF.chrome.tint,
      radius: opts.radius != null ? opts.radius : SURF.chrome.radius,
      titleDivAt: opts.titleDivAt != null ? opts.titleDivAt : SURF.chrome.titleDivAt,
    });
  }
  // One backdrop wash for every overlay/modal bg Graphics.
  function drawSurfScrim(g, W, H){
    g.clear().rect(0,0,W,H).fill({ color: SURF.scrim, alpha: SURF.scrimA });
  }

  // ── SHARED POPUP CHROME (villain console) ─────────────────────────
  // Single source of truth for the premium panel look the autoplay/drawer,
  // info, buy-bonus and reality-check popups already use: obsidian base +
  // neon-magenta border + corner brackets + glow halo + title divider.
  // Extracted so every popup matches the autoplay panel EXACTLY instead of
  // 5 hand-drawn near-duplicates that had drifted in alpha/radius. Draw into
  // a cleared Graphics centered on (0,0); w/h are the panel size.
  function drawPanelChrome(g, w, h, opts){
    opts = opts || {};
    const r = opts.radius != null ? opts.radius : 18;
    const accent = opts.accent != null ? opts.accent : 0xff007f;        // neon magenta
    const bright = opts.bright != null ? opts.bright : 0xff8ad0;        // bright accent (rim / gloss / divider)
    const tint   = opts.tint   != null ? opts.tint   : 0x9a3bd6;        // soft body tint
    const titleDivAt = opts.titleDivAt != null ? opts.titleDivAt : 44;  // px from top; 0 = no divider
    // ── VIBRANT CRYSTAL-GLASS PANEL (2026-06-01 award-tier redesign) — matches
    // the candied-crystal symbol language: deep obsidian glass, a violet→magenta
    // vertical gradient body, a STRONG glossy top sheen, a refined border with a
    // bright magenta core + faint cyan crystal dispersion, and a multi-layer
    // magenta bloom (faked GlowFilter — no GLSL, Stake-safe). Clean silhouette,
    // zero stray lines/curves. Same rounded footprint → content layouts untouched.
    const violet = tint, magBright = bright;
    g.clear()
      // OUTER BLOOM — 3-layer magenta halo (vibrant glow, faked GlowFilter)
      .roundRect(-w/2-18, -h/2-14, w+36, h+32, r+6).fill({ color: accent, alpha: 0.035 })
      .roundRect(-w/2-11, -h/2-8,  w+22, h+20, r+3).fill({ color: accent, alpha: 0.07 })
      .roundRect(-w/2-5,  -h/2-3,  w+10, h+10, r+1).fill({ color: accent, alpha: 0.11 })
      // diffuse drop shadow
      .roundRect(-w/2-2, -h/2+7, w+4, h+10, r+2).fill({ color: 0x000000, alpha: 0.5 })
      // GLASS BODY — deep obsidian
      .roundRect(-w/2, -h/2, w, h, r).fill({ color: 0x0b0814, alpha: 0.96 })
      // SOFT body tint — faint amethyst over the whole body + a gentle magenta
      // lift on the lower half. Low alpha so it never bands as hard stripes on
      // tall panels (settings drawer) while still adding crystal depth on modals.
      .roundRect(-w/2+1, -h/2+1, w-2, h-2, Math.max(0,r-2)).fill({ color: violet, alpha: 0.05 })
      .roundRect(-w/2+1, -h/2+h*0.55, w-2, h*0.45-1, Math.max(0,r-2)).fill({ color: accent, alpha: 0.05 })
      // GLOSSY TOP SHEEN — the vibrant glass highlight (hero of the look)
      .roundRect(-w/2+1, -h/2+1, w-2, h*0.30, Math.max(0,r-2)).fill({ color: 0x9fc8ff, alpha: 0.06 })
      .roundRect(-w/2+1, -h/2+1, w-2, h*0.13, Math.max(0,r-2)).fill({ color: 0xffffff, alpha: 0.055 })
      // crisp top gloss line
      .roundRect(-w/2+14, -h/2+2, w-28, 1.2, 0.6).fill({ color: 0xffe6f4, alpha: 0.55 })
      // BORDER STACK — cyan dispersion hint · magenta core · bright inner · crystal white
      .roundRect(-w/2-1.2, -h/2, w, h, r).stroke({ color: 0x7fe7ff, width: 1.2, alpha: 0.16 })
      .roundRect(-w/2, -h/2, w, h, r).stroke({ color: accent, width: 1.8, alpha: 0.95 })
      .roundRect(-w/2+1, -h/2+1, w-2, h-2, Math.max(0,r-1)).stroke({ color: magBright, width: 0.8, alpha: 0.45 })
      .roundRect(-w/2, -h/2, w, h, r).stroke({ color: 0xffe9f5, width: 0.5, alpha: 0.3 });
    // glowing bottom accent bar (underlay + bright core) + optional title divider
    g.roundRect(-w*0.34, h/2-3.4, w*0.68, 3.2, 1.6).fill({ color: accent, alpha: 0.18 })
     .roundRect(-w*0.32, h/2-2.8, w*0.64, 1.7, 0.85).fill({ color: magBright, alpha: 0.95 });
    if(titleDivAt){
      g.rect(-w*0.42, -h/2+titleDivAt-0.4, w*0.84, 1.6).fill({ color: accent, alpha: 0.16 })
       .rect(-w*0.40, -h/2+titleDivAt, w*0.80, 1.0).fill({ color: magBright, alpha: 0.7 });
    }
  }

  // ── UNIFIED CLOSE BUTTON ─────────────────────────────────────────
  // ONE close affordance for EVERY popup (bet menu · settings drawer ·
  // info · buy bonus): a small crystal-glass disc + gold ring + the
  // shared `icClose` glyph — identical diameter, icon size, top-right
  // inset and 44px touch target everywhere. Previously each popup sized
  // and placed its own X (28 / 32 / 34 px, different insets, buy-bonus
  // had none) so they read as four different controls. Call this from
  // each modal's layout pass with the card's half-extents (halfW,halfH).
  const CLOSE_R = 17, CLOSE_INSET = 26, CLOSE_TEX = 40;   // disc Ø34 · X≈12px · 44px hit
  function styleClose(container, icon, halfW, halfH){
    if(!container._bg){
      container._bg = new PIXI.Graphics();
      container.addChildAt(container._bg, 0);            // sits BEHIND the glyph
    }
    container._bg.clear()
      .circle(0, 0, CLOSE_R).fill({ color: 0x0a0912, alpha: 0.94 })
      .circle(0, 0, CLOSE_R).stroke({ color: SURF.accent, width: 1.3, alpha: 0.9 })    // magenta ring (matches bar)
      .circle(0, 0, CLOSE_R - 3).stroke({ color: SURF.accentHi, width: 0.8, alpha: 0.30 }); // soft inner glow
    if(icon && icon.texture && icon.texture.width){
      if(icon.anchor) icon.anchor.set(0.5);
      icon.scale.set(CLOSE_TEX / icon.texture.width);
      icon.position.set(0, 0);
    }
    container.position.set(halfW - CLOSE_INSET, -halfH + CLOSE_INSET);
    // RESP-06/11 — scale-compensate hitArea so the on-screen touch target stays
    // >= 44px (WCAG 2.5.5) even when the parent card uses _fitScale (Popout S
    // buy/info/RC modals scale to 0.5-0.74). Without this the 44px local rect
    // renders 22-34px screen, fails WCAG. Reads parent's _fitScale (1 default).
    const _pf = (container.parent && container.parent._fitScale) ? container.parent._fitScale : 1;
    const _hr = 22 / _pf;
    container.hitArea = new PIXI.Rectangle(-_hr, -_hr, 2*_hr, 2*_hr);
  }

  // ── BUY BONUS CONFIRM MODAL — dark+gold theme (matches new bar) ─
  // ── BUY BONUS — 3-TIER PICKER ──────────────────────────────────
  // STANDARD (24×, 10 FS × ×3) | HOT (122×, 6 FS × ×3 wild reel) |
  // MEGA (172×, 10 FS sticky-Crowns × random ×2..×10). All per the
  // calibrated math in BONUS_MODES_SPEC.md (verify_quick.py iter 6).
  const BONUS_TIERS = [
    {
      id: 'bonus_standard',
      name: 'STANDARD',
      mult: 23.82,   // exact index.json cost (was 24; reviewers compare displayed-vs-billed)
      spins: 10,
      xmult: '×3',
      special: '+5 SPINS on RE-TRIGGER',
      accent: 0xc8326f,    // PINK_DEEP — base tier in the 2-color system
      glow: 0xc8326f,
    },
    {
      id: 'bonus_hot',
      name: 'HOT',
      mult: 121.29,   // exact index.json cost (was 122)
      spins: 6,
      xmult: '×3',
      special: 'WILD MIDDLE REEL',
      accent: 0xff5a9c,    // PINK — primary brand accent
      glow: 0xff5a9c,
    },
    {
      id: 'bonus_mega',
      name: 'MEGA',
      mult: 173.57,   // exact index.json cost (was 172 — RGS billed MORE than advertised)
      spins: 10,
      xmult: '×2..×10',
      special: 'STICKY CROWNS',
      accent: THEME.colors.pink,            // pink (premium)
      glow: 0xff5a9c,
    },
  ];
  let _selectedTier = 0;   // index into BONUS_TIERS — STANDARD is default

  // ART-05 — Modal scrim. Soft obsidian wash BEHIND every modal so panels pop
  // out of a calmed background instead of floating on the busy game scene.
  // Lerped via the SAME ticker block that drives _blurT (no new state). Drawn
  // once per layout() — depends only on screen size. Added BEFORE all modal
  // containers so the modals naturally draw on top (Pixi z-order = array order).
  const modalScrimG = new PIXI.Graphics(); modalScrimG.alpha = 0; stage.addChild(modalScrimG);
  function drawModalScrim(){
    const W = app.screen.width, H = app.screen.height;
    modalScrimG.clear();
    modalScrimG.rect(0, 0, W, H).fill({ color: 0x05030a, alpha: 1 });
    // Brand accent — thin magenta line at the bottom, hints at the villain palette.
    modalScrimG.rect(0, H - 3, W, 3).fill({ color: 0xff007f, alpha: 0.22 });
  }

  const buyModal = new PIXI.Container(); buyModal.visible = false; stage.addChild(buyModal);
  const buyModalBg = new PIXI.Graphics(); buyModal.addChild(buyModalBg); buyModalBg.eventMode='static';
  const buyModalCard = new PIXI.Container(); buyModal.addChild(buyModalCard);
  const bmCardBg = new PIXI.Graphics(); buyModalCard.addChild(bmCardBg);
  const bmTitle = new PIXI.Text({ text:'BUY BONUS', style:txtStyle(22, 0xff5a9c) });
  bmTitle.anchor.set(0.5,0); buyModalCard.addChild(bmTitle);
  const bmDesc = new PIXI.Text({ text:'Choose your bonus tier.', style:{
    fontFamily:'Fredoka', fontSize:12, fill:THEME.colors.text, align:'center', wordWrap:true, wordWrapWidth:340 }});
  bmDesc.anchor.set(0.5,0); buyModalCard.addChild(bmDesc);

  // ── TIER CARDS — one Container per tier; bg + name + cost + details
  const tierCards = BONUS_TIERS.map((tier, i) => {
    const c = new PIXI.Container();
    c.eventMode = 'static'; c.cursor = 'pointer';
    c._tier = tier; c._tierIdx = i;
    const bg = new PIXI.Graphics(); c.addChild(bg); c._bg = bg;
    // ── REDESIGN — per-tier VFX overlay (sparkle/ember/lightning), drawn additively
    // every visible frame from the main ticker. Cleared per-frame so it costs ~0 when
    // modal is hidden. Sits ABOVE bg, BELOW text + medallion sprite (added later).
    const vfx = new PIXI.Graphics(); vfx.blendMode = 'add'; c.addChild(vfx); c._vfx = vfx;
    // Hover lerp target — touched by pointerover/out; consumed by the ticker breath.
    c._hover = 0; c._hoverT = 0;
    c.on('pointerover', () => { c._hover = 1; });
    c.on('pointerout',  () => { c._hover = 0; });
    const name = new PIXI.Text({ text:tier.name, style:{
      fontFamily:'Luckiest Guy', fontSize:18, fill:tier.accent, letterSpacing:2,
      stroke:{ color:0x000000, width:2, join:'round' },
    }});
    name.anchor.set(0.5, 0); c.addChild(name); c._name = name;
    const cost = new PIXI.Text({ text:'', style:{
      fontFamily:'Luckiest Guy', fontSize:16, fill:THEME.colors.text, letterSpacing:1,
    }});
    cost.anchor.set(0.5, 0); c.addChild(cost); c._cost = cost;
    const spins = new PIXI.Text({ text:tier.spins + ' FS  ' + tier.xmult, style:{
      fontFamily:'Fredoka', fontSize:11, fill:THEME.colors.accent, fontWeight:'bold', letterSpacing:1,
    }});
    spins.anchor.set(0.5, 0); c.addChild(spins); c._spins = spins;
    const special = new PIXI.Text({ text:tier.special, style:{
      fontFamily:'Fredoka', fontSize:9, fill:THEME.colors.textMuted, align:'center',
      wordWrap:true, wordWrapWidth:110, letterSpacing:0.8,
    }});
    special.anchor.set(0.5, 0); c.addChild(special); c._special = special;
    c.on('pointertap', () => {
      _selectedTier = i;
      try { Sound.click(); } catch(e){}
      layoutBuyModal();
      bmConfirm._t.text = socialFilter('BUY') + ' ' + fmtMoney(bonusCostX6(i));
    });
    buyModalCard.addChild(c);
    return c;
  });

  const bmWarn = new PIXI.Text({ text:'Buy Bonus may not be available in all\njurisdictions. Please play responsibly.', style:{
    fontFamily:'Fredoka', fontSize:10, fill:THEME.colors.textMuted, align:'center', wordWrap:true, wordWrapWidth:340, lineHeight:14 }});
  bmWarn.anchor.set(0.5,0); buyModalCard.addChild(bmWarn);
  // 2-color: CANCEL = dark surface, BUY = PINK with smoke-white text
  const bmCancel  = makeModalBtn(buyModalCard,'CANCEL', 0x1f1c2e, 0xf5f7fa);
  const bmConfirm = makeModalBtn(buyModalCard,'BUY',    0xff5a9c, 0xf5f7fa);
  // Unified top-right close X (same disc/glyph as bet · settings · info) so
  // the buy modal matches every other popup — CANCEL stays as the secondary
  // action. Added last among card children so it stays on top.
  const buyClose = new PIXI.Container(); buyClose.eventMode='static'; buyClose.cursor='pointer';
  const buyCloseIcon = spr('icClose'); buyClose.addChild(buyCloseIcon);
  buyModalCard.addChild(buyClose);

  // ── INLINE BET STEPPER inside the modal — lets the player change bet
  // WITHOUT closing the modal. All 3 tier card costs update live.
  const bmBetLabel = new PIXI.Text({ text:socialFilter('YOUR BET'), style:{
    fontFamily:'Fredoka', fontSize:11, fill:0xff8ab8,
    letterSpacing:1.4, fontWeight:'700',
  }});
  bmBetLabel.anchor.set(0.5); buyModalCard.addChild(bmBetLabel);
  const bmBetValue = new PIXI.Text({ text:'', style:{
    fontFamily:'Luckiest Guy', fontSize:20, fill:THEME.colors.text,
    letterSpacing:1, stroke:{ color:0x2a1d05, width:2, join:'round' },
  }});
  bmBetValue.anchor.set(0.5); buyModalCard.addChild(bmBetValue);
  function makeBmStepper(symbol){
    const c = new PIXI.Container(); c.eventMode='static'; c.cursor='pointer';
    const bg = new PIXI.Graphics(); c.addChild(bg);
    const t = new PIXI.Text({ text:symbol, style:{
      fontFamily:'Luckiest Guy', fontSize:22, fill:0xffffff,
    }});
    t.anchor.set(0.5); c.addChild(t);
    c._bg = bg; c._t = t;
    c.on('pointerdown', () => c.scale.set(0.94));
    c.on('pointerup',   () => c.scale.set(1));
    c.on('pointerupoutside', () => c.scale.set(1));
    buyModalCard.addChild(c);
    return c;
  }
  const bmMinus = makeBmStepper('-');
  const bmPlus  = makeBmStepper('+');
  function _bmUpdateAfterBet(){
    bmBetValue.text = fmtMoney(State.betX6);
    layoutBuyModal();
    bmConfirm._t.text = socialFilter('BUY') + ' ' + fmtMoney(bonusCostX6(_selectedTier));
  }
  bmMinus.on('pointertap', () => {
    if(State.betIdx <= 0) return;
    bumpBet(-1);
    try { Sound.click(); } catch(e){}
    _bmUpdateAfterBet();
  });
  bmPlus.on('pointertap', () => {
    if(State.betIdx >= State.betLevels.length - 1) return;
    bumpBet(1);
    try { Sound.click(); } catch(e){}
    _bmUpdateAfterBet();
  });

  // Legacy row containers — keep no-op refs so layout doesn't reference null.
  const bmRowSpins = { visible:false, _lbl:{text:''}, _val:{text:''}, position:{set(){}} };
  const bmRowCost  = { visible:false, _lbl:{text:''}, _val:{text:''}, position:{set(){}} };
  const bmRowRTP   = { visible:false, _lbl:{text:''}, _val:{text:''}, position:{set(){}} };
  const bmRowMax   = { visible:false, _lbl:{text:''}, _val:{text:''}, position:{set(){}} };

  // ── MODAL TRANSITIONS — Emil/web-animations EXPERT pass ──
  // Every overlay (buy · drawer · info · reality check · error · replay)
  // shares the SAME cinematic open/close so the player learns one motion
  // language. Per Vaul + Sonner methodology:
  //
  //  ENTRANCE  (380ms total):
  //   • Backdrop fades FIRST (180ms cubic-bezier(0.16,1,0.3,1) — Vaul curve)
  //     so the player feels the world dim BEFORE the panel arrives
  //   • Card starts 100ms behind backdrop (staggered = perceived "arrival")
  //   • Card scale 0.92 → 1.00 with outBack(1.5) = soft overshoot
  //   • Card translateY 14 → 0 (lifts up from below — origin: bottom-center)
  //   • Card alpha 0 → 1 (faster than scale so content reads fast)
  //
  //  EXIT (220ms):
  //   • Card + backdrop fade together on cubic-bezier(0.4,0,1,1) — sharp
  //   • Card scale 1.0 → 0.96 (never below 0.93 per Emil)
  //   • Card translateY 0 → 8 (settles down — gravity exit)
  //   • Done callback fires when alpha hits ~0 (not full 0) so chain feels snappy
  //
  // Reduced-motion → snap to rest instantly, no animation
  // Interruptible → per-card token cancels any in-flight tween
  // Coupled elements → backdrop + card share Vaul curve
  const _modalTok = new WeakMap();
  const _modalBaseY = new WeakMap();
  // Vaul cubic-bezier (0.16, 1, 0.3, 1) — Emil's signature "silk" curve
  const easeVaul = (p) => {
    // cubic-bezier approximation via polynomial
    // (0.16, 1, 0.3, 1) gives a smooth deceleration with no overshoot
    const t = p;
    return 1 - Math.pow(1 - t, 4) * (1 + t * 0.3);
  };
  // Sharp exit curve — cubic-bezier(0.4, 0, 1, 1)
  const easeSharp = (p) => p * p;
  // Soft spring overshoot (replacing outBack with smoother arc)
  const easeSpring = (p) => {
    if(p >= 1) return 1;
    return 1 - Math.exp(-7 * p) * Math.cos(p * Math.PI * 1.6);
  };
  function modalIn(card, bg){
    const tok=(_modalTok.get(card)||0)+1; _modalTok.set(card,tok);
    // Resting Y = the position the caller JUST laid out. Capture it FRESH every open
    // (not a permanent cache): a cached Y goes stale after a resize / orientation change,
    // and the modal then opens off-screen at the OLD centre — e.g. the bet menu landing
    // at the desktop centre (y≈338) on Popout S (H=225). modalOut reads the same store.
    const baseY = card.y || 0;
    _modalBaseY.set(card, baseY);
    // Per-card fit scale — layoutBetMenu sets betMenuCard._fitScale < 1 on tiny
    // presets (Popout S 400×225) so the bet menu can't overflow the viewport.
    // Defaults to 1, so every other modal animates exactly as before.
    const tgt = card._fitScale || 1;
    if(isReduced()){
      card.scale.set(tgt); card.alpha=1; bg.alpha=1; card.y = baseY;
      return;
    }
    bg.alpha = 0;
    card.alpha = 0;
    card.scale.set(0.92 * tgt);
    card.y = baseY + 14;   // start 14px below resting position
    const t0 = performance.now();
    const bgDur = 320;       // backdrop fade duration (faster fade-in)
    const cardDelay = 100;   // card starts 100ms after backdrop begins
    const cardDur = 360;     // card animation duration
    const totalDur = cardDelay + cardDur;
    (function step(){
      if(_modalTok.get(card) !== tok) return;
      const el = performance.now() - t0;
      // Backdrop — fades in immediately using Vaul curve
      const bgP = Math.min(1, el / bgDur);
      bg.alpha = easeVaul(bgP);
      // Card — staggered behind backdrop
      const cardEl = Math.max(0, el - cardDelay);
      const cardP = Math.min(1, cardEl / cardDur);
      // Alpha fades faster than scale (content readable before settle)
      card.alpha = Math.min(1, easeVaul(cardP) * 1.4);
      // Scale springs from 0.92 → 1.0 with subtle overshoot
      card.scale.set(tgt * (0.92 + 0.08 * easeSpring(cardP)));
      // TranslateY drifts from +14 to 0 (rises into place)
      card.y = baseY + 14 * (1 - easeVaul(cardP));
      if(el < totalDur) requestAnimationFrame(step);
      else { card.scale.set(tgt); card.alpha = 1; bg.alpha = 1; card.y = baseY; }
    })();
  }
  function modalOut(card, bg, done){
    const tok=(_modalTok.get(card)||0)+1; _modalTok.set(card,tok);
    const baseY = _modalBaseY.has(card) ? _modalBaseY.get(card) : (card.y || 0);
    const tgt = card._fitScale || 1;   // honor the bet-menu Popout S fit on close too
    if(isReduced()){
      card.scale.set(1); card.alpha=1; bg.alpha=1; card.y = baseY;
      done && done();
      return;
    }
    const t0 = performance.now();
    const dur = 220;
    const cs0 = card.scale.x, ca0 = card.alpha, ba0 = bg.alpha, cy0 = card.y;
    (function step(){
      if(_modalTok.get(card) !== tok) return;
      const p = Math.min(1, (performance.now() - t0) / dur);
      // Sharp ease-in for exit (snappy — out of the way fast)
      const e = easeSharp(p);
      bg.alpha   = ba0 * (1 - easeVaul(p));        // backdrop also Vaul-fades
      card.alpha = ca0 * (1 - e);
      card.scale.set(cs0 - (cs0 - 0.96 * tgt) * e);
      // Drift DOWN 8px on exit (gravity feel)
      card.y = cy0 + 8 * e;
      if(p < 1) requestAnimationFrame(step);
      else {
        card.scale.set(1); card.alpha = 1; bg.alpha = 1; card.y = baseY;
        done && done();
      }
    })();
  }
  function modalSnap(card, bg){
    // Cancel any tween + jump to rest state. The caller re-runs its layout
    // immediately before snapping, so the card ALREADY sits at the correct
    // rest pose for the CURRENT viewport — re-capture it instead of restoring
    // _modalBaseY (that store goes stale when the viewport changes while the
    // modal is open: desktop centre y≈338 restored onto Popout S H=225 parks
    // the whole panel below the screen). Honor _fitScale like modalIn does.
    _modalTok.set(card, (_modalTok.get(card) || 0) + 1);
    card.scale.set(card._fitScale || 1); card.alpha = 1; bg.alpha = 1;
    _modalBaseY.set(card, card.y || 0);
  }
  function bonusCostX6(tierIdx){
    return Math.round(State.betX6 * BONUS_TIERS[tierIdx].mult);
  }
  function layoutBuyModal(){
    const W=app.screen.width, H=app.screen.height;
    // Scrim — keep the gameplay visible behind through the zoom-focus
    // push (no more full-black backdrop). 75% obsidian wash is the
    // sweet spot between focus and "I can still see the game".
    buyModalBg.clear().rect(0,0,W,H).fill({ color:0x05050a, alpha:0.75 });
    // Wider card on landscape so 3 tier columns fit cleanly; taller on
    // portrait so cards stack vertically.
    // RESP-08 NOT applied — empirically the portrait stack is WORSE on Popout S
    // than the landscape 3-column + fitScale=0.5: portrait cardH=540 → fitScale
    // 0.4 squeezes content tighter. Landscape stays.
    const portrait = H > W*1.05;
    const cardW = portrait ? Math.min(360, W*0.92) : Math.min(580, W*0.88);
    // Bumped +60 to make room for the inline BET stepper row below tier cards.
    const cardH = portrait ? 540 : 420;
    // ── POPOUT-S P0 FIT — scale the entire card to fit when viewport is smaller
    // than the card dimensions (Popout S 400x225 is 1.87x smaller than the 420px
    // landscape card → title + CANCEL/BUY footer would crop). Mirrors the proven
    // layoutBetMenu _fitScale pattern. Headroom 16px each side so card doesn't
    // touch the viewport edges. Re-runs on every resize via the BETMENU-RESIZE
    // hook in the window-resize handler (already wired).
    const _maxH = H - 16, _maxW = W - 16;
    const _fit  = Math.min(1, _maxH / cardH, _maxW / cardW);
    buyModalCard._fitScale = _fit;
    buyModalCard.scale.set(_fit);
    buyModalCard.position.set(W/2,H/2);
    // RESP-07 — inverse-scale critical text fontSize so on-screen renders >= 11px
    // legibility floor. Without this on Popout S (fit ~0.5) bmWarn at 10px renders
    // 5px (illegal/illegible). minPx helper computes the local fontSize needed.
    const _minPx = (basePx, screenMin = 11) => Math.max(basePx, screenMin / Math.max(0.3, _fit));
    bmTitle.style.fontSize = _minPx(22, 16);   // title — bigger floor (it's the hero)
    bmDesc.style.fontSize  = _minPx(12);
    bmWarn.style.fontSize  = _minPx(10);
    // ── AAA BUY BONUS PANEL (2026-05-27 RADICAL REDESIGN) ─────────────
    // Per user "Buy Bonus popup needs radical AAA redesign, top UI verse,
    // 21st.dev polish, WebGL effects style, polished dynamic effects".
    // New structure:
    //   1. Outer NEON HALO (3 stacked layers, faked GlowFilter)
    //   2. Drop shadow
    //   3. OBSIDIAN OBSIDIAN BASE — deeper (0x07070d, was 0x1f1c2e too purple)
    //   4. Top quarter gradient tint (subtle, was over-saturated)
    //   5. Mid-band shadow inset (depth)
    //   6. Bright top-edge highlight hairline
    //   7. Magenta BORDER — thinner + brighter (1.6px @ 95%)
    //   8. Inner ink edge (depth)
    //   9. 4 SCI-FI CORNER BRACKETS (top-L/R + bottom-L/R)
    //  10. Bottom accent rule — neon magenta tapered hairline
    //  11. Title-area magenta separator
    // 2026-05-27 RESTRAINT pass (expert audit) — "too many simultaneous
    // visual ideas". Removed: 1 halo layer (3→2), the mid-band inset
    // shadow, and 2 of the 4 corner brackets (now only top-L + bottom-R
    // — a diagonal pair reads as intentional framing, 4 felt busy).
    // Magenta border alpha softened 0.95 → 0.80. Result: high-end, not
    // trying-to-be-high-end.
    bmCardBg.clear()
      // (1) Outer neon halo glow — 2 layers (was 3)
      .roundRect(-cardW/2-10, -cardH/2-7, cardW+20, cardH+18, 22)
      .fill({ color: 0xff007f, alpha: 0.05 })
      .roundRect(-cardW/2-4, -cardH/2-2, cardW+8, cardH+8, 19)
      .fill({ color: 0xff007f, alpha: 0.11 })
      // (2) Drop shadow
      .roundRect(-cardW/2-2, -cardH/2+6, cardW+4, cardH+10, 20)
      .fill({ color: 0x000000, alpha: 0.70 })
      // (3) Obsidian base
      .roundRect(-cardW/2, -cardH/2, cardW, cardH, 18)
      .fill({ color: 0x07070d, alpha: 0.98 })
      // (4) Top quarter magenta wash (subtle)
      .roundRect(-cardW/2+1, -cardH/2+1, cardW-2, cardH*0.26, 16)
      .fill({ color: 0xff007f, alpha: 0.06 })
      // (5) Bright top-edge hairline highlight
      .roundRect(-cardW/2+14, -cardH/2+1.5, cardW-28, 0.8, 0.4)
      .fill({ color: 0xf5f7fa, alpha: 0.65 })
      // (6) Magenta border (softened 0.95 → 0.80)
      .roundRect(-cardW/2, -cardH/2, cardW, cardH, 18)
      .stroke({ color: 0xff007f, width: 1.5, alpha: 0.80 })
      // (7) Inner ink edge
      .roundRect(-cardW/2+3, -cardH/2+3, cardW-6, cardH-6, 15)
      .stroke({ color: 0x000000, width: 0.7, alpha: 0.55 });
    // (8) 2 DIAGONAL CORNER BRACKETS (was 4) — top-left + bottom-right
    const brR = 14, brLen = 18;
    [[-cardW/2+brR, -cardH/2+brR, 1, 1],
     [ cardW/2-brR,  cardH/2-brR,-1,-1]].forEach(([cx,cy,sx,sy]) => {
      bmCardBg.moveTo(cx, cy + sy*brLen).lineTo(cx, cy).lineTo(cx + sx*brLen, cy)
        .stroke({ color: 0xff007f, width: 1.3, alpha: 0.80 });
    });
    bmTitle.position.set(0,-cardH/2+22);
    bmDesc.position.set(0,-cardH/2+56);
    // 2026-05-27 fix — pass through socialFilter on EVERY modal open
    // (was reset to the unfiltered string on each layout call, leaking
    // 'bonus' / 'tier' in social mode).
    bmDesc.text = socialFilter('Choose your bonus tier.');
    // COMPLIANCE-02: re-filter the jurisdiction warning each open (was a build-time literal;
    // 'Buy'/'Bonus' leaked in ?social mode on INT/US/MGA where buy-bonus is allowed).
    bmWarn.text = socialFilter('Buy Bonus may not be available in all\njurisdictions. Please play responsibly.');
    // COMPLIANCE-02: re-filter the jurisdiction warning each open (was a build-time literal;
    // 'Buy'/'Bonus' leaked in ?social mode on INT/US/MGA where buy-bonus is allowed).
    bmWarn.text = socialFilter('Buy Bonus may not be available in all\njurisdictions. Please play responsibly.');

    // ── 3 TIER CARDS — horizontal row landscape, vertical stack portrait.
    // Cards are TALLER now (vs prev 96/178 → 110/200) to fit medallion +
    // bigger typography per the cute redesign.
    const isPortraitNow = portrait;
    const tierGap = 12;
    const cardsAreaY = -cardH/2 + 90;
    if(isPortraitNow){
      const tcW = cardW * 0.86;
      // Portrait cards compacted 110 → 86 so 3 cards + bet stepper +
      // cancel/buy all fit on Mobile S 320×568 (was overlapping MEGA).
      const tcH = 86;
      const tighterGap = 8;
      tierCards.forEach((tc, i) => {
        const cx = 0;
        const cy = cardsAreaY + i * (tcH + tighterGap) + tcH/2;
        renderTierCard(tc, cx, cy, tcW, tcH, i === _selectedTier);
      });
    } else {
      const tcW = (cardW * 0.88) / 3 - tierGap * 0.6;
      const tcH = 200;
      const totalW = tcW*3 + tierGap*2;
      tierCards.forEach((tc, i) => {
        const cx = -totalW/2 + tcW*(i + 0.5) + tierGap*i;
        const cy = cardsAreaY + tcH/2;
        renderTierCard(tc, cx, cy, tcW, tcH, i === _selectedTier);
      });
    }
    // ── BET STEPPER ROW — between tier cards and bottom buttons.
    // YOUR BET label + −/value/+ centered horizontally.
    const stepRowY = cardH/2 - 110;
    bmBetLabel.position.set(0, stepRowY - 22);
    bmBetValue.text = fmtMoney(State.betX6);
    bmBetValue.position.set(0, stepRowY + 4);
    const stepBtnSz = 36;
    const stepGap = 8;
    const valueHalfW = Math.max(40, bmBetValue.width/2 + 8);
    // − on the LEFT of the value, + on the RIGHT
    [bmMinus, bmPlus].forEach((b, i) => {
      const sign = i === 0 ? -1 : 1;
      b.position.set(sign * (valueHalfW + stepBtnSz/2 + stepGap), stepRowY + 4);
      const affordable = (i === 0) ? State.betIdx > 0
                                   : State.betIdx < State.betLevels.length - 1;
      // 2-color modal steppers — PINK affordable, dark slate disabled
      b._bg.clear()
        .circle(0, 0, stepBtnSz/2 + 1)
        .fill({ color:0x000000, alpha:0.35 })   // shadow
        .circle(0, 0, stepBtnSz/2)
        .fill({ color: affordable ? 0xff5a9c : 0x1f1c2e, alpha: 0.95 })
        .circle(0, 0, stepBtnSz/2)
        .stroke({ color: affordable ? 0xff8ab8 : 0x3d3d4e,
                  width: 1.4, alpha: 0.9 })
        // PIXI v8: moveTo before arc — otherwise the prior fill point bleeds
        // a lineTo into the stroke (the "lines from top-left" bug).
        .moveTo(Math.cos(Math.PI*1.18) * (stepBtnSz/2 - 2),
                Math.sin(Math.PI*1.18) * (stepBtnSz/2 - 2))
        .arc(0, 0, stepBtnSz/2 - 2, Math.PI*1.18, Math.PI*1.82)
        .stroke({ color:0xffffff, width:0.8, alpha: affordable ? 0.4 : 0.2 });
      b.alpha = affordable ? 1 : 0.5;
      b.eventMode = affordable ? 'static' : 'none';
      b._t.style.fill = affordable ? 0xffffff : THEME.colors.textMuted;
    });

    // Disclaimer sits clearly ABOVE the buttons (was cardH/2-64 — only 34px
    // above the buttons → text wrapped into them on portrait. Lifted to
    // cardH/2-92 so the 2-line text has clear vertical breathing room.)
    bmWarn.position.set(0, cardH/2 - 92);
    // Bottom buttons — CONFIRM ~2× CANCEL so the cost text ("BUY $172.00",
    // 11 chars worst-case) reads at native font size, never shrunk into
    // a malformed "$"-as-"(" rendering. CANCEL 26% / gap / CONFIRM 56%.
    const btnH = 44, btnY = cardH/2 - 30;
    const cancelW = cardW * 0.26;
    const confirmW = cardW * 0.56;
    const btnGap = 10;
    // Drop confirm text size on portrait so the longest "BUY $172.00"
    // string (~11 chars × stroked Luckiest Guy) fits without auto-fit
    // scaling that distorted the dollar glyph.
    const confirmFontSize = portrait ? 14 : 15;
    bmConfirm._t.style.fontSize = confirmFontSize;
    // Drop the heavy purple stroke for this button — on a bright gold
    // pill the dark "$" glyph collided with its own outline, rendering
    // as a "(" smudge. Pure dark fill on gold has plenty of contrast.
    // 2-color confirm button — PINK bg + smoke-white text, no gold stroke
    bmConfirm._t.style.stroke = { color: 0x300d28, width: 0.6, join: 'round' };
    bmConfirm._t.style.fontWeight = '700';
    bmConfirm._t.style.letterSpacing = 0.6;
    bmConfirm._t.scale.set(1);
    drawGlossyBtn(bmCancel._bg, cancelW, btnH, 'secondary');
    const totalBtnsW = cancelW + btnGap + confirmW;
    bmCancel.position.set(-totalBtnsW/2 + cancelW/2, btnY);
    drawGlossyBtn(bmConfirm._bg, confirmW, btnH, 'primary');
    bmConfirm.position.set(totalBtnsW/2 - confirmW/2, btnY);
    // RESP-02 — scale-compensate primary button hitAreas so on-screen target stays
    // >= 44px at any fitScale (Popout S _fit=0.5 → raw bounds render ~ btnH*0.5=22px).
    // Mirrors styleClose() pattern for closes (which already handles bmCancel/bmConfirm? NO:
    // styleClose only handles the close-X). Apply explicitly here for the CTAs.
    {
      const _bfh = Math.max(btnH, 44 / _fit);
      const _bcw = Math.max(cancelW,  44 / _fit);
      const _bxw = Math.max(confirmW, 44 / _fit);
      bmCancel.hitArea  = new PIXI.Rectangle(-_bcw/2, -_bfh/2, _bcw, _bfh);
      bmConfirm.hitArea = new PIXI.Rectangle(-_bxw/2, -_bfh/2, _bxw, _bfh);
    }
    styleClose(buyClose, buyCloseIcon, cardW/2, cardH/2);   // unified close (matches all popups)
    // Belt-and-braces auto-fit only if text STILL overflows at chosen size
    // (e.g. JPY balances with 4-digit cost: "BUY ¥17,400")
    const innerW = confirmW - 18;
    if(bmConfirm._t.width > innerW){
      bmConfirm._t.scale.set(innerW / bmConfirm._t.width);
    }
  }

  function renderTierCard(tc, cx, cy, w, h, selected){
    tc.position.set(cx, cy);
    tc.hitArea = new PIXI.Rectangle(-w/2, -h/2, w, h);
    // ── CUTE TIER CARD — premium AAA design per user feedback
    //  Selected card gets: brighter ring, accent gradient fill, glossy
    //  top crescent, "CHOSEN" badge ribbon on top-right corner, deeper
    //  shadow, slight scale-up via tc.scale (animated in render loop).
    const r = 14;
    tc._bg.clear();
    // ── NEON WRAP-AROUND GLOW — only when SELECTED (faked GlowFilter)
    //   4 stacked rects with rising alpha give a real "neon halo" wrap
    //   that the user can clearly see and that screams "this is active".
    // 2026-05-27 RESTRAINT pass (expert audit) — selected glow trimmed
    // 4 layers → 3, peak alpha 0.30 → 0.22. "Luxury is selective
    // emphasis" — the ring + accent fill already signal selection; the
    // halo only needs to whisper, not shout.
    if(selected){
      tc._bg
        .roundRect(-w/2-7, -h/2-7, w+14, h+14, r+6)
        .fill({ color: tc._tier.accent, alpha: 0.07 })
        .roundRect(-w/2-4, -h/2-4, w+8,  h+8,  r+4)
        .fill({ color: tc._tier.accent, alpha: 0.13 })
        .roundRect(-w/2-1, -h/2-1, w+2,  h+2,  r+1)
        .fill({ color: tc._tier.accent, alpha: 0.22 });
    }
    tc._bg
      // (1) outer drop-shadow — deeper when selected
      .roundRect(-w/2-2, -h/2+3, w+4, h+4, r+1)
      .fill({ color:0x000000, alpha: selected ? 0.55 : 0.35 })
      // (2) base fill — accent tint when selected
      .roundRect(-w/2, -h/2, w, h, r)
      .fill({ color: selected ? 0x1d1212 : 0x100a13, alpha: 0.97 })
      // (3) UPPER gradient band — accent-tinted (more saturated when selected)
      .roundRect(-w/2+1, -h/2+1, w-2, h*0.5, r-1)
      .fill({ color: tc._tier.accent, alpha: selected ? 0.22 : 0.10 })
      // (4) bright top highlight stripe (UI verse gloss)
      .roundRect(-w/2+10, -h/2+4, w-20, 1.4, 1)
      .fill({ color:0xffffff, alpha: selected ? 0.7 : 0.35 })
      // (5) outer accent ring — bright when selected
      .roundRect(-w/2, -h/2, w, h, r)
      .stroke({
        color: tc._tier.accent,
        width: selected ? 2.6 : 1.2,
        alpha: selected ? 1 : 0.55,
      })
      // MINIMALIST (2026-06-01): removed the inner-ink contour + the glossy
      // top crescent arc — they read as "basic" stray lines/curves. The single
      // border + one top gloss hairline + accent wash IS the elegant crystal
      // language (matches the symbol aesthetic). Medallion below.
      ;
    // ── REDESIGN (2026-06-03) — hero medallion ~3x bigger than before so the tier
    // illustration becomes the CARD'S identity, not a pinhead decoration. Compact
    // (portrait h<120) keeps it modest to make room for the stacked text below;
    // landscape gets a true centerpiece icon (~100px diameter, was ~44).
    const compact = h < 120;
    const badgeR  = compact ? Math.min(28, h*0.30) : Math.min(50, h*0.26);
    const badgeCY = compact ? (-h/2 + h*0.28)      : (-h/2 + h*0.26);
    const badgeA  = selected ? 1 : 0.85;
    tc._badgeCY = badgeCY; // exposed to the per-frame VFX ticker so it can position correctly
    tc._badgeR  = badgeR;
    // ── AAA — card depth (glass inset). Top hairline highlight + bottom shadow band
    // inside the card so it reads as light-from-above on a cut-glass panel, not a
    // flat fill. Pure Graphics fills, ~zero cost.
    if(!compact){
      const _ih = h * 0.10;
      // Top highlight gradient stack — light catches the top inner edge
      for(let i = 1; i <= 3; i++){
        tc._bg.roundRect(-w/2+5, -h/2+5+(i-1)*1.6, w-10, _ih*(1.05 - i*0.18), Math.max(2, 14-3))
          .fill({ color: 0xf5f7fa, alpha: 0.05 - i*0.012 });
      }
      // Bottom shadow band — deep ink at panel base
      for(let i = 1; i <= 2; i++){
        tc._bg.rect(-w/2+5, h/2-_ih-(i-1)*2, w-10, _ih * 0.65)
          .fill({ color: 0x05020a, alpha: 0.10 - i*0.02 });
      }
    }
    // ── AAA — chromatic offset rings on the SELECTED medallion (signature
    // Pragmatic/NoLimit look). Pink+cyan offset behind the accent ring.
    if(selected){
      // Chromatic aberration aura — cyan rim offset -1.5, pink offset +1.5
      tc._bg.circle(-1.5, badgeCY, badgeR + 4)
        .stroke({ color: 0x7fe7ff, width: 2.2, alpha: 0.55 });
      tc._bg.circle(1.5, badgeCY, badgeR + 4)
        .stroke({ color: 0xff007f, width: 2.2, alpha: 0.60 });
      // Wrap-around glow
      tc._bg.circle(0, badgeCY, badgeR + 10)
        .fill({ color: tc._tier.accent, alpha: 0.10 })
        .circle(0, badgeCY, badgeR + 5)
        .fill({ color: tc._tier.accent, alpha: 0.20 });
    }
    // Background medallion — deeper recess so the illustration feels INSET
    tc._bg
      .circle(0, badgeCY, badgeR)
      .fill({ color: 0x0a0a0e, alpha: 0.96 })
      .circle(0, badgeCY, badgeR)
      .stroke({ color: tc._tier.accent, width: selected ? 2.8 : 1.8, alpha: badgeA });
    // Lazy-init the symbol sprite ONCE per card (re-used on every layout)
    if(!tc._symSpr){
      const tierTex = tc._tierIdx === 0 ? TEX.tierStd : tc._tierIdx === 1 ? TEX.tierHot : TEX.tierMega;
      const ss = new PIXI.Sprite(tierTex);
      ss.anchor.set(0.5);
      tc.addChild(ss);
      tc._symSpr = ss;
    }
    // Size + position the symbol inside the medallion (HUGE — fills 1.7x the badge)
    const symMax = badgeR * 1.70;
    const symK = symMax / Math.max(tc._symSpr.texture.width, tc._symSpr.texture.height);
    tc._symSpr.scale.set(symK);
    tc._symSpr.position.set(0, badgeCY);
    tc._symSpr.alpha = selected ? 1 : 0.94;

    // Tier name + cost + spins + special — repositioned UNDER the hero medallion.
    tc._name.style.fontSize = compact ? 14 : 17;
    tc._name.position.set(0, -h/2 + (compact ? h*0.62 : h*0.55));
    tc._cost.text = fmtMoney(bonusCostX6(tc._tierIdx));
    // ── AAA — COST is the HERO. Big chunky type, letter-spacing, tier-color when
    // selected so the buy decision pops. Compact stays modest for portrait stacks.
    tc._cost.style.fontSize = compact ? 15 : 26;
    tc._cost.style.letterSpacing = compact ? 1 : 1.4;
    tc._cost.position.set(0, -h/2 + (compact ? h*0.80 : h*0.72));
    tc._cost.style.fill = selected ? tc._tier.glow : THEME.colors.text;
    tc._cost.style.stroke = selected
      ? { color: 0x000000, width: 2.5, join: 'round' }
      : { color: 0x000000, width: 2,   join: 'round' };
    tc._spins.style.fontSize = compact ? 9 : 12;
    tc._spins.position.set(0, -h/2 + (compact ? h*0.92 : h*0.82));
    tc._spins.style.fill = selected ? tc._tier.accent : 0xff8ab8;
    if(compact){
      tc._special.alpha = 0;
    } else {
      tc._special.alpha = 1;
      tc._special.position.set(0, -h/2 + h*0.91);
      tc._special.style.fill = selected ? THEME.colors.text : THEME.colors.textMuted;
      tc._special.style.fontSize = selected ? 11 : 10;
      // Wider wrap so 'WILD MIDDLE REEL' renders as one readable line.
      tc._special.style.wordWrapWidth = w * 0.88;
    }
  }

  // ── REDESIGN — per-tier signature VFX drawn into tc._vfx every visible frame.
  // STANDARD = orbiting crystal sparkles · HOT = rising flame embers ·
  // MEGA = sticky-crown corner glints + (selected) magenta lightning crackle.
  // All purely procedural Graphics (no GLSL — Stake-safe), gated off under
  // reduced-motion, only invoked when the modal is visible (zero cost otherwise).
  // Deterministic phases (no per-frame vrnd) so reduced-motion + replay can snap.
  function drawTierVfx(tc, now, selected){
    const vfx = tc._vfx;
    if(!vfx) return;
    vfx.clear();
    if(isReduced()) return;
    const cy = tc._badgeCY;
    const r  = tc._badgeR;
    if(!r || r < 8) return; // not laid out yet
    const intensity = selected ? 1 : 0.45;
    // (A) Slow rotating accent ring around the medallion (selected only)
    if(selected){
      const ringR = r + 7;
      for(let i = 0; i < 10; i++){
        const a = (now * 0.0008) + i * (Math.PI / 5);
        const px = Math.cos(a) * ringR, py = cy + Math.sin(a) * ringR;
        const tw = 0.45 + 0.55 * Math.sin(now * 0.006 + i * 0.7);
        vfx.circle(px, py, 1.8).fill({ color: tc._tier.glow, alpha: 0.55 * tw });
      }
    }
    // (B) Per-tier signature
    if(tc._tierIdx === 0){
      // STANDARD — cute crystal sparkles drifting around the medallion
      const SPARKLES = selected ? 9 : 4;
      for(let i = 0; i < SPARKLES; i++){
        const phase = ((now * 0.0009 + i * 0.18) % 1);
        const a = i * 2.3 + now * 0.0012;
        const dist = r * (1.08 + 0.42 * Math.sin(phase * Math.PI));
        const sx = Math.cos(a) * dist, sy = cy + Math.sin(a) * dist;
        const sz = 1.1 + 1.8 * (1 - Math.abs(phase - 0.5) * 2);
        const col = i % 3 === 0 ? 0xff8ad8 : (i % 3 === 1 ? 0xfff4fb : 0x7fe7ff);
        vfx.circle(sx, sy, sz).fill({ color: col, alpha: 0.85 * intensity });
        vfx.circle(sx, sy, sz * 2.2).fill({ color: col, alpha: 0.18 * intensity });
      }
    } else if(tc._tierIdx === 1){
      // HOT — flame embers rising from below medallion
      const EMBERS = selected ? 14 : 7;
      for(let i = 0; i < EMBERS; i++){
        const seed = (i * 137.508) % 1;                                    // deterministic per ember
        const phase = ((now * 0.0007 + seed) % 1);
        const ex = (seed - 0.5) * r * 1.9 + Math.sin(phase * 6 + i) * r * 0.18;
        const ey = cy + r * 0.85 - phase * r * 2.6;
        const alpha = (1 - phase) * (1 - phase) * 0.85 * intensity;
        const sz = 1.4 + 2.2 * (1 - phase);
        const col = phase < 0.4 ? 0xfff2d8 : (phase < 0.75 ? 0xffa852 : 0xff5a3a);
        vfx.circle(ex, ey, sz).fill({ color: col, alpha });
        vfx.circle(ex, ey, sz * 2.4).fill({ color: 0xff7a3f, alpha: alpha * 0.25 });
      }
    } else if(tc._tierIdx === 2){
      // MEGA — sticky-crown glints orbit + (selected) magenta lightning crackle
      for(let i = 0; i < 5; i++){
        const phase = ((now * 0.0011 + i * 0.20) % 1);
        const a = i * (Math.PI * 2 / 5) + (now * 0.00045);
        const px = Math.cos(a) * r * 1.04;
        const py = cy + Math.sin(a) * r * 1.04;
        const tw = phase < 0.32 ? Math.sin(phase / 0.32 * Math.PI) : 0;
        if(tw > 0.05){
          vfx.circle(px, py, 4.5 * tw).fill({ color: tc._tier.glow, alpha: tw * 0.42 * intensity });
          vfx.circle(px, py, 1.8 * tw + 0.4).fill({ color: 0xffffff, alpha: tw * intensity });
        }
      }
      if(selected){
        // 2 short lightning arcs crackling around the perimeter
        for(let i = 0; i < 2; i++){
          const phase = ((now * 0.0015 + i * 0.5) % 1);
          if(phase > 0.30) continue;
          const a0 = i * 2.1 + now * 0.0006;
          const r0 = r + 2, r1 = r + 14;
          const segs = 4;
          const path = [];
          for(let s = 0; s <= segs; s++){
            const t = s / segs;
            const a = a0 + Math.sin(i * 17 + s * 3 + now * 0.01) * 0.6;
            const rad = r0 + (r1 - r0) * t;
            path.push(Math.cos(a) * rad, cy + Math.sin(a) * rad);
          }
          const alpha = (1 - phase * 3.2) * intensity;
          if(alpha > 0.02){
            vfx.poly(path, false).stroke({ color: 0xff007f, width: 2.6, alpha: alpha * 0.5 });
            vfx.poly(path, false).stroke({ color: 0xffffff, width: 1.2, alpha });
          }
        }
      }
    }
  }

  // Back-compat: keep buyCostX6 returning the SELECTED tier's cost so any
  // call site that still reads it (e.g. the inline BUY BONUS pill price)
  // gets the correct amount.
  function buyCostX6(){ return bonusCostX6(_selectedTier); }

  function showBuyBonusModal(){
    if(State.phase !== Phase.IDLE) return;
    if(!COMPLY.allow_buy_bonus || STAKE.replay) return;
    // BUG FIX: clear any lingering win highlight from the previous spin
    // so the player sees a clean "fresh start" state when opening the
    // bonus modal. Previously the winCells + paylines could still glow
    // behind the modal backdrop.
    winCells = []; winLines = [];
    if(lineG) lineG.clear();
    if(winFx.on){
      winFx.on = false;
      winDisplay.alpha = 0;
      winDisplay.scale.set(1);
    }
    _selectedTier = 0;
    bmConfirm._t.text = socialFilter('BUY') + ' ' + fmtMoney(bonusCostX6(_selectedTier));
    layoutBuyModal(); buyModal.visible = true;
    modalIn(buyModalCard, buyModalBg);
  }
  function hideBuyBonusModal(){
    if(!buyModal.visible) return;
    modalOut(buyModalCard, buyModalBg, () => { buyModal.visible=false; });
  }
  buyBar.on('pointertap', showBuyBonusModal);
  bmCancel.on('pointertap', hideBuyBonusModal);
  buyClose.on('pointertap', hideBuyBonusModal);
  buyModalBg.on('pointertap', hideBuyBonusModal);

  // ── FLOATING CANDY "BUY BONUS" BUTTON (2026-06-10, delivered design) ──────────
  // Primary entry to the bonus picker, placed per the marked layout: desktop = LEFT
  // of the reels (vertical centre); portrait/mobile = BOTTOM-LEFT by the spin. Uses
  // the user art (TEX.buyBonus) when present; until the PNG lands a candy-pill
  // fallback keeps it working. The in-bar buyBar + menu entry are left intact.
  const buyFab = new PIXI.Container();
  buyFab.eventMode = 'static'; buyFab.cursor = 'pointer';
  stage.addChild(buyFab);
  const buyFabInner = new PIXI.Container(); buyFab.addChild(buyFabInner);     // layout scales this to fit
  const buyFabAnim  = new PIXI.Container(); buyFabInner.addChild(buyFabAnim); // idle breathe + float live here
  const buyFabPress = new PIXI.Container(); buyFabAnim.addChild(buyFabPress); // press squash (separate object → no tween conflict)
  let buyGlow = null, buyArt = null, buyCm = null;
  if (TEX.buyBonus) {
    // GLOW — soft blurred additive duplicate behind the art (Stake-safe built-in
    // BlurFilter, padding >=50 per slot-vfx-artist). Its alpha pulses in the loop.
    buyGlow = new PIXI.Sprite(TEX.buyBonus); buyGlow.anchor.set(0.5);
    buyGlow.blendMode = 'add'; buyGlow.alpha = 0.5; buyGlow.scale.set(1.06);
    const gblur = new PIXI.BlurFilter({ strength: 16, quality: 3 }); gblur.padding = 60;
    buyGlow.filters = [gblur];
    buyFabPress.addChild(buyGlow);
    buyArt = new PIXI.Sprite(TEX.buyBonus); buyArt.anchor.set(0.5);
    buyCm = new PIXI.ColorMatrixFilter(); buyArt.filters = [buyCm];           // brightness "shader" shimmer
    buyFabPress.addChild(buyArt);
  } else {
    const pill = new PIXI.Graphics();
    const pw = 150, ph = 150, pr = 34;
    pill.roundRect(-pw / 2, -ph / 2, pw, ph, pr).fill({ color: 0xb3247e, alpha: 0.95 });
    pill.roundRect(-pw / 2, -ph / 2, pw, ph, pr).stroke({ color: 0x8fe8ff, width: 4, alpha: 0.9 });
    pill.roundRect(-pw / 2 + 8, -ph / 2 + 8, pw - 16, ph * 0.42, pr - 10).fill({ color: 0xffffff, alpha: 0.12 });
    buyFabPress.addChild(pill);
    const lbl = new PIXI.Text({ text: 'BUY\nBONUS', style: { fontFamily: THEME.type.familyDisplay, fontSize: 30, fill: 0xffe24a, align: 'center', lineHeight: 30, stroke: { color: 0xd1356f, width: 5, join: 'round' } } });
    lbl.anchor.set(0.5); buyFabPress.addChild(lbl);
  }
  const _buyBaseW = Math.max(1, (buyArt || buyFabPress).width);   // intrinsic size for fit (blur-free)
  buyFab.on('pointertap', () => { try { Sound.click(); } catch (e) {} showBuyBonusModal(); });
  // PRESS FEEDBACK — Emil canon: 0.94 down (power3.out), elastic settle up.
  buyFab.on('pointerdown', () => { try { window.gsap && window.gsap.to(buyFabPress.scale, { x: 0.94, y: 0.94, duration: 0.1, ease: 'power3.out' }); } catch (e) {} });
  const _buyRelease = () => { try { window.gsap && window.gsap.to(buyFabPress.scale, { x: 1, y: 1, duration: 0.42, ease: 'elastic.out(1, 0.5)' }); } catch (e) {} };
  buyFab.on('pointerup', _buyRelease); buyFab.on('pointerupoutside', _buyRelease); buyFab.on('pointercancel', _buyRelease);
  // IDLE VFX LOOP — top-tier: breathe + float + glow pulse + brightness shimmer.
  // Stake-safe (built-in filters + GSAP transform/alpha, no raw GLSL). Honors
  // reduced-motion. The button persists for the session, so the loops live on.
  (function buyFabVfx() {
    const g = window.gsap;
    if (!g || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    g.to(buyFabAnim.scale, { x: 1.045, y: 1.045, duration: 1.5, ease: 'sine.inOut', repeat: -1, yoyo: true });
    g.to(buyFabAnim, { y: '-=7', duration: 1.9, ease: 'sine.inOut', repeat: -1, yoyo: true });
    if (buyGlow) g.to(buyGlow, { alpha: 0.9, duration: 1.2, ease: 'sine.inOut', repeat: -1, yoyo: true });
    if (buyCm) { const o = { b: 1 }; g.to(o, { b: 1.16, duration: 1.2, ease: 'sine.inOut', repeat: -1, yoyo: true, onUpdate() { try { buyCm.brightness(o.b, false); } catch (e) {} } }); }
  })();
  try { if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || /[?&]debug=/.test(location.search)) { window.__buyFab = buyFab; window.__buyModal = buyModal; } } catch (e) {}
  function layoutBuyFab() {
    const W = app.screen.width, H = app.screen.height;
    const portrait = H > W * 1.05;
    const targetW = portrait ? Math.min(W * 0.17, 88) : Math.min(W * 0.13, 184);   // mobile ~2x smaller per request
    buyFabInner.scale.set(targetW / _buyBaseW);
    if (portrait) buyFab.position.set(W * 0.17, H * 0.77);   // bottom-left by the spin
    else buyFab.position.set(W * 0.085, H * 0.46);            // left of the reels, vertical centre
  }
  layoutBuyFab();
  // VISIBILITY — show ONLY when buying is actually possible: idle phase, policy
  // allows it, and the picker isn't already open. Driven by the render loop
  // (refreshBuyFabVisibility) so it updates on every state change — fixes the
  // "buy-bonus active case still showing / not updating" bug.
  function refreshBuyFabVisibility() {
    // User: KEEP the BUY BONUS visible during spins (do NOT hide every spin) —
    // only hide it while the picker itself is open, or when policy/replay forbids it.
    buyFab.visible = _buyAllowed() && !buyModal.visible;
  }
  refreshBuyFabVisibility();
  bmConfirm.on('pointertap', () => {
    const cost = bonusCostX6(_selectedTier);
    if(State.balanceX6 < cost){ hideBuyBonusModal(); return; }
    const modeId = BONUS_TIERS[_selectedTier].id;   // 'bonus_standard'|'bonus_hot'|'bonus_mega'
    hideBuyBonusModal();
    // Pass the tier id directly — startSpin() resolves cost via bonusCostX6().
    // (Previously we remapped STANDARD → 'bonus' for legacy reasons; that
    // path also caused HOT/MEGA to be mis-priced as base bets.)
    startSpin(modeId);
  });

  // ── BET MENU MODAL — preset bet grid (Waylanders / Hacksaw pattern) ──
  // Tap on BET value opens a modal with the full betLevels grid. Faster
  // than ± stepping for big jumps. Current bet highlighted in gold;
  // unaffordable bets dimmed. MAX BET shortcut at bottom.
  const betMenu = new PIXI.Container(); betMenu.visible = false; stage.addChild(betMenu);
  const betMenuBg = new PIXI.Graphics(); betMenu.addChild(betMenuBg); betMenuBg.eventMode='static';
  const betMenuCard = new PIXI.Container(); betMenu.addChild(betMenuCard);
  const bmtCardBg = new PIXI.Graphics(); betMenuCard.addChild(bmtCardBg);
  const bmtTitle = new PIXI.Text({ text:socialFilter('SELECT BET'), style:txtStyle(18, SURF.title) });
  bmtTitle.anchor.set(0.5,0); betMenuCard.addChild(bmtTitle);
  const bmtClose = new PIXI.Container(); bmtClose.eventMode='static'; bmtClose.cursor='pointer';
  betMenuCard.addChild(bmtClose);
  const bmtCloseIcon = spr('icClose'); bmtClose.addChild(bmtCloseIcon);
  const bmtGrid = new PIXI.Container(); betMenuCard.addChild(bmtGrid);
  // ── BET CAROUSEL — a horizontal swipe/drag strip (replaces the paged 3-col grid).
  // Swipe left/right to scroll; release snaps to the nearest affordable tile and
  // selects it; tap a tile to jump to it. Scales to ANY betLevels count (10 or 100+
  // are the same smooth slider, no page clicks). bmtGrid is the draggable TRACK,
  // clipped to a centred viewport by bmtMask; bmtCenterHi marks the selection slot.
  bmtGrid.eventMode = 'static'; bmtGrid.cursor = 'grab';
  const bmtMask = new PIXI.Graphics(); bmtMask.eventMode = 'none'; betMenuCard.addChild(bmtMask); bmtGrid.mask = bmtMask;
  const bmtCenterHi = new PIXI.Graphics(); bmtCenterHi.eventMode = 'none'; betMenuCard.addChild(bmtCenterHi);
  let bmtStep = 120, bmtN = 0, bmtMinX = 0, bmtSnapRAF = null, bmtDrag = null;
  const bmtMaxBtn = makeModalBtn(betMenuCard, socialFilter('MAX BET'), THEME.colors.accent, 0xffffff);
  // BUY BONUS entry inside the bet menu (P0-B) — makes the feature reachable on
  // EVERY preset, including Popout S 400×225 where the inline bar pill is hidden.
  // An advertised mode unreachable at a required preset is a hard Stake reject
  // (Picker failed Popout S 4×). The BET tap exists on all presets, so routing
  // Buy Bonus through here guarantees touch access.
  const bmtBuyBtn = makeModalBtn(betMenuCard, socialFilter('BUY BONUS'), THEME.colors.pink, THEME.colors.text);
  bmtBuyBtn.visible = false;
  bmtBuyBtn.on('pointertap', () => { hideBetMenu(); try { Sound.click(); } catch(e){} showBuyBonusModal(); });
  // ── PAGE NAV (popup design-system) — ‹ N/M › for 100+ quick-bets ──
  // Pagination keeps tiles a fixed readable size no matter how many betLevels
  // the RGS sends; extra bets spill onto more pages instead of shrinking.
  let betMenuPage = 0;
  const bmtPrev = makeModalBtn(betMenuCard, '‹', THEME.colors.surface2, THEME.colors.text);
  const bmtNext = makeModalBtn(betMenuCard, '›', THEME.colors.surface2, THEME.colors.text);
  const bmtPageLbl = new PIXI.Text({ text:'', style:txtStyle(12, THEME.colors.textMuted) });
  bmtPageLbl.anchor.set(0.5); betMenuCard.addChild(bmtPageLbl);
  bmtPrev.visible = bmtNext.visible = bmtPageLbl.visible = false;
  bmtPrev.on('pointertap', () => { bmtSnapTo(bmtNearestAfford(bmtCentered() - 1), true); try { Sound.click(); } catch(e){} });
  bmtNext.on('pointertap', () => { bmtSnapTo(bmtNearestAfford(bmtCentered() + 1), true); try { Sound.click(); } catch(e){} });

  function showBetMenu(){
    if(State.phase !== Phase.IDLE) return;
    if(STAKE.replay) return;
    betMenu.visible = true;
    betMenuPage = -1;                   // sentinel → layout opens on the current bet's page
    layoutBetMenu();                    // sets betMenuCard._fitScale for this preset
    modalIn(betMenuCard, betMenuBg);    // animates to _fitScale (fits Popout S 400×225)
  }
  function hideBetMenu(){
    if(!betMenu.visible) return;
    modalOut(betMenuCard, betMenuBg, () => { betMenu.visible = false; bmtGrid.removeChildren(); });
  }
  betMenuBg.on('pointertap', () => { if(bmtGrid._wasDrag){ bmtGrid._wasDrag = false; return; } hideBetMenu(); });
  bmtClose.on('pointertap', hideBetMenu);

  // ── carousel physics + selection (function decls hoist into layoutBetMenu) ──
  function bmtClampX(x){ return Math.max(bmtMinX, Math.min(0, x)); }
  function bmtCentered(){ return Math.max(0, Math.min(bmtN - 1, Math.round(-bmtGrid.x / bmtStep))); }
  function bmtAfford(i){ return State.balanceX6 >= (State.betLevels[i] ?? Infinity); }
  function bmtNearestAfford(i){
    if(bmtAfford(i)) return i;
    for(let d = 1; d < bmtN; d++){ if(i-d >= 0 && bmtAfford(i-d)) return i-d; if(i+d < bmtN && bmtAfford(i+d)) return i+d; }
    return 0;
  }
  function bmtFocus(idx){   // live highlight of the centred tile (cheap visibility toggle) + slot label
    for(const t of bmtGrid.children){ if(t && t._hi) t._hi.visible = (t._idx === idx); }
    if(bmtPageLbl.visible) bmtPageLbl.text = (idx + 1) + ' / ' + bmtN;
  }
  function bmtCommit(idx){
    idx = Math.max(0, Math.min(bmtN - 1, idx));
    if(State.betLevels[idx] !== undefined && bmtAfford(idx) && State.betIdx !== idx){
      State.betIdx = idx; State.betX6 = State.betLevels[idx]; updateHUD();
    }
    bmtFocus(idx);
  }
  function bmtSnapTo(idx, commit){
    if(bmtSnapRAF){ cancelAnimationFrame(bmtSnapRAF); bmtSnapRAF = null; }
    idx = Math.max(0, Math.min(bmtN - 1, idx));
    const target = bmtClampX(-idx * bmtStep), x0 = bmtGrid.x, t0 = performance.now(), dur = 240;
    (function ease(){
      const p = Math.min(1, (performance.now() - t0) / dur), k = 1 - Math.pow(1 - p, 3);   // outCubic
      bmtGrid.x = x0 + (target - x0) * k; bmtFocus(bmtCentered());
      if(p < 1){ bmtSnapRAF = requestAnimationFrame(ease); }
      else { bmtSnapRAF = null; bmtGrid.x = target; if(commit) bmtCommit(idx); }
    })();
  }
  bmtGrid.on('pointerdown', e => {
    if(STAKE.replay) return;
    if(bmtSnapRAF){ cancelAnimationFrame(bmtSnapRAF); bmtSnapRAF = null; }
    bmtDrag = { sx: e.global.x, gx0: bmtGrid.x, moved: 0, downLocalX: bmtGrid.toLocal(e.global).x };
    bmtGrid._wasDrag = false; bmtGrid.cursor = 'grabbing';
  });
  bmtGrid.on('globalpointermove', e => {
    if(!bmtDrag) return;
    const dx = (e.global.x - bmtDrag.sx) / (betMenuCard.scale.x || 1);
    bmtDrag.moved = Math.max(bmtDrag.moved, Math.abs(dx));
    bmtGrid.x = bmtClampX(bmtDrag.gx0 + dx); bmtFocus(bmtCentered());
  });
  function bmtEndDrag(){
    if(!bmtDrag) return;
    const wasDrag = bmtDrag.moved > 6, downLocalX = bmtDrag.downLocalX;
    bmtGrid.cursor = 'grab'; bmtDrag = null;
    bmtGrid._wasDrag = wasDrag;   // suppress the bg/tile tap-close that follows a drag
    const idx = wasDrag ? bmtCentered() : Math.round(downLocalX / bmtStep);
    bmtSnapTo(bmtNearestAfford(idx), true);
    try { Sound.click(); } catch(e){}
  }
  bmtGrid.on('pointerup', bmtEndDrag);
  bmtGrid.on('pointerupoutside', bmtEndDrag);
  betMenuBg.on('pointerup', bmtEndDrag);

  function layoutBetMenu(){
    const W=app.screen.width, H=app.screen.height;
    drawSurfScrim(betMenuBg, W, H);
    const levels = State.betLevels || [];
    const buyRow = (COMPLY.allow_buy_bonus && !STAKE.replay);
    bmtN = levels.length;
    // ── SINGLE-ROW SWIPE CAROUSEL ─────────────────────────────────────────
    // ONE readable row, no pages — the strip just gets longer for more
    // betLevels (10 or 100+ are the identical smooth slider). Swipe/drag to
    // scroll; the centred tile is the selection. MAX BET + BUY BONUS stay
    // pinned to the footer (reachable at every preset incl. Popout S).
    const tileH = 46;
    const tileW = Math.max(76, Math.min(124, W * 0.30));
    const tgap  = 12;
    bmtStep = tileW + tgap;
    bmtMinX = Math.min(0, -((bmtN - 1) * bmtStep));
    const topH = 58;                                     // title + divider band
    const footerH = 16 + 40 + (buyRow ? 50 : 0) + 14;    // pad + MAX (+ BUY) + pad
    const navStripH = 28;
    const cardW = Math.min(W * 0.94, 460);
    const cardH = topH + tileH + 22 + navStripH + footerH;
    betMenuCard.position.set(W/2, H/2);
    // FIT-TO-VIEWPORT clamp (Popout S 400×225) — === 1 at every larger preset.
    const fitScale = Math.min(1, (W - 16) / cardW, (H - 12) / cardH);
    betMenuCard._fitScale = fitScale; betMenuCard.scale.set(fitScale);
    drawSurfChrome(bmtCardBg, cardW, cardH, { radius: 16, titleDivAt: 44 });
    bmtTitle.position.set(0, -cardH/2 + 18);
    styleClose(bmtClose, bmtCloseIcon, cardW/2, cardH/2);

    // Centred viewport (whole tiles only) — the track is clipped to this strip.
    const rowY = -cardH/2 + topH + 4 + tileH/2;
    const vpW  = Math.min(cardW - 26, bmtStep * Math.max(1, bmtN) - tgap + 2);
    bmtGrid.position.set(0, rowY);                       // .x = scroll (set after tiles)
    bmtMask.clear().rect(-vpW/2, rowY - tileH/2 - 6, vpW, tileH + 12).fill(0xffffff);

    // Build the row — ALL levels, left→right at i*bmtStep.
    bmtGrid.removeChildren();
    levels.forEach((amt, i) => {
      const affordable = State.balanceX6 >= amt;
      const c = new PIXI.Container(); c._idx = i; c.position.set(i * bmtStep, 0);
      const cr = tileH * 0.28;
      const cell = new PIXI.Graphics();
      cell.roundRect(-tileW/2,-tileH/2, tileW,tileH, cr).fill({ color:SURF.tileBg, alpha:0.95 })
          .roundRect(-tileW/2+3,-tileH/2+2, tileW-6,1, 0.5).fill({ color:0xffffff, alpha:0.10 })
          .roundRect(-tileW/2,-tileH/2, tileW,tileH, cr).stroke({ color:SURF.accent, width:1, alpha:0.30 });
      c.addChild(cell);
      // SELECTED gold-crystal pill — visibility driven by the carousel focus.
      const hi = new PIXI.Graphics();
      hi.roundRect(-tileW/2-3,-tileH/2-3, tileW+6,tileH+6, cr+2).fill({ color:SURF.accent, alpha:0.22 })
        .roundRect(-tileW/2,-tileH/2, tileW,tileH, cr).fill({ color:0x3a0a26, alpha:1 })
        .roundRect(-tileW/2+1,-tileH/2+1, tileW-2,tileH*0.5, cr).fill({ color:SURF.accentHi, alpha:0.55 })
        .roundRect(-tileW/2+4,-tileH/2+2, tileW-8,1.3, 0.7).fill({ color:0xffffff, alpha:0.5 })
        .roundRect(-tileW/2,-tileH/2, tileW,tileH, cr).stroke({ color:SURF.chrome.bright, width:1.6, alpha:1 });
      hi.visible = (i === (State.betIdx || 0)); c._hi = hi; c.addChild(hi);
      const label = new PIXI.Text({ text:fmtMoney(amt), style:{ fontFamily:'Luckiest Guy', fontSize:15, letterSpacing:0.6, fill:0xffffff }});
      label.anchor.set(0.5); c.addChild(label);
      if(!affordable){ cell.alpha = 0.5; label.alpha = 0.45; }
      bmtGrid.addChild(c);
    });
    bmtGrid.x = bmtClampX(-(State.betIdx || 0) * bmtStep);   // open centred on the current bet

    // Selection-slot brackets at the viewport centre (frame the chosen tile).
    bmtCenterHi.clear();
    const bX = tileW/2 + 7, bY = tileH/2 + 6;
    for(const [sx, sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
      bmtCenterHi.moveTo(sx*(bX-10), rowY + sy*bY).lineTo(sx*bX, rowY + sy*bY).lineTo(sx*bX, rowY + sy*(bY-10));
    }
    bmtCenterHi.stroke({ color:SURF.accentHi, width:2, alpha:0.85 });

    // ‹ › nudge one tile; the label is the live selection slot "i / N".
    const showNav = bmtN > 1;
    const navY = -cardH/2 + topH + 4 + tileH + 18;
    for(const btn of [bmtPrev, bmtNext]){
      btn.visible = showNav; btn.eventMode = 'static'; btn.cursor = 'pointer'; btn.alpha = 1;
      drawGlossyBtn(btn._bg, 36, 26, 'secondary');
    }
    bmtPrev.position.set(-vpW/2 + 22, navY);
    bmtNext.position.set(vpW/2 - 22, navY);
    bmtPageLbl.visible = showNav;
    bmtPageLbl.position.set(0, navY);
    bmtFocus(State.betIdx || 0);   // pill + "i / N" label

    // MAX BET button at bottom (+ BUY BONUS row beneath it when allowed)
    const btnW = Math.min(180, cardW*0.5), btnH = 40;
    drawGlossyBtn(bmtMaxBtn._bg, btnW, btnH, 'primary');
    bmtMaxBtn.position.set(0, cardH/2 - (buyRow ? 80 : 32));
    // BUY BONUS row (P0-B) — magenta + gold-stroked so it reads as the special
    // feature, distinct from the gold MAX BET. Hidden when the jurisdiction
    // disallows buy-bonus or in replay mode.
    if(buyRow){
      const bw2 = Math.min(220, cardW*0.62);
      bmtBuyBtn.visible = true;
      drawGlossyBtn(bmtBuyBtn._bg, bw2, btnH, 'primary');
      bmtBuyBtn.position.set(0, cardH/2 - 30);
    } else {
      bmtBuyBtn.visible = false;
    }
  }
  bmtMaxBtn.on('pointertap', () => {
    // pick the highest affordable level
    let maxIdx = 0;
    for(let i = 0; i < State.betLevels.length; i++){
      if(State.balanceX6 >= State.betLevels[i]) maxIdx = i;
    }
    State.betIdx = maxIdx; State.betX6 = State.betLevels[maxIdx];
    updateHUD();
    try { Sound.click(); } catch(e){}
    hideBetMenu();
  });

  // Wire the BET taps:
  //   value → bet menu (preset amounts grid)
  //   label → 10-LINES preview (player sees what they're playing)
  betValue.removeAllListeners('pointertap');
  betLabel.removeAllListeners('pointertap');
  betValue.on('pointertap', showBetMenu);
  betLabel.on('pointertap', showLinesPreview);

  // ── DRAWER SYSTEM (History / Stats / Settings / Autoplay) ─────
  const drawerLayer = new PIXI.Container(); drawerLayer.visible = false; stage.addChild(drawerLayer);
  const drawerBg = new PIXI.Graphics(); drawerLayer.addChild(drawerBg); drawerBg.eventMode='static';
  const drawerPanel = new PIXI.Container(); drawerLayer.addChild(drawerPanel);
  // Procedural dark+gold panel (matches new bar style); old popupSet sprite removed
  const drawerPanelBg = new PIXI.Graphics(); drawerPanel.addChild(drawerPanelBg);
  const drawerTitle = new PIXI.Text({ text:'', style:txtStyle(18, SURF.title) });
  drawerTitle.anchor.set(0.5,0); drawerPanel.addChild(drawerTitle);
  const drawerClose = new PIXI.Container(); drawerClose.eventMode='static'; drawerClose.cursor='pointer';
  drawerPanel.addChild(drawerClose);
  const drawerCloseIcon = spr('icClose'); drawerClose.addChild(drawerCloseIcon);
  const drawerBody = new PIXI.Container(); drawerPanel.addChild(drawerBody);

  // ── SCROLLABLE MODAL BODY (P0-C) ─────────────────────────────────────
  // Stake rejects modal content that overflows the card with no way to reach
  // it (Popout S 400x225: the paytable is ~420px in a ~198px card). Stake DOES
  // permit scrolling inside the info modal + autoplay panel, so we (a) clip the
  // body to its viewport with a mask — kills the visual spill onto the dimmed
  // game outright — and (b) allow drag + wheel to reach clipped rows. Reused by
  // the info modal and the settings/autoplay drawer.
  function makeScrollable(body, card){
    const mask = new PIXI.Graphics(); mask.eventMode = 'none'; card.addChild(mask);
    body.mask = mask; body.eventMode = 'static';
    body._scroll = 0; body._maxScroll = 0; body._contentH = 0;
    body.hitArea = new PIXI.Rectangle(0, 0, 400, 300);
    const clampScroll = () => {
      body._scroll = Math.max(0, Math.min(body._maxScroll, body._scroll));
      body.pivot.y = body._scroll;
      body.hitArea.y = body._scroll;                 // keep the drag region over the viewport
    };
    // Call AFTER content is added + body positioned (_w/_h/position set).
    body._refreshScroll = () => {
      body.pivot.y = 0;                              // measure children unscrolled
      const m = body.mask; body.mask = null;         // detach so bounds = true content height
      body._contentH = body.height;
      body.mask = m;
      body._maxScroll = Math.max(0, body._contentH - (body._h || 0) + 10);
      body.hitArea.x = 0; body.hitArea.width = (body._w || 400) + 12;
      body.hitArea.height = (body._h || 300);
      mask.clear()
        .rect(body.position.x - 6, body.position.y - 8, (body._w || 400) + 16, (body._h || 300) + 14)
        .fill({ color: 0xffffff });
      body._scroll = 0; clampScroll();
    };
    let dragging = false, startY = 0, startScroll = 0;
    body.on('pointerdown', e => { dragging = true; startY = e.global.y; startScroll = body._scroll; });
    body.on('globalpointermove', e => {
      if(!dragging || body._maxScroll <= 0) return;
      body._scroll = startScroll - (e.global.y - startY); clampScroll();
    });
    const endDrag = () => { dragging = false; };
    body.on('pointerup', endDrag); body.on('pointerupoutside', endDrag);
    body._wheel = d => { if(body._maxScroll > 0){ body._scroll += d * 0.6; clampScroll(); } };
  }
  makeScrollable(drawerBody, drawerPanel);

  let activeDrawer = null;
  let drawerWantH = 560;   // panel height — driven by the populated CONTENT
  function openDrawer(name){
    if(State.phase !== Phase.IDLE && name !== 'history') return;
    const wasOpen = drawerLayer.visible;
    activeDrawer = name; drawerLayer.visible = true;
    drawerWantH = 560;                 // generous default while we populate
    layoutDrawer(); populateDrawer(name);
    // ── SIZE PANEL TO CONTENT (2026-05-30) ───────────────────────────────
    // Was a fixed 560px modal, so autoplay/stats rendered a huge empty void
    // (user: "don't make a bigger modal for little content"). Measure the
    // populated body and shrink the panel to fit -> compact dropdown feel.
    // Measure with the mask DETACHED (the mask lives on drawerPanel, outside this
    // subtree) — measuring a masked container whose mask is external makes Pixi
    // warn "Mask bounds, renderable is not inside the root container" on EVERY
    // drawer open → production console-silence violation (Stake §4).
    const _dm = drawerBody.mask; drawerBody.mask = null;
    const contentH = drawerBody.height || 360;
    drawerBody.mask = _dm;
    drawerWantH = Math.max(190, Math.min(app.screen.height*0.84, contentH + 90));
    layoutDrawer();
    drawerBody._refreshScroll && drawerBody._refreshScroll();   // P0-C: clip + scroll if content still exceeds the capped panel
    // fresh open springs in; switching tabs on an already-open drawer just
    // swaps content (no re-pop - tab switching is too frequent to animate).
    if(wasOpen) modalSnap(drawerPanel, drawerBg);
    else modalIn(drawerPanel, drawerBg);
  }
  function closeDrawer(){
    if(!drawerLayer.visible) return;
    modalOut(drawerPanel, drawerBg, () => {
      drawerLayer.visible = false; activeDrawer = null; drawerBody.removeChildren();
    });
  }
  drawerBg.on('pointertap', closeDrawer);
  drawerClose.on('pointertap', closeDrawer);

  function layoutDrawer(){
    const W=app.screen.width, H=app.screen.height;
    // Darken scrim (was 92% black) — keeps the gameplay readable behind
    // the modal while still focusing attention. Combined with the new
    // bg zoom push (no more blur), 80% scrim feels cleaner.
    drawerBg.clear().rect(0,0,W,H).fill({ color:0x000000, alpha:0.80 });
    // Settings drawer height — bumped 480 → 560 so the GAME spec section
    // (Layout / Paylines / RTP / Max Win rows) doesn't clip below the
    // panel border. Per user feedback: "Game specs section clipping
    // awkwardly over the background panel."
    const panW=Math.min(380,W*0.9), panH=Math.min(H*0.84,drawerWantH);
    // RESP-16 — Settings drawer fitScale. drawerWantH up to 560 vs Popout S
    // 225 viewport → panel overflows even with the 0.84 clamp. Apply fitScale
    // so panel always fits with 12px padding.
    const _dMaxH = H - 12, _dMaxW = W - 16;
    const _dFit  = Math.min(1, _dMaxH / panH, _dMaxW / panW);
    drawerPanel._fitScale = _dFit;
    drawerPanel.scale.set(_dFit);
    drawerPanel.position.set(W/2,H/2);
    // ── DRAWER PANEL — VILLAIN DARKENS (2026-05-27 redesign) ──────────
    // Per user "settings/info popups more aesthetic darkens style and
    // text for the whitesmoke effective more villain style 8k quality".
    // Replaced the soft pink-tinted gradient with a deeper obsidian
    // panel that has chamfered-corner accents, magenta hairline border,
    // and a brighter top highlight. Reads as a premium ops console.
    // Unified VIBRANT CRYSTAL-GLASS chrome — same drawPanelChrome as every modal
    // (2026-06-01). Replaced the bespoke sci-fi corner-bracket panel so the
    // settings drawer speaks the exact same award-tier glassy language: gradient
    // body, glossy top sheen, cyan-dispersion border, magenta bloom, title divider.
    drawSurfChrome(drawerPanelBg, panW, panH, { radius:18, titleDivAt:44 });
    drawerTitle.position.set(0,-panH/2+18);
    styleClose(drawerClose, drawerCloseIcon, panW/2, panH/2);   // unified close
    drawerBody.position.set(-panW/2+22,-panH/2+58);
    drawerBody._w = panW-44; drawerBody._h = panH-80;
  }
  function drText(text,size,fill,x,y,anchor){
    // Drawer text default — when caller passes a muted purple fill
    // (legacy 0xc9b0e6 = labels, 0x776688 = descriptions, 0x9988aa = empty
    // state), promote to villain whitesmoke / faint smoke-white so the
    // drawer reads as the new villain darkens aesthetic. Per user "text
    // for the whitesmoke effective more villain style".
    let finalFill = fill;
    if(fill === 0xc9b0e6) finalFill = 0xf5f7fa;       // label → smoke-white
    else if(fill === 0x776688) finalFill = 0x8088a0;  // desc → faint smoke
    else if(fill === 0x9988aa) finalFill = 0x8088a0;  // empty state → faint
    const t = new PIXI.Text({ text, style:{ fontFamily:'Fredoka', fontSize:size, fill: finalFill, fontWeight:'bold' }});
    t.anchor.set(anchor||0,0); t.position.set(x,y);
    drawerBody.addChild(t); return t;
  }
  function drRow(label,value,y,rowW){
    // 2-color system: label = smoke-purple-grey (cool secondary text on dark
    // panel), value = SMOKE-WHITE (was gold). Pink reserved for active
    // emphasis only.
    drText(socialFilter(label),12,0xc9b0e6,0,y);   // social-safe row label (gate S4)
    const v = new PIXI.Text({ text:socialFilter(value), style:{ fontFamily:'Luckiest Guy', fontSize:13, fill:0xf5f7fa, letterSpacing:1 }});
    v.anchor.set(1,0); v.position.set(rowW,y); drawerBody.addChild(v); return v;
  }
  function populateDrawer(name){
    drawerBody.removeChildren();
    const w = drawerBody._w || 300;
    if(name==='history' || name==='stats'){
      ['history','stats'].forEach((tab,i) => {
        const bw=w/2-4;
        const c=new PIXI.Container(); c.eventMode='static'; c.cursor='pointer';
        const bg=new PIXI.Graphics(); c.addChild(bg);
        const sel=tab===name;
        // Selected tab = gold bg + dark text; inactive = dark slate
        bg.roundRect(0,0,bw,26,6).fill(sel?SURF.accent:SURF.pillOff).stroke({ color:sel?SURF.accentHi:SURF.pillStroke, width:1.5 });
        const t=new PIXI.Text({ text:tab.toUpperCase(), style:{ fontFamily:SURF.familyDisplay, fontSize:11, fill:sel?0xffffff:SURF.label, letterSpacing:1 }});
        t.anchor.set(0.5); t.position.set(bw/2,13); c.addChild(t);
        c.position.set(i*(bw+8),0);
        c.on('pointertap', () => { closeDrawer(); openDrawer(tab); });
        drawerBody.addChild(c);
      });
    }
    if(name==='history'){
      drawerTitle.text = 'HISTORY';
      if(State.history.length===0){ drText('No spins yet.',13,0x9988aa,w/2,60,0.5); }
      else {
        const max=Math.min(State.history.length,20);
        for(let i=0;i<max;i++){
          const h=State.history[i]; const y=36+i*26;
          drText('#'+(i+1),10,0x776688,0,y);
          // history rows — winning rows in gold, losing rows in muted grey
          drText(h.label||'—',12,h.mx100>0?SURF.value:SURF.muted,30,y);
          const pay = h.mx100>0 ? fmtMoney(Math.round(h.betX6*h.mx100/100)) : '—';
          const pv=new PIXI.Text({ text:pay, style:{ fontFamily:'Fredoka', fontSize:11, fill:h.mx100>0?0x83dd9e:0x776688, fontWeight:'bold' }});
          pv.anchor.set(1,0); pv.position.set(w,y); drawerBody.addChild(pv);
        }
      }
    }
    if(name==='stats'){
      drawerTitle.text = 'STATS';
      const s=State.stats; let y=36; const gap=26;
      drRow('Total Spins',s.spins.toString(),y,w); y+=gap;
      drRow(socialFilter('Total Bet'),fmtMoney(s.totalBet),y,w); y+=gap;
      drRow('Total Won',fmtMoney(s.totalWon),y,w); y+=gap;
      const net=s.totalWon-s.totalBet;
      const netV=drRow('Net P/L',(net>=0?'+':'')+fmtMoney(net),y,w);
      netV.style.fill = net>=0?0x83dd9e:0xd8336a; y+=gap;
      drRow('Hit Frequency',s.spins?(s.hits/s.spins*100).toFixed(1)+'%':'0%',y,w); y+=gap;
      drRow('Free Spin Features',s.features.toString(),y,w); y+=gap;
      drRow('Biggest Win',fmtMoney(s.biggest),y,w); y+=gap;
      const rtp=s.totalBet?(s.totalWon/s.totalBet*100):0;
      drRow('Session RTP',s.spins?rtp.toFixed(2)+'%':'—',y,w); y+=gap+8;
      drText('Theoretical RTP: '+RTP_DISPLAY,10,0x9988aa,w/2,y,0.5);
    }
    if(name==='settings'){
      drawerTitle.text = 'SETTINGS';
      let y=4; const gap=40;
      function makeToggle(label,desc,val,onTap){
        drText(label,12,0xc9b0e6,0,y);
        drText(desc,9,0x776688,0,y+15);
        const tg=new PIXI.Container(); tg.eventMode='static'; tg.cursor='pointer';
        const tbg=new PIXI.Graphics(); tg.addChild(tbg);
        const tknob=new PIXI.Graphics(); tg.addChild(tknob);
        // ── VILLAIN TOGGLE (2026-05-27 redesign) ───────────────────────
        // Replaces the candy-green/grey pill with a sleek villain-aesthetic
        // switch: obsidian track with magenta hairline border, glowing
        // halo when ON, smoke-white knob with magenta inner core. Larger
        // hit area (52×26 vs 40×22) so it's easier to tap.
        const tw = 52, th = 26;
        const tr = th * 0.5;
        const G_CORE = SURF.accent, G_EDGE = SURF.accentHi;   // magenta ON-state (matches the bar)
        // (1) Outer glow halo (only when ON)
        if(val){
          tbg.roundRect(-4, -3, tw+8, th+6, tr+3).fill({ color: G_CORE, alpha: 0.12 });
          tbg.roundRect(-2, -1, tw+4, th+2, tr+1).fill({ color: G_CORE, alpha: 0.22 });
        }
        // (2) Track — obsidian with subtle gradient
        tbg.roundRect(0, 0, tw, th, tr).fill({ color: val ? 0x1a1408 : 0x141420, alpha: 1 });
        // Inner gold tint when ON (the "filled" side reads as active)
        if(val){
          tbg.roundRect(2, 2, tw-4, th-4, tr-2).fill({ color: G_CORE, alpha: 0.22 });
        }
        // (3) Border — gold when ON, smoke-grey when OFF
        tbg.roundRect(0, 0, tw, th, tr)
          .stroke({ color: val ? G_EDGE : 0x3d3d4e, width: 1.3, alpha: val ? 0.95 : 0.70 });
        // (4) Top shine hairline
        tbg.roundRect(tr*0.4, 1, tw - tr*0.8, 0.8, 0.4)
          .fill({ color: 0xf5f7fa, alpha: val ? 0.40 : 0.18 });
        // (5) Knob — smoke-white shell with gold inner pip when ON
        const knobX = val ? tw - tr : tr;
        const knobR = tr - 4;
        tknob.circle(knobX, tr, knobR).fill({ color: 0xf5f7fa, alpha: 1 });
        tknob.circle(knobX, tr, knobR).stroke({ color: val ? G_EDGE : 0x9097a5, width: 0.8 });
        if(val){
          // Inner gold pip — reads as "on"
          tknob.circle(knobX, tr, knobR * 0.42).fill({ color: G_CORE, alpha: 1 });
        }
        tg.position.set(w-tw, y);
        // Bigger hit area to tap easily (the visual is 52×26 but the hit
        // includes the halo padding so a near-miss still triggers).
        tg.hitArea = new PIXI.Rectangle(-6, -4, tw+12, th+8);
        tg.on('pointertap', () => { onTap(); closeDrawer(); openDrawer('settings'); });
        drawerBody.addChild(tg); y+=gap;
      }
      makeToggle('Sound','Spin & win audio',!State.muted,() => {
        State.muted=!State.muted;
        btnSound._icon.texture=tex(State.muted?'icMute':'icSound');
        btnSound._setActive(!State.muted); Sound.setMuted(State.muted); persistSave();
        syncDeliveredBar();   // reflect sound state on the delivered portrait bar
      });

      // ── TURBO — 3-state segmented control (OFF / TURBO / MAX) ──
      // Matches Stake/Hacksaw spinner cadence: OFF = full cinematic
      // (~1.2s round), TURBO = ~3× faster, MAX = ~5× faster (still readable).
      drText('Turbo Speed',12,0xc9b0e6,0,y);
      drText('Spin pacing — switch any time',9,0x776688,0,y+15);
      const segW=140, segH=24, segR=segH/2;
      const segG = new PIXI.Container(); segG.position.set(w-segW, y);
      const segBg = new PIXI.Graphics();
      segBg.roundRect(0,0,segW,segH,segR).fill(0x2a2a36).stroke({color:0x3d3d4e,width:1});
      segG.addChild(segBg);
      const segKnob = new PIXI.Graphics();
      const segPad = 2, cellW = (segW - segPad*2) / 3;
      // 3-state turbo knob: OFF = neutral grey, TURBO = soft gold, MAX = bright gold
      const knobCol = State.turboMode===2 ? SURF.accent : State.turboMode===1 ? SURF.accentHi : 0x6a6a78;
      segKnob.roundRect(segPad + State.turboMode*cellW, segPad, cellW, segH-segPad*2, (segH-segPad*2)/2)
        .fill({color:knobCol, alpha:0.95});
      segG.addChild(segKnob);
      ['OFF','TURBO','MAX'].forEach((lbl, i) => {
        const t = new PIXI.Text({ text:lbl, style:{
          fontFamily:'Fredoka', fontSize:10, fontWeight:'700',
          fill: i===State.turboMode ? 0x141420 : 0x9ca0b3, align:'center' }});
        t.anchor.set(0.5);
        t.position.set(segPad + i*cellW + cellW/2, segH/2);
        segG.addChild(t);
        const hit = new PIXI.Container(); hit.eventMode='static'; hit.cursor='pointer';
        const hr = new PIXI.Graphics().rect(segPad + i*cellW, 0, cellW, segH).fill({color:0xffffff, alpha:0.001});
        hit.addChild(hr);
        // Desktop hover lift on the non-active cell label (clean micro-interaction).
        hit.on('pointerover', e => { if((!e || e.pointerType==='mouse') && i!==State.turboMode) t.scale.set(1.14); });
        hit.on('pointerout', () => { if(i!==State.turboMode) t.scale.set(1); });
        hit.on('pointertap', () => {
          State.turboMode = i; persistSave();
          refreshTurboBtn();   // keep the bar button in sync
          syncDeliveredBar();  // reflect turbo mode on the delivered portrait bar
          closeDrawer(); openDrawer('settings');
        });
        segG.addChild(hit);
      });
      drawerBody.addChild(segG);
      y += gap;

      makeToggle('Reduced Effects','Less motion & screen shake',State.reduced,() => {
        State.reduced=!State.reduced; persistSave();
      });
      y+=8;
      drText('GAME',11,0xffffff,w/2,y,0.5); y+=20;
      drRow('Layout','5 reels × 3 rows',y,w); y+=22;
      drRow('Paylines','10 fixed',y,w); y+=22;
      drRow('RTP',RTP_DISPLAY,y,w); y+=22;
      drRow('Max Win',ADVERTISED_MAX_X.toLocaleString('en-US')+'×',y,w);
      y += 32;
      // ── GAME INFO button — opens the full info/paytable modal straight from the
      // menu drawer (user: "add game information in the menu, not only settings").
      const giBtn = new PIXI.Container(); giBtn.eventMode = 'static'; giBtn.cursor = 'pointer';
      const giBg = new PIXI.Graphics(); giBtn.addChild(giBg);
      const drawGi = (hov) => { giBg.clear()
        .roundRect(0, 0, w, 34, 9).fill(hov ? SURF.accent : SURF.pillOff)
        .roundRect(0, 0, w, 34, 9).stroke({ color: SURF.accentHi, width: 1.5 }); };
      drawGi(false);
      const giT = new PIXI.Text({ text: 'GAME INFO', style: { fontFamily: SURF.familyDisplay, fontSize: 12, fill: 0xffffff, letterSpacing: 1.5 } });
      giT.anchor.set(0.5); giT.position.set(w / 2, 17); giBtn.addChild(giT);
      giBtn.position.set(0, y);
      giBtn.on('pointerover', (e) => { if (!e || e.pointerType === 'mouse') drawGi(true); });
      giBtn.on('pointerout', () => drawGi(false));
      giBtn.on('pointertap', () => { try { Sound.click(); } catch (e) {} closeDrawer(); showInfoModal(); });
      drawerBody.addChild(giBtn);
      y += 42;
    }
    if(name==='autoplay'){
      drawerTitle.text = 'AUTOPLAY';
      if(COMPLY.autoplay_max===0){
        drText('Autoplay is not available\nin this jurisdiction.',13,0xff8888,w/2,40,0.5); return;
      }
      let y=0;
      drText('Number of spins:',12,0xc9b0e6,0,y); y+=22;
      const counts=[10,25,50,100,250];
      if(COMPLY.autoplay_max===Infinity) counts.push(0);
      const cols=3;
      counts.forEach((n,i) => {
        const col=i%cols, row=Math.floor(i/cols);
        const bw=(w-12)/cols, bh=32;
        const c=new PIXI.Container(); c.eventMode='static'; c.cursor='pointer';
        const bg=new PIXI.Graphics(); c.addChild(bg);
        // Gold autoplay tiles — dark slate bg, gold edge + warm-gold number, hover lift.
        const drawTile = hov => { bg.clear().roundRect(0,0,bw,bh,8)
          .fill(hov?0x2a2436:0x1f1c2e)
          .stroke({ color:hov?SURF.accentHi:SURF.accent, width:hov?2:1.6, alpha:hov?0.95:0.6 }); };
        drawTile(false);
        const t=new PIXI.Text({ text:n===0?'∞':n.toString(), style:{ fontFamily:SURF.familyDisplay, fontSize:13, fill:SURF.value }});
        t.anchor.set(0.5); t.position.set(bw/2,bh/2); c.addChild(t);
        c.position.set(col*(bw+6),y+row*(bh+6));
        c.on('pointerover', e => { if(!e || e.pointerType==='mouse'){ drawTile(true); t.scale.set(1.08); } });
        c.on('pointerout', () => { drawTile(false); t.scale.set(1); });
        c.on('pointertap', () => {
          const spins = n===0 ? Infinity : Math.min(n,COMPLY.autoplay_max);
          State.autoplay.active=true; State.autoplay.remaining=spins; State.autoplay.total=spins;
          closeDrawer();
          if(State.phase===Phase.IDLE) startSpin();
        });
        drawerBody.addChild(c);
      });
      y+=Math.ceil(counts.length/cols)*38+12;
      function makeStopToggle(label,desc,val,key){
        drText(label,11,0xc9b0e6,0,y);
        drText(desc,9,0x776688,0,y+13);
        const tg=new PIXI.Container(); tg.eventMode='static'; tg.cursor='pointer';
        const tbg=new PIXI.Graphics(); tg.addChild(tbg);
        const tknob=new PIXI.Graphics(); tg.addChild(tknob);
        const tw=36,th=18;
        tbg.roundRect(0,0,tw,th,th/2).fill(val?SURF.accent:SURF.pillOff).stroke({ color:val?SURF.accentHi:SURF.pillStroke, width:1 });
        tknob.circle(val?tw-th/2:th/2,th/2,th/2-3).fill(0xf5f7fa);
        tg.position.set(w-tw,y+2);
        tg.on('pointertap', () => { State.autoplay[key]=!State.autoplay[key]; closeDrawer(); openDrawer('autoplay'); });
        drawerBody.addChild(tg); y+=34;
      }
      makeStopToggle('Stop on Free Spins','End auto if feature triggers',State.autoplay.stopOnFeature,'stopOnFeature');
      makeStopToggle('Stop on Big Win','≥ 25× total bet',State.autoplay.stopOnBigWin,'stopOnBigWin');
    }
  }

  // ── INFO MODAL (3-tab: Rules / Paytable / Info) ───────────────
  const infoModal = new PIXI.Container(); infoModal.visible = false; stage.addChild(infoModal);
  const infoBg = new PIXI.Graphics(); infoModal.addChild(infoBg); infoBg.eventMode='static';
  const infoCard = new PIXI.Container(); infoModal.addChild(infoCard);
  // Procedural dark+gold panel (matches new bar + drawer + buy modal)
  const infoCardBg = new PIXI.Graphics(); infoCard.addChild(infoCardBg);
  const infoTitle = new PIXI.Text({ text:'GAME INFORMATION', style:txtStyle(16, SURF.title) });
  infoTitle.anchor.set(0.5,0); infoCard.addChild(infoTitle);
  const infoBody = new PIXI.Container(); infoCard.addChild(infoBody);
  makeScrollable(infoBody, infoCard);   // P0-C: clip + scroll (paytable overflows on Popout S)
  let infoTab = 'rules';
  const infoCloseBtn = new PIXI.Container(); infoCloseBtn.eventMode='static'; infoCloseBtn.cursor='pointer';
  const infoCloseIcon = spr('icClose'); infoCloseBtn.addChild(infoCloseIcon); infoCard.addChild(infoCloseBtn);

  function showInfoModal(){ infoModal.visible = true; layoutInfoModal(); populateInfoTab(infoTab); modalIn(infoCard, infoBg); }
  function hideInfoModal(){
    if(!infoModal.visible) return;
    modalOut(infoCard, infoBg, () => { infoModal.visible = false; });
  }
  infoBg.on('pointertap', hideInfoModal);
  infoCloseBtn.on('pointertap', hideInfoModal);
  // Desktop wheel-scroll for whichever modal body is open (touch uses drag).
  window.addEventListener('wheel', e => {
    if(infoModal.visible && infoBody._wheel) infoBody._wheel(e.deltaY);
    else if(drawerLayer.visible && drawerBody._wheel) drawerBody._wheel(e.deltaY);
  }, { passive:true });

  function layoutInfoModal(){
    const W=app.screen.width, H=app.screen.height;
    infoBg.clear().rect(0,0,W,H).fill({ color:0x000000, alpha:0.92 });
    const cardW=Math.min(490,W*0.92), cardH=Math.min(560,H*0.88);
    // ── POPOUT-S P0 FIT — the CARD fits (200px) but the rules CONTENT needs
    // ~290px. Sizing fitScale against the content-need (not just card size)
    // shrinks the whole card uniformly so every rules line is visible. At
    // Popout S 400x225 this lands ~0.74 = card renders ~150px tall with all
    // 6 HOW-TO-PLAY rules legible.
    const cardContentNeed = 320;
    const _maxH = H - 16, _maxW = W - 16;
    const _fit  = Math.min(1, _maxH / cardContentNeed, _maxW / cardW);
    infoCard._fitScale = _fit;
    infoCard.scale.set(_fit);
    infoCard.position.set(W/2,H/2);
    // ── PREMIUM PANEL — unified gold crystal-glass chrome (shared studio
    // surface, same drawPanelChrome as every betting/control modal).
    drawSurfChrome(infoCardBg, cardW, cardH, { radius:18, titleDivAt:44 });
    infoTitle.position.set(0,-cardH/2+18);
    styleClose(infoCloseBtn, infoCloseIcon, cardW/2, cardH/2);   // unified close
    infoBody.position.set(-cardW/2+22,-cardH/2+54);
    infoBody._w = cardW-44; infoBody._h = cardH-72;
  }
  function populateInfoTab(tab){
    infoBody.removeChildren(); infoTab = tab;
    const w = infoBody._w || 400;
    ['rules','paytable','info'].forEach((t,i) => {
      const bw=w/3-4;
      const c=new PIXI.Container(); c.eventMode='static'; c.cursor='pointer';
      const bg=new PIXI.Graphics(); c.addChild(bg);
      const sel=t===tab;
      // Selected tab = gold pill, inactive = dark slate
      bg.roundRect(0,0,bw,24,6).fill(sel?SURF.accent:SURF.pillOff).stroke({ color:sel?SURF.accentHi:SURF.pillStroke, width:sel?2:1 });
      const txt=new PIXI.Text({ text:socialFilter(t==='paytable'?'PAYTABLE':t.toUpperCase()), style:{ fontFamily:'Fredoka', fontSize:10, fill:sel?0xf5f7fa:0xc9b0e6, fontWeight:'bold', letterSpacing:1 }});
      txt.anchor.set(0.5); txt.position.set(bw/2,12); c.addChild(txt);
      c.position.set(i*(bw+6),0);
      c.on('pointertap', () => populateInfoTab(t));
      infoBody.addChild(c);
    });
    let y=34;
    const line = (text,size,fill,bold) => {
      const t=new PIXI.Text({ text:socialFilter(text), style:{ fontFamily:'Fredoka', fontSize:size||11, fill:fill||0xe8dcc8,
        fontWeight:bold?'bold':'normal', wordWrap:true, wordWrapWidth:w, lineHeight:(size||11)*1.5 }});
      t.position.set(0,y); infoBody.addChild(t); y+=t.height+4; return t;
    };
    if(tab==='rules'){
      line('HOW TO PLAY',13,SURF.heading,true);
      line('1. Pick your bet with the + and − buttons\n2. Hit SPIN (or the Spacebar)\n3. Land 3 or more matching symbols on a line, starting from the left\n4. Land 3 or more STARs anywhere to win Free Spins\n5. In a hurry? BUY BONUS takes you straight to Free Spins',11);
      y+=6;
      line('GAME MECHANICS',13,SURF.heading,true);
      line('• 5 reels, 3 rows, 10 fixed lines\n• Lines pay left to right, starting on reel 1\n• The STAR is a scatter — it pays from anywhere, no line needed\n• In Free Spins, every line win is multiplied by ×'+FS_MULT+'\n• Land 3+ STARs in Free Spins to win +'+FS_RETRIGGER+' more spins\n• Every spin is separate and decided fairly by the game server',11);
      y+=8;
      const boxY=y;
      [['RTP',RTP_DISPLAY,SURF.win],['MAX WIN',ADVERTISED_MAX_X.toLocaleString('en-US')+'×',SURF.value],['VOL.','MED-HIGH',SURF.link]].forEach(([lbl,val,col],i) => {
        const bx=i*(w/3);
        const l=new PIXI.Text({ text:socialFilter(lbl), style:{ fontFamily:'Fredoka', fontSize:9, fill:0xc9b0e6, fontWeight:'bold', letterSpacing:1 }});
        l.anchor.set(0.5,0); l.position.set(bx+w/6,boxY); infoBody.addChild(l);
        const v=new PIXI.Text({ text:val, style:{ fontFamily:'Luckiest Guy', fontSize:16, fill:col }});
        v.anchor.set(0.5,0); v.position.set(bx+w/6,boxY+12); infoBody.addChild(v);
      });
      y=boxY+38;
      line('RTP is calculated over many plays. Individual sessions may vary.',9,0x9988aa);
    } else if(tab==='paytable'){
      line('SYMBOL PAYS — 3 / 4 / 5 of a kind',12,SURF.heading,true);
      line('Values shown × bet per line (total bet ÷ '+NLINES+').',9,0x9988aa);
      y+=4;
      for(let s=0;s<8;s++){
        const rowY=y, sz=22;
        const ic=new PIXI.Sprite(SYM_TEX[s]); ic.anchor.set(0,0.5);
        ic.scale.set(symScale(SYM_TEX[s], sz)); ic.position.set(0,rowY+12); infoBody.addChild(ic);
        const nm=new PIXI.Text({ text:SYM_NAME[s], style:{ fontFamily:'Fredoka', fontSize:11, fill:0xe8dcc8, fontWeight:'bold' }});
        nm.anchor.set(0,0.5); nm.position.set(sz+8,rowY+12); infoBody.addChild(nm);
        const pv=new PIXI.Text({ text:PAY[s][0]+'  /  '+PAY[s][1]+'  /  '+PAY[s][2], style:{ fontFamily:'Luckiest Guy', fontSize:12, fill:SURF.value, letterSpacing:1 }});
        pv.anchor.set(1,0.5); pv.position.set(w,rowY+11); infoBody.addChild(pv);
        y+=24;
      }
      y+=2;
      line('STAR SCATTER — pays × total bet',12,SURF.heading,true);
      const sic=new PIXI.Sprite(SYM_TEX[8]); sic.anchor.set(0,0.5);
      sic.scale.set(symScale(SYM_TEX[8], 26)); sic.position.set(0,y+12); infoBody.addChild(sic);
      const sv=new PIXI.Text({ text:'3★ = '+SCAT[3]+'×    4★ = '+SCAT[4]+'×    5★ = '+SCAT[5]+'×', style:{ fontFamily:'Luckiest Guy', fontSize:12, fill:SURF.value, letterSpacing:1 }});
      sv.anchor.set(0,0.5); sv.position.set(34,y+12); infoBody.addChild(sv);
      y+=34;
      line('3 / 4 / 5 scatters also award '+FS_AWARD[3]+' / '+FS_AWARD[4]+' / '+FS_AWARD[5]+' Free Spins.',10,0xc9b0e6);   // P1-M: derive from FS_AWARD (was hard-coded 10/15/20; actual award is 10/12/15)
      y+=8;
      line('10 PAYLINES — wins pay left → right from reel 1',11,SURF.heading,true);
      y+=4;
      // payline map — all 10 win lines drawn on a mini 5×3 grid
      const plg=new PIXI.Graphics();
      const plW=Math.min(w*0.8,224), plCw=plW/REELS, plCh=plCw*0.5, plX0=(w-plW)/2;
      for(let pr=0;pr<REELS;pr++) for(let pc=0;pc<ROWS;pc++)
        plg.roundRect(plX0+pr*plCw+1.5,y+pc*plCh+1.5,plCw-3,plCh-3,3)
          .fill({ color:0x2a0712, alpha:0.85 }).stroke({ color:0x5a3a50, width:1 });
      for(let li=0;li<NLINES;li++){
        const pat=LINES[li], pcol=LINE_COLORS[li%LINE_COLORS.length], pts=[];
        for(let pr=0;pr<REELS;pr++) pts.push(plX0+pr*plCw+plCw/2, y+pat[pr]*plCh+plCh/2);
        plg.poly(pts,false).stroke({ color:pcol, width:2.3, alpha:0.92 });
      }
      infoBody.addChild(plg);
      y+=ROWS*plCh+6;
    } else {
      line('CONTROLS',13,SURF.heading,true);
      line('SPIN — start a round\n+ / − — change your bet\nBUY BONUS — pay to go straight to Free Spins\nAUTO — spin automatically (10/25/50/100/250 times)\nTURBO — speed up the reels\nSOUND — turn audio on or off',11);
      y+=6;
      line('KEYBOARD',13,SURF.heading,true);
      line('Space — Spin / quick-stop\n↑/↓ — Adjust bet\nF — Fullscreen\nM — Mute',11);
      y+=10;
      line('DISCLAIMER',12,SURF.heading,true);
      line('Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays (theoretical RTP '+RTP_DISPLAY+'; maximum win capped at '+ADVERTISED_MAX_X.toLocaleString('en-US')+'× the total bet). The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.',9,0x9988aa);
      y+=6;
      // ── CLICKABLE RG LINK (2026-05-30, Task #4 / Stake approval blocker) ──
      // Cyan + pointer cursor signals affordance; opens BeGambleAware in a new
      // tab (navigation, not a loaded resource — XSS-policy safe).
      const rgLink = line('BeGambleAware.org · 1-800-GAMBLER',10,0x65d4f0,true);
      rgLink.eventMode='static'; rgLink.cursor='pointer';
      rgLink.on('pointertap',()=>{ try{ window.open('https://www.begambleaware.org','_blank','noopener'); }catch(e){} });
    }
    infoBody._refreshScroll && infoBody._refreshScroll();   // P0-C: clip + enable scroll for this tab's content
  }

  // ── REALITY CHECK MODAL — VILLAIN AESTHETIC (Cyber-Villain) ──
  // Rebuilt per UX brief: matches main HUD typography, neon-magenta
  // border, smoke-white values, defined hitAreas, blocks main game
  // input via the bg's eventMode while modal is visible. The whole
  // modal sits at TOP z-index via stage.addChild on show().
  const rcModal = new PIXI.Container(); rcModal.visible = false; stage.addChild(rcModal);
  const rcBg = new PIXI.Graphics(); rcModal.addChild(rcBg); rcBg.eventMode='static';
  const rcCard = new PIXI.Container(); rcModal.addChild(rcCard);
  const rcCardBg = new PIXI.Graphics(); rcCard.addChild(rcCardBg);
  // Title — Luckiest Guy (same family as HUD values), neon magenta
  const rcTitle = new PIXI.Text({ text:'REALITY CHECK', resolution:3, style:{
    fontFamily:'Luckiest Guy', fontSize:20, fill:SURF.title, letterSpacing:2,
    stroke:{ color:0x0a0a0e, width:2, join:'round' },
  }});
  rcTitle.anchor.set(0.5,0); rcCard.addChild(rcTitle);
  const rcDesc = new PIXI.Text({ text:"You've been playing for a while.\nTake a moment to review your session.", style:{
    fontFamily:'Fredoka', fontSize:12, fill:0xf5f7fa, align:'center',
    wordWrap:true, wordWrapWidth:260, fontWeight:'500',
  }});
  rcDesc.anchor.set(0.5,0); rcCard.addChild(rcDesc);
  const rcStats = new PIXI.Container(); rcCard.addChild(rcStats);
  const rcFooter = new PIXI.Text({ text:'If gambling stops being fun, take a break.\nBeGambleAware.org · 1-800-GAMBLER', style:{
    fontFamily:'Fredoka', fontSize:9, fill:0x9988aa, align:'center', wordWrap:true, wordWrapWidth:260,
  }});
  rcFooter.anchor.set(0.5,0); rcCard.addChild(rcFooter);
  // Reality-check RG link clickable too (Task #4 / approval blocker)
  rcFooter.eventMode='static'; rcFooter.cursor='pointer';
  rcFooter.on('pointertap',()=>{ try{ window.open('https://www.begambleaware.org','_blank','noopener'); }catch(e){} });
  // 2-color villain buttons — STOP = dark slate w/ pink stroke,
  // CONTINUE = solid neon magenta w/ smoke-white text. Same height/width.
  const rcBtnStop = makeModalBtn(rcCard,'STOP',0x1f1c2e,0xf5f7fa);
  const rcBtnContinue = makeModalBtn(rcCard,'CONTINUE',0xff007f,0xf5f7fa);

  function showRealityCheck(){
    State.phase = Phase.REALITY_CHECK;
    rcModal.visible = true;
    // Z-order: bring to top of stage so nothing draws over it
    stage.addChild(rcModal);
    const W=app.screen.width, H=app.screen.height;
    // 0.7-opacity dark overlay (per brief — was 0.92, too opaque)
    rcBg.clear().rect(0,0,W,H).fill({ color:0x0a0a0e, alpha:0.78 });
    const cardW=Math.min(360,W*0.84), cardH=336;
    // ── RESP-01 — Reality Check fitScale (P0 Popout-S). cardH=336 > viewport
    // H=225, so without this CONTINUE/STOP land at Y=250.5px - completely
    // unreachable. Mirrors the proven layoutBuyModal / layoutInfoModal pattern.
    const _rcMaxH = H - 12, _rcMaxW = W - 16;
    const _rcFit  = Math.min(1, _rcMaxH / cardH, _rcMaxW / cardW);
    rcCard._fitScale = _rcFit;
    rcCard.scale.set(_rcFit);
    rcCard.position.set(W/2,H/2);
    // ── VILLAIN PANEL — neon-magenta border + obsidian fill + glow halo
    // Unified vibrant crystal-glass chrome (same drawPanelChrome as every modal)
    drawSurfChrome(rcCardBg, cardW, cardH, { radius:16, titleDivAt:0 });
    rcTitle.position.set(0,-cardH/2+18);
    rcDesc.position.set(0,-cardH/2+50);
    rcStats.removeChildren();
    const elapsed=Math.floor((Date.now()-State.sessionStartedAt)/60000);
    const net=State.stats.totalWon-State.stats.totalBet;
    const data=[['Time',elapsed+' min'],['Spins',State.spinsSinceCheck.toString()],
      [socialFilter('Bet'),fmtMoney(State.stats.totalBet)],['Net',(net>=0?'+':'')+fmtMoney(net)]];
    data.forEach(([lbl,val],i) => {
      const bx=-cardW/2+20+i*(cardW-40)/4;
      // label: cool-purple-grey (same as drawer labels), pink-soft for emphasis labels
      const l=new PIXI.Text({ text:lbl, style:{
        fontFamily:'Fredoka', fontSize:10, fill:SURF.heading, fontWeight:'700', letterSpacing:1.2,
      }});
      l.anchor.set(0.5,0); l.position.set(bx+(cardW-40)/8,0); rcStats.addChild(l);
      // value: SMOKE-WHITE in Luckiest Guy — matches BAL / BET in main HUD
      const v=new PIXI.Text({ text:val, style:{
        fontFamily:'Luckiest Guy', fontSize:14, fill:0xf5f7fa,
        stroke:{ color:0x0a0a0e, width:1.4, join:'round' },
      }});
      v.anchor.set(0.5,0); v.position.set(bx+(cardW-40)/8,14); rcStats.addChild(v);
    });
    rcStats.position.set(0,-cardH/2+100);
    rcFooter.position.set(0,-cardH/2+148);
    // ── BUTTONS — IDENTICAL width/height, same horizontal axis,
    // explicit hitAreas (per brief: "Stop and Continue buttons must be
    // perfectly aligned on the horizontal axis with clear bounding boxes")
    const btnW=cardW*0.38, btnH=44, btnY=cardH/2-30;
    const btnGap = 14;
    // STOP — dark slate + gold stroke (subordinate visual weight)
    drawGlossyBtn(rcBtnStop._bg, btnW, btnH, 'secondary');
    rcBtnStop.hitArea = new PIXI.Rectangle(-btnW/2, -btnH/2, btnW, btnH);
    rcBtnStop.position.set(-(btnW+btnGap)/2, btnY);
    rcBtnStop._t.style.fontFamily = 'Luckiest Guy';
    rcBtnStop._t.style.fontSize = 15;
    rcBtnStop._t.style.fill = 0xf5f7fa;
    rcBtnStop._t.style.letterSpacing = 1.2;
    // CONTINUE — solid gold (primary action, dominant weight)
    drawGlossyBtn(rcBtnContinue._bg, btnW, btnH, 'primary');
    rcBtnContinue.hitArea = new PIXI.Rectangle(-btnW/2, -btnH/2, btnW, btnH);
    rcBtnContinue.position.set((btnW+btnGap)/2, btnY);
    rcBtnContinue._t.style.fontFamily = 'Luckiest Guy';
    rcBtnContinue._t.style.fontSize = 15;
    rcBtnContinue._t.style.fill = 0xf5f7fa;
    rcBtnContinue._t.style.letterSpacing = 1.2;
    modalIn(rcCard, rcBg);
  }
  rcBtnContinue.on('pointertap', () => {
    State.phase=Phase.IDLE;
    State.spinsSinceCheck=0; State.sessionStartedAt=Date.now();
    modalOut(rcCard, rcBg, () => { rcModal.visible=false; });
    // Resume autoplay if a Reality Check interrupted it — otherwise the HUD shows
    // a 'running' autoplay count with a number but nothing spins (zombie autoplay).
    // autoplayNext() self-guards on remaining<=0 / balance / phase, so this is safe.
    if(State.autoplay.active) autoplayNext();
  });
  rcBtnStop.on('pointertap', () => {
    State.phase=Phase.IDLE; State.autoplay.active=false;
    modalOut(rcCard, rcBg, () => { rcModal.visible=false; });
  });
  // Resize listener — re-center the modal if open during viewport change
  window.addEventListener('resize', () => {
    if(rcModal.visible) showRealityCheck();
  });

  // ── CONNECTION ERROR OVERLAY ──────────────────────────────────
  const errModal = new PIXI.Container(); errModal.visible = false; stage.addChild(errModal);
  const errBg = new PIXI.Graphics(); errModal.addChild(errBg); errBg.eventMode='static';
  const errCard = new PIXI.Container(); errModal.addChild(errCard);
  // Procedural dark+gold panel — error keeps loss-red title accent
  const errCardBg = new PIXI.Graphics(); errCard.addChild(errCardBg);
  const errTitle = new PIXI.Text({ text:'CONNECTION ERROR', style:txtStyle(16, THEME.colors.loss) });
  errTitle.anchor.set(0.5,0); errCard.addChild(errTitle);
  const errMsg = new PIXI.Text({ text:'', style:{ fontFamily:'Fredoka', fontSize:12, fill:THEME.colors.text, align:'center', wordWrap:true, wordWrapWidth:260 }});
  errMsg.anchor.set(0.5,0); errCard.addChild(errMsg);
  // Error CTA = brand PINK + smoke-white text (NOT gold). Gold reads as a
  // celebration/positive action and clashed with the red error accent; pink
  // matches the villain-neon modal convention (primary = pink, see bet menu).
  const errRetry = makeModalBtn(errCard,'RETRY', THEME.colors.pink, THEME.colors.text);
  function showError(title,msg,fatal){
    errModal.visible=true;
    errModal._fatal = (fatal !== false);   // default true → RETRY/reload (back-compat for other callers)
    const W=app.screen.width, H=app.screen.height;
    errBg.clear().rect(0,0,W,H).fill({ color:0x000000, alpha:0.94 });
    const cardW=Math.min(340,W*0.84), cardH=210;
    // RESP-22 — Error modal fitScale. cardH=210 bleeds into Popout S 225 bottom
    // edge (panel ends at 217.5, button hits safe-area). Scale down on tiny.
    const _eMaxH = H - 16, _eMaxW = W - 16;
    const _eFit  = Math.min(1, _eMaxH / cardH, _eMaxW / cardW);
    errCard._fitScale = _eFit;
    errCard.scale.set(_eFit);
    errCard.position.set(W/2,H/2);
    // Unified villain-console chrome (shared drawPanelChrome) with a loss-red
    // accent so the error popup matches every other popup's premium look while
    // still signalling severity via its border/bracket/glow color.
    drawPanelChrome(errCardBg, cardW, cardH, { accent:THEME.colors.loss, radius:16, titleDivAt:44 });
    errTitle.text=title; errTitle.position.set(0,-cardH/2+18);
    errMsg.text=msg; errMsg.position.set(0,-cardH/2+50);
    const btnW=cardW*0.42, btnH=44;   // RESP-23 — was 42 (below WCAG 44px floor)
    drawGlossyBtn(errRetry._bg, btnW, btnH, 'primary');   // (was a near-black wine body — now the canonical glossy magenta)
    errRetry.position.set(0,cardH/2-32);
    errRetry._t.text = errModal._fatal ? 'RETRY' : 'CLOSE';
    modalIn(errCard, errBg);
  }
  errRetry.on('pointertap', () => {
    errModal.visible = false;
    if(errModal._fatal){ location.reload(); return; }
    // Recoverable — return to a clean IDLE so the session + balance survive.
    _spinLock = false;
    if(typeof stopAutoplay === 'function') stopAutoplay();
    State.phase = Phase.IDLE;
    try { updateHUD(); } catch(e){}
  });
  // GLOBAL SAFETY NET — Stake requires a SILENT console for approval. Swallow any
  // stray unhandled promise rejection in production (a missed await in a VFX/audio
  // path must never print a console error); keep it visible under ?debug for devs.
  window.addEventListener('unhandledrejection', (e) => {
    if(!/[?&]debug=/.test(location.search)) e.preventDefault();
  });

  // ── RGS ERROR ROUTER (P0-D) ───────────────────────────────────────────
  // Branch on the RGS error code instead of nuking the whole session with a
  // page reload for every failure. Recoverable codes (insufficient balance,
  // bet desync) get a dismissible CLOSE that returns to a clean IDLE so the
  // session continues; only fatal codes (geo-block, maintenance, transport)
  // keep RETRY→reload. Autoplay is always stopped so we never auto-spin into a
  // repeating error.
  const RGS_RECOVERABLE = { ERR_IPB:1, ERR_VAL:1, ERR_IS:1, ERR_ATE:1, ERR_GLE:1 };
  const RGS_ERR_MSG = {
    ERR_IPB:'Insufficient balance for this bet. Lower your stake to continue.',
    ERR_VAL:'That bet could not be validated. Please try again.',
    ERR_IS:'Bet is outside the allowed limits. Adjust your stake.',
    ERR_ATE:'Autoplay was stopped by a limit rule.',
    ERR_GLE:'Bet limit reached. Adjust your stake to continue.',
    ERR_LOC:'This game is not available in your location.',
    ERR_MAINTENANCE:'The game is briefly under maintenance. Please retry shortly.',
  };
  function routeRgsError(err){
    const code = (err && err.code) || 'ERR_GEN';
    if(typeof stopAutoplay === 'function') stopAutoplay();
    const recoverable = !!RGS_RECOVERABLE[code];
    const title = code==='ERR_IPB' ? 'INSUFFICIENT BALANCE'
                : code==='ERR_MAINTENANCE' ? 'UNDER MAINTENANCE'
                : code==='ERR_LOC' ? 'UNAVAILABLE'
                : recoverable ? 'BET NOT ACCEPTED' : 'CONNECTION ERROR';
    const msg = RGS_ERR_MSG[code] || (err && err.message ? String(err.message).slice(0,120) : 'Could not reach the game server.');
    if(recoverable){ State.phase = Phase.IDLE; try { updateHUD(); } catch(e){} }
    showError(socialFilter(title), socialFilter(msg), !recoverable);   // social-safe popup (gate S2)
  }

  // ── REPLAY OVERLAY ────────────────────────────────────────────
  const replayBar = new PIXI.Container(); replayBar.visible = false; stage.addChild(replayBar);
  const rbBg = new PIXI.Graphics(); replayBar.addChild(rbBg);
  // 2-color: replay text in smoke-white, PLAY AGAIN in PINK
  const rbText = new PIXI.Text({ text:'', style:{ fontFamily:'Fredoka', fontSize:11, fill:0xf5f7fa, align:'center', wordWrap:true, wordWrapWidth:520 }});
  rbText.anchor.set(0.5); replayBar.addChild(rbText);
  const rbDisclosure = new PIXI.Container(); replayBar.addChild(rbDisclosure);
  const rbAgain = makeModalBtn(replayBar,'PLAY AGAIN',0xff5a9c,0xf5f7fa);

  // ── INTRO OVERLAY — Waylanders-style "PRESS TO CONTINUE!" splash ──
  // Shown after loader hides, before the first round can play. Tap-to-dismiss
  // fades the overlay out and runs any deferred resume / replay logic. The
  // overlay sits ABOVE every modal so it's the first thing the player sees.
  const introOverlay = new PIXI.Container();
  introOverlay.visible = false;
  introOverlay.eventMode = 'static';
  introOverlay.cursor = 'pointer';
  stage.addChild(introOverlay);

  const introBg = new PIXI.Graphics(); introOverlay.addChild(introBg);
  const introVignette = new PIXI.Graphics(); introOverlay.addChild(introVignette);

  const introLogo = spr('logo');
  introLogo.eventMode = 'none';
  introOverlay.addChild(introLogo);

  // 3 feature cards: BONUS TYPES / MAX WIN / SYMBOLS — Waylanders pattern
  const introFeatures = new PIXI.Container();
  introFeatures.eventMode = 'none';
  introOverlay.addChild(introFeatures);

  // ── INTRO FEATURE CARDS — studio-tier glassmorphic premium aesthetic
  // 4 layers per card (plate base / shine sweep / icon plate / icon),
  // larger fonts, brighter accents. Each card gets a unique accent color
  // and a subtle diagonal shine sweep that loops in the render loop.
  // ── REUSABLE CRYSTAL KIT (gold-crystal design system, 2026-06-01) ─────────
  // The shared faceted-glass language for the intro AND — incrementally — every
  // modal / popup / tooltip. octPts = emerald-cut octagon (chamfered rect) point
  // list with optional pixel offset (used to fake chromatic dispersion by drawing
  // the same edge in R/G/B at tiny offsets). drawCrystalPanel = one faceted gem.
  function octPts(hw, hh, c, dx, dy){
    dx = dx||0; dy = dy||0;
    return [
      -hw+c+dx, -hh+dy,   hw-c+dx, -hh+dy,
       hw+dx,  -hh+c+dy,   hw+dx,   hh-c+dy,
       hw-c+dx, hh+dy,    -hw+c+dx,  hh+dy,
      -hw+dx,   hh-c+dy,  -hw+dx,  -hh+c+dy,
    ];
  }
  function drawCrystalPanel(g, w, h, accent, hero){
    const hw = w/2, hh = h/2;
    const c = Math.min(w*0.30, h*0.16);   // emerald-cut chamfer
    // ── CLEAN PREMIUM PANEL (villain magenta, 2026-06-01). Same emerald-cut
    // silhouette, RESTRAINED: deep glass body, ONE crisp magenta hairline (accent),
    // a soft top sheen + cool gloss line. No gold, no chromatic RGB noise, no busy
    // internal facet clutter — modern / Stake-Originals reads as restraint.
    g.clear()
      // soft single floating shadow
      .poly(octPts(hw, hh + 2, c)).fill({ color: 0x000000, alpha: 0.26 })
      // deep clean glass body (painted bg shows faintly through)
      .poly(octPts(hw, hh, c)).fill({ color: 0x12111c, alpha: hero ? 0.80 : 0.84 })
      // glossy upper sheen — stronger glass dome (was 0.045, read flat/dull)
      .poly(octPts(hw * 0.88, hh * 0.50, c * 0.7, 0, -hh * 0.30)).fill({ color: 0xffffff, alpha: 0.10 })
      // ONE crisp magenta hairline edge — the ONLY border (removed the faint inner
      // contour that doubled the edge into "bad lines"). 2026-06-01.
      .poly(octPts(hw, hh, c)).stroke({ color: accent, width: 1.4, alpha: hero ? 0.92 : 0.7 })
      // bright crystal top gloss stripe (the glossy signature)
      .moveTo(-hw + c + 5, -hh + 2.5).lineTo(hw - c - 5, -hh + 2.5).stroke({ color: 0xffe6f4, width: 1.4, alpha: 0.60 })
      // soft secondary gloss just beneath (reads as glass thickness)
      .moveTo(-hw + c + 9, -hh + 5).lineTo(hw - c - 9, -hh + 5).stroke({ color: 0xffffff, width: 0.8, alpha: 0.18 });
  }

  function makeIntroCard(texKey, value, label, subtext, accent){
    const card = new PIXI.Container();
    card._plate = new PIXI.Graphics(); card.addChild(card._plate);
    // Animated diagonal shine sweep (UI verse signature) — drawn each frame
    card._shine = new PIXI.Graphics();
    card._shine.blendMode = 'add';
    card.addChild(card._shine);
    // Additive FX layer — value bloom / energy surge (drawn in drawIntroVfx)
    card._fx = new PIXI.Graphics();
    card._fx.blendMode = 'add';
    card.addChild(card._fx);
    card._iconBg = new PIXI.Graphics(); card.addChild(card._iconBg);
    card._icon = new PIXI.Sprite(TEX[texKey]); card._icon.anchor.set(0.5); card.addChild(card._icon);
    // Bigger value text (h1 → 32) with gold stroke for legibility
    card._value = new PIXI.Text({ text:value, style:{
      fontFamily:THEME.type.familyDisplay, fontSize:30,
      fill:0xffffff, align:'center', letterSpacing:0.5,
      stroke:{ color:0x220617, width:3, join:'round' },
    }});
    card._value.anchor.set(0.5); card.addChild(card._value);
    // Label: bigger uppercase with letter-spacing — accent gold (was muted gray)
    card._label = new PIXI.Text({ text:label, style:{
      fontFamily:THEME.type.family, fontSize:11,
      fill:accent, align:'center', letterSpacing:2.2, fontWeight:'700',
    }});
    card._label.anchor.set(0.5); card.addChild(card._label);
    // NEW — descriptor subtext (small line below label)
    card._subtext = new PIXI.Text({ text:subtext || '', style:{
      fontFamily:THEME.type.family, fontSize:9,
      fill:THEME.colors.textMuted, align:'center', letterSpacing:0.6,
      wordWrap:true, wordWrapWidth:160,
    }});
    card._subtext.anchor.set(0.5, 0); card.addChild(card._subtext);
    card._accent = accent;
    card._shinePhase = vrnd() * Math.PI * 2;   // desync per card
    return card;
  }
  // MAGENTA-VILLAIN hero system (2026-06-01). The intro matches the gameplay
  // palette: black / dark / neon-magenta. Center card (MAX WIN) is the brightest
  // hero with the strongest bloom + ruby pulse.
  //  • NEON MAGENTA   for BONUS TYPES
  //  • BRIGHT MAGENTA for MAX WIN  (hero — bloom + ruby heart)
  //  • VIOLET-MAGENTA for UNIQUE SYMBOLS (subtle variety, same villain family)
  const introCard1 = makeIntroCard('s7', '3', 'BONUS TYPES',
    'Standard · Hot · Mega', 0xff007f);
  const introCard2 = makeIntroCard('s8', '5,000×', 'MAX WIN',
    socialFilter('Total bet multiplier'), 0xff5ab0);
  const introCard3 = makeIntroCard('s0', '9', 'UNIQUE SYMBOLS',
    'Fruit · Bell · 7 · Crown', 0xc04bd6);
  introFeatures.addChild(introCard1, introCard2, introCard3);

  // Premium CTA — gold-stroked pill background + bright text + breathing
  // glow (managed in the render loop)
  const introCtaBg = new PIXI.Graphics();
  introOverlay.addChild(introCtaBg);
  const introCta = new PIXI.Text({ text:'TAP TO START', style:{
    fontFamily:THEME.type.familyDisplay, fontSize:22,
    fill:THEME.colors.text, align:'center', letterSpacing:3.5,
    stroke:{ color:0x2a0a1e, width:3, join:'round' },
  }});
  introCta.anchor.set(0.5);
  introOverlay.addChild(introCta);

  // ── CINEMATIC INTRO VFX (gold-crystal AAA overhaul, 2026-06-01) ─────────
  // Self-contained additive layers + a dedicated rAF so the cosmic dust,
  // god-rays, logo sparkle, CTA bloom and per-card energy run at the panel's
  // own cadence without touching the main render loop. All procedural
  // (no GLSL — custom filters flood Stake's console), seeded (no Math.random).
  const introAddBack  = new PIXI.Graphics(); introAddBack.blendMode  = 'add'; introAddBack.eventMode = 'none';
  const introAddFront = new PIXI.Graphics(); introAddFront.blendMode = 'add'; introAddFront.eventMode = 'none';
  introOverlay.addChildAt(introAddBack,  introOverlay.getChildIndex(introBg) + 1);      // above base, behind logo/cards
  introOverlay.addChildAt(introAddFront, introOverlay.getChildIndex(introCtaBg) + 1);   // above cards, below CTA text
  // Seeded cosmic-dust field — positions / size / speed / twinkle fixed once.
  const introDust = [];
  for(let i=0;i<30;i++) introDust.push({
    x:vrnd(), y:vrnd(), r:0.5+vrnd()*2.4, sp:0.15+vrnd()*0.7,
    tw:0.0010+vrnd()*0.0030, ph:vrnd()*Math.PI*2, big:vrnd()<0.22,
  });
  function _introSparkle(g, x, y, s, a){
    g.poly([x,y-s, x+s*0.18,y-s*0.18, x+s,y, x+s*0.18,y+s*0.18,
            x,y+s, x-s*0.18,y+s*0.18, x-s,y, x-s*0.18,y-s*0.18]).fill({ color:0xffd9ec, alpha:a });
    g.circle(x,y,s*0.22).fill({ color:0xffffff, alpha:a });
  }
  function drawIntroVfx(now){
    if(!introOverlay.visible) return;
    const W = app.screen.width, H = app.screen.height;
    const reduced = isReduced();
    const t = now*0.001;
    const lx = introLogo.x, ly = (introLogo._baseY!=null ? introLogo._baseY : H*0.22);

    // ── BACK: volumetric god-rays behind the logo + drifting cosmic dust
    introAddBack.clear();
    // CLEAN god-rays — fewer + softer (premium restraint, not a busy fan)
    const rayR = Math.min(W,H)*0.34;   // shorter — rays HALO the logo, never fan down across the cards (the "bad lines" the user saw). 2026-06-01.
    const rays = reduced ? 5 : 9;
    for(let i=0;i<rays;i++){
      const a  = (i/rays)*Math.PI*2 + (reduced?0:t*0.05);
      const sw = 0.04 + 0.02*Math.sin(t*0.5 + i);
      const al = reduced ? 0.03 : 0.035 + 0.03*(0.5+0.5*Math.sin(t*0.8 + i*1.7));
      introAddBack.poly([
        lx, ly,
        lx+Math.cos(a-sw)*rayR, ly+Math.sin(a-sw)*rayR,
        lx+Math.cos(a+sw)*rayR, ly+Math.sin(a+sw)*rayR,
      ]).fill({ color:0xff4d9e, alpha:al });
    }
    for(let i=0;i<introDust.length;i++){
      const d = introDust[i];
      const yy = reduced ? d.y : (((d.y - t*0.02*d.sp) % 1) + 1) % 1;
      const px = d.x*W, py = yy*H;
      const tw = reduced ? 0.5 : (0.35 + 0.65*(0.5+0.5*Math.sin(now*d.tw + d.ph)));
      introAddBack.circle(px, py, d.r).fill({ color: d.big?0xffb3e0:0xff007f, alpha: 0.10+0.30*tw });
      if(d.big) introAddBack.circle(px, py, d.r*2.4).fill({ color:0xff007f, alpha:0.05*tw });
    }

    // ── per-card energy surge + value bloom + gentle float
    [introCard1, introCard2, introCard3].forEach((card, i) => {
      if(card._baseY==null) return;
      const hero = (i===1);
      if(!reduced) card.y = card._baseY + Math.sin(t*1.1 + i*1.7)*(hero?5:3.4);
      if(!card._fx) return;
      const cw = card._cw||160, ch = card._ch||260;
      const pulse = 0.5+0.5*Math.sin(now*(hero?0.0045:0.0035) + i);
      card._fx.clear();
      const by = ch*0.10, bw = cw*(hero?0.62:0.5);
      card._fx.ellipse(0, by, bw, bw*0.42).fill({ color: hero?0xff5ab0:0xff007f, alpha:(hero?0.16:0.08)*(0.6+0.4*pulse) });
      if(hero){
        // ruby crystal heart pulsing under the 5,000× value
        card._fx.circle(0, by, cw*0.12*(0.9+0.2*pulse)).fill({ color:0xff5a7a, alpha:0.12*(0.5+0.5*pulse) });
      }
      // energy aura ringing the jewel well (crown-panel surge)
      const iy = -ch*0.27, ir = cw*0.34*(1.0+0.06*pulse);
      card._fx.circle(0, iy, ir).stroke({ color:0xff6ab0, width:1.4, alpha:(hero?0.30:0.18)*pulse });
    });

    // ── FRONT: logo sparkle glints + CTA breathing bloom
    introAddFront.clear();
    if(!reduced){
      const lw = introLogo.width, lh = introLogo.height;
      const glints = [[-0.30,-0.18,0.0],[0.26,-0.05,1.6],[0.04,0.16,3.1],[-0.16,0.10,4.4]];
      for(const g of glints){
        const tw = 0.5+0.5*Math.sin(now*0.006 + g[2]*2.2);
        _introSparkle(introAddFront, lx + g[0]*lw*0.5, ly + g[1]*lh*0.5, 2.5 + 5.5*tw, 0.25 + 0.55*tw);
      }
    }
    // ── BEAT 3 · LOGO SHINE SWEEP — a single slim diagonal highlight travels
    // left→right across the wordmark, driven by the GSAP tween on _shine in
    // showIntroOverlay (gsap-timeline skill). Additive over the logo so it reads
    // as a specular glint; alpha eases in/out at the travel ends (no hard pop).
    const _sh = introOverlay._shine;
    if(!reduced && _sh >= 0 && _sh <= 1){
      const lw2 = introLogo.width, lh2 = introLogo.height;
      const sx = lx + (_sh - 0.5) * lw2 * 1.25;           // sweep position
      const hw = Math.max(8, lw2 * 0.05), hh = lh2 * 0.6, dx = hh * 0.36;  // slim slanted band
      const sa = 0.42 * Math.sin(_sh * Math.PI);          // 0 at ends, peak mid-sweep
      introAddFront.poly([
        sx - hw + dx, ly - hh,   sx + hw + dx, ly - hh,
        sx + hw - dx, ly + hh,   sx - hw - dx, ly + hh,
      ]).fill({ color: 0xffffff, alpha: sa });
    }
    if(introCta._bgRect){
      const r = introCta._bgRect;
      const cp = 0.5+0.5*Math.sin(now*0.004);
      introAddFront.roundRect(r.x-6, r.y-6, r.w+12, r.h+12, r.r+6).fill({ color:0xff007f, alpha:0.05+0.07*cp });
      introAddFront.roundRect(r.x-2, r.y-2, r.w+4,  r.h+4,  r.r+2).fill({ color:0xff5ab0, alpha:0.05+0.08*cp });
    }
  }
  function startIntroVfx(){
    if(isReduced()){ try { drawIntroVfx(performance.now()); } catch(e){} return; }   // static frame, no loop
    if(introOverlay._vfxRAF) return;
    const tick = () => {
      if(!introOverlay.visible){ introOverlay._vfxRAF = 0; return; }
      try { drawIntroVfx(performance.now()); } catch(e){}
      introOverlay._vfxRAF = requestAnimationFrame(tick);
    };
    introOverlay._vfxRAF = requestAnimationFrame(tick);
  }

  introOverlay._vfxRAF = 0;
  introOverlay._onDismiss = null;
  introOverlay._dismissing = false;
  introOverlay._fadeIn = 0;
  introOverlay._fadeStart = 0;
  introOverlay._shine = -1;        // Beat 3 — logo shine-sweep phase (-1 = idle, 0..1 = sweeping)
  introOverlay._irisActive = false; // Beat 4 — GSAP iris-wipe owns the dismiss anim when true
  introOverlay._iris = null;        // lazily-built iris mask Graphics
  introOverlay.on('pointertap', () => {
    if(introOverlay._dismissing) return;
    // 350ms grace at boot — stray "pointertap" can be synthesised by the
    // browser when the page first becomes interactive (esp. via WebDriver /
    // preview harnesses). The player needs at least one visible frame.
    if(performance.now() - (introOverlay._shownAt||0) < 350) return;
    irisDismissIntro();       // Beat 4 — cinematic iris-wipe reveal (GSAP)
    try {
      Sound.resume();         // iOS requires user gesture to start AudioContext
      Sound.click();
      // Start the ambient idle bed loop — the "expensive ambient pad" that
      // lifts the game from prototype-sound to AAA the moment the player
      // taps to dismiss the intro. Loops continuously between rounds.
      Sound.startIdleMusic();
    } catch(e){}
    // ── 10-PAYLINES WELCOME PREVIEW (restored from commit d917f07)
    // Auto-fires 700 ms after the intro fades so the player learns
    // the game's 10 paylines before their first spin. 2.2 s sweep.
    setTimeout(() => {
      try { if(typeof showLinesPreview === 'function') showLinesPreview(); } catch(e){}  /* auto payline-preview RE-ENABLED 2026-05-31 (user: "show all win-line combinations in the intro + on reel tap like the old version"). The sweep is the polished sequential draw-on (drawLinesPreviewFrame), not the old static all-at-once flash. */
    }, 700);
  });

  function layoutIntroOverlay(){
    if(!introOverlay.visible) return;
    const W = app.screen.width, H = app.screen.height;
    const portrait = H > W*1.05;
    const tiny = H < 330;

    // ── MINIMALIST INTRO BACKDROP (user feedback: rays + ellipses
    // looked busy / "sheet"). Now: clean deep base + ONE single subtle
    // soft glow circle behind the logo. AAA = restraint, not clutter.
    introBg.clear()
      // CLEAN backdrop — a LIGHTER dark wash so the real painted cathedral bg
      // shows through (premium real art, not a flat black sheet) + ONE subtle
      // warm halo behind the logo. No busy nebula clutter.
      .rect(0,0,W,H).fill({ color:0x0a0710, alpha:0.78 })
      .circle(W*0.5, H*0.24, Math.min(W,H)*0.30).fill({ color:0xff007f, alpha:0.09 })
      .circle(W*0.5, H*0.23, Math.min(W,H)*0.15).fill({ color:0xff5ab0, alpha:0.07 });

    // Vignette — soft inset darkening only, NO rays. Cleaner aesthetic.
    introVignette.clear();
    for(let i=1;i<=5;i++){
      const inset = Math.min(W,H) * 0.04 * i;
      introVignette.rect(0,0,W,inset).fill({ color:0x000000, alpha:0.07 });
      introVignette.rect(0,H-inset,W,inset).fill({ color:0x000000, alpha:0.07 });
      introVignette.rect(0,0,inset,H).fill({ color:0x000000, alpha:0.05 });
      introVignette.rect(W-inset,0,inset,H).fill({ color:0x000000, alpha:0.05 });
    }

    // Logo RAISED + slightly smaller so it clears the feature cards (was
    // overlapping the card tops — "POP" bled into them). 2026-06-01.
    const logoMaxW = portrait ? W*0.82 : Math.min(W*0.56, 520);
    const logoMaxH = H * (tiny ? 0.19 : 0.235);
    const lk = Math.min(logoMaxW / introLogo.texture.width,
                        logoMaxH / introLogo.texture.height);
    introLogo.scale.set(lk);
    introLogo.position.set(W/2, H * (tiny ? 0.155 : 0.18));
    introLogo._baseY = introLogo.y;

    // ── STUDIO-TIER FEATURE CARDS — 21st.dev glassmorphic premium
    // BIGGER cards (was 0.18 W → 0.20 W), TALLER ratio (was 1.42 → 1.65)
    // for more dramatic portrait proportions. Each card has 11 visual
    // layers + animated diagonal shine sweep.
    const cardW = portrait ? Math.min(W*0.30, 168) : Math.min(W*0.20, 200);
    const cardH = cardW * 1.65;
    const gap = portrait ? W*0.025 : W*0.04;
    const totalW = cardW*3 + gap*2;
    const startX = (W - totalW)/2 + cardW/2;
    const cardY = H * (tiny ? 0.55 : 0.575);   // lowered to clear the raised logo (gap between)
    [introCard1, introCard2, introCard3].forEach((card, i) => {
      const cx = startX + i*(cardW + gap);
      card.position.set(cx, cardY);
      card._baseY = cardY; card._cw = cardW; card._ch = cardH;   // float anchors for drawIntroVfx
      const hero = (i===1);
      const ax = card._accent;
      const plateR = cardW * 0.30;

      // ── FACETED CUT-CRYSTAL PANEL — emerald-cut gem + chromatic dispersion,
      // pushing the procedural panel toward the photoreal-crystal reference.
      drawCrystalPanel(card._plate, cardW, cardH, ax, hero);

      // ── ICON WELL — gold jewel bezel with refraction glint
      const iyc = -cardH*0.27;
      card._iconBg.clear()
        .circle(0, iyc, plateR*1.20).fill({ color:ax, alpha:0.15 })
        .circle(0, iyc, plateR).fill({ color:0x0a0703, alpha:0.96 })
        .circle(0, iyc, plateR).stroke({ color:ax, width:2, alpha:0.95 })
        .circle(0, iyc, plateR-3).stroke({ color:0xffe6f4, width:0.8, alpha:0.45 })
        // glossy top crescent (moveTo before arc — no stray seam in PIXI v8)
        .moveTo(Math.cos(Math.PI*1.15)*(plateR-3), iyc+Math.sin(Math.PI*1.15)*(plateR-3))
        .arc(0, iyc, plateR-3, Math.PI*1.15, Math.PI*1.85).stroke({ color:0xffffff, width:1.2, alpha:0.4 })
        // inner refraction light (upper-left)
        .circle(-plateR*0.28, iyc-plateR*0.28, plateR*0.5).fill({ color:0xffd9ec, alpha:0.07 });   // crystal-pink refraction (was gold 0xffe9b0)

      // Icon — bigger, centred in the well
      const iconK = (plateR * 1.5) / Math.max(card._icon.texture.width, card._icon.texture.height);
      card._icon.scale.set(iconK);
      card._icon.position.set(0, iyc);

      // ── TYPOGRAPHY — crystal-white / soft-magenta value + magenta label.
      // (Was metallic-gold 0xfff0a8/0xffe27a + brown stroke — off the
      // black/magenta-villain brand. Recolored 2026-06-01.)
      card._value.style.fontSize = Math.round(cardW * (hero?0.235:0.26));
      card._value.style.fill = hero ? 0xffe6f4 : 0xff8ad0;
      card._value.style.stroke = { color:0x1a0716, width:3, join:'round' };
      card._value.position.set(0, cardH*0.10);
      card._label.style.fontSize = Math.round(cardW * 0.085);
      card._label.style.fill = ax;
      card._label.position.set(0, cardH*0.27);
      card._subtext.style.fontSize = Math.round(cardW * 0.062);
      card._subtext.style.wordWrapWidth = cardW * 0.85;
      card._subtext.position.set(0, cardH*0.34);
    });

    // ── PREMIUM CTA — glowing magenta-glass pill (breathing bloom in drawIntroVfx)
    // RESP-26/27 — floor ctaSize so the label stays >= 14px on every preset (was
    // dropping to 11px on Popout S → fails 44px CTA + below 11px legibility minimum).
    const ctaSize = Math.max(14, Math.round(Math.min(W, H) * (tiny ? 0.06 : 0.044)));
    introCta.style.fontSize = ctaSize;
    introCta.style.fill = 0xffe6f4;                                  // crystal-white-pink text (was cream-gold 0xfff3cf)
    introCta.style.stroke = { color: 0x2a0a1e, width: 3, join: 'round' };
    const ctaY = H * (tiny ? 0.92 : 0.86);
    introCta.position.set(W/2, ctaY);
    const ctaPadX = ctaSize * 1.5;
    const ctaPadY = ctaSize * 0.58;
    const ctaW = introCta.width + ctaPadX*2;
    const ctaH = ctaSize + ctaPadY*2;
    const ctaR = ctaH * 0.5;
    const cbx = W/2 - ctaW/2, cby = ctaY - ctaH/2;
    introCta._bgRect = { x:cbx, y:cby, w:ctaW, h:ctaH, r:ctaR };     // bloom target
    introCtaBg.clear()
      // soft floating shadow
      .roundRect(cbx-1, cby+2, ctaW+2, ctaH+2, ctaR+1).fill({ color:0x000000, alpha:0.42 })
      // glass body — deep magenta-black obsidian
      .roundRect(cbx, cby, ctaW, ctaH, ctaR).fill({ color:0x140a14, alpha:0.92 })
      // top sheen (volumetric glass)
      .roundRect(cbx+2, cby+2, ctaW-4, ctaH*0.5, ctaR).fill({ color:0xff5ab0, alpha:0.10 })
      // neon-magenta villain rim
      .roundRect(cbx, cby, ctaW, ctaH, ctaR).stroke({ color:0xff007f, width:2, alpha:0.95 })
      // crystal gloss stripe
      .roundRect(cbx+ctaPadX*0.6, cby+2, ctaW-ctaPadX*1.2, 1.3, 1).fill({ color:0xffe6f4, alpha:0.7 });
  }

  // ── EXTRA STUDIO BOOT SPLASH ──────────────────────────────────
  // 8K-style cinematic studio frame. Obsidian background with a soft
  // radial vignette + warm magenta rim light behind the logo. NO ring
  // circles (cleaned per user feedback — they cluttered the composition).
  // Top-tier motion: cubic easing on fades + subtle scale-breathe + a
  // soft drop shadow ground beneath the logo.
  const extraSplash = new PIXI.Container();
  extraSplash.visible = false;
  extraSplash.eventMode = 'static';
  extraSplash.cursor = 'pointer';
  stage.addChild(extraSplash);
  const extraSplashBg = new PIXI.Graphics();
  extraSplash.addChild(extraSplashBg);
  const extraSplashGlow = new PIXI.Graphics();
  extraSplashGlow.blendMode = 'add';
  extraSplash.addChild(extraSplashGlow);
  const extraLogo = new PIXI.Sprite(tex('extraStudio'));
  extraLogo.anchor.set(0.5);
  extraSplash.addChild(extraLogo);

  function layoutExtraSplash(){
    const W = app.screen.width, H = app.screen.height;
    const cx = W/2, cy = H/2;
    // ── PURE BLACK BACKGROUND — no halo, no vignette, no rings
    // Per user feedback: "hide the bg effects on the studio ok? for the
    // aesthetic design in dark black". The logo is the ONLY visual.
    extraSplashBg.clear().rect(0,0,W,H).fill({ color: 0x000000, alpha: 1.0 });
    extraSplashGlow.clear();   // intentionally empty — no glow effects
    // Logo — fit cleanly within available space
    const logoMax = Math.min(W * 0.62, H * 0.50);
    const k = logoMax / Math.max(extraLogo.texture.width, extraLogo.texture.height);
    extraLogo.scale.set(k);
    extraLogo.position.set(cx, cy);
  }

  // Cubic ease-in-out — silk-smooth motion for the studio frame
  const easeInOutCubic = (p) => p < 0.5
    ? 4*p*p*p
    : 1 - Math.pow(-2*p + 2, 3) / 2;

  function showExtraStudioSplash(onDone){
    layoutExtraSplash();
    extraSplash.visible = true;
    extraSplash.alpha = 0;
    const t0 = performance.now();
    let done = false;
    const finish = () => {
      if(done) return; done = true;
      // Fade out 420ms with cubic-in-out (smoother than linear)
      const f0 = performance.now();
      const fadeOut = () => {
        const p = Math.min(1, (performance.now() - f0) / 420);
        extraSplash.alpha = 1 - easeInOutCubic(p);
        if(p < 1) requestAnimationFrame(fadeOut);
        else { extraSplash.visible = false; onDone && onDone(); }
      };
      requestAnimationFrame(fadeOut);
    };
    // Tap-to-skip
    const onTap = () => { extraSplash.off('pointertap', onTap); finish(); };
    extraSplash.on('pointertap', onTap);
    // Auto-advance: fade in 500ms (cubic ease) → hold 1500ms → fade out 420ms
    const fadeIn = () => {
      const p = Math.min(1, (performance.now() - t0) / 500);
      extraSplash.alpha = easeInOutCubic(p);
      if(p < 1) requestAnimationFrame(fadeIn);
      else setTimeout(finish, 1500);
    };
    requestAnimationFrame(fadeIn);
    // Cinematic scale-breathe — logo slowly drifts 0.97 → 1.03 → 0.97
    // (matches the "alive but calm" feel of high-end studio idents)
    const breatheStart = performance.now();
    const baseScale = extraLogo.scale.x;
    const breathe = () => {
      if(done || !extraSplash.visible) return;
      const t = (performance.now() - breatheStart) * 0.0018;
      const k = 1 + Math.sin(t) * 0.030;
      extraLogo.scale.set(baseScale * k, baseScale * k);
      requestAnimationFrame(breathe);
    };
    requestAnimationFrame(breathe);
  }

  // ── SHINING POP GAME LOADER (award-tier game-brand opener) ──
  // Post-EXTRA-STUDIO (HTML loader handled that frame), this is the
  // game-brand loading screen. 2026-05-27 redesign: uses the REAL game
  // bg.jpg (painted cathedral hall) as the backdrop — darkened + blurred
  // — so the player feels the game world emerge from the loading state
  // instead of a generic gradient. Logo breathes; gradient progress bar
  // (magenta → bright pink → magenta) with a chromatic top stripe; soft
  // pink halo behind logo; animated radial rays for cinema flair.
  //
  // Layer stack (bottom → top):
  //   popLoaderBgSprite — REAL game bg.jpg (darkened + blurred filter)
  //   popLoaderBg       — magenta-tinted radial vignette + 6% accent
  //   popLoaderVignette — outer corner darkening for cinematic frame
  //   popLoaderGlow     — soft pink halo behind logo (additive blend)
  //   popLoaderRays     — subtle radial light rays (animated, additive)
  //   popLoaderLogo     — SHINING POP wordmark (breathes + drifts)
  //   popLoaderBarTrack — empty 5px track with subtle inner shadow
  //   popLoaderBar      — 3-stop gradient fill (drawn as horizontal bands)
  //                       with bright top highlight + leading-edge spark
  //   popLoaderText     — "LOADING" caption (Fredoka 12px, tracked +10)
  //   popLoaderDots     — animated 3-dot indicator after LOADING
  //   popLoaderBrand    — "AN ARTEST | BRAINROCKET PRODUCTION" sub-caption
  const popLoader = new PIXI.Container();
  popLoader.visible = false;
  stage.addChild(popLoader);

  // ── DEV: label EVERY direct stage child (build AR) so the PixiJS devtools tree
  // reads professionally — no more loose unnamed "Wi"/"dt" at (0,0). Those nodes
  // sit at the origin only while IDLE (modals before they open; the fly-up text
  // pool; bonus-mode FX in the base game) — that is correct object pooling, not
  // dead/garbage nodes. Labels make the tree self-documenting.
  try {
    const _L = (n,l)=>{ if(n) n.label = l; };
    _L(bg,'bg·hallBackdrop'); _L(godRays,'godRays(add)'); _L(vignette,'vignette');
    _L(logoHalo,'logoHalo'); _L(logo,'logo'); _L(logoShine,'logoShine(add)'); _L(maxWinCap,'maxWinCap');
    _L(swipeZone,'swipeZone·gestureHit'); _L(featureBanner,'featureBanner');
    _L(bonusFxG,'bonusFxG'); _L(bonusFxAddG,'bonusFxAddG(add)'); _L(bonusHudText,'bonusHudText·FS');
    _L(bonusMultBig,'bonusMultBig·FS'); _L(bonusWildLabel,'bonusWildLabel·"WILD REEL"'); _L(bonusLockLabel,'bonusLockLabel·"LOCKED"');
    _L(particleG,'particleG·particlePool(add)');
    _L(buyModal,'MODAL·buyBonus'); _L(betMenu,'MODAL·betSelect'); _L(drawerLayer,'MODAL·settingsDrawer');
    _L(infoModal,'MODAL·info'); _L(rcModal,'MODAL·realityCheck'); _L(errModal,'MODAL·error'); _L(replayBar,'replayBar');
    _L(introOverlay,'OVERLAY·intro'); _L(extraSplash,'OVERLAY·splash'); _L(popLoader,'OVERLAY·loader');
  } catch(e){}

  // ── (1) Real game bg as the loader backdrop ──
  // Uses the same painted hall texture that becomes the game scene —
  // darkened 50% + blurred for context-aware "the game is loading"
  // feedback. The hall art bleeds through under the logo and bar.
  const popLoaderBgSprite = new PIXI.Sprite(tex('bg'));
  popLoaderBgSprite.anchor.set(0.5);
  // 2026-05-27 fix — was 0.42 → loader looked transparent, game scene
  // bled through during boot. Now full opacity; the dark wash overlay
  // controls perceived darkness instead.
  popLoaderBgSprite.alpha = 1.0;
  const _popBgBlur = new PIXI.BlurFilter({ strength: 12, quality: 1 });
  _popBgBlur.resolution = 0.5;          // perf — half-res blur
  popLoaderBgSprite.filters = [_popBgBlur];
  popLoader.addChild(popLoaderBgSprite);
  const popLoaderBg = new PIXI.Graphics();
  popLoader.addChild(popLoaderBg);
  const popLoaderVignette = new PIXI.Graphics();
  popLoader.addChild(popLoaderVignette);
  const popLoaderRays = new PIXI.Graphics();
  popLoaderRays.blendMode = 'add';
  popLoader.addChild(popLoaderRays);
  const popLoaderGlow = new PIXI.Graphics();
  popLoaderGlow.blendMode = 'add';
  popLoader.addChild(popLoaderGlow);
  const popLoaderLogo = new PIXI.Sprite(tex('logo'));
  popLoaderLogo.anchor.set(0.5);
  popLoader.addChild(popLoaderLogo);
  // Progress track (drawn once per layout — fixed)
  const popLoaderBarTrack = new PIXI.Graphics();
  popLoader.addChild(popLoaderBarTrack);
  // Progress fill (cleared + redrawn per frame with gradient)
  const popLoaderBar = new PIXI.Graphics();
  popLoader.addChild(popLoaderBar);
  const popLoaderText = new PIXI.Text({ text:'LOADING', style:{
    fontFamily:'Fredoka', fontSize:12, fill:0xf5f7fa,
    letterSpacing:10, fontWeight:'700',
  }});
  popLoaderText.anchor.set(0.5);
  popLoader.addChild(popLoaderText);
  // Animated 3-dot indicator after "LOADING" — sequential fade pulse
  const popLoaderDots = new PIXI.Text({ text:'•••', style:{
    fontFamily:'Fredoka', fontSize:14, fill:0xff007f,
    letterSpacing:4, fontWeight:'700',
  }});
  popLoaderDots.anchor.set(0, 0.5);
  popLoader.addChild(popLoaderDots);
  // Sub-caption — film-credit style "AN ARTEST | BRAINROCKET PRODUCTION" in
  // tracked smoke-white caps. Sits low at H * 0.93 — feels cinematic.
  const popLoaderBrand = new PIXI.Text({ text:'AN ARTEST | BRAINROCKET PRODUCTION', style:{
    fontFamily:'Fredoka', fontSize:9, fill:0xf5f7fa,
    letterSpacing:7, fontWeight:'600',
  }});
  popLoaderBrand.anchor.set(0.5);
  popLoaderBrand.alpha = 0.45;
  popLoader.addChild(popLoaderBrand);

  function layoutPopLoader(){
    const W = app.screen.width, H = app.screen.height;
    const cx = W/2, cy = H * 0.42;   // logo slightly above center
    // ── (1) GAME BG SPRITE — fit cover (fill viewport without stretch) ──
    // The real bg.jpg painted hall — gives the player a peek at the world
    // beneath the loader. Fitted COVER (scale to max of W/H ratio) to
    // ensure no letterboxing bands of black show.
    const bgT = popLoaderBgSprite.texture;
    const fitK = Math.max(W / bgT.width, H / bgT.height) * 1.06;   // tiny extra to mask edges
    popLoaderBgSprite.scale.set(fitK);
    popLoaderBgSprite.position.set(W/2, H/2);
    // ── (2) DARK WASH + MAGENTA VIGNETTE on top of bg ──
    popLoaderBg.clear();
    // Solid dark wash — knocks the bg back to ~30% so the logo dominates.
    // Bumped 0.55 → 0.70 so the loader reads as a real opaque screen,
    // not transparent (2026-05-27 fix per user "logo loading content
    // is transparent").
    popLoaderBg.rect(0, 0, W, H).fill({ color: 0x06060c, alpha: 0.70 });
    // Radial magenta vignette behind logo — focal anchor on top of dark wash
    const focalR = Math.min(W, H) * 0.55;
    for(let g = 14; g >= 1; g--){
      popLoaderBg.circle(cx, cy, focalR * (g/14))
        .fill({ color: 0xff007f, alpha: (1 - g/14) * 0.030 });
    }
    // ── (3) CORNER VIGNETTE — cinematic letterbox darkening ──
    popLoaderVignette.clear();
    const vR = Math.max(W, H) * 0.75;
    for(let g = 10; g >= 1; g--){
      const rr = vR * (1 + g*0.08);
      popLoaderVignette.circle(cx, H * 0.5, rr).stroke({
        color: 0x000000, width: rr * 0.05, alpha: (g/10) * 0.14
      });
    }
    // ── (4) SOFT PINK RIM HALO behind logo (additive) ──
    const logoR = Math.min(W, H) * 0.30;
    popLoaderGlow.clear();
    for(let g = 8; g >= 1; g--){
      popLoaderGlow.circle(cx, cy, logoR * (1 + g*0.18))
        .fill({ color: 0xff007f, alpha: (g/8) * 0.05 });
    }
    // Drop-shadow ground anchor
    popLoaderGlow.ellipse(cx, cy + logoR*0.62, logoR*0.7, logoR*0.06)
      .fill({ color: 0xff007f, alpha: 0.20 });
    // ── (5) LOGO sizing — large, brand-dominant ──
    const lk = Math.min(W*0.62, H*0.46) /
               Math.max(popLoaderLogo.texture.width, popLoaderLogo.texture.height);
    popLoaderLogo.scale.set(lk);
    popLoaderLogo.position.set(cx, cy);
    // ── (6) PROGRESS BAR — 5px (was 3) for better visibility on bg art ──
    const barW = Math.min(360, W*0.72), barH = 5;
    const barY = H * 0.74;
    popLoader._barW = barW;
    popLoader._barX = cx - barW/2;
    popLoader._barY = barY;
    popLoader._barH = barH;
    // Static empty-track + glow halo — drawn once per layout, never per frame
    popLoaderBarTrack.clear();
    // Outer halo (always visible — feels alive even at 0% progress)
    popLoaderBarTrack.roundRect(barW > 0 ? cx - barW/2 - 6 : 0, barY - 6,
      barW + 12, barH + 12, (barH + 12)/2).fill({ color: 0xff007f, alpha: 0.04 });
    // Track inner-shadow rim
    popLoaderBarTrack.roundRect(cx - barW/2, barY, barW, barH, barH/2)
      .fill({ color: 0xf5f7fa, alpha: 0.10 })
      .stroke({ color: 0xf5f7fa, width: 0.6, alpha: 0.20 });
    // ── (7) "LOADING" caption above bar ──
    popLoaderText.position.set(cx - 12, barY - 26);
    popLoaderDots.position.set(cx + popLoaderText.width/2 - 6, barY - 26);
    // ── (8) "AN ARTEST | BRAINROCKET PRODUCTION" sub-caption near bottom ──
    popLoaderBrand.position.set(cx, H - Math.max(36, H * 0.07));
    // Store rays center for the animation tick
    popLoader._raysCx = cx;
    popLoader._raysCy = cy;
    popLoader._raysR  = focalR;
  }

  // ── GRADIENT PROGRESS BAR — multi-stop fake-gradient fill ──
  // Pixi v8 lacks native linear-gradient fills, so we paint horizontal
  // bands of color across the fill width. Color sweeps magenta (left)
  // → bright pink (mid) → magenta (right) for chromatic depth. A bright
  // top-highlight stripe + a leading-edge sparkle complete the AAA feel.
  function drawPopLoaderBar(progress){
    const W = popLoader._barW, X = popLoader._barX, Y = popLoader._barY, H = popLoader._barH;
    popLoaderBar.clear();
    const fillW = Math.max(2, W * progress);
    if(fillW < 3) return;
    // ── (a) OUTER GLOW HALO — fake bloom around the active fill
    popLoaderBar.roundRect(X-5, Y-5, fillW+10, H+10, (H+10)/2)
      .fill({ color:0xff007f, alpha:0.12 });
    popLoaderBar.roundRect(X-2, Y-2, fillW+4,  H+4,  (H+4)/2)
      .fill({ color:0xff007f, alpha:0.32 });
    // ── (b) GRADIENT FILL — 24 vertical bands across fillW
    // Color interp: lerp ff007f → ff7ab8 → ff007f across the fill width
    const bands = 24;
    for(let i = 0; i < bands; i++){
      const t = i / (bands - 1);                 // 0..1
      const tri = 1 - Math.abs(t * 2 - 1);       // triangular wave — peaks at mid
      // Lerp between deep magenta (0xff007f) and bright pink (0xff7ab8)
      const r = 0xff;
      const g = Math.round(0x00 + tri * 0x7a);
      const b = Math.round(0x7f + tri * 0x39);
      const col = (r << 16) | (g << 8) | b;
      const bx = X + (i / bands) * fillW;
      const bw = (fillW / bands) + 1;            // +1 px so bands overlap (no seams)
      popLoaderBar.roundRect(bx, Y, bw, H,
        // Only round leading edge if it's the last band, only round trailing edge if first
        i === 0 || i === bands - 1 ? H/2 : 0
      ).fill({ color: col, alpha: 1 });
    }
    // ── (c) TOP HIGHLIGHT STRIPE — bright chromatic line at top edge
    popLoaderBar.roundRect(X + 2, Y + 0.5, Math.max(0, fillW - 4), H * 0.32, H * 0.16)
      .fill({ color: 0xffffff, alpha: 0.55 });
    // ── (d) LEADING-EDGE SPARKLE — bright dot at progress front
    if(progress > 0.02 && progress < 0.99){
      const ex = X + fillW;
      popLoaderBar.circle(ex, Y + H/2, H * 1.4).fill({ color:0xffffff, alpha:0.25 });
      popLoaderBar.circle(ex, Y + H/2, H * 0.7).fill({ color:0xffffff, alpha:0.90 });
    }
  }

  function showPopLoader(onDone, durOverride){
    layoutPopLoader();
    // 2026-05-27 fix — bring popLoader to TOP of stage before showing.
    // Without this, late-added game elements (winDisplay, drawerLayer,
    // bonusFxG, intro overlay) sit ABOVE the popLoader → game scene
    // bleeds through. addChild re-parents if already a child.
    stage.addChild(popLoader);
    popLoader.visible = true;
    popLoader.alpha = 0;
    // Award-tier timing — 1400ms first session (full cinematic). Repeat
    // sessions pass durOverride=650 (retention: shorten 2nd-session entry
    // per expert audit P4). User asked "1s or what, dynamic if needed".
    const totalDur = durOverride || 1400;
    const t0 = performance.now();
    let done = false;
    const baseScale = popLoaderLogo.scale.x;
    const finish = () => {
      if(done) return; done = true;
      const f0 = performance.now();
      const fadeOut = () => {
        const p = Math.min(1, (performance.now() - f0) / 320);
        popLoader.alpha = 1 - easeInOutCubic(p);
        if(p < 1) requestAnimationFrame(fadeOut);
        else { popLoader.visible = false; popLoaderLogo.scale.set(baseScale); onDone && onDone(); }
      };
      requestAnimationFrame(fadeOut);
    };
    // tap-to-skip
    popLoader.eventMode = 'static'; popLoader.cursor = 'pointer';
    const onTap = () => { popLoader.off('pointertap', onTap); finish(); };
    popLoader.on('pointertap', onTap);
    // animate fade-in + progress + LOGO BREATHING + animated rays + dots
    const step = () => {
      if(done) return;
      const el = performance.now() - t0;
      // Container fade-in — fast ease-out cubic (premium responsive feel)
      const fadeP = Math.min(1, el / 280);
      popLoader.alpha = 1 - Math.pow(1 - fadeP, 3);
      // Progress fills over totalDur with ease-out-quart (most-time-at-end
      // perception trick — feels like loading wraps up quickly)
      const barP = Math.min(1, el / totalDur);
      drawPopLoaderBar(1 - Math.pow(1 - barP, 4));
      // ── LOGO LIFE — sin-wave breathe ±4% + ±0.5° rotation drift ──
      const breath = 1 + Math.sin(el * 0.0045) * 0.04;
      popLoaderLogo.scale.set(baseScale * breath);
      popLoaderLogo.rotation = Math.sin(el * 0.0028) * 0.008;
      // ── ANIMATED RADIAL RAYS — slow rotating light shafts ──
      const cx = popLoader._raysCx, cy = popLoader._raysCy, rR = popLoader._raysR;
      popLoaderRays.clear();
      const rayAng = el * 0.0003;       // slow rotation
      const numRays = 6;
      for(let i = 0; i < numRays; i++){
        const a = rayAng + (i / numRays) * Math.PI * 2;
        const x2 = cx + Math.cos(a) * rR * 1.2;
        const y2 = cy + Math.sin(a) * rR * 0.7;
        popLoaderRays.moveTo(cx, cy).lineTo(x2, y2)
          .stroke({ color: 0xff007f, width: 60, alpha: 0.025 });
      }
      // ── ANIMATED 3-DOT INDICATOR — sequential pulse ──
      // Each dot pulses bright then dim on a 0.6s phase shift
      const dotPhase = (el * 0.003) % (Math.PI * 2);
      const d1 = 0.4 + 0.6 * (Math.sin(dotPhase) * 0.5 + 0.5);
      const d2 = 0.4 + 0.6 * (Math.sin(dotPhase - 0.7) * 0.5 + 0.5);
      const d3 = 0.4 + 0.6 * (Math.sin(dotPhase - 1.4) * 0.5 + 0.5);
      popLoaderDots.alpha = (d1 + d2 + d3) / 3;
      // ── BRAND SUB-CAPTION fade-in (delayed 200ms after logo) ──
      const brandP = Math.max(0, Math.min(1, (el - 200) / 400));
      popLoaderBrand.alpha = 0.45 * (1 - Math.pow(1 - brandP, 3));
      if(el < totalDur) requestAnimationFrame(step);
      else finish();
    };
    requestAnimationFrame(step);
  }
  // Re-layout on window resize
  window.addEventListener('resize', () => {
    if(extraSplash && extraSplash.visible) layoutExtraSplash();
    if(popLoader && popLoader.visible) layoutPopLoader();
  });

  function showIntroOverlay(onDismiss, autoMs){
    introOverlay._onDismiss = onDismiss || null;
    introOverlay._dismissing = false;
    introOverlay._fadeStart = 0;
    introOverlay._shownAt = performance.now();
    introOverlay.alpha = 0;
    introOverlay.visible = true;
    // P4 (expert audit) — repeat sessions auto-dismiss the intro after a
    // short hold so returning players don't have to tap through the
    // cinematic every time. First session leaves autoMs undefined → the
    // player taps "PRESS TO CONTINUE" as before.
    // rAF-driven (checked in the render loop) rather than setTimeout —
    // background-tab timer throttling can delay setTimeout indefinitely,
    // and the render loop is the single source of truth for the fade.
    introOverlay._autoMs = (autoMs && autoMs > 0) ? autoMs : 0;
    // 2026-05-27 fix — bring intro to TOP of stage (was being covered
    // by late-added game elements). Per user "on close showing game
    // after that the intro it's look glitched". addChild re-parents.
    stage.addChild(introOverlay);
    introCta.alpha = 1;
    introCta.scale.set(1);
    layoutIntroOverlay();
    introOverlay._fadeIn = performance.now();
    // ── LOGO ENTRANCE (award-tier audit #9) — cinematic reveal: logo rises
    // 0.80 → 1.0 on a SMOOTH outQuint (no bounce) over 640ms, alpha ramps in
    // parallel so the eye reads it as ONE clean motion. First-impression
    // brand moment, premium not poppy.
    introOverlay._logoT0 = performance.now() + 80;   // small offset so the
                                                      // backdrop fades in first
    introOverlay._logoBaseScale = introLogo.scale.x;
    introLogo.alpha = 0;
    introLogo.scale.set(introOverlay._logoBaseScale * 0.80);
    // honour prefers-reduced-motion — skip everything, snap to final state
    if(isReduced()){
      introOverlay.alpha = 1; introOverlay._fadeIn = 0;
      introLogo.alpha = 1;
      introLogo.scale.set(introOverlay._logoBaseScale);
      introOverlay._logoT0 = 0;
    }
    // launch the cinematic VFX loop (cosmic dust, god-rays, logo sparkle,
    // per-card energy, CTA bloom). Self-stops when the overlay hides;
    // reduced-motion draws a single static frame instead of looping.
    startIntroVfx();
    // ── BEAT 3 · LOGO SHINE SWEEP — one-shot GSAP glint across the wordmark,
    // timed just after the logo has risen in (delay > the 640ms logo rise).
    // Drives introOverlay._shine 0→1, which drawIntroVfx renders. Honors
    // reduced-motion and the file's window.gsap-optional convention.
    introOverlay._shine = -1;
    if(window.gsap && window.gsap.fromTo && !isReduced()){
      window.gsap.fromTo(introOverlay, { _shine: 0 }, {
        _shine: 1, duration: 0.85, ease: 'power1.inOut', delay: 0.55,
        onComplete(){ introOverlay._shine = -1; },
      });
    }
  }

  // ── BEAT 4 · IRIS-WIPE DISMISS — replaces the flat alpha fade with a
  // cinematic circular iris that collapses to a point, clipping the intro and
  // revealing the live reels beneath. Built as ONE gsap.timeline (gsap-timeline
  // skill: defaults + position params). Reduced-motion / no-GSAP fall back to
  // the render-loop alpha fade. Idempotent: a second tap is ignored.
  function irisDismissIntro(){
    if(introOverlay._dismissing) return;
    introOverlay._dismissing = true;
    const G = window.gsap;
    if(isReduced() || !G || !G.timeline){
      introOverlay._fadeStart = performance.now();   // render-loop alpha fade
      return;
    }
    let iris = introOverlay._iris;
    if(!iris){
      iris = introOverlay._iris = new PIXI.Graphics();
      stage.addChild(iris);
    }
    const W = app.screen.width, H = app.screen.height;
    const R = Math.hypot(W, H) * 0.55;                  // reaches the corners
    iris.clear().circle(0, 0, R).fill({ color: 0xffffff }); // hi-res circle at full size
    iris.position.set(W / 2, H / 2);
    iris.scale.set(1);
    iris.visible = true;
    introOverlay.mask = iris;
    introOverlay._irisActive = true;
    G.timeline({ defaults: { ease: 'power2.inOut' }, onComplete(){
        introOverlay.visible = false;
        introOverlay.mask = null;
        iris.visible = false;
        introOverlay._irisActive = false;
        const cb = introOverlay._onDismiss; introOverlay._onDismiss = null;
        if(cb) cb();
      } })
      .to(iris.scale, { x: 1.06, y: 1.06, duration: 0.12, ease: 'power2.out' }) // tiny anticipation breath
      .to(iris.scale, { x: 0.0001, y: 0.0001, duration: 0.72 }, '>')            // collapse to a point
      .to(introOverlay, { alpha: 0.62, duration: 0.5 }, '<0.3');                        // soften the trailing edge
  }

  // ── SOUND (procedural Web Audio) ──────────────────────────────
  // ── 5. SOUND — AAA layered audio architecture (slot-audio-engineer)
  // ─────────────────────────────────────────────────────────────────
  // Replaces the previous 8-function procedural synth with a proper
  // 5-bus topology + ducking automation + 7-tier additive win chime
  // stack + reel-rush layer + bonus-mode music. All synthesis is still
  // procedural Web Audio (no external CDN samples), but the architecture
  // is sample-ready: when real Opus assets ship into assets/audio/, drop
  // them into Sound.buffers and `_playSample()` will use them
  // automatically while the synth fallback handles missing assets.
  //
  // Per AUDIO_HANDOFF.md:
  //   bus.master      → ctx.destination
  //     ├─ bus.music   (-12 dB idle, -10 dB bonus, ducks on big win)
  //     ├─ bus.gameplay (-6 dB reel rush)
  //     ├─ bus.sfx      (-6 dB clicks, ticks)
  //     └─ bus.win      ( 0 dB → +6 dB on EPIC, drives ducking)
  const Sound = {
    ctx: null,
    master: null, busMusic: null, busGameplay: null, busSfx: null, busWin: null,
    rushSource: null,           // currently playing reel-rush layer
    musicVoice: null,           // currently playing background music voice
    musicId: null,              // 'idle' | 'bonus_standard' | 'bonus_hot' | 'bonus_mega'
    buffers: Object.create(null), // future sample buffers (currently empty)

    // ─── BUS SETUP ───
    ensure(){
      if(this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master      = this.ctx.createGain(); this.master.gain.value = State.muted ? 0 : (this._vol == null ? 0.6 : this._vol);
        this.busMusic    = this.ctx.createGain();
        this.busGameplay = this.ctx.createGain();
        this.busSfx      = this.ctx.createGain();
        this.busWin      = this.ctx.createGain();
        this.applyBusMix();   // one readable dB mix table (sets bus gains + _musicBase)
        this.busMusic.connect(this.master);
        this.busGameplay.connect(this.master);
        this.busSfx.connect(this.master);
        this.busWin.connect(this.master);
        this.master.connect(this.ctx.destination);
      } catch(e){ /* WebAudio unsupported → silent */ }
    },
    resume(){ this.ctx?.resume(); },
    // Master MUTE gate (2026-05-30) — one-shot SFX already early-return on
    // State.muted, but the LOOPING music + reel-rush voices keep running, so
    // muting only swapped the icon while the drone kept playing. Ramping the
    // master bus to 0 silences EVERYTHING; unmute restores it.
    _vol: 0.6,   // chosen master level (0..1) — restored on unmute, driven by the volume slider
    setMuted(m){ if(this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : (this._vol == null ? 0.6 : this._vol), this.ctx.currentTime, 0.02); },
    // Volume slider → master level. v in 0..1. Setting >0 also unmutes; 0 mutes.
    setVolume(v){
      this._vol = Math.max(0, Math.min(1, v));
      const wasMuted = State.muted;
      State.muted = this._vol <= 0.001;
      if(this.master && this.ctx) this.master.gain.setTargetAtTime(State.muted ? 0 : this._vol, this.ctx.currentTime, 0.02);
      return wasMuted !== State.muted;   // true if mute-state flipped (caller resyncs icons)
    },
    // ── PER-BUS MIX (a readable dB table behind the single master slider) ──
    // The slider drives ONE master level; the relative balance of the 4 buses is a
    // FIXED design mix in dB. db→linear: 10^(dB/20). Derives _musicBase so the
    // ducker + bonus bed share one source of truth. Re-appliable without touching ensure().
    _busMix: { music: -6, gameplay: -10, sfx: -8, win: -2 },   // music clearly present (was -11, inaudible); rush sits under it
    applyBusMix(){
      if(!this.ctx) return;
      const db2lin = (db) => Math.pow(10, db / 20);
      const m = this._busMix;
      this._musicBase = db2lin(m.music);                 // idle rest level the ducker returns to
      if(this.busMusic)    this.busMusic.gain.value    = this._musicBase;
      if(this.busGameplay) this.busGameplay.gain.value = db2lin(m.gameplay);
      if(this.busSfx)      this.busSfx.gain.value      = db2lin(m.sfx);
      if(this.busWin)      this.busWin.gain.value      = db2lin(m.win);
    },

    // ─── LOW-LEVEL SYNTH (used until samples ship) ───
    // Single oscillator with ADSR-shaped gain. Connect into any bus.
    _voice(freq, dur, type, vol, bus, delay = 0){
      if(State.muted || !this.ctx) return null;
      const t0 = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.008);             // attack 8 ms
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);       // decay
      o.connect(g); g.connect(bus || this.busSfx);
      o.start(t0); o.stop(t0 + dur + 0.05);
      o.onended = () => { try { o.disconnect(); g.disconnect(); } catch(e){} };
      return { osc: o, gain: g };
    },
    // A "chord" voice — multiple oscillators stacked at musical intervals
    // for a richer, more orchestral feel than a single sine.
    _chord(rootFreq, intervals, dur, type, vol, bus, delay = 0){
      const voices = [];
      for(const semis of intervals){
        const f = rootFreq * Math.pow(2, semis / 12);
        const v = this._voice(f, dur, type, vol / Math.sqrt(intervals.length), bus, delay);
        if(v) voices.push(v);
      }
      return voices;
    },
    // Filtered noise burst (sssh-like). For brass swells, reel-stop tail,
    // bonus-mode shaker layers. Connects through a band-pass filter.
    _noise(dur, cutoff, q, vol, bus, delay = 0){
      if(State.muted || !this.ctx) return null;
      const t0 = this.ctx.currentTime + delay;
      const bufLen = Math.ceil(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for(let i = 0; i < bufLen; i++) ch[i] = (vrnd() * 2 - 1) * 0.6;
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass'; filt.frequency.value = cutoff; filt.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filt); filt.connect(g); g.connect(bus || this.busSfx);
      src.start(t0); src.stop(t0 + dur + 0.05);
      src.onended = () => { try { src.disconnect(); filt.disconnect(); g.disconnect(); } catch(e){} };
      return { src, filt, gain: g };
    },

    // ─── DUCKING AUTOMATION ───
    // When bus.win fires a celebration, duck bus.music by 8–16 dB so the
    // celebration cuts through. Per AUDIO_HANDOFF.md §3.3.
    _musicBase: 0.25,   // live busMusic rest level; the duck restores to THIS, not a stale literal
    _duckMusic(tier){
      if(!this.ctx || !this.busMusic) return;
      if(tier < 3) return;     // small wins don't duck
      // deeper cinematic duck now that real masters play (was -8/-12/-16, muddy)
      const duckDb   = tier >= 6 ? -20 : tier >= 5 ? -15 : -10;
      const holdMs   = tier >= 6 ? 4500 : tier >= 5 ? 3500 : 2200;
      const releaseMs = 1100;                            // slower release = elegant, not a gate-pump
      const now = this.ctx.currentTime;
      const base = this._musicBase;                      // LIVE rest level (idle or bonus)
      const target = base * Math.pow(10, duckDb / 20);
      const g = this.busMusic.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(target, now + 0.18);
      g.setValueAtTime(target, now + holdMs / 1000);
      g.linearRampToValueAtTime(base, now + (holdMs + releaseMs) / 1000);
    },

    // ─── UI SFX (procedural, instant) ───
    click(){ this.ensure(); this._voice(660, 0.05, 'square', 0.30, this.busSfx); },
    tick() { this.ensure(); this._voice(1200, 0.02, 'square', 0.10, this.busSfx); },

    // ─── SPIN START: prespin "tick" + start reel-rush loop ───
    spinStart(){
      this.ensure();
      // Prespin pop — a soft wooden tick + up-pitch lift
      this._voice(840, 0.06, 'triangle', 0.18, this.busSfx);
      this._voice(440, 0.10, 'sine',     0.12, this.busSfx, 0.02);
      // Start reel-rush layer — repeating sub-octave sweep loop while
      // any reel is moving. Stops on last reel arrival.
      this._startRush();
    },
    _startRush(){
      if(!this.ctx || this.rushSource) return;
      const ctx = this.ctx, t0 = ctx.currentTime;
      // ── CUTE CANDY REEL-SPIN (2026-06-10, user: "remove the noise on the reels,
      // cute happy effects") — REPLACES the noise whoosh / reel_loop sample with a
      // soft TONAL candy loop: a mellow detuned-triangle whir bed + light bouncy
      // major-triad "bubble" pips for a cheerful sense of motion. NO noise, NO
      // sample (so nothing hisses). Sits UNDER the music; ends on the last reel.
      // (1) mellow detuned-triangle whir bed — continuous, soft, with a playful
      //     slow filter wobble (the "fun" wiggle, never harsh).
      const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = 294;    // ~D4
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 296.7;   // tiny detune = candy shimmer
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000; lp.Q.value = 0.7;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5.2;
      const lfoG = ctx.createGain(); lfoG.gain.value = 520;
      lfo.connect(lfoG); lfoG.connect(lp.frequency);
      const padG = ctx.createGain(); padG.gain.setValueAtTime(0, t0); padG.gain.linearRampToValueAtTime(0.045, t0 + 0.16);
      o1.connect(lp); o2.connect(lp); lp.connect(padG); padG.connect(this.busGameplay);
      o1.start(t0); o2.start(t0); lfo.start(t0);
      this.rushSource = { o1, o2, lfo, gain: padG, _pipT: 0 };
      // (2) bouncy candy "bubble" pips — soft sine boops in a happy major bounce,
      //     re-scheduled while the reels move (timer cleared in _stopRush).
      const PAT = [523, 659, 784, 659];   // C5 E5 G5 E5 — cheerful major triad
      let step = 0;
      const pip = () => {
        if(!this.rushSource || State.muted) return;
        const t = ctx.currentTime + 0.02, f = PAT[step % PAT.length]; step++;
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.038, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
        o.connect(g); g.connect(this.busGameplay); o.start(t); o.stop(t + 0.2);
        if(this.rushSource) this.rushSource._pipT = setTimeout(pip, 145);
      };
      pip();
    },
    _stopRush(){
      if(!this.rushSource || !this.ctx) return;
      const rs = this.rushSource, now = this.ctx.currentTime;
      if(rs._pipT) clearTimeout(rs._pipT);                 // stop the bubble-pip scheduler
      rs.gain.gain.cancelScheduledValues(now);
      rs.gain.gain.linearRampToValueAtTime(0, now + 0.18);
      try {
        if(rs._sample){ rs.src.stop(now + 0.22); }
        else {
          if(rs.o1) rs.o1.stop(now + 0.22); if(rs.o2) rs.o2.stop(now + 0.22); if(rs.lfo) rs.lfo.stop(now + 0.22);
          if(rs.osc1) rs.osc1.stop(now + 0.22); if(rs.osc2) rs.osc2.stop(now + 0.22); if(rs.noise) rs.noise.stop(now + 0.22);
        }
      } catch(e){}
      this.rushSource = null;
    },

    // ─── REEL STOP: tier-aware chord per top symbol ───
    // sym 7 = CROWN (premium brass swell), sym 6 = SEVEN (mid bell),
    // else low fruit thunk. Last reel also fades out the rush loop.
    reelStop(idx, topSym){
      this.ensure();
      if(topSym === 7){
        // Crown — brass swell (chord + filtered noise wash)
        this._chord(220, [0, 4, 7], 0.42, 'triangle', 0.18, this.busSfx);
        this._noise(0.35, 1800, 4, 0.06, this.busSfx, 0.04);
      } else if(topSym === 6){
        // Seven — bell mid chord
        this._chord(330, [0, 4, 7], 0.28, 'triangle', 0.14, this.busSfx);
      } else {
        // Fruit/bell — low thunk
        this._voice(280 + idx * 22, 0.10, 'square', 0.10, this.busSfx);
      }
      // Last reel arrival → fade out the rush loop
      if(idx === REELS - 1) this._stopRush();
    },

    // ─── MEGA ARCANE-ELECTRIC CEREMONY AUDIO (2026-06-01) ───
    // Synced to playMegaLogoCeremony: a rising CHARGE hum builds while staggered
    // electric ZAPS crackle as each bolt strikes the crown, then a big DISCHARGE
    // boom + bright flash + shimmer chord. All procedural (no external files),
    // vrnd-seeded noise (no Math.random). Reduced-motion skips the ceremony → silent.
    megaCharge(durSec){
      this.ensure();
      if(State.muted || !this.ctx) return null;
      const t0 = this.ctx.currentTime, d = Math.max(0.6, durSec || 1.6);
      const o1 = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'triangle';
      o1.frequency.setValueAtTime(90,  t0); o1.frequency.exponentialRampToValueAtTime(330, t0 + d);   // rising tension
      o2.frequency.setValueAtTime(135, t0); o2.frequency.exponentialRampToValueAtTime(495, t0 + d);
      const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 4;
      filt.frequency.setValueAtTime(480, t0); filt.frequency.linearRampToValueAtTime(2300, t0 + d);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.10, t0 + 0.30); g.gain.linearRampToValueAtTime(0.15, t0 + d * 0.9);
      o1.connect(filt); o2.connect(filt); filt.connect(g); g.connect(this.busGameplay);
      o1.start(t0); o2.start(t0);
      return { o1, o2, g };
    },
    megaChargeStop(h){
      if(!h || !this.ctx) return;
      const now = this.ctx.currentTime;
      h.g.gain.cancelScheduledValues(now); h.g.gain.setValueAtTime(h.g.gain.value, now);
      h.g.gain.linearRampToValueAtTime(0, now + 0.12);
      try { h.o1.stop(now + 0.15); h.o2.stop(now + 0.15); } catch(e){}
    },
    megaZap(i){
      this.ensure();
      if(State.muted || !this.ctx) return;
      i = i | 0;
      this._noise(0.09, 2600 + (i % 4) * 520, 8, 0.11, this.busSfx);   // bright electric crackle
      const t0 = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(1400 + (i % 5) * 120, t0);
      o.frequency.exponentialRampToValueAtTime(360, t0 + 0.10);        // fast descend = "zap"
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.075, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      o.connect(g); g.connect(this.busSfx);
      o.start(t0); o.stop(t0 + 0.14);
      o.onended = () => { try { o.disconnect(); g.disconnect(); } catch(e){} };
    },
    megaDischarge(){
      this.ensure();
      if(State.muted || !this.ctx) return;
      const t0 = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();   // low boom sweep
      o.type = 'sine'; o.frequency.setValueAtTime(185, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.5);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.34, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      o.connect(g); g.connect(this.busWin);
      o.start(t0); o.stop(t0 + 0.66); o.onended = () => { try { o.disconnect(); g.disconnect(); } catch(e){} };
      this._noise(0.4, 3200, 2, 0.17, this.busWin);                   // bright flash
      this._chord(523, [0, 7, 12], 0.7, 'triangle', 0.12, this.busWin, 0.02);   // shimmer chord
    },

    // ─── 7-TIER ADDITIVE WIN STACK ───
    // Each tier plays a chime, AND every previous tier's chime, with a
    // 280 ms stagger between layers. Tier-2 = single light glass-pop.
    // Tier-6 EPIC = full orchestra crash (5 layers, 1.4 s of build).
    // Drives the ducking automation on bus.music.
    win(tier){
      if(tier <= 1) return;     // RETURNED / no-win — silent (UKGC LDW)
      this.ensure();
      this._duckMusic(tier);
      // Prefer the ElevenLabs win-celebration SAMPLE matched to the win TYPE
      // (small/nice/big/mega/epic) so the sound fits the celebration; fall back to
      // the procedural orchestral stack only if it isn't decoded yet. (2026-06-09)
      const _wid = tier >= 6 ? 'win_epic' : tier >= 5 ? 'win_mega' : tier >= 4 ? 'win_big' : tier >= 3 ? 'win_nice' : 'win_small';
      if(this._playSample(_wid, 'busWin', 0.95)) return;
      // Layer schedule: [rootFreq, intervals, dur, type, vol, delay]
      const stack = [
        // Layer 0 — light glass pop (tier ≥ 2)
        { f: 880,  i: [0, 7, 12],         d: 0.55, w: 'triangle', v: 0.16, t: 0     },
        // Layer 1 — bright bell (tier ≥ 3)
        { f: 523,  i: [0, 7, 12, 16],     d: 0.90, w: 'triangle', v: 0.18, t: 0.30  },
        // Layer 2 — choir layer (tier ≥ 4)
        { f: 392,  i: [0, 4, 7, 12],      d: 1.40, w: 'sawtooth', v: 0.10, t: 0.55  },
        // Layer 3 — trumpet (tier ≥ 5 MEGA)
        { f: 294,  i: [0, 7, 12, 19],     d: 1.80, w: 'square',   v: 0.13, t: 0.85  },
        // Layer 4 — full orchestra crash (tier ≥ 6 EPIC)
        { f: 196,  i: [0, 5, 12, 17, 24], d: 2.40, w: 'sawtooth', v: 0.18, t: 1.20  },
      ];
      // Layer count per tier — additive stack
      const layerCount = Math.min(stack.length, tier - 1);
      for(let n = 0; n < layerCount; n++){
        const L = stack[n];
        this._chord(L.f, L.i, L.d, L.w, L.v, this.busWin, L.t);
      }
      // Noise sparkle on tier ≥ 4 — bright stardust
      if(tier >= 4) this._noise(0.4, 5000, 2, 0.05, this.busWin, 0.12);
      // Sub-bass impact on EPIC for that "screen-rumble felt by the chest"
      if(tier >= 6) this._voice(55, 0.6, 'sine', 0.28, this.busWin, 1.20);
    },
    // ── BEAT-1 ANTICIPATION — soft rising "charge" UNDER the count-up (2026-06-09)
    winAnticipate(tier){
      this.ensure();
      if(State.muted || !this.ctx) return;
      const t0 = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(180, t0);
      o.frequency.exponentialRampToValueAtTime(180 + tier*70, t0 + 0.34);   // tension rise
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.05 + tier*0.006, t0 + 0.30);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
      o.connect(g); g.connect(this.busWin);
      o.start(t0); o.stop(t0 + 0.44);
      o.onended = () => { try { o.disconnect(); g.disconnect(); } catch(e){} };
    },
    // ── BEAT-3 LANDING STING — the "ka-ching" hit on popT0 (2026-06-09). A bright
    // bell transient + crystalline noise burst + (tier≥5) a felt sub-thump, so the
    // visual landing flash and the audio impact land on the SAME frame.
    winLand(tier){
      this.ensure();
      if(State.muted || !this.ctx) return;
      this._voice(1318, 0.30, 'triangle', 0.16, this.busWin, 0);
      this._voice(1976, 0.22, 'sine',     0.10, this.busWin, 0.01);
      this._noise(0.22, 6000, 3, 0.06 + tier*0.006, this.busWin, 0);    // crystalline shimmer burst
      if(tier >= 5) this._voice(60, 0.34, 'sine', 0.22, this.busWin, 0);  // felt sub-thump on MEGA/EPIC
      this._duckMusic(tier|0);
    },

    // ─── WIN-LINE ENERGY ZING (2026-06-01) ───
    // Subtle rising "zing" as each win line traces in (the new energy-line VFX was
    // silent). Pitch climbs with the line index → multiple lines read as an ascending
    // arpeggio; brighter for longer wins. Sits UNDER the win-tier stack, never competes.
    winLine(idx, count){
      this.ensure();
      if(State.muted || !this.ctx) return;
      idx = idx | 0; count = count || 3;
      const t0 = this.ctx.currentTime;
      const base = 520 + idx * 70 + (count - 3) * 60;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(base, t0);
      o.frequency.exponentialRampToValueAtTime(base * 1.7, t0 + 0.12);   // sweep up
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.055, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g); g.connect(this.busSfx);
      o.start(t0); o.stop(t0 + 0.20);
      o.onended = () => { try { o.disconnect(); g.disconnect(); } catch(e){} };
      this._noise(0.09, 5200, 6, 0.022, this.busSfx);   // faint crystalline shimmer
    },

    // ─── FEATURE TRIGGER (portal sweep + impact) ───
    feature(){
      this.ensure();
      this._duckMusic(5);   // strong duck for the bonus reveal
      // Rising arpeggio (portal opens)
      const notes = [220, 277, 330, 392, 440, 523, 587, 659, 784, 880];
      notes.forEach((f, i) => this._voice(f, 0.20, 'triangle', 0.14, this.busWin, i * 0.055));
      // Impact crash at the end
      this._noise(0.45, 1200, 1.5, 0.18, this.busWin, 0.55);
      this._voice(82, 0.6, 'sine', 0.22, this.busWin, 0.55);     // sub-thump
    },

    // ── FS-ENTRY STINGS — one motif per tier, layered OVER feature() so every
    // bonus entry sounds distinct (slot-audio-engineer: per-tier motif, ducked,
    // gains kept under feature() so nothing clips). STANDARD = icy crystal bloom;
    // HOT = molten plasma ignition. MEGA keeps its bespoke megaCharge/Zap chain.
    fsCrystal(){
      this.ensure();
      // ascending icy arpeggio + a shimmering high chord + a crystalline ping
      const notes = [784, 988, 1175, 1568, 1976];
      notes.forEach((f, i) => this._voice(f, 0.26, 'triangle', 0.065, this.busWin, i * 0.07));
      this._chord(523, [0, 7, 12, 16, 19], 0.7, 'triangle', 0.045, this.busWin, 0.10);
      this._voice(2637, 0.18, 'sine', 0.04, this.busWin, 0.42);   // crystal ping
    },
    fsPlasma(){
      this.ensure();
      // low ignition whoosh (rising band-passed noise) + sub-heat + a brass swell
      this._noise(0.70, 480, 1.0, 0.10, this.busWin, 0.00);
      this._voice(58, 0.80, 'sawtooth', 0.10, this.busWin, 0.00); // sub heat
      const swell = [196, 261, 330, 392];
      swell.forEach((f, i) => this._voice(f, 0.40, 'sawtooth', 0.055, this.busWin, 0.12 + i * 0.06));
      this._noise(0.30, 1600, 1.4, 0.07, this.busWin, 0.30);      // ember crackle
    },

    // ─── RE-TRIGGER STING (+5 spins) ───
    retrigger(){
      this.ensure();
      this._duckMusic(4);
      // Cinematic 4-note "you got more" sting
      const ph = [659, 784, 988, 1175];
      ph.forEach((f, i) => this._voice(f, 0.28, 'triangle', 0.18, this.busWin, i * 0.10));
      this._chord(330, [0, 7, 12, 16], 0.5, 'sawtooth', 0.10, this.busWin, 0.30);
    },

    // ─── Scenario C: PITCH-SHIFT TALLY (coin count-up ladder) ───
    // The balance coin-up ticker calls tally() per visual step. The pip pitch
    // CLIMBS as the counter rolls — mechanical tension that scales with the win
    // multiplier. ≤2× stays flat (standard pitch); 2×–10× climbs; ≥40× drops a
    // 40 Hz sub-bass anchor and quiets the pips so the sub-bass reads (and ducks
    // the mid music under it). Throttled to ~60 ms so dense count-ups don't buzz.
    _tallyStep: 0, _tallyMult: 0, _tallyNext: 0,
    tallyStart(multX){
      this.ensure();
      this._tallyStep = 0; this._tallyMult = multX || 0; this._tallyNext = 0;
      if(multX >= 40 && this.ctx && !State.muted){
        this._voice(40, 1.1, 'sine', 0.32, this.busWin);   // sub-bass anchor (felt-not-heard)
        this._duckMusic(6);                                // suppress mid music under the sub
      }
    },
    tally(now){
      if(State.muted || !this.ctx) return;
      if(now < this._tallyNext) return;                    // ~60 ms throttle
      this._tallyNext = now + 60;
      const m = this._tallyMult, s = this._tallyStep++;
      let f = 560;                                         // flat standard pitch (≤2×)
      if(m > 2) f = Math.min(1180, 560 + s * (m >= 10 ? 36 : 24));   // climb on bigger wins
      // CUTE coin-pip — soft triangle body + a quiet octave-sine sparkle (bell/coin
      // feel) replaces the buzzy square; the pitch still climbs with the win size.
      const v = m >= 40 ? 0.05 : 0.075;
      this._voice(f,      0.05,  'triangle', v,         this.busSfx);
      this._voice(f * 2,  0.035, 'sine',     v * 0.45,  this.busSfx, 0.004);   // octave sparkle
    },

    // ─── Scenario D: SCATTER ANTICIPATION TENSION ───
    // 2 scatters have landed and the bonus-deciding reels are still crawling.
    // Drop the music to ~8 %, fire a 60 BPM sub-kick loop, and sweep the still-
    // spinning reel-rush filter up toward 8 kHz (rising whine). Held until
    // anticipationStop() fires when the reels resolve. Idempotent (safe to
    // double-call); the kick interval is always cleared on stop.
    _antiKick: null, _antiActive: false,
    anticipationStart(){
      this.ensure();
      if(!this.ctx || this._antiActive) return;
      this._antiActive = true;
      const t = this.ctx.currentTime;
      // 1. Music ducks hard so the kick + sweep own the moment
      if(this.busMusic){
        const g = this.busMusic.gain;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0.02, t + 0.10);
      }
      // 2. Rising filter sweep on the live reel-rush channel (→ 8 kHz tension whine)
      if(this.rushSource && this.rushSource.filt){
        const rf = this.rushSource.filt.frequency;
        rf.cancelScheduledValues(t); rf.setValueAtTime(Math.max(200, rf.value), t);
        rf.linearRampToValueAtTime(8000, t + 2.4);
      }
      // 3. 60 BPM sub-kick loop — punchy 110→45 Hz sine thump every 1000 ms
      const kick = () => {
        if(!this._antiActive || !this.ctx || State.muted) return;
        const k = this.ctx.currentTime;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(110, k);
        o.frequency.exponentialRampToValueAtTime(45, k + 0.14);
        g.gain.setValueAtTime(0.0001, k);
        g.gain.exponentialRampToValueAtTime(0.5, k + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, k + 0.30);
        o.connect(g); g.connect(this.busGameplay || this.master);
        o.start(k); o.stop(k + 0.34);
        o.onended = () => { try { o.disconnect(); g.disconnect(); } catch(e){} };
      };
      kick();
      this._antiKick = setInterval(kick, 1000);   // 60 BPM
    },
    anticipationStop(){
      if(this._antiKick){ clearInterval(this._antiKick); this._antiKick = null; }
      if(!this._antiActive) return;
      this._antiActive = false;
      if(this.ctx && this.busMusic){
        const t = this.ctx.currentTime;
        const g = this.busMusic.gain;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0.25, t + 0.5);   // restore music bed
      }
    },

    // ─── MUSIC: idle ambient bed + bonus-mode tracks ───
    // Looping background voice. Single voice with slow filter LFO and
    // gentle chord progression — sounds like the "expensive ambient pad"
    // of a real production track without sample assets.
    startIdleMusic(){
      if(this.musicId === 'idle') return;
      this._stopMusic();
      this.musicId = 'idle';
      // Prefer the ElevenLabs elegant master loop; fall back to the procedural
      // happy loop only if the sample isn't decoded yet (Stake single-file build).
      if(!this._playSampleMusic('main_base_loop', 0.9, 1.2)){
        this._startHappyLoop();
      }
    },
    startBonusMusic(mode){
      const id = mode === 'bonus_mega' ? 'bonus_mega'
               : mode === 'bonus_hot'  ? 'bonus_hot'
               : 'bonus_standard';
      if(this.musicId === id) return;
      this._stopMusic();
      // Prefer the ElevenLabs elegant free-spins master loop for ALL bonus tiers;
      // fall back to the per-tier procedural voice only if not decoded.
      if(!this._playSampleMusic('bonus_loop', 0.95, 1.0)){
        if(id === 'bonus_mega'){
          // Orchestral with timpani — deeper root, wider chord
          this._startMusicVoice(id, { root: 165, chord: [0, 5, 12, 17, 24], rate: 0.30, wave: 'sawtooth', vol: 0.16 });
        } else if(id === 'bonus_hot'){
          // Aggressive percussion + brass — square wave, mid root
          this._startMusicVoice(id, { root: 220, chord: [0, 4, 7, 12], rate: 0.45, wave: 'triangle', vol: 0.13 });
        } else {
          // Standard — uplifting major-key triangle pad
          this._startMusicVoice(id, { root: 261, chord: [0, 4, 7, 11], rate: 0.22, wave: 'triangle', vol: 0.14 });
        }
      }
      this.musicId = id;
    },
    endBonusMusic(){
      this._stopMusic();
      this.startIdleMusic();
    },
    _startMusicVoice(id, opts){
      if(!this.ctx) return;
      const t0 = this.ctx.currentTime;
      const voices = opts.chord.map(semis => {
        const o = this.ctx.createOscillator();
        o.type = opts.wave;
        o.frequency.value = opts.root * Math.pow(2, semis / 12);
        return o;
      });
      const lfo = this.ctx.createOscillator();   // slow filter LFO for movement
      lfo.type = 'sine'; lfo.frequency.value = opts.rate;
      const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 400;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 700; filt.Q.value = 1.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(opts.vol, t0 + 1.2);   // fade in 1.2s
      lfo.connect(lfoGain); lfoGain.connect(filt.frequency);
      voices.forEach(v => { v.connect(filt); v.start(t0); });
      filt.connect(g); g.connect(this.busMusic);
      lfo.start(t0);
      this.musicVoice = { voices, lfo, filt, gain: g };
    },
    // ── HAPPY PROCEDURAL CASINO LOOP (2026-05-30) — I-V-vi-IV progression
    // (C-G-Am-F) + bouncy triangle arpeggio + soft square melody + hi-hat
    // groove. No samples, no API key, Stake-ideal. Replaces the idle drone.
    _startHappyLoop(){
      if(!this.ctx) return;
      const ctx = this.ctx, bus = this.busMusic;
      const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
      const PROG = [ [60,64,67], [55,59,62], [57,60,64], [53,57,60] ]; // C G Am F
      const MEL  = [76,79,76,72, 74,71,74,67];
      const beat = 0.26;
      this._happyStep = 0;
      const note = (freq,t,dur,type,vol) => {
        const o=ctx.createOscillator(); o.type=type; o.frequency.value=freq;
        const g=ctx.createGain();
        g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(vol,t+0.012);
        g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
        o.connect(g); g.connect(bus); o.start(t); o.stop(t+dur+0.05);
      };
      const hat = (t,vol) => {
        const len=Math.floor(ctx.sampleRate*0.025); const b=ctx.createBuffer(1,len,ctx.sampleRate); const d=b.getChannelData(0);
        for(let i=0;i<len;i++) d[i]=(vrnd()*2-1)*Math.pow(1-i/len,4);  // vrnd, not Math.random (build W — only Math.random in file; trips the studio no-RNG governance grep)
        const s=ctx.createBufferSource(); s.buffer=b;
        const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=8000;
        const g=ctx.createGain(); g.gain.value=vol;
        s.connect(f); f.connect(g); g.connect(bus); s.start(t);
      };
      const tick = () => {
        if(this.musicId !== 'idle' || !this.ctx) return;
        const t = ctx.currentTime + 0.04, step = this._happyStep, chord = PROG[Math.floor(step/4) % 4];
        note(mtof(chord[step % 3] + 12), t, beat*0.85, 'triangle', 0.05);              // arpeggio
        if(step % 4 === 0) note(mtof(chord[0] - 12), t, beat*3.6, 'sine', 0.09);        // bass
        if(step % 2 === 0) note(mtof(MEL[(step>>1) % MEL.length] + 12), t, beat*1.5, 'square', 0.026); // melody
        hat(t, step % 2 ? 0.018 : 0.010);                                              // hi-hat
        this._happyStep = (step + 1) % 16;
        this._happyTimer = setTimeout(tick, beat*1000);
      };
      tick();
    },
    _stopMusic(){
      if(this._happyTimer){ clearTimeout(this._happyTimer); this._happyTimer = null; }
      this.musicId = null;   // stops the happy loop's tick()
      if(!this.musicVoice || !this.ctx) return;
      const { voices, lfo, gain } = this.musicVoice;
      const now = this.ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.linearRampToValueAtTime(0, now + 0.6);
      try {
        voices.forEach(v => v.stop(now + 0.7));
        lfo.stop(now + 0.7);
      } catch(e){}
      this.musicVoice = null;
      this.musicId = null;
    },
  };

  // ── ELEVENLABS SAMPLE LAYER (2026-06-08) ──────────────────────────────────
  // The synth above stays the Stake-safe fallback. When the shipped ElevenLabs
  // clips are loaded into Sound.buffers, the core event methods play the SAMPLE
  // instead (richer "master" audio). Loading is lazy (first gesture via ensure())
  // and never blocks. NOTE: for the single-file Stake build these mp3s must be
  // inlined (base64) by the packager (tracked follow-up); in dev they load from
  // /assets/audio/. Anything not wired here keeps its tuned procedural voice.
  Sound._playSample = function (id, busName, vol) {
    if (State.muted || !this.ctx) return false;
    const buf = this.buffers[id];
    if (!buf) return false;
    try {
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const g = this.ctx.createGain(); g.gain.value = vol == null ? 0.9 : vol;
      src.connect(g); g.connect(this[busName] || this.busSfx);
      src.start();
      src.onended = () => { try { src.disconnect(); g.disconnect(); } catch (e) {} };
      return true;
    } catch (e) { return false; }
  };
  // ── SAMPLE-BASED MUSIC (looping, crossfaded) — 2026-06-09 ──
  // Plays a decoded loop buffer on busMusic with a fade-in, stored in musicVoice
  // using the SAME shape _stopMusic tears down (voices[].stop / lfo.stop / gain
  // ramp). Returns false if the buffer isn't decoded yet → caller falls back to
  // the procedural synth loop. This is what finally PLAYS the ElevenLabs masters.
  // ── SEAMLESS-LOOP MAKER — some shipped loops (reel_loop) were exported with a
  // hard seam (start ≠ end) → a loud click every loop (measured: 0.38 / −8.5 dB).
  // Rebuild the buffer with an equal-power crossfade so end → start is continuous.
  // Verifiable: the seam jump drops from 0.38 to ~0 after processing.
  Sound._makeSeamless = function (buf, fadeSec) {
    try {
      if (!this.ctx || !buf) return buf;
      const sr = buf.sampleRate, ch = buf.numberOfChannels, n = buf.length;
      const F = Math.min(Math.floor(sr * (fadeSec || 0.12)), (n / 2) | 0);
      if (F < 8) return buf;
      const L = n - F;                                   // new seamless loop length
      const out = this.ctx.createBuffer(ch, L, sr);
      for (let c = 0; c < ch; c++) {
        const inD = buf.getChannelData(c), o = out.getChannelData(c);
        for (let i = 0; i < L; i++) {
          if (i < F) {
            const t = i / F, fi = Math.sin(t * Math.PI / 2), fo = Math.cos(t * Math.PI / 2);
            o[i] = inD[i] * fi + inD[i + L] * fo;        // head crossfaded with tail
          } else {
            o[i] = inD[i];
          }
        }
      }
      return out;
    } catch (e) { return buf; }
  };
  Sound._playSampleMusic = function (id, vol, fadeSec) {
    if (State.muted || !this.ctx || !this.busMusic) return false;
    const buf = this.buffers[id];
    if (!buf) return false;
    try {
      const t0 = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol == null ? 0.9 : vol, t0 + (fadeSec || 1.2));
      src.connect(g); g.connect(this.busMusic);
      src.start(t0);
      this.musicVoice = { voices: [src], lfo: { stop(){} }, filt: null, gain: g, _sample: true };
      return true;
    } catch (e) { return false; }
  };
  Sound.loadSamples = function () {
    if (this._samplesReq || !this.ctx) return;
    this._samplesReq = true;
    const decode = (ab) => new Promise((res, rej) => { try { this.ctx.decodeAudioData(ab, res, rej); } catch (e) { rej(e); } });
    fetch('assets/audio/manifest.json').then((r) => r.json()).then(async (m) => {
      for (const clip of (m.clips || [])) {
        try {
          const r = await fetch('assets/audio/' + clip.file);
          if (!r.ok) continue;
          this.buffers[clip.id] = await decode(await r.arrayBuffer());
          // De-click short looped SFX exported with a hard seam (reel_loop etc.)
          if (clip.loop && (clip.id === 'reel_loop' || clip.id === 'coin_cascade')) {
            this.buffers[clip.id] = this._makeSeamless(this.buffers[clip.id], 0.12);
          }
        } catch (e) { /* keep the synth fallback for this id */ }
      }
      // The intro tap fires startIdleMusic() BEFORE these ~400KB loops finish
      // decoding, so the player would keep hearing the procedural synth until the
      // next music transition. Once decoded, swap the still-playing synth fallback
      // to the now-available ElevenLabs sample loop seamlessly.
      // NB: the synth fallback (_startHappyLoop) is timer-based and never sets
      // musicVoice, so "not a sample" = !(musicVoice && musicVoice._sample).
      try {
        const playingSample = !!(this.musicVoice && this.musicVoice._sample);
        if (this.musicId === 'idle' && !playingSample) {
          this.musicId = null; this.startIdleMusic();
        } else if (this.musicId && this.musicId !== 'idle' && !playingSample) {
          const m2 = this.musicId; this.musicId = null; this.startBonusMusic(m2);
        }
      } catch (e) {}
    }).catch(() => { /* single-file / offline → synth fallback stays */ });
  };
  const _soundEnsure = Sound.ensure.bind(Sound);
  Sound.ensure = function () { _soundEnsure(); this.loadSamples(); };
  const _wrapSample = (name, id, bus, vol) => {
    if (typeof Sound[name] !== 'function') return;
    const orig = Sound[name].bind(Sound);
    Sound[name] = function (...a) {
      this.ensure();
      if (this._playSample(id, bus, vol)) {
        // preserve the synth's non-audio side-effects (the reel-rush loop)
        if (name === 'spinStart') this._startRush();
        if (name === 'reelStop' && a[0] === REELS - 1) this._stopRush();
        return;
      }
      return orig(...a);
    };
  };
  _wrapSample('click', 'ui_click', 'busSfx', 0.7);
  // spinStart — the shipped spin_start.mp3 is a HARSH METALLIC NOISE burst
  // (ZCR ~11900, hfRatio 0.64) the user disliked. We do NOT play that sample;
  // spinStart() keeps its soft procedural press-tick (mellow 840Hz triangle +
  // 440Hz sine) then the de-clicked, low-passed reel_loop whoosh. Re-enable the
  // wrap below to restore the recorded clip.
  // _wrapSample('spinStart', 'spin_start', 'busSfx', 0.5);   // disabled 2026-06-10 (metallic)
  // reelStop — turbo mode plays the snappier turbo_stop master, else reel_stop.
  // (Manual wrap instead of _wrapSample so the clip id can switch on State.turbo.)
  if (typeof Sound.reelStop === 'function') {
    const _origReelStop = Sound.reelStop.bind(Sound);
    Sound.reelStop = function (idx, topSym) {
      this.ensure();
      const id = State.turbo ? 'turbo_stop' : 'reel_stop';
      if (this._playSample(id, 'busSfx', 0.7)) {
        if (idx === REELS - 1) this._stopRush();
        return;
      }
      return _origReelStop(idx, topSym);
    };
  }
  _wrapSample('feature', 'bonus_intro', 'busWin', 0.95);
  _wrapSample('retrigger', 'retrigger', 'busWin', 0.9);
  if (typeof Sound.win === 'function') {
    const _win = Sound.win.bind(Sound);
    Sound.win = function (tier) {
      this.ensure();
      const id = ['', 'win_small', 'win_small', 'win_nice', 'win_big', 'win_mega', 'win_epic'][Math.min(6, tier | 0)] || 'win_small';
      if (this._playSample(id, 'busWin', 0.95)) { this._duckMusic(tier | 0); return; }
      return _win(tier);
    };
  }

  // ── BET TICK — dedicated bet-change sound (ui_bet master), throttled so a
  // rapid +/- hold ticks crisply without overlapping voices. Synth `tick` fallback.
  Sound.bet = function () {
    this.ensure();
    const t = (this.ctx && this.ctx.currentTime) || 0;
    if (this._lastBetAt && t - this._lastBetAt < 0.03) return;
    this._lastBetAt = t;
    if (this._playSample('ui_bet', 'busSfx', 0.6)) return;
    this.tick();
  };
  // ── EPIC SCATTER LAND — an escalating rising chime each time a STAR scatter
  // lands. Sample-first (scatter_tick per land, scatter_trigger on the 3rd =
  // bonus); procedural epic fallback = a bell stack + a fading-IN shimmer sweep
  // with the pitch climbing per scatter. Ducks the music on the trigger.
  Sound.scatterLand = function (n) {
    this.ensure();
    if (State.muted || !this.ctx) return;
    n = Math.max(1, n | 0);
    const id = n >= 3 ? 'scatter_trigger' : 'scatter_tick';
    if (this._playSample(id, 'busWin', 0.95)) { if (n >= 3) this._duckMusic(4); return; }
    const t0 = this.ctx.currentTime;
    const base = 523 * Math.pow(2, (Math.min(n, 6) - 1) * 0.18);   // pitch climbs per scatter
    [[base, 'triangle', 0.13], [base * 1.5, 'sine', 0.08], [base * 2, 'sine', 0.06]].forEach((v, i) => {
      const o = this.ctx.createOscillator(); o.type = v[1]; o.frequency.value = v[0];
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v[2], t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.85 + i * 0.1);
      o.connect(g); g.connect(this.busWin); o.start(t0); o.stop(t0 + 1.1);
    });
    const sw = this.ctx.createOscillator(); sw.type = 'sine';
    sw.frequency.setValueAtTime(base * 2, t0); sw.frequency.exponentialRampToValueAtTime(base * 4, t0 + 0.5);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t0); sg.gain.linearRampToValueAtTime(0.05, t0 + 0.28); sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
    sw.connect(sg); sg.connect(this.busWin); sw.start(t0); sw.stop(t0 + 0.8);
    if (n >= 3) this._duckMusic(4);   // bonus trigger — duck the music for impact
  };

  // ── DEV: expose Sound for audio debugging (localhost / ?debug only) ──
  try {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        || location.protocol === 'file:' || /[?&]debug=/.test(location.search)) {
      window.__SND = Sound;
    }
  } catch (e) {}
  // ── ROBUST AUDIO BOOTSTRAP (2026-06-10) — the ElevenLabs bank must start
  // loading on the FIRST user gesture ANYWHERE, not only the intro tap. A click
  // that misses the overlay (or any keydown) otherwise leaves the whole game on
  // the synth fallback. One-shot, capture-phase, self-removing.
  (function () {
    const kick = () => { try { Sound.ensure(); Sound.resume(); } catch (e) {} };
    const onGesture = () => {
      kick();
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
      window.removeEventListener('touchstart', onGesture, true);
    };
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
    window.addEventListener('touchstart', onGesture, true);
  })();

  // ── BET LOGIC ─────────────────────────────────────────────────
  function bumpBet(dir){
    if(State.phase !== Phase.IDLE) return;
    if(State.autoplay.active) return;   // P1-N: don't let +/- or Arrow keys change the stake mid-autoplay
    const newIdx = State.betIdx + dir;
    if(newIdx<0 || newIdx>=State.betLevels.length) return;
    State.betIdx = newIdx;
    State.betX6 = State.betLevels[State.betIdx];
    try { Sound.bet(); } catch(e){}   // dedicated bet-change tick (ui_bet master)
    updateHUD();
  }
  // Steppers that get a render-loop press-scale lerp (2026-05-31 — the
  // +/- had press-state slots but nothing drove them; user asked for the
  // steppers to feel "more dynamic + interactive"). Lerped in the ticker.
  const STEPPER_BTNS = [];
  function bindHoldable(sprite,onInc){
    let holdTimer=null, rapidTimer=null, interval=100;
    const release=() => {
      clearTimeout(holdTimer); clearTimeout(rapidTimer);
      holdTimer=rapidTimer=null; interval=100;
      sprite._pressed = false;
      sprite._targetScale = sprite._baseScale;        // spring back
    };
    sprite.eventMode='static'; sprite.cursor='pointer';
    sprite._pressed = false;
    sprite._baseScale = sprite.scale.x;
    sprite._displayScale = sprite.scale.x;
    sprite._targetScale = sprite.scale.x;
    STEPPER_BTNS.push(sprite);
    sprite.on('pointerdown', () => {
      // Don't react when disabled (at min/max) or mid-spin/autoplay.
      if(sprite._disabled || State.phase !== Phase.IDLE || State.autoplay.active) return;
      sprite._pressed = true;
      sprite._targetScale = sprite._baseScale * 0.86;  // Emil press dip
      try { Sound.click(); } catch(e){}
      onInc();
      holdTimer=setTimeout(function startRapid(){
        interval=100;
        (function fire(){ onInc(); rapidTimer=setTimeout(fire,Math.max(40,interval-=8)); })();
      },380);
    });
    // Hover lift on desktop (mouse only) — subtle affordance.
    sprite.on('pointerover', e => {
      if((!e || e.pointerType==null || e.pointerType==='mouse') && !sprite._pressed && !sprite._disabled)
        sprite._targetScale = sprite._baseScale * 1.08;
    });
    sprite.on('pointerout', () => { if(!sprite._pressed) sprite._targetScale = sprite._baseScale; });
    sprite.on('pointerup',release);
    sprite.on('pointerupoutside',release);
    sprite.on('pointercancel',release);
  }
  bindHoldable(minusBtn,() => bumpBet(-1));
  bindHoldable(plusBtn,() => bumpBet(1));
  // NOTE: layout() resets each stepper's _baseScale/_displayScale/_targetScale
  // to the freshly-fitted scale after fitW(), so the render-loop press lerp
  // always springs relative to the current responsive size.

  // ── BALANCE COIN-UP STATE (2026-05-27 AAA money deposit feel) ─────
  // When balance INCREASES (win credited), animate a count-up + brief
  // scale-pop on the balance value. When balance DECREASES (bet debit),
  // snap immediately — no celebration for losing money.
  const _balAnim = { fromX6: 0, toX6: 0, t0: 0, dur: 0, popT0: 0 };
  let _lastBalanceShownX6 = 0;
  function updateHUD(){
    const newBalX6 = State.balanceX6;
    if(newBalX6 !== _lastBalanceShownX6 && _lastBalanceShownX6 > 0 && !isReduced()){
      // Animate BOTH ways (2026-05-30): credit counts up + pops; debit counts
      // DOWN (quicker, no pop) so the player feels the cost of a losing spin.
      const isCredit = newBalX6 > _lastBalanceShownX6;
      _balAnim.fromX6 = _lastBalanceShownX6;
      _balAnim.toX6 = newBalX6;
      _balAnim.t0 = performance.now();
      _balAnim.dur = isCredit ? 700 : 450;
      if(isCredit){
        _balAnim.popT0 = performance.now();
        // Scenario C — the credit delta ÷ bet IS the win multiplier; arm the
        // pitch-shift tally so the count-up climbs in pitch with the win size.
        try { Sound.tallyStart((newBalX6 - _balAnim.fromX6) / Math.max(1, State.betX6)); } catch(e){}
      }
    } else {
      // First paint / reduced motion → snap
      _balAnim.t0 = 0;
      balValue.text = fmtMoney(newBalX6);
    }
    _lastBalanceShownX6 = newBalX6;
    betValue.text = fmtMoney(State.betX6);
    // SCALE-TO-FIT (2026-05-30): big bet numbers (high bets / big currencies
    // like JPY) overflowed the chip and crushed into the +/- steppers. Clamp
    // the value width so it shrinks to fit instead of overflowing.
    { const _bs = betValue._baseScale || betValue.scale.x; betValue.scale.set(_bs);
      const _bMax = 94; if(betValue.width > _bMax) betValue.scale.set(_bs * _bMax / betValue.width); }  // fits the FIXED chip box
    // (2026-05-31) REMOVED the relayout-on-bet-width-change: it made the +/-
    // steppers JUMP whenever the player changed the bet (user: "minus/plus buttons
    // changing places"). The stepper cluster is now a FIXED reserved width in
    // layout(), so the value box grows around a stable centre and the buttons
    // never move. (Value is scale-capped below so it always fits that box.)
    const broke = State.balanceX6 < State.betX6;
    if(broke !== spinBtnBroke){
      spinBtnBroke = broke;
      spinBtn.alpha = broke ? 0.5 : 1.0;
      spinBtn.tint = broke ? 0x4a4a4a : 0xffffff;
    }
    minusBtn.alpha = State.betIdx<=0 ? 0.4 : 1.0;
    plusBtn.alpha = State.betIdx>=State.betLevels.length-1 ? 0.4 : 1.0;
    // 2026-05-31 — flag disabled so bindHoldable ignores taps at min/max
    // (was: dimmed but still firing on click). Also kill the cursor hint.
    minusBtn._disabled = State.betIdx<=0;
    plusBtn._disabled  = State.betIdx>=State.betLevels.length-1;
    minusBtn.cursor = minusBtn._disabled ? 'default' : 'pointer';
    plusBtn.cursor  = plusBtn._disabled  ? 'default' : 'pointer';
    if(buyBar.visible){
      const canBuy = State.balanceX6 >= buyCostX6();
      buyBar.alpha = canBuy ? 1.0 : 0.45;
    }
    syncDeliveredBar();   // mirror balance/bet/affordability/steppers to the delivered portrait bar
  }
  // Animate balance count-up + pop (called from main ticker)
  function tickBalanceCoinUp(now){
    // Scale-to-fit factor for the BALANCE slot. Recomputed ONLY when the
    // displayed string changes (cheap) — long 8-decimal crypto strings
    // ("BTC 997.60000000") shrink to stay inside their slot instead of
    // overflowing into the WIN slot. _maxW is set per-layout (landscape bar).
    const _fitBal = () => {
      if(balValue.text !== balValue._lastFitTxt || balValue._fit == null){
        balValue._lastFitTxt = balValue.text;
        balValue.scale.set(1);                                   // measure at natural size
        balValue._fit = (balValue._maxW && balValue.width > balValue._maxW)
          ? balValue._maxW / balValue.width : 1;
      }
      return balValue._fit;
    };
    if(!_balAnim.t0) {
      // Idle — hold the fit scale (was a hard scale=1 that ignored _maxW → BTC overflow)
      const f = _fitBal();
      if(Math.abs(balValue.scale.x - f) > 0.001) balValue.scale.set(f);
      return;
    }
    const el = now - _balAnim.t0;
    const p = Math.min(1, el / _balAnim.dur);
    const ease = 1 - Math.pow(1 - p, 3);
    const curX6 = Math.round(_balAnim.fromX6 + (_balAnim.toX6 - _balAnim.fromX6) * ease);
    balValue.text = fmtMoney(curX6);
    // Scenario C — pitch-shift tally pip per count-up step (CREDIT only; the
    // throttle inside tally() keeps dense roll-ups from buzzing).
    if(_balAnim.toX6 > _balAnim.fromX6) { try { Sound.tally(now); } catch(e){} }
    const f = _fitBal();
    // Pop scale — 1.0 → 1.12 → 1.0 over 400ms (sin curve), multiplied by the fit
    const popEl = now - _balAnim.popT0;
    if(popEl < 400){
      const pp = popEl / 400;
      const popScale = 1 + Math.sin(pp * Math.PI) * 0.12;
      balValue.scale.set(f * popScale);
    } else {
      balValue.scale.set(f);
    }
    if(p >= 1){
      _balAnim.t0 = 0;
      balValue.text = fmtMoney(_balAnim.toX6);
    }
  }

  // ── LAYOUT (responsive — 7 Stake presets) ─────────────────────
  let GX=0, GY=0, GW=0, GH=0;     // grid rect
  function coverFit(s,w,h){
    const k = Math.max(w/s.texture.width, h/s.texture.height) * 1.04;
    s.scale.set(k);
  }
  function drawReelFrame(){
    // AAA separated reels — each column is its own frosted-glass panel with a
    // gap between them; NO outer border frame. The blurred hall (frostBg)
    // shows through each panel; the gaps reveal the sharp background.
    const gap = Math.max(6, CELL*0.055);
    const cw  = CELL - gap;
    const rad = Math.max(9, CELL*0.13);
    frostMask.clear();
    for(let r=0;r<REELS;r++)
      frostMask.roundRect(GX+r*CELL+gap/2, GY, cw, GH, rad).fill(0xffffff);
    frameG.clear();
    for(let r=0;r<REELS;r++){
      const x = GX+r*CELL+gap/2;
      // ── 2-COLOR SYSTEM — PINK outer bloom (was gold)
      // soft outer bloom — layered low-alpha strokes give a premium glow edge
      for(let g=4;g>=1;g--)
        frameG.roundRect(x-g*2.5, GY-g*2.5, cw+g*5, GH+g*5, rad+g*2.5)
          .stroke({ color:0xff8ab8, width:2.5, alpha:0.05 });
      // deep glass column panel — a rich dark surface so the symbols pop
      frameG.roundRect(x, GY, cw, GH, rad).fill({ color:0x140a20, alpha:0.72 });
      // inner vignette — the panel edges sink into shadow, centre reads clean
      for(let v=1;v<=3;v++)
        frameG.roundRect(x+v*4.5, GY+v*4.5, cw-v*9, GH-v*9, Math.max(2,rad-v*4.5))
          .stroke({ color:0x05020a, width:9, alpha:0.11 });
      // SMOKE-WHITE outer rim + soft PINK inner edge — 2-color system
      frameG.roundRect(x, GY, cw, GH, rad)
        .stroke({ color:0xf5f7fa, width:Math.max(2.5,CELL*0.02), alpha:0.55 });
      frameG.roundRect(x+3, GY+3, cw-6, GH-6, rad-3)
        .stroke({ color:0xff5a9c, width:1.6, alpha:0.35 });
      // ART-02 — beveled crystal bezel. Light-from-above read: bright top-inner
      // highlight band (~12% panel height) + deep bottom-inner shadow band +
      // 2 short diagonal facet glints top-left. Pure additive Graphics, no shader.
      {
        const _bevH = GH * 0.12;
        for(let i = 1; i <= 4; i++){
          frameG.roundRect(x + 4, GY + 4 + (i-1)*1.5, cw - 8, _bevH * (1.05 - i*0.18), Math.max(2, rad - 4))
            .fill({ color: 0xf5f7fa, alpha: 0.06 - i*0.012 });
        }
        for(let i = 1; i <= 3; i++){
          frameG.rect(x + 4, GY + GH - _bevH - (i-1)*2, cw - 8, _bevH * 0.65)
            .fill({ color: 0x05020a, alpha: 0.08 - i*0.015 });
        }
        for(let g = 0; g < 2; g++){
          const _gx = x + 6 + g * cw * 0.18 + vrnd() * 4;
          const _gy = GY + 6 + g * 4 + vrnd() * 6;
          const _gl = 14 + vrnd() * 12;
          frameG.moveTo(_gx, _gy).lineTo(_gx + _gl * 0.75, _gy + _gl * 0.4)
            .stroke({ color: 0xfff4fb, width: 1.2, alpha: 0.18 });
        }
      }
    }
    // (corner heart-jewel ornaments drawn by drawCornerJewels on every
    // frame — kept separate so they can pulse without redrawing the
    // heavy per-column glass panels)
    // ── REEL-GRID OUTER HALO — single very-soft PINK contour unifies
    // the 5 columns into ONE composition (without re-introducing a hard
    // outer border). 2-color system: PINK accent only.
    const haloPad = gap*0.9;
    const haloR   = rad + haloPad;
    for(let g=3;g>=1;g--){
      frameG.roundRect(GX - haloPad - g*1.5, GY - haloPad - g*1.5,
                       GW + 2*(haloPad + g*1.5), GH + 2*(haloPad + g*1.5), haloR + g*1.5)
        .stroke({ color:0xff5a9c, width:1.4, alpha:0.05 });
    }
    frameTopG.clear();
  }
  // rounded-rect perimeter point — t walks clockwise from the top edge.
  function rrPerim(t,x,y,w,h,r){
    const sw=Math.max(0,w-2*r), sh=Math.max(0,h-2*r), cor=Math.PI*r/2;
    const tot=2*sw+2*sh+4*cor; let d=(((t%1)+1)%1)*tot;
    if(d<sw) return {x:x+r+d,y:y};
    d-=sw; if(d<cor){ const a=-Math.PI/2+d/r; return {x:x+w-r+r*Math.cos(a),y:y+r+r*Math.sin(a)}; }
    d-=cor; if(d<sh) return {x:x+w,y:y+r+d};
    d-=sh; if(d<cor){ const a=d/r; return {x:x+w-r+r*Math.cos(a),y:y+h-r+r*Math.sin(a)}; }
    d-=cor; if(d<sw) return {x:x+w-r-d,y:y+h};
    d-=sw; if(d<cor){ const a=Math.PI/2+d/r; return {x:x+r+r*Math.cos(a),y:y+h-r+r*Math.sin(a)}; }
    d-=cor; if(d<sh) return {x:x,y:y+h-r-d};
    d-=sh; const a=Math.PI+d/r; return {x:x+r+r*Math.cos(a),y:y+r+r*Math.sin(a)};
  }
  // ── PORTAL EFFECT — every reel column is a living portal: a pulsing layered
  // energy rim plus bright sparks circulating its perimeter, drawn additively
  // on top so symbols read as emerging THROUGH the portal. Energises while the
  // reels spin; collapses to a calm static glow under reduced-motion.
  let _portalEnv = 0;
  function drawPortal(now){
    frameTopG.clear();
    if(!(GW>0)) return;
    // PORTAL ENERGY runs ONLY during the free-spins / buy-bonus feature — it
    // marks the bonus realm. The envelope eases it in/out so it never pops at
    // the feature boundary; the base game keeps clean, calm reels.
    const want = (State.phase===Phase.FREESPIN) ? 1 : 0;
    _portalEnv += (want - _portalEnv) * 0.08;
    if(_portalEnv < 0.012) return;
    const env=_portalEnv, reduced=isReduced();
    const gap=Math.max(6,CELL*0.055), cw=CELL-gap, rad=Math.max(9,CELL*0.13);
    const spinning=allReelsSpinning;
    for(let r=0;r<REELS;r++){
      const x=GX+r*CELL+gap/2, ph=r*1.7;
      const pulse=reduced?0.6:0.5+0.5*Math.sin(now*0.0026+ph);
      const lvl=(spinning?0.5:0.32)+pulse*(spinning?0.42:0.3);
      frameTopG.roundRect(x-3,GY-3,cw+6,GH+6,rad+3).stroke({color:0xff8ad8,width:9,alpha:(0.05+0.07*lvl)*env});
      frameTopG.roundRect(x,GY,cw,GH,rad).stroke({color:0xff8ad8,width:4,alpha:(0.09+0.16*lvl)*env});   // crystal pink (was warm peach 0xffd9a0)
      frameTopG.roundRect(x+1.5,GY+1.5,cw-3,GH-3,Math.max(2,rad-1.5)).stroke({color:0xfff4fb,width:1.6,alpha:(0.10+0.22*lvl)*env});   // cool crystal-white glint (was warm cream 0xfff2d8)
      if(reduced) continue;
      const speed=spinning?0.00042:0.00019;
      for(let n=0;n<2;n++){
        const p=rrPerim(now*speed+ph*0.13+n*0.5,x,GY,cw,GH,rad);
        const tw=(0.7+0.3*Math.sin(now*0.011+n*3+ph))*env;
        frameTopG.circle(p.x,p.y,13).fill({color:0xff7ad0,alpha:0.10*tw});
        frameTopG.circle(p.x,p.y,6).fill({color:0xffe1b0,alpha:0.5*tw});
        frameTopG.circle(p.x,p.y,2.4).fill({color:0xffffff,alpha:0.95*tw});
      }
    }
  }
  // ── SPIN BUTTON HALO — an additive energy ring around the spin button:
  // a soft breathing glow at rest, three bright sparks orbiting while the
  // reels spin. Redrawn every frame for buttery motion at any refresh rate.
  // ── BUTTON AURAS (UI verse / 21st.dev tier breathing glow on active)
  // Additive-blend rings under active buttons — sin-wave pulse at 4Hz.
  // Skipped under prefers-reduced-motion. Drawn each frame on btnAuraG
  // (cleared first). Used by: turbo MAX, autoplay running, BUY BONUS
  // affordable (commercial pull).
  function drawBtnAuras(now){
    btnAuraG.clear();
    // Per user feedback "TURBO/AUTOPLAY/SPIN overlapping" — the colored
    // halo rings on TURBO + AUTOPLAY were leaking outside their chip
    // footprint and visually colliding with adjacent chips. They're
    // also REDUNDANT — TURBO already shows mode via dot badges and
    // AUTOPLAY already shows the countdown number. Both rings removed.
    // BUY BONUS keeps its breathing halo (commercial CTA pull) but in
    // villain neon-magenta instead of gold.
    if(isReduced()) return;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.0044);    // 4Hz breathing
    if(buyBar.visible && buyBar._inlineW && State.phase === Phase.IDLE){
      const affordable = State.balanceX6 >= buyCostX6();
      if(affordable){
        const bx = buyBar.position.x, by = buyBar.position.y;
        const bw = buyBar._inlineW, bh = buyBar._inlineH;
        const br = Math.min(bh*0.32, 14);
        btnAuraG.roundRect(bx - 4, by - 4, bw + 8, bh + 8, br + 3)
          .stroke({ color: 0xe9bf5a, width: 1.8, alpha: 0.18 + 0.32 * pulse });
      }
    }
  }

  // ── CORNER HEART-JEWEL ORNAMENTS — pulsing brand reinforcement at the
  // 4 outer corners of the reel grid. SHINING POP DNA — heart-jewel
  // sparkles that gently breathe (sin-wave alpha + scale, 4-second
  // cycle, 0.85 ↔ 1.05 range). Each corner has its own phase offset so
  // the 4 jewels twinkle in a soft round-robin rather than pulsing in
  // unison (more cinematic, less mechanical).
  function drawCornerJewels(now){
    cornerJewelsG.clear();
    if(!CELL) return;
    const reduced = isReduced();
    const cornerR = Math.max(7, CELL*0.10);
    const gap = Math.max(6, CELL*0.055);
    const cornerInset = -gap*0.6;
    const corners = [
      { x: GX + cornerInset,         y: GY + cornerInset,         ph: 0    },
      { x: GX + GW - cornerInset,    y: GY + cornerInset,         ph: 0.5  },
      { x: GX + cornerInset,         y: GY + GH - cornerInset,    ph: 1.0  },
      { x: GX + GW - cornerInset,    y: GY + GH - cornerInset,    ph: 1.5  },
    ];
    for(const c of corners){
      // breathing — 4-second cycle (0.00157 rad/ms), phase-offset per
      // corner. Pulse = 0..1, normalised. Reduced motion = static.
      const pulse = reduced ? 0.5 : (Math.sin(now*0.00157 + c.ph) + 1) * 0.5;
      const scale = 0.85 + 0.20*pulse;     // 0.85..1.05
      const aBoost = 0.80 + 0.20*pulse;    // alpha modulation
      const r = cornerR * scale;
      // ── 2-COLOR SYSTEM — pink halo + smoke-white diamond base
      // (was gold). Unifies the brand DNA with the BUY BONUS pill and
      // the rest of the betting panel.
      // outer halo — soft PINK bloom (3 layered low-alpha circles)
      for(let g=3;g>=1;g--){
        cornerJewelsG.circle(c.x, c.y, r*(0.9 + g*0.55))
          .fill({ color:0xff5a9c, alpha: (0.05 + g*0.025) * aBoost });
      }
      // 4-point SMOKE_W diamond base — neutral anchor (no more gold)
      const s = r*0.95;
      cornerJewelsG.poly([c.x, c.y-s,  c.x+s*0.42, c.y,  c.x, c.y+s,  c.x-s*0.42, c.y])
        .fill({ color:0xf5f7fa, alpha:0.85*aBoost })
        .stroke({ color:0xff8ab8, width:0.8, alpha:0.55*aBoost });
      // inner PINK heart-jewel core dot — brand DNA
      cornerJewelsG.circle(c.x, c.y, r*0.32)
        .fill({ color:0xff5a9c, alpha:0.98 });
      // bright SMOKE_W highlight pip (top-left — light source)
      cornerJewelsG.circle(c.x - r*0.10, c.y - r*0.12, r*0.11)
        .fill({ color:0xffffff, alpha:0.90 });
    }
  }

  function drawSpinHalo(now){
    spinHalo.clear();
    if(!spinBtn._baseScale) return;
    const reduced=isReduced();
    const cx=spinBtn.x, cy=spinBtn.y, R=spinBtn.width*0.5;
    const spinning=allReelsSpinning;
    // ── NO IDLE HALO — per pro UX evaluation
    // The breathing gold halo at R×1.16 bleeds 5 px into the adjacent
    // chips on a 64-px SPIN button at portrait. Removing it eliminates
    // the collision entirely. The chip itself + the icon glyph + the
    // chip's white top-crescent are enough to communicate "primary CTA".
    // During SPIN we draw a TIGHT inside-the-chip pulse (R×0.92) so the
    // active state is visible without crossing the chip's outer edge.
    if(spinning && !reduced){
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
      // ── 2-COLOR SYSTEM — pulse + sparkles unified PINK + SMOKE_W
      // (was gold). Inside-chip pulse ring — stays clear of adjacent chips
      spinHalo.circle(cx, cy, R * 0.92)
        .stroke({ color:0xe2ba5e, width:1.8, alpha: 0.55 + 0.30 * pulse });
      // REMOVED (2026-05-30): the 3 orbiting sparkle dots read as random
      // off-center "bubbles" inside the SPIN chip. The clean centered pulse
      // ring above is enough to signal the active spin state.
    }
  }
  // safe-area insets — notch / Dynamic Island / Android gesture nav
  function readInsets(){
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => { const x = parseFloat(cs.getPropertyValue(n)); return isFinite(x) ? x : 0; };
    return { t:v('--sat'), r:v('--sar'), b:v('--sab'), l:v('--sal') };
  }
  function layout(){
    const W=app.screen.width, H=app.screen.height;
    const portrait = H > W*1.05;
    const tiny = H < 330;   // genuinely short viewports only (Popout S) — a tall phone is NOT tiny
    try { layoutBuyFab(); } catch(e){}   // reposition the floating Buy Bonus button per preset
    // 25 px breathing room on every edge for normal viewports; Popout S (tiny)
    // keeps a slim margin — 25 px all-round would crush a 225 px-tall window.
    // Portrait gets EXTRA bottom padding (award-tier audit #7) — the spin
    // button needs to sit in the natural thumb arc, not flush against the
    // home indicator. Fitts' Law applied to mobile slot ergonomics.
    // Bumped landscape padding 25 → 28 so the spin button (which hugs the
    // right edge of the bar) never gets visually cropped by the viewport
    // edge or by overlapping shadow.
    const hudPad = tiny ? 6 : 28;
    // Portrait padB tuned down from 32 → 24 so the reels get more room.
    // Spin button still sits above the iOS home indicator via env(safe-area).
    const hudBot = tiny ? 7 : (portrait ? 24 : 25);
    // fold safe-area insets into the HUD edge padding
    const INS = readInsets();
    const padL = hudPad + INS.l, padR = hudPad + INS.r;
    const padB = hudBot + INS.b, padT = (tiny?4:25) + INS.t;

    // ── DELIVERED BAR — dock + measure FIRST ─────────────────────────────────
    // The delivered component IS the bottom bar: BettingBarMobile in PORTRAIT,
    // BettingBarWeb in LANDSCAPE. We dock the active one now (it depends only on
    // W/H) so its on-screen top (barTopY) is known BEFORE the reel board is
    // sized — the board's bottom is then clamped above it so symbols never
    // overlap the mounted bar. A small pad keeps a visible gutter.
    // Replay mode locks ALL controls via runReplay() (which disables the NATIVE
    // bar objects); use the native bar there so the lock stays authoritative.
    const usingDeliveredBar    = !!(portrait && deliveredBar && !STAKE.replay);
    const usingDeliveredBarWeb = !!(!portrait && deliveredBarWeb && !STAKE.replay);
    let deliveredBarTopY = 0;
    if(usingDeliveredBar){
      const fb = deliveredBar.fitBottom(W, H);
      deliveredBarTopY = fb.barTopY;
    } else if(usingDeliveredBarWeb){
      const fb = deliveredBarWeb.fitBottom(W, H);
      deliveredBarTopY = fb.barTopY;
    }
    // True whenever EITHER delivered bar owns the bottom — drives the shared
    // reel-board bottom reservation + hard clamp below.
    const usingDeliveredAny = usingDeliveredBar || usingDeliveredBarWeb;
    const DELIVERED_BAR_PAD = tiny ? 8 : 14;   // gutter between reels and the mounted bar

    bg.position.set(W/2,H/2); coverFit(bg,W,H);
    frostBg.position.set(W/2,H/2); coverFit(frostBg,W,H);
    // Cache the base scale set by coverFit() so the modal-open zoom push
    // can multiply on top of it without losing the cover-fit math.
    bg._baseScale = bg.scale.x;
    frostBg._baseScale = frostBg.scale.x;
    vignette.position.set(W/2,H/2);
    // ART-04 — coverFit (uniform scale) instead of independent x/y. The texture is
    // natively 16:9 so the pool's circular falloff stays a circle on landscape
    // presets; portrait presets crop the sides slightly (intentional — keeps the
    // top-down light read consistent everywhere).
    coverFit(vignette, W, H);
    drawModalScrim(); // ART-05 — depends on screen dimensions

    // reserve space: top (logo), bottom (bet/spin/HUD).
    // 2026-05-27 PASS 2 — user screenshot showed reels cramped against the
    // bar with a big empty space above. The landscape topRes (90) was too
    // tight to read as "padding above reels" + the botRes (100) didn't
    // account for the actual bar height (barH=88 + padB=25 = 113). Result:
    // reels grew to fill all available height and overlapped the bar.
    // FIX: balance topRes (90 → 100 — small but enough above-reels gap)
    // and bump botRes (100 → 140 — leaves clean 40 px between reels and
    // bar). Also cap CELL at 180 (was 210) so reels don't max out and
    // visually overflow on tall web viewports.
    const topRes = portrait ? (tiny?56:140) : (tiny?40:100);
    // With a delivered bar (mobile in portrait, web in landscape): reserve the
    // bottom region from the bar's measured on-screen top (+ a gutter) so the
    // reel board sits cleanly ABOVE the mounted bar. Otherwise use the original
    // native-bar reservations. Floor differs by orientation (the web bar is
    // shorter than the 2-row mobile bar, so landscape needs a smaller floor).
    const botRes = usingDeliveredAny
      ? Math.max(portrait ? (tiny?160:220) : (tiny?80:140), (H - deliveredBarTopY) + DELIVERED_BAR_PAD)
      : (portrait ? (tiny?160:220) : (tiny?80:140));
    // Landscape grid widens too — 0.78 → 0.88 — reels feel more present.
    const gridMaxW = W * (portrait ? 0.96 : (tiny?0.72:0.88));
    // tiny: reserve a 10 px gap so the grid can NEVER touch/overlap the bar
    // (Popout S overlap fix, 2026-06-01).
    const gridMaxH = (H - topRes - botRes) - (tiny ? 10 : 0);
    // Lower CELL cap on landscape — 210 → 180 keeps symbols readable
    // without filling the entire viewport.
    const cellCap = portrait ? 210 : 180;
    // tiny floor 20 (was a hard 34): on Popout S the height constraint is ~31,
    // and a 34 floor forced GH (3×34=102) past the ~93 px available → the reels
    // overran the bar. 20 lets the height constraint win so the grid always fits.
    CELL = Math.max(tiny ? 20 : 34, Math.min(gridMaxW/REELS, gridMaxH/ROWS, cellCap));
    GW = CELL*REELS; GH = CELL*ROWS;
    GX = (W-GW)/2;
    GY = topRes + (H-topRes-botRes-GH)/2;
    if(GY < topRes*0.5) GY = topRes*0.5;
    // Hard clamp: with the delivered portrait bar, never let the board's BOTTOM
    // edge cross into the mounted bar — push the board up if re-centering placed
    // it too low (belt-and-suspenders alongside the botRes reservation above).
    if(usingDeliveredAny){
      const maxBottom = deliveredBarTopY - DELIVERED_BAR_PAD;
      if(GY + GH > maxBottom) GY = Math.max(topRes*0.5, maxBottom - GH);
    }

    reelMask.clear().rect(GX,GY,GW,GH).fill(0xffffff);
    drawReelFrame();
    reelArea.position.set(0,0);
    swipeZone.hitArea = new PIXI.Rectangle(GX,GY,GW,GH);   // swipe-to-spin zone

    // reels + symbol cells
    for(let r=0;r<REELS;r++){
      const rl=reels[r];
      rl.col.position.set(GX+r*CELL+CELL/2, GY);
      const sz=CELL*0.9;
      rl.sprites.forEach((s,k) => {
        s.width=sz; s.height=sz;
        s.x=0; s.y=(k-0.5)*CELL + rl.offset;
      });
    }
    // Sticky-crown overlay sprites snap to the current grid (MEGA bonus only)
    layoutStickySprites();

    // ── LOGO POSITIONING ──────────────────────────────────────────────
    // Portrait: centered top band (the wordmark sits across the full width
    // above the reels, classic slot header)
    // Landscape (desktop): TOP-LEFT BADGE — anchored to the upper-left
    // corner, sized to fit a ~80px tall slot, reels become hero. Per user
    // brief 2026-05-27 "in desktop mode the logo need left top positioning
    // for the reels not smaller in vertical logo is also not need for the
    // dynamic many small elegant effect idel".
    const framePadT = Math.max(8, CELL*0.13);
    if(portrait){
      // PORTRAIT — centered top band (unchanged)
      // 2026-06: more compact mobile logo (user: "logo ~2x smaller" — it was the
      // full top band -> ~56% screen width, too dominant on phones). ~62% of the
      // band + a tighter width cap -> ~35% width, so the reels read as the hero.
      const logoBandH = (topRes - (tiny?10:16)) * 0.62;
      const lk = Math.min(logoBandH / logo.texture.height,
                          Math.min(GW*0.70, W*0.56, 480) / logo.texture.width);
      logo.scale.set(lk);
      logo.position.set(W/2, Math.max(logo.height*0.5+2,
                        GY - framePadT - logo.height*0.5 - (tiny?1:4)));
      logo._baseY = logo.y;
      logo._homeX = logo.x;
    } else {
      // LANDSCAPE — top-left badge anchor
      // Logo height = min(72px tall, fit in topRes-12px). Width follows
      // texture aspect — so the wordmark stays readable but compact.
      const logoH = Math.min(72, topRes - 12);
      // Badge cap: never exceed ~10% of screen width. Was height-pinned only (a
      // constant px width), so its WIDTH fraction ballooned on narrow/medium
      // landscapes (~17% at 550px) and grew with the wider candy logo (AR 1.595).
      // Take the SMALLER of the height-fit and a 10%-of-width cap -> ~8% on
      // desktop, <=10% everywhere. (user 2026-06-05: "logo too big; ~10% at max")
      const lk = Math.min(logoH / logo.texture.height, (W * 0.10) / logo.texture.width);
      logo.scale.set(lk);
      // Anchor (0.5, 0.5) by default — position so the LEFT edge sits at
      // padL+10, the TOP edge at padT+8.
      const lW = logo.width;
      logo.position.set(padL + 10 + lW * 0.5,
                        padT + 8  + logoH * 0.5);
      logo._baseY = logo.y;
      logo._homeX = logo.x;
    }
    // MAX-WIN caption — advertised cap shown in-gameplay. Portrait: floats in
    // the empty band ABOVE the wordmark. Landscape: sits just under the
    // top-left logo badge. Both are dead space → no HUD/scroll impact.
    if(typeof maxWinCap !== 'undefined'){
      maxWinCap.scale.set(portrait ? (tiny?0.82:1) : 0.92);
      if(portrait) maxWinCap.position.set(W/2, Math.max(11, logo.y - logo.height*0.5 - 7));
      else maxWinCap.position.set(logo.x, logo.y + logo.height*0.5 + 10);
      maxWinCap.visible = !STAKE.replay;
    }

    // HUD scale
    const hudK = Math.min(1.12, Math.max(tiny?0.5:0.62, W/1120));

    // ── AAA REFERENCE BOTTOM BAR ─────────────────────────────────
    // Reference (Waylanders Forge / Hacksaw): one dark rounded bar holds
    // BUY BONUS · BALANCE label+value · BET label+value · vertical ± stack
    // · big white SPIN circle · small autoplay circle. Utility icons
    // (info / settings / sound) live in a separate column OUTSIDE the bar
    // on the left so the bar reads as pure gameplay. Fullscreen / history /
    // stats are removed entirely. Turbo lives in the settings drawer.
    balPlaque.visible = false;
    betPlaque.visible = false;
    winPlaque.visible = false;
    // WIN value is a permanent HUD slot — shows LAST WIN between rounds,
    // tier-coloured + bright on an actual win (set in flashWinValue).
    // First-time-play case: lastWinX6 = 0 → "WIN $0.00" until first hit.
    if(!winValue.text) {
      // Pre-play: before the FIRST spin, show a neutral placeholder, NOT "$0.00"
      // (user: "why show WIN 0 when the player isn't playing?"). "—" keeps the slot
      // labeled + non-blank (never NaN) without the off-putting zero; after the
      // first spin the WIN slot shows the real LAST WIN / WIN value as before.
      const neverPlayed = ((State.stats && State.stats.spins) || 0) === 0 && !((State.lastWinX6 || 0) > 0);
      winValue.text = neverPlayed ? '—' : fmtMoney(State.lastWinX6 || 0);
      winValue.style.fill = THEME.colors.textMuted;
      winLabel.text = socialFilter((State.lastWinX6 || 0) > 0 ? 'LAST WIN' : 'WIN');
    }
    winLabel.alpha = 1; winValue.alpha = 1;

    // ── BAR MOUNT BRANCH ─────────────────────────────────────────────────────
    // The delivered component IS the bottom bar: BettingBarMobile in PORTRAIT,
    // BettingBarWeb in LANDSCAPE. The active branch hides ALL native bar visuals
    // + controls, docks + shows ITS component (already fitBottom()-measured
    // above), pushes state to it, and SKIPS the native bar draw below. Each
    // branch toggles BOTH delivered bars' visibility so the portrait↔landscape
    // switch is clean on every resize. REPLAY (or no component): restore the
    // native bar object set and run the existing conformed layout EXACTLY as before.
    if(usingDeliveredBar){
      if(deliveredBarWeb) deliveredBarWeb.visible = false;   // portrait: web bar hidden
      setNativeBarVisible(false);     // hide+disable every native bar object
      bottomBarBg.clear();            // wipe any stale native bar surface
      deliveredBar.visible = true;
      deliveredBar.fitBottom(W, H);   // dock to screen bottom (width-fit)
      syncDeliveredBar();             // push balance/bet/win/states once per layout
    } else if(usingDeliveredBarWeb){
      if(deliveredBar) deliveredBar.visible = false;         // landscape: mobile bar hidden
      setNativeBarVisible(false);     // hide+disable every native bar object
      bottomBarBg.clear();            // wipe any stale native bar surface
      deliveredBarWeb.visible = true;
      deliveredBarWeb.fitBottom(W, H);   // dock to screen bottom (width-fit)
      syncDeliveredBar();             // push balance/bet/win/states + bet cells once per layout
    } else {
    if(deliveredBar) deliveredBar.visible = false;      // native fallback: both components hidden
    if(deliveredBarWeb) deliveredBarWeb.visible = false;
    setNativeBarVisible(true);        // restore native bar (visibility + eventMode)

    // ── BAR SIZING — portrait gets TWO ROWS (top: text, bottom: buttons)
    // so 320-425px wide viewports stop overlapping. Landscape stays 1 row.
    // WCAG 2.5.5: every tap target ≥44×44 CSS px.
    const barH    = portrait
      ? (tiny ? 110 : 120)                    // 2-row tall bar on portrait (was 158, reels were cramped)
      : (tiny ? 60 : 88);                     // 1-row bar on landscape
    const barW    = Math.min(W - padL - padR, portrait ? W*0.96 : (tiny?W*0.94:980));
    const barX    = (W - barW) / 2;
    const barY    = H - padB - barH;
    const barR    = portrait ? 18 : barH * 0.36;
    // On portrait, spin sits in the bottom row alongside other buttons.
    // Cap spinSz so the row's 4 buttons + 6px gaps actually fit at 320×568:
    //   row2 width = minus(47) + 12 + plus(47) + 12 + autoplay(52) + 12 +
    //                spin + edge(14) + barX margin
    //   minus starts at barX + 18, so spin <= barW - 18 - 47 - 12 - 47 - 12 -
    //                52 - 12 - 14 = barW - 214
    // Portrait sizing — compact 6-element row 2: − BET + | TURBO | AUTO | SPIN
    // Halo removed (idle), so SPIN can stay big without colliding.
    // 2026-05-27 — SPIN dominance boost #2 per user "spin button more dominant
    // in the betting part and its about the scale some". Portrait 68 → 78
    // (+15%) which still keeps the 4-button row fitting at 320×568 (the gap
    // formula leaves 222 px for the row, so SPIN ≤ 90 is fine). Landscape
    // 128 → 148 — clearly the hero CTA on the bar.
    const portraitSpinMaxFromGaps = portrait ? Math.max(70, (barW * 0.98) - 205) : Infinity;
    const spinSz  = portrait
      ? Math.min(barW * 0.26, 94, portraitSpinMaxFromGaps)   // bigger, DOMINANT spin on mobile (user)
      // landscape: the 1.62×barH spin intentionally bulges out of the bar, but on
      // Popout S (bar at the very bottom, padB≈7) the bulge ran the spin button's
      // bottom OFF-SCREEN (cropped ~8px). Cap it so the whole button fits: its
      // bottom = barY+barH/2+spinSz/2 ≤ H ⇒ spinSz ≤ barH + 2·padB. (2026-06-01)
      // RESP-03 — explicit viewport floor: clamp spin button so even its shadow stays
      // within the viewport (was clipping 4-8px of shadow at Popout S 400x225).
      : Math.min(barH * 1.62, W * 0.18, 148, tiny ? (barH + 2 * padB - 10) : Infinity, Math.max(48, 2 * (H - barY - barH/2 - Math.max(4, padB))));
    // Tiny landscape (Popout S 400×225, bar ~60px tall) can't fit two 44px
    // steppers stacked vertically + WCAG ≥44px floor. Drop the floor in
    // tiny landscape ONLY — Stake's own slots make smaller buttons here
    // for the same reason. Hit-area expanded below to compensate.
    const utilSz  = (tiny && !portrait)
      ? Math.max(28, Math.min(barH * 0.50, 38))
      : portrait
        ? 40   // compact for portrait so 6 chips fit row 2 cleanly
        : Math.max(44, Math.min(barH * 0.34, 52));
    const stepSz  = (tiny && !portrait)
      ? Math.max(22, Math.min(barH * 0.40, 28))
      : portrait
        ? 40   // compact for portrait — same as utilSz for visual unity
        : Math.max(44, Math.min(barH * 0.30, 48));
    // SCALE-COMPENSATED STEPPER HIT AREA (2026-06 fix) — minus/plusBtn are sprites
    // fitW()-scaled to ~0.1x, so a raw local 52px hitArea renders to ~8px on screen
    // ("can't tap +/-"). Size the LOCAL rect = target/scale so the SCREEN tap target
    // is >=48px (stepSz+14 padding) on every preset. Call AFTER fitW(b, stepSz).
    const stepHit = (b) => { const s = b.scale.x || 1; const hp = Math.max(44 / s, stepSz + 14) / s; b.hitArea = new PIXI.Rectangle(-hp/2, -hp/2, hp, hp); };  // RESP-04 — guarantees screen-space hit >= 44px regardless of sprite scale

    // ── VILLAIN-QUALITY OBSIDIAN BAR — premium dark aesthetic
    // Per pro UX brief: "deep obsidian/midnight black base + glowing
    // neon-villain accents (toxic magenta, cybernetic purple)". 8 layers
    // for the AAA depth: shadow → obsidian → cybernetic purple wash →
    // toxic magenta core glow → emerald hairline → SMOKE_W gloss stripe →
    // neon pink outer ring → black inner contour.
    bottomBarBg.clear();
    if (skin) {
      // ── DELIVERED PANEL BAR ─────────────────────────────────────────────
      // The bar is the delivered design's "panel": vertical gold gradient body
      // (#2d2822→#1e1914→#120e09) + gold edge (#b88e40) + 6%-white inner gloss.
      // We add the panel's signature soft drop shadow underneath and the gold
      // accent hairline across the top (goldLine gradient), matching the spec.
      bottomBarBg
        .roundRect(barX - 1, barY + 3, barW + 2, barH + 4, barR + 1)
        .fill({ color: 0x000000, alpha: 0.55 });
      skin.panelInto(bottomBarBg, barX, barY, barW, barH, barR, { edge: 1.8 });
      // signature thin gold accent line across the very top of the panel
      skin.goldLineInto(bottomBarBg, barX + barR * 0.6, barY + 1, barW - barR * 1.2, 1.4);
    } else {
      bottomBarBg
      // (1) drop shadow
      .roundRect(barX-1, barY+3, barW+2, barH+4, barR+1)
      .fill({ color:0x000000, alpha:0.65 })
      // (2) GOLD-PANEL BASE — deep brown-black
      .roundRect(barX, barY, barW, barH, barR)
      .fill({ color:0x120e09, alpha:0.99 })
      // (3) GOLD PANEL WASH — top 55%
      .roundRect(barX+1, barY+1, barW-2, barH*0.55, barR-1)
      .fill({ color:0x2d2822, alpha:0.55 })
      // (4) WARM GOLD CORE GLOW — center radial feel
      .roundRect(barX+barW*0.18, barY+barH*0.18, barW*0.64, barH*0.64,
                 Math.min(barH*0.32, 30))
      .fill({ color:0xba852d, alpha:0.22 })
      // (5) DARK GOLD HINT — subtle bottom-edge depth accent
      .roundRect(barX+barW*0.25, barY+barH*0.60, barW*0.50, barH*0.30, 12)
      .fill({ color:0x1e1914, alpha:0.18 })
      // (6) WARM GLOSS STRIPE — top hairline
      .roundRect(barX+barR*0.6, barY+1, barW-barR*1.2, 1.2, 0.6)
      .fill({ color:0xf1e9d7, alpha:0.20 })
      // (7) GOLD OUTER RING — accent
      .roundRect(barX, barY, barW, barH, barR)
      .stroke({ color:0xe9bf5a, width:1.2, alpha:0.42 })
      // (8) PURE-BLACK INNER CONTOUR — depth hairline
      .roundRect(barX+2, barY+2, barW-4, barH-4, barR-2)
      .stroke({ color:0x000000, width:0.8, alpha:0.65 });
    }

    // ── BAL / BET TYPOGRAPHY — per pro UX evaluation
    // Labels lifted to #BDC5D6 (5.8:1 contrast — WCAG AA pass).
    // Values stay bright text (#F5F7FA, 18.9:1 AAA).
    // NEGATIVE letterSpacing (-1.5px) on values fixes the Luckiest Guy
    // $-glyph kerning bug — the font ships with extra whitespace after
    // the $ that reads as a "broken space" between $ and the digits.
    // RESP-05 — bump labelSz floor on tiny presets so HUD labels stay >= 11px on
    // screen (Popout S was rendering 8.79px BALANCE label, illegible). The cap
    // stays at 1.0 elsewhere so larger presets aren't artificially blown up.
    const labelSz = Math.max(tiny ? 0.92 : 0.72, Math.min(1.0, barH/72));
    balLabel.scale.set(labelSz*0.95); balValue.scale.set(labelSz*1.25);
    winLabel.scale.set(labelSz*0.95); winValue.scale.set(labelSz*1.25);
    winLabel._baseScale = labelSz*0.95; winValue._baseScale = labelSz*1.25;   // #win-text rule 1 anchor
    betLabel.scale.set(labelSz*0.95); betValue.scale.set(labelSz*1.25); betValue._baseScale = labelSz*1.25;
    [balLabel, winLabel, betLabel].forEach(t => {
      t.style.letterSpacing = 2.0;
      t.style.fill = 0xd6ab46;
    });
    [balValue, betValue, winValue].forEach(t => {
      t.style.fill = 0xf6f1e6;
      t.style.letterSpacing = 0;   // back to default (Luckiest Guy kerning OK)
    });
    // ── DELIVERED-PANEL TYPOGRAPHY — Inter chain (BAR.FONT), bold weight, clean
    // (no heavy outline). Spacing is measured at runtime so swapping the family
    // never breaks the layout; Inter falls back gracefully (do NOT bundle woff2).
    if (skin) {
      [balLabel, winLabel, betLabel].forEach(t => {
        t.style.fontFamily = BAR_FONT; t.style.fontWeight = '700'; t.style.stroke = null;
      });
      [balValue, betValue, winValue].forEach(t => {
        t.style.fontFamily = BAR_FONT; t.style.fontWeight = '700'; t.style.stroke = null;
      });
    }

    // ── LEFT UTILITY COLUMN — info / settings / sound (vertical stack)
    // outside the bar so the bar itself stays clean. On tiny landscape we
    // collapse to a horizontal row above the bar.
    const utilGap = 6;
    const utilXCenter = barX - utilSz - 10;
    if(utilXCenter > padL + utilSz*0.5 + 2 && !portrait){
      // wide layout — vertical column to the LEFT of the bar
      const ux = utilXCenter;
      [btnInfo, btnSettings, btnSound].forEach((b, i) => {
        const s = utilSz / b._icon.texture.width;
        b._baseScale = s; b._displayScale = s; b.scale.set(s); b._apply && b._apply();
        b.position.set(ux, barY + barH*0.5 + (i-1)*(utilSz + utilGap));
        // SCALE-COMPENSATED HIT AREA (2026-06-02 fix) — hitArea is LOCAL and the
        // container is scaled by `s`, so a fixed local rect renders to ~s× on
        // screen (≈7px for a hi-res icon texture) → "icons don't click". Size the
        // local rect so the SCREEN tap target is a comfortable chip: full slot
        // height (utilSz+utilGap, no vertical overlap) × a generous width.
        const hpW = Math.max(56, utilSz + 16) / s, hpH = (utilSz + utilGap) / s;
        b.hitArea = new PIXI.Rectangle(-hpW/2, -hpH/2, hpW, hpH);
        b.visible = true;
      });
    } else {
      // portrait / tiny — horizontal row above the bar.
      // Top row is now PURE SETTINGS RAIL (info / settings / sound). TURBO
      // (a gameplay action, visually distinct red/pink flash icon) moved
      // OUT of this row — sitting it next to settings looked wrong since
      // it modifies SPIN behavior, not app preferences. TURBO now lives
      // in the bottom row beside SPIN where every other gameplay control
      // sits. This matches Stake's own slot pattern (Wheel of Chance,
      // Sweet Bonanza) — settings up top, gameplay actions below.
      // ── SETTINGS RAIL — visually subordinate to gameplay row.
      // Per user feedback, these icons are now SMALLER than the bottom-
      // row chips (utilSz × 0.82 = ~36-43 px). Settings shouldn't compete
      // with gameplay buttons for visual weight. Hit-area expanded to 44
      // via PIXI.Rectangle so WCAG tap-targets still pass.
      const portraitTopIcons = portrait ? [btnInfo, btnSettings, btnSound, btnTurbo, btnAutoplay] : [btnInfo, btnSettings, btnSound];   // TURBO + AUTOPLAY live in the top rail on mobile — bottom row stays clean: BET steppers (left) + dominant SPIN (right)
      const railSz = Math.max(34, utilSz * 0.82);
      const startX = barX + 10;
      const topIconY = portrait
        ? (barY - railSz*0.5 - 8)    // just above the bar — icons adjacent to the betting panel (was above the buy-bonus banner)
        : (barY - railSz*0.5 - 6);
      const railPitch = railSz + 12;   // slot pitch = icon + 6px padding each side (was railSz+utilGap → hit zones tight/overlapping)
      portraitTopIcons.forEach((b, i) => {
        const s = railSz / b._icon.texture.width;
        b._baseScale = s; b._displayScale = s; b.scale.set(s); b._apply && b._apply();
        b.position.set(startX + railPitch*0.5 + i*railPitch, topIconY);   // center each icon in its pitch slot
        // SCALE-COMPENSATED HIT AREA (2026-06-02 fix) — the container is scaled
        // by `s` (often <0.2 for a hi-res icon texture) and hitArea is in LOCAL
        // space, so a fixed 52px local rect rendered to ~52*s ≈ 7px on screen →
        // "icons don't click". Size local = railPitch/s so the SCREEN tap target
        // is exactly railPitch (full slot, 6px padding, tiles with no overlap).
        const hp = railPitch / s;
        b.hitArea = new PIXI.Rectangle(-hp/2, -hp/2, hp, hp);
        b.visible = true;
      });
    }

    const GAP = 6;   // user spec: min 6 px between every adjacent element

    // ────────────────────────────────────────────────────────────────
    // PORTRAIT vs LANDSCAPE branch — totally different layouts.
    // ────────────────────────────────────────────────────────────────
    let buyBtnH, buyBtnW;
    let spinCenterX, autoCenterX, turboCenterX;

    if(portrait){
      // ── PORTRAIT: 2-row bar ──────────────────────────────────────
      // Row 1 (top half of bar):  BAL value  |  BET value
      //                           (BUY BONUS sits ABOVE the bar, not in row 1)
      // Row 2 (bottom half):  − + | AUTOPLAY | SPIN
      //                       (TURBO moved to the top utility row to free space)
      //
      // WIN is hidden on portrait between spins — only flashes on actual wins.

      const rowY1 = barY + barH * 0.30;   // text row centre
      const rowY2 = barY + barH * 0.74;   // button row centre

      // BUY BONUS pill — ABOVE the bar, now TRULY FULL WIDTH (was capped at
      // 360 → side gaps; user: "buy bonus not full width"). Stack above the
      // bar is BUY BONUS (top) → settings rail → bar, so the utility icons sit
      // adjacent to the betting panel.
      buyBtnH = 46;
      // COMPACT pill — NOT full width (user, repeatedly). Centred above the bar
      // at ~72% so it reads as "a special action", not a full-width banner.
      buyBtnW = Math.min(barW * 0.72, 300);
      const _railH = Math.max(34, utilSz*0.82);
      if(buyBar.visible){
        const buyY = barY - _railH - 8 - buyBtnH - 6;   // sits above the settings rail
        buyBar.position.set(barX + (barW - buyBtnW)/2, buyY);   // CENTRED compact pill
        buyBar._inlineW = buyBtnW; buyBar._inlineH = buyBtnH;
      }

      // ── ROW 1 TEXT POSITIONING — gap-audit fix
      // The BET label/value previously anchored to barX+barW-16 (bar right
      // edge). With value scale 1.22 + label scale 0.95, the value text
      // extended down into row 2 and overlapped the SPIN button by ~50 px
      // horizontally / 15 px vertically. Fix: pull BET inward so it sits
      // CLEAR of the SPIN column (column derived from same formula used
      // for spinCenterX below: barX + barW - 14 - spinSz/2).
      const safeRightX = barX + barW - 14 - spinSz - GAP - 4;
      const safeLeftX  = barX + Math.max(16, barR);

      // ── BALANCE OWNS ROW 1 — pro UX evaluation pattern
      // Row 1: only BALANCE, full width (label + value stacked vertically
      //        OR side-by-side, with BAL value the visual anchor).
      // Row 2: − [BET value] + ... TURBO AUTOPLAY SPIN
      // The BET value moves DOWN into row 2 between the steppers so the
      // user instantly sees what +/− are adjusting. BET label sits above
      // the value in row 1's lower half.
      balLabel.anchor.set(0, 0.5); balValue.anchor.set(0, 0.5);
      balLabel.position.set(safeLeftX, rowY1 - 12);
      balValue.position.set(safeLeftX, rowY1 + 10);
      // BALANCE crypto cap (portrait) — long 8-decimal strings ("BTC 997.60000000")
      // shrink to stay in the left ~44% of the bar so they don't shove the WIN slot
      // (centred from balValue.width below) off the right edge. Applied inline so the
      // WIN centring reads the CAPPED width; the coin-up ticker keeps it in sync after.
      balValue._maxW = barW*0.44;
      balValue.scale.set(1);
      balValue._fit = (balValue.width > balValue._maxW) ? balValue._maxW/balValue.width : 1;
      balValue._lastFitTxt = balValue.text;
      balValue.scale.set(balValue._fit);

      // BET LABEL — hidden on portrait. The − [bet value] + cluster in
      // row 2 is self-explanatory (steppers visibly bracket the dollar
      // value). Adding a "BET" label above just creates clutter and
      // collides with the BALANCE value in row 1. Keep it landscape-only.
      betLabel.alpha = 0;

      // ── WIN slot — ALWAYS positioned in row 1 right of BALANCE,
      // alpha-toggled by hasWin. Setting position only inside the
      // `if(hasWin)` branch left it at (0,0) when first activated by
      // startSpin's alpha flip, so the win text briefly flashed in the
      // top-left corner of the canvas. Position must be set EVERY layout.
      // WIN — RIGHT column of row 1, centred label-over-value (anchor 0.5),
      // ALWAYS visible so it's a stable readout, and a touch larger than
      // BALANCE so a real win reads as the hero number (user: "win is small
      // and not centred").
      winLabel.anchor.set(0.5, 0.5); winValue.anchor.set(0.5, 0.5);
      // WIN value trimmed (was 1.62) so it fits the gap between the left-anchored
      // BALANCE value and the SPIN column — it was overrunning BALANCE at 320/375/425
      // ("$0.00" sitting on top of "$1,000.00"). Still the hero number (> BALANCE).
      winLabel._baseScale = labelSz*1.06; winLabel.scale.set(winLabel._baseScale);      // was 1.18
      winValue._baseScale = labelSz*1.40*1.16; winValue.scale.set(winValue._baseScale); // was 1.62
      // WIN occupies a FIXED slot to the RIGHT of the BALANCE value — centred in the slot and
      // capped to the slot width (enforced every frame in the render block). The slot is defined
      // by BALANCE + the bar, NOT by the win text, so a win that credits AFTER layout
      // ("$0.00" → "$150.00"), or a persisted last-win shown at a new bet, can never grow LEFT
      // into BALANCE. (Was: centred on _winHalf measured from whatever win text showed at layout,
      // so a wider value credited later overran BALANCE → the 320/375 "$900.00$150.00" overlap.)
      // RIGHT bound = the SPIN button's LEFT edge (SPIN is the big right-side CTA that spans
      // BOTH rows vertically, so a WIN reaching the bar's right edge sits UNDER it on 320 — the
      // measured "$150.00"-over-spin overlap). Stop the slot before SPIN. (spinSz from 6203;
      // mirrors spinCenterX − spinSz/2 below.) On wide portraits this also re-centres WIN nicely.
      const _barRight = (barX + barW - 14 - spinSz) - 10;
      const _balRight = balValue.x + balValue.width + 12;   // BALANCE value's real (post-fit) right edge + gap
      const _slotLeft = _balRight + 8;
      const _slotW    = Math.max(54, _barRight - _slotLeft);
      winValue._maxW  = _slotW - 6;             // value (and its count-up pop) is bounded by the slot
      winLabel._maxW  = _slotW;
      winValue._slotRight = _barRight;          // render block re-derives the slot from LIVE balance each frame (stable vs coin-up)
      const _winCx = (_slotLeft + _barRight) / 2;   // centre of the slot
      winLabel.position.set(_winCx, rowY1 - 14);
      winValue.position.set(_winCx, rowY1 + 13);
      winLabel.alpha = 1; winValue.alpha = 1;

      // Row 2 — FINAL LAYOUT per all pro UX rounds:
      //   LEFT side:  − [BET value] +
      //   RIGHT side: TURBO | AUTOPLAY | SPIN  (SPIN at right edge, thumb-zone)
      // SPIN stays on the RIGHT (correct primary CTA position in the player's
      // dominant-hand thumb arc). BET steppers flank the BET value on the
      // LEFT. All 6 elements fit at portrait via compact chip sizes (40 px).
      fitW(minusBtn, stepSz); fitW(plusBtn, stepSz);
      [minusBtn, plusBtn].forEach(b => {
        b._baseScale = b.scale.x;
        b._displayScale = b.scale.x;
        b._targetScale = b.scale.x;
      });
      const TIGHT_GAP = 11;       // clear, even gaps around the BET value (user: "no gap")
      const GROUP_GAP = 12;       // was 16 — frees space for TURBO + dominant SPIN

      // ── BET STEPPER cluster (LEFT side of row 2): − [BET value] +
      // Scale the bet VALUE to a cap, then size the cluster to its ACTUAL width
      // so big bets ($100+, $1,000.00) never overflow/overlap the +/- buttons
      // (user: "bet >100 crushing +/- overlapping, outing borders"). Was a
      // hard-coded 54px assumption that ignored the real text width.
      // FIXED reserved cluster width so the +/- buttons NEVER move when the bet
      // changes (was sized to the live value width → buttons jumped, user complaint).
      // The value is scale-capped to fit; the box grows within the reserve.
      // SPIN is right-anchored (spinCenterX below). The old FIXED betValueWidth (barW*0.34)
      // made the −[value]+ cluster wider than the room left of SPIN on the narrowest
      // portraits, so the + button ran UNDER spin (320 → measured 24px overlap; user:
      // "buttons very close / overlapping"). Clamp the value reserve to the ACTUAL gap
      // between the − stepper and SPIN's left edge (minus GROUP_GAP clearance), then cap
      // the value text to that (possibly shrunk) reserve so a wide bet can't overflow it.
      const minusCenterX = barX + 14 + stepSz/2;
      const _spinLeftX   = (barX + barW - 14 - spinSz/2) - spinSz/2;   // SPIN left edge (mirrors spinCenterX below)
      const _availForVal = (_spinLeftX - GROUP_GAP - (minusCenterX - stepSz/2)) - (2*stepSz + 2*TIGHT_GAP);
      const betValueWidth = Math.max(34, Math.min(barW*0.34, 134, _availForVal));   // reserve fits before SPIN
      const betValCap = Math.min(barW*0.30, 100, betValueWidth - 8);   // value text bounded by its reserve
      const _bvBase = betValue._baseScale || betValue.scale.x;
      betValue.scale.set(_bvBase);
      if(betValue.width > betValCap) betValue.scale.set(_bvBase * betValCap / betValue.width);
      const betValueX    = minusCenterX + stepSz/2 + TIGHT_GAP + betValueWidth/2;
      const plusCenterX  = betValueX + betValueWidth/2 + TIGHT_GAP + stepSz/2;
      minusBtn.position.set(minusCenterX, rowY2);
      plusBtn.position.set(plusCenterX, rowY2);
      stepHit(minusBtn); stepHit(plusBtn);   // scale-compensated >=48px tap targets (was ~8px: raw 52px local on a ~0.1x sprite)
      betValue.anchor.set(0.5, 0.5);
      betValue.position.set(betValueX, rowY2);
      betValue.alpha = 1;

      // ── GAMEPLAY CLUSTER (RIGHT side of row 2): just the dominant SPIN.
      // AUTOPLAY moved to the TOP utility rail (with TURBO) so the bottom row is
      // BET steppers (left) + SPIN (right) — nothing crowding the primary CTA.
      spinCenterX = barX + barW - 14 - spinSz/2;
      autoCenterX = 0;   // autoplay now lives in the top rail (kept for legacy refs below)
      // TURBO left of AUTOPLAY. The slot must clear the stepper-cluster right
      // edge by GROUP_GAP. If there isn't room, fall back to hiding TURBO.
      const stepperRightEdge = plusCenterX + stepSz/2;
      const autoLeftEdge     = autoCenterX - utilSz/2;
      const turboRightEdge   = autoLeftEdge - TIGHT_GAP;
      const turboLeftMin     = stepperRightEdge + GROUP_GAP;
      // TURBO now lives in the TOP settings rail (added to portraitTopIcons
      // above) — there was no room next to the dominant SPIN in the bottom row,
      // and squeezing it out (turboMaxSz<30) is exactly why it vanished on
      // mobile. The rail already positioned + showed it; here we only keep it
      // interactive and in its correct 3-state look.
      turboCenterX = 0;
      void turboRightEdge; void turboLeftMin;
      if(turboAllowed()){
        btnTurbo.eventMode = 'static';
        try { refreshTurboBtn(); } catch(e){}
      } else {
        btnTurbo.visible = false; btnTurbo.eventMode = 'none'; State.turboMode = 0;
      }

      // ── DELIVERED-PANEL DECORATIONS (portrait) ──────────────────────────
      // Row 2 bet stepper pill around − [value] +, a stadium banner behind the
      // row-1 WIN (LAST WIN) readout, and gold circle bodies under the autoplay
      // + turbo icons (which live in the top rail on portrait). The rail icons
      // were already positioned above, so we read their live x/y here.
      if (skin) {
        const stPadX = stepSz * 0.5 + 8;
        const stLeft = minusBtn.x - stPadX;
        const stRight = plusBtn.x + stPadX;
        const stH = Math.min(barH * 0.40, 54);
        skin.stepperInto(bottomBarBg, stLeft, rowY2 - stH / 2, stRight - stLeft, stH);
        if (winLabel.alpha > 0 && winValue._maxW) {
          const wbW = winValue._maxW + 18;
          const wbH = Math.min(barH * 0.42, 46);
          const wbCx = winValue.x;
          const wbCy = (winLabel.y + winValue.y) / 2;
          skin.bannerInto(bottomBarBg, wbCx - wbW / 2, wbCy - wbH / 2, wbW, wbH);
        }
        const railR = Math.max(20, utilSz * 0.62 * 0.82);
        if (btnAutoplay.visible) skin.circleInto(bottomBarBg, btnAutoplay.x, btnAutoplay.y, railR);
        if (btnTurbo.visible) skin.circleInto(bottomBarBg, btnTurbo.x, btnTurbo.y, railR);
      }
    } else {
      // ── LANDSCAPE: existing single-row layout ─────────────────────
      // Tiny landscape (Popout S 400×225) goes EXTRA compact:
      //  • BUY BONUS pill hidden (player still has it in the bet menu)
      //  • WIN slot hidden (just BAL + BET, like real Stake casino slots
      //    on Popout S — Sweet Bonanza, Wheel of Chance, etc.)
      //  • Smaller label scale, tighter padding
      // Picker was rejected 4× on this preset; compressing the bar is the
      // ONLY way 3 button clusters + balance + bet text fit in 344px.
      let lx = barX + (tiny ? 8 : 14);

      buyBtnH = barH - (tiny ? 6 : 10);
      buyBtnW = Math.min(barW*0.18, 180);
      if(buyBar.visible && !tiny){
        buyBar.position.set(lx, barY + 5);
        buyBar._inlineW = buyBtnW; buyBar._inlineH = buyBtnH;
        lx += buyBtnW + 12;
      } else if(tiny){
        // Hide inline BUY BONUS pill in the bar — too cramped. Player
        // reaches Buy Bonus via the bet menu or settings drawer instead.
        buyBar.visible = false; buyBar._inlineW = 0; buyBar._inlineH = 0;
      }

      balLabel.anchor.set(0, 0.5); balValue.anchor.set(0, 0.5);
      balLabel.position.set(lx, barY + barH*0.30);
      balValue.position.set(lx, barY + barH*0.66);
      let segBal = tiny ? Math.min(barW*0.32, 130) : Math.min(barW*0.20, 180);
      // Divider (overlap fix 2026-06-05): keep BALANCE clear of the right-anchored
      // bet cluster, whose left edge mirrors betGuardX (computed below) =
      // barX+barW - spinSz - 2*utilSz - 2*stepSz - betChipW - 8*GAP. On narrow/
      // medium landscapes (barW <= ~850 -> Popout L etc.) the cluster crossed into
      // BALANCE ("balance and bet overlapped"). Clamp segBal so BALANCE ends before
      // it (the WIN slot after has its own guard). Non-tiny only.
      if(!tiny){
        const _betChipW0   = Math.min(Math.max(barW*0.13, 96), 120);
        const _clusterLeft = (barX + barW) - spinSz - 2*utilSz - 2*stepSz - _betChipW0 - 8*GAP;
        segBal = Math.max(56, Math.min(segBal, _clusterLeft - lx - GAP));
      }
      balValue._maxW = segBal - 12;   // BALANCE scales to fit its slot — long 8-decimal crypto strings ("BTC 997.60000000") shrink instead of overflowing into the WIN slot
      balValue._fit = null;           // invalidate cached fit so the ticker re-measures against the new slot width after a resize
      lx += segBal;

      // WIN slot — hidden in tiny landscape (no room). The WIN value is
      // still visible during/after a winning round via the celebration
      // popup centred on the reels. Between spins, the player sees BAL
      // and BET only — matches Stake's own tiny-landscape pattern.
      if(tiny){
        winLabel.alpha = 0; winValue.alpha = 0;
      } else {
        winLabel.alpha = 1; winValue.alpha = 1;
        const segWin = Math.min(barW*0.14, 110);
        winValue._maxW = segWin - 6;   // WIN value also caps to its centred slot (so a long crypto win can't grow LEFT into BALANCE — the existing fit only guards the BET chip on the right)
        const winCX = lx + segWin/2;
        winLabel.anchor.set(0.5, 0.5); winValue.anchor.set(0.5, 0.5);
        winLabel.position.set(winCX, barY + barH*0.30);
        winValue.position.set(winCX, barY + barH*0.66);
        lx += segWin;
      }

      const stepperBlockW = stepSz + GAP*2;
      const rightClusterW = spinSz + utilSz*2 + GAP*4;
      const betEndX = barX + barW - rightClusterW - stepperBlockW - GAP*2;
      fitW(minusBtn, stepSz); fitW(plusBtn, stepSz);
      [minusBtn, plusBtn].forEach(b => {
        b._baseScale = b.scale.x;
        b._displayScale = b.scale.x;
        b._targetScale = b.scale.x;
      });
      stepHit(minusBtn); stepHit(plusBtn);   // scale-compensated >=48px tap targets (was ~8px: raw 52px local on a ~0.1x sprite)

      // ── BET STEPPER (2026-05-31 fix) ─────────────────────────────────────
      // Was: value right-anchored + a VERTICAL +/- stack centred on the bar
      // middle — the + rose into the BET label and both chips sat half over the
      // chip-box (user: "bet amount outside the box, +/- overlapping"). Now the
      // value is CENTRE-anchored and  −  [value box]  +  flank on ONE row, same
      // as portrait. Tiny (Popout S) has no h-room → keep a compact vertical
      // stack, but centred on the VALUE row so the + still clears the label.
      let betGuardX;   // left edge of the bet cluster — WIN hides before reaching it
      if(!tiny){
        betValue.anchor.set(0.5, 0.5);
        // FIXED reserved chip width — the +/- steppers flank THIS, not the live value
        // width, so they never move when the bet changes. The value box (betChipG)
        // grows/shrinks around the stable centre, always within this reserve (value is
        // scale-capped to 94px in updateHUD → box ≤120).
        const betChipW = Math.min(Math.max(barW*0.13, 96), 120);
        const clusterRightX = betEndX + stepperBlockW;               // cluster right edge (clear of the right cluster)
        const plusCX  = clusterRightX - stepSz/2;
        const betVX   = plusCX  - stepSz/2 - GAP - betChipW/2;
        const minusCX = betVX   - betChipW/2 - GAP - stepSz/2;
        // BET value + steppers sit on the SAME vertical centreline as the
        // turbo/autoplay/spin cluster (barH*0.50) so all interactive controls
        // align (user: "autoplay + turbo not vertically centred"). Was 0.62,
        // which left the − [bet] + row 11 px below the turbo/auto/spin row.
        const betRowCY = barY + barH*0.50;
        minusBtn.position.set(minusCX, betRowCY);
        plusBtn.position.set(plusCX,  betRowCY);
        betValue.position.set(betVX, betRowCY);
        betLabel.anchor.set(0.5, 0.5);
        betLabel.position.set(betVX, barY + barH*0.22);   // raised with the value so the BET label clears it
        betGuardX = minusCX - stepSz/2;
      } else {
        // Popout S 400×225 — ultra-compact: value right-anchored + a vertical
        // +/- stack, but centred on the VALUE row so the + clears the BET label.
        betLabel.anchor.set(1, 0.5); betValue.anchor.set(1, 0.5);
        betLabel.position.set(betEndX, barY + barH*0.24);
        betValue.position.set(betEndX, barY + barH*0.62);
        const stepX = betEndX + GAP + stepSz/2;
        const halfDist = Math.max(stepSz/2 + 3, barH*0.20);
        const stepCY = betValue.position.y;
        plusBtn.position.set(stepX,  stepCY - halfDist);
        minusBtn.position.set(stepX, stepCY + halfDist);
        betGuardX = betEndX - betValue.width;
      }

      // ── HUD COLLISION GUARD — hide WIN before it reaches the bet cluster.
      // (BALANCE grows L→R; WIN sits centre; both yield to the right-pinned BET
      // cluster on a narrow bar — user: "LAST WIN overlapping the bet".)
      if(winLabel.alpha > 0 && (winLabel.position.x + 54) > (betGuardX - 24)){
        winLabel.alpha = 0; winValue.alpha = 0;
      }
      // WCAG 2.5.5 — guarantee 44×44 hit area even when the chip visually
      // shrinks (Popout S / landscape compact mode). Without this the
      // sprite's natural 24×24 bounds at Popout S becomes the only
      // tappable region — way under the spec.
      stepHit(minusBtn); stepHit(plusBtn);   // scale-compensated >=48px tap targets (was ~8px: raw 52px local on a ~0.1x sprite)

      const spinRightEdge = barX + barW - GAP;
      spinCenterX  = spinRightEdge - spinSz/2;
      // Gap bumped from GAP→GAP+4 px between SPIN↔AUTO and AUTO↔TURBO so the
      // rendered bounding boxes (which include drop-shadow + chip halo
      // outside the icon proper) still clear the 6 px minimum. Audit at
      // Popout L 800×450 was reporting 3 / 5 px effective gaps before.
      autoCenterX  = spinCenterX - spinSz/2 - (GAP + 4) - utilSz/2;
      turboCenterX = autoCenterX  - utilSz/2 - (GAP + 4) - utilSz/2;
      { const s = utilSz/btnAutoplay._icon.texture.width;
        btnAutoplay._baseScale = s; btnAutoplay._displayScale = s; btnAutoplay.scale.set(s);
        btnAutoplay._apply&&btnAutoplay._apply();
        btnAutoplay.position.set(autoCenterX, barY + barH*0.5); }

      if(turboAllowed()){
        btnTurbo.visible = true; btnTurbo.eventMode = 'static';
        const s = utilSz/btnTurbo._icon.texture.width;
        btnTurbo._baseScale = s; btnTurbo._displayScale = s; btnTurbo.scale.set(s);
        btnTurbo._apply&&btnTurbo._apply();
        btnTurbo.position.set(turboCenterX, barY + barH*0.5);
        refreshTurboBtn();
      } else {
        btnTurbo.visible = false; btnTurbo.eventMode = 'none';
        State.turboMode = 0;
      }

      // ── DELIVERED-PANEL DECORATIONS (landscape) ─────────────────────────
      // Draw the design's component bodies into bottomBarBg at the computed
      // positions: stadium banner behind the WIN (LAST WIN) readout, the bet
      // stepper pill flanking − value +, and gold circle bodies under the
      // autoplay (play-triangle) + turbo (lightning) icons. All purely visual;
      // the live text + icon handles (already positioned) sit on top.
      if (skin) {
        // WIN stadium banner (only when the WIN slot is showing)
        if (winLabel.alpha > 0) {
          const segWin = Math.min(barW * 0.14, 110);
          const wbH = Math.min(barH * 0.62, 56);
          skin.bannerInto(bottomBarBg, winValue.x - segWin / 2, barY + barH * 0.5 - wbH / 2, segWin, wbH);
        }
        // BET stepper pill around the − [value] + cluster
        if (minusBtn.visible && betValue.alpha > 0) {
          const stPadX = stepSz * 0.5 + 8;
          const stLeft = minusBtn.x - stPadX;
          const stRight = plusBtn.x + stPadX;
          const stH = Math.min(barH * 0.62, 56);
          skin.stepperInto(bottomBarBg, stLeft, barY + barH * 0.5 - stH / 2, stRight - stLeft, stH);
        }
        // Gold circle bodies under the autoplay + turbo icons
        const circR = utilSz * 0.62;
        skin.circleInto(bottomBarBg, btnAutoplay.x, btnAutoplay.y, circR);
        if (btnTurbo.visible) skin.circleInto(bottomBarBg, btnTurbo.x, btnTurbo.y, circR);
      }
    }

    // ── FLAT FLOATING ICON SYSTEM — pro UX (no chip frames)
    // Per user request: "remove circles from autoplay/plus/turbo, SPIN dominant".
    // Icons sit DIRECTLY on the bar surface in pure smoke-white. No chip
    // backgrounds compete with SPIN. Tap targets stay 44×44 via hitArea.
    // The bar's own gradient surface provides the depth — no per-button
    // shadow needed.
    function drawBtnChip(cx, cy, r, active, accentColor){
      // Render nothing — icons float freely on the bar surface.
      // (Function kept for back-compat with all callsites; intentional no-op.)
    }
    const chipR = utilSz * 0.62;
    // ── UNIFIED NEUTRAL CHIPS — every chip looks identical (Sweet Bonanza /
    // Gates of Olympus pattern). The ICONS communicate function via their
    // own colour state. Only the ACTIVE inner glow gets a faint tint — the
    // chip frame itself is consistent across the entire bar.
    //   TURBO active → subtle pink inner glow (matches the pink notification pip)
    //   AUTOPLAY active → subtle blue inner glow
    //   ± stepper → always idle (gold tint on icon, not chip)
    //   info/settings/sound → cyan inner glow only when "active"
    if(btnTurbo.visible){
      const turboTint = State.turboMode === 2 ? THEME.colors.pink
                      : State.turboMode === 1 ? THEME.colors.accent
                      : null;
      drawBtnChip(btnTurbo.x, btnTurbo.y, chipR, State.turboMode > 0, turboTint);
    }
    drawBtnChip(btnAutoplay.x, btnAutoplay.y, chipR,
                State.autoplay.active, THEME.colors.blue);
    // ± stepper — chips ALWAYS idle (no active state). The icon dims when
    // disabled (bet at min/max) but the chip itself stays uniform.
    drawBtnChip(plusBtn.x,  plusBtn.y,  stepSz*0.62, false, null);
    drawBtnChip(minusBtn.x, minusBtn.y, stepSz*0.62, false, null);
    // Utility rail — smaller chip radius (matches railSz from layout).
    // Settings should sit visually subordinate to gameplay buttons.
    const railChipR = Math.max(20, chipR * 0.82);
    [btnInfo, btnSettings, btnSound].forEach(b => {
      if(b && b.visible){
        drawBtnChip(b.x, b.y, railChipR, b._active === true, THEME.colors.cyan);
      }
    });

    // ── SPIN — big white circle. Portrait uses row 2 (bottom); landscape
    // uses bar vertical centre.
    fitW(spinBtn, spinSz);
    spinBtn._baseScale = spinBtn.scale.x;
    spinBtn._displayScale = spinBtn.scale.x;
    const spinCY = portrait ? (barY + barH*0.72) : (barY + barH*0.5);
    spinBtn.position.set(spinCenterX, spinCY);
    spinHalo.clear();

    // legacy plaque fits — kept so buy-bonus side-ribbon math holds, and a
    // legacy betCY for any code that still references it.
    const balLegW = Math.min(206*hudK, W*0.34)*1.3; fitW(balPlaque, balLegW);
    const betLegW = (portrait ? Math.min(W*0.33,196) : Math.min(180*hudK, W*0.27))*1.3;
    fitW(betPlaque, betLegW);
    const winLegW = Math.min(170*hudK, W*0.28); fitW(winPlaque, winLegW);
    const betCY   = barY + barH*0.5;

    btnSound._icon.texture=tex(State.muted?'icMute':'icSound');
    btnSound._setActive(!State.muted);
    // Hidden buttons stay hidden — defensive in case other code shows them.
    btnHistory.visible = false;
    btnFullscreen.visible = false;

    // ── BUY BONUS — gold-bordered pill inside the bottom bar (reference)
    // We already positioned `buyBar` (the hit-area container) earlier; now
    // draw the visual ON the bottomBarBg Graphics. The velvet-ribbon image
    // (buyBg) is hidden because the procedural pill carries the visual now.
    if(buyBar.visible && buyBar._inlineW){
      buyBg.visible = false;   // hide the legacy velvet-ribbon image
      const bx = buyBar.position.x;          // left edge inside the bar
      const by = buyBar.position.y;          // top edge inside the bar
      const bw = buyBar._inlineW;
      const bh = buyBar._inlineH;
      // ── BUY BONUS — CHAMFERED-CORNER BOX (2026-05-27 elegant redesign)
      // Per user "buy bonus need like the not rectangle need for the like
      // box but elegant design" — replaced the round-rect pill with a
      // sci-fi chamfered-corner box (8 sides). Reads as a command-panel
      // CTA, more premium than a generic pill, less aggressive than hex.
      const cham = Math.min(bh * 0.32, 14);    // chamfer depth = corner cut
      // Helper: produce the 8-vertex octagonal point list for a given
      // rectangle bounds + chamfer depth.
      const chamBox = (X, Y, W, H, C) => [
        X + C,     Y,                 // top-left chamfer end
        X + W - C, Y,                 // top-right chamfer start
        X + W,     Y + C,             // top-right chamfer end
        X + W,     Y + H - C,         // bottom-right chamfer start
        X + W - C, Y + H,             // bottom-right chamfer end
        X + C,     Y + H,             // bottom-left chamfer start
        X,         Y + H - C,         // bottom-left chamfer end
        X,         Y + C,             // top-left chamfer start
      ];
      const PINK      = 0xe9bf5a;
      const PINK_SOFT = 0xfadf8e;
      const PINK_DEEP = 0xba852d;
      const SMOKE_W   = 0xf1e9d7;
      const canAfford = State.balanceX6 >= buyCostX6();
      const t = performance.now();
      const breathe = canAfford ? (0.55 + 0.45 * Math.sin(t * 0.0028)) : 0;
      // ── (1) NEON OUTER GLOW — 4 stacked chamfered halos
      bottomBarBg
        .poly(chamBox(bx-8, by-7, bw+16, bh+14, cham+6))
        .fill({ color: PINK, alpha: 0.05 * breathe })
        .poly(chamBox(bx-6, by-5, bw+12, bh+10, cham+4))
        .fill({ color: PINK, alpha: 0.08 * breathe })
        .poly(chamBox(bx-4, by-3, bw+8,  bh+6,  cham+2))
        .fill({ color: PINK, alpha: 0.12 * breathe })
        .poly(chamBox(bx-2, by-1, bw+4,  bh+2,  cham+1))
        .fill({ color: PINK_SOFT, alpha: 0.22 * breathe })
        // ── (2) DROP-SHADOW under the box
        .poly(chamBox(bx-1, by+3, bw+2, bh+3, cham+1))
        .fill({ color: 0x000000, alpha: 0.55 })
        // ── (3) OBSIDIAN GRADIENT BASE — 3-stop vertical
        .poly(chamBox(bx, by, bw, bh, cham))
        .fill({ color: canAfford ? 0x2d2822 : 0x1e1914, alpha: 0.97 });
      // ── (4) TOP HALF — bright pink wash (clipped via thinner inset poly)
      // Pixi v8 polys can't be clipped without masks, so draw a slightly
      // smaller inset box for the bright top region.
      const topH = bh * 0.52;
      bottomBarBg
        .poly(chamBox(bx+1.2, by+1.2, bw-2.4, topH, cham-1))
        .fill({ color: canAfford ? 0x2a2317 : 0x19130c, alpha: 0.95 })
        .poly(chamBox(bx+1.2, by+1.2, bw-2.4, topH, cham-1))
        .fill({ color: PINK, alpha: canAfford ? 0.22 : 0.07 })
        // ── (5) DEEP PINK BAND through middle
        .rect(bx+cham*0.6, by+bh*0.42, bw-cham*1.2, bh*0.18)
        .fill({ color: PINK_DEEP, alpha: canAfford ? 0.18 : 0.04 })
        // ── (6) TOP SHINE — bright smoke-white hairline
        .rect(bx+cham*0.7, by+1.6, bw-cham*1.4, 1.4)
        .fill({ color: SMOKE_W, alpha: canAfford ? 0.55 : 0.20 })
        // ── (7) MID SHEEN — second highlight at 30% height
        .rect(bx+cham*0.5, by+bh*0.30, bw-cham, 0.8)
        .fill({ color: SMOKE_W, alpha: canAfford ? 0.16 : 0.05 })
        // ── (8) BRIGHT PINK OUTLINE — bigger stroke when affordable
        .poly(chamBox(bx, by, bw, bh, cham))
        .stroke({
          color: canAfford ? PINK_SOFT : PINK_DEEP,
          width: canAfford ? 1.8 : 1.2,
          alpha: canAfford ? 0.95 : 0.50,
        })
        // ── (9) INNER INK EDGE — depth hairline 1.5px inset
        .poly(chamBox(bx+1.5, by+1.5, bw-3, bh-3, cham-1.5))
        .stroke({ color: 0x000000, width: 0.6, alpha: 0.55 });
      // ── (10) CHAMFER CORNER ACCENTS — 4 short magenta pips at the
      // diagonal-cut corners, gives the box a tech-HUD vibe (premium CTA).
      const cornerPipAlpha = canAfford ? 0.90 : 0.30;
      // Top-left chamfer midpoint
      bottomBarBg.circle(bx + cham*0.5, by + cham*0.5, 1.8)
        .fill({ color: SMOKE_W, alpha: cornerPipAlpha });
      // Top-right
      bottomBarBg.circle(bx + bw - cham*0.5, by + cham*0.5, 1.8)
        .fill({ color: SMOKE_W, alpha: cornerPipAlpha });
      // Bottom-left
      bottomBarBg.circle(bx + cham*0.5, by + bh - cham*0.5, 1.8)
        .fill({ color: SMOKE_W, alpha: cornerPipAlpha });
      // Bottom-right
      bottomBarBg.circle(bx + bw - cham*0.5, by + bh - cham*0.5, 1.8)
        .fill({ color: SMOKE_W, alpha: cornerPipAlpha });

      // Hit area = full pill so taps anywhere fire.
      buyBar.hitArea = new PIXI.Rectangle(0, 0, bw, bh);

      // STAR ICON on the left — visually anchors the action.
      // Sized + positioned for vertical centering inside the pill.
      const iconBox = bh * 0.72;
      const iconK = iconBox / Math.max(buyIcon.texture.width, buyIcon.texture.height);
      buyIcon.scale.set(iconK);
      const iconCX = bh * 0.5;       // icon center = bh/2 from left → square left zone
      buyIcon.position.set(iconCX, bh * 0.5);   // dead-centered vertically
      buyIcon.visible = true;

      // Title + cost — CENTERED inside the text column, both H and V.
      // Text column starts after the icon zone (bh wide on the left).
      // The two text lines are positioned symmetrically around the pill's
      // vertical centre so the block reads as ONE balanced unit.
      const textColLeft = bh + GAP;
      const textColW    = bw - textColLeft - GAP*2;
      const textCenterX = textColLeft + textColW / 2;
      // ── CLEAN BUY BONUS pill — per user request
      // The modal has 3 tier cards each with their own cost (STANDARD $24,
      // HOT $122, MEGA $172). Showing a single cost on the pill is
      // misleading + redundant. Pill now reads simply "BUY BONUS" centred.
      buyTitle.anchor.set(0.5, 0.5);
      const titleNatural = 20;       // bigger since it's the only line
      const titleScale = Math.min(1, textColW / 110);
      buyTitle.style.fontSize = titleNatural;
      buyTitle.scale.set(titleScale);
      buyTitle.style.fill = THEME.colors.text;
      buyTitle.position.set(textCenterX, bh * 0.5);
      // Hide the cost line entirely on the pill — using `visible:false` so
      // the breathing-alpha animation in the render loop can't flip it
      // back on. Also clear the text to be safe.
      buyCost.visible = false;
      buyCost.text = '';
    } else if(buyBar.visible){
      // fallback (shouldn't fire now that the inline path is the default)
      buyBg.visible = true;
      const bbW = portrait ? Math.min(W*0.52,250) : Math.min(172*hudK, W*0.24);
      fitW(buyBg, bbW); buyBar._baseScale = 1;
      buyBar.position.set(W/2, barY - buyBg.height*0.5 - 9);
      const bk = portrait ? 0.92 : hudK*0.82;
      buyTitle.scale.set(bk); buyCost.scale.set(bk);
      buyTitle.position.set(0,-buyBg.height*0.22);
      buyCost.position.set(0,-buyBg.height*0.03);
    }
    }   // ── end native-bar branch (else of `if(usingDeliveredBar)`)

    // win celebration popup — centred in the reel matrix, ~2× larger
    winDisplay.position.set(W/2, GY+GH*0.5);
    fitW(winFrame, Math.min(640*hudK, GW*1.35, W*0.82));
    bigWinLabel.scale.set(hudK*1.4);
    bigWinLabel.position.set(0,-winFrame.height*0.28);
    // amount sits centred on the velvet panel (scale auto-fitted live in render)
    bigWinAmount.position.set(0, winFrame.height*0.055);

    // feature banner — position only. (The width fit is now handled inside
    // drawFeatureBannerPanel by scaling the LABEL; the old fitW(fbBg,…) here was a
    // sprite fit that set this Graphics' scale to NaN and hid the panel. 2026-06-01)
    featureBanner.position.set(W/2, GY+GH*0.5);

    // replay bar
    if(replayBar.visible) layoutReplayBar();

    if(drawerLayer.visible) layoutDrawer();
    if(infoModal.visible) layoutInfoModal();
    if(buyModal.visible) layoutBuyModal();
    if(betMenu.visible) layoutBetMenu();   // BETMENU-RESIZE: re-fit bet carousel on rotate/resize so MAX BET + BUY BONUS stay reachable at Popout S
    if(introOverlay.visible) layoutIntroOverlay();
  }

  // ── REEL SPIN ENGINE ──────────────────────────────────────────
  const easeOutQuint = p => 1 - Math.pow(1-p,5);
  // Reel motion — integrated trapezoidal velocity: smooth accelerate (10%) →
  // constant cruise (50%) → smooth decelerate (40%). Monotonic, lands exactly
  // at 1, C²-continuous. The reel is VISIBLY decelerating right up to p=1 — so
  // the landing overshoot reads as the arrival, not a wobble on a stopped reel
  // (easeOutQuint was 99.8% done by p=0.6, leaving a dead "creep" the eye reads
  // as stopped — which is why the settle looked like a detached second motion).
  function reelEase(p){
    const a=0.10, d=0.34;   // decel 40%→34% — trims the draggy ease-out tail (web-animations: speed beats delight). Launch (a) unchanged.
    const S = x => x*x*x*(1 - 0.5*x);            // ∫ smoothstep — S(0)=0, S(1)=0.5
    const norm = 1 - a*0.5 - d*0.5;
    let pos;
    if(p < a)        pos = a*S(p/a);
    else if(p < 1-d) pos = a*0.5 + (p-a);
    else             pos = a*0.5 + (1-d-a) + d*(0.5 - S((1-p)/d));
    return pos / norm;
  }
  // celebration easing — one snappy overshoot, settles exactly at 1 (cute pop)
  const outBack = p => { const c=1.70158; return 1 + (c+1)*Math.pow(p-1,3) + c*Math.pow(p-1,2); };
  // ── 3-BEAT CEREMONY EASINGS (2026-06-09 elegant win-ceremony redesign) ──
  const easeOutExpo = p => p >= 1 ? 1 : 1 - Math.pow(2, -10 * p);    // count: fast → settle
  const easeInCubic = p => p * p * p;                                 // exit: deliberate, accelerating
  // gentler overshoot than outBack's 1.70158 — premium, not a cartoon spring
  const backOutSoft = p => { const c=1.25; return 1 + (c+1)*Math.pow(p-1,3) + c*Math.pow(p-1,2); };
  // damped-elastic landing pop, 0→peak(≈+0.32)→0 over its window; sharper "hit"
  // than a sin() bounce (peak near p≈0.17, fully settled by 1).
  const popElastic = p => (p <= 0 || p >= 1) ? 0 : Math.sin(p * 9.0) * Math.pow(1 - p, 2.2);

  // === CINEMATIC LIGHT TOOLKIT (2026-06-09) — replaces electric/arcane FX with
  // volumetric light. ALL procedural additive Graphics (NO GLSL → Stake-safe,
  // silent), brand palette only, _gpuWeak-aware, no per-frame allocation. ===
  function _godRays(g, cx, cy, R, prog, rot, col, n, alphaMul){
    if(prog <= 0) return;
    n = n || (_gpuWeak ? 7 : 12);
    alphaMul = (alphaMul == null) ? 1 : alphaMul;
    col = col || 0xff2ad0;
    for(let i = 0; i < n; i++){
      const a = rot + (i / n) * Math.PI * 2;
      const len = R * (i % 2 === 0 ? 1.0 : 0.62) * prog;     // alternate long/short = volumetric
      const halfW = R * (0.052 + (i % 3) * 0.014);
      const ux = Math.cos(a), uy = Math.sin(a) * 0.74;       // vertical squash = stage perspective
      const px = -Math.sin(a), py = Math.cos(a) * 0.74;
      const tx = cx + ux * len, ty = cy + uy * len;
      const sh = 0.5 + 0.5 * Math.sin(rot * 6 + i * 1.7);    // per-shaft shimmer
      g.poly([cx, cy, tx + px * halfW, ty + py * halfW, tx - px * halfW, ty - py * halfW])
        .fill({ color: col, alpha: (0.018 + 0.030 * sh) * prog * alphaMul });
    }
  }
  function _seedDust(n, W, H){
    n = _gpuWeak ? Math.round(n * 0.55) : n;
    const out = [];
    for(let i = 0; i < n; i++){
      out.push({ x: vrnd() * W, y: vrnd() * H, r: 0.6 + vrnd() * 1.8,
        vy: -(0.12 + vrnd() * 0.5), vx: (vrnd() - 0.5) * 0.18,
        ph: vrnd() * 6.283, tw: 0.4 + vrnd() * 1.6, depth: 0.35 + vrnd() * 0.65 });
    }
    return out;
  }
  function _drawDust(g, arr, W, H, now, prog){
    if(!arr || prog <= 0) return;
    for(const m of arr){
      m.y += m.vy * m.depth; m.x += m.vx * m.depth;
      if(m.y < -4){ m.y = H + 4; m.x = vrnd() * W; }
      if(m.x < -4) m.x = W + 4; else if(m.x > W + 4) m.x = -4;
      const tw = 0.45 + 0.55 * Math.sin(now * 0.001 * m.tw + m.ph);
      const col = m.depth > 0.62 ? 0xffe6f4 : 0xff8ad0;
      g.circle(m.x, m.y, m.r * (0.7 + 0.5 * m.depth) * (0.7 + 0.5 * tw))
        .fill({ color: col, alpha: 0.05 * m.depth * tw * prog });
    }
  }
  function _milledNumber(g, w, h, col, now, sweepMs, landI){
    g.clear();
    const hw = w * 0.5, hh = h * 0.5;
    g.roundRect(-hw * 1.04, -hh * 0.86 + h * 0.10, w * 1.08, h * 0.92, hh * 0.4)
      .fill({ color: 0x05030a, alpha: 0.28 + 0.10 * landI });
    g.roundRect(-hw * 1.02, -hh * 0.80, w * 1.04, h * 0.86, hh * 0.42)
      .stroke({ color: col, width: 2.0, alpha: 0.30 + 0.45 * landI });
    g.roundRect(-hw * 1.02, -hh * 0.80, w * 1.04, h * 0.86, hh * 0.42)
      .stroke({ color: 0xffe6f4, width: 0.8, alpha: 0.20 + 0.55 * landI });
    const sw = sweepMs > 0 ? ((now % sweepMs) / sweepMs) : -1;
    if(sw >= 0){
      const x = -hw * 1.1 + sw * (w * 1.2);
      const sa = Math.sin(sw * Math.PI) * (0.16 + 0.18 * landI);
      const bw = w * 0.10;
      g.poly([x - bw, -hh * 0.78, x + bw, -hh * 0.78, x + bw * 1.8, hh * 0.78, x, hh * 0.78])
        .fill({ color: 0xffffff, alpha: sa });
    }
  }
  function _groundGlow(g, cx, baseY, R, col, prog, pulse){
    if(prog <= 0) return;
    pulse = (pulse == null) ? 1 : pulse;
    for(let k = 3; k >= 1; k--){
      g.ellipse(cx, baseY, R * (0.40 + k * 0.26) * pulse, R * (0.07 + k * 0.035))
        .fill({ color: k === 1 ? 0xffe6f4 : col, alpha: (k === 1 ? 0.13 : 0.05) * prog });
    }
  }
  function _cineEntrance(dir, p, cx, cy, travel){
    if(isReduced() || p >= 1) return { x: cx, y: cy, s: 1, a: 1 };
    const e = backOutSoft(Math.min(1, p));
    const a = Math.min(1, p * 2.0);
    const off = (1 - e) * (travel || 220);
    let x = cx, y = cy;
    if(dir === 'top') y = cy - off;
    if(dir === 'bottom') y = cy + off;
    if(dir === 'left') x = cx - off;
    if(dir === 'right') x = cx + off;
    return { x, y, s: 0.82 + 0.18 * e, a };
  }
  // ── DAMPED SETTLE — unit-normalised spring impulse, peak = 1.0 at tau≈0.21.
  // 19.2·tau·e^(-6.5·tau)·sin(2π·tau): the tau factor gives a tau²-eased onset
  // (C¹ — no pop-in), the e^(-6.5·tau) envelope is heavily damped so there is
  // ONE soft cushion and a single ~15% rebound, fully settled to 0 by tau=1.
  // This is the ONLY landing curve — the reel-column dip and every symbol's
  // squash both read from it, so the impact and its echo stay perfectly in
  // sync across every spin case (normal · turbo · quick-stop · anticipation).
  function settleCurve(tau){
    if(tau<=0 || tau>=1) return 0;
    return 19.2 * tau * Math.exp(-6.5*tau) * Math.sin(tau*6.28319);
  }
  let allReelsSpinning = false;
  // Quick-stop fires ONCE per spin. Without this guard a rapid 2nd tap re-enters
  // quickStopReels() and resets every reel's from/t0/dur mid-animation → the reels
  // visibly jump/"crash". Re-armed (false) when a new spin's reels launch.
  let _qStopped = false;
  let onAllReelsStopped = null;

  function reelFeed(rl){
    if(rl.feedIdx < rl.feed.length) return rl.feed[rl.feedIdx++];
    return Math.floor(vrnd()*SYM_COUNT);
  }
  function shiftReel(rl){
    rl.symbols.unshift(reelFeed(rl));
    rl.symbols.pop();
  }
  // Spin reel r so the final visible window = target [t0,t1,t2] (top,mid,bot).
  function spinReelTo(r,target,dur,delay){
    const rl=reels[r];
    const totalShifts = 20 + r*3;
    const feed=[];
    const buf = Math.floor(vrnd()*SYM_COUNT);
    for(let i=0;i<totalShifts-4;i++) feed.push(randStripSym(r));
    feed.push(target[2],target[1],target[0],buf);  // last 4 land the window
    rl.feed=feed; rl.feedIdx=0;
    rl.totalShifts=totalShifts;
    rl.from=0; rl.to=totalShifts; rl.scrolled=0; rl.done=0; rl.offset=0;
    rl._prevScr=0; rl.vel=0;
    rl.t0=performance.now()+delay; rl.dur=dur; rl.spinning=true;
    rl.landAt=0; rl.squashStarted=false;
  }
  function quickStopReels(){
    if(_qStopped) return;          // re-entry guard — one quick-stop per spin (kills the rapid-tap reel jump/crash)
    _qStopped = true;
    const now=performance.now();
    // HARD-SNAP quick-stop (2026-06-04) — owner reported the previous version
    // (24ms stagger, 80–180ms dur, ~280ms worst-case) still read as a slow
    // "crushing" deceleration on click-to-stop instead of a fast snap.
    // Tightened to AAA snap-stop feel:
    //   stagger 24 → 8 ms  (5 reels × 8 = 40 ms cascade — chunky, near-instant)
    //   dur     80–180 → 55–100 ms (cap halved; cubic ease-out now reads as
    //                                a single firm impact, not a wind-down)
    //   worst   reel4 starts t+32, runs 100 → settles at t+132 (was t+276)
    // Min duration 55ms stays above the ~50ms human-perception teleport
    // threshold so the reel still reads as "stopping" not "vanishing".
    reels.forEach((rl, r) => {
      if(!rl.spinning) return;
      rl.from=rl.scrolled; rl.to=rl.totalShifts;
      rl.t0 = now + r*8;
      rl.dur = Math.max(55, Math.min(100, (rl.totalShifts-rl.scrolled)*5));
    });
  }
  // advance reels each frame (called from ticker)
  function tickReels(){
    if(!allReelsSpinning) return;
    const now=performance.now();
    let anySpinning=false;
    for(let r=0;r<REELS;r++){
      const rl=reels[r];
      if(!rl.spinning) continue;
      anySpinning=true;
      if(now < rl.t0) continue;
      const p=Math.min(1,(now-rl.t0)/rl.dur);
      const e=reelEase(p);
      rl.scrolled = rl.from + (rl.to-rl.from)*e;
      rl.vel = rl.scrolled - rl._prevScr; rl._prevScr = rl.scrolled;   // cells/frame — drives the motion smear
      const passed=Math.floor(rl.scrolled);
      let guard=0;
      while(rl.done<passed && guard++<200){ shiftReel(rl); rl.done++; }
      rl.offset = (rl.scrolled-Math.floor(rl.scrolled))*CELL;
      // ── ANTICIPATION KICK — owner-tightened for INSTANT launch ─
      // Reel tenses upward then releases into the launch. The 0.06
      // window (26ms on a 440ms cruise) was a perceptible windup the
      // owner read as a "delay before move" on click. C¹ continuity
      // preserved (q²(1-q)² still zeros value AND velocity at both
      // ends) but window halved 0.06 → 0.025 and magnitude halved
      // CELL*1.0 → CELL*0.5, so the wind-up is ~11ms × half-amplitude.
      // Reads as a tiny pre-launch tension, not a wait — reels visibly
      // drop within ~10–15ms of commit instead of ~30ms.
      if(p<0.025 && !isReduced() && !State.turbo){
        const u=p/0.025;
        rl.offset -= CELL*0.5 * u*u*(1-u)*(1-u);
      }
      // LANDING — armed once the reel has all but arrived (p>=0.965 ⇒ only ~2%
      // of cruise speed remains, so the settle reads as the arrival itself, not
      // a detached after-bounce on an already-stopped reel). From here a single
      // damped spring (settleCurve, applied in renderReels) drives BOTH the
      // rigid column dip and the per-symbol squash. No reel-offset overshoot is
      // injected here — the scroll simply decelerates cleanly to rest.
      if(p>=0.965 && !rl.squashStarted){ rl.landAt=now; rl.squashStarted=true; }
      if(p>=1){
        // finalize — snap exactly to target (settle envelope is already 0 here)
        while(rl.done<rl.totalShifts && guard++<400){ shiftReel(rl); rl.done++; }
        rl.offset=0; rl.spinning=false;
        // 2026-05-27 fix — force motion blur to zero AT the stop frame so
        // the player never sees a 1-2 frame "soft" stop. The asymmetric
        // ease-out lerp (0.18 decay) was leaving ~90ms of post-stop blur
        // visible per user "blur effect is delayed hiding on the stop
        // case player see the blured effect".
        rl._blurAmt = 0;
        rl.vel = 0; rl._prevScr = rl.scrolled;
        if(rl.col.filters === rl.blurArr) rl.col.filters = null;
        // Tier-aware reel-stop chord — top symbol drives the chord choice:
        //   CROWN (sym 7) → brass swell, SEVEN (sym 6) → bell, else fruit thunk.
        Sound.reelStop(r, rl.symbols[1]);
        if(!isReduced()) Sound.tick();
        // EPIC SCATTER LAND — if this reel landed a STAR scatter, ring an
        // escalating epic chime (count climbs across reels, reels stop L→R).
        if(r === 0) State._scatLandN = 0;
        if(rl.symbols && (rl.symbols[0] === STAR || rl.symbols[1] === STAR || rl.symbols[2] === STAR)){
          State._scatLandN = (State._scatLandN || 0) + 1;
          try { Sound.scatterLand(State._scatLandN); } catch(e){}
        }
      }
    }
    if(!anySpinning && allReelsSpinning){
      allReelsSpinning=false;
      const cb=onAllReelsStopped; onAllReelsStopped=null;
      if(cb) cb();
    }
  }
  let _renderPrev = 0;
  function renderReels(){
    const sz=CELL*0.92, now=performance.now();   // symbols fill more of each cell
    // landing-settle timing — tighter + snappier per turbo mode so it never drags
    const tm = State.turboMode;
    const symDur  = tm===2 ? 130 : tm===1 ? 165 : 250; // single symbol settle (ms) — normal 300→250 so the landing cushion stays proportional to the faster spin
    const symStag = tm===2 ?  18 : tm===1 ?  26 :  40; // bottom→top ripple stagger
    const landDip = tm===2 ? 0.030 : tm===1 ? 0.038 : 0.052; // overshoot fraction
    const landSq  = tm===2 ? 0.034 : tm===1 ? 0.042 : 0.055; // squash depth
    const reduced = isReduced();
    // ── FRUIT WIN-POP gate (2026-06-01) — winning FRUIT symbols get a gentle
    // scale "win" reaction (the procedural side of the hybrid idle/land/win;
    // premium crown/star/7 use Spine). Built once per frame from shared winCells.
    // Fires ONLY on a win → honors "fruits static at idle".
    const _wActive = revealActive && winCells.length > 0 && !reduced;
    const _wSet = _wActive ? new Set(winCells.map(c => c.r + '_' + c.row)) : null;
    const _wT = _wActive ? (now - revealT0) : 0;
    // frame delta (clamped) — keeps the idle envelope frame-rate independent
    const dtK = _renderPrev ? Math.min(4, (now-_renderPrev)/16.67) : 1;
    _renderPrev = now;
    for(let r=0;r<REELS;r++){
      const rl=reels[r];
      // VELOCITY MOTION BLUR — a directional (vertical) GPU blur scaled to reel
      // speed. It eases in only once the reel is genuinely fast and eases out
      // before it lands (velocity is C²-smooth via reelEase ⇒ smooth ramp), so
      // symbols read crisp at rest and softly streaked at speed — no scale
      // distortion. Replaces the old tall/thin scale-stretch smear.
      if(!rl.blurF){ rl.blurF = new PIXI.BlurFilter({ strength:2, quality:2 }); rl.blurArr=[rl.blurF]; }
      // VELOCITY MOTION BLUR — temporally damped so quickStop / sudden
      // velocity drops decay the blur smoothly (Emil "transitions must
      // be interruptible AND ease back, never snap"). Previously a
      // sudden vel=0 (quickStop fires, scrolled jumps) would pop the
      // blur off in one frame ⇒ jarring snap. Now we lerp blurAmt
      // toward the target with asymmetric decay: fast ramp-IN (0.5 ≈
      // 30ms — blur appears as the reel accelerates), gentle ramp-OUT
      // (0.18 ≈ 90ms — blur fades as the reel settles, no snap).
      const spd = (rl.spinning && !reduced) ? Math.abs(rl.vel) : 0;
      const targetBlur = spd>0.12 ? Math.min(1,(spd-0.12)/0.25) : 0;
      if(rl._blurAmt == null) rl._blurAmt = 0;
      const blurDecay = targetBlur > rl._blurAmt ? 0.5 : 0.18;
      rl._blurAmt += (targetBlur - rl._blurAmt) * blurDecay;
      const blurAmt = rl._blurAmt;
      if(blurAmt>0.015){
        if(rl.col.filters!==rl.blurArr) rl.col.filters = rl.blurArr;
        rl.blurF.strength = blurAmt*CELL*0.08;      // uniform fallback
        rl.blurF.strengthY = blurAmt*CELL*0.08;      // vertical motion streak (v8.3 blurY->strengthY)
        rl.blurF.strengthX = blurAmt*CELL*0.012;     // a hair of horizontal (blurX deprecated -> console.warn)
      } else if(rl.col.filters){
        rl.col.filters = null;
      }
      // IDLE ENVELOPE — the idle breathing must never pop on/off. This eases
      // 0→1 when the reel comes to rest and 1→0 when it spins/lands, so the
      // idle sinusoid is always faded toward zero across a state change ⇒
      // every transition (spin⇄idle, land⇄idle) is C¹-continuous, no snap.
      const wantIdle = (!rl.spinning && !rl.landAt && !reduced) ? 1 : 0;
      if(rl.idleEnv==null) rl.idleEnv = wantIdle;
      rl.idleEnv += (wantIdle - rl.idleEnv) * Math.min(1, (wantIdle?0.055:0.16)*dtK);
      const env = rl.idleEnv;
      // COLUMN DIP — the reel band over-travels then springs back as ONE rigid
      // body: a single settleCurve sample (NO per-row stagger) so the rows can
      // never spread apart. This dip and the per-symbol squash below read from
      // the SAME curve ⇒ the impact and its rebound stay perfectly in sync.
      let colDip = 0;
      if(rl.landAt && !reduced)
        colDip = settleCurve((now - rl.landAt) / symDur) * CELL * landDip;
      for(let k=0;k<5;k++){
        const s=rl.sprites[k];
        s.texture=SYM_TEX[rl.symbols[k]];
        s.y=(k-0.5)*CELL + rl.offset + colDip;  // rl.offset = scroll · colDip = settle
        const base=symScale(s.texture, sz);     // contain-fit, preserve aspect
        let sqx=1, sqy=1, rot=0;
        if(rl.landAt && !reduced){
          // SQUASH ripples bottom→top (k=3 first) — each symbol cushions as the
          // landing shockwave reaches it. Same settleCurve as the column dip, so
          // a symbol bottoms out in its squash exactly when the band does. The
          // tau²-eased onset ⇒ no pop-in; the heavy damping ⇒ ONE soft jelly press.
          const e = settleCurve((now - rl.landAt - Math.max(0,3-k)*symStag) / symDur);
          sqy = 1 - e*landSq;          // gentle vertical cushion
          sqx = 1 + e*landSq*0.6;      // squash-and-stretch — soft, not springy
        }
        // IDLE LIFE — premium-symbol-only breathing. User spec: small fruit
        // symbols read as static (calm), only Crown (sym 7) + Seven (sym 6)
        // get the breath/float/sway treatment so the eye is drawn to the
        // high-pay icons. Plus a stronger amplitude for Crown (top symbol).
        // Star (sym 8 — scatter) also breathes so the player sees the
        // bonus trigger glittering.
        const sym = rl.symbols[k];
        const isPremium = sym >= 6;   // Seven, Crown, Star
        // Reset tint each frame — only premium symbols get the brightness pulse
        if(s.tint !== 0xffffff) s.tint = 0xffffff;
        if(env > 0.0015){
          const isCrown = sym === 7;
          const isStar  = sym === 8;
          const isSeven = sym === 6;
          // SMALL FRUIT SYMBOLS ARE STATIC (2026-06-01, user: "remove the idle
          // animation on the small symbols"). Only the premium high-pay icons
          // (Seven/Crown/Star) keep the breath/float/sway so the eye is drawn to
          // them; fruits read calm + still. ampK = 0 zeroes wob/float/rot below.
          // Premium symbols breathe strongly; fruits get a SUBTLE idle now (2026-06-01,
          // user: "fully static small symbols not cool — a little motion"). 0.42 = a
          // gentle calm breathe, well below the premium amplitude so the eye still
          // reads the high-pay icons as the lively ones.
          const ampK = isCrown ? 1.7 : isStar ? 1.25 : isSeven ? 1.35 : 0.42;
          const ph = r*0.9 + k*1.7;
          const wob = Math.sin(now*0.0021 + ph) * 0.030 * ampK * env;
          sqx *= 1 + wob;
          sqy *= 1 + wob;
          s.y += Math.sin(now*0.0017 + ph*1.3) * 2.6 * ampK * env;
          rot   = Math.sin(now*0.0015 + ph) * 0.020 * ampK * env;
         if(isPremium){
          // ── BRIGHTNESS PULSE (2026-05-27 AAA premium symbol life) ────
          // Premium symbols pulse warmer tint (closer to white) every 3s
          // so they read as "more valuable" without overwhelming the eye.
          // Crown gets the strongest pulse, Seven moderate, Star subtle.
          // PIXI tint multiplies the symbol texture, so brightening means
          // increasing the tint above 0xffffff is NOT possible — instead
          // we shift toward warm white (0xfff5e0) and back to natural.
          const pulsePer = isCrown ? 2400 : isSeven ? 2800 : 3600;
          const pulseP = ((now + ph * 200) % pulsePer) / pulsePer;
          // Triangular wave: peak at 0.5, zero at 0/1
          const pulseEnv = 1 - Math.abs(pulseP * 2 - 1);
          // Pulse intensity per symbol family
          const pulseMax = isCrown ? 0.18 : isSeven ? 0.12 : 0.08;
          const lift = pulseEnv * pulseMax * env;
          // Lerp white toward warm white via R-only boost (since native
          // texture is already saturated, only minor channel lift reads)
          if(lift > 0.005){
            const ch = Math.round(255 - lift * 28);
            // Crown gets a slight pink lean, Seven a slight gold lean,
            // Star a slight smoke-white lean
            const tR = 255;
            const tG = isCrown ? ch : isSeven ? Math.round(255 - lift * 18) : ch;
            const tB = isCrown ? Math.round(ch + lift * 14) : isSeven ? ch - 18 : ch;
            s.tint = (tR << 16) | (Math.max(0, tG) << 8) | Math.max(0, tB);
          }
         }
        }
        // ── FRUIT WIN-POP — gentle scale pulse on a winning FRUIT cell only
        // (k=1..3 are the visible rows → row = k-1). Fires on win, never at idle.
        if(_wSet && sym < 6 && k >= 1 && k <= 3 && _wSet.has(r + '_' + (k-1))){
          const ct = _wT - (k-1) * 55;                  // soft bottom-anchored cascade
          if(ct > 0){
            const popE = 1 - Math.pow(1 - Math.min(1, ct/240), 3);   // ease-out in
            const breathe = 0.5 + 0.5*Math.sin(now*0.006 + r*0.7);   // settle into a soft pulse
            const amp = 0.10 * popE * (0.62 + 0.38*breathe);
            sqx *= 1 + amp; sqy *= 1 + amp;
          }
        }
        s.scale.set(base*sqx, base*sqy);   // motion = GPU blur, not scale-stretch
        s.rotation = rot;
      }
      if(rl.landAt && now-rl.landAt > symDur + 3*symStag + 80) rl.landAt=0;
    }
  }

  function delay(ms){ return new Promise(r => setTimeout(r,ms)); }

  // ── WIN PRESENTATION ──────────────────────────────────────────
  const winFx = { on:false, t0:0, tier:0, dur:0, fastFwd:false,
    countX6Target:0, countX6Display:0, popT0:0,
    tAnt:0, tLand:0, landFired:false,   // 3-beat schedule (anticipation→count→savour) + savour-fire latch
    // customLabel: optional override for the ribbon (e.g. "FREE SPINS WIN")
    // — set externally before winFx.on = true. If set, the draw code uses
    // this instead of the tier→label mapping. Cleared at celebrate() entry.
    customLabel: '' };
  // INTERRUPTIBLE CELEBRATION (2026-06, #16) — resolve after `ms` OR when the player
  // taps/Spaces to skip (winFx.fastFwd). Lets fast players dismiss a long win
  // ceremony (up to ~2.8s) instead of being trapped with no agency. The render loop
  // turns fastFwd into the EXISTING natural-end teardown; this just unblocks the await.
  const waitWinOrSkip = (ms) => new Promise((res) => {
    const t0 = performance.now();
    const tick = () => { if(winFx.fastFwd || (performance.now() - t0) >= ms) return res(); requestAnimationFrame(tick); };
    tick();
  });
  let winCells = [];      // [{r,row}]
  let winLines = [];      // line indices to draw
  let revealActive = false, revealT0 = 0, revealDur = 0, winVfxTier = 0;

  function cellCenter(r,row){
    return { x:GX+(r+0.5)*CELL, y:GY+(row+0.5)*CELL };
  }

  // ── WIN VFX — fantasy-minimalist CGI for the winning symbols ────────────
  // Per winning cell: a soft radial glow + a symbol-shaped bloom aura behind
  // the reels (symbol always on top), one clean thin frame that contracts on
  // like a selection reticle, a soft 3D shadow, and sparse magical ember dust
  // rising behind the symbol. No corner dots / rays / sparkle clutter.
  let _fireClock = 0;
  const DUST_COLS = [0xff8ad0, 0xff5ab0, 0xffd9ec];  // magenta-crystal ember dust (was gold cream/amber — off the black/magenta-villain brand, 2026-06-01)
  function spawnFire(x,y){
    // soft magical ember dust — slow buoyant rise, gentle drift, long life
    particles.push({ kind:'fire', x, y, vx:(vrnd()-0.5)*0.5,
      vy:-0.7-vrnd()*1.0, life:920+vrnd()*680, t:0,
      color:DUST_COLS[(vrnd()*DUST_COLS.length)|0], r:2.5+vrnd()*3.5 });
  }
  function drawWinVfx(now, active){
    winShadowG.clear(); winGlowAddG.clear(); winFrameG.clear(); winSheenG.clear();
    for(const rl of reels){ for(const gl of rl.glows) gl.visible=false; for(const hr of rl.heroes){ hr.visible=false; hr.rotation=0; hr.skew.x=0; }
      for(const sp of rl.sprites){ if(sp._winHidden){ sp.alpha=1; sp._winHidden=false; } } }   // restore any symbol hidden behind a hero last frame
    if(!active){ winGlowLayer.filters=null; return; }
    const reduced = isReduced();
    const tier = winVfxTier || 1;
    const vfx  = tier >= 2 && !reduced;          // tier-1 LDW return → neutral frame only
    const half = CELL*0.5, rad = CELL*0.19;
    winGlowLayer.filters = vfx ? [winBloomFilter] : null;
    for(const c of winCells){
      const cc = cellCenter(c.r, c.row);
      const ct = (now - revealT0) - c.r*55;       // gentle left→right cascade
      const appear = reduced ? 1 : Math.max(0, Math.min(1, ct/300));
      if(appear<=0) continue;
      // selection reveal — the frame eases-contracts onto the cell as it fades in
      const ease = appear<1 ? 1-Math.pow(1-appear,3) : 1;
      const boxK = reduced ? 1 : (1.13-0.13*ease) * (1+Math.sin(now*0.0042+c.r*0.7)*0.018);
      const bw = CELL*0.95*boxK, bh = bw;
      const x0 = cc.x-bw/2, y0 = cc.y-bh/2;

      // soft radial glow behind the symbol (additive, below the reels)
      if(vfx){
        const gp = 0.78 + 0.22*Math.sin(now*0.0045 + c.r);
        for(let g=3; g>=1; g--){
          // magenta-crystal radial bloom (was gold cream 0xffe9bc / amber 0xffb968)
          winGlowAddG.circle(cc.x, cc.y, half*(0.5+g*0.34))
            .fill({ color: g===1?0xffd9ec:0xff2f93, alpha:(g===1?0.16:0.07)*gp*appear });
        }
      }

      // soft 3D drop-shadow on the cell floor
      winShadowG.ellipse(cc.x, cc.y+half*0.72, half*0.6*ease, half*0.19*ease)
        .fill({ color:0x000000, alpha:0.3*appear });

      // WIN-SYMBOL TREATMENT (2026-05-31 redesign per user feedback):
      //  • SIMPLE fruit symbols (id < 6) stay STATIC inside the reel — no pop,
      //    no copy. The frame + radial glow do the highlighting. (No crop, since
      //    a static symbol never exceeds the reel window; no double image.)
      //  • PREMIUM symbols (Seven=6, Crown=7, Star=8) get ONE opaque hero copy on
      //    the unmasked top layer that pops a touch past the frame uncropped. It's
      //    fully OPAQUE so it covers the masked original — no "original + ghost"
      //    double. The old additive symbol-copy (the bleed-past-edge ghost) is gone.
      if(vfx){
        const _sym  = reels[c.r].symbols[c.row+1];
        if(_sym >= 6){
          const _stex = SYM_TEX[_sym];
          // (uniform spring scale computed below — see ONE-SHOT SPRING POP)
          // ── DOUBLE-IMAGE FIX (2026-05-31) ───────────────────────────────
          // The hero MUST exactly overlay the real symbol, then pop. The old
          // cellCenter + CELL*0.92 sizing put it ~23px low AND undersized
          // (w154 vs the real 204) so BOTH showed = the "doubling" bug. Now we
          // copy the original sprite's exact WORLD position + WORLD scale (so it
          // lines up regardless of the reel-column mask offset), then apply pop —
          // AND hide the real symbol while the hero is up, so there is never a
          // second symbol behind it. The original is restored in the reset loop.
          const _o = reels[c.r].sprites[c.row+1];           // the real (masked) symbol
          const hr = reels[c.r].heroes[c.row+1];
          hr.visible = true;
          hr.texture = _stex;
          hr.anchor.set(_o.anchor.x, _o.anchor.y);
          const _lp = winHeroLayer.toLocal(_o.getGlobalPosition());
          const _wt = _o.worldTransform, _ht = winHeroLayer.worldTransform;
          const _oWS = Math.hypot(_wt.a, _wt.b), _hWS = Math.hypot(_ht.a, _ht.b) || 1;
          const _baseS = _oWS / _hWS;                        // match the real symbol's on-screen size
          // ── ADVANCED PREMIUM WIN MOTION (2026-06-01) ─────────────────────────
          // Stake-safe procedural "advanced motion" — chosen over real-Spine-in-prod
          // to keep the single-file build ~2.5 MB and the console silent (Spine would
          // add ~1 MB + texture-load warnings = approval risk). The hero symbol runs a
          // multi-phase CEREMONY, all on UNIFORM scale (zero skew/shear — the old
          // continuous skew read as a funhouse wobble and was cut):
          //   1. ANTICIPATION — a tiny squash wind-up (0-70 ms) BEFORE the pop so the
          //      punch lands with weight (web-animations: anticipation = felt power).
          //   2. RISE — fast ease-out to the settle size.
          //   3. PUNCH — a decaying overshoot that fires AFTER the dip → springy snap.
          //   4. SETTLE BREATHE — a gentle idle pulse once landed.
          // Plus a one-shot SHIMMER SWEEP (below): a raking light bar crosses the
          // symbol face once — the "advanced" signature, faking a Spine light sweep
          // with zero GLSL / zero extra texture, drawn on winSheenG (above the hero).
          const _ct2   = Math.max(0, ct);
          const _antic = _ct2 < 70 ? -0.05 * Math.sin((_ct2/70)*Math.PI) : 0;          // wind-up squash 0→-0.05→0
          const _rise  = 1 - Math.pow(1 - Math.min(1, _ct2/240), 3);                    // ease-out 0→1 (240ms)
          const _punch = Math.sin(Math.min(Math.PI, Math.max(0,_ct2-55)/85)) * Math.exp(-_ct2/280); // overshoot AFTER the dip
          const _breathe = _ct2 > 620 ? 0.013 * Math.sin(now*0.0047 + c.r*0.7) : 0;     // gentle settle pulse
          const _s = _baseS * (1 + _antic + 0.10*_rise + 0.14*_punch + _breathe);       // dip → ~1.18 peak → ~1.10 rest
          hr.position.set(_lp.x, _lp.y);                     // pop IN PLACE — no bob
          hr.scale.set(_s, _s);                              // UNIFORM — no foreshorten / no skew
          hr.skew.x = 0; hr.rotation = 0;
          hr.alpha = 1;
          _o.alpha = 0; _o._winHidden = true;               // hide the real symbol → zero double
          // SHIMMER SWEEP — a bright slanted light bar rakes left→right across the hero
          // face ONCE (110-470 ms), brightest at mid-pass. Reads as light catching a
          // cut-crystal facet. Travels a touch beyond both edges so entry/exit are clean.
          const _sw = (_ct2 - 110) / 360;
          if(_sw > 0 && _sw < 1){
            const _swA = Math.sin(_sw*Math.PI);              // 0→1→0 envelope
            const _sx  = cc.x - half*1.25 + _sw*(CELL*1.5);  // sweep x
            const _hy  = half*0.96;
            winSheenG.poly([                                 // raked parallelogram = a light streak
              _sx-7, cc.y-_hy, _sx+7, cc.y-_hy, _sx+20, cc.y+_hy, _sx+6, cc.y+_hy,
            ]).fill({ color:0xffe6f4, alpha:0.22*_swA*appear });
            winSheenG.poly([                                 // thin hot core inside the streak
              _sx+2, cc.y-_hy, _sx+6, cc.y-_hy, _sx+15, cc.y+_hy, _sx+11, cc.y+_hy,
            ]).fill({ color:0xffffff, alpha:0.30*_swA*appear });
          }
        }
      }

      // minimalist frame — soft magenta outer edge + crisp crystal-white core
      // (was gold 0xffcf86 / cream 0xfff2cc — recolored to the villain brand,
      // matching the win-line "magenta body + white hot core" treatment)
      winFrameG.roundRect(x0-2.5, y0-2.5, bw+5, bh+5, rad+2.5)
        .stroke({ color:0xff2f93, width:Math.max(3,CELL*0.052), alpha:0.22*appear });
      winFrameG.roundRect(x0, y0, bw, bh, rad)
        .stroke({ color:0xffe6f4, width:Math.max(2,CELL*0.027), alpha:0.92*appear });

      // PREMIUM SYMBOL win — Seven & Crown get a distinct, dramatic style:
      // a rotating radiant sunburst + expanding shockwave rings behind them.
      const _sym = reels[c.r].symbols[c.row+1];
      if(vfx && _sym>=6){
        const pt = now - revealT0;
        const rays = 14, rrot = pt*0.0006 + c.r*0.5;
        for(let i=0;i<rays;i++){
          const a = rrot + i/rays*Math.PI*2;
          const fk = 0.5 + 0.5*Math.sin(now*0.006 + i*1.6 + c.r);
          const r0 = half*0.66, r1 = r0 + half*(0.5+0.42*fk);
          const ux=Math.cos(a),uy=Math.sin(a),sx=-uy,sy=ux,hw=CELL*0.05;
          winGlowAddG.poly([
            cc.x+ux*r0+sx*hw, cc.y+uy*r0+sy*hw,
            cc.x+ux*r0-sx*hw, cc.y+uy*r0-sy*hw,
            cc.x+ux*r1, cc.y+uy*r1
          ]).fill({ color:0xffd9ec, alpha:0.12*fk*appear });   // crystal pink-white rays (was gold 0xfff0c4)
        }
        for(let n=0;n<2;n++){
          const rt = (((pt + n*420) % 840) / 840);
          // STAR (8) → cyan crystal-dispersion shockwave (its "shining crystal"
          // signature, echoing the brand's crystal-edge accent); CROWN (7) →
          // bright magenta; SEVEN (6) → neon magenta. (Was gold/orange.)
          winGlowAddG.circle(cc.x, cc.y, half*(0.5 + rt*1.7))
            .stroke({ color:_sym===8?0x7fe7ff:_sym===7?0xff5ab0:0xff007f,
              width:Math.max(2,CELL*0.032)*(1-rt), alpha:0.5*(1-rt)*(1-rt)*appear });
        }
        // ── KB-INSPIRED: rotating magenta-crystal setting ring on CROWN winners
        // (Picker CardFaceWin pattern — 22s rotating ring + 16s counter-
        // rotating inner hairline + 8 embedded gem dots; recolored gold→magenta).
        if(_sym === 7 && vfx){
          const ringR = half * 1.08;
          const dashN = 24;
          const rot0 = now * 0.00038;   // outer ring spin (slow, premium)
          const rot1 = -now * 0.00055;  // inner counter-rotating
          // outer ring with dashed segments (gem-setting style)
          // PIXI v8: moveTo before arc to prevent stray lineTo from prev pt.
          for(let d = 0; d < dashN; d++){
            const a = rot0 + (d / dashN) * Math.PI * 2;
            const a2 = a + Math.PI / dashN * 0.55;
            winGlowAddG.moveTo(cc.x + Math.cos(a) * ringR, cc.y + Math.sin(a) * ringR)
              .arc(cc.x, cc.y, ringR, a, a2)
              .stroke({ color: 0xff2f93, width: 1.2, alpha: 0.55 * appear });
          }
          // 8 embedded gem dots on outer ring
          for(let g = 0; g < 8; g++){
            const a = rot0 + (g / 8) * Math.PI * 2;
            const gx = cc.x + Math.cos(a) * ringR;
            const gy = cc.y + Math.sin(a) * ringR;
            winGlowAddG.circle(gx, gy, 1.8)
              .fill({ color: 0xffe6f4, alpha: 0.85 * appear });
          }
          // inner counter-rotating hairline (dashed)
          // PIXI v8: moveTo before arc to prevent stray lineTo from prev pt.
          for(let d = 0; d < 18; d++){
            const a = rot1 + (d / 18) * Math.PI * 2;
            const a2 = a + Math.PI / 18 * 0.5;
            winGlowAddG.moveTo(cc.x + Math.cos(a) * ringR * 0.78, cc.y + Math.sin(a) * ringR * 0.78)
              .arc(cc.x, cc.y, ringR * 0.78, a, a2)
              .stroke({ color: 0xff8ad0, width: 0.6, alpha: 0.4 * appear });
          }
        }
      }
    }
    // magical ember dust — sparse + soft, rising behind the winning symbols
    if(vfx){
      _fireClock += 16;
      if(_fireClock >= 95){
        _fireClock = 0;
        for(const c of winCells){
          const cc = cellCenter(c.r,c.row);
          spawnFire(cc.x+(vrnd()-0.5)*CELL*0.5, cc.y+half*0.32);
        }
      }
    }
  }
  function winTier(mx100){
    if(mx100===0) return 0;
    const x=mx100/100;
    if(x<=1)  return 1; // RETURNED (LDW)
    if(x<3)   return 2;
    if(x<10)  return 3;
    if(x<50)  return 4;
    if(x<250) return 5;   // MEGA 50–<250 ; EPIC ≥250 (07-celebration-rules.md ladder)
    return 6;
  }
  const TIER_LABELS=['','RETURNED','WIN','NICE WIN','BIG WIN','MEGA WIN','EPIC WIN'];
  // ── VILLAIN TIER COLORS — UNIFIED MAGENTA-FAMILY PALETTE (2026-05-27)
  // Previously escalated to electric violet (0x8a2be2) on tier 5+, which
  // jumped hue families and clashed with the rest of the magenta-themed
  // game. New: stays within the pink-magenta spectrum, escalating via
  // SATURATION + BRIGHTNESS instead of hue:
  //   tier 1 RETURNED  — muted obsidian-grey (LDW neutral)
  //   tier 2 WIN       — smoke-white
  //   tier 3 NICE      — soft pink (0xff8ab8)
  //   tier 4 BIG       — bright pink (0xff5a9c)
  //   tier 5 MEGA      — neon magenta (0xff007f) — game brand accent
  //   tier 6 EPIC      — hot deep magenta (0xff0066) — most saturated
  // Reads as a cohesive escalation, no jarring color shift.
  const TIER_COLORS=[0,0x6a5870,0xf5f7fa,0xff8ab8,0xff5a9c,0xff007f,0xff0066];
  const TIER_DUR=[0,800,1500,2200,2800,3400,4000];

  // ── PAYLINES PREVIEW — show all 10 lines on the canvas briefly so
  // players see what they're playing. Triggered by tapping "10 LINES"
  // badge. Each line draws in its accent color with fade in/out.
  function showLinesPreview(){
    linesPreviewT0 = performance.now();
    linesPreviewDur = isReduced() ? 600 : 2200;
    linesPreviewG.alpha = 0;   // render loop ramps this
  }
  // point at fraction f (0-1) along a flat [x0,y0,x1,y1,…] polyline (segment-index lerp)
  function _ptAlong(flat, f){
    const n = flat.length / 2;
    if(n < 2) return [flat[0] || 0, flat[1] || 0];
    const fi = Math.max(0, Math.min(1, f)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(fi)), lf = fi - i;
    return [flat[i*2] + (flat[(i+1)*2] - flat[i*2]) * lf, flat[i*2+1] + (flat[(i+1)*2+1] - flat[i*2+1]) * lf];
  }
  // ── SHARED ENERGY FILAMENT (2026-06-02, procedural · no GLSL) ──────────────
  // Elegant "brushed light" payline used by BOTH the intro preview and the win
  // reveal: wide soft aura → colour bloom → slim colour body → bright near-white
  // core, all round-joined, + an optional single travelling SHEEN DASH (a short
  // bright stroke sliding along the wire — NEVER a dot/bead). Widths scale off
  // CELL so it stays small/elegant at every preset. Blend-agnostic: g can be
  // additive (reveal, true glow) or NORMAL (preview, with a dark under-pass).
  // pts = flat [x0,y0,x1,y1,…] already clipped to the drawn span.
  function drawEnergyFilament(g, pts, col, prog, pulse, opt){
    if(!pts || pts.length < 4) return;
    opt = opt || {};
    const k = (CELL / 90) * (opt.scale || 1);
    const core = opt.core != null ? opt.core : 0xfff6fb;
    const p = Math.max(0, Math.min(1, pulse || 0));
    const a = Math.max(0, Math.min(1, prog == null ? 1 : prog));
    const S = (w, al, c) => g.poly(pts, false).stroke({ color: c, width: Math.max(0.5, w * k), alpha: al * a, cap: 'round', join: 'round' });
    S(12 + 3 * p,   0.10 + 0.05 * p, col);   // wide soft aura
    S(6 + 1.5 * p,  0.20 + 0.07 * p, col);   // colour bloom
    S(2.6 + 0.6 * p, 0.46 + 0.10 * p, col);  // slim colour body
    S(1.2 + 0.3 * p, 0.62,           core);  // bright near-white core
    if(opt.sheen != null && opt.sheen >= 0){
      const s0 = _ptAlong(pts, Math.max(0, opt.sheen - 0.06));
      const s1 = _ptAlong(pts, Math.min(1, opt.sheen + 0.06));
      const seg = [s0[0], s0[1], s1[0], s1[1]];
      g.poly(seg, false).stroke({ color: col,  width: Math.max(1.4, 3.4 * k), alpha: 0.26 * a, cap: 'round' });
      g.poly(seg, false).stroke({ color: core, width: Math.max(0.6, 1.5 * k), alpha: 0.72 * a, cap: 'round' });
    }
  }
  function drawLinesPreviewFrame(now){
    if(!linesPreviewT0) return;
    const t = (now - linesPreviewT0) / linesPreviewDur;
    if(t >= 1){
      linesPreviewT0 = 0;
      linesPreviewG.alpha = 0;
      linesPreviewG.clear();
      return;
    }
    // ease in (first 12%) + long hold + ease out (last 18%) — the longer hold
    // guarantees a clear moment where ALL 10 lines are fully drawn + bright.
    let a;
    if(t < 0.12) a = (t / 0.12);
    else if(t > 0.82) a = 1 - ((t - 0.82) / 0.18);
    else a = 1;
    linesPreviewG.alpha = a;
    linesPreviewG.clear();
    LINES.forEach((pat, idx) => {
      const col = LINE_COLORS[idx % LINE_COLORS.length];
      const pts = [];
      for(let r = 0; r < REELS; r++){
        // Use the ACTUAL on-screen symbol position (sprite → linesPreviewG local)
        // rather than cellCenter(): cellCenter's grid-space coords didn't line up
        // with the rendered symbols on this layer, so the lines drew off-target /
        // invisible. The sprite-based coords always match what the player sees.
        const sp = reels[r] && reels[r].sprites[pat[r] + 1];
        if(sp){ const lp = linesPreviewG.toLocal(sp.getGlobalPosition()); pts.push(lp.x, lp.y); }
        else { const cc = cellCenter(r, pat[r]); pts.push(cc.x, cc.y); }
      }
      // Stagger draw so lines appear sequentially but ALL finish by t≈0.56 —
      // well before the ease-out (0.82) so every line gets a full-bright hold.
      const stagger = idx / LINES.length;
      const drawProg = Math.max(0, Math.min(1, (t - stagger * 0.25) * 3));
      if(drawProg <= 0) return;
      const segs = REELS - 1;
      const reach = drawProg * segs;
      const drawn = [pts[0], pts[1]];
      for(let s = 0; s < segs; s++){
        if(reach >= s + 1){
          drawn.push(pts[(s + 1) * 2], pts[(s + 1) * 2 + 1]);
        } else {
          const f = reach - s;
          if(f > 0){
            const x0 = pts[s * 2], y0 = pts[s * 2 + 1];
            const x1 = pts[(s + 1) * 2], y1 = pts[(s + 1) * 2 + 1];
            drawn.push(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f);
          }
          break;
        }
      }
      if(drawn.length >= 4){
        // ── ELEGANT ENERGY PAYLINE (2026-06-02) — tapered brushed-light filament.
        // No dot markers / comet beads / node discs / fat decal outline (the old
        // "plastic / dotted" look the player flagged). A whisper-thin dark under-
        // pass keeps it readable over bright symbols (NORMAL blend retained —
        // additive washed out on white), then the shared filament draws the soft
        // halo → slim body → bright core + one sliding sheen dash.
        const corePulse = 0.5 + 0.5 * Math.sin(now * 0.005 + idx);
        const sheen = isReduced() ? -1 : ((now * 0.0006 + idx * 0.13) % 1);
        linesPreviewG.poly(drawn, false).stroke({ color: 0x14060f, width: 6.5, alpha: 0.30, cap: 'round', join: 'round' }); // soft readability under-pass (was width-10/0.44 hard outline)
        drawEnergyFilament(linesPreviewG, drawn, col, 1, corePulse, { sheen, core: 0xffe6f4, scale: 0.95 });
      }
    });
  }

  function showLineWins(grid,lineWins){
    winCells=[]; winLines=[];
    lineWins.forEach(w => {
      winLines.push({ line:w.line, count:w.count });   // carry the line's OWN win length (crown-corner fix)
      const pat=LINES[w.line];
      for(let r=0;r<w.count;r++) winCells.push({ r, row:pat[r] });
    });
    if(isReduced()) return;
    const cellBurstCount = 6;
    const betX6 = State.betX6;
    lineWins.forEach((w, lineIdx) => {
      const pat = LINES[w.line];
      for(let r = 0; r < w.count; r++){
        const cc = cellCenter(r, pat[r]);
        const delay = 80 + r * 55;
        setTimeout(() => {
          if(!revealActive) return;
          spawnParticles(cc.x, cc.y, cellBurstCount, 3);
        }, delay);
      }
      // ── FLY-UP +$X.XX TEXT (2026-05-27 AAA reward feedback) ────────
      // Spawn ONE fly-up per winning line at the line's LAST winning
      // cell. `w.payLineBet` is the line's payout in bet units; multiply
      // by State.betX6 / NLINES to get the actual cash payout.
      const lastR = w.count - 1;
      const lastCC = cellCenter(lastR, pat[lastR]);
      const lineX6 = Math.round(betX6 * w.payLineBet / NLINES);
      setTimeout(() => {
        if(!revealActive) return;
        spawnFlyUpAmount(lastCC.x, lastCC.y - CELL * 0.30, lineX6);
      }, 100 + lastR * 55);
      // win-line ENERGY ZING — staggered per line (multiple lines = ascending arpeggio).
      // Gated to tier≥2 so a ≤1× RETURNED (LDW) stays audio-silent (UKGC, matches Sound.win).
      try { setTimeout(() => { if(revealActive && (winVfxTier|0) >= 2) Sound.winLine(lineIdx, w.count); }, 60 + lineIdx * 90); } catch(e){}
    });
  }
  function showScatterCells(grid){
    for(let r=0;r<REELS;r++) for(let row=0;row<ROWS;row++)
      if(grid[r][row]===STAR) winCells.push({ r, row });
  }

  // ── MICRO-SILENCE ENGINE (P1 — expert audit) ───────────────────────
  // "Silence amplifies reward perception." Before a BIG/MEGA/EPIC win
  // explodes, insert a beat of intentional stillness: freeze particle
  // spawns, dim the stage a touch, hold ~160-220ms, THEN let celebrate()
  // detonate. The contrast makes the reward read as bigger. Tier-scaled:
  // larger wins get a longer held breath.
  let _silenceUntil = 0;   // particle spawns suppressed until this ts
  async function microSilence(tier){
    if(isReduced()) return;            // accessibility: no artificial waits
    const ms = tier >= 6 ? 240 : tier >= 5 ? 200 : 160;
    _silenceUntil = performance.now() + ms;
    // Brief stage dim — the "inhale" before the burst. bg._tA is the
    // existing dim lerp target; nudge it down, it springs back as the
    // celebration bg overlay takes over.
    try { if(typeof bg !== 'undefined') bg._tA = 0.62; } catch(e){}
    await delay(ms);
  }

  function celebrate(mx100,amountX6,labelOverride){
    const tier=winTier(mx100);
    // Reset the custom-ribbon-label override so a fresh celebrate() falls
    // back to the tier→label mapping (FREE SPINS WIN, etc. set their own).
    winFx.customLabel = '';
    if(tier===1 && !COMPLY.allow_ldw_celebration){
      // LDW suppression — neutral surface, no celebration
      bigWinLabel.text='RETURNED';
      bigWinLabel.style.fill=0x9988aa;
      bigWinLabel.style.stroke = { color:0x4a3a5a, width:2, join:'round' };
      bigWinAmount.text=fmtMoney(amountX6);
      bigWinAmount.style.fill = 0xf5f7fa;
      winFx.on=true; winFx.t0=performance.now(); winFx.tier=1; winFx.dur=800;
      winFx.countX6Target = amountX6;
      winFx.countX6Display = amountX6;   // no count-up for LDW
      winFx.popT0 = 0;
      Sound.tick();
      return;
    }
    Sound.win(tier);
    // Bring winDisplay to the TOP of the stage so the celebration draws
    // over reels, bar, modals (but not over the intro overlay which is
    // managed separately). addChild moves to top if already a child.
    stage.addChild(winDisplay);
    bigWinLabel.text=socialFilter(labelOverride||TIER_LABELS[tier]);
    const tierCol = TIER_COLORS[tier] || 0xff007f;
    // Label = whitesmoke with neon stroke matching the tier (villain spec)
    bigWinLabel.style.fill = 0xf5f7fa;
    bigWinLabel.style.stroke = { color: tierCol, width: 3, join: 'round' };
    // Amount = whitesmoke (no dropShadow — caused render crash in some
    // PIXI v8 builds when set after construction)
    bigWinAmount.style.fill = 0xf5f7fa;
    // Initial text — will animate via count-up
    bigWinAmount.text = fmtMoney(0);
    winFx.on = true;
    winFx.t0 = performance.now();
    winFx.tier = tier;
    winFx.dur = isReduced() ? 600 : Math.min(COMPLY.max_animation_ms, TIER_DUR[tier]||2200);
    winFx.countX6Target = amountX6;
    winFx.countX6Display = 0;
    winFx.popT0 = 0;    // set when count-up completes → pop scale
    winFx.landFired = false;
    winFx._arc = null;  // regenerate the arcane-bolt set for this celebration
    // ── 3-BEAT SCHEDULE (anticipation → count → savour) ──────────────────
    // BEAT 1: a real held breath BEFORE the number moves (anticipation = felt
    // power), tier-scaled 150→320ms. BEAT 2: count races up to tLand, leaving a
    // ~30% SAVOUR dwell so the landing reads as the payoff, not the end.
    const _antMs = isReduced() ? 0 : (tier >= 5 ? 320 : tier >= 3 ? 240 : 150);
    winFx.tAnt  = _antMs;
    winFx.tLand = _antMs + (isReduced() ? 1 : Math.max(360, (winFx.dur - _antMs) * 0.55));
    if(tier>=2 && !isReduced()){ try { Sound.winAnticipate(tier); Sound.tallyStart(mx100/100); } catch(e){} }   // charge + pitch-climbing tally ladder under the count
    // BEAT-1 dust only (HALF the old burst); the BIG particle WAVE + full cascade
    // fire at the LANDING (popT0) in the draw loop, synced to the money moment.
    if(tier>=2 && !isReduced()) spawnParticles(app.screen.width/2, GY+GH*0.42, tier*4, tier);
    if(tier>=4 && !isReduced()){ shakeAmount=tier*3; shakeT0=performance.now(); }
    // MOTION-04 — big-win camera push-in (tier-5+, sine-eased 1.0→1.04→1.0).
    if(tier>=5 && !isReduced() && !STAKE.replay){ _camPushT0 = performance.now(); }
    // SMALL first cascade wave (40%) so the count-up isn't visually empty; the
    // full landing wave (1.0) fires at popT0 in the draw loop.
    if(tier>=4 && !isReduced()) spawnCascade(tier, false, 0.45);
  }

  // ── FS TRANSITION (cinematic enter into Free Spins scene) ─────
  // Three-beat dramatic sequence per user request "top level dramatic":
  //   beat 1 (0-280ms):   massive 48-particle gold burst from grid centre
  //                       + screen shake amount 8 + Sound.feature()
  //   beat 2 (280-580ms): rotating gold ring expands from centre (sweep
  //                       across grid like a portal opening)
  //   beat 3 (580-880ms): second smaller particle ring + hold for banner
  // Total 880ms — under 1s for snappy pacing but cinematic enough to
  // register as "something special is happening".
  async function playFsTransition(){
    if(isReduced()){ return new Promise(res => setTimeout(res, 200)); }
    // ── FREE SPINS PORTAL — replaces the old 3-beat gold particle burst with one
    // cinematic centre portal (implosion → flash + radial rays → chromatic
    // shockwave → rotating vortex), drawn by drawFsPortal on the additive
    // fsPortalG layer. Keeps the screen-shake + feature sting + the ~880 ms hold
    // so the downstream banner / FS timing is unchanged.
    spawnFsPortal();
    shakeAmount = 8;
    shakeT0 = performance.now();
    try { Sound.feature(); } catch(e){}
    await new Promise(res => setTimeout(res, 880));
  }

  // ── STANDARD FS ENTRY — "CRYSTAL BLOOM" (2026-06-01) ────────────────────────
  // The entry tier gets an elegant, refined ceremony (lighter than HOT/MEGA):
  // crystalline shards converge inward from a ring around the screen, LOCK at the
  // grid centre, and a radiant magenta-white crystal STAR blooms with an outBack
  // pop + a soft chromatic shockwave. 100% procedural (additive Graphics, vrnd
  // seeded jaggedness, NO GLSL — Stake-safe), GPU-adaptive, self-contained rAF.
  // The downstream banner/FS timing is preserved (~1.5 s, vs portal 0.88 s). The
  // single Sound.feature() is already fired by the caller (line ~7990); here we
  // only layer a distinct icy crystalline accent so each tier sounds different.
  async function playStandardFsCeremony(){
    if(isReduced()){ return new Promise(res => setTimeout(res, 220)); }
    const W = app.screen.width, H = app.screen.height;
    const gw = REELS * CELL, gh = ROWS * CELL, gx = GX, gy = GY;
    const cx = W / 2, cy = gy + gh * 0.5;
    const backdropG = new PIXI.Graphics();
    const bloomG = new PIXI.Graphics(); bloomG.blendMode = 'add';
    const shardG = new PIXI.Graphics(); shardG.blendMode = 'add';
    const starG  = new PIXI.Graphics(); starG.blendMode  = 'add';
    stage.addChild(backdropG, bloomG, shardG, starG);
    const SHARD_N = _gpuWeak ? 9 : 16;
    const maxR = Math.hypot(W, H) * 0.5;
    const shards = [];
    for(let i = 0; i < SHARD_N; i++){
      const a = (i / SHARD_N) * Math.PI * 2 + (vrnd() - 0.5) * 0.30;
      shards.push({ a, r0: maxR * (0.70 + vrnd() * 0.50), len: CELL * (0.45 + vrnd() * 0.55),
        hw: 2.4 + vrnd() * 3.2, t0: vrnd() * 0.18, col: vrnd() > 0.5 ? 0xff5ab0 : 0xffe6f4 });
    }
    shakeAmount = 5; shakeT0 = performance.now();
    try { Sound.fsCrystal(); } catch(e){}   // icy crystal entry sting (layered over the caller's feature sting)
    const t0 = performance.now(), DUR = 1500;
    await new Promise(res => {
      function step(){
        const now = performance.now(), t = (now - t0) / DUR;
        if(t >= 1){ backdropG.destroy(); bloomG.destroy(); shardG.destroy(); starG.destroy(); res(); return; }
        const outA = t > 0.74 ? Math.max(0, 1 - (t - 0.74) / 0.26) : 1;   // clean resolve
        // gentle backdrop (lighter than MEGA's 0.62)
        backdropG.clear();
        const bdA = Math.min(1, t / 0.14) * (1 - Math.max(0, (t - 0.80) / 0.20)) * 0.46;
        backdropG.rect(0, 0, W, H).fill({ color: 0x06040c, alpha: bdA });
        // CONVERGE (0-0.5): shards travel inward, fade after lock
        const conv = Math.min(1, t / 0.5);
        shardG.clear();
        for(const s of shards){
          const lt = Math.max(0, Math.min(1, (conv - s.t0) / (1 - s.t0)));
          const le = 1 - Math.pow(1 - lt, 3);
          const r  = s.r0 * (1 - le);
          const ux = Math.cos(s.a), uy = Math.sin(s.a), px = -uy, py = ux;
          const tipx = cx + ux * r, tipy = cy + uy * r;
          const talx = cx + ux * (r + s.len), taly = cy + uy * (r + s.len);
          const mx = (tipx + talx) / 2, my = (tipy + taly) / 2, hw = s.hw * (0.4 + 0.6 * le);
          const fade = (lt < 1 ? 1 : Math.max(0, 1 - (t - 0.5) / 0.20));
          if(fade <= 0.01) continue;
          shardG.poly([tipx, tipy, mx + px * hw, my + py * hw, talx, taly, mx - px * hw, my - py * hw])
            .fill({ color: s.col, alpha: 0.5 * fade });
          shardG.poly([tipx, tipy, talx, taly], false).stroke({ color: s.col, width: 1.2, alpha: 0.3 * fade });
        }
        // CRYSTAL STAR bloom (after lock, t>0.42) — outBack pop + chromatic ring
        bloomG.clear(); starG.clear();
        const bp = Math.max(0, (t - 0.42) / 0.30);
        if(bp > 0){
          const be = (bp < 1 ? 1 - Math.pow(1 - bp, 3) : 1) * outA;
          const pulse = 1 + 0.10 * Math.sin(Math.min(Math.PI, bp * Math.PI));
          const R = CELL * (0.30 + 0.85 * Math.min(1, bp)) * pulse;
          for(let k = 3; k >= 1; k--){
            bloomG.circle(cx, cy, R * (0.7 + k * 0.5))
              .fill({ color: k === 1 ? 0xffe6f4 : 0xff5ab0, alpha: (k === 1 ? 0.12 : 0.05) * be });
          }
          const PTS = 8, rotS = t * 0.55;
          for(let i = 0; i < PTS; i++){
            const a = rotS + i / PTS * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
            const rOut = R * (i % 2 === 0 ? 1.5 : 1.0), bw = R * 0.12;
            starG.poly([cx + ux * rOut, cy + uy * rOut, cx + px * bw, cy + py * bw, cx - px * bw, cy - py * bw])
              .fill({ color: 0xffe6f4, alpha: 0.5 * be });
          }
          starG.circle(cx, cy, R * 0.42).fill({ color: 0xffffff, alpha: 0.85 * be });
          starG.circle(cx, cy, R * 0.70).fill({ color: 0xff5ab0, alpha: 0.30 * be });
          if(bp > 0 && bp < 1){
            const e = 1 - Math.pow(1 - bp, 3), RR = CELL * (0.5 + e * 2.2), ra = (1 - bp) * (1 - bp) * 0.8;
            starG.circle(cx, cy, RR    ).stroke({ color: 0xff007f, width: (1 - bp) * 6 + 1,   alpha: ra * 0.7 });
            starG.circle(cx, cy, RR - 5).stroke({ color: 0xffe6f4, width: (1 - bp) * 3 + 0.5, alpha: ra });
          }
        }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // ── HOT FS ENTRY — "PLASMA IGNITION" (2026-06-01) ───────────────────────────
  // The mid tier (wild-substitute) IGNITES: molten-magenta plasma columns surge
  // UP through the reel grid with rising embers, a bright ignition flash at the
  // peak, then an expanding heat shockwave. More intense than STANDARD, lighter
  // than MEGA. 100% procedural (additive jagged streaks, vrnd seeded, NO GLSL —
  // Stake-safe), GPU-adaptive, self-contained (~1.8 s). Distinct low ignition
  // whoosh accent (the caller already fired Sound.feature()).
  async function playHotFsCeremony(){
    if(isReduced()){ return new Promise(res => setTimeout(res, 240)); }
    const W = app.screen.width, H = app.screen.height;
    const gw = REELS * CELL, gh = ROWS * CELL, gx = GX, gy = GY;
    const cx = W / 2, cy = gy + gh * 0.5, baseY = gy + gh;
    const backdropG = new PIXI.Graphics();
    const heatG   = new PIXI.Graphics(); heatG.blendMode   = 'add';
    const plasmaG = new PIXI.Graphics(); plasmaG.blendMode = 'add';
    const emberG  = new PIXI.Graphics(); emberG.blendMode  = 'add';
    stage.addChild(backdropG, heatG, plasmaG, emberG);
    const cols = [];
    for(let r = 0; r < REELS; r++){
      const offs = []; for(let s = 0; s < 6; s++) offs.push((vrnd() - 0.5) * 2);
      cols.push({ x: gx + (r + 0.5) * CELL, offs, t0: vrnd() * 0.20, w: CELL * (0.28 + vrnd() * 0.16) });
    }
    const EMB_N = _gpuWeak ? 14 : 30;
    const embers = [];
    for(let i = 0; i < EMB_N; i++){
      embers.push({ x: gx + vrnd() * gw, y0: baseY + vrnd() * 36, drift: (vrnd() - 0.5) * 0.6,
        r: 1.4 + vrnd() * 2.6, t0: vrnd() * 0.42, life: 0.45 + vrnd() * 0.45 });
    }
    shakeAmount = 7; shakeT0 = performance.now();
    try { Sound.fsPlasma(); } catch(e){}   // molten plasma ignition sting
    const t0 = performance.now(), DUR = 1800;
    await new Promise(res => {
      function step(){
        const now = performance.now(), t = (now - t0) / DUR;
        if(t >= 1){ backdropG.destroy(); heatG.destroy(); plasmaG.destroy(); emberG.destroy(); res(); return; }
        const outA = t > 0.72 ? Math.max(0, 1 - (t - 0.72) / 0.28) : 1;
        backdropG.clear();
        const bdA = Math.min(1, t / 0.12) * (1 - Math.max(0, (t - 0.82) / 0.18)) * 0.52;
        backdropG.rect(0, 0, W, H).fill({ color: 0x0a0308, alpha: bdA });
        const surge = Math.min(1, t / 0.5), surgeE = 1 - Math.pow(1 - surge, 2);
        // heat glow swelling up from the base
        heatG.clear();
        const hH = gh * 1.1 * surgeE;
        for(let k = 3; k >= 1; k--){
          heatG.ellipse(cx, baseY - hH * 0.42, gw * 0.5 * (0.58 + k * 0.18), hH * 0.6 * (0.5 + k * 0.2))
            .fill({ color: k === 1 ? 0xffd9ec : 0xff2f93, alpha: (k === 1 ? 0.10 : 0.05) * surgeE * outA });
        }
        // plasma columns — jagged vertical streaks climbing up the reels
        plasmaG.clear();
        for(const c of cols){
          const ct = Math.max(0, Math.min(1, (surge - c.t0) / (1 - c.t0)));
          if(ct <= 0) continue;
          const topY = baseY - gh * 1.06 * ct, segs = c.offs.length, pts = [];
          for(let s = 0; s <= segs; s++){
            const f = s / segs, y = baseY - (baseY - topY) * f;
            const flick = Math.sin(now * 0.02 + s * 1.3 + c.x) * c.w * 0.45;
            const x = c.x + c.offs[Math.min(segs - 1, s)] * c.w * 0.4 * Math.sin(f * Math.PI) + flick * 0.3;
            pts.push(x, y);
          }
          const fl = (0.6 + 0.4 * Math.sin(now * 0.03 + c.x)) * outA;
          plasmaG.poly(pts, false).stroke({ color: 0xff007f, width: c.w * 1.1,  alpha: 0.22 * fl });
          plasmaG.poly(pts, false).stroke({ color: 0xff5ab0, width: c.w * 0.5,  alpha: 0.60 * fl });
          plasmaG.poly(pts, false).stroke({ color: 0xffffff, width: c.w * 0.18, alpha: 0.85 * fl });
        }
        // ignition flash at the peak (t≈0.52)
        const flashP = Math.max(0, 1 - Math.abs(t - 0.52) / 0.12) * outA;
        if(flashP > 0){
          for(let k = 3; k >= 1; k--){
            plasmaG.circle(cx, cy, CELL * (1 + k * 0.8) * flashP)
              .fill({ color: k === 1 ? 0xffffff : 0xff2f93, alpha: (k === 1 ? 0.16 : 0.07) * flashP });
          }
        }
        // expanding heat shockwave after the peak
        const ringP = Math.max(0, (t - 0.50) / 0.30);
        if(ringP > 0 && ringP < 1){
          const e = 1 - Math.pow(1 - ringP, 3), R = CELL * (0.6 + e * 2.6), ra = (1 - ringP) * (1 - ringP) * 0.8;
          plasmaG.circle(cx, cy, R    ).stroke({ color: 0xff007f, width: (1 - ringP) * 7 + 1,   alpha: ra * 0.7 });
          plasmaG.circle(cx, cy, R - 6).stroke({ color: 0xffe6f4, width: (1 - ringP) * 4 + 0.5, alpha: ra });
        }
        // rising embers
        emberG.clear();
        for(const em of embers){
          const prog = (t - em.t0) / em.life;
          if(prog <= 0 || prog >= 1) continue;
          const rise = prog * gh * 1.25, y = em.y0 - rise;
          const x = em.x + em.drift * rise * 0.3 + Math.sin(now * 0.008 + em.x * 0.5) * 4;
          const a = Math.sin(prog * Math.PI) * 0.8 * outA;
          emberG.circle(x, y, em.r * (0.6 + 0.4 * Math.sin(now * 0.02 + em.x)))
            .fill({ color: prog < 0.5 ? 0xffe6f4 : 0xff5ab0, alpha: a });
        }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // ── MEGA ARCANE-ELECTRIC CROWN CEREMONY (2026-06-01, polished) ──────────────
  // The biggest bonus (MEGA) gets a showcase entry: the CROWN symbol flies BIG to
  // the centre while THICK, BRANCHING arcane lightning strikes inward from around
  // the grid and CHARGES it (crown jitters + brightens per hit, held crackling),
  // then a magenta energy discharge ring bursts out → FS scene. 100% procedural
  // (additive jagged+forked bolts, sin-driven shake, seeded vrnd jaggedness; NO
  // GLSL, Stake-safe), responsive + GPU-adaptive, self-contained.
  // `scale` thickens the strokes (forks use a thinner scale). Returns the main
  // point list so the caller can spawn forks off it.
  function _drawBolt(g, x0, y0, x1, y1, offs, prog, flick, scale){
    scale = scale || 1;
    const segs = offs.length + 1;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;                 // perpendicular unit
    const amp = Math.min(64, len * 0.16);
    const pts = [x0, y0];
    for(let s = 1; s < segs; s++){
      const f = s / segs, taper = Math.sin(f * Math.PI); // 0 at ends, max mid
      pts.push(x0 + dx * f + px * offs[s-1] * amp * taper, y0 + dy * f + py * offs[s-1] * amp * taper);
    }
    pts.push(x1, y1);
    const totalPts = pts.length / 2;
    const drawN = Math.max(2, Math.ceil(totalPts * Math.min(1, prog)));
    const path = pts.slice(0, drawN * 2);
    g.poly(path, false).stroke({ color: 0xff007f, width: 11 * scale,  alpha: 0.28 * flick });  // outer magenta glow
    g.poly(path, false).stroke({ color: 0xff5ab0, width: 5.5 * scale, alpha: 0.72 * flick });  // magenta body
    g.poly(path, false).stroke({ color: 0x7fe7ff, width: 2.6 * scale, alpha: 0.48 * flick });  // cyan chromatic ghost
    g.poly(path, false).stroke({ color: 0xffffff, width: 1.8 * scale, alpha: 0.95 * flick });  // white-hot core
    return pts;
  }
  async function playMegaLogoCeremony(){
    if(isReduced()){ return new Promise(res => setTimeout(res, 300)); }
    const W = app.screen.width, H = app.screen.height;
    const gw = REELS * CELL, gh = ROWS * CELL, gx = GX, gy = GY;
    const cx = W / 2, cy = gy + gh * 0.5;                  // centre of the reel grid
    const backdropG = new PIXI.Graphics();
    const bloomG = new PIXI.Graphics(); bloomG.blendMode = 'add';
    const arcG   = new PIXI.Graphics(); arcG.blendMode = 'add';
    const crownS = new PIXI.Sprite(SYM_TEX[7]); crownS.anchor.set(0.5);   // CROWN symbol (was the logo)
    const crownMax = Math.min(W * 0.25, H * 0.33, 240);                   // 2× smaller hero (user 2026-06-01)
    const lk = Math.min(crownMax / crownS.texture.width, crownMax / crownS.texture.height);
    // ── MATERIAL "SHADER-LOOK" LAYERS (2026-06-01, user: "more glamour / shader
    // effect / material effects on the crown, not only electric lights") — all
    // procedural + additive (NO GLSL — Stake-fatal). The crown stops being a flat
    // jittering sprite and gains surface life:
    //   • crownRimC/M — cyan + magenta crown copies offset ± behind the hero =
    //                   chromatic-aberration energy bleeding off the crown edges.
    //   • crownFxG    — additive surface FX (charge wash + raking specular glint +
    //                   twinkling gem facets) MASKED to the crown silhouette so it
    //                   reads as light ON the metal/crystal, not a floating box.
    const crownRimC = new PIXI.Sprite(SYM_TEX[7]); crownRimC.anchor.set(0.5); crownRimC.tint = 0x7fe7ff; crownRimC.blendMode = 'add';
    const crownRimM = new PIXI.Sprite(SYM_TEX[7]); crownRimM.anchor.set(0.5); crownRimM.tint = 0xff2f93; crownRimM.blendMode = 'add';
    // back rim-light: a scaled-up cyan-white crown copy BEHIND everything so the
    // dark silhouette edge always separates from the bg (core crown-on-black fix).
    const crownRimBack = new PIXI.Sprite(SYM_TEX[7]); crownRimBack.anchor.set(0.5); crownRimBack.tint = 0xbff4ff; crownRimBack.blendMode = 'add';
    // PERF: the masked surface FX (charge wash + glint + gem facets) needs a mask,
    // which costs an extra GPU pass PER FRAME → skip it on weak GPUs. The cheap
    // chromatic rims (2 sprites) alone still give the crown its energised material
    // read, so low-end devices stay smooth. (mobile best-practice, 2026-06-01)
    const _crownSurf = !_gpuWeak;
    const crownFxG  = _crownSurf ? new PIXI.Graphics() : null;
    const crownMask = _crownSurf ? new PIXI.Sprite(SYM_TEX[7]) : null;
    if(_crownSurf){ crownFxG.blendMode = 'add'; crownMask.anchor.set(0.5); crownFxG.mask = crownMask; }
    // CANDY LIGHT-POOL behind the crown — soft additive pink→light-pink glow so the
    // hero crown sits in candy light and never reads as a flat "crown on black box"
    // (the JPG crown keeps a faint dark halo at ceremony scale). 2026-06-10 fix.
    const crownGlow = new PIXI.Graphics();
    for(let _i = 6; _i >= 1; _i--) crownGlow.circle(0, 0, crownMax * 0.5 * (0.45 + _i * 0.17)).fill({ color: _i > 3 ? 0xff5ab0 : 0xffa6e0, alpha: 0.055 });
    crownGlow.blendMode = 'add'; crownGlow.position.set(cx, cy);
    stage.addChild(backdropG, bloomG, crownGlow, crownRimBack, arcG, crownRimC, crownRimM, crownS);   // back-rim < pool < light < bolts < rims < crown
    if(_crownSurf) stage.addChild(crownMask, crownFxG);                      // masked surface FX on top (strong GPU only)
    crownS.position.set(cx, cy);
    // ── SPINE-05 — swap the flat crown SPRITE for the live Crown-Wild RIG when ready.
    // Every other ceremony VFX (lightning bolts, chromatic rims, masked surface FX,
    // bloom, discharge ring) stays — the rig replaces ONLY the central hero actor.
    // Fallback: crownS stays visible and the ceremony runs identically to today.
    let _crownRig = null, _crownRigBaseScale = 1, _crownRigBigwinFired = false;
    if (_spineReady && _spinePool) {
      try {
        _crownRig = _spinePool.acquire({ symbol: 'crown' });
        stage.addChild(_crownRig.view);
        _crownRig.view.position.set(cx, cy);
        _crownRig.play('idle');
        // Fit the rig's natural extent into the ceremony's hero size (crownMax).
        const _rb = _crownRig.view.getBounds().rectangle;
        const _rmax = Math.max(_rb.width || 1, _rb.height || 1);
        _crownRigBaseScale = crownMax / _rmax;
        crownS.visible = false; // rig replaces the flat sprite; mask + rims still use its texture metrics
      } catch(e) { _crownRig = null; crownS.visible = true; if(STAKE.debug) console.warn('[spine] mega acquire failed:', e); }
    }
    const srcs = [
      [gx, gy], [gx + gw, gy], [gx, gy + gh], [gx + gw, gy + gh],
      [gx + gw * 0.5, gy], [gx + gw * 0.5, gy + gh],
      [gx, gy + gh * 0.5], [gx + gw, gy + gh * 0.5],
    ];
    const BOLT_N = _gpuWeak ? 4 : 7;                      // FEWER bolts — light (plate/pedestal/rim) now leads, electricity is an accent (user: "electric lights bad")
    const bolts = [];
    for(let i = 0; i < BOLT_N; i++){
      const offs = [];
      for(let s = 0; s < 7; s++) offs.push((vrnd() - 0.5) * 2);   // seeded jaggedness, fixed per bolt
      const branches = [];
      const nBr = vrnd() > 0.4 ? 2 : 1;                            // 1-2 forks per bolt
      for(let b = 0; b < nBr; b++){
        const boffs = []; for(let s = 0; s < 4; s++) boffs.push((vrnd() - 0.5) * 2);
        branches.push({ at: 0.30 + vrnd() * 0.42, ang: (vrnd() - 0.5) * 1.7, len: 0.20 + vrnd() * 0.28, offs: boffs });
      }
      bolts.push({ src: srcs[i % srcs.length], offs, branches, t0: 0.14 + (i / BOLT_N) * 0.40 });
    }
    shakeAmount = 7; shakeT0 = performance.now();
    try { Sound.feature(); } catch(e){}
    let shook = false;
    const t0 = performance.now(), DUR = 1900;             // tightened from 2400 — less time on the dim backdrop
    let _chargeSnd = null; try { _chargeSnd = Sound.megaCharge(DUR / 1000 * 0.84); } catch(e){}   // rising charge hum (synced to charge phase)
    await new Promise(res => {
      function step(){
        const now = performance.now(), t = (now - t0) / DUR;
        if(t >= 1){ backdropG.destroy(); bloomG.destroy(); crownGlow.destroy(); arcG.destroy(); if(crownFxG){ crownFxG.mask = null; crownFxG.destroy(); } if(crownMask) crownMask.destroy(); crownRimBack.destroy(); crownRimC.destroy(); crownRimM.destroy(); crownS.destroy(); if (_crownRig && _spinePool) { try { _spinePool.release(_crownRig); } catch(e) {} _crownRig = null; } res(); return; }
        // VIGNETTE backdrop (NOT a flat black box): a lit, transparent centre so the
        // painted hall reads behind the crown → soft dark edges that FRAME the hero.
        // Capped at 0.40 (was flat 0.62) — the "crown floating on a black box" fix.
        backdropG.clear();
        const bdEnv = Math.min(1, t / 0.14) * (1 - Math.max(0, (t - 0.86) / 0.14));
        const bdA = bdEnv * 0.40;
        if(bdA > 0.001){
          const vR = Math.max(W, H) * 0.62;
          for(let k = 5; k >= 1; k--){
            backdropG.circle(cx, cy, vR * (0.55 + k * 0.16)).fill({ color: 0x18092e, alpha: bdA * 0.18 * (k / 5) });
          }
          backdropG.rect(0, 0, W, H).fill({ color: 0x18092e, alpha: bdA * 0.16 });   // candy-dark dim (was near-black 0x05030a -> "crown on black")
        }
        // crown scale-in (0-0.16) → charge jitter (held) → discharge pop
        const inP = Math.min(1, t / 0.16), sIn = 0.34 + 0.66 * (1 - Math.pow(1 - inP, 3));
        let struck = 0; for(const b of bolts){ if(t >= b.t0 + 0.10) struck++; }
        const charge = struck / BOLT_N;
        const jit = (t > 0.16 && t < 0.84) ? (1.4 + 5.5 * charge) : 0;
        const jx = (Math.sin(now * 0.063) + Math.sin(now * 0.101 + 1.3)) * jit * 0.5;
        const jy = (Math.sin(now * 0.071 + 0.7) + Math.sin(now * 0.119)) * jit * 0.5;
        const disP = Math.max(0, (t - 0.84) / 0.16);
        const pop = 1 + 0.16 * Math.sin(Math.min(Math.PI, disP * Math.PI));
        crownS.position.set(cx + jx, cy + jy);
        crownS.scale.set(lk * sIn * pop);
        crownS.alpha = Math.min(1, t / 0.10);
        // SPINE-05: track the rig to the hero's motion + fire 'bigwin' on discharge.
        if (_crownRig) {
          _crownRig.view.position.set(cx + jx, cy + jy);
          _crownRig.view.scale.set(_crownRigBaseScale * sIn * pop);
          _crownRig.view.alpha = Math.min(1, t / 0.10);
          if (disP > 0 && !_crownRigBigwinFired) {
            _crownRigBigwinFired = true;
            _crownRig.play('bigwin');
          }
        }
        // ── CROWN MATERIAL VFX (shader-look — chromatic rim + masked surface) ──
        const ccx = cx + jx, ccy = cy + jy, crScl = lk * sIn * pop, chw = crownMax * sIn * pop * 0.5;
        const heat = Math.min(1, charge * 0.85 + disP * 1.5);             // 0→1 charge, spikes on discharge
        // (A) chromatic energy rim — cyan/magenta crown copies offset ± behind the hero
        crownRimC.position.set(ccx - 2.6, ccy + 0.6); crownRimC.scale.set(crScl * 1.045); crownRimC.alpha = (0.08 + 0.42 * heat) * crownS.alpha;
        crownRimM.position.set(ccx + 2.6, ccy - 0.6); crownRimM.scale.set(crScl * 1.045); crownRimM.alpha = (0.08 + 0.42 * heat) * crownS.alpha;
        // back rim — scaled 1.12× behind the hero so the silhouette's bottom edge
        // always reads against the bg (the literal "crown on black" separation).
        crownRimBack.position.set(ccx, ccy); crownRimBack.scale.set(crScl * 1.12); crownRimBack.alpha = (0.10 + 0.30 * heat) * crownS.alpha;
        if(_crownSurf){   // masked surface FX — strong GPU only (mask = extra pass)
        // mask tracks the crown exactly → surface FX clips to the silhouette
        crownMask.position.set(ccx, ccy); crownMask.scale.set(crScl);
        crownFxG.clear();
        if(crownS.alpha > 0.02){
          // (B) charge wash — the crown glows hotter as it charges; white flash on discharge
          crownFxG.rect(ccx - chw * 1.35, ccy - chw * 1.35, chw * 2.7, chw * 2.7)
            .fill({ color: disP > 0 ? 0xffffff : 0xff2f93, alpha: (0.05 + 0.17 * charge + disP * 0.55) * crownS.alpha });
          // (C) raking specular glint sweeping across the crown (~830 ms loop)
          const _sw = (now * 0.0012) % 1, _swA = Math.sin(_sw * Math.PI);
          const _sx = ccx - chw * 1.35 + _sw * chw * 2.7;
          crownFxG.poly([_sx - chw*0.07, ccy - chw*1.35, _sx + chw*0.07, ccy - chw*1.35, _sx + chw*0.24, ccy + chw*1.35, _sx + chw*0.10, ccy + chw*1.35])
            .fill({ color: 0xffffff, alpha: 0.18 * _swA * (0.5 + 0.5 * charge) * crownS.alpha });
          // (D) twinkling gem facets at fixed crown points (specular sparkles)
          const _gems = [[0,-0.52],[-0.52,-0.06],[0.52,-0.06],[-0.74,0.28],[0.74,0.28],[0,0.18]];
          for(let i = 0; i < _gems.length; i++){
            const _gx = ccx + _gems[i][0] * chw, _gy = ccy + _gems[i][1] * chw;
            const _tw = (0.45 + 0.55 * Math.abs(Math.sin(now * 0.006 + i * 1.9))) * (0.5 + 0.7 * charge) * crownS.alpha;
            const _tr = chw * 0.085 * (0.6 + _tw);
            crownFxG.circle(_gx, _gy, _tr * 1.9).fill({ color: 0xffe6f4, alpha: 0.28 * _tw });
            crownFxG.moveTo(_gx - _tr*2.2, _gy).lineTo(_gx + _tr*2.2, _gy).stroke({ color: 0xffffff, width: 1.4, alpha: 0.9 * _tw });
            crownFxG.moveTo(_gx, _gy - _tr*2.2).lineTo(_gx, _gy + _tr*2.2).stroke({ color: 0xffffff, width: 1.4, alpha: 0.9 * _tw });
            crownFxG.circle(_gx, _gy, _tr * 0.5).fill({ color: 0xffffff, alpha: _tw });
          }
        }
        }   // end _crownSurf (masked surface FX)
        // BACKING PLATE + LIGHT-POOL pedestal — the crown-on-black fix: the hero
        // sits ON a luminous fuchsia disc + a glowing pedestal so its dark
        // silhouette ALWAYS separates from the bg (was 3 thin circles @ ≤0.11).
        bloomG.clear();
        const plateA = 0.55 + 0.45 * Math.min(1, charge + disP);
        const plateR = crownMax * (0.62 + 0.30 * charge) + crownMax * 0.45 * Math.sin(Math.min(Math.PI, disP * Math.PI));
        // light-pool pedestal — squashed additive ellipses under the crown
        for(let k = 3; k >= 1; k--){
          bloomG.ellipse(cx, cy + crownMax * 0.46, plateR * (0.46 + k * 0.20), plateR * (0.10 + k * 0.05) * 0.55)
            .fill({ color: k === 1 ? 0xffe6f4 : 0xff2ad0, alpha: (k === 1 ? 0.14 : 0.06) * plateA });
        }
        // backing plate — wide soft halo → mid glow → bright near-white core puddle
        bloomG.circle(cx, cy, plateR * 1.45).fill({ color: 0xff2ad0, alpha: 0.05 * plateA });
        bloomG.circle(cx, cy, plateR * 1.05).fill({ color: 0xff2ad0, alpha: 0.09 * plateA });
        bloomG.circle(cx, cy, plateR * 0.70).fill({ color: 0xffd9ec, alpha: 0.10 * plateA });
        bloomG.circle(cx, cy, plateR * 0.40).fill({ color: 0xffffff, alpha: 0.07 * plateA });
        // bolts strike inward, then HOLD crackling (longer), with branching forks
        arcG.clear();
        for(const b of bolts){
          if(t < b.t0) continue;
          const bp = (t - b.t0) / 0.13, prog = Math.min(1, bp);
          if(!b._zapped && bp >= 0.92){ b._zapped = true; try { Sound.megaZap(bolts.indexOf(b)); } catch(e){} }   // electric crackle as the bolt hits the crown
          let flick;
          if(bp < 1)        flick = 0.42 + 0.22 * Math.sin(now * 0.09);                             // striking in (dimmer)
          else if(t < 0.84) flick = 0.16 + 0.18 * Math.abs(Math.sin(now * 0.011 + b.t0 * 9));      // HELD crackle (softened — no crackly-toy read)
          else              flick = Math.max(0, 1 - (t - 0.84) / 0.12) * 0.22;                     // fade on discharge
          if(flick <= 0.01) continue;
          const mainPts = _drawBolt(arcG, b.src[0], b.src[1], cx, cy, b.offs, prog, flick, 1);
          // forks branch off the main path once it has drawn past their start
          const mdx = cx - b.src[0], mdy = cy - b.src[1], ml = Math.hypot(mdx, mdy) || 1;
          for(const br of b.branches){
            if(prog < br.at + 0.05) continue;
            const np = mainPts.length / 2, idx = Math.min(np - 1, Math.max(1, Math.round(np * br.at)));
            const sx = mainPts[idx*2], sy = mainPts[idx*2+1];
            const ca = Math.cos(br.ang), sa = Math.sin(br.ang);
            const fdx = (mdx*ca - mdy*sa)/ml, fdy = (mdx*sa + mdy*ca)/ml, flen = ml * br.len;
            const fprog = Math.min(1, (prog - br.at) / 0.18);
            _drawBolt(arcG, sx, sy, sx + fdx*flen, sy + fdy*flen, br.offs, fprog, flick * 0.85, 0.55);
          }
        }
        // discharge ring (chromatic) on the final beat
        if(disP > 0){
          const e = 1 - Math.pow(1 - disP, 3), R = crownMax * (0.35 + e * 1.35), ra = (1 - disP) * (1 - disP) * 0.95;
          arcG.circle(cx, cy, R + 6).stroke({ color: 0xff007f, width: (1 - disP) * 9 + 1.5, alpha: ra * 0.85 });
          arcG.circle(cx, cy, R    ).stroke({ color: 0xffe6f4, width: (1 - disP) * 5 + 1,   alpha: ra });
          arcG.circle(cx, cy, R - 7).stroke({ color: 0x7fe7ff, width: (1 - disP) * 4,       alpha: ra * 0.6 });
          if(!shook){ shook = true; shakeAmount = 10; shakeT0 = now; try { Sound.megaChargeStop(_chargeSnd); Sound.megaDischarge(); } catch(e){} }   // cut the hum, fire the discharge boom
        }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // ── FEATURE BANNER — VILLAIN THRONE FADE-IN/HOLD/FADE-OUT
  // Per user feedback: dramatic in + out with the same villain language
  // as BIG/MEGA/EPIC WIN. Procedural panel sized to text + scale-spring
  // entrance + Vaul ease-out exit.
  async function showFeatureBanner(text,ms,tier){
    fbText.text = socialFilter(text);
    // tier → banner colour language (mirrors the entry ceremony just played)
    _fbTier = (tier === 'bonus_hot') ? 'hot' : (tier === 'bonus_mega') ? 'mega' : 'standard';
    // Re-draw the panel BG sized to current text
    drawFeatureBannerPanel();
    // Bring to top z-index
    stage.addChild(featureBanner);
    featureBanner.alpha = 0;
    featureBanner.scale.set(0.88);
    const t0 = performance.now();
    const inDur = isReduced() ? 180 : 420;
    // ENTRANCE — Vaul curve + spring overshoot on scale
    await new Promise(res => {
      function step(){
        const p = Math.min(1, (performance.now() - t0) / inDur);
        // Backdrop fades fast (Vaul), card scale springs
        featureBanner.alpha = Math.min(1, p * 1.6);
        // Spring overshoot — settles at 1.0 after a soft 1.04 peak
        const springP = 1 - Math.exp(-6 * p) * Math.cos(p * Math.PI * 1.3);
        featureBanner.scale.set(0.88 + 0.12 * springP);
        if(p < 1) requestAnimationFrame(step);
        else { featureBanner.alpha = 1; featureBanner.scale.set(1); res(); }
      }
      requestAnimationFrame(step);
    });
    // HOLD with subtle scale-breathe (matches villain throne)
    const holdT0 = performance.now();
    const holdDur = ms;
    await new Promise(res => {
      function step(){
        const el = performance.now() - holdT0;
        if(el >= holdDur){ res(); return; }
        if(!isReduced()){
          featureBanner.scale.set(1 + Math.sin(el * 0.0036) * 0.018);
        }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
    featureBanner.scale.set(1);
    // EXIT — sharp ease-in (cubic), 280ms (longer than modal exit since
    // this is mid-game state-change, not a user-closed dialog)
    const t1 = performance.now();
    const outDur = isReduced() ? 140 : 280;
    await new Promise(res => {
      function step(){
        const p = Math.min(1, (performance.now() - t1) / outDur);
        const e = p * p;   // ease-in cubic for snappy exit
        featureBanner.alpha = 1 - e;
        featureBanner.scale.set(1 - 0.06 * e);
        if(p < 1) requestAnimationFrame(step);
        else { featureBanner.alpha = 0; featureBanner.scale.set(1); res(); }
      }
      requestAnimationFrame(step);
    });
  }

  // ── SPIN ORCHESTRATION ────────────────────────────────────────
  let _pendingResult = null;
  let _spinMode = 'base';

  function reelsSpinPromise(grid,anticipate){
    return new Promise(resolve => {
      // 3-state turbo: off (1.0× full cinematic), turbo (0.33×), max (0.20×).
      // Floor each so the reel still reads as MOVING, not teleporting.
      const k = turboK();
      // 2026-06-01 timing-management pass (web-animations) — spins felt draggy in
      // every mode and the two turbo tiers collapsed onto the old 220/40 floors
      // (turbo-1 ≈ max ≈ 380 ms → "turbo first mode is normal"). Faster cinematic
      // base + LOWER floors so the three tiers read as three distinct speeds:
      //   normal ≈ reel4 790 ms · turbo ≈ 320 ms · max ≈ 245 ms.
      const baseDur = Math.max(140, Math.round(440 * k));
      const stagger = Math.max(26,  Math.round(88  * k));
      for(let r=0;r<REELS;r++){
        let dur=baseDur + r*stagger;
        // ── ANTICIPATION (2026-05-27 AAA tension boost) ────────────────
        // When 2+ scatters land on the first 3 reels and a 3rd is pending
        // on reels 4/5, dramatically stretch reels 4 & 5 (2.4× cinema,
        // 1.8× turbo, 1.5× max-turbo) — was 1.8/1.5/1.4 (too subtle).
        // Player FEELS the tension as the last reels crawl in.
        if(anticipate && r>=3){
          dur *= (State.turboMode===2 ? 1.4 : State.turboMode===1 ? 1.6 : 1.9);   // anticipation crawl, trimmed to match the faster base (was 1.5/1.8/2.4)
        }
        spinReelTo(r,grid[r],dur,0);
      }
      // ── ANTICIPATION TENSION (Scenario D) — music ducks to ~8 %, a 60 BPM
      // sub-kick loop fires, and the reel-rush filter sweeps up to 8 kHz while
      // the bonus-deciding reels crawl. Stopped when the reels resolve (below).
      if(anticipate && !isReduced()){
        try { Sound.anticipationStart(); } catch(e){}
      }
      _qStopped=false;        // arm quick-stop for THIS spin
      allReelsSpinning=true;
      onAllReelsStopped = () => {
        if(anticipate){ try { Sound.anticipationStop(); } catch(e){} }
        resolve();
      };
    });
  }

  let _spinLock = false;
  async function startSpin(mode){
    if(_spinLock || allReelsSpinning) return;
    if(State.phase !== Phase.IDLE) return;
    if(STAKE.replay) return;
    try { Sound.anticipationStop(); } catch(e){}   // defensive — never leak a kick loop across spins
    mode = mode || 'base';
    // Legacy alias: 'bonus' (older buy-modal path) → resolve to the SELECTED
    // tier so STANDARD/HOT/MEGA all converge through the same cost lookup.
    // Without this, HOT (122×) and MEGA (172×) silently fell back to State.betX6
    // and the player only paid 1× the bet for a tier-3 bonus. Bug found
    // during pre-submission bonus testing on 2026-05-25.
    if(mode === 'bonus') mode = BONUS_TIERS[_selectedTier].id;
    let cost, wager;
    if(mode === 'bonus_standard' || mode === 'bonus_hot' || mode === 'bonus_mega'){
      const tierIdx = (mode === 'bonus_hot') ? 1 : (mode === 'bonus_mega') ? 2 : 0;
      cost  = bonusCostX6(tierIdx);   // full price the player pays = betX6 × mode cost mult
      // ── BET NOT ACCEPTED fix (2026-05-31) ────────────────────────────────
      // /wallet/play `amount` MUST be a valid bet level — the RGS enforces
      // amount ∈ [minBet,maxBet] && amount % stepBet === 0. The mode's cost
      // multiplier (index.json `cost`: 23.82 / 121.29 / 173.57) is applied
      // SERVER-side, exactly like base mode (cost 1.0). Previously we sent the
      // fractional cost (e.g. betX6×23.82 = 2,382,000, which is NOT a multiple
      // of stepBet=100,000) → the RGS rejected every buy-bonus with ERR_VAL
      // "That bet could not be validated". Send the BASE bet instead.
      wager = State.betX6;
    } else {
      cost = wager = State.betX6;
    }
    if(State.balanceX6 < cost){ try { routeRgsError({ code:'ERR_IPB' }); } catch(e){} return; }   // dismissible notice, not a silent no-op (gate U8)
    // LOCK synchronously — BEFORE the RGS await — so a second trigger (Space,
    // swipe, autoplay timer, spin tap) arriving during the in-flight
    // /wallet/play can never slip a concurrent bet through. This is the race
    // that broke the chests game post-approval. Released only once the whole
    // round (spin → settle → end-round) has fully resolved (finally below).
    _spinLock = true;
    // ── COMMIT PULSE (Emil/web-animations) ───────────────────────
    // Fire IMMEDIATELY on commit, BEFORE awaiting RGS. Covers RGS
    // latency (50–200ms) with an instant visual response so the player
    // never sees a "did my press register?" gap. 180ms ease-out from
    // scale 0.96 → base with one micro-overshoot at the tail.
    if(spinBtn && !STAKE.replay && !isReduced()){
      spinBtn._commitT0 = performance.now();
    }

    let result;
    try { result = await RGS.play(wager,mode); }
    catch(err){
      _spinLock = false;
      log('RGS.play error',err);
      routeRgsError(err);   // P0-D: branch by code — dismissible for recoverable, reload only for fatal
      return;
    }
    try {
      _pendingResult=result; _spinMode=mode;

      Sound.resume(); Sound.spinStart();
      State.phase=Phase.SPIN;
      State.balanceX6-=cost;
      State.stats.spins++;
      State.stats.totalBet+=cost;
      if(State.autoplay.active && State.autoplay.remaining!==Infinity) State.autoplay.remaining--;
      updateHUD();
      // Clear previous big BIG WIN celebration popup (the centred art).
      winDisplay.alpha=0; winFx.on=false;
      winPlaque.alpha=0;
      // ── LAST WIN PATTERN ─────────────────────────────────────────
      // Standard award-tier slot HUD: between spins, keep the value of
      // the most recent win visible (muted colour) under a "LAST WIN"
      // label. On a new winning round, flashWinValue() brightens the
      // value to its tier colour and switches the label back to "WIN".
      // First-time-play case: lastWinX6 = 0 → reads "LAST WIN $0.00"
      // which still gives the player context that the slot has a WIN slot.
      winValue.text = fmtMoney(State.lastWinX6 || 0);   // #win-text rule 2: never blank/NaN
      winValue.style.fill = THEME.colors.textMuted;
      winLabel.text = socialFilter(State.lastWinX6 > 0 ? 'LAST WIN' : 'WIN');
      // 2-color system: WIN label uses brand PINK (was gold).
      winLabel.style.fill = 0xff8ab8;
      winLabel.alpha = 1; winValue.alpha = 1;
      winCells=[]; winLines=[]; lineG.clear();
      // During AUTOPLAY keep the SPIN glyph (no morph to a stop icon) — the
      // autoplay button with its count + STOP glyph is the stop control. The
      // stop-texture quick-stop affordance stays for manual single spins.
      if(!State.autoplay.active) spinBtn.texture=tex('stop');
      if(deliveredBar) deliveredBar.setSpinning(true);   // delivered bar: SPIN → stop affordance
      if(deliveredBarWeb) deliveredBarWeb.setSpinning(true);

      // anticipation if the round will trigger free spins via scatters on early reels
      let anticipate=false;
      if(mode==='base' && result.grid){
        let earlyScatters=0;
        for(let r=0;r<3;r++) for(let row=0;row<ROWS;row++) if(result.grid[r][row]===STAR) earlyScatters++;
        const lateScatter=(()=>{ for(let r=3;r<REELS;r++) for(let row=0;row<ROWS;row++) if(result.grid[r][row]===STAR) return true; return false; })();
        anticipate = earlyScatters>=2 && lateScatter && !isReduced();
      }

      await reelsSpinPromise(result.grid, anticipate);
      spinBtn.texture=tex('spin');
      if(deliveredBar) deliveredBar.setSpinning(false);   // reels stopped → restore SPIN glyph
      if(deliveredBarWeb) deliveredBarWeb.setSpinning(false);
      await settleRound(result,mode);
    } catch(err){
      // A throw anywhere in the settle/ceremony chain would otherwise leave
      // State.phase stuck at REVEAL/FREESPIN — every future spin then no-ops at
      // the phase guard (hard soft-lock) AND finishRound never runs, so the RGS
      // round is never ended. Recover to a clean IDLE, end the round if we can,
      // and show a dismissible notice. Balance is server-authoritative.
      log('settle error', err);
      try { await RGS.endRound(); } catch(e){}
      if(typeof stopAutoplay === 'function') stopAutoplay();
      State.phase = Phase.IDLE;
      if(deliveredBar) deliveredBar.setSpinning(false);   // never leave the delivered bar stuck in stop state on error
      if(deliveredBarWeb) deliveredBarWeb.setSpinning(false);
      try { winFx.on=false; winDisplay.alpha=0; winCells=[]; winLines=[]; lineG.clear(); updateHUD(); } catch(e){}
      showError('Round interrupted', 'That round could not be completed. Your balance is safe — please spin again.', false);
    } finally {
      _spinLock = false;
    }
  }

  async function settleRound(result,mode){
    // Wins are always computed against the base bet. The buy-bonus cost is a
    // separate debit (handled in startSpin) — never the multiplier base.
    const betX6 = State.betX6;
    State.phase=Phase.REVEAL;
    // Live-path safety (audit rank 2): parseRound always sets ev now, but never
    // gate the whole reveal on a missing breakdown — derive it from the (server)
    // grid so a real win is never silently swallowed on the live harness.
    if(!result.ev && result.grid) result.ev = evalGrid(result.grid);

    // ── Is this a BUY BONUS round? — separate cinematic path so the
    // player sees the SCATTER TRIGGER REVEAL (not just a random spin)
    const isBuyBonus = mode === 'bonus' || mode === 'bonus_standard' ||
                       mode === 'bonus_hot' || mode === 'bonus_mega';

    // base-game line + scatter wins
    let baseWinX6=0;
    if(!isBuyBonus && result.ev){
      const ev=result.ev;
      if(ev.lineWins.length){ showLineWins(result.grid,ev.lineWins); }
      if(ev.scatCount>=3) showScatterCells(result.grid);
      const baseMx100=Math.round((ev.lineX+ev.scatX)*100);
      if(baseMx100>0){
        baseWinX6=Math.round(betX6*baseMx100/100);
        revealActive=true; revealT0=performance.now(); winVfxTier=winTier(baseMx100);
        // ── BUG FIX: scatter trigger gets a LONGER reveal so the player
        // SEES which symbols caused the bonus before transitioning. Was
        // sharing tier-based duration with normal wins (~760ms) — too fast
        // to register a feature trigger.
        const triggersFS = !!result.fs && ev.scatCount >= 3;
        if(triggersFS){
          revealDur = State.turboMode===2 ? 900
                    : State.turboMode===1 ? 1300
                    : (isReduced() ? 900 : 1800);
        } else {
          // Reveal durations — perception floor lifted (Emil "speed beats
          // delight" but 380ms in max-turbo was sub-threshold for a tier
          // reveal). 480ms keeps the snappy feel while letting the eye
          // actually register the cell highlight + value count.
          revealDur = State.turboMode===2 ? 480
                    : State.turboMode===1 ? 720
                    : (isReduced() ? 700 : 1300);
        }
        if(ev.scatCount>=3 || winTier(baseMx100)>=4){
          // big base win — MICRO-SILENCE then celebration (P1).
          // A beat of stillness before the explosion makes the reward
          // land harder. Only for tier ≥ 4 (BIG+) — small wins stay snappy.
          const _bt = winTier(baseMx100);
          if(_bt >= 4) await microSilence(_bt);
          celebrate(baseMx100,baseWinX6);
        } else {
          Sound.win(winTier(baseMx100));
        }
        flashWinValue(baseWinX6, baseMx100);   // tier-coloured WIN
        // ── BUG FIX: scatter trigger spawns a particle burst on each
        // scatter cell so the player sees a clear "BONUS TRIGGERED!" moment
        // before the FS banner appears.
        if(triggersFS && !isReduced()){
          // Premium "Bonus Ignition" shockwave on the scatter cells (replaces the
          // old flat dot-burst): charge-up → detonation flash → chromatic shockwave.
          spawnBonusIgnition(winCells);
          // brief screen-shake to amplify "SOMETHING SPECIAL JUST HAPPENED"
          shakeAmount = 4; shakeT0 = performance.now();
          // ── CAMERA PUSH-IN (2026-05-27 AAA cinematic) ───────────────
          // Push the whole stage scale to 1.04× when the bonus triggers.
          // Reads as the camera dollying-in for the special moment.
          _camPushT0 = performance.now();
        }
        await delay(revealDur);
        revealActive=false;
      }
    } else if(isBuyBonus && result.ev){
      // ── BUY BONUS REVEAL — cinematic scatter trigger ─────────────────
      // The 3 scatter STARs land on the reels (forced by mock RGS). Light
      // them up with a sustained, dramatic reveal so the player SEES the
      // trigger — they paid for it, they deserve a moment of theatre.
      //
      // 1. SCATTER CELLS LIGHT UP (existing win-frame highlight)
      // 2. STAGGERED PARTICLE BURSTS on each scatter (one per 120ms)
      //    — feels like the symbols are "charging up" the bonus
      // 3. SCREEN PULSE — soft full-stage flash on the 3rd burst
      // 4. SCREEN SHAKE — brief, low-amplitude tension
      // 5. HOLD ~900ms so the eye registers the trigger
      const ev = result.ev;
      if(ev.scatCount >= 3){
        showScatterCells(result.grid);
        revealActive = true; revealT0 = performance.now();
        winVfxTier = 5;   // treat as tier-5 highlight (mega pink)
        revealDur = State.turboMode===2 ? 700
                  : State.turboMode===1 ? 1100
                  : (isReduced() ? 600 : 1500);
        Sound.feature();
        // Staggered scatter bursts — 120ms between each cell
        if(!isReduced()){
          for(let i = 0; i < winCells.length; i++){
            const c = winCells[i];
            setTimeout(() => {
              // Staggered chromatic ignition per scatter — each cell "charges up"
              // and detonates a shockwave 150 ms after the last (cascading build).
              spawnBonusIgnition([c]);
              if(i === winCells.length - 1){
                // Final scatter → screen pulse + shake
                shakeAmount = 5; shakeT0 = performance.now();
              }
            }, i * 150);
          }
        }
        await delay(revealDur);
        revealActive = false;
      }
    }

    // free spins feature
    let fsWinX6=0;
    if(result.fs){
      State.stats.features++;
      Sound.feature();
      // ── BUG FIX: cinematic transition into FS. Reels dim + scale down
      // for ~280ms (Emil ease-out cubic), banner rises with outBack, then
      // FS scene takes over. The reels stay dimmed during FS so the FS
      // overlay reads as a distinct phase.
      // Each tier gets its OWN award-level entry ceremony (2026-06-01):
      //   STANDARD → crystal-bloom · HOT → plasma-ignition · MEGA → arcane crown.
      // playFsTransition (generic portal) is kept as a defensive fallback only.
      const _fsMode = (result.fs && result.fs._mode) || mode;
      if(_fsMode === 'bonus_mega'){
        await playMegaLogoCeremony();
      } else if(_fsMode === 'bonus_hot'){
        await playHotFsCeremony();
      } else if(_fsMode === 'bonus_standard' || _fsMode === 'bonus' || _fsMode === 'base'){
        await playStandardFsCeremony();
      } else {
        await playFsTransition();
      }
      // Bonus-mode music swap — STANDARD / HOT / MEGA each get a distinct
      // background track per AUDIO_HANDOFF.md. The procedural music voice
      // dies on _stopMusic() and a new one fades in over 1.2 s.
      try {
        const bonusModeForMusic = (_fsMode === 'bonus_hot') ? 'bonus_hot'   // AUDIO-BUG-01: derive from _fsMode, not mode — organic HOT/MEGA triggers were getting STANDARD music
                                : (_fsMode === 'bonus_mega') ? 'bonus_mega'
                                : 'bonus_standard';
        Sound.startBonusMusic(bonusModeForMusic);
        setGradeMode(_fsMode); // VFX-02 — push the scene into bonus mood
      } catch(e){}
      await showFeatureBanner((mode==='bonus'?'BONUS':result.fs.awarded)+' FREE SPINS',isReduced()?500:1100, _fsMode);
      fsWinX6 = await runFreeSpinScene(betX6,result.fs);
      // Back to idle music when FS chain completes
      try { Sound.endBonusMusic(); } catch(e){}
      try { setGradeMode('base'); } catch(e){} // VFX-02 — return to base mood
    }

    // credit + bookkeeping — SERVER-AUTHORITATIVE (CLAUDE.md hard rule: the credited
    // total is ALWAYS the server payoutMultiplier, never the frontend's per-event
    // re-sum, which can drift by banker's-rounding / the max-win cap on live RGS).
    // In demo serverTotalX6 == the old baseWinX6+fsWinX6 (== fsWinX6 for a buy, whose
    // base reveal scores 0) modulo sub-cent rounding; on live it is the exact figure
    // the reviewer diffs against the replay. baseWinX6/fsWinX6 still drive the
    // per-phase DISPLAY during playback above — only the CREDIT switches to the server total.
    const serverTotalX6 = Math.round(betX6 * (result.payX100 || 0) / 100);
    const totalWinX6 = serverTotalX6;
    State.balanceX6 += serverTotalX6;
    if(totalWinX6>0){
      State.stats.totalWon+=totalWinX6;
      State.stats.hits++;
      if(totalWinX6>State.stats.biggest) State.stats.biggest=totalWinX6;
    }
    const mx100 = result.payX100;
    State.history.unshift({
      label: result.fs ? (mode==='bonus'?'BUY BONUS':'FREE SPINS') : (result.ev&&result.ev.lineWins[0]?SYM_NAME[result.ev.lineWins[0].sym]:(mx100>0?'WIN':'—')),
      mx100, betX6, ts:Date.now(),
    });
    if(State.history.length>50) State.history.length=50;
    State.spinsSinceCheck++;

    await finishRound(result,betX6,totalWinX6);
  }

  // Win-tier color ladder for the per-spin WIN label / flash accent in the HUD
  // bar (consumed by flashWinValue). UNIFIED MAGENTA-FAMILY — mirrors the
  // TIER_COLORS ladder (~7544) so the readout escalates by SATURATION +
  // BRIGHTNESS inside the pink-magenta spectrum, never by jumping hue.
  // History: the 2026-06-01 pass de-hued tiers 2-5 off the old gold→orange→pink
  // ramp, but tier 6 still jumped to violet (0xc566ff) and tier 5 (0xff007f)
  // sat at ~4.3:1 on surface1. 2026-06-03: fully reconciled to TIER_COLORS —
  // violet removed, deep end brightness-lifted to clear WCAG AA everywhere.
  //   0 no-win   — neutral grey (shouldn't fire)
  //   1 RETURNED — neutral mauve-grey (LDW: must NOT read as celebratory)
  //   2 WIN      — light rose-pink
  //   3 NICE     — soft pink   (= TIER_COLORS[3])
  //   4 BIG      — bright pink (= TIER_COLORS[4])
  //   5 MEGA     — deep rose-magenta
  //   6 EPIC     — hot rose-magenta (most saturated)
  // Tiers 5-6 are brightness-LIFTED vs TIER_COLORS' neon magenta (0xff007f /
  // 0xff0066): those sit at ~4.2-4.3:1 on surface1 (0x1a2032) — below AA for
  // small label text. Every entry clears WCAG AA 4.5:1 on surface1
  // (verified: 6.2 / 8.0 / 9.1 / 7.4 / 5.6 / 4.9 / 4.6 :1 for tiers 0-6).
  const WIN_TIER_COLORS = [
    0x9ca0b3,  // 0 — neutral grey (no win — shouldn't fire)         6.2:1
    0xb9b3c4,  // 1 — neutral mauve-grey (LDW / return, neutral)     8.0:1
    0xffa9cd,  // 2 — light rose-pink (entry win)                    9.1:1
    0xff8ab8,  // 3 — soft pink (nice win)                           7.4:1
    0xff5a9c,  // 4 — bright pink (big win)                          5.6:1
    0xff3f93,  // 5 — deep rose-magenta (mega)                       4.9:1
    0xff2e86,  // 6 — hot rose-magenta (epic, most saturated)        4.6:1
  ];
  let _winFlashTok=0;
  let _countTok=0;
  let _labelFadeTok=0;   // WIN/LAST WIN label crossfade race-guard
  function flashWinValue(amountX6, mx100){
    // ── COUNT-UP TWEEN — Picker AnimatedAmount pattern: ramp from 0 (or
    // previous lastWin) to the new amount with easeOutCubic over a tier-
    // scaled duration (bigger wins count up longer, dopamine pacing).
    // KB ref: project_picker_visual_polish.md AnimatedAmount.svelte
    const startX6 = 0;                  // always count from 0 for clarity
    const targetX6 = amountX6;
    if(amountX6 > 0){ State.lastWinX6 = amountX6; syncDeliveredBar(); }   // push the fresh LAST WIN to the delivered portrait bar

    // ── LABEL CROSSFADE — Emil "blur as bridge" / soft state change ─
    // The label switches "LAST WIN" → "WIN" on every winning round. A
    // raw .text = swap snaps mid-frame (eye reads two distinct labels).
    // Crossfade: 90ms fade-out → swap text → 140ms fade-in. Tier-color
    // also resolves AFTER the swap so the color change rides the fade
    // (no flash). 230ms total — under Emil's 300ms ceiling.
    if(typeof mx100 === 'number'){
      const tier = winTier(mx100);
      // VILLAIN PALETTE — WIN *value* is always smoke-white in the HUD bar
      // (was tier-color gold/orange; the readout stays villain-coherent and
      // the big magnitude reveal lives in the celebration popup). Only the
      // *label* accent carries tier color, and it escalates strictly inside
      // the pink-magenta family via the WIN_TIER_COLORS ladder — no hue jump
      // to gold/orange/violet. winTier() always yields 0-6, so the lookup is
      // in-range; the || keeps it defensive.
      winValue.style.fill = 0xf5f7fa;
      const newLabelFill = WIN_TIER_COLORS[tier] || 0xff8ab8;
      const newText = socialFilter('WIN');
      if(isReduced() || winLabel.text === newText){
        winLabel.text = newText;
        winLabel.style.fill = newLabelFill;
      } else {
        // crossfade
        const labTok = ++_labelFadeTok;
        const lt0 = performance.now();
        (function fadeStep(){
          if(labTok !== _labelFadeTok) return;
          const elapsed = performance.now() - lt0;
          if(elapsed < 90){
            winLabel.alpha = 1 - (elapsed/90) * 0.85;   // fade out to 0.15
          } else if(winLabel.text !== newText){
            winLabel.text = newText;
            winLabel.style.fill = newLabelFill;
            winLabel.alpha = 0.15;
          } else if(elapsed < 230){
            winLabel.alpha = 0.15 + ((elapsed-90)/140) * 0.85;   // fade in
          } else {
            winLabel.alpha = 1; return;
          }
          requestAnimationFrame(fadeStep);
        })();
      }
    } else {
      winLabel.text = socialFilter('WIN');
    }
    winPlaque.alpha=1; winValue.alpha=1;
    if(typeof mx100 !== 'number') winLabel.alpha=1;

    // Count-up duration scales with win tier (Picker tier pacing):
    //   tier 1-2: 220ms  · tier 3-4: 480ms  · tier 5-6: 900ms
    const tier = typeof mx100 === 'number' ? winTier(mx100) : 2;
    const countDur = tier >= 5 ? 900 : tier >= 3 ? 480 : 220;

    // Reduced-motion + 0-amount: skip the count, set final value immediately
    if(isReduced() || amountX6 === 0){
      winValue.text = fmtMoney(targetX6);
    } else {
      const tok = ++_countTok;
      const t0 = performance.now();
      (function step(){
        if(tok !== _countTok) return;     // newer count started, abort this one
        const p = Math.min(1, (performance.now() - t0) / countDur);
        const eased = 1 - Math.pow(1 - p, 3);    // easeOutCubic
        const cur = Math.round(startX6 + (targetX6 - startX6) * eased);
        winValue.text = fmtMoney(cur);
        if(p < 1) requestAnimationFrame(step);
        else winValue.text = fmtMoney(targetX6);
      })();
    }
    if(isReduced()) return;
    // cute pop — the WIN plaque + label + value spring up together with one
    // soft outBack overshoot (Emil/web-animations methodology) instead of
    // snapping. Scale floor lifted 0.86 → 0.94 per Emil's "never below 0.93"
    // rule — the previous 0.86 read as a tiny teleport pre-pop rather than
    // a confident entrance. 280ms is in the 200-300ms snappy band.
    const tok=++_winFlashTok;
    winLabel._popActive = winValue._popActive = true;   // render-loop fit yields during the pop
    const t0=performance.now(), dur=280;
    (function step(){
      if(tok!==_winFlashTok){ winLabel._popActive=winValue._popActive=false; return; }
      const p=Math.min(1,(performance.now()-t0)/dur);
      const k=0.94 + 0.06*outBack(p);
      const lB=(winLabel._baseScale||winLabel.scale.x)*(winLabel._fit||1);   // pop relative to fitted base
      const vB=(winValue._baseScale||winValue.scale.x)*(winValue._fit||1);
      winLabel.scale.set(lB*k); winValue.scale.set(vB*k);
      if(p<1) requestAnimationFrame(step);
      else { winLabel.scale.set(lB); winValue.scale.set(vB); winLabel._popActive=winValue._popActive=false; }
    })();
  }

  async function finishRound(result,betX6,totalWinX6){
    // end-round AFTER the win celebration has fully finished on screen — the
    // render loop clears winFx.on when the celebration completes, so block
    // here until it does. (Picker v15 was rejected for ending early.) The
    // guard caps the wait so a stuck flag can never deadlock the round.
    // 2026-05-27 audit fix — cap lowered from 150 (9s) → 50 (3s) so that
    // an autoplay+Slow 3G stuck-flag scenario doesn't deadlock the next
    // spin. Force-clear winFx.on if guard exhausted.
    let _celebGuard=0;
    while(winFx.on && _celebGuard++<50) await delay(60);
    if(winFx.on){ winFx.on = false; winDisplay.alpha = 0; }
    try {
      const endData=await RGS.endRound();
      if(endData && endData.balance!=null)
        State.balanceX6 = typeof endData.balance==='object' ? endData.balance.amount : endData.balance;
    } catch(e){ log('endRound error',e); }

    // ── DEFENSIVE STATE TEARDOWN (2026-05-27 fix) ──────────────────────
    // Per user screenshot: "×3" mult text + white payline residue
    // persisted into base mode after MEGA bonus ended. Root cause was
    // bonusMultBig + winLines not cleared on phase change. Clear EVERY
    // animatable visual layer here so IDLE always starts from a clean
    // slate, regardless of how messy the previous round's exit was.
    winCells = []; winLines = []; lineG.clear();
    if(typeof bonusFxG !== 'undefined') bonusFxG.clear();
    if(typeof bonusFxAddG !== 'undefined') bonusFxAddG.clear();
    if(typeof bonusMultBig !== 'undefined'){ bonusMultBig.visible = false; bonusMultBig.alpha = 0; }
    if(typeof bonusWildLabel !== 'undefined') bonusWildLabel.visible = false;
    if(typeof bonusLockLabel !== 'undefined') bonusLockLabel.visible = false;
    if(typeof bonusHudText !== 'undefined') bonusHudText.alpha = 0;
    if(typeof clearStickyOverlay === 'function') clearStickyOverlay();
    if(_bonusState) _bonusState.active = false;
    // Reset camera-push transformation (in case it got stuck mid-animation)
    _camPushT0 = 0;
    if(stage.pivot.x !== 0 || stage.scale.x !== 1){
      stage.pivot.set(0, 0);
      stage.position.set(0, 0);
      stage.scale.set(1);
    }

    State.phase=Phase.IDLE;
    updateHUD();
    Audit.flush({ ts:Date.now(), id:result?.id, payX100:result?.payX100, balance:State.balanceX6 });

    const elapsed=(Date.now()-State.sessionStartedAt)/60000;
    if(State.spinsSinceCheck>=COMPLY.reality_check_spins || elapsed>=COMPLY.reality_check_min){
      showRealityCheck(); return;
    }
    if(State.autoplay.active){
      const isFeature=!!result?.fs;
      const big = totalWinX6 >= betX6*25;   // measure vs the bet actually played
      const stop = (isFeature && State.autoplay.stopOnFeature)
        || (big && State.autoplay.stopOnBigWin)
        || State.autoplay.remaining<=0
        || State.balanceX6 < State.betX6;
      if(stop) stopAutoplay();
      else autoplayNext();
    }
  }

  // ── FREE SPIN SCENE — reuses the reel grid + per-mode visual treatments
  async function runFreeSpinScene(betX6,fs){
    State.phase=Phase.FREESPIN;
    let runningX6=0;
    fbText.text='';
    // ── BONUS MODE FLAGS — set by mock RGS / future math-sdk events
    const fsMode = fs._mode || 'bonus_standard';
    const wildReel = fs._wildReel != null ? fs._wildReel : null;
    const stickyCrowns = !!fs._stickyCrowns;
    // ── ACTIVATE PERSISTENT BONUS FX OVERLAY (drawBonusFx in render loop)
    _bonusState.active = true;
    _bonusState.mode = fsMode;
    _bonusState.wildReel = wildReel;
    _bonusState.stickyCrowns = stickyCrowns;
    _bonusState.stickyMap = [[],[],[],[],[]];   // 5 reels, populated during MEGA spins
    _bonusState.spinNum = 0;
    _bonusState.totalSpins = fs.spins.length;
    _bonusState.spinMult = 1;
    _bonusState.totalMult = 0;
    _bonusState.revealedMultT0 = -10000;
    // Mode-specific scene tint (additive frosting on the bg). On-brand magenta
    // escalation — bright → neon-hot → electric fuchsia (was gold/orange/violet;
    // all off the black/magenta-villain brand). Tiers stay distinct via
    // saturation + alpha. 2026-06-01; violet→fuchsia de-hue 2026-06-03.
    if(fsMode === 'bonus_hot'){
      frostBg.tint = 0xff007f;   // neon hot-magenta "heat" wash
      frostBg.alpha = 0.18;
    } else if(fsMode === 'bonus_mega'){
      frostBg.tint = 0xff2ad0;   // electric-fuchsia "mega" wash (on-brand; was violet 0xc566ff)
      frostBg.alpha = 0.20;
    } else {
      frostBg.tint = 0xff5ab0;   // bright-magenta "standard" wash
      frostBg.alpha = 0.12;
    }
    for(let i=0;i<fs.spins.length;i++){
      const sp=fs.spins[i];
      // Per-spin mult — mega mode is variable, others are fixed
      const spinMult = sp.mult != null ? sp.mult : FS_MULT;
      // ── LIVE BONUS STATE — drives the persistent overlay renderer
      _bonusState.spinNum = i + 1;
      _bonusState.spinMult = spinMult;
      _bonusState.revealedMultT0 = performance.now();    // trigger mult-reveal
      _bonusState.totalMult += spinMult;
      // ── PER-SPIN INFO — bonusHudText (below reels) is the canonical
      // display during free spins. The featureBanner pill was a duplicate
      // that positioned at GY-60 (above reels) and OVERLAPPED THE LOGO on
      // mobile portrait. Killed per 2026-05-27 user feedback "game statuses
      // in the bonus games not showing in mobile, into logo overlapped".
      featureBanner.alpha = 0;

      winCells=[]; winLines=[]; lineG.clear();
      await reelsSpinPromise(sp.grid,false);

      // ── HOT MODE: highlight the wild reel after landing — single-row
      // gold flash overlay on reel 3 confirms "this reel is wild"
      if(wildReel != null && !isReduced()){
        const reelCenterX = GX + wildReel*CELL + CELL/2;
        for(let row = 0; row < ROWS; row++){
          spawnParticles(reelCenterX, GY + (row+0.5)*CELL, 4, 4);
        }
      }
      // ── MEGA MODE: populate the sticky-crown map so the persistent
      // overlay renderer can paint gold-frame markers on each crown cell
      // for the duration of the round. Also fires a sparkle burst on each
      // newly-stuck crown (the moment-of-impact celebration).
      // 2026-05-27: also light up the STATIC stickyOverlay sprite at each
      // locked cell so the crown remains visually frozen for the rest of
      // the bonus, instead of appearing to re-spin inside its highlight
      // frame on every subsequent spin.
      if(stickyCrowns){
        for(let r = 0; r < REELS; r++){
          for(let row = 0; row < ROWS; row++){
            if(sp.grid[r][row] === SYM.CROWN){
              if(!_bonusState.stickyMap[r][row]){
                _bonusState.stickyMap[r][row] = true;     // mark as stuck
                // ── STATIC SPRITE: pin the crown texture above the reel
                // so the spinning column behind never moves this cell.
                const stuckSp = stickySprites[r][row];
                stuckSp.texture = SYM_TEX[SYM.CROWN];
                const cc = cellCenter(r, row);
                stuckSp.position.set(cc.x, cc.y);
                const sz = CELL * 0.92;
                stuckSp.scale.set(sz / Math.max(stuckSp.texture.width, stuckSp.texture.height));
                stuckSp.visible = true;
                // POP-IN — instant 0→1 alpha + a tiny scale punch on land
                stuckSp.alpha = 1;
                stuckSp._landT0 = performance.now();
                if(!isReduced()){
                  spawnParticles(cc.x, cc.y, 8, 5);       // moment-of-stick burst
                }
              }
            }
          }
        }
      }

      // Highlight from the SERVER's per-spin line_wins (authoritative); fall back
      // to a frontend evalGrid recompute only when none were sent (mock/demo).
      // The recompute mis-scored the math's STAR-wild lines → "bonus showed no win".
      const ev=evalGrid(sp.grid);
      const lws = (sp.lineWins && sp.lineWins.length) ? sp.lineWins : ev.lineWins;
      if(lws.length) showLineWins(sp.grid, lws);
      if(ev.scatCount>=3) showScatterCells(sp.grid);
      const spinWinX6=Math.round(betX6*sp.winX);
      if(spinWinX6>0){
        runningX6+=spinWinX6;
        flashWinValue(runningX6, Math.round(sp.winX*100));   // tier-coloured
        const tier=winTier(Math.round(sp.winX*100));
        if(tier>=2) Sound.win(tier);
        else Sound.tick();
        if(tier>=3 && !isReduced()) spawnParticles(app.screen.width/2,GY+GH*0.4,tier*4,tier);
        revealActive=true; revealT0=performance.now(); revealDur=isReduced()?420:760; winVfxTier=tier;
        await delay(revealDur);
        revealActive=false;
      } else {
        await delay(isReduced()?160:300);
      }
      if(sp.retrig){
        await showFeatureBanner('+'+sp.retrig+' FREE SPINS',isReduced()?400:850);
      }
    }
    featureBanner.alpha=0;
    winCells=[]; winLines=[]; lineG.clear();
    // Reset mode-specific scene tint + deactivate persistent overlay
    frostBg.tint = 0xffffff; frostBg.alpha = 1;
    fbText.style.fill = 0xf5f7fa;   // reset to the whitesmoke init (was gold 0xffe9b0 — would make every banner AFTER the first bonus render gold, off-brand)
    _bonusState.active = false;
    _bonusState.stickyMap = [];
    bonusFxG.clear();
    bonusFxAddG.clear();
    bonusHudText.alpha = 0;
    // Reset MEGA-mode sticky-crown static overlay (hide all 15 sprites)
    clearStickyOverlay();

    // FS complete card — micro-silence before the grand total reveal (P1)
    const totalX6=Math.round(betX6*fs.total);
    await microSilence(6);   // longest held breath — the bonus climax
    bigWinLabel.style.fill=0xf5f7fa;
    bigWinAmount.text=fmtMoney(totalX6);
    // P1-H: derive the celebration tier from the REALISED win (fs.total), NOT
    // the mode. A bonus that pays back <=1x is a return, not a win — firing the
    // EPIC flash + triumphant chime for it is a UKGC LDW violation (and just
    // wrong: a 172x MEGA buy can resolve under 1x). Floor a genuine bonus win
    // at BIG (completing a feature has weight) but never award MEGA/EPIC for a
    // small total; route <=1x to a neutral surface where LDW is suppressed.
    const fsTier = winTier(Math.round(fs.total*100));
    winFx.countX6Target = totalX6;   // count-up animates to the REAL total (was unset -> flickered toward $0)
    // 3-beat: this reuse path sets winFx.on directly (bypasses celebrate()), so it
    // MUST reset the count-up + savour-latch state, else stale popT0/landFired from
    // a prior base-win ceremony break the FS-win landing.
    winFx.countX6Display = 0; winFx.popT0 = 0; winFx.landFired = false; winFx._arc = null;
    if(fsTier <= 1 && !COMPLY.allow_ldw_celebration){
      winFx.customLabel = socialFilter('FREE SPINS COMPLETE');
      bigWinLabel.text   = socialFilter('FREE SPINS COMPLETE');
      winFx.tier = 1;                                   // Sound.win(<=1) is silent (LDW guard, L4828)
      winFx.on=true; winFx.t0=performance.now();
      winFx.dur=isReduced()?600:1400;
      winFx.tAnt = isReduced()?0:120;                   // minimal breath; count then settles
      winFx.tLand = winFx.tAnt + (isReduced()?1:Math.max(360,(winFx.dur-winFx.tAnt)*0.55));
    } else {
      winFx.customLabel = socialFilter('FREE SPINS WIN');
      bigWinLabel.text   = socialFilter('FREE SPINS WIN');
      // Floor the CEREMONY tier at 3 (NICE-grade) — a completed bonus should feel
      // rewarding but ELEGANT, not nuclear. Flooring at 5 (MEGA) gave a modest
      // $7.50 FS win the full 12-ray + dual-ring + lightning treatment (user:
      // "too many particles/electrics — make it minimalistic"). The tier now
      // tracks the realised win (fsTier), floored at NICE so it never reads flat;
      // genuinely big FS totals still escalate to MEGA/EPIC naturally. <=1x stays
      // on the neutral 'FREE SPINS COMPLETE' surface above (LDW-safe).
      winFx.tier = Math.max(fsTier, 3);
      winFx.on=true; winFx.t0=performance.now();
      winFx.dur=Math.min(isReduced()?700:2800, COMPLY.max_animation_ms||3500);   // clamp to jurisdiction cap
      // 3-beat schedule (same shape as celebrate()) — the reuse path seeds it here.
      const _fsAnt = isReduced()?0:(winFx.tier>=5?320:240);
      winFx.tAnt = _fsAnt;
      winFx.tLand = _fsAnt + (isReduced()?1:Math.max(360,(winFx.dur-_fsAnt)*0.55));
      Sound.win(winFx.tier);
      // ── ELEGANT FREE-SPINS FINALE (2026-06-09) — 3-beat, same as base wins.
      // BEAT-1 dust + a SMALL first cascade here; the BIG particle wave + full
      // cascade + ka-ching fire at the LANDING (popT0) in the draw loop. The old
      // cute=true path (soft stars + floaty rain) the user flagged is gone — this
      // now reads identical-quality to a base MEGA.
      if(!isReduced()){
        try { Sound.winAnticipate(winFx.tier); Sound.tallyStart(fs.total); } catch(e){}
        spawnParticles(app.screen.width/2, GY+GH*0.42, winFx.tier*4, winFx.tier);
        spawnCascade(winFx.tier, false, 0.45);
      }
    }
    await waitWinOrSkip(winFx.dur);   // #16: skippable (tap/Space) instead of a hard delay
    return totalX6;
  }

  // ── WIN CELEBRATION / AUTOPLAY ────────────────────────────────
  function stopAutoplay(){ State.autoplay.active=false; State.autoplay.remaining=0; }
  function autoplayNext(){
    if(!State.autoplay.active) return;
    if(State.autoplay.remaining<=0){ stopAutoplay(); return; }
    if(State.phase!==Phase.IDLE) return;
    if(State.balanceX6<State.betX6){ stopAutoplay(); return; }
    // Inter-spin pause — almost zero in max turbo (rapid-fire), short in
    // turbo, breathing space in off mode. Reduced-motion behaves like turbo.
    const d = State.turboMode===2 ? 140
            : State.turboMode===1 || isReduced() ? 280
            : 720;
    setTimeout(() => {
      if(!State.autoplay.active) return;
      if(State.phase!==Phase.IDLE) return;
      startSpin();
    }, d);
  }

  // ── INTERACTION ───────────────────────────────────────────────
  const click=(s,fn) => { s.eventMode='static'; s.cursor='pointer'; s.on('pointertap',fn); };
  click(spinBtn,() => {
    if(STAKE.replay) return;
    if(winFx.on){ winFx.fastFwd = true; return; }   // #16: a tap skips the win celebration
    if(allReelsSpinning){ quickStopReels(); return; }
    if(State.phase===Phase.IDLE) startSpin();
  });
  // press feedback — scale(0.97), Emil's highest-ROI micro-interaction.
  // Lerped each frame in the render loop (NOT direct snap) so press-in /
  // release feel like one continuous motion — interruptible at any phase.
  spinBtn.on('pointerdown',() => { spinBtn._pressed=true; });
  spinBtn.on('pointerup',() => { spinBtn._pressed=false; });
  spinBtn.on('pointerupoutside',() => { spinBtn._pressed=false; });
  spinBtn.on('pointercancel',() => { spinBtn._pressed=false; });
  window.addEventListener('keydown',(e) => {
    if(STAKE.replay) return;
    // Escape closes any open modal/drawer/overlay (a11y keyboard parity).
    if(e.code==='Escape'){
      if(buyModal.visible)   { hideBuyBonusModal(); return; }
      if(infoModal.visible)  { hideInfoModal(); return; }
      if(drawerLayer.visible){ closeDrawer(); return; }
      if(rcModal.visible)    { return; }   // reality check needs explicit choice
      if(errModal.visible)   { return; }   // error needs explicit retry
      if(betMenu.visible)    { hideBetMenu(); return; }
      return;
    }
    if(e.code==='Space' || e.code==='Enter'){
      e.preventDefault();
      // BUG FIX: ignore auto-repeat firing while space is held — the OS
      // sends keydown every ~30ms when held, which kept the spin button
      // visually stuck in pressed state and could double-trigger
      // quickStopReels during a spin. Only fire on the initial press.
      if(e.repeat) return;
      // Modal-aware: if a modal is up, don't intercept the key — let
      // the modal's own confirm flow handle it (Escape closes; the
      // user can mouse/tap to confirm).
      if(buyModal.visible || betMenu.visible || infoModal.visible ||
         drawerLayer.visible || rcModal.visible || errModal.visible) return;
      spinBtn._pressed = true;   // visual press feedback (matches pointer)
      if(winFx.on){ winFx.fastFwd = true; }          // #16: Space/Enter skips the win celebration
      else if(allReelsSpinning) quickStopReels();
      else if(State.phase===Phase.IDLE) startSpin();
    }
    else if(e.code==='ArrowUp'){ e.preventDefault(); bumpBet(1); }
    else if(e.code==='ArrowDown'){ e.preventDefault(); bumpBet(-1); }
    else if(e.code==='KeyF'){ btnFullscreen.emit('pointertap'); }
    else if(e.code==='KeyM'){ btnSound.emit('pointertap'); }
    // ── EXTENDED KEYBOARD SHORTCUTS (a11y power-user / WCAG 2.1.1)
    // B = Buy Bonus, A = Autoplay, T = Turbo cycle, I = Info modal.
    // All gated on IDLE phase so we never fire mid-spin.
    else if(e.code==='KeyB' && State.phase===Phase.IDLE && COMPLY.allow_buy_bonus){
      e.preventDefault(); showBuyBonusModal();
    }
    else if(e.code==='KeyA' && State.phase===Phase.IDLE){
      e.preventDefault(); btnAutoplay && btnAutoplay.emit('pointertap');
    }
    else if(e.code==='KeyT' && State.phase===Phase.IDLE){
      e.preventDefault(); btnTurbo && btnTurbo.emit('pointertap');
    }
    else if(e.code==='KeyI'){
      e.preventDefault(); showInfoModal();
    }
  });
  // BUG FIX: keyup release for Space — without this the press scale lerp
  // never returns from 0.97 → 1.0 when the player taps space. Pair to the
  // keydown above.
  window.addEventListener('keyup',(e) => {
    if(e.code === 'Space'){
      spinBtn._pressed = false;
    }
  });
  // Defensive: if the window loses focus while space is held (alt-tab),
  // release the pressed state so the button doesn't sit stuck small.
  window.addEventListener('blur', () => {
    spinBtn._pressed = false;
  });

  // ── BONUS MODE FX RENDERER — drawn each frame when in FREESPIN
  // Handles 3 mode-specific persistent overlays:
  //   HOT      — wild-reel flame glow + "WILD" tag + heat shimmer
  //   MEGA     — sticky-crown markers + per-spin multiplier reveal +
  //              cumulative multiplier tracker
  //   STANDARD — clean FS counter + ×N indicator
  function drawBonusFx(now){
    bonusFxG.clear();
    bonusFxAddG.clear();
    if(!_bonusState.active || State.phase !== Phase.FREESPIN){
      // ── CRITICAL CLEANUP (2026-05-27 fix) ────────────────────────────
      // Hide ALL bonus VFX layers when bonus ends — previously bonusMultBig
      // ("×3" / "×10" text) persisted into the base game because it was
      // only hidden inside the reveal-window branch (which doesn't run
      // when _bonusState.active is false). User screenshot showed "×3"
      // floating over a base-mode middle reel.
      bonusHudText.alpha = 0;
      bonusMultBig.visible = false;
      bonusMultBig.alpha = 0;
      bonusWildLabel.visible = false;
      bonusLockLabel.visible = false;
      return;
    }
    const mode = _bonusState.mode;
    const W = app.screen.width, H = app.screen.height;
    // ── PERSISTENT FS HUD — counter + multiplier above the reels.
    // Sits in the topRes band so it doesn't overlap reels.
    bonusHudText.alpha = 1;
    let hudLabel = '';
    // 2-color HUD text — PINK shades distinguish modes, all on smoke-white
    // base. Behavioural differences (wild reel / sticky / multiplier) carry
    // the rest of the mode identity.
    if(mode === 'bonus_hot'){
      hudLabel = `🔥 HOT  ${_bonusState.spinNum} / ${_bonusState.totalSpins}   ×${_bonusState.spinMult}`;
      bonusHudText.style.fill = 0xc8326f;        // PINK_DEEP — warm/aggressive
    } else if(mode === 'bonus_mega'){
      hudLabel = `✨ MEGA  ${_bonusState.spinNum} / ${_bonusState.totalSpins}   ×${_bonusState.spinMult}`;
      bonusHudText.style.fill = 0xff8ab8;        // PINK_SOFT — premium/elite
    } else {
      hudLabel = `FREE SPINS  ${_bonusState.spinNum} / ${_bonusState.totalSpins}   ×${_bonusState.spinMult}`;
      bonusHudText.style.fill = 0xff5a9c;        // PINK — standard accent
    }
    bonusHudText.text = hudLabel;
    // Position BELOW the reels (not above) so it never overlaps the
    // SHINING POP wordmark logo at the top. The logo always sits above
    // GY; the HUD text now sits 6px below the bottom edge of the reels.
    // 2026-05-27 audit fix — clamp Y so it never overlaps the bar on
    // tight viewports (Popout S 400×225, where GY+GH+8 can sit IN the
    // bar area). Read the current barY from State if available, else
    // use a sensible fallback (H - 60).
    let _hudY = GY + GH + 8;
    if(typeof H !== 'undefined' && H > 0){
      const _barTop = H - (H < 330 ? 60 : 88) - 6;   // bar bottom minus barH minus pad
      _hudY = Math.min(_hudY, _barTop - bonusHudText.height - 2);
      _hudY = Math.max(_hudY, GY + GH + 2);          // never above the reel bottom
    }
    bonusHudText.position.set(W/2, _hudY);

    // ── HOT MODE: wild reel PINK plasma glow + "WILD" overlay (2-color)
    if(mode === 'bonus_hot' && _bonusState.wildReel != null){
      const wr = _bonusState.wildReel;
      const wx = GX + wr * CELL + CELL/2;
      const wy0 = GY, wy1 = GY + GH;
      // Plasma shimmer — translucent pink teardrops rising (was orange flames)
      const t = now * 0.001;
      for(let f = 0; f < 6; f++){
        const phase = (t + f * 0.16) % 1;
        const yy = wy1 - phase * (GH + 40);
        const ww = CELL * (0.35 + Math.sin(phase * Math.PI * 2) * 0.06);
        const a = (1 - phase) * 0.22;
        bonusFxAddG.poly([
          wx - ww*0.5, yy + 20,
          wx + ww*0.5, yy + 20,
          wx + ww*0.35, yy - 14,
          wx,          yy - 30,
          wx - ww*0.35, yy - 14,
        ]).fill({ color: 0xff5a9c, alpha: a });
      }
      // Continuous pink glow on the reel column (was orange)
      const pulse = 0.6 + 0.4 * Math.sin(now * 0.004);
      bonusFxAddG.rect(wx - CELL/2 + 4, wy0 + 2, CELL - 8, GH - 4)
        .fill({ color: 0xff5a9c, alpha: 0.06 * pulse });
      bonusFxAddG.rect(wx - CELL/2 + 4, wy0 + 2, CELL - 8, GH - 4)
        .stroke({ color: 0xff8ab8, width: 2, alpha: 0.60 + 0.35 * pulse });
      // ── "WILD REEL" TAG — enlarged + downward chevron pointer ─────
      // Per 2026-05-27 bonus-game audit: previous 52×18 pill was lost in
      // the column glow. New: larger 88×26 pill with neon halo + chevron
      // pointing down to the reel below ("THIS reel is wild" reading
      // instantly). Sticks above the top edge of the wild column.
      const wildPulse = 0.6 + 0.4 * Math.sin(now * 0.004);
      // Outer halo glow
      bonusFxG.roundRect(wx - 48, wy0 - 36, 96, 28, 12)
        .fill({ color: 0xff007f, alpha: 0.18 * wildPulse });
      // Pill bg
      bonusFxG.roundRect(wx - 44, wy0 - 34, 88, 24, 12)
        .fill({ color: 0x0a0a14, alpha: 0.96 });
      bonusFxG.roundRect(wx - 44, wy0 - 34, 88, 24, 12)
        .stroke({ color: 0xff007f, width: 1.4, alpha: 0.95 });
      // Bottom-edge magenta accent line
      bonusFxG.roundRect(wx - 36, wy0 - 13, 72, 1.2, 0.6)
        .fill({ color: 0xff007f, alpha: 0.85 });
      // Downward CHEVRON pointer (the visual "this reel" anchor)
      bonusFxG.poly([
        wx - 6, wy0 - 11,
        wx + 6, wy0 - 11,
        wx,     wy0 - 4,
      ]).fill({ color: 0xff007f, alpha: 0.95 });
      // Note: actual "WILD REEL" text is rendered by `bonusWildLabel`
      // (kept as a Text object — see HUD section). Pulse it in sync here.
      if(bonusWildLabel){
        bonusWildLabel.position.set(wx, wy0 - 22);
        bonusWildLabel.visible = true;
        bonusWildLabel.alpha = 1;
      }
    } else if(bonusWildLabel){
      bonusWildLabel.visible = false;
    }

    // ── MEGA MODE: sticky-crown PINK markers + LOCK glyph + tracker ──
    if(mode === 'bonus_mega'){
      let lastSticky = null;
      for(let r = 0; r < REELS; r++){
        for(let row = 0; row < ROWS; row++){
          if(_bonusState.stickyMap[r] && _bonusState.stickyMap[r][row]){
            const cc = cellCenter(r, row);
            const r2 = CELL * 0.42;
            const sparkle = 0.6 + 0.4 * Math.sin(now * 0.005 + r + row);
            // outer PINK glow
            bonusFxAddG.roundRect(cc.x - r2, cc.y - r2, r2*2, r2*2, 8)
              .stroke({ color: 0xff5a9c, width: 2.4, alpha: 0.85 * sparkle });
            // inner SMOKE_W highlight ring (high-contrast against pink frame)
            bonusFxAddG.roundRect(cc.x - r2 + 2, cc.y - r2 + 2, r2*2 - 4, r2*2 - 4, 7)
              .stroke({ color: 0xf5f7fa, width: 0.8, alpha: 0.40 * sparkle });
            // LOCK GLYPH (padlock) REMOVED (2026-06-01, user: "remove the lock icon
            // on the sticky crown in the MEGA case"). The crystal frame highlight
            // above already marks the stuck cell elegantly — the padlock + "LOCKED"
            // label read as clutter on the premium crown symbol.
            lastSticky = cc;
          }
        }
      }
      // "LOCKED" label REMOVED (2026-06-01) — the sticky crown + crystal frame
      // speak for themselves; the word read as clutter (user request).
      bonusLockLabel.visible = false;
      // 2026-05-31 — removed the empty cumulative-multiplier tracker pill.
      // It drew a pink-bordered box with NO text inside (dead UI clutter);
      // the per-spin ×N centre reveal already communicates the multiplier,
      // and summing per-spin mults isn't a meaningful "total" anyway.
    }

    // ── PER-SPIN MULTIPLIER REVEAL — 2026-05-27 fix
    // Previously only invisible glow halos (no actual digit) — players
    // had no idea what multiplier they rolled. Now: a BIG "×N" Text
    // anchored center-screen + tier-tinted halos behind it. outBack
    // overshoot on entry, gentle hold breathing, fade-out.
    // 2026-05-31: suppress entirely while a win popup is up (winFx.on) so
    // the ×N never overlaps/competes with the BIG WIN amount.
    const revealAge = now - _bonusState.revealedMultT0;
    if(mode === 'bonus_mega' && !winFx.on && revealAge >= 0 && revealAge < 1900 && _bonusState.spinMult > 1){
      const phase = revealAge < 240 ? revealAge / 240
                  : revealAge < 1560 ? 1
                  : 1 - (revealAge - 1560) / 340;
      const eAlpha = Math.max(0, Math.min(1, phase));
      const scale = 0.6 + 0.4 * (revealAge < 240 ? outBack(revealAge/240) : 1)
                  + (revealAge >= 240 ? Math.sin(revealAge * 0.005) * 0.02 : 0);
      const cx = GX + GW/2, cy = GY + GH/2;
      const tierColor = _bonusState.spinMult >= 10 ? 0xff0066
                      : _bonusState.spinMult >= 7  ? 0xff007f
                      : _bonusState.spinMult >= 5  ? 0xff5a9c
                      : _bonusState.spinMult >= 3  ? 0xff8ab8
                      : 0xf5f7fa;
      // Halo behind text (now at meaningful 14% alpha, not 4%)
      for(let g = 5; g > 0; g--){
        bonusFxAddG.circle(cx, cy, CELL * scale * (0.55 + g*0.13))
          .fill({ color: tierColor, alpha: 0.06 * eAlpha * (g/5) });
      }
      // ── BIG "×N" CENTRE-SCREEN TEXT ───────────────────────────────
      // 2026-05-27 perf fix: use `tint` instead of `style.fill` for the
      // tier color — `style.fill` mutation forces PIXI to re-rasterize
      // the text atlas every frame (8-12ms hit on mobile). Tint is
      // GPU-side, instant, and behaves identically for whole-glyph color.
      bonusMultBig.visible = true;
      bonusMultBig.text = '×' + _bonusState.spinMult;
      bonusMultBig.position.set(cx, cy);
      bonusMultBig.scale.set(scale);
      bonusMultBig.alpha = eAlpha;
      bonusMultBig.tint = tierColor;
    } else {
      // Hide outside reveal window
      bonusMultBig.visible = false;
      bonusMultBig.alpha = 0;
    }
  }

  // ── RENDER LOOP ───────────────────────────────────────────────
  app.ticker.add((ticker) => {
    const dt=ticker.deltaTime;
    const now=performance.now();

    // Floating BUY BONUS button — show only when buying is possible (idle, allowed,
    // picker closed). Updates every frame so phase changes flip it instantly.
    try { refreshBuyFabVisibility(); } catch(e){}

    // Bonus FX overlay — runs every frame during FREESPIN
    drawBonusFx(now);

    // autoplay button — live remaining-spins counter on top of the icon.
    // When active, button shows the remaining count (large, gold) and acts
    // as a STOP toggle on tap. Title attr in DOM canvas isn't usable;
    // visual cue is the counter + accent active-state ring on the chip.
    const apOn = State.autoplay.active;
    btnAutoplay._count.visible = apOn;
    btnAutoplay._stop.visible  = apOn;             // explicit STOP glyph under count
    btnAutoplay._icon.alpha = apOn ? 0.10 : 1;     // fade icon when count is shown
    btnAutoplay._active = apOn;                     // drives accent ring on chip
    if(apOn){
      btnAutoplay._count.text =
        State.autoplay.remaining===Infinity ? '∞' : String(State.autoplay.remaining);
      btnAutoplay._count.style.fill = 0xf5f7fa;   // smoke-white (2-color system, no gold)
      // The count + STOP are CHILDREN of the autoplay chip, which is hard-scaled
      // DOWN to icon size in the bar — so "22" was rendering ~10px (user: "autoplay
      // looks small / not correct"). Counter-scale by 1/chipScale so both render at
      // a FIXED on-screen size regardless of preset, stacked count-over-stop.
      const _apS = btnAutoplay.scale.x || 1;
      const _apPx = v => v / _apS;                          // screen px → chip-local units
      btnAutoplay._count.scale.set(Math.min(2.6, 23 / (64 * _apS)));  // count ≈ 23px on screen
      btnAutoplay._count.position.set(0, _apPx(-7));
      // gentle stop-glyph pulse so it reads as the live "tap to stop" control
      btnAutoplay._stop.scale.set(Math.min(3.0, 12 / (18 * _apS)) * (0.94 + 0.06*Math.sin(now*0.006)));
      btnAutoplay._stop.position.set(0, _apPx(13));
    } else {
      btnAutoplay._count.scale.set(1); btnAutoplay._count.position.set(0,-4);
    }

    // painted hall — slow parallax drift; logo gentle bob + sway.
    // MOBILE perf: parallax repaint is expensive when bg has a BlurFilter.
    // Throttle to once every 4 frames on phone-sized viewports.
    const _isPhone = window.innerWidth < 600 || window.innerHeight < 600;
    const _doParallax = !_isPhone || (Math.floor(now / 64) % 2 === 0);
    if(_doParallax){
      const drift=now*0.0002;
      bg.x=app.screen.width/2+Math.sin(drift)*7;
      bg.y=app.screen.height/2+Math.sin(drift*0.7+1)*4;
      frostBg.x=bg.x; frostBg.y=bg.y;
    }
    // BG brightness reactions are BONUS-ONLY (user: "every spin the bg
    // brightness is changing in the main scene, looks not correct — I need this
    // ONLY on the bonus, like darkens"). In the MAIN scene the hall stays at a
    // steady alpha 1 (no spin-dim, no big-win dim); only the bonus darkens for
    // focus/drama.
    const _inBonus = !!(_bonusState && _bonusState.active);
    const _winDim = (_inBonus && winFx.on && winFx.tier>=4 && !isReduced()) ? 0.84 : 1.0;
    const _spinDim = _inBonus ? ((allReelsSpinning ? 0.78 : 1.0) * _winDim) : 1.0;
    bg._tA = bg._tA == null ? 1 : bg._tA;
    bg._tA += (_spinDim - bg._tA) * 0.12;     // ~280ms lerp
    bg.alpha = bg._tA;
    // ── CATHEDRAL GOD-RAYS — volumetric shafts. Soft-pink in the "world"
    // (palette cohesion: pink is the world, gold is the prize), and they
    // FLARE brighter + magenta when the hall reacts to a win.
    godRays.clear();
    if(!isReduced() && !_gpuWeak){
      const _W=app.screen.width, _H=app.screen.height, _t=now*0.00006;
      const _winLit=(_inBonus && winFx.on && winFx.tier>=2) ? Math.min(1,(winFx.tier-1)/4) : 0;   // god-ray flare = bonus-only
      const _rayCol=_winLit>0 ? 0xff6ac0 : 0xffd9ee;   // soft-pink idle → magenta flare on win
      const _rayBoost=1 + _winLit*2.4;                 // up to ~3.4x brighter on EPIC
      for(let i=0;i<6;i++){
        const baseX=_W*(0.10+i*0.16)+Math.sin(_t*1.7+i*1.3)*_W*0.03;
        const ox=_W*0.5+(baseX-_W*0.5)*0.28, sp=_W*0.05;
        const a=(0.016+0.010*Math.sin(_t*3.1+i*2))*bg._tA*_rayBoost;
        godRays.poly([ox-7,-_H*0.08, ox+7,-_H*0.08, baseX+sp,_H*1.06, baseX-sp,_H*1.06])
          .fill({ color:_rayCol, alpha:Math.max(0,a) });
      }
    }
    // ── AMBIENT MOTE BED — constant luminous dust drifting up behind the
    // reels (lazy-init once on first eligible frame). Time-based sway +
    // twinkle; a mote that drifts off the top wraps to the bottom at a new x.
    // Subtle alphas → ambient, never distracting. OFF on reduced-motion/weak GPU.
    ambientMotesG.clear();
    if(!isReduced() && !_gpuWeak){
      if(!ambientMotes.length){
        const _N = _isPhone ? 11 : 19;
        for(let i=0;i<_N;i++) ambientMotes.push({
          x:vrnd(), y:vrnd(), r:0.7+vrnd()*1.9, sp:0.0004+vrnd()*0.0006,
          sway:vrnd()*6.283, swaySp:0.3+vrnd()*0.5, ph:vrnd()*6.283, gold:vrnd()<0.5,
        });
      }
      const _Wm=app.screen.width, _Hm=app.screen.height, _tt=now*0.001;
      for(const m of ambientMotes){
        m.y -= m.sp;
        if(m.y < -0.04){ m.y = 1.04; m.x = vrnd(); }
        const sx = m.x*_Wm + Math.sin(_tt*m.swaySp + m.sway)*_Wm*0.012;
        const sy = m.y*_Hm;
        const tw = 0.35 + 0.65*Math.abs(Math.sin(_tt*0.8 + m.ph));
        const rr = m.r*(0.8 + 0.4*tw);
        const col = m.gold ? 0x7fe7ff : 0xff9ed0;   // accent mote = cyan crystal (was amber gold 0xffe6a8 — off-brand, de-hued 2026-06-03)
        ambientMotesG.circle(sx, sy, rr*2.7).fill({ color:col, alpha:0.06*tw });
        ambientMotesG.circle(sx, sy, rr).fill({ color:0xfff4fb, alpha:0.58*tw });   // cool crystal-white core (was warm cream 0xfff4e0)
      }
    } else if(ambientMotes.length){
      ambientMotes.length = 0;   // released if reduced-motion / weak-GPU toggles on
    }
    // ── MODAL BG EFFECT — ZOOM-FOCUS instead of BLUR (2026-05-27) ──
    // Per user "black bg is not cool, only focused zoom filter effect on
    // the bg, not blured — like zoom shader effect on Pixi". Replaced
    // the BlurFilter with a SCALE PUSH: bg scales up subtly (1.0 → 1.08)
    // when any modal opens, giving a cinematic dolly-in feel while
    // keeping the game scene fully readable behind the modal. The blur
    // filter is kept but its strength stays at 0 (kept in case mobile
    // needs to swap in a soft blur for legibility — controllable via
    // a single flag).
    const _anyModal = drawerLayer.visible || buyModal.visible ||
                      infoModal.visible   || rcModal.visible  ||
                      errModal.visible    || betMenu.visible  ||
                      introOverlay.visible;
    // Glassmorphic blur-behind-modal: backdrop AND the whole reel scene blur
    // when an overlay opens (user: "blured modals"). Reel filter is attached
    // only while open + detached after ramp-down → gameplay frames stay clean.
    const _blurOn = _anyModal && !isReduced();
    const _blurTarget = _blurOn ? 5 : 0;          // stronger backdrop blur (was 2)
    bg._blurT += (_blurTarget - bg._blurT) * 0.14;
    if(bg._blurT < 0.06) bg._blurT = 0;
    gameBlurFilter.strength = bg._blurT;
    // ART-05 — fade modal scrim in/out alongside the blur.
    const _scrimTarget = _anyModal ? 0.42 : 0;
    modalScrimG.alpha += (_scrimTarget - modalScrimG.alpha) * 0.18;
    if(modalScrimG.alpha < 0.005) modalScrimG.alpha = 0;
    // ── REDESIGN — animate the Buy Bonus tier cards (sparkle/ember/lightning VFX
    // + breathing scale on selected + hover lerp). Only runs when the modal is
    // visible — zero cost otherwise.
    if(buyModal.visible){
      const _tnow = now;
      for(let i = 0; i < tierCards.length; i++){
        const tc = tierCards[i];
        // DEFENSIVE — every running total falls back to 0 if init was stripped by
        // a parallel-session commit. Without this an undefined→NaN chain makes
        // tc.scale.x = NaN and the entire card renders invisibly.
        const hv  = (tc._hover  || 0);
        const hvT = (tc._hoverT || 0);
        tc._hoverT = hvT + (hv - hvT) * 0.18;
        const isSel = i === _selectedTier;
        const breath = (isSel && !isReduced()) ? 0.015 * Math.sin(_tnow * 0.0028) : 0;
        const tgt = (isSel ? 1.04 : 1.0) + breath + tc._hoverT * 0.03;
        const sx0 = (Number.isFinite(tc.scale.x) ? tc.scale.x : 1);
        const sxNew = sx0 + (tgt - sx0) * 0.18;
        tc.scale.x = sxNew;
        tc.scale.y = sxNew;
        // ── AAA — gravity-defying hover lift (-4px Y on hover). The card rises off
        // the page on hover, a signature interaction (Emil web-animations spec).
        // Stored base Y on first call, then offset; no Y drift accumulates.
        if(tc._baseY == null) tc._baseY = tc.y;
        const liftTgt = tc._baseY - (tc._hoverT * 4);
        tc.y += (liftTgt - tc.y) * 0.20;
        if(tc._vfx) drawTierVfx(tc, _tnow, isSel);
      }
    } else {
      // When modal hides, snap scales back to rest so the next open starts cleanly.
      for(let i = 0; i < tierCards.length; i++){
        const tc = tierCards[i];
        if(tc.scale.x !== 1){ tc.scale.set(1); }
        if(tc._vfx && tc._vfx.geometry && tc._vfx.geometry.graphicsData?.length){ tc._vfx.clear(); }
      }
    }
    if(_blurOn){
      if(reelArea.filters !== _reelBlurArr) reelArea.filters = _reelBlurArr;
      reelBlurFilter.strength += (6 - reelBlurFilter.strength) * 0.14;
    } else if(reelArea.filters){
      reelBlurFilter.strength += (0 - reelBlurFilter.strength) * 0.22;
      if(reelBlurFilter.strength < 0.12){ reelBlurFilter.strength = 0; reelArea.filters = null; }
    }
    // Zoom-focus push — scale bg up 8% when a modal opens
    if(bg._zoomT == null) bg._zoomT = 1;
    // World-reaction camera push: the hall leans IN on a win (tier-scaled), on
    // top of the modal dolly. tier 2-3 a subtle 1.035; tier>=4 a cinematic
    // 1.07; tier<=1 (a return) gets nothing — UKGC LDW neutral.
    const _winZoom = (_inBonus && winFx.on && winFx.tier>=2 && !isReduced())
                   ? (winFx.tier>=4 ? 1.07 : 1.035) : 1;   // camera push = bonus-only (no main-scene scene-change)
    const _zoomTarget = Math.max(_anyModal ? 1.08 : 1, _winZoom);
    bg._zoomT += (_zoomTarget - bg._zoomT) * 0.10;     // ~340ms ease
    // Apply to bg AND frostBg so they stay in lockstep (no parallax break)
    const _bgK = (bg._baseScale || 1) * bg._zoomT;
    if(bg._baseScale){
      bg.scale.set(_bgK, _bgK);
      if(frostBg._baseScale) frostBg.scale.set(frostBg._baseScale * bg._zoomT, frostBg._baseScale * bg._zoomT);
    }
    if(logo._baseY!=null){
      // LOGO IS STATIC — no idle bob/sway (user asked repeatedly: "logo idle
      // animations not needed"). Holds a fixed pose; only the constant inner
      // gloss below remains (the time-based pulse is removed further down too).
      logo.y = logo._baseY;
      logo.rotation = 0;
      // ── INSIDE-THE-LOGO VFX (2026-05-27 user redesign) ──────────────
      // 1. Minimal ambient pink halo (kept subtle, no longer the hero)
      // 2. LOGO-CLIPPED SHIMMER — additive duplicate of logo texture with
      //    pulsing alpha + tint cycling that paints INSIDE the wordmark
      //    pixels only (no external bleed). Reads as the logo itself
      //    "lighting up from within" — radical insert effect.
      const lW = logo.width, lH = logo.height;
      const lx = logo.x, ly = logo.y;
      // (1) AMBIENT HALO — kept VERY subtle (the inside shimmer is hero now)
      logoHalo.clear();
      const haloPulse = 0.85;   // constant — no idle pulse (logo is static)
      for(let g = 4; g >= 1; g--){
        const r = Math.max(lW, lH) * (0.40 + g * 0.07);
        logoHalo.ellipse(lx, ly, r * 1.0, r * 0.58)
          .fill({ color: 0xff007f, alpha: 0.012 * haloPulse * (1 - g/5) });
      }
      // (2) INSIDE SHIMMER — additive logo sprite, alpha + tint pulse.
      //     Mirrors the parent logo's transform so it stays perfectly
      //     aligned. The additive blend + texture-mask means light only
      //     appears on logo pixels — true "insert effect".
      logoShine.position.set(lx, ly);
      logoShine.scale.set(logo.scale.x, logo.scale.y);
      logoShine.rotation = logo.rotation;
      // Slow shimmer cycle — 3s period. Alpha ramps 0.05 → 0.45 → 0.05.
      // Tint cycles smoke-white → bright pink → smoke-white for a
      // chromatic "neon flare" sweep.
      // PREMIUM RESTRAINT (2026-05-30, user "logo looks not cool / too busy"):
      // a slow, gentle inner gloss in a CONSTANT warm smoke-white — the old
      // magenta tint-cycling pulse read as cheap/gaudy. 6s period, low ceiling.
      logoShine.alpha = 0.12;   // constant gentle gloss — no idle pulse (logo is static)
      logoShine.tint = 0xfff2f8;                                     // steady warm gloss
    }

    // reels
    tickReels();
    renderReels();
    drawPortal(now);
    drawCornerJewels(now); // pulsing brand heart-jewels at reel-grid corners
    drawSpinHalo(now);   // idle CTA halo + active spin sparks (every frame)
    drawLinesPreviewFrame(now);   // 10-lines preview overlay (when active)
    drawBtnAuras(now);   // breathing aura behind ACTIVE state buttons
    tickFlyUps(now);     // animate +$ fly-up text per winning line
    tickBalanceCoinUp(now); // balance count-up + pop on credit

    // ── BUTTON STATE TWEEN — hover/press/active scale + tint + ping
    // lerped each frame for smooth react-bits-style interactivity (Emil's
    // web-animations methodology, native to PixiJS).
    //   - scale: 0.28 decay = ~180ms ease-out feel
    //   - tint:  0.32 decay = ~160ms ease-out — slightly faster than scale
    //            so the colour leads the size (perception trick)
    //   - ping:  one-shot 320ms expand+fade, pixi-friendly Graphics clear
    // ICON_BTNS is hoisted to module scope (see above) — no per-frame alloc.
    ICON_BTNS.forEach(b => {
      if(!b || b._targetScale == null) return;
      // scale lerp
      b._displayScale += (b._targetScale - b._displayScale) * 0.28;
      b.scale.set(b._displayScale);
      // tint lerp — interpolate r/g/b components, recompose into PIXI tint
      if(b._tintDisplay && b._tintTarget){
        const td = b._tintDisplay, tt = b._tintTarget;
        td[0] += (tt[0] - td[0]) * 0.32;
        td[1] += (tt[1] - td[1]) * 0.32;
        td[2] += (tt[2] - td[2]) * 0.32;
        b._icon.tint = (Math.round(td[0])<<16) | (Math.round(td[1])<<8) | Math.round(td[2]);
      }
      // ping ring on press — additive feel via stroke + fade
      if(b._ping && b._pingT0){
        const pt = (now - b._pingT0) / 320;
        if(pt >= 1){
          b._pingT0 = 0; b._ping.clear(); b._ping.alpha = 0;
        } else {
          const eased = 1 - Math.pow(1-pt, 3);   // ease-out cubic
          const r0 = (b._icon.texture?.width || 32) * 0.55;
          const r1 = r0 * (1 + eased * 0.45);
          b._ping.clear();
          b._ping.alpha = (1 - pt) * 0.6;
          b._ping.circle(0, 0, r1).stroke({ color:THEME.colors.accent, width:2, alpha:1 });
        }
      }
    });

    // ── STEPPER PRESS LERP (2026-05-31) — +/- spring toward _targetScale
    // (press dip 0.86 / hover 1.08 / rest). 0.30 decay ≈ 170ms ease-out.
    for(let i = 0; i < STEPPER_BTNS.length; i++){
      const s = STEPPER_BTNS[i];
      if(!s || s._targetScale == null) continue;
      s._displayScale += (s._targetScale - s._displayScale) * 0.30;
      s.scale.set(s._displayScale);
    }

    // ── INTRO OVERLAY — fade in (260ms ease-out), fade out (240ms),
    // CTA gentle pulse. Emil-style: transform+opacity only, ease-out default.
    if(introOverlay.visible){
      if(introOverlay._fadeIn){
        const t = Math.min(1, (now - introOverlay._fadeIn) / 260);
        introOverlay.alpha = 1 - Math.pow(1-t, 3);   // ease-out cubic
        if(t >= 1) introOverlay._fadeIn = 0;
      }
      // P4 — rAF-driven auto-dismiss for repeat sessions (timer-throttle
      // proof). Once _autoMs has elapsed since the intro appeared, kick
      // off the same fade-out path a tap would trigger.
      if(introOverlay._autoMs && !introOverlay._dismissing &&
         (now - introOverlay._shownAt) > introOverlay._autoMs){
        irisDismissIntro();    // Beat 4 — repeat-session auto-dismiss uses the iris too
      }
      // When the GSAP iris-wipe is running it owns the dismiss animation; the
      // render-loop alpha fade below is only the reduced-motion / no-GSAP path.
      if(introOverlay._dismissing && !introOverlay._irisActive){
        const t = Math.min(1, (now - introOverlay._fadeStart) / 240);
        introOverlay.alpha = 1 - t;
        if(t >= 1){
          introOverlay.visible = false;
          introOverlay._dismissing = false;
          const cb = introOverlay._onDismiss;
          introOverlay._onDismiss = null;
          if(cb) cb();
        }
      } else if(!isReduced()){
        // AAA AMBIENT — gold sparkle drift on the intro overlay. 1 new
        // particle every ~140ms drifting upward from the bottom.
        if(!introOverlay._lastSparkle) introOverlay._lastSparkle = now;
        if(now - introOverlay._lastSparkle > 140){
          introOverlay._lastSparkle = now;
          const W = app.screen.width, H = app.screen.height;
          particles.push({
            x: vrnd() * W,
            y: H + 10,
            vx: (vrnd() - 0.5) * 0.4,
            vy: -0.6 - vrnd() * 0.5,
            life: 2400 + vrnd() * 1200,
            t: 0,
            color: vrnd() < 0.7 ? 0xff2f93 : 0xff77c0,
            r: 1.4 + vrnd() * 1.2,
          });
        }
        // ── LOGO ENTRANCE — 640ms smooth premium rise: scale 0.80 → 1.0 on
        // outQuint (NO bouncy overshoot — a detailed crest must settle, not
        // pop) + alpha 0 → 1 (ease-out cubic). Runs ONCE then yields to the
        // gentle float/breathe below.
        if(introOverlay._logoT0){
          const lt = (now - introOverlay._logoT0) / 640;
          if(lt < 0){
            // not started yet — keep at intro state
            introLogo.alpha = 0;
          } else if(lt < 1){
            introLogo.alpha = 1 - Math.pow(1-lt, 3);
            introLogo.scale.set(introOverlay._logoBaseScale * (0.80 + 0.20 * (1 - Math.pow(1-lt, 5))));   // outQuint
          } else {
            // settle to final, hand off to bob
            introLogo.alpha = 1;
            introLogo.scale.set(introOverlay._logoBaseScale);
            introOverlay._logoT0 = 0;
          }
        } else {
          // CTA gentle pulse — under 300ms cadence reads as "alive" not noisy
          const p = (Math.sin(now * 0.004) + 1) * 0.5;
          introCta.alpha = 0.62 + p * 0.38;
          introCta.scale.set(0.985 + p * 0.03);
          // logo IDLE — elegant float + slow scale-breathe, NO rotation wobble
          // (a tilting crest reads as cheap). Premium, alive, restrained.
          if(introLogo._baseY != null){
            introLogo.y = introLogo._baseY + Math.sin(now * 0.0013) * 3;
            introLogo.scale.set(introOverlay._logoBaseScale * (1 + Math.sin(now * 0.0016) * 0.012));
            introLogo.rotation = 0;
          }
          // ── INTRO CARD SHINE SWEEP — diagonal white highlight that
          // travels across each card every ~3.5s. UI verse signature.
          // Each card has a different phase so they don't sweep together.
          [introCard1, introCard2, introCard3].forEach(card => {
            if(!card._shine) return;
            const cardW = card._value ? Math.max(140, card._plate ? 168 : 140) : 168;
            // Width estimate from layout — close enough for visual sweep
            const w = 168, h = 168*1.65;
            const sweepDur = 3500;
            const t = ((now + card._shinePhase * sweepDur / (Math.PI*2)) % sweepDur) / sweepDur;
            // Only draw shine during the active sweep window (40-70%)
            card._shine.clear();
            if(t > 0.40 && t < 0.70){
              const sweepP = (t - 0.40) / 0.30;
              const sweepX = -w/2 + sweepP * (w + 60);
              // Diagonal band — top-left to bottom-right
              const bandW = 22;
              const skewY = h * 0.3;
              card._shine.poly([
                sweepX,         -h/2,
                sweepX+bandW,   -h/2,
                sweepX+bandW-skewY, h/2,
                sweepX-skewY,    h/2,
              ]).fill({ color:0xffffff, alpha: 0.08 * (1 - Math.abs(sweepP - 0.5) * 2) });
            }
          });
        }
      }
    }

    // win cell highlight — winners JUMP onto the stage, losers freeze + dim
    const showHl = revealActive || (winFx.on && winFx.tier>=2);
    const winSet = new Set(winCells.map(c => c.r+'_'+c.row));
    const reducedHl = isReduced();
    for(let r=0;r<REELS;r++){
      for(let k=1;k<=3;k++){
        const s=reels[r].sprites[k];
        const row=k-1;
        const base=symScale(s.texture, CELL*0.92);
        if(showHl && winCells.length){
          if(winSet.has(r+'_'+row)){
            // WINNER — outBack pop (one cute overshoot), staggered left→right by
            // reel, then an alive bounce + rotation jiggle. Bigger wins jump higher
            // and lift off the reel — "dumped" onto the stage.
            const tier=winVfxTier||1;
            const prem=reels[r].symbols[k]>=6;   // Seven & Crown — premium symbols
            const hold=1.15 + Math.min(tier,5)*0.05 + (prem?0.22:0);
            const t=now-revealT0-r*46;
            let pop=1, rot=0, hop=0, sx3d=1;
            if(reducedHl){ pop=1.08; }
            else if(t>0){
              const popDur=prem?540:460;
              if(t<popDur) pop=1+(hold-1)*outBack(t/popDur);
              else         pop=hold+Math.sin((t-popDur)*0.006)*(prem?0.06:0.045);
              // a whisper of elegant sway + a slow fake-3D turn (scale.x oscillation)
              rot=Math.sin(t*0.0042 + r*0.5)*0.022;
              sx3d=1+Math.sin(t*0.0032 + r*0.7)*0.06;
              // premium symbols — a dramatic presentation flourish (decaying swing)
              if(prem) rot += Math.sin(t*0.0095)*0.17*Math.max(0,1-t/1500);
              if(tier>=3 || prem){
                const lift = t<popDur ? 0.5-0.5*Math.cos(t/popDur*Math.PI) : 1;
                hop = -lift*CELL*(prem?0.13:0.09) - Math.abs(Math.sin(t*0.0042))*CELL*0.03;
              }
            }
            s.scale.set(base*pop*sx3d, base*pop);
            s.rotation=rot;
            s.y=(k-0.5)*CELL + reels[r].offset + hop;
            s.alpha=1;
          } else {
            // LOSER — only dim; keep renderReels' enveloped idle breathing so the
            // symbol stays alive and the win⇄idle state change is still smooth
            s.alpha=0.4;
          }
        } else {
          s.alpha=1;
        }
      }
      // buffer cells (k=0,4) stay masked off-window
    }
    // ── BET CHIP (2026-05-30) — procedural obsidian/magenta token behind the
    // bet value so the selected bet reads as a premium chip, matching panels.
    betChipG.clear();
    if(betValue.alpha > 0.05 && betValue.text){
      const bw=betValue.width, bh=betValue.height, ay=betValue.anchor.y;
      const CW=Math.max(66, bw+26), CH=bh+14;                 // MIN-WIDTH so small bets aren't cramped; grows for big bets
      // Centre the chip-box on the value's VISUAL centre regardless of the text's
      // horizontal anchor. Landscape uses anchor.x=1 (betValue.x = RIGHT edge); without
      // this the box drifted right of the glyphs and slid under the +/- steppers.
      const _vcx = betValue.x - bw*(betValue.anchor.x - 0.5);
      const L=_vcx - CW/2, T=betValue.y - bh*ay - 7;          // box CENTRED on the value glyphs
      // WIN (LABEL *and* VALUE) yields to BET continuously. The earlier check
      // only looked at the value, so the "WIN" *label* still showed next to
      // "BET" -> "WIN BET" collision. Now we take the rightmost edge of either
      // and hide BOTH if it reaches the bet chip. The win still shows in the
      // centre celebration popup.
      const _winPortrait = window.innerHeight > window.innerWidth;
      if((winLabel.alpha > 0 || winValue.alpha > 0) && !_winPortrait){
        // LANDSCAPE only — WIN shares the bar row with BET, so scale-to-fit it
        // before the bet chip's left edge to avoid a "WIN BET" collision.
        // (PORTRAIT puts WIN in its OWN row → this false-positive shrink was
        // exactly the "win too small on mobile" bug. Skipped below.)
        const wAtBase = w => (w.width/(w.scale.x||1))*(w._baseScale||w.scale.x||1);
        const lW = wAtBase(winLabel), vW = wAtBase(winValue);
        const left  = Math.min(winLabel.x - lW*winLabel.anchor.x, winValue.x - vW*winValue.anchor.x);
        const right = Math.max(winLabel.x + lW*(1-winLabel.anchor.x), winValue.x + vW*(1-winValue.anchor.x));
        const fitCollide = Math.max(0.5, Math.min(1, ((L - 18) - left) / Math.max(1, right - left)));
        // ALSO cap the WIN value to its own centred slot — a long crypto string
        // ("BTC 0.60000000") would otherwise grow LEFT into the BALANCE slot.
        const fitSlot = (winValue._maxW && vW > winValue._maxW) ? winValue._maxW / vW : 1;
        const fit = Math.max(0.5, Math.min(fitCollide, fitSlot));
        winLabel._fit = winValue._fit = fit;
        if(!winValue._popActive){
          winLabel.scale.set((winLabel._baseScale||winLabel.scale.x)*fit);
          winValue.scale.set((winValue._baseScale||winValue.scale.x)*fit);
        }
      } else if(_winPortrait){
        // PORTRAIT — WIN owns the RIGHT of row 1 (left of the big SPIN CTA). Re-derive the slot
        // from the CURRENT balance width every frame: the balance coin-up (0→$1,000 at boot) and
        // post-win credits change balValue's width AFTER layout, so a slot frozen at layout time
        // goes stale → the boot "$1,000.00$150.00" overlap. _slotRight (the spin-aware right edge)
        // is stored by layout; balValue.width is live here, so WIN tracks the balance + clears SPIN.
        if(winValue._slotRight != null){
          const _bR = balValue.x + balValue.width + 12;
          const _sL = _bR + 8, _sR = winValue._slotRight;
          const _cx = (_sL + _sR) / 2;
          winLabel.x = winValue.x = _cx;
          winValue._maxW = Math.max(30, (_sR - _sL) - 6);
        }
        // Then cap to the (live) slot EVERY frame, incl. during the pop — vNat is the natural
        // width at base scale, independent of the pop's k, so flashWinValue's bounce stays inside.
        const vNat = (winValue.width/(winValue.scale.x||1))*(winValue._baseScale||winValue.scale.x||1);
        const fitSlot = (winValue._maxW && vNat > winValue._maxW) ? winValue._maxW / vNat : 1;
        winLabel._fit = winValue._fit = fitSlot;
        if(!winValue._popActive){
          winLabel.scale.set((winLabel._baseScale || winLabel.scale.x)*fitSlot);
          winValue.scale.set((winValue._baseScale || winValue.scale.x)*fitSlot);
        }
      }
      betChipG.roundRect(L-2,T-1,CW+4,CH+4,11).fill({ color:0xe9bf5a, alpha:0.10 })
              .roundRect(L,T,CW,CH,9).fill({ color:0x120e09, alpha:0.90 })
              .roundRect(L,T,CW,CH,9).stroke({ color:0xe9bf5a, width:1.2, alpha:0.85 })
              .roundRect(L+6,T+1.5,CW-12,0.8,0.4).fill({ color:0xf1e9d7, alpha:0.4 });
    }
    // win VFX — CGI bounding box · rays · symbol bloom · sparkle · fire · 3D shadow
    drawWinVfx(now, showHl && winCells.length>0);

    // ── #12 IDLE GLOW — high-value symbols (Seven/Crown/Star) breathe a subtle
    // gold aura at rest to draw the eye; low-value symbols stay completely
    // static. drawWinVfx() above just reset every glow this frame, so this
    // layers on top and ONLY runs when fully idle — it can never fight a win
    // highlight or a spin. Low-value cells `continue` ⇒ zero per-frame work.
    if(!allReelsSpinning && !showHl && !isReduced()){
      const ip = 0.15 + 0.12*Math.sin(now*0.0022);          // gentle breathing 0.15..0.27
      for(let r=0;r<REELS;r++){
        const rl = reels[r];
        for(let row=0; row<ROWS; row++){
          const k = row+1;                                   // glow/sprite index of a visible row
          if(!shouldAnimateIdle(rl.symbols[k])) continue;    // low/mid value → stays static
          const cc = cellCenter(r, row);
          const gl = rl.glows[k];
          gl.visible = true;
          gl.texture = SYM_TEX[rl.symbols[k]];
          gl.tint = THEME.colors.accent;                     // magenta idle aura (accent is now magenta)
          gl.position.set(cc.x, cc.y);
          gl.scale.set(symScale(gl.texture, CELL*0.92) * (1.02 + 0.025*Math.sin(now*0.0022 + r*0.6)));
          gl.alpha = ip;
        }
      }
    }

    // ── PAYLINE DRAWING — AAA win-combo visualisation
    //   Layer 1: outer PINK glow (wider, soft) — establishes the path
    //   Layer 2: mid line in line-specific color — readable trace
    //   Layer 3: smoke-white inner highlight — bright energy core
    //   Layer 4: tip dot at the line's leading edge (during draw-in)
    //   Layer 5: per-cell pulse halo at each winning symbol on the line
    lineG.clear();
    if(showHl && winLines.length){
      const dp=Math.min(1,(now-revealT0)/280);
      const drawProg=isReduced()?1:(1-(1-dp)*(1-dp));
      // ── WIN LINE CYCLING (2026-05-27 per user "win line need also move
      // to end all combination line need show in the merged like two or
      // more win line combinations sequentially looping").
      // When 2+ lines win, cycle through them ONE AT A TIME so each combo
      // is readable. After all individual lines shown (cycleEnd reached),
      // show ALL of them together for a "merged finale" until the player
      // spins again.
      const cyclePer = isReduced() ? 700 : 1200;  // ms per line
      const totalCycle = cyclePer * winLines.length;
      const cycleElapsed = now - revealT0;
      const multi = winLines.length > 1;
      // ── PHASE 0 — "SHOW ALL LINES" FADE-IN (2026-06-01, per user: "show all
      // win lines in first fade-in effect, then step-by-step replace/toggle").
      // For multi-line wins we first reveal EVERY winning line together and fade
      // the whole additive connector layer in — the player sees the full win at a
      // glance. Each line keeps its OWN colour (not a merged magenta bar), and the
      // moment is brief; it then resolves into the readable one-at-a-time cycle.
      const allPhaseDur = isReduced() ? 650 : 1050;   // ms the "all lines" intro holds
      const showAllPhase = multi && cycleElapsed < allPhaseDur;
      lineG.alpha = showAllPhase ? Math.min(1, cycleElapsed / (allPhaseDur*0.55)) : 1;  // fade-in
      // ── PHASE 1 — one line at a time, looping (clock offset so it starts AFTER
      // the all-phase). Single-line wins skip both phases and just draw.
      const inIndividualPhase = multi && !showAllPhase;
      const activeIdx = inIndividualPhase ? (Math.floor((cycleElapsed - allPhaseDur) / cyclePer) % winLines.length) : -1;
      winLines.forEach((wl,idx) => {
        // In individual-cycle phase, only the active line draws
        if(inIndividualPhase && idx !== activeIdx) return;
        const li = wl.line, count = wl.count;
        const pat=LINES[li];
        const col=LINE_COLORS[li%LINE_COLORS.length];
        const pulse=0.5+0.5*Math.sin(now*0.008+idx);
        // ── CROWN-TO-CORNER FIX ── draw EXACTLY this line's winning reels
        // (0..count-1) from its OWN authoritative count. The old code scanned the
        // SHARED flat winCells (merged across every line + scatter cells), so an
        // unrelated cell could inflate maxR → a polyline stretched to reels it
        // never won, and a stray/odd-length pts array anchored a segment at the
        // (0,0) Graphics origin (the "line/crown to the top-left corner").
        const n=count, segs=count-1;
        if(segs<1) return;   // need ≥2 cells for a line (was <2 — dropped 2-of-a-kind)
        const full=[];
        for(let r=0;r<n;r++){
          const cc=cellCenter(r,pat[r]);
          if(!Number.isFinite(cc.x)||!Number.isFinite(cc.y)) return;
          // GUARD (2026-05-30): a win-line point MUST sit inside the reel
          // window. Kills the "lines fanning from the top-left (0,0) corner"
          // bug. If a point escapes the window we drop the whole line and
          // stash the offending values so the root cause is inspectable.
          if(cc.x < GX-2 || cc.x > GX+GW+2 || cc.y < GY-2 || cc.y > GY+GH+2){
            window.__lineBug = { li, count, r, ccx:Math.round(cc.x), ccy:Math.round(cc.y),
              GX:Math.round(GX), GY:Math.round(GY), GW:Math.round(GW), GH:Math.round(GH) };
            return;
          }
          full.push(cc);
        }
        const reach=drawProg*segs;
        const pts=[full[0].x, full[0].y];
        for(let s=0;s<segs;s++){
          if(reach>=s+1){ pts.push(full[s+1].x, full[s+1].y); }
          else { const f=reach-s; if(f>0) pts.push(full[s].x+(full[s+1].x-full[s].x)*f, full[s].y+(full[s+1].y-full[s].y)*f); break; }
        }
        if(pts.length>=4){
          // ── RICH WIN-LINE VFX (2026-05-27) — 7-layer luminous tube ──
          // Per user "win line need more rich and strong VFX for $105 expert
          // level". Previous was 3 strokes; now 5 strokes + traveling
          // running-light pips + brighter cell halos + chromatic edge.
          //
          // ── WIN LINE RESTORED (2026-05-30 per user — keep the line!) ─────
          // 3 clean strokes: soft glow, accent, bright core. (Fully removing
          // it made wins read "crushed/empty".) The element the user actually
          // wanted gone is the BONUS sticky-crown connector, handled elsewhere.
          // BASE game draws the connecting win line. In the BONUS we SKIP it:
          // the line through scattered sticky crowns read as a messy "vary
          // base" tangle (user) — there the winning symbols just glow (the
          // per-cell VFX below). Keeps the line where it's clean, kills the
          // bonus-crown tangle.
          if(true){   // WIN-LINE now draws in BOTH base game AND free spins (user: "add the real win line in free spins and main game")
            // A STRAIGHT HORIZONTAL payline (top/middle/bottom row) spans the
            // whole grid -> on a wide screen it reads as a full-width BAR
            // (user: "in the win, from center full width, what is that?").
            // Detect a flat line and draw it MUCH thinner + dimmer so it's an
            // elegant trace, not a bar. Diagonal/V lines keep full presence.
            // FLAT rows = a straight horizontal payline spanning the WHOLE grid.
            // Even thin it reads as the "full-width graphic bug" (user, repeatedly),
            // so the EDGE-TO-EDGE CONNECTOR IS DRAWN ONLY FOR SHAPED PATTERNS
            // (diagonal / V) where it's an elegant trace. Flat wins are shown by
            // the per-cell glow chain below (no full-width bar). Shaped win-lines
            // stay intact so we never "hide the win line" again. (Build V.)
            // 2026-05-31 ROOT-CAUSE FIX for the recurring "full-width pink bar
            // on win" bug. The flat-check was scanning the FULL 5-cell payline
            // pattern (pat.every) — but the connector is only drawn for the
            // first `count` (WINNING) cells. So a 3-of-a-kind whose winning
            // cells are all on one row (visually flat) but whose tail varied
            // → flat=false → a horizontal connector bar got drawn through the
            // winning row (the bar the user kept seeing at the top/middle).
            // Fix: only consider the WINNING cells (pat.slice(0,count)). Now a
            // collinear winning run is correctly detected as flat → connector
            // skipped → the per-cell glow chain shows the win, no bar.
            // FLAT-ish = the winning cells span ≤ 1 row vertically. A straight
            // OR near-straight horizontal run reads as a full-width "bar" (THE
            // magenta line the user fought for days — on a multi-line big win
            // several of them stacked into parallel bars). Skip the connector
            // for these; the per-cell glow shows the win. Only genuinely SHAPED
            // wins (≥2 rows of spread: diagonals / V) keep the elegant line.
            // Connector draws for SHAPED win-lines (diagonal / V) — an elegant
            // trace through the winning cell centres. FLAT / near-horizontal wins
            // (winning cells within ≤1 row) are SKIPPED: a straight line across
            // the winning row spans the reels and reads as the "magenta bar" the
            // user keeps flagging — so those wins are shown by the per-cell GLOW
            // chain below instead (the symbols light up, NO bar). Build AT briefly
            // re-enabled horizontal connectors → the bar came back "in some cases"
            // → reverted here. (Free-spins stays enabled via the outer block.)
            // ── ALWAYS-ON WIN-LINE FILAMENT (2026-05-31 expert redesign) ─────
            // REVERSES the flat-skip described above: the line now draws for
            // EVERY win, flat OR shaped (user: "win line need ALWAYS showing...
            // show the FULL line, not only the symbols"). The old "full-width
            // magenta BAR" problem is solved NOT by hiding the line but by making
            // it a thin animated FILAMENT — slim layered additive glow + a thin
            // bright core + TRAVELING comet pips that flow along it. Motion +
            // thinness read as "energy through the symbols", never a static slab;
            // the per-cell glow nodes (below) anchor the ends so it emerges from
            // the winning symbols rather than spanning edge-to-edge.
            // ── BOOSTED LASER WIN-LINE (2026-05-31 expert VFX pass) ──────────
            // BONUS/free-spins scene = a HOTTER magenta-white CRYSTAL laser variation
            // with a cyan chromatic ghost + more energy pips (user: "in the bonus scene
            // need a second variation, more laser / shader / cinematic"). Base game
            // keeps the per-line magenta/white identity. (Was gold-white — off the
            // black/magenta-villain brand, recolored 2026-06-01.)
            const _lineBonus = (typeof _bonusState !== 'undefined') && _bonusState && _bonusState.active;
            const cGlow = _lineBonus ? 0xff2f93 : 0xff5a9c;
            const cMid  = _lineBonus ? 0xffe6f4 : col;
            // ── FULL PAYLINE PATH (user: "show the win line FULLY, not only the
            // win size; if only 3 win, show where the line continues to the end").
            // The TAIL (count..4) fades in AFTER the winning segment draws and is a
            // thin, low-alpha ghost trace so a flat payline's continuation never
            // reads as the old solid full-width bar.
            if(drawProg > 0.55){
              const _tail=[];
              for(let r=count;r<REELS;r++){
                const cc=cellCenter(r,pat[r]);
                if(cc.x<GX-2||cc.x>GX+GW+2||cc.y<GY-2||cc.y>GY+GH+2) break;
                _tail.push(cc);
              }
              if(_tail.length){
                const _ta=Math.min(1,(drawProg-0.55)/0.45);
                const _tp=[full[n-1].x, full[n-1].y];
                for(const c of _tail) _tp.push(c.x, c.y);
                lineG.poly(_tp,false).stroke({ color:cMid,    width:1.6, alpha:0.13*_ta });
                lineG.poly(_tp,false).stroke({ color:0xfff4fb, width:0.7, alpha:0.20*_ta });
                // (tail node dots removed 2026-06-02 — the thin ghost stroke alone reads cleaner)
              }
            }
            // (1+2) DOUBLE OUTER BLOOM — wide soft + tighter, additive. ~22% more
            // presence (2026-06-01, user "win lines stronger" — kept a FILAMENT, not
            // a slab: only the soft bloom + core grew, the body stays slim).
            lineG.poly(pts,false).stroke({ color:cGlow, width:(_lineBonus?13:10)+3.5*pulse, alpha:(0.12+0.06*pulse)*drawProg });
            lineG.poly(pts,false).stroke({ color:cGlow, width:(_lineBonus?7:5)+1.8*pulse, alpha:(0.22+0.08*pulse)*drawProg });
            // (3) MID ACCENT — line colour
            lineG.poly(pts,false).stroke({ color:cMid, width:(_lineBonus?3.9:3.1)+0.9*pulse, alpha:(0.44+0.12*pulse)*drawProg });
            // (4) BRIGHT CORE — hot white filament
            lineG.poly(pts,false).stroke({ color:0xfff8fc, width:(_lineBonus?1.6:1.2)+0.4*pulse, alpha:0.6*drawProg });
            // (4b) CHROMATIC GHOST — faint cyan over-stroke = laser/shader read (bonus)
            if(_lineBonus){
              lineG.poly(pts,false).stroke({ color:0x9fe9ff, width:0.9, alpha:0.45*drawProg });
            }
            // (5) TRAVELING ENERGY — comet pips flow along the DRAWN portion
            // (arc-length walk). Bonus = more pips, faster, brighter.
            {
              const _segL=[]; let _tot=0;
              for(let s=0;s<full.length-1;s++){ const L=Math.hypot(full[s+1].x-full[s].x, full[s+1].y-full[s].y); _segL.push(L); _tot+=L; }
              const _reachLen=drawProg*_tot;
              const _nP=_lineBonus?4:2, _spd=_lineBonus?0.00088:0.00055;
              for(let pp=0;pp<_nP;pp++){
                const _tt=((now*_spd + pp/_nP) % 1);
                const _d=_tt*_tot;
                if(_d>_reachLen || _tot<=0) continue;
                let _acc=0, _si=0;
                while(_si<_segL.length-1 && _acc+_segL[_si] < _d){ _acc+=_segL[_si]; _si++; }
                const _f = _segL[_si]>0 ? (_d-_acc)/_segL[_si] : 0;
                const _px=full[_si].x+(full[_si+1].x-full[_si].x)*_f;
                const _py=full[_si].y+(full[_si+1].y-full[_si].y)*_f;
                // sliding SHEEN DASH (not a bead) — light running along the wire
                const _bx=full[_si].x+(full[_si+1].x-full[_si].x)*Math.max(0,_f-0.16);
                const _by=full[_si].y+(full[_si+1].y-full[_si].y)*Math.max(0,_f-0.16);
                lineG.poly([_bx,_by,_px,_py],false).stroke({ color:cMid,    width:(_lineBonus?3.2:2.4), alpha:0.30*drawProg, cap:'round' });
                lineG.poly([_bx,_by,_px,_py],false).stroke({ color:0xffffff, width:(_lineBonus?1.4:1.1), alpha:0.85*drawProg, cap:'round' });
              }
            }
            // (6) ENDPOINT SOFT BLOOM — the line gently lights its first + last
            // winning symbols once drawn. Soft additive halo ONLY (no hard bead).
            if(drawProg > 0.92){
              const _mf=0.5+0.5*Math.sin(now*0.012);
              for(const _e of [full[0], full[n-1]]){
                lineG.circle(_e.x,_e.y, (_lineBonus?16:12)+3*_mf).fill({ color:cGlow, alpha:0.08+0.05*_mf });
              }
            }
          }
          // (8) PER-CELL VFX — soft RADIAL HALO + 4 floating sparkle pips
          // 2026-05-27 fix per user "win case showing under the symbol
          // circle line — remove this, replace for real VFX effect".
          // The hard circle outline read as a UI selection ring (cheap).
          // New: SOFT additive halo bloom + outward sparkle pips drifting
          // around the cell — no hard line, just light energy.
          if(drawProg >= 1 || drawProg > 0.85){
            for(let r=0;r<n;r++){
              if(reach < r) break;
              const cc = full[r];
              const rad = CELL*0.48 + pulse*2;
              // ── (a) RADIAL GLOW BLOOM — additive, 4 stacked layers
              // (softer-and-softer outward) → feels like the symbol is
              // emitting light, not selected by a ring.
              for(let gi = 4; gi >= 1; gi--){
                const gr = rad * (0.55 + gi * 0.18);
                const ga = (1 - gi/4) * 0.18 + 0.04;
                lineG.circle(cc.x, cc.y, gr)
                  .fill({ color:0xff007f, alpha: ga * (0.65 + 0.35*pulse) });
              }
              // ── (b) SMOKE-WHITE INNER FLARE — focal hot core behind text
              lineG.circle(cc.x, cc.y, rad * 0.55)
                .fill({ color:0xf5f7fa, alpha: 0.06 + 0.05*pulse });
              // (c) orbiting sparkle cross+dot pips REMOVED (2026-06-02) — they read
              // as cheap "dots" around each symbol; the soft radial halo is enough.
            }
          }
        }
      });
    }

    // win celebration display — ease-out pop-in, hold, fade-out
    // Emil/web-animations rules applied:
    //   • Entry scale floor 0.93 (was 0.88 — Emil: "never below 0.9, looks
    //     like it comes out of nowhere"). 0.93 reads as a subtle pop, not
    //     a teleport.
    //   • Entry 220ms ease-out cubic (under 300ms ceiling)
    //   • Big wins (tier≥3) use outBack overshoot for the dump feel
    //   • Exit 280ms ease-out, scale 1 → 0.95 (never to 0)
    //   • Idle "breathing" on tier≥4 — 3% sin wave, gentle ambient life
    if(winFx.on){
      // #16 skip: a tap/Space sets fastFwd → jump straight to the natural-end
      // teardown below (reuses the exact cleanup; no separate path, no t0 math).
      if(winFx.fastFwd){ winFx.t0 = now - winFx.dur - 1; }
      const el = now - winFx.t0;
      const tier = winFx.tier;
      const W = app.screen.width, H = app.screen.height;
      const cx = W/2, cy = GY + GH*0.5;
      winDisplay.position.set(cx, cy);
      // ── BEAT-DRIVEN COUNT-UP (3-beat: anticipation → count → savour) ─────
      // Number holds at 0 during the anticipation breath (el ≤ tAnt), then races
      // up easeOutExpo to the LANDING (tLand) with ~30% of the window left to
      // savour. Replaces the old plain cubic over max(420, dur*0.55).
      const tAnt  = winFx.tAnt  || 0;
      const tLand = winFx.tLand || (winFx.dur * 0.55);
      let countP;
      if(el <= tAnt)        countP = 0;
      else if(el >= tLand)  countP = 1;
      else                  countP = (el - tAnt) / (tLand - tAnt);
      const countEase = easeOutExpo(countP);
      const targetX6 = winFx.countX6Target || 0;
      const curX6 = Math.round(targetX6 * countEase);
      if(curX6 !== winFx.countX6Display){
        winFx.countX6Display = curX6;
        bigWinAmount.text = fmtMoney(curX6);
        if(!isReduced()){ try { Sound.tally(now); } catch(e){} }   // pitch-climbing tally pip
      }
      // ── LANDING (start of BEAT-3 SAVOUR) — fires ONCE via the landFired latch ─
      if(countP >= 1 && !winFx.popT0){
        winFx.popT0 = now;
        if(!winFx.landFired){
          winFx.landFired = true;
          if(!isReduced()){
            // particle WAVE + full cascade SECOND wave at the money moment
            spawnParticles(W/2, GY+GH*0.42, winFx.tier*7, winFx.tier);
            if(winFx.tier>=3) spawnCascade(winFx.tier, false, 1.0);
            if(winFx.tier>=4){ shakeAmount = winFx.tier*4; shakeT0 = now; }   // impact shake
          }
          try { Sound.winLand(winFx.tier); } catch(e){}   // distinct ka-ching sting on the hit
        }
      }
      // ── DYNAMIC FONT-FIT + ELASTIC LANDING POP (single measure, not doubled) ─
      const maxW = Math.min(W * 0.78, 560);
      bigWinAmount.scale.set(1);
      const dynScale = (bigWinAmount.width / maxW) > 1 ? (1 / (bigWinAmount.width / maxW)) : 1;
      let popScale = 1;
      if(winFx.popT0 && !isReduced()){
        const pe = (now - winFx.popT0) / 380;             // 380ms spring window
        if(pe < 1) popScale = 1 + popElastic(pe) * (winFx.tier>=5 ? 0.42 : 0.30);   // sharp hit, not a soft bounce
      }
      bigWinAmount.scale.set(dynScale * popScale);
      // ── LIVING TINT — warm to crystal-white-pink on landing (NOT gold), then
      // cool back to smoke-white. In-brand de-gold (G-8, B-12; was G-16, B-64).
      if(winFx.popT0){
        const _te = Math.min(1, (now - winFx.popT0)/420);
        const _warm = Math.sin(_te*Math.PI);    // 0 → 1 → 0
        bigWinAmount.tint = (255<<16) | ((255 - Math.round(_warm*8))<<8) | (255 - Math.round(_warm*12));
      } else if(bigWinAmount.tint !== 0xffffff){
        bigWinAmount.tint = 0xffffff;
      }
      // ── ENVELOPE — alpha + scale of the WHOLE popup
      if(el >= winFx.dur){
        winFx.on = false;
        winFx.fastFwd = false;   // #16: disarm for the next celebration
        winDisplay.alpha = 0;
        winDisplay.scale.set(1);
        winFxThrone.clear();
        winFxBurst.clear();
        winUnderlineG.clear();   // (build W) symmetric teardown — the per-frame
        winRibbonG.clear();      // redraw clears these every frame, so the
                                 // natural end must too, else the last ribbon +
                                 // underline ghost behind the next idle frame.
        winGemG.clear(); winGems.length = 0;   // dump the treasure cascade
        bigWinAmount.tint = 0xffffff;          // reset the living count-up tint
        winFx.landFired = false;               // re-arm the savour-wave latch
        winFx._arc = null;                     // drop the arcane-bolt set
      } else {
        const inMs  = isReduced() ? 1 : Math.max(tAnt, 200);   // entry covers the anticipation beat
        const outMs = isReduced() ? 1 : 360;                   // FIXED deliberate exit (was min(320, dur*0.3))
        let envScale = 1, envAlpha = 1;
        if(el < inMs){
          const p = el / inMs;
          const e = isReduced() ? 1 : backOutSoft(p);          // premium overshoot on the WHOLE popup
          envAlpha = Math.min(1, p * 1.6);
          envScale = 0.94 + 0.06 * e;                          // floor 0.94 (never below 0.9)
        } else if(el > winFx.dur - outMs){
          const p = (el - (winFx.dur - outMs)) / outMs;
          const eOut = easeInCubic(p);                         // deliberate, accelerating exit
          envAlpha = 1 - eOut;
          envScale = 1 - 0.05 * eOut;
        } else {
          // SAVOUR hold — number sits bright; the whole popup barely breathes.
          envScale = 1 + (tier >= 4 ? Math.sin((el - inMs) * 0.0030) * 0.012 : 0);   // halved (was 0.025)
        }
        winDisplay.alpha = envAlpha;
        winDisplay.scale.set(envScale);
        // ── EXPERT WIN POPUP (2026-05-27 — design-critique driven) ───────
        // Critique findings: previous design buried the amount under decoration.
        // Fix: STRICT HIERARCHY — top RIBBON STAMP (tier label) → CENTER HERO
        // AMOUNT → BOTTOM MULTIPLIER SUBTEXT. Backdrop drama is tier-scaled
        // (subtle for WIN, dramatic for EPIC) but never competes with the amount.
        //
        // Tier ladder:
        //   2 WIN        — small halo only
        //   3 NICE WIN   — halo + 6 outward sparkle pips
        //   4 BIG WIN    — halo + 8 rays + 8 sparkles
        //   5 MEGA WIN   — halo + 12 rays + 12 sparkles + dual concentric rings
        //   6 EPIC WIN   — all of the above + screen-fill outer rays + flash
        const tierCol = TIER_COLORS[tier] || 0xff007f;
        const baseR = Math.min(W, H) * 0.42;
        winFxThrone.clear();
        winFxBurst.clear();
        winUnderlineG.clear();
        winRibbonG.clear();

        // ── GEM / COIN CASCADE — update + draw (winDisplay-local layer) ──────
        // Faceted gems (or cute stars) fountain up from the amount and arc back
        // down under gravity, tumbling. Drawn on winGemG (above the wash, below
        // the number) so it never buries the hero amount. Fades with the popup.
        winGemG.clear();
        for(let gi=winGems.length-1; gi>=0; gi--){
          const gm=winGems[gi];
          gm.t += 16;
          if(gm.t < 0) continue;   // per-gem stagger: hold off-screen until its delay elapses
          const glife = 1 - gm.t/gm.life;
          if(glife<=0){ winGems.splice(gi,1); continue; }
          gm.x += gm.vx; gm.y += gm.vy; gm.vy += gm.grav; gm.vx *= 0.992; gm.rot += gm.spin;
          const ga = Math.min(1, glife*2.4);
          const rr = gm.r;
          winGemG.circle(gm.x, gm.y, rr*1.7).fill({ color:gm.color, alpha:0.16*ga });
          if(gm.shape==='star'){
            const pts=[];
            for(let k=0;k<10;k++){ const rad=(k%2)?rr*0.45:rr; const aa=gm.rot + k*0.6283 - 1.5708; pts.push(gm.x+Math.cos(aa)*rad, gm.y+Math.sin(aa)*rad); }
            winGemG.poly(pts).fill({ color:gm.color, alpha:0.92*ga });
          } else {
            const cs=Math.cos(gm.rot), sn=Math.sin(gm.rot);
            const P=(dx,dy)=>[gm.x+dx*cs-dy*sn, gm.y+dx*sn+dy*cs];
            const tp=P(0,-rr), rp=P(rr*0.68,0), bp=P(0,rr), lp=P(-rr*0.68,0), md=P(0,0);
            winGemG.poly([lp[0],lp[1], bp[0],bp[1], rp[0],rp[1], md[0],md[1]]).fill({ color:gm.color, alpha:0.72*ga });
            winGemG.poly([lp[0],lp[1], tp[0],tp[1], rp[0],rp[1], md[0],md[1]]).fill({ color:_lightenHex(gm.color,0.5), alpha:0.96*ga });
          }
          winGemG.circle(gm.x - rr*0.16, gm.y - rr*0.30, rr*0.17).fill({ color:0xffffff, alpha:0.85*ga });
        }

        if(tier >= 2 && !isReduced()){
          // ─── (1) SOFT BACKDROP HALO — obsidian wash, BIG/MEGA/EPIC ONLY ─
          // (build W) Previously drawn for EVERY tier≥2, so a small "WIN" or
          // "NICE WIN" (a $1–$5 return) got a large dark elliptical panel
          // behind the amount — the player read that as a black background box
          // appearing after a win (the reported "after-win bg case"). Now
          // gated tier≥4: small wins keep the reels fully visible and get only
          // the magenta stage light (block 2). tier≤1 already returns before
          // any celebration (UKGC LDW), so this only ever affects 2–3.
          if(tier >= 4){
            const haloLayers = tier >= 5 ? 12 : 10;
            const haloAlpha  = tier >= 5 ? 0.22 : 0.18;
            for(let g = haloLayers; g >= 1; g--){
              winFxThrone.ellipse(0, 0,
                baseR * 1.55 * (g / haloLayers),
                baseR * 0.95 * (g / haloLayers))
                .fill({ color: 0x06060c, alpha: (1 - g/haloLayers) * haloAlpha + 0.04 });
            }
          }

          // ─── (2) MAGENTA TINT BEHIND TEXT — tier-color stage light ───
          const tintLayers = tier >= 4 ? 10 : 7;
          for(let g = tintLayers; g >= 1; g--){
            winFxThrone.ellipse(0, 0,
              baseR * (0.42 + g * 0.072),
              baseR * (0.28 + g * 0.052))
              .fill({ color: tierCol, alpha: 0.025 + (g / tintLayers) * 0.020 });
          }

          // ─── (2b) DETONATION SHOCKWAVE — one fast expanding ring at the
          // instant of impact (BIG/MEGA/EPIC). The visceral "hit" right after
          // the micro-silence inhale — a tier-color ring with a white leading
          // edge that blows outward and fades in ~460ms. Additive.
          if(tier >= 4){
            const swP = el / 460;
            if(swP < 1){
              const swR = baseR * (0.28 + swP * 1.55);
              const swA = (1 - swP) * (1 - swP) * 0.55;
              winFxBurst.ellipse(0, 0, swR, swR * 0.60)
                .stroke({ color: tierCol, width: (1 - swP) * 7 + 1.2, alpha: swA });
              winFxBurst.ellipse(0, 0, swR * 0.9, swR * 0.54)
                .stroke({ color: 0xffe6f4, width: (1 - swP) * 3.5, alpha: swA * 0.7 });   // crystal-white-pink inner ring (was cream-gold 0xfff2cc)
            }
          }

          // ─── (2c) AMOUNT BACKING GLOW — a focused tier-color bloom directly
          // behind the hero number that flares BRIGHTEST the instant the
          // count-up lands (winFx.popT0). Gives the number weight + a payoff
          // flash without ever washing out its legibility.
          {
            const landI = winFx.popT0 ? (1 - Math.min(1, (now - winFx.popT0) / 420)) : 0;
            const ay = baseR * 0.02;
            for(let g = 3; g >= 1; g--){
              winFxBurst.ellipse(0, ay, baseR * (0.30 + g * 0.16), baseR * (0.10 + g * 0.052))
                .fill({ color: tierCol, alpha: (0.05 + landI * 0.12) * (g / 3) });
            }
          }

          // ─── (3) RADIATING RAYS — DIRECTIONAL + PHASE-LAGGED (P5/P7) ──
          // Expert audit: "everything blooms simultaneously, all FX arrive
          // at once → static trophy presentation". Fix: rays now (a) burst
          // in a STAGGERED SWEEP (each ray lags by its index so the burst
          // rotates outward, not pops uniform), and (b) DIAGONAL rays
          // (45°/135°/225°/315°) extend longer + brighter — asymmetric
          // energy reads as explosive momentum, not a symmetric halo.
          if(tier >= 3){
            const numRays = tier >= 6 ? 24 : tier >= 5 ? 16 : tier >= 4 ? 12 : 8;
            const rayLenBase = baseR * (tier >= 5 ? 1.25 : tier >= 4 ? 1.05 : 0.90);
            const rayT = el * 0.0004;       // very slow drift
            for(let i = 0; i < numRays; i++){
              const a = rayT + (i / numRays) * Math.PI * 2;
              // Per-ray phase lag — burst sweeps around over ~420ms instead
              // of all rays popping at the same instant.
              const lag = (i / numRays) * 0.45;
              const rayP = Math.max(0, Math.min(1, (el - 80 - lag * 420) / 320));
              if(rayP <= 0) continue;
              // Directional emphasis — rays nearest the 4 diagonals get a
              // length + brightness boost (asymmetric, "explosive").
              const diagBias = Math.abs(Math.sin(a * 2));   // peaks at 45°,135°...
              const rayLen = rayLenBase * (0.82 + diagBias * 0.30);
              const inner = baseR * 0.45;
              const outer = rayLen * rayP;
              const cosA = Math.cos(a), sinA = Math.sin(a) * 0.62;
              for(let d = 1; d <= 4; d++){
                const t = d / 4;
                const rx = cosA * (inner + (outer - inner) * t);
                const ry = sinA * (inner + (outer - inner) * t);
                const fade = (1 - t) * (0.34 + diagBias * 0.16);
                const dotR = 4 * (1 - t * 0.55);
                winFxBurst.circle(rx, ry, dotR)
                  .fill({ color: tierCol, alpha: fade });
              }
            }
          }

          // ─── (3b) ELEGANT LIGHT AURA (NICE/BIG/MEGA/EPIC) ────────────────
          // RADICAL REPLACEMENT of the old electric "arcane bolts" (user: kill the
          // electric-flash lines in the win celebration). Soft volumetric GOD-RAY
          // shafts + a grounding light pool radiate from the hero amount — LIGHT,
          // not lightning. Additive on winFxBurst (cleared each frame), in-brand
          // tierCol, rotates slowly, flares on the landing. (2026-06-09)
          if(tier >= 3){
            const auraEnv = el < winFx.dur * 0.74
              ? Math.min(1, el / 240)
              : Math.max(0, 1 - (el - winFx.dur * 0.74) / (winFx.dur * 0.26));
            if(auraEnv > 0.02){
              const landI = winFx.popT0 ? Math.max(0, 1 - (now - winFx.popT0) / 420) : 0;
              const rays = tier >= 6 ? (_gpuWeak ? 10 : 16) : tier >= 5 ? 13 : tier >= 4 ? 11 : 9;
              _godRays(winFxBurst, 0, 0, baseR * (tier >= 5 ? 1.5 : 1.25), auraEnv, el * 0.00055, tierCol, rays, (tier >= 6 ? 1.3 : 1.0) + landI * 0.6);
              _groundGlow(winFxBurst, 0, baseR * 0.34, baseR * (0.9 + 0.5 * landI), tierCol, auraEnv, 1 + 0.06 * Math.sin(el * 0.004));
            }
          }

          // ─── (4) SPARKLE PIPS — 4-point stars OUTSIDE the text envelope ─
          // Scattered around the popup perimeter, NOT orbiting around the text.
          if(tier >= 3){
            const numSparks = tier >= 6 ? 18 : tier >= 5 ? 14 : tier >= 4 ? 10 : 6;
            const sparkR = baseR * 1.00;
            for(let i = 0; i < numSparks; i++){
              const a = (i / numSparks) * Math.PI * 2 + (i * 0.31);
              const phase = i * 0.7;
              const pulse = 0.6 + 0.4 * Math.sin(el * 0.005 + phase);
              // Place at varying radii so they don't form a perfect circle
              const rJ = sparkR * (0.85 + (i % 3) * 0.10);
              const sx = Math.cos(a) * rJ;
              const sy = Math.sin(a) * rJ * 0.55;
              const sr = 3 * pulse;
              // Tiny soft pink glow
              winFxBurst.circle(sx, sy, sr * 2.2)
                .fill({ color: tierCol, alpha: 0.18 * pulse });
              // Cross — 4-point sparkle
              const sl = sr * 1.5;
              winFxBurst.moveTo(sx - sl, sy).lineTo(sx + sl, sy)
                .stroke({ color: 0xf5f7fa, width: 1.0, alpha: 0.85 * pulse });
              winFxBurst.moveTo(sx, sy - sl).lineTo(sx, sy + sl)
                .stroke({ color: 0xf5f7fa, width: 1.0, alpha: 0.85 * pulse });
              winFxBurst.circle(sx, sy, sr * 0.40)
                .fill({ color: 0xf5f7fa, alpha: pulse });
            }
          }

          // ─── (5) TIER 5+ — DUAL CONCENTRIC RINGS (subtle pulse) ──────
          if(tier >= 5){
            const ringR = baseR * 0.82;
            const ringBreath = 1 + Math.sin(el * 0.003) * 0.015;
            winFxBurst.ellipse(0, 0, ringR * ringBreath, ringR * 0.55 * ringBreath)
              .stroke({ color: tierCol, width: 0.8, alpha: 0.30 });
            winFxBurst.ellipse(0, 0, ringR * 1.12 * ringBreath, ringR * 0.55 * 1.12 * ringBreath)
              .stroke({ color: tierCol, width: 0.6, alpha: 0.18 });
          }

          // ─── (6) TIER 6 EPIC — full-bleed screen rays + flash ────────
          if(tier >= 6){
            const numEpic = 28;
            const epicLen = baseR * 1.7;
            const epicT = el * 0.0006;
            for(let i = 0; i < numEpic; i++){
              const a = epicT + (i / numEpic) * Math.PI * 2;
              const cosA = Math.cos(a), sinA = Math.sin(a) * 0.62;
              const sx = cosA * baseR * 1.2, sy = sinA * baseR * 1.2;
              const ex = cosA * epicLen, ey = sinA * epicLen;
              winFxBurst.moveTo(sx, sy).lineTo(ex, ey)
                .stroke({ color: tierCol, width: 0.8, alpha: 0.18 });
            }
            // ─── EPIC SIGNATURE (2026-05-30) — full-screen white flash + RGB
            // chromatic bloom so tier-6 reads INSTANTLY bigger than MEGA.
            if(el < 400){
              const fl = Math.max(0, 1 - el/320);
              // CRUSH FIX (build V / master Part G §B.4): this full-screen EPIC
              // wash was drawn in winFxBurst = winDisplay-LOCAL space, so
              // winDisplay's grid-centre position + popup scale pushed it
              // OFF-CENTRE on wide/short viewports -> the "full-width slab in the
              // centre" bug. Compensate winDisplay's transform so the wash maps
              // to the real screen rect (0,0)-(W,H), perfectly centred everywhere.
              if(fl > 0){
                const _sx = winDisplay.scale.x || 1, _sy = winDisplay.scale.y || 1;
                winFxBurst.rect(-winDisplay.x/_sx, -winDisplay.y/_sy,
                                app.screen.width/_sx, app.screen.height/_sy)
                  .fill({ color:0xffffff, alpha:0.12*fl });   // shorter, dimmer = camera pop, not cheap glare
              }
              const cb = Math.max(0, 1 - el/400), off = 3 + 5*cb;
              // in-brand chromatic split: fuchsia one way, cyan the other, warm-white
              // core — reads as lens refraction, not off-brand RGB TV noise.
              winFxBurst.circle(-off,0,baseR*1.05).stroke({ color:0xff2ad0, width:2.5, alpha:0.24*cb });
              winFxBurst.circle(0,0,baseR*1.05).stroke({ color:0xffe6f4, width:2.0, alpha:0.16*cb });
              winFxBurst.circle(off,0,baseR*1.05).stroke({ color:0x7fe7ff, width:2.5, alpha:0.20*cb });
            }
          }
        }

        // ─── (7) RIBBON STAMP — tier label container (wide pill) ─────────
        // Positioned ABOVE the hero amount. Pill shape with hairline magenta
        // border. The label is the FIRST thing the player reads — "BIG WIN".
        // If winFx.customLabel is set (e.g. "FREE SPINS WIN" from the bonus
        // completion card), use that instead of the tier→label mapping.
        let tierLabelText = '';
        if(winFx.customLabel){
          tierLabelText = winFx.customLabel;
        } else if(tier === 1)       tierLabelText = ''; // suppressed at tier 1 (LDW guard)
        else if(tier === 2)  tierLabelText = socialFilter('WIN');
        else if(tier === 3)  tierLabelText = socialFilter('NICE WIN');
        else if(tier === 4)  tierLabelText = socialFilter('BIG WIN');
        else if(tier === 5)  tierLabelText = socialFilter('MEGA WIN');
        else                  tierLabelText = socialFilter('EPIC WIN');
        if(tierLabelText){
          // Set ribbon text + sizing first so we can size the pill to fit.
          // Clear the stroke that celebrate() applies — the ribbon pill
          // provides contrast, the label itself should be flat smoke-white.
          const labelSize = tier >= 5 ? 22 : tier >= 4 ? 18 : tier >= 3 ? 16 : 14;
          const labelTrack = tier >= 5 ? 9 : tier >= 4 ? 7 : 5.5;
          bigWinLabel.style.fontSize = labelSize;
          bigWinLabel.style.letterSpacing = labelTrack;
          bigWinLabel.style.fill = 0xf5f7fa;
          bigWinLabel.style.stroke = null;
          bigWinLabel.text = tierLabelText;
          // Pill size based on text width + uniform side padding
          const padX = 26, padY = 9;
          const rW = bigWinLabel.width + padX * 2;
          const rH = labelSize + padY * 2;
          const rR = rH * 0.5;
          const ribbonY = -baseR * 0.36;
          // Soft halo behind ribbon (faked glow)
          winRibbonG.roundRect(-rW/2 - 6, ribbonY - rH/2 - 6, rW + 12, rH + 12, rR + 6)
            .fill({ color: tierCol, alpha: 0.10 });
          // Ribbon obsidian pill
          winRibbonG.roundRect(-rW/2, ribbonY - rH/2, rW, rH, rR)
            .fill({ color: 0x0a0a14, alpha: 0.95 });
          // Magenta hairline border
          winRibbonG.roundRect(-rW/2, ribbonY - rH/2, rW, rH, rR)
            .stroke({ color: tierCol, width: 1.3, alpha: 0.95 });
          // Top highlight stripe
          winRibbonG.roundRect(-rW/2 + rR*0.5, ribbonY - rH/2 + 1, rW - rR, 0.8, 0.4)
            .fill({ color: 0xf5f7fa, alpha: 0.40 });
          // Tier diamond decorations on left + right (small magenta pips)
          for(let side = -1; side <= 1; side += 2){
            const dx = side * (rW/2 + 12);
            winRibbonG.circle(dx, ribbonY, 3).fill({ color: tierCol, alpha: 0.95 });
            winRibbonG.circle(dx - side * 8, ribbonY, 2).fill({ color: tierCol, alpha: 0.55 });
          }
          // ─── SHEEN SWEEP — a single chrome glint travels left→right across
          // the pill once on entry (premium "polished metal" read). Slanted
          // band, clamped within the pill so it never spills past the rounded
          // ends. Drawn ON the pill, UNDER the label text (separate node).
          {
            const sheenP = el / 640;
            if(sheenP < 1){
              const sweepX = -rW/2 + sheenP * rW;
              const sa = Math.sin(sheenP * Math.PI) * 0.55;
              const bw = rW * 0.13;
              const xa = Math.max(-rW/2 + 3, sweepX - bw/2);
              const xb = Math.min(rW/2 - 3, sweepX + bw/2);
              if(xb > xa){
                winRibbonG.poly([
                  xa + 5, ribbonY - rH/2 + 2,  xb + 5, ribbonY - rH/2 + 2,
                  xb - 5, ribbonY + rH/2 - 2,  xa - 5, ribbonY + rH/2 - 2
                ]).fill({ color: 0xffffff, alpha: sa * 0.5 });
              }
            }
          }
          bigWinLabel.position.set(0, ribbonY);
          bigWinLabel.visible = true;
        } else {
          bigWinLabel.visible = false;
        }

        // ─── (8) HERO AMOUNT — center, tier-scaled, the focal point ─────
        const amountSize = tier >= 6 ? 92 : tier >= 5 ? 76 : tier >= 4 ? 62 : tier >= 3 ? 50 : 42;
        bigWinAmount.style.fontSize = amountSize;
        bigWinAmount.position.set(0, baseR * 0.02);

        // ─── (9) UNDERLINE ACCENT — thin magenta rule below amount ──────
        // Anchors the amount as a "stamped" value (like the bottom of a banner).
        const undW = Math.min(bigWinAmount.width * 0.85, baseR * 1.2);
        const undY = bigWinAmount.position.y + amountSize * 0.55;
        winUnderlineG.roundRect(-undW/2, undY, undW, 1.6, 0.8)
          .fill({ color: tierCol, alpha: 0.85 });
        winUnderlineG.roundRect(-undW/2 - 4, undY - 2, undW + 8, 5, 2.5)
          .fill({ color: tierCol, alpha: 0.18 });

        // ─── (10) MULT SUBTEXT — STAGED reveal (P7) ─────────────────────
        // Expert audit: "stagger label → amount → micro silence →
        // multiplier pulse, NOT all simultaneously". The ribbon + amount
        // are already up; the multiplier line now fades in only AFTER the
        // count-up has finished (winFx.popT0 set), with a small pop. This
        // sequences the reward information instead of dumping it at once.
        if(tier >= 2){
          const targetX6 = winFx.countX6Target || 0;
          const baseBetX6 = State.betX6 || 1;
          const multX = targetX6 / baseBetX6;
          let multText;
          if(multX >= 100) multText = '×' + multX.toFixed(0) + '  ' + socialFilter('YOUR BET');
          else if(multX >= 10) multText = '×' + multX.toFixed(1) + '  ' + socialFilter('YOUR BET');
          else multText = '×' + multX.toFixed(2) + '  ' + socialFilter('YOUR BET');
          bigWinMult.text = multText;
          bigWinMult.style.fontSize = tier >= 5 ? 15 : tier >= 4 ? 14 : 12;
          bigWinMult.position.set(0, undY + 22);
          bigWinMult.visible = true;
          // Staged fade-in: 0 until count-up done, then ease-out over 260ms
          // with a tiny upward drift + scale pop. Reduced-motion shows instantly.
          if(isReduced()){
            bigWinMult.alpha = 0.65;
          } else if(winFx.popT0){
            const mp = Math.min(1, (now - winFx.popT0) / 260);
            const me = 1 - Math.pow(1 - mp, 3);
            bigWinMult.alpha = 0.65 * me;
            bigWinMult.scale.set(0.85 + 0.15 * me);
            bigWinMult.position.set(0, undY + 22 + (1 - me) * 6);
          } else {
            bigWinMult.alpha = 0;   // held back until amount finishes counting
          }
        } else {
          bigWinMult.visible = false;
        }
      }
    }

    // Bonus Ignition shockwave (FS-trigger) — drawn above the reels, below particles.
    drawBonusIgnite(performance.now());
    // Free Spins Portal — cinematic centre VFX during the FS transition.
    drawFsPortal(performance.now());
    // particles — burst sparks on particleG (above); magical dust on winGlowAddG
    // (below the reels) so the winning symbol always sits on top of its own dust
    particleG.clear();
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.t+=16;
      const life=1-p.t/p.life;
      if(life<=0){ particles.splice(i,1); continue; }
      if(p.kind==='fire'){
        p.x+=p.vx; p.y+=p.vy; p.vy*=0.99; p.vx*=0.98;        // slow buoyant drift
        const fl=0.82+vrnd()*0.18;
        winGlowAddG.circle(p.x,p.y, p.r*(0.5+life*0.6)*fl)
          .fill({ color:p.color, alpha:Math.sin(life*Math.PI)*0.55*fl });
      } else {
        // ── AAA 4-LAYER PARTICLE — professional layered glow
        // (1) outer chromatic-bleed halo — soft pink/white ambient bloom
        // (2) mid color glow — saturated brand color
        // (3) bright inner ring — high-energy hot zone
        // (4) smoke-white core — sub-pixel anchor for the eye
        // Physics: light air-resistance drag, mild gravity, subtle rotation.
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.085;          // mild gravity
        p.vx *= 0.985;           // gentle air drag
        p.vy *= 0.985;
        if(p.spin) p.rot = (p.rot || 0) + p.spin;
        // Lifecycle-eased radius: grow fast in first 25%, then taper
        const rPhase = p.t / p.life;
        const rEnv  = rPhase < 0.25
          ? rPhase * 4
          : (1 - (rPhase - 0.25) / 0.75) * 0.85 + 0.15;
        const rNow = p.r * rEnv;
        const a    = Math.pow(life, 0.7);   // slower alpha falloff
        // (1) OUTER HALO — wider, very soft — adds depth
        particleG.circle(p.x, p.y, rNow * 2.8)
          .fill({ color: p.color, alpha: a * 0.14 });
        // (2) MID GLOW — saturated brand color
        particleG.circle(p.x, p.y, rNow * 1.7)
          .fill({ color: p.color, alpha: a * 0.42 });
        // (3) INNER RING — high-energy ring (slightly offset radius)
        particleG.circle(p.x, p.y, rNow * 1.05)
          .fill({ color: p.color, alpha: a * 0.72 });
        // (4) SMOKE-WHITE HOT CORE — bright pixel anchor
        particleG.circle(p.x, p.y, rNow * 0.55)
          .fill({ color: 0xffffff, alpha: a * 0.95 });
      }
    }

    // ── STAGE TRANSFORM — shake + camera push combined (2026-05-27 fix)
    // Previously: shake set stage.position, then push-in immediately
    // overwrote stage.position one frame later → shake silently lost.
    // Now: compute shake OFFSET + push-in POSITION separately, apply once.
    let _shX = 0, _shY = 0;
    if(shakeAmount>0){
      const el=(now-shakeT0)/400;
      if(el>=1){ shakeAmount=0; }
      else {
        const decay=1-el;
        _shX = (vrnd()-0.5)*shakeAmount*decay;
        _shY = (vrnd()-0.5)*shakeAmount*decay;
      }
    }
    // ── CAMERA PUSH-IN — 1.0 → 1.04 → 1.0 over _camPushDur (1500ms)
    // Triggered by `_camPushT0` setter (bonus trigger, mega win, etc).
    if(_camPushT0){
      const el = now - _camPushT0;
      if(el >= _camPushDur){
        _camPushT0 = 0;
        stage.scale.set(1);
        stage.pivot.set(0, 0);
        stage.position.set(_shX, _shY);
      } else {
        const p = el / _camPushDur;
        const pushK = 1 + Math.sin(p * Math.PI) * 0.04;
        stage.pivot.set(app.screen.width / 2, app.screen.height / 2);
        stage.scale.set(pushK);
        // Center position + shake offset combined
        stage.position.set(app.screen.width / 2 + _shX, app.screen.height / 2 + _shY);
      }
    } else if(stage.pivot.x !== 0 || stage.scale.x !== 1){
      // Reset pivot once push completes
      stage.pivot.set(0, 0);
      stage.scale.set(1);
      stage.position.set(_shX, _shY);
    } else {
      // No push active — apply shake offset only
      stage.position.set(_shX, _shY);
    }

    // BET STEPPERS — press lerp (Emil web-animations spec). 0.96 on press
    // (Emil rule: "never below 0.95 — that's cartoon territory"; 0.92 read
    // as a too-bouncy game-feel rather than a confident HUD press). Faster
    // decay-in than decay-out so the press lands fast and recovers smoothly.
    [minusBtn, plusBtn].forEach(b => {
      if(!b || b._baseScale == null) return;
      const target = b._pressed ? b._baseScale * 0.96 : b._baseScale;
      const decay = b._pressed ? 0.42 : 0.24;
      b._displayScale += (target - b._displayScale) * decay;
      b.scale.set(b._displayScale);
    });

    // ── SPIN BUTTON MOTION — Emil/web-animations expert pass ─────
    // Interruptible press / release / idle breathe + COMMIT PULSE.
    // Emil principles applied:
    //   • Press to 0.97 (his exact value — never below 0.95).
    //   • Release decay tightened 0.22 → 0.30 (~140ms back to base —
    //     in the 100-150ms hover-OFF band; press feels responsive).
    //   • Breathing PAUSES during SPIN/SETTLE/REVEAL/CELEBRATE so the
    //     player's eye is on the reels, not the button. Resumes only
    //     when phase returns to IDLE and round is fully settled.
    //   • COMMIT PULSE — when the user commits (just after press release),
    //     we briefly pulse 0.96 → base over 180ms with one tiny outBack
    //     overshoot so there's NEVER a perceived-silence gap between
    //     pointer release and reels starting (covers RGS latency).
    //   • Reduced-motion: no breathing, no commit pulse, just direct.
    if(spinBtn._baseScale){
      const reduced = isReduced();
      let target;
      if(spinBtn._pressed && !STAKE.replay){
        target = spinBtn._baseScale * 0.97;      // Emil's press scale
      } else if(spinBtn._commitT0 && !STAKE.replay){
        // commit pulse window — 180ms ease-out from 0.96 back to base
        const pp = Math.min(1, (now - spinBtn._commitT0) / 180);
        if(pp >= 1){ spinBtn._commitT0 = 0; }
        // ease-out cubic with a hair of outBack at the tail (one cute lift)
        const k = pp < 0.7 ? 0.96 + 0.04 * (1 - Math.pow(1 - pp/0.7, 3))
                           : 1.00 + 0.012 * Math.sin((pp-0.7)/0.3 * Math.PI);
        target = spinBtn._baseScale * k;
      } else if(State.phase===Phase.IDLE && !spinBtnBroke && !STAKE.replay){
        const breathe = reduced ? 1 : 1 + Math.sin(now*0.005)*0.02;
        target = spinBtn._baseScale * breathe;
      } else {
        // ACTIVE PHASE — hold steady at base, NO breathe (focus on reels).
        target = spinBtn._baseScale;
      }
      if(spinBtn._displayScale == null) spinBtn._displayScale = spinBtn._baseScale;
      // Press: faster decay (0.36 ≈ 130ms in). Release: tightened to 0.30 (~140ms out).
      // Commit pulse: drive directly (target IS the pulse curve, no extra lerp lag).
      const decay = spinBtn._pressed ? 0.36 : (spinBtn._commitT0 ? 0.55 : 0.30);
      spinBtn._displayScale += (target - spinBtn._displayScale) * decay;
      spinBtn.scale.set(spinBtn._displayScale);
    }
    // buy bar pulse — non-inline (legacy ribbon) uses scale-pulse.
    if(buyBar.visible && State.phase===Phase.IDLE && buyBar._baseScale && !buyBar._inlineW){
      buyBar._pulse+=0.003*dt;
      buyBar.scale.set(buyBar._baseScale*(1+Math.sin(buyBar._pulse*6.28)*0.018));
    } else if(buyBar.visible && buyBar._inlineW){
      // INLINE PILL — keep transform steady, drive an Emil-safe opacity
      // pulse on the title/cost text so the player's eye is drawn to the
      // commercial CTA. Skipped under prefers-reduced-motion.
      buyBar.scale.set(1);
      if(!isReduced() && State.phase===Phase.IDLE){
        const p = (Math.sin(now * 0.0035) + 1) * 0.5;     // 4Hz breathing
        const affordable = State.balanceX6 >= buyCostX6();
        if(affordable){
          buyTitle.alpha = 0.85 + 0.15 * p;
          buyCost.alpha  = 0.92 + 0.08 * p;
        } else {
          buyTitle.alpha = 0.55; buyCost.alpha = 0.6;
        }
      } else if(isReduced()){
        buyTitle.alpha = 1; buyCost.alpha = 1;
      }
    }
  });

  // ── REPLAY MODE ───────────────────────────────────────────────
  function layoutReplayBar(){
    const W=app.screen.width, H=app.screen.height;
    // RESP-24/25 — tiny-aware sizing. btnH was 30 (below WCAG 44px) and the bar
    // was hardcoded H-86 ignoring small-preset HUD overlap. Now: btnH min 44 on
    // every preset (or close to it on Popout S where vertical is tight); bar Y
    // computed from total content height + small bottom margin.
    const tinyRP = H < 330;
    const barW = Math.min(540, W*0.94);
    const _btnH = tinyRP ? 36 : 40;  // try to honor 44 but tiny landscape needs room — hitArea floor compensates
    const _barH = tinyRP ? 58 : 74;
    const _barY = H - _barH - (tinyRP ? 4 : 12);
    rbBg.clear().roundRect(W/2-barW/2, _barY, barW, _barH, 12)
      .fill({ color:0x1f1c2e, alpha:0.95 }).stroke({ color:0xff5a9c, width:2 });
    rbText.position.set(W/2, _barY + (tinyRP ? 10 : 14));
    rbDisclosure.position.set(W/2, _barY + (tinyRP ? 26 : 34));
    const btnW=120;
    rbAgain._bg.clear().roundRect(-btnW/2,-_btnH/2,btnW,_btnH,9).fill(0xff5a9c);
    rbAgain.position.set(W/2, _barY + _barH - _btnH/2 - 4);
    // RESP-24 — explicit hitArea floor so on-screen tap target stays >=44px even
    // when the visual button is smaller on Popout S.
    rbAgain.hitArea = new PIXI.Rectangle(-Math.max(60, btnW/2), -22, Math.max(120, btnW), 44);
  }
  // Cost multiplier for a round's mode: per-tier for bought bonuses (HOT/MEGA
  // cost far more than STANDARD), 1 for base. Handles the specific
  // bonus_standard|hot|mega ids the RGS returns (and the generic 'bonus' alias),
  // so a mid-round resume or replay of a bought HOT/MEGA round derives the right
  // stake and shows the right disclosure instead of the flat standard cost (P1-I tail).
  function costMultForMode(mode){
    if(typeof mode !== 'string') return 1;
    const t = BONUS_TIERS.find(b => b.id === mode);
    if(t) return t.mult;
    return /bonus|buy/i.test(mode) ? BUY_COST_MULT : 1;
  }
  function buildReplayDisclosure(round,betX6){
    rbDisclosure.removeChildren();
    const costMult = costMultForMode(round.mode);
    const cost = Math.round(betX6*costMult);
    // Payout multiplier is relative to the base bet (not the total cost).
    const winX6 = Math.round(betX6*round.payX100/100);
    const items=[
      [socialFilter('Base Bet'), fmtMoney(betX6)],
      [socialFilter('Cost Multiplier'), costMult+'×'],
      [socialFilter('Total Bet Cost'), fmtMoney(cost)],
      [socialFilter('Payout Multiplier'), (round.payX100/100).toFixed(2)+'×'],
      [socialFilter('Total Win'), fmtMoney(winX6)],
    ];
    const W=Math.min(540,app.screen.width*0.94);
    const colW=W/items.length;
    items.forEach(([lbl,val],i) => {
      const x=-W/2+colW*(i+0.5);
      const l=new PIXI.Text({ text:lbl, style:{ fontFamily:'Fredoka', fontSize:8, fill:0xc9b0e6, fontWeight:'bold' }});
      l.anchor.set(0.5,0); l.position.set(x,0); rbDisclosure.addChild(l);
      const v=new PIXI.Text({ text:val, style:{ fontFamily:'Luckiest Guy', fontSize:11, fill:0xf5f7fa }});   // smoke-white disclosure value (was gold 0xffe066)
      v.anchor.set(0.5,0); v.position.set(x,10); rbDisclosure.addChild(v);
    });
  }
  // P1-I — a mid-round resume must replay at the round's ACTUAL stake, not the
  // default bet. round.amount is the COST debited (for a bought bonus that is
  // betX6 × BUY_COST_MULT — Wheel-of-Chance Wave-2 lesson), so back the cost
  // multiplier out for bonus modes and snap to the nearest configured level.
  function deriveResumeBet(rnd){
    const amt = Number(rnd && rnd.amount);
    if(!amt || !isFinite(amt) || amt <= 0) return State.betX6;
    const base = amt / costMultForMode(rnd.mode);
    let best = State.betLevels[0], bestD = Infinity;
    for(const lv of State.betLevels){ const d = Math.abs(lv - base); if(d < bestD){ bestD = d; best = lv; } }
    return best;
  }
  async function playReplayRound(round,betX6){
    State.phase=Phase.SPIN;
    winDisplay.alpha=0; winFx.on=false; winCells=[]; winLines=[]; lineG.clear();
    winPlaque.alpha=0;
    // LAST WIN pattern — keep the most recent win amount visible in muted
    // colour. flashWinValue() brightens to tier colour on a new winning
    // round. (Replay rounds also count toward lastWinX6.)
    winValue.text = fmtMoney(State.lastWinX6);
    winValue.style.fill = THEME.colors.textMuted;
    winLabel.text = socialFilter(State.lastWinX6 > 0 ? 'LAST WIN' : 'WIN');
    winLabel.style.fill = THEME.colors.accent;
    winLabel.alpha = 1; winValue.alpha = 1;
    await reelsSpinPromise(round.grid,false);
    State.phase=Phase.REVEAL;
    if(round.mode!=='bonus'){
      const ev=evalGrid(round.grid);
      if(ev.lineWins.length) showLineWins(round.grid,ev.lineWins);
      if(ev.scatCount>=3) showScatterCells(round.grid);
      const baseMx=Math.round((ev.lineX+ev.scatX)*100);
      if(baseMx>0){
        revealActive=true; revealT0=performance.now(); revealDur=1400; winVfxTier=winTier(baseMx);
        flashWinValue(Math.round(betX6*baseMx/100), baseMx);   // tier-coloured
        if(winTier(baseMx)>=4 || ev.scatCount>=3) celebrate(baseMx,Math.round(betX6*baseMx/100));
        await delay(revealDur); revealActive=false;
      }
    }
    if(round.fs){
      await showFeatureBanner('FREE SPINS',900);
      await runFreeSpinScene(betX6, round.fs);
    }
    State.phase=Phase.IDLE;
  }
  async function runReplay(){
    // ── REPLAY MODE — COMPLETE CONTROL LOCK (Bet_Replay.md compliance) ──
    // 2026-05-27 audit fix: previously only spin/autoplay/turbo/steppers
    // were locked. Per Bet_Replay.md ALL controls must be disabled in
    // replay mode (no sound toggle, no info/settings drawer, no bet
    // menu, no swipe-to-spin). Sharp Stake reviewers grep for any
    // interactive element that responds to clicks during replay.
    spinBtn.eventMode='none'; spinBtn.alpha=0.4; spinBtn.tint=0x888888;
    buyBar.visible=false; State.muted=true; State.autoplay.active=false;
    [minusBtn,plusBtn].forEach(b => { b.eventMode='none'; b.alpha=0.4; });
    [btnAutoplay,btnTurbo].forEach(b => { b.eventMode='none'; b.alpha=0.4; });
    // ── Newly-locked controls ──
    [btnSound, btnInfo, btnSettings].forEach(b => {
      if(b){ b.eventMode='none'; b.alpha=0.55; }
    });
    // BET tap zone (opens bet menu) — disable cursor + event mode
    if(betValue){ betValue.eventMode='none'; betValue.cursor='default'; }
    if(betLabel){ betLabel.eventMode='none'; betLabel.cursor='default'; }
    // Swipe-to-spin zone — already guarded with `if(STAKE.replay) return`
    // inside the handler, but belt-and-suspenders: disable eventMode.
    if(typeof swipeZone !== 'undefined' && swipeZone){
      swipeZone.eventMode='none'; swipeZone.cursor='default';
    }

    let data;
    try { data=await RGS.fetchReplay(); }
    catch(e){
      showError('REPLAY UNAVAILABLE', 'Could not load this round for replay.');
      return;
    }
    const round=data.round;
    const betX6=State.betX6;
    replayBar.visible=true;
    rbText.text='This is a replay of a completed round. Results were determined when the round was played.';
    buildReplayDisclosure(round,betX6);
    layoutReplayBar();
    rbAgain.on('pointertap', () => { if(State.phase===Phase.IDLE) playReplayRound(round,betX6); });
    await delay(400);
    await playReplayRound(round,betX6);
  }

  // ── DEBUG EXPORT (only with ?debug=true) ──────────────────────
  if(STAKE.debug){
    window.__dbg = {
      State, reels, RGS, Phase, COMPLY, STAKE, SYM_TEX,
      startSpin, evalGrid, buildRound, runFreeSpins, layout, mulberry32,
      celebrate, showFeatureBanner, winFx, showInfoModal, populateInfoTab,
      hideInfoModal, openDrawer, closeDrawer, showBuyBonusModal, hideBuyBonusModal,
      showRealityCheck, showError, flashWinValue, showBetMenu, hideBetMenu, betMenu, betValue,
      bmtSnapTo, bmtCentered, bmtNearestAfford,
      infoModal, drawerLayer, buyModal, rcModal, errModal,
      infoCard, drawerPanel, buyModalCard, rcCard, errCard,
      winPlaque, winLabel, winValue, balPlaque, betPlaque, minusBtn, plusBtn, spinBtn,
      showLinesPreview, linesPreviewG,
      spawnBonusIgnition, get bonusIgniteG(){ return bonusIgniteG; }, get _ignites(){ return _ignites; },
      spawnFsPortal, get _fsPortal(){ return _fsPortal; }, playMegaLogoCeremony,
      playStandardFsCeremony, playHotFsCeremony, Sound,
      grid(){ return reels.map(r => [r.symbols[1],r.symbols[2],r.symbols[3]]); },
      get spinning(){ return allReelsSpinning; },
      get CELL(){ return CELL; },
      get revealActive(){ return revealActive; }, set revealActive(v){ revealActive=v; },
      get winCells(){ return winCells; },
      get winVfxTier(){ return winVfxTier; }, set winVfxTier(v){ winVfxTier=v; },
      spawnCascade, get winGems(){ return winGems; },
      showLineWins, get LINES(){ return LINES; }, set revealT0(v){ revealT0=v; },
    };
  }

  // ── BOOT ──────────────────────────────────────────────────────
  const rmQuery=matchMedia('(prefers-reduced-motion: reduce)');
  State.reducedSystem=rmQuery.matches;
  rmQuery.addEventListener?.('change',e => { State.reducedSystem=e.matches; });

  window.addEventListener('resize',() => layout());
  window.addEventListener('orientationchange',() => setTimeout(layout,150));

  // ── TAB VISIBILITY RECOVERY ────────────────────────────────────
  // When the player tabs away for a long time, browsers throttle rAF to
  // ~1Hz and setTimeout to 1s+ (some throttle to once per minute after
  // a long hide). On return we have to clean up:
  //   - resume audio context (was suspended on hide)
  //   - reset render-delta accumulator so the next frame doesn't jump
  //   - if a win celebration was running for "fake forever", clamp it
  //   - force a layout in case the viewport changed
  //   - release any stuck press states
  //   - bump any in-flight modal animation tokens to skip stale timers
  let _lastHiddenAt = 0;
  document.addEventListener('visibilitychange',() => {
    try {
      if(document.hidden){
        _lastHiddenAt = performance.now();
        Sound.ctx && Sound.ctx.suspend();
      } else {
        const hiddenForMs = _lastHiddenAt
          ? performance.now() - _lastHiddenAt
          : 0;
        if(!State.muted) Sound.ctx && Sound.ctx.resume();

        // Reset the renderReels frame-delta accumulator so the next frame
        // gets dtK = 1 (not a huge jump that would teleport idle anim).
        _renderPrev = 0;

        // Release any stuck press states from before the hide.
        spinBtn._pressed = false;

        if(hiddenForMs > 1500){
          // Force a layout — viewport may have changed during the hide,
          // and stale chip colours need to refresh.
          try { layout(); } catch(e){}

          // Clamp any "running forever" celebration. winFx.dur is the
          // intended duration; if elapsed > 2× that, force-clear so
          // finishRound's `while(winFx.on)` guard doesn't hang on return.
          if(winFx.on && winFx.t0 && (performance.now() - winFx.t0 > winFx.dur * 2)){
            winFx.on = false;
            winDisplay.alpha = 0;
            winDisplay.scale.set(1);
            // 2026-05-27 audit fix — clear bigWinAmount.text on recovery
            // so the stale "$1,234.50" doesn't flash for one frame before
            // the next celebrate() runs.
            if(typeof bigWinAmount !== 'undefined') bigWinAmount.text = '';
          }

          // If an intro overlay fade was mid-flight, restart it cleanly.
          if(introOverlay.visible && introOverlay._fadeIn){
            introOverlay._fadeIn = performance.now();
          }
        }
      }
    } catch(e){
      // Defensive — visibility recovery should never throw.
      if(STAKE.debug) console.log('visibility recovery error', e);
    }
  });

  // AUTH FLOW (skipped entirely in replay mode — per Bet_Replay.md)
  let _activeRound = null;
  if(!STAKE.replay){
    try {
      // No trailing ellipsis — the ::after dots animate three pulsing pips
      lprog.textContent='AUTHENTICATING';
      const auth=await RGS.authenticate();
      if(auth.balance!=null)
        State.balanceX6 = typeof auth.balance==='object' ? auth.balance.amount : auth.balance;
      if(auth.config && auth.config.betLevels && auth.config.betLevels.length){
        State.betLevels=auth.config.betLevels;
        State.betIdx=Math.min(State.betIdx,State.betLevels.length-1);
        State.betX6=State.betLevels[State.betIdx];
      }
      // mid-round refresh recovery — defer the visual replay until AFTER
      // layout() runs (reels need to be positioned first); just stash the
      // active round here.
      if(auth.round && auth.round.active) _activeRound = auth.round;
    } catch(e){ log('Auth failed',e); }
  }

  // social filter on static labels
  if(STAKE.social){
    buyTitle.text=socialFilter('BUY BONUS');
    balLabel.text=socialFilter('BALANCE');
    betLabel.text=socialFilter('BET');
    winLabel.text=socialFilter('WIN');
    bigWinLabel.text=socialFilter('WIN');
    bmTitle.text=socialFilter('BUY BONUS');
    bmRowCost._lbl.text=socialFilter('Cost');
    bmRowMax._lbl.text=socialFilter('Max Win');
    bmWarn.text=socialFilter(bmWarn.text);
    bmDesc.text=socialFilter(bmDesc.text);
  }

  layout();
  updateHUD();
  loader.classList.add('gone');
  setTimeout(() => loader.remove(),500);

  // ── INTRO SPLASH — show Waylanders-style "PRESS TO CONTINUE!" first.
  // Replay mode goes straight to playback (no splash gate — reviewers expect
  // immediate replay). Active mid-round also bypasses the splash so the
  // player sees the in-flight round resume instantly.
  const _runResume = async () => {
    if(STAKE.replay) return runReplay();
    if(_activeRound){
      try {
        const evs = _activeRound.events || [];
        if(evs.length){
          const parsed = parseRound(evs, _activeRound.payoutMultiplier || 0);
          const resumeBet = deriveResumeBet(_activeRound);   // P1-I: replay at the round's real stake
          State.betX6 = resumeBet;
          const _li = State.betLevels.indexOf(resumeBet); if(_li >= 0) State.betIdx = _li;
          await playReplayRound(parsed, resumeBet);
        }
      } catch(e){ log('resume round error', e); }
      // 2026-05-27 audit fix — wait for the win celebration to finish on
      // a mid-round resume too (same Picker v15 rejection pattern as
      // finishRound). If the resumed round ended with a big-win
      // celebration mid-flight, endRound would otherwise fire while the
      // animation plays.
      let _resumeGuard = 0;
      while(winFx.on && _resumeGuard++ < 50) await delay(60);
      if(winFx.on){ winFx.on = false; winDisplay.alpha = 0; }
      // Wave-2 #9: ALWAYS read endData.balance.amount — the optimistic
      // credit can drift from server truth (rounding, caps, jurisdiction).
      try {
        const endData = await RGS.endRound();
        if(endData && endData.balance != null)
          State.balanceX6 = typeof endData.balance==='object' ? endData.balance.amount : endData.balance;
      } catch(e){}
      updateHUD();
    }
  };
  if(STAKE.replay || _activeRound){
    _runResume();
  } else {
    // ── BOOT SEQUENCE — 2-stage cinematic opener ──
    //   1. HTML loader = EXTRA STUDIO frame (publisher ident — already showing
    //      from page-load via <div id="loader">, fades on loader.classList.gone)
    //   2. Pixi SHINING POP loader (~1.6s — game brand + premium progress bar)
    //   3. Intro overlay (cards + "PRESS TO CONTINUE")
    // No duplicate EXTRA STUDIO frame — the HTML loader IS that frame, so we
    // skip showExtraStudioSplash() and go straight to the game-brand loader.
    // Per user brief: "hide first loadign with the studio logo extra for
    // dark aesthetic clean only logo highlight after that game loader game
    // logo bg and loading bar > expert level gradient and whitesmoke text
    // colors top typography. for intuitive we only need add our studio
    // component after that continue loading the game 1s or what."
    window.__bootT = { reload: performance.now() };
    // P4 (expert audit) — RETENTION: shorten the boot for repeat sessions.
    // First session: full 1.4s loader + tap-to-continue intro (cinematic).
    // Repeat session (localStorage flag): 650ms loader + intro auto-dismisses
    // after 1.1s so returning players are in the game ~2.5s sooner.
    let _bootSeen = false;
    try { _bootSeen = localStorage.getItem('spBootSeen') === '1'; } catch(_){}
    const _loaderDur = _bootSeen ? 650 : 1400;
    // ?intro=1 forces the intro to STAY (no auto-skip) so the cinematic can be
    // reviewed/QA'd on a returning session. Normal players: returning => 1.1s auto-skip.
    let _forceIntro = false; try { _forceIntro = new URL(location.href).searchParams.get('intro') === '1'; } catch(_){}
    const _introAuto = _forceIntro ? 0 : (_bootSeen ? 1100 : 0);
    try { localStorage.setItem('spBootSeen', '1'); } catch(_){}
    // GAME-LOGO POP-LOADER REMOVED (user: "studio EXTRA img loading only with
    // progress, remove the game-logo loader"). Skip straight to the intro; the
    // HTML #loader (studio frame + progress bar) is the only loading screen.
    void _loaderDur;
    window.__bootT.loaderDone = performance.now() - window.__bootT.reload;
    showIntroOverlay(() => { /* boot complete — game is ready */ }, _introAuto);
  }

})().catch((e) => {
  const lp=document.getElementById('lprog');
  if(lp){ lp.textContent='ERR: '+(e&&e.message?e.message:e); lp.style.color='#ff8a8a'; }
  if(new URL(location.href).searchParams.get('debug')==='true') console.error('PIXI INIT ERROR:',e);
});

// ── ESM module marker (appended by scripts/port-from-singlefile.mjs) ─────────
// Makes this ported IIFE a real ES module so `await import()` in src/main.ts type-checks.
export {};
