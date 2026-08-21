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
  // No `"use client"` banner, unlike the React adapter: Octane's compiler
  // ignores that directive, so it would be dead bytes in every consumer bundle.
  //
  // npm ignores a root .npmignore when "files" lists the whole dist directory,
  // so the per-directory one keeps CJS sourcemaps out of the tarball.
  onSuccess: async () => {
    writeFileSync("dist/.npmignore", "*.cjs.map\n");
  },
});
