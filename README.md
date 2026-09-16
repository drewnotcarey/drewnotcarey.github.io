# EV Gym

A single-player web app that trains probabilistic reasoning — "thinking in bets" —
by rewarding **decision quality separately from outcome quality**.

Built to the spec in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## Play

Open `index.html` in any modern browser, or serve the folder statically:

```
npx serve .
```

Add `?debug=1` to the URL for the debug panel (ledger JSON/CSV export, full reset,
seed forcing, live EV board inspector).

## What's implemented (MVP)

- **Guess & Bet round** — timed dot-count stimulus, player guess, 4 synthetic bot
  guesses (anchor / over / under / herd / outlier biases), extremity-based pricing
  with favorite/longshot mispricing and jitter, Monte Carlo model probabilities.
- **Process/outcome reward split** — pre-reveal ⚡ SHARP glow + chime for +EV
  decisions; separate, muted outcome celebration; four-cell debrief strings.
- **Sharp Streak** — increments on +EV decisions only; a good bet that loses never
  breaks it.
- **Calibration Ledger** — full record per round in localStorage; Brier score,
  reliability diagram, +EV rate, best-EV rate, estimation error.
- **Calibration Crystal** — ambient skill identity (clarity = rolling Brier).
- 8-round sessions, 3-slide tutorial, difficulty presets, sound/motion toggles,
  PWA offline shell, keyboard-accessible board, reduced-motion support.

## Not yet (deferred by design)

Bank or Push round, Reroll Calculus round, additional stimulus types, difficulty
auto-scaling, hint stripping, accounts/cloud sync. See build plan phase gates.

## Deploy (GitHub Pages)

This repo is a plain static site — no build step. The
[CI workflow](.github/workflows/ci.yml) syntax-checks the JS, then deploys the
whole folder to GitHub Pages via `actions/deploy-pages` on every push to `main`.

```
git add -A
git commit -m "EV Gym update"
git push
```

Live at https://drewnotcarey.github.io/ once the Actions run completes.

## Data & privacy

All game data lives in the player's browser (localStorage, `evgym.*` keys).
No accounts, no tracking, no network calls. Debug panel can export/erase data.
