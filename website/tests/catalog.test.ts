import { describe, expect, it } from 'vitest';
import { filterOffers, isPermanent, statusOf } from '../app/utils/catalog';
import { safeUrl, toPublicOffer } from '../scripts/catalog';
import type { PublishedEntry } from '../../src/types/index';
import type { PublicOffer } from '../app/types/catalog';

const published: PublishedEntry = {
  key: 'abcdef012345',
  channelId: 'free-games',
  sentAt: '2026-11-27T10:00:00Z',
  messageId: 42,
  offer: {
    id: 'source:1',
    title: 'A Test Game Giveaway',
    category: 'game',
    platforms: ['PC', 'Steam'],
    currentPrice: '0',
    url: 'https://example.org/game',
    source: 'Example',
    sourceUrl: 'https://example.org/game',
    fetchedAt: '2026-11-27T09:00:00Z',
    endsAt: '2026-11-29T00:00:00Z',
  },
};
const item = toPublicOffer(published)!;

describe('public catalog boundary', () => {
  it('exports only confirmed messages and whitelisted fields', () => {
    expect(item.telegramUrl).toBe('https://t.me/halyava_exe_hub/42');
    expect(JSON.stringify(item)).not.toContain('abcdef012345');
    expect(toPublicOffer({ ...published, messageId: 0 })).toBeUndefined();
  });
  it('rejects unsafe external links', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('https://user:pass@example.org')).toBeUndefined();
  });
});

describe('catalog interactions', () => {
  const items = [
    item,
    {
      ...item,
      slug: 'permanent',
      title: 'Open Tool',
      offerType: 'open_source',
      endsAt: undefined,
      category: 'opensource',
      platforms: ['Linux'],
      os: ['Linux'],
    },
  ] as PublicOffer[];
  const now = new Date('2026-11-28T00:00:00Z');
  it('searches across title, description, category, platform and source', () => {
    expect(filterOffers(items, { q: 'Steam' }, now)).toHaveLength(1);
    expect(filterOffers(items, { q: 'Example' }, now)).toHaveLength(2);
  });
  it('filters platform, OS and permanent offers', () => {
    expect(
      filterOffers(items, { platform: 'Steam', current: '1' }, now).map(
        (x) => x.slug,
      ),
    ).toEqual([item.slug]);
    expect(
      filterOffers(items, { os: 'Linux', permanent: '1' }, now).map(
        (x) => x.slug,
      ),
    ).toEqual(['permanent']);
    expect(isPermanent(item)).toBe(false);
  });
  it('distinguishes expiring, ended and permanent offers', () => {
    expect(statusOf(item, now)).toBe('Скоро закончится');
    expect(statusOf(item, new Date('2026-11-30T00:00:00Z'))).toBe(
      'Раздача завершена',
    );
    expect(statusOf(items[1]!, now)).toBe('Open Source');
  });
});
