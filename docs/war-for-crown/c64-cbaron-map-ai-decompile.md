# War for Crown C64 `cbaron` Map AI Decompile

This document records the current address-backed decompile of the original C64
computer baron map behavior: what it attacks, what it refuses to attack, how it
chooses sources, how it moves armies, and how battle retreats are placed back on
the map.

It extends `c64-ai-analysis.md` and supersedes older notes that treated
`cbaron` as only a broad structural match.

## Entry Points

`ERBENT1A.D64`, module `cbaron`, load `$5800`:

| Entry | Routine | Meaning |
| --- | --- | --- |
| `$5800` | `cbaron:L5990` | economy/investment |
| `$5803` | `cbaron:L6560` | attack |
| `$5806` | `cbaron:L5D7F` | movement/redistribution |
| `$5809` | `cbaron:L6A64` | post-action cleanup/consolidation |

Main confirms the phase order:

| Main routine | Meaning | AI jump |
| --- | --- | --- |
| `main:L487E` | attack phase | `cbaron:$5803` |
| `main:L33B3` | movement phase | `cbaron:$5806` |
| `main:L4196` | build/recruit phase | `cbaron:$5800` |

## Shared Main Helpers

The `main` module exposes a jump/helper table used by `cbaron`.

| Address | Target | Meaning in AI context |
| --- | --- | --- |
| `$301D` | `main:L5193` | calculate one-province income/value |
| `$3020` | `main:L5134` | promote current reachable set into bits `$10/$01` |
| `$3023` | `main:L514A` | filter/promote frontier/reachable set |
| `$3026` | `main:L50B7` | clear bit `$10`, then mark all active-owned provinces with `$10` |
| `$3029` | `main:L4F49` | distribute `$C9D0..$C9D2` across bit `$10` provinces |
| `$302F` | `main:L5005` | collect mobile soldiers from bit `$10` provinces, leaving `1` garrison |
| `$3032` | `main:L5069` | sum mobile soldiers from bit `$80` provinces |
| `$3035` | `main:L4A49` | enter shared attack/battle resolution path |
| `$3038` | `main:L456F` | update loss/stat counter |

## Economy AI: `cbaron:$5800 -> L5990`

Computer baron economy is recovered structurally and has fixture-backed branch
vectors. The active port uses the shared recovered required-strength arithmetic
instead of a heuristic; keep this path fixture-backed because
`L62BC -> L63B9 -> L642F -> sys:L9781` controls the surplus discount used by
pressure recruitment.

Evidence: `cbaron:L5990..L5C41`, `cbaron:L5914`, `cbaron:L5BC6`,
`fixtures/cbaron-5800-economy-branch-vectors.json`,
`fixtures/cbaron-ai-turn-no-attack-transcript.json`,
`fixtures/cbaron-ai-turn-attacker-retreat-transcript.json`,
`fixtures/cbaron-ai-turn-capture-transcript.json`, and
`fixtures/cbaron-ai-turn-l5ea4-transcript.json`.

### Interest / Reserved Money

At entry, `L5990` subtracts `$CA65/$CA69/$CA6D + player` from current money
`$C8BB/$C8C0/$C8C5 + player`.

- If the subtraction underflows, the original money is restored and passed
  through `L59C0`.
- `L59C0` multiplies the restored amount by `(100 + $C901) / 100`, then stores
  the result both as current money and as the new reserved/owed value.
- `$C901` is the setup interest percentage.

For the simple rules baseline, this is active. The same cash-saving trick exists
in the C64 game: saved money is carried through the end-of-investment interest
path, so long games can grow large cash reserves and later convert interest into
home-province recruits.

### Recruitment Budget

When the baron can pay the reserved amount:

1. it marks active-owned provinces and frontier context;
2. `L58C6` sums mobile soldiers from marked provinces, subtracting one garrison
   per province;
3. `L62BC` computes required defensive strength for the marked set;
4. the non-negative surplus `(mobile - required)` is multiplied by `179`
   (`#$B3`) and stored in `L580C..L580E`;
5. `L5B93` computes `95%` (`#$5F`) of current money into `$C9D0..$C9D2`;
6. current money is multiplied by a per-player percentage table
   `L5BC0 = [0, 20, 40, 25, 20]` and divided by `100`;
7. if no adjacent non-active owner has a previous same-turn hire at least as
   large as `baseRecruitment + surplusDiscount`, the chosen amount is the base
   percentage from step 6;
8. otherwise the chosen amount is
   `min(previousAdjacentOwnerHire - surplusDiscount, floor(money * 95 / 100))`;
9. the chosen amount is subtracted from player money and added to the player's
   home province `$C8FB + player`;
10. the hired amount is recorded in `$C9EE/$C9F2/$C9F6 + player`.

Important rule: recruited soldiers go directly to the home province. There is
no reserve pool and no "free troops" state.

Port split and current status:

- a pure recruitment-decision helper may stop at the same point as the
  `cbaron-5800-economy-branch-vectors` fixture (`$5B68`), returning the chosen
  hire amount, base budget, 95% cap, surplus discount, and whether adjacent
  previous-hire pressure was used; this exists in
  `games/war-for-crown/src/game/c64-cbaron-economy.ts`;
- the full `$5990` reducer now runs recruitment, `L5BC6` village buying, and the
  final `L59C0` money/carryover update;
- active `c64-original` investment now uses a phase-level
  `run-c64-baron-economy` action instead of pretending the C64 entrypoint is a
  sequence of human build/recruit clicks.

Do not wire the pure decision helper as a public action by itself and call that
full parity. The C64 routine performs recruitment, village spending, C64 memory
updates, and final carryover handling in one entrypoint.

### Required-Strength Worklist And Owner Scan

Evidence: `cbaron:L62BC`, `cbaron:L634A`, `cbaron:L63B9`,
`cbaron:L5815`, `cbaron:L5850`, `main:L5069`, `cbaron:L642F`,
`sys:L96D7`, `sys:L96E1`, `sys:L9728`, `sys:L9781`, `sys:L981E`.

`L62BC` sums a required-strength value for every province currently marked with
`$C832 & $10`. It scans downward from `$C8A1` to `1`; unmarked provinces are
ignored. For each marked province:

```text
L63B9:
  L634A  choose the opposing owner with the largest adjacent mobile force
  L642F  transform that force through battle percentages for the province
```

`L634A` is an owner-slot scan, not a target heuristic:

1. it stores the original active owner `$1624` in `$C9D8`;
2. it clears `$161A..$161C`, the current strongest adjacent mobile force;
3. it scans owner slots from `0` through `$C896`, skipping the original active
   owner and skipping slots where `$C8B5 + owner == 0`;
4. for each live other owner, it masks `$C832` with `$3F`, marks provinces
   adjacent to current province `$161F` with `$80`, keeps only provinces owned
   by the scanned owner through `kernal:L21F0`, then calls `L5815`;
5. if the resulting `$C9D3..$C9D5` is greater than or equal to the current
   `$161A..$161C`, it replaces the strongest value and stores that owner in
   `L63B8`;
6. equality replaces the previous owner because the branch is `BCC`, so the
   later owner slot wins equal-strength ties;
7. `$1624` is restored before returning.

`L5815/L5850` calculate the adjacent mobile force for the owner currently in
`$1624`:

| Owner case | C64 path | Result |
| --- | --- | --- |
| normal player owner | `L5850 -> main:L5069` | sum `soldiers - 1` over adjacent `$80` provinces owned by that player |
| computer player owner | `L5850 -> main:L5069 -> L5828` | same numeric result for all valid 24-bit soldier counts in this binary |
| royalist owner `0`, attitude not hostile | `L5850` exits at `L58C5` | `0` threat |
| hostile royalist owner `0`, cooperation off | `L5850:L586C` | strongest single adjacent royalist province, then subtract one garrison |
| hostile royalist owner `0`, cooperation on | `L5850 -> main:L5069` | sum `soldiers - 1` over all adjacent royalist provinces |

The computer-owner `L5828` path is a quirk in this binary. It copies
`$C9D3..$C9D5` to `$5B..$5D`, calls `sys:L96D7` with multiplier `$D3`, then
copies `$5C..$5E` back to `$C9D3..$C9D5`. `sys:L96D7` leaves `$5B..$5E` as the
left operand shifted eight times for any 24-bit input, so `$5C..$5E` reconstruct
the original 24-bit value. The product lives in `$5F..$62`, but `L5828` does not
read it.

`L642F` uses `sys:L949D` combat percentages, then applies the C64 division helper
`sys:L9728`, the square-root/Newton helper at `sys:L9781`, 32-bit multiplication
`sys:L96E1`, and a final division by `$E0` (`224`).

`sys:L96E1` is byte-level arithmetic, not checked integer multiplication. It
accumulates only `$5F..$62`; if the high-byte add carries out, the routine
returns immediately with the current low 32-bit product state. Long AI matches
can hit this through `L6484`, so overflow must remain C64 behavior instead of a
JavaScript exception.

Listing-backed inference for the arithmetic shape:

```text
combatRatioQ16 = floor(($9400 << 16) / $9401)
root = sysL9781(combatRatioQ16)
required = floor(root * strongestAdjacentMobile / 224)
```

`$9400` is the attacker combat percentage and `$9401` is the defender combat
percentage from `sys:L949D`. `strongestAdjacentMobile` is the `$161A..$161C`
value selected by `L634A`. `sys:L9781` is a rounded square-root/Newton helper,
not plain `floor(sqrt())`; for example the helper yields `2` for input `2` and
`219` for input `46811`, while mathematical square roots are about `1.41` and
`216.36`.

The TypeScript port now has direct helpers for `sys:L9781`, the `L642F`
arithmetic shape, and the pure `L62BC/L63B9` worklist over `ProvinceState`
arrays. The helper uses explicit C64 owner slots where slot `0` is the royalist
owner and player slots are scanned in C64 order.

Current wiring work: `$5800` economy and the active `$5806` movement helper call
this requirement helper. Remaining byte-parity work is to build every `$C832 &
$10` set through the exact preceding C64 branches instead of the still-simplified
movement branch selection.

The active code must not use `minimumC64AttackersForThreshold` or any frontend
`PlayerView` approximation as a substitute for `L62BC`.

Confirmed VICE fixture:

| Case | Setup | Observed |
| --- | --- | --- |
| debt underflow | active player has `50` money, `80` reserved debt, `$C901 = 8` | cannot pay debt; money and reserved debt both become `54` |
| base recruitment | active player has `100` money, no neighbouring previous hire, home has `10` soldiers | hires `20`, money becomes `80`, home soldiers become `30`; `95%` cap is `95`, surplus discount is `4` but not used |
| pressure recruitment | same setup, but adjacent owner `2` has previous hire `50` in `$C9EE + 2` | hires `46` (`50 - 4`), money becomes `54`, home soldiers become `56` |
| neutral economic frontier | active player borders only neutral owner `0`; phase-chain fixture runs `$5803`, `$5806`, then `$5800` | neutral owner `0` contributes no hostile threat at neutral attitude, but still marks an economy frontier; `$5800` hires `4`, buys four villages, and leaves money `0` |
| no economy frontier after capture | `$5803` captures a non-home province, `$5806` pulls all mobile soldiers from the now-enclosed active component, and `$5800` runs with no adjacent non-active owner | no-frontier does not skip recruitment; `$5800` still hires the base slot budget (`4` from `20` talers), buys four villages, and leaves money `0` |
| L5EA4 movement-memory phase chain | `$5803` rejects both frontier targets in a five-province line, then `$5806` enters the multi-front underpowered `L5EA4` branch and `$5800` runs with zero active money | movement pulls three mobile soldiers, ends at soldiers `1/4/1/1/20`, marks province `4` with `$04`, writes remembered target province `1` with strength `1`, and economy preserves that memory |
| defender-retreat phase chain | `$5803` captures a non-home target after defender retreat, then the same state runs `$5806` and `$5800` | movement restores owners `1/1/2` and soldiers `1/93/41`, writes remembered target province `3` with strength `41`, and economy preserves that memory while hiring `4`, buying four villages, and leaving money `0` |
| attacker-retreat phase chain | `$5803` starts battle, attacker retreats, then the same state runs `$5806` and `$5800` | movement leaves owners `1/2` and soldiers `6/6`; economy hires `4`, buys four villages, and leaves money `0` |

Neutral owner `0` is an economy frontier for `$5990`/`L5914`, but neutral
royalists do not add hostile required strength through `L62BC`. Hostile
royalists remain a threat through the owner-`0` threat helpers.

`fixtures/cbaron-ai-turn-capture-transcript.json` also proves that absence of
an economy frontier is not the same thing as the debt/carryover interest-only
branch. With no adjacent foreign owner after movement, the base recruitment
budget still goes to the home province before the village-buying loop runs.

### Village Purchase Scoring

`L5BC6` repeats village purchases until no target remains.

`L5914` chooses one candidate province:

1. marks active-owned/frontier sets;
2. scans owned candidates descending from `$C8A1`;
3. calls `main:L9A2A` for the current village cap;
4. skips a province when current villages `$C6A2` are already at or above cap;
5. starts score at `$46` (`70`);
6. if the province is on the frontier and is not the home province, uses score
   `$0A` (`10`) instead, unless the one-soldier/special full-rule branch skips
   it;
7. when terrain income is enabled (`$C8AC != 0`), adds the province terrain
   income coefficient from `main:$3015 + terrain`;
8. adds current fortification level `$C63E`;
9. the highest score wins; equal scores replace the previous best, so lower
   province ids win ties under the descending scan.

`L5BC6` then:

1. computes affordable villages as `floor(money / $C900)`;
2. caps that by the missing village count;
3. if non-zero, adds villages to `$C6A2 + province`;
4. subtracts `villagesBought * $C900` from money;
5. repeats from `L5914`.

This makes AI village building province-scored and iterative, not simply
"build in first owned province".

Confirmed VICE fixture:

| Case | Setup | Observed |
| --- | --- | --- |
| village purchase | active player has `20` money, village cost `$C900 = 4`, cap patched to `12`; province `1` already has `12` villages and province `2` has `4` | `L5BC6` selects province `2`, buys `5` villages, leaves money `0`, and province `2` ends with `9` villages |

## `$C832` Flag Meanings Used Here

`$C832` is a phase-local scratch byte. The complete cross-module description is
in `c64-c832-flags-decompile.md`; this local table lists the meanings used by
the recovered cbaron routines.

| Bit | Meaning in recovered routines |
| --- | --- |
| `$01` | locked/spent/excluded province; AI avoids using it as a source |
| `$02` | accepted target candidate or temporary selected node |
| `$04` | cleanup/captured-province marker used by `L6A64` |
| `$08` | movement redistribution candidate |
| `$10` | active set: source set, target frontier set, or redistribution set depending on routine |
| `$20` | weak/surplus cleanup marker used by `L6A64` |
| `$40` | internal flood-fill component marker |
| `$80` | adjacent/reachable frontier marker |

Core reachability helpers:

- `kernal:L219C`: marks provinces adjacent to `$161F` with `$80`.
- `kernal:L21F0`: clears high bits from provinces not owned by active `$1624`.
- `kernal:L22CA`: clears high bits from provinces owned by active `$1624`.
- `kernal:L2207`: finds a `$80` province, promotes it to `$C0`, and returns it.
- `kernal:L2221`: flood-fills the active-owned connected component from
  `$161F`.
- `kernal:L2253`: masks every province flag with register `X`.

## Battle Retreat Placement

This part is not `cbaron`; it is shared battle/map behavior that affects AI and
human battles.

### AI Retreat Command

Evidence: `kampf:L83C4`, `sys:L9426`, `sys:L946F`, `sys:L9486`,
`fixtures/sys-retreat-threshold-boundaries.json`, and
`fixtures/kampf-l83c4-ai-command-dispatch.json`.

AI decision order inside the battle screen:

1. defender AI checks retreat first;
2. attacker AI checks retreat second;
3. if neither retreats, command `0` resolves a normal fight round.

Owner `0` is treated as AI-controlled on both sides by `kampf:L83C4`; it does
not need a `$C9D9 + owner` computer-player flag.

Strength ratio:

```text
floor(((attackerSoldiers * 256 / defenderSoldiers) ^ 2 / defenderCombatPercent * attackerCombatPercent) / 256)
```

Thresholds:

| Side | Command | Condition |
| --- | ---: | --- |
| attacker AI | `2` | ratio `< $00E6` (`230`) |
| defender AI | `1` | ratio `>= $01B3` (`435`) and legal retreat exists |

`sys-retreat-threshold-boundaries` confirms the exact edge behavior: attacker
helper `sys:L946F` returns carry clear at `229` and carry set at `230`;
defender helper `sys:L9486` returns carry clear at `434` and carry set at `435`.

Retreat still resolves one final simultaneous combat round before the map is
updated.

### Defender Retreat Legality

Evidence: `kampf:L7F01..L7F54` and
`fixtures/kampf-l7f01-defender-retreat-legality.json`.

Before the battle loop, C64 calculates `$9406`, the defender-retreat legality
field:

1. target province is `$C9D7`;
2. defender owner is copied to `$C9D8`;
3. if defender owner is non-zero and the target is that defender's home province
   (`$C8FB + defender == $C9D7`), `$9406` stays `0`;
4. otherwise it marks provinces adjacent to the target;
5. `kernal:L21F0` keeps only adjacent provinces owned by the defender;
6. the scan runs downward from `$C8A1`; first legal adjacent owned province id
   is stored in `$9406`;
7. if no legal adjacent owned province exists, `$9406 = 0`.

`$9406 != 0` means defender retreat is legal. The value is used for legality
and UI messaging; actual survivor placement is broader.

Confirmed fixture observations:

- a non-home defender with an adjacent owned province gets a nonzero `$9406`;
- a player home castle gets `$9406 = 0` before adjacency is checked;
- no adjacent defender-owned province leaves `$9406 = 0`;
- owner `0` skips the player-home check and can receive a legal retreat target.

### Attacker Retreat Placement

Evidence: `main:L4C5B`, `main:L4F49`.

When attackers retreat or fail while defenders still remain:

1. defender survivors `$C9D3..$C9D5` are written back to target `$C9D7`;
2. attacker survivors `$C9D0..$C9D2` are distributed by `main:L4F49`;
3. `main:L4F49` counts provinces marked with `$C832 & $10`;
4. attacker survivors are divided evenly across those original attack-source
   provinces;
5. every original source had already been reduced to `1` by `main:L5005`, so
   the returned survivors are added on top of those garrisons.

Implication: attacker retreat does not choose one source province. It spreads
survivors over the selected source set.

### Defender Retreat Placement

Evidence: `main:L4B83..L4C1C`, `main:L4FA7`.

When defender retreat command `1` succeeds:

1. attacker wins the target;
2. surviving attackers occupy target `$C9D7`;
3. the code marks provinces adjacent to target;
4. active owner is temporarily switched to previous defender `$C9D8`;
5. `kernal:L21F0` keeps only adjacent defender-owned provinces;
6. `main:L4FA7` distributes defender survivors `$C9D3..$C9D5` evenly across all
   adjacent defender-owned provinces marked with `$80`.

Implication: defender retreat is not a single-province move either. If several
legal adjacent owned provinces exist, survivors are spread across them.

## Attack AI: `cbaron:$5803 -> L6560`

The attack routine has three major stages:

1. build possible target candidates;
2. score and choose one target;
3. rebuild and prune the source set, then enter the shared battle path.

### Stage 0: Optional Full-Rules Locking

Evidence: `cbaron:L6560..L6599`.

When `$CA55 != 0`, AI starts from its home province `$C8FB + player`, flood-fills
the connected active-owned component with `kernal:L2221`, then marks active-owned
provinces outside that connected home component with `$01`.

Effect:

- disconnected active-owned provinces can be excluded as attack sources;
- this is the code path that can make AI let a pocket get cut off in full
  rules, because later source collection skips `$01` provinces.

`c64-original-simple` must keep `$CA55 = 0`. The selected simple baseline has no
supply/resource stock gameplay, so disconnected-from-home locking belongs only
to a future full-rules mode.

### Stage 0.5: Consume Remembered Movement Target

Evidence: `cbaron:L65AA..L65F4`, `sys:L9732`, and
`fixtures/cbaron-5803-remembered-target-side-effect.json`.

Before normal frontier target building, attack entry consumes movement memory:

1. if `$C9DE + player == 0`, this branch is skipped;
2. otherwise `$C9DE + player` is copied as a province id and immediately
   cleared;
3. current soldiers in that remembered province are loaded into `$5B..$5E`;
4. stored remembered strength
   `$C9E2/$C9E6/$C9EA + player` is loaded into `$57..$59`;
5. `sys:L9732` divides current remembered-target soldiers by stored remembered
   strength;
6. the quotient is folded into `$CA61/$CA62` and halved as a local pressure
   factor before regular frontier target scanning resumes.

Confirmed VICE fixture:

| Fixture | Setup | Observed |
| --- | --- | --- |
| `cbaron-5803-remembered-target-side-effect` | active player `1`; `$C9DE+1 = 2`; stored remembered strength `4`; current soldiers in province `2` are `12`; `$CA61/$CA62 = 0` | branch stops at `$65F7`; `$C9DE+1` is cleared; stored strength remains `4`; quotient `$5B = 3`; `$CA61/$CA62 = 01 00` |

TypeScript status: `games/war-for-crown/src/game/c64-cbaron-memory.ts` ports
the quotient fold into `$CA61/$CA62`, and `run-c64-baron-attack` consumes and
clears the active player's remembered target before normal target scanning.
Movement-side writes from `$5806/$6C49` are active for the simple surplus path
and the `L5EA4` two-candidate path; broader end-to-end transcript coverage is
still required before claiming every movement-memory variant.

### Stage 1: Build Frontier Target Set

Evidence: `cbaron:L6599..L6605`, `cbaron:L6B8C`.

The routine:

1. preserves only `$01` flags with `kernal:L2253(X=1)`;
2. calls `main:L50B7` through `$3026`, marking every active-owned province with
   `$10`;
3. calls `cbaron:L6B8C`.

`L6B8C`:

1. for every `$10` active-owned province, marks adjacent provinces with `$80`;
2. calls `kernal:L22CA`, removing high bits from active-owned provinces;
3. clears `$10` from all provinces;
4. promotes every remaining `$80` province to `$10`.

Result:

- `$10` no longer means owned source set;
- after `L6B8C`, `$10` means non-owned frontier target candidates adjacent to
  the AI realm.

### Stage 2: Check Which Targets Are Attackable

Evidence: `cbaron:L6605..L66A4`, `cbaron:L6532`, `kampf:$7E34`.

For every `$10` frontier target, scanning downward from `$C8A1`:

1. target id is stored in `$C9D7`;
2. target soldiers are copied to defender soldiers `$C9D3..$C9D5`;
3. adjacent active-owned provinces are marked with `$80`;
4. provinces with `$01` are ignored;
5. every remaining adjacent source contributes all soldiers minus one garrison;
6. total attacking soldiers are accumulated in `$C9D0..$C9D2`;
7. if total attack soldiers are zero, target is skipped;
8. `cbaron:L6532` compares the battle strength ratio against `$7E34`.

`$7E34..$7E36 = $00014D` (`333`).

A target becomes an accepted candidate when:

```text
battleRatio(attackingSources, target) >= 333
```

Accepted targets get bit `$02`; they keep the existing frontier-target `$10`
bit. Therefore an accepted target is normally `$12`, not plain `$02`, before
`L6808` starts.

Full-entry pre-score fixtures confirm the worklist state at `cbaron:L66B1`
immediately before `JSR L6808`:

| Fixture | `$C832` bytes | Meaning |
| --- | --- | --- |
| `cbaron-5803-attack-entry-two-source-line`, line `1-2-3` | `80 80 12 80` for index `0..3` | active-owned provinces `1` and `3` are still high-bit frontier marks; accepted target `2` is `$10|$02` |
| `cbaron-5803-attack-entry-prunes-competing-frontier`, line `1-2-3-4` | `80 80 12 80 12` for index `0..4` | both target candidates `2` and `4` are `$10|$02` before scoring |

Special case in `L650C`:

- if there are no attacking soldiers, the check fails;
- when royalists are friendly (`$C8A5 == 0`) and the target owner is `0`, the
  helper returns success early. This matches friendly royalists being treated
  specially instead of as ordinary attack targets.

### Stage 3: Score And Choose Target

Evidence: `cbaron:L6808..L699D`, `main:L5193`, `cbaron:L6E2C`,
`cbaron:L69AD`,
`fixtures/cbaron-l6808-target-3province-homebonus.json`, and
`fixtures/cbaron-l6808-target-tie-lower-id.json`,
`fixtures/cbaron-l6808-target-homebonus-carry.json`, and
`fixtures/cbaron-l6808-underpowered-royalist-attitude.json`, and
`fixtures/cbaron-l6808-rng-per-candidate.json`.

`L6808` loops over provinces with `$02`, again descending from `$C8A1`.

Scoring inputs:

| Input | Evidence | Meaning |
| --- | --- | --- |
| province income/value | `$301D -> main:L5193` | village/terrain income value of target |
| component class | `cbaron:L6E2C` | strategic connectivity class, capped at `6` |
| target support/defence estimate | `cbaron:L69AD` | required attacker-equivalent support for the current target |
| total available mobile army | `main:L50B7` + `cbaron:L58C6` | mobile soldiers across AI-owned provinces |
| target is a player home | `cbaron:L689D..L68B2` | if target equals a player's `$C8FB`, that player's province count is added as a large term |
| current target soldiers | `cbaron:L6918..L6937` | half target soldiers are added to score before subtracting support estimate |

`L6E2C` calculates the class used by the score:

1. mark the target and adjacent active-owned provinces with `$40`;
2. count adjacent active-owned provinces;
3. temporarily treat the target as active-owned;
4. for each `$40` node, mark adjacent provinces;
5. decrement the class when the would-be component touches a non-active-owned
   neighbour;
6. restore the target owner;
7. return `min(class + 1, 6)` in `L6F4D`.

The value is allowed to fall to `0` through 8-bit underflow/wrap behavior before
the final increment and cap. Port this literally, not as a graph-theory
renaming.

`L69AD` computes the target support estimate stored in `L6A61..L6A63`:

```text
adjacentSourceSoldiers = sum soldiers from adjacent active-owned sources
                         that are not locked by `$01`

targetSupportEstimate =
  floor(
    floor(targetSoldiers * targetSoldiers * defenderCombatPercent
          / attackerCombatPercent)
    / adjacentSourceSoldiers
  )
```

The combat percentages are the same `$9400/$9401` values initialized by
`sys:L949D` and documented in `c64-battle-arithmetic-decompile.md`.

Confirmed VICE fixture:

| Fixture | Setup | Observed |
| --- | --- | --- |
| `cbaron-l6808-target-3province-homebonus` | 3 provinces in a row; active player `1` owns province `1`; player `2` owns candidate provinces `2` and `3`; province `2` is player `2` home | selected target `$1602 = 2`; score bytes `$699A..$699D = ff 7f 0a 00` |
| `cbaron-l6808-target-tie-lower-id` | symmetric 3-province line; active player `1` owns middle province `2`; candidate provinces `1` and `3` have matching owner, villages, soldiers, terrain, and flags | selected target `$1602 = 1`; equal-score tie replaces the higher id candidate during descending scan |
| `cbaron-l6808-target-homebonus-carry` | active player owns province `1` with `200` soldiers; player `2` owns four provinces and home province `2`, which is the only candidate | selected target `$1602 = 2`; score bytes `$699A..$699D = 0c 00 19 00`; total mobile army is `199` |
| `cbaron-l6808-underpowered-royalist-attitude` | same 2-province setup in both runs; active player has only `1` mobile soldier; owner-`0` target has support estimate `18`; target province value is high enough to score positive if kept | neutral royalists (`$C8A5 = 1`) skip the candidate with `$1602 = 0`; friendly royalists (`$C8A5 = 0`) keep and select it with `$1602 = 1`, score `8e 00 00 00` |

Important fixture note: monitor fixtures that call `kernal:L219C/L21F0/L2207`
must load `kernal.raw` at `$0800`. Loading it at `$0000` executes unrelated
bytes at `$219C` and makes `L6E2C` appear to hang before scoring.

Single-candidate byte trace for the same home-target setup, with only province
`2` marked as an accepted candidate (`$C834 = $02`, `$C835 = $00`), confirms the
score pipeline. Each breakpoint was run in a fresh VICE monitor session; do not
reuse one multi-breakpoint run for this trace because skipped branches desync the
command stream.

| Breakpoint | Observed bytes | Meaning |
| --- | --- | --- |
| `$684B` | `$161F = 02`, `$C9D6/$C9D7 = 02/02`, `$6F4D = 07` | target `2`; `targetIncome + 4 * connectivityClass = 7` |
| `$686A` | `$6A61..$6A63 = 0a 00 00`, `$C9D0..$C9D2 = 14 00 00`, `$C9D3..$C9D5 = 04 00 00` | `L69AD` uses adjacent source soldiers as gross soldiers (`20`), not mobile soldiers; target soldiers are `4`; support estimate is `10` |
| `$6882` | `$C9D3..$C9D5 = 01 00 00`, `$580C..$580E = 13 00 00` | after temporary capture and `L62BC`, current `$10` frontier-target worklist threat is `1`; total mobile army is `19` |
| `$68C2` | `$5F..$62 = 00 00 01 00`, `$6A61..$6A63 = 0a 00 00` | home bonus is `2 * $8000 = $00010000`; support estimate is still separate |
| `$68FF` | `$C9D3..$C9D5 = 0b 00 00`, stack top at `$01FE = 80` | target debt is worklist threat `1` plus support `10`; type flag is `$80` because the target frontier touches another non-active, non-royalist owner |
| `$691D` | `$5F..$62 = 07 80 0a 00`, `$6F4D = 07` | `(homeBonus + 1 + (typeFlag << 8)) * strategicWeight = $000A8007` |
| `$6943` | `$5F..$62 = 09 80 0a 00` | `floor(targetSoldiers / 2)` adds `2` before support is subtracted |
| `$6961` | `$5F..$62 = ff 7f 0a 00`, `$6A61..$6A63 = 0a 00 00` | final score after subtracting support estimate `10`; this is the stored best score for the fixture |

Recovered score arithmetic:

```text
strategicWeight = targetIncome + 4 * connectivityClass
worklistThreat  = L62BC over current `$10` frontier-target worklist after
                  temporarily assigning the current target to the active owner
consume one RNG byte for this target candidate
if that RNG byte < $40:
  worklistThreat = L63CE-adjusted worklistThreat
targetDebt      = targetSupportEstimate + worklistThreat

if totalMobileArmy < targetDebt:
  keep candidate only when `L699E` says the owner/royalist attitude allows it
  typeFlag = 0
else:
  typeFlag = $FF by default
  typeFlag = $80 when the target frontier touches any non-royalist non-active
             owner during the pre-score scan

homeCastleBonus = 32768 * ownerProvinceCount
                  when target is a configured player home province,
                  otherwise 0

scoreBase = homeCastleBonus + 1 + (typeFlag << 8)
score     = scoreBase * strategicWeight
score    += floor(targetSoldiers / 2)
score    -= targetSupportEstimate
```

`L63CE` is fixture-backed by
`fixtures/cbaron-l63ce-home-pressure-adjustment.json`. The RNG call is inside
the candidate loop: `fixtures/cbaron-l6808-rng-per-candidate.json` proves two
accepted candidates consume two `kernal:L218B` calls. `L63CE` only runs for a
candidate when that candidate's RNG byte is below `$40`. If the active player's
home province is part of the current `$10` worklist, it subtracts a home
requirement from `$C9D3..$C9D5`, capped by active money. The cap must preserve
the C64 byte quirk: when the comparison fails on the middle byte, `$161A` gets
that compared middle byte before `$161B/$161C` are loaded from money, so money
`$0104` against requirement `$0200` produces cap `$0101`.

- if adjusted score goes negative, target is skipped;
- if score is higher than or equal to the current best, target replaces current
  best;
- because the scan is descending and equal scores replace the previous best,
  lower province ids win ties.

When total mobile army is below target debt, `L6808` calls `L699E` before
scoring. The confirmed owner-`0` attitude branch is:

- `$C8A5 == 0`: underpowered owner-`0` candidates may still be scored with
  type flag `0`;
- `$C8A5 != 0`: underpowered owner-`0` candidates are skipped before score
  arithmetic.

Selected target id is stored in `$1602`.

Open implementation caution: the score uses the C64 24/32-bit helper registers
directly. The formula above is the typed model; the existing fixtures cover
large `homeCastleBonus`, underpowered owner-`0` candidates, type-flag attitude
behavior, and equal-score replacement.

### Stage 4: Rebuild Source Set For Selected Target

Evidence: `cbaron:L66B1..L673D`.

If `$1602 == 0`, no attack happens.

Otherwise:

1. selected target becomes `$C9D7`;
2. target's `$02` bit is cleared;
3. adjacent active-owned provinces are marked with `$80`;
4. provinces with `$01` are skipped;
5. every remaining adjacent source gets `$10`;
6. every source contributes all soldiers minus one garrison to `$C9D0..$C9D2`.

At this point `$10` is again the actual source set for the attack.

Confirmed VICE breakpoint at `cbaron:L674A` for
`cbaron-5803-attack-entry-prunes-competing-frontier`:

| Bytes | Meaning |
| --- | --- |
| `$C832..$C836 = 80 90 00 90 02` | active source provinces `1` and `3` are `$80|$10`; selected target `2` has been cleared to `0`; competing accepted target `4` remains `$02` |
| `$C9D0..$C9D2 = 62 00 00` | selected source set has `98` mobile attackers before pruning |
| `$1602 = 02`, `$C9D7 = 02` | selected target is province `2` |

### Stage 5: Preserve Competing-Frontier Sources

Evidence: `cbaron:L674A..L6807`, `cbaron:L6549`, `cbaron:L5812`,
`kampf:$7E31`, and
`fixtures/cbaron-l674a-source-pruning-overkill.json`,
`fixtures/cbaron-5803-attack-entry-two-source-line.json`, and
`fixtures/cbaron-5803-attack-entry-prunes-competing-frontier.json`.

`L674A` is narrower than generic overkill pruning. Full-entry fixtures show that
the selected target's `$02` bit has already been cleared before `L674A` runs.
Therefore `L674A` scans remaining accepted target candidates (`$02`) and tries
to preserve sources that border those other still-possible fronts.

For every remaining `$02` target candidate:

1. mark provinces adjacent to that remaining candidate with `$80`;
2. keep only active-owned adjacent provinces;
3. for every province that has both `$80` and `$10`, temporarily subtract that
   source's mobile soldiers from `$C9D0..$C9D2`;
4. clear its `$10` bit;
5. call `cbaron:L6549` against the already selected target/battle totals;
6. if the reduced selected attack still passes, leave that source out;
7. if the reduced selected attack no longer passes, restore `$10` and add its
   soldiers back.

`L6549` compares against `cbaron:L5812`, which is `$0001B3` (`435`), the same
numeric threshold as defender AI battle retreat.

So competing-frontier source pruning keeps a removed source only when:

```text
battleRatio(reducedSourceSet, target) >= 435
```

Implications:

- AI does not prune sources when the selected target is the only accepted target
  candidate;
- AI may leave an adjacent source out of the selected attack when that source
  also borders another accepted target candidate;
- the source set is adjusted by remaining-target scan order, not by long-term
  map planning;
- this can look like the AI makes a strategic mistake, because it may leave
  useful forces behind for a future front instead of committing them all now.

Confirmed VICE fixtures:

| Fixture | Setup | Observed |
| --- | --- | --- |
| `cbaron-l674a-source-pruning-overkill` | isolated direct call to `L674A`; target province `2` has `1` defender; active sources `1` and `3` each have `50` soldiers and are marked `$10`; target is marked `$02`; attack total starts at `98` mobile soldiers | high-id source `3` is pruned; source `1` is restored because removing it leaves no attack; final attack total is `49`; flags are province `1 = $10`, `2 = $02`, `3 = $00` |
| `cbaron-5803-attack-entry-two-source-line` | full `$5803` entry; line `1-2-3`; active owns `1` and `3`; target `2` is the only accepted enemy candidate | selected target `2`; battle entry reached; no source is pruned; final source flags are province `1 = $10`, `2 = $00`, `3 = $10`; attack total remains `98` |
| `cbaron-5803-attack-entry-prunes-competing-frontier` | full `$5803` entry; line `1-2-3-4`; active owns `1` and `3`; selected target `2`; remaining accepted candidate `4` borders source `3` | source `3` is pruned to preserve the competing frontier; source `1` remains; candidate `4` keeps `$02`; attack total becomes `49`; battle entry reached |

### Stage 6: Commit Battle

Evidence: `cbaron:L673D`, `main:L4A49`, `main:L5005`.

After competing-frontier pruning:

1. `cbaron` calls `main:L4A49` through `$3035`;
2. `main:L5005` collects all mobile soldiers from `$10` source provinces;
3. each source is reduced to one garrison;
4. battle starts through `kampf`;
5. normal capture/retreat/elimination logic applies.

This is also the first hard guard against reusing the same army: once
`main:L5005` runs, each selected source province physically has one soldier left.
After the battle aftermath, `main:L4C3E..L4C50` sets `$01` on every province still
marked `$10`, then clears `$10` with mask `$EF`. Later attack setup rejects
sources with `$01`. A compatible TypeScript turn therefore needs both effects:
source provinces are reduced to one immediately on battle entry, and selected
source ids remain unavailable for later attacks in the same attack phase.

## Movement AI: `cbaron:$5806 -> L5D7F`

The movement routine is not a simple adjacent balance move. It is a connected
component redistribution routine.

### High-Level Flow

Evidence: `cbaron:L5D7F`.

`L5D7F` runs:

1. `L5CA5`: computes strategic pressure/stance values;
2. `L5D9C`: movement and redistribution search;
3. `L6A64`: cleanup/consolidation.

### Component Pull

Evidence: `cbaron:L5D9C..L5DC2`, `main:L5134`, `main:L5005`.

For each owned province, scanning downward:

1. skip if owner is not active player;
2. skip if `$01` locked/spent bit is set;
3. flood-fill the connected owned component from that province with
   `kernal:L2221`;
4. `main:L5134` promotes the reachable component into `$10/$01`;
5. `main:L5005` pulls all mobile soldiers out of `$10` provinces into
   `$C9D0..$C9D2`;
6. every pulled province is left with one soldier.

This explains a visible C64 pattern: AI can temporarily strip a whole connected
area down to one soldier while deciding where to redeploy.

Confirmed VICE fixture:

| Fixture | Setup | Observed |
| --- | --- | --- |
| `cbaron-5806-movement-entry-component-pull` | full `$5806` entry; line `1-2-3`; active owns provinces `1` and `2` with `5` and `6` soldiers; enemy owns province `3` | breakpoint at `$5DBF`; mobile soldiers `$C9D0..$C9D2 = 9`; provinces `1` and `2` are reduced to one soldier; source flags include `$10/$01` worklist marks |

### Threat Requirement

Evidence: `cbaron:L5DBF..L5DC2`, `cbaron:L62BC`, `cbaron:L63B9`,
`cbaron:L634A`, `cbaron:L642F`, and
`fixtures/cbaron-l62bc-total-wrap.json`.

`L62BC` calculates required defensive strength over the marked component:

1. for each `$10` province, `L63B9` estimates the strongest external threat;
2. `L634A` iterates all other living owners and finds the largest adjacent
   threat against the province;
3. `L642F` applies terrain/combat multipliers;
4. requirements are summed into `$C9D3..$C9D5` with normal 6502 carry, so the
   accumulator is a three-byte value and wraps at `0x1000000`.

Movement compares:

```text
mobilePulledFromComponent - requiredDefenceForComponent
```

The difference is stored in `$1617..$1619`.

If the result is non-negative, AI has surplus and jumps into redistribution
(`L603C`). If it is negative, the routine tries to compensate through money,
fortification, or alternate redistribution.

### Fortification Compensation

Evidence: `cbaron:L5E5D..L5E99`, `cbaron:L6207`,
`fixtures/cbaron-l6207-fort-compensation-choice.json`.

When the component lacks enough soldiers:

1. `L6207` searches for a marked province that can be upgraded;
2. it checks max fortification against home/non-home limits;
3. it checks available money against the fortification cost table at `main:L300F`;
4. if an upgrade helps the defensive requirement enough, AI buys it and marks
   the province with `$02`.

If no useful/affordable upgrade exists, the routine continues into fallback
redistribution.

`L6207` itself does not spend money and does not permanently change the
fortification level. It only chooses a province:

1. clears `$1602..$1604` and `$C9D6`;
2. scans provinces downward from `$C8A1`;
3. keeps only `$C832 & $10` provinces;
4. skips provinces already marked `$02`;
5. uses `$C8AE` as the max level for the active home province and `$C8AF` for
   all other provinces;
6. skips a province when its current fortification is already at or above that
   max; captured castles can therefore remain above the normal non-home
   province upgrade limit without becoming candidates for further AI upgrades;
7. skips a province if active money is below `main:L300F[currentFortLevel]`
   unless the active money high bytes are non-zero;
8. computes current `L63B9` requirement;
9. temporarily increments `$C63E + province`;
10. computes `L63B9` again;
11. stores `before - after` as the candidate reduction in `$161A..$161C`;
12. restores the original fortification level;
13. if the candidate reduction is greater than or equal to the current best
    `$1602..$1604`, stores it as the best and writes the province id to `$C9D6`.

The later `L5E5D` caller checks `$C9D6`; when non-zero, it subtracts the cost
from active money, increments `$C63E + $C9D6`, sets `$02` on that province, and
loops back to recompute `L62BC`.

TypeScript port contract:

- keep `L6207` as a side-effect-free selector returning `$C9D6`, the strength
  reduction, and the upgrade cost;
- run the active movement deficit path as the `L5E5D` loop: call `L6207`, spend
  money, increment the selected fortification, set the `$02` flag, recompute the
  marked component requirement, and repeat while the component still lacks
  soldiers;
- if fortification spending creates a non-negative surplus, continue through the
  normal surplus redistribution path; otherwise fall back to the existing
  underpowered redistribution path;
- emit the purchased fortifications from the public action layer, but keep cost
  selection in the movement module as the single source of truth for C64 AI
  fort spending.

Confirmed VICE fixture:

| Fixture | Setup | Observed |
| --- | --- | --- |
| `cbaron-l6207-fort-compensation-choice` | direct `L6207`; line `1-2-3-4`; active owns `2` and `3`, both marked `$10`; enemy `1` has `30` soldiers, enemy `4` has `20`; active money is `20`; current fort levels are `0`; max home/non-home levels are `6`; `$CA48` forced to `0` | `$C9D6 = 2`; `$1602..$1604 = 09 00 00`; fortifications and money are unchanged by `L6207`; `$C832..$C837 = 80 80 10 10 00 00` |

Active TypeScript coverage:

- `c64-cbaron-movement.test.ts` verifies the active `L5E5D` loop spends `20`,
  upgrades province `2` to `watchtower`, sets the per-turn upgrade marker, and
  recomputes the marked-component requirement from the C64 `L6207` reduction;
- `actions.test.ts` verifies the public `run-c64-baron-movement` action writes
  the AI player's final money and emits the normal `fortification-upgraded`
  event before the movement-resolution event.

### Pressure / Stance Setup

Evidence: `cbaron:L5CA5..L5D7A`, raw bytes at `cbaron:$5CCC/$5CD6`, and
`fixtures/cbaron-l5ca5-no-self-patch-watch.json`.

`L5CA5` prepares three per-player stance values in `$CA09/$CA0D/$CA11` when
`$CA48 != 0`.

Inputs:

- `L5C42` sets `L5C6E` according to map size and configured province count;
- `L6113` finds the strongest frontier province score and remembers whether it
  has fortification;
- `L615F` counts exposed frontier provinces and subtracts extra weight for
  fortified ones;
- `L5C6F` totals active-owned soldiers;
- `L5D38` tests candidate stance triples against `L62BC` threat requirements.

`L5C42` sets `L5C6E = 1`, then computes `floor($C8A1 / 5)` through
`sys:L9728`. During the first two years only, it clears `L5C6E` when
`floor(provinceCount / 5) + 2 >= currentMonth`; otherwise `L5C6E` remains `1`.

`L6113` scans active frontier candidates and writes:

- `L615D`: strongest frontier score;
- `L615E`: fortification level of that strongest frontier province.

`L615F` writes `L618C` by scanning marked `$10` frontier provinces: unfortified
frontiers add `+1`; fortified frontiers add `-1` because the routine increments
once and then decrements twice.

The candidate constants are only `10` and `40`; the code stores combinations of
those values in `$CA09/$CA0D/$CA11`. This is pressure/stance data used by
`sys:L94EE..L9622` to adjust battle percentages and by `main:L4D65..L4EA5` for
the computer status/reallocation screen. It is not a troop pool.

The selected `ERBENT1A` bytes contain two `CMP #$00` / `BCC` branches at
`cbaron:$5CCC` and `cbaron:$5CD6`. On a 6502 these branches are unreachable
because comparing any byte with zero sets carry. Therefore the apparent
`L5CF6` and `L5D06` paths are dead in this binary unless a live trace proves
self-modification elsewhere.

`fixtures/cbaron-l5ca5-no-self-patch-watch.json` runs the `$5806` movement
entry with `$CA48 != 0` and a VICE store watch on `$5CC0..$5CDF`. The fixture
stops on the normal wrapper breakpoint, not on the watchpoint, and the bytes
remain `C9 00 90 03` for both branches. This rules out self-patching inside the
isolated raw-module movement entry.

`fixtures/cbaron-l5ca5-static-write-scan.json` scans the extracted
`ERBENT1A` raw modules for direct absolute stores and absolute
read-modify-write instructions targeting `$5CC0..$5CDF`. It finds zero hits and
confirms the disk `cbaron` bytes at `$5CCC` and `$5CD6` are `C9 00 90 03`.
This reduces the loader-patch risk, but it does not rule out an indirect write.

`full-disk-cbaron-l5ca5-loader-watch.mon` is prepared as the loader-level live
check. The current automated monitor run reaches `boot:L9C0D` and KERNAL
`LOAD` at `$FFD5` for the first wildcard filename `SYS*KERNAL*MENUE`, but that
LOAD does not return before the cycle limit, even with `boot:L9D2D` and
`boot:L9D53` stubbed. Loader-time patching remains unproven rather than ruled
out.

Actual reachable branch shape:

| Condition | Candidate sequence |
| --- | --- |
| `$CA48 == 0` | return without updating `$CA09/$CA0D/$CA11` |
| `L615E == 0` | store `(10, 10, 40)` and return |
| `L615E != 0` | try `(40, 40, 10)`, then `(10, 40, 40)`, then final `(40, 10, 10)` |

`L5D38` stores the candidate triple first, computes the current requirement via
`L62BC`, then divides total active soldiers by that requirement. If the quotient
has any high byte set, or if the low quotient is at least the per-player
threshold table, it exits all of `L5CA5` by `PLA/PLA/RTS`, keeping the current
candidate. Otherwise it returns normally and the caller tries the next
candidate.

`L5D7A` is data disguised as executable opcodes:

| Player index | Threshold byte |
| --- | --- |
| `1` | `200` |
| `2` | `220` |
| `3` | `240` |
| `4` | `254` |

The byte at index `0` is `96` (`RTS`) and is unused for normal player AI.

### Fallback Redistribution

Evidence: `cbaron:L5EA4..L603C`.

`L5EA4` is the multi-front deficit fallback after `L5E5D` cannot make the
component safe through fortification spending. The raw bytes around `L5FD2` are
important because the generic disassembly splits operands into labels; the
actual instructions are:

```asm
L5FD2: ldy $C8A1
L5FD5: lda $C832,y
       and #$10
       bne L5FDF
       dey
       bne L5FD5
L5FDF: ldx $1624
       tya
       cmp $C8FB,x
       bne L5F9D
       ...
L6012: sty $161F
       lda $C9D0
       ...
```

Exact fallback flow:

1. `L5EA4..L5EB1` counts provinces still marked `$10`.
2. If exactly one province is marked, `CPX #$01` branches through `L5EA1` to
   `L5FD2`.
3. If more than one province is marked, `L5EBB..L5EED` scans all provinces
   downward and undoes every temporary fortification bought in the earlier
   `L5E5D` loop:
   - requires `$C832 & $02`;
   - decrements `$C63E + province`;
   - refunds `main:$300F[oldFortLevel]` to active money `$C8BB/$C8C0/$C8C5`;
   - clears `$02`.
4. `L5EED..L5F0D` initializes both selectors to `$FF`:
   - `$1602..$1604 = FF FF FF` for the best local requirement;
   - `$C9D6 = FF` for that best local-requirement province;
   - `L60DB..L60DE = FF` for the movement-score selector. `L60A6` currently
     compares only `$5F` against `L60DB`; `L60DC/L60DD` are initialized but not
     read in this path.
5. `L5F0D..L5F76` evaluates every marked non-home province scanning downward:
   - skip if `$C832 & $10` is clear;
   - skip the active home province `$C8FB + activePlayer`;
   - write candidate to `$C9D7` and `$161F`;
   - `L2221 -> L3020` marks the connected component from the candidate;
   - `L61A1` temporarily treats the candidate as owner `0`, clears its `$10`,
     and writes a local strength estimate to `$C706/$C76A/$C7CE`;
   - `L3023 -> L62BC -> L63CE` computes the resulting component requirement,
     adjusted by active-home pressure if the home remains marked;
   - if `$C9D3..$C9D5` is less than or equal to the current best
     `$1602..$1604`, store it and set `$C9D6 = candidate`. Ties replace the
     previous selection, so the downward scan ends with the lower province id.
6. `L60A6` is called for the same candidate before it is restored. It only keeps
   candidates where pulled mobile soldiers `$C9D0..$C9D2` are at least the
   current requirement `$C9D3..$C9D5`; for those, it calls `L60DF` and stores the
   lowest byte score in `L60DB` plus the corresponding province in `L60DE`.
7. `L618D` restores the candidate as active-owned with one soldier and
   `L5F68..L5F76` re-applies `$10`.
8. After all candidates:
   - if `L60DE != FF`, `L60DE` is used as the component seed for
     `L2221 -> L3020`;
   - otherwise `$C9D6` is used as that seed;
   - then `LDY $C9D6`, `L61A1`, and `$C832 |= $04` are applied to the
     best-requirement province;
   - execution jumps back to `L5DBF`, recomputing the component requirement with
     the new marker state.

`L5FD2` is the single-marked-province fallback:

1. find the marked `$10` province scanning downward;
2. if it is not the active home, branch to `L5F9D`, which undoes a temporary
   `$02` fort upgrade on that province if present;
3. if it is the active home, add active money `$C8BB/$C8C0/$C8C5` into mobile
   soldiers `$C9D0..$C9D2` and zero active money;
4. `L6012..L6014` stores the selected province in `$161F`, adds
   `$C9D0..$C9D2` into its soldiers, redraws, masks flags with `L2253 #$2D`,
   and jumps back to `L5DA1`.

The fallback path can eventually store persistent target/threat memory through
later `L6C49/L6AC3` placement:

- `$C9DE + player`: remembered province;
- `$C9E2/$C9E6/$C9EA + player`: remembered soldier strength.

Full-entry VICE fixture:

| Fixture | Setup | Observed |
| --- | --- | --- |
| `cbaron-5806-movement-entry-simple-return` | full `$5806` entry; line `1-2-3`; active owns `1` and `2`; enemy owns `3`; redraw helper `$1B69` is stubbed | routine returns to caller; pulled mobile soldiers `9`; defensive requirement `2`; province `2` receives the staged surplus and ends at `10` soldiers; `$C9DE+1 = 3` and `$C9E2+1 = 3` remember target province `3` |
| `cbaron-5806-movement-entry-underpowered-single` | full `$5806` entry; line `1-2`; active owns `1` with `2` soldiers and no money; enemy owns `2` with `20` soldiers | routine returns to caller; pulled mobile soldiers `1`; defensive requirement `21`; final province soldiers are unchanged (`2` and `20`); `$C9DE+1` remains `0` |
| `cbaron-5806-movement-entry-underpowered-single-home-money` | same as the underpowered single fixture, but active money is `5` | `L5FD2` adds active money into `$C9D0..$C9D2`, zeroes `$C8BB/$C8C0/$C8C5`, and leaves the home province with `7` soldiers (`2 + 5`); `$C9DE+1` remains `0` |
| `cbaron-5806-movement-entry-underpowered-multifront` | full `$5806` entry; line `1-2-3-4`; enemies own `1` and `4`; active owns `2` and `3` with `2` soldiers each and no money | routine returns to caller; pulled mobile soldiers `2`; initial component requirement is `42`; the later selected local requirement is `21`; active provinces end as `3` and `1`; province `3` keeps `$04`; `$C9DE+1` remains `0` |
| `cbaron-5806-movement-entry-l5ea4-two-candidates` | full `$5806` entry; line `1-2-3-4-5`; active owns `2`, home `3`, and `4`; enemies own weak `1` and strong `5`; no money | breakpoint at `$5F83` shows `Y = 4`, `L60DE = 4`, `$C9D6 = 4`, `$C9D7 = 2`, and `$C832 = 80 00 11 11 11 00 00`; full return leaves active soldiers `2:4`, `3:1`, `4:1`, marks province `4` with `$04`, and writes remembered target `$C9DE+1 = 1` with strength `$C9E2+1 = 1` |
| `cbaron-ai-turn-branching-underpowered-transcript` | phase-chain `$5803 -> $5806 -> $5800`; T-shaped map `1-2-3` and `2-4`; active owns home/frontier `2` and branch `4`; enemies own `1` and `3`; no money | `$5803` starts no battle; `$5806` pulls `2` mobile soldiers from the non-linear active component, computes requirement `21`, and ends active soldiers as `2:3`, `4:1`; `$5800` preserves that state and writes no remembered target |
| `cbaron-l62bc-total-wrap` | direct `L62BC`; two provinces flagged `$10`; `L63B9` patched to return requirement `$900000` for each | final `$C9D3..$C9D5 = 00 00 20`, proving three-byte total wrap |

The underpowered single-province fixture follows the `L5FD2` path after the
deficit calculation. It proves this case does not leave the active province
stripped to one soldier and does not create a remembered movement target.
The branching underpowered phase-chain proves the same home-frontier deposit is
not limited to single-province components: after `main:L5005` leaves one
garrison in each active province, `L5FD2` effectively deposits pulled mobile
soldiers plus money into the home/frontier province, so mobile soldiers from a
non-frontier branch can reinforce the home/front.
The multifront fixture exercises the broader `L5EA4` deficit path and confirms
that C64 can intentionally leave a one-soldier marked province while reinforcing
another active frontier province.
The two-candidate fixture is active TypeScript coverage for the selector branch:
the port carries the literal `L60DE/$C9D6` selector split through
`L5EA4 -> L5DBF -> L6A64`, leaves active soldiers `2:4`, `3:1`, `4:1`, marks
province `4` with `$04`, and writes remembered target province `1` with strength
`1`.

Active port contract for this reducer branch:

- for multi-front deficit, evaluate non-home frontier candidates as potential
  `$C9D6` cleanup provinces;
- choose the candidate whose removal leaves the lowest remaining frontier
  requirement, replacing on ties in the same downward-scan direction;
- set `$04` on the chosen cleanup province;
- if pulled mobile soldiers can cover the remaining frontier requirement, route
  through the existing surplus path so the staging province receives `$20` and
  `L6A64/L6AC3` writes remembered target memory;
- when the only frontier is the active home province, deposit pulled mobile
  soldiers plus active money into that post-pull home province instead of
  restoring only the original home soldiers;
- otherwise keep the existing underpowered deposit behavior without `$20`.

`L60DF` scores a candidate by temporarily treating the candidate target as
royalist/unowned for the `L6E2C` class calculation, then computing:

```text
movementCandidateScore = targetIncome + 4 * connectivityClass
```

`L60A6` considers the candidate only when available mobile soldiers are at
least the required defensive amount. It keeps the lowest score and remembers
the province id in `L60DE`.

`L6C49` chooses the exact staging province for surplus soldiers. Evidence:
`cbaron:L6C49..L6DF2` and
`fixtures/cbaron-l6c49-placement-friendly-target.json`, plus the arithmetic
edge fixture
`fixtures/cbaron-l6c49-placement-score-low16-overflow.json`.

Working fields:

| Field | Meaning in `L6C49` |
| --- | --- |
| `$08` flag | non-owned target/frontier candidate from `L6BC5` |
| `$01` flag | owned component province pulled earlier by `L5D9C/L6A64` |
| `$1617..$1619` | remaining surplus soldiers to place |
| `$161A..$161C` | current target need after subtracting adjacent owned support |
| `$1614..$1616` | chosen amount to place this iteration |
| `$1602..$1604` | best 24-bit placement score |
| `$C9D6` | current non-owned target/frontier candidate |
| `$C9D7` | selected owned staging province |
| `$C9DE/$C9E2/$C9E6/$C9EA + player` | remembered target id and target soldier count for later attack planning |

For each `$08` target candidate:

1. `L6484` computes the required soldier amount for that target. It uses battle
   combat percentages from `sys:L949D`, the current target soldiers, and the
   local `$CA61/$CA62` Q8.8 pressure factor. Friendly royalist targets under
   `$C8A5 == 0` return requirement `1`.
2. `L219C`, `L21F0`, and `main:L5069` sum adjacent active-owned mobile support.
3. That adjacent support is subtracted from the target requirement; candidates
   whose need is not positive or is not below the remaining surplus were already
   filtered by `L6BC5`.
4. Adjacent owned component provinces that still have `$01` are marked `$02`.
   These are the possible staging provinces.

`L6484` exact arithmetic:

```text
if targetOwner == 0 and royalistAttitude == friendly:
  targetRequirement = 1
else:
  combatRatioQ16 = floor(defenderCombatPercent * 65536 / attackerCombatPercent)
  root = sys:L9781(combatRatioQ16)
  base = floor(root * targetSoldiers / 224)
  pressureWord = $CA61 + 256 * $CA62
  targetRequirement = floor(base * pressureWord / 256) mod 0x1000000
```

The final division by `256` is byte-level behavior, not a high-level design
choice: after multiplying by `$CA61/$CA62`, `L6484` stores product bytes
`$60/$61/$62` into `$161A/$161B/$161C`, dropping `$5F`. This makes `$CA61/$CA62`
a Q8.8-style pressure multiplier for movement target requirements.

`L6BC5` exact filtering:

1. scan marked `$10` non-owned/frontier candidates in descending province order;
2. clear high/work bits with `L2253 #$3F`;
3. run `L6484`;
4. mark adjacent provinces with `L219C`, keep only active-owned adjacency with
   `L21F0`, and sum adjacent active mobile soldiers with `main:L3032`;
5. subtract that adjacent support from the `L6484` requirement;
6. reject the candidate on borrow, zero remaining need, or `need >= surplus`;
7. otherwise set `$08` on the candidate and increment `L6C48`;
8. after the scan, clear high/work bits again with `L2253 #$3F` and return the
   marked candidate count in `X`.

Implementation slice: the TypeScript port now has `L6484` target-requirement
arithmetic in the direct `L6C49` helper, including the friendly owner-`0`
shortcut and the `$CA61/$CA62` pressure multiplier. It also has a pure `L6BC5`
target-marker helper for the `$10 -> $08` filtering rule. The active `$5806`
helper now reaches these routines through `L6A64`; remaining transcript work is
the exact surrounding `L5D9C/L5EA4` branch flow.

For each `$02` staging province:

1. mark its adjacent provinces with `L219C`;
2. `L22CA` clears high bits from active-owned provinces, leaving non-active
   adjacent provinces marked with `$80`;
3. count those `$80` neighbours as `neighbourCount`;
4. sum their village counts `$C6A2` as `neighbourVillages`;
5. compute `raw = neighbourVillages * neighbourCount`;
6. compute `class = L6E2C(current target)` and read
   `L6DF3[class] = [1, 3, 5, 7, 8, 9, 10][class]`;
7. multiply `raw` by `2 * L6DF3[class]`;
8. copy only product bytes `$5F/$60` into dividend high bytes `$5D/$5E`, zero
   `$5B/$5C`, and divide by the target need `$161A..$161C`;
9. compare the resulting 24-bit score `$5B..$5D` against `$1602..$1604`;
10. a greater or equal score replaces the current best.

For non-overflowing products, the score can be read as:

```text
score = floor((raw * 2 * L6DF3[class] << 16) / targetNeed)
```

The byte-level rule is stricter than that simplified expression: C64 keeps only
the low 16 bits of the weighted product before the `<< 16` divide setup.
`cbaron-l6c49-placement-score-low16-overflow` confirms this by forcing class
`6`: staging province `4` produces weighted product bytes `c0 3e 01 00`, but
the following divide setup copies only `c0 3e` and discards byte `$61 = 01`.
The fixture also confirms that `$1602..$1604` cannot be asserted at routine exit
because the final redraw/helper path clobbers those scratch bytes.

Confirmed VICE fixture:

| Fixture | Setup | Observed |
| --- | --- | --- |
| `cbaron-l6c49-placement-friendly-target` | 5 provinces in a row; active player owns provinces `2` and `4`; friendly royalist target `3` is marked `$08`; provinces `2` and `4` are staging candidates with `$01`; surplus is `5` | selected staging `$C9D7 = 4`; chosen amount `$1614..$1616 = 1`; remaining surplus `$1617..$1619 = 4`; province `4` soldiers increase from `1` to `2`; remembered target `$C9DE + 1 = 3` |
| `cbaron-l6c49-placement-score-low16-overflow` | 9-province fixture; `L6E2C` patched to return class `6`; friendly royalist target need is `1`; staging `4` has four high-village non-active neighbours | internal breakpoint at `$6D88` shows staging `4` weighted product `c0 3e 01 00`; C64 discards product bytes `$61/$62`; final selected staging is province `4` and one soldier is deposited |

After the scan, `L6C49` deposits `$1614..$1616` soldiers into `$C9D7`, subtracts
the same amount from `$1617..$1619`, and, if no target memory is set, stores the
non-owned target in `$C9DE + player` with its current soldier count in
`$C9E2/$C9E6/$C9EA + player`. `L6DF2` remembers the selected staging province.

Implementation slice: the TypeScript port has a direct pure `L6C49` helper for
the confirmed friendly owner-`0` target path, the `L6484` non-friendly target
requirement arithmetic, and the low-16 placement-score overflow rule. It is
tested against
`cbaron-l6c49-placement-friendly-target` and
`cbaron-l6c49-placement-score-low16-overflow`, plus a listing-derived
non-friendly target requirement vector. The active `$5806` helper now invokes
this through `L6A64` for the covered surplus and `L5EA4` two-candidate paths.
Exact parity still needs broader full-turn transcripts around the caller branch
ordering and any uncovered movement map shapes.

### Cleanup And Surplus Placement

Evidence: `cbaron:L6A64..L6DFA`,
`fixtures/cbaron-l6a64-cleanup-marker-restores-active.json`, and
`fixtures/cbaron-l6dfa-fallback-frontier-distribution.json`, and
`fixtures/cbaron-l6ac3-post-l63b9-requirement.json`, and
`fixtures/cbaron-l6ac3-surplus-marker-redistribution.json`.

`L6A64` runs after movement/attack decisions:

1. handles `$04` cleanup markers;
2. searches for `$20` weak/surplus markers;
3. calculates local surplus over required defence;
4. marks redistribution candidates with `$08`;
5. selects a staging province and amount via `L6C49`;
6. deposits remaining soldiers into chosen province;
7. if no specific candidate is found, `L6DFA` re-marks locked provinces and
   distributes `$1617..$1619` through `main:L4F49`.

Confirmed VICE fixtures:

| Fixture | Setup | Observed |
| --- | --- | --- |
| `cbaron-l6a64-cleanup-marker-restores-active` | direct `L6A64`; province `1` has owner `5`, zero soldiers, and `$04`; province `2` is enemy; `$CA48` forced to `0` | province `1` returns to active owner with one soldier through `L618D`; `$04` remains set; the intermediate requirement is `$161A..$161C = 2` |
| `cbaron-l6dfa-fallback-frontier-distribution` | direct `L6DFA`; active owns line provinces `1` and `2`, enemy owns `3`; provinces `1` and `2` start with `$01`; surplus `$1617 = 5` | `$3023` keeps only frontier province `2` on the `$10` worklist; `main:L4F49` adds all five soldiers to province `2`; fallback uses `$C9D0..$C9D2`, not a reserve pool |
| `cbaron-l6ac3-post-l63b9-requirement` | same direct `L6A64` setup, but breakpoint at `$6AD1` immediately after `L6AC3` calls `L63B9`; `$CA48` forced to `0` | immediate selected-province requirement is `$161A..$161C = 2`; combat context is `$9400/$9401 = 25/25`; strongest adjacent mobile soldiers are `$C9D3..$C9D5 = 2` |
| `cbaron-l6ac3-surplus-marker-redistribution` | direct `L6A64`; active owns `1` and `2`; enemy owns `3`; province `2` has 10 soldiers and `$20`; `$CA48` forced to `0` | `L6AC3` computes local requirement `2`, tracks post-redistribution surplus `6`, clears work flags, and remembers target `3` with 3 soldiers; the surplus routes back to province `2`, leaving it at 10 soldiers |

`L6AC3` byte-level surplus calculation:

```text
selected = first descending province with $20 after L2253 #$24
clear $20 on selected
requirement = L63B9(selected)
surplus = selectedSoldiers - requirement - 1
selectedSoldiers = requirement + 1
```

The `- 1` is caused by `CLC` before the `SBC` sequence at `L6AC3`. This is the
same "leave one garrison above the computed requirement" rule visible in the
`cbaron-l6ac3-surplus-marker-redistribution` fixture.

Implementation slice: the TypeScript port now has direct pure helpers for
`L6DFA` fallback frontier distribution, the `L6AC3` surplus-marker
redistribution branch, and the `L6A64` cleanup/consolidation loop. `L6DFA`
mirrors the `L2253 #$2F -> mark $01 as $10 -> main:L514A -> main:L4F49` path,
including equal division and descending province-order remainder placement.
`L6AC3` is fixture-backed for the immediate post-`L63B9` requirement and the
simple-rules surplus redistribution case. The active `$5806` helper now invokes
`L6A64` after its movement branch, so surplus `$20` markers are resolved
through the same cleanup loop. Full `$5806` parity still requires transcript
tests over natural AI turns and additional map shapes beyond the current
point fixtures.

Fixture hygiene note: direct monitor fixtures for simple rules must force
`$CA48 = 0` before calling routines that can reach `sys:L949D`. If `$CA48` is
left at reset/ambient memory, `sys:L94EE/L9587` can apply full-rules combat
pressure and produce misleading `$9400/$9401` values.

Implementation implication:

- C64 AI movement is not "move from A to adjacent B";
- it is "pull mobile soldiers from a connected owned component, compute threat,
  then place surplus/shortfall according to local heuristics";
- this is exactly where historically plausible AI mistakes appear: the routine
  is local, scan-order dependent, and can leave one-soldier regions behind.

## Known Strategic Mistakes Explained By The Code

These are not bugs in our port if we reproduce C64 behavior.

| Behavior | Code cause |
| --- | --- |
| AI does not use every adjacent army in an attack | `L674A` can remove a source that also borders a remaining accepted target candidate while the selected attack remains `>= 435`; confirmed by `fixtures/cbaron-5803-attack-entry-prunes-competing-frontier.json`. |
| AI leaves a province/front with only one soldier | `main:L5005` and `cbaron:L5D9C` pull mobile soldiers from marked components, leaving one garrison. |
| AI can look locally smart but globally weak | target/source scans are descending province order and local frontier based, not global search. |
| AI may prefer a lower-numbered target on equal score | `L6808` replaces best target on equal score while scanning downward; confirmed by `fixtures/cbaron-l6808-target-tie-lower-id.json`. |
| AI may allow pockets/cut-offs in full rules | `L6560..L6599` can mark disconnected-from-home provinces with `$01`, excluding them from source use. |
| AI retreats frequently when losing battle | battle command logic retreats attacker below ratio `230`, defender at or above `435` if legal. |
| Defender retreat spreads forces oddly | `main:L4FA7` divides defender survivors over all adjacent owned retreat provinces. |
| Attacker retreat spreads forces oddly | `main:L4F49` divides attacker survivors over the original source set. |

## Porting Targets

`c64-original` should implement these as separate pure functions:

1. `markC64FrontierTargets`
   - implements `L6B8C`.
2. `collectC64AttackSources`
   - implements `L6605..L6686` source summing and garrison subtraction.
3. `passesC64AttackThreshold`
   - implements `L6532` with threshold `333`.
4. `chooseC64AttackTarget`
   - implements `L6808` score and keeps fixture coverage for carry behavior.
5. `pruneC64AttackSources`
   - implements `L674A` as competing-frontier source preservation with
     threshold `435`.
6. `placeC64AttackerRetreat`
   - distributes survivors over `$10` source set.
7. `placeC64DefenderRetreat`
   - distributes survivors over all adjacent defender-owned provinces.
8. `runC64MovementRedistribution`
   - implements `L5D9C` plus `L6A64`.
9. `runC64BaronEconomy`
   - implements `L5990`, `L5914`, and `L5BC6`; recruits into home province.

## Still Open Before Byte-Perfect AI

The map AI is now mostly structurally recovered. These exact evidence gaps still
need fixture extraction:

- live-trace fixtures for `$CA55 != 0` full-rules locking, if a full-rules mode
  is later selected;
- full disk-loader watch confirmation that no loader-time patch changes the two
  unreachable `L5CA5` `BCC` branches; raw-module `$5806` execution itself is
  already watch-backed as non-mutating, and the static direct-write scan finds
  no absolute writes into `$5CC0..$5CDF`, but
  `full-disk-cbaron-l5ca5-loader-watch.mon` currently hits the known automated
  wildcard-loader cycle-limit blocker at KERNAL `LOAD`;
- end-to-end AI transcript fixtures over attack, battle command, movement, and
  economy sequencing.

Fixture methodology note: isolated hand-built micro-states for full
`cbaron:L5D7F` movement can fail to return before the monitor cycle limit even
when the smaller helpers are valid. The next full-entry fixture should be
captured from a natural post-attack game snapshot, or from a broader initialized
memory state, rather than from a nearly zeroed three-province map.

Until these are fixture-backed, `c64-original` can copy the recovered shape and
thresholds but must not claim complete map-AI byte parity.
