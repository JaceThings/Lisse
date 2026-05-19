import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { DialRoot } from "dialkit";
import "dialkit/styles.css";
import { PageFeedbackToolbarCSS } from "agentation";
import { FocusRingOverlay } from "./components/FocusRingOverlay.tsx";
import { SelectionHighlight } from "./components/SelectionHighlight.tsx";
import { Home } from "./pages/Home.tsx";
import { Playground } from "./pages/Playground.tsx";
import { What } from "./pages/What.tsx";

/**
 * The dialkit panel is route-scoped to /playground so it doesn't show
 * on Home or /what. Rendered as a sibling of <Routes> rather than inside
 * <Playground> so the panel survives route-revisits without remounting.
 * `productionEnabled` is left at its default — dialkit hides itself in
 * production builds, which is what we want here.
 */
function PlaygroundDialRoot() {
  const { pathname } = useLocation();
  if (pathname !== "/playground") return null;
  return <DialRoot position="bottom-right" defaultOpen={false} />;
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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/what" element={<What />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <FocusRingOverlay />
      <SelectionHighlight />
      <PlaygroundDialRoot />
      {/* Agentation: dev-only annotation toolbar — click UI elements to add
          notes and copy structured context (selector / source file / styles)
          for AI agents. Vite statically replaces `import.meta.env.DEV` so
          the rendered tree is DCE'd in production. */}
      {import.meta.env.DEV && <PageFeedbackToolbarCSS />}
    </BrowserRouter>
  );
}
