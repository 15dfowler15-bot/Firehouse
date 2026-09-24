# Firehouse — Base Game

Firehouse is currently intentionally stripped down to the core game loop so the base math can be tuned before any bonus features or fire multipliers are added.

## Current rules

- 7×7 grid.
- Cluster pays: **8 or more matching symbols must touch horizontally or vertically**.
- Winning clusters disappear simultaneously.
- Symbols fall vertically and RNG replacements enter from the top.
- Cascades continue until the board has no qualifying cluster.
- Wild substitutes for any paying symbol and may connect a cluster. Wild-only groups do not pay.
- No free spins, fire multipliers, boosters, alarm bonus, or other features in this version.

## Symbols and paytable

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

## RNG and RTP model

All money-affecting random calls use `crypto.getRandomValues()` when the browser provides it, with `Math.random()` only as a non-secure fallback for unsupported environments.

The symbol generator uses weighted symbols plus a calibrated **54.78% neighbor-clump probability**. This deliberately creates connected patches; independent 7×7 cell draws with nine symbols make 8+ orthogonal clusters far too rare for the intentionally small paytable.

Current base weights:

- Fire Extinguisher: 20
- Fire Helmet: 18
- Fire Axe: 16
- Fire Hydrant: 14
- Turnout Suit: 12
- Fire Radio: 10
- Dalmatian: 7
- Chief Badge: 5
- Wild: 1.4

A 100,000-spin development simulation of the current algorithm measured approximately **95.94% RTP**, with normal Monte Carlo variance around the 96% target. The in-game Math panel can run a fresh 20,000-spin sample using the exact same evaluator and cascade logic.

This is prototype math, not certified gambling software. Regulated deployment would require formal theoretical analysis and jurisdiction-specific independent testing.

## Run locally

No build step is required.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Archived version

The earlier feature-heavy prototype is preserved on the `archive/v0.1-full-features` branch.
