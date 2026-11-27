import type { Channel, Offer } from '../types/index.js';
import { displayTitle } from '../utils/title.js';

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function generatePost(offer: Offer, channel: Channel): string {
  const heads =
    offer.category === 'dlc'
      ? ['🎁 Бесплатное дополнение', '✨ Раздача DLC', '🔥 DLC бесплатно']
      : offer.category === 'software'
        ? [
            '💻 Бесплатная программа',
            '⚡ Цифровая находка',
            '🎁 Полезная программа бесплатно',
          ]
        : [
            '🔥 Бесплатная раздача',
            '🎮 Игра бесплатно',
            '🎁 Можно забрать бесплатно',
          ];
  const number = Number(offer.id.replace(/\D/g, '').slice(-5)) || 0;
  const lines = [
    `<b>${heads[number % heads.length]} — ${escapeHtml(displayTitle(offer.title))}</b>`,
    '',
    `🎮 Платформа: ${escapeHtml(offer.platforms.join(', '))}`,
  ];
  if (offer.originalPrice)
    lines.push(`💰 Обычная цена: ${escapeHtml(offer.originalPrice)}`);
  lines.push('🎁 Сейчас: бесплатно');
  if (offer.endsAt) {
    lines.push(
      `📅 Забрать до: ${new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(offer.endsAt))}`,
    );
  }
  if (!offer.region)
    lines.push('🌍 Доступность по регионам уточняйте на странице акции.');
  lines.push(
    '',
    `Источник: <a href="${escapeHtml(offer.sourceUrl)}">${escapeHtml(offer.source)}</a>`,
    `<b>${escapeHtml(channel.name)}</b> · Запусти халяву`,
    offer.category === 'software'
      ? '#бесплатно #программы'
      : '#раздачи #бесплатно #игры',
  );
  const caption = lines.join('\n');
  if (caption.length > 1000)
    throw new Error('Telegram caption exceeds 1000 characters');
  return caption;
}
