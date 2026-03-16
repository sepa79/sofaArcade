import { randomUUID } from 'node:crypto';
import * as path from 'node:path';

import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';

import { loadConfig } from './config';
import { createJobStore, type SyncJob } from './jobs/store';
import { compileTrack } from './sync/compiler';
import { appRootPath, ensureDir, moveFile, sanitizeFileName } from './util/fs';

async function startServer(): Promise<void> {
  const config = loadConfig();
  const publicDir = appRootPath('public');
  const tempUploadDir = appRootPath('.tmp', 'uploads');
  const jobsRootDir = appRootPath('data', 'jobs');

  await ensureDir(publicDir);
  await ensureDir(tempUploadDir);
  await ensureDir(jobsRootDir);

  const jobStore = await createJobStore(jobsRootDir);

  const app = express();
  const upload = multer({ dest: tempUploadDir });

  async function processJob(job: SyncJob): Promise<void> {
    try {
      await compileTrack({
        inputPath: job.inputPath,
        outputPath: job.outputPath,
        sourceFileName: job.sourceFileName,
        sampleRateHz: config.sampleRateHz,
        curveFps: config.curveFps,
        beatsPerBar: config.beatsPerBar
      });

      jobStore.setDone(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync compile error.';
      jobStore.setFailed(job.id, message);
    }
  }

  function getJobOr404(req: Request, res: Response): SyncJob | null {
    try {
      return jobStore.get(req.params.jobId);
    } catch {
      res.status(404).json({ error: 'job_not_found' });
      return null;
    }
  }

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.post('/api/sync/jobs', upload.single('track'), async (req, res, next) => {
    try {
      if (req.file === undefined) {
        throw new Error('Missing uploaded file under field "track".');
      }

      const jobId = randomUUID();
      const sourceFileName = sanitizeFileName(req.file.originalname);
      const jobDir = path.join(jobsRootDir, jobId);
      const inputPath = path.join(jobDir, sourceFileName);
      const outputPath = path.join(jobDir, 'track.sync.json');

      await ensureDir(jobDir);
      await moveFile(req.file.path, inputPath);

      const job: SyncJob = {
        id: jobId,
        sourceFileName,
        inputPath,
        outputPath,
        createdAtMs: Date.now(),
        status: 'processing',
        error: null
      };

      jobStore.create(job);
      void processJob(job);

      res.status(202).json({
        jobId,
        statusUrl: `/api/sync/jobs/${jobId}`,
        resultUrl: `/api/sync/jobs/${jobId}/result`,
        audioUrl: `/api/sync/jobs/${jobId}/audio`
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/sync/jobs/:jobId', (req, res) => {
    const job = getJobOr404(req, res);
    if (job === null) {
      return;
    }

    res.status(200).json({
      jobId: job.id,
      sourceFileName: job.sourceFileName,
      status: job.status,
      error: job.error,
      createdAtMs: job.createdAtMs,
      resultUrl: job.status === 'done' ? `/api/sync/jobs/${job.id}/result` : null,
      audioUrl: job.status === 'done' ? `/api/sync/jobs/${job.id}/audio` : null
    });
  });

  app.get('/api/sync/jobs/:jobId/result', (req, res) => {
    const job = getJobOr404(req, res);
    if (job === null) {
      return;
    }

    if (job.status !== 'done') {
      res.status(409).json({ error: `job_status_${job.status}` });
      return;
    }

    res.sendFile(job.outputPath);
  });

  app.get('/api/sync/jobs/:jobId/audio', (req, res) => {
    const job = getJobOr404(req, res);
    if (job === null) {
      return;
    }

    res.sendFile(job.inputPath);
  });

  app.use(express.static(publicDir));

  app.get('/', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unknown server error.';
    res.status(400).json({ error: message });
  });

  app.listen(config.port, () => {
    console.log(`sync-server listening on :${config.port}`);
  });
}

void startServer();
