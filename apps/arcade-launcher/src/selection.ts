export interface LauncherSelection {
  readonly gameIndex: number;
}

export function createLauncherSelection(): LauncherSelection {
  return { gameIndex: 0 };
}

export function moveLauncherSelection(
  selection: LauncherSelection,
  delta: number,
  gameCount: number
): LauncherSelection {
  if (!Number.isInteger(delta)) {
    throw new Error(`Launcher selection delta must be an integer: ${delta}`);
  }
  if (!Number.isInteger(gameCount) || gameCount <= 0) {
    throw new Error(`Launcher game count must be a positive integer: ${gameCount}`);
  }
  if (!Number.isInteger(selection.gameIndex) || selection.gameIndex < 0 || selection.gameIndex >= gameCount) {
    throw new Error(`Launcher game index is outside the catalog: ${selection.gameIndex}`);
  }

  const gameIndex = (selection.gameIndex + delta % gameCount + gameCount) % gameCount;
  return { gameIndex };
}
