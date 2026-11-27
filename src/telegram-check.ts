import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface ApiResult<T> {
  ok: boolean;
  result?: T;
}

interface BotInfo {
  id: number;
  username?: string;
}

interface ChatInfo {
  id: number;
  title?: string;
}

interface ChatMember {
  status: string;
  can_post_messages?: boolean;
}

async function readTelegram<T>(
  token: string,
  method: string,
  fields: Record<string, string> = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      body: new URLSearchParams(fields),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new Error(`Telegram ${method}: network error`);
  }
  let data: ApiResult<T>;
  try {
    data = (await response.json()) as ApiResult<T>;
  } catch {
    throw new Error(`Telegram ${method}: invalid response`);
  }
  if (!response.ok || !data.ok || !data.result)
    throw new Error(`Telegram ${method}: HTTP ${response.status}`);
  return data.result;
}

export async function inspectBot(
  token: string,
  channelId: string,
): Promise<{ botUsername: string; channelTitle: string; canPost: boolean }> {
  const bot = await readTelegram<BotInfo>(token, 'getMe');
  const chat = await readTelegram<ChatInfo>(token, 'getChat', {
    chat_id: channelId,
  });
  const member = await readTelegram<ChatMember>(token, 'getChatMember', {
    chat_id: channelId,
    user_id: String(bot.id),
  });
  return {
    botUsername: bot.username ?? String(bot.id),
    channelTitle: chat.title ?? channelId,
    canPost:
      member.status === 'creator' ||
      (member.status === 'administrator' && member.can_post_messages === true),
  };
}

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !channelId)
    throw new Error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID in .env');
  const result = await inspectBot(token, channelId);
  console.log(`Бот: @${result.botUsername}`);
  console.log(`Канал: ${result.channelTitle}`);
  console.log(`Право публикации: ${result.canPost ? 'есть' : 'нет'}`);
  if (!result.canPost) process.exitCode = 1;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  void main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Telegram check failed',
    );
    process.exitCode = 1;
  });
}
