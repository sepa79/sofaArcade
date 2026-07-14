# War for Crown C64 Text, Weather, Titles, And Finish Screens

This document records the recovered visible-text corpus that affects gameplay
logic for the `ERBENT1A.D64` baseline. It is not the app localization catalog;
it is the C64 evidence that the PL/EN catalog must cover.

Character notes:

- C64 text dumps use `[` for `AE`, `\` for `OE`, and `]` for `UE`.
- `$91` and `$93` are layout/control separators, usually line breaks or clears.
- `$AE` is a numeric insertion marker in the text-window format.
- Title insertion in `mt2` uses the same low-level formatter as the runtime
  title renderer, not a literal `+TITEL` string.

## Weather And Month Labels

Evidence: `mt1`, visible through `strings`, and weather selection in
`main:L3D7C`.

Month labels:

| Index | C64 text |
| ---: | --- |
| 0 | `JANUAR` |
| 1 | `FEBRUAR` |
| 2 | `MARZ` (`MAERZ`) |
| 3 | `APRIL` |
| 4 | `MAI` |
| 5 | `JUNI` |
| 6 | `JULI` |
| 7 | `AUGUST` |
| 8 | `SEPTEMBER` |
| 9 | `OKTOBER` |
| 10 | `NOVEMBER` |
| 11 | `DEZEMBER` |

Weather labels by `$CA4B`:

| `$CA4B` | C64 text | Meaning for localization |
| ---: | --- | --- |
| 0 | `HERVORRAGEND` | excellent |
| 1 | `SONNIG` | sunny |
| 2 | `WARM` | warm |
| 3 | `BEWOLKT` (`BEWOELKT`) | cloudy |
| 4 | `KUHL` (`KUEHL`) | cool |
| 5 | `KALT` | cold |
| 6 | `STURMISCH` (`STUERMISCH`) | stormy |

The screen prefix is `DAS WETTER IST ...` and the year suffix is `. JAHR`.

## Rank And Title Mapping

Evidence: `kernal:L1EE0..L1EF3`, title offset table `kernal:L1F19`, title text
at `$1F25..$1F6F`, gender setup in `menue:L4B96..L4C7B`, and title promotion in
`main:L4EF8..L4F40`.

The renderer prints title text by:

```text
titleIndex = $C8CF[player] + $C8CA[player]
address    = $1F25 + titleOffsetTable[titleIndex]
```

`$C8CA` is `0` for male title text and `6` for female title text.

| `$C8CF` | Male title | Female title |
| ---: | --- | --- |
| 0 | `BARON` | `BARONIN` |
| 1 | `GRAF` | `GRAFIN` (`GRAEFIN`) |
| 2 | `HERZOG` | `HERZOGIN` |
| 3 | `FURST` (`FUERST`) | `FURSTIN` (`FUERSTIN`) |
| 4 | `KURFURST` (`KURFUERST`) | `KURFURSTIN` (`KURFUERSTIN`) |
| 5 | `KONIG` (`KOENIG`) | `KONIGIN` (`KOENIGIN`) |

Promotion thresholds are recalculated from the configured province count
`$C8A1` in `menue:L5455`:

```text
threshold[0] = 0
threshold[1] = floor($C8A1 * 1 / 5)
threshold[2] = floor($C8A1 * 2 / 5)
threshold[3] = floor($C8A1 * 3 / 5)
threshold[4] = floor($C8A1 * 4 / 5)
```

`main:L4EF8` checks thresholds from high to low and derives the target title
rank. If the target rank is above the current rank, the player gains only one
rank per check. If the target rank is below the current rank, the current rank is
set directly down to the target rank. Full continent victory bypasses thresholds:
`main:L3384` sets `$C8CF = 5`.

The dormant rebellion code behind `zj`/`zl` checks `$C8CF == 4`, but the normal
`ERBENT1A` dispatcher entrypoint returns before that code.

## Event Text Templates

Evidence: event modules `za..zz`, decoded from ASCII/PETSCII strings and C64
screen-code text in `za`.

Simple-mode port rule: catapult-only and supply-only messages remain in this
corpus, but their state effects are disabled/no-op while supplies and catapults
are out of the ruleset. Some text-bearing modules also have a normal dispatcher
entrypoint that immediately returns in `ERBENT1A`; text presence alone is not
proof of active gameplay behavior.

| Module | C64 visible text template |
| --- | --- |
| `za` | `REPARATUREN AN DEINER HEIMATFESTE KOSTEN DICH [amount] TALER.` |
| `zb` | `DURCH DAS GUTE WETTER ERWIRTSCHAFTEN DEINE BAUERN ZUSATZLICH [amount] TALER` |
| `zc` | `EURE BAUERN BAUEN EIN NEUES DORF!` |
| `zd` | `EINES EURER DORFER WIRD DURCH EINEN WALDBRAND VOLLSTANDIG VERNICHTET!` |
| `ze` | `IHR FINDET EINEN SCHATZ! DIESER ENTHALT [amount] TALER.` |
| `zf` | `IN EINER EURER PROVINZEN BRICHT DIE PEST AUS! [amount] SOLDATEN ERLIEGEN DER KRANKHEIT.` |
| `zg` | `[amount] SOLDATEN SIND MIT DER QUALITAT EURES WEINES UNZUFRIEDEN. SIE DESERTIEREN AUS EURER ARMEE.` |
| `zh` | `BAUERN WOLLEN IN EUREM HEER DIENEN. IHR SCHICKT SIE ZUR AUSBILDUNG IN EURE HEIMATFESTE.` |
| `zi` | `IHR HABT AUF DAS RICHTIGE PFERD GESETZT UND GEWINNT BEIM PFERDERENNEN [amount] TALER.` |
| `zj` | `IN EINER EURER PROVINZEN SIND DIE BAUERN UNZUFRIEDEN MIT EURER STEUERPOLITIK... UND SCHLIESSEN SICH DEN KONIGSTREUEN AN.`; dormant in `ERBENT1A` because `$5504` is `RTS` |
| `zk` | `IN EINER EURER PROVINZEN WUTET EIN DRACHE!!! [amount] SOLDATEN WERDEN VON DEM DRACHEN GEFRESSEN.` |
| `zl` | same visible text shape as `zj`; dormant in `ERBENT1A` because `$5504` is `RTS` |
| `zm` | `SOLDATEN, DIE AUS DER ARMEE VON [name] DESERTIERT SIND, MOCHTEN IN EUREM HEER DIENEN...` |
| `zn` | `IHR ENTDECKT EINE GOLDMINE. DIE AUSBEUTE BETRAGT [amount] TALER.`; dormant in `ERBENT1A` because `$5504` is `RTS` |
| `zo` | `EURE GEGNER SABOTIEREN EINES EURER KATAPULTE.` |
| `zp` | `EINE RATTENPLAGE VERMINDERT EURE VG BESTANDE UM [amount]` |
| `zq` | `IHR FINDET EIN NACHSCHUBLAGER DER KONIGSTREUEN [amount] TALERN` |
| `zr` | `DIEBE BRECHEN IN EURE HEIMATBURG EIN UND STEHLEN [amount] TALER.` |
| `zs` | `BANDITEN PLUNDERN EURE SPEICHER UND ENTWENDEN [amount]` |
| `zt` | `IHR FINDET EINEN DRACHENHORT MIT [amount] TALERN.` |
| `zu` | `BEIM WURFELSPIEL HABT IHR GLUCK UND GEWINNT [amount] TALER.` |
| `zv` | `IHR SPURT BANDITEN AUF UND BESCHLAGNAHMT [amount] TALER` |
| `zw` | `IHR VERHEIRATET EURE TOCHTER. AN MITGIFT MUSST [amount] TALER ZAHLEN.` |
| `zx` | `IHR VERHEIRATET EUREN JUNGSTEN SOHN. AN MITGIFT ERHALTET [amount] TALER.` |
| `zy` | `DIE VERTEIDIGUNGSSTARKE EINER EURER BEFESTIGUNGEN WIRD DURCH EINEN BRAND HERABGESETZT.` |
| `zz` | same visible text and state shape as `zo` |

## Battle Screen Text

Evidence: `kampf` raw strings and battle setup in `kampf:L7F01..L8062`.

Important strings for behavior:

| Context | C64 text |
| --- | --- |
| Royalist attack intro | `DU WIRST VON DEN KONIGSTREUEN ANGEGRIFFEN.` |
| Human defender retreat hint | `FALLS DU DICH WAHREND DES KAMPFES ZURUCKZIEHEN MOCHTEST DRUCKE DIE SPACE-TASTE!` |
| No retreat path | `ALLE FLUCHTWEGE SIND VOM FEIND BESETZT...` |
| Home province defense | `DA DER ANGRIFF DEINER HEIMATPROVINZ GILT... BIS ZUM LETZTEN MANN ZU KAMPFEN.` |
| Attacker retreat summary | `DIE ANGREIFER ZIEHEN SICH ZURUCK !!!` |
| Defender retreat summary | `DIE VERTEIDIGER ZIEHEN SICH ZURUCK !!!` |
| Friendly royalists join | `DIE KONIGSTREUEN AKZEPTIEREN DICH ALS NEUEN BEFEHLSHABER UND SCHLIESSEN SICH DIR AN.` |

The catapult prompt is present in `kampf`, but is outside the current simple
ruleset.

## Finish Screen Mapping

Evidence: `main:L3384`, `main:L339B`, `main:L36ED`, `code:L5960..L59A7`,
`fixtures/main-code-final-screen-loader.json`,
`fixtures/code-l5297-final-result-swap.json`,
`c64-final-loader-bridge-analysis.md`, and files `txtwin1`, `txtwin2`,
`txtwin3`.

`main:L33A0` restores the low-level text-stream reader at `$1D50..$1D52` to
`A0 00 B1`; this is the original `LDY #$00; LDA ($4C),Y` prefix, not a final
loader jump. The final loader uses the result code to load a `TXTWINn` file:

| Result value | Source | Text file | Meaning |
| ---: | --- | --- | --- |
| `1` | `main:L3384` when the continent owner is an AI player | `txtwin1` | a new non-human ruler is crowned after all rivals are subdued |
| `2` | `main:L339B` when royalists own the continent | `txtwin2` | royalists defeat the last rebel baron and restore the legitimate heir |
| `3` | `main:L3384` when the continent owner is a human player | `txtwin3` | the human player is crowned ruler |
| `4` | `main:L36ED` abort/exit path | no `TXTWIN` load; `code:L5960` skips text load |

The full prose is stored in the `txtwin*` files. The port should treat these as
finish-screen IDs with localized PL/EN text, not as dynamically generated rules.
Current C64 evidence shows `txtwin2` as the royalist victory ending after owner
`0` wins the continent. It is not evidence for a separate timed "king returns"
stalemate breaker in the simple `ERBENT1A` ruleset.

PC-version note: a later PC ruleset may have used a "king returns" mechanic as
a stalemate breaker. That belongs to an extended-rules/PC-compatibility variant
until C64 code or a C64 transcript proves an equivalent timed intervention.

Fixture coverage:

- `main:L3384` writes `$CA75 = 3` for a human continent winner and `$CA75 = 1`
  for an AI continent winner;
- `main:L3384` promotes `$C8CF + player` to `5`;
- `main:L339B` writes `$CA75 = 2` for a royalist continent win;
- `main:L36ED` writes `$CA75 = 4` for abort/exit and clears `$C9FB..$CA09`;
- every main result path patches `$1D50..$1D52` to `A0 00 B1`;
- `code:L5960` calls `code:L5305 -> code:L5297`; the page swap moves `$CA75`
  to `$4DF5`;
- `code:L5960` maps loader result `1/2/3` to `TXTWIN1/2/3` by writing the ASCII
  digit to `$59D7`, and skips this path for result `4`.

## Still Required

- Add explicit PL/EN localization keys for every template above.
