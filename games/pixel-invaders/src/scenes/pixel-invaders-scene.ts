import Phaser from 'phaser';

import { RetroSfx } from '../audio/retro-sfx';
import enemyShipImage from '../assets/sprite_enemy_1.png';
import playerShipImage from '../assets/sprite_player_1.png';
import {
  BULLET_HEIGHT,
  BULLET_WIDTH,
  FIXED_TIMESTEP,
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
const PLAYER_SPRITE_KEY = 'pixel-invaders-player-ship';
const ENEMY_SPRITE_KEY = 'pixel-invaders-enemy-ship';
const PLAYER_SPRITE_SCALE = 2.1;
const ENEMY_SPRITE_SCALE = 1.5;
const ENEMY_SPRITE_ROTATION = 0;
const STAR_COUNT = 180;
const STAR_LAYER_SPEED: readonly [number, number, number] = [46, 88, 138];
const STAR_LAYER_ALPHA: readonly [number, number, number] = [0.33, 0.58, 0.9];
const STAR_LAYER_SIZE: readonly [number, number, number] = [1, 2, 2.8];

interface PixelStar {
  readonly x: number;
  readonly y: number;
  readonly layer: 0 | 1 | 2;
}

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
  private playerSprite!: Phaser.GameObjects.Image;
  private enemySprites = new Map<number, Phaser.GameObjects.Image>();
  private hudText!: Phaser.GameObjects.Text;
  private controllerText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private readonly sfx = new RetroSfx();
  private inputContext!: InputContext;
  private state: GameState = createInitialState(1337);
  private stars: ReadonlyArray<PixelStar> = [];
  private playfieldOffsetX = 0;
  private playfieldOffsetY = 0;
  private readonly onResize = (): void => {
    this.updateLayout();
  };
  private accumulator = 0;
  private launchData: PixelInvadersSceneData | null = null;

  constructor() {
    super(PIXEL_INVADERS_SCENE_KEY);
  }

  init(rawData: unknown): void {
    this.launchData = parseSceneData(rawData);
  }

  preload(): void {
    this.load.image(PLAYER_SPRITE_KEY, playerShipImage);
    this.load.image(ENEMY_SPRITE_KEY, enemyShipImage);
  }

  create(): void {
    if (this.launchData === null) {
      throw new Error('Pixel Invaders launchData is missing in create().');
    }

    this.graphics = this.add.graphics();
    this.updateLayout();
    this.stars = this.createStars();
    this.playerSprite = this.add.image(this.scale.width / 2, this.scale.height / 2, PLAYER_SPRITE_KEY);
    this.playerSprite.setOrigin(0.5, 0.5);
    this.playerSprite.setScale(PLAYER_SPRITE_SCALE);

    for (const enemy of this.state.enemies) {
      const sprite = this.add.image(this.scale.width / 2, this.scale.height / 2, ENEMY_SPRITE_KEY);
      sprite.setOrigin(0.5, 0.5);
      sprite.setScale(ENEMY_SPRITE_SCALE);
      this.enemySprites.set(enemy.id, sprite);
    }

    this.hudText = this.add.text(20, 18, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '24px',
      color: '#f4f7ff'
    });

    this.controllerText = this.add.text(20, 52, `CTRL ${this.launchData.controllerLabel}`, {
      fontFamily: 'Trebuchet MS',
      fontSize: '18px',
      color: '#90f0ff'
    });

    this.bannerText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 40, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '42px',
      color: '#fff1d8',
      align: 'center'
    });
    this.bannerText.setOrigin(0.5, 0.5);

    this.inputContext = createInputContext(this, this.launchData.controllerProfileId);
    this.cameras.main.setBackgroundColor('#060913');
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    });
  }

  update(_: number, delta: number): void {
    this.accumulator += delta / 1000;
    let playerShot = false;
    let enemyShot = false;
    let enemyHit = false;
    let playerHit = false;
    let won = false;
    let lost = false;

    while (this.accumulator >= FIXED_TIMESTEP) {
      const input = readFrameInput(this, this.inputContext, {
        minX: this.playfieldOffsetX,
        maxX: this.playfieldOffsetX + WORLD_WIDTH
      });
      if (input.firePressed || input.restartPressed || input.moveAxisSigned !== 0 || input.moveAbsoluteUnit !== null) {
        this.sfx.unlock();
      }

      const previous = this.state;
      const next = stepGame(this.state, input, FIXED_TIMESTEP);

      const previousPlayerBullets = previous.bullets.filter((bullet) => bullet.owner === 'player').length;
      const nextPlayerBullets = next.bullets.filter((bullet) => bullet.owner === 'player').length;
      const previousEnemyBullets = previous.bullets.filter((bullet) => bullet.owner === 'enemy').length;
      const nextEnemyBullets = next.bullets.filter((bullet) => bullet.owner === 'enemy').length;

      if (nextPlayerBullets > previousPlayerBullets) {
        playerShot = true;
      }
      if (nextEnemyBullets > previousEnemyBullets) {
        enemyShot = true;
      }
      if (next.score > previous.score) {
        enemyHit = true;
      }
      if (next.lives < previous.lives) {
        playerHit = true;
      }
      if (previous.phase === 'playing' && next.phase === 'won') {
        won = true;
      }
      if (previous.phase === 'playing' && next.phase === 'lost') {
        lost = true;
      }

      this.state = next;
      this.accumulator -= FIXED_TIMESTEP;
    }

    this.stars = this.stars.map((star) => {
      const speed = STAR_LAYER_SPEED[star.layer];
      let nextY = star.y + speed * delta * 0.001;
      if (nextY > WORLD_HEIGHT + 8) {
        nextY = -8;
      }

      return {
        ...star,
        y: nextY
      };
    });

    if (playerShot) {
      this.sfx.playPlayerShot();
    }
    if (enemyShot) {
      this.sfx.playEnemyShot();
    }
    if (enemyHit) {
      this.sfx.playExplosion();
    }
    if (playerHit) {
      this.sfx.playPlayerHit();
    }
    if (won) {
      this.sfx.playWin();
    }
    if (lost) {
      this.sfx.playLose();
    }

    this.renderState();
  }

  private renderState(): void {
    const graphics = this.graphics;
    graphics.clear();

    this.drawBackground(graphics);
    this.syncEnemySprites();
    this.drawPlayer();
    this.drawEnemies();
    this.drawBullets(graphics);
    this.drawHud();
    this.drawBanner();
  }

  private drawPlayer(): void {
    const blink = this.state.playerRespawnTimer > 0 && Math.floor(this.time.now / 100) % 2 === 0;
    if (blink) {
      this.playerSprite.setVisible(false);
      return;
    }

    this.playerSprite.setVisible(true);
    this.playerSprite.setPosition(this.playfieldOffsetX + this.state.playerX, this.playfieldOffsetY + PLAYER_Y);
    this.playerSprite.setRotation(0);
    this.playerSprite.setScale(PLAYER_SPRITE_SCALE);
  }

  private drawEnemies(): void {
    for (const enemy of this.state.enemies) {
      let sprite = this.enemySprites.get(enemy.id);
      if (sprite === undefined) {
        sprite = this.add.image(this.scale.width / 2, this.scale.height / 2, ENEMY_SPRITE_KEY);
        sprite.setOrigin(0.5, 0.5);
        sprite.setScale(ENEMY_SPRITE_SCALE);
        this.enemySprites.set(enemy.id, sprite);
      }

      if (!enemy.alive) {
        sprite.setVisible(false);
        continue;
      }

      sprite.setVisible(true);
      sprite.setPosition(this.playfieldOffsetX + enemy.x, this.playfieldOffsetY + enemy.y);
      sprite.setRotation(ENEMY_SPRITE_ROTATION);
      sprite.setScale(ENEMY_SPRITE_SCALE);
    }
  }

  private drawBullets(graphics: Phaser.GameObjects.Graphics): void {
    for (const bullet of this.state.bullets) {
      graphics.fillStyle(bullet.owner === 'player' ? 0x7cf4ff : 0xffe274, 1);
      graphics.fillRect(
        this.playfieldOffsetX + bullet.x - BULLET_WIDTH / 2,
        this.playfieldOffsetY + bullet.y - BULLET_HEIGHT / 2,
        BULLET_WIDTH,
        BULLET_HEIGHT
      );
    }
  }

  private drawHud(): void {
    this.hudText.setPosition(this.playfieldOffsetX + 20, this.playfieldOffsetY + 18);
    this.controllerText.setPosition(this.playfieldOffsetX + 20, this.playfieldOffsetY + 52);
    this.hudText.setText(`SCORE ${this.state.score.toString().padStart(5, '0')}    LIVES ${this.state.lives}`);
  }

  private syncEnemySprites(): void {
    const activeIds = new Set(this.state.enemies.map((enemy) => enemy.id));
    for (const [enemyId, sprite] of this.enemySprites.entries()) {
      if (activeIds.has(enemyId)) {
        continue;
      }

      sprite.destroy();
      this.enemySprites.delete(enemyId);
    }
  }

  private drawBanner(): void {
    this.bannerText.setPosition(this.playfieldOffsetX + WORLD_WIDTH / 2, this.playfieldOffsetY + WORLD_HEIGHT / 2 - 40);

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

  private updateLayout(): void {
    this.playfieldOffsetX = Math.floor((this.scale.width - WORLD_WIDTH) / 2);
    this.playfieldOffsetY = Math.floor((this.scale.height - WORLD_HEIGHT) / 2);
  }

  private createStars(): ReadonlyArray<PixelStar> {
    const rng = new Phaser.Math.RandomDataGenerator(['pixel-stars-v1']);
    const stars: PixelStar[] = [];
    for (let i = 0; i < STAR_COUNT; i += 1) {
      stars.push({
        x: rng.realInRange(0, WORLD_WIDTH),
        y: rng.realInRange(0, WORLD_HEIGHT),
        layer: (i % 3) as 0 | 1 | 2
      });
    }

    return stars;
  }

  private drawBackground(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x03070f, 1);
    graphics.fillRect(this.playfieldOffsetX, this.playfieldOffsetY, WORLD_WIDTH, WORLD_HEIGHT);

    for (const star of this.stars) {
      const starSize = STAR_LAYER_SIZE[star.layer];
      const alpha = STAR_LAYER_ALPHA[star.layer];
      graphics.fillStyle(0x9fd8ff, alpha);
      graphics.fillRect(
        Math.round(this.playfieldOffsetX + star.x),
        Math.round(this.playfieldOffsetY + star.y),
        starSize,
        starSize
      );
    }
  }
}
