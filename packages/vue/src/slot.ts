import {
  cloneVNode,
  Fragment,
  Comment,
  Text,
  type FunctionalComponent,
  type VNode,
} from "vue";

function flatten(vnodes: VNode[]): VNode[] {
  return vnodes.flatMap((vnode) =>
    vnode.type === Fragment && Array.isArray(vnode.children)
      ? flatten(vnode.children as VNode[])
      : [vnode],
  );
}

function isElementVNode(vnode: VNode): boolean {
  if (vnode.type === Comment || vnode.type === Text || vnode.type === Fragment) {
    return false;
  }
  const t = typeof vnode.type;
  return t === "string" || t === "object" || t === "function";
}

type AnyFn = (...args: unknown[]) => unknown;

/**
 * After cloneVNode has merged parent attrs onto the child vnode, walk
 * the merged props and collapse any `on*` listener pair into a single
 * handler that skips the parent (index 1) when the child (index 0) has
 * called `event.preventDefault()`. Matches the React `Slot` contract.
 *
 * Vue's built-in `mergeProps` concatenates duplicate listeners into
 * `[childHandler, parentHandler]` arrays in that order, so we can
 * identify the pair by shape without tracking which side each handler
 * came from.
 */
function gateListeners(props: Record<string, unknown>): void {
  for (const key of Object.keys(props)) {
    if (!/^on[A-Z]/.test(key)) continue;
    const value = props[key];
    if (!Array.isArray(value) || value.length !== 2) continue;
    const [childFn, parentFn] = value as [AnyFn, AnyFn];
    props[key] = (...args: unknown[]) => {
      childFn(...args);
      const evt = args[0] as { defaultPrevented?: boolean } | undefined;
      if (evt && evt.defaultPrevented) return;
      parentFn(...args);
    };
  }
}

/**
 * Minimal Radix-style Slot for Vue. Clones the single default slot child
 * vnode, merging the Slot's attrs onto it. Implemented as a functional
 * component so the parent's `ref` is forwarded to the cloned child
 * element automatically.
 *
 * Event handlers compose with the same semantics as the React `Slot`:
 * child handler runs first, parent handler runs next unless the child
 * called `event.preventDefault()`.
 *
 * Fragments in the slot content are flattened recursively so a
 * `<template>` wrapping exactly one element is accepted. Comment and
 * text vnodes are rejected because they cannot carry attrs or refs.
 *
 * Used internally to back the `asChild` prop on <SmoothCorners />.
 */
export const Slot: FunctionalComponent<Record<string, unknown>, Record<string, never>, { default: () => VNode[] }> = (
  _props,
  { attrs, slots },
) => {
  const raw = slots.default?.();
  if (!raw || raw.length === 0) {
    throw new Error("Slot: `asChild` expects a single child element, received none.");
  }
  const elements = flatten(raw).filter(isElementVNode);
  if (elements.length === 0) {
    throw new Error(
      "Slot: `asChild` expects a single element child, received only text or comment nodes.",
    );
  }
  if (elements.length > 1) {
    throw new Error(
      "Slot: `asChild` expects a single element child, received " + elements.length + ".",
    );
  }
  const cloned = cloneVNode(elements[0], attrs);
  if (cloned.props) gateListeners(cloned.props as Record<string, unknown>);
  return cloned;
};

Slot.inheritAttrs = false;
Slot.displayName = "LisseSlot";
