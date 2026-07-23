import type { RoundedRectangle, NormalizedCorners } from "./types.js";

/**
 * One corner's rounding-and-smoothing budget, as the minimum over its two
 * edge-sharing neighbours. `r` is the corner's *original* radius; `nHr`/`nHb`
 * and `nVr`/`nVb` are the *current* radius and budget of the horizontal
 * (width-sharing) and vertical (height-sharing) neighbours respectively — a
 * budget < 0 marks a neighbour that has not been processed yet.
 *
 * Mirrors the per-adjacent term of the original algorithm exactly:
 *   - both radii zero  → 0
 *   - neighbour done   → side − neighbourBudget
 *   - neighbour pending → proportional split (r / (r + neighbourRadius)) · side
 */
function cornerBudget(
  r: number,
  nHr: number,
  nHb: number,
  width: number,
  nVr: number,
  nVb: number,
  height: number
): number {
  const termH =
    r === 0 && nHr === 0
      ? 0
      : nHb >= 0
        ? width - nHb
        : (r / (r + nHr)) * width;
  const termV =
    r === 0 && nVr === 0
      ? 0
      : nVb >= 0
        ? height - nVb
        : (r / (r + nVr)) * height;
  return Math.min(termH, termV);
}

/**
 * Distribute available space among corners, normalizing radii so they
 * don't exceed the rectangle dimensions. Larger corners get priority.
 *
 * Allocation-free: no `Object.entries`, no `.sort`, no `.map`, and no
 * per-call closures. The stable "bigger corner chooses first" ordering
 * (ties broken by TL → TR → BL → BR insertion order) is reproduced with
 * explicit rank comparisons; a uniform equal-radius input resolves through
 * a closed-form fast path.
 */
export function distributeAndNormalize({
  topLeftCornerRadius: OTL,
  topRightCornerRadius: OTR,
  bottomRightCornerRadius: OBR,
  bottomLeftCornerRadius: OBL,
  width,
  height,
}: RoundedRectangle): NormalizedCorners {
  // Fast path: every corner shares one positive radius on a positive box.
  // The general algorithm provably yields budget = min(w, h) / 2 for all
  // four corners here (each corner's minimising term reduces to that value),
  // so the result is bit-identical. Gated on radius > 0 because all-zero
  // input yields a zero budget, not min(w, h) / 2.
  if (
    OTL === OTR &&
    OTR === OBR &&
    OBR === OBL &&
    OTL > 0 &&
    width > 0 &&
    height > 0
  ) {
    const budget = Math.min(width, height) / 2;
    const radius = Math.min(OTL, budget);
    const corner = { radius, roundingAndSmoothingBudget: budget };
    return {
      topLeft: corner,
      topRight: { radius, roundingAndSmoothingBudget: budget },
      bottomLeft: { radius, roundingAndSmoothingBudget: budget },
      bottomRight: { radius, roundingAndSmoothingBudget: budget },
    };
  }

  // Processing rank of each corner under a stable descending sort by radius.
  // A neighbour j precedes corner i when r_j > r_i, or r_j === r_i and j has
  // the earlier insertion index (TL=0, TR=1, BL=2, BR=3).
  const rankTL =
    (OTR > OTL ? 1 : 0) + (OBL > OTL ? 1 : 0) + (OBR > OTL ? 1 : 0);
  const rankTR =
    (OTL >= OTR ? 1 : 0) + (OBL > OTR ? 1 : 0) + (OBR > OTR ? 1 : 0);
  const rankBL =
    (OTL >= OBL ? 1 : 0) + (OTR >= OBL ? 1 : 0) + (OBR > OBL ? 1 : 0);
  const rankBR =
    (OTL >= OBR ? 1 : 0) + (OTR >= OBR ? 1 : 0) + (OBL >= OBR ? 1 : 0);

  // Current (clamped) radii and budgets; -1 budget marks "not yet processed".
  let cTL = OTL;
  let cTR = OTR;
  let cBL = OBL;
  let cBR = OBR;
  let bTL = -1;
  let bTR = -1;
  let bBL = -1;
  let bBR = -1;

  for (let step = 0; step < 4; step++) {
    const c =
      rankTL === step ? 0 : rankTR === step ? 1 : rankBL === step ? 2 : 3;

    if (c === 0) {
      // topLeft: H neighbour topRight (width), V neighbour bottomLeft (height)
      bTL = cornerBudget(OTL, cTR, bTR, width, cBL, bBL, height);
      cTL = Math.min(OTL, bTL);
    } else if (c === 1) {
      // topRight: H neighbour topLeft (width), V neighbour bottomRight (height)
      bTR = cornerBudget(OTR, cTL, bTL, width, cBR, bBR, height);
      cTR = Math.min(OTR, bTR);
    } else if (c === 2) {
      // bottomLeft: H neighbour bottomRight (width), V neighbour topLeft (height)
      bBL = cornerBudget(OBL, cBR, bBR, width, cTL, bTL, height);
      cBL = Math.min(OBL, bBL);
    } else {
      // bottomRight: H neighbour bottomLeft (width), V neighbour topRight (height)
      bBR = cornerBudget(OBR, cBL, bBL, width, cTR, bTR, height);
      cBR = Math.min(OBR, bBR);
    }
  }

  return {
    topLeft: { radius: cTL, roundingAndSmoothingBudget: bTL },
    topRight: { radius: cTR, roundingAndSmoothingBudget: bTR },
    bottomLeft: { radius: cBL, roundingAndSmoothingBudget: bBL },
    bottomRight: { radius: cBR, roundingAndSmoothingBudget: bBR },
  };
}
