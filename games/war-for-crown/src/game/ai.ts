import { DEFAULT_GAME_CONFIG } from './constants';
import { chooseC64OriginalAiAction } from './ai-c64-original';
import { chooseC64WorkbenchAiAction } from './ai-c64-workbench';
import { chooseDeterministicAiAction } from './ai-deterministic-debug';
import type { WarForCrownAction } from './actions';
import type { PlayerView } from './player-view';
import type { GameConfig } from './types';

export type WarForCrownAiMode = 'c64-original' | 'c64-workbench' | 'deterministic-debug';

export interface WarForCrownAiInput {
  readonly view: PlayerView;
  readonly config: GameConfig;
}

export interface WarForCrownAiStrategy {
  readonly mode: WarForCrownAiMode;
  readonly chooseAction: (input: WarForCrownAiInput) => WarForCrownAction;
}

export type WarForCrownAiClient = (view: PlayerView) => WarForCrownAction;

const C64_ORIGINAL_AI: WarForCrownAiStrategy = {
  mode: 'c64-original',
  chooseAction: ({ view, config }) => chooseC64OriginalAiAction(view, config)
};

const C64_WORKBENCH_AI: WarForCrownAiStrategy = {
  mode: 'c64-workbench',
  chooseAction: ({ view, config }) => chooseC64WorkbenchAiAction(view, config)
};

const DETERMINISTIC_DEBUG_AI: WarForCrownAiStrategy = {
  mode: 'deterministic-debug',
  chooseAction: ({ view, config }) => chooseDeterministicAiAction(view, config)
};

export const WAR_FOR_CROWN_AI_STRATEGIES: Readonly<
  Record<WarForCrownAiMode, WarForCrownAiStrategy>
> = {
  'c64-original': C64_ORIGINAL_AI,
  'c64-workbench': C64_WORKBENCH_AI,
  'deterministic-debug': DETERMINISTIC_DEBUG_AI
};

function requireAiStrategy(mode: WarForCrownAiMode): WarForCrownAiStrategy {
  const strategy = WAR_FOR_CROWN_AI_STRATEGIES[mode];
  if (strategy === undefined) {
    throw new Error(`Unknown War for Crown AI mode: ${mode}.`);
  }
  return strategy;
}

export function chooseAiAction(
  view: PlayerView,
  config: GameConfig = DEFAULT_GAME_CONFIG,
  mode: WarForCrownAiMode = 'c64-original'
): WarForCrownAction {
  return requireAiStrategy(mode).chooseAction({ view, config });
}

export function createAiClient(
  mode: WarForCrownAiMode = 'c64-original',
  config: GameConfig = DEFAULT_GAME_CONFIG
): WarForCrownAiClient {
  return (view) => chooseAiAction(view, config, mode);
}

export { chooseC64WorkbenchAiAction } from './ai-c64-workbench';
export { chooseC64OriginalAiAction } from './ai-c64-original';
export { chooseDeterministicAiAction } from './ai-deterministic-debug';
