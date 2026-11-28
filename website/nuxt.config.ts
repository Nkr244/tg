import catalog from './app/data/catalog.json';

const categoryRoutes = [
  '/games/',
  '/games/steam/',
  '/games/epic-games/',
  '/games/gog/',
  '/software/',
  '/ai/',
  '/opensource/',
  '/discounts/',
  '/archive/',
  '/about/',
];
export default defineNuxtConfig({
  compatibilityDate: '2026-11-27',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  css: ['~/assets/styles/main.scss'],
  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      indexable: process.env.SITE_INDEXABLE === 'true',
    },
  },
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: [
        '/',
        ...categoryRoutes,
        ...catalog.map((item) => `/post/${item.slug}/`),
      ],
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      meta: [{ name: 'theme-color', content: '#0B0E13' }],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
});
