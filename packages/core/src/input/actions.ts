export type ActionType = 'digital' | 'axis_1d';
export type AxisSpace = 'relative' | 'absolute';
export type AxisDomain = 'signed' | 'unit' | 'byte';

export interface DigitalActionDefinition {
  readonly id: string;
  readonly type: 'digital';
}

export interface Axis1DActionDefinition {
  readonly id: string;
  readonly type: 'axis_1d';
  readonly space: AxisSpace;
  readonly domain: AxisDomain;
}

export type ActionDefinition = DigitalActionDefinition | Axis1DActionDefinition;

export interface ActionCatalog {
  readonly definitions: ReadonlyArray<ActionDefinition>;
  readonly byId: ReadonlyMap<string, ActionDefinition>;
}

function requireNonEmptyId(id: string): void {
  if (id.trim().length === 0) {
    throw new Error('Action definition has an empty id.');
  }
}

function validateAxisDefinition(definition: Axis1DActionDefinition): void {
  if (definition.space === 'relative' && definition.domain !== 'signed') {
    throw new Error(
      `Action "${definition.id}" is invalid: relative axis must use domain "signed".`
    );
  }
}

export function createActionCatalog(definitions: ReadonlyArray<ActionDefinition>): ActionCatalog {
  if (definitions.length === 0) {
    throw new Error('Action catalog cannot be empty.');
  }

  const byId = new Map<string, ActionDefinition>();

  for (const definition of definitions) {
    requireNonEmptyId(definition.id);
    if (byId.has(definition.id)) {
      throw new Error(`Action catalog has duplicate id: "${definition.id}".`);
    }

    if (definition.type === 'axis_1d') {
      validateAxisDefinition(definition);
    }

    byId.set(definition.id, definition);
  }

  return {
    definitions,
    byId
  };
}

export function requireAction(catalog: ActionCatalog, actionId: string): ActionDefinition {
  const definition = catalog.byId.get(actionId);
  if (definition === undefined) {
    throw new Error(`Unknown action id: "${actionId}".`);
  }

  return definition;
}
