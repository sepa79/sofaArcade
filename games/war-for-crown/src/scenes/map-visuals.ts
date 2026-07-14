import type Phaser from 'phaser';

import type { TerrainId } from '../game/types';

export interface MapVisualRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MapVisualPoint {
  readonly x: number;
  readonly y: number;
}

export interface ProvinceBadgeLayout {
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
  readonly soldierIconWidth: number;
  readonly soldierIconHeight: number;
  readonly soldierIconOffsetX: number;
  readonly soldierCountOffsetX: number;
  readonly villageIconOffsetX: number;
  readonly villageCountOffsetX: number;
}

export const WAR_FOR_CROWN_MAP_SKIN = {
  water: {
    base: 0x19375f,
    deep: 0x102844,
    wave: 0x7ba6c5
  },
  terrain: {
    dark: 0x172019,
    light: 0xd8e0bf,
    snow: 0xf1f3ed,
    rock: 0x4f5960,
    reed: 0xb9cfaa,
    sand: 0x8f6c32
  },
  border: {
    shadow: 0x090b0b,
    stone: 0x86918c,
    joint: 0x303937
  },
  badge: {
    background: 0x071012,
    outline: 0xc6b486,
    text: '#fff4d4',
    neutral: 0xb9ae87,
    village: 0xe3c36a,
    soldiers: 0xd9e4df
  },
  ownerTintAlpha: 0.12
} as const;

function line(
  graphics: Phaser.GameObjects.Graphics,
  color: number,
  alpha: number,
  width: number,
  from: MapVisualPoint,
  to: MapVisualPoint
): void {
  graphics.lineStyle(width, color, alpha);
  graphics.lineBetween(from.x, from.y, to.x, to.y);
}

export function drawWaterTile(
  graphics: Phaser.GameObjects.Graphics,
  rect: MapVisualRect,
  gridX: number,
  gridY: number
): void {
  graphics.fillStyle(WAR_FOR_CROWN_MAP_SKIN.water.base, 1);
  graphics.fillRect(rect.x, rect.y, rect.width, rect.height);
  graphics.fillStyle(WAR_FOR_CROWN_MAP_SKIN.water.deep, 0.18);
  graphics.fillRect(rect.x, rect.y + rect.height * 0.52, rect.width, rect.height * 0.48);

  const phase = ((gridX + gridY) % 2) * rect.width * 0.16;
  for (let row = 0; row < 3; row += 1) {
    const y = rect.y + rect.height * (0.24 + row * 0.24);
    const x = rect.x - phase;
    line(
      graphics,
      WAR_FOR_CROWN_MAP_SKIN.water.wave,
      0.34,
      1,
      { x, y },
      { x: x + rect.width * 0.38, y: y - rect.height * 0.06 }
    );
    line(
      graphics,
      WAR_FOR_CROWN_MAP_SKIN.water.wave,
      0.34,
      1,
      { x: x + rect.width * 0.48, y },
      { x: x + rect.width * 0.86, y: y - rect.height * 0.06 }
    );
  }
}

export function drawTerrainTile(
  graphics: Phaser.GameObjects.Graphics,
  rect: MapVisualRect,
  terrainId: TerrainId,
  baseColor: number,
  gridX: number,
  gridY: number
): void {
  graphics.fillStyle(baseColor, 1);
  graphics.fillRect(rect.x, rect.y, rect.width, rect.height);
  graphics.fillStyle(WAR_FOR_CROWN_MAP_SKIN.terrain.dark, 0.08);
  graphics.fillRect(rect.x, rect.y + rect.height * 0.58, rect.width, rect.height * 0.42);

  const alternate = (gridX + gridY) % 2 === 0;
  const offset = alternate ? 0 : rect.width * 0.12;

  switch (terrainId) {
    case 'plains':
      for (let row = 0; row < 3; row += 1) {
        const y = rect.y + rect.height * (0.25 + row * 0.23);
        line(graphics, WAR_FOR_CROWN_MAP_SKIN.terrain.light, 0.23, 2, { x: rect.x + rect.width * 0.16 + offset, y }, { x: rect.x + rect.width * 0.43 + offset, y });
        line(graphics, WAR_FOR_CROWN_MAP_SKIN.terrain.light, 0.18, 1, { x: rect.x + rect.width * 0.58 - offset, y: y + 3 }, { x: rect.x + rect.width * 0.8 - offset, y: y + 3 });
      }
      return;
    case 'brushland':
      graphics.fillStyle(WAR_FOR_CROWN_MAP_SKIN.terrain.dark, 0.32);
      for (let index = 0; index < 5; index += 1) {
        const x = rect.x + rect.width * (0.18 + (index % 3) * 0.25) + offset * 0.3;
        const y = rect.y + rect.height * (0.28 + Math.floor(index / 3) * 0.34);
        graphics.fillCircle(x, y, 2.4);
        line(graphics, WAR_FOR_CROWN_MAP_SKIN.terrain.dark, 0.28, 1, { x: x - 3, y: y + 6 }, { x: x + 4, y: y + 1 });
      }
      return;
    case 'desert':
      for (let row = 0; row < 3; row += 1) {
        const y = rect.y + rect.height * (0.28 + row * 0.23);
        line(graphics, WAR_FOR_CROWN_MAP_SKIN.terrain.sand, 0.42, 1, { x: rect.x + rect.width * 0.12 + offset, y }, { x: rect.x + rect.width * 0.38 + offset, y: y - 3 });
        line(graphics, WAR_FOR_CROWN_MAP_SKIN.terrain.sand, 0.34, 1, { x: rect.x + rect.width * 0.54 - offset, y: y + 2 }, { x: rect.x + rect.width * 0.84 - offset, y });
      }
      return;
    case 'marshland':
      for (let row = 0; row < 3; row += 1) {
        const y = rect.y + rect.height * (0.3 + row * 0.22);
        line(graphics, WAR_FOR_CROWN_MAP_SKIN.water.wave, 0.36, 2, { x: rect.x + rect.width * 0.12, y }, { x: rect.x + rect.width * 0.52, y });
        line(graphics, WAR_FOR_CROWN_MAP_SKIN.water.wave, 0.28, 1, { x: rect.x + rect.width * 0.64, y: y + 3 }, { x: rect.x + rect.width * 0.88, y: y + 3 });
      }
      line(graphics, WAR_FOR_CROWN_MAP_SKIN.terrain.reed, 0.5, 1, { x: rect.x + rect.width * 0.66, y: rect.y + rect.height * 0.76 }, { x: rect.x + rect.width * 0.66, y: rect.y + rect.height * 0.4 });
      line(graphics, WAR_FOR_CROWN_MAP_SKIN.terrain.reed, 0.5, 1, { x: rect.x + rect.width * 0.66, y: rect.y + rect.height * 0.5 }, { x: rect.x + rect.width * 0.75, y: rect.y + rect.height * 0.38 });
      return;
    case 'forest':
      for (let index = 0; index < 4; index += 1) {
        const x = rect.x + rect.width * (0.2 + (index % 2) * 0.42) + offset * 0.25;
        const y = rect.y + rect.height * (0.27 + Math.floor(index / 2) * 0.4);
        graphics.fillStyle(WAR_FOR_CROWN_MAP_SKIN.terrain.dark, 0.5);
        graphics.fillTriangle(x, y - 7, x - 6, y + 3, x + 6, y + 3);
        graphics.fillTriangle(x, y - 2, x - 7, y + 9, x + 7, y + 9);
        graphics.fillRect(x - 1, y + 8, 2, 5);
      }
      return;
    case 'hills':
      for (let row = 0; row < 2; row += 1) {
        const y = rect.y + rect.height * (0.42 + row * 0.3);
        line(graphics, WAR_FOR_CROWN_MAP_SKIN.terrain.dark, 0.34, 2, { x: rect.x + rect.width * 0.08, y }, { x: rect.x + rect.width * 0.3, y: y - 8 });
        line(graphics, WAR_FOR_CROWN_MAP_SKIN.terrain.dark, 0.34, 2, { x: rect.x + rect.width * 0.3, y: y - 8 }, { x: rect.x + rect.width * 0.51, y });
        line(graphics, WAR_FOR_CROWN_MAP_SKIN.terrain.dark, 0.27, 1, { x: rect.x + rect.width * 0.5, y: y + 2 }, { x: rect.x + rect.width * 0.7, y: y - 5 });
        line(graphics, WAR_FOR_CROWN_MAP_SKIN.terrain.dark, 0.27, 1, { x: rect.x + rect.width * 0.7, y: y - 5 }, { x: rect.x + rect.width * 0.88, y: y + 2 });
      }
      return;
    case 'mountains':
      graphics.fillStyle(WAR_FOR_CROWN_MAP_SKIN.terrain.rock, 0.72);
      graphics.fillTriangle(rect.x + rect.width * 0.04, rect.y + rect.height * 0.82, rect.x + rect.width * 0.34, rect.y + rect.height * 0.16, rect.x + rect.width * 0.64, rect.y + rect.height * 0.82);
      graphics.fillTriangle(rect.x + rect.width * 0.38, rect.y + rect.height * 0.84, rect.x + rect.width * 0.69, rect.y + rect.height * 0.28, rect.x + rect.width * 0.94, rect.y + rect.height * 0.84);
      graphics.fillStyle(WAR_FOR_CROWN_MAP_SKIN.terrain.snow, 0.82);
      graphics.fillTriangle(rect.x + rect.width * 0.25, rect.y + rect.height * 0.36, rect.x + rect.width * 0.34, rect.y + rect.height * 0.16, rect.x + rect.width * 0.43, rect.y + rect.height * 0.36);
      graphics.fillTriangle(rect.x + rect.width * 0.61, rect.y + rect.height * 0.43, rect.x + rect.width * 0.69, rect.y + rect.height * 0.28, rect.x + rect.width * 0.77, rect.y + rect.height * 0.43);
      return;
    default:
      terrainId satisfies never;
      throw new Error('Unhandled map terrain visual.');
  }
}

export function drawStoneBoundary(
  graphics: Phaser.GameObjects.Graphics,
  from: MapVisualPoint,
  to: MapVisualPoint
): void {
  line(graphics, WAR_FOR_CROWN_MAP_SKIN.border.shadow, 0.95, 5, from, to);
  line(graphics, WAR_FOR_CROWN_MAP_SKIN.border.stone, 0.82, 2, from, to);

  const vertical = from.x === to.x;
  const length = vertical ? Math.abs(to.y - from.y) : Math.abs(to.x - from.x);
  const direction = vertical
    ? Math.sign(to.y - from.y)
    : Math.sign(to.x - from.x);
  for (let distance = 10; distance < length; distance += 14) {
    const x = vertical ? from.x : from.x + distance * direction;
    const y = vertical ? from.y + distance * direction : from.y;
    if (vertical) {
      line(graphics, WAR_FOR_CROWN_MAP_SKIN.border.joint, 0.95, 1, { x: x - 2, y }, { x: x + 2, y });
    } else {
      line(graphics, WAR_FOR_CROWN_MAP_SKIN.border.joint, 0.95, 1, { x, y: y - 2 }, { x, y: y + 2 });
    }
  }
}

export function createProvinceBadgeLayout(
  tileWidth: number,
  tileHeight: number
): ProvinceBadgeLayout {
  if (!Number.isFinite(tileWidth) || tileWidth <= 0 || !Number.isFinite(tileHeight) || tileHeight <= 0) {
    throw new Error(`Province badge requires positive finite tile dimensions, received ${tileWidth}x${tileHeight}.`);
  }

  const width = Math.min(52, tileWidth - 6);
  const height = Math.min(19, tileHeight - 8);
  if (width < 32 || height < 14) {
    throw new Error(`Province badge cannot fit inside a ${tileWidth}x${tileHeight} tile.`);
  }

  const compact = width < 40;
  return {
    width,
    height,
    fontSize: compact ? 8 : 10,
    soldierIconWidth: compact ? 7 : 11,
    soldierIconHeight: compact ? 6 : 9,
    soldierIconOffsetX: width * -0.38,
    soldierCountOffsetX: width * -0.13,
    villageIconOffsetX: width * 0.13,
    villageCountOffsetX: width * 0.38
  };
}

export function drawProvinceBadge(
  graphics: Phaser.GameObjects.Graphics,
  center: MapVisualPoint,
  ownerColor: number | null,
  layout: ProvinceBadgeLayout
): void {
  const x = center.x - layout.width / 2;
  const y = center.y - layout.height / 2;
  graphics.fillStyle(WAR_FOR_CROWN_MAP_SKIN.badge.background, 0.68);
  graphics.fillRoundedRect(x, y, layout.width, layout.height, 5);
  graphics.lineStyle(
    1,
    ownerColor ?? WAR_FOR_CROWN_MAP_SKIN.badge.outline,
    ownerColor === null ? 0.46 : 0.9
  );
  graphics.strokeRoundedRect(x, y, layout.width, layout.height, 5);

  const villageScale = layout.soldierIconHeight / 9;
  const villageX = center.x + layout.villageIconOffsetX;
  graphics.fillStyle(WAR_FOR_CROWN_MAP_SKIN.badge.village, 0.92);
  graphics.fillTriangle(
    villageX - 5 * villageScale,
    center.y - villageScale,
    villageX,
    center.y - 6 * villageScale,
    villageX + 5 * villageScale,
    center.y - villageScale
  );
  graphics.fillRect(
    villageX - 3 * villageScale,
    center.y - villageScale,
    6 * villageScale,
    6 * villageScale
  );
}

export function drawCrownMarker(
  graphics: Phaser.GameObjects.Graphics,
  center: MapVisualPoint,
  color: number
): void {
  const y = center.y - 17;
  graphics.fillStyle(color, 0.96);
  graphics.fillTriangle(center.x - 8, y + 6, center.x - 7, y - 1, center.x - 2, y + 4);
  graphics.fillTriangle(center.x - 3, y + 5, center.x, y - 3, center.x + 3, y + 5);
  graphics.fillTriangle(center.x + 2, y + 4, center.x + 7, y - 1, center.x + 8, y + 6);
  graphics.fillRect(center.x - 8, y + 5, 16, 4);
}

export function drawFortificationMarker(
  graphics: Phaser.GameObjects.Graphics,
  center: MapVisualPoint,
  tier: number
): void {
  if (!Number.isInteger(tier) || tier < 1) {
    throw new Error(`Fortification visual tier must be a positive integer, received ${tier}.`);
  }

  const width = Math.min(12 + tier * 1.5, 21);
  const height = Math.min(9 + tier, 15);
  const x = center.x - width / 2;
  const y = center.y - 29;
  const towerWidth = Math.max(4, width * 0.24);

  graphics.fillStyle(WAR_FOR_CROWN_MAP_SKIN.badge.background, 0.78);
  graphics.fillRect(x - 2, y - 2, width + 4, height + 4);
  graphics.fillStyle(WAR_FOR_CROWN_MAP_SKIN.border.stone, 0.96);
  graphics.fillRect(x, y + height * 0.34, width, height * 0.66);
  graphics.fillRect(x, y, towerWidth, height);
  if (tier >= 3) {
    graphics.fillRect(x + width - towerWidth, y, towerWidth, height);
  }
  graphics.fillStyle(WAR_FOR_CROWN_MAP_SKIN.badge.background, 0.9);
  graphics.fillRect(center.x - 1.5, y + height * 0.62, 3, height * 0.38);
  graphics.lineStyle(1, WAR_FOR_CROWN_MAP_SKIN.badge.outline, 0.8);
  graphics.strokeRect(x, y + height * 0.34, width, height * 0.66);
}
