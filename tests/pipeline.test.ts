import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeGamerPower, gamerpower } from '../src/sources/gamerpower.js';
import { validOffer } from '../src/services/validator.js';
import { isDuplicate, offerKey } from '../src/services/deduplicator.js';
import { canPublish, chooseNext } from '../src/services/scheduler.js';
import { generatePost } from '../src/generators/post.js';
import { generateImage } from '../src/generators/image.js';
import { loadState, saveState } from '../src/services/storage.js';
import { sendPhoto, TelegramError } from '../src/publishers/telegram.js';
import { inspectBot } from '../src/telegram-check.js';
import { main } from '../src/index.js';
import { parseLootScraper } from '../src/sources/lootscraper.js';
import { siteRecord, offerScore } from '../src/services/editorial.js';
import { generateShortsBrief } from '../src/generators/shorts.js';
import { generateWeeklyDigest } from '../src/generators/digest.js';
import type {
  Channel,
  Offer,
  PublishedEntry,
  QueueEntry,
} from '../src/types/index.js';

const now = new Date('2026-11-27T10:00:00Z');
const channel: Channel = {
  id: 'games',
  enabled: true,
  name: 'Халява.exe',
  language: 'ru',
  timezone: 'Europe/Moscow',
  sources: ['gamerpower'],
  categories: ['game', 'dlc'],
  maxPostsPerDay: 5,
  minPostIntervalMinutes: 180,
  publishHours: { from: '09:00', to: '22:00' },
  telegramChatIdEnv: 'TELEGRAM_CHANNEL_ID',
};
const raw = {
  id: 123,
  title: 'Game (Steam) Giveaway',
  description: 'A game',
  type: 'Game',
  platforms: 'PC, Steam',
  worth: '$10',
  status: 'Active',
  end_date: '2026-12-01 23:59:00',
  published_date: '2026-11-26 12:00:00',
  gamerpower_url: 'https://www.gamerpower.com/game',
};
const offer = normalizeGamerPower(raw, now)!;
const queued = (item: Offer): QueueEntry => ({
  key: offerKey(item),
  channelId: channel.id,
  offer: item,
  queuedAt: now.toISOString(),
  status: 'queued',
});
const sent = (time: string): PublishedEntry => ({
  key: offerKey(offer),
  channelId: channel.id,
  offer,
  sentAt: time,
  messageId: 1,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.STATE_DIR;
  delete process.env.DRY_RUN_DIR;
  delete process.env.DRY_RUN;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHANNEL_ID;
  delete process.env.TELEGRAM_ADMIN_ID;
  delete process.env.TEST_PUBLISH;
  delete process.env.STATE_SYNC_GIT;
  process.exitCode = 0;
});

describe('source and validation', () => {
  it('parses direct store links and deadlines, but rejects existing free-to-play games', () => {
    const xml = `<feed><entry><id>https://feed.eikowagenknecht.com/lootscraper/100</id><title>Epic Games (Game, PC) - Bread and Fred</title><content><div><ul><li><b>Offer valid to:</b> 2026-12-03 16:00</li></ul></div></content><link href="https://store.epicgames.com/en-US/p/bread-and-fred"/><category term="type:GAME"/></entry><entry><id>https://feed.eikowagenknecht.com/lootscraper/101</id><title>Epic Games (Game, PC) - Always Free</title><content><div><ul><li><b>Offer valid to:</b> 2026-12-03 16:00</li></ul></div></content><link href="https://store.epicgames.com/en-US/p/always-free"/><category term="type:GAME"/><category term="Genre: Free To Play"/></entry></feed>`;
    const parsed = parseLootScraper(xml, 'epic', now);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      title: 'Bread and Fred',
      url: 'https://store.epicgames.com/en-US/p/bread-and-fred',
      endsAt: '2026-12-03T00:00:00.000Z',
    });
    expect(
      validOffer(parsed[0]!, { ...channel, categories: ['game'] }, now),
    ).toBe(true);
  });
  it('normalizes actual GamerPower fields without inventing a store price', () => {
    expect(offer.id).toBe('gamerpower:123');
    expect(offer.originalPrice).toBeUndefined();
    expect(offer.platforms).toEqual(['PC', 'Steam']);
    expect(offer.endsAt).toBe('2026-12-01T00:00:00.000Z');
    expect(validOffer(offer, channel, now)).toBe(true);
    expect(
      normalizeGamerPower({ ...raw, end_date: 'N/A' }, now)?.endsAt,
    ).toBeUndefined();
  });
  it('filters expired, suspicious and invalid links', () => {
    expect(
      validOffer({ ...offer, endsAt: '2026-11-26T00:00:00Z' }, channel, now),
    ).toBe(false);
    expect(
      validOffer(
        { ...offer, description: 'Requires 10 ARP to claim' },
        channel,
        now,
      ),
    ).toBe(false);
    expect(
      normalizeGamerPower(
        { ...raw, gamerpower_url: 'https://evil.example/path' },
        now,
      ),
    ).toBeUndefined();
  });
  it('accepts GamerPower no-content response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 201, ok: false }),
    );
    expect(await gamerpower.collect(now)).toEqual([]);
    vi.unstubAllGlobals();
  });
  it('rechecks the official offer URL and active status through the detail API', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 })),
    );
    expect(await gamerpower.verify!(offer, now)).toBe(true);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ...raw, status: 'Expired' }), {
          status: 200,
        }),
      ),
    );
    expect(await gamerpower.verify!(offer, now)).toBe(false);
  });
});

describe('deduplication and schedule', () => {
  it('blocks a recently published game across sources and ampersand spelling', () => {
    const existing = {
      ...offer,
      title: 'Bread & Fred',
      endsAt: '2026-12-03T00:00:00Z',
      fetchedAt: now.toISOString(),
    };
    const candidate = {
      ...offer,
      id: 'lootscraper-epic:11063',
      title: 'Bread and Fred',
      url: 'https://store.epicgames.com/en-US/p/bread-and-fred',
      endsAt: '2026-12-03T16:00:00Z',
    };
    expect(
      isDuplicate(
        candidate,
        channel.id,
        [{ ...sent(now.toISOString()), offer: existing }],
        [],
      ),
    ).toBe(true);
  });
  it('matches source ID and normalized title across sources', () => {
    expect(isDuplicate(offer, channel.id, [sent(now.toISOString())], [])).toBe(
      true,
    );
    const other = {
      ...offer,
      id: 'other:3',
      title: 'Game Giveaway',
      url: 'https://www.gamerpower.com/other',
    };
    expect(isDuplicate(other, channel.id, [sent(now.toISOString())], [])).toBe(
      true,
    );
    expect(isDuplicate(other, 'another', [sent(now.toISOString())], [])).toBe(
      false,
    );
  });
  it('enforces local hours, daily limit, interval and deadline priority', () => {
    expect(canPublish(channel, [], now)).toBe(true);
    expect(canPublish(channel, [], new Date('2026-11-27T06:00:00Z'))).toBe(
      true,
    );
    expect(canPublish(channel, [], new Date('2026-11-27T18:59:00Z'))).toBe(
      true,
    );
    expect(canPublish(channel, [], new Date('2026-11-27T19:00:00Z'))).toBe(
      false,
    );
    expect(canPublish(channel, [], new Date('2026-11-27T04:00:00Z'))).toBe(
      false,
    );
    expect(canPublish(channel, [sent('2026-11-27T09:30:00Z')], now)).toBe(
      false,
    );
    expect(
      canPublish(
        channel,
        [sent('2026-11-27T09:30:00Z')],
        new Date('2026-11-27T12:29:00Z'),
      ),
    ).toBe(false);
    expect(
      canPublish(
        channel,
        [sent('2026-11-27T09:30:00Z')],
        new Date('2026-11-27T12:30:00Z'),
      ),
    ).toBe(true);
    expect(
      canPublish(
        channel,
        Array.from({ length: 5 }, () => sent('2026-11-27T07:00:00Z')),
        now,
      ),
    ).toBe(false);
    const later = queued(offer);
    const earlier = queued({
      ...offer,
      id: 'other',
      endsAt: '2026-11-28T12:00:00Z',
    });
    expect(chooseNext([later, earlier], channel.id, now)).toBe(earlier);
  });
});

describe('generation and state', () => {
  it('labels open-source material honestly and prepares site and Shorts metadata', () => {
    const project: Offer = {
      ...offer,
      id: 'github-ai:ollama/ollama',
      title: 'ollama',
      category: 'ai',
      offerType: 'open_source',
      source: 'GitHub',
      sourceUrl: 'https://github.com/ollama/ollama',
      url: 'https://github.com/ollama/ollama',
      officialUrl: 'https://github.com/ollama/ollama',
      summary: 'Локальный запуск моделей.',
      conditions: 'Лицензия: MIT.',
      endsAt: undefined,
    };
    const caption = generatePost(project, channel);
    expect(caption).toContain('Открытый AI-инструмент');
    expect(caption).not.toContain('Сейчас: бесплатно');
    expect(siteRecord(project, now)).toMatchObject({
      status: 'active',
      category: 'ai',
      offerType: 'open_source',
    });
    expect(offerScore(project, now)).toBeGreaterThan(0);
    const shorts = generateShortsBrief(project);
    expect(shorts).toContain('9:16');
    expect(shorts).toContain('Без чужого геймплея');
  });
  it('creates a weekly digest only from recently published posts', () => {
    const text = generateWeeklyDigest(
      [sent(now.toISOString()), sent('2026-11-10T10:00:00Z')],
      channel.id,
      '@halyava_exe_hub',
      now,
    );
    expect(text).toContain('https://t.me/halyava_exe_hub/1');
    expect(text?.match(/https:\/\/t\.me/g)).toHaveLength(1);
    expect(
      generateWeeklyDigest([], channel.id, '@halyava_exe_hub', now),
    ).toBeUndefined();
  });
  it('builds a Russian caption with source and no fictional price', () => {
    const text = generatePost(offer, channel);
    expect(text).toContain('Бесплатная');
    expect(text).toContain('GamerPower');
    expect(text).toContain('Халява.exe');
    expect(text).toContain('Запусти халяву');
    expect(text).not.toContain('Обычная цена');
    expect(text).toContain('Доступность по регионам');
  });
  it('generates three distinct 1200 x 675 covers without fetching game art', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const images = await Promise.all(
      [0, 1, 2].map((variant) =>
        generateImage(
          {
            ...offer,
            id: `gamerpower:${variant}`,
            title:
              'Очень длинное название игры с русскими буквами и множеством слов',
            imageUrl: 'https://example.invalid/unlicensed-art.jpg',
          },
          channel,
        ),
      ),
    );
    const sharp = (await import('sharp')).default;
    for (const image of images)
      expect(await sharp(image).metadata()).toMatchObject({
        width: 1200,
        height: 675,
        format: 'jpeg',
      });
    expect(new Set(images.map((image) => image.toString('base64'))).size).toBe(
      3,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('persists queue, history and report marker', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'telegram-state-'));
    process.env.STATE_DIR = dir;
    try {
      const state = {
        queue: [queued(offer)],
        published: [sent(now.toISOString())],
        reports: { games: '2026-11-27' },
      };
      await saveState(state);
      expect(await loadState()).toEqual(state);
      expect(
        JSON.parse(await readFile(join(dir, 'queue.json'), 'utf8')),
      ).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('Telegram failures', () => {
  it('treats an explicit 429 as rejected and a timeout as uncertain', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'mock-token';
    process.env.TELEGRAM_CHANNEL_ID = '@test';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ ok: false, parameters: { retry_after: 3 } }),
      }),
    );
    await expect(
      sendPhoto(channel, Buffer.from('x'), 'caption', offer.url),
    ).rejects.toMatchObject({ definite: true, retryAfterSeconds: 3 });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    await expect(
      sendPhoto(channel, Buffer.from('x'), 'caption', offer.url),
    ).rejects.toBeInstanceOf(TelegramError);
    await expect(
      sendPhoto(channel, Buffer.from('x'), 'caption', offer.url),
    ).rejects.toMatchObject({ definite: false });
    vi.unstubAllGlobals();
  });
  it('checks bot identity and channel posting permission without sending', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            result: { id: 42, username: 'example_bot' },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            result: { id: -1001, title: 'Халява.exe' },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            result: { status: 'administrator', can_post_messages: true },
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    expect(await inspectBot('mock-token', '@halyava_exe_hub')).toEqual({
      botUsername: 'example_bot',
      channelTitle: 'Халява.exe',
      canPost: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('DRY_RUN end to end', () => {
  it('creates previews from source data without calling Telegram or marking items published', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'telegram-preview-'));
    process.env.STATE_DIR = dir;
    process.env.DRY_RUN_DIR = join(dir, 'previews');
    process.env.DRY_RUN = 'true';
    await writeFile(join(dir, 'queue.json'), '[]');
    await writeFile(join(dir, 'published.json'), '[]');
    await writeFile(join(dir, 'reports.json'), '{}');
    const current = {
      ...raw,
      end_date: '2099-12-01 23:59:00',
      published_date: '2020-01-01 00:00:00',
    };
    const sourceFetch = vi.fn((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(url.includes('/api/giveaway?') ? current : [current]),
        ),
      ),
    );
    vi.stubGlobal('fetch', sourceFetch);
    try {
      await main();
      const files = await readdir(join(dir, 'previews', 'free-games'));
      expect(files.some((file) => file.endsWith('.jpg'))).toBe(true);
      expect(files.some((file) => file.endsWith('.txt'))).toBe(true);
      expect((await loadState()).published).toEqual([]);
      expect(sourceFetch).toHaveBeenCalledTimes(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('queue and publication state', () => {
  it('records one mocked Telegram message and prevents a duplicate on the next run', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'telegram-live-mock-'));
    process.env.STATE_DIR = dir;
    process.env.DRY_RUN = 'false';
    process.env.STATE_SYNC_GIT = 'false';
    process.env.TELEGRAM_BOT_TOKEN = 'mock-token';
    process.env.TELEGRAM_CHANNEL_ID = '@halyava_exe_hub';
    await writeFile(join(dir, 'queue.json'), '[]');
    await writeFile(join(dir, 'published.json'), '[]');
    await writeFile(join(dir, 'reports.json'), '{}');
    const current = {
      ...raw,
      end_date: '2099-12-01 23:59:00',
      published_date: '2020-01-01 00:00:00',
    };
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/api/giveaways'))
        return Promise.resolve(new Response(JSON.stringify([current])));
      if (url.includes('/api/giveaway?'))
        return Promise.resolve(new Response(JSON.stringify(current)));
      if (url.includes('/sendPhoto'))
        return Promise.resolve(
          new Response(
            JSON.stringify({ ok: true, result: { message_id: 777 } }),
          ),
        );
      throw new Error('Unexpected network request');
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await main(now);
      const state = await loadState();
      expect(state.queue).toEqual([]);
      expect(state.published).toMatchObject([
        { messageId: 777, channelId: 'free-games' },
      ]);
      await main(new Date(now.getTime() + 60_000));
      expect(
        fetchMock.mock.calls.filter(([url]) =>
          String(url).includes('/sendPhoto'),
        ),
      ).toHaveLength(1);
      expect((await loadState()).published).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
