import { createInputProfile, type Axis1DBinding, type DigitalBinding, type InputProfile } from './profile';
import type { ActionCatalog } from './actions';

const DIGITAL_SOURCE_KINDS = ['keyboard_key', 'mouse_button', 'gamepad_button', 'hid_button'] as const;
const AXIS_SOURCE_KINDS = [
  'keyboard_axis',
  'mouse_delta_x',
  'mouse_position_x',
  'gamepad_axis',
  'hid_axis'
] as const;

function requireOneOf<T extends string>(value: string, allowed: ReadonlyArray<T>, label: string): T {
  if (!allowed.includes(value as T)) {
    throw new Error(`${label} is invalid: "${value}".`);
  }

  return value as T;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  return value;
}

function requireInteger(value: unknown, label: string): number {
  const numberValue = requireNumber(value, label);
  if (!Number.isInteger(numberValue)) {
    throw new Error(`${label} must be an integer.`);
  }

  return numberValue;
}

function parseDigitalBinding(raw: Record<string, unknown>, index: number): DigitalBinding {
  const source = requireRecord(raw.source, `bindings[${index}].source`);
  const sourceKind = requireString(source.kind, `bindings[${index}].source.kind`);

  return {
    id: requireString(raw.id, `bindings[${index}].id`),
    actionId: requireString(raw.actionId, `bindings[${index}].actionId`),
    type: 'digital',
    source: {
      kind: requireOneOf(sourceKind, DIGITAL_SOURCE_KINDS, `bindings[${index}].source.kind`),
      code: requireString(source.code, `bindings[${index}].source.code`)
    }
  };
}

function parseAxisBinding(raw: Record<string, unknown>, index: number): Axis1DBinding {
  const source = requireRecord(raw.source, `bindings[${index}].source`);
  const sourceKind = requireString(source.kind, `bindings[${index}].source.kind`);

  return {
    id: requireString(raw.id, `bindings[${index}].id`),
    actionId: requireString(raw.actionId, `bindings[${index}].actionId`),
    type: 'axis_1d',
    source: {
      kind: requireOneOf(sourceKind, AXIS_SOURCE_KINDS, `bindings[${index}].source.kind`),
      code: requireString(source.code, `bindings[${index}].source.code`)
    },
    scale: requireNumber(raw.scale, `bindings[${index}].scale`),
    invert: requireBoolean(raw.invert, `bindings[${index}].invert`)
  };
}

function parseBindings(rawBindings: unknown): ReadonlyArray<DigitalBinding | Axis1DBinding> {
  if (!Array.isArray(rawBindings)) {
    throw new Error('bindings must be an array.');
  }

  return rawBindings.map((rawBinding, index) => {
    const binding = requireRecord(rawBinding, `bindings[${index}]`);
    const type = requireString(binding.type, `bindings[${index}].type`);

    if (type === 'digital') {
      return parseDigitalBinding(binding, index);
    }

    if (type === 'axis_1d') {
      return parseAxisBinding(binding, index);
    }

    throw new Error(`bindings[${index}].type is invalid: "${type}".`);
  });
}

export function parseInputProfileData(raw: unknown): InputProfile {
  const data = requireRecord(raw, 'Input profile');

  return {
    id: requireString(data.id, 'id'),
    playerIndex: requireInteger(data.playerIndex, 'playerIndex'),
    bindings: parseBindings(data.bindings)
  };
}

export function loadInputProfile(catalog: ActionCatalog, raw: unknown): InputProfile {
  return createInputProfile(catalog, parseInputProfileData(raw));
}
