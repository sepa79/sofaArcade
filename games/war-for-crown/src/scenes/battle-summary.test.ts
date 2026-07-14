import { describe, expect, it } from 'vitest';

import type { WarForCrownEvent } from '../game/events';
import { createBattleSummary } from './battle-summary';

describe('War for Crown battle summary', () => {
  it('requires the final round event next to a battle resolution', () => {
    const events: ReadonlyArray<WarForCrownEvent> = [{
      type: 'battle-resolved',
      attackerId: 'p1',
      defenderId: 0,
      fromProvinceIds: ['province-1'],
      targetProvinceId: 'province-2',
      attackingSoldiers: 10,
      result: {
        winner: 'attacker',
        resolution: 'elimination',
        attackerLosses: 2,
        defenderLosses: 5,
        survivingAttackers: 8,
        survivingDefenders: 0,
        attackStrength: 100,
        defenceStrength: 50
      }
    }];

    expect(() => createBattleSummary(events)).toThrow('requires a battle-round-resolved event');
  });

  it('returns null while a battle remains unresolved', () => {
    expect(createBattleSummary([])).toBeNull();
  });
});
