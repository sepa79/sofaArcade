import Phaser from 'phaser';

export type PlayableSceneKey = 'pixel-invaders' | 'tunnel-invaders' | 'statecraft';

export interface LazySceneLoader {
  ensureLoaded(sceneKey: PlayableSceneKey): Promise<void>;
}

export const LAZY_SCENE_LOADER_REGISTRY_KEY = 'pixel-invaders.lazy-scene-loader.v1';

interface SceneDefinition {
  readonly key: PlayableSceneKey;
  readonly sceneClass: Phaser.Types.Scenes.SceneType;
}

function hasScene(game: Phaser.Game, sceneKey: PlayableSceneKey): boolean {
  return game.scene.keys[sceneKey] !== undefined;
}

async function loadSceneDefinition(sceneKey: PlayableSceneKey): Promise<SceneDefinition> {
  if (sceneKey === 'pixel-invaders') {
    const sceneModule = await import('./scenes/pixel-invaders-scene');
    if (sceneModule.PIXEL_INVADERS_SCENE_KEY !== 'pixel-invaders') {
      throw new Error('Pixel scene key mismatch: expected "pixel-invaders".');
    }

    return {
      key: sceneModule.PIXEL_INVADERS_SCENE_KEY,
      sceneClass: sceneModule.PixelInvadersScene
    };
  }

  if (sceneKey === 'tunnel-invaders') {
    const sceneModule = await import('tunnel-invaders');
    if (sceneModule.TUNNEL_INVADERS_SCENE_KEY !== 'tunnel-invaders') {
      throw new Error('Tunnel scene key mismatch: expected "tunnel-invaders".');
    }

    return {
      key: sceneModule.TUNNEL_INVADERS_SCENE_KEY,
      sceneClass: sceneModule.TunnelInvadersScene
    };
  }

  if (sceneKey === 'statecraft') {
    const sceneModule = await import('statecraft');
    if (sceneModule.STATECRAFT_SCENE_KEY !== 'statecraft') {
      throw new Error('Statecraft scene key mismatch: expected "statecraft".');
    }

    return {
      key: sceneModule.STATECRAFT_SCENE_KEY,
      sceneClass: sceneModule.StatecraftScene
    };
  }

  throw new Error('Unsupported playable scene key.');
}

export function createLazySceneLoader(game: Phaser.Game): LazySceneLoader {
  const pendingLoads = new Map<PlayableSceneKey, Promise<void>>();

  return {
    async ensureLoaded(sceneKey: PlayableSceneKey): Promise<void> {
      if (hasScene(game, sceneKey)) {
        return;
      }

      const existingLoad = pendingLoads.get(sceneKey);
      if (existingLoad !== undefined) {
        await existingLoad;
        return;
      }

      const loadPromise = (async () => {
        const sceneDefinition = await loadSceneDefinition(sceneKey);
        if (sceneDefinition.key !== sceneKey) {
          throw new Error(`Loaded scene key mismatch: requested "${sceneKey}", loaded "${sceneDefinition.key}".`);
        }
        if (!hasScene(game, sceneKey)) {
          game.scene.add(sceneKey, sceneDefinition.sceneClass, false);
        }
      })();

      pendingLoads.set(sceneKey, loadPromise);
      try {
        await loadPromise;
      } finally {
        pendingLoads.delete(sceneKey);
      }
    }
  };
}

export function requireLazySceneLoader(scene: Phaser.Scene): LazySceneLoader {
  const loaderCandidate = scene.game.registry.get(LAZY_SCENE_LOADER_REGISTRY_KEY) as unknown;
  if (typeof loaderCandidate !== 'object' || loaderCandidate === null) {
    throw new Error('Lazy scene loader is missing in game registry.');
  }

  const loader = loaderCandidate as Partial<LazySceneLoader>;
  if (typeof loader.ensureLoaded !== 'function') {
    throw new Error('Lazy scene loader in registry must expose ensureLoaded(sceneKey).');
  }

  return loader as LazySceneLoader;
}
