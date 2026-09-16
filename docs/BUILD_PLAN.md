# EV Gym — Developer Build Plan (v4.0, Launch-Ready)

**Status:** Final consolidated plan for MVP development, GitHub repo setup, and public test launch.
**Supersedes:** v1 build plan, v2 reviewer notes, v3 consolidated draft.
**MVP scope (unchanged from v3):** Client-only web app. One round type — **Guess & Bet** — plus the Calibration Ledger, reward-split feedback, and the calibration surface. Bank or Push and Reroll Calculus remain deferred.

---

## 1. Product Summary

EV Gym is a single-player web game that trains probabilistic reasoning ("thinking in bets") by separating **decision quality** from **outcome quality**.

### The one rule every feature must pass

> **Does this help the player feel rewarded for making a good decision even when the outcome is bad?**

If a feature merely celebrates winning, adds friction, or creates random reinforcement — cut it.

### Core loop (MVP)

1. **Estimate** — brief dot-count stimulus shown, then hidden.
2. **Guess** — player enters a rough numeric guess (slider or keypad).
3. **Market forms** — 4 synthetic guesses generated around the true value; each slot priced.
4. **Choose bet** — player selects one slot + assigns 1–5 confidence chips.
5. **Lock-in** — bet summary shown (slot, payout, market-implied %, confidence).
6. **Process reward** — fires pre-reveal if the selected slot is +EV.
7. **Reveal** — true value, winning slot, outcome reward (muted if −EV win).
8. **Debrief** — plain-language decision-vs-luck explanation; ledger updates.
9. **Calibration surface** — Calibration Crystal + reliability diagram + Sharp Streak update.

**Session default:** 8 rounds (~6–8 min), then session summary. Endless mode optional. Fixed round counts make playtest data comparable.

---

## 2. Target Audience & Constraints

- **Age 12+.** Difficulty parameterized; no separate kids mode.
- **No trivia.** Perceptual estimation only (dot count in MVP).
- **No typed percentages.** Confidence via 1–5 chips (mapped internally to probability bands).
- **No real money, no purchasable currency, no loot boxes, no near-miss engineering, no variable-ratio reward independent of decision quality.**
- **Theme:** gym / lab / crystal. Nothing evocative of a casino. Use "points" for score; avoid "chips" and "casino" vocabulary in UI copy.
- **Accessibility:** WCAG 2.1 AA — keyboard-navigable board, color-independent slot identifiers (icons/labels, not color alone), reduced-motion option, no flashing effects, haptic/visual/audio rewards all redundant.

---

## 3. Reward System (the training mechanism)

### Reward matrix

| Decision | Outcome | Treatment |
|---|---|---|
| +EV | Win | Process + outcome channels both fire. Biggest positive moment. |
| +EV | Lose | **Process reward fires fully; outcome neutral. No loss sting, no red framing.** Most important teaching cell. |
| −EV | Win | Small, muted outcome acknowledgment only; process channel silent; debrief labels it "lucky." |
| −EV | Lose | Everything neutral and low-key. No punishment. |

### Channel specs

| Channel | Timing | Visual | Audio | Haptic (optional) |
|---|---|---|---|---|
| Process (+EV decision) | At lock-in, pre-reveal | Glow/spark on the selected slot + "Sharp" badge | Single clean resonant chime (unique timbre, never reused) | Short single pulse (Android only; degrade gracefully) |
| Outcome (win) | At reveal only | Separate confetti/coin burst, visually distinct from process glow | Fuller cascade sound, muted if −EV win | Longer double pulse |

**Hard rules:** never a negative sound or failure animation for a +EV loss. Never strong celebration of a −EV win. No near-miss effects, ever.

### Sharp Streak

- Increments on every +EV decision; breaks **only** on a −EV decision.
- A +EV decision that loses does **not** break the streak.
- MVP: simple visible counter only. No streak-preserving items or daily-pressure mechanics.
- **Playtest watch-item:** if the pre-reveal +EV glow causes "hunt the glow" behavior (players choosing slots to trigger the cue rather than evaluating odds), randomize/relocate the strong process cue to post-reveal. Log data to detect this (see §9).

---

## 4. Round Specification — Guess & Bet

### 4.1 Stimulus

- Dot cluster rendered on canvas/SVG. Parameterized: `dot_count_range`, `view_time_ms`, `field_size_px`, `dot_overlap_noise`.
- Shown, then hidden. Player estimates the count.
- MVP difficulty presets: Easy (15–40 dots, 3.5s), Medium (25–80 dots, 2.5s), Hard (40–150 dots, 1.5s).

### 4.2 Guess input

- Slider with live numeric readout + coarse keypad alternative. Prototype both; keep whichever tests faster.
- Player guess becomes slot `player_0` on the board.

### 4.3 Synthetic field generation

`field_size = 4` bots in MVP (5 total slots with player's). Given true value `T`:

```
bot_guess = T + noise(skill) + bias_roll
```

MVP bias types (1–2 active per round, chosen randomly):
- **Anchor:** rounds toward a "nice" number (47 → 50).
- **Over/under:** one bot systematically high or low.
- **Outlier:** occasional extreme guess.
- **Herd:** 2+ bots cluster tightly, inflating favorite/longshot imbalance.

Distribution: triangular or normal; `noise(skill)` scales with difficulty.

### 4.4 Winning slot rule (explicit)

- **The guess closest to the true value wins.** Ties: the lower-numbered slot id wins (log tie occurrences; they should be near-zero with integer dot counts and float bot guesses).

### 4.5 Pricing engine — must produce non-repetitive mispricing

**Critical design requirement (v4 fix):** mispricing must be multi-directional. If payout is always monotonic in distance-from-median, players learn "scan the extremes" and stop evaluating.

Implementation:
- Base extremity pricing: `payout = base + normalized_extremity * scalar`, floored/capped (min 1.2×, max 12×).
- **Add favorite/longshot bias with ~30% probability:** the median-clustered slots are priced too generously (making a favorite bet +EV), or an extreme is priced too stingily.
- **Add payout noise:** ±15% random jitter per slot, seeded.
- **Validation gate before ship:** simulate ≥10,000 rounds; the best-EV slot's position index must be approximately uniform across slots. If the best EV is the most-extreme slot >40% of the time, re-tune.

### 4.6 Model probability (p_model)

Monte Carlo posterior — computable and explainable:

```
anchor  = median(all guesses)          // field consensus; player legible
uncertainty = f(difficulty, field_spread)
samples = N=1000 draws from distribution(anchor, uncertainty)
p_model_i = fraction of samples where guess_i is closest to the sample's revealed value
```

Then normalize (Σ p_model_i = 1 across slots).

### 4.7 EV and implied probability

```
implied_prob_i = 1 / payout_i
EV_i = p_model_i * payout_i - 1
selected_EV, best_EV = EV[selected], max(EV)
decision_is_ev_positive = selected_EV > 0
selected_best_ev_slot = (selected == argmax(EV))
```

### 4.8 Confidence chips

| Chips | Internal probability |
|---:|---:|
| 1 | 10% |
| 2 | 30% |
| 3 | 50% |
| 4 | 70% |
| 5 | 90% |

One wager feeds both calibration and score. Playtest watch-item: players will systematically overstate (a 90% chip on a slot that truly wins ~45% of the time). This is the intended calibration lesson — the lock-in screen and debrief must make the market-implied probability visible so the gap is legible, not baffling.

### 4.9 Lock-in screen (reflection, lightweight)

```
BET SUMMARY
Slot:        45
Payout:      5×
Market says: ~20% chance
You said:    70% (4 chips)
[ LOCK IN ]
```

No survey questions in MVP. Optional "advanced" toggle (off by default): explicit "+EV? Yes/No/Not sure" — logs `reflection_response`, do not gate progression on it.

### 4.10 Debrief strings

| Cell | Text |
|---|---|
| +EV / Win | "Sharp decision and good result. You found value." |
| +EV / Lose | "Sharp decision, unlucky result. This bet was worth making." + streak continues |
| −EV / Win | "You won, but the odds weren't in your favor. That was luck." (muted celebration) |
| −EV / Lose | "This bet wasn't +EV. Focus on the decision, not the result." (neutral) |

Optional "Why?" detail panel: stated confidence, market implied, model chance, EV, best available EV, outcome.

---

## 5. Calibration Ledger

### 5.1 Record schema (one per round)

```json
{
  "session_id": "uuid",
  "round_id": "uuid",
  "round_index": 3,
  "round_type": "guess_and_bet",
  "stimulus_type": "dot_count",
  "seed": 123456,
  "difficulty": { "preset": "medium", "dot_count": 47, "view_time_ms": 2500, "field_size": 5 },
  "true_value": 47,
  "player_guess": 44,
  "slots": [
    { "id": "player_0", "guess": 44, "payout": 3.5, "p_model": 0.31, "implied_prob": 0.286, "ev": 0.085, "is_winner": false }
  ],
  "selected_slot": "bot_2",
  "confidence_chips": 4,
  "stated_probability": 0.70,
  "selected_ev": 0.47,
  "best_ev": 0.55,
  "selected_best_ev_slot": false,
  "decision_is_ev_positive": true,
  "best_ev_slot_position": 2,
  "outcome": 0,
  "brier_component": 0.09,
  "absolute_guess_error": 3,
  "relative_guess_error": 0.064,
  "reflection_response": null,
  "process_reward_fired": true,
  "outcome_reward_fired": false,
  "timestamp": "2026-09-15T19:56:00-04:00"
}
```

### 5.2 Derived metrics

- **Brier** per round + rolling average; overall calibration trend.
- **Reliability buckets:** stated probability (5 chip bands) vs. actual hit rate.
- **Edge metrics:** avg selected EV, best-EV selection rate, +EV decision rate, avg (selected_EV − best_EV).
- **Behavior metrics:** favorite-vs-longshot selection tendency, confidence after wins/losses, post-+EV-loss continuation rate.
- **Anti-gaming metric:** correlation between process-glow slot and best-EV slot over time (detect "hunt the glow").

---

## 6. Calibration Surface

1. **Calibration Crystal (primary):** ambient object whose clarity/brightness maps to rolling Brier improvement. States: cloudy → stabilizing → clear → resonant. Must visibly change within a single 8-round session for early positive feedback.
2. **Reliability diagram (secondary):** chip-band stated confidence (x) vs. actual hit rate (y), diagonal reference, plain-language caption ("When you bet High, you're right 62% of the time").
3. **Session summary (end of 8 rounds):** rounds played, +EV decision rate, best-EV finds, Sharp Streak, Brier delta, one plain-language insight.
4. **Edge report:** deferred post-MVP.

---

## 7. Technical Specification

### 7.1 Stack

- **Vite + React 18 + TypeScript** (strict).
- **State:** React context or zustand for ephemeral round state; no global-store over-engineering.
- **Persistence:** IndexedDB via **Dexie.js** for the ledger; localStorage for settings/streaks. All storage access behind a `storage.ts` data layer — never scattered in components.
- **RNG:** seeded PRNG (mulberry32 or similar) — `rng.ts` used by stimulus, field, and pricing generators; seed stored per round for full replay/debug.
- **Styling:** plain CSS (or Tailwind if preferred) — no UI component library; custom look required for the reward animations.
- **Charts:** lightweight SVG hand-rolled or `d3-shape` only; no heavy chart lib.
- **Audio:** Web Audio API-generated chimes (no asset files needed) or 2 small licensed CC0 files.
- **PWA:** service worker + manifest so playtest installs behave consistently offline.

### 7.2 Repo structure

```
ev-gym/
  index.html
  package.json
  vite.config.ts
  public/
    manifest.webmanifest
    sw.js
  src/
    main.tsx
    App.tsx
    rng.ts                 // seeded PRNG
    storage.ts             // Dexie data layer
    game/
      stimulus.ts          // dot-count generator
      field.ts             // synthetic guesses + biases
      pricing.ts           // odds engine + mispricing validation
      model.ts             // Monte Carlo p_model
      ev.ts                // EV / implied prob / metrics
      rounds.ts            // round state machine
    rewards/
      process.ts           // process reward (visual/audio/haptic)
      outcome.ts           // outcome reward
      streak.ts            // Sharp Streak logic
    ledger/
      schema.ts            // types + validation (zod)
      ledger.ts            // write/read, aggregations
      metrics.ts           // Brier, reliability, edge
    ui/
      Stimulus.tsx
      GuessInput.tsx
      OddsBoard.tsx
      LockIn.tsx
      Reveal.tsx
      Debrief.tsx
      Crystal.tsx
      ReliabilityChart.tsx
      SessionSummary.tsx
    debug/
      AdminPanel.tsx       // seeded scenario replay, ledger export/reset
  tests/
    pricing.test.ts        // includes best-EV-slot uniformity gate
    ev.test.ts
    ledger.test.ts
    streak.test.ts
    model.test.ts
  docs/
    BUILD_PLAN.md          // this file
    PLAYTEST_GUIDE.md
  .github/workflows/ci.yml
```

### 7.3 State model

**Ephemeral:** `round_state` (idle → stimulus → guess → board → locked → revealed → debrief), `current_difficulty`, `sharp_streak`, `session_id`, `round_index`.

**Persistent:** `ledger_records`, `calibration_summary` (denormalized aggregates), `settings` (sound, motion, difficulty), `best_streaks`, `analytics_opt_in`.

### 7.4 Debug/admin panel (dev-only, `?debug=1`)

- Seeded scenario replay (replay any round by seed).
- Fast-forward / skip-to-reveal.
- Ledger export (JSON **and** CSV) and full reset.
- Live EV board inspector (all slots' p_model, EV, best-EV position).
- Pricing validation report (best-EV uniformity histogram).

---

## 8. Testing Plan

### 8.1 Automated (CI gate)

- **Unit:** EV/implied-prob math; chip→probability mapping; streak logic (+EV loss doesn't break; −EV decision does); ledger schema validation.
- **Pricing gate (blocking):** simulation test asserting best-EV slot position distribution is approximately uniform (no slot position >40% frequency over 10k seeded rounds).
- **Integration:** full round state-machine walk (estimate → lock → process reward fires pre-reveal → reveal → debrief → ledger row written → aggregates updated).
- **Persistence:** reload mid-session; ledger intact.
- **CI:** GitHub Actions — `typecheck`, `lint`, `test`, `build` on every PR to `main`.

### 8.2 Manual playtest checklist

- [ ] +EV loss: process reward fires, no negative cues, streak increments, debrief correct.
- [ ] −EV win: muted celebration, no process cue, debrief labels luck.
- [ ] Crystal visibly changes within one session.
- [ ] Odds board legible on 360px wide screen; keyboard-only playable.
- [ ] Lock-in screen shows market-implied vs. stated confidence.
- [ ] Sound off / reduced motion respected.
- [ ] Debug panel exports ledger CSV.

---

## 9. Validation Metrics (test launch)

**Learning KPIs (primary — from exported ledgers):**
- Brier improvement over first 50 rounds.
- +EV decision rate and best-EV selection rate trend upward.
- Overconfidence gap (stated − actual in top buckets) shrinks.
- Post-+EV-loss continuation rate (do players keep betting after a well-played loss?).

**Usability KPIs:**
- Time to first completed bet < 90s for a new player.
- Drop-off points per step (guess input, board, lock-in).
- Debrief comprehension probe after round 3 ("Was your last bet a good decision? Why?").

**Engagement KPIs:**
- Rounds/session, session completion (8 rounds), return rate.
- **Telemetry:** privacy-preserving, cookieless (self-hosted Umami or Plausible) behind explicit opt-in; otherwise local event log with export. No third-party trackers, no fingerprinting.

**Launch-go gate (before building any deferred phase):**
≥60% of playtesters (n≥15) can correctly identify a +EV loss as "good decision, bad luck" by session end, AND average +EV decision rate increases across a player's first 3 sessions.

---

## 10. Build Phases & Acceptance Criteria

| Phase | Deliverables | Acceptance criteria |
|---|---|---|
| **0. Foundation** | Repo, CI, seeded RNG, Dexie ledger, zod schema, dummy round writer, Brier/reliability aggregation, debug panel | Every round writes a valid record; metrics survive reload; CI green |
| **1. Core loop** | Stimulus, guess input, field gen, pricing, odds board, chips, lock-in, process/outcome rewards, reveal, debrief | Full round playable; reward matrix behaves per §3 for all 4 cells; ledger complete |
| **2. Calibration surface** | Crystal, reliability chart, session summary, Sharp Streak | Crystal changes within one session; chart plain-language captioned |
| **3. Onboarding & reflection** | 3-slide tutorial (process vs. outcome, one guided example round), lock-in summary, debrief strings, settings (sound/motion) | New player completes first bet unaided; tutorial ≤60s |
| **4. Test launch** | PWA, analytics opt-in, PLAYTEST_GUIDE.md, GitHub Pages/Netlify deploy | Deployed public URL; playtest kit functional; launch-go gate measurable |

**Deferred (post-validation only):** Bank or Push, Reroll Calculus, new stimulus types (length/area/duration/angle), difficulty auto-scaling, hint stripping, edge report, accounts/cloud sync, cosmetics.

---

## 11. Deployment

- **Hosting:** GitHub Pages (repo-native) or Netlify/Vercel free tier. Static build only — `npm run build` → `dist/`.
- **Custom domain optional; HTTPS required (PWA + audio autoplay policies).**
- **Branch model:** `main` (protected, deploys) ← PRs with CI green.
- **Versioning:** semver from v1.0.0 at public test launch; tag releases.

---

## 12. Open Questions for Playtesting

1. Slider vs. keypad for guess entry (speed/friction).
2. Payout multiplier vs. implied % as primary odds display (payout first; implied at lock-in — confirm).
3. Whether 5 chips gives enough resolution for a meaningful reliability diagram (if not, move to a 6th "near-certain" band).
4. Whether the pre-reveal process glow induces glow-hunting (per §3 watch-item; use `best_ev_slot_position` + selection logs to detect).
5. Optimal session length (8 default; test 6 vs. 10).

---

## 13. Final Design Principle (unchanged)

Every feature is tested against:

> **Does this help the player feel rewarded for making a good decision even when the outcome is bad?**

Keep what passes. Cut what doesn't.

---

*v4.0 — consolidated from v1 plan, v2 reviewer notes, v3 draft, and v4 engineering review (Sept 15, 2026).*
