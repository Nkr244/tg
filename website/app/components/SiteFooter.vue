<script setup lang="ts">
const catalog = useCatalog();
const has = (category: string) =>
  catalog.some((item) => item.category === category);
</script>
<template>
  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <NuxtLink class="brand footer-brand" to="/"
          ><span class="brand-icon" aria-hidden="true">&gt;_</span
          ><span
            >Халява<span class="brand-green">.exe</span
            ><small>ЗАПУСТИ ХАЛЯВУ</small></span
          ></NuxtLink
        >
        <p>
          Цифровые находки из подтверждённых публикаций канала. Проверяйте
          условия на странице источника.
        </p>
      </div>
      <nav aria-label="Навигация в подвале">
        <strong>РАЗДЕЛЫ</strong
        ><NuxtLink v-if="has('game')" to="/games/">Игры</NuxtLink
        ><NuxtLink v-if="has('software')" to="/software/">Программы</NuxtLink
        ><NuxtLink v-if="has('ai')" to="/ai/">Нейросети</NuxtLink
        ><NuxtLink to="/about/">О проекте</NuxtLink>
      </nav>
      <div>
        <strong>НА СВЯЗИ</strong
        ><a
          href="https://t.me/halyava_exe_hub"
          target="_blank"
          rel="noopener noreferrer"
          >Telegram ↗</a
        ><a
          href="https://www.youtube.com/@halyava_exe_hub"
          target="_blank"
          rel="noopener noreferrer"
          >YouTube ↗</a
        >
      </div>
    </div>
    <div class="container footer-bottom">
      <span>© {{ new Date().getFullYear() }} Халява.exe</span
      ><span
        >Предложения могут измениться. Условия определяет официальный
        источник.</span
      >
    </div>
  </footer>
</template>
