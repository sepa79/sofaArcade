# President (C64) reverse-engineering task for Codex

## Goal

Reverse-engineer the Commodore 64 game **President** toward a **faithful port / reconstruction**, not just a loose remake.

The working hypothesis from snapshot inspection is that this build is **not a plain hand-written 6502 monolith**. It appears to contain a **Forth / Forth-like threaded runtime** with dictionary entries and runtime words visible in RAM. That makes it a good candidate for:

1. dictionary extraction,
2. pseudo-decompilation into a Forth-like listing,
3. mapping gameplay state variables,
4. reconstructing monthly game logic and UI flow.

## Deliverables expected from Codex

1. **Dictionary extractor** for the runtime visible in the snapshots.
2. **Pseudo-decompiler** that can walk threaded code and emit a readable Forth-like listing.
3. **Reverse-engineering notes** documenting:
   - dictionary/header format,
   - code field / parameter field assumptions,
   - primitive words,
   - likely entry points,
   - gameplay variable map.
4. **A first-pass gameplay state map** with named variables and confidence levels.
5. Optional but desirable: a **minimal replayer/simulator** for one or two monthly update flows.

## Evidence already found

### 1) Signs of a Forth-like runtime

In memory, the following strings/words were observed and are highly suggestive of a threaded Forth-like system:

- `EXECUTE`
- `(OF)`
- `BRANCH`
- `0BRANCH`
- `LOOP`
- `LIT`
- `CMOVE`
- `PC/FORTH Screen Editor`

There is a strong suspicion that around the `$4073-$415F` region there is a dictionary / linked word structure.

There is also evidence that code executing around `$6200` does **not** look like a normal dense 6502 code stream, but more like threaded tokens / addresses interpreted by a runtime.

### 2) BASIC stub / loader

The program appears to have a normal BASIC stub around `$0801` with `SYS 2064`, followed by a small 6502 loader/depacker and then the main runtime/game content.

## Gameplay / UI observations gathered from screens and snapshots

### Starting map observations

Visible objects on the early map state:

- 1 player tank
- 1 enemy tank
- 2 anti-aircraft guns
- 1 start rig
- 1 truck
- 1 storage tank
- 1 newly bought production rig
- 4 blue rock/obstacle tiles

This suggests the game likely uses either:

- a static terrain/tile layer + separate object/unit lists, or
- a tilemap for structures plus separate mobile-unit records.

### Screens seen in this capture set

- map / survey / purchase flow
- opinion polls
- food
- gold purchase
- imports summary
- health aid
- balance-of-payments summary
- game score / ruler rating
- map prompt to import new tank

## Current variable map (best known candidates)

These addresses are **working hypotheses**, not final truth. Confidence is indicated informally.

### High confidence

- `$8411-$8412` — **Bank balance** (16-bit little-endian)
  - Observed values aligned with screens:
    - `10000`
    - `9950`
    - `9834`
    - `9804`

- `$84F9-$84FA` — **Currency Value Index**
  - Observed values:
    - `100`
    - `103`

- `$85F4-$85F5` — **Opinion polls: Your Party**
- `$85F6-$85F7` — **Opinion polls: Moderate Party**
- `$85F8-$85F9` — **Opinion polls: Extremist Party**
  - Observed transitions:
    - `50 / 25 / 25`
    - `47 / 28 / 25`
    - `46 / 29 / 25`
    - `45 / 30 / 25`

### Medium confidence

- `$843D-$843E` — **Current health-aid spend / selected health cost**
  - Seen as `50`, later `30`, matching health-screen cost.

- `$852E-$852F` — **Months to next election**
  - Seen as `23`, matching the summary screen text.

- `$854A-$854B` — **Likely game score**
  - Candidate value `194`, matching the shown game score.

### Medium / low confidence — transient monthly economics

The following look like transaction / monthly-summary fields rather than persistent world constants:

- `$84FD-$84FE`
- `$8501-$8502`
- `$8506-$8507`
- `$851E-$851F`

Values such as `50`, `20`, etc. appeared during import/gold phases and later zeroed after monthly summary resolution.

Likely candidates include:

- gold purchase cost,
- food import cost,
- oil equipment import cost,
- military hardware import cost,
- monthly totals pending settlement.

### Other suspicious economic fields

The following locations showed values of `50` during the gold purchase flow and should be investigated as price / average cost / required cost / copied display values:

- `$843D`
- `$84ED`
- `$851E`
- `$8552`

### Structural / state-table region

The area around:

- `$84xx-$85xx`

looks increasingly like a **global game-state table**.

The area around:

- `$66C4-$6750`

looked like a structured table of repeated records / tagged values and may hold system state or object/stat records.

## Important diffs already observed

### Production rig purchase

A value of `50` appeared in a cost-related field after buying a production rig; this matched the known on-screen build cost.

This strongly suggests at least one selected-action/build-cost variable is directly visible in RAM.

### Polls change

The poll values matched exact on-screen percentages, confirming that the game stores them as **16-bit numbers** rather than deriving everything purely from text.

### Gold purchase

The sequence:

- bank balance `10000 -> 9950`
- gold price `50`
- stocks `0 -> 1`
- currency index `100 -> 103`

provided strong anchors for the economics state.

### Monthly summary / turn 2

From the later monthly flow:

- import costs = `116`
- health costs = `30`
- gold purchases = `50`
- total expenditure = `196`
- bank balance = `9804`
- polls declined to `45 / 30 / 25`

This confirms multiple end-of-month derived variables and penalties, and shows that the game is quite punishing.

## Reverse-engineering plan for Codex

### Phase 1 — snapshot tooling

Build tooling to parse the attached VICE `.vsf` snapshots:

- identify the `MAINCPU` module,
- identify the `C64MEM` module,
- extract RAM,
- extract registers / PC / flags,
- produce comparable binary dumps.

The snapshots included here should be enough to automate diffing of key memory ranges.

### Phase 2 — dictionary discovery

Search RAM for candidate word headers and linked dictionary entries.

Likely tasks:

- identify header structure,
- detect name length / flags byte,
- determine link-field layout,
- identify code-field addresses (CFAs),
- separate primitive/native words from colon definitions.

Output desired:

- a machine-readable dictionary index,
- plus a human-readable report.

### Phase 3 — primitive word identification

Prioritize identifying these words:

- `LIT`
- `EXECUTE`
- `BRANCH`
- `0BRANCH`
- `LOOP`
- memory access words,
- print/rendering words,
- keyboard/joystick/fire input words.

Map which CFAs correspond to native 6502 handlers.

### Phase 4 — threaded-code walker / pseudo-decompiler

Implement a walker that, for a suspected colon definition, emits a Forth-like listing such as:

```forth
: WORD_1234
  WORD_1000
  LIT 50
  WORD_1180
  0BRANCH ...
;
```

Then incrementally rename words as their semantics become clearer.

### Phase 5 — semantic lifting

Use the known gameplay variable addresses and known screens to assign names like:

- `BANK-BALANCE`
- `POLL-YOUR-PARTY`
- `POLL-MODERATE`
- `POLL-EXTREMIST`
- `CURRENCY-VALUE-INDEX`
- `MONTHS-TO-ELECTION`

Search for words that read/write those addresses.

This should expose routines for:

- monthly tick,
- gold purchases,
- imports,
- health aid,
- polls update,
- score update,
- possibly battle / air strike resolution.

### Phase 6 — toward a faithful port

Once the word graph and state map become stable, produce a platform-neutral gameplay spec:

- exact turn order,
- exact arithmetic where recoverable,
- screen flow,
- object model,
- economics model,
- combat effects.

This can feed a faithful reimplementation.

## Suggested repo/output structure

```text
president-re/
  README.md
  tools/
    parse_vsf.py
    extract_dictionary.py
    decompile_forth.py
    diff_snapshots.py
  docs/
    findings.md
    memory_map.md
    dictionary.md
    gameplay_state.md
  data/
    snapshots/
    screens/
```

## Notes on confidence / caution

- The runtime is **very likely Forth-like**, but the exact product/version still needs confirmation.
- Do not assume every visible string belongs directly to the game rather than the resident runtime/editor.
- Some values in `$84xx-$85xx` may be duplicated for UI or temporary monthly calculations.
- Snapshot-based inference is strong for state variables but weaker for exact control flow unless tied back to dictionary words and CFAs.

## Attached artifacts in this package

This zip should contain:

- all provided VICE snapshots,
- all provided screenshots,
- this task file,
- a manifest.

## Practical objective

The practical goal is **not** “recover the exact original source code”.
The practical goal is:

1. recover the threaded/runtime structure,
2. extract a readable pseudo-source,
3. map the real game logic,
4. enable a **faithful port** of President.

