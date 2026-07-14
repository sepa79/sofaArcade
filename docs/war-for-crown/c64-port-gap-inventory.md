# War for Crown C64 Port Gap Inventory

This file records the remaining boundary after the `c64-original-simple`
gameplay port reached its bounded VICE parity gate. The detailed subsystem
status and executable evidence live in `c64-port-completeness-matrix.md`.

## Selected Baseline

- Baseline: `ERBENT1A.D64`, pinned by `c64-baseline-manifest.json`.
- Separate legacy branch: `KRIEGUDK.D64`; its rules are not mixed into this
  mode.
- Determinism: VICE and TypeScript consume the same explicit RNG byte stream.
- Player slots: 2–4, matching the C64 tables.

## Gameplay Evidence

| Area | Primary evidence |
| --- | --- |
| setup, map, terrain, home castles | `menue:L30D6..L520F`, map/home fixtures, `test:parity:map` |
| turn order, weather, income, events | `main:L30E1..L3E09`, event fixtures, `test:parity:events` |
| human actions and battle | `main:L4196..L4C7A`, `kampf`, focused unit/fixture tests |
| computer economy, attack, movement, cleanup | `cbaron:$5800/$5803/$5806`, focused fixtures, bounded round and reaction parity |
| royalist attacks, production, distribution | `kampf:L8461`, `main:L5209/L50D3`, hostile and neutral fixtures |
| elimination and victory | `main:L3312/L3384/L339B/L4C7A`, seed `15` winner parity |

The runtime gate covers all 26 events, 14 seed/configuration map and phase
cases, three scripted human-incursion reactions, a 12-round behavioral smoke
that requires the core AI economy, distribution, combat, capture, and royalist
retreat branches to occur, a natural winner after 17 completed rounds, and a
38-round regression. This is intentionally sized to a normal 3–5-year game
rather than an hours-long AI soak.

## Remaining Non-Logic Work

- Complete reproduction/localization of every visible C64 text template.
- Optional C64-style presentation timing and animation polish.
- A future full-rules mode, if desired, must separately recover and model
  `$CA55/$CA56` supplies, catapults, and related state. Those features are not
  fallbacks and are not enabled in `c64-original-simple`.

Any new C64 counterexample inside the simple-mode boundary reopens the relevant
subsystem and must be preserved as a focused test or a bounded parity scenario.
