import {
  cloneVNode,
  Fragment,
  Comment,
  Text,
  type FunctionalComponent,
  type VNode,
} from "vue";

/**
 * Minimal Radix-style Slot for Vue. Clones the single default slot child
 * vnode, merging the Slot's attrs onto it. Implemented as a functional
 * component so the parent's `ref` is forwarded to the cloned child
 * element automatically.
 *
 * Fragments in the slot content are flattened recursively so a
 * `<template>` wrapping exactly one element is accepted. Comment and
 * text vnodes are rejected because they cannot carry attrs or refs.
 *
 * Used internally to back the `asChild` prop on <SmoothCorners />.
 */
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

export const Slot: FunctionalComponent<Record<string, unknown>, Record<string, never>, { default: () => VNode[] }> = (
  _props,
  { attrs, slots },
) => {
  const children = slots.default?.();
  if (!children || children.length === 0) {
    throw new Error("Slot: `asChild` expects a single default slot child.");
  }
  const elements = flatten(children).filter(isElementVNode);
  if (elements.length !== 1) {
    throw new Error("Slot: `asChild` expects exactly one element child.");
  }
  return cloneVNode(elements[0], attrs);
};

Slot.inheritAttrs = false;
Slot.displayName = "LisseSlot";
