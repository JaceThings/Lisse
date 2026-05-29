import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Start auto-discovers this file (src/router.tsx exporting `getRouter`) and
// uses it for both the client and server. The ./routeTree.gen import will not
// resolve — and tsc will error — until the first `vite dev`/`vite build`
// generates src/routeTree.gen.ts. That's expected.
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
