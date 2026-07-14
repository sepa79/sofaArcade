# War for Crown C64 Active State Gap Audit

This document lists recovered C64 state, whether it is already modeled as
first-class TypeScript state, and which parts still need broader transcript
proof before `c64-original` can claim complete parity.

## Computer Baron State

| C64 field | Meaning | Current TS status | Required port work |
| --- | --- | --- | --- |
| `$C9EE/$C9F2/$C9F6 + player` | soldiers hired by each player during the current economy pass | `GameState.c64.playerMemory.hiredSoldiers` is wired by active `cbaron:$5800` port | keep transcript coverage as attack/movement become literal |
| `$CA65/$CA69/$CA6D + player` | cbaron economy carryover/principal used by `L5990/L59C0` | `GameState.c64.playerMemory.economyCarryoverMoney` is wired by active `cbaron:$5800` port | keep transcript coverage as full economy/action order stabilizes |
| `$C9DE + player` | remembered target/frontier province for later attack/movement planning | `GameState.c64.playerMemory.rememberedTargetProvinceId` is consumed and cleared by active `$5803`; active `$5806` writes the simple surplus target path, the phase-chain `L5EA4` two-candidate target path, and the post-defender-retreat target path; direct pure `L6C49` and `L6AC3` helpers return fixture-backed target writes; direct pure `L6DFA`, no-frontier post-capture, and branching underpowered phase-chain coverage write no remembered target | capture broader full-turn transcript coverage for uncovered movement-memory variants |
| `$C9E2/$C9E6/$C9EA + player` | remembered target strength paired with `$C9DE` | `GameState.c64.playerMemory.rememberedTargetSoldiers` is read by active `$5803`; active `$5806` writes the simple surplus remembered strength path, the phase-chain `L5EA4` two-candidate remembered strength path, and the post-defender-retreat remembered strength path; direct pure `L6C49` and `L6AC3` helpers return fixture-backed remembered target strength; direct pure `L6DFA`, no-frontier post-capture, and branching underpowered phase-chain coverage write no remembered strength | capture broader full-turn transcript coverage for uncovered movement-memory variants |
| `$CA61/$CA62` | overlapping C64 bytes used as cbaron remembered-target pressure scratch and, elsewhere, indexed event flags | `GameState.c64.ca61/ca62` exists; active `$5803` folds remembered-target quotient into it | preserve exact byte ownership when movement and event flags are both active |
| `$C832 + province` | phase-local map flags for source sets, target candidates, pruning, movement, cleanup | not stored directly; recomputed ad hoc | keep as local pure-function work arrays, not persistent state, unless a public transcript needs them |

Source audit note: `cbaron:L5990` writes `$C9EE/$C9F2/$C9F6 + activePlayer`
after recruiting into the home province. Later economy passes read neighbouring
owners' previous hires from those fields before choosing pressure recruitment.
`cbaron:L6560`, `L6B2E`, and `L6C49` read/write
`$C9DE/$C9E2/$C9E6/$C9EA + activePlayer` while selecting attacks and staging
movement. These fields are therefore not optional caches; they are C64 AI memory
and must exist before `c64-original` can claim parity.

Implementation implication: do not regress `cbaron:$5800/$5803/$5806` into
isolated stateless heuristics. Keep the explicit C64 compatibility state owner
as the SSOT for economy, attack, movement, and cleanup memory.

## Royalist State

| C64 field | Meaning | Current TS status | Required port work |
| --- | --- | --- | --- |
| owner/player `0` | Königstreuen/Kingsmen owner | `OwnerId` includes literal `ROYALIST_OWNER_ID = 0`; active in province, battle, event, view, royalist, and C64 helper state; royalist home-castle transfer is covered by `royalists.test.ts` against `fixtures/main-castle-capture-transfer.json`, the hostile `kampf:L8461` transfer fixture, focused `main:L337A` home-castle and non-home world-pass fixtures, and natural `main:L3312` owner-selection into hostile home-castle and non-home world-pass fixtures | capture broader owner-`0` seed/map transcript parity |
| `$C902 + province` | saved village-investment bucket for royalist production | `GameState.c64.royalistProvinceMemory.villageInvestmentBucket`; active in `main:$5209` port over owner-`0` provinces | capture transcript parity |
| `$C966 + province` | saved fortification-investment bucket for royalist production | `GameState.c64.royalistProvinceMemory.fortificationInvestmentBucket`; active in `main:$5209` port over owner-`0` provinces | capture transcript parity |
| `$C8A6` | hostile royalist source cooperation toggle | `GameConfig.royalistAttackCooperation` active | expose/skin with C64 setup labels when final options UI is cleaned up |
| `$C8A7` | hostile royalist threshold toggle | `GameConfig.royalistAttackThreshold` active | expose/skin with C64 setup labels when final options UI is cleaned up |
| `$C8A8` | royalist distribution mode | `royalistDistribution` exists and active world phase runs `$50D3` equal/border behavior over owner-`0` components | expose/skin as C64 option |

Source audit note: `main:L5209` depends on `$C902/$C966 + province` as saved
production buckets. `main:L50D3` and `kampf:L8461` treat owner/player `0` as the
same royalist actor via `$1624 == 0` and `$C5DA + province == 0`. The active
TypeScript model now preserves that owner identity directly.

## Public View State

`cbaron:L6808` needs the target owner's home province and province count for
home-castle scoring. These are public C64-visible facts, so `PlayerView` now
exposes `homeProvinceId` and `provinceCount` for opponent entries while keeping
opponent money private.

## Current Parity Boundary

The active `c64-original` path now uses recovered C64 combat setup, combat RNG
rounds, battle finish behavior, a phase-level `run-c64-baron-attack` reducer
action with literal `$6808/$69AD/$63CE/$674A` target scoring, per-target RNG byte
consumption, lower-id tie selection, and competing-frontier source pruning, a
phase-level `run-c64-battle-command` reducer action using state-derived C64 AI
side flags and defender-retreat legality, and a phase-level `$5806` movement
path with `L5E5D`, `L5FD2`, the phase-chain covered `L5EA4` selector and
remembered-target case, post-defender-retreat remembered-target writing, the
post-capture no-frontier pull-to-garrison branch, branching T-map underpowered
home/frontier deposit, `L6A64`, `L6AC3`, `L6C49`, and `L6DFA` helpers wired
through active state. `$5800` also covers the
fixture-backed no-frontier economy continuation: absence of adjacent foreign
provinces after movement still hires the base recruitment budget into the home
province before village purchases, and zero-money economy preserves movement
target memory.

The persistent fields above are also serialized into the shared VICE state
harness. Bounded runtime parity now compares them across the 17-round winning
seed, a 38-round regression, and three human-to-AI reaction scenarios. This
replaces the earlier requirement for an unbounded collection of hand-written
full-turn transcripts.

The remaining work in this audit is presentation of recovered setup labels.
Full-rules `$CA55/$CA56` state remains explicitly outside
`c64-original-simple`.
