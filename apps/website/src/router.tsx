import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { deLocalizeUrl, localizeUrl } from "./paraglide/runtime";

// Start auto-discovers this file (src/router.tsx exporting `getRouter`) and
// uses it for both the client and server. The ./routeTree.gen import will not
// resolve — and tsc will error — until the first `vite dev`/`vite build`
// generates src/routeTree.gen.ts. That's expected.
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    // Locale lives in the URL path. `input` de-localizes incoming URLs
    // (/de/what -> /what) so the un-prefixed route tree matches; `output`
    // re-localizes URLs the router emits (links, redirects, canonical) back to
    // the active locale's prefix. English (baseLocale) has no prefix, so both
    // are no-ops for English. See vite.config.ts `localeUrlPatterns`.
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
