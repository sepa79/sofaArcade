import { describe, expect, it } from 'vitest';

import { CONTRACT_DURATION_MIN, WEEK_DURATION_SECONDS, WEEKS_PER_MONTH } from './constants';
import { advanceTime, applyAction, updateBudget } from './logic';
import { createInitialState } from './state';
import type { GameAction, RandomSource } from './types';

class SequenceRandom implements RandomSource {
  private index = 0;

  constructor(private readonly values: ReadonlyArray<number>) {}

  next(): number {
    const value = this.values[this.index];
    if (value === undefined) {
      throw new Error(`SequenceRandom exhausted at index ${this.index}.`);
    }

    this.index += 1;
    return value;
  }
}

function runAction(state: ReturnType<typeof createInitialState>, action: GameAction): ReturnType<typeof createInitialState> {
  return applyAction(state, action, new SequenceRandom([0.4, 0.5, 0.6]));
}

describe('statecraft logic', () => {
  it('keeps budgets totaling 100 when one slider changes', () => {
    const initial = createInitialState();
    const next = updateBudget(initial, 'foodPct', 55);

    expect(next.budget.foodPct).toBe(55);
    expect(next.budget.foodPct + next.budget.healthPct + next.budget.oilPct + next.budget.securityPct).toBe(100);
  });

  it('supports survey and build actions on the selected tile', () => {
    const initial = createInitialState();
    const selected = applyAction(initial, { type: 'select_tile', tileId: 0 }, new SequenceRandom([0.2]));
    const surveyed = runAction(selected, { type: 'survey_tile' });
    const built = runAction(surveyed, { type: 'build_rig' });
    const tile = built.map.tiles.find((candidate) => candidate.id === 0);

    expect(tile?.surveyed).toBe(true);
    expect(tile?.rigLevel).toBe(1);
    expect(built.map.rigs).toBe(initial.map.rigs + 1);
  });

  it('settles a month and updates score and calendar', () => {
    let state = createInitialState();
    state = updateBudget(state, 'oilPct', 40);
    const random = new SequenceRandom([0.4, 0.4, 0.4, 0.4]);

    const next = advanceTime(state, WEEK_DURATION_SECONDS * WEEKS_PER_MONTH, random);

    expect(next.time.totalMonths).toBe(1);
    expect(next.time.month).toBe(2);
    expect(next.score.currentScore).toBeGreaterThan(0);
    expect(next.economy.previousTreasury).toBeCloseTo(next.economy.treasury - next.economy.monthlyNet);
  });

  it('creates contracts with bounded duration and queues market actions', () => {
    const initial = createInitialState();
    const random = new SequenceRandom([0.0, 0.0]);
    const contracted = applyAction(initial, { type: 'sign_contract' }, random);
    const spot = applyAction(contracted, { type: 'sell_spot' }, random);
    const gold = applyAction(spot, { type: 'buy_gold' }, random);

    expect(contracted.markets.activeContracts).toHaveLength(1);
    expect(contracted.markets.activeContracts[0]?.monthsRemaining).toBe(CONTRACT_DURATION_MIN);
    expect(gold.markets.queuedSpotSaleUnits).toBeGreaterThan(0);
    expect(gold.markets.queuedGoldBuyBars).toBeGreaterThan(0);
  });

  it('uses gold reserves before declaring bankruptcy', () => {
    let state = createInitialState();
    state = {
      ...state,
      economy: {
        ...state.economy,
        treasury: -10
      },
      resources: {
        ...state.resources,
        goldBars: 12
      }
    };

    const next = advanceTime(state, WEEK_DURATION_SECONDS * WEEKS_PER_MONTH, new SequenceRandom([0.9]));

    expect(next.run.gameOver).toBe(false);
    expect(next.resources.goldBars).toBeLessThan(state.resources.goldBars);
    expect(next.economy.currencyIndex).toBeGreaterThan(state.economy.currencyIndex);
  });

  it('unpauses when a non-zero speed is selected', () => {
    const initial = createInitialState();
    const paused = applyAction(initial, { type: 'toggle_pause' }, new SequenceRandom([0.4]));
    const resumed = applyAction(paused, { type: 'set_speed', speed: 2 }, new SequenceRandom([0.4]));

    expect(paused.time.paused).toBe(true);
    expect(resumed.time.paused).toBe(false);
    expect(resumed.time.speed).toBe(2);
  });
});
