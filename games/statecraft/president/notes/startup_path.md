# President startup path notes

## Snapshot used

- `president_codex_package/snapshots/president.vsf`

## BASIC and loader entry

- BASIC stub at `$0801` contains `SYS 2064`, so the machine-code entry is `$0810`.
- The loader at `$0810` starts with:
  - `SEI`
  - `LDA #$34`
  - `STA $01`
- It copies six bytes from `$0842..$0847` into zero page `$2d..$32`.
- It then copies data through `($31),Y` into `$7800,Y` in a page loop, indicating a small unpack/relocation stage.
- After that it copies a second-stage stub from `$0848..` to `$0100..` and jumps to `$0100`.

## Second-stage stub

- The copied stub at `$0100` decodes packed data using helper code at `$0122`.
- When the decode stage finishes, execution reaches:
  - `$0196: BIT $01da`
  - `$0199: LDA #$37`
  - `$019b: STA $01`
  - `$019d: CLI`
  - `$019e: JSR $4000`
- If `$4000` ever returns, control goes to `$a7ae`.

## Runtime entry at `$4000`

- `$4000` is just `NOP / JMP $403d`.
- `$403d` performs runtime setup:
  - `CLD`
  - `LDA #$36`
  - `STA $01`
  - `JSR $ff8a`
  - `FB/FC <- [$4010/$4011] = $1800`
  - `X <- [$4012] = $68`
  - `IP ($6a/$6b) <- $403b`
- It then jumps to `$4093`.

## Forth-like fetch/dispatch loop

- `$4093` fetches a 16-bit token from `IP` into `$6e/$6f`, advances `IP`, then jumps to `$006d`.
- `$006d` is `JMP ($4400)`.
- The bytes at `$4400/$4401` are not a normal table entry; they are the operand bytes of `JSR $4402` located at `$43ff`.
- That means the interpreter uses a self-modifying dispatch cell:
  - the operand of `JSR $4402` doubles as the indirect vector used by `JMP ($4400)`.
- This strongly supports a threaded/Forth-like VM rather than straight-line 6502 gameplay code.

## Initial threaded token

- With `IP = $403b`, the first fetched token is the `CFA` `$4dac`.
- The two bytes stored at `$4dac` are `$452e`, which matches the shared `DOCOL?` runtime routine.
- So the startup word already looks like a normal Forth-style word with:
  - `CFA = $4dac`
  - code pointer = `$452e`
  - parameter field starting at `$4dae`

## Immediate next questions

- Find where the dispatch cell at `$43ff/$4400` is rewritten from the fetched token in `$6e/$6f`.
- Identify the equivalent of `DOCOL` / `EXIT`.
- Extend the dictionary extractor beyond the first confirmed words:
  - `LIT`
  - `EXECUTE`
  - `(OF)`
  - `BRANCH`
  - `0BRANCH`
