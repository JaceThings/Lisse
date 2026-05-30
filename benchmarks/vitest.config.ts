import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Benchmark config. Two surfaces, both run by `pnpm bench` on tinybench's
 * wall-clock loop:
 *
 *   - `core.bench.ts` — JS hot paths in @lisse/core (generatePath,
 *     createSvgEffects).
 *   - `use-smooth-corners.bench.ts` — adapter-level benches for local
 *     exploration.
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
