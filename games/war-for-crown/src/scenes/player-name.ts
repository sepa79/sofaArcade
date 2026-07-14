export const WAR_FOR_CROWN_PLAYER_NAME_MAX_LENGTH = 12;

export function playerNamesAreComplete(names: ReadonlyArray<string>): boolean {
  return names.every((name) => name.trim().length > 0);
}

export function appendPlayerNameCharacter(current: string, character: string): string {
  if (Array.from(character).length !== 1) {
    throw new Error(`Player name input must contain exactly one character, got "${character}".`);
  }
  return Array.from(`${current}${character}`)
    .slice(0, WAR_FOR_CROWN_PLAYER_NAME_MAX_LENGTH)
    .join('');
}

export function removeLastPlayerNameCharacter(current: string): string {
  return Array.from(current).slice(0, -1).join('');
}
