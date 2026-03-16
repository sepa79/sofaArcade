# Startup subsystem notes

This note collects the first coherent subsystem recovered from the startup path.

It is still partial, but it is no longer "random words". The pieces already fit together.

## High-level shape

The startup chain currently looks like:

- `WORD_4dac`
  - early bootstrap logic
  - sets up pointers / variables
  - eventually calls:
    - `WORD_54f5`
    - `WORD_4d76`

From there, a recurring cluster shows up:

- `WORD_4d00`
- `WORD_4c92`
- `WORD_4aca`
- `WORD_5064`
- `WORD_5014`
- `WORD_60b5`

This cluster appears to mix:

- initial screen/setup,
- input scanning / parser logic,
- pointer housekeeping,
- UI wait-loop behaviour.

One useful runtime-level detail is now clear in this cluster:

- `PRIM_4386` is no longer a mystery blob
- it reloads the data-stack pointer from user area offset `+$06`
- so every call site is effectively a "reset the Forth data stack before continuing" barrier

Likewise:

- `PRIM_4390` reloads the CPU stack pointer from user area offset `+$08`
- so it resets the return stack / control stack

## Confirmed or strong helper identities

- `WORD_46f9`

```forth
: WORD_46f9
  LIT $4000
  +
  EXIT?
;
```

Looks like a fixed-base address adjuster.

- `WORD_48fd`

```forth
: WORD_48fd
  LIT $000a
  USER_46b5(+$0026)
  !
  EXIT?
;
```

Sets a user-area value at offset `$26` to `10`.

- `WORD_4cea`

```forth
: WORD_4cea
  0
  USER_46b1(+$0024)
  !
  EXIT?
;
```

Clears a user-area flag/counter at offset `$24`.

- `WORD_4635 = 2DUP`
- `WORD_4bb0 = >`
- `WORD_4c2c = MIN`

These three make a lot of later listings much easier to read.

## Input/wait loop candidate

`WORD_4d00` is the first clearly loop-shaped word:

```forth
: WORD_4d00
  0 USER(+$16) !
  WORD_4cea
loop:
  PRIM_4390
  WORD_5064
  WORD_4cd6
  WORD_4c92
  USER(+$24) @+?
  0=?
  0BRANCH done
  WORD_47af
  ...
  BRANCH loop
done:
  EXIT?
;
```

Interpretation:

- initialize a couple of user-area fields,
- run several helper/update words,
- poll `USER(+$24)`,
- loop until it becomes non-zero.

That strongly suggests some kind of wait-for-selection / wait-for-input screen loop.

The stack-reset words make this even easier to read:

- `PRIM_4390` sits at the top of the loop body
- so each iteration begins by restoring a clean return-stack baseline before entering the next UI/update pass

## Parser/scanner candidate

`WORD_4aca` looks like character scanning logic:

```forth
: WORD_4aca
  ...
loop:
  DUP
  1+
  C@
  LIT $002d
  =
  DUP
  >R?
  +
  ...
  DUP
  C@
  ...
  -
  0BRANCH ...
  DUP
  C@
  LIT $002e
  -
  ...
  BRANCH loop
;
```

Two important observations:

- it walks byte-by-byte using `1+` and `C@`
- it compares against `$2d` and `$2e`, which are `'-'` and `'.'`

So this is almost certainly not economy logic. It is much more likely parser / scanner / text-format handling.

Two extra clues now strengthen that interpretation:

- `PRIM_45e3` is very likely `BL`, the space character (`$20`)
- `WORD_50fa` is very likely a `WITHIN?`-style range test

That means the parser/UI cluster is not just walking bytes, but already doing normal character-class style work:

- compare to punctuation (`'-'`, `'.'`)
- compare to space
- compare to `A..Z`

Another newly identified primitive supports this directly:

- `PRIM_41ef` is a probable `DIGIT?`
- it converts `0..9` and alphabetic digits against a supplied base

So this area of the game is not just scanning text. It is doing true token/number parsing inside the threaded VM.

## Screen/VIC setup candidate

`WORD_60b5` is a clean hardware-facing word:

```forth
: WORD_60b5
  LIT $d011 C@
  LIT $0020 OR
  LIT $d011 C!
  LIT $d018 C@
  LIT $0008 OR
  LIT $d018 C!
  EXIT?
;
```

This is unmistakably VIC-II setup.

Whatever exact mode it enables, it is clearly:

- reading current VIC register values,
- OR-ing in bit masks,
- writing them back.

This makes `WORD_60b5` a good anchor for "system init vs gameplay logic".

## Range-check helper

`WORD_50fa` now decompiles as:

```forth
: WORD_50fa
  >R?
  OVER
  >
  SWAP
  R>?
  >
  OR
  0=?
  EXIT?
;
```

This strongly suggests an inclusive range test of the form:

- "not below lower bound"
- "not above upper bound"
- combine the two

Its use inside `WORD_5469` with:

- `LIT $0041`
- `LIT $005a`

means it is very likely being used as an `A..Z` uppercase check on a character.

## Pointer/working-buffer setup

`WORD_4ffc` and `WORD_5014` look like working-pointer initialization:

```forth
: WORD_4ffc
  LIT $2000 VAR_4ff4 !
  CONST_4ff0($0400) VAR_4ff8 !
  0 USER(+$1a) !
  EXIT?
;
```

```forth
: WORD_5014
  WORD_4ffc
  CONST_4ff0($0400)
  LIT $03e8
  LIT $4026 @+?
  WORD_4643
  LIT $2000
  LIT $1f40
  0
  WORD_4643
  EXIT?
;
```

This strongly suggests:

- one pointer is initialized to screen-ish/working RAM around `$2000`
- another to `$0400`
- then some copying/filling/setup helper runs over those ranges

The geometry helpers are now clearer:

- native constant `320` at `0x45d9`
- native constant `40` at `0x45ed`
- `WORD_48c3` behaving as `/`

That makes `WORD_5064` readable as row/column pointer normalization:

- convert a `$2000`-relative pointer through `320`-byte row math
- convert a `$0400`-relative pointer through `40`-column screen math
- store the normalized pointers back into `VAR_4ff4` and `VAR_4ff8`

That makes the surrounding text API much easier to read:

- `WORD_48db` behaves like `TYPE`
- `WORD_513a` behaves like `SPACES`
- `WORD_5064` behaves like `CR`
- `WORD_5a48` is effectively `CR CR`
- `WORD_5f79` looks like an `AT-XY` cursor-position helper

So the startup/title path no longer reads like arbitrary threaded code.
It reads like a small text UI toolkit layered on top of the VM.

`WORD_4643` is not fully named yet, but its structure suggests a counted byte operation built on `C!` and the copy primitive at `$42c3`.

## DOES>-string objects

String-like objects now decode cleanly.

Examples:

- `CFA $78d7`
  - text: `PRESIDENT`
- `CFA $78e5`
  - text: `COPYRIGHT 1987 ADDICTIVE GAMES LTD.`
- `CFA $6b00`
  - text: `STRAIGHT ROAD `

Observed structure:

- `CFA`
- code pointer = probable `DODOES`
- shared param hook = `$6afb`
- local bytes:
  - local hook bytes `fb 6a`
  - length
  - text bytes

This means text resources are first-class executable objects in the runtime model.

That is exactly the sort of weird and wonderful implementation detail worth surfacing in a Museum Mode.
