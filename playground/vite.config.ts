import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: ["@central-icons-react/all"],
    },
  },
  optimizeDeps: {
    exclude: ["@central-icons-react/all"],
  },
});
