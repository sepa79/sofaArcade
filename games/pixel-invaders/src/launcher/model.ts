export interface LauncherInput {
  readonly upPressed: boolean;
  readonly downPressed: boolean;
  readonly leftPressed: boolean;
  readonly rightPressed: boolean;
  readonly confirmPressed: boolean;
}

export interface LauncherState {
  readonly cursorIndex: number;
  readonly gameIndex: number;
  readonly controllerIndex: number;
  readonly audioMixProfileIndex: number;
  readonly sfxLoopEnabled: boolean;
  readonly startRequested: boolean;
}

export const MENU_ROW_GAME = 0;
export const MENU_ROW_CONTROLLER = 1;
export const MENU_ROW_START = 2;

const MENU_ROW_COUNT = 3;

function wrapIndex(value: number, size: number): number {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error(`size must be a positive integer, got ${size}.`);
  }

  const remainder = value % size;
  return remainder < 0 ? remainder + size : remainder;
}

function withCursor(state: LauncherState, delta: number): LauncherState {
  return {
    ...state,
    cursorIndex: wrapIndex(state.cursorIndex + delta, MENU_ROW_COUNT)
  };
}

function withGame(state: LauncherState, delta: number, gameCount: number): LauncherState {
  return {
    ...state,
    gameIndex: wrapIndex(state.gameIndex + delta, gameCount)
  };
}

function withController(
  state: LauncherState,
  delta: number,
  controllerCount: number
): LauncherState {
  return {
    ...state,
    controllerIndex: wrapIndex(state.controllerIndex + delta, controllerCount)
  };
}

export function createInitialLauncherState(): LauncherState {
  return {
    cursorIndex: MENU_ROW_GAME,
    gameIndex: 0,
    controllerIndex: 0,
    audioMixProfileIndex: 0,
    sfxLoopEnabled: false,
    startRequested: false
  };
}

export function stepLauncher(
  state: LauncherState,
  input: LauncherInput,
  gameCount: number,
  controllerCount: number
): LauncherState {
  if (!Number.isInteger(gameCount) || gameCount <= 0) {
    throw new Error(`gameCount must be a positive integer, got ${gameCount}.`);
  }

  if (!Number.isInteger(controllerCount) || controllerCount <= 0) {
    throw new Error(`controllerCount must be a positive integer, got ${controllerCount}.`);
  }

  let next = {
    ...state,
    startRequested: false
  };

  if (input.upPressed && !input.downPressed) {
    next = withCursor(next, -1);
  } else if (input.downPressed && !input.upPressed) {
    next = withCursor(next, 1);
  }

  if (input.leftPressed && !input.rightPressed) {
    if (next.cursorIndex === MENU_ROW_GAME) {
      next = withGame(next, -1, gameCount);
    } else if (next.cursorIndex === MENU_ROW_CONTROLLER) {
      next = withController(next, -1, controllerCount);
    }
  } else if (input.rightPressed && !input.leftPressed) {
    if (next.cursorIndex === MENU_ROW_GAME) {
      next = withGame(next, 1, gameCount);
    } else if (next.cursorIndex === MENU_ROW_CONTROLLER) {
      next = withController(next, 1, controllerCount);
    }
  }

  if (input.confirmPressed && next.cursorIndex === MENU_ROW_START) {
    next = {
      ...next,
      startRequested: true
    };
  }

  return next;
}
