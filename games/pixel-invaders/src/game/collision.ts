import {
  ENEMY_COLS,
  ENEMY_STANDARD_ACTIVE_HEIGHT,
  ENEMY_STANDARD_ACTIVE_WIDTH,
  ENEMY_UFO_ACTIVE_HEIGHT,
  ENEMY_UFO_ACTIVE_WIDTH,
  PLAYER_ACTIVE_HEIGHT,
  PLAYER_ACTIVE_WIDTH
} from './constants';
import type { Enemy } from './types';

export interface AlphaMask {
  readonly width: number;
  readonly height: number;
  readonly alpha: Uint8Array;
}

export interface CollisionRuntime {
  readonly playerMask: AlphaMask;
  readonly enemySmallMasks: readonly [AlphaMask, AlphaMask, AlphaMask, AlphaMask];
  readonly enemyBig1Mask: AlphaMask;
}

export interface CollisionBroadEnvelope {
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
  readonly owner: 'player' | 'enemy';
}

export interface CollisionContactMarker {
  readonly x: number;
  readonly y: number;
  readonly owner: 'player' | 'enemy';
}

export interface CollisionDebugFrame {
  readonly broadPhaseEnvelopes: ReadonlyArray<CollisionBroadEnvelope>;
  readonly narrowPhaseMarkers: ReadonlyArray<CollisionContactMarker>;
}

export interface MutableCollisionDebugFrame {
  readonly broadPhaseEnvelopes: CollisionBroadEnvelope[];
  readonly narrowPhaseMarkers: CollisionContactMarker[];
}

interface SegmentMaskHit {
  readonly hit: boolean;
  readonly t: number;
  readonly x: number;
  readonly y: number;
}

interface EnemyProfile {
  readonly width: number;
  readonly height: number;
  readonly mask: AlphaMask;
}

interface Rect {
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
}

interface RectMaskHit {
  readonly hit: boolean;
  readonly x: number;
  readonly y: number;
}

function rectLeft(rect: Rect): number {
  return rect.centerX - rect.width * 0.5;
}

function rectTop(rect: Rect): number {
  return rect.centerY - rect.height * 0.5;
}

function assertMask(mask: AlphaMask, context: string): void {
  if (!Number.isInteger(mask.width) || mask.width <= 0) {
    throw new Error(`${context}.width must be a positive integer, got ${String(mask.width)}.`);
  }
  if (!Number.isInteger(mask.height) || mask.height <= 0) {
    throw new Error(`${context}.height must be a positive integer, got ${String(mask.height)}.`);
  }
  const expectedSize = mask.width * mask.height;
  if (mask.alpha.length !== expectedSize) {
    throw new Error(
      `${context}.alpha length mismatch: expected ${expectedSize}, got ${String(mask.alpha.length)}.`
    );
  }
}

function enemyMaskIndex(enemyId: number): 0 | 1 | 2 | 3 {
  const row = Math.floor(enemyId / ENEMY_COLS);
  const normalized = ((row % 4) + 4) % 4;
  if (normalized === 0 || normalized === 1 || normalized === 2 || normalized === 3) {
    return normalized;
  }
  throw new Error(`Enemy mask index must be in [0, 3], got ${normalized}.`);
}

function enemyProfile(enemy: Enemy, runtime: CollisionRuntime): EnemyProfile {
  if (enemy.kind === 'normal') {
    const mask = runtime.enemySmallMasks[enemyMaskIndex(enemy.id)];
    if (mask === undefined) {
      throw new Error(`Small enemy mask is missing for enemy ${enemy.id}.`);
    }
    return {
      width: ENEMY_STANDARD_ACTIVE_WIDTH,
      height: ENEMY_STANDARD_ACTIVE_HEIGHT,
      mask
    };
  }

  if (enemy.kind === 'ufo') {
    return {
      width: ENEMY_UFO_ACTIVE_WIDTH,
      height: ENEMY_UFO_ACTIVE_HEIGHT,
      mask: runtime.enemyBig1Mask
    };
  }

  throw new Error('Unsupported enemy kind.');
}

function assertPositiveFinite(value: number, context: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${context} must be a positive finite number, got ${String(value)}.`);
  }

  return value;
}

function sweptRectBounds(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  sweptWidth: number,
  sweptHeight: number
): Rect {
  const width = assertPositiveFinite(sweptWidth, 'sweptWidth');
  const height = assertPositiveFinite(sweptHeight, 'sweptHeight');
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  const minY = Math.min(startY, endY);
  const maxY = Math.max(startY, endY);

  return {
    centerX: (minX + maxX) * 0.5,
    centerY: (minY + maxY) * 0.5,
    width: maxX - minX + width,
    height: maxY - minY + height
  };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  const aLeft = rectLeft(a);
  const aRight = aLeft + a.width;
  const aTop = rectTop(a);
  const aBottom = aTop + a.height;

  const bLeft = rectLeft(b);
  const bRight = bLeft + b.width;
  const bTop = rectTop(b);
  const bBottom = bTop + b.height;

  return aLeft <= bRight && aRight >= bLeft && aTop <= bBottom && aBottom >= bTop;
}

function firstMaskHitInWorldRect(
  mask: AlphaMask,
  rect: Rect,
  worldLeft: number,
  worldTop: number,
  worldRight: number,
  worldBottom: number
): RectMaskHit {
  const left = rectLeft(rect);
  const top = rectTop(rect);
  const right = left + rect.width;
  const bottom = top + rect.height;
  const overlapLeft = Math.max(worldLeft, left);
  const overlapRight = Math.min(worldRight, right);
  const overlapTop = Math.max(worldTop, top);
  const overlapBottom = Math.min(worldBottom, bottom);
  if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) {
    return {
      hit: false,
      x: worldLeft,
      y: worldTop
    };
  }

  const pixelMinX = Math.max(0, Math.floor(((overlapLeft - left) / rect.width) * mask.width));
  const pixelMaxX = Math.min(mask.width - 1, Math.ceil(((overlapRight - left) / rect.width) * mask.width) - 1);
  const pixelMinY = Math.max(0, Math.floor(((overlapTop - top) / rect.height) * mask.height));
  const pixelMaxY = Math.min(mask.height - 1, Math.ceil(((overlapBottom - top) / rect.height) * mask.height) - 1);
  if (pixelMinX > pixelMaxX || pixelMinY > pixelMaxY) {
    return {
      hit: false,
      x: worldLeft,
      y: worldTop
    };
  }

  for (let py = pixelMinY; py <= pixelMaxY; py += 1) {
    for (let px = pixelMinX; px <= pixelMaxX; px += 1) {
      if (mask.alpha[py * mask.width + px] !== 1) {
        continue;
      }

      return {
        hit: true,
        x: left + ((px + 0.5) / mask.width) * rect.width,
        y: top + ((py + 0.5) / mask.height) * rect.height
      };
    }
  }

  return {
    hit: false,
    x: overlapLeft,
    y: overlapTop
  };
}

function collideSegmentWithMask(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  rect: Rect,
  mask: AlphaMask,
  sweptWidth: number,
  sweptHeight: number
): SegmentMaskHit {
  const width = assertPositiveFinite(sweptWidth, 'sweptWidth');
  const height = assertPositiveFinite(sweptHeight, 'sweptHeight');
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.hypot(dx, dy) + Math.hypot(width * 0.5, height * 0.5);
  const steps = Math.max(1, Math.ceil(length * 1.6));
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = startX + dx * t;
    const y = startY + dy * t;
    const rectHit = firstMaskHitInWorldRect(
      mask,
      rect,
      x - halfWidth,
      y - halfHeight,
      x + halfWidth,
      y + halfHeight
    );
    if (!rectHit.hit) {
      continue;
    }

    return {
      hit: true,
      t,
      x: rectHit.x,
      y: rectHit.y
    };
  }

  return {
    hit: false,
    t: 1,
    x: endX,
    y: endY
  };
}

function pushBroadEnvelope(
  debugFrame: MutableCollisionDebugFrame | null,
  owner: 'player' | 'enemy',
  rect: Rect
): void {
  if (debugFrame === null) {
    return;
  }

  debugFrame.broadPhaseEnvelopes.push({
    centerX: rect.centerX,
    centerY: rect.centerY,
    width: rect.width,
    height: rect.height,
    owner
  });
}

function pushNarrowMarker(debugFrame: MutableCollisionDebugFrame | null, owner: 'player' | 'enemy', x: number, y: number): void {
  if (debugFrame === null) {
    return;
  }

  debugFrame.narrowPhaseMarkers.push({
    owner,
    x,
    y
  });
}

export function createAlphaMaskFromRgba(
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
  alphaThreshold = 1
): AlphaMask {
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error(`Mask width must be a positive integer, got ${String(width)}.`);
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new Error(`Mask height must be a positive integer, got ${String(height)}.`);
  }
  if (!Number.isFinite(alphaThreshold) || alphaThreshold < 0 || alphaThreshold > 255) {
    throw new Error(`alphaThreshold must be in [0, 255], got ${String(alphaThreshold)}.`);
  }
  const expectedRgbaLength = width * height * 4;
  if (rgba.length !== expectedRgbaLength) {
    throw new Error(`RGBA length mismatch: expected ${expectedRgbaLength}, got ${String(rgba.length)}.`);
  }

  const alpha = new Uint8Array(width * height);
  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = rgba[index * 4 + 3] >= alphaThreshold ? 1 : 0;
  }

  return {
    width,
    height,
    alpha
  };
}

export function mergeAlphaMasks(a: AlphaMask, b: AlphaMask): AlphaMask {
  assertMask(a, 'mergeAlphaMasks.a');
  assertMask(b, 'mergeAlphaMasks.b');
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `mergeAlphaMasks requires equal dimensions, got ${a.width}x${a.height} and ${b.width}x${b.height}.`
    );
  }

  const alpha = new Uint8Array(a.alpha.length);
  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = a.alpha[index] === 1 || b.alpha[index] === 1 ? 1 : 0;
  }

  return {
    width: a.width,
    height: a.height,
    alpha
  };
}

export function createFilledAlphaMask(width: number, height: number): AlphaMask {
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error(`Filled mask width must be a positive integer, got ${String(width)}.`);
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new Error(`Filled mask height must be a positive integer, got ${String(height)}.`);
  }

  return {
    width,
    height,
    alpha: new Uint8Array(width * height).fill(1)
  };
}

export function createCollisionRuntime(runtime: CollisionRuntime): CollisionRuntime {
  assertMask(runtime.playerMask, 'collisionRuntime.playerMask');
  const smallMasks = runtime.enemySmallMasks;
  if (smallMasks.length !== 4) {
    throw new Error(`collisionRuntime.enemySmallMasks must have 4 entries, got ${String(smallMasks.length)}.`);
  }
  assertMask(smallMasks[0], 'collisionRuntime.enemySmallMasks[0]');
  assertMask(smallMasks[1], 'collisionRuntime.enemySmallMasks[1]');
  assertMask(smallMasks[2], 'collisionRuntime.enemySmallMasks[2]');
  assertMask(smallMasks[3], 'collisionRuntime.enemySmallMasks[3]');
  assertMask(runtime.enemyBig1Mask, 'collisionRuntime.enemyBig1Mask');
  return runtime;
}

export function createEmptyCollisionDebugFrame(): CollisionDebugFrame {
  return {
    broadPhaseEnvelopes: [],
    narrowPhaseMarkers: []
  };
}

export function createMutableCollisionDebugFrame(enabled: boolean): MutableCollisionDebugFrame | null {
  if (!enabled) {
    return null;
  }

  return {
    broadPhaseEnvelopes: [],
    narrowPhaseMarkers: []
  };
}

export function freezeCollisionDebugFrame(
  debugFrame: MutableCollisionDebugFrame | null
): CollisionDebugFrame {
  if (debugFrame === null) {
    return createEmptyCollisionDebugFrame();
  }

  return {
    broadPhaseEnvelopes: debugFrame.broadPhaseEnvelopes,
    narrowPhaseMarkers: debugFrame.narrowPhaseMarkers
  };
}

export function enemyActiveHeight(kind: Enemy['kind']): number {
  if (kind === 'normal') {
    return ENEMY_STANDARD_ACTIVE_HEIGHT;
  }
  if (kind === 'ufo') {
    return ENEMY_UFO_ACTIVE_HEIGHT;
  }
  throw new Error('Unsupported enemy kind for active height.');
}

export function playerActiveHeight(): number {
  return PLAYER_ACTIVE_HEIGHT;
}

export function collidePlayerBulletWithEnemy(
  runtime: CollisionRuntime,
  enemy: Enemy,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  bulletWidth: number,
  bulletHeight: number,
  debugFrame: MutableCollisionDebugFrame | null
): SegmentMaskHit {
  const profile = enemyProfile(enemy, runtime);
  const targetRect: Rect = {
    centerX: enemy.x,
    centerY: enemy.y,
      width: profile.width,
      height: profile.height
  };
  const segmentRect = sweptRectBounds(startX, startY, endX, endY, bulletWidth, bulletHeight);
  if (!rectsOverlap(targetRect, segmentRect)) {
    return {
      hit: false,
      t: 1,
      x: endX,
      y: endY
    };
  }

  pushBroadEnvelope(debugFrame, 'player', targetRect);
  const hit = collideSegmentWithMask(startX, startY, endX, endY, targetRect, profile.mask, bulletWidth, bulletHeight);
  if (hit.hit) {
    pushNarrowMarker(debugFrame, 'player', hit.x, hit.y);
  }
  return hit;
}

export function collideEnemyBulletWithPlayer(
  runtime: CollisionRuntime,
  playerX: number,
  playerY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  bulletWidth: number,
  bulletHeight: number,
  debugFrame: MutableCollisionDebugFrame | null
): SegmentMaskHit {
  const targetRect: Rect = {
    centerX: playerX,
    centerY: playerY,
      width: PLAYER_ACTIVE_WIDTH,
      height: PLAYER_ACTIVE_HEIGHT
  };
  const segmentRect = sweptRectBounds(startX, startY, endX, endY, bulletWidth, bulletHeight);
  if (!rectsOverlap(targetRect, segmentRect)) {
    return {
      hit: false,
      t: 1,
      x: endX,
      y: endY
    };
  }

  pushBroadEnvelope(debugFrame, 'enemy', targetRect);
  const hit = collideSegmentWithMask(startX, startY, endX, endY, targetRect, runtime.playerMask, bulletWidth, bulletHeight);
  if (hit.hit) {
    pushNarrowMarker(debugFrame, 'enemy', hit.x, hit.y);
  }
  return hit;
}
