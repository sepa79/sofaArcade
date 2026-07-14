import { TERRAIN_DEFINITIONS } from './constants';
import { validateC64CompatibilityState } from './c64-state';
import { isPlayerOwner, isRoyalistOwner } from './owners';
import { fortificationIndex } from './rules';
import type { BattleState, GameState, PlayerId, ProvinceId, ProvinceState } from './types';

const GAME_PHASES = ['home-selection', 'turn', 'game-over'] as const;
const TURN_STEPS = ['new-month', 'attack', 'movement', 'investment'] as const;
const BATTLE_RETREAT_SIDES = ['attacker', 'defender'] as const;

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): ReadonlyArray<unknown> {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireBoolean(value: unknown, label: string): void {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be boolean.`);
  }
}

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer, got ${value}.`);
  }
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer, got ${value}.`);
  }
}

function requireEnum(value: unknown, values: ReadonlyArray<string>, label: string): void {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new Error(`${label} has invalid value: ${String(value)}.`);
  }
}

function validateStateStructure(state: GameState): void {
  const rawState = requireRecord(state, 'Game state');
  requirePositiveInteger(rawState.seed as number, 'Game seed');
  requireNonNegativeInteger(rawState.rngState as number, 'Game RNG state');
  if ((rawState.rngState as number) > 0xffffffff) {
    throw new Error(`Game RNG state must be at most 0xffffffff, got ${String(rawState.rngState)}.`);
  }
  requireEnum(rawState.phase, GAME_PHASES, 'Game phase');
  requireEnum(rawState.turnStep, TURN_STEPS, 'Turn step');
  requirePositiveInteger(rawState.turnNumber as number, 'Turn number');
  requireNonEmptyString(rawState.activePlayerId, 'Active player id');
  const attackSpentProvinceIds = requireArray(rawState.attackSpentProvinceIds, 'Attack-spent province ids');
  for (const [index, provinceId] of attackSpentProvinceIds.entries()) {
    requireNonEmptyString(provinceId, `Attack-spent province id ${index + 1}`);
  }
  requireArray(rawState.players, 'Players');
  if (rawState.winnerId !== null && rawState.winnerId !== 0) {
    requireNonEmptyString(rawState.winnerId, 'Winner id');
  }
  if (rawState.battle !== null) {
    const battle = requireRecord(rawState.battle, 'Battle');
    requireNonEmptyString(battle.attackerId, 'Battle attacker id');
    if (battle.defenderId !== 0) {
      requireNonEmptyString(battle.defenderId, 'Battle defender id');
    }
    requireNonEmptyString(battle.targetProvinceId, 'Battle target province id');
    const sourceIds = requireArray(battle.fromProvinceIds, 'Battle source province ids');
    for (const [index, sourceId] of sourceIds.entries()) {
      requireNonEmptyString(sourceId, `Battle source province id ${index + 1}`);
    }
  }

  const map = requireRecord(rawState.map, 'Game map');
  requirePositiveInteger(map.width as number, 'Map width');
  requirePositiveInteger(map.height as number, 'Map height');
  requireArray(map.tiles, 'Map tiles');
  requireArray(map.provinces, 'Map provinces');

  for (const [index, rawPlayer] of state.players.entries()) {
    const player = requireRecord(rawPlayer, `Player ${index + 1}`);
    requireNonEmptyString(player.id, `Player ${index + 1} id`);
    requireNonEmptyString(player.label, `Player ${index + 1} label`);
    requireNonNegativeInteger(player.color as number, `Player ${index + 1} color`);
    if ((player.color as number) > 0xffffff) {
      throw new Error(`Player ${index + 1} color must be at most 0xffffff.`);
    }
    requireNonNegativeInteger(player.money as number, `Player ${index + 1} money`);
    if (player.homeProvinceId !== null) {
      requireNonEmptyString(player.homeProvinceId, `Player ${index + 1} home province id`);
    }
  }

  for (const [index, rawProvince] of state.map.provinces.entries()) {
    const province = requireRecord(rawProvince, `Province ${index + 1}`);
    requireNonEmptyString(province.id, `Province ${index + 1} id`);
    requireNonNegativeInteger(province.villages as number, `Province ${index + 1} villages`);
    requireNonNegativeInteger(province.soldiers as number, `Province ${index + 1} soldiers`);
    requireBoolean(province.upgradedFortificationThisTurn, `Province ${index + 1} upgraded flag`);
    const neighbours = requireArray(province.neighbours, `Province ${index + 1} neighbours`);
    for (const [neighbourIndex, neighbourId] of neighbours.entries()) {
      requireNonEmptyString(neighbourId, `Province ${index + 1} neighbour ${neighbourIndex + 1}`);
    }
  }

  for (const [index, rawTile] of state.map.tiles.entries()) {
    const tile = requireRecord(rawTile, `Map tile ${index + 1}`);
    requireNonNegativeInteger(tile.x as number, `Map tile ${index + 1} x`);
    requireNonNegativeInteger(tile.y as number, `Map tile ${index + 1} y`);
    if (tile.provinceId !== null) {
      requireNonEmptyString(tile.provinceId, `Map tile ${index + 1} province id`);
    }
  }

  const c64 = requireRecord(rawState.c64, 'C64 compatibility state');
  const ca61Bytes = requireArray(c64.ca61Bytes, 'C64 CA61 bytes');
  for (const [index, byte] of ca61Bytes.entries()) {
    requireNonNegativeInteger(byte as number, `C64 CA61 byte ${index + 1}`);
  }
  const calendar = requireRecord(c64.calendar, 'C64 calendar');
  requireBoolean(calendar.monthWeatherPending, 'C64 month weather pending');
  const playerMemory = requireArray(c64.playerMemory, 'C64 player memory');
  for (const [index, memory] of playerMemory.entries()) {
    requireRecord(memory, `C64 player memory ${index + 1}`);
  }
  const royalistMemory = requireArray(c64.royalistProvinceMemory, 'C64 royalist province memory');
  for (const [index, memory] of royalistMemory.entries()) {
    requireRecord(memory, `C64 royalist province memory ${index + 1}`);
  }
}

function validateMapShape(state: GameState): void {
  const expectedTileCount = state.map.width * state.map.height;
  if (state.map.tiles.length !== expectedTileCount) {
    throw new Error(`Map has ${state.map.tiles.length} tiles; expected ${expectedTileCount}.`);
  }
  const coordinates = new Set<string>();
  for (const tile of state.map.tiles) {
    if (tile.x >= state.map.width || tile.y >= state.map.height) {
      throw new Error(`Map tile ${tile.x},${tile.y} lies outside ${state.map.width}x${state.map.height}.`);
    }
    const key = `${tile.x},${tile.y}`;
    if (coordinates.has(key)) {
      throw new Error(`Duplicate map tile coordinate: ${key}.`);
    }
    coordinates.add(key);
  }
}

function validateBattle(
  battle: BattleState,
  playerIds: ReadonlySet<PlayerId>,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>
): void {
  requireKnownPlayerId(playerIds, battle.attackerId, 'Battle attacker');
  if (isPlayerOwner(battle.defenderId)) {
    requireKnownPlayerId(playerIds, battle.defenderId, 'Battle defender');
  }
  // Intentional release-known case: an external malformed-save probe with no
  // battle sources remains loadable. It is not a state produced by gameplay.
  requireUniqueId(battle.fromProvinceIds, 'battle source province');
  const target = requireProvince(provincesById, battle.targetProvinceId, 'Battle target');
  if (target.ownerId !== battle.defenderId) {
    throw new Error(`Battle target ${target.id} is not owned by defender ${String(battle.defenderId)}.`);
  }
  for (const sourceId of battle.fromProvinceIds) {
    const source = requireProvince(provincesById, sourceId, 'Battle source');
    if (source.ownerId !== battle.attackerId || !source.neighbours.includes(target.id)) {
      throw new Error(`Battle source ${source.id} is not a legal source for target ${target.id}.`);
    }
  }
  requirePositiveInteger(battle.attackerSoldiers, 'Battle attacker soldiers');
  requirePositiveInteger(battle.defenderSoldiers, 'Battle defender soldiers');
  requirePositiveInteger(battle.attackerInitialSoldiers, 'Battle initial attacker soldiers');
  requirePositiveInteger(battle.defenderInitialSoldiers, 'Battle initial defender soldiers');
  requirePositiveInteger(battle.attackerCombatPercent, 'Battle attacker combat percent');
  requirePositiveInteger(battle.defenderCombatPercent, 'Battle defender combat percent');
  requirePositiveInteger(battle.attackerHitDenominator, 'Battle attacker hit denominator');
  requirePositiveInteger(battle.defenderHitDenominator, 'Battle defender hit denominator');
  requireNonNegativeInteger(battle.round, 'Battle round');
  if (battle.retreatSide !== null) {
    requireEnum(battle.retreatSide, BATTLE_RETREAT_SIDES, 'Battle retreat side');
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
  if (!Object.hasOwn(TERRAIN_DEFINITIONS, province.terrainId)) {
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
  requireUniqueId(province.neighbours, `province ${province.id} neighbour`);
  if (province.neighbours.includes(province.id)) {
    throw new Error(`Province ${province.id} cannot be its own neighbour.`);
  }
}

function validatePlayerHomes(
  state: GameState,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>
): void {
  const homeProvinceIds = state.players
    .map((player) => player.homeProvinceId)
    .filter((provinceId): provinceId is ProvinceId => provinceId !== null);
  requireUniqueId(homeProvinceIds, 'player home province');
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
    if (state.phase === 'game-over') {
      throw new Error('Game-over state must identify a winner.');
    }
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
  validateStateStructure(state);
  validateMapShape(state);

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

  const tiledProvinceIds = new Set(
    state.map.tiles.flatMap((tile) => tile.provinceId === null ? [] : [tile.provinceId])
  );
  for (const provinceId of provinceIds) {
    if (!tiledProvinceIds.has(provinceId)) {
      throw new Error(`Province ${provinceId} does not occupy any map tile.`);
    }
  }

  for (const province of state.map.provinces) {
    validateProvince(province, playerIdSet, provincesById);
  }

  validatePlayerHomes(state, provincesById);
  validateAttackSpentProvinceIds(state, provincesById);
  if (state.battle !== null) {
    if (state.phase !== 'turn' || state.turnStep !== 'attack') {
      throw new Error('Active battle requires the turn attack step.');
    }
    validateBattle(state.battle, playerIdSet, provincesById);
  }
  validateC64CompatibilityState(state);
  validateWinner(state, playerIdSet);
}
