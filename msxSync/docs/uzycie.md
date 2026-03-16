# MSX Sync - Instrukcja użycia

## 1. Wymagania
- Docker + Docker Compose.
- Dostęp do katalogu repo `msxSync`.

## 2. Start usługi
W katalogu projektu uruchom:

```bash
docker compose up --build -d
```

UI i API będą dostępne pod:
- `http://localhost:8788`

Sprawdzenie health:

```bash
curl http://localhost:8788/api/health
```

Oczekiwany wynik:

```json
{"ok":true}
```

## 3. Praca w UI (krok po kroku)
1. Otwórz `http://localhost:8788`.
2. Kliknij pole wyboru pliku i wskaż audio (`MP3/WAV/FLAC`).
3. Kliknij `Kompiluj Sync`.
4. Poczekaj aż status zmieni się na `done`.
5. Odsłuchaj utwór w playerze i obejrzyj wizualizację.
6. Użyj suwaków:
   - `LOW/MID/HIGH Gain`
   - `Beat Boost`
   - `MID Chaos`
   - `MID Speed`
7. (Opcjonalnie) włącz/wyłącz `Pokaż klasyczny podgląd pod sceną`.

## 4. Zapis wyników
Po statusie `done` aktywują się dwa linki:
- `Pobierz track.sync.json`
- `Pobierz audio źródłowe`

Kliknięcie pobiera pliki lokalnie przez przeglądarkę.

## 5. Gdzie backend trzyma pliki
Wyniki jobów są zapisywane trwałe na dysku hosta:

- `apps/sync-server/data/jobs/<jobId>/track.sync.json`
- `apps/sync-server/data/jobs/<jobId>/<oryginalna-nazwa-audio>`
- `apps/sync-server/data/jobs/<jobId>/job.json`

## 6. Logi i zatrzymanie
Podgląd logów:

```bash
docker compose logs -f sync-server
```

Zatrzymanie:

```bash
docker compose down
```

Zatrzymanie + usunięcie kontenera i wolumenów Compose:

```bash
docker compose down -v
```
