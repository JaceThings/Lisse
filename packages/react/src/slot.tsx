import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { composeRefs } from "./compose-refs.js";

type AnyProps = Record<string, unknown>;

function mergeProps(parent: AnyProps, child: AnyProps): AnyProps {
  const merged: AnyProps = { ...parent };
  for (const key of Object.keys(child)) {
    const childValue = child[key];
    const parentValue = merged[key];

    if (/^on[A-Z]/.test(key) && typeof childValue === "function") {
      if (typeof parentValue === "function") {
        merged[key] = (...args: unknown[]) => {
          (childValue as (...a: unknown[]) => unknown)(...args);
          (parentValue as (...a: unknown[]) => unknown)(...args);
        };
      } else {
        merged[key] = childValue;
      }
    } else if (key === "className") {
      merged[key] = [parentValue, childValue].filter(Boolean).join(" ");
    } else if (key === "style") {
      merged[key] = { ...(parentValue as object), ...(childValue as object) };
    } else {
      merged[key] = childValue;
    }
  }
  return merged;
}

export type SlotProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode;
};

/**
 * Minimal Radix-style Slot: clones its single child element, merging the
 * Slot's own props onto the child and composing event handlers and refs.
 *
 * Used internally to back the `asChild` prop on <SmoothCorners />.
 */
export const Slot = forwardRef<HTMLElement, SlotProps>(function Slot(
  { children, ...props },
  forwardedRef,
) {
  const child = Children.only(children);
  if (!isValidElement(child)) {
    throw new Error("Slot: `asChild` expects a single valid React element child.");
  }

  const childElement = child as ReactElement<AnyProps> & { ref?: Ref<HTMLElement> };
  const merged = mergeProps(props as AnyProps, (childElement.props ?? {}) as AnyProps);
  return cloneElement(childElement, {
    ...merged,
    ref: composeRefs(forwardedRef, childElement.ref),
  } as AnyProps);
});
