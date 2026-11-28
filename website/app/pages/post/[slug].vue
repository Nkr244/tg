<script setup lang="ts">
import { dateRu, isCurrent, statusOf } from '../../utils/catalog';
const route = useRoute();
const catalog = useCatalog();
const offer = catalog.find((item) => item.slug === route.params.slug);
if (!offer)
  throw createError({
    statusCode: 404,
    statusMessage: 'Публикация не найдена',
  });
const status = computed(() => statusOf(offer));
const current = computed(() => isCurrent(offer));
const copied = ref(false);
async function copyLink() {
  await navigator.clipboard.writeText(window.location.href);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}
const related = catalog
  .filter(
    (item) => item.slug !== offer.slug && item.category === offer.category,
  )
  .slice(0, 3);
usePageSeo(
  offer.seoTitle,
  offer.seoDescription,
  `/post/${offer.slug}/`,
  offer.cover,
);
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: offer.title,
        description: offer.seoDescription,
        image: `${String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')}${offer.cover}`,
        datePublished: offer.publishedAt,
        dateModified: offer.lastCheckedAt || offer.publishedAt,
        publisher: { '@type': 'Organization', name: 'Халява.exe' },
      }).replace(/</g, '\\u003c'),
    },
  ],
});
</script>
<template>
  <div class="container detail-page">
    <nav class="breadcrumbs" aria-label="Хлебные крошки">
      <NuxtLink to="/">Главная</NuxtLink><span>/</span
      ><NuxtLink
        :to="
          offer.category === 'game'
            ? '/games/'
            : offer.category === 'ai'
              ? '/ai/'
              : '/software/'
        "
        >{{
          offer.category === 'game'
            ? 'Игры'
            : offer.category === 'ai'
              ? 'Нейросети'
              : 'Программы'
        }}</NuxtLink
      ><span>/</span><span>{{ offer.title }}</span>
    </nav>
    <div class="detail-heading">
      <div>
        <span class="section-kicker">// ПУБЛИКАЦИЯ №{{ offer.messageId }}</span>
        <h1>{{ offer.title }}</h1>
        <div class="detail-tags">
          <span class="status-pill" :class="{ 'status-warn': !current }">{{
            status
          }}</span><span>{{
            offer.platforms.join(' · ') || 'Платформа не указана'
          }}</span
          ><span>{{ dateRu(offer.publishedAt) }}</span>
        </div>
      </div>
      <button class="copy-button" type="button" @click="copyLink">
        {{ copied ? 'Скопировано ✓' : 'Копировать ссылку ⧉' }}
      </button>
    </div>
    <div class="detail-grid">
      <div>
        <img
          class="detail-cover"
          :src="offer.cover"
          :alt="`Фирменная обложка: ${offer.title}`"
          width="1200"
          height="675"
        />
        <section class="detail-section">
          <span class="section-kicker">// О НАХОДКЕ</span>
          <h2>Что это за предложение</h2>
          <p>{{ offer.description }}</p>
        </section>
        <section class="detail-section">
          <span class="section-kicker">// КАК ПОЛУЧИТЬ</span>
          <h2>Условия получения</h2>
          <p>
            {{
              offer.conditions ||
              'Перейдите на страницу источника и проверьте актуальные условия получения. Условия могут зависеть от региона и аккаунта.'
            }}
          </p>
          <p v-if="!offer.region">
            Доступность в России не подтверждена. Проверьте региональные
            ограничения на странице источника.
          </p>
          <p v-else>Регион: {{ offer.region }}</p>
        </section>
      </div>
      <aside class="detail-aside">
        <div class="info-panel">
          <div class="panel-head">
            <span>OFFER_INFO.EXE</span><span>●</span>
          </div>
          <dl>
            <div>
              <dt>СТАТУС</dt>
              <dd>{{ status }}</dd>
            </div>
            <div>
              <dt>СЕЙЧАС</dt>
              <dd class="green-text">
                {{
                  offer.currentPrice === '0' ? 'Бесплатно' : offer.currentPrice
                }}
              </dd>
            </div>
            <div v-if="offer.originalPrice">
              <dt>ОБЫЧНАЯ ЦЕНА</dt>
              <dd>{{ offer.originalPrice }}</dd>
            </div>
            <div>
              <dt>ПЛАТФОРМА</dt>
              <dd>{{ offer.platforms.join(', ') || 'Не указана' }}</dd>
            </div>
            <div>
              <dt>ОКОНЧАНИЕ</dt>
              <dd>{{ offer.endsAt ? dateRu(offer.endsAt) : 'Не указано' }}</dd>
            </div>
            <div>
              <dt>ИСТОЧНИК</dt>
              <dd>{{ offer.source }}</dd>
            </div>
            <div v-if="offer.lastCheckedAt">
              <dt>ПОСЛЕДНЯЯ ПРОВЕРКА</dt>
              <dd>{{ dateRu(offer.lastCheckedAt) }}</dd>
            </div>
          </dl>
          <a
            v-if="current"
            class="button-primary claim-button"
            :href="offer.officialUrl || offer.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            >{{
              offer.offerType === 'open_source'
                ? 'Открыть проект'
                : offer.officialUrl
                  ? 'Забрать бесплатно'
                  : 'Посмотреть условия'
            }}
            ↗</a
          >
          <p v-else class="claim-ended">
            Раздача завершена. Ссылка на источник сохранена для справки.
          </p>
          <a
            class="source-link"
            :href="offer.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            >Источник информации ↗</a
          ><a
            class="source-link"
            :href="offer.telegramUrl"
            target="_blank"
            rel="noopener noreferrer"
            >Пост в Telegram ↗</a
          >
        </div>
        <p class="aside-note">
          Информация сохранена в момент публикации. Перед получением проверьте
          условия у источника.
        </p>
      </aside>
    </div>
    <section v-if="related.length" class="related-section">
      <div class="section-heading">
        <div>
          <span class="section-kicker">// РЯДОМ ПО ТЕМЕ</span>
          <h2>Похожие находки</h2>
        </div>
      </div>
      <div class="offer-grid">
        <OfferCard v-for="item in related" :key="item.slug" :offer="item" />
      </div>
    </section>
  </div>
</template>
