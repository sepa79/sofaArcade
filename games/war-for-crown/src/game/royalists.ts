import {
  C64_ROYALIST_ATTACK_THRESHOLD_LOOSE,
  C64_ROYALIST_ATTACK_THRESHOLD_STRICT,
  c64BattleMeetsThreshold
} from './battle-ai';
import {
  c64BattleFinishSoldiers,
  c64BattleRound,
  c64CombatSetupForProvince
} from './c64-battle';
import { calculateC64ProvinceIncome } from './c64-economy';
import { c64RetreatDistribution } from './c64-retreat';
import { requireC64RoyalistProvinceMemory } from './c64-state';
import { buildMapProvinceTileCounts, provinceVillageCap } from './map';
import { isPlayerOwner, isRoyalistOwner, ROYALIST_OWNER_ID } from './owners';
import { nextRngByte } from './rng';
import { fortificationIndex, fortificationLevelAtIndex } from './rules';
import type { WarForCrownEvent } from './events';
import type {
  BattleResult,
  C64RoyalistProvinceMemory,
  GameConfig,
  GameState,
  PlayerId,
  ProvinceId,
  ProvinceMapState,
  ProvinceState
} from './types';

interface RoyalistAttackCandidate {
  readonly target: ProvinceState;
  readonly sources: ReadonlyArray<ProvinceState>;
  readonly attackingSoldiers: number;
}

interface RoyalistBattleResolution {
  readonly rngState: number;
  readonly result: BattleResult;
}

interface C64RoyalistProductionBytes {
  readonly villageInvestmentByte: number;
  readonly fortificationInvestmentByte: number;
}

const C64_24_BIT_MODULO = 0x1000000;

function c64Add24Bit(left: number, right: number): number {
  return (left + right) % C64_24_BIT_MODULO;
}

export interface RoyalistWorldPhaseResult {
  readonly state: GameState;
  readonly events: ReadonlyArray<WarForCrownEvent>;
}

export function runHostileRoyalistAttackPhase(
  state: GameState,
  config: GameConfig
): RoyalistWorldPhaseResult {
  if (config.royalistAttitude !== 'hostile') {
    throw new Error('Hostile royalist attack phase requires hostile royalist attitude.');
  }

  let nextState = state;
  const events: WarForCrownEvent[] = [];
  for (;;) {
    const candidate = royalistAttackCandidate(nextState, config);
    if (candidate === null) {
      return { state: nextState, events };
    }
    const result = applyRoyalistAttack(nextState, config, candidate);
    nextState = result.state;
    events.push(...result.events);
  }
}

const C64_ROYALIST_FORTIFICATION_COSTS: ReadonlyArray<number> = [
  0x14, 0x1e, 0x28, 0x32, 0x3c, 0x50, 0x00, 0x96,
  0x64, 0x8c, 0x82, 0x78, 0x64, 0x6e, 0x4c, 0x93,
  0x51, 0x4c, 0x34, 0x51, 0x4c, 0x4a, 0x51, 0x4c,
  0xb7, 0x50, 0x4c, 0x49, 0x4f, 0x4c, 0xa7, 0x4f
];

function requireNonNegativeByte(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`${label} must be an integer from 0 to 255, got ${value}.`);
  }
}

function requirePositiveByte(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 0xff) {
    throw new Error(`${label} must be an integer from 1 to 255, got ${value}.`);
  }
}

function c64ByteAdd(left: number, right: number): number {
  requireNonNegativeByte(left, 'C64 byte add left');
  requireNonNegativeByte(right, 'C64 byte add right');

  return (left + right) & 0xff;
}

function c64ProductHighByte(left: number, right: number): number {
  requireNonNegativeByte(left, 'C64 multiplication left');
  requireNonNegativeByte(right, 'C64 multiplication right');

  return Math.floor((left * right) / 0x100);
}

function c64RoyalistProductionBytes(config: GameConfig): C64RoyalistProductionBytes {
  requireNonNegativeByte(config.royalistGrowthPercent, 'C64 royalist growth factor');
  requireNonNegativeByte(config.royalistInvestmentPercent, 'C64 royalist village investment');
  requireNonNegativeByte(
    config.royalistFortificationInvestmentPercent,
    'C64 royalist fortification investment'
  );

  const total =
    config.royalistGrowthPercent +
    config.royalistInvestmentPercent +
    config.royalistFortificationInvestmentPercent;
  if (total < 1) {
    throw new Error('C64 royalist production weights must sum to at least 1.');
  }

  return {
    villageInvestmentByte: Math.floor((config.royalistInvestmentPercent * 0x100) / total),
    fortificationInvestmentByte: Math.floor(
      (config.royalistFortificationInvestmentPercent * 0x100) / total
    )
  };
}

function provinceOrder(map: ProvinceMapState): ReadonlyMap<ProvinceId, number> {
  return new Map(map.provinces.map((province, index) => [province.id, index]));
}

function compareByDescendingC64Order(
  order: ReadonlyMap<ProvinceId, number>,
  left: ProvinceId,
  right: ProvinceId
): number {
  const leftIndex = order.get(left);
  if (leftIndex === undefined) {
    throw new Error(`Missing C64 province order for ${left}.`);
  }

  const rightIndex = order.get(right);
  if (rightIndex === undefined) {
    throw new Error(`Missing C64 province order for ${right}.`);
  }

  return rightIndex - leftIndex;
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
      soldiers: c64Add24Bit(province.soldiers, addition.addedSoldiers)
    }));
  }

  return nextMap;
}

function playerOwnsProvince(map: ProvinceMapState, playerId: PlayerId): boolean {
  return map.provinces.some((province) => province.ownerId === playerId);
}

function livePlayerIds(state: GameState): ReadonlyArray<PlayerId> {
  return state.players
    .filter((player) => player.homeProvinceId !== null && playerOwnsProvince(state.map, player.id))
    .map((player) => player.id);
}

function isPlayerHomeProvince(state: GameState, playerId: PlayerId, provinceId: ProvinceId): boolean {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) {
    throw new Error(`Unknown player id: ${playerId}.`);
  }

  return player.homeProvinceId === provinceId;
}

function eliminatePlayerToRoyalists(state: GameState, playerId: PlayerId): GameState {
  return {
    ...state,
    map: {
      ...state.map,
      provinces: state.map.provinces.map((province) =>
        province.ownerId === playerId
          ? {
              ...province,
              ownerId: ROYALIST_OWNER_ID
            }
          : province
      )
    }
  };
}

function finishRoyalistWorldPhaseState(state: GameState): GameState {
  const liveIds = livePlayerIds(state);
  if (liveIds.length === 0) {
    return {
      ...state,
      phase: 'game-over',
      winnerId: ROYALIST_OWNER_ID
    };
  }

  if (state.map.provinces.every((province) => province.ownerId === liveIds[0])) {
    return {
      ...state,
      phase: 'game-over',
      activePlayerId: liveIds[0],
      winnerId: liveIds[0]
    };
  }

  if (liveIds.includes(state.activePlayerId)) {
    return state;
  }

  return {
    ...state,
    activePlayerId: liveIds[0]
  };
}

function mobileSoldiers(province: ProvinceState): number {
  return Math.max(0, province.soldiers - 1);
}

function royalistAttackSources(
  map: ProvinceMapState,
  target: ProvinceState,
  config: GameConfig
): ReadonlyArray<ProvinceState> {
  const order = provinceOrder(map);
  const sources = target.neighbours
    .map((provinceId) => requireProvince(map, provinceId))
    .filter((province) => isRoyalistOwner(province.ownerId) && mobileSoldiers(province) > 0)
    .sort((left, right) => compareByDescendingC64Order(order, left.id, right.id));
  return config.royalistAttackCooperation === 'single-source'
    ? sources.slice(0, 1)
    : sources;
}

function royalistAttackThreshold(config: GameConfig): number {
  return config.royalistAttackThreshold === 'loose'
    ? C64_ROYALIST_ATTACK_THRESHOLD_LOOSE
    : C64_ROYALIST_ATTACK_THRESHOLD_STRICT;
}

function royalistComponent(
  map: ProvinceMapState,
  startProvinceId: ProvinceId,
  seen: Set<ProvinceId>
): ReadonlyArray<ProvinceState> {
  const component: ProvinceState[] = [];
  const stack = [startProvinceId];
  seen.add(startProvinceId);

  while (stack.length > 0) {
    const provinceId = stack.pop();
    if (provinceId === undefined) {
      throw new Error('Missing royalist component stack item.');
    }

    const province = requireProvince(map, provinceId);
    if (!isRoyalistOwner(province.ownerId)) {
      throw new Error(`Province ${province.id} is not royalist-owned.`);
    }

    component.push(province);
    for (const neighbourId of province.neighbours) {
      const neighbour = requireProvince(map, neighbourId);
      if (!isRoyalistOwner(neighbour.ownerId) || seen.has(neighbour.id)) {
        continue;
      }
      seen.add(neighbour.id);
      stack.push(neighbour.id);
    }
  }

  return component;
}

function royalistComponents(map: ProvinceMapState): ReadonlyArray<ReadonlyArray<ProvinceState>> {
  const order = provinceOrder(map);
  const seen = new Set<ProvinceId>();
  const components: ReadonlyArray<ProvinceState>[] = [];
  const royalistProvinces = map.provinces
    .filter((province) => isRoyalistOwner(province.ownerId))
    .sort((left, right) => compareByDescendingC64Order(order, left.id, right.id));

  for (const province of royalistProvinces) {
    if (seen.has(province.id)) {
      continue;
    }
    components.push(royalistComponent(map, province.id, seen));
  }

  return components;
}

function royalistFrontierTargets(
  map: ProvinceMapState,
  component: ReadonlyArray<ProvinceState>
): ReadonlyArray<ProvinceState> {
  return component.filter((province) =>
    province.neighbours.some((neighbourId) => isPlayerOwner(requireProvince(map, neighbourId).ownerId))
  );
}

function distributeSoldiersOverTargets(
  map: ProvinceMapState,
  targets: ReadonlyArray<ProvinceState>,
  soldiers: number
): ProvinceMapState {
  if (soldiers < 1) {
    return map;
  }

  if (targets.length < 1) {
    throw new Error('Royalist distribution requires at least one target province.');
  }

  const order = provinceOrder(map);
  const sortedTargets = [...targets].sort((left, right) =>
    compareByDescendingC64Order(order, left.id, right.id)
  );
  const base = Math.floor(soldiers / sortedTargets.length);
  const remainder = soldiers % sortedTargets.length;
  let nextMap = map;

  sortedTargets.forEach((target, index) => {
    const addedSoldiers = base + (index < remainder ? 1 : 0);
    nextMap = updateProvince(nextMap, target.id, (province) => ({
      ...province,
      soldiers: c64Add24Bit(province.soldiers, addedSoldiers)
    }));
  });

  return nextMap;
}

function c64FortificationUpgradeCost(province: ProvinceState): number {
  const cost = C64_ROYALIST_FORTIFICATION_COSTS[fortificationIndex(province.fortificationLevel)];
  if (cost === undefined) {
    throw new Error(`Missing C64 fortification upgrade cost for ${province.fortificationLevel}.`);
  }

  return cost;
}

function setRoyalistMemory(
  memory: ReadonlyArray<C64RoyalistProvinceMemory>,
  provinceId: ProvinceId,
  villageInvestmentBucket: number,
  fortificationInvestmentBucket: number
): ReadonlyArray<C64RoyalistProvinceMemory> {
  requireNonNegativeByte(villageInvestmentBucket, `C64 royalist village bucket for ${provinceId}`);
  requireNonNegativeByte(
    fortificationInvestmentBucket,
    `C64 royalist fortification bucket for ${provinceId}`
  );

  return memory.map((candidate) =>
    candidate.provinceId === provinceId
      ? {
          ...candidate,
          villageInvestmentBucket,
          fortificationInvestmentBucket
        }
      : candidate
  );
}

function runRoyalistProduction(state: GameState, config: GameConfig): GameState {
  if (config.royalistAttitude === 'friendly') {
    return state;
  }

  requirePositiveByte(config.villageCost, 'C64 village cost');
  requireNonNegativeByte(config.interestRatePercent, 'C64 interest rate');

  const tileCounts = buildMapProvinceTileCounts(state.map);
  const productionBytes = c64RoyalistProductionBytes(config);
  const order = provinceOrder(state.map);
  const provinceIds = state.map.provinces
    .filter((province) => isRoyalistOwner(province.ownerId))
    .map((province) => province.id)
    .sort((left, right) => compareByDescendingC64Order(order, left, right));

  let map = state.map;
  let memory = state.c64.royalistProvinceMemory;

  for (const provinceId of provinceIds) {
    const province = requireProvince(map, provinceId);
    const provinceMemory = requireC64RoyalistProvinceMemory(
      {
        ...state,
        map,
        c64: {
          ...state.c64,
          royalistProvinceMemory: memory
        }
      },
      provinceId
    );
    const income = calculateC64ProvinceIncome(province, config);
    requireNonNegativeByte(income, `C64 royalist income for ${provinceId}`);

    let production = income;
    const villageInvestment = Math.max(
      1,
      c64ProductHighByte(income, productionBytes.villageInvestmentByte)
    );
    const fortificationInvestment = c64ProductHighByte(
      income,
      productionBytes.fortificationInvestmentByte
    );
    const reservedProduction = c64ByteAdd(villageInvestment, fortificationInvestment);
    let villageBucket = c64ByteAdd(
      provinceMemory.villageInvestmentBucket,
      villageInvestment
    );
    let fortificationBucket = c64ByteAdd(
      provinceMemory.fortificationInvestmentBucket,
      fortificationInvestment
    );
    let villages = province.villages;
    let fortificationLevel = province.fortificationLevel;
    let soldiers = province.soldiers;
    const villageCap = provinceVillageCap(config, province.id, tileCounts);

    while (villages < villageCap && villageBucket >= config.villageCost) {
      villageBucket -= config.villageCost;
      villages += 1;
    }

    if (villages >= villageCap) {
      production = c64ByteAdd(production, villageBucket);
      villageBucket = 0;
    }

    const currentFortificationIndex = fortificationIndex(fortificationLevel);
    if (currentFortificationIndex === fortificationIndex(config.maxProvinceFortificationLevel)) {
      production = c64ByteAdd(production, fortificationBucket);
      fortificationBucket = 0;
    } else {
      const upgradeCost = c64FortificationUpgradeCost(province);
      if (fortificationBucket >= upgradeCost) {
        fortificationBucket -= upgradeCost;
        fortificationLevel = fortificationLevelAtIndex(currentFortificationIndex + 1);
      }
    }

    if (production >= reservedProduction) {
      soldiers = c64Add24Bit(soldiers, production - reservedProduction);
    }

    map = updateProvince(map, provinceId, (candidate) => ({
      ...candidate,
      villages,
      fortificationLevel,
      soldiers
    }));
    memory = setRoyalistMemory(
      memory,
      provinceId,
      villageBucket,
      fortificationBucket
    );
  }

  const remainingBuckets = memory.reduce((total, provinceMemory) => {
    const province = requireProvince(map, provinceMemory.provinceId);
    if (!isRoyalistOwner(province.ownerId)) {
      return total;
    }

    return (
      total +
      provinceMemory.villageInvestmentBucket +
      provinceMemory.fortificationInvestmentBucket
    );
  }, 0);
  const postPassSoldiers = Math.floor((remainingBuckets * config.interestRatePercent) / 100);
  const royalistTargets = map.provinces.filter((province) => isRoyalistOwner(province.ownerId));
  map = distributeSoldiersOverTargets(map, royalistTargets, postPassSoldiers);

  return {
    ...state,
    map,
    c64: {
      ...state.c64,
      royalistProvinceMemory: memory
    }
  };
}

function runRoyalistDistribution(state: GameState, config: GameConfig): GameState {
  if (config.royalistAttitude === 'friendly' || config.royalistDistribution === 'none') {
    return state;
  }

  if (state.map.provinces.every((province) => isRoyalistOwner(province.ownerId))) {
    return state;
  }

  let map = state.map;
  for (const component of royalistComponents(state.map)) {
    const mobileSoldiersInComponent = component.reduce(
      (total, province) => total + mobileSoldiers(province),
      0
    );
    for (const province of component) {
      map = updateProvince(map, province.id, (candidate) => ({
        ...candidate,
        soldiers: 1
      }));
    }

    const currentComponent = component.map((province) => requireProvince(map, province.id));
    const targets = config.royalistDistribution === 'even'
      ? currentComponent
      : royalistFrontierTargets(map, currentComponent);
    map = distributeSoldiersOverTargets(map, targets, mobileSoldiersInComponent);
  }

  return {
    ...state,
    map
  };
}

function royalistAttackCandidate(
  state: GameState,
  config: GameConfig
): RoyalistAttackCandidate | null {
  const order = provinceOrder(state.map);
  const targets = [...state.map.provinces]
    .filter((province) => isPlayerOwner(province.ownerId))
    .sort((left, right) => compareByDescendingC64Order(order, left.id, right.id));

  for (const target of targets) {
    const sources = royalistAttackSources(state.map, target, config);
    const attackingSoldiers = sources.reduce(
      (total, province) => total + mobileSoldiers(province),
      0
    );
    if (attackingSoldiers < 1) {
      continue;
    }

    const combatSetup = c64CombatSetupForProvince(target, config);

    if (
      c64BattleMeetsThreshold({
        attackerSoldiers: attackingSoldiers,
        defenderSoldiers: target.soldiers,
        attackerCombatPercent: combatSetup.attackerCombatPercent,
        defenderCombatPercent: combatSetup.defenderCombatPercent
      }, royalistAttackThreshold(config))
    ) {
      return {
        target,
        sources,
        attackingSoldiers
      };
    }
  }

  return null;
}

function resolveRoyalistBattle(
  state: GameState,
  config: GameConfig,
  candidate: RoyalistAttackCandidate
): RoyalistBattleResolution {
  const combatSetup = c64CombatSetupForProvince(candidate.target, config);
  let rngState = state.rngState;
  let attackerSoldiers = candidate.attackingSoldiers;
  let defenderSoldiers = candidate.target.soldiers;

  while (attackerSoldiers > 0 && defenderSoldiers > 0) {
    const attackerRng = nextRngByte(rngState);
    const defenderRng = nextRngByte(attackerRng.rngState);
    rngState = defenderRng.rngState;

    const round = c64BattleRound({
      attackerSoldiers,
      defenderSoldiers,
      attackerCombatPercent: combatSetup.attackerCombatPercent,
      defenderCombatPercent: combatSetup.defenderCombatPercent,
      attackerHitDenominator: combatSetup.attackerHitDenominator,
      defenderHitDenominator: combatSetup.defenderHitDenominator,
      defenderRngByte: defenderRng.byte,
      attackerRngByte: attackerRng.byte
    });
    const finishSoldiers = c64BattleFinishSoldiers(round);
    attackerSoldiers = finishSoldiers.attackerSoldiers;
    defenderSoldiers = finishSoldiers.defenderSoldiers;
  }

  const winner = attackerSoldiers > 0 ? 'attacker' : 'defender';
  return {
    rngState,
    result: {
      winner,
      resolution: 'elimination',
      attackerLosses: candidate.attackingSoldiers - attackerSoldiers,
      defenderLosses: candidate.target.soldiers - defenderSoldiers,
      survivingAttackers: attackerSoldiers,
      survivingDefenders: defenderSoldiers,
      attackStrength: candidate.attackingSoldiers * combatSetup.attackerCombatPercent,
      defenceStrength: candidate.target.soldiers * combatSetup.defenderCombatPercent
    }
  };
}

function applyRoyalistAttack(
  state: GameState,
  config: GameConfig,
  candidate: RoyalistAttackCandidate
): RoyalistWorldPhaseResult {
  const defenderId = candidate.target.ownerId;
  if (!isPlayerOwner(defenderId)) {
    throw new Error(`Royalist target ${candidate.target.id} has no defending player.`);
  }

  const battle = resolveRoyalistBattle(state, config, candidate);

  let map = state.map;
  for (const source of candidate.sources) {
    map = updateProvince(map, source.id, (province) => ({
      ...province,
      soldiers: 1
    }));
  }

  if (battle.result.winner === 'attacker') {
    if (battle.result.survivingAttackers < 1) {
      throw new Error('Royalist attacker win requires surviving attackers.');
    }

    map = updateProvince(map, candidate.target.id, (province) => ({
      ...province,
      ownerId: ROYALIST_OWNER_ID,
      soldiers: 1
    }));
    map = addDistributedSoldiers(
      map,
      [...candidate.sources.map((source) => source.id), candidate.target.id],
      battle.result.survivingAttackers - 1
    );
  } else {
    map = updateProvince(map, candidate.target.id, (province) => ({
      ...province,
      soldiers: battle.result.survivingDefenders
    }));
  }

  const nextState =
    battle.result.winner === 'attacker' && isPlayerHomeProvince(state, defenderId, candidate.target.id)
      ? eliminatePlayerToRoyalists(
          {
            ...state,
            rngState: battle.rngState,
            map
          },
          defenderId
        )
      : {
          ...state,
          rngState: battle.rngState,
          map
        };

  return {
    state: {
      ...nextState
    },
    events: [
      {
        type: 'royalist-battle-resolved',
        defenderId,
        fromProvinceIds: candidate.sources.map((source) => source.id),
        targetProvinceId: candidate.target.id,
        attackingSoldiers: candidate.attackingSoldiers,
        result: battle.result
      }
    ]
  };
}

export function runRoyalistWorldPhase(
  state: GameState,
  config: GameConfig
): RoyalistWorldPhaseResult {
  if (config.royalistAttitude !== 'hostile') {
    const producedState = runRoyalistProduction(state, config);
    return {
      state: runRoyalistDistribution(producedState, config),
      events: []
    };
  }

  const attackPhase = runHostileRoyalistAttackPhase(state, config);
  const producedState = runRoyalistProduction(attackPhase.state, config);
  const distributedState = runRoyalistDistribution(producedState, config);
  const finalState = finishRoyalistWorldPhaseState(distributedState);
  const events = [...attackPhase.events];
  if (finalState.phase === 'game-over' && finalState.winnerId !== null) {
    events.push({
      type: 'game-won',
      winnerId: finalState.winnerId
    });
  }

  return { state: finalState, events };
}
