import type { Channel, Offer } from '../types/index.js';

export function validOffer(offer: Offer, channel: Channel, now: Date): boolean {
  if (!channel.categories.includes(offer.category)) return false;
  if (
    !offer.title ||
    offer.title.length > 180 ||
    offer.platforms.length === 0 ||
    offer.platforms.join(', ').length > 120 ||
    offer.sourceUrl.length > 250
  )
    return false;
  if (
    offer.endsAt &&
    (!Number.isFinite(new Date(offer.endsAt).getTime()) ||
      new Date(offer.endsAt).getTime() <= now.getTime())
  )
    return false;
  if (offer.startsAt && new Date(offer.startsAt).getTime() > now.getTime())
    return false;
  const claims = `${offer.title} ${offer.description ?? ''}`;
  if (
    /\b(?:\d+ arp|purchase required|paid subscription|subscribe to claim|playtest|beta access)\b/i.test(
      claims,
    )
  )
    return false;
  try {
    const url = new URL(offer.url);
    const source = new URL(offer.sourceUrl);
    const hosts: Record<string, string[]> = {
      gamerpower: ['www.gamerpower.com'],
      'lootscraper-epic': ['store.epicgames.com'],
      'lootscraper-gog': ['www.gog.com', 'gog.com'],
      'lootscraper-steam': ['store.steampowered.com'],
      'github-ai': ['github.com'],
      'github-software': ['github.com'],
    };
    const prefix = offer.id.split(':')[0]!;
    return (
      url.protocol === 'https:' &&
      source.protocol === 'https:' &&
      !!hosts[prefix]?.includes(url.hostname) &&
      (prefix.startsWith('lootscraper-')
        ? source.hostname === 'feed.eikowagenknecht.com'
        : source.hostname === url.hostname) &&
      (offer.offerType !== 'temporary_giveaway' || !!offer.endsAt)
    );
  } catch {
    return false;
  }
}
