import type { Offer } from '../types/index.js';
import { displayTitle } from '../utils/title.js';

export function generateShortsBrief(offer: Offer, postUrl?: string): string {
  const title = displayTitle(offer.title);
  const fact =
    offer.offerType === 'open_source'
      ? 'открытый проект'
      : offer.offerType === 'free_tier'
        ? 'есть бесплатный тариф'
        : offer.offerType === 'trial'
          ? 'доступен пробный период'
          : offer.offerType === 'discount'
            ? 'действует скидка'
            : 'можно забрать бесплатно';
  const voice = `${title}: ${fact}. Подробности и ссылка — в Халява.exe.`;
  const end = offer.endsAt
    ? `Срок по источнику: ${offer.endsAt.slice(0, 10)}; точное время проверьте на странице акции.`
    : 'Срок окончания не указан.';
  return [
    `Shorts: ${title}`,
    `Источник: ${offer.sourceUrl}`,
    `Прямая ссылка: ${offer.url}`,
    end,
    postUrl ? `Пост: ${postUrl}` : 'Пост: ещё не опубликован',
    '',
    'Промпт для Gemini: Создай вертикальный ролик 9:16 длительностью около 10 секунд в стиле ретро-терминала Халява.exe. Используй только собственную пиксельную графику, фон #0B0E13, акценты #39FF88 и #FFCC00, текст #F5F5F5. Без чужого геймплея, логотипов игр, платной музыки и резких вспышек. Чёткий крупный текст для телефона. Не добавляй фактов, которых нет ниже.',
    `0–3 с: крупно «${title}».`,
    `3–7 с: «${fact}».`,
    '7–10 с: «Ссылка в канале · Запусти халяву».',
    `Русская озвучка: «${voice}»`,
    `Экранный текст: «${title}» / «${fact}» / «Халява.exe».`,
    `Заголовок: ${title} — ${fact} | Халява.exe`,
    `Описание: ${fact}. Условия и ссылка: ${postUrl ?? offer.url}. ${end}`,
    '#ХаляваExe #Бесплатно #Игры #Программы',
  ].join('\n');
}
