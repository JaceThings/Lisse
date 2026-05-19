import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { FocusRingOverlay } from "./components/FocusRingOverlay.tsx";
import { SelectionHighlight } from "./components/SelectionHighlight.tsx";
import { Home } from "./pages/Home.tsx";

// Home stays eager so the landing route renders without a Suspense flash;
// Playground and What pull in heavy code paths (dialkit, large section
// trees) that most visitors never touch, so they split.
const Playground = lazy(() =>
  import("./pages/Playground.tsx").then((m) => ({ default: m.Playground })),
);
const What = lazy(() =>
  import("./pages/What.tsx").then((m) => ({ default: m.What })),
);

// In production `import.meta.env.DEV` is replaced with `false`, so the
// dynamic import lives in a dead branch and Vite drops `agentation`
// from the build entirely.
function DevAgentation() {
  const [Toolbar, setToolbar] = useState<ComponentType | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // Catch silences `Unhandled promise rejection` if the package is
     // missing or fails to load in dev. The toolbar simply doesn't appear.
    import("agentation")
      .then((m) => setToolbar(() => m.PageFeedbackToolbarCSS))
      .catch(() => {});
  }, []);
  return Toolbar ? <Toolbar /> : null;
}

// Overlay effects (`FocusRingOverlay`, `SelectionHighlight`) mount once
// here so they persist across route changes. Unknown paths fall back to
// `<Home />` — nginx.conf's SPA fallback routes deep links here.
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
