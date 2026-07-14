# War for Crown C64 AI Analysis

This document records the first recovered behavior of the original C64 computer
baron logic. Use it as evidence for the final C64-original AI mode, then keep
later AI variants separate.

Detailed map-AI behavior is now split into
`c64-cbaron-map-ai-decompile.md`. That document contains the attack target
selection, source pruning, movement redistribution, and retreat placement notes.

If this document conflicts with `AGENTS.md`, `AGENTS.md` wins.

## Source

Primary inspected image:

- `/mnt/c/Games/c64/WfC/ERBENT1A.D64`
- module: `cbaron`
- extracted file: `/tmp/wfc-c64-ai/erbent1a/cbaron.prg`
- load address, size, and SHA-256: `c64-baseline-manifest.json`

Disassembly was made from the PRG body after removing the two-byte load
address:

```bash
tail -c +3 /tmp/wfc-c64-re/erbent1a/cbaron > /tmp/wfc-c64-re/disasm/erbent1a-cbaron.raw
da65 --start-addr '$5800' /tmp/wfc-c64-re/disasm/erbent1a-cbaron.raw > /tmp/wfc-c64-re/disasm/erbent1a-cbaron.asm
```

`ERBENT1A` is a later/full image and may contain rules not enabled in our v0
target. Treat this analysis as behavioral evidence, not as a request to enable
supplies, catapults, or other version 2.0 concepts.

Relevant local disk images and module shapes:

- `Die_Erben_des_Throns_-_Krieg_um_die_Krone_II_(ASS).d64`
  - modules include `main`, `menues`, `kampf`, `zufall`, `kernal`;
  - no separate `cbaron` file in the directory listing.
- `ERBENT1A.D64` and `kudk.d64`
  - modules include `main`, `code`, `kampf`, `cbaron`, `menue`, `kernal`;
  - useful for direct `cbaron` annotation.
- `KRIEGUDK.D64`
  - separate 1989 BASIC/legacy branch with tokenized `kudk.hpt`;
  - not the current `ERBENT1A` `c64-original` AI baseline.

## Entry Points

`cbaron` starts with a four-entry jump table:

- `$5800 -> $5990`: computer economy/investment.
- `$5803 -> $6560`: computer attack phase.
- `$5806 -> $5D7F`: computer movement and army redistribution.
- `$5809 -> $6A64`: post-attack/post-movement consolidation helper.

The main module confirms these calls:

- `main:$487E` checks the active player computer flag and jumps to `$5803`.
- `main:$4196` checks the active player computer flag and jumps to `$5800`.
- `main:$33B3` checks the active player computer flag and jumps to `$5806`.

This matches the visible turn flow: attack, movement, then build/recruitment.

Royalist/Kingsmen logic is separate from the computer baron jump table:

- turn cycling wraps active player to `0` after the last configured player;
- owner/player `0` is Königstreuen/Kingsmen, not a normal baron slot;
- `main:$337A` runs the royalist pass as:
  - `$487E`, which for active player `0` jumps through `$3009 -> $7E03`;
  - `$5209`, royalist production/investment;
  - `$50D3`, royalist distribution/pressure pass;
- `kampf:$7E03 -> $8461` runs hostile royalist attacks when the royalist
  attitude setting is hostile.

## State Fields

Recovered state meanings used by the AI:

- `$1624`: active player index.
- `$C896`: configured player count.
- `$C8B5 + owner`: province count for owner/player. `$C8B5` without an index is
  the royalist province count because owner `0` is Königstreuen/Kingsmen.
- `$C9D9 + player`: non-zero for computer-controlled player.
- `$C8FB + player`: home province.
- `$C8BB/$C8C0/$C8C5 + player`: player money as a multi-byte integer.
- `$C5DA + province`: province owner.
- `$C706/$C76A/$C7CE + province`: province soldiers as a multi-byte integer.
- `$C6A2 + province`: village count, inferred from the build-village loop.
- `$C63E + province`: province fortification level. This is confirmed across
  setup, human investment, AI investment, battle setup, fort damage, and
  fort-degradation code paths.
- `$C832 + province`: temporary bit flags for selection, reachability, attack
  source/target, and movement worklists; see
  `c64-c832-flags-decompile.md` for context-specific bit meanings.
- `$C9EE/$C9F2/$C9F6 + player`: soldiers hired this economy pass.
- `$C9DE + player` plus `$C9E2/$C9E6/$C9EA + player`: remembered province and
  strength used by the movement/threat logic.

Recovered setup fields relevant to the C64-original target:

- `$C8A5`: royalist attitude: `0` friendly, `1` neutral, `2` hostile.
- `$C8A6`: royalist attack cooperation toggle. In hostile royalist attack
  logic, zero stops after one adjacent royalist source, non-zero keeps
  collecting adjacent sources.
- `$C8A7`: royalist success-evaluation toggle. It changes the comparison
  threshold used before committing royalist attacks.
- `$C8A8`: royalist distribution mode. Zero disables the `$50D3` distribution
  pass.
- `$C8A9`: royalist growth factor setup value.
- `$C8B3`: royalist growth percentage after setup normalization.
- `$C8B4`: royalist investment percentage after setup normalization.
- `$C8AF`: maximum fortification level for non-home provinces.
- `$C900`: village price.
- `$C901`: interest rate.
- `$C902 + province`: royalist saved village-investment production.
- `$C966 + province`: royalist saved fortification-investment production.

`$C832` is a scratch flag byte, not one persistent state enum. The important
current finding is that C64 AI uses temporary marked province sets, not only one
isolated province at a time. The shared map helpers in `kernal` confirm the core
mechanics:

- `kernal:$2253` masks every province flag with register `X`.
- `kernal:$219C` marks provinces adjacent to `$161F` with bit `$80`.
- `kernal:$21F0` clears high reachability bits from provinces not owned by the
  active owner/player `$1624`.
- `kernal:$2207` finds a province with `$C832 & $C0 == $80`, promotes it to
  `$C0`, and returns its id.

This is a flood-fill/reachability worklist. Any C64-original AI port must reuse
the same conceptual operation over the TypeScript map graph instead of treating
movement and attacks as isolated adjacent checks.

## Start State Recovered From C64

`menue:$30D6..$30E5` initializes every generated non-water province before home
selection:

- villages: `(rnd & 3) + 2`, so `2..5`;
- soldiers: `(rnd & 3) + 3`, so `3..6`;
- owner: `0`, meaning Königstreuen/Kingsmen;
- fortification level: `0`.

Player home selection then overwrites only the selected home province:

- soldiers become `$C8BA`, the configured starting army size, default `20`;
- owner becomes the player id;
- fortification becomes `$C8AD`, the configured home-castle level.

There is no random neutral fortification roll in this initialization path.

## Economy Behavior

Entry `$5800` is not "buy random things". It follows a structured order:

1. Handles an existing reserved/owed money value in `$CA65/$CA69/$CA6D`.
   This is from the fuller ruleset and should not enter the v0 rules unless the
   matching feature is enabled.
2. Computes currently available/mobile army strength from marked provinces.
   The helper at `$58C6` sums soldiers from selected provinces and subtracts one
   garrison per province.
3. Computes a recruitment budget from money, base percentage, and adjacent
   previous-hire pressure.
4. Recruits soldiers into the home province first, recording the amount in
   `$C9EE/$C9F2/$C9F6`.
5. Runs a village-building loop. The helper around `$5914` scores candidate
   provinces using current villages, capacity/terrain data, and upgrade state;
   `$5BC6` repeats purchases until no useful/affordable province remains.

Implementation implication for the C64-original target:

- The restored C64 AI should hire before province improvements. Base hiring
  uses the per-player percentage table; adjacent previous-hire pressure can
  raise that amount after the surplus discount.
- Village purchase should be scored per province, not simply first owned
  province by id.
- Fortification/upgrades should remain v0-compatible and must not reintroduce
  disabled supplies/catapults.

## Attack Behavior

Entry `$5803` runs:

1. `$6560`: scan and score possible targets.
2. `$6808`: choose a committed target from marked candidates.
3. shared cleanup/battle-entry helpers after attack decisions.

Important recovered behavior:

- AI builds temporary source sets through `$C832` flags.
- Combat strength is calculated over marked source provinces, again leaving one
  soldier behind per source province.
- It evaluates targets from the owned frontier, not only from the single
  strongest province.
- It compares aggregate attack strength against computed defence strength before
  committing.
- It can remember a target/frontier in `$C9DE` for later movement logic.

This is close to the player's C64 attack rule: selected source provinces commit
all mobile soldiers. The computer simply selects the source set and target
itself.

Implementation implication for the C64-original target:

- Attack selection should be target-first conceptually: score enemy/neutral
  frontier targets, then choose all useful adjacent owned sources.
- The restored C64 AI should allow multi-source attacks once the public API and UI
  can represent them cleanly.
- Current "first winning adjacent attack" AI is only a debug placeholder.

## Movement Behavior

Entry `$5806` is the most important difference from our current AI. It is not a
single adjacent balancing move.

Recovered behavior:

- It marks owned/reachable provinces through the same map-reachability helpers
  used elsewhere.
- It aggregates mobile soldiers from marked provinces, leaving one behind.
- It moves armies toward selected frontier/threat provinces.
- It uses `$C9DE/$C9E2/$C9E6/$C9EA` to remember a previously selected target or
  threat, so movement can support later attacks instead of behaving as a stateless
  one-turn shuffle.
- The helper `$6A64` handles post-attack cleanup and redistribution for marked
  provinces with too few soldiers.

Implementation implication for the C64-original target:

- Restored C64 movement should have persistent intent: chosen target/frontier,
  source set, and transferred soldiers.
- Player movement now allows transfer between any owned provinces. Restored C64
  baron movement still needs exact source-set and target/frontier behavior from
  `$5806/$5D7F/$6A64` before it can be called parity.

## Königstreuen / Kingsmen Behavior

Owner/player `0` is the royalist side. It is updated between full player rounds,
not as a normal player in the configured turn order.

Recovered pass order after the last configured player:

1. `main:$487E` with active player `0` jumps through `$3009` to `kampf:$7E03`.
   That entry points to `kampf:$8461`.
2. `kampf:$8461` runs only when `$C8A5 == 2`, the hostile royalist attitude.
   It scans player-owned provinces, gathers adjacent royalist source provinces,
   subtracts one garrison from each source, checks the attack threshold, and
   calls the battle entry `$7E00` when the attack should happen.
3. `$C8A6` controls whether hostile royalists cooperate from multiple adjacent
   source provinces. Zero means the routine stops after one source; non-zero
   allows it to keep collecting sources. This is confirmed by
   `fixtures/kampf-l8461-hostile-cooperation.json`.
4. `$C8A7` controls which threshold comparison is used by `kampf:$842E` before
   a hostile royalist attack is accepted. This is confirmed by
   `fixtures/kampf-l842e-threshold-boundaries.json`: zero selects `>= 256`,
   non-zero selects `>= 333`.
   `fixtures/kampf-l8461-hostile-full-entry-strict-accept.json` confirms the
   unpatched threshold path reaches battle entry at `$7E00`.
5. `fixtures/kampf-l8461-hostile-post-battle-repeat.json` confirms that after
   a real resolved battle, `main:L4C50` dispatches through
   `main:L487E -> $3009 -> kampf:L8461` and can launch another hostile royalist
   attack in the same world pass.
6. `fixtures/kampf-l8461-hostile-home-castle-transfer.json` confirms that the
   hostile royalist `kampf:L8461` path can capture a player's home province and
   then use `main:L4C7A` to transfer that player's other provinces to owner `0`
   without separate battles.
7. `fixtures/main-l337a-hostile-home-castle-world-pass.json` confirms that
   `main:L337A` continues into `main:L5209` after a hostile royalist
   home-castle capture eliminated the last player inside the attack pass.
8. `fixtures/main-l337a-hostile-nonhome-world-pass.json` confirms that
   `main:L337A` also continues into `main:L5209` and `main:L50D3` after a
   hostile royalist non-home capture; the player home marker remains set, no
   game-over is raised, and distribution runs on the expanded owner-`0`
   component.
9. `fixtures/main-l3312-hostile-home-castle-world-pass.json` confirms that the
   end-of-round `main:L3312` caller then runs post-world display/status,
   month/weather, skips the eliminated player, wraps to owner `0`, and sets
   `$CA75 = 02`.
10. `fixtures/main-l3312-hostile-nonhome-world-pass.json` confirms that the
    same end-of-round `main:L3312` caller runs post-world display/status and
    month/weather after a hostile non-home capture, keeps `$CA75 = 00`, and
    returns active owner to player `1`.
11. `main:$5209` runs royalist production for every owner-`0` province when
   royalists are enabled. It calculates province income, splits production into
   saved village and fortification investment buckets, buys villages up to the
   allowed maximum, upgrades fortification up to `$C8AF`, and turns remaining
   production into soldiers.
12. `main:$50D3` runs only when royalists are enabled and `$C8A8 != 0`. It
   redistributes mobile soldiers across each connected royalist component:
   `$C8A8 == 1` spreads over the full component, while `$C8A8 == 2` concentrates
   on frontier provinces.

Friendly royalists also affect battles: `kampf:L7E76` checks `$C8A5 == 0` and a
defending owner-`0` target, then adds the royalist defender soldiers to the
attacker soldier total, clears defender soldiers to zero, and exits before the
normal battle loop. In practical rules terms, friendly royalist provinces join
the attacker instead of fighting. This is confirmed by
`fixtures/kampf-l7e76-friendly-royalist-join.json`; the companion neutral
fixture confirms `$C8A5 == 1` does not use the join branch.

Neutral royalists (`$C8A5 == 1`) do not run hostile attacks and do not trigger
the friendly join path. They can still use the royalist production and
distribution paths when those options are enabled.

Implementation implication:

- Kingsmen must be implemented as a world-system phase, not as an AI player
  client.
- Hostile Kingsmen attacks must be able to aggregate multiple adjacent royalist
  provinces when cooperation is enabled.
- Hostile Kingsmen attacks must re-enter attack dispatch after a resolved
  battle and continue until `kampf:L8461` finds no accepted target/source.
- Royalist production has per-province investment buckets (`$C902/$C966`);
  it is not the same as player money and must not use `PlayerState` reserves.

## C64 Parity Requirement

The shipping/default gameplay AI must be a C64 behavior copy, not a stronger
modern heuristic and not a loose approximation. Until the C64 routines are fully
annotated, any playable AI must be named as a workbench/smoke-test strategy.

There are two distinct C64 behavior families to recover:

- computer barons: player-slot AI driven by the `cbaron` attack, movement, and
  economy entry points;
- Königstreuen / Kingsmen / royalists: neutral royal forces controlled by the
  royalist attitude, growth, investment, and distribution settings.

Do not merge these into one generic AI. Computer barons consume the same public
action API as human players. Royalists are world-system behavior and must be
implemented from the original C64 rules once their state fields and update
routine are identified.

## Current Workbench AI

Keep AI modes explicit instead of replacing clients silently:

- `deterministic-debug`: current simple, transparent smoke-test AI.
- `c64-workbench`: playable reconstruction workbench based on currently
  recovered C64 structure. It is not accepted as C64 parity.
- `c64-original`: default active compatibility-target AI. It uses the recovered C64
  battle thresholds, adjacent attack-source collection, competing-frontier
  pruning, economy, movement, and owner-`0` world-phase shape, and is covered by
  headless public-API smoke tests plus targeted VICE transcript comparisons. It
  is still not final parity until broader natural seed/map transcript coverage
  proves the remaining movement-memory, owner-`0`, and localization edges.

`c64-original` should still consume only `PlayerView` and return public
`WarForCrownAction` values. Do not let it read or mutate full `GameState`.
The pluggable strategy boundary is specified in `ai-strategy-interface-v0.md`.

Suggested implementation order:

1. Keep the current workbench AI available for smoke tests, but do not label it
   as final C64 behavior.
2. Keep the recovered C64 ratio thresholds in `c64-original` and workbench AI;
   do not reintroduce the old deterministic `battle.ts` prediction helpers into
   compatibility paths.
3. Keep the active `$5800/$5803/$5806` reducers fixture-backed. Current targeted
   transcripts cover no-battle, non-home capture with no-frontier continuation,
   L5EA4 movement-memory, branching underpowered movement, defender retreat, and
   attacker retreat; broader natural map transcripts are still required.
4. Finish Königstreuen/Kingsmen world-system parity:
   hostile attacks now use the `$8461` default shape and C64 battle helpers;
   production through `$5209`, distribution through `$50D3`, first-class owner
   `0`, and focused hostile fixtures are active; config/UI labels for
   `$C8A6/$C8A7` remain.
5. Re-run long headless matches and compare transcript shape against C64
   expectations: recruitment before expansion, armies flowing to frontiers, and
   no idle landless players.

## Open Questions

- Keep the 1989 BASIC `KRIEGUDK` logic separate as `legacy-1989`; do not mix its
  variable attack/troll rules into `ERBENT1A` `c64-original`.

## Restoration Work Items

1. Port Kingsmen/Königstreuen as first-class world-system modules:
   - hostile attack pass at `kampf:$8461`,
   - production/investment pass at `main:$5209`,
   - distribution/pressure pass at `main:$50D3`.
2. Build small derived fixtures from C64 state:
   - memory/state before routine,
   - chosen action or changed fields after routine,
   - equivalent TypeScript state and expected action/update.
3. Only after fixtures exist, promote behavior from `c64-workbench` to
   `c64-original`.
