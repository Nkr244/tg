<script setup lang="ts">
const open = ref(false);
const route = useRoute();
watch(
  () => route.fullPath,
  () => {
    open.value = false;
  },
);
const catalog = useCatalog();
const has = (category: string) =>
  catalog.some((item) => item.category === category);
const hasArchive = computed(() =>
  catalog.some((item) => item.endsAt && new Date(item.endsAt) <= new Date()),
);
</script>
<template>
  <header class="site-header">
    <div class="container header-inner">
      <NuxtLink class="brand" to="/" aria-label="Халява.exe — главная"
        ><span class="brand-icon" aria-hidden="true">&gt;_</span
        ><span
          >Халява<span class="brand-green">.exe</span
          ><small>ЗАПУСТИ ХАЛЯВУ</small></span
        ></NuxtLink
      >
      <button
        class="menu-toggle"
        type="button"
        :aria-expanded="open"
        aria-controls="main-nav"
        aria-label="Открыть меню"
        @click="open = !open"
      >
        {{ open ? '✕' : '☰' }}
      </button>
      <nav
        id="main-nav"
        class="main-nav"
        :class="{ 'is-open': open }"
        aria-label="Основная навигация"
      >
        <NuxtLink v-if="has('game')" to="/games/">Игры</NuxtLink
        ><NuxtLink v-if="has('software')" to="/software/">Программы</NuxtLink
        ><NuxtLink v-if="has('ai')" to="/ai/">Нейросети</NuxtLink
        ><NuxtLink v-if="has('opensource')" to="/opensource/"
          >Open Source</NuxtLink
        ><NuxtLink v-if="hasArchive" to="/archive/">Архив</NuxtLink>
      </nav>
      <div class="header-actions">
        <NuxtLink
          to="/#catalog"
          class="search-link"
          aria-label="Поиск в каталоге"
          >⌕ <span>Поиск</span></NuxtLink
        ><a
          class="telegram-link"
          href="https://t.me/halyava_exe_hub"
          target="_blank"
          rel="noopener noreferrer"
          >Telegram ↗</a
        ><a
          class="youtube-link"
          href="https://www.youtube.com/@halyava_exe_hub"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="YouTube"
          >▶</a
        >
      </div>
    </div>
  </header>
</template>
