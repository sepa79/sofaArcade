import { describe, expect, it } from 'vitest';

import {
  advanceTurn,
  canBuildRelay,
  estimatedTravelTurns,
  knowledgeAge,
  playerRelayConstructions
} from './logic';
import { relayPathDistance } from './relay';
import { createInitialState } from './state';

describe('Fog of Time prototype logic', () => {
  it('computes radio travel from distance at light speed', () => {
    const state = createInitialState();
    expect(estimatedTravelTurns(state, 'tau', 'radio')).toBe(2);
  });

  it('computes relay path from summed leg distance', () => {
    const state = createInitialState();
    const pathDistance = relayPathDistance(state, 'sol', 'tau', 'player');
    expect(pathDistance).not.toBeNull();
    expect(Math.ceil(pathDistance ?? 0)).toBe(3);
    expect(estimatedTravelTurns(state, 'tau', 'relay')).toBe(3);
  });

  it('applies doctrine only after message arrival', () => {
    let state = createInitialState();
    state = advanceTurn(state, [
      {
        type: 'SET_DOCTRINE',
        systemId: 'tau',
        doctrine: 'SURVIVAL',
        channel: 'radio'
      }
    ]);

    expect(state.systems.find((system) => system.id === 'tau')?.doctrine).toBe('EXPAND');

    state = advanceTurn(state, []);

    expect(state.systems.find((system) => system.id === 'tau')?.doctrine).toBe('SURVIVAL');
  });

  it('updates player knowledge only when a remote report arrives, and the report stays old on arrival', () => {
    let state = createInitialState();
    expect(knowledgeAge(state, 'tau')).toBe(0);

    state = advanceTurn(state, []);
    expect(knowledgeAge(state, 'tau')).toBe(1);

    state = advanceTurn(state, []);
    expect(knowledgeAge(state, 'tau')).toBe(2);

    state = advanceTurn(state, []);
    expect(knowledgeAge(state, 'tau')).toBe(3);

    state = advanceTurn(state, []);
    expect(knowledgeAge(state, 'tau')).toBe(3);
  });

  it('allows building a relay only between owned systems without an existing link', () => {
    const state = createInitialState();
    expect(canBuildRelay(state, 'sol', 'tau')).toBe(true);
    expect(canBuildRelay(state, 'sol', 'haven')).toBe(false);
    expect(canBuildRelay(state, 'sol', 'kepler')).toBe(false);
  });

  it('starts relay construction when the order arrives, then completes it after 2 turns', () => {
    let state = createInitialState();
    state = advanceTurn(state, [
      {
        type: 'BUILD_RELAY',
        fromSystemId: 'sol',
        toSystemId: 'tau',
        channel: 'radio'
      }
    ]);

    expect(playerRelayConstructions(state)).toHaveLength(1);
    expect(canBuildRelay(state, 'sol', 'tau')).toBe(false);

    state = advanceTurn(state, []);
    expect(playerRelayConstructions(state)).toHaveLength(1);
    expect(estimatedTravelTurns(state, 'tau', 'relay')).toBe(3);

    state = advanceTurn(state, []);
    expect(playerRelayConstructions(state)).toHaveLength(0);
    expect(estimatedTravelTurns(state, 'tau', 'relay')).toBe(2);
  });
});
