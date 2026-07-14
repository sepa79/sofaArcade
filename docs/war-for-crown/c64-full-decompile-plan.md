# War for Crown C64 Full Logic Decompile Plan

This is the execution plan for reaching a defensible C64-compatible ruleset.
It is not a gameplay design document. It defines how C64 behavior is recovered,
recorded, tested, and then ported into typed TypeScript.

## Goal

Recover the complete C64 game logic needed for `c64-original` mode:

- setup options and their normalized memory values,
- map generation rules,
- turn order and player elimination,
- weather, events, income, and interest,
- player attack, battle, retreat, victory, movement, and investment rules,
- computer baron attack, movement, and economy decisions,
- Königstreuen/Kingsmen attack, production, distribution, and battle behavior.

The target is behavioral parity, not reuse of C64 binaries. Every implemented
rule must cite a C64 address/routine, manual section, or captured C64 trace.

## Non-Goals

- Do not enable C64 2.0/full ruleset features in the simple mode merely because
  a later disk contains them.
- Do not port supplies, catapults, or troop-type distribution until their exact
  C64 scope is explicitly selected.
- Do not label heuristic behavior as `c64-original`.
- Do not keep duplicate rule sources in docs and TypeScript. Docs record
  evidence; TypeScript owns executable behavior.

## Source Priority

1. The actual game binary running under VICE.
2. Static disassembly of the same disk/module.
3. The C64 manual.
4. Direct user memory of the tape-era/simple flow, marked as observation until
   matched to code or emulator behavior.

When sources disagree, the selected C64 disk image plus live VICE trace wins.

## Working Disk Set

Primary candidates:

- `/mnt/c/Games/c64/WfC/ERBENT1A.D64`
- `/mnt/c/Games/c64/WfC/kudk.d64`
- `/mnt/c/Games/c64/WfC/Die_Erben_des_Throns_-_Krieg_um_die_Krone_II_(ASS).d64`
- `/mnt/c/Games/c64/WfC/KRIEGUDK.D64`

The selected baseline for the current `c64-original-simple` work is
`ERBENT1A.D64`, with supplies/catapults/full-rules branches excluded from the
simple ruleset. `KRIEGUDK.D64` is documented separately as a 1989 BASIC/legacy
branch and must not be mixed into the `ERBENT1A` mode.

## Required Artifacts

Each decompiled subsystem must produce four artifacts:

1. `docs/war-for-crown/c64-*-analysis.md`
   - addresses, routines, state fields, branch meaning, and uncertainties.
2. Derived fixture data
   - tiny JSON-like memory/state snapshots or tables, not raw copyrighted
     binaries.
3. Pure TypeScript implementation
   - small module, no scene logic, no hidden state access.
4. Unit tests
   - fixture-driven tests that assert the recovered behavior.

No subsystem is accepted with only prose or only code.

## Annotation Format

Every routine note should use this shape:

```text
Routine: module:$ADDR label
Called from: module:$ADDR, module:$ADDR
Reads: $ADDR meaning, $ADDR+X meaning
Writes: $ADDR meaning
Inputs: A/X/Y/carry/zero or memory fields
Outputs: changed memory fields, carry/zero meaning
Behavior:
- exact branch rule
- exact constants
Open:
- unresolved flag/table/math
TypeScript target:
- module/function/test fixture
```

## Phase 0: Baseline And Tooling

Deliverables:

- confirm selected baseline disk image and module list,
- extract modules to `/tmp/wfc-c64-full-*`,
- record SHA-256, load address, size for each module,
- produce stable disassembly commands for each module,
- set up a repeatable VICE monitor workflow for memory dumps.

Acceptance:

- every later address citation can be reproduced from documented commands;
- selected disk/version is named in `c64-rules-decompile.md`.

## Phase 1: Global Memory Map

Scope:

- active player and configured player count,
- owner/player province counts,
- province owner, soldiers, villages, fortification,
- player money, home province, computer flag,
- temporary map flags,
- royalist settings and production buckets,
- weather/event/month/year fields.

Known anchors:

- `$1624`: active player index,
- `$C896`: configured player count,
- `$C8B5 + owner`: province count,
- `$C8FB + player`: home province,
- `$C9D9 + player`: computer flag,
- `$C5DA + province`: province owner,
- `$C706/$C76A/$C7CE + province`: soldiers,
- `$C6A2 + province`: villages,
- `$C63E + province`: province fortification level,
- `$C832 + province`: temporary flags.

Acceptance:

- every field used by game rules has one documented meaning;
- unknown bytes are explicitly marked unknown and are not implemented.

## Phase 2: Setup And Options

Scope:

- setup screens and all option ranges,
- default values,
- normalization formulas,
- player count, AI count, royalist attitude/options,
- starting money, starting soldiers, costs, max fortification settings.

Key targets:

- `menue` setup screens,
- setup values around `$C8A5..$C8B4`,
- cost fields around `$C900/$C901`.

Acceptance:

- one table maps visible option text to memory field and TypeScript config;
- disabled features for simple mode are documented as intentionally out of
  scope, not missing.

## Phase 3: Map Generation

Scope:

- water/home-spot setup,
- 20x12 buffer semantics,
- province growth loop,
- terrain assignment,
- province adjacency,
- initial neutral villages/soldiers/forts.

Known anchors:

- `$C400` map buffer,
- growth loop around `$4D59`,
- neutral initialization at `menue:$30D6..$30E5`.

Acceptance:

- TypeScript map generator has a C64-compatible mode using the same ranges and
  growth semantics;
- statistical visual differences are intentional settings, not accidental
  algorithm drift.

## Phase 4: Turn Flow, Victory, And State Transitions

Scope:

- exact player/royalist turn order,
- title/status notifications,
- month/year advancement,
- game-over flow,
- player elimination after home-castle capture,
- transfer of eliminated armies/provinces.

Acceptance:

- headless transcript proves no eliminated player receives a turn;
- home-castle capture tests cover player attacker and royalist attacker;
- victory condition is documented with C64 evidence.

## Phase 5: Economy, Weather, Events

Scope:

- weather selection,
- income calculation,
- interest,
- random event timing and effects,
- village income terrain modifiers,
- any C64-simple event exclusions.

Acceptance:

- each visible income number can be traced to province villages, terrain,
  weather, event, and interest fields;
- random event fixtures can be replayed deterministically with injected RNG.

## Phase 6: Player Attack And Battle

Scope:

- target-first attack selection,
- source toggling and source flags,
- all-mobile-soldiers attack commitment,
- battle screen loop,
- combat round arithmetic and random hit generation,
- retreat commands and retreat destination choice,
- castle capture and elimination,
- battle summary text/flow.

Known anchors:

- `kampf:$7E64` battle loop,
- `kampf:$83C4` input command dispatcher,
- `kampf:L8568/L85C0/L8618` hit calculations,
- `sys:$9426/$946F/$9486` AI battle retreat ratio and thresholds.

Acceptance:

- battle round resolver has fixture tests from recovered arithmetic;
- AI and human battle commands use the same battle state and action API;
- no battle is resolved as a hidden summary in game mode.

## Phase 7: Movement

Scope:

- player movement legality,
- connected-owned-path movement if present in C64,
- source/destination selection,
- allowed soldier counts,
- automatic/QOL redistribution from PC/C64 if present.

Key targets:

- player movement routines in `main`,
- `cbaron:$5806/$5D7F`,
- shared reachability helpers in `kernal`.

Acceptance:

- public API and UI movement match C64 legality;
- modern slider UI is only a presentation layer over C64-compatible rules.

## Phase 8: Player Investment

Scope:

- build village action,
- recruit soldiers into home province,
- fortification upgrades,
- exact costs and caps,
- order and restrictions.

Acceptance:

- recruitment never creates free/reserve troops;
- home province recruitment and village/fort purchases match C64 fields and
  tests.

## Phase 9: Computer Baron AI

Scope:

- `cbaron:$5800` economy,
- `cbaron:$5803` attack,
- `cbaron:$5806` movement,
- `cbaron:$5809/$6A64` cleanup,
- target memory and threat state,
- exact scoring constants and branch order.

Acceptance:

- `c64-original` AI consumes only `PlayerView` and returns public actions;
- `c64-workbench` remains available as non-parity comparison;
- fixture tests prove each recovered routine chooses the same action as C64 for
  representative states.

## Phase 10: Königstreuen / Kingsmen

Scope:

- hostile attacks through `kampf:$7E03 -> $8461`,
- recovered friendly/neutral battle behavior around `kampf:$7E76`,
- production/investment through `main:$5209`,
- distribution/pressure through `main:$50D3`,
- cooperation/evaluation toggles `$C8A6/$C8A7`,
- growth/investment settings `$C8B3/$C8B4`.

Acceptance:

- royalists are implemented as a world-system phase, not as a fake player;
- hostile royalists can aggregate multiple sources when C64 settings allow it;
- production uses per-province royalist buckets, not player money.

## Phase 11: Long-Run Verification

Scope:

- deterministic injected RNG mode,
- journal/replay transcripts,
- AI-vs-AI long matches,
- C64 trace comparisons for selected seeds/states,
- browser smoke for visible battle and game-over flow.

Acceptance:

- `pnpm --filter war-for-crown test`, lint, and build pass;
- headless matches either reach game-over or hit a documented stalemate budget
  without illegal states;
- representative transcripts show C64-shaped behavior:
  recruitment before expansion, armies moving to frontiers, battle retreats,
  castle elimination, and active royalist pressure.

## Implementation Rule

For each subsystem:

1. document recovered addresses and behavior,
2. add or update fixture tests,
3. implement the smallest pure module change,
4. wire public API/scene only after pure tests pass,
5. run test/lint/build,
6. update `c64-rules-decompile.md` from tentative to confirmed.

No code change may be called C64 parity until step 6 is complete.

## Immediate Next Slice

The first static decompile pass is now far enough that the next work is fixture
extraction, not broad searching. Track status in
`c64-port-completeness-matrix.md`.

1. Build AI parity transcript fixtures that run full attack/movement/economy
   turns through public actions and compare to recovered C64 branch decisions.
2. Complete PL/EN localization catalog coverage for recovered C64 visible text.
3. Keep `KRIEGUDK.D64` as a separate `legacy-1989` research target; do not merge
   its variable attack/troll/dragon rules into `c64-original-simple`.
