<script setup lang="ts">
import { isCurrent, isPermanent } from '../utils/catalog';
const catalog = useCatalog();
const current = computed(() => catalog.filter((item) => isCurrent(item)));
const permanent = computed(() => catalog.filter(isPermanent));
const ending = computed(() =>
  current.value
    .filter((item) => item.endsAt)
    .sort((a, b) => a.endsAt!.localeCompare(b.endsAt!))
    .slice(0, 3),
);
usePageSeo(
  'Халява.exe — бесплатные игры, программы и цифровые находки',
  'Подтверждённые публикации о бесплатных играх, программах и нейросетях. Ссылки на источники и условия получения.',
  '/',
  catalog[0]?.cover,
);
</script>
<template>
  <div>
    <section class="hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <div class="hero-status">
            <span class="pulse-dot" /> СИСТЕМА ОНЛАЙН
            <span class="status-divider">/</span> НАХОДИМ БЕСПЛАТНОЕ
          </div>
          <p class="hero-kicker">&gt;_ DIGITAL FREEBIES INDEX</p>
          <h1>
            Зачем платить,<br />если можно <span>забрать бесплатно?</span>
          </h1>
          <p class="hero-subtitle">
            Бесплатные игры, программы, нейросети и цифровые находки в одном
            месте.
          </p>
          <div class="hero-buttons">
            <a class="button-primary" href="#catalog"
              >Смотреть раздачи <span aria-hidden="true">↗</span></a
            ><a
              class="button-ghost"
              href="https://t.me/halyava_exe_hub"
              target="_blank"
              rel="noopener noreferrer"
              >Мы в Telegram <span aria-hidden="true">↗</span></a
            >
          </div>
          <div class="hero-statline">
            <div>
              <strong>{{
                catalog.length.toString().padStart(2, '0')
              }}</strong><span>ПУБЛИКАЦИИ</span>
            </div>
            <div>
              <strong>{{
                current.length.toString().padStart(2, '0')
              }}</strong><span>АКТУАЛЬНЫЕ</span>
            </div>
            <div><strong>0 ₽</strong><span>СТОИМОСТЬ ДОСТУПА</span></div>
          </div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="visual-top">
            <span>HALYAVA.EXE / FEED</span><span>● ● ●</span>
          </div>
          <div class="visual-screen">
            <span class="visual-prompt">C:\HALYAVA&gt;</span>
            <div class="visual-command">
              scan --free --verified<span class="cursor">_</span>
            </div>
            <div class="visual-line">[✓] Telegram: подключен</div>
            <div class="visual-line">[✓] Источники: проверены</div>
            <div class="visual-line">[✓] Каталог: обновлён</div>
            <div class="visual-box">
              <span>НАЙДЕНО СЕЙЧАС</span
              ><strong>{{ current.length.toString().padStart(2, '0') }}</strong
              ><small>АКТУАЛЬНЫХ ПРЕДЛОЖЕНИЙ</small>
            </div>
          </div>
          <div class="visual-bottom">ХАЛЯВА НАЙДЕНА. ЗАПУСКАЙ.</div>
        </div>
      </div>
    </section>
    <div class="ticker">
      <div class="container">
        <span>● БЕСПЛАТНЫЕ ИГРЫ</span><span>✦ ПРОВЕРЕННЫЕ ИСТОЧНИКИ</span
        ><span>● ПОЛЕЗНЫЕ ПРОГРАММЫ</span><span>✦ ЦИФРОВЫЕ НАХОДКИ</span>
      </div>
    </div>
    <section class="container categories-section">
      <div class="section-heading">
        <div>
          <span class="section-kicker">// НАПРАВЛЕНИЯ</span>
          <h2>Выбери, что искать</h2>
        </div>
      </div>
      <div class="category-grid">
        <NuxtLink
          v-if="catalog.some((item) => item.category === 'game')"
          to="/games/"
          class="category-tile"
          ><span class="tile-icon">⌘</span
          ><span
            ><strong>Игры</strong
            ><small>Раздачи и бесплатный доступ</small></span
          ><span class="tile-arrow">↗</span></NuxtLink
        ><NuxtLink
          v-if="catalog.some((item) => item.category === 'software')"
          to="/software/"
          class="category-tile"
          ><span class="tile-icon">▣</span
          ><span
            ><strong>Программы</strong
            ><small>Полезный софт и лицензии</small></span
          ><span class="tile-arrow">↗</span></NuxtLink
        ><NuxtLink
          v-if="catalog.some((item) => item.category === 'ai')"
          to="/ai/"
          class="category-tile"
          ><span class="tile-icon">✳</span
          ><span
            ><strong>Нейросети</strong
            ><small>AI-инструменты и тарифы</small></span
          ><span class="tile-arrow">↗</span></NuxtLink
        >
      </div>
    </section>
    <CatalogBrowser :items="catalog" heading="Последние находки" />
    <section v-if="ending.length" class="container feature-section">
      <div class="section-heading">
        <div>
          <span class="section-kicker">// НЕ УПУСТИ</span>
          <h2>Скоро заканчиваются</h2>
        </div>
        <NuxtLink to="/games/">Все игры ↗</NuxtLink>
      </div>
      <div class="offer-grid">
        <OfferCard v-for="item in ending" :key="item.slug" :offer="item" />
      </div>
    </section>
    <section v-if="permanent.length" class="container feature-section">
      <div class="section-heading">
        <div>
          <span class="section-kicker">// БЕЗ ТАЙМЕРА</span>
          <h2>Бесплатно постоянно</h2>
        </div>
      </div>
      <div class="offer-grid">
        <OfferCard
          v-for="item in permanent.slice(0, 3)"
          :key="item.slug"
          :offer="item"
        />
      </div>
    </section>
    <section class="container subscribe-section">
      <div>
        <span class="section-kicker">// ОСТАВАЙСЯ В КУРСЕ</span>
        <h2>Халява появляется внезапно.<br /><span>Узнавай первым.</span></h2>
        <p>Новые находки и ссылки на источники — в нашем Telegram-канале.</p>
      </div>
      <a
        class="button-primary"
        href="https://t.me/halyava_exe_hub"
        target="_blank"
        rel="noopener noreferrer"
        >Подписаться в Telegram ↗</a
      >
    </section>
  </div>
</template>
