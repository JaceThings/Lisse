/// <reference types="vite/client" />
import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  HeadContent,
  Scripts,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { getLocale, getTextDirection } from "../paraglide/runtime.js";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
} from "framer-motion";

// Style order is load-bearing.
import "@fontsource-variable/inter/standard.css";
import "@fontsource-variable/inter/standard-italic.css";
// Inter has no CJK glyphs; without these, Japanese/Korean fall back to a thin OS
// font. Subset by unicode-range, so non-CJK pages fetch nothing.
import "@fontsource-variable/noto-sans-jp/wght.css";
import "@fontsource-variable/noto-sans-kr/wght.css";
import "../styles/tokens.css";
import "../styles/global.css";

import { FocusRingOverlay } from "../components/FocusRingOverlay.tsx";
import { Header } from "../components/Header.tsx";
import { Layout } from "../components/Layout.tsx";
import { SelectionHighlight } from "../components/SelectionHighlight.tsx";
import { LanguageToast } from "../components/LanguageToast.tsx";
import { Stagger } from "../components/Stagger.tsx";
import { Footer } from "../components/playground/Footer.tsx";
import { ogLocale } from "../lib/route-meta.ts";
import { SITE_ORIGIN } from "../lib/site.ts";
import { m } from "../paraglide/messages.js";
import { Home } from "../pages/Home.tsx";
import { What } from "../pages/What.tsx";
import { Playground } from "../pages/Playground.tsx";
import { MathPage } from "../pages/Math.tsx";
import { CurvesTest } from "../pages/CurvesTest.tsx";
import { ChromeRedirect } from "./chrome.tsx";
import { FirefoxRedirect } from "./firefox.tsx";

const FADE_MS = 250;
const FOOTER_SLIDE_MS = 350;
const EASE = [0.4, 0, 0.2, 1] as const;

export const Route = createRootRoute({
  // Site-wide default meta = the home route's localized title/description.
  // Per-route head() overrides title/description/og/canonical for deeper
  // matches; these remain for unlisted internal pages. Built per-request so the
  // m.* messages + getLocale() resolve the URL's locale under concurrent SSR.
  head: () => ({
    meta: [
      { charSet: "UTF-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: m.meta_home_title() },
      { name: "description", content: m.meta_home_description() },
      { name: "theme-color", content: "#f7f6f2" },
      { name: "robots", content: "index,follow" },

      { property: "og:type", content: "website" },
      { property: "og:locale", content: ogLocale(getLocale()) },
      { property: "og:title", content: m.meta_home_title() },
      { property: "og:description", content: m.meta_home_description() },
      { property: "og:url", content: `${SITE_ORIGIN}/` },
      { property: "og:image", content: `${SITE_ORIGIN}/og-image.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:alt", content: "lisse" },

      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: m.meta_home_title() },
      { name: "twitter:description", content: m.meta_home_description() },
      { name: "twitter:image", content: `${SITE_ORIGIN}/og-image.png` },

      // Structured data — index.html's @graph split into two equivalent
      // ld+json descriptors (plain objects; HeadContent serialises them).
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Lisse",
          alternateName: "@lisse/core",
          description: m.meta_app_description(),
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Cross-platform (browser, Node, edge runtimes)",
          url: "https://corne.rs/",
          downloadUrl: "https://www.npmjs.com/package/@lisse/core",
          license: "https://opensource.org/licenses/MIT",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          author: {
            "@type": "Person",
            name: "Jace Attard",
            url: "https://github.com/JaceThings",
          },
        },
      },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "SoftwareSourceCode",
          name: "Lisse",
          codeRepository: "https://github.com/JaceThings/Lisse",
          programmingLanguage: "TypeScript",
          license: "https://opensource.org/licenses/MIT",
          url: "https://github.com/JaceThings/Lisse",
          author: {
            "@type": "Person",
            name: "Jace Attard",
            url: "https://github.com/JaceThings",
          },
        },
      },
    ],
    links: [
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      // No canonical here: TanStack dedupes meta by name/property but NOT links by
      // rel, so a root canonical would double up with each route's own one.
    ],
    scripts: [
      {
        // data-platform=mac sniffer (from index.html). Runs pre-hydration,
        // only sets an <html> attribute, never branches React render.
        children:
          'if(/Macintosh/.test(navigator.userAgent)){document.documentElement.setAttribute("data-platform","mac");}',
      },
    ],
  }),
  component: RootComponent,
});

// Dev-only agentation toolbar.
function DevAgentation() {
  const [Toolbar, setToolbar] = useState<ComponentType | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    import("agentation")
      .then((m) => setToolbar(() => m.PageFeedbackToolbarCSS))
      .catch(() => {});
  }, []);
  return Toolbar ? <Toolbar /> : null;
}

// Body renders via an explicit pathname -> component map, NOT <Outlet/>.
// <Outlet/> subscribes to a LIVE router store, so AnimatePresence's exiting
// element would re-render to the DESTINATION route and the old page would
// never fade out. A distinct plain per-pathname element freezes the exiting
// page. New animated routes must be added here. ($.tsx redirects unknowns.)
const PAGES: Record<string, ComponentType> = {
  "/": Home,
  "/what": What,
  "/playground": Playground,
  "/math": MathPage,
  "/chrome": ChromeRedirect,
  "/firefox": FirefoxRedirect,
  // Dev-only harness; the route redirects to home in production.
  ...(import.meta.env.DEV ? { "/curves-test": CurvesTest } : {}),
};

// Route-keyed body cross-fade. First mount has no preceding footer to slide,
// so its enter is undelayed; later navs delay the body fade-in by the footer
// slide so the new body appears only after the footer settles.
function AnimatedBody() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isFirstMount = useRef(true);
  useEffect(() => {
    isFirstMount.current = false;
  }, []);
  const enterDelay = isFirstMount.current ? 0 : FOOTER_SLIDE_MS / 1000;
  const Page = PAGES[pathname] ?? Home;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        className="w-full"
        // First mount paints at opacity:1 so SSR content is visible pre-hydration;
        // only client navs fade in.
        initial={isFirstMount.current ? false : { opacity: 0 }}
        animate={{
          opacity: 1,
          transition: { duration: FADE_MS / 1000, ease: EASE, delay: enterDelay },
        }}
        exit={{ opacity: 0, transition: { duration: FADE_MS / 1000, ease: EASE } }}
      >
        <Page />
      </motion.div>
    </AnimatePresence>
  );
}

// Footer slides on route height change. The ancestor <LayoutGroup> is required
// -- without it framer-motion never sees the sibling's size change and the
// footer's translateY never animates.
function PersistentFooter() {
  return (
    <motion.footer
      layout="position"
      transition={{ layout: { duration: FOOTER_SLIDE_MS / 1000, ease: EASE } }}
      className="w-full"
    >
      <Stagger index={14}>
        <Footer />
      </Stagger>
    </motion.footer>
  );
}

function RootComponent() {
  // Locale resolved per-request from the URL (server: via paraglideMiddleware +
  // AsyncLocalStorage; client: from the path). dir is derived so RTL locales,
  // if added later, flip automatically. Both are "en"/"ltr" until other locales
  // are registered in project.inlang/settings.json.
  const locale = getLocale();
  return (
    <html lang={locale} dir={getTextDirection(locale)}>
      <head>
        <HeadContent />
      </head>
      <body>
        <MotionConfig reducedMotion="user">
          <LayoutGroup>
            <Layout>
              <Header staggerFrom={0} />
              <AnimatedBody />
              <PersistentFooter />
            </Layout>
          </LayoutGroup>
          <FocusRingOverlay />
          <SelectionHighlight />
          <LanguageToast />
          <DevAgentation />
        </MotionConfig>
        <Scripts />
      </body>
    </html>
  );
}
