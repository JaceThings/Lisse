import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useMemo,
  useRef,
  useState,
  createElement,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  type ForwardedRef,
} from "react";
import { useSmoothCorners, useIsoLayoutEffect } from "./use-smooth-corners.js";
import { Slot } from "./slot.js";
import { composeRefs } from "./compose-refs.js";
import {
  acquireIsolation,
  releaseIsolation,
  hasEffects,
  cornerOptionsToBorderRadius,
} from "@lisse/core";
import type { SmoothCornerOptions, BorderConfig, ShadowConfig } from "@lisse/core";

/**
 * How to render the `shadow` prop chain.
 *
 * - `"svg"`: path-based filter that traces the squircle silhouette exactly,
 *   but is subject to a Safari `<filter>` rasterisation bug.
 * - `"box-shadow"`: native CSS `box-shadow` on a sibling div, immune to the
 *   WebKit bug but with a rounded-rectangle (not squircle) silhouette.
 *   Border, clip-path, and content stay squircle-shaped.
 *
 * An auto-extracted CSS `box-shadow` is routed through the sibling div too;
 * the explicit `shadow` prop takes precedence over the extracted chain.
 */
export type ShadowStrategy = "svg" | "box-shadow";

/** Own props of <SmoothCorners /> independent of the rendered element. */
export type SmoothCornersOwnProps = {
  children?: ReactNode;
  /** Corner configuration: uniform `{ radius, smoothing }` or per-corner `{ topLeft, topRight, ... }`. */
  corners?: SmoothCornerOptions;
  innerBorder?: BorderConfig;
  outerBorder?: BorderConfig;
  middleBorder?: BorderConfig;
  innerShadow?: ShadowConfig | ShadowConfig[];
  shadow?: ShadowConfig | ShadowConfig[];
  /** Automatically extract CSS border and box-shadow as SVG effects. Default: true */
  autoEffects?: boolean;
  /**
   * Selects the render path for the `shadow` prop chain. See
   * {@link ShadowStrategy} for the squircle-vs-Safari trade-off.
   * Default: `"svg"`.
   */
  shadowStrategy?: ShadowStrategy;
  /**
   * Merge SmoothCorners onto its single child element instead of rendering
   * its own. The child receives the internal ref and any spread props. When
   * set, the `as` prop is ignored. Default: false.
   */
  asChild?: boolean;
};

type ReservedKeys = keyof SmoothCornersOwnProps | "as";

/**
 * Polymorphic props for <SmoothCorners />. The element passed via `as`
 * determines the available HTML attributes.
 */
export type SmoothCornersProps<E extends ElementType = "div"> = SmoothCornersOwnProps & {
  /** The HTML element or component to render. Default: "div" */
  as?: E;
} & Omit<ComponentPropsWithoutRef<E>, ReservedKeys>;

/** CSS `box-shadow` chain; first entry renders topmost. Invisible entries are dropped. */
function buildBoxShadowChain(shadows: ShadowConfig | ShadowConfig[]): string {
  const arr = Array.isArray(shadows) ? shadows : [shadows];
  const parts: string[] = [];
  for (const s of arr) {
    if (s.opacity <= 0) continue;
    const { offsetX, offsetY, blur, spread, color, opacity } = s;
    const geometry = `${offsetX}px ${offsetY}px ${blur}px ${spread}px`;
    const rgb = hexToRgbChannels(color);
    // Non-hex colors (oklch/lab/color()…) can't be split into channels —
    // parseInt would yield `rgba(NaN,…)`, which CSS treats as invalid and
    // drops the entire box-shadow declaration. Extraction embeds alpha in the
    // string with opacity 1 (verbatim is exact); API-supplied opacity < 1 is
    // applied via color-mix to match the SVG strategy's fill-opacity.
    const paint = rgb
      ? `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})`
      : opacity < 1
        ? `color-mix(in srgb, ${color} ${opacity * 100}%, transparent)`
        : color;
    parts.push(`${geometry} ${paint}`);
  }
  return parts.join(", ");
}

// Core's exported hexToRgb returns a formatted `rgb(...)` string; box-shadow
// needs the raw channels to compose `rgba(r,g,b,opacity)`. Returns null for
// anything that isn't a 3- or 6-digit hex, so the caller can fall back to the
// original color string.
function hexToRgbChannels(hex: string): { r: number; g: number; b: number } | null {
  if (!/^#?[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(hex)) return null;
  const h = hex.replace("#", "");
  const expanded = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
  return {
    r: parseInt(expanded.substring(0, 2), 16),
    g: parseInt(expanded.substring(2, 4), 16),
    b: parseInt(expanded.substring(4, 6), 16),
  };
}

/** The `style` of the single element `asChild` clones onto. */
function childSuppliedStyle(children: ReactNode): CSSProperties | undefined {
  const child = Children.toArray(children)[0];
  if (!isValidElement(child)) return undefined;
  return (child.props as { style?: CSSProperties }).style;
}

// `borderRadius` plus every per-corner longhand, physical and logical
// (`borderTopLeftRadius`, `borderStartEndRadius`, …).
const RADIUS_PROPERTY = /^border[A-Za-z]*Radius$/;

/**
 * True when `style` sets any corner radius. Longhands count: the teardown
 * clears the `border-radius` shorthand, which erases the longhands with it, so
 * a single per-corner value the consumer set is enough to disable the fallback.
 */
function styleHasBorderRadius(style: CSSProperties | undefined): boolean {
  if (!style) return false;
  const record = style as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (record[key] !== undefined && RADIUS_PROPERTY.test(key)) return true;
  }
  return false;
}

function SmoothCornersImpl<E extends ElementType = "div">(
  props: SmoothCornersProps<E>,
  externalRef: ForwardedRef<Element>,
) {
  const {
    as,
    asChild,
    children,
    corners,
    innerBorder,
    outerBorder,
    middleBorder,
    innerShadow,
    shadow,
    autoEffects,
    shadowStrategy,
    ...rest
  } = props;

  const Component = (as ?? "div") as ElementType;

  const internalRef = useRef<HTMLElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const setInnerRef = useMemo(
    () => composeRefs<HTMLElement>(internalRef, externalRef as ForwardedRef<HTMLElement>),
    [externalRef],
  );

  const options: SmoothCornerOptions = corners ?? { radius: 0 };
  const useBoxShadow = shadowStrategy === "box-shadow";

  // SSR/first-paint fallback: emit an inline `border-radius` derived from the
  // corner radius so server markup (and the client's initial, pre-mount render)
  // shows rounded corners instead of square ones before the clip-path lands.
  // Rendered identically on server and client → hydration-safe. After mount the
  // clip-path (set imperatively in useSmoothCorners) takes over the silhouette.
  // A user-supplied `style.borderRadius` always wins.
  //
  // The fallback value is frozen at first render: it only matters before the
  // clip-path lands (SSR + first client paint), and the clip-path governs the
  // silhouette for every subsequent frame. Re-deriving it each render would
  // rewrite `style.borderRadius` on the DOM on every commit — a wasted style
  // recalc that, because the element also carries a large imperatively-set
  // clip-path string, is disproportionately expensive to churn.
  const fallbackRadiusRef = useRef<string | null>(null);
  if (fallbackRadiusRef.current === null) {
    fallbackRadiusRef.current = cornerOptionsToBorderRadius(options);
  }
  const userStyle = (rest as { style?: CSSProperties }).style;
  // Under `asChild` the radius that reaches the DOM may come from the child,
  // because Slot merges the child's style last. Clearing that would discard a
  // value the consumer set, so it counts as user-supplied here too.
  const childStyle = asChild ? childSuppliedStyle(children) : undefined;
  const userSuppliedRadius = styleHasBorderRadius(userStyle) || styleHasBorderRadius(childStyle);
  const innerStyle: CSSProperties = {
    borderRadius: fallbackRadiusRef.current,
    ...userStyle,
  };

  // Box-shadow strategy: suppress the `shadow` prop on its way to the SVG
  // layer — the CSS sibling div below renders the chain instead.
  // `innerShadow` is unaffected (inside the clip, no WebKit bug).
  const effectiveShadow = useBoxShadow ? undefined : shadow;

  // Explicit `shadow` prop wins over the auto-extracted one, matching mergeEffects.
  const [extractedShadow, setExtractedShadow] = useState<
    ShadowConfig | ShadowConfig[] | undefined
  >(undefined);
  const onExtractedShadow = useCallback(
    (next: ShadowConfig | ShadowConfig[] | undefined) => setExtractedShadow(next),
    [],
  );

  const explicitEffects = {
    innerBorder,
    outerBorder,
    middleBorder,
    innerShadow,
    shadow: effectiveShadow,
  };
  const hasExplicit = hasEffects(explicitEffects);
  const siblingShadow = useBoxShadow ? (shadow ?? extractedShadow) : undefined;
  const shadowChain = siblingShadow === undefined ? "" : buildBoxShadowChain(siblingShadow);
  const hasShadowSibling = shadowChain !== "";
  // Wrapper is required when any effect renders OR when the box-shadow
  // sibling div needs its relative positioning context.
  const needsWrapper =
    (autoEffects ?? true) || hasExplicit || siblingShadow !== undefined;

  const effectsOptions = {
    wrapperRef: needsWrapper
      ? (wrapperRef as React.RefObject<HTMLElement | null>)
      : undefined,
    effects: hasExplicit ? explicitEffects : undefined,
    autoEffects,
    skipShadowHandle: useBoxShadow,
    onExtractedShadow: useBoxShadow ? onExtractedShadow : undefined,
    // Hand the SSR fallback to the hook so it can clear it from the DOM once
    // the clip-path lands; a user-supplied border-radius is left untouched.
    fallbackBorderRadius: userSuppliedRadius ? undefined : (fallbackRadiusRef.current ?? undefined),
  };

  // Declared before useSmoothCorners: the acquire must land before the hook's
  // teardown releases core's count, or the handover passes through zero.
  useIsoLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !hasShadowSibling) return;
    // Our own declaration is already committed; blank it so the count saves ""
    // and doesn't restore ours once the sibling goes.
    wrapper.style.isolation = "";
    acquireIsolation(wrapper);
    return () => releaseIsolation(wrapper);
  }, [hasShadowSibling]);

  useSmoothCorners(internalRef, options, effectsOptions);

  const inner = asChild
    ? createElement(Slot, { ...rest, style: innerStyle, ref: setInnerRef }, children)
    : createElement(Component, { ...rest, style: innerStyle, ref: setInnerRef }, children);

  if (!needsWrapper) return inner;

  // Box-shadow strategy: absolutely-positioned sibling div behind the
  // clipped element (z-index:-1) carries the chain. Must be a sibling —
  // clip-path on the consumer's element would otherwise crop the halo.
  let shadowSibling: ReactNode = null;
  if (hasShadowSibling) {
    const style: CSSProperties = {
      position: "absolute",
      inset: 0,
      borderRadius: cornerOptionsToBorderRadius(options),
      boxShadow: shadowChain,
      pointerEvents: "none",
      zIndex: -1,
    };
    shadowSibling = createElement("div", {
      "aria-hidden": true,
      "data-slot": "smooth-corners-box-shadow",
      style,
    });
  }

  return createElement(
    "div",
    {
      ref: wrapperRef,
      style: {
        position: "relative" as const,
        // `isolation: isolate` keeps the z-index:-1 sibling from sinking
        // behind ancestors — same trick the SVG path uses.
        ...(shadowSibling ? { isolation: "isolate" as const } : {}),
      },
    },
    shadowSibling,
    inner,
  );
}

/**
 * Renders an element with smooth corners applied via clip-path. When any
 * effect prop is set, or when `autoEffects` is enabled (default), a
 * wrapper div is created to host the SVG overlay and drop-shadow filter.
 *
 * @example
 * ```tsx
 * <SmoothCorners as="section" corners={{ radius: 20, smoothing: 0.6 }}>
 *   <p>Content</p>
 * </SmoothCorners>
 * ```
 */
export const SmoothCorners = forwardRef(SmoothCornersImpl) as <E extends ElementType = "div">(
  props: SmoothCornersProps<E> & { ref?: ComponentPropsWithRef<E>["ref"] },
) => ReturnType<typeof SmoothCornersImpl>;
