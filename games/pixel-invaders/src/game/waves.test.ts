import { describe, expect, it } from 'vitest';

import {
  advanceCampaignState,
  CLASSIC_START_ROWS,
  CLASSIC_TOTAL_ROWS,
  createInitialCampaignState,
  enemyBaseSpeedForCampaign,
  enemyFireIntervalForCampaign,
  GALAGA_TOTAL_ROWS,
  galagaRowDefinition,
  spawnGalagaRow,
  spawnInitialClassicFormation
} from './waves';

describe('waves', () => {
  it('starts the campaign on classic endless rows', () => {
    const campaign = createInitialCampaignState();

    expect(campaign.phase).toBe('classic-endless');
    expect(campaign.rowsSpawned).toBe(CLASSIC_START_ROWS);
    expect(campaign.rowsCleared).toBe(0);
    expect(campaign.rowsTarget).toBe(CLASSIC_TOTAL_ROWS);
  });

  it('switches from classic endless to galaga rows and then to boss', () => {
    const afterClassic = advanceCampaignState({
      phase: 'classic-endless',
      rowsCleared: CLASSIC_TOTAL_ROWS,
      rowsSpawned: CLASSIC_TOTAL_ROWS,
      rowsTarget: CLASSIC_TOTAL_ROWS,
      startRows: CLASSIC_START_ROWS,
      transitionTimerSec: 0
    });

    expect(afterClassic.phase).toBe('galaga-rows');
    if (afterClassic.phase !== 'galaga-rows') {
      throw new Error('Expected galaga-rows campaign after classic stage.');
    }
    expect(afterClassic.currentRowNumber).toBe(1);
    expect(afterClassic.rowsTarget).toBe(GALAGA_TOTAL_ROWS);
    expect(afterClassic.transitionTimerSec).toBeGreaterThan(0);

    const afterDive = advanceCampaignState({
      phase: 'galaga-rows',
      rowsCleared: GALAGA_TOTAL_ROWS,
      currentRowNumber: GALAGA_TOTAL_ROWS,
      rowsTarget: GALAGA_TOTAL_ROWS,
      transitionTimerSec: 0
    });

    expect(afterDive.phase).toBe('boss');
    expect(afterDive.transitionTimerSec).toBeGreaterThan(0);
  });

  it('spawns the opening classic rows with guaranteed ufo rapid-fire drops', () => {
    const classicWave = spawnInitialClassicFormation(123);

    expect(classicWave.enemies.every((enemy) => enemy.motion.kind === 'formation')).toBe(true);
    expect(classicWave.enemies.filter((enemy) => enemy.kind === 'ufo')).toHaveLength(CLASSIC_START_ROWS);
    expect(
      classicWave.enemies
        .filter((enemy) => enemy.kind === 'ufo')
        .every((enemy) => enemy.guaranteedPickupKind === 'rapid-fire')
    ).toBe(true);
  });

  it('spawns galaga rows with entry paths and faster pacing', () => {
    const galagaCampaign = advanceCampaignState({
      phase: 'classic-endless',
      rowsCleared: CLASSIC_TOTAL_ROWS,
      rowsSpawned: CLASSIC_TOTAL_ROWS,
      rowsTarget: CLASSIC_TOTAL_ROWS,
      startRows: CLASSIC_START_ROWS,
      transitionTimerSec: 0
    });
    if (galagaCampaign.phase !== 'galaga-rows') {
      throw new Error('Expected galaga-rows campaign after classic stage.');
    }

    const diveWave = spawnGalagaRow(
      {
        ...galagaCampaign,
        transitionTimerSec: 0
      },
      true
    );

    expect(diveWave.enemies.some((enemy) => enemy.motion.kind === 'path' && enemy.motion.path === 'entry')).toBe(true);
    expect(diveWave.enemySpeed).toBe(galagaRowDefinition(1).enemySpeed);
    expect(diveWave.enemyFireTimer).toBeLessThan(enemyFireIntervalForCampaign(createInitialCampaignState()));
    expect(galagaRowDefinition(1).enemySpeed).toBeGreaterThan(enemyBaseSpeedForCampaign(createInitialCampaignState()));
  });
});
