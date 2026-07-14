export function selectedHireSoldiers(selected: number, affordable: number): number {
  if (!Number.isInteger(selected) || selected < 1) {
    throw new Error(`Selected recruit count must be a positive integer, got ${selected}.`);
  }
  if (!Number.isInteger(affordable) || affordable < 0) {
    throw new Error(`Affordable recruit count must be a non-negative integer, got ${affordable}.`);
  }
  return affordable === 0 ? 0 : Math.min(selected, affordable);
}

export function changeHireSelection(selected: number, affordable: number, delta: number): number {
  if (!Number.isInteger(delta)) {
    throw new Error(`Recruit selection delta must be an integer, got ${delta}.`);
  }
  if (affordable < 1) {
    throw new Error('Cannot change recruit selection when no soldiers are affordable.');
  }
  return Math.max(1, Math.min(affordable, selectedHireSoldiers(selected, affordable) + delta));
}
