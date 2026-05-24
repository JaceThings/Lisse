/** Convert an angle in degrees to radians. */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Tagged-template helper that formats interpolated numbers to 4 decimal
 * places. Used to keep generated SVG path strings compact and stable
 * across re-renders. Hand-rolled `for`-loop concat rather than
 * `.reduce` to avoid the per-iteration closure-allocation overhead.
 */
export function rounded(
  strings: TemplateStringsArray,
  ...values: number[]
): string {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    out += typeof value === "number" ? value.toFixed(4) : (value ?? "");
    out += strings[i + 1];
  }
  return out;
}
