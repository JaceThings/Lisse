import { writeFileSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: true,
  external: ["octane"],
  banner: { js: '"use client";' },
  onSuccess: async () => {
    writeFileSync("dist/.npmignore", "*.cjs.map\n");
  },
});
