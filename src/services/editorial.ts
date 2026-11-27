import type { Offer } from '../types/index.js';
import { normalizedTitle } from './deduplicator.js';

export function offerScore(offer: Offer, now: Date): number {
  let score = offer.officialUrl === offer.url ? 35 : 20;
  if (offer.endsAt) {
    const hours =
      (new Date(offer.endsAt).getTime() - now.getTime()) / 3_600_000;
    score += hours > 2 && hours < 48 ? 25 : hours < 168 ? 15 : 5;
  } else if (
    offer.offerType === 'open_source' ||
    offer.offerType === 'permanently_free'
  )
    score += 10;
  if (offer.region) score += 5;
  if (offer.conditions) score += 5;
  if (offer.summary) score += 10;
  if ((offer.popularity ?? 0) >= 1000) score += 10;
  if (offer.originalPrice) score += 5;
  return score;
}

export function siteRecord(offer: Offer, now: Date) {
  const slug =
    normalizedTitle(offer.title).replace(/\s+/g, '-').slice(0, 80) ||
    offer.id.replace(/[^a-z0-9]+/gi, '-');
  return {
    slug,
    category: offer.category,
    offerType: offer.offerType ?? 'temporary_giveaway',
    seoTitle: `${offer.title} — ${offer.offerType === 'open_source' ? 'открытый проект' : 'предложение'} | Халява.exe`,
    summary: offer.summary ?? '',
    endsAt: offer.endsAt ?? null,
    status:
      offer.endsAt && new Date(offer.endsAt) <= now ? 'expired' : 'active',
    source: offer.source,
    sourceUrl: offer.sourceUrl,
    claimUrl: offer.url,
    officialUrl: offer.officialUrl ?? null,
    region: offer.region ?? null,
  };
}
