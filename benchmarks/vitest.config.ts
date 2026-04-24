import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Benchmark config for the React adapter.
 *
 * - `happy-dom` provides a JSDOM-compatible environment without paint.
 * - Aliases resolve the workspace sources directly so benches exercise the
 *   same code paths as the tests (no need to rebuild dist/ first).
 */
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["**/*.bench.ts"],
    benchmark: {
      include: ["**/*.bench.ts"],
      reporters: ["default"],
    },
    alias: {
      "@lisse/core": fileURLToPath(new URL("../packages/core/src/index.ts", import.meta.url)),
      "@lisse/react": fileURLToPath(new URL("../packages/react/src/index.ts", import.meta.url)),
    },
  },
});
