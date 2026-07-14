export interface ArcadeGameDefinition {
  readonly id: string;
  readonly packageName: string;
  readonly route: string;
  readonly title: string;
  readonly description: string;
  readonly players: string;
}

export const ARCADE_GAMES: readonly ArcadeGameDefinition[];
