import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import codspeedPlugin from "@codspeed/vitest-plugin";

/**
 * Benchmark config. Two surfaces:
 *
 *   - `core.bench.ts` — JS hot paths in @lisse/core (generatePath,
 *     createSvgEffects). Instruction-count signal for CodSpeed.
 *   - `use-smooth-corners.bench.ts` — adapter-level wall-clock benches
 *     for local exploration. Also instruction-counted by CodSpeed.
 *
 * `@codspeed/vitest-plugin` is a no-op when not running under
 * `codspeed-vitest` so `pnpm bench` still works locally with raw
 * tinybench timing.
 */
export default defineConfig({
  plugins: [codspeedPlugin()],
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
