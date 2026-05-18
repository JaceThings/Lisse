import {
  forwardRef,
  useMemo,
  useRef,
  createElement,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  type ForwardedRef,
} from "react";
import { useSmoothCorners } from "./use-smooth-corners.js";
import { Slot } from "./slot.js";
import { composeRefs } from "./compose-refs.js";
import { hasEffects } from "@lisse/core";
import type { SmoothCornerOptions, BorderConfig, ShadowConfig } from "@lisse/core";

/**
 * How to render the `shadow` prop chain.
 *
 * - `"svg"`: path-based filter that matches the squircle silhouette
 *   exactly. Subject to a Safari `<filter>` rasterisation bug; the core
 *   ships a user-space filter-region workaround (see `computeFilterPad`
 *   in `drop-shadow.ts`) but residual artefacts can still surface.
 * - `"box-shadow"`: native CSS `box-shadow` on a sibling div. Immune to
 *   the WebKit bug, but the silhouette is a rounded rectangle, not a
 *   squircle. Border, clip-path, and content stay squircle-shaped.
 *
 * Pick `"box-shadow"` when Safari fidelity matters more than the shadow
 * tracing the squircle outline.
 *
 * **Note**: strategy applies to the explicit `shadow` prop only. Auto-
 * extracted CSS shadows are still stripped but are **not** routed
 * through the sibling div. Either pass the shadow explicitly or set
 * `autoEffects={false}` to keep the consumer's CSS `box-shadow` in place.
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

type AnyForwardedRef = ForwardedRef<Element>;

/**
 * Build a CSS `box-shadow` chain from one or more shadows. First entry
 * renders topmost (CSS-spec order). Invisible (opacity <= 0) entries are
 * dropped so the string stays minimal.
 */
function buildBoxShadowChain(shadows: ShadowConfig | ShadowConfig[]): string {
  const arr = Array.isArray(shadows) ? shadows : [shadows];
  const parts: string[] = [];
  for (const s of arr) {
    if (s.opacity <= 0) continue;
    const { offsetX, offsetY, blur, spread, color, opacity } = s;
    const rgb = hexToRgbChannels(color);
    parts.push(
      `${offsetX}px ${offsetY}px ${blur}px ${spread}px rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})`,
    );
  }
  return parts.join(", ");
}

/**
 * Parse a 3- or 6-digit hex string into rgb channels. Core's `hexToRgb`
 * returns a formatted `rgb(...)` string; here we need the channels
 * separately to compose `rgba(r,g,b,opacity)` for box-shadow.
 */
function hexToRgbChannels(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const expanded = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
  return {
    r: parseInt(expanded.substring(0, 2), 16),
    g: parseInt(expanded.substring(2, 4), 16),
    b: parseInt(expanded.substring(4, 6), 16),
  };
}

/**
 * Best-effort `border-radius` for the box-shadow sibling div. The shadow
 * won't trace the squircle silhouette either way (see ShadowStrategy) but
 * this at least mimics the per-corner shape.
 */
function cornerOptionsToBorderRadius(options: SmoothCornerOptions): string {
  if ("radius" in options) return `${options.radius}px`;
  const radiusOf = (v: typeof options.topLeft): number => {
    if (v === undefined) return 0;
    if (typeof v === "number") return v;
    return v.radius;
  };
  const tl = radiusOf(options.topLeft);
  const tr = radiusOf(options.topRight);
  const br = radiusOf(options.bottomRight);
  const bl = radiusOf(options.bottomLeft);
  return `${tl}px ${tr}px ${br}px ${bl}px`;
}

function SmoothCornersImpl<E extends ElementType = "div">(
  props: SmoothCornersProps<E>,
  externalRef: AnyForwardedRef,
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

  // Box-shadow strategy: suppress the `shadow` prop on its way to the SVG
  // layer — the CSS sibling div below renders the chain instead.
  // `innerShadow` is unaffected (inside the clip, no WebKit bug).
  const effectiveShadow = useBoxShadow ? undefined : shadow;

  const explicitEffects = {
    innerBorder,
    outerBorder,
    middleBorder,
    innerShadow,
    shadow: effectiveShadow,
  };
  const hasExplicit = hasEffects(explicitEffects);
  // Wrapper is required when any effect renders OR when the box-shadow
  // sibling div needs its relative positioning context.
  const needsWrapper =
    (autoEffects ?? true) || hasExplicit || (useBoxShadow && shadow !== undefined);

  const effectsOptions = {
    wrapperRef: needsWrapper
      ? (wrapperRef as React.RefObject<HTMLElement | null>)
      : undefined,
    effects: hasExplicit ? explicitEffects : undefined,
    autoEffects,
    skipShadowHandle: useBoxShadow,
  };

  useSmoothCorners(internalRef, options, effectsOptions);

  const inner = asChild
    ? createElement(Slot, { ...rest, ref: setInnerRef }, children)
    : createElement(Component, { ...rest, ref: setInnerRef }, children);

  if (!needsWrapper) return inner;

  // Box-shadow strategy: absolutely-positioned sibling div behind the
  // clipped element (z-index:-1) carries the chain. Must be a sibling —
  // clip-path on the consumer's element would otherwise crop the halo.
  let shadowSibling: ReactNode = null;
  if (useBoxShadow && shadow !== undefined) {
    const chain = buildBoxShadowChain(shadow);
    if (chain !== "") {
      const style: CSSProperties = {
        position: "absolute",
        inset: 0,
        borderRadius: cornerOptionsToBorderRadius(options),
        boxShadow: chain,
        pointerEvents: "none",
        zIndex: -1,
      };
      shadowSibling = createElement("div", {
        "aria-hidden": true,
        "data-slot": "smooth-corners-box-shadow",
        style,
      });
    }
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
