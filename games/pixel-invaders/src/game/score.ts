import type { PlayerState } from './types';

export function totalPlayerScore(players: ReadonlyArray<PlayerState>): number {
  return players.reduce((total, player) => total + player.score, 0);
}

export function highestPlayerMultiplier(players: ReadonlyArray<PlayerState>): number {
  return players.reduce((highest, player) => Math.max(highest, player.scoreMultiplier), 1);
}
