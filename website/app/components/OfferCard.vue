<script setup lang="ts">
import type { PublicOffer } from '../types/catalog';
import { dateRu, isPermanent, statusOf } from '../utils/catalog';
const { offer } = defineProps<{ offer: PublicOffer }>();
const status = computed(() => statusOf(offer));
</script>
<template>
  <article
    class="offer-card"
    :class="{
      'is-permanent': isPermanent(offer),
      'is-ended': status === 'Раздача завершена',
    }"
  >
    <NuxtLink
      class="card-image"
      :to="`/post/${offer.slug}/`"
      :aria-label="`Подробнее: ${offer.title}`"
      ><img
        :src="offer.cover"
        :alt="`Фирменная обложка: ${offer.title}`"
        loading="lazy"
        width="1200"
        height="675"
    /></NuxtLink>
    <div class="card-body">
      <div class="card-topline">
        <span class="eyebrow">{{
          offer.category === 'game'
            ? 'ИГРА'
            : offer.category === 'ai'
              ? 'НЕЙРОСЕТЬ'
              : 'ПРОГРАММА'
        }}</span><span
          class="status-pill"
          :class="{
            'status-warn':
              status === 'Скоро закончится' || status === 'Раздача завершена',
          }"
          >{{ status }}</span
        >
      </div>
      <h3>
        <NuxtLink :to="`/post/${offer.slug}/`">{{ offer.title }}</NuxtLink>
      </h3>
      <p class="card-summary">{{ offer.summary }}</p>
      <div class="card-meta">
        <span>{{
          offer.platforms.join(' · ') || 'Платформа не указана'
        }}</span><span>{{
          offer.endsAt ? `до ${dateRu(offer.endsAt)}` : 'Без указанного срока'
        }}</span>
      </div>
      <div class="card-bottom">
        <strong>{{
          offer.currentPrice === '0' ? 'БЕСПЛАТНО' : offer.currentPrice
        }}</strong><NuxtLink
          :to="`/post/${offer.slug}/`"
          aria-label="Открыть страницу предложения"
          >Подробнее <span aria-hidden="true">↗</span></NuxtLink
        >
      </div>
    </div>
  </article>
</template>
