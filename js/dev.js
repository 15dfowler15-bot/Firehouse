(() => {
  'use strict';
  const F=window.FH, $=id=>document.getElementById(id);
  const el={panel:$('devPanel'),toggle:$('devToggle'),close:$('devClose'),rtp:$('devRtp'),bonus:$('devBonus'),fire:$('devFirestarters'),seed:$('devSeed'),box:$('armedBox'),arm:$('armBtn'),sim:$('simBtn'),out:$('simOutput'),tele:$('telemetry'),payBtn:$('paytableBtn'),payDialog:$('paytableDialog'),payContent:$('paytableContent')};
  F.devArmed=null;
  function selection(){return{rtp:+el.rtp.value,bonus:+el.bonus.value,features:[...el.panel.querySelectorAll('.feature-checks input:checked')].map(x=>x.value),firestarters:Math.max(0,Math.min(8,+el.fire.value||0)),seedTag:el.seed.value.trim()};}
  function reset(){el.rtp.value=String(F.DEFAULT_RTP);el.bonus.value='0';el.fire.value='0';el.seed.value='';el.panel.querySelectorAll('.feature-checks input').forEach(x=>x.checked=false);}
  function box(){const d=F.devArmed;el.box.classList.toggle('armed',!!d);if(!d){el.box.innerHTML='<strong>Not armed</strong><span>Normal RNG will be used.</span>';return;}const bits=[`${d.rtp}% profile`,d.bonus?`${d.bonus}-Alarm bonus`:null,...d.features.map(x=>x.toUpperCase()),d.firestarters?`${d.firestarters} Firestarter${d.firestarters===1?'':'s'}`:null].filter(Boolean);el.box.innerHTML=`<strong>ARMED FOR NEXT SPIN</strong><span>${bits.join(' · ')}</span>`;}
  function consume(){return F.devArmed;}
  function clear(){F.devArmed=null;reset();box();}
  function toggle(open){el.panel.classList.toggle('open',open);el.panel.setAttribute('aria-hidden',String(!open));}
  function telemetry(){el.tele.textContent=F.state.lastTelemetry?JSON.stringify(F.state.lastTelemetry,null,2):'No spin recorded yet.';}

  function fastSpin(profile){
    let board=F.makeBoard(profile,{allowAlarm:true}),fires=Array(F.CELLS).fill(0),x=0,guard=0;
    const locked=F.alarmCount(board),features=F.chooseFeature(profile);
    const localUpgrade=(arr,i,tier=3)=>{
      const lv=tier===4?F.FIRE_LEVELS_4:F.FIRE_LEVELS,cur=arr[i];
      if(!cur){arr[i]=lv[0];return;}
      const p=Math.max(0,lv.indexOf(cur));arr[i]=lv[Math.min(lv.length-1,p+1)];
    };
    const localResolve=(b,arr,tier=3)=>{
      b.forEach((s,i)=>{if(s==='firestarter'){localUpgrade(arr,i,tier);b[i]=F.newSymbol(profile,{allowAlarm:false});}});
    };
    const localSpread=(arr,positions,tier=3)=>{
      const candidates=new Set();
      for(const i of positions){
        const r=Math.floor(i/F.COLS),c=i%F.COLS;
        [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([rr,cc])=>{
          if(rr>=0&&rr<F.ROWS&&cc>=0&&cc<F.COLS){const p=rr*F.COLS+cc;if(!arr[p])candidates.add(p);}
        });
      }
      if(candidates.size&&F.rng()<.42){const i=F.pick([...candidates]);arr[i]=(tier===4?F.FIRE_LEVELS_4:F.FIRE_LEVELS)[0];}
    };
    if(features.includes('firetruck')){
      let n=F.randInt(2,5),a=[...Array(F.CELLS).keys()].filter(i=>board[i]!=='alarm');
      while(n--&&a.length)board[a.splice(Math.floor(F.rng()*a.length),1)[0]]='wild';
    }
    if(features.includes('axe')){
      const low=board.map((s,i)=>F.LOWS.has(s)?i:-1).filter(i=>i>=0).slice(0,F.randInt(3,6));
      board=F.cascadeBoard(board,low,profile,{allowAlarm:false}).board;
    }
    if(features.includes('hose')){
      const row=F.randInt(0,F.ROWS-1),clear=Array.from({length:F.COLS},(_,c)=>row*F.COLS+c).filter(i=>board[i]!=='alarm');
      board=F.cascadeBoard(board,clear,profile,{allowAlarm:false}).board;
    }
    if(features.includes('backdraft')){
      let n=F.randInt(3,5),a=[...Array(F.CELLS).keys()];
      while(n--&&a.length)fires[a.splice(Math.floor(F.rng()*a.length),1)[0]]=F.FIRE_LEVELS[0];
    }
    while(guard++<25){
      if(features.includes('backdraft'))localResolve(board,fires,3);
      const ev=F.evaluate(board,fires,profile);if(!ev.wins.length)break;x+=ev.total;
      if(features.includes('backdraft')){
        const burning=[...new Set(ev.wins.flatMap(w=>w.burning))];
        burning.forEach(i=>localUpgrade(fires,i,3));localSpread(fires,burning,3);
      }
      board=F.cascadeBoard(board,ev.remove,profile,{allowAlarm:false,allowFirestarter:features.includes('backdraft')}).board;
    }
    if(locked>=3){
      const tier=Math.min(5,locked),spins=tier===3?8:tier===4?10:12,persist=tier===5;
      let bf=Array(F.CELLS).fill(0);
      for(let s=0;s<spins;s++){
        if(!persist)bf.fill(0);
        let b=F.makeBoard(profile,{allowAlarm:false,allowFirestarter:true}),g=0;
        while(g++<25){
          localResolve(b,bf,tier);
          const ev=F.evaluate(b,bf,profile);if(!ev.wins.length)break;x+=ev.total;
          const burning=[...new Set(ev.wins.flatMap(w=>w.burning))];
          burning.forEach(i=>localUpgrade(bf,i,tier));localSpread(bf,burning,tier);
          b=F.cascadeBoard(b,ev.remove,profile,{allowAlarm:false,allowFirestarter:true}).board;
        }
      }
    }
    return x;
  }
  async function simulate(){if(F.state.busy)return;const profile=F.PROFILES[+el.rtp.value||F.DEFAULT_RTP];el.sim.disabled=true;el.out.textContent='Running 10,000 development spins…';await F.sleep(20);let total=0,wins=0,max=0,N=10000;for(let i=0;i<N;i++){const x=fastSpin(profile);total+=x;if(x>0)wins++;max=Math.max(max,x);if(i%2000===0)await F.sleep(0);}el.out.innerHTML=`Profile <b>${profile.target}%</b> · observed RTP <b>${(100*total/N).toFixed(2)}%</b> · hit rate <b>${(100*wins/N).toFixed(1)}%</b> · max <b>${max.toFixed(1)}×</b><br><span style="opacity:.72">Monte Carlo sample only; not a certification result.</span>`;el.sim.disabled=false;}
  function paytable(){const rows=F.PAYING.map(k=>{const s=F.SYMBOLS[k];return `<tr><td><span class="symbol-chip"><b>${s.icon}</b>${s.label}</span></td>${s.pays.map(x=>`<td>${x.toFixed(2)}×</td>`).join('')}</tr>`}).join('');el.payContent.innerHTML=`<div style="overflow:auto"><table class="paytable-table"><thead><tr><th>Symbol</th><th>6–7</th><th>8–9</th><th>10–11</th><th>12–14</th><th>15–20</th></tr></thead><tbody>${rows}</tbody></table></div><div class="rule-card"><b>Pay anywhere:</b> 6+ matching symbols anywhere on the 5×4 board pay. Wilds substitute for paying symbols and wins cascade.</div><div class="rule-card"><b>Fire:</b> burning positions participating in a win add their shown multipliers. Used fire upgrades and may spread to an adjacent cell.</div><div class="rule-card"><b>Alarm Bonus:</b> 3 alarms = 8 free spins, 4 = 10, 5 = 12. Fire resets each spin in 3/4 Alarm and persists through the full 5-Alarm bonus.</div><div class="rule-card"><b>Math note:</b> RTP choices are development profiles, not independently certified theoretical RTP values.</div>`;}

  el.toggle.addEventListener('click',()=>toggle(true));el.close.addEventListener('click',()=>toggle(false));
  el.arm.addEventListener('click',()=>{if(F.state.busy)return;F.devArmed=selection();box();});el.sim.addEventListener('click',simulate);el.payBtn.addEventListener('click',()=>el.payDialog.showModal());
  paytable();box();telemetry();F.dev={consume,clear,telemetry};
})();
