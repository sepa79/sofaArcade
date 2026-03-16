import Phaser from 'phaser';
import {
  applyInputProfile,
  createActionCatalog,
  createInputRuntime,
  createInputSourceFrame,
  loadInputProfile,
  type InputProfile,
  type InputRuntime
} from '@light80/core';

import sharedProfileJson from '../profiles/artillery-duel.shared-keyboard-gamepad.input-profile.json';
import type { FrameInput } from './types';

const ACTION_AIM_X = 'AIM_X';
const ACTION_POWER_Y = 'POWER_Y';
const ACTION_FIRE = 'FIRE';
const ACTION_START = 'START';

const SOURCE_KEYBOARD_AIM_X = 'keyboard.aim_x';
const SOURCE_GAMEPAD_AIM_X = 'gamepad.aim_x';
const SOURCE_KEYBOARD_POWER_Y = 'keyboard.power_y';
const SOURCE_GAMEPAD_POWER_Y = 'gamepad.power_y';
const SOURCE_KEYBOARD_FIRE = 'keyboard.fire';
const SOURCE_GAMEPAD_FIRE = 'gamepad.fire';
const SOURCE_KEYBOARD_START = 'keyboard.start';
const SOURCE_GAMEPAD_START = 'gamepad.start';

const ACTION_CATALOG = createActionCatalog([
  {
    id: ACTION_AIM_X,
    type: 'axis_1d',
    space: 'relative',
    domain: 'signed'
  },
  {
    id: ACTION_POWER_Y,
    type: 'axis_1d',
    space: 'relative',
    domain: 'signed'
  },
  {
    id: ACTION_FIRE,
    type: 'digital'
  },
  {
    id: ACTION_START,
    type: 'digital'
  }
]);

const PROFILE_BY_ID = new Map<string, InputProfile>([
  ['artillery-duel-shared-keyboard-gamepad', loadInputProfile(ACTION_CATALOG, sharedProfileJson)]
]);

interface InputKeys {
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly up: Phaser.Input.Keyboard.Key;
  readonly down: Phaser.Input.Keyboard.Key;
  readonly altLeft: Phaser.Input.Keyboard.Key;
  readonly altRight: Phaser.Input.Keyboard.Key;
  readonly altUp: Phaser.Input.Keyboard.Key;
  readonly altDown: Phaser.Input.Keyboard.Key;
  readonly fire: Phaser.Input.Keyboard.Key;
  readonly start: Phaser.Input.Keyboard.Key;
}

export interface InputContext {
  readonly runtime: InputRuntime;
  readonly profile: InputProfile;
  readonly keys: InputKeys;
}

function requireKeyboard(scene: Phaser.Scene): Phaser.Input.Keyboard.KeyboardPlugin {
  if (scene.input.keyboard === undefined || scene.input.keyboard === null) {
    throw new Error('Phaser keyboard plugin is required for Artillery Duel input.');
  }

  return scene.input.keyboard;
}

function requireProfile(profileId: string): InputProfile {
  const profile = PROFILE_BY_ID.get(profileId);
  if (profile === undefined) {
    throw new Error(`Unknown Artillery Duel profile: "${profileId}".`);
  }

  return profile;
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function buttonPressed(gamepad: Gamepad | null, index: number): boolean {
  if (gamepad === null || gamepad.buttons[index] === undefined) {
    return false;
  }

  return gamepad.buttons[index].pressed;
}

function firstConnectedGamepad(): Gamepad | null {
  const gamepads = navigator.getGamepads();
  for (const gamepad of gamepads) {
    if (gamepad !== null && gamepad.connected) {
      return gamepad;
    }
  }

  return null;
}

function keyboardAxis(negative: boolean, positive: boolean): number {
  return negative === positive ? 0 : negative ? -1 : 1;
}

export function createInputContext(scene: Phaser.Scene, profileId: string): InputContext {
  const keyboard = requireKeyboard(scene);
  const profile = requireProfile(profileId);

  return {
    runtime: createInputRuntime(ACTION_CATALOG),
    profile,
    keys: {
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      altLeft: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      altRight: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      altUp: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      altDown: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      fire: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      start: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    }
  };
}

export function readFrameInput(inputContext: InputContext): FrameInput {
  const gamepad = firstConnectedGamepad();
  const sourceFrame = createInputSourceFrame({
    digital: {
      [SOURCE_KEYBOARD_FIRE]: inputContext.keys.fire.isDown,
      [SOURCE_GAMEPAD_FIRE]: buttonPressed(gamepad, 0),
      [SOURCE_KEYBOARD_START]: inputContext.keys.start.isDown,
      [SOURCE_GAMEPAD_START]: buttonPressed(gamepad, 9)
    },
    axis: {
      [SOURCE_KEYBOARD_AIM_X]: keyboardAxis(
        inputContext.keys.left.isDown || inputContext.keys.altLeft.isDown,
        inputContext.keys.right.isDown || inputContext.keys.altRight.isDown
      ),
      [SOURCE_GAMEPAD_AIM_X]: clampSigned((gamepad?.axes[0] ?? 0) + (buttonPressed(gamepad, 15) ? 1 : 0) - (buttonPressed(gamepad, 14) ? 1 : 0)),
      [SOURCE_KEYBOARD_POWER_Y]: keyboardAxis(
        inputContext.keys.down.isDown || inputContext.keys.altDown.isDown,
        inputContext.keys.up.isDown || inputContext.keys.altUp.isDown
      ),
      [SOURCE_GAMEPAD_POWER_Y]: clampSigned(-1 * (gamepad?.axes[1] ?? 0) + (buttonPressed(gamepad, 12) ? 1 : 0) - (buttonPressed(gamepad, 13) ? 1 : 0))
    }
  });

  applyInputProfile(inputContext.runtime, inputContext.profile, sourceFrame);

  return {
    aimXSigned: inputContext.runtime.readAxisSigned(ACTION_AIM_X),
    powerYSigned: inputContext.runtime.readAxisSigned(ACTION_POWER_Y),
    firePressed: inputContext.runtime.wasPressed(ACTION_FIRE),
    startPressed: inputContext.runtime.wasPressed(ACTION_START)
  };
}
