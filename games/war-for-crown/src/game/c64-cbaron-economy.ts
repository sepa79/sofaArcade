import { c64Divide32, c64Multiply32 } from './c64-arithmetic';
import { c64FortificationLevelForFortificationLevel } from './c64-battle';
import {
  c64CbaronRequiredStrength,
  type C64CbaronOwnerSlot
} from './c64-cbaron-threat';
import { c64TerrainIncomePercent } from './c64-economy';
import { c64CbaronL5C6E } from './c64-cbaron-date';
import { requireC64PlayerMemory } from './c64-state';
import { buildMapProvinceTileCounts, provinceVillageCap } from './map';
import { isRoyalistOwner } from './owners';
import type {
  C64AiPlayerMemory,
  GameConfig,
  GameState,
  PlayerId,
  PlayerState,
  ProvinceMapState,
  ProvinceId,
  ProvinceState
} from './types';

const C64_RECRUIT_PERCENT_BY_OWNER_SLOT: ReadonlyArray<number> = [0, 20, 40, 25, 20];
const C64_PRESSURE_SURPLUS_MULTIPLIER = 0xb3;
const C64_MONEY_CAP_PERCENT = 0x5f;
const C64_PERCENT_DIVISOR = 100;
const C64_PRODUCT_HIGH_BYTE_DIVISOR = 0x100;
const C64_GARRISON_SOLDIERS = 1;
const C64_24_BIT_MODULO = 0x1000000;

export interface C64CbaronCarryoverUnderflow {
  readonly branch: 'carryover-underflow';
  readonly adjustedMoney: number;
  readonly adjustedCarryoverMoney: number;
}

export interface C64CbaronRecruitmentDecision {
  readonly branch: 'recruitment';
  readonly activeOwnerSlot: number;
  readonly availableMoney: number;
  readonly mobileFrontierSoldiers: number;
  readonly requiredFrontierSoldiers: number;
  readonly surplusSoldiers: number;
  readonly surplusDiscount: number;
  readonly baseRecruitBudget: number;
  readonly moneyCap: number;
  readonly pressureUsed: boolean;
  readonly pressureHire: number;
  readonly hiredSoldiers: number;
  readonly homeProvinceId: ProvinceId;
}

export type C64CbaronEconomyDecision =
  | C64CbaronCarryoverUnderflow
  | C64CbaronRecruitmentDecision;

export interface C64CbaronEconomyDecisionInput {
  readonly state: GameState;
  readonly activePlayerId: PlayerId;
  readonly ownerSlots: ReadonlyArray<C64CbaronOwnerSlot>;
  readonly config: Pick<
    GameConfig,
    | 'interestRatePercent'
    | 'maxVillages'
    | 'maxVillagesMode'
    | 'terrainInfluence'
    | 'villageCost'
    | 'royalistAttitude'
    | 'royalistAttackCooperation'
  >;
}

export interface C64CbaronVillagePurchase {
  readonly provinceId: ProvinceId;
  readonly villagesBought: number;
  readonly cost: number;
}

export interface C64CbaronVillagePurchaseResult {
  readonly map: ProvinceMapState;
  readonly remainingMoney: number;
  readonly purchases: ReadonlyArray<C64CbaronVillagePurchase>;
}

export interface C64CbaronVillagePurchaseInput {
  readonly state: GameState;
  readonly activePlayerId: PlayerId;
  readonly money: number;
  readonly config: Pick<
    GameConfig,
    | 'maxVillages'
    | 'maxVillagesMode'
    | 'royalistAttitude'
    | 'terrainInfluence'
    | 'villageCost'
  >;
}

export interface C64CbaronEconomyRunResult {
  readonly state: GameState;
  readonly decision: C64CbaronEconomyDecision;
  readonly villagePurchases: ReadonlyArray<C64CbaronVillagePurchase>;
  readonly moneyBeforeFinalCarryover: number;
  readonly finalMoney: number;
}

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer, got ${value}.`);
  }
}

function requirePlayer(state: GameState, playerId: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) {
    throw new Error(`Unknown C64 cbaron economy player ${playerId}.`);
  }
  return player;
}

function requireProvince(state: GameState, provinceId: ProvinceId): ProvinceState {
  const province = state.map.provinces.find((candidate) => candidate.id === provinceId);
  if (province === undefined) {
    throw new Error(`Unknown C64 cbaron economy province ${provinceId}.`);
  }
  return province;
}

function requireActiveOwnerSlot(
  ownerSlots: ReadonlyArray<C64CbaronOwnerSlot>,
  activePlayerId: PlayerId
): number {
  const ownerSlot = ownerSlots.findIndex((slot) => slot.ownerId === activePlayerId);
  if (ownerSlot < 1) {
    throw new Error(`Missing C64 cbaron economy owner slot for ${activePlayerId}.`);
  }

  const recruitPercent = C64_RECRUIT_PERCENT_BY_OWNER_SLOT[ownerSlot];
  if (recruitPercent === undefined) {
    throw new Error(`Missing C64 cbaron recruit percent for owner slot ${ownerSlot}.`);
  }

  return ownerSlot;
}

function c64Percent(value: number, percent: number): number {
  requireNonNegativeInteger(value, 'C64 percent value');
  requireNonNegativeInteger(percent, 'C64 percent');
  return c64Divide32(c64Multiply32(value, percent), C64_PERCENT_DIVISOR).quotient;
}

function c64ProductHighBytes(value: number, multiplier: number): number {
  requireNonNegativeInteger(value, 'C64 high-byte product value');
  requireNonNegativeInteger(multiplier, 'C64 high-byte product multiplier');
  return c64Divide32(c64Multiply32(value, multiplier), C64_PRODUCT_HIGH_BYTE_DIVISOR).quotient;
}

function mobileSoldiers(province: ProvinceState): number {
  return Math.max(0, province.soldiers - C64_GARRISON_SOLDIERS);
}

function provinceById(state: GameState): ReadonlyMap<ProvinceId, ProvinceState> {
  return new Map(state.map.provinces.map((province) => [province.id, province]));
}

function c64EconomyFrontierProvinceIds(
  state: GameState,
  activePlayerId: PlayerId
): ReadonlyArray<ProvinceId> {
  const byId = provinceById(state);
  return state.map.provinces
    .filter((province) =>
      province.ownerId === activePlayerId &&
      province.neighbours.some((neighbourId) => {
        const neighbour = byId.get(neighbourId);
        if (neighbour === undefined) {
          throw new Error(`Unknown C64 cbaron neighbour ${neighbourId}.`);
        }
        if (neighbour.ownerId === activePlayerId) {
          return false;
        }
        return true;
      })
    )
    .map((province) => province.id);
}

function c64TargetFrontierProvinceIds(
  state: GameState,
  activePlayerId: PlayerId,
  ownedFrontierProvinceIds: ReadonlyArray<ProvinceId>
): ReadonlySet<ProvinceId> {
  const targets = new Set<ProvinceId>();
  for (const provinceId of ownedFrontierProvinceIds) {
    const province = requireProvince(state, provinceId);
    for (const neighbourId of province.neighbours) {
      const neighbour = requireProvince(state, neighbourId);
      if (neighbour.ownerId !== activePlayerId) {
        targets.add(neighbour.id);
      }
    }
  }
  return targets;
}

function sumMobileSoldiers(state: GameState, provinceIds: ReadonlyArray<ProvinceId>): number {
  return provinceIds.reduce(
    (total, provinceId) => total + mobileSoldiers(requireProvince(state, provinceId)),
    0
  );
}

function requireMemoryByPlayerId(
  memories: ReadonlyArray<C64AiPlayerMemory>,
  playerId: PlayerId
): C64AiPlayerMemory {
  const memory = memories.find((candidate) => candidate.playerId === playerId);
  if (memory === undefined) {
    throw new Error(`Missing C64 cbaron economy memory for ${playerId}.`);
  }
  return memory;
}

function strongestAdjacentPreviousHire(
  state: GameState,
  activePlayerId: PlayerId,
  targetFrontierProvinceIds: ReadonlySet<ProvinceId>,
  pressureThreshold: number
): number {
  let strongestHire = 0;

  for (let index = state.map.provinces.length - 1; index >= 0; index -= 1) {
    const province = state.map.provinces[index];
    if (province === undefined) {
      throw new Error(`Missing C64 cbaron economy province at index ${index}.`);
    }

    if (!targetFrontierProvinceIds.has(province.id)) {
      continue;
    }

    if (isRoyalistOwner(province.ownerId) || province.ownerId === activePlayerId) {
      continue;
    }

    const hire = requireMemoryByPlayerId(state.c64.playerMemory, province.ownerId).hiredSoldiers;
    if (hire >= pressureThreshold && hire >= strongestHire) {
      strongestHire = hire;
    }
  }

  return strongestHire;
}

export function c64CbaronEconomyDecision(
  input: C64CbaronEconomyDecisionInput
): C64CbaronEconomyDecision {
  const player = requirePlayer(input.state, input.activePlayerId);
  const memory = requireC64PlayerMemory(input.state, input.activePlayerId);
  requireNonNegativeInteger(player.money, `C64 cbaron money for ${input.activePlayerId}`);
  requireNonNegativeInteger(
    memory.economyCarryoverMoney,
    `C64 cbaron carryover money for ${input.activePlayerId}`
  );

  if (player.money < memory.economyCarryoverMoney) {
    const adjustedMoney = c64Percent(
      player.money,
      C64_PERCENT_DIVISOR + input.config.interestRatePercent
    );
    return {
      branch: 'carryover-underflow',
      adjustedMoney,
      adjustedCarryoverMoney: adjustedMoney
    };
  }

  const activeOwnerSlot = requireActiveOwnerSlot(input.ownerSlots, input.activePlayerId);
  const homeProvinceId = player.homeProvinceId;
  if (homeProvinceId === null) {
    throw new Error(`C64 cbaron player ${input.activePlayerId} has no home province.`);
  }

  const homeProvince = requireProvince(input.state, homeProvinceId);
  if (homeProvince.ownerId !== input.activePlayerId) {
    throw new Error(`C64 cbaron home province ${homeProvinceId} is not owned by ${input.activePlayerId}.`);
  }

  const availableMoney = player.money - memory.economyCarryoverMoney;
  const ownedFrontierProvinceIds = c64EconomyFrontierProvinceIds(
    input.state,
    input.activePlayerId
  );
  const mobileFrontierSoldiers = sumMobileSoldiers(input.state, ownedFrontierProvinceIds);
  const requiredFrontierSoldiers = c64CbaronRequiredStrength({
    provinces: input.state.map.provinces,
    activeOwnerId: input.activePlayerId,
    ownerSlots: input.ownerSlots,
    worklistProvinceIds: ownedFrontierProvinceIds,
    config: input.config
  }).totalRequiredSoldiers;
  const surplusSoldiers = Math.max(0, mobileFrontierSoldiers - requiredFrontierSoldiers);
  const surplusDiscount = c64ProductHighBytes(
    surplusSoldiers,
    C64_PRESSURE_SURPLUS_MULTIPLIER
  );
  const moneyCap = c64Percent(availableMoney, C64_MONEY_CAP_PERCENT);
  const recruitPercent = C64_RECRUIT_PERCENT_BY_OWNER_SLOT[activeOwnerSlot];
  if (recruitPercent === undefined) {
    throw new Error(`Missing C64 cbaron recruit percent for owner slot ${activeOwnerSlot}.`);
  }

  const baseRecruitBudget = c64Percent(availableMoney, recruitPercent);
  const pressureThreshold = baseRecruitBudget + surplusDiscount;
  const targetFrontierProvinceIds = c64TargetFrontierProvinceIds(
    input.state,
    input.activePlayerId,
    ownedFrontierProvinceIds
  );
  const pressureHire = strongestAdjacentPreviousHire(
    input.state,
    input.activePlayerId,
    targetFrontierProvinceIds,
    pressureThreshold
  );
  const pressureUsed = pressureHire > 0;
  const hiredSoldiers = pressureUsed
    ? Math.min(pressureHire - surplusDiscount, moneyCap)
    : baseRecruitBudget;

  return {
    branch: 'recruitment',
    activeOwnerSlot,
    availableMoney,
    mobileFrontierSoldiers,
    requiredFrontierSoldiers,
    surplusSoldiers,
    surplusDiscount,
    baseRecruitBudget,
    moneyCap,
    pressureUsed,
    pressureHire,
    hiredSoldiers,
    homeProvinceId
  };
}

function c64TerrainScore(province: ProvinceState, config: Pick<GameConfig, 'terrainInfluence'>): number {
  if (config.terrainInfluence === 'none' || config.terrainInfluence === 'combat') {
    return 0;
  }
  return c64TerrainIncomePercent(province, config);
}

function replaceProvince(
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

function updatePlayerMoney(state: GameState, playerId: PlayerId, money: number): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            money
          }
        : player
    )
  };
}

function updateC64EconomyMemory(
  state: GameState,
  playerId: PlayerId,
  update: (memory: C64AiPlayerMemory) => C64AiPlayerMemory
): GameState {
  return {
    ...state,
    c64: {
      ...state.c64,
      playerMemory: state.c64.playerMemory.map((memory) =>
        memory.playerId === playerId ? update(memory) : memory
      )
    }
  };
}

function addSoldiersToProvince(
  state: GameState,
  provinceId: ProvinceId,
  soldiers: number
): GameState {
  return {
    ...state,
    map: replaceProvince(state.map, provinceId, (province) => ({
      ...province,
      soldiers: (province.soldiers + soldiers) % C64_24_BIT_MODULO
    }))
  };
}

function selectVillagePurchaseProvince(
  state: GameState,
  activePlayerId: PlayerId,
  config: C64CbaronVillagePurchaseInput['config']
): ProvinceId | null {
  const player = requirePlayer(state, activePlayerId);
  const ownedFrontierIds = new Set(c64EconomyFrontierProvinceIds(state, activePlayerId));
  const tileCounts = buildMapProvinceTileCounts(state.map);
  let selectedProvinceId: ProvinceId | null = null;
  let selectedScore = 0;

  for (let index = state.map.provinces.length - 1; index >= 0; index -= 1) {
    const province = state.map.provinces[index];
    if (province === undefined) {
      throw new Error(`Missing C64 cbaron village province at index ${index}.`);
    }

    if (province.ownerId !== activePlayerId) {
      continue;
    }

    const cap = provinceVillageCap(config, province.id, tileCounts);
    if (province.villages >= cap) {
      continue;
    }

    let scoreBase = 0x46;
    if (ownedFrontierIds.has(province.id) && province.id !== player.homeProvinceId) {
      if (c64CbaronL5C6E(state.turnNumber, state.map.provinces.length) !== 0) {
        continue;
      }
      if (province.soldiers === 1) {
        continue;
      }
      scoreBase = 0x0a;
    }

    const score =
      scoreBase +
      c64TerrainScore(province, config) +
      c64FortificationLevelForFortificationLevel(province.fortificationLevel);
    if (score >= selectedScore) {
      selectedScore = score;
      selectedProvinceId = province.id;
    }
  }

  return selectedProvinceId;
}

export function c64CbaronVillagePurchases(
  input: C64CbaronVillagePurchaseInput
): C64CbaronVillagePurchaseResult {
  requireNonNegativeInteger(input.money, 'C64 cbaron village-purchase money');
  requireNonNegativeInteger(input.config.villageCost, 'C64 cbaron village cost');
  if (input.config.villageCost < 1) {
    throw new Error(`C64 cbaron village cost must be positive, got ${input.config.villageCost}.`);
  }

  let state = input.state;
  let money = input.money;
  const purchases: C64CbaronVillagePurchase[] = [];

  for (;;) {
    const provinceId = selectVillagePurchaseProvince(state, input.activePlayerId, input.config);
    if (provinceId === null) {
      return {
        map: state.map,
        remainingMoney: money,
        purchases
      };
    }

    const tileCounts = buildMapProvinceTileCounts(state.map);
    const province = requireProvince(state, provinceId);
    const missingVillages =
      provinceVillageCap(input.config, provinceId, tileCounts) - province.villages;
    const affordableVillages = Math.floor(money / input.config.villageCost);
    const villagesBought = Math.min(missingVillages, affordableVillages);
    if (villagesBought < 1) {
      return {
        map: state.map,
        remainingMoney: money,
        purchases
      };
    }

    const cost = villagesBought * input.config.villageCost;
    const map = replaceProvince(state.map, provinceId, (candidate) => ({
      ...candidate,
      villages: candidate.villages + villagesBought
    }));
    money -= cost;
    purchases.push({
      provinceId,
      villagesBought,
      cost
    });
    state = {
      ...state,
      map
    };
  }
}

export function runC64CbaronEconomy(
  input: C64CbaronEconomyDecisionInput
): C64CbaronEconomyRunResult {
  const decision = c64CbaronEconomyDecision(input);

  if (decision.branch === 'carryover-underflow') {
    const player = requirePlayer(input.state, input.activePlayerId);
    const stateWithMoney = updatePlayerMoney(
      input.state,
      input.activePlayerId,
      decision.adjustedMoney
    );
    return {
      state: updateC64EconomyMemory(stateWithMoney, input.activePlayerId, (memory) => ({
        ...memory,
        economyCarryoverMoney: decision.adjustedCarryoverMoney
      })),
      decision,
      villagePurchases: [],
      moneyBeforeFinalCarryover: player.money,
      finalMoney: decision.adjustedMoney
    };
  }

  const memory = requireC64PlayerMemory(input.state, input.activePlayerId);
  const moneyAfterRecruitment = decision.availableMoney - decision.hiredSoldiers;
  let nextState = addSoldiersToProvince(
    input.state,
    decision.homeProvinceId,
    decision.hiredSoldiers
  );
  nextState = updateC64EconomyMemory(nextState, input.activePlayerId, (candidate) => ({
    ...candidate,
    hiredSoldiers: decision.hiredSoldiers
  }));

  const villageResult = c64CbaronVillagePurchases({
    state: nextState,
    activePlayerId: input.activePlayerId,
    money: moneyAfterRecruitment,
    config: {
      ...input.config,
      maxVillages: input.config.maxVillages,
      maxVillagesMode: input.config.maxVillagesMode,
      villageCost: input.config.villageCost
    }
  });
  const moneyBeforeFinalCarryover =
    villageResult.remainingMoney + memory.economyCarryoverMoney;
  const finalMoney = c64Percent(
    moneyBeforeFinalCarryover,
    C64_PERCENT_DIVISOR + input.config.interestRatePercent
  );
  nextState = {
    ...nextState,
    map: villageResult.map
  };
  nextState = updatePlayerMoney(nextState, input.activePlayerId, finalMoney);
  nextState = updateC64EconomyMemory(nextState, input.activePlayerId, (candidate) => ({
    ...candidate,
    economyCarryoverMoney: finalMoney
  }));

  return {
    state: nextState,
    decision,
    villagePurchases: villageResult.purchases,
    moneyBeforeFinalCarryover,
    finalMoney
  };
}
