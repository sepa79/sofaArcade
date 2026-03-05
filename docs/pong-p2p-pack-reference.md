# Pong P2P Pack Reference (source example)

## Źródło
Referencja pochodzi z:
- `/mnt/c/Users/Sepa/Downloads/Skippy/pong_p2p_pack/index.html`

Cel tego pliku: zachować przykład logiki do portu na silnik SofaArcade (bez kopiowania 1:1 monolitu HTML).

## Co warto przenieść
1. Host-authoritative model symulacji (na później, do netplay).
2. Szybki, czytelny loop `tick(now)` z podziałem:
- input,
- movement,
- collisions,
- scoring,
- render.
3. Tryby gry: `CLASSIC`, `TWO`, `SQUASH`, `INV`.
4. Mechaniki:
- spin po miejscu trafienia paletki,
- przyspieszanie piłki po odbiciach,
- proste mutatory (`SHOOT`, `SLOW`, `MULTI`, itp.).

## Czego nie przenosimy 1:1
1. Monolityczne `index.html` z całą logiką i UI.
2. Ręczna sygnalizacja WebRTC (offer/answer copy-paste).
3. Inline konfiguracja z formularza HTML jako jedyne źródło.

## Minimalny wyciąg protokołu (przykład)
W oryginale DataChannel używa wiadomości:

```json
{ "t": "cfg", "v": 1, "cfg": { "...": "..." } }
{ "t": "state", "v": 1, "s": { "...": "..." }, "ts": 12345.6 }
{ "t": "input", "v": 1, "seq": 42, "i": { "up": true, "down": false, "smash": false, "fire": true }, "ts": 12345.6 }
{ "t": "action", "v": 1, "a": "serveReq", "ts": 12345.6 }
```

Na teraz to tylko materiał referencyjny. Implementacja SofaArcade idzie bez netplay.

## Minimalny wyciąg kroku gry (pseudokod)

```ts
function step(state: GameState, input: InputFrame, dtMs: number): GameState {
  state = expireEffects(state, dtMs);
  state = applyPaddleInput(state, input, dtMs);
  state = maybeSpawnMutatorObjects(state, dtMs);
  state = moveProjectiles(state, dtMs);
  state = moveBalls(state, dtMs);
  state = resolveBallWallCollisions(state);
  state = resolveBallPaddleCollisions(state);
  state = resolveProjectilePaddleCollisions(state);
  state = resolveScoring(state);
  return state;
}
```

To jest wzorzec do portu, ale z zachowaniem naszych zasad:
- SSOT,
- fail-fast,
- małe moduły odpowiedzialności.

## Proponowany mapping do SofaArcade
1. `game/state.ts`:
- `GameState`, `MatchConfig`, `TeamState`, `PaddleState`, `BallState`.

2. `game/modes/*`:
- osobne reguły punktacji i geometrii.

3. `game/mutators/*`:
- osobne moduły do `shooting`, `magnet`, itd.

4. `scenes/pong-suite-scene.ts`:
- tylko render + audio + przekazanie inputu do `sim.step`.
