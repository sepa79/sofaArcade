import Phaser from 'phaser';
import { TunnelInvadersScene } from 'tunnel-invaders';

import { WORLD_HEIGHT, WORLD_WIDTH } from './game/constants';
import { LauncherScene } from './scenes/launcher-scene';
import { PixelInvadersScene } from './scenes/pixel-invaders-scene';
import './style.css';

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  pixelArt: true,
  scene: [LauncherScene, PixelInvadersScene, TunnelInvadersScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    fullscreenTarget: 'app',
    width: window.innerWidth || WORLD_WIDTH,
    height: window.innerHeight || WORLD_HEIGHT
  }
};

new Phaser.Game(gameConfig);
