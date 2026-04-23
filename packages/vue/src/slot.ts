import {
  cloneVNode,
  Fragment,
  Comment,
  type FunctionalComponent,
  type VNode,
} from "vue";

/**
 * Minimal Radix-style Slot for Vue. Clones the single default slot child
 * vnode, merging the Slot's attrs onto it. Implemented as a functional
 * component so the parent's `ref` is forwarded to the cloned child
 * element automatically.
 *
 * Used internally to back the `asChild` prop on <SmoothCorners />.
 */
export const Slot: FunctionalComponent<Record<string, unknown>, Record<string, never>, { default: () => VNode[] }> = (
  _props,
  { attrs, slots },
) => {
  const children = slots.default?.();
  if (!children || children.length === 0) {
    throw new Error("Slot: `asChild` expects a single default slot child.");
  }
  const elements = children.filter(
    (vnode) => vnode.type !== Comment && vnode.type !== Fragment,
  );
  if (elements.length !== 1) {
    throw new Error("Slot: `asChild` expects exactly one element child.");
  }
  const child = elements[0];
  return cloneVNode(child, attrs);
};

Slot.inheritAttrs = false;
Slot.displayName = "LisseSlot";
