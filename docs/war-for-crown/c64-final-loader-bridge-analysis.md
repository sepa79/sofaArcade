# War for Crown C64 Final Loader Bridge Analysis

## Status

The final result bridge is recovered and fixture-backed.

Recovered and fixture-backed:

- `main:L3384` writes `$CA75 = 3` for a human continent winner and `$CA75 = 1`
  for an AI continent winner.
- `main:L339B` writes `$CA75 = 2` for a royalist continent winner.
- `main:L36ED` writes `$CA75 = 4` for abort/exit.
- `code:L5960` starts with `JSR code:L5305`, which reaches `code:L5297`.
- `code:L5297` swaps `$C980..$CA7F` with `$4D00..$4DFF`, moving `$CA75` to
  `$4DF5`.
- `code:L5960` reads `$4DF5` and maps values `1..3` to `TXTWIN1..TXTWIN3`;
  value `4` skips the `TXTWIN` load path.

## Correct Boot Addresses

The `boot` PRG load address is `$9A98`. The executable boot entry observed in
the loader flow is `$9B20`, not the file load address itself.

Recovered boot control flow:

| Address | Behavior |
| --- | --- |
| `boot:$9B20` | startup entry; clears `$CA75`, loads the first modules, enters title/setup flow |
| `boot:$9BAC` | calls `JSR $3000` into the loaded `main` game loop |
| `boot:$9BAF` | resumes after the `main` final path unwinds with `PLA/PLA/RTS` |
| `boot:$9BBC..$9BDE` | loads `GRAPH2`, `GRAPH+`, `KAMPF`, `CBARON`, and `SPRITE` |
| `boot:$9BE2` | calls `JSR $3000` into the loaded `SPRITE` module |
| `boot:$9BE5` | jumps back to `boot:$9B7D`, reloading `CODE` and entering `code:$5000 -> code:L5960` |

## Corrected Interpretation Of `$1D50`

Earlier notes described `main:L33A0` as patching `$1D50..$1D52` into a jump to a
`$B100` final-screen path. That is not accurate.

`kernal:L1D50` is the low-level text-stream reader:

```asm
L1D50:  ldy #$00
        lda ($4C),y
        inc $4C
        bne L1D5A
        inc $4D
L1D5A:  rts
```

`main:L3063` temporarily patches `$1D50..$1D52` to `JMP $32FD` during main
startup. `main:L33A0` restores the first three bytes to `A0 00 B1`, which is
the original `LDY #$00; LDA ($4C),Y` prefix of the stream reader. It is not a
final loader jump.

## `$4DF5` Is A Main-Overlay Byte

The `code` module loads at `$5000`, but `code:L5960` reads `$4DF5`. That address
belongs to the lower part of the previously loaded `main` overlay. In the static
`main` file, `$4DF5` is the operand byte inside the loop at `main:L4DF2`, not a
plain variable:

```asm
L4DF2:  sta ($42),y
        dey
        bpl L4DF2
```

Therefore a real final path must overwrite or otherwise provide the byte at
`$4DF5` before `code:L5960` uses it.

Dynamic state at the `main` final unwind proves `$4DF5` has not yet been
bridged there. When execution reaches `main:L33A0`, `$CA75 = 3`, but
`$4DF0..$4DF8` still contains the static `main` loop bytes:

```text
A0 02 91 42 88 10 FB AE 24
```

So `$4DF5` is still `$10`, the `BPL` opcode operand from `main:L4DF2`.

## Recovered Bridge: `code:L5297` Page Swap

`code:L5960` begins with:

```asm
L5960:  jsr L5305
        lda $4DF5
```

`code:L5305` calls `code:L5030` and then jumps to `code:L5297`. The important
part of `code:L5297` is the page swap near `code:L52BB`:

```asm
        lda $C980,y
        pha
        lda $4D00,y
        sta $C980,y
        pla
        sta $4D00,y
```

The loop runs for a full page, so `$C980..$CA7F` is exchanged with
`$4D00..$4DFF`. The final result byte has offset `$F5` in that source page:

```text
$CA75 - $C980 = $F5
$4D00 + $F5 = $4DF5
```

So the bridge is not a direct `STA $4DF5`; it is the memory-window swap that
runs immediately before the final-screen selector reads `$4DF5`.

Fixture:

```text
docs/war-for-crown/fixtures/code-l5297-final-result-swap.mon
docs/war-for-crown/fixtures/code-l5297-final-result-swap.json
```

The fixture sets `$CA75 = 03` and `$4DF5 = EE`, runs `code:L5297`, and observes:

```text
$CA75 = EE
$4DF5 = 03
```

## Static Search Result

No extracted `ERBENT1A` module currently contains a direct
`LDA $CA75; STA $4DF5` sequence. Direct byte searches across all extracted PRGs,
including `KUDK.INT`, found:

- `$CA75` references in `boot` only for startup clearing and in `main` for final
  result writes;
- `$4DF5` references only in `code:L5960`.

This explains why direct-byte searches did not find the bridge: it is a page
swap, not a direct result-byte store.

## `boot:L9C84` Is Save, Not The Bridge

`boot:L9C84` / `boot:L9CAF` is the KERNAL `SAVE` path, not the final-result
bridge. It passes start `$C400` and end `$CA76` into `$FFD8`, so `$CA76` is the
exclusive end address of the saved game-state block. It is not a one-byte
successor or helper for `$CA75`.

## `SPRITE` Runtime Probe

Two VICE probes were run with `$CA75 = 3` and a store-watch on `$4DF5`:

1. `GRAPH2 + SPRITE`;
2. `GRAPH2 + GRAPH+ + KAMPF + CBARON + SPRITE`.

Neither probe writes `$4DF5` during immediate setup before the cycle limit.
This is now consistent with the recovered bridge: `SPRITE` is not responsible
for the result-byte transfer.

## Dynamic Trace Notes

Trace script: `fixtures/full-disk-final-bridge-trace.mon`.

Useful environment change:

- copied VICE drive ROMs from
  `/mnt/c/Games/c64/GTK3VICE-3.8-win64/DRIVES/` to
  `~/.local/share/vice/DRIVES/`;
- VICE now loads 1541/1571/1581 drive ROMs instead of reporting them missing.

Historical trace blocker:

- starting `boot` at `$9B20` reaches the boot file loader;
- the first loader call reaches `boot:L9BF7`, `boot:L9C0D`, and C64 KERNAL
  `LOAD` at `$FFD5`;
- the wildcard loader path has not yet reached `code:$5000` in the automated
  monitor run.

The native VICE monitor must be run with a PTY in this WSL/Codex environment.
Without a TTY the monitor opens the command file but does not execute it.

The full disk trace is no longer required to identify the bridge. The static
and fixture-backed path is:

```text
main:L33A0 -> boot:$9BAF -> boot:$9BE2 -> SPRITE return -> boot:$9BE5 -> code:L5960 -> code:L5305 -> code:L5297 -> $CA75 at $4DF5
```
