import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
let server: ChildProcessWithoutNullStreams;
let tokenUrl: string;
let cookie: string;

beforeAll(async () => {
  server = spawn(process.execPath, ['website/scripts/admin-server.mjs'], {
    cwd: root,
  });
  tokenUrl = await new Promise<string>((resolveUrl, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Админка не запустилась')),
      8000,
    );
    server.stdout.on('data', (chunk: Buffer) => {
      const match = chunk
        .toString()
        .match(/http:\/\/127\.0\.0\.1:4317\/\?token=[a-f0-9]+/);
      if (match) {
        clearTimeout(timeout);
        resolveUrl(match[0]);
      }
    });
    server.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Админка завершилась: ${code}`));
    });
  });
  const login = await fetch(tokenUrl, { redirect: 'manual' });
  expect(login.status).toBe(302);
  cookie = login.headers.get('set-cookie')!.split(';')[0]!;
});

afterAll(() => server?.kill());

describe('локальная админка только для чтения', () => {
  it('не раскрывает данные без локального токена', async () => {
    expect((await fetch('http://127.0.0.1:4317/api/state')).status).toBe(403);
  });

  it('отдаёт только выбранные поля публикаций и очереди', async () => {
    const response = await fetch('http://127.0.0.1:4317/api/state', {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      published: Array<Record<string, unknown>>;
      queue: Array<Record<string, unknown>>;
    };
    expect(data.published.length).toBeGreaterThan(0);
    expect(Object.keys(data.published[0]!)).toEqual([
      'id',
      'title',
      'category',
      'channelId',
      'platforms',
      'currentPrice',
      'offerType',
      'endsAt',
      'sentAt',
      'messageId',
      'source',
      'sourceUrl',
      'telegramUrl',
      'status',
    ]);
    expect(
      data.queue.every((item) => !('offer' in item) && !('key' in item)),
    ).toBe(true);
  });

  it('отклоняет любые записи', async () => {
    const response = await fetch('http://127.0.0.1:4317/api/state', {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(405);
  });
});
