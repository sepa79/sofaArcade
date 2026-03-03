import { describe, expect, it } from 'vitest';

import {
  MENU_ROW_CONTROLLER,
  MENU_ROW_START,
  createInitialLauncherState,
  stepLauncher
} from './model';

describe('stepLauncher', () => {
  it('moves cursor down through menu rows', () => {
    const state = createInitialLauncherState();
    const next = stepLauncher(
      state,
      {
        upPressed: false,
        downPressed: true,
        leftPressed: false,
        rightPressed: false,
        confirmPressed: false
      },
      1,
      3
    );

    expect(next.cursorIndex).toBe(MENU_ROW_CONTROLLER);
  });

  it('wraps controller selection', () => {
    const state = {
      ...createInitialLauncherState(),
      cursorIndex: MENU_ROW_CONTROLLER,
      controllerIndex: 0
    };

    const next = stepLauncher(
      state,
      {
        upPressed: false,
        downPressed: false,
        leftPressed: true,
        rightPressed: false,
        confirmPressed: false
      },
      1,
      3
    );

    expect(next.controllerIndex).toBe(2);
  });

  it('requests start on confirm from start row', () => {
    const state = {
      ...createInitialLauncherState(),
      cursorIndex: MENU_ROW_START
    };

    const next = stepLauncher(
      state,
      {
        upPressed: false,
        downPressed: false,
        leftPressed: false,
        rightPressed: false,
        confirmPressed: true
      },
      1,
      2
    );

    expect(next.startRequested).toBe(true);
  });
});
