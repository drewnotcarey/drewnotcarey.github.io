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
  RMS of relative error), blended with the field's consensus. The briefing
  says it up front: this is a market game, not a test of accuracy — the skill
  is reading and playing the market, and rewards follow the decision, not the
  outcome. The board reads as a number line twice over: the whole field is
  plotted across the top at true relative spacing (a one-shot view of the
  market spread — every label tethered to its dot by a leader line that
  follows the label, so a crowded, shifted tag can never be mistaken for a
  neighbor's; selecting a bet lights its dot and tether along with the
  button), and the slots below sit sorted low to high with the gap
  between neighbors marked (tight gaps highlighted), so a guess
  boxed in by close rivals — and the thin slice of outcome-space it owns —
  is visible at a glance. Every value in the market — the hidden truth,
  your estimate, and all six rival guesses — lands on the same
  round-number grid your slider snaps to (multiples of 5 for blob area,
  25 ms for glow duration, whole numbers otherwise), so what the board
  displays is exactly what each bet is; exact ties can happen, split the
  win, and fan apart as separate dots on the line. Rival guesses and
  prices are seeded and reproducible.
  A sixth proposition type, the **Minnow Race**, deals a field of six
  colored minnows instead of a perceptual stimulus: each carries a noisy
  form meter (a 0–12 reading of latent strength), shown paddock-style
  *before* the odds drop so the read forms before the market anchors it.
  True win probabilities come from a softmax over latent strengths; the
  book prices them with a realistic overround and longshot shading, and a
  share of boards (40/35/30% by difficulty) carries exactly one deliberate
  mistake — a favorite overlaid (a gem) or a longshot chopped (a trap).
  The player model is truth-blind: it reads only the form meters,
  de-noised against the level's known form noise, and steadied by the
  player's measured accuracy — an unproven eye adds noise, a proven one
  reads nearly clean through it. The reveal pins every minnow's true
  chance (colored dot) against its market-implied chance (diamond) on one
  strip — the horizontal gap between a fish's two marks is its
  mispricing, the whole game in one picture. Race rounds log the same
  ledger fields as any market round plus a compact race block
  (mispricing, winner, true probabilities, model reads, payouts); the
  Guess & Bet card on the home screen carries a **Minnow Race only**
  switch — off (the default), races join the stimulus rotation at their
  natural share; on, every market round is a race.
- **Keep or Roll** — a duel against the Tide. You and the Tide each build a
  pot across dice rolls that can bust it; the Tide follows one fixed,
  visible policy (roll below 15, keep at 15 or above) under the same bust
  rule you face. Goal: finish with a higher kept pot than the Tide —
  ties go to the Tide. Every keep/roll call is scored against the true
  multi-roll win probability of beating the Tide — both pots, both bust
  risks, the Tide's known policy, and the freedom to keep rolling are all
  priced in, with the roll number assuming sharp follow-through; with hints
  on, the panel shows your win % for keeping vs rolling.
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
lucky −EV wins. A −EV call that nevertheless works out is **neutral** —
no reward, no streak break; only a −EV call that loses breaks the Sharp
Streak. No real money, no purchases, no random-reinforcement
tricks.

The process reward is tiered: any +EV call gets the teal ⚡ SHARP treatment,
while a call that was also the **best value available** (highest-EV slot,
exact best keep/reroll split) escalates to a gold ⚡⚡ SHARP — BEST VALUE
toast, a rising chime arpeggio, and a gold glow. Streak counts of 3+ append
to the toast. Every Sharp reward also breathes a brief screen-edge flash
(teal — gold for best-value), so the moment lands even on devices with
no haptics at all, like every iOS browser. Reveals lead with the
best-EV slot on the board (what the round actually scores), then show
the true value, then the field with badge pills, an at-a-glance EV
comparison bar (your call vs the best on the board), and debriefs that
quote the edge in numbers (your price vs the market's).

**Haptics** (Vibration API, where supported): the header toggle (📳) carries
a test buzz on enable so you can confirm your device responds. Patterns are
longer than a bare tick so they can actually be felt — a crisp double-tap
the instant a +EV call is locked, an escalating triple for gold best-value
calls, and a slow ceremonial pulse for rare rank-ups. Haptics never attach
to outcome wins or losses. No iOS browser can vibrate — Apple requires
Chrome, Firefox, Edge and Safari on iOS to run its WebKit engine, which
has no Vibration API — so there the button stays dimmed (with a tooltip
explaining why) and the game leans on visuals + audio.

**Rank-up** is its own moment: a rising school of light particles, a deep
rising tone, the slow haptic pulse, and one line of flavor.

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
  breaks it, and a lucky −EV win is neutral (only a −EV call that loses
  breaks it).
- **Hint stripping** — per-slot edge indicators (model vs implied chance,
  green +EV / red −EV), bust odds, and EV panels fade as calibration
  tightens (Auto difficulty scales stimuli, bust rules, and clocks with
  you). Every Guess & Bet reveal names the best-value slot, whether or not
  you picked it, then pins the true value in gold on a compact number-line
  strip of the market's spread — gray dots for the field, teal for the
  best-value slot, a white ring for your pick — so where reality landed
  reads at a glance.

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
