import { requireC64Ca61Byte } from './c64-state';
import { calculateIncome } from './economy';
import { nextRngByte } from './rng';
import type { GameConfig, GameState, PlayerId } from './types';

const C64_24_BIT_MODULO = 0x1000000;

export interface C64PlayerIncomeResult {
  readonly state: GameState;
  readonly income: number;
  readonly rngBytesConsumed: number;
}

function playerOwnerSlot(state: GameState, playerId: PlayerId): number {
  const index = state.players.findIndex((player) => player.id === playerId);
  if (index < 0) {
    throw new Error(`Unknown C64 income player ${playerId}.`);
  }
  return index + 1;
}

export function runC64PlayerIncome(
  state: GameState,
  playerId: PlayerId,
  config: GameConfig
): C64PlayerIncomeResult {
  const ownerSlot = playerOwnerSlot(state, playerId);
  const flags = requireC64Ca61Byte(state, ownerSlot);
  let rngState = state.rngState;
  let rngBytesConsumed = 0;
  let income = calculateIncome(state.map, playerId, config);

  if ((flags & 0x10) !== 0) {
    const next = nextRngByte(rngState);
    rngState = next.rngState;
    rngBytesConsumed += 1;
    if (next.byte >= 0x80) {
      income = Math.floor(income / 2);
    }
  }

  if ((flags & 0x20) !== 0) {
    const next = nextRngByte(rngState);
    rngState = next.rngState;
    rngBytesConsumed += 1;
    if (next.byte >= 0x80) {
      income = (income * 2) % C64_24_BIT_MODULO;
    }
  }

  const ca61Bytes = [...state.c64.ca61Bytes];
  ca61Bytes[ownerSlot] = flags & 0xcf;
  const players = state.players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          money: (player.money + income) % C64_24_BIT_MODULO
        }
      : player
  );

  return {
    state: {
      ...state,
      rngState,
      players,
      c64: {
        ...state.c64,
        ca61Bytes
      }
    },
    income,
    rngBytesConsumed
  };
}
