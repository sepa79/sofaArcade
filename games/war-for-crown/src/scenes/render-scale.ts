import { WORLD_HEIGHT, WORLD_WIDTH } from '../game/constants';

function requirePositiveFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number, got ${value}.`);
  }
  return value;
}

const viewportWidth = requirePositiveFinite(window.innerWidth, 'Viewport width');
const viewportHeight = requirePositiveFinite(window.innerHeight, 'Viewport height');
const devicePixelRatio = requirePositiveFinite(window.devicePixelRatio, 'Device pixel ratio');
const cssFitScale = Math.min(viewportWidth / WORLD_WIDTH, viewportHeight / WORLD_HEIGHT);

export const WAR_FOR_CROWN_RENDER_SCALE = Math.max(1, cssFitScale * devicePixelRatio);
