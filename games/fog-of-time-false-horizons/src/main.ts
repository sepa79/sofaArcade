import Phaser from 'phaser';

import { WORLD_HEIGHT, WORLD_WIDTH } from './game/constants';
import { FOG_OF_TIME_SCENE_KEY, FogOfTimeScene } from './scenes/fog-of-time-scene';
import './style.css';

class FogBootstrapScene extends Phaser.Scene {
  constructor() {
    super('fog-bootstrap');
  }

  create(): void {
    this.scene.start(FOG_OF_TIME_SCENE_KEY);
  }
}

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  pixelArt: true,
  scene: [FogBootstrapScene, FogOfTimeScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth || WORLD_WIDTH,
    height: window.innerHeight || WORLD_HEIGHT
  }
};

new Phaser.Game(gameConfig);
