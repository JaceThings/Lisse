export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * `n.toFixed(4)`, byte-identical, ~2x faster (54 -> 28 ns per call on the
 * coordinates the emitters actually format). Path emission runs dozens of these
 * per corner (44 in a cold squircle corner alone) and `toFixed` is the single
 * largest line item in a cached `generatePath` call, because V8 routes it
 * through a general exact-decimal conversion. Scaling by 1e4 and splitting the
 * resulting integer stays in double arithmetic instead.
 */
export function fixed4(n: number): string {
  const scaled = n * 1e4;
  const ticks = Math.round(scaled);
  const residual = scaled - ticks;
  // A value that looks like a tie at the 5th decimal is where a scaled multiply
  // and toFixed's exact-decimal rounding disagree: 1234.56785 * 1e4 lands a hair
  // above 12345678.5 while the double itself is a hair below the tie, so
  // Math.round gives "1234.5679" where toFixed gives "1234.5678". A residual of
  // magnitude ~0.5 means `scaled` sat on that fence, whichever way `Math.round`
  // fell; hand the whole neighbourhood back to toFixed rather than guess.
  if (residual > 0.4999999 || residual < -0.4999999) return n.toFixed(4);
  // Non-finite and out-of-safe-range inputs (NaN, ±Infinity, |n| >= ~9e11) lose
  // the exact integer arithmetic this depends on, so they go the slow way too.
  // (NaN and ±Infinity reach here: their residual is NaN, so no comparison above
  // is true.)
  if (!Number.isSafeInteger(ticks)) return n.toFixed(4);

  // Sign comes from `n`, never from `ticks`: -0.00004 rounds to -0, whose
  // `< 0` test is false, and toFixed emits "-0.0000" for it.
  const negative = n < 0;
  const abs = negative ? -ticks : ticks;
  const frac = abs % 1e4;
  // Remainder first, then an exact division of a known multiple of 1e4.
  // `Math.floor(abs / 1e4)` is not safe: above |n| ~ 4.5e11 one ulp of the
  // quotient exceeds 1e-4, so k*1e4 - 1 can round up to k and leave a negative
  // remainder.
  const whole = (abs - frac) / 1e4;
  const pad = frac < 10 ? "000" : frac < 100 ? "00" : frac < 1000 ? "0" : "";
  return (negative ? "-" : "") + whole + "." + pad + frac;
}
