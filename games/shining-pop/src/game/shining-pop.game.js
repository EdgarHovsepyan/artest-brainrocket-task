'use strict';
(async () => {
  const loader = document.getElementById('loader');
  const lprog  = document.getElementById('lprog');
  const lfill  = document.getElementById('lfill');
  const fail = (m) => { lprog.textContent = m; lprog.style.color = '#ff8a8a'; };
  if(!window.PIXI){ fail('Could not load PixiJS'); return; }

  
  const url = new URL(location.href);
  const API_AMOUNT_MULTIPLIER = 1_000_000;
  const _rawRgs = url.searchParams.get('rgs_url');
  const _normRgs = !_rawRgs
    ? 'mock://demo.cdn.stake-engine.com'
    : (/^(https?|mock):\/\//.test(_rawRgs) ? _rawRgs : 'https://' + _rawRgs);
  
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
    
    rGame: url.searchParams.get('game') || 'shining-crown',
    rVersion: url.searchParams.get('version') || '1',
    rMode: url.searchParams.get('mode') || 'base',
    rEvent: url.searchParams.get('event') || url.searchParams.get('bet') || '',
  };
  const log = (...a) => { if(STAKE.debug) console.log(...a); };

  
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

  const CUR = CURRENCIES[STAKE.currency] || { s:(STAKE.currency ? STAKE.currency+' ' : '$'), d:2, l:'en-US' };
  function fmtMoney(x6){

    
    const _n = Number(x6);
    const v = (Number.isFinite(_n) ? _n : 0) / API_AMOUNT_MULTIPLIER;

    const prefix = STAKE.social ? (CUR.social ? CUR.s : '') : CUR.s;
    return prefix + v.toLocaleString(CUR.l, {minimumFractionDigits:CUR.d, maximumFractionDigits:CUR.d});
  }


  

  
  const StyleGuide = {
    Colors: {
      
      Obsidian:        0x0a0a0e,   
      ObsidianRaised:  0x1f1c2e,   
      ObsidianMid:     0x2a263d,   
      VillainMagenta:  0xff007f,   
      VillainMagentaSoft: 0xff4d9f,
      VillainMagentaDeep: 0xa00050,
      ElectricViolet:  0x8a2be2,   
      VioletDeep:      0x4a0e7f,
      VioletBright:    0xb060ff,
      Whitesmoke:      0xf5f5fa,   
      WhitesmokeDim:   0x8b95a8,   
      InkBlack:        0x000000,   
    },
    Fonts: {
      Primary:  'Luckiest Guy',    
      Body:     'Fredoka',          
    },
    Sizing: {
      
      strokeBorder:  1.8,
      strokeHighlight: 1.2,
      strokeInkContour: 0.7,
      
      btnH:          44,
      
      radiusModal:   16,
      radiusBtn:     20,
      radiusChip:    9,
    },
    Glow: {
      
      outer:  0.06,
      mid:    0.12,
      inner:  0.22,
      core:   0.30,
    },
  };

  
  const THEME = {
    colors: {

      surface0:    0x0a0518,   
      surface1:    0x19103e,   
      surface2:    0x2e1c58,   
      surface3:    0x46297a,   
      sunken:      0x070314,   

      primary:     0x15151c, primaryHover: 0x232330,


      

      accent:        0xff007f,  
      accentMuted:   0xa00050,  
      accentBright:  0xff5ab0,  
      accentDeep:    0x7a0040,  


      

      pink:          0xff007f,    
      pinkBright:    0xff4d9f,    
      pinkMuted:     0xa00050,    
      violet:        0x8a2be2,    
      violetDeep:    0x4a0e7f,    
      violetBright:  0xb060ff,    
      obsidian:      0x0a0a0e,    

      
      blue:          0x4a7fe9,  
      blueBright:    0x6f9aff,  

      
      cyan:          0x8be4ff,  
      cyanBright:    0xbfe8ff,  

      
      text:         0xfdf2ff,
      textMuted:    0xb89cd8,   
      textDisabled: 0x556270,
      textInverse:  0x14141a,

      
      win:   0x52d189,
      loss:  0xff6b6b,
      warn:  0xffb84d,
      info:  0x65d4f0,

      
      stroke:       0x2d3245,
      strokeStrong: 0x3d4358,
      strokeGlass:  0xffffff,  

      
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


  
  
  const SYM = { R:0,G:1,B:2,P:3,O:4,C:5,BELL:6,CROWN:7,STAR:8 };
  const SYM_COUNT = 9, STAR = SYM.STAR;
  const SYM_NAME = ['Cherry','Lemon','Plum','Grapes','Watermelon','Bell','Seven','Crown','Star'];


  

  
  const IDLE_ANIM_SYMS = new Set([6, 7, 8]);
  function shouldAnimateIdle(symbolId){ return IDLE_ANIM_SYMS.has(symbolId); }

  
  const PAY = [
    [  6,  30,   95],  
    [  6,  30,   95],  
    [ 10,  48,  165],  
    [ 14,  72,  240],  
    [ 19,  92,  332],  
    [ 28, 140,  458],  
    [ 48, 230,  920],  
    [113, 552, 2760],  
    [  0,   0,    0],  
  ];
  
  const SCAT = { 3:2, 4:9, 5:48 };

  
  const LINES = [
    [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],
    [0,1,2,1,0],[2,1,0,1,2],[1,0,0,0,1],
    [1,2,2,2,1],[0,1,1,1,0],[2,1,1,1,2],
    [1,0,1,2,1],
  ];
  const NLINES = LINES.length, REELS = 5, ROWS = 3;

  
  
  const LINE_COLORS = [0xff007f,0xc566ff,0xff5cc8,0x9a3bd6,0xff8ad0,0xd84bff,0xff2f93,0xe0185c,0xff5ab0,0xb86bf0];


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

  
  const FS_AWARD = { 3:10, 4:12, 5:15 };   
  const FS_RETRIGGER = 5, FS_MULT = 3, FS_CAP = 60;

  
  const BUY_FS_SPINS = 10, BUY_COST_MULT = 23.82;   
  const MAX_WIN_X = 5000;          
  const ADVERTISED_MAX_X = 5000;   
  const RTP_DISPLAY = '97.00%';   

  
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
  
  function evalGrid(grid){
    let lineLineBet = 0;
    const lineWins = [];
    for(let l=0;l<NLINES;l++){
      const pat = LINES[l];
      const base = grid[0][pat[0]];
      if(base === STAR) continue;
      let count = 1;
      for(let r=1;r<REELS;r++){ const s=grid[r][pat[r]]; if(s === base || s === STAR) count++; else break; }  
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

    
    turboMode: 1,   
    get turbo(){ return this.turboMode > 0; },
    set turbo(v){ this.turboMode = v ? 1 : 0; },
    muted: false,
    reduced: false,
    reducedSystem: false,
    autoplay: { active:false, remaining:0, total:0, stopOnFeature:true, stopOnBigWin:false },
    history: [],
    lastWinX6: 0,    
    stats: { spins:0, totalBet:0, totalWon:0, hits:0, features:0, biggest:0 },
    sessionStartedAt: Date.now(),
    spinsSinceCheck: 0,
  };
  const isReduced = () => State.reduced || State.reducedSystem;

  

  
  const _gpuWeak = (() => {
    try {
      const mobile = matchMedia('(max-width:768px)').matches ||
                     /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
      const cores  = navigator.hardwareConcurrency || 8;
      const mem    = navigator.deviceMemory || 8;   
      
      return mobile && (cores <= 4 || mem <= 4);
    } catch(_){ return false; }
  })();

  const fxScale = _gpuWeak ? 0.6 : 1.0;

  

  

  
  
  const _pickRes = (w, h) => {
    const dpr = window.devicePixelRatio || 1;
    const cap = _gpuWeak ? 2 : 3;
    return Math.max(0.5, Math.min(dpr, cap, 4096 / Math.max(w, h, 1)));
  };

  
  
  const turboAllowed = () => (typeof STAKE !== 'undefined') ? STAKE.jurisdiction !== 'UKGC' : true;
  const turboK = () => {
    if(!turboAllowed()) return 1;
    return State.turboMode === 2 ? 0.16 : State.turboMode === 1 ? 0.40 : 1;
  };

  
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

      if(typeof d.turboMode === 'number') State.turboMode = Math.min(2, Math.max(0, d.turboMode|0));
      else if(typeof d.turbo === 'boolean') State.turboMode = d.turbo ? 1 : 0;
      if(typeof d.reduced === 'boolean') State.reduced = d.reduced;
    } catch(e){}
  }
  persistLoad();

  
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
      
      .replace(/\bPAYLINES\b/g, 'LINES').replace(/\bPaylines\b/g, 'Lines').replace(/\bpaylines\b/g, 'lines')
      .replace(/\bPAYLINE\b/g, 'LINE').replace(/\bPayline\b/g, 'Line').replace(/\bpayline\b/g, 'line')
      .replace(/\bPAYTABLE\b/g, 'GAME ODDS').replace(/\bPaytable\b/g, 'Game Odds').replace(/\bpaytable\b/g, 'game odds')
      .replace(/\bPAYS\b/g, 'WINS').replace(/\bPays\b/g, 'Wins').replace(/\bpays\b/g, 'wins')
      .replace(/\b(Bet|Buy|Cash|Money|Gamble|Wager|Stake|Deposit|Withdraw|Currency|Cost|Payout|Purchase)\b/gi, m => SOCIAL_TERMS[m] || m);
  }

  
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

    catch(_){ return ((Date.now() ^ ((performance.now()*1000)|0)) >>> 0); }
  }

  

  

  const _vrndCore = mulberry32(cryptoSeed());
  function vrnd(){ return _vrndCore(); }


  function buildRound(seed, mode){
    const rngSeed = (seed >>> 0) || cryptoSeed();
    const rand = mulberry32(rngSeed);
    const events = [];
    let evIdx = 0;
    let payX = 0;            
    let grid, ev, fs = null;


    

    
    
    const _forceScatterTrigger = (g) => {
      
      const reels = [0, 1, 2, 3, 4];
      
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
      ev = evalGrid(grid);   
      events.push({ index:evIdx++, type:'buy_bonus', mode:'bonus_standard', seed:String(rngSeed) });
      fs = runFreeSpins(10, rand);    
      fs._mode = 'bonus_standard';
      payX = fs.total;
    } else if(mode === 'bonus_hot'){
      
      grid = _forceScatterTrigger(spinGrid(rand));
      ev = evalGrid(grid);
      events.push({ index:evIdx++, type:'buy_bonus', mode:'bonus_hot', seed:String(rngSeed) });
      fs = runFreeSpins(6, rand);
      fs._mode = 'bonus_hot';
      fs._wildReel = 2;   

      

      
      
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
      
      grid = _forceScatterTrigger(spinGrid(rand));
      ev = evalGrid(grid);
      events.push({ index:evIdx++, type:'buy_bonus', mode:'bonus_mega', seed:String(rngSeed) });
      fs = runFreeSpins(10, rand);
      fs._mode = 'bonus_mega';
      fs._stickyCrowns = true;

      

      
      const megaDist = [[2,35],[3,30],[5,20],[7,10],[10,5]];
      const totalW = megaDist.reduce((s,[,w]) => s+w, 0);
      const stickyGrid = [[null,null,null],[null,null,null],[null,null,null],[null,null,null],[null,null,null]];
      fs.total = 0;
      fs.spins.forEach(s => {
        
        const pickR = rand() * totalW;
        let cum = 0, pick = 2;
        for(const [v, w] of megaDist){ cum += w; if(pickR < cum){ pick = v; break; } }
        s.mult = pick;
        
        for(let reel=0; reel<REELS; reel++){
          for(let row=0; row<ROWS; row++){
            if(stickyGrid[reel][row] != null){
              s.grid[reel][row] = stickyGrid[reel][row];
            } else if(s.grid[reel][row] === SYM.CROWN){
              stickyGrid[reel][row] = SYM.CROWN;
            }
          }
        }

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

  

  

  

  

  function parseRound(events, payoutMultiplier){
    events = Array.isArray(events) ? events : [];
    const find = t => events.find(e => e && e.type === t);
    const all  = t => events.filter(e => e && e.type === t);
    const num  = (v, d) => (v == null ? d : v);

    
    const reelsAll   = all('reels');
    const fsStart    = find('fs_start') || find('freespins_start');
    const fsStartIdx = fsStart ? events.indexOf(fsStart) : -1;
    const baseReels  = reelsAll.find(e => fsStartIdx < 0 || events.indexOf(e) < fsStartIdx)
                    || reelsAll[0] || find('reveal');
    const grid = baseReels ? baseReels.grid : spinGrid(mulberry32(1));


    const buy  = find('buy_bonus');
    const mode = buy ? (buy.mode || 'bonus') : 'base';

    
    const lineWinEv = all('line_win');
    const scatEv    = find('scatter_win');
    let ev;
    if(lineWinEv.length || scatEv){
      const lineWins = lineWinEv.map(e => ({
        line:  num(e.line, 0),
        sym:   num(e.symbol, e.sym),
        count: num(e.count, 3),

        
        payLineBet: num(e.x, num(e.multiplier, 0)) * NLINES,
      }));
      const lineX = lineWins.reduce((s,w) => s + w.payLineBet, 0) / NLINES;
      const scatX = scatEv ? num(scatEv.x, num(scatEv.multiplier, 0)) : 0;
      let scatCount = scatEv ? num(scatEv.count, 0) : 0;
      if(!scatCount){ for(let r=0;r<REELS;r++) for(let row=0;row<ROWS;row++) if(grid[r][row]===STAR) scatCount++; }
      ev = { lineX, scatX, scatCount, lineWins };
    } else {
      ev = evalGrid(grid);   
    }


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

        const fsReelIdxs = [];
        events.forEach((e,i) => { if(i > fsStartIdx && e && e.type === 'reels') fsReelIdxs.push(i); });
        spins = fsReelIdxs.map((ri, i) => {
          const re = events[ri];
          const nextRi = fsReelIdxs[i+1] != null ? fsReelIdxs[i+1] : events.length;

          

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

        
        
        _wildReel:     wildReelEv ? wildReelEv.wildReel : (/hot/i.test(fsMode) ? 2 : null),
        _stickyCrowns: all('sticky_crown').length > 0 || /mega/i.test(fsMode),
      };
    }

    return {
      grid, ev, fs, mode, events,
      payX100: Math.round(num(payoutMultiplier, 0) * 100),
    };
  }

  
  const Audit = {
    log: [],
    flush(entry){ this.log.push(entry); if(this.log.length > 200) this.log.shift(); },
  };

  
  const isMockRGS = () => STAKE.rgs_url.startsWith('mock://');
  class RGSError extends Error { constructor(code,message){ super(message); this.code = code; } }

  
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

      const r = await fetchT(STAKE.rgs_url + '/bet/replay/' + path + (qs ? '?'+qs : ''));
      if(!r.ok) throw new RGSError('ERR_GEN', await r.text());
      const data = await r.json();
      if(data.error) throw new RGSError(data.error, JSON.stringify(data));
      const events = data.round?.state || data.state || data.events || [];
      const payMul = data.round?.payoutMultiplier ?? data.payoutMultiplier ?? 0;
      return { round: parseRound(events, payMul), payoutMultiplier: payMul };
    },
  };


  
  try { await Promise.all([
    document.fonts.load("1em 'Luckiest Guy'"),
    document.fonts.load("700 1em 'Fredoka'"),
  ]); } catch(e){}

  

  
  try {
    if(!document.fonts.check("1em 'Luckiest Guy'") || !document.fonts.check("700 1em 'Fredoka'")){
      const adds = [];
      for(const sheet of document.styleSheets){
        let rules; try { rules = sheet.cssRules; } catch(_){ continue; }   
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


  

  function computeCanvasSize(){
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isPortrait = vh > vw * 1.05;
    if(isPortrait || vw <= 768){
      
      return { w: vw, h: vh };
    }
    
    return {
      w: Math.min(vw, 1200),
      h: Math.min(vh, 675),
    };
  }
  const _initSz = computeCanvasSize();
  const app = new PIXI.Application();
  await app.init({
    width: _initSz.w, height: _initSz.h,

    
    
    antialias: !_gpuWeak, backgroundColor: 0x1a0a2e,
    resolution: _pickRes(_initSz.w, _initSz.h), autoDensity: true,
  });

  app.ticker.maxFPS = 60;
  document.body.appendChild(app.canvas);

  

  
  
  app.canvas.setAttribute('role', 'application');
  app.canvas.setAttribute('aria-label',
    'SHINING POP slot game. Press Space or Enter to spin. ' +
    'Arrow keys to adjust bet. B for Buy Bonus, A for Autoplay, ' +
    'T for Turbo, I for game info, M to mute, Escape to close any panel.');
  app.canvas.setAttribute('tabindex', '0');

  
  app.canvas.style.outline = 'none';
  app.canvas.addEventListener('focus', () => {
    
    if(app.canvas.matches(':focus-visible')){
      app.canvas.style.outline = '2px solid #ffd75a';
      app.canvas.style.outlineOffset = '2px';
    }
  });
  app.canvas.addEventListener('blur', () => {
    app.canvas.style.outline = 'none';
  });
  window.__app = app;

  
  
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

  globalThis.__PIXI_APP__ = app;
  globalThis.__PIXI_STAGE__ = app.stage;
  globalThis.__PIXI_RENDERER__ = app.renderer;

  

  

  
  
  let _resizeTok = 0;
  function _onWindowResize(){
    const tok = ++_resizeTok;
    requestAnimationFrame(() => {
      if(tok !== _resizeTok) return;
      const sz = computeCanvasSize();
      const safeRes = _pickRes(sz.w, sz.h);   
      const resChanged = Math.abs((app.renderer.resolution || 1) - safeRes) > 0.01;
      if(app.screen.width === sz.w && app.screen.height === sz.h && !resChanged) return;
      
      try { app.renderer.resize(sz.w, sz.h, safeRes); }
      catch(e){ try { app.renderer.resolution = safeRes; app.renderer.resize(sz.w, sz.h); } catch(_){} }
      
      try { typeof layout === 'function' && layout(); } catch(e){}
    });
  }
  window.addEventListener('resize', _onWindowResize);
  window.addEventListener('orientationchange', _onWindowResize);

  if(window.visualViewport){
    try { window.visualViewport.addEventListener('resize', _onWindowResize); } catch(e){}
  }


  
  
  const SH = 'assets/images/';
  const ASSETS = {
    _bg:SH+'bg.jpg',     _logo:SH+'logo.jpg',

    
    
    _s0:SH+'sym0-cherry.jpg', _s1:SH+'sym1-lemon.jpg',  _s2:SH+'sym2-plum.jpg',
    _s3:SH+'sym3-grapes.jpg', _s4:SH+'sym4-melon.jpg',  _s5:SH+'sym5-bell.jpg',
    _s6:SH+'sym6-seven.jpg',  _s7:SH+'sym7-crown.jpg',  _s8:SH+'sym8-star.jpg',
    
    _tierStd: SH+'tier-standard.jpg', _tierHot: SH+'tier-hot.jpg', _tierMega: SH+'tier-mega.jpg',
  };
  try {
    await PIXI.Assets.load(
      Object.entries(ASSETS).map(([alias,src]) => ({ alias, src })),

      
      (p) => { const pc=Math.round(p*100);
               if(lfill) lfill.style.width=pc+'%'; }
    );
  } catch(e){ fail('Asset load failed'); return; }
  
  const TEX = {};
  const tex = (a) => TEX[a] || PIXI.Assets.get(a);
  const spr = (a) => { const s = new PIXI.Sprite(tex(a)); s.anchor.set(0.5); return s; };
  const fitW = (s,w) => { s.scale.set(w / s.texture.width); };
  
  const symScale = (t,box) => box / Math.max(t.width, t.height);

  
  function imgLoad(alias){
    return new Promise(res => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = ASSETS[alias];
    });
  }

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
  const ICON_DPR = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 3);
  // If a canvas was drawn at ICON_DPR scale (the procedural icons/plaques), tag its
  // CanvasSource resolution so it stays S logical px but uploads dpr x the pixels =
  // crisp on retina. Image-baked textures (no _iconDpr) keep resolution 1.
  const T = (c) =>
    c && c._iconDpr
      ? new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: c, resolution: c._iconDpr }) })
      : PIXI.Texture.from(c);
  function proc(img, maxDim, doTrim, lo, hi){
    if(!img) return T(_blankC);
    const c = stripCanvas(img, maxDim, lo, hi);
    const t = T(doTrim ? trimCanvas(c) : c);

    

    
    try { const s = t.source; s.autoGenerateMipmaps = true; s.scaleMode = 'linear'; s.update(); } catch(e){}
    return t;
  }

  
  const _src = await Promise.all(['_s0','_s1','_s2','_s3','_s4','_s5','_s6','_s7','_s8',
    '_logo','_tierStd','_tierHot','_tierMega'].map(imgLoad));
  const symImg = _src.slice(0,9);
  const [imLogo,imTierStd,imTierHot,imTierMega] = _src.slice(9);

  TEX.bg = PIXI.Assets.get('_bg');                    
  for(let i=0;i<9;i++) TEX['s'+i] = proc(symImg[i], 540, false);   
  TEX.logo         = proc(imLogo, 900, true);             
  TEX.extraStudio  = proc(null, 700, true);              
  
  TEX.tierStd = proc(imTierStd, 480, true); TEX.tierHot = proc(imTierHot, 480, true); TEX.tierMega = proc(imTierMega, 480, true);

  

  const _imBuyBonus = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = SH + 'buy-bonus.png'; });
  TEX.buyBonus = _imBuyBonus ? proc(_imBuyBonus, 700, true) : null;
  TEX.spin     = spinTex('spin');  TEX.stop = spinTex('stop');   

  

  TEX.frameWin = (() => { const c=document.createElement('canvas'); c.width=821; c.height=618; return T(c); })();

  
  const balTex = (() => {
    const W=640, H=264, c=document.createElement('canvas'); c.width=W*ICON_DPR; c.height=H*ICON_DPR; c._iconDpr=ICON_DPR;
    const x=c.getContext('2d'); x.scale(ICON_DPR, ICON_DPR); const m=8, r=50, pw=W-2*m, ph=H-2*m;
    rr(x,m,m,pw,ph,r); x.fillStyle='#1e1914'; x.fill();
    rr(x,m+3,m+3,pw-6,ph-6,r-3); x.lineWidth=4; x.strokeStyle='#b88e40'; x.stroke();
    rr(x,m+11,m+11,pw-22,ph-22,r-11); x.lineWidth=1.5; x.strokeStyle='rgba(232,197,118,0.24)'; x.stroke();
    return T(c);
  })();
  TEX.balPlate = balTex; TEX.betPlate = balTex; TEX.winPlate = balTex;
  TEX.buyPlate = balTex;

  
  function rr(x,X,Y,W,H,r){
    r=Math.min(r,W/2,H/2);
    x.beginPath();
    x.moveTo(X+r,Y);
    x.arcTo(X+W,Y,X+W,Y+H,r); x.arcTo(X+W,Y+H,X,Y+H,r);
    x.arcTo(X,Y+H,X,Y,r);     x.arcTo(X,Y,X+W,Y,r);
    x.closePath();
  }

  
  const gemC = trimCanvas(stripCanvas(_blankC, 264));
  function gemTex(drawGlyph){

    

    
    
    const S = 240, c = document.createElement('canvas');
    c.width = c.height = S * ICON_DPR;
    c._iconDpr = ICON_DPR;
    const x = c.getContext('2d');
    x.scale(ICON_DPR, ICON_DPR);
    x.save();
    x.translate(S/2, S/2);
    x.lineJoin = 'round';
    x.lineCap  = 'round';
    drawGlyph(x, S);
    x.restore();
    return T(c);
  }

  

  

  

  function spinTex(kind){
    const S = 360, c = document.createElement('canvas');
    c.width = c.height = S * ICON_DPR;
    c._iconDpr = ICON_DPR;
    const x = c.getContext('2d');
    x.scale(ICON_DPR, ICON_DPR);
    const cx = S/2, cy = S/2, R = S * 0.42;
    
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.65)';
    x.shadowBlur  = S * 0.060;
    x.shadowOffsetY = S * 0.020;
    x.beginPath(); x.arc(cx, cy, R, 0, 7);
    x.fillStyle = '#0a0a14'; x.fill();
    x.restore();
    
    x.save();
    x.beginPath(); x.arc(cx, cy, R, 0, 7); x.clip();
    const rg = x.createRadialGradient(cx, cy, R * 0.10, cx, cy, R * 1.0);
    rg.addColorStop(0,    '#2c261e');     
    rg.addColorStop(0.55, '#16120d');     
    rg.addColorStop(1,    '#0a0806');     
    x.fillStyle = rg;
    x.fillRect(cx-R, cy-R, 2*R, 2*R);
    
    const lg = x.createLinearGradient(0, cy-R, 0, cy+R*0.2);
    lg.addColorStop(0,    'rgba(255,255,255,0.18)');
    lg.addColorStop(0.55, 'rgba(255,255,255,0.04)');
    lg.addColorStop(1,    'rgba(0,0,0,0)');
    x.fillStyle = lg;
    x.fillRect(cx-R, cy-R, 2*R, R*1.2);

    const under = x.createRadialGradient(cx, cy + R*0.44, R*0.05, cx, cy + R*0.28, R*0.98);
    under.addColorStop(0,   'rgba(215,105,205,0.36)'); // cool-dominant: candy-magenta under-glow (was warm gold 233,191,90)
    under.addColorStop(0.5, 'rgba(215,105,205,0.13)');
    under.addColorStop(1,   'rgba(215,105,205,0.00)');
    x.fillStyle = under;
    x.fillRect(cx-R, cy-R, 2*R, 2*R);

    const gloss = x.createLinearGradient(0, cy - R*0.78, 0, cy - R*0.02);
    gloss.addColorStop(0, 'rgba(255,255,255,0.46)');
    gloss.addColorStop(1, 'rgba(255,255,255,0.00)');
    x.fillStyle = gloss;
    x.beginPath();
    x.ellipse(cx, cy - R*0.40, R*0.66, R*0.36, 0, 0, Math.PI*2);
    x.fill();
    
    const spark = x.createRadialGradient(cx - R*0.30, cy - R*0.42, 0, cx - R*0.30, cy - R*0.42, R*0.28);
    spark.addColorStop(0, 'rgba(255,255,255,0.85)');
    spark.addColorStop(1, 'rgba(255,255,255,0.00)');
    x.fillStyle = spark;
    x.beginPath();
    x.ellipse(cx - R*0.30, cy - R*0.42, R*0.27, R*0.20, -0.5, 0, Math.PI*2);
    x.fill();
    x.restore();
    
    x.save();
    x.translate(cx, cy);
    
    x.strokeStyle = 'rgba(173,124,47,0.30)';
    x.lineWidth = S * 0.030;
    x.beginPath(); x.arc(0, 0, R - S * 0.010, 0, 7); x.stroke();
    x.strokeStyle = 'rgba(226,186,94,0.90)';
    x.lineWidth = S * 0.012;
    x.beginPath(); x.arc(0, 0, R - S * 0.005, 0, 7); x.stroke();
    
    x.strokeStyle = 'rgba(251,233,170,0.55)';
    x.lineWidth = S * 0.006;
    x.beginPath(); x.arc(0, 0, R - S * 0.024, 0, 7); x.stroke();
    
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
    
    x.lineWidth = S * 0.014;
    x.strokeStyle = 'rgba(245,247,250,0.55)';
    for(let i = 0; i < 8; i++){
      const a = (i / 8) * Math.PI * 2 - Math.PI/2;
      const major = (i % 2 === 0);   
      const sxL = Math.cos(a) * (ringR - S * (major ? 0.028 : 0.018));
      const syL = Math.sin(a) * (ringR - S * (major ? 0.028 : 0.018));
      const exL = Math.cos(a) * (ringR + S * 0.012);
      const eyL = Math.sin(a) * (ringR + S * 0.012);
      x.beginPath();
      x.moveTo(sxL, syL); x.lineTo(exL, eyL);
      x.stroke();
    }
    x.restore();
    
    x.save();
    x.translate(cx, cy);
    x.lineJoin = 'round';
    x.lineCap = 'round';
    x.strokeStyle = '#f5f7fa';
    x.fillStyle   = '#f5f7fa';
    if(kind === 'stop'){
      
      const u = S * 0.16;
      
      const stopGlow = x.createRadialGradient(0, 0, u * 0.5, 0, 0, u * 2.2);
      stopGlow.addColorStop(0,   'rgba(233,191,90,0.40)');
      stopGlow.addColorStop(0.5, 'rgba(186,133,45,0.20)');
      stopGlow.addColorStop(1,   'rgba(186,133,45,0.00)');
      x.fillStyle = stopGlow;
      x.beginPath(); x.arc(0, 0, u * 2.2, 0, 7); x.fill();
      x.fillStyle = '#f5f7fa';
      rr(x, -u, -u, 2*u, 2*u, u * 0.32); x.fill();
    } else {

      
      const centerGlow = x.createRadialGradient(0, 0, 0, 0, 0, S * 0.185);
      centerGlow.addColorStop(0,   'rgba(250,223,142,0.26)');
      centerGlow.addColorStop(0.5, 'rgba(233,191,90,0.09)');
      centerGlow.addColorStop(1,   'rgba(233,191,90,0.00)');
      x.fillStyle = centerGlow;
      x.beginPath(); x.arc(0, 0, S * 0.185, 0, 7); x.fill();

      

      x.save();
      x.shadowColor = 'rgba(255,255,255,0.55)';
      x.shadowBlur  = S * 0.026;
      x.lineJoin = 'round'; x.lineCap = 'round';
      x.strokeStyle = '#ffffff';
      x.fillStyle   = '#ffffff';
      // Twin circular-arrow "spin" glyph — two ~165° arcs 180° apart, each ending
      // in a leading arrowhead. Reads unambiguously as rotate/spin; the old single
      // arc + one head read as a browser "reload".
      const ar = S * 0.205, lw = S * 0.064;
      x.lineWidth = lw;
      const arrowArc = (a0, a1) => {
        x.beginPath(); x.arc(0, 0, ar, a0, a1); x.stroke();
        const ex = ar * Math.cos(a1), ey = ar * Math.sin(a1);
        const tx = -Math.sin(a1),     ty = Math.cos(a1);   // clockwise tangent (travel dir)
        const rx = Math.cos(a1),      ry = Math.sin(a1);   // radial (outward)
        const head = lw * 1.7, halfW = lw * 1.42;
        x.beginPath();
        x.moveTo(ex + tx * head,  ey + ty * head);
        x.lineTo(ex + rx * halfW, ey + ry * halfW);
        x.lineTo(ex - rx * halfW, ey - ry * halfW);
        x.closePath(); x.fill();
      };
      arrowArc(-0.30 * Math.PI, 0.62 * Math.PI);
      arrowArc( 0.70 * Math.PI, 1.62 * Math.PI);
      x.restore();
    }
    x.restore();
    return T(c);
  }

  

  
  
  function stepTex(kind){
    const S = 200, c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    x.translate(S/2, S/2);
    x.lineJoin = 'round';
    x.lineCap  = 'round';
    x.strokeStyle = '#f5f7fa';   
    x.lineWidth   = S * 0.085;
    const a = S * 0.22;
    x.beginPath();
    x.moveTo(-a, 0); x.lineTo(a, 0);
    if(kind === 'plus'){ x.moveTo(0, -a); x.lineTo(0, a); }
    x.stroke();
    return T(c);
  }

  

  

  function ink(x,S,draw){
    x.strokeStyle = '#f5f7fa';   
    x.fillStyle   = '#f5f7fa';
    x.lineWidth   = S * 0.075;
    draw();
  }
  function accent(x,S,draw){
    x.strokeStyle = '#ff007f';   
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

      ink(x,S,()=>{ x.beginPath();
        x.moveTo(-u*1.10,-u*0.40); x.lineTo(-u*0.46,-u*0.40); x.lineTo(u*0.10,-u*0.92);
        x.lineTo(u*0.10, u*0.92); x.lineTo(-u*0.46, u*0.40); x.lineTo(-u*1.10, u*0.40);
        x.closePath(); x.fill(); });
      
      thinInk(x,S,()=>{ x.beginPath(); x.arc(u*0.22, 0, u*0.62, -0.85, 0.85); x.stroke(); });
      
      x.globalAlpha = 0.75;
      thinInk(x,S,()=>{ x.beginPath(); x.arc(u*0.22, 0, u*1.06, -0.75, 0.75); x.stroke(); });
      x.globalAlpha = 1;
    } else if(type==='mute'){
      
      ink(x,S,()=>{ x.beginPath();
        x.moveTo(-u*1.10,-u*0.40); x.lineTo(-u*0.46,-u*0.40); x.lineTo(u*0.10,-u*0.92);
        x.lineTo(u*0.10, u*0.92); x.lineTo(-u*0.46, u*0.40); x.lineTo(-u*1.10, u*0.40);
        x.closePath(); x.fill(); });
      
      ink(x,S,()=>{ x.beginPath();
        x.moveTo(u*0.46,-u*0.56); x.lineTo(u*1.22, u*0.56);
        x.moveTo(u*1.22,-u*0.56); x.lineTo(u*0.46, u*0.56); x.stroke(); });
    } else if(type==='turbo'){

      
      
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

      
      x.lineWidth = S * 0.055;
      x.strokeStyle = '#f5f7fa';
      x.beginPath();
      for(let i = 0; i < 6; i++){
        const a = (i / 6) * Math.PI * 2 - Math.PI/2;
        const px = Math.cos(a) * u * 1.10, py = Math.sin(a) * u * 1.10;
        if(i === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.closePath(); x.stroke();
      
      ink(x,S,()=>{ x.beginPath(); x.arc(0,-u*0.50, u*0.16, 0, 7); x.fill(); });
      ink(x,S,()=>{
        x.beginPath(); x.lineCap='round';
        x.moveTo(0,-u*0.06); x.lineTo(0, u*0.62); x.stroke();
      });
    } else if(type==='settings'){

      
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
      
      x.save();
      x.globalCompositeOperation = 'destination-out';
      x.beginPath(); x.arc(0, 0, u * 0.46, 0, 7); x.fill();
      x.restore();
      
      thinInk(x,S,()=>{ x.beginPath(); x.arc(0, 0, u * 0.46, 0, 7); x.stroke(); });
    } else if(type==='full'){

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
      
      ink(x,S,()=>{ x.beginPath(); x.arc(0,0,u*1.02,0,7); x.stroke(); });
      
      thinInk(x,S,()=>{
        [[0,-1],[1,0],[0,1],[-1,0]].forEach(([dx,dy]) => {
          x.beginPath();
          x.moveTo(dx*u*0.86, dy*u*0.86); x.lineTo(dx*u*1.00, dy*u*1.00);
          x.stroke();
        });
      });
      
      ink(x,S,()=>{
        x.lineCap='round';
        x.beginPath(); x.moveTo(0,0); x.lineTo(0,-u*0.62); x.stroke();
        x.beginPath(); x.moveTo(0,0); x.lineTo(u*0.46,u*0.16); x.stroke();
      });
    } else if(type==='auto'){

      
      
      x.lineWidth = S * 0.075;
      x.strokeStyle = '#f5f7fa';
      x.lineCap = 'round';
      
      x.beginPath();
      x.arc(0, 0, u * 1.05, -Math.PI * 0.10, Math.PI * 1.55);
      x.stroke();
      
      const aStart = -Math.PI * 0.10;
      const ax = Math.cos(aStart) * u * 1.05;
      const ay = Math.sin(aStart) * u * 1.05;
      x.fillStyle = '#f5f7fa';
      x.beginPath();
      x.moveTo(ax + u*0.04, ay - u*0.36);
      x.lineTo(ax + u*0.30, ay + u*0.06);
      x.lineTo(ax - u*0.18, ay - u*0.06);
      x.closePath(); x.fill();
      
      ink(x,S,()=>{ x.beginPath();
        x.moveTo(-u*0.26, -u*0.48); x.lineTo( u*0.50, 0); x.lineTo(-u*0.26, u*0.48);
        x.closePath(); x.fill(); });
    } else if(type==='close'){
      
      ink(x,S,()=>{
        x.lineCap = 'round';
        x.beginPath();
        x.moveTo(-u*0.78,-u*0.78); x.lineTo(u*0.78,u*0.78);
        x.moveTo( u*0.78,-u*0.78); x.lineTo(-u*0.78,u*0.78);
        x.stroke();
      });
    } else if(type==='plus' || type==='minus'){

      

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


  

  
  (() => {
    const W=512,H=288,c=document.createElement('canvas'); c.width=W;c.height=H;
    const x=c.getContext('2d');
    
    const fy = H * 0.42, 
          rIn  = Math.min(W,H) * 0.12,
          rOut = Math.hypot(W * 0.55, H * 0.78);  
    const g = x.createRadialGradient(W/2, fy, rIn, W/2, fy, rOut);
    g.addColorStop(0,    'rgba(10,2,16,0)');
    g.addColorStop(0.45, 'rgba(10,2,16,0.12)');
    g.addColorStop(0.72, 'rgba(9,2,15,0.42)');
    g.addColorStop(1.00, 'rgba(5,1,10,0.92)');
    x.fillStyle = g; x.fillRect(0,0,W,H);

    
    const lg = x.createLinearGradient(0, H*0.45, 0, H);
    lg.addColorStop(0, 'rgba(0,0,0,0)');
    lg.addColorStop(1, 'rgba(0,0,0,0.20)');
    x.fillStyle = lg; x.fillRect(0,0,W,H);
    TEX.vignette = T(c);
  })();


  const SYM_TEX = [];
  for(let i=0;i<9;i++) SYM_TEX[i] = TEX['s'+i];
  
  const glowTex = (() => {
    const g = new PIXI.Graphics();
    for(let i=10;i>=1;i--) g.circle(0,0,i*11).fill({ color:0xffffff, alpha:0.05 });
    const t = app.renderer.generateTexture({ target:g, resolution:1,
      frame:new PIXI.Rectangle(-120,-120,240,240) });
    g.destroy();
    return t;
  })();

  
  const stage = app.stage;


  

  

  
  const gradeFilter = new PIXI.ColorMatrixFilter();
  gradeFilter.contrast(0.12, false);    
  gradeFilter.saturate(0.16, true);     

  

  {
    const m = gradeFilter.matrix;
    m[4]  += 0.012;  
    m[9]  -= 0.006;  
    m[14] += 0.006;  
    gradeFilter.matrix = m;
  }
  gradeFilter.alpha = 1.0;              
  stage.filterArea = app.screen;        
  stage.filters = [gradeFilter];


  

  
  
  const _baseGradeMatrix = new Float32Array(gradeFilter.matrix);
  function _applyGradeMode(mode){

    

    const m = gradeFilter.matrix;
    for(let i=0;i<m.length;i++) m[i] = _baseGradeMatrix[i];
    if(mode === 'bonus_standard' || mode === 'bonus_hot' || mode === 'bonus_mega'){
      gradeFilter.brightness(1.04, true);   
    }
    
  }

  function setGradeMode(mode){
    if (!window.gsap?.timeline) { _applyGradeMode(mode); return; }
    window.gsap.timeline()
      .to(gradeFilter, { alpha: 0.75, duration: 0.28, ease: 'power2.out' })
      .call(() => _applyGradeMode(mode))
      .to(gradeFilter, { alpha: 1.0, duration: 0.32, ease: 'power2.in' });
  }

  const bg = spr('bg');                            stage.addChild(bg);

  
  
  const godRays = new PIXI.Graphics(); godRays.blendMode = 'add'; stage.addChild(godRays);

  

  
  
  const ambientMotesG = new PIXI.Graphics(); ambientMotesG.blendMode = 'add'; stage.addChild(ambientMotesG);
  const ambientMotes = [];

  
  bg.tint = 0x8b7a9f; // cool-dominant: deeper cool-purple bg so warm fruit symbols pop + neon edges read (was 0xb8b8c8 grey)
  const vignette = spr('vignette');                stage.addChild(vignette);
  
  vignette.alpha = 1.0;


  

  const isPhoneViewport = () => {
    const w = window.innerWidth, h = window.innerHeight;
    return Math.min(w, h) < 500;   
  };
  const gameBlurFilter = new PIXI.BlurFilter({
    strength: 0,
    quality: isPhoneViewport() ? 2 : 4,
  });
  gameBlurFilter.padding = 32;   
  bg.filters = [gameBlurFilter];
  bg._blurT = 0;


  

  

  

  
  
  const logoHalo = new PIXI.Graphics();
  logoHalo.blendMode = 'add';
  logoHalo.eventMode = 'none';
  stage.addChild(logoHalo);
  const logo = spr('logo'); logo.eventMode = 'none'; stage.addChild(logo);

  
  const logoShine = new PIXI.Sprite(tex('logo'));
  logoShine.anchor.set(0.5);
  logoShine.eventMode = 'none';
  logoShine.blendMode = 'add';
  logoShine.alpha = 0;
  stage.addChild(logoShine);

  
  
  const maxWinCap = new PIXI.Text({ text:'MAX WIN 5,000×', resolution:3, style:{
    fontFamily:'Fredoka', fontSize:13, fontWeight:'700', fill:0xff8ad0, letterSpacing:2.5,   
    stroke:{ color:0x2a0a1e, width:3.5, join:'round' },
  }});
  maxWinCap.anchor.set(0.5);
  maxWinCap.eventMode = 'none';
  maxWinCap.alpha = 0.92;
  stage.addChild(maxWinCap);

  
  const reelArea = new PIXI.Container(); stage.addChild(reelArea);

  

  
  const reelBlurFilter = new PIXI.BlurFilter({ strength: 0, quality: isPhoneViewport() ? 1 : 3 });
  reelBlurFilter.padding = 16;
  const _reelBlurArr = [reelBlurFilter];

  

  

  
  const swipeZone = new PIXI.Container(); swipeZone.eventMode = 'static'; stage.addChild(swipeZone);
  let _swipe = null;
  let _swipeReturnRAF = null;

  
  function rubberBand(dy){
    const cap = CELL * 1.05;
    return Math.sign(dy) * Math.tanh(Math.abs(dy) / (CELL * 0.85)) * cap;
  }

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

    if(STAKE.replay) return;
    if(allReelsSpinning) {

      _swipe = { x:e.global.x, y:e.global.y, t:performance.now(), drag:false };
      return;
    }
    if(State.phase !== Phase.IDLE) return;

    if(_swipeReturnRAF) { cancelAnimationFrame(_swipeReturnRAF); _swipeReturnRAF = null; }
    _swipe = {
      x: e.global.x, y: e.global.y, t: performance.now(),
      lastDy: 0, drag: true,
      baseOffsets: reels.map(r => r.offset),
    };
    
    swipeZone.cursor = 'grabbing';
  });
  swipeZone.on('pointermove', e => {
    if(!_swipe || !_swipe.drag) return;
    const dy = e.global.y - _swipe.y;
    const damped = rubberBand(dy);
    _swipe.lastDy = damped;

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
    
    if(allReelsSpinning){
      
      if(Math.hypot(dx, dy) > 8 || dt < 250) quickStopReels();
      return;
    }
    if(State.phase !== Phase.IDLE) return;

    const flickV = dt > 0 ? Math.abs(dy) / dt : 0;            
    const goodDrag = drag && (Math.abs(dragDy) > CELL * 0.35 || flickV > 0.5);
    if(goodDrag){

      
      for(let r = 0; r < REELS; r++) reels[r].offset = 0;
      startSpin();
      return;
    }
    
    if(drag && Math.abs(dragDy) > 1){
      snapReelsBackToRest();
    }
    
    if(Math.hypot(dx, dy) < 12 && dt < 350 && State.phase === Phase.IDLE){
      try { if(typeof showLinesPreview === 'function') showLinesPreview(); } catch(e){}  
    }
  });
  swipeZone.on('pointerupoutside', () => {
    if(_swipe && _swipe.drag) snapReelsBackToRest();
    _swipe = null;
    swipeZone.cursor = 'default';
  });
  
  swipeZone.on('pointerover', () => {
    if(State.phase === Phase.IDLE && !allReelsSpinning && !STAKE.replay) {
      swipeZone.cursor = 'grab';
    }
  });
  swipeZone.on('pointerout', () => { swipeZone.cursor = 'default'; });
  const frameG = new PIXI.Graphics();    reelArea.addChild(frameG);

  
  const cornerJewelsG = new PIXI.Graphics(); reelArea.addChild(cornerJewelsG);
  const reelsWrap = new PIXI.Container(); reelArea.addChild(reelsWrap);
  const reelMask = new PIXI.Graphics();  reelArea.addChild(reelMask);
  reelsWrap.mask = reelMask;
  const lineG = new PIXI.Graphics(); lineG.blendMode = 'add'; reelArea.addChild(lineG);

  
  
  lineG.zIndex = 80;

  
  const linesPreviewG = new PIXI.Graphics();

  
  linesPreviewG.alpha = 0;

  

  
  linesPreviewG.zIndex = 0;
  reelArea.addChildAt(linesPreviewG, reelArea.getChildIndex(reelsWrap));
  let linesPreviewT0 = 0;
  let linesPreviewDur = 0;
  const winGlowLayer = new PIXI.Container(); winGlowLayer.blendMode = 'add'; reelArea.addChild(winGlowLayer);

  

  
  
  reelArea.sortableChildren = true;
  const winHeroLayer = new PIXI.Container(); winHeroLayer.zIndex = 60; reelArea.addChild(winHeroLayer);

  
  
  const winSheenG = new PIXI.Graphics(); winSheenG.blendMode = 'add'; winSheenG.zIndex = 62; reelArea.addChild(winSheenG);
  const frameTopG = new PIXI.Graphics(); reelArea.addChild(frameTopG);
  frameTopG.blendMode = 'add';   

  const winShadowG = new PIXI.Graphics(); reelArea.addChildAt(winShadowG, 1);
  const winGlowAddG = new PIXI.Graphics(); winGlowAddG.blendMode = 'add';
  const winFrameG   = new PIXI.Graphics();
  reelArea.addChild(winGlowAddG, winFrameG);
  
  const winBloomFilter = new PIXI.BlurFilter({ strength: 3.5, quality: 2 });   

  reelArea.addChildAt(winGlowAddG,  reelArea.getChildIndex(reelsWrap));
  reelArea.addChildAt(winGlowLayer, reelArea.getChildIndex(reelsWrap));
  reelArea.addChild(winFrameG);

  const frostBg = new PIXI.Sprite(tex('bg')); frostBg.anchor.set(0.5);

  const _frostBlur = new PIXI.BlurFilter({ strength: _gpuWeak ? 8 : 14, quality:1 });
  _frostBlur.resolution = 0.5;
  frostBg.filters = [_frostBlur];
  const frostMask = new PIXI.Graphics();
  frostBg.mask = frostMask;
  reelArea.addChildAt(frostBg, 0);
  frostBg.zIndex = -10; // reelArea.sortableChildren=true makes index-0 lose to zIndexed win layers (60/62); pin frost BEHIND so its blur never covers a big win
  reelArea.addChild(frostMask);

  
  let CELL = 90;
  const reels = [];
  for(let r=0;r<REELS;r++){
    const col = new PIXI.Container(); reelsWrap.addChild(col);
    const sprites = [], glows = [], heroes = [];
    for(let k=0;k<5;k++){
      const gl = new PIXI.Sprite(glowTex); gl.anchor.set(0.5); gl.alpha = 0; gl.visible = false;
      winGlowLayer.addChild(gl); glows.push(gl);
      const s = new PIXI.Sprite(SYM_TEX[0]); s.anchor.set(0.5); col.addChild(s); sprites.push(s);
      
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

  

  

  
  
  const stickyOverlay = new PIXI.Container();
  
  reelArea.addChildAt(stickyOverlay, reelArea.getChildIndex(reelsWrap) + 1);
  const stickySprites = [];           
  for(let r = 0; r < REELS; r++){
    const colArr = [];
    for(let row = 0; row < ROWS; row++){
      const s = new PIXI.Sprite(SYM_TEX[7]);   
      s.anchor.set(0.5);
      s.visible = false;
      s.alpha = 0;
      stickyOverlay.addChild(s);
      colArr.push(s);
    }
    stickySprites.push(colArr);
  }

  function layoutStickySprites(){
    const sz = CELL * 1.0;   // match the sticky-update size (was reading "little")
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
  
  function randStripSym(r){ const s=STRIPS[r]; return s[Math.floor(vrnd()*s.length)]; }
  reels.forEach((rl,r) => { rl.symbols = [randStripSym(r),randStripSym(r),randStripSym(r),randStripSym(r),randStripSym(r)]; });


  

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

  

  

  
  const FB_TIERS = {
    standard: { halo: 0xff5ab0, line: 0xffe6f4, brk: 0xffe6f4, ghost: 0,        glowA: 0.045, lineH: 1.6 },
    hot:      { halo: 0xff2f93, line: 0xff3f9f, brk: 0xff7ac4, ghost: 0xffd9ec, glowA: 0.075, lineH: 2.6 },
    mega:     { halo: 0xff007f, line: 0xff007f, brk: 0xff5ab0, ghost: 0x7fe7ff, glowA: 0.095, lineH: 2.8 },
  };
  let _fbTier = 'standard';
  function drawFeatureBannerPanel(){
    const T = FB_TIERS[_fbTier] || FB_TIERS.standard;

    

    const maxW = Math.max(300, app.screen.width * 0.92);
    fbText.scale.set(1);
    let w = Math.max(320, fbText.width + 110);
    if(w > maxW){ fbText.scale.set(maxW / w); w = maxW; }
    const h = 72;
    const r = 18;
    fbBg.clear();
    
    fbBg.roundRect(-w/2-14, -h/2-14, w+28, h+28, r+14)
      .fill({ color: T.halo, alpha: T.glowA });
    fbBg.roundRect(-w/2-7, -h/2-7, w+14, h+14, r+7)
      .fill({ color: T.halo, alpha: T.glowA * 2.4 });
    
    fbBg.roundRect(-w/2, -h/2+4, w, h+2, r)
      .fill({ color: 0x000000, alpha: 0.55 });
    
    fbBg.roundRect(-w/2, -h/2, w, h, r)
      .fill({ color: 0x0a0a14, alpha: 0.96 });
    
    fbBg.roundRect(-w/2+1, -h/2+1, w-2, h*0.42, r-1)
      .fill({ color: T.halo, alpha: 0.05 });
    fbBg.roundRect(-w/2+1, h*0.05, w-2, h*0.45, r-1)
      .fill({ color: 0x000000, alpha: 0.30 });
    
    fbBg.roundRect(-w/2+r, -h/2+0.5, w-r*2, 0.8, 0.4)
      .fill({ color: 0xf5f7fa, alpha: 0.55 });
    
    const lineY = h/2 - 0.6 - T.lineH, lineX = -w/2 + r*0.8, lineW = w - r*1.6;
    if(T.ghost){   
      fbBg.roundRect(lineX - 1.6, lineY - 1.2, lineW, T.lineH, 0.8)
        .fill({ color: T.ghost, alpha: 0.45 });
    }
    fbBg.roundRect(lineX, lineY, lineW, T.lineH, 0.8)
      .fill({ color: T.line, alpha: 1.0 });
    if(_fbTier === 'standard'){          
      for(const dx of [lineX, lineX + lineW]){
        const dy = lineY + T.lineH/2, d = 3.4;
        fbBg.poly([dx, dy-d, dx+d, dy, dx, dy+d, dx-d, dy]).fill({ color: T.line, alpha: 0.95 });
      }
    } else if(_fbTier === 'hot'){        
      fbBg.roundRect(lineX + lineW*0.12, lineY + T.lineH*0.3, lineW*0.76, T.lineH*0.35, 0.4)
        .fill({ color: 0xffffff, alpha: 0.5 });
    }
    
    const bl = -w/2 + 16, bt = -h/2 + 14, brLen = 14, brR = w/2 - 16;
    function bracket(col, ox, oy, a){
      fbBg.moveTo(bl+ox, bt+brLen+oy).lineTo(bl+ox, bt+oy).lineTo(bl+brLen+ox, bt+oy).stroke({ color: col, width: 1.4, alpha: a });
      fbBg.moveTo(bl+ox, h/2-14-brLen+oy).lineTo(bl+ox, h/2-14+oy).lineTo(bl+brLen+ox, h/2-14+oy).stroke({ color: col, width: 1.4, alpha: a });
      fbBg.moveTo(brR-brLen+ox, bt+oy).lineTo(brR+ox, bt+oy).lineTo(brR+ox, bt+brLen+oy).stroke({ color: col, width: 1.4, alpha: a });
      fbBg.moveTo(brR-brLen+ox, h/2-14+oy).lineTo(brR+ox, h/2-14+oy).lineTo(brR+ox, h/2-14-brLen+oy).stroke({ color: col, width: 1.4, alpha: a });
    }
    if(T.ghost) bracket(T.ghost, -1.6, 0, 0.4);   
    bracket(T.brk, 0, 0, 0.85);
    
    fbBurst.clear();
    for(let i = 1; i <= 3; i++){
      const ly = -h/2 + (h * i / 4);
      fbBurst.rect(-w/2 + r, ly - 0.3, w - r*2, 0.6)
        .fill({ color: T.halo, alpha: 0.06 });
    }
  }

  
  const hud = new PIXI.Container(); stage.addChild(hud);

  const bottomBar = new PIXI.Container(); hud.addChild(bottomBar);
  const bottomBarBg = new PIXI.Graphics(); bottomBar.addChild(bottomBarBg);


  

  
  
  const skin = (typeof window !== 'undefined' && window.__makeSkin) ? window.__makeSkin(PIXI) : null;

  const BAR_FONT = (skin && skin.BAR && skin.BAR.FONT) || "Fredoka, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";

  

  

  if (skin) {
    try {
      const SS = 360, SR = SS * 0.42;   
      const frame = new PIXI.Rectangle(-SS / 2, -SS / 2, SS, SS);
      
      const mkFace = (stop) => {
        const wrap = new PIXI.Container();
        const glow = new PIXI.Graphics();
        skin.spinGlowInto(glow, 0, 0, SR * 1.18);
        wrap.addChild(glow);
        const { face } = skin.buildSpinFace(SR);
        wrap.addChild(face);
        if (stop) {
          
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
    } catch (e) {  }
  }

  

  
  const deliveredBar = (typeof window !== 'undefined' && window.BettingBarMobile)
    ? new window.BettingBarMobile({ bare:true })
    : null;
  if(deliveredBar){
    deliveredBar.visible = false;            
    hud.addChild(deliveredBar);

    
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
      if(!turboAllowed()) return;   
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
      const flipped = Sound.setVolume(v);   
      if(flipped){
        btnSound._icon.texture = tex(State.muted ? 'icMute' : 'icSound');
        btnSound._setActive(!State.muted);
        persistSave();
        syncDeliveredBar();
      }
    });
    deliveredBar.on2('menu', () => openDrawer('settings'));
  }

  

  
  
  const deliveredBarWeb = (typeof window !== 'undefined' && window.BettingBarWeb)
    ? new window.BettingBarWeb({ bare:true })
    : null;
  if(deliveredBarWeb){
    deliveredBarWeb.visible = false;          
    hud.addChild(deliveredBarWeb);
    
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
      if(!turboAllowed()) return;   
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
    
    deliveredBarWeb.on2('volume', (v) => {
      if(STAKE.replay) return;
      const flipped = Sound.setVolume(v);   
      if(flipped){
        btnSound._icon.texture = tex(State.muted ? 'icMute' : 'icSound');
        btnSound._setActive(!State.muted);
        persistSave();
        syncDeliveredBar();
      }
    });
    deliveredBarWeb.on2('menu', () => openDrawer('settings'));

    deliveredBarWeb.on2('betmenu', () => { if(typeof showBetMenu === 'function') showBetMenu(); });

    deliveredBarWeb.on2('bet:set', (idx) => {
      if(State.phase !== Phase.IDLE) return;        
      if(State.autoplay.active) return;
      const i = Math.max(0, Math.min(State.betLevels.length - 1, idx | 0));
      if(i === State.betIdx) return;
      State.betIdx = i;
      State.betX6 = State.betLevels[State.betIdx];
      try { Sound.click(); } catch(e){}
      updateHUD();   
    });
    
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

  
  
  function syncDeliveredBar(){
    if(!deliveredBar && !deliveredBarWeb) return;
    const D = API_AMOUNT_MULTIPLIER;

    const spinning = !!allReelsSpinning;
    if(deliveredBar) try {
      deliveredBar.setBalance(State.balanceX6 / D);
      deliveredBar.setBet(State.betX6 / D);
      deliveredBar.setLastWin((State.lastWinX6 || 0) / D);

      deliveredBar.setCurrency(STAKE.social ? (CUR.social ? CUR.s.trim() : '') : CUR.s.trim());
      deliveredBar.setDemo(/^mock:\/\//.test(_normRgs));   
      deliveredBar.setAffordable(State.balanceX6 >= State.betX6);
      deliveredBar.setSteppers(State.betIdx > 0, State.betIdx < State.betLevels.length - 1);
      deliveredBar.setTurbo(State.turboMode);
      deliveredBar.setAutoplay(State.autoplay.active ? State.autoplay.remaining : null);
      deliveredBar.setSoundOn(!State.muted);
    } catch(e){  }
    
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

      
      const levels = (State.betLevels || []).map(v => v / D);
      deliveredBarWeb.setBetLevels(levels, State.betIdx, (v) => fmtMoney(v * D));
    } catch(e){  }
  }

  
  const btnAuraG = new PIXI.Graphics();
  btnAuraG.blendMode = 'add';
  bottomBar.addChild(btnAuraG);
  const txtStyle = (size,fill,extra) => Object.assign({
    fontFamily:'Luckiest Guy', fontSize:size, fill,
    stroke:{ color:0x2a1140, width:Math.max(2,size*0.13), join:'round' }, align:'center',
  }, extra || {});

  

  
  
  function vcY(fam){ return fam === 'Fredoka' ? 0.543 : 0.527; }

  const balPlaque = spr('balPlate'); hud.addChild(balPlaque);
  const balLabel = new PIXI.Text({ text:'BALANCE', style:txtStyle(11,0xff8ab8), resolution:2 });
  const balValue = new PIXI.Text({ text:'', style:txtStyle(18,0xffffff), resolution:2 });
  balLabel.anchor.set(0.5, vcY('Luckiest Guy')); balValue.anchor.set(0.5, vcY('Luckiest Guy')); hud.addChild(balLabel,balValue);


  
  const betChipG = new PIXI.Graphics(); hud.addChild(betChipG);
  const betPlaque = spr('betPlate'); hud.addChild(betPlaque);
  const betLabel = new PIXI.Text({ text:'BET', style:txtStyle(10,0xff8ab8), resolution:2 });
  const betValue = new PIXI.Text({ text:'', style:txtStyle(18,0xffffff,{ stroke:{ color:0x07070d, width:3, join:'round' } }), resolution:2 });
  betLabel.anchor.set(0.5, vcY('Luckiest Guy')); betValue.anchor.set(0.5, vcY('Luckiest Guy')); hud.addChild(betValue,betLabel);

  

  
  betValue.eventMode = 'static'; betValue.cursor = 'pointer';
  betValue.hitArea = new PIXI.Rectangle(-30, -22, 60, 44);
  betValue.on('pointertap', () => {  });
  betLabel.eventMode = 'static'; betLabel.cursor = 'pointer';
  betLabel.hitArea = new PIXI.Rectangle(-30, -16, 60, 32);
  betLabel.on('pointertap', () => {  });

  const minusBtn = spr('uiMinus'); const plusBtn = spr('uiPlus'); hud.addChild(minusBtn,plusBtn);

  
  minusBtn.tint = 0xf5f7fa;
  plusBtn.tint  = 0xf5f7fa;

  
  
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


  

  

  function makeIconBtn(alias){
    const c = new PIXI.Container();
    const ping = new PIXI.Graphics(); c.addChild(ping); ping.alpha = 0;
    const icon = spr(alias); c.addChild(icon);
    c._icon = icon; c._baseScale = 1;
    c._targetScale = 1; c._displayScale = 1;
    c._hover = false; c._pressed = false; c._active = false;
    
    c._tintTarget = [245, 247, 250];   
    c._tintDisplay = [245, 247, 250];

    
    
    c._activeColor = 0xf5f7fa;
    c._ping = ping; c._pingT0 = 0;
    c.eventMode = 'static'; c.cursor = 'pointer';

    

    

    

    
    c.hitArea = new PIXI.Rectangle(-36, -36, 72, 72);
    function apply(){
      const m = c._pressed ? 0.97 : (c._hover ? 1.06 : 1);
      c._targetScale = c._baseScale * m;
      
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
  
  const autoCount = new PIXI.Text({ text:'', resolution:4, style:{
    fontFamily:'Luckiest Guy', fontSize:64, fill:0xf5f7fa, fontWeight:'700',
    stroke:{ color:0x0a0a0e, width:6, join:'round' }, align:'center' }});
  autoCount.anchor.set(0.5); autoCount.visible=false; autoCount.position.set(0,-4);
  btnAutoplay.addChild(autoCount); btnAutoplay._count = autoCount;

  
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

  const ICON_BTNS = [btnSound,btnTurbo,btnAutoplay,btnInfo,btnSettings,btnHistory,btnFullscreen];

  
  
  btnFullscreen.visible = false; btnFullscreen.eventMode = 'none';
  btnHistory.visible    = false; btnHistory.eventMode    = 'none';


  
  const turboBadge = new PIXI.Graphics();
  turboBadge.visible = false;
  btnTurbo.addChild(turboBadge);

  function refreshTurboBtn(){
    const m = State.turboMode;
    btnTurbo._active = m > 0;

    
    btnTurbo._icon.tint = 0xf5f7fa;
    btnTurbo._icon.alpha = 1.0;
    btnTurbo._activeColor = 0xf5f7fa;

    
    
    const r = (btnTurbo._icon.texture?.width || 32) * 0.08;
    const ox = (btnTurbo._icon.texture?.width || 32) * 0.34;
    const oy = -(btnTurbo._icon.texture?.height || 32) * 0.34;
    turboBadge.clear();
    if(m >= 1){
      
      turboBadge.circle(ox, oy, r*1.50).fill({ color:0x000000, alpha:0.45 });
      turboBadge.circle(ox, oy, r).fill({ color:0xe9bf5a, alpha:1 });   
      if(m === 2){

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

    
    if(STAKE.replay) return;
    State.muted = !State.muted;
    btnSound._icon.texture = tex(State.muted ? 'icMute' : 'icSound');
    btnSound._setActive(!State.muted);
    Sound.setMuted(State.muted);   
    persistSave();
  });
  btnTurbo.on('pointertap', () => {
    
    State.turboMode = (State.turboMode + 1) % 3;
    refreshTurboBtn();
    Sound.click();
    persistSave();

    
    
    if(typeof layout === 'function') layout();
  });
  btnInfo.on('pointertap', () => showInfoModal());
  btnSettings.on('pointertap', () => openDrawer('settings'));
  btnHistory.on('pointertap', () => openDrawer('history'));
  btnAutoplay.on('pointertap', () => {

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


  

  

  
  const winDisplay = new PIXI.Container(); winDisplay.alpha = 0;
  stage.addChildAt(winDisplay, stage.getChildIndex(hud));
  const winFxThrone = new PIXI.Graphics();
  winFxThrone.blendMode = 'normal';
  winDisplay.addChild(winFxThrone);
  const winFxBurst = new PIXI.Graphics();
  winFxBurst.blendMode = 'add';
  winDisplay.addChild(winFxBurst);

  

  

  const winGemG = new PIXI.Graphics();
  winDisplay.addChild(winGemG);
  const winGems = [];   
  
  function _lightenHex(c, f){
    const r=(c>>16)&255, g=(c>>8)&255, b=c&255;
    return ((Math.round(r+(255-r)*f))<<16)|((Math.round(g+(255-g)*f))<<8)|Math.round(b+(255-b)*f);
  }

  

  
  function spawnCascade(tier, cute, mult){
    if(isReduced()) return;
    mult = (mult == null) ? 1 : mult;   
    const W = app.screen.width, H = app.screen.height;
    const n = Math.ceil(((cute ? 16 : 11) + tier*4) * fxScale * mult);
    const cap = _gpuWeak ? 70 : 200;    

    
    
    const pal = cute
      ? [0xff8ad0,0xff5ab0,0xffd9ec,0xff2ad0,0xffffff]
      : [0xff007f,0xff5ab0,0xff2ad0,0xffd9ec,0xffffff];
    const spreadX = Math.min(W*0.52, 440);   
    for(let i=0;i<n;i++){
      if(winGems.length > cap) break;
      const rain = (i%4===0);   
      winGems.push({
        shape: cute ? (i%2 ? 'star':'diamond') : 'diamond',
        x: (vrnd()-0.5)*spreadX,
        y: rain ? -H*0.55 : (H*0.16 + vrnd()*H*0.12),
        vx: (vrnd()-0.5)*(cute?3.2:4.4),
        vy: rain ? (1.1+vrnd()*1.4) : -(7.2 + vrnd()*4.2 + tier*0.5),
        grav: cute ? 0.16 : 0.23,
        life: 1500 + vrnd()*1100,
        t: -(i % 6) * 26,   
        color: pal[(vrnd()*pal.length)|0],
        r: (cute?6:7) + vrnd()*5,
        rot: vrnd()*6.283, spin: (vrnd()-0.5)*(cute?0.16:0.12),
      });
    }
  }

  

  
  const winFrame = spr('frameWin');
  winFrame.visible = false;
  winFrame.alpha = 0;
  winDisplay.addChild(winFrame);

  

  

  

  
  const winRibbonG = new PIXI.Graphics();   
  winDisplay.addChild(winRibbonG);
  const bigWinLabel = new PIXI.Text({ text:'WIN', resolution:3, style:{
    fontFamily:'Luckiest Guy', fontSize:22, fill:0xf5f7fa, letterSpacing:6,
  }});
  const bigWinAmount = new PIXI.Text({ text:'', resolution:4, style:{
    fontFamily:'Luckiest Guy', fontSize:64, fill:0xf5f7fa, letterSpacing:1.5,

    
    
    stroke:{ color:0x0a0a14, width:5, join:'round' },
    dropShadow: { alpha: 0.55, blur: 8, distance: 3, color: 0x4d0030 },
  }});
  const bigWinMult = new PIXI.Text({ text:'', resolution:3, style:{
    fontFamily:'Fredoka', fontSize:13, fill:0xf5f7fa, letterSpacing:4, fontWeight:'700',
  }});
  bigWinLabel.anchor.set(0.5, vcY('Luckiest Guy')); bigWinAmount.anchor.set(0.5, vcY('Luckiest Guy')); bigWinMult.anchor.set(0.5, vcY('Fredoka'));
  bigWinMult.alpha = 0.65;
  winDisplay.addChild(bigWinLabel, bigWinAmount, bigWinMult);
  
  const winUnderlineG = new PIXI.Graphics();
  winDisplay.addChild(winUnderlineG);



  
  const buyBar = new PIXI.Container(); hud.addChild(buyBar);
  buyBar.eventMode = 'static'; buyBar.cursor = 'pointer';
  const buyBg = spr('buyPlate'); buyBar.addChild(buyBg);   

  
  
  const buyIcon = new PIXI.Sprite(TEX['s7']); buyIcon.anchor.set(0.5);
  buyBar.addChild(buyIcon);
  const buyTitle = new PIXI.Text({ text:'BUY BONUS', resolution:3, style:{
    fontFamily:'Luckiest Guy', fontSize:18, fill:0xffffff,
    letterSpacing:1.2, stroke:{ color:0x2a0a1e, width:2.5, join:'round' }   
  }});
  const buyCost = new PIXI.Text({ text:'', resolution:3, style:{
    fontFamily:'Luckiest Guy', fontSize:18, fill:0xffe6f4,   
    letterSpacing:0.8, stroke:{ color:0x2a0a1e, width:2, join:'round' }
  }});
  buyTitle.anchor.set(0.5); buyCost.anchor.set(0.5);
  buyBar.addChild(buyTitle,buyCost);
  buyBar._baseScale = 1; buyBar._pulse = 0;
  if(!COMPLY.allow_buy_bonus || STAKE.replay) buyBar.visible = false;


  

  

  

  

  const NATIVE_BAR_INTERACTIVE = [spinBtn, minusBtn, plusBtn, btnSound, btnTurbo, btnAutoplay, btnInfo, btnSettings, buyBar];
  const NATIVE_BAR_TEXT = [balLabel, balValue, betLabel, betValue, winLabel, winValue];
  const NATIVE_BAR_LEGACY = [balPlaque, betPlaque, winPlaque, betChipG, spinHalo];

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

    if(!on) NATIVE_BAR_LEGACY.forEach(o => { if(o) o.visible = false; });
    
    if(on){ betValue.eventMode = 'static'; betLabel.eventMode = 'static'; }
    else  { betValue.eventMode = 'none';   betLabel.eventMode = 'none'; }
    
    btnHistory.visible = false; btnFullscreen.visible = false;
  }


  

  const bonusFxG = new PIXI.Graphics(); bonusFxG.blendMode = 'normal'; stage.addChild(bonusFxG);


  

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
  
  const bonusHudText = new PIXI.Text({ text:'', resolution:3, style:{
    fontFamily:'Luckiest Guy', fontSize:18, fill:0xffe6f4,   
    stroke:{ color:0x2a1140, width:3, join:'round' }, align:'center',
  }});
  bonusHudText.anchor.set(0.5, vcY('Luckiest Guy'));
  bonusHudText.alpha = 0;
  stage.addChild(bonusHudText);

  
  
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

  const bonusWildLabel = new PIXI.Text({ text:'WILD REEL', resolution:3, style:{
    fontFamily:'Fredoka', fontSize:11, fill:0xf5f7fa, letterSpacing:3,
    fontWeight:'700', align:'center',
  }});
  bonusWildLabel.anchor.set(0.5);
  bonusWildLabel.visible = false;
  stage.addChild(bonusWildLabel);

  
  const bonusLockLabel = new PIXI.Text({ text:'LOCKED', resolution:3, style:{
    fontFamily:'Fredoka', fontSize:9, fill:0xf5f7fa, letterSpacing:2.5,
    fontWeight:'700', align:'center',
  }});
  bonusLockLabel.anchor.set(0.5);
  bonusLockLabel.visible = false;
  stage.addChild(bonusLockLabel);

  

  const _flyUpPool = [];
  for(let i = 0; i < 8; i++){
    const t = new PIXI.Text({ text:'+'+fmtMoney(0), resolution:2, style:{   
      fontFamily:'Luckiest Guy', fontSize:22, fill:0xff8ad0,   

      
      
      stroke:{ color:0x06060c, width:3, join:'round' },
    }});
    t.anchor.set(0.5);
    t.label = 'flyUp·winAmount(pool)';   
    t.visible = false;
    t.renderable = false;          
    t.position.set(-9999, -9999);  
    t.alpha = 0;                   
    t._busy = false;
    t._t0 = 0;
    t._startY = 0;
    t._cx = 0;
    stage.addChild(t);
    _flyUpPool.push(t);
  }
  function spawnFlyUpAmount(cx, cy, amountX6){
    // (removed a leftover debug `return;` that disabled fly-up "+amount" win text)
    if(isReduced() || amountX6 <= 0) return;
    const t = _flyUpPool.find(x => !x._busy);
    if(!t) return;   
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
      
      const float = (1 - Math.pow(1 - p, 3)) * (CELL * 1.4);
      t.position.set(t._cx, t._startY - float);
      t.scale.set(scale);
      t.alpha = alpha;
    }
  }
  
  let _bonusState = {
    active: false,
    mode: 'bonus_standard',
    wildReel: null,
    stickyCrowns: false,
    stickyMap: [],        
    spinNum: 0,
    totalSpins: 0,
    spinMult: 1,
    totalMult: 0,         
    revealedMultT0: 0,    
  };

  
  const particles = [];
  const particleG = new PIXI.Graphics(); particleG.blendMode = 'add'; stage.addChild(particleG);

  

  
  
  const _ignites = [];
  const bonusIgniteG = new PIXI.Graphics(); bonusIgniteG.blendMode = 'add'; stage.addChild(bonusIgniteG);

  

  
  
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
    const R0 = Math.min(GW, GH) * 0.5;          
    
    if(el < 240){
      const p = el/240;
      for(let k=0;k<14;k++){
        const a  = (k/14)*Math.PI*2 + p*0.8;
        const r1 = R0*(1.7 - 1.1*p);             
        const r0 = R0*(1.2 - 0.95*p);            
        fsPortalG.moveTo(cx+Math.cos(a)*r1, cy+Math.sin(a)*r1)
                 .lineTo(cx+Math.cos(a)*r0, cy+Math.sin(a)*r0)
                 .stroke({ color:0xff5ab0, width:2.2, alpha:0.42*p });
      }
      fsPortalG.circle(cx, cy, R0*(0.08+0.18*p)).fill({ color:0xffffff, alpha:0.18+0.40*p });
    }
    
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

        if(el >= 220 && el < 380){
          const p  = (el-220)/160;
          const fl = Math.sin(p*Math.PI);                 
          bonusIgniteG.circle(c.x, c.y, CELL*(0.35+1.05*p)).fill({ color:0xff2f9f, alpha:0.16*fl })   
                      .circle(c.x, c.y, CELL*(0.20+0.55*p)).fill({ color:0xff2f9f, alpha:0.30*fl })
                      .circle(c.x, c.y, CELL*(0.10+0.34*p)).fill({ color:0xffffff, alpha:0.78*fl });   
          for(let k = 0; k < 8; k++){
            const a = (k/8)*Math.PI*2, len = CELL*(0.55+1.05*p);
            bonusIgniteG.moveTo(c.x, c.y).lineTo(c.x+Math.cos(a)*len, c.y+Math.sin(a)*len)
                        .stroke({ color:0xfff4fb, width:3.4*(1-p), alpha:0.65*fl });
          }
        }

        
        
        if(el >= 320){
          const p = Math.min(1, (el-320)/830);
          const e = 1 - Math.pow(1-p, 3);                 
          const R = CELL*0.25 + e*CELL*2.05;
          const a = (1-p)*(1-p)*0.95;
          const w = (1-p)*6.5 + 1.0;
          bonusIgniteG.circle(c.x, c.y, R+4).stroke({ color:0xff2f9f, width:w,      alpha:a*0.85 })   
                      .circle(c.x, c.y, R+1).stroke({ color:0xffffff, width:w*0.5,  alpha:a       })   
                      .circle(c.x, c.y, R  ).stroke({ color:0xfff4fb, width:w*0.9,  alpha:a*0.9   })   
                      .circle(c.x, c.y, R-4).stroke({ color:0x37e6ff, width:w*0.75, alpha:a*0.7   });  
          if(p < 0.5){
            const bp = 1 - p*2;
            bonusIgniteG.circle(c.x, c.y, R*0.9).fill({ color:0xff2f9f, alpha:0.07*bp });
          }
        }
      }
    }
  }
  function spawnParticles(cx,cy,count,tier){

    

    

    
    
    if(performance.now() < _silenceUntil) return;
    if(window.innerWidth < 600 || window.innerHeight < 600){
      count = Math.ceil(count * 0.75);
    }
    count = Math.ceil(count * 1.6 * fxScale);   

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
        
        r: 1.8 + vrnd()*2.0,
        spin: (vrnd()-0.5) * 0.05,
        rot: 0,
      });
    }
  }
  let shakeAmount = 0, shakeT0 = 0;

  
  let _camPushT0 = 0;
  const _camPushDur = 1500;

  
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


  

  

  function drawGlossyBtn(g, w, h, kind){
    const hw = w / 2, hh = h / 2, r = h * 0.45;

    const gold = kind === 'primary-gold' || kind === 'secondary-gold';
    g.clear();
    if(kind === 'secondary' || kind === 'secondary-gold'){
      const sheen = gold ? 0xe9bf5a : 0xff5ab0, rim = gold ? 0xf0d089 : 0xff8ad0;
      g.roundRect(-hw, -hh, w, h, r).fill({ color: 0x140d1c, alpha: 0.96 })               
       .roundRect(-hw + 1, -hh + 1, w - 2, h * 0.5, r).fill({ color: sheen, alpha: 0.06 })  
       .roundRect(-hw, -hh, w, h, r).stroke({ color: rim, width: 1.3, alpha: 0.55 });  
    } else {
      const bloom = gold ? 0xc9a24a : 0xff007f, body = gold ? 0xba852d : 0xd11a78,
            sheen = gold ? 0xf0d089 : 0xff5ab0, rim = gold ? 0xfadf8e : 0xff8ad0;
      g.roundRect(-hw - 2, -hh - 2, w + 4, h + 4, r + 1).fill({ color: bloom, alpha: 0.22 })  
       .roundRect(-hw, -hh, w, h, r).fill({ color: body, alpha: 1 })                    
       .roundRect(-hw + 1, -hh + 1, w - 2, h * 0.52, r).fill({ color: sheen, alpha: 0.55 })  
       .roundRect(-hw + 6, -hh + 2, w - 12, 1.4, 0.7).fill({ color: 0xffffff, alpha: 0.5 })  
       .roundRect(-hw, -hh, w, h, r).stroke({ color: rim, width: 1.5, alpha: 1 });     
    }
  }


  

  
  const SURF = Object.freeze({
    chrome: { accent: 0xff7ad0, bright: 0xffc8ef, tint: 0x6e3aa8, radius: 18, titleDivAt: 44 },
    scrim:  0x0e0722,  scrimA: 0.82,
    title:    0xffc8ef, heading:  0xffc8ef, value:    0xfff2fb, label:    0xfdf2ff,
    muted:    0xb89cd8, accent:   0xff7ad0, accentHi: 0xff5ab0, link:     0x8be4ff,
    win:      0x52d189, loss: 0xff6b6b,
    tileBg:   0x19103e, tileBgHover: 0x2e1c58, pillOff:  0x251544, pillStroke: 0x6e3aa8,
    family:   'Fredoka', familyDisplay: 'Luckiest Guy',
  });
  
  function drawSurfChrome(g, w, h, opts){
    opts = opts || {};
    drawPanelChrome(g, w, h, {
      accent: SURF.chrome.accent, bright: SURF.chrome.bright, tint: SURF.chrome.tint,
      radius: opts.radius != null ? opts.radius : SURF.chrome.radius,
      titleDivAt: opts.titleDivAt != null ? opts.titleDivAt : SURF.chrome.titleDivAt,
    });
  }
  
  function drawSurfScrim(g, W, H){
    g.clear().rect(0,0,W,H).fill({ color: SURF.scrim, alpha: SURF.scrimA });
  }


  

  
  
  function drawPanelChrome(g, w, h, opts){
    opts = opts || {};
    const r = opts.radius != null ? opts.radius : 18;
    const accent = opts.accent != null ? opts.accent : 0xff007f;        
    const bright = opts.bright != null ? opts.bright : 0xff8ad0;        
    const tint   = opts.tint   != null ? opts.tint   : 0x9a3bd6;        
    const titleDivAt = opts.titleDivAt != null ? opts.titleDivAt : 44;  

    

    
    const violet = tint, magBright = bright;
    g.clear()
      
      .roundRect(-w/2-18, -h/2-14, w+36, h+32, r+6).fill({ color: accent, alpha: 0.035 })
      .roundRect(-w/2-11, -h/2-8,  w+22, h+20, r+3).fill({ color: accent, alpha: 0.07 })
      .roundRect(-w/2-5,  -h/2-3,  w+10, h+10, r+1).fill({ color: accent, alpha: 0.11 })
      
      .roundRect(-w/2-2, -h/2+7, w+4, h+10, r+2).fill({ color: 0x000000, alpha: 0.5 })
      
      .roundRect(-w/2, -h/2, w, h, r).fill({ color: 0x0b0814, alpha: 0.96 })

      
      .roundRect(-w/2+1, -h/2+1, w-2, h-2, Math.max(0,r-2)).fill({ color: violet, alpha: 0.05 })
      .roundRect(-w/2+1, -h/2+h*0.55, w-2, h*0.45-1, Math.max(0,r-2)).fill({ color: accent, alpha: 0.05 })
      
      .roundRect(-w/2+1, -h/2+1, w-2, h*0.30, Math.max(0,r-2)).fill({ color: 0x9fc8ff, alpha: 0.06 })
      .roundRect(-w/2+1, -h/2+1, w-2, h*0.13, Math.max(0,r-2)).fill({ color: 0xffffff, alpha: 0.055 })
      
      .roundRect(-w/2+14, -h/2+2, w-28, 1.2, 0.6).fill({ color: 0xffe6f4, alpha: 0.55 })
      
      .roundRect(-w/2-1.2, -h/2, w, h, r).stroke({ color: 0x7fe7ff, width: 1.2, alpha: 0.16 })
      .roundRect(-w/2, -h/2, w, h, r).stroke({ color: accent, width: 1.8, alpha: 0.95 })
      .roundRect(-w/2+1, -h/2+1, w-2, h-2, Math.max(0,r-1)).stroke({ color: magBright, width: 0.8, alpha: 0.45 })
      .roundRect(-w/2, -h/2, w, h, r).stroke({ color: 0xffe9f5, width: 0.5, alpha: 0.3 });
    
    g.roundRect(-w*0.34, h/2-3.4, w*0.68, 3.2, 1.6).fill({ color: accent, alpha: 0.18 })
     .roundRect(-w*0.32, h/2-2.8, w*0.64, 1.7, 0.85).fill({ color: magBright, alpha: 0.95 });
    if(titleDivAt){
      g.rect(-w*0.42, -h/2+titleDivAt-0.4, w*0.84, 1.6).fill({ color: accent, alpha: 0.16 })
       .rect(-w*0.40, -h/2+titleDivAt, w*0.80, 1.0).fill({ color: magBright, alpha: 0.7 });
    }
  }


  

  

  const CLOSE_R = 17, CLOSE_INSET = 26, CLOSE_TEX = 40;   
  function styleClose(container, icon, halfW, halfH){
    if(!container._bg){
      container._bg = new PIXI.Graphics();
      container.addChildAt(container._bg, 0);            
    }
    container._bg.clear()
      .circle(0, 0, CLOSE_R).fill({ color: 0x0a0912, alpha: 0.94 })
      .circle(0, 0, CLOSE_R).stroke({ color: SURF.accent, width: 1.3, alpha: 0.9 })    
      .circle(0, 0, CLOSE_R - 3).stroke({ color: SURF.accentHi, width: 0.8, alpha: 0.30 }); 
    if(icon && icon.texture && icon.texture.width){
      if(icon.anchor) icon.anchor.set(0.5);
      icon.scale.set(CLOSE_TEX / icon.texture.width);
      icon.position.set(0, 0);
    }
    container.position.set(halfW - CLOSE_INSET, -halfH + CLOSE_INSET);

    
    
    const _pf = (container.parent && container.parent._fitScale) ? container.parent._fitScale : 1;
    const _hr = 22 / _pf;
    container.hitArea = new PIXI.Rectangle(-_hr, -_hr, 2*_hr, 2*_hr);
  }


  

  const BONUS_TIERS = [
    {
      id: 'bonus_standard',
      name: 'STANDARD',
      mult: 23.82,   
      spins: 10,
      xmult: '×3',
      special: '+5 SPINS on RE-TRIGGER',
      accent: 0xc8326f,    
      glow: 0xc8326f,
    },
    {
      id: 'bonus_hot',
      name: 'HOT',
      mult: 121.29,   
      spins: 6,
      xmult: '×3',
      special: 'WILD MIDDLE REEL',
      accent: 0xff5a9c,    
      glow: 0xff5a9c,
    },
    {
      id: 'bonus_mega',
      name: 'MEGA',
      mult: 173.57,   
      spins: 10,
      xmult: '×2..×10',
      special: 'STICKY CROWNS',
      accent: THEME.colors.pink,            
      glow: 0xff5a9c,
    },
  ];
  let _selectedTier = 0;   


  

  const modalScrimG = new PIXI.Graphics(); modalScrimG.alpha = 0; stage.addChild(modalScrimG);
  function drawModalScrim(){
    const W = app.screen.width, H = app.screen.height;
    modalScrimG.clear();
    modalScrimG.rect(0, 0, W, H).fill({ color: 0x05030a, alpha: 1 });
    
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

  
  const tierCards = BONUS_TIERS.map((tier, i) => {
    const c = new PIXI.Container();
    c.eventMode = 'static'; c.cursor = 'pointer';
    c._tier = tier; c._tierIdx = i;
    const bg = new PIXI.Graphics(); c.addChild(bg); c._bg = bg;

    
    const vfx = new PIXI.Graphics(); vfx.blendMode = 'add'; c.addChild(vfx); c._vfx = vfx;
    
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
  
  const bmCancel  = makeModalBtn(buyModalCard,'CANCEL', 0x1f1c2e, 0xf5f7fa);
  const bmConfirm = makeModalBtn(buyModalCard,'BUY',    0xff5a9c, 0xf5f7fa);

  
  const buyClose = new PIXI.Container(); buyClose.eventMode='static'; buyClose.cursor='pointer';
  const buyCloseIcon = spr('icClose'); buyClose.addChild(buyCloseIcon);
  buyModalCard.addChild(buyClose);


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

  
  const bmRowSpins = { visible:false, _lbl:{text:''}, _val:{text:''}, position:{set(){}} };
  const bmRowCost  = { visible:false, _lbl:{text:''}, _val:{text:''}, position:{set(){}} };
  const bmRowRTP   = { visible:false, _lbl:{text:''}, _val:{text:''}, position:{set(){}} };
  const bmRowMax   = { visible:false, _lbl:{text:''}, _val:{text:''}, position:{set(){}} };


  

  

  

  

  

  

  
  
  const _modalTok = new WeakMap();
  const _modalBaseY = new WeakMap();
  
  const easeVaul = (p) => {

    const t = p;
    return 1 - Math.pow(1 - t, 4) * (1 + t * 0.3);
  };
  
  const easeSharp = (p) => p * p;
  
  const easeSpring = (p) => {
    if(p >= 1) return 1;
    return 1 - Math.exp(-7 * p) * Math.cos(p * Math.PI * 1.6);
  };
  function modalIn(card, bg){
    const tok=(_modalTok.get(card)||0)+1; _modalTok.set(card,tok);

    
    
    const baseY = card.y || 0;
    _modalBaseY.set(card, baseY);

    
    const tgt = card._fitScale || 1;
    if(isReduced()){
      card.scale.set(tgt); card.alpha=1; bg.alpha=1; card.y = baseY;
      return;
    }
    bg.alpha = 0;
    card.alpha = 0;
    card.scale.set(0.92 * tgt);
    card.y = baseY + 14;   
    const t0 = performance.now();
    const bgDur = 320;       
    const cardDelay = 100;   
    const cardDur = 360;     
    const totalDur = cardDelay + cardDur;
    (function step(){
      if(_modalTok.get(card) !== tok) return;
      const el = performance.now() - t0;
      
      const bgP = Math.min(1, el / bgDur);
      bg.alpha = easeVaul(bgP);
      
      const cardEl = Math.max(0, el - cardDelay);
      const cardP = Math.min(1, cardEl / cardDur);
      
      card.alpha = Math.min(1, easeVaul(cardP) * 1.4);
      
      card.scale.set(tgt * (0.92 + 0.08 * easeSpring(cardP)));
      
      card.y = baseY + 14 * (1 - easeVaul(cardP));
      if(el < totalDur) requestAnimationFrame(step);
      else { card.scale.set(tgt); card.alpha = 1; bg.alpha = 1; card.y = baseY; }
    })();
  }
  function modalOut(card, bg, done){
    const tok=(_modalTok.get(card)||0)+1; _modalTok.set(card,tok);
    const baseY = _modalBaseY.has(card) ? _modalBaseY.get(card) : (card.y || 0);
    const tgt = card._fitScale || 1;   
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
      
      const e = easeSharp(p);
      bg.alpha   = ba0 * (1 - easeVaul(p));        
      card.alpha = ca0 * (1 - e);
      card.scale.set(cs0 - (cs0 - 0.96 * tgt) * e);
      
      card.y = cy0 + 8 * e;
      if(p < 1) requestAnimationFrame(step);
      else {
        card.scale.set(1); card.alpha = 1; bg.alpha = 1; card.y = baseY;
        done && done();
      }
    })();
  }
  function modalSnap(card, bg){

    

    
    _modalTok.set(card, (_modalTok.get(card) || 0) + 1);
    card.scale.set(card._fitScale || 1); card.alpha = 1; bg.alpha = 1;
    _modalBaseY.set(card, card.y || 0);
  }
  function bonusCostX6(tierIdx){
    return Math.round(State.betX6 * BONUS_TIERS[tierIdx].mult);
  }
  function layoutBuyModal(){
    const W=app.screen.width, H=app.screen.height;

    
    buyModalBg.clear().rect(0,0,W,H).fill({ color:0x05050a, alpha:0.75 });

    

    const portrait = H > W*1.05;
    const cardW = portrait ? Math.min(360, W*0.92) : Math.min(580, W*0.88);
    
    const cardH = portrait ? 540 : 420;

    

    
    const _maxH = H - 16, _maxW = W - 16;
    const _fit  = Math.min(1, _maxH / cardH, _maxW / cardW);
    buyModalCard._fitScale = _fit;
    buyModalCard.scale.set(_fit);
    buyModalCard.position.set(W/2,H/2);

    
    const _minPx = (basePx, screenMin = 11) => Math.max(basePx, screenMin / Math.max(0.3, _fit));
    bmTitle.style.fontSize = _minPx(22, 16);   
    bmDesc.style.fontSize  = _minPx(12);
    bmWarn.style.fontSize  = _minPx(10);

    

    

    

    

    

    

    
    bmCardBg.clear();
    if (window.__glassInto) {
      // Wave 1: premium candy-glass card (unified with the rebuilt betting bar).
      window.__glassInto(bmCardBg, cardW, cardH, 18, { x: -cardW / 2, y: -cardH / 2, fill: [[0, '#553597'], [0.5, '#301d5e'], [1, '#160d37']], edge: 0xff77cf, edgeWidth: 2 });
    } else bmCardBg

      .roundRect(-cardW/2-10, -cardH/2-7, cardW+20, cardH+18, 22)
      .fill({ color: 0xff007f, alpha: 0.05 })
      .roundRect(-cardW/2-4, -cardH/2-2, cardW+8, cardH+8, 19)
      .fill({ color: 0xff007f, alpha: 0.11 })
      
      .roundRect(-cardW/2-2, -cardH/2+6, cardW+4, cardH+10, 20)
      .fill({ color: 0x000000, alpha: 0.70 })
      
      .roundRect(-cardW/2, -cardH/2, cardW, cardH, 18)
      .fill({ color: 0x07070d, alpha: 0.98 })
      
      .roundRect(-cardW/2+1, -cardH/2+1, cardW-2, cardH*0.26, 16)
      .fill({ color: 0xff007f, alpha: 0.06 })
      
      .roundRect(-cardW/2+14, -cardH/2+1.5, cardW-28, 0.8, 0.4)
      .fill({ color: 0xf5f7fa, alpha: 0.65 })
      
      .roundRect(-cardW/2, -cardH/2, cardW, cardH, 18)
      .stroke({ color: 0xff007f, width: 1.5, alpha: 0.80 })
      
      .roundRect(-cardW/2+3, -cardH/2+3, cardW-6, cardH-6, 15)
      .stroke({ color: 0x000000, width: 0.7, alpha: 0.55 });
    
    const brR = 14, brLen = 18;
    [[-cardW/2+brR, -cardH/2+brR, 1, 1],
     [ cardW/2-brR,  cardH/2-brR,-1,-1]].forEach(([cx,cy,sx,sy]) => {
      bmCardBg.moveTo(cx, cy + sy*brLen).lineTo(cx, cy).lineTo(cx + sx*brLen, cy)
        .stroke({ color: 0xff007f, width: 1.3, alpha: 0.80 });
    });
    bmTitle.position.set(0,-cardH/2+22);
    bmDesc.position.set(0,-cardH/2+56);

    
    bmDesc.text = socialFilter('Choose your bonus tier.');

    bmWarn.text = socialFilter('Buy Bonus may not be available in all\njurisdictions. Please play responsibly.');

    bmWarn.text = socialFilter('Buy Bonus may not be available in all\njurisdictions. Please play responsibly.');


    
    const isPortraitNow = portrait;
    const tierGap = 12;
    const cardsAreaY = -cardH/2 + 90;
    if(isPortraitNow){
      const tcW = cardW * 0.86;

      const tcH = 86;
      const tighterGap = 8;
      tierCards.forEach((tc, i) => {
        const cx = 0;
        const cy = cardsAreaY + i * (tcH + tighterGap) + tcH/2;
        renderTierCard(tc, cx, cy, tcW, tcH, i === _selectedTier);
      });
    } else {
      const tcW = (cardW * 0.88) / 3 - tierGap * 0.6;

      
      const tcH = 176;
      const totalW = tcW*3 + tierGap*2;
      tierCards.forEach((tc, i) => {
        const cx = -totalW/2 + tcW*(i + 0.5) + tierGap*i;
        const cy = cardsAreaY + tcH/2;
        renderTierCard(tc, cx, cy, tcW, tcH, i === _selectedTier);
      });
    }

    const stepRowY = cardH/2 - 110;
    bmBetLabel.position.set(0, stepRowY - 22);
    bmBetValue.text = fmtMoney(State.betX6);
    bmBetValue.position.set(0, stepRowY + 4);
    const stepBtnSz = 36;
    const stepGap = 8;
    const valueHalfW = Math.max(40, bmBetValue.width/2 + 8);
    
    [bmMinus, bmPlus].forEach((b, i) => {
      const sign = i === 0 ? -1 : 1;
      b.position.set(sign * (valueHalfW + stepBtnSz/2 + stepGap), stepRowY + 4);
      const affordable = (i === 0) ? State.betIdx > 0
                                   : State.betIdx < State.betLevels.length - 1;
      
      b._bg.clear()
        .circle(0, 0, stepBtnSz/2 + 1)
        .fill({ color:0x000000, alpha:0.35 })   
        .circle(0, 0, stepBtnSz/2)
        .fill({ color: affordable ? 0xff5a9c : 0x1f1c2e, alpha: 0.95 })
        .circle(0, 0, stepBtnSz/2)
        .stroke({ color: affordable ? 0xff8ab8 : 0x3d3d4e,
                  width: 1.4, alpha: 0.9 })

        .moveTo(Math.cos(Math.PI*1.18) * (stepBtnSz/2 - 2),
                Math.sin(Math.PI*1.18) * (stepBtnSz/2 - 2))
        .arc(0, 0, stepBtnSz/2 - 2, Math.PI*1.18, Math.PI*1.82)
        .stroke({ color:0xffffff, width:0.8, alpha: affordable ? 0.4 : 0.2 });
      b.alpha = affordable ? 1 : 0.5;
      b.eventMode = affordable ? 'static' : 'none';
      b._t.style.fill = affordable ? 0xffffff : THEME.colors.textMuted;
    });


    
    bmWarn.position.set(0, cardH/2 - 92);

    
    const btnH = 44, btnY = cardH/2 - 30;
    const cancelW = cardW * 0.26;
    const confirmW = cardW * 0.56;
    const btnGap = 10;

    
    const confirmFontSize = portrait ? 14 : 15;
    bmConfirm._t.style.fontSize = confirmFontSize;

    
    
    bmConfirm._t.style.stroke = { color: 0x300d28, width: 0.6, join: 'round' };
    bmConfirm._t.style.fontWeight = '700';
    bmConfirm._t.style.letterSpacing = 0.6;
    bmConfirm._t.scale.set(1);
    drawGlossyBtn(bmCancel._bg, cancelW, btnH, 'secondary');
    const totalBtnsW = cancelW + btnGap + confirmW;
    bmCancel.position.set(-totalBtnsW/2 + cancelW/2, btnY);
    drawGlossyBtn(bmConfirm._bg, confirmW, btnH, 'primary');
    bmConfirm.position.set(totalBtnsW/2 - confirmW/2, btnY);

    
    
    {
      const _bfh = Math.max(btnH, 44 / _fit);
      const _bcw = Math.max(cancelW,  44 / _fit);
      const _bxw = Math.max(confirmW, 44 / _fit);
      bmCancel.hitArea  = new PIXI.Rectangle(-_bcw/2, -_bfh/2, _bcw, _bfh);
      bmConfirm.hitArea = new PIXI.Rectangle(-_bxw/2, -_bfh/2, _bxw, _bfh);
    }
    styleClose(buyClose, buyCloseIcon, cardW/2, cardH/2);   

    const innerW = confirmW - 18;
    if(bmConfirm._t.width > innerW){
      bmConfirm._t.scale.set(innerW / bmConfirm._t.width);
    }
  }

  function renderTierCard(tc, cx, cy, w, h, selected){
    tc.position.set(cx, cy);
    tc.hitArea = new PIXI.Rectangle(-w/2, -h/2, w, h);

    
    
    const r = 14;
    tc._bg.clear();

    

    
    
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
      
      .roundRect(-w/2-2, -h/2+3, w+4, h+4, r+1)
      .fill({ color:0x000000, alpha: selected ? 0.55 : 0.35 })
      
      .roundRect(-w/2, -h/2, w, h, r)
      .fill({ color: selected ? 0x3a2566 : 0x241544, alpha: 0.97 })
      
      .roundRect(-w/2+1, -h/2+1, w-2, h*0.5, r-1)
      .fill({ color: tc._tier.accent, alpha: selected ? 0.22 : 0.10 })
      
      .roundRect(-w/2+10, -h/2+4, w-20, 1.4, 1)
      .fill({ color:0xffffff, alpha: selected ? 0.7 : 0.35 })
      
      .roundRect(-w/2, -h/2, w, h, r)
      .stroke({
        color: tc._tier.accent,
        width: selected ? 2.6 : 1.2,
        alpha: selected ? 1 : 0.55,
      })

      
      
      ;

    
    
    const compact = h < 120;
    const badgeR  = compact ? Math.min(28, h*0.30) : Math.min(50, h*0.26);
    const badgeCY = compact ? (-h/2 + h*0.28)      : (-h/2 + h*0.26);
    const badgeA  = selected ? 1 : 0.85;
    tc._badgeCY = badgeCY; 
    tc._badgeR  = badgeR;

    
    if(!compact){
      const _ih = h * 0.10;
      
      for(let i = 1; i <= 3; i++){
        tc._bg.roundRect(-w/2+5, -h/2+5+(i-1)*1.6, w-10, _ih*(1.05 - i*0.18), Math.max(2, 14-3))
          .fill({ color: 0xf5f7fa, alpha: 0.05 - i*0.012 });
      }
      
      for(let i = 1; i <= 2; i++){
        tc._bg.rect(-w/2+5, h/2-_ih-(i-1)*2, w-10, _ih * 0.65)
          .fill({ color: 0x05020a, alpha: 0.10 - i*0.02 });
      }
    }

    if(selected){
      
      tc._bg.circle(-1.5, badgeCY, badgeR + 4)
        .stroke({ color: 0x7fe7ff, width: 2.2, alpha: 0.55 });
      tc._bg.circle(1.5, badgeCY, badgeR + 4)
        .stroke({ color: 0xff007f, width: 2.2, alpha: 0.60 });
      
      tc._bg.circle(0, badgeCY, badgeR + 10)
        .fill({ color: tc._tier.accent, alpha: 0.10 })
        .circle(0, badgeCY, badgeR + 5)
        .fill({ color: tc._tier.accent, alpha: 0.20 });
    }
    
    tc._bg
      .circle(0, badgeCY, badgeR)
      .fill({ color: 0x0a0a0e, alpha: 0.96 })
      .circle(0, badgeCY, badgeR)
      .stroke({ color: tc._tier.accent, width: selected ? 2.8 : 1.8, alpha: badgeA });
    
    if(!tc._symSpr){
      const tierTex = tc._tierIdx === 0 ? TEX.tierStd : tc._tierIdx === 1 ? TEX.tierHot : TEX.tierMega;
      const ss = new PIXI.Sprite(tierTex);
      ss.anchor.set(0.5);
      tc.addChild(ss);
      tc._symSpr = ss;
    }
    
    const symMax = badgeR * 1.70;
    const symK = symMax / Math.max(tc._symSpr.texture.width, tc._symSpr.texture.height);
    tc._symSpr.scale.set(symK);
    tc._symSpr.position.set(0, badgeCY);
    tc._symSpr.alpha = selected ? 1 : 0.94;

    
    tc._name.style.fontSize = compact ? 14 : 17;
    tc._name.position.set(0, -h/2 + (compact ? h*0.62 : h*0.55));
    tc._cost.text = fmtMoney(bonusCostX6(tc._tierIdx));

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
      
      tc._special.style.wordWrapWidth = w * 0.88;
    }
  }


  

  
  function drawTierVfx(tc, now, selected){
    const vfx = tc._vfx;
    if(!vfx) return;
    vfx.clear();
    if(isReduced()) return;
    const cy = tc._badgeCY;
    const r  = tc._badgeR;
    if(!r || r < 8) return; 
    const intensity = selected ? 1 : 0.45;
    
    if(selected){
      const ringR = r + 7;
      for(let i = 0; i < 10; i++){
        const a = (now * 0.0008) + i * (Math.PI / 5);
        const px = Math.cos(a) * ringR, py = cy + Math.sin(a) * ringR;
        const tw = 0.45 + 0.55 * Math.sin(now * 0.006 + i * 0.7);
        vfx.circle(px, py, 1.8).fill({ color: tc._tier.glow, alpha: 0.55 * tw });
      }
    }
    
    if(tc._tierIdx === 0){
      
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
      
      const EMBERS = selected ? 14 : 7;
      for(let i = 0; i < EMBERS; i++){
        const seed = (i * 137.508) % 1;                                    
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


  
  function buyCostX6(){ return bonusCostX6(_selectedTier); }

  function showBuyBonusModal(){
    if(State.phase !== Phase.IDLE) return;
    if(!COMPLY.allow_buy_bonus || STAKE.replay) return;

    
    
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


  

  const buyFab = new PIXI.Container();
  buyFab.eventMode = 'static'; buyFab.cursor = 'pointer';
  stage.addChild(buyFab);
  const buyFabInner = new PIXI.Container(); buyFab.addChild(buyFabInner);     
  const buyFabAnim  = new PIXI.Container(); buyFabInner.addChild(buyFabAnim); 
  const buyFabPress = new PIXI.Container(); buyFabAnim.addChild(buyFabPress); 
  let buyGlow = null, buyArt = null, buyCm = null;
  if (TEX.buyBonus) {

    buyGlow = new PIXI.Sprite(TEX.buyBonus); buyGlow.anchor.set(0.5);
    buyGlow.blendMode = 'add'; buyGlow.alpha = 0.5; buyGlow.scale.set(1.06);
    const gblur = new PIXI.BlurFilter({ strength: 16, quality: 3 }); gblur.padding = 60;
    buyGlow.filters = [gblur];
    buyFabPress.addChild(buyGlow);
    buyArt = new PIXI.Sprite(TEX.buyBonus); buyArt.anchor.set(0.5);
    buyCm = new PIXI.ColorMatrixFilter(); buyArt.filters = [buyCm];           
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
  const _buyBaseW = Math.max(1, (buyArt || buyFabPress).width);   
  buyFab.on('pointertap', () => { try { Sound.click(); } catch (e) {} showBuyBonusModal(); });
  
  buyFab.on('pointerdown', () => { try { window.gsap && window.gsap.to(buyFabPress.scale, { x: 0.94, y: 0.94, duration: 0.1, ease: 'power3.out' }); } catch (e) {} });
  const _buyRelease = () => { try { window.gsap && window.gsap.to(buyFabPress.scale, { x: 1, y: 1, duration: 0.42, ease: 'elastic.out(1, 0.5)' }); } catch (e) {} };
  buyFab.on('pointerup', _buyRelease); buyFab.on('pointerupoutside', _buyRelease); buyFab.on('pointercancel', _buyRelease);

  
  (function buyFabVfx() {
    const g = window.gsap;
    if (!g || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    g.to(buyFabAnim.scale, { x: 1.045, y: 1.045, duration: 1.5, ease: 'sine.inOut', repeat: -1, yoyo: true });
    g.to(buyFabAnim, { y: '-=7', duration: 1.9, ease: 'sine.inOut', repeat: -1, yoyo: true });
    if (buyGlow) g.to(buyGlow, { alpha: 0.9, duration: 1.2, ease: 'sine.inOut', repeat: -1, yoyo: true });
    if (buyCm) { const o = { b: 1 }; g.to(o, { b: 1.16, duration: 1.2, ease: 'sine.inOut', repeat: -1, yoyo: true, onUpdate() { try { buyCm.brightness(o.b, false); } catch (e) {} } }); }
  })();
  try { if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || /[?&]debug=/.test(location.search)) { window.__buyFab = buyFab; window.__buyModal = buyModal; } } catch (e) {}

  const _gridRect = { x: 0, y: 0, w: 0, h: 0 };
  function layoutBuyFab() {
    const W = app.screen.width, H = app.screen.height;
    const portrait = H > W * 1.05;

    
    const g = _gridRect.w > 0 ? _gridRect : { x: W * 0.1, y: H * 0.2, w: W * 0.8, h: H * 0.6 };
    const leftMargin = g.x;                       
    const midY = g.y + g.h / 2;                   
    if (portrait) {
      
      const targetW = Math.min(W * 0.17, 88);
      buyFabInner.scale.set(targetW / _buyBaseW);
      buyFab.position.set(Math.max(targetW * 0.6, leftMargin * 0.5), H * 0.77);
    } else {

      
      
      const gap = 18;
      const desired = Math.min(W * 0.13, 184);
      if (leftMargin - gap >= 48) {
        const targetW = Math.min(desired, leftMargin - gap);
        buyFabInner.scale.set(targetW / _buyBaseW);
        buyFab.position.set(g.x - gap - targetW / 2, midY);
      } else {
        
        const targetW = Math.min(desired, 96);
        buyFabInner.scale.set(targetW / _buyBaseW);
        buyFab.position.set(targetW * 0.62, g.y + g.h - targetW * 0.55);
      }
    }
  }
  layoutBuyFab();

  
  
  function refreshBuyFabVisibility() {

    buyFab.visible = _buyAllowed() && !buyModal.visible;
  }
  refreshBuyFabVisibility();
  bmConfirm.on('pointertap', () => {
    const cost = bonusCostX6(_selectedTier);
    if(State.balanceX6 < cost){ hideBuyBonusModal(); return; }
    const modeId = BONUS_TIERS[_selectedTier].id;   
    hideBuyBonusModal();

    
    startSpin(modeId);
  });


  
  
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

  

  bmtGrid.eventMode = 'static'; bmtGrid.cursor = 'grab';
  const bmtMask = new PIXI.Graphics(); bmtMask.eventMode = 'none'; betMenuCard.addChild(bmtMask); bmtGrid.mask = bmtMask;
  const bmtCenterHi = new PIXI.Graphics(); bmtCenterHi.eventMode = 'none'; betMenuCard.addChild(bmtCenterHi);
  let bmtStep = 120, bmtN = 0, bmtMinX = 0, bmtSnapRAF = null, bmtDrag = null;
  const bmtMaxBtn = makeModalBtn(betMenuCard, socialFilter('MAX BET'), THEME.colors.accent, 0xffffff);

  

  const bmtBuyBtn = makeModalBtn(betMenuCard, socialFilter('BUY BONUS'), THEME.colors.pink, THEME.colors.text);
  bmtBuyBtn.visible = false;
  bmtBuyBtn.on('pointertap', () => { hideBetMenu(); try { Sound.click(); } catch(e){} showBuyBonusModal(); });

  
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
    betMenuPage = -1;                   
    layoutBetMenu();                    
    modalIn(betMenuCard, betMenuBg);    
  }
  function hideBetMenu(){
    if(!betMenu.visible) return;
    modalOut(betMenuCard, betMenuBg, () => { betMenu.visible = false; bmtGrid.removeChildren(); });
  }
  betMenuBg.on('pointertap', () => { if(bmtGrid._wasDrag){ bmtGrid._wasDrag = false; return; } hideBetMenu(); });
  bmtClose.on('pointertap', hideBetMenu);

  
  function bmtClampX(x){ return Math.max(bmtMinX, Math.min(0, x)); }
  function bmtCentered(){ return Math.max(0, Math.min(bmtN - 1, Math.round(-bmtGrid.x / bmtStep))); }
  function bmtAfford(i){ return State.balanceX6 >= (State.betLevels[i] ?? Infinity); }
  function bmtNearestAfford(i){
    if(bmtAfford(i)) return i;
    for(let d = 1; d < bmtN; d++){ if(i-d >= 0 && bmtAfford(i-d)) return i-d; if(i+d < bmtN && bmtAfford(i+d)) return i+d; }
    return 0;
  }
  function bmtFocus(idx){   
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
      const p = Math.min(1, (performance.now() - t0) / dur), k = 1 - Math.pow(1 - p, 3);   
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
    bmtGrid._wasDrag = wasDrag;   
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

    

    const tileH = 46;
    const tileW = Math.max(76, Math.min(124, W * 0.30));
    const tgap  = 12;
    bmtStep = tileW + tgap;
    bmtMinX = Math.min(0, -((bmtN - 1) * bmtStep));
    const topH = 58;                                     
    const footerH = 16 + 40 + (buyRow ? 50 : 0) + 14;    
    const navStripH = 28;
    const cardW = Math.min(W * 0.94, 460);
    const cardH = topH + tileH + 22 + navStripH + footerH;
    betMenuCard.position.set(W/2, H/2);
    
    const fitScale = Math.min(1, (W - 16) / cardW, (H - 12) / cardH);
    betMenuCard._fitScale = fitScale; betMenuCard.scale.set(fitScale);
    drawSurfChrome(bmtCardBg, cardW, cardH, { radius: 16, titleDivAt: 44 });
    bmtTitle.position.set(0, -cardH/2 + 18);
    styleClose(bmtClose, bmtCloseIcon, cardW/2, cardH/2);

    
    const rowY = -cardH/2 + topH + 4 + tileH/2;
    const vpW  = Math.min(cardW - 26, bmtStep * Math.max(1, bmtN) - tgap + 2);
    bmtGrid.position.set(0, rowY);                       
    bmtMask.clear().rect(-vpW/2, rowY - tileH/2 - 6, vpW, tileH + 12).fill(0xffffff);

    
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
    bmtGrid.x = bmtClampX(-(State.betIdx || 0) * bmtStep);   

    
    bmtCenterHi.clear();
    const bX = tileW/2 + 7, bY = tileH/2 + 6;
    for(const [sx, sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
      bmtCenterHi.moveTo(sx*(bX-10), rowY + sy*bY).lineTo(sx*bX, rowY + sy*bY).lineTo(sx*bX, rowY + sy*(bY-10));
    }
    bmtCenterHi.stroke({ color:SURF.accentHi, width:2, alpha:0.85 });

    
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
    bmtFocus(State.betIdx || 0);   

    
    const btnW = Math.min(180, cardW*0.5), btnH = 40;
    drawGlossyBtn(bmtMaxBtn._bg, btnW, btnH, 'primary');
    bmtMaxBtn.position.set(0, cardH/2 - (buyRow ? 80 : 32));

    
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
    
    let maxIdx = 0;
    for(let i = 0; i < State.betLevels.length; i++){
      if(State.balanceX6 >= State.betLevels[i]) maxIdx = i;
    }
    State.betIdx = maxIdx; State.betX6 = State.betLevels[maxIdx];
    updateHUD();
    try { Sound.click(); } catch(e){}
    hideBetMenu();
  });


  
  betValue.removeAllListeners('pointertap');
  betLabel.removeAllListeners('pointertap');
  betValue.on('pointertap', showBetMenu);
  betLabel.on('pointertap', showLinesPreview);

  
  const drawerLayer = new PIXI.Container(); drawerLayer.visible = false; stage.addChild(drawerLayer);
  const drawerBg = new PIXI.Graphics(); drawerLayer.addChild(drawerBg); drawerBg.eventMode='static';
  const drawerPanel = new PIXI.Container(); drawerLayer.addChild(drawerPanel);
  
  const drawerPanelBg = new PIXI.Graphics(); drawerPanel.addChild(drawerPanelBg);
  const drawerTitle = new PIXI.Text({ text:'', style:txtStyle(18, SURF.title) });
  drawerTitle.anchor.set(0.5,0); drawerPanel.addChild(drawerTitle);
  const drawerClose = new PIXI.Container(); drawerClose.eventMode='static'; drawerClose.cursor='pointer';
  drawerPanel.addChild(drawerClose);
  const drawerCloseIcon = spr('icClose'); drawerClose.addChild(drawerCloseIcon);
  const drawerBody = new PIXI.Container(); drawerPanel.addChild(drawerBody);


  

  
  
  function makeScrollable(body, card){
    const mask = new PIXI.Graphics(); mask.eventMode = 'none'; card.addChild(mask);
    body.mask = mask; body.eventMode = 'static';
    body._scroll = 0; body._maxScroll = 0; body._contentH = 0;
    body.hitArea = new PIXI.Rectangle(0, 0, 400, 300);
    const clampScroll = () => {
      body._scroll = Math.max(0, Math.min(body._maxScroll, body._scroll));
      body.pivot.y = body._scroll;
      body.hitArea.y = body._scroll;                 
    };
    
    body._refreshScroll = () => {
      body.pivot.y = 0;                              
      const m = body.mask; body.mask = null;         
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
  let drawerWantH = 560;   
  function openDrawer(name){
    if(State.phase !== Phase.IDLE && name !== 'history') return;
    const wasOpen = drawerLayer.visible;
    activeDrawer = name; drawerLayer.visible = true;
    drawerWantH = 560;                 
    layoutDrawer(); populateDrawer(name);

    

    

    const _dm = drawerBody.mask; drawerBody.mask = null;
    const contentH = drawerBody.height || 360;
    drawerBody.mask = _dm;
    drawerWantH = Math.max(190, Math.min(app.screen.height*0.84, contentH + 90));
    layoutDrawer();
    drawerBody._refreshScroll && drawerBody._refreshScroll();   

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

    
    drawerBg.clear().rect(0,0,W,H).fill({ color:0x000000, alpha:0.80 });

    
    
    const panW=Math.min(380,W*0.9), panH=Math.min(H*0.84,drawerWantH);

    
    const _dMaxH = H - 12, _dMaxW = W - 16;
    const _dFit  = Math.min(1, _dMaxH / panH, _dMaxW / panW);
    drawerPanel._fitScale = _dFit;
    drawerPanel.scale.set(_dFit);
    drawerPanel.position.set(W/2,H/2);

    

    

    
    
    drawSurfChrome(drawerPanelBg, panW, panH, { radius:18, titleDivAt:44 });
    drawerTitle.position.set(0,-panH/2+18);
    styleClose(drawerClose, drawerCloseIcon, panW/2, panH/2);   
    drawerBody.position.set(-panW/2+22,-panH/2+58);
    drawerBody._w = panW-44; drawerBody._h = panH-80;
  }
  function drText(text,size,fill,x,y,anchor){

    

    let finalFill = fill;
    if(fill === 0xc9b0e6) finalFill = 0xf5f7fa;       
    else if(fill === 0x776688) finalFill = 0x8088a0;  
    else if(fill === 0x9988aa) finalFill = 0x8088a0;  
    const t = new PIXI.Text({ text, style:{ fontFamily:'Fredoka', fontSize:size, fill: finalFill, fontWeight:'bold' }});
    t.anchor.set(anchor||0,0); t.position.set(x,y);
    drawerBody.addChild(t); return t;
  }
  function drRow(label,value,y,rowW){

    
    drText(socialFilter(label),12,0xc9b0e6,0,y);   
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

        

        const tw = 52, th = 26;
        const tr = th * 0.5;
        const G_CORE = SURF.accent, G_EDGE = SURF.accentHi;   
        
        if(val){
          tbg.roundRect(-4, -3, tw+8, th+6, tr+3).fill({ color: G_CORE, alpha: 0.12 });
          tbg.roundRect(-2, -1, tw+4, th+2, tr+1).fill({ color: G_CORE, alpha: 0.22 });
        }
        
        tbg.roundRect(0, 0, tw, th, tr).fill({ color: val ? 0x1a1408 : 0x141420, alpha: 1 });
        
        if(val){
          tbg.roundRect(2, 2, tw-4, th-4, tr-2).fill({ color: G_CORE, alpha: 0.22 });
        }
        
        tbg.roundRect(0, 0, tw, th, tr)
          .stroke({ color: val ? G_EDGE : 0x3d3d4e, width: 1.3, alpha: val ? 0.95 : 0.70 });
        
        tbg.roundRect(tr*0.4, 1, tw - tr*0.8, 0.8, 0.4)
          .fill({ color: 0xf5f7fa, alpha: val ? 0.40 : 0.18 });
        
        const knobX = val ? tw - tr : tr;
        const knobR = tr - 4;
        tknob.circle(knobX, tr, knobR).fill({ color: 0xf5f7fa, alpha: 1 });
        tknob.circle(knobX, tr, knobR).stroke({ color: val ? G_EDGE : 0x9097a5, width: 0.8 });
        if(val){
          
          tknob.circle(knobX, tr, knobR * 0.42).fill({ color: G_CORE, alpha: 1 });
        }
        tg.position.set(w-tw, y);

        tg.hitArea = new PIXI.Rectangle(-6, -4, tw+12, th+8);
        tg.on('pointertap', () => { onTap(); closeDrawer(); openDrawer('settings'); });
        drawerBody.addChild(tg); y+=gap;
      }
      makeToggle('Sound','Spin & win audio',!State.muted,() => {
        State.muted=!State.muted;
        btnSound._icon.texture=tex(State.muted?'icMute':'icSound');
        btnSound._setActive(!State.muted); Sound.setMuted(State.muted); persistSave();
        syncDeliveredBar();   
      });


      
      drText('Turbo Speed',12,0xc9b0e6,0,y);
      drText('Spin pacing — switch any time',9,0x776688,0,y+15);
      const segW=140, segH=24, segR=segH/2;
      const segG = new PIXI.Container(); segG.position.set(w-segW, y);
      const segBg = new PIXI.Graphics();
      segBg.roundRect(0,0,segW,segH,segR).fill(0x2a2a36).stroke({color:0x3d3d4e,width:1});
      segG.addChild(segBg);
      const segKnob = new PIXI.Graphics();
      const segPad = 2, cellW = (segW - segPad*2) / 3;
      
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
        
        hit.on('pointerover', e => { if((!e || e.pointerType==='mouse') && i!==State.turboMode) t.scale.set(1.14); });
        hit.on('pointerout', () => { if(i!==State.turboMode) t.scale.set(1); });
        hit.on('pointertap', () => {
          State.turboMode = i; persistSave();
          refreshTurboBtn();   
          syncDeliveredBar();  
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

  
  const infoModal = new PIXI.Container(); infoModal.visible = false; stage.addChild(infoModal);
  const infoBg = new PIXI.Graphics(); infoModal.addChild(infoBg); infoBg.eventMode='static';
  const infoCard = new PIXI.Container(); infoModal.addChild(infoCard);
  
  const infoCardBg = new PIXI.Graphics(); infoCard.addChild(infoCardBg);
  const infoTitle = new PIXI.Text({ text:'GAME INFORMATION', style:txtStyle(16, SURF.title) });
  infoTitle.anchor.set(0.5,0); infoCard.addChild(infoTitle);
  const infoBody = new PIXI.Container(); infoCard.addChild(infoBody);
  makeScrollable(infoBody, infoCard);   
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
  
  window.addEventListener('wheel', e => {
    if(infoModal.visible && infoBody._wheel) infoBody._wheel(e.deltaY);
    else if(drawerLayer.visible && drawerBody._wheel) drawerBody._wheel(e.deltaY);
  }, { passive:true });

  function layoutInfoModal(){
    const W=app.screen.width, H=app.screen.height;
    infoBg.clear().rect(0,0,W,H).fill({ color:0x000000, alpha:0.92 });
    const cardW=Math.min(490,W*0.92), cardH=Math.min(560,H*0.88);

    

    const cardContentNeed = 320;
    const _maxH = H - 16, _maxW = W - 16;
    const _fit  = Math.min(1, _maxH / cardContentNeed, _maxW / cardW);
    infoCard._fitScale = _fit;
    infoCard.scale.set(_fit);
    infoCard.position.set(W/2,H/2);

    drawSurfChrome(infoCardBg, cardW, cardH, { radius:18, titleDivAt:44 });
    infoTitle.position.set(0,-cardH/2+18);
    styleClose(infoCloseBtn, infoCloseIcon, cardW/2, cardH/2);   
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
      line('3 / 4 / 5 scatters also award '+FS_AWARD[3]+' / '+FS_AWARD[4]+' / '+FS_AWARD[5]+' Free Spins.',10,0xc9b0e6);   
      y+=8;
      line('10 PAYLINES — wins pay left → right from reel 1',11,SURF.heading,true);
      y+=4;
      
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

      
      const rgLink = line('BeGambleAware.org · 1-800-GAMBLER',10,0x65d4f0,true);
      rgLink.eventMode='static'; rgLink.cursor='pointer';
      rgLink.on('pointertap',()=>{ try{ window.open('https://www.begambleaware.org','_blank','noopener'); }catch(e){} });
    }
    infoBody._refreshScroll && infoBody._refreshScroll();   
  }


  

  const rcModal = new PIXI.Container(); rcModal.visible = false; stage.addChild(rcModal);
  const rcBg = new PIXI.Graphics(); rcModal.addChild(rcBg); rcBg.eventMode='static';
  const rcCard = new PIXI.Container(); rcModal.addChild(rcCard);
  const rcCardBg = new PIXI.Graphics(); rcCard.addChild(rcCardBg);
  
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
  
  rcFooter.eventMode='static'; rcFooter.cursor='pointer';
  rcFooter.on('pointertap',()=>{ try{ window.open('https://www.begambleaware.org','_blank','noopener'); }catch(e){} });

  const rcBtnStop = makeModalBtn(rcCard,'STOP',0x1f1c2e,0xf5f7fa);
  const rcBtnContinue = makeModalBtn(rcCard,'CONTINUE',0xff007f,0xf5f7fa);

  function showRealityCheck(){
    State.phase = Phase.REALITY_CHECK;
    rcModal.visible = true;
    
    stage.addChild(rcModal);
    const W=app.screen.width, H=app.screen.height;
    
    rcBg.clear().rect(0,0,W,H).fill({ color:0x0a0a0e, alpha:0.78 });
    const cardW=Math.min(360,W*0.84), cardH=336;

    
    const _rcMaxH = H - 12, _rcMaxW = W - 16;
    const _rcFit  = Math.min(1, _rcMaxH / cardH, _rcMaxW / cardW);
    rcCard._fitScale = _rcFit;
    rcCard.scale.set(_rcFit);
    rcCard.position.set(W/2,H/2);

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
      
      const l=new PIXI.Text({ text:lbl, style:{
        fontFamily:'Fredoka', fontSize:10, fill:SURF.heading, fontWeight:'700', letterSpacing:1.2,
      }});
      l.anchor.set(0.5,0); l.position.set(bx+(cardW-40)/8,0); rcStats.addChild(l);
      
      const v=new PIXI.Text({ text:val, style:{
        fontFamily:'Luckiest Guy', fontSize:14, fill:0xf5f7fa,
        stroke:{ color:0x0a0a0e, width:1.4, join:'round' },
      }});
      v.anchor.set(0.5,0); v.position.set(bx+(cardW-40)/8,14); rcStats.addChild(v);
    });
    rcStats.position.set(0,-cardH/2+100);
    rcFooter.position.set(0,-cardH/2+148);

    
    const btnW=cardW*0.38, btnH=44, btnY=cardH/2-30;
    const btnGap = 14;
    
    drawGlossyBtn(rcBtnStop._bg, btnW, btnH, 'secondary');
    rcBtnStop.hitArea = new PIXI.Rectangle(-btnW/2, -btnH/2, btnW, btnH);
    rcBtnStop.position.set(-(btnW+btnGap)/2, btnY);
    rcBtnStop._t.style.fontFamily = 'Luckiest Guy';
    rcBtnStop._t.style.fontSize = 15;
    rcBtnStop._t.style.fill = 0xf5f7fa;
    rcBtnStop._t.style.letterSpacing = 1.2;
    
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

    
    if(State.autoplay.active) autoplayNext();
  });
  rcBtnStop.on('pointertap', () => {
    State.phase=Phase.IDLE; State.autoplay.active=false;
    modalOut(rcCard, rcBg, () => { rcModal.visible=false; });
  });
  
  window.addEventListener('resize', () => {
    if(rcModal.visible) showRealityCheck();
  });

  
  const errModal = new PIXI.Container(); errModal.visible = false; stage.addChild(errModal);
  const errBg = new PIXI.Graphics(); errModal.addChild(errBg); errBg.eventMode='static';
  const errCard = new PIXI.Container(); errModal.addChild(errCard);
  
  const errCardBg = new PIXI.Graphics(); errCard.addChild(errCardBg);
  const errTitle = new PIXI.Text({ text:'CONNECTION ERROR', style:txtStyle(16, THEME.colors.loss) });
  errTitle.anchor.set(0.5,0); errCard.addChild(errTitle);
  const errMsg = new PIXI.Text({ text:'', style:{ fontFamily:'Fredoka', fontSize:12, fill:THEME.colors.text, align:'center', wordWrap:true, wordWrapWidth:260 }});
  errMsg.anchor.set(0.5,0); errCard.addChild(errMsg);

  
  const errRetry = makeModalBtn(errCard,'RETRY', THEME.colors.pink, THEME.colors.text);
  function showError(title,msg,fatal){
    errModal.visible=true;
    errModal._fatal = (fatal !== false);   
    const W=app.screen.width, H=app.screen.height;
    errBg.clear().rect(0,0,W,H).fill({ color:0x000000, alpha:0.94 });
    const cardW=Math.min(340,W*0.84), cardH=210;

    const _eMaxH = H - 16, _eMaxW = W - 16;
    const _eFit  = Math.min(1, _eMaxH / cardH, _eMaxW / cardW);
    errCard._fitScale = _eFit;
    errCard.scale.set(_eFit);
    errCard.position.set(W/2,H/2);

    
    drawPanelChrome(errCardBg, cardW, cardH, { accent:THEME.colors.loss, radius:16, titleDivAt:44 });
    errTitle.text=title; errTitle.position.set(0,-cardH/2+18);
    errMsg.text=msg; errMsg.position.set(0,-cardH/2+50);
    const btnW=cardW*0.42, btnH=44;   
    drawGlossyBtn(errRetry._bg, btnW, btnH, 'primary');   
    errRetry.position.set(0,cardH/2-32);
    errRetry._t.text = errModal._fatal ? 'RETRY' : 'CLOSE';
    modalIn(errCard, errBg);
  }
  errRetry.on('pointertap', () => {
    errModal.visible = false;
    if(errModal._fatal){ location.reload(); return; }
    
    _spinLock = false;
    if(typeof stopAutoplay === 'function') stopAutoplay();
    State.phase = Phase.IDLE;
    try { updateHUD(); } catch(e){}
  });

  
  window.addEventListener('unhandledrejection', (e) => {
    if(!/[?&]debug=/.test(location.search)) e.preventDefault();
  });


  

  
  
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
    showError(socialFilter(title), socialFilter(msg), !recoverable);   
  }

  
  const replayBar = new PIXI.Container(); replayBar.visible = false; stage.addChild(replayBar);
  const rbBg = new PIXI.Graphics(); replayBar.addChild(rbBg);
  
  const rbText = new PIXI.Text({ text:'', style:{ fontFamily:'Fredoka', fontSize:11, fill:0xf5f7fa, align:'center', wordWrap:true, wordWrapWidth:520 }});
  rbText.anchor.set(0.5); replayBar.addChild(rbText);
  const rbDisclosure = new PIXI.Container(); replayBar.addChild(rbDisclosure);
  const rbAgain = makeModalBtn(replayBar,'PLAY AGAIN',0xff5a9c,0xf5f7fa);


  
  
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

  
  const introFeatures = new PIXI.Container();
  introFeatures.eventMode = 'none';
  introOverlay.addChild(introFeatures);


  

  

  
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
    const c = Math.min(w*0.30, h*0.16);   

    
    
    g.clear()
      
      .poly(octPts(hw, hh + 2, c)).fill({ color: 0x000000, alpha: 0.26 })
      
      .poly(octPts(hw, hh, c)).fill({ color: 0x12111c, alpha: hero ? 0.80 : 0.84 })
      
      .poly(octPts(hw * 0.88, hh * 0.50, c * 0.7, 0, -hh * 0.30)).fill({ color: 0xffffff, alpha: 0.10 })

      .poly(octPts(hw, hh, c)).stroke({ color: accent, width: 1.4, alpha: hero ? 0.92 : 0.7 })
      
      .moveTo(-hw + c + 5, -hh + 2.5).lineTo(hw - c - 5, -hh + 2.5).stroke({ color: 0xffe6f4, width: 1.4, alpha: 0.60 })
      
      .moveTo(-hw + c + 9, -hh + 5).lineTo(hw - c - 9, -hh + 5).stroke({ color: 0xffffff, width: 0.8, alpha: 0.18 });
  }

  function makeIntroCard(texKey, value, label, subtext, accent){
    const card = new PIXI.Container();
    card._plate = new PIXI.Graphics(); card.addChild(card._plate);
    
    card._shine = new PIXI.Graphics();
    card._shine.blendMode = 'add';
    card.addChild(card._shine);
    
    card._fx = new PIXI.Graphics();
    card._fx.blendMode = 'add';
    card.addChild(card._fx);
    card._iconBg = new PIXI.Graphics(); card.addChild(card._iconBg);
    card._icon = new PIXI.Sprite(TEX[texKey]); card._icon.anchor.set(0.5); card.addChild(card._icon);
    
    card._value = new PIXI.Text({ text:value, style:{
      fontFamily:THEME.type.familyDisplay, fontSize:30,
      fill:0xffffff, align:'center', letterSpacing:0.5,
      stroke:{ color:0x220617, width:3, join:'round' },
    }});
    card._value.anchor.set(0.5); card.addChild(card._value);
    
    card._label = new PIXI.Text({ text:label, style:{
      fontFamily:THEME.type.family, fontSize:11,
      fill:accent, align:'center', letterSpacing:2.2, fontWeight:'700',
    }});
    card._label.anchor.set(0.5); card.addChild(card._label);
    
    card._subtext = new PIXI.Text({ text:subtext || '', style:{
      fontFamily:THEME.type.family, fontSize:9,
      fill:THEME.colors.textMuted, align:'center', letterSpacing:0.6,
      wordWrap:true, wordWrapWidth:160,
    }});
    card._subtext.anchor.set(0.5, 0); card.addChild(card._subtext);
    card._accent = accent;
    card._shinePhase = vrnd() * Math.PI * 2;   
    return card;
  }

  

  
  const introCard1 = makeIntroCard('s7', '3', 'BONUS TYPES',
    'Standard · Hot · Mega', 0xff007f);
  const introCard2 = makeIntroCard('s8', '5,000×', 'MAX WIN',
    socialFilter('Total bet multiplier'), 0xff5ab0);
  const introCard3 = makeIntroCard('s0', '9', 'UNIQUE SYMBOLS',
    'Fruit · Bell · 7 · Crown', 0xc04bd6);
  introFeatures.addChild(introCard1, introCard2, introCard3);


  const introCtaBg = new PIXI.Graphics();
  introOverlay.addChild(introCtaBg);
  const introCta = new PIXI.Text({ text:'TAP TO START', style:{
    fontFamily:THEME.type.familyDisplay, fontSize:22,
    fill:THEME.colors.text, align:'center', letterSpacing:3.5,
    stroke:{ color:0x2a0a1e, width:3, join:'round' },
  }});
  introCta.anchor.set(0.5);
  introOverlay.addChild(introCta);


  

  const introAddBack  = new PIXI.Graphics(); introAddBack.blendMode  = 'add'; introAddBack.eventMode = 'none';
  const introAddFront = new PIXI.Graphics(); introAddFront.blendMode = 'add'; introAddFront.eventMode = 'none';
  introOverlay.addChildAt(introAddBack,  introOverlay.getChildIndex(introBg) + 1);      
  introOverlay.addChildAt(introAddFront, introOverlay.getChildIndex(introCtaBg) + 1);   
  
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

    
    introAddBack.clear();
    
    const rayR = Math.min(W,H)*0.34;   
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
        
        card._fx.circle(0, by, cw*0.12*(0.9+0.2*pulse)).fill({ color:0xff5a7a, alpha:0.12*(0.5+0.5*pulse) });
      }
      
      const iy = -ch*0.27, ir = cw*0.34*(1.0+0.06*pulse);
      card._fx.circle(0, iy, ir).stroke({ color:0xff6ab0, width:1.4, alpha:(hero?0.30:0.18)*pulse });
    });

    
    introAddFront.clear();
    if(!reduced){
      const lw = introLogo.width, lh = introLogo.height;
      const glints = [[-0.30,-0.18,0.0],[0.26,-0.05,1.6],[0.04,0.16,3.1],[-0.16,0.10,4.4]];
      for(const g of glints){
        const tw = 0.5+0.5*Math.sin(now*0.006 + g[2]*2.2);
        _introSparkle(introAddFront, lx + g[0]*lw*0.5, ly + g[1]*lh*0.5, 2.5 + 5.5*tw, 0.25 + 0.55*tw);
      }
    }

    
    
    const _sh = introOverlay._shine;
    if(!reduced && _sh >= 0 && _sh <= 1){
      const lw2 = introLogo.width, lh2 = introLogo.height;
      const sx = lx + (_sh - 0.5) * lw2 * 1.25;           
      const hw = Math.max(8, lw2 * 0.05), hh = lh2 * 0.6, dx = hh * 0.36;  
      const sa = 0.42 * Math.sin(_sh * Math.PI);          
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
    if(isReduced()){ try { drawIntroVfx(performance.now()); } catch(e){} return; }   
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
  introOverlay._shine = -1;        
  introOverlay._irisActive = false; 
  introOverlay._iris = null;        
  introOverlay.on('pointertap', () => {
    if(introOverlay._dismissing) return;

    
    if(performance.now() - (introOverlay._shownAt||0) < 350) return;
    irisDismissIntro();       
    try {
      Sound.resume();         
      Sound.click();

      
      Sound.startIdleMusic();
    } catch(e){}

    
    // (auto paylines-preview on intro-dismiss removed: it drew confusing full-width
    //  magenta lines over the just-revealed board -- paylines stay in the info panel.)
  });

  function layoutIntroOverlay(){
    if(!introOverlay.visible) return;
    const W = app.screen.width, H = app.screen.height;
    const portrait = H > W*1.05;
    const tiny = H < 330;


    
    introBg.clear()

      
      .rect(0,0,W,H).fill({ color:0x0a0710, alpha:0.78 })
      .circle(W*0.5, H*0.24, Math.min(W,H)*0.30).fill({ color:0xff007f, alpha:0.09 })
      .circle(W*0.5, H*0.23, Math.min(W,H)*0.15).fill({ color:0xff5ab0, alpha:0.07 });

    
    introVignette.clear();
    for(let i=1;i<=5;i++){
      const inset = Math.min(W,H) * 0.04 * i;
      introVignette.rect(0,0,W,inset).fill({ color:0x000000, alpha:0.07 });
      introVignette.rect(0,H-inset,W,inset).fill({ color:0x000000, alpha:0.07 });
      introVignette.rect(0,0,inset,H).fill({ color:0x000000, alpha:0.05 });
      introVignette.rect(W-inset,0,inset,H).fill({ color:0x000000, alpha:0.05 });
    }


    const logoMaxW = portrait ? W*0.82 : Math.min(W*0.56, 520);
    const logoMaxH = H * (tiny ? 0.19 : 0.235);
    const lk = Math.min(logoMaxW / introLogo.texture.width,
                        logoMaxH / introLogo.texture.height);
    introLogo.scale.set(lk);
    introLogo.position.set(W/2, H * (tiny ? 0.155 : 0.18));
    introLogo._baseY = introLogo.y;


    
    
    const cardW = portrait ? Math.min(W*0.30, 168) : Math.min(W*0.20, 200);
    const cardH = cardW * 1.65;
    const gap = portrait ? W*0.025 : W*0.04;
    const totalW = cardW*3 + gap*2;
    const startX = (W - totalW)/2 + cardW/2;
    const cardY = H * (tiny ? 0.55 : 0.575);   
    [introCard1, introCard2, introCard3].forEach((card, i) => {
      const cx = startX + i*(cardW + gap);
      card.position.set(cx, cardY);
      card._baseY = cardY; card._cw = cardW; card._ch = cardH;   
      const hero = (i===1);
      const ax = card._accent;
      const plateR = cardW * 0.30;


      drawCrystalPanel(card._plate, cardW, cardH, ax, hero);

      
      const iyc = -cardH*0.27;
      card._iconBg.clear()
        .circle(0, iyc, plateR*1.20).fill({ color:ax, alpha:0.15 })
        .circle(0, iyc, plateR).fill({ color:0x0a0703, alpha:0.96 })
        .circle(0, iyc, plateR).stroke({ color:ax, width:2, alpha:0.95 })
        .circle(0, iyc, plateR-3).stroke({ color:0xffe6f4, width:0.8, alpha:0.45 })
        
        .moveTo(Math.cos(Math.PI*1.15)*(plateR-3), iyc+Math.sin(Math.PI*1.15)*(plateR-3))
        .arc(0, iyc, plateR-3, Math.PI*1.15, Math.PI*1.85).stroke({ color:0xffffff, width:1.2, alpha:0.4 })
        
        .circle(-plateR*0.28, iyc-plateR*0.28, plateR*0.5).fill({ color:0xffd9ec, alpha:0.07 });   

      
      const iconK = (plateR * 1.5) / Math.max(card._icon.texture.width, card._icon.texture.height);
      card._icon.scale.set(iconK);
      card._icon.position.set(0, iyc);


      
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


    
    const ctaSize = Math.max(14, Math.round(Math.min(W, H) * (tiny ? 0.06 : 0.044)));
    introCta.style.fontSize = ctaSize;
    introCta.style.fill = 0xffe6f4;                                  
    introCta.style.stroke = { color: 0x2a0a1e, width: 3, join: 'round' };
    const ctaY = H * (tiny ? 0.92 : 0.86);
    introCta.position.set(W/2, ctaY);
    const ctaPadX = ctaSize * 1.5;
    const ctaPadY = ctaSize * 0.58;
    const ctaW = introCta.width + ctaPadX*2;
    const ctaH = ctaSize + ctaPadY*2;
    const ctaR = ctaH * 0.5;
    const cbx = W/2 - ctaW/2, cby = ctaY - ctaH/2;
    introCta._bgRect = { x:cbx, y:cby, w:ctaW, h:ctaH, r:ctaR };     
    introCtaBg.clear()
      
      .roundRect(cbx-1, cby+2, ctaW+2, ctaH+2, ctaR+1).fill({ color:0x000000, alpha:0.42 })
      
      .roundRect(cbx, cby, ctaW, ctaH, ctaR).fill({ color:0x140a14, alpha:0.92 })
      
      .roundRect(cbx+2, cby+2, ctaW-4, ctaH*0.5, ctaR).fill({ color:0xff5ab0, alpha:0.10 })
      
      .roundRect(cbx, cby, ctaW, ctaH, ctaR).stroke({ color:0xff007f, width:2, alpha:0.95 })
      
      .roundRect(cbx+ctaPadX*0.6, cby+2, ctaW-ctaPadX*1.2, 1.3, 1).fill({ color:0xffe6f4, alpha:0.7 });
  }


  

  
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

    
    extraSplashBg.clear().rect(0,0,W,H).fill({ color: 0x000000, alpha: 1.0 });
    extraSplashGlow.clear();   
    
    const logoMax = Math.min(W * 0.62, H * 0.50);
    const k = logoMax / Math.max(extraLogo.texture.width, extraLogo.texture.height);
    extraLogo.scale.set(k);
    extraLogo.position.set(cx, cy);
  }

  
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
      
      const f0 = performance.now();
      const fadeOut = () => {
        const p = Math.min(1, (performance.now() - f0) / 420);
        extraSplash.alpha = 1 - easeInOutCubic(p);
        if(p < 1) requestAnimationFrame(fadeOut);
        else { extraSplash.visible = false; onDone && onDone(); }
      };
      requestAnimationFrame(fadeOut);
    };
    
    const onTap = () => { extraSplash.off('pointertap', onTap); finish(); };
    extraSplash.on('pointertap', onTap);
    
    const fadeIn = () => {
      const p = Math.min(1, (performance.now() - t0) / 500);
      extraSplash.alpha = easeInOutCubic(p);
      if(p < 1) requestAnimationFrame(fadeIn);
      else setTimeout(finish, 1500);
    };
    requestAnimationFrame(fadeIn);

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


  

  

  

  

  

  

  
  
  const popLoader = new PIXI.Container();
  popLoader.visible = false;
  stage.addChild(popLoader);


  

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


  
  
  const popLoaderBgSprite = new PIXI.Sprite(tex('bg'));
  popLoaderBgSprite.anchor.set(0.5);

  
  popLoaderBgSprite.alpha = 1.0;
  const _popBgBlur = new PIXI.BlurFilter({ strength: 12, quality: 1 });
  _popBgBlur.resolution = 0.5;          
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
  
  const popLoaderBarTrack = new PIXI.Graphics();
  popLoader.addChild(popLoaderBarTrack);
  
  const popLoaderBar = new PIXI.Graphics();
  popLoader.addChild(popLoaderBar);
  const popLoaderText = new PIXI.Text({ text:'LOADING', style:{
    fontFamily:'Fredoka', fontSize:12, fill:0xf5f7fa,
    letterSpacing:10, fontWeight:'700',
  }});
  popLoaderText.anchor.set(0.5);
  popLoader.addChild(popLoaderText);
  
  const popLoaderDots = new PIXI.Text({ text:'•••', style:{
    fontFamily:'Fredoka', fontSize:14, fill:0xff007f,
    letterSpacing:4, fontWeight:'700',
  }});
  popLoaderDots.anchor.set(0, 0.5);
  popLoader.addChild(popLoaderDots);

  const popLoaderBrand = new PIXI.Text({ text:'AN ARTEST | BRAINROCKET PRODUCTION', style:{
    fontFamily:'Fredoka', fontSize:9, fill:0xf5f7fa,
    letterSpacing:7, fontWeight:'600',
  }});
  popLoaderBrand.anchor.set(0.5);
  popLoaderBrand.alpha = 0.45;
  popLoader.addChild(popLoaderBrand);

  function layoutPopLoader(){
    const W = app.screen.width, H = app.screen.height;
    const cx = W/2, cy = H * 0.42;   

    
    
    const bgT = popLoaderBgSprite.texture;
    const fitK = Math.max(W / bgT.width, H / bgT.height) * 1.06;   
    popLoaderBgSprite.scale.set(fitK);
    popLoaderBgSprite.position.set(W/2, H/2);
    
    popLoaderBg.clear();

    
    
    popLoaderBg.rect(0, 0, W, H).fill({ color: 0x06060c, alpha: 0.70 });
    
    const focalR = Math.min(W, H) * 0.55;
    for(let g = 14; g >= 1; g--){
      popLoaderBg.circle(cx, cy, focalR * (g/14))
        .fill({ color: 0xff007f, alpha: (1 - g/14) * 0.030 });
    }
    
    popLoaderVignette.clear();
    const vR = Math.max(W, H) * 0.75;
    for(let g = 10; g >= 1; g--){
      const rr = vR * (1 + g*0.08);
      popLoaderVignette.circle(cx, H * 0.5, rr).stroke({
        color: 0x000000, width: rr * 0.05, alpha: (g/10) * 0.14
      });
    }
    
    const logoR = Math.min(W, H) * 0.30;
    popLoaderGlow.clear();
    for(let g = 8; g >= 1; g--){
      popLoaderGlow.circle(cx, cy, logoR * (1 + g*0.18))
        .fill({ color: 0xff007f, alpha: (g/8) * 0.05 });
    }
    
    popLoaderGlow.ellipse(cx, cy + logoR*0.62, logoR*0.7, logoR*0.06)
      .fill({ color: 0xff007f, alpha: 0.20 });
    
    const lk = Math.min(W*0.62, H*0.46) /
               Math.max(popLoaderLogo.texture.width, popLoaderLogo.texture.height);
    popLoaderLogo.scale.set(lk);
    popLoaderLogo.position.set(cx, cy);
    
    const barW = Math.min(360, W*0.72), barH = 5;
    const barY = H * 0.74;
    popLoader._barW = barW;
    popLoader._barX = cx - barW/2;
    popLoader._barY = barY;
    popLoader._barH = barH;
    
    popLoaderBarTrack.clear();
    
    popLoaderBarTrack.roundRect(barW > 0 ? cx - barW/2 - 6 : 0, barY - 6,
      barW + 12, barH + 12, (barH + 12)/2).fill({ color: 0xff007f, alpha: 0.04 });
    
    popLoaderBarTrack.roundRect(cx - barW/2, barY, barW, barH, barH/2)
      .fill({ color: 0xf5f7fa, alpha: 0.10 })
      .stroke({ color: 0xf5f7fa, width: 0.6, alpha: 0.20 });
    
    popLoaderText.position.set(cx - 12, barY - 26);
    popLoaderDots.position.set(cx + popLoaderText.width/2 - 6, barY - 26);
    
    popLoaderBrand.position.set(cx, H - Math.max(36, H * 0.07));
    
    popLoader._raysCx = cx;
    popLoader._raysCy = cy;
    popLoader._raysR  = focalR;
  }


  

  function drawPopLoaderBar(progress){
    const W = popLoader._barW, X = popLoader._barX, Y = popLoader._barY, H = popLoader._barH;
    popLoaderBar.clear();
    const fillW = Math.max(2, W * progress);
    if(fillW < 3) return;
    
    popLoaderBar.roundRect(X-5, Y-5, fillW+10, H+10, (H+10)/2)
      .fill({ color:0xff007f, alpha:0.12 });
    popLoaderBar.roundRect(X-2, Y-2, fillW+4,  H+4,  (H+4)/2)
      .fill({ color:0xff007f, alpha:0.32 });

    const bands = 24;
    for(let i = 0; i < bands; i++){
      const t = i / (bands - 1);                 
      const tri = 1 - Math.abs(t * 2 - 1);       
      
      const r = 0xff;
      const g = Math.round(0x00 + tri * 0x7a);
      const b = Math.round(0x7f + tri * 0x39);
      const col = (r << 16) | (g << 8) | b;
      const bx = X + (i / bands) * fillW;
      const bw = (fillW / bands) + 1;            
      popLoaderBar.roundRect(bx, Y, bw, H,
        
        i === 0 || i === bands - 1 ? H/2 : 0
      ).fill({ color: col, alpha: 1 });
    }
    
    popLoaderBar.roundRect(X + 2, Y + 0.5, Math.max(0, fillW - 4), H * 0.32, H * 0.16)
      .fill({ color: 0xffffff, alpha: 0.55 });
    
    if(progress > 0.02 && progress < 0.99){
      const ex = X + fillW;
      popLoaderBar.circle(ex, Y + H/2, H * 1.4).fill({ color:0xffffff, alpha:0.25 });
      popLoaderBar.circle(ex, Y + H/2, H * 0.7).fill({ color:0xffffff, alpha:0.90 });
    }
  }

  function showPopLoader(onDone, durOverride){
    layoutPopLoader();

    
    
    stage.addChild(popLoader);
    popLoader.visible = true;
    popLoader.alpha = 0;

    
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
    
    popLoader.eventMode = 'static'; popLoader.cursor = 'pointer';
    const onTap = () => { popLoader.off('pointertap', onTap); finish(); };
    popLoader.on('pointertap', onTap);
    
    const step = () => {
      if(done) return;
      const el = performance.now() - t0;
      
      const fadeP = Math.min(1, el / 280);
      popLoader.alpha = 1 - Math.pow(1 - fadeP, 3);

      const barP = Math.min(1, el / totalDur);
      drawPopLoaderBar(1 - Math.pow(1 - barP, 4));
      
      const breath = 1 + Math.sin(el * 0.0045) * 0.04;
      popLoaderLogo.scale.set(baseScale * breath);
      popLoaderLogo.rotation = Math.sin(el * 0.0028) * 0.008;
      
      const cx = popLoader._raysCx, cy = popLoader._raysCy, rR = popLoader._raysR;
      popLoaderRays.clear();
      const rayAng = el * 0.0003;       
      const numRays = 6;
      for(let i = 0; i < numRays; i++){
        const a = rayAng + (i / numRays) * Math.PI * 2;
        const x2 = cx + Math.cos(a) * rR * 1.2;
        const y2 = cy + Math.sin(a) * rR * 0.7;
        popLoaderRays.moveTo(cx, cy).lineTo(x2, y2)
          .stroke({ color: 0xff007f, width: 60, alpha: 0.025 });
      }

      const dotPhase = (el * 0.003) % (Math.PI * 2);
      const d1 = 0.4 + 0.6 * (Math.sin(dotPhase) * 0.5 + 0.5);
      const d2 = 0.4 + 0.6 * (Math.sin(dotPhase - 0.7) * 0.5 + 0.5);
      const d3 = 0.4 + 0.6 * (Math.sin(dotPhase - 1.4) * 0.5 + 0.5);
      popLoaderDots.alpha = (d1 + d2 + d3) / 3;
      
      const brandP = Math.max(0, Math.min(1, (el - 200) / 400));
      popLoaderBrand.alpha = 0.45 * (1 - Math.pow(1 - brandP, 3));
      if(el < totalDur) requestAnimationFrame(step);
      else finish();
    };
    requestAnimationFrame(step);
  }
  
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

    

    
    
    introOverlay._autoMs = (autoMs && autoMs > 0) ? autoMs : 0;

    
    stage.addChild(introOverlay);
    introCta.alpha = 1;
    introCta.scale.set(1);
    layoutIntroOverlay();
    introOverlay._fadeIn = performance.now();

    
    
    introOverlay._logoT0 = performance.now() + 80;   
                                                      
    introOverlay._logoBaseScale = introLogo.scale.x;
    introLogo.alpha = 0;
    introLogo.scale.set(introOverlay._logoBaseScale * 0.80);
    
    if(isReduced()){
      introOverlay.alpha = 1; introOverlay._fadeIn = 0;
      introLogo.alpha = 1;
      introLogo.scale.set(introOverlay._logoBaseScale);
      introOverlay._logoT0 = 0;
    }

    
    startIntroVfx();

    
    
    introOverlay._shine = -1;
    if(window.gsap && window.gsap.fromTo && !isReduced()){
      window.gsap.fromTo(introOverlay, { _shine: 0 }, {
        _shine: 1, duration: 0.85, ease: 'power1.inOut', delay: 0.55,
        onComplete(){ introOverlay._shine = -1; },
      });
    }
  }


  

  function irisDismissIntro(){
    if(introOverlay._dismissing) return;
    introOverlay._dismissing = true;
    const G = window.gsap;
    if(isReduced() || !G || !G.timeline){
      introOverlay._fadeStart = performance.now();   
      return;
    }
    let iris = introOverlay._iris;
    if(!iris){
      iris = introOverlay._iris = new PIXI.Graphics();
      stage.addChild(iris);
    }
    const W = app.screen.width, H = app.screen.height;
    const R = Math.hypot(W, H) * 0.55;                  
    iris.clear().circle(0, 0, R).fill({ color: 0xffffff }); 
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
      .to(iris.scale, { x: 1.06, y: 1.06, duration: 0.12, ease: 'power2.out' }) 
      .to(iris.scale, { x: 0.0001, y: 0.0001, duration: 0.72 }, '>')            
      .to(introOverlay, { alpha: 0.62, duration: 0.5 }, '<0.3');                        
  }


  

  

  

  

  

  const Sound = {
    ctx: null,
    master: null, busMusic: null, busGameplay: null, busSfx: null, busWin: null,
    rushSource: null,           
    musicVoice: null,           
    musicId: null,              
    buffers: Object.create(null), 

    
    ensure(){
      if(this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master      = this.ctx.createGain(); this.master.gain.value = State.muted ? 0 : (this._vol == null ? 0.6 : this._vol);
        this.busMusic    = this.ctx.createGain();
        this.busGameplay = this.ctx.createGain();
        this.busSfx      = this.ctx.createGain();
        this.busWin      = this.ctx.createGain();
        this.applyBusMix();   
        this.busMusic.connect(this.master);
        this.busGameplay.connect(this.master);
        this.busSfx.connect(this.master);
        this.busWin.connect(this.master);
        this.master.connect(this.ctx.destination);
      } catch(e){  }
    },
    resume(){ this.ctx?.resume(); },

    
    
    _vol: 0.6,   
    setMuted(m){ if(this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : (this._vol == null ? 0.6 : this._vol), this.ctx.currentTime, 0.02); },
    
    setVolume(v){
      this._vol = Math.max(0, Math.min(1, v));
      const wasMuted = State.muted;
      State.muted = this._vol <= 0.001;
      if(this.master && this.ctx) this.master.gain.setTargetAtTime(State.muted ? 0 : this._vol, this.ctx.currentTime, 0.02);
      return wasMuted !== State.muted;   
    },

    
    
    _busMix: { music: -6, gameplay: -10, sfx: -8, win: -2 },   
    applyBusMix(){
      if(!this.ctx) return;
      const db2lin = (db) => Math.pow(10, db / 20);
      const m = this._busMix;
      this._musicBase = db2lin(m.music);                 
      if(this.busMusic)    this.busMusic.gain.value    = this._musicBase;
      if(this.busGameplay) this.busGameplay.gain.value = db2lin(m.gameplay);
      if(this.busSfx)      this.busSfx.gain.value      = db2lin(m.sfx);
      if(this.busWin)      this.busWin.gain.value      = db2lin(m.win);
    },


    _voice(freq, dur, type, vol, bus, delay = 0){
      if(State.muted || !this.ctx) return null;
      const t0 = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.008);             
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);       
      o.connect(g); g.connect(bus || this.busSfx);
      o.start(t0); o.stop(t0 + dur + 0.05);
      o.onended = () => { try { o.disconnect(); g.disconnect(); } catch(e){} };
      return { osc: o, gain: g };
    },

    _chord(rootFreq, intervals, dur, type, vol, bus, delay = 0){
      const voices = [];
      for(const semis of intervals){
        const f = rootFreq * Math.pow(2, semis / 12);
        const v = this._voice(f, dur, type, vol / Math.sqrt(intervals.length), bus, delay);
        if(v) voices.push(v);
      }
      return voices;
    },

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


    
    _musicBase: 0.25,   
    _duckMusic(tier){
      if(!this.ctx || !this.busMusic) return;
      if(tier < 3) return;     
      
      const duckDb   = tier >= 6 ? -20 : tier >= 5 ? -15 : -10;
      const holdMs   = tier >= 6 ? 4500 : tier >= 5 ? 3500 : 2200;
      const releaseMs = 1100;                            
      const now = this.ctx.currentTime;
      const base = this._musicBase;                      
      const target = base * Math.pow(10, duckDb / 20);
      const g = this.busMusic.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(target, now + 0.18);
      g.setValueAtTime(target, now + holdMs / 1000);
      g.linearRampToValueAtTime(base, now + (holdMs + releaseMs) / 1000);
    },

    
    click(){ this.ensure(); this._voice(660, 0.05, 'square', 0.30, this.busSfx); },
    tick() { this.ensure(); this._voice(1200, 0.02, 'square', 0.10, this.busSfx); },

    
    spinStart(){
      this.ensure();
      
      this._voice(840, 0.06, 'triangle', 0.18, this.busSfx);
      this._voice(440, 0.10, 'sine',     0.12, this.busSfx, 0.02);

      this._startRush();
    },
    _startRush(){
      if(!this.ctx || this.rushSource) return;
      const ctx = this.ctx, t0 = ctx.currentTime;

      

      
      
      const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = 294;    
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 294.6;   
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000; lp.Q.value = 0.7;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.9;
      const lfoG = ctx.createGain(); lfoG.gain.value = 140;
      lfo.connect(lfoG); lfoG.connect(lp.frequency);
      const padG = ctx.createGain(); padG.gain.setValueAtTime(0, t0); padG.gain.linearRampToValueAtTime(0.045, t0 + 0.16);
      o1.connect(lp); o2.connect(lp); lp.connect(padG); padG.connect(this.busGameplay);
      o1.start(t0); o2.start(t0); lfo.start(t0);
      this.rushSource = { o1, o2, lfo, gain: padG, _pipT: 0 };

      const PAT = [523, 659, 784, 659];   
      let step = 0;
      const pip = () => {
        if(!this.rushSource || State.muted) return;
        const t = ctx.currentTime + 0.02, f = PAT[step % PAT.length]; step++;
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.024, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
        o.connect(g); g.connect(this.busGameplay); o.start(t); o.stop(t + 0.2);
        if(this.rushSource) this.rushSource._pipT = setTimeout(pip, 260);
      };
      pip();
    },
    _stopRush(){
      if(!this.rushSource || !this.ctx) return;
      const rs = this.rushSource, now = this.ctx.currentTime;
      if(rs._pipT) clearTimeout(rs._pipT);                 
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


    
    reelStop(idx, topSym){
      this.ensure();
      if(topSym === 7){
        
        this._chord(220, [0, 4, 7], 0.42, 'triangle', 0.18, this.busSfx);
        this._noise(0.35, 1800, 4, 0.06, this.busSfx, 0.04);
      } else if(topSym === 6){
        
        this._chord(330, [0, 4, 7], 0.28, 'triangle', 0.14, this.busSfx);
      } else {
        
        this._voice(280 + idx * 22, 0.10, 'square', 0.10, this.busSfx);
      }
      
      if(idx === REELS - 1) this._stopRush();
    },


    

    megaCharge(durSec){
      this.ensure();
      if(State.muted || !this.ctx) return null;
      const t0 = this.ctx.currentTime, d = Math.max(0.6, durSec || 1.6);
      const o1 = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'triangle';
      o1.frequency.setValueAtTime(90,  t0); o1.frequency.exponentialRampToValueAtTime(330, t0 + d);   
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
      this._noise(0.09, 2600 + (i % 4) * 520, 8, 0.11, this.busSfx);   
      const t0 = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(1400 + (i % 5) * 120, t0);
      o.frequency.exponentialRampToValueAtTime(360, t0 + 0.10);        
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
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();   
      o.type = 'sine'; o.frequency.setValueAtTime(185, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.5);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.34, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      o.connect(g); g.connect(this.busWin);
      o.start(t0); o.stop(t0 + 0.66); o.onended = () => { try { o.disconnect(); g.disconnect(); } catch(e){} };
      this._noise(0.4, 3200, 2, 0.17, this.busWin);                   
      this._chord(523, [0, 7, 12], 0.7, 'triangle', 0.12, this.busWin, 0.02);   
    },


    

    win(tier){
      if(tier <= 1) return;     
      this.ensure();
      this._duckMusic(tier);

      
      const _wid = tier >= 6 ? 'win_epic' : tier >= 5 ? 'win_mega' : tier >= 4 ? 'win_big' : tier >= 3 ? 'win_nice' : 'win_small';
      if(this._playSample(_wid, 'busWin', 0.95)) return;
      
      const stack = [
        
        { f: 880,  i: [0, 7, 12],         d: 0.55, w: 'triangle', v: 0.16, t: 0     },
        
        { f: 523,  i: [0, 7, 12, 16],     d: 0.90, w: 'triangle', v: 0.18, t: 0.30  },
        
        { f: 392,  i: [0, 4, 7, 12],      d: 1.40, w: 'sawtooth', v: 0.10, t: 0.55  },
        
        { f: 294,  i: [0, 7, 12, 19],     d: 1.80, w: 'square',   v: 0.13, t: 0.85  },
        
        { f: 196,  i: [0, 5, 12, 17, 24], d: 2.40, w: 'sawtooth', v: 0.18, t: 1.20  },
      ];
      
      const layerCount = Math.min(stack.length, tier - 1);
      for(let n = 0; n < layerCount; n++){
        const L = stack[n];
        this._chord(L.f, L.i, L.d, L.w, L.v, this.busWin, L.t);
      }
      
      if(tier >= 4) this._noise(0.4, 5000, 2, 0.05, this.busWin, 0.12);
      
      if(tier >= 6) this._voice(55, 0.6, 'sine', 0.28, this.busWin, 1.20);
    },
    
    winAnticipate(tier){
      this.ensure();
      if(State.muted || !this.ctx) return;
      const t0 = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(180, t0);
      o.frequency.exponentialRampToValueAtTime(180 + tier*70, t0 + 0.34);   
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.05 + tier*0.006, t0 + 0.30);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
      o.connect(g); g.connect(this.busWin);
      o.start(t0); o.stop(t0 + 0.44);
      o.onended = () => { try { o.disconnect(); g.disconnect(); } catch(e){} };
    },

    
    winLand(tier){
      this.ensure();
      if(State.muted || !this.ctx) return;
      this._voice(1318, 0.30, 'triangle', 0.16, this.busWin, 0);
      this._voice(1976, 0.22, 'sine',     0.10, this.busWin, 0.01);
      this._noise(0.22, 6000, 3, 0.06 + tier*0.006, this.busWin, 0);    
      if(tier >= 5) this._voice(60, 0.34, 'sine', 0.22, this.busWin, 0);  
      this._duckMusic(tier|0);
    },


    
    
    winLine(idx, count){
      this.ensure();
      if(State.muted || !this.ctx) return;
      idx = idx | 0; count = count || 3;
      const t0 = this.ctx.currentTime;
      const base = 520 + idx * 70 + (count - 3) * 60;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(base, t0);
      o.frequency.exponentialRampToValueAtTime(base * 1.7, t0 + 0.12);   
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.055, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g); g.connect(this.busSfx);
      o.start(t0); o.stop(t0 + 0.20);
      o.onended = () => { try { o.disconnect(); g.disconnect(); } catch(e){} };
      this._noise(0.09, 5200, 6, 0.022, this.busSfx);   
    },

    
    feature(){
      this.ensure();
      this._duckMusic(5);   
      
      const notes = [220, 277, 330, 392, 440, 523, 587, 659, 784, 880];
      notes.forEach((f, i) => this._voice(f, 0.20, 'triangle', 0.14, this.busWin, i * 0.055));
      
      this._noise(0.45, 1200, 1.5, 0.18, this.busWin, 0.55);
      this._voice(82, 0.6, 'sine', 0.22, this.busWin, 0.55);     
    },


    
    
    fsCrystal(){
      this.ensure();
      
      const notes = [784, 988, 1175, 1568, 1976];
      notes.forEach((f, i) => this._voice(f, 0.26, 'triangle', 0.065, this.busWin, i * 0.07));
      this._chord(523, [0, 7, 12, 16, 19], 0.7, 'triangle', 0.045, this.busWin, 0.10);
      this._voice(2637, 0.18, 'sine', 0.04, this.busWin, 0.42);   
    },
    fsPlasma(){
      this.ensure();
      
      this._noise(0.70, 480, 1.0, 0.10, this.busWin, 0.00);
      this._voice(58, 0.80, 'sawtooth', 0.10, this.busWin, 0.00); 
      const swell = [196, 261, 330, 392];
      swell.forEach((f, i) => this._voice(f, 0.40, 'sawtooth', 0.055, this.busWin, 0.12 + i * 0.06));
      this._noise(0.30, 1600, 1.4, 0.07, this.busWin, 0.30);      
    },

    
    retrigger(){
      this.ensure();
      this._duckMusic(4);
      
      const ph = [659, 784, 988, 1175];
      ph.forEach((f, i) => this._voice(f, 0.28, 'triangle', 0.18, this.busWin, i * 0.10));
      this._chord(330, [0, 7, 12, 16], 0.5, 'sawtooth', 0.10, this.busWin, 0.30);
    },


    

    
    _tallyStep: 0, _tallyMult: 0, _tallyNext: 0,
    tallyStart(multX){
      this.ensure();
      this._tallyStep = 0; this._tallyMult = multX || 0; this._tallyNext = 0;
      if(multX >= 40 && this.ctx && !State.muted){
        this._voice(40, 1.1, 'sine', 0.32, this.busWin);   
        this._duckMusic(6);                                
      }
    },
    tally(now){
      if(State.muted || !this.ctx) return;
      if(now < this._tallyNext) return;                    
      this._tallyNext = now + 60;
      const m = this._tallyMult, s = this._tallyStep++;
      let f = 560;                                         
      if(m > 2) f = Math.min(1180, 560 + s * (m >= 10 ? 36 : 24));   

      const v = m >= 40 ? 0.05 : 0.075;
      this._voice(f,      0.05,  'triangle', v,         this.busSfx);
      this._voice(f * 2,  0.035, 'sine',     v * 0.45,  this.busSfx, 0.004);   
    },


    

    
    _antiKick: null, _antiActive: false,
    anticipationStart(){
      this.ensure();
      if(!this.ctx || this._antiActive) return;
      this._antiActive = true;
      const t = this.ctx.currentTime;
      
      if(this.busMusic){
        const g = this.busMusic.gain;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0.02, t + 0.10);
      }
      
      if(this.rushSource && this.rushSource.filt){
        const rf = this.rushSource.filt.frequency;
        rf.cancelScheduledValues(t); rf.setValueAtTime(Math.max(200, rf.value), t);
        rf.linearRampToValueAtTime(8000, t + 2.4);
      }
      
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
      this._antiKick = setInterval(kick, 1000);   
    },
    anticipationStop(){
      if(this._antiKick){ clearInterval(this._antiKick); this._antiKick = null; }
      if(!this._antiActive) return;
      this._antiActive = false;
      if(this.ctx && this.busMusic){
        const t = this.ctx.currentTime;
        const g = this.busMusic.gain;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0.25, t + 0.5);   
      }
    },


    
    
    startIdleMusic(){
      if(this.musicId === 'idle') return;
      this._stopMusic();
      this.musicId = 'idle';

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

      if(!this._playSampleMusic('bonus_loop', 0.95, 1.0)){
        if(id === 'bonus_mega'){
          
          this._startMusicVoice(id, { root: 165, chord: [0, 5, 12, 17, 24], rate: 0.30, wave: 'sawtooth', vol: 0.16 });
        } else if(id === 'bonus_hot'){
          
          this._startMusicVoice(id, { root: 220, chord: [0, 4, 7, 12], rate: 0.45, wave: 'triangle', vol: 0.13 });
        } else {
          
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
      const lfo = this.ctx.createOscillator();   
      lfo.type = 'sine'; lfo.frequency.value = opts.rate;
      const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 400;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 700; filt.Q.value = 1.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(opts.vol, t0 + 1.2);   
      lfo.connect(lfoGain); lfoGain.connect(filt.frequency);
      voices.forEach(v => { v.connect(filt); v.start(t0); });
      filt.connect(g); g.connect(this.busMusic);
      lfo.start(t0);
      this.musicVoice = { voices, lfo, filt, gain: g };
    },

    
    _startHappyLoop(){
      if(!this.ctx) return;
      const ctx = this.ctx, bus = this.busMusic;
      const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
      const PROG = [ [60,64,67], [55,59,62], [57,60,64], [53,57,60] ]; 
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
        for(let i=0;i<len;i++) d[i]=(vrnd()*2-1)*Math.pow(1-i/len,4);  
        const s=ctx.createBufferSource(); s.buffer=b;
        const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=8000;
        const g=ctx.createGain(); g.gain.value=vol;
        s.connect(f); f.connect(g); g.connect(bus); s.start(t);
      };
      const tick = () => {
        if(this.musicId !== 'idle' || !this.ctx) return;
        const t = ctx.currentTime + 0.04, step = this._happyStep, chord = PROG[Math.floor(step/4) % 4];
        note(mtof(chord[step % 3] + 12), t, beat*0.85, 'triangle', 0.05);              
        if(step % 4 === 0) note(mtof(chord[0] - 12), t, beat*3.6, 'sine', 0.09);        
        if(step % 2 === 0) note(mtof(MEL[(step>>1) % MEL.length] + 12), t, beat*1.5, 'square', 0.026); 
        hat(t, step % 2 ? 0.018 : 0.010);                                              
        this._happyStep = (step + 1) % 16;
        this._happyTimer = setTimeout(tick, beat*1000);
      };
      tick();
    },
    _stopMusic(){
      if(this._happyTimer){ clearTimeout(this._happyTimer); this._happyTimer = null; }
      this.musicId = null;   
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

  

  

  
  Sound._makeSeamless = function (buf, fadeSec) {
    try {
      if (!this.ctx || !buf) return buf;
      const sr = buf.sampleRate, ch = buf.numberOfChannels, n = buf.length;
      const F = Math.min(Math.floor(sr * (fadeSec || 0.12)), (n / 2) | 0);
      if (F < 8) return buf;
      const L = n - F;                                   
      const out = this.ctx.createBuffer(ch, L, sr);
      for (let c = 0; c < ch; c++) {
        const inD = buf.getChannelData(c), o = out.getChannelData(c);
        for (let i = 0; i < L; i++) {
          if (i < F) {
            const t = i / F, fi = Math.sin(t * Math.PI / 2), fo = Math.cos(t * Math.PI / 2);
            o[i] = inD[i] * fi + inD[i + L] * fo;        
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
          
          if (clip.loop && (clip.id === 'reel_loop' || clip.id === 'coin_cascade')) {
            this.buffers[clip.id] = this._makeSeamless(this.buffers[clip.id], 0.12);
          }
        } catch (e) {  }
      }

      

      
      try {
        const playingSample = !!(this.musicVoice && this.musicVoice._sample);
        if (this.musicId === 'idle' && !playingSample) {
          this.musicId = null; this.startIdleMusic();
        } else if (this.musicId && this.musicId !== 'idle' && !playingSample) {
          const m2 = this.musicId; this.musicId = null; this.startBonusMusic(m2);
        }
      } catch (e) {}
    }).catch(() => {  });
  };
  const _soundEnsure = Sound.ensure.bind(Sound);
  Sound.ensure = function () { _soundEnsure(); this.loadSamples(); };
  const _wrapSample = (name, id, bus, vol) => {
    if (typeof Sound[name] !== 'function') return;
    const orig = Sound[name].bind(Sound);
    Sound[name] = function (...a) {
      this.ensure();
      if (this._playSample(id, bus, vol)) {
        
        if (name === 'spinStart') this._startRush();
        if (name === 'reelStop' && a[0] === REELS - 1) this._stopRush();
        return;
      }
      return orig(...a);
    };
  };
  _wrapSample('click', 'ui_click', 'busSfx', 0.7);

  

  

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


  Sound.bet = function () {
    this.ensure();
    const t = (this.ctx && this.ctx.currentTime) || 0;
    if (this._lastBetAt && t - this._lastBetAt < 0.03) return;
    this._lastBetAt = t;
    if (this._playSample('ui_bet', 'busSfx', 0.6)) return;
    this.tick();
  };

  
  
  Sound.scatterLand = function (n) {
    this.ensure();
    if (State.muted || !this.ctx) return;
    n = Math.max(1, n | 0);
    const id = n >= 3 ? 'scatter_trigger' : 'scatter_tick';
    if (this._playSample(id, 'busWin', 0.95)) { if (n >= 3) this._duckMusic(4); return; }
    const t0 = this.ctx.currentTime;
    const base = 523 * Math.pow(2, (Math.min(n, 6) - 1) * 0.18);   
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
    if (n >= 3) this._duckMusic(4);   
  };

  
  try {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        || location.protocol === 'file:' || /[?&]debug=/.test(location.search)) {
      window.__SND = Sound;
    }
  } catch (e) {}

  
  
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

  
  function bumpBet(dir){
    if(State.phase !== Phase.IDLE) return;
    if(State.autoplay.active) return;   
    const newIdx = State.betIdx + dir;
    if(newIdx<0 || newIdx>=State.betLevels.length) return;
    State.betIdx = newIdx;
    State.betX6 = State.betLevels[State.betIdx];
    try { Sound.bet(); } catch(e){}   
    updateHUD();
  }

  
  const STEPPER_BTNS = [];
  function bindHoldable(sprite,onInc){
    let holdTimer=null, rapidTimer=null, interval=100;
    const release=() => {
      clearTimeout(holdTimer); clearTimeout(rapidTimer);
      holdTimer=rapidTimer=null; interval=100;
      sprite._pressed = false;
      sprite._targetScale = sprite._baseScale;        
    };
    sprite.eventMode='static'; sprite.cursor='pointer';
    sprite._pressed = false;
    sprite._baseScale = sprite.scale.x;
    sprite._displayScale = sprite.scale.x;
    sprite._targetScale = sprite.scale.x;
    STEPPER_BTNS.push(sprite);
    sprite.on('pointerdown', () => {
      
      if(sprite._disabled || State.phase !== Phase.IDLE || State.autoplay.active) return;
      sprite._pressed = true;
      sprite._targetScale = sprite._baseScale * 0.86;  
      try { Sound.click(); } catch(e){}
      onInc();
      holdTimer=setTimeout(function startRapid(){
        interval=100;
        (function fire(){ onInc(); rapidTimer=setTimeout(fire,Math.max(40,interval-=8)); })();
      },380);
    });
    
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

  


  
  
  const _balAnim = { fromX6: 0, toX6: 0, t0: 0, dur: 0, popT0: 0 };
  let _lastBalanceShownX6 = 0;
  function updateHUD(){
    const newBalX6 = State.balanceX6;
    if(newBalX6 !== _lastBalanceShownX6 && _lastBalanceShownX6 > 0 && !isReduced()){

      const isCredit = newBalX6 > _lastBalanceShownX6;
      _balAnim.fromX6 = _lastBalanceShownX6;
      _balAnim.toX6 = newBalX6;
      _balAnim.t0 = performance.now();
      _balAnim.dur = isCredit ? 700 : 450;
      if(isCredit){
        _balAnim.popT0 = performance.now();

        try { Sound.tallyStart((newBalX6 - _balAnim.fromX6) / Math.max(1, State.betX6)); } catch(e){}
      }
    } else {
      
      _balAnim.t0 = 0;
      balValue.text = fmtMoney(newBalX6);
    }
    _lastBalanceShownX6 = newBalX6;
    betValue.text = fmtMoney(State.betX6);

    
    { const _bs = betValue._baseScale || betValue.scale.x; betValue.scale.set(_bs);
      const _bMax = 94; if(betValue.width > _bMax) betValue.scale.set(_bs * _bMax / betValue.width); }  

    

    const broke = State.balanceX6 < State.betX6;
    if(broke !== spinBtnBroke){
      spinBtnBroke = broke;
      spinBtn.alpha = broke ? 0.5 : 1.0;
      spinBtn.tint = broke ? 0x4a4a4a : 0xffffff;
    }
    minusBtn.alpha = State.betIdx<=0 ? 0.4 : 1.0;
    plusBtn.alpha = State.betIdx>=State.betLevels.length-1 ? 0.4 : 1.0;

    minusBtn._disabled = State.betIdx<=0;
    plusBtn._disabled  = State.betIdx>=State.betLevels.length-1;
    minusBtn.cursor = minusBtn._disabled ? 'default' : 'pointer';
    plusBtn.cursor  = plusBtn._disabled  ? 'default' : 'pointer';
    if(buyBar.visible){
      const canBuy = State.balanceX6 >= buyCostX6();
      buyBar.alpha = canBuy ? 1.0 : 0.45;
    }
    syncDeliveredBar();   
  }
  
  function tickBalanceCoinUp(now){

    
    
    const _fitBal = () => {
      if(balValue.text !== balValue._lastFitTxt || balValue._fit == null){
        balValue._lastFitTxt = balValue.text;
        balValue.scale.set(1);                                   
        balValue._fit = (balValue._maxW && balValue.width > balValue._maxW)
          ? balValue._maxW / balValue.width : 1;
      }
      return balValue._fit;
    };
    if(!_balAnim.t0) {
      
      const f = _fitBal();
      if(Math.abs(balValue.scale.x - f) > 0.001) balValue.scale.set(f);
      return;
    }
    const el = now - _balAnim.t0;
    const p = Math.min(1, el / _balAnim.dur);
    const ease = 1 - Math.pow(1 - p, 3);
    const curX6 = Math.round(_balAnim.fromX6 + (_balAnim.toX6 - _balAnim.fromX6) * ease);
    balValue.text = fmtMoney(curX6);

    if(_balAnim.toX6 > _balAnim.fromX6) { try { Sound.tally(now); } catch(e){} }
    const f = _fitBal();
    
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

  
  let GX=0, GY=0, GW=0, GH=0;     
  function coverFit(s,w,h){
    const k = Math.max(w/s.texture.width, h/s.texture.height) * 1.04;
    s.scale.set(k);
  }
  function drawReelFrame(){

    
    const gap = Math.max(6, CELL*0.055);
    const cw  = CELL - gap;
    const rad = Math.max(9, CELL*0.13);
    frostMask.clear();
    for(let r=0;r<REELS;r++)
      frostMask.roundRect(GX+r*CELL+gap/2, GY, cw, GH, rad).fill(0xffffff);
    frameG.clear();
    for(let r=0;r<REELS;r++){
      const x = GX+r*CELL+gap/2;

      for(let g=4;g>=1;g--)
        frameG.roundRect(x-g*2.5, GY-g*2.5, cw+g*5, GH+g*5, rad+g*2.5)
          .stroke({ color:0xff8ab8, width:2.5, alpha:0.05 });
      
      frameG.roundRect(x, GY, cw, GH, rad).fill({ color:0x140a20, alpha:0.72 });
      
      for(let v=1;v<=3;v++)
        frameG.roundRect(x+v*4.5, GY+v*4.5, cw-v*9, GH-v*9, Math.max(2,rad-v*4.5))
          .stroke({ color:0x05020a, width:9, alpha:0.11 });
      
      frameG.roundRect(x, GY, cw, GH, rad)
        .stroke({ color:0xf5f7fa, width:Math.max(2.5,CELL*0.02), alpha:0.55 });
      frameG.roundRect(x+3, GY+3, cw-6, GH-6, rad-3)
        .stroke({ color:0xff5a9c, width:1.6, alpha:0.35 });

      
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

    

    
    const haloPad = gap*0.9;
    const haloR   = rad + haloPad;
    for(let g=3;g>=1;g--){
      frameG.roundRect(GX - haloPad - g*1.5, GY - haloPad - g*1.5,
                       GW + 2*(haloPad + g*1.5), GH + 2*(haloPad + g*1.5), haloR + g*1.5)
        .stroke({ color:0xff5a9c, width:1.4, alpha:0.05 });
    }
    frameTopG.clear();
  }
  
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

  
  
  let _portalEnv = 0;
  function drawPortal(now){
    frameTopG.clear();
    if(!(GW>0)) return;

    
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
      frameTopG.roundRect(x,GY,cw,GH,rad).stroke({color:0xff8ad8,width:4,alpha:(0.09+0.16*lvl)*env});   
      frameTopG.roundRect(x+1.5,GY+1.5,cw-3,GH-3,Math.max(2,rad-1.5)).stroke({color:0xfff4fb,width:1.6,alpha:(0.10+0.22*lvl)*env});   
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

  

  

  function drawBtnAuras(now){
    btnAuraG.clear();

    

    
    
    if(isReduced()) return;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.0044);    
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

      const pulse = reduced ? 0.5 : (Math.sin(now*0.00157 + c.ph) + 1) * 0.5;
      const scale = 0.85 + 0.20*pulse;     
      const aBoost = 0.80 + 0.20*pulse;    
      const r = cornerR * scale;

      
      
      for(let g=3;g>=1;g--){
        cornerJewelsG.circle(c.x, c.y, r*(0.9 + g*0.55))
          .fill({ color:0xff5a9c, alpha: (0.05 + g*0.025) * aBoost });
      }
      
      const s = r*0.95;
      cornerJewelsG.poly([c.x, c.y-s,  c.x+s*0.42, c.y,  c.x, c.y+s,  c.x-s*0.42, c.y])
        .fill({ color:0xf5f7fa, alpha:0.85*aBoost })
        .stroke({ color:0xff8ab8, width:0.8, alpha:0.55*aBoost });
      
      cornerJewelsG.circle(c.x, c.y, r*0.32)
        .fill({ color:0xff5a9c, alpha:0.98 });
      
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

    

    
    
    if(spinning && !reduced){
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);

      spinHalo.circle(cx, cy, R * 0.92)
        .stroke({ color:0xe2ba5e, width:1.8, alpha: 0.55 + 0.30 * pulse });

      
    }
  }
  
  function readInsets(){
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => { const x = parseFloat(cs.getPropertyValue(n)); return isFinite(x) ? x : 0; };
    return { t:v('--sat'), r:v('--sar'), b:v('--sab'), l:v('--sal') };
  }
  function layout(){
    const W=app.screen.width, H=app.screen.height;
    const portrait = H > W*1.05;
    const tiny = H < 330;   

    

    

    const hudPad = tiny ? 6 : 28;

    const hudBot = tiny ? 7 : (portrait ? 24 : 25);
    
    const INS = readInsets();
    const padL = hudPad + INS.l, padR = hudPad + INS.r;
    const padB = hudBot + INS.b, padT = (tiny?4:25) + INS.t;


    

    

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

    const usingDeliveredAny = usingDeliveredBar || usingDeliveredBarWeb;
    const DELIVERED_BAR_PAD = tiny ? 8 : 14;   

    bg.position.set(W/2,H/2); coverFit(bg,W,H);
    frostBg.position.set(W/2,H/2); coverFit(frostBg,W,H);

    bg._baseScale = bg.scale.x;
    frostBg._baseScale = frostBg.scale.x;
    vignette.position.set(W/2,H/2);

    
    
    coverFit(vignette, W, H);
    drawModalScrim(); 


    

    

    
    
    const topRes = portrait ? (tiny?56:140) : (tiny?40:100);

    

    const botRes = usingDeliveredAny
      ? Math.max(portrait ? (tiny?160:220) : (tiny?80:140), (H - deliveredBarTopY) + DELIVERED_BAR_PAD)
      : (portrait ? (tiny?160:220) : (tiny?80:140));
    
    const gridMaxW = W * (portrait ? 0.96 : (tiny?0.72:0.88));

    const gridMaxH = (H - topRes - botRes) - (tiny ? 10 : 0);

    const cellCap = portrait ? 210 : 180;

    
    CELL = Math.max(tiny ? 20 : 34, Math.min(gridMaxW/REELS, gridMaxH/ROWS, cellCap));
    GW = CELL*REELS; GH = CELL*ROWS;
    GX = (W-GW)/2;
    GY = topRes + (H-topRes-botRes-GH)/2;
    if(GY < topRes*0.5) GY = topRes*0.5;

    
    if(usingDeliveredAny){
      const maxBottom = deliveredBarTopY - DELIVERED_BAR_PAD;
      if(GY + GH > maxBottom) GY = Math.max(topRes*0.5, maxBottom - GH);
    }

    reelMask.clear().rect(GX,GY,GW,GH).fill(0xffffff);
    drawReelFrame();
    reelArea.position.set(0,0);

    _gridRect.x = GX; _gridRect.y = GY; _gridRect.w = GW; _gridRect.h = GH;
    try { layoutBuyFab(); } catch(e){}
    swipeZone.hitArea = new PIXI.Rectangle(GX,GY,GW,GH);   

    
    for(let r=0;r<REELS;r++){
      const rl=reels[r];
      rl.col.position.set(GX+r*CELL+CELL/2, GY);
      const sz=CELL*0.9;
      rl.sprites.forEach((s,k) => {
        s.width=sz; s.height=sz;
        s.x=0; s.y=(k-0.5)*CELL + rl.offset;
      });
    }
    
    layoutStickySprites();


    

    

    const framePadT = Math.max(8, CELL*0.13);
    if(portrait){

      
      
      const logoBandH = (topRes - (tiny?10:16)) * 0.62;
      const lk = Math.min(logoBandH / logo.texture.height,
                          Math.min(GW*0.70, W*0.56, 480) / logo.texture.width);
      logo.scale.set(lk);
      logo.position.set(W/2, Math.max(logo.height*0.5+2,
                        GY - framePadT - logo.height*0.5 - (tiny?1:4)));
      logo._baseY = logo.y;
      logo._homeX = logo.x;
    } else {

      
      const logoH = Math.min(72, topRes - 12);

      

      const lk = Math.min(logoH / logo.texture.height, (W * 0.10) / logo.texture.width);
      logo.scale.set(lk);

      const lW = logo.width;
      logo.position.set(padL + 10 + lW * 0.5,
                        padT + 8  + logoH * 0.5);
      logo._baseY = logo.y;
      logo._homeX = logo.x;
    }

    
    if(typeof maxWinCap !== 'undefined'){
      maxWinCap.scale.set(portrait ? (tiny?0.82:1) : 0.92);
      if(portrait) maxWinCap.position.set(W/2, Math.max(11, logo.y - logo.height*0.5 - 7));
      else maxWinCap.position.set(logo.x, logo.y + logo.height*0.5 + 10);
      maxWinCap.visible = !STAKE.replay;
    }

    
    const hudK = Math.min(1.12, Math.max(tiny?0.5:0.62, W/1120));


    

    
    
    balPlaque.visible = false;
    betPlaque.visible = false;
    winPlaque.visible = false;

    
    if(!winValue.text) {

      
      
      const neverPlayed = ((State.stats && State.stats.spins) || 0) === 0 && !((State.lastWinX6 || 0) > 0);
      winValue.text = neverPlayed ? '—' : fmtMoney(State.lastWinX6 || 0);
      winValue.style.fill = THEME.colors.textMuted;
      winLabel.text = socialFilter((State.lastWinX6 || 0) > 0 ? 'LAST WIN' : 'WIN');
    }
    winLabel.alpha = 1; winValue.alpha = 1;


    

    

    if(usingDeliveredBar){
      if(deliveredBarWeb) deliveredBarWeb.visible = false;   
      setNativeBarVisible(false);     
      bottomBarBg.clear();            
      deliveredBar.visible = true;
      deliveredBar.fitBottom(W, H);   
      syncDeliveredBar();             
    } else if(usingDeliveredBarWeb){
      if(deliveredBar) deliveredBar.visible = false;         
      setNativeBarVisible(false);     
      bottomBarBg.clear();            
      deliveredBarWeb.visible = true;
      deliveredBarWeb.fitBottom(W, H);   
      syncDeliveredBar();             
    } else {
    if(deliveredBar) deliveredBar.visible = false;      
    if(deliveredBarWeb) deliveredBarWeb.visible = false;
    setNativeBarVisible(true);        


    
    const barH    = portrait
      ? (tiny ? 110 : 120)                    
      : (tiny ? 60 : 88);                     
    const barW    = Math.min(W - padL - padR, portrait ? W*0.96 : (tiny?W*0.94:980));
    const barX    = (W - barW) / 2;
    const barY    = H - padB - barH;
    const barR    = portrait ? 18 : barH * 0.36;

    

    

    

    
    
    const portraitSpinMaxFromGaps = portrait ? Math.max(70, (barW * 0.98) - 205) : Infinity;
    const spinSz  = portrait
      ? Math.min(barW * 0.26, 94, portraitSpinMaxFromGaps)   

      

      
      : Math.min(barH * 1.62, W * 0.18, 148, tiny ? (barH + 2 * padB - 10) : Infinity, Math.max(48, 2 * (H - barY - barH/2 - Math.max(4, padB))));

    
    
    const utilSz  = (tiny && !portrait)
      ? Math.max(28, Math.min(barH * 0.50, 38))
      : portrait
        ? 40   
        : Math.max(44, Math.min(barH * 0.34, 52));
    const stepSz  = (tiny && !portrait)
      ? Math.max(22, Math.min(barH * 0.40, 28))
      : portrait
        ? 40   
        : Math.max(44, Math.min(barH * 0.30, 48));

    
    
    const stepHit = (b) => { const s = b.scale.x || 1; const hp = Math.max(44 / s, stepSz + 14) / s; b.hitArea = new PIXI.Rectangle(-hp/2, -hp/2, hp, hp); };  


    

    
    bottomBarBg.clear();
    if (skin) {

      

      bottomBarBg
        .roundRect(barX - 1, barY + 3, barW + 2, barH + 4, barR + 1)
        .fill({ color: 0x000000, alpha: 0.55 });
      skin.panelInto(bottomBarBg, barX, barY, barW, barH, barR, { edge: 1.8 });
      
      skin.goldLineInto(bottomBarBg, barX + barR * 0.6, barY + 1, barW - barR * 1.2, 1.4);
    } else {
      bottomBarBg
      
      .roundRect(barX-1, barY+3, barW+2, barH+4, barR+1)
      .fill({ color:0x000000, alpha:0.65 })
      
      .roundRect(barX, barY, barW, barH, barR)
      .fill({ color:0x120e09, alpha:0.99 })
      
      .roundRect(barX+1, barY+1, barW-2, barH*0.55, barR-1)
      .fill({ color:0x2d2822, alpha:0.55 })
      
      .roundRect(barX+barW*0.18, barY+barH*0.18, barW*0.64, barH*0.64,
                 Math.min(barH*0.32, 30))
      .fill({ color:0xba852d, alpha:0.22 })
      
      .roundRect(barX+barW*0.25, barY+barH*0.60, barW*0.50, barH*0.30, 12)
      .fill({ color:0x1e1914, alpha:0.18 })
      
      .roundRect(barX+barR*0.6, barY+1, barW-barR*1.2, 1.2, 0.6)
      .fill({ color:0xf1e9d7, alpha:0.20 })
      
      .roundRect(barX, barY, barW, barH, barR)
      .stroke({ color:0xe9bf5a, width:1.2, alpha:0.42 })
      
      .roundRect(barX+2, barY+2, barW-4, barH-4, barR-2)
      .stroke({ color:0x000000, width:0.8, alpha:0.65 });
    }


    

    

    
    const labelSz = Math.max(tiny ? 0.92 : 0.72, Math.min(1.0, barH/72));
    balLabel.scale.set(labelSz*0.95); balValue.scale.set(labelSz*1.25);
    winLabel.scale.set(labelSz*0.95); winValue.scale.set(labelSz*1.25);
    winLabel._baseScale = labelSz*0.95; winValue._baseScale = labelSz*1.25;   
    betLabel.scale.set(labelSz*0.95); betValue.scale.set(labelSz*1.25); betValue._baseScale = labelSz*1.25;
    [balLabel, winLabel, betLabel].forEach(t => {
      t.style.letterSpacing = 2.0;
      t.style.fill = 0xd6ab46;
    });
    [balValue, betValue, winValue].forEach(t => {
      t.style.fill = 0xf6f1e6;
      t.style.letterSpacing = 0;   
    });

    
    if (skin) {
      [balLabel, winLabel, betLabel].forEach(t => {
        t.style.fontFamily = BAR_FONT; t.style.fontWeight = '700'; t.style.stroke = null;
      });
      [balValue, betValue, winValue].forEach(t => {
        t.style.fontFamily = BAR_FONT; t.style.fontWeight = '700'; t.style.stroke = null;
      });
    }


    
    const utilGap = 6;
    const utilXCenter = barX - utilSz - 10;
    if(utilXCenter > padL + utilSz*0.5 + 2 && !portrait){
      
      const ux = utilXCenter;
      [btnInfo, btnSettings, btnSound].forEach((b, i) => {
        const s = utilSz / b._icon.texture.width;
        b._baseScale = s; b._displayScale = s; b.scale.set(s); b._apply && b._apply();
        b.position.set(ux, barY + barH*0.5 + (i-1)*(utilSz + utilGap));

        

        const hpW = Math.max(56, utilSz + 16) / s, hpH = (utilSz + utilGap) / s;
        b.hitArea = new PIXI.Rectangle(-hpW/2, -hpH/2, hpW, hpH);
        b.visible = true;
      });
    } else {

      

      

      

      
      
      const portraitTopIcons = portrait ? [btnInfo, btnSettings, btnSound, btnTurbo, btnAutoplay] : [btnInfo, btnSettings, btnSound];   
      const railSz = Math.max(34, utilSz * 0.82);
      const startX = barX + 10;
      const topIconY = portrait
        ? (barY - railSz*0.5 - 8)    
        : (barY - railSz*0.5 - 6);
      const railPitch = railSz + 12;   
      portraitTopIcons.forEach((b, i) => {
        const s = railSz / b._icon.texture.width;
        b._baseScale = s; b._displayScale = s; b.scale.set(s); b._apply && b._apply();
        b.position.set(startX + railPitch*0.5 + i*railPitch, topIconY);   

        

        const hp = railPitch / s;
        b.hitArea = new PIXI.Rectangle(-hp/2, -hp/2, hp, hp);
        b.visible = true;
      });
    }

    const GAP = 6;   


    
    let buyBtnH, buyBtnW;
    let spinCenterX, autoCenterX, turboCenterX;

    if(portrait){

      

      
      

      const rowY1 = barY + barH * 0.30;   
      const rowY2 = barY + barH * 0.74;   


      
      
      buyBtnH = 46;

      buyBtnW = Math.min(barW * 0.72, 300);
      const _railH = Math.max(34, utilSz*0.82);
      if(buyBar.visible){
        const buyY = barY - _railH - 8 - buyBtnH - 6;   
        buyBar.position.set(barX + (barW - buyBtnW)/2, buyY);   
        buyBar._inlineW = buyBtnW; buyBar._inlineH = buyBtnH;
      }


      

      
      
      const safeRightX = barX + barW - 14 - spinSz - GAP - 4;
      const safeLeftX  = barX + Math.max(16, barR);


      

      
      
      balLabel.anchor.set(0, 0.5); balValue.anchor.set(0, 0.5);
      balLabel.position.set(safeLeftX, rowY1 - 12);
      balValue.position.set(safeLeftX, rowY1 + 10);

      
      
      balValue._maxW = barW*0.44;
      balValue.scale.set(1);
      balValue._fit = (balValue.width > balValue._maxW) ? balValue._maxW/balValue.width : 1;
      balValue._lastFitTxt = balValue.text;
      balValue.scale.set(balValue._fit);


      
      
      betLabel.alpha = 0;


      

      

      
      winLabel.anchor.set(0.5, 0.5); winValue.anchor.set(0.5, 0.5);

      
      winLabel._baseScale = labelSz*1.06; winLabel.scale.set(winLabel._baseScale);      
      winValue._baseScale = labelSz*1.40*1.16; winValue.scale.set(winValue._baseScale); 

      

      

      
      
      const _barRight = (barX + barW - 14 - spinSz) - 10;
      const _balRight = balValue.x + balValue.width + 12;   
      const _slotLeft = _balRight + 8;
      const _slotW    = Math.max(54, _barRight - _slotLeft);
      winValue._maxW  = _slotW - 6;             
      winLabel._maxW  = _slotW;
      winValue._slotRight = _barRight;          
      const _winCx = (_slotLeft + _barRight) / 2;   
      winLabel.position.set(_winCx, rowY1 - 14);
      winValue.position.set(_winCx, rowY1 + 13);
      winLabel.alpha = 1; winValue.alpha = 1;


      

      
      fitW(minusBtn, stepSz); fitW(plusBtn, stepSz);
      [minusBtn, plusBtn].forEach(b => {
        b._baseScale = b.scale.x;
        b._displayScale = b.scale.x;
        b._targetScale = b.scale.x;
      });
      const TIGHT_GAP = 11;       
      const GROUP_GAP = 12;       


      

      

      

      

      const minusCenterX = barX + 14 + stepSz/2;
      const _spinLeftX   = (barX + barW - 14 - spinSz/2) - spinSz/2;   
      const _availForVal = (_spinLeftX - GROUP_GAP - (minusCenterX - stepSz/2)) - (2*stepSz + 2*TIGHT_GAP);
      const betValueWidth = Math.max(34, Math.min(barW*0.34, 134, _availForVal));   
      const betValCap = Math.min(barW*0.30, 100, betValueWidth - 8);   
      const _bvBase = betValue._baseScale || betValue.scale.x;
      betValue.scale.set(_bvBase);
      if(betValue.width > betValCap) betValue.scale.set(_bvBase * betValCap / betValue.width);
      const betValueX    = minusCenterX + stepSz/2 + TIGHT_GAP + betValueWidth/2;
      const plusCenterX  = betValueX + betValueWidth/2 + TIGHT_GAP + stepSz/2;
      minusBtn.position.set(minusCenterX, rowY2);
      plusBtn.position.set(plusCenterX, rowY2);
      stepHit(minusBtn); stepHit(plusBtn);   
      betValue.anchor.set(0.5, 0.5);
      betValue.position.set(betValueX, rowY2);
      betValue.alpha = 1;


      
      spinCenterX = barX + barW - 14 - spinSz/2;
      autoCenterX = 0;   

      const stepperRightEdge = plusCenterX + stepSz/2;
      const autoLeftEdge     = autoCenterX - utilSz/2;
      const turboRightEdge   = autoLeftEdge - TIGHT_GAP;
      const turboLeftMin     = stepperRightEdge + GROUP_GAP;

      

      turboCenterX = 0;
      void turboRightEdge; void turboLeftMin;
      if(turboAllowed()){
        btnTurbo.eventMode = 'static';
        try { refreshTurboBtn(); } catch(e){}
      } else {
        btnTurbo.visible = false; btnTurbo.eventMode = 'none'; State.turboMode = 0;
      }


      

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

      

      

      let lx = barX + (tiny ? 8 : 14);

      buyBtnH = barH - (tiny ? 6 : 10);
      buyBtnW = Math.min(barW*0.18, 180);
      if(buyBar.visible && !tiny){
        buyBar.position.set(lx, barY + 5);
        buyBar._inlineW = buyBtnW; buyBar._inlineH = buyBtnH;
        lx += buyBtnW + 12;
      } else if(tiny){

        buyBar.visible = false; buyBar._inlineW = 0; buyBar._inlineH = 0;
      }

      balLabel.anchor.set(0, 0.5); balValue.anchor.set(0, 0.5);
      balLabel.position.set(lx, barY + barH*0.30);
      balValue.position.set(lx, barY + barH*0.66);
      let segBal = tiny ? Math.min(barW*0.32, 130) : Math.min(barW*0.20, 180);

      

      
      if(!tiny){
        const _betChipW0   = Math.min(Math.max(barW*0.13, 96), 120);
        const _clusterLeft = (barX + barW) - spinSz - 2*utilSz - 2*stepSz - _betChipW0 - 8*GAP;
        segBal = Math.max(56, Math.min(segBal, _clusterLeft - lx - GAP));
      }
      balValue._maxW = segBal - 12;   
      balValue._fit = null;           
      lx += segBal;


      
      
      if(tiny){
        winLabel.alpha = 0; winValue.alpha = 0;
      } else {
        winLabel.alpha = 1; winValue.alpha = 1;
        const segWin = Math.min(barW*0.14, 110);
        winValue._maxW = segWin - 6;   
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
      stepHit(minusBtn); stepHit(plusBtn);   


      

      
      
      let betGuardX;   
      if(!tiny){
        betValue.anchor.set(0.5, 0.5);

        
        
        const betChipW = Math.min(Math.max(barW*0.13, 96), 120);
        const clusterRightX = betEndX + stepperBlockW;               
        const plusCX  = clusterRightX - stepSz/2;
        const betVX   = plusCX  - stepSz/2 - GAP - betChipW/2;
        const minusCX = betVX   - betChipW/2 - GAP - stepSz/2;

        
        
        const betRowCY = barY + barH*0.50;
        minusBtn.position.set(minusCX, betRowCY);
        plusBtn.position.set(plusCX,  betRowCY);
        betValue.position.set(betVX, betRowCY);
        betLabel.anchor.set(0.5, 0.5);
        betLabel.position.set(betVX, barY + barH*0.22);   
        betGuardX = minusCX - stepSz/2;
      } else {

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


      
      if(winLabel.alpha > 0 && (winLabel.position.x + 54) > (betGuardX - 24)){
        winLabel.alpha = 0; winValue.alpha = 0;
      }

      
      
      stepHit(minusBtn); stepHit(plusBtn);   

      const spinRightEdge = barX + barW - GAP;
      spinCenterX  = spinRightEdge - spinSz/2;

      
      
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


      

      
      if (skin) {
        
        if (winLabel.alpha > 0) {
          const segWin = Math.min(barW * 0.14, 110);
          const wbH = Math.min(barH * 0.62, 56);
          skin.bannerInto(bottomBarBg, winValue.x - segWin / 2, barY + barH * 0.5 - wbH / 2, segWin, wbH);
        }
        
        if (minusBtn.visible && betValue.alpha > 0) {
          const stPadX = stepSz * 0.5 + 8;
          const stLeft = minusBtn.x - stPadX;
          const stRight = plusBtn.x + stPadX;
          const stH = Math.min(barH * 0.62, 56);
          skin.stepperInto(bottomBarBg, stLeft, barY + barH * 0.5 - stH / 2, stRight - stLeft, stH);
        }
        
        const circR = utilSz * 0.62;
        skin.circleInto(bottomBarBg, btnAutoplay.x, btnAutoplay.y, circR);
        if (btnTurbo.visible) skin.circleInto(bottomBarBg, btnTurbo.x, btnTurbo.y, circR);
      }
    }


    

    
    function drawBtnChip(cx, cy, r, active, accentColor){

    }
    const chipR = utilSz * 0.62;

    

    

    if(btnTurbo.visible){
      const turboTint = State.turboMode === 2 ? THEME.colors.pink
                      : State.turboMode === 1 ? THEME.colors.accent
                      : null;
      drawBtnChip(btnTurbo.x, btnTurbo.y, chipR, State.turboMode > 0, turboTint);
    }
    drawBtnChip(btnAutoplay.x, btnAutoplay.y, chipR,
                State.autoplay.active, THEME.colors.blue);

    drawBtnChip(plusBtn.x,  plusBtn.y,  stepSz*0.62, false, null);
    drawBtnChip(minusBtn.x, minusBtn.y, stepSz*0.62, false, null);

    const railChipR = Math.max(20, chipR * 0.82);
    [btnInfo, btnSettings, btnSound].forEach(b => {
      if(b && b.visible){
        drawBtnChip(b.x, b.y, railChipR, b._active === true, THEME.colors.cyan);
      }
    });


    fitW(spinBtn, spinSz);
    spinBtn._baseScale = spinBtn.scale.x;
    spinBtn._displayScale = spinBtn.scale.x;
    const spinCY = portrait ? (barY + barH*0.72) : (barY + barH*0.5);
    spinBtn.position.set(spinCenterX, spinCY);
    spinHalo.clear();


    const balLegW = Math.min(206*hudK, W*0.34)*1.3; fitW(balPlaque, balLegW);
    const betLegW = (portrait ? Math.min(W*0.33,196) : Math.min(180*hudK, W*0.27))*1.3;
    fitW(betPlaque, betLegW);
    const winLegW = Math.min(170*hudK, W*0.28); fitW(winPlaque, winLegW);
    const betCY   = barY + barH*0.5;

    btnSound._icon.texture=tex(State.muted?'icMute':'icSound');
    btnSound._setActive(!State.muted);
    
    btnHistory.visible = false;
    btnFullscreen.visible = false;


    
    
    if(buyBar.visible && buyBar._inlineW){
      buyBg.visible = false;   
      const bx = buyBar.position.x;          
      const by = buyBar.position.y;          
      const bw = buyBar._inlineW;
      const bh = buyBar._inlineH;

      

      const cham = Math.min(bh * 0.32, 14);    

      const chamBox = (X, Y, W, H, C) => [
        X + C,     Y,                 
        X + W - C, Y,                 
        X + W,     Y + C,             
        X + W,     Y + H - C,         
        X + W - C, Y + H,             
        X + C,     Y + H,             
        X,         Y + H - C,         
        X,         Y + C,             
      ];
      const PINK      = 0xe9bf5a;
      const PINK_SOFT = 0xfadf8e;
      const PINK_DEEP = 0xba852d;
      const SMOKE_W   = 0xf1e9d7;
      const canAfford = State.balanceX6 >= buyCostX6();
      const t = performance.now();
      const breathe = canAfford ? (0.55 + 0.45 * Math.sin(t * 0.0028)) : 0;
      
      bottomBarBg
        .poly(chamBox(bx-8, by-7, bw+16, bh+14, cham+6))
        .fill({ color: PINK, alpha: 0.05 * breathe })
        .poly(chamBox(bx-6, by-5, bw+12, bh+10, cham+4))
        .fill({ color: PINK, alpha: 0.08 * breathe })
        .poly(chamBox(bx-4, by-3, bw+8,  bh+6,  cham+2))
        .fill({ color: PINK, alpha: 0.12 * breathe })
        .poly(chamBox(bx-2, by-1, bw+4,  bh+2,  cham+1))
        .fill({ color: PINK_SOFT, alpha: 0.22 * breathe })
        
        .poly(chamBox(bx-1, by+3, bw+2, bh+3, cham+1))
        .fill({ color: 0x000000, alpha: 0.55 })
        
        .poly(chamBox(bx, by, bw, bh, cham))
        .fill({ color: canAfford ? 0x2d2822 : 0x1e1914, alpha: 0.97 });

      
      const topH = bh * 0.52;
      bottomBarBg
        .poly(chamBox(bx+1.2, by+1.2, bw-2.4, topH, cham-1))
        .fill({ color: canAfford ? 0x2a2317 : 0x19130c, alpha: 0.95 })
        .poly(chamBox(bx+1.2, by+1.2, bw-2.4, topH, cham-1))
        .fill({ color: PINK, alpha: canAfford ? 0.22 : 0.07 })
        
        .rect(bx+cham*0.6, by+bh*0.42, bw-cham*1.2, bh*0.18)
        .fill({ color: PINK_DEEP, alpha: canAfford ? 0.18 : 0.04 })
        
        .rect(bx+cham*0.7, by+1.6, bw-cham*1.4, 1.4)
        .fill({ color: SMOKE_W, alpha: canAfford ? 0.55 : 0.20 })
        
        .rect(bx+cham*0.5, by+bh*0.30, bw-cham, 0.8)
        .fill({ color: SMOKE_W, alpha: canAfford ? 0.16 : 0.05 })
        
        .poly(chamBox(bx, by, bw, bh, cham))
        .stroke({
          color: canAfford ? PINK_SOFT : PINK_DEEP,
          width: canAfford ? 1.8 : 1.2,
          alpha: canAfford ? 0.95 : 0.50,
        })
        
        .poly(chamBox(bx+1.5, by+1.5, bw-3, bh-3, cham-1.5))
        .stroke({ color: 0x000000, width: 0.6, alpha: 0.55 });

      const cornerPipAlpha = canAfford ? 0.90 : 0.30;
      
      bottomBarBg.circle(bx + cham*0.5, by + cham*0.5, 1.8)
        .fill({ color: SMOKE_W, alpha: cornerPipAlpha });
      
      bottomBarBg.circle(bx + bw - cham*0.5, by + cham*0.5, 1.8)
        .fill({ color: SMOKE_W, alpha: cornerPipAlpha });
      
      bottomBarBg.circle(bx + cham*0.5, by + bh - cham*0.5, 1.8)
        .fill({ color: SMOKE_W, alpha: cornerPipAlpha });
      
      bottomBarBg.circle(bx + bw - cham*0.5, by + bh - cham*0.5, 1.8)
        .fill({ color: SMOKE_W, alpha: cornerPipAlpha });

      
      buyBar.hitArea = new PIXI.Rectangle(0, 0, bw, bh);


      const iconBox = bh * 0.72;
      const iconK = iconBox / Math.max(buyIcon.texture.width, buyIcon.texture.height);
      buyIcon.scale.set(iconK);
      const iconCX = bh * 0.5;       
      buyIcon.position.set(iconCX, bh * 0.5);   
      buyIcon.visible = true;


      
      
      const textColLeft = bh + GAP;
      const textColW    = bw - textColLeft - GAP*2;
      const textCenterX = textColLeft + textColW / 2;

      
      
      buyTitle.anchor.set(0.5, 0.5);
      const titleNatural = 20;       
      const titleScale = Math.min(1, textColW / 110);
      buyTitle.style.fontSize = titleNatural;
      buyTitle.scale.set(titleScale);
      buyTitle.style.fill = THEME.colors.text;
      buyTitle.position.set(textCenterX, bh * 0.5);

      
      buyCost.visible = false;
      buyCost.text = '';
    } else if(buyBar.visible){
      
      buyBg.visible = true;
      const bbW = portrait ? Math.min(W*0.52,250) : Math.min(172*hudK, W*0.24);
      fitW(buyBg, bbW); buyBar._baseScale = 1;
      buyBar.position.set(W/2, barY - buyBg.height*0.5 - 9);
      const bk = portrait ? 0.92 : hudK*0.82;
      buyTitle.scale.set(bk); buyCost.scale.set(bk);
      buyTitle.position.set(0,-buyBg.height*0.22);
      buyCost.position.set(0,-buyBg.height*0.03);
    }
    }   

    
    winDisplay.position.set(W/2, GY+GH*0.5);
    fitW(winFrame, Math.min(640*hudK, GW*1.35, W*0.82));
    bigWinLabel.scale.set(hudK*1.4);
    bigWinLabel.position.set(0,-winFrame.height*0.28);
    
    bigWinAmount.position.set(0, winFrame.height*0.055);


    
    featureBanner.position.set(W/2, GY+GH*0.5);

    
    if(replayBar.visible) layoutReplayBar();

    if(drawerLayer.visible) layoutDrawer();
    if(infoModal.visible) layoutInfoModal();
    if(buyModal.visible) layoutBuyModal();
    if(betMenu.visible) layoutBetMenu();   
    if(introOverlay.visible) layoutIntroOverlay();
  }

  
  const easeOutQuint = p => 1 - Math.pow(1-p,5);

  

  
  function reelEase(p){
    const a=0.10, d=0.34;   
    const S = x => x*x*x*(1 - 0.5*x);            
    const norm = 1 - a*0.5 - d*0.5;
    let pos;
    if(p < a)        pos = a*S(p/a);
    else if(p < 1-d) pos = a*0.5 + (p-a);
    else             pos = a*0.5 + (1-d-a) + d*(0.5 - S((1-p)/d));
    return pos / norm;
  }
  
  const outBack = p => { const c=1.70158; return 1 + (c+1)*Math.pow(p-1,3) + c*Math.pow(p-1,2); };
  
  const easeOutExpo = p => p >= 1 ? 1 : 1 - Math.pow(2, -10 * p);    
  const easeInCubic = p => p * p * p;                                 
  
  const backOutSoft = p => { const c=1.25; return 1 + (c+1)*Math.pow(p-1,3) + c*Math.pow(p-1,2); };

  const popElastic = p => (p <= 0 || p >= 1) ? 0 : Math.sin(p * 9.0) * Math.pow(1 - p, 2.2);


  
  function _godRays(g, cx, cy, R, prog, rot, col, n, alphaMul){
    if(prog <= 0) return;
    n = n || (_gpuWeak ? 7 : 12);
    alphaMul = (alphaMul == null) ? 1 : alphaMul;
    col = col || 0xff2ad0;
    for(let i = 0; i < n; i++){
      const a = rot + (i / n) * Math.PI * 2;
      const len = R * (i % 2 === 0 ? 1.0 : 0.62) * prog;     
      const halfW = R * (0.052 + (i % 3) * 0.014);
      const ux = Math.cos(a), uy = Math.sin(a) * 0.74;       
      const px = -Math.sin(a), py = Math.cos(a) * 0.74;
      const tx = cx + ux * len, ty = cy + uy * len;
      const sh = 0.5 + 0.5 * Math.sin(rot * 6 + i * 1.7);    
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

  

  
  
  function settleCurve(tau){
    if(tau<=0 || tau>=1) return 0;
    // Firm, CLEAN stop: a small single overshoot that decays fast (~1/3 the old
    // amplitude). A larger multi-bounce made symbols visibly keep moving after
    // the reels stopped -- and the win-hero tracks the live symbol position, so
    // the winning symbols drifted during the celebration too (owner-flagged
    // "damping after stop / symbols changing position").
    return 4.2 * tau * Math.exp(-5.2*tau) * Math.sin(tau*6.28319);
  }
  let allReelsSpinning = false;

  
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
  
  function spinReelTo(r,target,dur,delay){
    const rl=reels[r];
    const totalShifts = 20 + r*3;
    const feed=[];
    const buf = Math.floor(vrnd()*SYM_COUNT);
    for(let i=0;i<totalShifts-4;i++) feed.push(randStripSym(r));
    feed.push(target[2],target[1],target[0],buf);  
    rl.feed=feed; rl.feedIdx=0;
    rl.totalShifts=totalShifts;
    rl.from=0; rl.to=totalShifts; rl.scrolled=0; rl.done=0; rl.offset=0;
    rl._prevScr=0; rl.vel=0;
    rl.t0=performance.now()+delay; rl.dur=dur; rl.spinning=true;
    rl.landAt=0; rl.squashStarted=false;
  }
  function quickStopReels(){
    if(_qStopped) return;          
    _qStopped = true;
    const now=performance.now();

    

    

    
    
    reels.forEach((rl, r) => {
      if(!rl.spinning) return;
      rl.from=rl.scrolled; rl.to=rl.totalShifts;
      rl.t0 = now + r*8;
      rl.dur = Math.max(55, Math.min(100, (rl.totalShifts-rl.scrolled)*5));
    });
  }
  
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
      rl.vel = rl.scrolled - rl._prevScr; rl._prevScr = rl.scrolled;   
      const passed=Math.floor(rl.scrolled);
      let guard=0;
      while(rl.done<passed && guard++<200){ shiftReel(rl); rl.done++; }
      rl.offset = (rl.scrolled-Math.floor(rl.scrolled))*CELL;

      

      

      
      if(p<0.025 && !isReduced() && !State.turbo){
        const u=p/0.025;
        rl.offset -= CELL*0.5 * u*u*(1-u)*(1-u);
      }

      

      
      if(p>=0.965 && !rl.squashStarted){ rl.landAt=now; rl.squashStarted=true; }
      if(p>=1){
        
        while(rl.done<rl.totalShifts && guard++<400){ shiftReel(rl); rl.done++; }
        rl.offset=0; rl.spinning=false;

        

        rl._blurAmt = 0;
        rl.vel = 0; rl._prevScr = rl.scrolled;
        if(rl.col.filters === rl.blurArr) rl.col.filters = null;

        Sound.reelStop(r, rl.symbols[1]);
        if(!isReduced()) Sound.tick();

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
    const sz=CELL*0.92, now=performance.now();   
    
    const tm = State.turboMode;
    const symDur  = tm===2 ? 130 : tm===1 ? 165 : 250;
    const symStag = tm===2 ?  18 : tm===1 ?  26 :  40;
    // Firm land-settle: a small positional dip + squash that compresses then
    // springs back and fully settles within one symDur (~250ms) -- restores the
    // "damping" impact the prior crisp-stop had gutted to a dead ~1% snap. The
    // fast decay + the landAt watchdog return symbols to rest, so no win drift.
    const landDip = tm===2 ? 0.09 : tm===1 ? 0.12 : 0.16;
    const landSq  = tm===2 ? 0.035 : tm===1 ? 0.045 : 0.060;
    const reduced = isReduced();

    
    
    const _wActive = revealActive && winCells.length > 0 && !reduced;
    const _wSet = _wActive ? new Set(winCells.map(c => c.r + '_' + c.row)) : null;
    const _wT = _wActive ? (now - revealT0) : 0;
    
    const dtK = _renderPrev ? Math.min(4, (now-_renderPrev)/16.67) : 1;
    _renderPrev = now;
    for(let r=0;r<REELS;r++){
      const rl=reels[r];

      

      if(!rl.blurF){ rl.blurF = new PIXI.BlurFilter({ strength:2, quality:2 }); rl.blurArr=[rl.blurF]; }

      

      

      const spd = (rl.spinning && !reduced) ? Math.abs(rl.vel) : 0;
      const targetBlur = spd>0.12 ? Math.min(1,(spd-0.12)/0.25) : 0;
      if(rl._blurAmt == null) rl._blurAmt = 0;
      const blurDecay = targetBlur > rl._blurAmt ? 0.5 : 0.18;
      rl._blurAmt += (targetBlur - rl._blurAmt) * blurDecay;
      const blurAmt = rl._blurAmt;
      if(blurAmt>0.015){
        if(rl.col.filters!==rl.blurArr) rl.col.filters = rl.blurArr;
        rl.blurF.strength = blurAmt*CELL*0.08;      
        rl.blurF.strengthY = blurAmt*CELL*0.08;      
        rl.blurF.strengthX = blurAmt*CELL*0.012;     
      } else if(rl.col.filters){
        rl.col.filters = null;
      }

      
      
      const wantIdle = (!rl.spinning && !rl.landAt && !reduced) ? 1 : 0;
      if(rl.idleEnv==null) rl.idleEnv = wantIdle;
      rl.idleEnv += (wantIdle - rl.idleEnv) * Math.min(1, (wantIdle?0.055:0.16)*dtK);
      const env = rl.idleEnv;

      
      
      let colDip = 0;
      if(rl.landAt && !reduced)
        colDip = settleCurve((now - rl.landAt) / symDur) * CELL * landDip;
      for(let k=0;k<5;k++){
        const s=rl.sprites[k];
        s.texture=SYM_TEX[rl.symbols[k]];
        s.y=(k-0.5)*CELL + rl.offset + colDip;  
        const base=symScale(s.texture, sz);     
        let sqx=1, sqy=1, rot=0;
        if(rl.landAt && !reduced){

          
          
          const e = settleCurve((now - rl.landAt - Math.max(0,3-k)*symStag) / symDur);
          sqy = 1 - e*landSq;          
          sqx = 1 + e*landSq*0.6;      
        }

        

        
        const sym = rl.symbols[k];
        const isPremium = sym >= 6;   
        
        if(s.tint !== 0xffffff) s.tint = 0xffffff;
        if(env > 0.0015){
          const isCrown = sym === 7;
          const isStar  = sym === 8;
          const isSeven = sym === 6;

          

          

          const ampK = isCrown ? 1.7 : isStar ? 1.25 : isSeven ? 1.35 : 0.42;
          const ph = r*0.9 + k*1.7;
          // Idle "breathing" trimmed to near-static. The vertical POSITION bob was
          // the reels still visibly BOUNCING after they stopped (up to ~4.4px on
          // premium symbols, forever) -- removed entirely. Scale + rotation life
          // cut to a whisper so the board isn't frozen-dead. Symbols now settle
          // and STAY (expert clean stop); the premium tint-pulse below is
          // colour-only, no motion.
          const wob = Math.sin(now*0.0021 + ph) * 0.008 * ampK * env;
          sqx *= 1 + wob;
          sqy *= 1 + wob;
          rot   = Math.sin(now*0.0015 + ph) * 0.005 * ampK * env;
         if(isPremium){

          

          
          
          const pulsePer = isCrown ? 2400 : isSeven ? 2800 : 3600;
          const pulseP = ((now + ph * 200) % pulsePer) / pulsePer;
          
          const pulseEnv = 1 - Math.abs(pulseP * 2 - 1);
          
          const pulseMax = isCrown ? 0.18 : isSeven ? 0.12 : 0.08;
          const lift = pulseEnv * pulseMax * env;

          if(lift > 0.005){
            const ch = Math.round(255 - lift * 28);

            const tR = 255;
            const tG = isCrown ? ch : isSeven ? Math.round(255 - lift * 18) : ch;
            const tB = isCrown ? Math.round(ch + lift * 14) : isSeven ? ch - 18 : ch;
            s.tint = (tR << 16) | (Math.max(0, tG) << 8) | Math.max(0, tB);
          }
         }
        }

        if(_wSet && sym < 6 && k >= 1 && k <= 3 && _wSet.has(r + '_' + (k-1))){
          const ct = _wT - (k-1) * 55;                  
          if(ct > 0){
            const popE = 1 - Math.pow(1 - Math.min(1, ct/240), 3);   
            const breathe = 0.5 + 0.5*Math.sin(now*0.006 + r*0.7);   
            const amp = 0.10 * popE * (0.62 + 0.38*breathe);
            sqx *= 1 + amp; sqy *= 1 + amp;
          }
        }
        s.scale.set(base*sqx, base*sqy);   
        s.rotation = rot;
      }
      if(rl.landAt && now-rl.landAt > symDur + 3*symStag + 80) rl.landAt=0;
    }
  }

  function delay(ms){ return new Promise(r => setTimeout(r,ms)); }

  
  const winFx = { on:false, t0:0, tier:0, dur:0, fastFwd:false,
    countX6Target:0, countX6Display:0, popT0:0,
    tAnt:0, tLand:0, landFired:false,   

    
    customLabel: '' };

  
  
  const waitWinOrSkip = (ms) => new Promise((res) => {
    const t0 = performance.now();
    const tick = () => { if(winFx.fastFwd || (performance.now() - t0) >= ms) return res(); requestAnimationFrame(tick); };
    tick();
  });
  let winCells = [];      
  let winLines = [];      
  let revealActive = false, revealT0 = 0, revealDur = 0, winVfxTier = 0;

  function cellCenter(r,row){
    return { x:GX+(r+0.5)*CELL, y:GY+(row+0.5)*CELL };
  }


  

  let _fireClock = 0;
  const DUST_COLS = [0xff5ab0, 0xc8a0ff, 0x7ef0c0, 0x96d7ff, 0xfff0fa]; // cool-candy spectrum (pink/lavender/mint/cyan/white) — was pink-only, read monochrome
  function spawnFire(x,y){
    
    particles.push({ kind:'fire', x, y, vx:(vrnd()-0.5)*0.5,
      vy:-0.7-vrnd()*1.0, life:920+vrnd()*680, t:0,
      color:DUST_COLS[(vrnd()*DUST_COLS.length)|0], r:2.5+vrnd()*3.5 });
  }
  function drawWinVfx(now, active){
    winShadowG.clear(); winGlowAddG.clear(); winFrameG.clear(); winSheenG.clear();
    for(const rl of reels){ for(const gl of rl.glows) gl.visible=false; for(const hr of rl.heroes){ hr.visible=false; hr.rotation=0; hr.skew.x=0; }
      for(const sp of rl.sprites){ if(sp._winHidden){ sp.alpha=1; sp._winHidden=false; } } }   
    if(!active){ winGlowLayer.filters=null; return; }
    const reduced = isReduced();
    const tier = winVfxTier || 1;
    const vfx  = tier >= 2 && !reduced;          
    const half = CELL*0.5, rad = CELL*0.19;
    winGlowLayer.filters = vfx ? [winBloomFilter] : null;
    for(const c of winCells){
      const cc = cellCenter(c.r, c.row);
      const ct = (now - revealT0) - c.r*55;       
      const appear = reduced ? 1 : Math.max(0, Math.min(1, ct/300));
      if(appear<=0) continue;
      
      const ease = appear<1 ? 1-Math.pow(1-appear,3) : 1;
      const boxK = reduced ? 1 : (1.13-0.13*ease) * (1+Math.sin(now*0.0042+c.r*0.7)*0.018);
      const bw = CELL*0.95*boxK, bh = bw;
      const x0 = cc.x-bw/2, y0 = cc.y-bh/2;

      
      if(vfx){
        const gp = 0.78 + 0.22*Math.sin(now*0.0045 + c.r);
        for(let g=3; g>=1; g--){
          
          winGlowAddG.circle(cc.x, cc.y, half*(0.5+g*0.34))
            .fill({ color: g===1?0xffd9ec:0xff2f93, alpha:(g===1?0.16:0.07)*gp*appear });
        }
      }

      
      winShadowG.ellipse(cc.x, cc.y+half*0.72, half*0.6*ease, half*0.19*ease)
        .fill({ color:0x000000, alpha:0.3*appear });


      

      

      if(vfx){
        const _sym  = reels[c.r].symbols[c.row+1];
        if(_sym >= 6){
          const _stex = SYM_TEX[_sym];

          

          

          
          const _o = reels[c.r].sprites[c.row+1];           
          const hr = reels[c.r].heroes[c.row+1];
          hr.visible = true;
          hr.texture = _stex;
          hr.anchor.set(_o.anchor.x, _o.anchor.y);
          // Robust scale + REST position. Previously derived from
          // _o.worldTransform / getGlobalPosition(): if that read came back
          // zero/stale the hero scaled to 0 or jumped off-screen -> the winning
          // symbol VANISHED (owner-flagged "winning symbols hide"), and it tracked
          // the live land-wobble -> the symbol drifted. symScale + cellCenter
          // (cc, already computed above) never fail and never move.
          const _baseS = symScale(_stex, CELL * 0.92);

          

          

          

          

          const _ct2   = Math.max(0, ct);
          const _antic = _ct2 < 70 ? -0.05 * Math.sin((_ct2/70)*Math.PI) : 0;          
          const _rise  = 1 - Math.pow(1 - Math.min(1, _ct2/240), 3);                    
          const _punch = Math.sin(Math.min(Math.PI, Math.max(0,_ct2-55)/85)) * Math.exp(-_ct2/280); 
          const _breathe = _ct2 > 620 ? 0.013 * Math.sin(now*0.0047 + c.r*0.7) : 0;     
          const _s = _baseS * (1 + _antic + 0.10*_rise + 0.14*_punch + _breathe);
          hr.position.set(cc.x, cc.y);
          hr.scale.set(_s, _s);
          hr.skew.x = 0; hr.rotation = 0;
          hr.alpha = 1;
          _o.alpha = 0; _o._winHidden = true;               

          
          const _sw = (_ct2 - 110) / 360;
          if(_sw > 0 && _sw < 1){
            const _swA = Math.sin(_sw*Math.PI);              
            const _sx  = cc.x - half*1.25 + _sw*(CELL*1.5);  
            const _hy  = half*0.96;
            winSheenG.poly([                                 
              _sx-7, cc.y-_hy, _sx+7, cc.y-_hy, _sx+20, cc.y+_hy, _sx+6, cc.y+_hy,
            ]).fill({ color:0xffe6f4, alpha:0.22*_swA*appear });
            winSheenG.poly([                                 
              _sx+2, cc.y-_hy, _sx+6, cc.y-_hy, _sx+15, cc.y+_hy, _sx+11, cc.y+_hy,
            ]).fill({ color:0xffffff, alpha:0.30*_swA*appear });
          }
        } else {

          

          

          const _fct = Math.max(0, ct);
          const _fsw = (_fct - 120) / 400;
          if(_fsw > 0 && _fsw < 1){
            const _fa  = Math.sin(_fsw * Math.PI);                 
            const _fx  = cc.x - half*0.74 + _fsw*(half*1.48);      
            const _fhy = half*0.84, _bw = half*0.055, _sl = half*0.085;
            winSheenG.poly([                                       
              _fx-_bw, cc.y-_fhy, _fx+_bw, cc.y-_fhy, _fx+_bw+_sl, cc.y+_fhy, _fx-_bw+_sl, cc.y+_fhy,
            ]).fill({ color:0xffe6f4, alpha:0.15*_fa*appear });
            winSheenG.poly([                                       
              _fx, cc.y-_fhy, _fx+_bw*0.6, cc.y-_fhy, _fx+_bw*0.6+_sl, cc.y+_fhy, _fx+_sl, cc.y+_fhy,
            ]).fill({ color:0xffffff, alpha:0.22*_fa*appear });
          }
        }
      }


      
      winFrameG.roundRect(x0-2.5, y0-2.5, bw+5, bh+5, rad+2.5)
        .stroke({ color:0xff2f93, width:Math.max(3,CELL*0.052), alpha:0.22*appear });
      winFrameG.roundRect(x0, y0, bw, bh, rad)
        .stroke({ color:0xffe6f4, width:Math.max(2,CELL*0.027), alpha:0.92*appear });


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
          ]).fill({ color:0xffd9ec, alpha:0.12*fk*appear });   
        }
        for(let n=0;n<2;n++){
          const rt = (((pt + n*420) % 840) / 840);

          
          winGlowAddG.circle(cc.x, cc.y, half*(0.5 + rt*1.7))
            .stroke({ color:_sym===8?0x7fe7ff:_sym===7?0xff5ab0:0xff007f,
              width:Math.max(2,CELL*0.032)*(1-rt), alpha:0.5*(1-rt)*(1-rt)*appear });
        }

        
        if(_sym === 7 && vfx){
          const ringR = half * 1.08;
          const dashN = 24;
          const rot0 = now * 0.00038;   
          const rot1 = -now * 0.00055;  

          for(let d = 0; d < dashN; d++){
            const a = rot0 + (d / dashN) * Math.PI * 2;
            const a2 = a + Math.PI / dashN * 0.55;
            winGlowAddG.moveTo(cc.x + Math.cos(a) * ringR, cc.y + Math.sin(a) * ringR)
              .arc(cc.x, cc.y, ringR, a, a2)
              .stroke({ color: 0xff2f93, width: 1.2, alpha: 0.55 * appear });
          }
          
          for(let g = 0; g < 8; g++){
            const a = rot0 + (g / 8) * Math.PI * 2;
            const gx = cc.x + Math.cos(a) * ringR;
            const gy = cc.y + Math.sin(a) * ringR;
            winGlowAddG.circle(gx, gy, 1.8)
              .fill({ color: 0xffe6f4, alpha: 0.85 * appear });
          }

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
    if(x<=1)  return 1; 
    if(x<3)   return 2;
    if(x<10)  return 3;
    if(x<50)  return 4;
    if(x<250) return 5;   
    return 6;
  }
  const TIER_LABELS=['','RETURNED','WIN','NICE WIN','BIG WIN','MEGA WIN','EPIC WIN'];

  

  

  

  
  const TIER_COLORS=[0,0x6a5870,0xf5f7fa,0xff8ab8,0xff5a9c,0xff007f,0xff0066];
  const TIER_DUR=[0,800,1500,2200,2800,3400,4000];


  
  function showLinesPreview(){
    if(State.phase !== Phase.IDLE || allReelsSpinning) return;   // never overlay a spin/win (was bleeding full-width payline filaments over the reels)
    linesPreviewT0 = performance.now();
    linesPreviewDur = isReduced() ? 600 : 2200;
    linesPreviewG.alpha = 0;   
  }
  
  function _ptAlong(flat, f){
    const n = flat.length / 2;
    if(n < 2) return [flat[0] || 0, flat[1] || 0];
    const fi = Math.max(0, Math.min(1, f)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(fi)), lf = fi - i;
    return [flat[i*2] + (flat[(i+1)*2] - flat[i*2]) * lf, flat[i*2+1] + (flat[(i+1)*2+1] - flat[i*2+1]) * lf];
  }

  

  

  function drawEnergyFilament(g, pts, col, prog, pulse, opt){
    if(!pts || pts.length < 4) return;
    opt = opt || {};
    const k = (CELL / 90) * (opt.scale || 1);
    const core = opt.core != null ? opt.core : 0xfff6fb;
    const p = Math.max(0, Math.min(1, pulse || 0));
    const a = Math.max(0, Math.min(1, prog == null ? 1 : prog));
    const S = (w, al, c) => g.poly(pts, false).stroke({ color: c, width: Math.max(0.5, w * k), alpha: al * a, cap: 'round', join: 'round' });
    S(12 + 3 * p,   0.10 + 0.05 * p, col);   
    S(6 + 1.5 * p,  0.20 + 0.07 * p, col);   
    S(2.6 + 0.6 * p, 0.46 + 0.10 * p, col);  
    S(1.2 + 0.3 * p, 0.62,           core);  
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
    if(State.phase !== Phase.IDLE || allReelsSpinning){ linesPreviewT0 = 0; linesPreviewG.alpha = 0; linesPreviewG.clear(); return; }   // kill the preview the instant a spin/win starts
    const t = (now - linesPreviewT0) / linesPreviewDur;
    if(t >= 1){
      linesPreviewT0 = 0;
      linesPreviewG.alpha = 0;
      linesPreviewG.clear();
      return;
    }

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

        
        
        const sp = reels[r] && reels[r].sprites[pat[r] + 1];
        if(sp){ const lp = linesPreviewG.toLocal(sp.getGlobalPosition()); pts.push(lp.x, lp.y); }
        else { const cc = cellCenter(r, pat[r]); pts.push(cc.x, cc.y); }
      }

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

        

        
        const corePulse = 0.5 + 0.5 * Math.sin(now * 0.005 + idx);
        const sheen = isReduced() ? -1 : ((now * 0.0006 + idx * 0.13) % 1);
        linesPreviewG.poly(drawn, false).stroke({ color: 0x14060f, width: 6.5, alpha: 0.30, cap: 'round', join: 'round' }); 
        drawEnergyFilament(linesPreviewG, drawn, col, 1, corePulse, { sheen, core: 0xffe6f4, scale: 0.95 });
      }
    });
  }

  function showLineWins(grid,lineWins){
    winCells=[]; winLines=[];
    lineWins.forEach(w => {
      const pat=LINES[w.line];
      // skip malformed/short entries — never draw a beam through unlit cells if a
      // server line_win lacks a valid line index or count (would default to 0).
      if(!pat || !(w.count>=3)) return;
      winLines.push({ line:w.line, count:w.count });
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

      
      
      const lastR = w.count - 1;
      const lastCC = cellCenter(lastR, pat[lastR]);
      const lineX6 = Math.round(betX6 * w.payLineBet / NLINES);
      setTimeout(() => {
        if(!revealActive) return;
        spawnFlyUpAmount(lastCC.x, lastCC.y - CELL * 0.30, lineX6);
      }, 100 + lastR * 55);

      try { setTimeout(() => { if(revealActive && (winVfxTier|0) >= 2) Sound.winLine(lineIdx, w.count); }, 60 + lineIdx * 90); } catch(e){}
    });
  }
  function showScatterCells(grid){
    for(let r=0;r<REELS;r++) for(let row=0;row<ROWS;row++)
      if(grid[r][row]===STAR) winCells.push({ r, row });
  }


  

  
  let _silenceUntil = 0;   
  async function microSilence(tier){
    if(isReduced()) return;            
    const ms = tier >= 6 ? 240 : tier >= 5 ? 200 : 160;
    _silenceUntil = performance.now() + ms;

    
    try { if(typeof bg !== 'undefined') bg._tA = 0.62; } catch(e){}
    await delay(ms);
  }

  function celebrate(mx100,amountX6,labelOverride){
    const tier=winTier(mx100);

    winFx.customLabel = '';
    if(tier===1 && !COMPLY.allow_ldw_celebration){
      
      bigWinLabel.text='RETURNED';
      bigWinLabel.style.fill=0x9988aa;
      bigWinLabel.style.stroke = { color:0x4a3a5a, width:2, join:'round' };
      bigWinAmount.text=fmtMoney(amountX6);
      bigWinAmount.style.fill = 0xf5f7fa;
      winFx.on=true; winFx.t0=performance.now(); winFx.tier=1; winFx.dur=800;
      winFx.countX6Target = amountX6;
      winFx.countX6Display = amountX6;   
      winFx.popT0 = 0;
      Sound.tick();
      return;
    }
    Sound.win(tier);

    
    stage.addChild(winDisplay);
    bigWinLabel.text=socialFilter(labelOverride||TIER_LABELS[tier]);
    const tierCol = TIER_COLORS[tier] || 0xff007f;
    
    bigWinLabel.style.fill = 0xf5f7fa;
    bigWinLabel.style.stroke = { color: tierCol, width: 3, join: 'round' };

    bigWinAmount.style.fill = 0xf5f7fa;
    
    bigWinAmount.text = fmtMoney(0);
    winFx.on = true;
    winFx.t0 = performance.now();
    winFx.tier = tier;
    winFx.dur = isReduced() ? 600 : Math.min(COMPLY.max_animation_ms, TIER_DUR[tier]||2200);
    winFx.countX6Target = amountX6;
    winFx.countX6Display = 0;
    winFx.popT0 = 0;    
    winFx.landFired = false;
    winFx._arc = null;  

    
    
    const _antMs = isReduced() ? 0 : (tier >= 5 ? 320 : tier >= 3 ? 240 : 150);
    winFx.tAnt  = _antMs;
    winFx.tLand = _antMs + (isReduced() ? 1 : Math.max(360, (winFx.dur - _antMs) * 0.55));
    if(tier>=2 && !isReduced()){ try { Sound.winAnticipate(tier); Sound.tallyStart(mx100/100); } catch(e){} }   

    if(tier>=2 && !isReduced()) spawnParticles(app.screen.width/2, GY+GH*0.42, tier*4, tier);
    if(tier>=4 && !isReduced()){ shakeAmount=tier*3; shakeT0=performance.now(); }
    
    if(tier>=5 && !isReduced() && !STAKE.replay){ _camPushT0 = performance.now(); }

    if(tier>=4 && !isReduced()) spawnCascade(tier, false, 0.45);
  }


  

  

  
  async function playFsTransition(){
    if(isReduced()){ return new Promise(res => setTimeout(res, 200)); }

    

    spawnFsPortal();
    shakeAmount = 8;
    shakeT0 = performance.now();
    try { Sound.feature(); } catch(e){}
    await new Promise(res => setTimeout(res, 880));
  }


  

  

  

  

  function playCandyBurstIntro(count, mode){
    if(isReduced() || !app) return Promise.resolve();
    const W = app.screen.width, H = app.screen.height, cx = W / 2, cy = H / 2;
    const ov = new PIXI.Container(); ov.eventMode = 'none'; stage.addChild(ov);
    const dim = new PIXI.Graphics().rect(-30, -30, W + 60, H + 60).fill({ color: 0x0e0722, alpha: 0 }); ov.addChild(dim);
    const partG = new PIXI.Graphics(); partG.blendMode = 'add'; ov.addChild(partG);
    const flash = new PIXI.Graphics().rect(-30, -30, W + 60, H + 60).fill({ color: 0xffffff }); flash.alpha = 0; ov.addChild(flash);
    const card = new PIXI.Container(); card.position.set(cx, cy); card.alpha = 0; card.scale.set(0.2); ov.addChild(card);
    const big = Math.min(W * 0.12, 104);
    const t1 = new PIXI.Text({ text: 'FREE SPINS', style: { fontFamily: THEME.type.familyDisplay, fontSize: big * 0.7, fill: 0xffe24a, align: 'center', stroke: { color: 0xd1356f, width: 7, join: 'round' } } });
    t1.anchor.set(0.5); t1.position.set(0, -big * 0.42); card.addChild(t1);
    const t2 = new PIXI.Text({ text: '×' + (Number.isFinite(+count) ? Math.trunc(+count) : 10), style: { fontFamily: THEME.type.familyDisplay, fontSize: big, fill: 0xff7ad0, align: 'center', stroke: { color: 0xffffff, width: 8, join: 'round' } } });
    t2.anchor.set(0.5); t2.position.set(0, big * 0.4); card.addChild(t2);
    const CAND = [0xff5ab0, 0x8be4ff, 0xffe24a, 0xb86fda, 0xffffff, 0xff7ad0];
    const N = _gpuWeak ? 18 : (H > W * 1.05 ? 26 : 42);
    const P = [];
    for(let i = 0; i < N; i++){
      const a = (i / N) * Math.PI * 2 + (vrnd() - 0.5) * 0.6, sp = 8 + vrnd() * 13;
      P.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, r: 5 + vrnd() * 9, col: CAND[i % CAND.length], dia: vrnd() < 0.5 });
    }
    const backOut = (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
    let burst = false, shake = 0;
    const t0 = performance.now(), DUR = 1350;
    try { if(Sound._duckMusic) Sound._duckMusic(5); } catch(e){}
    return new Promise((res) => {
      const tick = () => {
        if(!ov.parent){ res(); return; }   
        const t = (performance.now() - t0) / DUR;
        dim.alpha = Math.min(0.5, (t / 0.12) * 0.5);
        if(t >= 0.12){
          if(!burst){ burst = true; shake = 16; flash.alpha = 0.9; }
          partG.clear();
          const al = Math.max(0, 1 - (t - 0.12) / 0.62);
          for(const p of P){
            p.vy += 0.5; p.x += p.vx; p.y += p.vy; p.vx *= 0.985;
            if(al <= 0) continue;
            if(p.dia){ const s = p.r; partG.poly([p.x, p.y - s, p.x + s * 0.6, p.y, p.x, p.y + s, p.x - s * 0.6, p.y]).fill({ color: p.col, alpha: al }); }
            else partG.circle(p.x, p.y, p.r).fill({ color: p.col, alpha: al });
          }
          flash.alpha = Math.max(0, flash.alpha - 0.07);
          shake *= 0.86; ov.position.set((vrnd() - 0.5) * shake, (vrnd() - 0.5) * shake);
        }
        if(t >= 0.30){ const tt = Math.min(1, (t - 0.30) / 0.32); card.alpha = Math.min(1, tt * 2.5); card.scale.set(0.2 + 0.8 * backOut(tt)); }
        if(t >= 0.84){ ov.alpha = Math.max(0, 1 - (t - 0.84) / 0.16); }
        if(t >= 1){ try { ov.destroy({ children: true }); } catch(e){} res(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

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
    try { Sound.fsCrystal(); } catch(e){}   
    const t0 = performance.now(), DUR = 1500;
    await new Promise(res => {
      function step(){
        const now = performance.now(), t = (now - t0) / DUR;
        if(t >= 1){ backdropG.destroy(); bloomG.destroy(); shardG.destroy(); starG.destroy(); res(); return; }
        const outA = t > 0.74 ? Math.max(0, 1 - (t - 0.74) / 0.26) : 1;   
        
        backdropG.clear();
        const bdA = Math.min(1, t / 0.14) * (1 - Math.max(0, (t - 0.80) / 0.20)) * 0.46;
        backdropG.rect(0, 0, W, H).fill({ color: 0x06040c, alpha: bdA });
        
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
    try { Sound.fsPlasma(); } catch(e){}   
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
        
        heatG.clear();
        const hH = gh * 1.1 * surgeE;
        for(let k = 3; k >= 1; k--){
          heatG.ellipse(cx, baseY - hH * 0.42, gw * 0.5 * (0.58 + k * 0.18), hH * 0.6 * (0.5 + k * 0.2))
            .fill({ color: k === 1 ? 0xffd9ec : 0xff2f93, alpha: (k === 1 ? 0.10 : 0.05) * surgeE * outA });
        }
        
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
        
        const flashP = Math.max(0, 1 - Math.abs(t - 0.52) / 0.12) * outA;
        if(flashP > 0){
          for(let k = 3; k >= 1; k--){
            plasmaG.circle(cx, cy, CELL * (1 + k * 0.8) * flashP)
              .fill({ color: k === 1 ? 0xffffff : 0xff2f93, alpha: (k === 1 ? 0.16 : 0.07) * flashP });
          }
        }
        
        const ringP = Math.max(0, (t - 0.50) / 0.30);
        if(ringP > 0 && ringP < 1){
          const e = 1 - Math.pow(1 - ringP, 3), R = CELL * (0.6 + e * 2.6), ra = (1 - ringP) * (1 - ringP) * 0.8;
          plasmaG.circle(cx, cy, R    ).stroke({ color: 0xff007f, width: (1 - ringP) * 7 + 1,   alpha: ra * 0.7 });
          plasmaG.circle(cx, cy, R - 6).stroke({ color: 0xffe6f4, width: (1 - ringP) * 4 + 0.5, alpha: ra });
        }
        
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


  

  

  
  function _drawBolt(g, x0, y0, x1, y1, offs, prog, flick, scale){
    scale = scale || 1;
    const segs = offs.length + 1;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;                 
    const amp = Math.min(64, len * 0.16);
    const pts = [x0, y0];
    for(let s = 1; s < segs; s++){
      const f = s / segs, taper = Math.sin(f * Math.PI); 
      pts.push(x0 + dx * f + px * offs[s-1] * amp * taper, y0 + dy * f + py * offs[s-1] * amp * taper);
    }
    pts.push(x1, y1);
    const totalPts = pts.length / 2;
    const drawN = Math.max(2, Math.ceil(totalPts * Math.min(1, prog)));
    const path = pts.slice(0, drawN * 2);
    g.poly(path, false).stroke({ color: 0xff007f, width: 11 * scale,  alpha: 0.28 * flick });  
    g.poly(path, false).stroke({ color: 0xff5ab0, width: 5.5 * scale, alpha: 0.72 * flick });  
    g.poly(path, false).stroke({ color: 0x7fe7ff, width: 2.6 * scale, alpha: 0.48 * flick });  
    g.poly(path, false).stroke({ color: 0xffffff, width: 1.8 * scale, alpha: 0.95 * flick });  
    return pts;
  }
  async function playMegaLogoCeremony(){
    if(isReduced()){ return new Promise(res => setTimeout(res, 300)); }
    const W = app.screen.width, H = app.screen.height;
    const gw = REELS * CELL, gh = ROWS * CELL, gx = GX, gy = GY;
    const cx = W / 2, cy = gy + gh * 0.5;                  
    const backdropG = new PIXI.Graphics();
    const bloomG = new PIXI.Graphics(); bloomG.blendMode = 'add';
    const arcG   = new PIXI.Graphics(); arcG.blendMode = 'add';

    
    const crownS = new PIXI.Sprite(TEX.logo); crownS.anchor.set(0.5);
    const crownMax = Math.min(W * 0.25, H * 0.33, 240);                   
    const lk = Math.min(crownMax / crownS.texture.width, crownMax / crownS.texture.height);

    

    

    
    const crownRimC = new PIXI.Sprite(TEX.logo); crownRimC.anchor.set(0.5); crownRimC.tint = 0x7fe7ff; crownRimC.blendMode = 'add';
    const crownRimM = new PIXI.Sprite(TEX.logo); crownRimM.anchor.set(0.5); crownRimM.tint = 0xff2f93; crownRimM.blendMode = 'add';

    

    const crownRimBack = new PIXI.Sprite(TEX.logo); crownRimBack.anchor.set(0.5); crownRimBack.tint = 0xbff4ff; crownRimBack.blendMode = 'add';

    
    
    const _crownSurf = !_gpuWeak;
    const crownFxG  = _crownSurf ? new PIXI.Graphics() : null;
    const crownMask = _crownSurf ? new PIXI.Sprite(TEX.logo) : null;  
    if(_crownSurf){ crownFxG.blendMode = 'add'; crownMask.anchor.set(0.5); crownFxG.mask = crownMask; }

    
    const crownGlow = new PIXI.Graphics();
    for(let _i = 6; _i >= 1; _i--) crownGlow.circle(0, 0, crownMax * 0.5 * (0.45 + _i * 0.17)).fill({ color: _i > 3 ? 0xff5ab0 : 0xffa6e0, alpha: 0.055 });
    crownGlow.blendMode = 'add'; crownGlow.position.set(cx, cy);
    stage.addChild(backdropG, bloomG, crownGlow, crownRimBack, arcG, crownRimC, crownRimM, crownS);   
    if(_crownSurf) stage.addChild(crownMask, crownFxG);                      
    crownS.position.set(cx, cy);

    
    
    let _crownRig = null, _crownRigBaseScale = 1, _crownRigBigwinFired = false;
    if (_spineReady && _spinePool) {
      try {
        _crownRig = _spinePool.acquire({ symbol: 'crown' });
        stage.addChild(_crownRig.view);
        _crownRig.view.position.set(cx, cy);
        _crownRig.play('idle');
        
        const _rb = _crownRig.view.getBounds().rectangle;
        const _rmax = Math.max(_rb.width || 1, _rb.height || 1);
        _crownRigBaseScale = crownMax / _rmax;
        crownS.visible = false; 
      } catch(e) { _crownRig = null; crownS.visible = true; if(STAKE.debug) console.warn('[spine] mega acquire failed:', e); }
    }
    const srcs = [
      [gx, gy], [gx + gw, gy], [gx, gy + gh], [gx + gw, gy + gh],
      [gx + gw * 0.5, gy], [gx + gw * 0.5, gy + gh],
      [gx, gy + gh * 0.5], [gx + gw, gy + gh * 0.5],
    ];
    const BOLT_N = _gpuWeak ? 4 : 7;                      
    const bolts = [];
    for(let i = 0; i < BOLT_N; i++){
      const offs = [];
      for(let s = 0; s < 7; s++) offs.push((vrnd() - 0.5) * 2);   
      const branches = [];
      const nBr = vrnd() > 0.4 ? 2 : 1;                            
      for(let b = 0; b < nBr; b++){
        const boffs = []; for(let s = 0; s < 4; s++) boffs.push((vrnd() - 0.5) * 2);
        branches.push({ at: 0.30 + vrnd() * 0.42, ang: (vrnd() - 0.5) * 1.7, len: 0.20 + vrnd() * 0.28, offs: boffs });
      }
      bolts.push({ src: srcs[i % srcs.length], offs, branches, t0: 0.14 + (i / BOLT_N) * 0.40 });
    }
    shakeAmount = 7; shakeT0 = performance.now();
    try { Sound.feature(); } catch(e){}
    let shook = false;
    const t0 = performance.now(), DUR = 1900;             
    let _chargeSnd = null; try { _chargeSnd = Sound.megaCharge(DUR / 1000 * 0.84); } catch(e){}   
    await new Promise(res => {
      function step(){
        const now = performance.now(), t = (now - t0) / DUR;
        if(t >= 1){ backdropG.destroy(); bloomG.destroy(); crownGlow.destroy(); arcG.destroy(); if(crownFxG){ crownFxG.mask = null; crownFxG.destroy(); } if(crownMask) crownMask.destroy(); crownRimBack.destroy(); crownRimC.destroy(); crownRimM.destroy(); crownS.destroy(); if (_crownRig && _spinePool) { try { _spinePool.release(_crownRig); } catch(e) {} _crownRig = null; } res(); return; }

        
        backdropG.clear();
        const bdEnv = Math.min(1, t / 0.14) * (1 - Math.max(0, (t - 0.86) / 0.14));
        const bdA = bdEnv * 0.40;
        if(bdA > 0.001){
          const vR = Math.max(W, H) * 0.62;
          for(let k = 5; k >= 1; k--){
            backdropG.circle(cx, cy, vR * (0.55 + k * 0.16)).fill({ color: 0x18092e, alpha: bdA * 0.18 * (k / 5) });
          }
          backdropG.rect(0, 0, W, H).fill({ color: 0x18092e, alpha: bdA * 0.16 });   
        }
        
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
        
        if (_crownRig) {
          _crownRig.view.position.set(cx + jx, cy + jy);
          _crownRig.view.scale.set(_crownRigBaseScale * sIn * pop);
          _crownRig.view.alpha = Math.min(1, t / 0.10);
          if (disP > 0 && !_crownRigBigwinFired) {
            _crownRigBigwinFired = true;
            _crownRig.play('bigwin');
          }
        }
        
        const ccx = cx + jx, ccy = cy + jy, crScl = lk * sIn * pop, chw = crownMax * sIn * pop * 0.5;
        const heat = Math.min(1, charge * 0.85 + disP * 1.5);             
        
        crownRimC.position.set(ccx - 2.6, ccy + 0.6); crownRimC.scale.set(crScl * 1.045); crownRimC.alpha = (0.08 + 0.42 * heat) * crownS.alpha;
        crownRimM.position.set(ccx + 2.6, ccy - 0.6); crownRimM.scale.set(crScl * 1.045); crownRimM.alpha = (0.08 + 0.42 * heat) * crownS.alpha;

        crownRimBack.position.set(ccx, ccy); crownRimBack.scale.set(crScl * 1.12); crownRimBack.alpha = (0.10 + 0.30 * heat) * crownS.alpha;
        if(_crownSurf){   
        
        crownMask.position.set(ccx, ccy); crownMask.scale.set(crScl);
        crownFxG.clear();
        if(crownS.alpha > 0.02){
          
          crownFxG.rect(ccx - chw * 1.35, ccy - chw * 1.35, chw * 2.7, chw * 2.7)
            .fill({ color: disP > 0 ? 0xffffff : 0xff2f93, alpha: (0.05 + 0.17 * charge + disP * 0.55) * crownS.alpha });
          
          const _sw = (now * 0.0012) % 1, _swA = Math.sin(_sw * Math.PI);
          const _sx = ccx - chw * 1.35 + _sw * chw * 2.7;
          crownFxG.poly([_sx - chw*0.07, ccy - chw*1.35, _sx + chw*0.07, ccy - chw*1.35, _sx + chw*0.24, ccy + chw*1.35, _sx + chw*0.10, ccy + chw*1.35])
            .fill({ color: 0xffffff, alpha: 0.18 * _swA * (0.5 + 0.5 * charge) * crownS.alpha });
          
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
        }   

        
        bloomG.clear();
        const plateA = 0.55 + 0.45 * Math.min(1, charge + disP);
        const plateR = crownMax * (0.62 + 0.30 * charge) + crownMax * 0.45 * Math.sin(Math.min(Math.PI, disP * Math.PI));
        
        for(let k = 3; k >= 1; k--){
          bloomG.ellipse(cx, cy + crownMax * 0.46, plateR * (0.46 + k * 0.20), plateR * (0.10 + k * 0.05) * 0.55)
            .fill({ color: k === 1 ? 0xffe6f4 : 0xff2ad0, alpha: (k === 1 ? 0.14 : 0.06) * plateA });
        }
        
        bloomG.circle(cx, cy, plateR * 1.45).fill({ color: 0xff2ad0, alpha: 0.05 * plateA });
        bloomG.circle(cx, cy, plateR * 1.05).fill({ color: 0xff2ad0, alpha: 0.09 * plateA });
        bloomG.circle(cx, cy, plateR * 0.70).fill({ color: 0xffd9ec, alpha: 0.10 * plateA });
        bloomG.circle(cx, cy, plateR * 0.40).fill({ color: 0xffffff, alpha: 0.07 * plateA });
        
        arcG.clear();
        for(const b of bolts){
          if(t < b.t0) continue;
          const bp = (t - b.t0) / 0.13, prog = Math.min(1, bp);
          if(!b._zapped && bp >= 0.92){ b._zapped = true; try { Sound.megaZap(bolts.indexOf(b)); } catch(e){} }   
          let flick;
          if(bp < 1)        flick = 0.42 + 0.22 * Math.sin(now * 0.09);                             
          else if(t < 0.84) flick = 0.16 + 0.18 * Math.abs(Math.sin(now * 0.011 + b.t0 * 9));      
          else              flick = Math.max(0, 1 - (t - 0.84) / 0.12) * 0.22;                     
          if(flick <= 0.01) continue;
          const mainPts = _drawBolt(arcG, b.src[0], b.src[1], cx, cy, b.offs, prog, flick, 1);
          
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
        
        if(disP > 0){
          const e = 1 - Math.pow(1 - disP, 3), R = crownMax * (0.35 + e * 1.35), ra = (1 - disP) * (1 - disP) * 0.95;
          arcG.circle(cx, cy, R + 6).stroke({ color: 0xff007f, width: (1 - disP) * 9 + 1.5, alpha: ra * 0.85 });
          arcG.circle(cx, cy, R    ).stroke({ color: 0xffe6f4, width: (1 - disP) * 5 + 1,   alpha: ra });
          arcG.circle(cx, cy, R - 7).stroke({ color: 0x7fe7ff, width: (1 - disP) * 4,       alpha: ra * 0.6 });
          if(!shook){ shook = true; shakeAmount = 10; shakeT0 = now; try { Sound.megaChargeStop(_chargeSnd); Sound.megaDischarge(); } catch(e){} }   
        }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }


  
  
  async function showFeatureBanner(text,ms,tier){
    fbText.text = socialFilter(text);
    
    _fbTier = (tier === 'bonus_hot') ? 'hot' : (tier === 'bonus_mega') ? 'mega' : 'standard';
    
    drawFeatureBannerPanel();
    
    stage.addChild(featureBanner);
    featureBanner.alpha = 0;
    featureBanner.scale.set(0.88);
    const t0 = performance.now();
    const inDur = isReduced() ? 180 : 420;
    
    await new Promise(res => {
      function step(){
        const p = Math.min(1, (performance.now() - t0) / inDur);
        
        featureBanner.alpha = Math.min(1, p * 1.6);
        
        const springP = 1 - Math.exp(-6 * p) * Math.cos(p * Math.PI * 1.3);
        featureBanner.scale.set(0.88 + 0.12 * springP);
        if(p < 1) requestAnimationFrame(step);
        else { featureBanner.alpha = 1; featureBanner.scale.set(1); res(); }
      }
      requestAnimationFrame(step);
    });
    
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

    const t1 = performance.now();
    const outDur = isReduced() ? 140 : 280;
    await new Promise(res => {
      function step(){
        const p = Math.min(1, (performance.now() - t1) / outDur);
        const e = p * p;   
        featureBanner.alpha = 1 - e;
        featureBanner.scale.set(1 - 0.06 * e);
        if(p < 1) requestAnimationFrame(step);
        else { featureBanner.alpha = 0; featureBanner.scale.set(1); res(); }
      }
      requestAnimationFrame(step);
    });
  }

  
  let _pendingResult = null;
  let _spinMode = 'base';


  

  

  
  
  let _antGlowRec = null;
  function startAnticipationGlow(fromReel){
    if(isReduced() || _antGlowRec) return;                       
    const g = new PIXI.Graphics(); g.blendMode = 'add'; g.zIndex = 50;
    reelArea.addChild(g);
    const rec = { g, t0: performance.now(), stopAt: 0, alive: true };
    _antGlowRec = rec;
    const x0 = GX + fromReel * CELL, wTot = (REELS - fromReel) * CELL;
    function step(){
      if(!rec.alive) return;
      const now = performance.now();
      let env = Math.min(1, (now - rec.t0) / 200);               
      if(rec.stopAt) env *= Math.max(0, 1 - (now - rec.stopAt) / 260);   
      if(rec.stopAt && env <= 0.001){ rec.alive = false; try { g.destroy(); } catch(e){} if(_antGlowRec === rec) _antGlowRec = null; return; }
      const pulse = 0.5 + 0.5 * Math.sin((now - rec.t0) * 0.009);   
      const a = env * (0.55 + 0.45 * pulse);
      g.clear();
      g.rect(x0, GY, wTot, GH).fill({ color: 0xff2f93, alpha: 0.05 * a });                                   
      g.roundRect(x0 - 6, GY - 6, wTot + 12, GH + 12, 16).stroke({ color: 0xff2f93, width: 6, alpha: 0.22 * a }); 
      g.roundRect(x0 - 2, GY - 2, wTot + 4,  GH + 4,  13).stroke({ color: 0xff8ad0, width: 3, alpha: 0.40 * a }); 
      const bh = CELL * 0.22;                                                                                  
      g.rect(x0, GY, wTot, bh).fill({ color: 0xffd9ec, alpha: 0.10 * a });
      g.rect(x0, GY + GH - bh, wTot, bh).fill({ color: 0xffd9ec, alpha: 0.10 * a });
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function stopAnticipationGlow(){ if(_antGlowRec && !_antGlowRec.stopAt) _antGlowRec.stopAt = performance.now(); }

  function reelsSpinPromise(grid,anticipate){
    return new Promise(resolve => {

      const k = turboK();

      

      const baseDur = Math.max(140, Math.round(440 * k));
      const stagger = Math.max(26,  Math.round(88  * k));
      for(let r=0;r<REELS;r++){
        let dur=baseDur + r*stagger;

        

        if(anticipate && r>=3){
          dur *= (State.turboMode===2 ? 1.4 : State.turboMode===1 ? 1.6 : 1.9);   
        }
        spinReelTo(r,grid[r],dur,0);
      }

      
      if(anticipate && !isReduced()){
        try { Sound.anticipationStart(); } catch(e){}
        try { startAnticipationGlow(3); } catch(e){}   
      }
      _qStopped=false;        
      allReelsSpinning=true;
      onAllReelsStopped = () => {
        if(anticipate){ try { Sound.anticipationStop(); } catch(e){} }
        try { stopAnticipationGlow(); } catch(e){}   
        resolve();
      };
    });
  }

  let _spinLock = false;
  async function startSpin(mode){
    if(_spinLock || allReelsSpinning) return;
    if(State.phase !== Phase.IDLE) return;
    if(STAKE.replay) return;
    try { Sound.anticipationStop(); } catch(e){}   
    try { stopAnticipationGlow(); } catch(e){}     
    mode = mode || 'base';

    

    if(mode === 'bonus') mode = BONUS_TIERS[_selectedTier].id;
    let cost, wager;
    if(mode === 'bonus_standard' || mode === 'bonus_hot' || mode === 'bonus_mega'){
      const tierIdx = (mode === 'bonus_hot') ? 1 : (mode === 'bonus_mega') ? 2 : 0;
      cost  = bonusCostX6(tierIdx);   

      

      

      wager = State.betX6;
    } else {
      cost = wager = State.betX6;
    }
    if(State.balanceX6 < cost){ try { routeRgsError({ code:'ERR_IPB' }); } catch(e){} return; }   

    

    _spinLock = true;

    

    if(spinBtn && !STAKE.replay && !isReduced()){
      spinBtn._commitT0 = performance.now();
    }

    let result;
    try { result = await RGS.play(wager,mode); }
    catch(err){
      _spinLock = false;
      log('RGS.play error',err);
      routeRgsError(err);   
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
      
      winDisplay.alpha=0; winFx.on=false;
      winPlaque.alpha=0;

      

      
      
      winValue.text = fmtMoney(State.lastWinX6 || 0);   
      winValue.style.fill = THEME.colors.textMuted;
      winLabel.text = socialFilter(State.lastWinX6 > 0 ? 'LAST WIN' : 'WIN');
      
      winLabel.style.fill = 0xff8ab8;
      winLabel.alpha = 1; winValue.alpha = 1;
      winCells=[]; winLines=[]; lineG.clear();

      
      if(!State.autoplay.active) spinBtn.texture=tex('stop');
      if(deliveredBar) deliveredBar.setSpinning(true);   
      if(deliveredBarWeb) deliveredBarWeb.setSpinning(true);

      
      let anticipate=false;
      if(mode==='base' && result.grid){
        let earlyScatters=0;
        for(let r=0;r<3;r++) for(let row=0;row<ROWS;row++) if(result.grid[r][row]===STAR) earlyScatters++;
        const lateScatter=(()=>{ for(let r=3;r<REELS;r++) for(let row=0;row<ROWS;row++) if(result.grid[r][row]===STAR) return true; return false; })();
        anticipate = earlyScatters>=2 && lateScatter && !isReduced();
      }

      await reelsSpinPromise(result.grid, anticipate);
      spinBtn.texture=tex('spin');
      if(deliveredBar) deliveredBar.setSpinning(false);   
      if(deliveredBarWeb) deliveredBarWeb.setSpinning(false);
      await settleRound(result,mode);
    } catch(err){

      

      log('settle error', err);
      try { await RGS.endRound(); } catch(e){}
      if(typeof stopAutoplay === 'function') stopAutoplay();
      State.phase = Phase.IDLE;
      if(deliveredBar) deliveredBar.setSpinning(false);   
      if(deliveredBarWeb) deliveredBarWeb.setSpinning(false);
      try { winFx.on=false; winDisplay.alpha=0; winCells=[]; winLines=[]; lineG.clear(); updateHUD(); } catch(e){}
      showError('Round interrupted', 'That round could not be completed. Your balance is safe — please spin again.', false);
    } finally {
      _spinLock = false;
    }
  }

  async function settleRound(result,mode){

    const betX6 = State.betX6;
    State.phase=Phase.REVEAL;

    
    if(!result.ev && result.grid) result.ev = evalGrid(result.grid);


    const isBuyBonus = mode === 'bonus' || mode === 'bonus_standard' ||
                       mode === 'bonus_hot' || mode === 'bonus_mega';

    
    let baseWinX6=0;
    if(!isBuyBonus && result.ev){
      const ev=result.ev;
      if(ev.lineWins.length){ showLineWins(result.grid,ev.lineWins); }
      if(ev.scatCount>=3) showScatterCells(result.grid);
      const baseMx100=Math.round((ev.lineX+ev.scatX)*100);
      if(baseMx100>0){
        baseWinX6=Math.round(betX6*baseMx100/100);
        revealActive=true; revealT0=performance.now(); winVfxTier=winTier(baseMx100);

        
        
        const triggersFS = !!result.fs && ev.scatCount >= 3;
        if(triggersFS){
          revealDur = State.turboMode===2 ? 900
                    : State.turboMode===1 ? 1300
                    : (isReduced() ? 900 : 1800);
        } else {

          
          
          revealDur = State.turboMode===2 ? 480
                    : State.turboMode===1 ? 720
                    : (isReduced() ? 700 : 1300);
        }
        if(ev.scatCount>=3 || winTier(baseMx100)>=4){

          
          const _bt = winTier(baseMx100);
          if(_bt >= 4) await microSilence(_bt);
          celebrate(baseMx100,baseWinX6);
        } else {
          Sound.win(winTier(baseMx100));
        }
        flashWinValue(baseWinX6, baseMx100);   

        
        if(triggersFS && !isReduced()){

          spawnBonusIgnition(winCells);
          
          shakeAmount = 4; shakeT0 = performance.now();

          
          _camPushT0 = performance.now();
        }
        await delay(revealDur);
        revealActive=false;
      }
    } else if(isBuyBonus && result.ev){

      

      

      

      const ev = result.ev;
      if(ev.scatCount >= 3){
        showScatterCells(result.grid);
        revealActive = true; revealT0 = performance.now();
        winVfxTier = 5;   
        revealDur = State.turboMode===2 ? 700
                  : State.turboMode===1 ? 1100
                  : (isReduced() ? 600 : 1500);
        Sound.feature();
        
        if(!isReduced()){
          for(let i = 0; i < winCells.length; i++){
            const c = winCells[i];
            setTimeout(() => {

              spawnBonusIgnition([c]);
              if(i === winCells.length - 1){
                
                shakeAmount = 5; shakeT0 = performance.now();
              }
            }, i * 150);
          }
        }
        await delay(revealDur);
        revealActive = false;
      }
    }

    
    let fsWinX6=0;
    if(result.fs){
      State.stats.features++;
      Sound.feature();

      

      
      
      const _fsMode = (result.fs && result.fs._mode) || mode;
      
      try { await playCandyBurstIntro(result.fs && result.fs.total, _fsMode); } catch(e){}
      if(_fsMode === 'bonus_mega'){
        await playMegaLogoCeremony();
      } else if(_fsMode === 'bonus_hot'){
        await playHotFsCeremony();
      } else if(_fsMode === 'bonus_standard' || _fsMode === 'bonus' || _fsMode === 'base'){
        await playStandardFsCeremony();
      } else {
        await playFsTransition();
      }

      
      try {
        const bonusModeForMusic = (_fsMode === 'bonus_hot') ? 'bonus_hot'   
                                : (_fsMode === 'bonus_mega') ? 'bonus_mega'
                                : 'bonus_standard';
        Sound.startBonusMusic(bonusModeForMusic);
        setGradeMode(_fsMode); 
      } catch(e){}
      await showFeatureBanner((mode==='bonus'?'BONUS':result.fs.awarded)+' FREE SPINS',isReduced()?500:1100, _fsMode);
      fsWinX6 = await runFreeSpinScene(betX6,result.fs);
      
      try { Sound.endBonusMusic(); } catch(e){}
      try { setGradeMode('base'); } catch(e){} 
    }


    

    
    
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


  

  

  

  

  

  
  
  const WIN_TIER_COLORS = [
    0x9ca0b3,  
    0xb9b3c4,  
    0xffa9cd,  
    0xff8ab8,  
    0xff5a9c,  
    0xff3f93,  
    0xff2e86,  
  ];
  let _winFlashTok=0;
  let _countTok=0;
  let _labelFadeTok=0;   
  function flashWinValue(amountX6, mx100){

    
    
    const startX6 = 0;                  
    const targetX6 = amountX6;
    if(amountX6 > 0){ State.lastWinX6 = amountX6; syncDeliveredBar(); }   


    

    
    if(typeof mx100 === 'number'){
      const tier = winTier(mx100);

      

      
      
      winValue.style.fill = 0xf5f7fa;
      const newLabelFill = WIN_TIER_COLORS[tier] || 0xff8ab8;
      const newText = socialFilter('WIN');
      if(isReduced() || winLabel.text === newText){
        winLabel.text = newText;
        winLabel.style.fill = newLabelFill;
      } else {
        
        const labTok = ++_labelFadeTok;
        const lt0 = performance.now();
        (function fadeStep(){
          if(labTok !== _labelFadeTok) return;
          const elapsed = performance.now() - lt0;
          if(elapsed < 90){
            winLabel.alpha = 1 - (elapsed/90) * 0.85;   
          } else if(winLabel.text !== newText){
            winLabel.text = newText;
            winLabel.style.fill = newLabelFill;
            winLabel.alpha = 0.15;
          } else if(elapsed < 230){
            winLabel.alpha = 0.15 + ((elapsed-90)/140) * 0.85;   
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


    const tier = typeof mx100 === 'number' ? winTier(mx100) : 2;
    const countDur = tier >= 5 ? 900 : tier >= 3 ? 480 : 220;

    
    if(isReduced() || amountX6 === 0){
      winValue.text = fmtMoney(targetX6);
    } else {
      const tok = ++_countTok;
      const t0 = performance.now();
      (function step(){
        if(tok !== _countTok) return;     
        const p = Math.min(1, (performance.now() - t0) / countDur);
        const eased = 1 - Math.pow(1 - p, 3);    
        const cur = Math.round(startX6 + (targetX6 - startX6) * eased);
        winValue.text = fmtMoney(cur);
        if(p < 1) requestAnimationFrame(step);
        else winValue.text = fmtMoney(targetX6);
      })();
    }
    if(isReduced()) return;

    

    const tok=++_winFlashTok;
    winLabel._popActive = winValue._popActive = true;   
    const t0=performance.now(), dur=280;
    (function step(){
      if(tok!==_winFlashTok){ winLabel._popActive=winValue._popActive=false; return; }
      const p=Math.min(1,(performance.now()-t0)/dur);
      const k=0.94 + 0.06*outBack(p);
      const lB=(winLabel._baseScale||winLabel.scale.x)*(winLabel._fit||1);   
      const vB=(winValue._baseScale||winValue.scale.x)*(winValue._fit||1);
      winLabel.scale.set(lB*k); winValue.scale.set(vB*k);
      if(p<1) requestAnimationFrame(step);
      else { winLabel.scale.set(lB); winValue.scale.set(vB); winLabel._popActive=winValue._popActive=false; }
    })();
  }

  async function finishRound(result,betX6,totalWinX6){

    

    
    
    let _celebGuard=0;
    while(winFx.on && _celebGuard++<50) await delay(60);
    if(winFx.on){ winFx.on = false; winDisplay.alpha = 0; }
    try {
      const endData=await RGS.endRound();
      if(endData && endData.balance!=null)
        State.balanceX6 = typeof endData.balance==='object' ? endData.balance.amount : endData.balance;
    } catch(e){ log('endRound error',e); }


    

    
    winCells = []; winLines = []; lineG.clear();
    if(typeof bonusFxG !== 'undefined') bonusFxG.clear();
    if(typeof bonusFxAddG !== 'undefined') bonusFxAddG.clear();
    if(typeof bonusMultBig !== 'undefined'){ bonusMultBig.visible = false; bonusMultBig.alpha = 0; }
    if(typeof bonusWildLabel !== 'undefined') bonusWildLabel.visible = false;
    if(typeof bonusLockLabel !== 'undefined') bonusLockLabel.visible = false;
    if(typeof bonusHudText !== 'undefined') bonusHudText.alpha = 0;
    if(typeof clearStickyOverlay === 'function') clearStickyOverlay();
    if(_bonusState) _bonusState.active = false;
    
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
      const big = totalWinX6 >= betX6*25;   
      const stop = (isFeature && State.autoplay.stopOnFeature)
        || (big && State.autoplay.stopOnBigWin)
        || State.autoplay.remaining<=0
        || State.balanceX6 < State.betX6;
      if(stop) stopAutoplay();
      else autoplayNext();
    }
  }

  
  async function runFreeSpinScene(betX6,fs){
    State.phase=Phase.FREESPIN;
    let runningX6=0;
    fbText.text='';
    
    const fsMode = fs._mode || 'bonus_standard';
    const wildReel = fs._wildReel != null ? fs._wildReel : null;
    const stickyCrowns = !!fs._stickyCrowns;
    
    _bonusState.active = true;
    _bonusState.mode = fsMode;
    _bonusState.wildReel = wildReel;
    _bonusState.stickyCrowns = stickyCrowns;
    _bonusState.stickyMap = [[],[],[],[],[]];   
    _bonusState.spinNum = 0;
    _bonusState.totalSpins = fs.spins.length;
    _bonusState.spinMult = 1;
    _bonusState.totalMult = 0;
    _bonusState.revealedMultT0 = -10000;

    
    
    if(fsMode === 'bonus_hot'){
      frostBg.tint = 0xff007f;   
      frostBg.alpha = 0.18;
    } else if(fsMode === 'bonus_mega'){
      frostBg.tint = 0xff2ad0;   
      frostBg.alpha = 0.20;
    } else {
      frostBg.tint = 0xff5ab0;   
      frostBg.alpha = 0.12;
    }
    for(let i=0;i<fs.spins.length;i++){
      const sp=fs.spins[i];
      
      const spinMult = sp.mult != null ? sp.mult : FS_MULT;
      
      _bonusState.spinNum = i + 1;
      _bonusState.spinMult = spinMult;
      _bonusState.revealedMultT0 = performance.now();    
      _bonusState.totalMult += spinMult;

      

      featureBanner.alpha = 0;

      winCells=[]; winLines=[]; lineG.clear();
      await reelsSpinPromise(sp.grid,false);


      if(wildReel != null && !isReduced()){
        const reelCenterX = GX + wildReel*CELL + CELL/2;
        for(let row = 0; row < ROWS; row++){
          spawnParticles(reelCenterX, GY + (row+0.5)*CELL, 4, 4);
        }
      }

      

      

      if(stickyCrowns){
        for(let r = 0; r < REELS; r++){
          for(let row = 0; row < ROWS; row++){
            if(sp.grid[r][row] === SYM.CROWN){
              if(!_bonusState.stickyMap[r][row]){
                _bonusState.stickyMap[r][row] = true;     

                const stuckSp = stickySprites[r][row];
                stuckSp.texture = SYM_TEX[SYM.CROWN];
                const cc = cellCenter(r, row);
                stuckSp.position.set(cc.x, cc.y);
                const sz = CELL * 1.0;   // fill the cell — sticky crowns were reading "little" next to live (breathing/popping) symbols
                stuckSp.scale.set(sz / Math.max(stuckSp.texture.width, stuckSp.texture.height));
                stuckSp.visible = true;
                
                stuckSp.alpha = 1;
                stuckSp._landT0 = performance.now();
                if(!isReduced()){
                  spawnParticles(cc.x, cc.y, 8, 5);       
                }
              }
            }
          }
        }
      }


      
      const ev=evalGrid(sp.grid);
      const lws = (sp.lineWins && sp.lineWins.length) ? sp.lineWins : ev.lineWins;
      if(lws.length) showLineWins(sp.grid, lws);
      if(ev.scatCount>=3) showScatterCells(sp.grid);
      const spinWinX6=Math.round(betX6*sp.winX);
      if(spinWinX6>0){
        runningX6+=spinWinX6;
        flashWinValue(runningX6, Math.round(sp.winX*100));   
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
    
    frostBg.tint = 0xffffff; frostBg.alpha = 1;
    fbText.style.fill = 0xf5f7fa;   
    _bonusState.active = false;
    _bonusState.stickyMap = [];
    bonusFxG.clear();
    bonusFxAddG.clear();
    bonusHudText.alpha = 0;
    
    clearStickyOverlay();

    
    const totalX6=Math.round(betX6*fs.total);
    await microSilence(6);   
    bigWinLabel.style.fill=0xf5f7fa;
    bigWinAmount.text=fmtMoney(totalX6);

    

    
    const fsTier = winTier(Math.round(fs.total*100));
    winFx.countX6Target = totalX6;   

    
    winFx.countX6Display = 0; winFx.popT0 = 0; winFx.landFired = false; winFx._arc = null;
    if(fsTier <= 1 && !COMPLY.allow_ldw_celebration){
      winFx.customLabel = socialFilter('FREE SPINS COMPLETE');
      bigWinLabel.text   = socialFilter('FREE SPINS COMPLETE');
      winFx.tier = 1;                                   
      winFx.on=true; winFx.t0=performance.now();
      winFx.dur=isReduced()?600:1400;
      winFx.tAnt = isReduced()?0:120;                   
      winFx.tLand = winFx.tAnt + (isReduced()?1:Math.max(360,(winFx.dur-winFx.tAnt)*0.55));
    } else {
      winFx.customLabel = socialFilter('FREE SPINS WIN');
      bigWinLabel.text   = socialFilter('FREE SPINS WIN');

      

      
      
      winFx.tier = Math.max(fsTier, 3);
      winFx.on=true; winFx.t0=performance.now();
      winFx.dur=Math.min(isReduced()?700:2800, COMPLY.max_animation_ms||3500);   
      
      const _fsAnt = isReduced()?0:(winFx.tier>=5?320:240);
      winFx.tAnt = _fsAnt;
      winFx.tLand = _fsAnt + (isReduced()?1:Math.max(360,(winFx.dur-_fsAnt)*0.55));
      Sound.win(winFx.tier);

      

      if(!isReduced()){
        try { Sound.winAnticipate(winFx.tier); Sound.tallyStart(fs.total); } catch(e){}
        spawnParticles(app.screen.width/2, GY+GH*0.42, winFx.tier*4, winFx.tier);
        spawnCascade(winFx.tier, false, 0.45);
      }
    }
    await waitWinOrSkip(winFx.dur);   
    return totalX6;
  }

  
  function stopAutoplay(){ State.autoplay.active=false; State.autoplay.remaining=0; }
  function autoplayNext(){
    if(!State.autoplay.active) return;
    if(State.autoplay.remaining<=0){ stopAutoplay(); return; }
    if(State.phase!==Phase.IDLE) return;
    if(State.balanceX6<State.betX6){ stopAutoplay(); return; }

    const d = State.turboMode===2 ? 140
            : State.turboMode===1 || isReduced() ? 280
            : 720;
    setTimeout(() => {
      if(!State.autoplay.active) return;
      if(State.phase!==Phase.IDLE) return;
      startSpin();
    }, d);
  }

  
  const click=(s,fn) => { s.eventMode='static'; s.cursor='pointer'; s.on('pointertap',fn); };
  click(spinBtn,() => {
    if(STAKE.replay) return;
    if(winFx.on){ winFx.fastFwd = true; return; }   
    if(allReelsSpinning){ quickStopReels(); return; }
    if(State.phase===Phase.IDLE) startSpin();
  });

  
  spinBtn.on('pointerdown',() => { spinBtn._pressed=true; });
  spinBtn.on('pointerup',() => { spinBtn._pressed=false; });
  spinBtn.on('pointerupoutside',() => { spinBtn._pressed=false; });
  spinBtn.on('pointercancel',() => { spinBtn._pressed=false; });
  window.addEventListener('keydown',(e) => {
    if(STAKE.replay) return;
    
    if(e.code==='Escape'){
      if(buyModal.visible)   { hideBuyBonusModal(); return; }
      if(infoModal.visible)  { hideInfoModal(); return; }
      if(drawerLayer.visible){ closeDrawer(); return; }
      if(rcModal.visible)    { return; }   
      if(errModal.visible)   { return; }   
      if(betMenu.visible)    { hideBetMenu(); return; }
      return;
    }
    if(e.code==='Space' || e.code==='Enter'){
      e.preventDefault();

      
      
      if(e.repeat) return;

      
      if(buyModal.visible || betMenu.visible || infoModal.visible ||
         drawerLayer.visible || rcModal.visible || errModal.visible) return;
      spinBtn._pressed = true;   
      if(winFx.on){ winFx.fastFwd = true; }          
      else if(allReelsSpinning) quickStopReels();
      else if(State.phase===Phase.IDLE) startSpin();
    }
    else if(e.code==='ArrowUp'){ e.preventDefault(); bumpBet(1); }
    else if(e.code==='ArrowDown'){ e.preventDefault(); bumpBet(-1); }
    else if(e.code==='KeyF'){ btnFullscreen.emit('pointertap'); }
    else if(e.code==='KeyM'){ btnSound.emit('pointertap'); }

    
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

  
  window.addEventListener('keyup',(e) => {
    if(e.code === 'Space'){
      spinBtn._pressed = false;
    }
  });

  window.addEventListener('blur', () => {
    spinBtn._pressed = false;
  });


  

  
  function drawBonusFx(now){
    bonusFxG.clear();
    bonusFxAddG.clear();
    if(!_bonusState.active || State.phase !== Phase.FREESPIN){

      

      
      bonusHudText.alpha = 0;
      bonusMultBig.visible = false;
      bonusMultBig.alpha = 0;
      bonusWildLabel.visible = false;
      bonusLockLabel.visible = false;
      return;
    }
    const mode = _bonusState.mode;
    const W = app.screen.width, H = app.screen.height;

    bonusHudText.alpha = 1;
    let hudLabel = '';

    
    const _fsInt = (v) => (Number.isFinite(+v) ? Math.trunc(+v) : 0);
    const _sN = _fsInt(_bonusState.spinNum);
    const _tS = _fsInt(_bonusState.totalSpins);
    const _sM = (Number.isFinite(+_bonusState.spinMult) ? +(+_bonusState.spinMult).toFixed(2) : 0);

    
    if(mode === 'bonus_hot'){
      hudLabel = `🔥 HOT  ${_sN} / ${_tS}   ×${_sM}`;
      bonusHudText.style.fill = 0xc8326f;        
    } else if(mode === 'bonus_mega'){
      hudLabel = `✨ MEGA  ${_sN} / ${_tS}   ×${_sM}`;
      bonusHudText.style.fill = 0xff8ab8;        
    } else {
      hudLabel = `FREE SPINS  ${_sN} / ${_tS}   ×${_sM}`;
      bonusHudText.style.fill = 0xff5a9c;        
    }
    bonusHudText.text = hudLabel;

    

    
    
    let _hudY = GY + GH + 8;
    if(typeof H !== 'undefined' && H > 0){
      const _barTop = H - (H < 330 ? 60 : 88) - 6;   
      _hudY = Math.min(_hudY, _barTop - bonusHudText.height - 2);
      _hudY = Math.max(_hudY, GY + GH + 2);          
    }
    bonusHudText.position.set(W/2, _hudY);

    
    if(mode === 'bonus_hot' && _bonusState.wildReel != null){
      const wr = _bonusState.wildReel;
      const wx = GX + wr * CELL + CELL/2;
      const wy0 = GY, wy1 = GY + GH;
      
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
      
      const pulse = 0.6 + 0.4 * Math.sin(now * 0.004);
      bonusFxAddG.rect(wx - CELL/2 + 4, wy0 + 2, CELL - 8, GH - 4)
        .fill({ color: 0xff5a9c, alpha: 0.06 * pulse });
      bonusFxAddG.rect(wx - CELL/2 + 4, wy0 + 2, CELL - 8, GH - 4)
        .stroke({ color: 0xff8ab8, width: 2, alpha: 0.60 + 0.35 * pulse });

      

      const wildPulse = 0.6 + 0.4 * Math.sin(now * 0.004);
      
      bonusFxG.roundRect(wx - 48, wy0 - 36, 96, 28, 12)
        .fill({ color: 0xff007f, alpha: 0.18 * wildPulse });
      
      bonusFxG.roundRect(wx - 44, wy0 - 34, 88, 24, 12)
        .fill({ color: 0x0a0a14, alpha: 0.96 });
      bonusFxG.roundRect(wx - 44, wy0 - 34, 88, 24, 12)
        .stroke({ color: 0xff007f, width: 1.4, alpha: 0.95 });
      
      bonusFxG.roundRect(wx - 36, wy0 - 13, 72, 1.2, 0.6)
        .fill({ color: 0xff007f, alpha: 0.85 });
      
      bonusFxG.poly([
        wx - 6, wy0 - 11,
        wx + 6, wy0 - 11,
        wx,     wy0 - 4,
      ]).fill({ color: 0xff007f, alpha: 0.95 });

      if(bonusWildLabel){
        bonusWildLabel.position.set(wx, wy0 - 22);
        bonusWildLabel.visible = true;
        bonusWildLabel.alpha = 1;
      }
    } else if(bonusWildLabel){
      bonusWildLabel.visible = false;
    }

    
    if(mode === 'bonus_mega'){
      let lastSticky = null;
      for(let r = 0; r < REELS; r++){
        for(let row = 0; row < ROWS; row++){
          if(_bonusState.stickyMap[r] && _bonusState.stickyMap[r][row]){
            const cc = cellCenter(r, row);
            const r2 = CELL * 0.42;
            const sparkle = 0.6 + 0.4 * Math.sin(now * 0.005 + r + row);
            
            bonusFxAddG.roundRect(cc.x - r2, cc.y - r2, r2*2, r2*2, 8)
              .stroke({ color: 0xff5a9c, width: 2.4, alpha: 0.85 * sparkle });
            
            bonusFxAddG.roundRect(cc.x - r2 + 2, cc.y - r2 + 2, r2*2 - 4, r2*2 - 4, 7)
              .stroke({ color: 0xf5f7fa, width: 0.8, alpha: 0.40 * sparkle });

            
            
            lastSticky = cc;
          }
        }
      }

      bonusLockLabel.visible = false;

      
      
    }


    

    
    
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
      
      for(let g = 5; g > 0; g--){
        bonusFxAddG.circle(cx, cy, CELL * scale * (0.55 + g*0.13))
          .fill({ color: tierColor, alpha: 0.06 * eAlpha * (g/5) });
      }

      

      bonusMultBig.visible = true;
      bonusMultBig.text = '×' + (Number.isFinite(+_bonusState.spinMult) ? +(+_bonusState.spinMult).toFixed(2) : 0);
      bonusMultBig.position.set(cx, cy);
      bonusMultBig.scale.set(scale);
      bonusMultBig.alpha = eAlpha;
      bonusMultBig.tint = tierColor;
    } else {
      
      bonusMultBig.visible = false;
      bonusMultBig.alpha = 0;
    }
  }

  
  app.ticker.add((ticker) => {
    const dt=ticker.deltaTime;
    const now=performance.now();


    try { refreshBuyFabVisibility(); } catch(e){}

    
    drawBonusFx(now);


    
    
    const apOn = State.autoplay.active;
    btnAutoplay._count.visible = apOn;
    btnAutoplay._stop.visible  = apOn;             
    btnAutoplay._icon.alpha = apOn ? 0.10 : 1;     
    btnAutoplay._active = apOn;                     
    if(apOn){
      btnAutoplay._count.text =
        State.autoplay.remaining===Infinity ? '∞' : String(State.autoplay.remaining);
      btnAutoplay._count.style.fill = 0xf5f7fa;   

      
      
      const _apS = btnAutoplay.scale.x || 1;
      const _apPx = v => v / _apS;                          
      btnAutoplay._count.scale.set(Math.min(2.6, 23 / (64 * _apS)));  
      btnAutoplay._count.position.set(0, _apPx(-7));
      
      btnAutoplay._stop.scale.set(Math.min(3.0, 12 / (18 * _apS)) * (0.94 + 0.06*Math.sin(now*0.006)));
      btnAutoplay._stop.position.set(0, _apPx(13));
    } else {
      btnAutoplay._count.scale.set(1); btnAutoplay._count.position.set(0,-4);
    }


    
    const _isPhone = window.innerWidth < 600 || window.innerHeight < 600;
    const _doParallax = !_isPhone || (Math.floor(now / 64) % 2 === 0);
    if(_doParallax){
      const drift=now*0.0002;
      bg.x=app.screen.width/2+Math.sin(drift)*7;
      bg.y=app.screen.height/2+Math.sin(drift*0.7+1)*4;
      frostBg.x=bg.x; frostBg.y=bg.y;
    }

    

    const _inBonus = !!(_bonusState && _bonusState.active);
    const _winDim = (_inBonus && winFx.on && winFx.tier>=4 && !isReduced()) ? 0.84 : 1.0;
    const _spinDim = _inBonus ? ((allReelsSpinning ? 0.78 : 1.0) * _winDim) : 1.0;
    bg._tA = bg._tA == null ? 1 : bg._tA;
    bg._tA += (_spinDim - bg._tA) * 0.12;     
    bg.alpha = bg._tA;

    
    godRays.clear();
    if(!isReduced() && !_gpuWeak){
      const _W=app.screen.width, _H=app.screen.height, _t=now*0.00006;
      const _winLit=(_inBonus && winFx.on && winFx.tier>=2) ? Math.min(1,(winFx.tier-1)/4) : 0;   
      const _rayCol=_winLit>0 ? 0xff6ac0 : 0xffd9ee;   
      const _rayBoost=1 + _winLit*2.4;                 
      for(let i=0;i<6;i++){
        const baseX=_W*(0.10+i*0.16)+Math.sin(_t*1.7+i*1.3)*_W*0.03;
        const ox=_W*0.5+(baseX-_W*0.5)*0.28, sp=_W*0.05;
        const a=(0.016+0.010*Math.sin(_t*3.1+i*2))*bg._tA*_rayBoost;
        godRays.poly([ox-7,-_H*0.08, ox+7,-_H*0.08, baseX+sp,_H*1.06, baseX-sp,_H*1.06])
          .fill({ color:_rayCol, alpha:Math.max(0,a) });
      }
    }

    
    
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
        const col = m.gold ? 0x7fe7ff : 0xff9ed0;   
        ambientMotesG.circle(sx, sy, rr*2.7).fill({ color:col, alpha:0.06*tw });
        ambientMotesG.circle(sx, sy, rr).fill({ color:0xfff4fb, alpha:0.58*tw });   
      }
    } else if(ambientMotes.length){
      ambientMotes.length = 0;   
    }

    

    

    
    const _anyModal = drawerLayer.visible || buyModal.visible ||
                      infoModal.visible   || rcModal.visible  ||
                      errModal.visible    || betMenu.visible  ||
                      introOverlay.visible;

    
    const _blurOn = _anyModal && !isReduced();
    const _blurTarget = _blurOn ? 5 : 0;          
    bg._blurT += (_blurTarget - bg._blurT) * 0.14;
    if(bg._blurT < 0.06) bg._blurT = 0;
    gameBlurFilter.strength = bg._blurT;
    
    const _scrimTarget = _anyModal ? 0.42 : 0;
    modalScrimG.alpha += (_scrimTarget - modalScrimG.alpha) * 0.18;
    if(modalScrimG.alpha < 0.005) modalScrimG.alpha = 0;

    
    if(buyModal.visible){
      const _tnow = now;
      for(let i = 0; i < tierCards.length; i++){
        const tc = tierCards[i];

        
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

        
        if(tc._baseY == null) tc._baseY = tc.y;
        const liftTgt = tc._baseY - (tc._hoverT * 4);
        tc.y += (liftTgt - tc.y) * 0.20;
        if(tc._vfx) drawTierVfx(tc, _tnow, isSel);
      }
    } else {
      
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
    
    if(bg._zoomT == null) bg._zoomT = 1;

    
    const _winZoom = (_inBonus && winFx.on && winFx.tier>=2 && !isReduced())
                   ? (winFx.tier>=4 ? 1.07 : 1.035) : 1;   
    const _zoomTarget = Math.max(_anyModal ? 1.08 : 1, _winZoom);
    bg._zoomT += (_zoomTarget - bg._zoomT) * 0.10;     
    
    const _bgK = (bg._baseScale || 1) * bg._zoomT;
    if(bg._baseScale){
      bg.scale.set(_bgK, _bgK);
      if(frostBg._baseScale) frostBg.scale.set(frostBg._baseScale * bg._zoomT, frostBg._baseScale * bg._zoomT);
    }
    if(logo._baseY!=null){

      
      logo.y = logo._baseY;
      logo.rotation = 0;

      

      
      const lW = logo.width, lH = logo.height;
      const lx = logo.x, ly = logo.y;
      
      logoHalo.clear();
      const haloPulse = 0.85;   
      for(let g = 4; g >= 1; g--){
        const r = Math.max(lW, lH) * (0.40 + g * 0.07);
        logoHalo.ellipse(lx, ly, r * 1.0, r * 0.58)
          .fill({ color: 0xff007f, alpha: 0.012 * haloPulse * (1 - g/5) });
      }

      
      
      logoShine.position.set(lx, ly);
      logoShine.scale.set(logo.scale.x, logo.scale.y);
      logoShine.rotation = logo.rotation;

      

      
      logoShine.alpha = 0.12;   
      logoShine.tint = 0xfff2f8;                                     
    }

    
    tickReels();
    renderReels();
    drawPortal(now);
    drawCornerJewels(now); 
    drawSpinHalo(now);   
    drawLinesPreviewFrame(now);   
    drawBtnAuras(now);   
    tickFlyUps(now);     
    tickBalanceCoinUp(now); 


    

    

    ICON_BTNS.forEach(b => {
      if(!b || b._targetScale == null) return;
      
      b._displayScale += (b._targetScale - b._displayScale) * 0.28;
      b.scale.set(b._displayScale);
      
      if(b._tintDisplay && b._tintTarget){
        const td = b._tintDisplay, tt = b._tintTarget;
        td[0] += (tt[0] - td[0]) * 0.32;
        td[1] += (tt[1] - td[1]) * 0.32;
        td[2] += (tt[2] - td[2]) * 0.32;
        b._icon.tint = (Math.round(td[0])<<16) | (Math.round(td[1])<<8) | Math.round(td[2]);
      }
      
      if(b._ping && b._pingT0){
        const pt = (now - b._pingT0) / 320;
        if(pt >= 1){
          b._pingT0 = 0; b._ping.clear(); b._ping.alpha = 0;
        } else {
          const eased = 1 - Math.pow(1-pt, 3);   
          const r0 = (b._icon.texture?.width || 32) * 0.55;
          const r1 = r0 * (1 + eased * 0.45);
          b._ping.clear();
          b._ping.alpha = (1 - pt) * 0.6;
          b._ping.circle(0, 0, r1).stroke({ color:THEME.colors.accent, width:2, alpha:1 });
        }
      }
    });


    for(let i = 0; i < STEPPER_BTNS.length; i++){
      const s = STEPPER_BTNS[i];
      if(!s || s._targetScale == null) continue;
      s._displayScale += (s._targetScale - s._displayScale) * 0.30;
      s.scale.set(s._displayScale);
    }


    if(introOverlay.visible){
      if(introOverlay._fadeIn){
        const t = Math.min(1, (now - introOverlay._fadeIn) / 260);
        introOverlay.alpha = 1 - Math.pow(1-t, 3);   
        if(t >= 1) introOverlay._fadeIn = 0;
      }

      
      if(introOverlay._autoMs && !introOverlay._dismissing &&
         (now - introOverlay._shownAt) > introOverlay._autoMs){
        irisDismissIntro();    
      }

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

        
        
        if(introOverlay._logoT0){
          const lt = (now - introOverlay._logoT0) / 640;
          if(lt < 0){
            
            introLogo.alpha = 0;
          } else if(lt < 1){
            introLogo.alpha = 1 - Math.pow(1-lt, 3);
            introLogo.scale.set(introOverlay._logoBaseScale * (0.80 + 0.20 * (1 - Math.pow(1-lt, 5))));   
          } else {
            
            introLogo.alpha = 1;
            introLogo.scale.set(introOverlay._logoBaseScale);
            introOverlay._logoT0 = 0;
          }
        } else {
          
          const p = (Math.sin(now * 0.004) + 1) * 0.5;
          introCta.alpha = 0.62 + p * 0.38;
          introCta.scale.set(0.985 + p * 0.03);

          if(introLogo._baseY != null){
            introLogo.y = introLogo._baseY + Math.sin(now * 0.0013) * 3;
            introLogo.scale.set(introOverlay._logoBaseScale * (1 + Math.sin(now * 0.0016) * 0.012));
            introLogo.rotation = 0;
          }

          
          [introCard1, introCard2, introCard3].forEach(card => {
            if(!card._shine) return;
            const cardW = card._value ? Math.max(140, card._plate ? 168 : 140) : 168;
            
            const w = 168, h = 168*1.65;
            const sweepDur = 3500;
            const t = ((now + card._shinePhase * sweepDur / (Math.PI*2)) % sweepDur) / sweepDur;
            
            card._shine.clear();
            if(t > 0.40 && t < 0.70){
              const sweepP = (t - 0.40) / 0.30;
              const sweepX = -w/2 + sweepP * (w + 60);
              
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

            
            const tier=winVfxTier||1;
            const prem=reels[r].symbols[k]>=6;   
            const hold=1.20 + Math.min(tier,5)*0.07 + (prem?0.26:0);   
            const t=now-revealT0-r*46;
            let pop=1, rot=0, hop=0, sx3d=1;
            if(reducedHl){ pop=1.08; }
            else if(t>0){
              const popDur=prem?540:460;
              if(t<popDur) pop=1+(hold-1)*outBack(t/popDur);
              else         pop=hold+Math.sin((t-popDur)*0.006)*(prem?0.06:0.045);
              
              rot=Math.sin(t*0.0042 + r*0.5)*0.022;
              sx3d=1+Math.sin(t*0.0032 + r*0.7)*0.06;
              
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

            

            
            const dimP = reducedHl ? 1 : Math.min(1, Math.max(0, (now - revealT0) / 160));
            s.alpha = 1 - (1 - 0.26) * dimP;
          }
        } else {
          s.alpha=1;
        }
      }
      
    }

    betChipG.clear();
    if(betValue.alpha > 0.05 && betValue.text){
      const bw=betValue.width, bh=betValue.height, ay=betValue.anchor.y;
      const CW=Math.max(66, bw+26), CH=bh+14;                 

      
      const _vcx = betValue.x - bw*(betValue.anchor.x - 0.5);
      const L=_vcx - CW/2, T=betValue.y - bh*ay - 7;          

      

      const _winPortrait = window.innerHeight > window.innerWidth;
      if((winLabel.alpha > 0 || winValue.alpha > 0) && !_winPortrait){

        
        
        const wAtBase = w => (w.width/(w.scale.x||1))*(w._baseScale||w.scale.x||1);
        const lW = wAtBase(winLabel), vW = wAtBase(winValue);
        const left  = Math.min(winLabel.x - lW*winLabel.anchor.x, winValue.x - vW*winValue.anchor.x);
        const right = Math.max(winLabel.x + lW*(1-winLabel.anchor.x), winValue.x + vW*(1-winValue.anchor.x));
        const fitCollide = Math.max(0.5, Math.min(1, ((L - 18) - left) / Math.max(1, right - left)));

        const fitSlot = (winValue._maxW && vW > winValue._maxW) ? winValue._maxW / vW : 1;
        const fit = Math.max(0.5, Math.min(fitCollide, fitSlot));
        winLabel._fit = winValue._fit = fit;
        if(!winValue._popActive){
          winLabel.scale.set((winLabel._baseScale||winLabel.scale.x)*fit);
          winValue.scale.set((winValue._baseScale||winValue.scale.x)*fit);
        }
      } else if(_winPortrait){

        

        if(winValue._slotRight != null){
          const _bR = balValue.x + balValue.width + 12;
          const _sL = _bR + 8, _sR = winValue._slotRight;
          const _cx = (_sL + _sR) / 2;
          winLabel.x = winValue.x = _cx;
          winValue._maxW = Math.max(30, (_sR - _sL) - 6);
        }

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
    
    drawWinVfx(now, showHl && winCells.length>0);


    

    if(!allReelsSpinning && !showHl && !isReduced()){
      const ip = 0.15 + 0.12*Math.sin(now*0.0022);          
      for(let r=0;r<REELS;r++){
        const rl = reels[r];
        for(let row=0; row<ROWS; row++){
          const k = row+1;                                   
          if(!shouldAnimateIdle(rl.symbols[k])) continue;    
          const cc = cellCenter(r, row);
          const gl = rl.glows[k];
          gl.visible = true;
          gl.texture = SYM_TEX[rl.symbols[k]];
          gl.tint = THEME.colors.accent;                     
          gl.position.set(cc.x, cc.y);
          gl.scale.set(symScale(gl.texture, CELL*0.92) * (1.02 + 0.025*Math.sin(now*0.0022 + r*0.6)));
          gl.alpha = ip;
        }
      }
    }


    

    
    lineG.clear();
    // The full-width payline CONNECTOR reads as a stray "magenta line, always
    // animated, moving to the top" during wins (owner-flagged repeatedly). Winning
    // cells are already shown by the per-cell glow/frame in drawWinVfx, so the
    // connector is disabled. Flip WINLINE_CONNECTOR to true to restore it.
    const WINLINE_CONNECTOR = false;
    if(WINLINE_CONNECTOR && showHl && winLines.length){
      const dp=Math.min(1,(now-revealT0)/280);
      const drawProg=isReduced()?1:(1-(1-dp)*(1-dp));

      

      
      
      const cyclePer = isReduced() ? 700 : 1200;  
      const totalCycle = cyclePer * winLines.length;
      const cycleElapsed = now - revealT0;
      const multi = winLines.length > 1;

      

      
      const allPhaseDur = isReduced() ? 650 : 1050;   
      const showAllPhase = multi && cycleElapsed < allPhaseDur;
      lineG.alpha = showAllPhase ? Math.min(1, cycleElapsed / (allPhaseDur*0.55)) : 1;  

      const inIndividualPhase = multi && !showAllPhase;
      const activeIdx = inIndividualPhase ? (Math.floor((cycleElapsed - allPhaseDur) / cyclePer) % winLines.length) : -1;
      winLines.forEach((wl,idx) => {
        
        if(inIndividualPhase && idx !== activeIdx) return;
        const li = wl.line, count = wl.count;
        const pat=LINES[li];
        const col=LINE_COLORS[li%LINE_COLORS.length];
        const pulse=0.5+0.5*Math.sin(now*0.008+idx);

        

        
        const n=count, segs=count-1;
        if(segs<1) return;   
        const full=[];
        for(let r=0;r<n;r++){
          const cc=cellCenter(r,pat[r]);
          if(!Number.isFinite(cc.x)||!Number.isFinite(cc.y)) return;

          
          
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

          

          

          

          

          if(true){   

            

            

            

            

            

            

            

            

            

            

            

            

            

            

            

            

            
            const _lineBonus = (typeof _bonusState !== 'undefined') && _bonusState && _bonusState.active;
            const cGlow = _lineBonus ? 0xff2f93 : 0xff5a9c;
            const cMid  = _lineBonus ? 0xffe6f4 : col;

            

            // (removed) the dim lead-out _tail used to continue the payline
            // PATTERN from the last winning reel out to the remaining reels via
            // cellCenter(r, pat[r]). On a V / inverted-V payline those trailing
            // rows bend hard across rows 0<->2 through cells that are PAST the win
            // and never lit, drawing a colored line jutting through dark cells
            // (the owner-reported "old bug"). The win beam now spans ONLY the lit
            // winning run (full[0..count-1]).


            lineG.poly(pts,false).stroke({ color:cGlow, width:(_lineBonus?13:10)+3.5*pulse, alpha:(0.12+0.06*pulse)*drawProg });
            lineG.poly(pts,false).stroke({ color:cGlow, width:(_lineBonus?7:5)+1.8*pulse, alpha:(0.22+0.08*pulse)*drawProg });
            
            lineG.poly(pts,false).stroke({ color:cMid, width:(_lineBonus?3.9:3.1)+0.9*pulse, alpha:(0.44+0.12*pulse)*drawProg });
            
            lineG.poly(pts,false).stroke({ color:0xfff8fc, width:(_lineBonus?1.6:1.2)+0.4*pulse, alpha:0.6*drawProg });
            
            if(_lineBonus){
              lineG.poly(pts,false).stroke({ color:0x9fe9ff, width:0.9, alpha:0.45*drawProg });
            }

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
                
                const _bx=full[_si].x+(full[_si+1].x-full[_si].x)*Math.max(0,_f-0.16);
                const _by=full[_si].y+(full[_si+1].y-full[_si].y)*Math.max(0,_f-0.16);
                lineG.poly([_bx,_by,_px,_py],false).stroke({ color:cMid,    width:(_lineBonus?3.2:2.4), alpha:0.30*drawProg, cap:'round' });
                lineG.poly([_bx,_by,_px,_py],false).stroke({ color:0xffffff, width:(_lineBonus?1.4:1.1), alpha:0.85*drawProg, cap:'round' });
              }
            }

            if(drawProg > 0.92){
              const _mf=0.5+0.5*Math.sin(now*0.012);
              for(const _e of [full[0], full[n-1]]){
                lineG.circle(_e.x,_e.y, (_lineBonus?16:12)+3*_mf).fill({ color:cGlow, alpha:0.08+0.05*_mf });
              }
            }
          }

          

          
          if(drawProg >= 1 || drawProg > 0.85){

            

            const igniteFlash = isReduced() ? 0 : Math.max(0, 1 - cycleElapsed/480);
            for(let r=0;r<n;r++){
              if(reach < r) break;
              const cc = full[r];
              const rad = CELL*0.48 + pulse*2 + igniteFlash*CELL*0.30;

              
              for(let gi = 4; gi >= 1; gi--){
                const gr = rad * (0.55 + gi * 0.18);
                const ga = (1 - gi/4) * 0.18 + 0.04;
                lineG.circle(cc.x, cc.y, gr)
                  .fill({ color:0xff007f, alpha: ga * (0.65 + 0.35*pulse + igniteFlash*0.9) });
              }
              
              lineG.circle(cc.x, cc.y, rad * 0.55)
                .fill({ color:0xf5f7fa, alpha: 0.06 + 0.05*pulse + igniteFlash*0.45 });

              if(igniteFlash > 0.02){
                lineG.circle(cc.x, cc.y, rad*(0.28 + 0.5*(1-igniteFlash)))
                  .fill({ color:0xffffff, alpha: 0.5*igniteFlash });
              }
            }
          }
        }
      });
    }


    

    

    
    if(winFx.on){

      if(winFx.fastFwd){ winFx.t0 = now - winFx.dur - 1; }
      const el = now - winFx.t0;
      const tier = winFx.tier;
      const W = app.screen.width, H = app.screen.height;
      const cx = W/2, cy = GY + GH*0.5;
      winDisplay.position.set(cx, cy);

      
      
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
        if(!isReduced()){ try { Sound.tally(now); } catch(e){} }   
      }
      
      if(countP >= 1 && !winFx.popT0){
        winFx.popT0 = now;
        if(!winFx.landFired){
          winFx.landFired = true;
          if(!isReduced()){
            
            spawnParticles(W/2, GY+GH*0.42, winFx.tier*7, winFx.tier);
            if(winFx.tier>=3) spawnCascade(winFx.tier, false, 1.0);
            if(winFx.tier>=4){ shakeAmount = winFx.tier*4; shakeT0 = now; }   
          }
          try { Sound.winLand(winFx.tier); } catch(e){}   
        }
      }
      
      const maxW = Math.min(W * 0.78, 560);
      bigWinAmount.scale.set(1);
      const dynScale = (bigWinAmount.width / maxW) > 1 ? (1 / (bigWinAmount.width / maxW)) : 1;
      let popScale = 1;
      if(winFx.popT0 && !isReduced()){
        const pe = (now - winFx.popT0) / 380;             
        if(pe < 1) popScale = 1 + popElastic(pe) * (winFx.tier>=5 ? 0.50 : 0.36);   
      }
      bigWinAmount.scale.set(dynScale * popScale);

      if(winFx.popT0){
        const _te = Math.min(1, (now - winFx.popT0)/420);
        const _warm = Math.sin(_te*Math.PI);    
        bigWinAmount.tint = (255<<16) | ((255 - Math.round(_warm*8))<<8) | (255 - Math.round(_warm*12));
      } else if(bigWinAmount.tint !== 0xffffff){
        bigWinAmount.tint = 0xffffff;
      }
      
      if(el >= winFx.dur){
        winFx.on = false;
        winFx.fastFwd = false;   
        winDisplay.alpha = 0;
        winDisplay.scale.set(1);
        winFxThrone.clear();
        winFxBurst.clear();
        winUnderlineG.clear();   
        winRibbonG.clear();      

        winGemG.clear(); winGems.length = 0;   
        bigWinAmount.tint = 0xffffff;          
        winFx.landFired = false;               
        winFx._arc = null;                     
      } else {
        const inMs  = isReduced() ? 1 : Math.max(tAnt, 200);   
        const outMs = isReduced() ? 1 : 360;                   
        let envScale = 1, envAlpha = 1;
        if(el < inMs){
          const p = el / inMs;
          const e = isReduced() ? 1 : backOutSoft(p);          
          envAlpha = Math.min(1, p * 1.6);
          envScale = 0.94 + 0.06 * e;                          
        } else if(el > winFx.dur - outMs){
          const p = (el - (winFx.dur - outMs)) / outMs;
          const eOut = easeInCubic(p);                         
          envAlpha = 1 - eOut;
          envScale = 1 - 0.05 * eOut;
        } else {
          
          envScale = 1 + (tier >= 4 ? Math.sin((el - inMs) * 0.0030) * 0.012 : 0);   
        }
        winDisplay.alpha = envAlpha;
        winDisplay.scale.set(envScale);

        

        

        

        
        const tierCol = TIER_COLORS[tier] || 0xff007f;
        const baseR = Math.min(W, H) * 0.42;
        winFxThrone.clear();
        winFxBurst.clear();
        winUnderlineG.clear();
        winRibbonG.clear();


        
        
        winGemG.clear();
        for(let gi=winGems.length-1; gi>=0; gi--){
          const gm=winGems[gi];
          gm.t += 16;
          if(gm.t < 0) continue;   
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

          
          const tintLayers = tier >= 4 ? 10 : 7;
          for(let g = tintLayers; g >= 1; g--){
            winFxThrone.ellipse(0, 0,
              baseR * (0.42 + g * 0.072),
              baseR * (0.28 + g * 0.052))
              .fill({ color: tierCol, alpha: 0.025 + (g / tintLayers) * 0.020 });
          }


          
          
          if(tier >= 4){
            const swP = el / 460;
            if(swP < 1){
              const swR = baseR * (0.28 + swP * 1.55);
              const swA = (1 - swP) * (1 - swP) * 0.55;
              winFxBurst.ellipse(0, 0, swR, swR * 0.60)
                .stroke({ color: tierCol, width: (1 - swP) * 7 + 1.2, alpha: swA });
              winFxBurst.ellipse(0, 0, swR * 0.9, swR * 0.54)
                .stroke({ color: 0xffe6f4, width: (1 - swP) * 3.5, alpha: swA * 0.7 });   
            }
          }


          
          
          {
            const landI = winFx.popT0 ? (1 - Math.min(1, (now - winFx.popT0) / 420)) : 0;
            const ay = baseR * 0.02;
            for(let g = 3; g >= 1; g--){
              winFxBurst.ellipse(0, ay, baseR * (0.30 + g * 0.16), baseR * (0.10 + g * 0.052))
                .fill({ color: tierCol, alpha: (0.05 + landI * 0.12) * (g / 3) });
            }
          }


          

          
          
          if(tier >= 3){
            const numRays = tier >= 6 ? 24 : tier >= 5 ? 16 : tier >= 4 ? 12 : 8;
            const rayLenBase = baseR * (tier >= 5 ? 1.25 : tier >= 4 ? 1.05 : 0.90);
            const rayT = el * 0.0004;       
            for(let i = 0; i < numRays; i++){
              const a = rayT + (i / numRays) * Math.PI * 2;

              const lag = (i / numRays) * 0.45;
              const rayP = Math.max(0, Math.min(1, (el - 80 - lag * 420) / 320));
              if(rayP <= 0) continue;

              const diagBias = Math.abs(Math.sin(a * 2));   
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


          if(tier >= 3){
            const numSparks = tier >= 6 ? 18 : tier >= 5 ? 14 : tier >= 4 ? 10 : 6;
            const sparkR = baseR * 1.00;
            for(let i = 0; i < numSparks; i++){
              const a = (i / numSparks) * Math.PI * 2 + (i * 0.31);
              const phase = i * 0.7;
              const pulse = 0.6 + 0.4 * Math.sin(el * 0.005 + phase);
              
              const rJ = sparkR * (0.85 + (i % 3) * 0.10);
              const sx = Math.cos(a) * rJ;
              const sy = Math.sin(a) * rJ * 0.55;
              const sr = 3 * pulse;
              
              winFxBurst.circle(sx, sy, sr * 2.2)
                .fill({ color: tierCol, alpha: 0.18 * pulse });
              
              const sl = sr * 1.5;
              winFxBurst.moveTo(sx - sl, sy).lineTo(sx + sl, sy)
                .stroke({ color: 0xf5f7fa, width: 1.0, alpha: 0.85 * pulse });
              winFxBurst.moveTo(sx, sy - sl).lineTo(sx, sy + sl)
                .stroke({ color: 0xf5f7fa, width: 1.0, alpha: 0.85 * pulse });
              winFxBurst.circle(sx, sy, sr * 0.40)
                .fill({ color: 0xf5f7fa, alpha: pulse });
            }
          }

          
          if(tier >= 5){
            const ringR = baseR * 0.82;
            const ringBreath = 1 + Math.sin(el * 0.003) * 0.015;
            winFxBurst.ellipse(0, 0, ringR * ringBreath, ringR * 0.55 * ringBreath)
              .stroke({ color: tierCol, width: 0.8, alpha: 0.30 });
            winFxBurst.ellipse(0, 0, ringR * 1.12 * ringBreath, ringR * 0.55 * 1.12 * ringBreath)
              .stroke({ color: tierCol, width: 0.6, alpha: 0.18 });
          }

          
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

            if(el < 400){
              const fl = Math.max(0, 1 - el/320);

              

              
              if(fl > 0){
                const _sx = winDisplay.scale.x || 1, _sy = winDisplay.scale.y || 1;
                winFxBurst.rect(-winDisplay.x/_sx, -winDisplay.y/_sy,
                                app.screen.width/_sx, app.screen.height/_sy)
                  .fill({ color:0xffffff, alpha:0.12*fl });   
              }
              const cb = Math.max(0, 1 - el/400), off = 3 + 5*cb;

              winFxBurst.circle(-off,0,baseR*1.05).stroke({ color:0xff2ad0, width:2.5, alpha:0.24*cb });
              winFxBurst.circle(0,0,baseR*1.05).stroke({ color:0xffe6f4, width:2.0, alpha:0.16*cb });
              winFxBurst.circle(off,0,baseR*1.05).stroke({ color:0x7fe7ff, width:2.5, alpha:0.20*cb });
            }
          }
        }


        

        let tierLabelText = '';
        if(winFx.customLabel){
          tierLabelText = winFx.customLabel;
        } else if(tier === 1)       tierLabelText = ''; 
        else if(tier === 2)  tierLabelText = socialFilter('WIN');
        else if(tier === 3)  tierLabelText = socialFilter('NICE WIN');
        else if(tier === 4)  tierLabelText = socialFilter('BIG WIN');
        else if(tier === 5)  tierLabelText = socialFilter('MEGA WIN');
        else                  tierLabelText = socialFilter('EPIC WIN');
        if(tierLabelText){

          
          const labelSize = tier >= 5 ? 22 : tier >= 4 ? 18 : tier >= 3 ? 16 : 14;
          const labelTrack = tier >= 5 ? 9 : tier >= 4 ? 7 : 5.5;
          bigWinLabel.style.fontSize = labelSize;
          bigWinLabel.style.letterSpacing = labelTrack;
          bigWinLabel.style.fill = 0xf5f7fa;
          bigWinLabel.style.stroke = null;
          bigWinLabel.text = tierLabelText;
          
          const padX = 26, padY = 9;
          const rW = bigWinLabel.width + padX * 2;
          const rH = labelSize + padY * 2;
          const rR = rH * 0.5;
          const ribbonY = -baseR * 0.36;
          
          winRibbonG.roundRect(-rW/2 - 6, ribbonY - rH/2 - 6, rW + 12, rH + 12, rR + 6)
            .fill({ color: tierCol, alpha: 0.10 });
          
          winRibbonG.roundRect(-rW/2, ribbonY - rH/2, rW, rH, rR)
            .fill({ color: 0x0a0a14, alpha: 0.95 });
          
          winRibbonG.roundRect(-rW/2, ribbonY - rH/2, rW, rH, rR)
            .stroke({ color: tierCol, width: 1.3, alpha: 0.95 });
          
          winRibbonG.roundRect(-rW/2 + rR*0.5, ribbonY - rH/2 + 1, rW - rR, 0.8, 0.4)
            .fill({ color: 0xf5f7fa, alpha: 0.40 });
          
          for(let side = -1; side <= 1; side += 2){
            const dx = side * (rW/2 + 12);
            winRibbonG.circle(dx, ribbonY, 3).fill({ color: tierCol, alpha: 0.95 });
            winRibbonG.circle(dx - side * 8, ribbonY, 2).fill({ color: tierCol, alpha: 0.55 });
          }

          
          
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

        
        const amountSize = tier >= 6 ? 92 : tier >= 5 ? 76 : tier >= 4 ? 62 : tier >= 3 ? 50 : 42;
        bigWinAmount.style.fontSize = amountSize;
        bigWinAmount.position.set(0, baseR * 0.02);


        const undW = Math.min(bigWinAmount.width * 0.85, baseR * 1.2);
        const undY = bigWinAmount.position.y + amountSize * 0.55;
        winUnderlineG.roundRect(-undW/2, undY, undW, 1.6, 0.8)
          .fill({ color: tierCol, alpha: 0.85 });
        winUnderlineG.roundRect(-undW/2 - 4, undY - 2, undW + 8, 5, 2.5)
          .fill({ color: tierCol, alpha: 0.18 });


        

        
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

          if(isReduced()){
            bigWinMult.alpha = 0.65;
          } else if(winFx.popT0){
            const mp = Math.min(1, (now - winFx.popT0) / 260);
            const me = 1 - Math.pow(1 - mp, 3);
            bigWinMult.alpha = 0.65 * me;
            bigWinMult.scale.set(0.85 + 0.15 * me);
            bigWinMult.position.set(0, undY + 22 + (1 - me) * 6);
          } else {
            bigWinMult.alpha = 0;   
          }
        } else {
          bigWinMult.visible = false;
        }
      }
    }

    
    drawBonusIgnite(performance.now());
    
    drawFsPortal(performance.now());

    particleG.clear();
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.t+=16;
      const life=1-p.t/p.life;
      if(life<=0){ particles.splice(i,1); continue; }
      if(p.kind==='fire'){
        p.x+=p.vx; p.y+=p.vy; p.vy*=0.99; p.vx*=0.98;        
        const fl=0.82+vrnd()*0.18;
        winGlowAddG.circle(p.x,p.y, p.r*(0.5+life*0.6)*fl)
          .fill({ color:p.color, alpha:Math.sin(life*Math.PI)*0.55*fl });
      } else {

        

        
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.085;          
        p.vx *= 0.985;           
        p.vy *= 0.985;
        if(p.spin) p.rot = (p.rot || 0) + p.spin;
        
        const rPhase = p.t / p.life;
        const rEnv  = rPhase < 0.25
          ? rPhase * 4
          : (1 - (rPhase - 0.25) / 0.75) * 0.85 + 0.15;
        const rNow = p.r * rEnv;
        const a    = Math.pow(life, 0.7);   
        
        particleG.circle(p.x, p.y, rNow * 2.8)
          .fill({ color: p.color, alpha: a * 0.14 });
        
        particleG.circle(p.x, p.y, rNow * 1.7)
          .fill({ color: p.color, alpha: a * 0.42 });
        
        particleG.circle(p.x, p.y, rNow * 1.05)
          .fill({ color: p.color, alpha: a * 0.72 });
        
        particleG.circle(p.x, p.y, rNow * 0.55)
          .fill({ color: 0xffffff, alpha: a * 0.95 });
      }
    }


    
    
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
        
        stage.position.set(app.screen.width / 2 + _shX, app.screen.height / 2 + _shY);
      }
    } else if(stage.pivot.x !== 0 || stage.scale.x !== 1){
      
      stage.pivot.set(0, 0);
      stage.scale.set(1);
      stage.position.set(_shX, _shY);
    } else {
      
      stage.position.set(_shX, _shY);
    }


    
    
    [minusBtn, plusBtn].forEach(b => {
      if(!b || b._baseScale == null) return;
      const target = b._pressed ? b._baseScale * 0.96 : b._baseScale;
      const decay = b._pressed ? 0.42 : 0.24;
      b._displayScale += (target - b._displayScale) * decay;
      b.scale.set(b._displayScale);
    });


    

    

    

    

    if(spinBtn._baseScale){
      const reduced = isReduced();
      let target;
      if(spinBtn._pressed && !STAKE.replay){
        target = spinBtn._baseScale * 0.97;      
      } else if(spinBtn._commitT0 && !STAKE.replay){
        
        const pp = Math.min(1, (now - spinBtn._commitT0) / 180);
        if(pp >= 1){ spinBtn._commitT0 = 0; }
        
        const k = pp < 0.7 ? 0.96 + 0.04 * (1 - Math.pow(1 - pp/0.7, 3))
                           : 1.00 + 0.012 * Math.sin((pp-0.7)/0.3 * Math.PI);
        target = spinBtn._baseScale * k;
      } else if(State.phase===Phase.IDLE && !spinBtnBroke && !STAKE.replay){
        const breathe = reduced ? 1 : 1 + Math.sin(now*0.005)*0.02;
        target = spinBtn._baseScale * breathe;
      } else {
        
        target = spinBtn._baseScale;
      }
      if(spinBtn._displayScale == null) spinBtn._displayScale = spinBtn._baseScale;

      const decay = spinBtn._pressed ? 0.36 : (spinBtn._commitT0 ? 0.55 : 0.30);
      spinBtn._displayScale += (target - spinBtn._displayScale) * decay;
      spinBtn.scale.set(spinBtn._displayScale);
    }
    
    if(buyBar.visible && State.phase===Phase.IDLE && buyBar._baseScale && !buyBar._inlineW){
      buyBar._pulse+=0.003*dt;
      buyBar.scale.set(buyBar._baseScale*(1+Math.sin(buyBar._pulse*6.28)*0.018));
    } else if(buyBar.visible && buyBar._inlineW){

      
      buyBar.scale.set(1);
      if(!isReduced() && State.phase===Phase.IDLE){
        const p = (Math.sin(now * 0.0035) + 1) * 0.5;     
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

  
  function layoutReplayBar(){
    const W=app.screen.width, H=app.screen.height;

    
    
    const tinyRP = H < 330;
    const barW = Math.min(540, W*0.94);
    const _btnH = tinyRP ? 36 : 40;  
    const _barH = tinyRP ? 58 : 74;
    const _barY = H - _barH - (tinyRP ? 4 : 12);
    rbBg.clear().roundRect(W/2-barW/2, _barY, barW, _barH, 12)
      .fill({ color:0x1f1c2e, alpha:0.95 }).stroke({ color:0xff5a9c, width:2 });
    rbText.position.set(W/2, _barY + (tinyRP ? 10 : 14));
    rbDisclosure.position.set(W/2, _barY + (tinyRP ? 26 : 34));
    const btnW=120;
    rbAgain._bg.clear().roundRect(-btnW/2,-_btnH/2,btnW,_btnH,9).fill(0xff5a9c);
    rbAgain.position.set(W/2, _barY + _barH - _btnH/2 - 4);

    rbAgain.hitArea = new PIXI.Rectangle(-Math.max(60, btnW/2), -22, Math.max(120, btnW), 44);
  }

  

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
      const v=new PIXI.Text({ text:val, style:{ fontFamily:'Luckiest Guy', fontSize:11, fill:0xf5f7fa }});   
      v.anchor.set(0.5,0); v.position.set(x,10); rbDisclosure.addChild(v);
    });
  }

  
  
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
        flashWinValue(Math.round(betX6*baseMx/100), baseMx);   
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

    

    
    spinBtn.eventMode='none'; spinBtn.alpha=0.4; spinBtn.tint=0x888888;
    buyBar.visible=false; State.muted=true; State.autoplay.active=false;
    [minusBtn,plusBtn].forEach(b => { b.eventMode='none'; b.alpha=0.4; });
    [btnAutoplay,btnTurbo].forEach(b => { b.eventMode='none'; b.alpha=0.4; });
    
    [btnSound, btnInfo, btnSettings].forEach(b => {
      if(b){ b.eventMode='none'; b.alpha=0.55; }
    });
    
    if(betValue){ betValue.eventMode='none'; betValue.cursor='default'; }
    if(betLabel){ betLabel.eventMode='none'; betLabel.cursor='default'; }

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

  
  const rmQuery=matchMedia('(prefers-reduced-motion: reduce)');
  State.reducedSystem=rmQuery.matches;
  rmQuery.addEventListener?.('change',e => { State.reducedSystem=e.matches; });

  window.addEventListener('resize',() => layout());
  window.addEventListener('orientationchange',() => setTimeout(layout,150));


  

  

  
  
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


        _renderPrev = 0;

        
        spinBtn._pressed = false;

        if(hiddenForMs > 1500){

          try { layout(); } catch(e){}


          
          if(winFx.on && winFx.t0 && (performance.now() - winFx.t0 > winFx.dur * 2)){
            winFx.on = false;
            winDisplay.alpha = 0;
            winDisplay.scale.set(1);

            
            if(typeof bigWinAmount !== 'undefined') bigWinAmount.text = '';
          }

          
          if(introOverlay.visible && introOverlay._fadeIn){
            introOverlay._fadeIn = performance.now();
          }
        }
      }
    } catch(e){
      
      if(STAKE.debug) console.log('visibility recovery error', e);
    }
  });

  
  let _activeRound = null;
  if(!STAKE.replay){
    try {
      
      lprog.textContent='AUTHENTICATING';
      const auth=await RGS.authenticate();
      if(auth.balance!=null)
        State.balanceX6 = typeof auth.balance==='object' ? auth.balance.amount : auth.balance;
      if(auth.config && auth.config.betLevels && auth.config.betLevels.length){
        State.betLevels=auth.config.betLevels;
        State.betIdx=Math.min(State.betIdx,State.betLevels.length-1);
        State.betX6=State.betLevels[State.betIdx];
      }

      
      if(auth.round && auth.round.active) _activeRound = auth.round;
    } catch(e){ log('Auth failed',e); }
  }

  
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


  
  
  const _runResume = async () => {
    if(STAKE.replay) return runReplay();
    if(_activeRound){
      try {
        const evs = _activeRound.events || [];
        if(evs.length){
          const parsed = parseRound(evs, _activeRound.payoutMultiplier || 0);
          const resumeBet = deriveResumeBet(_activeRound);   
          State.betX6 = resumeBet;
          const _li = State.betLevels.indexOf(resumeBet); if(_li >= 0) State.betIdx = _li;
          await playReplayRound(parsed, resumeBet);
        }
      } catch(e){ log('resume round error', e); }

      

      let _resumeGuard = 0;
      while(winFx.on && _resumeGuard++ < 50) await delay(60);
      if(winFx.on){ winFx.on = false; winDisplay.alpha = 0; }

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

    

    

    

    
    window.__bootT = { reload: performance.now() };

    
    
    let _bootSeen = false;
    try { _bootSeen = localStorage.getItem('spBootSeen') === '1'; } catch(_){}
    const _loaderDur = _bootSeen ? 650 : 1400;

    let _forceIntro = false; try { _forceIntro = new URL(location.href).searchParams.get('intro') === '1'; } catch(_){}
    const _introAuto = _forceIntro ? 0 : (_bootSeen ? 1100 : 0);
    try { localStorage.setItem('spBootSeen', '1'); } catch(_){}

    
    void _loaderDur;
    window.__bootT.loaderDone = performance.now() - window.__bootT.reload;
    showIntroOverlay(() => {  }, _introAuto);
  }

})().catch((e) => {
  const lp=document.getElementById('lprog');
  if(lp){ lp.textContent='ERR: '+(e&&e.message?e.message:e); lp.style.color='#ff8a8a'; }
  if(new URL(location.href).searchParams.get('debug')==='true') console.error('PIXI INIT ERROR:',e);
});


export {};
