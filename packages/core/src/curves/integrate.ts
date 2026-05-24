/**
 * Simpson's-rule integration of the clothoid position integrals
 *     X(L) = ∫₀ᴸ cos θ(s) ds,   Y(L) = ∫₀ᴸ sin θ(s) ds
 * where θ(s) = θ₀ + κ₀·s + (A/2)·s². Returns endpoint (x, y) and θ(L).
 *
 * N = 32 keeps the absolute position error below 1e-4 across all
 * Lisse-realistic radii (R ≤ 500). Simpson error is O((L/N)⁴·L).
 */
export function integrateClothoid(
  theta0: number,
  kappa0: number,
  A: number,
  L: number,
): { x: number; y: number; theta: number } {
  const N = 32;
  if (L <= 0) return { x: 0, y: 0, theta: theta0 };

  const step = L / N;
  let xAcc = 0;
  let yAcc = 0;
  for (let i = 1; i <= N; i++) {
    const sA = (i - 1) * step;
    const sB = sA + step;
    const sM = (sA + sB) / 2;
    const thA = theta0 + kappa0 * sA + (A / 2) * sA * sA;
    const thB = theta0 + kappa0 * sB + (A / 2) * sB * sB;
    const thM = theta0 + kappa0 * sM + (A / 2) * sM * sM;
    xAcc += (step / 6) * (Math.cos(thA) + 4 * Math.cos(thM) + Math.cos(thB));
    yAcc += (step / 6) * (Math.sin(thA) + 4 * Math.sin(thM) + Math.sin(thB));
  }
  const thetaEnd = theta0 + kappa0 * L + (A / 2) * L * L;
  return { x: xAcc, y: yAcc, theta: thetaEnd };
}
