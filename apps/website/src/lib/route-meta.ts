// Per-route SEO metadata shared between the runtime SPA and the
// post-build prerender script (scripts/prerender-routes.ts). Keep this
// file framework-free so the build script can import it without
// pulling in React.

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

export type CanonicalPath = keyof typeof ROUTE_META;

export const CANONICAL_PATHS: ReadonlySet<string> = new Set(
  Object.keys(ROUTE_META),
);

export const SITE_ORIGIN = "https://corne.rs";
