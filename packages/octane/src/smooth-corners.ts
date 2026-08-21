import {
  Children,
  createElement,
  isValidElement,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "octane";
import type { OctaneNode } from "octane";
import {
  acquireIsolation,
  releaseIsolation,
  hasEffects,
  cornerOptionsToBorderRadius,
} from "@lisse/core";
import type { SmoothCornerOptions, BorderConfig, ShadowConfig } from "@lisse/core";
import { componentSlot, subSlot } from "./manual.js";
import { Slot } from "./slot.js";
import { useIsoLayoutEffect, useSmoothCorners } from "./use-smooth-corners.js";
import type {
  ComponentPropsWithoutRef,
  ElementType,
  PropsOf,
  Ref,
} from "./types.js";

export type ShadowStrategy = "svg" | "box-shadow";

export type SmoothCornersOwnProps = {
  children?: OctaneNode;
  corners?: SmoothCornerOptions;
  innerBorder?: BorderConfig;
  outerBorder?: BorderConfig;
  middleBorder?: BorderConfig;
  innerShadow?: ShadowConfig | ShadowConfig[];
  shadow?: ShadowConfig | ShadowConfig[];
  autoEffects?: boolean;
  shadowStrategy?: ShadowStrategy;
  asChild?: boolean;
};

type ReservedKeys = keyof SmoothCornersOwnProps | "as";

export type SmoothCornersProps<E extends ElementType = "div"> = SmoothCornersOwnProps & {
  as?: E;
} & Omit<ComponentPropsWithoutRef<E>, ReservedKeys>;

type ComponentRef<E extends ElementType> = PropsOf<E> extends { ref?: infer R } ? R : Ref<HTMLElement>;

function buildBoxShadowChain(shadows: ShadowConfig | ShadowConfig[]): string {
  const arr = Array.isArray(shadows) ? shadows : [shadows];
  const parts: string[] = [];
  for (const shadow of arr) {
    if (shadow.opacity <= 0) continue;
    const { offsetX, offsetY, blur, spread, color, opacity } = shadow;
    const geometry = `${offsetX}px ${offsetY}px ${blur}px ${spread}px`;
    const rgb = hexToRgbChannels(color);
    const paint = rgb
      ? `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})`
      : opacity < 1
        ? `color-mix(in srgb, ${color} ${opacity * 100}%, transparent)`
        : color;
    parts.push(`${geometry} ${paint}`);
  }
  return parts.join(", ");
}

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

function childSuppliedStyle(children: OctaneNode): unknown {
  const child = Children.toArray(children)[0];
  if (!isValidElement(child)) return undefined;
  return ((child.props ?? {}) as { style?: unknown }).style;
}

const RADIUS_PROPERTY = /^border[A-Za-z]*Radius$/;

// Octane's `style` prop is `string | CSSProperties`, so a radius can arrive as
// a property key or as a declaration. Scanning the text beats a regex here:
// `border(?:-[a-z]+)*-radius` backtracks polynomially on consumer input, and a
// declaration list is trivial to walk.
function radiusDeclaration(text: string): boolean {
  for (const declaration of text.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    if (declaration.slice(0, colon).trim().toLowerCase().endsWith("-radius")) return true;
  }
  return false;
}

// A radius the consumer set wins, and longhands count: the teardown clears the
// shorthand, which erases the longhands with it.
function styleHasBorderRadius(style: unknown): boolean {
  if (!style) return false;
  if (typeof style === "string") return radiusDeclaration(style);
  if (typeof style !== "object") return false;
  const record = style as Record<string, unknown>;
  return Object.keys(record).some((key) => record[key] !== undefined && RADIUS_PROPERTY.test(key));
}

// The fallback goes in front of the consumer's own declarations, in whichever
// form they supplied. Later declarations win, so theirs still do.
function withFallbackRadius(userStyle: unknown, fallbackRadius: string): unknown {
  if (typeof userStyle === "string") {
    return radiusDeclaration(userStyle)
      ? userStyle
      : `border-radius: ${fallbackRadius}; ${userStyle}`;
  }
  return {
    borderRadius: fallbackRadius,
    ...(userStyle && typeof userStyle === "object" ? userStyle : {}),
  };
}

const SMOOTH_CORNERS_SLOT = componentSlot("SmoothCorners");

/** Renders a smooth-cornered Octane element with the same API as the React adapter. */
export function SmoothCorners<E extends ElementType = "div">(
  props: SmoothCornersProps<E> & { ref?: ComponentRef<E> },
): unknown {
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
    ref: externalRef,
    ...rest
  } = props;

  const Component = (as ?? "div") as any;
  const internalRef = useRef<HTMLElement | null>(null, subSlot(SMOOTH_CORNERS_SLOT, "inner-ref"));
  const wrapperRef = useRef<HTMLDivElement | null>(null, subSlot(SMOOTH_CORNERS_SLOT, "wrapper-ref"));
  const innerRef = useMemo(
    () => [internalRef, (externalRef as Ref<HTMLElement> | null) ?? null],
    [externalRef],
    subSlot(SMOOTH_CORNERS_SLOT, "ref-array"),
  );

  const options: SmoothCornerOptions = corners ?? { radius: 0 };
  const useBoxShadow = shadowStrategy === "box-shadow";

  const fallbackRadiusRef = useRef<string | null>(
    null,
    subSlot(SMOOTH_CORNERS_SLOT, "fallback-radius"),
  );
  if (fallbackRadiusRef.current === null) {
    fallbackRadiusRef.current = cornerOptionsToBorderRadius(options);
  }
  // Frozen at first render: it only governs SSR markup and the first paint.
  const fallbackRadius = fallbackRadiusRef.current;

  const userStyle = (rest as Record<string, unknown>).style;
  // Slot merges the child's style last, so its radius reaches the DOM too.
  const childStyle = asChild ? childSuppliedStyle(children) : undefined;
  const userSuppliedRadius = styleHasBorderRadius(userStyle) || styleHasBorderRadius(childStyle);
  const innerStyle = withFallbackRadius(userStyle, fallbackRadius);

  const effectiveShadow = useBoxShadow ? undefined : shadow;
  const [extractedShadow, setExtractedShadow] = useState<
    ShadowConfig | ShadowConfig[] | undefined
  >(undefined, subSlot(SMOOTH_CORNERS_SLOT, "extracted-shadow"));
  const onExtractedShadow = useCallback(
    (next: ShadowConfig | ShadowConfig[] | undefined) => setExtractedShadow(next),
    [],
    subSlot(SMOOTH_CORNERS_SLOT, "extracted-shadow-callback"),
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
  const needsWrapper = (autoEffects ?? true) || hasExplicit || siblingShadow !== undefined;

  const effectsOptions = {
    wrapperRef: needsWrapper ? wrapperRef : undefined,
    effects: hasExplicit ? explicitEffects : undefined,
    autoEffects,
    skipShadowHandle: useBoxShadow,
    onExtractedShadow: useBoxShadow ? onExtractedShadow : undefined,
    fallbackBorderRadius: userSuppliedRadius ? undefined : fallbackRadius,
  };

  // Declared before useSmoothCorners: the acquire must land before the hook's
  // teardown releases core's count, or the handover passes through zero.
  useIsoLayoutEffect(
    () => {
      const wrapper = wrapperRef.current;
      if (!wrapper || !hasShadowSibling) return;
      // Our own declaration is already committed; blank it so the count saves ""
      // and doesn't restore ours once the sibling goes.
      wrapper.style.isolation = "";
      acquireIsolation(wrapper);
      return () => releaseIsolation(wrapper);
    },
    [hasShadowSibling],
    subSlot(SMOOTH_CORNERS_SLOT, "isolation")!,
  );

  useSmoothCorners(
    internalRef,
    options,
    effectsOptions,
    subSlot(SMOOTH_CORNERS_SLOT, "smooth-corners-hook")!,
  );

  const inner = asChild
    ? createElement(Slot as any, { ...rest, style: innerStyle, ref: innerRef }, children)
    : createElement(Component, { ...rest, style: innerStyle, ref: innerRef }, children);

  if (!needsWrapper) return inner;

  let shadowSibling: OctaneNode = null;
  if (hasShadowSibling) {
    shadowSibling = createElement("div", {
      "aria-hidden": true,
      "data-slot": "smooth-corners-box-shadow",
      style: {
        position: "absolute",
        inset: 0,
        borderRadius: cornerOptionsToBorderRadius(options),
        boxShadow: shadowChain,
        pointerEvents: "none",
        zIndex: -1,
      },
    });
  }

  return createElement(
    "div",
    {
      ref: wrapperRef,
      style: {
        position: "relative",
        ...(shadowSibling ? { isolation: "isolate" } : {}),
      },
    },
    shadowSibling,
    inner,
  );
}
