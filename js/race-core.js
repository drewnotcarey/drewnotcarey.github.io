/* ==========================================================================
   School of Thought — Minnow Race core (pure math, no DOM)

   A Guess & Bet proposition: six minnows, latent strengths, true win
   probabilities by softmax, a book priced off the TRUTH with a realistic
   margin + longshot shading and occasional deliberate mispricings, and a
   truth-blind player model built only from the public form readings.

   Three pure pieces:
     genRaceField(rng, level)  — strengths, true probabilities, noisy form
     priceRaceBook(p, rng, level) — payouts + which slot (if any) is mispriced
     raceModel(bars, sigYou, sigmaForm) — the player-model probabilities

   Self-contained on purpose (own gaussian) so tests can vm/require this
   file without app.js. Deterministic per rng.
   ========================================================================== */
'use strict';

const RACE_N = 6;

/* identity colors — deliberately avoiding the UI accents: no teal (selection
   / best-value) and no gold (player / truth); six hues that stay distinct
   on the deep-water background and from each other in small chips. */
const RACE_COLORS = [
  { name: 'Coral',  hex: '#f87171' },
  { name: 'Orange', hex: '#fb923c' },
  { name: 'Lime',   hex: '#a3e635' },
  { name: 'Sky',    hex: '#60a5fa' },
  { name: 'Violet', hex: '#a78bfa' },
  { name: 'Rose',   hex: '#f472b6' }
];

/* difficulty knobs (level 0..2, fractional in auto mode — lerp everything) */
const RACE_PARAMS = {
  tauLo:    [0.40, 0.50, 0.60],   /* softmax temperature range: easy fields   */
  tauHi:    [0.52, 0.66, 0.84],   /* are structured, hard fields are flat —  */
                                   /* kept tight: the model assumes the level  */
                                   /* midpoint, and wide swings read as false  */
                                   /* edges (measured, Task 24 census)         */
  tauMid:   [0.46, 0.58, 0.72],  /* level's typical temperature — the model  */
                                   /* gain is its reciprocal (see raceModel)   */
  sSd:      0.50,                 /* latent strength spread                   */
  pMaxCap:  0.62,                 /* reject monster-favorite fields           */
  formSd:   [0.06, 0.11, 0.15],   /* noise on the form reading, in s-units    */
  misRate:  [0.40, 0.35, 0.30],   /* share of boards carrying a mispricing    */
  overlay:  [1.52, 1.48, 1.44],   /* favorite priced too generously (gem)     */
  underlay: [0.52, 0.58, 0.62],   /* longshot chopped (trap)                  */
  overLo:   1.22,                 /* book overround range                     */
  overHi:   1.30,
  shade:    0.90,                 /* payout exponent < 1 = longshot shading   */
  payMin:   1.2, payMax: 40,
  jitLo:    0.95, jitHi: 1.05,     /* final per-slot price jitter              */
  readLo:   0.20,                 /* personal read noise vs form noise: sharp */
  readHi:   2.0                   /* players see through it, weak ones add    */
};

function raceGauss(rng){
  let u = 0, v = 0;
  while(u === 0) u = rng();
  while(v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const lerp = (a, b, t) => a + (b - a) * t;
const raceLvl = (arr, lvl) => lerp(arr[0], arr[2], clamp01((lvl - 0) / 2));
function clamp01(x){ return Math.min(1, Math.max(0, x)); }

function raceSoftmax(z){
  const mx = Math.max.apply(null, z);
  const ex = z.map(v => Math.exp(v - mx));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map(e => e / s);
}

/* form display: a 12-segment meter (0..12). One segment = 1/6 strength
   units, so the full bar spans ±2 sd of latent strength — fine enough
   that discretization adds little noise over the form's own, and
   saturation (a 0 or a 12) stays a rare tail event instead of
   systematically compressing extreme reads toward the middle, which
   measured as a flat-model bias that over-credited longshots. */
const FORM_MID = 6;
const FORM_SCALE = 6;
const formFromR = r => Math.round(clampR(FORM_MID + FORM_SCALE * r, 0, 12));
const rFromForm = b => (b - FORM_MID) / FORM_SCALE;
function clampR(v, a, b){ return Math.min(b, Math.max(a, v)); }

/* ---------------- the field ---------------- */
/* Six latent strengths drawn iid; true win probabilities are the softmax
   of s/tau. Players never see s — only the noisy form meter. If the draw
   produces a monster favorite (one minnow at 70-90%+), the strengths are
   shrunk toward the field mean until the race is real again: a 1.2x
   "race" is no race at all, and a payout floor under a monster favorite
   would leak true +EV onto honest boards. rng draw order (tau, sigma,
   strengths, form noise) is fixed, so every seed plays out identically. */
function genRaceField(rng, level){
  const tau = lerp(raceLvl(RACE_PARAMS.tauLo, level), raceLvl(RACE_PARAMS.tauHi, level), rng());
  const sigmaForm = raceLvl(RACE_PARAMS.formSd, level);
  let s = [];
  for(let i = 0; i < RACE_N; i++) s.push(raceGauss(rng) * RACE_PARAMS.sSd);
  let p = raceSoftmax(s.map(v => v / tau));
  let guard = 0;
  while(Math.max.apply(null, p) > RACE_PARAMS.pMaxCap && guard++ < 40){
    s = s.map(v => v * 0.85);
    p = raceSoftmax(s.map(v => v / tau));
  }
  const bars = s.map(si => formFromR(si + raceGauss(rng) * sigmaForm));
  return { true: null, s: s, bars: bars, p: p, tau: +tau.toFixed(4), sigmaForm: +sigmaForm.toFixed(4) };
}

/* ---------------- the book ---------------- */
/* Prices every minnow off its TRUE win probability, then takes a margin:
   implied_i = p_i^shade / c with c set so the implieds sum to the target
   overround. shade < 1 lays extra margin on longshots (their payouts run
   shorter than proportional) — the classic favorite-longshot skew. On a
   share of boards the book then makes exactly one mistake: the favorite
   is priced too generously (a gem) or a longshot is chopped (a trap).
   Honest boards are all -EV by construction — the margin is the house's. */
function priceRaceBook(p, rng, level){
  const shade = RACE_PARAMS.shade;
  const target = lerp(RACE_PARAMS.overLo, RACE_PARAMS.overHi, rng());
  const pw = p.map(v => Math.pow(v, shade));
  const c = pw.reduce((a, b) => a + b, 0) / target;
  let payouts = p.map(v => clampR(c * Math.pow(v, -shade), RACE_PARAMS.payMin, RACE_PARAMS.payMax));

  let misIdx = -1, misDir = null;
  if(rng() < raceLvl(RACE_PARAMS.misRate, level)){
    const fav = p.reduce((bi, v, i, a) => v > a[bi] ? i : bi, 0);
    const ls  = p.reduce((bi, v, i, a) => v < a[bi] ? i : bi, 0);
    if(rng() < 0.5){ misIdx = fav; misDir = 'overlay'; payouts[fav] *= raceLvl(RACE_PARAMS.overlay, level); }
    else           { misIdx = ls;  misDir = 'underlay'; payouts[ls]  *= raceLvl(RACE_PARAMS.underlay, level); }
  }
  payouts = payouts.map(v =>
    +clampR(v * (RACE_PARAMS.jitLo + rng() * (RACE_PARAMS.jitHi - RACE_PARAMS.jitLo)), RACE_PARAMS.payMin, RACE_PARAMS.payMax).toFixed(2));
  return { payouts: payouts, misIdx: misIdx, misDir: misDir, overround: +target.toFixed(4) };
}

/* ---------------- the player model ---------------- */
/* Truth-blind: built only from the form meters the player can see, plus
   the level's known form noise and the difficulty's typical field shape.

   The de-noised bar spread sets the field's shape (spread beyond the
   known noise = real signal). What the player's record buys is a steadier
   eye: everyone reads through the same form noise, but an unproven
   estimator's read carries EXTRA noise on top of the form's own — their
   model wanders, sees edges that aren't there, and misses gems — while a
   sharp record (sigYou, rolling RMS relErr, low) reads almost clean
   through it. Same philosophy as the fusion posterior in the rival-guess
   market: the model trusts the player exactly as far as their history
   has earned. The per-board personal noise draws from the round's seeded
   rng, so a given seed always plays out identically. */
function raceModel(bars, sigYou, sigmaForm, level, rng){
  const r = bars.map(rFromForm);
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const dev = r.map(x => x - m);
  const sdObs = Math.sqrt(dev.reduce((a, d) => a + d * d, 0) / dev.length);
  const sdSig = Math.sqrt(Math.max(0.001, sdObs * sdObs - sigmaForm * sigmaForm));
  const k = sdObs > 1e-9 ? Math.min(1, sdSig / sdObs) : 1;
  const sigRead = sigmaForm * clampR((sigYou || 0.15) / 0.15, RACE_PARAMS.readLo, RACE_PARAMS.readHi);
  const gain = 1 / raceLvl(RACE_PARAMS.tauMid, level);   /* 1 / typical tau */
  return raceSoftmax(dev.map(d => (k * d + raceGauss(rng) * sigRead) * gain));
}

/* ---------------- shared exports (node tests) ---------------- */
if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    RACE_N, RACE_COLORS, RACE_PARAMS, FORM_SCALE,
    formFromR, rFromForm, raceSoftmax, raceGauss,
    genRaceField, priceRaceBook, raceModel
  };
}
