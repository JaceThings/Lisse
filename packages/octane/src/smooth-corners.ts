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
import { hasEffects, cornerOptionsToBorderRadius } from "@lisse/core";
import type { SmoothCornerOptions, BorderConfig, ShadowConfig } from "@lisse/core";
import { componentSlot, subSlot } from "./manual.js";
import { Slot } from "./slot.js";
import { useSmoothCorners } from "./use-smooth-corners.js";
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

function styleHasBorderRadius(style: unknown): boolean {
  if (!style || typeof style !== "object") return false;
  const record = style as Record<string, unknown>;
  return Object.keys(record).some((key) => record[key] !== undefined && RADIUS_PROPERTY.test(key));
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

  const userStyle = (rest as Record<string, unknown>).style;
  const childStyle = asChild ? childSuppliedStyle(children) : undefined;
  const userSuppliedRadius =
    typeof userStyle === "string" ||
    typeof childStyle === "string" ||
    styleHasBorderRadius(userStyle) ||
    styleHasBorderRadius(childStyle);
  const innerStyle =
    typeof userStyle === "string"
      ? userStyle
      : {
          borderRadius: fallbackRadiusRef.current,
          ...(userStyle && typeof userStyle === "object" ? userStyle : {}),
        };

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
  const needsWrapper = (autoEffects ?? true) || hasExplicit || siblingShadow !== undefined;

  const effectsOptions = {
    wrapperRef: needsWrapper ? wrapperRef : undefined,
    effects: hasExplicit ? explicitEffects : undefined,
    autoEffects,
    skipShadowHandle: useBoxShadow,
    onExtractedShadow: useBoxShadow ? onExtractedShadow : undefined,
    fallbackBorderRadius: userSuppliedRadius ? undefined : (fallbackRadiusRef.current ?? undefined),
  };

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
  if (useBoxShadow && siblingShadow !== undefined) {
    const chain = buildBoxShadowChain(siblingShadow);
    if (chain !== "") {
      shadowSibling = createElement("div", {
        "aria-hidden": true,
        "data-slot": "smooth-corners-box-shadow",
        style: {
          position: "absolute",
          inset: 0,
          borderRadius: cornerOptionsToBorderRadius(options),
          boxShadow: chain,
          pointerEvents: "none",
          zIndex: -1,
        },
      });
    }
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
