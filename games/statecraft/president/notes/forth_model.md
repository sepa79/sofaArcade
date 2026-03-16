# President Forth model notes

## What CFA means

In Forth terminology, `CFA` means `Code Field Address`.

For a word in the dictionary, the rough structure is:

1. header / name
2. link to previous word
3. code field
4. parameter field

The code field decides what happens when the word is executed.

Important distinction:

- `CFA` is the address of the code field cell itself
- the two bytes stored at `CFA` are the machine-code entry address used by the runtime

Typical cases:

- primitive word:
  - the two-byte code field stored at `CFA` points at native machine code
- colon word (`: WORD ... ;`):
  - the code field points to a shared routine often called `DOCOL`
  - the parameter field then contains the threaded list of called words
- constant:
  - the code field points to a shared routine that pushes the constant value
  - the parameter field stores the value
- variable:
  - the code field points to a shared routine that pushes the address of the variable body

For this project, the practical consequence is:

- the threaded bytecode is very likely a sequence of `CFA` addresses
- to pseudo-decompile it, we need to classify each `CFA`:
  - native primitive
  - colon definition
  - constant
  - variable
  - user variable
  - `DOES>`-style created word

## Observed shared code routines

These are tentative names based on behaviour, not final truth.

- `0x452e` - `DOCOL?`
  - pushes the old `IP`
  - sets `IP = CFA + 2`
  - jumps back into the fetch loop
  - this strongly matches a colon-definition entry

- `0x454d` - `DOCON?`
  - reads a 16-bit value from `CFA + 2`
  - pushes that value on the data stack

- `0x455e` - `DOVAR?`
  - pushes the address `CFA + 2`
  - this fits a variable word

- `0x4570` - `DOUSER?`
  - reads an offset from `CFA + 2`
  - adds it to the user-area base in `FB/FC`
  - pushes the resulting address

- `0x458b` - `DODOES?`
  - pushes the old `IP`
  - loads a new `IP` from `CFA + 2`
  - also pushes `CFA + 4`
  - this looks like a `DOES>`-style created word

## Observed native primitives

These words were identified from dictionary-like headers in RAM:

- `LIT`
- `EXECUTE`
- `(OF)`
- `BRANCH`
- `0BRANCH`

The known primitive code addresses are:

- `LIT` - `CFA $4079`, code pointer `$407b`
- `EXECUTE` - `CFA $40c7`, code pointer `$40c9`
- `(OF)` - `CFA $40dd`, code pointer `$40df`
- `BRANCH` - `CFA $4111`, code pointer `$4113`
- `0BRANCH` - `CFA $4130`, code pointer `$4132`

## Medium-confidence primitive map

These names are inferred from behaviour and stack effects, not yet confirmed from dictionary headers.

- `CFA $439f` - `EXIT?`
  - pops saved `IP` from the CPU stack and resumes fetch

- `CFA $43aa` - `R@?`
  - still unresolved
  - it copies the current CPU-stack return cell deeper on page `$0100`
  - probably related to return-stack shuffling rather than a normal data-stack fetch

- `CFA $43c0` - `>R?`
  - moves the top data-stack cell onto the return stack

- `CFA $41bc` - `R@`
  - saves the current data-stack pointer
  - peeks the top return-stack cell from page `$0100`
  - pushes that cell onto the data stack without popping it

- `CFA $41cd` - `R>`
  - pops a return-stack cell back to the data stack

- `CFA $41a7` - `2>R?`
  - pushes two 16-bit cells from the data stack to the CPU-stack return stack
  - very likely a double-cell return-stack transfer

- `CFA $41ef` - `DIGIT?`
  - converts an ASCII-like character into a digit value using the current base on the stack
  - accepts `0..9` and then adjusts letters by subtracting `7`
  - returns both a converted digit and a success flag

- `CFA $4217` - `MATCH?`
  - walks two text-like pointers in lockstep
  - compares characters with case/bit folding
  - returns an updated pointer and a success flag on match
  - this looks like a dictionary/string matching helper, not gameplay logic

- `CFA $43da` - `0=?`
  - appears to turn a 16-bit value into a boolean flag using the `Y=0` convention

- `CFA $437d` - `SP@`
  - pushes the current data-stack pointer `X` as a 16-bit value

- `CFA $4386` - `SP0!`
  - reloads the data-stack pointer `X` from user area offset `+$06`
  - effectively resets the data stack to its startup/base position

- `CFA $4390` - `RP0!`
  - reloads the CPU stack pointer from user area offset `+$08`
  - effectively resets the return stack to its startup/base position

- `CFA $43f7` - `=`
  - currently decompiles as `-` followed by `0=?`

- `CFA $4400` - `+?`
  - adds the top two 16-bit stack cells

- `CFA $434d/$435d/$436d` - `AND / OR / XOR`
  - 16-bit logical operations across the top two stack cells

- `CFA $42c3` - `CMOVE`
  - copies a byte range from source to destination
  - internally marshals three cells into zero-page scratch and performs a byte loop

- `CFA $42e3` - `UM*`
  - 16-step shift/add multiply primitive
  - uses four stack bytes as a 32-bit working/result area
  - strongly matches unsigned 16x16 multiply

- `CFA $4316` - `U/MOD?`
  - 16-step shift/subtract divider
  - appears to produce quotient/remainder style results
  - exact stack order is not locked yet, but this is clearly the division family

- `CFA $4432` - `NEGATE?`
  - computes `0 - n`

- `CFA $4442` - `DNEGATE`
  - double-cell negate
  - subtracts two stacked 16-bit cells from zero with carry propagation

- `CFA $445c` - `DROP`
  - enters the common stack-drop tail at `$41b7`

- `CFA $4452` - `OVER`
  - duplicates the second 16-bit stack cell

- `CFA $445e` - `SWAP`
  - swaps the top two 16-bit stack cells

- `CFA $4473` - `DUP`
  - duplicates the top 16-bit stack cell

- `CFA $447d` - `NIP`
  - currently decompiles as `SWAP DROP`

- `CFA $4485` - `ROT`
  - rotates the top three 16-bit stack cells
  - machine code exactly matches `x1 x2 x3 -- x2 x3 x1`

- `CFA $44ac` - `0<?`
  - pushes `0` or `-1` depending on the sign bit of the top cell

- `CFA $44b8` - `+!?`
  - adds a 16-bit value into a 16-bit memory location and pops both operands

- `CFA $44d0` - `XOR!?`
  - byte-wise XOR-store through an address-like operand

- `CFA $44db` - `@+?`
  - reads a 16-bit value through the address on the stack while also advancing that address cell

- `CFA $44eb` - `C@`
  - replaces the top address with the fetched byte, zero-extended to 16 bits

- `CFA $44f6` - `!?`
  - stores a 16-bit value through the address on the stack

- `CFA $4509` - `C!`
  - stores one byte through the address on the stack and pops both operands

- `CFA $45e3` - `BL`
  - pushes the character code `$20`

- `CFA $461d` - `-`
  - decompiles as `NEGATE +`

- `CFA $4615` - `<`
  - decompiles as `-` followed by the sign-test primitive

- `CFA $4635` - `2DUP`
  - decompiles as `OVER OVER`

- `CFA $4bb0` - `>`
  - decompiles as `SWAP <`

- `CFA $4c2c` - `MIN`
  - decompiles as `2DUP > IF SWAP THEN DROP`

- `WORD_50fa` - probable `WITHIN?`
  - decompiles as a range check using two `>` tests, `OR`, and `0=?`

- `CFA $5355` - `1+`
  - increments the top 16-bit cell by one

- `CFA $5361` - `2+`
  - increments the top 16-bit cell by two

- `CFA $4151/$4177` - probable `LOOP / +LOOP`
  - both primitives operate directly on CPU-stack loop-control cells
  - `0x4151` increments an index and tests for loop completion
  - `0x4177` adds a dynamic increment and tests similarly
  - exact final names can wait, but they are clearly loop-control machinery

## Recovered pictured-numeric-output cluster

One especially satisfying subsystem now looks like standard Forth number formatting.

Recovered words:

- `0x4863` - `<#`
  - initializes the temporary output pointer in `USER(+$30)`
- `0x47e5` - `HOLD`
  - decrements the output pointer and stores one character
- `0x482d` - `#`
  - divides by the current base, converts one digit to ASCII, and `HOLD`s it
- `0x4853` - `#S`
  - repeats `#` until the remaining value becomes zero
- `0x47f7` - `SIGN`
  - emits `'-'` when the number is negative
- `0x481b` - `#>`
  - drops the working double-number state and returns `addr len`

This is not just "Forth-like style". It is a very recognizable Forth numeric formatting pipeline.

Two helpers support it:

- `0x47cf` - probable `UD/MOD`
  - used directly by `#`
- `0x4998` - `*`
  - decompiles as `UM* DROP`

## Screen-layout helpers

Another cluster now looks strongly tied to the C64 screen geometry:

- `0x45d9` - `320`
  - native constant pushing `$0140`
- `0x45ed` - `40`
  - native constant pushing `$0028`
- `0x48c3` - `/`
  - decompiles as `/MOD? NIP`

These appear together in words like `0x5064` and `0x5f79`, which recalculate:

- a working pointer in the `$2000` area,
- and the matching screen pointer in `$0400`,

using 40-column arithmetic and 320-byte row spacing.

That is the first clear bridge from the threaded VM into concrete screen-layout math on the C64.

- `CFA $45a9/$45b1/$45bb/$45c5/$45cf` - likely inline constants `0..4`

## Concrete evidence

- startup sets `IP = $403b`
- the first fetched token is the `CFA` `$4dac`
- bytes stored at `$4dac` are `2e 45`, which decode as little-endian `0x452e`
- that is exactly the shared `DOCOL?` routine above

So the startup token is already consistent with:

- token = `CFA`
- `CFA` contains the 16-bit code pointer used by the runtime
- `CFA + 2` is the parameter field for the word

## The missing dispatch link, now resolved

The fetch loop at `$4093` loads the current token into zero-page `$6e/$6f`.

At first glance, the dispatcher looked like:

- `$006d: JMP ($4400)`

That was misleading because `$006e/$006f` are part of the instruction stream itself.

What is really happening is:

- opcode byte at `$006d` is fixed: `6c`
- operand bytes at `$006e/$006f` are the live `W` register
- so the instruction is effectively `JMP ($006e)`

Since `$6e/$6f` hold the current token `CFA`, the VM dispatches by:

1. fetching a `CFA` into `W = $6e/$6f`
2. executing `JMP (W)`
3. which reads the 16-bit code pointer stored at that `CFA`
4. and jumps to the native primitive or shared routine

This removes the need for a separate dispatch table and is exactly the kind of compact threaded-interpreter trick you would expect on 6502.

## Current gap

The main remaining gap is no longer dispatch itself, but higher-level decoding:

- identify more primitive names,
- identify `EXIT` and other return-stack words with confidence,
- teach the walker how to decode `LIT`, branches, and `DOES>`-style bodies.
