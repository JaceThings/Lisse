import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

/**
 * Browser-smoke vitest config.
 *
 * Runs in real Chromium / WebKit / Firefox via @vitest/browser's
 * Playwright provider. Job is on-main + tagged-release only — never
 * on every PR — so a ~5 minute browser matrix doesn't tax the PR loop.
 *
 * Three browsers because they're free in Playwright's matrix:
 *   - Chromium: the highest-volume consumer renderer
 *   - WebKit: covers documented Safari SVG/shadow quirks
 *   - Firefox: third independent rendering engine, near-zero CI cost
 *
 * CPU throttling for low-end simulation is set per-test via CDP on
 * Chromium only (WebKit / Firefox don't expose it identically).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["**/*.test.{ts,tsx}"],
    browser: {
      enabled: true,
      provider: "playwright",
      headless: true,
      instances: [
        { browser: "chromium" },
        { browser: "webkit" },
        { browser: "firefox" },
      ],
    },
    alias: {
      "@lisse/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@lisse/react": fileURLToPath(new URL("../../packages/react/src/index.ts", import.meta.url)),
    },
  },
});
