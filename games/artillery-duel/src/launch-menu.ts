export interface ArtilleryLaunchMenuState {
  readonly selectedOptionIndex: number;
  readonly verticalAxisHeld: boolean;
}

export interface ArtilleryLaunchMenuInput {
  readonly confirmPressed: boolean;
  readonly verticalAxis: number;
}

export interface ArtilleryLaunchMenuStep {
  readonly launchOptionIndex: number | null;
  readonly state: ArtilleryLaunchMenuState;
}

export function stepArtilleryLaunchMenu(
  state: ArtilleryLaunchMenuState,
  input: ArtilleryLaunchMenuInput,
  optionCount: number
): ArtilleryLaunchMenuStep {
  if (!Number.isSafeInteger(optionCount) || optionCount < 1) {
    throw new Error(`Artillery launch menu option count must be positive, got ${optionCount}.`);
  }
  if (
    !Number.isSafeInteger(state.selectedOptionIndex) ||
    state.selectedOptionIndex < 0 ||
    state.selectedOptionIndex >= optionCount
  ) {
    throw new Error(`Artillery launch menu selection is invalid: ${state.selectedOptionIndex}.`);
  }

  const verticalAxisActive = input.verticalAxis !== 0;
  const direction = input.verticalAxis > 0 ? -1 : 1;
  const selectedOptionIndex = verticalAxisActive && !state.verticalAxisHeld
    ? (state.selectedOptionIndex + direction + optionCount) % optionCount
    : state.selectedOptionIndex;
  return {
    state: {
      selectedOptionIndex,
      verticalAxisHeld: verticalAxisActive
    },
    launchOptionIndex: input.confirmPressed ? selectedOptionIndex : null
  };
}
