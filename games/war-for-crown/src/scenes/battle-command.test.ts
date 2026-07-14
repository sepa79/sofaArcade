import { describe, expect, it } from 'vitest';

import { ROYALIST_OWNER_ID } from '../game/owners';
import type { BattleState } from '../game/types';
import { battleUiCommand } from './battle-command';

const ROYALIST_DEFENCE: BattleState = {
  attackerId: 'p1',
  defenderId: ROYALIST_OWNER_ID,
  fromProvinceIds: ['p1-home'],
  targetProvinceId: 'royalist',
  attackerInitialSoldiers: 15,
  defenderInitialSoldiers: 10,
  attackerSoldiers: 15,
  defenderSoldiers: 10,
  attackerCombatPercent: 100,
  defenderCombatPercent: 100,
  attackerHitDenominator: 100,
  defenderHitDenominator: 100,
  round: 0,
  retreatSide: null
};

describe('battleUiCommand', () => {
  it('routes a human fight against royalists through the C64 battle-command SSOT', () => {
    expect(battleUiCommand(ROYALIST_DEFENCE, 'fight-round')).toEqual({
      playerId: 'p1',
      action: { type: 'run-c64-battle-command' }
    });
  });

  it('routes a visible AI battle step through the same C64 battle-command SSOT', () => {
    expect(battleUiCommand(ROYALIST_DEFENCE, 'advance-ai')).toEqual({
      playerId: 'p1',
      action: { type: 'run-c64-battle-command' }
    });
  });

  it('fails fast when UI attempts to command a royalist defender retreat directly', () => {
    expect(() => battleUiCommand(ROYALIST_DEFENCE, 'retreat-defender')).toThrow(
      'Royalist defender 0 cannot receive a human retreat command.'
    );
  });
});
