import { spawn } from 'node:child_process';

export interface DecodedAudio {
  readonly samples: Float32Array;
  readonly sampleRateHz: number;
  readonly durationSec: number;
}

async function runProcess(command: string, args: ReadonlyArray<string>): Promise<{ readonly stdout: Buffer; readonly stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}. ${stderr}`.trim()));
        return;
      }

      resolve({
        stdout: Buffer.concat(stdoutChunks),
        stderr
      });
    });
  });
}

function parseF32LeBuffer(buffer: Buffer): Float32Array {
  if (buffer.length % 4 !== 0) {
    throw new Error(`Decoded PCM buffer length must be multiple of 4, got ${buffer.length}.`);
  }

  const samples = new Float32Array(buffer.length / 4);
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    samples[sampleIndex] = buffer.readFloatLE(sampleIndex * 4);
  }

  return samples;
}

async function probeDurationSec(inputPath: string): Promise<number> {
  const probe = await runProcess('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    inputPath
  ]);

  const parsed = Number.parseFloat(probe.stdout.toString('utf8').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`ffprobe returned invalid duration for "${inputPath}".`);
  }

  return parsed;
}

export async function decodeAudioFile(inputPath: string, sampleRateHz: number): Promise<DecodedAudio> {
  const durationSec = await probeDurationSec(inputPath);
  const decoded = await runProcess('ffmpeg', [
    '-v',
    'error',
    '-i',
    inputPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    String(sampleRateHz),
    '-f',
    'f32le',
    'pipe:1'
  ]);

  const samples = parseF32LeBuffer(decoded.stdout);
  if (samples.length === 0) {
    throw new Error(`ffmpeg produced empty audio stream for "${inputPath}".`);
  }

  return {
    samples,
    sampleRateHz,
    durationSec
  };
}
