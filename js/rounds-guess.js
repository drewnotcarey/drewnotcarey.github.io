/* ==========================================================================
   EV Gym — Guess & Bet round
   Stimulus variants: dot count, line length, blob area, angle, timed glow.
   Market: synthetic rival guesses (anchor / over / under / herd / outlier /
   compression biases), extremity pricing with favorite-longshot mispricing,
   Monte Carlo model probabilities.
   ========================================================================== */
'use strict';

/* ---------------- round entry ---------------- */
function guessStart(){
  round.level = skillLevel('guess');
  round.rng   = mulberry32(round.seed);
  round.stimData = genStimulus(round.stimulus, round.rng, round.level);
  round.trueValue = round.stimData.true;
  round.view  = Math.round(3400 - 900 * round.level);
  $('#roundLabel').textContent = 'Round ' + (round.index + 1) + ' of ' + ROUNDS_PER_SESSION;
  $('#stimHeading').textContent = STIM_SPEC[round.stimulus].heading;
  const barWrap = $('#stimBar').parentElement;
  drawStimulus(false);
  showPhase('phase-stim');
  if(round.stimulus === 'duration'){
    barWrap.style.display = 'none';      /* a progress bar would leak the answer */
    runDurationStim();
    return;
  }
  barWrap.style.display = '';
  const bar = $('#stimBar');
  bar.style.transition = 'none'; bar.style.width = '100%';
  void bar.offsetWidth;
  bar.style.transition = 'width ' + round.view + 'ms linear';
  bar.style.width = '0%';
  setTimeout(() => {
    if(round && round.type === 'guess' && $('#phase-stim').classList.contains('active')){
      prepGuess();
      showPhase('phase-guess');
    }
  }, round.view);
}

/* ---------------- stimulus generation ---------------- */
function shoelace(pts){
  let a = 0;
  for(let i = 0; i < pts.length; i++){
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}
function blobPts(rng, r, cx, cy){
  const pts = [];
  for(let i = 0; i < 22; i++){
    const a = i / 22 * Math.PI * 2;
    const rr = r * (0.72 + rng() * 0.56);
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return pts;
}
function genStimulus(type, rng, level){
  if(type === 'dots'){
    const max = Math.round(40 + 55 * level);
    return { true: Math.round(15 + rng() * Math.max(10, max - 15)) };
  }
  if(type === 'line'){
    const L = 100 + rng() * 460;                 /* reference segment is 70px = "10" */
    return { true: Math.max(6, Math.round(10 * L / 70)), L: L };
  }
  if(type === 'area'){
    for(let t = 0; t < 60; t++){
      const pts = blobPts(rng, 35 + rng() * 70, 330, 175);
      const tv = Math.round(100 * shoelace(pts) / 6400);  /* reference square 80px = "100" */
      if(tv >= 20 && tv <= 600) return { true: tv, pts: pts };
    }
    const pts = blobPts(rng, 70, 330, 175);
    return { true: Math.round(100 * shoelace(pts) / 6400), pts: pts };
  }
  if(type === 'angle'){
    const B  = rng() * Math.PI * 2;
    const th = (15 + rng() * 150) * Math.PI / 180;
    return { true: Math.round(th * 180 / Math.PI), B: B, th: th };
  }
  /* duration */
  return { true: Math.round(600 + rng() * 2600) };
}

/* ---------------- stimulus drawing ---------------- */
function drawStimulus(glow){
  const cv = $('#stimCanvas');
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const rng = round.rng;

  if(round.stimulus === 'dots'){
    const n = round.trueValue, pts = [];
    const minD = Math.max(7, Math.sqrt(W * H / n) * 0.45);
    let tries = 0;
    while(pts.length < n && tries < n * 300){
      tries++;
      const x = 12 + rng() * (W - 24), y = 12 + rng() * (H - 24);
      if(pts.every(p => { const dx = p[0]-x, dy = p[1]-y; return dx*dx + dy*dy >= minD*minD; })) pts.push([x, y]);
    }
    for(let i = pts.length; i < n; i++) pts.push([12 + rng()*(W-24), 12 + rng()*(H-24)]);
    ctx.fillStyle = '#e8ecf8';
    pts.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 6.2832); ctx.fill(); });

  } else if(round.stimulus === 'line'){
    ctx.strokeStyle = '#9aa3c0'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(50, 100); ctx.lineTo(120, 100); ctx.stroke();
    ctx.fillStyle = '#9aa3c0'; ctx.font = '600 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('= 10', 85, 82);
    ctx.strokeStyle = '#5eead4'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(50, 215); ctx.lineTo(50 + round.stimData.L, 215); ctx.stroke();

  } else if(round.stimulus === 'area'){
    ctx.strokeStyle = '#9aa3c0'; ctx.lineWidth = 3;
    ctx.strokeRect(45, 55, 80, 80);
    ctx.fillStyle = '#9aa3c0'; ctx.font = '600 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('= 100', 85, 165);
    const pts = round.stimData.pts;
    const mid = (a,b) => [(a[0]+b[0])/2, (a[1]+b[1])/2];
    ctx.fillStyle = '#5eead4cc';
    ctx.beginPath();
    let m = mid(pts[pts.length - 1], pts[0]);
    ctx.moveTo(m[0], m[1]);
    for(let i = 0; i < pts.length; i++){
      const p = pts[i], nx = pts[(i + 1) % pts.length], mm = mid(p, nx);
      ctx.quadraticCurveTo(p[0], p[1], mm[0], mm[1]);
    }
    ctx.closePath(); ctx.fill();

  } else if(round.stimulus === 'angle'){
    const cx = 260, cy = 230, R = 190;
    const B = round.stimData.B, th = round.stimData.th;
    ctx.strokeStyle = '#e8ecf8'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    [B, B + th].forEach(a => {
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); ctx.stroke();
    });
    ctx.fillStyle = '#5eead4';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#5eead4'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 55, B, B + th); ctx.stroke();

  } else { /* duration */
    const cx = W / 2, cy = H / 2;
    ctx.strokeStyle = glow ? '#5eead4' : '#3a4568'; ctx.lineWidth = 8;
    if(glow){ ctx.shadowColor = '#5eead4'; ctx.shadowBlur = 42; ctx.fillStyle = '#5eead4'; }
    ctx.beginPath(); ctx.arc(cx, cy, 70, 0, 6.2832);
    if(glow) ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    if(!glow){
      ctx.fillStyle = '#9aa3c0'; ctx.font = '600 18px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('watch the circle', cx, cy + 125);
    }
  }
}
function runDurationStim(){
  setTimeout(() => {
    if(!round || round.type !== 'guess' || round.stimulus !== 'duration') return;
    drawStimulus(true);
    setTimeout(() => {
      if(!round || round.type !== 'guess' || round.stimulus !== 'duration') return;
      drawStimulus(false);
      setTimeout(() => {
        if(round && round.type === 'guess' && $('#phase-stim').classList.contains('active')){
          prepGuess();
          showPhase('phase-guess');
        }
      }, 500);
    }, round.trueValue);
  }, 900);
}

/* ---------------- guess input ---------------- */
function prepGuess(){
  const s = STIM_SPEC[round.stimulus];
  const g = $('#guessSlider');
  let mn = 5, mx = 100;
  if(round.stimulus === 'dots') mx = Math.round(50 + 55 * round.level);
  else { mn = s.slider[0]; mx = s.slider[1]; }
  g.min = mn; g.max = mx; g.step = s.step;
  g.value = Math.round((mn + mx) / 2 / s.step) * s.step;
  $('#guessValue').textContent = g.value + s.unit;
  $('#guessHeading').textContent = s.gheading;
  $('#guessRoundLabel').textContent = 'Round ' + (round.index + 1) + ' of ' + ROUNDS_PER_SESSION;
}

/* ---------------- market generation ---------------- */
function niceStep(T){ return T >= 900 ? 100 : T >= 120 ? 10 : T >= 25 ? 5 : 1; }

function genField(T, rng, level){
  const noise = Math.max(1.5, T * (0.10 + 0.055 * level));
  const all = ['anchor','over','under','herd','outlier'];
  const nb  = rng() < 0.5 ? 1 : 2;
  const active = [];
  while(active.length < nb){
    const b = all[(rng() * all.length) | 0];
    if(!active.includes(b)) active.push(b);
  }
  const cluster = T + gauss(rng) * noise * 0.6;
  const bots = [];
  for(let i = 0; i < 4; i++){
    let g = T + gauss(rng) * noise;
    active.forEach(b => {
      const r = rng();
      if(b === 'anchor'  && r < 0.6){ const step = niceStep(T); g = Math.round(g / step) * step; }
      if(b === 'over'    && r < 0.6){ g = T + Math.abs(g - T) * 1.15; }
      if(b === 'under'   && r < 0.6){ g = T - Math.abs(g - T) * 1.15; }
      if(b === 'herd'    && r < 0.6){ g = cluster + gauss(rng) * noise * 0.25; }
      if(b === 'outlier' && i === 3){ g = T + (rng() < 0.5 ? -1 : 1) * noise * (2 + rng() * 2); }
    });
    bots.push(Math.max(1, g));
  }
  /* occasional compression / stretch around the field median: creates
     favorite-longshot imbalance for value hunters */
  if(rng() < 0.35){
    const med = median(bots);
    const mode = rng() < 0.5 ? 0.7 : 1.3;
    const k = 1 + ((rng() * 3) | 0);
    for(let i = 0; i < k; i++){
      const j = (rng() * bots.length) | 0;
      bots[j] = med + (bots[j] - med) * mode;
    }
  }
  return bots;
}

/* pricing: extremity base + favorite/longshot mispricing + jitter */
function priceBoard(guesses, rng){
  const med    = median(guesses);
  const spread = Math.max(2, (Math.max.apply(null, guesses) - Math.min.apply(null, guesses)) / 2);
  let p = guesses.map(g => 1.2 + Math.min(Math.abs(g - med) / spread, 1.6) * 5.3);
  if(rng() < 0.3){
    const order = guesses.map((g,i) => [Math.abs(g - med), i]).sort((a,b) => a[0] - b[0]);
    if(rng() < 0.5) p[order[0][1]] *= 1.45;
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
  const bots = genField(round.trueValue, rng, round.level);
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
  const hints = hintsEnabled('guess');
  $('#boardHintExt').textContent = hints ? ' · market-implied chance ~%' : '';
  round.slots.forEach((s, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'slot' + (s.isPlayer ? ' player' : '');
    el.dataset.idx = i;
    el.innerHTML =
      '<span class="slot-label">' + s.label + '</span>' +
      '<span class="slot-guess">' + s.display + '</span>' +
      '<span class="slot-payout">' + s.payout.toFixed(1) + '×</span>' +
      (hints ? '<span class="slot-implied">~' + Math.round(s.implied * 100) + '% implied</span>' : '');
    el.addEventListener('click', () => {
      round.selected = i;
      $$('.slot').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
      updateLockUI();
    });
    wrap.appendChild(el);
  });
  renderChips($('#chips'), c => { round.chips = c; updateLockUI(); }, round.chips);
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
  round.stated      = CHIPS[round.chips - 1];
  round.selEV       = s.ev;
  round.selPositive = s.ev > 0;
  round.selBest     = round.selected === round.bestIdx;
  $('#lockSummary').innerHTML =
    'Slot: <b>' + s.label + ' (' + s.display + ')</b><br>' +
    'Payout: <b>' + s.payout.toFixed(1) + '×</b><br>' +
    'Market implies: <b>~' + Math.round(s.implied * 100) + '% chance</b><br>' +
    'Your confidence: <b>' + CHIP_LABELS[round.chips - 1] + ' (' + Math.round(round.stated * 100) + '%)</b>';
  showPhase('phase-lock');
}

function confirmBet(){
  /* decision quality is judged NOW, before the reveal */
  if(round.selPositive) processReward($('.slot[data-idx="' + round.selected + '"]'));
  else breakStreak();
  /* return to the board (glow needs the slot); swap actions for reveal */
  $('#lockBtn').classList.add('hidden');
  $('#chips').style.pointerEvents = 'none';
  $$('.slot').forEach(x => x.style.pointerEvents = 'none');
  $('#revealBtn').classList.remove('hidden');
  showPhase('phase-board');
}

/* ---------------- reveal & debrief ---------------- */
function doRevealGuess(){
  const s = round.slots[round.selected];
  const win = s.isWinner;
  const outcome = win ? 1 : 0;
  const brier = Math.pow(round.stated - outcome, 2);

  const rec = {
    round_type: 'guess', stimulus: round.stimulus,
    round: round.index, seed: round.seed, diff: settings.difficulty, level: +round.level.toFixed(2),
    trueValue: round.trueValue, playerGuess: round.playerGuess,
    selectedSlot: s.id, guessDisplay: s.display,
    chips: round.chips, stated: round.stated,
    payout: s.payout, implied: +s.implied.toFixed(4), pModel: +s.pModel.toFixed(4),
    selEV: +round.selEV.toFixed(4),
    bestEV: +round.slots[round.bestIdx].ev.toFixed(4),
    selPositive: round.selPositive, selBest: round.selBest,
    outcome: outcome, brier: +brier.toFixed(4),
    absErr: Math.abs(round.playerGuess - round.trueValue),
    relErr: +(Math.abs(round.playerGuess - round.trueValue) / round.trueValue).toFixed(4)
  };
  finishRound(rec);

  const cell = (round.selPositive ? '+EV' : '-EV') + '/' + (win ? 'win' : 'loss');
  const msgs = {
    '+EV/win' : 'Sharp decision and good result. You found value — this is the best cell.',
    '+EV/loss': 'Sharp decision, unlucky result. This bet was worth making. Your Sharp Streak continues.',
    '-EV/win' : "You won, but the odds weren't in your favor. That was luck more than good process.",
    '-EV/loss': "This bet wasn't +EV, and it lost. No punishment — bad luck and bad decisions are different. Focus on the decision next time."
  };
  const spec = STIM_SPEC[round.stimulus];
  showReveal({
    heading: 'The true ' + spec.noun + ': <span class="true-value">' + round.trueValue + spec.unit + '</span>',
    detail: round.slots.map((sl, i) =>
      '<div class="recap-slot' + (sl.isWinner ? ' winner' : '') + (i === round.selected ? ' chosen' : '') + '">' +
      sl.label + ' · ' + sl.display + ' · ' + sl.payout.toFixed(1) + '×</div>').join(''),
    debrief: msgs[cell],
    good: round.selPositive,
    win: win,
    muted: !round.selPositive
  });
}
