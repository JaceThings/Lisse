import { writeFileSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: true,
  external: ["react"],
  banner: { js: '"use client";' },
  // .npmignore at the package root is not honored by npm when "files"
  // includes the whole "dist" directory, so drop a per-directory ignore
  // file into dist/ after each build to keep CJS sourcemaps out of the
  // published tarball while leaving them on disk locally.
  onSuccess: async () => {
    writeFileSync("dist/.npmignore", "*.cjs.map\n");
  },
});
