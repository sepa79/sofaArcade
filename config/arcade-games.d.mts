export type ArcadeGameId =
  | 'artillery-duel'
  | 'pixel-invaders'
  | 'tunnel-invaders'
  | 'war-for-crown';

export interface ArcadeGameDefinition {
  readonly id: ArcadeGameId;
  readonly packageName: ArcadeGameId;
  readonly route: 'ArtilleryDuel' | 'PixelInvaders' | 'TunnelInvaders' | 'WarForCrown';
  readonly title: string;
  readonly description: string;
  readonly players: string;
}

export const ARCADE_GAMES: readonly ArcadeGameDefinition[];
