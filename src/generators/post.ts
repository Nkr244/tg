import type { Channel, Offer } from '../types/index.js';
import { displayTitle } from '../utils/title.js';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function heading(offer: Offer): string {
  switch (offer.offerType) {
    case 'open_source':
      return offer.category === 'ai'
        ? '🤖 Открытый AI-инструмент'
        : '💻 Открытая программа';
    case 'free_tier':
      return '🤖 Бесплатный тариф';
    case 'trial':
      return '⏳ Пробный доступ';
    case 'discount':
      return '🏷️ Скидка';
    case 'permanently_free':
      return '✅ Бесплатно постоянно';
    case 'free_license':
      return '🎁 Бесплатная лицензия';
    default:
      return offer.category === 'dlc'
        ? '🎁 Бесплатное дополнение'
        : offer.category === 'software'
          ? '💻 Бесплатная программа'
          : '🎮 Бесплатная игра';
  }
}

export function generatePost(offer: Offer, channel: Channel): string {
  const lines = [
    `<b>${heading(offer)} — ${escapeHtml(displayTitle(offer.title))}</b>`,
  ];
  if (offer.summary && /[А-Яа-яЁё]/.test(offer.summary))
    lines.push('', escapeHtml(offer.summary.slice(0, 230)));
  else if (offer.description && /[А-Яа-яЁё]/.test(offer.description))
    lines.push('', escapeHtml(offer.description.slice(0, 230)));
  lines.push('', `🖥️ Платформа: ${escapeHtml(offer.platforms.join(', '))}`);
  if (offer.originalPrice)
    lines.push(`💰 Обычная цена: ${escapeHtml(offer.originalPrice)}`);
  if (offer.offerType === 'open_source')
    lines.push(
      '🔓 Открытый исходный код; условия использования зависят от лицензии.',
    );
  else if (offer.offerType === 'free_tier')
    lines.push('🆓 Доступен бесплатный тариф; лимиты смотрите на сайте.');
  else if (offer.offerType === 'trial')
    lines.push(
      '⏳ Пробный доступ; проверьте условия и окончание пробного периода.',
    );
  else if (offer.offerType === 'discount')
    lines.push('🏷️ Условия скидки смотрите на странице предложения.');
  else lines.push('🎁 Сейчас: бесплатно');
  if (offer.endsAt)
    lines.push(
      `📅 По данным источника — до ${new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(offer.endsAt))}. Точное время проверьте на странице акции.`,
    );
  if (offer.conditions)
    lines.push(`ℹ️ ${escapeHtml(offer.conditions.slice(0, 180))}`);
  if (offer.region) lines.push(`🌍 Регион: ${escapeHtml(offer.region)}`);
  else lines.push('🌍 Доступность по регионам уточняйте на странице акции.');
  lines.push(
    '',
    `Источник: <a href="${escapeHtml(offer.sourceUrl)}">${escapeHtml(offer.source)}</a>`,
    `<b>${escapeHtml(channel.name)}</b> · Запусти халяву`,
    offer.category === 'ai'
      ? '#AI #бесплатно'
      : offer.category === 'opensource' || offer.category === 'software'
        ? '#программы #бесплатно'
        : '#игры #бесплатно',
  );
  const caption = lines.join('\n');
  if (caption.length > 1000)
    throw new Error('Telegram caption exceeds 1000 characters');
  return caption;
}
