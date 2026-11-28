<script setup lang="ts">
defineProps<{ error: { statusCode?: number; statusMessage?: string } }>();
const config = useRuntimeConfig();
useSeoMeta({
  title: 'Страница не найдена | Халява.exe',
  robots: config.public.indexable ? 'noindex,follow' : 'noindex,nofollow',
});
</script>
<template>
  <div class="error-page container">
    <span class="section-kicker"
      >&gt;_ ERROR / {{ error.statusCode || 404 }}</span
    >
    <h1>Похоже, здесь пусто.</h1>
    <p>Страница не найдена или адрес изменился.</p>
    <NuxtLink class="button-primary" to="/">Вернуться на главную ↗</NuxtLink>
  </div>
</template>
