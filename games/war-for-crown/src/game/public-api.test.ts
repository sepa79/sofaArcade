import { describe, expect, it } from 'vitest';

import { chooseDeterministicAiAction, runMatch } from '../index';

describe('public game API', () => {
  it('runs headless simulation from the package root without Phaser globals', () => {
    const runtime = runMatch({
      seed: 11,
      clients: {
        p1: chooseDeterministicAiAction,
        p2: chooseDeterministicAiAction,
        p3: chooseDeterministicAiAction,
        p4: chooseDeterministicAiAction
      },
      maxSteps: 4
    });

    expect(runtime.transcript.status).toBe('step-limit-reached');
    expect(runtime.transcript.steps).toHaveLength(4);
  });
});
