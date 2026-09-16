/* ==========================================================================
   EV Gym - Guess & Bet MVP
   Trains probabilistic reasoning: reward the decision, not the result.
   Client-only. All data stays in localStorage. See docs/BUILD_PLAN.md.
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
const median = a => { const s = a.slice().sort((x,y)=>x-y), m = s.length >> 1;
                      return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; };
const mean   = a => a.reduce((x,y)=>x+y,0) / a.length;
const std    = a => { const m = mean(a); return Math.sqrt(mean(a.map(x=>(x-m)*(x-m)))) || 0; };

/* ---------------- config ---------------- */
const CHIPS       = [0.10, 0.30, 0.50, 0.70, 0.90];
const CHIP_LABELS = ['Very low','Low','Medium','High','Very high'];
const PRESETS = {
  easy:   { label:'Easy',   dots:[15,40],  view:3500, noise:6,  guessMax:70  },
  medium: { label:'Medium', dots:[25,80],  view:2500, noise:10, guessMax:130 },
  hard:   { label:'Hard',   dots:[40,150], view:1500, noise:16, guessMax:220 }
};
const ROUNDS_PER_SESSION = 8;

/* ---------------- persistence ---------------- */
const store = {
  get(k,d){ try{ const v = localStorage.getItem('evgym.'+k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem('evgym.'+k, JSON.stringify(v)); }catch(e){} }
};
let ledger      = store.get('ledger', []);
let settings    = store.get('settings', { sound:true, motion:!window.matchMedia('(prefers-reduced-motion: reduce)').matches });
let streak      = store.get('streak', { current:0, best:0 });
let tutSeen     = store.get('tutSeen', false);
let forcedSeed  = store.get('forcedSeed', null);

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

/* ---------------- session flow ---------------- */
function startSession(){
  session = { id: Date.now().toString(36), roundIndex: 0, diffKey: $('#difficulty').value, records: [] };
  startRound();
}

function startRound(){
  const diff = PRESETS[session.diffKey];
  const seed = (forcedSeed == null) ? ((Math.random() * 2147483647) | 0) : forcedSeed;
  const rng  = mulberry32(seed);
  const trueValue = Math.round(diff.dots[0] + rng() * (diff.dots[1] - diff.dots[0]));
  round = { seed: seed, rng: rng, diff: diff, trueValue: trueValue, index: session.roundIndex,
            selected: -1, chips: 0 };
  $('#roundLabel').textContent = 'Round ' + (session.roundIndex + 1) + ' of ' + ROUNDS_PER_SESSION;
  $('#guessRoundLabel').textContent = 'Round ' + (session.roundIndex + 1) + ' of ' + ROUNDS_PER_SESSION;
  drawStimulus();
  showPhase('phase-stim');
  const bar = $('#stimBar');
  bar.style.transition = 'none'; bar.style.width = '100%';
  void bar.offsetWidth;
  bar.style.transition = 'width ' + diff.view + 'ms linear';
  bar.style.width = '0%';
  setTimeout(() => {
    if(round && $('#phase-stim').classList.contains('active')){
      prepGuess();
      showPhase('phase-guess');
    }
  }, diff.view);
}

/* ---------------- stimulus: dot cluster ---------------- */
function drawStimulus(){
  const cv = $('#stimCanvas');
  cv.style.visibility = 'visible';
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const rng = round.rng, n = round.trueValue, pts = [];
  const minD = Math.max(7, Math.sqrt(W * H / n) * 0.45);
  let tries = 0;
  while(pts.length < n && tries < n * 300){
    tries++;
    const x = 12 + rng() * (W - 24), y = 12 + rng() * (H - 24);
    if(pts.every(p => { const dx = p[0]-x, dy = p[1]-y; return dx*dx + dy*dy >= minD*minD; }))
      pts.push([x, y]);
  }
  for(let i = pts.length; i < n; i++) pts.push([12 + rng()*(W-24), 12 + rng()*(H-24)]);
  ctx.fillStyle = '#e8ecf8';
  pts.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 6.2832); ctx.fill(); });
}
function prepGuess(){
  const g = $('#guessSlider');
  g.min = 5; g.max = round.diff.guessMax;
  g.value = Math.round(round.diff.guessMax / 2);
  $('#guessValue').textContent = g.value;
}

/* ---------------- market generation ---------------- */
function genField(T, rng, diff){
  const all = ['anchor','over','under','herd','outlier'];
  const nb  = rng() < 0.5 ? 1 : 2;
  const active = [];
  while(active.length < nb){
    const b = all[(rng() * all.length) | 0];
    if(!active.includes(b)) active.push(b);
  }
  const cluster = T + gauss(rng) * diff.noise * 0.6;
  const bots = [];
  for(let i = 0; i < 4; i++){
    let g = T + gauss(rng) * diff.noise;
    active.forEach(b => {
      const r = rng();
      if(b === 'anchor'  && r < 0.6){ const step = T > 60 ? 10 : 5; g = Math.round(g / step) * step; }
      if(b === 'over'    && r < 0.6){ g = T + Math.abs(g - T) * 1.15; }
      if(b === 'under'   && r < 0.6){ g = T - Math.abs(g - T) * 1.15; }
      if(b === 'herd'    && r < 0.6){ g = cluster + gauss(rng) * diff.noise * 0.25; }
      if(b === 'outlier' && i === 3){ g = T + (rng() < 0.5 ? -1 : 1) * diff.noise * (2 + rng() * 2); }
    });
    bots.push(g);
  }
  return bots;
}

/* pricing: extremity base + favorite/longshot bias + jitter (v4 anti-repetition fix) */
function priceBoard(guesses, rng){
  const med    = median(guesses);
  const spread = Math.max(2, (Math.max.apply(null, guesses) - Math.min.apply(null, guesses)) / 2);
  let p = guesses.map(g => 1.2 + Math.min(Math.abs(g - med) / spread, 1.6) * 5.3);
  if(rng() < 0.3){                                    /* 30%: misprice favorite or longshot */
    const order = guesses.map((g,i) => [Math.abs(g - med), i]).sort((a,b) => a[0] - b[0]);
    if(rng() < 0.5) p[order[0][1]] *= 1.45;             /* favorite too generous -> favorite can be +EV */
    else            p[order[order.length - 1][1]] *= 0.55;
  }
  return p.map(x => clamp(x * (0.85 + rng() * 0.30), 1.2, 12));
}

/* Monte Carlo posterior: field-consensus anchor, win = closest guess */
function modelProbs(guesses, rng){
  const anchor = median(guesses);
  const unc    = Math.max(3, std(guesses) * 1.1);
  const counts = guesses.map(() => 0);
  for(let s = 0; s < 1000; s++){
    const v = anchor + gauss(rng) * unc;
    let bi = 0, bd = Infinity;
    for(let i = 0; i < guesses.length; i++){
      const d = Math.abs(guesses[i] - v);
      if(d < bd){ bd = d; bi = i; }
    }
    counts[bi]++;
  }
  return counts.map(c => c / 1000);
}

function buildMarket(){
  const rng = round.rng;
  const bots = genField(round.trueValue, rng, round.diff);
  const guesses = [round.playerGuess].concat(bots);
  const payouts = priceBoard(guesses, rng);
  const p = modelProbs(guesses, rng);
  const slots = guesses.map((g, i) => ({
    id:        i === 0 ? 'player_0' : 'bot_' + i,
    label:     i === 0 ? 'You' : 'Bot ' + i,
    guess:     g,
    display:   Math.round(g),
    payout:    +payouts[i].toFixed(2),
    pModel:    p[i],
    implied:   1 / payouts[i],
    ev:        p[i] * payouts[i] - 1,
    isPlayer:  i === 0,
    isWinner:  false
  }));
  /* winning slot = closest guess to true value (ties: lowest slot index) */
  let wi = 0, wd = Infinity;
  slots.forEach((s, i) => { const d = Math.abs(s.guess - round.trueValue); if(d < wd){ wd = d; wi = i; } });
  slots[wi].isWinner = true;
  round.slots = slots;
  round.bestIdx = slots.reduce((bi, s, i, arr) => s.ev > arr[bi].ev ? i : bi, 0);
  round.selected = -1; round.chips = 0;
  renderBoard();
  showPhase('phase-board');
}

/* ---------------- board UI ---------------- */
function renderBoard(){
  const wrap = $('#slots'); wrap.innerHTML = '';
  round.slots.forEach((s, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'slot' + (s.isPlayer ? ' player' : '');
    el.dataset.idx = i;
    el.innerHTML =
      '<span class="slot-label">' + s.label + '</span>' +
      '<span class="slot-guess">' + s.display + '</span>' +
      '<span class="slot-payout">' + s.payout.toFixed(1) + '×</span>' +
      '<span class="slot-implied">~' + Math.round(s.implied * 100) + '% implied</span>';
    el.addEventListener('click', () => {
      round.selected = i;
      $$('.slot').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
      updateLockUI();
    });
    wrap.appendChild(el);
  });
  const cw = $('#chips'); cw.innerHTML = '';
  for(let c = 1; c <= 5; c++){
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = c;
    b.title = CHIP_LABELS[c-1] + ' (' + Math.round(CHIPS[c-1] * 100) + '%)';
    b.addEventListener('click', () => {
      round.chips = c;
      $$('.chip').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      updateLockUI();
    });
    cw.appendChild(b);
  }
  updateLockUI();
}
function updateLockUI(){
  const ok = round.selected >= 0 && round.chips > 0;
  $('#lockBtn').disabled = !ok;
  const s = round.slots && round.slots[round.selected];
  $('#lockPreview').textContent = ok
    ? 'Bet on ' + s.label + ' (' + s.display + ') at ' + s.payout.toFixed(1) + '× · confidence ' + CHIP_LABELS[round.chips - 1]
    : 'Select a slot and confidence';
}

/* ---------------- lock-in & process reward ---------------- */
function lockIn(){
  const s = round.slots[round.selected];
  round.stated     = CHIPS[round.chips - 1];
  round.selEV      = s.ev;
  round.selPositive= s.ev > 0;
  round.selBest    = round.selected === round.bestIdx;
  $('#lockSummary').innerHTML =
    'Slot: <b>' + s.label + ' (' + s.display + ')</b><br>' +
    'Payout: <b>' + s.payout.toFixed(1) + '×</b><br>' +
    'Market implies: <b>~' + Math.round(s.implied * 100) + '% chance</b><br>' +
    'Your confidence: <b>' + CHIP_LABELS[round.chips - 1] + ' (' + Math.round(round.stated * 100) + '%)</b>';
  showPhase('phase-lock');
}

function confirmBet(){
  /* decision quality is judged NOW, before the reveal */
  if(round.selPositive){
    streak.current += 1;
    const el = $('.slot[data-idx="' + round.selected + '"]');
    if(el) el.classList.add('glow');
    $('#sharpBadge').classList.remove('hidden');
    processChime();                      /* process channel: pre-reveal */
  } else {
    streak.current = 0;                  /* a -EV decision breaks the streak, bad luck never does */
  }
  streak.best = Math.max(streak.best, streak.current);
  store.set('streak', streak);
  updateStreakUI();
  /* return to the board (glow needs the slot); swap actions for reveal */
  $('#lockBtn').classList.add('hidden');
  $('#chips').style.pointerEvents = 'none';
  $$('.slot').forEach(x => x.style.pointerEvents = 'none');
  $('#revealBtn').classList.remove('hidden');
  showPhase('phase-board');
}

/* ---------------- reveal & debrief ---------------- */
function doReveal(){
  const s  = round.slots[round.selected];
  const win = s.isWinner;
  const outcome = win ? 1 : 0;
  const brier = Math.pow(round.stated - outcome, 2);

  $('#trueValue').textContent = round.trueValue;
  const recap = $('#recap'); recap.innerHTML = '';
  round.slots.forEach((sl, i) => {
    const d = document.createElement('div');
    d.className = 'recap-slot' + (sl.isWinner ? ' winner' : '') + (i === round.selected ? ' chosen' : '');
    d.textContent = sl.label + ' · ' + sl.display + ' · ' + sl.payout.toFixed(1) + '×';
    recap.appendChild(d);
  });

  const cell = (round.selPositive ? '+EV' : '-EV') + '/' + (win ? 'win' : 'loss');
  const msgs = {
    '+EV/win' : 'Sharp decision and good result. You found value — this is the best cell.',
    '+EV/loss': 'Sharp decision, unlucky result. This bet was worth making. Your Sharp Streak continues.',
    '-EV/win' : "You won, but the odds weren't in your favor. That was luck more than good process.",
    '-EV/loss': "This bet wasn't +EV, and it lost. No punishment — bad luck and bad decisions are different. Focus on the decision next time."
  };
  const deb = $('#debrief');
  deb.textContent = msgs[cell];
  deb.className = 'debrief ' + (round.selPositive ? 'good' : 'muted');
  $('#streakNote').textContent = round.selPositive
    ? '⚡ Sharp Streak: ' + streak.current + (streak.current === streak.best ? ' (personal best)' : '')
    : 'Sharp Streak reset — a −EV decision breaks it, not bad luck.';

  /* outcome channel: separate, muted on lucky -EV wins */
  if(win){
    outcomeSound(!round.selPositive);
    if(motionOK()) confetti();
  }

  /* ledger record */
  const rec = {
    session: session ? session.id : null,
    round: round.index, seed: round.seed, diff: session.diffKey,
    trueValue: round.trueValue, playerGuess: round.playerGuess,
    selectedSlot: s.id, guessDisplay: s.display,
    chips: round.chips, stated: round.stated,
    payout: s.payout, implied: +s.implied.toFixed(4), pModel: +s.pModel.toFixed(4),
    selEV: +round.selEV.toFixed(4),
    bestEV: +round.slots[round.bestIdx].ev.toFixed(4),
    selPositive: round.selPositive, selBest: round.selBest,
    bestPos: round.bestIdx, outcome: outcome,
    brier: +brier.toFixed(4),
    absErr: Math.abs(round.playerGuess - round.trueValue),
    relErr: +(Math.abs(round.playerGuess - round.trueValue) / round.trueValue).toFixed(4),
    time: new Date().toISOString()
  };
  ledger.push(rec);
  store.set('ledger', ledger);
  session.records.push(rec);
  updateHUD();
  showPhase('phase-reveal');
}

function nextRound(){
  session.roundIndex += 1;
  if(session.roundIndex >= ROUNDS_PER_SESSION) showSummary();
  else startRound();
}

/* ---------------- aggregation / calibration surface ---------------- */
function aggregate(recs){
  return {
    brier:   recs.length ? mean(recs.map(r => r.brier)) : null,
    posRate: recs.length ? recs.filter(r => r.selPositive).length / recs.length : null,
    bestRate:recs.length ? recs.filter(r => r.selBest).length / recs.length : null,
    avgErr:  recs.length ? mean(recs.map(r => r.relErr)) : null,
    buckets: CHIPS.map((p, i) => {
      const rs = recs.filter(r => r.chips === i + 1);
      return { stated: p, n: rs.length,
               hit: rs.length ? rs.filter(r => r.outcome === 1).length / rs.length : null };
    })
  };
}

function crystalSVG(clarity, uid){
  const blur  = (1 - clarity) * 5;
  const light = 30 + clarity * 40;
  return '<svg viewBox="0 0 100 120" class="crystal" aria-hidden="true">' +
    '<defs><filter id="cb' + uid + '"><feGaussianBlur stdDeviation="' + blur.toFixed(1) + '"/></filter></defs>' +
    '<polygon points="50,4 92,40 78,112 22,112 8,40" fill="hsl(190,70%,' + light.toFixed(0) + '%)" opacity="' + (0.35 + clarity*0.6).toFixed(2) + '" filter="url(#cb' + uid + ')"/>' +
    '<polygon points="50,4 92,40 50,62 8,40" fill="hsl(190,85%,' + (light+12).toFixed(0) + '%)" opacity="' + (0.45 + clarity*0.5).toFixed(2) + '"/>' +
    '<polygon points="50,62 92,40 78,112 50,112" fill="hsl(205,65%,' + light.toFixed(0) + '%)" opacity="' + (0.45 + clarity*0.45).toFixed(2) + '"/>' +
    '<polygon points="50,62 8,40 22,112 50,112" fill="hsl(175,65%,' + light.toFixed(0) + '%)" opacity="' + (0.45 + clarity*0.45).toFixed(2) + '"/>' +
    '</svg>';
}
const clarityFromBrier = b => (b == null ? 0.15 : clamp(1 - b / 0.25, 0.05, 1));

function updateHUD(){
  const a = aggregate(ledger);
  $('#crystalMini').innerHTML = crystalSVG(clarityFromBrier(a.brier), 'm');
  $('#calibLabel').textContent = a.brier == null
    ? 'No data yet — play to grow your crystal'
    : 'Brier ' + a.brier.toFixed(3) + ' · lower is better';
}
function updateStreakUI(){
  $('#streakVal').textContent = streak.current;
  $('#streakBest').textContent = 'best ' + streak.best;
}

function reliabilitySVG(a, w, h){
  const pad = 36;
  const X = p => pad + p * (w - 2 * pad);
  const Y = p => h - pad - p * (h - 2 * pad);
  let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" class="chart" role="img" aria-label="Reliability diagram">';
  s += '<line class="diag" x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(1) + '" y2="' + Y(1) + '"/>';
  s += '<line x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(1) + '" y2="' + Y(0) + '" stroke="#3a4568"/>';
  s += '<line x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(0) + '" y2="' + Y(1) + '" stroke="#3a4568"/>';
  s += '<text x="' + X(1) + '" y="' + (h - 10) + '" text-anchor="end">stated confidence</text>';
  s += '<text x="6" y="' + Y(1) + '">actual</text>';
  const pts = [];
  a.buckets.forEach(b => {
    if(b.n < 3 || b.hit == null) return;
    const over = b.hit < b.stated - 0.03;    /* below diagonal = overconfident */
    pts.push([b.stated, b.hit, over, b.n]);
  });
  if(pts.length){
    s += '<polyline fill="none" stroke="#2dd4bf88" stroke-width="2" points="' +
         pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ') + '"/>';
    pts.forEach(p => {
      s += '<circle class="pt' + (p[2] ? ' over' : '') + '" cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="6">' +
           '<title>' + Math.round(p[0]*100) + '% stated · ' + Math.round(p[1]*100) + '% actual (' + p[3] + ' bets)</title></circle>';
    });
  } else {
    s += '<text x="' + (w/2) + '" y="' + (h/2) + '" text-anchor="middle">Play more rounds to fill this in</text>';
  }
  return s + '</svg>';
}

/* ---------------- summary ---------------- */
function showSummary(){
  const a = aggregate(session.records);
  const all = aggregate(ledger);
  $('#sumBrier').textContent = a.brier == null ? '–' : a.brier.toFixed(3);
  $('#sumPos').textContent   = a.posRate == null ? '–' : Math.round(a.posRate * 100) + '%';
  $('#sumBest').textContent  = a.bestRate == null ? '–' : Math.round(a.bestRate * 100) + '%';
  $('#sumErr').textContent   = a.avgErr == null ? '–' : Math.round(a.avgErr * 100) + '%';
  $('#crystalBig').innerHTML = crystalSVG(clarityFromBrier(all.brier), 'b');
  $('#chartWrap').innerHTML  = reliabilitySVG(all, 560, 320);
  showPhase('phase-summary');
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
  ['Thinking in bets',
   'A good decision can have a bad outcome, and a bad decision can have a good one. EV Gym trains the habit of telling them apart.'],
  ['Two separate rewards',
   'Lock in a +EV bet and the ⚡ SHARP process reward fires immediately — before you know if you won. Winning itself is a separate, smaller celebration. A sharp bet that loses still counts.'],
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
    const keys = Object.keys(ledger[0]);
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
  /* last-round EV inspector */
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
  $('#sharpBadge').classList.add('hidden');
  $('#chips').style.pointerEvents = '';
}

document.addEventListener('DOMContentLoaded', () => {
  $('#difficulty').value = store.get('diff', 'medium');
  $('#difficulty').addEventListener('change', () => store.set('diff', $('#difficulty').value));

  $('#startBtn').addEventListener('click', () => { ac(); resetBoardControls(); startSession(); });
  $('#statsBtn').addEventListener('click', () => { session = session || { id: null, roundIndex: 0, diffKey: $('#difficulty').value, records: ledger.slice(-ROUNDS_PER_SESSION) }; showSummary(); });
  $('#againBtn').addEventListener('click', () => { resetBoardControls(); showPhase('phase-home'); });

  $('#guessSlider').addEventListener('input', e => $('#guessValue').textContent = e.target.value);
  $('#guessBtn').addEventListener('click', () => { round.playerGuess = +$('#guessSlider').value; buildMarket(); });

  $('#lockBtn').addEventListener('click', lockIn);
  $('#backToBoard').addEventListener('click', () => showPhase('phase-board'));
  $('#confirmBet').addEventListener('click', confirmBet);
  $('#revealBtn').addEventListener('click', doReveal);
  $('#nextBtn').addEventListener('click', () => { resetBoardControls(); nextRound(); });

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
