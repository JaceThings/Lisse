// Per-route SEO metadata, consumed by the per-route head() functions in
// src/routes/*. Keep this file framework-free (no React import).

export type RouteMeta = {
  title: string;
  description: string;
};

export const ROUTE_META = {
  "/": {
    title: "lisse",
    description:
      "Squircle corners for the web. Bindings for React, Vue, and Svelte.",
  },
  "/what": {
    title: "what is a squircle — lisse",
    description:
      "Why squircles look softer than CSS border-radius, and how Lisse draws them.",
  },
  "/playground": {
    title: "playground — lisse",
    description:
      "Tune radius, smoothing, curve type, borders, and shadows in your browser.",
  },
} as const satisfies Record<string, RouteMeta>;

export const SITE_ORIGIN = "https://corne.rs";

// Per-route SEO head. Listed paths (keys of ROUTE_META) override the root
// title/description/og/twitter (TanStack dedupes meta by name/property, deepest
// match wins) and self-canonicalise. Unlisted internal paths (math, curves-test)
// pass no meta — they inherit the root default title — and canonicalise to "/",
// matching the old SPA fallback. EXACTLY ONE <link rel=canonical> ships either
// way: links are NOT deduped by rel, so the root deliberately ships none and
// each route owns its single one. `${SITE_ORIGIN}${path}` reproduces the exact
// verified strings: "/" -> https://corne.rs/ , "/what" -> https://corne.rs/what .
export function routeHead(path: string) {
  const meta = (ROUTE_META as Record<string, RouteMeta>)[path];
  const url = meta ? `${SITE_ORIGIN}${path}` : `${SITE_ORIGIN}/`;
  return {
    ...(meta && {
      meta: [
        { title: meta.title },
        { name: "description", content: meta.description },
        { property: "og:title", content: meta.title },
        { property: "og:description", content: meta.description },
        { property: "og:url", content: url },
        { name: "twitter:title", content: meta.title },
        { name: "twitter:description", content: meta.description },
      ],
    }),
    links: [{ rel: "canonical", href: url }],
  };
}
