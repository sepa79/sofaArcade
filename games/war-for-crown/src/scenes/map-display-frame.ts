import type { ProvinceMapState } from '../game/types';

export interface MapDisplayFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function createMapDisplayFrame(
  map: Pick<ProvinceMapState, 'tiles'>
): MapDisplayFrame {
  const landTiles = map.tiles.filter((tile) => tile.provinceId !== null);
  if (landTiles.length === 0) {
    throw new Error('Cannot create a map display frame without land tiles.');
  }

  const xCoordinates = landTiles.map((tile) => tile.x);
  const yCoordinates = landTiles.map((tile) => tile.y);
  const minimumX = Math.min(...xCoordinates);
  const maximumX = Math.max(...xCoordinates);
  const minimumY = Math.min(...yCoordinates);
  const maximumY = Math.max(...yCoordinates);

  return {
    x: minimumX - 1,
    y: minimumY - 1,
    width: maximumX - minimumX + 3,
    height: maximumY - minimumY + 3
  };
}
