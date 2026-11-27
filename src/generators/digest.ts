import type { PublishedEntry } from '../types/index.js';
import { displayTitle } from '../utils/title.js';

export function generateWeeklyDigest(
  entries: PublishedEntry[],
  channelId: string,
  channelUsername: string,
  now: Date,
): string | undefined {
  const recent = entries
    .filter((entry) => entry.channelId === channelId)
    .filter((entry) => {
      const age = now.getTime() - new Date(entry.sentAt).getTime();
      return age >= 0 && age < 7 * 86400_000;
    })
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .slice(0, 5);
  if (!recent.length || !/^@[A-Za-z0-9_]{5,}$/.test(channelUsername)) return;
  return [
    '🗂️ Халява.exe — находки недели',
    '',
    ...recent.map(
      (entry, index) =>
        `${index + 1}. ${displayTitle(entry.offer.title)} — https://t.me/${channelUsername.slice(1)}/${entry.messageId}`,
    ),
    '',
    'Проверяйте срок и условия каждой акции в исходном посте. Запусти халяву.',
  ].join('\n');
}
