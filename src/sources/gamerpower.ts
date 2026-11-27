import type { Offer, Source } from '../types/index.js';
import { fetchWithRetry } from '../utils/http.js';

const API = 'https://www.gamerpower.com/api/giveaways';
type Raw = Record<string, unknown>;

function requiredString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() && value !== 'N/A'
    ? value.trim()
    : undefined;
}

function dateValue(value: unknown, deadline = false): string | undefined {
  const text = requiredString(value);
  if (!text) return undefined;
  // GamerPower timestamps have no timezone. Parse as UTC consistently and
  // confirm the active status through the detail API before publication.
  const date = new Date(text.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return undefined;
  // 23:59 is a date-only placeholder in many listings. The store may end
  // hours earlier, so stop publishing at the start of that UTC date.
  if (deadline && date.getUTCHours() === 23 && date.getUTCMinutes() === 59)
    date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

export function normalizeGamerPower(raw: Raw, now: Date): Offer | undefined {
  const id = raw.id;
  const title = requiredString(raw.title);
  const sourceUrl = requiredString(raw.gamerpower_url);
  if (
    (typeof id !== 'number' && typeof id !== 'string') ||
    !title ||
    !sourceUrl
  )
    return undefined;
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.gamerpower.com')
    return undefined;
  if (raw.status !== 'Active') return undefined;
  const type = requiredString(raw.type)?.toLowerCase();
  if (type !== 'game' && type !== 'dlc') return undefined;
  const platforms =
    requiredString(raw.platforms)
      ?.split(',')
      .map((part) => part.trim()) ?? [];
  return {
    id: `gamerpower:${id}`,
    title,
    description: requiredString(raw.description),
    category: type,
    platforms,
    // "worth" is an estimate, not a verified original store price.
    originalPrice: undefined,
    currentPrice: '0',
    url: sourceUrl,
    imageUrl: requiredString(raw.image),
    startsAt: dateValue(raw.published_date),
    endsAt: dateValue(raw.end_date, true),
    source: 'GamerPower',
    sourceUrl,
    fetchedAt: now.toISOString(),
  };
}

export const gamerpower: Source = {
  id: 'gamerpower',
  async collect(now) {
    const response = await fetchWithRetry(API);
    if (response.status === 201) return [];
    const data: unknown = await response.json();
    if (!Array.isArray(data))
      throw new Error('GamerPower: unexpected response format');
    return data
      .filter((item): item is Raw => item !== null && typeof item === 'object')
      .map((item) => normalizeGamerPower(item, now))
      .filter((item): item is Offer => item !== undefined);
  },
  async verify(offer, now) {
    const id = offer.id.match(/^gamerpower:(\d+)$/)?.[1];
    if (!id) return false;
    const response = await fetchWithRetry(
      `https://www.gamerpower.com/api/giveaway?id=${id}`,
    );
    if (response.status === 201) return false;
    const raw: unknown = await response.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const current = normalizeGamerPower(raw as Raw, now);
    return (
      !!current &&
      current.id === offer.id &&
      current.url === offer.url &&
      (!current.endsAt || new Date(current.endsAt) > now)
    );
  },
};
