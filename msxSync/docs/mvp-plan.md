# MSX Sync MVP Plan

## Cel MVP
Mały web UI: upload utworu, backend kompiluje `track.sync.json`, frontend od razu odtwarza audio i pokazuje proste efekty (reakcja na beat + pasma energii).

## Założenia techniczne
- Backend wyłącznie w Dockerze.
- Port hosta: `8788` (nie używamy `8080`).
- Brak CORS: UI i API serwowane z tego samego originu.
- Wejście: MP3/WAV/FLAC.
- Wyjście: schema `1.0` zgodna z `audio-sync.md`.

## Checklist
- [x] Utworzyć strukturę projektu `apps/sync-server`.
- [x] Dodać konteneryzację (`Dockerfile`, `docker-compose.yml`) z `ffmpeg`.
- [x] Endpoint uploadu audio `POST /api/sync/jobs`.
- [x] Endpoint statusu joba `GET /api/sync/jobs/:jobId`.
- [x] Endpoint wyniku `GET /api/sync/jobs/:jobId/result`.
- [x] Endpoint audio do odsłuchu `GET /api/sync/jobs/:jobId/audio`.
- [x] Implementacja analizy v0: BPM + beat/bar + onset + curves (low/mid/high/rms).
- [x] Render web preview (Canvas): słupki pasm + beat flash.
- [x] Dodać suwaki czułości (wizual: low/mid/high/beat + chaos/speed mid).
- [x] Dodać klasyczny podgląd pod sceną retro (przełączany).
- [x] Dodać w UI linki do pobrania `track.sync.json` i audio źródłowego.
- [x] Dodać sekcje (`sections[]`) i prostą detekcję granic segmentów.
- [x] Utrwalić joby na dysku po restarcie.
- [x] Dodać test golden-file na realnym MP3 z `~/light80`.

## Jak uruchomić MVP
1. `docker compose up --build`
2. Otwórz `http://localhost:8788`
3. Wgraj MP3 (np. z `~/light80/games/pixel-invaders/src/assets/game-bgm.mp3`)

## Status wdrożenia
- Start: 2026-03-04
- Etap: backend + UI preview działający lokalnie, z suwakami, sekcjami i trwałością jobów.

## Dokumentacja użytkowania
- Instrukcja: `docs/uzycie.md`
- AI runtime guide (EN): `docs/ai-sync-runtime-guide.md`
