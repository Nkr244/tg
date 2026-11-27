export type Category =
  | 'game'
  | 'dlc'
  | 'software'
  | 'ai'
  | 'opensource'
  | 'discounts'
  | 'promo'
  | 'digest';

export type OfferType =
  | 'temporary_giveaway'
  | 'permanently_free'
  | 'free_license'
  | 'free_tier'
  | 'open_source'
  | 'discount'
  | 'trial';

export interface Offer {
  id: string;
  title: string;
  description?: string;
  category: Category;
  offerType?: OfferType;
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
  conditions?: string;
  claimUrl?: string;
  officialUrl?: string;
  popularity?: number;
  slug?: string;
  seoTitle?: string;
  summary?: string;
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
  shortsText?: string;
  notificationSentAt?: string;
}

export interface Source {
  id: string;
  collect(now: Date): Promise<Offer[]>;
  verify?(offer: Offer, now: Date): Promise<boolean>;
}
