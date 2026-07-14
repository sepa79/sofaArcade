# War for Crown C64 Kingsmen World Phase v0

This document defines the first implementation slice for Königstreuen/Kingsmen.
It extends `c64-ai-analysis.md` and `c64-original-mode-plan.md`.

If this document conflicts with `AGENTS.md`, `AGENTS.md` wins.

## C64 Mapping

C64 owner/player `0` is Königstreuen/Kingsmen. The TypeScript model now uses
first-class owner `0`:

```text
C64 owner 0 <-> ROYALIST_OWNER_ID
```

The completed migration record is tracked in
`c64-owner-0-migration-plan.md`.

## Phase Timing

The C64 main loop runs the royalist pass after the last configured player and
before the next full round starts:

```text
last player investment -> royalist pass -> player 1 new-month
```

The TypeScript world phase must therefore run inside the next-player transition
when turn order wraps back to the first player.

## Recovered Behavior

Hostile royalist attacks are recovered from `kampf:$8461`,
`kampf:L842E`, `fixtures/kampf-l8461-hostile-cooperation.json`, and
`fixtures/kampf-l842e-threshold-boundaries.json`, and
`fixtures/kampf-l8461-hostile-full-entry-strict-accept.json`:

- runs only when `royalistAttitude === 'hostile'`;
- scans player-owned target provinces in descending C64 province order;
- collects adjacent owner-`0` royalist source provinces;
- each source contributes all mobile soldiers and leaves one garrison;
- `$C8A6 == 0` stops source collection after the first adjacent royalist source;
- `$C8A6 != 0` keeps collecting adjacent royalist sources;
- `$C8A7 == 0` accepts attacks at ratio `>= 256`;
- `$C8A7 != 0` accepts attacks at ratio `>= 333`;
- resolves combat through the same battle resolver as player attacks;
- repeats until no hostile royalist attack can pass the battle threshold.

Confirmed VICE fixtures:

| Fixture | Setup | Observed |
| --- | --- | --- |
| `kampf-l8461-hostile-cooperation` | three provinces in a row; target province `2` is player-owned with `1` soldier; royalist sources `1` and `3` hold `5` and `6` soldiers; threshold forced accepted | `$C8A6 = 0` attacks with province `3` only for `5` mobile soldiers; `$C8A6 = 1` attacks with provinces `3` and `1` for `9` mobile soldiers |
| `kampf-l842e-threshold-boundaries` | ratio helper patched to exact boundary values | `$C8A7 = 0` rejects `255` and accepts `256`; `$C8A7 = 1` rejects `332` and accepts `333` |
| `kampf-l8461-hostile-full-entry-strict-accept` | three-province map; `$C8A6 = 0`; `$C8A7 = 1`; real `L949D/L9426`; royalist source `3` has `50` soldiers; target `2` has `1` soldier | reaches battle entry `$7E00`; attacker `49`; defender `1`; target `$C9D7 = 2`; defender owner `$C9D8 = 1` |
| `kampf-l8461-hostile-post-battle-repeat` | four-province line; two player provinces remain attackable through owner-`0` sources | after one resolved battle, `main:L4C50` dispatches back through `$3009 -> kampf:L8461` and launches a second hostile royalist attack in the same world pass |
| `kampf-l8461-hostile-home-castle-transfer` | four-province line; player owns home province `2` plus province `4`, while owner-`0` province `3` has no mobile soldiers | royalists skip province `4`, capture home province `2` from province `1`, and `main:L4C7A` transfers province `4` to owner `0` without a second battle |
| `main-l337a-hostile-home-castle-world-pass` | same four-province home-castle transfer setup, entered at `main:L337A`; `$C8A8 = 1`, `$C8AC = 1`, `$C900 = 4`, `$C901 = 0` | after the castle capture, `main:L337A` still enters `main:L5209`; production adds one soldier and one `$C902` village bucket to each owner-`0` province, then `main:L50D3` returns because owner `0` owns the full continent |
| `main-l337a-hostile-nonhome-world-pass` | four-province line; player home is province `4`, so hostile owner-`0` captures non-home province `2` first | `main:L337A` continues after the non-home capture, production runs over owner-`0` provinces `1-3`, then `main:L50D3` redistributes the connected owner-`0` component to soldiers `17/18/18`; player still owns home province `4` and no game-over result is set |
| `main-l3312-hostile-home-castle-world-pass` | same four-province home-castle transfer setup, entered at end-of-round `main:L3312` with one configured player | `main:L3312` wraps into owner `0`, calls real `main:L337A`, runs attack/production/distribution, calls post-world display/status and month/weather once, skips the eliminated player, and sets `$CA75 = 02` |
| `main-l3312-hostile-nonhome-world-pass` | four-province line; player home is province `4`, entered at end-of-round `main:L3312` with one configured player | `main:L3312` wraps into owner `0`, calls real `main:L337A`, captures non-home province `2`, runs production/distribution, calls post-world display/status and month/weather once, keeps `$CA75 = 00`, and returns active owner to player `1` |

This behavior is active in the public action API when turn order wraps from the
last player back to player 1. It emits `royalist-battle-resolved` transcript
events. The active simple-rules implementation currently uses the recovered C64
defaults `$C8A6 = 0` and `$C8A7 = 1`: one adjacent royalist source is collected,
and hostile attacks require ratio `>= 333`. Accepted hostile attacks resolve
through the C64 combat setup, ratio, RNG, round, and finish-soldier helpers.

The remaining C64 royalist behavior is now address-backed enough to port in the
next slices.

### Friendly And Neutral Battle Behavior

Evidence: `kampf:L7E76`,
`fixtures/kampf-l7e76-friendly-royalist-join.json`, and
`fixtures/kampf-l7e76-neutral-royalist-no-join.json`.

- Friendly royalists (`$C8A5 == 0`) do not fight when their province is attacked.
- If the battle target owner is `0`, the defender soldiers are added to the
  attacker soldier total.
- Defender soldiers are zeroed and the battle exits before the normal combat
  loop.
- Neutral royalists (`$C8A5 == 1`) do not use this join path and do not launch
  hostile attacks.

Confirmed VICE fixtures:

| Fixture | Setup | Observed |
| --- | --- | --- |
| `kampf-l7e76-friendly-royalist-join` | `$C8A5 = 0`; target owner `0`; attacker `5`; defender `3`; battle progress byte `$C9D9 = $7F` | attacker becomes `8`; defender becomes `0`; `$C9D9` becomes `0`; battle entry exits before normal combat |
| `kampf-l7e76-neutral-royalist-no-join` | `$C8A5 = 1`; target owner `0`; attacker `5`; defender `3`; `$C9D9 = $7F` | attacker, defender, and `$C9D9` are unchanged; normal battle setup remains responsible for continuing |

### Production / Investment

Evidence: `main:L5209` and
`fixtures/main-l5209-royalist-production-buckets.json`,
`fixtures/main-l5209-royalist-production-fort-upgrade.json`, and
`fixtures/main-l5209-royalist-production-fort-max-boundary.json`. The
production-to-distribution world-pass chain is covered by
`fixtures/main-owner0-world-pass-production-distribution.json`.

- Returns immediately when `$C8A5 == 0`.
- Runs over owner-`0` provinces only.
- Calculates per-province income with `main:L5193`.
- Splits production by normalized growth `$C8B3` and investment `$C8B4`.
- Uses per-province saved buckets `$C902 + province` for villages and
  `$C966 + province` for fortification.
- Buys villages with price `$C900` up to the C64 village cap.
- Upgrades fortifications using cost table `main:L300F`
  (`20, 30, 40, 50, 60, 80`). `$C8AF` blocks conversion only when the current
  fortification equals the configured non-home maximum; captured castles above
  that level are not invalid state.
- Converts remaining production into soldiers on that province.
- After all royalist provinces are processed, `main:L51B2..L5206` sums the
  remaining village and fortification buckets for owner `0`, takes
  `floor(sum * $C901 / 100)`, and distributes that amount as soldiers over
  owner-`0` provinces through `main:L50B7` and `main:L4F49`.

There is no royalist home castle and no player-money pool in this path. The only
cross-province amount is the post-pass percentage of unspent per-province
buckets described above.

Confirmed VICE fixture:

| Fixture | Setup | Observed |
| --- | --- | --- |
| `main-l5209-royalist-production-buckets` | active owner `0`; two royalist provinces; growth/investment bytes `0`; village price `4`; post-pass percent `$C901 = 8`; province `1` starts with `C902 = 3`; province `2` starts with `C966 = 19` | province `1` buys one village and ends with `3` soldiers; province `2` keeps `C902 = 1`, `C966 = 19`, and ends with `4` soldiers; post-pass creates `1` soldier from remaining buckets |
| `main-l5209-royalist-production-fort-upgrade` | one owner-`0` province; fort `0`; `$C966 = 20`; `$C8AF = 1`; `$C901 = 0` | fort upgrades to `1`; `$C966` clears to `0`; soldiers increase `1 -> 3` |
| `main-l5209-royalist-production-fort-max-boundary` | one owner-`0` province; fort already `1`; `$C966 = 20`; `$C8AF = 1`; `$C901 = 0` | fort stays `1`; `$C966` clears to `0`; blocked fort bucket converts to soldiers, `1 -> 23` |

The fixture stubs `$1B69` to `RTS` because it is a province redraw side effect
and requires full screen state when `main:L5209` is called in isolation. This
does not alter production, bucket, fortification, or soldier state.

This behavior is active in the TypeScript world phase. The port stores
`$C902/$C966` in `GameState.c64.royalistProvinceMemory` and runs production for
neutral and hostile royalists before `$50D3` distribution over owner-`0`
provinces. `main-owner0-world-pass-production-distribution` proves that the
output of `$5209` is carried directly into `$50D3` on the same C64 state.
`main-l337a-hostile-nonhome-world-pass` proves the same continuation after a
hostile non-home capture, while player ownership remains on the map.

### Distribution / Pressure

Evidence: `main:L50D3`, `main:L5134`, `main:L514A`,
`main:L5005`, `main:L4FA7`,
`fixtures/main-l50d3-royalist-distribution-equal.json`,
`fixtures/main-l50d3-royalist-distribution-frontier.json`, and
`fixtures/main-l50d3-royalist-distribution-equal-multicomponent.json`. The
combined production-to-distribution world-pass transcript is
`fixtures/main-owner0-world-pass-production-distribution.json`.

`$C8A8` maps to the setup text:

| `$C8A8` | Setup text | Behavior |
| ---: | --- | --- |
| `0` | `KEINE` | no distribution pass |
| `1` | `GLEICHMASSIG` | redistribute across the full connected royalist component |
| `2` | `GRENZNAH` | redistribute only to component frontier provinces |

`main:L50D3`:

1. returns when `$C8A5 == 0`;
2. returns when `$C8A8 == 0`;
3. returns if royalists already own every province;
4. clears map flags;
5. scans owner-`0` provinces from high id to low id;
6. skips already processed component provinces marked `$01`;
7. flood-fills the connected owner-`0` component from the current province;
8. `main:L5134` marks the component as `$10 | $01`;
9. `main:L5005` pulls all mobile soldiers from the component, leaving one
   garrison in every component province;
10. when `$C8A8 != 1`, `main:L514A` removes `$10` from non-frontier component
    provinces and leaves `$80` only on frontier provinces;
11. copies pulled soldiers into defender/distribution registers `$C9D3..$C9D5`;
12. `main:L4FA7` distributes those soldiers evenly over provinces marked `$80`;
13. masks flags with `#$2F` and repeats until all royalist components are
    processed.

Confirmed VICE fixtures:

| Fixture | `$C8A8` | Setup | Observed |
| --- | ---: | --- | --- |
| `main-l50d3-royalist-distribution-equal` | `1` | royalist line `1-2-3` bordering player province `4`; soldiers `1,4,7` | mobile soldiers `9` are spread over all three royalist provinces, ending `4,4,4` |
| `main-l50d3-royalist-distribution-frontier` | `2` | same map and soldiers | mobile soldiers `9` are deposited only on frontier province `3`, ending `1,1,10` |
| `main-l50d3-royalist-distribution-equal-multicomponent` | `1` | royalist components `1-2` and `4-5`, separated by player province `3`; soldiers `1,4,1,7,10` | components are processed independently, ending `2,3,1,8,9` |
| `main-owner0-world-pass-production-distribution` | `1` | owner `0` owns line provinces `1-2`, player owns `3`; `$5209` first changes soldiers to `3,13,20` | `$50D3` pulls `14` mobile owner-`0` soldiers from the post-production state and ends `8,8,20` |
| `main-l337a-hostile-nonhome-world-pass` | `1` | hostile attack first captures player non-home province `2`, leaving player home province `4` owned by player `1` | production changes owner-`0` soldiers to `25,26,2`; `$50D3` pulls `50` mobile soldiers from owner-`0` provinces `1-3` and ends `17,18,18,11` |

Both fixtures stub `$1B69` to `RTS` because it is a province redraw side effect
and requires full screen state when `main:L50D3` is called in isolation. This
does not alter flags or soldier state.

Implications:

- `GLEICHMASSIG` spreads mobile royalist soldiers over every province in each
  connected royalist component.
- `GRENZNAH` concentrates mobile royalist soldiers on component border
  provinces.
- Each distribution pass leaves one soldier in every processed province before
  redistributing the pulled mobile force.

This behavior is active in the TypeScript world phase for `royalistDistribution:
'even'` and `royalistDistribution: 'border'`. The default remains C64 `$C8A8 =
0` / `KEINE`.

## Still Required For Full Parity

- final C64 labels/UI for `$C8A6` attack cooperation and `$C8A7` threshold;
- broader hostile owner-`0` transcript parity across more natural seed/map
  contexts; the focused `kampf:L8461 -> main:L4C7A` home-castle transfer path,
  `main:L337A` home-castle and non-home world-pass paths, and natural
  `main:L3312` end-of-round entry are already fixture-backed.
