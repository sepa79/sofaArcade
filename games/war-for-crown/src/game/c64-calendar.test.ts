import { describe, expect, it } from 'vitest';

import { c64WeatherFactors, c64WeatherIndex, runC64MonthWeather } from './c64-calendar';
import { nextRngByte, normalizeRngSeed } from './rng';

describe('C64 month and weather', () => {
  it('matches the season-zero weighted-selection and drift fixture', () => {
    expect(c64WeatherIndex(1, 10)).toEqual({
      weatherIndex: 3,
      weatherRoll: 12
    });
    expect(c64WeatherFactors(3, 120)).toEqual({
      weatherFactor: 110,
      weatherDerived: 80
    });
  });

  it('matches neutral drift and bad/good weather clamp fixtures', () => {
    expect(c64WeatherFactors(3, 80)).toEqual({
      weatherFactor: 90,
      weatherDerived: 60
    });
    expect(c64WeatherFactors(0, 41)).toEqual({
      weatherFactor: 40,
      weatherDerived: 10
    });
    expect(c64WeatherFactors(6, 159)).toEqual({
      weatherFactor: 160,
      weatherDerived: 130
    });
  });

  it('consumes one RNG byte and advances December into the next C64 year', () => {
    const rngState = normalizeRngSeed(17);
    const expectedRng = nextRngByte(rngState);
    const result = runC64MonthWeather({
      year: 1,
      month: 11,
      weatherIndex: 4,
      weatherFactor: 100,
      weatherDerived: 70,
      monthWeatherPending: true
    }, rngState);

    expect(result.rngByte).toBe(expectedRng.byte);
    expect(result.rngState).toBe(expectedRng.rngState);
    expect(result.displayedYear).toBe(1);
    expect(result.displayedMonth).toBe(11);
    expect(result.calendar).toMatchObject({
      year: 2,
      month: 0,
      monthWeatherPending: false
    });
  });

  it('fails when the round-level month/weather phase is not pending', () => {
    expect(() => runC64MonthWeather({
      year: 1,
      month: 1,
      weatherIndex: 4,
      weatherFactor: 100,
      weatherDerived: 70,
      monthWeatherPending: false
    }, normalizeRngSeed(1))).toThrow('C64 month/weather phase is not pending.');
  });
});
