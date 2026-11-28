import type { PublishedEntry } from '../../src/types/index.js';
import { displayTitle } from '../../src/utils/title.js';

export type PublicOffer = {
  id: string;
  slug: string;
  title: string;
  category: string;
  offerType: string;
  status: string;
  summary: string;
  description: string;
  cover: string;
  platforms: string[];
  os: string[];
  originalPrice?: string;
  currentPrice: string;
  endsAt?: string;
  publishedAt: string;
  region?: string;
  conditions?: string;
  source: string;
  sourceUrl: string;
  officialUrl?: string;
  messageId: number;
  telegramUrl: string;
  seoTitle: string;
  seoDescription: string;
  lastCheckedAt?: string;
};

const historicalDescriptions: Record<string, string> = {
  'gamerpower:2478':
    'Boots Quest DX — небольшая приключенческая игра с головоломками и предметами для сбора. Источник сообщает о бесплатной загрузке через itch.io.',
  'gamerpower:3857':
    'Bread and Fred — двухмерный кооперативный платформер. Два игрока помогают друг другу подняться на заснеженную гору. Источник сообщает о бесплатной раздаче через Epic Games Store.',
  'gamerpower:3859':
    'Vertical Drop Heroes HD — двухмерный платформер с процедурными уровнями и элементами ролевой игры. Источник сообщает о раздаче ключа Steam через Fanatical.',
  'gamerpower:3852':
    'Contractor: The Clean Up Part 2 — игра об уборке строительных площадок: игрок управляет погрузчиком и убирает обломки и мусор. Источник сообщает о раздаче через Epic Games Store.',
};

export function safeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export function toPublicOffer(entry: PublishedEntry): PublicOffer | undefined {
  const offer = entry.offer;
  if (
    !Number.isSafeInteger(entry.messageId) ||
    entry.messageId <= 0 ||
    !Number.isFinite(Date.parse(entry.sentAt)) ||
    !offer?.id ||
    !offer?.title ||
    !safeUrl(offer.sourceUrl)
  )
    return undefined;
  const title = displayTitle(offer.title).slice(0, 180);
  const base =
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'offer';
  const suffix =
    entry.key?.slice(0, 10).replace(/[^a-f0-9]/g, '') ||
    String(entry.messageId);
  const slug = `${base}-${suffix}`;
  const platforms = Array.isArray(offer.platforms)
    ? offer.platforms
        .filter((x): x is string => typeof x === 'string')
        .slice(0, 12)
    : [];
  const os = platforms.filter((x) =>
    /^(windows|android|ios|macos|linux)$/i.test(x),
  );
  const description =
    historicalDescriptions[offer.id] ??
    (offer.description && /[А-Яа-яЁё]/.test(offer.description)
      ? offer.description
      : undefined) ??
    (offer.summary && /[А-Яа-яЁё]/.test(offer.summary)
      ? offer.summary
      : undefined) ??
    `${title} — ${offer.category === 'game' ? 'игра' : offer.category === 'ai' ? 'инструмент с нейросетью' : 'цифровой продукт'}. Информация о бесплатном доступе опубликована в источнике ${offer.source || 'предложения'}. Условия и доступность проверяйте по ссылке на источник.`;
  const summary = (
    offer.summary && /[А-Яа-яЁё]/.test(offer.summary)
      ? offer.summary
      : description
  ).slice(0, 220);
  const sourceUrl = safeUrl(offer.sourceUrl)!;
  return {
    id: offer.id,
    slug,
    title,
    category: offer.category,
    offerType:
      offer.offerType ?? (offer.endsAt ? 'temporary_giveaway' : 'unknown'),
    status:
      offer.endsAt && Number.isFinite(Date.parse(offer.endsAt))
        ? new Date(offer.endsAt) <= new Date()
          ? 'ended'
          : 'active'
        : offer.offerType &&
            [
              'open_source',
              'free_tier',
              'permanently_free',
              'free_license',
            ].includes(offer.offerType)
          ? 'permanent'
          : 'unknown',
    summary,
    description,
    cover: `/covers/${slug}.webp`,
    platforms,
    os,
    ...(offer.originalPrice ? { originalPrice: offer.originalPrice } : {}),
    currentPrice: offer.currentPrice,
    ...(offer.endsAt && Number.isFinite(Date.parse(offer.endsAt))
      ? { endsAt: offer.endsAt }
      : {}),
    publishedAt: entry.sentAt,
    ...(offer.region ? { region: offer.region } : {}),
    ...(offer.conditions ? { conditions: offer.conditions } : {}),
    source: offer.source || new URL(sourceUrl).hostname,
    sourceUrl,
    ...(safeUrl(offer.officialUrl ?? offer.claimUrl)
      ? { officialUrl: safeUrl(offer.officialUrl ?? offer.claimUrl) }
      : {}),
    messageId: entry.messageId,
    telegramUrl: `https://t.me/halyava_exe_hub/${entry.messageId}`,
    seoTitle: `${title} — бесплатно | Халява.exe`,
    seoDescription:
      summary.length <= 155
        ? summary
        : summary.slice(0, 155).replace(/\s+\S*$/, '') + '…',
    lastCheckedAt: entry.sentAt,
  };
}
