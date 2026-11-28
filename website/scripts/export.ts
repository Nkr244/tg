import { readFile, mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { generateImage } from '../../src/generators/image.js';
import type { Channel, PublishedEntry } from '../../src/types/index.js';
import { toPublicOffer } from './catalog.js';

const root = resolve(import.meta.dirname, '../..');
const website = resolve(import.meta.dirname, '..');
const publishedFile =
  process.env.PUBLISHED_FILE ?? join(root, 'data/published.json');
const raw: unknown = JSON.parse(await readFile(publishedFile, 'utf8'));
if (!Array.isArray(raw)) throw new Error('Published history must be an array');
const channels = JSON.parse(
  await readFile(join(root, 'config/channels.json'), 'utf8'),
) as { channels: Channel[] };
const channel = channels.channels.find((item) => item.id === 'free-games');
if (!channel) throw new Error('Website channel not found');
const pairs = (raw as PublishedEntry[])
  .filter((entry) => entry.channelId === channel.id)
  .map((entry) => ({ entry, publicOffer: toPublicOffer(entry) }))
  .filter(
    (
      pair,
    ): pair is {
      entry: PublishedEntry;
      publicOffer: NonNullable<typeof pair.publicOffer>;
    } => Boolean(pair.publicOffer),
  );
const seen = new Set<string>();
const unique = pairs.filter(({ publicOffer }) => {
  if (seen.has(publicOffer.slug)) return false;
  seen.add(publicOffer.slug);
  return true;
});
const coverDir = join(website, 'public/covers');
await mkdir(coverDir, { recursive: true });
const wantedCovers = new Set(
  unique.map(({ publicOffer }) => `${publicOffer.slug}.webp`),
);
for (const name of await readdir(coverDir)) {
  if (name.endsWith('.webp') && !wantedCovers.has(name))
    await unlink(join(coverDir, name));
}
for (const { entry, publicOffer } of unique) {
  const path = join(coverDir, `${publicOffer.slug}.webp`);
  const image = await generateImage(entry.offer, channel);
  await writeFile(
    path,
    await sharp(image).webp({ quality: 80, effort: 4 }).toBuffer(),
  );
}
const catalog = unique
  .map(({ publicOffer }) => publicOffer)
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
await mkdir(join(website, 'app/data'), { recursive: true });
await writeFile(
  join(website, 'app/data/catalog.json'),
  JSON.stringify(catalog, null, 2) + '\n',
);
await writeFile(
  join(website, 'public/catalog.json'),
  JSON.stringify(catalog, null, 2) + '\n',
);
const base = (
  process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
).replace(/\/$/, '');
const indexable =
  process.env.SITE_INDEXABLE === 'true' && base.startsWith('https://');
const categories = [
  ['game', '/games/'],
  ['software', '/software/'],
  ['ai', '/ai/'],
  ['opensource', '/opensource/'],
];
const urls = [
  '/',
  '/about/',
  ...categories
    .filter(([category]) => catalog.some((item) => item.category === category))
    .map(([, path]) => path),
  ...catalog.map((item) => `/post/${item.slug}/`),
];
const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((path) => `  <url><loc>${base}${path}</loc></url>`).join('\n') +
  '\n</urlset>\n';
await writeFile(
  join(website, 'public/sitemap.xml'),
  indexable
    ? sitemap
    : '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>\n',
);
await writeFile(
  join(website, 'public/robots.txt'),
  indexable
    ? `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n',
);
console.log(`Exported ${catalog.length} confirmed publications`);
