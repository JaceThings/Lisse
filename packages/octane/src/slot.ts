import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  useMemo,
} from "octane";
import { componentSlot } from "./manual.js";
import type {
  ComponentPropsWithoutRef,
  ElementType,
  OctaneNode,
  Ref,
} from "./types.js";

type AnyProps = Record<string, unknown>;

function classNames(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(classNames).filter(Boolean).join(" ");
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .filter((key) => (value as Record<string, unknown>)[key])
      .join(" ");
  }
  return "";
}

function mergeProps(parent: AnyProps, child: AnyProps): AnyProps {
  const merged: AnyProps = { ...parent };
  for (const key of Object.keys(child)) {
    const childValue = child[key];
    const parentValue = merged[key];

    if (/^on[A-Z]/.test(key) && typeof childValue === "function") {
      if (typeof parentValue === "function") {
        merged[key] = (...args: unknown[]) => {
          (childValue as (...values: unknown[]) => unknown)(...args);
          const first = args[0] as { defaultPrevented?: boolean } | undefined;
          if (first?.defaultPrevented) return;
          (parentValue as (...values: unknown[]) => unknown)(...args);
        };
      } else {
        merged[key] = childValue;
      }
    } else if (key === "className" || key === "class") {
      const siblingKey = key === "className" ? "class" : "className";
      const siblingValue = merged[siblingKey];
      merged[key] = [classNames(siblingValue), classNames(parentValue), classNames(childValue)]
        .filter(Boolean)
        .join(" ");
      delete merged[siblingKey];
    } else if (key === "style") {
      if (
        parentValue !== null &&
        typeof parentValue === "object" &&
        childValue !== null &&
        typeof childValue === "object"
      ) {
        merged[key] = { ...(parentValue as object), ...(childValue as object) };
      } else {
        merged[key] = childValue;
      }
    } else {
      merged[key] = childValue;
    }
  }
  return merged;
}

export type SlotPropsFor<E extends ElementType> = Omit<
  ComponentPropsWithoutRef<E>,
  "children"
> & {
  children?: OctaneNode;
  ref?: Ref<HTMLElement>;
};

/** Merge a component's props onto one real Octane element child. */
export function Slot<E extends ElementType = ElementType>(
  props: SlotPropsFor<E> & { ref?: Ref<HTMLElement> },
): unknown {
  const { children, ref: forwardedRef, ...rest } = props as SlotPropsFor<ElementType> & {
    ref?: Ref<HTMLElement>;
  };
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
      "Slot: `asChild` expects an Octane element as its child (e.g. <button>), not a " +
        (typeof child === "string" ? "string." : typeof child + "."),
    );
  }
  if (child.type === Fragment) {
    throw new Error(
      "Slot: `asChild` expects a single element as its child, not a Fragment. Unwrap the Fragment so Slot can merge props onto a real element.",
    );
  }

  const childElement = child as typeof child & { ref?: Ref<HTMLElement> };
  const childProps = (childElement.props ?? {}) as AnyProps;
  const existingRef =
    (childProps as { ref?: Ref<HTMLElement> }).ref ?? childElement.ref ?? undefined;
  const merged = mergeProps(rest as AnyProps, childProps);
  const mergedRef = useMemo(
    () => [forwardedRef ?? null, existingRef ?? null],
    [forwardedRef, existingRef],
    componentSlot("Slot:ref-array"),
  );
  return cloneElement(childElement, { ...merged, ref: mergedRef });
}
