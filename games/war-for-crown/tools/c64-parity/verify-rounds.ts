import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyPlayerAction } from '../../src/game/actions';
import { chooseC64OriginalAiAction } from '../../src/game/ai-c64-original';
import {
  c64FortificationLevelForFortificationLevel
} from '../../src/game/c64-battle';
import { DEFAULT_GAME_CONFIG } from '../../src/game/constants';
import { ROYALIST_OWNER_ID } from '../../src/game/owners';
import { createPlayerView } from '../../src/game/player-view';
import { nextRngByte } from '../../src/game/rng';
import { createInitialState } from '../../src/game/state';
import type { GameConfig, GameState, PlayerId } from '../../src/game/types';
import { requireRawModulePath, verifyC64Baseline } from './baseline';
import { hexByte, readSnapshot, requireEqualBytes } from './bytes';
import {
  c64Bsave as bsave,
  c64Call as call,
  c64HighByte as highByte,
  c64LowByte as lowByte,
  c64MiddleByte as middleByte,
  c64OwnerByte as ownerByte,
  C64_RNG_TAPE_LENGTH,
  createC64StateSetupCommands,
  type C64ParityModulePaths
} from './state-harness';
import { runViceMonitor, writeMonitorCommands } from './vice';

interface RoundPaths {
  readonly calendar: string;
  readonly ca61Bytes: string;
  readonly fortificationBuckets: string;
  readonly fortifications: string;
  readonly moneyHigh: string;
  readonly moneyLow: string;
  readonly moneyMiddle: string;
  readonly ownerCounts: string;
  readonly owners: string;
  readonly ranks: string;
  readonly royalistReinforcementTimer: string;
  readonly rngCount: string;
  readonly soldiersHigh: string;
  readonly soldiersLow: string;
  readonly soldiersMiddle: string;
  readonly villageBuckets: string;
  readonly villages: string;
  readonly weather: string;
}

interface ExpectedRound {
  readonly round: number;
  readonly state: GameState;
}

type TurnPhase = 'new-month' | 'attack' | 'movement' | 'economy';

interface PhasePaths {
  readonly calendar: string;
  readonly fortifications: string;
  readonly money: string;
  readonly owners: string;
  readonly royalistReinforcementTimer: string;
  readonly rngCount: string;
  readonly soldiersHigh: string;
  readonly soldiersLow: string;
  readonly soldiersMiddle: string;
  readonly villages: string;
  readonly weather: string;
}

interface ExpectedPhase {
  readonly paths: PhasePaths;
  readonly playerId: PlayerId;
  readonly round: number;
  readonly phase: TurnPhase;
  readonly state: GameState;
}

interface ParityScenario {
  readonly config: GameConfig;
  readonly requireWinner: boolean;
  readonly roundLimit: number;
  readonly seed: number;
  readonly targetedPhaseCheckpointRounds: ReadonlySet<number>;
}

const PHASE_CHECKPOINT_ROUNDS = 12;
const SCENARIOS: ReadonlyArray<ParityScenario> = [
  {
    seed: 15,
    config: {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 0,
      aiPlayerCount: 2,
      provinceCount: 16
    },
    requireWinner: true,
    roundLimit: 18,
    targetedPhaseCheckpointRounds: new Set([13])
  },
  {
    seed: 11,
    config: {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 0,
      aiPlayerCount: 4
    },
    requireWinner: false,
    roundLimit: 38,
    targetedPhaseCheckpointRounds: new Set([16, 17, 24, 37, 38])
  }
];

function roundPaths(directory: string, round: number): RoundPaths {
  const prefix = join(directory, `round-${round}`);
  return {
    calendar: `${prefix}-calendar.bin`,
    ca61Bytes: `${prefix}-ca61.bin`,
    fortificationBuckets: `${prefix}-fortification-buckets.bin`,
    fortifications: `${prefix}-fortifications.bin`,
    moneyHigh: `${prefix}-money-high.bin`,
    moneyLow: `${prefix}-money-low.bin`,
    moneyMiddle: `${prefix}-money-middle.bin`,
    ownerCounts: `${prefix}-owner-counts.bin`,
    owners: `${prefix}-owners.bin`,
    ranks: `${prefix}-ranks.bin`,
    royalistReinforcementTimer: `${prefix}-royalist-reinforcement-timer.bin`,
    rngCount: `${prefix}-rng-count.bin`,
    soldiersHigh: `${prefix}-soldiers-high.bin`,
    soldiersLow: `${prefix}-soldiers-low.bin`,
    soldiersMiddle: `${prefix}-soldiers-middle.bin`,
    villageBuckets: `${prefix}-village-buckets.bin`,
    villages: `${prefix}-villages.bin`,
    weather: `${prefix}-weather.bin`
  };
}

function phasePaths(
  directory: string,
  round: number,
  playerId: PlayerId,
  phase: TurnPhase
): PhasePaths {
  const prefix = join(directory, `round-${round}-${playerId}-${phase}`);
  return {
    calendar: `${prefix}-calendar.bin`,
    fortifications: `${prefix}-fortifications.bin`,
    money: `${prefix}-money.bin`,
    owners: `${prefix}-owners.bin`,
    royalistReinforcementTimer: `${prefix}-royalist-reinforcement-timer.bin`,
    rngCount: `${prefix}-rng-count.bin`,
    soldiersHigh: `${prefix}-soldiers-high.bin`,
    soldiersLow: `${prefix}-soldiers-low.bin`,
    soldiersMiddle: `${prefix}-soldiers-middle.bin`,
    villages: `${prefix}-villages.bin`,
    weather: `${prefix}-weather.bin`
  };
}

function playerNumber(playerId: PlayerId): number {
  return Number(playerId.slice(1));
}

function createHomeSelectionState(scenario: ParityScenario): GameState {
  let state = createInitialState(scenario.seed, scenario.config);
  while (state.phase === 'home-selection') {
    const action = chooseC64OriginalAiAction(
      createPlayerView(state, state.activePlayerId, scenario.config),
      scenario.config
    );
    if (action.type !== 'select-home') {
      throw new Error(`C64 AI returned ${action.type} during home selection.`);
    }
    state = applyPlayerAction(state, state.activePlayerId, action, scenario.config).state;
  }
  return state;
}

function runNewMonth(state: GameState, config: GameConfig): GameState {
  if (state.turnStep !== 'new-month') {
    throw new Error(`Expected new-month state, got ${state.turnStep}.`);
  }
  return applyPlayerAction(
    state,
    state.activePlayerId,
    { type: 'advance-step' },
    config
  ).state;
}

function runAttack(state: GameState, config: GameConfig): GameState {
  let current = state;
  while (current.phase === 'turn' && current.turnStep === 'attack') {
    current = applyPlayerAction(
      current,
      current.activePlayerId,
      { type: 'run-c64-baron-attack' },
      config
    ).state;
    while (current.battle !== null) {
      current = applyPlayerAction(
        current,
        current.activePlayerId,
        { type: 'run-c64-battle-command' },
        config
      ).state;
    }
  }
  return current;
}

function runMovement(state: GameState, config: GameConfig): GameState {
  return applyPlayerAction(
    state,
    state.activePlayerId,
    { type: 'run-c64-baron-movement' },
    config
  ).state;
}

function runEconomy(state: GameState, config: GameConfig): GameState {
  return applyPlayerAction(
    state,
    state.activePlayerId,
    { type: 'run-c64-baron-economy' },
    config
  ).state;
}

function appendWorldCommands(commands: string[]): void {
  commands.push(
    '> 1624 00',
    '> 0044 00 04',
    ...call(0x5209),
    ...call(0x50d3)
  );
}

function appendPhaseSnapshot(
  commands: string[],
  paths: PhasePaths,
  provinceCount: number,
  playerCount: number
): void {
  commands.push(
    bsave(paths.calendar, 0xc8a2, 0xc8a3),
    bsave(paths.owners, 0xc5db, 0xc5da + provinceCount),
    bsave(paths.fortifications, 0xc63f, 0xc63e + provinceCount),
    bsave(paths.villages, 0xc6a3, 0xc6a2 + provinceCount),
    bsave(paths.soldiersLow, 0xc707, 0xc706 + provinceCount),
    bsave(paths.soldiersMiddle, 0xc76b, 0xc76a + provinceCount),
    bsave(paths.soldiersHigh, 0xc7cf, 0xc7ce + provinceCount),
    bsave(paths.money, 0xc8bc, 0xc8bb + playerCount),
    bsave(paths.royalistReinforcementTimer, 0xc8b0, 0xc8b0),
    bsave(paths.weather, 0xca4b, 0xca4d),
    bsave(paths.rngCount, 0xc0fd, 0xc0fe)
  );
}

function appendRoundSnapshot(
  commands: string[],
  paths: RoundPaths,
  provinceCount: number,
  playerCount: number
): void {
  commands.push(
    bsave(paths.owners, 0xc5db, 0xc5da + provinceCount),
    bsave(paths.fortifications, 0xc63f, 0xc63e + provinceCount),
    bsave(paths.villages, 0xc6a3, 0xc6a2 + provinceCount),
    bsave(paths.soldiersLow, 0xc707, 0xc706 + provinceCount),
    bsave(paths.soldiersMiddle, 0xc76b, 0xc76a + provinceCount),
    bsave(paths.soldiersHigh, 0xc7cf, 0xc7ce + provinceCount),
    bsave(paths.moneyLow, 0xc8bc, 0xc8bb + playerCount),
    bsave(paths.moneyMiddle, 0xc8c1, 0xc8c0 + playerCount),
    bsave(paths.moneyHigh, 0xc8c6, 0xc8c5 + playerCount),
    bsave(paths.ownerCounts, 0xc8b5, 0xc8b5 + playerCount),
    bsave(paths.ranks, 0xc8d0, 0xc8cf + playerCount),
    bsave(paths.royalistReinforcementTimer, 0xc8b0, 0xc8b0),
    bsave(paths.villageBuckets, 0xc903, 0xc902 + provinceCount),
    bsave(paths.fortificationBuckets, 0xc967, 0xc966 + provinceCount),
    bsave(paths.ca61Bytes, 0xca61, 0xca61 + playerCount),
    bsave(paths.calendar, 0xc8a2, 0xc8a3),
    bsave(paths.weather, 0xca4b, 0xca4d),
    bsave(paths.rngCount, 0xc0fd, 0xc0fe)
  );
}

function monitorCommands(
  state: GameState,
  scenario: ParityScenario,
  directory: string,
  modulePaths: C64ParityModulePaths
): {
  readonly commands: ReadonlyArray<string>;
  readonly expectedPhases: ReadonlyArray<ExpectedPhase>;
  readonly expectedRounds: ReadonlyArray<ExpectedRound>;
} {
  const commands: string[] = ['break c003'];
  commands.push(...createC64StateSetupCommands(
    state,
    scenario.config,
    join(directory, 'rng.bin'),
    modulePaths
  ));
  const expectedPhases: ExpectedPhase[] = [];
  const expectedRounds: ExpectedRound[] = [];
  let current = state;
  let matchFinished = false;

  for (let round = 1; round <= scenario.roundLimit; round += 1) {
    const turnNumber = current.turnNumber;
    commands.push(...call(0x35e5));
    while (current.phase === 'turn' && current.turnNumber === turnNumber) {
      const playerId = current.activePlayerId;
      commands.push(
        `> 1624 ${hexByte(playerNumber(playerId))}`,
        ...call(0x4f40),
        ...call(0x3a98),
        ...call(0x3112)
      );
      current = runNewMonth(current, scenario.config);
      if (
        round <= PHASE_CHECKPOINT_ROUNDS ||
        scenario.targetedPhaseCheckpointRounds.has(round)
      ) {
        const newMonthPaths = phasePaths(directory, round, playerId, 'new-month');
        expectedPhases.push({
          paths: newMonthPaths,
          playerId,
          round,
          phase: 'new-month',
          state: current
        });
        appendPhaseSnapshot(
          commands,
          newMonthPaths,
          current.map.provinces.length,
          current.players.length
        );
      }

      commands.push(...call(0x5803));
      current = runAttack(current, scenario.config);
      if (
        round <= PHASE_CHECKPOINT_ROUNDS ||
        scenario.targetedPhaseCheckpointRounds.has(round)
      ) {
        const attackPaths = phasePaths(directory, round, playerId, 'attack');
        expectedPhases.push({ paths: attackPaths, playerId, round, phase: 'attack', state: current });
        appendPhaseSnapshot(
          commands,
          attackPaths,
          current.map.provinces.length,
          current.players.length
        );
      }
      if (current.phase === 'game-over') {
        matchFinished = true;
        break;
      }

      commands.push(...call(0x5806));
      current = runMovement(current, scenario.config);
      if (
        round <= PHASE_CHECKPOINT_ROUNDS ||
        scenario.targetedPhaseCheckpointRounds.has(round)
      ) {
        const movementPaths = phasePaths(directory, round, playerId, 'movement');
        expectedPhases.push({
          paths: movementPaths,
          playerId,
          round,
          phase: 'movement',
          state: current
        });
        appendPhaseSnapshot(
          commands,
          movementPaths,
          current.map.provinces.length,
          current.players.length
        );
      }

      commands.push(...call(0x5800));
      current = runEconomy(current, scenario.config);
      if (current.turnNumber > turnNumber) {
        appendWorldCommands(commands);
      }
      if (
        round <= PHASE_CHECKPOINT_ROUNDS ||
        scenario.targetedPhaseCheckpointRounds.has(round)
      ) {
        const economyPaths = phasePaths(directory, round, playerId, 'economy');
        expectedPhases.push({ paths: economyPaths, playerId, round, phase: 'economy', state: current });
        appendPhaseSnapshot(
          commands,
          economyPaths,
          current.map.provinces.length,
          current.players.length
        );
      }
    }
    if (!matchFinished && current.turnNumber === turnNumber) {
      throw new Error(`Round ${round} did not advance the TypeScript turn number.`);
    }
    expectedRounds.push({ round, state: current });
    appendRoundSnapshot(
      commands,
      roundPaths(directory, round),
      current.map.provinces.length,
      current.players.length
    );
    if (matchFinished) {
      break;
    }
  }
  if (scenario.requireWinner && !matchFinished) {
    throw new Error(
      `Seed ${scenario.seed} did not finish within ${scenario.roundLimit} rounds.`
    );
  }
  commands.push('quit');
  return { commands, expectedPhases, expectedRounds };
}

function expectedRngState(initialRngState: number, count: number): number {
  if (count > C64_RNG_TAPE_LENGTH) {
    throw new Error(`C64 consumed ${count} RNG bytes, exceeding the round tape.`);
  }
  let rngState = initialRngState;
  for (let index = 0; index < count; index += 1) {
    rngState = nextRngByte(rngState).rngState;
  }
  return rngState;
}

function verifyRound(
  directory: string,
  initialRngState: number,
  seed: number,
  expected: ExpectedRound
): void {
  const paths = roundPaths(directory, expected.round);
  const state = expected.state;
  const provinceCount = state.map.provinces.length;
  const playerCount = state.players.length;
  const label = `seed ${seed} round ${expected.round}`;
  requireEqualBytes(`${label} owners`, readSnapshot(paths.owners, provinceCount), state.map.provinces.map((province) => ownerByte(province.ownerId)));
  requireEqualBytes(`${label} fortifications`, readSnapshot(paths.fortifications, provinceCount), state.map.provinces.map((province) => c64FortificationLevelForFortificationLevel(province.fortificationLevel)));
  requireEqualBytes(`${label} villages`, readSnapshot(paths.villages, provinceCount), state.map.provinces.map((province) => province.villages));
  requireEqualBytes(`${label} soldiers low`, readSnapshot(paths.soldiersLow, provinceCount), state.map.provinces.map((province) => lowByte(province.soldiers)));
  requireEqualBytes(`${label} soldiers middle`, readSnapshot(paths.soldiersMiddle, provinceCount), state.map.provinces.map((province) => middleByte(province.soldiers)));
  requireEqualBytes(`${label} soldiers high`, readSnapshot(paths.soldiersHigh, provinceCount), state.map.provinces.map((province) => highByte(province.soldiers)));
  requireEqualBytes(`${label} money low`, readSnapshot(paths.moneyLow, playerCount), state.players.map((player) => lowByte(player.money)));
  requireEqualBytes(`${label} money middle`, readSnapshot(paths.moneyMiddle, playerCount), state.players.map((player) => middleByte(player.money)));
  requireEqualBytes(`${label} money high`, readSnapshot(paths.moneyHigh, playerCount), state.players.map((player) => highByte(player.money)));
  requireEqualBytes(`${label} owner counts`, readSnapshot(paths.ownerCounts, playerCount + 1), [
    state.map.provinces.filter((province) => province.ownerId === ROYALIST_OWNER_ID).length,
    ...state.players.map((player) => state.map.provinces.filter((province) => province.ownerId === player.id).length)
  ]);
  requireEqualBytes(`${label} ranks`, readSnapshot(paths.ranks, playerCount), state.c64.playerMemory.map((memory) => memory.rank));
  requireEqualBytes(
    `${label} royalist reinforcement timer`,
    readSnapshot(paths.royalistReinforcementTimer, 1),
    [state.c64.royalistReinforcementTimer]
  );
  requireEqualBytes(`${label} village buckets`, readSnapshot(paths.villageBuckets, provinceCount), state.c64.royalistProvinceMemory.map((memory) => memory.villageInvestmentBucket));
  requireEqualBytes(`${label} fortification buckets`, readSnapshot(paths.fortificationBuckets, provinceCount), state.c64.royalistProvinceMemory.map((memory) => memory.fortificationInvestmentBucket));
  requireEqualBytes(`${label} CA61 bytes`, readSnapshot(paths.ca61Bytes, playerCount + 1), state.c64.ca61Bytes);
  requireEqualBytes(`${label} calendar`, readSnapshot(paths.calendar, 2), [state.c64.calendar.year, state.c64.calendar.month]);
  requireEqualBytes(`${label} weather`, readSnapshot(paths.weather, 3), [
    state.c64.calendar.weatherIndex,
    state.c64.calendar.weatherFactor,
    state.c64.calendar.weatherDerived
  ]);
  const countBytes = readSnapshot(paths.rngCount, 2);
  const count = (countBytes[0] ?? 0) | ((countBytes[1] ?? 0) << 8);
  const rngState = expectedRngState(initialRngState, count);
  if (state.rngState !== rngState) {
    throw new Error(`${label} RNG mismatch: C64 consumed ${count} bytes.`);
  }
}

function verifyPhase(
  initialRngState: number,
  seed: number,
  expected: ExpectedPhase
): void {
  const state = expected.state;
  const provinceCount = state.map.provinces.length;
  const playerCount = state.players.length;
  const label = `seed ${seed} round ${expected.round} ${expected.playerId} ${expected.phase}`;
  requireEqualBytes(`${label} owners`, readSnapshot(expected.paths.owners, provinceCount), state.map.provinces.map((province) => ownerByte(province.ownerId)));
  requireEqualBytes(`${label} fortifications`, readSnapshot(expected.paths.fortifications, provinceCount), state.map.provinces.map((province) => c64FortificationLevelForFortificationLevel(province.fortificationLevel)));
  requireEqualBytes(`${label} villages`, readSnapshot(expected.paths.villages, provinceCount), state.map.provinces.map((province) => province.villages));
  requireEqualBytes(`${label} soldiers low`, readSnapshot(expected.paths.soldiersLow, provinceCount), state.map.provinces.map((province) => lowByte(province.soldiers)));
  requireEqualBytes(`${label} soldiers middle`, readSnapshot(expected.paths.soldiersMiddle, provinceCount), state.map.provinces.map((province) => middleByte(province.soldiers)));
  requireEqualBytes(`${label} soldiers high`, readSnapshot(expected.paths.soldiersHigh, provinceCount), state.map.provinces.map((province) => highByte(province.soldiers)));
  requireEqualBytes(`${label} money low`, readSnapshot(expected.paths.money, playerCount), state.players.map((player) => lowByte(player.money)));
  requireEqualBytes(
    `${label} calendar`,
    readSnapshot(expected.paths.calendar, 2),
    [state.c64.calendar.year, state.c64.calendar.month]
  );
  requireEqualBytes(
    `${label} weather`,
    readSnapshot(expected.paths.weather, 3),
    [
      state.c64.calendar.weatherIndex,
      state.c64.calendar.weatherFactor,
      state.c64.calendar.weatherDerived
    ]
  );
  requireEqualBytes(
    `${label} royalist reinforcement timer`,
    readSnapshot(expected.paths.royalistReinforcementTimer, 1),
    [state.c64.royalistReinforcementTimer]
  );
  const countBytes = readSnapshot(expected.paths.rngCount, 2);
  const count = (countBytes[0] ?? 0) | ((countBytes[1] ?? 0) << 8);
  if (state.rngState !== expectedRngState(initialRngState, count)) {
    throw new Error(`${label} RNG mismatch: C64 consumed ${count} bytes.`);
  }
}

const baseline = verifyC64Baseline();
const modulePaths = {
  cbaron: requireRawModulePath(baseline, 'cbaron'),
  kampf: requireRawModulePath(baseline, 'kampf'),
  kernal: requireRawModulePath(baseline, 'kernal'),
  main: requireRawModulePath(baseline, 'main'),
  sys: requireRawModulePath(baseline, 'sys')
};

for (const scenario of SCENARIOS) {
  const directory = mkdtempSync(join(tmpdir(), 'wfc-c64-round-parity-'));
  const initialState = createHomeSelectionState(scenario);
  const generated = monitorCommands(initialState, scenario, directory, modulePaths);
  const monitorPath = join(directory, 'verify-rounds.mon');
  writeMonitorCommands(monitorPath, generated.commands);
  runViceMonitor(monitorPath, 2_000_000_000, 240);
  for (const expected of generated.expectedPhases) {
    verifyPhase(initialState.rngState, scenario.seed, expected);
  }
  for (const expected of generated.expectedRounds) {
    verifyRound(directory, initialState.rngState, scenario.seed, expected);
    process.stdout.write(`PASS seed ${scenario.seed} round ${expected.round}\n`);
  }
  const finalState = generated.expectedRounds.at(-1)?.state;
  if (
    scenario.requireWinner &&
    (finalState?.phase !== 'game-over' || finalState.winnerId === null)
  ) {
    throw new Error(`Seed ${scenario.seed} did not produce a winner.`);
  }
  process.stdout.write(scenario.requireWinner
    ? `Verified C64 winner ${String(finalState?.winnerId)} at turn ` +
      `${String(finalState?.turnNumber)} for seed ${scenario.seed}.\n`
    : `Verified C64 parity through ${generated.expectedRounds.length} rounds ` +
      `for seed ${scenario.seed}.\n`
  );
  rmSync(directory, { recursive: true });
}
