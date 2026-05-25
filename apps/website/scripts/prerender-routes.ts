// Post-build prerender. Reads the Vite-built `dist/index.html` template,
// rewrites the per-route meta tags (title, description, OG, Twitter,
// canonical) for each canonical route, and writes the variant to
// `dist/<route>.html`. nginx's `try_files $uri $uri.html ...` then serves
// the right file when the URL is hit directly — so social unfurls and
// non-JS crawlers see route-specific cards instead of the home card on
// every page.
//
// The runtime SPA still updates the same tags via RouteHeadUpdater after
// hydration, which keeps client-side route transitions correct.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_PATHS,
  ROUTE_META,
  SITE_ORIGIN,
  type RouteMeta,
} from "../src/lib/route-meta.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "..", "dist");

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const setAttr = (
  html: string,
  selectorPattern: RegExp,
  attr: string,
  value: string,
): string =>
  html.replace(selectorPattern, (match) => {
    const re = new RegExp(`${attr}="[^"]*"`);
    return re.test(match)
      ? match.replace(re, `${attr}="${escapeHtml(value)}"`)
      : match.replace(/\/?>$/, ` ${attr}="${escapeHtml(value)}"$&`);
  });

const rewrite = (html: string, path: string, meta: RouteMeta): string => {
  const url = `${SITE_ORIGIN}${path}`;
  let out = html;

  out = out.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(meta.title)}</title>`,
  );
  // Some meta tags in index.html span multiple lines, so the matcher
  // accepts any non-`>` chars (including newlines) around the
  // identifying attribute.
  out = setAttr(out, /<meta[^>]*name="description"[^>]*>/, "content", meta.description);
  out = setAttr(out, /<meta[^>]*property="og:title"[^>]*>/, "content", meta.title);
  out = setAttr(out, /<meta[^>]*property="og:description"[^>]*>/, "content", meta.description);
  out = setAttr(out, /<meta[^>]*property="og:url"[^>]*>/, "content", url);
  out = setAttr(out, /<meta[^>]*name="twitter:title"[^>]*>/, "content", meta.title);
  out = setAttr(out, /<meta[^>]*name="twitter:description"[^>]*>/, "content", meta.description);
  out = setAttr(out, /<link[^>]*rel="canonical"[^>]*>/, "href", url);

  return out;
};

async function main() {
  const indexPath = join(DIST, "index.html");
  const template = await readFile(indexPath, "utf8");

  for (const path of CANONICAL_PATHS) {
    const meta = ROUTE_META[path as keyof typeof ROUTE_META];
    const out = rewrite(template, path, meta);
    // "/" stays as dist/index.html; non-root canonical routes are written
    // as flat .html files matched by nginx's `try_files $uri.html`.
    const file = path === "/" ? indexPath : join(DIST, `${path.slice(1)}.html`);
    await writeFile(file, out, "utf8");
    console.log(`prerendered ${path} -> ${file.replace(DIST, "dist")}`);
  }
}

await main();
