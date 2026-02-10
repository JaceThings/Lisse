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
import type { SmoothCornerOptions, BorderConfig, ShadowConfig } from "@smooth-corners/core";

export type SmoothCornersProps = {
  /** The HTML element to render. Default: "div" */
  as?: ElementType;
  children?: ReactNode;
  innerBorder?: BorderConfig;
  outerBorder?: BorderConfig;
  innerShadow?: ShadowConfig;
  shadow?: ShadowConfig;
} & SmoothCornerOptions &
  Omit<HTMLAttributes<HTMLElement>, "children" | keyof SmoothCornerOptions>;

/**
 * Component that renders an element with smooth corners applied via clip-path.
 * When effect props (innerBorder, outerBorder, innerShadow, shadow) are provided,
 * auto-creates a wrapper div for the SVG overlay and drop shadow filter.
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
      innerShadow,
      shadow,
      ...rest
    } = props as SmoothCornersProps & {
      radius?: number;
      smoothing?: number;
      preserveSmoothing?: boolean;
      topLeft?: any;
      topRight?: any;
      bottomRight?: any;
      bottomLeft?: any;
    };

    const internalRef = useRef<HTMLElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(externalRef, () => internalRef.current!);

    const options: SmoothCornerOptions =
      radius !== undefined
        ? { radius, smoothing, preserveSmoothing }
        : { topLeft, topRight, bottomRight, bottomLeft };

    const hasEffects = !!(innerBorder || outerBorder || innerShadow || shadow);

    const effectsOptions = hasEffects
      ? {
          wrapperRef: wrapperRef as React.RefObject<HTMLElement | null>,
          effects: { innerBorder, outerBorder, innerShadow, shadow },
        }
      : undefined;

    useSmoothCorners(internalRef, options, effectsOptions);

    if (hasEffects) {
      return createElement(
        "div",
        { ref: wrapperRef, style: { position: "relative" as const } },
        createElement(Component, { ...rest, ref: internalRef }, children),
      );
    }

    return createElement(Component, { ...rest, ref: internalRef }, children);
  }
);
