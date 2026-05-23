import { describe, it, expect } from "vitest";
import { integrateClothoid } from "../src/curves/integrate.js";

// The clothoid builder's cubic Bézier approximation hinges on the
// Simpson-rule integrator getting the endpoint right. These tests pin
// the integrator directly against closed-form / by-symmetry truth values
// so a regression in `integrate.ts` fails here, not just indirectly
// through the path-rendering tests.

describe("integrateClothoid", () => {
  it("returns the identity when L is 0", () => {
    const out = integrateClothoid(0.5, 0.2, 0.3, 0);
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
    expect(out.theta).toBe(0.5);
  });

  it("matches a straight line when κ stays 0 (θ(s) = θ₀)", () => {
    // κ₀ = 0, A = 0 ⇒ θ(s) ≡ 0 ⇒ X(L) = L, Y(L) = 0.
    const L = 10;
    const out = integrateClothoid(0, 0, 0, L);
    expect(out.x).toBeCloseTo(L, 8);
    expect(out.y).toBeCloseTo(0, 8);
    expect(out.theta).toBe(0);
  });

  it("matches a circular arc when A = 0 (constant curvature)", () => {
    // κ(s) ≡ κ₀ ⇒ θ(s) = θ₀ + κ₀·s ⇒ a clean circular arc of radius
    // R = 1/κ₀. For θ₀ = 0, κ₀ = 1/R, L = π·R/2: a quarter circle, ending
    // at (R, R) with tangent angle π/2.
    const R = 5;
    const L = (Math.PI * R) / 2;
    const out = integrateClothoid(0, 1 / R, 0, L);
    expect(out.x).toBeCloseTo(R, 3);
    expect(out.y).toBeCloseTo(R, 3);
    expect(out.theta).toBeCloseTo(Math.PI / 2, 8);
  });

  it("end tangent matches θ(L) exactly (closed-form)", () => {
    // theta is computed analytically as θ₀ + κ₀·L + (A/2)·L² — no
    // integration involved. This locks the contract.
    const L = 4;
    const out = integrateClothoid(0.1, 0.2, 0.05, L);
    const expected = 0.1 + 0.2 * L + (0.05 / 2) * L * L;
    expect(out.theta).toBe(expected);
  });

  it("clothoid (linear κ) preserves the small-angle approximation", () => {
    // For a pure clothoid (θ₀ = κ₀ = 0, κ(s) = A·s), the small-L Taylor
    // expansion gives X(L) ≈ L − A²L⁵/40 and Y(L) ≈ A·L³/6. With L = 1
    // and A = 0.1, the expected values are tiny corrections to (1, 0).
    const A = 0.1;
    const L = 1;
    const out = integrateClothoid(0, 0, A, L);
    expect(out.x).toBeCloseTo(L - (A * A * L ** 5) / 40, 4);
    expect(out.y).toBeCloseTo((A * L ** 3) / 6, 4);
  });
});
