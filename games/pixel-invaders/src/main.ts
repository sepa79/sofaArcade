import Phaser from 'phaser';

import { WORLD_HEIGHT, WORLD_WIDTH } from './game/constants';
import { createLazySceneLoader, LAZY_SCENE_LOADER_REGISTRY_KEY } from './scene-loader';
import { LauncherScene } from './scenes/launcher-scene';
import './style.css';

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  pixelArt: true,
  scene: [LauncherScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    fullscreenTarget: 'app',
    width: window.innerWidth || WORLD_WIDTH,
    height: window.innerHeight || WORLD_HEIGHT
  }
};

const game = new Phaser.Game(gameConfig);
game.registry.set(LAZY_SCENE_LOADER_REGISTRY_KEY, createLazySceneLoader(game));
