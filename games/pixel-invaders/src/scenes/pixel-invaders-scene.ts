import Phaser from 'phaser';

import {
  BULLET_HEIGHT,
  BULLET_WIDTH,
  ENEMY_HEIGHT,
  ENEMY_WIDTH,
  FIXED_TIMESTEP,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from '../game/constants';
import { createInputContext, readFrameInput } from '../game/input';
import { stepGame } from '../game/logic';
import { createInitialState } from '../game/state';
import type { InputContext } from '../game/input';
import type { GameState } from '../game/types';

export const PIXEL_INVADERS_SCENE_KEY = 'pixel-invaders';

export interface PixelInvadersSceneData {
  readonly controllerProfileId: string;
  readonly controllerLabel: string;
}

function parseSceneData(rawData: unknown): PixelInvadersSceneData {
  if (typeof rawData !== 'object' || rawData === null) {
    throw new Error('Pixel Invaders scene requires launch data object.');
  }

  const data = rawData as Record<string, unknown>;
  if (typeof data.controllerProfileId !== 'string' || data.controllerProfileId.trim().length === 0) {
    throw new Error('Pixel Invaders scene requires a valid controllerProfileId.');
  }

  if (typeof data.controllerLabel !== 'string' || data.controllerLabel.trim().length === 0) {
    throw new Error('Pixel Invaders scene requires a valid controllerLabel.');
  }

  return {
    controllerProfileId: data.controllerProfileId,
    controllerLabel: data.controllerLabel
  };
}

export class PixelInvadersScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private inputContext!: InputContext;
  private state: GameState = createInitialState(1337);
  private accumulator = 0;
  private launchData: PixelInvadersSceneData | null = null;

  constructor() {
    super(PIXEL_INVADERS_SCENE_KEY);
  }

  init(rawData: unknown): void {
    this.launchData = parseSceneData(rawData);
  }

  create(): void {
    if (this.launchData === null) {
      throw new Error('Pixel Invaders launchData is missing in create().');
    }

    this.graphics = this.add.graphics();
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

    this.bannerText = this.add.text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 40, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '42px',
      color: '#fff1d8',
      align: 'center'
    });
    this.bannerText.setOrigin(0.5, 0.5);

    this.inputContext = createInputContext(this, this.launchData.controllerProfileId);
    this.cameras.main.setBackgroundColor('#060913');
  }

  update(_: number, delta: number): void {
    this.accumulator += delta / 1000;

    while (this.accumulator >= FIXED_TIMESTEP) {
      const input = readFrameInput(this, this.inputContext);
      this.state = stepGame(this.state, input, FIXED_TIMESTEP);
      this.accumulator -= FIXED_TIMESTEP;
    }

    this.renderState();
  }

  private renderState(): void {
    const graphics = this.graphics;
    graphics.clear();

    this.drawPlayer(graphics);
    this.drawEnemies(graphics);
    this.drawBullets(graphics);
    this.drawHud();
    this.drawBanner();
  }

  private drawPlayer(graphics: Phaser.GameObjects.Graphics): void {
    const blink = this.state.playerRespawnTimer > 0 && Math.floor(this.time.now / 100) % 2 === 0;
    if (blink) {
      return;
    }

    graphics.fillStyle(0x3cd3ff, 1);
    graphics.fillRect(
      this.state.playerX - PLAYER_WIDTH / 2,
      PLAYER_Y - PLAYER_HEIGHT / 2,
      PLAYER_WIDTH,
      PLAYER_HEIGHT
    );
    graphics.fillStyle(0x9ff5ff, 1);
    graphics.fillRect(this.state.playerX - 12, PLAYER_Y - PLAYER_HEIGHT / 2 - 8, 24, 8);
  }

  private drawEnemies(graphics: Phaser.GameObjects.Graphics): void {
    for (const enemy of this.state.enemies) {
      if (!enemy.alive) {
        continue;
      }

      graphics.fillStyle(0xff8c5a, 1);
      graphics.fillRect(enemy.x - ENEMY_WIDTH / 2, enemy.y - ENEMY_HEIGHT / 2, ENEMY_WIDTH, ENEMY_HEIGHT);
      graphics.fillStyle(0xffd6a4, 1);
      graphics.fillRect(enemy.x - 10, enemy.y - 4, 20, 8);
    }
  }

  private drawBullets(graphics: Phaser.GameObjects.Graphics): void {
    for (const bullet of this.state.bullets) {
      graphics.fillStyle(bullet.owner === 'player' ? 0x7cf4ff : 0xffe274, 1);
      graphics.fillRect(bullet.x - BULLET_WIDTH / 2, bullet.y - BULLET_HEIGHT / 2, BULLET_WIDTH, BULLET_HEIGHT);
    }
  }

  private drawHud(): void {
    this.hudText.setText(`SCORE ${this.state.score.toString().padStart(5, '0')}    LIVES ${this.state.lives}`);
  }

  private drawBanner(): void {
    if (this.state.phase === 'playing') {
      this.bannerText.setText('');
      return;
    }

    if (this.state.phase === 'won') {
      this.bannerText.setText('SECTOR SECURED\nPRESS ENTER');
      return;
    }

    this.bannerText.setText('PIXEL INVADERS PREVAILED\nPRESS ENTER');
  }
}
