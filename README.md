# Firehouse v0.3.0

Firehouse is a 7×7 firefighter-themed cluster/cascade slot prototype built as a browser game.

The current build includes the base cascade game, 3/4/5-Alarm Free Spins, symbol-based Burning and Smouldering multipliers, simultaneous Fire Spread, Spray / downward water, Backdraft, persistent 5-Alarm Fire Wild progression, rare base-game Fire teasers, tiered win presentation, and a development QA console.

> **Development prototype:** this repository is not certified gambling software. The current configured 96% value is a nominal development target for the baseline math profile. Full-game theoretical RTP has not yet been recalibrated or certified after the Fire, bonus, and rare base-feature systems were added.

## Play

GitHub Pages:

https://15dfowler15-bot.github.io/Firehouse/

No build step is required locally:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Core game

- 7×7 board / 49 symbols.
- A win requires **8 or more matching paying symbols connected orthogonally**.
- Diagonal-only contact does not connect a cluster.
- Wild substitutes for paying symbols; Wild-only groups do not pay.
- All winning symbols clear together.
- Surviving symbols fall vertically.
- RNG replacements enter from the top.
- Cascades continue until no qualifying cluster remains.
- Bonus/Alarm symbols do not participate in normal paying clusters.

## Paytable

Pays are multiples of total bet.

| Symbol | 8–9 | 10–11 | 12–14 | 15–19 | 20–24 | 25+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Fire Extinguisher | 0.10× | 0.15× | 0.25× | 0.40× | 0.75× | 1.50× |
| Fire Helmet | 0.12× | 0.20× | 0.30× | 0.50× | 1.00× | 2.00× |
| Fire Axe | 0.15× | 0.25× | 0.40× | 0.65× | 1.25× | 2.50× |
| Fire Hydrant | 0.20× | 0.30× | 0.50× | 0.80× | 1.50× | 3.00× |
| Turnout Suit | 0.25× | 0.40× | 0.65× | 1.00× | 2.00× | 4.00× |
| Fire Radio | 0.30× | 0.50× | 0.80× | 1.25× | 2.50× | 5.00× |
| Dalmatian | 0.50× | 0.75× | 1.25× | 2.00× | 4.00× | 8.00× |
| Chief Badge | 0.75× | 1.25× | 2.00× | 3.50× | 7.00× | 15.00× |
| Wild | substitutes | substitutes | substitutes | substitutes | substitutes | substitutes |

## Fire system

Fire belongs to the **symbol**, not the board coordinate.

During cascades:
- Burning / Smouldering state and multiplier move with surviving symbols.
- If a fire-affected symbol is removed in a win, its fire state and multiplier are destroyed.
- Newly spawned symbols begin Normal with no multiplier.

### Ignition

A newly ignited Normal symbol becomes:

**Burning 2×**

### Fire Spread

Spread probability is rolled once for a spread event.

If the event succeeds:
- every Burning symbol present at the start of that event spreads;
- each source ignites every eligible orthogonally touching non-Burning symbol;
- newly ignited symbols do not recursively spread during that same event.

Normal targets become Burning 2×.

A Smouldering target reignites as Burning at its existing multiplier without doubling.

### Additive win multipliers

Fire multipliers participating in one winning cluster are **added**, not multiplied.

Example:

```
2× + 4× + 8× = 14×
```

That winning cluster uses its normal paytable award × 14.

A cluster containing no fire multiplier uses its ordinary 1× base award.

## Spray / Smouldering / Backdraft

Spray selects one horizontal row.

Water:
1. blasts across that row;
2. drips downward;
3. affects the selected row and every row beneath it.

Every Burning symbol hit by water:
- becomes Smouldering;
- doubles its multiplier.

Example:

```
Burning 8×
→ Spray
Smouldering 16×
```

Backdraft is checked **only after Spray**.

Backdraft is eligible when at least one surviving Burning symbol is orthogonally touching at least one Smouldering symbol.

If eligible:
- every current Smouldering symbol doubles again;
- every current Smouldering symbol becomes Burning;
- surviving Burning symbols do not receive that Backdraft doubling;
- a normal Fire Spread opportunity may follow.

## Alarm bonuses

### 3-Alarm

- 5 Free Spins.
- Fire may ignite and spread.
- No between-spin fire persistence.

### 4-Alarm

- 7 Free Spins.
- Fire starts each round.
- Spray is a core end-of-round mechanic.
- Each spin is a self-contained fire event; no between-spin fire persistence.

### 5-Alarm

- 10 Free Spins.
- Full Fire system.
- Fresh ignition each spin.
- Spray / Smouldering / Backdraft.
- Persistent Fire Wild progression.

At the end of each resolved 5-Alarm spin:

1. Normal symbols visually fall away.
2. Surviving Burning and Smouldering symbols remain.
3. Fire survivors converge toward the surviving fire symbol nearest the board center.
4. Their multiplier values are combined into one Fire Wild.
5. The resulting Fire Wild multiplier is the **straight sum of every surviving fire multiplier**.
6. There is currently **no Fire-Wild symbol multiplier cap**.
7. If at least one collected survivor is Burning, the resulting Wild is Burning; otherwise it is Smouldering.
8. The forged Fire Wild drops to the bottom cell of the same column and stays there through the round transition.

The following free spin generates a completely fresh board. The stored Fire Wild then enters on a new eligible position, and at least one separate fresh Burning 2× symbol is created.

The Fire Wild is a real Wild and receives no immunity. It can participate in wins, move in cascades, spread fire while Burning, become Smouldering from Spray, be doubled/reignited by Backdraft, or be removed and lost in a winning cascade.

## Rare base-game Fire

The base game contains rare Fire teaser events.

The feature class is selected **before board generation**, so the implementation does not inspect a completed weak result and add Fire solely to force a desired payout.

The current development implementation can select:
- an isolated Fire ignition / spread sequence;
- a Fire + Hose/Spray sequence.

These events use the same symbol-fire engine as the bonuses.

Because these features affect money outcomes, they are part of the math model and must be included in the eventual full-game RTP simulation.

## Presentation

v0.3.0 adds:
- procedural embers, sparks, smoke, mist and water effects;
- clearer Burning / Smouldering states;
- Fire Spread combustion feedback;
- readable Spray → Smouldering multiplier transitions;
- Backdraft pressure-build anticipation followed by a burst;
- Fire Wild merge / banking transitions;
- bonus transition overlays;
- configurable BIG / SUPER / MEGA / INFERNO win presentations;
- alarm anticipation driven only by the actual generated board;
- normal / slow-motion / fast / turbo development animation speeds.

Presentation does not determine payouts. Game state is resolved independently from visual timing.

## RNG / development math

Normal prototype randomness uses `crypto.getRandomValues()` when available, with `Math.random()` as a fallback.

The board generator uses weighted symbols and neighbor-clumping. The baseline clump value is currently 54.78%.

The development QA console also supports deterministic seeded RNG for reproducible testing. Seeded RNG is a debug facility and must not be enabled as a production control.

### Important RTP limitation

The in-browser 20,000-spin sampler is now explicitly labeled **base-game-only**.

It does **not** include:
- Alarm bonus contribution;
- Burning / Smouldering multiplier contribution;
- Spray / Backdraft contribution;
- Fire Wild contribution;
- rare base-game Fire teaser contribution.

Therefore it must not be used as evidence of full-game theoretical RTP.

Before production/certification, a presentation-free full-game simulator must exercise the exact shared math engine over very large samples and report total RTP, component RTP, bonus frequencies, volatility, tail exposure, confidence intervals, and maximum observed outcomes.

## Developer / QA console

The current development build includes a **DEV / QA** console with:
- Normal / force-next 3, 4, or 5 Alarm;
- high-outcome profile;
- direct 3/4/5-Alarm bonus entry;
- development-only Bonus Buy harness with manually supplied test prices;
- reproducible RNG seeds;
- symbol-weight controls;
- math / volatility profiles;
- ignition, spread, multi-fire, Spray, all-seven-Spray-row, Backdraft, extinguish, Fire Wild, compression and large-win scenarios;
- 0.25× / 0.5× / 1× / 2× / turbo presentation speeds;
- live state inspector;
- bounded event history;
- optional console logging;
- core engine self-tests.

This interface is intentionally development-only.

For a production build, `CONFIG.debugEnabled` must be disabled and debug code should ideally be removed from the production bundle entirely.

## QA / compliance plan

See:

**[`QA_COMPLIANCE_PLAN.md`](./QA_COMPLIANCE_PLAN.md)**

It contains the current implementation review, production blockers, simulation requirements, disconnect/replay requirements, and a 97-case QA matrix covering math, state management, feature intersections, fraud/boundary testing, animation, performance, and debug leakage.

## Production blockers

The current browser prototype does **not** yet provide:
- server-authoritative result generation;
- authoritative wallet/accounting;
- transaction/result IDs;
- idempotent replay protection;
- reconnect / crash restoration;
- a finalized full-game theoretical RTP model;
- certified volatility / maximum exposure;
- formal Bonus Buy economics;
- an approved maximum-win policy;
- production RNG / jurisdiction-specific compliance architecture;
- independent certification.

Runtime client error recovery can unlock the prototype UI, but it is not a substitute for authoritative financial/result recovery.

## Repository notes

No new external art/audio assets were imported in the v0.3.0 completion pass. Existing project assets plus CSS/JavaScript procedural effects are used.

The earlier feature-heavy prototype remains archived on:

`archive/v0.1-full-features`
