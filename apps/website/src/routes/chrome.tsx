import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SITE_ORIGIN } from "../lib/site.ts";

// Pretty link -> Chrome Web Store. We don't server-redirect (a 3xx would rob
// link-preview scrapers of the OG card), so head() carries the OG image and the
// component bounces real browsers client-side.
const STORE_URL =
  "https://chromewebstore.google.com/detail/lisse/binhcjkcgbcajedgdholefkhlklcdbdd";
const TITLE = "Lisse for Chrome";
const DESCRIPTION = "Smooth every corner on the web. Add Lisse to Chrome.";
const OG_IMAGE = `${SITE_ORIGIN}/og-chrome.png`;

export const Route = createFileRoute("/chrome")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "noindex,follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_ORIGIN}/chrome` },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1280" },
      { property: "og:image:height", content: "800" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:alt", content: TITLE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
  }),
  component: ChromeRedirect,
});

// Rendered via __root's PAGES map (the app uses a pathname->component map, not
// <Outlet/>), so it's exported and registered there.
export function ChromeRedirect() {
  useEffect(() => {
    window.location.replace(STORE_URL);
  }, []);
  return (
    <p style={{ padding: "2rem", textAlign: "center" }}>
      Redirecting to the Chrome Web Store… <a href={STORE_URL}>Continue</a>
    </p>
  );
}
