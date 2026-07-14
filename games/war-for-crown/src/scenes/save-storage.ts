import {
  hasPersistentValue,
  loadPersistentJson,
  savePersistentJson
} from '@light80/core';

import {
  createWarForCrownSaveGame,
  parseWarForCrownSaveGame,
  type SaveLanguage,
  type SavedPlayerSetup,
  type WarForCrownSaveGame
} from '../game/save-game';
import type { GameConfig, GameState } from '../game/types';

export const WAR_FOR_CROWN_BROWSER_SAVE_KEY = 'sofa-arcade.war-for-crown.save.v1';

export function createWarForCrownSaveSnapshot(input: {
  readonly language: SaveLanguage;
  readonly config: GameConfig;
  readonly playerSetups: ReadonlyArray<SavedPlayerSetup>;
  readonly state: GameState;
}): WarForCrownSaveGame {
  return createWarForCrownSaveGame(input);
}

export function hasWarForCrownBrowserSave(): boolean {
  return hasPersistentValue(WAR_FOR_CROWN_BROWSER_SAVE_KEY);
}

export function saveWarForCrownToBrowser(save: WarForCrownSaveGame): void {
  savePersistentJson(WAR_FOR_CROWN_BROWSER_SAVE_KEY, save);
}

export function loadWarForCrownFromBrowser(): WarForCrownSaveGame {
  return parseWarForCrownSaveGame(loadPersistentJson(WAR_FOR_CROWN_BROWSER_SAVE_KEY));
}
