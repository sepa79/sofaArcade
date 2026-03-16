# Museum Mode notes

This file is a narrative summary of the archaeology work so far.

It is meant to answer a different question than the raw reverse-engineering notes:

`What would be fun and understandable to show a curious player or retro nerd?`

## 1. President is not a plain 6502 monolith

The BASIC stub is ordinary enough:

- load program
- `SYS 2064`
- jump into machine code at `$0810`

But the code at `$0810` is only a bootstrap.

What it really does is:

- unpack / relocate data,
- copy a second-stage stub to `$0100`,
- initialize the runtime,
- jump into a tiny virtual machine.

That VM then runs the game logic as threaded words, very much like a compact Forth system.

## 2. The VM is delightfully sneaky

The core fetch loop loads the current token into zero-page `$6e/$6f`.

Those two bytes are not just a register. They are also the operand bytes of a live instruction:

- opcode at `$006d` = `6c`
- so the machine executes `JMP ($006e)`

That means the current token is used directly as an indirect pointer.

In practical terms:

1. fetch a `CFA` token,
2. store it in `$6e/$6f`,
3. execute `JMP ($006e)`,
4. read the two-byte code pointer stored at that `CFA`,
5. jump to the primitive or shared runtime routine.

This is tiny, fast, and very 8-bit-brain in the best possible way.

Another nice detail: some shared primitives first marshal their arguments into scratch cells in zero page, then run a tight native loop there.

For example, the primitive now identified as `CMOVE` uses a small helper at `$40ac` to copy several stack cells into a zero-page work area before doing the byte copy itself.

So even inside the VM, there is a second layer of hand-tuned "micro-runtime" behaviour.

## 3. What a token means

The VM does not primarily step through native code addresses.

It steps through `CFA` addresses.

A Forth-like word here looks roughly like:

- name/header
- link to previous word
- `CFA` cell
- parameter field

Examples:

- `LIT` has `CFA $4079`, code pointer `$407b`
- `EXECUTE` has `CFA $40c7`, code pointer `$40c9`
- `BRANCH` has `CFA $4111`, code pointer `$4113`
- `0BRANCH` has `CFA $4130`, code pointer `$4132`

So a threaded stream contains `4079`, `4111`, `4dac`, `54f5`, not raw 6502 entry points.

## 4. Shared word classes already identified

Several shared code routines are now visible:

- `DOCOL` at `$452e`
- `DOCON` at `$454d`
- `DOVAR` at `$455e`
- `DOUSER` at `$4570`
- probable `DODOES` at `$458b`

That means the runtime already has a pretty mature Forth-like object model:

- colon definitions
- constants
- variables
- user variables
- `DOES>`-style created objects

## 5. The game stores text as executable objects

One of the nicest discoveries is that many strings are not plain dumb byte arrays.

They appear as `DOES>`-style objects.

Pattern seen in RAM:

- `8b 45` = code pointer to probable `DODOES`
- `fb 6a` = parameter pointer / behaviour hook
- then a length byte
- then the text bytes

Examples around `$6b00` and `$78d7` include:

- `STRAIGHT ROAD`
- `PRODUCTION RIG`
- `PRESS PLAY THEN ANY KEY`
- `PRESIDENT`
- `COPYRIGHT 1987 ADDICTIVE GAMES LTD.`

So even user-facing text is wrapped in a Forth-like object mechanism, not just dumped as C-style strings.

That is exactly the kind of detail worth surfacing in a Museum Mode.

## 5a. Character handling is already visible

One recovered helper, `WORD_50fa`, decompiles to:

```forth
>R? OVER > SWAP R>? > OR 0=?
```

That shape strongly suggests a range check.

The especially nice part is where it is used:

- lower bound `$41`
- upper bound `$5a`

which are ASCII `A` and `Z`.

Immediately after that check, the code conditionally subtracts `$40`.

So even without the whole game fully decompiled, we can already point to a concrete recovered behaviour:

- the original VM logic checks whether a character is uppercase alphabetic,
- then normalizes it into a compact index-like value.

## 6. A first subsystem is becoming visible

The startup path now decompiles into a small call tree.

One branch leads into words around:

- `$4d00`
- `$4c92`
- `$4aca`
- `$5064`
- `$54f5`

This cluster appears to mix:

- input / parser helpers,
- small UI flow control,
- setup of working pointers and counters,
- some screen/VIC-side initialization.

Concrete examples already visible:

- `WORD_48fd` sets `USER(+$26) = 10`
- `WORD_4cea` clears `USER(+$24)`
- `WORD_4d00` loops until `USER(+$24)` changes
- `WORD_60b5` ORs masks into `$d011` and `$d018`, so it is touching VIC-II setup
- `WORD_4aca` walks characters using `1+`, `C@`, comparisons against `$2d` and `$2e`, and a loop

That last one strongly suggests parser / scanner behaviour rather than economy or map simulation.

## 6a. The game has a real Forth-style number-to-text pipeline

Another subsystem is now visible almost as a textbook pattern:

- `<#`
- `#`
- `#S`
- `SIGN`
- `HOLD`
- `#>`

These are classic Forth pictured-numeric-output words for formatting numbers into text.

Recovered behaviour:

- `<#` initializes a scratch output pointer
- `#` divides by the current base and emits one digit
- `#S` repeats until the value becomes zero
- `SIGN` prepends `'-'` when needed
- `#>` returns the final `addr len`

This is a great Museum Mode beat because it shows the original game was not just "using some interpreter".
It was using recognizably Forth-ish high-level idioms for real game UI work like score or resource display.

## 6b. It also has a tiny text UI vocabulary

The startup/title path is beginning to read like a miniature terminal API:

- `TYPE`
- `SPACES`
- `CR`
- `AT-XY`

These names are still partly tentative, but the behaviour is already strong:

- `TYPE` iterates `addr len` and feeds characters into a display primitive
- `SPACES` emits padding
- `CR` moves the working pointers to the next 40-column row
- `AT-XY` computes matching pointers in `$2000` and `$0400`

That is another excellent Museum Mode hook:

"This game was not just code. It carried its own little language for screen layout."

## 6c. Whole screens live as threaded scripts in high memory

Another important discovery: some of the most interesting game-facing flows are not sitting in the obvious low-memory dictionary area.

There are raw `DOCOL` CFA cells much higher in RAM that act like screen scripts.

Recovered examples now include:

- `IMPORTS`
- `BALANCE OF PAYMENTS`
- `OPINION POLLS`
- `HEALTH`
- `FOOD`
- gold-market buy/sell prompts and stock/price panels
- `INCOME / EXPENDITURE` report
- oil-contract and spot-market screens
- map-navigation command loop

That is a strong Museum Mode moment because you can show:

- the visible screen title,
- the recovered threaded script that renders it,
- the variables feeding that script,
- and the tiny UI vocabulary used to lay it out.

## 6d. Late-game drama is also scripted in the VM

The same threaded approach is not limited to menus and report screens.
It also drives several of the game's "big dramatic beats":

- election countdown and election result screens
- final score / dynasty summary
- bankruptcy versus currency devaluation
- earthquake event notifications
- full new-game reset

That is important because it means the archaeology can show more than isolated UI fragments.
It can show game structure:

- a month advances,
- counters roll over,
- an election may trigger,
- disasters may fire,
- the run may end,
- and a fresh game reinitializes several state subsystems in order.

For Museum Mode, that gives a very nice presentation arc:

1. show the VM and token model,
2. show a recovered screen script,
3. show the variables that feed it,
4. then show one complete gameplay loop ending in score, bankruptcy, or catastrophe.

## 6e. The whole month loop is becoming legible

One especially satisfying threshold has now been crossed:
the game's core month loop is no longer just inferred from scattered screens.

There is now a readable threaded driver that appears to run, in order:

- monthly score / summary
- map and oilfield phase
- contracts and spot market
- food
- gold
- imports
- health
- month advance
- election countdown
- opinion polls / popularity check

That matters a lot for both the port and Museum Mode.

For the port:

- it gives a defensible backbone for the order of play,
- it makes it much easier to preserve the feel of the original 20-30 minute run,
- and it shows where it would be safe to modernize UX without breaking structure.

For Museum Mode:

- it means the exhibit can show not just "how the VM works",
- but "how one whole in-game month really flowed through that VM".

## 7. Primitive vocabulary already recovered

The current dictionary / primitive map includes:

- `LIT`
- `EXECUTE`
- `BRANCH`
- `0BRANCH`
- `EXIT?`
- `R@`
- `R>`
- `DUP`
- `DROP`
- `SWAP`
- `OVER`
- `2DUP`
- `NIP`
- `ROT`
- `+`
- `-`
- `<`
- `>`
- `MIN`
- `=`
- `DIGIT?`
- `UM*`
- probable `U/MOD`
- `DNEGATE`
- `C@`
- `C!`
- `!`
- `AND`
- `OR`
- `XOR`
- `SP@`
- `SP0!`
- `RP0!`
- `1+`
- `2+`

Some still carry `?` in other notes where confidence is not fully locked.

Two especially fun examples for Museum Mode:

- `DIGIT?` at `$41ef` is a real parser primitive that accepts `0..9` and letter digits by subtracting `7`
- `UM*` at `$42e3` is a hand-written 16-step shift/add multiplier inside the VM

That means the game is not only "written in threaded words". It also ships custom arithmetic and parser primitives tailored to the runtime.

## 8. Why this matters for the eventual port

This is not just a fun detour.

It changes the porting strategy.

Instead of re-deriving everything from opaque 6502:

- we can recover word structure,
- decompile the threaded flow,
- identify variables and user-area offsets,
- reconstruct the original game logic at a much higher level.

For Museum Mode, the payoff is even better:

- show the original monthly/gameplay logic as recovered threaded words,
- show stack operations and token stepping,
- show text objects as Forth `DOES>` instances,
- show how a tiny VM drove a whole game on a C64.
