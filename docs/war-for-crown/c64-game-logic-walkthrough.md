# War for Crown C64 Game Logic Walkthrough

This document is the current full game-flow map for the C64 compatibility work.
It follows the game from setup to finish and records which parts are already
address-backed and which still need a byte-exact pass.

This is not executable rules code. It is the implementation checklist and
evidence map for `c64-original` behavior.

## Evidence Levels

| Level | Meaning |
| --- | --- |
| Confirmed | Static C64 routine/address or already recovered table backs the rule. |
| Partial | Entry point and broad behavior are recovered, but some constants, flags, or formulas still need annotation. |
| Open | Behavior is visible or likely, but the exact C64 source path is not yet recovered. |

## Baseline Corpus

Primary working baseline for this pass:

- `/mnt/c/Games/c64/WfC/ERBENT1A.D64`

Other checked variants:

- `/mnt/c/Games/c64/WfC/kudk.d64`
- `/mnt/c/Games/c64/WfC/Die_Erben_des_Throns_-_Krieg_um_die_Krone_II_(ASS).d64`
- `/mnt/c/Games/c64/WfC/KRIEGUDK.D64`

`ERBENT1A.D64` and `kudk.d64` are modular and include a separate `cbaron`
computer-player module. `KRIEGUDK.D64` is a separate 1989 BASIC/legacy branch
documented in `c64-kriegudk-1989-baseline.md`; it must not be mixed into the
current `ERBENT1A` C64 mode.

Reproducible extraction/disassembly commands used for this pass:

```bash
rm -rf /tmp/wfc-c64-logic
mkdir -p /tmp/wfc-c64-logic/erbent1a /tmp/wfc-c64-logic/kudk /tmp/wfc-c64-logic/ass /tmp/wfc-c64-logic/disasm
cd /tmp/wfc-c64-logic/erbent1a && c1541 /mnt/c/Games/c64/WfC/ERBENT1A.D64 -extract
cd /tmp/wfc-c64-logic/kudk && c1541 /mnt/c/Games/c64/WfC/kudk.d64 -extract
cd /tmp/wfc-c64-logic/ass && c1541 '/mnt/c/Games/c64/WfC/Die_Erben_des_Throns_-_Krieg_um_die_Krone_II_(ASS).d64' -extract

for f in main menue code cbaron kampf kernal sys; do
  load=$(node -e "const fs=require('fs'); const b=fs.readFileSync('/tmp/wfc-c64-logic/erbent1a/'+process.argv[1]); console.log('$'+(b[0]+b[1]*256).toString(16))" "$f")
  tail -c +3 "/tmp/wfc-c64-logic/erbent1a/$f" > "/tmp/wfc-c64-logic/disasm/erbent1a-$f.raw"
  da65 --start-addr "$load" "/tmp/wfc-c64-logic/disasm/erbent1a-$f.raw" > "/tmp/wfc-c64-logic/disasm/erbent1a-$f.asm"
done
```

The executable SSOT for the selected disk hash, module hashes, load addresses,
sizes, and local extracted paths is `c64-baseline-manifest.json`. Parity tooling
must verify that manifest before starting VICE.

## Global State Map

Confirmed anchors:

| C64 field | Meaning |
| --- | --- |
| `$1624` | active owner/player index; owner `0` is Koenigstreuen/Kingsmen |
| `$C896` | configured player count |
| `$C8A1` | configured province count |
| `$C8A2` | year counter |
| `$C8A3` | month counter |
| `$C8A4` | random-event enable/start field |
| `$C8A5` | royalist attitude: `0` friendly, `1` neutral, `2` hostile |
| `$C8A6` | royalist hostile-attack cooperation toggle |
| `$C8A7` | royalist success-evaluation toggle |
| `$C8A8` | royalist distribution mode |
| `$C8AC` | terrain-dependent income toggle |
| `$C8AD` | configured home-castle fortification level |
| `$C8AF` | maximum non-home province fortification level |
| `$C8B0` | event timing/state field |
| `$C8B3` | normalized royalist growth percentage |
| `$C8B4` | normalized royalist investment percentage |
| `$C8B5 + owner` | province count by owner/player; `$C8B5` without index is royalists |
| `$C8BA` | starting soldiers placed in a confirmed home province |
| `$C8BB/$C8C0/$C8C5 + player` | player money, three-byte integer |
| `$C8FB + player` | player home province |
| `$C5DA + province` | province owner |
| `$C6A2 + province` | village count |
| `$C706/$C76A/$C7CE + province` | province soldiers, three-byte integer |
| `$C63E + province` | fortification/upgrade level |
| `$C832 + province` | temporary province flags for reachability, source/target marks, spent state; see `c64-c832-flags-decompile.md` |
| `$C900` | village price |
| `$C901` | interest rate |
| `$C902 + province` | royalist saved village-investment bucket |
| `$C966 + province` | royalist saved fortification-investment bucket |
| `$C9D0..$C9D2` | attacker soldiers during battle |
| `$C9D3..$C9D5` | defender soldiers during battle |
| `$C9D6/$C9D7` | selected battle provinces; exact source/target naming depends on routine |
| `$C9D8` | defender owner in battle |
| `$C9D9 + player` | non-zero for computer-controlled player |
| `$C9DE/$C9E2/$C9E6/$C9EA + player` | computer movement/threat memory |
| `$C9EE/$C9F2/$C9F6 + player` | soldiers hired during the current economy pass |
| `$CA47` | current investment/action flag, reset at phase boundaries |
| `$CA48` | show computer-vs-computer/report setting |
| `$CA55/$CA56` | full-rules feature gates; `c64-original-simple` keeps both `0` |
| `$CA61 + player` | temporary income event flags; bits `$10/$20` halve/double income with random gate |

Open field groups:

- exact full-rules fields under `$CA2E/$CA32/$CA36/$CA3A`;
- exact display/report counters around `$C8CF/$CA09/$CA0D/$CA11`.

## Setup Flow

Evidence: `menue:L30D6..L31D6`, `menue:L53E7`, `menue:L5492`.

1. The menu/options module collects game options into the `$C8xx/$C9xx/$CAxx`
   field set.
2. The map is generated before home selection. The core C64 growth behavior is
   documented separately in `c64-map-generation-analysis.md`.
3. Every generated non-water province is initialized at `menue:L30D6..L30E5`:
   - villages = `(rnd & 3) + 2`, so `2..5`;
   - soldiers = `(rnd & 3) + 3`, so `3..6`;
   - owner = `0`, meaning Koenigstreuen/Kingsmen;
   - fortification = `0`.
4. `menue:L53E7` normalizes royalist growth/investment related setup values:
   `C8B3 = floor(C8B3 * 256 / (C8B3 + C8B4 + C8A9))` and
   `C8B4 = floor(C8B4 * 256 / (C8B3 + C8B4 + C8A9))`, as documented in
   `c64-start-options-v0.md`.
5. Player home fields `$C8FB + player` are cleared.
6. For each configured player:
   - computer players call `menue:L5492` to auto-select a home province;
   - human players click a land province on the map;
   - occupied provinces are rejected;
   - accepted home assignment runs `menue:L319F`.
7. `menue:L319F` turns the selected province into the player's home castle:
   - soldiers = `$C8BA`, default visible setup value `20`;
   - owner = current `$1624`;
   - fortification = `$C8AD`;
   - home province `$C8FB + player` = selected province.

Compatibility implications:

- Neutral provinces do not start with random forts.
- There is no free troop pool. Starting soldiers live only in the confirmed home
  province.
- The home castle is player-owned state, not a generic neutral fort. In the
  simple target we expose this as the player's castle marker.

## Main Game Loop

Evidence: `main:L3063`, `main:L30E1`.

After low-level screen/system setup, `main:L3063` initializes active player to
`0`, calls `main:L35E1`, then enters the recurring loop at `main:L30E1`.

`main:L30E1` calls these routines in order:

| Order | Routine | Current meaning |
| ---: | --- | --- |
| 1 | `main:L3312` | choose next active player, run royalist/world wrap logic, skip eliminated players |
| 2 | `main:L334A` | new-round computer notification/pause |
| 3 | `kernal:L2253` with `X=0` | clear temporary province flags |
| 4 | `main:L4F40` | status/title/report display, exact label still partial |
| 5 | `main:L3A98` | calculate and apply active-player income |
| 6 | `main:L3890` | full-rules stock/supply/resource adjustment path; excluded from simple mode until named |
| 7 | `main:L3112` | random event dispatch for eligible human player |
| 8 | `main:L1162` | redraw/refresh |
| 9 | reset `$CA47`, `kernal:L2253` | reset current action state and province flags |
| 10 | `main:L487E` | attack entry for active player, or royalist hostile attack entry when active owner is `0` |
| 11 | `main:L33B3` | movement entry for active player |
| 12 | `main:L4196` | economy/investment entry for active player |
| 13 | `main:L4D65` | post-turn statistics/report path |
| 14 | jump `main:L30E1` | repeat |

Important correction:

- The C64 phase order is `attack -> movement -> build`.
- A previous pass mislabeled `main:L487E` as movement and `main:L33B3` as
  attack. The code path shows the opposite: `main:L487E` selects an enemy
  target, marks friendly attack sources, starts `kampf`, captures provinces,
  and calls `main:L4C7A`; `main:L33B3` selects two owned provinces and transfers
  soldiers.

## Active Player And Round Wrap

Evidence: `main:L3312`, `main:L337A`, `main:L3384`, `main:L339B`,
`fixtures/main-l3312-turn-owner-selection.json`,
`fixtures/main-l3312-hostile-home-castle-world-pass.json`, and
`fixtures/main-l3312-hostile-nonhome-world-pass.json`.

`main:L3312`:

1. increments `$1624`;
2. if `$1624 <= $C896`, it selects that player slot;
3. if `$1624 > $C896`, it wraps to owner `0`;
4. on wrap, if royalists own provinces:
   - if royalists own all provinces (`$C8B5 == $C8A1`), game enters a royalist
     victory/status path at `main:L339B`;
   - otherwise it runs the royalist world pass `main:L337A`;
5. after the royalist pass it calls `main:L52FD`, then `main:L35E5`, then starts
   the next round at player `1`;
6. players with zero province count are skipped;
7. if a player owns all provinces (`$C8B5,x == $C8A1`), it enters a victory path
   at `main:L3384`.

Confirmed fixture observations:

- zero-province owners are skipped by recursively re-entering `main:L3312`;
- wrap from the last configured player sets `$1624 = 0` first;
- if royalists own provinces but not the full continent, `main:L337A` runs
  before `main:L52FD`, `main:L35E5`, and the next round starts at player `1`;
- after a hostile `main:L337A` pass eliminates the last player by home-castle
  capture, `main:L3312` still calls `main:L52FD` and `main:L35E5`, then skips
  the zero-province player and reaches royalist `$CA75 = 2`;
- `L3349` increments only on normal wrap into player `1`;
- human continent victory writes `$CA75 = 3`, computer continent victory writes
  `$CA75 = 1`, and royalist continent victory writes `$CA75 = 2`.

`main:L337A` royalist pass order:

1. `main:L487E` with active owner `0`; this jumps through `main:L3009` to
   `kampf:$7E03` and hostile royalist attack logic;
2. `main:L5209` royalist production/investment;
3. `main:L50D3` royalist distribution/pressure.

Compatibility implications:

- Royalists are not a normal AI player. They are owner `0` world-system logic
  that runs between player rounds.
- Eliminated players with `$C8B5,x == 0` receive no turns.
- Owning all provinces is a C64 terminal condition.

## Month, Weather, Events, And Income

Evidence: `main:L35E5`, `main:L3D7C`, `main:L3DCD`,
`main:L3112`, `main:L3A98`, `main:L3B38`.

Round-level month/weather:

1. `main:L35E5` runs when the player cycle wraps.
2. It handles event timing through `$C8B0`.
3. It calls `main:L3D7C` to choose weather index `$CA4B`.
4. It calls `main:L3DCD` twice to adjust weather/economy factor fields
   `$CA4C/$CA4D`.
5. It displays month/year/weather and advances month `$C8A3`; month wraps after
   12 and increments year `$C8A2`.

Per-player income:

1. `main:L3A98` runs for every active player turn.
2. It calls `main:L3B38` to sum income from owned provinces.
3. `main:L3B38` iterates provinces `1..$C8A1`.
4. For each province owned by active `$1624`, it multiplies village count
   `$C6A2,y` by terrain/tax coefficient `L3015[$C576,y]`.
5. If terrain income is disabled (`$C8AC == 0`), coefficient is forced to `100`.
6. The three-byte sum is normalized by helper `L9726`.
7. `main:L3A98` checks `$CA61,x`:
   - bit `$10` can halve income after a 50% RNG gate;
   - bit `$20` can double income after a 50% RNG gate;
   - both bits are cleared afterward.
8. For human players, an income screen is displayed.
9. Income is added to player money `$C8BB/$C8C0/$C8C5 + player`.

Random events:

1. `main:L3112` returns immediately when `$C8A4 == 0`.
2. It skips owner `0` and slots where `$C9D9 + activePlayer != 0`.
3. In year `1`, it requires `$C8A3 >= $C8A4`.
4. The first raw RNG byte must be at least `$10`.
5. It calls `L982F($1A)`, decrements the result, loads that module id, reads
   `$5500..$5503` as the event text range, and jumps to `$5504`.
6. In `ERBENT1A`, modules `zj`, `zl`, and `zn` have dormant code after the
   entrypoint, but the normal `$5504` entrypoint is `RTS`, so they do not mutate
   state through the dispatcher.

Detailed weather, income, and event behavior is documented in
`c64-economy-weather-events-decompile.md`. Weather labels and event text
templates are documented in `c64-text-status-decompile.md`.

Open:

- PL/EN localization keys for the recovered event text templates.

## Human Attack Flow

Evidence: `main:L487E..L4C50`, `fixtures/main-screen-action-indices.json`,
`c64-attack-code-analysis.md`.

`main:L487E` is the active-player attack entry:

1. if active player is computer-controlled (`$C9D9,x != 0`), it jumps to
   `cbaron:$5803`;
2. human flow clears/sets map flags and prompts for a target/source sequence;
3. the player selects an enemy or royalist/neutral target province;
4. the player selects one or more owned adjacent source provinces;
5. selected source provinces contribute all mobile soldiers, leaving one
   garrison soldier in each source;
6. selecting/confirming the target starts battle setup;
7. the routine copies attacker soldiers to `$C9D0..$C9D2` and defender soldiers
   to `$C9D3..$C9D5`;
8. after battle, surviving soldiers are written back to province state;
9. the attack entry repeats until the player ends the attack phase or no legal
   attack remains.

Rules already confirmed:

- no per-source attack soldier slider in C64 mode;
- all selected source provinces spend their mobile soldiers;
- used source provinces and a newly captured target must not become fresh
  attack sources in the same attack phase;
- attack source eligibility depends on C64 map flags/reachability helpers, not
  on an arbitrary modern heuristic;
- two-choice prompts use `X == 0` for the first/abort field and `X != 0` for
  the second/continue field; invalid `$2028` hits returning `A == $FF` are
  ignored until a valid field is returned.

## Battle Screen And Combat Loop

Evidence: `kampf:L7E64`, `kampf:L83C4`, `kampf:L82D5`,
`kampf:L8618`, `sys:L9426`, `sys:L946F`, `sys:L9486`, and
`fixtures/sys-retreat-threshold-boundaries.json`,
`fixtures/main-retreat-placement-multiple-destinations.json`.

The C64 battle is an interactive screen, not an instant summary.

`kampf:L7E64` loop:

1. `kampf:L8856` redraws battle bars/numbers;
2. `kampf:L82D5` checks for battle finish after death or retreat command;
3. `kampf:L83C4` waits for human input or AI battle decision;
4. `kampf:LCDE9` performs an intermediate/display helper;
5. `kampf:L8618` resolves exactly one simultaneous combat round;
6. loop repeats.

Input command mapping from `kampf:L83C4`:

| Command | Source | Meaning |
| ---: | --- | --- |
| `0` | joystick direction / normal AI decision | fight one round |
| `1` | defender command / defender AI retreat | defender retreat |
| `2` | attacker fire / attacker AI retreat | attacker retreat |

Retreat:

- a retreat command still allows one final simultaneous combat round;
- attacker retreat/failure distributes surviving attackers over the selected
  source set marked with `$C832 & $10`;
- defender retreat is legal only if the defending province is not the home
  castle and an adjacent owned retreat province exists;
- defender retreat distributes surviving defenders over the legal retreat set
  marked with `$C832 & $80`;
- both retreat distribution routines divide survivors evenly and assign
  remainder soldiers while scanning province ids from `$C8A1` down to `1`;
- defender AI retreat check runs before attacker AI retreat check.

AI battle retreat ratio:

```text
floor(((attackerSoldiers * 256 / defenderSoldiers) ^ 2 / defenderCombatPercent * attackerCombatPercent) / 256)
```

Thresholds:

- attacker AI retreats when ratio is below `$00E6` (`230`);
- defender AI retreats when ratio is at least `$01B3` (`435`) and retreat is
  legal.

Round resolution:

1. `kampf:L8618` calls `kampf:L85C0` and `kampf:L8568` to calculate both sides'
   hits;
2. RNG is consumed for attacker hits first, then defender hits;
3. each side's hit count is clamped to at least one when necessary;
4. attacker casualties are subtracted from `$C9D0..$C9D2`;
5. defender casualties are subtracted from `$C9D3..$C9D5`;
6. losses/stat counters are updated after both casualties are known.

Detailed hit arithmetic and combat percentage sources are documented in
`c64-battle-arithmetic-decompile.md`.

Friendly royalist behavior is recovered from `kampf:L7E76` and confirmed by
`fixtures/kampf-l7e76-friendly-royalist-join.json`: if `$C8A5 == 0` and the
target owner is `0`, defender soldiers are added to the attacker, the defender
is zeroed, and the battle exits before the normal loop. The companion fixture
`fixtures/kampf-l7e76-neutral-royalist-no-join.json` confirms that neutral
royalists leave battle state unchanged here and continue through the normal
path.

Open:

- C64-style battle presentation is still an implementation task;
- supplies/catapults pressure paths remain excluded from `c64-original-simple`
  unless a future full-rules mode is explicitly selected.

## Player Castle Capture And Elimination

Evidence: `main:L4C7A` and
`fixtures/main-castle-capture-transfer.json`.

Capturing a player home castle is not a normal province capture.

`main:L4C7A` behavior:

1. reads the previous owner from `$C5DA,y`;
2. returns immediately if previous owner is `0` (royalists);
3. compares captured province `$C9D7` against old owner's home province
   `$C8FB,x`;
4. if the captured province is not the old home, returns;
5. if it is the old home, iterates every province;
6. every province owned by the eliminated player is reassigned to current
   active `$1624`;
7. surviving attack outcome has already written the captured province soldiers;
8. non-battle transferred provinces keep their current soldiers and
   fortification levels;
9. winner province count receives eliminated player's province count;
10. eliminated player's province count and several stat counters are zeroed;
11. eliminated player's `$C8FB` home province marker is not cleared;
12. message flow differs depending on whether the attacker is player or
    owner `0`.

Compatibility implications:

- an eliminated player receives no future turns because `main:L3312` skips zero
  province counts;
- captured castles can end the game even before one side owns every province;
- royalist castle capture can eliminate a player when active owner is `0`;
- transferred armies must not become fresh attack sources in the same attack
  phase.
- eliminated-player turn skipping is driven by `$C8B5,x == 0`, not by clearing
  the home-castle field.

## Human Movement Flow

Evidence: `main:L33B3..L3546`, `sys:L984B..L99FF`,
`fixtures/main-human-movement-connected-transfer.json`,
`c64-human-movement-decompile.md`.

`main:L33B3` is the movement entry for active non-zero players:

1. if active player is computer-controlled, it jumps to `cbaron:$5806`;
2. human movement selects a source province owned by the active player;
3. it then selects another owned province;
4. the two provinces must be in the same connected owned component;
5. the C64 transfer UI chooses the final soldier count in the destination;
6. source soldiers become `source + destination - chosenDestination`;
7. min destination value is `1`;
8. max destination value is `source + destination - 1`;
9. initial destination value is the destination's current soldier count;
10. movement repeats until the player exits.

The earlier note that `main:L487E` was movement was wrong. `main:L487E` is the
attack phase.

Movement still uses province flags and reachability helpers:

1. `kernal:L2253` clears/masks flags;
2. `kernal:L219C` marks adjacent/reachable provinces;
3. `kernal:L2221`/related helpers validate the selected connection.

Current parity status:

- connected-owned-path movement is confirmed by `kernal:L2221` and the source
  `$80` check, including a non-adjacent source fixture;
- the `1..total-1` destination range is fixture-confirmed, including the `1+1`
  endpoint;
- movement does not mark source or destination spent for the rest of the
  movement phase;
- the modern UI should expose a slider/stepper over destination final count and
  an equal-split button.

Open:

- exact physical C64 input bit mapping for the numeric chooser is
  presentation-only and does not block rules parity.

## Human Investment Flow

Evidence: `main:L4196..L479D`, `main:L456F`, `main:L4627..L4749`,
`fixtures/main-human-investment-actions.json`,
`fixtures/main-screen-action-indices.json`,
`c64-human-investment-decompile.md`.

`main:L4196` is the active-player investment/economy entry:

1. resets `$CA47` and hired-soldier counters
   `$C9EE/$C9F2/$C9F6 + activePlayer`;
2. if active player is computer-controlled, jumps to `cbaron:$5800`;
3. if simple/full-rules gate allows and player has no money, skips investment;
4. displays the economy menu and current money/income/status fields;
5. allows soldier recruitment, village construction, fortification upgrade, and
   ending the turn, depending on enabled rules.

Menu dispatch:

| A | Target | Simple Ruleset Meaning |
| ---: | --- | --- |
| 0 | `$437B` | recruit soldiers |
| 1 | `$446B` | build villages |
| 2 | `$45FE` | upgrade fortification |
| 3 | `$42DF` | catapult branch, disabled in simple mode |
| 4 | `$4371` | full-rules stock transfer selector, disabled in simple mode |
| 5 | `$4752` | end investment and apply interest |

The `$4371` selector still uses `X`: `X == 0` reaches `L3E6A`, and `X != 0`
reaches `L3FA4`.

Recruitment:

- soldiers are bought with money and added directly to the player's home
  province `$C8FB + player`;
- one taler buys one soldier;
- hired amount is recorded in `$C9EE/$C9F2/$C9F6`;
- there is no free reserve pool and no delayed recruitment queue in the simple
  target.

Villages:

- village purchase cost is `$C900`;
- purchase increases `$C6A2 + province`;
- village cap logic depends on setup option and province capacity helpers.

Fortification:

- province fortification is `$C63E + province`;
- upgrade cost is table-driven through `L300F`;
- same-province second upgrade in one investment phase is blocked by `$C832 & $20`;
- non-home maximum is `$C8AF`;
- home maximum uses a separate setup field path (`$C8AE/$C8AD` family) in the
  later/full rules; simple mode must expose only the chosen compatibility
  subset.

Interest:

- end investment applies `$C901` as a percentage interest on current money;
- full-rules stock/supply decay in the same path is excluded from simple mode.

Open:

- no known simple-rules investment gaps.

## Computer Baron AI

Evidence: `cbaron` jump table, `main:L487E`, `main:L33B3`, `main:L4196`,
`c64-ai-analysis.md`.

`cbaron` entry table:

| Entry | Routine | Meaning |
| --- | --- | --- |
| `$5800` | `cbaron:L5990` | economy/investment |
| `$5803` | `cbaron:L6560` | attack |
| `$5806` | `cbaron:L5D7F` | movement and redistribution |
| `$5809` | `cbaron:L6A64` | post-action cleanup/consolidation |

Computer economy (`$5800`, recovered for simple rules):

1. handles full-rules reserved/owed values when those features are enabled;
2. computes available/mobile army strength from selected province sets;
3. decides base recruitment and adjacent previous-hire pressure;
4. hires soldiers into the home province;
5. scores village-building candidates;
6. buys villages while useful and affordable;
7. handles fortification/upgrades within configured limits.

Computer attack (`$5803`, recovered for simple rules):

1. scans marked frontier targets;
2. evaluates targets, not only a single strongest adjacent province;
3. aggregates multiple source provinces through `$C832` flag sets;
4. compares aggregate attack strength against defense before committing;
5. prunes overkill sources with `cbaron:L674A`, keeping a removed source out
   while the reduced ratio remains at least `$01B3` (`435`);
6. starts the battle/capture path through the shared main/kampf entry.

`fixtures/cbaron-5803-battle-capture-line.json` proves the shared path for a
two-source computer baron attack into a one-soldier enemy home castle: both
source provinces are left at one soldier, the captured target receives the
surviving attackers, the defender's remaining provinces are transferred through
`main:L4C7A`, and the defeated player's home marker remains set.

`fixtures/cbaron-5803-defender-retreat-line.json` proves the full computer
baron defender-retreat path: battle command `$C9D9 = 1`, legal retreat target
`$9406 = 3`, final combat round before retreat, captured target receives
surviving attackers, and surviving defenders are added to the retreat province.
It also proves the C64 battle RNG order used by the port: attacker hits consume
the first battle RNG byte, defender hits consume the next one.
`fixtures/cbaron-ai-turn-defender-retreat-transcript.json` extends that same
state through `$5806` and `$5800`: movement pulls `92` mobile soldiers, computes
a `45` soldier frontier requirement, restores the map at `1/93/41`, writes
remembered target province `3` with strength `41`, and economy then buys four
home recruits plus four villages while preserving that memory.

`fixtures/cbaron-5803-attacker-retreat-line.json` proves the corresponding
computer baron attacker-retreat path: the target is the defender home province,
so `$9406 = 0` prevents defender retreat; after eight combat rounds the battle
command is `$C9D9 = 2`, attacker survivors in `$C9D0..$C9D2` are distributed
back over the original source set, the target remains defender-owned, and the
map ends with `6/6` soldiers. The paired
`fixtures/cbaron-5803-attacker-retreat-round-trace.mon` stops at `kampf:$86C4`
for each round and is the evidence for final round losses `2/2`; the later
`main:$4C50` dump has already passed stat-counter accounting.

`fixtures/cbaron-ai-turn-attacker-retreat-transcript.json` extends that path
through the following computer movement and economy entries on the same C64
state. After attacker retreat, `$5806` leaves owners `1/2` and soldiers `6/6`,
then `$5800` recruits four soldiers into the home province, buys four villages,
and leaves active money at `0`. The no-attack phase-chain fixture also proves
that neutral owner `0` is an economy frontier for `$5990/L5914`, even though
neutral royalists add no hostile threat to `L62BC`.

`fixtures/cbaron-ai-turn-capture-transcript.json` covers the non-home capture
chain without player elimination. `$5803` captures province `2` from sources
`1` and `3`, leaves both sources at one soldier, and gives the captured
province the `97` surviving attackers. The defender home province is isolated
at province `4`, so `main:L4C7A` does not run. `$5806` then pulls `96` mobile
soldiers out of the enclosed active component and, because there is no remaining
frontier, leaves active provinces `1/2/3` at one soldier each. `$5800` still
uses the base recruitment budget: it adds four soldiers to the home province,
buys four villages there, and leaves active money at `0`.

`fixtures/cbaron-ai-turn-l5ea4-transcript.json` covers the multi-front movement
memory branch through a full phase chain. `$5803` rejects both frontier targets
and starts no battle. `$5806` then enters `L5EA4`, pulls three mobile soldiers,
ends with soldiers `1/4/1/1/20`, marks province `4` with `$04`, and writes
remembered target province `1` with remembered strength `1` to
`$C9DE/$C9E2 + activePlayer`. The following `$5800` economy pass has no money
to spend and preserves that remembered target state.

Computer movement (`$5806`, recovered for simple rules):

1. marks reachable owned provinces with the shared map worklist helpers;
2. aggregates mobile soldiers while leaving one garrison;
3. moves armies toward remembered target/threat/frontier state;
4. uses `$C9DE/$C9E2/$C9E6/$C9EA + player` as memory;
5. calls cleanup/consolidation helpers for weak marked provinces.

Compatibility implications:

- `c64-original` AI must not be a generic stronger modern heuristic.
- Computer barons consume player-slot turns; royalists do not.
- The final port needs source-set and target ordering from `cbaron`, not
  isolated adjacent attacks.
- Full `$5803` fixtures confirm that `L674A` preserves sources for competing
  accepted target candidates; it is not generic pruning for every overpowered
  attack.
- The first `$5803 -> battle -> capture` transcript is compared in
  `c64-ai-transcript.test.ts`; it covers capture victory, not defender/attacker
  retreat.
- The current playable AI must remain labelled workbench until all partial
  branches are recovered.

## Royalists / Kingsmen

Evidence: `main:L337A`, `kampf:$7E03 -> L8461`, `main:L5209`, `main:L50D3`,
`c64-kingsmen-world-phase-v0.md`.

Owner `0` is Koenigstreuen/Kingsmen.

Royalist world pass order:

1. hostile attacks through `kampf:L8461`;
2. production/investment through `main:L5209`;
3. distribution/pressure through `main:L50D3`.

Hostile attacks (`kampf:L8461`, confirmed source cooperation and threshold
boundaries through `fixtures/kampf-l8461-hostile-cooperation.json` and
`fixtures/kampf-l842e-threshold-boundaries.json`; confirmed full threshold path
to battle entry through
`fixtures/kampf-l8461-hostile-full-entry-strict-accept.json`; confirmed
post-battle repeat through
`fixtures/kampf-l8461-hostile-post-battle-repeat.json`; confirmed hostile
home-castle transfer through
`fixtures/kampf-l8461-hostile-home-castle-transfer.json`):

1. runs only when `$C8A5 == 2`;
2. scans player-owned target provinces;
3. gathers adjacent owner-`0` source provinces;
4. `$C8A6 == 0` stops after the first source in high-to-low province order;
5. `$C8A6 != 0` keeps collecting adjacent sources;
6. each royalist source contributes mobile soldiers while leaving one garrison;
7. `$C8A7 == 0` accepts at ratio `>= 256`;
8. `$C8A7 != 0` accepts at ratio `>= 333`;
9. accepted attack calls the same battle module.
10. after a resolved battle, `main:L4C50` re-enters dispatch through
    `main:L487E`; active owner `0` jumps through `$3009` back to
    `kampf:L8461`, so hostile royalists can launch another attack in the same
    world pass.
11. in the owner-`0`, fixed troop-distribution path, an attacker win leaves one
    soldier on the captured target, subtracts one from surviving attackers, and
    distributes the rest across the source set plus the captured target through
    `main:L4F49`.
12. if the captured target is a player home province, `main:L4C7A` transfers the
    defeated player's remaining provinces to owner `0`; non-battle transferred
    provinces keep their soldiers and the defeated player's `$C8FB` home marker
    remains set.
13. when this happens inside `main:L337A`, the world pass still continues into
    `main:L5209` and then `main:L50D3`; terminal win handling is above this
    slice, not inside the hostile attack loop.

The active TypeScript owner-`0` world phase compares
`fixtures/kampf-l8461-hostile-post-battle-repeat.json` and
`fixtures/kampf-l8461-hostile-home-castle-transfer.json` for focused attack
paths, `fixtures/main-l337a-hostile-home-castle-world-pass.json` and
`fixtures/main-l337a-hostile-nonhome-world-pass.json` for caller-level
attack-to-production/distribution ordering, plus
`fixtures/main-l3312-hostile-home-castle-world-pass.json` and
`fixtures/main-l3312-hostile-nonhome-world-pass.json` for public
end-of-round owner-selection parity in
`games/war-for-crown/src/game/royalists.test.ts`.

Royalist production (`main:L5209`, confirmed broad structure plus
`fixtures/main-l5209-royalist-production-buckets.json`,
`fixtures/main-l5209-royalist-production-fort-upgrade.json`, and
`fixtures/main-l5209-royalist-production-fort-max-boundary.json`; chained with
distribution in
`fixtures/main-owner0-world-pass-production-distribution.json`):

1. returns immediately when `$C8A5 == 0`;
2. iterates owner-`0` provinces when active owner is `0`;
3. calculates province income through `main:L5193`;
4. splits production through growth `$C8B3` and investment `$C8B4`;
5. accumulates saved village investment in `$C902 + province`;
6. accumulates saved fortification investment in `$C966 + province`;
7. buys villages using `$C900` until capacity blocks it;
8. upgrades fortification using cost table `L300F` (`20, 30, 40, 50, 60, 80`);
   `$C8AF` blocks only provinces exactly at that level, so captured castles
   above the normal province limit are not invalid state;
9. converts remaining production to soldiers on that province;
10. after the scan, sums remaining `$C902 + $C966`, takes
    `floor(sum * $C901 / 100)`, and distributes that as soldiers over royalist
    provinces via `main:L4F49`.

The active TypeScript world phase now ports this path with explicit
`GameState.c64.royalistProvinceMemory` buckets, first-class owner `0`, and
fixture-backed tests. The neutral production-to-distribution chain is compared
in `games/war-for-crown/src/game/royalists.test.ts`: `$5209` changes royalist
soldiers to `3/13/20`, then `$50D3` pulls fourteen mobile soldiers from that
post-production state and ends at `8/8/20`. The hostile non-home world-pass
fixture keeps the player home at province `4`, runs `$5209` after the capture,
and `$50D3` redistributes owner-`0` soldiers to `17/18/18/11` without setting
game-over. Hostile elimination parity still needs broader owner-`0`
integration traces.

Royalist distribution (`main:L50D3`, confirmed structure plus
`fixtures/main-l50d3-royalist-distribution-equal.json` and
`fixtures/main-l50d3-royalist-distribution-frontier.json`, plus
`fixtures/main-l50d3-royalist-distribution-equal-multicomponent.json` for
component/remainder behavior; chained with production in
`fixtures/main-owner0-world-pass-production-distribution.json` and after a
hostile non-home capture in
`fixtures/main-l337a-hostile-nonhome-world-pass.json`):

1. returns when royalists are friendly according to `$C8A5`;
2. returns when `$C8A8 == 0`;
3. returns when royalists already own the full continent;
4. flood-fills each connected owner-`0` component;
5. marks each component as `$10 | $01`;
6. pulls all mobile soldiers from the component with `main:L5005`, leaving one
   garrison everywhere;
7. when `$C8A8 == 1`, distributes the pulled soldiers evenly across the whole
   component;
8. when `$C8A8 != 1`, `main:L514A` narrows the component to frontier provinces
   and distributes the pulled soldiers there;
9. repeats until every royalist component has been processed.

## Victory And Finish

Evidence: `main:L3312`, `main:L3384`, `main:L339B`, `main:L4C7A`,
`fixtures/main-code-final-screen-loader.json`, and
`c64-final-loader-bridge-analysis.md`.

C64 terminal conditions recovered so far:

1. a player owning all provinces enters `main:L3384`;
2. royalists owning all provinces enter `main:L339B`;
3. capturing a player's home castle triggers `main:L4C7A`, eliminates that
   player, transfers all remaining owned provinces, and can leave only one
   surviving player without ending the game if owner `0` still holds land;
4. eliminated players are skipped by `main:L3312`.

Victory state details:

- `main:L3384` sets winning player's `$C8CF,x` title/rank field to `5`;
- `main:L3384` writes `$CA75 = 3` for a human player owning the continent;
- `main:L3384` writes `$CA75 = 1` for an AI player owning the continent;
- `main:L339B` writes `$CA75 = 2` for royalists owning the continent;
- `main:L33A0` restores the low-level text-stream reader at `$1D50..$1D52` to
  `A0 00 B1`; this is the original `LDY #$00; LDA ($4C),Y` prefix, not a final
  loader jump;
- `code:L5960` calls `code:L5305 -> code:L5297`, which swaps `$C980..$CA7F`
  with `$4D00..$4DFF`; this moves `$CA75` to `$4DF5`;
- `code:L5960` maps loader result `1`, `2`, and `3` to `TXTWIN1`, `TXTWIN2`, and
  `TXTWIN3`; result `4` skips `TXTWIN` loading.
- if royalists capture the last player's home castle during `L4C7A`, the
  immediate capture routine only transfers provinces; `main:L3312` then skips
  zero-province players and reaches `main:L339B` when it wraps through owner `0`
  and sees `$C8B5 == $C8A1`; this full caller path is fixture-backed by
  `fixtures/main-l3312-hostile-home-castle-world-pass.json`.
- if royalists capture a non-home province during the owner-`0` world pass,
  `main:L3312` still calls post-world display/status and month/weather, leaves
  `$CA75 = 0`, and returns to the surviving player slot; this full caller path
  is fixture-backed by `fixtures/main-l3312-hostile-nonhome-world-pass.json`.

Compatibility implementation target:

- declare a non-royalist winner only when that player owns every non-water
  province;
- handle royalist terminal state separately when owner `0` owns all provinces;
- never allow a zero-province player to act;
- make castle capture transfer armies/provinces immediately and visibly.

Open:

- implementation localization keys for the recovered title/status text corpus.

## `c64-original-simple` Validation Status

The implementation checklist above is complete for gameplay logic. The current
runtime gate compares VICE and TypeScript with the same RNG bytes across event,
map/setup, AI phase, battle, royalist, calendar, and victory state. It includes
a naturally finishing 17-round game, a 38-round regression, and three bounded
human-to-AI reaction scenarios.

Run the complete gate with:

```bash
pnpm --filter war-for-crown test:parity
```

The byte fields compared by the gate and its exact scenario boundary are listed
in `c64-port-completeness-matrix.md`. Full-rules `$CA55/$CA56` systems and exact
C64 text reproduction remain outside the simple gameplay-logic claim.
