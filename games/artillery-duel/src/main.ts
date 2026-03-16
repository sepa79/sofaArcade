import Phaser from 'phaser';

import { WORLD_HEIGHT, WORLD_WIDTH } from './game/constants';
import {
  ARTILLERY_DUEL_SCENE_KEY,
  ArtilleryDuelScene,
  type ArtilleryDuelSceneData
} from './scenes/artillery-duel-scene';
import './style.css';

const BOOTSTRAP_SCENE_KEY = 'artillery-duel-bootstrap';

const DEFAULT_LAUNCH_DATA: ArtilleryDuelSceneData = {
  controllerProfileId: 'artillery-duel-shared-keyboard-gamepad',
  controllerLabel: 'Shared Keyboard + Gamepad',
  audioMixProfileId: 'arcade',
  matchMode: 'solo-ai'
};

class BootstrapScene extends Phaser.Scene {
  constructor() {
    super(BOOTSTRAP_SCENE_KEY);
  }

  create(): void {
    this.scene.start(ARTILLERY_DUEL_SCENE_KEY, DEFAULT_LAUNCH_DATA);
  }
}

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  pixelArt: true,
  scene: [BootstrapScene, ArtilleryDuelScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth || WORLD_WIDTH,
    height: window.innerHeight || WORLD_HEIGHT
  }
};

new Phaser.Game(gameConfig);
