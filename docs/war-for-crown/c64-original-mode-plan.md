# War for Crown C64 Original Mode Plan

This document tracks the path from `c64-workbench` to a real `c64-original`
mode. It extends `c64-ai-analysis.md`.

If this document conflicts with `AGENTS.md`, `AGENTS.md` wins.

## Target

`c64-original` means behavior-compatible with the recovered C64 rules, not a
modern stronger AI and not a loose approximation.

The mode has two separate parts:

- computer barons: player-slot AI consuming `PlayerView -> WarForCrownAction`;
- Königstreuen/Kingsmen: owner `0` world-system behavior, not an AI player.

## Required Foundations

1. C64 province worklist:
   - reproduce the `$C832` high-bit reachability behavior used by `kernal:$219C`,
     `kernal:$21F0`, `kernal:$2207`, and `kernal:$2253`;
   - use it for baron attacks, movement, and Kingsmen aggregation.
2. C64 start ownership model:
   - C64 owner `0` is Königstreuen/Kingsmen;
   - `c64-owner-0-migration-plan.md` records the completed replacement of the
     temporary `null` mapping with literal owner `0`.
3. Computer baron strategy:
   - restore `$5800` economy, `$5803` attack, `$5806` movement, `$6A64` cleanup;
   - expose it as `c64-original` only after fixture coverage exists.
4. Kingsmen world phase:
   - hostile attacks from `kampf:$8461`;
   - production/investment from `main:$5209`;
   - distribution/pressure from `main:$50D3`.

## Implemented First Slice

The C64 province worklist is implemented as a pure TypeScript module with tests.
It removes the largest structural mismatch in the current workbench logic.

Completed acceptance:

- masking flags behaves like `kernal:$2253`;
- adjacent marking behaves like `kernal:$219C` over the province graph;
- non-owner clearing behaves like `kernal:$21F0`;
- frontier selection scans in C64 descending province order like `kernal:$2207`;
- connected owned reachability does not cross enemy/Kingsmen land.

`c64-original` is now a registered AI mode. It uses the worklist for connected
multi-source attack selection and connected-owned movement. Headless smoke
matches for seeds `1`, `2`, `3`, `4`, `5`, `11`, `42`, and `99` reached
`game-over` through the public action API.

Hostile Kingsmen/Königstreuen attacks are now implemented as a world-system
phase on round wrap. Hostile smoke matches must produce
`royalist-battle-resolved` events and remain stable through the configured step
budget. They do not have to reach `game-over`: all-computer C64-shaped play can
enter a long stalemate that a human player would normally break.

Computer baron `$5800` economy is now wired into active `c64-original` as a
phase-level action. It covers debt/carryover underflow, frontier surplus
pressure, adjacent previous-hire pressure, recruitment into the home province,
the `L5BC6` village-buying loop, `$C9EE/$C9F2/$C9F6`, and final `L59C0`
money/carryover update. `fixtures/cbaron-ai-turn-capture-transcript.json`
adds the no-frontier continuation after a non-home capture: movement pulls all
mobile soldiers to one-garrison provinces, but economy still spends the base
recruitment budget into the home province before buying villages.

## Next Slice

Replace remaining heuristic parts in `c64-original` with annotated C64 branches.
The explicit compatibility state now exists for per-player AI memory and
per-province Kingsmen production buckets, `main:$5209` is wired into the active
world phase, and owner `0` is a first-class domain owner. The neutral
production-to-distribution owner-`0` chain is now compared against a C64-side
transcript fixture. The TypeScript headless transcript records compact
before/after snapshots for AI debugging. Focused hostile owner-`0`
home-castle capture through `kampf:L8461 -> main:L4C7A` and `main:L337A`
home-castle plus non-home attack-to-production/distribution ordering are now
fixture-backed. Natural end-of-round owner selection through `main:L3312` into
hostile home-castle victory and non-home return-to-player world passes is also
fixture-backed; the next blocker is broader owner-`0` and cbaron seed/map
transcript coverage. Cbaron no-battle, non-home capture, L5EA4
movement-memory, branching underpowered movement, defender-retreat, and
attacker-retreat phase chains now have targeted VICE transcripts compared in
TypeScript.

1. Capture broader owner-`0` transcript parity across more natural seed/map
   contexts.
2. Finish C64 setup byte/UI labels for the already active royalist toggles.

## Non-Goals For This Slice

- Do not fake Kingsmen behavior through a normal AI client.
- Do not change public multiplayer/API action contracts.
