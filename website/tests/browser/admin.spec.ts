import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';

const root = resolve(import.meta.dirname, '../../..');

async function launchAdmin(): Promise<{
  server: ChildProcessWithoutNullStreams;
  url: string;
}> {
  const server = spawn(process.execPath, ['website/scripts/admin-server.mjs'], {
    cwd: root,
  });
  const url = await new Promise<string>((resolveUrl, reject) => {
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
  return { server, url };
}

test('локальная админка показывает публикации и очередь', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== 'desktop') return;
  const { server, url } = await launchAdmin();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(url);
    await expect(
      page.getByRole('heading', { name: 'Панель публикаций' }),
    ).toBeVisible();
    await expect(page.locator('#items .item').first()).toBeVisible();
    await page.locator('#items .item').first().click();
    await expect(page.locator('#details .detail-title')).toBeVisible();
    await page.screenshot({
      path: 'screenshots/admin-desktop.png',
      fullPage: true,
    });
    await page
      .getByPlaceholder('Поиск по названию, источнику, ID…')
      .fill('не-существует');
    await expect(page.getByText('Ничего не найдено')).toBeVisible();
    await page.getByPlaceholder('Поиск по названию, источнику, ID…').clear();
    await page.getByRole('tab', { name: 'Очередь' }).click();
    await expect(page.getByRole('tab', { name: 'Очередь' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.screenshot({
      path: 'screenshots/admin-queue-desktop.png',
      fullPage: true,
    });
    const response = await page.request.post('http://127.0.0.1:4317/api/state');
    expect(response.status()).toBe(405);
    await page.getByRole('tab', { name: 'Публикации' }).click();
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `overflow at ${width}px`,
      ).toBe(true);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('#items .item').first().click();
    await page.screenshot({
      path: 'screenshots/admin-mobile.png',
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    server.kill();
  }
});
