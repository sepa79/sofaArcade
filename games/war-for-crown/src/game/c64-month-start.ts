import { c64AdvanceCalendarMonth, runC64MonthWeather } from './c64-calendar';
import { isRoyalistOwner } from './owners';
import { nextRngByte } from './rng';
import { runC64RoyalistReinforcement } from './c64-royalist-reinforcement';
import type { GameConfig, GameState } from './types';

const C64_REINFORCEMENT_PENDING = 0xff;

export function runC64MonthStart(
  state: GameState,
  config: GameConfig
): GameState {
  if (!state.c64.calendar.monthWeatherPending) {
    throw new Error('C64 month start is not pending.');
  }

  const timer = state.c64.royalistReinforcementTimer;
  if (!Number.isInteger(timer) || timer < 0 || timer > 0xff) {
    throw new Error(`C64 royalist reinforcement timer must be a byte, got ${timer}.`);
  }

  if (timer === C64_REINFORCEMENT_PENDING) {
    const calendar = c64AdvanceCalendarMonth(state.c64.calendar);
    const hasRoyalistProvince = state.map.provinces.some((province) =>
      isRoyalistOwner(province.ownerId)
    );
    if (!hasRoyalistProvince) {
      return {
        ...state,
        c64: {
          ...state.c64,
          calendar,
          royalistReinforcementTimer: 0
        }
      };
    }

    const next = nextRngByte(state.rngState);
    const reinforcement = runC64RoyalistReinforcement({
      provinces: state.map.provinces,
      year: state.c64.calendar.year,
      month: state.c64.calendar.month,
      rngByte: next.byte,
      config
    });
    return {
      ...state,
      rngState: next.rngState,
      map: {
        ...state.map,
        provinces: reinforcement.provinces
      },
      c64: {
        ...state.c64,
        calendar,
        royalistReinforcementTimer: 0
      }
    };
  }

  let rngState = state.rngState;
  if (timer !== 0 && state.c64.calendar.year >= timer) {
    const trigger = nextRngByte(rngState);
    rngState = trigger.rngState;
    if ((trigger.byte & 0x03) === 0) {
      return {
        ...state,
        rngState,
        c64: {
          ...state.c64,
          calendar: c64AdvanceCalendarMonth(state.c64.calendar),
          royalistReinforcementTimer: C64_REINFORCEMENT_PENDING
        }
      };
    }
  }

  const weather = runC64MonthWeather(state.c64.calendar, rngState);
  return {
    ...state,
    rngState: weather.rngState,
    c64: {
      ...state.c64,
      calendar: weather.calendar
    }
  };
}
