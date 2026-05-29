import { startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

// Custom client entry — intentionally WITHOUT <StrictMode>. Start's default
// client entry wraps the app in StrictMode, whose dev-only double-mount
// restarts the Stagger entrance cascade mid-flight (class added → cleanup →
// re-added) and drops the first items' animation. The old src/main.tsx
// avoided StrictMode for exactly this reason; mirror that here.
startTransition(() => {
  hydrateRoot(document, <StartClient />);
});
