import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import type { PublishedEntry, QueueEntry } from '../types/index.js';

const dataPath = (name: string) =>
  join(process.env.STATE_DIR ?? join(process.cwd(), 'data'), name);

async function readArray<T>(path: string): Promise<T[]> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(value)) throw new Error(`Invalid state: ${path}`);
  return value as T[];
}

async function atomicWrite(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(data, null, 2) + '\n');
  await rename(temporary, path);
}

export interface State {
  queue: QueueEntry[];
  published: PublishedEntry[];
  reports: Record<string, string>;
}

export async function loadState(): Promise<State> {
  const reports: unknown = JSON.parse(
    await readFile(dataPath('reports.json'), 'utf8'),
  );
  if (!reports || typeof reports !== 'object' || Array.isArray(reports))
    throw new Error('Invalid report state');
  return {
    queue: await readArray<QueueEntry>(dataPath('queue.json')),
    published: await readArray<PublishedEntry>(dataPath('published.json')),
    reports: reports as Record<string, string>,
  };
}

export async function saveState(state: State): Promise<void> {
  await atomicWrite(dataPath('queue.json'), state.queue);
  await atomicWrite(dataPath('published.json'), state.published);
  await atomicWrite(dataPath('reports.json'), state.reports);
}

function git(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`git ${args[0]} failed: ${code}`)),
    );
  });
}

export async function checkpoint(state: State, label: string): Promise<void> {
  await saveState(state);
  if (process.env.STATE_SYNC_GIT !== 'true') return;
  await git([
    'add',
    '--',
    'data/queue.json',
    'data/published.json',
    'data/reports.json',
  ]);
  const ref = process.env.GITHUB_REF;
  if (!ref || !/^refs\/heads\/[A-Za-z0-9._/-]+$/.test(ref))
    throw new Error('STATE_SYNC_GIT requires a branch GITHUB_REF');
  // An empty diff is normal on runs with no new offers.
  await new Promise<void>((resolve, reject) => {
    const child = spawn('git', [
      'diff',
      '--cached',
      '--quiet',
      '--',
      'data/queue.json',
      'data/published.json',
      'data/reports.json',
    ]);
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else if (code === 1) {
        git([
          'commit',
          '-m',
          `state: ${label} [skip ci]`,
          '--',
          'data/queue.json',
          'data/published.json',
          'data/reports.json',
        ])
          .then(() => git(['push', 'origin', `HEAD:${ref}`]))
          .then(resolve, reject);
      } else reject(new Error('git diff failed'));
    });
  });
}
