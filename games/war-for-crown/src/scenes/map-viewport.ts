import type { ProvinceMapState, TileState } from '../game/types';
import { createMapDisplayFrame } from './map-display-frame';
import {
  MAP_EDGE_EPSILON,
  MAP_EDGE_SCROLL_SIZE,
  MAP_EDGE_SCROLL_SPEED,
  MAP_RECT,
  MAP_ZOOM_LEVELS,
  type MapViewport,
  type Point,
  type Rect
} from './scene-contracts';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function mapTileAtGrid(
  map: ProvinceMapState,
  x: number,
  y: number
): TileState | null {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return null;
  }
  return map.tiles[y * map.width + x] ?? null;
}

export function mapTileWidth(map: ProvinceMapState, viewport: MapViewport): number {
  return (MAP_RECT.width / createMapDisplayFrame(map).width) * viewport.zoom;
}

export function mapTileHeight(map: ProvinceMapState, viewport: MapViewport): number {
  return (MAP_RECT.height / createMapDisplayFrame(map).height) * viewport.zoom;
}

export function mapTileRect(
  map: ProvinceMapState,
  viewport: MapViewport,
  tile: TileState
): Rect {
  const frame = createMapDisplayFrame(map);
  const width = mapTileWidth(map, viewport);
  const height = mapTileHeight(map, viewport);
  return {
    x: MAP_RECT.x + (tile.x - frame.x) * width - viewport.offsetX,
    y: MAP_RECT.y + (tile.y - frame.y) * height - viewport.offsetY,
    width,
    height
  };
}

export function maximumMapOffsetX(zoom: number): number {
  return Math.max(0, MAP_RECT.width * zoom - MAP_RECT.width);
}

export function maximumMapOffsetY(zoom: number): number {
  return Math.max(0, MAP_RECT.height * zoom - MAP_RECT.height);
}

export function clampMapViewport(viewport: MapViewport): MapViewport {
  return {
    zoom: viewport.zoom,
    offsetX: clamp(viewport.offsetX, 0, maximumMapOffsetX(viewport.zoom)),
    offsetY: clamp(viewport.offsetY, 0, maximumMapOffsetY(viewport.zoom))
  };
}

export function mapTileAtPoint(
  map: ProvinceMapState,
  viewport: MapViewport,
  point: Point
): TileState | null {
  if (
    point.x < MAP_RECT.x ||
    point.y < MAP_RECT.y ||
    point.x >= MAP_RECT.x + MAP_RECT.width ||
    point.y >= MAP_RECT.y + MAP_RECT.height
  ) {
    return null;
  }
  const frame = createMapDisplayFrame(map);
  const tileX = frame.x + Math.floor(
    (point.x - MAP_RECT.x + viewport.offsetX) / mapTileWidth(map, viewport)
  );
  const tileY = frame.y + Math.floor(
    (point.y - MAP_RECT.y + viewport.offsetY) / mapTileHeight(map, viewport)
  );
  return mapTileAtGrid(map, tileX, tileY);
}

export function mapCanPanLeft(viewport: MapViewport): boolean {
  return viewport.offsetX > MAP_EDGE_EPSILON;
}

export function mapCanPanRight(viewport: MapViewport): boolean {
  return viewport.offsetX < maximumMapOffsetX(viewport.zoom) - MAP_EDGE_EPSILON;
}

export function mapCanPanUp(viewport: MapViewport): boolean {
  return viewport.offsetY > MAP_EDGE_EPSILON;
}

export function mapCanPanDown(viewport: MapViewport): boolean {
  return viewport.offsetY < maximumMapOffsetY(viewport.zoom) - MAP_EDGE_EPSILON;
}

export function mapEdgeVelocity(viewport: MapViewport, point: Point): Point {
  const left = point.x - MAP_RECT.x;
  const right = MAP_RECT.x + MAP_RECT.width - point.x;
  const top = point.y - MAP_RECT.y;
  const bottom = MAP_RECT.y + MAP_RECT.height - point.y;
  let x = 0;
  let y = 0;
  if (left < MAP_EDGE_SCROLL_SIZE && mapCanPanLeft(viewport)) {
    x = -MAP_EDGE_SCROLL_SPEED * ((MAP_EDGE_SCROLL_SIZE - left) / MAP_EDGE_SCROLL_SIZE);
  } else if (right < MAP_EDGE_SCROLL_SIZE && mapCanPanRight(viewport)) {
    x = MAP_EDGE_SCROLL_SPEED * ((MAP_EDGE_SCROLL_SIZE - right) / MAP_EDGE_SCROLL_SIZE);
  }
  if (top < MAP_EDGE_SCROLL_SIZE && mapCanPanUp(viewport)) {
    y = -MAP_EDGE_SCROLL_SPEED * ((MAP_EDGE_SCROLL_SIZE - top) / MAP_EDGE_SCROLL_SIZE);
  } else if (bottom < MAP_EDGE_SCROLL_SIZE && mapCanPanDown(viewport)) {
    y = MAP_EDGE_SCROLL_SPEED * ((MAP_EDGE_SCROLL_SIZE - bottom) / MAP_EDGE_SCROLL_SIZE);
  }
  return { x, y };
}

export function panMapViewport(
  viewport: MapViewport,
  deltaX: number,
  deltaY: number
): { readonly moved: boolean; readonly viewport: MapViewport } {
  const next = clampMapViewport({
    ...viewport,
    offsetX: viewport.offsetX + deltaX,
    offsetY: viewport.offsetY + deltaY
  });
  return {
    moved: Math.abs(next.offsetX - viewport.offsetX) > MAP_EDGE_EPSILON ||
      Math.abs(next.offsetY - viewport.offsetY) > MAP_EDGE_EPSILON,
    viewport: next
  };
}

export function zoomMapViewport(
  viewport: MapViewport,
  currentIndex: number,
  nextIndex: number,
  anchor: Point
): MapViewport {
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= MAP_ZOOM_LEVELS.length) {
    throw new Error(`Map zoom index ${nextIndex} is outside configured levels.`);
  }
  if (currentIndex === nextIndex) {
    throw new Error(`Map zoom index ${nextIndex} is already active.`);
  }
  const nextZoom = MAP_ZOOM_LEVELS[nextIndex];
  if (nextZoom === undefined) {
    throw new Error(`Missing configured map zoom level ${nextIndex}.`);
  }
  const baseAnchorX = (anchor.x - MAP_RECT.x + viewport.offsetX) / viewport.zoom;
  const baseAnchorY = (anchor.y - MAP_RECT.y + viewport.offsetY) / viewport.zoom;
  return clampMapViewport({
    zoom: nextZoom,
    offsetX: baseAnchorX * nextZoom - (anchor.x - MAP_RECT.x),
    offsetY: baseAnchorY * nextZoom - (anchor.y - MAP_RECT.y)
  });
}

export function initialMapViewport(): MapViewport {
  const zoom = MAP_ZOOM_LEVELS[0];
  if (zoom === undefined) {
    throw new Error('Map zoom levels must define an initial value.');
  }
  return { zoom, offsetX: 0, offsetY: 0 };
}

export function mapViewportLabel(viewport: MapViewport): string {
  return `Map ${Math.round(viewport.zoom * 100)}%`;
}
