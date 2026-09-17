/* ==========================================================================
   School of Thought — calibration surfaces: crystal, reliability diagram,
   summaries, edge report. Reads the ledger; renders into HUD and summary.
   ========================================================================== */
'use strict';

/* ---------------- aggregation ---------------- */
function aggregate(recs){
  const cal = recs.filter(r => r.stated != null && r.outcome != null);
  const g   = recs.filter(r => (r.round_type || 'guess') === 'guess');
  const rr  = recs.filter(r => r.round_type === 'reroll');
  const bk  = recs.filter(r => r.round_type === 'bank');
  const buckets = CHIPS.map((p, i) => {
    const rs = cal.filter(r => r.chips === i + 1);
    return { stated: p, n: rs.length,
             hit: rs.length ? rs.filter(r => r.outcome === 1).length / rs.length : null };
  });
  return {
    n: recs.length,
    brier: cal.length ? mean(cal.map(r => r.brier)) : null,
    buckets: buckets,
    guess: {
      n: g.length,
      pos:  g.length ? g.filter(r => r.selPositive).length / g.length : null,
      best: g.length ? g.filter(r => r.selBest).length / g.length : null,
      avgSelEV:  g.length ? mean(g.map(r => r.selEV)) : null,
      avgBestEV: g.length ? mean(g.map(r => r.bestEV)) : null,
      avgImplied: g.length ? mean(g.map(r => r.implied)) : null
    },
    reroll: {
      n: rr.length,
      sharp: rr.length ? rr.filter(r => r.sharp).length / rr.length : null,
      edge:  rr.length ? mean(rr.map(r => r.chosen_ev - r.best_ev)) : null
    },
    bank: {
      n: bk.length,
      calls: bk.reduce((a, r) => a + (r.decisions || 0), 0),
      posCalls: bk.reduce((a, r) => a + (r.posDecisions || 0), 0),
      banked: bk.reduce((a, r) => a + (r.banked || 0), 0),
      busts: bk.filter(r => r.busted).length,
      wins: bk.filter(r => r.outcome === 1).length
    }
  };
}
function overallSharpRate(a){
  let good = 0, total = 0;
  if(a.guess.n){ good += a.guess.pos * a.guess.n; total += a.guess.n; }
  if(a.reroll.n){ good += a.reroll.sharp * a.reroll.n; total += a.reroll.n; }
  if(a.bank.calls){ good += a.bank.posCalls; total += a.bank.calls; }
  return total ? good / total : null;
}

/* ---------------- calibration crystal ----------------
   Clarity tracks the rolling Brier score: better calibration sharpens the
   facet lines and strengthens the internal light. */
function crystalSVG(clarity, uid){
  const blur  = (1 - clarity) * 5;
  const light = 30 + clarity * 40;
  return '<svg viewBox="0 0 100 120" class="crystal" aria-hidden="true">' +
    '<defs><filter id="cb' + uid + '"><feGaussianBlur stdDeviation="' + blur.toFixed(1) + '"/></filter></defs>' +
    '<polygon points="50,4 92,40 78,112 22,112 8,40" fill="hsl(190,70%,' + light.toFixed(0) + '%)" opacity="' + (0.35 + clarity*0.6).toFixed(2) + '" filter="url(#cb' + uid + ')"/>' +
    '<polygon points="50,4 92,40 50,62 8,40" fill="hsl(190,85%,' + (light+12).toFixed(0) + '%)" opacity="' + (0.45 + clarity*0.5).toFixed(2) + '"/>' +
    '<polygon points="50,62 92,40 78,112 50,112" fill="hsl(205,65%,' + light.toFixed(0) + '%)" opacity="' + (0.45 + clarity*0.45).toFixed(2) + '"/>' +
    '<polygon points="50,62 8,40 22,112 50,112" fill="hsl(175,65%,' + light.toFixed(0) + '%)" opacity="' + (0.45 + clarity*0.45).toFixed(2) + '"/>' +
    /* internal light core */
    '<polygon points="50,34 68,48 61,90 39,90 32,48" fill="#cffcf1" opacity="' + (0.08 + clarity*0.42).toFixed(2) + '"/>' +
    /* facet edges — crisp when sharp, ghosted when murky */
    '<g stroke="#ffffff" stroke-width="1.1" fill="none" stroke-linejoin="round" opacity="' + (0.06 + clarity*0.5).toFixed(2) + '">' +
      '<polyline points="8,40 50,62 92,40"/>' +
      '<polyline points="22,112 50,62 78,112"/>' +
      '<line x1="50" y1="62" x2="50" y2="112"/>' +
    '</g>' +
    '</svg>';
}
const clarityFromBrier = b => (b == null ? 0.15 : clamp(1 - b / 0.25, 0.05, 1));

function updateHUD(silent){
  const a = aggregate(ledger);
  $('#crystalMini').innerHTML = crystalSVG(clarityFromBrier(a.brier), 'm');
  $('#calibLabel').textContent = a.brier == null
    ? 'No data yet — play to grow your crystal'
    : 'Brier ' + a.brier.toFixed(3) + ' · lower is better';
  if(typeof renderRankHUD === 'function') renderRankHUD(silent);
}
function updateStreakUI(){
  $('#streakVal').textContent = streak.current;
  $('#streakBest').textContent = 'best ' + streak.best;
}

/* ---------------- reliability diagram ---------------- */
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
function statCell(k, v){ return '<div class="stat"><span>' + k + '</span><b>' + v + '</b></div>'; }
function pct(x){ return x == null ? '–' : Math.round(x * 100) + '%'; }
function signed(x, d){
  if(x == null) return '–';
  return (x >= 0 ? '+' : '') + x.toFixed(d == null ? 2 : d);
}

function tbCard(title, n, rows){
  return '<div class="tb-card"><h4>' + title + ' · ' + n + ' round' + (n === 1 ? '' : 's') + '</h4>' +
    rows.map(r => '<div class="tb-line">' + r[0] + ': <b>' + r[1] + '</b></div>').join('') + '</div>';
}
function typeBreakdownHTML(recs){
  if(!recs.length) return '';
  const a = aggregate(recs);
  const parts = [];
  if(a.guess.n) parts.push(tbCard('Guess & Bet', a.guess.n, [
    ['+EV bets', pct(a.guess.pos)],
    ['Best-value found', pct(a.guess.best)]
  ]));
  if(a.bank.n) parts.push(tbCard('Keep or Roll', a.bank.n, [
    ['+EV calls', a.bank.calls ? pct(a.bank.posCalls / a.bank.calls) : '–'],
    ['Beat the Tide', a.bank.n ? pct(a.bank.wins / a.bank.n) : '–'],
    ['Kept total', a.bank.banked]
  ]));
  if(a.reroll.n) parts.push(tbCard('Five Dice Roll', a.reroll.n, [
    ['Sharp calls', pct(a.reroll.sharp)],
    ['Avg edge', signed(a.reroll.edge, 1) + ' pts']
  ]));
  return parts.join('');
}

function edgeTableHTML(a){
  const g = a.guess, rr = a.reroll, bk = a.bank;
  const rows = [];
  if(g.n){
    rows.push({ head: 'Market rounds (Guess & Bet)', v: g.n });
    rows.push({ label: 'Avg EV of your bets', v: signed(g.avgSelEV) });
    rows.push({ label: 'Avg best EV on the board', v: signed(g.avgBestEV) });
    rows.push({ label: 'Edge (you − best available)', v: signed(g.avgSelEV != null && g.avgBestEV != null ? g.avgSelEV - g.avgBestEV : null) });
    rows.push({ label: 'Best-value bets found', v: pct(g.best) });
    rows.push({ label: 'Avg implied chance of your picks', v: g.avgImplied == null ? '–' : Math.round(g.avgImplied * 100) + '% (low = longshot taste)' });
    rows.push({ sep: true });
  }
  if(rr.n){
    rows.push({ head: 'Reroll rounds', v: rr.n });
    rows.push({ label: 'Sharp calls', v: pct(rr.sharp) });
    rows.push({ label: 'Avg edge vs best play', v: signed(rr.edge, 1) + ' pts' });
    rows.push({ sep: true });
  }
  if(bk.n){
    rows.push({ head: 'Keep or Roll rounds (vs the Tide)', v: bk.n });
    rows.push({ label: '+EV calls', v: bk.calls ? pct(bk.posCalls / bk.calls) : '–' });
    rows.push({ label: 'Beat the Tide', v: pct(bk.n ? bk.wins / bk.n : null) });
    rows.push({ label: 'Kept total', v: bk.banked });
    rows.push({ label: 'Bust rate', v: pct(bk.n ? bk.busts / bk.n : null) });
  }
  if(!rows.length) return '<p class="hint">Play some rounds to fill this in.</p>';
  return '<div class="stat-table">' + rows.map(r =>
    r.sep ? '<div class="sep"></div>'
          : '<div class="k' + (r.head ? ' strong' : '') + '">' + (r.head || r.label) + '</div><div class="v">' + r.v + '</div>'
  ).join('') + '</div>';
}

function showSummary(mode){
  const a = aggregate(ledger);
  const sessRecs = (mode === 'session' && session) ? session.records : [];
  const sa = sessRecs.length ? aggregate(sessRecs) : null;
  $('#sumTitle').textContent = mode === 'session' ? 'Session summary' : 'Your calibration';
  $('#crystalBig').innerHTML = crystalSVG(clarityFromBrier(a.brier), 'b');
  const brierSrc = (sa && sa.brier != null) ? sa.brier : a.brier;
  $('#sumStats').innerHTML =
    statCell('Brier' + (sa && sa.brier != null ? ' (session)' : ''), brierSrc == null ? '–' : brierSrc.toFixed(3)) +
    statCell('Rounds logged', a.n) +
    statCell('Sharp calls', pct(overallSharpRate(a))) +
    statCell('Best streak', streak.best) +
    (typeof currentTier === 'function' && typeof rankBadgeHTML === 'function'
       ? statCell('Rank', rankBadgeHTML(currentTier()) + currentRank().name) : '');
  $('#typeBreakdown').innerHTML = typeBreakdownHTML(mode === 'session' ? sessRecs : ledger);
  $('#chartWrap').innerHTML  = reliabilitySVG(a, 560, 320);
  $('#edgeWrap').innerHTML   = edgeTableHTML(a);
  showPhase('phase-summary');
}
