import { TERRAIN_DEFINITIONS } from './constants';
import { validateC64CompatibilityState } from './c64-state';
import { isPlayerOwner, isRoyalistOwner } from './owners';
import { fortificationIndex } from './rules';
import type { GameState, PlayerId, ProvinceId, ProvinceState } from './types';

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer, got ${value}.`);
  }
}

function requireUniqueId<T extends string>(ids: ReadonlyArray<T>, label: string): void {
  const seen = new Set<T>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Duplicate ${label} id: ${id}.`);
    }
    seen.add(id);
  }
}

function requireProvince(
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>,
  provinceId: ProvinceId,
  context: string
): ProvinceState {
  const province = provincesById.get(provinceId);
  if (province === undefined) {
    throw new Error(`${context} references unknown province id: ${provinceId}.`);
  }
  return province;
}

function requireKnownPlayerId(playerIds: ReadonlySet<PlayerId>, playerId: PlayerId, context: string): void {
  if (!playerIds.has(playerId)) {
    throw new Error(`${context} references unknown player id: ${playerId}.`);
  }
}

function playerOwnsAnyProvince(state: GameState, playerId: PlayerId): boolean {
  return state.map.provinces.some((province) => province.ownerId === playerId);
}

function validateProvince(
  province: ProvinceState,
  playerIds: ReadonlySet<PlayerId>,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>
): void {
  if (TERRAIN_DEFINITIONS[province.terrainId] === undefined) {
    throw new Error(`Province ${province.id} has unknown terrain id: ${province.terrainId}.`);
  }

  fortificationIndex(province.fortificationLevel);

  requireNonNegativeInteger(province.soldiers, `Province ${province.id} soldiers`);
  requireNonNegativeInteger(province.villages, `Province ${province.id} villages`);

  if (isPlayerOwner(province.ownerId)) {
    requireKnownPlayerId(playerIds, province.ownerId, `Province ${province.id} owner`);
  }

  if (province.soldiers < 1) {
    throw new Error(`Owned province ${province.id} must have at least one soldier.`);
  }

  for (const neighbourId of province.neighbours) {
    const neighbour = requireProvince(
      provincesById,
      neighbourId,
      `Province ${province.id} neighbour list`
    );
    if (!neighbour.neighbours.includes(province.id)) {
      throw new Error(`Province adjacency is not symmetric: ${province.id} -> ${neighbourId}.`);
    }
  }
}

function validatePlayerHomes(
  state: GameState,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>
): void {
  for (const player of state.players) {
    requireNonNegativeInteger(player.money, `Player ${player.id} money`);

    if (player.homeProvinceId === null) {
      continue;
    }

    const homeProvince = requireProvince(
      provincesById,
      player.homeProvinceId,
      `Player ${player.id} home province`
    );
    if (homeProvince.ownerId !== player.id && playerOwnsAnyProvince(state, player.id)) {
      throw new Error(`Player ${player.id} home province ${homeProvince.id} is owned by ${homeProvince.ownerId}.`);
    }
  }
}

function validateWinner(state: GameState, playerIds: ReadonlySet<PlayerId>): void {
  if (state.winnerId === null) {
    return;
  }

  if (state.phase !== 'game-over') {
    throw new Error(`Winner ${state.winnerId} is set during phase "${state.phase}".`);
  }

  if (isRoyalistOwner(state.winnerId)) {
    if (!state.map.provinces.every((province) => isRoyalistOwner(province.ownerId))) {
      throw new Error('Royalist winner is set before owner 0 owns every province.');
    }
    return;
  }

  requireKnownPlayerId(playerIds, state.winnerId, 'Winner');
  const winner = state.players.find((player) => player.id === state.winnerId);
  if (winner === undefined) {
    throw new Error(`Winner ${state.winnerId} is missing from player list.`);
  }
  if (winner.homeProvinceId === null) {
    throw new Error(`Winner ${state.winnerId} has no home province.`);
  }
  if (!state.map.provinces.every((province) => province.ownerId === state.winnerId)) {
    throw new Error(`Winner ${state.winnerId} is set before owning every province.`);
  }

  for (const player of state.players) {
    if (player.id === state.winnerId) {
      continue;
    }

    if (playerOwnsAnyProvince(state, player.id)) {
      throw new Error(`Non-winner ${player.id} still owns provinces.`);
    }
  }
}

function validateAttackSpentProvinceIds(
  state: GameState,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>
): void {
  requireUniqueId(state.attackSpentProvinceIds, 'attack-spent province');
  for (const provinceId of state.attackSpentProvinceIds) {
    requireProvince(provincesById, provinceId, 'Attack-spent province list');
  }
}

export function validateGameState(state: GameState): void {
  requireNonNegativeInteger(state.rngState, 'Game RNG state');

  const playerIds = state.players.map((player) => player.id);
  requireUniqueId(playerIds, 'player');
  const playerIdSet = new Set(playerIds);
  requireKnownPlayerId(playerIdSet, state.activePlayerId, 'Active player');

  const provinceIds = state.map.provinces.map((province) => province.id);
  requireUniqueId(provinceIds, 'province');
  const provincesById = new Map(state.map.provinces.map((province) => [province.id, province]));

  for (const tile of state.map.tiles) {
    if (tile.provinceId !== null) {
      requireProvince(provincesById, tile.provinceId, `Tile ${tile.x},${tile.y}`);
    }
  }

  for (const province of state.map.provinces) {
    validateProvince(province, playerIdSet, provincesById);
  }

  validatePlayerHomes(state, provincesById);
  validateAttackSpentProvinceIds(state, provincesById);
  validateC64CompatibilityState(state);
  validateWinner(state, playerIdSet);
}
