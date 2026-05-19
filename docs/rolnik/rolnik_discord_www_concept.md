# Rolnik Discord + WWW Concept

## Purpose

This document captures the working concept for turning Rolnik into an async social strategy game that can be played through Discord and, later, a normal web UI.

This is not a replacement for `rolnik_design_ssot.md`.
The SSOT still owns the v1 gameplay rules.

This document describes:

- how to expose Rolnik as a multiplayer service
- how Discord should act as a social client
- how a web UI can use the same engine
- how agents can test the full game loop
- how Skippy-style commentary fits without becoming game logic

## Core Direction

Rolnik should continue as the first gameplay testbed.

The reason is practical: Rolnik already has a clear seasonal loop, explicit goods, farms, players, tenders, auctions, and a manageable decision space.

The first goal is not realtime multiplayer.
The first goal is an async multiplayer game service where several players exist in one shared game state and act through stable commands.

Target shape:

```text
Browser / SofaArcade UI
Discord bot
Agent test client
WWW dashboard
        |
        v
Rolnik HTTP service
        |
        v
Rolnik TS core
```

The game core must stay independent from Phaser, Discord, HTTP, and rendering.

## Current State

Current Rolnik in SofaArcade is a browser-only Phaser prototype:

- Vite app
- Phaser scene UI
- in-memory state in the browser
- pure-ish TS game logic under `games/rolnik/src/game/*`
- no backend
- no persistence
- no network multiplayer

This is a good starting point, but the core needs to become a reusable engine.

## Design Principle

Use one game engine and multiple clients.

Discord should not be a second implementation of the rules.
WWW should not be a second implementation of the rules.
Agents should not click UI when they can call the same API as the clients.

The split should be:

- **Rolnik TS core**: state, rules, validation, actions, events, season resolution.
- **Rolnik service**: persistence, HTTP API, game instances, auth/dev tools.
- **Discord bot**: commands, buttons, public events, auctions, notifications, Skippy commentary.
- **WWW client**: comfortable planning UI, farm dashboard, market view, history.
- **Agent client**: deterministic end-to-end tests through HTTP.
- **Renderer**: optional farm image generation from assets for Discord and WWW.

## First Multiplayer Definition

First multiplayer means:

- one shared game state
- 2 to 4 players in that state
- each player has a farm
- actions are submitted through an API
- season/tick resolution is deterministic
- events are logged

It does not initially mean:

- realtime sockets
- authoritative realtime movement
- browser-to-browser sync
- matchmaking

For Rolnik, async turn-based multiplayer is enough and fits the design better.

## Core API Shape

Minimal service endpoints:

```http
POST /games
GET /games/{gameId}
GET /games/{gameId}/players/{playerId}/view
POST /games/{gameId}/players/{playerId}/actions
POST /games/{gameId}/tick
GET /games/{gameId}/events
```

Suggested dev/test endpoints:

```http
POST /dev/games/{gameId}/reset
POST /dev/games/{gameId}/seed
POST /dev/games/{gameId}/actions?dryRun=true
GET /dev/games/{gameId}/debug
```

The API should support deterministic seeds from the start.

## Core TS Contracts

The game core should expose a small set of stable functions/types:

```ts
createGame(options): GameState
getPublicGameView(state): PublicGameView
getPlayerView(state, playerId): PlayerView
getAvailableActions(state, playerId): PlayerAction[]
applyPlayerAction(state, playerId, action): ApplyActionResult
resolveSeason(state): ResolveSeasonResult
```

Important data contracts:

- `GameState`
- `PlayerState`
- `PlayerView`
- `PublicGameView`
- `PlayerAction`
- `GameEvent`
- `SeasonSummary`
- `AuctionState`
- `TenderState`

`PlayerView` should be the main bridge contract for Discord and WWW.

## Discord Role

Discord is the social layer.

It should be good at:

- quick actions
- public announcements
- auctions
- tender events
- reminders
- funny summaries
- farm image snapshots
- social pressure

Discord should not be forced to show every detail.
Detailed planning can move to WWW later.

Useful Discord commands:

```text
/rolnik status
/rolnik farm
/rolnik actions
/rolnik end_turn
/rolnik market
/rolnik auction
/rolnik help
```

Discord buttons should map to `PlayerAction` objects from the core.

## Auction Flow

Land auctions are a strong Discord-native mechanic.

Use one bot message per auction and edit it in place.

Example controls:

```text
[Bid +10] [Bid +25] [Bid +50] [All in] [Pass] [Info]
```

Rules:

- one auction at a time
- public current high bid
- private/ephemeral cash validation if possible
- anti-snipe timer extension
- bids cannot exceed available cash
- pass can be final for the current auction
- final result is logged as a `GameEvent`

The auction should create public drama without spamming the channel.

## WWW Role

WWW is the office/dashboard.

It should be good at:

- farm overview
- planning several seasons ahead
- field plans
- building upgrades
- goods and storage
- market tables
- auction history
- player comparison
- event history
- generated farm images

WWW can be added after the HTTP service exists.
It should use the same `PlayerView` and `PlayerAction` contracts as Discord.

## Farm Images

Farm images can be generated from assets and posted to Discord.

The renderer should compose:

- season background
- player farm layout
- fields
- buildings
- animals
- weather
- warnings
- key resources
- owner label

This can be done with a Node renderer using `canvas` or `sharp`.

The image should be a readable report, not only decoration.
It should answer:

- what does this farm have?
- what is currently dangerous?
- what is about to pay off?
- what is about to rot, fail, or bankrupt the player?

## Skippy Commentary

Skippy should be a commentary engine, not game logic.

Input:

- event type
- actor/player
- target
- numeric context
- severity
- recent history

Output:

- short public comment
- optional private comment
- optional season summary text

Commentary should be data-driven:

```text
skippy/
  epithets.json
  insults.json
  domains/rolnik.json
  domains/c64_vs_atari.json
  events/auction.json
  events/tender.json
  events/farm_fail.json
  events/season_summary.json
```

Generation model:

```text
event type
+ tone
+ target
+ template
+ epithet pack
+ domain reference
+ cooldown / no-repeat filter
```

LLM can later help generate or vary lines, but runtime should work without LLM.

## Agents And Testing

The HTTP service should be testable by agents from the beginning.

Agent test flow:

1. create a 4-player game
2. inspect public and per-player views
3. submit actions for each player
4. run a tick or season resolution
5. inspect events
6. run a summer tender
7. run a land auction
8. assert cash, goods, ownership, and event log

Agent-friendly features:

- deterministic seed
- full event log
- snapshot before and after action
- dry-run validation
- fast-forward tick
- debug view
- reset endpoint in dev mode

This is intentionally similar to real IT agent workflows:

- understand intent
- validate permissions
- run deterministic tools
- record audit trail
- summarize outcome

## LLM Usage

LLM should not own core rules.

Good LLM uses:

- intent routing for natural language Discord messages
- summaries of season events
- Skippy text generation or variation
- explaining what happened to a player
- later: NPC manager flavor, rumors, reports

Bad LLM uses:

- calculating economy
- deciding auction winners
- mutating state directly
- bypassing validation
- storing unstructured source of truth

The rule:

```text
LLM interprets and narrates.
Code validates and mutates.
```

## Relationship To Caravan Wars

If this format works for Rolnik, the same architecture can support Caravan Wars.

Rolnik tests:

- async ticks
- Discord public events
- WWW dashboard
- generated images
- auctions
- social pressure
- Skippy commentary

Caravan Wars can later reuse the pattern with a different domain:

- caravans
- routes
- rumors
- incomplete information
- per-player map projection
- trade and ambush risk

Rolnik is the better first test because it has a simpler, more concrete loop.
Caravan Wars can be the richer second project if the social format proves fun.

## Implementation Start Plan

The next implementation pass should start with backend and SofaArcade WWW integration before Discord.

Priority order:

1. Backend service
2. SofaArcade web UI integration
3. Agent-driven gameplay tests through HTTP
4. Discord bot

Discord should be delayed until the backend contracts and agent test loop prove that the full gameplay can be driven without Phaser UI clicks.

## Backend Service

Create a new service package:

```text
apps/rolnik-service
```

Responsibilities:

- import the Rolnik TS core
- own game instances
- validate game/player/session ownership
- expose HTTP API
- persist game snapshots and event logs
- provide dev/test endpoints for deterministic agent testing

The service should not duplicate game rules.
All rule decisions must go through Rolnik core functions such as `applyPlayerAction` and `resolveSeason`.

Recommended first stack:

- Node.js
- TypeScript
- HTTP API
- in-memory store for the first slice
- SQLite or PostgreSQL once the API contract settles

Use PostgreSQL for a server deployment if the instance is expected to survive restarts and host multiple games.
SQLite is acceptable for local/dev and early private testing.

## Persistence Shape

Keep persistence simple at first.
Do not normalize the full farm economy into relational tables before the rules stabilize.

Suggested storage model:

```text
games
  gameId
  mode
  stateJson
  createdAt
  updatedAt

game_events
  eventId
  gameId
  sequence
  eventJson
  createdAt

player_seats
  gameId
  playerId
  seatIndex
  displayName
  claimTokenHash
  discordUserId
  joinedAt

sessions
  sessionId
  tokenHash
  createdAt
  expiresAt
```

`GameState` remains the core state SSOT.
`game_events` exists for audit, replay inspection, summaries, and agent assertions.

## Web UI And Sessions

WWW stays inside SofaArcade/web portal.
It becomes a Rolnik client, not a second runtime.

The web UI should call the Rolnik service using the same `PlayerView` and `PlayerAction` contracts intended for Discord.

Start without full username/password accounts.
Use claimable seats and session tokens:

1. Host creates a Rolnik game.
2. Service returns `gameId` and a host session token.
3. Host shares a join link.
4. Player claims a seat with a display name.
5. Browser stores a session token.
6. Web UI calls `/players/me/view` and submits actions as that seat.

Support modes:

- `solo`: local or single-seat service game
- `private-online`: join-link multiplayer
- `discord`: Discord identity maps to player seats

Do not reuse the phone-controller signaling model as the source of truth for Rolnik sessions.
Phone controller pairing and async game ownership are separate concerns.

## Agent Test Integration

Agents should test complete gameplay through HTTP as soon as the backend exists.

Required test features:

- deterministic seed
- create/reset game
- inspect public game view
- inspect per-player views
- submit actions
- dry-run action validation
- advance tick/season
- inspect event log
- debug view in dev mode

Target agent flow:

```text
create 4-player game
inspect player views
submit actions for each player
advance season
inspect events
run Summer Trade
run 3 crop tenders
run land auction
assert cash, goods, field ownership, and event log
```

The important rule:

```text
Agents test the same HTTP API as WWW and Discord.
They do not click Phaser canvas for gameplay validation.
```

## Docker And Deployment

Add containers after the first HTTP slice exists, or earlier if server deployment starts immediately.

Recommended compose services:

```text
rolnik-service
web-portal
postgres
```

Later:

```text
rolnik-discord-bot
```

Two acceptable deployment shapes:

- one process initially: HTTP service plus Discord adapter in the same app, with separate modules
- two processes later: `rolnik-service` and `rolnik-discord-bot`

Prefer two processes once Discord interactions become non-trivial.
The Discord bot should be an adapter over HTTP/service contracts, not a rules host.

## Discord Bot Later

Build Discord after backend, web UI, and agent test flow.

The bot should:

- map Discord users to `player_seats.discordUserId`
- translate slash commands and buttons into `PlayerAction`
- call Rolnik service
- render status, farm snapshots, auctions, reminders, and summaries
- keep auction messages edited in place where possible

The bot should not:

- calculate economy
- decide auction winners locally
- mutate game state directly
- own separate action validation

## MVP Proposal

First serious milestone:

- extract/clean Rolnik TS core
- define `PlayerAction`, `PlayerView`, `GameEvent`
- implement game creation for 2 to 4 players
- implement season advance
- implement minimal farm status and end-turn flow
- expose HTTP API
- add agent test script against HTTP API

Second milestone:

- Discord bot can show status and farm image
- players can end turn from Discord
- bot posts season summary

Third milestone:

- implement Summer Trade
- implement 3 AI tenders
- implement land auction as Discord interactive message

Fourth milestone:

- basic WWW dashboard using the same API

## Main Risk

The main risk is not technology.

The main risk is whether the loop is fun enough that players want to come back after the next tick.

The early prototype should optimize for proving:

- auctions create drama
- farm images are readable and funny
- season summaries make people react
- players understand their next decision
- consequences are visible

Do not overbuild infrastructure before this is proven.
