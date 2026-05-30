import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// TanStack Start (SSR) replaces the old static Vite SPA build. The Start
// plugin owns the client + server entries, generates src/routeTree.gen.ts
// from src/routes/*, and emits a self-contained Node server we run directly
// (no nginx, no prerender, no static-asset dance).
export default defineConfig({
  server: {
    port: 5173,
    host: true,
    // Preserved verbatim — dev tunnels (cloudflared/ngrok) rely on these.
    allowedHosts: [".trycloudflare.com", ".ngrok.io", ".ngrok-free.app"],
  },
  // `@numeric-text/react` ships a side-effect `import '@numeric-text/core/ssr.css'`.
  // In SSR dev, node_modules are externalised by default, so Node's ESM loader
  // gets handed the raw .css and throws "Unknown file extension .css" (a 500 on
  // every route). Pulling these into the SSR transform pipeline lets Vite handle
  // the CSS import — a no-op server-side — instead. The prod build already
  // bundles past this through Rollup; this only fixes `pnpm dev`.
  ssr: {
    noExternal: ["@numeric-text/react", "@numeric-text/core"],
  },
  plugins: [
    // Start FIRST — it generates the route tree and wires the SSR graph.
    // (Bundles the router plugin internally; do NOT add @tanstack/router-plugin.)
    tanstackStart(),
    // Nitro assembles the SSR handler + static assets + a listening Node
    // server into .output/ (node-server preset auto-detected) — a single
    // self-contained process that binds PORT. This is what replaces nginx.
    nitro(),
    tailwindcss(),
    // React LAST — must come after tanstackStart().
    viteReact(),
  ],
});
