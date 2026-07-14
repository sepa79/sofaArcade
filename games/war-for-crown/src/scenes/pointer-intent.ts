export type WarForCrownPointerIntent = 'button' | 'ignore' | 'phase-overlay';

const ALWAYS_INTERACTIVE_BUTTON_IDS: ReadonlySet<string> = new Set([
  'language-toggle',
  'new-map',
  'save-game',
  'save-game-json'
]);

export interface PointerIntentInput {
  readonly aiActionCueVisible: boolean;
  readonly battleActive: boolean;
  readonly battleButton: boolean;
  readonly battleSummaryVisible: boolean;
  readonly buttonId: string | null;
  readonly gameOver: boolean;
  readonly phaseOverlayVisible: boolean;
}

export function resolvePointerIntent(input: PointerIntentInput): WarForCrownPointerIntent {
  if (input.buttonId !== null && ALWAYS_INTERACTIVE_BUTTON_IDS.has(input.buttonId)) {
    return 'button';
  }
  if (input.gameOver) {
    return input.buttonId === 'victory-menu' ? 'button' : 'ignore';
  }
  if (input.aiActionCueVisible) {
    return 'ignore';
  }
  if (input.phaseOverlayVisible) {
    return 'phase-overlay';
  }
  if (input.battleSummaryVisible) {
    return input.buttonId === 'battle-summary-confirm' ? 'button' : 'ignore';
  }
  if (input.battleActive) {
    return input.buttonId !== null && input.battleButton ? 'button' : 'ignore';
  }
  return input.buttonId === null ? 'ignore' : 'button';
}
