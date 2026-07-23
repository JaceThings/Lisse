import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

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
    },
  },
});
