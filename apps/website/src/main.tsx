// Inter `standard` variant ships both `wght` and `opsz` axes; paired with
// `font-optical-sizing: auto` in global.css so the font adjusts between
// display and text sizes.
import "@fontsource-variable/inter/standard.css";
import "@fontsource-variable/inter/standard-italic.css";
import "./styles/tokens.css";
import "./styles/global.css";

import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found in index.html");

// No StrictMode — its dev-only double-mount makes the Stagger entrance
// restart mid-flight (class added → cleanup → class re-added), which
// drops the first few items' animation visibility. Production behaviour
// is identical either way.
createRoot(rootEl).render(<App />);
