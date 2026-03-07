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

import keyboardGamepadProfileJson from '../profiles/tunnel-invaders.keyboard-gamepad.input-profile.json';
import type { FrameInput } from './types';

const ACTION_MOVE_X = 'MOVE_X';
const ACTION_FIRE_PRIMARY = 'FIRE_PRIMARY';
const ACTION_JUMP_PHASE = 'JUMP_PHASE';
const ACTION_PAUSE_TOGGLE = 'PAUSE_TOGGLE';
const ACTION_START_OR_RESTART = 'START_OR_RESTART';

const SOURCE_KEYBOARD_MOVE_X = 'keyboard.move_x';
const SOURCE_GAMEPAD_MOVE_X = 'gamepad.move_x';
const SOURCE_KEYBOARD_FIRE = 'keyboard.fire';
const SOURCE_GAMEPAD_FIRE = 'gamepad.fire';
const SOURCE_KEYBOARD_JUMP = 'keyboard.jump';
const SOURCE_GAMEPAD_JUMP = 'gamepad.jump';
const SOURCE_KEYBOARD_PAUSE = 'keyboard.pause';
const SOURCE_GAMEPAD_PAUSE = 'gamepad.pause';
const SOURCE_KEYBOARD_START = 'keyboard.start';
const SOURCE_GAMEPAD_START = 'gamepad.start';

const ACTION_CATALOG = createActionCatalog([
  {
    id: ACTION_MOVE_X,
    type: 'axis_1d',
    space: 'relative',
    domain: 'signed'
  },
  {
    id: ACTION_FIRE_PRIMARY,
    type: 'digital'
  },
  {
    id: ACTION_JUMP_PHASE,
    type: 'digital'
  },
  {
    id: ACTION_PAUSE_TOGGLE,
    type: 'digital'
  },
  {
    id: ACTION_START_OR_RESTART,
    type: 'digital'
  }
]);

const PROFILE_BY_ID = new Map<string, InputProfile>([
  [
    'tunnel-invaders-keyboard-gamepad',
    loadInputProfile(ACTION_CATALOG, keyboardGamepadProfileJson)
  ]
]);

export interface InputKeys {
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly altLeft: Phaser.Input.Keyboard.Key;
  readonly altRight: Phaser.Input.Keyboard.Key;
  readonly fire: Phaser.Input.Keyboard.Key;
  readonly jump: Phaser.Input.Keyboard.Key;
  readonly pause: Phaser.Input.Keyboard.Key;
  readonly start: Phaser.Input.Keyboard.Key;
}

export interface InputContext {
  readonly runtime: InputRuntime;
  readonly profile: InputProfile;
  readonly keys: InputKeys;
}

function requireKeyboard(scene: Phaser.Scene): Phaser.Input.Keyboard.KeyboardPlugin {
  if (scene.input.keyboard === undefined || scene.input.keyboard === null) {
    throw new Error('Phaser keyboard plugin is required for Tunnel Invaders input.');
  }

  return scene.input.keyboard;
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

function readKeyboardAxis(keys: InputKeys): number {
  const left = keys.left.isDown || keys.altLeft.isDown;
  const right = keys.right.isDown || keys.altRight.isDown;
  return left === right ? 0 : left ? -1 : 1;
}

function readGamepadAxis(gamepad: Gamepad | null): number {
  const leftStick = gamepad?.axes[0] ?? 0;
  const axisWithDeadzone = Math.abs(leftStick) < 0.2 ? 0 : leftStick;
  const dpad = (buttonPressed(gamepad, 15) ? 1 : 0) + (buttonPressed(gamepad, 14) ? -1 : 0);
  return clampSigned(axisWithDeadzone + dpad);
}

function requireProfile(profileId: string): InputProfile {
  const profile = PROFILE_BY_ID.get(profileId);
  if (profile === undefined) {
    throw new Error(`Unknown Tunnel Invaders profile: "${profileId}".`);
  }

  return profile;
}

function profileUsesMouse(profile: InputProfile): boolean {
  return profile.bindings.some(
    (binding) =>
      binding.source.kind === 'mouse_position_x' ||
      binding.source.kind === 'mouse_position_y' ||
      binding.source.kind === 'mouse_delta_x' ||
      binding.source.kind === 'mouse_button'
  );
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
      altLeft: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      altRight: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      fire: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      jump: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      pause: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      start: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    }
  };
}

export function inputContextUsesMouseControl(inputContext: InputContext): boolean {
  return profileUsesMouse(inputContext.profile);
}

export function readFrameInput(inputContext: InputContext): FrameInput {
  const gamepad = firstConnectedGamepad();

  const sourceFrame = createInputSourceFrame({
    digital: {
      [SOURCE_KEYBOARD_FIRE]: inputContext.keys.fire.isDown,
      [SOURCE_GAMEPAD_FIRE]: buttonPressed(gamepad, 0),
      [SOURCE_KEYBOARD_JUMP]: inputContext.keys.jump.isDown,
      [SOURCE_GAMEPAD_JUMP]: buttonPressed(gamepad, 1),
      [SOURCE_KEYBOARD_PAUSE]: inputContext.keys.pause.isDown,
      [SOURCE_GAMEPAD_PAUSE]: buttonPressed(gamepad, 8),
      [SOURCE_KEYBOARD_START]: inputContext.keys.start.isDown,
      [SOURCE_GAMEPAD_START]: buttonPressed(gamepad, 9)
    },
    axis: {
      [SOURCE_KEYBOARD_MOVE_X]: readKeyboardAxis(inputContext.keys),
      [SOURCE_GAMEPAD_MOVE_X]: readGamepadAxis(gamepad)
    }
  });

  applyInputProfile(inputContext.runtime, inputContext.profile, sourceFrame);

  return {
    moveXSigned: inputContext.runtime.readAxisSigned(ACTION_MOVE_X),
    fireHeld: inputContext.runtime.isPressed(ACTION_FIRE_PRIMARY),
    jumpPressed: inputContext.runtime.wasPressed(ACTION_JUMP_PHASE),
    pausePressed: inputContext.runtime.wasPressed(ACTION_PAUSE_TOGGLE),
    startPressed: inputContext.runtime.wasPressed(ACTION_START_OR_RESTART)
  };
}
