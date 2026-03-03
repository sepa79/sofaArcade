import Phaser from 'phaser';

import {
  FIXED_TIMESTEP,
  TAU,
  TUNNEL_INNER_RADIUS,
  TUNNEL_OUTER_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from '../tunnel/game/constants';
import { createInputContext, readFrameInput } from '../tunnel/game/input';
import { stepGame } from '../tunnel/game/logic';
import { createInitialState } from '../tunnel/game/state';
import enemyFighterImage from '../assets/enemyFighter1.png';
import fighterShipImage from '../assets/fighter1.png';
import type { InputContext } from '../tunnel/game/input';
import type { GameState, TunnelPhase } from '../tunnel/game/types';

export const TUNNEL_INVADERS_SCENE_KEY = 'tunnel-invaders';
const PLAYER_SPRITE_KEY = 'tunnel-player-ship';
const ENEMY_SPRITE_KEY = 'tunnel-enemy-ship';

const WORM_DRIFT_CAP_X = 18;
const WORM_DRIFT_CAP_Y = 16;
const OUTER_DRIFT_INFLUENCE = 0.2;
const TUNNEL_DENSITY_EXPONENT = 0.58;
const TWIST_BASE_AMP = 0.08;
const TWIST_WAVE_AMP = 0.04;
const ENEMY_WAVE_AMP = 0.08;
const TUNNEL_RING_COUNT = 34;
const TUNNEL_STARS_PER_RING = 18;
const TUNNEL_FLOW_SPEED = 0.24;

interface RenderFrame {
  readonly timeSeconds: number;
  readonly driftX: number;
  readonly driftY: number;
}

interface RenderCenter {
  readonly x: number;
  readonly y: number;
}

interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
  readonly pixelSize: number;
  readonly centerX: number;
  readonly centerY: number;
}

interface TunnelStar {
  readonly ringIndex: number;
  readonly theta: number;
  readonly radialJitter: number;
  readonly alpha: number;
  readonly sizeScale: number;
}

export interface TunnelInvadersSceneData {
  readonly controllerProfileId: string;
  readonly controllerLabel: string;
}

function parseSceneData(rawData: unknown): TunnelInvadersSceneData {
  if (typeof rawData !== 'object' || rawData === null) {
    throw new Error('Tunnel Invaders scene requires launch data object.');
  }

  const data = rawData as Record<string, unknown>;
  if (typeof data.controllerProfileId !== 'string' || data.controllerProfileId.trim().length === 0) {
    throw new Error('Tunnel Invaders scene requires a valid controllerProfileId.');
  }

  if (typeof data.controllerLabel !== 'string' || data.controllerLabel.trim().length === 0) {
    throw new Error('Tunnel Invaders scene requires a valid controllerLabel.');
  }

  return {
    controllerProfileId: data.controllerProfileId,
    controllerLabel: data.controllerLabel
  };
}

function phaseMessage(phase: TunnelPhase): string {
  if (phase === 'ready') {
    return 'PRESS ENTER TO START';
  }

  if (phase === 'paused') {
    return 'PAUSED\nPRESS ESC OR SELECT';
  }

  if (phase === 'won') {
    return 'SECTOR CLEARED\nPRESS ENTER TO RESTART';
  }

  if (phase === 'lost') {
    return 'BREACH AT TUNNEL EDGE\nPRESS ENTER TO RESTART';
  }

  return '';
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function depthToRadius(depth: number): number {
  const clampedDepth = clamp01(depth);
  const depthCurve = Math.pow(clampedDepth, TUNNEL_DENSITY_EXPONENT);
  return TUNNEL_OUTER_RADIUS - depthCurve * (TUNNEL_OUTER_RADIUS - TUNNEL_INNER_RADIUS);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function snapToGrid(value: number, pixelSize: number): number {
  if (!Number.isInteger(pixelSize) || pixelSize <= 0) {
    throw new Error(`pixelSize must be positive integer, got ${pixelSize}.`);
  }

  return Math.round(value / pixelSize) * pixelSize;
}

function pixelSizeForDepth(depth: number): number {
  const clampedDepth = clamp01(depth);

  if (clampedDepth >= 2 / 3) {
    return 2;
  }

  if (clampedDepth >= 1 / 3) {
    return 3;
  }

  return 4;
}

function computeRenderFrame(timeSeconds: number): RenderFrame {
  const driftX = Math.sin(timeSeconds * 0.74) * 12 + Math.sin(timeSeconds * 1.23 + 0.7) * 6;
  const driftY = Math.cos(timeSeconds * 0.82 + 0.2) * 10 + Math.sin(timeSeconds * 1.36 + 1.1) * 5;

  return {
    timeSeconds,
    driftX: Math.max(-WORM_DRIFT_CAP_X, Math.min(WORM_DRIFT_CAP_X, driftX)),
    driftY: Math.max(-WORM_DRIFT_CAP_Y, Math.min(WORM_DRIFT_CAP_Y, driftY))
  };
}

function centerForDepth(depth: number, frame: RenderFrame): RenderCenter {
  const clampedDepth = clamp01(depth);
  const depthInfluence = OUTER_DRIFT_INFLUENCE + (1 - OUTER_DRIFT_INFLUENCE) * Math.pow(clampedDepth, 1.45);

  return {
    x: WORLD_WIDTH / 2 + frame.driftX * depthInfluence,
    y: WORLD_HEIGHT / 2 + frame.driftY * depthInfluence
  };
}

function depthTwist(depth: number, timeSeconds: number): number {
  const clampedDepth = clamp01(depth);
  return (
    TWIST_BASE_AMP * clampedDepth +
    TWIST_WAVE_AMP * clampedDepth * Math.sin(timeSeconds * 3.2 + clampedDepth * TAU * 2.3)
  );
}

function enemyWaveOffset(enemyId: number, depth: number, timeSeconds: number): number {
  const clampedDepth = clamp01(depth);
  return ENEMY_WAVE_AMP * clampedDepth * Math.sin(timeSeconds * 2.6 + enemyId * 0.67 + clampedDepth * TAU);
}

function wrapUnit(value: number): number {
  const remainder = value % 1;
  return remainder < 0 ? remainder + 1 : remainder;
}

function ringDepthAt(ringIndex: number, timeSeconds: number): number {
  const normalized = ringIndex / TUNNEL_RING_COUNT;
  return wrapUnit(normalized - timeSeconds * TUNNEL_FLOW_SPEED);
}

function createTunnelStars(): ReadonlyArray<TunnelStar> {
  const rng = new Phaser.Math.RandomDataGenerator(['tunnel-stars-v2']);
  const stars: TunnelStar[] = [];

  for (let ringIndex = 0; ringIndex < TUNNEL_RING_COUNT; ringIndex += 1) {
    for (let starIndex = 0; starIndex < TUNNEL_STARS_PER_RING; starIndex += 1) {
      stars.push({
        ringIndex,
        theta: rng.frac() * TAU,
        radialJitter: rng.realInRange(-5, 5),
        alpha: rng.realInRange(0.45, 0.95),
        sizeScale: rng.realInRange(0.9, 1.3)
      });
    }
  }

  return stars;
}

function projectPolar(
  theta: number,
  depth: number,
  frame: RenderFrame,
  radiusOffset = 0
): ProjectedPoint {
  const clampedDepth = clamp01(depth);
  const pixelSize = pixelSizeForDepth(clampedDepth);
  const center = centerForDepth(clampedDepth, frame);
  const radius = depthToRadius(clampedDepth) + radiusOffset;
  const renderTheta = theta + depthTwist(clampedDepth, frame.timeSeconds);

  return {
    x: snapToGrid(center.x + Math.cos(renderTheta) * radius, pixelSize),
    y: snapToGrid(center.y + Math.sin(renderTheta) * radius, pixelSize),
    pixelSize,
    centerX: center.x,
    centerY: center.y
  };
}

function quantizeSize(size: number, pixelSize: number): number {
  return Math.max(pixelSize, Math.round(size / pixelSize) * pixelSize);
}

export class TunnelInvadersScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private playerSprite!: Phaser.GameObjects.Image;
  private enemySprites = new Map<number, Phaser.GameObjects.Image>();
  private tunnelStars: ReadonlyArray<TunnelStar> = [];
  private hudText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private inputContext!: InputContext;
  private state: GameState = createInitialState();
  private accumulator = 0;
  private launchData: TunnelInvadersSceneData | null = null;

  constructor() {
    super(TUNNEL_INVADERS_SCENE_KEY);
  }

  preload(): void {
    this.load.image(PLAYER_SPRITE_KEY, fighterShipImage);
    this.load.image(ENEMY_SPRITE_KEY, enemyFighterImage);
  }

  init(rawData: unknown): void {
    this.launchData = parseSceneData(rawData);
  }

  create(): void {
    if (this.launchData === null) {
      throw new Error('Tunnel Invaders launchData is missing in create().');
    }

    this.graphics = this.add.graphics();
    this.playerSprite = this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, PLAYER_SPRITE_KEY);
    this.playerSprite.setOrigin(0.5, 0.5);
    this.playerSprite.setScale(0.04);
    this.tunnelStars = createTunnelStars();

    for (const enemy of this.state.enemies) {
      const sprite = this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, ENEMY_SPRITE_KEY);
      sprite.setOrigin(0.5, 0.5);
      sprite.setScale(0.02);
      this.enemySprites.set(enemy.id, sprite);
    }

    this.hudText = this.add.text(20, 18, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '24px',
      color: '#f4f7ff'
    });

    this.add.text(20, 52, `CTRL ${this.launchData.controllerLabel}`, {
      fontFamily: 'Trebuchet MS',
      fontSize: '18px',
      color: '#90f0ff'
    });

    this.hintText = this.add.text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '34px',
      color: '#ffe4a8',
      align: 'center'
    });
    this.hintText.setOrigin(0.5, 0.5);

    this.inputContext = createInputContext(this, this.launchData.controllerProfileId);
    this.cameras.main.setBackgroundColor('#070d1e');
  }

  update(_: number, delta: number): void {
    this.accumulator += delta / 1000;

    while (this.accumulator >= FIXED_TIMESTEP) {
      const input = readFrameInput(this.inputContext);
      this.state = stepGame(this.state, input, FIXED_TIMESTEP);
      this.accumulator -= FIXED_TIMESTEP;
    }

    this.renderState();
  }

  private renderState(): void {
    const graphics = this.graphics;
    graphics.clear();

    const frame = computeRenderFrame(this.time.now / 1000);

    this.drawTunnelStars(graphics, frame);
    this.drawBullets(graphics, frame);
    this.drawEnemies(frame);
    this.drawPlayer(graphics, frame);
    this.drawHud();
    this.hintText.setText(phaseMessage(this.state.phase));
  }

  private drawTunnelStars(graphics: Phaser.GameObjects.Graphics, frame: RenderFrame): void {
    for (const star of this.tunnelStars) {
      const depth = ringDepthAt(star.ringIndex, frame.timeSeconds);
      const point = projectPolar(star.theta, depth, frame, star.radialJitter);
      const starPixelSize = point.pixelSize;
      const starSize = quantizeSize(lerp(1.2, 3.4, 1 - depth) * star.sizeScale, starPixelSize);
      const starHalf = starSize / 2;
      const starX = snapToGrid(point.x - starHalf, starPixelSize);
      const starY = snapToGrid(point.y - starHalf, starPixelSize);

      const color = Phaser.Display.Color.GetColor(
        Math.round(lerp(90, 212, 1 - depth)),
        Math.round(lerp(120, 236, 1 - depth)),
        Math.round(lerp(170, 255, 1 - depth))
      );

      graphics.fillStyle(color, star.alpha * lerp(0.45, 1, 1 - depth));
      graphics.fillRect(starX, starY, starSize, starSize);

      const trailDepth = clamp01(depth + 0.045);
      const trailPoint = projectPolar(star.theta, trailDepth, frame, star.radialJitter);
      const trailPixelSize = trailPoint.pixelSize;
      const trailSize = Math.max(trailPixelSize, starSize - trailPixelSize);
      graphics.fillStyle(0x6bb4ff, 0.2 * star.alpha);
      graphics.fillRect(
        snapToGrid(trailPoint.x - trailSize / 2, trailPixelSize),
        snapToGrid(trailPoint.y - trailSize / 2, trailPixelSize),
        trailSize,
        trailSize
      );
    }
  }

  private drawPlayer(graphics: Phaser.GameObjects.Graphics, frame: RenderFrame): void {
    const blink =
      this.state.playerInvulnerabilityTimer > 0 && Math.floor(this.time.now / 100) % 2 === 0;
    if (blink) {
      this.playerSprite.setVisible(false);
      return;
    }

    this.playerSprite.setVisible(true);
    const playerRadiusOffset = this.state.playerJumpTimer > 0 ? 18 : 7;
    const position = projectPolar(this.state.playerTheta, 0, frame, playerRadiusOffset);
    const center = centerForDepth(1, frame);
    const facingCenterAngle = Phaser.Math.Angle.Between(position.x, position.y, center.x, center.y);

    this.playerSprite.setPosition(position.x, position.y);
    this.playerSprite.setRotation(facingCenterAngle - Math.PI / 2);
    this.playerSprite.setScale(this.state.playerJumpTimer > 0 ? 0.045 : 0.04);

    if (this.state.playerJumpTimer > 0) {
      graphics.fillStyle(0xb2f1ff, 0.3);
      graphics.fillCircle(position.x, position.y, 28);
    }
  }

  private drawEnemies(frame: RenderFrame): void {
    for (const enemy of this.state.enemies) {
      const sprite = this.enemySprites.get(enemy.id);
      if (sprite === undefined) {
        throw new Error(`Missing enemy sprite for id ${enemy.id}.`);
      }

      if (!enemy.alive) {
        sprite.setVisible(false);
        continue;
      }

      const renderTheta = enemy.theta + enemyWaveOffset(enemy.id, enemy.depth, frame.timeSeconds);
      const position = projectPolar(renderTheta, enemy.depth, frame);
      const outwardAngle = Phaser.Math.Angle.Between(
        position.centerX,
        position.centerY,
        position.x,
        position.y
      );

      sprite.setVisible(true);
      sprite.setPosition(position.x, position.y);
      sprite.setRotation(outwardAngle - Math.PI / 2);
      sprite.setScale(lerp(0.031, 0.017, clamp01(enemy.depth)));
    }
  }

  private drawBullets(graphics: Phaser.GameObjects.Graphics, frame: RenderFrame): void {
    for (const bullet of this.state.bullets) {
      const depth = clamp01(bullet.depth);
      const head = projectPolar(bullet.theta, depth, frame);
      const headSize = quantizeSize(lerp(5, 2, depth), head.pixelSize);
      const trailDepth = clamp01(depth - 0.06);
      const trail = projectPolar(bullet.theta, trailDepth, frame);
      const trailSize = quantizeSize(headSize + 1, trail.pixelSize);

      graphics.fillStyle(0xffb866, 0.35);
      graphics.fillRect(
        snapToGrid(trail.x - trailSize / 2, trail.pixelSize),
        snapToGrid(trail.y - trailSize / 2, trail.pixelSize),
        trailSize,
        trailSize
      );

      graphics.fillStyle(0xffef96, 1);
      graphics.fillRect(
        snapToGrid(head.x - headSize / 2, head.pixelSize),
        snapToGrid(head.y - headSize / 2, head.pixelSize),
        headSize,
        headSize
      );
    }
  }

  private drawHud(): void {
    this.hudText.setText(
      `SCORE ${this.state.score.toString().padStart(5, '0')}    LIVES ${this.state.lives}    JUMP ${(this.state.playerJumpCooldownTimer === 0).toString()}`
    );
  }
}
