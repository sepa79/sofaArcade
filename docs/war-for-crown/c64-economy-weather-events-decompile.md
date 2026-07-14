# War for Crown C64 Economy, Weather, And Events Decompile

This document records the recovered C64 monthly income, weather, and random
event logic for the `c64-original` ruleset.

## Main Turn Position

Evidence: `main:L30E1`.

For each active non-eliminated player turn, C64 runs:

1. `main:L35E5` at round wrap: month/year/weather screen;
2. `main:L3A98`: income collection;
3. `main:L3890`: full-rules disconnected/supply pressure path;
4. `main:L3112`: random event;
5. attack, movement, build.

The playable simple baseline should keep `L3890` disabled unless the selected
C64 image proves those full rules are part of the target.

## Income Formula

Evidence: `main:L3A98`, `main:L3B38`, `main:L3015`.

`L3B38` computes base monthly income:

```text
provinceIncome = villages * terrainIncomePercent
baseIncome     = floor(sum(provinceIncome for owned provinces) / 100)
```

If terrain influence is disabled (`$C8AC == 0`), terrain percent is forced to
`100` for every province.

Terrain income percent table:

| Terrain id | Percent |
| ---: | ---: |
| 0 | 0 |
| 1 | 150 |
| 2 | 100 |
| 3 | 140 |
| 4 | 130 |
| 5 | 120 |
| 6 | 100 |
| 7 | 110 |

The result is stored in `$161A..$161C` and then added to player money
`$C8BB/$C8C0/$C8C5 + player`.

### Event Income Flags

Before adding income, `L3A98` checks `$CA61 + player`:

| Bit | Effect |
| ---: | --- |
| `$10` | with 50% chance, halve this income |
| `$20` | with 50% chance, double this income |

After resolving those checks, `L3A98` clears bits `$10/$20` with mask `$CF`.

These are delayed event modifiers. They are not part of normal village income.

## Weather

Evidence: `main:L35E5`, `main:L3D7C`, `main:L3DCD`, `main:L3E09`,
`fixtures/main-weather-selection-drift-boundaries.json`.

`$CA4B` is the current weather index. `L3D7C` chooses it from a weighted table
based on the next month:

1. `nextMonth = ($C8A3 + 1) mod 12`;
2. `seasonOffset = floor(nextMonth / 3) * 7`;
3. call `L982F($62)`;
4. subtract table values starting at `weatherWeights + seasonOffset` until the
   subtraction underflows;
5. the loop count becomes `$CA4B`.

Raw 4-by-7 weather weight table at `main:L3DB1`:

```text
season 0: 0,  0, 10, 15, 25, 30, 20
season 1: 0, 20, 30, 25, 15, 10,  0
season 2: 20,30, 25, 15,  0,  0, 10
season 3: 0, 10, 25, 30, 20,  0, 15
```

`L3DCD` updates weather income factor `$CA4C/$CA4D`:

- if `$CA4B == 3`, drift `$CA4C` toward `100`:
  - if `$CA4C >= 110`, subtract `10`;
  - else if `$CA4C < 90`, add `10`;
  - else set `$CA4C = 100`;
- otherwise, `$CA4C = clamp($CA4C + ($CA4B - 3), 40, 160)`;
- `$CA4D = $CA4C - 30`.

`$CA4D` is used by the full-rules investment/supply paths. The simple income
path above does not multiply village income directly by `$CA4D`.

The `main-weather-selection-drift-boundaries` VICE fixture confirms:

- next-month season selection: month `1` uses next month `2`, season `0`;
- a patched `L982F($62)` return of `$0C` selects weather index `3` from season
  `0`;
- weather index `3` drifts `$CA4C` toward `100` by `10`;
- non-`3` weather clamps `$CA4C` at `40..160`;
- `$CA4D` is written as `$CA4C - 30`.

## Event Dispatch

Evidence: `main:L3112`, event modules `za..zz`, `sys:L982F`,
`fixtures/main-l3112-event-loader-boundaries.json`,
`fixtures/main-event-module-effects-simple.json`, and
`fixtures/main-event-module-effects-money-oneshot.json`.

Random events are gated by `$C8A4`:

1. if `$C8A4 == 0`, no event;
2. before year `2`, month must be at least `$C8A4`;
3. owner `0` and computer players do not receive the human event UI path;
4. `L218B < $10` skips the event;
5. `L982F($1A)` chooses one of 26 modules;
6. module `za..zz` is loaded at `$5500`;
7. `$5500/$5501` and `$5502/$5503` provide text range pointers for `L9A5D`;
8. event code starts at `$5504`.

`sys:L982F(max)` returns `(rngByte % max) + 2` and stores that returned value in
the self-modified byte `$9849`. Some event modules read `$9849` after calling
the helper, so the port must expose both return value and stored side effect.

The `main-l3112-event-loader-boundaries` VICE fixture confirms these boundary
cases:

- `$C8A4 == 0` returns before RNG or loader work.
- In year `1`, `$C8A3 < $C8A4` returns before RNG or loader work.
- `$C9D9 + activePlayer != 0` returns before RNG or loader work.
- First raw RNG byte `$0F` returns; `$10` continues.
- The active path passes `L982F($1A) - 1` as the loaded module id, then reads
  `$5500..$5503` as the display text range and jumps to `$5504`.

## Event Helper Entry Points

The event modules call jump-table helpers in `main`:

| Entry | Target | Meaning |
| --- | --- | --- |
| `$3003` | `main:L315E` | reduce current `$5B..$5E` by a random percent; loss in `$5F..$62` |
| `$3042` | `main:L32D8` | add `$5F..$62` to full-rules reserve `$CA2E..$CA3A` |
| `$3045` | `main:L32BB` | add `$5F..$61` to player money |
| `$3048` | `main:L32A3` | store `$5B..$5E` into `$CA2E..$CA3A` |
| `$304B` | `main:L328B` | load `$CA2E..$CA3A` into `$5B..$5E` |
| `$304E` | `main:L325B` | store `$5B..$5D` into selected province soldiers |
| `$3051` | `main:L3247` | load selected province soldiers into `$5B..$5E` |
| `$3054` | `main:L3234` | store `$5B..$5D` into player money |
| `$3057` | `main:L321D` | load player money into `$5B..$5E` |
| `$305A` | `main:L31AA` | generate random money amount from input scale and year/rank |
| `$305D` | `main:L3887` | event close/pause/redraw |
| `$3060` | `main:L326E` | focus/show selected province |

## Event Module Effects

This table records gameplay state effects. Text-only display calls are omitted.

| Module | Effect |
| --- | --- |
| `za` | thieves/bad event: load player money, reduce it by random percent with base `5`, store reduced money |
| `zb` | good weather: add random money scale `10`; if `$CA55`, add random full-rules reserve scale `200` |
| `zc` | new village: choose a random owned province below village cap and add one village |
| `zd` | forest fire: choose owned forest terrain (`terrain == 4`) province with villages and remove one village |
| `ze` | treasure: add random money scale `10` |
| `zf` | plague: choose owned province with at least `20` soldiers, reduce soldiers by random percent with base `5` |
| `zg` | deserters: same soldier reduction as `zf`, then stores lost soldier amount in `$CA49` and owner in `$CA4A` |
| `zh` | peasants volunteer: add random soldiers scale `10` to home province |
| `zi` | horse race win: add random money scale `10` |
| `zj` | no effect through normal dispatcher in `ERBENT1A`: `$5504` is `RTS`; dormant code after it resembles a hostile-royalist rebellion, but it is not reached |
| `zk` | dragon: same soldier-loss shape as `zf` |
| `zl` | no effect through normal dispatcher in `ERBENT1A`: same `$5504` `RTS` entry shape as `zj` |
| `zm` | deserters join another player: if `$CA49` is set and active player is not `$CA4A`, add `$CA49` soldiers to active player's home, then clear `$CA49/$CA4A` |
| `zn` | no effect through normal dispatcher in `ERBENT1A`: `$5504` is `RTS`; dormant code after it resembles a year-gated gold mine, but it is not reached |
| `zo` | catapult sabotage: decrement `$CA42 + player` if non-zero |
| `zp` | rats/supplies: full-rules only (`$CA55`), human only; reduce `$CA2E..$CA3A` by random percent with base `10`, max `20` |
| `zq` | found royalist supply camp: add random money scale `8`; if `$CA55`, add random reserve scale `200` |
| `zr` | burglary: same money-loss shape as `za` |
| `zs` | bandits/supplies: full-rules only (`$CA55`), human only; reduce `$CA2E..$CA3A` by random percent with base `5` |
| `zt` | dragon hoard: only from year `12`, once per player via `$CA61 & $01`; add random money scale `50` |
| `zu` | dice win: add random money scale `20` |
| `zv` | bandits caught: only from year `5`; add random money scale `30`; if `$CA55`, add random reserve scale `255` |
| `zw` | daughter's dowry: only from year `3`, once per player via `$CA61 & $02`; reduce money by random percent with base `1`, max `5` |
| `zx` | son's dowry: only from year `3`, once per player via `$CA61 & $08`; add random money scale `10` |
| `zy` | fortification fire: choose owned province with fortification and decrement `$C63E` |
| `zz` | catapult sabotage duplicate: same state behavior as `zo` |

## Simple Rules Baseline

For the initial simple C64-style ruleset without supplies/catapults:

- random events are enabled by default because the C64 setup default is
  `$C8A4 = 7`; the setup option can still disable them by setting `$C8A4 = 0`;
- include active money, village, soldier, deserter-handoff, and fortification
  events only if random events are enabled;
- exclude or no-op modules whose only state target is `$CA42` catapults or
  `$CA2E..$CA3A` supplies/reserves;
- do not expose `$CA49/$CA4A` as a player reserve. It is a delayed deserter-event
  handoff between event modules `zg` and `zm`.
- do not implement dormant code behind `zj`, `zl`, or `zn` for the ERBENT1A
  baseline; their dispatcher entrypoint returns immediately.

## Event Fixture Notes

The `main-event-module-effects-simple` VICE fixture confirms representative
simple-mode effects:

- `zc` scans owned provinces downward and adds one village to the selected
  province when below the cap;
- `zf` and `zg` use `L3003` with base `5`; with an `L982F` return of `5`, `100`
  soldiers become `90` and the displayed loss is `10`;
- `zg` stores lost soldiers in `$CA49` and source owner in `$CA4A`; `zm` later
  moves those soldiers to another active player's home and clears both fields;
- `zj` and `zn` do not mutate state even when their dormant-code conditions are
  satisfied, because `$5504` is `RTS`.

The `main-event-module-effects-money-oneshot` VICE fixture confirms:

- `za` uses `L3003` with base `5`; with `L982F` return `2`, `100` talers become
  `93`, and the displayed loss is `7`;
- `zb` adds generated money through `L3045`, and with `$CA55 = 0` does not
  touch full-rules reserve bytes;
- `zh` adds generated soldiers directly to the active player's home province;
- `zd` chooses an eligible owned forest province and decrements exactly one
  village;
- `zy` chooses an owned fortified province and decrements exactly one
  fortification level;
- `zt`, `zw`, and `zx` are one-shot per player through `$CA61` bits `$01`,
  `$02`, and `$08`;
- `zv` is gated by year `5`.

## Still Open

- Add PL/EN localization keys for the recovered C64 event templates in
  `c64-text-status-decompile.md`.
