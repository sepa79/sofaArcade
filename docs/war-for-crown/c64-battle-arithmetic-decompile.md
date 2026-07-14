# War for Crown C64 Battle Arithmetic Decompile

This document records the recovered C64 battle arithmetic needed for the
`c64-original` port. It complements `c64-attack-code-analysis.md`.

## Arithmetic Helpers

Evidence: `sys:L96CD..L981E`.

All helpers use little-endian multi-byte registers:

| Register | Meaning |
| --- | --- |
| `$57..$5A` | 32-bit multiplier/divisor/right operand |
| `$5B..$5E` | 32-bit multiplicand/dividend/left operand |
| `$5F..$62` | 32-bit product or division remainder |

Helpers:

| Routine | Behavior |
| --- | --- |
| `sys:L96CD` | sets `$5B = Y`, clears `$5C..$5E`, then enters multiply with `X` |
| `sys:L96D7` | sets `$57 = X`, clears `$58..$5A`, then enters multiply |
| `sys:L96E1` | unsigned 32-bit shift-add multiply into `$5F..$62`; overflow is not an exception. If adding into `$62` carries out, the routine returns with the current low 32-bit product state. |
| `sys:L9726` | sets divisor to decimal `100`, then enters divide |
| `sys:L9728` | sets one-byte divisor `A` in `$57`, clears `$58..$5A`, then enters divide |
| `sys:L9732` | unsigned 32-bit divide: quotient ends in `$5B..$5E`, remainder in `$5F..$62` |
| `sys:L9781` | square-root-like Newton helper; used by strength calculations, not by the raw round hit roll |
| `sys:L981E` | copies `$5F..$62` into `$5B..$5E` |

### `sys:L9781`

Evidence: `sys:L9781..L981D`.

`L9781` is not plain `floor(sqrt(value))`. It:

1. copies the 32-bit input from `$5B..$5E` to `$57..$5A`;
2. finds the highest set bit by scanning the highest non-zero byte;
3. builds an initial divisor by right-shifting the original input by
   `floor(bitIndex / 2)`, rounding up if the last shifted-out bit is set;
4. if the original bit index is odd, right-shifts that divisor once more, again
   rounding up;
5. divides the original input by that divisor through `sys:L9732`;
6. averages the divisor and quotient, rounding up when the low bit is set.

Confirmed listing-derived values used by the TypeScript port:

| Input | `L9781` output | `floor(sqrt(input))` |
| ---: | ---: | ---: |
| `0` | `0` | `0` |
| `1` | `1` | `1` |
| `2` | `2` | `1` |
| `4` | `2` | `2` |
| `10` | `3` | `3` |
| `1000` | `32` | `31` |
| `46811` | `219` | `216` |
| `65536` | `256` | `256` |

The cbaron threat requirement path `cbaron:L642F` uses this helper after
computing `floor(($9400 << 16) / $9401)`, then multiplies by the strongest
adjacent mobile force and divides by `$E0` (`224`).

## Random Helper

Evidence: `sys:L982F`.

`L982F` takes an upper value in `A`, calls RNG `kernal:L218B`, reduces the random
byte modulo that upper value by repeated subtraction, then returns:

```text
(randomByte % A) + 2
```

The helper is implemented through self-modified immediate operand storage at
`sys:L9849`. It also stores the returned value in `$9849`; some random event
modules read `$9849` after calling `L982F`. A compatibility port should model
that side effect instead of treating the helper as a pure scalar return in
event code.

## Combat Setup

Evidence: `sys:L949D`, `kampf` data at `$7E09..$7E2D`.

`sys:L949D` initializes the battle combat fields:

| Field | Meaning |
| --- | --- |
| `$9400` | attacker combat percentage displayed as left `KAMPFKRAFT` |
| `$9401` | defender combat percentage displayed as right `KAMPFKRAFT` |
| `$9402` | attacker hit-roll denominator/scale |
| `$9403` | defender hit-roll denominator/scale |
| `$9404` | target terrain id |
| `$9405` | target fortification level |
| `$9406` | defender retreat legality target id, `0` when no retreat; calculated by `kampf:L7F01` |
| `$9407` | attacker catapult/fort-pressure count in full rules |
| `$9408` | defender castle/fort-pressure count in full rules |

Simple mode keeps `$9407/$9408` at zero unless the selected baseline explicitly
enables the corresponding full-rules features.

Tables:

| Address | Values | Meaning |
| --- | --- | --- |
| `$7E09` | `25,18,16,14,12,10,8` | base attacker combat percent by fortification level |
| `$7E10` | `0,12,18,25,37,50,75` | base defender combat percent by fortification level |
| `$7E17` | `0,25,25,30,35,40,45,50` | defender terrain combat add by terrain id |
| `$7E1F` | `0,10,10,10,10,10,15,15` | defender hit-roll denominator by terrain id |
| `$7E27` | `0,5,10,15,20,25,30` | attacker hit-roll denominator add by fortification level |

Terrain ids are the C64 ids stored in `$C576 + province`, not the current
`TERRAIN_DEFINITIONS` object order. The C64 land mapping is:

| C64 terrain id | Terrain |
| ---: | --- |
| `1` | grass / plains |
| `2` | desert |
| `3` | bushes / brushland |
| `4` | forest |
| `5` | hills |
| `6` | swamp / marshland |
| `7` | chain / mountains |

`sys:L949D` formula:

```text
terrainIndex = C8B1 == 0 ? 1 : targetTerrain
fort         = targetFortification

defenderHitDenominator = table7E1F[terrainIndex]
attackerHitDenominator = defenderHitDenominator + table7E27[fort]

attackerCombatPercent = table7E09[fort] + attackerFullRuleBonus9407
defenderCombatPercent = table7E10[fort] + table7E17[terrainIndex] + defenderFullRuleBonus9408
```

The battle screen displays `$9400` and `$9401`.

## One Combat Round

Evidence: `kampf:L8568`, `kampf:L85C0`, `kampf:L8618`,
`fixtures/kampf-round-20v6-terrain4-fort0-rng7b.json`,
`fixtures/kampf-round-1v1-min-hit-rng00.json`, and
`fixtures/kampf-round-20v1-defender-clamp-rng7b.json`, and
`fixtures/kampf-round-20v6-terrain7-fort6-rng7b.json`, and
`fixtures/kampf-round-300v300-multibyte-rng7b.json`.

The round is simultaneous, but hit calculation has an observable RNG order:

1. attacker hits are calculated first from attacker soldiers and stored in
   `L92C5..L92C7`, consuming the first battle RNG byte;
2. defender hits are calculated second from defender soldiers and stored in
   `L92C2..L92C4`, consuming the next battle RNG byte;
3. both hit counts are clamped to at least `1`;
4. defender hits are subtracted from attacker soldiers `$C9D0..$C9D2`;
5. attacker hits are subtracted from defender soldiers `$C9D3..$C9D5`;
6. if a hit count exceeds available soldiers, it is clamped to the remaining
   army and that side becomes zero.

Confirmed round fixtures:

| Fixture | Setup | Observed |
| --- | --- | --- |
| `kampf-round-20v6-terrain4-fort0-rng7b` | attacker `20`, defender `6`, combat `25/35`, denominators `10/10`, RNG `$7B` | final soldiers `19/0` after full `L8618` including stat side effects |
| `kampf-round-1v1-min-hit-rng00` | attacker `1`, defender `1`, combat `25/25`, denominators `10/10`, RNG `$00`; breakpoint `$86C4` | both raw hit counts are raised to `1`; final soldiers `0/0`; `L92C2 = 1`, `L92C5 = 1` |
| `kampf-round-20v1-defender-clamp-rng7b` | attacker `20`, defender `1`, combat `25/35`, denominators `10/10`, RNG `$7B`; breakpoint `$86C4` | defender casualty is clamped to `1`; final soldiers `19/0`; `L92C5 = 1` |
| `kampf-round-20v6-terrain7-fort6-rng7b` | real `L949D` setup for C64 terrain `7`, fortification `6`, RNG `$7B`; breakpoint `$86C4` | combat context `8/125`, denominators `45/15`; final soldiers `13/5`; `L92C2 = 7`, `L92C5 = 1` |
| `kampf-round-300v300-multibyte-rng7b` | attacker `300`, defender `300`, combat `25/35`, denominators `10/10`, RNG `$7B`; breakpoint `$86C4` | multi-byte casualties `90/105`; final soldiers `210/195`; `L92C2 = 90`, `L92C5 = 105` |

Full battle transcripts that stop after `main:L4C50` should not treat
`$92C2..$92C7` as canonical round casualties: the stat-counter path can modify
those scratch fields after `$86C4`. The attacker-retreat evidence therefore
uses `fixtures/cbaron-5803-attacker-retreat-round-trace.mon` to stop at
`kampf:$86C4` for every combat round, while
`fixtures/cbaron-5803-attacker-retreat-line.json` keeps the later `$4C50` dump
as final aftermath evidence.

### Defender Hits Against Attacker

Evidence: `kampf:L8568`.

```text
roll = (rngByte % defenderCombatPercent) + 2
randomPart = roll * defenderHitDenominator
factor = 100 + randomPart
raw = defenderSoldiers * factor
hits = floor(floor(raw / defenderHitDenominator) / 100)
```

Stored into `L92C2..L92C4`.

### Attacker Hits Against Defender

Evidence: `kampf:L85C0`.

```text
roll = (rngByte % attackerCombatPercent) + 2
randomPart = roll * attackerHitDenominator
factor = 100 + randomPart
raw = attackerSoldiers * factor
hits = floor(floor(raw / attackerHitDenominator) / 100)
```

Stored into `L92C5..L92C7`.

## Battle Strength Ratio For AI Decisions

Evidence: `sys:L9426`, `sys:L946F`, `sys:L9486`, `kampf:L83C4`,
`kampf:L842E`,
`fixtures/sys-ratio-20v6-combat25v35.json`,
`fixtures/sys-retreat-threshold-boundaries.json`, and
`fixtures/kampf-l83c4-ai-command-dispatch.json`, and
`fixtures/kampf-l842e-threshold-boundaries.json`.

`sys:L9426` produces a raw 32-bit product in `$5F..$62`:

```text
soldierRatio = floor(attackerSoldiers * 256 / defenderSoldiers)
squaredRatio = soldierRatio * soldierRatio
defenceAdjusted = floor(squaredRatio / defenderCombatPercent)
rawProduct = defenceAdjusted * attackerCombatPercent
```

The threshold helpers do not compare the low byte `$5F`. They compare
`$60..$62` against the three-byte threshold table, so the effective ratio exposed
to the TypeScript port is:

```text
ratio = floor(rawProduct / 256)
```

Fixture `sys-ratio-20v6-combat25v35` confirms the distinction: `$5F..$62` is
`14 ee 07 00`, raw decimal `519700`, while the threshold-visible value is
`floor(519700 / 256) = 2030`.

Known thresholds:

| Address | Decimal | Meaning |
| --- | ---: | --- |
| `$7E2E..$7E30` | `230` | attacker battle AI retreats below this |
| `$7E31..$7E33` | `435` | defender battle AI retreats at/above this when legal; also used by attack source pruning |
| `$7E34..$7E36` | `333` | computer baron attack candidate threshold |
| `$7E37..$7E39` | `256` | hostile royalist attack threshold when success-evaluation option selects this path |

Confirmed retreat-threshold fixture:

| Helper | Ratio | Observed carry | Battle meaning |
| --- | ---: | ---: | --- |
| `sys:L946F` | `229` | `0` | `kampf:L83C4` stores attacker retreat command `2` |
| `sys:L946F` | `230` | `1` | attacker AI does not retreat on this check |
| `sys:L9486` | `434` | `0` | defender AI does not retreat on this check |
| `sys:L9486` | `435` | `1` | `kampf:L83C4` stores defender retreat command `1` if `$9406 != 0` |

Confirmed `kampf:L7F01` defender-retreat target fixture:

| Case | `$9406` |
| --- | ---: |
| target is not defender home and adjacent defender-owned province exists | `1` |
| target is defender home castle, adjacent defender-owned province exists | `0` |
| target is not defender home but no adjacent defender-owned province exists | `0` |
| defender owner is `0`, adjacent owner-`0` provinces exist | `3` |

Confirmed `kampf:L83C4` dispatch fixture:

| Case | Observed command |
| --- | ---: |
| defender AI can retreat and `sys:L9486` returns carry set | `1` |
| defender AI declines, attacker AI `sys:L946F` returns carry clear | `2` |
| both AI helpers decline retreat | `0` |
| `$9406 = 0`, defender helper would otherwise retreat | `0` |
| defender owner is `0`, legal retreat exists, helper returns carry set | `1` |
| attacker owner is `0`, helper returns carry clear | `2` |

## Casualty And Stat Counters

Evidence: `kampf:L8618..L8827`.

After soldiers are reduced:

- active attacker loss/kill counters are updated through `$C9FB/$CA00/$CA05`
  and `$CA20/$CA25/$CA2A`;
- defender owner counters are updated symmetrically through `$C9D8`;
- half of the current-round hits are subtracted back from cumulative killed
  counters, which matches the C64's score/title accounting rather than map
  soldier state.

The map soldier state remains only `$C9D0..$C9D5` until the battle finish path
writes survivors back to provinces.

## Battle Finish Soldier Check

Evidence: `kampf:L82D5..L8314`.

The raw round arithmetic can leave both sides at zero soldiers. The finish
routine does not allow the map to keep a zero-soldier defending province:

```asm
L82D5:  lda     $C9D0
        ora     $C9D1
        ora     $C9D2
        beq     L82EE
        lda     $C9D3
        ora     $C9D4
        ora     $C9D5
        bne     L82FE
        jmp     L836F

L82EE:  lda     $C9D3
        ora     $C9D4
        ora     $C9D5
        bne     L8314
        inc     $C9D3
        bne     L8314
```

Meaning:

- attacker `0`, defender `>0`: defender wins;
- attacker `0`, defender `0`: C64 increments defender low byte to `1`, then
  defender wins;
- attacker `>0`, defender `0`: attacker wins;
- both non-zero: the command byte `$C9D9` decides whether the loop continues or
  finishes a retreat.

The port keeps `c64BattleRound` raw for fixture parity, then applies
`c64BattleFinishSoldiers` before resolving ownership or retreat aftermath.

## Full-Rules Catapult/Fort Pressure

Evidence: `kampf:L80F1..L82B9`, `kampf:L87A2..L8827`.

When `$CA56` or `$CA55` are enabled, battle can adjust `$9407`, `$9408`,
`$9400`, and `$9401` during combat. This is the later/full-rules path that
interacts with castle/fort pressure and possibly supplies/catapults.

Simple mode requirement:

- keep `$CA55 = 0` and `$CA56 = 0`;
- keep `$9407/$9408` zero in the simple battle model;
- do not enable catapult/stock pressure paths unless a future full-rules mode
  explicitly selects them.

## Porting Targets

Pure functions required for byte-exact battle:

1. `c64RandomModuloPlusTwo(max, rngByte)`
   - implements `sys:L982F`, including the `$9849` stored-result side effect
     where event modules need it.
2. `c64CombatSetup(terrain, fort, terrainInfluence, fullRuleBonuses)`
   - implements `sys:L949D`.
3. `c64BattleHits(soldiers, combatPercent, hitDenominator, rngByte)`
   - implements `kampf:L8568/L85C0`.
4. `c64BattleRound(state, rng)`
   - implements `kampf:L8618`.
5. `c64BattleFinishSoldiers(round)`
   - implements the soldier-state part of `kampf:L82D5..L8314`.
6. `c64BattleStrengthRatio(state)`
   - implements `sys:L9426`.

Implemented port guard:

- `games/war-for-crown/src/game/c64-battle.ts` owns the C64 terrain-id mapping
  and recovered terrain combat tables, battle setup, hit arithmetic, raw rounds,
  and finish-soldier check.
- `games/war-for-crown/src/game/c64-battle.test.ts` proves the current
  `TerrainId` names map to C64 terrain ids `1..7` and matches the recovered
  combat fixtures.
- `games/war-for-crown/src/game/logic.ts` uses `c64CombatSetup`,
  `c64BattleRound`, and `c64BattleFinishSoldiers` in the active battle flow.

## Still Open

- Keep future full-rules `$CA55/$CA56` catapult/stock pressure out of the simple
  ruleset until that mode is explicitly selected.
