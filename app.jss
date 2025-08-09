/* Solo-System clone — app.js
   Implements daily quests, XP/level, stats, perks, penalty mode, persistence.
*/
const KEY='solo_system_v1';
let state = {
  quests:[], logs:[], level:1, xp:0, perks:[], stats:{STR:10,AGI:10,STA:10,LUC:5},
  penaltyLog:[], settings:{reminders:false}
};

const todayKey = d=> new Date(d.getFullYear(),d.getMonth(),d.getDate()).toISOString().slice(0,10);
const $ = id=>document.getElementById(id);
const consoleLog = (t)=>{ const c=$('console'); c.innerHTML = `${new Date().toLocaleTimeString()} — ${t}<br>` + c.innerHTML; }

// default Sung Jin-Woo early quests (editable)
function seed(){
  state.quests = [
    {id:'q1',name:'Push-ups 100',type:'physical',amount:100,difficulty:40,xp:60},
    {id:'q2',name:'Sit-ups 100',type:'physical',amount:100,difficulty:40,xp:60},
    {id:'q3',name:'Squats 100',type:'physical',amount:100,difficulty:40,xp:60},
    {id:'q4',name:'Run 10 km',type:'cardio',amount:10,difficulty:80,xp:120}
  ];
  state.level = 1; state.xp = 0; state.perks = []; state.logs = []; state.penaltyLog=[]; state.stats={STR:10,AGI:10,STA:10,LUC:5};
  save(); consoleLog('Seeded system with default quests.');
}

function save(){ localStorage.setItem(KEY,JSON.stringify(state)); }
function load(){ const s = localStorage.getItem(KEY); if(s) state = JSON.parse(s); else seed(); render(); }

function render(){
  renderQuests(); renderStatus(); renderPerks(); renderPenalty(); renderConsole();
}

function renderQuests(){
  const el = $('quests'); el.innerHTML='';
  const day = todayKey(new Date());
  state.quests.forEach(q=>{
    const done = state.logs.some(l=>l.quest==q.id && l.day==day);
    const d = document.createElement('div'); d.className='quest' + (done? ' done':'');
    d.innerHTML = `<div style="flex:1"><div style="font-weight:700">${q.name}</div><div class="meta">Difficulty ${q.difficulty} • XP ${q.xp}</div></div>`;
    d.onclick = ()=> toggleQuest(q.id);
    el.appendChild(d);
  });
}

function toggleQuest(qid){
  const day = todayKey(new Date());
  const exists = state.logs.find(l=>l.quest==qid && l.day==day);
  if(exists){
    state.logs = state.logs.filter(l=>!(l.quest==qid && l.day==day));
    consoleLog(`Quest unmarked: ${qid}`);
    state.lastAction = {type:'undo', quest:qid, day};
  } else {
    state.logs.push({quest:qid,day,ts:Date.now()});
    const q = state.quests.find(x=>x.id==qid);
    gainXP(q.xp);
    applyStatGains(q);
    consoleLog(`Quest completed: ${q.name} (+${q.xp} XP)`);
    state.lastAction = {type:'mark', quest:qid, day};
    // small celebration
    confetti();
  }
  save(); render();
}

function gainXP(amount){
  state.xp += amount;
  checkLevelUp();
  save();
}

function levelToNext(lvl){
  // exponential-ish thresholds: 100 * 1.6^(lvl-1)
  return Math.floor(100 * Math.pow(1.6, lvl-1));
}

function checkLevelUp(){
  while(state.xp >= levelToNext(state.level)){
    state.xp -= levelToNext(state.level);
    state.level += 1;
    consoleLog(`LEVEL UP! Reached level ${state.level}`);
    // choose perk
    const choices = perkChoices();
    // automatically award one (for simplicity) — pick best by random
    const award = choices[Math.floor(Math.random()*choices.length)];
    applyPerk(award);
    consoleLog(`Perk acquired: ${award.name}`);
  }
  save();
}

function perkChoices(){
  // return 3 random perk options
  const pool = [
    {id:'p_str5', name:'+5 STR', apply:()=> state.stats.STR +=5},
    {id:'p_agi5', name:'+5 AGI', apply:()=> state.stats.AGI +=5},
    {id:'p_sta5', name:'+5 STA', apply:()=> state.stats.STA +=5},
    {id:'p_xpboost', name:'10% XP Boost', apply:()=>{} /* handled in calc if implemented */},
    {id:'p_luck3', name:'+3 LUC', apply:()=> state.stats.LUC +=3}
  ];
  // pick 3 unique
  const out=[]; while(out.length<3){ const pick = pool[Math.floor(Math.random()*pool.length)]; if(!out.find(o=>o.id==pick.id)) out.push(pick); }
  return out;
}
function applyPerk(perk){
  state.perks.push({id:perk.id,name:perk.name,date:todayKey(new Date())});
  if(typeof perk.apply==='function') perk.apply();
  save(); renderPerks();
}

function applyStatGains(q){
  // small heuristic: physical tasks raise STR & STA; cardio raises STA/AGI
  if(q.type==='physical'){ state.stats.STR += Math.max(1,Math.floor(q.difficulty/30)); state.stats.STA += Math.max(1,Math.floor(q.difficulty/40)); }
  if(q.type==='cardio'){ state.stats.STA += Math.max(1,Math.floor(q.difficulty/25)); state.stats.AGI += Math.max(0,Math.floor(q.difficulty/60)); }
}

// status rendering
function renderStatus(){
  $('lvl').textContent = state.level;
  $('xp').textContent = `${state.xp} / ${levelToNext(state.level)}`;
  $('rank').textContent = computeRank();
  $('stat-str').textContent = state.stats.STR;
  $('stat-agi').textContent = state.stats.AGI;
  $('stat-sta').textContent = state.stats.STA;
  $('stat-luc').textContent = state.stats.LUC;
}

function computeRank(){
  // simple rank from level (E->D->C->B->A->S)
  if(state.level >= 40) return 'S';
  if(state.level >= 24) return 'A';
  if(state.level >= 12) return 'B';
  if(state.level >= 6) return 'C';
  if(state.level >= 3) return 'D';
  return 'E';
}

function renderPerks(){
  const el = $('perksList'); if(state.perks.length===0){ el.textContent='No perks yet.'; return; }
  el.innerHTML = state.perks.map(p=>`${p.name} • ${p.date}`).join('<br>');
}

function renderPenalty(){
  const el = $('penaltyLog'); el.textContent = state.penaltyLog.length ? state.penaltyLog.join('<br>') : 'No penalties.';
}

// end-of-day penalty check (callable)
function dailyCheck(){
  const day = todayKey(new Date());
  // if any quest missing, punish (simple demo)
  const missing = state.quests.filter(q=> !state.logs.some(l=>l.quest==q.id && l.day==day));
  if(missing.length>0){
    // apply penalty: subtract small stats and add entry
    state.stats.STR = Math.max(1, state.stats.STR - 1);
    state.stats.STA = Math.max(1, state.stats.STA - 1);
    const note = `Penalty: Missed ${missing.length} quests on ${day} — STR/STA -1`;
    state.penaltyLog.unshift(note);
    consoleLog(note);
    save(); render();
    // show punishment screen
    showPunishmentAnimation();
  } else {
    consoleLog('All quests completed today. No penalty.');
  }
}

function showPunishmentAnimation(){
  const c = document.createElement('div'); c.style.position='fixed'; c.style.left=0; c.style.top=0; c.style.right=0; c.style.bottom=0; c.style.background='linear-gradient(180deg, rgba(0,0,0,0.85), rgba(10,0,0,0.8))'; c.style.display='grid'; c.style.placeItems='center'; c.style.zIndex=9999; c.innerHTML = `<div style="color:#ff6b6b;font-weight:800;font-size:20px;letter-spacing:2px">SYSTEM — PENALTY ACTIVATED</div>`;
  document.body.appendChild(c); setTimeout(()=>{ document.body.removeChild(c); },2200);
}

// simple console
function renderConsole(){ /* handled via consoleLog */ }

// undo
document.getElementById('undo').addEventListener('click', ()=>{
  if(!state.lastAction) return alert('No action to undo');
  const a = state.lastAction;
  if(a.type==='mark') state.logs = state.logs.filter(l=>!(l.quest==a.quest && l.day==a.day));
  else if(a.type==='undo') state.logs.push({quest:a.quest, day:a.day, ts:Date.now()});
  state.lastAction=null; save(); render();
});

// export/import
document.getElementById('export').addEventListener('click', ()=>{
  const data = JSON.stringify(state,null,2); navigator.clipboard.writeText(data).then(()=>alert('Copied JSON to clipboard'));
});
document.getElementById('import').addEventListener('click', ()=>{
  const t = prompt('Paste exported JSON'); try{ state = JSON.parse(t); save(); render(); alert('Imported'); }catch(e){ alert('Invalid JSON'); }
});

// reminders (local)
document.getElementById('remind').addEventListener('click', async ()=>{
  if(!('Notification' in window)) return alert('Notifications not supported');
  const perm = await Notification.requestPermission(); if(perm!=='granted') return alert('Permission denied');
  state.settings.reminders = true; save(); scheduleReminders(); alert('Reminders enabled (page must be open)');
});
function scheduleReminders(){
  if(!state.settings.reminders) return; if(window._soloRem) return;
  window._soloRem = setInterval(()=>{ new Notification('SYSTEM — Quest Reminder', {body:'Open SYSTEM and complete your daily quests.'}) }, 1000*60*60*8);
}

// confetti (small)
function confetti(){
  try{
    const c = document.createElement('canvas'); c.style.position='fixed'; c.style.left=0; c.style.top='20%'; c.width = window.innerWidth; c.height = 160; c.style.zIndex = 9999; document.body.appendChild(c);
    const ctx = c.getContext('2d'); let parts=[]; for(let i=0;i<40;i++) parts.push({x:Math.random()*c.width,y:Math.random()*c.height/2,vx:(Math.random()-0.5)*6,vy:Math.random()*6+2,s:Math.random()*6+4,c:['#3ee7c1','#7ad7ff','#ff7b9c'][Math.floor(Math.random()*3)]});
    let t=0; const id = setInterval(()=>{ ctx.clearRect(0,0,c.width,c.height); t++; parts.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; ctx.fillStyle=p.c; ctx.fillRect(p.x,p.y,p.s,p.s/1.4); }); if(t>70){ clearInterval(id); document.body.removeChild(c); } },16);
  }catch(e){}
}

// punishment check trigger (for quick test)
window.addEventListener('keydown', e=>{ if(e.key==='p') dailyCheck(); });

// small background stars
(function bg(){
  const c=document.getElementById('bg'); if(!c) return; const ctx=c.getContext('2d');
  function resize(){ c.width = innerWidth; c.height=innerHeight; draw(); }
  window.addEventListener('resize', resize); resize();
  const stars = Array.from({length:90}, ()=> ({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*1.6+0.3,o:Math.random()*0.7+0.2}));
  function draw(){ ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle='rgba(10,10,30,0.6)'; ctx.fillRect(0,0,c.width,c.height); stars.forEach(s=>{ ctx.globalAlpha = s.o; ctx.fillStyle='#bfefff'; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }); requestAnimationFrame(draw); }
})();

// load
load();
