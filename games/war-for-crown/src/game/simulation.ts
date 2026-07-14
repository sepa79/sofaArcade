import { DEFAULT_GAME_CONFIG } from './constants';
import { applyPlayerAction, type WarForCrownAction } from './actions';
import { calculateIncome } from './economy';
import { ROYALIST_OWNER_ID } from './owners';
import { createPlayerView, type PlayerView } from './player-view';
import { createInitialState } from './state';
import { validateGameState } from './invariants';
import type {
  BattleState,
  C64CompatibilityState,
  FortificationLevel,
  GameConfig,
  GamePhase,
  GameState,
  PlayerId,
  ProvinceId,
  TerrainId,
  TurnStep
} from './types';
import type { OwnerId } from './owners';
import type { WarForCrownEvent } from './events';

export type SimulationClient = (view: PlayerView) => WarForCrownAction;

export type SimulationClients = Readonly<Partial<Record<PlayerId, SimulationClient>>>;

export type MatchTranscriptStatus = 'running' | 'game-over' | 'step-limit-reached';

export interface MatchTranscriptPlayerSnapshot {
  readonly id: PlayerId;
  readonly label: string;
  readonly money: number;
  readonly homeProvinceId: ProvinceId | null;
  readonly provinceCount: number;
  readonly soldierCount: number;
  readonly income: number;
}

export interface MatchTranscriptOwnerSnapshot {
  readonly ownerId: OwnerId;
  readonly provinceCount: number;
  readonly soldierCount: number;
  readonly income: number;
}

export interface MatchTranscriptProvinceSnapshot {
  readonly id: ProvinceId;
  readonly ownerId: OwnerId;
  readonly terrainId: TerrainId;
  readonly villages: number;
  readonly soldiers: number;
  readonly fortificationLevel: FortificationLevel;
  readonly upgradedFortificationThisTurn: boolean;
  readonly neighbours: ReadonlyArray<ProvinceId>;
}

export interface MatchTranscriptStateSnapshot {
  readonly rngState: number;
  readonly activePlayerId: PlayerId;
  readonly phase: GamePhase;
  readonly turnStep: TurnStep;
  readonly turnNumber: number;
  readonly winnerId: OwnerId | null;
  readonly attackSpentProvinceIds: ReadonlyArray<ProvinceId>;
  readonly battle: BattleState | null;
  readonly players: ReadonlyArray<MatchTranscriptPlayerSnapshot>;
  readonly owners: ReadonlyArray<MatchTranscriptOwnerSnapshot>;
  readonly provinces: ReadonlyArray<MatchTranscriptProvinceSnapshot>;
  readonly c64: C64CompatibilityState;
}

export interface MatchTranscriptStep {
  readonly stepNumber: number;
  readonly playerId: PlayerId;
  readonly turnNumber: number;
  readonly phase: GamePhase;
  readonly turnStep: TurnStep;
  readonly action: WarForCrownAction;
  readonly events: ReadonlyArray<WarForCrownEvent>;
  readonly before: MatchTranscriptStateSnapshot;
  readonly after: MatchTranscriptStateSnapshot;
}

export interface MatchTranscript {
  readonly seed: number;
  readonly maxSteps: number;
  readonly status: MatchTranscriptStatus;
  readonly winnerId: OwnerId | null;
  readonly finalTurnNumber: number;
  readonly steps: ReadonlyArray<MatchTranscriptStep>;
}

export interface RunMatchInput {
  readonly seed: number;
  readonly clients: SimulationClients;
  readonly maxSteps: number;
  readonly config?: GameConfig;
}

export interface SimulationRuntime {
  readonly state: GameState;
  readonly config: GameConfig;
  readonly clients: SimulationClients;
  readonly transcript: MatchTranscript;
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer, got ${value}.`);
  }
}

function requireSimulationClient(
  clients: SimulationClients,
  playerId: PlayerId
): SimulationClient {
  const client = clients[playerId];
  if (typeof client !== 'function') {
    throw new Error(`Missing simulation client for player ${playerId}.`);
  }
  return client;
}

function requireSimulationClients(
  clients: SimulationClients,
  playerIds: ReadonlyArray<PlayerId>
): void {
  for (const playerId of playerIds) {
    requireSimulationClient(clients, playerId);
  }
}

function transcriptStatus(state: GameState): MatchTranscriptStatus {
  return state.phase === 'game-over' ? 'game-over' : 'running';
}

function cloneBattle(battle: BattleState | null): BattleState | null {
  if (battle === null) {
    return null;
  }

  return {
    ...battle,
    fromProvinceIds: [...battle.fromProvinceIds]
  };
}

function cloneC64State(c64: C64CompatibilityState): C64CompatibilityState {
  return {
    ca61Bytes: [...c64.ca61Bytes],
    calendar: { ...c64.calendar },
    royalistReinforcementTimer: c64.royalistReinforcementTimer,
    deserterSoldiers: c64.deserterSoldiers,
    deserterOwnerId: c64.deserterOwnerId,
    playerMemory: c64.playerMemory.map((memory) => ({ ...memory })),
    royalistProvinceMemory: c64.royalistProvinceMemory.map((memory) => ({ ...memory }))
  };
}

function ownedProvinces(state: GameState, ownerId: OwnerId): MatchTranscriptProvinceSnapshot[] {
  return state.map.provinces.filter((province) => province.ownerId === ownerId);
}

function provinceSoldierCount(provinces: ReadonlyArray<MatchTranscriptProvinceSnapshot>): number {
  return provinces.reduce((total, province) => total + province.soldiers, 0);
}

function createOwnerSnapshot(
  state: GameState,
  config: GameConfig,
  ownerId: OwnerId
): MatchTranscriptOwnerSnapshot {
  const provinces = ownedProvinces(state, ownerId);
  return {
    ownerId,
    provinceCount: provinces.length,
    soldierCount: provinceSoldierCount(provinces),
    income: ownerId === ROYALIST_OWNER_ID ? 0 : calculateIncome(state.map, ownerId, config)
  };
}

function createPlayerSnapshot(
  state: GameState,
  config: GameConfig,
  playerId: PlayerId
): MatchTranscriptPlayerSnapshot {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) {
    throw new Error(`Missing transcript player ${playerId}.`);
  }

  const provinces = ownedProvinces(state, playerId);
  return {
    id: player.id,
    label: player.label,
    money: player.money,
    homeProvinceId: player.homeProvinceId,
    provinceCount: provinces.length,
    soldierCount: provinceSoldierCount(provinces),
    income: calculateIncome(state.map, playerId, config)
  };
}

export function createMatchTranscriptStateSnapshot(
  state: GameState,
  config: GameConfig
): MatchTranscriptStateSnapshot {
  return {
    rngState: state.rngState,
    activePlayerId: state.activePlayerId,
    phase: state.phase,
    turnStep: state.turnStep,
    turnNumber: state.turnNumber,
    winnerId: state.winnerId,
    attackSpentProvinceIds: [...state.attackSpentProvinceIds],
    battle: cloneBattle(state.battle),
    players: state.players.map((player) => createPlayerSnapshot(state, config, player.id)),
    owners: [
      createOwnerSnapshot(state, config, ROYALIST_OWNER_ID),
      ...state.players.map((player) => createOwnerSnapshot(state, config, player.id))
    ],
    provinces: state.map.provinces.map((province) => ({
      id: province.id,
      ownerId: province.ownerId,
      terrainId: province.terrainId,
      villages: province.villages,
      soldiers: province.soldiers,
      fortificationLevel: province.fortificationLevel,
      upgradedFortificationThisTurn: province.upgradedFortificationThisTurn,
      neighbours: [...province.neighbours]
    })),
    c64: cloneC64State(state.c64)
  };
}

function createTranscript(
  seed: number,
  maxSteps: number,
  state: GameState
): MatchTranscript {
  return {
    seed,
    maxSteps,
    status: transcriptStatus(state),
    winnerId: state.winnerId,
    finalTurnNumber: state.turnNumber,
    steps: []
  };
}

function withTranscriptState(
  transcript: MatchTranscript,
  state: GameState,
  status: MatchTranscriptStatus,
  steps: ReadonlyArray<MatchTranscriptStep>
): MatchTranscript {
  return {
    ...transcript,
    status,
    winnerId: state.winnerId,
    finalTurnNumber: state.turnNumber,
    steps
  };
}

function requireRunningTranscript(transcript: MatchTranscript): void {
  if (transcript.status !== 'running') {
    throw new Error(`Cannot step simulation with transcript status "${transcript.status}".`);
  }
}

export function createSimulation(input: RunMatchInput): SimulationRuntime {
  requirePositiveInteger(input.seed, 'Simulation seed');
  requirePositiveInteger(input.maxSteps, 'Simulation maxSteps');

  const config = input.config ?? DEFAULT_GAME_CONFIG;
  const state = createInitialState(input.seed, config);
  requireSimulationClients(input.clients, state.players.map((player) => player.id));
  validateGameState(state);

  return {
    state,
    config,
    clients: input.clients,
    transcript: createTranscript(input.seed, input.maxSteps, state)
  };
}

export function stepMatch(runtime: SimulationRuntime): SimulationRuntime {
  requireRunningTranscript(runtime.transcript);

  if (runtime.state.phase === 'game-over') {
    throw new Error('Cannot step a completed game.');
  }

  validateGameState(runtime.state);
  const playerId = runtime.state.activePlayerId;
  const client = requireSimulationClient(runtime.clients, playerId);
  const view = createPlayerView(runtime.state, playerId, runtime.config);
  const action = client(view);
  const before = createMatchTranscriptStateSnapshot(runtime.state, runtime.config);
  const result = applyPlayerAction(runtime.state, playerId, action, runtime.config);
  validateGameState(result.state);
  const after = createMatchTranscriptStateSnapshot(result.state, runtime.config);

  const step: MatchTranscriptStep = {
    stepNumber: runtime.transcript.steps.length + 1,
    playerId,
    turnNumber: runtime.state.turnNumber,
    phase: runtime.state.phase,
    turnStep: runtime.state.turnStep,
    action,
    events: result.events,
    before,
    after
  };
  const steps = [...runtime.transcript.steps, step];

  return {
    state: result.state,
    config: runtime.config,
    clients: runtime.clients,
    transcript: withTranscriptState(
      runtime.transcript,
      result.state,
      transcriptStatus(result.state),
      steps
    )
  };
}

export function runMatch(input: RunMatchInput): SimulationRuntime {
  let runtime = createSimulation(input);

  while (
    runtime.state.phase !== 'game-over' &&
    runtime.transcript.steps.length < input.maxSteps
  ) {
    runtime = stepMatch(runtime);
  }

  if (runtime.state.phase === 'game-over') {
    return {
      ...runtime,
      transcript: withTranscriptState(
        runtime.transcript,
        runtime.state,
        'game-over',
        runtime.transcript.steps
      )
    };
  }

  return {
    ...runtime,
    transcript: withTranscriptState(
      runtime.transcript,
      runtime.state,
      'step-limit-reached',
      runtime.transcript.steps
    )
  };
}
