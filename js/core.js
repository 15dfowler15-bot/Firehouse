(() => {
  'use strict';
  const FH = window.FH = {};
  FH.COLS = 5; FH.ROWS = 4; FH.CELLS = 20;
  FH.DEFAULT_RTP = 96;
  FH.BETS = [0.2,0.5,1,2,5];
  FH.PAY_BANDS = [[6,7],[8,9],[10,11],[12,14],[15,20]];
  FH.FIRE_LEVELS = [2,3,5,10,25,50];
  FH.FIRE_LEVELS_4 = [3,5,10,25,50,100];
  FH.SYMBOLS = {
    gloves:{label:'Fire Gloves',icon:'🧤',weight:26,pays:[.15,.25,.40,.75,1.50]},
    boots:{label:'Turnout Boots',icon:'🥾',weight:23,pays:[.20,.30,.50,1,2]},
    radio:{label:'Fire Radio',icon:'📻',weight:19,pays:[.25,.40,.75,1.50,3]},
    nozzle:{label:'Hose Nozzle',icon:'🚿',weight:15,pays:[.30,.50,1,2.50,5]},
    helmet:{label:'Fire Helmet',icon:'🪖',weight:11,pays:[.50,1,2,5,10]},
    dog:{label:'Dalmatian',icon:'🐕',weight:7.2,pays:[.75,1.50,3.50,8,20]},
    chief:{label:"Chief's Badge",icon:'🛡️',weight:4.2,pays:[1,2.50,6,15,40]},
    wild:{label:'Firehouse Wild',icon:'✠',weight:1.15,pays:null},
    alarm:{label:'Alarm',icon:'🚨',weight:1,pays:null},
    firestarter:{label:'Firestarter',icon:'🔥',weight:0,pays:null}
  };
  FH.PAYING = ['gloves','boots','radio','nozzle','helmet','dog','chief'];
  FH.LOWS = new Set(['gloves','boots','radio']);
  FH.PROFILES = {
    88:{target:88,payoutScale:88/96,premiumFactor:.91,wildFactor:.88,alarmFactor:.86,featureFactor:.82},
    92:{target:92,payoutScale:92/96,premiumFactor:.96,wildFactor:.94,alarmFactor:.93,featureFactor:.92},
    94:{target:94,payoutScale:94/96,premiumFactor:.98,wildFactor:.97,alarmFactor:.97,featureFactor:.96},
    96:{target:96,payoutScale:1,premiumFactor:1,wildFactor:1,alarmFactor:1,featureFactor:1},
    98:{target:98,payoutScale:98/96,premiumFactor:1.035,wildFactor:1.04,alarmFactor:1.04,featureFactor:1.05}
  };
  FH.FEATURE_CHANCES = {firetruck:.017,axe:.014,hose:.011,backdraft:.0045};
  FH.state = {board:[],fires:Array(20).fill(0),credits:1000,betIndex:2,busy:false,bonus:null,currentProfile:FH.PROFILES[96],spinId:0,stats:{spins:0,wagered:0,won:0},lastTelemetry:null};

  FH.rng = () => {
    if (globalThis.crypto?.getRandomValues) { const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]/4294967296; }
    return Math.random();
  };
  FH.randInt = (a,b) => Math.floor(FH.rng()*(b-a+1))+a;
  FH.pick = arr => arr[Math.floor(FH.rng()*arr.length)];
  FH.sleep = ms => new Promise(r=>setTimeout(r,ms));
  FH.weightedPick = entries => {
    let total=entries.reduce((s,e)=>s+Math.max(0,e.w),0), r=FH.rng()*total;
    for(const e of entries){r-=Math.max(0,e.w);if(r<=0)return e.k;} return entries.at(-1).k;
  };
  FH.weightsFor = (profile,{allowAlarm=true,allowFirestarter=false}={}) => Object.entries(FH.SYMBOLS).map(([k,s])=>{
    let w=s.weight;
    if(['helmet','dog','chief'].includes(k)) w*=profile.premiumFactor;
    if(k==='wild') w*=profile.wildFactor;
    if(k==='alarm') w=allowAlarm?w*profile.alarmFactor:0;
    if(k==='firestarter') w=allowFirestarter?1.75:0;
    return {k,w};
  }).filter(e=>e.w>0);
  FH.newSymbol = (profile,opts={}) => FH.weightedPick(FH.weightsFor(profile,opts));
  FH.makeBoard = (profile,opts={}) => Array.from({length:FH.CELLS},()=>FH.newSymbol(profile,opts));
  FH.alarmCount = board => board.filter(x=>x==='alarm').length;
  FH.forceAlarmCount = (board,n,profile) => {
    const positions=[...Array(FH.CELLS).keys()];
    for(let i=positions.length-1;i>0;i--){const j=Math.floor(FH.rng()*(i+1));[positions[i],positions[j]]=[positions[j],positions[i]];}
    for(let i=0;i<FH.CELLS;i++) if(board[i]==='alarm') board[i]=FH.newSymbol(profile,{allowAlarm:false});
    for(let i=0;i<n;i++) board[positions[i]]='alarm';
  };
  FH.payBand = n => { for(let i=0;i<FH.PAY_BANDS.length;i++){const [a,b]=FH.PAY_BANDS[i];if(n>=a&&n<=b)return i;}return n>20?4:-1; };
  FH.normalPay = (sym,count,profile) => {const band=FH.payBand(count);return band<0?0:FH.SYMBOLS[sym].pays[band]*profile.payoutScale;};
  FH.evaluate = (board,fires,profile) => {
    const wilds=[], by={}; FH.PAYING.forEach(s=>by[s]=[]);
    board.forEach((s,i)=>{if(s==='wild')wilds.push(i);else if(by[s])by[s].push(i);});
    const wins=[],remove=new Set();
    for(const sym of FH.PAYING){
      const positions=[...by[sym],...wilds],count=positions.length;if(count<6)continue;
      const base=FH.normalPay(sym,count,profile);if(!base)continue;
      const burning=positions.filter(i=>fires[i]>0),fireMult=burning.length?burning.reduce((a,i)=>a+fires[i],0):1;
      const amount=base*fireMult;wins.push({sym,count,base,fireMult,amount,positions,burning});positions.forEach(i=>remove.add(i));
    }
    return {wins,remove:[...remove],total:wins.reduce((a,w)=>a+w.amount,0)};
  };
  FH.cascadeBoard = (board,remove,profile,opts={}) => {
    const dead=new Set(remove),next=Array(FH.CELLS).fill(null),spawned=[];
    for(let c=0;c<FH.COLS;c++){
      const kept=[];for(let r=FH.ROWS-1;r>=0;r--){const i=r*FH.COLS+c;if(!dead.has(i)&&board[i]!=null)kept.push(board[i]);}
      let row=FH.ROWS-1;for(const s of kept){next[row*FH.COLS+c]=s;row--;}
      while(row>=0){const i=row*FH.COLS+c;next[i]=FH.newSymbol(profile,opts);spawned.push(i);row--;}
    } return {board:next,spawned};
  };
  FH.fireLevels = () => FH.state.bonus?.tier===4?FH.FIRE_LEVELS_4:FH.FIRE_LEVELS;
  FH.upgradeFire = i => {const lv=FH.fireLevels(),cur=FH.state.fires[i];if(!cur){FH.state.fires[i]=lv[0];return;}const p=Math.max(0,lv.indexOf(cur));FH.state.fires[i]=lv[Math.min(lv.length-1,p+1)];};
  FH.ignite = i => {if(!FH.state.fires[i])FH.state.fires[i]=FH.fireLevels()[0];else FH.upgradeFire(i);};
  FH.spreadFire = positions => {
    const c=new Set();for(const i of positions){const r=Math.floor(i/FH.COLS),col=i%FH.COLS;[[r-1,col],[r+1,col],[r,col-1],[r,col+1]].forEach(([rr,cc])=>{if(rr>=0&&rr<FH.ROWS&&cc>=0&&cc<FH.COLS){const x=rr*FH.COLS+cc;if(!FH.state.fires[x])c.add(x);}});}
    if(c.size&&FH.rng()<.42){FH.ignite(FH.pick([...c]));return true;}return false;
  };
  FH.resolveFirestarters = (board,profile,forced=0) => {
    const found=[];board.forEach((s,i)=>{if(s==='firestarter')found.push(i);});
    const candidates=[...Array(FH.CELLS).keys()].filter(i=>board[i]!=='alarm'&&!found.includes(i));
    while(found.length<forced&&candidates.length){const i=candidates.splice(Math.floor(FH.rng()*candidates.length),1)[0];board[i]='firestarter';found.push(i);}
    for(const i of found){FH.ignite(i);board[i]=FH.newSymbol(profile,{allowAlarm:false});}return found;
  };
  FH.chooseFeature = profile => {
    const active=[];for(const [k,p] of Object.entries(FH.FEATURE_CHANCES))if(FH.rng()<p*profile.featureFactor)active.push(k);
    return active.length<=1?active:[FH.pick(active)];
  };
})();