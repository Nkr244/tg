import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sources } from './sources/index.js';
import { validOffer } from './services/validator.js';
import { isDuplicate, offerKey } from './services/deduplicator.js';
import { canPublish, chooseNext } from './services/scheduler.js';
import { checkpoint, loadState, type State } from './services/storage.js';
import { generatePost } from './generators/post.js';
import { generateImage } from './generators/image.js';
import { generateShortsBrief } from './generators/shorts.js';
import { sendPhoto, sendText, TelegramError } from './publishers/telegram.js';
import type { Channel, Offer, QueueEntry } from './types/index.js';

async function channels(): Promise<Channel[]> {
  const config = JSON.parse(
    await readFile(join(process.cwd(), 'config', 'channels.json'), 'utf8'),
  ) as { channels?: Channel[] };
  if (!Array.isArray(config.channels))
    throw new Error('config/channels.json: channels must be an array');
  for (const channel of config.channels) {
    if (
      !channel.id ||
      channel.language !== 'ru' ||
      !channel.name ||
      !Array.isArray(channel.sources) ||
      !Array.isArray(channel.categories) ||
      !channel.telegramChatIdEnv
    )
      throw new Error('Invalid channel config');
    if (
      channel.maxPostsPerDay < 0 ||
      channel.minPostIntervalMinutes < 0 ||
      !/^\d\d:\d\d$/.test(channel.publishHours.from) ||
      !/^\d\d:\d\d$/.test(channel.publishHours.to)
    )
      throw new Error(`Invalid schedule for ${channel.id}`);
    new Intl.DateTimeFormat('en', { timeZone: channel.timezone });
  }
  return config.channels.filter((channel) => channel.enabled);
}

async function collect(
  channel: Channel,
  now: Date,
  state: State,
): Promise<{
  offers: Offer[];
  successfulSources: Set<string>;
  failedSources: string[];
}> {
  const results = await Promise.allSettled(
    channel.sources.map(async (id) => {
      const source = sources[id];
      if (!source) throw new Error(`Unknown source: ${id}`);
      return source.collect(now);
    }),
  );
  const offers: Offer[] = [];
  const successfulSources = new Set<string>();
  const failedSources: string[] = [];
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      offers.push(...result.value);
      successfulSources.add(channel.sources[index]!);
      continue;
    }
    const message = `Source ${channel.sources[index]} failed: ${result.reason instanceof Error ? result.reason.message : 'unknown error'}`;
    const sourceId = channel.sources[index]!;
    failedSources.push(sourceId);
    console.error(message);
    process.exitCode = 1;
    const marker = `source-error:${channel.id}:${sourceId}`;
    const day = localDay(now, channel.timezone);
    if (
      process.env.DRY_RUN === 'false' &&
      process.env.TELEGRAM_ADMIN_ID &&
      process.env.TELEGRAM_BOT_TOKEN &&
      state.reports[marker] !== day
    ) {
      try {
        await sendText(
          process.env.TELEGRAM_ADMIN_ID,
          `Ошибка источника ${channel.id}: ${message}`,
        );
        state.reports[marker] = day;
      } catch {
        console.error('Admin notification failed');
      }
    }
  }
  return { offers, successfulSources, failedSources };
}

async function dryRun(
  channel: Channel,
  offers: Offer[],
  state: State,
  now: Date,
): Promise<void> {
  const candidates = offers.filter(
    (offer) =>
      validOffer(offer, channel, now) &&
      !isDuplicate(offer, channel.id, state.published, state.queue),
  );
  const ranked = candidates.sort((a, b) =>
    (a.endsAt ?? '9999').localeCompare(b.endsAt ?? '9999'),
  );
  const dir = join(
    process.env.DRY_RUN_DIR ?? join(process.cwd(), 'dry-run'),
    channel.id,
  );
  await mkdir(dir, { recursive: true });
  let created = 0;
  for (const offer of ranked) {
    if (created >= 3) break;
    const source = sources[offer.id.split(':')[0]!];
    try {
      if (source?.verify && !(await source.verify(offer, now))) continue;
    } catch {
      console.error(
        `DRY_RUN ${channel.id}: verification failed for ${offer.id}`,
      );
      process.exitCode = 1;
      continue;
    }
    const key = offerKey(offer);
    const caption = generatePost(offer, channel);
    await writeFile(
      join(dir, `${key}.jpg`),
      await generateImage(offer, channel),
    );
    await writeFile(join(dir, `${key}.txt`), caption + '\n' + offer.url + '\n');
    console.log(`DRY_RUN ${channel.id}: ${offer.title} -> ${key}.jpg`);
    created++;
  }
  if (created === 0) console.log(`DRY_RUN ${channel.id}: no new offers`);
}

async function publish(
  channel: Channel,
  state: State,
  now: Date,
  activeIds: Set<string>,
): Promise<void> {
  if (!canPublish(channel, state.published, now)) return;
  const entry = chooseNext(
    state.queue.filter((item) => activeIds.has(item.offer.id)),
    channel.id,
    now,
  );
  if (!entry) return;
  const source = sources[entry.offer.id.split(':')[0]!];
  if (source?.verify && !(await source.verify(entry.offer, new Date()))) {
    state.queue = state.queue.filter((item) => item !== entry);
    await checkpoint(state, `invalid ${channel.id}`);
    return;
  }
  const image = await generateImage(entry.offer, channel);
  const caption = generatePost(entry.offer, channel);
  entry.status = 'sending';
  await checkpoint(state, `sending ${channel.id}`);
  let stillActive: boolean;
  try {
    const currentTime = new Date();
    stillActive =
      validOffer(entry.offer, channel, currentTime) &&
      (!source?.verify || (await source.verify(entry.offer, currentTime)));
  } catch (error) {
    entry.status = 'queued';
    await checkpoint(state, `verification failed ${channel.id}`);
    throw error;
  }
  if (!stillActive) {
    state.queue = state.queue.filter((item) => item !== entry);
    await checkpoint(state, `expired ${channel.id}`);
    return;
  }
  let messageId: number;
  try {
    messageId = await sendPhoto(
      channel,
      image,
      caption,
      entry.offer.url,
      undefined,
      entry.offer.offerType === 'open_source'
        ? 'Открыть проект'
        : entry.offer.offerType === 'free_tier'
          ? 'Посмотреть тариф'
          : 'Забрать бесплатно',
    );
  } catch (error) {
    if (error instanceof TelegramError && error.definite) {
      entry.status = error.status === 429 ? 'queued' : 'blocked';
      await checkpoint(state, `rejected ${channel.id}`);
      if (error.retryAfterSeconds)
        console.error(
          `Telegram rate limited; retry after ${error.retryAfterSeconds}s`,
        );
    } else {
      entry.status = 'uncertain';
      // The durable 'sending' checkpoint remains if this write fails.
      await checkpoint(state, `uncertain ${channel.id}`);
    }
    throw error;
  }
  state.published.push({
    key: entry.key,
    channelId: channel.id,
    offer: entry.offer,
    messageId,
    sentAt: new Date().toISOString(),
  });
  state.queue = state.queue.filter((item) => item !== entry);
  const published = state.published.at(-1)!;
  const today = localDay(new Date(published.sentAt), channel.timezone);
  const shortsCount = state.published.filter(
    (item) =>
      item.channelId === channel.id &&
      item.shortsText &&
      localDay(new Date(item.sentAt), channel.timezone) === today,
  ).length;
  const chatId = process.env[channel.telegramChatIdEnv];
  const postUrl = chatId?.startsWith('@')
    ? `https://t.me/${chatId.slice(1)}/${messageId}`
    : undefined;
  if (shortsCount < 2 && entry.offer.category !== 'dlc')
    published.shortsText = generateShortsBrief(entry.offer, postUrl);
  await checkpoint(state, `published ${channel.id}`);
  console.log(`Published ${channel.id}: message ${messageId}`);
  if (process.env.TELEGRAM_ADMIN_ID) {
    try {
      await sendText(
        process.env.TELEGRAM_ADMIN_ID,
        `Опубликовано: ${entry.offer.title}\n${postUrl ?? `Сообщение ${messageId}`}\n\n${published.shortsText ?? 'Shorts не рекомендован: дневной лимит.'}`,
      );
      published.notificationSentAt = new Date().toISOString();
      await checkpoint(state, `notified ${channel.id}`);
    } catch {
      console.error('Admin notification failed after publication');
    }
  }
}

function localDay(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

async function dailyReport(
  channel: Channel,
  state: State,
  now: Date,
  failedSources: string[],
): Promise<void> {
  const admin = process.env.TELEGRAM_ADMIN_ID;
  if (!admin || !process.env.TELEGRAM_BOT_TOKEN) return;
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: channel.timezone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  );
  const day = localDay(now, channel.timezone);
  if (hour < 21 || state.reports[channel.id] === day) return;
  const count = state.published.filter(
    (entry) =>
      entry.channelId === channel.id &&
      localDay(new Date(entry.sentAt), channel.timezone) === day,
  ).length;
  const pending = state.queue.filter(
    (entry) => entry.channelId === channel.id && entry.status === 'queued',
  ).length;
  const blocked = state.queue.filter(
    (entry) =>
      entry.channelId === channel.id &&
      (entry.status === 'blocked' ||
        entry.status === 'uncertain' ||
        entry.status === 'sending'),
  ).length;
  const latest = state.published
    .filter((entry) => entry.channelId === channel.id)
    .at(-1);
  const noOffers =
    !pending &&
    (!latest ||
      now.getTime() - new Date(latest.sentAt).getTime() > 24 * 60 * 60_000);
  state.reports[channel.id] = day;
  await checkpoint(state, `report ${channel.id}`);
  await sendText(
    admin,
    `Отчёт ${channel.name} за ${day}: опубликовано ${count}, в очереди ${pending}, требуют проверки ${blocked}. Ошибки источников: ${failedSources.length ? failedSources.join(', ') : 'нет'}.${noOffers ? ' Подходящих предложений более суток нет.' : ''}`,
  );
}

export async function main(now: Date = new Date()): Promise<void> {
  const state = await loadState();
  const configured = await channels();
  const dry = process.env.DRY_RUN !== 'false';
  const test = process.env.TEST_PUBLISH === 'true';
  if (test && !process.env.TEST_CHANNEL_ID)
    throw new Error('TEST_CHANNEL_ID is required for TEST_PUBLISH');
  if (
    !dry &&
    !test &&
    (!process.env.TELEGRAM_BOT_TOKEN ||
      configured.some((channel) => !process.env[channel.telegramChatIdEnv]))
  )
    throw new Error('Telegram credentials are required for live mode');
  for (const channel of configured) {
    const { offers, successfulSources, failedSources } = await collect(
      channel,
      now,
      state,
    );
    if (dry && !test) {
      await dryRun(channel, offers, state, now);
      continue;
    }
    if (test) {
      const offer = offers.find((item) => validOffer(item, channel, now));
      if (offer) {
        const messageId = await sendPhoto(
          channel,
          await generateImage(offer, channel),
          generatePost(offer, channel),
          offer.url,
          process.env.TEST_CHANNEL_ID,
        );
        console.log(`Test channel message: ${messageId}`);
      }
      continue;
    }
    for (const offer of offers) {
      if (
        !validOffer(offer, channel, now) ||
        isDuplicate(offer, channel.id, state.published, state.queue)
      )
        continue;
      const entry: QueueEntry = {
        key: offerKey(offer),
        channelId: channel.id,
        offer,
        queuedAt: now.toISOString(),
        status: 'queued',
      };
      state.queue.push(entry);
    }
    const activeIds = new Set(offers.map((offer) => offer.id));
    state.queue = state.queue.filter((entry) => {
      if (entry.channelId !== channel.id || entry.status !== 'queued')
        return true;
      if (entry.offer.endsAt && new Date(entry.offer.endsAt) <= now)
        return false;
      if (
        successfulSources.has(entry.offer.id.split(':')[0]!) &&
        !activeIds.has(entry.offer.id)
      )
        return false;
      return true;
    });
    await checkpoint(state, `queue ${channel.id}`);
    await publish(channel, state, now, activeIds);
    await dailyReport(channel, state, now, failedSources);
  }
}

async function handleFatal(error: unknown): Promise<void> {
  const message =
    error instanceof TelegramError
      ? error.definite
        ? 'Telegram отклонил публикацию; материал остался в очереди.'
        : 'Результат отправки Telegram неизвестен; нужна ручная проверка.'
      : error instanceof Error
        ? error.message
        : 'Unknown error';
  console.error(message);
  if (
    process.env.DRY_RUN === 'false' &&
    process.env.TELEGRAM_ADMIN_ID &&
    process.env.TELEGRAM_BOT_TOKEN
  ) {
    try {
      await sendText(process.env.TELEGRAM_ADMIN_ID, `Ошибка бота: ${message}`);
    } catch {
      console.error('Admin notification failed');
    }
  }
  process.exitCode = 1;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  void main().catch(handleFatal);
