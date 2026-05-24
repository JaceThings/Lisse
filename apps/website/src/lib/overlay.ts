// Morphed-overlay system for the math demo page. A `MorphedOverlay`
// holds every label, control polygon, arc spoke, etc. with per-element
// position + opacity so that switching between curve types animates
// each piece into its new spot rather than crossfading two whole curves
// of labels (which produces ghost duplicates when the same name lives
// at different positions in the two curves).
//
// Two entry points:
//   - `buildOverlay(curve, cornerX, cornerY, R)`: snapshot a single
//     curve at opacity 1 — used as the "target" of every morph and as
//     the initial snapshot on first mount.
//   - `lerpOverlay(from, to, t)`: interpolate between two snapshots at
//     progress `t ∈ [0, 1]`. Elements that exist on only one side of
//     the morph slide toward the spatially-nearest equivalent in the
//     other overlay while their opacity fades.

import type { Curve, LabelledPt, Pt } from "./curves.ts";

export interface OverlayPoint extends LabelledPt {
  opacity: number;
}

export interface OverlayPolygon {
  points: Pt[];
  opacity: number;
}

export interface OverlaySpoke {
  a: Pt;
  b: Pt;
  opacity: number;
}

export interface MorphedOverlay {
  points: OverlayPoint[];
  controlPolygons: OverlayPolygon[];
  arcSpokes: OverlaySpoke[];
  arcCenter?: { point: Pt; opacity: number };
  arcRadiusReadout?: { point: Pt; R: number; opacity: number };
  referenceArc?: { start: Pt; end: Pt; R: number; opacity: number };
  /** Lerped corner and curve endpoint positions for the straight edges
   *  and sharp-corner indicator. */
  cornerX: number;
  cornerY: number;
  P0: Pt;
  P7: Pt;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

/** Snapshot a curve as a no-morph overlay — every element at opacity 1. */
export function buildOverlay(curve: Curve, cornerX: number, cornerY: number, R: number): MorphedOverlay {
  return {
    points: curve.points.map((p) => ({ ...p, opacity: 1 })),
    controlPolygons: (curve.controlPolygons ?? []).map((poly) => ({ points: poly, opacity: 1 })),
    arcSpokes: (curve.arcSpokes ?? []).map((s) => ({ a: s[0], b: s[1], opacity: 1 })),
    arcCenter: curve.arcCenter ? { point: curve.arcCenter, opacity: 1 } : undefined,
    arcRadiusReadout: curve.arcCenter
      ? { point: [curve.arcCenter[0], curve.arcCenter[1] + 14], R, opacity: 1 }
      : undefined,
    referenceArc: curve.referenceArc ? { ...curve.referenceArc, opacity: 1 } : undefined,
    cornerX,
    cornerY,
    P0: curve.points[0].point,
    P7: curve.points[curve.points.length - 1].point,
  };
}

/** Find the spatially-nearest overlay point in `target` to a given
 *  point — used as a "fade-out destination" for prev-only elements so
 *  they slide toward a sensible place in the new curve instead of
 *  fading in their old location. */
function nearestPoint(target: OverlayPoint[], pt: Pt): Pt {
  if (target.length === 0) return pt;
  let best = target[0].point;
  let bestD = Infinity;
  for (const candidate of target) {
    const d = Math.hypot(candidate.point[0] - pt[0], candidate.point[1] - pt[1]);
    if (d < bestD) {
      bestD = d;
      best = candidate.point;
    }
  }
  return best;
}

/** Generic three-branch lerp for arrays of overlay elements. Same
 *  shape used by labels (matched by name), control polygons (by
 *  index), and arc spokes (by index): each side may have an element
 *  the other lacks, so we need a "lerp shared" / "fade in new" /
 *  "fade out old" trio. Factoring it out makes the three call sites
 *  read as one paragraph each instead of three near-identical loops. */
function lerpElements<F, T, R>(
  fromList: readonly F[],
  toList: readonly T[],
  match: (f: F, t: T) => boolean,
  t: number,
  lerpShared: (f: F, to: T, t: number) => R,
  fadeInNew: (to: T, t: number) => R,
  fadeOutOld: (from: F, t: number) => R,
): R[] {
  const out: R[] = [];
  // Walk `toList` first so output order matches the new curve's
  // intended draw order.
  const fromMatchedIndices = new Set<number>();
  for (const to of toList) {
    const fromIdx = fromList.findIndex((f, i) => !fromMatchedIndices.has(i) && match(f, to));
    if (fromIdx >= 0) {
      fromMatchedIndices.add(fromIdx);
      out.push(lerpShared(fromList[fromIdx], to, t));
    } else {
      out.push(fadeInNew(to, t));
    }
  }
  for (let i = 0; i < fromList.length; i++) {
    if (fromMatchedIndices.has(i)) continue;
    out.push(fadeOutOld(fromList[i], t));
  }
  return out;
}

/** Lerp between two overlays. Labels are matched by name; polygons /
 *  spokes by index. Elements that exist on only one side of the morph
 *  slide toward the spatially-nearest equivalent in the other overlay
 *  while their opacity fades — so a P1 fading out during a squircle →
 *  arc morph drifts toward P0 (the closest label in arc) instead of
 *  fading in place. */
export function lerpOverlay(from: MorphedOverlay, to: MorphedOverlay, t: number): MorphedOverlay {
  // === Labels (matched by name) ===
  const points = lerpElements<OverlayPoint, OverlayPoint, OverlayPoint>(
    from.points,
    to.points,
    (f, target) => f.label === target.label,
    t,
    (f, target, tt) => ({
      ...target,
      point: lerpPt(f.point, target.point, tt),
      opacity: lerp(f.opacity, 1, tt),
    }),
    // New label — fade in at its natural position. Sliding from a
    // far-away "from" point looks worse than just fading in here.
    (target, tt) => ({ ...target, opacity: tt * target.opacity }),
    // Old label — slide toward spatially-nearest target while fading.
    (f, tt) => ({
      ...f,
      point: lerpPt(f.point, nearestPoint(to.points, f.point), tt),
      opacity: f.opacity * (1 - tt),
    }),
  );

  // === Control polygons (matched by index, must share vertex count) ===
  const controlPolygons = lerpElements<OverlayPolygon, OverlayPolygon, OverlayPolygon>(
    from.controlPolygons,
    to.controlPolygons,
    (f, target) => f.points.length === target.points.length,
    t,
    (f, target, tt) => ({
      points: f.points.map((pt, j) => lerpPt(pt, target.points[j], tt)),
      opacity: lerp(f.opacity, target.opacity, tt),
    }),
    // New polygon — grow from `from.P0` into full shape.
    (target, tt) => ({
      points: target.points.map((pt) => lerpPt(from.P0, pt, tt)),
      opacity: tt * target.opacity,
    }),
    // Old polygon — collapse toward `to.P0` while fading.
    (f, tt) => ({
      points: f.points.map((pt) => lerpPt(pt, to.P0, tt)),
      opacity: f.opacity * (1 - tt),
    }),
  );

  // === Arc spokes (matched by index, but the indices are interchangeable
  // because each curve only has 2 spokes from the arc centre) ===
  const arcSpokeSeed: Pt = to.arcCenter?.point ?? [to.cornerX, to.cornerY];
  const arcSpokes = lerpElements<OverlaySpoke, OverlaySpoke, OverlaySpoke>(
    from.arcSpokes,
    to.arcSpokes,
    () => true,
    t,
    (f, target, tt) => ({
      a: lerpPt(f.a, target.a, tt),
      b: lerpPt(f.b, target.b, tt),
      opacity: lerp(f.opacity, target.opacity, tt),
    }),
    // New spoke — radiate out from the new arc centre.
    (target, tt) => ({
      a: lerpPt(arcSpokeSeed, target.a, tt),
      b: lerpPt(arcSpokeSeed, target.b, tt),
      opacity: tt * target.opacity,
    }),
    // Old spoke — collapse toward the new arc centre while fading.
    (f, tt) => ({
      a: lerpPt(f.a, arcSpokeSeed, tt),
      b: lerpPt(f.b, arcSpokeSeed, tt),
      opacity: f.opacity * (1 - tt),
    }),
  );

  // === Arc centre + radius readout ===
  let arcCenter: MorphedOverlay["arcCenter"];
  let arcRadiusReadout: MorphedOverlay["arcRadiusReadout"];
  if (from.arcCenter && to.arcCenter) {
    arcCenter = {
      point: lerpPt(from.arcCenter.point, to.arcCenter.point, t),
      opacity: lerp(from.arcCenter.opacity, to.arcCenter.opacity, t),
    };
    if (from.arcRadiusReadout && to.arcRadiusReadout) {
      arcRadiusReadout = {
        point: lerpPt(from.arcRadiusReadout.point, to.arcRadiusReadout.point, t),
        R: lerp(from.arcRadiusReadout.R, to.arcRadiusReadout.R, t),
        opacity: lerp(from.arcRadiusReadout.opacity, to.arcRadiusReadout.opacity, t),
      };
    }
  } else if (to.arcCenter) {
    arcCenter = { ...to.arcCenter, opacity: t * to.arcCenter.opacity };
    if (to.arcRadiusReadout) {
      arcRadiusReadout = { ...to.arcRadiusReadout, opacity: t * to.arcRadiusReadout.opacity };
    }
  } else if (from.arcCenter) {
    // Collapse toward `to`'s curve apex / corner while fading.
    const apex: Pt = [to.cornerX, to.cornerY];
    arcCenter = {
      point: lerpPt(from.arcCenter.point, apex, t),
      opacity: from.arcCenter.opacity * (1 - t),
    };
    if (from.arcRadiusReadout) {
      arcRadiusReadout = {
        point: lerpPt(from.arcRadiusReadout.point, apex, t),
        R: from.arcRadiusReadout.R,
        opacity: from.arcRadiusReadout.opacity * (1 - t),
      };
    }
  }

  // === Reference arc — lerp endpoints + R per number; fade if only
  // one side has it. ===
  let referenceArc: MorphedOverlay["referenceArc"];
  if (from.referenceArc && to.referenceArc) {
    referenceArc = {
      start: lerpPt(from.referenceArc.start, to.referenceArc.start, t),
      end: lerpPt(from.referenceArc.end, to.referenceArc.end, t),
      R: lerp(from.referenceArc.R, to.referenceArc.R, t),
      opacity: lerp(from.referenceArc.opacity, to.referenceArc.opacity, t),
    };
  } else if (to.referenceArc) {
    referenceArc = { ...to.referenceArc, opacity: t * to.referenceArc.opacity };
  } else if (from.referenceArc) {
    referenceArc = { ...from.referenceArc, opacity: from.referenceArc.opacity * (1 - t) };
  }

  // === Corner XY + endpoints ===
  const cornerX = lerp(from.cornerX, to.cornerX, t);
  const cornerY = lerp(from.cornerY, to.cornerY, t);
  const P0 = lerpPt(from.P0, to.P0, t);
  const P7 = lerpPt(from.P7, to.P7, t);

  return {
    points,
    controlPolygons,
    arcSpokes,
    arcCenter,
    arcRadiusReadout,
    referenceArc,
    cornerX,
    cornerY,
    P0,
    P7,
  };
}
