import { nextRngByte } from './rng';
import type { C64CalendarState } from './types';

const C64_MONTHS_PER_YEAR = 12;
const C64_WEATHER_ROLL_MAX = 0x62;
const C64_NEUTRAL_WEATHER_INDEX = 3;
const C64_MIN_WEATHER_FACTOR = 40;
const C64_MAX_WEATHER_FACTOR = 160;
const C64_WEATHER_DERIVED_OFFSET = 30;

const C64_WEATHER_WEIGHTS: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 0, 10, 15, 25, 30, 20],
  [0, 20, 30, 25, 15, 10, 0],
  [20, 30, 25, 15, 0, 0, 10],
  [0, 10, 25, 30, 20, 0, 15]
];

export interface C64MonthWeatherResult {
  readonly calendar: C64CalendarState;
  readonly rngState: number;
  readonly displayedYear: number;
  readonly displayedMonth: number;
  readonly rngByte: number;
  readonly weatherRoll: number;
}

function requireByte(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`${label} must be a C64 byte, got ${value}.`);
  }
}

function requireMonth(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value >= C64_MONTHS_PER_YEAR) {
    throw new Error(`C64 month must be 0..11, got ${value}.`);
  }
}

function requireWeatherIndex(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 6) {
    throw new Error(`C64 weather index must be 0..6, got ${value}.`);
  }
}

function requireWeatherFactor(value: number): void {
  if (!Number.isInteger(value) || value < C64_MIN_WEATHER_FACTOR || value > C64_MAX_WEATHER_FACTOR) {
    throw new Error(`C64 weather factor must be 40..160, got ${value}.`);
  }
}

export function c64AdvanceCalendarMonth(calendar: C64CalendarState): C64CalendarState {
  requireByte(calendar.year, 'C64 year');
  requireMonth(calendar.month);
  requireWeatherIndex(calendar.weatherIndex);
  requireWeatherFactor(calendar.weatherFactor);
  requireByte(calendar.weatherDerived, 'C64 weather-derived factor');
  if (!calendar.monthWeatherPending) {
    throw new Error('C64 month/weather phase is not pending.');
  }

  const nextMonth = calendar.month + 1;
  const wrapsYear = nextMonth === C64_MONTHS_PER_YEAR;
  return {
    ...calendar,
    year: wrapsYear ? (calendar.year + 1) & 0xff : calendar.year,
    month: wrapsYear ? 0 : nextMonth,
    monthWeatherPending: false
  };
}

function weatherWeightsForNextMonth(month: number): ReadonlyArray<number> {
  requireMonth(month);
  const nextMonth = (month + 1) % C64_MONTHS_PER_YEAR;
  const season = Math.floor(nextMonth / 3);
  const weights = C64_WEATHER_WEIGHTS[season];
  if (weights === undefined) {
    throw new Error(`Missing C64 weather weights for season ${season}.`);
  }
  return weights;
}

export function c64WeatherIndex(month: number, rngByte: number): {
  readonly weatherIndex: number;
  readonly weatherRoll: number;
} {
  requireByte(rngByte, 'C64 weather RNG byte');
  const weatherRoll = (rngByte % C64_WEATHER_ROLL_MAX) + 2;
  let remaining = weatherRoll;
  const weights = weatherWeightsForNextMonth(month);

  for (let weatherIndex = 0; weatherIndex < weights.length; weatherIndex += 1) {
    const weight = weights[weatherIndex];
    if (weight === undefined) {
      throw new Error(`Missing C64 weather weight ${weatherIndex}.`);
    }
    if (remaining < weight) {
      return { weatherIndex, weatherRoll };
    }
    remaining -= weight;
  }

  throw new Error(`C64 weather roll ${weatherRoll} did not select a weather index.`);
}

export function c64WeatherFactors(
  weatherIndex: number,
  weatherFactor: number
): { readonly weatherFactor: number; readonly weatherDerived: number } {
  requireWeatherIndex(weatherIndex);
  requireWeatherFactor(weatherFactor);

  let nextFactor: number;
  if (weatherIndex === C64_NEUTRAL_WEATHER_INDEX) {
    if (weatherFactor >= 110) {
      nextFactor = weatherFactor - 10;
    } else if (weatherFactor < 90) {
      nextFactor = weatherFactor + 10;
    } else {
      nextFactor = 100;
    }
  } else {
    nextFactor = Math.min(
      C64_MAX_WEATHER_FACTOR,
      Math.max(C64_MIN_WEATHER_FACTOR, weatherFactor + weatherIndex - 3)
    );
  }

  return {
    weatherFactor: nextFactor,
    weatherDerived: nextFactor - C64_WEATHER_DERIVED_OFFSET
  };
}

export function runC64MonthWeather(
  calendar: C64CalendarState,
  rngState: number
): C64MonthWeatherResult {
  requireByte(calendar.year, 'C64 year');
  requireMonth(calendar.month);
  requireWeatherIndex(calendar.weatherIndex);
  requireWeatherFactor(calendar.weatherFactor);
  requireByte(calendar.weatherDerived, 'C64 weather-derived factor');
  if (!calendar.monthWeatherPending) {
    throw new Error('C64 month/weather phase is not pending.');
  }

  const next = nextRngByte(rngState);
  const selected = c64WeatherIndex(calendar.month, next.byte);
  const factors = c64WeatherFactors(selected.weatherIndex, calendar.weatherFactor);
  const displayedYear = calendar.year;
  const displayedMonth = calendar.month;
  const advancedCalendar = c64AdvanceCalendarMonth({
    ...calendar,
    weatherIndex: selected.weatherIndex,
    weatherFactor: factors.weatherFactor,
    weatherDerived: factors.weatherDerived
  });

  return {
    calendar: advancedCalendar,
    rngState: next.rngState,
    displayedYear,
    displayedMonth,
    rngByte: next.byte,
    weatherRoll: selected.weatherRoll
  };
}
