import { copyFile, mkdir, unlink } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

export function appRootPath(...parts: string[]): string {
  return path.resolve(CURRENT_DIR, '..', '..', ...parts);
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function moveFile(from: string, to: string): Promise<void> {
  await ensureDir(path.dirname(to));
  await copyFile(from, to);
  await unlink(from);
}

export function sanitizeFileName(rawName: string): string {
  const trimmed = rawName.trim();
  if (trimmed.length === 0) {
    throw new Error('Uploaded filename is empty.');
  }

  return trimmed.replace(/[^a-zA-Z0-9._-]/g, '_');
}
