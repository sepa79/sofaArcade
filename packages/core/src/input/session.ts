export interface SharedLocalInputDevice {
  readonly kind: 'shared_local';
}

export interface KeyboardMouseInputDevice {
  readonly kind: 'keyboard_mouse';
}

export interface GamepadInputDevice {
  readonly kind: 'gamepad';
  readonly gamepadIndex: number;
}

export interface HidInputDevice {
  readonly kind: 'hid';
  readonly deviceId: string;
}

export type LocalInputDevice =
  | SharedLocalInputDevice
  | KeyboardMouseInputDevice
  | GamepadInputDevice
  | HidInputDevice;

export interface LocalInputBinding {
  readonly transport: 'local';
  readonly device: LocalInputDevice;
}

export interface PhoneLinkInputBinding {
  readonly transport: 'phone_link';
  readonly phoneControllerId: string;
}

export type InputSlotBinding = LocalInputBinding | PhoneLinkInputBinding;

export interface InputSessionSlot {
  readonly slotId: string;
  readonly playerIndex: number;
  readonly profileId: string;
  readonly binding: InputSlotBinding;
}

export interface InputSessionPlan {
  readonly slots: ReadonlyArray<InputSessionSlot>;
}

function requireNonEmptyString(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }
}

function requirePlayerIndex(playerIndex: number, label: string): void {
  if (!Number.isInteger(playerIndex) || playerIndex < 0) {
    throw new Error(`${label} must be a non-negative integer, got ${playerIndex}.`);
  }
}

function requireGamepadIndex(gamepadIndex: number, label: string): void {
  if (!Number.isInteger(gamepadIndex) || gamepadIndex < 0) {
    throw new Error(`${label} must be a non-negative integer, got ${gamepadIndex}.`);
  }
}

export function createInputSessionPlan(plan: InputSessionPlan): InputSessionPlan {
  if (plan.slots.length === 0) {
    throw new Error('Input session plan must define at least one slot.');
  }

  const slotIds = new Set<string>();
  const playerIndices = new Set<number>();
  const gamepadIndices = new Set<number>();
  const hidDeviceIds = new Set<string>();
  const phoneControllerIds = new Set<string>();
  let usesSharedLocal = false;
  let usesKeyboardMouse = false;

  for (const slot of plan.slots) {
    requireNonEmptyString(slot.slotId, 'Input session slotId');
    requirePlayerIndex(slot.playerIndex, `Input session slot "${slot.slotId}" playerIndex`);
    requireNonEmptyString(slot.profileId, `Input session slot "${slot.slotId}" profileId`);

    if (slotIds.has(slot.slotId)) {
      throw new Error(`Input session plan has duplicate slotId: "${slot.slotId}".`);
    }

    if (playerIndices.has(slot.playerIndex)) {
      throw new Error(`Input session plan has duplicate playerIndex: ${slot.playerIndex}.`);
    }

    slotIds.add(slot.slotId);
    playerIndices.add(slot.playerIndex);

    if (slot.binding.transport === 'phone_link') {
      requireNonEmptyString(
        slot.binding.phoneControllerId,
        `Input session slot "${slot.slotId}" phoneControllerId`
      );
      if (phoneControllerIds.has(slot.binding.phoneControllerId)) {
        throw new Error(
          `Input session plan has duplicate phoneControllerId: "${slot.binding.phoneControllerId}".`
        );
      }

      phoneControllerIds.add(slot.binding.phoneControllerId);
      continue;
    }

    if (slot.binding.transport !== 'local') {
      continue;
    }

    if (slot.binding.device.kind === 'shared_local') {
      usesSharedLocal = true;
      continue;
    }

    if (slot.binding.device.kind === 'keyboard_mouse') {
      if (usesKeyboardMouse) {
        throw new Error('Input session plan can assign keyboard_mouse to only one slot.');
      }

      usesKeyboardMouse = true;
      continue;
    }

    if (slot.binding.device.kind === 'gamepad') {
      requireGamepadIndex(slot.binding.device.gamepadIndex, `Input session slot "${slot.slotId}" gamepadIndex`);
      if (gamepadIndices.has(slot.binding.device.gamepadIndex)) {
        throw new Error(
          `Input session plan has duplicate gamepadIndex: ${slot.binding.device.gamepadIndex}.`
        );
      }

      gamepadIndices.add(slot.binding.device.gamepadIndex);
      continue;
    }

    requireNonEmptyString(slot.binding.device.deviceId, `Input session slot "${slot.slotId}" hid deviceId`);
    if (hidDeviceIds.has(slot.binding.device.deviceId)) {
      throw new Error(`Input session plan has duplicate hid deviceId: "${slot.binding.device.deviceId}".`);
    }

    hidDeviceIds.add(slot.binding.device.deviceId);
  }

  if (usesSharedLocal && plan.slots.length !== 1) {
    throw new Error('Input session plan cannot mix shared_local binding with any other slot.');
  }

  return plan;
}
