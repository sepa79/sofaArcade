import './style.css';
import { isControllerMode, mountControllerMode } from './phone/controller-app';
import { loadPixelUiFonts } from './ui/typography';

const app = document.querySelector<HTMLElement>('#app');
if (app === null) {
  throw new Error('#app container is missing.');
}

void (async () => {
  await loadPixelUiFonts();

  if (isControllerMode()) {
    mountControllerMode(app);
    return;
  }

  const [{ default: Phaser }, { WORLD_HEIGHT, WORLD_WIDTH }, sceneLoaderModule, launcherSceneModule] =
    await Promise.all([
      import('phaser'),
      import('./game/constants'),
      import('./scene-loader'),
      import('./scenes/launcher-scene')
    ]);

  const gameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'app',
    pixelArt: true,
    scene: [launcherSceneModule.LauncherScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      fullscreenTarget: 'app',
      width: window.innerWidth || WORLD_WIDTH,
      height: window.innerHeight || WORLD_HEIGHT
    }
  };

  const game = new Phaser.Game(gameConfig);
  game.registry.set(
    sceneLoaderModule.LAZY_SCENE_LOADER_REGISTRY_KEY,
    sceneLoaderModule.createLazySceneLoader(game)
  );
})();
