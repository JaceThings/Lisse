import type { Octane } from "octane/jsx-runtime";
import type { OctaneNode } from "octane";

export type ElementType = keyof Octane.JSX.IntrinsicElements | ((props: any) => unknown);

export type PropsOf<E extends ElementType> = E extends keyof Octane.JSX.IntrinsicElements
  ? Octane.JSX.IntrinsicElements[E]
  : E extends (props: infer P) => unknown
    ? P
    : Record<string, unknown>;

export type ComponentPropsWithoutRef<E extends ElementType> = Omit<PropsOf<E>, "ref">;
export type ComponentPropsWithRef<E extends ElementType> = PropsOf<E>;
export type Ref<T> = Octane.Ref<T>;

export type { OctaneNode };
