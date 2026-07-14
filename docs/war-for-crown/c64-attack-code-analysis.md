# War for Crown C64 Attack Code Analysis

## Sources

- Disk image: `/mnt/c/Games/c64/WfC/Die_Erben_des_Throns_-_Krieg_um_die_Krone_II_(ASS).d64`
- Disk image: `/mnt/c/Games/c64/WfC/ERBENT1A.D64`
- Module: `kampf`
- Manual: `/mnt/c/Games/c64/WfC/Krieg_um_die_Krone_2_Manual.txt`, sections `7.2.5 Die Angriffsphase` and `7.2.6 Der Kampf`

Extracted modules:

- ASS `kampf.prg`: load address `$8000`, 7041 bytes, SHA-256 `78f94fa55dafaa84338bf379d06f0d9515d89c4cec6310468e48286beba357bb`
- GDG `kampf.prg`: load address `$7E00`, 5371 bytes, SHA-256 `351fedbf44f8c8e4c5d466af239a871cb01fdbb471b483bc8af3d9ff691a3653`

The GDG module is easier to inspect because the combat code and combat strings are tighter. The ASS module contains the same relevant combat loop shifted to different addresses.

## Attack Selection

The C64 attack setup matches the manual:

1. Choose the target province first.
2. Toggle adjacent owned source provinces.
3. Every selected source province contributes all soldiers except one garrison soldier.
4. Selecting the target province again starts the battle.

The manual explicitly says the selected source provinces are marked and that all soldiers in those provinces join the fight except one remaining for representation. This confirms that the web version should not expose per-source attack soldier counts for the C64-style ruleset.

Selected attacking soldiers are also spent for the current attack phase. If the
attackers win, surviving attackers occupy the target province, but that occupied
province is not a fresh attack source until the next attack phase. This prevents
the same army from chaining through multiple provinces in one phase.

## Human Attack Screen Flow

Evidence: `main:L487E..L4C50`, shared click helper `main:L4D45`, click decoder
`kernal:$2028`, prompt text in `mt1`, and
`fixtures/main-screen-action-indices.json`.

Before showing the attack prompt, `main:L487E` scans for at least one legal
attack:

1. active owner `0` jumps to the royalist attack path;
2. computer-controlled players jump to `cbaron:$5803`;
3. full-rules supply gates can skip the phase;
4. owned provinces are scanned from high id down to `1`;
5. a source candidate is rejected if `$C832 & $01` is already set;
6. a source candidate is rejected by `main:L4CFE` when full-rules home/supply
   reachability says it cannot attack;
7. a source candidate must have more than one soldier;
8. `kernal:L219C`, `L22CA`, and `L2207` prove that at least one adjacent
   non-owned province exists.

If no legal attack exists, the routine returns and the turn continues to the
movement phase.

### Prompt: Attack Or End Phase

`main:L48EC` displays:

```text
MOCHTEST DU EINE PROVINZ ANGREIFEN?
JA  NEIN
```

It calls `main:L4D45`. Fixture proof confirms that `L4D45` preserves `A` and
`X`, returns with flags from `CMP #$00`, and loops when `kernal:$2028` returns
`A == $FF`. For this two-choice prompt, `X == 0` means the first choice (`JA`)
and enters target selection at `L4900`; any other active choice ends the attack
phase.

### Shared Dialog: Cancel Or Continue

Invalid clicks call either `main:L4D2B` or `main:L4D38`. Both display a message
and then call `main:L4D45`, whose active fields are:

```text
AKTION ABBRECHEN
ODER
WEITERMACHEN
```

Fixture proof confirms both dialog helpers return with flags from `CPX #$00`.
For these dialogs:

- `X == 0` means `ABBRECHEN`: clear all currently selected `$10` source marks
  through `main:L4923` and restart the attack entry;
- `X != 0` means `WEITERMACHEN`: return to the current target/source selection
  loop.

`kernal:$2028` returns `$FF` when the click is not on an active field; `L4D45`
loops until a valid active field is clicked. The fixture vector returns `$FF`
once and then a valid first-field click; the input stub counter ends at `2`.

### Target Selection

`main:L4900..L495D` displays:

```text
WELCHE PROVINZ ANGREIFEN?
```

Target loop behavior:

| Click | C64 behavior |
| --- | --- |
| water / no province (`Y == 0`) | show cancel/continue dialog |
| owned province | show `DIESES FELD GEHORT DIR SELBER`, then cancel/continue |
| non-owned province | store it as target `$C9D7`, then enter source selection |

### Source Selection And Confirmation

`main:L495D..L4A49` displays:

```text
SAMMELE DEINE ARMEE ...
HAST DU DEINE TRUPPEN GESAMMELT, WAHLE DAS KRIEGSZIEL NOCHMAL AN.
```

Source loop behavior:

| Click | C64 behavior |
| --- | --- |
| water / no province (`Y == 0`) | show cancel/continue dialog |
| selected target `$C9D7` | confirm and enter shared battle setup at `main:L4A49` |
| other non-owned province | show cancel/continue dialog |
| owned but not adjacent to target | show `DIESES FELD IST MIT DEM KRIEGSZIEL NICHT BENACHBART`, then cancel/continue |
| owned but `$C832 & $01` spent | show exhausted-army message, then cancel/continue |
| owned but rejected by full-rules `L4CFE` | show supply/home-reachability message, then keep selecting |
| legal owned adjacent source | toggle `$C832 & $10` for that source |

When a source is toggled on, C64 briefly draws it with one soldier, then restores
the real soldier count. That is only a visual marker for selected attack sources.

Selecting the target with no selected source provinces reaches `main:L4A49`, but
`main:L5005` produces zero attackers and `main:L4B41` falls through to
`main:L4C50`; no battle starts, `$10` source marks are cleared, and the attack
entry repeats.

### Aftermath And Reuse Prevention

At the end of a resolved battle:

1. `main:L4C3E..L4C4D` sets `$01` on every province still marked `$10`;
2. `main:L4C50` clears `$10` with mask `$EF`;
3. `main:L487E` restarts and scans for another legal attack.

This is the exact C64 rule that prevents the same source army from attacking
again in the same attack phase.

## Battle Screen Is Interactive

The C64 battle is not a passive summary. The module enters a dedicated loop:

```asm
; GDG kampf.prg, load $7E00
L7E64:  jsr     L8856   ; redraw/update battle bars and numbers
        jsr     L82D5   ; finish battle after death or retreat command
        jsr     L83C4   ; wait for battle-screen input
        jsr     LCDE9
        jsr     L8618   ; resolve exactly one combat round
        jmp     L7E64
```

ASS has the same loop:

```asm
; ASS kampf.prg, load $8000
L8054:  jsr     L868D
        jsr     L82D6
        jsr     L834D
        jsr     L6DE9
        jsr     L8618
        jmp     L8054
```

`L83C4` / `L834D` blocks until input. That input then allows the loop to continue into `L8618`, which resolves one combat round. This is why moving the joystick appeared to "do something": it advanced the battle by one round.

## C64 Input Mapping

The combat module reads CIA ports directly. It does not use KERNAL `GETIN`.

GDG addresses:

- `$83D8`: `lda $DC01` / `and #$10`
- `$83EC`: `lda $DC01` / `and #$10`
- `$83F3`: `lda $DC00` / `and #$10`
- `$83FA`: `lda $DC00` / `and #$0F`
- `$8D46`: `lda $DC00` / `and #$10`

ASS addresses:

- `$8361`: `lda $DC01` / `and #$10`
- `$8375`: `lda $DC01` / `and #$10`
- `$837C`: `lda $DC00` / `and #$10`
- `$8383`: `lda $DC00` / `and #$0F`
- `$8B37`: `lda $DC00` / `and #$10`

The core GDG input routine:

```asm
L83C4:  lda     $9406
        beq     L83E2
        ldx     $C9D8
        beq     L8420
        lda     $C9D9,x
        bne     L8420
        ldx     #$04
L83D5:  jsr     L8D65
        lda     $DC01
        and     #$10
        beq     L8406   ; command 1
        dex
        bne     L83D5
L83E2:  ldx     $1624
        beq     L8427
        lda     $C9D9,x
        bne     L8427
        lda     $DC01
        and     #$10
        beq     L840F
L83F3:  lda     $DC00
        and     #$10
        beq     L8409   ; command 2
        lda     $DC00
        and     #$0F
        cmp     #$0F
        beq     L83E2   ; no direction: keep waiting
L8403:  lda     #$00     ; normal round command
        .byte   $2C
L8406:  lda     #$01     ; defender retreat command
        .byte   $2C
L8409:  lda     #$02     ; attacker retreat command
        sta     $C9D9
        rts
```

Interpretation:

- joystick direction on `$DC00 & #$0F` stores command `0` and advances one normal combat round,
- joystick fire on `$DC00 & #$10` stores command `2`, then the next round is the attacker's retreat round,
- `$DC01 & #$10` stores command `1`, matching the manual's C64 defender retreat via SPACE,
- no input loops inside the routine and does not advance combat.

The manual also says mouse users click:

- the top-left sword-and-shield field to resolve a round,
- the attacker's flag to retreat,
- the defender's standard to retreat when legal.

For the web implementation, this maps cleanly to visible battle commands:

- `Fight round`,
- `Retreat attacker`,
- `Retreat defender` only when the defender has a legal adjacent owned province and the province is not a home fortress.

## Round Resolution

`L8618` resolves one simultaneous combat round. It computes both sides' hit counts first, then subtracts both results:

```asm
L8618:  jsr     L85C0   ; attacker hit calculation
        jsr     L8568   ; defender hit calculation
        ...
        sbc     L92C2   ; subtract defender hits from attacker soldiers
        ...
        sbc     L92C5   ; subtract attacker hits from defender soldiers
```

The GDG module stores attacker soldiers in `$C9D0-$C9D2` and defender soldiers in `$C9D3-$C9D5`. The calculated casualties are clamped so they cannot exceed the current army size.

The manual describes the formula:

- each side has a combat power percentage,
- maximum hits are based on soldiers multiplied by combat power,
- a random value is selected up to that maximum,
- an additional minimum-hit component based on terrain is added,
- both sides' hits are applied simultaneously, so there is no first strike.

The exact random/arithmetic helpers are now documented in
`c64-battle-arithmetic-decompile.md`.

### Finish Check

After `L8618`, the next loop calls `L82D5` before reading another command. This
routine decides whether combat is over:

- if attacker soldiers are zero and defender soldiers remain, the defender wins;
- if both armies are zero, C64 executes `INC $C9D3` and then resolves defender
  victory with one surviving defender;
- if attacker soldiers remain and defender soldiers are zero, the attacker wins;
- if both armies remain, `$C9D9` decides whether the battle continues or a
  retreat command is finalized.

This means a raw combat round can produce `0/0`, but the final map state cannot
keep an owned province with zero soldiers.

## Retreat Handling

Retreat is not free. The code path stores a retreat command, then `L8618` still resolves one combat round before the next loop finalizes the retreat.

The strings confirm command mapping in GDG:

- command `2` jumps to text around `$8FF3`, followed by `DIE ANGREIFER ZIEHEN SICH ZURUECK !!!`
- command `1` jumps to text around `$901C`, followed by `DIE VERTEIDIGER ZIEHEN SICH ZURUECK !!!`

The manual adds:

- attacker retreat loses all attacking catapults to the defender,
- defender retreat is only possible with an adjacent owned escape province and not when defending the home fortress,
- AI-controlled barons decide retreat automatically.

## Recovered AI Retreat Checks

`L83C4` dispatches battle input differently for human and computer-controlled
sides:

- if the defender side is computer-controlled, it calls `sys:$9486`; carry set
  stores command `1`, the defender retreat command;
- if the attacker side is computer-controlled, it calls `sys:$946F`; carry clear
  stores command `2`, the attacker retreat command;
- otherwise command `0` resolves a normal combat round.

The `sys` module is loaded at `$9400`. `sys:$9426` computes a strength ratio from
the current battle soldiers and battle percentages. The value compared by the AI
is effectively:

```text
floor(((attackerSoldiers * 256 / defenderSoldiers) ^ 2 / defenderCombatPercent * attackerCombatPercent) / 256)
```

`kampf` stores the two AI retreat thresholds beside the battle code:

- `$7E2E-$7E30 = $0000E6` (`230`): attacker AI retreats below this value;
- `$7E31-$7E33 = $0001B3` (`435`): defender AI retreats at or above this value
  when defender retreat is legal.

The defender check runs before the attacker check, so a legal defender AI retreat
takes precedence over an attacker command for that battle tick.

Catapults, supply rules, and troop-type distribution belong to the fuller ruleset and should remain out of the first C64-simple implementation unless explicitly enabled later.

## Implementation Implications

The old web behavior that showed a simple battle summary was wrong for the
C64-style flow. The active implementation now stores `GameState.battle`, uses the
recovered C64 combat setup and per-round arithmetic, and exposes public battle
actions for rounds and retreat commands. Player choice among multiple defender
retreat destinations is still deferred.

Required first-pass battle model:

1. Attack phase still uses target-first and source-toggle selection.
2. Confirming attack starts a `BattleState` through the public API instead of
   resolving combat immediately.
3. The scene opens a dedicated battle screen/overlay from `GameState.battle`.
4. The battle screen shows attacker soldiers, defender soldiers, relative bars,
   combat power percentages, terrain, and legal commands.
5. `Fight round` resolves exactly one simultaneous combat round.
6. `Attacker retreat` resolves exactly one final round, then ends the battle as
   attacker retreat.
7. `Defender retreat` is legal only when a deterministic owned escape province
   exists. It resolves exactly one final round, then moves surviving defenders
   to that escape province.
8. Battle continues until one side reaches zero soldiers or a retreat command is
   completed.
9. Every battle, including AI and AI-vs-AI battles, must be visible in the
   scene. The game must not autoplay battle rounds past the battle screen.
10. After battle resolution, the scene must keep the battle panel open, show the
    final battle summary there, and wait for a player confirmation before
    returning to the map.
11. After battle, the attack phase asks whether to attack again or end the phase.

## Battle-Screen v1 Scope

This v1 is intentionally flow-compatible. The recovered byte-level arithmetic
target is documented in `c64-battle-arithmetic-decompile.md`.

Public API actions:

- `attack`: validates the selected target/source set, rejects sources already
  spent in the current attack phase, removes mobile soldiers from source
  provinces, marks those source provinces spent, and creates `GameState.battle`;
- `battle-round`: resolves one simultaneous combat round;
- `battle-retreat-attacker`: resolves one final round, then returns surviving
  attackers to the first source province; it must be issued by the attacker side;
- `battle-retreat-defender`: resolves one final round, then moves surviving
  defenders to the deterministic retreat province; it must be issued by the
  defender side.

Scene contract:

- `GameState.battle !== null` blocks AI autoplay and shows the battle screen;
- if the active attacker is AI-controlled, the human may only click `View`; that
  click asks the AI for the next battle command instead of exposing the
  fight/retreat buttons;
- `battle-resolved` keeps the battle screen open in summary mode;
- the summary blocks map interaction and AI autoplay until confirmed.

Until the exact C64 hit arithmetic is fully recovered, the round resolver uses a
single shared pure function. Do not duplicate combat math in the scene.

Not implemented in v1:

- exact C64 random hit arithmetic;
- automatic baron/royalist retreat decisions;
- player choice among multiple defender retreat destinations;
- catapult/supply/troop-type side effects.

Deferred until deeper code recovery:

- exact original C64 hit randomization,
- exact bar animation timing,
- catapult loss/destruction rules,
- supply and advanced ruleset modifiers.
