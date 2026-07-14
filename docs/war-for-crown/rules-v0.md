# War for Crown v0 Rules

This document is the SSOT for the first SofaArcade slice of War for Crown.
For C64-specific scope decisions, also see `c64-scope-notes.md`.
For the current visible turn flow, also see `c64-turn-flow-v1.md`.

## Intent

Build the simple, readable C64-target version first. One troop type only. No
infantry, cavalry, archers, engineers, supply goods, catapults, delayed recruit
queues, variable troop composition, or invented royalist AI. Royalist/Kingsmen
behavior is in scope only after it is recovered from the C64 code.

The player-facing model must stay obvious:

- this province has 20 soldiers,
- my province has 17 soldiers,
- the terrain is desert, so I need more soldiers or should retreat,
- the terrain is mountains, so the defender is hard to move.

## Reference Material

Original C64 files are local reference material and are not copied into this repo:

- `C:\Games\c64\WfC\Krieg_um_die_Krone_2_Manual.txt`
- `C:\Games\c64\WfC\ERBENT1A.D64`
- `C:\Games\c64\WfC\Inherits_of_the_Throne_v2.00_(Pandora).d64`
- `C:\Games\c64\WfC\wfc*.vsf`

The old Unity prototype is local reference material:

- `C:\MaraxFTP\d\Backup\WarForCrown`

## v0 Game Loop

1. Generate a water-heavy map preview and confirm one connected playable
   continent.
2. Players choose one home province each.
3. Each turn:
   - show a new-month overlay with month/year, weather, event, and income,
   - collect village income into money from that overlay,
   - attack enemy or neutral provinces,
   - move soldiers,
   - use the investment menu: build, hire soldiers, or go to next turn.
4. Capturing a player home castle eliminates that player. All provinces and
   soldiers owned by the eliminated player immediately transfer to the attacker.
5. A player wins v0 when every other player has been eliminated. Owning every
   non-water province is still a valid terminal state, but it is not the only
   C64-compatible win condition.

## v0 Entities

- Province: terrain, owner, villages, soldiers, neighbours.
- Player: id, label, money, color.
- Terrain: readable economic and defensive modifiers.
- Battle: attacker soldiers vs defender soldiers with terrain defence.

## Home Castles And Neutral Forts

Royalist/Kingsmen provinces start without fortifications. Map generation must
not roll watchtowers, castles, strongholds, or citadels for unowned land.

The recovered C64 start code initializes every non-home land province with
`2..5` villages and `3..6` soldiers before players choose their home castles.
Those provinces are owner `0` in the C64 memory model, meaning
Königstreuen/Kingsmen.

Confirming a player home province turns that province into the player's castle.
This is a fixed C64-target rule, not a setup option. There is no configurable
starting fort level and no neutral-fort readiness setting in v0.

Player castles are map-visible state. During home selection, the currently
selected candidate must show a pending castle marker on the map before
confirmation. After confirmation, every player's home province must keep a
visible castle marker on the map.

Capturing a player castle is not a normal province capture. It eliminates that
player from the match, removes them from future turns, and transfers every
province and soldier they still own to the attacker. The captured home province
contains the surviving attacking soldiers from the battle; the other transferred
provinces keep their current soldier counts.

## Soldiers And Recruitment

Soldiers exist only on provinces. `PlayerState` must not contain a free-troop,
reserve, or unplaced-soldier pool.

Starting soldiers are placed directly in the confirmed home province.
Recruiting soldiers spends money and adds those soldiers immediately to the
player's home province. The C64-target ruleset has no delayed training queue and
no separate deployment step.

## Terrain

Terrain affects two things in v0:

- income multiplier,
- defender strength multiplier.

Mountains and hills should feel safe. Desert should feel exposed and poor.

## Income

The local manual section `7.2.2 Die Einkommens- und Produktionsphase` states
that each village normally pays one Taler per month. If terrain-dependent
income is enabled, that one-Taler base is modified by the terrain tax
percentage.

v0 therefore calculates province income as:

```text
floor(villages * 1 Taler * terrainIncomeMultiplier)
```

Supply-goods production per village belongs to the fuller ruleset and is not a
v0 config field. It must not be used as the money income base in the simple
C64-target ruleset.

## Battle

Battle is deterministic in v0. Randomness can be added later after the core is
playable and tested.

Effective attack strength:

```text
attackingSoldiers * attackerMultiplier
```

Effective defence strength:

```text
defendingSoldiers * terrain.defenceMultiplier
```

The higher effective strength wins. Survivors are proportional to the strength
difference, with at least one surviving soldier for the winner.

## Non-Goals

- No full C64 rules restoration in v0.
- No variable troop composition.
- No supply goods.
- No catapults.
- No delayed recruit training queue.
- No broad manual/PC-style event system.
- No PC/version-2 "king returns" stalemate breaker unless the simple C64 code
  proves an equivalent mechanic.
- No network/Discord/async mode.
- No Unity migration.
