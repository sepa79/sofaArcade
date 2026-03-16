import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import * as path from 'node:path';

import { ensureDir } from '../util/fs';

export type JobStatus = 'processing' | 'done' | 'failed';

export interface SyncJob {
  readonly id: string;
  readonly sourceFileName: string;
  readonly inputPath: string;
  readonly outputPath: string;
  readonly createdAtMs: number;
  status: JobStatus;
  error: string | null;
}

interface PersistedJob {
  readonly id: string;
  readonly sourceFileName: string;
  readonly inputPath: string;
  readonly outputPath: string;
  readonly createdAtMs: number;
  readonly status: JobStatus;
  readonly error: string | null;
}

export interface JobStore {
  create(job: SyncJob): void;
  get(jobId: string): SyncJob;
  setDone(jobId: string): void;
  setFailed(jobId: string, error: string): void;
}

const JOB_META_FILE_NAME = 'job.json';

function requireStringField(value: unknown, fieldName: string, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${context} must contain non-empty string field "${fieldName}".`);
  }

  return value;
}

function requireNumberField(value: unknown, fieldName: string, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context} must contain finite number field "${fieldName}".`);
  }

  return value;
}

function requireStatusField(value: unknown, context: string): JobStatus {
  if (value === 'processing' || value === 'done' || value === 'failed') {
    return value;
  }

  throw new Error(`${context} has invalid status value.`);
}

function parsePersistedJob(raw: string, context: string): SyncJob {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${context} must contain object.`);
  }

  const object = parsed as Record<string, unknown>;
  const job: SyncJob = {
    id: requireStringField(object.id, 'id', context),
    sourceFileName: requireStringField(object.sourceFileName, 'sourceFileName', context),
    inputPath: requireStringField(object.inputPath, 'inputPath', context),
    outputPath: requireStringField(object.outputPath, 'outputPath', context),
    createdAtMs: requireNumberField(object.createdAtMs, 'createdAtMs', context),
    status: requireStatusField(object.status, context),
    error: object.error === null ? null : requireStringField(object.error, 'error', context)
  };

  if (!path.isAbsolute(job.inputPath) || !path.isAbsolute(job.outputPath)) {
    throw new Error(`${context} must contain absolute input/output paths.`);
  }

  return job;
}

function jobDirPath(rootDir: string, jobId: string): string {
  return path.join(rootDir, jobId);
}

function jobMetaPath(rootDir: string, jobId: string): string {
  return path.join(jobDirPath(rootDir, jobId), JOB_META_FILE_NAME);
}

function toPersistedJob(job: SyncJob): PersistedJob {
  return {
    id: job.id,
    sourceFileName: job.sourceFileName,
    inputPath: job.inputPath,
    outputPath: job.outputPath,
    createdAtMs: job.createdAtMs,
    status: job.status,
    error: job.error
  };
}

function persistJob(rootDir: string, job: SyncJob): void {
  const jobDir = jobDirPath(rootDir, job.id);
  mkdirSync(jobDir, { recursive: true });
  const jobPath = jobMetaPath(rootDir, job.id);
  writeFileSync(jobPath, `${JSON.stringify(toPersistedJob(job), null, 2)}\n`, 'utf8');
}

async function migrateLegacyJob(jobRootDir: string, jobId: string): Promise<SyncJob> {
  const jobDir = jobDirPath(jobRootDir, jobId);
  const files = await readdir(jobDir, { withFileTypes: true });
  const dataFiles = files.filter((entry) => entry.isFile()).map((entry) => entry.name);

  const audioCandidates = dataFiles.filter((fileName) => fileName !== 'track.sync.json' && fileName !== JOB_META_FILE_NAME);
  const sourceFileName =
    audioCandidates.length > 0
      ? [...audioCandidates].sort((a, b) => a.localeCompare(b))[0]
      : 'missing-source.legacy';
  if (sourceFileName === undefined) {
    throw new Error(`Legacy job "${jobId}" source filename resolution failed.`);
  }

  const inputPath = path.join(jobDir, sourceFileName);
  const outputPath = path.join(jobDir, 'track.sync.json');
  const outputExists = existsSync(outputPath);
  const dirStat = await stat(jobDir);

  let error: string | null = null;
  if (audioCandidates.length === 0) {
    error = 'Legacy job metadata missing and source file not found.';
  } else if (audioCandidates.length > 1) {
    error = `Legacy job metadata missing and has multiple source files (${audioCandidates.length}).`;
  } else if (!outputExists) {
    error = 'Legacy job metadata missing and sync output not found.';
  }

  const migrated: SyncJob = {
    id: jobId,
    sourceFileName,
    inputPath,
    outputPath,
    createdAtMs: dirStat.mtimeMs,
    status: error === null ? 'done' : 'failed',
    error
  };

  persistJob(jobRootDir, migrated);
  return migrated;
}

async function loadJobs(jobRootDir: string): Promise<Map<string, SyncJob>> {
  const jobs = new Map<string, SyncJob>();
  const entries = await readdir(jobRootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const jobId = entry.name;
    const metadataPath = jobMetaPath(jobRootDir, jobId);
    let job: SyncJob;

    if (existsSync(metadataPath)) {
      const raw = await readFile(metadataPath, 'utf8');
      job = parsePersistedJob(raw, `Job metadata file "${metadataPath}"`);
    } else {
      job = await migrateLegacyJob(jobRootDir, jobId);
    }

    if (job.status === 'processing') {
      job.status = 'failed';
      job.error = 'Job interrupted by server restart.';
      persistJob(jobRootDir, job);
    }

    jobs.set(job.id, job);
  }

  return jobs;
}

class PersistentJobStore implements JobStore {
  constructor(
    private readonly rootDir: string,
    private readonly jobs: Map<string, SyncJob>
  ) {}

  create(job: SyncJob): void {
    if (this.jobs.has(job.id)) {
      throw new Error(`Job already exists: "${job.id}".`);
    }

    this.jobs.set(job.id, job);
    persistJob(this.rootDir, job);
  }

  get(jobId: string): SyncJob {
    const job = this.jobs.get(jobId);
    if (job === undefined) {
      throw new Error(`Job not found: "${jobId}".`);
    }

    return job;
  }

  setDone(jobId: string): void {
    const job = this.get(jobId);
    job.status = 'done';
    job.error = null;
    persistJob(this.rootDir, job);
  }

  setFailed(jobId: string, error: string): void {
    const job = this.get(jobId);
    job.status = 'failed';
    job.error = error;
    persistJob(this.rootDir, job);
  }
}

export async function createJobStore(jobRootDir: string): Promise<JobStore> {
  await ensureDir(jobRootDir);
  const jobs = await loadJobs(jobRootDir);
  return new PersistentJobStore(jobRootDir, jobs);
}
