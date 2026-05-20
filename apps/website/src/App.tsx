import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
} from "framer-motion";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { FocusRingOverlay } from "./components/FocusRingOverlay.tsx";
import { Header } from "./components/Header.tsx";
import { Layout } from "./components/Layout.tsx";
import { SelectionHighlight } from "./components/SelectionHighlight.tsx";
import { Stagger } from "./components/Stagger.tsx";
import { Footer } from "./components/playground/Footer.tsx";
import { Home } from "./pages/Home.tsx";
import { Playground } from "./pages/Playground.tsx";
import { What } from "./pages/What.tsx";

// All routes are imported eagerly. Lazy + Suspense was creating a
// suspend/resume cycle that broke Footer's entrance animation and caused
// a visible body collapse mid-transition.

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
          <Route path="/what" element={<What />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

// motion.footer with `layout="position"` animates the footer's Y when
// flex flow position changes (i.e., when the body above swaps to
// different-height content). LayoutGroup wraps Header + AnimatedBody +
// PersistentFooter so framer-motion knows to remeasure the footer when
// a sibling's content changes — without it, the footer would never see
// its position has changed.
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
        <FocusRingOverlay />
        <SelectionHighlight />
        <DevAgentation />
      </MotionConfig>
    </BrowserRouter>
  );
}
