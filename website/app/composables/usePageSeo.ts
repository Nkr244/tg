export function usePageSeo(
  title: string,
  description: string,
  path: string,
  image?: string,
  hasContent = true,
) {
  const config = useRuntimeConfig();
  const base = String(config.public.siteUrl).replace(/\/$/, '');
  const canonical = `${base}${path}`;
  useHead({ link: [{ rel: 'canonical', href: canonical }] });
  useSeoMeta({
    title,
    description,
    robots:
      config.public.indexable && hasContent
        ? 'index,follow'
        : 'noindex,nofollow',
    ogType: 'website',
    ogTitle: title,
    ogDescription: description,
    ogUrl: canonical,
    ogImage: image ? `${base}${image}` : undefined,
    twitterCard: 'summary_large_image',
  });
}
