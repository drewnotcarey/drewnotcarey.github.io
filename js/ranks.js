/* ==========================================================================
   School of Thought — rank system
   Minnow → Shark → Whale. A school of fish that grows wiser, not bigger
   by luck: progression is driven only by decision quality — rolling Brier
   calibration plus sustained Sharp Streaks. Never win rate, never volume.
   Ranks never demote.
   ========================================================================== */
'use strict';

const RANKS = [
  { key: 'minnow', name: 'Minnow', color: '#7DD3C0', flavor: 'Small, quick, watching the current.' },
  { key: 'shark',  name: 'Shark',  color: '#5EEAD4', flavor: 'You move with the school now.' },
  { key: 'whale',  name: 'Whale',  color: '#A5F3FC', flavor: 'The deep answers to you now.' }
];

/* minimal geometric silhouettes — single color (currentColor), no cartoons */
function rankSVG(tier){
  if(tier === 1){   /* shark: angular body, dorsal fin, notched tail */
    return '<svg viewBox="0 0 64 40" aria-hidden="true">' +
      '<polygon points="16,20 2,8 8,20 2,32" fill="currentColor"/>' +
      '<polygon points="16,20 30,12 38,14 44,4 48,14 58,17 62,20 58,23 48,26 44,27 40,34 34,24 26,26" fill="currentColor"/>' +
      '</svg>';
  }
  if(tier === 2){   /* whale: large slow form, fluke, ventral fin */
    return '<svg viewBox="0 0 64 40" aria-hidden="true">' +
      '<ellipse cx="28" cy="21" rx="24" ry="12" fill="currentColor"/>' +
      '<polygon points="50,21 62,9 57,21 62,33" fill="currentColor"/>' +
      '<polygon points="24,31 30,39 17,37" fill="currentColor"/>' +
      '</svg>';
  }
  /* minnow: small quick ellipse + triangular tail */
  return '<svg viewBox="0 0 64 40" aria-hidden="true">' +
    '<ellipse cx="26" cy="20" rx="16" ry="8" fill="currentColor"/>' +
    '<polygon points="40,20 56,10 56,30" fill="currentColor"/>' +
    '</svg>';
}

/* ---------------- metrics: decision quality only ---------------- */
function rankMetrics(){
  const scored = ledger.filter(r => r.stated != null && r.brier != null);
  const recent = scored.slice(-16);
  const longer = scored.slice(-30);
  return {
    n: scored.length,
    recentN: recent.length,
    recentBrier: recent.length ? mean(recent.map(r => r.brier)) : null,
    longN: longer.length,
    longBrier: longer.length ? mean(longer.map(r => r.brier)) : null,
    bestStreak: streak ? streak.best : 0
  };
}
/* Shark: reliable recent calibration + a sustained sharp streak.
   Whale: elite long-run calibration + a long sustained streak. */
function computeTier(m){
  if(m.longN >= 20 && m.longBrier != null && m.longBrier <= 0.10 && m.bestStreak >= 10) return 2;
  if(m.recentN >= 10 && m.recentBrier != null && m.recentBrier <= 0.16 && m.bestStreak >= 5) return 1;
  return 0;
}
function currentRank(){
  return RANKS[clamp(store.get('rank', { tier: 0 }).tier || 0, 0, 2)];
}

function rankTooltip(m, tier){
  const head = 'Rank grows with decision quality \u2014 calibration and sharp streaks, never wins.';
  const now  = 'Now: rolling Brier ' + (m.recentBrier == null ? '\u2013' : m.recentBrier.toFixed(3)) +
               ' (last ' + m.recentN + ' scored) \u00b7 best streak ' + m.bestStreak;
  let next;
  if(tier === 0)      next = 'Next \u2014 Shark: rolling Brier \u2264 0.160 over 10+ scored rounds and a 5+ Sharp Streak.';
  else if(tier === 1) next = 'Next \u2014 Whale: rolling Brier \u2264 0.100 over 20+ scored rounds and a 10+ Sharp Streak.';
  else                next = 'Top of the school \u2014 the deep answers to you.';
  return head + '\n' + now + '\n' + next;
}

/* ---------------- HUD badge + rank-up detection ----------------
   Called from updateHUD(). finishRound() allows the celebration; the
   initial page load syncs silently (returning players who already earned
   a rank adopt it without fanfare). */
function renderRankHUD(silent){
  const m      = rankMetrics();
  const earned = computeTier(m);
  const stored = clamp(store.get('rank', { tier: 0 }).tier || 0, 0, 2);
  let tier = stored, rose = -1;
  if(earned > stored){ tier = earned; store.set('rank', { tier: earned }); rose = earned; }
  const hud = $('#rankHud');
  hud.className = 'hud-item rank-hud r' + tier;
  hud.title = rankTooltip(m, tier);
  hud.innerHTML = '<span class="rank-ic">' + rankSVG(tier) + '</span><b>' + RANKS[tier].name + '</b>';
  if(rose >= 0 && !silent) rankUp(rose);
}

/* ---------------- the rank-up moment ----------------
   Rising school of light + deep rising tone + triple pulse + one line of
   flavor. Fires only on a fresh promotion earned in-play. */
function rankUp(tier){
  const r = RANKS[tier];
  rankUpTone();
  pulseRankUp();
  if(motionOK()) rankSchool();
  const t = $('#rankToast');
  t.innerHTML =
    '<span class="rt-label">Rank up</span>' +
    '<span class="rt-fish" style="color:' + r.color + '">' + rankSVG(tier) + '</span>' +
    '<span class="rt-name" style="color:' + r.color + '">' + r.name + '</span>' +
    '<span class="rt-flavor">' + r.flavor + '</span>';
  t.style.borderColor = r.color;
  t.classList.add('show');
  clearTimeout(rankUp._id);
  rankUp._id = setTimeout(() => t.classList.remove('show'), 3400);
}
