import { describe, expect, it } from 'vitest';

import { stepArtilleryLaunchMenu } from './launch-menu';

describe('Artillery Duel launch menu', () => {
  it('selects with an axis edge and confirms from keyboard or gamepad input', () => {
    const moved = stepArtilleryLaunchMenu({
      selectedOptionIndex: 0,
      verticalAxisHeld: false
    }, {
      confirmPressed: false,
      verticalAxis: -1
    }, 2);
    expect(moved.state.selectedOptionIndex).toBe(1);

    const confirmed = stepArtilleryLaunchMenu(moved.state, {
      confirmPressed: true,
      verticalAxis: 0
    }, 2);
    expect(confirmed.launchOptionIndex).toBe(1);
  });

  it('does not repeat while the navigation axis remains held', () => {
    const step = stepArtilleryLaunchMenu({
      selectedOptionIndex: 1,
      verticalAxisHeld: true
    }, {
      confirmPressed: false,
      verticalAxis: -1
    }, 2);
    expect(step.state.selectedOptionIndex).toBe(1);
  });
});
