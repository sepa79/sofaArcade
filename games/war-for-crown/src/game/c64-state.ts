import type {
  C64AiPlayerMemory,
  C64CompatibilityState,
  C64RoyalistProvinceMemory,
  GameState,
  PlayerId,
  PlayerState,
  ProvinceId,
  ProvinceMapState
} from './types';

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer, got ${value}.`);
  }
}

function requireByte(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`${label} must be an integer from 0 to 255, got ${value}.`);
  }
}

function requireUniqueIds(ids: ReadonlyArray<string>, label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Duplicate ${label} id: ${id}.`);
    }
    seen.add(id);
  }
}

export function createC64CompatibilityState(
  players: ReadonlyArray<PlayerState>,
  map: ProvinceMapState
): C64CompatibilityState {
  return {
    ca61Bytes: Array<number>(players.length + 1).fill(0),
    calendar: {
      year: 1,
      month: 0,
      weatherIndex: 4,
      weatherFactor: 100,
      weatherDerived: 70,
      monthWeatherPending: true
    },
    royalistReinforcementTimer: 4,
    deserterSoldiers: 0,
    deserterOwnerId: null,
    playerMemory: players.map((player) => ({
      playerId: player.id,
      rank: 0,
      hiredSoldiers: 0,
      economyCarryoverMoney: 0,
      rememberedTargetProvinceId: null,
      rememberedTargetSoldiers: 0
    })),
    royalistProvinceMemory: map.provinces.map((province) => ({
      provinceId: province.id,
      villageInvestmentBucket: 0,
      fortificationInvestmentBucket: 0
    }))
  };
}

export function requireC64PlayerMemory(
  state: GameState,
  playerId: PlayerId
): C64AiPlayerMemory {
  const memory = state.c64.playerMemory.find((candidate) => candidate.playerId === playerId);
  if (memory === undefined) {
    throw new Error(`Missing C64 player memory for player ${playerId}.`);
  }
  return memory;
}

export function requireC64Ca61Byte(state: GameState, ownerSlot: number): number {
  if (!Number.isInteger(ownerSlot) || ownerSlot < 0 || ownerSlot >= state.c64.ca61Bytes.length) {
    throw new Error(`Invalid C64 $CA61 owner slot ${ownerSlot}.`);
  }
  const value = state.c64.ca61Bytes[ownerSlot];
  if (value === undefined) {
    throw new Error(`Missing C64 $CA61 byte for owner slot ${ownerSlot}.`);
  }
  requireByte(value, `C64 $CA61+${ownerSlot} compatibility byte`);
  return value;
}

export function updateC64PlayerMemory(
  state: GameState,
  playerId: PlayerId,
  update: (memory: C64AiPlayerMemory) => C64AiPlayerMemory
): GameState {
  requireC64PlayerMemory(state, playerId);
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

export function requireC64RoyalistProvinceMemory(
  state: GameState,
  provinceId: ProvinceId
): C64RoyalistProvinceMemory {
  const memory = state.c64.royalistProvinceMemory.find(
    (candidate) => candidate.provinceId === provinceId
  );
  if (memory === undefined) {
    throw new Error(`Missing C64 royalist province memory for province ${provinceId}.`);
  }
  return memory;
}

export function updateC64RoyalistProvinceMemory(
  state: GameState,
  provinceId: ProvinceId,
  update: (memory: C64RoyalistProvinceMemory) => C64RoyalistProvinceMemory
): GameState {
  requireC64RoyalistProvinceMemory(state, provinceId);
  return {
    ...state,
    c64: {
      ...state.c64,
      royalistProvinceMemory: state.c64.royalistProvinceMemory.map((memory) =>
        memory.provinceId === provinceId ? update(memory) : memory
      )
    }
  };
}

export function validateC64CompatibilityState(state: GameState): void {
  const playerIds = new Set(state.players.map((player) => player.id));
  const provinceIds = new Set(state.map.provinces.map((province) => province.id));

  if (state.c64.ca61Bytes.length !== state.players.length + 1) {
    throw new Error(
      `C64 $CA61 byte count ${state.c64.ca61Bytes.length} does not match owner-slot count ` +
      `${state.players.length + 1}.`
    );
  }
  for (let index = 0; index < state.c64.ca61Bytes.length; index += 1) {
    requireC64Ca61Byte(state, index);
  }
  requireByte(state.c64.calendar.year, 'C64 year');
  if (
    !Number.isInteger(state.c64.calendar.month) ||
    state.c64.calendar.month < 0 ||
    state.c64.calendar.month > 11
  ) {
    throw new Error(`C64 month must be 0..11, got ${state.c64.calendar.month}.`);
  }
  if (
    !Number.isInteger(state.c64.calendar.weatherIndex) ||
    state.c64.calendar.weatherIndex < 0 ||
    state.c64.calendar.weatherIndex > 6
  ) {
    throw new Error(`C64 weather index must be 0..6, got ${state.c64.calendar.weatherIndex}.`);
  }
  if (
    !Number.isInteger(state.c64.calendar.weatherFactor) ||
    state.c64.calendar.weatherFactor < 40 ||
    state.c64.calendar.weatherFactor > 160
  ) {
    throw new Error(
      `C64 weather factor must be 40..160, got ${state.c64.calendar.weatherFactor}.`
    );
  }
  requireByte(state.c64.calendar.weatherDerived, 'C64 weather-derived factor');
  requireNonNegativeInteger(state.c64.deserterSoldiers, 'C64 deserter soldiers');
  if (
    state.c64.deserterOwnerId !== null &&
    !playerIds.has(state.c64.deserterOwnerId)
  ) {
    throw new Error(`C64 deserter memory references unknown player ${state.c64.deserterOwnerId}.`);
  }

  if (state.c64.playerMemory.length !== state.players.length) {
    throw new Error(
      `C64 player memory count ${state.c64.playerMemory.length} does not match player count ${state.players.length}.`
    );
  }

  requireUniqueIds(
    state.c64.playerMemory.map((memory) => memory.playerId),
    'C64 player memory'
  );

  for (const memory of state.c64.playerMemory) {
    if (!playerIds.has(memory.playerId)) {
      throw new Error(`C64 player memory references unknown player ${memory.playerId}.`);
    }
    if (!Number.isInteger(memory.rank) || memory.rank < 0 || memory.rank > 5) {
      throw new Error(`C64 rank for ${memory.playerId} must be 0..5, got ${memory.rank}.`);
    }
    requireNonNegativeInteger(memory.hiredSoldiers, `C64 hired soldiers for ${memory.playerId}`);
    requireNonNegativeInteger(
      memory.economyCarryoverMoney,
      `C64 economy carryover money for ${memory.playerId}`
    );
    requireNonNegativeInteger(
      memory.rememberedTargetSoldiers,
      `C64 remembered target soldiers for ${memory.playerId}`
    );
    if (
      memory.rememberedTargetProvinceId !== null &&
      !provinceIds.has(memory.rememberedTargetProvinceId)
    ) {
      throw new Error(
        `C64 player memory for ${memory.playerId} references unknown remembered target ${memory.rememberedTargetProvinceId}.`
      );
    }
  }

  if (state.c64.royalistProvinceMemory.length !== state.map.provinces.length) {
    throw new Error(
      `C64 royalist province memory count ${state.c64.royalistProvinceMemory.length} does not match province count ${state.map.provinces.length}.`
    );
  }

  requireUniqueIds(
    state.c64.royalistProvinceMemory.map((memory) => memory.provinceId),
    'C64 royalist memory'
  );

  for (const memory of state.c64.royalistProvinceMemory) {
    if (!provinceIds.has(memory.provinceId)) {
      throw new Error(`C64 royalist memory references unknown province ${memory.provinceId}.`);
    }
    requireByte(
      memory.villageInvestmentBucket,
      `C64 royalist village bucket for ${memory.provinceId}`
    );
    requireByte(
      memory.fortificationInvestmentBucket,
      `C64 royalist fortification bucket for ${memory.provinceId}`
    );
  }
}
