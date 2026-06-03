// Per-route SEO metadata, consumed by the per-route head() functions in
// src/routes/*. Locale-aware: titles/descriptions are Paraglide messages and
// every page emits a localized canonical + a reciprocal hreflang alternate set
// (+ x-default) generated from the live `locales` list, so adding a language in
// project.inlang/settings.json expands the SEO automatically. Keep this file
// framework-free (no React import) — Paraglide's runtime/messages are plain JS.
import {
  baseLocale,
  getLocale,
  localizeUrl,
  locales,
} from "../paraglide/runtime.js";
import { m } from "../paraglide/messages.js";
import { SITE_ORIGIN, type IndexableRoute } from "./site.ts";

// The locale union derived from project.inlang/settings.json (compiled into the
// runtime's `locales` tuple). Widens automatically as languages are registered.
type Loc = (typeof locales)[number];

type RouteMeta = { title: () => string; description: () => string };

// Per-route SEO copy. Keyed by IndexableRoute so this and the sitemap can't
// drift from site.ts — a missing or stray key is a compile error. Unlisted
// paths (/math, /curves-test) get no meta; they canonicalise to home.
const ROUTE_MESSAGES: Record<IndexableRoute, RouteMeta> = {
  "/": {
    title: () => m.meta_home_title(),
    description: () => m.meta_home_description(),
  },
  "/what": {
    title: () => m.meta_what_title(),
    description: () => m.meta_what_description(),
  },
  "/playground": {
    title: () => m.meta_playground_title(),
    description: () => m.meta_playground_description(),
  },
};

// BCP-47 -> Open Graph locale (language_TERRITORY). og:locale uses an
// underscore; hreflang uses the BCP-47 tag as-is. Falls back to the tag with
// "-" swapped for "_" if a locale isn't mapped.
const OG_LOCALE: Record<string, string> = {
  en: "en_US",
  de: "de_DE",
  ja: "ja_JP",
  ko: "ko_KR",
  "pt-BR": "pt_BR",
  ru: "ru_RU",
  "zh-Hans": "zh_CN",
};
export const ogLocale = (locale: string) =>
  OG_LOCALE[locale] ?? locale.replace("-", "_");

// Endonyms — each language's name in its OWN script, shown verbatim in the
// language switcher regardless of the active locale (never translated, never a
// flag). Falls back to the raw tag for an unmapped locale.
const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  de: "Deutsch",
  ja: "日本語",
  ko: "한국어",
  "pt-BR": "Português",
  ru: "Русский",
  "zh-Hans": "简体中文",
};
export const localeName = (locale: string) => LOCALE_NAMES[locale] ?? locale;

// Absolute, locale-prefixed URL for an internal (de-localized) path. Home keeps
// its trailing slash ("/", "/de/"); other paths have none ("/what", "/de/what")
// — matching the router's canonical (redirect) form.
function localizedUrl(path: string, locale: Loc): string {
  const url = localizeUrl(new URL(path, SITE_ORIGIN), { locale });
  let href = url.href;
  if (path === "/" && !href.endsWith("/")) href += "/";
  return href;
}

// Per-route SEO head. TanStack dedupes meta by name/property (deepest match
// wins) but does NOT dedupe links by rel, so the root emits ZERO
// canonical/alternate links and each route owns its single canonical + the
// hreflang set. Reciprocity is generated from one `locales` source so every
// locale variant ships an identical, self-including alternate set.
export function routeHead(path: string) {
  const locale = getLocale();
  const messages = (ROUTE_MESSAGES as Record<string, RouteMeta>)[path];
  const canonical = localizedUrl(messages ? path : "/", locale);

  const links: Array<{ rel: string; href: string; hreflang?: string }> = [
    { rel: "canonical", href: canonical },
  ];

  // hreflang alternates only for listed (self-canonical) pages. x-default points
  // at the base-locale (English, unprefixed) URL.
  if (messages && locales.length > 1) {
    for (const alt of locales) {
      links.push({
        rel: "alternate",
        hreflang: alt,
        href: localizedUrl(path, alt),
      });
    }
    links.push({
      rel: "alternate",
      hreflang: "x-default",
      href: localizedUrl(path, baseLocale),
    });
  }

  const meta = messages
    ? [
        { title: messages.title() },
        { name: "description", content: messages.description() },
        { property: "og:title", content: messages.title() },
        { property: "og:description", content: messages.description() },
        { property: "og:url", content: canonical },
        { name: "twitter:title", content: messages.title() },
        { name: "twitter:description", content: messages.description() },
        // og:locale for the current page only. og:locale:alternate is
        // intentionally omitted: TanStack dedupes meta by `property`, so
        // multiple alternates collapse to one. hreflang alternates (the links
        // above) are the authoritative multilingual signal for search engines.
        { property: "og:locale", content: ogLocale(locale) },
      ]
    : undefined;

  return { ...(meta && { meta }), links };
}
