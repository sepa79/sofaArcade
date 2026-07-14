import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ARCADE_GAMES } from '../config/arcade-games.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const pagesDistDir = path.join(repoRoot, 'dist', 'pages');

function requireBasePath() {
  const basePath = process.env.BASE_PATH;
  if (basePath === undefined) {
    throw new Error('Missing required BASE_PATH for Sofa Arcade deployment.');
  }
  if (!basePath.startsWith('/') || !basePath.endsWith('/')) {
    throw new Error(`BASE_PATH must start and end with "/": ${basePath}`);
  }
  return basePath;
}

function runBuild(packageName, basePath, extraEnvironment = {}) {
  const result = spawnSync(
    'pnpm',
    ['--filter', packageName, 'run', 'build', '--base', basePath],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, ...extraEnvironment }
    }
  );
  if (result.status !== 0) {
    throw new Error(`Build failed for ${packageName} with exit code ${String(result.status)}.`);
  }
}

function copyBuild(sourcePath, targetPath, label) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing ${label} build output: ${sourcePath}`);
  }
  mkdirSync(path.dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath, { recursive: true });
}

function main() {
  const basePath = requireBasePath();
  rmSync(pagesDistDir, { recursive: true, force: true });

  runBuild('arcade-launcher', basePath);
  copyBuild(
    path.join(repoRoot, 'apps', 'arcade-launcher', 'dist'),
    pagesDistDir,
    'arcade-launcher'
  );

  for (const game of ARCADE_GAMES) {
    const gameBasePath = `${basePath}${game.route}/`;
    const environment =
      game.packageName === 'war-for-crown'
        ? { VITE_ARCADE_HOME_URL: basePath }
        : {};
    runBuild(game.packageName, gameBasePath, environment);
    copyBuild(
      path.join(repoRoot, 'games', game.packageName, 'dist'),
      path.join(pagesDistDir, game.route),
      game.packageName
    );
  }
}

main();
