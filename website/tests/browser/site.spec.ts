import { test, expect } from '@playwright/test';

async function prepareScreenshot(page: import('@playwright/test').Page) {
  await page.locator('img[loading="lazy"]').evaluateAll(async (images) => {
    await Promise.all(
      images.map(async (image) => {
        const img = image as HTMLImageElement;
        img.loading = 'eager';
        await img.decode().catch(() => undefined);
      }),
    );
  });
  await page.evaluate(() => window.scrollTo(0, 0));
}

test('home, search and publication navigation', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  const catalog = (await (
    await page.request.get('/catalog.json')
  ).json()) as Array<{ title: string; messageId: number }>;
  const first = catalog[0]!;
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Зачем платить',
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex,nofollow',
  );
  await expect(page.locator('#catalog .offer-card')).toHaveCount(
    catalog.length,
  );
  await prepareScreenshot(page);
  await page.screenshot({
    path: `screenshots/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByPlaceholder('Найти игру, программу, платформу...')
    .fill(first.title);
  await page.getByRole('button', { name: 'Найти' }).click();
  await expect(page.locator('#catalog .offer-card')).toHaveCount(1);
  await page.locator('#catalog .offer-card h3 a').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    first.title,
  );
  await expect(
    page.getByRole('link', { name: /Пост в Telegram/ }),
  ).toHaveAttribute('href', `https://t.me/halyava_exe_hub/${first.messageId}`);
  await prepareScreenshot(page);
  await page.screenshot({
    path: `screenshots/post-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('empty search state is useful', async ({ page }) => {
  await page.goto('/?q=term-that-has-no-results');
  await expect(page.locator('#catalog .offer-card')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Ничего не найдено' }),
  ).toBeVisible();
});

test('required viewport widths have no horizontal overflow', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== 'desktop') return;
  for (const width of [320, 375, 425, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow at ${width}px`,
    ).toBe(true);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('404 and mobile menu', async ({ page }, testInfo) => {
  await page.goto('/does-not-exist/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Похоже, здесь пусто',
  );
  if (testInfo.project.name === 'mobile') {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const menu = page.getByRole('button', { name: 'Открыть меню' });
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page
        .getByRole('navigation', { name: 'Основная навигация' })
        .getByRole('link', { name: 'Игры' }),
    ).toBeVisible();
  }
});
