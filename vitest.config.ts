import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const coreAlias = {
  "@lisse/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
};

export default defineConfig({
  test: {
    // Coverage configuration applies across all projects when `--coverage`
    // is passed. lcov is the format Codecov consumes; the others give us
    // local-friendly outputs.
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["packages/*/src/**/*.{ts,tsx}"],
      exclude: ["**/dist/**", "**/__tests__/**", "**/__fixtures__/**"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "core",
          include: ["packages/core/__tests__/**/*.test.ts"],
          environment: "happy-dom",
          alias: coreAlias,
        },
      },
      {
        extends: true,
        test: {
          name: "react",
          include: ["packages/react/__tests__/**/*.test.{ts,tsx}"],
          environment: "happy-dom",
          alias: coreAlias,
        },
      },
      {
        extends: true,
        test: {
          name: "vue",
          include: ["packages/vue/__tests__/**/*.test.{ts,tsx}"],
          environment: "happy-dom",
          alias: coreAlias,
        },
      },
      {
        extends: true,
        test: {
          name: "svelte",
          include: ["packages/svelte/__tests__/**/*.test.{ts,tsx}"],
          environment: "happy-dom",
          alias: coreAlias,
        },
      },
    ],
  },
});
