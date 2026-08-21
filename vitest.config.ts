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
      {
        extends: true,
        test: {
          name: "octane",
          include: ["packages/octane/__tests__/**/*.test.{ts,tsx}"],
          exclude: ["packages/octane/__tests__/ssr.test.tsx"],
          environment: "happy-dom",
          alias: coreAlias,
        },
      },
      {
        extends: true,
        test: {
          name: "octane-ssr",
          include: ["packages/octane/__tests__/ssr.test.tsx"],
          environment: "node",
          alias: [
            { find: /^@lisse\/core$/, replacement: coreAlias["@lisse/core"] },
            // octane's default entry reaches for browser globals, so the
            // node-environment SSR suite has to run against the runtime
            // behind octane's `./server` export. Rewrite the bare
            // specifier and let Vite resolve it through octane's own
            // exports map, rather than naming a file inside `dist/`:
            // that deep path reached past the exports map and baked in
            // pnpm's nested `packages/octane/node_modules/` layout,
            // which does not exist under `node-linker=hoisted`. A
            // specifier also fails loudly if octane ever drops the
            // subpath, where `new URL(...)` silently produced a path to
            // nothing. `/^octane$/` is anchored, so the rewritten
            // `octane/server` is not re-aliased.
            { find: /^octane$/, replacement: "octane/server" },
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "extension",
          include: ["apps/extension/__tests__/**/*.test.ts"],
          environment: "happy-dom",
          alias: coreAlias,
        },
      },
    ],
  },
});
