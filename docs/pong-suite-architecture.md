# Pong Suite Architecture (SofaArcade)

## Cel
Zaprojektować jedną wspólną, deterministyczną logikę gry (`core-sim`) i na niej zbudować:
- Pong (1-4 graczy),
- Squash (odbicia od ściany),
- mutatory przełączalne per mecz (np. strzelanie, magnes).

Zakres tego dokumentu: tylko gameplay/runtime gry. Bez web-portalu, bez netplay.

## Założenia projektowe
- Jedno SSOT dla stanu symulacji.
- Zero logiki sterowania zakodowanej inline w TS sceny: mapowania wejścia w `*.input-profile.json`.
- Fail-fast na niepoprawnym stanie i konfiguracji.
- Czysta separacja: logika gry oddzielona od renderu/audio/UI.
- Determinizm kroku symulacji (pod przyszły netplay).

## Produkty gry
1. `pong-classic`
- 1v1 lub 2v2.
- W trybie 2v2 każda strona ma 2 paletki (offset X, wspólna punktacja drużyny).

2. `squash`
- Odbijanie od ściany po jednej stronie.
- Wynik typu rally/best.

3. `mutators`
- Rozszerzenia nakładane na tryb bazowy:
  - `shooting` (pociski modyfikujące paletki),
  - `magnet` (czasowe przyciąganie/zakrzywianie toru),
  - kolejne jako osobne moduły.

## Proponowana struktura modułów
Docelowy pakiet: `games/pong-suite` (nazwa robocza).

```
games/pong-suite/src/
  game/
    constants.ts
    types.ts
    state.ts
    sim.ts
    collision.ts
    scoring.ts
    modes/
      mode.ts
      pong-classic.ts
      squash.ts
    mutators/
      mutator.ts
      shooting.ts
      magnet.ts
  scenes/
    pong-suite-scene.ts
  profiles/
    pong-suite.keyboard-gamepad.input-profile.json
    pong-suite.keyboard-only.input-profile.json
```

## SSOT: stan i konfiguracja
`GameState` (jedyny stan symulacji) powinien zawierać:
- `match`: tryb, faza (`menu | serve | rally | point | gameover`), czas.
- `teams`: 2 drużyny z wynikiem i listą paletek.
- `balls`: jedna lub więcej piłek.
- `projectiles`: pociski mutatora.
- `activeMutators`: instancje mutatorów z własnym stanem.
- `rngSeed`: seed do deterministycznych losowań.

`MatchConfig` (jedno źródło konfiguracji meczu):
- `modeId`,
- `playerCount`,
- `winTarget`/`rallyRules`,
- `physics` (speedy, friction, paddle size, bounds),
- `enabledMutators`.

## Kontrakt trybu gry
Każdy tryb implementuje wspólny interfejs:

```ts
export interface ModeRules {
  readonly id: 'pong-classic' | 'squash';
  setupInitialState(config: MatchConfig): GameState;
  stepPrePhysics(state: GameState, dtMs: number): GameState;
  resolveScoring(state: GameState): GameState;
  isMatchFinished(state: GameState): boolean;
}
```

To trzyma różnice reguł w jednym miejscu i bez warunków rozsianych po całym `tick`.

## Kontrakt mutatora
Mutatory działają jak jawne pluginy do kroku symulacji:

```ts
export interface Mutator {
  readonly id: string;
  onStepStart(state: GameState, dtMs: number): GameState;
  onPreCollision(state: GameState, dtMs: number): GameState;
  onPostCollision(state: GameState, dtMs: number): GameState;
  onPointScored(state: GameState): GameState;
}
```

Kolejność hooków jest stała i globalna (SSOT), bez dynamicznego przełączania strategii.

## Pipeline jednego kroku symulacji
`sim.step(state, inputFrame, dtMs)`:
1. Walidacja wejścia i stanu.
2. `mode.stepPrePhysics`.
3. `mutator.onStepStart`.
4. Integracja ruchu paletek.
5. Integracja ruchu piłek/pocisków.
6. Kolizje (piłka-paleta, piłka-ściana, pocisk-paleta).
7. `mutator.onPostCollision`.
8. Punktacja i przejścia faz (`serve`, `point`, `gameover`).
9. `mode.resolveScoring`.
10. Emisja zdarzeń domenowych (`ball_hit`, `point_scored`, `mutator_triggered`).

## Model 1-4 graczy
- 1 gracz: AI lub sparing wall (zależnie od trybu).
- 2 graczy: klasyczne 1v1.
- 3/4 graczy: 2 drużyny, 2 paletki po stronie.
- Wariant 3 graczy: jedna drużyna ma 2 paletki, druga 1 (balans przez parametry paletek).

W trybach drużynowych paletki mają:
- wspólną stronę boiska,
- stały offset X,
- oddzielne wejścia sterujące,
- wspólny wynik drużyny.

## Integracja z istniejącym launcherem
- Dodać 3. pozycję gry do `GAME_OPTIONS`.
- Dodać `sceneKey` i lazy import w `scene-loader`.
- Dodać profile wejścia pod nowe akcje Pong.
- Phaser scena tylko renderuje i mapuje `input -> inputFrame -> sim.step`.

## Plan wdrożenia (milestone)
1. Milestone A: `pong-classic` 2P bez mutatorów.
2. Milestone B: tryb 2v2 (dwie paletki na stronę).
3. Milestone C: `squash`.
4. Milestone D: `shooting` mutator.
5. Milestone E: `magnet` mutator.
6. Milestone F: balans + juice + final UX.

## Testy obowiązkowe
- Unit testy logiki czystej (`sim`, `collision`, `scoring`, `modes`, `mutators`).
- Snapshot testy deterministyczne: ten sam seed + input => ten sam wynik.
- Testy reguł trybów (Pong vs Squash).
- Testy mutatorów w izolacji.
