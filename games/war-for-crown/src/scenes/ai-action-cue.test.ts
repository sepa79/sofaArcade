import { describe, expect, it } from 'vitest';

import { aiActionCues } from './ai-action-cue';

describe('AI action cues', () => {
  it('preserves every attack source and target for map presentation', () => {
    expect(aiActionCues([{ type: 'battle-started', attackerId: 'p2', defenderId: 'p1', fromProvinceIds: ['1', '2'], targetProvinceId: '3', attackingSoldiers: 9, defendingSoldiers: 4 }]))
      .toEqual([{ kind: 'attack', actorId: 'p2', fromProvinceIds: ['1', '2'], targetProvinceId: '3', soldiers: 9 }]);
  });
});
