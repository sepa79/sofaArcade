import Phaser from 'phaser';

import {
  FIXED_TIMESTEP,
  TUNNEL_INNER_RADIUS,
  TUNNEL_OUTER_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from './game/constants';
import { createInputContext, readFrameInput } from './game/input';
import { stepGame } from './game/logic';
import { createInitialState } from './game/state';
import type { InputContext } from './game/input';
import type { GameState, TunnelPhase } from './game/types';
import './style.css';

const SCENE_KEY = 'tunnel-invaders';

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

function depthToRadius(depth: number): number {
  return TUNNEL_OUTER_RADIUS - depth * (TUNNEL_OUTER_RADIUS - TUNNEL_INNER_RADIUS);
}

function polarToWorld(theta: number, radius: number): { readonly x: number; readonly y: number } {
  return {
    x: WORLD_WIDTH / 2 + Math.cos(theta) * radius,
    y: WORLD_HEIGHT / 2 + Math.sin(theta) * radius
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

class TunnelInvadersScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private inputContext!: InputContext;
  private state: GameState = createInitialState();
  private accumulator = 0;

  constructor() {
    super(SCENE_KEY);
  }

  create(): void {
    this.graphics = this.add.graphics();

    this.hudText = this.add.text(20, 18, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '24px',
      color: '#f4f7ff'
    });

    this.hintText = this.add.text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '34px',
      color: '#ffe4a8',
      align: 'center'
    });
    this.hintText.setOrigin(0.5, 0.5);

    this.inputContext = createInputContext(this, 'tunnel-invaders-keyboard-gamepad');
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

    this.drawTunnel(graphics);
    this.drawBullets(graphics);
    this.drawEnemies(graphics);
    this.drawPlayer(graphics);
    this.drawHud();
    this.hintText.setText(phaseMessage(this.state.phase));
  }

  private drawTunnel(graphics: Phaser.GameObjects.Graphics): void {
    for (let index = 0; index <= 9; index += 1) {
      const depth = index / 9;
      const radius = depthToRadius(depth);
      const color = Phaser.Display.Color.GetColor(
        Math.round(lerp(38, 95, 1 - depth)),
        Math.round(lerp(60, 132, 1 - depth)),
        Math.round(lerp(112, 182, 1 - depth))
      );

      graphics.lineStyle(index === 0 ? 9 : 2, color, index === 0 ? 1 : 0.45);
      graphics.strokeCircle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, radius);
    }

    graphics.lineStyle(1, 0x2f4f83, 0.28);
    for (let spoke = 0; spoke < 16; spoke += 1) {
      const theta = (spoke / 16) * Math.PI * 2;
      const inner = polarToWorld(theta, TUNNEL_INNER_RADIUS);
      const outer = polarToWorld(theta, TUNNEL_OUTER_RADIUS);
      graphics.beginPath();
      graphics.moveTo(inner.x, inner.y);
      graphics.lineTo(outer.x, outer.y);
      graphics.strokePath();
    }
  }

  private drawPlayer(graphics: Phaser.GameObjects.Graphics): void {
    const blink =
      this.state.playerInvulnerabilityTimer > 0 && Math.floor(this.time.now / 100) % 2 === 0;
    if (blink) {
      return;
    }

    const playerRadius = depthToRadius(0) + (this.state.playerJumpTimer > 0 ? 18 : 7);
    const position = polarToWorld(this.state.playerTheta, playerRadius);

    if (this.state.playerJumpTimer > 0) {
      graphics.fillStyle(0xb2f1ff, 0.35);
      graphics.fillCircle(position.x, position.y, 22);
    }

    graphics.fillStyle(0x5fe6ff, 1);
    graphics.fillCircle(position.x, position.y, 11);
  }

  private drawEnemies(graphics: Phaser.GameObjects.Graphics): void {
    for (const enemy of this.state.enemies) {
      if (!enemy.alive) {
        continue;
      }

      const radius = depthToRadius(enemy.depth);
      const size = lerp(18, 8, enemy.depth);
      const position = polarToWorld(enemy.theta, radius);

      const color = Phaser.Display.Color.GetColor(
        Math.round(lerp(255, 180, enemy.depth)),
        Math.round(lerp(124, 72, enemy.depth)),
        Math.round(lerp(90, 66, enemy.depth))
      );

      graphics.fillStyle(color, 1);
      graphics.fillRect(position.x - size / 2, position.y - size / 2, size, size);
    }
  }

  private drawBullets(graphics: Phaser.GameObjects.Graphics): void {
    for (const bullet of this.state.bullets) {
      const radius = depthToRadius(bullet.depth);
      const size = lerp(5, 2, bullet.depth);
      const position = polarToWorld(bullet.theta, radius);
      graphics.fillStyle(0xffef96, 1);
      graphics.fillCircle(position.x, position.y, size);
    }
  }

  private drawHud(): void {
    this.hudText.setText(
      `SCORE ${this.state.score.toString().padStart(5, '0')}    LIVES ${this.state.lives}    JUMP ${(this.state.playerJumpCooldownTimer === 0).toString()}`
    );
  }
}

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  scene: TunnelInvadersScene,
  pixelArt: true
};

new Phaser.Game(gameConfig);
