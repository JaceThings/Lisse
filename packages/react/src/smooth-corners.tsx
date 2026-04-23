import {
  forwardRef,
  useRef,
  useImperativeHandle,
  createElement,
  type ElementType,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { useSmoothCorners } from "./use-smooth-corners.js";
import { hasEffects } from "@lisse/core";
import type { SmoothCornerOptions, BorderConfig, ShadowConfig, CornerConfig } from "@lisse/core";

export type SmoothCornersProps = {
  /** The HTML element to render. Default: "div" */
  as?: ElementType;
  children?: ReactNode;
  innerBorder?: BorderConfig;
  outerBorder?: BorderConfig;
  middleBorder?: BorderConfig;
  innerShadow?: ShadowConfig | ShadowConfig[];
  shadow?: ShadowConfig | ShadowConfig[];
  /** Automatically extract CSS border and box-shadow as SVG effects. Default: true */
  autoEffects?: boolean;
} & SmoothCornerOptions &
  Omit<HTMLAttributes<HTMLElement>, "children" | keyof SmoothCornerOptions>;

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
export const SmoothCorners = forwardRef<HTMLElement, SmoothCornersProps>(
  function SmoothCorners(props, externalRef) {
    const {
      as: Component = "div",
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
    } = props as SmoothCornersProps & {
      radius?: number;
      smoothing?: number;
      preserveSmoothing?: boolean;
      topLeft?: CornerConfig | number;
      topRight?: CornerConfig | number;
      bottomRight?: CornerConfig | number;
      bottomLeft?: CornerConfig | number;
    };

    const internalRef = useRef<HTMLElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(externalRef, () => internalRef.current!);

    const options: SmoothCornerOptions =
      radius !== undefined
        ? { radius, smoothing, preserveSmoothing }
        : { topLeft, topRight, bottomRight, bottomLeft };

    const explicitEffects = { innerBorder, outerBorder, middleBorder, innerShadow, shadow };

    const effectsOptions = {
      wrapperRef: wrapperRef as React.RefObject<HTMLElement | null>,
      effects: hasEffects(explicitEffects) ? explicitEffects : undefined,
      autoEffects,
    };

    useSmoothCorners(internalRef, options, effectsOptions);

    return createElement(
      "div",
      { ref: wrapperRef, style: { position: "relative" as const } },
      createElement(Component, { ...rest, ref: internalRef }, children),
    );
  }
);
