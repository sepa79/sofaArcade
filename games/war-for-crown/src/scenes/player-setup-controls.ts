import type { PlayerId } from '../game/types';

export const HUMAN_PLAYER_COUNT_OPTIONS: ReadonlyArray<number> = [1, 2, 3, 4];

export type HumanSetupControl = 'color' | 'crest' | 'name';
export type HumanSetupButtonId = `setup-${HumanSetupControl}-p${1 | 2 | 3 | 4}`;

export function humanSetupButtonId(
  control: HumanSetupControl,
  playerId: PlayerId
): HumanSetupButtonId {
  if (!/^p[1-4]$/.test(playerId)) {
    throw new Error(`Human setup control requires player p1..p4, got ${playerId}.`);
  }
  return `setup-${control}-${playerId}` as HumanSetupButtonId;
}

export function humanSetupButtonCommand(buttonId: HumanSetupButtonId): {
  readonly control: HumanSetupControl;
  readonly playerId: PlayerId;
} {
  const match = /^setup-(color|crest|name)-(p[1-4])$/.exec(buttonId);
  if (match === null) {
    throw new Error(`Invalid human setup button id: ${buttonId}.`);
  }
  return {
    control: match[1] as HumanSetupControl,
    playerId: match[2]
  };
}
