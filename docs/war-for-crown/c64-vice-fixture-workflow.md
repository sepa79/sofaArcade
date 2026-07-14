# War for Crown C64 VICE Fixture Workflow

This document records the repeatable workflow for extracting C64 fixture vectors
from VICE monitor runs.

## Tool Status

Installed tools in WSL:

| Tool | Status |
| --- | --- |
| `c1541` | available |
| `petcat` | available |
| `da65` | available |
| `x64` | available |
| `x64sc` | available; C64 ROMs installed from local Windows VICE bundle |

Previous blocker, now resolved:

```text
C64MEM: Error - Couldn't load kernal ROM `kernal-901227-03.bin'.
Error - Machine initialization failed.
```

Ubuntu's `vice` package is DFSG-clean and does not ship the required Commodore
ROM images. The local WSL setup now has the C64 ROM files copied from:

```text
/mnt/c/Games/c64/GTK3VICE-3.8-win64/C64/
```

into:

```text
~/.local/share/vice/C64/
~/.local/share/vice/C64SC/
```

Required C64SC ROM filenames from `x64sc -dumpconfig`:

| File | Expected VICE resource |
| --- | --- |
| `basic-901226-01.bin` | `BasicName` |
| `kernal-901227-03.bin` | `KernalName` |
| `chargen-901225-01.bin` | `ChargenName` |

Place them under the per-user VICE ROM directory or pass their directory with
`-directory`:

```bash
mkdir -p ~/.local/share/vice/C64SC
# copy the three ROM files into ~/.local/share/vice/C64SC with the names above
```

Drive ROMs copied on 2026-07-08:

```text
/mnt/c/Games/c64/GTK3VICE-3.8-win64/DRIVES/*.bin
```

to:

```text
~/.local/share/vice/DRIVES/
```

This enables VICE to load 1541/1571/1581 drive ROMs for full-disk traces. Some
large-drive ROM warnings may remain, but they do not block the `ERBENT1A.D64`
1541-style loader work.

Smoke command after ROMs are present:

```bash
x64sc \
  -default \
  -sounddev dummy \
  -warp \
  -nativemonitor \
  -initbreak reset \
  -moncommands docs/war-for-crown/fixtures/monitor-smoke.mon \
  -limitcycles 100000
```

Expected result: VICE enters the native monitor, runs `help`, then exits without
the `kernal ROM` error.

When running from Codex tooling, allocate a PTY. The native monitor fails with
`stdin is not a tty` without it.

Smoke result on 2026-07-08:

```text
x64sc -default -sounddev dummy -warp -limitcycles 100000
```

loads `kernal-901227-03.bin`, `basic-901226-01.bin`, and
`chargen-901225-01.bin` from `~/.local/share/vice/C64/`, starts the C64 main
CPU, and exits at the configured cycle limit. Printer and hardware-drive ROM
warnings remain, but they do not block monitor fixtures that inject memory or
use extracted module data.

Confirmed monitor fixture:

```text
docs/war-for-crown/fixtures/kampf-round-20v6-terrain4-fort0-rng7b.mon
```

loads `sys` and `kampf` raw modules, patches RNG at `$218B`, runs
`kampf:L8618`, and produces the derived fixture:

```text
docs/war-for-crown/fixtures/kampf-round-20v6-terrain4-fort0-rng7b.json
```

Also confirmed:

```text
docs/war-for-crown/fixtures/sys-ratio-20v6-combat25v35.json
docs/war-for-crown/fixtures/sys-retreat-threshold-boundaries.mon
docs/war-for-crown/fixtures/sys-retreat-threshold-boundaries.json
```

`sys-retreat-threshold-boundaries` patches only `sys:L9426` to feed exact ratio
bytes into `sys:L946F` and `sys:L9486`. It proves attacker-helper carry changes
between `229` and `230`, and defender-helper carry changes between `434` and
`435`.

Confirmed AI map fixture:

```text
docs/war-for-crown/fixtures/cbaron-l6808-target-3province-homebonus.mon
docs/war-for-crown/fixtures/cbaron-l6808-target-3province-homebonus.json
docs/war-for-crown/fixtures/cbaron-l6808-target-homebonus-carry.mon
docs/war-for-crown/fixtures/cbaron-l6808-target-homebonus-carry.json
docs/war-for-crown/fixtures/cbaron-l6808-underpowered-royalist-neutral-skip.mon
docs/war-for-crown/fixtures/cbaron-l6808-underpowered-royalist-friendly-keep.mon
docs/war-for-crown/fixtures/cbaron-l6808-underpowered-royalist-attitude.json
```

This loads `kernal`, `main`, `cbaron`, and `sys`, patches RNG at `$218B`,
runs `cbaron:L6808`, and proves the selected target/score for a three-province
map. The homebonus-carry fixture proves high-byte score behavior when a target
home owner has four provinces. The underpowered royalist-attitude pair loads
`kampf` as well and proves the `L699E` branch for owner-`0` targets: neutral
royalists skip the underpowered candidate, while friendly royalists allow it to
be scored and selected.

Confirmed AI target tie-order fixture:

```text
docs/war-for-crown/fixtures/cbaron-l6808-target-tie-lower-id.mon
docs/war-for-crown/fixtures/cbaron-l6808-target-tie-lower-id.json
docs/war-for-crown/fixtures/cbaron-l6808-rng-per-candidate.mon
docs/war-for-crown/fixtures/cbaron-l6808-rng-per-candidate.json
```

This runs `cbaron:L6808` over two symmetric target candidates and proves equal
scores select the lower province id because `L6808` replaces the best candidate
on equality while scanning downward. The RNG-count companion fixture patches
`kernal:L218B` to increment `$C020` and return `$7B`; the observed count `2`
proves `L6808` consumes one RNG byte per accepted target candidate.

Confirmed AI attack source-pruning fixture:

```text
docs/war-for-crown/fixtures/cbaron-l674a-source-pruning-overkill.mon
docs/war-for-crown/fixtures/cbaron-l674a-source-pruning-overkill.json
```

This runs `cbaron:L674A` with a selected target and two overkill sources. It
proves that C64 prunes high-id source provinces while the reduced attack ratio
remains at least `$01B3` (`435`), and restores the source when removal would
leave no valid attack.

Confirmed first AI phase-chain transcript fixture:

```text
docs/war-for-crown/fixtures/cbaron-ai-turn-no-attack-transcript.mon
docs/war-for-crown/fixtures/cbaron-ai-turn-no-attack-transcript.json
```

This runs `cbaron:$5803`, then `cbaron:$5806`, then `cbaron:$5800` on the same
three-province line state. The active computer baron owns provinces `1` and `2`;
neutral owner `0` owns province `3` with enough soldiers that `$5803` leaves
`$1602 = 0` and starts no battle. The transcript proves the no-attack branch can
leave work flags in `$C832`, the following movement phase clears them while
moving mobile soldiers from province `1` to province `2`. With the monitor
state fully initialized (`$CA55..$CA71` cleared and `$C8AA/$C8AB = 12`), the
following economy entry treats the neutral border as an economy frontier with
zero neutral threat: it recruits four soldiers into the home province, spends
the remaining sixteen talers on four villages, and leaves money at `0`. This
fixture is now compared by `games/war-for-crown/src/game/c64-ai-transcript.test.ts`.
It does not cover battle entry, retreat, capture, or owner-`0` world pass
behavior.

TypeScript comparison scope for this fixture is domain state after each public
attack/movement action plus the `$5800` economy reducer: selected/no selected
target, province soldiers, province villages, active player money,
remembered-target memory, and event shape. Economy is compared at reducer level
because the public investment action also advances the turn wrapper and can run
owner-`0` world-pass behavior that is outside this cbaron phase-chain fixture.
The comparison intentionally does not include program counter, stack/register
values, patched UI helper bytes, or transient `$C832` work flags after the
attack step.

Confirmed AI battle-capture transcript fixture:

```text
docs/war-for-crown/fixtures/cbaron-5803-battle-capture-line.mon
docs/war-for-crown/fixtures/cbaron-5803-battle-capture-line.json
```

This runs `cbaron:$5803` on a three-province line where computer player `1`
owns provinces `1` and `3`, computer player `2` owns home province `2`, and
the selected target has one defender. The monitor leaves the real shared
`main`/`kampf` battle and capture path intact and stops at `main:$4C50` after
resolution. The observed C64 state has owners `1/1/1`, soldiers `1/97/1`,
owner `1` province count `3`, owner `2` province count `0`, and player `2`'s
home marker still set to province `2`.

This fixture is compared by `games/war-for-crown/src/game/c64-ai-transcript.test.ts`
through the public `run-c64-baron-attack` and `run-c64-battle-command` actions.
It covers attacker victory and home-castle capture, but it does not cover
attacker retreat, subsequent `$5806/$5800`, or owner-`0` world-pass behavior.

Confirmed AI defender-retreat transcript fixture:

```text
docs/war-for-crown/fixtures/cbaron-5803-defender-retreat-line.mon
docs/war-for-crown/fixtures/cbaron-5803-defender-retreat-line.json
```

This runs `cbaron:$5803` on a three-province line where computer player `1`
attacks player `2`'s non-home province `2`, and player `2` has a legal retreat
province `3`. `$CA48` is forced to `0` so `sys:L949D` stays in the simple
combat-context path. The RNG harness at `$C100` returns the domain byte
sequence so the fixture can compare public TypeScript state without requiring
the real C64 noise/RNG source.

The observed C64 state after `main:$4C50` has command `$C9D9 = 1`, retreat
target `$9406 = 3`, combat context `$9400/$9401 = 25/25`, owners `1/1/2`,
and soldiers `1/93/41`. It proves that the defender retreat command still
resolves one final combat round and that C64 consumes the battle RNG byte for
attacker hits before the byte for defender hits. This fixture is compared by
`games/war-for-crown/src/game/c64-ai-transcript.test.ts`.

Confirmed AI defender-retreat phase-chain transcript fixture:

```text
docs/war-for-crown/fixtures/cbaron-ai-turn-defender-retreat-transcript.mon
docs/war-for-crown/fixtures/cbaron-ai-turn-defender-retreat-transcript.json
```

This runs `$5803 -> battle -> defender retreat -> $5806 -> $5800` on the same
three-province C64 state. `$5803` captures province `2` after defender retreat,
leaving owners `1/1/2` and soldiers `1/93/41`. `$5806` then pulls `92` mobile
soldiers, computes a `45` soldier frontier requirement, restores the same army
layout, and writes remembered target memory for province `3` with strength
`41` (`$C9DF = 03`, `$C9E3 = 29`). `$5800` spends the active player's `20`
talers as four home recruits plus four villages, leaves money `0`, and
preserves the remembered target memory. This fixture is compared by
`games/war-for-crown/src/game/c64-ai-transcript.test.ts`.

Confirmed AI attacker-retreat transcript fixture:

```text
docs/war-for-crown/fixtures/cbaron-5803-attacker-retreat-line.mon
docs/war-for-crown/fixtures/cbaron-5803-attacker-retreat-line.json
docs/war-for-crown/fixtures/cbaron-5803-attacker-retreat-round-trace.mon
```

This runs `cbaron:$5803` on a two-province line where computer player `1`
attacks player `2`'s home province. `$9406 = 0`, so defender retreat cannot
preempt the attacker-retreat branch. The main transcript stops after
`main:$4C50` with command `$C9D9 = 2`, owners `1/2`, soldiers `6/6`, and
`$C9D0/$C9D3 = 5/6` battle scratch survivors. The round trace stops at
`kampf:$86C4` each combat round; it proves eight rounds, final round losses
`2/2`, and final battle survivors `5/6`. The later `$4C50` dump has already
passed stat-counter accounting, so `$92C2..$92C7` there are not the canonical
round casualties. This fixture is compared by
`games/war-for-crown/src/game/c64-ai-transcript.test.ts`.

Confirmed AI attacker-retreat phase-chain transcript fixture:

```text
docs/war-for-crown/fixtures/cbaron-ai-turn-attacker-retreat-transcript.mon
docs/war-for-crown/fixtures/cbaron-ai-turn-attacker-retreat-transcript.json
docs/war-for-crown/fixtures/cbaron-5800-post-retreat-economy-trace.mon
```

This runs `$5803 -> battle -> attacker retreat -> $5806 -> $5800` on the same
two-province C64 state. `$5803` starts a battle from province `1` into province
`2`; battle AI retreats the attacker after eight rounds and leaves owners
`1/2`, soldiers `6/6`. `$5806` then satisfies the local defensive requirement
without changing the map, and `$5800` spends the active player's `20` talers as
four home recruits plus four villages, leaving money `0`. The trace monitor is
a diagnostic fixture for the economy branch and documents why C64 monitors must
clear `$CA55..$CA71` and set `$C8AA/$C8AB` before comparing `$5800`.

Confirmed AI movement placement fixtures:

```text
docs/war-for-crown/fixtures/cbaron-l6c49-placement-friendly-target.mon
docs/war-for-crown/fixtures/cbaron-l6c49-placement-friendly-target.json
docs/war-for-crown/fixtures/cbaron-l6c49-placement-score-low16-overflow.mon
docs/war-for-crown/fixtures/cbaron-l6c49-placement-score-low16-overflow.json
```

These run `cbaron:L6C49`. The friendly-target fixture proves the selected
staging province, deposited amount, surplus update, and target-memory update.
The low-16 overflow fixture forces class `6` and proves that placement scoring
keeps only weighted product bytes `$5F/$60` before the divide setup; score
scratch bytes must be asserted at internal breakpoints because the exit path can
clobber `$1602..$1604`.

Confirmed royalist production fixture:

```text
docs/war-for-crown/fixtures/main-l5209-royalist-production-buckets.mon
docs/war-for-crown/fixtures/main-l5209-royalist-production-buckets.json
docs/war-for-crown/fixtures/main-l5209-royalist-production-fort-upgrade.mon
docs/war-for-crown/fixtures/main-l5209-royalist-production-fort-upgrade.json
docs/war-for-crown/fixtures/main-l5209-royalist-production-fort-max-boundary.mon
docs/war-for-crown/fixtures/main-l5209-royalist-production-fort-max-boundary.json
```

This runs `main:L5209`, stubs only the province redraw side effect at `$1B69`,
and proves village-bucket spending, retained fort/village buckets, soldier
conversion, fortification upgrade spending, max-fort bucket conversion, and the
post-pass `$C901/100` soldier distribution.

Confirmed royalist distribution fixtures:

```text
docs/war-for-crown/fixtures/main-l50d3-royalist-distribution-equal.mon
docs/war-for-crown/fixtures/main-l50d3-royalist-distribution-equal.json
docs/war-for-crown/fixtures/main-l50d3-royalist-distribution-frontier.mon
docs/war-for-crown/fixtures/main-l50d3-royalist-distribution-frontier.json
docs/war-for-crown/fixtures/main-l50d3-royalist-distribution-equal-multicomponent.mon
docs/war-for-crown/fixtures/main-l50d3-royalist-distribution-equal-multicomponent.json
```

These run `main:L50D3`, stub only the province redraw side effect at `$1B69`,
and prove the difference between `$C8A8 = 1` equal component distribution and
`$C8A8 = 2` frontier-only distribution. The multi-component fixture proves
owner-`0` components are processed independently and remainder soldiers stay
inside their component.

Confirmed royalist production-to-distribution world-pass transcript fixture:

```text
docs/war-for-crown/fixtures/main-owner0-world-pass-production-distribution.mon
docs/war-for-crown/fixtures/main-owner0-world-pass-production-distribution.json
```

This runs `main:$5209` and then `main:$50D3` on the same C64 state. Owner `0`
starts with provinces `1` and `2`, player `1` owns province `3`, and `$C8A8 = 1`
enables equal distribution. Production changes royalist soldiers to `3/13/20`,
updates village buckets to `0/1/0`, and leaves fort buckets `0/19/0`. The
following distribution pulls fourteen mobile owner-`0` soldiers and ends at
`8/8/20`, proving the active world-pass state carries production output directly
into distribution. This fixture is compared by
`games/war-for-crown/src/game/royalists.test.ts`.

Confirmed royalist battle special-case fixtures:

```text
docs/war-for-crown/fixtures/kampf-l7e76-friendly-royalist-join.mon
docs/war-for-crown/fixtures/kampf-l7e76-friendly-royalist-join.json
docs/war-for-crown/fixtures/kampf-l7e76-neutral-royalist-no-join.mon
docs/war-for-crown/fixtures/kampf-l7e76-neutral-royalist-no-join.json
```

These run `kampf:L7E76` and prove that friendly royalists join the attacker and
skip normal combat, while neutral royalists leave battle state unchanged.

Confirmed hostile royalist attack fixtures:

```text
docs/war-for-crown/fixtures/kampf-l8461-hostile-cooperation-off.mon
docs/war-for-crown/fixtures/kampf-l8461-hostile-cooperation-on.mon
docs/war-for-crown/fixtures/kampf-l8461-hostile-cooperation.json
docs/war-for-crown/fixtures/kampf-l842e-threshold-loose-255-reject.mon
docs/war-for-crown/fixtures/kampf-l842e-threshold-loose-256-accept.mon
docs/war-for-crown/fixtures/kampf-l842e-threshold-strict-332-reject.mon
docs/war-for-crown/fixtures/kampf-l842e-threshold-strict-333-accept.mon
docs/war-for-crown/fixtures/kampf-l842e-threshold-boundaries.json
docs/war-for-crown/fixtures/kampf-l8461-hostile-full-entry-strict-accept.mon
docs/war-for-crown/fixtures/kampf-l8461-hostile-full-entry-strict-accept.json
docs/war-for-crown/fixtures/kampf-l8461-hostile-post-battle-repeat.mon
docs/war-for-crown/fixtures/kampf-l8461-hostile-post-battle-repeat.json
docs/war-for-crown/fixtures/kampf-l8461-hostile-home-castle-transfer.mon
docs/war-for-crown/fixtures/kampf-l8461-hostile-home-castle-transfer.json
docs/war-for-crown/fixtures/main-l337a-hostile-home-castle-world-pass.mon
docs/war-for-crown/fixtures/main-l337a-hostile-home-castle-world-pass.json
docs/war-for-crown/fixtures/main-l3312-hostile-home-castle-world-pass.mon
docs/war-for-crown/fixtures/main-l3312-hostile-home-castle-world-pass.json
```

These prove `$C8A6` source cooperation and `$C8A7` threshold selection for
hostile royalist attacks. The `L8461` cooperation fixtures force threshold
acceptance so source aggregation remains isolated from combat ratio math. The
full-entry fixture leaves `L842E`, `L949D`, and `L9426` unpatched and proves the
path reaches battle entry at `$7E00`. The post-battle fixture resolves real
combat, reaches `main:L4C50`, then proves the repeat dispatch
`main:L4C50 -> main:L487E -> $3009 -> kampf:L8461` by capturing a second
player-owned province in the same royalist pass. The home-castle transfer
fixture uses the same hostile `kampf:L8461` entry but makes province `4`
unattackable by leaving adjacent owner-`0` province `3` with no mobile soldiers;
royalists then capture home province `2` from province `1`, and `main:L4C7A`
transfers province `4` to owner `0` without a second battle. The `main:L337A`
fixture starts at the royalist world-pass caller and proves that after this
home-castle capture, C64 still enters `main:L5209`, runs production over the
newly owner-`0` provinces, enters `main:L50D3`, and only then returns to its
caller. The `main:L3312` hostile fixture enters one level higher, from
end-of-round owner selection. It proves `main:L3312` wraps into owner `0`, calls
the real `main:L337A`, lets the same attack/production/distribution chain
finish, calls post-world display/status and month/weather once, skips the
eliminated player, then sets royalist victory result `$CA75 = 02`.

`games/war-for-crown/src/game/royalists.test.ts` now compares
`kampf-l8461-hostile-post-battle-repeat.json` and
`kampf-l8461-hostile-home-castle-transfer.json` for focused attack-path parity,
compares `main-l337a-hostile-home-castle-world-pass.json` against the active
TypeScript owner-`0` world phase, and compares
`main-l3312-hostile-home-castle-world-pass.json` against public
`advance-step` end-of-round behavior. The comparison covers attack targets,
final owner maps, final soldier maps, the C64 rule that a single remaining
baron does not win while owner `0` still owns land, the C64 rule that a
royalist home-castle capture transfers the defeated player's remaining
provinces before win checks, and the C64 ordering where production follows the
attack pass before terminal game-over state is reported by the turn owner
selector.

Confirmed combat-round edge fixtures:

```text
docs/war-for-crown/fixtures/kampf-round-1v1-min-hit-rng00.mon
docs/war-for-crown/fixtures/kampf-round-1v1-min-hit-rng00.json
docs/war-for-crown/fixtures/kampf-round-20v1-defender-clamp-rng7b.mon
docs/war-for-crown/fixtures/kampf-round-20v1-defender-clamp-rng7b.json
docs/war-for-crown/fixtures/kampf-round-20v6-terrain7-fort6-rng7b.mon
docs/war-for-crown/fixtures/kampf-round-20v6-terrain7-fort6-rng7b.json
docs/war-for-crown/fixtures/kampf-round-300v300-multibyte-rng7b.mon
docs/war-for-crown/fixtures/kampf-round-300v300-multibyte-rng7b.json
```

These run `kampf:L8618` and stop at `$86C4`, after casualty subtraction and
clamps but before stat-counter side effects shift `L92C2..L92C7`. The
terrain7/fort6 fixture also runs real `sys:L949D` setup before the combat round.
The 300v300 fixture proves multi-byte soldier arithmetic.

Confirmed weather fixture:

```text
docs/war-for-crown/fixtures/main-weather-selection-drift-boundaries.mon
docs/war-for-crown/fixtures/main-weather-selection-drift-boundaries.json
```

This runs `main:L3D7C` and `main:L3DCD`, patches only `sys:L982F` to return a
fixed weather roll, and proves next-month season selection plus `$CA4C/$CA4D`
drift and clamp boundaries.

Confirmed simple event-effect fixture:

```text
docs/war-for-crown/fixtures/main-event-module-effects-simple.mon
docs/war-for-crown/fixtures/main-event-module-effects-simple.json
docs/war-for-crown/fixtures/main-event-module-effects-money-oneshot.mon
docs/war-for-crown/fixtures/main-event-module-effects-money-oneshot.json
```

These load representative event modules at `$5500`, call their normal `$5504`
entrypoint, stub only UI/redraw helpers, and prove village addition, soldier
loss, deserter handoff, dormant `RTS` entrypoints for `zj` and `zn`,
money-gain/loss helpers, year gates, one-shot `$CA61` flags, home-province
recruit events, forest village loss, and fortification fire.

Confirmed computer baron economy fixture:

```text
docs/war-for-crown/fixtures/cbaron-5800-economy-branch-vectors.mon
docs/war-for-crown/fixtures/cbaron-5800-economy-branch-vectors.json
docs/war-for-crown/fixtures/cbaron-l62bc-total-wrap.mon
docs/war-for-crown/fixtures/cbaron-l62bc-total-wrap.json
```

This runs the `$5800` economy entry for debt/interest and recruitment branches,
then directly runs `L5BC6` for iterative village buying. It proves home-province
recruitment, neighbour-pressure adjustment from `$C9EE/$C9F2/$C9F6`, and
immediate village spending. The direct `L62BC` fixture patches `L63B9` to return
two large marked-province requirements and proves that the total requirement is
stored as a wrapping three-byte value in `$C9D3..$C9D5`.

Confirmed C64 map-generation golden fixture:

```text
docs/war-for-crown/fixtures/menue-map-generation-sequential-rng.mon
docs/war-for-crown/fixtures/menue-map-generation-sequential-rng.json
```

This loads `kernal` at `$0800` and `menue` at `$3000`, patches
`kernal:L218B` to return deterministic bytes `1, 2, 3, ...`, runs
`menue:L5101` with `$C8A1 = 30`, and captures the final `$C400..$C4EF`
visible map, `$C512` seed table, and `$C576` terrain table. It proves the full
generator path for the executed deterministic RNG stream; focused
`kernal:L216B` cleanup and terrain-retry edge fixtures still remain before
claiming port parity.

Confirmed C64 map cleanup predicate fixture:

```text
docs/war-for-crown/fixtures/kernal-l216b-map-cleanup-neighbors.mon
docs/war-for-crown/fixtures/kernal-l216b-map-cleanup-neighbors.json
```

This runs `kernal:L216B` against controlled neighbour layouts and proves the
left, right, down, up check order. The helper returns zero only when all four
orthogonal neighbours are water/zero; any nonzero byte keeps the current setup
tile as connected land.

Confirmed C64 terrain assignment fixture:

```text
docs/war-for-crown/fixtures/menue-terrain-assignment-range-retry.mon
docs/war-for-crown/fixtures/menue-terrain-assignment-range-retry.json
```

This enters `menue:L5197`, patches `kernal:L218B` with a small table-backed RNG
that preserves `X`, and proves terrain assignment as `rngByte & 7` with retry
on zero. Terrain ids `1..7` are stored per province at `$C576 + provinceIndex`.

Confirmed screen action-index fixture:

```text
docs/war-for-crown/fixtures/main-screen-action-indices.mon
docs/war-for-crown/fixtures/main-screen-action-indices.json
```

This isolates `main:L4D45/L4D4F` and `main:L42D3`. It proves that `$2028`
returning `A == $FF` is ignored until a valid field is returned, that
`L4D2B/L4D38` use `X == 0` as the abort/first-field path, and that investment
menu `A` indices dispatch to `$437B`, `$446B`, `$45FE`, `$42DF`, `$4371`, and
`$4752`. It also proves `$4371` branches to `L3E6A` for `X == 0` and to
`L3FA4` for `X != 0`.

Confirmed retreat-placement fixture:

```text
docs/war-for-crown/fixtures/main-retreat-placement-multiple-destinations.mon
docs/war-for-crown/fixtures/main-retreat-placement-multiple-destinations.json
```

This runs `main:L4F49` and `main:L4FA7` with real `sys:L9728` arithmetic. It
proves attacker survivors are distributed over `$C832 & $10` destinations,
defender survivors are distributed over `$C832 & $80` destinations, and
remainder soldiers are assigned while scanning province ids from `$C8A1` down
to `1`.

Confirmed castle-capture transfer fixture:

```text
docs/war-for-crown/fixtures/main-castle-capture-transfer.mon
docs/war-for-crown/fixtures/main-castle-capture-transfer.json
```

This runs `main:L4C7A` for human and royalist home-castle captures plus a
non-home capture control case. It proves that all provinces owned by the
eliminated player transfer to the active owner, province counts are merged, the
eliminated player's province count and `$C9FB/$CA00/$CA05` counters are zeroed,
and `$C8FB` home markers are not cleared.

Confirmed turn-owner selection fixture:

```text
docs/war-for-crown/fixtures/main-l3312-turn-owner-selection.mon
docs/war-for-crown/fixtures/main-l3312-turn-owner-selection.json
```

This runs `main:L3312` with patched side-effect routines that only increment
marker bytes. It proves normal next-player selection, zero-province player
skipping, wrap through owner `0`, world/weather call ordering, new-round flag
increment, and `$CA75` values for human, computer, and royalist continent
victories.

Confirmed cbaron movement self-patch watch fixture:

```text
docs/war-for-crown/fixtures/cbaron-l5ca5-no-self-patch-watch.mon
docs/war-for-crown/fixtures/cbaron-l5ca5-no-self-patch-watch.json
docs/war-for-crown/fixtures/cbaron-l5ca5-static-write-scan.json
```

This runs `cbaron:$5806` with `$CA48 != 0` and a VICE store watch over
`$5CC0..$5CDF`. The run stops on the wrapper breakpoint, not on the watchpoint,
so the raw-module movement entry does not patch the two `L5CA5` `CMP #$00 /
BCC` branches. The static write scan separately finds zero direct absolute
stores or absolute read-modify-write instructions into `$5CC0..$5CDF` across
the extracted `ERBENT1A` raw modules, and confirms the disk `cbaron` bytes at
`$5CCC/$5CD6` remain `C9 00 90 03`.

Prepared but not confirmed loader-level watch target:

```text
docs/war-for-crown/fixtures/full-disk-cbaron-l5ca5-loader-watch.mon
```

The target waits until after the `CBARON` file load returns at `boot:$9BDF`,
then installs a store-watch over `$5CC0..$5CDF` before the next boot call. With
`boot:L9D2D` and `boot:L9D53` stubbed, the current automated monitor run reaches
`boot:L9C0D` and KERNAL `LOAD` at `$FFD5` for the first wildcard filename
`SYS*KERNAL*MENUE`, but that LOAD does not return before the cycle limit. Do not
treat this as fixture proof until the breakpoint is actually reached and a
derived JSON result is recorded.

Confirmed cbaron full movement entry fixtures:

```text
docs/war-for-crown/fixtures/cbaron-5806-movement-entry-component-pull.mon
docs/war-for-crown/fixtures/cbaron-5806-movement-entry-component-pull.json
docs/war-for-crown/fixtures/cbaron-5806-movement-entry-simple-return.mon
docs/war-for-crown/fixtures/cbaron-5806-movement-entry-simple-return.json
docs/war-for-crown/fixtures/cbaron-5806-movement-entry-underpowered-single.mon
docs/war-for-crown/fixtures/cbaron-5806-movement-entry-underpowered-single.json
docs/war-for-crown/fixtures/cbaron-5806-movement-entry-underpowered-single-home-money.mon
docs/war-for-crown/fixtures/cbaron-5806-movement-entry-underpowered-single-home-money.json
docs/war-for-crown/fixtures/cbaron-5806-movement-entry-underpowered-multifront.mon
docs/war-for-crown/fixtures/cbaron-5806-movement-entry-underpowered-multifront.json
docs/war-for-crown/fixtures/cbaron-5806-movement-entry-l5ea4-two-candidates.mon
docs/war-for-crown/fixtures/cbaron-5806-movement-entry-l5ea4-two-candidates.json
```

The component-pull fixture stops immediately after `main:L5005` pulls mobile
soldiers out of the connected component. The simple-return fixture proves the
surplus path deposits soldiers into a staging province and writes
`$C9DE/$C9E2`. The underpowered fixtures prove the one-province deficit path
restores the original soldiers, the single-home money path converts active money
into home soldiers, and the multifront deficit path can leave a `$04` cleanup
marker while reinforcing another active frontier province. The `L5EA4`
two-candidate fixture proves the covered selector branch writes remembered
target province `1` with strength `1`.

Confirmed final-result bridge fixture:

```text
docs/war-for-crown/fixtures/code-l5297-final-result-swap.mon
docs/war-for-crown/fixtures/code-l5297-final-result-swap.json
```

This runs `code:L5297` and proves the page swap used by `code:L5960`:
`$C980..$CA7F` is exchanged with `$4D00..$4DFF`, so final result byte `$CA75`
appears at `$4DF5` immediately before the `TXTWIN` selector reads it.

## Fixture Pattern

Each fixture extraction should create:

1. monitor command file under `docs/war-for-crown/fixtures/*.mon`;
2. monitor log when needed under `/tmp/wfc-c64-logic/fixtures/*.log`;
3. derived fixture data under the repo, not raw copyrighted memory dumps;
4. doc reference from the relevant `c64-*-decompile.md` file.

Monitor command shape:

```text
; load modules or autostart disk
; set memory/register state
; run until target routine returns or hits a breakpoint
; dump only the small memory range needed for the fixture
quit
```

Do not commit full memory dumps or raw C64 binaries. Commit only derived fixture
values needed by tests, for example:

```json
{
  "routine": "kampf:L8618",
  "input": {
    "attackerSoldiers": 20,
    "defenderSoldiers": 6,
    "terrain": 4,
    "fortification": 0,
    "rngByte": 123
  },
  "expected": {
    "attackerLosses": 2,
    "defenderLosses": 5
  }
}
```

Use the original PRG load addresses when loading extracted raw modules. This is
critical for fixtures that call cross-module helpers:

| Module | Load address |
| --- | ---: |
| `kernal` | `$0800` |
| `main` | `$3000` |
| `cbaron` | `$5800` |
| `kampf` | `$7E00` |
| `sys` | `$9400` |

Confirmed computer-baron non-home capture phase-chain fixture:

```text
docs/war-for-crown/fixtures/cbaron-ai-turn-capture-transcript.mon
docs/war-for-crown/fixtures/cbaron-ai-turn-capture-transcript.json
```

This fixture runs `$5803`, `$5806`, and `$5800` on one controlled C64 state.
It proves a normal province capture without `main:L4C7A` player elimination,
then the no-frontier movement/economy continuation. The important memory result
is that `$5806` pulls all mobile soldiers from the enclosed active component and
leaves one garrison per active province, while `$5800` still hires the base
recruitment budget into the home province and runs the village-buying loop.

Confirmed computer-baron `L5EA4` movement-memory phase-chain fixture:

```text
docs/war-for-crown/fixtures/cbaron-ai-turn-l5ea4-transcript.mon
docs/war-for-crown/fixtures/cbaron-ai-turn-l5ea4-transcript.json
```

This fixture runs `$5803`, `$5806`, and `$5800` on a five-province line. `$5803`
starts no battle, `$5806` takes the multi-front underpowered `L5EA4` branch and
writes remembered target `1/1` into `$C9DE/$C9E2 + activePlayer`, and `$5800`
preserves that movement memory when the active player has no money.

## Next Fixture Targets

1. AI parity transcript fixtures that run full attack/movement/economy turns
   through public actions and compare to recovered C64 branch decisions.
2. Localization catalog coverage for recovered C64 visible text.

For final-loader bridge work in Codex, run `x64sc` monitor fixtures with a PTY.
Without a TTY the native monitor opens but does not execute the command stream.
