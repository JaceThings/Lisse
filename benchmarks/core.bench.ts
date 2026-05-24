// Core-level JS hot-path benches.
//
// 9 benches covering the surfaces consumers spend time in:
//   - generatePath, single corner, four curve types (×4)
//   - generatePath, 500 elements in a tight loop, four curve types (×4)
//   - createSvgEffects + one update cycle (×1)
//
// CodSpeed wraps each `bench()` call with instruction counting so the
// numbers are deterministic across CI runs. The framework-adapter bench
// in `use-smooth-corners.bench.ts` covers the same surfaces with wall
// time for local exploration.
//
// Soft-launch: CodSpeed posts a per-PR comment for the first 8 weeks
// with no hard fail. Tighten thresholds once the false-positive rate is
// known.
import { bench, describe } from "vitest";
import { generatePath, createSvgEffects } from "../packages/core/src/index.js";
import type { CurveType } from "../packages/core/src/curves/index.js";

const CURVES: CurveType[] = ["arc", "squircle", "superellipse", "clothoid"];

for (const curve of CURVES) {
  describe(`generatePath single-corner — ${curve}`, () => {
    bench(`generatePath 200x100 r=24 ${curve}`, () => {
      generatePath(200, 100, { radius: 24, smoothing: 0.6, curve });
    });
  });
}

for (const curve of CURVES) {
  describe(`generatePath 500-batch — ${curve}`, () => {
    bench(`500x generatePath ${curve}`, () => {
      for (let i = 0; i < 500; i++) {
        generatePath(200 + (i % 50), 100 + (i % 20), { radius: 24, smoothing: 0.6, curve });
      }
    });
  });
}

describe("createSvgEffects — mount + update cycle", () => {
  bench(
    "createSvgEffects + update",
    () => {
      // happy-dom is set up by the vitest env; document.createElement
      // is safe here.
      const anchor = document.createElement("div");
      document.body.appendChild(anchor);
      const handle = createSvgEffects(anchor);
      handle.update(
        { radius: 24, smoothing: 0.6 },
        { innerBorder: { width: 2, color: "#000000", opacity: 1 } },
        200,
        100,
      );
      handle.destroy();
      anchor.remove();
    },
  );
});
