# School of Thought — design document

A single-player web game for training decision quality under uncertainty.
This document is the self-contained spec for the game as built.

---

## 1. Purpose

School of Thought trains one mental habit above all others:

> **Judge a decision by its expected value and process, not by how it happened to turn out.**

A good call can lose (bad luck). A bad call can win (good luck). Players who
conflate the two never learn to trust — or fix — their own judgment. Every
mechanic below exists to make that separation felt, not just understood.

The game's core deliverable is not the rounds themselves but a **calibration
ledger**: a private, on-device record of every decision, stated confidence,
and outcome, from which long-run skill metrics are derived.

---

## 2. Skills trained (kept separate on purpose)

1. **Calibration** — when you say 70%, are you right about 70% of the time?
   Measured with Brier scores and reliability diagrams.
2. **Value-finding** — can you spot when a price is better than the true odds?
   Measured as chosen-EV vs. best-available-EV (edge).
3. **Process/outcome separation** — can you keep making +EV calls after losses?
   Reinforced by the reward system and the Sharp Streak.
4. **Live risk reading** — estimating bust odds while a pot is on the table.
   Trained by the Bank or Push round.

---

## 3. Round types

### 3.1 Catch the Value (market round)

1. A hidden quantity is shown briefly, then hidden. Five stimulus variants:
   dot count, line length (against a labeled reference), blob area (against a
   labeled reference square), angle, and a timed glow.
2. The player enters a guess on a slider.
3. The app generates 6 rival guesses from a noise distribution around the true
   value, with occasional structure: anchor-to-round-numbers, over/under bias,
   herding, outliers, and compression/stretch around the field median.
4. Every guess (including the player's) becomes a slot. The book prices each
   slot from an exchangeable market posterior (all guesses weighed equally,
   1000 Monte Carlo samples; win = closest guess), converting win probability
   to odds with a margin and longshot shading — payout ≈ 0.87 · p⁻⁰·⁸³,
   clamped to [1.15, 15]. 35% of boards carry a deliberate mispricing (a
   favorite priced too generously, or a chopped longshot) for value hunters.
   Rival guesses and prices are computed on a seeded RNG so rounds are
   reproducible. The board displays a market-spread plot across the top —
   every guess pinned at its true relative position on one axis (dot at the
   exact proportional spot; identity + value pills alternate above/below and
   nudge sideways only as far as a two-pass min-gap needs to stay legible) —
   followed by slots sorted low → high in a single
   column, with the gap between adjacent guesses labeled (tight gaps
   highlighted red; threshold gap ≤ max(1, range × 0.12)) — the crowding
   that thins a slot's claimable outcome-space is shown, not just priced.
   The plot and sorting are presentational: slots keep their original array
   indices, which selection, best-value tracking, and the ledger all key
   off. The reveal recap uses the same sorted order.
5. The player picks one slot and stakes 1–5 confidence chips
   (internally 10/30/50/70/90%). The chip count is both the wager and the
   stated probability for calibration.
6. A lock-in summary shows payout, market-implied chance, and stated
   confidence side by side.
7. Model probabilities come from a fusion posterior: the player's estimate
   weighted by their measured accuracy (rolling RMS of relative error over the
   last 8 guess rounds; 0.15 default for newcomers, clamped to [0.04, 0.35])
   blended with the rival field's median weighted by its observed spread
   (precision-weighted Normal; win = closest guess, 1000 samples). Truth-blind
   — built only from board-visible information. Slot EV = model probability ×
   payout − 1. A consistently accurate player's own slot trends +EV; a noisy
   player's does not — the market's trust is earned.
8. If the chosen slot is +EV, the process reward fires **before the reveal**.
9. Reveal shows the true value, the winning slot, and a four-cell debrief
   (+EV/−EV × win/loss), each with its own plain-language framing.

### 3.2 Bank or Push (push-your-luck round)

- Two dice per roll; the sum is added to the pot.
- Bust rules by difficulty: **any die showing 1** (bust probability 11/36) or,
  at higher difficulty, **any 1 or any double** (16/36). A safe roll averages
  about +8 either way.
- After every safe roll the player calls **bank** (lock the pot) or **push**
  (roll again).
- Decision scoring uses a one-step EV rule: pushing at pot P is +EV while
  P(bust) × P < P(safe) × gain — i.e. keep pushing below the threshold
  (19 for the any-1 rule, 10 for the any-1-or-double rule), bank at or above.
- Every call is logged; the bust probability is shown only while hints are
  enabled, so the arithmetic must eventually be done in the head.
- The round ends on a bank or a bust. Busting after all-sharp calls gets the
  "well-played, unlucky" framing, never a punishing sting.

### 3.3 Five Dice Roll (keep-vs-reroll round)

- Five dice and a scoring category from an original dice family: number sums
  (Ones–Sixes), Three/Four of a Kind (sum of all dice), Full House (25),
  Run of Four/Run of Five (30/40), Random (sum).
- Situations are generated until they contain a real decision: either clear
  upside to chase (best-subset EV at least 1.5 points above the current
  score) or a made hand worth protecting (≥ 80% of category max with no
  upside). Random (a pure sum) is exempt from the made-hand case — a high
  Random hand has no reroll tension, so those hands require a clear chase
  (best-subset EV at least 2.0 points above the current score).
- The player taps dice to mark any subset for reroll (or keeps all), rates
  confidence that the call beats the alternative, and locks in — on a clock
  (30/22/12 s by difficulty). Timeouts auto-keep and are logged as such.
- Exact expected scores are computed by enumerating all 6^k outcomes for each
  of the 32 keep/reroll subsets. A call is **sharp** when its EV is within
  0.5 points of the best subset's EV; edge = chosen EV − best EV.
- With hints enabled, the panel shows the expected score of the currently
  marked subset (not the answer), building fluency against the clock.
- Confidence resolves against a realized counterfactual: if the player kept,
  the best alternative is shadow-rolled; if the player rerolled, the kept
  score is the alternative.

---

## 4. Reward system

Two independent channels, fired at different times:

- **Process reward** — fires the instant a +EV call is locked, before any
  reveal. A single clean chime with its own timbre, a glow on the decision
  element, and the ⚡ SHARP toast. This is the training signal.
- **Outcome reward** — fires at reveal only, and only for wins. Confetti and
  a fuller sound, muted when the win came from a −EV call.

| Decision | Outcome | Treatment |
|---|---|---|
| +EV | Win | Both channels together — the biggest moment |
| +EV | Lose | Process channel fires fully; outcome stays neutral. The most important cell |
| −EV | Win | Muted outcome reward only; process channel silent |
| −EV | Lose | Everything neutral — no punishing stingers, ever |

**Sharp Streak** counts consecutive +EV calls and breaks only on a −EV call.
A good bet that loses does not touch it. Since a bet is mandatory, the best
pick on a board with no +EV slot at all is neutral too, win or lose — the
streak judges decisions, and sometimes no good decision exists. This is the
retention hook, and it is deliberately keyed to the correct signal.

**Ethical guardrails:** no real money, no purchases, no near-miss engineering,
no random reinforcement unrelated to decision quality, no dark patterns. The
chips are abstract scoring tokens.

---

## 5. Calibration ledger

Every round writes one record (client-side localStorage, `evgym.*` keys).

Catch the Value records carry: stimulus type, difficulty/level, true value,
player guess, selected slot, payout, implied probability, model probability,
selected EV, best EV, +EV flag, best-slot flag, chips, stated probability,
outcome, Brier component, absolute/relative error.

Bank or Push records carry: bust rule and threshold, per-round decision count,
+EV decision count, busted flag, banked amount.

Reroll records carry: category, hand, kept/rerolled count, chosen EV, best EV,
best-subset size, sharp flag, timeout flag, chips/stated (null on timeout),
outcome, Brier, final and alternative scores.

Derived surfaces:

- **Brier score** over time (lower is better).
- **Reliability diagram** — stated confidence vs. observed hit rate by
  confidence bucket, with overconfidence highlighted.
- **Calibration Crystal** — an ambient visual whose clarity tracks rolling
  Brier score; the game-like identity of long-run skill.
- **Edge report** — average chosen EV vs. average best EV, best-value rate,
  longshot tendency (average implied chance of chosen slots), per-round-type
  sharp-call rates.

---

## 6. Difficulty and hints

- Manual difficulty: Easy / Medium / Hard map to a continuous skill level
  (0.3 / 1.0 / 1.8) that parameterizes stimulus ranges, noise, viewing time,
  bust rules, and decision clocks.
- **Auto difficulty** adapts per round type: sharp-call rate above 75% (over
  the last 8 rounds) or rolling Brier below 0.16 raises the level; rates below
  45% or Brier above 0.30 lower it.
- **Hint stripping**: hints (implied probabilities on the board, bust odds,
  reroll EV panels) default to Auto — visible early, then fading once that
  round type's rolling Brier crosses its threshold. Always on/off overrides
  exist.

---

## 7. Technical shape

- Plain HTML/CSS/JS, no build step, static hosting. Four scripts:
  `app.js` (core loop, rewards, ledger, tutorial), `rounds-guess.js`,
  `rounds-dice.js`, `stats.js` (calibration surfaces).
- Seeded RNG (mulberry32) per round for reproducible playtesting; a debug
  panel (`?debug=1`) exports the ledger as JSON/CSV and inspects live EVs.
- PWA offline shell via service worker; all data stays on the player's
  device. No accounts, no tracking, no network calls.

---

## 8. Final design rule

Every feature is tested against one question:

> **Does this help the player feel rewarded for a good decision even when the
> outcome is bad?**

If yes, keep it. If it merely celebrates winning, adds friction, or creates
random reinforcement, cut it.
