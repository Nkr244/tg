import type { Channel } from '../types/index.js';

export class TelegramError extends Error {
  constructor(
    public readonly definite: boolean,
    public readonly retryAfterSeconds?: number,
    public readonly status?: number,
  ) {
    super('Telegram API rejected the request');
  }
}

interface TelegramResponse {
  ok: boolean;
  result?: { message_id?: number };
  parameters?: { retry_after?: number };
}

async function callTelegram(
  method: string,
  body: FormData | URLSearchParams,
): Promise<number> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramError(true);
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    // A timeout or broken connection may occur after Telegram has accepted the post.
    throw new TelegramError(false);
  }
  let data: TelegramResponse;
  try {
    data = (await response.json()) as TelegramResponse;
  } catch {
    throw new TelegramError(false);
  }
  if (!response.ok || !data.ok) {
    // 429 and other 4xx responses are explicit rejections. A 5xx may have
    // followed successful delivery, so it is deliberately never auto-retried.
    throw new TelegramError(
      response.status >= 400 && response.status < 500,
      data.parameters?.retry_after,
      response.status,
    );
  }
  if (!Number.isInteger(data.result?.message_id))
    throw new TelegramError(false);
  return data.result!.message_id!;
}

export async function sendPhoto(
  channel: Channel,
  image: Buffer,
  caption: string,
  offerUrl: string,
  overrideChatId?: string,
  buttonText = 'Забрать бесплатно',
): Promise<number> {
  const chatId = overrideChatId || process.env[channel.telegramChatIdEnv];
  if (!chatId) throw new TelegramError(true);
  const body = new FormData();
  body.append('chat_id', chatId);
  body.append('caption', caption);
  body.append('parse_mode', 'HTML');
  body.append(
    'photo',
    new Blob([new Uint8Array(image)], { type: 'image/jpeg' }),
    'cover.jpg',
  );
  body.append(
    'reply_markup',
    JSON.stringify({
      inline_keyboard: [[{ text: buttonText, url: offerUrl }]],
    }),
  );
  return callTelegram('sendPhoto', body);
}

export async function sendText(chatId: string, text: string): Promise<number> {
  const body = new URLSearchParams({
    chat_id: chatId,
    text: text.slice(0, 4000),
  });
  return callTelegram('sendMessage', body);
}
