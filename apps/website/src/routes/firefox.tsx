import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SITE_ORIGIN } from "../lib/site.ts";

// Pretty link -> Firefox Add-ons. Same client-side bounce as /chrome: a 3xx
// would rob link-preview scrapers of the OG card.
const STORE_URL = "https://addons.mozilla.org/en-US/firefox/addon/lisse/";
const TITLE = "Lisse for Firefox";
const DESCRIPTION = "Smooth every corner on the web. Add Lisse to Firefox.";
const OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;

export const Route = createFileRoute("/firefox")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "noindex,follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_ORIGIN}/firefox` },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:alt", content: TITLE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
  }),
  component: FirefoxRedirect,
});

// Rendered via __root's PAGES map (the app uses a pathname->component map, not
// <Outlet/>), so it's exported and registered there.
export function FirefoxRedirect() {
  useEffect(() => {
    window.location.replace(STORE_URL);
  }, []);
  return (
    <p style={{ padding: "2rem", textAlign: "center" }}>
      Redirecting to Firefox Add-ons… <a href={STORE_URL}>Continue</a>
    </p>
  );
}
