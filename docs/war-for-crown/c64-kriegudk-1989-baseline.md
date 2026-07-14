# War for Crown / Krieg um die Krone 1989 BASIC Baseline

This document records why `KRIEGUDK.D64` is not the same rules baseline as the
current `ERBENT1A.D64` compatibility target.

## Source Shape

Evidence:

- disk: `/mnt/c/Games/c64/WfC/KRIEGUDK.D64`
- disk SHA-256:
  `94d712b2a54842d13d1620eeaf40e6a86b66e810fed735b31e2ca1849251c2a5`
- disk directory version marker: `version 07.11.89`
- main program: `kudk.hpt`
- `kudk.hpt` load address: `$0801`
- `kudk.hpt` size: `28768`
- `kudk.hpt` SHA-256:
  `3b44b8508c70873cfcd2a89eedb54c71852ab1ff25bc092473801dd7f08d04d6`
- detokenized with:

```bash
petcat -2 -o /tmp/wfc-c64-logic/kriegudk/kudk-hpt.bas -- /tmp/wfc-c64-logic/kriegudk/kudk.hpt
```

`kudk.hpt` is tokenized BASIC, 570 detokenized lines. It is not the same modular
assembler layout as `ERBENT1A.D64` (`main`, `kampf`, `cbaron`, `menue`, `sys`,
`za..zz`).

## High-Level Differences

`KRIEGUDK` uses a different game model:

- map state arrays are BASIC arrays, including `a(86)`, `b(30)`, `m(30)`,
  `v(30,30)`, `nf(...)`, and `z(...)`;
- owner `5` is the troll side;
- line `93` asks player count;
- lines `548..561` configure troll growth, troll army setup, troll success
  evaluation, and dragon behavior;
- lines `193..197` run year/season start and end-game prompt;
- lines `198..229` run troll growth and troll war;
- lines `230..265` run dragon behavior;
- lines `266..313` run player reinforcement and wizard hiring;
- lines `315..450` run player attack and battle;
- lines `499..515` handle player win and troll win screens.

This is not the same flow as the selected `ERBENT1A` target:

```text
ERBENT1A: income/event -> attack -> movement -> build/recruit
KRIEGUDK: season -> trolls -> dragon -> reinforcement -> attack
```

## Combat / Attack Differences

In `KRIEGUDK`, player attack source selection is variable:

- line `327` starts recruitment/mobilization for attack;
- lines `328..340` iterate adjacent owned fields and let the player choose how
  many soldiers to mobilize from each source;
- the player can add/subtract `1` or `10`;
- source fields are decremented immediately;
- this differs from `ERBENT1A`, where selected attack sources commit all mobile
  soldiers, leaving one garrison.

Combat loss formulas are BASIC-level and different from the later `kampf`
module:

- line `397`: defender-side loss roll
  `fnr(gk*m(g)/100+.5)+int(m(g)/6)`;
- line `398`: attacker-side loss roll
  `fnr(ak*a/100+.5)+int(a/6/(2+(g<25)))`;
- lines `416..419` handle retreat/continue decisions;
- lines `451..460` handle retreat losses.

`ERBENT1A` instead uses the `kampf` module, combat percentage tables,
`sys:L949D`, and AI retreat thresholds `230/435`.

## Troll / Royalist Difference

`KRIEGUDK` has troll options, not the same Koenigstreuen/Kingsmen settings:

- line `548`: how often trolls grow per round;
- lines `553..555`: troll army setup mode, fieldwise vs connected;
- lines `556..558`: whether trolls evaluate attack success before fighting;
- lines `559..561`: dragon option.

This overlaps conceptually with later royalist options but is not byte-compatible
with `ERBENT1A` fields `$C8A5..$C8A8/$C8B3/$C8B4`.

## Port Decision

For the current `c64-original` port, keep `ERBENT1A.D64` as the selected
baseline because it matches the requested core flow with money, villages,
attack, movement, and build/recruitment while allowing supplies/catapults to be
excluded from the simple ruleset.

`KRIEGUDK.D64` should be treated as a separate `legacy-1989` research target,
not as a source of rules to merge into `c64-original`.

Do not mix these rules:

- do not import variable per-source attack mobilization from `KRIEGUDK` into the
  `ERBENT1A` C64 mode;
- do not import troll/dragon/wizard behavior into the simple `ERBENT1A` mode;
- do not use `KRIEGUDK` victory/reinforcement flow to resolve open text gaps in
  `ERBENT1A`.
