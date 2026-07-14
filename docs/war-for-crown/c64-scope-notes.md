# War for Crown C64 Scope Notes

This document records current C64-target assumptions for War for Crown. It
overrides broader manual-derived notes when deciding what to implement next.

## Source Position

The local manual file is useful, but it is not treated as a C64-only source:

- `/mnt/c/Games/c64/WfC/Krieg_um_die_Krone_2_Manual.txt`

The manual itself says some described functions do not exist on Commodore 64
because of memory limits, and those differences are not always enumerated.

## C64 Target Flow

Working C64 turn flow, based on project owner memory:

1. possible event,
2. weather,
3. village income modified by weather,
4. attack,
5. movement,
6. investment menu:
   - build,
   - hire soldiers,
   - next turn.

Confidence: high enough for current implementation direction, but still worth
checking against the C64 binary or saved-state behavior when convenient.

## C64 Map Shape Constraints

User-provided C64 map screenshots show that generated maps are water-heavy.
The map should not be normalized into a fully occupied province grid.

Target map shape:

- large water frame around the landmass,
- water bays and holes inside the landmass,
- irregular province growth from starting/home spots,
- preview flow that lets the player reject the generated continent,
- visible generated continent shape before player setup is accepted.

Owner reverse-engineering notes indicate a 20-by-12 flat map buffer:

- `$C400` as the map array base,
- `$F0` total cells,
- direction offsets `+1`, `-1`, `+$14`, `-$14`.

When porting the generator, preserve this water-heavy feel first. Do not make
the generator maximize land coverage or guarantee compact rectangular areas.

Map-generation parameters are chosen in the new-game map preview panel, not in
the rules screen. Examples: seed, province/tile count, water ratio, and later
shape/roughness controls.

Current TypeScript defaults for the first water-heavy generator slice:

- width: 20,
- height: 12,
- provinces: 16,

RNG note from the ASS/GDG `kernal` module: the shared random routine at `$218B`
does not read SID noise `$D41B` in the inspected modules. It reads VIC-II raster
line `$D012`, adds a byte from `$E000 + counter`, adds the previous state byte
at `$219B`, stores the new state back to `$219B`, and increments the low byte of
the `$E000` operand at `$218F`.

Decoded routine:

```asm
$218B  LDA $D012
$218E  ADC $E000   ; low byte is incremented by INC $218F
$2191  ADC $219B
$2194  STA $219B
$2197  INC $218F
$219A  RTS
$219B  .byte $00   ; RNG state
```

This is not seed-only deterministic because `$D012` depends on call timing. An
exact C64 map match therefore needs either a captured/emulated raster sequence
for the generation path or a golden `$C400-$C4EF` dump to compare against. A
modern seeded preview can still use the same map-growth algorithm with an
explicit deterministic RNG source.

Self-modifying opcode note for the generator pass: 6502 `DEC` and `INC`
opcodes differ by bit `$20` in the relevant addressing modes:

- `DEC abs` = `$CE`, `INC abs` = `$EE`,
- `DEC zp` = `$C6`, `INC zp` = `$E6`,
- `DEC abs,X` = `$DE`, `INC abs,X` = `$FE`.

Therefore `ORA #$20` applied to an opcode byte changes `DEC` into `INC`.
Changing `INC` back into `DEC` requires clearing that bit, for example
`AND #$DF`, or toggling with `EOR #$20` if both directions are intentional.

## Out Of C64 Scope For Now

Do not implement these from the broad manual unless C64 evidence is found later:

- supply goods / `Versorgungsgueter`,
- catapults,
- delayed recruit training queues,
- variable troop composition,
- PC "king returns" stalemate intervention; likely a useful optional
  anti-stalemate valve for a later PC/extended ruleset, but not part of the C64
  compatibility baseline without C64 code or transcript evidence. Current C64
  evidence only proves the normal royalist victory ending when owner `0` wins,
- PC/Amiga-style detailed supply/event subsystems.

Random event and weather remain in scope as C64-like concepts, but they should
be implemented as simple explicit turn-step rules, not as the broader manual's
full event/supply system.

## C64 Code Usefulness

C64 code can help most with verification and constants:

- exact phase order and prompts,
- weather names and income modifiers,
- village and hiring costs,
- fortification levels/costs,
- battle tables and terrain modifiers,
- movement reachability rules,
- AI heuristics used by the original computer player.

C64 code should not be ported directly. Treat it as a reference to extract
tables and behavior, then reimplement typed pure modules in `src/game`.

The first dedicated computer-player pass is recorded in
`c64-ai-analysis.md`. Its outcome is stricter than "C64-like": final computer
baron behavior and Königstreuen/Kingsmen behavior must be copied from the C64
code. The current playable AI remains a workbench/smoke-test mode until parity
is proven.

## Initial Disk Findings

Local tooling confirmed these utilities are available in WSL:

- `c1541`, `petcat`, `x64sc`,
- `da65`, `ca65`, `cc65`,
- `acme`, `dasm`, `cbmconvert`, `cc1541`.

Initial directory/string inspection shows at least two relevant C64 variants:

- `Die_Erben_des_Throns_-_Krieg_um_die_Krone_II_(ASS).d64`
  - contains compact modules such as `main`, `menues`, `kampf`, `zufall`,
    `kernal`,
  - menu strings include soldiers, villages, fortification, save money, random
    events, terrain/income/battle toggles,
  - quick string scan did not show supply goods, catapult purchase, or variable
    troop-composition menus.
- `ERBENT1A.D64`
  - contains extra modules such as `cbaron`, `menue`, `code`,
  - strings include `VERSORGUNGSGUETER`, `KATAPULTE`, weather, and variable
    troop-composition menus.

The selected compatibility baseline is `ERBENT1A.D64`, pinned by SHA-256 in
`c64-baseline-manifest.json`. `KRIEGUDK.D64` remains documented as a separate
1989 BASIC/legacy branch and must not be mixed into `c64-original-simple`.
