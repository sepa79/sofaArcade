# War for Crown C64 Code Analysis Workflow

This document records the local workflow for inspecting C64 disk images as
reference material. The C64 code is not a source module for the SofaArcade game.
Use it to verify behavior, prompts, constants, and tables, then reimplement the
rules as typed pure TypeScript modules.

## Installed Tools

Expected WSL tools:

- `c1541` from VICE: list and extract files from `.d64` disk images,
- `petcat` from VICE: detokenize BASIC programs,
- `x64sc` from VICE: run/debug C64 images when dynamic behavior is needed,
- `da65` from cc65: disassemble 6502 machine code,
- `cbmconvert` and `cc1541`: additional Commodore disk utilities,
- `strings`, `xxd`, `hexdump`, `file`, `unzip`: generic inspection utilities.

## Local Reference Images

C64 reference files live outside the repo:

- `/mnt/c/Games/c64/WfC/*.D64`
- `/mnt/c/Games/c64/WfC/*.d64`
- `/mnt/c/Games/c64/WfC/*.vsf`
- `/mnt/c/Games/c64/WfC/*.zip`

Do not commit extracted binaries unless a later document explicitly justifies a
small derived fixture. Prefer `/tmp/wfc-c64-*` working directories for raw
extraction.

## Workflow

1. List candidate disk directories:

   ```bash
   c1541 /path/to/image.d64 -list
   ```

2. Extract files to a temporary directory:

   ```bash
   mkdir -p /tmp/wfc-c64-extract
   c1541 /path/to/image.d64 -extract
   ```

3. Classify extracted files:

   - first two bytes of a PRG are the little-endian load address,
   - BASIC programs often load at `$0801`,
   - machine-code payloads may load elsewhere or be packed.

4. Detokenize BASIC candidates:

   ```bash
   petcat -2 -o output.bas -- input.prg
   ```

5. Disassemble machine-code candidates:

   ```bash
   da65 --start-addr '$0801' input.prg > output.s
   ```

6. If a PRG is packed/crunched, run it in `x64sc`, stop after depacking, and dump
   memory from the VICE monitor for static analysis.

## Questions To Answer From C64 Evidence

- exact C64 turn-step order and prompts,
- event and weather behavior,
- weather-to-income modifiers,
- soldier, village, and fortification costs,
- fortification names and battle modifiers,
- movement reachability,
- original AI priorities.

Record findings in docs before changing gameplay code.
