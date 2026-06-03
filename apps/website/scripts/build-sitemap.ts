// Generate public/sitemap.xml from the live locale list in project.inlang.
// English (baseLocale) stays at the bare path; other locales get a /<segment>/
// prefix, matching vite.config.ts `localeUrlPatterns` and the router rewrite.
//
// With a single locale the output is a plain <loc> list — byte-identical to the
// pre-i18n sitemap, so this is behaviour-neutral until languages are added.
// With more than one locale, each page emits one <url> per locale carrying the
// full xhtml:link alternate set (every locale + x-default), the sitemap form of
// hreflang. Adding a locale to project.inlang/settings.json expands this
// automatically — no hand-edited XML.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { INDEXABLE_ROUTES, SITE_ORIGIN, segment } from "../src/lib/site.ts";

const settings = JSON.parse(
  readFileSync(
    new URL("../project.inlang/settings.json", import.meta.url),
    "utf8",
  ),
) as { baseLocale: string; locales: string[] };
const { baseLocale, locales } = settings;

// Absolute, locale-prefixed URL for a route. Home keeps its trailing slash.
function url(route: string, locale: string): string {
  const prefix = locale === baseLocale ? "" : `/${segment(locale)}`;
  return route === "/"
    ? `${SITE_ORIGIN}${prefix}/`
    : `${SITE_ORIGIN}${prefix}${route}`;
}

const multi = locales.length > 1;
const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
lines.push(
  multi
    ? '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    : '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
);

for (const route of INDEXABLE_ROUTES) {
  for (const locale of locales) {
    if (!multi) {
      lines.push(`  <url><loc>${url(route, locale)}</loc></url>`);
      continue;
    }
    const alternates = [
      ...locales.map(
        (l) =>
          `    <xhtml:link rel="alternate" hreflang="${l}" href="${url(route, l)}"/>`,
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${url(route, baseLocale)}"/>`,
    ].join("\n");
    lines.push(
      `  <url>\n    <loc>${url(route, locale)}</loc>\n${alternates}\n  </url>`,
    );
  }
}
lines.push("</urlset>");

const file = fileURLToPath(new URL("../public/sitemap.xml", import.meta.url));
writeFileSync(file, lines.join("\n") + "\n", "utf8");
console.log(
  `wrote public/sitemap.xml -> ${INDEXABLE_ROUTES.length} route(s) × ${locales.length} locale(s)`,
);
