import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { c64FortificationLevelForFortificationLevel, c64TerrainIdForTerrainId } from '../../src/game/c64-battle';
import {
  runC64RandomEvent,
  type C64RandomEventId
} from '../../src/game/c64-events';
import { DEFAULT_GAME_CONFIG } from '../../src/game/constants';
import { nextRngByte, normalizeRngSeed } from '../../src/game/rng';
import { createInitialState } from '../../src/game/state';
import type { GameConfig, GameState, PlayerId } from '../../src/game/types';
import { requireRawModulePath, verifyC64Baseline } from './baseline';
import { hexAddress, hexByte, readSnapshot, requireEqualBytes } from './bytes';
import { runViceMonitor, writeMonitorCommands } from './vice';

interface EventScenario {
  readonly eventId: C64RandomEventId;
  readonly seed: number;
  readonly year: number;
}

interface EventPaths {
  readonly deserters: string;
  readonly flags: string;
  readonly fortifications: string;
  readonly moneyHigh: string;
  readonly moneyLow: string;
  readonly moneyMiddle: string;
  readonly owners: string;
  readonly rngCount: string;
  readonly soldiersHigh: string;
  readonly soldiersLow: string;
  readonly soldiersMiddle: string;
  readonly villages: string;
}

const EVENT_IDS: ReadonlyArray<C64RandomEventId> = Array.from(
  { length: 26 },
  (_, index) => `z${String.fromCharCode(0x61 + index)}` as C64RandomEventId
);
const EVENT_RNG_TAPE_ADDRESS = 0x7000;
const EVENT_RNG_TAPE_LENGTH = 64;
const EVENT_CONFIG: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  randomEventsEnabled: true
};

function eventYear(eventId: C64RandomEventId): number {
  switch (eventId) {
    case 'zt':
      return 12;
    case 'zv':
      return 5;
    case 'zw':
    case 'zx':
      return 3;
    default:
      return 4;
  }
}

function selectorSeed(eventIndex: number): number {
  for (let seed = 1; seed <= 1_000_000; seed += 1) {
    const gate = nextRngByte(normalizeRngSeed(seed));
    const selector = nextRngByte(gate.rngState);
    if (gate.byte >= 0x10 && selector.byte % 0x1a === eventIndex) {
      return seed;
    }
  }
  throw new Error(`Could not find deterministic RNG seed for C64 event index ${eventIndex}.`);
}

const EVENT_SCENARIOS: ReadonlyArray<EventScenario> = EVENT_IDS.map((eventId, index) => ({
  eventId,
  seed: selectorSeed(index),
  year: eventYear(eventId)
}));

function scenarioPaths(directory: string, eventId: C64RandomEventId): EventPaths {
  const prefix = join(directory, eventId);
  return {
    deserters: `${prefix}-deserters.bin`,
    flags: `${prefix}-flags.bin`,
    fortifications: `${prefix}-fortifications.bin`,
    moneyHigh: `${prefix}-money-high.bin`,
    moneyLow: `${prefix}-money-low.bin`,
    moneyMiddle: `${prefix}-money-middle.bin`,
    owners: `${prefix}-owners.bin`,
    rngCount: `${prefix}-rng-count.bin`,
    soldiersHigh: `${prefix}-soldiers-high.bin`,
    soldiersLow: `${prefix}-soldiers-low.bin`,
    soldiersMiddle: `${prefix}-soldiers-middle.bin`,
    villages: `${prefix}-villages.bin`
  };
}

function playerNumber(playerId: PlayerId | null): number {
  return playerId === null ? 0 : Number(playerId.slice(1));
}

function provinceNumber(provinceId: string): number {
  const match = /^province-(\d+)$/.exec(provinceId);
  if (match === null) {
    throw new Error(`Invalid C64 event province id ${provinceId}.`);
  }
  return Number(match[1]);
}

function createEventState(scenario: EventScenario): GameState {
  const initial = createInitialState(1, EVENT_CONFIG);
  const playerIds = initial.players.map((player) => player.id);
  const provinces = initial.map.provinces.map((province, index) => {
    const ownerId = playerIds[index % playerIds.length];
    if (ownerId === undefined) {
      throw new Error(`Missing event owner for province index ${index}.`);
    }
    const isPrimaryP1Province = ownerId === 'p1' && index === 0;
    const isSoldierP1Province = ownerId === 'p1' && index === 4;
    return {
      ...province,
      ownerId,
      terrainId: ownerId === 'p1' ? 'forest' as const : province.terrainId,
      villages: 4,
      soldiers: isSoldierP1Province ? 100 : 10,
      fortificationLevel: isPrimaryP1Province
        ? 'fort' as const
        : isSoldierP1Province
          ? 'castle' as const
          : 'none' as const
    };
  });
  const players = initial.players.map((player, index) => {
    const home = provinces.find((province) => province.ownerId === player.id);
    if (home === undefined) {
      throw new Error(`Missing C64 event home for ${player.id}.`);
    }
    return {
      ...player,
      money: index === 0 ? 100 : 20,
      homeProvinceId: home.id
    };
  });

  return {
    ...initial,
    seed: scenario.seed,
    rngState: normalizeRngSeed(scenario.seed),
    phase: 'turn',
    map: { ...initial.map, provinces },
    players,
    activePlayerId: 'p1',
    turnStep: 'new-month',
    turnNumber: (scenario.year - 1) * 12 + 7,
    c64: {
      ...initial.c64,
      ca61Bytes: Array<number>(players.length + 1).fill(0),
      calendar: {
        ...initial.c64.calendar,
        year: scenario.year,
        month: 7,
        monthWeatherPending: false
      },
      deserterSoldiers: 10,
      deserterOwnerId: 'p2',
      playerMemory: initial.c64.playerMemory.map((memory, index) => ({
        ...memory,
        rank: index === 0 ? 0 : 1
      }))
    }
  };
}

function lowByte(value: number): number {
  return value & 0xff;
}

function middleByte(value: number): number {
  return Math.floor(value / 0x100) & 0xff;
}

function highByte(value: number): number {
  return Math.floor(value / 0x10000) & 0xff;
}

function monitorBytes(bytes: ReadonlyArray<number>): string {
  return bytes.map(hexByte).join(' ');
}

function bsave(path: string, start: number, end: number): string {
  return `bsave "${path}" 0 ${hexAddress(start)} ${hexAddress(end)}`;
}

function rngTape(seed: number): Uint8Array {
  let rngState = normalizeRngSeed(seed);
  return Uint8Array.from({ length: EVENT_RNG_TAPE_LENGTH }, () => {
    const next = nextRngByte(rngState);
    rngState = next.rngState;
    return next.byte;
  });
}

function ownerBytes(state: GameState): ReadonlyArray<number> {
  return state.map.provinces.map((province) =>
    province.ownerId === 0 ? 0 : playerNumber(province.ownerId)
  );
}

function provinceBytes(
  state: GameState,
  value: (province: GameState['map']['provinces'][number]) => number
): ReadonlyArray<number> {
  return state.map.provinces.map(value);
}

function playerBytes(
  state: GameState,
  value: (money: number) => number
): ReadonlyArray<number> {
  return state.players.map((player) => value(player.money));
}

function commandsForScenario(
  scenario: EventScenario,
  paths: EventPaths,
  tapePath: string,
  mainPath: string,
  sysPath: string,
  eventPath: string
): ReadonlyArray<string> {
  const state = createEventState(scenario);
  const provinceCount = state.map.provinces.length;
  const playerCount = state.players.length;
  const counts = state.players.map((player) =>
    state.map.provinces.filter((province) => province.ownerId === player.id).length
  );
  const homes = state.players.map((player) => {
    if (player.homeProvinceId === null) {
      throw new Error(`Missing C64 event home for ${player.id}.`);
    }
    return provinceNumber(player.homeProvinceId);
  });

  writeFileSync(tapePath, rngTape(scenario.seed));
  return [
    `bload "${tapePath}" 0 ${hexAddress(EVENT_RNG_TAPE_ADDRESS)}`,
    `bload "${mainPath}" 0 3000`,
    `bload "${sysPath}" 0 9400`,
    `bload "${eventPath}" 0 5500`,
    '> 218b 4c 00 c1',
    '> c100 ad 00 70 ee 01 c1 d0 03 ee 02 c1 ee fd c0 d0 03 ee fe c0 60',
    '> c101 00 70',
    'f c0fd c0fe 00',
    'f c400 ca80 00',
    `> c5da ${monitorBytes([0, ...ownerBytes(state)])}`,
    `> c576 ${monitorBytes([0, ...provinceBytes(state, (province) => c64TerrainIdForTerrainId(province.terrainId))])}`,
    `> c63e ${monitorBytes([0, ...provinceBytes(state, (province) => c64FortificationLevelForFortificationLevel(province.fortificationLevel))])}`,
    `> c6a2 ${monitorBytes([0, ...provinceBytes(state, (province) => province.villages)])}`,
    `> c706 ${monitorBytes([0, ...provinceBytes(state, (province) => lowByte(province.soldiers))])}`,
    `> c76a ${monitorBytes([0, ...provinceBytes(state, (province) => middleByte(province.soldiers))])}`,
    `> c7ce ${monitorBytes([0, ...provinceBytes(state, (province) => highByte(province.soldiers))])}`,
    `> c8bb ${monitorBytes([0, ...playerBytes(state, lowByte)])}`,
    `> c8c0 ${monitorBytes([0, ...playerBytes(state, middleByte)])}`,
    `> c8c5 ${monitorBytes([0, ...playerBytes(state, highByte)])}`,
    `> c8b5 ${monitorBytes([0, ...counts])}`,
    `> c8cf ${monitorBytes([0, ...state.c64.playerMemory.map((memory) => memory.rank)])}`,
    `> c8fb ${monitorBytes([0, ...homes])}`,
    `> ca61 ${monitorBytes(state.c64.ca61Bytes)}`,
    `> c9d9 ${monitorBytes(Array<number>(playerCount + 1).fill(0))}`,
    `> c8a1 ${hexByte(provinceCount)}`,
    `> c896 ${hexByte(playerCount)}`,
    `> c8a2 ${hexByte(scenario.year)}`,
    '> c8a3 07',
    '> c8a4 07',
    '> c8a5 01',
    `> c8aa ${hexByte(EVENT_CONFIG.maxVillages)}`,
    '> c8ab 00',
    '> ca49 0a',
    '> ca4a 02',
    '> ca4b 04 64 46',
    '> ca55 00',
    '> 1624 01',
    '> 1156 60',
    '> 1a2b 60',
    '> 1a85 60',
    '> 1ae5 60',
    '> 1b07 60',
    '> 1b0d 60',
    '> 1b3b 60',
    '> 1b69 60',
    '> 1ca0 60',
    '> 1fd5 60',
    '> 2099 60',
    '> 2ac5 60',
    '> 2aef 60',
    '> 9a5d 60',
    '> 9b03 60',
    'r sp = ff',
    '> c000 20 12 31 ea',
    'g c000',
    bsave(paths.owners, 0xc5db, 0xc5da + provinceCount),
    bsave(paths.fortifications, 0xc63f, 0xc63e + provinceCount),
    bsave(paths.villages, 0xc6a3, 0xc6a2 + provinceCount),
    bsave(paths.soldiersLow, 0xc707, 0xc706 + provinceCount),
    bsave(paths.soldiersMiddle, 0xc76b, 0xc76a + provinceCount),
    bsave(paths.soldiersHigh, 0xc7cf, 0xc7ce + provinceCount),
    bsave(paths.moneyLow, 0xc8bc, 0xc8bb + playerCount),
    bsave(paths.moneyMiddle, 0xc8c1, 0xc8c0 + playerCount),
    bsave(paths.moneyHigh, 0xc8c6, 0xc8c5 + playerCount),
    bsave(paths.deserters, 0xca49, 0xca4a),
    bsave(paths.flags, 0xca61, 0xca61 + playerCount),
    bsave(paths.rngCount, 0xc0fd, 0xc0fe)
  ];
}

function verifyScenario(directory: string, scenario: EventScenario): void {
  const paths = scenarioPaths(directory, scenario.eventId);
  const initial = createEventState(scenario);
  const result = runC64RandomEvent(initial, EVENT_CONFIG);
  if (result.resolution?.eventId !== scenario.eventId) {
    throw new Error(
      `${scenario.eventId} TypeScript selected ${result.resolution?.eventId ?? 'no event'}.`
    );
  }
  const state = result.state;
  const provinceCount = state.map.provinces.length;
  const playerCount = state.players.length;

  requireEqualBytes(`${scenario.eventId} owners`, readSnapshot(paths.owners, provinceCount), ownerBytes(state));
  requireEqualBytes(
    `${scenario.eventId} fortifications`,
    readSnapshot(paths.fortifications, provinceCount),
    provinceBytes(state, (province) => c64FortificationLevelForFortificationLevel(province.fortificationLevel))
  );
  requireEqualBytes(
    `${scenario.eventId} villages`,
    readSnapshot(paths.villages, provinceCount),
    provinceBytes(state, (province) => province.villages)
  );
  requireEqualBytes(
    `${scenario.eventId} soldiers low`,
    readSnapshot(paths.soldiersLow, provinceCount),
    provinceBytes(state, (province) => lowByte(province.soldiers))
  );
  requireEqualBytes(
    `${scenario.eventId} soldiers middle`,
    readSnapshot(paths.soldiersMiddle, provinceCount),
    provinceBytes(state, (province) => middleByte(province.soldiers))
  );
  requireEqualBytes(
    `${scenario.eventId} soldiers high`,
    readSnapshot(paths.soldiersHigh, provinceCount),
    provinceBytes(state, (province) => highByte(province.soldiers))
  );
  requireEqualBytes(`${scenario.eventId} money low`, readSnapshot(paths.moneyLow, playerCount), playerBytes(state, lowByte));
  requireEqualBytes(`${scenario.eventId} money middle`, readSnapshot(paths.moneyMiddle, playerCount), playerBytes(state, middleByte));
  requireEqualBytes(`${scenario.eventId} money high`, readSnapshot(paths.moneyHigh, playerCount), playerBytes(state, highByte));
  requireEqualBytes(
    `${scenario.eventId} deserter memory`,
    readSnapshot(paths.deserters, 2),
    [state.c64.deserterSoldiers, playerNumber(state.c64.deserterOwnerId)]
  );
  requireEqualBytes(
    `${scenario.eventId} CA61 flags`,
    readSnapshot(paths.flags, playerCount + 1),
    state.c64.ca61Bytes
  );
  const countBytes = readSnapshot(paths.rngCount, 2);
  const count = (countBytes[0] ?? 0) | ((countBytes[1] ?? 0) << 8);
  if (count !== result.rngBytesConsumed) {
    throw new Error(
      `${scenario.eventId} RNG count mismatch: C64 ${count}, TypeScript ${result.rngBytesConsumed}.`
    );
  }
}

const baseline = verifyC64Baseline();
const directory = mkdtempSync(join(tmpdir(), 'wfc-c64-event-parity-'));
const monitorPath = join(directory, 'verify-events.mon');
const commands: string[] = ['break c003'];
for (const scenario of EVENT_SCENARIOS) {
  const paths = scenarioPaths(directory, scenario.eventId);
  commands.push(...commandsForScenario(
    scenario,
    paths,
    join(directory, `${scenario.eventId}-rng.bin`),
    requireRawModulePath(baseline, 'main'),
    requireRawModulePath(baseline, 'sys'),
    requireRawModulePath(baseline, scenario.eventId)
  ));
}
commands.push('quit');
writeMonitorCommands(monitorPath, commands);
runViceMonitor(monitorPath, 100_000_000);
for (const scenario of EVENT_SCENARIOS) {
  verifyScenario(directory, scenario);
  process.stdout.write(`PASS ${scenario.eventId} seed ${scenario.seed}\n`);
}
rmSync(directory, { recursive: true });
process.stdout.write(`Verified ${EVENT_SCENARIOS.length} C64 random event modules.\n`);
