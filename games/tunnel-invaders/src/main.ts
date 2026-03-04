import Phaser from 'phaser';

import { WORLD_HEIGHT, WORLD_WIDTH } from './game/constants';
import {
  TUNNEL_INVADERS_SCENE_KEY,
  TunnelInvadersScene,
  type TunnelInvadersSceneData
} from './scenes/tunnel-invaders-scene';
import './style.css';

const TUNNEL_BOOTSTRAP_SCENE_KEY = 'tunnel-bootstrap';
const DEFAULT_LAUNCH_DATA: TunnelInvadersSceneData = {
  controllerProfileId: 'tunnel-invaders-keyboard-gamepad',
  controllerLabel: 'Keyboard + Gamepad',
  audioMixProfileId: 'cinema'
};

class TunnelBootstrapScene extends Phaser.Scene {
  constructor() {
    super(TUNNEL_BOOTSTRAP_SCENE_KEY);
  }

  create(): void {
    this.scene.start(TUNNEL_INVADERS_SCENE_KEY, DEFAULT_LAUNCH_DATA);
  }
}

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  pixelArt: true,
  scene: [TunnelBootstrapScene, TunnelInvadersScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth || WORLD_WIDTH,
    height: window.innerHeight || WORLD_HEIGHT
  }
};

new Phaser.Game(gameConfig);
