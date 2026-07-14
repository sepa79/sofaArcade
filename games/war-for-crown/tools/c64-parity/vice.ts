import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const SAFE_PATH = /^[A-Za-z0-9_./-]+$/;

function requireSafePath(path: string, label: string): void {
  if (!SAFE_PATH.test(path)) {
    throw new Error(`${label} contains unsupported shell characters: ${path}.`);
  }
}

export function writeMonitorCommands(path: string, commands: ReadonlyArray<string>): void {
  requireSafePath(path, 'Monitor command path');
  if (commands.length === 0) {
    throw new Error('VICE monitor command list must not be empty.');
  }
  writeFileSync(path, `${commands.join('\n')}\n`, 'utf8');
}

export function runViceMonitor(
  monitorPath: string,
  cycleLimit: number,
  timeoutSeconds = 30
): void {
  requireSafePath(monitorPath, 'Monitor command path');
  if (!Number.isInteger(cycleLimit) || cycleLimit < 1) {
    throw new Error(`VICE cycle limit must be a positive integer, got ${cycleLimit}.`);
  }
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1) {
    throw new Error(`VICE timeout must be a positive integer, got ${timeoutSeconds}.`);
  }
  const command = [
    `timeout ${timeoutSeconds}`,
    'xvfb-run -a x64sc',
    '-default',
    '-sounddev dummy',
    '-warp',
    '-nativemonitor',
    '-initbreak reset',
    `-moncommands ${monitorPath}`,
    `-limitcycles ${cycleLimit}`
  ].join(' ');
  const result = spawnSync('script', ['-q', '-e', '-c', command, '/dev/null'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `VICE monitor failed with exit ${String(result.status)}.\n${result.stdout}\n${result.stderr}`
    );
  }
}
