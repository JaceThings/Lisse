import { SITE_ORIGIN } from "./site.ts";

const STORES = {
  chrome: {
    name: "Chrome",
    store: "the Chrome Web Store",
    url: "https://chromewebstore.google.com/detail/lisse/binhcjkcgbcajedgdholefkhlklcdbdd",
    image: "og-chrome.png",
    width: 1280,
    height: 800,
  },
  firefox: {
    name: "Firefox",
    store: "Firefox Add-ons",
    url: "https://addons.mozilla.org/en-US/firefox/addon/lisse/",
    image: "og-image.png",
    width: 1200,
    height: 630,
  },
} as const;

const tags = (attr: "name" | "property", pairs: Record<string, string | number>) =>
  Object.entries(pairs)
    .map(([key, value]) => `<meta ${attr}="${key}" content="${value}">`)
    .join("");

// The pretty store links (/chrome, /firefox) bypass the app shell entirely: this
// document loads no CSS, fonts or bundle, so location.replace() runs while the
// parser is still in <head> and the site never paints. The <meta refresh> is only
// the no-JS fallback — browsers hold even a 0-second refresh until the document
// finishes loading. A 3xx would be faster still, but would cost the OG card that
// these links exist for. Every value below is a static literal, hence no escaping.
export function storeRedirect(key: keyof typeof STORES): Response {
  const { name, store, url, image, width, height } = STORES[key];
  const title = `Lisse for ${name}`;
  const description = `Smooth every corner on the web. Add Lisse to ${name}.`;
  const og = `${SITE_ORIGIN}/${image}`;

  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<script>location.replace(${JSON.stringify(url)})</script>` +
    `<meta http-equiv="refresh" content="0;url=${url}">` +
    `<title>${title}</title>` +
    tags("name", {
      description,
      viewport: "width=device-width, initial-scale=1.0",
      robots: "noindex,follow",
      "twitter:card": "summary_large_image",
      "twitter:title": title,
      "twitter:description": description,
      "twitter:image": og,
    }) +
    tags("property", {
      "og:type": "website",
      "og:title": title,
      "og:description": description,
      "og:url": `${SITE_ORIGIN}/${key}`,
      "og:image": og,
      "og:image:width": width,
      "og:image:height": height,
      "og:image:type": "image/png",
      "og:image:alt": title,
    }) +
    `</head><body style="font:15px/1.5 system-ui,sans-serif;padding:2rem;text-align:center">` +
    `<p>Redirecting to ${store}… <a href="${url}">Continue</a></p></body></html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
