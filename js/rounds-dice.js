/* ==========================================================================
   School of Thought — dice rounds
   Bank or Push:  grow a pot across rolls that can bust it; every bank/push
                  call is scored against a computable one-step EV rule.
   Five Dice Roll: five dice + a scoring category + a clock; exact EV
                  enumeration over every keep/reroll subset.
   ========================================================================== */
'use strict';

/* ---------------- shared dice rendering ---------------- */
const PIP_POS = {
  1: [[50,50]],
  2: [[28,28],[72,72]],
  3: [[28,28],[50,50],[72,72]],
  4: [[28,28],[72,28],[28,72],[72,72]],
  5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
  6: [[28,28],[72,28],[28,50],[72,50],[28,72],[72,72]]
};
function pipsHTML(v){
  return PIP_POS[v].map(p => '<span class="pip" style="left:' + p[0] + '%;top:' + p[1] + '%"></span>').join('');
}
function dieHTML(v, extra){ return '<div class="die ' + (extra || '') + '">' + pipsHTML(v) + '</div>'; }

/* ==========================================================================
   BANK OR PUSH
   Two dice per roll. Rules by difficulty:
     any1   — bust if any die shows 1           (P = 11/36, avg safe gain 8)
     any1dbl— bust on any 1 OR any double       (P = 16/36, avg safe gain 8)
   One-step EV rule: pushing at pot P is +EV while P(bust)×P < P(safe)×gain,
   i.e. keep pushing below the threshold, bank at/above it.
     any1:    threshold 19      any1dbl: threshold 10
   ========================================================================== */
function bankParams(level){
  if(level < 1.2)
    return { rule: 'any1',    bustP: 11/36, threshold: 19, ruleText: 'any die showing a 1' };
  return { rule: 'any1dbl',   bustP: 16/36, threshold: 10, ruleText: 'any 1, or any double' };
}

/* bankStart() prepares state only — the briefing shows before any roll.
   bankBegin() reveals the board. No clock in this round type. */
function bankStart(){
  round.level = skillLevel('bank');
  round.p = bankParams(round.level);
  round.rng = mulberry32(round.seed);
  round.pot = 0; round.decisions = []; round.state = 'ready';
  round.lastRoll = null; round.busted = false; round.statusText = '';
}

function bankBegin(){
  $('#bankRoundLabel').textContent = 'Round ' + (round.index + 1) + ' of ' + ROUNDS_PER_SESSION;
  bankRender();
  showPhase('phase-bank');
}

/* ---------------- briefing ---------------- */
function bankIntro(){
  const p = round.p;
  const pct = Math.round(p.bustP * 100);
  return {
    title: 'Bank or Push',
    note: 'Bust rule this round: <b>a roll is a bust when it shows ' + p.ruleText + '</b> — that\u2019s about a <b>' + pct + '% chance on every single roll</b>',
    cta: 'Start — Roll the Dice',
    fine: 'No clock in this round — the dice wait for you.',
    steps: [
      ['Roll to grow the pot', 'Each roll adds both dice together to your pot. A safe roll of 5+3 adds 8, for example.'],
      ['A bust roll wipes the pot', 'The moment a roll breaks the bust rule above, the <b>entire pot drops to zero</b> and the round ends — there is no partial save.'],
      ['Bank or push, your call', 'After every safe roll you choose: <b>Bank</b> locks the pot in and ends the round, or <b>Push</b> rolls again for a bigger pot at bust risk.'],
      ['The math that scores you', 'Every call is scored against expected value: pushing risks the whole pot (about ' + pct + '%) to gain roughly +8 on average. Small pot \u2192 pushing is usually right; big pot \u2192 the risk outgrows the gain. Where exactly the line sits is yours to feel out.'],
      ['Rewards', 'A +EV call fires \u26a1 SHARP the instant you make it — before the next roll. Busting after sharp pushes never breaks your streak.']
    ]
  };
}

function bankRender(){
  $('#potVal').textContent = round.pot;
  const d = $('#bankDice');
  const faces = round.lastRoll || [3, 4];
  const cls = round.lastRoll ? (round.busted ? 'bust' : '') : 'dim';
  d.innerHTML = dieHTML(faces[0], cls) + dieHTML(faces[1], cls);
  const st = { ready: 'Roll to open the pot.', rolling: 'Rolling…', decide: 'Safe roll — bank it or push?' };
  $('#bankStatus').textContent = round.statusText || st[round.state] || '';
  $('#bankRollBtn').classList.toggle('hidden', round.state !== 'ready');
  $('#bankBankBtn').classList.toggle('hidden', round.state !== 'decide');
  $('#bankPushBtn').classList.toggle('hidden', round.state !== 'decide');
  if(round.state === 'decide'){
    $('#bankBankBtn').textContent = 'Bank ' + round.pot;
    $('#bankPushBtn').textContent = 'Push';
  }
  const hint = $('#bankHint');
  if(round.state !== 'done' && hintsEnabled('bank')){
    hint.classList.remove('hidden');
    hint.textContent = 'Bust odds each roll: ' + Math.round(round.p.bustP * 100) +
      '% (busts on ' + round.p.ruleText + ') · a safe roll averages about +8';
  } else hint.classList.add('hidden');
}

function bankRoll(){
  if(round.state !== 'ready' && round.state !== 'decide') return;
  round.state = 'rolling';
  bankRender();
  const dur = motionOK() ? 550 : 40;
  let spin = null;
  if(motionOK()){
    spin = setInterval(() => {
      $('#bankDice').innerHTML = dieHTML(1 + ((Math.random() * 6) | 0)) + dieHTML(1 + ((Math.random() * 6) | 0));
    }, 70);
  }
  setTimeout(() => {
    if(spin) clearInterval(spin);
    if(!round || round.type !== 'bank') return;
    const a = 1 + ((round.rng() * 6) | 0), b = 1 + ((round.rng() * 6) | 0);
    round.lastRoll = [a, b];
    const bust = (round.p.rule === 'any1') ? (a === 1 || b === 1) : (a === 1 || b === 1 || a === b);
    if(bust){
      round.busted = true; round.state = 'done';
      round.statusText = 'Rolled ' + a + '+' + b + ' — bust. The pot is gone.';
      bankRender();
      setTimeout(bankFinish, 1400);
    } else {
      round.pot += a + b;
      round.state = 'decide';
      round.statusText = 'Rolled ' + a + '+' + b + ' — pot +' + (a + b) + '.';
      bankRender();
    }
  }, dur);
}

function bankDecide(action){
  if(round.state !== 'decide') return;
  const correct = (action === 'push') ? (round.pot < round.p.threshold) : (round.pot >= round.p.threshold);
  round.decisions.push({ pot: round.pot, action: action, correct: correct });
  if(correct) processReward(action === 'push' ? $('#bankPushBtn') : $('#bankBankBtn'));
  else breakStreak();
  if(action === 'bank'){
    round.state = 'done';
    round.statusText = 'Banked ' + round.pot + '.';
    bankRender();
    setTimeout(bankFinish, 800);
  } else {
    round.statusText = 'Pushing…';
    bankRoll();
  }
}

function bankFinish(){
  const busted = !!round.busted;
  const total = round.decisions.length;
  const pos = round.decisions.filter(x => x.correct).length;
  const rec = {
    round_type: 'bank', round: round.index, seed: round.seed,
    diff: settings.difficulty, level: +round.level.toFixed(2),
    rule: round.p.rule, threshold: round.p.threshold,
    decisions: total, posDecisions: pos,
    busted: busted, banked: busted ? 0 : round.pot
  };
  finishRound(rec);

  const sharp = total > 0 && pos === total;
  const timeline = total
    ? round.decisions.map(x =>
        '<div class="tt ' + (x.correct ? 'good' : 'bad') + '">pot ' + x.pot + ' · ' +
        (x.action === 'push' ? 'pushed' : 'banked') + (x.correct ? ' · +EV' : ' · −EV') + '</div>').join('')
    : '<div class="tt">No calls to make — the dice decided this one.</div>';

  let deb;
  if(!total)          deb = busted ? 'Busted on the opening roll. Nothing to decide there — pure luck.'
                                    : 'Banked without a single push. The opening roll carried it.';
  else if(sharp && !busted) deb = 'Sharp calls and a clean bank. Process and luck lined up.';
  else if(sharp && busted)  deb = 'Sharp calls, unlucky bust. Every push you made was worth making — the streak knows it.';
  else if(!sharp && !busted) deb = 'Banked — but ' + (total - pos) + ' of ' + total + ' calls fought the math. The win was luck, not process.';
  else                deb = 'The bust stings, but the fix is in the calls, not the luck. Bank when the pot outgrows the odds.';

  showReveal({
    heading: busted ? 'Bust at ' + round.pot : 'Banked ' + round.pot,
    badges: sharp ? ['<span class="rv-badge">⚡ ' + pos + ' of ' + total + ' calls +EV</span>'] : [],
    detail: timeline,
    debrief: deb,
    good: sharp,
    win: !busted,
    muted: !sharp,
    accent: sharp ? 'sharp' : null
  });
}

/* ==========================================================================
   FIVE DICE ROLL (internal key: 'reroll')
   Five dice, a scoring category, and a clock. The player marks any subset
   to reroll (or keeps all), rates confidence, and locks in. Every subset's
   exact expected score is computable by enumeration; the call is "sharp"
   when its EV is within 0.5 pts of the best subset's EV.
   ========================================================================== */
const CAT_POOL = [];
(function(){
  const names = ['','Ones','Twos','Threes','Fours','Fives','Sixes'];
  for(let n = 1; n <= 6; n++) CAT_POOL.push({ type:'number', n:n, label:names[n], max:5*n });
  CAT_POOL.push({ type:'three',  label:'Three of a Kind', max:30 });
  CAT_POOL.push({ type:'four',   label:'Four of a Kind',  max:30 });
  CAT_POOL.push({ type:'full',   label:'Full House',      max:25 });
  CAT_POOL.push({ type:'ss',     label:'Run of Four',    max:30 });
  CAT_POOL.push({ type:'ls',     label:'Run of Five',    max:40 });
  CAT_POOL.push({ type:'chance', label:'Random',         max:30 });
})();

function longestRun(dice){
  const u = Array.from(new Set(dice)).sort((a,b)=>a-b);
  let best = 1, cur = 1;
  for(let i = 1; i < u.length; i++){
    if(u[i] === u[i-1] + 1){ cur++; if(cur > best) best = cur; }
    else cur = 1;
  }
  return best;
}
function scoreHand(dice, cat){
  const counts = [0,0,0,0,0,0];
  dice.forEach(d => counts[d-1]++);
  switch(cat.type){
    case 'number': return dice.filter(d => d === cat.n).reduce((a,b)=>a+b, 0);
    case 'three':  return Math.max.apply(null, counts) >= 3 ? sum(dice) : 0;
    case 'four':   return Math.max.apply(null, counts) >= 4 ? sum(dice) : 0;
    case 'full':   return (counts.indexOf(3) >= 0 && counts.indexOf(2) >= 0) ? 25 : 0;
    case 'ss':     return longestRun(dice) >= 4 ? 30 : 0;
    case 'ls':     return longestRun(dice) >= 5 ? 40 : 0;
    case 'chance': return sum(dice);
  }
  return 0;
}
/* exact expected score after rerolling the given die indices */
function rerollEV(hand, idxs, cat){
  const k = idxs.length;
  if(!k) return scoreHand(hand, cat);
  let total = 0;
  const n = Math.pow(6, k);
  for(let m = 0; m < n; m++){
    let v = m;
    const d = hand.slice();
    for(let j = 0; j < k; j++){ d[idxs[j]] = (v % 6) + 1; v = (v / 6) | 0; }
    total += scoreHand(d, cat);
  }
  return total / n;
}
/* best of all 32 keep/reroll subsets */
function bestReroll(hand, cat){
  let best = { ev: scoreHand(hand, cat), subset: [] };
  for(let mask = 1; mask < 32; mask++){
    const idxs = [];
    for(let i = 0; i < 5; i++) if(mask & (1 << i)) idxs.push(i);
    const ev = rerollEV(hand, idxs, cat);
    if(ev > best.ev + 1e-9) best = { ev: ev, subset: idxs };
  }
  return best;
}
/* generate a hand/category with a real decision in it:
   either clear upside to chase, or a made hand worth protecting.
   Random (a pure sum) is exempt from the made-hand case — a high Random
   hand has no reroll tension and a thin edge is a non-decision, so those
   hands must show a clear chase (upside >= 2.0) or they are skipped. */
function genRerollSituation(rng){
  let hand, cat, keep, best, loose = null;
  for(let t = 0; t < 100; t++){
    hand = [0,0,0,0,0].map(() => 1 + ((rng() * 6) | 0));
    cat  = CAT_POOL[(rng() * CAT_POOL.length) | 0];
    keep = scoreHand(hand, cat);
    best = bestReroll(hand, cat);
    const upside = best.ev - keep;
    const valueCase = upside >= 1.5 && best.ev <= cat.max * 0.96;
    if(!loose && valueCase) loose = { hand: hand, cat: cat, keep: keep, best: best };
    if(cat.type === 'chance'){
      if(upside >= 2.0 && best.ev <= cat.max * 0.96) return { hand: hand, cat: cat, keep: keep, best: best };
    } else {
      const madeHand = keep > 0 && keep >= cat.max * 0.8 && upside < 1.0;
      if(madeHand || valueCase) return { hand: hand, cat: cat, keep: keep, best: best };
    }
  }
  return loose || { hand: hand, cat: cat, keep: keep, best: best };
}

function catRuleText(cat){
  switch(cat.type){
    case 'number': return 'every die showing ' + cat.n + ' adds ' + cat.n + ' to your score (so three ' + cat.n + 's score ' + (3 * cat.n) + ')';
    case 'three':  return 'the sum of all five dice, but only if at least three faces match \u2014 otherwise 0';
    case 'four':   return 'the sum of all five dice, but only if at least four faces match \u2014 otherwise 0';
    case 'full':   return 'a flat 25 for a triple plus a pair \u2014 anything else scores 0';
    case 'ss':     return 'a flat 30 for a run of four consecutive faces (like 2-3-4-5) \u2014 otherwise 0';
    case 'ls':     return 'a flat 40 for a run of five consecutive faces (1-2-3-4-5 or 2-3-4-5-6) \u2014 otherwise 0';
    case 'chance': return 'always the sum of all five dice, whatever shows';
  }
  return '';
}

/* rerollStart() prepares state (including the situation) but starts no
   clock. rerollBegin() reveals the hand and starts the decision clock. */
function rerollStart(){
  round.level = skillLevel('reroll');
  round.timerMs = [30000, 22000, 12000][clamp(Math.round(round.level), 0, 2)];
  round.rng = mulberry32(round.seed);
  round.sit = genRerollSituation(round.rng);
  round.marked = new Set();
  round.chips = 0;
  round.locked = false;
  round.timeout = false;
}

function rerollBegin(){
  $('#rerollRoundLabel').textContent = 'Round ' + (round.index + 1) + ' of ' + ROUNDS_PER_SESSION;
  rerollRender();
  showPhase('phase-reroll');
  rerollStartTimer();
}

/* ---------------- briefing ---------------- */
function rerollIntro(){
  const cat = round.sit.cat;
  const secs = Math.round(round.timerMs / 1000);
  return {
    title: 'Five Dice Roll',
    note: 'Category this round: <b>' + cat.label + '</b> — ' + catRuleText(cat) + ' · max ' + cat.max + ' · decision clock: <b>' + secs + 's</b>',
    cta: 'Start — Deal the Dice',
    fine: 'The clock starts the moment you press Start. Run it out and you keep all five dice by default.',
    steps: [
      ['Read the hand', 'Five dice appear with the score they already earn under <b>' + cat.label + '</b> — that score is yours if you keep everything.'],
      ['Mark dice to reroll', 'Tap a die to mark it for a reroll (gold highlight); tap again to keep it. Keeping all five is a valid call, and rerolling all five is too.'],
      ['Lock In', 'The marked dice roll new random faces and the hand is rescored under the same category — that new score is yours.'],
      ['Beat the clock', 'You have <b>' + secs + ' seconds</b> to lock your call. If time runs out, the round is scored as \u201ckept all five\u201d.'],
      ['What \u201csharp\u201d means here', 'Every keep/reroll split has an exact expected score (each marked die has 6 equally likely faces). Land within 0.5 points of the best split and \u26a1 SHARP fires at lock-in. The confidence chips rate how likely your call is to beat the alternative you skipped.']
    ]
  };
}
function rerollStartTimer(){
  const bar = $('#rerollBar');
  bar.style.transition = 'none'; bar.style.width = '100%';
  void bar.offsetWidth;
  bar.style.transition = 'width ' + round.timerMs + 'ms linear';
  bar.style.width = '0%';
  round.timerId = setTimeout(rerollTimeout, round.timerMs);
}
function rerollRender(){
  const cat = round.sit.cat;
  $('#rerollCat').textContent = cat.label;
  $('#rerollCatMax').textContent = '(max ' + cat.max + ')';
  const d = $('#rerollDice'); d.innerHTML = '';
  round.sit.hand.forEach((v, i) => {
    const el = document.createElement('div');
    el.className = 'die' + (round.marked.has(i) ? ' marked' : '');
    el.innerHTML = pipsHTML(v);
    el.title = 'Toggle reroll';
    el.addEventListener('click', () => {
      if(round.locked) return;
      if(round.marked.has(i)) round.marked.delete(i); else round.marked.add(i);
      rerollRender();
    });
    d.appendChild(el);
  });
  $('#rerollScore').textContent = round.sit.keep;
  const hint = $('#rerollHint');
  if(!round.locked && hintsEnabled('reroll')){
    hint.classList.remove('hidden');
    const idxs = Array.from(round.marked);
    const ev = rerollEV(round.sit.hand, idxs, cat);
    const best = round.sit.best;
    const gap = best.ev - ev;
    const line1 = idxs.length
      ? 'Reroll ' + idxs.length + (idxs.length === 1 ? ' die' : ' dice') + ' → expected score <b>' + ev.toFixed(1) + '</b>'
      : 'Keep all five → <b>' + round.sit.keep + '</b> for sure';
    const bTxt = 'best play ' + best.ev.toFixed(1) +
      (best.subset.length ? ' (reroll ' + best.subset.length + (best.subset.length === 1 ? ' die' : ' dice') + ')' : ' (keep all)');
    let line2;
    if(gap <= 0.05)      line2 = '<span class="rh rh-best">⭐ this is the best play</span>';
    else if(gap <= 0.5)  line2 = '<span class="rh rh-pos">✓ sharp — within 0.5 of ' + bTxt + '</span>';
    else                 line2 = '<span class="rh rh-neg">▼ ' + gap.toFixed(1) + ' short of ' + bTxt + '</span>';
    hint.innerHTML = '<span class="rh-line">' + line1 + '</span><span class="rh-line">' + line2 + '</span>';
  } else hint.classList.add('hidden');
  renderChips($('#rerollChips'), c => { round.chips = c; rerollUpdateLock(); }, round.chips);
  rerollUpdateLock();
}
function rerollUpdateLock(){
  $('#rerollLockBtn').disabled = !(round.chips > 0);
}

function rerollLock(){
  if(round.locked || round.chips < 1) return;
  round.locked = true;
  clearTimeout(round.timerId);
  const bar = $('#rerollBar');
  bar.style.transition = 'none';
  bar.style.width = getComputedStyle(bar).width;

  const idxs = Array.from(round.marked);
  round.chosenIdxs = idxs;
  round.chosenEV = idxs.length ? rerollEV(round.sit.hand, idxs, round.sit.cat) : round.sit.keep;
  round.sharp = round.chosenEV >= round.sit.best.ev - 0.5;
  round.exactBest = round.chosenEV >= round.sit.best.ev - 0.05;
  round.stated = CHIPS[round.chips - 1];
  if(round.sharp) processReward($('#rerollLockBtn'), round.exactBest ? 2 : 1);
  else breakStreak();

  if(idxs.length){
    $('#rerollHint').classList.add('hidden');
    const diceEls = $$('#rerollDice .die');
    idxs.forEach(i => diceEls[i].classList.add('rolling'));
    setTimeout(() => {
      if(!round || round.type !== 'reroll') return;
      const hand = round.sit.hand.slice();
      idxs.forEach(i => hand[i] = 1 + ((round.rng() * 6) | 0));
      round.finalHand = hand;
      round.finalScore = scoreHand(hand, round.sit.cat);
      round.kept = false;
      round.altScore = round.sit.keep;         /* the alternative was keeping */
      round.outcome = round.finalScore > round.sit.keep ? 1 : 0;
      rerollFinish();
    }, motionOK() ? 650 : 30);
  } else {
    /* kept everything — shadow-roll the best alternative for the debrief */
    const hand = round.sit.hand.slice();
    round.sit.best.subset.forEach(i => hand[i] = 1 + ((round.rng() * 6) | 0));
    round.finalHand = round.sit.hand.slice();
    round.finalScore = round.sit.keep;
    round.kept = true;
    round.altScore = scoreHand(hand, round.sit.cat);
    round.outcome = round.finalScore >= round.altScore ? 1 : 0;
    rerollFinish();
  }
}

function rerollTimeout(){
  if(round.locked) return;
  round.locked = true; round.timeout = true;
  clearTimeout(round.timerId);
  round.chosenIdxs = [];
  round.chosenEV = round.sit.keep;
  round.sharp = round.chosenEV >= round.sit.best.ev - 0.5;
  round.exactBest = round.chosenEV >= round.sit.best.ev - 0.05;
  round.stated = null; round.chips = 0;
  if(round.sharp) processReward(null, round.exactBest ? 2 : 1);
  else breakStreak();
  const hand = round.sit.hand.slice();
  round.sit.best.subset.forEach(i => hand[i] = 1 + ((round.rng() * 6) | 0));
  round.finalHand = round.sit.hand.slice();
  round.finalScore = round.sit.keep;
  round.kept = true;
  round.altScore = scoreHand(hand, round.sit.cat);
  round.outcome = null;
  rerollFinish();
}

function rerollFinish(){
  const s = round.sit;
  const rec = {
    round_type: 'reroll', round: round.index, seed: round.seed,
    diff: settings.difficulty, level: +round.level.toFixed(2),
    category: s.cat.label, hand: s.hand.slice(),
    kept: round.kept, rerolled: round.chosenIdxs.length,
    chosen_ev: +round.chosenEV.toFixed(2), best_ev: +s.best.ev.toFixed(2),
    best_subset: s.best.subset.length, sharp: round.sharp, timeout: !!round.timeout,
    chips: round.chips || null, stated: round.stated,
    outcome: round.outcome,
    brier: (round.stated != null && round.outcome != null) ? +Math.pow(round.stated - round.outcome, 2).toFixed(4) : null,
    final_score: round.finalScore, alt_score: +round.altScore.toFixed(2)
  };
  finishRound(rec);

  const win = round.outcome === 1;
  const diceLine = '<div class="dice-row">' + round.finalHand.map(v => dieHTML(v)).join('') + '</div>';
  const altLine = round.kept
    ? 'The best reroll here would have scored <b>' + Math.round(round.altScore) + '</b>'
    : 'Keeping would have scored <b>' + round.altScore + '</b>';
  const evLine =
    'Your call: EV <b>' + round.chosenEV.toFixed(1) + '</b> · best play: <b>' + s.best.ev.toFixed(1) + '</b> (' +
    (s.best.subset.length ? 'reroll ' + s.best.subset.length + (s.best.subset.length === 1 ? ' die' : ' dice') : 'keep all') + ')';
  const badges = [];
  if(round.sharp) badges.push('<span class="rv-badge">⚡ sharp call</span>');
  if(round.sharp && round.exactBest) badges.push('<span class="rv-badge gold">⭐ best play</span>');
  const bars = evBarsHTML(round.exactBest
    ? [{ label: 'Your call — best play', value: +round.chosenEV.toFixed(2), cls: 'best' }]
    : [{ label: 'Your call', value: +round.chosenEV.toFixed(2), cls: 'you' },
       { label: 'Best play', value: +s.best.ev.toFixed(2), cls: 'best' }]);

  let deb;
  if(round.timeout)      deb = 'Time ran out, so you kept by default. ' +
    (round.sharp ? 'As it happens, keeping was the sharp call.' : 'There was value on the table — the clock is part of the game.');
  else if(round.sharp && win)  deb = 'Sharp call and it held up. You read the dice right.';
  else if(round.sharp && !win) deb = 'Sharp call, unlucky roll. The expected value was on your side — the dice just disagreed.';
  else if(!round.sharp && win) deb = 'It worked out, but the math was against this call. Enjoy the luck, don\u2019t trust it.';
  else                   deb = 'The odds were against this call and the dice agreed. Focus on the expected value, not the result.';

  showReveal({
    heading: round.kept ? 'Kept ' + round.finalScore + ' pts' : 'Rerolled to ' + round.finalScore + ' pts',
    badges: badges,
    detail: diceLine +
            '<div class="tb-line">' + altLine + '</div>' +
            '<div class="tb-line" style="margin-top:6px">' + evLine + '</div>' +
            bars,
    debrief: deb,
    good: round.sharp,
    win: win,
    muted: !round.sharp,
    accent: round.sharp ? (round.exactBest ? 'best' : 'sharp') : null
  });
}
