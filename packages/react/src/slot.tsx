import {
  Children,
  cloneElement,
  forwardRef,
  Fragment,
  isValidElement,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ForwardedRef,
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
          // Skip the parent handler when the child has called
          // `event.preventDefault()`. Matches Radix's Slot semantics and
          // gives the child a way to opt out of the composed behaviour.
          const first = args[0] as { defaultPrevented?: boolean } | undefined;
          if (first && first.defaultPrevented) return;
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

/**
 * Default props shape for `Slot`. Uses `HTMLAttributes<HTMLElement>` for
 * backwards compatibility -- consumers who need element-specific attributes
 * (`href`, `type`, `name`, ...) should use `SlotPropsFor<E>` instead.
 */
export type SlotProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode;
};

/**
 * Element-specific props shape for `Slot`. Use to opt into attributes of a
 * particular element type when merging onto it:
 *
 * ```tsx
 * <Slot<"a"> href="/x"><a>link</a></Slot>
 * <Slot<"button"> type="submit"><button>submit</button></Slot>
 * ```
 *
 * The runtime forwards every prop to the cloned child regardless of type.
 * The generic parameter only tightens what TypeScript accepts at the call
 * site; there is no runtime difference.
 */
export type SlotPropsFor<E extends ElementType> = Omit<
  ComponentPropsWithoutRef<E>,
  "children"
> & {
  children?: ReactNode;
};

function SlotImpl<E extends ElementType = ElementType>(
  props: SlotPropsFor<E>,
  forwardedRef: ForwardedRef<HTMLElement>,
): ReactElement | null {
  const { children, ...rest } = props as SlotPropsFor<ElementType>;
  const array = Children.toArray(children);
  if (array.length === 0) {
    throw new Error("Slot: `asChild` expects a single child element, received none.");
  }
  if (array.length > 1) {
    throw new Error(
      "Slot: `asChild` expects a single child element, received " + array.length + ".",
    );
  }
  const child = array[0];
  if (!isValidElement(child)) {
    throw new Error(
      "Slot: `asChild` expects a React element as its child (e.g. <button>), not a " +
        (typeof child === "string" ? "string." : typeof child + "."),
    );
  }
  if (child.type === Fragment) {
    throw new Error(
      "Slot: `asChild` expects a single element as its child, not a Fragment. Unwrap the Fragment so Slot can merge props onto a real element.",
    );
  }

  const childElement = child as ReactElement<AnyProps> & { ref?: Ref<HTMLElement> };
  const merged = mergeProps(rest as AnyProps, (childElement.props ?? {}) as AnyProps);
  return cloneElement(childElement, {
    ...merged,
    ref: composeRefs(forwardedRef, childElement.ref),
  } as AnyProps);
}

/**
 * Minimal Radix-style Slot: clones its single child element, merging the
 * Slot's own props onto the child and composing event handlers and refs.
 *
 * Used internally to back the `asChild` prop on <SmoothCorners />.
 */
export const Slot = forwardRef(SlotImpl) as <E extends ElementType = ElementType>(
  props: SlotPropsFor<E> & { ref?: Ref<HTMLElement> },
) => ReactElement | null;
