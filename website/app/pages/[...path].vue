<script setup lang="ts">
const route = useRoute();
const catalog = useCatalog();
const path = route.path.replace(/\/$/, '');
const pages: Record<
  string,
  {
    title: string;
    description: string;
    category?: string;
    platform?: string;
    archive?: boolean;
  }
> = {
  '/games': {
    title: 'Бесплатные игры',
    description: 'Подтверждённые раздачи игр.',
    category: 'game',
  },
  '/games/steam': {
    title: 'Игры Steam',
    description: 'Раздачи игр для Steam.',
    category: 'game',
    platform: 'Steam',
  },
  '/games/epic-games': {
    title: 'Игры Epic Games',
    description: 'Раздачи игр Epic Games.',
    category: 'game',
    platform: 'Epic Games',
  },
  '/games/gog': {
    title: 'Игры GOG',
    description: 'Раздачи игр GOG.',
    category: 'game',
    platform: 'GOG',
  },
  '/software': {
    title: 'Бесплатные программы',
    description: 'Опубликованные бесплатные программы.',
    category: 'software',
  },
  '/ai': {
    title: 'Нейросети',
    description: 'Опубликованные бесплатные AI-инструменты.',
    category: 'ai',
  },
  '/opensource': {
    title: 'Open Source',
    description: 'Опубликованные проекты с открытым кодом.',
    category: 'opensource',
  },
  '/discounts': {
    title: 'Скидки',
    description: 'Подтверждённые скидки на цифровые продукты.',
  },
  '/archive': {
    title: 'Архив раздач',
    description: 'История завершённых раздач.',
    archive: true,
  },
};
const page = pages[path];
if (!page)
  throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' });
const selected = page.archive
  ? catalog
  : path === '/discounts'
    ? catalog.filter((item) => item.offerType === 'discount')
    : catalog.filter(
        (item) =>
          (!page.category || item.category === page.category) &&
          (!page.platform ||
            item.platforms.some((p) =>
              p.toLowerCase().includes(page.platform!.toLowerCase()),
            )),
      );
usePageSeo(
  `${page.title} | Халява.exe`,
  page.description,
  `${path}/`,
  undefined,
  selected.length > 0,
);
</script>
<template>
  <div>
    <section class="page-intro container">
      <nav class="breadcrumbs" aria-label="Хлебные крошки">
        <NuxtLink to="/">Главная</NuxtLink><span>/</span
        ><span>{{ page.title }}</span>
      </nav>
      <span class="section-kicker"
        >&gt;_ КАТАЛОГ / {{ page.title.toUpperCase() }}</span
      >
      <h1>{{ page.title }}</h1>
      <p>
        {{ page.description }} Условия и наличие уточняйте на сайте источника.
      </p>
      <div v-if="path === '/games'" class="subnav">
        <NuxtLink to="/games/steam/">Steam</NuxtLink
        ><NuxtLink to="/games/epic-games/">Epic Games</NuxtLink
        ><NuxtLink to="/games/gog/">GOG</NuxtLink>
      </div>
    </section>
    <CatalogBrowser
      :items="selected"
      :heading="page.title"
      :fixed-category="page.category"
      :fixed-platform="page.platform"
      :archive="page.archive"
    />
  </div>
</template>
