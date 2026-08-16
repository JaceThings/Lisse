import { fixed4 } from "../utils.js";
import { getPathParamsForCorner } from "../corner-params.js";
import type { CornerPathParams } from "../types.js";
import type { CurveBuilder } from "./types.js";
import { EMPTY_BUILDER_OUTPUT } from "./types.js";
import { negated } from "./orient.js";

/**
 * Figma squircle — cubic shoulder + central arc + cubic shoulder. G1
 * with the adjacent edges (curvature steps at the cubic↔arc seams).
 *
 * The four per-orient arms stay hand-written rather than going through the
 * shared `cubic` emitter: their literal `0` characters (e.g. `c ${a} 0 …`)
 * print as `0`, not `0.0000`, and routing them through a formatter would
 * round those literals and diff every downstream snapshot despite identical
 * visuals.
 */
export const buildSquircle: CurveBuilder = ({
  cornerRadius,
  smoothing,
  preserveSmoothing,
  roundingAndSmoothingBudget,
}) => {
  const params = getPathParamsForCorner({
    cornerRadius,
    cornerSmoothing: smoothing,
    preserveSmoothing,
    roundingAndSmoothingBudget,
  });
  if (params.cornerRadius <= 0) return EMPTY_BUILDER_OUTPUT;
  const t = squircleText(params);
  return {
    p: params.p,
    pathSegment: (orient) => {
      switch (orient) {
        case "TR":
          return `c ${t.a} 0 ${t.ab} 0 ${t.abc} ${t.d} a ${t.r} ${t.r} 0 0 1 ${t.arc} ${t.arc} c ${t.d} ${t.c} ${t.d} ${t.bc} ${t.d} ${t.abc}`;
        case "BR":
          return `c 0 ${t.a} 0 ${t.ab} ${t.dn} ${t.abc} a ${t.r} ${t.r} 0 0 1 ${t.arcn} ${t.arc} c ${t.cn} ${t.d} ${t.bcn} ${t.d} ${t.abcn} ${t.d}`;
        case "BL":
          return `c ${t.an} 0 ${t.abn} 0 ${t.abcn} ${t.dn} a ${t.r} ${t.r} 0 0 1 ${t.arcn} ${t.arcn} c ${t.dn} ${t.cn} ${t.dn} ${t.bcn} ${t.dn} ${t.abcn}`;
        case "TL":
          return `c 0 ${t.an} 0 ${t.abn} ${t.d} ${t.abcn} a ${t.r} ${t.r} 0 0 1 ${t.arc} ${t.arcn} c ${t.c} ${t.dn} ${t.bc} ${t.dn} ${t.abc} ${t.dn}`;
      }
    },
  };
};

/**
 * The eight distinct magnitudes a squircle corner emits, formatted once in
 * both signs. The four drawers differ only in which slot each lands in, so
 * they used to run the same eight numbers through `fixed4` 56 times between
 * them.
 */
interface SquircleText {
  /** Entry-shoulder cubic deltas: `a`, `a + b`, `a + b + c`. */
  a: string;
  an: string;
  ab: string;
  abn: string;
  abc: string;
  abcn: string;
  /** Exit-shoulder cubic deltas: `c`, `b + c`, and the cross-axis rise `d`. */
  c: string;
  cn: string;
  bc: string;
  bcn: string;
  d: string;
  dn: string;
  /** Corner radius — both radius slots of the `a` command, never signed. */
  r: string;
  /** Arc chord. */
  arc: string;
  /**
   * Arc chord with a literal `-` in front, exactly as the drawers used to
   * spell it (`0 0 1 -${arcSectionLength}`) — *not* the chord negated. At
   * smoothing = 1 the arc collapses and the chord is exactly 0, which the
   * literal prints as `-0.0000` while a numeric negation would print
   * `0.0000` and diff every full-smoothing snapshot.
   */
  arcn: string;
}

function squircleText({
  cornerRadius,
  a,
  b,
  c,
  d,
  arcSectionLength,
}: CornerPathParams): SquircleText {
  const ab = a + b;
  const abc = ab + c;
  const bc = b + c;
  const fa = fixed4(a);
  const fab = fixed4(ab);
  const fabc = fixed4(abc);
  const fc = fixed4(c);
  const fbc = fixed4(bc);
  const fd = fixed4(d);
  const farc = fixed4(arcSectionLength);
  return {
    a: fa,
    an: negated(a, fa),
    ab: fab,
    abn: negated(ab, fab),
    abc: fabc,
    abcn: negated(abc, fabc),
    c: fc,
    cn: negated(c, fc),
    bc: fbc,
    bcn: negated(bc, fbc),
    d: fd,
    dn: negated(d, fd),
    r: fixed4(cornerRadius),
    arc: farc,
    arcn: "-" + farc,
  };
}
