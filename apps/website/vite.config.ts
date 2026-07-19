import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { segment } from "./src/lib/site.ts";

// Locale routing config is DERIVED from project.inlang/settings.json so that
// adding a language is a one-line edit there (the compiled Paraglide runtime,
// the URL patterns below, the <html lang>, hreflang alternates, the language
// switcher, and the sitemap all read back from that single source of truth).
const inlang = JSON.parse(
  readFileSync(new URL("./project.inlang/settings.json", import.meta.url), "utf8"),
) as { baseLocale: string; locales: string[] };

// The base locale (English) stays at the bare path with NO prefix; every other
// locale gets an additive `/<segment>/` prefix. The base catch-all MUST be last
// so prefixed locales match first.
const localeUrlPatterns = [
  {
    pattern: "/:path(.*)?",
    localized: [
      ...inlang.locales
        .filter((locale) => locale !== inlang.baseLocale)
        .map(
          (locale) =>
            [locale, `/${segment(locale)}/:path(.*)?`] as [string, string],
        ),
      [inlang.baseLocale, "/:path(.*)?"] as [string, string],
    ],
  },
];

// TanStack Start (SSR) replaces the old static Vite SPA build. The Start
// plugin owns the client + server entries, generates src/routeTree.gen.ts
// from src/routes/*, and emits a self-contained Node server we run directly
// (no nginx, no prerender, no static-asset dance).
export default defineConfig({
  server: {
    port: 5173,
    host: true,
    // Preserved verbatim — dev tunnels (cloudflared/ngrok) rely on these.
    allowedHosts: [".trycloudflare.com", ".ngrok.io", ".ngrok-free.app"],
  },
  plugins: [
    // Paraglide BEFORE Start: it compiles project.inlang -> src/paraglide on
    // build/dev start, so the generated runtime/messages exist before Start
    // transforms the graph. URL-first strategy keeps the locale in the path
    // (distinct Cloudflare cache keys, no Set-Cookie on cacheable HTML).
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      outputStructure: "message-modules",
      cookieName: "PARAGLIDE_LOCALE",
      strategy: ["url", "cookie", "preferredLanguage", "baseLocale"],
      urlPatterns: localeUrlPatterns,
    }),
    // Start — it generates the route tree and wires the SSR graph.
    // (Bundles the router plugin internally; do NOT add @tanstack/router-plugin.)
    tanstackStart(),
    // Nitro assembles the SSR handler + static assets + a listening Node
    // server into .output/ (node-server preset auto-detected) — a single
    // self-contained process that binds PORT. This is what replaces nginx.
    //
    // routeRules replace nginx's per-location Cache-Control. Each `headers`
    // rule is middleware that runs `event.res.headers.set()` BEFORE both the
    // static-asset handler and the TanStack Start SSR handler, so it governs
    // hashed assets AND the rendered HTML; the more-specific glob wins on
    // overlap (/assets/** and /version.json beat /**). Cloudflare needs a
    // Cache Rule marking HTML "Eligible for cache" with Edge TTL "respect
    // origin" for the edge to honour these — it bypasses HTML by default.
    nitro({
      routeRules: {
        // Content-hashed build output — the filename changes when the bytes
        // do, so it's safe to pin forever in every cache.
        "/assets/**": {
          headers: { "cache-control": "public, max-age=31536000, immutable" },
        },
        // Deploy marker the purge workflow polls — must always read true, so
        // no cache anywhere (Nitro serves it from public/ before the $ catch-all).
        "/version.json": {
          headers: { "cache-control": "no-store" },
        },
        // SSR HTML + stable public files (favicons, og-image, *.webm, svg,
        // robots/sitemap/llms). Browsers always revalidate (max-age=0) so a
        // user never pins a stale shell pointing at asset hashes the new
        // container dropped; Cloudflare holds it at the edge for a day and
        // serves every visitor from a PoP; stale-while-revalidate refreshes
        // in the background, so a missed deploy purge self-heals within ~24h
        // instead of stranding. The deploy purge (.github/workflows/purge-cf.yml)
        // gives an instant cutover; this TTL is the safety net under it.
        "/**": {
          headers: {
            "cache-control":
              "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
          },
        },
      },
    }),
    tailwindcss(),
    // React LAST — must come after tanstackStart().
    viteReact(),
  ],
});
