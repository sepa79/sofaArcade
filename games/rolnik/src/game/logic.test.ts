import { describe, expect, it } from 'vitest';

import { stepGame } from './logic';
import { createInitialState } from './state';
import type { FrameInput } from './types';

const NEUTRAL_INPUT: FrameInput = {
  menuLeftPressed: false,
  menuRightPressed: false,
  submenuUpPressed: false,
  submenuDownPressed: false,
  selectPressed: false,
  backPressed: false,
  endTurnPressed: false
};

describe('stepGame', () => {
  it('rotates the active player menu section on left/right only for that player', () => {
    const state = createInitialState({
      startingProfileIds: ['dairy-start', 'pork-start']
    });

    const next = stepGame(state, {
      ...NEUTRAL_INPUT,
      menuRightPressed: true
    });

    expect(next.players[0]?.activeMenuSection).toBe('animals');
    expect(next.players[0]?.activeSubmenuIndex).toBe(0);
    expect(next.players[1]?.activeMenuSection).toBe('crops');
  });

  it('rotates the active player submenu on up/down without affecting other players', () => {
    const state = createInitialState({
      startingProfileIds: ['dairy-start', 'pork-start']
    });

    const next = stepGame(state, {
      ...NEUTRAL_INPUT,
      submenuDownPressed: true
    });

    expect(next.players[0]?.activeSubmenuIndex).toBe(1);
    expect(next.players[1]?.activeSubmenuIndex).toBe(0);
  });

  it('enters field detail mode from crop planning', () => {
    const state = createInitialState({
      startingProfileIds: ['dairy-start', 'pork-start']
    });

    const detailState = stepGame(state, {
      ...NEUTRAL_INPUT,
      selectPressed: true
    });

    expect(detailState.players[0]?.detailMode).toBe('fields');
    expect(detailState.players[0]?.detailIndex).toBe(0);
    expect(detailState.players[0]?.detailMenuIndex).toBe(0);
  });

  it('exits field detail mode with left/right navigation instead of submenu exit', () => {
    const state = createInitialState({
      startingProfileIds: ['dairy-start', 'pork-start']
    });

    const detailState = stepGame(state, {
      ...NEUTRAL_INPUT,
      selectPressed: true
    });

    const exitedState = stepGame(detailState, {
      ...NEUTRAL_INPUT,
      menuRightPressed: true
    });

    expect(exitedState.players[0]?.detailMode).toBe('menu');
    expect(exitedState.players[0]?.activeMenuSection).toBe('crops');
    expect(exitedState.players[0]?.activeSubmenuIndex).toBe(0);
  });

  it('uses up and down to rotate selected field while in field detail mode', () => {
    let state = createInitialState({
      startingProfileIds: ['dairy-start', 'pork-start']
    });

    state = stepGame(state, {
      ...NEUTRAL_INPUT,
      submenuDownPressed: true
    });

    const next = stepGame(state, {
      ...NEUTRAL_INPUT,
      selectPressed: true
    });

    expect(next.players[0]?.detailMode).toBe('fields');
    expect(next.players[0]?.detailIndex).toBe(1);
    expect(next.players[0]?.detailMenuIndex).toBe(0);
    expect(next.players[0]?.activeMenuSection).toBe('crops');
  });

  it('moves to the next player before advancing the season', () => {
    const state = createInitialState({
      startingProfileIds: ['dairy-start', 'pork-start']
    });

    const next = stepGame(state, { ...NEUTRAL_INPUT, endTurnPressed: true });

    expect(next.activePlayerIndex).toBe(1);
    expect(next.season).toBe('spring');
  });

  it('advances the year after the full player rotation through winter', () => {
    const state = createInitialState({
      startingProfileIds: ['dairy-start', 'pork-start']
    });

    let next = state;
    for (let index = 0; index < 8; index += 1) {
      next = stepGame(next, { ...NEUTRAL_INPUT, endTurnPressed: true });
    }

    expect(next.activePlayerIndex).toBe(0);
    expect(next.season).toBe('spring');
    expect(next.year).toBe(2);
  });
});
