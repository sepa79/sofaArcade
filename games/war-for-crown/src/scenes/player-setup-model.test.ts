import { describe, expect, it } from 'vitest';

import { DEFAULT_GAME_CONFIG } from '../game/constants';
import { synchronizePlayerSetups } from './player-setup-model';

describe('War for Crown player setup model', () => {
  it('creates four editable human player slots', () => {
    const setups = synchronizePlayerSetups({
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 4,
      aiPlayerCount: 0
    }, []);

    expect(setups.map(({ playerId, controller }) => ({ playerId, controller }))).toEqual([
      { playerId: 'p1', controller: 'human' },
      { playerId: 'p2', controller: 'human' },
      { playerId: 'p3', controller: 'human' },
      { playerId: 'p4', controller: 'human' }
    ]);
  });

  it('preserves names when increasing the human player count', () => {
    const twoHumans = synchronizePlayerSetups(DEFAULT_GAME_CONFIG, []);
    const renamed = twoHumans.map((setup) => setup.playerId === 'p1'
      ? { ...setup, name: 'Ten sam' }
      : setup);
    const fourHumans = synchronizePlayerSetups({
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 4,
      aiPlayerCount: 0
    }, renamed);

    expect(fourHumans[0]?.name).toBe('Ten sam');
    expect(fourHumans[2]?.name).toBe('P3');
  });
});
