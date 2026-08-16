// Octane compiles consumer hook calls with a trailing Symbol. Published plain
// TypeScript bindings receive that Symbol and derive stable sub-slots for the
// base hooks they compose.
const subSlotCache = new Map<symbol, Map<string, symbol>>();

export function splitSlot<T>(args: T[]): [T[], symbol | undefined] {
  const tail = args[args.length - 1];
  const slot = typeof tail === "symbol" ? (tail as symbol) : undefined;
  return [slot === undefined ? args : args.slice(0, -1), slot];
}

export function subSlot(slot: symbol | undefined, tag: string): symbol | undefined {
  if (slot === undefined) return undefined;
  let byTag = subSlotCache.get(slot);
  if (byTag === undefined) subSlotCache.set(slot, (byTag = new Map()));
  let child = byTag.get(tag);
  if (child === undefined) {
    child = Symbol.for(`@lisse/octane:${slot.description ?? ""}:${tag}`);
    byTag.set(tag, child);
  }
  return child;
}

// Plain-TS components in this package do not receive compiler slots at their
// own hook sites, so each hook call gets a stable package-local symbol.
const componentSlotCache = new Map<string, symbol>();

export function componentSlot(name: string): symbol {
  let slot = componentSlotCache.get(name);
  if (slot === undefined) {
    slot = Symbol.for(`@lisse/octane:component:${name}`);
    componentSlotCache.set(name, slot);
  }
  return slot;
}
