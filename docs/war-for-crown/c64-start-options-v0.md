# War for Crown C64 Start Options v0

## Source Options

The C64 option screens expose these setup groups:

- players:
  - human player count,
  - computer-controlled baron count;
- map:
  - continent province count,
  - maximum village count,
  - whether the village maximum applies to every province or to the largest
    province;
- economy and starts:
  - village price,
  - interest rate,
  - starting army size,
  - starting money;
- fortifications:
  - maximum home-castle fortification status,
  - maximum fortification status for other provinces;
- royalists:
  - royalist attitude,
  - royalist growth factor,
  - royalist investment willingness,
  - royalist distribution;
- rules toggles:
  - terrain influence: none, income, combat, both,
  - random events,
  - show computer-vs-computer battles.

## Explicit Omissions

These C64 options stay out of the current ruleset:

- supply goods / upkeep,
- catapults,
- variable troop composition.

The current battle model has one soldier type. Exposing variable troop
composition before troop categories exist would create a selectable option with
no honest effect.

## UI Placement

- Rules screen:
  economy, starts, fortification rules, royalist rules, terrain influence, and
  random events.
- Map screen:
  province count, water ratio, maximum village count, and village-limit mode.
- Player screen:
  human player count and computer-controlled baron count, plus human names,
  colors, and crests.
- Entering the player screen must synchronize setup rows with the configured
  human and AI counts. A valid `1 human + 3 AI` setup is startable.
- AI names are deterministic generated labels based on current AI order
  and use the original C64 menu name table extracted from `ERBENT1A.D64`,
  file `menue`, around offset `$18d4`: `ORTNID`, `SIEGEBAND`, `HERBRAND`,
  `OSERICH`, and the following names in that table. Changing the human count
  after changing AI count must not leave duplicate AI labels from older slot
  positions.

## Active v0 Effects

- `humanPlayerCount` and `aiPlayerCount` create the actual player list.
- Turn order cycles through the configured player list.
- AI player turns are consumed through the same public action API as human
  player turns.
- `provinceCount` drives the exact C64 map generator. `maxVillages` and
  `maxVillagesMode` affect province investment limits. There is no water-ratio
  setup field in the selected C64 ruleset.
- `villageCost`, `interestRatePercent`, `startingSoldiers`, and `startingMoney`
  affect economy and starts.
- `startingSoldiers` is the configured starting army placed into a player's
  confirmed home province. The provided C64 option screenshot shows
  `GROSSE DER ANFANGSARMEEN 20`, so the default player home army remains 20.
- Royalist/Kingsmen province soldiers are separate from `startingSoldiers`.
  The C64 setup code initializes every non-home land province with
  `(rnd & 3) + 3`, so the starting garrison range is 3 to 6 soldiers.
- Royalist/Kingsmen provinces start without fortifications.
- Confirming a home province gives that province the fixed player castle.
- `maxHomeFortificationLevel` and `maxProvinceFortificationLevel` affect later
  fortification upgrades.
- `terrainInfluence` controls whether terrain modifies income, combat, both, or
  neither.

## Recovered C64 Defaults And Fields

Evidence: `menue:L33B2..L33EA`, `menue:L4EE1`, `menue:L4F07`.

At new-game setup, `menue` copies a defaults table into `$C896..$C8BB` and
sets several extra fields:

| Field | Default | Meaning |
| --- | ---: | --- |
| `$C896` | `2` | configured player count |
| `$C8A1` | `30` | continent province count |
| `$C8A4` | `7` | random event gate/start field; `0` disables events |
| `$C8A5` | `1` | royalist attitude: friendly/neutral/hostile enum |
| `$C8A6` | `0` | hostile royalist source cooperation toggle |
| `$C8A7` | `1` | hostile royalist success-evaluation toggle |
| `$C8A8` | `0` | royalist distribution mode |
| `$C8A9` | `60` | royalist growth-factor raw weight |
| `$C8AA` | `12` | maximum villages setting |
| `$C8AB` | `0` | village-limit mode |
| `$C8AC` | `1` | terrain affects income |
| `$C8AD` | `3` | starting home castle level |
| `$C8AE` | `6` | maximum home castle level |
| `$C8AF` | `1` | maximum non-home fortification level |
| `$C8B0` | `4` | periodic/special event year gate |
| `$C8B1` | `1` | terrain affects combat |
| `$C8B2` | `0` | troop distribution option; omitted in simple rules |
| `$C8B3` | `20` | raw royalist growth percentage/weight |
| `$C8B4` | `30` | raw royalist investment percentage/weight |
| `$C8BA` | `20` | starting soldiers placed in confirmed home province |
| `$C8BB` | `20` | starting money low byte copied into each player |
| `$C900` | `4` | village price |
| `$C901` | `8` | interest rate percentage |
| `$CA54` | `10` | full-rules pressure/investment factor |
| `$CA55` | `0` | supply/resource gate; forced off for `c64-original-simple` |
| `$CA56` | `0` | catapult/extra battle-pressure gate; forced off for `c64-original-simple` |
| `$CA74` | `1` | show battle/presentation gate |

Fortification names at `menue:L4183` are mapped to stable TypeScript ids in
their C64 byte order:

| C64 byte | German label | TS id |
| ---: | --- | --- |
| `0` | `KEINER` | `none` |
| `1` | `TURM` | `watchtower` |
| `2` | `FORT` | `fort` |
| `3` | `BURG` | `castle` |
| `4` | `SCHLOSS` | `stronghold` |
| `5` | `FESTUNG` | `fortress` |
| `6` | `ZITADELLE` | `citadel` |

Simple rules still start neutral/Kingsmen provinces at fortification `0`. The
home province receives `$C8AD` only when a player confirms it as home.

## Recovered Option Ranges

Evidence: `menue:L34A7..L39DA`.

| Field | UI range/values | Notes |
| --- | --- | --- |
| `$C896` | `1..4` | total configured players in the C64 menu |
| `$C8A1` | `16..99` | continent province count |
| `$C8AA` | `5..99` | maximum villages setting |
| `$C8AB` | enum | max villages applies fixed or scaled by province size |
| `$C8AC/$C8B1` | bit split | terrain influence: bit 0 income, bit 1 combat |
| `$C8AE` | `3..6` | maximum home castle level |
| `$C8AD` | `3..$C8AE` | starting home castle level |
| `$C8A4` | toggle by XOR `7` | random events enabled/disabled |
| `$C8B0` | `2..20` | periodic/special event gate |
| `$C8AF` | `0..($C8AE - 1)` | non-home fortification maximum |
| `$C8B3` | `10..90` | raw royalist growth weight |
| `$C8B4` | `0, 10, 60, 90` | royalist investment willingness enum table |
| `$C8BA` | `10..99` | starting home soldiers |
| `$C8BB` | `0..99` | starting money |
| `$C900` | `4..12` | village price |
| `$C901` | `4..12` | interest rate |
| `$C9DE` | `0..(4 - playerCount)` | number of computer barons added by setup |
| `$CA54` | `1..99` | full-rules factor; keep disabled for simple rules |
| `$CA55` | toggle | supply/resource gate; keep `0` for simple rules |
| `$CA56` | toggle | catapult/extra battle-pressure gate; keep `0` for simple rules |

## Village Limit Formula

Evidence: `sys:L9A2A`, `sys:L9A4B`, `menue:L5439`.

`L9A2A` returns the maximum village count for the currently selected province:

```text
if C8AB == 0:
  maxVillages = C8AA
else:
  maxVillages = floor(provinceTileCount * C8AA / largestProvinceTileCount)
```

`menue:L5439` computes `$C9CF`, the largest province tile count used by this
scaled mode. This matches the setup text where village maximum can apply to
every province or to province size.

## Royalist Normalization

Evidence: `menue:L53E7`.

Before play, raw royalist growth/investment settings are normalized against the
growth-factor setting:

```text
total = C8B3 + C8B4 + C8A9
C8B3 = floor(C8B3 * 256 / total)
C8B4 = floor(C8B4 * 256 / total)
```

The normalized byte values are used by royalist production at `main:L5209`.
Keep the raw UI values separate from normalized runtime values in the port.

## UI Notes

- The rules screen must not show an explanatory `C64 ruleset` banner. The
  current game identity is already established by the game title.
- Rules options with unclear labels must expose short tooltip help.
- The rules screen must not expose a starting-fort selector or neutral-fort
  readiness setting. Those are not part of the current C64-target ruleset.
- Random events stay out of the rules screen until a real player-facing event
  system exists.
- The province panel must spell out terrain and fortification modifiers. Raw
  values such as `None x1.00` are not acceptable UI copy.
- The map confirmation panel should only show actionable map settings. Static
  summaries such as total provinces and total tiles duplicate the controls and
  add noise.
- The home-selection side panel should focus on the province being selected.
  The house/player list is not useful before any house owns land.
- During home selection, the selected candidate must display the fixed player
  castle that will be assigned after confirmation, not any neutral fort data.
- During home selection, the selected candidate must also show a pending castle
  marker on the map. Confirmed home provinces keep a visible castle marker on
  the map for the rest of the game.
- The province panel should not show a separate `X` clear-selection button.
  Selecting another province or moving phase context is enough for the current
  flow.

## Stored For Later Rules

These settings are stored in `GameConfig` and surfaced in UI, but their full C64
behavior needs a later royalist/event pass:

- `royalistAttitude`,
- `royalistGrowthPercent`,
- `royalistInvestmentPercent`,
- `royalistDistribution`,
- `randomEventsEnabled`,
- `showComputerBattles`.

The original C64 option visible in the captured setup screen is
`KAMPFE COMPUTER VS COMPUTER ZEIGEN ?`, so the v0 option is scoped to showing
AI-vs-AI battle presentation. It is not a broad "show every AI move" toggle
until the original behavior is confirmed.

Royalist/Kingsmen behavior must not be invented from these config fields. The
fields are retained because the original setup exposes them; their actual
effects must come from C64 code analysis.
