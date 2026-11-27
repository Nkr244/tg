import { gamerpower } from './gamerpower.js';
import { lootScraper } from './lootscraper.js';
import { githubCurated } from './github.js';
import type { Source } from '../types/index.js';

export const sources: Record<string, Source> = {
  gamerpower,
  'lootscraper-epic': lootScraper('epic'),
  'lootscraper-gog': lootScraper('gog'),
  'lootscraper-steam': lootScraper('steam'),
  'github-ai': githubCurated('github-ai'),
  'github-software': githubCurated('github-software'),
};
