import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
} from "framer-motion";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { FocusRingOverlay } from "./components/FocusRingOverlay.tsx";
import { Header } from "./components/Header.tsx";
import { Layout } from "./components/Layout.tsx";
import { SelectionHighlight } from "./components/SelectionHighlight.tsx";
import { Stagger } from "./components/Stagger.tsx";
import { Footer } from "./components/playground/Footer.tsx";
import { CANONICAL_PATHS, ROUTE_META, SITE_ORIGIN } from "./lib/route-meta.ts";
import { CurvesTest } from "./pages/CurvesTest.tsx";
import { Home } from "./pages/Home.tsx";
import { MathPage } from "./pages/Math.tsx";
import { Playground } from "./pages/Playground.tsx";
import { What } from "./pages/What.tsx";

// Routes are eager: lazy + Suspense creates a suspend/resume cycle
// that collapses the footer mid-transition.

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

// Three-stage transition: body fades out → footer slides to its new Y
// while body stays at opacity 0 → new body fades in. Body's invisible
// during the footer slide so footer never overlaps body content, and
// the body container's height changes instantly (no height animation,
// no clipping/mask artifacts) — only the footer's translateY animates.
const FADE_MS = 250;
const FOOTER_SLIDE_MS = 350;
const EASE = [0.4, 0, 0.2, 1] as const;

// Per-route SEO metadata lives in src/lib/route-meta.ts so the post-build
// prerender script can read the same source. `/math` is intentionally
// omitted from CANONICAL_PATHS — the page is unlisted.
function setMeta(selector: string, attr: string, value: string) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

function RouteHeadUpdater() {
  const location = useLocation();
  useEffect(() => {
    const path = (
      CANONICAL_PATHS.has(location.pathname) ? location.pathname : "/"
    ) as keyof typeof ROUTE_META;
    const meta = ROUTE_META[path];
    const url = `${SITE_ORIGIN}${path}`;

    document.title = meta.title;
    setMeta('link[rel="canonical"]', "href", url);
    setMeta('meta[name="description"]', "content", meta.description);
    setMeta('meta[property="og:title"]', "content", meta.title);
    setMeta('meta[property="og:description"]', "content", meta.description);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[name="twitter:title"]', "content", meta.title);
    setMeta('meta[name="twitter:description"]', "content", meta.description);
  }, [location.pathname]);
  return null;
}

function AnimatedBody() {
  const location = useLocation();
  // First app mount has no preceding footer to slide; subsequent route
  // changes delay the body fade-in by the slide duration so the new body
  // only starts becoming visible after the footer has settled.
  const isFirstMount = useRef(true);
  useEffect(() => {
    isFirstMount.current = false;
  }, []);
  const enterDelay = isFirstMount.current ? 0 : FOOTER_SLIDE_MS / 1000;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        className="w-full"
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          transition: {
            duration: FADE_MS / 1000,
            ease: EASE,
            delay: enterDelay,
          },
        }}
        exit={{
          opacity: 0,
          transition: { duration: FADE_MS / 1000, ease: EASE },
        }}
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/math" element={<MathPage />} />
          <Route path="/curves-test" element={<CurvesTest />} />
          <Route path="/what" element={<What />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

// LayoutGroup is required: without it framer-motion never sees that a
// sibling's size changed and the footer's translateY never animates.
function PersistentFooter() {
  return (
    <motion.footer
      layout="position"
      transition={{
        layout: { duration: FOOTER_SLIDE_MS / 1000, ease: EASE },
      }}
      className="w-full"
    >
      <Stagger index={14}>
        <Footer />
      </Stagger>
    </motion.footer>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <LayoutGroup>
          <Layout>
            <Header staggerFrom={0} />
            <AnimatedBody />
            <PersistentFooter />
          </Layout>
        </LayoutGroup>
        <RouteHeadUpdater />
        <FocusRingOverlay />
        <SelectionHighlight />
        <DevAgentation />
      </MotionConfig>
    </BrowserRouter>
  );
}
