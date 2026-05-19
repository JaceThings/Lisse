import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Split stable, large vendors into their own chunks so the browser
        // cache survives app code changes. Route splits (Playground, What)
        // are handled by React.lazy in App.tsx.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("/react-router") ||
            id.includes("/react-dom/") ||
            /\/react\/[^/]*$/.test(id) ||
            id.includes("/react/index") ||
            id.includes("/scheduler/")
          ) {
            return "react-vendor";
          }
          if (id.includes("/framer-motion/") || id.includes("/motion-dom/") || id.includes("/motion-utils/")) {
            return "motion";
          }
          if (
            id.includes("/@lisse/") ||
            id.includes("/@numeric-text/")
          ) {
            return "lisse";
          }
          return undefined;
        },
      },
    },
  },
});
