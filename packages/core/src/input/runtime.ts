import { requireAction, type ActionCatalog, type Axis1DActionDefinition, type AxisDomain } from './actions';

interface DigitalState {
  pressed: boolean;
  justPressed: boolean;
}

interface AxisState {
  raw: number;
}

export interface InputRuntime {
  beginFrame(): void;
  writeDigital(actionId: string, pressed: boolean): void;
  writeAxis(actionId: string, rawValue: number): void;
  isPressed(actionId: string): boolean;
  wasPressed(actionId: string): boolean;
  readAxisRaw(actionId: string): number;
  readAxisUnit(actionId: string): number;
  readAxisSigned(actionId: string): number;
}

function assertAxisRange(definition: Axis1DActionDefinition, rawValue: number): void {
  if (!Number.isFinite(rawValue)) {
    throw new Error(`Axis action "${definition.id}" received non-finite value.`);
  }

  if (definition.domain === 'signed' && (rawValue < -1 || rawValue > 1)) {
    throw new Error(`Axis action "${definition.id}" expects signed range [-1, 1], got ${rawValue}.`);
  }

  if (definition.domain === 'unit' && (rawValue < 0 || rawValue > 1)) {
    throw new Error(`Axis action "${definition.id}" expects unit range [0, 1], got ${rawValue}.`);
  }

  if (definition.domain === 'byte' && (rawValue < 0 || rawValue > 255)) {
    throw new Error(`Axis action "${definition.id}" expects byte range [0, 255], got ${rawValue}.`);
  }
}

function toUnit(domain: AxisDomain, rawValue: number): number {
  if (domain === 'signed') {
    return (rawValue + 1) / 2;
  }

  if (domain === 'unit') {
    return rawValue;
  }

  return rawValue / 255;
}

function toSigned(domain: AxisDomain, rawValue: number): number {
  if (domain === 'signed') {
    return rawValue;
  }

  if (domain === 'unit') {
    return rawValue * 2 - 1;
  }

  return (rawValue / 255) * 2 - 1;
}

export function createInputRuntime(catalog: ActionCatalog): InputRuntime {
  const digitalStates = new Map<string, DigitalState>();
  const axisStates = new Map<string, AxisState>();

  for (const definition of catalog.definitions) {
    if (definition.type === 'digital') {
      digitalStates.set(definition.id, {
        pressed: false,
        justPressed: false
      });
      continue;
    }

    axisStates.set(definition.id, {
      raw: 0
    });
  }

  return {
    beginFrame(): void {
      for (const state of digitalStates.values()) {
        state.justPressed = false;
      }

      for (const [actionId, state] of axisStates.entries()) {
        const definition = requireAction(catalog, actionId);
        if (definition.type !== 'axis_1d') {
          throw new Error(`Internal input state mismatch for action "${actionId}".`);
        }

        if (definition.space === 'relative') {
          state.raw = 0;
        }
      }
    },

    writeDigital(actionId: string, pressed: boolean): void {
      const definition = requireAction(catalog, actionId);
      if (definition.type !== 'digital') {
        throw new Error(`Action "${actionId}" is not digital.`);
      }

      const state = digitalStates.get(actionId);
      if (state === undefined) {
        throw new Error(`Digital state for action "${actionId}" is missing.`);
      }

      state.justPressed = !state.pressed && pressed;
      state.pressed = pressed;
    },

    writeAxis(actionId: string, rawValue: number): void {
      const definition = requireAction(catalog, actionId);
      if (definition.type !== 'axis_1d') {
        throw new Error(`Action "${actionId}" is not axis_1d.`);
      }

      assertAxisRange(definition, rawValue);

      const state = axisStates.get(actionId);
      if (state === undefined) {
        throw new Error(`Axis state for action "${actionId}" is missing.`);
      }

      if (definition.space === 'relative') {
        state.raw += rawValue;
        assertAxisRange(definition, state.raw);
        return;
      }

      state.raw = rawValue;
    },

    isPressed(actionId: string): boolean {
      const definition = requireAction(catalog, actionId);
      if (definition.type !== 'digital') {
        throw new Error(`Action "${actionId}" is not digital.`);
      }

      const state = digitalStates.get(actionId);
      if (state === undefined) {
        throw new Error(`Digital state for action "${actionId}" is missing.`);
      }

      return state.pressed;
    },

    wasPressed(actionId: string): boolean {
      const definition = requireAction(catalog, actionId);
      if (definition.type !== 'digital') {
        throw new Error(`Action "${actionId}" is not digital.`);
      }

      const state = digitalStates.get(actionId);
      if (state === undefined) {
        throw new Error(`Digital state for action "${actionId}" is missing.`);
      }

      return state.justPressed;
    },

    readAxisRaw(actionId: string): number {
      const definition = requireAction(catalog, actionId);
      if (definition.type !== 'axis_1d') {
        throw new Error(`Action "${actionId}" is not axis_1d.`);
      }

      const state = axisStates.get(actionId);
      if (state === undefined) {
        throw new Error(`Axis state for action "${actionId}" is missing.`);
      }

      return state.raw;
    },

    readAxisUnit(actionId: string): number {
      const definition = requireAction(catalog, actionId);
      if (definition.type !== 'axis_1d') {
        throw new Error(`Action "${actionId}" is not axis_1d.`);
      }

      const state = axisStates.get(actionId);
      if (state === undefined) {
        throw new Error(`Axis state for action "${actionId}" is missing.`);
      }

      return toUnit(definition.domain, state.raw);
    },

    readAxisSigned(actionId: string): number {
      const definition = requireAction(catalog, actionId);
      if (definition.type !== 'axis_1d') {
        throw new Error(`Action "${actionId}" is not axis_1d.`);
      }

      const state = axisStates.get(actionId);
      if (state === undefined) {
        throw new Error(`Axis state for action "${actionId}" is missing.`);
      }

      return toSigned(definition.domain, state.raw);
    }
  };
}
