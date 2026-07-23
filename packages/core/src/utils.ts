export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Tagged-template helper formatting interpolated numbers to 4 decimals, so
 * generated SVG path strings stay compact and bit-stable across engines and
 * re-renders. Explicit `for`-loop concat (not `.reduce`) to stay
 * closure-allocation-free on this hot path.
 */
export function rounded(
  strings: TemplateStringsArray,
  ...values: number[]
): string {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += values[i].toFixed(4);
    out += strings[i + 1];
  }
  return out;
}
