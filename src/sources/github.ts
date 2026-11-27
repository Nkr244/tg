import type { Offer, Source, Category } from '../types/index.js';
import { fetchWithRetry } from '../utils/http.js';

interface CuratedRepo {
  path: string;
  category: Category;
  summary: string;
}
const curated: Record<string, CuratedRepo[]> = {
  'github-ai': [
    {
      path: 'ollama/ollama',
      category: 'ai',
      summary:
        'Локальный запуск языковых моделей. Для работы нужна установка и подходящее оборудование.',
    },
    {
      path: 'open-webui/open-webui',
      category: 'ai',
      summary:
        'Веб-интерфейс для работы с локальными и внешними моделями. Часть подключаемых сервисов может быть платной.',
    },
  ],
  'github-software': [
    {
      path: 'localsend/localsend',
      category: 'opensource',
      summary: 'Передача файлов между устройствами по локальной сети.',
    },
    {
      path: 'microsoft/PowerToys',
      category: 'opensource',
      summary: 'Набор утилит для настройки и повышения удобства Windows.',
    },
  ],
};
type Repo = Record<string, unknown>;

function normalize(
  repo: Repo,
  item: CuratedRepo,
  sourceId: string,
  now: Date,
): Offer | undefined {
  const license = repo.license as Repo | null;
  const path = item.path;
  if (
    repo.full_name !== path ||
    repo.archived !== false ||
    repo.disabled !== false ||
    typeof repo.html_url !== 'string' ||
    repo.html_url !== `https://github.com/${path}` ||
    typeof license?.spdx_id !== 'string' ||
    license.spdx_id === 'NOASSERTION' ||
    typeof repo.pushed_at !== 'string' ||
    new Date(repo.pushed_at).getTime() < now.getTime() - 180 * 86400_000
  )
    return;
  return {
    id: `${sourceId}:${path.toLowerCase()}`,
    title: typeof repo.name === 'string' ? repo.name : path.split('/')[1]!,
    description: item.summary,
    summary: item.summary,
    category: item.category,
    offerType: 'open_source',
    platforms: item.category === 'ai' ? ['ПК', 'локальный запуск'] : ['ПК'],
    currentPrice: '0',
    url: repo.html_url,
    officialUrl: repo.html_url,
    sourceUrl: repo.html_url,
    source: 'GitHub',
    conditions: `Лицензия: ${license.spdx_id}. Требуется самостоятельная установка.`,
    popularity:
      typeof repo.stargazers_count === 'number'
        ? repo.stargazers_count
        : undefined,
    fetchedAt: now.toISOString(),
  };
}

async function getRepo(
  item: CuratedRepo,
  sourceId: string,
  now: Date,
): Promise<Offer | undefined> {
  const response = await fetchWithRetry(
    `https://api.github.com/repos/${item.path}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'halyava-exe-preview',
      },
    },
    1,
  );
  return normalize((await response.json()) as Repo, item, sourceId, now);
}

export function githubCurated(id: keyof typeof curated): Source {
  return {
    id,
    async collect(now) {
      const results = await Promise.allSettled(
        curated[id]!.map((item) => getRepo(item, id, now)),
      );
      const offers: Offer[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value)
          offers.push(result.value);
        else if (result.status === 'rejected')
          console.error(
            `GitHub curated repository unavailable: ${result.reason instanceof Error ? result.reason.message : 'unknown error'}`,
          );
      }
      return offers;
    },
    async verify(offer, now) {
      const item = curated[id]!.find(
        (candidate) => `${id}:${candidate.path.toLowerCase()}` === offer.id,
      );
      return !!item && !!(await getRepo(item, id, now));
    },
  };
}
