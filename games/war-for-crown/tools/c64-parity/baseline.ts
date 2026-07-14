import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface C64BaselineModule {
  readonly name: string;
  readonly loadAddress: number;
  readonly size: number;
  readonly sha256: string;
}

interface C64BaselineManifest {
  readonly schemaVersion: 1;
  readonly baselineId: string;
  readonly diskPath: string;
  readonly diskSha256: string;
  readonly extractedDirectory: string;
  readonly rawDirectory: string;
  readonly modules: ReadonlyArray<C64BaselineModule>;
}

export interface VerifiedC64Baseline {
  readonly manifest: C64BaselineManifest;
  readonly rawModulePaths: Readonly<Record<string, string>>;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }
  return value as number;
}

function requireSha256(value: unknown, label: string): string {
  const hash = requireString(value, label);
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error(`${label} must be a lowercase SHA-256 hash.`);
  }
  return hash;
}

function parseModule(value: unknown, index: number): C64BaselineModule {
  const record = requireRecord(value, `modules[${index}]`);
  const loadAddress = requireInteger(record.loadAddress, `modules[${index}].loadAddress`);
  const size = requireInteger(record.size, `modules[${index}].size`);
  if (loadAddress < 0 || loadAddress > 0xffff) {
    throw new Error(`modules[${index}].loadAddress must be a uint16.`);
  }
  if (size < 3) {
    throw new Error(`modules[${index}].size must include a two-byte load address and payload.`);
  }
  return {
    name: requireString(record.name, `modules[${index}].name`),
    loadAddress,
    size,
    sha256: requireSha256(record.sha256, `modules[${index}].sha256`)
  };
}

function parseManifest(value: unknown): C64BaselineManifest {
  const record = requireRecord(value, 'C64 baseline manifest');
  if (record.schemaVersion !== 1) {
    throw new Error(`Unsupported C64 baseline manifest schema version ${String(record.schemaVersion)}.`);
  }
  if (!Array.isArray(record.modules) || record.modules.length === 0) {
    throw new Error('C64 baseline manifest modules must be a non-empty array.');
  }
  const modules = record.modules.map(parseModule);
  const moduleNames = new Set(modules.map((module) => module.name));
  if (moduleNames.size !== modules.length) {
    throw new Error('C64 baseline manifest contains duplicate module names.');
  }
  return {
    schemaVersion: 1,
    baselineId: requireString(record.baselineId, 'baselineId'),
    diskPath: requireString(record.diskPath, 'diskPath'),
    diskSha256: requireSha256(record.diskSha256, 'diskSha256'),
    extractedDirectory: requireString(record.extractedDirectory, 'extractedDirectory'),
    rawDirectory: requireString(record.rawDirectory, 'rawDirectory'),
    modules
  };
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function requireHash(bytes: Uint8Array, expectedHash: string, label: string): void {
  const actualHash = sha256(bytes);
  if (actualHash !== expectedHash) {
    throw new Error(`${label} SHA-256 mismatch: expected ${expectedHash}, got ${actualHash}.`);
  }
}

function requireModulePayload(
  manifest: C64BaselineManifest,
  module: C64BaselineModule
): string {
  const extractedPath = join(manifest.extractedDirectory, module.name);
  const extracted = readFileSync(extractedPath);
  if (extracted.length !== module.size) {
    throw new Error(
      `C64 module ${module.name} size mismatch: expected ${module.size}, got ${extracted.length}.`
    );
  }
  requireHash(extracted, module.sha256, `C64 module ${module.name}`);
  const encodedLoadAddress = extracted[0] | (extracted[1] << 8);
  if (encodedLoadAddress !== module.loadAddress) {
    throw new Error(
      `C64 module ${module.name} load address mismatch: expected ${module.loadAddress}, got ${encodedLoadAddress}.`
    );
  }

  const rawPath = join(manifest.rawDirectory, `${manifest.baselineId}-${module.name}.raw`);
  const raw = readFileSync(rawPath);
  if (!raw.equals(extracted.subarray(2))) {
    throw new Error(`Raw C64 module ${module.name} does not match the extracted PRG payload.`);
  }
  return rawPath;
}

export function verifyC64Baseline(): VerifiedC64Baseline {
  const manifestUrl = new URL(
    '../../../../docs/war-for-crown/c64-baseline-manifest.json',
    import.meta.url
  );
  const manifest = parseManifest(JSON.parse(readFileSync(manifestUrl, 'utf8')) as unknown);
  requireHash(readFileSync(manifest.diskPath), manifest.diskSha256, `C64 disk ${manifest.baselineId}`);

  return {
    manifest,
    rawModulePaths: Object.fromEntries(
      manifest.modules.map((module) => [module.name, requireModulePayload(manifest, module)])
    )
  };
}

export function requireRawModulePath(baseline: VerifiedC64Baseline, moduleName: string): string {
  const path = baseline.rawModulePaths[moduleName];
  if (path === undefined) {
    throw new Error(`C64 baseline does not define module ${moduleName}.`);
  }
  return path;
}
