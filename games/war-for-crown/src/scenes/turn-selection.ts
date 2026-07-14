import {
  c64HumanMovementRange,
  c64HumanMovementTargetIds
} from '../game/human-movement';
import {
  fortificationIndex,
  provinceFortificationLimit
} from '../game/rules';
import type { GameConfig, GameState, ProvinceId, ProvinceState } from '../game/types';

export interface TurnSelection {
  readonly attackSourceIds: ReadonlyArray<ProvinceId>;
  readonly fromId: ProvinceId | null;
  readonly movementTargetSoldiers: number | null;
  readonly targetId: ProvinceId | null;
}

function requireProvince(state: GameState, provinceId: ProvinceId): ProvinceState {
  const province = state.map.provinces.find((candidate) => candidate.id === provinceId);
  if (province === undefined) {
    throw new Error(`Turn selection references unknown province ${provinceId}.`);
  }
  return province;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function isAttackTurn(state: GameState): boolean {
  return state.phase === 'turn' && state.turnStep === 'attack';
}

export function mobileAttackSoldiers(state: GameState, province: ProvinceState): number {
  if (
    province.ownerId !== state.activePlayerId ||
    state.attackSpentProvinceIds.includes(province.id)
  ) {
    return 0;
  }
  return Math.max(0, province.soldiers - 1);
}

export function validAttackSourceIds(
  state: GameState,
  targetProvinceId: ProvinceId
): ReadonlyArray<ProvinceId> {
  return state.map.provinces
    .filter((province) =>
      province.ownerId === state.activePlayerId &&
      province.neighbours.includes(targetProvinceId) &&
      mobileAttackSoldiers(state, province) > 0
    )
    .map((province) => province.id);
}

export function attackTargetIds(state: GameState): ReadonlyArray<ProvinceId> {
  if (!isAttackTurn(state)) {
    return [];
  }
  return state.map.provinces
    .filter((province) =>
      province.ownerId !== state.activePlayerId &&
      validAttackSourceIds(state, province.id).length > 0
    )
    .map((province) => province.id);
}

export function selectedAttackSoldiers(
  state: GameState,
  sourceIds: ReadonlyArray<ProvinceId>
): number {
  return sourceIds.reduce(
    (total, provinceId) => total + mobileAttackSoldiers(state, requireProvince(state, provinceId)),
    0
  );
}

export function canConfirmAttack(state: GameState, selection: TurnSelection): boolean {
  return isAttackTurn(state) &&
    selection.targetId !== null &&
    selection.attackSourceIds.length > 0 &&
    selectedAttackSoldiers(state, selection.attackSourceIds) > 0;
}

export function isMovementTurn(state: GameState): boolean {
  return state.phase === 'turn' && state.turnStep === 'movement';
}

export function maximumMovementTargetSoldiers(
  state: GameState,
  selection: TurnSelection
): number {
  if (selection.fromId === null || selection.targetId === null) {
    return 0;
  }
  return c64HumanMovementRange(
    requireProvince(state, selection.fromId),
    requireProvince(state, selection.targetId)
  ).maximumTargetSoldiers;
}

export function movementTargetSoldiers(state: GameState, selection: TurnSelection): number {
  const maximum = maximumMovementTargetSoldiers(state, selection);
  if (maximum < 1 || selection.movementTargetSoldiers === null) {
    return 0;
  }
  return clamp(selection.movementTargetSoldiers, 1, maximum);
}

export function synchronizeMovementTargetSoldiers(
  state: GameState,
  selection: TurnSelection
): number | null {
  const maximum = maximumMovementTargetSoldiers(state, selection);
  if (maximum < 1) {
    return null;
  }
  if (selection.targetId === null) {
    throw new Error('Cannot initialize movement soldiers without a target province.');
  }
  return selection.movementTargetSoldiers === null
    ? requireProvince(state, selection.targetId).soldiers
    : clamp(selection.movementTargetSoldiers, 1, maximum);
}

export function setMovementTargetSoldiers(
  state: GameState,
  selection: TurnSelection,
  soldiers: number
): number | null {
  const maximum = maximumMovementTargetSoldiers(state, selection);
  return maximum < 1 ? null : clamp(Math.round(soldiers), 1, maximum);
}

export function movementSliderSoldiers(
  state: GameState,
  selection: TurnSelection,
  ratio: number
): number | null {
  const maximum = maximumMovementTargetSoldiers(state, selection);
  if (maximum < 1) {
    return null;
  }
  return maximum === 1 ? 1 : Math.round(1 + clamp(ratio, 0, 1) * (maximum - 1));
}

export function equalizedMovementTargetSoldiers(
  state: GameState,
  selection: TurnSelection
): number | null {
  if (selection.fromId === null || selection.targetId === null) {
    return null;
  }
  const from = requireProvince(state, selection.fromId);
  const target = requireProvince(state, selection.targetId);
  return Math.floor((from.soldiers + target.soldiers) / 2);
}

export function canConfirmMove(state: GameState, selection: TurnSelection): boolean {
  if (!isMovementTurn(state) || selection.fromId === null || selection.targetId === null) {
    return false;
  }
  const from = requireProvince(state, selection.fromId);
  const target = requireProvince(state, selection.targetId);
  return from.ownerId === state.activePlayerId &&
    target.ownerId === state.activePlayerId &&
    from.id !== target.id &&
    c64HumanMovementTargetIds(state.map, state.activePlayerId, from.id).has(target.id) &&
    movementTargetSoldiers(state, selection) > 0;
}

export function selectedProvince(
  state: GameState,
  selection: TurnSelection
): ProvinceState | null {
  return selection.fromId === null ? null : requireProvince(state, selection.fromId);
}

export function isInvestmentTurn(state: GameState): boolean {
  return state.phase === 'turn' && state.turnStep === 'investment';
}

export function canBuildSelectedVillage(
  state: GameState,
  config: GameConfig,
  selection: TurnSelection
): boolean {
  const province = selectedProvince(state, selection);
  const active = state.players.find((player) => player.id === state.activePlayerId);
  if (province === null || active === undefined) {
    return false;
  }
  return isInvestmentTurn(state) &&
    province.ownerId === active.id &&
    active.money >= config.villageCost &&
    province.villages < config.maxVillages;
}

export function canUpgradeSelectedFortification(
  state: GameState,
  config: GameConfig,
  selection: TurnSelection
): boolean {
  const province = selectedProvince(state, selection);
  const active = state.players.find((player) => player.id === state.activePlayerId);
  if (province === null || active === undefined) {
    return false;
  }
  const maximum = provinceFortificationLimit(
    province,
    config,
    state.players.some((player) => player.homeProvinceId === province.id)
  );
  return isInvestmentTurn(state) &&
    province.ownerId === active.id &&
    active.money >= config.fortificationUpgradeCost &&
    !province.upgradedFortificationThisTurn &&
    fortificationIndex(province.fortificationLevel) < fortificationIndex(maximum);
}

export function affordableHireSoldiers(state: GameState, config: GameConfig): number {
  const active = state.players.find((player) => player.id === state.activePlayerId);
  if (active === undefined) {
    throw new Error(`Missing active player ${state.activePlayerId}.`);
  }
  return active.homeProvinceId === null ? 0 : Math.floor(active.money / config.soldierCost);
}
