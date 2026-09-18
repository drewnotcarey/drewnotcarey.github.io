/* ==========================================================================
   School of Thought — Guess & Bet round
   Stimulus variants: dot count, line length, blob area, angle, timed glow.
   Market: a six-guess rival field (anchor / over / under / herd / outlier /
   compression biases) priced like a real book — calibrated win-probability
   odds with a margin and longshot shading, plus occasional huntable
   distortions. The EV model is a fusion posterior: the player's estimate
   weighted by their measured accuracy, blended with the field's consensus.
   ========================================================================== */
'use strict';

/* ---------------- round entry ---------------- */
/* guessStart() prepares state only — nothing shows, nothing is timed.
   guessBegin() reveals the stimulus and starts the view window.
   Races: the stimulus IS the field (latent strengths + noisy form), the
   paddock window is longer than a perceptual flash, and there is no
   numeric estimate to make — the read of the form is the estimate. */
function guessStart(){
  round.level = skillLevel('guess');
  round.rng   = mulberry32(round.seed);
  if(round.stimulus === 'race'){
    round.stimData  = genRaceField(round.rng, round.level);
    round.trueValue = null;
    round.view      = Math.round(5600 - 600 * round.level);   /* study the form */
  } else {
    round.stimData  = genStimulus(round.stimulus, round.rng, round.level);
    round.trueValue = round.stimData.true;
    round.view      = Math.round(3400 - 900 * round.level);
  }
}

function guessBegin(){
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
      if(round.stimulus === 'race') buildMarket();          /* no estimate phase — straight to the market */
      else { prepGuess(); showPhase('phase-guess'); }
    }
  }, round.view);
}

/* ---------------- briefing ---------------- */
function guessIntro(){
  if(round.stimulus === 'race') return raceIntro();
  const name = { dots:'Dot count', line:'Line length', area:'Blob area', angle:'Angle size', duration:'Glow duration' }[round.stimulus];
  const secs = (round.view / 1000).toFixed(1);
  const what = {
    dots:     'Count the dots scattered on the canvas — then they vanish.',
    line:     'Measure the bright line. The short gray bar above it is exactly <b>10 units</b> long — use it as your ruler.',
    area:     'Measure the blob. The gray square beside it has an area of exactly <b>100 units</b>.',
    angle:    'Read the size of the gap between the two rays, in <b>degrees</b>.',
    duration: 'A circle glows for a single timed interval — estimate how long it glowed, in <b>milliseconds</b> (1000 ms = one second). No progress bar on this one; your feel for time is the instrument.'
  }[round.stimulus];
  return {
    title: 'Guess & Bet',
    note: 'This round: <b>' + name + '</b>' + (round.stimulus === 'duration' ? '' : ' · on screen for about <b>' + secs + 's</b>') + ' · <b>payout \u00d7 your chance &gt; 1 = +EV</b>',
    cta: 'Start — Show It',
    fine: 'The viewing clock starts the moment you press Start.',
    steps: [
      ['Watch the flash', what],
      ['Play the market, not the answer', 'This is a <b>market game</b>. <b>Accuracy is secondary</b> \u2014 the only score that matters is whether you took the <b>highest-EV slot</b>. The point is not answering correctly or picking the slot that ends up closest; it is reading and playing the market: weighing each payout against the real chances and backing the value you find. A +EV bet that loses was still the right play; a \u2212EV bet that wins is luck, not process \u2014 it scores <b>neutral</b>: no streak growth, no penalty. Only a \u2212EV bet that loses breaks the streak.'],
      ['Lock your estimate', 'Move the slider to your best estimate and lock it in. Closest guess wins — you don\u2019t need to be exact, and an exact tie shares the win.'],
      ['Read the board', 'Your guess joins <b>six rival guesses</b>. Each slot pays its <b>payout</b> (e.g. 3.2\u00d7) if its guess turns out to be the <b>closest</b> to the true value. The board reads as a <b>number line</b>: the whole field is plotted across the top at true spacing, and the slots below sit sorted low to high with the gap between neighbors marked — a guess <b>boxed in</b> by tight gaps on both sides owns only the sliver of outcome-space between its rivals, which is why a central-looking slot can carry a huge payout. The book prices every slot to make a profit — most boards hide one or two mistakes in the odds. Your job is to find them.'],
      ['The one rule that decides every bet', '<b>If the payout \u00d7 your estimated chance &gt; 1, the bet is +EV — take it.</b> Below 1.0, the bet is \u2212EV — skip it. Locking a +EV bet fires \u26a1 SHARP instantly, win or lose.'],
      ['A worked example', 'A slot paying <b>3\u00d7</b> implies the market rates its win chance at about <b>33%</b> (1 \u00f7 3 \u2248 0.33). If your read is that the real chance is <b>higher than 33%</b> — say 40% — then 0.40 \u00d7 3 = <b>1.2 &gt; 1</b>: the slot is +EV and worth betting. If you think it\u2019s lower, the slot is overpriced and the edge belongs elsewhere.'],
      ['Watch the edge (while hints last)', 'With hints on, every slot shows <b>Your model ~42% \u00b7 Implied ~28% \u00b7 Edge +14%</b> — green for +EV, red for \u2212EV. <b>Implied</b> is what the book\u2019s payout says; <b>your model</b> is your own read of the chances. The biggest green edge is the best bet on the board. Hints fade as your calibration tightens, so build the habit while they\u2019re there.'],
      ['Earn the market\u2019s trust', 'Your model blends <b>your estimate</b> with the <b>field\u2019s consensus</b>, weighted by how accurate your estimates have actually been. It starts trusting the field more than you — new estimators haven\u2019t proven anything. Land close estimates round after round and your own slot starts showing green: that\u2019s the game telling you your read is now worth more than the crowd\u2019s.'],
      ['Rate your confidence', 'Pick 1\u20135 for how sure you are your slot wins. Honest ratings are scored: you\u2019re calibrated when your 70% calls come true about 70% of the time.']
    ]
  };
}

/* ---------------- minnow race briefing ---------------- */
function raceIntro(){
  return {
    title: 'Guess & Bet',
    note: 'This round: <b>Minnow Race</b> — 6 entries, one question: <b>which price is wrong?</b> · <b>payout × your chance &gt; 1 = +EV</b>',
    cta: 'Start — To the Paddock',
    fine: 'The form-reading clock starts the moment you press Start; prices drop after it.',
    steps: [
      ['Meet the field', 'Six minnows, each with a <b>form meter (0–12)</b> — a noisy reading of how fast it is. Better form, likelier winner; but the reading is noisy, and even the fastest fish loses plenty of races.'],
      ['Study before you price', 'You see the form <b>before the odds appear</b>. Read it first — form your own picture of each minnow’s chances before the market anchors you.'],
      ['This is a market game', '<b>Accuracy is secondary</b> — the only score that matters is whether you took the <b>highest-EV entry</b>. A +EV bet that loses was still the right play; a −EV bet that wins is luck, not process — it scores <b>neutral</b>: no streak growth, no penalty. Only a −EV bet that loses breaks the streak.'],
      ['Read the board', 'Each minnow pays its <b>payout</b> (e.g. 3.4×) if it wins. The book prices every entry to make a profit — the margin is the house’s, so on most boards <b>every price is bad</b>. Some boards carry exactly one mistake: a favorite priced too generously, or a longshot chopped. Hunt the mistake.'],
      ['The one rule that decides every bet', '<b>If the payout × your estimated chance &gt; 1, the bet is +EV — take it.</b> Below 1.0, the bet is −EV — take the least-bad and skip the fireworks. Locking a +EV bet fires ⚡ SHARP instantly, win or lose.'],
      ['A worked example', 'A minnow paying <b>4×</b> implies the market rates its win chance at about <b>25%</b> (1 ÷ 4). If your form read says it’s really more like <b>35%</b>, then 0.35 × 4 = <b>1.4 &gt; 1</b>: that price is wrong in your favor — that’s the bet.'],
      ['Watch the edge (while hints last)', 'With hints on, every card shows <b>Your model ~35% · Implied ~25% · Edge +10%</b> — green for +EV, red for −EV. Your model is your form read, steadied by your track record: prove your eye and it sharpens.'],
      ['Rate your confidence', 'Pick 1–5 for how sure you are your minnow wins. Honest ratings are scored: you’re calibrated when your 70% calls come true about 70% of the time.'],
      ['The lesson', '<b>Value on the board, not the fastest fish.</b> The best form is not the best bet — the best <b>price</b> is.']
    ]
  };
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
    const grid = STIM_SPEC.area.step;               /* same grid the player's slider snaps to */
    for(let t = 0; t < 60; t++){
      const pts = blobPts(rng, 35 + rng() * 70, 330, 175);
      const tv = Math.round(100 * shoelace(pts) / 6400 / grid) * grid;  /* reference square 80px = "100" */
      if(tv >= 20 && tv <= 600) return { true: tv, pts: pts };
    }
    const pts = blobPts(rng, 70, 330, 175);
    return { true: Math.round(100 * shoelace(pts) / 6400 / grid) * grid, pts: pts };
  }
  if(type === 'angle'){
    const B  = rng() * Math.PI * 2;
    const th = (15 + rng() * 150) * Math.PI / 180;
    return { true: Math.round(th * 180 / Math.PI), B: B, th: th };
  }
  /* duration: lands on the 25 ms grid the player's slider snaps to */
  return { true: Math.round((600 + rng() * 2600) / STIM_SPEC.duration.step) * STIM_SPEC.duration.step };
}

/* ---------------- stimulus drawing ---------------- */
/* a small minnow, facing right, in its identity color */
function drawRaceMinnow(ctx, x, y, col){
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = col;
  ctx.beginPath();                                    /* tail */
  ctx.moveTo(-24, 0); ctx.lineTo(-42, -13); ctx.lineTo(-42, 13);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();                                    /* body */
  ctx.ellipse(0, 0, 27, 14, 0, 0, 6.2832);
  ctx.fill();
  ctx.beginPath();                                    /* dorsal fin */
  ctx.moveTo(-9, -12); ctx.quadraticCurveTo(1, -23, 12, -11);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0B1220';                          /* eye */
  ctx.beginPath(); ctx.arc(14, -3, 3, 0, 6.2832); ctx.fill();
  ctx.restore();
}

function drawStimulus(glow){
  const cv = $('#stimCanvas');
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const rng = round.rng;

  if(round.stimulus === 'race'){
    /* the paddock: a 3×2 field of minnows with form only — prices come
       after the window closes, so the read forms before the anchor */
    for(let i = 0; i < RACE_N; i++){
      const col = i % 3, row = (i / 3) | 0;
      const cx = col * (W / 3) + W / 6, cy = row * (H / 2) + 66;
      drawRaceMinnow(ctx, cx, cy, RACE_COLORS[i].hex);
      ctx.fillStyle = '#e8ecf8'; ctx.font = '700 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(RACE_COLORS[i].name, cx, cy + 40);
      const segW = 9, gap = 3, x0 = cx - (12 * (segW + gap) - gap) / 2;
      for(let k = 0; k < 12; k++){
        ctx.fillStyle = k < round.stimData.bars[i] ? RACE_COLORS[i].hex : '#263450';
        ctx.beginPath();
        if(ctx.roundRect) ctx.roundRect(x0 + k * (segW + gap), cy + 50, segW, 13, 2);
        else              ctx.rect(x0 + k * (segW + gap), cy + 50, segW, 13);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#9aa3c0'; ctx.font = '600 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('form readings are noisy — prices drop next', W / 2, H - 12);

  } else if(round.stimulus === 'dots'){
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

const FIELD_SIZE = 6;   /* rival guesses joining the player's on the board */

function genField(T, rng, level, n, step){
  n = n || FIELD_SIZE;
  step = step || 1;
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
  for(let i = 0; i < n; i++){
    let g = T + gauss(rng) * noise;
    active.forEach(b => {
      const r = rng();
      if(b === 'anchor'  && r < 0.6){ const st = niceStep(T); g = Math.round(g / st) * st; }
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
  /* every rival bet lands on the same round-number grid the player's own
     slider is limited to — a guess is never quietly sub-integer under a
     rounded display */
  return bots.map(g => Math.round(Math.max(step, g) / step) * step);
}

/* ---------------- the book & the model ---------------- */
/* shared sampler: win-probability of each slot under an explicit posterior
   truth ~ Normal(anchor, sd); a slot wins when the drawn truth lands closest
   to its guess. Guesses that land on exactly the same value split that
   draw's credit evenly — with every bet on the round-number grid, exact
   ties are common, not a rounding curiosity, and array order must never
   be what decides them. */
function mcProbs(guesses, anchor, sd, rng, draws){
  const counts = guesses.map(() => 0);
  for(let s = 0; s < draws; s++){
    const v = anchor + gauss(rng) * sd;
    let bd = Infinity;
    const hit = [];
    for(let i = 0; i < guesses.length; i++){
      const d = Math.abs(guesses[i] - v);
      if(d < bd){ bd = d; hit.length = 0; }
      if(d === bd) hit.push(i);
    }
    hit.forEach(i => { counts[i] += 1 / hit.length; });
  }
  return counts.map(c => c / draws);
}

/* Measured estimating accuracy: rolling RMS of relative error across the
   player's Guess & Bet history (all stimuli, all sessions). Fewer than 3
   scored rounds → assume a decent newcomer. This is what the model uses to
   decide how much your estimate is worth against the field's. */
function playerSigma(){
  const rs = ledger.filter(r => (r.round_type || 'guess') === 'guess' && r.relErr != null).slice(-8);
  if(rs.length < 3) return 0.15;
  return clamp(Math.sqrt(mean(rs.map(r => r.relErr * r.relErr))), 0.04, 0.35);
}

/* The book: prices every slot off an exchangeable market posterior (all
   guesses weighed equally — the market doesn't know who is sharp), converts
   to odds with a margin and longshot shading, then occasionally misprices:
   35% of boards carry a favorite priced too generously or a chopped longshot.
   Those mistakes are the game — hunt them. */
function priceBoard(guesses, rng){
  const pMkt = mcProbs(guesses, median(guesses), Math.max(3, std(guesses) * 1.1), rng, 1000);
  let payouts = pMkt.map(p => clamp(0.87 * Math.pow(Math.max(p, 0.04), -0.83), 1.15, 15));
  if(rng() < 0.35){
    const med = median(guesses);
    const order = guesses.map((g,i) => [Math.abs(g - med), i]).sort((a,b) => a[0] - b[0]);
    if(rng() < 0.5) payouts[order[0][1]] *= 1.4;
    else            payouts[order[order.length - 1][1]] *= 0.6;
  }
  return payouts.map(x => clamp(x * (0.9 + rng() * 0.20), 1.15, 15));
}

/* Your model: a fusion posterior blending two independent reads of the
   truth — your estimate (weighted by your measured accuracy) and the rival
   field's consensus (weighted by its observed spread). Truth-blind: built
   only from information on the board at decision time. */
function modelProbs(guesses, rng){
  const bots   = guesses.slice(1);
  const botMed = median(bots);
  const scale  = Math.max(1, Math.abs(botMed));
  const su     = Math.max(playerSigma() * scale, scale * 0.04);   /* your read  */
  const sb     = Math.max(std(bots) * 0.6, scale * 0.045);        /* field read */
  const wYou = 1 / (su * su), wBot = 1 / (sb * sb);
  const mu = (guesses[0] * wYou + botMed * wBot) / (wYou + wBot);
  const sd = Math.sqrt(1 / (wYou + wBot));
  return mcProbs(guesses, mu, sd, rng, 1000);
}

function buildMarket(){
  if(round.stimulus === 'race'){ buildRaceMarket(); return; }
  const rng = round.rng;
  /* rivals bet on the player's guess grid — see genField */
  const bots = genField(round.trueValue, rng, round.level, FIELD_SIZE, STIM_SPEC[round.stimulus].step);
  const guesses = [round.playerGuess].concat(bots);
  const payouts = priceBoard(guesses, rng);
  const p = modelProbs(guesses, rng);
  round.sigYou = playerSigma();
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
  /* closest-to-truth wins; on a shared grid more than one slot can sit
     exactly as close as another, so every tied slot wins — array order
     must never decide it */
  let wd = Infinity;
  slots.forEach(s => { const d = Math.abs(s.guess - round.trueValue); if(d < wd) wd = d; });
  slots.forEach(s => { if(Math.abs(s.guess - round.trueValue) === wd) s.isWinner = true; });
  round.slots = slots;
  round.bestIdx = slots.reduce((bi, s, i, arr) => s.ev > arr[bi].ev ? i : bi, 0);
  round.selected = -1; round.chips = 0; round.locked = false;
  renderBoard();
  showPhase('phase-board');
}

/* ---------------- minnow race: market & board ---------------- */
/* The book drops after the paddock: payouts come off the TRUE
   probabilities (margin + longshot shading + the occasional deliberate
   mistake — see race-core.js), the model off the form meters the player
   just studied, steadied by their measured accuracy. The winner is drawn
   here, from the true probabilities, and held until the reveal. rng
   order (book → model → winner) is fixed and matches the tests. */
function buildRaceMarket(){
  const rng  = round.rng;
  const f    = round.stimData;
  const book = priceRaceBook(f.p, rng, round.level);
  round.sigYou = playerSigma();
  const q = raceModel(f.bars, round.sigYou, f.sigmaForm, round.level, rng);
  let u = rng(), cum = 0, winner = RACE_N - 1;
  for(let i = 0; i < RACE_N; i++){ cum += f.p[i]; if(u < cum){ winner = i; break; } }
  round.slots = f.p.map((p, i) => {
    const payout = book.payouts[i];
    return {
      id: 'minnow_' + i, label: RACE_COLORS[i].name, color: RACE_COLORS[i].hex,
      form: f.bars[i], guess: f.bars[i], display: 'form ' + f.bars[i] + '/12',
      payout: payout, pModel: q[i], implied: 1 / payout, ev: q[i] * payout - 1,
      isPlayer: false, isWinner: i === winner, pTrue: p
    };
  });
  round.raceBook = book;
  round.bestIdx = round.slots.reduce((bi, s, i, arr) => s.ev > arr[bi].ev ? i : bi, 0);
  round.selected = -1; round.chips = 0; round.locked = false;
  renderBoard();
  showPhase('phase-board');
}

/* 12-segment form meter; segments inherit the minnow's color from the
   slot's --mcolor custom property */
function formHTML(n){
  let h = '';
  for(let k = 0; k < 12; k++) h += '<i class="rf' + (k < n ? ' on' : '') + '"></i>';
  return h;
}

/* ---------------- board UI ---------------- */
/* per-slot edge indicator (hints only): model chance vs market-implied
   chance, colored green (+EV) or red (−EV) */
function edgeHTML(s){
  const m  = Math.round(s.pModel * 100);
  const im = Math.round(s.implied * 100);
  const e  = Math.round((s.pModel - s.implied) * 100);
  const pos = s.ev > 0;
  return '<span class="slot-implied">Your model ~' + m + '% · Implied ~' + im + '%</span>' +
         '<span class="slot-edge ' + (pos ? 'pos' : 'neg') + '">' +
         (pos ? '▲' : '▼') + ' Edge ' + (e > 0 ? '+' : '') + e + '% · ' +
         (pos ? '+EV' : '−EV') + '</span>';
}

/* ONE selection path for every affordance — the board buttons below and
   the pills on the number line. round.locked is set the moment a bet is
   confirmed; after that the selection IS the bet, and no stray tap (a
   late pill click, a resize rebuild of the line) may rewrite it. */
function selectSlot(i){
  if(!round || round.locked) return;
  round.selected = i;
  $$('.slot').forEach(x => x.classList.toggle('selected', +x.dataset.idx === i));
  $$('.nl-pill').forEach(p => p.classList.toggle('sel', +p.dataset.idx === i));
  $$('.nl-dot').forEach(d => d.classList.toggle('sel', +d.dataset.idx === i));
  $$('.nl-leader').forEach(l => l.classList.toggle('sel', +l.dataset.idx === i));
  updateLockUI();
}

/* board order: low → high by guess value, not generation order. Crowded
   neighbors visibly share a thin slice of outcome-space (see the gap
   markers between slots) — that's what actually drives a thin payout,
   and it was invisible when slots sat in arbitrary bot-number order.
   Sorting is presentational only: round.slots keeps its original
   indices, which is what selection, bestIdx, and the ledger key off. */
function renderBoard(){
  const wrap = $('#slots'); wrap.innerHTML = '';
  const hints = hintsEnabled('guess');
  if(round.stimulus === 'race'){
    /* no number line in a race — there is no spread to plot. The board is
       a race card: favorite (shortest odds) first, form carried over from
       the paddock so the price and the read sit together */
    $('#numline').innerHTML = '';
    $('#boardHintExt').textContent = (hints ? 'green edge = +EV · ' : '') +
      'payout × your chance > 1 = +EV · tap a card to bet';
    const order = round.slots.map((s, i) => i).sort((a, b) => round.slots[a].payout - round.slots[b].payout);
    order.forEach(i => {
      const s = round.slots[i];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'slot race';
      el.dataset.idx = i;
      el.style.setProperty('--mcolor', s.color);
      el.innerHTML =
        '<span class="slot-label"><i class="race-chip"></i>' + s.label + '</span>' +
        '<span class="slot-form">' + formHTML(s.form) + '</span>' +
        '<span class="slot-payout">' + s.payout.toFixed(1) + '×</span>' +
        (hints ? edgeHTML(s) : '');
      el.addEventListener('click', () => selectSlot(i));
      wrap.appendChild(el);
    });
    renderChips($('#chips'), c => { round.chips = c; updateLockUI(); }, round.chips);
    updateLockUI();
    return;
  }
  $('#boardHintExt').textContent = (hints ? 'green edge = +EV · ' : '') +
    'payout × your chance > 1 = +EV · tap a tag or a slot to select';
  const order = round.slots.map((s, i) => i).sort((a, b) => round.slots[a].guess - round.slots[b].guess);
  const vals  = round.slots.map(s => s.display);
  const range = Math.max(1, Math.max.apply(null, vals) - Math.min.apply(null, vals));
  renderNumline();
  order.forEach((i, pos) => {
    const s = round.slots[i];
    if(pos > 0){
      const prev  = round.slots[order[pos - 1]];
      const gap   = s.display - prev.display;
      const tight = gap <= Math.max(1, range * 0.12);
      const g = document.createElement('div');
      g.className = 'slot-gap' + (tight ? ' tight' : '');
      g.textContent = gap <= 0 ? 'tied' : gap + ' apart';
      wrap.appendChild(g);
    }
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'slot' + (s.isPlayer ? ' player' : '');
    el.dataset.idx = i;
    el.innerHTML =
      '<span class="slot-label">' + s.label + '</span>' +
      '<span class="slot-guess">' + s.display + '</span>' +
      '<span class="slot-payout">' + s.payout.toFixed(1) + '×</span>' +
      (hints ? edgeHTML(s) : '');
    el.addEventListener('click', () => selectSlot(i));
    wrap.appendChild(el);
  });
  renderChips($('#chips'), c => { round.chips = c; updateLockUI(); }, round.chips);
  updateLockUI();
}

/* market spread plot: every guess pinned at its true relative position
   along one axis, so the spread — and where the field crowds — reads in
   a single glance before a single button is read. Dots sit at the exact
   proportional spot; pill labels carry just identity + value, alternate
   above/below, and nudge sideways only as far as needed to stay legible
   when neighbors crowd (two-pass min-gap per side — dots never move).
   Every pill is tethered to its dot by a leader line that follows the
   pill's nudged position, so a shifted tag can never be mistaken for a
   neighbor's. Presentational like the sort: dots and pills carry
   data-idx purely so the selection can echo on the line; nothing keys
   off them. */
let nlLastW = 0;
const NL_PILL_OFF = 15;   /* px between the axis and a pill's near edge —
                             keep in step with the .nl-pill offsets in style.css */
function renderNumline(){
  const nl = $('#numline');
  nl.innerHTML = '';
  const order = round.slots.map((s, i) => i).sort((a, b) => round.slots[a].guess - round.slots[b].guess);
  buildNumline(nl, order);
  if(round.selected >= 0){
    nl.querySelectorAll('.nl-pill,.nl-dot').forEach(el => {
      el.classList.toggle('sel', +el.dataset.idx === round.selected);
    });
  }
}
/* pill spacing is sized to the viewport at build time; a rotation or
   resize can change the track width enough to re-crowd the labels, so
   re-plot when the board is out and the width moved a real step */
window.addEventListener('resize', () => {
  const nl = $('#numline');
  if(!round || round.type !== 'guess' || !round.slots || !nl || !nl.firstChild) return;
  if(Math.abs(window.innerWidth - nlLastW) < 60) return;
  renderNumline();
});
function buildNumline(host, order){
  const track = document.createElement('div');
  track.className = 'numline-track';
  const axis = document.createElement('div');
  axis.className = 'nl-axis';
  track.appendChild(axis);
  const gs = order.map(i => round.slots[i].guess);
  const lo = Math.min.apply(null, gs), hi = Math.max.apply(null, gs);
  const pct = g => hi > lo ? (g - lo) / (hi - lo) * 100 : 50;
  /* pill spacing in % of track: sized so a worst-case pill (~56px, e.g.
     "BOT 3" + a 4-digit duration) never overlaps on the narrowest track,
     but doesn't over-fan on wide ones */
  const trackPx = Math.max(220, Math.min(668, window.innerWidth - 80));
  const GAP = Math.min(19, Math.max(10, 56 / trackPx * 100));
  const EDGE = Math.max(4, GAP / 2);
  nlLastW = window.innerWidth;
  const c = gs.map(pct);                    /* ideal pill centers */
  ['above', 'below'].forEach(side => {      /* de-collide each side separately */
    const ps = [];
    for(let p = 0; p < order.length; p++) if((p % 2 === 0) === (side === 'above')) ps.push(p);
    let prev = EDGE - GAP;
    ps.forEach(p => { c[p] = Math.max(c[p], prev + GAP); prev = c[p]; });
    let cap = 100 - EDGE;
    for(let k = ps.length - 1; k >= 0; k--){ c[ps[k]] = Math.min(c[ps[k]], cap); cap = c[ps[k]] - GAP; }
  });
  /* grid-aligned guesses can land exactly equal — fan tied dots apart a
     few px so every bet keeps a visible dot of its own (pills de-collide
     on their own; the leader lines keep the pairing unambiguous) */
  const off = gs.map(() => 0);
  for(let p = 0, t0 = 0; p <= gs.length; p++){
    if(p < gs.length && gs[p] === gs[t0]) continue;
    const k = p - t0;
    for(let j = t0; j < p; j++) off[j] = (j - t0 - (k - 1) / 2) * 11;
    t0 = p;
  }
  order.forEach((i, p) => {
    const s = round.slots[i], above = p % 2 === 0;
    const dot = document.createElement('div');
    dot.className = 'nl-dot ' + (above ? 'above' : 'below') + (s.isPlayer ? ' player' : '');
    dot.dataset.idx = i;
    dot.style.left = 'calc(' + pct(s.guess) + '% + ' + off[p] + 'px)';
    track.appendChild(dot);
    const pill = document.createElement('div');
    pill.className = 'nl-pill ' + (above ? 'above' : 'below') + (s.isPlayer ? ' player' : '');
    pill.dataset.idx = i;
    pill.style.left = c[p] + '%';
    pill.innerHTML = '<span class="nl-id">' + s.label + '</span><b class="nl-val">' + s.display + '</b>';
    /* the pill is a tap target in its own right: clicking it selects that
       bet, exactly like the board button under it (keyboard users keep the
       real buttons; pills carry role=button for semantics without stealing
       tab stops). Locked rounds (rebuild-after-resize included) ignore it. */
    pill.title = 'Bet on ' + s.label + ' (' + s.display + ') · ' + s.payout.toFixed(1) + '×';
    pill.setAttribute('role', 'button');
    pill.addEventListener('click', () => selectSlot(i));
    if(round.locked) pill.style.pointerEvents = 'none';
    track.appendChild(pill);
  });
  host.appendChild(track);
  /* leader lines tether each pill to its own dot — a pill nudged sideways
     by the de-collision pass can otherwise read as a neighbor's. Drawn in
     px a frame later: the phase is still display:none at build time and
     would measure zero. Dot order and pill order are both monotone per
     side, so same-side leaders never cross; they render under dots and
     pills (z-index 1). */
  requestAnimationFrame(() => {
    if(!track.isConnected) return;               /* board rebuilt meanwhile */
    const W = track.clientWidth || trackPx;
    order.forEach((i, p) => {
      const dx  = (c[p] - pct(gs[p])) / 100 * W - off[p];   /* pill x − dot x */
      const len = Math.hypot(dx, NL_PILL_OFF);
      const deg = Math.atan2(dx, NL_PILL_OFF) * 180 / Math.PI;
      const ln = document.createElement('div');
      ln.className = 'nl-leader ' + (p % 2 === 0 ? 'above' : 'below');
      ln.dataset.idx = i;
      if(round.selected === i) ln.classList.add('sel');
      ln.style.left = 'calc(' + pct(gs[p]) + '% + ' + off[p] + 'px)';
      ln.style.height = len + 'px';
      ln.style.transform = 'rotate(' + (p % 2 === 0 ? 180 + deg : -deg) + 'deg)';
      track.appendChild(ln);
    });
  });
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
  round.locked = true;                     /* the selection is now the bet */
  /* +EV decision quality is judged NOW, before the reveal — and the
     best-value pick on the board earns the gold tier. A \u2212EV bet is
     NOT judged here: its bill arrives at the reveal, and a bet that lands
     despite the odds is neutral — no reward, no streak break. */
  if(round.selPositive) processReward($('.slot[data-idx="' + round.selected + '"]'), round.selBest ? 2 : 1);
  /* return to the board (glow needs the slot); swap actions for reveal */
  $('#lockBtn').classList.add('hidden');
  $('#chips').style.pointerEvents = 'none';
  $$('.slot').forEach(x => x.style.pointerEvents = 'none');
  $$('.nl-pill').forEach(p => p.style.pointerEvents = 'none');
  $('#revealBtn').classList.remove('hidden');
  showPhase('phase-board');
}

/* reveal number line — the market's spread with the truth pinned on it.
   Same frame as the board's line (raw guess positions, proportional
   spacing), with the domain extended to include the true value when the
   whole field missed it — so the pin never lies about being "at the edge".
   Gray dots are the field, teal is the best-value slot, the white ring is
   your pick, and the gold pin is where reality actually landed.
   Presentational only (aria-hidden — the truth is stated in words right
   above, and the recap list carries the winner/best/chosen detail). */
function revealNumlineHTML(){
  const spec = STIM_SPEC[round.stimulus];
  const gs = round.slots.map(s => s.guess);
  const lo = Math.min.apply(null, gs.concat([round.trueValue]));
  const hi = Math.max.apply(null, gs.concat([round.trueValue]));
  const pct = g => hi > lo ? (g - lo) / (hi - lo) * 100 : 50;
  const dots = round.slots.map((s, i) =>
    '<span class="rv-nl-dot' + (i === round.bestIdx ? ' best' : '') + (i === round.selected ? ' you' : '') +
    '" style="left:' + pct(s.guess) + '%"></span>').join('');
  const pl = pct(round.trueValue);
  const near = pl < 10 ? ' near-l' : pl > 90 ? ' near-r' : '';
  return '<div class="rv-numline" aria-hidden="true" title="Where the true value landed against the market">' +
    '<div class="rv-nl-track">' + dots +
      '<span class="rv-nl-pin' + near + '" style="left:' + pl + '%">' +
        '<span class="rv-nl-pin-stem"></span>' +
        '<span class="rv-nl-pin-gem"></span>' +
        '<span class="rv-nl-pin-tag">true ' + round.trueValue + spec.unit + '</span>' +
      '</span>' +
    '</div>' +
    '<div class="rv-nl-legend"><span><i class="lg-field"></i>field</span>' +
      '<span><i class="lg-best"></i>best value</span>' +
      '<span><i class="lg-you"></i>your pick</span>' +
      '<span><i class="lg-true"></i>truth</span></div>' +
  '</div>';
}

/* ---------------- reveal & debrief ---------------- */
function doRevealGuess(){
  /* the reveal button is hidden until a bet is confirmed; a programmatic
     click on the hidden button (or any stray invocation before the
     selection exists) must not crash the round */
  if(!round || !round.slots || round.selected < 0) return;
  if(round.stimulus === 'race'){ doRevealRace(); return; }
  const s = round.slots[round.selected];
  const win = s.isWinner;
  const outcome = win ? 1 : 0;
  const brier = Math.pow(round.stated - outcome, 2);
  const best  = round.slots[round.bestIdx];
  const fmtEV = v => (v >= 0 ? '+' : '') + v.toFixed(2);

  const rec = {
    round_type: 'guess', stimulus: round.stimulus,
    round: round.index, seed: round.seed, diff: settings.difficulty, level: +round.level.toFixed(2),
    trueValue: round.trueValue, playerGuess: round.playerGuess,
    selectedSlot: s.id, guessDisplay: s.display,
    chips: round.chips, stated: round.stated,
    payout: s.payout, implied: +s.implied.toFixed(4), pModel: +s.pModel.toFixed(4),
    sigYou: +round.sigYou.toFixed(4),
    selEV: +round.selEV.toFixed(4),
    bestEV: +round.slots[round.bestIdx].ev.toFixed(4),
    selPositive: round.selPositive, selBest: round.selBest,
    neutral: !round.selPositive && outcome === 1,
    outcome: outcome, brier: +brier.toFixed(4),
    absErr: Math.abs(round.playerGuess - round.trueValue),
    relErr: +(Math.abs(round.playerGuess - round.trueValue) / round.trueValue).toFixed(4)
  };
  finishRound(rec);

  /* outcome-contingent penalty: only a \u2212EV bet that actually loses
     breaks the streak — a lucky \u2212EV win is neutral (nothing added,
     nothing taken) */
  const neutral = !round.selPositive && win;
  if(!round.selPositive && !win) breakStreak();

  const cell = (round.selPositive ? '+EV' : '-EV') + '/' + (win ? 'win' : 'loss');
  const m  = Math.round(s.pModel * 100), im = Math.round(s.implied * 100);
  const msgs = {
    '+EV/win' : 'You priced this slot at ~' + m + '% against the market\u2019s ~' + im + '% — the edge was real and it landed. This is the best cell.',
    '+EV/loss': 'You priced this slot at ~' + m + '% against the market\u2019s ~' + im + '%. That edge pays over the long run, not on every roll — your Sharp Streak knows the difference.',
    '-EV/win' : 'It landed, but the odds were against it — luck, not process. Neutral: no reward, no penalty, and the streak holds. Don\u2019t let a bailed-out mistake read like skill.',
    '-EV/loss': 'This bet wasn\u2019t +EV, and it lost — that combination is the one thing that breaks the streak. Sharp calls survive bad luck; \u2212EV calls don\u2019t survive their own odds.'
  };
  /* post-lock edge feedback: reinforce hunting the BEST value, not just any +EV */
  let edgeNote;
  if(round.selBest){
    edgeNote = round.selPositive
      ? '⭐ Best-value pick — this was the highest-EV slot on the board.'
      : 'No slot was +EV this round — you still picked the best of a bad board.';
  } else if(round.selPositive){
    edgeNote = '+EV call, but a better-value slot existed: <b>' + best.label + ' (' + best.display + ')</b> at ' +
               best.payout.toFixed(1) + '× carried EV ' + fmtEV(best.ev) + '.';
  } else {
    edgeNote = 'The best value was <b>' + best.label + ' (' + best.display + ')</b> at ' +
               best.payout.toFixed(1) + '× (EV ' + fmtEV(best.ev) + ').';
  }
  const spec = STIM_SPEC[round.stimulus];
  const badges = [];
  if(round.selPositive) badges.push('<span class="rv-badge">⚡ +EV call</span>');
  if(round.selPositive && round.selBest) badges.push('<span class="rv-badge gold">⭐ best value on board</span>');
  if(neutral) badges.push('<span class="rv-badge neutral">neutral · no streak change</span>');
  const bars = evBarsHTML(round.selBest
    ? [{ label: 'Your call — best on board', value: +round.selEV.toFixed(2), cls: 'best' }]
    : [{ label: 'Your call',  value: +round.selEV.toFixed(2), cls: 'you' },
       { label: 'Best on board', value: +best.ev.toFixed(2), cls: 'best' }]);
  /* recap keeps the board's number-line frame: sorted low → high, same
     as renderBoard, so where the true value landed reads at a glance.
     Order of attention is deliberate: the best-EV slot leads (that is
     what the round scores), the true value follows, then the field */
  const rOrder = round.slots.map((sl, i) => i).sort((a, b) => round.slots[a].guess - round.slots[b].guess);
  const bestSlot = round.slots[round.bestIdx];
  showReveal({
    heading: 'Best value on the board: <span class="best-slot">' + bestSlot.label + ' (' + bestSlot.display + ')</span>',
    badges: badges,
    detail: '<div class="rv-truth">the true ' + spec.noun + ': <span class="true-value">' + round.trueValue + spec.unit + '</span></div>' +
      revealNumlineHTML() +
      rOrder.map(i => {
        const sl = round.slots[i];
        return '<div class="recap-slot' + (sl.isWinner ? ' winner' : '') + (i === round.selected ? ' chosen' : '') + (i === round.bestIdx ? ' best' : '') + '">' +
          (i === round.bestIdx ? '⭐ ' : '') + sl.label + ' · ' + sl.display + ' · ' + sl.payout.toFixed(1) + '×</div>';
      }).join('') +
      bars +
      '<div class="edge-note' + (round.selBest ? ' best' : '') + '">' + edgeNote + '</div>',
    debrief: msgs[cell],
    good: round.selPositive,
    win: win,
    muted: !round.selPositive,
    accent: round.selPositive ? (round.selBest ? 'best' : 'sharp') : null,
    streakNote: neutral ? 'Neutral: a lucky \u2212EV win — the streak neither grows nor breaks.' : undefined
  });
  /* the truth pin drops onto the spread — motion-gated like every
     flourish; reduced-motion and ✨-off players get the static pin */
  const pin = $('#phase-reveal .rv-nl-pin');
  if(pin && pin.animate && motionOK()){
    pin.animate(
      [{ opacity: 0, transform: 'translateY(-16px)' },
       { opacity: 1, transform: 'translateY(0)' }],
      { duration: 480, easing: 'cubic-bezier(.2,.7,.3,1.25)' });
  }
}

/* ---------------- minnow race: reveal ---------------- */
/* market-implied vs true chance, one strip. Diamonds sit at each
   price's implied chance, dots at the true chance; the horizontal gap
   between a minnow's own two marks is its mispricing — the whole game
   in one picture. Presentational only (aria-hidden): the recap rows
   carry the numbers in words. */
function raceGapHTML(){
  const MX = 0.52;                        /* axis runs 0..52% */
  const pos = v => clamp(v / MX * 100, 1.2, 98.8);
  let grids = '';
  for(let g = 0; g <= 50; g += 10) grids += '<span class="rg" style="left:' + (g / MX).toFixed(2) + '%"></span>';
  const dias = round.slots.map((s, i) =>
    '<span class="race-dia ' + (i % 2 ? 'dn' : 'up') + '" style="left:' + pos(s.implied).toFixed(2) + '%;border-color:' + s.color + '"></span>').join('');
  const dots = round.slots.map((s, i) =>
    '<span class="race-dot ' + (i % 2 ? 'dn' : 'up') + (i === round.selected ? ' you' : '') + (s.isWinner ? ' winner' : '') +
    '" style="left:' + pos(s.pTrue).toFixed(2) + '%;background:' + s.color + '"></span>').join('');
  return '<div class="rv-race" aria-hidden="true" title="Market-implied chance vs true chance — the gap is the mispricing">' +
    '<div class="rv-race-body">' + grids +
      '<div class="rv-race-lane"><span class="lane-base"></span>' + dias + '</div>' +
      '<div class="rv-race-lane"><span class="lane-base"></span>' + dots + '</div>' +
    '</div>' +
    '<div class="rv-race-ticks"><span style="left:0%">0%</span><span style="left:' + (25 / MX).toFixed(2) + '%">25%</span><span style="left:' + (50 / MX).toFixed(2) + '%">50%</span></div>' +
    '<div class="rv-race-legend"><span><i class="lg-dia"></i>market’s implied</span>' +
      '<span><i class="lg-rdot"></i>true chance</span>' +
      '<span><i class="lg-win"></i>winner</span>' +
      '<span>gap = the mispricing</span></div>' +
  '</div>';
}

/* race reveal: the market frame leads (best value first, as every Guess
   & Bet reveal does), then the winner in color with its true chance, the
   price-vs-truth strip, the race card recap, and the EV comparison.
   Same reward grammar as the rival market: +EV fires SHARP at lock,
   a lucky −EV win is neutral, only −EV that loses breaks the streak. */
function doRevealRace(){
  const s = round.slots[round.selected];
  const win = s.isWinner;
  const outcome = win ? 1 : 0;
  const brier = Math.pow(round.stated - outcome, 2);
  const best = round.slots[round.bestIdx];
  const wIdx = round.slots.findIndex(x => x.isWinner);
  const wSlot = round.slots[wIdx];
  const fmtEV = v => (v >= 0 ? '+' : '') + v.toFixed(2);

  const rec = {
    round_type: 'guess', stimulus: 'race',
    round: round.index, seed: round.seed, diff: settings.difficulty, level: +round.level.toFixed(2),
    trueValue: null, playerGuess: null,
    selectedSlot: s.id, guessDisplay: s.display,
    chips: round.chips, stated: round.stated,
    payout: s.payout, implied: +s.implied.toFixed(4), pModel: +s.pModel.toFixed(4),
    sigYou: +round.sigYou.toFixed(4),
    selEV: +round.selEV.toFixed(4),
    bestEV: +round.slots[round.bestIdx].ev.toFixed(4),
    selPositive: round.selPositive, selBest: round.selBest,
    neutral: !round.selPositive && outcome === 1,
    outcome: outcome, brier: +brier.toFixed(4),
    absErr: null, relErr: null,          /* no quantity to measure — excluded from playerSigma by design */
    race: {
      mispriced: round.raceBook.misIdx >= 0, dir: round.raceBook.misDir, misIdx: round.raceBook.misIdx,
      winner: wIdx,
      trueP: round.slots.map(x => +x.pTrue.toFixed(4)),
      q: round.slots.map(x => +x.pModel.toFixed(4)),
      bars: round.slots.map(x => x.form),
      payouts: round.slots.map(x => x.payout)
    }
  };
  finishRound(rec);

  const neutral = !round.selPositive && win;
  if(!round.selPositive && !win) breakStreak();

  const cell = (round.selPositive ? '+EV' : '-EV') + '/' + (win ? 'win' : 'loss');
  const m  = Math.round(s.pModel * 100), im = Math.round(s.implied * 100);
  const msgs = {
    '+EV/win' : 'You priced ' + s.label + ' at ~' + m + '% against the market’s ~' + im + '% — the edge was real and it swam home. This is the best cell.',
    '+EV/loss': 'You priced ' + s.label + ' at ~' + m + '% against the market’s ~' + im + '%. That edge pays over the long run, not on every race — your Sharp Streak knows the difference.',
    '-EV/win' : 'It swam home, but the odds were against it — luck, not process. Neutral: no reward, no penalty, and the streak holds. Don’t let a bailed-out mistake read like skill.',
    '-EV/loss': 'This bet wasn’t +EV, and it lost — that combination is the one thing that breaks the streak. Sharp calls survive bad luck; −EV calls don’t survive their own odds.'
  };
  let edgeNote;
  if(round.selBest){
    edgeNote = round.selPositive
      ? '⭐ Best-value pick — this was the highest-EV entry on the board.'
      : 'No entry was +EV this round — you still picked the best of a bad board.';
  } else if(round.selPositive){
    edgeNote = '+EV call, but a better-value entry existed: <b>' + best.label + ' (' + best.display + ')</b> at ' +
               best.payout.toFixed(1) + '× carried EV ' + fmtEV(best.ev) + '.';
  } else {
    edgeNote = 'The best value was <b>' + best.label + ' (' + best.display + ')</b> at ' +
               best.payout.toFixed(1) + '× (EV ' + fmtEV(best.ev) + ').';
  }
  /* the flavor lesson: backed the fastest fish at the wrong price */
  const topForm = round.slots.reduce((bi, sl, i, arr) => sl.form > arr[bi].form ? i : bi, 0);
  if(round.selected === topForm && !round.selBest)
    edgeNote += ' <b>The fastest fish isn’t the bet — the price is.</b>';

  const badges = [];
  if(round.selPositive) badges.push('<span class="rv-badge">⚡ +EV call</span>');
  if(round.selPositive && round.selBest) badges.push('<span class="rv-badge gold">⭐ best value on board</span>');
  if(neutral) badges.push('<span class="rv-badge neutral">neutral · no streak change</span>');
  const bars = evBarsHTML(round.selBest
    ? [{ label: 'Your call — best on board', value: +round.selEV.toFixed(2), cls: 'best' }]
    : [{ label: 'Your call',  value: +round.selEV.toFixed(2), cls: 'you' },
       { label: 'Best on board', value: +best.ev.toFixed(2), cls: 'best' }]);
  /* race card order: favorite (shortest odds) first */
  const rOrder = round.slots.map((sl, i) => i).sort((a, b) => round.slots[a].payout - round.slots[b].payout);
  const bestSlot = round.slots[round.bestIdx];
  showReveal({
    heading: 'Best value on the board: <span class="best-slot">' + bestSlot.label + ' (' + bestSlot.display + ')</span>',
    badges: badges,
    detail: '<div class="rv-truth">the winner: <span class="true-value"><i class="race-chip" style="background:' + wSlot.color + '"></i>' + wSlot.label +
              '</span> · true win chance ' + Math.round(wSlot.pTrue * 100) + '%</div>' +
      raceGapHTML() +
      rOrder.map(i => {
        const sl = round.slots[i];
        return '<div class="recap-slot' + (sl.isWinner ? ' winner' : '') + (i === round.selected ? ' chosen' : '') + (i === round.bestIdx ? ' best' : '') + '">' +
          (i === round.bestIdx ? '⭐ ' : '') + '<i class="race-chip" style="background:' + sl.color + '"></i>' + sl.label +
          ' · ' + sl.display + ' · ' + sl.payout.toFixed(1) + '× · true ' + Math.round(sl.pTrue * 100) + '%</div>';
      }).join('') +
      bars +
      '<div class="edge-note' + (round.selBest ? ' best' : '') + '">' + edgeNote + '</div>',
    debrief: msgs[cell],
    good: round.selPositive,
    win: win,
    muted: !round.selPositive,
    accent: round.selPositive ? (round.selBest ? 'best' : 'sharp') : null,
    streakNote: neutral ? 'Neutral: a lucky −EV win — the streak neither grows nor breaks.' : undefined
  });
}
