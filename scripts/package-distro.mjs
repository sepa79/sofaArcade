import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const distroAssetsDir = path.join(__dirname, 'distro-assets');
const gameBuildDir = path.join(repoRoot, 'games', 'pixel-invaders', 'dist');
const nodeRuntimeZipPath = path.join(distDir, 'node-win-x64.zip');
const signalPackageDir = path.join(repoRoot, 'apps', 'signal-server');
const signalSourceDir = path.join(repoRoot, 'apps', 'signal-server', 'src');
const LOCAL_DISTRO_SIGNAL_HTTP_URL = 'http://127.0.0.1:8788';
const LOCAL_DISTRO_PHONE_SIGNAL_HTTP_URL = 'https://127.0.0.1:8789';
const LOCAL_DISTRO_PHONE_CONTROLLER_ORIGIN = 'https://127.0.0.1:5443';

const LOCAL_ASSET_ITEMS = ['README.txt', 'ensure-dev-cert.ps1', 'start-local.cmd', 'static-server.cjs'];
const SIGNAL_ASSET_ITEMS = ['README.txt', 'start-signal.cmd'];

function fail(message) {
  throw new Error(message);
}

function requirePath(targetPath, label) {
  if (!existsSync(targetPath)) {
    fail(`Missing ${label}: ${targetPath}`);
  }
}

function run(command, args, cwd = repoRoot, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env
  });
  if (result.status !== 0) {
    fail(`Command failed (${command} ${args.join(' ')}) with exit code ${result.status ?? 'null'}.`);
  }
}

function copyNamedItems(sourceDir, targetDir, items) {
  mkdirSync(targetDir, { recursive: true });
  for (const item of items) {
    const sourcePath = path.join(sourceDir, item);
    requirePath(sourcePath, `asset "${item}"`);
    cpSync(sourcePath, path.join(targetDir, item), { recursive: true });
  }
}

function parseTag() {
  const tagIndex = process.argv.indexOf('--tag');
  if (tagIndex === -1) {
    return new Date().toISOString().slice(0, 10);
  }

  const rawTag = process.argv[tagIndex + 1];
  if (rawTag === undefined) {
    fail('Missing value for --tag.');
  }
  if (!/^[0-9A-Za-z._-]+$/.test(rawTag)) {
    fail(`Invalid --tag value "${rawTag}". Use only letters, digits, dot, underscore or dash.`);
  }

  return rawTag;
}

function compileSignalServer(outDir, tempRoot) {
  requirePath(signalSourceDir, 'signal server source directory');
  const tsconfigPath = path.join(signalPackageDir, '.tsconfig.distro.tmp.json');
  const outDirRelative = path.relative(signalPackageDir, outDir);
  const config = {
    extends: './tsconfig.json',
    compilerOptions: {
      noEmit: false,
      outDir: outDirRelative,
      rootDir: './src',
      module: 'CommonJS',
      moduleResolution: 'Node',
      verbatimModuleSyntax: false,
      types: ['node']
    },
    include: ['src/**/*.ts'],
    exclude: ['src/**/*.test.ts']
  };

  writeFileSync(tsconfigPath, `${JSON.stringify(config, null, 2)}\n`);
  try {
    run('pnpm', ['--filter', 'signal-server', 'exec', 'tsc', '-p', tsconfigPath]);
  } finally {
    rmSync(tsconfigPath, { force: true });
  }
}

function extractNodeRuntime(targetDir, tempRoot) {
  requirePath(nodeRuntimeZipPath, 'Windows Node runtime zip');
  const extractDir = path.join(tempRoot, 'node-extract');
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });

  run('python3', ['-m', 'zipfile', '-e', nodeRuntimeZipPath, extractDir]);

  const entries = readdirSync(extractDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (entries.length !== 1) {
    fail(`Expected exactly one extracted node runtime directory, got ${entries.length}.`);
  }

  cpSync(path.join(extractDir, entries[0].name), targetDir, { recursive: true });
}

function packageZip(zipPath, parentDir, folderName) {
  rmSync(zipPath, { force: true });
  run('python3', ['-m', 'zipfile', '-c', zipPath, folderName], parentDir);
}

function main() {
  const tag = parseTag();
  const tempRoot = path.join(distDir, '.packaging', tag);
  const localStageDir = path.join(tempRoot, 'light80-local-playable');
  const signalStageDir = path.join(tempRoot, 'portable-signal');
  const compiledSignalDir = path.join(tempRoot, 'signal-server');
  const localAssetsDir = path.join(distroAssetsDir, 'local-playable');
  const signalAssetsDir = path.join(distroAssetsDir, 'portable-signal');

  requirePath(localAssetsDir, 'local playable assets directory');
  requirePath(signalAssetsDir, 'portable signal assets directory');

  run('pnpm', ['--filter', 'pixel-invaders', 'build'], repoRoot, {
    ...process.env,
    VITE_SIGNAL_HTTP_URL: LOCAL_DISTRO_SIGNAL_HTTP_URL,
    VITE_PHONE_SIGNAL_HTTP_URL: LOCAL_DISTRO_PHONE_SIGNAL_HTTP_URL,
    VITE_PHONE_CONTROLLER_ORIGIN: LOCAL_DISTRO_PHONE_CONTROLLER_ORIGIN
  });
  requirePath(gameBuildDir, 'pixel-invaders build output');

  rmSync(tempRoot, { recursive: true, force: true });
  mkdirSync(tempRoot, { recursive: true });

  compileSignalServer(compiledSignalDir, tempRoot);

  copyNamedItems(localAssetsDir, localStageDir, LOCAL_ASSET_ITEMS);
  extractNodeRuntime(path.join(localStageDir, 'node'), tempRoot);
  cpSync(compiledSignalDir, path.join(localStageDir, 'signal-server'), { recursive: true });
  cpSync(gameBuildDir, path.join(localStageDir, 'web'), { recursive: true });

  copyNamedItems(signalAssetsDir, signalStageDir, SIGNAL_ASSET_ITEMS);
  extractNodeRuntime(path.join(signalStageDir, 'node'), tempRoot);
  cpSync(compiledSignalDir, path.join(signalStageDir, 'signal-server'), { recursive: true });

  const localZipPath = path.join(distDir, `light80-local-playable-windows-${tag}.zip`);
  const signalZipPath = path.join(distDir, `light80-signal-server-windows-portable-${tag}.zip`);

  packageZip(localZipPath, tempRoot, 'light80-local-playable');
  packageZip(signalZipPath, tempRoot, 'portable-signal');

  console.log(localZipPath);
  console.log(signalZipPath);
}

main();
