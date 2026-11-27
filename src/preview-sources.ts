import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sources } from './sources/index.js';
import { loadState } from './services/storage.js';
import { isDuplicate, offerKey } from './services/deduplicator.js';
import { offerScore, siteRecord } from './services/editorial.js';
import { validOffer } from './services/validator.js';
import { generatePost } from './generators/post.js';
import { generateImage } from './generators/image.js';
import { generateShortsBrief } from './generators/shorts.js';
import { generateWeeklyDigest } from './generators/digest.js';
import type { Channel, Offer } from './types/index.js';

const channel: Channel = {
  id: 'free-games',
  enabled: true,
  name: 'Халява.exe',
  language: 'ru',
  timezone: 'Europe/Moscow',
  sources: [],
  categories: ['game', 'software', 'ai', 'opensource'],
  maxPostsPerDay: 5,
  minPostIntervalMinutes: 60,
  publishHours: { from: '09:00', to: '22:00' },
  telegramChatIdEnv: 'TELEGRAM_CHANNEL_ID',
};

export async function previewSources(now = new Date()): Promise<void> {
  const state = await loadState();
  const ids = [
    'lootscraper-epic',
    'lootscraper-gog',
    'lootscraper-steam',
    'github-ai',
    'github-software',
  ];
  const results = await Promise.allSettled(
    ids.map((id) => sources[id]!.collect(now)),
  );
  const offers: Offer[] = [];
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') offers.push(...result.value);
    else
      console.error(
        `Preview source ${ids[index]} failed: ${result.reason instanceof Error ? result.reason.message : 'unknown error'}`,
      );
  }
  const selected = offers
    .filter(
      (offer) =>
        validOffer(offer, channel, now) &&
        !isDuplicate(offer, channel.id, state.published, state.queue),
    )
    .sort((a, b) => offerScore(b, now) - offerScore(a, now))
    .slice(0, 8);
  const dir =
    process.env.PREVIEW_DIR ?? join(process.cwd(), 'dry-run', 'new-sources');
  await mkdir(dir, { recursive: true });
  const digest = generateWeeklyDigest(
    state.published,
    channel.id,
    '@halyava_exe_hub',
    now,
  );
  if (digest) await writeFile(join(dir, 'weekly-digest.txt'), digest + '\n');
  else await unlink(join(dir, 'weekly-digest.txt')).catch(() => undefined);
  for (const name of await readdir(dir))
    if (/^[a-f0-9]{64}\.(?:jpg|txt|shorts\.txt|json)$/.test(name))
      await unlink(join(dir, name));
  for (const offer of selected) {
    const source = sources[offer.id.split(':')[0]!]!;
    try {
      if (source.verify && !(await source.verify(offer, now))) continue;
    } catch {
      console.error(`Preview verification failed for ${offer.id}`);
      continue;
    }
    const key = offerKey(offer);
    await Promise.all([
      writeFile(join(dir, `${key}.jpg`), await generateImage(offer, channel)),
      writeFile(
        join(dir, `${key}.txt`),
        `${generatePost(offer, channel)}\n\nКнопка: ${offer.url}\n`,
      ),
      writeFile(join(dir, `${key}.shorts.txt`), generateShortsBrief(offer)),
      writeFile(
        join(dir, `${key}.json`),
        JSON.stringify(siteRecord(offer, now), null, 2) + '\n',
      ),
    ]);
    console.log(
      `PREVIEW ${offer.id}: ${offer.title} score=${offerScore(offer, now)}`,
    );
  }
  if (selected.length === 0) console.log('PREVIEW: no verified new offers');
}

if (process.argv[1]?.endsWith('preview-sources.ts'))
  void previewSources().catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Unknown preview error',
    );
    process.exitCode = 1;
  });
