import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyPlayerAction } from '../../src/game/actions';
import { chooseC64OriginalAiAction } from '../../src/game/ai-c64-original';
import { c64FortificationLevelForFortificationLevel } from '../../src/game/c64-battle';
import { DEFAULT_GAME_CONFIG } from '../../src/game/constants';
import { createPlayerView } from '../../src/game/player-view';
import { nextRngByte } from '../../src/game/rng';
import { createInitialState } from '../../src/game/state';
import type {
  FortificationLevel,
  GameConfig,
  GameState,
  PlayerId,
  ProvinceId
} from '../../src/game/types';
import { requireRawModulePath, verifyC64Baseline } from './baseline';
import { readSnapshot, requireEqualBytes } from './bytes';
import {
  c64Bsave,
  c64Call,
  c64HighByte,
  c64LowByte,
  c64MiddleByte,
  c64OwnerByte,
  createC64StateSetupCommands,
  type C64ParityModulePaths
} from './state-harness';
import { runViceMonitor, writeMonitorCommands } from './vice';

type ReactionPhase = 'new-month' | 'attack' | 'movement' | 'economy';

interface ReactionScenario {
  readonly fortificationLevel: FortificationLevel;
  readonly id: string;
  readonly targetSoldiers: number;
}

interface SnapshotPaths {
  readonly fortifications: string;
  readonly memoryTargets: string;
  readonly moneyHigh: string;
  readonly moneyLow: string;
  readonly moneyMiddle: string;
  readonly owners: string;
  readonly rngCount: string;
  readonly soldiersHigh: string;
  readonly soldiersLow: string;
  readonly soldiersMiddle: string;
}

interface ExpectedSnapshot {
  readonly paths: SnapshotPaths;
  readonly phase: ReactionPhase;
  readonly scenario: ReactionScenario;
  readonly state: GameState;
}

const SEED = 23;
const CONFIG: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  humanPlayerCount: 1,
  aiPlayerCount: 1,
  provinceCount: 16
};
const SCENARIOS: ReadonlyArray<ReactionScenario> = [
  { id: 'weak-incursion', targetSoldiers: 4, fortificationLevel: 'none' },
  { id: 'strong-incursion', targetSoldiers: 80, fortificationLevel: 'none' },
  { id: 'fortified-incursion', targetSoldiers: 80, fortificationLevel: 'watchtower' }
];

function provinceNumber(provinceId: ProvinceId): number {
  const match = /^province-(\d+)$/.exec(provinceId);
  if (match === null) {
    throw new Error(`Invalid C64 reaction province id ${provinceId}.`);
  }
  return Number(match[1]);
}

function snapshotPaths(
  directory: string,
  scenario: ReactionScenario,
  phase: ReactionPhase
): SnapshotPaths {
  const prefix = join(directory, `${scenario.id}-${phase}`);
  return {
    fortifications: `${prefix}-fortifications.bin`,
    memoryTargets: `${prefix}-memory-targets.bin`,
    moneyHigh: `${prefix}-money-high.bin`,
    moneyLow: `${prefix}-money-low.bin`,
    moneyMiddle: `${prefix}-money-middle.bin`,
    owners: `${prefix}-owners.bin`,
    rngCount: `${prefix}-rng-count.bin`,
    soldiersHigh: `${prefix}-soldiers-high.bin`,
    soldiersLow: `${prefix}-soldiers-low.bin`,
    soldiersMiddle: `${prefix}-soldiers-middle.bin`
  };
}

function appendSnapshot(
  commands: string[],
  paths: SnapshotPaths,
  provinceCount: number,
  playerCount: number
): void {
  commands.push(
    c64Bsave(paths.owners, 0xc5db, 0xc5da + provinceCount),
    c64Bsave(paths.fortifications, 0xc63f, 0xc63e + provinceCount),
    c64Bsave(paths.soldiersLow, 0xc707, 0xc706 + provinceCount),
    c64Bsave(paths.soldiersMiddle, 0xc76b, 0xc76a + provinceCount),
    c64Bsave(paths.soldiersHigh, 0xc7cf, 0xc7ce + provinceCount),
    c64Bsave(paths.moneyLow, 0xc8bc, 0xc8bb + playerCount),
    c64Bsave(paths.moneyMiddle, 0xc8c1, 0xc8c0 + playerCount),
    c64Bsave(paths.moneyHigh, 0xc8c6, 0xc8c5 + playerCount),
    c64Bsave(paths.memoryTargets, 0xc9df, 0xc9de + playerCount),
    c64Bsave(paths.rngCount, 0xc0fd, 0xc0fe)
  );
}

function selectedHomeState(): GameState {
  let state = createInitialState(SEED, CONFIG);
  while (state.phase === 'home-selection') {
    const action = chooseC64OriginalAiAction(
      createPlayerView(state, state.activePlayerId, CONFIG),
      CONFIG
    );
    if (action.type !== 'select-home') {
      throw new Error(`Expected home selection, got ${action.type}.`);
    }
    state = applyPlayerAction(state, state.activePlayerId, action, CONFIG).state;
  }
  return state;
}

function requireHome(state: GameState, playerId: PlayerId): ProvinceId {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player?.homeProvinceId === null || player?.homeProvinceId === undefined) {
    throw new Error(`Missing reaction home province for ${playerId}.`);
  }
  return player.homeProvinceId;
}

function shortestPath(
  state: GameState,
  startProvinceId: ProvinceId,
  targetProvinceId: ProvinceId
): ReadonlyArray<ProvinceId> {
  const queue: ProvinceId[] = [startProvinceId];
  const previous = new Map<ProvinceId, ProvinceId | null>([[startProvinceId, null]]);
  while (queue.length > 0) {
    const provinceId = queue.shift();
    if (provinceId === undefined) {
      throw new Error('Missing reaction path queue province.');
    }
    if (provinceId === targetProvinceId) {
      const path: ProvinceId[] = [];
      let current: ProvinceId | null = targetProvinceId;
      while (current !== null) {
        path.push(current);
        current = previous.get(current) ?? null;
      }
      return path.reverse();
    }
    const province = state.map.provinces.find((candidate) => candidate.id === provinceId);
    if (province === undefined) {
      throw new Error(`Missing reaction path province ${provinceId}.`);
    }
    for (const neighbourId of province.neighbours) {
      if (previous.has(neighbourId)) {
        continue;
      }
      previous.set(neighbourId, provinceId);
      queue.push(neighbourId);
    }
  }
  throw new Error(`No reaction path from ${startProvinceId} to ${targetProvinceId}.`);
}

function scriptedHumanState(base: GameState, scenario: ReactionScenario): GameState {
  const humanHomeId = requireHome(base, 'p1');
  const aiHomeId = requireHome(base, 'p2');
  const path = shortestPath(base, humanHomeId, aiHomeId);
  if (path.length < 3) {
    throw new Error('Reaction scenario requires at least one province between player homes.');
  }
  const incursionProvinceId = path[path.length - 2];
  if (incursionProvinceId === undefined) {
    throw new Error('Missing reaction incursion province.');
  }
  const humanPath = new Set(path.slice(0, -1));

  return {
    ...base,
    activePlayerId: 'p2',
    turnStep: 'new-month',
    turnNumber: 1,
    attackSpentProvinceIds: [],
    battle: null,
    map: {
      ...base.map,
      provinces: base.map.provinces.map((province) => {
        if (!humanPath.has(province.id) || province.id === humanHomeId) {
          return { ...province };
        }
        return {
          ...province,
          ownerId: 'p1',
          soldiers: province.id === incursionProvinceId ? scenario.targetSoldiers : 1,
          fortificationLevel:
            province.id === incursionProvinceId ? scenario.fortificationLevel : 'none',
          upgradedFortificationThisTurn: false
        };
      })
    },
    players: base.players.map((player) =>
      player.id === 'p2' ? { ...player, money: 80 } : { ...player }
    )
  };
}

function runNewMonth(state: GameState): GameState {
  return applyPlayerAction(
    state,
    state.activePlayerId,
    { type: 'advance-step' },
    CONFIG
  ).state;
}

function runAttack(state: GameState): GameState {
  let current = state;
  while (current.phase === 'turn' && current.turnStep === 'attack') {
    current = applyPlayerAction(
      current,
      current.activePlayerId,
      { type: 'run-c64-baron-attack' },
      CONFIG
    ).state;
    while (current.battle !== null) {
      current = applyPlayerAction(
        current,
        current.activePlayerId,
        { type: 'run-c64-battle-command' },
        CONFIG
      ).state;
    }
  }
  return current;
}

function runMovement(state: GameState): GameState {
  return applyPlayerAction(
    state,
    state.activePlayerId,
    { type: 'run-c64-baron-movement' },
    CONFIG
  ).state;
}

function runEconomy(state: GameState): GameState {
  return applyPlayerAction(
    state,
    state.activePlayerId,
    { type: 'run-c64-baron-economy' },
    CONFIG
  ).state;
}

function appendWorldCommands(commands: string[]): void {
  commands.push(
    '> 1624 00',
    '> 0044 00 04',
    ...c64Call(0x5209),
    ...c64Call(0x50d3)
  );
}

function scenarioCommands(
  directory: string,
  scenario: ReactionScenario,
  modulePaths: C64ParityModulePaths
): {
  readonly commands: ReadonlyArray<string>;
  readonly expected: ReadonlyArray<ExpectedSnapshot>;
  readonly initialRngState: number;
} {
  const initial = scriptedHumanState(selectedHomeState(), scenario);
  const commands = [
    ...createC64StateSetupCommands(
      initial,
      CONFIG,
      join(directory, `${scenario.id}-rng.bin`),
      modulePaths
    ),
    '> 1624 02',
    ...c64Call(0x35e5),
    ...c64Call(0x4f40),
    ...c64Call(0x3a98),
    ...c64Call(0x3112)
  ];
  const expected: ExpectedSnapshot[] = [];
  let current = runNewMonth(initial);
  let paths = snapshotPaths(directory, scenario, 'new-month');
  expected.push({ paths, phase: 'new-month', scenario, state: current });
  appendSnapshot(commands, paths, current.map.provinces.length, current.players.length);

  commands.push(...c64Call(0x5803));
  current = runAttack(current);
  paths = snapshotPaths(directory, scenario, 'attack');
  expected.push({ paths, phase: 'attack', scenario, state: current });
  appendSnapshot(commands, paths, current.map.provinces.length, current.players.length);

  commands.push(...c64Call(0x5806));
  current = runMovement(current);
  paths = snapshotPaths(directory, scenario, 'movement');
  expected.push({ paths, phase: 'movement', scenario, state: current });
  appendSnapshot(commands, paths, current.map.provinces.length, current.players.length);

  commands.push(...c64Call(0x5800));
  current = runEconomy(current);
  appendWorldCommands(commands);
  paths = snapshotPaths(directory, scenario, 'economy');
  expected.push({ paths, phase: 'economy', scenario, state: current });
  appendSnapshot(commands, paths, current.map.provinces.length, current.players.length);
  return { commands, expected, initialRngState: initial.rngState };
}

function expectedRngState(initialRngState: number, count: number): number {
  let rngState = initialRngState;
  for (let index = 0; index < count; index += 1) {
    rngState = nextRngByte(rngState).rngState;
  }
  return rngState;
}

function verifySnapshot(initialRngState: number, expected: ExpectedSnapshot): void {
  const state = expected.state;
  const provinceCount = state.map.provinces.length;
  const playerCount = state.players.length;
  const label = `${expected.scenario.id} ${expected.phase}`;
  requireEqualBytes(`${label} owners`, readSnapshot(expected.paths.owners, provinceCount), state.map.provinces.map((province) => c64OwnerByte(province.ownerId)));
  requireEqualBytes(`${label} fortifications`, readSnapshot(expected.paths.fortifications, provinceCount), state.map.provinces.map((province) => c64FortificationLevelForFortificationLevel(province.fortificationLevel)));
  requireEqualBytes(`${label} soldiers low`, readSnapshot(expected.paths.soldiersLow, provinceCount), state.map.provinces.map((province) => c64LowByte(province.soldiers)));
  requireEqualBytes(`${label} soldiers middle`, readSnapshot(expected.paths.soldiersMiddle, provinceCount), state.map.provinces.map((province) => c64MiddleByte(province.soldiers)));
  requireEqualBytes(`${label} soldiers high`, readSnapshot(expected.paths.soldiersHigh, provinceCount), state.map.provinces.map((province) => c64HighByte(province.soldiers)));
  requireEqualBytes(`${label} money low`, readSnapshot(expected.paths.moneyLow, playerCount), state.players.map((player) => c64LowByte(player.money)));
  requireEqualBytes(`${label} money middle`, readSnapshot(expected.paths.moneyMiddle, playerCount), state.players.map((player) => c64MiddleByte(player.money)));
  requireEqualBytes(`${label} money high`, readSnapshot(expected.paths.moneyHigh, playerCount), state.players.map((player) => c64HighByte(player.money)));
  requireEqualBytes(`${label} remembered targets`, readSnapshot(expected.paths.memoryTargets, playerCount), state.c64.playerMemory.map((memory) => memory.rememberedTargetProvinceId === null ? 0 : provinceNumber(memory.rememberedTargetProvinceId)));
  const countBytes = readSnapshot(expected.paths.rngCount, 2);
  const count = (countBytes[0] ?? 0) | ((countBytes[1] ?? 0) << 8);
  if (state.rngState !== expectedRngState(initialRngState, count)) {
    throw new Error(`${label} RNG mismatch after ${count} bytes.`);
  }
}

const baseline = verifyC64Baseline();
const modulePaths: C64ParityModulePaths = {
  cbaron: requireRawModulePath(baseline, 'cbaron'),
  kampf: requireRawModulePath(baseline, 'kampf'),
  kernal: requireRawModulePath(baseline, 'kernal'),
  main: requireRawModulePath(baseline, 'main'),
  sys: requireRawModulePath(baseline, 'sys')
};
const directory = mkdtempSync(join(tmpdir(), 'wfc-c64-ai-reactions-'));
const commands: string[] = ['break c003'];
const expected: Array<{ readonly initialRngState: number; readonly snapshot: ExpectedSnapshot }> = [];
for (const scenario of SCENARIOS) {
  const generated = scenarioCommands(directory, scenario, modulePaths);
  commands.push(...generated.commands);
  expected.push(...generated.expected.map((snapshot) => ({
    initialRngState: generated.initialRngState,
    snapshot
  })));
}
commands.push('quit');
const monitorPath = join(directory, 'verify-ai-reactions.mon');
writeMonitorCommands(monitorPath, commands);
runViceMonitor(monitorPath, 300_000_000, 60);
for (const entry of expected) {
  verifySnapshot(entry.initialRngState, entry.snapshot);
  process.stdout.write(`PASS ${entry.snapshot.scenario.id} ${entry.snapshot.phase}\n`);
}
rmSync(directory, { recursive: true });
process.stdout.write(`Verified ${SCENARIOS.length} scripted human-to-AI reaction scenarios.\n`);
