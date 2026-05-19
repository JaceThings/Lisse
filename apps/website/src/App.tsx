import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { FocusRingOverlay } from "./components/FocusRingOverlay.tsx";
import { SelectionHighlight } from "./components/SelectionHighlight.tsx";
import { Home } from "./pages/Home.tsx";

// Home stays eagerly imported so the landing route renders without a
// Suspense flash on first paint. Playground and What are split off because
// they each pull in heavy code paths (dialkit, large section trees) that
// most visitors never touch.
const Playground = lazy(() =>
  import("./pages/Playground.tsx").then((m) => ({ default: m.Playground })),
);
const What = lazy(() =>
  import("./pages/What.tsx").then((m) => ({ default: m.What })),
);

// In production `import.meta.env.DEV` is replaced with `false`, so the
// dynamic import lives inside a dead branch and Vite drops `agentation`
// from the build entirely.
function DevAgentation() {
  const [Toolbar, setToolbar] = useState<ComponentType | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    import("agentation").then((m) => setToolbar(() => m.PageFeedbackToolbarCSS));
  }, []);
  return Toolbar ? <Toolbar /> : null;
}

/**
 * Router root. Each `<Route>` swaps the page body; the overlay
 * effects (`FocusRingOverlay`, `SelectionHighlight`) mount once at
 * this level so they persist across route changes. Unknown paths
 * fall back to `<Home />` — the SPA fallback in nginx.conf already
 * routes deep links here, so this is just the client-side mirror.
 */
export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-bg" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/what" element={<What />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
      <FocusRingOverlay />
      <SelectionHighlight />
      <DevAgentation />
    </BrowserRouter>
  );
}
