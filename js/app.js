/* ==========================================================================
   EV Gym — core: session flow, reward channels, ledger, hints, tutorial
   Round logic lives in rounds-guess.js and rounds-dice.js; calibration
   surfaces in stats.js. Client-only. All data stays in localStorage.
   ========================================================================== */
'use strict';

/* ---------------- utilities ---------------- */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const clamp = (v,a,b) => Math.min(b, Math.max(a,v));

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function gauss(rng){
  let u = 0, v = 0;
  while(u === 0) u = rng();
  while(v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const sum    = a => a.reduce((x,y)=>x+y,0);
const mean   = a => a.length ? sum(a) / a.length : null;
const median = a => { const s = a.slice().sort((x,y)=>x-y), m = s.length >> 1;
                      return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; };
const std    = a => { const m = mean(a); return m == null ? 0 : (Math.sqrt(mean(a.map(x=>(x-m)*(x-m)))) || 0); };
function shuffle(a, rng){
  for(let i = a.length - 1; i > 0; i--){
    const j = (rng() * (i + 1)) | 0;
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/* ---------------- config ---------------- */
const CHIPS       = [0.10, 0.30, 0.50, 0.70, 0.90];
const CHIP_LABELS = ['Very low','Low','Medium','High','Very high'];
const ROUNDS_PER_SESSION = 8;

const ROUND_TYPES = {
  guess:  { label: 'Guess & Bet',
            desc:  'Estimate a hidden quantity, then find the mispriced slot on a market of rival guesses' },
  bank:   { label: 'Bank or Push',
            desc:  'Grow a pot of dice past the bust zone — know when to walk away' },
  reroll: { label: 'Reroll Calculus',
            desc:  'Five dice, one category, one clock: call keep-versus-reroll against the math' }
};
const PRESETS = { easy: 0.3, medium: 1.0, hard: 1.8 };

const STIM_TYPES = ['dots','line','area','angle','duration'];
const STIM_SPEC = {
  dots:     { noun: 'count',    unit: '',    heading: 'How many dots?',       gheading: 'How many dots did you see?',   step: 1,  slider: null },
  line:     { noun: 'length',   unit: '',    heading: 'How long is the line?', gheading: 'How long was the line?',       step: 1,  slider: [5, 95] },
  area:     { noun: 'area',     unit: '',    heading: 'How big is the blob?',  gheading: 'How big was the blob?',        step: 5,  slider: [10, 650] },
  angle:    { noun: 'angle',    unit: '°',   heading: 'How wide is the angle?',gheading: 'How wide was the angle?',      step: 1,  slider: [5, 175] },
  duration: { noun: 'duration', unit: ' ms', heading: 'How long does it glow?',gheading: 'How long did it glow?',       step: 25, slider: [200, 4000] }
};

/* ---------------- persistence ---------------- */
const store = {
  get(k,d){ try{ const v = localStorage.getItem('evgym.'+k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem('evgym.'+k, JSON.stringify(v)); }catch(e){} }
};
let ledger   = store.get('ledger', []);
let settings = Object.assign(
  { sound: true,
    motion: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    hints: 'auto',
    types: { guess: true, bank: true, reroll: true },
    skill: { guess: 1, bank: 1, reroll: 1 } },
  store.get('settings', {})
);
settings.types = Object.assign({ guess:true, bank:true, reroll:true }, settings.types || {});
settings.skill = Object.assign({ guess:1, bank:1, reroll:1 }, settings.skill || {});
let streak     = store.get('streak', { current: 0, best: 0 });
let tutSeen    = store.get('tutSeen', false);
let forcedSeed = store.get('forcedSeed', null);

const motionOK = () => settings.motion;

/* ---------------- audio (Web Audio, generated) ---------------- */
let AC = null;
function ac(){
  if(!AC){ try{ AC = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return null; } }
  if(AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(freq, t0, dur, vol){
  const c = ac(); if(!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function processChime(){           /* unique process-reward timbre */
  if(!settings.sound) return;
  const c = ac(); if(!c) return; const t = c.currentTime;
  tone(1318.51, t, 0.55, 0.16); tone(1975.53, t + 0.08, 0.70, 0.10);
}
function outcomeSound(muted){
  if(!settings.sound) return;
  const c = ac(); if(!c) return; const t = c.currentTime;
  const v = muted ? 0.045 : 0.13;
  [523.25, 659.25, 783.99, 1046.50].forEach((f,i)=> tone(f, t + i*0.09, 0.4, v));
}

/* ---------------- session / round state ---------------- */
let session = null;
let round   = null;

function showPhase(id){
  $$('.phase').forEach(p => p.classList.remove('active'));
  if(id) $('#'+id).classList.add('active');
  window.scrollTo(0,0);
}

function buildQueue(){
  const active = Object.keys(ROUND_TYPES).filter(t => settings.types[t]);
  const types  = active.length ? active : ['guess'];
  const q = [];
  for(let i = 0; i < ROUNDS_PER_SESSION; i++) q.push({ type: types[i % types.length] });
  shuffle(q, Math.random);
  const pool = shuffle(STIM_TYPES.slice(), Math.random);
  let k = 0;
  q.forEach(item => { if(item.type === 'guess') item.stimulus = pool[(k++) % pool.length]; });
  return q;
}

function startSession(){
  session = { id: Date.now().toString(36), roundIndex: 0, queue: buildQueue(), records: [] };
  startRound();
}

function startRound(){
  const spec = session.queue[session.roundIndex];
  const seed = (forcedSeed == null) ? ((Math.random() * 2147483647) | 0) : forcedSeed;
  round = { type: spec.type, stimulus: spec.stimulus || 'dots', seed: seed, index: session.roundIndex };
  if(spec.type === 'bank') bankStart();
  else if(spec.type === 'reroll') rerollStart();
  else guessStart();
}

function finishRound(rec){
  rec.session = session ? session.id : null;
  if(!rec.time) rec.time = new Date().toISOString();
  ledger.push(rec);
  store.set('ledger', ledger);
  if(session) session.records.push(rec);
  adaptSkill(rec.round_type || 'guess');
  updateHUD();
}

function nextRound(){
  session.roundIndex += 1;
  if(session.roundIndex >= ROUNDS_PER_SESSION) showSummary('session');
  else startRound();
}

/* ---------------- skill levels, hints, adaptation ---------------- */
function skillLevel(type){
  if(settings.difficulty === 'auto') return settings.skill[type] != null ? settings.skill[type] : 1;
  return PRESETS[settings.difficulty] != null ? PRESETS[settings.difficulty] : 1;
}
function rollingBrier(type, lastN){
  lastN = lastN || 12;
  const rs = ledger.filter(r => (r.round_type || 'guess') === type && r.stated != null).slice(-lastN);
  return { n: rs.length, brier: rs.length ? mean(rs.map(r => r.brier)) : null };
}
function sharpRate(type, lastN){
  lastN = lastN || 8;
  const rs = ledger.filter(r => (r.round_type || 'guess') === type).slice(-lastN);
  if(!rs.length) return null;
  if(type === 'bank'){
    const d = rs.reduce((a,r)=> a + (r.decisions || 0), 0);
    const p = rs.reduce((a,r)=> a + (r.posDecisions || 0), 0);
    return d ? p / d : null;
  }
  if(type === 'reroll') return rs.filter(r => r.sharp).length / rs.length;
  return rs.filter(r => r.selPositive).length / rs.length;
}
/* Hints: auto strips them away once calibration tightens for that round type */
function hintsEnabled(type){
  if(settings.hints === 'on') return true;
  if(settings.hints === 'off') return false;
  if(type === 'bank') return skillLevel('bank') < 0.75;
  const rb = rollingBrier(type);
  const gate = (type === 'reroll') ? 0.13 : 0.20;
  return rb.n < 8 || rb.brier == null || rb.brier > gate;
}
function adaptSkill(type){
  if(settings.difficulty !== 'auto' || !ROUND_TYPES[type]) return;
  let lv = settings.skill[type];
  const rate = sharpRate(type, 8);
  if(rate != null){
    if(rate > 0.75) lv += 0.4;
    else if(rate < 0.45) lv -= 0.4;
  }
  if(type !== 'bank'){
    const rb = rollingBrier(type, 10);
    if(rb.n >= 5 && rb.brier != null){
      if(rb.brier < 0.16) lv += 0.3;
      else if(rb.brier > 0.30) lv -= 0.3;
    }
  }
  settings.skill[type] = clamp(lv, 0, 2);
  store.set('settings', settings);
}

/* ---------------- reward channels ---------------- */
function sharpToast(){
  const t = $('#toast');
  t.classList.add('show');
  clearTimeout(sharpToast._id);
  sharpToast._id = setTimeout(() => t.classList.remove('show'), 1500);
}
/* Process reward: fires the moment a +EV call is locked, before any reveal */
function processReward(el){
  streak.current += 1;
  streak.best = Math.max(streak.best, streak.current);
  store.set('streak', streak);
  updateStreakUI();
  processChime();
  sharpToast();
  if(el){
    el.classList.add('glow-btn');
    setTimeout(() => el.classList.remove('glow-btn'), 1300);
  }
}
/* Only a -EV decision breaks the streak — bad luck never does */
function breakStreak(){
  if(!streak.current) return;
  streak.current = 0;
  store.set('streak', streak);
  updateStreakUI();
}
function streakNoteDefault(){
  return streak.current > 0
    ? '⚡ Sharp Streak: ' + streak.current + (streak.current === streak.best ? ' (personal best)' : '')
    : 'Sharp Streak reset — a −EV call breaks it, not bad luck.';
}
function showReveal(o){
  $('#revealHeading').innerHTML = o.heading || '–';
  $('#recap').innerHTML = o.detail || '';
  const deb = $('#debrief');
  deb.textContent = o.debrief || '';
  deb.className = 'debrief ' + (o.good ? 'good' : 'muted');
  $('#streakNote').textContent = o.streakNote || streakNoteDefault();
  if(o.win){ outcomeSound(!!o.muted); if(motionOK()) confetti(); }
  showPhase('phase-reveal');
}

/* ---------------- shared confidence-chip row ---------------- */
function renderChips(container, onPick, initVal){
  container.innerHTML = '';
  for(let c = 1; c <= 5; c++){
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (c === initVal ? ' selected' : ''); b.textContent = c;
    b.title = CHIP_LABELS[c-1] + ' (' + Math.round(CHIPS[c-1] * 100) + '%)';
    b.addEventListener('click', () => {
      container.querySelectorAll('.chip').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      onPick(c);
    });
    container.appendChild(b);
  }
}

/* ---------------- confetti (outcome channel only) ---------------- */
function confetti(){
  const host = $('#fx');
  const colors = ['#7ef0d4','#8fb7ff','#ffe08a','#f5a3ff'];
  for(let i = 0; i < 28; i++){
    const p = document.createElement('div');
    p.className = 'confetti';
    p.style.background = colors[i % 4];
    p.style.left = (45 + Math.random() * 10) + '%';
    p.style.setProperty('--dx', (Math.random() * 240 - 120) + 'px');
    p.style.animationDelay = (Math.random() * 0.15) + 's';
    host.appendChild(p);
    setTimeout(() => p.remove(), 1600);
  }
}

/* ---------------- tutorial ---------------- */
const TUT = [
  ['Judge the decision, not the result',
   'A good call can lose and a bad call can win — luck is real. EV Gym trains the habit of separating choice quality from outcome quality.'],
  ['Two separate rewards',
   'Lock in a +EV call and the ⚡ SHARP reward fires immediately — before you know how it turned out. Winning is a separate, smaller celebration. A sharp call that loses still counts.'],
  ['Three ways to train',
   'Estimate hidden quantities and hunt for the mispriced slot on a market of rival guesses. Grow a pot of dice past the bust zone and bank it in time. Call keep-versus-reroll on five dice against the odds.'],
  ['Grow your crystal',
   'Every round is logged. The crystal tracks how well your confidence matches reality: say 70% and be right about 70% of the time to make it shine.']
];
let tutStep = 0;
function renderTut(){
  $('#tutTitle').textContent = TUT[tutStep][0];
  $('#tutBody').textContent  = TUT[tutStep][1];
  $('#tutNext').textContent  = tutStep === TUT.length - 1 ? 'Start' : 'Next';
}
function showTut(){ tutStep = 0; renderTut(); $('#tutorial').classList.add('show'); }

/* ---------------- debug panel (?debug=1) ---------------- */
function buildDebug(){
  const panel = $('#debugPanel');
  panel.classList.remove('hidden');
  panel.innerHTML =
    '<b>DEBUG</b><br>' +
    '<button id="dbgJson">export JSON</button>' +
    '<button id="dbgCsv">export CSV</button>' +
    '<button id="dbgReset">reset all</button><br>' +
    'force seed: <input id="dbgSeed" placeholder="blank = random">' +
    '<button id="dbgSeedSet">set</button>' +
    '<pre id="dbgOut"></pre>';
  $('#dbgJson').addEventListener('click', () => download('evgym-ledger.json', JSON.stringify(ledger, null, 2)));
  $('#dbgCsv').addEventListener('click', () => {
    if(!ledger.length) return;
    const keys = [];
    ledger.forEach(r => Object.keys(r).forEach(k => { if(!keys.includes(k)) keys.push(k); }));
    const csv = [keys.join(',')].concat(ledger.map(r => keys.map(k => JSON.stringify(r[k] == null ? '' : r[k])).join(','))).join('\n');
    download('evgym-ledger.csv', csv);
  });
  $('#dbgReset').addEventListener('click', () => {
    if(confirm('Wipe all EV Gym data?')){
      ['ledger','streak','settings','tutSeen','forcedSeed','diff'].forEach(k => localStorage.removeItem('evgym.' + k));
      location.reload();
    }
  });
  $('#dbgSeedSet').addEventListener('click', () => {
    const v = $('#dbgSeed').value.trim();
    forcedSeed = v === '' ? null : (parseInt(v, 10) | 0);
    store.set('forcedSeed', forcedSeed);
    $('#dbgOut').textContent = 'seed = ' + forcedSeed;
  });
  /* live EV board inspector (Guess & Bet rounds) */
  setInterval(() => {
    if(round && round.slots){
      $('#dbgOut').textContent = round.slots.map((s, i) =>
        i + ' ' + s.label + ' g=' + s.display + ' p=' + s.pModel.toFixed(2) +
        ' pay=' + s.payout.toFixed(1) + ' ev=' + s.ev.toFixed(2) + (i === round.bestIdx ? ' <-- BEST' : '')
      ).join('\n');
    }
  }, 1000);
}
function download(name, text){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------------- wiring ---------------- */
function syncToggles(){
  $('#soundBtn').classList.toggle('off', !settings.sound);
  $('#motionBtn').classList.toggle('off', !settings.motion);
  $('#soundBtn').textContent = settings.sound ? '🔔' : '🔕';
}
function resetBoardControls(){
  $('#lockBtn').classList.remove('hidden');
  $('#lockBtn').disabled = true;
  $('#revealBtn').classList.add('hidden');
  const ch = $('#chips');
  if(ch) ch.style.pointerEvents = '';
  $$('.slot').forEach(x => x.style.pointerEvents = '');
}
function renderTypeRow(){
  const row = $('#typeRow'); row.innerHTML = '';
  Object.keys(ROUND_TYPES).forEach(t => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'type-chip' + (settings.types[t] ? ' on' : '');
    b.innerHTML = '<b>' + (settings.types[t] ? '✓ ' : '') + ROUND_TYPES[t].label + '</b><span>' + ROUND_TYPES[t].desc + '</span>';
    b.addEventListener('click', () => {
      settings.types[t] = !settings.types[t];
      store.set('settings', settings);
      renderTypeRow();
    });
    row.appendChild(b);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  $('#difficulty').value = store.get('diff', 'medium');
  $('#hints').value = settings.hints || 'auto';
  renderTypeRow();

  $('#difficulty').addEventListener('change', () => store.set('diff', $('#difficulty').value));
  $('#hints').addEventListener('change', () => { settings.hints = $('#hints').value; store.set('settings', settings); });

  $('#startBtn').addEventListener('click', () => { ac(); resetBoardControls(); startSession(); });
  $('#statsBtn').addEventListener('click', () => showSummary('all'));
  $('#againBtn').addEventListener('click', () => { resetBoardControls(); showPhase('phase-home'); });

  $('#guessSlider').addEventListener('input', e => {
    const u = (round && STIM_SPEC[round.stimulus]) ? STIM_SPEC[round.stimulus].unit : '';
    $('#guessValue').textContent = e.target.value + u;
  });
  $('#guessBtn').addEventListener('click', () => { round.playerGuess = +$('#guessSlider').value; buildMarket(); });

  $('#lockBtn').addEventListener('click', lockIn);
  $('#backToBoard').addEventListener('click', () => showPhase('phase-board'));
  $('#confirmBet').addEventListener('click', confirmBet);
  $('#revealBtn').addEventListener('click', doRevealGuess);
  $('#nextBtn').addEventListener('click', () => { resetBoardControls(); nextRound(); });

  $('#bankRollBtn').addEventListener('click', bankRoll);
  $('#bankBankBtn').addEventListener('click', () => bankDecide('bank'));
  $('#bankPushBtn').addEventListener('click', () => bankDecide('push'));

  $('#rerollLockBtn').addEventListener('click', rerollLock);

  $('#soundBtn').addEventListener('click', () => { settings.sound = !settings.sound; store.set('settings', settings); syncToggles(); });
  $('#motionBtn').addEventListener('click', () => { settings.motion = !settings.motion; store.set('settings', settings); syncToggles(); });

  $('#tutNext').addEventListener('click', () => {
    tutStep += 1;
    if(tutStep >= TUT.length){
      $('#tutorial').classList.remove('show');
      tutSeen = true; store.set('tutSeen', true);
      showPhase('phase-home');
    } else renderTut();
  });

  syncToggles(); updateStreakUI(); updateHUD();

  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
  if(location.search.indexOf('debug') >= 0) buildDebug();

  showPhase(null);
  if(!tutSeen) showTut(); else showPhase('phase-home');
});
