# Pong / Squash + Online P2P (lokalny pakiet)

## Co jest w środku
- `index.html` — aktualna wersja (Pong + tryby + Online P2P WebRTC)
- `previous_versions/` — starsze pliki, gdybyś chciał porównać
- `run_server.bat` / `run_server.sh` — szybkie odpalenie lokalnego serwera HTTP

## Jak uruchomić lokalnie (ważne: nie otwieraj jako file://)
### Windows
1. Upewnij się, że masz zainstalowanego Pythona (python w PATH).
2. Kliknij `run_server.bat`
3. Wejdź w przeglądarce: http://localhost:8000/
4. Otwórz `index.html`

### Linux / macOS
1. W terminalu:
   - `chmod +x run_server.sh`
   - `./run_server.sh 8000`
2. Wejdź w przeglądarce: http://localhost:8000/
3. Otwórz `index.html`

## Jak sprawdzić online P2P (bez serwera gry)
To jest WebRTC P2P z “ręczną” sygnalizacją copy/paste (Offer/Answer).

### Test na jednym kompie (w dwóch kartach)
1. Otwórz `index.html` w dwóch kartach.
2. W jednej: wybierz HOST → wygeneruj Offer → skopiuj.
3. W drugiej: JOIN → wklej Offer → wygeneruj Answer → skopiuj.
4. W pierwszej: wklej Answer → Apply.
5. Jak się połączy, JOIN steruje swoim graczem.

### Test w LAN (2 kompy w tym samym Wi‑Fi)
- Host odpala serwer na swoim PC.
- Druga osoba wchodzi na: `http://IP_HOSTA:8000/`
- Dalej jak wyżej (Offer/Answer).

## Jeśli nie działa przez internet (dwie różne sieci)
To bywa kwestia NAT/CGNAT i czasem wymaga TURN (relay). Ten pakiet jest “na start”: sprawdź najpierw czy w ogóle działa w LAN / dwóch kartach.

Powodzenia, małpo.
