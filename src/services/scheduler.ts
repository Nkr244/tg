import type { Channel, PublishedEntry, QueueEntry } from '../types/index.js';

function localParts(
  now: Date,
  timezone: string,
): { day: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

export function canPublish(
  channel: Channel,
  published: PublishedEntry[],
  now: Date,
): boolean {
  const local = localParts(now, channel.timezone);
  if (
    local.time < channel.publishHours.from ||
    local.time >= channel.publishHours.to
  )
    return false;
  const sent = published.filter((item) => item.channelId === channel.id);
  if (
    sent.filter(
      (item) =>
        localParts(new Date(item.sentAt), channel.timezone).day === local.day,
    ).length >= channel.maxPostsPerDay
  )
    return false;
  const latest = Math.max(
    0,
    ...sent.map((item) => new Date(item.sentAt).getTime()),
  );
  return now.getTime() - latest >= channel.minPostIntervalMinutes * 60_000;
}

export function chooseNext(
  queue: QueueEntry[],
  channelId: string,
  now: Date,
): QueueEntry | undefined {
  return queue
    .filter(
      (entry) => entry.channelId === channelId && entry.status === 'queued',
    )
    .filter(
      (entry) => !entry.offer.endsAt || new Date(entry.offer.endsAt) > now,
    )
    .sort((a, b) => {
      const aEnd = a.offer.endsAt
        ? new Date(a.offer.endsAt).getTime()
        : Infinity;
      const bEnd = b.offer.endsAt
        ? new Date(b.offer.endsAt).getTime()
        : Infinity;
      return aEnd - bEnd || a.queuedAt.localeCompare(b.queuedAt);
    })[0];
}
