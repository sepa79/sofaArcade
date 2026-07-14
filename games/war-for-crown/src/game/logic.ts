import {
  DEFAULT_GAME_CONFIG,
  PLAYER_HOME_FORTIFICATION_LEVEL
} from './constants';
import {
  c64BattleFinishSoldiers,
  c64BattleRound,
  c64CombatSetup,
  c64FortificationLevelForFortificationLevel,
  c64TerrainIdForTerrainId
} from './c64-battle';
import { calculateIncome } from './economy';
import { runC64MonthStart } from './c64-month-start';
import { runC64PlayerIncome } from './c64-income';
import { runC64RandomEvent } from './c64-events';
import { updateC64PlayerRank } from './c64-rank';
import { isPlayerOwner, isRoyalistOwner } from './owners';
import { runRoyalistWorldPhase } from './royalists';
import { nextRngByte } from './rng';
import {
  fortificationIndex,
  fortificationLevelAtIndex,
  nextFortificationLevel,
  provinceFortificationLimit,
} from './rules';
import { c64RetreatDistribution } from './c64-retreat';
import type {
  BattleResult,
  BattleRoundResult,
  BattleState,
  FortificationLevel,
  GameConfig,
  GameState,
  PlayerId,
  PlayerState,
  ProvinceId,
  ProvinceMapState,
  ProvinceState,
  TurnStep
} from './types';
import { c64HumanMovementRange, requireC64HumanMovementTarget } from './human-movement';
import type { OwnerId } from './owners';
import type { WarForCrownEvent } from './events';

const C64_24_BIT_MODULO = 0x1000000;

export interface AttackProvinceResult {
  readonly state: GameState;
  readonly battle: BattleState;
  readonly fromProvinceIds: ReadonlyArray<ProvinceId>;
  readonly attackingSoldiers: number;
}

export interface BattleActionResult {
  readonly state: GameState;
  readonly battle: BattleState;
  readonly round: BattleRoundResult;
  readonly result: BattleResult | null;
}

export interface AdvanceTurnStepResult {
  readonly state: GameState;
  readonly from: TurnStep;
  readonly to: TurnStep;
  readonly income: number;
  readonly endedPlayerId: PlayerId | null;
  readonly nextPlayerId: PlayerId | null;
  readonly events: ReadonlyArray<WarForCrownEvent>;
}

export interface EndTurnResult {
  readonly state: GameState;
  readonly endedPlayerId: PlayerId;
  readonly nextPlayerId: PlayerId;
  readonly events: ReadonlyArray<WarForCrownEvent>;
}

function requirePlayer(state: GameState, playerId: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) {
    throw new Error(`Unknown player id: ${playerId}.`);
  }
  return player;
}

function requireProvince(map: ProvinceMapState, provinceId: ProvinceId): ProvinceState {
  const province = map.provinces.find((candidate) => candidate.id === provinceId);
  if (province === undefined) {
    throw new Error(`Unknown province id: ${provinceId}.`);
  }
  return province;
}

function updateProvince(
  map: ProvinceMapState,
  provinceId: ProvinceId,
  update: (province: ProvinceState) => ProvinceState
): ProvinceMapState {
  return {
    ...map,
    provinces: map.provinces.map((province) =>
      province.id === provinceId ? update(province) : province
    )
  };
}

function updatePlayer(
  state: GameState,
  playerId: PlayerId,
  update: (player: PlayerState) => PlayerState
): ReadonlyArray<PlayerState> {
  return state.players.map((player) => (player.id === playerId ? update(player) : player));
}

function requireTurn(state: GameState, actionLabel: string): void {
  if (state.phase !== 'turn') {
    throw new Error(`Cannot ${actionLabel} during phase "${state.phase}".`);
  }
}

function requireNoActiveBattle(state: GameState, actionLabel: string): void {
  if (state.battle !== null) {
    throw new Error(`Cannot ${actionLabel} while battle is active.`);
  }
}

function requireActiveBattle(state: GameState, actionLabel: string): BattleState {
  const battle = state.battle;
  if (battle === null) {
    throw new Error(`Cannot ${actionLabel} without an active battle.`);
  }
  return battle;
}

function requireActiveTurnPlayer(state: GameState, playerId: PlayerId): void {
  if (state.activePlayerId !== playerId) {
    throw new Error(`It is ${state.activePlayerId}'s turn, not ${playerId}'s.`);
  }
}

function requireTurnStep(state: GameState, turnStep: TurnStep, actionLabel: string): void {
  if (state.turnStep !== turnStep) {
    throw new Error(`Cannot ${actionLabel} during turn step "${state.turnStep}".`);
  }
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer, got ${value}.`);
  }
}

function requireAffordable(player: PlayerState, cost: number): void {
  if (player.money < cost) {
    throw new Error(`Player ${player.id} has only ${player.money} money; ${cost} required.`);
  }
}

function requireFortificationNotAboveMax(level: FortificationLevel, maxLevel: FortificationLevel): void {
  if (fortificationIndex(level) > fortificationIndex(maxLevel)) {
    throw new Error(`Fortification level ${level} exceeds configured max ${maxLevel}.`);
  }
}

function resetFortificationUpgradeMarkers(map: ProvinceMapState): ProvinceMapState {
  return {
    ...map,
    provinces: map.provinces.map((province) => ({
      ...province,
      upgradedFortificationThisTurn: false
    }))
  };
}

function playerOwnsProvince(map: ProvinceMapState, playerId: PlayerId): boolean {
  return map.provinces.some((province) => province.ownerId === playerId);
}

function isLiveTurnPlayer(state: GameState, player: PlayerState): boolean {
  return player.homeProvinceId !== null && playerOwnsProvince(state.map, player.id);
}

function nextTurnPlayer(state: GameState): { readonly playerId: PlayerId; readonly startsNewRound: boolean } {
  const activeIndex = state.players.findIndex((player) => player.id === state.activePlayerId);
  if (activeIndex === -1) {
    throw new Error(`Active player ${state.activePlayerId} does not exist.`);
  }

  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const nextIndex = (activeIndex + offset) % state.players.length;
    const nextPlayer = state.players[nextIndex];
    if (nextPlayer === undefined) {
      throw new Error(`Missing next player at index ${nextIndex}.`);
    }

    if (!isLiveTurnPlayer(state, nextPlayer)) {
      continue;
    }

    return {
      playerId: nextPlayer.id,
      startsNewRound: nextIndex <= activeIndex
    };
  }

  throw new Error('Cannot find a live next turn player.');
}

function advanceToNextPlayer(
  state: GameState,
  config: GameConfig
): { readonly state: GameState; readonly events: ReadonlyArray<WarForCrownEvent> } {
  const nextPlayer = nextTurnPlayer(state);
  const nextState: GameState = {
    ...state,
    activePlayerId: nextPlayer.playerId,
    turnStep: 'new-month',
    turnNumber: nextPlayer.startsNewRound ? state.turnNumber + 1 : state.turnNumber,
    attackSpentProvinceIds: [],
    map: resetFortificationUpgradeMarkers(state.map),
    c64: nextPlayer.startsNewRound
      ? {
          ...state.c64,
          calendar: {
            ...state.c64.calendar,
            monthWeatherPending: true
          }
        }
      : state.c64
  };

  if (!nextPlayer.startsNewRound) {
    return {
      state: nextState,
      events: []
    };
  }

  return runRoyalistWorldPhase(nextState, config);
}

function nextHomeSelectionPlayer(players: ReadonlyArray<PlayerState>): PlayerId | null {
  const player = players.find((candidate) => candidate.homeProvinceId === null);
  return player?.id ?? null;
}

function winnerId(map: ProvinceMapState): OwnerId | null {
  const firstOwner = map.provinces[0]?.ownerId;
  if (firstOwner === undefined) {
    return null;
  }

  return map.provinces.every((province) => province.ownerId === firstOwner) ? firstOwner : null;
}

export function selectHomeProvince(
  state: GameState,
  playerId: PlayerId,
  provinceId: ProvinceId,
  config: GameConfig = DEFAULT_GAME_CONFIG
): GameState {
  if (state.phase !== 'home-selection') {
    throw new Error(`Cannot select home province during phase "${state.phase}".`);
  }

  if (state.activePlayerId !== playerId) {
    throw new Error(`It is ${state.activePlayerId}'s home selection, not ${playerId}'s.`);
  }

  const province = requireProvince(state.map, provinceId);
  if (!isRoyalistOwner(province.ownerId)) {
    throw new Error(`Province ${provinceId} is already owned.`);
  }

  const player = requirePlayer(state, playerId);
  if (player.homeProvinceId !== null) {
    throw new Error(`Player ${playerId} already has a home province.`);
  }

  requireFortificationNotAboveMax(PLAYER_HOME_FORTIFICATION_LEVEL, config.maxHomeFortificationLevel);

  const players = updatePlayer(state, playerId, (candidate) => ({
    ...candidate,
    homeProvinceId: provinceId
  }));
  const map = updateProvince(state.map, provinceId, (candidate) => ({
    ...candidate,
    ownerId: playerId,
    soldiers: config.startingSoldiers,
    fortificationLevel: PLAYER_HOME_FORTIFICATION_LEVEL
  }));
  const nextPlayerId = nextHomeSelectionPlayer(players);

  return {
    ...state,
    phase: nextPlayerId === null ? 'turn' : 'home-selection',
    map,
    players,
    activePlayerId: nextPlayerId ?? players[0]?.id ?? playerId
  };
}

export function collectIncome(
  state: GameState,
  playerId: PlayerId,
  config: GameConfig = DEFAULT_GAME_CONFIG
): GameState {
  requirePlayer(state, playerId);
  const income = calculateIncome(state.map, playerId, config);
  return {
    ...state,
    players: updatePlayer(state, playerId, (player) => ({
      ...player,
      money: (player.money + income) % 0x1000000
    }))
  };
}

export function advanceTurnStep(
  state: GameState,
  playerId: PlayerId,
  config: GameConfig = DEFAULT_GAME_CONFIG
): AdvanceTurnStepResult {
  requireTurn(state, 'advance step');
  requireNoActiveBattle(state, 'advance step');
  requireActiveTurnPlayer(state, playerId);

  const from = state.turnStep;
  if (from === 'new-month') {
    const stateAtIncome = state.c64.calendar.monthWeatherPending
      ? runC64MonthStart(state, config)
      : state;
    const rankedState = updateC64PlayerRank(stateAtIncome, playerId);
    const incomeResult = runC64PlayerIncome(rankedState, playerId, config);
    const randomEvent = runC64RandomEvent(incomeResult.state, config);
    const events: WarForCrownEvent[] = randomEvent.resolution === null
      ? []
      : [{
          type: 'c64-random-event',
          playerId,
          eventId: randomEvent.resolution.eventId,
          effect: randomEvent.resolution.effect,
          amount: randomEvent.resolution.amount,
          provinceId: randomEvent.resolution.provinceId
        }];
    return {
      state: {
        ...randomEvent.state,
        turnStep: 'attack',
        attackSpentProvinceIds: []
      },
      from,
      to: 'attack',
      income: incomeResult.income,
      endedPlayerId: null,
      nextPlayerId: null,
      events
    };
  }

  if (from === 'attack') {
    return {
      state: {
        ...state,
        turnStep: 'movement',
        attackSpentProvinceIds: []
      },
      from,
      to: 'movement',
      income: 0,
      endedPlayerId: null,
      nextPlayerId: null,
      events: []
    };
  }

  if (from === 'movement') {
    return {
      state: {
        ...state,
        turnStep: 'investment'
      },
      from,
      to: 'investment',
      income: 0,
      endedPlayerId: null,
      nextPlayerId: null,
      events: []
    };
  }

  const next = advanceToNextPlayer(state, config);
  return {
    state: next.state,
    from,
    to: next.state.turnStep,
    income: 0,
    endedPlayerId: playerId,
    nextPlayerId: next.state.activePlayerId,
    events: next.events
  };
}

export function endTurn(state: GameState, config: GameConfig = DEFAULT_GAME_CONFIG): GameState {
  return endTurnWithResult(state, config).state;
}

export function endTurnWithResult(
  state: GameState,
  config: GameConfig = DEFAULT_GAME_CONFIG
): EndTurnResult {
  requireTurn(state, 'end turn');
  requireNoActiveBattle(state, 'end turn');
  const endedPlayerId = state.activePlayerId;
  const next = advanceToNextPlayer(state, config);
  return {
    state: next.state,
    endedPlayerId,
    nextPlayerId: next.state.activePlayerId,
    events: next.events
  };
}

export function recruitSoldiers(
  state: GameState,
  playerId: PlayerId,
  soldiers: number,
  config: GameConfig = DEFAULT_GAME_CONFIG
): GameState {
  requireTurn(state, 'recruit soldiers');
  requireNoActiveBattle(state, 'recruit soldiers');
  requireActiveTurnPlayer(state, playerId);
  requireTurnStep(state, 'investment', 'recruit soldiers');
  requirePositiveInteger(soldiers, 'Recruit soldiers');
  requirePositiveInteger(config.soldierCost, 'Soldier cost');

  const player = requirePlayer(state, playerId);
  if (player.homeProvinceId === null) {
    throw new Error(`Player ${playerId} has no home province for recruitment.`);
  }

  const homeProvince = requireProvince(state.map, player.homeProvinceId);
  if (homeProvince.ownerId !== playerId) {
    throw new Error(`Home province ${homeProvince.id} is not owned by ${playerId}.`);
  }

  const cost = soldiers * config.soldierCost;
  requireAffordable(player, cost);

  return {
    ...state,
    map: updateProvince(state.map, homeProvince.id, (province) => ({
      ...province,
      soldiers: province.soldiers + soldiers
    })),
    players: updatePlayer(state, playerId, (candidate) => ({
      ...candidate,
      money: candidate.money - cost
    }))
  };
}

export function buildVillage(
  state: GameState,
  playerId: PlayerId,
  provinceId: ProvinceId,
  config: GameConfig = DEFAULT_GAME_CONFIG
): GameState {
  requireTurn(state, 'build village');
  requireNoActiveBattle(state, 'build village');
  requireActiveTurnPlayer(state, playerId);
  requireTurnStep(state, 'investment', 'build village');
  requirePositiveInteger(config.villageCost, 'Village cost');
  requirePositiveInteger(config.maxVillages, 'Max villages');

  const province = requireProvince(state.map, provinceId);
  if (province.ownerId !== playerId) {
    throw new Error(`Province ${provinceId} is not owned by ${playerId}.`);
  }

  if (province.villages >= config.maxVillages) {
    throw new Error(`Province ${provinceId} already has ${province.villages} villages.`);
  }

  const player = requirePlayer(state, playerId);
  requireAffordable(player, config.villageCost);

  return {
    ...state,
    map: updateProvince(state.map, provinceId, (candidate) => ({
      ...candidate,
      villages: candidate.villages + 1
    })),
    players: updatePlayer(state, playerId, (candidate) => ({
      ...candidate,
      money: candidate.money - config.villageCost
    }))
  };
}

export function upgradeFortification(
  state: GameState,
  playerId: PlayerId,
  provinceId: ProvinceId,
  config: GameConfig = DEFAULT_GAME_CONFIG
): GameState {
  requireTurn(state, 'upgrade fortification');
  requireNoActiveBattle(state, 'upgrade fortification');
  requireActiveTurnPlayer(state, playerId);
  requireTurnStep(state, 'investment', 'upgrade fortification');
  requirePositiveInteger(config.fortificationUpgradeCost, 'Fortification upgrade cost');

  const province = requireProvince(state.map, provinceId);
  if (province.ownerId !== playerId) {
    throw new Error(`Province ${provinceId} is not owned by ${playerId}.`);
  }

  if (province.upgradedFortificationThisTurn) {
    throw new Error(`Province ${provinceId} already upgraded fortification this turn.`);
  }

  const maxLevel = provinceFortificationLimit(
    province,
    config,
    state.players.some((player) => player.homeProvinceId === province.id)
  );
  const nextLevel = nextFortificationLevel(province.fortificationLevel, maxLevel);
  const player = requirePlayer(state, playerId);
  requireAffordable(player, config.fortificationUpgradeCost);

  return {
    ...state,
    map: updateProvince(state.map, provinceId, (candidate) => ({
      ...candidate,
      fortificationLevel: nextLevel,
      upgradedFortificationThisTurn: true
    })),
    players: updatePlayer(state, playerId, (candidate) => ({
      ...candidate,
      money: candidate.money - config.fortificationUpgradeCost
    }))
  };
}

export function moveSoldiers(
  state: GameState,
  playerId: PlayerId,
  fromProvinceId: ProvinceId,
  targetProvinceId: ProvinceId,
  targetSoldiers: number
): GameState {
  requireTurn(state, 'move soldiers');
  requireNoActiveBattle(state, 'move soldiers');
  requireActiveTurnPlayer(state, playerId);
  requireTurnStep(state, 'movement', 'move soldiers');
  requirePositiveInteger(targetSoldiers, 'Movement target soldiers');

  const { source: fromProvince, target: targetProvince } = requireC64HumanMovementTarget(
    state.map,
    playerId,
    fromProvinceId,
    targetProvinceId
  );
  const range = c64HumanMovementRange(fromProvince, targetProvince);
  if (targetSoldiers > range.maximumTargetSoldiers) {
    throw new Error(
      `Movement target soldiers must be ${range.minimumTargetSoldiers}..${range.maximumTargetSoldiers}, got ${targetSoldiers}.`
    );
  }
  const sourceSoldiers = fromProvince.soldiers + targetProvince.soldiers - targetSoldiers;

  const mapAfterSource = updateProvince(state.map, fromProvinceId, (province) => ({
    ...province,
    soldiers: sourceSoldiers
  }));

  return {
    ...state,
    map: updateProvince(mapAfterSource, targetProvinceId, (province) => ({
      ...province,
      soldiers: targetSoldiers
    }))
  };
}

export function attackProvince(
  state: GameState,
  attackerId: PlayerId,
  fromProvinceIds: ReadonlyArray<ProvinceId>,
  targetProvinceId: ProvinceId,
  config: GameConfig = DEFAULT_GAME_CONFIG
): GameState {
  return attackProvinceWithResult(
    state,
    attackerId,
    fromProvinceIds,
    targetProvinceId,
    config
  ).state;
}

export function attackProvinceWithResult(
  state: GameState,
  attackerId: PlayerId,
  fromProvinceIds: ReadonlyArray<ProvinceId>,
  targetProvinceId: ProvinceId,
  config: GameConfig = DEFAULT_GAME_CONFIG
): AttackProvinceResult {
  requireTurn(state, 'attack');
  requireNoActiveBattle(state, 'attack');
  requireActiveTurnPlayer(state, attackerId);
  requireTurnStep(state, 'attack', 'attack');

  if (fromProvinceIds.length < 1) {
    throw new Error('Attack must include at least one source province.');
  }

  const uniqueSourceIds = new Set(fromProvinceIds);
  if (uniqueSourceIds.size !== fromProvinceIds.length) {
    throw new Error('Attack source provinces must be unique.');
  }

  const targetProvince = requireProvince(state.map, targetProvinceId);

  if (targetProvince.ownerId === attackerId) {
    throw new Error(`Province ${targetProvinceId} is already owned by ${attackerId}.`);
  }

  const fromProvinces = fromProvinceIds.map((provinceId) => {
    const province = requireProvince(state.map, provinceId);
    if (province.ownerId !== attackerId) {
      throw new Error(`Province ${provinceId} is not owned by ${attackerId}.`);
    }

    if (state.attackSpentProvinceIds.includes(provinceId)) {
      throw new Error(`Province ${provinceId} has already committed soldiers this attack phase.`);
    }

    if (!province.neighbours.includes(targetProvinceId)) {
      throw new Error(`Province ${targetProvinceId} is not adjacent to ${provinceId}.`);
    }

    if (province.soldiers < 2) {
      throw new Error(`Province ${provinceId} has no mobile soldiers for attack.`);
    }

    return province;
  });

  const attackingSoldiers = fromProvinces.reduce(
    (total, province) => (total + province.soldiers - 1) % C64_24_BIT_MODULO,
    0
  );
  requirePositiveInteger(attackingSoldiers, 'Attack soldiers');

  const combatSetup = c64CombatSetup({
    terrainId: c64TerrainIdForTerrainId(targetProvince.terrainId),
    fortificationLevel: c64FortificationLevelForFortificationLevel(targetProvince.fortificationLevel),
    terrainInfluence: config.terrainInfluence,
    attackerFullRuleBonus: 0,
    defenderFullRuleBonus: 0
  });
  const battle: BattleState = {
    attackerId,
    defenderId: targetProvince.ownerId,
    fromProvinceIds,
    targetProvinceId,
    attackerSoldiers: attackingSoldiers,
    defenderSoldiers: targetProvince.soldiers,
    attackerInitialSoldiers: attackingSoldiers,
    defenderInitialSoldiers: targetProvince.soldiers,
    attackerCombatPercent: combatSetup.attackerCombatPercent,
    defenderCombatPercent: combatSetup.defenderCombatPercent,
    attackerHitDenominator: combatSetup.attackerHitDenominator,
    defenderHitDenominator: combatSetup.defenderHitDenominator,
    round: 0,
    retreatSide: null
  };

  let map = state.map;
  for (const province of fromProvinces) {
    map = updateProvince(map, province.id, (candidate) => ({
      ...candidate,
      soldiers: 1
    }));
  }
  if (targetProvince.fortificationLevel !== 'none') {
    map = updateProvince(map, targetProvince.id, (candidate) => ({
      ...candidate,
      fortificationLevel: fortificationLevelAtIndex(
        fortificationIndex(candidate.fortificationLevel) - 1
      )
    }));
  }

  return {
    state: {
      ...state,
      map,
      attackSpentProvinceIds: [...state.attackSpentProvinceIds, ...fromProvinceIds],
      battle
    },
    battle,
    fromProvinceIds,
    attackingSoldiers
  };
}

function battleResult(
  battle: BattleState,
  winner: BattleResult['winner'],
  resolution: BattleResult['resolution']
): BattleResult {
  return {
    winner,
    resolution,
    attackerLosses: battle.attackerInitialSoldiers - battle.attackerSoldiers,
    defenderLosses: battle.defenderInitialSoldiers - battle.defenderSoldiers,
    survivingAttackers: battle.attackerSoldiers,
    survivingDefenders: battle.defenderSoldiers,
    attackStrength: battle.attackerInitialSoldiers * battle.attackerCombatPercent,
    defenceStrength: battle.defenderInitialSoldiers * battle.defenderCombatPercent
  };
}

function isHomeProvince(state: GameState, ownerId: OwnerId, provinceId: ProvinceId): boolean {
  if (!isPlayerOwner(ownerId)) {
    return false;
  }

  return requirePlayer(state, ownerId).homeProvinceId === provinceId;
}

function provinceScanOrder(map: ProvinceMapState): ReadonlyArray<ProvinceId> {
  return map.provinces.map((province) => province.id);
}

function addDistributedSoldiers(
  map: ProvinceMapState,
  provinceIds: ReadonlyArray<ProvinceId>,
  soldiers: number
): ProvinceMapState {
  let nextMap = map;
  for (const addition of c64RetreatDistribution({
    provinceIds,
    provinceScanOrder: provinceScanOrder(map),
    survivors: soldiers
  })) {
    nextMap = updateProvince(nextMap, addition.provinceId, (province) => ({
      ...province,
      soldiers: (province.soldiers + addition.addedSoldiers) % C64_24_BIT_MODULO
    }));
  }

  return nextMap;
}

function eliminatePlayerAfterHomeCapture(
  map: ProvinceMapState,
  players: ReadonlyArray<PlayerState>,
  defeatedPlayerId: PlayerId,
  victorOwnerId: OwnerId
): {
  readonly map: ProvinceMapState;
  readonly players: ReadonlyArray<PlayerState>;
  readonly transferredProvinceIds: ReadonlyArray<ProvinceId>;
} {
  const transferredProvinceIds: ProvinceId[] = [];
  return {
    map: {
      ...map,
      provinces: map.provinces.map((province) => {
        if (province.ownerId !== defeatedPlayerId) {
          return province;
        }

        transferredProvinceIds.push(province.id);
        return {
          ...province,
          ownerId: victorOwnerId
        };
      })
    },
    players,
    transferredProvinceIds
  };
}

export function defenderRetreatProvinceIds(state: GameState): ReadonlyArray<ProvinceId> {
  const battle = requireActiveBattle(state, 'find defender retreat');
  if (isHomeProvince(state, battle.defenderId, battle.targetProvinceId)) {
    return [];
  }

  const target = requireProvince(state.map, battle.targetProvinceId);
  return state.map.provinces
    .filter(
      (province) =>
        province.id !== battle.targetProvinceId &&
        province.ownerId === battle.defenderId &&
        target.neighbours.includes(province.id)
    )
    .map((province) => province.id);
}

export function defenderRetreatProvinceId(state: GameState): ProvinceId | null {
  const provinceIds = defenderRetreatProvinceIds(state);
  return provinceIds[0] ?? null;
}

function requireDefenderRetreatProvinceIds(state: GameState): ReadonlyArray<ProvinceId> {
  const provinceIds = defenderRetreatProvinceIds(state);
  if (provinceIds.length < 1) {
    throw new Error('Defender retreat requires a legal retreat province.');
  }

  return provinceIds;
}

function finishBattle(state: GameState, battle: BattleState, result: BattleResult): GameState {
  let map = state.map;
  let players = state.players;
  let attackSpentProvinceIds = state.attackSpentProvinceIds;

  if (result.resolution === 'attacker-retreat') {
    map = addDistributedSoldiers(map, battle.fromProvinceIds, battle.attackerSoldiers);
    map = updateProvince(map, battle.targetProvinceId, (province) => ({
      ...province,
      soldiers: battle.defenderSoldiers
    }));
  } else if (result.resolution === 'defender-retreat') {
    const retreatProvinceIds = requireDefenderRetreatProvinceIds({ ...state, battle });

    map = updateProvince(map, battle.targetProvinceId, (province) => ({
      ...province,
      ownerId: battle.attackerId,
      soldiers: battle.attackerSoldiers
    }));
    attackSpentProvinceIds = [...attackSpentProvinceIds, battle.targetProvinceId];
    map = addDistributedSoldiers(map, retreatProvinceIds, battle.defenderSoldiers);
  } else {
    map = updateProvince(map, battle.targetProvinceId, (province) => ({
      ...province,
      ownerId: result.winner === 'attacker' ? battle.attackerId : province.ownerId,
      soldiers: result.winner === 'attacker' ? battle.attackerSoldiers : battle.defenderSoldiers
    }));
    if (result.winner === 'attacker') {
      attackSpentProvinceIds = [...attackSpentProvinceIds, battle.targetProvinceId];
    }
  }

  if (
    result.winner === 'attacker' &&
    isPlayerOwner(battle.defenderId) &&
    isHomeProvince(state, battle.defenderId, battle.targetProvinceId)
  ) {
    const elimination = eliminatePlayerAfterHomeCapture(
      map,
      players,
      battle.defenderId,
      battle.attackerId
    );
    map = elimination.map;
    players = elimination.players;
  }

  const winner = winnerId(map);
  return {
    ...state,
    players,
    phase: winner === null ? 'turn' : 'game-over',
    map,
    winnerId: winner,
    attackSpentProvinceIds,
    battle: null
  };
}

function resolveBattleAction(
  state: GameState,
  ownerId: OwnerId,
  retreatSide: BattleState['retreatSide']
): BattleActionResult {
  requireTurn(state, 'resolve battle');
  requireTurnStep(state, 'attack', 'resolve battle');
  const currentBattle = requireActiveBattle(state, 'resolve battle');
  if (retreatSide === 'defender') {
    if (currentBattle.defenderId !== ownerId) {
      throw new Error(`Defender retreat must be issued by defender ${currentBattle.defenderId}.`);
    }
  } else if (currentBattle.attackerId !== ownerId) {
    throw new Error(`Battle command must be issued by attacker ${currentBattle.attackerId}.`);
  }

  const attackerRng = nextRngByte(state.rngState);
  const defenderRng = nextRngByte(attackerRng.rngState);
  const stateAfterRng: GameState = {
    ...state,
    rngState: defenderRng.rngState
  };
  const round = c64BattleRound({
    attackerSoldiers: currentBattle.attackerSoldiers,
    defenderSoldiers: currentBattle.defenderSoldiers,
    attackerCombatPercent: currentBattle.attackerCombatPercent,
    defenderCombatPercent: currentBattle.defenderCombatPercent,
    attackerHitDenominator: currentBattle.attackerHitDenominator,
    defenderHitDenominator: currentBattle.defenderHitDenominator,
    defenderRngByte: defenderRng.byte,
    attackerRngByte: attackerRng.byte
  });
  const finishSoldiers = c64BattleFinishSoldiers(round);
  const battle: BattleState = {
    ...currentBattle,
    attackerSoldiers: finishSoldiers.attackerSoldiers,
    defenderSoldiers: finishSoldiers.defenderSoldiers,
    round: currentBattle.round + 1,
    retreatSide
  };

  const result =
    battle.attackerSoldiers < 1
      ? battleResult(battle, 'defender', 'elimination')
      : battle.defenderSoldiers < 1
        ? battleResult(battle, 'attacker', 'elimination')
        : retreatSide === 'attacker'
          ? battleResult(battle, 'defender', 'attacker-retreat')
          : retreatSide === 'defender'
            ? battleResult(battle, 'attacker', 'defender-retreat')
            : null;

  if (result === null) {
    return {
      state: {
        ...stateAfterRng,
        battle
      },
      battle,
      round,
      result
    };
  }

  return {
    state: finishBattle(stateAfterRng, battle, result),
    battle,
    round,
    result
  };
}

export function fightBattleRound(state: GameState, playerId: PlayerId): BattleActionResult {
  return resolveBattleAction(state, playerId, null);
}

export function retreatAttackerFromBattle(state: GameState, playerId: PlayerId): BattleActionResult {
  return resolveBattleAction(state, playerId, 'attacker');
}

export function retreatDefenderFromBattle(state: GameState, playerId: PlayerId): BattleActionResult {
  if (defenderRetreatProvinceId(state) === null) {
    throw new Error('Defender has no legal retreat province.');
  }
  return resolveBattleAction(state, playerId, 'defender');
}

export function retreatDefenderFromBattleByOwner(state: GameState): BattleActionResult {
  const battle = requireActiveBattle(state, 'resolve C64 defender retreat');
  if (defenderRetreatProvinceId(state) === null) {
    throw new Error('Defender has no legal retreat province.');
  }
  return resolveBattleAction(state, battle.defenderId, 'defender');
}
