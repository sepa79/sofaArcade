import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createJobStore, type SyncJob } from '../src/jobs/store';

async function withTempDir(testBody: (dirPath: string) => Promise<void>): Promise<void> {
  const dirPath = await mkdtemp(path.join(tmpdir(), 'msx-sync-job-store-'));
  try {
    await testBody(dirPath);
  } finally {
    await rm(dirPath, { recursive: true, force: true });
  }
}

describe('job store persistence', () => {
  it('persists done status and reloads it after restart', async () => {
    await withTempDir(async (rootDir) => {
      const jobId = 'job-persisted';
      const jobDir = path.join(rootDir, jobId);

      const job: SyncJob = {
        id: jobId,
        sourceFileName: 'track.mp3',
        inputPath: path.join(jobDir, 'track.mp3'),
        outputPath: path.join(jobDir, 'track.sync.json'),
        createdAtMs: 1000,
        status: 'processing',
        error: null
      };

      const store = await createJobStore(rootDir);
      store.create(job);
      store.setDone(jobId);

      const reloadedStore = await createJobStore(rootDir);
      const reloaded = reloadedStore.get(jobId);
      expect(reloaded.status).toBe('done');
      expect(reloaded.error).toBeNull();
    });
  });

  it('marks processing job as failed on restart', async () => {
    await withTempDir(async (rootDir) => {
      const jobId = 'job-interrupted';
      const jobDir = path.join(rootDir, jobId);
      await mkdir(jobDir, { recursive: true });

      const inputPath = path.join(jobDir, 'song.mp3');
      const outputPath = path.join(jobDir, 'track.sync.json');
      const jobMetaPath = path.join(jobDir, 'job.json');

      await writeFile(inputPath, 'fake-audio', 'utf8');
      await writeFile(
        jobMetaPath,
        JSON.stringify(
          {
            id: jobId,
            sourceFileName: 'song.mp3',
            inputPath,
            outputPath,
            createdAtMs: 2000,
            status: 'processing',
            error: null
          },
          null,
          2
        ),
        'utf8'
      );

      const store = await createJobStore(rootDir);
      const recovered = store.get(jobId);
      expect(recovered.status).toBe('failed');
      expect(recovered.error).toBe('Job interrupted by server restart.');
    });
  });

  it('migrates legacy job folder without job.json', async () => {
    await withTempDir(async (rootDir) => {
      const jobId = 'legacy-job';
      const jobDir = path.join(rootDir, jobId);
      await mkdir(jobDir, { recursive: true });

      await writeFile(path.join(jobDir, 'legacy.mp3'), 'fake-audio', 'utf8');
      await writeFile(path.join(jobDir, 'track.sync.json'), '{"schema_version":"1.0"}', 'utf8');

      const store = await createJobStore(rootDir);
      const migrated = store.get(jobId);
      expect(migrated.status).toBe('done');
      expect(migrated.sourceFileName).toBe('legacy.mp3');
      expect(existsSync(path.join(jobDir, 'job.json'))).toBe(true);
    });
  });

  it('marks empty legacy job directory as failed and keeps server bootable', async () => {
    await withTempDir(async (rootDir) => {
      const jobId = 'legacy-empty';
      const jobDir = path.join(rootDir, jobId);
      await mkdir(jobDir, { recursive: true });

      const store = await createJobStore(rootDir);
      const migrated = store.get(jobId);
      expect(migrated.status).toBe('failed');
      expect(migrated.error).toBe('Legacy job metadata missing and source file not found.');
      expect(migrated.sourceFileName).toBe('missing-source.legacy');
      expect(existsSync(path.join(jobDir, 'job.json'))).toBe(true);
    });
  });
});
