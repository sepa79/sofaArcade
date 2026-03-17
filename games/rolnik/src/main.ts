import Phaser from 'phaser';

import { WORLD_HEIGHT, WORLD_WIDTH } from './game/constants';
import {
  ROLNIK_LAUNCHER_SCENE_KEY,
  RolnikLauncherScene,
  type RolnikLauncherSceneData
} from './scenes/rolnik-launcher-scene';
import { RolnikScene } from './scenes/rolnik-scene';
import './style.css';

const ROLNIK_BOOTSTRAP_SCENE_KEY = 'rolnik-bootstrap';

const DEFAULT_LAUNCH_DATA: RolnikLauncherSceneData = {
  controllerProfileId: 'rolnik-shared-keyboard-gamepad',
  controllerLabel: 'Keyboard + Gamepad',
  audioMixProfileId: 'arcade',
  startingProfileIds: ['dairy-start', 'pork-start']
};

class RolnikBootstrapScene extends Phaser.Scene {
  constructor() {
    super(ROLNIK_BOOTSTRAP_SCENE_KEY);
  }

  create(): void {
    this.scene.start(ROLNIK_LAUNCHER_SCENE_KEY, DEFAULT_LAUNCH_DATA);
  }
}

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  pixelArt: true,
  scene: [RolnikBootstrapScene, RolnikLauncherScene, RolnikScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth || WORLD_WIDTH,
    height: window.innerHeight || WORLD_HEIGHT
  }
};

new Phaser.Game(gameConfig);
