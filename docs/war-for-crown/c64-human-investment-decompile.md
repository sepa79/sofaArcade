# War for Crown C64 Human Investment Decompile

This document records the recovered human investment/build phase from
`ERBENT1A.D64`.

## Entry And Phase State

Evidence: `main:L4196..L479D`,
`fixtures/main-human-investment-actions.json`, and
`fixtures/main-screen-action-indices.json`.

`main:L4196`:

1. restores display patch bytes around `L3E62..L3E69`;
2. resets `$CA47`;
3. resets current-turn hired soldier counters
   `$C9EE/$C9F2/$C9F6 + activePlayer`;
4. if active player is computer-controlled, jumps to `cbaron:$5800`;
5. if simple mode is active (`$CA55 == 0`) and player money is zero, skips the
   visible investment menu and goes to the end-of-investment interest path;
6. otherwise displays money, income, and enabled full-rules fields;
7. reads a menu choice through `main:L4D4F`;
8. dispatches through the jump table at `main:L42D3`.

The simple `ERBENT1A` subset must expose:

- recruit soldiers;
- build villages;
- upgrade fortification;
- end investment/next turn.

Catapults and supplies exist in this later binary but remain disabled for the
current simple ruleset.

## Menu Choice Indices

Evidence: `fixtures/main-screen-action-indices.json`.

The post-render dispatch entry is `main:$42B8`. Starting at `$42B6` is invalid
because `$42B6` is the operand byte inside the preceding `JSR $2AEF`.

`main:L42D3` maps `A` indices returned by `main:L4D4F` as follows:

| A | Target | Simple Ruleset Meaning |
| ---: | --- | --- |
| 0 | `$437B` | recruit soldiers |
| 1 | `$446B` | build villages |
| 2 | `$45FE` | upgrade fortification |
| 3 | `$42DF` | catapult branch, disabled in simple mode |
| 4 | `$4371` | full-rules stock transfer selector, disabled in simple mode |
| 5 | `$4752` | end investment and apply interest |

The `$4371` full-rules branch still uses `X` after the table dispatch:

- `A == 4, X == 0` reaches `main:L3E6A`;
- `A == 4, X != 0` reaches `main:L3FA4`.

These stock-transfer branches are recorded for the complete port, but are not
part of the current simple C64-compatible ruleset.

## Recruitment

Evidence: `main:$437B..$4463` and
`fixtures/main-human-investment-actions.json`.

Recruitment behavior:

1. displays current money;
2. sets chooser max `$161A..$161C` to current money;
3. sets chooser min and current value to `0`;
4. runs the numeric chooser at `sys:L984B`;
5. subtracts chosen amount `$1614..$1616` from player money
   `$C8BB/$C8C0/$C8C5 + player`;
6. adds the same amount directly to the player's home province
   `$C8FB + player`;
7. adds the same amount to current-turn hired counters
   `$C9EE/$C9F2/$C9F6 + player`;
8. redraws the home province and returns to the investment menu.

Rule: one taler buys one soldier, and recruited soldiers go immediately to the
home castle. There is no reserve pool.

## Village Purchase

Evidence: `main:$446B..L45EF`, `main:L456F`, `sys:L9A2A`, and
`fixtures/main-human-investment-actions.json`.

Village behavior:

1. prompts for an owned province;
2. rejects non-owned provinces;
3. calls `sys:L9A2A` to get the province village cap;
4. if current villages are already at cap, displays the cap message;
5. computes missing villages as `cap - currentVillages`;
6. computes affordable villages as `floor(money / $C900)`;
7. chooser max is `min(missingVillages, affordableVillages)`;
8. chooser min/current value starts at `0`;
9. chosen count is added to `$C6A2 + province`;
10. cost is `chosenCount * $C900`;
11. cost is subtracted from player money;
12. chosen count is added to the player statistic counter
    `$C9FB/$CA00/$CA05 + player` through `main:L456F`;
13. province is redrawn and the investment menu resumes.

Rule: village purchases are province-specific and can be repeated while money
and cap allow it.

## Fortification Upgrade

Evidence: `main:$4612..L4749`, cost table `main:L300F`, and
`fixtures/main-human-investment-actions.json`.

Fortification behavior:

1. prompts for an owned province;
2. rejects non-owned provinces;
3. rejects a province already marked with `$C832 & $20` in this investment
   phase;
4. chooses max level:
   - home province uses `$C8AE` when non-zero;
   - other provinces use `$C8AF`;
5. if current level `$C63E + province` already equals max, displays max message;
6. cost is `L300F[currentLevel]`;
7. if money is insufficient, displays no-money message;
8. after confirmation, sets `$C832 |= $20` for the province;
9. increments `$C63E + province`;
10. subtracts the cost from player money;
11. redraws the province and returns to the investment menu.

Rule: a province can receive at most one fortification upgrade in one investment
phase. Multiple different provinces can be upgraded if legal and affordable.

## Interest / End Investment

Evidence: `main:$4752..L479D` and
`fixtures/main-human-investment-actions.json`.

End-of-investment behavior:

1. multiplies current money by `$C901`;
2. divides the product by `100`;
3. adds that interest amount back to current money;
4. when full-rules supplies are enabled (`$CA55 != 0`), also reduces the
   full-rules stock fields by one percent;
5. returns to the main phase loop.

Rule: `$C901` is an interest percentage applied at the end of the human
investment phase. In the simple ruleset, only money interest applies.

## Fixture Coverage

`fixtures/main-human-investment-actions.json` confirms:

- `$C901 = 8` with money `250` produces interest `20` and final money `270`;
- recruitment spends one taler per soldier and adds the selected count directly
  to `$C8FB + player`, the home province;
- village purchase uses `sys:L9A2A`, clamps chooser max to
  `min(cap - currentVillages, floor(money / $C900))`, and spends
  `chosenCount * $C900`;
- fortification upgrade from level `0` costs `main:L300F[0] = 20`, increments
  `$C63E + province`, and sets `$C832 + province |= $20`;
- a second fortification upgrade attempt on the same province in the same
  investment phase is rejected without changing money or fort level.

## Disabled Simple-Mode Branches

Later/full rules branches in this same menu include catapults and supplies.
They must stay disabled/no-op in the current simple `ERBENT1A` mode unless the
full ruleset is explicitly selected later.

Relevant full-rules fields:

- `$CA42 + player`: catapult count;
- `$CA55/$CA56`: full-rules feature gates;
- `$CA2E/$CA32/$CA36/$CA3A + player`: stock/supply fields.

## Open Fixture Items

None known for the simple investment ruleset.
