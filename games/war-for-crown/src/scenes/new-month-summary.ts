import { applyPlayerAction } from '../game/actions';
import type { WarForCrownEvent } from '../game/events';
import type { GameConfig, GameState } from '../game/types';
import { c64RandomEventCopy } from './c64-event-copy';
import {
  provinceLabelForLanguage,
  WEATHER_LABELS
} from './scene-presentation';
import type { Language } from './ui-copy';

type RandomEvent = Extract<WarForCrownEvent, { readonly type: 'c64-random-event' }>;

export function newMonthEventLabel(event: RandomEvent | undefined, language: Language): string {
  if (event === undefined) {
    return language === 'pl' ? 'brak' : 'none';
  }
  return c64RandomEventCopy({
    eventId: event.eventId,
    amount: event.amount,
    provinceId: event.provinceId,
    provinceLabel: event.provinceId === null
      ? null
      : provinceLabelForLanguage(event.provinceId, language)
  }, language);
}

export function createNewMonthSummary(
  state: GameState,
  config: GameConfig,
  language: Language
): string {
  const preview = applyPlayerAction(
    state,
    state.activePlayerId,
    { type: 'advance-step' },
    config
  );
  const incomeEvent = preview.events.find((event) => event.type === 'income-collected');
  if (incomeEvent === undefined) {
    throw new Error('New-month preview did not emit income-collected.');
  }
  const weather = WEATHER_LABELS[preview.state.c64.calendar.weatherIndex];
  if (weather === undefined) {
    throw new Error(
      `Missing weather label for index ${preview.state.c64.calendar.weatherIndex}.`
    );
  }
  const eventLabel = newMonthEventLabel(
    preview.events.find((event) => event.type === 'c64-random-event'),
    language
  );
  const eventSentence = eventLabel.endsWith('.') ? eventLabel : `${eventLabel}.`;

  return language === 'pl'
    ? `Miesiac ${state.turnNumber}. Pogoda: ${weather.pl}. Dochod: +${incomeEvent.money}. Zdarzenie: ${eventSentence}`
    : `Month ${state.turnNumber}. Weather: ${weather.en}. Income: +${incomeEvent.money}. Event: ${eventSentence}`;
}
