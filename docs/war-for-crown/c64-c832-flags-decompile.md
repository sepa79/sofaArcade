# War for Crown C64 `$C832` Scratch Flags

`$C832 + province` is a per-province scratch flag array. It is not a persistent
state schema with one global meaning per bit. The same bit can be reused by
different phases after masks clear the previous phase's work state.

This document records the recovered meanings by context so the TypeScript port
can use explicit temporary structures instead of copying a single opaque flag
byte into domain state.

## Shared Helpers

Evidence: `kernal:L219C`, `L21F0`, `L2207`, `L2221`, `L2253`, and `main`
callers.

| Helper | Behavior |
| --- | --- |
| `kernal:L219C` | mark provinces adjacent to `$161F` with `$80` |
| `kernal:L21F0` | clear high bits with `& $3F` on provinces not owned by active `$1624` |
| `kernal:L22CA` | clear high bits with `& $3F` on provinces owned by active `$1624` |
| `kernal:L2207` | find a province with `($C832 & $C0) == $80`, promote it with `$C0`, return its id |
| `kernal:L2221` | flood-fill the active-owned component from `$161F`; membership is tested with `$80` |
| `kernal:L2253` | mask every flag byte with register `X` |

Common masks:

| Mask | Effect in observed callers |
| ---: | --- |
| `$00` | clear every flag bit |
| `$3F` | clear flood-fill high bits `$40/$80` |
| `$7F` | clear `$80` frontier/reachable bit |
| `$EF` | clear `$10` selected-set bit |
| `$2F` | keep `$01/$02/$04/$08/$20`; clear `$10/$40/$80` |
| `$35` | keep `$01/$04/$10/$20`; clear `$02/$08/$40/$80` |

## Bit Meanings By Context

| Bit | Recovered contexts |
| ---: | --- |
| `$01` | Attack source exhausted/spent after a battle; human attack setup rejects sources with `$01`. AI also uses it as an excluded/locked province marker, especially for disconnected full-rules provinces and fallback redistribution. |
| `$02` | AI accepted candidate marker. In `cbaron:L6560` it marks attackable targets before `L6808` scores them. In cbaron fort spending it marks temporary upgrades that can be rolled back. In movement placement it marks staging candidates after reachability checks. |
| `$04` | Cbaron cleanup/captured-province marker used by `cbaron:L6A64`; weak marked provinces can be converted or repaired during cleanup. |
| `$08` | Cbaron movement redistribution target candidate from `cbaron:L6BC5`, consumed by `cbaron:L6C49`. |
| `$10` | Context-local selected set. Human attack uses it for chosen source provinces. Shared retreat placement uses it for attacker return distribution. Royalist distribution uses it for the active redistribution component. Cbaron routines use it for owned source/frontier sets. |
| `$20` | Context-local phase marker. Human investment uses it as "fortification already upgraded this month" in `main:L463D/L4708`. Cbaron cleanup uses it as a surplus/weak-province work marker in `L6AA0..L6B61`. |
| `$40` | Flood-fill accepted/internal component marker. It is normally paired with `$80`; exact membership tests use `$80`, while `($C832 & $C0) == $80` means frontier candidate not yet promoted. |
| `$80` | Adjacent/reachable/frontier marker. `L219C` sets it, `L2207` promotes it to `$C0`, and most component-membership checks use `& $80`. |

## Human Attack Source Exhaustion

Evidence: `main:L487E..L4C50`.

1. Human attack setup toggles `$10` on selected source provinces.
2. `main:L5005` pulls mobile soldiers from every `$10` source, leaving one
   soldier in each source.
3. After battle aftermath, `main:L4C3E..L4C4D` sets `$01` on every province
   still marked `$10`.
4. `main:L4C50` clears `$10` with mask `$EF`.
5. Later attack setup rejects any owned source with `$01`.

This is the rule that prevents reusing the same attacking army repeatedly in one
attack phase.

## Human Movement Reachability

Evidence: `main:L33B3..L3546`, `kernal:L2221`.

Movement uses `$80` only as connected-component reachability. It does not set
`$01`, so movement can be repeated in the movement phase.

## Human Fort Upgrade Once Per Month

Evidence: `main:L4612..L4749`.

The investment menu uses `$20` for one specific rule: a province can receive at
most one fortification upgrade in the current investment phase. This marker is a
phase-local scratch bit and is not a permanent province property.

## Retreat And Distribution Sets

Evidence: `main:L4F49`, `main:L4FA7`, `main:L5005`, `main:L50D3`, `main:L5134`,
`main:L514A`, and
`fixtures/main-retreat-placement-multiple-destinations.json`.

- Attacker retreat/failure distributes survivors over provinces marked `$10`.
- Defender retreat distributes survivors over adjacent owned provinces marked
  `$80`.
- In both retreat-distribution routines, remainder soldiers go to the
  highest-numbered marked provinces first.
- Royalist redistribution first builds `$10` component sets and then converts
  narrowed frontier sets back into `$80` for even distribution.

## AI Work Sets

Evidence: `cbaron:L5914`, `L5D7F..L6207`, `L6560..L6808`, `L6A64..L6DFA`.

Cbaron code uses the same flag byte as a compact worklist:

- `$10` is context-dependent even inside cbaron. In attack entry it first marks
  active-owned provinces, then `L6B8C` converts it into the non-owned frontier
  target set. After a target is selected, `L66B1..L673D` rebuilds `$10` again as
  the actual adjacent source set.
- `$02` means candidate accepted for the current scoring pass.
- `$08` means movement target candidate.
- `$04/$20` are cleanup/surplus markers.
- `$01` is an exclusion/locked marker.

These should become separate typed work arrays in TypeScript. There is no single
domain-level enum that safely captures all `$C832` values across phases.

## Still Required

- Fixture selected masks around `cbaron:L6C49` and `cbaron:L6A64` once VICE ROMs
  are available, to prove carry/overflow behavior. The bit roles above are
  recovered statically.
