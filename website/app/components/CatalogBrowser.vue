<script setup lang="ts">
import type { PublicOffer } from '../types/catalog';
import { filterOffers } from '../utils/catalog';
const props = withDefaults(
  defineProps<{
    items: PublicOffer[];
    heading?: string;
    fixedCategory?: string;
    fixedPlatform?: string;
    archive?: boolean;
  }>(),
  {
    heading: 'Все публикации',
    fixedCategory: '',
    fixedPlatform: '',
    archive: false,
  },
);
const route = useRoute();
const searchInput = ref(typeof route.query.q === 'string' ? route.query.q : '');
watch(
  () => route.query.q,
  (q) => {
    searchInput.value = typeof q === 'string' ? q : '';
  },
);
function setQuery(name: string, value: string) {
  const query = { ...route.query };
  query[name] = value || undefined;
  void navigateTo({ path: route.path, query });
}
const param = (name: string) =>
  typeof route.query[name] === 'string' ? String(route.query[name]) : '';
const results = computed(() => {
  const filters = {
    q: param('q'),
    category: props.fixedCategory || param('category'),
    platform: props.fixedPlatform || param('platform'),
    os: param('os'),
    current: param('current'),
    permanent: param('permanent'),
    soon: param('soon'),
    sort: param('sort'),
  };
  const selected = props.archive
    ? props.items.filter(
        (item) => item.endsAt && new Date(item.endsAt) <= new Date(),
      )
    : props.items;
  return filterOffers(selected, filters);
});
</script>
<template>
  <section
    id="catalog"
    class="catalog-section container"
    aria-labelledby="catalog-title"
  >
    <div class="section-heading">
      <div>
        <span class="section-kicker">// КАТАЛОГ</span>
        <h2 id="catalog-title">{{ heading }}</h2>
        <p>
          Опубликовано в Telegram · {{ results.length }}
          {{ results.length === 1 ? 'материал' : 'материала' }}
        </p>
      </div>
      <span class="terminal-mark">[ каталог_открыт ]</span>
    </div>
    <form
      class="catalog-controls"
      role="search"
      @submit.prevent="setQuery('q', searchInput)"
    >
      <label class="search-field"
        ><span class="sr-only">Поиск по каталогу</span
        ><span aria-hidden="true">⌕</span
        ><input
          v-model="searchInput"
          type="search"
          placeholder="Найти игру, программу, платформу..."
        /><button type="submit">Найти</button></label
      >
      <div class="filter-row">
        <label v-if="!fixedCategory"
          >Категория<select
            :value="param('category')"
            @change="
              setQuery('category', ($event.target as HTMLSelectElement).value)
            "
          >
            <option value="">Все</option>
            <option value="game">Игры</option>
            <option value="software">Программы</option>
            <option value="ai">Нейросети</option>
            <option value="opensource">Open Source</option>
          </select></label
        >
        <label v-if="!fixedPlatform"
          >Площадка<select
            :value="param('platform')"
            @change="
              setQuery('platform', ($event.target as HTMLSelectElement).value)
            "
          >
            <option value="">Все</option>
            <option value="Steam">Steam</option>
            <option value="Epic Games">Epic Games</option>
            <option value="GOG">GOG</option>
          </select></label
        >
        <label
          >ОС<select
            :value="param('os')"
            @change="setQuery('os', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">Любая</option>
            <option
              v-for="os in ['Windows', 'Android', 'iOS', 'macOS', 'Linux']"
              :key="os"
              :value="os"
            >
              {{ os }}
            </option>
          </select></label
        >
        <label
          >Порядок<select
            :value="param('sort')"
            @change="
              setQuery('sort', ($event.target as HTMLSelectElement).value)
            "
          >
            <option value="new">Сначала новые</option>
            <option value="ending">Скоро заканчиваются</option>
            <option value="title">По названию</option>
          </select></label
        >
      </div>
      <div class="quick-filters">
        <button
          type="button"
          :class="{ active: param('current') === '1' }"
          @click="setQuery('current', param('current') === '1' ? '' : '1')"
        >
          Только актуальные</button
        ><button
          type="button"
          :class="{ active: param('permanent') === '1' }"
          @click="setQuery('permanent', param('permanent') === '1' ? '' : '1')"
        >
          Постоянно бесплатно</button
        ><button
          type="button"
          :class="{ active: param('soon') === '1' }"
          @click="setQuery('soon', param('soon') === '1' ? '' : '1')"
        >
          Скоро заканчиваются
        </button>
      </div>
    </form>
    <div v-if="results.length" class="offer-grid">
      <OfferCard v-for="item in results" :key="item.slug" :offer="item" />
    </div>
    <div v-else class="empty-state">
      <span aria-hidden="true">⌕</span>
      <h3>Ничего не найдено</h3>
      <p>Попробуйте другой запрос или снимите фильтры.</p>
      <button type="button" @click="navigateTo(route.path)">
        Сбросить фильтры
      </button>
    </div>
  </section>
</template>
