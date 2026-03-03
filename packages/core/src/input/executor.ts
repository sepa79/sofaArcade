import type { InputRuntime } from './runtime';
import type { Axis1DBinding, DigitalBinding, InputBinding, InputProfile } from './profile';

export interface InputSourceFrame {
  readonly digital: ReadonlyMap<string, boolean>;
  readonly axis: ReadonlyMap<string, number>;
}

function requireDigitalSource(frame: InputSourceFrame, sourceCode: string): boolean {
  const value = frame.digital.get(sourceCode);
  if (value === undefined) {
    throw new Error(`Missing digital source in input frame: "${sourceCode}".`);
  }

  return value;
}

function requireAxisSource(frame: InputSourceFrame, sourceCode: string): number {
  const value = frame.axis.get(sourceCode);
  if (value === undefined) {
    throw new Error(`Missing axis source in input frame: "${sourceCode}".`);
  }

  if (!Number.isFinite(value)) {
    throw new Error(`Axis source "${sourceCode}" is not finite.`);
  }

  return value;
}

function applyDigitalBindings(
  runtime: InputRuntime,
  bindings: ReadonlyArray<DigitalBinding>,
  frame: InputSourceFrame
): void {
  const resolved = new Map<string, boolean>();

  for (const binding of bindings) {
    const value = requireDigitalSource(frame, binding.source.code);
    const previous = resolved.get(binding.actionId) ?? false;
    resolved.set(binding.actionId, previous || value);
  }

  for (const [actionId, value] of resolved.entries()) {
    runtime.writeDigital(actionId, value);
  }
}

function applyAxisBindings(
  runtime: InputRuntime,
  bindings: ReadonlyArray<Axis1DBinding>,
  frame: InputSourceFrame
): void {
  for (const binding of bindings) {
    const sourceValue = requireAxisSource(frame, binding.source.code);
    const scaled = sourceValue * binding.scale;
    const resolved = binding.invert ? -scaled : scaled;
    runtime.writeAxis(binding.actionId, resolved);
  }
}

function splitBindings(bindings: ReadonlyArray<InputBinding>): {
  readonly digital: ReadonlyArray<DigitalBinding>;
  readonly axis: ReadonlyArray<Axis1DBinding>;
} {
  const digital: DigitalBinding[] = [];
  const axis: Axis1DBinding[] = [];

  for (const binding of bindings) {
    if (binding.type === 'digital') {
      digital.push(binding);
      continue;
    }

    axis.push(binding);
  }

  return {
    digital,
    axis
  };
}

export function createInputSourceFrame(input: {
  readonly digital: Readonly<Record<string, boolean>>;
  readonly axis: Readonly<Record<string, number>>;
}): InputSourceFrame {
  return {
    digital: new Map<string, boolean>(Object.entries(input.digital)),
    axis: new Map<string, number>(Object.entries(input.axis))
  };
}

export function applyInputProfile(
  runtime: InputRuntime,
  profile: InputProfile,
  frame: InputSourceFrame
): void {
  runtime.beginFrame();

  const bindings = splitBindings(profile.bindings);
  applyDigitalBindings(runtime, bindings.digital, frame);
  applyAxisBindings(runtime, bindings.axis, frame);
}
