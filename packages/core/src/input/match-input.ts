export interface MatchPlayerInput<TPlayerInput> {
  readonly playerIndex: number;
  readonly input: TPlayerInput;
}

export interface MatchInput<TPlayerInput> {
  readonly players: ReadonlyArray<MatchPlayerInput<TPlayerInput>>;
}

function requirePlayerIndex(playerIndex: number, label: string): void {
  if (!Number.isInteger(playerIndex) || playerIndex < 0) {
    throw new Error(`${label} must be a non-negative integer, got ${playerIndex}.`);
  }
}

export function createMatchInput<TPlayerInput>(
  players: ReadonlyArray<MatchPlayerInput<TPlayerInput>>
): MatchInput<TPlayerInput> {
  if (players.length === 0) {
    throw new Error('Match input must define at least one player frame.');
  }

  let previousPlayerIndex = -1;
  for (const player of players) {
    requirePlayerIndex(player.playerIndex, 'Match input playerIndex');
    if (player.playerIndex <= previousPlayerIndex) {
      throw new Error('Match input players must be ordered by strictly increasing playerIndex.');
    }

    previousPlayerIndex = player.playerIndex;
  }

  return {
    players
  };
}
