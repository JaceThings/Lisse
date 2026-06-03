// Site + locale-routing constants shared by three kinds of consumer:
//   - app code (src/**, e.g. route-meta.ts),
//   - build-free scripts (scripts/*.ts, run via `tsx` with no install/compile),
//   - the Vite config (vite.config.ts).
//
// MUST stay dependency-free — no Paraglide runtime, no framework, no imports.
// route-meta.ts pulls in Paraglide's generated runtime, so the scripts and the
// Vite config can't import from it (that coupling is what crashed the Cloudflare
// purge job). This leaf module is the single source those copies stood in for.

/** Canonical production origin. No trailing slash. */
export const SITE_ORIGIN = "https://corne.rs";

/** Canonical, indexable routes as de-localized paths. Internal/unlisted pages
 *  (/math, /curves-test) are intentionally excluded — they carry no SEO meta
 *  and canonicalise to the localized home. Drives both the per-route SEO head
 *  (route-meta.ts) and the sitemap (scripts/build-sitemap.ts). */
export const INDEXABLE_ROUTES = ["/", "/what", "/playground"] as const;
export type IndexableRoute = (typeof INDEXABLE_ROUTES)[number];

/** URL path segment per locale. Default = the lowercased BCP-47 tag; the
 *  explicit overrides give multi-part tags clean, conventional lowercase URLs
 *  (/pt-br/, /zh-hans/) while the message catalog and hreflang keep the proper
 *  BCP-47 casing. */
export const URL_SEGMENT: Record<string, string> = {
  "pt-BR": "pt-br",
  "zh-Hans": "zh-hans",
  "zh-Hant": "zh-hant",
};

export const segment = (locale: string): string =>
  URL_SEGMENT[locale] ?? locale.toLowerCase();
