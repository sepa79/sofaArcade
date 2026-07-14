# War for Crown Terrain v0

## Source Findings

The C64/PC manual text says the game has seven land terrain types. Terrain can
affect village income and defender combat strength. The available manual
transcription does not include the numeric reference tables that are mentioned
after those paragraphs.

Recovered name evidence:

- C64 German legend strings: `GRAS`, `WUESTE`, `BUESCHE`, `WALD`, `HUEGEL`,
  `SUMPF`, and a truncated `GE...` entry that matches the manual's `Gebirge`.
- C64 English v2 legend strings: `GRASS`, `DESERT`, `BUSHES`, `FOREST`,
  `HILLS`, `SWAMP`, `CHAIN`, `WATER`.
- Old Unity port enum:
  `Water`, `Plains`, `Dirt`, `Desert`, `Marshland`, `Forest`, `Hills`,
  `Mountains`.
- Old Unity `TerrainType` data model has revenue, attack, and defence
  multiplier fields, but the C# source does not define the serialized numeric
  values.

## v0 Terrain Table

The current TypeScript table is a reconstructed v0 rules table. It follows the
manual's qualitative order until the original reference card or reliable C64
numeric table is recovered.

C64 terrain ids recovered from `$C576 + province` and the C64 legend are
one-based and must be adapted explicitly in `c64-original` code:

```text
1 grass/plains
2 desert
3 bushes/brushland
4 forest
5 hills
6 swamp/marshland
7 chain/mountains
```

| ID | Display name | C64/port source name | Income | Defence | Reasoning |
| --- | --- | --- | ---: | ---: | --- |
| `plains` | Grass | Gras / Grass | 1.20 | 1.00 | fertile open land, baseline defence |
| `desert` | Desert | Wueste / Desert | 0.55 | 0.85 | poor income and exposed terrain |
| `brushland` | Bushes | Buesche / Bushes / Dirt | 1.10 | 1.10 | fertile brushland with light cover |
| `forest` | Forest | Wald / Forest | 1.00 | 1.25 | medium income, strong cover |
| `hills` | Hills | Huegel / Hills | 0.90 | 1.45 | modest income, strong defence |
| `marshland` | Swamp | Sumpf / Swamp / Marshland | 0.75 | 1.35 | weak economy, strong cover |
| `mountains` | Mountain Chain | Gebirge / Chain / Mountains | 0.65 | 1.85 | poor income, strongest defence |

Water is not a province terrain. It has no income or combat modifiers.

## Implementation Rules

- `TERRAIN_DEFINITIONS` is the single source of terrain names, colors, and
  multipliers.
- `TERRAIN_IDS` must contain all seven land terrain IDs.
- A generated map with at least seven provinces must include every land terrain
  type at least once.
- UI terrain legends must read from `TERRAIN_DEFINITIONS` and `TERRAIN_IDS`.
