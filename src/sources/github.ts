import type { Offer, Source, Category } from '../types/index.js';
import { fetchWithRetry } from '../utils/http.js';

interface CuratedRepo {
  path: string;
  category: Category;
  title: string;
  officialUrl: string;
  platforms: string[];
  summary: string;
  conditions?: string;
}
const curated: Record<string, CuratedRepo[]> = {
  'github-ai': [
    {
      path: 'ollama/ollama',
      category: 'ai',
      title: 'Ollama',
      officialUrl: 'https://ollama.com/download',
      platforms: ['Windows', 'macOS', 'Linux'],
      summary:
        'Запускает языковые модели на вашем компьютере: можно общаться с ними и пробовать локальный AI без отправки запросов в облако. Полезно для экспериментов и работы с моделями; скорость зависит от оборудования.',
      conditions:
        'Для локальной работы нужна установка и подходящее оборудование. Облачные модели Ollama могут требовать оплаты.',
    },
  ],
  'github-software': [
    {
      path: 'localsend/localsend',
      category: 'opensource',
      title: 'LocalSend',
      officialUrl: 'https://localsend.org/download',
      platforms: ['Windows', 'macOS', 'Linux', 'Android', 'iOS'],
      summary:
        'Передаёт файлы и текст между устройствами в одной локальной сети без облака и регистрации. Полезно, когда нужно быстро отправить фото или документ с телефона на компьютер либо на другое устройство рядом.',
      conditions: 'Устройства должны находиться в одной локальной сети.',
    },
    {
      path: 'microsoft/PowerToys',
      category: 'opensource',
      title: 'PowerToys',
      officialUrl:
        'https://learn.microsoft.com/en-us/windows/powertoys/install',
      platforms: ['Windows 10/11'],
      summary:
        'Бесплатный набор утилит Microsoft для Windows. Помогает удобно размещать окна, массово переименовывать файлы и переназначать клавиши. Полезен для повседневной работы и повторяющихся задач.',
      conditions: 'Требуется Windows 10 версии 2004 или новее либо Windows 11.',
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
    title: item.title,
    description: item.summary,
    summary: item.summary,
    category: item.category,
    offerType: 'open_source',
    platforms: item.platforms,
    currentPrice: '0',
    url: item.officialUrl,
    officialUrl: item.officialUrl,
    sourceUrl: repo.html_url,
    source: 'GitHub',
    conditions: `Лицензия: ${license.spdx_id}. ${item.conditions ?? ''}`.trim(),
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
      if (!item) return false;
      const current = await getRepo(item, id, now);
      return (
        current?.id === offer.id &&
        current.title === offer.title &&
        current.url === offer.url &&
        current.platforms.join(',') === offer.platforms.join(',')
      );
    },
  };
}
