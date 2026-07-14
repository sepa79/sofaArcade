import { fortificationIndex, fortificationLevelAtIndex } from './rules';
import { buildMapProvinceTileCounts, provinceVillageCap } from './map';
import { c64Multiply32 } from './c64-arithmetic';
import { requireC64Ca61Byte, requireC64PlayerMemory } from './c64-state';
import { nextRngByte } from './rng';
import type { GameConfig, GameState, PlayerId, ProvinceId, ProvinceState } from './types';

const C64_24_BIT_MODULO = 0x1000000;
const C64_EVENT_START_MONTH = 7;
const C64_EVENT_GATE = 0x10;

export type C64RandomEventId =
  | 'za' | 'zb' | 'zc' | 'zd' | 'ze' | 'zf' | 'zg' | 'zh' | 'zi'
  | 'zj' | 'zk' | 'zl' | 'zm' | 'zn' | 'zo' | 'zp' | 'zq' | 'zr'
  | 'zs' | 'zt' | 'zu' | 'zv' | 'zw' | 'zx' | 'zy' | 'zz';

export type C64RandomEventEffect =
  | 'none'
  | 'money-gained'
  | 'money-lost'
  | 'village-gained'
  | 'village-lost'
  | 'soldiers-gained'
  | 'soldiers-lost'
  | 'deserters-stored'
  | 'deserters-transferred'
  | 'fortification-lost';

export interface C64RandomEventResolution {
  readonly eventId: C64RandomEventId;
  readonly effect: C64RandomEventEffect;
  readonly amount: number;
  readonly provinceId: ProvinceId | null;
}

export interface C64RandomEventResult {
  readonly state: GameState;
  readonly resolution: C64RandomEventResolution | null;
  readonly rngBytesConsumed: number;
}

interface RngContext {
  rngState: number;
  consumed: number;
}

function requirePositiveByte(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 0xff) {
    throw new Error(`${label} must be a positive C64 byte, got ${value}.`);
  }
}

function c64ModuloPlusTwo(context: RngContext, max: number): number {
  requirePositiveByte(max, 'C64 event RNG maximum');
  const next = nextRngByte(context.rngState);
  context.rngState = next.rngState;
  context.consumed += 1;
  return ((next.byte % max) + 2) & 0xff;
}

function playerIndex(state: GameState, playerId: PlayerId): number {
  const index = state.players.findIndex((player) => player.id === playerId);
  if (index < 0) {
    throw new Error(`Unknown C64 event player ${playerId}.`);
  }
  return index;
}

function activePlayer(state: GameState) {
  const index = playerIndex(state, state.activePlayerId);
  const player = state.players[index];
  if (player === undefined) {
    throw new Error(`Missing C64 event player at index ${index}.`);
  }
  return { player, index, ownerSlot: index + 1 };
}

function eventIdAtIndex(index: number): C64RandomEventId {
  if (!Number.isInteger(index) || index < 0 || index >= 26) {
    throw new Error(`C64 event index must be 0..25, got ${index}.`);
  }
  return `z${String.fromCharCode(0x61 + index)}` as C64RandomEventId;
}

function randomAmount(
  state: GameState,
  scale: number,
  context: RngContext
): number | null {
  requirePositiveByte(scale, 'C64 event amount scale');
  const liveMemories = state.c64.playerMemory.filter((memory) =>
    state.map.provinces.some((province) => province.ownerId === memory.playerId)
  );
  if (liveMemories.length < 1) {
    throw new Error('C64 event amount requires at least one live player.');
  }
  const highestRank = Math.max(...liveMemories.map((memory) => memory.rank));
  const highestCount = liveMemories.filter((memory) => memory.rank === highestRank).length;
  const memory = requireC64PlayerMemory(state, state.activePlayerId);
  if (memory.rank === highestRank && highestCount === 1) {
    return null;
  }
  if (state.c64.calendar.year < 1) {
    throw new Error(`C64 event amount year must be positive, got ${state.c64.calendar.year}.`);
  }

  const rankMultiplier = highestRank - memory.rank + 1;
  const scaledAmount = c64Multiply32(
    c64Multiply32(rankMultiplier, scale),
    state.c64.calendar.year
  );
  const bytes = [
    scaledAmount & 0xff,
    (scaledAmount >>> 8) & 0xff,
    (scaledAmount >>> 16) & 0xff
  ];
  const randomized = bytes.map((byte) => byte === 0 ? 0 : c64ModuloPlusTwo(context, byte));
  const low = randomized[0];
  const middle = randomized[1];
  const high = randomized[2];
  if (low === undefined || middle === undefined || high === undefined) {
    throw new Error('C64 event amount did not produce three bytes.');
  }
  return low + middle * 0x100 + high * 0x10000;
}

function percentLoss(value: number, rngMaximum: number, addend: number, context: RngContext): {
  readonly value: number;
  readonly loss: number;
} {
  if (!Number.isInteger(value) || value < 0 || value >= C64_24_BIT_MODULO) {
    throw new Error(`C64 event loss value must be a 24-bit integer, got ${value}.`);
  }
  requirePositiveByte(rngMaximum, 'C64 event loss RNG maximum');
  requirePositiveByte(addend, 'C64 event loss addend');
  const percent = c64ModuloPlusTwo(context, rngMaximum) + addend;
  const reduced = Math.floor((value * (100 - percent)) / 100);
  return { value: reduced, loss: value - reduced };
}

function replaceProvince(
  state: GameState,
  provinceId: ProvinceId,
  update: (province: ProvinceState) => ProvinceState
): GameState {
  if (!state.map.provinces.some((province) => province.id === provinceId)) {
    throw new Error(`Unknown C64 event province ${provinceId}.`);
  }
  return {
    ...state,
    map: {
      ...state.map,
      provinces: state.map.provinces.map((province) =>
        province.id === provinceId ? update(province) : province
      )
    }
  };
}

function descendingEligible(
  state: GameState,
  predicate: (province: ProvinceState) => boolean
): ReadonlyArray<ProvinceState> {
  return [...state.map.provinces].reverse().filter(predicate);
}

function selectWithC64Ordinal(
  candidates: ReadonlyArray<ProvinceState>,
  context: RngContext,
  doubleDecrement: boolean
): ProvinceState | null {
  if (candidates.length === 0) {
    return null;
  }
  let ordinal = c64ModuloPlusTwo(context, candidates.length);
  ordinal = (ordinal - 1) & 0xff;
  if (doubleDecrement) {
    ordinal = (ordinal - 1) & 0xff;
    if (ordinal === 0) {
      return null;
    }
  }
  for (const candidate of candidates) {
    ordinal = (ordinal - 1) & 0xff;
    if (ordinal === 0) {
      return candidate;
    }
  }
  return null;
}

function moneyState(state: GameState, money: number): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === state.activePlayerId ? { ...player, money } : player
    )
  };
}

function gainMoney(
  state: GameState,
  scale: number,
  context: RngContext,
  eventId: C64RandomEventId
): { readonly state: GameState; readonly resolution: C64RandomEventResolution } {
  const amount = randomAmount(state, scale, context);
  if (amount === null) {
    return { state, resolution: { eventId, effect: 'none', amount: 0, provinceId: null } };
  }
  const { player } = activePlayer(state);
  return {
    state: moneyState(state, (player.money + amount) % C64_24_BIT_MODULO),
    resolution: { eventId, effect: 'money-gained', amount, provinceId: null }
  };
}

function loseMoney(
  state: GameState,
  rngMaximum: number,
  addend: number,
  context: RngContext,
  eventId: C64RandomEventId
): { readonly state: GameState; readonly resolution: C64RandomEventResolution } {
  const { player } = activePlayer(state);
  const reduced = percentLoss(player.money, rngMaximum, addend, context);
  return {
    state: moneyState(state, reduced.value),
    resolution: { eventId, effect: 'money-lost', amount: reduced.loss, provinceId: null }
  };
}

function loseSoldiers(
  state: GameState,
  context: RngContext,
  eventId: C64RandomEventId,
  storesDeserters: boolean
): { readonly state: GameState; readonly resolution: C64RandomEventResolution } {
  const province = descendingEligible(
    state,
    (candidate) => candidate.ownerId === state.activePlayerId && candidate.soldiers >= 20
  )[0];
  if (province === undefined) {
    return { state, resolution: { eventId, effect: 'none', amount: 0, provinceId: null } };
  }
  const reduced = percentLoss(province.soldiers, 5, 5, context);
  let nextState = replaceProvince(state, province.id, (candidate) => ({
    ...candidate,
    soldiers: reduced.value
  }));
  if (storesDeserters) {
    nextState = {
      ...nextState,
      c64: {
        ...nextState.c64,
        deserterSoldiers: reduced.loss & 0xff,
        deserterOwnerId: state.activePlayerId
      }
    };
  }
  return {
    state: nextState,
    resolution: {
      eventId,
      effect: storesDeserters ? 'deserters-stored' : 'soldiers-lost',
      amount: reduced.loss,
      provinceId: province.id
    }
  };
}

function setEventFlag(state: GameState, ownerSlot: number, flag: number): GameState {
  const ca61Bytes = [...state.c64.ca61Bytes];
  ca61Bytes[ownerSlot] = requireC64Ca61Byte(state, ownerSlot) | flag;
  return { ...state, c64: { ...state.c64, ca61Bytes } };
}

function noEffect(eventId: C64RandomEventId, state: GameState) {
  return { state, resolution: { eventId, effect: 'none', amount: 0, provinceId: null } } as const;
}

export function runC64EventModule(
  state: GameState,
  eventId: C64RandomEventId,
  config: GameConfig
): C64RandomEventResult {
  const context: RngContext = { rngState: state.rngState, consumed: 0 };
  const { player, ownerSlot } = activePlayer(state);
  let result: { readonly state: GameState; readonly resolution: C64RandomEventResolution };

  switch (eventId) {
    case 'za':
    case 'zr':
      result = loseMoney(state, 5, 5, context, eventId);
      break;
    case 'zb':
    case 'ze':
    case 'zi':
    case 'zx':
      if (eventId === 'zx' && state.c64.calendar.year < 3) {
        result = noEffect(eventId, state);
      } else if (eventId === 'zx' && (requireC64Ca61Byte(state, ownerSlot) & 0x08) !== 0) {
        result = noEffect(eventId, state);
      } else {
        const flagged = eventId === 'zx' ? setEventFlag(state, ownerSlot, 0x08) : state;
        result = gainMoney(flagged, 10, context, eventId);
      }
      break;
    case 'zc': {
      const candidates = descendingEligible(state, (province) => province.ownerId === player.id);
      const province = selectWithC64Ordinal(candidates, context, true);
      if (province === null) {
        result = noEffect(eventId, state);
        break;
      }
      const cap = provinceVillageCap(
        config,
        province.id,
        buildMapProvinceTileCounts(state.map)
      );
      if (province.villages >= cap) {
        result = noEffect(eventId, state);
        break;
      }
      result = {
        state: replaceProvince(state, province.id, (candidate) => ({
          ...candidate,
          villages: candidate.villages + 1
        })),
        resolution: { eventId, effect: 'village-gained', amount: 1, provinceId: province.id }
      };
      break;
    }
    case 'zd': {
      const candidates = descendingEligible(
        state,
        (province) => province.ownerId === player.id &&
          province.terrainId === 'forest' && province.villages > 0
      );
      const province = selectWithC64Ordinal(candidates, context, true);
      result = province === null
        ? noEffect(eventId, state)
        : {
            state: replaceProvince(state, province.id, (candidate) => ({
              ...candidate,
              villages: candidate.villages - 1
            })),
            resolution: { eventId, effect: 'village-lost', amount: 1, provinceId: province.id }
          };
      break;
    }
    case 'zf':
    case 'zk':
      result = loseSoldiers(state, context, eventId, false);
      break;
    case 'zg':
      result = loseSoldiers(state, context, eventId, true);
      break;
    case 'zh': {
      const amount = randomAmount(state, 10, context);
      if (amount === null || player.homeProvinceId === null) {
        result = noEffect(eventId, state);
        break;
      }
      const low = amount & 0xff;
      const middle = Math.floor(amount / 0x100) & 0xff;
      const c64AddedAmount = low + middle * 0x100 + middle * 0x10000;
      result = {
        state: replaceProvince(state, player.homeProvinceId, (province) => ({
          ...province,
          soldiers: (province.soldiers + c64AddedAmount) % C64_24_BIT_MODULO
        })),
        resolution: {
          eventId,
          effect: 'soldiers-gained',
          amount: c64AddedAmount,
          provinceId: player.homeProvinceId
        }
      };
      break;
    }
    case 'zm': {
      if (state.c64.deserterSoldiers === 0 || state.c64.deserterOwnerId === player.id ||
          player.homeProvinceId === null) {
        result = noEffect(eventId, state);
        break;
      }
      const amount = state.c64.deserterSoldiers;
      const transferred = replaceProvince(state, player.homeProvinceId, (province) => ({
        ...province,
        soldiers: (province.soldiers + amount) % C64_24_BIT_MODULO
      }));
      result = {
        state: {
          ...transferred,
          c64: {
            ...transferred.c64,
            deserterSoldiers: 0,
            deserterOwnerId: null
          }
        },
        resolution: {
          eventId,
          effect: 'deserters-transferred',
          amount,
          provinceId: player.homeProvinceId
        }
      };
      break;
    }
    case 'zq':
      result = gainMoney(state, 8, context, eventId);
      break;
    case 'zt':
      if (state.c64.calendar.year < 12 || (requireC64Ca61Byte(state, ownerSlot) & 0x01) !== 0) {
        result = noEffect(eventId, state);
      } else {
        result = gainMoney(setEventFlag(state, ownerSlot, 0x01), 50, context, eventId);
      }
      break;
    case 'zu':
      result = gainMoney(state, 20, context, eventId);
      break;
    case 'zv':
      result = state.c64.calendar.year < 5
        ? noEffect(eventId, state)
        : gainMoney(state, 30, context, eventId);
      break;
    case 'zw':
      if (state.c64.calendar.year < 3 || (requireC64Ca61Byte(state, ownerSlot) & 0x02) !== 0) {
        result = noEffect(eventId, state);
      } else {
        result = loseMoney(setEventFlag(state, ownerSlot, 0x02), 5, 1, context, eventId);
      }
      break;
    case 'zy': {
      const candidates = descendingEligible(
        state,
        (province) => province.ownerId === player.id && province.fortificationLevel !== 'none'
      );
      const province = selectWithC64Ordinal(candidates, context, false);
      result = province === null
        ? noEffect(eventId, state)
        : {
            state: replaceProvince(state, province.id, (candidate) => ({
              ...candidate,
              fortificationLevel: fortificationLevelAtIndex(
                fortificationIndex(candidate.fortificationLevel) - 1
              )
            })),
            resolution: {
              eventId,
              effect: 'fortification-lost',
              amount: 1,
              provinceId: province.id
            }
          };
      break;
    }
    case 'zj':
    case 'zl':
    case 'zn':
    case 'zo':
    case 'zp':
    case 'zs':
    case 'zz':
      result = noEffect(eventId, state);
      break;
  }

  return {
    state: { ...result.state, rngState: context.rngState },
    resolution: result.resolution,
    rngBytesConsumed: context.consumed
  };
}

export function runC64RandomEvent(
  state: GameState,
  config: GameConfig
): C64RandomEventResult {
  const { index } = activePlayer(state);
  if (!config.randomEventsEnabled) {
    return { state, resolution: null, rngBytesConsumed: 0 };
  }
  if (state.c64.calendar.year < 2 && state.c64.calendar.month < C64_EVENT_START_MONTH) {
    return { state, resolution: null, rngBytesConsumed: 0 };
  }
  if (index >= config.humanPlayerCount) {
    return { state, resolution: null, rngBytesConsumed: 0 };
  }

  const gate = nextRngByte(state.rngState);
  if (gate.byte < C64_EVENT_GATE) {
    return {
      state: { ...state, rngState: gate.rngState },
      resolution: null,
      rngBytesConsumed: 1
    };
  }

  const selectorContext: RngContext = { rngState: gate.rngState, consumed: 1 };
  const eventId = eventIdAtIndex(c64ModuloPlusTwo(selectorContext, 0x1a) - 2);
  const module = runC64EventModule(
    { ...state, rngState: selectorContext.rngState },
    eventId,
    config
  );
  return {
    state: module.state,
    resolution: module.resolution,
    rngBytesConsumed: selectorContext.consumed + module.rngBytesConsumed
  };
}
