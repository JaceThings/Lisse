import {
  forwardRef,
  useCallback,
  useRef,
  createElement,
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
    ...rest
  } = props;

  const Component = (as ?? "div") as ElementType;

  const internalRef = useRef<HTMLElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const setInnerRef = useCallback(
    composeRefs<HTMLElement>(internalRef, externalRef as ForwardedRef<HTMLElement>),
    [externalRef],
  );

  const options: SmoothCornerOptions = corners ?? { radius: 0 };

  const explicitEffects = { innerBorder, outerBorder, middleBorder, innerShadow, shadow };
  const hasExplicit = hasEffects(explicitEffects);
  const needsWrapper = (autoEffects ?? true) || hasExplicit;

  const effectsOptions = {
    wrapperRef: needsWrapper
      ? (wrapperRef as React.RefObject<HTMLElement | null>)
      : undefined,
    effects: hasExplicit ? explicitEffects : undefined,
    autoEffects,
  };

  useSmoothCorners(internalRef, options, effectsOptions);

  const inner = asChild
    ? createElement(Slot, { ...rest, ref: setInnerRef }, children)
    : createElement(Component, { ...rest, ref: setInnerRef }, children);

  if (!needsWrapper) {
    return inner;
  }

  return createElement(
    "div",
    { ref: wrapperRef, style: { position: "relative" as const } },
    inner,
  );
}

/**
 * Component that renders an element with smooth corners applied via clip-path.
 * When effect props (innerBorder, outerBorder, innerShadow, shadow) are provided,
 * or when autoEffects is enabled (default), auto-creates a wrapper div for the
 * SVG overlay and drop shadow filter.
 *
 * @example
 * ```tsx
 * <SmoothCorners radius={20} smoothing={0.6} as="section">
 *   <p>Content</p>
 * </SmoothCorners>
 * ```
 */
export const SmoothCorners = forwardRef(SmoothCornersImpl) as <E extends ElementType = "div">(
  props: SmoothCornersProps<E> & { ref?: ComponentPropsWithRef<E>["ref"] },
) => ReturnType<typeof SmoothCornersImpl>;
