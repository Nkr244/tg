import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const adminDir = join(root, 'website/admin');
const dataDir = join(root, 'data');
const origin = 'http://127.0.0.1:4317';
const token = randomBytes(32).toString('hex');

function authorized(request) {
  const session = request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('admin_session='))
    ?.slice('admin_session='.length);
  return Boolean(
    session &&
    session.length === token.length &&
    timingSafeEqual(Buffer.from(session), Buffer.from(token)),
  );
}

function safeUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function publicStatus(offer, now) {
  if (offer.endsAt && Date.parse(offer.endsAt) <= now) return 'ended';
  if (offer.endsAt && Date.parse(offer.endsAt) - now < 48 * 60 * 60_000)
    return 'ending';
  if (
    ['open_source', 'free_tier', 'free_license', 'permanently_free'].includes(
      offer.offerType,
    )
  )
    return 'permanent';
  return offer.endsAt ? 'active' : 'unknown';
}

async function snapshot() {
  const publishedFile = join(dataDir, 'published.json');
  const queueFile = join(dataDir, 'queue.json');
  const [publishedRaw, queueRaw, publishedStat, queueStat] = await Promise.all([
    readFile(publishedFile, 'utf8'),
    readFile(queueFile, 'utf8'),
    stat(publishedFile),
    stat(queueFile),
  ]);
  const published = JSON.parse(publishedRaw);
  const queue = JSON.parse(queueRaw);
  if (!Array.isArray(published) || !Array.isArray(queue))
    throw new Error('Неверный формат файлов состояния');
  const now = Date.now();
  return {
    generatedAt: new Date(now).toISOString(),
    filesUpdatedAt: {
      published: publishedStat.mtime.toISOString(),
      queue: queueStat.mtime.toISOString(),
    },
    published: published
      .filter(
        (item) =>
          Number.isSafeInteger(item.messageId) &&
          item.messageId > 0 &&
          item.offer?.id,
      )
      .map((item) => ({
        id: String(item.offer.id),
        title: String(item.offer.title ?? ''),
        category: String(item.offer.category ?? ''),
        channelId: String(item.channelId ?? ''),
        platforms: Array.isArray(item.offer.platforms)
          ? item.offer.platforms.filter((value) => typeof value === 'string')
          : [],
        currentPrice: String(item.offer.currentPrice ?? ''),
        offerType: String(item.offer.offerType ?? ''),
        endsAt: item.offer.endsAt ?? null,
        sentAt: item.sentAt,
        messageId: item.messageId,
        source: String(item.offer.source ?? ''),
        sourceUrl: safeUrl(item.offer.sourceUrl),
        telegramUrl: `https://t.me/halyava_exe_hub/${item.messageId}`,
        status: publicStatus(item.offer, now),
      }))
      .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt))),
    queue: queue.map((item) => ({
      id: String(item.offer?.id ?? ''),
      title: String(item.offer?.title ?? ''),
      category: String(item.offer?.category ?? ''),
      channelId: String(item.channelId ?? ''),
      platforms: Array.isArray(item.offer?.platforms)
        ? item.offer.platforms.filter((value) => typeof value === 'string')
        : [],
      queuedAt: item.queuedAt,
      endsAt: item.offer?.endsAt ?? null,
      source: String(item.offer?.source ?? ''),
      status: ['queued', 'sending', 'uncertain', 'blocked'].includes(
        item.status,
      )
        ? item.status
        : 'unknown',
    })),
  };
}

function respond(response, status, body, type = 'application/json') {
  response.writeHead(status, { 'Content-Type': `${type}; charset=utf-8` });
  response.end(type === 'application/json' ? JSON.stringify(body) : body);
}

createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
  );
  if (request.headers.host !== '127.0.0.1:4317')
    return respond(response, 403, { error: 'Неверный адрес' });
  if (request.method !== 'GET')
    return respond(response, 405, {
      error: 'Панель доступна только для чтения',
    });
  const url = new URL(request.url || '/', origin);
  if (url.pathname === '/' && url.searchParams.get('token') === token) {
    response.writeHead(302, {
      'Set-Cookie': `admin_session=${token}; HttpOnly; SameSite=Strict; Path=/`,
      Location: '/',
    });
    return response.end();
  }
  if (!authorized(request))
    return respond(response, 403, { error: 'Доступ запрещён' });
  try {
    if (url.pathname === '/api/state')
      return respond(response, 200, await snapshot());
    const assets = {
      '/': ['index.html', 'text/html'],
      '/admin.css': ['admin.css', 'text/css'],
      '/admin.js': ['admin.js', 'text/javascript'],
      '/favicon.svg': ['../public/favicon.svg', 'image/svg+xml'],
    };
    const asset = assets[url.pathname];
    if (!asset) return respond(response, 404, { error: 'Не найдено' });
    return respond(
      response,
      200,
      await readFile(join(adminDir, asset[0])),
      asset[1],
    );
  } catch {
    return respond(response, 500, {
      error: 'Не удалось прочитать локальные данные',
    });
  }
}).listen(4317, '127.0.0.1', () => {
  console.log(`Локальная админка: ${origin}/?token=${token}`);
});
