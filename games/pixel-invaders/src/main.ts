import Phaser from 'phaser';

import { WORLD_HEIGHT, WORLD_WIDTH } from './game/constants';
import { LauncherScene } from './scenes/launcher-scene';
import { PixelInvadersScene } from './scenes/pixel-invaders-scene';
import { TunnelInvadersScene } from './scenes/tunnel-invaders-scene';
import './style.css';

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  pixelArt: true,
  scene: [LauncherScene, PixelInvadersScene, TunnelInvadersScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT
  }
};

new Phaser.Game(gameConfig);
