# Firehouse — Cascade Response

A playable browser prototype for the **Firehouse** cascading slot concept.

## Current build

- 5×4 pay-anywhere cascading grid; 6+ matching symbols pay.
- Seven paying symbols plus Wild, Alarm, and Firestarter.
- Weighted cryptographic RNG wrapper for all money-affecting game selections when `crypto.getRandomValues` is available.
- Separate cosmetic randomness path.
- Cascades, shared Wild evaluation, additive burning-tile multipliers, fire growth, and adjacent fire spread.
- Base boosters:
  - 🚒 **Firetruck** — injects 2–5 Wilds.
  - 🪓 **Fire Axe** — removes low symbols and refills.
  - 💦 **Hose Blast** — clears a random row and refills.
  - 🔥 **Backdraft** — ignites temporary base-game fire and enables Firestarters.
- Alarm bonuses:
  - **3 Alarm:** 8 free spins; fire resets each free spin.
  - **4 Alarm:** 10 free spins; hotter multiplier ladder; fire resets each free spin.
  - **5 Alarm:** 12 free spins; fire persists for the entire bonus.
- CSS/DOM animation layer for cascades, wins, Firetruck, Axe, Hose, Backdraft, alarms, fire, bonus banners, and screen shake.
- Session credits, bets, RTP readout, and spin telemetry.

## Developer menu

The DEV panel can arm **exactly one next paid spin** with:

- RTP development profile: 88 / 92 / 94 / 96 / 98.
- Forced 3-, 4-, or 5-Alarm bonus.
- Any combination of Firetruck, Fire Axe, Hose Blast, and Backdraft.
- 0–8 forced Firestarters.
- Optional seed label for telemetry.

Overrides are consumed when the next spin begins and all DEV inputs reset immediately. Forced events still pass through the same production feature, cascade, fire, and payout evaluators.

The menu also includes a 10,000-spin Monte Carlo development tester. Its result is a sample estimate, **not** a certified theoretical RTP calculation.

## RTP model note

This repository is a game-development prototype, not certified gambling software. RTP selections currently act as development math profiles by adjusting payout scale, premium/wild/alarm frequency factors, and booster frequency around the 96% baseline profile. These profiles must be calibrated with much larger simulations and independently validated before any real-money or regulated use.

## Run locally

No build step is required. Serve the repository with any static web server, for example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Architecture

`index.html` contains the accessible UI shell and `styles.css` contains responsive presentation/animation rules. `js/core.js` owns RNG, math profiles, symbol generation, win evaluation, cascades, and fire rules; `js/dev.js` owns one-shot DEV arming, telemetry, the paytable, and Monte Carlo tooling; `js/game.js` owns the live spin/bonus runtime, boosters, board state, and animations.
