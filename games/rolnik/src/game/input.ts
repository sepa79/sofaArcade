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

import keyboardOnlyProfileJson from '../profiles/rolnik.keyboard-only.input-profile.json';
import sharedKeyboardGamepadProfileJson from '../profiles/rolnik.shared-keyboard-gamepad.input-profile.json';
import type { FrameInput } from './types';

const ACTION_MENU_LEFT = 'MENU_LEFT';
const ACTION_MENU_RIGHT = 'MENU_RIGHT';
const ACTION_SUBMENU_UP = 'SUBMENU_UP';
const ACTION_SUBMENU_DOWN = 'SUBMENU_DOWN';
const ACTION_SELECT = 'SELECT';
const ACTION_BACK = 'BACK';
const ACTION_END_TURN = 'END_TURN';

const SOURCE_KEYBOARD_MENU_LEFT = 'keyboard.menu_left';
const SOURCE_KEYBOARD_MENU_LEFT_ALT = 'keyboard.menu_left_alt';
const SOURCE_GAMEPAD_MENU_LEFT = 'gamepad.menu_left';
const SOURCE_KEYBOARD_MENU_RIGHT = 'keyboard.menu_right';
const SOURCE_KEYBOARD_MENU_RIGHT_ALT = 'keyboard.menu_right_alt';
const SOURCE_GAMEPAD_MENU_RIGHT = 'gamepad.menu_right';
const SOURCE_KEYBOARD_SUBMENU_UP = 'keyboard.submenu_up';
const SOURCE_KEYBOARD_SUBMENU_UP_ALT = 'keyboard.submenu_up_alt';
const SOURCE_GAMEPAD_SUBMENU_UP = 'gamepad.submenu_up';
const SOURCE_KEYBOARD_SUBMENU_DOWN = 'keyboard.submenu_down';
const SOURCE_KEYBOARD_SUBMENU_DOWN_ALT = 'keyboard.submenu_down_alt';
const SOURCE_GAMEPAD_SUBMENU_DOWN = 'gamepad.submenu_down';
const SOURCE_KEYBOARD_SELECT = 'keyboard.select';
const SOURCE_GAMEPAD_SELECT = 'gamepad.select';
const SOURCE_KEYBOARD_BACK = 'keyboard.back';
const SOURCE_KEYBOARD_BACK_ALT = 'keyboard.back_alt';
const SOURCE_GAMEPAD_BACK = 'gamepad.back';
const SOURCE_KEYBOARD_END_TURN = 'keyboard.end_turn';
const SOURCE_GAMEPAD_END_TURN = 'gamepad.end_turn';

const ACTION_CATALOG = createActionCatalog([
  { id: ACTION_MENU_LEFT, type: 'digital' },
  { id: ACTION_MENU_RIGHT, type: 'digital' },
  { id: ACTION_SUBMENU_UP, type: 'digital' },
  { id: ACTION_SUBMENU_DOWN, type: 'digital' },
  { id: ACTION_SELECT, type: 'digital' },
  { id: ACTION_BACK, type: 'digital' },
  { id: ACTION_END_TURN, type: 'digital' }
]);

const PROFILE_BY_ID = new Map<string, InputProfile>([
  [
    'rolnik-shared-keyboard-gamepad',
    loadInputProfile(ACTION_CATALOG, sharedKeyboardGamepadProfileJson)
  ],
  ['rolnik-keyboard-only', loadInputProfile(ACTION_CATALOG, keyboardOnlyProfileJson)]
]);

interface InputKeys {
  readonly menuLeft: Phaser.Input.Keyboard.Key;
  readonly menuLeftAlt: Phaser.Input.Keyboard.Key;
  readonly menuRight: Phaser.Input.Keyboard.Key;
  readonly menuRightAlt: Phaser.Input.Keyboard.Key;
  readonly submenuUp: Phaser.Input.Keyboard.Key;
  readonly submenuUpAlt: Phaser.Input.Keyboard.Key;
  readonly submenuDown: Phaser.Input.Keyboard.Key;
  readonly submenuDownAlt: Phaser.Input.Keyboard.Key;
  readonly select: Phaser.Input.Keyboard.Key;
  readonly back: Phaser.Input.Keyboard.Key;
  readonly backAlt: Phaser.Input.Keyboard.Key;
  readonly endTurn: Phaser.Input.Keyboard.Key;
}

export interface InputContext {
  readonly runtime: InputRuntime;
  readonly profile: InputProfile;
  readonly keys: InputKeys;
}

function requireKeyboard(scene: Phaser.Scene): Phaser.Input.Keyboard.KeyboardPlugin {
  if (scene.input.keyboard === undefined || scene.input.keyboard === null) {
    throw new Error('Phaser keyboard plugin is required for Rolnik input.');
  }

  return scene.input.keyboard;
}

function requireProfile(profileId: string): InputProfile {
  const profile = PROFILE_BY_ID.get(profileId);
  if (profile === undefined) {
    throw new Error(`Unknown Rolnik profile "${profileId}".`);
  }

  return profile;
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
export function createInputContext(scene: Phaser.Scene, profileId: string): InputContext {
  const keyboard = requireKeyboard(scene);
  return {
    runtime: createInputRuntime(ACTION_CATALOG),
    profile: requireProfile(profileId),
    keys: {
      menuLeft: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      menuLeftAlt: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      menuRight: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      menuRightAlt: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      submenuUp: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      submenuUpAlt: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      submenuDown: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      submenuDownAlt: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      select: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      back: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      backAlt: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE),
      endTurn: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    }
  };
}

export function readFrameInput(inputContext: InputContext): FrameInput {
  const gamepad = firstConnectedGamepad();
  const sourceFrame = createInputSourceFrame({
    digital: {
      [SOURCE_KEYBOARD_MENU_LEFT]: inputContext.keys.menuLeft.isDown,
      [SOURCE_KEYBOARD_MENU_LEFT_ALT]: inputContext.keys.menuLeftAlt.isDown,
      [SOURCE_GAMEPAD_MENU_LEFT]: buttonPressed(gamepad, 14),
      [SOURCE_KEYBOARD_MENU_RIGHT]: inputContext.keys.menuRight.isDown,
      [SOURCE_KEYBOARD_MENU_RIGHT_ALT]: inputContext.keys.menuRightAlt.isDown,
      [SOURCE_GAMEPAD_MENU_RIGHT]: buttonPressed(gamepad, 15),
      [SOURCE_KEYBOARD_SUBMENU_UP]: inputContext.keys.submenuUp.isDown,
      [SOURCE_KEYBOARD_SUBMENU_UP_ALT]: inputContext.keys.submenuUpAlt.isDown,
      [SOURCE_GAMEPAD_SUBMENU_UP]: buttonPressed(gamepad, 12),
      [SOURCE_KEYBOARD_SUBMENU_DOWN]: inputContext.keys.submenuDown.isDown,
      [SOURCE_KEYBOARD_SUBMENU_DOWN_ALT]: inputContext.keys.submenuDownAlt.isDown,
      [SOURCE_GAMEPAD_SUBMENU_DOWN]: buttonPressed(gamepad, 13),
      [SOURCE_KEYBOARD_SELECT]: inputContext.keys.select.isDown,
      [SOURCE_GAMEPAD_SELECT]: buttonPressed(gamepad, 0),
      [SOURCE_KEYBOARD_BACK]: inputContext.keys.back.isDown,
      [SOURCE_KEYBOARD_BACK_ALT]: inputContext.keys.backAlt.isDown,
      [SOURCE_GAMEPAD_BACK]: buttonPressed(gamepad, 1),
      [SOURCE_KEYBOARD_END_TURN]: inputContext.keys.endTurn.isDown,
      [SOURCE_GAMEPAD_END_TURN]: buttonPressed(gamepad, 9)
    },
    axis: {}
  });

  applyInputProfile(inputContext.runtime, inputContext.profile, sourceFrame);

  return {
    menuLeftPressed: inputContext.runtime.wasPressed(ACTION_MENU_LEFT),
    menuRightPressed: inputContext.runtime.wasPressed(ACTION_MENU_RIGHT),
    submenuUpPressed: inputContext.runtime.wasPressed(ACTION_SUBMENU_UP),
    submenuDownPressed: inputContext.runtime.wasPressed(ACTION_SUBMENU_DOWN),
    selectPressed: inputContext.runtime.wasPressed(ACTION_SELECT),
    backPressed: inputContext.runtime.wasPressed(ACTION_BACK),
    endTurnPressed: inputContext.runtime.wasPressed(ACTION_END_TURN)
  };
}
