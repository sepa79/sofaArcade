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

import hybridProfileJson from '../profiles/pixel-invaders.hybrid.input-profile.json';
import keyboardGamepadProfileJson from '../profiles/pixel-invaders.keyboard-gamepad.input-profile.json';
import mousePaddleProfileJson from '../profiles/pixel-invaders.mouse-paddle.input-profile.json';
import type { FrameInput } from './types';

const ACTION_MOVE_X_RELATIVE = 'MOVE_X_RELATIVE';
const ACTION_MOVE_X_ABSOLUTE = 'MOVE_X_ABSOLUTE';
const ACTION_MOVE_X_ABSOLUTE_ACTIVE = 'MOVE_X_ABSOLUTE_ACTIVE';
const ACTION_FIRE_PRIMARY = 'FIRE_PRIMARY';
const ACTION_RESTART = 'RESTART';

const SOURCE_KEYBOARD_MOVE_X = 'keyboard.move_x';
const SOURCE_GAMEPAD_MOVE_X = 'gamepad.move_x';
const SOURCE_POINTER_X_BYTE = 'pointer.x.byte';
const SOURCE_POINTER_PRIMARY_DOWN = 'pointer.primary_down';
const SOURCE_POINTER_FIRE = 'pointer.fire';
const SOURCE_KEYBOARD_FIRE = 'keyboard.fire';
const SOURCE_GAMEPAD_FIRE = 'gamepad.fire';
const SOURCE_KEYBOARD_RESTART = 'keyboard.restart';
const SOURCE_GAMEPAD_RESTART = 'gamepad.restart';

const GAME_ACTION_CATALOG = createActionCatalog([
  {
    id: ACTION_MOVE_X_RELATIVE,
    type: 'axis_1d',
    space: 'relative',
    domain: 'signed'
  },
  {
    id: ACTION_MOVE_X_ABSOLUTE,
    type: 'axis_1d',
    space: 'absolute',
    domain: 'byte'
  },
  {
    id: ACTION_MOVE_X_ABSOLUTE_ACTIVE,
    type: 'digital'
  },
  {
    id: ACTION_FIRE_PRIMARY,
    type: 'digital'
  },
  {
    id: ACTION_RESTART,
    type: 'digital'
  }
]);

const GAME_INPUT_PROFILES = [
  loadInputProfile(GAME_ACTION_CATALOG, keyboardGamepadProfileJson),
  loadInputProfile(GAME_ACTION_CATALOG, mousePaddleProfileJson),
  loadInputProfile(GAME_ACTION_CATALOG, hybridProfileJson)
] as const;

const GAME_INPUT_PROFILE_BY_ID = new Map<string, InputProfile>(
  GAME_INPUT_PROFILES.map((profile) => [profile.id, profile])
);

export interface InputKeys {
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly altLeft: Phaser.Input.Keyboard.Key;
  readonly altRight: Phaser.Input.Keyboard.Key;
  readonly fire: Phaser.Input.Keyboard.Key;
  readonly restart: Phaser.Input.Keyboard.Key;
}

export interface InputContext {
  readonly runtime: InputRuntime;
  readonly profile: InputProfile;
  readonly keys: InputKeys;
}

export interface PointerRange {
  readonly minX: number;
  readonly maxX: number;
}

function requireKeyboard(scene: Phaser.Scene): Phaser.Input.Keyboard.KeyboardPlugin {
  if (scene.input.keyboard === undefined || scene.input.keyboard === null) {
    throw new Error('Phaser keyboard plugin is required for Pixel Invaders input.');
  }

  return scene.input.keyboard;
}

function requireProfile(profileId: string): InputProfile {
  const profile = GAME_INPUT_PROFILE_BY_ID.get(profileId);
  if (profile === undefined) {
    throw new Error(`Unknown Pixel Invaders input profile id: "${profileId}".`);
  }

  return profile;
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function toByteRange(value: number, min: number, max: number): number {
  if (max <= min) {
    throw new Error(`Invalid byte conversion range: min=${min}, max=${max}.`);
  }

  const clamped = Math.max(min, Math.min(max, value));
  const unit = (clamped - min) / (max - min);
  return Math.round(unit * 255);
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
  const keyboardLeft = keys.left.isDown || keys.altLeft.isDown;
  const keyboardRight = keys.right.isDown || keys.altRight.isDown;

  return keyboardLeft === keyboardRight ? 0 : keyboardLeft ? -1 : 1;
}

function readGamepadAxis(gamepad: Gamepad | null): number {
  const gamepadAxis = gamepad?.axes[0] ?? 0;
  const gamepadWithDeadzone = Math.abs(gamepadAxis) < 0.2 ? 0 : gamepadAxis;
  const dpadAxis = (buttonPressed(gamepad, 15) ? 1 : 0) + (buttonPressed(gamepad, 14) ? -1 : 0);
  return clampSigned(gamepadWithDeadzone + dpadAxis);
}

export function createInputContext(scene: Phaser.Scene, profileId: string): InputContext {
  const keyboard = requireKeyboard(scene);

  return {
    runtime: createInputRuntime(GAME_ACTION_CATALOG),
    profile: requireProfile(profileId),
    keys: {
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      altLeft: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      altRight: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      fire: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      restart: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    }
  };
}

export function readFrameInput(
  scene: Phaser.Scene,
  inputContext: InputContext,
  pointerRange?: PointerRange
): FrameInput {
  const pointer = scene.input.activePointer;
  const gamepad = firstConnectedGamepad();
  const pointerMinX = pointerRange?.minX ?? 0;
  const pointerMaxX = pointerRange?.maxX ?? scene.scale.width;

  const sourceFrame = createInputSourceFrame({
    digital: {
      [SOURCE_POINTER_PRIMARY_DOWN]: pointer.isDown,
      [SOURCE_POINTER_FIRE]: pointer.isDown,
      [SOURCE_KEYBOARD_FIRE]: inputContext.keys.fire.isDown,
      [SOURCE_GAMEPAD_FIRE]: buttonPressed(gamepad, 0),
      [SOURCE_KEYBOARD_RESTART]: inputContext.keys.restart.isDown,
      [SOURCE_GAMEPAD_RESTART]: buttonPressed(gamepad, 9)
    },
    axis: {
      [SOURCE_KEYBOARD_MOVE_X]: readKeyboardAxis(inputContext.keys),
      [SOURCE_GAMEPAD_MOVE_X]: readGamepadAxis(gamepad),
      [SOURCE_POINTER_X_BYTE]: toByteRange(pointer.x, pointerMinX, pointerMaxX)
    }
  });

  applyInputProfile(inputContext.runtime, inputContext.profile, sourceFrame);

  return {
    moveAxisSigned: inputContext.runtime.readAxisSigned(ACTION_MOVE_X_RELATIVE),
    moveAbsoluteUnit: inputContext.runtime.isPressed(ACTION_MOVE_X_ABSOLUTE_ACTIVE)
      ? inputContext.runtime.readAxisUnit(ACTION_MOVE_X_ABSOLUTE)
      : null,
    firePressed: inputContext.runtime.isPressed(ACTION_FIRE_PRIMARY),
    restartPressed: inputContext.runtime.wasPressed(ACTION_RESTART)
  };
}
