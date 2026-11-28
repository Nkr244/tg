import type { PublicOffer } from '../types/catalog';

export const categories = [
  { path: '/games/', label: 'Игры', category: 'game' },
  { path: '/software/', label: 'Программы', category: 'software' },
  { path: '/ai/', label: 'Нейросети', category: 'ai' },
  { path: '/opensource/', label: 'Open Source', category: 'opensource' },
];

export function statusOf(item: PublicOffer, now = new Date()): string {
  if (item.endsAt && new Date(item.endsAt).getTime() <= now.getTime())
    return 'Раздача завершена';
  if (
    item.endsAt &&
    new Date(item.endsAt).getTime() - now.getTime() < 48 * 60 * 60_000
  )
    return 'Скоро закончится';
  if (item.offerType === 'open_source') return 'Open Source';
  if (item.offerType === 'free_license') return 'Бесплатная лицензия';
  if (item.offerType === 'free_tier') return 'Бесплатный тариф';
  if (item.offerType === 'permanently_free') return 'Бесплатно';
  if (item.endsAt) return 'Бесплатно';
  return 'Доступность не подтверждена';
}

export function isCurrent(item: PublicOffer, now = new Date()): boolean {
  return !item.endsAt || new Date(item.endsAt).getTime() > now.getTime();
}

export function isPermanent(item: PublicOffer): boolean {
  return [
    'open_source',
    'free_tier',
    'permanently_free',
    'free_license',
  ].includes(item.offerType);
}

export function filterOffers(
  items: PublicOffer[],
  filters: Record<string, string>,
  now = new Date(),
): PublicOffer[] {
  const query = (filters.q || '').trim().toLocaleLowerCase('ru');
  let result = items.filter((item) => {
    if (
      query &&
      ![
        item.title,
        item.summary,
        item.description,
        item.category,
        ...item.platforms,
        item.source,
      ]
        .join(' ')
        .toLocaleLowerCase('ru')
        .includes(query)
    )
      return false;
    if (filters.category && item.category !== filters.category) return false;
    if (
      filters.platform &&
      !item.platforms.some((p) =>
        p.toLowerCase().includes(filters.platform.toLowerCase()),
      )
    )
      return false;
    if (
      filters.os &&
      !item.os.some((p) => p.toLowerCase() === filters.os.toLowerCase())
    )
      return false;
    if (filters.current === '1' && !isCurrent(item, now)) return false;
    if (filters.permanent === '1' && !isPermanent(item)) return false;
    if (
      filters.soon === '1' &&
      (!item.endsAt ||
        !isCurrent(item, now) ||
        new Date(item.endsAt).getTime() - now.getTime() >= 48 * 60 * 60_000)
    )
      return false;
    return true;
  });
  if (filters.sort === 'title')
    result = result.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  else if (filters.sort === 'ending')
    result = result.sort((a, b) =>
      (a.endsAt || '9999').localeCompare(b.endsAt || '9999'),
    );
  else
    result = result.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return result;
}

export function dateRu(value?: string): string {
  if (!value) return 'Не указан';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}
