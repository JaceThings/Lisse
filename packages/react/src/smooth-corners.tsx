import {
  forwardRef,
  useRef,
  useImperativeHandle,
  createElement,
  type ElementType,
  type ReactNode,
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  type ForwardedRef,
} from "react";
import { useSmoothCorners } from "./use-smooth-corners.js";
import { hasEffects } from "@lisse/core";
import type { SmoothCornerOptions, BorderConfig, ShadowConfig, CornerConfig } from "@lisse/core";

/** Own props of <SmoothCorners /> independent of the rendered element. */
export type SmoothCornersOwnProps = {
  children?: ReactNode;
  innerBorder?: BorderConfig;
  outerBorder?: BorderConfig;
  middleBorder?: BorderConfig;
  innerShadow?: ShadowConfig | ShadowConfig[];
  shadow?: ShadowConfig | ShadowConfig[];
  /** Automatically extract CSS border and box-shadow as SVG effects. Default: true */
  autoEffects?: boolean;
} & SmoothCornerOptions;

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
    children,
    radius,
    smoothing,
    preserveSmoothing,
    topLeft,
    topRight,
    bottomRight,
    bottomLeft,
    innerBorder,
    outerBorder,
    middleBorder,
    innerShadow,
    shadow,
    autoEffects,
    ...rest
  } = props as SmoothCornersProps<E> & {
    radius?: number;
    smoothing?: number;
    preserveSmoothing?: boolean;
    topLeft?: CornerConfig | number;
    topRight?: CornerConfig | number;
    bottomRight?: CornerConfig | number;
    bottomLeft?: CornerConfig | number;
  };

  const Component = (as ?? "div") as ElementType;

  const internalRef = useRef<HTMLElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(externalRef as ForwardedRef<HTMLElement>, () => internalRef.current!);

  const options: SmoothCornerOptions =
    radius !== undefined
      ? { radius, smoothing, preserveSmoothing }
      : { topLeft, topRight, bottomRight, bottomLeft };

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

  const inner = createElement(Component, { ...rest, ref: internalRef }, children);

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
