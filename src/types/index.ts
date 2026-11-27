export type Category = 'game' | 'dlc' | 'software';

export interface Offer {
  id: string;
  title: string;
  description?: string;
  category: Category;
  platforms: string[];
  originalPrice?: string;
  currentPrice: string;
  url: string;
  imageUrl?: string;
  startsAt?: string;
  endsAt?: string;
  source: string;
  sourceUrl: string;
  region?: string;
  fetchedAt: string;
}

export interface Channel {
  id: string;
  enabled: boolean;
  name: string;
  language: 'ru';
  timezone: string;
  sources: string[];
  categories: Category[];
  maxPostsPerDay: number;
  minPostIntervalMinutes: number;
  publishHours: { from: string; to: string };
  telegramChatIdEnv: string;
}

export interface QueueEntry {
  key: string;
  channelId: string;
  offer: Offer;
  queuedAt: string;
  status: 'queued' | 'sending' | 'uncertain' | 'blocked';
}

export interface PublishedEntry {
  key: string;
  channelId: string;
  offer: Offer;
  sentAt: string;
  messageId: number;
}

export interface Source {
  id: string;
  collect(now: Date): Promise<Offer[]>;
  verify?(offer: Offer, now: Date): Promise<boolean>;
}
