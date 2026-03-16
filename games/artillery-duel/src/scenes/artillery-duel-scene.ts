import Phaser from 'phaser';
import orbitronFontUrl from '../../../pixel-invaders/src/assets/fonts/Orbitron[wght].ttf';

import {
  FOREGROUND_HEIGHT,
  FOREGROUND_WORLD_UNITS_PER_PIXEL,
  FOREGROUND_WIDTH,
  PROJECTILE_RADIUS,
  PROJECTILE_TRAIL_LENGTH,
  TANK_TURRET_LENGTH,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from '../game/constants';
import { createInputContext, readFrameInput, type InputContext } from '../game/input';
import { stepGame } from '../game/logic';
import { createInitialState } from '../game/state';
import { sampleTerrainHeight } from '../game/terrain';
import type { GameState, MatchMode } from '../game/types';

export const ARTILLERY_DUEL_SCENE_KEY = 'artillery-duel';

export interface ArtilleryDuelSceneData {
  readonly controllerProfileId: string;
  readonly controllerLabel: string;
  readonly audioMixProfileId: 'arcade' | 'cinema' | 'late-night';
  readonly matchMode: MatchMode;
}

interface ViewportLayout {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

interface TrailPoint {
  readonly x: number;
  readonly y: number;
}

const HUD_TEXT_COLOR = '#e4f4ff';
const HUD_FONT_FAMILY = 'Orbitron';
const FOREGROUND_TEXTURE_KEY = 'artillery-duel-foreground';
const TERRAIN_HIGHLIGHT_COLOR = '#e5c18e';
const TERRAIN_LIGHT_COLOR = '#dcb07a';
const TERRAIN_MID_COLOR = '#a97649';
const TERRAIN_DARK_COLOR = '#6a4730';
const TERRAIN_DEEP_SHADOW_COLOR = '#442b26';
const TERRAIN_OUTLINE_COLOR = '#2a193a';
const TREE_LEAF_LIGHT_COLOR = '#98f45d';
const TREE_LEAF_DARK_COLOR = '#4e9b3f';
const TREE_TRUNK_COLOR = '#3b2530';
const PROJECTILE_SHADOW_COLOR = '#2b1655';
const PROJECTILE_CORE_COLOR = '#fff39b';
const EXPLOSION_OUTER_COLOR = '#ffbf6b';
const EXPLOSION_INNER_COLOR = '#fff0bb';
const AIM_GUIDE_COLOR = 'rgba(255, 255, 255, 0.78)';
const TREE_PATTERNS = [
  ['...1...', '..111..', '.12221.', '1222221', '..343..', '..343..'],
  ['....1....', '...111...', '..12221..', '.1222221.', '122222221', '...343...', '...343...'],
  ['...1...', '..121..', '.12221.', '..232..', '.12321.', '..343..', '..343..']
] as const;
const PLAYER_TANK_PATTERNS = [
  ['..1111..', '.122221.', '13333331', '.444444.', '..5555..'],
  ['..1111..', '.122221.', '16666661', '.444444.', '..5555..']
] as const;
const PLAYER_TANK_PALETTES = [
  ['#f7d8aa', '#d79553', '#ba7b46', '#3b244f', '#8bf25c'],
  ['#d7ffff', '#7fd4ec', '#57a7c7', '#3b244f', '#8bf25c']
] as const;
let hudFontLoadPromise: Promise<void> | null = null;

function requireCanvasContext(texture: Phaser.Textures.CanvasTexture): CanvasRenderingContext2D {
  const context = texture.getContext();
  if (context === null) {
    throw new Error('Artillery Duel foreground texture requires a 2D canvas context.');
  }

  return context;
}

function requireDocumentFonts(): FontFaceSet {
  if (typeof document === 'undefined' || document.fonts === undefined) {
    throw new Error('Artillery Duel fonts require document.fonts support.');
  }

  return document.fonts;
}

async function ensureHudFontLoaded(): Promise<void> {
  if (hudFontLoadPromise !== null) {
    return hudFontLoadPromise;
  }

  hudFontLoadPromise = (async () => {
    const fontFace = new FontFace(HUD_FONT_FAMILY, `url(${orbitronFontUrl}) format("truetype")`, {
      style: 'normal',
      weight: '600'
    });
    const loadedFont = await fontFace.load();
    const fontSet = requireDocumentFonts();
    fontSet.add(loadedFont);
    await fontSet.load(`600 16px "${HUD_FONT_FAMILY}"`);
  })();

  return hudFontLoadPromise;
}

function parseSceneData(rawData: unknown): ArtilleryDuelSceneData {
  if (typeof rawData !== 'object' || rawData === null) {
    throw new Error('Artillery Duel scene requires launch data object.');
  }

  const data = rawData as Record<string, unknown>;
  if (typeof data.controllerProfileId !== 'string' || data.controllerProfileId.trim().length === 0) {
    throw new Error('Artillery Duel scene requires a valid controllerProfileId.');
  }
  if (typeof data.controllerLabel !== 'string' || data.controllerLabel.trim().length === 0) {
    throw new Error('Artillery Duel scene requires a valid controllerLabel.');
  }
  if (
    data.audioMixProfileId !== 'arcade' &&
    data.audioMixProfileId !== 'cinema' &&
    data.audioMixProfileId !== 'late-night'
  ) {
    throw new Error('Artillery Duel scene requires a valid audioMixProfileId.');
  }
  if (data.matchMode !== 'solo-ai' && data.matchMode !== 'hotseat-2p') {
    throw new Error('Artillery Duel scene requires a valid matchMode.');
  }

  return {
    controllerProfileId: data.controllerProfileId,
    controllerLabel: data.controllerLabel,
    audioMixProfileId: data.audioMixProfileId,
    matchMode: data.matchMode
  };
}

function worldToScreenX(layout: ViewportLayout, x: number): number {
  return layout.offsetX + x * layout.scale;
}

function worldToScreenY(layout: ViewportLayout, y: number): number {
  return layout.offsetY + y * layout.scale;
}

function worldToForegroundX(x: number): number {
  return Math.round(x / FOREGROUND_WORLD_UNITS_PER_PIXEL);
}

function worldToForegroundY(y: number): number {
  return Math.round(y / FOREGROUND_WORLD_UNITS_PER_PIXEL);
}

function createLayout(width: number, height: number): ViewportLayout {
  const scale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
  return {
    scale,
    offsetX: Math.floor((width - WORLD_WIDTH * scale) / 2),
    offsetY: Math.floor((height - WORLD_HEIGHT * scale) / 2)
  };
}

function phaseMessage(state: GameState): string {
  if (state.phase === 'ready') {
    return state.mode === 'solo-ai' ? 'SOLO VS CPU\nPRESS FIRE' : 'HOTSEAT DUEL\nPRESS FIRE';
  }

  if (state.phase === 'won') {
    const winner = state.players[state.winnerIndex ?? 0];
    return `${winner.label} WINS\nPRESS FIRE`;
  }

  const active = state.players[state.activePlayerIndex];
  if (state.phase === 'projectile') {
    return `${active.label} SHOT`;
  }

  if (active.isCpu) {
    return 'CPU IS AIMING';
  }

  return `${active.label} TURN`;
}

export class ArtilleryDuelScene extends Phaser.Scene {
  private state!: GameState;
  private inputContext!: InputContext;
  private graphics!: Phaser.GameObjects.Graphics;
  private foregroundContext!: CanvasRenderingContext2D;
  private foregroundImage!: Phaser.GameObjects.Image;
  private leftHudText!: Phaser.GameObjects.Text;
  private rightHudText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private launchData!: ArtilleryDuelSceneData;
  private projectileTrail: TrailPoint[] = [];
  private readonly onResize = (): void => {
    this.renderScene();
  };

  constructor() {
    super(ARTILLERY_DUEL_SCENE_KEY);
  }

  create(rawData: unknown): void {
    this.launchData = parseSceneData(rawData);
    this.state = createInitialState(this.launchData.matchMode);
    this.inputContext = createInputContext(this, this.launchData.controllerProfileId);
    void ensureHudFontLoaded();

    this.cameras.main.setBackgroundColor('#6b90ff');
    this.graphics = this.add.graphics();
    if (this.textures.exists(FOREGROUND_TEXTURE_KEY)) {
      this.textures.remove(FOREGROUND_TEXTURE_KEY);
    }
    const foregroundTexture = this.textures.createCanvas(FOREGROUND_TEXTURE_KEY, FOREGROUND_WIDTH, FOREGROUND_HEIGHT);
    if (foregroundTexture === null) {
      throw new Error('Artillery Duel failed to create foreground canvas texture.');
    }
    foregroundTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.foregroundContext = requireCanvasContext(foregroundTexture);
    this.foregroundContext.imageSmoothingEnabled = false;
    this.foregroundImage = this.add.image(0, 0, FOREGROUND_TEXTURE_KEY).setOrigin(0, 0);
    this.leftHudText = this.add.text(0, 0, '', {
      fontFamily: HUD_FONT_FAMILY,
      fontSize: '14px',
      color: HUD_TEXT_COLOR
    });
    this.rightHudText = this.add.text(0, 0, '', {
      fontFamily: HUD_FONT_FAMILY,
      fontSize: '12px',
      color: HUD_TEXT_COLOR,
      align: 'right'
    });
    this.bannerText = this.add.text(0, 0, '', {
      fontFamily: HUD_FONT_FAMILY,
      fontSize: '16px',
      align: 'center',
      color: '#fff39b'
    }).setOrigin(0.5, 0.5);
    this.leftHudText.setShadow(1, 1, '#0b1128', 0);
    this.rightHudText.setShadow(1, 1, '#0b1128', 0);
    this.bannerText.setShadow(2, 2, '#0b1128', 0);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
      this.textures.remove(FOREGROUND_TEXTURE_KEY);
    });

    this.renderScene();
  }

  update(_: number, deltaMs: number): void {
    const input = readFrameInput(this.inputContext);
    const deltaSec = Math.min(0.05, deltaMs / 1000);
    this.state = stepGame(this.state, input, deltaSec);
    this.updateProjectileTrail();
    this.renderScene();
  }

  private renderScene(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const layout = createLayout(width, height);
    const left = worldToScreenX(layout, 0);
    const right = worldToScreenX(layout, WORLD_WIDTH);

    this.graphics.clear();
    this.graphics.fillStyle(0x6b90ff);
    this.graphics.fillRect(0, 0, width, height);
    this.drawBackdrop(layout);
    this.renderForeground();
    this.foregroundImage.setPosition(layout.offsetX, layout.offsetY);
    this.foregroundImage.setDisplaySize(WORLD_WIDTH * layout.scale, WORLD_HEIGHT * layout.scale);

    this.leftHudText.setPosition(left + 8, worldToScreenY(layout, 6));
    this.rightHudText.setPosition(right - 8, worldToScreenY(layout, 6)).setOrigin(1, 0);
    this.bannerText.setPosition(width / 2, worldToScreenY(layout, 16));
    const playerOne = this.state.players[0];
    const playerTwo = this.state.players[1];
    this.leftHudText.setText(
      `PLAYER 1\nANGLE ${playerOne.angleDeg.toFixed(0)}\nPOWER ${playerOne.power.toFixed(0)}`
    );
    this.rightHudText.setText(
      `${playerTwo.label}\nANGLE ${playerTwo.angleDeg.toFixed(0)}\nPOWER ${playerTwo.power.toFixed(0)}`
    );
    this.bannerText.setText(phaseMessage(this.state));
    this.bannerText.setVisible(this.state.phase !== 'projectile');
  }

  private renderForeground(): void {
    const context = this.foregroundContext;
    context.clearRect(0, 0, FOREGROUND_WIDTH, FOREGROUND_HEIGHT);
    this.drawForegroundTerrain(context);
    this.drawForegroundPlayers(context);
    this.drawForegroundProjectileTrail(context);
    this.drawForegroundProjectile(context);
    this.drawForegroundExplosion(context);
    this.drawForegroundAimGuide(context);
    const texture = this.textures.get(FOREGROUND_TEXTURE_KEY);
    if (!(texture instanceof Phaser.Textures.CanvasTexture)) {
      throw new Error('Artillery Duel foreground texture key resolved to a non-canvas texture.');
    }
    texture.refresh();
  }

  private drawForegroundTerrain(context: CanvasRenderingContext2D): void {
    const bottomY = FOREGROUND_HEIGHT;
    const tankColumns = this.state.players.map((player) => worldToForegroundX(player.tankX));
    const terrainColumns = Array.from({ length: FOREGROUND_WIDTH }, (_, column) => {
      const worldX = Math.min(
        WORLD_WIDTH,
        column * FOREGROUND_WORLD_UNITS_PER_PIXEL + FOREGROUND_WORLD_UNITS_PER_PIXEL / 2
      );
      return Phaser.Math.Clamp(worldToForegroundY(sampleTerrainHeight(this.state.terrain, worldX)), 0, bottomY - 1);
    });
    const broadShadowTop = terrainColumns.map((terrainY, column) => {
      const castFromLeft = terrainColumns[Math.max(0, column - 22)] + 12;
      return Phaser.Math.Clamp(Math.max(terrainY + 8, castFromLeft), terrainY + 4, bottomY);
    });
    const deepShadowTop = terrainColumns.map((terrainY, column) => {
      const castFromLeft = terrainColumns[Math.max(0, column - 40)] + 24;
      return Phaser.Math.Clamp(Math.max(terrainY + 20, castFromLeft), terrainY + 12, bottomY);
    });

    for (let column = 0; column < FOREGROUND_WIDTH; column += 1) {
      const terrainY = terrainColumns[column];
      const shadowTop = broadShadowTop[column];
      const deepTop = deepShadowTop[column];
      const ridgeBottom = Math.min(bottomY, terrainY + 2);
      const lowerRidgeBottom = Math.min(bottomY, terrainY + 5);

      for (let y = terrainY; y < bottomY; y += 1) {
        if (y === terrainY) {
          context.fillStyle = TERRAIN_OUTLINE_COLOR;
        } else if (y < ridgeBottom) {
          context.fillStyle = TERRAIN_HIGHLIGHT_COLOR;
        } else if (y < lowerRidgeBottom) {
          context.fillStyle = TERRAIN_LIGHT_COLOR;
        } else if (y < shadowTop) {
          context.fillStyle = TERRAIN_LIGHT_COLOR;
        } else if (y < deepTop) {
          context.fillStyle = TERRAIN_MID_COLOR;
        } else if (y < bottomY - 6) {
          context.fillStyle = TERRAIN_DARK_COLOR;
        } else {
          context.fillStyle = TERRAIN_DEEP_SHADOW_COLOR;
        }
        context.fillRect(column, y, 1, 1);
      }
    }

    for (let worldX = 20; worldX <= WORLD_WIDTH - 20; worldX += 24) {
      const treeX = worldToForegroundX(worldX);
      if (tankColumns.some((tankColumn) => Math.abs(treeX - tankColumn) < 12)) {
        continue;
      }
      const treeY = worldToForegroundY(sampleTerrainHeight(this.state.terrain, worldX)) - 1;
      const variant = Math.floor(worldX / 24) % TREE_PATTERNS.length;
      this.drawForegroundTree(context, treeX, treeY, variant);
    }
  }

  private drawForegroundPlayers(context: CanvasRenderingContext2D): void {
    for (const player of this.state.players) {
      this.drawForegroundTank(context, player);
    }
  }

  private drawForegroundProjectileTrail(context: CanvasRenderingContext2D): void {
    for (let index = 0; index < this.projectileTrail.length; index += 1) {
      const point = this.projectileTrail[index];
      const alpha = (index + 1) / this.projectileTrail.length;
      context.fillStyle = `rgba(255, 255, 255, ${0.18 + alpha * 0.42})`;
      context.fillRect(worldToForegroundX(point.x), worldToForegroundY(point.y), 1, 1);
    }
  }

  private drawForegroundProjectile(context: CanvasRenderingContext2D): void {
    if (this.state.projectile === null) {
      return;
    }

    const x = worldToForegroundX(this.state.projectile.x);
    const y = worldToForegroundY(this.state.projectile.y);
    const radius = Math.max(1, Math.round(PROJECTILE_RADIUS / FOREGROUND_WORLD_UNITS_PER_PIXEL));
    context.fillStyle = PROJECTILE_SHADOW_COLOR;
    context.fillRect(x - radius, y - radius, radius * 2 + 1, radius * 2 + 1);
    context.fillStyle = PROJECTILE_CORE_COLOR;
    context.fillRect(x, y, 1, 1);
    if (radius > 1) {
      context.fillRect(x - 1, y, 1, 1);
      context.fillRect(x + 1, y, 1, 1);
      context.fillRect(x, y - 1, 1, 1);
      context.fillRect(x, y + 1, 1, 1);
    }
  }

  private drawForegroundExplosion(context: CanvasRenderingContext2D): void {
    if (this.state.explosion === null) {
      return;
    }

    const centerX = worldToForegroundX(this.state.explosion.x);
    const centerY = worldToForegroundY(this.state.explosion.y);
    const radius = Math.max(1, Math.round(this.state.explosion.radius / FOREGROUND_WORLD_UNITS_PER_PIXEL));
    const innerRadius = Math.max(1, Math.round(radius * 0.45));

    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        const distanceSquared = offsetX * offsetX + offsetY * offsetY;
        if (distanceSquared > radius * radius) {
          continue;
        }

        context.fillStyle = distanceSquared <= innerRadius * innerRadius ? EXPLOSION_INNER_COLOR : EXPLOSION_OUTER_COLOR;
        context.fillRect(centerX + offsetX, centerY + offsetY, 1, 1);
      }
    }
  }

  private drawForegroundAimGuide(context: CanvasRenderingContext2D): void {
    if (this.state.phase !== 'aiming') {
      return;
    }

    const active = this.state.players[this.state.activePlayerIndex];
    if (active.isCpu) {
      return;
    }

    const radians = (active.angleDeg * Math.PI) / 180;
    const velocityX = Math.cos(radians) * active.power;
    const velocityY = -Math.sin(radians) * active.power;
    let x = active.tankX + Math.cos(radians) * TANK_TURRET_LENGTH;
    let y = active.tankY - 5 - Math.sin(radians) * TANK_TURRET_LENGTH;
    let currentVelocityY = velocityY;

    context.fillStyle = AIM_GUIDE_COLOR;
    for (let stepIndex = 0; stepIndex < 22; stepIndex += 1) {
      x += velocityX * 0.045;
      y += currentVelocityY * 0.045;
      currentVelocityY += 38 * 0.045;
      if (x < 0 || x > WORLD_WIDTH || y > WORLD_HEIGHT) {
        break;
      }

      context.fillRect(worldToForegroundX(x), worldToForegroundY(y), 1, 1);
    }
  }

  private updateProjectileTrail(): void {
    if (this.state.projectile === null) {
      this.projectileTrail = [];
      return;
    }

    this.projectileTrail = [...this.projectileTrail, { x: this.state.projectile.x, y: this.state.projectile.y }].slice(
      -PROJECTILE_TRAIL_LENGTH
    );
  }

  private drawBackdrop(layout: ViewportLayout): void {
    const left = worldToScreenX(layout, 0);
    const top = worldToScreenY(layout, 0);
    const width = WORLD_WIDTH * layout.scale;
    const height = WORLD_HEIGHT * layout.scale;
    const horizonY = worldToScreenY(layout, 104);

    this.graphics.fillStyle(0x060914);
    this.graphics.fillRect(left, top, width, height);
    this.graphics.fillStyle(0x0f1331);
    this.graphics.fillRect(left, top, width, height * 0.58);
    this.graphics.fillStyle(0x1a1f4a, 0.9);
    this.graphics.fillRect(left, top + height * 0.58, width, height * 0.16);
    this.graphics.fillStyle(0x39276f, 0.88);
    this.graphics.fillRect(left, top + height * 0.74, width, height * 0.1);
    this.graphics.fillStyle(0x7b2c8f, 0.46);
    this.graphics.fillRect(left, top + height * 0.84, width, height * 0.06);
    this.graphics.fillStyle(0xff7a59, 0.14);
    this.graphics.fillRect(left, top + height * 0.9, width, height * 0.05);

    this.graphics.fillStyle(0xff7eb6, 0.08);
    this.graphics.fillRect(left, horizonY - 12 * layout.scale, width, 10 * layout.scale);
    this.graphics.fillStyle(0x59d8ff, 0.12);
    this.graphics.fillRect(left, horizonY - 3 * layout.scale, width, 4 * layout.scale);

    this.drawMountainBand(
      layout,
      92,
      0x18163b,
      0x654bcd,
      [
        [0, 96],
        [24, 92],
        [46, 86],
        [70, 76],
        [94, 62],
        [118, 70],
        [142, 54],
        [170, 62],
        [198, 46],
        [226, 54],
        [254, 68],
        [286, 82],
        [320, 78]
      ]
    );
    this.drawMountainBand(
      layout,
      102,
      0x111736,
      null,
      [
        [0, 104],
        [22, 100],
        [42, 94],
        [62, 84],
        [84, 90],
        [110, 72],
        [136, 80],
        [162, 68],
        [186, 76],
        [210, 64],
        [236, 74],
        [262, 86],
        [292, 94],
        [320, 92]
      ]
    );

    this.drawMountainBand(
      layout,
      108,
      0x0b1128,
      null,
      [
        [0, 108],
        [18, 106],
        [34, 102],
        [56, 96],
        [76, 90],
        [100, 86],
        [126, 82],
        [152, 78],
        [176, 82],
        [202, 76],
        [226, 86],
        [248, 92],
        [272, 98],
        [294, 104],
        [320, 100]
      ]
    );
  }

  private drawMountainBand(
    layout: ViewportLayout,
    baselineY: number,
    fillColor: number,
    ridgeColor: number | null,
    points: ReadonlyArray<readonly [number, number]>
  ): void {
    this.graphics.fillStyle(fillColor);
    this.graphics.beginPath();
    this.graphics.moveTo(worldToScreenX(layout, 0), worldToScreenY(layout, baselineY));
    for (let index = 0; index < points.length; index += 1) {
      const [x, y] = points[index];
      this.graphics.lineTo(worldToScreenX(layout, x), worldToScreenY(layout, y));
    }
    this.graphics.lineTo(worldToScreenX(layout, WORLD_WIDTH), worldToScreenY(layout, baselineY));
    this.graphics.closePath();
    this.graphics.fillPath();

    if (ridgeColor !== null) {
      const lineWidth = 0.5;
      this.graphics.lineStyle(lineWidth, ridgeColor, 0.92);
      this.graphics.beginPath();
      for (let index = 0; index < points.length; index += 1) {
        const [x, y] = points[index];
        const screenX = worldToScreenX(layout, x);
        const screenY = worldToScreenY(layout, y);
        if (index === 0) {
          this.graphics.moveTo(screenX, screenY);
        } else {
          this.graphics.lineTo(screenX, screenY);
        }
      }
      this.graphics.strokePath();
    }
  }

  private drawForegroundTree(context: CanvasRenderingContext2D, x: number, y: number, variant: number): void {
    const pattern = TREE_PATTERNS[variant];
    const width = pattern.reduce((maxWidth, row) => Math.max(maxWidth, row.length), 0);
    const originX = x - Math.floor(width / 2);
    const originY = y - (pattern.length - 2);
    for (let rowIndex = 0; rowIndex < pattern.length; rowIndex += 1) {
      const row = pattern[rowIndex];
      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        const pixel = row[columnIndex];
        if (pixel === '.') {
          continue;
        }

        if (pixel === '1') {
          context.fillStyle = TREE_LEAF_LIGHT_COLOR;
        } else if (pixel === '2') {
          context.fillStyle = TREE_LEAF_DARK_COLOR;
        } else if (pixel === '3') {
          context.fillStyle = TREE_TRUNK_COLOR;
        } else {
          context.fillStyle = TERRAIN_OUTLINE_COLOR;
        }
        context.fillRect(originX + columnIndex, originY + rowIndex, 1, 1);
      }
    }
  }

  private drawForegroundTank(context: CanvasRenderingContext2D, player: GameState['players'][number]): void {
    const pattern = PLAYER_TANK_PATTERNS[player.index];
    const palette = PLAYER_TANK_PALETTES[player.index];
    const originX = worldToForegroundX(player.tankX) - 4;
    const originY = worldToForegroundY(player.tankY) - 5;

    for (let rowIndex = 0; rowIndex < pattern.length; rowIndex += 1) {
      const row = pattern[rowIndex];
      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        const paletteIndex = Number(row[columnIndex]);
        if (Number.isNaN(paletteIndex) || paletteIndex === 0) {
          continue;
        }

        context.fillStyle = palette[paletteIndex - 1];
        context.fillRect(originX + columnIndex, originY + rowIndex, 1, 1);
      }
    }

    const radians = (player.angleDeg * Math.PI) / 180;
    const turretOriginX = worldToForegroundX(player.tankX);
    const turretOriginY = worldToForegroundY(player.tankY - 4);
    const turretLength = Math.max(2, Math.round(TANK_TURRET_LENGTH / FOREGROUND_WORLD_UNITS_PER_PIXEL));
    const turretSteps = Math.max(1, turretLength);
    context.fillStyle = palette[3];
    for (let stepIndex = 0; stepIndex <= turretSteps; stepIndex += 1) {
      const unit = stepIndex / turretSteps;
      const x = Math.round(turretOriginX + Math.cos(radians) * turretLength * unit);
      const y = Math.round(turretOriginY - Math.sin(radians) * turretLength * unit);
      context.fillRect(x, y, 1, 1);
    }
  }
}
