# School of Thought

A single-player web game that trains decision quality under uncertainty —
rewarding **decision quality separately from outcome quality**. You are a
school of one: the rank you hold grows with how well you think, never with
how lucky you get.

Built to the spec in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## Play

Open `index.html` in any modern browser, or serve the folder statically:

```
npx serve .
```

Add `?debug=1` to the URL for the debug panel (ledger JSON/CSV export, full
reset, seed forcing, live EV board inspector).

## The rounds

Every round opens with a **briefing screen**: the exact rules for that round
(what counts as a bust roll, how the category scores, the clock length), with
a Start button. Nothing is timed until the player presses Start — the round
reveals and its clock begins at that moment. Full rules auto-expand the first
time a round type appears in a session; after that they collapse behind one
tap.

- **Guess & Bet** — estimate a hidden quantity (dot count, line length, blob
  area, angle, or a timed glow), then bet on a market of six rival guesses
  priced like a real book: calibrated win-probability odds with a margin and
  longshot shading, plus occasional huntable mispricings. The EV model is a
  fusion posterior — your estimate weighted by your measured accuracy (rolling
  RMS of relative error), blended with the field's consensus. The skill is
  finding the mispriced slot; rival guesses and prices are seeded and
  reproducible.
- **Bank or Push** — grow a pot across dice rolls that can bust it. The
  briefing defines this round's bust rule (e.g. "any die showing a 1", or
  "any 1, or any double" at higher difficulty) with its exact per-roll odds.
  Every bank/push call is scored against a computable one-step EV rule.
- **Five Dice Roll** — five dice, a scoring category, and a clock. The
  briefing spells out how the category scores and how long the clock runs
  before the hand is dealt. Call keep-versus-reroll on any subset; exact EVs
  are enumerated over every possibility, and your call is scored against the
  best play. Every generated hand carries a real decision — a clear chase or
  a made hand worth protecting; Random hands (a pure sum) must show a clear
  chase, since protecting a high Random hand is a non-decision.

## Theme: the school

The visual world is deep water — dark blue gradients, cards like dim
surfaces, and a very slow ambient particle current drifting behind the board
(never competing with the decision elements; it pauses with the motion
toggle and respects reduced-motion).

**Ranks — Minnow, Shark, Whale.** Progression is driven only by decision
quality, never by win rate or rounds played:

- **Shark** — rolling Brier ≤ 0.160 over the last 10+ scored rounds and a
  best Sharp Streak of 5+.
- **Whale** — rolling Brier ≤ 0.100 over the last 20+ scored rounds and a
  best Sharp Streak of 10+.

Ranks never demote. The badge sits in the top HUD beside the Sharp Streak
and the calibration crystal; hover it to see exactly what the next rank
needs. The **crystal remains the primary calibration identity** — it
clarifies (sharper facet lines, stronger internal light) as the rolling
Brier score improves. Rank badges are low-poly aquatic cutouts (minnow,
shark, whale-shield) in the deep-water teal palette — the same art family
as the whale brand mark in the header; the rank badge is secondary to the
crystal, and rank flavor
text appears only on rank-up (e.g. "You move with the school now.").

## Reward design

Two independent channels: a ⚡ SHARP process reward fires the moment a +EV
call is locked (before the reveal); a separate, softer outcome celebration
(a rising particle cascade) fires only for clean wins. No punishing
stingers for bad luck on good decisions, and no celebratory effects for
lucky −EV wins. No real money, no purchases, no random-reinforcement
tricks.

The process reward is tiered: any +EV call gets the teal ⚡ SHARP treatment,
while a call that was also the **best value available** (highest-EV slot,
exact best keep/reroll split) escalates to a gold ⚡⚡ SHARP — BEST VALUE
toast, a rising chime arpeggio, and a gold glow. Streak counts of 3+ append
to the toast. Reveals carry badge pills, an at-a-glance EV comparison bar
(your call vs the best on the board), and debriefs that quote the edge in
numbers (your price vs the market's).

**Haptics** (Vibration API, where supported — iOS Safari and other
unsupported browsers degrade gracefully to visual + audio): a short single
pulse (~15 ms) the instant a +EV call is locked, and a triple pulse for
rare rank-ups. Haptics never attach to outcome wins or losses.

**Rank-up** is its own moment: a rising school of light particles, a deep
rising tone, the triple pulse, and one line of flavor.

## What's tracked

- **Calibration ledger** — every round writes a structured record (localStorage):
  Brier score, reliability diagram, +EV rate, best-EV rate, estimation error.
- **Calibration Crystal** — ambient skill identity; clarity follows your
  rolling Brier score.
- **Rank** — Minnow / Shark / Whale, earned through calibration + streaks
  (see above), persisted in localStorage, never demoted.
- **Edge report** — chosen EV vs. best available EV, best-value rate, longshot
  tendency, per-round-type sharp-call rates.
- **Sharp Streak** — consecutive +EV calls; a good bet that loses never
  breaks it.
- **Hint stripping** — per-slot edge indicators (model vs implied chance,
  green +EV / red −EV), bust odds, and EV panels fade as calibration
  tightens (Auto difficulty scales stimuli, bust rules, and clocks with
  you). Every Guess & Bet reveal names the best-value slot, whether or not
  you picked it.

## Deploy (GitHub Pages)

Plain static site — no build step. The
[CI workflow](.github/workflows/ci.yml) syntax-checks the JS, then deploys the
folder to GitHub Pages via `actions/deploy-pages` on every push to `main`.

Live at https://drewnotcarey.github.io/ once the Actions run completes.

## Data & privacy

All game data lives in the player's browser (localStorage, `evgym.*` keys —
kept from the previous name so returning players keep their ledger, streaks,
and ranks). No accounts, no tracking, no network calls. The debug panel can
export or erase everything.
