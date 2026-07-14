# War for Crown AI Strategy Interface v0

This document defines the AI integration boundary for War for Crown. It extends
`c64-ai-analysis.md` and `headless-simulation-v0.md`.

If this document conflicts with `AGENTS.md`, `AGENTS.md` wins.

## Boundary

An AI strategy consumes only:

- the active player's `PlayerView`,
- the active `GameConfig`.

It returns exactly one public `WarForCrownAction`.

An AI strategy must not read or mutate full `GameState`. The game API remains
the validator for legality. Invalid AI output must fail through the same action
path as invalid human or remote-player output.

## Modes

The first named modes are:

- `c64-workbench`: current playable reconstruction workbench. It follows the
  recovered C64 `cbaron` structure with separate home selection, attack,
  movement, and investment decisions, but it is not a C64 behavior copy.
- `deterministic-debug`: transparent smoke-test AI. It remains available for
  simple deterministic tests and debugging.
- `c64-original`: default active compatibility-target AI. It uses the recovered
  C64 province worklist/reachability behavior for baron attack and movement,
  and is the only mode allowed to move toward final C64 parity.

Later modes can include stronger scripted AI or an LLM-backed adapter, but they
must use the same `PlayerView -> WarForCrownAction` contract.

## Player Assignment

AI mode assignment is per computer-controlled player slot.

The game rules engine must not store or infer AI behavior. AI is a client of the
public action API:

- Phaser scene setup stores the selected mode for each AI player row.
- Headless simulation stores the selected behavior by passing one
  `SimulationClient` per `PlayerId`.
- The active AI mode is resolved only when the client is asked for a
  `WarForCrownAction`.

Default computer players use `c64-original`. The setup UI may expose
`c64-workbench` as the current "our AI" comparison mode, but it must not become
the default compatibility path.

`deterministic-debug` remains test-only and is not a normal player-facing setup
choice.

## Difficulty

Difficulty is a property of non-C64 strategy modes, not of `c64-original`.

Target shape:

- `c64-original`: compatibility mode, no difficulty tuning.
- "Our AI" modes: later scripted variants such as easy/normal/hard can share the
  same `PlayerView -> WarForCrownAction` interface.
- LLM-backed adapters: later clients can plug into the same boundary without
  changing game rules or action validation.

## C64 Workbench Scope

`c64-workbench` is implemented as a playable baseline for API and UI testing.
It is not accepted as final gameplay AI. Its purpose is to keep matches
playable while C64 routines are annotated.

Known behavior to preserve now:

- selected attack source provinces commit all mobile soldiers and leave one
  garrison each,
- attack decisions are target-first and can use multiple adjacent source
  provinces,
- movement pushes mobile soldiers toward selected frontier provinces instead of
  keeping a reserve pool,
- recruitment spends money and adds soldiers directly to the home province,
- economy prefers military pressure first, then village growth, then useful
  fortification.

Unknown C64 constants must remain named and localized in the AI module until the
remaining `cbaron` scoring routines are annotated. `c64-original` is now the
compatibility target, while `c64-workbench` remains available for comparison and
debugging.

## C64 Original Scope

`c64-original` currently provides:

- public `PlayerView -> WarForCrownAction` strategy integration;
- C64-style connected-source attack selection using the `$C832` worklist shape;
- C64-style connected-owned movement toward frontiers;
- headless public-API smoke coverage to game over.

Still required before calling it complete C64 parity:

- exact `$5800` economy constants and branches;
- exact `$5803` attack thresholds and target ordering;
- exact `$5806/$6A64` movement/cleanup edge cases;
- Kingsmen world-system phase.

## Kingsmen / Royalists

Königstreuen / Kingsmen / royalists are not the same system as computer barons.
They are owner `0` world-system forces governed by the C64 royalist setup
options. Their behavior must be implemented from the recovered C64 routines
instead of being routed through the player AI client interface.
