// Octane stamps each hook call site with a uniquely described Symbol and passes
// it as the last argument. Sub-slots key off that description, so an empty one
// would collide every call site's hook state.
const subSlotCache = new Map<symbol, Map<string, symbol>>();

export function subSlot(slot: symbol | undefined, tag: string): symbol | undefined {
  if (slot === undefined) return undefined;
  let byTag = subSlotCache.get(slot);
  if (byTag === undefined) subSlotCache.set(slot, (byTag = new Map()));
  let child = byTag.get(tag);
  if (child === undefined) {
    const description = slot.description;
    if (!description) {
      throw new Error(
        `@lisse/octane: hook slot for "${tag}" has no description. Pass Octane's own slot through, or a Symbol.for("<unique id>") of your own.`,
      );
    }
    child = Symbol.for(`@lisse/octane:${description}:${tag}`);
    byTag.set(tag, child);
  }
  return child;
}

const componentSlotCache = new Map<string, symbol>();

export function componentSlot(name: string): symbol {
  let slot = componentSlotCache.get(name);
  if (slot === undefined) {
    slot = Symbol.for(`@lisse/octane:component:${name}`);
    componentSlotCache.set(name, slot);
  }
  return slot;
}
