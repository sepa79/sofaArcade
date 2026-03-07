import { requireAction, type ActionCatalog } from './actions';

export type DigitalSourceKind =
  | 'keyboard_key'
  | 'mouse_button'
  | 'gamepad_button'
  | 'hid_button';

export type AxisSourceKind =
  | 'keyboard_axis'
  | 'mouse_delta_x'
  | 'mouse_position_x'
  | 'mouse_position_y'
  | 'gamepad_axis'
  | 'hid_axis';

export interface DigitalBinding {
  readonly id: string;
  readonly actionId: string;
  readonly type: 'digital';
  readonly source: {
    readonly kind: DigitalSourceKind;
    readonly code: string;
  };
}

export interface Axis1DBinding {
  readonly id: string;
  readonly actionId: string;
  readonly type: 'axis_1d';
  readonly source: {
    readonly kind: AxisSourceKind;
    readonly code: string;
  };
  readonly scale: number;
  readonly invert: boolean;
}

export type InputBinding = DigitalBinding | Axis1DBinding;

export interface InputProfile {
  readonly id: string;
  readonly playerIndex: number;
  readonly bindings: ReadonlyArray<InputBinding>;
}

function requireNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }
}

function validateBinding(catalog: ActionCatalog, binding: InputBinding): void {
  requireNonEmpty(binding.id, 'Binding id');
  requireNonEmpty(binding.source.code, `Binding source code for "${binding.id}"`);

  const action = requireAction(catalog, binding.actionId);
  if (action.type !== binding.type) {
    throw new Error(
      `Binding "${binding.id}" type mismatch: action "${binding.actionId}" is "${action.type}", binding is "${binding.type}".`
    );
  }

  if (binding.type === 'axis_1d') {
    if (!Number.isFinite(binding.scale) || binding.scale <= 0) {
      throw new Error(`Binding "${binding.id}" has invalid scale: ${binding.scale}.`);
    }
  }
}

export function createInputProfile(catalog: ActionCatalog, profile: InputProfile): InputProfile {
  requireNonEmpty(profile.id, 'Profile id');

  if (!Number.isInteger(profile.playerIndex) || profile.playerIndex < 0) {
    throw new Error(`Profile "${profile.id}" has invalid playerIndex: ${profile.playerIndex}.`);
  }

  const bindingIds = new Set<string>();
  const absoluteAxisActionIds = new Set<string>();
  for (const binding of profile.bindings) {
    if (bindingIds.has(binding.id)) {
      throw new Error(`Profile "${profile.id}" has duplicate binding id: "${binding.id}".`);
    }

    validateBinding(catalog, binding);
    const action = requireAction(catalog, binding.actionId);
    if (binding.type === 'axis_1d' && action.type === 'axis_1d' && action.space === 'absolute') {
      if (absoluteAxisActionIds.has(binding.actionId)) {
        throw new Error(
          `Profile "${profile.id}" has multiple absolute axis bindings for action "${binding.actionId}".`
        );
      }

      absoluteAxisActionIds.add(binding.actionId);
    }
    bindingIds.add(binding.id);
  }

  return profile;
}
