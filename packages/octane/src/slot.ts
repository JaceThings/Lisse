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

// Octane hyphenates keys before `setProperty`, so `border-radius` and
// `borderRadius` are one DOM property but two object entries — and its style
// diff drops the property when either entry disappears.
function camelizeStyleName(name: string): string {
  if (name.startsWith("--")) return name;
  return name.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase());
}

// A `;` inside quotes or parens belongs to a value (`url(data:…;base64,…)`).
function parseStyleText(text: string): AnyProps {
  const style: AnyProps = {};
  let start = 0;
  let depth = 0;
  let quote = "";
  let escaped = false;
  const take = (end: number): void => {
    const declaration = text.slice(start, end);
    start = end + 1;
    const colon = declaration.indexOf(":");
    if (colon <= 0) return;
    const name = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (name !== "" && value !== "") style[camelizeStyleName(name)] = value;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (escaped) escaped = false;
    else if (char === "\\") escaped = true;
    else if (quote !== "") {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth++;
    else if (char === ")" && depth > 0) depth--;
    else if (char === ";" && depth === 0) take(i);
  }
  take(text.length);
  return style;
}

/** Either `style` form as a property record. */
function asStyleObject(value: unknown): AnyProps {
  if (typeof value === "string") return parseStyleText(value);
  if (value !== null && typeof value === "object") return value as AnyProps;
  return {};
}

// Octane's `style` is CSS text or an object, and the two sides can disagree.
// The child wins per property, matching React's `{ ...parent, ...child }`.
function mergeStyles(parentValue: unknown, childValue: unknown): unknown {
  if (childValue === null || childValue === undefined) return parentValue;
  if (parentValue === null || parentValue === undefined) return childValue;
  if (typeof parentValue === "string" && typeof childValue === "string") {
    return `${parentValue}; ${childValue}`;
  }
  if (typeof parentValue === "object" && typeof childValue === "object") {
    return { ...parentValue, ...childValue };
  }
  // Parse the text side rather than serialize the object side: unitless numbers
  // (`{ inset: 0 }`) need Octane's own applier to become `px`.
  return { ...asStyleObject(parentValue), ...asStyleObject(childValue) };
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
      merged[key] = mergeStyles(parentValue, childValue);
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
