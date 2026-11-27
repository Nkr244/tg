import { createHash } from 'node:crypto';
import type { Offer, PublishedEntry, QueueEntry } from '../types/index.js';

export function normalizedTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*(?:steam|epic games|gog|pc|mobile)[^)]*\)/gi, '')
    .replace(/\b(?:giveaway|free|key|раздача)\b/gi, '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function offerKey(offer: Offer): string {
  const platform = offer.platforms
    .map((value) => value.toLowerCase())
    .filter((value) => value !== 'pc')
    .sort()
    .join(',');
  const period = `${offer.startsAt?.slice(0, 10) ?? ''}|${offer.endsAt?.slice(0, 10) ?? ''}`;
  return createHash('sha256')
    .update(`${normalizedTitle(offer.title)}|${platform}|${period}`)
    .digest('hex');
}

export function isDuplicate(
  offer: Offer,
  channelId: string,
  published: PublishedEntry[],
  queue: QueueEntry[],
): boolean {
  const title = normalizedTitle(offer.title);
  const url = new URL(offer.url).pathname.replace(/\/$/, '');
  const entries = [...published, ...queue].filter(
    (entry) => entry.channelId === channelId,
  );
  return entries.some((entry) => {
    const other = entry.offer;
    const samePeriod =
      (offer.endsAt?.slice(0, 10) ?? '') === (other.endsAt?.slice(0, 10) ?? '');
    const samePlatform = offer.platforms.some((platform) =>
      other.platforms.some(
        (value) => value.toLowerCase() === platform.toLowerCase(),
      ),
    );
    return (
      offer.id === other.id ||
      (samePeriod && new URL(other.url).pathname.replace(/\/$/, '') === url) ||
      (samePeriod && samePlatform && normalizedTitle(other.title) === title)
    );
  });
}
