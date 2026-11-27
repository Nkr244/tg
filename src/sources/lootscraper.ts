import { XMLParser } from 'fast-xml-parser';
import type { Offer, Source } from '../types/index.js';
import { fetchWithRetry } from '../utils/http.js';

const feeds = {
  epic: 'https://feed.eikowagenknecht.com/lootscraper_epic_game.xml',
  gog: 'https://feed.eikowagenknecht.com/lootscraper_gog_game.xml',
  steam: 'https://feed.eikowagenknecht.com/lootscraper_steam_game.xml',
} as const;
type FeedName = keyof typeof feeds;
type Node = Record<string, unknown>;
const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

function record(value: unknown): Node | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Node)
    : undefined;
}
function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function array(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}
function deadline(entry: Node): string | undefined {
  const div = record(record(entry.content)?.div);
  const ul = record(div?.ul);
  const line = array(ul?.li)
    .map(record)
    .find((item) => str(item?.b) === 'Offer valid to:');
  const raw = str(line?.['#text']);
  if (!raw || !/^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(raw)) return;
  const date = new Date(`${raw.replace(' ', 'T')}:00Z`);
  if (Number.isNaN(date.getTime())) return;
  // The public feed omits a timezone. Stop publishing at the start of its
  // listed final date rather than claiming a precise expiry we cannot prove.
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

export function parseLootScraper(
  xml: string,
  feed: FeedName,
  now: Date,
): Offer[] {
  const root = record(parser.parse(xml));
  const entries = array(record(root?.feed)?.entry)
    .map(record)
    .filter((entry): entry is Node => !!entry);
  return entries.flatMap((entry) => {
    const id = str(entry.id)?.match(/\/lootscraper\/(\d+)$/)?.[1];
    const title = str(entry.title)?.split(' - ').slice(1).join(' - ').trim();
    const link = str(record(entry.link)?.['@_href']);
    const end = deadline(entry);
    const types = array(entry.category).map((item) =>
      str(record(item)?.['@_term']),
    );
    if (
      !id ||
      !title ||
      !link ||
      !end ||
      !types.includes('type:GAME') ||
      types.includes('Genre: Free To Play')
    )
      return [];
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      return [];
    }
    const allowed: Record<FeedName, string[]> = {
      epic: ['store.epicgames.com'],
      gog: ['www.gog.com', 'gog.com'],
      steam: ['store.steampowered.com'],
    };
    if (url.protocol !== 'https:' || !allowed[feed].includes(url.hostname))
      return [];
    if (new Date(end).getTime() <= now.getTime() + 60 * 60_000) return [];
    // LootScraper notes that enriched game descriptions may mismatch titles.
    // Only use the feed's offer title, category, direct link and end date.
    return [
      {
        id: `lootscraper-${feed}:${id}`,
        title,
        category: 'game' as const,
        offerType: 'temporary_giveaway' as const,
        platforms: [
          feed === 'epic' ? 'Epic Games' : feed === 'gog' ? 'GOG' : 'Steam',
          'PC',
        ],
        currentPrice: '0',
        url: link,
        sourceUrl: feeds[feed],
        officialUrl: link,
        source: 'LootScraper',
        endsAt: end,
        fetchedAt: now.toISOString(),
      },
    ];
  });
}

export function lootScraper(feed: FeedName): Source {
  const collect: Source['collect'] = async (now) => {
    const response = await fetchWithRetry(feeds[feed]);
    return parseLootScraper(await response.text(), feed, now);
  };
  return {
    id: `lootscraper-${feed}`,
    collect,
    async verify(offer, now) {
      const current = await collect(now);
      return current.some(
        (item) =>
          item.id === offer.id &&
          item.url === offer.url &&
          item.endsAt === offer.endsAt,
      );
    },
  };
}
