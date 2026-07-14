import {
  parseWarForCrownSaveGame,
  type WarForCrownSaveGame
} from '../game/save-game';

export function parseWarForCrownSaveText(text: string, fileName: string): WarForCrownSaveGame {
  let rawSave: unknown;
  try {
    rawSave = JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`Save file "${fileName}" is not valid JSON.`, { cause: error });
  }
  return parseWarForCrownSaveGame(rawSave);
}

export async function readWarForCrownSaveFile(file: File): Promise<WarForCrownSaveGame> {
  return parseWarForCrownSaveText(await file.text(), file.name);
}

export function downloadWarForCrownSaveFile(save: WarForCrownSaveGame): void {
  const json = JSON.stringify(save, null, 2);
  const url = URL.createObjectURL(new Blob([`${json}\n`], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `war-for-crown-seed-${save.state.seed}-turn-${save.state.turnNumber}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    throw new Error('Save operation rejected with a non-Error value.');
  }
  return error.message;
}
