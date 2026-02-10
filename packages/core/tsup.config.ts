import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/path.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
});
