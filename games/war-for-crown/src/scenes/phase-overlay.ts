import type { GameState } from '../game/types';
import type { PhaseOverlay, SceneMode } from './scene-contracts';
import { PHASE_OVERLAY_MS } from './scene-contracts';
import { turnUiCopy } from './scene-presentation';
import type { Language } from './ui-copy';

export function phaseKey(mode: SceneMode, state: GameState): string | null {
  return mode === 'game'
    ? `${state.activePlayerId}:${state.phase}:${state.turnStep}:${state.turnNumber}`
    : null;
}

export function phaseOverlayAllowed(
  battleActive: boolean,
  battleSummaryVisible: boolean
): boolean {
  return !battleActive && !battleSummaryVisible;
}

export function createPhaseOverlay(input: {
  readonly language: Language;
  readonly nowMs: number;
  readonly state: GameState;
  readonly subtitle: string;
}): PhaseOverlay {
  return {
    title: turnUiCopy(input.state, input.language).title,
    subtitle: input.subtitle,
    hideAtMs: input.state.phase === 'turn' && input.state.turnStep === 'new-month'
      ? null
      : input.nowMs + PHASE_OVERLAY_MS
  };
}
