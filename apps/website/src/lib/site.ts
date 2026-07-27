// Locale + site constants shared by app code, the build-free scripts (tsx, no
// compile) and vite.config.ts. Stays dependency-free on purpose: importing
// route-meta.ts instead drags in the Paraglide runtime the scripts and Vite
// config don't have — the coupling that crashed the purge job.

/** Production origin, no trailing slash. */
export const SITE_ORIGIN = "https://corne.rs";

/** Indexable routes (de-localized). /curves-test is excluded — no SEO meta, it
 *  canonicalises to home. Source for route-meta and the sitemap. */
export const INDEXABLE_ROUTES = ["/", "/what", "/playground"] as const;
export type IndexableRoute = (typeof INDEXABLE_ROUTES)[number];

/** URL segment per locale. Defaults to the lowercased tag; the overrides give
 *  multi-part tags clean lowercase URLs (/pt-br/) while hreflang keeps BCP-47 casing. */
export const URL_SEGMENT: Record<string, string> = {
  "pt-BR": "pt-br",
  "zh-Hans": "zh-hans",
  "zh-Hant": "zh-hant",
};

export const segment = (locale: string): string =>
  URL_SEGMENT[locale] ?? locale.toLowerCase();
