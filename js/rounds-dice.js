/* ==========================================================================
   School of Thought — dice rounds
   Keep or Roll:  grow a pot across rolls that can bust it; every keep/roll
                  call is scored against the true multi-roll win probability.
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
   KEEP OR ROLL — vs the Tide
   Two dice per roll. Rules by difficulty:
     any1   — bust if any die shows a 1           (P = 11/36, avg safe gain 8)
     any1dbl— bust on any 1 OR any double         (P = 16/36, avg safe gain 8)
   The Tide — a fixed, visible opponent — rolls its own pot under the same
   bust rule and one unchanging policy: roll below 15, keep at 15 or above.
   Goal: finish with a higher kept pot than the Tide; ties go to the Tide.
   Every keep/roll call is scored against the true multi-roll win
   probability of beating the Tide — both pots, both bust risks, the
   Tide's known policy, and the freedom to keep rolling all priced in,
   with the roll value assuming sharp follow-through after a safe roll.
   ========================================================================== */
const TIDE_T = 15;

function bankParams(level){
  if(level < 1.2)
    return { rule: 'any1',    bustP: 11/36, ruleText: 'any die showing a 1' };
  return { rule: 'any1dbl',   bustP: 16/36, ruleText: 'any 1, or any double' };
}

function rollBusts(a, b, rule){
  return rule === 'any1' ? (a === 1 || b === 1) : (a === 1 || b === 1 || a === b);
}
/* safe-roll sums conditional on survival, per bust rule */
function safeSums(rule){
  const counts = {};
  let n = 0;
  for(let a = 1; a <= 6; a++) for(let b = 1; b <= 6; b++){
    if(!rollBusts(a, b, rule)){ counts[a + b] = (counts[a + b] || 0) + 1; n++; }
  }
  return Object.keys(counts).map(s => ({ s: +s, p: counts[s] / n }));
}
/* final-pot distribution of a live Tide at pot D under its fixed policy —
   roll while below TIDE_T, keep at/above: { bust: p, banked: { v: p } }.
   Memoized; pots only grow, so the recursion always terminates */
function tideDist(D, p, safe, memo){
  if(D >= TIDE_T){ const m = {}; m[D] = 1; return { bust: 0, banked: m }; }
  if(memo[D]) return memo[D];
  const res = { bust: p.bustP, banked: {} };
  const S = 1 - p.bustP;
  safe.forEach(e => {
    const nxt = tideDist(D + e.s, p, safe, memo);
    const w = e.p * S;
    res.bust += w * nxt.bust;
    for(const v in nxt.banked) res.banked[v] = (res.banked[v] || 0) + w * nxt.banked[v];
  });
  memo[D] = res;
  return res;
}
/* P(a kept pot of P beats the Tide from this state) — ties go to the Tide */
function vBank(P, tide, p, safe, memo){
  if(tide.status === 'bust')   return 1;
  if(tide.status === 'banked') return P > tide.pot ? 1 : 0;
  const d = tideDist(tide.pot, p, safe, memo);
  let w = d.bust;
  for(const v in d.banked) if(+v < P) w += d.banked[v];
  return w;
}

/* Multi-roll game value — the full upgrade over one-step EV. V(tide, P)
   is the exact win probability of playing the rest of the round out
   optimally:  V = max( keep now, roll and play on sharp ).  The roll leg
   prices BOTH things a roll buys — the pot growth itself and the right to
   decide again after watching the Tide's concurrent policy step. Backward
   induction over the pot lattice closes because pots only grow and nothing
   the Tide can keep exceeds 26 (14 + one safe 12): V = 1 for any pot >= 27,
   and each V(tide, P) only ever reads pots strictly above P. Cached per
   bust rule — the table depends on nothing else. */
const VG_HI = 26;
const VG_CACHE = {};
function gameValue(p, safe){
  if(VG_CACHE[p.rule]) return VG_CACHE[p.rule];
  const S = 1 - p.bustP, T = TIDE_T, HI = VG_HI + 12;
  const key = t => t.status === 'bust' ? 'x' : t.status[0] + t.pot;
  const states = [{ status: 'bust', pot: 0 }];
  for(let D = T; D <= 26; D++) states.push({ status: 'banked', pot: D });
  for(let D = 0; D < T; D++)  states.push({ status: 'live', pot: D });
  const V = {};
  states.forEach(st => { V[key(st)] = new Array(HI + 1).fill(1); });  /* P >= 27: sure win */
  const memo = {};
  for(let P = VG_HI; P >= 1; P--){
    states.forEach(st => {
      const k = key(st);
      let roll = 0;
      safe.forEach(e => {
        let inner;
        if(st.status !== 'live' || st.pot >= T) inner = V[k][P + e.s];
        else {
          inner = p.bustP;                    /* the Tide busts alongside: you win */
          safe.forEach(t => {
            const D2 = st.pot + t.s, k2 = D2 >= T ? 'b' + D2 : 'l' + D2;
            inner += S * t.p * V[k2][P + e.s];
          });
        }
        roll += e.p * inner;
      });
      V[k][P] = Math.max(vBank(P, st, p, safe, memo), S * roll);
    });
  }
  return (VG_CACHE[p.rule] = { V, key });
}
/* value of rolling now (the roll leg alone, without the max): survive your
   roll, the Tide takes its concurrent policy step if live, then the rest
   of the round is played out sharp from there */
function vRoll(P, tide, p, safe, V){
  const t = (tide.status === 'live' && tide.pot >= TIDE_T)
    ? { status: 'banked', pot: tide.pot } : tide;      /* belt-and-braces */
  const S = 1 - p.bustP, T = TIDE_T, k = V.key(t);
  const at = (k2, P2) => P2 > VG_HI ? 1 : V.V[k2][P2]; /* past 26 nothing beats you */
  let roll = 0;
  safe.forEach(e => {
    let inner;
    if(t.status !== 'live' || t.pot >= T) inner = at(k, P + e.s);
    else {
      inner = p.bustP;                        /* the Tide busts alongside: you win */
      safe.forEach(x => {
        const D2 = t.pot + x.s, k2 = D2 >= T ? 'b' + D2 : 'l' + D2;
        inner += S * x.p * at(k2, P + e.s);
      });
    }
    roll += e.p * inner;
  });
  return S * roll;
}

/* bankStart() prepares state only — the briefing shows before any roll.
   bankBegin() reveals the board. No clock in this round type. */
function bankStart(){
  round.level = skillLevel('bank');
  round.p = bankParams(round.level);
  round.rng = mulberry32(round.seed);
  round.pot = 0; round.decisions = []; round.state = 'ready';
  round.lastRoll = null; round.busted = false; round.statusText = '';
  round.bustBrokeStreak = false; round.bankBrokeStreak = false;
  round.safe = safeSums(round.p.rule);
  round.V = gameValue(round.p, round.safe);
  round.tide = { status: 'live', pot: 0, rolls: [], lastRoll: null, statusText: '' };
}

function bankBegin(){
  $('#bankRoundLabel').textContent = 'Round ' + (round.index + 1) + ' of ' + ROUNDS_PER_SESSION;
  /* the Tide opens with its own roll — visible before you act. It can bust
     on the opener (same risk you carry), which ends it at pot 0 */
  const a = 1 + ((round.rng() * 6) | 0), b = 1 + ((round.rng() * 6) | 0);
  round.tide.lastRoll = [a, b];
  round.tide.rolls.push([a, b]);
  if(rollBusts(a, b, round.p.rule)){
    round.tide.status = 'bust';
    round.tide.statusText = 'The Tide busted on its opening roll.';
  } else {
    round.tide.pot = a + b;
    round.tide.statusText = 'The Tide opened at ' + (a + b) + '.';
  }
  bankRender();
  showPhase('phase-bank');
}

/* ---------------- briefing ---------------- */
function bankIntro(){
  const p = round.p;
  const pct = Math.round(p.bustP * 100);
  return {
    title: 'Keep or Roll',
    note: 'Bust rule this round: <b>a roll is a bust when it shows ' + p.ruleText + '</b> — about a <b>' + pct + '% chance on every single roll</b>, for you <b>and the Tide</b>',
    cta: 'Start — Roll the Dice',
    fine: 'No clock in this round — the dice wait for you.',
    steps: [
      ['Roll to grow the pot', 'Each roll adds both dice together to your pot. A safe roll of 5+3 adds 8, for example.'],
      ['A bust roll wipes the pot', 'The moment a roll breaks the bust rule above, the <b>entire pot drops to zero</b> and the round ends — there is no partial save.'],
      ['Meet the Tide', 'The Tide rolls its own pot right beside yours under the <b>same bust rule</b>, and it follows one fixed, visible policy: <b>roll below 15, keep at 15 or above</b>. It never adapts and never bluffs — you always know exactly what it will do. It rolls each time you roll, and it plays its policy out to the end the moment you keep.'],
      ['The goal: finish above the Tide', 'Finish with a <b>higher kept pot</b> than the Tide. It busts too — a busted Tide loses to any kept pot, however small. A tie goes to the Tide, so equal pots count as a loss.'],
      ['The math that scores you', 'Every call is scored against the <b>true odds of beating the Tide with optimal play</b> — your pot, the Tide\u2019s pot, both bust risks, the Tide\u2019s known policy, and your freedom to keep rolling are all priced in. The roll number assumes sharp follow-through: after a safe roll, you keep making the +EV call. With hints on, the panel shows your win % for keeping vs rolling; the call with the better number is the +EV one.'],
      ['Rewards', 'A +EV call fires \u26a1 SHARP the instant you make it — before the next roll. A \u2212EV call that works out anyway — a roll that survives, a keep that still beats the Tide — is <b>neutral</b>: no reward, no streak break. Only a \u2212EV call that goes bad breaks the streak: a roll that busts, or a keep that loses the round.']
    ]
  };
}

function tideStateText(){
  const t = round.tide;
  if(t.status === 'bust')   return 'Busted — any kept pot beats it.';
  if(t.status === 'banked') return 'Kept at ' + t.pot + ' — the number to beat.';
  return 'Rolling with you — rolls below ' + TIDE_T + '.';
}

function bankRender(){
  $('#potVal').textContent = round.pot;
  const t = round.tide;
  $('#tideVal').textContent = t.status === 'bust' ? '–' : t.pot;
  const d = $('#bankDice');
  const faces = round.lastRoll || [3, 4];
  const cls = round.lastRoll ? (round.busted ? 'bust' : '') : 'dim';
  d.innerHTML = dieHTML(faces[0], cls) + dieHTML(faces[1], cls);
  const td = $('#tideDice');
  const tf = t.lastRoll || [2, 5];
  const tcls = t.lastRoll ? (t.status === 'bust' ? 'bust' : (t.status === 'banked' ? 'tidebanked' : '')) : 'dim';
  td.innerHTML = dieHTML(tf[0], tcls) + dieHTML(tf[1], tcls);
  const st = { ready: 'Roll to open the pot.', rolling: 'Rolling…', decide: 'Safe roll — keep it or roll again?' };
  $('#bankStatus').textContent = round.statusText || st[round.state] || '';
  $('#tideStatus').textContent = t.statusText || tideStateText();
  $('#bankRollBtn').classList.toggle('hidden', round.state !== 'ready');
  $('#bankBankBtn').classList.toggle('hidden', round.state !== 'decide');
  $('#bankPushBtn').classList.toggle('hidden', round.state !== 'decide');
  if(round.state === 'decide'){
    $('#bankBankBtn').textContent = 'Keep ' + round.pot;
    $('#bankPushBtn').textContent = 'Roll';
  }
  const hint = $('#bankHint');
  if(round.state === 'decide' && hintsEnabled('bank')){
    const memo = {};
    const b = vBank(round.pot, t, round.p, round.safe, memo);
    const q = vRoll(round.pot, t, round.p, round.safe, round.V);
    hint.classList.remove('hidden');
    hint.innerHTML = 'Beat-the-Tide odds · <b>keep now: ' + Math.round(b * 100) + '%</b> · <b>roll: ' + Math.round(q * 100) + '%</b> · bust per roll: ' + Math.round(round.p.bustP * 100) + '% (busts on ' + round.p.ruleText + ') · roll % assumes sharp follow-through';
  } else if(round.state !== 'done'){
    hint.classList.remove('hidden');
    hint.textContent = 'Bust odds each roll: ' + Math.round(round.p.bustP * 100) + '% (busts on ' + round.p.ruleText + ') · the Tide keeps at ' + TIDE_T + '+';
  } else hint.classList.add('hidden');
}

/* one policy step for the Tide — only while live and below its threshold */
function tideStep(){
  if(round.tide.status !== 'live' || round.tide.pot >= TIDE_T) return;
  const a = 1 + ((round.rng() * 6) | 0), b = 1 + ((round.rng() * 6) | 0);
  round.tide.lastRoll = [a, b];
  round.tide.rolls.push([a, b]);
  if(rollBusts(a, b, round.p.rule)){
    round.tide.status = 'bust';
    round.tide.statusText = 'The Tide rolled ' + a + '+' + b + ' — bust.';
  } else {
    round.tide.pot += a + b;
    round.tide.status = round.tide.pot >= TIDE_T ? 'banked' : 'live';
    round.tide.statusText = round.tide.status === 'banked'
      ? 'The Tide rolled ' + a + '+' + b + ' → ' + round.tide.pot + ' — kept.'
      : 'The Tide rolled ' + a + '+' + b + ' → ' + round.tide.pot + '.';
  }
}

function bankRoll(){
  if(round.state !== 'ready' && round.state !== 'decide') return;
  const tideRolls = round.state === 'decide';   /* the Tide rolls alongside every roll, never the opener */
  round.state = 'rolling';
  bankRender();
  const dur = motionOK() ? 550 : 40;
  let spin = null;
  if(motionOK()){
    spin = setInterval(() => {
      $('#bankDice').innerHTML = dieHTML(1 + ((Math.random() * 6) | 0)) + dieHTML(1 + ((Math.random() * 6) | 0));
      if(tideRolls && round.tide.status === 'live' && round.tide.pot < TIDE_T)
        $('#tideDice').innerHTML = dieHTML(1 + ((Math.random() * 6) | 0)) + dieHTML(1 + ((Math.random() * 6) | 0));
    }, 70);
  }
  setTimeout(() => {
    if(spin) clearInterval(spin);
    if(!round || round.type !== 'bank') return;
    const a = 1 + ((round.rng() * 6) | 0), b = 1 + ((round.rng() * 6) | 0);
    round.lastRoll = [a, b];
    const bust = rollBusts(a, b, round.p.rule);
    if(tideRolls) tideStep();
    if(bust){
      round.busted = true; round.state = 'done';
      round.statusText = 'Rolled ' + a + '+' + b + ' — bust. The pot is gone.';
      /* the bust resolves the roll that caused it: a −EV roll that
         busts is the one outcome that breaks the streak — a sharp roll
         busting is just bad luck, and a −EV roll that survives stays
         neutral */
      const last = round.decisions[round.decisions.length - 1];
      if(last && last.action === 'push'){
        last.resolved = 'bust';
        if(!last.correct){ round.bustBrokeStreak = true; breakStreak(); }
      }
      bankRender();
      setTimeout(bankFinish, 1400);
    } else {
      const last = round.decisions[round.decisions.length - 1];
      if(last && last.action === 'push') last.resolved = 'safe';
      round.pot += a + b;
      round.state = 'decide';
      round.statusText = 'Rolled ' + a + '+' + b + ' — pot +' + (a + b) + '.';
      bankRender();
    }
  }, dur);
}

function bankDecide(action){
  if(round.state !== 'decide') return;
  const memo = {};
  const b = vBank(round.pot, round.tide, round.p, round.safe, memo);
  const q = vRoll(round.pot, round.tide, round.p, round.safe, round.V);
  const correct = action === 'push' ? q >= b - 1e-9 : b >= q - 1e-9;
  round.decisions.push({
    pot: round.pot,
    tidePot: round.tide.status === 'live' ? round.tide.pot : null,
    action: action, vKeep: +b.toFixed(4), vRoll: +q.toFixed(4),
    correct: correct, resolved: null
  });
  if(correct) processReward(action === 'push' ? $('#bankPushBtn') : $('#bankBankBtn'));
  /* a −EV call never breaks the streak on the spot — its outcome decides:
     a roll that busts pays for the decision at the roll, a roll that
     survives or a keep that still beats the Tide is neutral, and a keep
     that loses the round settles its bill at the verdict */
  if(action === 'bank'){
    round.state = 'done';
    round.statusText = 'Kept ' + round.pot + ' — the Tide finishes.';
    bankRender();
    setTimeout(tideFinish, 900);
  } else {
    round.statusText = 'Rolling…';
    bankRoll();
  }
}

/* the Tide plays its policy out once the player keeps: roll below TIDE_T,
   keep at/above, bust possible — then the pots compare */
function tideFinish(){
  if(!round || round.type !== 'bank' || round.state !== 'done') return;
  if(round.tide.status === 'live' && round.tide.pot < TIDE_T){
    const dur = motionOK() ? 550 : 40;
    let spin = null;
    if(motionOK()){
      spin = setInterval(() => {
        $('#tideDice').innerHTML = dieHTML(1 + ((Math.random() * 6) | 0)) + dieHTML(1 + ((Math.random() * 6) | 0));
      }, 70);
    }
    setTimeout(() => {
      if(spin) clearInterval(spin);
      if(!round || round.type !== 'bank') return;
      tideStep();
      bankRender();
      setTimeout(tideFinish, 700);
    }, dur);
  } else {
    setTimeout(bankFinish, 450);
  }
}

function bankFinish(){
  const busted = !!round.busted;
  const total = round.decisions.length;
  const pos = round.decisions.filter(x => x.correct).length;
  const tide = round.tide;
  const tideFinal = tide.status === 'banked' ? tide.pot : 0;
  const tie = !busted && tide.status === 'banked' && round.pot === tideFinal;
  const win = !busted && !tie && round.pot > tideFinal;
  /* the keep resolves with the verdict: a −EV keep that loses the round is
     the decision that paid for it — a −EV keep that wins got bailed out */
  const last = round.decisions[round.decisions.length - 1];
  if(last && last.action === 'bank' && !last.correct){
    last.resolved = win ? 'banked-win' : 'banked-loss';
    if(!win){ round.bankBrokeStreak = true; breakStreak(); }
  }
  /* −EV calls that luck bailed out: rolls that survived, keeps that won anyway */
  const neutralCalls = round.decisions.filter(x => !x.correct && (x.resolved === 'safe' || x.resolved === 'banked-win')).length;
  const rec = {
    round_type: 'bank', round: round.index, seed: round.seed,
    diff: settings.difficulty, level: +round.level.toFixed(2),
    rule: round.p.rule, tidePolicy: TIDE_T,
    decisions: total, posDecisions: pos, neutralDecisions: neutralCalls,
    busted: busted, banked: busted ? 0 : round.pot,
    outcome: win ? 1 : 0, tie: tie,
    dealerStart: tide.rolls.length ? tide.rolls[0][0] + tide.rolls[0][1] : 0,
    dealerFinal: tideFinal, dealerBusted: tide.status === 'bust',
    callLog: round.decisions.map(x => ({ pot: x.pot, tidePot: x.tidePot, action: x.action,
      vKeep: x.vKeep, vRoll: x.vRoll, correct: x.correct, resolved: x.resolved }))
  };
  finishRound(rec);

  const sharp = total > 0 && pos === total;
  const timeline = total
    ? round.decisions.map(x =>
        '<div class="tt ' + (x.correct ? 'good' : 'bad') + '">pot ' + x.pot +
        (x.tidePot != null ? ' · tide ' + x.tidePot : '') + ' · ' +
        (x.action === 'push' ? 'rolled' : 'kept') +
        ' (keep ' + Math.round(x.vKeep * 100) + '% · roll ' + Math.round(x.vRoll * 100) + '%) · ' +
        (x.correct ? '+EV' : '−EV' +
          (x.resolved === 'bust' ? ' · broke the streak'
           : x.resolved === 'banked-loss' ? ' · cost the round — broke the streak'
           : ' · neutral')) + '</div>').join('')
    : '<div class="tt">No calls to make — the dice decided this one.</div>';

  /* the Tide's roll history, then where it ended */
  let tSum = 0, tBusted = false;
  const tideLine = tide.rolls.map((r, i) => {
    if(tBusted) return '';
    if(rollBusts(r[0], r[1], round.p.rule)){
      tBusted = true;
      return '<div class="tt tide">tide ' + (i === 0 ? 'opened' : 'rolled') + ' ' + r[0] + '+' + r[1] + ' — bust</div>';
    }
    tSum += r[0] + r[1];
    return '<div class="tt tide">tide ' + (i === 0 ? 'opened' : 'rolled') + ' ' + r[0] + '+' + r[1] + ' → ' + tSum + '</div>';
  }).join('') +
  '<div class="tt tide">' + (tide.status === 'banked' ? 'tide keeps ' + tide.pot + ' — the number to beat'
    : tide.status === 'bust' ? 'tide is out — pot 0'
    : 'tide never finished — you busted first') + '</div>';

  const head = busted
    ? 'Bust at ' + round.pot + ' — the Tide takes it'
    : win
      ? 'Kept ' + round.pot + ' · Tide ' + tideFinal + ' — beaten'
      : tie
        ? 'Dead heat at ' + round.pot + ' — ties go to the Tide'
        : 'Kept ' + round.pot + ' · Tide ' + tideFinal + ' — the Tide takes it';

  let deb;
  if(!total)          deb = busted ? 'Busted on the opening roll. Nothing to decide there — pure luck.'
                                    : 'Kept without a single roll. The opening roll carried it.';
  else if(round.bustBrokeStreak) deb = 'That roll fought the math and the bust made it stick — a −EV roll that busts is the one thing that breaks the streak. Price the Tide before you roll.';
  else if(round.bankBrokeStreak) deb = 'That keep fought the math and the Tide made it stick — a −EV keep that loses the round breaks the streak. When the win odds favored rolling, keeping bought the loss.';
  else if(sharp && win) deb = 'Sharp calls, and the pot held up — you finished above the Tide. This is the best cell.';
  else if(sharp && busted) deb = 'Sharp calls, unlucky bust. Every roll you made was worth making — the streak knows it.';
  else if(sharp && !win) deb = 'Sharp calls — the Tide just rolled even or bigger. A sharp loss is luck, not process: the streak holds.';
  else if(win) deb = 'Kept past the Tide — but ' + (total - pos) + ' of ' + total + ' calls fought the math. Luck covered them: neutral, no streak growth and no break.';
  else deb = 'The round is lost, but luck bailed out the −EV calls — a survived roll or a keep that landed counts neutral. The streak neither grows nor breaks.';

  const badges = [];
  if(sharp) badges.push('<span class="rv-badge">⚡ ' + pos + ' of ' + total + ' calls +EV</span>');
  if(win) badges.push('<span class="rv-badge gold">beat the Tide</span>');
  if(!sharp && !round.bustBrokeStreak && !round.bankBrokeStreak && neutralCalls)
    badges.push('<span class="rv-badge neutral">neutral · no streak change</span>');

  showReveal({
    heading: head,
    badges: badges,
    detail: timeline + '<div class="tt-sep"></div>' + tideLine,
    debrief: deb,
    good: sharp,
    win: win,
    muted: !sharp,
    accent: sharp ? 'sharp' : null,
    streakNote: (!sharp && !round.bustBrokeStreak && !round.bankBrokeStreak && neutralCalls)
      ? 'Neutral: the −EV calls got bailed out — the streak neither grows nor breaks.'
      : undefined
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
      ['What \u201csharp\u201d means here', 'Every keep/reroll split has an exact expected score (each marked die has 6 equally likely faces). Land within 0.5 points of the best split and \u26a1 SHARP fires at lock-in. The confidence chips rate how likely your call is to beat the alternative you skipped. A call outside that window that still beats the alternative is <b>neutral</b> — no reward, no streak break; only one that loses ground breaks it.']
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
  /* a non-sharp call is not judged until the dice land: beating the
     alternative you skipped is neutral (no reward, no break) — only a
     non-sharp call that loses ground breaks the streak */

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
  /* same rule as a deliberate call: the forced keep is only penalized if
     the shadow reroll beats it — a hold-up is neutral. Brier stays null:
     there was no stated confidence to score. */
  const hand = round.sit.hand.slice();
  round.sit.best.subset.forEach(i => hand[i] = 1 + ((round.rng() * 6) | 0));
  round.finalHand = round.sit.hand.slice();
  round.finalScore = round.sit.keep;
  round.kept = true;
  round.altScore = scoreHand(hand, round.sit.cat);
  round.outcome = round.finalScore >= round.altScore ? 1 : 0;
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
    neutral: !round.sharp && round.outcome === 1,
    brier: (round.stated != null && round.outcome != null) ? +Math.pow(round.stated - round.outcome, 2).toFixed(4) : null,
    final_score: round.finalScore, alt_score: +round.altScore.toFixed(2)
  };
  finishRound(rec);

  /* outcome-contingent penalty: a non-sharp call that lost ground breaks
     the streak; one the dice bailed out is neutral (nothing added, nothing
     taken) */
  const neutral = !round.sharp && round.outcome === 1;
  if(!round.sharp && round.outcome !== 1) breakStreak();

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
  if(neutral) badges.push('<span class="rv-badge neutral">neutral · no streak change</span>');
  const bars = evBarsHTML(round.exactBest
    ? [{ label: 'Your call — best play', value: +round.chosenEV.toFixed(2), cls: 'best' }]
    : [{ label: 'Your call', value: +round.chosenEV.toFixed(2), cls: 'you' },
       { label: 'Best play', value: +s.best.ev.toFixed(2), cls: 'best' }]);

  let deb;
  if(round.timeout)      deb = 'Time ran out, so you kept by default. ' +
    (round.sharp ? 'As it happens, keeping was the sharp call.'
     : round.outcome === 1 ? 'Keeping still held up against the best reroll — neutral: no streak change. But the clock made that call, not the math.'
     : 'The best reroll would have beaten it — the streak breaks. The clock is part of the game.');
  else if(round.sharp && win)  deb = 'Sharp call and it held up. You read the dice right.';
  else if(round.sharp && !win) deb = 'Sharp call, unlucky roll. The expected value was on your side — the dice just disagreed.';
  else if(!round.sharp && win) deb = 'It worked out, but the math was against this call — neutral: no streak growth, no break. Don\u2019t let a bailed-out call teach the wrong habit.';
  else                   deb = 'The odds were against this call and the dice agreed — that combination is what breaks the streak. Focus on the expected value, not the result.';

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
    accent: round.sharp ? (round.exactBest ? 'best' : 'sharp') : null,
    streakNote: neutral ? 'Neutral: the dice bailed out a \u2212EV call — the streak neither grows nor breaks.' : undefined
  });
}
