# EV Gym

A single-player web game that trains decision quality under uncertainty —
rewarding **decision quality separately from outcome quality**.

Built to the spec in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## Play

Open `index.html` in any modern browser, or serve the folder statically:

```
npx serve .
```

Add `?debug=1` to the URL for the debug panel (ledger JSON/CSV export, full
reset, seed forcing, live EV board inspector).

## The rounds

- **Guess & Bet** — estimate a hidden quantity (dot count, line length, blob
  area, angle, or a timed glow), then bet on a market of rival guesses priced
  by extremity. The skill is finding the mispriced slot; rival guesses and
  prices are seeded and reproducible.
- **Bank or Push** — grow a pot across dice rolls that can bust it. Every
  bank/push call is scored against a computable one-step EV rule; bust odds
  are only shown while hints are enabled.
- **Reroll Calculus** — five dice, a scoring category, and a clock. Call
  keep-versus-reroll on any subset; exact EVs are enumerated over every
  possibility, and your call is scored against the best play.

## What's tracked

- **Calibration ledger** — every round writes a structured record (localStorage):
  Brier score, reliability diagram, +EV rate, best-EV rate, estimation error.
- **Calibration Crystal** — ambient skill identity; clarity follows your
  rolling Brier score.
- **Edge report** — chosen EV vs. best available EV, best-value rate, longshot
  tendency, per-round-type sharp-call rates.
- **Sharp Streak** — consecutive +EV calls; a good bet that loses never
  breaks it.
- **Hint stripping** — implied probabilities, bust odds, and EV panels fade
  as calibration tightens (Auto difficulty scales stimuli, bust rules, and
  clocks with you).

## Reward design

Two independent channels: a ⚡ SHARP process reward fires the moment a +EV
call is locked (before the reveal); a separate, muted outcome celebration
fires only for wins. No punishing stingers for bad luck on good decisions.
No real money, no purchases, no random-reinforcement tricks.

## Deploy (GitHub Pages)

Plain static site — no build step. The
[CI workflow](.github/workflows/ci.yml) syntax-checks the JS, then deploys the
folder to GitHub Pages via `actions/deploy-pages` on every push to `main`.

Live at https://drewnotcarey.github.io/ once the Actions run completes.

## Data & privacy

All game data lives in the player's browser (localStorage, `evgym.*` keys).
No accounts, no tracking, no network calls. The debug panel can export or
erase everything.
