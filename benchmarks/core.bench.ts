// Core-level JS hot-path benches.
//
// 9 benches covering the surfaces consumers spend time in:
//   - generatePath, single corner, four curve types (×4)
//   - generatePath, 100-element batch, four curve types (×4)
//   - createSvgEffects + one update cycle (×1)
//
// The framework-adapter bench in `use-smooth-corners.bench.ts` covers the
// same surfaces at the adapter level. Run both with `pnpm bench`.
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

// 100-element batch captures the scaling story (linear in count) without
// a multi-second per-iteration loop.
for (const curve of CURVES) {
  describe(`generatePath 100-batch — ${curve}`, () => {
    bench(`100x generatePath ${curve}`, () => {
      for (let i = 0; i < 100; i++) {
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
