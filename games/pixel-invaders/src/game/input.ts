import Phaser from 'phaser';
import {
  applyInputProfile,
  createActionCatalog,
  createMatchInput,
  createInputRuntime,
  createInputSourceFrame,
  loadInputProfile,
  type LocalInputBinding,
  type LocalInputDevice,
  type PhoneLinkInputBinding,
  type InputSlotBinding,
  type InputProfile,
  type InputRuntime,
  type MatchInput
} from '@light80/core';

import keyboardOnlyProfileJson from '../profiles/pixel-invaders.keyboard-only.input-profile.json';
import keyboardGamepadProfileJson from '../profiles/pixel-invaders.keyboard-gamepad.input-profile.json';
import mousePaddleProfileJson from '../profiles/pixel-invaders.mouse-paddle.input-profile.json';
import type { MultiplayerGameLaunchPlayerSlot } from '../launch-contract';
import { nextPhoneControllerFrame } from '../phone/host-link';
import type { FrameInput, PlayerLane } from './types';

const ACTION_MOVE_X_RELATIVE = 'MOVE_X_RELATIVE';
const ACTION_MOVE_X_ABSOLUTE = 'MOVE_X_ABSOLUTE';
const ACTION_MOVE_LANE_SELECT = 'MOVE_LANE_SELECT';
const ACTION_MOVE_LANE_UP = 'MOVE_LANE_UP';
const ACTION_MOVE_LANE_DOWN = 'MOVE_LANE_DOWN';
const ACTION_FIRE_PRIMARY = 'FIRE_PRIMARY';
const ACTION_RESTART = 'RESTART';

const SOURCE_KEYBOARD_MOVE_X = 'keyboard.move_x';
const SOURCE_GAMEPAD_MOVE_X = 'gamepad.move_x';
const SOURCE_POINTER_X_BYTE = 'pointer.x.byte';
const SOURCE_POINTER_Y_BYTE = 'pointer.y.byte';
const SOURCE_POINTER_FIRE = 'pointer.fire';
const SOURCE_KEYBOARD_FIRE = 'keyboard.fire';
const SOURCE_GAMEPAD_FIRE = 'gamepad.fire';
const SOURCE_KEYBOARD_LANE_UP = 'keyboard.lane_up';
const SOURCE_KEYBOARD_LANE_DOWN = 'keyboard.lane_down';
const SOURCE_GAMEPAD_LANE_UP = 'gamepad.lane_up';
const SOURCE_GAMEPAD_LANE_DOWN = 'gamepad.lane_down';
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
    id: ACTION_MOVE_LANE_SELECT,
    type: 'axis_1d',
    space: 'absolute',
    domain: 'byte'
  },
  {
    id: ACTION_MOVE_LANE_UP,
    type: 'digital'
  },
  {
    id: ACTION_MOVE_LANE_DOWN,
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
  loadInputProfile(GAME_ACTION_CATALOG, keyboardOnlyProfileJson),
  loadInputProfile(GAME_ACTION_CATALOG, keyboardGamepadProfileJson),
  loadInputProfile(GAME_ACTION_CATALOG, mousePaddleProfileJson)
] as const;

const GAME_INPUT_PROFILE_BY_ID = new Map<string, InputProfile>(
  GAME_INPUT_PROFILES.map((profile) => [profile.id, profile])
);

export interface InputKeys {
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly altLeft: Phaser.Input.Keyboard.Key;
  readonly altRight: Phaser.Input.Keyboard.Key;
  readonly up: Phaser.Input.Keyboard.Key;
  readonly down: Phaser.Input.Keyboard.Key;
  readonly altUp: Phaser.Input.Keyboard.Key;
  readonly altDown: Phaser.Input.Keyboard.Key;
  readonly fire: Phaser.Input.Keyboard.Key;
  readonly restart: Phaser.Input.Keyboard.Key;
}

export interface InputContext {
  readonly keys: InputKeys;
  readonly playerSlots: ReadonlyArray<PlayerInputContext>;
}

export interface PointerRange {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface LocalPlayerInputContext {
  readonly slotId: string;
  readonly playerIndex: number;
  readonly controllerLabel: string;
  readonly binding: LocalInputBinding;
  readonly runtime: InputRuntime;
  readonly profile: InputProfile;
}

export interface PhonePlayerInputContext {
  readonly slotId: string;
  readonly playerIndex: number;
  readonly controllerLabel: string;
  readonly binding: PhoneLinkInputBinding;
}

export type PlayerInputContext = LocalPlayerInputContext | PhonePlayerInputContext;

function isPhonePlayerInputContext(playerInputContext: PlayerInputContext): playerInputContext is PhonePlayerInputContext {
  return playerInputContext.binding.transport === 'phone_link';
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

function profileHasBinding(profile: InputProfile, actionId: string): boolean {
  return profile.bindings.some((binding) => binding.actionId === actionId);
}

function localDeviceUsesMouse(device: LocalInputDevice): boolean {
  return device.kind === 'mouse' || device.kind === 'shared_local';
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

function connectedGamepad(gamepadIndex: number): Gamepad | null {
  const gamepad = navigator.getGamepads()[gamepadIndex] ?? null;
  if (gamepad === null || !gamepad.connected) {
    return null;
  }

  return gamepad;
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

function readPhoneFrameInput(phoneControllerId: string): FrameInput {
  const frame = nextPhoneControllerFrame(phoneControllerId);
  return {
    moveAxisSigned: frame.connected ? frame.moveX : 0,
    moveAbsoluteUnit: null,
    moveLaneTarget: null,
    moveLaneUpPressed: false,
    moveLaneDownPressed: false,
    firePressed: frame.fire,
    restartPressed: frame.start
  };
}

function pointerByteToLane(pointerYByte: number): PlayerLane {
  if (!Number.isFinite(pointerYByte) || pointerYByte < 0 || pointerYByte > 255) {
    throw new Error(`pointerYByte must be in [0, 255], got ${pointerYByte}.`);
  }

  if (pointerYByte < 85) {
    return 'high';
  }
  if (pointerYByte < 170) {
    return 'mid';
  }

  return 'low';
}

function createLocalSourceFrame(
  scene: Phaser.Scene,
  keys: InputKeys,
  binding: InputSlotBinding,
  pointerRange?: PointerRange
) {
  if (binding.transport !== 'local') {
    throw new Error(`Expected local input binding, got "${binding.transport}".`);
  }

  const pointer = scene.input.activePointer;
  const pointerMinX = pointerRange?.minX ?? 0;
  const pointerMaxX = pointerRange?.maxX ?? scene.scale.width;
  const pointerMinY = pointerRange?.minY ?? 0;
  const pointerMaxY = pointerRange?.maxY ?? scene.scale.height;

  let keyboardAxis = 0;
  let keyboardFire = false;
  let keyboardLaneUp = false;
  let keyboardLaneDown = false;
  let keyboardRestart = false;
  let pointerFire = false;
  const pointerXByte = toByteRange(pointer.x, pointerMinX, pointerMaxX);
  const pointerYByte = toByteRange(pointer.y, pointerMinY, pointerMaxY);
  let gamepad: Gamepad | null = null;

  if (binding.device.kind === 'shared_local') {
    keyboardAxis = readKeyboardAxis(keys);
    keyboardFire = keys.fire.isDown;
    keyboardLaneUp = keys.up.isDown || keys.altUp.isDown;
    keyboardLaneDown = keys.down.isDown || keys.altDown.isDown;
    keyboardRestart = keys.restart.isDown;
    pointerFire = pointer.isDown;
    gamepad = firstConnectedGamepad();
  } else if (binding.device.kind === 'keyboard') {
    keyboardAxis = readKeyboardAxis(keys);
    keyboardFire = keys.fire.isDown;
    keyboardLaneUp = keys.up.isDown || keys.altUp.isDown;
    keyboardLaneDown = keys.down.isDown || keys.altDown.isDown;
    keyboardRestart = keys.restart.isDown;
  } else if (binding.device.kind === 'mouse') {
    pointerFire = pointer.isDown;
  } else if (binding.device.kind === 'gamepad') {
    gamepad = connectedGamepad(binding.device.gamepadIndex);
  } else {
    throw new Error('Pixel Invaders does not implement HID input bindings.');
  }

  return createInputSourceFrame({
    digital: {
      [SOURCE_POINTER_FIRE]: pointerFire,
      [SOURCE_KEYBOARD_FIRE]: keyboardFire,
      [SOURCE_GAMEPAD_FIRE]: buttonPressed(gamepad, 0),
      [SOURCE_KEYBOARD_LANE_UP]: keyboardLaneUp,
      [SOURCE_KEYBOARD_LANE_DOWN]: keyboardLaneDown,
      [SOURCE_GAMEPAD_LANE_UP]: buttonPressed(gamepad, 12) || (gamepad?.axes[1] ?? 0) < -0.55,
      [SOURCE_GAMEPAD_LANE_DOWN]: buttonPressed(gamepad, 13) || (gamepad?.axes[1] ?? 0) > 0.55,
      [SOURCE_KEYBOARD_RESTART]: keyboardRestart,
      [SOURCE_GAMEPAD_RESTART]: buttonPressed(gamepad, 9)
    },
    axis: {
      [SOURCE_KEYBOARD_MOVE_X]: keyboardAxis,
      [SOURCE_GAMEPAD_MOVE_X]: readGamepadAxis(gamepad),
      [SOURCE_POINTER_X_BYTE]: pointerXByte,
      [SOURCE_POINTER_Y_BYTE]: pointerYByte
    }
  });
}

function readPlayerFrameInput(
  scene: Phaser.Scene,
  inputContext: InputContext,
  playerInputContext: PlayerInputContext,
  pointerRange?: PointerRange
): FrameInput {
  if (isPhonePlayerInputContext(playerInputContext)) {
    return readPhoneFrameInput(playerInputContext.binding.phoneControllerId);
  }

  const localPlayerInputContext: LocalPlayerInputContext = playerInputContext;
  const sourceFrame = createLocalSourceFrame(
    scene,
    inputContext.keys,
    localPlayerInputContext.binding,
    pointerRange
  );
  applyInputProfile(localPlayerInputContext.runtime, localPlayerInputContext.profile, sourceFrame);
  const absoluteMoveBound = profileHasBinding(localPlayerInputContext.profile, ACTION_MOVE_X_ABSOLUTE);
  const laneSelectBound = profileHasBinding(localPlayerInputContext.profile, ACTION_MOVE_LANE_SELECT);
  const laneTarget = laneSelectBound
    ? pointerByteToLane(localPlayerInputContext.runtime.readAxisRaw(ACTION_MOVE_LANE_SELECT))
    : null;

  return {
    moveAxisSigned: localPlayerInputContext.runtime.readAxisSigned(ACTION_MOVE_X_RELATIVE),
    moveAbsoluteUnit: absoluteMoveBound
      ? localPlayerInputContext.runtime.readAxisUnit(ACTION_MOVE_X_ABSOLUTE)
      : null,
    moveLaneTarget: laneTarget,
    moveLaneUpPressed: localPlayerInputContext.runtime.wasPressed(ACTION_MOVE_LANE_UP),
    moveLaneDownPressed: localPlayerInputContext.runtime.wasPressed(ACTION_MOVE_LANE_DOWN),
    firePressed: localPlayerInputContext.runtime.isPressed(ACTION_FIRE_PRIMARY),
    restartPressed: localPlayerInputContext.runtime.wasPressed(ACTION_RESTART)
  };
}

export function inputContextUsesMouseControl(inputContext: InputContext): boolean {
  return inputContext.playerSlots.some(
    (playerSlot) =>
      !isPhonePlayerInputContext(playerSlot) && localDeviceUsesMouse(playerSlot.binding.device)
  );
}

export function describeInputContext(inputContext: InputContext): string {
  return inputContext.playerSlots.map((playerSlot) => playerSlot.controllerLabel).join(' + ');
}

export function createInputContext(
  scene: Phaser.Scene,
  playerSlots: ReadonlyArray<MultiplayerGameLaunchPlayerSlot>
): InputContext {
  const keyboard = requireKeyboard(scene);

  return {
    keys: {
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      altLeft: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      altRight: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      altUp: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      altDown: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      fire: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      restart: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    },
    playerSlots: playerSlots.map((playerSlot) => {
      if (playerSlot.binding.transport === 'phone_link') {
        return {
          slotId: playerSlot.slotId,
          playerIndex: playerSlot.playerIndex,
          controllerLabel: playerSlot.controllerLabel,
          binding: playerSlot.binding
        };
      }

      if (playerSlot.binding.device.kind === 'keyboard_mouse') {
        throw new Error(
          `Pixel Invaders does not support keyboard_mouse device on slot "${playerSlot.slotId}". Use separate keyboard and mouse slots.`
        );
      }

      return {
        slotId: playerSlot.slotId,
        playerIndex: playerSlot.playerIndex,
        controllerLabel: playerSlot.controllerLabel,
        binding: playerSlot.binding,
        runtime: createInputRuntime(GAME_ACTION_CATALOG),
        profile: requireProfile(playerSlot.profileId)
      };
    })
  };
}

export function readMatchInput(
  scene: Phaser.Scene,
  inputContext: InputContext,
  pointerRange?: PointerRange
): MatchInput<FrameInput> {
  return createMatchInput(
    inputContext.playerSlots.map((playerInputContext) => ({
      playerIndex: playerInputContext.playerIndex,
      input: readPlayerFrameInput(scene, inputContext, playerInputContext, pointerRange)
    }))
  );
}
