import {
  Children,
  cloneElement,
  forwardRef,
  Fragment,
  isValidElement,
  useMemo,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ForwardedRef,
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
          // Child's event.preventDefault() opts out of the composed parent handler.
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
 * Element-specific props shape for `Slot`. The generic parameter only
 * tightens what TypeScript accepts at the call site; the runtime forwards
 * every prop to the cloned child regardless of type.
 *
 * ```tsx
 * <Slot<"a"> href="/x"><a>link</a></Slot>
 * ```
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
  const childProps = (childElement.props ?? {}) as AnyProps;
  // React 19 moves refs onto `element.props.ref`; React 18 keeps them on the
  // element's own `.ref` slot and emits a deprecation `console.error` in dev
  // when read from there. Prefer `props.ref` with a fallback so we work on
  // both versions without warning.
  const existingRef =
    (childProps as { ref?: Ref<HTMLElement> }).ref ??
    (childElement as unknown as { ref?: Ref<HTMLElement> }).ref;
  const merged = mergeProps(rest as AnyProps, childProps);
  // Memoize so an unrelated parent re-render doesn't hand the child a fresh
  // callback ref, which React would detach then re-attach.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const composedRef = useMemo(
    () => composeRefs(forwardedRef, existingRef),
    [forwardedRef, existingRef],
  );
  return cloneElement(childElement, {
    ...merged,
    ref: composedRef,
  } as AnyProps);
}

/**
 * Clones its single child element, merging the Slot's own props onto the
 * child and composing event handlers and refs. Backs the `asChild` prop on
 * <SmoothCorners />.
 */
export const Slot = forwardRef(SlotImpl) as <E extends ElementType = ElementType>(
  props: SlotPropsFor<E> & { ref?: Ref<HTMLElement> },
) => ReactElement | null;
