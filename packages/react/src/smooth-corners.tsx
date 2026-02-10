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
import type { SmoothCornerOptions } from "@smooth-corners/core";

export type SmoothCornersProps = {
  /** The HTML element to render. Default: "div" */
  as?: ElementType;
  children?: ReactNode;
} & SmoothCornerOptions &
  Omit<HTMLAttributes<HTMLElement>, "children" | keyof SmoothCornerOptions>;

/**
 * Component that renders an element with smooth corners applied via clip-path.
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
    useImperativeHandle(externalRef, () => internalRef.current!);

    const options: SmoothCornerOptions =
      radius !== undefined
        ? { radius, smoothing, preserveSmoothing }
        : { topLeft, topRight, bottomRight, bottomLeft };

    useSmoothCorners(internalRef, options);

    return createElement(Component, { ...rest, ref: internalRef }, children);
  }
);
