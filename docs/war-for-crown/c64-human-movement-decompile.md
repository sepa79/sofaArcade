# War for Crown C64 Human Movement Decompile

This document records the recovered C64 human movement phase. It supersedes the
older open note that movement amount/default behavior was unknown.

## Entry

Evidence: `main:L33B3..L3546`, `sys:L984B..L99FF`, `kernal:L2221`,
`kernal:L219C/L21F0/L2207`, and
`fixtures/main-human-movement-connected-transfer.json`.

`main:L33B3` is the human movement phase entry:

1. if active player is computer-controlled, it jumps to `cbaron:$5806`;
2. otherwise it masks province flags with `#$80`;
3. it prompts for a source province;
4. the source must be owned by active `$1624`;
5. it prompts for a destination province;
6. the destination must also be owned by active `$1624`;
7. source and destination cannot be the same province;
8. it flood-fills from the destination with `kernal:L2221`;
9. the original source must have `$C832 & $80` after that flood-fill;
10. if not reachable, it displays the invalid move message and restarts.

Rule implication: C64 human movement is connected-owned-path movement, not
single-edge adjacency. A move is legal when source and destination are in the
same connected active-owned component.

## Transfer Arithmetic

Once movement is legal:

1. destination soldiers are copied to `$C9D3..$C9D5`;
2. source soldiers are copied to `$C9D0..$C9D2`;
3. total soldiers are calculated as `source + destination`;
4. `$C9D0..$C9D2` is overwritten with that total;
5. minimum destination value `$1617..$1619` is set to `1`;
6. maximum destination value `$161A..$161C` is set to `total - 1`;
7. current selected destination value `$1614..$1616` starts as the destination's
   current soldier count;
8. `sys:L984B` runs the numeric chooser;
9. after chooser confirmation, destination soldiers become `$1614..$1616`;
10. source soldiers become `total - $1614..$1616`;
11. the phase returns to `main:L33B3`, so another movement can be made.

Important rule: C64 movement chooses the final soldier count in the destination
province. It does not directly choose "how many soldiers to move". The source
gets the remainder.

## Numeric Chooser

Evidence: `main:L3546`, display callback at `main:$3557`, `sys:L984B..L99FF`.

`main:L3546` calls `sys:L984B` with display callback address `$3557`.

`sys:L984B`:

1. receives a display callback pointer in `A/X`;
2. computes the movement range as `max - min`;
3. chooses the largest usable step index `$940A`;
4. initializes current step index `$9409` to `0`;
5. repeatedly displays the current value through the callback;
6. adjusts either the step index or selected value from input;
7. keeps selected value between min and max;
8. exits only after release/confirmation.

Step values are a three-byte table split across `sys:L940B`, `sys:L9414`,
and `sys:L941D`:

| Step index | Value |
| ---: | ---: |
| `0` | `1` |
| `1` | `10` |
| `2` | `100` |
| `3` | `1000` |
| `4` | `10000` |
| `5` | `100000` |
| `6` | `1000000` |
| `7` | `10000000` |
| `8` | sentinel `$FFFFFF` |

The display callback at `main:$3557`:

1. reads `$DC01 & #$10`; when that fire/shortcut bit is active low, it sets
   selected destination soldiers to `floor(total / 2)`;
2. displays destination soldiers from `$1614..$1616`;
3. displays source soldiers as `total - destination`;
4. displays the current step value unless the sentinel step is selected.

Implementation implication: the modern movement UI should use a slider/stepper
over the final destination count, with min `1`, max `total - 1`, initial value
equal to the destination's current soldiers, and an equal-split button that sets
`floor(total / 2)`.

## Same-Turn State

This routine does not mark moved provinces as spent. After applying the transfer
it redraws both provinces and jumps back to `main:L33B3`, allowing another legal
movement in the same movement phase.

This differs from attack phase source flags: movement is repeatable within a
phase as long as each transfer remains legal.

## Fixture Coverage

`fixtures/main-human-movement-connected-transfer.json` confirms:

- `kernal:L2221` marks a non-adjacent source province as reachable when source
  and destination are connected through active-owned land;
- `$161F` is mutated by flood-fill and must not be read after `L2221` as the
  original destination;
- `main:L346B` keeps the total soldier count and applies the chooser value as
  the final destination count;
- the destination range is `1..total - 1`, including the `1+1` endpoint case.

## Open Fixture Items

- exact physical input mapping for C64 numeric chooser directions, which is
  presentation-only for the browser port. The equal-split shortcut is already
  address-backed by `main:$3557`.
