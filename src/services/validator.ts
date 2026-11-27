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
  if (offer.endsAt && new Date(offer.endsAt).getTime() <= now.getTime())
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
    return (
      url.protocol === 'https:' &&
      source.protocol === 'https:' &&
      url.hostname === 'www.gamerpower.com' &&
      source.hostname === 'www.gamerpower.com'
    );
  } catch {
    return false;
  }
}
